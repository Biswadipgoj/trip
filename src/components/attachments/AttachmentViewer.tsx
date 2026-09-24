'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Attachment, AttachmentKind } from '@/types'
import { mediaSignedUrl } from '@/lib/remote'
import { attachmentSources } from '@/lib/media'
import { prepareImageForUpload, ImagePrepError } from '@/lib/image'
import { useStore } from '@/lib/store'
import {
  Camera, Image as ImageIcon, X, Trash2, ExternalLink,
  AlertCircle, Loader2, RotateCw, Clock,
} from 'lucide-react'

interface AttachmentViewerProps {
  tripId: string
  kind: AttachmentKind
  expenseId?: string
  hotelExpenseId?: string
  settlementId?: string
  fromMemberId?: string
  toMemberId?: string
  amount?: number
  readOnly?: boolean
  compact?: boolean
}

/**
 * Loads an attachment from the first source that works: this session's
 * preview, the public URL, then a signed URL (private bucket). Reports
 * `failed` when none load, so the caller can show a placeholder.
 */
function useAttachmentSrc(a: Attachment) {
  const sources = attachmentSources(a)
  const key = `${a.id}|${sources.join('|')}`
  const [state, setState] = useState<{ key: string; index: number; signed: string | null; failed: boolean }>(
    { key, index: 0, signed: null, failed: false }
  )
  const current = state.key === key ? state : { key, index: 0, signed: null, failed: false }
  const src = current.signed ?? sources[current.index] ?? null

  const onError = async () => {
    if (current.index + 1 < sources.length && !current.signed) {
      setState({ ...current, index: current.index + 1 })
      return
    }
    if (!current.signed && a.storagePath) {
      const signed = await mediaSignedUrl(a.storagePath)
      if (signed) {
        setState({ ...current, signed })
        return
      }
    }
    setState({ ...current, failed: true })
  }
  const reload = () => setState({ key, index: 0, signed: null, failed: false })

  // Nothing to load yet (e.g. the upload never reached storage).
  const failed = current.failed || (!src && a.upload !== 'uploading')
  return { src: failed ? null : src, failed, onError, reload }
}

