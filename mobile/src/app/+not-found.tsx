// Unknown links (old deep links, typos) land on the home screen, which
// forwards to the trip when a session exists.
import { Redirect } from 'expo-router'

export default function NotFound() {
  return <Redirect href="/" />
}
