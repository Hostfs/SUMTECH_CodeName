import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'
import { AsyncLocalStorage } from 'node:async_hooks'
import { config } from './config.js'

/**
 * MariaDB 연결. 시각(DATETIME)은 UTC로 읽고 쓴다(Spring 때와 같다: V4 제약이 completed_at + 9시간으로 서울 날짜를 비교한다).
 * 날짜(DATE)는 'YYYY-MM-DD' 문자열 그대로 다룬다(시간대 변환으로 하루가 밀리지 않게).
 */
export const pool: Pool = mysql.createPool({
  ...config.db,
  charset: 'utf8mb4',
  timezone: 'Z',
  dateStrings: ['DATE'],
  decimalNumbers: true,
  supportBigNumbers: true,
  bigNumberStrings: false,
  connectionLimit: 8,
  waitForConnections: true,
})

type Executor = Pool | PoolConnection
const txStore = new AsyncLocalStorage<PoolConnection>()

function exec(): Executor {
  return txStore.getStore() ?? pool
}

export type Row = RowDataPacket & Record<string, any>

/** SELECT. 트랜잭션 안이면 그 연결을 쓴다. */
export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await exec().query<RowDataPacket[]>(sql, params)
  return rows as T[]
}

export async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await query<T>(sql, params))[0]
}

/** INSERT·UPDATE·DELETE. insertId·affectedRows를 돌려준다. */
export async function run(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [res] = await exec().query<ResultSetHeader>(sql, params)
  return res
}

/** 한 요청의 여러 쓰기를 한 트랜잭션으로 묶는다(Spring의 @Transactional과 같은 역할). 안쪽에서 다시 부르면 바깥 트랜잭션에 합류한다. */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (txStore.getStore()) return fn()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await txStore.run(conn, fn)
    await conn.commit()
    return result
  } catch (e) {
    await conn.rollback().catch(() => undefined)
    throw e
  } finally {
    conn.release()
  }
}

/** IN (?) 자리에 넣을 목록. 비어 있으면 아무것도 맞지 않는 값. */
export function inList(ids: readonly unknown[]): unknown[] {
  return ids.length ? [ids] : [[null]]
}
