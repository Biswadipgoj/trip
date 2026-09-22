import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import {
  UserPlus,
  Users,
  HeartHandshake,
  Copy,
  Trash2,
  X,
  CreditCard,
  Phone,
  Lock,
} from 'lucide-react-native'
import { useStore } from '../../lib/store'
import { Colors } from '../../theme/colors'
import { Typography } from '../../theme/typography'
import { SpringPressable } from '../../components/animated/SpringPressable'
import { GlassCard } from '../../components/ui/GlassCard'
import { Avatar } from '../../components/ui/Avatar'
import { formatCurrency } from '../../lib/utils'

export default function MembersScreen() {
  const activeTrip = useStore(state => state.getActiveTrip())
  const tripId = activeTrip?.id || ''

  const members = useStore(state => state.getTripMembers(tripId))
  const balances = useStore(state => state.getTripBalances(tripId))
  const settlementGroups = useStore(state => state.settlementGroups.filter(g => g.tripId === tripId))
  const sponsorships = useStore(state => state.sponsorships.filter(s => s.tripId === tripId))

  const addMember = useStore(state => state.addMember)
  const addSettlementGroup = useStore(state => state.addSettlementGroup)
  const deleteSettlementGroup = useStore(state => state.deleteSettlementGroup)
  const addSponsorship = useStore(state => state.addSponsorship)
  const deleteSponsorship = useStore(state => state.deleteSponsorship)

  // Modals state
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberMobile, setNewMemberMobile] = useState('')
  const [newMemberPin, setNewMemberPin] = useState('')
  const [newMemberUpi, setNewMemberUpi] = useState('')

  const [showAddGroup, setShowAddGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([])

  const [showAddSponsor, setShowAddSponsor] = useState(false)
  const [sponsorId, setSponsorId] = useState<string>('')
  const [sponsoredId, setSponsoredId] = useState<string>('')

  // Copy UPI
  const handleCopyUpi = async (upi: string) => {
    await Clipboard.setStringAsync(upi)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Alert.alert('Copied! 💳', `UPI ID "${upi}" copied to clipboard.`)
  }

  // Handle Add Member
  const handleSaveMember = () => {
    if (!newMemberName.trim()) {
      Alert.alert('Name Required', 'Please enter the member name.')
      return
    }
    if (!newMemberMobile.trim() || newMemberMobile.trim().length < 10) {
      Alert.alert('Mobile Required', 'Please enter a valid 10-digit mobile number.')
      return
    }

    addMember({
      tripId,
      name: newMemberName.trim(),
      mobile: newMemberMobile.trim(),
      pin: newMemberPin.trim() || '1234',
      upiId: newMemberUpi.trim() || undefined,
    })

    setNewMemberName('')
    setNewMemberMobile('')
    setNewMemberPin('')
    setNewMemberUpi('')
    setShowAddMember(false)
  }

  // Handle Add Group
  const handleSaveGroup = () => {
    if (!groupName.trim()) {
      Alert.alert('Group Name Required', 'e.g. "Rahul & Priya"')
      return
    }
    if (selectedGroupMemberIds.length < 2) {
      Alert.alert('Select Members', 'Select at least 2 members for this settlement group.')
      return
    }

    addSettlementGroup(tripId, groupName.trim(), selectedGroupMemberIds)
    setGroupName('')
    setSelectedGroupMemberIds([])
    setShowAddGroup(false)
  }

  // Handle Add Sponsorship
  const handleSaveSponsorship = () => {
    if (!sponsorId || !sponsoredId) {
      Alert.alert('Selection Required', 'Please select both sponsor and sponsored member.')
      return
    }
    if (sponsorId === sponsoredId) {
      Alert.alert('Invalid Selection', 'A member cannot sponsor themselves.')
      return
    }

    addSponsorship(tripId, sponsorId, sponsoredId)
    setSponsorId('')
    setSponsoredId('')
    setShowAddSponsor(false)
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Trip Members</Text>
          <Text style={styles.headerSubtitle}>
            {members.length} participants in this trip
          </Text>
        </View>

        <SpringPressable
          style={styles.addMemberBtn}
          onPress={() => setShowAddMember(true)}
        >
          <UserPlus size={16} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.addMemberBtnText}>Add</Text>
        </SpringPressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Action Pills for Settlement Groups & Sponsors */}
        <View style={styles.quickToolsRow}>
          <SpringPressable
            style={[styles.toolCard, { flex: 1 }]}
            onPress={() => setShowAddGroup(true)}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#EEF2FF' }]}>
              <Users size={18} color="#6366F1" />
            </View>
            <View>
              <Text style={styles.toolTitle}>Couples / Group</Text>
              <Text style={styles.toolSub}>Settle as one unit</Text>
            </View>
          </SpringPressable>

          <SpringPressable
            style={[styles.toolCard, { flex: 1 }]}
            onPress={() => setShowAddSponsor(true)}
          >
            <View style={[styles.toolIcon, { backgroundColor: '#FFF1F2' }]}>
              <HeartHandshake size={18} color="#EC4899" />
            </View>
            <View>
              <Text style={styles.toolTitle}>Sponsorship</Text>
              <Text style={styles.toolSub}>Cover someone's debt</Text>
            </View>
          </SpringPressable>
        </View>

        {/* Active Groups & Sponsorships Badges (if any) */}
        {settlementGroups.length > 0 && (
          <View style={styles.groupSection}>
            <Text style={styles.sectionHeader}>Settlement Groups (Couples/Families)</Text>
            {settlementGroups.map(g => {
              const groupMembers = members.filter(m => g.memberIds.includes(m.id))
              return (
                <GlassCard key={g.id} style={styles.groupCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupTitle}>🤝 {g.name}</Text>
                    <Text style={styles.groupMembersText}>
                      {groupMembers.map(m => m.name).join(' & ')}
                    </Text>
                  </View>
                  <SpringPressable
                    style={styles.deleteGroupBtn}
                    onPress={() => deleteSettlementGroup(g.id)}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </SpringPressable>
                </GlassCard>
              )
            })}
          </View>
        )}

        {sponsorships.length > 0 && (
          <View style={styles.groupSection}>
            <Text style={styles.sectionHeader}>Active Sponsorships</Text>
            {sponsorships.map(sp => {
              const sponsor = members.find(m => m.id === sp.sponsorMemberId)
              const sponsored = members.find(m => m.id === sp.sponsoredMemberId)
              return (
                <GlassCard key={sp.id} style={styles.groupCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupTitle}>
                      🎗️ {sponsor?.name} covers {sponsored?.name}
                    </Text>
                    <Text style={styles.groupMembersText}>
                      {sponsored?.name}'s debt merges into {sponsor?.name} at settlement.
                    </Text>
                  </View>
                  <SpringPressable
                    style={styles.deleteGroupBtn}
                    onPress={() => deleteSponsorship(sp.id)}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </SpringPressable>
                </GlassCard>
              )
            })}
          </View>
        )}

        {/* Members List */}
        <Text style={[styles.sectionHeader, { marginTop: 12 }]}>All Members</Text>
        {members.map(member => {
          const bal = balances.find(b => b.memberId === member.id)
          const net = bal?.netBalance || 0
          const isPositive = net > 0.01
          const isNegative = net < -0.01

          return (
            <GlassCard key={member.id} style={styles.memberCard}>
              <View style={styles.memberCardTop}>
                <Avatar name={member.name} color={member.avatarColor} size={44} />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberMobile}>{member.mobile}</Text>
                  {member.upiId && (
                    <SpringPressable
                      style={styles.upiRow}
                      onPress={() => handleCopyUpi(member.upiId!)}
                    >
                      <CreditCard size={12} color="#6366F1" />
                      <Text style={styles.upiText} numberOfLines={1}>
                        {member.upiId}
                      </Text>
                      <Copy size={11} color="#6366F1" />
                    </SpringPressable>
                  )}
                </View>

                {/* Net Balance Status */}
                <View style={styles.balanceCol}>
                  <Text
                    style={[
                      styles.netBalanceAmount,
                      {
                        color: isPositive
                          ? '#10B981'
                          : isNegative
                          ? '#EF4444'
                          : '#64748B',
                      },
                    ]}
                  >
                    {isPositive ? '+' : ''}
                    {formatCurrency(net)}
                  </Text>
                  <Text style={styles.balanceStatusText}>
                    {isPositive ? 'gets back' : isNegative ? 'owes' : 'settled'}
                  </Text>
                </View>
              </View>
            </GlassCard>
          )
        })}
      </ScrollView>

      {/* Add Member Modal */}
      <Modal visible={showAddMember} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Member</Text>
              <SpringPressable onPress={() => setShowAddMember(false)}>
                <X size={20} color={Colors.text} />
              </SpringPressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Priya Sharma"
                placeholderTextColor={Colors.textMuted}
                value={newMemberName}
                onChangeText={setNewMemberName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="10-digit number"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                value={newMemberMobile}
                onChangeText={setNewMemberMobile}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>4-Digit PIN (Default 1234)</Text>
              <TextInput
                style={styles.input}
                placeholder="1234"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                maxLength={4}
                value={newMemberPin}
                onChangeText={setNewMemberPin}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>UPI ID (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="name@upi"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                value={newMemberUpi}
                onChangeText={setNewMemberUpi}
              />
            </View>

            <SpringPressable style={styles.modalSaveBtn} onPress={handleSaveMember}>
              <LinearGradient
                colors={Colors.gradients.sunset}
                style={styles.modalSaveGradient}
              >
                <Text style={styles.modalSaveText}>Add to Trip</Text>
              </LinearGradient>
            </SpringPressable>
          </GlassCard>
        </View>
      </Modal>

      {/* Settlement Group Modal */}
      <Modal visible={showAddGroup} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Settlement Group</Text>
              <SpringPressable onPress={() => setShowAddGroup(false)}>
                <X size={20} color={Colors.text} />
              </SpringPressable>
            </View>

            <Text style={styles.modalSub}>
              Members in a group are treated as ONE financial entity at settlement
              (e.g. couples/roommates settling with a single payment).
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Group Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Rahul & Priya"
                placeholderTextColor={Colors.textMuted}
                value={groupName}
                onChangeText={setGroupName}
              />
            </View>

            <Text style={styles.label}>Select Members in Group:</Text>
            <View style={styles.chipSelectContainer}>
              {members.map(m => {
                const isSelected = selectedGroupMemberIds.includes(m.id)
                return (
                  <SpringPressable
                    key={m.id}
                    style={[
                      styles.selectableChip,
                      isSelected && styles.selectableChipActive,
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedGroupMemberIds(prev => prev.filter(id => id !== m.id))
                      } else {
                        setSelectedGroupMemberIds(prev => [...prev, m.id])
                      }
                    }}
                  >
                    <Avatar name={m.name} color={m.avatarColor} size={24} />
                    <Text
                      style={[
                        styles.selectableChipText,
                        isSelected && styles.selectableChipTextActive,
                      ]}
                    >
                      {m.name}
                    </Text>
                  </SpringPressable>
                )
              })}
            </View>

            <SpringPressable style={styles.modalSaveBtn} onPress={handleSaveGroup}>
              <LinearGradient
                colors={Colors.gradients.ocean}
                style={styles.modalSaveGradient}
              >
                <Text style={styles.modalSaveText}>Save Group</Text>
              </LinearGradient>
            </SpringPressable>
          </GlassCard>
        </View>
      </Modal>

      {/* Sponsorship Modal */}
      <Modal visible={showAddSponsor} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Link Sponsorship</Text>
              <SpringPressable onPress={() => setShowAddSponsor(false)}>
                <X size={20} color={Colors.text} />
              </SpringPressable>
            </View>

            <Text style={styles.modalSub}>
              The sponsor will financially absorb the sponsored member's debt at settlement.
            </Text>

            <Text style={styles.label}>Select Sponsor (Who Pays):</Text>
            <View style={styles.chipSelectContainer}>
              {members.map(m => {
                const isSelected = sponsorId === m.id
                return (
                  <SpringPressable
                    key={m.id}
                    style={[
                      styles.selectableChip,
                      isSelected && styles.selectableChipActive,
                    ]}
                    onPress={() => setSponsorId(m.id)}
                  >
                    <Avatar name={m.name} color={m.avatarColor} size={24} />
                    <Text
                      style={[
                        styles.selectableChipText,
                        isSelected && styles.selectableChipTextActive,
                      ]}
                    >
                      {m.name}
                    </Text>
                  </SpringPressable>
                )
              })}
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>
              Select Sponsored Member (Covered):
            </Text>
            <View style={styles.chipSelectContainer}>
              {members.map(m => {
                const isSelected = sponsoredId === m.id
                return (
                  <SpringPressable
                    key={m.id}
                    style={[
                      styles.selectableChip,
                      isSelected && styles.selectableChipActive,
                    ]}
                    onPress={() => setSponsoredId(m.id)}
                  >
                    <Avatar name={m.name} color={m.avatarColor} size={24} />
                    <Text
                      style={[
                        styles.selectableChipText,
                        isSelected && styles.selectableChipTextActive,
                      ]}
                    >
                      {m.name}
                    </Text>
                  </SpringPressable>
                )
              })}
            </View>

            <SpringPressable style={styles.modalSaveBtn} onPress={handleSaveSponsorship}>
              <LinearGradient
                colors={Colors.gradients.sunset}
                style={styles.modalSaveGradient}
              >
                <Text style={styles.modalSaveText}>Link Sponsorship</Text>
              </LinearGradient>
            </SpringPressable>
          </GlassCard>
        </View>
      </Modal>
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
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  addMemberBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  quickToolsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toolIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  toolSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  groupSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    ...Typography.h4,
    color: Colors.text,
    marginBottom: 10,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    padding: 12,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  groupMembersText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  deleteGroupBtn: {
    padding: 8,
  },
  memberCard: {
    marginBottom: 10,
    padding: 14,
  },
  memberCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    ...Typography.h4,
    color: Colors.text,
  },
  memberMobile: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  upiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  upiText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
    maxWidth: 140,
  },
  balanceCol: {
    alignItems: 'flex-end',
  },
  netBalanceAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  balanceStatusText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  modalSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
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
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: Colors.text,
  },
  chipSelectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  selectableChip: {
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
  selectableChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  selectableChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  selectableChipTextActive: {
    color: '#6366F1',
    fontWeight: '700',
  },
  modalSaveBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 8,
  },
  modalSaveGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
})
