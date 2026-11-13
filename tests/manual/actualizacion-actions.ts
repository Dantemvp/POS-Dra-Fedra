const registrar = (tipo: string, datos: unknown) => {
  const w = window as unknown as { __fedraPruebas: unknown[] };
  (w.__fedraPruebas ??= []).push({ tipo, datos });
  return { ok: true, id: 'ficticia' };
};
export const crearHistoria = async (...datos: unknown[]) => registrar('historia', datos);
export const actualizarHistoria = async (...datos: unknown[]) => registrar('editar', datos);
export const eliminarHistoria = async () => ({ ok: false, error: 'Sin borrado en demo' });
export const crearReceta = async (...datos: unknown[]) => registrar('receta', datos);
export const guardarReceta = async (...datos: unknown[]) => registrar('ajustes', datos);
export const ultimoInBody = async () => ({ ok: false, error: 'Sin servicios externos' });
export const extraerInBody = ultimoInBody;
export const listarIdentificaciones = async () => ({ ok: true, archivos: [] });
export const subirIdentificacion = async () => ({ ok: false, error: 'Demo sin almacenamiento real' });
export const abrirIdentificacion = async () => ({ ok: false, error: 'Demo sin archivos reales' });
