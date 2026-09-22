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
  roundMoney
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

  console.log('🎉 ALL PARITY TESTS PASSED SUCCESSFULLY!')
}

runTests()
