#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

/**
 * Strix AI Security Scanner powered by OpenRouter API
 * Audits TripMate web and mobile source code against Strix's 29 vulnerability playbooks.
 */

const apiKey = process.env.OPENROUTER_API_KEY || process.argv.find((_, i, arr) => arr[i - 1] === '--key')
const model = process.env.OPENROUTER_MODEL || process.argv.find((_, i, arr) => arr[i - 1] === '--model') || 'anthropic/claude-3.5-sonnet'
const outputFile = process.argv.find((_, i, arr) => arr[i - 1] === '--output') || 'strix-openrouter-report.md'

if (!apiKey) {
  console.error('\n❌ Error: Missing OPENROUTER_API_KEY.')
  console.error('Usage: OPENROUTER_API_KEY="sk-or-v1-..." node scripts/strix-ai-scanner.mjs')
  console.error('   or: node scripts/strix-ai-scanner.mjs --key "sk-or-v1-..." [--model "model-name"]\n')
  process.exit(1)
}

const rootDir = process.cwd()

// Target source files to audit
const targetFiles = [
  'src/lib/remote.ts',
  'src/lib/store.ts',
  'src/lib/utils.ts',
  'mobile/src/lib/store.ts',
  'mobile/src/lib/utils.ts',
]

// Relevant Strix vulnerability playbooks
const strixSkillDir = path.join(rootDir, '.biswodip/upstream/strix/strix/skills/vulnerabilities')
const playbooks = ['business_logic.md', 'header_injection.md', 'prototype_pollution.md', 'idor.md', 'authentication_jwt.md']

console.log('🦅 Strix AI Security Scanner (OpenRouter Powered)')
console.log(`🤖 Model: ${model}`)
console.log('📂 Loading target codebase files and Strix vulnerability playbooks...\n')

// For models with 32k context, focus on primary security-critical files
const isCompact = model.includes('glm-5.2') || model.includes('32k')
const activeFiles = isCompact
  ? ['src/lib/remote.ts', 'src/lib/utils.ts', 'mobile/src/lib/utils.ts']
  : targetFiles

let contextPayload = '--- STRIX VULNERABILITY PLAYBOOKS ---\n'
for (const pb of playbooks) {
  const pPath = path.join(strixSkillDir, pb)
  if (fs.existsSync(pPath)) {
    const content = fs.readFileSync(pPath, 'utf8')
    // In compact mode, extract headings and key checklist sections
    const trimmed = isCompact ? content.slice(0, 1800) : content
    contextPayload += `### Playbook: ${pb}\n${trimmed}\n\n`
  }
}

contextPayload += '--- APPLICATION SOURCE FILES ---\n'
for (const rel of activeFiles) {
  const fPath = path.join(rootDir, rel)
  if (fs.existsSync(fPath)) {
    contextPayload += `### File: ${rel}\n\`\`\`typescript\n${fs.readFileSync(fPath, 'utf8')}\n\`\`\`\n\n`
  }
}

async function runAudit() {
  console.log('🚀 Sending security assessment request to OpenRouter API...')
  
  const systemPrompt = `You are Strix, the elite autonomous AI penetration testing agent.
Your objective is to conduct a rigorous white-box security review of the provided code against the OWASP Top 10 and Strix vulnerability playbooks.
Focus strictly on:
1. Business logic flaws (arithmetic drift, negative amounts, payment bypasses, balance tampering).
2. Input validation & injection (CRLF in UPI URI, prototype pollution, JSON injection in packNotes/unpackNotes).
3. Authentication & Authorization (token validation, trip code impersonation, PIN validation, state replay).
4. Data integrity & state corruption across offline storage.

Format your response as a professional Strix Penetration Test Report with:
- Executive Summary
- Findings Table (Vulnerability, Severity, CWE/OWASP, File & Line, Status)
- Detailed Analysis of each finding with Proof of Concept (PoC) and Remediation
- Release Verdict (PASS / CONDITIONAL PASS / FAIL)`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/Biswadipgoj/trip',
        'X-Title': 'TripMate Strix Audit',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please review the following code using the Strix playbooks:\n\n${contextPayload}` },
        ],
        temperature: 0.2,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenRouter API error (HTTP ${res.status}): ${errText}`)
    }

    const data = await res.json()
    const reportContent = data.choices?.[0]?.message?.content || 'No response content returned.'

    const outDir = path.join(rootDir, 'strix_runs')
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

    const reportPath = path.join(outDir, outputFile)
    fs.writeFileSync(reportPath, reportContent, 'utf8')

    console.log('\n✅ Strix OpenRouter Security Audit Complete!')
    console.log(`📄 Report saved to: ${reportPath}\n`)
    console.log(reportContent.slice(0, 1000) + '\n... [See full report in strix_runs/strix-openrouter-report.md]')
  } catch (err) {
    console.error('\n❌ Audit failed:', err.message)
    process.exit(1)
  }
}

runAudit()
