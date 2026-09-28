import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FISCAL_FARMACIA,
  GOOGLE_REVIEW_URL,
  leyendaFacturacion,
} from "../src/lib/fiscal.ts";

test("el ticket conserva los datos fiscales del emisor", () => {
  assert.equal(FISCAL_FARMACIA.rfc, "AACF921225L23");
  assert.ok(FISCAL_FARMACIA.razonSocial);
  assert.ok(FISCAL_FARMACIA.regimen);
  assert.ok(FISCAL_FARMACIA.cp);
});

test("la invitación usa el enlace directo de reseña de la farmacia", () => {
  assert.equal(GOOGLE_REVIEW_URL, "https://g.page/r/CWoJbgnS1y-NEBM/review");
});

test("la facturación pide los datos necesarios sin exigir la constancia", () => {
  const leyenda = leyendaFacturacion();
  assert.match(leyenda, /RFC/);
  assert.match(leyenda, /código postal/i);
  assert.match(leyenda, /uso fiscal/i);
  assert.doesNotMatch(leyenda, /Constancia de Situación Fiscal/i);
});

test("el ticket térmico fuerza negro puro y alto contraste", () => {
  const componente = readFileSync(
    new URL("../src/app/(app)/ventas/pos.tsx", import.meta.url),
    "utf8",
  );
  const estilos = readFileSync(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(componente, /ticket-thermal-strong/);
  assert.match(componente, /fgColor="#000000"/);
  assert.match(componente, /bgColor="#ffffff"/);
  assert.match(estilos, /\.ticket-print\.ticket-thermal-strong[\s\S]*color: #000 !important/);
  assert.match(estilos, /filter: grayscale\(1\) contrast\(2\.4\)/);
});