export function AttachmentViewer({
  tripId,
  kind,
  expenseId,
  hotelExpenseId,
  settlementId,
  fromMemberId,
  toMemberId,
  amount,
  readOnly = false,
  compact = false,
}: AttachmentViewerProps) {
  const allAttachments = useStore(s => s.attachments)
  const addAttachment = useStore(s => s.addAttachment)
  const deleteAttachment = useStore(s => s.deleteAttachment)
  const retryAttachment = useStore(s => s.retryAttachment)
  const session = useStore(s => s.session)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const attachments = React.useMemo(() => {
    return allAttachments.filter(a => {
      if (a.tripId !== tripId) return false
      if (a.kind !== kind) return false
      if (expenseId && a.expenseId === expenseId) return true
      if (hotelExpenseId && a.hotelExpenseId === hotelExpenseId) return true
      if (kind === 'payment_proof') {
        if (settlementId && a.settlementId === settlementId) return true
        if (fromMemberId && toMemberId && a.fromMemberId === fromMemberId && a.toMemberId === toMemberId) return true
      }
      return false
    })
  }, [allAttachments, tripId, kind, expenseId, hotelExpenseId, settlementId, fromMemberId, toMemberId])

  const active = attachments.find(a => a.id === activeId) ?? null
  const label = kind === 'bill' ? 'bill photo' : 'payment screenshot'

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return

    setErrorMsg(null)
    setPreparing(true)
    try {
      const prepared = await prepareImageForUpload(file)
      setPreparing(false)
      await addAttachment({
        tripId,
        kind,
        expenseId,
        hotelExpenseId,
        settlementId,
        fromMemberId,
        toMemberId,
        amount,
        mimeType: prepared.mimeType,
        width: prepared.width,
        height: prepared.height,
        uploadedBy: session?.memberId,
        file: prepared.blob,
      })
    } catch (err) {
      setErrorMsg(err instanceof ImagePrepError ? err.message : "Couldn't open this photo. Try another one.")
    } finally {
      setPreparing(false)
    }
  }

  const handleDelete = async (att: Attachment) => {
    if (window.confirm(`Delete this ${label} for everyone in the trip?`)) {
      if (activeId === att.id) setActiveId(null)
      await deleteAttachment(att.id)
    }
  }

  if (compact && readOnly && attachments.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {attachments.map(att => (
          <Thumb
            key={att.id}
            att={att}
            label={label}
            onOpen={() => setActiveId(att.id)}
            onRetry={() => void retryAttachment(att.id)}
          />
        ))}

        {!readOnly && (
          <label
            className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-white/25 bg-white/5 hover:bg-white/10 hover:border-brand-400/60 w-16 h-16 flex-shrink-0 cursor-pointer transition-colors text-white/70 hover:text-white focus-within:ring-2 focus-within:ring-brand-400 ${preparing ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
              disabled={preparing}
              aria-label={kind === 'bill' ? 'Add a bill photo' : 'Add a payment screenshot'}
            />
            {preparing ? (
              <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
            ) : (
              <>
                <Camera className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-medium">{kind === 'bill' ? 'Add bill' : 'Add proof'}</span>
              </>
            )}
          </label>
        )}
      </div>

      {errorMsg && (
        <p role="alert" className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {errorMsg}
        </p>
      )}

      <AnimatePresence>
        {active && (
          <Lightbox
            att={active}
            label={label}
            readOnly={readOnly}
            onClose={() => setActiveId(null)}
            onDelete={() => void handleDelete(active)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Thumb({ att, label, onOpen, onRetry }: { att: Attachment; label: string; onOpen: () => void; onRetry: () => void }) {
  const { src, failed, onError } = useAttachmentSrc(att)
  const uploadFailed = att.upload === 'failed'
  const status =
    att.upload === 'uploading' ? 'uploading'
      : uploadFailed ? `upload failed: ${att.uploadError || 'tap to retry'}`
        : att.upload === 'pending' ? 'saved, syncing to the trip'
          : 'uploaded'

  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <button
        type="button"
        onClick={uploadFailed && !att.storagePath ? onRetry : onOpen}
        title={uploadFailed ? att.uploadError : undefined}
        aria-label={`${label}, ${status}`}
        className="group w-full h-full rounded-xl overflow-hidden border border-white/15 bg-white/5 shadow-sm hover:border-brand-400/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            onError={() => void onError()}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-white/40">
            {failed ? <ImageIcon className="w-6 h-6" /> : <Loader2 className="w-5 h-5 animate-spin" />}
          </span>
        )}

        {att.upload === 'uploading' && (
          <span className="absolute inset-0 bg-black/45 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </span>
        )}
        {uploadFailed && (
          <span className="absolute inset-0 bg-red-950/60 flex flex-col items-center justify-center text-white text-center">
            <RotateCw className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-semibold">Retry</span>
          </span>
        )}
      </button>
      {att.upload === 'pending' && (
        <span
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center"
          aria-hidden
        >
          <Clock className="w-3 h-3 text-white" />
        </span>
      )}
    </div>
  )
}

function Lightbox({ att, label, readOnly, onClose, onDelete }: {
  att: Attachment; label: string; readOnly: boolean; onClose: () => void; onDelete: () => void
}) {
  const { src, failed, onError, reload } = useAttachmentSrc(att)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  const title = att.kind === 'bill' ? 'Bill photo' : 'Payment screenshot'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative max-w-3xl w-full max-h-[90vh] bg-surface-900 border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="w-4 h-4 text-brand-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-white">{title}</span>
            <span className="text-xs text-white/60 truncate">
              {new Date(att.createdAt).toLocaleDateString()}
              {att.upload === 'pending' ? ' · syncing to the trip' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {src && (
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Open full size in a new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={onDelete}
                className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                aria-label={`Delete this ${label}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40 min-h-[300px]">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={title}
              onError={() => void onError()}
              className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-lg"
            />
          ) : failed ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-white/70">
                {att.upload === 'failed' && att.uploadError ? att.uploadError : "This image couldn't be loaded."}
              </p>
              {att.storagePath && (
                <button type="button" onClick={reload} className="btn-ghost text-sm inline-flex items-center gap-1.5">
                  <RotateCw className="w-4 h-4" /> Try again
                </button>
              )}
            </div>
          ) : (
            <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
