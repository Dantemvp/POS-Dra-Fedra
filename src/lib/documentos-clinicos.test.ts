import { describe, expect, it } from "vitest";
import { estadoDocumentoClinico, type RetiroClinico } from "./documentos-clinicos";

const documento = { id: "documento-1", path: "inbody/paciente/estudio.png" };

function retiro(cambios: Partial<RetiroClinico> = {}): RetiroClinico {
  return {
    documento_id: documento.id,
    path_original: documento.path,
    motivo: "Documento asignado a la paciente incorrecta",
    responsable: "Dra. Fedra Aldama",
    solicitado_en: "2026-08-24T12:00:00Z",
    movido_en: "2026-08-24T12:01:00Z",
    ...cambios,
  };
}

describe("estadoDocumentoClinico", () => {
  it("mantiene activo un documento sin retiro", () => {
    expect(estadoDocumentoClinico(documento, [])).toEqual({ estado: "activo" });
  });

  it("reconoce un retiro completado por documento", () => {
    expect(estadoDocumentoClinico(documento, [retiro()]).estado).toBe("retirado");
  });

  it("reconoce por ruta el retiro de un huérfano adoptado después", () => {
    expect(
      estadoDocumentoClinico(documento, [retiro({ documento_id: null })]).estado,
    ).toBe("retirado");
  });

  it("no presenta como concluido un retiro interrumpido", () => {
    expect(
      estadoDocumentoClinico(documento, [retiro({ movido_en: null })]).estado,
    ).toBe("retiro_pendiente");
  });
});
