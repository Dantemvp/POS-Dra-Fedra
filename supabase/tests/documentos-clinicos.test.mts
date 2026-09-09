import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { API_URL, clienteAnonimo, sesion } from "./helpers.mjs";

// FED-014 · El contrato del bucket clínico, probado desde fuera.
//
// Estas pruebas hablan con Supabase por la API, con la llave anónima y una
// sesión real por rol, como lo haría un extraño con la consola del navegador
// abierta. No leen los archivos de migración: si una política concede de más,
// la prueba lo ve.
//
// La regla que se comprueba, confirmada por Dante el 22 de agosto de 2026:
// ningún rol borra ni sobrescribe un documento clínico, y una corrección entra
// como documento nuevo conservando el anterior.

const manifiesto = JSON.parse(
  readFileSync(new URL("./manifiesto-storage.json", import.meta.url), "utf8"),
) as { rutaClinica: string; rutaProducto: string; pacienteId: string; productoId: string };

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const clientes = {} as Record<string, SupabaseClient>;
let admin: SupabaseClient; // service_role: ignora RLS, sirve de testigo

beforeAll(async () => {
  for (const rol of ["admin", "doctora", "farmacia", "asistente", "gerente"] as const) {
    clientes[rol] = await sesion(rol);
  }
  admin = createClient(API_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}, 60_000);

/** ¿El objeto sigue ahí? Se pregunta con service_role, que no depende de RLS. */
async function existeObjeto(ruta: string): Promise<boolean> {
  const { data } = await admin.storage.from("archivos").download(ruta);
  return data !== null;
}

// ---------------------------------------------------------------------------
// H-016 · farmacia y el expediente
// ---------------------------------------------------------------------------
describe("farmacia no alcanza los documentos clínicos por ningún camino", () => {
  it("no los enumera", async () => {
    const { data } = await clientes.farmacia.storage
      .from("archivos")
      .list(`inbody/${manifiesto.pacienteId}`);
    expect(data ?? [], "farmacia enumeró el expediente").toHaveLength(0);
  });

  it("no los enumera tampoco desde la raíz del prefijo", async () => {
    const { data } = await clientes.farmacia.storage.from("archivos").list("inbody");
    expect(data ?? [], "farmacia enumeró bajo inbody/").toHaveLength(0);
  });

  it("no descarga una ruta que ya conoce", async () => {
    const { data } = await clientes.farmacia.storage
      .from("archivos")
      .download(manifiesto.rutaClinica);
    expect(data, "farmacia se bajó el estudio").toBeNull();
  });

  it("no firma una URL para un documento clínico", async () => {
    const { data } = await clientes.farmacia.storage
      .from("archivos")
      .createSignedUrl(manifiesto.rutaClinica, 60);
    expect(data?.signedUrl, "farmacia firmó acceso al expediente").toBeFalsy();
  });

  it("no lo sobrescribe", async () => {
    const otros = Buffer.from("contenido distinto", "utf8");
    await clientes.farmacia.storage
      .from("archivos")
      .upload(manifiesto.rutaClinica, otros, { contentType: "image/png", upsert: true });
    const { data } = await admin.storage.from("archivos").download(manifiesto.rutaClinica);
    const bytes = Buffer.from(await data!.arrayBuffer());
    expect(bytes.equals(PNG_1X1), "farmacia sustituyó el estudio").toBe(true);
  });

  it("no lo borra", async () => {
    const ruta = `inbody/${manifiesto.pacienteId}/desechable-farmacia.png`;
    await admin.storage
      .from("archivos")
      .upload(ruta, PNG_1X1, { contentType: "image/png", upsert: true });
    await clientes.farmacia.storage.from("archivos").remove([ruta]);
    expect(await existeObjeto(ruta), "farmacia borró un documento clínico").toBe(true);
    await admin.storage.from("archivos").remove([ruta]);
  });

  it("no lee la tabla de documentos clínicos", async () => {
    const { count, error } = await clientes.farmacia
      .from("documentos_clinicos")
      .select("*", { count: "exact", head: true });
    expect(error, "consultar no debe romperse; RLS niega devolviendo cero").toBeNull();
    expect(count ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Sin sesión
// ---------------------------------------------------------------------------
describe("sin sesión no hay nada", () => {
  it("no se descarga un documento clínico", async () => {
    const { data } = await clienteAnonimo().storage
      .from("archivos")
      .download(manifiesto.rutaClinica);
    expect(data).toBeNull();
  });

  it("no se enumera el bucket", async () => {
    const { data } = await clienteAnonimo().storage.from("archivos").list("inbody");
    expect(data ?? []).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Los roles clínicos sí trabajan
// ---------------------------------------------------------------------------
describe("los roles clínicos leen lo suyo", () => {
  for (const rol of ["doctora", "asistente", "gerente", "admin"] as const) {
    it(`${rol} descarga el estudio`, async () => {
      const { data, error } = await clientes[rol].storage
        .from("archivos")
        .download(manifiesto.rutaClinica);
      expect(error).toBeNull();
      expect(data, `${rol} debe poder leer el estudio`).toBeTruthy();
    });
  }

  it("la doctora firma una URL temporal", async () => {
    const { data, error } = await clientes.doctora.storage
      .from("archivos")
      .createSignedUrl(manifiesto.rutaClinica, 60);
    expect(error).toBeNull();
    expect(data?.signedUrl).toContain("token=");
  });
});

// ---------------------------------------------------------------------------
// La regla dura: nadie destruye ni sustituye
// ---------------------------------------------------------------------------
describe("ningún rol borra ni sobrescribe un documento clínico", () => {
  for (const rol of ["admin", "doctora", "asistente", "gerente"] as const) {
    it(`${rol} no lo borra`, async () => {
      const ruta = `inbody/${manifiesto.pacienteId}/desechable-${rol}.png`;
      await admin.storage
        .from("archivos")
        .upload(ruta, PNG_1X1, { contentType: "image/png", upsert: true });
      await clientes[rol].storage.from("archivos").remove([ruta]);
      expect(await existeObjeto(ruta), `${rol} borró un documento clínico`).toBe(true);
      await admin.storage.from("archivos").remove([ruta]);
    });

    it(`${rol} no lo sobrescribe`, async () => {
      const ruta = `inbody/${manifiesto.pacienteId}/inmutable-${rol}.png`;
      await admin.storage
        .from("archivos")
        .upload(ruta, PNG_1X1, { contentType: "image/png", upsert: true });
      await clientes[rol].storage
        .from("archivos")
        .upload(ruta, Buffer.from("otro contenido", "utf8"), {
          contentType: "image/png",
          upsert: true,
        });
      const { data } = await admin.storage.from("archivos").download(ruta);
      const bytes = Buffer.from(await data!.arrayBuffer());
      expect(bytes.equals(PNG_1X1), `${rol} sustituyó un documento clínico`).toBe(true);
      await admin.storage.from("archivos").remove([ruta]);
    });
  }
});

// ---------------------------------------------------------------------------
// Una corrección conserva el anterior (H-017)
// ---------------------------------------------------------------------------
describe("una corrección es un documento nuevo", () => {
  it("la doctora sube un estudio y queda su fila", async () => {
    const ruta = `inbody/${manifiesto.pacienteId}/original-${Date.now()}.png`;
    const { error: eUp } = await clientes.doctora.storage
      .from("archivos")
      .upload(ruta, PNG_1X1, { contentType: "image/png" });
    expect(eUp, "la doctora debe poder subir un estudio").toBeNull();

    const { data, error } = await clientes.doctora
      .from("documentos_clinicos")
      .insert({ paciente_id: manifiesto.pacienteId, path: ruta, tipo: "inbody" })
      .select("id, path")
      .single();
    expect(error).toBeNull();
    expect(data?.path).toBe(ruta);

    // La corrección: ruta nueva, fila nueva que apunta a la anterior.
    const rutaCorregida = `inbody/${manifiesto.pacienteId}/correccion-${Date.now()}.png`;
    const { error: eUp2 } = await clientes.doctora.storage
      .from("archivos")
      .upload(rutaCorregida, PNG_1X1, { contentType: "image/png" });
    expect(eUp2).toBeNull();

    const { data: nueva, error: e2 } = await clientes.doctora
      .from("documentos_clinicos")
      .insert({
        paciente_id: manifiesto.pacienteId,
        path: rutaCorregida,
        tipo: "inbody",
        sustituye_a: data!.id,
      })
      .select("id, sustituye_a")
      .single();
    expect(e2).toBeNull();
    expect(nueva?.sustituye_a).toBe(data!.id);

    // El anterior sigue ahí, en la base y en Storage.
    const { data: anterior } = await clientes.doctora
      .from("documentos_clinicos")
      .select("id")
      .eq("id", data!.id)
      .maybeSingle();
    expect(anterior?.id, "la corrección borró el documento anterior").toBe(data!.id);
    expect(await existeObjeto(ruta), "el objeto anterior desapareció").toBe(true);
  });

  it("la fila de un documento clínico no se actualiza ni se borra", async () => {
    const { data: fila } = await clientes.doctora
      .from("documentos_clinicos")
      .select("id, tipo")
      .limit(1)
      .maybeSingle();
    expect(fila, "debe existir al menos una fila para esta prueba").toBeTruthy();

    for (const rol of ["admin", "doctora", "gerente"] as const) {
      const { data: tocada } = await clientes[rol]
        .from("documentos_clinicos")
        .update({ tipo: "alterado" })
        .eq("id", fila!.id)
        .select();
      expect(tocada ?? [], `${rol} actualizó un documento clínico`).toHaveLength(0);

      const { data: borrada } = await clientes[rol]
        .from("documentos_clinicos")
        .delete()
        .eq("id", fila!.id)
        .select();
      expect(borrada ?? [], `${rol} borró la fila de un documento clínico`).toHaveLength(0);
    }
  });

  it("el alta del documento queda en la bitácora", async () => {
    const { count, error } = await clientes.admin
      .from("audit_log")
      .select("*", { count: "exact", head: true })
      .eq("tabla", "documentos_clinicos");
    expect(error).toBeNull();
    expect(count ?? 0, "la tabla debe estar en los disparadores de auditoría").toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Archivos de producto: el otro lado del bucket sigue funcionando
// ---------------------------------------------------------------------------
describe("los archivos de producto conservan su operación", () => {
  it("farmacia sube y borra un archivo de producto", async () => {
    const ruta = `${manifiesto.productoId}/prueba-${Date.now()}.png`;
    const { error: eUp } = await clientes.farmacia.storage
      .from("archivos")
      .upload(ruta, PNG_1X1, { contentType: "image/png" });
    expect(eUp, "farmacia debe poder subir un archivo de producto").toBeNull();

    await clientes.farmacia.storage.from("archivos").remove([ruta]);
    expect(await existeObjeto(ruta), "farmacia debe poder borrar su archivo").toBe(false);
  });

  it("la doctora lee un archivo de producto pero no lo borra", async () => {
    const { data, error } = await clientes.doctora.storage
      .from("archivos")
      .download(manifiesto.rutaProducto);
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    await clientes.doctora.storage.from("archivos").remove([manifiesto.rutaProducto]);
    expect(
      await existeObjeto(manifiesto.rutaProducto),
      "la doctora borró un archivo de producto",
    ).toBe(true);
  });

  it("el gerente lee los bytes y también la fila de metadatos", async () => {
    const { data: bytes } = await clientes.gerente.storage
      .from("archivos")
      .download(manifiesto.rutaProducto);
    expect(bytes, "el gerente debe leer los bytes").toBeTruthy();

    const { count, error } = await clientes.gerente
      .from("producto_archivos")
      .select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count ?? 0, "si lee los bytes también debe leer la fila").toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Negar por omisión
// ---------------------------------------------------------------------------
describe("lo que no es clínico ni de producto no lo alcanza nadie", () => {
  const ruta = "suelto/objeto-sin-dueno.png";

  it("ningún rol lo descarga ni lo enumera", async () => {
    await admin.storage
      .from("archivos")
      .upload(ruta, PNG_1X1, { contentType: "image/png", upsert: true });

    for (const rol of ["admin", "doctora", "farmacia", "asistente", "gerente"] as const) {
      const { data } = await clientes[rol].storage.from("archivos").download(ruta);
      expect(data, `${rol} alcanzó un objeto sin dueño`).toBeNull();
      const { data: lista } = await clientes[rol].storage.from("archivos").list("suelto");
      expect(lista ?? [], `${rol} enumeró un prefijo sin dueño`).toHaveLength(0);
    }
    await admin.storage.from("archivos").remove([ruta]);
  });

  it("ningún rol sube a un prefijo que no corresponde a un producto", async () => {
    const invento = `${crypto.randomUUID()}/intruso.png`;
    for (const rol of ["admin", "farmacia"] as const) {
      const { error } = await clientes[rol].storage
        .from("archivos")
        .upload(invento, PNG_1X1, { contentType: "image/png" });
      expect(error, `${rol} subió a un producto inexistente`).not.toBeNull();
    }
  });
});
