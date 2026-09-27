'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Check, Search, X } from 'lucide-react'
import { useTranslation, LANGUAGES, type LanguageMeta } from '@/lib/i18n'

interface LanguageSelectorProps {
  className?: string
  compact?: boolean
}

export function LanguageSelector({ className = '', compact = false }: LanguageSelectorProps) {
  const { language, setLanguage, t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  const currentMeta = useMemo(
    () => LANGUAGES.find(l => l.code === language) || LANGUAGES[0],
    [language]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return LANGUAGES
    return LANGUAGES.filter(
      l =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    )
  }, [query])

  // Close on Outside Click or Escape
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    const onClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onClickOutside)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onClickOutside)
    }
  }, [isOpen])

  const selectLanguage = (code: string) => {
    setLanguage(code)
    setIsOpen(false)
    setQuery('')
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        id="btn-language-selector"
        onClick={() => setIsOpen(true)}
        aria-label="Choose Language"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-500/25 bg-pure-white/90 hover:bg-pure-white text-slate-800 text-xs font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
      >
        <span className="text-sm">{currentMeta.flag}</span>
        <Globe className="w-3.5 h-3.5 text-brand-600" />
        <span className="font-semibold">{currentMeta.nativeName}</span>
      </button>

      {/* Language Selection Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-brand-500/30 bg-pure-white shadow-2xl p-6 overflow-hidden text-slate-900"
              style={{ backgroundColor: '#ffffff' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-brand-500/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">
                      {t('changeLanguage')}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      20 Indian & Regional Languages
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="mt-4 mb-3 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('searchLanguage')}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  autoFocus
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Language List */}
              <div className="overflow-y-auto flex-1 pr-1 space-y-1.5 max-h-[55vh]">
                {filtered.map(item => {
                  const isSelected = item.code === language
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => selectLanguage(item.code)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all text-left ${
                        isSelected
                          ? 'bg-brand-500/10 border border-brand-500/30 font-bold text-brand-900 shadow-sm'
                          : 'hover:bg-slate-50 border border-transparent text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{item.flag}</span>
                        <div>
                          <p className="text-xs font-bold leading-tight">
                            {item.nativeName}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {item.name}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-brand-600 text-pure-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      )}
                    </button>
                  )
                })}
                {filtered.length === 0 && (
                  <p className="text-center py-6 text-xs text-slate-500">
                    No language found for &quot;{query}&quot;
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
