import React from 'react';
import { convertLabels, convertDescriptions, formatBytes, isPdf, uploadConversions } from '../constants.js';
import { PdfCanvas } from './PdfCanvas.jsx';

function pagesFromCount(pageCount) {
  return Array.from({ length: Math.max(0, Number(pageCount || 0)) }, (_v, index) => index + 1);
}

export function DocumentPanel({
  docs,
  currentDoc,
  pageCount = 0,
  pageOrder = [],
  setPageOrder,
  pageRotations = {},
  setPageRotations,
  selectedPage = 1,
  setSelectedPage,
}) {
  const orderedPages = pageOrder.length ? pageOrder : pagesFromCount(pageCount);

  function movePage(fromPage, toPage) {
    if (!setPageOrder || fromPage === toPage) return;
    setPageOrder((items) => {
      const source = items.length ? items : pagesFromCount(pageCount);
      const fromIndex = source.indexOf(fromPage);
      const toIndex = source.indexOf(toPage);
      if (fromIndex < 0 || toIndex < 0) return source;
      const next = [...source];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function removePage(page) {
    if (!setPageOrder || orderedPages.length <= 1) return;
    setPageOrder((items) => {
      const source = items.length ? items : pagesFromCount(pageCount);
      return source.filter((item) => item !== page);
    });
  }

  function rotatePage(page) {
    if (!setPageRotations) return;
    setPageRotations((items) => ({
      ...items,
      [page]: ((Number(items[page] || 0) + 90) % 360 + 360) % 360,
    }));
  }

  function selectPage(page) {
    setSelectedPage?.(page);
    globalThis.document?.getElementById(`pdf-page-${page}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <aside className="workbench-sidebar">
      <div className="panel-header"><div><span className="panel-kicker">Archivos</span><h2>Documento</h2></div></div>
      <div className="document-list">
        {docs.map((doc, index) => (
          <article className="document-item compact" key={doc.id}>
            <span className="doc-file-icon"><i className="fas fa-file-pdf"></i></span>
            <span><span className="doc-name">{doc.name}</span><span className="doc-meta">{formatBytes(doc.sizeBytes)}</span></span>
            <span className="status-pill">{index + 1}</span>
          </article>
        ))}
      </div>
      <div className="panel-header spaced">
        <div>
          <span className="panel-kicker">Paginas</span>
          <h2>Orden</h2>
        </div>
        {pageCount > 0 && <span className="status-pill">{orderedPages.length}/{pageCount}</span>}
      </div>
      <div className="page-strip sortable-pages">
        {currentDoc && isPdf(currentDoc) && (
          orderedPages.map((page, index) => (
            <article
              className={`page-card sortable-page ${selectedPage === page ? 'active' : ''}`}
              key={page}
              draggable
              onDragStart={(event) => event.dataTransfer.setData('text/page', String(page))}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                movePage(Number(event.dataTransfer.getData('text/page')), page);
              }}
              onClick={() => selectPage(page)}
            >
              <span className="page-thumb" style={{ transform: `rotate(${pageRotations[page] || 0}deg)` }}>{page}</span>
              <span>
                <span className="page-title">Pagina {page}</span>
                <span className="page-subtitle">Posicion {index + 1}{pageRotations[page] ? ` - ${pageRotations[page]} deg` : ''}</span>
              </span>
              <span className="page-actions" onClick={(event) => event.stopPropagation()}>
                <button type="button" title="Rotar pagina" onClick={() => rotatePage(page)}><i className="fas fa-rotate-right"></i></button>
                <button type="button" title="Eliminar pagina" disabled={orderedPages.length <= 1} onClick={() => removePage(page)}><i className="fas fa-trash"></i></button>
              </span>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

export function PdfStage({
  currentDoc,
  annotations,
  setAnnotations,
  editorMode,
  previewMode,
  textOptions,
  selectedId,
  setSelectedId,
  module,
  pageOrder,
  pageRotations,
  setPageMeta,
}) {
  const canEdit = module === 'editar' || module === 'comentario';
  return (
    <section className="pdf-stage">
      {!currentDoc && <div className="empty-state stage-empty">Sube un PDF para empezar.</div>}
      {currentDoc && !isPdf(currentDoc) && <div className="empty-state stage-empty">Archivo listo para convertir.</div>}
      {currentDoc && isPdf(currentDoc) && (
        <div className="pdf-pages">
          <PdfCanvas
            doc={currentDoc}
            annotations={annotations}
            setAnnotations={setAnnotations}
            mode={previewMode ? 'preview' : canEdit ? editorMode : 'select'}
            previewMode={previewMode}
            textOptions={textOptions}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            pageOrder={pageOrder}
            pageRotations={pageRotations}
            setPageMeta={setPageMeta}
          />
        </div>
      )}
    </section>
  );
}

export function ActionsPanel({
  module, busy, primaryLabel, apply, result,
  convertAction, setConvertAction, openUploadConversion,
  editorMode, setEditorMode, previewMode, setPreviewMode, selectedId, setSelectedId, setAnnotations,
  protectOptions, setProtectOptions,
  watermarkOptions, setWatermarkOptions,
}) {
  function panelTitle() {
    if (module === 'convertir') return 'Convertir PDF';
    if (module === 'proteger') return 'Proteger PDF';
    if (module === 'herramientas') return 'Marca de agua';
    if (module === 'organizar') return 'Organizar paginas';
    return 'Editar PDF';
  }

  return (
    <aside className="workbench-tools">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">Acciones</span>
          <h2>{panelTitle()}</h2>
        </div>
      </div>
      <button className="btn-primary full side-apply" type="button" disabled={busy} onClick={apply}>
        <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
        {' '}{busy ? 'Procesando...' : primaryLabel}
      </button>

      {module === 'convertir' && (
        <ConvertActions convertAction={convertAction} setConvertAction={setConvertAction} openUploadConversion={openUploadConversion} />
      )}
      {(module === 'editar' || module === 'comentario') && (
        <EditActions
          editorMode={editorMode}
          setEditorMode={setEditorMode}
          previewMode={previewMode}
          setPreviewMode={setPreviewMode}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          setAnnotations={setAnnotations}
        />
      )}
      {module === 'proteger' && (
        <ProtectActions protectOptions={protectOptions} setProtectOptions={setProtectOptions} />
      )}
      {module === 'herramientas' && (
        <WatermarkActions watermarkOptions={watermarkOptions} setWatermarkOptions={setWatermarkOptions} />
      )}
      {module === 'organizar' && (
        <OrganizarActions />
      )}

      {result && (
        <div className="result-box">
          <span>{result.name}</span>
          <a href={result.downloadUrl} download={result.name}><i className="fas fa-download"></i> Descargar</a>
        </div>
      )}
    </aside>
  );
}

function actionIcon(action) {
  if (action === 'pdfToImage') return 'fas fa-image';
  if (action.includes('Word')) return 'fas fa-file-word';
  if (action === 'compress') return 'fas fa-compress-arrows-alt';
  return 'fas fa-file-export';
}

const PDF_ACTIONS = ['pdfToWord', 'pdfToWordImage', 'compress', 'pdfToImage'];

function ConvertActions({ convertAction, setConvertAction, openUploadConversion }) {
  return (
    <div className="mode-tools">
      {PDF_ACTIONS.map((action) => (
        <button
          key={action}
          className={`tool-action ${convertAction === action ? 'active' : ''}`}
          type="button"
          onClick={() => setConvertAction(action)}
        >
          <i className={actionIcon(action)}></i>
          <span>
            <strong>{convertLabels[action]}</strong>
            <small>{convertDescriptions[action]}</small>
          </span>
        </button>
      ))}
      <div className="tool-section-title">Subir y convertir</div>
      {uploadConversions.map((action) => (
        <button key={action} className="tool-action" type="button" onClick={() => openUploadConversion(action)}>
          <i className="fas fa-upload"></i>
          <span>
            <strong>{convertLabels[action]}</strong>
            <small>{convertDescriptions[action]}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function EditActions({ editorMode, setEditorMode, previewMode, setPreviewMode, selectedId, setSelectedId, setAnnotations }) {
  function removeSelected() {
    if (!selectedId) return;
    setAnnotations((items) => items.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  }

  function clearChanges() {
    setAnnotations([]);
    setSelectedId(null);
  }

  return (
    <div className="editor-tools">
      <button
        className={`tool-action ${editorMode === 'select' ? 'active' : ''}`}
        type="button"
        onClick={() => setEditorMode('select')}
      >
        <i className="fas fa-i-cursor"></i>
        <span><strong>Editar bloque</strong><small>Haz clic sobre una linea del PDF.</small></span>
      </button>
      <button
        className={`tool-action ${editorMode === 'addText' ? 'active' : ''}`}
        type="button"
        onClick={() => setEditorMode('addText')}
      >
        <i className="fas fa-square-t"></i>
        <span><strong>Caja de texto</strong><small>Arrastra para dibujar el cuadro.</small></span>
      </button>
      <button
        className={`tool-action ${previewMode ? 'active' : ''}`}
        type="button"
        onClick={() => setPreviewMode((value) => !value)}
      >
        <i className="fas fa-eye"></i>
        <span><strong>Vista previa</strong><small>Oculta controles y muestra el resultado.</small></span>
      </button>
      <button
        className="tool-action"
        type="button"
        onClick={removeSelected}
      >
        <i className="fas fa-trash"></i>
        <span><strong>Borrar seleccionado</strong><small>Quita el cambio activo.</small></span>
      </button>
      <button
        className="tool-action"
        type="button"
        onClick={clearChanges}
      >
        <i className="fas fa-eraser"></i>
        <span><strong>Limpiar cambios</strong><small>Vuelve al PDF original en pantalla.</small></span>
      </button>
      <div className="empty-state">Para eliminar texto existente, editalo y deja el campo vacio antes de aplicar.</div>
    </div>
  );
}

function ProtectActions({ protectOptions, setProtectOptions }) {
  function set(key, value) {
    setProtectOptions((prev) => ({ ...prev, [key]: value }));
  }
  return (
    <div className="module-form">
      <div className="form-group">
        <label className="form-label"><i className="fas fa-lock"></i> Contrasena para abrir</label>
        <input
          className="form-input"
          type="password"
          placeholder="Minimo 4 caracteres"
          value={protectOptions.password}
          onChange={(e) => set('password', e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div className="form-group">
        <label className="form-label"><i className="fas fa-shield-alt"></i> Contrasena de propietario (opcional)</label>
        <input
          className="form-input"
          type="password"
          placeholder="Para permisos avanzados"
          value={protectOptions.ownerPassword}
          onChange={(e) => set('ownerPassword', e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div className="form-hint">
        <i className="fas fa-info-circle"></i> El PDF cifrado requerira contrasena para abrirse.
      </div>
    </div>
  );
}

function WatermarkActions({ watermarkOptions, setWatermarkOptions }) {
  function set(key, value) {
    setWatermarkOptions((prev) => ({ ...prev, [key]: value }));
  }
  return (
    <div className="module-form">
      <div className="form-group">
        <label className="form-label"><i className="fas fa-water"></i> Texto de la marca de agua</label>
        <input
          className="form-input"
          type="text"
          placeholder="Ej: CONFIDENCIAL"
          value={watermarkOptions.text}
          onChange={(e) => set('text', e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Tamano de fuente: <strong>{watermarkOptions.size}pt</strong></label>
        <input
          className="form-range"
          type="range"
          min="20"
          max="80"
          value={watermarkOptions.size}
          onChange={(e) => set('size', Number(e.target.value))}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Opacidad: <strong>{Math.round(watermarkOptions.opacity * 100)}%</strong></label>
        <input
          className="form-range"
          type="range"
          min="5"
          max="60"
          value={Math.round(watermarkOptions.opacity * 100)}
          onChange={(e) => set('opacity', Number(e.target.value) / 100)}
        />
      </div>
      <div className="form-hint">
        <i className="fas fa-info-circle"></i> La marca se aplicara en diagonal sobre todas las paginas.
      </div>
    </div>
  );
}

function OrganizarActions() {
  return (
    <div className="module-form">
      <div className="form-group">
        <label className="form-label"><i className="fas fa-sort"></i> Reorganizar paginas</label>
        <p className="form-hint">Esta funcion reorganiza las paginas del PDF eliminando las vacias y optimizando el orden existente.</p>
      </div>
      <div className="form-hint">
        <i className="fas fa-info-circle"></i> Pulsa "Aplicar y descargar" para procesar el documento.
      </div>
    </div>
  );
}
