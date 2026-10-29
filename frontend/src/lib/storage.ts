// localStorage 는 사생활 보호 모드 등에서 막힐 수 있어 모든 접근을 감싼다.
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 실패는 무시: 화면은 메모리 상태로 계속 동작 */
  }
}

/** 개발 확인용 주소 옵션: `/?season=winter&wx=snow-night#/` */
export const query = new URLSearchParams(window.location.search);
