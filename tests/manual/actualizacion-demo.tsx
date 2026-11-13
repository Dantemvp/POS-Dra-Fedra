import React from 'react';
import { createRoot } from 'react-dom/client';
import NuevaHistoria from '../../src/app/(app)/pacientes/[id]/NuevaHistoria';
import HistoriaCard from '../../src/app/(app)/pacientes/[id]/HistoriaCard';
import IdentificacionesPaciente from '../../src/app/(app)/pacientes/[id]/IdentificacionesPaciente';
import CuestionarioHistoria from '../../src/app/formulario/historia/CuestionarioHistoria';
import NuevaReceta from '../../src/app/(app)/recetas/NuevaReceta';
import AjustadorReceta from '../../src/app/(app)/recetas/[id]/AjustadorReceta';
import { prepararCamposHistoria, type CampoHistoria } from '../../src/lib/historia-campos';
import { crearCamposRemotos } from '../../src/lib/historia-remota';
import originales from './actualizacion-campos.json';

const campos = prepararCamposHistoria(originales as CampoHistoria[]);
const tipo = { id:'ficticio',nombre:'Historia Clínica (NOM-004)',campos_historia:campos };
const consulta = new URLSearchParams(window.location.search);
const vista = consulta.get('vista');
const medicamento = 'Ejemplo 20 mg caja con 30 tabletas';
const plantilla = { id:'p',nombre:'Plantilla ficticia',categoria:'FASE 1',fases:[1],fase_texto:'FASE 1: 21 días',items:[{medicamento,dosis:'Indicación ficticia',duracion_dias:21,indicaciones:''}] };
const dato = (etiqueta: string) => campos.find(c => c.etiqueta === etiqueta)!.id;
createRoot(document.getElementById('root')!).render(vista === 'formulario' ? <CuestionarioHistoria campos={crearCamposRemotos(campos)} /> : <main className="mx-auto max-w-5xl space-y-6 p-4">
  <h1 className="text-xl">Demo sintética de actualización</h1>
  {vista === 'receta' ? <><NuevaReceta pacientes={[{id:'paciente',nombre:'Persona ficticia'}]} productos={[{id:'envase30',nombre:medicamento},{id:'envase60',nombre:'Ejemplo 20 mg caja con 60 tabletas'}]} plantillas={[plantilla]} />
  <AjustadorReceta recetaId="ficticia" nombre="Persona ficticia" edad="30" fecha="13/11/2026" folio={1} fase={2} items={[{id:'item',medicamento,dosis:'Indicación ficticia',duracion_dias:21,indicaciones:''}]} ajustes={null} metricasReceta={null} plantillas={[]} puedeAjustar />
  </> : <><NuevaHistoria pacienteId="paciente" sexo={consulta.get('sexo') || 'F'} tipos={[tipo]} nombrePaciente="Persona ficticia" />
  <HistoriaCard historiaId="historia" pacienteId="paciente" titulo="Historia anterior ficticia" fecha="13/11/2026" datos={{[dato('Tabaquismo')]:'detalle anterior sin pregunta Sí/No',[dato('Motivo de consulta')]:'motivo anterior'}} labels={Object.fromEntries(campos.map(c=>[c.id,c.etiqueta]))} esAdmin={false} campos={campos} sexo="F" />
  <IdentificacionesPaciente pacienteId="00000000-0000-0000-0000-000000000001" /></>}
</main>);
