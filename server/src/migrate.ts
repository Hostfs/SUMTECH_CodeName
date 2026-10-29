import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pool } from './db.js'

/**
 * db/migration/V<n>__<설명>.sql을 번호 순서로 한 번씩 적용한다.
 * 적용 기록은 Flyway와 같은 flyway_schema_history 표에 남겨, Spring 때 이미 마이그레이션한 DB도 그대로 이어서 쓴다.
 */
export const MIGRATION_DIR = new URL('../db/migration', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

/** DELIMITER 블록(트리거)을 포함한 SQL 파일을 문장 단위로 나눈다. 주석만 있는 줄은 뺀다. */
export function splitSql(text: string): string[] {
  const out: string[] = []
  let delimiter = ';'
  let buf: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    const d = /^DELIMITER\s+(\S+)\s*$/i.exec(trimmed)
    if (d) {
      delimiter = d[1]
      continue
    }
    if (!buf.length && (trimmed === '' || trimmed.startsWith('--'))) continue
    if (trimmed.startsWith('--')) continue
    buf.push(line)
    if (trimmed.endsWith(delimiter)) {
      const stmt = buf.join('\n').trim()
      out.push(stmt.slice(0, stmt.length - delimiter.length).trim())
      buf = []
    }
  }
  const rest = buf.join('\n').trim()
  if (rest) out.push(rest)
  return out.filter(Boolean)
}

export async function migrate(dir = MIGRATION_DIR) {
  const conn = await pool.getConnection()
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS flyway_schema_history (
      installed_rank INT NOT NULL PRIMARY KEY,
      version VARCHAR(50),
      description VARCHAR(200) NOT NULL,
      type VARCHAR(20) NOT NULL,
      script VARCHAR(1000) NOT NULL,
      checksum INT,
      installed_by VARCHAR(100) NOT NULL,
      installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      execution_time INT NOT NULL,
      success TINYINT(1) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
    const [rows] = await conn.query<any[]>('SELECT version, success FROM flyway_schema_history WHERE version IS NOT NULL')
    const failed = rows.find((r) => !r.success)
    if (failed) throw new Error(`마이그레이션 V${failed.version}이 이전에 실패한 채 남아 있어요. DB를 확인해 주세요.`)
    const applied = new Set(rows.map((r) => String(r.version)))
    const files = readdirSync(dir)
      .map((f) => ({ f, m: /^V(\d+)__(.+)\.sql$/.exec(f) }))
      .filter((x): x is { f: string; m: RegExpExecArray } => Boolean(x.m))
      .sort((a, b) => Number(a.m[1]) - Number(b.m[1]))
    for (const { f, m } of files) {
      const version = m[1]
      if (applied.has(version)) continue
      const started = Date.now()
      for (const stmt of splitSql(readFileSync(join(dir, f), 'utf8'))) {
        await conn.query(stmt)
      }
      const [[{ next }]] = await conn.query<any[]>('SELECT COALESCE(MAX(installed_rank), 0) + 1 AS next FROM flyway_schema_history')
      await conn.query(
        `INSERT INTO flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, execution_time, success)
         VALUES (?, ?, ?, 'SQL', ?, NULL, CURRENT_USER(), ?, 1)`,
        [next, version, m[2].replace(/_/g, ' '), f, Date.now() - started],
      )
      console.log(`마이그레이션 V${version} 적용: ${f}`)
    }
  } finally {
    conn.release()
  }
}
