const apiKey = "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";
const url = "https://integrate.api.nvidia.com/v1/chat/completions";

console.log("Testing nemotron with key nvapi-LaEk...");
const startTime = Date.now();

try {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "nvidia/nemotron-3-ultra-550b-a55b",
      messages: [
        { role: "user", content: "Say hello in 3 words" }
      ],
      temperature: 0.5,
      max_tokens: 32,
      stream: false
    }),
    signal: AbortSignal.timeout(15000)
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Status: ${res.status} ${res.statusText} (${duration}s)`);
  const data = await res.json();
  console.log("Content:", data.choices?.[0]?.message?.content || data);
} catch (err) {
  console.error("Error:", err.message);
}
