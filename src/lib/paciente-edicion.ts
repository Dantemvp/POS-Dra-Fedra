export function puedeEditarPaciente(rol: unknown): boolean {
  return typeof rol === "string" && ["admin", "doctora", "asistente", "gerente"].includes(rol);
}

export function validarEdicionPaciente(entrada: Record<string, unknown>) {
  const nombre = typeof entrada.nombre === "string" ? entrada.nombre.trim() : "";
  const apellidos = typeof entrada.apellidos === "string" ? entrada.apellidos.trim() : "";
  const telefono = typeof entrada.telefono_wpp === "string" ? entrada.telefono_wpp.trim() : "";
  if (!nombre || nombre.length > 150 || apellidos.length > 200) {
    return { ok: false as const, error: "Revisa el nombre y los apellidos del paciente." };
  }
  if (telefono && (!/^[+\d\s()-]+$/.test(telefono) || !/^\d{10,15}$/.test(telefono.replace(/\D/g, "")))) {
    return { ok: false as const, error: "Escribe un WhatsApp de 10 a 15 dígitos, o déjalo vacío." };
  }
  return { ok: true as const, datos: { nombre, apellidos: apellidos || null, telefono_wpp: telefono.replace(/\D/g, "") || null } };
}
