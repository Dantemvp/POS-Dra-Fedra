export default function CargandoArea() {
  return (
    <div className="mx-auto flex min-h-[45vh] max-w-6xl items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-xl bg-white/85 px-5 py-4 text-sm text-zinc-600 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#cbb89c] border-t-[#3f5148]" aria-hidden="true" />
        Cargando información…
      </div>
    </div>
  );
}
