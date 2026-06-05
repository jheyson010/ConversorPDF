const fs = require('fs');
const { chromium } = require('playwright-core');

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

(async () => {
  const input = JSON.parse(await readStdin());
  const browser = await chromium.launch({ executablePath: input.executablePath, headless: true });
  try {
    const page = await browser.newPage();
    const base64 = fs.readFileSync(input.pdfPath).toString('base64');
    const pages = await page.evaluate(async ({ base64: pdfBase64 }) => {
      const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
      const binary = atob(pdfBase64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const pdf = await pdfjs.getDocument({ data: bytes, isImageDecoderSupported: false }).promise;
      const rendered = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const pdfPage = await pdf.getPage(pageNumber);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        rendered.push({
          base64: canvas.toDataURL('image/png').split(',')[1],
          pdfWidth: baseViewport.width,
          pdfHeight: baseViewport.height,
          displayWidth: Math.round((baseViewport.width / 72) * 96),
          displayHeight: Math.round((baseViewport.height / 72) * 96),
        });
      }
      return rendered;
    }, { base64 });
    process.stdout.write(JSON.stringify({ pages }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(error.stack || error.message);
  process.exit(1);
});
