/** '2026-10-30' 또는 ISO 시각 → '10월 30일'. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
