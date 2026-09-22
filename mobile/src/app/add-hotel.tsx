import React, { useState } from 'react'
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
  Hotel,
  Plus,
  Trash2,
  Check,
} from 'lucide-react-native'
import { useStore } from '../lib/store'
import { Colors } from '../theme/colors'
import { Typography } from '../theme/typography'
import { SpringPressable } from '../components/animated/SpringPressable'
import { GlassCard } from '../components/ui/GlassCard'
import { Avatar } from '../components/ui/Avatar'
import { formatCurrency } from '../lib/utils'

interface RoomInput {
  id: string
  name: string
  costStr: string
  occupantIds: string[]
}

export default function AddHotelScreen() {
  const router = useRouter()
  const activeTrip = useStore(state => state.getActiveTrip())
  const currentMember = useStore(state => state.getCurrentMember())
  const tripId = activeTrip?.id || ''

  const members = useStore(state => state.getTripMembers(tripId))
  const addHotelExpense = useStore(state => state.addHotelExpense)

  const [title, setTitle] = useState('')
  const [paidBy, setPaidBy] = useState<string>(currentMember?.id || members[0]?.id || '')

  const [rooms, setRooms] = useState<RoomInput[]>([
    {
      id: '1',
      name: 'Room 101',
      costStr: '',
      occupantIds: members.slice(0, 2).map(m => m.id),
    },
  ])

  const totalCost = rooms.reduce((sum, r) => sum + (parseFloat(r.costStr) || 0), 0)

  const handleAddRoom = () => {
    const nextNum = rooms.length + 1
    setRooms(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: `Room ${nextNum}`,
        costStr: '',
        occupantIds: [],
      },
    ])
  }

  const handleDeleteRoom = (roomId: string) => {
    if (rooms.length === 1) {
      Alert.alert('Required', 'A hotel booking must have at least one room.')
      return
    }
    setRooms(prev => prev.filter(r => r.id !== roomId))
  }

  const handleToggleOccupant = (roomId: string, memberId: string) => {
    setRooms(prev =>
      prev.map(r => {
        if (r.id !== roomId) return r
        const isOccupant = r.occupantIds.includes(memberId)
        return {
          ...r,
          occupantIds: isOccupant
            ? r.occupantIds.filter(id => id !== memberId)
            : [...r.occupantIds, memberId],
        }
      })
    )
  }

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Hotel Name Required', 'Please enter a name for the hotel/stay.')
      return
    }
    if (totalCost <= 0) {
      Alert.alert('Cost Required', 'Please enter valid costs for the rooms.')
      return
    }

    // Validate that each room has cost and occupants
    for (const room of rooms) {
      const cost = parseFloat(room.costStr) || 0
      if (cost <= 0) {
        Alert.alert('Invalid Room Cost', `Please set a valid cost for ${room.name}.`)
        return
      }
      if (room.occupantIds.length === 0) {
        Alert.alert('No Occupants', `Please assign at least one occupant to ${room.name}.`)
        return
      }
    }

    addHotelExpense({
      tripId,
      title: title.trim(),
      paidBy,
      rooms: rooms.map(r => ({
        name: r.name.trim(),
        cost: parseFloat(r.costStr) || 0,
        occupantIds: r.occupantIds,
      })),
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
          <Text style={styles.headerTitle}>Hotel & Rooms</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Banner */}
          <LinearGradient
            colors={Colors.gradients.mint}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <View style={styles.bannerIconBox}>
              <Hotel size={24} color="#10B981" />
            </View>
            <Text style={styles.bannerTitle}>Hotel & Resort Split 🏨</Text>
            <Text style={styles.bannerSub}>
              Each room's cost is divided only among the members staying in that
              room.
            </Text>
          </LinearGradient>

          {/* Hotel Name & Payer */}
          <GlassCard style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hotel / Resort Name *</Text>
              <TextInput
                style={styles.titleInput}
                placeholder="e.g. Taj Holiday Village"
                placeholderTextColor={Colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Who Paid the Hotel Bill?</Text>
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
                    <Avatar name={m.name} color={m.avatarColor} size={32} />
                    <Text
                      style={[
                        styles.payerName,
                        isPayer && styles.payerNameActive,
                      ]}
                      numberOfLines={1}
                    >
                      {m.name}
                    </Text>
                    {isPayer && <Check size={14} color="#10B981" />}
                  </SpringPressable>
                )
              })}
            </ScrollView>
          </GlassCard>

          {/* Rooms List */}
          <View style={styles.roomsHeader}>
            <Text style={styles.sectionTitle}>Rooms ({rooms.length})</Text>
            <Text style={styles.totalSumText}>
              Total: {formatCurrency(totalCost)}
            </Text>
          </View>

          {rooms.map((room, idx) => {
            const cost = parseFloat(room.costStr) || 0
            const perPerson =
              room.occupantIds.length > 0 ? cost / room.occupantIds.length : 0

            return (
              <GlassCard key={room.id} style={styles.roomCard}>
                <View style={styles.roomCardHeader}>
                  <TextInput
                    style={styles.roomNameInput}
                    value={room.name}
                    onChangeText={v =>
                      setRooms(prev =>
                        prev.map(r => (r.id === room.id ? { ...r, name: v } : r))
                      )
                    }
                  />

                  <SpringPressable
                    style={styles.deleteRoomBtn}
                    onPress={() => handleDeleteRoom(room.id)}
                  >
                    <Trash2 size={16} color="#94A3B8" />
                  </SpringPressable>
                </View>

                {/* Cost Input */}
                <View style={styles.roomCostRow}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.costInput}
                    placeholder="Room Cost (e.g. 3500)"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    value={room.costStr}
                    onChangeText={v =>
                      setRooms(prev =>
                        prev.map(r => (r.id === room.id ? { ...r, costStr: v } : r))
                      )
                    }
                  />
                  {perPerson > 0 && (
                    <Text style={styles.perPersonPill}>
                      {formatCurrency(perPerson)} / guest
                    </Text>
                  )}
                </View>

                {/* Occupant Checkboxes */}
                <Text style={styles.occupantsLabel}>Who is staying in this room?</Text>
                <View style={styles.occupantsGrid}>
                  {members.map(member => {
                    const isOccupant = room.occupantIds.includes(member.id)
                    return (
                      <SpringPressable
                        key={member.id}
                        style={[
                          styles.occupantChip,
                          isOccupant && styles.occupantChipActive,
                        ]}
                        onPress={() => handleToggleOccupant(room.id, member.id)}
                      >
                        <Avatar name={member.name} color={member.avatarColor} size={22} />
                        <Text
                          style={[
                            styles.occupantName,
                            isOccupant && styles.occupantNameActive,
                          ]}
                          numberOfLines={1}
                        >
                          {member.name}
                        </Text>
                        {isOccupant && <Check size={12} color="#10B981" />}
                      </SpringPressable>
                    )
                  })}
                </View>
              </GlassCard>
            )
          })}

          {/* Add Another Room Button */}
          <SpringPressable style={styles.addRoomButton} onPress={handleAddRoom}>
            <Plus size={18} color="#10B981" />
            <Text style={styles.addRoomText}>Add Another Room</Text>
          </SpringPressable>

          {/* Save Button */}
          <SpringPressable style={styles.submitBtn} onPress={handleSave}>
            <LinearGradient
              colors={Colors.gradients.mint}
              style={styles.submitGradient}
            >
              <Text style={styles.submitText}>Save Hotel Stay 🏨</Text>
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
  banner: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#10B981',
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
    padding: 16,
  },
  inputGroup: {
    marginBottom: 4,
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
  payerScroll: {
    gap: 10,
    paddingTop: 4,
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
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  payerName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  payerNameActive: {
    color: '#059669',
    fontWeight: '700',
  },
  roomsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  totalSumText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  roomCard: {
    marginBottom: 12,
    padding: 16,
  },
  roomCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  roomNameInput: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 4,
    minWidth: 120,
  },
  deleteRoomBtn: {
    padding: 4,
  },
  roomCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
    marginRight: 6,
  },
  costInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  perPersonPill: {
    backgroundColor: '#ECFDF5',
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  occupantsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  occupantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  occupantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  occupantChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  occupantName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  occupantNameActive: {
    color: '#059669',
    fontWeight: '700',
  },
  addRoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 16,
  },
  addRoomText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  submitBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#10B981',
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
