import Link from 'next/link'

/** Shown before someone gives their name, number and PIN. */
export function AgreeNote({ action }: { action: string }) {
  return (
    <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
      By tapping {action}, you agree to the{' '}
      <Link href="/terms" className="font-semibold text-violet-700 hover:underline">Terms of Service</Link> and{' '}
      <Link href="/privacy" className="font-semibold text-violet-700 hover:underline">Privacy Policy</Link>.
    </p>
  )
}
