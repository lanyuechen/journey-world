import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

export function IconTrash({ className = 'trip-icon' }) {
  return (
    <svg className={className} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M360.533333 170.666667a42.666667 42.666667 0 0 1 42.666667-42.666667h217.6a42.666667 42.666667 0 0 1 42.666667 42.666667V213.333333h170.666666a42.666667 42.666667 0 1 1 0 85.333334H192a42.666667 42.666667 0 1 1 0-85.333334h168.533333V170.666667zM256 341.333333h512l-36.266667 490.666667a85.333333 85.333333 0 0 1-85.333333 78.933333H377.6a85.333333 85.333333 0 0 1-85.333333-78.933333L256 341.333333z m128 128a42.666667 42.666667 0 0 1 85.333333 0v298.666667a42.666667 42.666667 0 0 1-85.333333 0V469.333333z m170.666667 0a42.666667 42.666667 0 0 1 85.333333 0v298.666667a42.666667 42.666667 0 0 1-85.333333 0V469.333333z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconEdit({ className = 'trip-icon' }) {
  return (
    <svg className={className} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M832.853333 342.186667l-151.04-151.04a42.666667 42.666667 0 0 0-60.33 0L189.866667 622.762667a42.666667 42.666667 0 0 0-11.178667 19.754666l-42.666667 170.666667a42.666667 42.666667 0 0 0 51.882667 51.882667l170.666667-42.666667a42.666667 42.666667 0 0 0 19.754666-11.178667l431.616-431.616a42.666667 42.666667 0 0 0 0-60.330666zM398.506667 746.666667l-96.853334 24.213333 24.213334-96.853333 360.106666-360.106667 72.64 72.64-360.106666 360.106667z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconNested({ className = 'trip-icon' }) {
  return (
    <svg className={className} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M213.333333 170.666667h426.666667a85.333333 85.333333 0 0 1 85.333333 85.333333v85.333333h42.666667a85.333333 85.333333 0 0 1 85.333333 85.333334v341.333333a85.333333 85.333333 0 0 1-85.333333 85.333333H384a85.333333 85.333333 0 0 1-85.333333-85.333333v-85.333333H213.333333a85.333333 85.333333 0 0 1-85.333333-85.333334V256a85.333333 85.333333 0 0 1 85.333333-85.333333z m0 85.333333v426.666667h85.333334V341.333333a85.333333 85.333333 0 0 1 85.333333-85.333333h341.333333V256H213.333333z m170.666667 170.666667v341.333333h426.666667V426.666667H384z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconView({ className = 'trip-icon' }) {
  return (
    <svg className={className} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M512 192c-247.424 0-448 186.88-448 320s200.576 320 448 320 448-186.88 448-320-200.576-320-448-320z m0 554.666667c-176.64 0-320-143.36-320-234.666667s143.36-234.666667 320-234.666667 320 143.36 320 234.666667-143.36 234.666667-320 234.666667z m0-384a149.333333 149.333333 0 1 0 0 298.666666 149.333333 149.333333 0 0 0 0-298.666666z m0 213.333333a64 64 0 1 1 0-128 64 64 0 0 1 0 128z"
        fill="currentColor"
      />
    </svg>
  )
}

function FloatingTip({ anchorRef, label, open }) {
  const [pos, setPos] = useState(null)

  useEffect(() => {
    if (!open || !label || !anchorRef.current) {
      setPos(null)
      return undefined
    }
    const update = () => {
      const el = anchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setPos({
        top: rect.top,
        left: rect.left + rect.width / 2,
      })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, label, anchorRef])

  if (!open || !label || !pos) return null
  return createPortal(
    <div className="floating-tip" style={{ top: pos.top, left: pos.left }} role="tooltip">
      {label}
    </div>,
    document.body,
  )
}

export function TipButton({ tip, className = '', children, ...props }) {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        {...props}
        ref={ref}
        className={className}
        onMouseEnter={(e) => {
          setOpen(true)
          props.onMouseEnter?.(e)
        }}
        onMouseLeave={(e) => {
          setOpen(false)
          props.onMouseLeave?.(e)
        }}
        onFocus={(e) => {
          setOpen(true)
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setOpen(false)
          props.onBlur?.(e)
        }}
      >
        {children}
      </button>
      <FloatingTip anchorRef={ref} label={tip} open={open} />
    </>
  )
}

export function TipLink({ tip, className = '', children, ...props }) {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <Link
        {...props}
        ref={ref}
        className={className}
        onMouseEnter={(e) => {
          setOpen(true)
          props.onMouseEnter?.(e)
        }}
        onMouseLeave={(e) => {
          setOpen(false)
          props.onMouseLeave?.(e)
        }}
        onFocus={(e) => {
          setOpen(true)
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setOpen(false)
          props.onBlur?.(e)
        }}
      >
        {children}
      </Link>
      <FloatingTip anchorRef={ref} label={tip} open={open} />
    </>
  )
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal-panel modal-panel-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className="modal-title">
          {title}
        </h2>
        <p id="confirm-modal-desc" className="modal-confirm-message">
          {message}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
