console.log("✅ content.js loaded");


let voiceUI = null;
let isRunning = false;
let wakeTriggered = false;


function normalize(text) {
  return text?.toLowerCase().replace(/[^\w\s]/gi, '').trim();
}

function isPositiveResponse(value) {
  const positiveWords = ['yes', 'true', 'check', 'select', 'tick', 'mark', 'on', '1', 'yep', 'yeah', 'correct'];
  const cleanValue = value.toLowerCase().trim();
  return positiveWords.some(word => cleanValue.includes(word));
}

(async () => {
  const {
    getAllFormInputs,
    getFieldData,
    fillField,
    isSkippable,
  } = await import('./utils/formUtils.js');

  const {
    speak,
    delay,
    listenWithRetry,
  } = await import('./utils/voiceUtils.js');

  const {
    extractUsefulInput,
    generateNaturalPromptsDual,
    generatePageIntro
  } = await import('./utils/llmUtils.js');

  const { handlePostFormLoop } = await import('./utils/postFormUtils.js');
  const { detectSecondaryLanguage } = await import('./utils/detectLanguage.js');
  const { VoiceRhombusUI } = await import('./utils/voiceRhombusUI.js');

  // Create rhombus UI but don't show it yet
  voiceUI = new VoiceRhombusUI();
  window.voiceRhombusInstance = voiceUI; // for voiceUtils sync
  voiceUI.hide(); // Hidden initially

  // Wake word callback
  voiceUI.setOnWakeWordCallback(() => {
    if (wakeTriggered || isRunning) return;
    wakeTriggered = true;
    voiceUI.show();
    startVoiceFilling().finally(() => {
      wakeTriggered = false;
    });
  });

  setTimeout(() => {
    voiceUI.startWakeWordDetection();
  }, 1000);

  chrome.runtime.onMessage.addListener(async (req) => {
    if (req.action === "startVoiceFill") {
      if (isRunning) return;
      isRunning = true;
      await startVoiceFilling();
      isRunning = false;
    }
  });
let isRunning = false;
let wakeTriggered = false;

async function startVoiceFilling() {
  if (isRunning) {
    console.warn("⚠️ Voice fill already in progress. Ignoring duplicate.");
    return;
  }

  isRunning = true;
  try {
    voiceUI.setState('listening');
    const inputs = getAllFormInputs();
    const fieldData = getFieldData(inputs);
    const labels = fieldData.map(f => f.label);

    const intro = await generatePageIntro();
    voiceUI.setState('speaking');
    await speak(intro);
    await delay(400);

    const langCode = await detectSecondaryLanguage();
    const dualPrompts = await generateNaturalPromptsDual(fieldData, langCode);

    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";

    for (let i = 0; i < inputs.length; i++) {
      const field = inputs[i];
      const { en, local } = dualPrompts[i] || {};
      const prompt = local ? `${en} (${local})` : en;

      if (isSkippable(field)) continue;

      // SPEAK prompt
      voiceUI.setState('speaking');
      if (en) await speak(en, "en");
      if (local && langCode !== "en") {
        try { await speak(local, langCode); } catch {}
      }

      await delay(500);

      // LISTEN
      voiceUI.setState('listening');
      const value = await listenWithRetry(recognition, en, field, 3);

      // TYPING
      voiceUI.setState('typing');
      await fillField(field, value, en, prompt);
      await delay(200);
    }

    // DONE
    voiceUI.setState('speaking');
    await speak("All fields are filled");
    await handlePostFormLoop(inputs, labels, dualPrompts, recognition);
    voiceUI.setState('idle');

  } catch (err) {
    console.error("❌ Error in voice fill:", err);
    voiceUI.setState('idle');
    await speak("Sorry, something went wrong.");
  } finally {
    isRunning = false;
  }
}
})();
