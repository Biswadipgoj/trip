const apiKey = process.env.NVIDIA_API_KEY;
if (!apiKey) { console.error("Set NVIDIA_API_KEY in your shell (never commit it)."); process.exit(1); }
const url = "https://integrate.api.nvidia.com/v1/models";

try {
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(10000)
  });

  const data = await res.json();
  const allIds = (data.data || []).map(m => m.id);
  console.log(`Total models: ${allIds.length}`);
  const glmModels = allIds.filter(id => id.toLowerCase().includes("glm") || id.toLowerCase().includes("z-ai") || id.toLowerCase().includes("zhipu"));
  console.log("Matching models:", glmModels);
} catch (err) {
  console.error("Models fetch error:", err.message);
}
