type Operacion = {
  tipo: string;
  referencia: string | number;
  fecha: string;
  cliente: string;
  total: number;
  pagos: { metodo: string; monto: number }[];
};

export function fechaCorte(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Mazatlan", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(new Date(iso));
}

/** El total aparece una vez; cada pago conserva su importe para conciliar. */
export function filasPagosCorte(operaciones: Operacion[]): (string | number)[][] {
  return operaciones.flatMap((o) => {
    const pagos = o.pagos.length ? o.pagos : [{ metodo: "Sin desglose registrado", monto: "" }];
    return pagos.map((p, i) => [o.tipo, o.referencia, fechaCorte(o.fecha), o.cliente,
      i === 0 ? o.total : "", p.metodo, p.monto]);
  });
}
