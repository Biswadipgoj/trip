import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Linking,
  Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import QRCode from 'qrcode'
import { Image } from 'expo-image'
import {
  ArrowLeft,
  Copy,
  Zap,
  CheckCircle,
  CreditCard,
  ExternalLink,
} from 'lucide-react-native'
import { useStore } from '../lib/store'
import { Colors } from '../theme/colors'
import { Typography } from '../theme/typography'
import { SpringPressable } from '../components/animated/SpringPressable'
import { GlassCard } from '../components/ui/GlassCard'
import { formatCurrency, buildUpiLink } from '../lib/utils'

export default function PaymentModalScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    fromId: string
    toId: string
    amount: string
    fromName: string
    toName: string
    toUpi: string
  }>()

  const activeTrip = useStore(state => state.getActiveTrip())
  const tripId = activeTrip?.id || ''
  const updateSettlementStatus = useStore(state => state.updateSettlementStatus)

  const amount = parseFloat(params.amount || '0')
  const toName = params.toName || 'Recipient'
  const fromName = params.fromName || 'Payer'
  const toUpi = params.toUpi || ''

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const upiLink = toUpi
    ? buildUpiLink(
        toUpi,
        toName,
        amount,
        `TripMate settlement for ${activeTrip?.name || 'trip'}`
      )
    : ''

  // Generate QR code data URL
  useEffect(() => {
    if (upiLink) {
      QRCode.toDataURL(upiLink, {
        width: 260,
        margin: 1,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.warn('QR generation error:', err))
    }
  }, [upiLink])

  // Copy UPI ID
  const handleCopyUpi = async () => {
    if (!toUpi) return
    await Clipboard.setStringAsync(toUpi)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Alert.alert('Copied! 📋', `UPI ID "${toUpi}" copied to clipboard.`)
  }

  // Launch Native UPI Intent
  const handlePayNative = async () => {
    if (!upiLink) {
      Alert.alert(
        'No UPI ID',
        `${toName} has not added their UPI ID yet. You can ask them to update it in the Members tab.`
      )
      return
    }

    try {
      const supported = await Linking.canOpenURL(upiLink)
      if (supported) {
        await Linking.openURL(upiLink)
      } else {
        // Fallback: try opening anyway or prompt user
        await Linking.openURL(upiLink).catch(() => {
          Alert.alert(
            'UPI App Not Found',
            'No compatible UPI payment app (Google Pay, PhonePe, Paytm, BHIM) was detected. Please copy the UPI ID or scan the QR code.'
          )
        })
      }
    } catch {
      Alert.alert(
        'UPI Error',
        'Could not open payment app automatically. Please copy the UPI ID or scan the QR code.'
      )
    }
  }

  // Mark as Paid
  const handleMarkAsPaid = () => {
    updateSettlementStatus(
      {
        id: '',
        fromMemberId: params.fromId || '',
        toMemberId: params.toId || '',
        fromName,
        toName,
        fromColor: '',
        toColor: '',
        amount,
      },
      tripId,
      'paid'
    )
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Alert.alert('Payment Recorded! 💸', 'Waiting for recipient to confirm.')
    router.back()
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <SpringPressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={22} color={Colors.text} />
        </SpringPressable>
        <Text style={styles.headerTitle}>Settle Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Card */}
        <LinearGradient
          colors={Colors.gradients.sunset}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <Text style={styles.bannerLabel}>Transfer Amount</Text>
          <Text style={styles.bannerAmount}>{formatCurrency(amount)}</Text>
          <Text style={styles.bannerTransfer}>
            From <Text style={{ fontWeight: '800' }}>{fromName}</Text> to{' '}
            <Text style={{ fontWeight: '800' }}>{toName}</Text>
          </Text>
        </LinearGradient>

        {/* UPI Details Card */}
        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <CreditCard size={18} color="#6366F1" />
            <Text style={styles.cardTitle}>Recipient's UPI ID</Text>
          </View>

          {toUpi ? (
            <View style={styles.upiBox}>
              <Text style={styles.upiIdText} numberOfLines={1}>
                {toUpi}
              </Text>
              <SpringPressable
                style={styles.copyButton}
                onPress={handleCopyUpi}
              >
                <Copy size={16} color="#6366F1" />
                <Text style={styles.copyText}>Copy</Text>
              </SpringPressable>
            </View>
          ) : (
            <View style={styles.noUpiBox}>
              <Text style={styles.noUpiText}>
                ⚠️ {toName} has not provided a UPI ID.
              </Text>
              <Text style={styles.noUpiSub}>
                You can settle in cash or ask them to add their UPI ID in the
                Members tab.
              </Text>
            </View>
          )}

          {/* QR Code Container */}
          {qrDataUrl && (
            <View style={styles.qrSection}>
              <Text style={styles.qrPrompt}>
                Scan with any UPI App (GPay, PhonePe, Paytm, BHIM)
              </Text>
              <View style={styles.qrWrapper}>
                <Image
                  source={{ uri: qrDataUrl }}
                  style={styles.qrImage}
                  contentFit="contain"
                />
              </View>
            </View>
          )}
        </GlassCard>

        {/* 1-Tap Pay Native Button */}
        {toUpi && (
          <SpringPressable
            style={styles.payNativeButton}
            onPress={handlePayNative}
          >
            <LinearGradient
              colors={Colors.gradients.ocean}
              style={styles.payNativeGradient}
            >
              <Zap size={20} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.payNativeText}>
                Open UPI App & Pay {formatCurrency(amount)}
              </Text>
              <ExternalLink size={16} color="#FFFFFF" />
            </LinearGradient>
          </SpringPressable>
        )}

        {/* Mark as Paid Action Button */}
        <SpringPressable
          style={styles.markPaidBtn}
          onPress={handleMarkAsPaid}
        >
          <CheckCircle size={18} color="#059669" />
          <Text style={styles.markPaidBtnText}>
            I Have Already Paid / Settle Manually
          </Text>
        </SpringPressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroBanner: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  bannerLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    marginBottom: 4,
  },
  bannerAmount: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  bannerTransfer: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 2,
  },
  card: {
    marginBottom: 16,
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    ...Typography.h4,
    color: Colors.text,
  },
  upiBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  upiIdText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4F46E5',
    flex: 1,
    marginRight: 8,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  copyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
  noUpiBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginBottom: 16,
  },
  noUpiText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 4,
  },
  noUpiSub: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  qrSection: {
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  qrPrompt: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 14,
    textAlign: 'center',
  },
  qrWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  payNativeButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#4E65FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  payNativeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  payNativeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  markPaidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 8,
  },
  markPaidBtnText: {
    color: '#15803D',
    fontSize: 14,
    fontWeight: '700',
  },
})
