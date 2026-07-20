import { useState } from 'react'
import type { CrafterProfession } from '../types'
import { mergeChunks, parseExport } from '../parser'

/**
 * Paste-in import. Lets a guild member preview their export immediately, then
 * download it as a file to commit into `data/exports/` for everyone else.
 */
export function ImportPanel({ onImport }: { onImport: (entries: CrafterProfession[]) => void }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [pending, setPending] = useState<CrafterProfession[]>([])

  function handleParse() {
    const chunks = parseExport(text)
    if (chunks.length === 0) {
      setStatus('No valid `!profession import` payload found in that text.')
      setPending([])
      return
    }

    const merged = mergeChunks(chunks)
    const warnings = chunks.reduce((n, c) => n + c.warnings.length, 0)
    const recipes = merged.reduce((n, e) => n + e.recipes.length, 0)

    setPending(merged)
    setStatus(
      `Parsed ${chunks.length} chunk(s) → ${merged.length} crafter/profession, ${recipes} recipes` +
        (warnings > 0 ? ` (${warnings} unreadable line(s) skipped)` : ''),
    )
  }

  function handleAdd() {
    onImport(pending)
    setStatus(`Added ${pending.length} entry(s) to this session.`)
    setPending([])
    setText('')
  }

  function handleDownload() {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const first = pending[0]
    link.href = url
    link.download = first
      ? `${first.crafter.toLowerCase()}-${first.profession.toLowerCase()}.txt`
      : 'export.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <details className="import">
      <summary>Import an export</summary>
      <p className="hint">
        Paste the <code>!profession import …</code> lines from the Profession Bot Exporter addon.
        Multiple chunks at once are fine.
      </p>
      <textarea
        aria-label="Export text"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="!profession import U2xhdm9uZ2lnYXxFbmNoYW50aW5nfAo…"
      />
      <div className="import-actions">
        <button onClick={handleParse} disabled={!text.trim()}>
          Parse
        </button>
        <button onClick={handleAdd} disabled={pending.length === 0}>
          Add to session
        </button>
        <button onClick={handleDownload} disabled={pending.length === 0}>
          Download for commit
        </button>
      </div>
      {status && <p className="status">{status}</p>}
    </details>
  )
}
