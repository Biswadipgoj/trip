'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Smartphone, PlusSquare } from 'lucide-react'
import { isStandalone, usePlatform } from '@/lib/platform'
import { useTranslation } from '@/lib/i18n'
import { IosInstallSheet } from './IosInstallSheet'

interface AppInstallLinkProps {
  className: string
  iconClassName?: string
  id?: string
}

/**
 * Platform-aware install call-to-action.
 * - Android browser: links to the APK download page.
 * - iPhone / iPad: opens the "Add to Home Screen" guide (installs the offline web app).
 * - Desktop, or already running as an installed app: renders nothing.
 */
export function AppInstallLink({ className, iconClassName, id }: AppInstallLinkProps) {
  const { t } = useTranslation()
  const platform = usePlatform()
  const [installed, setInstalled] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    setInstalled(isStandalone())
  }, [])

  if (installed) return null

  if (platform === 'android') {
    return (
      <Link href="/download" id={id} className={className}>
        <Smartphone className={iconClassName} />
        <span>{t('getAndroidApp')}</span>
      </Link>
    )
  }

  if (platform === 'ios') {
    return (
      <>
        <button type="button" id={id} className={className} onClick={() => setSheetOpen(true)}>
          <PlusSquare className={iconClassName} />
          <span>{t('addToHomeScreen')}</span>
        </button>
        <IosInstallSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </>
    )
  }

  return null
}
