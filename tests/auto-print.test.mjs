import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("consume imprimir=1 antes de imprimir y espera fuentes e imágenes", async () => {
  const fuente = readFileSync("src/components/AutoPrint.tsx", "utf8");
  assert.match(readFileSync("src/components/PrintControls.tsx", "utf8"), /<AutoPrint consumirSolicitud/);
  const compilado = ts.transpileModule(fuente, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
  const pasos = [];
  let efecto;
  const ventana = { location: {href:"https://pos.invalid/cobros/sintetico?imprimir=1&area=consultorio#ticket"},
    history: {state:{prueba:true},replaceState(estado,_,url) {assert.deepEqual(estado,{prueba:true}); pasos.push("consumir");ventana.location.href=url;}},
    print() {pasos.push("imprimir");} };
  const sandbox = {exports:{}, URL, window:ventana, document: {
    fonts:{ready:Promise.resolve().then(()=>pasos.push("fuentes"))},
    querySelectorAll:()=>[{decode:async()=>{pasos.push("imagen");}}],
  }, require:()=>({useRef:()=>({current:false}),useEffect:fn=>{efecto=fn;}})};
  vm.runInNewContext(compilado,sandbox);
  sandbox.exports.default({consumirSolicitud:true});
  efecto();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(pasos,["fuentes","imagen","consumir","imprimir"]);
  assert.equal(ventana.location.href,"https://pos.invalid/cobros/sintetico?area=consultorio#ticket");
  assert.equal(new URL(ventana.location.href).searchParams.get("imprimir"),null);
});
