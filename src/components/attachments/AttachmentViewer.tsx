'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Attachment, AttachmentKind } from '@/types'
import { mediaPublicUrl } from '@/lib/remote'
import { useStore } from '@/lib/store'
import {
  Camera, Image as ImageIcon, X, Trash2,
  ExternalLink, AlertCircle, Loader2, ZoomIn
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
  const session = useStore(s => s.session)

  const [activeImage, setActiveImage] = useState<Attachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filter attachments relevant to this item
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

  const getSourceUrl = (a: Attachment): string | null => {
    if (a.localUri) return a.localUri
    if (a.storagePath) return mediaPublicUrl(a.storagePath)
    return null
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file (JPG, PNG, WebP)')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image size must be under 10 MB')
      return
    }

    setErrorMsg(null)
    setUploading(true)

    try {
      await addAttachment({
        tripId,
        kind,
        expenseId,
        hotelExpenseId,
        settlementId,
        fromMemberId,
        toMemberId,
        amount,
        mimeType: file.type || 'image/jpeg',
        sizeBytes: file.size,
        uploadedBy: session?.memberId,
        file,
      })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (att: Attachment) => {
    if (window.confirm('Delete this photo? This cannot be undone.')) {
      if (activeImage?.id === att.id) setActiveImage(null)
      await deleteAttachment(att.id)
    }
  }

  if (compact && attachments.length === 0) {
    if (readOnly) return null
  }

  return (
    <div className="space-y-2">
      {/* Thumbnails strip */}
      <div className="flex items-center gap-2 flex-wrap">
        {attachments.map(att => {
          const url = getSourceUrl(att)
          const isFailed = att.upload === 'failed'
          const isUploading = att.upload === 'uploading'

          return (
            <div
              key={att.id}
              className="relative group rounded-xl overflow-hidden border border-white/15 bg-white/5 w-16 h-16 flex-shrink-0 cursor-pointer shadow-md hover:border-brand-400/50 transition-all"
              onClick={() => {
                if (url) setActiveImage(att)
              }}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={kind === 'bill' ? 'Bill receipt' : 'Payment screenshot'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/40">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}

              {/* Status Overlay */}
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
                </div>
              )}

              {isFailed && (
                <div
                  className="absolute inset-0 bg-red-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-red-400 p-1 text-center"
                  title={att.uploadError || 'Upload failed'}
                >
                  <AlertCircle className="w-4 h-4 mb-0.5" />
                  <span className="text-[9px] font-bold">Failed</span>
                </div>
              )}

              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <ZoomIn className="w-4 h-4 text-white" />
              </div>
            </div>
          )
        })}

        {/* Upload Button */}
        {!readOnly && (
          <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-brand-400/50 w-16 h-16 flex-shrink-0 cursor-pointer transition-all text-white/60 hover:text-white">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
            {uploading ? (
              <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
            ) : (
              <>
                <Camera className="w-5 h-5 mb-0.5" />
                <span className="text-[10px] font-medium">{kind === 'bill' ? 'Add Bill' : 'Proof'}</span>
              </>
            )}
          </label>
        )}
      </div>

      {errorMsg && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {errorMsg}
        </p>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {activeImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
            onClick={() => setActiveImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative max-w-3xl w-full max-h-[90vh] bg-surface-900 border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-brand-400" />
                  <span className="text-sm font-semibold text-white">
                    {activeImage.kind === 'bill' ? 'Bill / Receipt' : 'Payment Screenshot'}
                  </span>
                  <span className="text-xs text-white/50">
                    ({new Date(activeImage.createdAt).toLocaleDateString()})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getSourceUrl(activeImage) && (
                    <a
                      href={getSourceUrl(activeImage)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                      title="Open full image in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {!readOnly && (
                    <button
                      onClick={() => handleDelete(activeImage)}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      title="Delete photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setActiveImage(null)}
                    className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Image Content */}
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40 min-h-[300px]">
                {getSourceUrl(activeImage) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getSourceUrl(activeImage)!}
                    alt="Receipt preview"
                    className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-lg"
                  />
                ) : (
                  <p className="text-sm text-white/50">Image unavailable</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
