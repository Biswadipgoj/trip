import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Lock, CheckCircle2 } from 'lucide-react-native'
import { useStore } from '../lib/store'
import { Colors } from '../theme/colors'
import { Typography } from '../theme/typography'
import { SpringPressable } from '../components/animated/SpringPressable'
import { Avatar } from '../components/ui/Avatar'
import { Member } from '../types'

export default function LoginScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ tripId: string }>()
  const tripId = params.tripId

  const trips = useStore(state => state.trips)
  const members = useStore(state => state.members)
  const setSession = useStore(state => state.setSession)

  const trip = trips.find(t => t.id === tripId)
  const tripMembers = members.filter(m => m.tripId === tripId)

  const [selectedMember, setSelectedMember] = useState<Member | null>(
    tripMembers[0] || null
  )
  const [pin, setPin] = useState('')

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit
      setPin(nextPin)

      // Auto submit on 4th digit
      if (nextPin.length === 4) {
        verifyPin(nextPin)
      }
    }
  }

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1))
  }

  const verifyPin = (enteredPin: string) => {
    if (!selectedMember || !trip) return

    if (selectedMember.pin === enteredPin) {
      setSession({
        tripId: trip.id,
        memberId: selectedMember.id,
        tripCode: trip.tripCode,
      })
      router.replace('/(tabs)/dashboard')
    } else {
      Alert.alert('Incorrect PIN', 'The PIN entered is incorrect. Please try again.')
      setPin('')
    }
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
        <Text style={styles.headerTitle}>{trip?.name || 'Enter Trip'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>Select who is using this device:</Text>

        {/* Member Selector Chips */}
        <View style={styles.memberChipsContainer}>
          {tripMembers.map(m => {
            const isSelected = selectedMember?.id === m.id
            return (
              <SpringPressable
                key={m.id}
                style={[
                  styles.memberChip,
                  isSelected && styles.memberChipSelected,
                ]}
                onPress={() => {
                  setSelectedMember(m)
                  setPin('')
                }}
              >
                <Avatar name={m.name} color={m.avatarColor} size={36} />
                <Text
                  style={[
                    styles.memberName,
                    isSelected && styles.memberNameSelected,
                  ]}
                  numberOfLines={1}
                >
                  {m.name}
                </Text>
                {isSelected && (
                  <CheckCircle2 size={16} color="#6366F1" style={{ marginLeft: 4 }} />
                )}
              </SpringPressable>
            )
          })}
        </View>

        {/* PIN Security Section */}
        <View style={styles.pinSection}>
          <View style={styles.lockIconBox}>
            <Lock size={22} color="#6366F1" />
          </View>
          <Text style={styles.pinPrompt}>
            Enter 4-digit PIN for {selectedMember?.name || 'User'}
          </Text>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map(idx => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx < pin.length && styles.dotFilled,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Custom Touch Keypad */}
        <View style={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, i) => {
            if (key === '') {
              return <View key={i} style={styles.keyEmpty} />
            }
            if (key === '⌫') {
              return (
                <SpringPressable
                  key={i}
                  style={styles.key}
                  onPress={handleDelete}
                >
                  <Text style={styles.keyText}>{key}</Text>
                </SpringPressable>
              )
            }
            return (
              <SpringPressable
                key={i}
                style={styles.key}
                onPress={() => handleKeyPress(key)}
              >
                <Text style={styles.keyText}>{key}</Text>
              </SpringPressable>
            )
          })}
        </View>
      </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  instruction: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
    fontWeight: '500',
  },
  memberChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: 160,
  },
  memberChipSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
  },
  memberNameSelected: {
    color: '#6366F1',
  },
  pinSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  lockIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  pinPrompt: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  dotFilled: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'space-between',
    gap: 14,
    marginTop: 'auto',
    marginBottom: 20,
  },
  key: {
    width: 76,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#475569',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  keyEmpty: {
    width: 76,
    height: 64,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
})
