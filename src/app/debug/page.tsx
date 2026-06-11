'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { useSyncStatus } from '@/lib/synclog'
import { supabase } from '@/lib/supabase'
import { isRemoteEnabled } from '@/lib/remote'
import { isUuid } from '@/lib/utils'
import { GlassCard } from '@/components/shared/GlassCard'
import {
  Stethoscope, ArrowLeft, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Play, Copy, Check,
} from 'lucide-react'

type CheckResult = { name: string; ok: boolean; detail: string }

const TABLES = [
  'trips', 'members', 'expenses', 'expense_participants', 'hotel_expenses',
  'rooms', 'room_occupants', 'settlements', 'settlement_groups',
  'settlement_group_members', 'sponsorships',
] as const

/**
 * SYNC DOCTOR — godmode diagnostics for production.
 * Everything that can silently fail on Vercel (env vars, missing tables, RLS
 * policies, write permissions) is probed live and reported with the exact
 * error message, so "works locally, not on Vercel" stops being a mystery.
 */
export default function DebugPage() {
  const trips = useStore(s => s.trips)
  const members = useStore(s => s.members)
  const expenses = useStore(s => s.expenses)
  const settlements = useStore(s => s.settlements)
  const synced = useStore(s => s.synced)
  const session = useStore(s => s.session)
  const { remoteConfigured, lastSyncAt, lastSyncOk, lastError, events } = useSyncStatus()

  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<CheckResult[] | null>(null)
  const [copied, setCopied] = useState(false)

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const urlHost = useMemo(() => {
    try { return new URL(envUrl).host } catch { return envUrl ? '(malformed URL!)' : '(not set)' }
  }, [envUrl])

  const currentTrip = trips.find(t => t.id === session?.tripId)

  const runDiagnostics = async () => {
    setRunning(true)
    const out: CheckResult[] = []

    if (!supabase) {
      out.push({
        name: 'Supabase client',
        ok: false,
        detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing at BUILD time. On Vercel: add them in Project → Settings → Environment Variables (Production AND Preview), then REDEPLOY — NEXT_PUBLIC vars are baked in during the build.',
      })
      setResults(out)
      setRunning(false)
      return
    }
    out.push({ name: 'Supabase client', ok: true, detail: `Connected to ${urlHost}` })

    // Read + count every table the app uses
    for (const table of TABLES) {
      try {
        const t0 = performance.now()
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
        const ms = Math.round(performance.now() - t0)
        if (error) {
          out.push({ name: `READ ${table}`, ok: false, detail: error.message })
        } else {
          out.push({ name: `READ ${table}`, ok: true, detail: `${count ?? 0} rows · ${ms}ms` })
        }
      } catch (e) {
        out.push({ name: `READ ${table}`, ok: false, detail: e instanceof Error ? e.message : String(e) })
      }
    }

    // Write probe: insert a throwaway trip, then delete it (reveals RLS/CHECK issues)
    try {
      const probeCode = `TRP-DIAG${Math.floor(Math.random() * 100)}`
      const { data, error: insErr } = await supabase
        .from('trips')
        .insert({ trip_code: probeCode, name: 'Sync Doctor probe', password: 'probe', status: 'active' })
        .select('id')
        .single()
      if (insErr || !data) {
        out.push({ name: 'WRITE trips (probe)', ok: false, detail: insErr?.message || 'insert returned no row' })
      } else {
        const { error: delErr } = await supabase.from('trips').delete().eq('id', data.id)
        out.push({
          name: 'WRITE trips (probe)',
          ok: !delErr,
          detail: delErr ? `insert OK but delete failed: ${delErr.message}` : 'insert + delete OK',
        })
      }
    } catch (e) {
      out.push({ name: 'WRITE trips (probe)', ok: false, detail: e instanceof Error ? e.message : String(e) })
    }

    // Current trip on server?
    if (currentTrip) {
      if (!isUuid(currentTrip.id)) {
        out.push({
          name: 'Current trip id',
          ok: false,
          detail: `"${currentTrip.id}" is not a UUID — this trip predates cloud sync and cannot be uploaded. Create a fresh trip.`,
        })
      } else {
        const { data, error } = await supabase.from('trips').select('id, creator_id').eq('id', currentTrip.id).maybeSingle()
        out.push({
          name: 'Current trip on server',
          ok: !!data && !error,
          detail: error
            ? error.message
            : data
              ? `Found (creator_id ${data.creator_id ? 'set' : 'NULL'})`
              : 'NOT on server yet — it will upload automatically while the app is open',
        })
        if (data) {
          const { count } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('trip_id', currentTrip.id)
          const { count: expCount } = await supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('trip_id', currentTrip.id)
          out.push({
            name: 'Current trip data on server',
            ok: true,
            detail: `${count ?? 0} members, ${expCount ?? 0} expenses (local: ${members.filter(m => m.tripId === currentTrip.id).length} members, ${expenses.filter(e => e.tripId === currentTrip.id).length} expenses)`,
          })
        }
      }
    }

    setResults(out)
    setRunning(false)
  }

  const report = () => {
    const lines = [
      `TripMate Sync Doctor — ${new Date().toISOString()}`,
      `URL host: ${urlHost} · key: ${envKey ? `${envKey.slice(0, 8)}… (${envKey.length} chars)` : 'NOT SET'}`,
      `Remote configured: ${isRemoteEnabled()} · last sync: ${lastSyncAt ?? 'never'} (${lastSyncOk === null ? '—' : lastSyncOk ? 'ok' : 'FAILED'})`,
      lastError ? `Last error: ${lastError}` : '',
      `Local: ${trips.length} trips, ${members.length} members, ${expenses.length} expenses, ${settlements.length} settlements, ${Object.keys(synced).length} synced ids`,
      `Session: ${session ? `${session.tripCode} / member ${session.memberId.slice(0, 8)}` : 'none'}`,
      '',
      ...(results ?? []).map(r => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}: ${r.detail}`),
      '',
      'Recent sync events:',
      ...events.slice(0, 30).map(e => `${e.at} [${e.level}] ${e.tag}${e.detail ? ` — ${e.detail}` : ''}`),
    ]
    return lines.filter(Boolean).join('\n')
  }

  const copyReport = async () => {
    await navigator.clipboard.writeText(report())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto space-y-5">
      <Link href={session ? `/dashboard/${session.tripId}` : '/'} className="inline-flex items-center gap-2 text-white/65 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-brand-600/20 flex items-center justify-center">
          <Stethoscope className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Sync Doctor</h1>
          <p className="text-white/60 text-sm">Live cloud-sync diagnostics for this deployment</p>
        </div>
      </div>

      {/* Environment */}
      <GlassCard className="p-5 space-y-2" hover={false}>
        <h2 className="text-sm font-semibold text-white">Environment</h2>
        <Row ok={!!envUrl} label="NEXT_PUBLIC_SUPABASE_URL" detail={urlHost} />
        <Row ok={!!envKey} label="NEXT_PUBLIC_SUPABASE_ANON_KEY" detail={envKey ? `${envKey.slice(0, 8)}… (${envKey.length} chars)` : 'not set'} />
        <Row ok={remoteConfigured || isRemoteEnabled()} label="Cloud sync mode" detail={isRemoteEnabled() ? 'ON — cross-device sync active' : 'OFF — localStorage only'} />
        {!isRemoteEnabled() && (
          <p className="text-xs text-amber-700 bg-amber-500/15 border border-amber-500/30 rounded-xl px-3 py-2">
            Env vars are baked in at <strong>build time</strong>. After adding them on Vercel you must trigger a new
            deployment, and they must be enabled for the <strong>Production</strong> environment.
          </p>
        )}
      </GlassCard>

      {/* Live sync state */}
      <GlassCard className="p-5 space-y-2" hover={false}>
        <h2 className="text-sm font-semibold text-white">Live sync state</h2>
        <Row ok={lastSyncOk !== false} label="Last sync" detail={lastSyncAt ? `${new Date(lastSyncAt).toLocaleTimeString()} — ${lastSyncOk ? 'OK' : 'FAILED'}` : 'no sync attempt yet (open a trip screen first)'} />
        {lastError && <Row ok={false} label="Last error" detail={lastError} />}
        <Row
          ok={true}
          label="Local data"
          detail={`${trips.length} trips · ${members.length} members · ${expenses.length} expenses · ${settlements.length} settlements · ${Object.keys(synced).length} ids synced`}
        />
        {currentTrip && (
          <Row ok={isUuid(currentTrip.id)} label="Active trip" detail={`${currentTrip.name} (${currentTrip.tripCode}) · id ${isUuid(currentTrip.id) ? 'OK' : 'NOT cloud-compatible'}`} />
        )}
      </GlassCard>

      {/* Deep probe */}
      <GlassCard className="p-5 space-y-3" hover={false}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Server probe</h2>
          <div className="flex gap-2">
            <button
              id="run-diagnostics-btn"
              onClick={runDiagnostics}
              disabled={running}
              className="btn-brand py-2 px-4 text-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {running ? 'Probing…' : 'Run full diagnostics'}
            </button>
            <button
              id="copy-report-btn"
              onClick={copyReport}
              className="btn-ghost py-2 px-3 text-xs flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy report'}
            </button>
          </div>
        </div>
        <p className="text-xs text-white/55">
          Reads every table, counts rows, and runs a write probe — failures show the exact server error
          (RLS, missing table, bad key). Copy the report and share it to get help.
        </p>
        {results && (
          <div className="space-y-1.5 pt-1">
            {results.map((r, i) => <Row key={i} ok={r.ok} label={r.name} detail={r.detail} />)}
          </div>
        )}
      </GlassCard>

      {/* Event log */}
      <GlassCard className="p-5" hover={false}>
        <h2 className="text-sm font-semibold text-white mb-2">Recent sync events</h2>
        {events.length === 0 ? (
          <p className="text-xs text-white/55">No events yet this session. Open a trip screen to start syncing.</p>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto font-mono text-[11px]">
            {events.map((e, i) => (
              <p key={i} className={e.level === 'error' ? 'text-red-500' : 'text-white/65'}>
                {new Date(e.at).toLocaleTimeString()} {e.level === 'error' ? '✗' : '·'} {e.tag}
                {e.detail ? ` — ${e.detail}` : ''}
              </p>
            ))}
          </div>
        )}
      </GlassCard>
    </main>
  )
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  const Icon = ok ? CheckCircle2 : XCircle
  return (
    <div className="flex items-start gap-2">
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${ok ? 'text-emerald-400' : 'text-red-500'}`} />
      <p className="text-xs text-white/80 min-w-0">
        <span className="font-semibold text-white">{label}</span>
        {' — '}
        <span className="break-words">{detail}</span>
      </p>
    </div>
  )
}
