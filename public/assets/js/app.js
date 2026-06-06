import { setupAuth } from './auth.js?v=20260606-access';
import { setupDocuments } from './documents.js?v=20260606-access';
import { findModule, findTool, modules, tools } from './tools.js?v=20260606-access';
import { $, escapeHtml, toast } from './ui.js?v=20260606-access';

const toolsGrid = $('#toolsGrid');
const ribbonActions = $('#ribbonActions');
const moduleKicker = $('#moduleKicker');
const moduleTitle = $('#moduleTitle');
const moduleDescription = $('#moduleDescription');
const toolsSectionTitle = $('#toolsSectionTitle');
const uploadToolTitle = $('#uploadToolTitle');
const uploadToolDescription = $('#uploadToolDescription');
const fileInput = $('#fileInput');
const uploadFormatPills = $('#uploadFormatPills');
const selectFirstToolButton = $('#selectFirstToolButton');
const uploadOptions = $('#uploadOptions');

let currentUser = null;
let activeTool = null;
let activeModuleId = 'inicio';
let documentsModule;

const UNIVERSAL_ACCEPT = '*/*';
const UNIVERSAL_FORMATS = ['PDF', 'DOCX', 'XLSX', 'PPTX', 'JPG', 'PNG', 'TXT', 'CSV'];

function toolsForModule(moduleId) {
  const module = findModule(moduleId) || modules[0];
  return module.tools.map(findTool).filter(Boolean);
}

function setUploadAccept(tool) {
  const formats = [];
  if (!tool) {
    fileInput.accept = UNIVERSAL_ACCEPT;
    fileInput.multiple = true;
    formats.push(...UNIVERSAL_FORMATS);
    renderUploadFormats(formats);
    return;
  }
  if (tool.id === 'imageToPdf') {
    fileInput.accept = '.jpg,.jpeg,.png';
    fileInput.multiple = true;
    formats.push('JPG', 'PNG');
    renderUploadFormats(formats);
    return;
  }
  if (tool.id === 'wordToPdf') {
    fileInput.accept = '.docx';
    fileInput.multiple = false;
    formats.push('DOCX');
    renderUploadFormats(formats);
    return;
  }
  if (tool.id === 'excelToPdf') {
    fileInput.accept = '.xlsx,.xls';
    fileInput.multiple = false;
    formats.push('XLSX', 'XLS');
    renderUploadFormats(formats);
    return;
  }
  if (tool.id === 'pptToPdf') {
    fileInput.accept = '.pptx';
    fileInput.multiple = false;
    formats.push('PPTX');
    renderUploadFormats(formats);
    return;
  }
  if (tool.id === 'merge') {
    fileInput.accept = '.pdf';
    fileInput.multiple = true;
    formats.push('PDF múltiple');
    renderUploadFormats(formats);
    return;
  }
  fileInput.accept = '.pdf';
  fileInput.multiple = false;
  formats.push('PDF');
  renderUploadFormats(formats);
}

function renderUploadFormats(formats) {
  uploadFormatPills.innerHTML = formats
    .map((format) => `<span class="pill">${escapeHtml(format)}</span>`)
    .join('');
}

function renderModuleTabs() {
  document.querySelectorAll('[data-module]').forEach((button) => {
    button.classList.toggle('active', button.dataset.module === activeModuleId);
  });
}

function renderRibbon() {
  const module = findModule(activeModuleId) || modules[0];
  moduleKicker.textContent = module.title;
  moduleTitle.textContent = module.title === 'Inicio' ? 'Elige una categoría' : module.title;
  moduleDescription.textContent = module.description;
  toolsSectionTitle.textContent = module.title === 'Inicio' ? 'Herramientas' : `Herramientas de ${module.title}`;

  const readyTools = toolsForModule(activeModuleId).filter((tool) => !tool.disabled);
  ribbonActions.innerHTML = readyTools.length
    ? readyTools.map((tool) => `
        <button class="ribbon-action ${tool.id === activeTool?.id ? 'active' : ''}" type="button" data-ribbon-tool="${tool.id}">
          <i class="fas ${tool.icon}"></i>
          <span>${escapeHtml(tool.title)}</span>
        </button>
      `).join('')
    : '<div class="empty-state">Este módulo está preparado para crecer, pero todavía no tiene acciones activas.</div>';

  ribbonActions.querySelectorAll('[data-ribbon-tool]').forEach((button) => {
    button.addEventListener('click', () => selectTool(button.dataset.ribbonTool));
  });
}

function renderTools() {
  toolsGrid.innerHTML = toolsForModule(activeModuleId)
    .map((tool) => `
      <button class="tool-card ${tool.id === activeTool?.id ? 'active' : ''} ${tool.disabled ? 'disabled' : ''}" data-tool-id="${tool.id}" type="button">
        <span class="tool-icon"><i class="fas ${tool.icon}"></i></span>
        <h3>${escapeHtml(tool.title)}</h3>
        <p>${escapeHtml(tool.description)}</p>
        <span class="tool-badge ${tool.badgeClass}">${escapeHtml(tool.badge)}</span>
      </button>
    `)
    .join('');

  toolsGrid.querySelectorAll('[data-tool-id]').forEach((button) => {
    button.addEventListener('click', () => selectTool(button.dataset.toolId));
  });
}

