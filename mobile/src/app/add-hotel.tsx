// Hotel stays are added from the expense form (category "Stay"), exactly like
// the web. This route stays for old links and forwards there.
import { Redirect } from 'expo-router'

export default function AddHotelRedirect() {
  return <Redirect href={{ pathname: '/add-expense', params: { category: 'stay' } }} />
}
