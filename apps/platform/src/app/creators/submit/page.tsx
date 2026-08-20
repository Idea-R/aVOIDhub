import { GameSubmissionForm } from '@/components/GameSubmissionForm'
import { PlatformPage } from '@/components/PlatformPage'

export default function GameSubmitPage() {
  return <PlatformPage eyebrow="/ private review queue" title={<>Submit the build.<br /><em>Not the hype.</em></>} intro="Give us a playable URL and the real hosting need. Nothing becomes public, monetized, or ranked until it passes review."><section className="platformPanel narrowPanel"><GameSubmissionForm /></section></PlatformPage>
}

