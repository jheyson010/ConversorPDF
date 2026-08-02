import React from 'react';

const TAB_LABELS = {
  inicio: 'Inicio',
  ia: '✨ Asistente IA',
  editar: 'Editar',
  comentario: 'Comentario',
  convertir: 'Convertir',
  ver: 'Ver',
  merge: 'Unir',
  split: 'Dividir',
  compress: 'Comprimir',
  proteger: 'Proteger',
  sign: 'Firmar',
  rotate: 'Rotar',
  herramientas: 'Marca de agua',
};

export function WorkbenchTabs({ module, setModule }) {
  return (
    <nav className="workbench-tabs">
      {['inicio', 'ia', 'editar', 'comentario', 'convertir', 'ver', 'merge', 'split', 'compress', 'proteger', 'sign', 'rotate', 'herramientas'].map((name) => (
        <button key={name} className={`workbench-tab ${module === name ? 'active' : ''}`} type="button" onClick={() => setModule(name)}>
          {TAB_LABELS[name] || name[0].toUpperCase() + name.slice(1)}
        </button>
      ))}
    </nav>
  );
}
