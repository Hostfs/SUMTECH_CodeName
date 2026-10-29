import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// 개발 서버 전용 도구. 운영에서는 Spring 이 같은 주소(/api/image-proxy)로 대신한다.
function devTools(): Plugin {
  const MAX = 12 * 1024 * 1024;
  const privateHost = (h: string) =>
    /^(localhost|0\.0\.0\.0|\[?::1\]?)$/i.test(h) || /^(127|10)\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^169\.254\./.test(h) || h.endsWith('.local');

  return {
    name: 'otgyeol-dev-tools',
    configureServer(server) {
      // 다른 사이트의 상품 이미지를 브라우저가 직접 못 읽는 문제(CORS)를 우회한다. 이미지·공개 주소만 허용.
      server.middlewares.use('/__fetch-image', async (req, res) => {
        try {
          const raw = new URL(req.url ?? '', 'http://x').searchParams.get('url') ?? '';
          const u = new URL(raw);
          if (!/^https?:$/.test(u.protocol) || privateHost(u.hostname)) throw new Error('허용되지 않는 주소예요');
          const r = await fetch(u, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 otgyeol-dev' } });
          const type = r.headers.get('content-type') ?? '';
          if (!r.ok) throw new Error(`원본 서버가 ${r.status} 로 답했어요`);
          if (!type.startsWith('image/')) throw new Error('이미지 주소가 아니에요');
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length > MAX) throw new Error('이미지가 12MB 를 넘어요');
          res.setHeader('content-type', type);
          res.end(buf);
        } catch (e) {
          res.statusCode = 400;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : '불러오지 못했어요' }));
        }
      });

      // 샘플 옷(누끼 결과)을 public/samples 와 src/data/samplePhotos.json 에 저장한다
      server.middlewares.use('/__save-sample', (req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const { name, dataUrl, meta } = JSON.parse(body) as { name: string; dataUrl: string; meta: unknown };
            if (!/^[a-z0-9-]+$/.test(name)) throw new Error('bad name');
            const dir = resolve(server.config.root, 'public/samples');
            mkdirSync(dir, { recursive: true });
            writeFileSync(resolve(dir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
            const jsonPath = resolve(server.config.root, 'src/data/samplePhotos.json');
            const all = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf-8')) : {};
            all[name] = meta;
            writeFileSync(jsonPath, JSON.stringify(all, null, 2));
            res.end('ok');
          } catch (e) {
            res.statusCode = 400;
            res.end(String(e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devTools()],
  server: { port: 5173, host: true },
});
