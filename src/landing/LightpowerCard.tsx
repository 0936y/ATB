const ARMORY_URL = 'https://classic-armory.org/character/eu/tbc-anniversary/spineshatter/Lightpower'

export function LightpowerCard() {
  return (
    <>
      <a className="wcl-card" href={ARMORY_URL} target="_blank" rel="noreferrer">
        <div className="wcl-card__top">
          <div className="wcl-card__identity">
            <div className="wcl-card__name">LIGHTPOWER</div>
            <div className="wcl-card__spec">Protection Paladin</div>
          </div>
          <div className="wcl-badge">
            <span className="wcl-badge__letter">S</span>
            <span className="wcl-badge__score">100/100</span>
          </div>
        </div>
        <div className="wcl-card__stats">
          <div className="wcl-card__stat">
            <div className="wcl-card__stat-label">Encounter</div>
            <div className="wcl-card__stat-value">Void Reaver</div>
            <div className="wcl-card__stat-sub">Tempest Keep</div>
          </div>
          <div className="wcl-card__stat">
            <div className="wcl-card__stat-label">DPS</div>
            <div className="wcl-card__stat-value">691</div>
            <div className="wcl-card__stat-sub">691 personal · 0 pet</div>
          </div>
          <div className="wcl-card__stat">
            <div className="wcl-card__stat-label">Duration</div>
            <div className="wcl-card__stat-value">2:26</div>
          </div>
        </div>
      </a>

      <a className="wcl-verdict" href={ARMORY_URL} target="_blank" rel="noreferrer">
        <div className="wcl-badge wcl-badge--verdict">
          <span className="wcl-badge__letter">S</span>
          <span className="wcl-badge__score">100/100</span>
        </div>
        <div className="wcl-verdict__body">
          <div className="wcl-verdict__label">Verdict</div>
          <h3 className="wcl-verdict__headline">
            Outstanding protection paladin play - near-flawless tanking.
          </h3>
          <p>Nothing to call out - you nailed it. Keep doing what you're doing.</p>
          <p>You spent almost no time taking melee hits this fight, so Holy Shield wasn't graded.</p>
        </div>
      </a>
    </>
  )
}
