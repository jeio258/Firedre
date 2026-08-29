import { constantTimeEqual } from "../server/utils/timingSafe";

export interface AlbumAccessParams {
  encrypted?: boolean
  password?: string
  accessPassword?: string
}

export function verifyAlbumAccess(params: AlbumAccessParams) {
  if (!params.encrypted)
    return true

  const expected = String(params.password ?? '').trim()
  if (!expected)
    return false

  return constantTimeEqual(String(params.accessPassword ?? ''), expected)
}

export function verifyAlbumPassword(input: string, configured?: string) {
  if (!configured)
    return false
  return constantTimeEqual(input, configured)
}

export function parseAlbumAccessQuery(input: {
  encrypted?: boolean | string
  albumPassword?: string
  accessPassword?: string
}): AlbumAccessParams {
  const encrypted = input.encrypted === true || input.encrypted === 'true'
  return {
    encrypted,
    password: input.albumPassword,
    accessPassword: input.accessPassword,
  }
}

export function toAlbumAccessParams(
  album?: { encrypted?: boolean, password?: string },
  accessPassword?: string,
): AlbumAccessParams {
  return {
    encrypted: !!album?.encrypted,
    password: album?.password,
    accessPassword,
  }
}
