/**
 * Decoding for the Profession Bot Exporter addon's `!profession import <base64>`
 * payloads.
 *
 * The addon splits long lists across several chat messages, so a pasted blob may
 * contain many chunks. Each chunk repeats the `Crafter|Profession|` header.
 */

const IMPORT_PREFIX = /!profession\s+import\s+/i

/** Base64 alphabet run, long enough that stray words never match. */
const BASE64_RUN = /[A-Za-z0-9+/]{16,}={0,2}/g

/**
 * Pull every base64 payload out of a pasted blob.
 *
 * Handles text with or without the `!profession import` prefix, and blobs
 * containing several chunks separated by blank lines or prose.
 */
export function extractPayloads(input: string): string[] {
  const withPrefix = input.split(IMPORT_PREFIX).slice(1)
  const source = withPrefix.length > 0 ? withPrefix : [input]

  const payloads: string[] = []
  for (const segment of source) {
    // Whitespace inside a payload is line-wrapping from the chat client, not a
    // separator — but only when the prefix told us where the payload starts.
    const candidate = withPrefix.length > 0 ? segment.trim().split(/\s{2,}|\n\s*\n/)[0] : segment
    for (const match of candidate.matchAll(BASE64_RUN)) {
      payloads.push(match[0])
    }
  }
  return payloads
}

/**
 * Decode one base64 payload to UTF-8 text.
 *
 * The addon emits unpadded base64, so we re-pad before decoding. Returns null
 * rather than throwing when the payload is not valid base64.
 */
export function decodePayload(payload: string): string | null {
  const cleaned = payload.replace(/\s+/g, '')
  if (cleaned.length === 0) return null

  const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4)

  try {
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}
