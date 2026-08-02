import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, downloadDocument } from './api.js';
import { convertLabels, initialIds, initialTool, uploadAccept, uploadConversions } from './constants.js';
import { Sidebar } from './components/Sidebar.jsx';
import { WorkbenchTabs } from './components/WorkbenchTabs.jsx';
import { WorkspaceToolbar } from './components/WorkspaceToolbar.jsx';
import { ActionsPanel, ConversionStage, DocumentPanel, PdfStage } from './components/WorkspacePanels.jsx';
import { PdfToolSuite } from './components/PdfToolSuite.jsx';
import { AiAssistantPanel } from './components/AiAssistantPanel.jsx';

const TOOL_MODULES = new Set(['merge', 'split', 'compress', 'proteger', 'sign', 'rotate', 'herramientas']);

function initialModule() {
  if (initialTool === 'pdfToWord' || initialTool === 'pdfToPpt') return 'convertir';
  if (initialTool === 'compress') return 'compress';
  if (initialTool === 'protect' || initialTool === 'proteger') return 'proteger';
  if (initialTool === 'merge') return 'merge';
  if (initialTool === 'split') return 'split';
  if (initialTool === 'rotate') return 'rotate';
  if (initialTool === 'sign') return 'sign';
  if (initialTool === 'organize') return 'organizar';
  if (initialTool === 'watermark') return 'herramientas';
  if (initialTool === 'ia') return 'ia';
  return 'editar';
}

const MODULE_TITLE = {
  ia: 'Asistente IA para Documentos',
  editar: 'Editar PDF',
  comentario: 'Comentarios',
  convertir: 'Convertir',
  merge: 'Unir PDFs',
  split: 'Dividir PDF',
  compress: 'Comprimir PDF',
  organizar: 'Organizar páginas',
  herramientas: 'Marca de agua',
  proteger: 'Proteger PDF',
  sign: 'Firmar PDF',
  rotate: 'Rotar páginas',
  ver: 'Vista previa',
  inicio: 'Inicio',
  formulario: 'Formulario',
};

const MODULE_MODE = {
  ia: 'Resumen, Chat y Traducción',
  editar: 'Añadir texto sobre el PDF',
  convertir: 'Convertir documento',
  merge: 'Unir documentos',
  split: 'Extraer páginas',
  compress: 'Optimizar archivo',
  organizar: 'Reorganizar páginas',
  herramientas: 'Marca de agua',
  proteger: 'Cifrar con contraseña',
  sign: 'Insertar firma',
  rotate: 'Rotar páginas',
  comentario: 'Añadir texto sobre el PDF',
  ver: 'Vista',
  inicio: 'Inicio',
  formulario: 'Formulario',
};

