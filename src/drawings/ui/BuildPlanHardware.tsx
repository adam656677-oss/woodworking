import type { Plan } from '../buildPlan'
import { sizeText } from '../../cabinet/ui/HardwareList'

const money = (value: number) => `$${value.toFixed(2)}`

/** The hardware to buy and where each piece goes, from the plan's captured copy of the model. */
export function BuildPlanHardware({ name, hardware }: { name: string; hardware: Plan['hardware'] }) {
  const none = !hardware.rows.length && !hardware.joints.length
  return <section aria-label="Build plan hardware list" className="drawing-page flow-page w-[8.5in] bg-white p-[0.5in] shadow">
    <h2 className="mb-3 text-xl font-semibold">Hardware list — {name}</h2>
    {none && <p>This project needs no hardware. It has no hinges, drawer slides, pulls, shelf pins or screws listed, and none of its joints call for supplies.</p>}
    {hardware.rows.length > 0 && <table className="mb-4 w-full text-sm" style={{ tableLayout: 'fixed' }}>
      <thead style={{ display: 'table-header-group' }}><tr>{['Qty', 'Item', 'Where it goes', 'Each', 'Total'].map(label => <th key={label} scope="col" className="border-b text-left">{label}</th>)}</tr></thead>
      <tbody>{hardware.rows.map(row => <tr key={row.useIds.join()} style={{ breakInside: 'avoid', overflowWrap: 'anywhere' }}>
        <td>{row.qty}</td><td>{row.name}{row.note && ` — ${sizeText(row.note)}`}</td><td>{row.where || 'Whole project'}</td><td>{money(row.unit)}</td><td>{money(row.total)}</td>
      </tr>)}</tbody>
    </table>}
    {hardware.rows.length > 0 && <p className="mb-4 text-sm"><strong>Hardware total:</strong> <span data-testid="build-plan-hardware-total">{money(hardware.total)}</span></p>}
    {hardware.joints.length > 0 && <div className="mb-4">
      <h3 className="font-semibold">Supplies for the joints</h3>
      <ul className="list-inside list-disc text-sm">{hardware.joints.map(item => <li key={item.what}>{item.qty} × {item.what}</li>)}</ul>
    </div>}
  </section>
}
