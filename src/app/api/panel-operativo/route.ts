import { NextResponse } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { stockPanel, type PanelDatos } from '@/lib/panel-operativo';
import { inicioDiaSinaloa } from '@/lib/tz';
import { leerDesgloseCorte } from '@/lib/corte-resumen';

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
      const cortes = await db.from('cortes_caja').select('id, cierre, diferencia, desglose', { count: 'exact' }).gte('cierre', desde).order('cierre', { ascending: false }).limit(1001);
      if (cortes.error || (cortes.count ?? cortes.data?.length ?? 0) > 1000) throw new Error('cortes');
      const areas = u.rol === 'farmacia' ? ['farmacia'] as const : u.rol === 'doctora' ? ['consultorio'] as const : ['farmacia', 'consultorio'] as const;
      datos.cajas = [];
      for (const area of areas) {
        const corte = (cortes.data ?? []).find(c => {
          const alcance = leerDesgloseCorte(c.desglose);
          return alcance.area === area || (!alcance.area && alcance.consultorioIncluido === true);
        });
        const tabla = area === 'farmacia' ? 'ventas' : 'cobros';
        let consulta = db.from(tabla).select('id', { count: 'exact', head: true }).eq('estado', area === 'farmacia' ? 'pagada' : 'activo')
          .gt('fecha', corte?.cierre ?? desde).lte('fecha', ahora.toISOString());
        if (area === 'farmacia') consulta = consulta.eq('es_historico', false);
        const res = await consulta;
        if (res.error) throw new Error(tabla);
        datos.cajas.push({ area, sinCorte: res.count ?? 0, ultimaDiferencia: corte?.diferencia == null ? null : Number(corte.diferencia), href: area === 'farmacia' ? '/caja' : '/cobros/corte' });
      }
    }
    return NextResponse.json(datos, { headers });
  } catch {
    return NextResponse.json({ error: 'No se pudo comprobar el panel operativo. Los contadores pueden estar desactualizados.' }, { status: 503, headers });
  }
}
