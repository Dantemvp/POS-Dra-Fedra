"use client";

import { useEffect, useRef } from "react";

/** Imprime una vez después de montar el comprobante y cargar sus recursos. */
export default function AutoPrint() {
  const iniciado = useRef(false);
  useEffect(() => {
    let cancelado = false;
    const preparar = async () => {
      await document.fonts.ready;
      const imagenes = Array.from(document.querySelectorAll<HTMLImageElement>(".print-area img"));
      await Promise.all(imagenes.map((imagen) => imagen.decode().catch(() => undefined)));
      if (cancelado || iniciado.current) return;
      iniciado.current = true;
      window.print();
    };
    void preparar();
    return () => { cancelado = true; };
  }, []);
  return null;
}
