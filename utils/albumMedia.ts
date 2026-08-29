import type { AlbumMediaType, AlbumPhoto } from '../types/album'

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|heic|heif|ico)$/i
const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi|m4v|ogv|wmv)$/i

export function detectMediaTypeFromUrl(url: string): AlbumMediaType | null {
  const clean = url.split('?')[0].split('#')[0]
  if (VIDEO_EXT.test(clean))
    return 'video'
  if (IMAGE_EXT.test(clean))
    return 'image'
  return null
}

export function detectMediaTypeFromMime(mime?: string): AlbumMediaType | null {
  if (!mime)
    return null
  if (mime.startsWith('video/'))
    return 'video'
  if (mime.startsWith('image/'))
    return 'image'
  return null
}

export function resolveAlbumMediaType(item: AlbumPhoto): AlbumMediaType {
  if (item.type === 'image' || item.type === 'video')
    return item.type
  return detectMediaTypeFromUrl(item.url) || 'image'
}

export function isAlbumVideo(item: AlbumPhoto) {
  return resolveAlbumMediaType(item) === 'video'
}

export function isSupportedAlbumMediaUrl(url: string) {
  return !!detectMediaTypeFromUrl(url)
}
