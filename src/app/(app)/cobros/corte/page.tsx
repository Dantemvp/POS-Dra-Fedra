import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { leerCajaDia, leerUltimoCortePropio } from '@/lib/caja-lectura';
import { puedeCerrarArea } from '@/lib/corte-resumen';
import { fechaSinaloa } from '@/lib/tz';
import CorteDelDia from '../../caja/CorteDelDia';

export default async function CajaConsultorioPage() {
  const usuario = await getUsuarioActual();
  if (!usuario || !['admin', 'gerente', 'doctora', 'asistente'].includes(usuario.rol)) redirect('/dashboard');
  const puedeCerrar = puedeCerrarArea(usuario.rol, 'consultorio');
  let resumen;
  try { resumen = await leerCajaDia(new Date(), 'consultorio'); }
  catch (e) { return <p role="alert" className="text-red-700">{e instanceof Error ? e.message : 'No se pudo comprobar Consultorio.'}</p>; }
  const ultimoCorte = puedeCerrar ? await leerUltimoCortePropio(usuario.nombre, 'consultorio') : null;
  return <div className="mx-auto max-w-5xl space-y-5">
      <div className="print:hidden"><h1 className="text-2xl font-semibold text-zinc-900">Caja de Consultorio</h1>
        <p className="mt-2 text-sm text-zinc-600">Solo consultas y servicios. No incluye las ventas de Farmacia.</p></div>
      {resumen.diferenciaPagos !== 0 && <p role="alert" className="print:hidden text-red-700">Los pagos no cuadran con los cobros. Revisa antes de cerrar.</p>}
      <CorteDelDia {...resumen} fecha={fechaSinaloa(resumen.cierre)} responsable={usuario.nombre} ultimoCorte={ultimoCorte} area="consultorio" puedeCerrar={puedeCerrar} />
    </div>;
}
