import type { EventoGoogle } from './google-calendario-seguridad';
export type LecturaGoogle = { conectado: boolean; eventos: EventoGoogle[]; actualizado?: string };

// Memoria privada de un proveedor React, nunca localStorage ni caché de servidor.
// Une requests simultáneos y las lecturas de campana/agenda del mismo minuto.
export function crearLecturaGoogle(consultar: (mes: string) => Promise<LecturaGoogle>, reloj = Date.now) {
  const lecturas = new Map<string, { promesa: Promise<LecturaGoogle>; vence: number }>();
  return (mes: string) => {
    const anterior = lecturas.get(mes);
    if (anterior && anterior.vence > reloj()) return anterior.promesa;
    if (lecturas.size >= 4) lecturas.delete(lecturas.keys().next().value!);
    const registro = { promesa: Promise.resolve(null as unknown as LecturaGoogle), vence: Infinity };
    registro.promesa = consultar(mes).then(res => { registro.vence = reloj() + 5000; return res; }, error => { if (lecturas.get(mes) === registro) lecturas.delete(mes); throw error; });
    lecturas.set(mes, registro);
    return registro.promesa;
  };
}
