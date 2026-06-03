-- ============================================================================
-- Nota de evolución (NOM-004-SSA3-2012, numeral 6.2).
-- La norma exige que CADA contacto posterior con el paciente registre:
-- fecha, hora, signos vitales, evolución, diagnóstico actualizado y plan.
-- Es además el formato de seguimiento de control de peso de la Dra., por eso
-- usa las etiquetas "Peso (kg)" y "Cintura (cm)" que alimentan la gráfica de
-- progreso del paciente.
-- ============================================================================

do $$
declare
  v_tipo uuid;
begin
  if exists (select 1 from tipos_historia where nombre = 'Nota de evolución (NOM-004)') then
    return;
  end if;

  insert into tipos_historia (nombre) values ('Nota de evolución (NOM-004)')
  returning id into v_tipo;

  insert into campos_historia (tipo_historia_id, seccion, etiqueta, tipo_dato, orden, requerido) values
  -- Signos vitales (exploración del día)
  (v_tipo, 'Signos vitales', 'TA (mmHg)', 'texto', 1, false),
  (v_tipo, 'Signos vitales', 'FC (lpm)', 'numero', 2, false),
  (v_tipo, 'Signos vitales', 'FR (rpm)', 'numero', 3, false),
  (v_tipo, 'Signos vitales', 'Temp (°C)', 'numero', 4, false),
  (v_tipo, 'Signos vitales', 'Peso (kg)', 'numero', 5, false),
  (v_tipo, 'Signos vitales', 'Cintura (cm)', 'numero', 6, false),
  (v_tipo, 'Signos vitales', 'IMC', 'numero', 7, false),
  -- Evolución
  (v_tipo, 'Evolución', 'Evolución desde la última visita', 'textarea', 10, true),
  (v_tipo, 'Evolución', 'Adherencia al tratamiento / dieta', 'texto', 11, false),
  (v_tipo, 'Evolución', 'Exploración física relevante', 'textarea', 12, false),
  -- Diagnóstico y plan
  (v_tipo, 'Diagnóstico y plan', 'Diagnóstico actualizado', 'textarea', 20, true),
  (v_tipo, 'Diagnóstico y plan', 'Plan de manejo / indicación terapéutica', 'textarea', 21, true),
  (v_tipo, 'Diagnóstico y plan', 'Pronóstico', 'texto', 22, false),
  (v_tipo, 'Diagnóstico y plan', 'Próxima cita / meta', 'texto', 23, false);

  raise notice 'Plantilla Nota de evolución (NOM-004) creada';
end $$;
