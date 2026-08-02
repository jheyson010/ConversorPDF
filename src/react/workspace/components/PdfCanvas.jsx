import React, { useCallback, useEffect, useRef, useState } from 'react';
import { isPdf } from '../constants.js';

const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
const WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function luminance([r, g, b]) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation([r, g, b]) {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

function colorDistance(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function sampleCanvasTextColors(target) {
  const page = target.closest('.react-pdf-page');
  const canvas = page?.querySelector('canvas');
  if (!canvas) return null;

  const canvasRect = canvas.getBoundingClientRect();
  const hitRect = target.getBoundingClientRect();
  const scaleX = canvas.width / canvasRect.width;
  const scaleY = canvas.height / canvasRect.height;
  const padX = Math.max(6, hitRect.width * 0.08);
  const padY = Math.max(14, hitRect.height * 1.4);
  const sx = Math.max(0, Math.floor((hitRect.left - canvasRect.left - padX) * scaleX));
  const sy = Math.max(0, Math.floor((hitRect.top - canvasRect.top - padY) * scaleY));
  const sw = Math.min(canvas.width - sx, Math.ceil((hitRect.width + padX * 2) * scaleX));
  const sh = Math.min(canvas.height - sy, Math.ceil((hitRect.height + padY * 2) * scaleY));
  if (sw <= 1 || sh <= 1) return null;

  let image;
  try {
    image = canvas.getContext('2d', { willReadFrequently: true }).getImageData(sx, sy, sw, sh).data;
  } catch (_error) {
    return null;
  }

  const buckets = new Map();
  const pixels = [];
  for (let i = 0; i < image.length; i += 16) {
    const alpha = image[i + 3];
    if (alpha < 200) continue;
    const rgb = [image[i], image[i + 1], image[i + 2]];
    pixels.push(rgb);
    const key = rgb.map((value) => Math.round(value / 24) * 24).join(',');
    const bucket = buckets.get(key) || { count: 0, sum: [0, 0, 0] };
    bucket.count += 1;
    bucket.sum[0] += rgb[0];
    bucket.sum[1] += rgb[1];
    bucket.sum[2] += rgb[2];
    buckets.set(key, bucket);
  }

  if (!pixels.length || !buckets.size) return null;

  const total = pixels.length;
  const sortedBuckets = [...buckets.values()].sort((a, b) => b.count - a.count);
  const saturatedBackground = sortedBuckets.find((bucket) => {
    const color = bucket.sum.map((sum) => sum / bucket.count);
    return bucket.count > total * 0.06 && saturation(color) > 0.18 && luminance(color) < 0.88;
  });
  const backgroundBucket = saturatedBackground || sortedBuckets[0];
  const background = backgroundBucket.sum.map((sum) => sum / backgroundBucket.count);
  const contrasting = pixels
    .filter((pixel) => colorDistance(pixel, background) > 95)
    .sort((a, b) => colorDistance(b, background) - colorDistance(a, background))
    .slice(0, Math.max(4, Math.floor(pixels.length * 0.2)));

  let foreground;
  if (contrasting.length) {
    foreground = contrasting
      .reduce((sum, pixel) => [sum[0] + pixel[0], sum[1] + pixel[1], sum[2] + pixel[2]], [0, 0, 0])
      .map((sum) => sum / contrasting.length);
  } else {
    foreground = luminance(background) > 0.58 && saturation(background) < 0.18 ? [17, 17, 17] : [255, 255, 255];
  }

  return {
    backgroundColor: rgbToHex(background),
    color: rgbToHex(foreground),
  };
}

function readableTextItem(item, styles, pageNum, index) {
  const text = String(item.str || '').replace(/\s+/g, ' ').trim();
  const transform = Array.isArray(item.transform) ? item.transform : [];
  const x = Number(transform[4] || 0);
  const y = Number(transform[5] || 0);
  const rawHeight = Math.abs(Number(item.height || transform[3] || 10));
  const style = styles?.[item.fontName] || {};
  const fontStr = `${style.fontFamily || ''} ${item.fontName || ''}`.toLowerCase();
  const fontFamily = fontStr.includes('courier') || fontStr.includes('mono') || fontStr.includes('code')
    ? 'Courier'
    : fontStr.includes('times') || fontStr.includes('serif') || fontStr.includes('georgia') || fontStr.includes('palatino') || fontStr.includes('cambria')
    ? 'TimesRoman'
    : 'Helvetica';
  const bold = /bold|black|heavy|semibold/i.test(fontStr);
  const size = clamp(rawHeight * 0.86, 7, 48);
  const width = Math.max(Number(item.width || 0), text.length * size * 0.42);
  const height = Math.max(rawHeight, size * 1.15);

  if (!text || width < 2 || height < 2) return null;

  return {
    sourceId: `${pageNum}-${index}-${Math.round(x)}-${Math.round(y)}`,
    text,
    x,
    y,
    width,
    height,
    size,
    fontFamily,
    bold,
  };
}

function buildTextBlocks(items, pageNum) {
  const sorted = [...items].sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);
  const lines = [];

  for (const item of sorted) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(3, item.height * 0.45));
    if (line) {
      line.items.push(item);
      line.y = (line.y * (line.items.length - 1) + item.y) / line.items.length;
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  return lines.flatMap((line, lineIndex) => {
    const chunks = [];
    const lineItems = [...line.items].sort((a, b) => a.x - b.x);
    let current = [];

    for (const item of lineItems) {
      const last = current[current.length - 1];
      const gap = last ? item.x - (last.x + last.width) : 0;
      const gapLimit = Math.max(26, Math.min(90, item.size * 3.2));
      if (last && gap > gapLimit) {
        chunks.push(current);
        current = [];
      }
      current.push(item);
    }
    if (current.length) chunks.push(current);

    return chunks.map((chunk, chunkIndex) => {
      const left = Math.min(...chunk.map((item) => item.x));
      const right = Math.max(...chunk.map((item) => item.x + item.width));
      const baseline = chunk.reduce((sum, item) => sum + item.y, 0) / chunk.length;
      const height = Math.max(...chunk.map((item) => item.height));
      const size = chunk.reduce((sum, item) => sum + item.size, 0) / chunk.length;
      const text = chunk.map((item) => item.text).join(' ').replace(/\s+([,.;:!?])/g, '$1').trim();
      return {
        sourceId: `block-${pageNum}-${lineIndex}-${chunkIndex}-${Math.round(left)}-${Math.round(baseline)}`,
        text,
        x: left,
        y: baseline,
        width: Math.max(12, right - left),
        height,
        size,
        fontFamily: chunk[0]?.fontFamily || 'Helvetica',
        bold: chunk.some((item) => item.bold),
      };
    }).filter((block) => block.text);
  });
}

function PageCanvas({ pdfDoc, pageNum, maxWidth, rotation = 0, onMeta, onTextItems }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    let renderTask = null;
    pdfDoc.getPage(pageNum).then(async (page) => {
      const normalizedRotation = ((Number(rotation || 0) % 360) + 360) % 360;
      const baseVp = page.getViewport({ scale: 1 });
      const displayVp = page.getViewport({ scale: 1, rotation: normalizedRotation });
      const scale = Math.min(1.8, Math.max(0.6, maxWidth / displayVp.width));
      const outputScale = Math.max(1, Math.min(2.5, globalThis.devicePixelRatio || 1));
      const vp = page.getViewport({ scale: scale * outputScale, rotation: normalizedRotation });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.style.width = `${Math.floor(displayVp.width * scale)}px`;
      canvas.style.height = `${Math.floor(displayVp.height * scale)}px`;
      const renderCanvas = document.createElement('canvas');
      renderCanvas.width = Math.floor(vp.width);
      renderCanvas.height = Math.floor(vp.height);
      canvas.width = renderCanvas.width;
      canvas.height = renderCanvas.height;
      renderTask = page.render({ canvasContext: renderCanvas.getContext('2d'), viewport: vp });
      const textContent = await page.getTextContent().catch(() => ({ items: [] }));
      if (!cancelled) {
        onMeta(pageNum, {
          scale,
          pdfHeight: baseVp.height,
          pdfWidth: baseVp.width,
          rotation: normalizedRotation,
          canvasW: Math.floor(displayVp.width * scale),
          canvasH: Math.floor(displayVp.height * scale),
        });
        const readableItems = textContent.items
          .map((item, index) => readableTextItem(item, textContent.styles, pageNum, index))
          .filter(Boolean);
        onTextItems(pageNum, buildTextBlocks(readableItems, pageNum));
      }
      await renderTask.promise.catch((error) => {
        if (!cancelled && error?.name !== 'RenderingCancelledException') throw error;
      });
      if (cancelled) return;
      const visibleContext = canvas.getContext('2d', { willReadFrequently: true });
      visibleContext.clearRect(0, 0, canvas.width, canvas.height);
      visibleContext.drawImage(renderCanvas, 0, 0);
    });
    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [pdfDoc, pageNum, maxWidth, rotation, onMeta, onTextItems]);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}

