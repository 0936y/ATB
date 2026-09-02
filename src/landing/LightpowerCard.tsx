const ARMORY_URL = 'https://classic-armory.org/character/eu/tbc-anniversary/spineshatter/Lightpower'

export function LightpowerCard() {
  return (
    <>
      <a className="wcl-card wcl-card--image" href={ARMORY_URL} target="_blank" rel="noreferrer">
        <img src="./lightpower_atb.png" alt="Lightpower — Void Reaver ATB report" className="wcl-card__image" />
      </a>
    </>
  )
}
