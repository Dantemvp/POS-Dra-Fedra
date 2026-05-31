"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { registrarArchivo, eliminarArchivo } from "../actions";

export type ArchivoVista = {
  id: string;
  nombre: string;
  tipo: string;
  path: string;
  url: string;
};

function tipoDe(file: File): string {
  if (file.type.startsWith("image/")) return "imagen";
  if (file.type.startsWith("audio/")) return "audio";
  return "documento";
}

export default function Archivos({
  productoId,
  archivos,
}: {
  productoId: string;
  archivos: ArchivoVista[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSubiendo(true);
    const supabase = createClient();
    const path = `${productoId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("archivos")
      .upload(path, file);
    if (upErr) {
      setError(upErr.message);
      setSubiendo(false);
      return;
    }
    const res = await registrarArchivo(productoId, path, file.name, tipoDe(file));
    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!res.ok) {
      setError(res.error ?? "Error al registrar.");
      return;
    }
    router.refresh();
  }

  function borrar(a: ArchivoVista) {
    startTransition(async () => {
      await eliminarArchivo(a.id, a.path, productoId);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium text-zinc-900">Archivos del producto</h2>
        <label className="cursor-pointer rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800">
          {subiendo ? "Subiendo…" : "+ Subir archivo"}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={onArchivo}
            disabled={subiendo}
          />
        </label>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {archivos.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">
          Sin archivos. Sube fotos, fichas técnicas o notas de voz.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {archivos.map((a) => (
            <div
              key={a.id}
              className="group relative overflow-hidden rounded-lg ring-1 ring-zinc-200"
            >
              {a.tipo === "imagen" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt={a.nombre} className="h-28 w-full object-cover" />
              ) : a.tipo === "audio" ? (
                <div className="p-3">
                  <audio controls src={a.url} className="w-full" />
                  <p className="mt-1 truncate text-xs text-zinc-500">{a.nombre}</p>
                </div>
              ) : (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-28 flex-col items-center justify-center bg-zinc-50 p-2 text-center text-xs text-zinc-600 hover:bg-zinc-100"
                >
                  <span className="text-2xl">📄</span>
                  <span className="mt-1 line-clamp-2">{a.nombre}</span>
                </a>
              )}
              <button
                onClick={() => borrar(a)}
                className="absolute right-1 top-1 hidden rounded bg-white/90 px-1.5 py-0.5 text-xs text-red-600 ring-1 ring-zinc-200 group-hover:block"
              >
                Borrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
