import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

type TipContent = {
  title: string
  body: string
}

type TipState = TipContent & {
  left: number
  top: number
  width: number
}

function placeBelow(anchor: DOMRect): Pick<TipState, 'left' | 'top' | 'width'> {
  const desktop = window.matchMedia('(min-width: 700px)').matches
  const width = Math.min(
    Math.max(anchor.width, desktop ? 280 : 220),
    desktop ? 420 : 320,
  )
  const margin = 8
  let left = anchor.left + anchor.width / 2 - width / 2
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
  return { left, top: anchor.bottom + margin, width }
}

/** Full card title + description in a fixed portal tip (avoids overflow clipping). */
export function useCardHoverTip(title: string, body: string): {
  ref: RefObject<HTMLElement | null>
  tipHandlers: {
    onMouseEnter: () => void
    onMouseLeave: () => void
    onFocus: () => void
    onBlur: () => void
  }
  tipPortal: ReactNode
} {
  const ref = useRef<HTMLElement | null>(null)
  const tipElRef = useRef<HTMLDivElement | null>(null)
  const [tip, setTip] = useState<TipState | null>(null)

  const show = () => {
    const el = ref.current
    if (!el) return
    setTip({ title, body, ...placeBelow(el.getBoundingClientRect()) })
  }

  const hide = () => setTip(null)

  useLayoutEffect(() => {
    if (!tip || !ref.current || !tipElRef.current) return

    const onMoveAway = () => hide()
    window.addEventListener('scroll', onMoveAway, true)
    window.addEventListener('resize', onMoveAway)

    const anchor = ref.current.getBoundingClientRect()
    const h = tipElRef.current.getBoundingClientRect().height
    const margin = 8
    if (anchor.bottom + margin + h > window.innerHeight - margin) {
      const top = Math.max(margin, anchor.top - h - margin)
      if (Math.abs(top - tip.top) > 1) {
        setTip((t) => (t ? { ...t, top } : t))
      }
    }

    return () => {
      window.removeEventListener('scroll', onMoveAway, true)
      window.removeEventListener('resize', onMoveAway)
    }
  }, [tip])

  const tipPortal =
    tip &&
    createPortal(
      <div
        ref={tipElRef}
        className="card-hover-tip"
        role="tooltip"
        style={{
          left: tip.left,
          top: tip.top,
          width: tip.width,
        }}
      >
        <strong className="card-hover-tip-title">{tip.title}</strong>
        <p className="card-hover-tip-body">{tip.body}</p>
      </div>,
      document.body,
    )

  return {
    ref,
    tipHandlers: {
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
    },
    tipPortal,
  }
}
