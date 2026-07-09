import type { ReactNode } from 'react'

interface Props {
  title: string
  maximized: boolean
  /** Override the close button (e.g. quit vs minimize per settings). */
  onClose?: () => void
  /** Optional extra control on the right of the title bar (Camino's toolbar pill). */
  rightExtra?: ReactNode
}

/**
 * The window title bar. The window is frameless, so this is where window
 * controls live. It's draggable via -webkit-app-region (set in theme CSS).
 * Themes style .ow-titlebar however they like — the IE5 theme renders a Win98
 * navy gradient bar with raised control buttons.
 */
export function TitleBar({ title, maximized, onClose, rightExtra }: Props) {
  return (
    <div className="ow-titlebar">
      <span className="ow-titlebar__icon" aria-hidden />
      <span className="ow-titlebar__text">{title}</span>
      {rightExtra}
      <div className="ow-titlebar__controls">
        <button
          className="ow-winbtn"
          data-control="minimize"
          title="Minimize"
          onClick={() => window.oldweb.minimizeWindow()}
        />
        <button
          className="ow-winbtn"
          data-control={maximized ? 'restore' : 'maximize'}
          title={maximized ? 'Restore' : 'Maximize'}
          onClick={() => window.oldweb.toggleMaximizeWindow()}
        />
        <button
          className="ow-winbtn"
          data-control="close"
          title="Close"
          onClick={() => (onClose ? onClose() : window.oldweb.closeWindow())}
        />
      </div>
    </div>
  )
}
