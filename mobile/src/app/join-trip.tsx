import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowLeft, Users, Key, User, Phone, Lock, CreditCard } from 'lucide-react-native'
import { useStore } from '../lib/store'
import { Colors } from '../theme/colors'
import { Typography } from '../theme/typography'
import { SpringPressable } from '../components/animated/SpringPressable'
import { GlassCard } from '../components/ui/GlassCard'
import { parseInviteToken } from '../lib/utils'

export default function JoinTripScreen() {
  const router = useRouter()
  const joinTrip = useStore(state => state.joinTrip)
  const trips = useStore(state => state.trips)

  const [tripInput, setTripInput] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [pin, setPin] = useState('')
  const [upiId, setUpiId] = useState('')
  const [loading, setLoading] = useState(false)

  // Smart code extraction (handles raw code "TRP-ABCD", short url "?c=TRP-ABCD", or base64 token)
  const extractCode = (input: string): string => {
    const raw = input.trim()
    if (!raw) return ''

    // 1. If it's a short URL or contains ?c=
    const cMatch = raw.match(/[?&]c=([A-Za-z0-9-]+)/i)
    if (cMatch && cMatch[1]) return cMatch[1].toUpperCase()

    // 2. If it contains ?code=
    const codeMatch = raw.match(/[?&]code=([A-Za-z0-9-]+)/i)
    if (codeMatch && codeMatch[1]) return codeMatch[1].toUpperCase()

    // 3. If it contains ?invite=
    const inviteMatch = raw.match(/[?&]invite=([^&\s]+)/i)
    if (inviteMatch && inviteMatch[1]) {
      const parsed = parseInviteToken(inviteMatch[1])
      if (parsed.ok && parsed.payload?.trip?.tripCode) {
        return parsed.payload.trip.tripCode.toUpperCase()
      }
    }

    // 4. Default: strip spaces and take code
    return raw.replace(/[^A-Za-z0-9-]/g, '').toUpperCase()
  }

  const handleJoin = () => {
    const code = extractCode(tripInput)
    if (!code) {
      Alert.alert('Trip Code Required', 'Please enter or paste the 6-character trip code.')
      return
    }
    if (!password.trim()) {
      Alert.alert('Password Required', 'Please enter the trip password / PIN provided by the organizer.')
      return
    }
    if (!name.trim()) {
      Alert.alert('Your Name Required', 'Please enter your name.')
      return
    }
    if (!mobile.trim() || mobile.trim().length < 10) {
      Alert.alert('Valid Mobile Required', 'Please enter a valid 10-digit mobile number.')
      return
    }
    if (!pin.trim() || pin.trim().length < 4) {
      Alert.alert('4-Digit PIN Required', 'Please enter a 4-digit PIN for your profile.')
      return
    }

    setLoading(true)
    const res = joinTrip({
      tripCode: code,
      password: password.trim(),
      name: name.trim(),
      mobile: mobile.trim(),
      pin: pin.trim(),
      upiId: upiId.trim() || undefined,
    })

    setLoading(false)

    if (!res.ok) {
      Alert.alert('Could Not Join', res.error || 'Trip not found or incorrect password.')
      return
    }

    router.replace('/(tabs)/dashboard')
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <SpringPressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={22} color={Colors.text} />
          </SpringPressable>
          <Text style={styles.headerTitle}>Join Trip</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Banner */}
          <LinearGradient
            colors={Colors.gradients.ocean}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <View style={styles.bannerIconBox}>
              <Users size={24} color="#4E65FF" />
            </View>
            <Text style={styles.bannerTitle}>Join Your Crew 🌴</Text>
            <Text style={styles.bannerSub}>
              Enter the trip code or paste the invite link shared by your friend.
            </Text>
          </LinearGradient>

          {/* Trip Pass Card */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardSectionTitle}>🔑 Trip Credentials</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Trip Code or Invite Link *</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, { letterSpacing: 1, fontWeight: '700' }]}
                  placeholder="e.g. TRP-ABCD or paste link"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                  value={tripInput}
                  onChangeText={setTripInput}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Trip Password *</Text>
              <View style={styles.inputContainer}>
                <Key size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter trip password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </View>
          </GlassCard>

          {/* Member Profile Card */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardSectionTitle}>👤 Your Info</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Name *</Text>
              <View style={styles.inputContainer}>
                <User size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Your full name"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Number *</Text>
              <View style={styles.inputContainer}>
                <Phone size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="10-digit mobile"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={mobile}
                  onChangeText={setMobile}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your 4-Digit Security PIN *</Text>
              <View style={styles.inputContainer}>
                <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                  value={pin}
                  onChangeText={setPin}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>UPI ID (for payments & receiving)</Text>
              <View style={styles.inputContainer}>
                <CreditCard size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. name@upi"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  value={upiId}
                  onChangeText={setUpiId}
                />
              </View>
            </View>
          </GlassCard>

          {/* Join Button */}
          <SpringPressable
            style={styles.submitButton}
            onPress={handleJoin}
            disabled={loading}
          >
            <LinearGradient
              colors={Colors.gradients.ocean}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGradient}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Joining Trip...' : 'Enter Trip 🚀'}
              </Text>
            </LinearGradient>
          </SpringPressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
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
  banner: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#4E65FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  bannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  bannerTitle: {
    ...Typography.h2,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.95)',
    lineHeight: 18,
  },
  card: {
    marginBottom: 16,
    padding: 18,
  },
  cardSectionTitle: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    height: '100%',
  },
  submitButton: {
    borderRadius: 20,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: '#4E65FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
})
