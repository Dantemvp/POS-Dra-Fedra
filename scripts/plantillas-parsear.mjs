// Convierte los recetarios en PDF de la Dra. Fedra en plantillas de receta.
// Cada PDF trae la columna izquierda con los medicamentos y la derecha con la
// etiqueta de fase y las casillas de medidas, que aquí se descartan.
import fs from "node:fs";
import path from "node:path";

const DIR = process.env.FASES_DIR ?? "fases";

const MEMBRETE = /^(DRA\.|MÉDICO|UNIVERSIDAD|NOMBRE:|EDAD|FECHA|FIRMA|CÉD|C\s*O\s*N\s*TA\s*C\s*T\s*O|CONTACTO|BLVD|VIÑEDOS|PESO|E\s*S\s*TAT\s*U\s*R\s*A|IMC|CINTURA)/i;
const ETIQUETA_FASE = /^(FASE|DESTETE|MANTENIMIENTO|RETOMAR)\b/i;

// Los archivos que no son una receta: el recetario en blanco.
const NO_SON_PLANTILLA = new Set(["Recetario Original con Datos COLOR"]);

function diasDe(texto) {
  const m = texto.match(/\((\d+)\s*d[íi]as?\)/i);
  return m ? Number(m[1]) : null;
}

function parsear(txt) {
  // Hay dos formas de documento. La receta lista medicamentos con asterisco y
  // usa los guiones para aclarar cómo se aplica un inyectable. La "Nota" no
  // tiene medicamentos de tratamiento: cada guion es un fármaco de rescate.
  const esNota = /^\s*Nota:?\s*$/m.test(txt);
  const items = [];
  let faseTexto = null;
  let actual = null;

  const lineas = txt.split("\n");
  // Una de las hojas quedó con los datos de una paciente escritos encima del
  // membrete. Lo que está arriba del renglón NOMBRE: es membrete, nunca
  // tratamiento, así que la receta se empieza a leer después de ese renglón.
  const inicio = lineas.findIndex((l) => /NOMBRE\s*:/i.test(l));
  for (const bruto of lineas.slice(inicio >= 0 ? inicio + 1 : 0)) {
    if (bruto.trim() === "") continue;
    // -layout pega la columna derecha en la misma línea, separada por un hueco
    // grande de espacios. Se corta ahí.
    const partes = bruto.split(/\s{3,}/).map((p) => p.trim()).filter(Boolean);
    if (partes.length === 0) continue;

    for (const p of partes.slice(1)) {
      if (!faseTexto && ETIQUETA_FASE.test(p)) faseTexto = p.replace(/\.$/, "");
    }

    const izq = partes[0];
    if (MEMBRETE.test(izq)) continue;
    if (ETIQUETA_FASE.test(izq)) {
      if (!faseTexto) faseTexto = izq.replace(/\.$/, "");
      continue;
    }

    if (/^\*/.test(izq)) {
      const nombre = izq.replace(/^\*\s*/, "").trim();
      actual = { medicamento: nombre.replace(/\.$/, ""), duracion_dias: diasDe(nombre), dosis: [], indicaciones: [] };
      items.push(actual);
      continue;
    }

    if (/^Nota:?$/i.test(izq)) { actual = null; continue; }

    // Las notas usan viñetas con guion como medicamento. Dentro de un
    // medicamento abierto, ese mismo guion es una aclaración de su dosis
    // (los inyectables traen así las instrucciones de aplicación).
    if (/^-\s+/.test(izq) && esNota) {
      const cuerpo = izq.replace(/^-\s*/, "").trim();
      const corte = cuerpo.indexOf(":");
      actual = corte > 0
        ? { medicamento: cuerpo.slice(0, corte).trim(), duracion_dias: diasDe(cuerpo), dosis: [cuerpo.slice(corte + 1).trim()], indicaciones: [] }
        : { medicamento: cuerpo, duracion_dias: diasDe(cuerpo), dosis: [], indicaciones: [] };
      items.push(actual);
      continue;
    }

    if (actual) actual.dosis.push(izq);
    else items.push({ medicamento: izq, duracion_dias: null, dosis: [], indicaciones: [] });
  }

  return {
    fase_texto: faseTexto,
    items: items.map((i) => ({
      medicamento: i.medicamento,
      duracion_dias: i.duracion_dias,
      dosis: i.dosis.join("\n"),
      indicaciones: i.indicaciones.join("\n"),
    })),
  };
}

const salida = [];
for (const archivo of fs.readdirSync(DIR).filter((f) => f.endsWith(".txt")).sort()) {
  const [categoria, nombre] = path.basename(archivo, ".txt").split("~");
  if (NO_SON_PLANTILLA.has(nombre)) continue;
  const { fase_texto, items } = parsear(fs.readFileSync(path.join(DIR, archivo), "utf8"));
  salida.push({ categoria, nombre: nombre.trim().replace(/\s+/g, " "), fase_texto, items });
}

fs.writeFileSync(path.join(DIR, "..", "plantillas.json"), JSON.stringify(salida, null, 2), "utf8");

console.log(`${salida.length} plantillas\n`);
for (const p of salida) {
  const aviso = p.items.length === 0 ? "  <-- SIN MEDICAMENTOS" : "";
  const sinFase = p.fase_texto ? "" : "  <-- SIN ETIQUETA DE FASE";
  console.log(`[${p.categoria}] ${p.nombre}  |  fase: ${p.fase_texto ?? "-"}  |  ${p.items.length} med${aviso}${sinFase}`);
  for (const i of p.items) {
    console.log(`      * ${i.medicamento}${i.duracion_dias ? ` (${i.duracion_dias}d)` : ""}`);
    for (const d of i.dosis.split("\n").filter(Boolean)) console.log(`          ${d}`);
  }
}
