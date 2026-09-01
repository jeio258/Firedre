import type { PostListItem } from '../types/posts'

export function normalizePinOrder(value: unknown): number {
  if (value === undefined || value === null || value === '')
    return 0
  if (value === false)
    return 0
  if (value === true)
    return 1
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0)
    return 0
  return Math.floor(n)
}

export function sortPostsByPinOrder(posts: PostListItem[]): PostListItem[] {
  return [...posts].sort((a, b) => {
    const pinA = normalizePinOrder(a.pin_order ?? a.top)
    const pinB = normalizePinOrder(b.pin_order ?? b.top)
    if (pinA !== pinB)
      return pinB - pinA
    return (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)
  })
}
