// Opening Shop Mode from My Plans and from a kids' project page.
import { kids } from '../kids/kidsStore'
import type { KidProject } from '../kids/types'
import { plans } from '../plans/plansStore'
import type { Plan } from '../plans/types'
import { shop } from './shopStore'
import { emptyProgress, stepsFromKid, stepsFromPlan } from './steps'

/** A plan's steps, with its photos, ticks kept with the plan. On the kids' side, marked for the child's tier. */
export async function openPlanShop(folder: string, plan: Plan, kidsView: boolean): Promise<void> {
  const tier = kidsView ? kids.getState().progress.tier : undefined
  const steps = await Promise.all(stepsFromPlan(plan, tier).map(async s => (s.photo ? { ...s, photo: (await window.aa.plansFileUrl(folder, s.photo)) ?? undefined } : s)))
  shop.getState().open({
    title: plan.name || 'Untitled plan', steps, progress: plan.progress ?? emptyProgress(), kid: kidsView,
    save: pr => void plans.getState().update(p => ({ ...p, progress: pr }))
  })
}

/** A kids' project: ticks last while Shop Mode is open (the project sheet has its own "Mark as built"). */
export function openKidShop(proj: KidProject): void {
  shop.getState().open({ title: proj.name, steps: stepsFromKid(proj, kids.getState().progress.tier), progress: emptyProgress(), kid: true, save: () => {} })
}
