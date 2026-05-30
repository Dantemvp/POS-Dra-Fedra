-- ============================================================================
-- Semilla: plantillas de historia clínica por tipo, con sus campos.
-- Editable después por la doctora/admin (tipos_historia / campos_historia).
-- Guardado idempotente (no duplica si ya existe el tipo).
-- ============================================================================

do $$
declare
  v_general uuid;
  v_peso uuid;
  v_toxina uuid;
  v_faciales uuid;
begin
  -- General
  if not exists (select 1 from tipos_historia where nombre = 'General') then
    insert into tipos_historia (nombre) values ('General') returning id into v_general;
    insert into campos_historia (tipo_historia_id, etiqueta, tipo_dato, orden, requerido) values
      (v_general, '¿Toma algún medicamento?', 'texto', 1, false),
      (v_general, '¿Tiene alguna enfermedad?', 'texto', 2, false),
      (v_general, 'Antecedentes importantes', 'texto', 3, false),
      (v_general, '¿Ha consumido inhibidores del apetito?', 'booleano', 4, false),
      (v_general, 'Padece diabetes tipo 1', 'booleano', 5, false),
      (v_general, 'Padece pancreatitis', 'booleano', 6, false);
  end if;

  -- Control de peso
  if not exists (select 1 from tipos_historia where nombre = 'Control de peso') then
    insert into tipos_historia (nombre) values ('Control de peso') returning id into v_peso;
    insert into campos_historia (tipo_historia_id, etiqueta, tipo_dato, orden, requerido) values
      (v_peso, 'Peso actual (kg)', 'numero', 1, true),
      (v_peso, 'Cintura (cm)', 'numero', 2, false),
      (v_peso, 'Estatura (cm)', 'numero', 3, false),
      (v_peso, 'Meta de peso', 'texto', 4, false),
      (v_peso, 'Fase del tratamiento', 'opciones', 5, false);
    update campos_historia
      set opciones = '["Fase 1","Fase 2","Fase 3","Fase 4","Fase 5"]'::jsonb
      where tipo_historia_id = v_peso and etiqueta = 'Fase del tratamiento';
  end if;

  -- Toxina botulínica
  if not exists (select 1 from tipos_historia where nombre = 'Toxina botulínica') then
    insert into tipos_historia (nombre) values ('Toxina botulínica') returning id into v_toxina;
    insert into campos_historia (tipo_historia_id, etiqueta, tipo_dato, orden, requerido) values
      (v_toxina, 'Zona a tratar', 'texto', 1, true),
      (v_toxina, 'Unidades aplicadas', 'numero', 2, false),
      (v_toxina, 'Alergias conocidas', 'texto', 3, false);
  end if;

  -- Procedimientos faciales
  if not exists (select 1 from tipos_historia where nombre = 'Procedimientos faciales') then
    insert into tipos_historia (nombre) values ('Procedimientos faciales') returning id into v_faciales;
    insert into campos_historia (tipo_historia_id, etiqueta, tipo_dato, orden, requerido) values
      (v_faciales, 'Procedimiento', 'texto', 1, true),
      (v_faciales, 'Producto utilizado', 'texto', 2, false),
      (v_faciales, 'Observaciones', 'texto', 3, false);
  end if;
end $$;
