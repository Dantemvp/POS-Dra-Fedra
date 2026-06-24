// Tipos de evento de la agenda. Módulo normal (NO "use server"): un archivo
// "use server" solo puede exportar funciones async, así que las constantes
// compartidas (cliente + servidor) viven aquí.
export const TIPOS_CITA = [
  { v: "cita_paciente", l: "Cita de paciente" },
  { v: "reunion", l: "Reunión" },
  { v: "trabajo", l: "Trabajo / Grabación" },
  { v: "interesado", l: "Interesado" },
  { v: "otro", l: "Otro" },
] as const;

export const TIPOS_CITA_VALORES = TIPOS_CITA.map((t) => t.v) as readonly string[];
