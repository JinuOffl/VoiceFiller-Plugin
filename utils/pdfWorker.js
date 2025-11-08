// utils/pdfWorker.js

// Wait until both jsPDF and autoTable are really ready
async function waitForPDFPlugins(timeout = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const hasJSPDF = typeof window.jsPDF === 'function';
      // autoTable can live on jsPDF.autoTable or jsPDF.API.autoTable
      const hasAutoTable =
        (window.jsPDF && typeof window.jsPDF.autoTable === 'function') ||
        (window.jsPDF?.API && typeof window.jsPDF.API.autoTable === 'function');

      if (hasJSPDF && hasAutoTable) return resolve(true);

      if (Date.now() - start > timeout) {
        const errors = [];
        if (!hasJSPDF) errors.push("❌ jsPDF missing");
        if (!hasAutoTable) errors.push("❌ autoTable missing");
        return reject(errors.join(" | "));
      }

      setTimeout(check, 50);
    };

    check();
  });
}

window.addEventListener('message', async (event) => {
  if (event.data?.type !== 'GENERATE_PDF') return;
  const { summaryData } = event.data;

  // 1️⃣ Wait for both libraries
  try {
    await waitForPDFPlugins();
    console.log("✅ jsPDF and autoTable loaded successfully");
  } catch (err) {
    console.error("❌ PDF plugin check failed:", err);
    return;
  }

  // 2️⃣ Build the document
  const doc = new window.jsPDF();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold"); // Optional
    doc.text("VoiceFiller Form Summary", 20, 20);


  const rows = summaryData.map(({ label, value }) => [label, value]);

  // 3️⃣ Generate the table
  doc.autoTable({
    startY: 30,
    head: [["Field", "Value"]],
    body: rows,
    styles: {
      fontSize: 12,
      cellPadding: 5,
    },
    headStyles: {
      fillColor: [0, 102, 204],
      textColor: 255,
      fontStyle: 'bold'
    }
  });

  // 4️⃣ Trigger the download
  const blob = doc.output('blob');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = "Form_Summary.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
});
