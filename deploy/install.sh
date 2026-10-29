#!/usr/bin/env bash
# 옷결 한 번에 설치·업데이트(Ubuntu 22.04/24.04).
#   sudo bash install.sh                 # IP로만 접속(http://서버IP)
#   sudo bash install.sh example.com     # 도메인 연결 + HTTPS 인증서(certbot)
# 같은 명령을 다시 실행하면 새로 올린 묶음으로 업데이트한다(.env와 DB 자료는 그대로 둔다).
set -euo pipefail

DOMAIN="${1:-}"
SRC="$(cd "$(dirname "$0")" && pwd)"
APP_DIR=/opt/otgyeol
SERVICE=otgyeol

say() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "sudo로 실행해 주세요: sudo bash install.sh ${DOMAIN}" >&2; exit 1; }

say "1/7 필요한 프로그램 확인(Node.js 22, MariaDB, nginx)"
export DEBIAN_FRONTEND=noninteractive
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v mariadb >/dev/null || command -v mysql >/dev/null || apt-get install -y mariadb-server
command -v nginx >/dev/null || apt-get install -y nginx
systemctl enable --now mariadb >/dev/null 2>&1 || systemctl enable --now mysql >/dev/null 2>&1 || true
echo "node $(node -v)"

say "2/7 앱 파일 복사 → ${APP_DIR}"
id -u otgyeol >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin otgyeol
mkdir -p "$APP_DIR"
if [ "$SRC" != "$APP_DIR" ]; then
  # .env(비밀값)는 서버에 있는 것을 지킨다. 나머지는 새 묶음으로 바꾼다.
  rm -rf "$APP_DIR/app"
  cp -a "$SRC/app" "$APP_DIR/app"
  for f in start.sh env RELEASE_ID otgyeol.service nginx-otgyeol.conf README.txt install.sh; do
    [ -e "$SRC/$f" ] && cp -a "$SRC/$f" "$APP_DIR/$f"
  done
fi
chmod +x "$APP_DIR/start.sh" "$APP_DIR/install.sh"

say "3/7 설정(.env) 준비"
cd "$APP_DIR"
if [ ! -f .env ]; then
  cp env .env
  echo ".env를 만들었어요(env의 AI·기상청 키를 그대로 씀)."
fi
chmod 600 .env
get() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | tr -d '\r'; }
put() { if grep -qE "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }
# 업데이트: 새 묶음에 새로 생긴 설정(GUEST_MODE 등)은 서버 .env에 없을 때만 묶음 값으로 더한다. 이미 있는 값은 바꾸지 않는다.
tr -d '\r' < env | while IFS= read -r line; do
  case "$line" in ''|'#'*|*' '*=*) continue ;; esac
  key="${line%%=*}"
  grep -qE "^${key}=" .env || { echo "$line" >> .env; echo ".env에 새 설정 ${key}를 더했어요."; }
done
# Spring 때 값(google/gemini-2.5-flash)은 Gemini 키에 더 열리지 않는다. 비우면 키 종류에 맞는 기본 모델을 쓴다.
[ "$(get AI_MODEL)" != "google/gemini-2.5-flash" ] || put AI_MODEL ""
DB_URL="$(get DATABASE_URL)"; DB_URL="${DB_URL:-jdbc:mariadb://127.0.0.1:3306/otgyeol}"
DB_NAME="$(echo "$DB_URL" | sed -E 's#.*/([^/?]+).*#\1#')"
DB_USER="$(get DATABASE_USERNAME)"; DB_USER="${DB_USER:-otgyeol}"
DB_PASS="$(get DATABASE_PASSWORD)"

say "4/7 DB(${DB_NAME})와 계정(${DB_USER}) 준비"
if [ -z "$DB_PASS" ] || [ "$DB_PASS" = "CHANGE_ME" ]; then
  DB_PASS="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 28)"
  put DATABASE_PASSWORD "$DB_PASS"
  echo "DB 비밀번호를 새로 만들어 .env에 넣었어요(화면에는 출력하지 않음)."
fi
put DATABASE_URL "$DB_URL"
put DATABASE_USERNAME "$DB_USER"
MYSQL="$(command -v mariadb || command -v mysql)"
"$MYSQL" -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
# 트리거를 만들려면 바이너리 로그가 켜진 서버에서 이 설정이 필요하다(꺼져 있으면 영향 없음).
"$MYSQL" -uroot -e "SET GLOBAL log_bin_trust_function_creators = 1" 2>/dev/null || true
chown -R otgyeol:otgyeol "$APP_DIR"

say "5/7 서비스 등록·시작(systemd: ${SERVICE})"
cp otgyeol.service /etc/systemd/system/${SERVICE}.service
systemctl daemon-reload
systemctl enable ${SERVICE} >/dev/null
systemctl restart ${SERVICE}
PORT="$(get PORT)"; PORT="${PORT:-3000}"
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/__health" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS "http://127.0.0.1:${PORT}/__health" >/dev/null || { echo "앱이 뜨지 않았어요. 로그: journalctl -u ${SERVICE} -n 80 --no-pager" >&2; exit 1; }
echo "앱 응답: $(curl -fsS "http://127.0.0.1:${PORT}/__health")"

say "6/7 nginx 연결"
sed -e "s/server_name example.com;/server_name ${DOMAIN:-_};/" -e "s#127.0.0.1:3000#127.0.0.1:${PORT}#" nginx-otgyeol.conf > /etc/nginx/sites-available/otgyeol
ln -sf /etc/nginx/sites-available/otgyeol /etc/nginx/sites-enabled/otgyeol
[ -n "$DOMAIN" ] || rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

say "7/7 HTTPS"
if [ -n "$DOMAIN" ]; then
  command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect \
    || echo "인증서를 받지 못했어요. 도메인의 A 레코드가 이 서버 IP를 가리키는지 확인한 뒤 다시 실행해 주세요."
  URL="https://${DOMAIN}"
else
  echo "도메인 없이 설치했어요. 현재 위치 날씨는 브라우저가 https에서만 위치를 주므로, 공개할 때는 도메인을 붙여 다시 실행하세요."
  URL="http://$(curl -fsS -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
fi

printf '\n\033[1m완료: %s\033[0m\n' "$URL"
echo "상태 확인: curl -s ${URL}/__health"
echo "로그 보기: journalctl -u ${SERVICE} -f"
echo "대시보드 '우리 팀 → 정보 → 배포 URL'에 ${URL} 을 저장하세요."
