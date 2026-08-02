import { api } from './api.js?v=20260615-public';
import { $, escapeHtml, formatBytes, toast } from './ui.js?v=20260615-public';

export function setupDocuments({ requireAuth, getActiveTool, inferToolForFiles, getToolOptions }) {
  const recentStrip = $('#recentStrip');
  const list = $('#documentList');
  const fileInput = $('#fileInput');
  const uploadBox = $('#uploadBox');
  const heroUploadButton = $('#heroUploadButton');
  const refreshButton = $('#refreshHistoryButton');
  const docsSummary = $('#docsSummary');

  let documents = [];
  let authenticated = false;

  function render() {
    if (recentStrip) recentStrip.classList.toggle('hidden', documents.length === 0);
    if (!documents.length) {
      if (docsSummary) {
        docsSummary.innerHTML = authenticated
          ? '<span>No hay documentos en esta cuenta todavia.</span>'
          : '<span>Inicia sesion para ver tus documentos.</span>';
      }
      if (list) list.innerHTML = '<div class="empty-state">Todavia no tienes documentos.</div>';
      return;
    }

    const uploads = documents.filter((doc) => doc.kind === 'upload').length;
    const outputs = documents.filter((doc) => doc.kind === 'output').length;
    if (docsSummary) {
      docsSummary.innerHTML = `
        <span><strong>${documents.length}</strong> documentos guardados</span>
        <span><strong>${uploads}</strong> subidos - <strong>${outputs}</strong> resultados</span>
      `;
    }

    if (list) {
      list.innerHTML = documents.slice(0, 8).map((doc) => `
        <article class="document-item compact">
          <span class="doc-file-icon"><i class="fas fa-file"></i></span>
          <span>
            <span class="doc-name">${escapeHtml(doc.name)}</span>
            <span class="doc-meta">${escapeHtml(doc.kind)} - ${formatBytes(doc.sizeBytes)}</span>
          </span>
          <a class="doc-download" href="/workspace.html?tool=editPdf&docs=${doc.id}" title="Abrir"><i class="fas fa-arrow-up-right-from-square"></i></a>
        </article>
      `).join('');
    }
  }

  async function refresh() {
    authenticated = true;
    const { documents: items } = await api.history();
    documents = items;
    render();
  }

  function triggerDownload(document) {
    const link = window.document.createElement('a');
    link.href = document.downloadUrl;
    link.download = document.name || 'resultado';
    link.style.display = 'none';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function uploadFiles(files) {
    if (!files || !files.length) return;
    const user = await requireAuth();
    if (!user) return;

    const tool = getActiveTool() || inferToolForFiles?.(files);

    try {
      uploadBox.classList.add('dragging');
      const result = await api.upload(files);
      if (!tool) {
        toast('Archivo guardado en tu historial.');
        await refresh();
        return;
      }

      const ids = result.documents.map((doc) => doc.id).join(',');
      if (tool.workspace) {
        toast('Archivo listo. Abriendo workspace...');
        window.location.href = `/workspace.html?tool=${encodeURIComponent(tool.id)}&docs=${encodeURIComponent(ids)}`;
        return;
      }

      toast('Procesando documento...');
      const output = await api.runTool(tool.id, result.documents.map((doc) => doc.id), {
        ...defaultOptions(tool),
        ...(getToolOptions?.() || {}),
      });
      triggerDownload(output.document);
      toast(`Resultado listo para descargar: ${output.document.name}`);
      await refresh();
    } catch (error) {
      toast(error.message);
    } finally {
      uploadBox.classList.remove('dragging');
      fileInput.value = '';
    }
  }

  fileInput?.addEventListener('change', () => uploadFiles(fileInput.files));
  uploadBox?.addEventListener('submit', (event) => event.preventDefault());
  heroUploadButton?.addEventListener('click', () => fileInput.click());
  refreshButton?.addEventListener('click', () => refresh().catch((error) => toast(error.message)));

  uploadBox.addEventListener('dragover', (event) => {
    event.preventDefault();
    uploadBox.classList.add('dragging');
  });
  uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('dragging'));
  uploadBox.addEventListener('drop', (event) => {
    event.preventDefault();
    uploadBox.classList.remove('dragging');
    uploadFiles(event.dataTransfer.files);
  });

  return {
    refresh,
    clear() {
      authenticated = false;
      documents = [];
      render();
    },
  };
}

function defaultOptions(tool) {
  if (tool.id === 'split') return { pages: '1' };
  if (tool.id === 'rotate') return { pages: '', degrees: 90 };
  if (tool.id === 'watermark') return { text: 'DocFlow', size: 42, opacity: 0.22 };
  return {};
}
