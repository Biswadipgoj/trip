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
import { ArrowLeft, Sparkles, Compass, User, Phone, Lock, CreditCard } from 'lucide-react-native'
import { useStore } from '../lib/store'
import { Colors } from '../theme/colors'
import { Typography } from '../theme/typography'
import { SpringPressable } from '../components/animated/SpringPressable'
import { GlassCard } from '../components/ui/GlassCard'

export default function CreateTripScreen() {
  const router = useRouter()
  const createTrip = useStore(state => state.createTrip)

  const [tripName, setTripName] = useState('')
  const [budget, setBudget] = useState('')
  const [creatorName, setCreatorName] = useState('')
  const [creatorMobile, setCreatorMobile] = useState('')
  const [creatorPin, setCreatorPin] = useState('')
  const [creatorUpi, setCreatorUpi] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = () => {
    if (!tripName.trim()) {
      Alert.alert('Trip Name Required', 'Please enter a name for your trip.')
      return
    }
    if (!creatorName.trim()) {
      Alert.alert('Your Name Required', 'Please enter your name.')
      return
    }
    if (!creatorMobile.trim() || creatorMobile.trim().length < 10) {
      Alert.alert('Valid Mobile Required', 'Please enter a valid 10-digit mobile number.')
      return
    }
    if (!creatorPin.trim() || creatorPin.trim().length < 4) {
      Alert.alert('4-Digit PIN Required', 'Please set a 4-digit security PIN to protect your profile.')
      return
    }

    setLoading(true)
    try {
      createTrip({
        name: tripName,
        password: creatorPin, // Trip default password matches creator PIN
        creatorName,
        creatorMobile,
        creatorPin,
        creatorUpi: creatorUpi.trim() || undefined,
        budget: budget ? parseFloat(budget) : undefined,
      })

      router.replace('/(tabs)/dashboard')
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create trip')
    } finally {
      setLoading(false)
    }
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
          <Text style={styles.headerTitle}>Create New Trip</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Banner */}
          <LinearGradient
            colors={Colors.gradients.sunset}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <View style={styles.bannerIconBox}>
              <Sparkles size={24} color="#FF6B6B" />
            </View>
            <Text style={styles.bannerTitle}>Start an Adventure ✈️</Text>
            <Text style={styles.bannerSub}>
              Set up your trip details. You'll get a unique code to invite friends!
            </Text>
          </LinearGradient>

          {/* Trip Details Card */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardSectionTitle}>📍 Trip Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Trip Name *</Text>
              <View style={styles.inputContainer}>
                <Compass size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Manali Snow Trip 2026"
                  placeholderTextColor={Colors.textMuted}
                  value={tripName}
                  onChangeText={setTripName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Target Budget (Optional ₹)</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 50000"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={budget}
                  onChangeText={setBudget}
                />
              </View>
            </View>
          </GlassCard>

          {/* Creator Profile Card */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardSectionTitle}>👤 Your Profile (Organizer)</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Name *</Text>
              <View style={styles.inputContainer}>
                <User size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Your full name"
                  placeholderTextColor={Colors.textMuted}
                  value={creatorName}
                  onChangeText={setCreatorName}
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
                  value={creatorMobile}
                  onChangeText={setCreatorMobile}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>4-Digit Security PIN *</Text>
              <View style={styles.inputContainer}>
                <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                  value={creatorPin}
                  onChangeText={setCreatorPin}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>UPI ID (for receiving payments)</Text>
              <View style={styles.inputContainer}>
                <CreditCard size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. yourname@okhdfcbank"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  value={creatorUpi}
                  onChangeText={setCreatorUpi}
                />
              </View>
            </View>
          </GlassCard>

          {/* Submit Button */}
          <SpringPressable
            style={styles.submitButton}
            onPress={handleCreate}
            disabled={loading}
          >
            <LinearGradient
              colors={Colors.gradients.sunset}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGradient}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Creating Trip...' : 'Create & Launch Trip 🚀'}
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
    shadowColor: '#FF6B6B',
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
  currencySymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textMuted,
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
    shadowColor: '#FF6B6B',
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
