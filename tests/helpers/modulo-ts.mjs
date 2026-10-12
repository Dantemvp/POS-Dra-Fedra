import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);

export async function cargarTS(archivo, externos = {}) {
  const llave = `__fixture_${crypto.randomUUID().replaceAll('-', '')}`;
  globalThis[llave] = externos;
  let fuente = fs.readFileSync(archivo, 'utf8');
  if (archivo.pathname.endsWith('.tsx')) fuente = `import React from 'react';\n${fuente}`;
  fuente = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  fuente = fuente.replace(/import\s+([\s\S]*?)\s+from\s+(['"])([^'"]+)\2;/g, (linea, nombres, comilla, ruta) => {
    if (Object.hasOwn(externos, ruta)) return `const ${nombres} = globalThis.${llave}[${JSON.stringify(ruta)}];`;
    let url;
    if (ruta.startsWith('.')) url = new URL(/\.([mc]?js|tsx?)$/.test(ruta) ? ruta : `${ruta}.ts`, archivo).href;
    else if (ruta.startsWith('@/lib/')) url = new URL(`../../src/lib/${ruta.slice(6)}.ts`, import.meta.url).href;
    else url = pathToFileURL(require.resolve(ruta)).href;
    return `import ${nombres} from ${JSON.stringify(url)};`;
  });
  const codigo = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  try { return { modulo: await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`), limpiar: () => delete globalThis[llave] }; }
  catch (e) { delete globalThis[llave]; throw e; }
}
