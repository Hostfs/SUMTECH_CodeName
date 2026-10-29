// 프로필 사진이 없을 때 쓰는 기본 일러스트. 사진을 올리면 <img> 로 바꿔 끼운다.
export function Portrait() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id="portrait-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3E1CF" />
          <stop offset="1" stopColor="#D9C2AE" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" fill="url(#portrait-bg)" />
      <path d="M6 50c1.5-10 8.5-15 18-15s16.5 5 18 15Z" fill="#3E4A5E" />
      <path d="M20 30h8v6c0 2-8 2-8 0Z" fill="#E8B48F" />
      <ellipse cx="24" cy="21" rx="8.6" ry="9.8" fill="#F2C6A2" />
      <path d="M15 20c-.6-7 3.6-11 9.4-11 5.6 0 9.6 3.6 8.8 10.6-1.2-3.4-4.4-4.8-9-4.8-4.2 0-7.6 1.6-9.2 5.2Z" fill="#2A211E" />
      <circle cx="20.6" cy="22" r="1" fill="#2A211E" />
      <circle cx="27.4" cy="22" r="1" fill="#2A211E" />
      <path d="M21.5 26.4c1.4 1 3.6 1 5 0" stroke="#B9785A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
