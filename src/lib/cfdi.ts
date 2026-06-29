// Lector de CFDI (factura electrónica del SAT) para importar compras de
// proveedor. El parseo es 100% en el navegador con DOMParser — el XML nunca
// sale del equipo y no se guarda nada nuevo en la base: solo prellena el
// formulario de compra que ya existe. Soporta CFDI 3.3 y 4.0 (los prefijos de
// namespace pueden variar, por eso buscamos por nombre local con NS comodín).

export type CfdiConcepto = {
  noIdentificacion: string | null; // clave/SKU del proveedor (suele ser el código de barras)
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  importe: number;
};

export type CfdiParsed = {
  emisorNombre: string | null;
  emisorRfc: string | null;
  folio: string | null; // Serie + Folio del comprobante
  uuid: string | null; // folio fiscal (timbre)
  fecha: string | null; // YYYY-MM-DD (zona del comprobante)
  total: number | null;
  conceptos: CfdiConcepto[];
};

// Busca el primer elemento por nombre local, ignorando el prefijo de namespace.
function first(root: Document | Element, local: string): Element | null {
  const els = (root as Element).getElementsByTagNameNS("*", local);
  return els.length > 0 ? els[0] : null;
}

function num(v: string | null | undefined): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function limpio(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : null;
}

export function parseCfdi(xml: string): CfdiParsed | null {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch {
    return null;
  }
  // DOMParser no lanza en XML inválido: mete un <parsererror>.
  if (doc.getElementsByTagName("parsererror").length > 0) return null;

  const comprobante = first(doc, "Comprobante");
  if (!comprobante) return null; // no es un CFDI

  const emisor = first(doc, "Emisor");
  const tfd = first(doc, "TimbreFiscalDigital");

  const serie = limpio(comprobante.getAttribute("Serie"));
  const folioNum = limpio(comprobante.getAttribute("Folio"));
  const folio = [serie, folioNum].filter(Boolean).join("-") || null;

  // Fecha viene como ISO sin zona (ej. 2026-06-28T13:40:00); tomamos el día.
  const fechaRaw = comprobante.getAttribute("Fecha") ?? "";
  const fecha = /^\d{4}-\d{2}-\d{2}/.test(fechaRaw) ? fechaRaw.slice(0, 10) : null;

  const conceptos: CfdiConcepto[] = [];
  const nodos = (comprobante as Element).getElementsByTagNameNS("*", "Concepto");
  for (let i = 0; i < nodos.length; i++) {
    const c = nodos[i];
    const descripcion = limpio(c.getAttribute("Descripcion")) ?? "—";
    conceptos.push({
      noIdentificacion: limpio(c.getAttribute("NoIdentificacion")),
      descripcion,
      cantidad: num(c.getAttribute("Cantidad")),
      valorUnitario: num(c.getAttribute("ValorUnitario")),
      importe: num(c.getAttribute("Importe")),
    });
  }

  return {
    emisorNombre: limpio(emisor?.getAttribute("Nombre")),
    emisorRfc: limpio(emisor?.getAttribute("Rfc")),
    folio,
    uuid: limpio(tfd?.getAttribute("UUID")),
    fecha,
    total: comprobante.getAttribute("Total") != null
      ? num(comprobante.getAttribute("Total"))
      : null,
    conceptos,
  };
}

// Normaliza texto para comparar nombres (sin acentos, minúsculas, sin dobles
// espacios) y poder ligar un concepto del CFDI a un producto del inventario.
export function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
