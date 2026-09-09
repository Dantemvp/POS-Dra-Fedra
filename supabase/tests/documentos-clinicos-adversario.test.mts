import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { API_URL, clienteAnonimo, sesion } from "./helpers.mjs";

// FED-014 · El cliente adversario.
//
// `documentos-clinicos.test.mts` prueba que la aplicación funciona y que
// farmacia no alcanza el expediente. Este archivo prueba lo otro: que la base
// aguanta a alguien que NO usa la aplicación. Cualquiera con una sesión válida
// y la consola del navegador abierta escribe contra PostgREST el cuerpo que se
// le antoje, con el `paciente_id` que quiera, la ruta que quiera y el
// `subido_por` que quiera. Que la server action mande valores honestos no
// prueba nada sobre lo que la base acepta.
//
// Regla de este archivo: ningún caso se da por bueno con el error que devolvió
// la llamada. Un 403 que en realidad fue un 404, o un insert que "falló" pero
// dejó fila, se verían igual desde afuera. El estado final se comprueba
// siempre con `service_role`, que ignora RLS y no tiene motivo para mentir.

const manifiesto = JSON.parse(
  readFileSync(new URL("./manifiesto-storage.json", import.meta.url), "utf8"),
) as {
  rutaClinica: string;
  rutaClinicaOtra: string;
  rutaHuerfana: string;
  rutaProducto: string;
  pacienteId: string;
  pacienteOtroId: string;
  productoId: string;
  documentoId: string;
  documentoOtroId: string;
};

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const ROLES = ["admin", "doctora", "farmacia", "asistente", "gerente"] as const;
const clientes = {} as Record<string, SupabaseClient>;
let admin: SupabaseClient; // service_role: ignora RLS, sirve de testigo

