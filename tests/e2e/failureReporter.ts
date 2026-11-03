import { mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import type { Reporter, TestCase, TestError, TestResult } from '@playwright/test/reporter'

const clean = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, '')

export default class FailureReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === test.expectedStatus || result.status === 'skipped') return
    const title = test.titlePath().join(' > ')
    const errors = result.errors.map(error => clean(error.stack || error.message || String(error.value || 'Unknown error')))
    const record = { title, location: test.location, status: result.status, retry: result.retry, duration: result.duration, errors }
    process.stdout.write(`\n[E2E FAILURE] ${clean(title)} (${result.status})\n${errors.join('\n').slice(0, 12000)}\n`)
    try {
      const directory = join(process.cwd(), 'test-results', 'failure-details')
      mkdirSync(directory, { recursive: true })
      const key = createHash('sha256').update(test.id).digest('hex').slice(0, 20)
      writeFileSync(join(directory, `${key}-${result.retry}.json`), JSON.stringify(record, null, 2))
    } catch (error) {
      process.stdout.write(`[E2E DIAGNOSTICS WRITE FAILED] ${String(error)}\n`)
    }
  }

  onError(error: TestError) {
    process.stdout.write(`\n[E2E RUNNER ERROR] ${clean(error.stack || error.message || 'Unknown runner error').slice(0, 12000)}\n`)
  }
}
