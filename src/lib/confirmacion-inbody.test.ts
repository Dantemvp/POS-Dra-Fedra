// Guarda de orden: la confirmación de paciente va ANTES de subir el documento.
//
// FED-019 puso la confirmación en la ficha de la paciente y en el alta de
// receta. En el alta de receta quedó dentro de `cargarUltimoInBody`, que sólo
// LEE el último estudio guardado, mientras que `subirInBody`, que es el que
// escribe bytes en el bucket, siguió sin preguntar nada. Una prueba sobre el
// mensaje no ve esa diferencia: el texto era correcto y estaba en el archivo
// correcto, sólo que en la función equivocada.
//
// Por eso esta guarda mira la estructura y no el texto. Para cada función que
// sube un documento clínico, exige que la confirmación aparezca antes de la
// subida dentro de esa MISMA función. Es el criterio de
// `scripts/check-guardia.mjs`: una regla que sólo vale si alguien se acuerda de
// repetirla no es una regla.
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest sirve los módulos por URL propia, así que `import.meta.url` no llega
// al disco. La raíz del repositorio es el directorio de trabajo de la corrida,
// igual que en los guiones de `scripts/`.
const RAIZ_APP = join(process.cwd(), "src", "app");

// Sólo interesa la subida de un documento CLÍNICO. `rutaInBody()` es lo que la
// distingue de la de un archivo de producto, que no cuelga de ninguna paciente
// y por lo tanto no tiene nada que confirmar.
const SUBIDA = /rutaInBody\([\s\S]*?\.upload\(/;
const CONFIRMACION = /window\.confirm\(\s*mensajeConfirmacionInBody\(/;

/** Todos los componentes bajo `src/app`. */
function componentes(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) return componentes(ruta);
    return entrada.name.endsWith(".tsx") ? [ruta] : [];
  });
}

/**
 * Parte el archivo por declaraciones de función de primer nivel. No es un
 * analizador de sintaxis: alcanza para distinguir en qué función ocurre cada
 * llamada, que es lo único que esta guarda necesita saber.
 */
function funciones(codigo: string): { nombre: string; cuerpo: string }[] {
  return codigo
    .split(/\n(?=\s*(?:async\s+)?function\s+\w+)/)
    .map((cuerpo) => ({
      nombre: cuerpo.match(/^\s*(?:async\s+)?function\s+(\w+)/)?.[1] ?? "(nivel de módulo)",
      cuerpo,
    }));
}

describe("confirmación de paciente antes de subir un documento clínico", () => {
  const archivos = componentes(RAIZ_APP).filter((ruta) =>
    SUBIDA.test(readFileSync(ruta, "utf8")),
  );

  it("encuentra las dos pantallas que suben un InBody", () => {
    // Si esta afirmación falla, la guarda dejó de mirar algo: o el patrón de
    // subida cambió, o las funciones se volvieron expresiones flecha y hay que
    // enseñarle a `funciones` a reconocerlas. En cualquier caso ya no se puede
    // concluir que el orden siga siendo el correcto.
    expect(archivos.length).toBeGreaterThanOrEqual(2);
  });

  for (const ruta of archivos) {
    const codigo = readFileSync(ruta, "utf8");
    const nombreArchivo = ruta.slice(RAIZ_APP.length + 1).split(sep).join("/");
    const suben = funciones(codigo).filter((f) => SUBIDA.test(f.cuerpo));

    it(`${nombreArchivo}: cada subida pregunta primero`, () => {
      expect(suben.length).toBeGreaterThan(0);
      for (const { nombre, cuerpo } of suben) {
        const confirma = cuerpo.search(CONFIRMACION);
        const sube = cuerpo.search(SUBIDA);
        expect(
          confirma,
          `${nombreArchivo} · ${nombre}() sube el documento sin confirmar antes la paciente`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          confirma,
          `${nombreArchivo} · ${nombre}() confirma después de haber subido el documento`,
        ).toBeLessThan(sube);
      }
    });
  }
});
