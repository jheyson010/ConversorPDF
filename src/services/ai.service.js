const fs = require('fs');
const path = require('path');
const { getDocumentForUser } = require('./storage.service');
const { extractPdfPages, renderPdfPagesAsImages } = require('./conversion/renderer');
const { recognizeImageBuffer } = require('./ocr.service');

async function getDocumentFullText(documentId, userId) {
  const document = await getDocumentForUser(documentId, userId);
  if (!document) {
    const error = new Error('Documento no encontrado.');
    error.status = 404;
    throw error;
  }

  let pages = [];
  try {
    pages = await extractPdfPages(document);
  } catch (_e) {
    // If not a standard PDF or extraction failed, fallback
  }

  const allLines = [];
  const pageTexts = [];

  for (const p of pages) {
    const textLines = (p.lines || []).map((l) => l.text).filter(Boolean);
    const pText = textLines.join('\n');
    if (pText.trim()) {
      pageTexts.push({ pageNumber: p.pageNumber, text: pText });
      allLines.push(...textLines);
    }
  }

  // If no text was extracted (scanned PDF), use OCR
  if (allLines.length === 0) {
    try {
      const rendered = await renderPdfPagesAsImages(document, { scale: 1.2 });
      for (let i = 0; i < Math.min(rendered.length, 10); i++) {
        const ocrRes = await recognizeImageBuffer(rendered[i].buffer);
        if (ocrRes && ocrRes.text) {
          pageTexts.push({ pageNumber: i + 1, text: ocrRes.text });
          allLines.push(ocrRes.text);
        }
      }
    } catch (_ocrErr) {
      // Ignore OCR failure
    }
  }

  const fullText = allLines.join('\n');
  return {
    document,
    fullText: fullText.trim(),
    pageTexts,
    lineCount: allLines.length,
  };
}

async function callGeminiApi(prompt, systemInstruction = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          ...(systemInstruction ? [{ role: 'user', parts: [{ text: `Instrucción del sistema: ${systemInstruction}` }] }] : []),
          { role: 'user', parts: [{ text: prompt }] },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1500,
        },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (_err) {
    return null;
  }
}

// Built-in smart NLP summarizer for when Gemini API key is not configured
function buildHeuristicSummary(fullText, fileName) {
  if (!fullText) {
    return {
      summary: `El documento "${fileName}" no contiene texto legible o es una imagen sin contenido OCR procesable.`,
      keyPoints: ['No se detectó texto extraíble.'],
      topics: ['Documento vacío o escaneado'],
      stats: { words: 0, characters: 0, estimatedReadTime: '0 min' },
    };
  }

  const cleanText = fullText.replace(/\s+/g, ' ');
  const words = cleanText.split(' ').filter(Boolean);
  const wordCount = words.length;
  const charCount = fullText.length;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  // Extract paragraphs / lines
  const paragraphs = fullText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  // Extract key sentences (sentences containing figures, capitalized terms, or first lines of paragraphs)
  const keyPoints = [];
  const sentences = fullText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 180);

  for (const sentence of sentences) {
    if (keyPoints.length >= 5) break;
    // Prefer sentences with numbers, key words, or proper nouns
    if (/\d+/.test(sentence) || /[A-ZÁÉÍÓÚ][a-záéíóú]*/.test(sentence) || keyPoints.length < 3) {
      if (!keyPoints.includes(sentence)) {
        keyPoints.push(sentence);
      }
    }
  }

  if (keyPoints.length < 3 && paragraphs.length > 0) {
    for (const p of paragraphs) {
      if (keyPoints.length >= 5) break;
      const firstSentence = p.split('.')[0] + '.';
      if (firstSentence.length > 15 && !keyPoints.includes(firstSentence)) {
        keyPoints.push(firstSentence);
      }
    }
  }

  // Determine top topics based on word frequency (excluding stop words)
  const stopWords = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'que', 'en', 'de', 'del', 'a',
    'con', 'por', 'para', 'como', 'su', 'sus', 'es', 'son', 'se', 'no', 'mas', 'mas', 'por', 'sobre',
    'the', 'of', 'and', 'to', 'in', 'is', 'for', 'that', 'with', 'as', 'it', 'on', 'be', 'at', 'by',
  ]);

  const freq = {};
  for (const word of words) {
    const norm = word.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '');
    if (norm.length > 3 && !stopWords.has(norm)) {
      freq[norm] = (freq[norm] || 0) + 1;
    }
  }

  const topics = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term]) => term.charAt(0).toUpperCase() + term.slice(1));

  // Build summary text
  const intro = paragraphs[0] ? paragraphs[0].slice(0, 300) : cleanText.slice(0, 300);
  const body = keyPoints.join('\n• ');

  const summary = `**Resumen Ejecutivo de "${fileName}"**\n\n${intro}...\n\n**Puntos Destacados:**\n• ${body}`;

  return {
    summary,
    keyPoints: keyPoints.length ? keyPoints : ['Documento procesado correctamente.'],
    topics: topics.length ? topics : ['General'],
    stats: {
      words: wordCount,
      characters: charCount,
      estimatedReadTime: `${readTimeMin} min`,
    },
  };
}

