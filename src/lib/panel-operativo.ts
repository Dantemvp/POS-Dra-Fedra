import { diaAgenda, proximasAgenda, type CitaCalendario } from './agenda-vista';
import { numeroWhatsApp } from './agenda-whatsapp';

export type AvisoPanel = { id: string; area: 'consultorio' | 'farmacia' | 'sistema'; nivel: 'urgente' | 'pendiente' | 'info'; titulo: string; detalle: string; href: string; cantidad: number };
export type StockPanel = { bajo: number; vencido: number; porCaducar: number; sinCodigo: number; sinPrecio: number };
export type PanelDatos = {
  actualizado: string; citas: CitaCalendario[]; sesion?: string;
  stock?: StockPanel;
  caja?: { sinCorte: number; ultimaDiferencia: number | null; href: string };
};
export function avisosPanel(datos: PanelDatos, ahora = new Date()): AvisoPanel[] {
  const avisos: AvisoPanel[] = [];
  const agregar = (id: string, area: AvisoPanel['area'], nivel: AvisoPanel['nivel'], titulo: string, detalle: string, href: string, cantidad: number) => {
    if (cantidad > 0) avisos.push({ id, area, nivel, titulo, detalle, href, cantidad });
  };
  const proximas = proximasAgenda(datos.citas, ahora);
  const hoy = diaAgenda(ahora.toISOString());
  const sinTelefono = proximas.reduce((n, c) => n + (c.origen === 'google'
    ? (c.contactos_google ?? []).filter(p => !numeroWhatsApp(p.telefono ?? '')).length
    : c.tipo === 'cita_paciente' && !numeroWhatsApp(c.telefono_wpp ?? '') ? 1 : 0), 0);
  agregar('agenda-hoy', 'consultorio', 'info', 'Citas próximas de hoy', 'Google y POS, en hora de Sinaloa.', '/agenda', proximas.filter(c => diaAgenda(c.fecha_hora) === hoy).length);
  agregar('agenda-confirmar', 'consultorio', 'pendiente', 'Citas del POS por confirmar', 'Google no informa si el paciente confirmó asistencia.', '/agenda', proximas.filter(c => c.origen !== 'google' && c.tipo === 'cita_paciente' && c.estado === 'agendada').length);
  agregar('agenda-telefono', 'consultorio', 'pendiente', 'Contactos sin WhatsApp', 'Completa el número para preparar el recordatorio de los próximos 7 días.', '/agenda', sinTelefono);
  if (datos.stock) {
    const s = datos.stock;
    agregar('stock-vencido', 'farmacia', 'urgente', 'Lotes vencidos con existencia', 'Revisar y separar físicamente antes de vender.', '/inventario', s.vencido);
    agregar('stock-bajo', 'farmacia', 'pendiente', 'Productos con stock bajo', 'Existencia igual o menor al mínimo configurado.', '/inventario', s.bajo);
    agregar('stock-caducidad', 'farmacia', 'pendiente', 'Lotes por caducar', 'Con existencia y caducidad en los próximos 30 días.', '/inventario', s.porCaducar);
    agregar('stock-codigo', 'farmacia', 'pendiente', 'Productos sin código', 'Con existencia, pero sin código para el lector.', '/inventario', s.sinCodigo);
    agregar('stock-precio', 'farmacia', 'pendiente', 'Productos sin precio', 'Con existencia y precio de venta cero o vacío.', '/inventario', s.sinPrecio);
  }
  if (datos.caja) {
    agregar('caja-abierta', 'sistema', 'pendiente', 'Actividad después del último corte', 'Revisa el cierre antes de terminar el día. Abrir este aviso no cierra la caja.', datos.caja.href, datos.caja.sinCorte);
    agregar('caja-diferencia', 'sistema', 'urgente', 'Diferencia en el último corte', 'El contado no coincide con el efectivo esperado registrado.', datos.caja.href, datos.caja.ultimaDiferencia ? 1 : 0);
  }
  const orden = { urgente: 0, pendiente: 1, info: 2 };
  return avisos.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

export function stockPanel(productos: { precio_venta: number; codigo_barras: string | null; stock_minimo: number; lotes: { cantidad_actual: number; caducidad: string | null }[] }[], ahora = new Date()): StockPanel {
  const s = { bajo: 0, vencido: 0, porCaducar: 0, sinCodigo: 0, sinPrecio: 0 };
  const hoy = diaAgenda(ahora.toISOString());
  const limite = diaAgenda(new Date(ahora.getTime() + 30 * 86400000).toISOString());
  for (const p of productos) {
    const cantidad = (p.lotes ?? []).reduce((n, l) => n + Number(l.cantidad_actual), 0);
    if (Number(p.stock_minimo) > 0 && cantidad <= Number(p.stock_minimo)) s.bajo++;
    if (cantidad > 0 && !p.codigo_barras?.trim()) s.sinCodigo++;
    if (cantidad > 0 && !(Number(p.precio_venta) > 0)) s.sinPrecio++;
    for (const l of p.lotes ?? []) if (Number(l.cantidad_actual) > 0 && l.caducidad) {
      if (l.caducidad < hoy) s.vencido++;
      else if (l.caducidad <= limite) s.porCaducar++;
    }
  }
  return s;
}
