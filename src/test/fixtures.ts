/** Helper to build a real addon payload without hand-encoding base64 in tests. */
export function encodeChunk(crafter: string, profession: string, lines: string[]): string {
  const text = [`${crafter}|${profession}|`, ...lines].join('\n')
  const bytes = new TextEncoder().encode(text)
  return btoa(String.fromCharCode(...bytes))
}

export function importLine(crafter: string, profession: string, lines: string[]): string {
  return `!profession import ${encodeChunk(crafter, profession, lines)}`
}

/** The first chunk of the real Slavongiga Enchanting export, verbatim. */
export const REAL_ENCHANTING_CHUNK_1 =
  '!profession import U2xhdm9uZ2lnYXxFbmNoYW50aW5nfApFbmNoYW50IFdlYXBvbiAtIFN1bmZpcmUjMjc5ODEKRW5jaGFudCBHbG92ZXMgLSBNYWpvciBTcGVsbHBvd2VyIzMzOTk3CkVuY2hhbnQgR2xvdmVzIC0gU3BlbGwgU3RyaWtlIzMzOTk0'

/** Real Jewelcrafting chunk — header carries a non-ASCII crafter name (Slavongîga). */
export const REAL_JEWELCRAFTING_CHUNK =
  '!profession import U2xhdm9uZ8OuZ2F8SmV3ZWxjcmFmdGluZ3wKQnJpbGxpYW50IEdsYXNzIzM1OTQ1CkRlbnNlIFN0b25lIFN0YXR1ZSMyNTg4Mw=='
