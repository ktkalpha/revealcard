import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'

export default function Modal({ title, onClose, children, wide = false, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    dialog.querySelector('[data-autofocus]')?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previous
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''} ${className}`}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const box = ref.current.getBoundingClientRect()
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose()
        }
      }}
    >
      <div className="modal-heading">
        <h2 id="dialog-title">{title}</h2>
        <Button variant="ghost" size="icon" aria-label="닫기" onClick={onClose}>
          <X size={19} />
        </Button>
      </div>
      {children}
    </dialog>
  )
}
