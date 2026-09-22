import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TextInput,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Plus, Search, Trash2, Hotel, Receipt, Filter } from 'lucide-react-native'
import { useStore } from '../../lib/store'
import { Colors } from '../../theme/colors'
import { Typography } from '../../theme/typography'
import { SpringPressable } from '../../components/animated/SpringPressable'
import { GlassCard } from '../../components/ui/GlassCard'
import { Avatar } from '../../components/ui/Avatar'
import { CategoryChip } from '../../components/ui/CategoryChip'
import {
  formatCurrency,
  formatDate,
  getSplitTypeIcon,
  getSplitTypeLabel,
  getCategoryIcon,
} from '../../lib/utils'
import { Expense, HotelExpense } from '../../types'

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'food', label: 'Food', icon: '🍽️' },
  { id: 'travel', label: 'Transit', icon: '✈️' },
  { id: 'stay', label: 'Stay', icon: '🏨' },
  { id: 'entertainment', label: 'Fun', icon: '🎭' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'alcohol', label: 'Drinks', icon: '🍺' },
  { id: 'fuel', label: 'Fuel', icon: '⛽' },
  { id: 'misc', label: 'Misc', icon: '📌' },
]

export default function ExpensesScreen() {
  const router = useRouter()
  const activeTrip = useStore(state => state.getActiveTrip())
  const tripId = activeTrip?.id || ''

  const expenses = useStore(state => state.getTripExpenses(tripId))
  const hotelExpenses = useStore(state => state.getTripHotelExpenses(tripId))
  const members = useStore(state => state.getTripMembers(tripId))
  const deleteExpense = useStore(state => state.deleteExpense)
  const deleteHotelExpense = useStore(state => state.deleteHotelExpense)

  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('all')
  const [activeTab, setActiveTab] = useState<'expenses' | 'hotels'>('expenses')

  // Fast memoized filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchCat = selectedCat === 'all' || e.category === selectedCat
      const matchQuery =
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        members
          .find(m => m.id === e.paidBy)
          ?.name.toLowerCase()
          .includes(search.toLowerCase())
      return matchCat && matchQuery
    })
  }, [expenses, selectedCat, search, members])

  const filteredHotels = useMemo(() => {
    return hotelExpenses.filter(h => {
      return (
        h.title.toLowerCase().includes(search.toLowerCase()) ||
        members
          .find(m => m.id === h.paidBy)
          ?.name.toLowerCase()
          .includes(search.toLowerCase())
      )
    })
  }, [hotelExpenses, search, members])

  const handleDeleteExpense = (id: string, title: string) => {
    Alert.alert('Delete Expense', `Are you sure you want to remove "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteExpense(id),
      },
    ])
  }

  const handleDeleteHotel = (id: string, title: string) => {
    Alert.alert('Delete Hotel Stay', `Are you sure you want to remove "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteHotelExpense(id),
      },
    ])
  }

  const renderExpenseItem = ({ item }: { item: Expense }) => {
    const payer = members.find(m => m.id === item.paidBy)
    const splitIcon = getSplitTypeIcon(item.splitType)
    const splitLabel = getSplitTypeLabel(item.splitType)

    return (
      <GlassCard style={styles.expenseCard}>
        <View style={styles.cardTopRow}>
          <CategoryChip category={item.category} subcategory={item.subcategory} size="sm" />
          <View style={styles.splitPill}>
            <Text style={styles.splitIcon}>{splitIcon}</Text>
            <Text style={styles.splitText}>{splitLabel}</Text>
          </View>
          <SpringPressable
            style={styles.deleteButton}
            onPress={() => handleDeleteExpense(item.id, item.title)}
          >
            <Trash2 size={16} color="#94A3B8" />
          </SpringPressable>
        </View>

        <View style={styles.cardCenterRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
        </View>

        <View style={styles.cardBottomRow}>
          <View style={styles.payerInfo}>
            <Avatar name={payer?.name || 'Member'} color={payer?.avatarColor} size={24} />
            <Text style={styles.payerText} numberOfLines={1}>
              Paid by <Text style={{ fontWeight: '700', color: Colors.text }}>{payer?.name || 'Unknown'}</Text>
            </Text>
          </View>
          <Text style={styles.participantsBadge}>
            👥 {item.participants.length} sharing
          </Text>
        </View>
      </GlassCard>
    )
  }

  const renderHotelItem = ({ item }: { item: HotelExpense }) => {
    const payer = members.find(m => m.id === item.paidBy)
    const totalOccupants = item.rooms.reduce((s, r) => s + r.occupantIds.length, 0)

    return (
      <GlassCard style={styles.expenseCard}>
        <View style={styles.cardTopRow}>
          <View style={styles.hotelBadge}>
            <Hotel size={14} color="#10B981" />
            <Text style={styles.hotelBadgeText}>Hotel Booking</Text>
          </View>
          <View style={styles.splitPill}>
            <Text style={styles.splitIcon}>🛏️</Text>
            <Text style={styles.splitText}>{item.rooms.length} Rooms</Text>
          </View>
          <SpringPressable
            style={styles.deleteButton}
            onPress={() => handleDeleteHotel(item.id, item.title)}
          >
            <Trash2 size={16} color="#94A3B8" />
          </SpringPressable>
        </View>

        <View style={styles.cardCenterRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.itemAmount}>{formatCurrency(item.totalAmount)}</Text>
        </View>

        {/* Room details summary */}
        <View style={styles.roomsSummaryContainer}>
          {item.rooms.map(room => (
            <View key={room.id} style={styles.roomRow}>
              <Text style={styles.roomName}>{room.name} ({room.occupantIds.length} guests)</Text>
              <Text style={styles.roomCost}>{formatCurrency(room.cost)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardBottomRow}>
          <View style={styles.payerInfo}>
            <Avatar name={payer?.name || 'Member'} color={payer?.avatarColor} size={24} />
            <Text style={styles.payerText} numberOfLines={1}>
              Paid by <Text style={{ fontWeight: '700', color: Colors.text }}>{payer?.name || 'Unknown'}</Text>
            </Text>
          </View>
          <Text style={styles.participantsBadge}>
            👥 {totalOccupants} total guests
          </Text>
        </View>
      </GlassCard>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Expenses</Text>
        <Text style={styles.expenseCount}>
          {activeTab === 'expenses' ? expenses.length : hotelExpenses.length} entries
        </Text>
      </View>

      {/* Segment Tabs: Regular vs Hotel */}
      <View style={styles.tabsRow}>
        <SpringPressable
          style={[styles.tabButton, activeTab === 'expenses' && styles.tabButtonActive]}
          onPress={() => setActiveTab('expenses')}
        >
          <Receipt size={16} color={activeTab === 'expenses' ? '#6366F1' : Colors.textMuted} />
          <Text style={[styles.tabButtonText, activeTab === 'expenses' && styles.tabButtonTextActive]}>
            General ({expenses.length})
          </Text>
        </SpringPressable>

        <SpringPressable
          style={[styles.tabButton, activeTab === 'hotels' && styles.tabButtonActive]}
          onPress={() => setActiveTab('hotels')}
        >
          <Hotel size={16} color={activeTab === 'hotels' ? '#10B981' : Colors.textMuted} />
          <Text style={[styles.tabButtonText, activeTab === 'hotels' && styles.tabButtonTextActive]}>
            Hotel Rooms ({hotelExpenses.length})
          </Text>
        </SpringPressable>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title or payer..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category Pills (for general expenses) */}
      {activeTab === 'expenses' && (
        <View style={styles.categoryFiltersContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={CATEGORIES}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.categoryFilterList}
            renderItem={({ item }) => {
              const isSelected = selectedCat === item.id
              return (
                <SpringPressable
                  style={[
                    styles.catFilterPill,
                    isSelected && styles.catFilterPillSelected,
                  ]}
                  onPress={() => setSelectedCat(item.id)}
                >
                  <Text style={styles.catFilterIcon}>{item.icon}</Text>
                  <Text
                    style={[
                      styles.catFilterText,
                      isSelected && styles.catFilterTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </SpringPressable>
              )
            }}
          />
        </View>
      )}

      {/* Expense Stream List */}
      {activeTab === 'expenses' ? (
        <FlatList
          data={filteredExpenses}
          keyExtractor={item => item.id}
          renderItem={renderExpenseItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.emptyTitle}>No Expenses Found</Text>
              <Text style={styles.emptySubtitle}>
                {search ? 'Try clearing your search filters' : 'Tap the + button below to log an expense!'}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredHotels}
          keyExtractor={item => item.id}
          renderItem={renderHotelItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Text style={styles.emptyIcon}>🏨</Text>
              <Text style={styles.emptyTitle}>No Hotel Stays Logged</Text>
              <Text style={styles.emptySubtitle}>
                Tap the + button to allocate room costs among guests!
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button */}
      <SpringPressable
        style={styles.fab}
        onPress={() => {
          if (activeTab === 'hotels') {
            router.push('/add-hotel')
          } else {
            router.push('/add-expense')
          }
        }}
      >
        <LinearGradient
          colors={activeTab === 'hotels' ? Colors.gradients.mint : Colors.gradients.sunset}
          style={styles.fabGradient}
        >
          <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
        </LinearGradient>
      </SpringPressable>
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
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  expenseCount: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#6366F1',
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    height: '100%',
  },
  categoryFiltersContainer: {
    marginBottom: 12,
  },
  categoryFilterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  catFilterPillSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  catFilterIcon: {
    fontSize: 13,
  },
  catFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  catFilterTextSelected: {
    color: '#6366F1',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  expenseCard: {
    marginBottom: 12,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  splitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  splitIcon: {
    fontSize: 11,
  },
  splitText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  deleteButton: {
    padding: 4,
  },
  cardCenterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemTitle: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: 2,
  },
  itemDate: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  itemAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  roomsSummaryContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    gap: 4,
  },
  roomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roomName: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  roomCost: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  payerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  payerText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  participantsBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  hotelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  hotelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  fabGradient: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
})
