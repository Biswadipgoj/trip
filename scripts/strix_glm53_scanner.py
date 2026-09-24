#!/usr/bin/env python3
import os
import sys
from pathlib import Path
from openai import OpenAI

API_KEY = os.environ["NVIDIA_API_KEY"]
BASE_URL = "https://integrate.api.nvidia.com/v1"
MODEL = "z-ai/glm-5.3"

root_dir = Path(__file__).resolve().parent.parent

target_files = [
    "src/lib/remote.ts",
    "src/lib/store.ts",
    "src/lib/utils.ts",
    "mobile/src/lib/store.ts",
    "mobile/src/lib/utils.ts",
]

playbooks = [
    "business_logic.md",
    "header_injection.md",
    "prototype_pollution.md",
    "idor.md",
    "authentication_jwt.md",
]

strix_dir = root_dir / ".biswodip" / "upstream" / "strix" / "strix" / "skills" / "vulnerabilities"

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

print(f"[STRIX] Strix AI Security Scanner ({MODEL} Powered)")
print(f"[CONFIG] Base URL: {BASE_URL}")
print(f"[CONFIG] Model: {MODEL}")
print("[INFO] Preparing code inspection payload...\n", flush=True)

context_payload = "--- STRIX VULNERABILITY PLAYBOOKS ---\n"
for pb in playbooks:
    p_path = strix_dir / pb
    if p_path.exists():
        context_payload += f"### Playbook: {pb}\n{p_path.read_text(encoding='utf-8')[:2000]}\n\n"

context_payload += "--- APPLICATION SOURCE FILES ---\n"
for tf in target_files:
    f_path = root_dir / tf
    if f_path.exists():
        context_payload += f"### File: {tf}\n```typescript\n{f_path.read_text(encoding='utf-8')}\n```\n\n"

system_prompt = """You are Strix, the world-class autonomous AI penetration testing and security auditing agent.
Your objective is to conduct a rigorous white-box security review of the provided code against the OWASP Top 10 and Strix vulnerability playbooks.
Focus strictly on:
1. Business logic flaws (arithmetic drift, negative amounts, payment bypasses, balance tampering, sponsorship abuse).
2. Input validation & injection (CRLF in UPI URI, prototype pollution, JSON injection in packNotes/unpackNotes).
3. Authentication & Authorization (token validation, trip code impersonation, PIN validation, state replay).
4. Data integrity & state corruption across offline storage.

Format your response as a professional Strix Penetration Test Report:
- Executive Summary
- Verification of previous patches (negative expense block, UPI CRLF sanitization, prototype pollution elimination, self-sponsorship prevention)
- Findings Table (Vulnerability, Severity, CWE/OWASP, File & Line, Status)
- Detailed Analysis of each finding with Proof of Concept (PoC) and Remediation recommendations
- Final Security & Release Verdict (PASS / CONDITIONAL PASS / FAIL)"""

client = OpenAI(base_url=BASE_URL, api_key=API_KEY)

print("[START] Dispatching request to NVIDIA NIM API for z-ai/glm-5.3...", flush=True)

try:
    completion = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Please review the following code using the Strix playbooks:\n\n{context_payload}"}
        ],
        temperature=0.3,
        top_p=0.95,
        max_tokens=4096,
        stream=True
    )

    out_dir = root_dir / "strix_runs"
    out_dir.mkdir(parents=True, exist_ok=True)
    report_file = out_dir / "strix-glm-5.3-report.md"

    collected_content = []
    print("\n--- STRIX GLM-5.3 AUDIT STREAMING ---\n", flush=True)

    for chunk in completion:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        content = delta.content
        if content:
            collected_content.append(content)
            sys.stdout.write(content)
            sys.stdout.flush()

    report_text = "".join(collected_content)
    report_file.write_text(report_text, encoding='utf-8')
    print(f"\n\n[COMPLETE] Report saved to: {report_file}", flush=True)

except Exception as e:
    print(f"\n[ERROR] Strix scan failed: {e}", file=sys.stderr, flush=True)
    sys.exit(1)
