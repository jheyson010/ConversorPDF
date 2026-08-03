const express = require('express');
const JSZip = require('jszip');

const router = express.Router();

const FONTS_CATALOG = [
  {
    id: 'roboto',
    name: 'Roboto',
    category: 'Sans-Serif',
    license: 'OFL (Gratis / Libre uso)',
    url: 'https://fonts.google.com/specimen/Roboto',
    downloadUrl: 'https://fonts.google.com/download?family=Roboto',
    styles: ['Regular', 'Bold', 'Italic'],
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    category: 'Sans-Serif',
    license: 'OFL (Gratis / Libre uso)',
    url: 'https://fonts.google.com/specimen/Open+Sans',
    downloadUrl: 'https://fonts.google.com/download?family=Open%20Sans',
    styles: ['Regular', 'Bold', 'Italic'],
  },
  {
    id: 'playfair-display',
    name: 'Playfair Display',
    category: 'Serif (Elegante)',
    license: 'OFL (Gratis / Libre uso)',
    url: 'https://fonts.google.com/specimen/Playfair+Display',
    downloadUrl: 'https://fonts.google.com/download?family=Playfair%20Display',
    styles: ['Regular', 'Bold', 'Italic'],
  },
  {
    id: 'dm-sans',
    name: 'DM Sans',
    category: 'Sans-Serif (Moderno)',
    license: 'OFL (Gratis / Libre uso)',
    url: 'https://fonts.google.com/specimen/DM+Sans',
    downloadUrl: 'https://fonts.google.com/download?family=DM%20Sans',
    styles: ['Regular', 'Bold'],
  },
  {
    id: 'eb-garamond',
    name: 'Garamond (EB Garamond)',
    category: 'Serif (Clásico)',
    license: 'OFL (Gratis / Libre uso)',
    url: 'https://fonts.google.com/specimen/EB+Garamond',
    downloadUrl: 'https://fonts.google.com/download?family=EB%20Garamond',
    styles: ['Regular', 'Bold', 'Italic'],
  },
  {
    id: 'carlito-calibri',
    name: 'Carlito (Calibri compatible)',
    category: 'Sans-Serif (DocFlow)',
    license: 'OFL (Gratis / Libre uso)',
    url: 'https://fonts.google.com/specimen/Carlito',
    downloadUrl: 'https://fonts.google.com/download?family=Carlito',
    styles: ['Regular', 'Bold', 'Italic'],
  },
  {
    id: 'tinos-times',
    name: 'Tinos (Times New Roman compatible)',
    category: 'Serif (DocFlow)',
    license: 'OFL (Gratis / Libre uso)',
    url: 'https://fonts.google.com/specimen/Tinos',
    downloadUrl: 'https://fonts.google.com/download?family=Tinos',
    styles: ['Regular', 'Bold', 'Italic'],
  },
  {
    id: 'arimo-arial',
    name: 'Arimo (Arial compatible)',
    category: 'Sans-Serif (DocFlow)',
    license: 'OFL (Gratis / Libre uso)',
    url: 'https://fonts.google.com/specimen/Arimo',
    downloadUrl: 'https://fonts.google.com/download?family=Arimo',
    styles: ['Regular', 'Bold', 'Italic'],
  },
  {
    id: 'cousine-courier',
    name: 'Cousine (Courier compatible)',
    category: 'Monospace',
    license: 'OFL (Gratis / Libre uso)',
    url: 'https://fonts.google.com/specimen/Cousine',
    downloadUrl: 'https://fonts.google.com/download?family=Cousine',
    styles: ['Regular', 'Bold'],
  },
];

router.get('/', (_req, res) => {
  res.json({ fonts: FONTS_CATALOG });
});

router.get('/download-all', async (_req, res, next) => {
  try {
    const zip = new JSZip();
    const readmeContent = `DocFlow - Paquete de Fuentes Tipográficas para Documentos (TTF/OTF)
========================================================================

Instrucciones de instalación:
1. Descomprime esta carpeta en tu ordenador.
2. En Windows: Selecciona los archivos de fuente (.ttf), haz clic derecho y elige "Instalar para todos los usuarios".
3. En macOS: Haz doble clic en cada archivo .ttf y presiona "Instalar fuente".
4. En Linux: Copia los archivos .ttf a ~/.local/share/fonts o /usr/share/fonts.

Lista de Fuentes Incluidas:
- Roboto (Google Fonts) -> https://fonts.google.com/specimen/Roboto
- Open Sans (Google Fonts) -> https://fonts.google.com/specimen/Open+Sans
- Playfair Display -> https://fonts.google.com/specimen/Playfair+Display
- DM Sans -> https://fonts.google.com/specimen/DM+Sans
- EB Garamond -> https://fonts.google.com/specimen/EB+Garamond
- Carlito (Calibri) -> https://fonts.google.com/specimen/Carlito
- Tinos (Times New Roman) -> https://fonts.google.com/specimen/Tinos
- Arimo (Arial) -> https://fonts.google.com/specimen/Arimo
- Cousine (Courier New) -> https://fonts.google.com/specimen/Cousine

© 2026 DocFlow Studio`;

    zip.file('LEAME_INSTALACION.txt', readmeContent);
    const content = await zip.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="DocFlow-Fuentes-Tipograficas.zip"');
    return res.send(content);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
