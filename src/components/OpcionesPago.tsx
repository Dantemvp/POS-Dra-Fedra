"use client";

import { METODOS_PAGO, prepararPago, type PagoVentana } from '@/lib/pago-ventana';

export default function OpcionesPago({ total, datos, onChange, recibido, onRecibido }: {
  total: number; datos: PagoVentana; onChange: (cambio: Partial<PagoVentana>) => void;
  recibido?: string; onRecibido?: (valor: string) => void;
}) {
  const pago = prepararPago(total, datos);
  const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  const cambio = (Math.round(Number(recibido ?? '') * 100) - Math.round((pago.efectivo ?? 0) * 100)) / 100;
  return <>
    <fieldset className="min-w-0"><legend className="mb-3 font-semibold">{datos.dividir ? 'Primer método de pago' : '¿Cómo paga?'}</legend>
      <div className="fedra-payment-methods">{METODOS_PAGO.map(m => <button key={m.valor} type="button" aria-pressed={datos.metodo === m.valor}
        className="fedra-payment-method" onClick={() => onChange({ metodo: m.valor, ...(m.valor === datos.metodo2 ? { metodo2: datos.metodo } : {}) })}>{m.nombre}<span aria-hidden="true">{datos.metodo === m.valor ? '✓' : ''}</span></button>)}</div>
    </fieldset>
    <label className="fedra-checkout-split"><input type="checkbox" checked={datos.dividir} onChange={e => onChange({ dividir: e.target.checked })} />Combinar dos métodos de pago</label>
    {datos.dividir && <div className="fedra-checkout-split-fields">
      <label>Monto del primer pago<input inputMode="decimal" type="number" min="0.01" step="0.01" value={datos.monto1} onChange={e => onChange({ monto1: e.target.value })} placeholder="0.00" /></label>
      <label>Resto del pago en<select value={datos.metodo2} onChange={e => onChange({ metodo2: e.target.value as PagoVentana['metodo2'] })}>
        {METODOS_PAGO.map(m => <option key={m.valor} value={m.valor} disabled={m.valor === datos.metodo}>{m.nombre}</option>)}
      </select></label>
      <p className="font-semibold sm:col-span-2">Resto: {dinero(Math.max(0, total - (Number(datos.monto1) || 0)))}</p>
    </div>}
    {onRecibido && (pago.efectivo ?? 0) > 0 && <div className="fedra-checkout-cash">
      <label>Efectivo recibido<input inputMode="decimal" type="number" min="0" step="0.01" value={recibido} onChange={e => onRecibido(e.target.value)} placeholder="Importe exacto si lo dejas vacío" /></label>
      <p className="text-sm text-zinc-600">Efectivo de esta venta: {dinero(pago.efectivo ?? 0)}. Si paga exacto, puedes dejar el campo vacío.</p>
      {recibido?.trim() && Number.isFinite(cambio) && <p className="flex justify-between gap-3 font-semibold" role="status"><span>{cambio < 0 ? 'Falta efectivo' : 'Cambio a devolver'}</span><span className="tabular-nums">{dinero(Math.abs(cambio))}</span></p>}
    </div>}
  </>;
}
