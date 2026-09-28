import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { SITE_URL } from '@/config/site'
import { GUIDES, guideBySlug, type Guide } from '@/lib/guides'

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

export function guideMetadata(slug: string): Metadata {
  const g = guideBySlug(slug)!
  return {
    title: { absolute: g.title },
    description: g.description,
    alternates: { canonical: `/${g.slug}` },
    openGraph: { title: g.title, description: g.description, url: `${SITE_URL}/${g.slug}`, type: 'article' },
  }
}

function Lines({ lines }: { lines: string[] }) {
  const bullets = lines.filter(l => l.startsWith('• '))
  const paras = lines.filter(l => !l.startsWith('• '))
  return (
    <>
      {paras.map(p => <p key={p} className="mt-3">{p}</p>)}
      {bullets.length > 0 && (
        <ul className="mt-3 space-y-2">
          {bullets.map(b => (
            <li key={b} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden="true" />
              <span>{b.slice(2)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Server-rendered guide page: all text is in the HTML Google receives. */
export function GuidePage({ slug }: { slug: string }) {
  const g = guideBySlug(slug) as Guide
  const total = g.example.expenses.reduce((s, e) => s + e.amount, 0)
  const share = total / g.example.people.length
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: g.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TripMate', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: g.h1, item: `${SITE_URL}/${g.slug}` },
        ],
      },
    ],
  }

  return (
    <main className="px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-3xl text-slate-700 text-[15px] sm:text-base leading-relaxed">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-slate-900 hover:text-violet-800">
            <Image src="/logo.png" alt="" width={28} height={28} className="rounded-lg" />
            TripMate
          </Link>
          <span aria-hidden="true">/</span> Guide
        </nav>
        <h1
          className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 leading-tight"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {g.h1}
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-600">{g.lead}</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link href="/create-trip" className="btn-brand inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold">
            Start a trip, free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/join-trip" className="inline-flex items-center justify-center rounded-2xl border border-violet-200 bg-pure-white px-5 py-3 text-sm font-bold text-slate-800 hover:bg-violet-50">
            Join a friend&apos;s trip
          </Link>
        </div>

        {g.sections.map(s => (
          <section key={s.h2} className="mt-10">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-950">{s.h2}</h2>
            <Lines lines={s.body} />
          </section>
        ))}

        <section className="mt-10 rounded-3xl border border-violet-200/80 bg-pure-white p-5 sm:p-7 shadow-sm">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-950">Worked example</h2>
          <p className="mt-1 text-sm text-slate-500">{g.example.caption}</p>
          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">Expenses</caption>
            <thead>
              <tr className="text-left text-slate-500"><th className="py-1 font-semibold">Paid by</th><th className="py-1 font-semibold">For</th><th className="py-1 text-right font-semibold">Amount</th></tr>
            </thead>
            <tbody>
              {g.example.expenses.map(e => (
                <tr key={e.what} className="border-t border-violet-100">
                  <td className="py-2 font-medium text-slate-900">{e.paidBy}</td><td className="py-2">{e.what}</td><td className="py-2 text-right tabular-nums">{inr(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4">
            Total {inr(total)}, shared equally between {g.example.people.length} people: {inr(share)} each.
            TripMate settles it in <strong>{g.example.settlements.length} payments</strong>:
          </p>
          <ul className="mt-3 space-y-2">
            {g.example.settlements.map(s => (
              <li key={s.from} className="flex items-center justify-between rounded-2xl bg-violet-50 px-4 py-2.5">
                <span><strong className="text-slate-900">{s.from}</strong> pays <strong className="text-slate-900">{s.to}</strong></span>
                <span className="font-bold tabular-nums text-violet-800">{inr(s.amount)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-950">Frequently asked questions</h2>
          <div className="mt-4 space-y-3">
            {g.faqs.map(f => (
              <details key={f.q} className="group rounded-2xl border border-violet-100 bg-pure-white p-4 open:shadow-sm">
                <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:hidden">{f.q}</summary>
                <p className="mt-2">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-10 border-t border-violet-100 pt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">More guides</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {GUIDES.filter(x => x.slug !== g.slug).map(x => (
              <li key={x.slug}>
                <Link href={`/${x.slug}`} className="inline-block rounded-full border border-violet-200 bg-pure-white px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-50">{x.h1}</Link>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  )
}
