"use client";

import { useRef, useState } from "react";
import BarcodeScanner from "./BarcodeScanner";

// Entrada de código de barras universal:
//  - Lector físico "BIP" (USB/Bluetooth) → teclea el código + Enter en el input.
//  - Cámara (BarcodeDetector) como respaldo en tablet/celular.
// En ambos casos emite onScan(codigo).
export default function BarcodeInput({
  onScan,
  placeholder = "Escanea o escribe el código…",
  autoFocus = true,
}: {
  onScan: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [valor, setValor] = useState("");
  const [scanner, setScanner] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function emitir(code: string) {
    const c = code.trim();
    if (!c) return;
    onScan(c);
    setValor("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex gap-2">
      {scanner && (
        <BarcodeScanner
          onDetect={(c) => {
            setScanner(false);
            emitir(c);
          }}
          onClose={() => setScanner(false)}
        />
      )}
      <input
        ref={inputRef}
        value={valor}
        autoFocus={autoFocus}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            emitir(valor);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
        inputMode="text"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setScanner(true)}
        className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        title="Escanear con cámara"
      >
        📷
      </button>
    </div>
  );
}
