document.getElementById("start").addEventListener("click", () => {
  document.getElementById("status").innerText = "Recording...";

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs[0] || !tabs[0].url.startsWith("http")) {
      console.error("🚫 No valid tab open.");
      document.getElementById("status").innerText = "Error: Invalid tab";
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, { action: "startVoiceFill" }, function (response) {
      if (chrome.runtime.lastError) {
        console.error("❌ Error:", chrome.runtime.lastError.message);
        document.getElementById("status").innerText = "Error occurred";
      } else {
        console.log("✅ Message sent");
        document.getElementById("status").innerText = "Voice filling started!";
      }
    });
  });
});

// Show wake word info
document.addEventListener('DOMContentLoaded', () => {
  const statusElement = document.getElementById("status");
  statusElement.innerHTML = 'Click button or say<br>"Hey Voice Filler"';
});