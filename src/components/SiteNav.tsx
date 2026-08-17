/**
 * Header links between the site's two pages.
 *
 * These are plain multi-page links, not a router: each page is its own Vite
 * entry (`index.html` and `p3-loot-prio/index.html`), so the loot table never
 * ships in the recipe page's bundle or vice versa.
 *
 * Hrefs are relative *per page* because `vite.config.ts` sets `base: './'` — the
 * site has to work both at a domain root and under a GitHub Pages subpath
 * (`/<repo>/`), so nothing may start with a leading `/`. From the loot page,
 * "up one level" is the recipe page; from the recipe page, the loot page is a
 * subdirectory.
 */
const HREFS = {
  recipes: { recipes: './', loot: './p3-loot-prio/' },
  loot: { recipes: '../', loot: './' },
} as const

export type SitePage = keyof typeof HREFS

export function SiteNav({ current }: { current: SitePage }) {
  const hrefs = HREFS[current]

  return (
    <nav className="site-nav" aria-label="Sections">
      <a href={hrefs.recipes} aria-current={current === 'recipes' ? 'page' : undefined}>
        Recipe Registry
      </a>
      <a href={hrefs.loot} aria-current={current === 'loot' ? 'page' : undefined}>
        P3 Loot Prio
      </a>
    </nav>
  )
}
