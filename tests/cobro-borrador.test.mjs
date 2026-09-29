import test from "node:test";
import assert from "node:assert/strict";
import {
  COBRO_BORRADOR_KEY,
  borrarCobroBorrador,
  leerCobroBorrador,
  tieneContenidoCobro,
} from "../src/lib/cobro-borrador.ts";

const valido = {
  version: 1,
  paciente_id: "paciente-1",
  metodo: "transferencia",
  nota: "Anticipo",
  items: [{
    tipo: "servicio",
    servicio_id: "servicio-1",
    producto_id: null,
    descripcion: "Consulta presencial",
    cantidad: 1,
    precio_unit: 200,
  }],
};

test("restaura un cobro pendiente válido sin recalcular importes", () => {
  const borrador = leerCobroBorrador(JSON.stringify(valido));
  assert.deepEqual(borrador, valido);
  assert.equal(tieneContenidoCobro(borrador), true);
});

test("rechaza borradores corruptos, negativos o de otra versión", () => {
  assert.equal(leerCobroBorrador("no-json"), null);
  assert.equal(leerCobroBorrador(JSON.stringify({ ...valido, version: 2 })), null);
  assert.equal(leerCobroBorrador(JSON.stringify({
    ...valido,
    items: [{ ...valido.items[0], precio_unit: -1 }],
  })), null);
});

test("un formulario vacío no se conserva", () => {
  assert.equal(tieneContenidoCobro({
    version: 1,
    paciente_id: "",
    metodo: "transferencia",
    nota: "",
    items: [],
  }), false);
});

test("cerrar sesión elimina el borrador sin bloquear si storage falla", () => {
  let clave = "";
  borrarCobroBorrador(() => ({ removeItem: (valor) => { clave = valor; } }));
  assert.equal(clave, COBRO_BORRADOR_KEY);
  assert.doesNotThrow(() => borrarCobroBorrador(() => ({
    removeItem: () => { throw new Error("bloqueado"); },
  })));
});

test("tolera SecurityError al intentar obtener sessionStorage", () => {
  assert.doesNotThrow(() => borrarCobroBorrador(() => {
    const error = new Error("Access is denied for this document");
    error.name = "SecurityError";
    throw error;
  }));
});
