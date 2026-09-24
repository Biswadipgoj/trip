'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Download,
  ShieldCheck,
  Smartphone,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  WifiOff,
  Camera,
  QrCode,
  FileCheck,
  Globe,
} from 'lucide-react'
import { APP_RELEASE, getApkDownloadUrl } from '@/config/appRelease'
import { triggerApkDownload } from '@/lib/downloadApk'
import { isAndroidDevice } from '@/hooks/useAndroidAppPrompt'

export function DownloadPageClient() {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isAndroid, setIsAndroid] = useState<boolean | null>(null)
  const downloadUrl = getApkDownloadUrl()

  useEffect(() => {
    setIsAndroid(isAndroidDevice())
  }, [])

  const handleDownload = () => {
    setIsDownloading(true)
    setDownloadProgress(20)
    triggerApkDownload({
      onStart: () => {
        setIsDownloading(true)
        setDownloadProgress(35)
      },
      onProgress: (pct) => {
        setDownloadProgress(pct)
      },
      onComplete: () => {
        setDownloadProgress(100)
        setTimeout(() => {
          setIsDownloading(false)
          setDownloadProgress(0)
        }, 1200)
      },
      onError: () => {
        setIsDownloading(false)
        setDownloadProgress(0)
      },
    })
  }

  return (
    <main
      className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-slate-900"
      style={{ colorScheme: 'light' }}
    >
      {/* Top Breadcrumb Navigation */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-violet-700 hover:text-violet-900 bg-white/90 px-3.5 py-1.5 rounded-full border border-violet-200/80 shadow-sm transition-all"
        >
          <ArrowLeft className="h-4 w-4 text-violet-700" />
          <span>Back to TripMate</span>
        </Link>
      </div>

      {/* Non-Android Device Notice */}
      {isAndroid === false && (
        <div className="mb-6 rounded-2xl bg-amber-50 p-4 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <Globe className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-950">
                You are currently browsing from a non-Android device
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                The TripMate native app is specifically built for Android phones. You can continue using TripMate right in your browser with full features.
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-md whitespace-nowrap active:scale-95 transition-all"
          >
            <span>Continue to Web App</span>
          </Link>
        </div>
      )}

      {/* Hero Card — Crisp Bright Pure White */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-[32px] border border-violet-200/90 bg-white p-6 sm:p-10 shadow-2xl text-slate-950"
        style={{
          backgroundColor: '#ffffff',
          boxShadow: '0 25px 60px -12px rgba(108, 62, 200, 0.22), 0 0 0 1px rgba(139, 92, 246, 0.12)',
        }}
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-3xl shadow-xl ring-2 ring-violet-200 bg-white">
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
            <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3.5 py-1 text-xs font-bold text-violet-800 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-violet-600" />
              <span>Official TripMate Android Release</span>
            </div>

            <h1
              className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              TripMate for Android
            </h1>

            <p className="mt-2 text-sm sm:text-base font-medium text-slate-700 max-w-xl leading-relaxed">
              Split trip expenses effortlessly, snap bill receipts with the camera, and settle debts with UPI.
              Runs 100% offline and syncs automatically with friends when online.
            </p>

            {/* Version Meta Badges */}
            <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs font-bold">
              <span className="rounded-lg bg-violet-100 px-3 py-1 text-violet-900 border border-violet-200">
                v{APP_RELEASE.version} (Build {APP_RELEASE.versionCode})
              </span>
              <span className="rounded-lg bg-slate-100 px-3 py-1 text-slate-800 border border-slate-200">
                {APP_RELEASE.fileSizeFormatted}
              </span>
              <span className="rounded-lg bg-slate-100 px-3 py-1 text-slate-800 border border-slate-200">
                {APP_RELEASE.minimumAndroidVersion}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1 font-bold text-emerald-900 border border-emerald-200">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Verified APK
              </span>
            </div>

            {/* Action Download Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                id="btn-download-page-apk"
                onClick={handleDownload}
                disabled={isDownloading}
                className="relative flex items-center justify-center gap-2.5 w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-bold text-white shadow-xl active:scale-95 transition-all overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, hsl(262, 85%, 58%) 0%, hsl(310, 80%, 54%) 100%)',
                  boxShadow: '0 10px 25px -4px rgba(139, 92, 246, 0.45)',
                }}
              >
                {isDownloading && (
                  <div
                    className="absolute inset-0 bg-white/25 transition-all duration-300 pointer-events-none"
                    style={{ width: `${downloadProgress}%` }}
                  />
                )}
                <Download className={`h-5 w-5 relative z-10 text-white ${isDownloading ? 'animate-bounce' : ''}`} />
                <span className="relative z-10 text-white drop-shadow-sm">
                  {isDownloading
                    ? `Downloading APK (${downloadProgress}%)...`
                    : isAndroid === false
                    ? 'Download APK (for Android transfer)'
                    : 'Download Android App (APK)'}
                </span>
              </button>

              <a
                href={downloadUrl}
                download={APP_RELEASE.fileName}
                className="flex items-center justify-center gap-2 text-xs font-bold text-violet-800 bg-violet-50 hover:bg-violet-100 px-5 py-3.5 rounded-2xl border border-violet-200/90 transition-all w-full sm:w-auto"
              >
                <FileCheck className="h-4 w-4 text-violet-700" />
                <span>Direct Download Link</span>
              </a>
            </div>

            <p className="mt-3 text-xs font-medium text-slate-600">
              Safe direct download from TripMate official storage. No Google Play account required.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Feature Highlights Grid */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className="rounded-2xl border border-violet-200/80 bg-white p-5 shadow-md"
          style={{ backgroundColor: '#ffffff' }}
        >
          <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 mb-3">
            <WifiOff className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-950">Offline-First Engine</h3>
          <p className="mt-1 text-xs font-medium text-slate-700 leading-relaxed">
            Record expenses in remote spots or on flights. All data stays safe locally and syncs automatically when online.
          </p>
        </div>

        <div
          className="rounded-2xl border border-violet-200/80 bg-white p-5 shadow-md"
          style={{ backgroundColor: '#ffffff' }}
        >
          <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 mb-3">
            <Camera className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-950">Receipt & Bill Photos</h3>
          <p className="mt-1 text-xs font-medium text-slate-700 leading-relaxed">
            Snap dinner bills and hotel folios with client-side image compression. Synced safely to Supabase Storage.
          </p>
        </div>

        <div
          className="rounded-2xl border border-violet-200/80 bg-white p-5 shadow-md"
          style={{ backgroundColor: '#ffffff' }}
        >
          <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 mb-3">
            <QrCode className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-950">One-Tap UPI Settle</h3>
          <p className="mt-1 text-xs font-medium text-slate-700 leading-relaxed">
            Launch GPay, PhonePe, or Paytm with auto-filled amounts and payee UPI IDs. Attach payment screenshots easily.
          </p>
        </div>
      </div>

      {/* Step-by-Step Installation Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="mt-8 rounded-3xl border border-violet-200/90 bg-white p-6 sm:p-8 shadow-lg text-slate-950"
        style={{ backgroundColor: '#ffffff' }}
      >
        <h2
          className="text-xl font-extrabold tracking-tight text-slate-950 flex items-center gap-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <Smartphone className="h-5 w-5 text-violet-700" />
          <span>How to Install on Android</span>
        </h2>
        <p className="mt-1 text-xs font-medium text-slate-700">
          Android protects your phone by asking for permission before installing APK files downloaded directly from web browsers.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3.5 rounded-2xl bg-violet-50/70 p-4 border border-violet-100">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-violet-700 text-xs font-bold text-white shadow-sm">
              1
            </span>
            <div>
              <p className="text-xs font-bold text-slate-950">Download the APK</p>
              <p className="mt-0.5 text-xs font-medium text-slate-700 leading-relaxed">
                Tap <strong>Download Android App</strong> above. The file <code>{APP_RELEASE.fileName}</code> will download directly to your phone.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl bg-violet-50/70 p-4 border border-violet-100">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-violet-700 text-xs font-bold text-white shadow-sm">
              2
            </span>
            <div>
              <p className="text-xs font-bold text-slate-950">Open the APK File</p>
              <p className="mt-0.5 text-xs font-medium text-slate-700 leading-relaxed">
                When finished, tap the notification or open your browser&apos;s <strong>Downloads</strong> folder and tap <code>{APP_RELEASE.fileName}</code>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl bg-violet-50/70 p-4 border border-violet-100">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-violet-700 text-xs font-bold text-white shadow-sm">
              3
            </span>
            <div>
              <p className="text-xs font-bold text-slate-950">Allow Installation</p>
              <p className="mt-0.5 text-xs font-medium text-slate-700 leading-relaxed">
                If Android displays &ldquo;For your security, your phone is not allowed to install unknown apps from this source&rdquo;, tap <strong>Settings</strong> and toggle <strong>Allow from this source</strong> to ON.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl bg-violet-50/70 p-4 border border-violet-100">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-violet-700 text-xs font-bold text-white shadow-sm">
              4
            </span>
            <div>
              <p className="text-xs font-bold text-slate-950">Complete Install</p>
              <p className="mt-0.5 text-xs font-medium text-slate-700 leading-relaxed">
                Return to the installation screen and tap <strong>Install</strong>. Open TripMate and you&apos;re ready to go!
              </p>
            </div>
          </div>
        </div>

        {/* Security / Play Protect notice */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-950">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-bold text-amber-950">Notice regarding Google Play Protect:</strong>
            <p className="mt-0.5 font-medium text-amber-900">
              Because this release APK is hosted directly on TripMate&apos;s official infrastructure rather than Google Play Store, Play Protect may display a prompt asking if you want to install. Tap <strong>Install anyway</strong> to proceed. The package is signed with TripMate&apos;s verified release credentials.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Package Specs Table */}
      <div
        className="mt-8 rounded-3xl border border-violet-200/90 bg-white p-6 shadow-md text-xs text-slate-900"
        style={{ backgroundColor: '#ffffff' }}
      >
        <h3 className="font-bold text-slate-950 text-sm mb-3">Release Specification</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <dt className="text-slate-600 font-medium">Package Name</dt>
            <dd className="font-bold text-slate-950 mt-0.5 font-mono">{APP_RELEASE.packageName}</dd>
          </div>
          <div>
            <dt className="text-slate-600 font-medium">Release Version</dt>
            <dd className="font-bold text-slate-950 mt-0.5">v{APP_RELEASE.version} ({APP_RELEASE.versionCode})</dd>
          </div>
          <div>
            <dt className="text-slate-600 font-medium">Target Architecture</dt>
            <dd className="font-bold text-slate-950 mt-0.5">arm64-v8a, armeabi-v7a, x86_64</dd>
          </div>
          <div>
            <dt className="text-slate-600 font-medium">Distribution Engine</dt>
            <dd className="font-bold text-slate-950 mt-0.5">TripMate Cloud ({APP_RELEASE.bucketName})</dd>
          </div>
        </dl>
      </div>
    </main>
  )
}
