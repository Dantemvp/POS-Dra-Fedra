import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { leerCajaDia } from '@/lib/caja-lectura';
import { METODOS_CORTE } from '@/lib/corte-resumen';
import { fechaSinaloa } from '@/lib/tz';

const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
export default async function ResumenAreasPage() {
  const usuario = await getUsuarioActual();
  if (!usuario || !['admin', 'gerente', 'doctora'].includes(usuario.rol)) redirect('/dashboard');
  let resumen;
  try { resumen = await leerCajaDia(); }
  catch (e) { return <p role="alert" className="text-red-700">{e instanceof Error ? e.message : 'No se pudo comprobar el resumen.'}</p>; }
  return <div className="mx-auto max-w-4xl space-y-5 text-zinc-900">
      <h1 className="text-2xl font-semibold">Resumen de ambas áreas</h1>
      <p className="text-sm text-zinc-600">{fechaSinaloa(resumen.cierre)}. Solo consulta: suma las operaciones del día, no los cortes guardados. No registra otro cierre ni otro efectivo contado.</p>
      <div className="grid gap-4 sm:grid-cols-2">{[['Farmacia', resumen.totalVentas, '/caja'], ['Consultorio', resumen.totalCobros, '/cobros/corte']].map(([nombre, total, href]) =>
        <section key={nombre} className="rounded-xl bg-white p-5 ring-1 ring-zinc-200"><h2 className="font-semibold">{nombre}</h2><p className="my-3 text-2xl font-bold">{dinero(Number(total))}</p><Link className="fedra-accent underline" href={usuario.rol === 'doctora' && nombre === 'Farmacia' ? '/cortes' : String(href)}>{usuario.rol === 'doctora' && nombre === 'Farmacia' ? 'Ver cortes guardados' : 'Ver caja del área'}</Link></section>)}
      </div>
      <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-200"><p className="text-xl font-bold">Total: {dinero(resumen.totalVentas + resumen.totalCobros)}</p>
        {Object.entries(resumen.desglose).map(([m, n]) => <p className="mt-2 flex justify-between" key={m}><span>{METODOS_CORTE[m] ?? m}</span><span>{dinero(n)}</span></p>)}
        <p className="mt-4 text-sm text-zinc-600">No incluye fondo inicial ni retiros. No uses este total para volver a contar los cierres de cada área.</p>
      </section>
      {resumen.diferenciaPagos !== 0 && <p role="alert" className="text-red-700">Hay pagos pendientes de conciliación.</p>}
    </div>;
}
