// Makes a PDF of the document on the device and hands it to the phone's share
// sheet (WhatsApp, email, Drive...). Where files cannot be shared, the PDF is
// downloaded instead.

const SCRIPTS = ['vendor/html2canvas.min.js', 'vendor/jspdf.umd.min.js'];
const RENDER_WIDTH = 794; // A4 width at 96 dpi
const PAGE = { width: 210, height: 297, margin: 10 }; // mm

let loading = null;

// Load the PDF libraries once. Called ahead of time so a tap on Share is quick
// enough for the browser to still allow opening the share sheet.
export function preloadPdfTools() {
  loading ??= Promise.all(SCRIPTS.map((src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(script);
  }))).catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

export function canShareFiles() {
  try {
    return Boolean(navigator.canShare?.({ files: [new File(['%PDF'], 'test.pdf', { type: 'application/pdf' })] }));
  } catch {
    return false;
  }
}

// Render the document at A4 width (whatever the screen size) into a PDF blob.
export async function buildPdf(docEl) {
  await preloadPdfTools();
  const holder = document.createElement('div');
  holder.className = 'pdf-render';
  holder.style.width = `${RENDER_WIDTH}px`;
  holder.append(docEl.cloneNode(true));
  document.body.append(holder);
  try {
    await Promise.all([...holder.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
    const canvas = await window.html2canvas(holder.firstElementChild, { scale: 2, backgroundColor: '#ffffff', logging: false });
    return canvasToPdf(canvas);
  } finally {
    holder.remove();
  }
}

function canvasToPdf(canvas) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const width = PAGE.width - PAGE.margin * 2;
  const pageHeight = PAGE.height - PAGE.margin * 2;
  const pxPerMm = canvas.width / width;
  const slicePx = Math.floor(pageHeight * pxPerMm);

  // Long documents continue on further pages, one slice of the image each.
  for (let top = 0; top < canvas.height; top += slicePx) {
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = Math.min(slicePx, canvas.height - top);
    slice.getContext('2d').drawImage(canvas, 0, top, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
    if (top > 0) pdf.addPage();
    // 'FAST' compression keeps text sharp at a fraction of the size (~70 KB a page).
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', PAGE.margin, PAGE.margin, width, slice.height / pxPerMm, undefined, 'FAST');
  }
  return pdf.output('blob');
}

// Resolves 'shared' or 'downloaded'. Rejects with AbortError if the user
// closes the share sheet.
export async function shareOrDownload(blob, fileName, text) {
  const file = new File([blob], fileName, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: fileName, text });
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
