chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("🔧 Extension installed.");
  if (request.action === 'download_pdf') {
    const url = 'data:application/pdf;base64,' + request.content;
    chrome.downloads.download({
      url: url,
      filename: request.filename,
      saveAs: false
    });
  }
});
