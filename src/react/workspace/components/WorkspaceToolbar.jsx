import React from 'react';
import { convertLabels } from '../constants.js';

const CONVERT_ACTIONS = ['pdfToWord', 'pdfToWordImage', 'compress', 'pdfToImage'];

function convertIcon(action) {
  if (action === 'pdfToImage') return 'fas fa-image';
  if (action.includes('Word')) return 'fas fa-file-word';
  return 'fas fa-compress-arrows-alt';
}

export function WorkspaceToolbar({
  module, editorMode, setEditorMode, previewMode, setPreviewMode, textOptions, selectedAnnotation, changeTextOptions,
  convertAction, setConvertAction, watermarkOptions, setWatermarkOptions,
}) {
  if (module === 'convertir') {
    return (
      <section className="pdf-toolbar stable-toolbar">
        {CONVERT_ACTIONS.map((action) => (
          <button
            key={action}
            className={`toolbar-button ${convertAction === action ? 'active' : ''}`}
            type="button"
            onClick={() => setConvertAction(action)}
          >
            <i className={convertIcon(action)}></i> {convertLabels[action]}
          </button>
        ))}
        <span className="toolbar-hint">Word editable conserva texto y estructura. Word visual es solo para copia exacta no editable.</span>
      </section>
    );
  }

  if (module === 'herramientas') {
    return (
      <section className="pdf-toolbar stable-toolbar">
        <span className="toolbar-label"><i className="fas fa-water"></i> Texto:</span>
        <input
          className="toolbar-input"
          type="text"
          placeholder="CONFIDENCIAL"
          value={watermarkOptions.text}
          onChange={(e) => setWatermarkOptions((prev) => ({ ...prev, text: e.target.value }))}
          style={{ minWidth: 140 }}
        />
        <span className="toolbar-label">Opacidad:</span>
        <input
          className="toolbar-number"
          type="number"
          min="5"
          max="60"
          value={Math.round(watermarkOptions.opacity * 100)}
          onChange={(e) => setWatermarkOptions((prev) => ({ ...prev, opacity: Number(e.target.value) / 100 }))}
        />
        <span className="toolbar-label">%</span>
        <span className="toolbar-hint"><i className="fas fa-info-circle"></i> Configura y pulsa "Aplicar y descargar".</span>
      </section>
    );
  }

  if (module === 'proteger') {
    return (
      <section className="pdf-toolbar stable-toolbar">
        <span className="toolbar-label"><i className="fas fa-lock"></i> Proteger PDF con contrasena</span>
        <span className="toolbar-hint">Configura la contrasena en el panel derecho y pulsa "Aplicar y descargar".</span>
      </section>
    );
  }

  if (module === 'organizar') {
    return (
      <section className="pdf-toolbar stable-toolbar">
        <span className="toolbar-label"><i className="fas fa-sort"></i> Organizar paginas</span>
        <span className="toolbar-hint">Pulsa "Aplicar y descargar" para procesar el documento.</span>
      </section>
    );
  }

  return (
    <section className="pdf-toolbar">
      <button
        className={`toolbar-button ${editorMode === 'select' ? 'active' : ''}`}
        type="button"
        onClick={() => setEditorMode('select')}
      >
        <i className="fas fa-i-cursor"></i> Editar bloque
      </button>
      <button
        className={`toolbar-button ${editorMode === 'addText' ? 'active' : ''}`}
        type="button"
        onClick={() => setEditorMode('addText')}
      >
        <i className="fas fa-square-t"></i> Caja de texto
      </button>
      <button
        className={`toolbar-button ${previewMode ? 'active' : ''}`}
        type="button"
        onClick={() => setPreviewMode((value) => !value)}
      >
        <i className="fas fa-eye"></i> Vista previa
      </button>
      <span className="toolbar-separator"></span>
      <button
        className={`toolbar-button compact ${textOptions.bold ? 'active' : ''}`}
        type="button"
        onClick={() => changeTextOptions({ bold: !textOptions.bold })}
      >
        <strong>B</strong>
      </button>
      <select
        className="toolbar-select"
        value={selectedAnnotation?.fontFamily || textOptions.fontFamily}
        onChange={(event) => changeTextOptions({ fontFamily: event.target.value })}
      >
        <option value="Helvetica">Arial / Helvetica</option>
        <option value="TimesRoman">Times New Roman</option>
        <option value="Courier">Courier</option>
      </select>
      <input
        className="toolbar-number"
        type="number"
        min="7"
        max="48"
        value={selectedAnnotation?.size || textOptions.size}
        onChange={(event) => changeTextOptions({ size: Number(event.target.value || 12) })}
      />
      <input
        className="toolbar-color"
        type="color"
        value={selectedAnnotation?.color || textOptions.color}
        onChange={(event) => changeTextOptions({ color: event.target.value })}
      />
      <span className="toolbar-hint">
        <i className="fas fa-info-circle"></i> Haz clic en una linea para editarla. En caja de texto puedes arrastrar para crear el cuadro.
      </span>
    </section>
  );
}
