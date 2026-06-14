import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

type AppDialogProps = {
  children: ReactNode
  closeLabel?: string
  initialFocus?: string
  labelledBy: string
  onClose: () => void
}

export function AppDialog({ children, closeLabel = 'Close dialog', initialFocus, labelledBy, onClose }: AppDialogProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const returnFocusRef = useRef(document.activeElement)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const panel = panelRef.current
    const returnFocusElement = returnFocusRef.current
    const focusable = initialFocus
      ? panel?.querySelector<HTMLElement>(initialFocus)
      : panel?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    focusable?.focus()

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !panel) return

      const focusableElements = [...panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.offsetParent !== null)

      if (!focusableElements.length) return

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (returnFocusElement instanceof HTMLElement) returnFocusElement.focus()
    }
  }, [initialFocus])

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section
        ref={panelRef}
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => event.stopPropagation()}
      >
        <button className="dialog-close" type="button" onClick={onClose} aria-label={closeLabel}>
          <X size={18} />
        </button>
        {children}
      </section>
    </div>
  )
}
