"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { registrarCompra, type ItemCompra } from "./actions";
import ComboBuscador from "@/components/ComboBuscador";
import { parseCfdi, normaliza } from "@/lib/cfdi";

const input =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";
const label = "mb-1 block text-xs font-medium text-zinc-600";

const filaVacia: ItemCompra = {
  producto_id: "",
  cantidad: "",
  costo: "",
  lote: "",
  caducidad: "",
};

export default function NuevaCompra({
  productos,
}: {
  productos: { id: string; nombre: string; codigo_barras: string | null }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [proveedor, setProveedor] = useState("");
  const [factura, setFactura] = useState("");
  const [fecha, setFecha] = useState("");
  const [items, setItems] = useState<ItemCompra[]>([{ ...filaVacia }]);
  const opcionesProducto = useMemo(
    () => productos.map((p) => ({ value: p.id, label: p.nombre })),
    [productos],
  );
  // Índices para ligar conceptos del CFDI a productos: por código de barras
  // (NoIdentificacion) y por nombre normalizado.
  const porCodigo = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of productos)
      if (p.codigo_barras) m.set(p.codigo_barras.trim(), p.id);
    return m;
  }, [productos]);
  const porNombre = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of productos) m.set(normaliza(p.nombre), p.id);
    return m;
  }, [productos]);
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  // Importa un CFDI (XML) del proveedor y prellena el formulario. No guarda
  // nada: el usuario revisa y luego pulsa "Guardar compra" como siempre.
  async function importarXml(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (xmlInputRef.current) xmlInputRef.current.value = "";
    if (!file) return;
    setImportMsg(null);
    setMsg(null);
    const texto = await file.text();
    const cfdi = parseCfdi(texto);
    if (!cfdi) {
      setImportMsg("Ese archivo no parece un CFDI válido (XML del SAT).");
      return;
    }
    if (cfdi.emisorNombre) setProveedor(cfdi.emisorNombre);
    if (cfdi.folio) setFactura(cfdi.folio);
    if (cfdi.fecha) setFecha(cfdi.fecha);

    let ligados = 0;
    const nuevos: ItemCompra[] = cfdi.conceptos.map((c) => {
      const porCb = c.noIdentificacion
        ? porCodigo.get(c.noIdentificacion.trim())
        : undefined;
      const id = porCb ?? porNombre.get(normaliza(c.descripcion)) ?? "";
      if (id) ligados++;
      return {
        producto_id: id,
        cantidad: c.cantidad ? String(c.cantidad) : "",
        costo: c.valorUnitario ? String(c.valorUnitario) : "",
        lote: "",
        caducidad: "",
      };
    });
    setItems(nuevos.length > 0 ? nuevos : [{ ...filaVacia }]);
    const total = cfdi.conceptos.length;
    const faltan = total - ligados;
    setImportMsg(
      `Factura importada: ${total} concepto(s), ${ligados} ligado(s) al inventario` +
        (faltan > 0
          ? `. Faltan ${faltan} por seleccionar manualmente (resaltados).`
          : ".") +
        (cfdi.uuid ? ` UUID ${cfdi.uuid.slice(0, 8)}…` : ""),
    );
  }

  // El aviso de éxito se borra solo a los 3 segundos.
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(false), 3000);
    return () => clearTimeout(t);
  }, [ok]);

  function setItem(idx: number, patch: Partial<ItemCompra>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function guardar() {
    setMsg(null);
    setOk(false);
    startTransition(async () => {
      const res = await registrarCompra(proveedor, factura, fecha, items);
      if (!res.ok) {
        setMsg(res.error ?? "Error.");
        return;
      }
      setOk(true);
      setProveedor("");
      setFactura("");
      setFecha("");
      setItems([{ ...filaVacia }]);
    });
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="mb-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        + Registrar compra
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3">
        <label className="cursor-pointer rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800">
          Importar factura (XML del CFDI)
          <input
            ref={xmlInputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            className="hidden"
            onChange={importarXml}
          />
        </label>
        <span className="text-xs text-zinc-500">
          Sube el XML del proveedor y se llena solo. Opcional: puedes capturar a mano.
        </span>
      </div>
      {importMsg && (
        <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {importMsg}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={label}>Proveedor</label>
          <input
            className={input}
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="Nombre del proveedor"
          />
        </div>
        <div>
          <label className={label}>Factura</label>
          <input
            className={input}
            value={factura}
            onChange={(e) => setFactura(e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Fecha</label>
          <input
            type="date"
            className={input}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-medium uppercase text-zinc-500">Productos</p>
        {items.map((it, idx) => {
          // Renglón importado del CFDI que no se ligó solo: tiene cantidad pero
          // falta elegir el producto. Lo resaltamos para que no se pase.
          const sinLigar = !it.producto_id && Number(it.cantidad) > 0;
          return (
          <div
            key={idx}
            className={`grid grid-cols-1 gap-2 rounded-lg p-3 sm:grid-cols-12 ${
              sinLigar ? "bg-amber-50 ring-1 ring-amber-300" : "bg-zinc-50"
            }`}
          >
            <div className="sm:col-span-4">
              <ComboBuscador
                opciones={opcionesProducto}
                value={it.producto_id}
                onChange={(v) => setItem(idx, { producto_id: v })}
                placeholder={sinLigar ? "⚠ Elige el producto…" : "Busca el producto…"}
              />
            </div>
            <input
              className={`${input} sm:col-span-2`}
              type="number"
              min="1"
              placeholder="Cantidad"
              value={it.cantidad}
              onChange={(e) => setItem(idx, { cantidad: e.target.value })}
            />
            <input
              className={`${input} sm:col-span-2`}
              type="number"
              step="0.01"
              placeholder="Costo unit."
              value={it.costo}
              onChange={(e) => setItem(idx, { costo: e.target.value })}
            />
            <input
              className={`${input} sm:col-span-2`}
              placeholder="Lote"
              value={it.lote}
              onChange={(e) => setItem(idx, { lote: e.target.value })}
            />
            <input
              className={`${input} sm:col-span-2`}
              type="date"
              value={it.caducidad}
              onChange={(e) => setItem(idx, { caducidad: e.target.value })}
            />
          </div>
          );
        })}
        <button
          onClick={() => setItems((p) => [...p, { ...filaVacia }])}
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          + Agregar producto
        </button>
      </div>

      {msg && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {msg}
        </p>
      )}
      {ok && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Compra registrada y sumada al inventario.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={guardar}
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar compra"}
        </button>
        <button
          onClick={() => setAbierto(false)}
          className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
