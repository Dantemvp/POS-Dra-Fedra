import test from "node:test";
import assert from "node:assert/strict";
import { fechaCorte, filasPagosCorte } from "../src/lib/corte-exportacion.ts";

test("fecha del corte conserva el día local de una venta vespertina", () => {
  assert.equal(fechaCorte("2026-10-09T02:30:00Z"), "2026-10-08 19:30:00");
});
test("CSV desglosa pagos mixtos sin duplicar el total", () => {
  const filas = filasPagosCorte([{ tipo: "Cobro", referencia: "SINTETICO", fecha: "2026-10-09T02:30:00Z",
    cliente: "PRUEBA", total: 200, pagos: [{ metodo: "efectivo", monto: 70 }, { metodo: "tarjeta", monto: 130 }] }]);
  assert.equal(filas.length, 2);
  assert.deepEqual(filas.map(f => f.slice(4)), [[200,"efectivo",70],["","tarjeta",130]]);
});
test("pago sin desglose no inventa un método ni un importe", () => {
  assert.deepEqual(filasPagosCorte([{ tipo: "Venta", referencia: 1, fecha: "2026-10-09T02:30:00Z",
    cliente: "PRUEBA", total: 200, pagos: [] }])[0].slice(4), [200,"Sin desglose registrado",""]);
});
