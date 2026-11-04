import type { createShoppingSnapshot } from '../shoppingSnapshot'

type Snapshot = ReturnType<typeof createShoppingSnapshot>
const money = (value: number) => `$${value.toFixed(2)}`
const sections = [['wood', 'Wood'], ['banding', 'Edge banding'], ['hardware', 'Hardware'], ['finish', 'Finishes']] as const

/** Render only the plan's captured data, never the changing live inventory. */
export function BuildPlanShopping({ name, snapshot }: { name: string; snapshot: Snapshot }) {
  const list = snapshot.shopping
  return <section aria-label="Build plan shopping list" className="drawing-page flow-page w-[8.5in] bg-white p-[0.5in] shadow">
    <h2 className="mb-3 text-xl font-semibold">Shopping list — {name}</h2>
    <p className="mb-3 text-sm">{snapshot.inventoryIncluded ? 'Captured with shop inventory deductions.' : 'Captured without shop inventory deductions.'}</p>
    {sections.map(([key, title]) => {
      const lines = list.lines.filter(line => line.section === key)
      return lines.length ? <div key={key} className="mb-4">
        <h3 className="font-semibold">{title}</h3>
        <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
          <thead style={{ display: 'table-header-group' }}><tr>{['Item', 'Qty', 'Unit price', 'Line total'].map(label => <th key={label} scope="col" className="border-b text-left">{label}</th>)}</tr></thead>
          <tbody>{lines.map((line, index) => <tr key={index} style={{ breakInside: 'avoid', overflowWrap: 'anywhere' }}>
            <td>{line.what}</td><td>{line.qty} {line.unit}</td>
            <td>{line.each === undefined ? 'Not priced' : money(line.each)}</td>
            <td>{line.total === undefined ? 'Not priced' : money(line.total)}</td>
          </tr>)}</tbody>
        </table>
      </div> : null
    })}
    {!list.lines.length && <p>No purchase rows in this snapshot.</p>}
    <dl className="mb-4 text-sm">
      <dt>Priced subtotal</dt><dd>{money(list.subtotal)}</dd>
      <dt>Estimated tax</dt><dd>{money(list.tax)}</dd>
      <dt>Estimated priced total</dt><dd data-testid="build-plan-shopping-total">{money(list.total)}</dd>
    </dl>
    <ul className="list-inside list-disc text-sm">{snapshot.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
  </section>
}
