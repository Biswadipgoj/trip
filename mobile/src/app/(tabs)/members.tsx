// Members (web /members/[tripId]): invite link, admin "add member", member
// cards with paid / owes / balance and UPI IDs, and Units (members settling
// as one entity, e.g. a couple).
import { useMemo, useState } from 'react'
import { Share, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import * as Clipboard from 'expo-clipboard'
import {
  ArrowDownRight, ArrowUpRight, Check, ChevronDown, Copy, Crown, Heart, Link2, PenLine, Plus, Share2,
  Trash2, TriangleAlert, UserPlus, Users, Wallet, X,
} from 'lucide-react-native'
import { useStore } from '../../lib/store'
import { useTripData } from '../../lib/hooks'
import { syncTrip } from '../../lib/sync'
import { cloudAddGroup, cloudAddMember, cloudRemoveGroup, cloudUpdateUpi, withCloud } from '../../lib/cloud'
import { isRemoteEnabled } from '../../lib/remote'
import { WEB_URL } from '../../lib/config'
import { confirmAction } from '../../lib/dialogs'
import { toast } from '../../lib/toast'
import { createInviteLink, createTripShareMessage, formatCurrency, formatDate, isValidUpiId } from '../../lib/utils'
import type { Member, MemberBalance } from '../../types'
import { GlassCard } from '../../components/ui/GlassCard'
import { T } from '../../components/ui/Text'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Avatar } from '../../components/ui/Avatar'
import { AvatarStack } from '../../components/ui/MemberAvatarStack'
import { Chip, SelectPill } from '../../components/ui/CategoryChip'
import { PageHeader, PageScroll } from '../../components/ui/PageHeader'
import { CountUp } from '../../components/animated/SlotCounter'
import { Collapsible, FadeIn, SMOOTH_LAYOUT, stagger } from '../../components/animated/FadeInView'
import { EmptyState } from '../../components/animated/AnimatedEmptyState'
import { PressScale, tick } from '../../components/animated/SpringPressable'
import { C, amber, ink } from '../../theme/colors'
import { F } from '../../theme/typography'

