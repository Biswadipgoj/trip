import { describe, it, expect } from 'vitest'
import { pdfSafe } from '@/lib/pdfText'
import { formatCurrency } from '@/lib/utils'

describe('pdfSafe (PDF report text)', () => {
  it('writes the rupee amount as Rs. so the line prints', () => {
    expect(pdfSafe(`Total Expenses: ${formatCurrency(26730)}`)).toBe('Total Expenses: Rs. 26,730')
    expect(pdfSafe(`net -${formatCurrency(3178.33).replace('-', '')}`)).toBe('net -Rs. 3,178.33')
  })

  it('keeps settlement lines readable', () => {
    expect(pdfSafe(`Riya Sharma → Biswodip Goj: ${formatCurrency(4795)}`)).toBe('Riya Sharma -> Biswodip Goj: Rs. 4,795')
  })

  it('drops characters the PDF font cannot draw', () => {
    expect(pdfSafe('Trip Report: Goa 🌴 2026')).toBe('Trip Report: Goa 2026')
    expect(pdfSafe('Café – “Beach”')).toBe('Café - "Beach"')
  })

  it('leaves only Latin-1 characters', () => {
    expect(/^[\x00-\xFF]*$/.test(pdfSafe('Meera 🎉 → ₹1,25,000 · ok'))).toBe(true)
  })
})