function renderField(field) {
  const value = field.value ?? '';
  const common = `name="${escapeHtml(field.name)}" data-tool-option="${escapeHtml(field.name)}"`;
  if (field.type === 'select') {
    const options = (field.options || [])
      .map(([optionValue, label]) => `<option value="${escapeHtml(optionValue)}" ${String(optionValue) === String(value) ? 'selected' : ''}>${escapeHtml(label)}</option>`)
      .join('');
    return `
      <label class="${field.wide ? 'wide' : ''}">
        ${escapeHtml(field.label)}
        <select ${common}>${options}</select>
      </label>
    `;
  }
  return `
    <label class="${field.wide ? 'wide' : ''}">
      ${escapeHtml(field.label)}
      <input ${common} type="${escapeHtml(field.type || 'text')}" value="${escapeHtml(value)}" min="${escapeHtml(field.min ?? '')}" max="${escapeHtml(field.max ?? '')}" step="${escapeHtml(field.step ?? '')}" placeholder="${escapeHtml(field.placeholder ?? '')}">
    </label>
  `;
}

function renderUploadOptions() {
  const fields = activeTool?.fields || [];
  uploadOptions.classList.toggle('hidden', fields.length === 0);
  uploadOptions.innerHTML = fields.map(renderField).join('');
}

function currentToolOptions() {
  const options = {};
  uploadOptions.querySelectorAll('[data-tool-option]').forEach((field) => {
    const value = field.value;
    options[field.dataset.toolOption] = field.type === 'number' ? Number(value) : value;
  });
  return options;
}

function renderAll() {
  renderModuleTabs();
  renderRibbon();
  renderTools();
}

function selectModule(moduleId) {
  activeModuleId = findModule(moduleId) ? moduleId : 'inicio';
  const moduleTools = toolsForModule(activeModuleId);
  if (!moduleTools.some((tool) => tool.id === activeTool?.id)) {
    activeTool = null;
    uploadToolTitle.textContent = 'Selecciona una herramienta para continuar';
    uploadToolDescription.textContent = 'Después de elegir una acción, sube el archivo y DocFlow abrirá el workspace o procesará la conversión.';
    setUploadAccept(null);
    renderUploadOptions();
  }
  renderAll();
  $('#herramientas').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectTool(toolId) {
  const tool = findTool(toolId);
  if (!tool) return;
  if (tool.disabled) {
    toast(`${tool.title} todavía necesita motor externo.`);
    return;
  }

  activeTool = tool;
  uploadToolTitle.textContent = tool.title;
  uploadToolDescription.textContent = tool.workspace
    ? 'Al subirlo se abre el workspace con vista completa del PDF y controles superiores.'
    : 'Al subirlo se procesa con la herramienta activa y se guarda el resultado en tu historial.';
  setUploadAccept(tool);
  renderUploadOptions();
  renderAll();
  $('#uploadSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectToolShortcut(toolId) {
  const module = modules.find((item) => item.tools.includes(toolId));
  if (module) activeModuleId = module.id;
  selectTool(toolId);
}

function selectRecommendedTool() {
  const tool = toolsForModule(activeModuleId).find((item) => !item.disabled);
  if (tool) selectTool(tool.id);
}

function inferToolForFiles(files) {
  const items = Array.from(files || []);
  if (!items.length) return null;
  const names = items.map((file) => String(file.name || '').toLowerCase());
  const ext = (name) => name.split('.').pop();
  const all = (extensions) => names.every((name) => extensions.includes(ext(name)));

  if (all(['jpg', 'jpeg', 'png', 'webp', 'gif'])) return findTool('imageToPdf');
  if (items.length > 1 && all(['pdf'])) return findTool('merge');
  if (all(['doc', 'docx'])) return findTool('wordToPdf');
  if (all(['xls', 'xlsx', 'csv'])) return findTool('excelToPdf');
  if (all(['ppt', 'pptx'])) return findTool('pptToPdf');
  if (all(['pdf'])) return findTool('editPdf');
  return null;
}

document.querySelectorAll('[data-module]').forEach((button) => {
  button.addEventListener('click', () => selectModule(button.dataset.module));
});

document.querySelectorAll('[data-tool-shortcut]').forEach((button) => {
  button.addEventListener('click', () => selectToolShortcut(button.dataset.toolShortcut));
});

selectFirstToolButton?.addEventListener('click', selectRecommendedTool);

const auth = setupAuth(async (user) => {
  currentUser = user;
  if (user) await documentsModule.refresh();
  else documentsModule.clear();
});

documentsModule = setupDocuments({
  requireAuth: async () => {
    if (currentUser) return currentUser;
    auth.open();
    return null;
  },
  getActiveTool: () => activeTool,
  inferToolForFiles,
  getToolOptions: currentToolOptions,
});

renderAll();
activeTool = null;
uploadToolTitle.textContent = 'Sube cualquier archivo para empezar';
uploadToolDescription.textContent = 'DocFlow detectara el formato y abrira la herramienta correcta automaticamente.';
setUploadAccept(null);
renderUploadOptions();
renderAll();

auth.loadSession().catch(() => {
  currentUser = null;
});
