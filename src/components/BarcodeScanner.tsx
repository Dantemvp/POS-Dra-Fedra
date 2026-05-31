"use client";

import { useEffect, useRef, useState } from "react";

// BarcodeDetector no está en los tipos estándar de TS; lo declaramos mínimo.
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorCtor = new (opts?: {
  formats?: string[];
}) => BarcodeDetectorLike;

export default function BarcodeScanner({
  onDetect,
  onClose,
}: {
  onDetect: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelado = false;

    async function iniciar() {
      const Ctor = (
        window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
      ).BarcodeDetector;
      if (!Ctor) {
        setError(
          "Este navegador no soporta el escáner. Usa Chrome en una tablet/celular, o escribe el código a mano.",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        setError("No se pudo acceder a la cámara. Revisa los permisos.");
        return;
      }
      if (cancelado) return;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const detector = new Ctor({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"],
      });

      const tick = async () => {
        if (cancelado || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && codes[0].rawValue) {
            onDetect(codes[0].rawValue);
            return; // detener al primer hallazgo
          }
        } catch {
          // ignorar frames sin lectura
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    iniciar();
    return () => {
      cancelado = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetect]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium text-zinc-900">Escanear código</h3>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            Cerrar
          </button>
        </div>
        {error ? (
          <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
            {error}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              className="h-64 w-full object-cover"
              muted
              playsInline
            />
          </div>
        )}
        <p className="mt-2 text-center text-xs text-zinc-400">
          Apunta la cámara al código de barras del producto.
        </p>
      </div>
    </div>
  );
}
