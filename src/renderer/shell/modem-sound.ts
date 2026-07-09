// Portable Web-Audio dial-up handshake for the Reframe "Modem" extension.
// No assets required — the whole sequence (dial tone → touch-tone dialing →
// ringing → carrier handshake → connect) is synthesized. If a real recording
// is preferred, pass { sampleUrl } and that file is played instead.
//
// Returns { stop, duration }. `duration` (seconds) is the scheduled length of
// the synth sequence; use it to time the phase transitions (see App.tsx wiring).

export type ModemSpeed = '28.8k' | '56k' | 'isdn'

const TL: Record<ModemSpeed, { dialtone: number; dtmf: number; ring: number; handshake: number }> = {
  '28.8k': { dialtone: 0.8, dtmf: 1.0, ring: 2.0, handshake: 4.6 },
  '56k': { dialtone: 0.8, dtmf: 1.0, ring: 1.8, handshake: 3.4 },
  isdn: { dialtone: 0.6, dtmf: 0.9, ring: 1.2, handshake: 1.5 }
}

const DTMF: Record<string, number[]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '0': [941, 1336]
}

export interface DialupHandle {
  stop: () => void
  duration: number
}

/** Phase boundaries (seconds from start) for driving the LED/UI state machine:
 *  dialing → ring at `ring`, → handshake at `handshake`, → online at `duration`. */
export function dialupTimings(speed: ModemSpeed): {
  ring: number
  handshake: number
  duration: number
} {
  const T = TL[speed]
  return {
    ring: T.dialtone + T.dtmf,
    handshake: T.dialtone + T.dtmf + T.ring,
    duration: T.dialtone + T.dtmf + T.ring + T.handshake + 1
  }
}

export function playDialup(
  speed: ModemSpeed,
  opts: { volume?: number; sampleUrl?: string; phone?: string } = {}
): DialupHandle {
  const T = TL[speed]
  const duration = T.dialtone + T.dtmf + T.ring + T.handshake + 1

  // --- real-recording branch ---------------------------------------------
  if (opts.sampleUrl) {
    const el = new Audio(opts.sampleUrl)
    el.volume = opts.volume ?? 0.7
    void el.play().catch(() => {})
    return { stop: () => el.pause(), duration }
  }

  // --- synthesized branch -------------------------------------------------
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AC()
  const master = ctx.createGain()
  master.gain.value = (opts.volume ?? 0.7) * 0.5
  master.connect(ctx.destination)
  const nodes: AudioScheduledSourceNode[] = []

  const tone = (freqs: number[], start: number, dur: number, g: number): void => {
    freqs.forEach((f) => {
      const o = ctx.createOscillator()
      const ga = ctx.createGain()
      o.frequency.value = f
      ga.gain.setValueAtTime(1e-4, start)
      ga.gain.linearRampToValueAtTime(g, start + 0.012)
      ga.gain.setValueAtTime(g, start + Math.max(0.02, dur - 0.02))
      ga.gain.linearRampToValueAtTime(1e-4, start + dur)
      o.connect(ga).connect(master)
      o.start(start)
      o.stop(start + dur + 0.03)
      nodes.push(o)
    })
  }

  // reusable white-noise buffer for the carrier "shhh"
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const nd = nb.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  const noise = (start: number, dur: number, f0: number, f1: number, q: number, g: number): void => {
    const src = ctx.createBufferSource()
    src.buffer = nb
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = q
    bp.frequency.setValueAtTime(f0, start)
    bp.frequency.linearRampToValueAtTime(f1, start + dur)
    const ga = ctx.createGain()
    ga.gain.setValueAtTime(1e-4, start)
    ga.gain.linearRampToValueAtTime(g, start + 0.04)
    ga.gain.setValueAtTime(g, start + Math.max(0.05, dur - 0.05))
    ga.gain.linearRampToValueAtTime(1e-4, start + dur)
    src.connect(bp).connect(ga).connect(master)
    src.start(start)
    src.stop(start + dur + 0.03)
    nodes.push(src)
  }

  let t = ctx.currentTime + 0.06
  tone([350, 440], t, T.dialtone, 0.13) // dial tone
  t += T.dialtone + 0.06

  const num = opts.phone ?? '5551234' // touch-tone dialing
  const per = T.dtmf / num.length
  for (const d of num) {
    if (DTMF[d]) tone(DTMF[d], t, per * 0.6, 0.17)
    t += per
  }
  t += 0.05

  const on = Math.min(0.85, (T.ring / 2) * 0.7) // ringing (2 bursts)
  const gap = Math.max(0.12, (T.ring - 2 * on) / 2)
  for (let i = 0; i < 2; i++) {
    tone([440, 480], t, on, 0.12)
    t += on + gap
  }

  const hEnd = t + T.handshake // carrier handshake
  tone([2100], t, 0.45, 0.15) // answer tone
  t += 0.45
  tone([1650], t, 0.18, 0.11)
  tone([1850], t + 0.18, 0.18, 0.11)
  t += 0.42
  for (let i = 0; t < hEnd - 0.05; i++) {
    // scrambled carrier
    const dur = Math.min(0.42, hEnd - t)
    if (dur <= 0.03) break
    const up = i % 2 === 0
    noise(t, dur, up ? 700 : 2500, up ? 2500 : 700, 1.1, 0.085)
    if (i % 2 === 0) tone([i % 3 ? 1200 : 1800], t, dur * 0.8, 0.045)
    t += dur
  }
  noise(hEnd, 0.5, 1900, 1900, 0.7, 0.11) // lock / connect

  return {
    stop: () => {
      nodes.forEach((n) => {
        try {
          n.stop()
        } catch {
          /* already stopped */
        }
      })
      void ctx.close()
    },
    duration
  }
}
