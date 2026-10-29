"use client";

import { useEffect, useId, useRef, type ReactNode } from 'react';

/** Dialog nativo: foco contenido, fondo inerte y regreso al botón que lo abrió. */
export default function VentanaCobro({ area, total, resumen, ocupada, bloqueada = false, error, onVolver, onConfirmar, children }: {
  area: 'Farmacia' | 'Consultorio'; total: number; resumen: string; ocupada: boolean; bloqueada?: boolean;
  error?: string | null; onVolver: () => void; onConfirmar: () => void; children: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const titulo = useId();
  const descripcion = useId();
  useEffect(() => {
    const elemento = dialogo.current;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    elemento?.showModal();
    return () => { elemento?.close(); if (anterior?.isConnected) anterior.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialogo} className="fedra-checkout" aria-labelledby={titulo} aria-describedby={descripcion} aria-busy={ocupada}
    onKeyDown={e => {
      if (e.key !== 'Tab') return;
      const controles = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]'))
        .filter(el => !el.matches(':disabled') && el.getClientRects().length > 0);
      const primero = controles[0], ultimo = controles.at(-1);
      if (!primero) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo?.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    }}
    onCancel={e => { e.preventDefault(); if (!ocupada) onVolver(); }}>
    <header className="fedra-checkout-head">
      <div><p className="fedra-checkout-eyebrow">{area} · Cobro</p><h2 id={titulo}>Revisar y cobrar</h2><p id={descripcion}>{resumen}</p></div>
      <button type="button" className="fedra-action-secondary" disabled={ocupada} onClick={onVolver} autoFocus aria-label="Volver sin cobrar">Volver</button>
    </header>
    <div className="fedra-checkout-body">
      <div className="fedra-checkout-total"><span>Total a cobrar</span><strong>{total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</strong></div>
      <fieldset disabled={ocupada || bloqueada} className="min-w-0 space-y-5 border-0 p-0">{children}</fieldset>
      {error && <p role="alert" className="fedra-checkout-error">{error}</p>}
      {bloqueada && <a href={area === 'Farmacia' ? '/caja' : '/cobros'} className="inline-block py-3 font-semibold underline">Revisar los movimientos registrados</a>}
    </div>
    <footer className="fedra-checkout-footer">
      <p role="status">{ocupada ? 'Registrando el pago. Espera la confirmación.' : bloqueada ? 'Resultado pendiente de revisión. No vuelvas a registrar este cobro.' : 'El ticket se abre al registrar el cobro.'}</p>
      <button type="button" className="fedra-action-primary" disabled={ocupada || bloqueada} onClick={onConfirmar}>
        {ocupada ? 'Registrando…' : `Confirmar cobro · ${total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`}
      </button>
    </footer>
  </dialog>;
}
