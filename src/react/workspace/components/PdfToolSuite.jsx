import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, downloadDocument } from '../api.js';
import { formatBytes } from '../constants.js';
import { PdfThumbnail } from './PdfThumbnail.jsx';

const TOOL_COPY = {
  merge: ['Unir PDFs', 'Arrastra para reordenar; el orden importa.'],
  split: ['Dividir PDF', 'Selecciona las paginas a extraer.'],
  compress: ['Comprimir PDF', 'Reduce el tamano sin perder estructura.'],
  proteger: ['Proteger PDF', 'Cifrado con contrasena de apertura.'],
  sign: ['Firmar PDF', 'Dibuja, escribe o carga tu firma visual.'],
  rotate: ['Rotar paginas', 'Selecciona paginas y aplica rotacion.'],
  herramientas: ['Marca de agua', 'Personaliza el watermark de tu documento.'],
};

const SIGN_ALIGNMENTS = [
  ['inferior-derecha', 'Inferior derecha'],
  ['inferior-izquierda', 'Inferior izquierda'],
  ['superior-derecha', 'Superior derecha'],
  ['superior-izquierda', 'Superior izquierda'],
  ['centro', 'Centro'],
];

function pageList(count) {
  return Array.from({ length: Math.max(0, Number(count || 0)) }, (_v, index) => index + 1);
}

function pagesToRange(pages) {
  return [...pages].sort((a, b) => a - b).join(',');
}

