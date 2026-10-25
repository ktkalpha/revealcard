import React, { useEffect, useRef, useState } from 'react'

// A small dropdown: the trigger toggles a panel that closes on outside click,
// Escape, or after an item is chosen. Items are { label, icon, onClick, ... }
// or null to skip; { divider: true } draws a line, { hint } a muted note.
export default function Menu({ label, trigger, items, align = 'right', className = '', children }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!root.current?.contains(e.target)) setOpen(false) }
    const key = (e) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      root.current?.querySelector('.menu-trigger')?.focus()
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  useEffect(() => {
    if (open) root.current?.querySelector('.menu-panel button:not(:disabled)')?.focus()
  }, [open])
  return (
    <div ref={root} className={`menu ${className}`}>
      <button
        type="button"
        className="menu-trigger"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </button>
      {open && (
        <div className={`menu-panel menu-${align}`} role="menu">
          {children}
          {items?.filter(Boolean).map((item, index) => item.divider
            ? <hr key={index} />
            : item.hint
              ? <p key={index} className="menu-hint">{item.hint}</p>
              : (
                <button
                  key={index}
                  type="button"
                  role="menuitem"
                  className={item.danger ? 'danger' : ''}
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false)
                    item.onClick()
                  }}
                >
                  <span className="menu-icon">{item.icon && <item.icon size={16} />}</span>
                  <span>{item.label}</span>
                  {item.note !== undefined && item.note !== '' && <small>{item.note}</small>}
                </button>
              ))}
        </div>
      )}
    </div>
  )
}
