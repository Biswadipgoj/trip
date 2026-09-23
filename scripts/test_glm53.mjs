const apiKey = "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";
const url = "https://integrate.api.nvidia.com/v1/chat/completions";

console.log("Sending request to NVIDIA NIM API for z-ai/glm-5.3...");
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
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Which number is larger, 9.11 or 9.8?" }
      ],
      temperature: 0.5,
      top_p: 1,
      max_tokens: 1024,
      stream: false
    })
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Status: ${res.status} ${res.statusText} (${duration}s)`);
  
  const data = await res.json();
  console.log("Response data:", JSON.stringify(data, null, 2));
} catch (err) {
  console.error("Fetch error:", err);
}
