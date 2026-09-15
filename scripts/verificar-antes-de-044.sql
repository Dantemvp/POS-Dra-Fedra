-- Correr en el SQL editor de Supabase (proyecto kxtznwgdpvbtlsedmjap) ANTES de
-- aplicar la migracion 20260915000044. Solo lee, no cambia nada.
-- Esperado en una base intacta: cero FALTA, 1 plantilla, 8 campos gineco,
-- 55 campos totales y ya_aplicada = 0.
-- Verifica que la plantilla NOM-004 en produccion este como la espera la
-- migracion 044. Solo lee. Si alguna fila dice FALTA, no hacer db push:
-- esa etiqueta cambio y la migracion la saltaria en silencio.
with tipo as (
  select id from tipos_historia where nombre = 'Historia Clínica (NOM-004)'
),
esperado(seccion, etiqueta) as (values
  ('I. Identificación',                'Estado civil'),
  ('I. Identificación',                'Escolaridad'),
  ('I. Identificación',                'Religión'),
  ('III. Personales no patológicos',   'Tabaquismo'),
  ('III. Personales no patológicos',   'Alcohol'),
  ('III. Personales no patológicos',   'Alergias'),
  ('III. Personales no patológicos',   'Tipo sanguíneo'),
  ('III. Personales no patológicos',   'Toxicomanías / farmacodependencia'),
  ('V. Personales patológicos',        'Enfermedades de la infancia'),
  ('V. Personales patológicos',        'Hospitalizaciones previas'),
  ('V. Personales patológicos',        'Antecedentes quirúrgicos'),
  ('V. Personales patológicos',        'Transfusiones previas'),
  ('V. Personales patológicos',        'Fracturas / traumatismos'),
  ('V. Personales patológicos',        'Crónico-degenerativas (DM, HTA, obesidad)'),
  ('VIII. Interrogatorio por aparatos','Respiratorio / Cardiovascular'),
  ('VIII. Interrogatorio por aparatos','Digestivo'),
  ('VIII. Interrogatorio por aparatos','Endocrino'),
  ('VIII. Interrogatorio por aparatos','Músculo-esquelético'),
  ('VIII. Interrogatorio por aparatos','Piel y anexos'),
  ('VIII. Interrogatorio por aparatos','Neurológico y psiquiátrico'),
  ('VIII. Interrogatorio por aparatos','Medicamentos actuales'),
  ('IX. Ficha clínica',                'Talla (m)'),
  ('IX. Ficha clínica',                'Peso (kg)')
)
select e.seccion,
       e.etiqueta,
       case when c.id is null then 'FALTA' else 'ok' end as estado
  from esperado e
  left join campos_historia c
    on c.tipo_historia_id = (select id from tipo)
   and c.seccion  = e.seccion
   and c.etiqueta = e.etiqueta
 order by (c.id is not null), e.seccion, e.etiqueta;

-- Comprobaciones sueltas
with tipo as (
  select id from tipos_historia where nombre = 'Historia Clínica (NOM-004)'
)
select
  (select count(*) from tipos_historia
     where nombre = 'Historia Clínica (NOM-004)')          as plantillas_nom004,
  (select count(*) from campos_historia
     where tipo_historia_id = (select id from tipo)
       and seccion = 'IV. Ginecoobstétricos')              as campos_gineco,
  (select count(*) from campos_historia
     where tipo_historia_id = (select id from tipo))       as campos_totales,
  (select count(*) from information_schema.columns
     where table_schema = 'public'
       and table_name = 'campos_historia'
       and column_name = 'rol')                            as ya_aplicada;
