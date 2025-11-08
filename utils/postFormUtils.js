// ✅ postFormUtils.js (updated with fallback prompts for vague re-edits)

import { speak, delay, listenWithRetry } from './voiceUtils.js';
import { extractEditIntent } from './llmUtils.js';
import { fillField } from './formUtils.js';

export function clickSubmitButton() {
  const submitBtn = document.querySelector('button[type="submit"], input[type="submit"], [role="button"]');
  if (submitBtn) {
    submitBtn.click();
    return true;
  }
  return false;
}

export async function downloadPDFSummary(inputs, labels) {
  console.log("🧠 downloadPDFSummary() called");

  // 🧠 Only load once
  if (!window.jsPDF) {
    const script1 = document.createElement('script');
    script1.src = chrome.runtime.getURL('utils/libs/jspdf.min.js');
    script1.type = 'text/javascript';
    document.head.appendChild(script1);
    await new Promise((res, rej) => {
      script1.onload = res;
      script1.onerror = rej;
    });
  }

  if (!window.jspdf?.autoTable) {
    const script2 = document.createElement('script');
    script2.src = chrome.runtime.getURL('utils/libs/jspdf.plugin.autotable.min.js');
    script2.type = 'text/javascript';
    document.head.appendChild(script2);
    await new Promise((res, rej) => {
      script2.onload = res;
      script2.onerror = rej;
    });
  }

  if (!window._voicefiller_pdfWorkerLoaded) {
    const workerScript = document.createElement('script');
    workerScript.src = chrome.runtime.getURL('utils/pdfWorker.js');
    workerScript.type = 'text/javascript';
    document.body.appendChild(workerScript);
    await new Promise((res, rej) => {
      workerScript.onload = () => {
        window._voicefiller_pdfWorkerLoaded = true;
        res();
      };
      workerScript.onerror = rej;
    });
  }

  // ✨ Build summaryData for PDF
  const summaryData = inputs.map((input, i) => {
    let val = "empty";
    if (input.type === "radio") {
      const group = document.querySelectorAll(`input[name="${input.name}"]`);
      const checked = Array.from(group).find(el => el.checked);
      val = checked?.labels?.[0]?.innerText || "not selected";
    } else if (input.type === "checkbox") {
      val = input.checked ? "on" : "off";
    } else {
      val = input.value || "empty";
    }
    return { label: labels[i], value: val };
  });

  // 📨 Send data to pdfWorker
  window.postMessage({
    type: 'GENERATE_PDF',
    summaryData
  }, "*");
}


function injectedPDFDownload({ summaryData }) {
  if (!window.jsPDF) {
    console.error("jsPDF not available in page context");
    return;
  }

  const doc = new window.jsPDF();
  doc.setFontSize(14);
  doc.text("📝 VoiceFiller Form Summary", 20, 20);

  let y = 30;
  for (const { label, value } of summaryData) {
    doc.text(`${label}: ${value}`, 20, y);
    y += 10;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }

  const blob = doc.output('blob');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = "Form_Summary.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function handlePostFormLoop(inputs, labels, prompts, recognition) {
  while (true) {
    await speak("Do you want to submit, re-edit, or summary?");
    await delay(400);

    const command = await listenWithRetry(recognition, "post-form action", null, 2);
    const cmd = command.toLowerCase();

    if (cmd.includes("submit")) {
      const success = clickSubmitButton();
      await speak(success ? "Form submitted. Thank you!" : "Couldn't find a submit button.");
      break;
    }
    
    else if (cmd.includes("summary") || cmd.includes("download") || cmd.includes("pdf") || cmd.includes("copy")) {
      // Start PDF generation *in parallel*
      const { downloadPDFSummary } = await import('./postFormUtils.js');
      const pdfTask = downloadPDFSummary(inputs, labels); // async promise started now
      console.log("downloadPDFSummary() called");

      // Speak each summary while PDF is generating
      for (let i = 0; i < inputs.length; i++) {
        let val = "empty";
        const input = inputs[i];

        if (input.type === "radio") {
          const group = document.querySelectorAll(`input[name="${input.name}"]`);
          const checked = Array.from(group).find(el => el.checked);
          val = checked?.labels?.[0]?.innerText || "not selected";
        } else if (input.type === "checkbox") {
          val = input.checked ? "on" : "off";
        } else {
          val = input.value || "empty";
        }

        await speak(`${labels[i]} is ${val}`);
        await delay(300);
      }

      // Wait for PDF to finish and notify
      await pdfTask;
      await speak("PDF summary downloaded.");
      continue;
    }

    const clarified = await extractEditIntent(command, labels);
    console.log("🧠 Parsed intent:", clarified);

    if (clarified.action === "edit") {
      let fieldIndex = labels.findIndex(label =>
        label.toLowerCase().includes((clarified.field || "").toLowerCase())
      );

      // Ask for field if missing
      if (!clarified.field || fieldIndex === -1) {
        await speak("Which field would you like to re-edit?");
        const fieldResponse = await listenWithRetry(recognition, "field name", null, 2);

        const normalize = txt => txt?.toLowerCase().replace(/[^\w\s]/gi, '').trim();
        const responseNorm = normalize(fieldResponse);
        fieldIndex = labels.findIndex(label => normalize(label).includes(responseNorm));
      }

      if (fieldIndex !== -1 && inputs[fieldIndex]) {
        let newVal = clarified.value;

      if (!newVal) {
        await speak(`What value should I update ${labels[fieldIndex]} to?`);
        newVal = await listenWithRetry(recognition, labels[fieldIndex], inputs[fieldIndex], 2);
      }

      if (newVal && inputs[fieldIndex]) {
        await fillField(inputs[fieldIndex], newVal, labels[fieldIndex], prompts[fieldIndex]);
        await speak(`${labels[fieldIndex]} updated.`);
      } else {
        await speak(`I couldn't get a valid value to update ${labels[fieldIndex]}.`);
      }

      continue;
    } else {
      await speak("Sorry, I couldn’t identify the field to edit.");
    }

    } else {
      // nothing extra
    }
  }
}
