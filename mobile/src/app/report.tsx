// The report now lives in the trip tabs (web: /report/[tripId]).
import { Redirect } from 'expo-router'

export default function ReportRedirect() {
  return <Redirect href="/analytics" />
}
