import test from "node:test";
import assert from "node:assert/strict";
import { subtotalCobro, totalCobro } from "../src/lib/cobro-total.ts";
test("cantidades fraccionarias redondean por renglón igual que Postgres", () => {
  assert.equal(subtotalCobro(1.5,33.33),50);
  assert.equal(totalCobro([{cantidad:1.5,precio_unit:33.33},{cantidad:1.5,precio_unit:33.33}]),100);
  assert.equal(subtotalCobro(1.01,0.5),0.51);
});
