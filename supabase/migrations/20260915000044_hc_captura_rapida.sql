-- ============================================================================
-- Historia clínica: captura rápida (reunión del 15 de septiembre de 2026).
--
-- Fernanda llena la historia a mano con el paciente enfrente y pidió que la
-- mayoría de los campos se seleccionen en vez de escribirse. Se agregan cinco
-- capacidades a `campos_historia`, todas opcionales, para que el formulario las
-- resuelva solo y la plantilla se siga editando sin programador:
--
--   oculto        campo retirado de la captura. No se borra: 548 historias
--                 importadas guardan respuestas con ese id y se seguirían
--                 imprimiendo sin etiqueta.
--   depende_de    el campo solo se pregunta si otro campo tiene cierto valor.
--                 Es el "si dice que sí, se abre la opción; si dice que no, lo
--                 dejamos en blanco".
--   depende_valor valor que activa al hijo ('true' para los sí/no).
--   solo_sexo     el campo solo aplica a ese sexo. Los ginecoobstétricos se
--                 marcan como no aplicables cuando el paciente es hombre.
--   valor_default texto con el que llega precargado el campo.
--   rol           'peso' | 'talla' | 'imc', para calcular el IMC solo.
--
-- Ningún campo existente cambia de tipo_dato: los sí/no entran como preguntas
-- nuevas y el campo de siempre pasa a ser su detalle. Así ninguna respuesta ya
-- guardada cambia de forma.
-- ============================================================================

alter table campos_historia add column if not exists oculto boolean not null default false;
alter table campos_historia add column if not exists depende_de uuid references campos_historia(id) on delete set null;
alter table campos_historia add column if not exists depende_valor text;
alter table campos_historia add column if not exists solo_sexo text;
alter table campos_historia add column if not exists valor_default text;
alter table campos_historia add column if not exists rol text;

alter table campos_historia drop constraint if exists campos_historia_solo_sexo_check;
alter table campos_historia add constraint campos_historia_solo_sexo_check
  check (solo_sexo is null or solo_sexo in ('F', 'M'));

alter table campos_historia drop constraint if exists campos_historia_rol_check;
alter table campos_historia add constraint campos_historia_rol_check
  check (rol is null or rol in ('peso', 'talla', 'imc'));

do $$
declare
  v_tipo   uuid;
  v_padre  uuid;
  v_hijo   uuid;
  v_orden  int;
  r        record;
