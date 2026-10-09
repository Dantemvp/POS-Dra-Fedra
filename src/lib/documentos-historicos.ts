export function puedeLeerDocumentoHistorico(rol: string | null | undefined): boolean {
  return typeof rol === "string" && ["admin", "doctora", "asistente", "gerente"].includes(rol);
}
