const apiKey = "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";
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
