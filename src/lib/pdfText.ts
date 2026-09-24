// jsPDF's built-in fonts (Helvetica etc.) only cover Latin-1. A string with
// any other character — the rupee sign, an arrow, an emoji in a trip name —
// is written as UTF-16 and the whole line prints as garbage. Convert what has
// a readable ASCII form and drop the rest.
export function pdfSafe(text: string): string {
  return text
    .replace(/₹/g, 'Rs. ')
    .replace(/→/g, '->')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x00-\xFF]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim()
}
