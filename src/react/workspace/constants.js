export const initialParams = new URLSearchParams(globalThis.location.search);
export const initialTool = initialParams.get('tool') || 'editPdf';
export const initialIds = (initialParams.get('docs') || '').split(',').filter(Boolean);

// Actions that require uploading a non-PDF file.
export const uploadConversions = ['wordToPdf', 'excelToPdf', 'pptToPdf', 'imageToPdf'];

export const convertLabels = {
  compress: 'Comprimir PDF',
  pdfToWord: 'PDF -> Word',
  pdfToPpt: 'PDF -> PPT',
  pdfToImage: 'PDF -> Imagen',
  wordToPdf: 'Word -> PDF',
  excelToPdf: 'Excel -> PDF',
  pptToPdf: 'PPT -> PDF',
  imageToPdf: 'Imagen -> PDF',
};

export const convertDescriptions = {
  compress: 'Reduce el tamano del archivo PDF manteniendo la calidad.',
  pdfToWord: 'Convierte el PDF a Word editable conservando mejor la posicion del texto.',
  pdfToPpt: 'Convierte tu archivo PDF en una presentacion PowerPoint (.pptx).',
  pdfToImage: 'Exporta cada pagina como imagen PNG en un archivo ZIP.',
  wordToPdf: 'Convierte tu documento Word a formato PDF.',
  excelToPdf: 'Convierte tu hoja de calculo Excel a formato PDF.',
  pptToPdf: 'Convierte tu presentacion PowerPoint a formato PDF.',
  imageToPdf: 'Une imagenes JPG/PNG en un solo archivo PDF.',
};

export const uploadAccept = {
  wordToPdf: '.docx',
  excelToPdf: '.xlsx,.xls',
  pptToPdf: '.pptx',
  imageToPdf: '.jpg,.jpeg,.png',
};

export function isPdf(doc) {
  return doc?.mimeType === 'application/pdf' || /\.pdf$/i.test(doc?.name || '');
}

export function formatBytes(value = 0) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
