import { useEffect, useState } from 'react'

// 2026-08-28 01:00 local time — the Void Reaver S-rank pull this card celebrates.
const START = new Date(2026, 7, 28, 1, 0, 0).getTime()

function elapsedParts(now: number) {
  const totalSeconds = Math.floor(Math.max(0, now - START) / 1000)
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function LightpowerCountdown() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { days, hours, minutes, seconds } = elapsedParts(now)

  return (
    <div className="lp-countdown">
      <p className="lp-countdown__caption">Lightpower вже сильний:</p>
      <div className="lp-countdown__grid">
        <div>
          <span className="lp-countdown__value">{days}</span>
          <span className="lp-countdown__unit">днів</span>
        </div>
        <div>
          <span className="lp-countdown__value">{pad(hours)}</span>
          <span className="lp-countdown__unit">год</span>
        </div>
        <div>
          <span className="lp-countdown__value">{pad(minutes)}</span>
          <span className="lp-countdown__unit">хв</span>
        </div>
        <div>
          <span className="lp-countdown__value">{pad(seconds)}</span>
          <span className="lp-countdown__unit">сек</span>
        </div>
      </div>
    </div>
  )
}
