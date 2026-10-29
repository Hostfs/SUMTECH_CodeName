옷결 배포 묶음 (Node.js + MariaDB + nginx)

[처음 설치]
1. 이 폴더 전체(또는 zip)를 FTP로 서버에 올린다. (zip이면 서버에서 unzip)
2. SSH로 서버에 접속해 그 폴더로 이동한다.
3. 한 줄 실행:
     sudo bash install.sh 도메인        예) sudo bash install.sh otgyeol.example.com
   도메인이 아직 없으면 도메인 없이:  sudo bash install.sh
4. 끝에 나오는 주소(https://도메인)를 대시보드 '우리 팀 → 정보 → 배포 URL'에 저장한다.

install.sh가 하는 일: Node.js 22·MariaDB·nginx 설치(없을 때만) → /opt/otgyeol로 복사 →
.env 준비(env의 AI·기상청 키 사용, DB 비밀번호 자동 생성) → DB·계정 생성 → systemd 서비스 등록·시작 →
nginx 연결 → 도메인이 있으면 HTTPS 인증서 → /__health 확인.
DB 표(테이블·트리거)는 앱이 시작하며 스스로 만든다(마이그레이션 V1, V2 …).

[업데이트]
새 묶음을 같은 방식으로 올리고 같은 명령을 다시 실행한다:  sudo bash install.sh 도메인
.env와 DB 자료는 그대로 남는다. 새 묶음에 새로 생긴 설정(예: GUEST_MODE)은 .env에 없을 때만 묶음 값으로 더해진다.

[게스트 체험(발표·QR용)]
GUEST_MODE=on이면 첫 화면·로그인 화면에 '게스트로 체험하기'가 생기고, 누를 때마다 데모 옷장이 든 새 계정으로 들어간다.
켜기·끄기: sudo nano /opt/otgyeol/.env 에서 GUEST_MODE=on 또는 off로 고친 뒤  sudo systemctl restart otgyeol

[자주 쓰는 명령]
상태:   systemctl status otgyeol
로그:   journalctl -u otgyeol -f
재시작: sudo systemctl restart otgyeol
설정:   sudo nano /opt/otgyeol/.env  (고친 뒤 재시작)

필요한 것: Ubuntu 22.04/24.04, (공개 주소용) 도메인의 A 레코드가 이 서버 IP를 가리킬 것, 80·443 포트 열림.
현재 위치 날씨는 브라우저가 https에서만 위치를 주므로 공개할 때는 도메인을 붙인다.
