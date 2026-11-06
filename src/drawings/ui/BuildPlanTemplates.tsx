import type { Plan } from '../buildPlan'

/** True-size (8.5 × 11 in) template pages for shaped parts. Print at Actual size and check the 1 inch square on each cover page. */
export function BuildPlanTemplates({ templates }: { templates: Plan['templates'] }) {
  if (!templates.length) return null
  return <section aria-label="Build plan full-size templates" className="contents">
    {templates.flatMap(t => t.pages.map((svg, index) => <div key={`${t.boardId}-${index}`} data-testid="build-plan-template-page" data-part={`P${t.no}`}
      className="drawing-page bg-white shadow" style={{ width: '8.5in', height: '11in', page: 'portrait-letter' }} dangerouslySetInnerHTML={{ __html: svg }} />))}
  </section>
}
