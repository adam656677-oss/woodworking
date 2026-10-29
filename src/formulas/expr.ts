// The formula language for sizes: tape-measure amounts, names, + - * /, brackets and a few functions.

export type Expr =
  | { k: 'num'; v: number }
  | { k: 'name'; name: string }
  | { k: 'neg'; a: Expr }
  | { k: 'bin'; op: '+' | '-' | '*' | '/'; a: Expr; b: Expr }
  | { k: 'call'; fn: string; args: Expr[] }

export const FUNCTIONS = ['min', 'max', 'round', 'floor', 'ceil', 'abs', 'round8', 'round16']

type Tok = { t: 'num'; v: number; at: number } | { t: 'name'; v: string; at: number } | { t: 'op'; v: string; at: number }

const NUM = [
  // 1' 2-3/4"  /  1' 2"  /  1'
  /^(\d+(?:\.\d+)?)'\s*(?:(\d+)(?:[ -](\d+)\/(\d+))?(?:\/(\d+))?(?:\.(\d+))?"?)?/,
  // 11-3/4  11 3/4  (a mixed number: no spaces around the dash)
  /^(\d+)(?:-| (?=\d+\/))(\d+)\/(\d+)"?/,
  // 3/4
  /^(\d+)\/(\d+)"?/,
  // 12  12.5  .5
  /^(\d*\.\d+|\d+)"?/
]

function tokenize(s: string): Tok[] | { error: string } {
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const rest = s.slice(i)
    if (/^\s/.test(rest)) { i++; continue }
    let m: RegExpExecArray | null
    if ((m = NUM[0].exec(rest)) && rest.includes("'") && m[0].includes("'")) {
      const feet = Number(m[1])
      let inches = 0
      if (m[2] !== undefined) {
        inches = Number(m[2])
        if (m[3] !== undefined) inches += Number(m[3]) / Number(m[4])
        else if (m[5] !== undefined) inches = Number(m[2]) / Number(m[5])
        else if (m[6] !== undefined) inches = Number(`${m[2]}.${m[6]}`)
      }
      out.push({ t: 'num', v: feet * 12 + inches, at: i }); i += m[0].length; continue
    }
    if ((m = NUM[1].exec(rest))) { out.push({ t: 'num', v: Number(m[1]) + Number(m[2]) / Number(m[3]), at: i }); i += m[0].length; continue }
    if ((m = NUM[2].exec(rest))) {
      const den = Number(m[2])
      if (den === 0) return { error: 'Dividing by zero' }
      out.push({ t: 'num', v: Number(m[1]) / den, at: i }); i += m[0].length; continue
    }
    if ((m = NUM[3].exec(rest))) { out.push({ t: 'num', v: Number(m[1]), at: i }); i += m[0].length; continue }
    if ((m = /^[A-Za-z_][A-Za-z0-9_]*(?:#\d+)?(?:\.[A-Za-z0-9_]+)*/.exec(rest))) { out.push({ t: 'name', v: m[0], at: i }); i += m[0].length; continue }
    if ('+-*/(),'.includes(rest[0])) { out.push({ t: 'op', v: rest[0], at: i }); i++; continue }
    return { error: `Can't read this formula near '${near(s, i)}'` }
  }
  return out
}

const near = (s: string, i: number) => s.slice(i).trim().slice(0, 14)

export function parseFormula(text: string): { ok: true; expr: Expr } | { ok: false; error: string } {
  const src = text.trim()
  if (!src) return { ok: false, error: 'Type a formula after =' }
  const toks = tokenize(src)
  if (!Array.isArray(toks)) return { ok: false, error: toks.error }
  let i = 0
  const fail = (): never => { throw new Error(`Can't read this formula near '${i < toks.length ? near(src, toks[i].at) : near(src, Math.max(0, src.length - 1))}'`) }
  const peek = () => toks[i]
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v
  const expr = (): Expr => {
    let a = term()
    while (isOp('+') || isOp('-')) { const op = toks[i++].v as '+' | '-'; a = { k: 'bin', op, a, b: term() } }
    return a
  }
  const term = (): Expr => {
    let a = unary()
    while (isOp('*') || isOp('/')) { const op = toks[i++].v as '*' | '/'; a = { k: 'bin', op, a, b: unary() } }
    return a
  }
  const unary = (): Expr => {
    if (isOp('-')) { i++; return { k: 'neg', a: unary() } }
    if (isOp('+')) { i++; return unary() }
    return primary()
  }
  const primary = (): Expr => {
    const t = peek()
    if (!t) { i = toks.length - 1; return fail() }
    if (t.t === 'num') { i++; return { k: 'num', v: t.v } }
    if (t.t === 'name') {
      i++
      if (isOp('(')) {
        const open = i
        i++
        const args: Expr[] = []
        if (!isOp(')')) {
          args.push(expr())
          while (isOp(',')) { i++; args.push(expr()) }
        }
        if (!isOp(')')) { i = open; return fail() }
        i++
        return { k: 'call', fn: t.v, args }
      }
      return { k: 'name', name: t.v }
    }
    if (isOp('(')) {
      const open = i
      i++
      const e = expr()
      if (!isOp(')')) { i = open; return fail() }
      i++
      return e
    }
    return fail()
  }
  try {
    const e = expr()
    if (i < toks.length) fail()
    return { ok: true, expr: e }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export function evalFormula(e: Expr, lookup: (name: string) => number | undefined): { ok: true; value: number } | { ok: false; error: string } {
  const go = (x: Expr): number => {
    switch (x.k) {
      case 'num': return x.v
      case 'name': {
        const v = lookup(x.name.toLowerCase())
        if (v === undefined || !Number.isFinite(v)) throw new Error(`Unknown size '${x.name}'`)
        return v
      }
      case 'neg': return -go(x.a)
      case 'bin': {
        const a = go(x.a), b = go(x.b)
        if (x.op === '/' && b === 0) throw new Error('Dividing by zero')
        return x.op === '+' ? a + b : x.op === '-' ? a - b : x.op === '*' ? a * b : a / b
      }
      case 'call': {
        const fn = x.fn.toLowerCase()
        const args = x.args.map(go)
        const one = () => { if (args.length !== 1) throw new Error(`${fn} takes one value`); return args[0] }
        switch (fn) {
          case 'min': if (!args.length) throw new Error('min needs values'); return Math.min(...args)
          case 'max': if (!args.length) throw new Error('max needs values'); return Math.max(...args)
          case 'round': return Math.round(one())
          case 'floor': return Math.floor(one() + 1e-9)
          case 'ceil': return Math.ceil(one() - 1e-9)
          case 'abs': return Math.abs(one())
          case 'round8': return Math.round(one() * 8) / 8
          case 'round16': return Math.round(one() * 16) / 16
          default: throw new Error(`Unknown size '${x.fn}'`)
        }
      }
    }
  }
  try {
    const value = go(e)
    if (!Number.isFinite(value)) return { ok: false, error: 'Dividing by zero' }
    return { ok: true, value }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export function namesIn(e: Expr): string[] {
  const out = new Set<string>()
  const walk = (x: Expr) => {
    if (x.k === 'name') out.add(x.name.toLowerCase())
    else if (x.k === 'neg') walk(x.a)
    else if (x.k === 'bin') { walk(x.a); walk(x.b) }
    else if (x.k === 'call') x.args.forEach(walk)
  }
  walk(e)
  return [...out]
}

export const isFormulaText = (s: string) => s.trim().startsWith('=')
