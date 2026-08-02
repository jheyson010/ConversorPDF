import React, { useEffect, useRef, useState } from 'react';

const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
const WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

let pdfjsPromise = null;
const pdfDocCache = new Map();

function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(/* webpackIgnore: true */ PDFJS_URL).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = WORKER_URL;
      return lib;
    });
  }
  return pdfjsPromise;
}

export function PdfThumbnail({ docUrl, pageNum, width = 90, rotation = 0, fallbackLabel }) {
  const canvasRef = useRef(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!docUrl) return;
    let cancelled = false;

    async function renderThumb() {
      try {
        const lib = await getPdfjs();
        let pdfDoc = pdfDocCache.get(docUrl);
        if (!pdfDoc) {
          pdfDoc = await lib.getDocument({ url: docUrl, withCredentials: true }).promise;
          pdfDocCache.set(docUrl, pdfDoc);
        }

        if (cancelled || !canvasRef.current || pageNum > pdfDoc.numPages) return;
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled || !canvasRef.current) return;

        const baseVp = page.getViewport({ scale: 1, rotation });
        const scale = width / baseVp.width;
        const vp = page.getViewport({ scale, rotation });

        const canvas = canvasRef.current;
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;

        if (!cancelled) setRendered(true);
      } catch (_err) {
        // Silently fallback if error
      }
    }

    renderThumb();
    return () => { cancelled = true; };
  }, [docUrl, pageNum, width, rotation]);

  return (
    <div className="pdf-thumb-wrapper" style={{ width: `${width}px`, position: 'relative' }}>
      <canvas ref={canvasRef} style={{ display: rendered ? 'block' : 'none', width: '100%', height: 'auto', borderRadius: '3px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
      {!rendered && (
        <span className="page-thumb-fallback">
          <i className="fas fa-file-pdf"></i>
          <b>{fallbackLabel || pageNum}</b>
        </span>
      )}
    </div>
  );
}
