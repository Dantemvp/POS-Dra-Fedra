// Reglas de captura de la historia clínica, probadas contra la plantilla real
// que deja la migración 044, no contra campos inventados.
import test from "node:test";
import assert from "node:assert/strict";
import {
  aplicaPorSexo,
  calcularImcHistoria,
  campoVisible,
  sexoNormalizado,
  valoresParaGuardar,
  NO_APLICA,
} from "../src/lib/historia-campos.ts";
import { baseConPlantilla, camposDeLaPlantilla, leerMigracion } from "./fixtures/nom004.mjs";

async function plantillaAplicada() {
  const db = await baseConPlantilla();
  await db.exec(leerMigracion("20260915000044_hc_captura_rapida.sql"));
  return camposDeLaPlantilla(db);
}

const por = (campos, etiqueta) => {
  const campo = campos.find((c) => c.etiqueta === etiqueta);
  assert.ok(campo, `la plantilla debería traer "${etiqueta}"`);
  return campo;
};

test("paciente hombre: los 8 ginecoobstétricos se guardan como No aplica", async () => {
  const campos = await plantillaAplicada();
  const gineco = campos.filter((c) => c.seccion === "IV. Ginecoobstétricos");
  assert.equal(gineco.length, 8);

  for (const campo of gineco) {
    assert.equal(campoVisible(campo, {}, "M"), false, `${campo.etiqueta} no se le pregunta a un hombre`);
  }

  const guardado = valoresParaGuardar(campos, {}, "M");
  for (const campo of gineco) {
    assert.equal(guardado[campo.id], NO_APLICA, `${campo.etiqueta} queda como "${NO_APLICA}"`);
  }
  assert.equal(
    Object.values(guardado).filter((v) => v === NO_APLICA).length,
    8,
    "solo esos ocho, nada más se marca",
  );
});

test("paciente mujer: los ginecoobstétricos se preguntan y se conservan", async () => {
  const campos = await plantillaAplicada();
  const menarca = por(campos, "Menarca (edad)");

  assert.equal(campoVisible(menarca, {}, "F"), true);
  assert.equal(valoresParaGuardar(campos, { [menarca.id]: "13" }, "F")[menarca.id], "13");
});

test("sexo desconocido: no esconde los ginecoobstétricos", async () => {
  const campos = await plantillaAplicada();
  const gineco = campos.filter((c) => c.seccion === "IV. Ginecoobstétricos");

  for (const campo of gineco) {
    assert.equal(aplicaPorSexo(campo, null), true);
    assert.equal(campoVisible(campo, {}, null), true, "ante la duda se pregunta, no se marca");
  }
  const guardado = valoresParaGuardar(campos, {}, null);
  assert.equal(
    Object.values(guardado).filter((v) => v === NO_APLICA).length,
    0,
    "no se escribe No aplica en un expediente sin sexo capturado",
  );
});

test("los 548 pacientes importados traen el sexo en texto libre", () => {
  assert.equal(sexoNormalizado("F"), "F");
  assert.equal(sexoNormalizado("M"), "M");
  assert.equal(sexoNormalizado("femenino"), "F");
  assert.equal(sexoNormalizado("Masculino"), "M");
  assert.equal(sexoNormalizado(""), null);
  assert.equal(sexoNormalizado(null), null);
  assert.equal(sexoNormalizado("otro"), null);
});

test("cambiar la pregunta a No cierra el detalle y lo borra al guardar", async () => {
  const campos = await plantillaAplicada();
  const fuma = por(campos, "¿Fuma?");
  const tabaquismo = por(campos, "Tabaquismo");
  assert.equal(tabaquismo.depende_de, fuma.id, "el detalle cuelga de la pregunta");

  // Sin contestar, cerrado.
  assert.equal(campoVisible(tabaquismo, {}, "F"), false);

  // Sí: se abre y se guarda.
  const conSi = { [fuma.id]: true, [tabaquismo.id]: "una cajetilla al día" };
  assert.equal(campoVisible(tabaquismo, conSi, "F"), true);
  assert.equal(valoresParaGuardar(campos, conSi, "F")[tabaquismo.id], "una cajetilla al día");

  // No: se cierra y el detalle no llega a la historia.
  const conNo = { [fuma.id]: false, [tabaquismo.id]: "una cajetilla al día" };
  assert.equal(campoVisible(tabaquismo, conNo, "F"), false);
  const guardado = valoresParaGuardar(campos, conNo, "F");
  assert.equal(tabaquismo.id in guardado, false, "el detalle se elimina");
  assert.equal(guardado[fuma.id], false, "la respuesta sí/no sí se conserva");
});

test("el interrogatorio por aparatos se abre con una sola pregunta", async () => {
  const campos = await plantillaAplicada();
  const general = por(campos, "¿Refiere alguna enfermedad o síntoma a destacar?");
  const aparatos = campos.filter((c) => c.depende_de === general.id);
  assert.equal(aparatos.length, 6, "los seis aparatos cuelgan de la pregunta general");

  for (const campo of aparatos) {
    assert.equal(campoVisible(campo, {}, "F"), false);
    assert.equal(campoVisible(campo, { [general.id]: true }, "F"), true);
  }
});

test("los campos retirados no se capturan pero conservan lo ya respondido", async () => {
  const campos = await plantillaAplicada();
  const tipoSangre = por(campos, "Tipo sanguíneo");
  assert.equal(tipoSangre.oculto, true);
  assert.equal(campoVisible(tipoSangre, {}, "F"), false);
  assert.equal(
    valoresParaGuardar(campos, { [tipoSangre.id]: "O+" }, "F")[tipoSangre.id],
    "O+",
    "una historia vieja no pierde su respuesta",
  );
});

test("el IMC acepta la talla en metros y en centímetros", () => {
  assert.equal(calcularImcHistoria(78.4, 1.65), "28.8");
  assert.equal(calcularImcHistoria(78.4, 165), "28.8");
  assert.equal(calcularImcHistoria("78,4", "1,65"), "28.8", "coma decimal");
  assert.equal(calcularImcHistoria("78.4", "165"), "28.8", "todo como texto");
  assert.equal(calcularImcHistoria(60, 1.5), "26.7");
  assert.equal(calcularImcHistoria(60, 150), "26.7");
});

test("el IMC no inventa un número cuando los datos no dan", () => {
  assert.equal(calcularImcHistoria("", 1.65), "");
  assert.equal(calcularImcHistoria(78, null), "");
  assert.equal(calcularImcHistoria(78, 0), "");
  assert.equal(calcularImcHistoria(700, 1.65), "", "peso fuera de rango");
  assert.equal(calcularImcHistoria(78, 3.2), "", "talla fuera de rango");
  assert.equal(calcularImcHistoria("abc", "def"), "");
});

test("la ficha clínica trae los tres campos del cálculo", async () => {
  const campos = await plantillaAplicada();
  assert.equal(por(campos, "Peso (kg)").rol, "peso");
  assert.equal(por(campos, "Talla (m)").rol, "talla");
  assert.equal(por(campos, "IMC").rol, "imc");
});
