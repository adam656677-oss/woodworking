// Sends problems in the page to the log file kept by the main process (text only, never project contents).
export type ErrorReport = { source: string; message: string; stack?: string }

const textOf = (e: unknown): { message: string; stack?: string } =>
  e instanceof Error ? { message: e.message || e.name, stack: e.stack } : { message: String(e ?? 'Unknown error') }

export function reportError(source: string, e: unknown, extra?: string): void {
  try {
    const { message, stack } = textOf(e)
    const report: ErrorReport = { source, message }
    const detail = [stack, extra].filter(Boolean).join('\n')
    if (detail) report.stack = detail
    window.aa?.logError?.(report)
  } catch {
    // Reporting a problem must never cause another one.
  }
}

/** Listen for errors nothing else caught; returns a function that stops listening. */
export function installErrorForwarding(): () => void {
  const onError = (ev: ErrorEvent) => reportError('window.onerror', ev.error ?? ev.message, ev.filename ? `at ${ev.filename}:${ev.lineno}:${ev.colno}` : undefined)
  const onRejection = (ev: PromiseRejectionEvent) => reportError('unhandledrejection', ev.reason)
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