export default function MembersScreen() {
  const session = useStore(s => s.session)
  const tripId = session?.tripId
  const { trip, members, groups: units, balances, totalSpent, isAdmin } = useTripData(tripId)
  const [busy, setBusy] = useState<'member' | 'unit' | null>(null)
  const [copied, setCopied] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [showUnitForm, setShowUnitForm] = useState(false)
  const [unitName, setUnitName] = useState('')
  const [unitMembers, setUnitMembers] = useState<string[]>([])
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null)

  const balanceMap = useMemo(() => {
    const map: Record<string, MemberBalance> = {}
    balances.forEach(b => { map[b.memberId] = b })
    return map
  }, [balances])

  const inviteLink = trip && WEB_URL ? createInviteLink(trip, WEB_URL) : ''

  const shareInvite = async () => {
    if (!trip) return
    try {
      await Share.share({ message: createTripShareMessage(trip, inviteLink || undefined) })
    } catch {
      toast.error('Could not open the share sheet')
    }
  }

  const copyInvite = async () => {
    if (!trip) return
    await Clipboard.setStringAsync(inviteLink || trip.tripCode)
    tick('success')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAddMember = async () => {
    if (!tripId || !newMemberName.trim() || busy) return
    setBusy('member')
    const added = await withCloud(() => cloudAddMember(tripId, newMemberName))
    setBusy(null)
    if (!added) return
    tick('success')
    toast.success(`${added.name} added to the trip`)
    setNewMemberName('')
    setShowAddMember(false)
  }

  const toggleUnitMember = (id: string) =>
    setUnitMembers(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const handleCreateUnit = async () => {
    if (!tripId || !unitName.trim() || unitMembers.length < 2 || busy) return
    setBusy('unit')
    const created = await withCloud(() => cloudAddGroup(tripId, unitName.trim(), unitMembers))
    setBusy(null)
    if (!created) return
    tick('success')
    setUnitName('')
    setUnitMembers([])
    setShowUnitForm(false)
  }

  const removeUnit = async (id: string, name: string) => {
    const ok = await confirmAction({
      title: `Remove unit “${name}”?`,
      message: 'Its members will settle individually again. Payments already confirmed stay recorded.',
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!ok) return
    const removed = await withCloud(async () => {
      await cloudRemoveGroup(id)
      return true
    })
    if (removed) tick('warning')
  }

  return (
    <PageScroll onRefresh={() => syncTrip(tripId)}>
      <PageHeader
        icon={Users}
        title="Members"
        subtitle={`${members.length} people · ${formatCurrency(totalSpent)} total spent`}
      />

      {/* Invite */}
      {trip && (
        <FadeIn delay={50}>
          <GlassCard padding={16} contentStyle={styles.gap12}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <View style={styles.row}>
                  <Link2 size={16} color={C.brand500} />
                  <T variant="title">Invite friends</T>
                </View>
                <T variant="small" color={ink(0.6)} style={styles.sub}>
                  {inviteLink ? 'Share the join link — works on any device, valid 30 days' : 'Share the trip code — friends join with the trip password'}
                </T>
              </View>
            </View>
            <View style={styles.row}>
              <Button title="Share" icon={Share2} size="sm" onPress={() => void shareInvite()} style={styles.flex} />
              <Button
                title={copied ? 'Copied!' : inviteLink ? 'Copy Link' : 'Copy Code'}
                icon={copied ? Check : Copy}
                variant={copied ? 'success' : 'soft'}
                size="sm"
                onPress={() => void copyInvite()}
                style={styles.flex}
                testID="copy-invite-link-btn"
              />
            </View>
            {!isRemoteEnabled() && (
              <View style={styles.warning}>
                <TriangleAlert size={15} color={C.amber600} />
                <T variant="small" color={C.amber700} style={styles.flex}>
                  Cloud sync is OFF in this build — invites will not work on other devices until it is rebuilt with the
                  Supabase settings.
                </T>
              </View>
            )}
          </GlassCard>
        </FadeIn>
      )}

      {/* Admin: add a member by name */}
      {isAdmin && (
        <FadeIn delay={80}>
          <Animated.View layout={SMOOTH_LAYOUT}>
            <GlassCard padding={16}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <View style={styles.row}>
                    <UserPlus size={16} color={C.accent400} />
                    <T variant="title">Add member</T>
                  </View>
                  <T variant="small" color={ink(0.6)} style={styles.sub}>Add friends by name — they can join with the link later</T>
                </View>
                {!showAddMember && (
                  <Button title="Add" icon={Plus} variant="soft" tone={C.accent500} size="sm" onPress={() => setShowAddMember(true)} testID="show-add-member-btn" />
                )}
              </View>
              <Collapsible open={showAddMember}>
                <View style={[styles.row, styles.formRow]}>
                  <Field
                    placeholder="Member name, e.g. Aman"
                    value={newMemberName}
                    onChangeText={setNewMemberName}
                    maxLength={40}
                    autoCapitalize="words"
                    autoFocus
                    dense
                    containerStyle={styles.flex}
                    returnKeyType="done"
                    onSubmitEditing={() => void handleAddMember()}
                    testID="new-member-name-input"
                  />
                  <Button
                    title="Add"
                    size="sm"
                    loading={busy === 'member'}
                    disabled={!newMemberName.trim()}
                    onPress={() => void handleAddMember()}
                    testID="add-member-btn"
                  />
                  <PressScale
                    onPress={() => { setShowAddMember(false); setNewMemberName('') }}
                    style={styles.iconBtn}
                    accessibilityLabel="Cancel"
                  >
                    <X size={15} color={ink(0.6)} />
                  </PressScale>
                </View>
              </Collapsible>
            </GlassCard>
          </Animated.View>
        </FadeIn>
      )}

      {/* Member cards */}
      {balances.map((balance, i) => {
        const member = members.find(m => m.id === balance.memberId)
        if (!member) return null
        return (
          <FadeIn key={balance.memberId} delay={stagger(i, 100, 70)}>
            <MemberCard
              member={member}
              balance={balance}
              isMe={session?.memberId === member.id}
              isCreator={trip?.creatorId === member.id}
              viewerIsAdmin={isAdmin}
            />
          </FadeIn>
        )
      })}

      {/* Units */}
      {members.length >= 2 && (
        <FadeIn delay={150}>
          <Animated.View layout={SMOOTH_LAYOUT}>
            <GlassCard>
              <View style={styles.cardHead}>
                <View style={styles.row}>
                  <Heart size={16} color={C.accent400} />
                  <T variant="title">Units</T>
                </View>
                {!showUnitForm && (
                  <PressScale onPress={() => setShowUnitForm(true)} style={styles.row} haptic="selection" testID="add-unit-btn">
                    <Plus size={13} color={C.brand500} />
                    <T variant="smallMedium" color={C.brand500}>Create unit</T>
                  </PressScale>
                )}
              </View>
              <T variant="small" color={ink(0.6)} style={styles.unitIntro}>
                Group members (e.g. a couple) into one unit — they settle as a single entity
              </T>

              <View style={styles.gap8}>
                {units.map(unit => {
                  const unitList = members.filter(m => unit.memberIds.includes(m.id))
                  const combined = unit.memberIds.reduce((s, id) => s + (balanceMap[id]?.netBalance ?? 0), 0)
                  const open = expandedUnit === unit.id
                  return (
                    <Animated.View key={unit.id} layout={SMOOTH_LAYOUT} style={styles.unit}>
                      <View style={styles.row}>
                        <PressScale
                          onPress={() => setExpandedUnit(open ? null : unit.id)}
                          scaleTo={0.98}
                          haptic="selection"
                          style={[styles.row, styles.flex]}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: open }}
                          accessibilityLabel={`${unit.name}, show split`}
                        >
                          <AvatarStack members={unitList} />
                          <T variant="bodyMedium" numberOfLines={1} style={styles.flex}>{unit.name}</T>
                          <T variant="smallSemibold" color={combined > 0.01 ? C.emerald400 : combined < -0.01 ? C.red500 : ink(0.6)}>
                            {combined > 0 ? '+' : ''}{formatCurrency(combined)}
                          </T>
                          <ChevronDown size={15} color={ink(0.45)} style={open ? styles.flip : undefined} />
                        </PressScale>
                        <PressScale onPress={() => void removeUnit(unit.id, unit.name)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove unit" haptic={false}>
                          <Trash2 size={15} color={ink(0.45)} />
                        </PressScale>
                      </View>
                      <Collapsible open={open}>
                        <View style={styles.unitSplit}>
                          {unitList.map(m => {
                            const b = balanceMap[m.id]
                            const net = b?.netBalance ?? 0
                            return (
                              <View key={m.id} style={styles.between}>
                                <T variant="small" color={ink(0.65)}>{m.name}</T>
                                <T variant="small" color={net > 0.01 ? C.emerald400 : net < -0.01 ? C.red500 : ink(0.6)}>
                                  {net > 0 ? '+' : ''}{formatCurrency(net)}
                                </T>
                              </View>
                            )
                          })}
                        </View>
                      </Collapsible>
                    </Animated.View>
                  )
                })}
                {units.length === 0 && !showUnitForm && (
                  <T variant="small" color={ink(0.5)} style={styles.italic}>No units yet</T>
                )}
              </View>

              <Collapsible open={showUnitForm}>
                <View style={styles.unitForm}>
                  <Field
                    placeholder='Unit name, e.g. "Rahul & Priya"'
                    value={unitName}
                    onChangeText={setUnitName}
                    maxLength={40}
                    dense
                    testID="unit-name-input"
                  />
                  <View style={styles.wrap}>
                    {members.map(m => {
                      const inAnotherUnit = units.some(u => u.memberIds.includes(m.id))
                      return (
                        <SelectPill
                          key={m.id}
                          selected={unitMembers.includes(m.id)}
                          onPress={() => toggleUnitMember(m.id)}
                          disabled={inAnotherUnit}
                          dense
                        >
                          <Avatar name={m.name} color={m.avatarColor} size="xs" glow={false} />
                          <T variant="small">{m.name}</T>
                        </SelectPill>
                      )
                    })}
                  </View>
                  <View style={styles.row}>
                    <Button
                      title="Cancel"
                      variant="ghost"
                      size="sm"
                      onPress={() => { setShowUnitForm(false); setUnitName(''); setUnitMembers([]) }}
                      style={styles.flex}
                    />
                    <Button
                      title="Create Unit"
                      size="sm"
                      disabled={!unitName.trim() || unitMembers.length < 2}
                      loading={busy === 'unit'}
                      onPress={() => void handleCreateUnit()}
                      style={styles.flex}
                      testID="create-unit-btn"
                    />
                  </View>
                  <T variant="tiny" color={ink(0.5)}>Pick at least 2 members. A member can only belong to one unit.</T>
                </View>
              </Collapsible>
            </GlassCard>
          </Animated.View>
        </FadeIn>
      )}

      {members.length === 0 && <EmptyState icon={Users} title="No members yet" />}
    </PageScroll>
  )
}

function MemberCard({ member, balance, isMe, isCreator, viewerIsAdmin }: {
  member: Member
  balance: MemberBalance
  isMe: boolean
  isCreator: boolean
  viewerIsAdmin: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [upiInput, setUpiInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  // A member edits their own UPI; the trip creator can edit everyone's.
  const canEditUpi = isMe || viewerIsAdmin
  const firstName = balance.name.split(' ')[0]
  const net = balance.netBalance

  const save = async () => {
    const value = upiInput.trim()
    if (value && !isValidUpiId(value)) {
      setError('That doesn’t look like a UPI ID — e.g. name@okhdfcbank')
      return
    }
    if (saving) return
    setSaving(true)
    const saved = await withCloud(async () => {
      await cloudUpdateUpi(member.id, value)
      return true
    })
    setSaving(false)
    if (!saved) return
    tick('success')
    setEditing(false)
    setError(null)
  }

  return (
    <Animated.View layout={SMOOTH_LAYOUT}>
      <GlassCard>
        <View style={styles.memberTop}>
          <View>
            <Avatar name={balance.name} color={balance.avatarColor} size="lg" animate />
            {isMe && (
              <View style={styles.youBadge}>
                <T style={styles.youText} maxFontSizeMultiplier={1}>You</T>
              </View>
            )}
          </View>
          <View style={styles.flex}>
            <View style={[styles.row, styles.wrap]}>
              <T variant="h3" numberOfLines={1}>{balance.name}</T>
              {isCreator && <Chip label="Admin" icon={Crown} color={C.amber600} />}
            </View>
            <T variant="small" color={ink(0.6)} style={styles.meta}>
              {member.mobile && !member.mobile.startsWith('manual-') ? member.mobile : 'Added by admin'} · Joined {formatDate(member.joinedAt)}
            </T>
            <View style={styles.stats}>
              <Stat label="Paid" value={balance.totalPaid} />
              <Stat label="Owes" value={balance.totalOwed} />
              <View style={styles.flex}>
                <T variant="tiny" color={ink(0.5)}>Balance</T>
                <View style={styles.inline}>
                  {net > 0 ? <ArrowUpRight size={12} color={C.emerald400} /> : net < 0 ? <ArrowDownRight size={12} color={C.red500} /> : null}
                  <CountUp
                    value={Math.abs(net)}
                    prefix="₹"
                    duration={1}
                    variant="title"
                    color={net > 0 ? C.emerald400 : net < 0 ? C.red500 : ink(0.6)}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {(canEditUpi || member.upiId) && (
          <View style={styles.upi}>
            <View style={styles.between}>
              <View style={styles.row}>
                <Wallet size={14} color={ink(0.6)} />
                <T variant="smallMedium" color={ink(0.6)}>{isMe ? 'Your UPI ID' : `${firstName}'s UPI ID`}</T>
                {!isMe && viewerIsAdmin && <Chip label="Admin" icon={Crown} color={C.brand500} />}
              </View>
              {canEditUpi && !editing && (
                <PressScale
                  onPress={() => { setEditing(true); setUpiInput(member.upiId || ''); setError(null) }}
                  style={styles.row}
                  haptic="selection"
                  testID={`edit-upi-${member.id}`}
                >
                  <PenLine size={12} color={C.brand500} />
                  <T variant="smallMedium" color={C.brand500}>{member.upiId ? 'Edit' : 'Add'}</T>
                </PressScale>
              )}
            </View>
            {editing ? (
              <Collapsible open>
                <View style={[styles.row, styles.formRow]}>
                  <Field
                    placeholder={isMe ? 'yourname@paytm' : `${firstName.toLowerCase()}@upi`}
                    value={upiInput}
                    onChangeText={v => { setUpiInput(v.replace(/\s/g, '')); setError(null) }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    mono
                    dense
                    autoFocus
                    error={error}
                    containerStyle={styles.flex}
                    returnKeyType="done"
                    onSubmitEditing={() => void save()}
                  />
                  <PressScale
                    onPress={() => void save()}
                    disabled={saving}
                    style={[styles.iconBtn, styles.saveBtn, saving && styles.dim]}
                    accessibilityRole="button"
                    accessibilityLabel="Save UPI ID"
                  >
                    <Check size={15} color={C.emerald400} />
                  </PressScale>
                  <PressScale onPress={() => setEditing(false)} style={styles.iconBtn} accessibilityLabel="Cancel">
                    <X size={15} color={ink(0.6)} />
                  </PressScale>
                </View>
              </Collapsible>
            ) : (
              <T
                variant="body"
                color={member.upiId ? C.ink : ink(0.5)}
                style={[styles.upiText, !member.upiId && styles.italic]}
                selectable={!!member.upiId}
              >
                {member.upiId || (canEditUpi ? 'No UPI ID set — tap Add' : 'No UPI ID set')}
              </T>
            )}
          </View>
        )}
      </GlassCard>
    </Animated.View>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.flex}>
      <T variant="tiny" color={ink(0.5)}>{label}</T>
      <CountUp value={value} prefix="₹" duration={1} variant="title" />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  wrap: { flexWrap: 'wrap', flexDirection: 'row', gap: 6 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  sub: { marginTop: 2 },
  formRow: { marginTop: 12, alignItems: 'flex-start' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ink(0.05),
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: { backgroundColor: 'rgba(29,165,120,0.14)', borderWidth: 1, borderColor: 'rgba(29,165,120,0.3)' },
  dim: { opacity: 0.5 },
  warning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: amber(0.3),
    backgroundColor: amber(0.12),
    padding: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  unitIntro: { marginBottom: 14 },
  unit: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ink(0.1),
    backgroundColor: ink(0.03),
    padding: 12,
  },
  unitSplit: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: ink(0.08), gap: 6 },
  unitForm: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ink(0.1),
    backgroundColor: ink(0.03),
    padding: 12,
    gap: 12,
  },
  italic: { fontStyle: 'italic' },
  flip: { transform: [{ rotate: '180deg' }] },
  memberTop: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  youBadge: {
    position: 'absolute',
    right: -6,
    bottom: -4,
    backgroundColor: C.brand500,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: C.surface0,
  },
  youText: { color: C.white, fontSize: 9, lineHeight: 12, fontFamily: F.bold },
  meta: { marginTop: 2, marginBottom: 12 },
  stats: { flexDirection: 'row', gap: 12 },
  upi: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: ink(0.08), gap: 8 },
  upiText: { fontFamily: F.mono },
})
