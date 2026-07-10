// The Modem extension's status-bar widget. Sits at the right of <StatusBar>,
// next to the security zone. Purely presentational: it reflects `phase` on a
// data attribute and lets the LEDs animate via CSS (see .ow-modem in base.css).
// Clicking it dials up when offline, or hangs up when connected.

export type ModemPhase =
  | 'off' // extension disabled
  | 'offline' // enabled, no carrier yet (CD red)
  | 'dialing' // dial tone + touch-tone dialing (CD red blink, TX blink)
  | 'ring' // ringing (CD red blink)
  | 'handshake' // carrier negotiation (CD red blink, TX+RX blink)
  | 'loading' // connected, page streaming in (CD green, RX/TX blink)
  | 'online' // connected, idle (PWR + CD green)

export type ModemWidgetSpeed = '28.8k' | '56k' | 'isdn' | 'full'

interface Props {
  active: boolean
  phase: ModemPhase
  speed: ModemWidgetSpeed
  variant?: 'slim' | 'sportster' | 'compact'
  onToggle: () => void
}

const SPEED_LABEL: Record<ModemWidgetSpeed, string> = {
  '28.8k': '28.8',
  '56k': '56K',
  isdn: 'ISDN',
  full: 'onl'
}

export function ModemStatus({ active, phase, speed, variant = 'slim', onToggle }: Props) {
  const showBadge = variant === 'sportster'
  const leds: Array<'pwr' | 'cd' | 'tx' | 'rx'> =
    variant === 'compact' ? ['cd', 'tx', 'rx'] : ['pwr', 'cd', 'tx', 'rx']

  return (
    <button
      type="button"
      className={'ow-modem ow-modem--' + variant + (active ? ' is-on' : '')}
      data-phase={active ? phase : 'off'}
      title={active ? 'Modem-Emulation aktiv — klicken zum Ein-/Auswählen' : 'Modem-Emulation aus'}
      aria-pressed={active}
      onClick={onToggle}
    >
      {variant === 'slim' && <span className="ow-modem__icon" aria-hidden />}
      <span className="ow-modem__leds">
        {leds.map((k) => (
          <i key={k} className={'ow-modem__led ow-modem__led--' + k}>
            {variant === 'sportster' && <em>{k.toUpperCase()}</em>}
          </i>
        ))}
      </span>
      {variant === 'slim' && <span className="ow-modem__speed">{SPEED_LABEL[speed]}</span>}
      {showBadge && <span className="ow-modem__badge">{speed === 'full' ? '' : '56K'}</span>}
    </button>
  )
}
