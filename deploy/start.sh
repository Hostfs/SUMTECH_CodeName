#!/usr/bin/env bash
# 옷결 서버 실행(systemd가 부른다). .env의 값을 환경변수로 읽고 Node 서버를 띄운다.
# DB 마이그레이션(V1, V2 …)과 시드는 서버가 시작하며 스스로 한다.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo ".env 파일이 없어요. sudo bash install.sh 로 설치하거나 cp env .env 후 값을 채워 주세요." >&2
  exit 1
fi

set -a
. ./.env
set +a

export NODE_ENV=production
export TZ="${TZ:-Asia/Seoul}"
# /__health가 응답할 배포 버전(이 묶음을 만든 commit)
export RELEASE_ID="${RELEASE_ID:-$(cat RELEASE_ID)}"
export STATIC_DIR="$(pwd)/app/public"

cd app
exec node ${NODE_OPTIONS:-} dist/index.js