begin
  select id into v_tipo from tipos_historia
   where nombre = 'Historia Clínica (NOM-004)';
  if v_tipo is null then
    raise notice 'No existe la plantilla NOM-004, no hay nada que ajustar';
    return;
  end if;

  -- Marca de idempotencia: el campo de IMC calculado solo existe tras correr esto.
  if exists (select 1 from campos_historia where tipo_historia_id = v_tipo and rol = 'imc') then
    raise notice 'La captura rápida ya estaba aplicada';
    return;
  end if;

  -- Se multiplica el orden por 10 para poder intercalar las preguntas sí/no
  -- justo antes del campo al que abren.
  update campos_historia set orden = orden * 10 where tipo_historia_id = v_tipo;

  -- ---------------------------------------------------------------- I. Identificación
  update campos_historia set tipo_dato = 'opciones',
         opciones = '["Soltero(a)","Casado(a)","Unión libre","Divorciado(a)","Separado(a)","Viudo(a)"]'::jsonb
   where tipo_historia_id = v_tipo and etiqueta = 'Estado civil';

  update campos_historia set tipo_dato = 'opciones',
         opciones = '["Ninguna","Primaria","Secundaria","Preparatoria","Carrera técnica","Licenciatura","Posgrado"]'::jsonb
   where tipo_historia_id = v_tipo and etiqueta = 'Escolaridad';

  update campos_historia set tipo_dato = 'opciones',
         opciones = '["Católica","Cristiana","Testigo de Jehová","Otra","Ninguna"]'::jsonb
   where tipo_historia_id = v_tipo and etiqueta = 'Religión';

  -- Ocupación se queda como texto libre: Fernanda lo pidió así.

  -- ------------------------------------------- III. Lo que no preguntan en consulta
  update campos_historia set oculto = true
   where tipo_historia_id = v_tipo
     and etiqueta in ('Tipo sanguíneo', 'Toxicomanías / farmacodependencia');

  -- ------------------------------------------------------ IV. Ginecoobstétricos
  update campos_historia set solo_sexo = 'F'
   where tipo_historia_id = v_tipo and seccion = 'IV. Ginecoobstétricos';

  -- ------------------------------------------------------ V. Personales patológicos
  update campos_historia set etiqueta = 'Antecedentes quirúrgicos (últimos 6 meses)'
   where tipo_historia_id = v_tipo and etiqueta = 'Antecedentes quirúrgicos';

  -- Crónico-degenerativas conserva su texto largo: 548 historias importadas ya
  -- traen redacción ahí y convertirla a casillas la perdería. Se acelera
  -- poniéndole enfrente una pregunta de sí/no, como al resto.

  -- ------------------------------- Preguntas sí/no que abren el campo de detalle
  for r in
    select * from (values
      ('III. Personales no patológicos',    'Tabaquismo',                                 '¿Fuma?'),
      ('III. Personales no patológicos',    'Alcohol',                                    '¿Toma alcohol?'),
      ('III. Personales no patológicos',    'Alergias',                                   '¿Tiene alergias?'),
      ('V. Personales patológicos',         'Enfermedades de la infancia',                '¿Tuvo enfermedades en la infancia?'),
      ('V. Personales patológicos',         'Hospitalizaciones previas',                  '¿Ha estado hospitalizado(a)?'),
      ('V. Personales patológicos',         'Antecedentes quirúrgicos (últimos 6 meses)', '¿Lo operaron en los últimos 6 meses?'),
      ('V. Personales patológicos',         'Transfusiones previas',                      '¿Ha recibido transfusiones?'),
      ('V. Personales patológicos',         'Fracturas / traumatismos',                   '¿Ha tenido fracturas o traumatismos?'),
      ('V. Personales patológicos',         'Crónico-degenerativas (DM, HTA, obesidad)',  '¿Tiene alguna enfermedad crónico-degenerativa?'),
      ('VIII. Interrogatorio por aparatos', 'Medicamentos actuales',                      '¿Toma algún medicamento actualmente?')
    ) as t(seccion, hijo, padre)
  loop
    select id, orden into v_hijo, v_orden
      from campos_historia
     where tipo_historia_id = v_tipo and seccion = r.seccion and etiqueta = r.hijo;
    if v_hijo is null then
      raise notice 'No se encontró el campo %, se omite su pregunta sí/no', r.hijo;
      continue;
    end if;

    insert into campos_historia (tipo_historia_id, seccion, etiqueta, tipo_dato, orden, requerido)
    values (v_tipo, r.seccion, r.padre, 'booleano', v_orden - 1, false)
    returning id into v_padre;

    update campos_historia
       set depende_de = v_padre, depende_valor = 'true'
     where id = v_hijo;
  end loop;

  -- ------------------------------------------ VIII. Interrogatorio por aparatos
  -- Una sola pregunta general en vez de recorrer aparato por aparato.
  insert into campos_historia (tipo_historia_id, seccion, etiqueta, tipo_dato, orden, requerido)
  values (v_tipo, 'VIII. Interrogatorio por aparatos',
          '¿Refiere alguna enfermedad o síntoma a destacar?', 'booleano', 595, false)
  returning id into v_padre;

  update campos_historia
     set depende_de = v_padre, depende_valor = 'true'
   where tipo_historia_id = v_tipo
     and seccion = 'VIII. Interrogatorio por aparatos'
     and etiqueta in (
       'Respiratorio / Cardiovascular',
       'Digestivo',
       'Endocrino',
       'Músculo-esquelético',
       'Piel y anexos',
       'Neurológico y psiquiátrico'
     );

  -- ------------------------------------------------------- IX. Ficha clínica
  update campos_historia set rol = 'talla' where tipo_historia_id = v_tipo and etiqueta = 'Talla (m)';
  update campos_historia set rol = 'peso'  where tipo_historia_id = v_tipo and etiqueta = 'Peso (kg)';

  insert into campos_historia (tipo_historia_id, seccion, etiqueta, tipo_dato, orden, requerido, rol)
  values (v_tipo, 'IX. Ficha clínica', 'IMC', 'numero', 755, false, 'imc');

  raise notice 'Captura rápida aplicada a la plantilla NOM-004';
end $$;
