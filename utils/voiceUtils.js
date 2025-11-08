export async function speak(text, langCode = "en") {
  console.log(`🗣️ Speaking [${langCode}]:`, text);
  const voices = await loadVoices();

  const preferredFemaleVoice = voices.find(v =>
    v.lang.startsWith(langCode) &&
    /female|woman|susan|emma|zoe|linda|karen|padma|lekha/i.test(v.name)
  );

  const fallbackVoice = voices.find(v => v.lang.startsWith(langCode)) || voices.find(v => v.lang.startsWith("en"));

  const voiceToUse = preferredFemaleVoice || fallbackVoice;
  if (!voiceToUse) {
    console.warn(`⚠️ No voice found for language "${langCode}". Skipping speech.`);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voiceToUse;
  utterance.rate = 0.95;

  return new Promise(res => {
    utterance.onend = res;
    speechSynthesis.speak(utterance);
  });
}

export function loadVoices() {
  return new Promise(resolve => {
    let voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    speechSynthesis.onvoiceschanged = () => {
      voices = speechSynthesis.getVoices();
      resolve(voices);
    };
  });
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function listenWithRetry(recognition, label, field, maxRetries = 3) {
  const { extractUsefulInput } = await import('./llmUtils.js');
  const { isValid } = await import('./formUtils.js');
  const { delay } = await import('./voiceUtils.js');
  const { toggleMicIndicator } = await import('./voiceUtils.js');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🎤 Voice attempt ${attempt}/${maxRetries} for: ${label}`);

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      console.warn("🚫 SpeechRecognition not supported in this browser.");
      return "";
    }

    try {
      const value = await new Promise((resolve, reject) => {
        delay(300); 
        recognition.start();
        console.log("Recognition started, listening...");

        const timeout = setTimeout(() => {
          console.warn("⏱️ Auto-stopping recognition after 5s timeout.");
          recognition.stop();


        }, 5000);

        recognition.onresult = async (event) => {
          const spoken = event.results[0][0].transcript;
          console.log("🎤 Heard:", spoken);
          recognition.stop();
          await delay(100);

         const cleanValue = field
          ? await extractUsefulInput(spoken, label, field)
          : spoken;
          console.log("✅ Extracted:", cleanValue);

          if (isValid(cleanValue, field)) {
            resolve(cleanValue);
          } else {
            reject("Invalid input");
          }
        };

        recognition.onerror = (event) => {
          console.error("🚫 Recognition error:", event);
          clearTimeout(timeout);
          toggleMicIndicator('off');
          reject("Speech recognition error");
        };

        recognition.onend = () => {
          clearTimeout(timeout);
          toggleMicIndicator('off');
        };
      });

      return value;

    } catch (err) {
      console.warn(`⚠️ Empty/invalid input on attempt ${attempt}`);
      if (attempt < maxRetries) {
        await speak("I didn't catch that. Please try again.");
      }
    }
  }

  return "";
}

export function toggleMicIndicator(state) {
  const micIcon = document.getElementById('voicefiller-mic-indicator');
  if (micIcon) {
    micIcon.style.color = state === 'on' ? 'green' : 'gray';
    micIcon.textContent = state === 'on' ? '🎙️ Listening...' : '🎤 Idle';
  }
}

export function ensureMicIndicator() {
  let micIcon = document.getElementById('voicefiller-mic-indicator');
  if (!micIcon) {
    micIcon = document.createElement('div');
    micIcon.id = 'voicefiller-mic-indicator';
    micIcon.style.position = 'fixed';
    micIcon.style.bottom = '10px';
    micIcon.style.right = '10px';
    micIcon.style.padding = '5px 10px';
    micIcon.style.backgroundColor = '#fff';
    micIcon.style.color = 'gray';
    micIcon.style.border = '1px solid #ccc';
    micIcon.style.borderRadius = '5px';
    micIcon.style.zIndex = 9999;
    micIcon.style.fontSize = '14px';
    micIcon.style.fontFamily = 'sans-serif';
    micIcon.textContent = '🎤 Idle';
    document.body.appendChild(micIcon);
  }
  return micIcon;
}