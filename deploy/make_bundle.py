"""옷결 FTP 배포 묶음 만들기.

    python deploy/make_bundle.py                        # ../deploy_upload/otgyeol 폴더와 zip을 만든다
    python deploy/make_bundle.py --skip-frontend-build  # 화면은 이미 빌드한 frontend/dist를 쓴다

화면(frontend)과 서버(server)를 빌드하고, 운영용 패키지만 설치한 app 폴더와 설치 스크립트를 한데 모은다.
쓰는 패키지가 모두 순수 JS라 Windows에서 만든 묶음을 리눅스 서버에 그대로 올려 쓸 수 있다.
키가 든 env는 저장소에 두지 않는다: 이미 묶음 폴더에 env가 있으면 그대로 쓰고, 없으면 deploy/env.example을 복사한다.
"""
import os
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEPLOY = REPO / 'deploy'
OUT_ROOT = REPO.parent / 'deploy_upload'
OUT = OUT_ROOT / 'otgyeol'
NPM = 'npm.cmd' if os.name == 'nt' else 'npm'


def run(cmd, cwd):
    print(f'$ {" ".join(cmd)}  ({cwd.name})', flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def git(*args):
    return subprocess.run(['git', *args], cwd=REPO, capture_output=True, text=True).stdout.strip()


def main():
    # 1) 빌드
    parts = ('server',) if '--skip-frontend-build' in sys.argv else ('frontend', 'server')
    for part in parts:
        d = REPO / part
        if not (d / 'node_modules').exists():
            run([NPM, 'ci', '--no-audit', '--no-fund'], d)
        run([NPM, 'run', 'build'], d)

    # 2) 기존 묶음 정리(env는 지키고, 예전 jar 묶음은 백업). 폴더가 탐색기 등에 열려 있어도 되게 폴더는 두고 안만 비운다.
    OUT_ROOT.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
    kept_env = None
    backups = sorted(OUT_ROOT.glob('otgyeol-jar-backup-*'))
    for src in [OUT, *backups[-1:]]:
        for name in ('env', 'env.example'):
            if kept_env is None and (src / name).exists():
                kept_env = (src / name).read_text(encoding='utf-8')
    if (OUT / 'app.jar').exists():
        backup = OUT_ROOT / f'otgyeol-jar-backup-{time.strftime("%m%d-%H%M")}'
        backup.mkdir()
        for child in list(OUT.iterdir()):
            shutil.move(str(child), str(backup / child.name))
        print(f'예전 jar 묶음은 {backup.name}로 옮겨 둠')
    for child in list(OUT.iterdir()):
        shutil.rmtree(child) if child.is_dir() else child.unlink()

    # 3) app = 서버 빌드 + 마이그레이션 + 화면 + 운영용 패키지
    app = OUT / 'app'
    app.mkdir()
    shutil.copytree(REPO / 'server' / 'dist', app / 'dist')
    shutil.copytree(REPO / 'server' / 'db', app / 'db')
    shutil.copytree(REPO / 'frontend' / 'dist', app / 'public')
    for f in ('package.json', 'package-lock.json'):
        shutil.copy2(REPO / 'server' / f, app / f)
    run([NPM, 'ci', '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts'], app)

    # 4) 설치 스크립트·설정
    for f in ('install.sh', 'start.sh', 'otgyeol.service', 'nginx-otgyeol.conf', 'README.txt'):
        data = (DEPLOY / f).read_bytes().replace(b'\r\n', b'\n')  # 리눅스에서 돌 파일은 LF로
        (OUT / f).write_bytes(data)
    env = kept_env if kept_env is not None else (DEPLOY / 'env.example').read_text(encoding='utf-8')
    lines = []
    for line in env.replace('\r\n', '\n').split('\n'):
        if line.startswith('JAVA_OPTS='):
            continue  # Spring 때 설정
        if line.startswith('AI_MODEL=google/gemini-2.5-flash'):
            line = 'AI_MODEL='  # 키 종류에 맞는 기본 모델을 쓰게 비운다(Gemini 키에는 2.5가 더 열리지 않음)
        lines.append(line)
    (OUT / 'env').write_bytes('\n'.join(lines).encode('utf-8'))

    # 저장소 밖에서 꺼낸 사본으로 만들 때는 RELEASE_SHA로 commit을 넘긴다.
    sha = os.environ.get('RELEASE_SHA') or git('rev-parse', 'HEAD')
    dirty = not os.environ.get('RELEASE_SHA') and bool(git('status', '--porcelain'))
    release = sha + ('-local' if dirty else '')
    (OUT / 'RELEASE_ID').write_text(release, encoding='utf-8')

    # 5) zip(.sh는 실행 권한을 붙여 둔다)
    zpath = OUT_ROOT / f'otgyeol-deploy-{sha[:7]}{"-local" if dirty else ""}.zip'
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in sorted(OUT.rglob('*')):
            if p.is_dir():
                continue
            arc = Path('otgyeol') / p.relative_to(OUT)
            info = zipfile.ZipInfo(arc.as_posix(), time.localtime(p.stat().st_mtime)[:6])
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o755 if p.suffix == '.sh' else 0o644) << 16
            z.writestr(info, p.read_bytes())
    size = zpath.stat().st_size / 1024 / 1024
    print(f'\n묶음: {OUT}\nzip:  {zpath} ({size:.1f}MB)\nRELEASE_ID: {release}')


if __name__ == '__main__':
    sys.exit(main())
