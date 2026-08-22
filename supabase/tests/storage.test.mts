import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ANON_KEY, API_URL, clienteAnonimo, sesion } from "./helpers.mjs";

// Las pruebas marcadas con `it.fails` NO están saltadas: se ejecutan y afirman
// lo que el contrato exige. Hoy fallan porque el sistema todavía concede de
// más, y por eso `it.fails` las da por buenas. El día que FED-014 cierre el
// hueco, la prueba empezará a pasar, `it.fails` se pondrá roja, y alguien
// tendrá que venir a convertirla en un `it` normal. Es la forma de dejar un
// hallazgo abierto ejecutándose en vez de comentado.

const manifiesto = JSON.parse(
  readFileSync(new URL("./manifiesto-storage.json", import.meta.url), "utf8"),
) as { rutaClinica: string; rutaProducto: string; pacienteId: string };

let doctora: SupabaseClient;
let farmacia: SupabaseClient;
let admin: SupabaseClient;

beforeAll(async () => {
  doctora = await sesion("doctora");
  farmacia = await sesion("farmacia");
  admin = createClient(API_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}, 60_000);

describe("el bucket clínico es privado", () => {
  it("sin sesión no se descarga un documento", async () => {
    const anon = clienteAnonimo();
    const { data, error } = await anon.storage.from("archivos").download(manifiesto.rutaClinica);
    expect(error ?? data === null, "un extraño sin sesión no debe bajar el documento").toBeTruthy();
    expect(data).toBeNull();
  });

  it("sin sesión no se enumera el bucket", async () => {
    const anon = clienteAnonimo();
    const { data } = await anon.storage.from("archivos").list("inbody");
    expect(data ?? []).toHaveLength(0);
  });

  it("la URL pública no sirve para un bucket privado", async () => {
    const anon = clienteAnonimo();
    const { data } = anon.storage.from("archivos").getPublicUrl(manifiesto.rutaClinica);
    const res = await fetch(data.publicUrl);
    expect(res.ok, "el bucket no debe servir contenido sin firma").toBe(false);
  });
});

describe("la doctora sí trabaja con el documento", () => {
  it("descarga el estudio de su paciente", async () => {
    const { data, error } = await doctora.storage.from("archivos").download(manifiesto.rutaClinica);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  it("firma una URL temporal", async () => {
    const { data, error } = await doctora.storage
      .from("archivos")
      .createSignedUrl(manifiesto.rutaClinica, 60);
    expect(error).toBeNull();
    expect(data?.signedUrl).toContain("token=");
  });
});

describe("H-016 · el contrato que hoy no se cumple", () => {
  it.fails("farmacia NO debería enumerar documentos clínicos", async () => {
    const { data } = await farmacia.storage.from("archivos").list(`inbody/${manifiesto.pacienteId}`);
    expect(data ?? [], "farmacia enumera el expediente y no debería").toHaveLength(0);
  });

  it.fails("farmacia NO debería descargar un estudio de una paciente", async () => {
    const { data } = await farmacia.storage.from("archivos").download(manifiesto.rutaClinica);
    expect(data, "farmacia se baja el estudio y no debería").toBeNull();
  });

  it.fails("farmacia NO debería firmar una URL de un documento clínico", async () => {
    const { data } = await farmacia.storage
      .from("archivos")
      .createSignedUrl(manifiesto.rutaClinica, 60);
    expect(data?.signedUrl, "farmacia firma acceso al expediente y no debería").toBeFalsy();
  });

  it.fails("nadie NO debería poder borrar un documento clínico", async () => {
    // Se usa un objeto desechable para no romper las demás pruebas si el
    // borrado sí ocurre, que es justamente lo que pasa hoy.
    const ruta = `inbody/${manifiesto.pacienteId}/desechable-${Date.now()}.png`;
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    const { error: eUp } = await admin.storage
      .from("archivos")
      .upload(ruta, bytes, { contentType: "image/png" });
    expect(eUp).toBeNull();

    await farmacia.storage.from("archivos").remove([ruta]);
    const { data } = await admin.storage.from("archivos").download(ruta);
    expect(data, "farmacia borró un documento clínico y no debería poder").toBeTruthy();
  });
});

describe("H-013 · el alta pública sigue abierta", () => {
  it.fails("una cuenta creada desde fuera NO debería recibir rol clínico", async () => {
    const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const correo = `intruso-${Date.now()}@fedra.test`;
    const { data, error } = await anon.auth.signUp({ email: correo, password: "Prueba-FED004A!" });
    expect(error, `el alta pública aceptó ${correo}`).not.toBeNull();
    expect(data?.user, "no debería crearse la cuenta").toBeFalsy();
  });
});
