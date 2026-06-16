import { useEffect, useState } from 'react'

const fmt = (d: Date): string => {
  let h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h.toString().padStart(2, '0')}:${m} ${ampm}`
}

/** Live toolbar clock (Opera 3.x), `hh:mm AM/PM`, ticking each 10s. */
export function Clock() {
  const [now, setNow] = useState(() => fmt(new Date()))
  useEffect(() => {
    const id = setInterval(() => setNow(fmt(new Date())), 10000)
    return () => clearInterval(id)
  }, [])
  return <span className="ow-clock">{now}</span>
}
