// Read-aloud with the computer's own voice (works offline on Windows).

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null)

export function hasVoice(): boolean {
  const s = synth()
  return !!s && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function speak(text: string, onEnd?: () => void): void {
  const s = synth()
  if (!s) return
  s.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.95
  if (onEnd) {
    u.onend = onEnd
    u.onerror = onEnd
  }
  s.speak(u)
}

export function stop(): void {
  synth()?.cancel()
}

export function isSpeaking(): boolean {
  return !!synth()?.speaking
}
