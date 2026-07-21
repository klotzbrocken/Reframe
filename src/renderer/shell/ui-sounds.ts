/*
 * Synthesised period UI sounds (Web Audio), the way old operating systems
 * chirped at every action. Nothing sampled — everything is generated on the
 * fly, so there are no trademarked assets to ship (same approach as the modem
 * synth). A theme can still override any event with its own wav via
 * manifest.sounds; this is the baseline every theme gets for free.
 *
 * Two flavours: `win` is brighter/squarer (PC beeps), `mac` is softer/rounder.
 */
export type UiSoundEvent = 'click' | 'error' | 'open' | 'close' | 'notify'
export type UiSoundEra = 'win' | 'mac'

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** One tone with a fast attack/decay envelope, optionally gliding in pitch. */
function tone(
  c: AudioContext,
  master: GainNode,
  o: { type: OscillatorType; from: number; to?: number; dur: number; gain: number; at: number }
): void {
  const t0 = c.currentTime + o.at
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = o.type
  osc.frequency.setValueAtTime(o.from, t0)
  if (o.to != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + o.dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  osc.connect(g).connect(master)
  osc.start(t0)
  osc.stop(t0 + o.dur + 0.02)
}

/**
 * Play a short UI sound. `volume` is 0–1 (already user-scaled). Best-effort:
 * silently does nothing if Web Audio is unavailable or blocked.
 */
export function playUiSound(event: UiSoundEvent, era: UiSoundEra, volume = 0.3): void {
  const c = audio()
  if (!c || volume <= 0) return
  const master = c.createGain()
  master.gain.value = Math.min(1, volume)
  master.connect(c.destination)
  const mac = era === 'mac'
  const wave: OscillatorType = mac ? 'sine' : 'square'

  switch (event) {
    case 'click':
      // A tiny tick, as when following a link.
      tone(c, master, { type: wave, from: mac ? 1200 : 1700, to: mac ? 900 : 1100, dur: 0.035, gain: 0.5, at: 0 })
      break
    case 'open':
      // Rising two-step — a window appears.
      tone(c, master, { type: wave, from: 520, to: 680, dur: 0.07, gain: 0.5, at: 0 })
      tone(c, master, { type: wave, from: 700, to: 920, dur: 0.09, gain: 0.5, at: 0.07 })
      break
    case 'close':
      // Falling — a window goes away.
      tone(c, master, { type: wave, from: 760, to: 380, dur: 0.11, gain: 0.5, at: 0 })
      break
    case 'error':
      // The classic scolding two-tone.
      tone(c, master, { type: mac ? 'triangle' : 'square', from: mac ? 300 : 440, dur: 0.14, gain: 0.6, at: 0 })
      tone(c, master, { type: mac ? 'triangle' : 'square', from: mac ? 220 : 330, dur: 0.2, gain: 0.6, at: 0.15 })
      break
    case 'notify':
      // A pleasant rising chime — mail / done.
      tone(c, master, { type: mac ? 'sine' : 'triangle', from: 660, dur: 0.14, gain: 0.5, at: 0 })
      tone(c, master, { type: mac ? 'sine' : 'triangle', from: 990, dur: 0.28, gain: 0.5, at: 0.13 })
      break
  }
}
