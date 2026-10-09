import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";

export default async function DocumentoHistorico({params}: {
  params: Promise<{id: string; documentoId: string}>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario || !["admin","doctora","asistente","gerente"].includes(usuario.rol)) notFound();
  const {id,documentoId} = await params;
  const supabase = await createClient();
  const {data: documento} = await supabase.from("archivos_paciente_historicos")
    .select("storage_path").eq("id",documentoId).eq("paciente_id",id).single();
  if (!documento) notFound();
  const {data,error} = await supabase.storage.from("historicos-clinicos")
    .createSignedUrl(documento.storage_path,60);
  if (error || !data?.signedUrl) throw new Error("No se pudo abrir el documento histórico. Intenta de nuevo.");
  redirect(data.signedUrl);
}