export function PdfCanvas({
  doc,
  annotations,
  setAnnotations,
  mode,
  textOptions,
  selectedId,
  setSelectedId,
  pageOrder = [],
  pageRotations = {},
  previewMode = false,
  setPageMeta,
}) {
  const containerRef = useRef(null);
  const [pdfjs, setPdfjs] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [pageMetas, setPageMetas] = useState({});
  const [textItemsByPage, setTextItemsByPage] = useState({});
  const [maxWidth, setMaxWidth] = useState(800);
  const [draftBox, setDraftBox] = useState(null);
  const focusPendingId = useRef(null);
  const draftRef = useRef(null);

  useEffect(() => {
    import(/* webpackIgnore: true */ PDFJS_URL).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = WORKER_URL;
      setPdfjs(lib);
    });
  }, []);

  useEffect(() => {
    if (!pdfjs || !doc || !isPdf(doc)) return;
    const w = containerRef.current?.clientWidth || 900;
    setMaxWidth(Math.max(540, Math.min(920, w - 48)));
    setPdfDoc(null);
    setNumPages(0);
    setPageMetas({});
    setTextItemsByPage({});
    pdfjs.getDocument({ url: doc.downloadUrl, withCredentials: true }).promise.then((pdf) => {
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setPageMeta?.({ pageCount: pdf.numPages });
    });
  }, [pdfjs, doc]);

  const handlePageMeta = useCallback((pageNum, meta) => {
    setPageMetas((prev) => {
      const next = { ...prev, [pageNum]: meta };
      if (pageNum === 1) setPageMeta?.({ pageCount: numPages, scale: meta.scale, pdfHeight: meta.pdfHeight, width: meta.canvasW, height: meta.canvasH });
      return next;
    });
  }, [numPages, setPageMeta]);

  const handleTextItems = useCallback((pageNum, items) => {
    setTextItemsByPage((prev) => ({ ...prev, [pageNum]: items }));
  }, []);

  function selectExistingText(hit, pageNum, event) {
    if (mode !== 'select') return;
    const existing = annotations.find((item) => item.sourceId === hit.sourceId);
    if (existing) {
      focusPendingId.current = existing.id;
      setSelectedId(existing.id);
      return;
    }

    const id = crypto.randomUUID();
    const sampled = sampleCanvasTextColors(event.currentTarget) || {};
    focusPendingId.current = id;
    setAnnotations((prev) => [...prev, {
      id,
      sourceId: hit.sourceId,
      page: pageNum,
      x: hit.x,
      y: hit.y,
      width: hit.width,
      height: hit.height,
      text: hit.text,
      size: Math.round(hit.size),
      color: sampled.color || textOptions.color,
      backgroundColor: sampled.backgroundColor || '#ffffff',
      fontFamily: hit.fontFamily || textOptions.fontFamily,
      bold: hit.bold || textOptions.bold,
      erase: true,
    }]);
    setSelectedId(id);
  }

  function pagePoint(event, pageNum) {
    const meta = pageMetas[pageNum];
    if (!meta) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      meta,
      canvasX: clamp(event.clientX - rect.left, 0, meta.canvasW),
      canvasY: clamp(event.clientY - rect.top, 0, meta.canvasH),
    };
  }

  function createTextBox(pageNum, left, top, width, height) {
    const meta = pageMetas[pageNum];
    if (!meta) return;
    const id = crypto.randomUUID();
    focusPendingId.current = id;
    setAnnotations((prev) => [...prev, {
      id,
      page: pageNum,
      x: left / meta.scale,
      y: meta.pdfHeight - ((top + height) / meta.scale),
      width: width / meta.scale,
      height: height / meta.scale,
      text: '',
      size: textOptions.size,
      color: textOptions.color,
      fontFamily: textOptions.fontFamily,
      bold: textOptions.bold,
      erase: false,
    }]);
    setSelectedId(id);
  }

  function startTextBox(event, pageNum) {
    if (mode !== 'addText') return;
    if (event.target.closest('.react-annotation')) return;
    const point = pagePoint(event, pageNum);
    if (!point) return;
    event.preventDefault();
    const draft = { page: pageNum, startX: point.canvasX, startY: point.canvasY, x: point.canvasX, y: point.canvasY };
    draftRef.current = draft;
    setDraftBox(draft);
  }

  function updateTextBox(event, pageNum) {
    if (mode !== 'addText' || !draftRef.current || draftRef.current.page !== pageNum) return;
    const point = pagePoint(event, pageNum);
    if (!point) return;
    const next = { ...draftRef.current, x: point.canvasX, y: point.canvasY };
    draftRef.current = next;
    setDraftBox(next);
  }

  function finishTextBox(event, pageNum) {
    if (mode !== 'addText' || !draftRef.current || draftRef.current.page !== pageNum) return;
    const point = pagePoint(event, pageNum);
    const draft = point ? { ...draftRef.current, x: point.canvasX, y: point.canvasY } : draftRef.current;
    draftRef.current = null;
    setDraftBox(null);
    const left = Math.min(draft.startX, draft.x);
    const top = Math.min(draft.startY, draft.y);
    const width = Math.abs(draft.x - draft.startX);
    const height = Math.abs(draft.y - draft.startY);
    if (width < 8 && height < 8) {
      createTextBox(pageNum, draft.startX, draft.startY, 220, Math.max(32, textOptions.size * 2.2));
      return;
    }
    createTextBox(pageNum, left, top, Math.max(32, width), Math.max(18, height));
  }

  if (!doc || !isPdf(doc)) return null;

  return (
    <div ref={containerRef} className="react-pdf-container">
      {numPages === 0 && (
        <div className="pdf-loading">
          <i className="fas fa-spinner fa-spin"></i> Cargando PDF...
        </div>
      )}
      {(pageOrder.length ? pageOrder : Array.from({ length: numPages }, (_, i) => i + 1))
        .filter((pageNum) => pageNum >= 1 && pageNum <= numPages)
        .map((pageNum, displayIndex) => {
        const meta = pageMetas[pageNum] || { scale: 1, pdfHeight: 842, canvasW: 0, canvasH: 0 };
        const rotation = ((Number(pageRotations[pageNum] || 0) % 360) + 360) % 360;
        const pageAnnotations = annotations.filter((a) => a.page === pageNum);
        const textItems = textItemsByPage[pageNum] || [];
        const overlaysAvailable = rotation === 0;
        return (
          <div
            key={pageNum}
            id={`pdf-page-${pageNum}`}
            className={`react-pdf-page ${mode === 'addText' ? 'mode-addtext' : ''}`}
            onPointerDown={(e) => startTextBox(e, pageNum)}
            onPointerMove={(e) => updateTextBox(e, pageNum)}
            onPointerUp={(e) => finishTextBox(e, pageNum)}
            onPointerLeave={(e) => finishTextBox(e, pageNum)}
          >
            {numPages > 1 && <div className="page-badge">Pag. {displayIndex + 1} / {pageOrder.length || numPages} - original {pageNum}</div>}
            <PageCanvas
              pdfDoc={pdfDoc}
              pageNum={pageNum}
              maxWidth={maxWidth}
              rotation={rotation}
              onMeta={handlePageMeta}
              onTextItems={handleTextItems}
            />
            {overlaysAvailable && mode === 'select' && !previewMode && meta.canvasW > 0 && textItems.length > 0 && (
              <div className="text-replace-layer" style={{ width: meta.canvasW, height: meta.canvasH }}>
                {textItems.map((hit) => (
                  <button
                    key={hit.sourceId}
                    className="text-replace-hit"
                    type="button"
                    aria-label={`Editar texto: ${hit.text}`}
                    title="Editar este texto"
                    style={{
                      left: hit.x * meta.scale,
                      top: (meta.pdfHeight - hit.y - hit.height) * meta.scale,
                      width: Math.max(8, hit.width * meta.scale),
                      height: Math.max(8, hit.height * meta.scale),
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectExistingText(hit, pageNum, event);
                    }}
                  />
                ))}
              </div>
            )}
            {overlaysAvailable && meta.canvasW > 0 && (
              <div className="annotation-layer" style={{ width: meta.canvasW, height: meta.canvasH }}>
                {draftBox?.page === pageNum && (
                  <div
                    className="draft-text-box"
                    style={{
                      left: Math.min(draftBox.startX, draftBox.x),
                      top: Math.min(draftBox.startY, draftBox.y),
                      width: Math.abs(draftBox.x - draftBox.startX),
                      height: Math.abs(draftBox.y - draftBox.startY),
                    }}
                  />
                )}
                {pageAnnotations.map((annotation) => (
                  <EditableAnnotation
                    key={annotation.id}
                    annotation={annotation}
                    meta={meta}
                    selected={selectedId === annotation.id}
                    setSelectedId={setSelectedId}
                    setAnnotations={setAnnotations}
                    previewMode={previewMode}
                    shouldFocus={focusPendingId.current === annotation.id}
                    onFocused={() => { focusPendingId.current = null; }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EditableAnnotation({ annotation, meta, selected, setSelectedId, setAnnotations, previewMode, shouldFocus, onFocused }) {
  const textRef = useRef(null);

  // Auto-focus newly created annotations
  useEffect(() => {
    if (!previewMode && shouldFocus && textRef.current) {
      if (textRef.current.textContent !== (annotation.text || '')) {
        textRef.current.textContent = annotation.text || '';
      }
      textRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(textRef.current);
      if (!annotation.erase || !annotation.text) range.collapse(false);
      const sel = globalThis.getSelection?.();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      onFocused();
    }
  }, [previewMode, shouldFocus, annotation.text, onFocused]);

  useEffect(() => {
    if (!textRef.current || document.activeElement === textRef.current) return;
    const nextText = annotation.text || '';
    if (textRef.current.textContent !== nextText) {
      textRef.current.textContent = nextText;
    }
  }, [annotation.text]);

  function patch(update) {
    setAnnotations((items) => items.map((item) => item.id === annotation.id ? { ...item, ...update } : item));
  }

  function syncText(e) {
    const element = e.currentTarget;
    const next = { text: element.textContent };
    const measuredWidth = Math.ceil((element.scrollWidth + 8) / meta.scale);
    const measuredHeight = Math.ceil((element.scrollHeight + 4) / meta.scale);
    if (measuredWidth > annotation.width) next.width = measuredWidth;
    if (measuredHeight > annotation.height) next.height = measuredHeight;
    patch(next);
  }

  function remove() {
    setAnnotations((items) => items.filter((item) => item.id !== annotation.id));
  }

  // Drag the annotation box (only from the drag handle, not the text area)
  function startDrag(event) {
    if (event.target.dataset.resize === 'true') return;
    if (event.target === textRef.current || textRef.current?.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(annotation.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const orig = { x: annotation.x, y: annotation.y };
    function move(e) {
      patch({
        x: Math.max(0, orig.x + (e.clientX - startX) / meta.scale),
        y: Math.max(0, orig.y - (e.clientY - startY) / meta.scale),
      });
    }
    function up() {
      globalThis.removeEventListener('pointermove', move);
      globalThis.removeEventListener('pointerup', up);
    }
    globalThis.addEventListener('pointermove', move);
    globalThis.addEventListener('pointerup', up);
  }

  function startResize(event) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const orig = { width: annotation.width, height: annotation.height };
    function move(e) {
      patch({
        width: Math.max(30, orig.width + (e.clientX - startX) / meta.scale),
        height: Math.max(12, orig.height + (e.clientY - startY) / meta.scale),
      });
    }
    function up() {
      globalThis.removeEventListener('pointermove', move);
      globalThis.removeEventListener('pointerup', up);
    }
    globalThis.addEventListener('pointermove', move);
    globalThis.addEventListener('pointerup', up);
  }

  const fontFamily = annotation.fontFamily === 'TimesRoman'
    ? '"Times New Roman", Times, Georgia, serif'
    : annotation.fontFamily === 'Courier'
    ? '"Courier New", Courier, monospace'
    : 'Arial, "Helvetica Neue", Helvetica, sans-serif';

  const scaledSize = Math.min(120, Math.max(8, annotation.size * meta.scale));

  return (
    <div
      className={`react-annotation ${annotation.erase ? 'is-erase' : ''} ${selected && !previewMode ? 'selected' : ''} ${previewMode ? 'is-preview' : ''} ${!annotation.text ? 'ann-empty' : ''}`}
      data-erase={annotation.erase ? 'true' : 'false'}
      style={{
        left: annotation.x * meta.scale,
        top: (meta.pdfHeight - annotation.y - annotation.height) * meta.scale,
        width: annotation.width * meta.scale,
        height: annotation.height * meta.scale,
        backgroundColor: annotation.erase ? (annotation.backgroundColor || '#ffffff') : 'transparent',
        '--annotation-fill': annotation.backgroundColor || '#ffffff',
      }}
      onPointerDown={previewMode ? undefined : startDrag}
      onClick={(e) => {
        e.stopPropagation();
        if (!previewMode) setSelectedId(annotation.id);
      }}
    >
      {/* Drag handle bar — only visible when selected */}
      {selected && !previewMode && (
        <div className="ann-drag-handle" onPointerDown={startDrag}>
          <i className="fas fa-grip-lines"></i>
          <button
            className="ann-delete-btn"
            title="Eliminar"
            onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
            onClick={(e) => { e.stopPropagation(); remove(); }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
      <div
        ref={textRef}
        className="react-annotation-text"
        contentEditable={!previewMode}
        suppressContentEditableWarning
        spellCheck="false"
        data-placeholder={annotation.erase ? 'Reemplaza o borra...' : 'Escribe...'}
        style={{
          fontSize: Math.round(scaledSize),
          color: annotation.color,
          fontFamily,
          fontWeight: annotation.bold ? 700 : 400,
          lineHeight: `${annotation.height * meta.scale}px`,
          height: '100%',
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onFocus={() => { if (!previewMode) setSelectedId(annotation.id); }}
        onInput={previewMode ? undefined : syncText}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.currentTarget.blur();
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      {selected && !previewMode && (
        <span className="react-resize" data-resize="true" onPointerDown={startResize} />
      )}
    </div>
  );
}
