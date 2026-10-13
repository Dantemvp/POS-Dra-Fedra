// Harness local: usa los componentes reales, React real y CSS del último build.
// Sin .env, Supabase, credenciales ni escrituras de caja.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fedra-panel-demo-'));
const tema = process.argv.includes('--tema');
const cierre = process.argv.includes('--cierre');
const webpack = require('next/dist/compiled/webpack/webpack').webpack;
// Artefactos generados en TEMP, no cambios al lockfile ni al proyecto.
fs.writeFileSync(path.join(scratch,'ts-loader.cjs'), `const ts = require(${JSON.stringify(require.resolve('typescript'))}); module.exports = function(src){return ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
fs.writeFileSync(path.join(scratch,'link.js'), "import React from 'react'; export default function Link({children, ...props}) {return React.createElement('a',props,children);}");
fs.writeFileSync(path.join(scratch,'navigation.js'), "export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search);");
fs.writeFileSync(path.join(scratch,'image.js'), "import React from 'react'; export default function Image({priority,...props}) {return React.createElement('img',props);}");
fs.writeFileSync(path.join(scratch,'logout.js'), "import React from 'react'; export default function Logout(){return React.createElement('button',{disabled:true},'Salir (demo)');}");
await new Promise((resolve,reject)=>webpack.webpack({mode:'development',context:root,entry:path.join(root,cierre?'tests/manual/cierre-caja-demo.tsx':tema?'tests/manual/tema-cortes-demo.tsx':'tests/manual/panel-demo.tsx'),output:{path:scratch,filename:'demo.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:{...(cierre ? { [path.join(root,'src/app/(app)/caja/actions')]: path.join(root,'tests/manual/cierre-caja-actions.ts') } : {}),'@/components/LogoutButton':path.join(scratch,'logout.js'),'@':path.join(root,'src'),'next/link':path.join(scratch,'link.js'),'next/navigation':path.join(scratch,'navigation.js'),'next/image':path.join(scratch,'image.js')},modules:[path.join(root,'node_modules'),'node_modules']},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:[path.join(scratch,'ts-loader.cjs')]}]},plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development')})],devtool:false},(e,stats)=>e||stats.hasErrors()?reject(e??new Error(stats.toString({all:false,errors:true}))):resolve()));
const buscarCSS=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?buscarCSS(path.join(dir,e.name)):e.name.endsWith('.css')?[path.join(dir,e.name)]:[]);
const css=buscarCSS(path.join(root,'.next/static')).map(p=>fs.readFileSync(p,'utf8')).join('\n');
const header={'Cache-Control':'no-store'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const send=(tipo,contenido)=>{res.writeHead(200,{'Content-Type':tipo,...header});res.end(contenido);};
  if(url.pathname==='/demo.js')return send('text/javascript',fs.readFileSync(path.join(scratch,'demo.js')));
  if(url.pathname==='/style.css')return send('text/css',css);
  if(url.pathname==='/logo.png')return send('image/png',fs.readFileSync(path.join(root,'public/logo.png')));
  if(url.pathname==='/logo-farmacia.png')return send('image/png',fs.readFileSync(path.join(root,'public/logo-farmacia.png')));
  if(url.pathname==='/membrete-historia.png')return send('image/png',fs.readFileSync(path.join(root,'public/membrete-historia.png')));
  if(url.pathname==='/api/panel-operativo')return send('application/json',JSON.stringify({sesion:'ficticia',rol:'admin',actualizado:new Date().toISOString(),citas:[],stock:{bajo:2,vencido:1,porCaducar:3,sinCodigo:4,sinPrecio:2},caja:{sinCorte:2,ultimaDiferencia:-50,href:'/caja'}}));
  if(url.pathname==='/api/google-calendario/eventos')return send('application/json',JSON.stringify({conectado:true,actualizado:new Date().toISOString(),eventos:[{id:'google-ficticio',titulo:'Persona Ficticia $600 facial',inicio:new Date(Date.now()+3600000).toISOString(),diaCompleto:false,descripcion:'Tel: +1 202 555 0123'}]}));
  return send('text/html','<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><title>Fedra · Demostración ficticia</title><body><div id="root"></div><script src="/demo.js"></script></body></html>');
});
const puerto = Number(process.env.FEDRA_DEMO_PORT ?? (tema ? 3034 : 3032));
server.listen(puerto,'127.0.0.1',()=>console.log(`Demostración: http://127.0.0.1:${puerto} · ${scratch}`));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
