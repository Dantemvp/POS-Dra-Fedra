"use client";

import { useEffect, useRef } from "react";

/** Imprime una vez después de montar el comprobante y cargar sus recursos. */
export default function AutoPrint({ consumirSolicitud = false }: { consumirSolicitud?: boolean }) {
  const iniciado = useRef(false);
  useEffect(() => {
    let cancelado = false;
    const preparar = async () => {
      await document.fonts.ready;
      const imagenes = Array.from(document.querySelectorAll<HTMLImageElement>(".print-area img"));
      await Promise.all(imagenes.map((imagen) => imagen.decode().catch(() => undefined)));
      if (cancelado || iniciado.current) return;
      iniciado.current = true;
      if (consumirSolicitud) {
        const url = new URL(window.location.href);
        url.searchParams.delete("imprimir");
        window.history.replaceState(window.history.state, "", url.href);
      }
      window.print();
    };
    void preparar();
    return () => { cancelado = true; };
  }, [consumirSolicitud]);
  return null;
}
