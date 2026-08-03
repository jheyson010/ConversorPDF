import { api } from './api.js?v=20260615-public';
import { findTool, tools } from './tools.js?v=20260615-public';
import { $, escapeHtml, formatBytes, toast } from './ui.js?v=20260615-public';

const dashboardAvatar = $('#dashboardAvatar');
const dashboardUserName = $('#dashboardUserName');
const dashboardPlan = $('#dashboardPlan');
const dashboardFiles = $('#dashboardFiles');
const dashboardTools = $('#dashboardTools');
const dashboardFileInput = $('#dashboardFileInput');
const dashboardUploadBox = $('#dashboardUploadBox');
const dashboardUploadTitle = $('#dashboardUploadTitle');
const dashboardFormats = $('#dashboardFormats');
const welcomeTitle = $('#welcomeTitle');
const activeToolHelp = $('#activeToolHelp');
const topbarTitle = $('#topbarTitle');
const breadcrumbCurrent = $('#breadcrumbCurrent');
const recentItemsHome = $('#recentItemsHome');
const recentFullList = $('#recentFullList');
const statusText = $('#statusText');
const statusFile = $('#statusFile');
const statusInfo = $('#statusInfo');
const fileSearchInput = $('#fileSearchInput');
const storageProgress = $('#storageProgress');
const storageLabel = $('#storageLabel');

let activeTool = null;
let currentUser = null;
let documents = [];

const dashboardToolIds = [
  'wordToPdf',
  'editPdf',
  'pdfToWord',
  'imageToPdf',
  'merge',
  'compress',
  'protect',
  'split',
  'watermark',
  'rotate',
  'pdfToImage',
  'ocr',
];

const toolLabels = {
  wordToPdf: ['Editar Word', 'Modifica .docx con formato completo', 'WORD', 'ti-file-type-doc'],
  editPdf: ['Editar PDF', 'Anota y edita PDFs', 'PDF', 'ti-file-type-pdf'],
  pdfToWord: ['PDF -> Word', 'Alta fidelidad de conversión', 'CONVERSIÓN', 'ti-arrows-exchange'],
  imageToPdf: ['Imagen -> PDF', 'Convierte JPG/PNG en PDF', 'CONVERSIÓN', 'ti-photo'],
  merge: ['Unir PDFs', 'Combina múltiples documentos', 'PDF', 'ti-arrows-join'],
  compress: ['Comprimir', 'Reduce tamaño sin perder calidad', 'PDF', 'ti-compress'],
  protect: ['Proteger', 'Cifrado AES-256 y permisos', 'SEGURIDAD', 'ti-lock'],
  split: ['Dividir PDF', 'Extrae páginas o rangos', 'PDF', 'ti-scissors'],
  watermark: ['Marca de agua', 'Watermark personalizable', 'PDF', 'ti-droplet'],
  rotate: ['Rotar páginas', 'Reorienta cualquier página', 'PDF', 'ti-rotate'],
  pdfToImage: ['PDF -> Imagen', 'Exporta páginas a PNG', 'CONVERSIÓN', 'ti-photo'],
  ocr: ['OCR', 'Extrae texto con IA', 'IA', 'ti-eye'],
};

function setUser(user) {
  const displayName = user.name || user.email || 'Cuenta';
  dashboardUserName.textContent = displayName;
  welcomeTitle.textContent = `Bienvenido, ${displayName.split(' ')[0]}`;
  dashboardPlan.textContent = user.plan === 'pro' ? 'Plan Pro' : 'Plan Gratis';
  if (user.avatarUrl) {
    dashboardAvatar.innerHTML = `<img src="${escapeHtml(user.avatarUrl)}" alt="">`;
  } else {
    dashboardAvatar.textContent = displayName.slice(0, 2).toUpperCase();
  }
}

function formatsForTool(tool) {
  if (!tool) return ['PDF', 'DOCX', 'XLSX', 'PPTX', 'JPG', 'PNG'];
  if (tool.id === 'imageToPdf') return ['JPG', 'PNG'];
  if (tool.id === 'wordToPdf') return ['DOCX'];
  if (tool.id === 'excelToPdf') return ['XLSX', 'XLS'];
  if (tool.id === 'pptToPdf') return ['PPTX'];
  if (tool.id === 'merge') return ['PDF', 'PDF múltiple'];
  return ['PDF'];
}

