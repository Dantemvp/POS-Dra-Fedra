import type { Metadata } from "next";
import CuestionarioHistoria from "./CuestionarioHistoria";
import { createAdminClient } from "@/lib/supabase/admin";
import { prepararCamposHistoria, type CampoHistoria } from "@/lib/historia-campos";
import { crearCamposRemotos } from "@/lib/historia-remota";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preguntas para tu consulta | Dra. Fedra Aldama",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function FormularioHistoria() {
  // Solo la definición de preguntas. Nunca consultar pacientes o historias en
  // esta ruta pública ni entregar UUID internos al navegador del paciente.
  let campos: CampoHistoria[] | null = null;
  try {
    const { data, error } = await createAdminClient().from("tipos_historia")
      .select("campos_historia(id, etiqueta, tipo_dato, opciones, orden, requerido, seccion, oculto, depende_de, depende_valor, solo_sexo)")
      .eq("nombre", "Historia Clínica (NOM-004)").eq("activo", true).single();
    if (error || !data?.campos_historia?.length) throw new Error("Plantilla no disponible");
    campos = crearCamposRemotos(prepararCamposHistoria((data.campos_historia as CampoHistoria[]).sort((a,b) => a.orden-b.orden)));
  } catch { /* La pantalla comunica indisponibilidad sin exponer errores internos. */ }
  if (!campos) {
    return <main className="mx-auto max-w-xl p-6"><h1 className="text-xl font-semibold">Formulario no disponible</h1><p className="mt-3">Pide ayuda al consultorio por tu conversación de WhatsApp para responder las preguntas.</p></main>;
  }
  return <CuestionarioHistoria campos={campos} />;
}
