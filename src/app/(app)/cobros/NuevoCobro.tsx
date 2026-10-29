"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BarcodeInput from "@/components/BarcodeInput";
import ComboBuscador from "@/components/ComboBuscador";
import { crearCobro, type ItemCobro } from "./actions";
import { totalCobro } from "@/lib/cobro-total";
import VentanaCobro from '@/components/VentanaCobro';
import OpcionesPago from '@/components/OpcionesPago';
import { prepararPago, type PagoVentana } from '@/lib/pago-ventana';
import { indexarCatalogo, buscarCatalogo } from '@/lib/catalogo-busqueda';
import {
  COBRO_BORRADOR_KEY,
  borrarCobroBorrador,
  leerCobroBorrador,
  tieneContenidoCobro,
  type MetodoCobro,
} from "@/lib/cobro-borrador";

export type Paciente = { id: string; nombre: string };
export type Servicio = { id: string; nombre: string; precio: number };
export type Producto = {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
  codigo_barras: string | null;
};

export default function NuevoCobro({
  pacientes,
  servicios,
  productos,
}: {
  pacientes: Paciente[];
  servicios: Servicio[];
  productos: Producto[];
}) {
  const router = useRouter();
  const [pacienteId, setPacienteId] = useState("");
  const [items, setItems] = useState<ItemCobro[]>([]);
  const [metodo, setMetodo] = useState<MetodoCobro>("transferencia");
  const [dividir, setDividir] = useState(false);
  const [metodo2, setMetodo2] = useState<MetodoCobro>("tarjeta");
  const [monto1, setMonto1] = useState("");
  const [nota, setNota] = useState("");
  const [busca, setBusca] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [borradorListo, setBorradorListo] = useState(false);
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const [resultadoIncierto, setResultadoIncierto] = useState(false);
  const enviando = useRef(false);
  const indice = useMemo(() => indexarCatalogo(productos), [productos]);

  useEffect(() => {
    const tarea = window.setTimeout(() => {
      let borrador = null;
      try {
        borrador = leerCobroBorrador(sessionStorage.getItem(COBRO_BORRADOR_KEY));
      } catch {
        // El navegador puede bloquear el almacenamiento. El cobro sigue usable.
      }
      if (borrador) {
        setPacienteId(borrador.paciente_id);
        setItems(borrador.items);
        setMetodo(borrador.metodo);
        setDividir(borrador.dividir ?? false);
        setMetodo2(borrador.metodo2 ?? "tarjeta");
        setMonto1(borrador.monto1 ?? "");
        setNota(borrador.nota);
      }
      setBorradorListo(true);
    }, 0);
    return () => window.clearTimeout(tarea);
  }, []);

  useEffect(() => {
    if (!borradorListo) return;
    const borrador = {
      version: 1 as const,
      paciente_id: pacienteId,
      items,
      metodo,
      dividir, metodo2, monto1,
      nota,
    };
    if (tieneContenidoCobro(borrador)) {
      try {
        sessionStorage.setItem(COBRO_BORRADOR_KEY, JSON.stringify(borrador));
      } catch {
        // No bloqueamos un cobro si el almacenamiento local no está disponible.
      }
    } else {
      try {
        sessionStorage.removeItem(COBRO_BORRADOR_KEY);
      } catch {
        // Sin almacenamiento, no hay borrador que limpiar.
      }
    }
  }, [borradorListo, pacienteId, items, metodo, nota, dividir, metodo2, monto1]);

  const total = useMemo(
    () => totalCobro(items),
    [items],
  );

  const opcionesPaciente = useMemo(
    () => pacientes.map((p) => ({ value: p.id, label: p.nombre })),
    [pacientes],
  );

  function setItem(i: number, patch: Partial<ItemCobro>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function quitar(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  // --- Productos por código de barras (BIP) o búsqueda ---
  function agregarProducto(p: Producto) {
    if (pagoAbierto || guardando || resultadoIncierto) return;
    setError("");
    if (p.stock <= 0 || (items.find(it => it.producto_id === p.id)?.cantidad ?? 0) >= p.stock) {
      setError(`No hay más existencia disponible de ${p.nombre}.`);
      return;
    }
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.producto_id === p.id);
      if (idx >= 0) {
        return prev.map((it, i) =>
          i === idx ? { ...it, cantidad: Math.min(p.stock, it.cantidad + 1) } : it,
        );
      }
      return [
        ...prev,
        {
          tipo: "producto",
          servicio_id: null,
          producto_id: p.id,
          descripcion: p.nombre,
          cantidad: 1,
          precio_unit: Number(p.precio),
        },
      ];
    });
    setAviso(`Agregado: ${p.nombre}`);
    setTimeout(() => setAviso(""), 1200);
  }

  function onScan(code: string) {
    if (pagoAbierto || guardando || resultadoIncierto) return;
    const p = indice.codigos.get(code.trim());
    if (!p) {
      setError(`Código ${code} no está ligado a ningún producto.`);
      return;
    }
    agregarProducto(p);
  }

  function agregarServicio() {
    setItems((prev) => [
      ...prev,
      { tipo: "servicio", servicio_id: null, producto_id: null, descripcion: "", cantidad: 1, precio_unit: 0 },
    ]);
  }

  function elegirServicio(i: number, sid: string) {
    const s = servicios.find((x) => x.id === sid);
    setItem(i, {
      servicio_id: sid || null,
      descripcion: s?.nombre ?? "",
      precio_unit: s ? Number(s.precio) : items[i].precio_unit,
    });
  }

  const sugerencias = useMemo(() => buscarCatalogo(indice, busca), [busca, indice]);

  function revisarConceptos() {
    if (!pacientes.some(p => p.id === pacienteId)) return 'Selecciona el paciente de este cobro.';
    if (!items.length) return 'Agrega al menos un concepto.';
    if (items.some(it => !it.descripcion.trim() || !Number.isFinite(it.cantidad) || it.cantidad <= 0 || !Number.isFinite(it.precio_unit) || it.precio_unit < 0)) return 'Completa el concepto, la cantidad y el precio de cada renglón.';
    if (items.some(it => it.tipo === 'producto' && (!productos.some(p => p.id === it.producto_id) || it.cantidad > (productos.find(p => p.id === it.producto_id)?.stock ?? 0)))) return 'Revisa la existencia de los productos antes de cobrar.';
    return '';
  }

  const datosPago = { metodo, dividir, metodo2, monto1 };
  function cambiarPago(cambio: Partial<PagoVentana>) {
    if (cambio.metodo) setMetodo(cambio.metodo);
    if (cambio.metodo2) setMetodo2(cambio.metodo2);
    if (cambio.dividir !== undefined) setDividir(cambio.dividir);
    if (cambio.monto1 !== undefined) setMonto1(cambio.monto1);
    setError('');
  }

  async function guardar() {
    if (!pagoAbierto || guardando || enviando.current || resultadoIncierto) return;
    setError("");
    const problema = revisarConceptos();
    if (problema) { setError(problema); return; }
    const pago = prepararPago(total, datosPago);
    if (pago.error) { setError(pago.error); return; }
    enviando.current = true;
    setGuardando(true);
    try {
    const r = await crearCobro({ paciente_id: pacienteId, items, metodo, nota,
      pagos: pago.pagos,
    });
    if (!r.ok) {
      enviando.current = false;
      setGuardando(false);
      setError(r.error ?? "Error al guardar.");
      return;
    }
    borrarCobroBorrador(() => window.sessionStorage);
    router.push(r.id ? `/cobros/${r.id}?imprimir=1` : "/cobros");
    router.refresh();
    } catch {
      setResultadoIncierto(true);
      setGuardando(false);
      setError('No se pudo confirmar el cobro. Revisa los cobros registrados antes de volver a cobrar al paciente.');
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  function descartarBorrador() {
    setPacienteId("");
    setItems([]);
    setMetodo("transferencia");
    setDividir(false);
    setMetodo2('tarjeta');
    setMonto1('');
    setNota("");
    setError("");
    setAviso("");
    borrarCobroBorrador(() => window.sessionStorage);
  }

  return (
    <div className="fedra-workspace space-y-5 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 sm:p-6">
      {pagoAbierto && <VentanaCobro area="Consultorio" total={total} resumen={pacientes.find(p => p.id === pacienteId)?.nombre ?? 'Paciente sin seleccionar'}
        ocupada={guardando} bloqueada={resultadoIncierto} error={error} onVolver={() => { if (!guardando) setPagoAbierto(false); }} onConfirmar={guardar}>
        <OpcionesPago total={total} datos={datosPago} onChange={cambiarPago} />
        <label>Nota del cobro (opcional)<textarea value={nota} rows={2} onChange={e => setNota(e.target.value)} placeholder="Referencia del pago o comentario interno" /></label>
      </VentanaCobro>}
      {borradorListo && (pacienteId || items.length > 0 || nota.trim()) && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>Cobro pendiente guardado mientras esta pestaña permanezca abierta.</span>
          <button
            type="button"
            disabled={guardando || resultadoIncierto}
            onClick={descartarBorrador}
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            Descartar
          </button>
        </div>
      )}
      <div>
        <p className="block text-sm font-semibold text-zinc-800">1. Elige al paciente</p>
        <div className="mt-1">
          <ComboBuscador
            etiqueta="Paciente del cobro"
            opciones={opcionesPaciente}
            value={pacienteId}
            onChange={setPacienteId}
            placeholder="Busca al paciente por nombre…"
          />
        </div>
      </div>

      {/* BIP — escanear producto del inventario */}
      <details className="rounded-xl border border-zinc-200 p-3">
        <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-zinc-800">Agregar productos del inventario</summary>
        <div className="pt-3">
        <label className="block text-xs text-zinc-500">
          Escanear producto (BIP) o buscar
        </label>
        <div className="mt-1">
          <BarcodeInput onScan={onScan} autoFocus={false} />
        </div>
        <input
          aria-label="Buscar un producto del inventario"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="…o busca un producto por nombre"
          className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
        />
        {sugerencias.length > 0 && (
          <div className="mt-1 space-y-0.5 rounded-lg border border-zinc-200 p-1">
            {sugerencias.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  agregarProducto(p);
                  setBusca("");
                }}
                disabled={p.stock <= 0 || (items.find(it => it.producto_id === p.id)?.cantidad ?? 0) >= p.stock}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-zinc-100 disabled:opacity-40"
              >
                <span>{p.nombre}</span>
                <span className="text-xs text-zinc-400">
                  stock {p.stock} · {fmt(Number(p.precio))}
                </span>
              </button>
            ))}
          </div>
        )}
        {aviso && <p className="mt-1 text-xs text-green-700">{aviso}</p>}
        </div>
      </details>

      {/* Conceptos (servicios + productos) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-800">2. Agrega los conceptos</h2>
          <button
            onClick={agregarServicio}
            className="fedra-action-secondary text-sm"
          >
            + Agregar servicio
          </button>
        </div>

        {items.length === 0 && (
          <p className="rounded-lg bg-zinc-50 px-3 py-3 text-center text-xs text-zinc-400">
            Escanea un producto o agrega un servicio.
          </p>
        )}

        {items.map((it, i) => (
          <div key={i} className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl bg-zinc-50 p-3">
            {it.tipo === "producto" ? (
              <span className="basis-full break-words text-sm font-medium text-zinc-800">
                {it.descripcion}
              </span>
            ) : (
              <>
                <select
                  aria-label={`Servicio del concepto ${i + 1}`}
                  value={it.servicio_id ?? ""}
                  onChange={(e) => elegirServicio(i, e.target.value)}
                  className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">— Servicio / libre —</option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
                {!it.servicio_id && (
                  <input
                    aria-label={`Descripción del concepto ${i + 1}`}
                    placeholder="Concepto"
                    value={it.descripcion}
                    onChange={(e) => setItem(i, { descripcion: e.target.value })}
                    className="w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                  />
                )}
              </>
            )}
            <label className="text-xs text-zinc-600">Cantidad<input
              aria-label={`Cantidad del concepto ${i + 1}`}
              type="number"
              min={1}
              step="0.01"
              value={it.cantidad}
              onChange={(e) => setItem(i, { cantidad: Number(e.target.value) || 1 })}
              className="mt-1 block w-20 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-center text-sm"
            /></label>
            <label className="text-xs text-zinc-600">Precio unitario
              <input
                aria-label={`Precio del concepto ${i + 1}`}
                type="number"
                value={it.precio_unit}
                onChange={(e) => setItem(i, { precio_unit: Number(e.target.value) || 0 })}
                className="mt-1 block w-28 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-right text-sm"
              />
            </label>
            <button
              onClick={() => quitar(i)}
              aria-label={`Quitar concepto ${i + 1}`}
              className="ml-auto h-11 w-11 rounded-lg text-zinc-600 hover:text-red-700"
              title="Quitar"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-zinc-100 pt-4">
        <p className="text-sm text-zinc-600">{items.length} {items.length === 1 ? 'concepto' : 'conceptos'} en este cobro</p>
        <div className="text-right"><p className="text-xs text-zinc-600">Total</p><p className="text-3xl font-semibold tabular-nums tracking-tight text-zinc-900">{fmt(total)}</p></div>
      </div>
      {error && !pagoAbierto && <p role="alert" className="fedra-checkout-error">{error}</p>}
      <button type="button" onClick={e => { e.currentTarget?.focus(); const problema = revisarConceptos(); setError(problema); if (!problema) setPagoAbierto(true); }}
        disabled={guardando || !borradorListo || !items.length || resultadoIncierto}
        className="fedra-action-primary w-full text-base">
        {guardando ? 'Registrando…' : `Continuar al cobro · ${fmt(total)}`}
      </button>
      <p className="text-center text-xs text-zinc-600">Elige cómo paga en el siguiente paso. Puedes volver sin perder la captura.</p>
    </div>
  );
}