function setAcceptForTool(tool) {
  if (!tool) {
    dashboardFileInput.accept = '*/*';
    dashboardFileInput.multiple = true;
  } else if (tool.id === 'imageToPdf') {
    dashboardFileInput.accept = '.jpg,.jpeg,.png';
    dashboardFileInput.multiple = true;
  } else if (tool.id === 'wordToPdf') {
    dashboardFileInput.accept = '.docx';
    dashboardFileInput.multiple = false;
  } else if (tool.id === 'excelToPdf') {
    dashboardFileInput.accept = '.xlsx,.xls';
    dashboardFileInput.multiple = false;
  } else if (tool.id === 'pptToPdf') {
    dashboardFileInput.accept = '.pptx';
    dashboardFileInput.multiple = false;
  } else if (tool.id === 'merge') {
    dashboardFileInput.accept = '.pdf';
    dashboardFileInput.multiple = true;
  } else {
    dashboardFileInput.accept = '.pdf';
    dashboardFileInput.multiple = false;
  }

  dashboardFormats.innerHTML = formatsForTool(tool)
    .map((format) => `<span class="fpill">${escapeHtml(format)}</span>`)
    .join('');
}

function inferToolForFiles(files) {
  const items = Array.from(files || []);
  if (!items.length) return null;
  const names = items.map((file) => String(file.name || '').toLowerCase());
  const ext = (name) => name.split('.').pop();
  const all = (extensions) => names.every((name) => extensions.includes(ext(name)));

  if (all(['jpg', 'jpeg', 'png', 'webp'])) return findTool('imageToPdf');
  if (items.length > 1 && all(['pdf'])) return findTool('merge');
  if (all(['doc', 'docx'])) return findTool('wordToPdf');
  if (all(['xls', 'xlsx', 'csv'])) return findTool('excelToPdf');
  if (all(['ppt', 'pptx'])) return findTool('pptToPdf');
  if (all(['pdf'])) return findTool('editPdf');
  return null;
}

function setSection(section) {
  const views = {
    home: $('#homeView'),
    files: $('#filesView'),
    recent: $('#recentView'),
    word: $('#wordEditorView'),
  };
  Object.entries(views).forEach(([name, element]) => {
    element.classList.toggle('hidden', name !== section);
  });
  document.querySelectorAll('[data-section]').forEach((button) => {
    button.classList.toggle('active', button.dataset.section === section);
  });
  const titles = { home: 'Inicio', files: 'Mis archivos', recent: 'Recientes', word: 'Editor Word' };
  topbarTitle.textContent = titles[section] || 'Inicio';
  breadcrumbCurrent.textContent = `/ ${titles[section] || 'Inicio'}`;
}

