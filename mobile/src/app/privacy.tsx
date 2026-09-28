import { LegalScreen } from '../components/legal/LegalScreen'
import { PRIVACY_POLICY } from '../lib/legal'

export default function PrivacyScreen() {
  return <LegalScreen doc={PRIVACY_POLICY} other={{ href: '/terms', label: 'Terms of Service' }} />
}
