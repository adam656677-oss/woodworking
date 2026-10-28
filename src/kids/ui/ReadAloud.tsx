import { useEffect, useState } from 'react'
import { hasVoice, speak, stop } from '../speech'

/** A speaker button that reads the text out loud; press again to stop. Hidden when there is no voice. */
export function ReadAloud({ text }: { text: string }) {
  const [on, setOn] = useState(false)
  useEffect(() => () => stop(), [text])
  if (!hasVoice()) return null
  return (
    <button
      aria-label={on ? 'Stop reading' : 'Read aloud'}
      title={on ? 'Stop reading' : 'Read aloud'}
      onClick={() => {
        if (on) {
          stop()
          setOn(false)
        } else {
          setOn(true)
          speak(text, () => setOn(false))
        }
      }}
      className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl shadow ${on ? 'bg-amber-500 text-white' : 'bg-white text-sky-800 hover:bg-sky-100'}`}
    >
      <span aria-hidden>{on ? '■' : '🔊'}</span>
    </button>
  )
}
