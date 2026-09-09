"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarDocumentoClinico } from "../actions";
import type { EstadoDocumentoClinico } from "@/lib/documentos-clinicos";

type Documento = {
  id: string;
  path: string;
  tipo: string;
  creado_en: string;
  url: string | null;
  estado: EstadoDocumentoClinico;
};

export default function DocumentosClinicos({
  pacienteId,
  documentos,
  huerfanos,
  puedeAdoptar,
}: {
  pacienteId: string;
  documentos: Documento[];
  huerfanos: { path: string; created_at: string }[];
  puedeAdoptar: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function adoptar(path: string) {
    setError(null);
    startTransition(async () => {
      const resultado = await registrarDocumentoClinico(pacienteId, path);
      if (!resultado.ok) {
        setError(resultado.error ?? "No se pudo adoptar el documento.");
        return;
      }
      router.refresh();
    });
  }

  if (documentos.length === 0 && huerfanos.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <h2 className="text-lg font-medium text-zinc-900">Documentos clínicos</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Los estudios se conservan. Una corrección crea un documento nuevo y un retiro excepcional
        queda señalado sin ocultar su rastro.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-4 space-y-3">
        {documentos.map((documento) => {
          const retirado = documento.estado.estado === "retirado";
          const retiroPendiente = documento.estado.estado === "retiro_pendiente";
          const retiro = documento.estado.estado === "activo" ? null : documento.estado.retiro;
          return (
            <article
              key={documento.id}
              className={`rounded-lg border p-3 ${
                retirado
                  ? "border-amber-300 bg-amber-50"
                  : retiroPendiente
                    ? "border-red-300 bg-red-50"
                    : "border-zinc-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {documento.tipo === "inbody" ? "Estudio InBody" : documento.tipo}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(documento.creado_en).toLocaleString("es-MX")}
                  </p>
                </div>
                {retirado && (
                  <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900">
                    Retirado
                  </span>
                )}
                {retiroPendiente && (
                  <span className="rounded-full bg-red-200 px-2.5 py-1 text-xs font-semibold text-red-900">
                    Retiro incompleto
                  </span>
                )}
                {!retiro && documento.url && (
                  <a
                    href={documento.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Ver documento
                  </a>
                )}
              </div>
              {!retiro && !documento.url && (
                // `retiros_clinicos` sólo la leen administración y la doctora. Para la
                // asistente y el gerente un documento retirado llega aquí como activo y
                // sin URL, porque el objeto ya no está en su ruta y la firma falla. Sin
                // este aviso, esa fila se ve igual que una sana y quien subió el estudio
                // vuelve a subirlo. No se nombra el motivo: eso habla de una paciente.
                <p className="mt-3 text-sm text-zinc-600">
                  El archivo no está disponible desde esta sesión. Puede haber sido retirado por
                  administración: consúltalo antes de volver a subirlo.
                </p>
              )}
              {retiro && (
                <div className="mt-3 text-sm text-zinc-700">
                  <p>{retiro.motivo}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Autorizó: {retiro.responsable}. Solicitado el{" "}
                    {new Date(retiro.solicitado_en).toLocaleString("es-MX")}.
                  </p>
                  {retiroPendiente && (
                    <p className="mt-2 font-medium text-red-800">
                      El procedimiento se interrumpió. No intentes subirlo otra vez; requiere revisión
                      administrativa.
                    </p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {huerfanos.length > 0 && (
        <div className="mt-5 border-t border-zinc-200 pt-4">
          <h3 className="text-sm font-semibold text-amber-900">Documentos pendientes de registro</h3>
          <p className="mt-1 text-xs text-zinc-500">
            El archivo ya existe y su ruta pertenece a esta paciente. Verifica que sea correcto antes
            de adoptarlo.
          </p>
          <div className="mt-3 space-y-2">
            {huerfanos.map((huerfano) => (
              <div
                key={huerfano.path}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3"
              >
                <div>
                  <p className="break-all text-xs font-medium text-zinc-800">{huerfano.path}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(huerfano.created_at).toLocaleString("es-MX")}
                  </p>
                </div>
                {puedeAdoptar && (
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => adoptar(huerfano.path)}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {pendiente ? "Registrando..." : "Adoptar"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
