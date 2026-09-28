import Link from 'next/link'
import Image from 'next/image'
import { LEGAL_UPDATED, type LegalDoc } from '@/lib/legal'

function Body({ lines }: { lines: string[] }) {
  const out: React.ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="mt-2 space-y-2 pl-5 list-disc marker:text-violet-400">
          {bullets.map(b => <li key={b}>{b}</li>)}
        </ul>,
      )
      bullets = []
    }
  }
  for (const line of lines) {
    if (line.startsWith('• ')) bullets.push(line.slice(2))
    else {
      flush()
      out.push(<p key={`p-${out.length}`} className="mt-2">{line}</p>)
    }
  }
  flush()
  return <>{out}</>
}

/** Server-rendered legal document: plain HTML, readable without JavaScript. */
export function LegalPage({ doc, other }: { doc: LegalDoc; other: { href: string; label: string } }) {
  return (
    <main className="px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10 sm:py-16">
      <article className="mx-auto max-w-2xl rounded-3xl border border-violet-200/80 bg-pure-white p-6 sm:p-10 shadow-lg text-slate-700">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 hover:text-violet-800">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-lg" />
          TripMate
        </Link>
        <h1
          className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {doc.title}
        </h1>
        <p className="mt-1 text-xs font-medium text-slate-500">Last updated {LEGAL_UPDATED}</p>
        <p className="mt-4 rounded-2xl bg-violet-50 border border-violet-100 p-4 text-sm text-violet-950 leading-relaxed">{doc.summary}</p>

        <nav aria-label="Contents" className="mt-6">
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {doc.sections.map((s, i) => (
              <li key={s.title}>
                <a href={`#s${i + 1}`} className="text-violet-700 hover:underline">{i + 1}. {s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
          {doc.sections.map((s, i) => (
            <section key={s.title} id={`s${i + 1}`} className="scroll-mt-6">
              <h2 className="text-lg font-bold text-slate-950">{i + 1}. {s.title}</h2>
              <Body lines={s.body} />
            </section>
          ))}
        </div>

        <p className="mt-10 border-t border-violet-100 pt-5 text-sm">
          See also: <Link href={other.href} className="font-semibold text-violet-700 hover:underline">{other.label}</Link>
        </p>
      </article>
    </main>
  )
}
