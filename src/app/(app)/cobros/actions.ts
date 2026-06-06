"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Result = { ok: boolean; error?: string; id?: string };

export type ItemCobro = {
  servicio_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unit: number;
};

export type CobroInput = {
  paciente_id: string;
  items: ItemCobro[];
  metodo: "efectivo" | "tarjeta" | "transferencia" | "otro";
  monto: number; // recibido
  nota?: string;
};

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

export async function crearCobro(input: CobroInput): Promise<Result> {
  if (!input.paciente_id) return { ok: false, error: "Selecciona un paciente." };
  const items = (input.items ?? []).filter(
    (i) => (i.descripcion || i.servicio_id) && i.precio_unit >= 0,
  );
  if (items.length === 0)
    return { ok: false, error: "Agrega al menos un servicio." };

  const supabase = await createClient();
  const uid = await usuarioId(supabase);
  const total = items.reduce(
    (s, i) => s + (i.precio_unit || 0) * (i.cantidad || 1),
    0,
  );

  const { data: cobro, error: e1 } = await supabase
    .from("cobros")
    .insert({
      paciente_id: input.paciente_id,
      total,
      nota: input.nota || null,
      doctora_id: uid,
    })
    .select("id")
    .single();
  if (e1 || !cobro) return { ok: false, error: e1?.message ?? "Error al crear cobro." };

  const { error: e2 } = await supabase.from("cobro_items").insert(
    items.map((i) => ({
      cobro_id: cobro.id,
      servicio_id: i.servicio_id,
      descripcion: i.descripcion || null,
      cantidad: i.cantidad || 1,
      precio_unit: i.precio_unit || 0,
      subtotal: (i.precio_unit || 0) * (i.cantidad || 1),
    })),
  );
  if (e2) return { ok: false, error: e2.message };

  if (input.monto > 0) {
    const { error: e3 } = await supabase.from("cobro_pagos").insert({
      cobro_id: cobro.id,
      monto: input.monto,
      metodo: input.metodo,
    });
    if (e3) return { ok: false, error: e3.message };
  }

  revalidatePath("/cobros");
  revalidatePath("/dashboard");
  return { ok: true, id: cobro.id };
}