beforeAll(async () => {
  for (const rol of ROLES) clientes[rol] = await sesion(rol);
  admin = createClient(API_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}, 60_000);

/** Cuántas filas hay de verdad con esa ruta, preguntado sin RLS de por medio. */
async function filasConRuta(path: string): Promise<number> {
  const { count, error } = await admin
    .from("documentos_clinicos")
    .select("*", { count: "exact", head: true })
    .eq("path", path);
  if (error) throw new Error(`El testigo falló consultando ${path}: ${error.message}`);
  return count ?? 0;
}

/** Deja un objeto clínico subido por la doctora y devuelve su ruta. */
async function subirComoDoctora(pacienteId: string): Promise<string> {
  const ruta = `inbody/${pacienteId}/${crypto.randomUUID()}.png`;
  const { error } = await clientes.doctora.storage
    .from("archivos")
    .upload(ruta, PNG_1X1, { contentType: "image/png" });
  expect(error, `la doctora debe poder subir a ${ruta}`).toBeNull();
  return ruta;
}

async function usuarioIdDe(email: string): Promise<string> {
  const { data, error } = await admin.from("usuarios").select("id").eq("email", email).single();
  if (error) throw new Error(`No se encontró el usuario ${email}: ${error.message}`);
  return data.id as string;
}

// ---------------------------------------------------------------------------
// 1. La integridad del rastro no depende de que el cliente sea honesto
// ---------------------------------------------------------------------------
describe("documentos_clinicos resiste al cliente que escribe a mano", () => {
  it("no acepta la ruta de una paciente bajo el expediente de otra", async () => {
    const ruta = await subirComoDoctora(manifiesto.pacienteOtroId);

    const { error } = await clientes.doctora
      .from("documentos_clinicos")
      .insert({ paciente_id: manifiesto.pacienteId, path: ruta, tipo: "inbody" });

    expect(error, "cruzar pacientes debe fallar").not.toBeNull();
    expect(await filasConRuta(ruta), "quedó fila de un cruce de pacientes").toBe(0);
  });

  it("no acepta una ruta de producto como documento clínico", async () => {
    const { error } = await clientes.doctora
      .from("documentos_clinicos")
      .insert({ paciente_id: manifiesto.pacienteId, path: manifiesto.rutaProducto, tipo: "inbody" });

    expect(error, "una ruta de producto no es un documento clínico").not.toBeNull();
    expect(await filasConRuta(manifiesto.rutaProducto)).toBe(0);
  });

  it("no acepta una ruta que no existe en el bucket", async () => {
    const fantasma = `inbody/${manifiesto.pacienteId}/${crypto.randomUUID()}.png`;

    const { error } = await clientes.doctora
      .from("documentos_clinicos")
      .insert({ paciente_id: manifiesto.pacienteId, path: fantasma, tipo: "inbody" });

    expect(error, "registrar una ruta inexistente debe fallar").not.toBeNull();
    expect(await filasConRuta(fantasma)).toBe(0);
  });

  it("no acepta una ruta anidada más hondo, aunque el objeto exista", async () => {
    // Se sube con la llave de servicio a propósito: la política del bucket ya
    // rechaza esta forma, y aquí se está probando la restricción de la tabla,
    // que es la que aguanta si algún día alguien afloja la del bucket.
    const honda = `inbody/${manifiesto.pacienteId}/subcarpeta/${crypto.randomUUID()}.png`;
    await admin.storage.from("archivos").upload(honda, PNG_1X1, { contentType: "image/png" });

    const { error } = await clientes.doctora
      .from("documentos_clinicos")
      .insert({ paciente_id: manifiesto.pacienteId, path: honda, tipo: "inbody" });

    expect(error, "la ruta anidada debe fallar").not.toBeNull();
    expect(await filasConRuta(honda)).toBe(0);
    await admin.storage.from("archivos").remove([honda]);
  });

  it("no deja firmar el estudio con el nombre de otra persona", async () => {
    const ruta = await subirComoDoctora(manifiesto.pacienteId);
    const idDeAdmin = await usuarioIdDe("admin@fedra.test");

    const { error } = await clientes.doctora
      .from("documentos_clinicos")
      .insert({
        paciente_id: manifiesto.pacienteId,
        path: ruta,
        tipo: "inbody",
        subido_por: idDeAdmin,
      });

    expect(error, "falsificar la autoría debe fallar").not.toBeNull();
    expect(await filasConRuta(ruta), "quedó fila con autoría falsificada").toBe(0);
  });

  it("tampoco deja dejar la autoría en nulo a propósito", async () => {
    const ruta = await subirComoDoctora(manifiesto.pacienteId);

    const { error } = await clientes.doctora
      .from("documentos_clinicos")
      .insert({
        paciente_id: manifiesto.pacienteId,
        path: ruta,
        tipo: "inbody",
        subido_por: null,
      });

    expect(error, "un alta sin autoría debe fallar").not.toBeNull();
    expect(await filasConRuta(ruta)).toBe(0);
  });

  it("el alta honesta queda firmada por quien de verdad la hizo", async () => {
    const ruta = await subirComoDoctora(manifiesto.pacienteId);
    const idDeLaDoctora = await usuarioIdDe("doctora@fedra.test");

    // La aplicación NO manda `subido_por`: lo pone el valor por omisión.
    const { error } = await clientes.doctora
      .from("documentos_clinicos")
      .insert({ paciente_id: manifiesto.pacienteId, path: ruta, tipo: "inbody" });
    expect(error, "el alta honesta debe entrar").toBeNull();

    const { data } = await admin
      .from("documentos_clinicos")
      .select("subido_por")
      .eq("path", ruta)
      .single();
    expect(data?.subido_por, "la fila no quedó firmada por la doctora").toBe(idDeLaDoctora);
  });

  it("una corrección no puede apuntar al documento de otra paciente", async () => {
    const ruta = await subirComoDoctora(manifiesto.pacienteId);

    const { error } = await clientes.doctora
      .from("documentos_clinicos")
      .insert({
        paciente_id: manifiesto.pacienteId,
        path: ruta,
        tipo: "inbody",
        sustituye_a: manifiesto.documentoOtroId,
      });

    expect(error, "corregir el documento de otra paciente debe fallar").not.toBeNull();
    expect(await filasConRuta(ruta)).toBe(0);
  });

  it("registrar dos veces la misma ruta no duplica el rastro", async () => {
    const ruta = await subirComoDoctora(manifiesto.pacienteId);

    const primera = await clientes.doctora
      .from("documentos_clinicos")
      .insert({ paciente_id: manifiesto.pacienteId, path: ruta, tipo: "inbody" });
    expect(primera.error).toBeNull();

    const segunda = await clientes.doctora
      .from("documentos_clinicos")
      .insert({ paciente_id: manifiesto.pacienteId, path: ruta, tipo: "inbody" });
    expect(segunda.error, "la segunda alta debe chocar contra la unicidad").not.toBeNull();

    expect(await filasConRuta(ruta), "el rastro se duplicó").toBe(1);
  });

  it("el gerente lee el rastro pero no lo escribe", async () => {
    const ruta = await subirComoDoctora(manifiesto.pacienteId);

    const { error } = await clientes.gerente
      .from("documentos_clinicos")
      .insert({ paciente_id: manifiesto.pacienteId, path: ruta, tipo: "inbody" });

    expect(error, "el gerente no captura estudios").not.toBeNull();
    expect(await filasConRuta(ruta)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. No se fabrican objetos que después nadie podría registrar ni borrar
// ---------------------------------------------------------------------------
describe("el bucket no acepta rutas clínicas imposibles", () => {
  it("ningún rol sube bajo una paciente que no existe", async () => {
    for (const rol of ["admin", "doctora", "asistente"] as const) {
      const inventada = `inbody/${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
      const { error } = await clientes[rol].storage
        .from("archivos")
        .upload(inventada, PNG_1X1, { contentType: "image/png" });

      expect(error, `${rol} subió a una paciente inexistente`).not.toBeNull();
      const { data } = await admin.storage.from("archivos").download(inventada);
      expect(data, `${rol} dejó bytes bajo una paciente inexistente`).toBeNull();
    }
  });

  it("ningún rol sube a una ruta clínica anidada más hondo", async () => {
    const honda = `inbody/${manifiesto.pacienteId}/subcarpeta/${crypto.randomUUID()}.png`;
    const { error } = await clientes.doctora.storage
      .from("archivos")
      .upload(honda, PNG_1X1, { contentType: "image/png" });

    expect(error, "la ruta anidada debe rechazarse en el bucket").not.toBeNull();
    const { data } = await admin.storage.from("archivos").download(honda);
    expect(data, "quedaron bytes en una ruta anidada").toBeNull();
  });

  it("el gerente no sube estudios aunque los lea", async () => {
    const ruta = `inbody/${manifiesto.pacienteId}/${crypto.randomUUID()}.png`;
    const { error } = await clientes.gerente.storage
      .from("archivos")
      .upload(ruta, PNG_1X1, { contentType: "image/png" });

    expect(error, "el gerente subió un estudio").not.toBeNull();
    const { data } = await admin.storage.from("archivos").download(ruta);
    expect(data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Metadatos de producto: leer no es escribir
//
// La política anterior era una sola `for all` con los roles lectores en el
// `using`. DELETE evalúa `using` y nunca `with check`, así que esos roles
// podían borrar la fila. Cada caso comprueba el estado final con el testigo,
// porque un delete negado por RLS no devuelve error: devuelve cero filas.
// ---------------------------------------------------------------------------
describe("los metadatos de producto sólo los escribe farmacia", () => {
  for (const rol of ["doctora", "asistente", "gerente"] as const) {
    it(`${rol} no borra la fila de metadatos`, async () => {
      await clientes[rol].from("producto_archivos").delete().eq("path", manifiesto.rutaProducto);

      const { count } = await admin
        .from("producto_archivos")
        .select("*", { count: "exact", head: true })
        .eq("path", manifiesto.rutaProducto);
      expect(count ?? 0, `${rol} borró la fila de metadatos`).toBe(1);
    });

    it(`${rol} no modifica la fila de metadatos`, async () => {
      await clientes[rol]
        .from("producto_archivos")
        .update({ nombre: `alterado-por-${rol}` })
        .eq("path", manifiesto.rutaProducto);

      const { data } = await admin
        .from("producto_archivos")
        .select("nombre")
        .eq("path", manifiesto.rutaProducto)
        .single();
      expect(data?.nombre, `${rol} modificó la fila de metadatos`).toBe("prueba-ficha.png");
    });

    it(`${rol} no da de alta metadatos`, async () => {
      const ruta = `${manifiesto.productoId}/${crypto.randomUUID()}.png`;
      await clientes[rol]
        .from("producto_archivos")
        .insert({ producto_id: manifiesto.productoId, nombre: "intruso.png", tipo: "image/png", path: ruta });

      const { count } = await admin
        .from("producto_archivos")
        .select("*", { count: "exact", head: true })
        .eq("path", ruta);
      expect(count ?? 0, `${rol} dio de alta metadatos de producto`).toBe(0);
    });
  }

  it("farmacia sí borra la fila de un archivo de producto", async () => {
    const ruta = `${manifiesto.productoId}/${crypto.randomUUID()}.png`;
    await admin.storage.from("archivos").upload(ruta, PNG_1X1, { contentType: "image/png" });
    const { error: eAlta } = await admin
      .from("producto_archivos")
      .insert({ producto_id: manifiesto.productoId, nombre: "desechable.png", tipo: "image/png", path: ruta });
    expect(eAlta).toBeNull();

    const { error } = await clientes.farmacia
      .from("producto_archivos")
      .delete()
      .eq("path", ruta);
    expect(error).toBeNull();

    const { count } = await admin
      .from("producto_archivos")
      .select("*", { count: "exact", head: true })
      .eq("path", ruta);
    expect(count ?? 0, "farmacia debe poder borrar la ficha de su archivo").toBe(0);
    await admin.storage.from("archivos").remove([ruta]);
  });
});

// ---------------------------------------------------------------------------
// 4. Retiro administrativo
//
// El caso que la regla "nadie borra" no atendía: el estudio subido al
// expediente equivocado. No se borra, se manda a `cuarentena/`, que no aparece
// en ninguna política del bucket, y queda la bitácora de por qué.
// ---------------------------------------------------------------------------
describe("el retiro administrativo saca el documento sin desaparecerlo", () => {
  let rutaOriginal: string;
  let rutaCuarentena: string;
  let retiroId: string;

  beforeAll(async () => {
    rutaOriginal = `inbody/${manifiesto.pacienteId}/${crypto.randomUUID()}.png`;
    await admin.storage.from("archivos").upload(rutaOriginal, PNG_1X1, { contentType: "image/png" });
    const { data: documento, error: eDoc } = await admin
      .from("documentos_clinicos")
      .insert({ paciente_id: manifiesto.pacienteId, path: rutaOriginal, tipo: "inbody" })
      .select("id")
      .single();
    if (eDoc) throw new Error(`No se pudo preparar el documento a retirar: ${eDoc.message}`);

    // Mismos tres pasos que `scripts/retiro-clinico.mjs`, en el mismo orden:
    // se registra, se mueve y se sella.
    retiroId = crypto.randomUUID();
    rutaCuarentena = `cuarentena/${retiroId}/estudio.png`;
    const { error: eRetiro } = await admin.from("retiros_clinicos").insert({
      id: retiroId,
      documento_id: documento.id,
      path_original: rutaOriginal,
      path_cuarentena: rutaCuarentena,
      motivo: "Se capturó el estudio de otra paciente por error, prueba sintética de FED-014",
      responsable: "Dra. Fedra Aldama",
    });
    if (eRetiro) throw new Error(`No se pudo registrar el retiro: ${eRetiro.message}`);

    const { error: eMover } = await admin.storage
      .from("archivos")
      .move(rutaOriginal, rutaCuarentena);
    if (eMover) throw new Error(`No se pudo mover a cuarentena: ${eMover.message}`);

    const { error: eSello } = await admin
      .from("retiros_clinicos")
      .update({ movido_en: new Date().toISOString() })
      .eq("id", retiroId);
    if (eSello) throw new Error(`No se pudo sellar el retiro: ${eSello.message}`);
  }, 60_000);

  it("ningún rol alcanza el documento retirado, ni por su ruta vieja ni por la nueva", async () => {
    for (const rol of ROLES) {
      const vieja = await clientes[rol].storage.from("archivos").download(rutaOriginal);
      expect(vieja.data, `${rol} alcanzó el documento retirado por su ruta original`).toBeNull();

      const nueva = await clientes[rol].storage.from("archivos").download(rutaCuarentena);
      expect(nueva.data, `${rol} alcanzó el documento en cuarentena`).toBeNull();

      const { data: lista } = await clientes[rol].storage.from("archivos").list("cuarentena");
      expect(lista ?? [], `${rol} enumeró la cuarentena`).toHaveLength(0);

      const firmada = await clientes[rol].storage
        .from("archivos")
        .createSignedUrl(rutaCuarentena, 60);
      expect(firmada.data?.signedUrl, `${rol} firmó acceso a la cuarentena`).toBeFalsy();
    }

    const { data } = await clienteAnonimo().storage.from("archivos").download(rutaCuarentena);
    expect(data, "sin sesión se alcanzó la cuarentena").toBeNull();
  });

  it("pero el documento sigue existiendo y la fila que lo nombra también", async () => {
    const { data } = await admin.storage.from("archivos").download(rutaCuarentena);
    expect(data, "el documento retirado desapareció del todo").toBeTruthy();

    expect(await filasConRuta(rutaOriginal), "se borró el rastro del documento retirado").toBe(1);
  });

  it("admin y doctora ven la bitácora del retiro; los demás no", async () => {
    for (const rol of ["admin", "doctora"] as const) {
      const { data, error } = await clientes[rol]
        .from("retiros_clinicos")
        .select("motivo, responsable")
        .eq("id", retiroId)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.responsable, `${rol} debe poder leer quién autorizó el retiro`).toBe(
        "Dra. Fedra Aldama",
      );
    }

    for (const rol of ["farmacia", "asistente", "gerente"] as const) {
      const { count, error } = await clientes[rol]
        .from("retiros_clinicos")
        .select("*", { count: "exact", head: true });
      expect(error, "consultar no debe romperse; RLS niega devolviendo cero").toBeNull();
      expect(count ?? 0, `${rol} leyó la bitácora de retiros`).toBe(0);
    }
  });

  it("ninguna sesión corrige ni borra la bitácora", async () => {
    for (const rol of ["admin", "doctora"] as const) {
      await clientes[rol]
        .from("retiros_clinicos")
        .update({ motivo: "otra cosa" })
        .eq("id", retiroId);
      await clientes[rol].from("retiros_clinicos").delete().eq("id", retiroId);
    }

    const { data } = await admin
      .from("retiros_clinicos")
      .select("motivo")
      .eq("id", retiroId)
      .maybeSingle();
    expect(data?.motivo, "la bitácora del retiro cambió o desapareció").toContain(
      "Se capturó el estudio de otra paciente",
    );
  });

  it("ni siquiera la llave de servicio la corrige o la borra", async () => {
    const { error: eUpdate } = await admin
      .from("retiros_clinicos")
      .update({ motivo: "un motivo distinto escrito después" })
      .eq("id", retiroId);
    expect(eUpdate, "service_role reescribió el motivo de un retiro").not.toBeNull();

    const { error: eDelete } = await admin
      .from("retiros_clinicos")
      .delete()
      .eq("id", retiroId);
    expect(eDelete, "service_role borró la evidencia de un retiro").not.toBeNull();

    const { count } = await admin
      .from("retiros_clinicos")
      .select("*", { count: "exact", head: true })
      .eq("id", retiroId);
    expect(count ?? 0).toBe(1);
  });

  it("el sello de movido_en no se vuelve a poner", async () => {
    const { error } = await admin
      .from("retiros_clinicos")
      .update({ movido_en: new Date().toISOString() })
      .eq("id", retiroId);
    expect(error, "se volvió a sellar un retiro ya sellado").not.toBeNull();
  });

  it("un retiro sin motivo de verdad no se registra, ni con la llave de servicio", async () => {
    const id = crypto.randomUUID();
    const { error } = await admin.from("retiros_clinicos").insert({
      id,
      path_original: `inbody/${manifiesto.pacienteId}/loquesea.png`,
      path_cuarentena: `cuarentena/${id}/loquesea.png`,
      motivo: "error",
      responsable: "Dra. Fedra Aldama",
    });
    expect(error, "un motivo de cinco letras no es un motivo").not.toBeNull();
  });

  it("un retiro no puede fingir que manda el documento a otro lado", async () => {
    const id = crypto.randomUUID();
    const { error } = await admin.from("retiros_clinicos").insert({
      id,
      path_original: `inbody/${manifiesto.pacienteId}/loquesea.png`,
      // Fuera de `cuarentena/`, y por lo tanto alcanzable por los roles
      // clínicos: eso no es un retiro.
      path_cuarentena: `inbody/${manifiesto.pacienteId}/escondido.png`,
      motivo: "Se intenta esconder el documento dentro del mismo expediente clínico",
      responsable: "Dra. Fedra Aldama",
    });
    expect(error, "el destino de un retiro tiene que ser la cuarentena").not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Inventario de huérfanos
//
// Un objeto bajo `inbody/` sin fila no se puede borrar y no sale en ninguna
// pantalla. La vista es la diferencia entre un huérfano conocido y uno
// silencioso.
// ---------------------------------------------------------------------------
describe("los huérfanos se ven", () => {
  it("la doctora ve el objeto sin fila", async () => {
    const { data, error } = await clientes.doctora
      .from("inbody_huerfanos")
      .select("path, paciente_id");
    expect(error).toBeNull();
    const rutas = (data ?? []).map((fila) => fila.path as string);
    expect(rutas, "el huérfano preparado no aparece en el inventario").toContain(
      manifiesto.rutaHuerfana,
    );
  });

  it("un documento registrado no aparece como huérfano", async () => {
    const { data } = await clientes.doctora
      .from("inbody_huerfanos")
      .select("path")
      .eq("path", manifiesto.rutaClinica);
    expect(data ?? [], "un documento con fila salió como huérfano").toHaveLength(0);
  });

  it("farmacia no ve nada en el inventario de huérfanos", async () => {
    const { data, error } = await clientes.farmacia.from("inbody_huerfanos").select("path");
    expect(error, "consultar no debe romperse; la vista se resuelve con sus permisos").toBeNull();
    expect(data ?? [], "farmacia enumeró objetos clínicos por la vista").toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. El retiro se retoma donde se haya cortado
//
// Los tres pasos del retiro son tres escrituras distintas y las dos junturas se
// pueden cortar. Estas pruebas corren el script de verdad, con `node`, en vez
// de imitar lo que hace: si el script cambia y deja de recuperarse, quien lo
// nota es esta prueba y no la persona que estaba retirando un documento.
// ---------------------------------------------------------------------------
describe("el retiro se retoma donde se haya cortado", () => {
  const MOTIVO = "Prueba sintetica de FED-014 sobre la recuperacion del retiro interrumpido";
  const SCRIPT = fileURLToPath(new URL("../../scripts/retiro-clinico.mjs", import.meta.url));

  function correrRetiro(ruta: string): { ok: boolean; salida: string } {
    const args = [
      SCRIPT,
      "--path",
      ruta,
      "--motivo",
      MOTIVO,
      "--responsable",
      "Dra. Fedra Aldama",
      "--confirmo",
    ];
    try {
      return { ok: true, salida: execFileSync(process.execPath, args, { encoding: "utf8" }) };
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string };
      return { ok: false, salida: `${err.stdout ?? ""}${err.stderr ?? ""}` };
    }
  }

  /** Deja un estudio subido y registrado, listo para retirar. */
  async function documentoParaRetirar(): Promise<string> {
    const ruta = `inbody/${manifiesto.pacienteId}/${crypto.randomUUID()}.png`;
    const { error: eUp } = await admin.storage
      .from("archivos")
      .upload(ruta, PNG_1X1, { contentType: "image/png" });
    expect(eUp).toBeNull();
    const { error: eDoc } = await admin
      .from("documentos_clinicos")
      .insert({ paciente_id: manifiesto.pacienteId, path: ruta, tipo: "inbody" });
    expect(eDoc).toBeNull();
    return ruta;
  }

  async function retiroDe(ruta: string) {
    const { data } = await admin
      .from("retiros_clinicos")
      .select("id, path_cuarentena, movido_en")
      .eq("path_original", ruta);
    return data ?? [];
  }

  async function existeObjeto(ruta: string): Promise<boolean> {
    const { data } = await admin.storage.from("archivos").download(ruta);
    return data !== null && data !== undefined;
  }

  it("retira un documento de principio a fin", async () => {
    const ruta = await documentoParaRetirar();

    const corrida = correrRetiro(ruta);
    expect(corrida.ok, `el script fallo:\n${corrida.salida}`).toBe(true);

    const retiros = await retiroDe(ruta);
    expect(retiros, "debe quedar exactamente un retiro").toHaveLength(1);
    expect(retiros[0].movido_en, "el retiro quedo sin sellar").not.toBeNull();
    expect(await existeObjeto(ruta), "el objeto sigue en su ruta original").toBe(false);
    expect(
      await existeObjeto(retiros[0].path_cuarentena as string),
      "el objeto no llego a cuarentena",
    ).toBe(true);
  }, 60_000);

  it("retoma el retiro que se cortó entre el registro y el movimiento", async () => {
    const ruta = await documentoParaRetirar();
    const id = crypto.randomUUID();
    const destino = `cuarentena/${id}/interrumpido-antes.png`;
    // El estado exacto en el que queda un proceso que murió después de escribir
    // la bitácora y antes de tocar el bucket.
    const { error } = await admin.from("retiros_clinicos").insert({
      id,
      path_original: ruta,
      path_cuarentena: destino,
      motivo: MOTIVO,
      responsable: "Dra. Fedra Aldama",
    });
    expect(error).toBeNull();

    const corrida = correrRetiro(ruta);
    expect(corrida.ok, `el script no retomo el retiro:\n${corrida.salida}`).toBe(true);
    expect(corrida.salida).toContain("retomando");

    const retiros = await retiroDe(ruta);
    expect(retiros, "abrio un retiro nuevo en vez de retomar el que habia").toHaveLength(1);
    expect(retiros[0].id).toBe(id);
    expect(retiros[0].movido_en).not.toBeNull();
    expect(await existeObjeto(ruta)).toBe(false);
    expect(await existeObjeto(destino), "no movio el objeto al destino ya registrado").toBe(true);
  }, 60_000);

  it("retoma el retiro que se cortó entre el movimiento y el sello", async () => {
    const ruta = await documentoParaRetirar();
    const id = crypto.randomUUID();
    const destino = `cuarentena/${id}/interrumpido-despues.png`;
    const { error } = await admin.from("retiros_clinicos").insert({
      id,
      path_original: ruta,
      path_cuarentena: destino,
      motivo: MOTIVO,
      responsable: "Dra. Fedra Aldama",
    });
    expect(error).toBeNull();

    // La interrupción exacta que pidió la revisión: el objeto YA se movió y el
    // sello nunca llegó a escribirse. Antes de este arreglo el script se detenía
    // en "no existe el objeto", porque preguntaba por los bytes antes de mirar
    // la bitácora, y ese retiro se quedaba sin sellar para siempre.
    const { error: eMover } = await admin.storage.from("archivos").move(ruta, destino);
    expect(eMover).toBeNull();

    const corrida = correrRetiro(ruta);
    expect(corrida.ok, `el script no pudo sellar un retiro ya movido:\n${corrida.salida}`).toBe(true);
    expect(corrida.salida).toContain("Sólo falta el sello");

    const retiros = await retiroDe(ruta);
    expect(retiros).toHaveLength(1);
    expect(retiros[0].id).toBe(id);
    expect(retiros[0].movido_en, "el sello no se puso").not.toBeNull();
    expect(await existeObjeto(destino), "el objeto se movio de mas").toBe(true);
  }, 60_000);

  it("se detiene si hay objeto en los dos extremos", async () => {
    const ruta = await documentoParaRetirar();
    const id = crypto.randomUUID();
    const destino = `cuarentena/${id}/ambiguo.png`;
    await admin.from("retiros_clinicos").insert({
      id,
      path_original: ruta,
      path_cuarentena: destino,
      motivo: MOTIVO,
      responsable: "Dra. Fedra Aldama",
    });
    // Una copia en el destino sin que el origen se haya retirado: el script no
    // puede saber cuál de los dos es el bueno, y adivinar sería peor que parar.
    await admin.storage.from("archivos").upload(destino, PNG_1X1, { contentType: "image/png" });

    const corrida = correrRetiro(ruta);
    expect(corrida.ok, "el script siguio adelante con un estado ambiguo").toBe(false);
    expect(corrida.salida).toContain("a mano");

    const retiros = await retiroDe(ruta);
    expect(retiros[0].movido_en, "sello un retiro que no pudo completar").toBeNull();
    expect(await existeObjeto(ruta), "borro el objeto original en un estado ambiguo").toBe(true);
  }, 60_000);

  it("no retira dos veces la misma ruta", async () => {
    const ruta = await documentoParaRetirar();
    expect(correrRetiro(ruta).ok).toBe(true);

    const segunda = correrRetiro(ruta);
    expect(segunda.ok, "el script acepto retirar dos veces el mismo documento").toBe(false);
    expect(segunda.salida).toContain("ya se retiró");

    expect(await retiroDe(ruta), "quedo mas de un retiro para la misma ruta").toHaveLength(1);
  }, 60_000);

  it("la base tampoco admite dos retiros de la misma ruta", async () => {
    const ruta = `inbody/${manifiesto.pacienteId}/${crypto.randomUUID()}.png`;
    const primero = crypto.randomUUID();
    const segundo = crypto.randomUUID();

    const uno = await admin.from("retiros_clinicos").insert({
      id: primero,
      path_original: ruta,
      path_cuarentena: `cuarentena/${primero}/uno.png`,
      motivo: MOTIVO,
      responsable: "Dra. Fedra Aldama",
    });
    expect(uno.error).toBeNull();

    // El script ya lo impide, pero el candado no puede vivir sólo en el script:
    // dos filas para el mismo objeto serían dos motivos distintos para el mismo
    // hecho, y ninguno de los dos sería la explicación.
    const dos = await admin.from("retiros_clinicos").insert({
      id: segundo,
      path_original: ruta,
      path_cuarentena: `cuarentena/${segundo}/dos.png`,
      motivo: MOTIVO,
      responsable: "Dra. Fedra Aldama",
    });
    expect(dos.error, "la base acepto dos retiros de la misma ruta").not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Los privilegios de ejecución, vistos desde la API (H-035)
//
// `supabase/tests/privilegios-funciones.sql` los mide contra el catálogo. Esto
// los mide por donde entra un extraño. Las dos pruebas van juntas a propósito:
// sola, la primera pasaría también si la función no estuviera expuesta, que es
// pasar por la razón equivocada.
// ---------------------------------------------------------------------------
describe("la llave anónima no ejecuta funciones privilegiadas", () => {
  it("current_rol() le está negada", async () => {
    const { data, error } = await clienteAnonimo().rpc("current_rol");
    expect(error, "la llave anonima ejecuto current_rol()").not.toBeNull();
    expect(data).toBeNull();
  });

  it("y una sesión con rol sí la ejecuta", async () => {
    const { data, error } = await clientes.doctora.rpc("current_rol");
    expect(error, "una sesion legitima no pudo ejecutar current_rol()").toBeNull();
    expect(data).toBe("doctora");
  });
});
