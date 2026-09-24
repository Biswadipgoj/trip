'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Download,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  WifiOff,
  Camera,
  QrCode,
  FileCheck,
} from 'lucide-react'
import { APP_RELEASE, getApkDownloadUrl } from '@/config/appRelease'
import { triggerApkDownload } from '@/lib/downloadApk'

export function DownloadPageClient() {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const downloadUrl = getApkDownloadUrl()

  const handleDownload = () => {
    setIsDownloading(true)
    setDownloadProgress(5)
    triggerApkDownload({
      onStart: () => {
        setIsDownloading(true)
        setDownloadProgress(10)
      },
      onProgress: (pct) => {
        setDownloadProgress(pct)
      },
      onComplete: () => {
        setDownloadProgress(100)
        setTimeout(() => {
          setIsDownloading(false)
          setDownloadProgress(0)
        }, 1500)
      },
      onError: () => {
        setIsDownloading(false)
        setDownloadProgress(0)
      },
    })
  }

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Top Breadcrumb Navigation */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to TripMate</span>
        </Link>
      </div>

      {/* Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/90 p-6 sm:p-10 shadow-xl backdrop-blur-2xl text-slate-800"
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5">
            <Image
              src="/logo.png"
              alt="TripMate App"
              width={112}
              height={112}
              priority
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3.5 py-1 text-xs font-semibold text-brand-600 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Official TripMate Android Release</span>
            </div>

            <h1
              className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              TripMate for Android
            </h1>

            <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-xl">
              Split trip expenses effortlessly, snap bill receipts, and settle debts with UPI.
              Runs 100% offline and syncs automatically with friends when online.
            </p>

            {/* Version Meta Chips */}
            <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-slate-600">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-brand-700">
                v{APP_RELEASE.version} (Build {APP_RELEASE.versionCode})
              </span>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1">
                {APP_RELEASE.fileSizeFormatted}
              </span>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1">
                {APP_RELEASE.minimumAndroidVersion}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 border border-emerald-100">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified APK
              </span>
            </div>

            {/* Download Button */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                id="btn-download-page-apk"
                onClick={handleDownload}
                disabled={isDownloading}
                className="btn-brand relative flex items-center justify-center gap-2.5 w-full sm:w-auto px-8 py-3.5 text-sm font-semibold shadow-lg active:scale-95 transition-all overflow-hidden"
              >
                {isDownloading && (
                  <div
                    className="absolute inset-0 bg-white/20 transition-all duration-300 pointer-events-none"
                    style={{ width: `${downloadProgress}%` }}
                  />
                )}
                <Download className={`h-5 w-5 relative z-10 ${isDownloading ? 'animate-bounce' : ''}`} />
                <span className="relative z-10">
                  {isDownloading
                    ? `Downloading APK (${downloadProgress}%)...`
                    : 'Download Android App (APK)'}
                </span>
              </button>

              <a
                href={downloadUrl}
                download={APP_RELEASE.fileName}
                className="btn-ghost flex items-center justify-center gap-2 text-xs font-semibold px-4 py-3"
              >
                <FileCheck className="h-4 w-4" />
                <span>Direct Storage Link</span>
              </a>
            </div>

            <p className="mt-2.5 text-[11px] text-slate-400">
              Direct download from official TripMate Supabase Storage. No Google Play or third-party store required.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Feature Highlights Grid */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
          <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-600 mb-3">
            <WifiOff className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Offline-First Engine</h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Record expenses in the mountains or on flights. Your changes stay local and sync seamlessly when network returns.
          </p>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
          <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-600 mb-3">
            <Camera className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Receipt & Bill Photos</h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Snap dinner bills and hotel folios with client-side image compression. Backed up safely to Supabase Storage.
          </p>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
          <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-600 mb-3">
            <QrCode className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">One-Tap UPI Settle</h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Launch GPay, PhonePe, or Paytm directly with auto-filled amounts and payee UPI IDs. Attach payment screenshots easily.
          </p>
        </div>
      </div>

      {/* Step-by-Step Installation Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="mt-8 rounded-3xl border border-white/60 bg-white/90 p-6 sm:p-8 shadow-md backdrop-blur-2xl"
      >
        <h2
          className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <Smartphone className="h-5 w-5 text-brand-600" />
          <span>How to Install on Android</span>
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Android protects your device by asking for confirmation before installing APK files downloaded outside Google Play.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3.5 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-brand-600 text-xs font-bold text-white shadow-sm">
              1
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900">Download the APK</p>
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                Tap <strong>Download Android App</strong> above. The file <code>{APP_RELEASE.fileName}</code> will download directly to your phone.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-brand-600 text-xs font-bold text-white shadow-sm">
              2
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900">Open the APK File</p>
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                When finished, tap the notification or open your browser&apos;s <strong>Downloads</strong> folder and tap <code>{APP_RELEASE.fileName}</code>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-brand-600 text-xs font-bold text-white shadow-sm">
              3
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900">Allow Installation</p>
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                If Android displays &ldquo;For your security, your phone is not allowed to install unknown apps from this source&rdquo;, tap <strong>Settings</strong> and switch <strong>Allow from this source</strong> to ON.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-brand-600 text-xs font-bold text-white shadow-sm">
              4
            </span>
            <div>
              <p className="text-xs font-bold text-slate-900">Complete Install</p>
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                Return to the installation prompt and tap <strong>Install</strong>. Open TripMate and you&apos;re ready to create or join trips!
              </p>
            </div>
          </div>
        </div>

        {/* Security / Play Protect notice */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-amber-500/10 p-4 border border-amber-500/20 text-xs text-amber-900">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-semibold text-amber-950">Notice regarding Google Play Protect:</strong>
            <p className="mt-0.5 text-amber-800">
              Because this release APK is hosted directly on TripMate&apos;s infrastructure rather than Google Play Store, Play Protect may display a prompt asking if you want to install. Tap <strong>Install anyway</strong> to proceed. The package is signed with TripMate&apos;s verified release credentials.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Package Specs Table */}
      <div className="mt-8 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-sm backdrop-blur-xl text-xs">
        <h3 className="font-bold text-slate-900 text-sm mb-3">Release Specification</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-600">
          <div>
            <dt className="text-slate-400">Package Name</dt>
            <dd className="font-semibold text-slate-800 mt-0.5 font-mono">{APP_RELEASE.packageName}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Release Version</dt>
            <dd className="font-semibold text-slate-800 mt-0.5">v{APP_RELEASE.version} ({APP_RELEASE.versionCode})</dd>
          </div>
          <div>
            <dt className="text-slate-400">Target Architecture</dt>
            <dd className="font-semibold text-slate-800 mt-0.5">arm64-v8a, armeabi-v7a, x86_64</dd>
          </div>
          <div>
            <dt className="text-slate-400">Storage Distribution</dt>
            <dd className="font-semibold text-slate-800 mt-0.5">Supabase Storage ({APP_RELEASE.bucketName})</dd>
          </div>
        </dl>
      </div>
    </main>
  )
}
