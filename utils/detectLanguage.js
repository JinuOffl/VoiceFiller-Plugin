import { LLM_CONFIG } from './llmConfig.js';

export async function detectSecondaryLanguage() {
  const sampleText = document.body.innerText.slice(0, 500);
  const res = await fetch(LLM_CONFIG.API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LLM_CONFIG.API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: LLM_CONFIG.MODEL,
      messages: [
        { role: "system", content: "Return only the dominant language code (ISO 639-1) for the given text." },
        { role: "user", content: sampleText }
      ]
    })
  });

  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || "en";
}
