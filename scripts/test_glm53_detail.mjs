const apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) { console.error("Set NVIDIA_API_KEY in your shell (never commit it)."); process.exit(1); }
const url = "https://integrate.api.nvidia.com/v1/chat/completions";

console.log("Testing z-ai/glm-5.3 with 60s timeout...");
const startTime = Date.now();

try {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "z-ai/glm-5.3",
      messages: [
        { role: "user", content: "Which number is larger, 9.11 or 9.8? Answer in 5 words." }
      ],
      temperature: 0.5,
      max_tokens: 64,
      stream: false
    }),
    signal: AbortSignal.timeout(60000)
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Status: ${res.status} ${res.statusText} (${duration}s)`);
  const data = await res.json();
  console.log("Response JSON:", JSON.stringify(data, null, 2));
} catch (err) {
  console.error("Error:", err.message);
}
