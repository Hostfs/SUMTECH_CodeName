# 빌드는 이 파일 안에서 끝내고, 컨테이너 시작 명령은 서버 실행만 한다(마이그레이션·시드는 앱이 기동하며 수행).
# 화면(Vite + React)을 빌드해 Express의 정적 파일로 넣으므로 app 컨테이너 하나가 3000 포트에서 화면과 API를 함께 제공한다.
# 배포 서버에서는 이 앞에 nginx(HTTPS·정적 캐시·리버스 프록시)를 둔다(deploy 묶음의 nginx-otgyeol.conf).

FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS server
WORKDIR /srv
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ARG RELEASE_ID=dev
ENV RELEASE_ID=${RELEASE_ID} \
    TZ=Asia/Seoul \
    NODE_ENV=production \
    STATIC_DIR=/app/public
WORKDIR /app
COPY server/package.json ./
COPY --from=server /srv/node_modules ./node_modules
COPY --from=server /srv/dist ./dist
COPY server/db ./db
COPY --from=frontend /fe/dist ./public
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
