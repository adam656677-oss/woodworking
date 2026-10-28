// The ways bringing in a plan can fail, each with a plain message.

export type ImportFailure = 'locked' | 'damaged' | 'web' | 'unreadable'

const MESSAGES: Record<ImportFailure, string> = {
  locked: 'This PDF is locked — open it in your PDF reader and print it to a new PDF, then bring that in.',
  damaged: "This file is damaged or isn't a PDF — open it in your PDF reader and print it to a new PDF, then bring that in.",
  web: "That web page couldn't be opened (no internet, too slow, or it needs a sign-in). Save it as a PDF in your browser and bring that in instead.",
  unreadable: "That picture couldn't be read. Try a JPG or PNG."
}

export class PlanImportError extends Error {
  name = 'PlanImportError'
  constructor(public kind: ImportFailure) {
    super(MESSAGES[kind])
  }
}
