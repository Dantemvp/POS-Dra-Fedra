import { NextResponse } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { stockPanel, type PanelDatos } from '@/lib/panel-operativo';
import { inicioDiaSinaloa } from '@/lib/tz';

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' };
  const u = await getUsuarioActual();
  if (!u || !['admin', 'doctora', 'asistente', 'gerente', 'farmacia'].includes(u.rol)) return NextResponse.json({ error: 'Sin permiso.' }, { status: 403, headers });
  const db = await createClient();
  const perfil = await db.from('usuarios').select('rol, activo').eq('auth_uid', u.authUid).single();
  if (perfil.error || perfil.data?.rol !== u.rol || perfil.data?.activo !== true) return NextResponse.json({ error: 'Sin perfil autorizado.' }, { status: 403, headers });
  const ahora = new Date();
  const desde = inicioDiaSinaloa(ahora).toISOString();
  const hasta = new Date(inicioDiaSinaloa(ahora).getTime() + 7 * 86400000).toISOString();
  const datos: PanelDatos = { actualizado: ahora.toISOString(), sesion: u.authUid, rol: u.rol, citas: [] };
  try {
    if (u.rol !== 'farmacia') {
      const res = await db.from('citas').select('id, fecha_hora, estado, tipo, titulo, notas, paciente:pacientes(id, nombre, apellidos, telefono_wpp)', { count: 'exact' })
        .gte('fecha_hora', desde).lt('fecha_hora', hasta).not('estado', 'in', '(cancelada,atendida,cedida)').order('fecha_hora').limit(501);
      if (res.error || (res.count ?? res.data?.length ?? 0) > 500) throw new Error('agenda');
      datos.citas = (res.data ?? []).map(c => ({ id: c.id, fecha_hora: c.fecha_hora, estado: c.estado, tipo: c.tipo, origen: 'pos',
        // La relación es muchos-a-uno; los tipos generados no están instalados.
        ...(() => { const p = c.paciente as unknown as { id: string; nombre: string; apellidos: string | null; telefono_wpp: string | null } | null;
          return { nombre: p ? `${p.nombre} ${p.apellidos ?? ''}`.trim() : c.titulo ?? 'Evento', paciente_id: p?.id ?? null, telefono_wpp: p?.telefono_wpp ?? null }; })(),
        descripcion: c.notas ?? undefined }));
    }
    if (['admin', 'gerente', 'farmacia'].includes(u.rol)) {
      const res = await db.from('productos').select('precio_venta, codigo_barras, stock_minimo, lotes(cantidad_actual, caducidad)', { count: 'exact' }).eq('activo', true).limit(1001);
      if (res.error || (res.count ?? res.data?.length ?? 0) > 1000) throw new Error('inventario');
      datos.stock = stockPanel(res.data ?? [], ahora);
    }
    if (['admin', 'gerente', 'farmacia', 'doctora'].includes(u.rol)) {
      const corte = await db.from('cortes_caja').select('id, cierre, diferencia').gte('cierre', desde).order('cierre', { ascending: false }).limit(1).maybeSingle();
      if (corte.error) throw new Error('cortes');
      const frontera = corte.data?.cierre ?? desde;
      let operaciones = 0;
      if (u.rol !== 'doctora') {
        const res = await db.from('ventas').select('id', { count: 'exact', head: true }).eq('estado', 'pagada').eq('es_historico', false).gt('fecha', frontera).lte('fecha', ahora.toISOString());
        if (res.error) throw new Error('ventas'); operaciones += res.count ?? 0;
      }
      if (u.rol !== 'farmacia') {
        const res = await db.from('cobros').select('id', { count: 'exact', head: true }).eq('estado', 'activo').gt('fecha', frontera).lte('fecha', ahora.toISOString());
        if (res.error) throw new Error('cobros'); operaciones += res.count ?? 0;
      }
      datos.caja = { sinCorte: operaciones, ultimaDiferencia: corte.data?.diferencia == null ? null : Number(corte.data.diferencia),
        href: u.rol === 'doctora' ? '/cortes' : '/caja' };
    }
    return NextResponse.json(datos, { headers });
  } catch {
    return NextResponse.json({ error: 'No se pudo comprobar el panel operativo. Los contadores pueden estar desactualizados.' }, { status: 503, headers });
  }
}
