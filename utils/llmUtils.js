// ✅ llmUtils.js (self-contained and modular)

import { LLM_CONFIG } from './llmConfig.js';


export async function findBestSelectOption(spokenValue, options) {
  try {
    const optionsList = options.map(opt => `${opt.value}: ${opt.text}`).join('\n');

    const res = await fetch(LLM_CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LLM_CONFIG.API_KEY}`, // Replace with real key securely
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: LLM_CONFIG.MODEL,
        messages: [
          {
            role: "system",
            content: `Given this spoken input: "${spokenValue}", find the best matching option from this list. Return only the option value, nothing else.\n\nOptions:\n${optionsList}`
          }
        ]
      })
    });

    const data = await res.json();
    const selectedValue = data.choices?.[0]?.message?.content?.trim();
    return selectedValue ? options.find(opt => opt.value === selectedValue) : null;

  } catch (error) {
    console.error("findBestSelectOption failed:", error);
    return null;
  }
}

export async function formatDateInput(spokenDate) {
  try {
    const res = await fetch(LLM_CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LLM_CONFIG.API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: LLM_CONFIG.MODEL,
        messages: [
          {
            role: "system",
            content: `Convert this spoken date to YYYY-MM-DD format. If unclear, return the original text: "${spokenDate}"`
          }
        ]
      })
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || spokenDate;

  } catch (error) {
    console.error("formatDateInput failed:", error);
    return spokenDate;
  }
}

export async function generateNaturalPrompts(fieldLabels) {
  console.log("generateNaturalPrompts() started");

  try {
    const joinedPrompt = fieldLabels.map((item, i) => {
      const label = item.label;
      
      let opts = "";
      if (item.options?.length) {
        opts = ` Options: ${item.options.join(", ")}`;
      } else if (item.field?.type === "radio" || item.field?.type === "checkbox") {
        const group = document.querySelectorAll(`input[name='${item.field.name}']`);
        const labels = Array.from(group).map(el => el.labels?.[0]?.innerText).filter(Boolean);
        if (labels.length) opts = ` Options: ${labels.join(", ")}`;
      }

      return `${i + 1}. ${label}${opts}`;
    }).join("\n");

    const res = await fetch(LLM_CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LLM_CONFIG.API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: LLM_CONFIG.MODEL,
        messages: [
          {
            role: "system",
            content: `You're helping create quick voice prompts to autofill a web form. For each field below, return a short, natural question (under 10 words) that includes label and options (if any). Start each line with its number.\n\n${joinedPrompt}`
          }
        ],
        temperature: 0.3
      })
    }); 


    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    const prompts = content.split(/\n+/)
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
    
    console.log("✅ generateNaturalPrompts() ended:", prompts);
    return prompts;

  } catch (err) {
    console.error("⚠️ generateNaturalPrompts() error:", err.message);
    return fieldLabels.map(f => `May I know your ${f.label}?`);
  }
}

export async function extractUsefulInput(spokenText, label, field) {
  try {
    let options = [];
    if (field.type === "radio" || field.type === "checkbox") {
      const group = document.querySelectorAll(`input[name='${field.name}']`);
      options = Array.from(group).map(el => el.labels?.[0]?.innerText || el.value).filter(Boolean);
    } else if (field.tagName === "SELECT") {
      options = Array.from(field.options).map(opt => opt.text).filter(Boolean);
    }

    const optionsList = options.length ? `Valid options: ${options.join(", ")}.` : "";
    let systemPrompt = `You are a helpful assistant extracting a clean, valid value from the spoken input for a form field labeled "${label}".`;

    if (label.toLowerCase().includes("date")) {
      systemPrompt += ` Return only the date in the format YYYY-MM-DD. Do not include any explanation or extra text.`;
    } else {
      systemPrompt += ` ${optionsList} Return only the cleaned value.`;
    }

    const res = await fetch(LLM_CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LLM_CONFIG.API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: LLM_CONFIG.MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: spokenText }
        ],
        temperature: 0.1
      })
    });

    const data = await res.json();
    let result = data.choices?.[0]?.message?.content?.trim() || spokenText;

    if (label.toLowerCase().includes("date")) {
      const match = result.match(/\d{4}-\d{2}-\d{2}/);
      if (match) result = match[0];
    }

    return result;

  } catch (error) {
    console.error("❌ extractUsefulInput failed:", error);
    return spokenText;
  }
}

export async function extractEditIntent(spokenText, labels) {
  const labelList = labels.join(", ");
  const systemPrompt = `
You are a smart voice assistant for form editing.
Your job is to extract intent from casual spoken commands.
Understand fuzzy instructions like "re-edit", "change something", "fix age", "change email to abc@example.com".

Return only a JSON object:
{
  "action": "edit" | "submit" | "summary",
  "field": "field label from list: ${labelList}" or null,
  "value": "new value or null"
}

Even if the user doesn't say the field or value, still return null for them.
NEVER return markdown. NEVER include code blocks. Output ONLY valid JSON.
Input:
"${spokenText}"
`; 

  const res = await fetch(LLM_CONFIG.API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LLM_CONFIG.API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: LLM_CONFIG.MODEL,
      messages: [
        { role: "system", content: systemPrompt }
      ],
      temperature: 0.2
    })
  });

  const data = await res.json();
  try {
    const raw = data.choices?.[0]?.message?.content?.trim();
    return JSON.parse(raw);
    console.log("Raw GPT JSON:", raw);

  } catch (err) {
    console.error("❌ Failed to parse intent:", data, err);
    return { action: "", field: "", value: "" };
  }
}

