// Sube objetos sintéticos al bucket privado `archivos` con la llave de
// servicio, que es como los sube la aplicación real, y deja un manifiesto con
// las rutas para que las pruebas sepan qué pedir.
//
// Los bytes son un PNG de 1x1 generado aquí mismo. No se copia ningún archivo
// de la doctora ni se descarga nada de producción.
//
// Se preparan dos pacientes a propósito: las pruebas de FED-014 tienen que
// poder intentar registrar la ruta de una contra el expediente de la otra, que
// es el mutante que una política de sólo rol dejaría pasar.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { exigirSupabaseLocal, requerido } from "../../scripts/guardia-supabase.mjs";

const CONTEXTO = "FED-004A (preparar storage)";
const API_URL = exigirSupabaseLocal(requerido("SUPABASE_URL", CONTEXTO), CONTEXTO);
const SERVICE = requerido("SUPABASE_SERVICE_ROLE_KEY", CONTEXTO);

const admin = createClient(API_URL, SERVICE, { auth: { persistSession: false } });

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const { data: bucket, error: eBucket } = await admin.storage.getBucket("archivos");
if (eBucket) throw new Error(`El bucket 'archivos' no existe: ${eBucket.message}`);
if (bucket.public) throw new Error("El bucket 'archivos' quedó público. Debe ser privado.");

async function paciente(nombre) {
  const { data, error } = await admin
    .from("pacientes").select("id").eq("nombre", nombre).single();
  if (error) throw new Error(`No se encontró la paciente sintética ${nombre}: ${error.message}`);
  return data.id;
}

const pacienteId = await paciente("PRUEBA Ana");
const pacienteOtroId = await paciente("PRUEBA Beatriz");

const { data: producto, error: eProd } = await admin
  .from("productos").select("id").eq("nombre", "PRUEBA Vitamina D3 5000UI").single();
if (eProd) throw new Error(`No se encontró el producto sintético: ${eProd.message}`);

const rutaClinica = `inbody/${pacienteId}/prueba-inbody.png`;
const rutaClinicaOtra = `inbody/${pacienteOtroId}/prueba-inbody-otra.png`;
// Un objeto clínico deliberadamente sin fila, para probar que el inventario de
// huérfanos los ve y que farmacia no.
const rutaHuerfana = `inbody/${pacienteId}/prueba-huerfano.png`;
const rutaProducto = `${producto.id}/prueba-ficha.png`;

for (const ruta of [rutaClinica, rutaClinicaOtra, rutaHuerfana, rutaProducto]) {
  const { error } = await admin.storage
    .from("archivos")
    .upload(ruta, PNG_1X1, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`No se pudo subir ${ruta}: ${error.message}`);
}

// La fila de metadatos del archivo de producto, que es la que la política de
// FED-014 va a usar para decidir.
// `producto_archivos` no tiene índice único sobre `path`, así que un upsert
// por esa columna fallaría. Se borra y se vuelve a insertar, que es idempotente
// sin depender de una restricción que no existe.
await admin.from("producto_archivos").delete().eq("path", rutaProducto);
const { error: eMeta } = await admin.from("producto_archivos").insert({
  producto_id: producto.id, nombre: "prueba-ficha.png", tipo: "image/png", path: rutaProducto,
});
if (eMeta) throw new Error(`No se pudo registrar el metadato del archivo: ${eMeta.message}`);

// Las filas de los dos documentos clínicos. `path` es único, así que reintentar
// esta preparación no las duplica. `subido_por` se queda nulo: aquí no hay
// sesión, y la columna sólo se llena sola cuando escribe una persona.
const { error: eDocs } = await admin
  .from("documentos_clinicos")
  .upsert(
    [
      { paciente_id: pacienteId, path: rutaClinica, tipo: "inbody" },
      { paciente_id: pacienteOtroId, path: rutaClinicaOtra, tipo: "inbody" },
    ],
    { onConflict: "path", ignoreDuplicates: true },
  );
if (eDocs) throw new Error(`No se pudieron registrar los documentos clínicos: ${eDocs.message}`);

const { data: docs, error: eLeer } = await admin
  .from("documentos_clinicos")
  .select("id, path")
  .in("path", [rutaClinica, rutaClinicaOtra]);
if (eLeer) throw new Error(`No se pudieron leer los documentos clínicos: ${eLeer.message}`);
const documentoId = docs.find((d) => d.path === rutaClinica)?.id;
const documentoOtroId = docs.find((d) => d.path === rutaClinicaOtra)?.id;
if (!documentoId || !documentoOtroId) {
  throw new Error("Faltó alguna fila de documentos_clinicos después de prepararlas.");
}

writeFileSync(
  new URL("./manifiesto-storage.json", import.meta.url),
  JSON.stringify(
    {
      rutaClinica,
      rutaClinicaOtra,
      rutaHuerfana,
      rutaProducto,
      pacienteId,
      pacienteOtroId,
      productoId: producto.id,
      documentoId,
      documentoOtroId,
    },
    null,
    2,
  ),
);
console.log("FED-004A: objetos sintéticos subidos al bucket privado.");
console.log(JSON.stringify({ rutaClinica, rutaClinicaOtra, rutaHuerfana, rutaProducto }));
