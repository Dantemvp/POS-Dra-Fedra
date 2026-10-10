// Un request activo; la pestaña oculta no consulta.
export function iniciarRefrescoAgenda<T>({ consultar, recibir, fallar, cargando, documento, ventana, programar }: {
  consultar: (signal: AbortSignal) => Promise<T>;
  recibir: (datos: T) => void; fallar: (error: unknown) => void; cargando: (valor: boolean) => void;
  documento: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
  ventana: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  programar?: (accion: () => void, ms: number) => () => void;
}) {
  let cerrado = false;
  let enCurso: AbortController | null = null;
  async function actualizar() {
    if (cerrado || documento.visibilityState !== 'visible' || enCurso) return;
    const controller = new AbortController();
    enCurso = controller; cargando(true);
    try {
      const datos = await consultar(controller.signal);
      if (!cerrado && !controller.signal.aborted) recibir(datos);
    } catch (error) {
      if (!cerrado && !controller.signal.aborted) fallar(error);
    } finally {
      if (!cerrado && enCurso === controller) { enCurso = null; cargando(false); }
    }
  }
  function visibilidad() {
    if (documento.visibilityState === 'visible') void actualizar();
    else if (enCurso) { enCurso.abort(); enCurso = null; cargando(false); }
  }
  const cancelarIntervalo = (programar ?? ((accion, ms) => {
    const id = setInterval(accion, ms);
    return () => clearInterval(id);
  }))(() => { void actualizar(); }, 60_000);
  documento.addEventListener('visibilitychange', visibilidad);
  ventana.addEventListener('focus', visibilidad);
  ventana.addEventListener('online', visibilidad);
  void actualizar();
  return {
    actualizar,
    detener() {
      cerrado = true; enCurso?.abort(); cancelarIntervalo();
      documento.removeEventListener('visibilitychange', visibilidad);
      ventana.removeEventListener('focus', visibilidad);
      ventana.removeEventListener('online', visibilidad);
    },
  };
}
