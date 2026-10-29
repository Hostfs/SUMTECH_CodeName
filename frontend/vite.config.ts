import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// 개발 서버 전용 도구 (샘플 옷 저장).
function devTools(): Plugin {
  return {
    name: 'otgyeol-dev-tools',
    configureServer(server) {
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
  // /api 는 Spring(기본 3000 포트)으로 넘긴다. 세션 쿠키도 같은 주소처럼 동작한다.
  server: { port: 5173, host: true, proxy: { '/api': process.env.API_URL ?? 'http://localhost:3000' } },
});
