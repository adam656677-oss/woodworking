import { usePlans } from '../plansStore'
import { BuildGuide } from './BuildGuide'
import { ImportReview } from './ImportReview'
import { PlanEditor } from './PlanEditor'
import { PlansLibrary } from './PlansLibrary'

/** Shows the My Plans screen that is open: the library, the editor, the import review or the build guide. */
export function PlansShell() {
  const view = usePlans(s => s.view)
  switch (view) {
    case 'edit':
      return <PlanEditor />
    case 'import':
      return <ImportReview />
    case 'guide':
      return <BuildGuide />
    default:
      return <PlansLibrary />
  }
}
