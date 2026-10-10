import { NextResponse } from 'next/server';
import { leerMesGoogle, perfilCalendario } from '@/lib/google-calendario-servidor';

export const maxDuration = 60;
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!await perfilCalendario()) return NextResponse.json({ error: 'Sin permiso para consultar la agenda.' }, { status: 403, headers });
  const mes = new URL(request.url).searchParams.get('mes') ?? '';
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(mes)) return NextResponse.json({ error: 'Selecciona un mes válido.' }, { status: 400, headers });
  try {
    return NextResponse.json(await leerMesGoogle(mes), { headers });
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar Google. Reintenta o vuelve a conectar la cuenta. Las citas del POS siguen disponibles.' }, { status: 502, headers });
  }
}