export function WorkspaceApp() {
  const [user, setUser] = useState(null);
  const [docs, setDocs] = useState([]);
  const [module, setModule] = useState(initialModule);
  const [convertAction, setConvertAction] = useState(
    ['pdfToWord', 'pdfToWordImage', 'compress', 'pdfToImage'].includes(initialTool) ? initialTool : 'pdfToWord'
  );
  const [editorMode, setEditorMode] = useState('select');
  const [annotations, setAnnotations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState('');
  const [textOptions, setTextOptions] = useState({ size: 12, color: '#111111', fontFamily: 'Helvetica', bold: false });
  const [pdfPageInfo, setPdfPageInfo] = useState({ pageCount: 0 });
  const [pageOrder, setPageOrder] = useState([]);
  const [pageRotations, setPageRotations] = useState({});
  const [selectedPage, setSelectedPage] = useState(1);
  const [zoomScale, setZoomScale] = useState(1.0);

  // Module-specific options
  const [protectOptions, setProtectOptions] = useState({ password: '', ownerPassword: '' });
  const [watermarkOptions, setWatermarkOptions] = useState({ text: 'CONFIDENCIAL', opacity: 0.22, size: 42 });

  const uploadInputRef = useRef(null);
  const conversionInputRef = useRef(null);
  const pendingUploadConversion = useRef(null);

  const currentDoc = docs[0] || null;
  const selectedAnnotation = useMemo(
    () => annotations.find((item) => item.id === selectedId),
    [annotations, selectedId]
  );

  useEffect(() => {
    if (selectedAnnotation) {
      setTextOptions({
        size: selectedAnnotation.size || 14,
        color: selectedAnnotation.color || '#111111',
        fontFamily: selectedAnnotation.fontFamily || 'Helvetica',
        bold: Boolean(selectedAnnotation.bold),
      });
    }
  }, [selectedAnnotation]);

  const title = MODULE_TITLE[module] || 'Editar PDF';
  const isNonPdf = currentDoc && !isPdf(currentDoc);
  const primaryLabel = isNonPdf
    ? `Descargar ${currentDoc.name.split('.').pop().toUpperCase()}`
    : module === 'convertir'
    ? 'Convertir y descargar'
    : 'Aplicar y descargar';

  useEffect(() => {
    setPdfPageInfo({ pageCount: 0 });
    setPageOrder([]);
    setPageRotations({});
    setSelectedPage(1);
  }, [currentDoc?.id]);

  useEffect(() => {
    const count = Number(pdfPageInfo.pageCount || 0);
    if (count > 0 && pageOrder.length === 0) {
      setPageOrder(Array.from({ length: count }, (_v, index) => index + 1));
    }
  }, [pdfPageInfo.pageCount, pageOrder.length]);

  useEffect(() => {
    async function load() {
      const session = await api.me();
      if (!session.user) {
        globalThis.location.href = '/';
        return;
      }
      setUser(session.user);
      const history = await api.history();
      const selected = initialIds.map((id) => history.documents.find((doc) => doc.id === id)).filter(Boolean);
      const keepMany = initialModule() === 'merge';
      setDocs(selected.slice(0, keepMany ? 12 : 1));
    }
    load().catch((error) => showToast(error.message));
  }, []);

  function showToast(message) {
    setToast(message);
    globalThis.clearTimeout(showToast.timer);
    showToast.timer = globalThis.setTimeout(() => setToast(''), 3200);
  }

  function openUploadConversion(action) {
    setModule('convertir');
    setConvertAction(action);
    pendingUploadConversion.current = action;
    conversionInputRef.current.accept = uploadAccept[action] || '';
    conversionInputRef.current.multiple = action === 'imageToPdf';
    conversionInputRef.current.click();
  }

  async function uploadPdf(files) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const upload = await api.upload(files);
      setDocs((prev) => module === 'merge' ? [...prev, ...upload.documents] : upload.documents.slice(0, 1));
      setAnnotations([]);
      setSelectedId(null);
      setPreviewMode(false);
      setResult(null);
      showToast('Archivo cargado.');
    } catch (error) {
      showToast(error.message);
    } finally {
      setBusy(false);
      uploadInputRef.current.value = '';
    }
  }

  async function processUploadConversion(files) {
    if (!files?.length || !pendingUploadConversion.current) return;
    setBusy(true);
    try {
      const upload = await api.upload(files);
      const response = await api.runTool(pendingUploadConversion.current, upload.documents.map((doc) => doc.id), {});
      setResult(response.document);
      downloadDocument(response.document);
      showToast('Conversión lista.');
    } catch (error) {
      showToast(error.message);
    } finally {
      setBusy(false);
      pendingUploadConversion.current = null;
      conversionInputRef.current.value = '';
    }
  }

  async function apply() {
    if (!currentDoc && !uploadConversions.includes(convertAction)) {
      return showToast('Sube un archivo primero.');
    }
    if (currentDoc && !isPdf(currentDoc)) {
      downloadDocument(currentDoc);
      return showToast(`Descargando ${currentDoc.name}...`);
    }
    setBusy(true);
    setResult(null);
    try {
      let response;

      if (module === 'convertir') {
        if (uploadConversions.includes(convertAction)) {
          setBusy(false);
          openUploadConversion(convertAction);
          return;
        }
        response = await api.runTool(convertAction, [currentDoc.id], {});

      } else if (module === 'proteger') {
        if (!protectOptions.password || protectOptions.password.length < 4) {
          setBusy(false);
          return showToast('La contraseña debe tener al menos 4 caracteres.');
        }
        response = await api.runTool('protect', [currentDoc.id], protectOptions);

      } else if (module === 'herramientas') {
        if (!watermarkOptions.text.trim()) {
          setBusy(false);
          return showToast('Escribe el texto de la marca de agua.');
        }
        response = await api.runTool('watermark', [currentDoc.id], watermarkOptions);

      } else if (module === 'organizar') {
        response = await api.runTool('organize', [currentDoc.id], {});

      } else {
        // editar y comentario → añadir anotaciones de texto
        const pageCount = Number(pdfPageInfo.pageCount || 0);
        const normalizedOrder = pageOrder.length ? pageOrder : Array.from({ length: pageCount }, (_v, index) => index + 1);
        const hasPageOrderChanges = pageCount > 0 && (
          normalizedOrder.length !== pageCount ||
          normalizedOrder.some((page, index) => page !== index + 1)
        );
        const cleanRotations = Object.fromEntries(
          Object.entries(pageRotations)
            .map(([page, rotation]) => [page, Number(rotation || 0)])
            .filter(([, rotation]) => rotation !== 0)
        );
        const hasPageRotationChanges = Object.keys(cleanRotations).length > 0;
        const textAnnotations = annotations
          .filter((item) => String(item.text || '').trim() || item.erase)
          .map((item) => ({
            page: item.page,
            x: item.x,
            y: item.y,
            text: item.text,
            size: item.size,
            color: item.color,
            fontFamily: item.fontFamily,
            bold: item.bold,
            erase: item.erase,
            backgroundColor: item.backgroundColor,
            width: item.width,
            height: item.height,
          }));

        if (!textAnnotations.length && !hasPageOrderChanges && !hasPageRotationChanges) {
          setBusy(false);
          return showToast('No hay cambios para aplicar.');
        }

        response = await api.runTool('editPdf', [currentDoc.id], {
          textAnnotations,
          pageOrder: hasPageOrderChanges ? normalizedOrder : undefined,
          rotations: hasPageRotationChanges ? cleanRotations : undefined,
        });
      }

      setResult(response.document);
      downloadDocument(response.document);
      showToast('Archivo listo. Descargando...');
    } catch (error) {
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  function updateSelectedAnnotation(update) {
    if (!selectedId) return;
    setAnnotations((items) => items.map((item) => item.id === selectedId ? { ...item, ...update } : item));
  }

  function changeTextOptions(update) {
    setTextOptions((prev) => ({ ...prev, ...update }));
    updateSelectedAnnotation(update);
  }

  function changeEditorMode(mode) {
    setPreviewMode(false);
    setEditorMode(mode);
  }

  return (
    <>
      <Sidebar user={user} module={module} setModule={setModule} setConvertAction={setConvertAction} openUploadConversion={openUploadConversion} />
      <input
        ref={uploadInputRef}
        className="hidden"
        type="file"
        accept="*/*"
        multiple={module === 'merge'}
        onChange={(event) => uploadPdf(event.target.files)}
      />
      <input
        ref={conversionInputRef}
        className="hidden"
        type="file"
        onChange={(event) => processUploadConversion(event.target.files)}
      />

      <header className="workbench-topbar react-topbar">
        <div className="workbench-title">
          <span className="panel-kicker">{module}</span>
          <h1>{title}</h1>
        </div>
        <div className="workbench-actions">
          <button className="btn-ghost" type="button" onClick={() => uploadInputRef.current.click()}>
            <i className="fas fa-plus"></i> Agregar archivo
          </button>
          {result && (
            <a className="btn-success result-download" href={result.downloadUrl} download={result.name}>
              <i className="fas fa-download"></i> {result.name}
            </a>
          )}
          {!TOOL_MODULES.has(module) && (
            <button className="btn-primary" type="button" disabled={busy} onClick={apply}>
              <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
              {' '}{busy ? 'Procesando...' : primaryLabel}
            </button>
          )}
        </div>
      </header>

      <WorkbenchTabs module={module} setModule={setModule} />

      <section className="workbench-status">
        <div>
          <span className="panel-kicker">Documento</span>
          <strong>{currentDoc?.name || 'Sin documento'}</strong>
        </div>
        <div>
          <span className="panel-kicker">Módulo</span>
          <strong>{title}</strong>
        </div>
        <div>
          <span className="panel-kicker">Acción</span>
          <strong>{module === 'convertir' ? convertLabels[convertAction] : MODULE_MODE[module] || 'Editar'}</strong>
        </div>
      </section>

      {module === 'ia' ? (
        <main className="workbench-shell react-workspace ai-mode">
          <AiAssistantPanel user={user} currentDoc={currentDoc} docs={docs} showToast={showToast} />
        </main>
      ) : TOOL_MODULES.has(module) ? (
        <PdfToolSuite
          module={module}
          docs={docs}
          setDocs={setDocs}
          uploadInputRef={uploadInputRef}
          busy={busy}
          setBusy={setBusy}
          result={result}
          setResult={setResult}
          showToast={showToast}
        />
      ) : (
        <>
          <WorkspaceToolbar
            module={module}
            editorMode={editorMode}
            setEditorMode={changeEditorMode}
            previewMode={previewMode}
            setPreviewMode={setPreviewMode}
            textOptions={textOptions}
            selectedAnnotation={selectedAnnotation}
            changeTextOptions={changeTextOptions}
            convertAction={convertAction}
            setConvertAction={setConvertAction}
            watermarkOptions={watermarkOptions}
            setWatermarkOptions={setWatermarkOptions}
            zoomScale={zoomScale}
            setZoomScale={setZoomScale}
          />

          <main className={`workbench-shell react-workspace ${module === 'convertir' ? 'convert-mode' : ''}`}>
            <DocumentPanel
              docs={docs}
              currentDoc={currentDoc}
              pageCount={pdfPageInfo.pageCount}
              pageOrder={pageOrder}
              setPageOrder={setPageOrder}
              pageRotations={pageRotations}
              setPageRotations={setPageRotations}
              selectedPage={selectedPage}
              setSelectedPage={setSelectedPage}
            />
            {module === 'convertir' && uploadConversions.includes(convertAction) ? (
              <ConversionStage convertAction={convertAction} openUploadConversion={openUploadConversion} busy={busy} />
            ) : (
              <PdfStage
                currentDoc={currentDoc}
                annotations={annotations}
                setAnnotations={setAnnotations}
                editorMode={editorMode}
                previewMode={previewMode}
                textOptions={textOptions}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                module={module}
                pageOrder={pageOrder}
                pageRotations={pageRotations}
                setPageMeta={setPdfPageInfo}
                zoomScale={zoomScale}
              />
            )}
            <ActionsPanel
              module={module}
              busy={busy}
              primaryLabel={primaryLabel}
              apply={apply}
              result={result}
              convertAction={convertAction}
              setConvertAction={setConvertAction}
              openUploadConversion={openUploadConversion}
              editorMode={editorMode}
              setEditorMode={changeEditorMode}
              previewMode={previewMode}
              setPreviewMode={setPreviewMode}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              setAnnotations={setAnnotations}
              protectOptions={protectOptions}
              setProtectOptions={setProtectOptions}
              watermarkOptions={watermarkOptions}
              setWatermarkOptions={setWatermarkOptions}
            />
          </main>
        </>
      )}

      <div className="statusbar">
        <span><i className="fas fa-circle" style={{ fontSize: '.45rem', color: '#4CAF50' }}></i> Listo</span>
        <span>© 2026 DocFlow · Desarrollado por JHS · Historial privado</span>
      </div>
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
