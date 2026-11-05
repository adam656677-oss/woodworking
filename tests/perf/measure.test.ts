// Prints (and with AA_PERF_OUT writes) the timing table for the kitchen fixture: AA_PERF_OUT=/tmp/after.json npx vitest run tests/perf/measure.test.ts
import { writeFileSync } from 'node:fs'
import { deserialize } from '../../src/model/fileFormat'
import { fixtureText, measureAll, sceneStats } from './harness'

test('measure the kitchen', () => {
  const t = measureAll(5, 3)
  const s = sceneStats(deserialize(fixtureText()))
  const out = { ...Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v * 10) / 10])), ...s, bytes: fixtureText().length }
  console.log(JSON.stringify(out, null, 1))
  if (process.env.AA_PERF_OUT) writeFileSync(process.env.AA_PERF_OUT, JSON.stringify(out))
}, 600_000)