function selectTool(toolId) {
  const tool = findTool(toolId);
  if (!tool || tool.disabled) {
    toast(tool?.title ? `${tool.title} necesita integración adicional.` : 'Herramienta no disponible.');
    return;
  }
  activeTool = tool;
  const label = toolLabels[tool.id] || [tool.title, tool.description];
  dashboardUploadTitle.textContent = `Subir para: ${label[0]}`;
  activeToolHelp.textContent = tool.workspace
    ? 'Se abrirá el workspace con controles de edición.'
    : 'Se procesará y guardará el resultado en tu historial.';
  setAcceptForTool(tool);
  setSection('home');
  document.querySelectorAll('[data-tool-id]').forEach((button) => {
    button.classList.toggle('active', button.dataset.toolId === tool.id);
  });
  dashboardUploadBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function renderTools() {
  dashboardTools.innerHTML = dashboardToolIds
    .map((id) => findTool(id))
    .filter(Boolean)
    .filter((tool) => !tool.disabled)
    .map((tool) => {
      const [title, description, badge, icon] = toolLabels[tool.id] || [tool.title, tool.description, tool.badge, tool.icon];
      return `
        <button class="dash-tool ${tool.id === activeTool?.id ? 'active' : ''}" type="button" data-tool-id="${tool.id}">
          <span class="dt-icon"><i class="ti ${escapeHtml(icon)}"></i></span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(description)}</p>
          <span class="dash-badge ${badge === 'WORD' ? 'fmt-word' : badge === 'CONVERSIÓN' ? 'fmt-img' : 'fmt-pdf'}">${escapeHtml(badge)}</span>
        </button>
      `;
    })
    .join('');
}

function fileRow(doc) {
  const downloadUrl = doc.downloadUrl || `/api/documents/${encodeURIComponent(doc.id)}/download`;
  return `
    <div class="recent-item">
      <span class="doc-file-icon"><i class="ti ti-file"></i></span>
      <span class="ri-info">
        <span class="ri-name">${escapeHtml(doc.name)}</span>
        <span class="ri-meta">${formatBytes(doc.sizeBytes)} · ${escapeHtml(doc.kind || 'archivo')}</span>
      </span>
      <div style="display:flex; gap:0.4rem; align-items:center;">
        <a class="tb-btn" style="padding:0.35rem 0.65rem;" href="/workspace.html?tool=editPdf&docs=${encodeURIComponent(doc.id)}"><i class="ti ti-edit"></i> Abrir</a>
        <a class="tb-btn tb-btn-gold" style="padding:0.35rem 0.65rem;" href="${downloadUrl}" download="${escapeHtml(doc.name)}"><i class="ti ti-download"></i> Descargar</a>
      </div>
    </div>
  `;
}

function renderFiles(filter = '') {
  const normalized = filter.trim().toLowerCase();
  const visible = normalized
    ? documents.filter((doc) => doc.name.toLowerCase().includes(normalized))
    : documents;

  const empty = '<div class="empty-state">Todavía no tienes archivos. Sube uno para empezar.</div>';
  dashboardFiles.innerHTML = visible.length ? visible.map(fileRow).join('') : empty;
  recentFullList.innerHTML = documents.length ? documents.slice(0, 20).map(fileRow).join('') : empty;
  recentItemsHome.innerHTML = documents.length ? documents.slice(0, 4).map(fileRow).join('') : empty;
  statusInfo.textContent = `${documents.length} archivo(s)`;
  const usedBytes = documents.reduce((total, doc) => total + Number(doc.sizeBytes || 0), 0);
  const maxBytes = 10 * 1024 * 1024 * 1024;
  const percent = Math.min(100, (usedBytes / maxBytes) * 100);
  storageProgress.style.width = `${percent}%`;
  storageLabel.textContent = `${formatBytes(usedBytes)} / 10 GB`;
  statusText.textContent = documents.length ? 'Historial actualizado' : 'Sin archivos cargados';
}

async function refresh() {
  const history = await api.history();
  documents = history.documents || [];
  renderFiles(fileSearchInput.value);
}

function triggerDownload(document) {
  if (!document) return;
  const link = window.document.createElement('a');
  link.href = document.downloadUrl || `/api/documents/${encodeURIComponent(document.id)}/download`;
  link.download = document.name || 'resultado';
  window.document.body.appendChild(link);
  link.click();
  link.remove();
}

function handleDownloadLatest() {
  if (documents && documents.length > 0) {
    const latest = documents[0];
    triggerDownload(latest);
    toast(`Descargando: ${latest.name}`);
  } else {
    toast('Sube o convierte un archivo primero para poder descargar.');
  }
}

async function uploadFiles(files) {
  if (!files?.length) return;
  const tool = activeTool || inferToolForFiles(files);
  if (!tool) {
    toast('Selecciona una herramienta compatible para este archivo.');
    return;
  }
  try {
    dashboardUploadBox.classList.add('dragging');
    const upload = await api.upload(files);
    const ids = upload.documents.map((doc) => doc.id);
    statusFile.textContent = upload.documents[0]?.name || '';

    if (tool.workspace) {
      window.location.href = `/workspace.html?tool=${encodeURIComponent(tool.id)}&docs=${encodeURIComponent(ids.join(','))}`;
      return;
    }

    const result = await api.runTool(tool.id, ids, {});
    triggerDownload(result.document);
    toast('Resultado listo para descargar.');
    await refresh();
  } catch (error) {
    toast(error.message);
  } finally {
    dashboardUploadBox.classList.remove('dragging');
    dashboardFileInput.value = '';
  }
}

async function init() {
  const { user } = await api.me();
  if (!user) {
    window.location.href = '/';
    return;
  }
  currentUser = user;
  setUser(user);
  renderTools();
  setAcceptForTool(null);
  setSection('home');
  await refresh();
}

document.addEventListener('click', (event) => {
  const sectionButton = event.target.closest('[data-section]');
  if (sectionButton) setSection(sectionButton.dataset.section);

  const toolButton = event.target.closest('[data-tool-id]');
  if (toolButton) selectTool(toolButton.dataset.toolId);

  const editorButton = event.target.closest('[data-editor-view="word"]');
  if (editorButton) {
    setSection('word');
    document.querySelectorAll('.sb-item').forEach((button) => button.classList.remove('active'));
    editorButton.classList.add('active');
  }

  const commandButton = event.target.closest('[data-command]');
  if (commandButton) {
    document.execCommand(commandButton.dataset.command, false, null);
    commandButton.classList.toggle('active');
  }
});

$('#wordFontFamilySelect')?.addEventListener('change', (e) => {
  document.execCommand('fontName', false, e.target.value);
});

$('#wordFontSizeSelect')?.addEventListener('change', (e) => {
  document.execCommand('fontSize', false, e.target.value);
});

const fontsModal = $('#fontsModal');
const closeFontsModal = $('#closeFontsModal');
const openFontsModalBtn = $('#openFontsModalBtn');
const wordRightFontsButton = $('#wordRightFontsButton');
const fontsCatalogContainer = $('#fontsCatalogContainer');

async function loadFontsCatalog() {
  if (!fontsCatalogContainer) return;
  try {
    const res = await fetch('/api/fonts');
    const data = await res.json();
    const list = data.fonts || [];
    fontsCatalogContainer.innerHTML = list.map((font) => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--dark3); border:1px solid var(--border); padding:0.55rem 0.8rem; border-radius:2px;">
        <div>
          <strong style="font-size:0.88rem; color:var(--text);">${escapeHtml(font.name)}</strong>
          <div style="font-size:0.68rem; color:var(--text-muted);">${escapeHtml(font.category)} · ${escapeHtml(font.license)}</div>
        </div>
        <div style="display:flex; gap:0.4rem;">
          <a class="tb-btn tb-btn-gold" style="padding:0.3rem 0.65rem; font-size:0.72rem;" href="${font.downloadUrl}" target="_blank" rel="noopener"><i class="ti ti-download"></i> Descargar TTF</a>
        </div>
      </div>
    `).join('');
  } catch (_e) {
    fontsCatalogContainer.innerHTML = '<div class="empty-state">No se pudo cargar el catálogo de fuentes.</div>';
  }
}

function openFontsModal() {
  if (fontsModal && !fontsModal.open) {
    fontsModal.showModal();
    loadFontsCatalog();
  }
}

openFontsModalBtn?.addEventListener('click', openFontsModal);
wordRightFontsButton?.addEventListener('click', openFontsModal);
closeFontsModal?.addEventListener('click', () => fontsModal?.close());

$('#topDownloadButton')?.addEventListener('click', handleDownloadLatest);
$('#wordDownloadToolbarButton')?.addEventListener('click', handleDownloadLatest);
$('#wordRightDownloadButton')?.addEventListener('click', handleDownloadLatest);

$('#topUploadButton').addEventListener('click', () => dashboardFileInput.click());
$('#filesUploadButton').addEventListener('click', () => dashboardFileInput.click());
$('#wordUploadButton').addEventListener('click', () => dashboardFileInput.click());
$('#wordSideUploadButton').addEventListener('click', () => dashboardFileInput.click());
$('#wordEmptyUploadButton').addEventListener('click', () => {
  selectTool('wordToPdf');
  dashboardFileInput.click();
});
$('#convertButton').addEventListener('click', () => selectTool('pdfToWord'));
fileSearchInput.addEventListener('input', () => renderFiles(fileSearchInput.value));
dashboardFileInput.addEventListener('change', () => uploadFiles(dashboardFileInput.files));
dashboardUploadBox.addEventListener('dragover', (event) => {
  event.preventDefault();
  dashboardUploadBox.classList.add('dragging');
});
dashboardUploadBox.addEventListener('dragleave', () => dashboardUploadBox.classList.remove('dragging'));
dashboardUploadBox.addEventListener('drop', (event) => {
  event.preventDefault();
  uploadFiles(event.dataTransfer.files);
});
$('#refreshDashboardButton').addEventListener('click', () => refresh().catch((error) => toast(error.message)));
async function openSubscriptionCheckout(button) {
  try {
    button.disabled = true;
    const checkout = await api.createSubscriptionCheckout();
    window.location.href = checkout.checkoutUrl;
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}
$('#dashboardSubscribeButton').addEventListener('click', (event) => openSubscriptionCheckout(event.currentTarget));
$('#topSubscribeButton').addEventListener('click', (event) => openSubscriptionCheckout(event.currentTarget));
$('#logoutButton').addEventListener('click', async () => {
  await api.logout();
  window.location.href = '/';
});

init().catch((error) => {
  toast(error.message);
  if (!currentUser) window.location.href = '/';
});

