import React, { useEffect } from 'react';

export default function Modal({
  open, title, subtitle, children, onClose, footer
}:{
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: ()=>void;
}){
  useEffect(()=>{
    function onKey(e: KeyboardEvent){
      if (e.key==='Escape') onClose();
    }
    if (open) window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modalBackdrop" onClick={onClose} />
      <div className="modalCard">
        <div className="modalHeader">
          <div style={{flex:1}}>
            <div className="modalTitle">{title}</div>
            {subtitle && <div className="modalSub">{subtitle}</div>}
          </div>
          <button className="smallBtn" onClick={onClose}>Close</button>
        </div>
        <div className="modalBody">{children}</div>
        {footer && <div className="modalFooter">{footer}</div>}
      </div>
    </div>
  );
}