export function PdfToolSuite({
  module,
  docs,
  setDocs,
  uploadInputRef,
  busy,
  setBusy,
  result,
  setResult,
  showToast,
}) {
  const currentDoc = docs[0] || null;
  const [metaById, setMetaById] = useState({});
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [rotations, setRotations] = useState({});
  const [range, setRange] = useState('1');
  const [passwords, setPasswords] = useState({ password: '', confirm: '', ownerPassword: '' });
  const [permissions, setPermissions] = useState({ print: true, copy: false, edit: false, annotate: true });
  const [watermark, setWatermark] = useState({ text: 'CONFIDENCIAL', opacity: 0.18, size: 42, rotation: -35, color: '#c9a84c', pages: 'all' });
  const [signature, setSignature] = useState({ mode: 'draw', text: '', image: '', page: 1, alignment: 'inferior-derecha', color: '#111111' });
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const draggedDocId = useRef(null);

  const currentMeta = currentDoc ? metaById[currentDoc.id] : null;
  const pageCount = currentMeta?.pageCount || 0;
  const copy = TOOL_COPY[module] || ['Herramienta PDF', 'Procesa tu documento.'];
  const totalMergePages = docs.reduce((sum, doc) => sum + (metaById[doc.id]?.pageCount || 0), 0);

  useEffect(() => {
    docs.forEach((doc) => {
      if (!doc?.id || metaById[doc.id]) return;
      api.fileMeta(doc.id)
        .then((response) => setMetaById((prev) => ({ ...prev, [doc.id]: response.meta })))
        .catch(() => {});
    });
  }, [docs, metaById]);

  useEffect(() => {
    setSelectedPages(new Set());
    setRotations({});
    setRange('1');
  }, [currentDoc?.id, module]);

  function addPdf() {
    if (!uploadInputRef.current) return;
    uploadInputRef.current.accept = '.pdf';
    uploadInputRef.current.multiple = module === 'merge';
    uploadInputRef.current.click();
  }

  function removeDoc(id) {
    setDocs((items) => items.filter((item) => item.id !== id));
  }

  function moveDoc(id, direction) {
    setDocs((items) => {
      const index = items.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;
      const next = [...items];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function reorderDoc(targetId) {
    const sourceId = draggedDocId.current;
    if (!sourceId || sourceId === targetId) return;
    setDocs((items) => {
      const fromIndex = items.findIndex((item) => item.id === sourceId);
      const toIndex = items.findIndex((item) => item.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return items;
      const next = [...items];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  async function run(tool, ids, options = {}) {
    if (!ids.length) return showToast('Sube un PDF primero.');
    setBusy(true);
    setResult(null);
    try {
      const response = await api.runTool(tool, ids, options);
      setResult(response.document);
      downloadDocument(response.document);
      showToast('Archivo listo. Descargando...');
    } catch (error) {
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  function togglePage(page) {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  }

  function selectAllPages() {
    setSelectedPages(new Set(pageList(pageCount)));
  }

  function clearPages() {
    setSelectedPages(new Set());
  }

  function rotateSelected(degrees) {
    if (!selectedPages.size) return showToast('Selecciona paginas primero.');
    setRotations((prev) => {
      const next = { ...prev };
      selectedPages.forEach((page) => {
        next[page] = ((Number(next[page] || 0) + degrees) % 360 + 360) % 360;
      });
      return next;
    });
  }

  function clearSignatureCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature((prev) => ({ ...prev, image: '' }));
  }

  function pointerPoint(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvasRef.current.width,
      y: ((event.clientY - rect.top) / rect.height) * canvasRef.current.height,
    };
  }

  function startDraw(event) {
    if (!canvasRef.current) return;
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const point = pointerPoint(event);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function draw(event) {
    if (!drawingRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const point = pointerPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function endDraw() {
    if (!drawingRef.current || !canvasRef.current) return;
    drawingRef.current = false;
    setSignature((prev) => ({ ...prev, image: canvasRef.current.toDataURL('image/png') }));
  }

  function loadSignatureImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSignature((prev) => ({ ...prev, mode: 'image', image: reader.result }));
    reader.readAsDataURL(file);
  }

  const body = useMemo(() => {
    if (module === 'merge') {
      return (
        <div className="tool-card-shell narrow">
          <div className="merge-list">
            {docs.map((doc, index) => (
              <article
                className="merge-row"
                key={doc.id}
                draggable
                onDragStart={() => { draggedDocId.current = doc.id; }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  reorderDoc(doc.id);
                }}
              >
                <span className="drag-grip"><i className="fas fa-grip-vertical"></i></span>
                <i className="fas fa-file-pdf pdf-red"></i>
                <strong>{doc.name}</strong>
                <span>{metaById[doc.id]?.pageCount || '-'} pags</span>
                <button type="button" title="Subir" onClick={() => moveDoc(doc.id, -1)}><i className="fas fa-arrow-up"></i></button>
                <button type="button" title="Bajar" onClick={() => moveDoc(doc.id, 1)}><i className="fas fa-arrow-down"></i></button>
                <button type="button" title="Eliminar" onClick={() => removeDoc(doc.id)}><i className="fas fa-trash"></i></button>
              </article>
            ))}
            {!docs.length && <div className="empty-state">Agrega dos o mas PDFs para unirlos.</div>}
          </div>
          <div className="tool-inline-actions">
            <button className="btn-ghost full" type="button" onClick={addPdf}><i className="fas fa-plus"></i> Agregar PDF</button>
            <button className="btn-primary full" type="button" disabled={busy || docs.length < 2} onClick={() => run('merge', docs.map((doc) => doc.id))}>Unir documentos</button>
          </div>
          <p className="tool-muted">Total: {docs.length} archivos · {totalMergePages || '-'} paginas</p>
        </div>
      );
    }

    if (module === 'split') {
      return (
        <div className="tool-card-shell wide">
          <PageToolbar count={pageCount} selected={selectedPages.size} onAll={selectAllPages} onClear={clearPages} />
          <PageGrid docUrl={currentDoc?.downloadUrl} pageCount={pageCount} selectedPages={selectedPages} onToggle={togglePage} />
          <div className="tool-inline-actions compact-left">
            <button className="btn-primary" type="button" disabled={busy || !selectedPages.size} onClick={() => run('split', [currentDoc.id], { pages: pagesToRange(selectedPages) })}>Extraer seleccion</button>
            <input className="tool-input small" value={range} onChange={(e) => setRange(e.target.value)} placeholder="1-3,5" />
            <button className="btn-ghost" type="button" disabled={busy} onClick={() => run('split', [currentDoc.id], { pages: range })}>Por rango</button>
          </div>
        </div>
      );
    }

    if (module === 'compress') {
      const size = currentDoc?.sizeBytes || 0;
      return (
        <div className="tool-card-shell">
          <div className="compression-box">
            <div><strong>{formatBytes(size)}</strong><span>Original</span></div>
            <i className="fas fa-arrow-right"></i>
            <div><strong>{formatBytes(Math.max(0, Math.round(size * 0.68)))}</strong><span>Estimado</span></div>
          </div>
          <div className="savings-bar">Ahorro estimado: 32%</div>
          <label className="form-label">Nivel de compresion</label>
          <input className="form-range" type="range" min="1" max="3" defaultValue="2" />
          <select className="form-input" defaultValue="150"><option value="72">DPI 72 - Maxima compresion</option><option value="150">DPI 150 - Balance</option><option value="300">DPI 300 - Maxima calidad</option></select>
          <label className="check-row"><input type="checkbox" defaultChecked /> Eliminar metadatos</label>
          <label className="check-row"><input type="checkbox" /> Eliminar capas ocultas</label>
          <button className="btn-primary full" type="button" disabled={busy} onClick={() => run('compress', [currentDoc.id])}>Comprimir ahora</button>
        </div>
      );
    }

    if (module === 'proteger') {
      return (
        <div className="tool-card-shell">
          <label className="form-label">Contrasena de apertura</label>
          <input className="form-input" type="password" value={passwords.password} onChange={(e) => setPasswords((prev) => ({ ...prev, password: e.target.value }))} placeholder="Contrasena segura" />
          <label className="form-label">Confirmar contrasena</label>
          <input className="form-input" type="password" value={passwords.confirm} onChange={(e) => setPasswords((prev) => ({ ...prev, confirm: e.target.value }))} placeholder="Repite la contrasena" />
          <label className="form-label">Permisos del documento</label>
          {Object.entries({ print: 'Permitir impresion', copy: 'Permitir copia de texto', edit: 'Permitir edicion', annotate: 'Permitir anotaciones' }).map(([key, label]) => (
            <label className="check-row" key={key}><input type="checkbox" checked={permissions[key]} onChange={(e) => setPermissions((prev) => ({ ...prev, [key]: e.target.checked }))} /> {label}</label>
          ))}
          <button className="btn-primary full" type="button" disabled={busy} onClick={() => {
            if (passwords.password !== passwords.confirm) return showToast('Las contrasenas no coinciden.');
            return run('protect', [currentDoc.id], { ...passwords, permissions });
          }}>Aplicar proteccion</button>
        </div>
      );
    }

    if (module === 'sign') {
      return (
        <div className="tool-card-shell wide signature-shell">
          <div className="segmented">
            {['draw', 'text', 'image'].map((mode) => (
              <button className={signature.mode === mode ? 'active' : ''} type="button" key={mode} onClick={() => setSignature((prev) => ({ ...prev, mode }))}>{mode === 'draw' ? 'Dibujar' : mode === 'text' ? 'Escribir' : 'Imagen'}</button>
            ))}
          </div>
          {signature.mode === 'draw' && (
            <>
              <canvas ref={canvasRef} className="signature-canvas" width="720" height="220" onPointerDown={startDraw} onPointerMove={draw} onPointerUp={endDraw} onPointerLeave={endDraw}></canvas>
              <button className="btn-ghost" type="button" onClick={clearSignatureCanvas}><i className="fas fa-trash"></i> Limpiar</button>
            </>
          )}
          {signature.mode === 'text' && <input className="signature-text-input" value={signature.text} onChange={(e) => setSignature((prev) => ({ ...prev, text: e.target.value }))} placeholder="Escribe tu firma" />}
          {signature.mode === 'image' && <input className="form-input" type="file" accept="image/png,image/jpeg" onChange={(e) => loadSignatureImage(e.target.files?.[0])} />}
          <div className="tool-two-cols">
            <label><span className="form-label">Pagina</span><select className="form-input" value={signature.page} onChange={(e) => setSignature((prev) => ({ ...prev, page: Number(e.target.value) }))}>{pageList(pageCount).map((page) => <option value={page} key={page}>Pagina {page}</option>)}</select></label>
            <label><span className="form-label">Alineacion</span><select className="form-input" value={signature.alignment} onChange={(e) => setSignature((prev) => ({ ...prev, alignment: e.target.value }))}>{SIGN_ALIGNMENTS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          </div>
          <button className="btn-primary full" type="button" disabled={busy} onClick={() => run('sign', [currentDoc.id], { signatureText: signature.text, signatureImage: signature.image, page: signature.page, alignment: signature.alignment, color: signature.color })}>Firmar documento</button>
        </div>
      );
    }

    if (module === 'rotate') {
      return (
        <div className="tool-card-shell wide">
          <div className="tool-inline-actions compact-left">
            <button className="btn-ghost" type="button" onClick={() => rotateSelected(90)}>+90</button>
            <button className="btn-ghost" type="button" onClick={() => rotateSelected(-90)}>-90</button>
            <button className="btn-ghost" type="button" onClick={() => rotateSelected(180)}>180</button>
            <button className="btn-ghost" type="button" onClick={() => setRotations({})}>Resetear</button>
            <span className="tool-muted">Sel: {selectedPages.size}</span>
          </div>
          <PageGrid docUrl={currentDoc?.downloadUrl} pageCount={pageCount} selectedPages={selectedPages} rotations={rotations} onToggle={togglePage} />
          <button className="btn-primary" type="button" disabled={busy || !Object.keys(rotations).length} onClick={() => run('rotate', [currentDoc.id], { pages: Object.keys(rotations).join(','), degrees: 90, rotations })}>Guardar cambios</button>
        </div>
      );
    }

    return (
      <div className="watermark-layout">
        <div className="tool-card-shell">
          <label className="form-label">Tipo</label>
          <select className="form-input"><option>Texto</option></select>
          <label className="form-label">Texto</label>
          <input className="form-input" value={watermark.text} onChange={(e) => setWatermark((prev) => ({ ...prev, text: e.target.value }))} />
          <label className="form-label">Opacidad: {Math.round(watermark.opacity * 100)}%</label>
          <input className="form-range" type="range" min="5" max="60" value={Math.round(watermark.opacity * 100)} onChange={(e) => setWatermark((prev) => ({ ...prev, opacity: Number(e.target.value) / 100 }))} />
          <label className="form-label">Rotacion: {watermark.rotation} grados</label>
          <input className="form-range" type="range" min="-60" max="60" value={watermark.rotation} onChange={(e) => setWatermark((prev) => ({ ...prev, rotation: Number(e.target.value) }))} />
          <button className="btn-primary full" type="button" disabled={busy} onClick={() => run('watermark', [currentDoc.id], watermark)}>Aplicar watermark</button>
        </div>
        <div className="watermark-preview"><div className="fake-page"><strong>CONTRATO DE SERVICIOS</strong><p>Vista previa del documento.</p><span style={{ opacity: watermark.opacity, transform: `rotate(${watermark.rotation}deg)` }}>{watermark.text}</span></div></div>
      </div>
    );
  }, [module, docs, metaById, busy, selectedPages, rotations, range, passwords, permissions, watermark, signature, pageCount, currentDoc]);

  return (
    <main className="pdf-tool-surface">
      <section className="tool-hero">
        <h2>{copy[0]}</h2>
        <p>{copy[1]}</p>
      </section>
      {!currentDoc && module !== 'merge' ? (
        <div className="tool-card-shell narrow"><div className="empty-state">Sube un PDF para empezar.</div><button className="btn-primary full" type="button" onClick={addPdf}>Agregar PDF</button></div>
      ) : body}
      {result && <a className="btn-success tool-result" href={result.downloadUrl} download={result.name}><i className="fas fa-download"></i> {result.name}</a>}
    </main>
  );
}

function PageToolbar({ count, selected, onAll, onClear }) {
  return (
    <div className="tool-inline-actions compact-left">
      <button className="btn-ghost" type="button" onClick={onAll}>Seleccionar todas</button>
      <button className="btn-ghost" type="button" onClick={onClear}>Limpiar</button>
      <span className="tool-muted">Seleccionadas: {selected} / {count || 0}</span>
    </div>
  );
}

function PageGrid({ docUrl, pageCount, selectedPages, rotations = {}, onToggle }) {
  return (
    <div className="tool-page-grid">
      {pageList(pageCount).map((page) => (
        <button className={`tool-page ${selectedPages.has(page) ? 'selected' : ''}`} type="button" key={page} onClick={() => onToggle(page)}>
          <PdfThumbnail docUrl={docUrl} pageNum={page} width={80} rotation={rotations[page] || 0} fallbackLabel={page} />
          <small>Pag. {page}</small>
          {rotations[page] ? <em>{rotations[page]}°</em> : null}
        </button>
      ))}
    </div>
  );
}
