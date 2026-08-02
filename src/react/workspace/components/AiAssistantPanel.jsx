import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export function AiAssistantPanel({ user, currentDoc, docs, showToast }) {
  const [subTab, setSubTab] = useState('summary'); // 'summary' | 'chat' | 'translate'
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [targetLang, setTargetLang] = useState('es');
  const [translationText, setTranslationText] = useState('');
  const [submittingPro, setSubmittingPro] = useState(false);

  const isPro = user?.plan === 'pro';

  async function handleCheckoutPro() {
    setSubmittingPro(true);
    try {
      const checkout = await api.createSubscriptionCheckout();
      window.location.href = checkout.checkoutUrl;
    } catch (err) {
      showToast(err.message || 'Error al iniciar la suscripción.');
    } finally {
      setSubmittingPro(false);
    }
  }

  useEffect(() => {
    setSummaryData(null);
    setChatMessages([]);
    setTranslationText('');
  }, [currentDoc?.id]);

  if (!isPro) {
    return (
      <div className="ai-empty-state ai-pro-gate">
        <div className="ai-badge-hero"><i className="fas fa-crown"></i> Función Exclusiva DocFlow Pro</div>
        <h2>Desbloquea el Asistente de IA para tus Documentos</h2>
        <p>Genera resúmenes ejecutivos en segundos, chatea directamente con tus PDFs y traduce archivos a cualquier idioma con la máxima potencia de IA.</p>
        <div className="ai-pro-features">
          <div className="ap-feat"><i className="fas fa-check-circle"></i> Resúmenes automáticos y puntos clave</div>
          <div className="ap-feat"><i className="fas fa-check-circle"></i> Preguntas y respuestas ilimitadas sobre el PDF</div>
          <div className="ap-feat"><i className="fas fa-check-circle"></i> Traducción inteligente a 6 idiomas</div>
          <div className="ap-feat"><i className="fas fa-check-circle"></i> Sin anuncios y con prioridad de velocidad</div>
        </div>
        <button className="btn-primary btn-large btn-sparkle" type="button" disabled={submittingPro} onClick={handleCheckoutPro}>
          <i className={`fas ${submittingPro ? 'fa-spinner fa-spin' : 'fa-credit-card'}`}></i>
          {' '}Suscribirme Pro por S/ 6 mensual
        </button>
      </div>
    );
  }

  async function handleSummarize() {
    if (!currentDoc) return showToast('Por favor sube o selecciona un documento.');
    setLoading(true);
    try {
      const data = await api.aiSummarize(currentDoc.id);
      setSummaryData(data);
    } catch (err) {
      showToast(err.message || 'Error al generar resumen.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendQuestion(questionText) {
    const q = (questionText || inputQuestion).trim();
    if (!q) return;
    if (!currentDoc) return showToast('Por favor sube un documento primero.');

    const newMsg = { sender: 'user', text: q, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setChatMessages((prev) => [...prev, newMsg]);
    setInputQuestion('');
    setLoading(true);

    try {
      const res = await api.aiChat(currentDoc.id, q, chatMessages);
      const aiMsg = {
        sender: 'ai',
        text: res.answer,
        source: res.source,
        page: res.page,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      showToast(err.message || 'Error al procesar la consulta.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTranslate() {
    if (!currentDoc) return showToast('Por favor sube un documento primero.');
    setLoading(true);
    try {
      const res = await api.aiTranslate(currentDoc.id, targetLang);
      setTranslationText(res.translatedText);
    } catch (err) {
      showToast(err.message || 'Error al traducir el documento.');
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('Copiado al portapapeles.');
  }

  if (!currentDoc) {
    return (
      <div className="ai-empty-state">
        <div className="ai-badge-hero"><i className="fas fa-wand-magic-sparkles"></i> Inteligencia Artificial DocFlow</div>
        <h2>Asistente de IA para Documentos</h2>
        <p>Sube o selecciona un documento PDF para obtener resúmenes automáticos, realizar preguntas en tiempo real o traducir el contenido.</p>
      </div>
    );
  }

  return (
    <div className="ai-assistant-container">
      <header className="ai-header">
        <div className="ai-title-wrap">
          <span className="ai-pill"><i className="fas fa-sparkles"></i> Powered by DocFlow AI</span>
          <h2>Asistente Inteligente</h2>
          <p className="ai-doc-name"><i className="fas fa-file-pdf"></i> {currentDoc.name}</p>
        </div>

        <nav className="ai-subtabs">
          <button className={`ai-subtab ${subTab === 'summary' ? 'active' : ''}`} onClick={() => setSubTab('summary')}>
            <i className="fas fa-file-lines"></i> Resumen
          </button>
          <button className={`ai-subtab ${subTab === 'chat' ? 'active' : ''}`} onClick={() => setSubTab('chat')}>
            <i className="fas fa-comments"></i> Preguntas al PDF
          </button>
          <button className={`ai-subtab ${subTab === 'translate' ? 'active' : ''}`} onClick={() => setSubTab('translate')}>
            <i className="fas fa-language"></i> Traducción
          </button>
        </nav>
      </header>

      <main className="ai-body">
        {subTab === 'summary' && (
          <div className="ai-summary-view">
            {!summaryData && !loading && (
              <div className="ai-prompt-card">
                <i className="fas fa-brain ai-big-icon"></i>
                <h3>Resumen Automático y Análisis de Contenido</h3>
                <p>Extrae las ideas principales, puntos clave, palabras clave y estadísticas de tu documento en un solo clic.</p>
                <button className="btn-primary btn-sparkle" onClick={handleSummarize}>
                  <i className="fas fa-wand-magic-sparkles"></i> Generar Resumen con IA
                </button>
              </div>
            )}

            {loading && (
              <div className="ai-loading">
                <i className="fas fa-circle-notch fa-spin"></i>
                <p>Analizando documento y generando resumen inteligente...</p>
              </div>
            )}

            {summaryData && !loading && (
              <div className="ai-results-card">
                <div className="ai-stats-row">
                  {summaryData.stats && (
                    <>
                      <div className="ai-stat-chip"><i className="fas fa-font"></i> {summaryData.stats.words} Palabras</div>
                      <div className="ai-stat-chip"><i className="fas fa-clock"></i> Lectura: {summaryData.stats.estimatedReadTime}</div>
                    </>
                  )}
                  {summaryData.topics && summaryData.topics.length > 0 && (
                    <div className="ai-topics">
                      {summaryData.topics.map((t, idx) => (
                        <span key={idx} className="ai-topic-tag">#{t}</span>
                      ))}
                    </div>
                  )}
                  <button className="btn-ghost btn-sm" onClick={() => copyToClipboard(summaryData.summary)}>
                    <i className="fas fa-copy"></i> Copiar
                  </button>
                </div>

                <div className="ai-markdown-box">
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{summaryData.summary}</p>
                </div>

                {summaryData.keyPoints && summaryData.keyPoints.length > 0 && (
                  <div className="ai-keypoints-box">
                    <h4><i className="fas fa-list-check"></i> Puntos Clave</h4>
                    <ul>
                      {summaryData.keyPoints.map((kp, index) => (
                        <li key={index}>{kp}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {subTab === 'chat' && (
          <div className="ai-chat-view">
            <div className="ai-chat-history">
              {chatMessages.length === 0 ? (
                <div className="ai-chat-placeholder">
                  <i className="fas fa-messages-question"></i>
                  <h4>Haz cualquier pregunta sobre este documento</h4>
                  <p>Selecciona una sugerencia o escribe tu consulta:</p>
                  <div className="ai-quick-questions">
                    <button onClick={() => handleSendQuestion('¿De qué trata este documento?')}>
                      ¿De qué trata este documento?
                    </button>
                    <button onClick={() => handleSendQuestion('¿Cuáles son las conclusiones o puntos principales?')}>
                      ¿Cuáles son las conclusiones principales?
                    </button>
                    <button onClick={() => handleSendQuestion('¿Hay fechas, nombres o cifras clave?')}>
                      ¿Hay fechas o cifras clave?
                    </button>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className={`ai-chat-bubble ${msg.sender}`}>
                    <div className="ai-chat-avatar">
                      {msg.sender === 'user' ? <i className="fas fa-user"></i> : <i className="fas fa-robot"></i>}
                    </div>
                    <div className="ai-chat-content">
                      <div className="ai-chat-meta">
                        <span>{msg.sender === 'user' ? 'Tú' : 'DocFlow AI'}</span>
                        <small>{msg.timestamp}</small>
                      </div>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                      {msg.sender === 'ai' && (
                        <button className="ai-copy-btn" onClick={() => copyToClipboard(msg.text)}>
                          <i className="fas fa-copy"></i>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {loading && (
                <div className="ai-chat-bubble ai loading">
                  <i className="fas fa-ellipsis fa-beat"></i> Pensando respuesta...
                </div>
              )}
            </div>

            <form className="ai-chat-input-bar" onSubmit={(e) => { e.preventDefault(); handleSendQuestion(); }}>
              <input
                type="text"
                placeholder="Haz una pregunta sobre el PDF..."
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                disabled={loading}
              />
              <button type="submit" className="btn-primary" disabled={loading || !inputQuestion.trim()}>
                <i className="fas fa-paper-plane"></i>
              </button>
            </form>
          </div>
        )}

        {subTab === 'translate' && (
          <div className="ai-translate-view">
            <div className="ai-translate-controls">
              <label>
                Idioma de destino:
                <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                  <option value="es">Español</option>
                  <option value="en">Inglés (English)</option>
                  <option value="fr">Francés (Français)</option>
                  <option value="de">Alemán (Deutsch)</option>
                  <option value="it">Italiano</option>
                  <option value="pt">Portugués (Português)</option>
                </select>
              </label>

              <button className="btn-primary" onClick={handleTranslate} disabled={loading}>
                <i className="fas fa-language"></i> {loading ? 'Traduciendo...' : 'Traducir Documento'}
              </button>
            </div>

            {translationText && (
              <div className="ai-translation-result">
                <div className="ai-result-header">
                  <h4>Texto Traducido ({targetLang.toUpperCase()})</h4>
                  <button className="btn-ghost btn-sm" onClick={() => copyToClipboard(translationText)}>
                    <i className="fas fa-copy"></i> Copiar Texto
                  </button>
                </div>
                <div className="ai-markdown-box">
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{translationText}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
