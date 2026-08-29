import type { NavDrawVideo } from '../types/navigation'

export function parseNavDrawVideos(input: unknown): NavDrawVideo[] {
  if (!Array.isArray(input))
    return []

  const result: NavDrawVideo[] = []

  for (const item of input) {
    if (typeof item === 'string' && item.length > 0) {
      result.push({ url: item, weight: 1 })
      continue
    }

    if (!item || typeof item !== 'object')
      continue

    const record = item as { url?: unknown, weight?: unknown }
    if (typeof record.url !== 'string' || !record.url.length)
      continue

    const weight = typeof record.weight === 'number' && record.weight > 0
      ? record.weight
      : 1

    result.push({ url: record.url, weight })
  }

  return result
}
