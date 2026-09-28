import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface ShortLinkPageProps {
  params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: ShortLinkPageProps): Promise<Metadata> {
  const resolved = await params
  const code = (resolved.code || '').toUpperCase()

  return {
    title: { absolute: `Join Trip ${code} · TripMate` },
    // Personal invite links: keep them out of search results.
    robots: { index: false, follow: true },
    description: `You've been invited to join trip ${code} on TripMate. Track group expenses and settle up with zero hassle.`,
    openGraph: {
      title: `Join Trip ${code} · TripMate`,
      description: `Track group expenses and settle up with zero hassle on TripMate.`,
      type: 'website',
    },
  }
}

export default async function ShortLinkPage({ params }: ShortLinkPageProps) {
  const resolved = await params
  const code = (resolved.code || '').trim().toUpperCase()

  if (code) {
    redirect(`/join-trip?code=${encodeURIComponent(code)}`)
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-white/20">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl overflow-hidden shadow-glow-brand ring-2 ring-brand-500/30">
          <Image src="/logo.png" alt="TripMate" width={64} height={64} priority className="w-full h-full object-cover" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Joining Trip {code}…</h1>
        <p className="text-sm text-white/70 mb-6">Redirecting you to TripMate.</p>
        <Link
          href={`/join-trip?code=${encodeURIComponent(code)}`}
          className="btn-brand inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold rounded-xl"
        >
          Click here if not redirected
        </Link>
      </div>
    </main>
  )
}
