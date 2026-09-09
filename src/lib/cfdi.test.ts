import { describe, expect, it } from "vitest";
import { normaliza, parseCfdi } from "./cfdi";

describe("parseCfdi", () => {
  it("lee un CFDI 4.0 con namespaces y conceptos", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
        xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
        Serie="A" Folio="123" Fecha="2026-06-28T13:40:00" Total="150.50">
        <cfdi:Emisor Rfc="AACF921225L23" Nombre="Proveedor Demo" />
        <cfdi:Conceptos>
          <cfdi:Concepto NoIdentificacion="750123" Descripcion="Producto prueba"
            Cantidad="2" ValorUnitario="75.25" Importe="150.50" />
        </cfdi:Conceptos>
        <cfdi:Complemento>
          <tfd:TimbreFiscalDigital UUID="00000000-0000-0000-0000-000000000001" />
        </cfdi:Complemento>
      </cfdi:Comprobante>`;

    expect(parseCfdi(xml)).toEqual({
      emisorNombre: "Proveedor Demo",
      emisorRfc: "AACF921225L23",
      folio: "A-123",
      uuid: "00000000-0000-0000-0000-000000000001",
      fecha: "2026-06-28",
      total: 150.5,
      conceptos: [
        {
          noIdentificacion: "750123",
          descripcion: "Producto prueba",
          cantidad: 2,
          valorUnitario: 75.25,
          importe: 150.5,
        },
      ],
    });
  });

  it("rechaza XML inválido y documentos que no son CFDI", () => {
    expect(parseCfdi("<cfdi:Comprobante")).toBeNull();
    expect(parseCfdi("<documento />")).toBeNull();
  });

  it("normaliza acentos, mayúsculas y espacios", () => {
    expect(normaliza("  ÁCIDO   FÓLICO  ")).toBe("acido folico");
  });
});
