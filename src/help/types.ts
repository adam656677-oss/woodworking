// What a help topic looks like. The words themselves live in topics.ts and kidsTopics.ts.

export type Audience = 'master' | 'kids'

export type HelpTopic = {
  /** Short, stable name (used by F1 to jump straight to a topic). */
  id: string
  /** Which list the topic sits under. */
  group: string
  /** The question the person is asking: "How do I …?". */
  title: string
  /** One sentence about what the topic helps with. */
  summary: string
  /** Extra words people might search for that the text itself does not use. */
  keywords: string[]
  /** Short numbered steps. Write **Name** around the name of any button, menu or box on screen. */
  steps: string[]
  /** An extra hint shown under the steps. */
  tip?: string
  /**
   * Every **Name** used in steps and tip, exactly as it appears on screen. A unit test checks each one is still
   * in the app's source, so a renamed button shows up as a failing test instead of wrong help.
   */
  labels: string[]
  /** Shortcut ids (from shortcuts.ts) to show under the steps. */
  shortcuts?: string[]
}
