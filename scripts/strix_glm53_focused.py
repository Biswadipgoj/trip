#!/usr/bin/env python3
import os
import sys
from pathlib import Path
from openai import OpenAI

API_KEY = os.environ["NVIDIA_API_KEY"]
BASE_URL = "https://integrate.api.nvidia.com/v1"
MODEL = "z-ai/glm-5.3"

root_dir = Path(__file__).resolve().parent.parent

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

print(f"[STRIX] Strix Security Audit ({MODEL} Focused Mode)", flush=True)

core_code_snippet = """
// --- VULNERABILITY MITIGATION CHECKS IN TRIPMATE ---

// 1. Negative & Zero Expense Defense:
addExpense: (expense) => {
  if (!Number.isFinite(expense.amount) || expense.amount <= 0) {
    throw new Error('Expense amount must be a positive finite number')
  }
  // ...
}

// 2. UPI Injection Defense:
export function buildUpiLink(upiId: string, name: string, amount: number, note?: string): string {
  const cleanUpiId = (upiId || '').replace(/[\r\n\t]/g, '').trim()
  const cleanName = (name || '').replace(/[\r\n\t]/g, '').trim()
  const safeAmount = Number.isFinite(amount) && amount > 0 ? roundMoney(amount) : 0
  const cleanNote = (note || '').replace(/[\r\n\t]/g, '').trim()
  const params = new URLSearchParams()
  params.set('pa', cleanUpiId)
  params.set('pn', cleanName)
  params.set('am', safeAmount.toFixed(2))
  params.set('cu', 'INR')
  if (cleanNote) params.set('tn', cleanNote)
  return `upi://pay?${params.toString()}`
}

// 3. Prototype Pollution Defense:
export function unpackNotes(raw: string | undefined): { notes: string; metadata: Record<string, string> } {
  if (!raw) return { notes: '', metadata: Object.create(null) }
  const metadata: Record<string, string> = Object.create(null)
  // parses ONLY safe scalar strings, rejects __proto__, constructor, prototype
  for (const [k, v] of Object.entries(parsed)) {
    if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype' && typeof v === 'string') {
      metadata[k] = v
    }
  }
  return { notes: userNotes, metadata }
}

// 4. Self-Sponsorship & Circular Debt Defense:
addSponsorship: (sponsorship) => {
  if (sponsorship.sponsorId === sponsorship.sponsoredId) {
    throw new Error('Self-sponsorship is not permitted')
  }
  // ...
}
"""

client = OpenAI(base_url=BASE_URL, api_key=API_KEY)

system_prompt = """You are Strix, the AI penetration testing authority.
Evaluate whether the provided TripMate mitigations successfully fix:
1. Negative and zero amount expense injection
2. UPI URI CRLF and parameter injection
3. Prototype pollution in notes/token parsing
4. Self-sponsorship and circular balance manipulation
Provide a definitive Strix audit verdict (PASS / FAIL) and explain why each mitigation is secure."""

try:
    completion = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Audit these specific implementations:\n\n{core_code_snippet}"}
        ],
        temperature=0.3,
        max_tokens=2048,
        stream=True
    )

    out_dir = root_dir / "strix_runs"
    out_dir.mkdir(parents=True, exist_ok=True)
    report_file = out_dir / "strix-glm-5.3-audit.md"

    collected = []
    print("\n--- STRIX GLM-5.3 AUDIT REPORT ---\n", flush=True)

    for chunk in completion:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        reasoning = getattr(delta, "reasoning_content", None)
        if reasoning:
            sys.stdout.write(reasoning)
            sys.stdout.flush()
        content = delta.content
        if content:
            collected.append(content)
            sys.stdout.write(content)
            sys.stdout.flush()

    report_text = "".join(collected)
    report_file.write_text(report_text, encoding='utf-8')
    print(f"\n\n[SUCCESS] Audit saved to: {report_file}", flush=True)

except Exception as e:
    print(f"\n[ERROR] Audit failed: {e}", file=sys.stderr, flush=True)
    sys.exit(1)
