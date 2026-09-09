"use server";

import { revalidatePath } from "next/cache";
import {
  INBODY_OPENAI_MODEL,
  INBODY_RESPONSE_FORMAT,
  parsearRespuestaInBody,
  validarArchivoInBody,
  type InBodyDatos,
} from "@/lib/inbody";
import { createClient } from "@/lib/supabase/server";

export type Result = { ok: boolean; error?: string; id?: string };

// Marca/desmarca si el paciente ya dejó reseña en Google Maps.
export async function marcarReviewGoogle(
  pacienteId: string,
  valor: boolean,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pacientes")
    .update({ review_google: valor })
    .eq("id", pacienteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/pacientes/${pacienteId}`);
  return { ok: true };
}

async function usuarioId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("usuarios")
    .select("id")
    .eq("auth_uid", user.id)
    .single();
  return data?.id ?? null;
}

export async function crearPaciente(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const supabase = await createClient();
  const uid = await usuarioId(supabase);

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };

  // COFEPRIS exige domicilio para vender medicamento controlado.
  const direccion = String(formData.get("direccion") ?? "").trim();
  if (!direccion) return { ok: false, error: "La dirección es obligatoria." };

  const { data, error } = await supabase
    .from("pacientes")
    .insert({
      nombre,
      apellidos: String(formData.get("apellidos") ?? "").trim() || null,
      fecha_nac: String(formData.get("fecha_nac") ?? "") || null,
      sexo: String(formData.get("sexo") ?? "") || null,
      telefono_wpp: String(formData.get("telefono_wpp") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      direccion,
      creado_por: uid,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/pacientes");
  return { ok: true, id: data.id };
}

export async function crearHistoria(
  pacienteId: string,
  tipoHistoriaId: string,
  datos: Record<string, unknown>,
): Promise<Result> {
  const supabase = await createClient();
  const uid = await usuarioId(supabase);

  const { error } = await supabase.from("historias_clinicas").insert({
    paciente_id: pacienteId,
    tipo_historia_id: tipoHistoriaId,
    datos,
    doctora_id: uid,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/pacientes/${pacienteId}`);
  return { ok: true };
}

// Actualiza los datos de una historia clínica ya guardada (edición).
export async function actualizarHistoria(
  historiaId: string,
  datos: Record<string, unknown>,
  pacienteId: string,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("historias_clinicas")
    .update({ datos })
    .eq("id", historiaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/pacientes/${pacienteId}`);
  return { ok: true };
}

// Elimina una historia clínica. SOLO admin (acción destructiva).
export async function eliminarHistoria(
  historiaId: string,
  pacienteId: string,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sin sesión." };

  const { data: u } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("auth_uid", user.id)
    .single();
  if (u?.rol !== "admin")
    return { ok: false, error: "Solo el administrador puede eliminar." };

  const { error } = await supabase
    .from("historias_clinicas")
    .delete()
    .eq("id", historiaId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/pacientes/${pacienteId}`);
  return { ok: true };
}

