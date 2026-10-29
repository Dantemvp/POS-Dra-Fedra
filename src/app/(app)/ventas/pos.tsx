"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import { cobrar, cargarReceta } from "./actions";
import BarcodeInput from "@/components/BarcodeInput";
import AutoPrint from "@/components/AutoPrint";
import VentanaCobro from '@/components/VentanaCobro';
import OpcionesPago from '@/components/OpcionesPago';
import { prepararPago, revisarRecibido, type MetodoPago, type PagoVentana } from '@/lib/pago-ventana';
import { indexarCatalogo, buscarCatalogo } from '@/lib/catalogo-busqueda';
import {
  FISCAL_FARMACIA,
  GOOGLE_REVIEW_URL,
  leyendaFacturacion,
} from "@/lib/fiscal";

type Producto = {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
  requiere_receta: boolean;
  codigo_barras: string | null;
};

type Linea = { producto_id: string; nombre: string; precio: number; cantidad: number; stock: number };

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type Ticket = {
  folio?: number;
  lineas: Linea[];
  total: number;
  metodo: string;
  pagos?: { metodo: string; monto: number }[];
  recibido?: number;
  cambio?: number;
  fecha: string;
};

export default function POS({
  productos,
  vendedor,
}: {
  productos: Producto[];
  vendedor: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  // Pago dividido: monto1 va al método principal y el resto al segundo método.
  const [dividir, setDividir] = useState(false);
  const [metodo2, setMetodo2] = useState<MetodoPago>("tarjeta");
  const [monto1, setMonto1] = useState("");
  // Efectivo recibido del cliente, para calcular el cambio a devolver.
  const [recibido, setRecibido] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [pending, startTransition] = useTransition();
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const [resultadoIncierto, setResultadoIncierto] = useState(false);
  const enviando = useRef(false);
  const indice = useMemo(() => indexarCatalogo(productos), [productos]);

  function onScan(code: string) {
    if (pagoAbierto || pending || resultadoIncierto) return;
    const c = code.trim();
    // Código de receta "REC<folio>": carga los medicamentos recetados.
    const rec = c.match(/^REC(\d+)$/i);
    if (rec) {
      cargarRecetaAlCarrito(Number(rec[1]));
      return;
    }
    const p = indice.codigos.get(c);
    if (!p) {
      setError(`Código ${c} no está ligado a ningún producto.`);
      return;
    }
    agregar(p);
  }

  // Escaneo de receta: trae los productos recetados y los agrega al carrito.
  function cargarRecetaAlCarrito(folio: number) {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const res = await cargarReceta(folio);
      if (!res.ok) {
        setError(res.error ?? "No se pudo leer la receta.");
        return;
      }
      let agregados = 0;
      const sinStock: string[] = [];
      for (const id of res.productoIds ?? []) {
        const p = indice.ids.get(id);
        if (!p) continue; // producto inactivo o ya no existe
        if (p.stock <= 0) {
          sinStock.push(p.nombre);
          continue;
        }
        agregar(p);
        agregados++;
      }
      const notas: string[] = [];
      if (sinStock.length) notas.push(`sin stock: ${sinStock.join(", ")}`);
      if ((res.sinLigar ?? []).length)
        notas.push(`no están en inventario: ${res.sinLigar!.join(", ")}`);
      const sufijo = notas.length ? ` (revisar: ${notas.join("; ")})` : "";
      if (agregados > 0) {
        setAviso(`Receta REC${folio}: ${agregados} producto(s) agregados${sufijo}.`);
      } else {
        setError(
          `Receta REC${folio} sin productos para cargar${sufijo || "."}`,
        );
      }
    });
  }

  const filtrados = useMemo(() => buscarCatalogo(indice, busqueda), [busqueda, indice]);

  const total = carrito.reduce((s, l) => s + Math.round(l.precio * l.cantidad * 100), 0) / 100;
  const datosPago = { metodo, dividir, metodo2, monto1 };
  function cambiarPago(cambio: Partial<PagoVentana>) {
    if (cambio.metodo) setMetodo(cambio.metodo);
    if (cambio.metodo2) setMetodo2(cambio.metodo2);
    if (cambio.dividir !== undefined) setDividir(cambio.dividir);
    if (cambio.monto1 !== undefined) setMonto1(cambio.monto1);
    setError(null);
  }

  function agregar(p: Producto) {
    if (pagoAbierto || pending || resultadoIncierto) return;
    setError(null);
    if (p.stock <= 0) {
      setError(`"${p.nombre}" no tiene stock.`);
      return;
    }
    const cantidadActual =
      carrito.find((l) => l.producto_id === p.id)?.cantidad ?? 0;
    if (cantidadActual >= p.stock) {
      setError(`Ya agregaste toda la existencia disponible de "${p.nombre}".`);
      return;
    }
    setCarrito((prev) => {
      const ex = prev.find((l) => l.producto_id === p.id);
      if (ex) {
        if (ex.cantidad >= p.stock) return prev;
        return prev.map((l) =>
          l.producto_id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l,
        );
      }
      return [
        ...prev,
        { producto_id: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1, stock: p.stock },
      ];
    });
    setBusqueda("");
  }

  function cambiarCantidad(id: string, delta: number) {
    setCarrito((prev) =>
      prev
        .map((l) => {
          if (l.producto_id !== id) return l;
          const nueva = Math.max(0, Math.min(l.stock, l.cantidad + delta));
          return { ...l, cantidad: nueva };
        })
        .filter((l) => l.cantidad > 0),
    );
  }

  function quitar(id: string) {
    setCarrito((prev) => prev.filter((l) => l.producto_id !== id));
  }

  function finalizar() {
    if (!pagoAbierto || pending || enviando.current || resultadoIncierto) return;
    setError(null);
    if (carrito.length === 0) return;
    const pago = prepararPago(total, datosPago);
    if (pago.error) { setError(pago.error); return; }
    const efectivo = revisarRecibido(recibido, pago.efectivo ?? 0);
    if (efectivo.error) { setError(efectivo.error); return; }

    const snapshot = carrito;
    const metodoSel = metodo;
    const pagosSel = pago.pagos ?? null;
    enviando.current = true;
    startTransition(async () => {
      try {
      const res = await cobrar(
        snapshot.map((l) => ({
          producto_id: l.producto_id,
          cantidad: l.cantidad,
          precio_unit: l.precio,
        })),
        metodoSel,
        null,
        pagosSel,
      );
      if (!res.ok) {
        enviando.current = false;
        setError(res.error ?? "No se pudo cobrar.");
        return;
      }
      setTicket({
        folio: res.folio,
        lineas: snapshot,
        pagos: pagosSel ?? undefined,
        recibido: efectivo.recibido,
        cambio: efectivo.cambio,
        total,
        metodo: pagosSel ? "mixto" : metodoSel,
        fecha: new Date().toLocaleString("es-MX"),
      });
      setCarrito([]);
      setDividir(false);
      setMonto1("");
      setRecibido("");
      setPagoAbierto(false);
      } catch {
        setResultadoIncierto(true);
        setError('No se pudo confirmar el cobro. Revisa Caja y reportes antes de volver a cobrar esta venta.');
      }
    });
  }

  if (ticket) {
    return (
      <div className="mx-auto max-w-sm">
        <AutoPrint />
        <style>{`@media print {
          @page { size: 80mm auto; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          main { padding: 0 !important; }
        }`}</style>
        <div className="doc-imprimible print-area ticket-print ticket-thermal-strong rounded-xl bg-white p-6 text-black ring-1 ring-zinc-200 print:shadow-none print:ring-0">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-farmacia.png"
              alt={FISCAL_FARMACIA.nombreComercial}
              className="ticket-logo mx-auto h-16 w-auto object-contain"
            />
          </div>
          <div className="my-3 border-t border-dashed border-zinc-300" />
          <p className="text-sm font-bold text-black">
            Folio #{ticket.folio} · {ticket.fecha}
          </p>
          {vendedor && (
            <p className="text-sm font-bold text-black">Atendió: {vendedor}</p>
          )}
          <table className="mt-3 w-full text-sm font-semibold">
            <tbody>
              {ticket.lineas.map((l) => (
                <tr key={l.producto_id}>
                  <td className="py-1 pr-2 align-top">
                    <span className="block">{l.cantidad} × {l.nombre}</span>
                    <span className="block text-xs font-semibold text-black">
                      {money(l.precio)} c/u
                    </span>
                  </td>
                  <td className="py-1 text-right align-top tabular-nums">
                    {money(l.precio * l.cantidad)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="my-3 border-t border-dashed border-zinc-300" />
          <div className="flex justify-between text-lg font-bold text-black">
            <span>Total</span>
            <span className="tabular-nums">{money(ticket.total)}</span>
          </div>
          {ticket.pagos && ticket.pagos.length > 0 ? (
            <div className="mt-1 space-y-0.5 text-sm font-bold text-black">
              {ticket.pagos.map((p, i) => (
                <div key={i} className="flex justify-between capitalize">
                  <span>{p.metodo}</span>
                  <span className="tabular-nums">{money(p.monto)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-right text-sm font-bold capitalize text-black">
              {ticket.metodo}
            </p>
          )}
          {ticket.cambio != null && (
            <div className="mt-1 space-y-0.5 text-sm font-bold text-black">
              <div className="flex justify-between">
                <span>Recibido</span>
                <span className="tabular-nums">{money(ticket.recibido ?? 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-black">
                <span>Cambio</span>
                <span className="tabular-nums">{money(ticket.cambio)}</span>
              </div>
            </div>
          )}

          <div className="my-3 border-t border-dashed border-zinc-300" />
          <div className="space-y-1 text-center text-[13px] font-bold leading-tight text-black">
            <p className="font-bold text-black">
              {FISCAL_FARMACIA.razonSocial}
            </p>
            <p>RFC: {FISCAL_FARMACIA.rfc}</p>
            <p>Régimen fiscal: {FISCAL_FARMACIA.regimen}</p>
            <p>
              {FISCAL_FARMACIA.domicilio}, C.P. {FISCAL_FARMACIA.cp},{" "}
              {FISCAL_FARMACIA.ciudad}
            </p>
          </div>
          <p className="mt-2 text-center text-xs font-bold leading-snug text-black">
            {leyendaFacturacion()}
          </p>
          <div className="mt-3 flex flex-col items-center border-t border-dashed border-zinc-300 pt-3 text-center">
            <QRCodeSVG
              value={GOOGLE_REVIEW_URL}
              size={96}
              level="M"
              marginSize={2}
              bgColor="#ffffff"
              fgColor="#000000"
              title="Código QR para dejar una reseña en Google"
            />
            <p className="mt-1.5 text-xs font-bold leading-tight text-black">
              ¿Te atendimos bien? Escanea y déjanos tu reseña en Google.
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Reimprimir ticket
          </button>
          <button
            onClick={() => { setTicket(null); enviando.current = false; }}
            className="flex-1 rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Nueva venta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fedra-workspace grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.28fr)]">
      {pagoAbierto && <VentanaCobro area="Farmacia" total={total} resumen={`${carrito.reduce((s, l) => s + l.cantidad, 0)} ${carrito.reduce((s, l) => s + l.cantidad, 0) === 1 ? 'artículo' : 'artículos'} en esta venta`}
        ocupada={pending} bloqueada={resultadoIncierto} error={error} onVolver={() => { if (!pending) setPagoAbierto(false); }} onConfirmar={finalizar}>
        <OpcionesPago total={total} datos={datosPago} onChange={cambiarPago} recibido={recibido} onRecibido={valor => { setRecibido(valor); setError(null); }} />
      </VentanaCobro>}
      {/* Productos */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 lg:sticky lg:top-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900">Agregar productos</h2>
          <p className="mt-1 text-xs text-zinc-500">Escanea o escribe el nombre. La lista solo aparece mientras buscas.</p>
        </div>
        <div className="mb-2">
          <BarcodeInput onScan={onScan} />
        </div>
        {aviso && (
          <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {aviso}
          </p>
        )}
        <input
          aria-label="Buscar producto por nombre"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="…o busca producto por nombre"
          className="mb-2 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-base text-zinc-900 outline-none transition focus:border-[#3f5148] focus:bg-white focus:ring-2 focus:ring-[#3f5148]/10"
        />
        <div className="space-y-1">
          {busqueda.trim() && filtrados.length === 0 && (
            <p className="rounded-xl bg-zinc-50 px-3 py-5 text-center text-sm text-zinc-400">No encontramos ese producto.</p>
          )}
          {filtrados.map((p) => (
            <button
              key={p.id}
              onClick={() => agregar(p)}
              disabled={p.stock <= 0 || (carrito.find((l) => l.producto_id === p.id)?.cantidad ?? 0) >= p.stock}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-3 text-left text-sm transition hover:border-[#cbb89c] hover:bg-[#f8f6f2] disabled:opacity-40"
            >
              <span className="font-medium text-zinc-900">{p.nombre}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-zinc-400">stock {p.stock}</span>
                <span className="tabular-nums text-zinc-700">{money(p.precio)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Carrito */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-600">Venta actual</p>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Carrito</h2>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-700">{carrito.reduce((s, l) => s + l.cantidad, 0)} {carrito.reduce((s, l) => s + l.cantidad, 0) === 1 ? "artículo" : "artículos"}</span>
        </div>
        {carrito.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">
            Busca o escanea un producto para comenzar.
          </p>
        ) : (
          <div className="space-y-2">
            {carrito.map((l) => (
              <div
                key={l.producto_id}
                className="fedra-cart-line text-sm"
              >
                <div className="min-w-0"><p className="break-words font-medium text-zinc-900">{l.nombre}</p><p className="mt-1 text-xs text-zinc-600">{money(l.precio)} por unidad</p></div>
                <button type="button" aria-label={`Quitar ${l.nombre}`} onClick={() => quitar(l.producto_id)} className="h-11 w-11 rounded-lg text-zinc-600 hover:text-red-700">✕</button>
                <div className="flex items-center gap-1">
                  <button aria-label={`Restar una unidad de ${l.nombre}`} onClick={() => cambiarCantidad(l.producto_id, -1)} className="h-11 w-11 rounded-xl bg-white text-lg text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100">−</button>
                  <span className="w-8 text-center text-base font-semibold tabular-nums">{l.cantidad}</span>
                  <button aria-label={`Sumar una unidad de ${l.nombre}`} disabled={l.cantidad >= l.stock} onClick={() => cambiarCantidad(l.producto_id, 1)} className="h-11 w-11 rounded-xl bg-white text-lg text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100 disabled:opacity-40">+</button>
                </div>
                <span className="w-20 text-right tabular-nums text-zinc-700">
                  {money(l.precio * l.cantidad)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-zinc-200 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-zinc-500">Total</span>
            <span className="text-xl font-semibold tabular-nums text-zinc-900">
              {money(total)}
            </span>
          </div>
          {error && !pagoAbierto && <p role="alert" className="fedra-checkout-error mb-3">{error}</p>}
          <button type="button" onClick={e => { e.currentTarget?.focus(); setError(null); setPagoAbierto(true); }}
            disabled={carrito.length === 0 || pending || resultadoIncierto}
            className="fedra-action-primary w-full text-base">
            {pending ? pagoAbierto ? 'Cobrando…' : 'Cargando receta…' : `Continuar al cobro · ${money(total)}`}
          </button>
          <p className="mt-3 text-center text-xs text-zinc-600">Revisa el pago en el siguiente paso. Todavía no se registra la venta.</p>
        </div>
      </div>
    </div>
  );
}
