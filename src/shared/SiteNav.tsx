/**
 * Header links across the site's three pages.
 *
 * Plain multi-page links, not a router: each page is its own Vite entry
 * (`index.html`, `Recipes/index.html`, `p3-loot-prio/index.html`), so no
 * page's bundle ships another page's code.
 *
 * Hrefs are relative *per page* because `vite.config.ts` sets `base: './'` —
 * the site has to work both at a domain root and under a GitHub Pages
 * subpath (`/<repo>/`), so nothing may start with a leading `/`. `Recipes/`
 * and `p3-loot-prio/` are siblings one level below the site root, so each
 * reaches the other via `../<sibling>/`, and both reach home via `../`.
 */
const HREFS = {
  recipes: { home: '../', recipes: './', loot: '../p3-loot-prio/' },
  loot: { home: '../', recipes: '../Recipes/', loot: './' },
} as const

export type SitePage = keyof typeof HREFS

export function SiteNav({ current }: { current: SitePage }) {
  const hrefs = HREFS[current]

  return (
    <nav className="site-nav" aria-label="Sections">
      <a href={hrefs.home}>ATB Home</a>
      <a href={hrefs.recipes} aria-current={current === 'recipes' ? 'page' : undefined}>
        Recipe Registry
      </a>
      <a href={hrefs.loot} aria-current={current === 'loot' ? 'page' : undefined}>
        P3 Loot Prio
      </a>
    </nav>
  )
}
