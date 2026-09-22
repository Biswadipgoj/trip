// Verification test for utils business logic
import {
  distributeEqually,
  resolveExpenseSplits,
  resolveHotelSplits,
  calculateBalances,
  calculateSettlements,
  createShortJoinLink,
  createTripShareMessage,
  formatCurrency,
  roundMoney,
  buildUpiLink
} from './utils'
import { Member, Expense, HotelExpense, Sponsorship, SettlementGroup } from '../types'

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`)
  }
}

export function runTests() {
  console.log('--- Running Business Logic Parity Tests ---')

  // Test 1: distributeEqually paise accuracy
  const shares: Record<string, number> = {}
  distributeEqually(100, ['m1', 'm2', 'm3'], shares)
  assert(shares['m1'] === 33.34, 'm1 share should be 33.34')
  assert(shares['m2'] === 33.33, 'm2 share should be 33.33')
  assert(shares['m3'] === 33.33, 'm3 share should be 33.33')
  const sum = roundMoney(shares['m1'] + shares['m2'] + shares['m3'])
  assert(sum === 100, 'Sum of shares must be exactly 100')
  console.log('✅ Test 1 Passed: distributeEqually paise-accuracy')

  // Test 2: Custom, % and Qty splits
  const customExp: Expense = {
    id: 'e1',
    tripId: 't1',
    title: 'Dinner',
    amount: 1500,
    paidBy: 'm1',
    category: 'food',
    participants: ['m1', 'm2'],
    splitType: 'custom',
    splits: [
      { memberId: 'm1', value: 1000 },
      { memberId: 'm2', value: 500 },
    ],
    createdAt: new Date().toISOString()
  }
  const customShares = resolveExpenseSplits(customExp)
  assert(customShares['m1'] === 1000 && customShares['m2'] === 500, 'Custom split values match')
  console.log('✅ Test 2 Passed: Custom splits')

  // Test 3: Hotel room splits
  const hotel: HotelExpense = {
    id: 'h1',
    tripId: 't1',
    title: 'Resort',
    totalAmount: 5000,
    paidBy: 'm1',
    rooms: [
      { id: 'r1', name: 'Room 1', cost: 3000, occupantIds: ['m1', 'm2', 'm3'] },
      { id: 'r2', name: 'Room 2', cost: 2000, occupantIds: ['m4', 'm5'] }
    ],
    createdAt: new Date().toISOString()
  }
  const hotelShares = resolveHotelSplits(hotel)
  assert(hotelShares['m1'] === 1000, 'Room 1 m1 owes 1000')
  assert(hotelShares['m4'] === 1000, 'Room 2 m4 owes 1000')
  console.log('✅ Test 3 Passed: Hotel room splits')

  // Test 4: Calculate balances and greedy settlements
  const members: Member[] = [
    { id: 'm1', tripId: 't1', name: 'Alice', mobile: '9999999991', pin: '1234', avatarColor: '#8B5CF6', joinedAt: '' },
    { id: 'm2', tripId: 't1', name: 'Bob', mobile: '9999999992', pin: '1234', avatarColor: '#EC4899', joinedAt: '' },
    { id: 'm3', tripId: 't1', name: 'Charlie', mobile: '9999999993', pin: '1234', avatarColor: '#10B981', joinedAt: '' },
  ]
  const exp: Expense = {
    id: 'e2',
    tripId: 't1',
    title: 'Lunch',
    amount: 300,
    paidBy: 'm1',
    category: 'food',
    participants: ['m1', 'm2', 'm3'],
    splitType: 'equal',
    splits: [],
    createdAt: new Date().toISOString()
  }
  const balances = calculateBalances([exp], [], members)
  const bMap = Object.fromEntries(balances.map(b => [b.memberId, b]))
  assert(bMap['m1'].netBalance === 200, 'm1 paid 300, owes 100 -> net +200')
  assert(bMap['m2'].netBalance === -100, 'm2 owes 100 -> net -100')
  assert(bMap['m3'].netBalance === -100, 'm3 owes 100 -> net -100')

  const routes = calculateSettlements(balances)
  assert(routes.length === 2, 'Greedy minimizer gives 2 routes')
  assert(routes[0].amount === 100 && routes[1].amount === 100, 'Routes each for 100')
  console.log('✅ Test 4 Passed: Balances and Greedy Settlements')

  // Test 5: Short URL link generation
  const shortLink = createShortJoinLink('TRP-WXYZ')
  assert(shortLink === 'https://tripmate.app/join?c=TRP-WXYZ', 'Short join link correct')
  const shareMsg = createTripShareMessage('Goa Trip', 'TRP-WXYZ')
  assert(shareMsg.includes('TRP-WXYZ'), 'Share message contains trip code')
  console.log('✅ Test 5 Passed: Shortened sharing link')

  // Test 6: Adversarial input boundary (NaN, negatives, zero participants)
  const nanShares: Record<string, number> = {}
  distributeEqually(NaN, ['m1', 'm2'], nanShares)
  assert(nanShares['m1'] === 0 && nanShares['m2'] === 0, 'NaN coerced to 0')
  const negShares: Record<string, number> = {}
  distributeEqually(-500, ['m1', 'm2'], negShares)
  assert(negShares['m1'] === 0 && negShares['m2'] === 0, 'Negative amount coerced to 0')
  console.log('✅ Test 6 Passed: Adversarial input boundary hardening')

  // Test 7: UPI link CRLF injection and amount sanitization
  const upiLink = buildUpiLink('test@upi\r\nBcc: evil@attacker.com', 'Alice\r\nSubject: Test', 250, 'Dinner\r\nPAY')
  assert(!upiLink.includes('\r') && !upiLink.includes('\n'), 'CRLF stripped from UPI URI')
  const negUpi = buildUpiLink('test@upi', 'Bob', -100, 'Refund')
  assert(negUpi.includes('am=0.00'), 'Negative amount sanitized to 0.00')
  console.log('✅ Test 7 Passed: UPI URI injection and amount sanitization')

  // Test 8: Circular debt cycle resolution (A->B, B->C, C->A)
  const circMembers: Member[] = [
    { id: 'cA', tripId: 't1', name: 'Alice', mobile: '1111111111', pin: '1111', avatarColor: '#8B5CF6', joinedAt: '' },
    { id: 'cB', tripId: 't1', name: 'Bob', mobile: '2222222222', pin: '2222', avatarColor: '#EC4899', joinedAt: '' },
    { id: 'cC', tripId: 't1', name: 'Charlie', mobile: '3333333333', pin: '3333', avatarColor: '#10B981', joinedAt: '' },
  ]
  const circExpenses: Expense[] = [
    { id: 'ce1', tripId: 't1', title: 'A pays B', amount: 300, paidBy: 'cA', category: 'food', splitType: 'equal', participants: ['cA', 'cB'], splits: [], createdAt: '' },
    { id: 'ce2', tripId: 't1', title: 'B pays C', amount: 300, paidBy: 'cB', category: 'food', splitType: 'equal', participants: ['cB', 'cC'], splits: [], createdAt: '' },
    { id: 'ce3', tripId: 't1', title: 'C pays A', amount: 300, paidBy: 'cC', category: 'food', splitType: 'equal', participants: ['cC', 'cA'], splits: [], createdAt: '' },
  ]
  const circBalances = calculateBalances(circExpenses, [], circMembers)
  assert(circBalances.every(b => b.netBalance === 0), 'Every net balance in cycle is 0')
  const circRoutes = calculateSettlements(circBalances)
  assert(circRoutes.length === 0, 'Circular debt collapses to 0 settlement routes')
  console.log('✅ Test 8 Passed: Circular debt resolution')

  console.log('🎉 ALL PARITY & ADVERSARIAL TESTS PASSED SUCCESSFULLY!')
}

runTests()

