// Datos fiscales y de facturación de Aldama Farmacéutica (persona física:
// Fedra Yarissa Aldama Castro). Fuente: Constancia de Situación Fiscal
// (RFC AACF921225L23). Centralizados aquí para editarlos en un solo lugar:
// si cambia el teléfono, domicilio o la leyenda, se ajusta solo este archivo.
export const FISCAL_FARMACIA = {
  nombreComercial: "Aldama Farmacéutica",
  razonSocial: "Fedra Yarissa Aldama Castro",
  rfc: "AACF921225L23",
  regimen: "Personas Físicas con Actividades Empresariales y Profesionales",
  domicilio: "Blvd. Río Fuerte 2677, Int. 3 y 4, Col. Los Viñedos",
  cp: "81228",
  ciudad: "Los Mochis, Ahome, Sinaloa",
  // TODO Dante: confirmar el número de la farmacia para facturación.
  // Por ahora se usa el de contacto conocido de la Dra.
  telFacturacion: "668 146 35 02",
} as const;

// Leyenda genérica y conforme al SAT: el cliente solicita su factura dentro
// del mismo mes de la compra, comunicándose a la farmacia con su folio y CSF.
export function leyendaFacturacion() {
  const f = FISCAL_FARMACIA;
  return `¿Necesitas factura? Solicítala dentro del mes en curso de tu compra al ${f.telFacturacion} (${f.nombreComercial}). Ten a la mano tu folio de ticket y tu Constancia de Situación Fiscal (RFC, régimen y C.P.). Se emite conforme a la normatividad vigente del SAT.`;
}