async function summarizeDocument(documentId, userId) {
  const { document, fullText, pageTexts } = await getDocumentFullText(documentId, userId);

  // Try Gemini API first if configured
  const prompt = `Analiza este documento ("${document.original_name}") y proporciona:
1. Un resumen ejecutivo conciso en 2-3 párrafos.
2. 5 puntos clave (bullet points).
3. 3-5 temas principales discutidos.

Texto del documento:
${fullText.slice(0, 6000)}`;

  const aiResult = await callGeminiApi(prompt, 'Eres un asistente experto en análisis y síntesis de documentos.');
  if (aiResult) {
    const cleanText = fullText.replace(/\s+/g, ' ');
    const wordCount = cleanText.split(' ').filter(Boolean).length;
    return {
      summary: aiResult,
      keyPoints: [],
      topics: [],
      stats: {
        words: wordCount,
        characters: fullText.length,
        estimatedReadTime: `${Math.max(1, Math.ceil(wordCount / 200))} min`,
      },
    };
  }

  return buildHeuristicSummary(fullText, document.original_name);
}

async function chatWithDocument(documentId, question, chatHistory = [], userId) {
  if (!question || !question.trim()) {
    const error = new Error('Escribe una pregunta para consultar al documento.');
    error.status = 400;
    throw error;
  }

  const { document, fullText, pageTexts } = await getDocumentFullText(documentId, userId);

  // Try Gemini API first
  const prompt = `Documento: "${document.original_name}"

Contenido relevante del documento:
${fullText.slice(0, 7000)}

Pregunta del usuario: ${question}

Responde de manera precisa, profesional y directa basándote únicamente en la información presente en el documento. Si el dato no se encuentra en el documento, indícalo educadamente.`;

  const aiAnswer = await callGeminiApi(prompt, 'Eres un asistente inteligente especializado en responder preguntas sobre documentos.');
  if (aiAnswer) {
    return { answer: aiAnswer, source: 'ai' };
  }

  // Fallback smart matching engine
  const qLower = question.toLowerCase();
  const keywords = qLower
    .replace(/[^a-záéíóúñ0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  let bestMatchPage = 1;
  let bestScore = -1;
  let bestSnippet = '';

  for (const pt of pageTexts) {
    const pLower = pt.text.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (pLower.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatchPage = pt.pageNumber;
      bestSnippet = pt.text;
    }
  }

  if (bestScore > 0 && bestSnippet) {
    const matchingLines = bestSnippet
      .split('\n')
      .filter((line) => keywords.some((kw) => line.toLowerCase().includes(kw)))
      .slice(0, 4);

    return {
      answer: `Basado en el documento **${document.original_name}** (Página ${bestMatchPage}):\n\n${matchingLines.join('\n\n')}`,
      source: 'heuristic',
      page: bestMatchPage,
    };
  }

  return {
    answer: `No encontré una referencia exacta para "${question}" en el texto extraído de **${document.original_name}**. Puedes intentar reformular tu pregunta o verificar si el documento contiene esa información.`,
    source: 'heuristic',
  };
}

async function translateDocumentText(documentId, targetLanguage = 'es', userId) {
  const { document, fullText } = await getDocumentFullText(documentId, userId);
  if (!fullText) {
    const error = new Error('No hay texto extraíble en el documento para traducir.');
    error.status = 400;
    throw error;
  }

  const prompt = `Traduce el siguiente texto al idioma ${targetLanguage}. Mantén la estructura y formato profesional:

${fullText.slice(0, 4000)}`;

  const translated = await callGeminiApi(prompt, 'Eres un traductor profesional de documentos.');
  if (translated) {
    return { translatedText: translated, language: targetLanguage };
  }

  return {
    translatedText: `[Vista previa del texto del documento]\n\n${fullText.slice(0, 2000)}\n\n(Para traducción automática con Gemini, configura la clave GEMINI_API_KEY en tu archivo .env)`,
    language: targetLanguage,
  };
}

module.exports = {
  summarizeDocument,
  chatWithDocument,
  translateDocumentText,
  getDocumentFullText,
};
