export type RetiroClinico = {
  documento_id: string | null;
  path_original: string;
  motivo: string;
  responsable: string;
  solicitado_en: string;
  movido_en: string | null;
};

export type EstadoDocumentoClinico =
  | { estado: "activo" }
  | { estado: "retiro_pendiente"; retiro: RetiroClinico }
  | { estado: "retirado"; retiro: RetiroClinico };

export function estadoDocumentoClinico(
  documento: { id: string; path: string },
  retiros: RetiroClinico[],
): EstadoDocumentoClinico {
  const retiro = retiros.find(
    (fila) => fila.documento_id === documento.id || fila.path_original === documento.path,
  );
  if (!retiro) return { estado: "activo" };
  return retiro.movido_en
    ? { estado: "retirado", retiro }
    : { estado: "retiro_pendiente", retiro };
}
