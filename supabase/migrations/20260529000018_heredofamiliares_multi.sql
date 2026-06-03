-- ============================================================================
-- Antecedentes heredofamiliares: de texto libre a SELECCIÓN MÚLTIPLE.
-- En vez de escribir "¿quién?", el médico marca qué familiares lo presentan
-- (madre, padre, abuelos, etc.). Nuevo tipo_dato 'multi' = arreglo de opciones.
-- Las historias viejas conservan su texto; solo cambia la captura nueva.
-- ============================================================================

do $$
declare
  v_tipo uuid;
  v_familiares jsonb := '["Madre","Padre","Abuelos maternos","Abuelos paternos","Hermanos","Tíos","Otros"]'::jsonb;
begin
  select id into v_tipo from tipos_historia where nombre = 'Historia Clínica (NOM-004)';
  if v_tipo is null then return; end if;

  update campos_historia
    set tipo_dato = 'multi',
        opciones = v_familiares,
        etiqueta = replace(etiqueta, ' (¿quién?)', '')
  where tipo_historia_id = v_tipo
    and seccion = 'II. Antecedentes heredofamiliares'
    and etiqueta in (
      'Diabetes (¿quién?)',
      'Hipertensión arterial (¿quién?)',
      'Cáncer (¿quién?)',
      'Cardiópatas (¿quién?)',
      'Nefrópatas (¿quién?)'
    );

  raise notice 'Heredofamiliares convertidos a selección múltiple';
end $$;
