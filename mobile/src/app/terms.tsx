import { LegalScreen } from '../components/legal/LegalScreen'
import { TERMS_OF_SERVICE } from '../lib/legal'

export default function TermsScreen() {
  return <LegalScreen doc={TERMS_OF_SERVICE} other={{ href: '/privacy', label: 'Privacy Policy' }} />
}
