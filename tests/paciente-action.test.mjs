import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Ejecuta la acción real, sustituyendo únicamente las conexiones externas.
async function accion(cliente, invalidaciones) {
  const llave = `__fedra_prueba_${crypto.randomUUID().replaceAll('-', '')}`;
  globalThis[llave] = { cliente, invalidaciones };
  let fuente = fs.readFileSync(new URL('../src/app/(app)/pacientes/actions.ts', import.meta.url), 'utf8');
  fuente = fuente.replace('import { revalidatePath } from "next/cache";', `const revalidatePath = p => globalThis.${llave}.invalidaciones.push(p);`)
    .replace('import { createClient } from "@/lib/supabase/server";', `const createClient = async () => globalThis.${llave}.cliente;`);
  // La URL ya normalizada de Node evita diferencias de Windows/macOS.
  fuente = fuente.replace(/import \{ puedeEditarPaciente, validarEdicionPaciente \} from [^;]+;/, `import { puedeEditarPaciente, validarEdicionPaciente } from ${JSON.stringify(new URL('../src/lib/paciente-edicion.ts', import.meta.url).href)};`);
  const codigo = ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const modulo = await import(`data:text/javascript;base64,${Buffer.from(codigo).toString('base64')}`);
  return { editar: modulo.editarPaciente, limpiar: () => delete globalThis[llave] };
}
const id = '00000000-0000-0000-0000-000000000001';
const previo = { nombre: 'Paciente ficticia', apellidos: null, telefono_wpp: null };
function doble(rol = 'asistente', devuelto = { id }, login = true) {
  const llamadas = [];
  const consulta = { update(datos) { llamadas.push(['update', datos]); return this; }, eq(...args) { llamadas.push(['eq', ...args]); return this; }, is(...args) { llamadas.push(['is', ...args]); return this; }, select() { return this; }, async maybeSingle() { return { data: devuelto, error: null }; } };
  return { llamadas, cliente: { auth: { async getUser() { return { data: { user: login ? { id: 'sesion' } : null } }; } }, from(tabla) {
    llamadas.push(['from', tabla]);
    if (tabla === 'usuarios') return { select() { return this; }, eq() { return this; }, async single() { return { data: { rol } }; } };
    return consulta;
  } } };
}

test('editarPaciente usa el mismo ID y solo modifica datos de contacto', async t => {
  const { cliente, llamadas } = doble();
  const invalidaciones = [];
  const a = await accion(cliente, invalidaciones); t.after(a.limpiar);
  const resultado = await a.editar(id, previo, { nombre: 'Corrección ficticia', telefono_wpp: '6681234567', id: 'otro', es_historico: false });
  assert.deepEqual(resultado, { ok: true, id });
  assert.deepEqual(llamadas.find(c => c[0] === 'update')[1], { nombre: 'Corrección ficticia', apellidos: null, telefono_wpp: '6681234567' });
  assert.ok(llamadas.some(c => c[0] === 'eq' && c[1] === 'id' && c[2] === id));
  assert.ok(llamadas.some(c => c[0] === 'eq' && c[1] === 'nombre' && c[2] === previo.nombre));
  assert.ok(llamadas.some(c => c[0] === 'is' && c[1] === 'telefono_wpp' && c[2] === null));
  assert.deepEqual(invalidaciones, [`/pacientes/${id}`, '/pacientes', '/agenda']);
});

test('editarPaciente rechaza farmacia y una sesión ausente antes de escribir', async t => {
  for (const [rol, login] of [['farmacia', true], ['asistente', false]]) {
    const { cliente, llamadas } = doble(rol, { id }, login);
    const a = await accion(cliente, []); t.after(a.limpiar);
    assert.equal((await a.editar(id, previo, { nombre: 'Prueba' })).ok, false);
    assert.ok(!llamadas.some(c => c[0] === 'update'));
  }
});

test('editarPaciente detecta modificación concurrente y no anuncia éxito', async t => {
  const { cliente } = doble('asistente', null);
  const invalidaciones = [];
  const a = await accion(cliente, invalidaciones); t.after(a.limpiar);
  const resultado = await a.editar(id, previo, { nombre: 'Prueba' });
  assert.equal(resultado.ok, false);
  assert.match(resultado.error, /Los datos cambiaron/);
  assert.deepEqual(invalidaciones, []);
});
