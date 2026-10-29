// 받침 유무에 따라 조사를 붙인다. 한글이 아닌 글자로 끝나면 '을(를)' 처럼 둘 다 적는다.
function jong(word: string): number | null {
  const c = word.trim().slice(-1).charCodeAt(0);
  if (c < 0xac00 || c > 0xd7a3) return null;
  return (c - 0xac00) % 28;
}
export const eul = (w: string) => w + (jong(w) === null ? '을(를)' : jong(w) ? '을' : '를');
export const iga = (w: string) => w + (jong(w) === null ? '이(가)' : jong(w) ? '이' : '가');
