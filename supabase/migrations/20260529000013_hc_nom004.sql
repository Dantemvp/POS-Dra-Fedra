-- ============================================================================
-- Historia Clínica completa (NOM-004-SSA-2012) — formato real de la Dra.
-- Agrega 'seccion' a campos_historia para agrupar, y siembra la plantilla.
-- tipo_dato admite 'textarea' (texto largo) además de los previos.
-- ============================================================================

alter table campos_historia add column if not exists seccion text;

do $$
declare
  v_tipo uuid;
  n int := 0;
  -- helper inline: insertar campo
  procedure_dummy int;
begin
  if exists (select 1 from tipos_historia where nombre = 'Historia Clínica (NOM-004)') then
    return;
  end if;

  insert into tipos_historia (nombre) values ('Historia Clínica (NOM-004)')
  returning id into v_tipo;

  insert into campos_historia (tipo_historia_id, seccion, etiqueta, tipo_dato, orden, requerido) values
  -- I. Identificación
  (v_tipo, 'I. Identificación', 'Fecha de valoración', 'fecha', 1, false),
  (v_tipo, 'I. Identificación', 'Ocupación', 'texto', 2, false),
  (v_tipo, 'I. Identificación', 'Estado civil', 'texto', 3, false),
  (v_tipo, 'I. Identificación', 'Escolaridad', 'texto', 4, false),
  (v_tipo, 'I. Identificación', 'Religión', 'texto', 5, false),
  -- II. Antecedentes heredofamiliares
  (v_tipo, 'II. Antecedentes heredofamiliares', 'Diabetes (¿quién?)', 'texto', 10, false),
  (v_tipo, 'II. Antecedentes heredofamiliares', 'Hipertensión arterial (¿quién?)', 'texto', 11, false),
  (v_tipo, 'II. Antecedentes heredofamiliares', 'Cáncer (¿quién?)', 'texto', 12, false),
  (v_tipo, 'II. Antecedentes heredofamiliares', 'Cardiópatas (¿quién?)', 'texto', 13, false),
  (v_tipo, 'II. Antecedentes heredofamiliares', 'Nefrópatas (¿quién?)', 'texto', 14, false),
  (v_tipo, 'II. Antecedentes heredofamiliares', 'Otros', 'texto', 15, false),
  -- III. Personales no patológicos
  (v_tipo, 'III. Personales no patológicos', 'Tabaquismo', 'texto', 20, false),
  (v_tipo, 'III. Personales no patológicos', 'Alcohol', 'texto', 21, false),
  (v_tipo, 'III. Personales no patológicos', 'Alergias', 'texto', 22, false),
  (v_tipo, 'III. Personales no patológicos', 'Tipo sanguíneo', 'texto', 23, false),
  (v_tipo, 'III. Personales no patológicos', 'Toxicomanías / farmacodependencia', 'texto', 24, false),
  (v_tipo, 'III. Personales no patológicos', 'Vivienda con servicios básicos', 'booleano', 25, false),
  -- IV. Ginecoobstétricos
  (v_tipo, 'IV. Ginecoobstétricos', 'Menarca (edad)', 'texto', 30, false),
  (v_tipo, 'IV. Ginecoobstétricos', 'Ritmo / ciclos', 'texto', 31, false),
  (v_tipo, 'IV. Ginecoobstétricos', 'Fecha última menstruación', 'fecha', 32, false),
  (v_tipo, 'IV. Ginecoobstétricos', 'IVSA (edad)', 'texto', 33, false),
  (v_tipo, 'IV. Ginecoobstétricos', 'No. parejas sexuales', 'numero', 34, false),
  (v_tipo, 'IV. Ginecoobstétricos', 'Gestas / Partos / Abortos / Cesáreas', 'texto', 35, false),
  (v_tipo, 'IV. Ginecoobstétricos', 'Última citología (PAP) y resultado', 'texto', 36, false),
  (v_tipo, 'IV. Ginecoobstétricos', 'Método de planificación actual', 'texto', 37, false),
  -- V. Personales patológicos
  (v_tipo, 'V. Personales patológicos', 'Enfermedades de la infancia', 'texto', 40, false),
  (v_tipo, 'V. Personales patológicos', 'Hospitalizaciones previas', 'texto', 41, false),
  (v_tipo, 'V. Personales patológicos', 'Antecedentes quirúrgicos', 'texto', 42, false),
  (v_tipo, 'V. Personales patológicos', 'Transfusiones previas', 'texto', 43, false),
  (v_tipo, 'V. Personales patológicos', 'Fracturas / traumatismos', 'texto', 44, false),
  (v_tipo, 'V. Personales patológicos', 'Crónico-degenerativas (DM, HTA, obesidad)', 'textarea', 45, false),
  (v_tipo, 'V. Personales patológicos', 'Otra enfermedad', 'texto', 46, false),
  -- VI. Motivo de consulta
  (v_tipo, 'VI. Motivo de consulta', 'Motivo de consulta', 'textarea', 50, true),
  -- VII. Padecimiento actual
  (v_tipo, 'VII. Padecimiento actual', 'Principio y evolución del padecimiento', 'textarea', 55, false),
  -- VIII. Interrogatorio por aparatos y sistemas
  (v_tipo, 'VIII. Interrogatorio por aparatos', 'Respiratorio / Cardiovascular', 'texto', 60, false),
  (v_tipo, 'VIII. Interrogatorio por aparatos', 'Digestivo', 'texto', 61, false),
  (v_tipo, 'VIII. Interrogatorio por aparatos', 'Endocrino', 'texto', 62, false),
  (v_tipo, 'VIII. Interrogatorio por aparatos', 'Músculo-esquelético', 'texto', 63, false),
  (v_tipo, 'VIII. Interrogatorio por aparatos', 'Piel y anexos', 'texto', 64, false),
  (v_tipo, 'VIII. Interrogatorio por aparatos', 'Neurológico y psiquiátrico', 'texto', 65, false),
  (v_tipo, 'VIII. Interrogatorio por aparatos', 'Medicamentos actuales', 'textarea', 66, false),
  -- IX. Ficha clínica
  (v_tipo, 'IX. Ficha clínica', 'TA (mmHg)', 'texto', 70, false),
  (v_tipo, 'IX. Ficha clínica', 'FC (lpm)', 'numero', 71, false),
  (v_tipo, 'IX. Ficha clínica', 'FR (rpm)', 'numero', 72, false),
  (v_tipo, 'IX. Ficha clínica', 'Temp (°C)', 'numero', 73, false),
  (v_tipo, 'IX. Ficha clínica', 'Talla (m)', 'numero', 74, false),
  (v_tipo, 'IX. Ficha clínica', 'Peso (kg)', 'numero', 75, false),
  (v_tipo, 'IX. Ficha clínica', 'Habitus externo', 'textarea', 76, false),
  (v_tipo, 'IX. Ficha clínica', 'Exploración física por regiones', 'textarea', 77, false),
  (v_tipo, 'IX. Ficha clínica', 'Probables diagnósticos', 'textarea', 78, false),
  -- X. Estudios previos
  (v_tipo, 'X. Estudios previos', 'Estudios de imagen / laboratorio previos', 'textarea', 80, false),
  -- XI. Análisis y terapéutica
  (v_tipo, 'XI. Análisis y terapéutica', 'Análisis e integración', 'textarea', 85, false),
  (v_tipo, 'XI. Análisis y terapéutica', 'Terapéutica', 'textarea', 86, false),
  (v_tipo, 'XI. Análisis y terapéutica', 'Pronóstico', 'texto', 87, false),
  -- XII. Observaciones
  (v_tipo, 'XII. Observaciones', 'Observaciones y comentarios finales', 'textarea', 90, false);

  select count(*) into n from campos_historia where tipo_historia_id = v_tipo;
  raise notice 'Plantilla NOM-004 creada con % campos', n;
end $$;