export async function generatePageIntro() {
  const url = window.location.hostname;
  let siteName = url.replace("www.", "");

// 1️⃣ Try to find real visible title in DOM
const possibleTitleSelectors = [
  ".freebirdFormviewerViewHeaderTitle",
  "form h1", "form h2", "form .title", "form .form-title",
  "[role=dialog] h1", "[role=dialog] h2", ".modal-title", ".form-header",
  "h1", "h2", ".title", ".form-heading"
];

const blockedTitles = [
  "Select Country/Region",
  "Select country or region",
  "Country", "Region", "Choose country"
];

let title = "";
for (const selector of possibleTitleSelectors) {
  const el = document.querySelector(selector);
  const text = el?.innerText?.trim();
  if (text && text.length > 4 && !blockedTitles.includes(text)) {
    title = text;
    break;
  }
}

// 2️⃣ Fallback to document.title if blocked or missing
if (!title || blockedTitles.includes(title)) {
  title = document.title.trim();
}

// 3️⃣ Final fallback
if (!title || blockedTitles.includes(title)) {
  title = siteName.charAt(0).toUpperCase() + siteName.slice(1); // GitHub
}

// 4️⃣ Guess form purpose
const lower = `${title} ${document.title} ${window.location.href}`.toLowerCase();
const guess = lower.includes("sign up") || lower.includes("signup") ? "signup"
            : lower.includes("sign in") || lower.includes("login") ? "login"
            : lower.includes("feedback") ? "feedback"
            : lower.includes("contact") ? "contact"
            : lower.includes("register") ? "registration"
            : "form";

// 5️⃣ Debug logs
console.log("Guess   :", guess);
console.log("Title   :", title);
console.log("SiteName:", siteName);
console.log("URL     :", url);



const prompt = `
You're a voice assistant helping a blind user fill out a web form using speech.

Your job is to generate a **very short**, friendly, and clear spoken welcome message.

✅ Your intro should:
- Be under **10 words**.
- Mention:
  • the purpose of the form: "${guess}"
  • the form's visible title (if any): "${title}"
  • the website name: "${siteName}"
  • the page URL: "${url}"

🚫 Very important — NEVER do the following:
- Do NOT mention or guess field names like “email”, “username”, or “Select Country/Region”.
- Do NOT say what the form is about beyond what's in the title or purpose.
- Do NOT add instructions or start the form fill process in this sentence.
- Do NOT invent or hallucinate anything not provided in the input above.

✅ The message must sound natural and helpful. Stick to the facts only.

Here are examples of good outputs:
- "This is the Student Info Form from Google Forms. Lets begin"
- "Welcome to the signup form on github.com."
- "You're on the feedback form at notion.so."

Now generate the intro based only on the provided data above. Keep it simple and conversational.
`;


  try {
    const res = await fetch(LLM_CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LLM_CONFIG.API_KEY}`, // Replace with LLM_CONFIG.API_KEY if modular
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: LLM_CONFIG.MODEL,
        messages: [{ role: "system", content: prompt }],
        temperature: 0.5
      })
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim()
      || `You're on a ${guess} form from ${siteName}. Let's get started.`;
  } catch (err) {
    console.warn("❌ LLM failed, using fallback.");
    return `You're on a ${guess} form from ${siteName}. Let's get started.`;
  }
}

export async function generateNaturalPromptsDual(fieldLabels, targetLang = "ta") {
  console.log("🌍 generateNaturalPromptsDual() started");

  try {
    const joinedPrompt = fieldLabels.map((item, i) => {
      const label = item.label;
      const opts = item.options?.length ? ` Options: ${item.options.join(", ")}` : "";
      return `${i + 1}. ${label}${opts}`;
    }).join("\n");

    const prompt = `
For each form field below, generate a short natural question (max 10 words) to ask the user.

Return both versions:
1. English version
2. Translated version in this language: ${targetLang}

Format like:
- English: What's your name?
- Translated: உங்கள் பெயர் என்ன?

Here are the fields:
${joinedPrompt}
`;

    const res = await fetch(LLM_CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LLM_CONFIG.API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: LLM_CONFIG.MODEL,
        messages: [{ role: "system", content: prompt }],
        temperature: 0.3
      })
    });

    const lines = (await res.json()).choices?.[0]?.message?.content?.split(/\n+/) || [];
    const prompts = [];

    for (let i = 0; i < lines.length; i++) {
      const en = lines[i]?.match(/English:\s*(.+)/i)?.[1]?.trim();
      const local = lines[i + 1]?.match(/Translated:\s*(.+)/i)?.[1]?.trim();
      if (en || local) prompts.push({ en, local });
      i++; // skip next line (we already processed it)
    }

    console.log("✅ Dual prompts generated:", prompts);
    return prompts;

  } catch (err) {
    console.error("⚠️ generateNaturalPromptsDual() error:", err.message);
    return fieldLabels.map(f => ({ en: `May I know your ${f.label}?`, local: "" }));
  }
}