// Deja la fila que liga el objeto de Storage con la paciente (FED-014, H-017).
//
// Hasta ahora la ruta del estudio se usaba para firmar la URL y leerlo, y se
// descartaba: ninguna fila de la base apuntaba a un objeto bajo `inbody/`, así
// que no se podía cotejar lo que interpretó el modelo contra lo que quedó en el
// expediente. Esta fila es también aquello a lo que se cuelga la bitácora.
//
// `sustituyeA` es el documento que esta corrección viene a corregir. El
// anterior se conserva: la tabla sólo admite alta.
//
// IDEMPOTENTE A PROPÓSITO. El navegador sube el objeto y después pide este
// registro, y entre las dos cosas se pierde una conexión, se cierra una laptop
// o expira una sesión. Como no hay política de borrado sobre `inbody/`, un
// objeto sin fila ya no lo retira nadie. Por eso registrar dos veces la misma
// ruta no falla ni duplica: devuelve el registro que ya existe, y el reintento
// desde la pantalla es seguro tantas veces como haga falta.
//
// `subido_por` no se manda. Lo pone el valor por omisión de la columna con la
// identidad real de la sesión, y la política rechaza cualquier otro valor. Un
// cliente adversario no firma un estudio con el nombre de alguien más.
export async function registrarDocumentoClinico(
  pacienteId: string,
  path: string,
  sustituyeA?: string,
): Promise<Result> {
  const supabase = await createClient();

  const yaRegistrado = await documentoDeRuta(supabase, path);
  if (yaRegistrado) {
    // La misma ruta apuntando a otra paciente sólo puede venir de un cliente
    // manipulado: la ruta lleva el id de la paciente adentro y la base lo
    // comprueba. Se avisa en vez de devolver un ok que no es cierto.
    if (yaRegistrado.paciente_id !== pacienteId) {
      return {
        ok: false,
        error: "Esa ruta ya está registrada para otra paciente.",
      };
    }
    return { ok: true, id: yaRegistrado.id };
  }

  const { data, error } = await supabase
    .from("documentos_clinicos")
    .insert({
      paciente_id: pacienteId,
      path,
      tipo: "inbody",
      sustituye_a: sustituyeA ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 es la unicidad de `path`: otro intento ganó la carrera entre la
    // consulta de arriba y esta escritura. El resultado que buscaba quien
    // llama ya existe, así que esto no es un error para la persona.
    if (error.code === "23505") {
      const fila = await documentoDeRuta(supabase, path);
      if (fila && fila.paciente_id === pacienteId) return { ok: true, id: fila.id };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data?.id };
}

async function documentoDeRuta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
): Promise<{ id: string; paciente_id: string } | null> {
  const { data } = await supabase
    .from("documentos_clinicos")
    .select("id, paciente_id")
    .eq("path", path)
    .maybeSingle();
  return data ?? null;
}

// Objetos bajo `inbody/` que quedaron sin fila. La vista los resuelve con los
// permisos de quien consulta, así que esta acción no concede nada nuevo: sirve
// para que un huérfano se pueda ver y adoptar desde la aplicación en vez de
// quedarse callado dentro del bucket.
export async function huerfanosDePaciente(
  pacienteId: string,
): Promise<{ ok: boolean; error?: string; paths?: string[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbody_huerfanos")
    .select("path")
    .eq("paciente_id", pacienteId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, paths: (data ?? []).map((fila) => fila.path as string) };
}

// URL firmada para ver un documento guardado (ej. foto del InBody).
export async function urlDocumento(
  path: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("archivos")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl)
    return { ok: false, error: error?.message ?? "No disponible." };
  return { ok: true, url: data.signedUrl };
}

export type { InBodyDatos } from "@/lib/inbody";

// Lee una foto de reporte InBody (ya subida al Storage) con OpenAI visión
// y devuelve las métricas extraídas. El usuario confirma antes de guardar.
export async function extraerInBody(
  path: string,
): Promise<{ ok: boolean; error?: string; datos?: InBodyDatos }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sin sesión." };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "Falta configurar OPENAI_API_KEY." };

  // Descargar la imagen y enviarla en base64 (más robusto que una URL)
  const { data: blob, error: dlErr } = await supabase.storage
    .from("archivos")
    .download(path);
  if (dlErr || !blob)
    return { ok: false, error: "No se pudo leer la imagen." };
  const archivoValido = validarArchivoInBody({ type: blob.type, size: blob.size });
  if (!archivoValido.ok) return archivoValido;
  const buffer = Buffer.from(await blob.arrayBuffer());
  const mime = blob.type;
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;

  const claves = `{"grasa_visceral_linea":null,"peso_kg":null,"masa_muscular_kg":null,"grasa_corporal_kg":null,"grasa_pct":null,"imc":null,"grasa_visceral":null,"tmb_kcal":null,"agua_total_l":null,"proteinas_kg":null,"minerales_kg":null,"masa_libre_grasa_kg":null,"relacion_cintura_cadera":null,"grado_obesidad_pct":null,"altura_cm":null,"edad":null,"puntuacion_inbody":null,"fecha_prueba":null}`;

  const reglas = `Reglas estrictas:
- REGLA CLAVE DE RANGOS: muchos valores aparecen con formato "VALOR ( min~max )", por ejemplo "7 ( 1~9 )". El dato correcto es SIEMPRE el número que está a la IZQUIERDA del paréntesis (el 7), NUNCA el mínimo ni el máximo de adentro del paréntesis (1 ni 9). Esto aplica a TODAS las métricas.
- "grasa_visceral_linea": transcribe textualmente la línea completa del "Nivel de Grasa Visceral" tal como se ve (incluyendo el paréntesis). Ejemplo: "7 ( 1~9 )".
- "grasa_visceral": el número a la IZQUIERDA del paréntesis en esa línea (en el ejemplo, 7). NUNCA pongas el máximo del rango.
- masa_muscular_kg = "Masa de Músculo Esquelético (MME)".
- grasa_pct = "PGC / Porcentaje de Grasa Corporal".
- Usa punto decimal. fecha_prueba como texto tal cual aparece. Si un dato no aparece, usa null. No inventes valores.`;

  const img = {
    type: "image_url",
    image_url: { url: dataUrl, detail: "high" },
  };

  async function llamar(
    messages: unknown[],
  ): Promise<{ ok: boolean; content?: string; error?: string }> {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          model: INBODY_OPENAI_MODEL,
          messages,
          response_format: INBODY_RESPONSE_FORMAT,
          max_tokens: 800,
          temperature: 0,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok)
        return { ok: false, error: j?.error?.message ?? "Error de OpenAI." };
      const content = j?.choices?.[0]?.message?.content;
      if (!content) return { ok: false, error: "Respuesta vacía de la IA." };
      return { ok: true, content };
    } catch (error) {
      const mensaje = error instanceof Error && error.name === "TimeoutError"
        ? "OpenAI tardó más de 45 segundos."
        : "No se pudo conectar con OpenAI.";
      return { ok: false, error: mensaje };
    }
  }

  try {
    // Pasada 1: extracción
    const p1 = await llamar([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extrae los datos de este reporte InBody. Devuelve SOLO JSON con estas claves:\n${claves}\n${reglas}`,
          },
          img,
        ],
      },
    ]);
    if (!p1.ok) return { ok: false, error: p1.error };

    // Pasada 2: corroboración — vuelve a mirar la imagen y corrige errores
    const p2 = await llamar([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Se extrajeron estos datos de la imagen del InBody:\n${p1.content}\nVuelve a revisar la imagen con cuidado, número por número, y CORRIGE cualquier valor equivocado (especialmente si se confundió un valor medido con su rango de referencia).\n${reglas}\nDevuelve SOLO el JSON final ya corregido.`,
          },
          img,
        ],
      },
    ]);

    if (!p2.ok || !p2.content) {
      return { ok: false, error: `La segunda verificación falló: ${p2.error ?? "sin respuesta"}` };
    }
    return parsearRespuestaInBody(p2.content);
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 160) };
  }
}
