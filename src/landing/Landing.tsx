/**
 * The site root. ATB hosts more than one guild tool now, so this page is just
 * a dispatcher — two big links to the actual services, each its own Vite
 * entry (`Recipes/index.html`, `p3-loot-prio/index.html`). No SiteNav here:
 * these two links already are the site's whole navigation.
 */
export function Landing() {
  return (
    <main className="landing">
      <header>
        <h1>ATB — Spineshatter Guild</h1>
        <p className="stats">Pick a tool.</p>
      </header>

      <div className="landing-links">
        <a href="./Recipes/">
          <span className="title">Recipe Registry</span>
          <span className="desc">Who in the guild can craft it?</span>
        </a>
        <a href="./p3-loot-prio/">
          <span className="title">P3 Loot Prio</span>
          <span className="desc">Black Temple, Mount Hyjal &amp; crafted gear priority.</span>
        </a>
      </div>
    </main>
  )
}
