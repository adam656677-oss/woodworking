import { KidsCalc } from '../../tools/ui/KidsCalc'
import { useEffect } from 'react'
import { kids, useKids } from '../kidsStore'
import { PlansShell } from '../../plans/ui/PlansShell'
import { BadgesView } from './BadgesView'
import { Certificate } from './Certificate'
import { ProjectSheet } from './ProjectSheet'
import { KidsHome } from './KidsHome'
import { LearnView } from './LearnView'
import { LessonView } from './LessonView'
import { ParentArea } from './ParentArea'
import { PathView } from './PathView'
import { ProjectPage } from './ProjectPage'
import { ProjectsView } from './ProjectsView'
import { QuizView } from './QuizView'

/** Shows the current kids' page. Progress loads the first time the Kids' Workshop opens. */
export function KidsShell() {
  const loaded = useKids(s => s.loaded)
  const page = useKids(s => s.page)
  useEffect(() => {
    void kids.getState().load()
  }, [])
  if (!loaded) return <main className="flex h-full items-center justify-center bg-sky-50 text-2xl text-sky-900">Opening the workshop…</main>
  switch (page.name) {
    case 'path':
      return <PathView />
    case 'lesson':
      return <LessonView key={page.id} id={page.id} back={page.back} />
    case 'quiz':
      return <QuizView key={page.id} id={page.id} />
    case 'projects':
      return <ProjectsView />
    case 'project':
      return <ProjectPage key={page.id} id={page.id} />
    case 'learn':
      return <LearnView />
    case 'badges':
      return <BadgesView />
    case 'parent':
      return <ParentArea />
    case 'plans':
      return <PlansShell />
    case 'sheet':
      return <ProjectSheet key={page.id} projectId={page.id} />
    case 'calc':
      return <KidsCalc />
    case 'certificate':
      return <Certificate key={page.badgeId} badgeId={page.badgeId} />
    default:
      return <KidsHome />
  }
}
