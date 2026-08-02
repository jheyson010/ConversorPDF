const JSZip = require('jszip');
const { renderPdfPagesAsImages, renderPdfPagesWithBrowser } = require('./renderer');

function xmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function pdfToPpt(document) {
  let pages = [];
  try {
    pages = await renderPdfPagesAsImages(document, { scale: 1.5 });
  } catch (_err) {
    try {
      pages = await renderPdfPagesWithBrowser(document);
    } catch (_browserErr) {
      throw new Error('No se pudo renderizar las páginas del PDF para PowerPoint.');
    }
  }

  if (!pages || !pages.length) {
    throw new Error('El PDF no contiene páginas válidas para convertir a PPT.');
  }

  const zip = new JSZip();

  // [Content_Types].xml
  const contentTypesParts = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '  <Default Extension="xml" ContentType="application/xml"/>',
    '  <Default Extension="png" ContentType="image/png"/>',
    '  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
  ];
  pages.forEach((_, index) => {
    contentTypesParts.push(`  <Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
  });
  contentTypesParts.push('</Types>');
  zip.file('[Content_Types].xml', contentTypesParts.join('\n'));

  // _rels/.rels
  zip.file('_rels/.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>',
    '</Relationships>',
  ].join('\n'));

  // ppt/_rels/presentation.xml.rels
  const presRelsParts = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
  ];
  pages.forEach((_, index) => {
    presRelsParts.push(`  <Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`);
  });
  presRelsParts.push('</Relationships>');
  zip.file('ppt/_rels/presentation.xml.rels', presRelsParts.join('\n'));

  // ppt/presentation.xml
  const firstPage = pages[0];
  const pdfWidth = Number(firstPage?.pdfWidth || 595.28);
  const pdfHeight = Number(firstPage?.pdfHeight || 841.89);
  // Convert points to EMUs (English Metric Units: 1 pt = 12700 EMUs)
  const cxEmu = Math.round(pdfWidth * 12700);
  const cyEmu = Math.round(pdfHeight * 12700);

  const slideIdList = pages.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join('');
  const presentationXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
    `  <p:sldIdLst>${slideIdList}</p:sldIdLst>`,
    `  <p:sldSz cx="${cxEmu}" cy="${cyEmu}" type="custom"/>`,
    `  <p:notesSz cx="${cxEmu}" cy="${cyEmu}"/>`,
    '</p:presentation>',
  ].join('\n');
  zip.file('ppt/presentation.xml', presentationXml);

  // Generate slides and media
  pages.forEach((page, index) => {
    const slideNum = index + 1;
    const imgFileName = `image${slideNum}.png`;
    zip.file(`ppt/media/${imgFileName}`, page.buffer);

    // ppt/slides/_rels/slideN.xml.rels
    zip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`, [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      `  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${imgFileName}"/>`,
      '</Relationships>',
    ].join('\n'));

    // ppt/slides/slideN.xml
    const pW = Math.round(Number(page.pdfWidth || pdfWidth) * 12700);
    const pH = Math.round(Number(page.pdfHeight || pdfHeight) * 12700);

    const slideXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
      '  <p:cSld>',
      '    <p:spTree>',
      '      <p:nvGrpSpPr>',
      '        <p:cNvPr id="1" name=""/>',
      '        <p:cNvGrpSpPr/>',
      '        <p:nvPr/>',
      '      </p:nvGrpSpPr>',
      '      <p:grpSpPr>',
      '        <a:xfrm>',
      '          <a:off x="0" y="0"/>',
      '          <a:ext cx="0" cy="0"/>',
      '          <a:chOff x="0" y="0"/>',
      '          <a:chExt cx="0" cy="0"/>',
      '        </a:xfrm>',
      '      </p:grpSpPr>',
      '      <p:pic>',
      '        <p:nvPicPr>',
      `          <p:cNvPr id="${slideNum + 1}" name="Slide Image ${slideNum}"/>`,
      '          <p:cNvPicPr/>',
      '          <p:nvPr/>',
      '        </p:nvPicPr>',
      '        <p:blipFill>',
      '          <a:blip r:embed="rId1"/>',
      '          <a:stretch><a:fillRect/></a:stretch>',
      '        </p:blipFill>',
      '        <p:spPr>',
      '          <a:xfrm>',
      '            <a:off x="0" y="0"/>',
      `            <a:ext cx="${pW}" cy="${pH}"/>`,
      '          </a:xfrm>',
      '          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
      '        </p:spPr>',
      '      </p:pic>',
      '    </p:spTree>',
      '  </p:cSld>',
      '</p:sld>',
    ].join('\n');

    zip.file(`ppt/slides/slide${slideNum}.xml`, slideXml);
  });

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { pdfToPpt };
