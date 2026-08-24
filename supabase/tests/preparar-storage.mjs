// Sube objetos sintéticos al bucket privado `archivos` con la llave de
// servicio, que es como los sube la aplicación real, y deja un manifiesto con
// las rutas para que las pruebas sepan qué pedir.
//
// Los bytes son un PNG de 1x1 generado aquí mismo. No se copia ningún archivo
// de la doctora ni se descarga nada de producción.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const API_URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!API_URL || !SERVICE) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
if (!/^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)(:\d+)?$/.test(API_URL.replace(/\/$/, ""))) {
  throw new Error(`SUPABASE_URL apunta a "${API_URL}", que no es local. Abortado.`);
}

const admin = createClient(API_URL, SERVICE, { auth: { persistSession: false } });

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const { data: bucket, error: eBucket } = await admin.storage.getBucket("archivos");
if (eBucket) throw new Error(`El bucket 'archivos' no existe: ${eBucket.message}`);
if (bucket.public) throw new Error("El bucket 'archivos' quedó público. Debe ser privado.");

const { data: paciente, error: ePac } = await admin
  .from("pacientes").select("id").eq("nombre", "PRUEBA Ana").single();
if (ePac) throw new Error(`No se encontró la paciente sintética: ${ePac.message}`);

const { data: producto, error: eProd } = await admin
  .from("productos").select("id").eq("nombre", "PRUEBA Vitamina D3 5000UI").single();
if (eProd) throw new Error(`No se encontró el producto sintético: ${eProd.message}`);

const rutaClinica = `inbody/${paciente.id}/prueba-inbody.png`;
const rutaProducto = `${producto.id}/prueba-ficha.png`;

for (const ruta of [rutaClinica, rutaProducto]) {
  const { error } = await admin.storage
    .from("archivos")
    .upload(ruta, PNG_1X1, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`No se pudo subir ${ruta}: ${error.message}`);
}

// La fila de metadatos del archivo de producto, que es la que la política de
// FED-014 va a usar para decidir. El documento clínico no tiene tabla todavía:
// eso es H-017.
// `producto_archivos` no tiene índice único sobre `path`, así que un upsert
// por esa columna fallaría. Se borra y se vuelve a insertar, que es idempotente
// sin depender de una restricción que no existe.
await admin.from("producto_archivos").delete().eq("path", rutaProducto);
const { error: eMeta } = await admin.from("producto_archivos").insert({
  producto_id: producto.id, nombre: "prueba-ficha.png", tipo: "image/png", path: rutaProducto,
});
if (eMeta) throw new Error(`No se pudo registrar el metadato del archivo: ${eMeta.message}`);

writeFileSync(
  new URL("./manifiesto-storage.json", import.meta.url),
  JSON.stringify({ rutaClinica, rutaProducto, pacienteId: paciente.id, productoId: producto.id }, null, 2),
);
console.log("FED-004A: objetos sintéticos subidos al bucket privado.");
console.log(JSON.stringify({ rutaClinica, rutaProducto }));
