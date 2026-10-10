import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const reactUrl = pathToFileURL(require.resolve('react')).href;
let fuente = fs.readFileSync(new URL('../../src/app/(app)/agenda/RecordatorioWhatsApp.tsx', import.meta.url), 'utf8');
fuente = `import React from ${JSON.stringify(reactUrl)};\n` + fuente.replaceAll("'@/lib/agenda-whatsapp'", JSON.stringify(new URL('../../src/lib/agenda-whatsapp.ts', import.meta.url).href));
const codigo = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText.replaceAll("from 'react'", `from ${JSON.stringify(reactUrl)}`);
export const whatsappModuleUrl = `data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`;
