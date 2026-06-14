interface Props {
  action: string
  label: string
  disabled?: boolean
  onClick: () => void
}

/** A toolbar button. The theme decides the icon (via [data-action]) and chrome. */
export function NavButton({ action, label, disabled, onClick }: Props) {
  return (
    <button
      className="ow-btn"
      data-action={action}
      disabled={disabled}
      onClick={onClick}
      title={label}
    >
      <span className="ow-btn__icon" aria-hidden />
      <span className="ow-btn__label">{label}</span>
    </button>
  )
}
