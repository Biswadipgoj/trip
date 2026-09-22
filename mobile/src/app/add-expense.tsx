import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowLeft,
  Receipt,
  Users,
  Check,
} from 'lucide-react-native'
import { useStore } from '../lib/store'
import { Colors } from '../theme/colors'
import { Typography } from '../theme/typography'
import { SpringPressable } from '../components/animated/SpringPressable'
import { GlassCard } from '../components/ui/GlassCard'
import { Avatar } from '../components/ui/Avatar'
import {
  formatCurrency,
  SUBCATEGORIES,
  getCategoryIcon,
  getCategoryLabel,
  getSplitTypeIcon,
  getSplitTypeLabel,
  distributeEqually,
} from '../lib/utils'
import { ExpenseCategory, SplitType, ParticipantSplit } from '../types'

const CATEGORY_LIST: ExpenseCategory[] = [
  'food', 'travel', 'stay', 'entertainment', 'shopping', 'alcohol', 'fuel', 'tickets', 'misc'
]

const SPLIT_TYPES: SplitType[] = ['equal', 'custom', 'percentage', 'quantity']

export default function AddExpenseScreen() {
  const router = useRouter()
  const activeTrip = useStore(state => state.getActiveTrip())
  const currentMember = useStore(state => state.getCurrentMember())
  const tripId = activeTrip?.id || ''

  const members = useStore(state => state.getTripMembers(tripId))
  const addExpense = useStore(state => state.addExpense)

  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('food')
  const [subcategory, setSubcategory] = useState<string | undefined>(undefined)
  const [paidBy, setPaidBy] = useState<string>(currentMember?.id || members[0]?.id || '')

  // Participants (default: all members)
  const [participants, setParticipants] = useState<string[]>(members.map(m => m.id))

  // Split type
  const [splitType, setSplitType] = useState<SplitType>('equal')
  // Map of memberId -> string input for custom / % / qty
  const [customValues, setCustomValues] = useState<Record<string, string>>({})

  const totalAmount = parseFloat(amountStr) || 0

  // Live calculated shares preview
  const previewShares = useMemo(() => {
    const shares: Record<string, number> = {}
    if (participants.length === 0 || totalAmount <= 0) return shares

    if (splitType === 'equal') {
      distributeEqually(totalAmount, participants, shares)
    } else if (splitType === 'custom') {
      participants.forEach(pid => {
        shares[pid] = parseFloat(customValues[pid] || '0') || 0
      })
    } else if (splitType === 'percentage') {
      participants.forEach(pid => {
        const pct = parseFloat(customValues[pid] || '0') || 0
        shares[pid] = Math.round(((pct / 100) * totalAmount) * 100) / 100
      })
    } else if (splitType === 'quantity') {
      const totalUnits = participants.reduce(
        (sum, pid) => sum + (parseFloat(customValues[pid] || '0') || 0),
        0
      )
      if (totalUnits > 0) {
        participants.forEach(pid => {
          const qty = parseFloat(customValues[pid] || '0') || 0
          shares[pid] = Math.round(((qty / totalUnits) * totalAmount) * 100) / 100
        })
      }
    }
    return shares
  }, [totalAmount, participants, splitType, customValues])

  const handleToggleParticipant = (memberId: string) => {
    if (participants.includes(memberId)) {
      if (participants.length === 1) {
        Alert.alert('Required', 'At least one participant must share the expense.')
        return
      }
      setParticipants(prev => prev.filter(id => id !== memberId))
    } else {
      setParticipants(prev => [...prev, memberId])
    }
  }

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a description for this expense.')
      return
    }
    if (totalAmount <= 0) {
      Alert.alert('Valid Amount Required', 'Please enter an amount greater than ₹0.')
      return
    }
    if (participants.length === 0) {
      Alert.alert('Select Participants', 'At least one member must share this expense.')
      return
    }

    // Validation for custom / percentage
    const splits: ParticipantSplit[] = []
    if (splitType === 'custom') {
      const sum = participants.reduce(
        (s, pid) => s + (parseFloat(customValues[pid] || '0') || 0),
        0
      )
      if (Math.abs(sum - totalAmount) > 0.05) {
        Alert.alert(
          'Split Mismatch',
          `The custom amounts sum to ${formatCurrency(sum)}, but the total is ${formatCurrency(
            totalAmount
          )}.`
        )
        return
      }
      participants.forEach(pid => {
        splits.push({
          memberId: pid,
          value: parseFloat(customValues[pid] || '0') || 0,
        })
      })
    } else if (splitType === 'percentage') {
      const totalPct = participants.reduce(
        (s, pid) => s + (parseFloat(customValues[pid] || '0') || 0),
        0
      )
      if (Math.abs(totalPct - 100) > 0.1) {
        Alert.alert(
          'Percentage Mismatch',
          `The percentages sum to ${totalPct.toFixed(1)}%. They must equal 100%.`
        )
        return
      }
      participants.forEach(pid => {
        splits.push({
          memberId: pid,
          value: parseFloat(customValues[pid] || '0') || 0,
        })
      })
    } else if (splitType === 'quantity') {
      participants.forEach(pid => {
        splits.push({
          memberId: pid,
          value: parseFloat(customValues[pid] || '0') || 0,
        })
      })
    }

    addExpense({
      tripId,
      title: title.trim(),
      amount: totalAmount,
      paidBy,
      category,
      subcategory,
      participants,
      splitType,
      splits,
    })

    router.back()
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
          <Text style={styles.headerTitle}>Add Expense</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Details Card */}
          <GlassCard style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>What was it for? *</Text>
              <TextInput
                style={styles.titleInput}
                placeholder="e.g. Seafood Dinner at Brittos"
                placeholderTextColor={Colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.amountInputRow}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={amountStr}
                onChangeText={setAmountStr}
              />
            </View>
          </GlassCard>

          {/* Category Picker */}
          <GlassCard style={styles.card}>
            <Text style={styles.sectionTitle}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catRow}
            >
              {CATEGORY_LIST.map(cat => {
                const isSelected = category === cat
                return (
                  <SpringPressable
                    key={cat}
                    style={[
                      styles.categoryButton,
                      isSelected && styles.categoryButtonActive,
                    ]}
                    onPress={() => {
                      setCategory(cat)
                      setSubcategory(undefined)
                    }}
                  >
                    <Text style={styles.categoryEmoji}>{getCategoryIcon(cat)}</Text>
                    <Text
                      style={[
                        styles.categoryLabel,
                        isSelected && styles.categoryLabelActive,
                      ]}
                    >
                      {getCategoryLabel(cat)}
                    </Text>
                  </SpringPressable>
                )
              })}
            </ScrollView>

            {/* Subcategories if any */}
            {SUBCATEGORIES[category] && (
              <View style={styles.subcatContainer}>
                <Text style={styles.subcatHeading}>Subcategory</Text>
                <View style={styles.subcatRow}>
                  {SUBCATEGORIES[category].map(sub => {
                    const isSelected = subcategory === sub.id
                    return (
                      <SpringPressable
                        key={sub.id}
                        style={[
                          styles.subcatChip,
                          isSelected && styles.subcatChipActive,
                        ]}
                        onPress={() => setSubcategory(sub.id)}
                      >
                        <Text style={styles.subcatIcon}>{sub.icon}</Text>
                        <Text
                          style={[
                            styles.subcatText,
                            isSelected && styles.subcatTextActive,
                          ]}
                        >
                          {sub.label}
                        </Text>
                      </SpringPressable>
                    )
                  })}
                </View>
              </View>
            )}
          </GlassCard>

          {/* Paid By Picker */}
          <GlassCard style={styles.card}>
            <Text style={styles.sectionTitle}>Who Paid?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.payerScroll}
            >
              {members.map(m => {
                const isPayer = paidBy === m.id
                return (
                  <SpringPressable
                    key={m.id}
                    style={[
                      styles.payerCard,
                      isPayer && styles.payerCardActive,
                    ]}
                    onPress={() => setPaidBy(m.id)}
                  >
                    <Avatar name={m.name} color={m.avatarColor} size={36} />
                    <Text
                      style={[
                        styles.payerName,
                        isPayer && styles.payerNameActive,
                      ]}
                      numberOfLines={1}
                    >
                      {m.name}
                    </Text>
                    {isPayer && <Check size={14} color="#6366F1" />}
                  </SpringPressable>
                )
              })}
            </ScrollView>
          </GlassCard>

          {/* Split Type Selector */}
          <GlassCard style={styles.card}>
            <Text style={styles.sectionTitle}>Split Method</Text>
            <View style={styles.splitTypeGrid}>
              {SPLIT_TYPES.map(type => {
                const isSelected = splitType === type
                return (
                  <SpringPressable
                    key={type}
                    style={[
                      styles.splitTypeCard,
                      isSelected && styles.splitTypeCardActive,
                    ]}
                    onPress={() => setSplitType(type)}
                  >
                    <Text style={styles.splitIcon}>{getSplitTypeIcon(type)}</Text>
                    <Text
                      style={[
                        styles.splitLabel,
                        isSelected && styles.splitLabelActive,
                      ]}
                    >
                      {getSplitTypeLabel(type)}
                    </Text>
                  </SpringPressable>
                )
              })}
            </View>

            {/* Participants Checklist with calculated shares */}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
              Split Among ({participants.length} selected)
            </Text>

            {members.map(member => {
              const isIncluded = participants.includes(member.id)
              const share = previewShares[member.id] || 0

              return (
                <View key={member.id} style={styles.participantRow}>
                  <SpringPressable
                    style={styles.participantLeft}
                    onPress={() => handleToggleParticipant(member.id)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isIncluded && styles.checkboxActive,
                      ]}
                    >
                      {isIncluded && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <Avatar name={member.name} color={member.avatarColor} size={32} />
                    <Text style={styles.participantName}>{member.name}</Text>
                  </SpringPressable>

                  {/* Input for custom / % / qty */}
                  {isIncluded && (
                    <View style={styles.participantRight}>
                      {splitType === 'equal' && (
                        <Text style={styles.previewShareText}>
                          {formatCurrency(share)}
                        </Text>
                      )}

                      {splitType === 'custom' && (
                        <View style={styles.splitInputContainer}>
                          <Text style={styles.inputPrefix}>₹</Text>
                          <TextInput
                            style={styles.splitInput}
                            placeholder="0"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="numeric"
                            value={customValues[member.id] || ''}
                            onChangeText={v =>
                              setCustomValues(prev => ({ ...prev, [member.id]: v }))
                            }
                          />
                        </View>
                      )}

                      {splitType === 'percentage' && (
                        <View style={styles.splitInputContainer}>
                          <TextInput
                            style={styles.splitInput}
                            placeholder="0"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="numeric"
                            value={customValues[member.id] || ''}
                            onChangeText={v =>
                              setCustomValues(prev => ({ ...prev, [member.id]: v }))
                            }
                          />
                          <Text style={styles.inputSuffix}>%</Text>
                        </View>
                      )}

                      {splitType === 'quantity' && (
                        <View style={styles.splitInputContainer}>
                          <TextInput
                            style={styles.splitInput}
                            placeholder="1"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="numeric"
                            value={customValues[member.id] || ''}
                            onChangeText={v =>
                              setCustomValues(prev => ({ ...prev, [member.id]: v }))
                            }
                          />
                          <Text style={styles.inputSuffix}>qty</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )
            })}
          </GlassCard>

          {/* Submit Button */}
          <SpringPressable style={styles.submitBtn} onPress={handleSave}>
            <LinearGradient
              colors={Colors.gradients.sunset}
              style={styles.submitGradient}
            >
              <Text style={styles.submitText}>Save Expense 💸</Text>
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
  card: {
    marginBottom: 16,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    paddingVertical: 6,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FF6B6B',
    marginRight: 8,
  },
  amountInput: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.text,
    flex: 1,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: 12,
  },
  catRow: {
    gap: 10,
  },
  categoryButton: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 80,
  },
  categoryButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  categoryEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryLabelActive: {
    color: '#6366F1',
    fontWeight: '700',
  },
  subcatContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  subcatHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  subcatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subcatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  subcatChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  subcatIcon: {
    fontSize: 12,
  },
  subcatText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  subcatTextActive: {
    color: '#6366F1',
  },
  payerScroll: {
    gap: 10,
  },
  payerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  payerCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  payerName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  payerNameActive: {
    color: '#6366F1',
    fontWeight: '700',
  },
  splitTypeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  splitTypeCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  splitTypeCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  splitIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  splitLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  splitLabelActive: {
    color: '#6366F1',
    fontWeight: '700',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  participantName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  participantRight: {
    minWidth: 90,
    alignItems: 'flex-end',
  },
  previewShareText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  splitInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 36,
  },
  inputPrefix: {
    fontSize: 13,
    color: Colors.textMuted,
    marginRight: 4,
  },
  inputSuffix: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 4,
  },
  splitInput: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    width: 50,
    textAlign: 'center',
    padding: 0,
  },
  submitBtn: {
    borderRadius: 20,
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
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
})
