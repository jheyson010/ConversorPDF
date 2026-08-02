import React from 'react';

function NavItem({ active, icon, label, onClick, href }) {
  const content = <><i className={icon}></i><span>{label}</span></>;
  if (href) return <a className="sb-item" href={href}>{content}</a>;
  return <button className={`sb-item ${active ? 'active' : ''}`} type="button" onClick={onClick}>{content}</button>;
}

export function Sidebar({ user, module, setModule, setConvertAction, openUploadConversion }) {
  const name = user?.name || user?.email || 'Cuenta';
  const avatar = user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : name.slice(0, 2).toUpperCase();

  function go(target, options = {}) {
    setModule(target);
    if (options.convert) setConvertAction(options.convert);
    if (options.upload) openUploadConversion(options.upload);
  }

  return (
    <aside className="dashboard-sidebar react-sidebar">
      <a href="/dashboard.html" className="sb-logo">Doc<span>Flow</span></a>
      <div className="sb-user">
        <div className="avatar">{avatar}</div>
        <div className="sb-user-info"><p>{name}</p><span>Plan Gratis</span></div>
      </div>
      <div className="sb-scroll">
        <div className="sb-section">
          <div className="sb-label">Principal</div>
          <NavItem active={module === 'inicio'} icon="fas fa-table-columns" label="Inicio" onClick={() => go('inicio')} />
          <NavItem icon="fas fa-folder-open" label="Mis archivos" href="/dashboard.html" />
          <NavItem active={module === 'ver'} icon="fas fa-clock" label="Recientes" onClick={() => go('ver')} />
        </div>
        <div className="sb-section">
          <div className="sb-label">Inteligencia IA</div>
          <NavItem active={module === 'ia'} icon="fas fa-wand-magic-sparkles" label="Asistente IA" onClick={() => go('ia')} />
        </div>
        <div className="sb-section">
          <div className="sb-label">Editar</div>
          <NavItem active={module === 'editar'} icon="fas fa-file-pen" label="Editar PDF" onClick={() => go('editar')} />
          <NavItem active={module === 'comentario'} icon="fas fa-comment-dots" label="Comentario" onClick={() => go('comentario')} />
        </div>
        <div className="sb-section">
          <div className="sb-label">Herramientas PDF</div>
          <NavItem active={module === 'merge'} icon="fas fa-code-merge" label="Unir PDFs" onClick={() => go('merge')} />
          <NavItem active={module === 'split'} icon="fas fa-scissors" label="Dividir PDF" onClick={() => go('split')} />
          <NavItem active={module === 'compress'} icon="fas fa-compress-arrows-alt" label="Comprimir" onClick={() => go('compress')} />
          <NavItem active={module === 'proteger'} icon="fas fa-lock" label="Proteger" onClick={() => go('proteger')} />
          <NavItem active={module === 'sign'} icon="fas fa-signature" label="Firmar" onClick={() => go('sign')} />
          <NavItem active={module === 'rotate'} icon="fas fa-rotate" label="Rotar paginas" onClick={() => go('rotate')} />
          <NavItem active={module === 'herramientas'} icon="fas fa-droplet" label="Marca de agua" onClick={() => go('herramientas')} />
        </div>
        <div className="sb-section">
          <div className="sb-label">Conversion</div>
          <NavItem active={module === 'convertir'} icon="fas fa-arrows-rotate" label="Convertir" onClick={() => go('convertir', { convert: 'pdfToWord' })} />
          <NavItem icon="fas fa-file-word" label="PDF -> Word" onClick={() => go('convertir', { convert: 'pdfToWord' })} />
          <NavItem icon="fas fa-file-powerpoint" label="PDF -> PPT" onClick={() => go('convertir', { convert: 'pdfToPpt' })} />
          <NavItem icon="fas fa-wand-magic-sparkles" label="OCR IA" onClick={() => go('convertir', { convert: 'pdfToWord' })} />
          <NavItem icon="fas fa-file-pdf" label="Word -> PDF" onClick={() => go('convertir', { upload: 'wordToPdf' })} />
          <NavItem icon="fas fa-image" label="PDF -> Imagen" onClick={() => go('convertir', { convert: 'pdfToImage' })} />
          <NavItem icon="fas fa-table" label="Excel -> PDF" onClick={() => go('convertir', { upload: 'excelToPdf' })} />
          <NavItem icon="fas fa-file-powerpoint" label="PPT -> PDF" onClick={() => go('convertir', { upload: 'pptToPdf' })} />
        </div>
      </div>
      <div className="sb-bottom">
        <NavItem icon="fas fa-credit-card" label="Planes" href="/#planes" />
        <NavItem icon="fas fa-right-from-bracket" label="Cerrar sesión" onClick={async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch(_e){} window.location.href = '/'; }} />
      </div>
    </aside>
  );
}
