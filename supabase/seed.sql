-- ============================================================================
-- FED-004A · Semilla sintética para entornos aislados de prueba.
--
-- Todo lo que hay aquí es inventado. Ni un solo dato viene de la operación de
-- la doctora. Los correos usan el TLD reservado `.test` (RFC 2606), que no
-- puede existir en internet, y todo paciente lleva el prefijo `PRUEBA` en el
-- nombre para que sea imposible confundirlo con una persona real.
--
-- Este archivo se ejecuta normalmente con `supabase db reset` sobre la base
-- local. También puede cargarse en un proyecto remoto dedicado exclusivamente
-- a pruebas, después de verificar su project ref fuera de esta transacción.
-- El guardia de abajo aborta si encuentra rastros de datos no sintéticos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Guardia. Si esta base tiene una sola cuenta o un solo paciente que no sea de
-- prueba, no es un entorno aislado y la semilla se niega a escribir.
-- ----------------------------------------------------------------------------
do $$
declare
  v_cuentas int;
  v_pacientes int;
begin
  select count(*) into v_cuentas
    from auth.users where email is null or email not like '%@fedra.test';
  if v_cuentas > 0 then
    raise exception
      'FED-004A abortado: la base tiene % cuenta(s) fuera de @fedra.test. Esta semilla solo corre en entornos aislados.', v_cuentas;
  end if;

  select count(*) into v_pacientes
    from public.pacientes where coalesce(nombre, '') not like 'PRUEBA %';
  if v_pacientes > 0 then
    raise exception
      'FED-004A abortado: la base tiene % paciente(s) que no son de prueba. Esta semilla solo corre en entornos aislados.', v_pacientes;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1. Identidades. Una por rol.
--
-- Se crean en auth.users y el trigger `handle_new_user` genera el perfil en
-- `usuarios`. Por eso el rol se fija después: el trigger reparte 'admin' a la
-- primera cuenta y 'asistente' al resto. Los perfiles se referencian por
-- correo en el resto del archivo, no por un id inventado, porque su id lo
-- decide el trigger.
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  d.id, 'authenticated', 'authenticated', d.email,
  extensions.crypt('Prueba-FED004A!', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('nombre', d.nombre),
  '', '', '', ''
from (values
  ('7c1f9a20-3b64-4d81-9f02-5ae6c8d41b73'::uuid, 'admin@fedra.test',     'PRUEBA Admin del Sistema'),
  ('2e8b47d5-91cc-4a06-b3f7-6d20e9147a5c'::uuid, 'doctora@fedra.test',   'PRUEBA Doctora Titular'),
  ('b4d60e19-7f35-4c92-8a1d-03be5719cf46'::uuid, 'farmacia@fedra.test',  'PRUEBA Mostrador Farmacia'),
  ('58a3c7f2-06de-4b17-95c8-e1427d6b9a03'::uuid, 'asistente@fedra.test', 'PRUEBA Asistente Consultorio'),
  ('9f27b3e8-4c50-41da-8e6b-72c9508d3f14'::uuid, 'gerente@fedra.test',   'PRUEBA Gerente Operativo')
) as d(id, email, nombre)
order by d.email = 'admin@fedra.test' desc;

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@fedra.test';

update public.usuarios set rol = 'admin'::rol_usuario,     nombre = 'PRUEBA Admin del Sistema'     where email = 'admin@fedra.test';
update public.usuarios set rol = 'doctora'::rol_usuario,   nombre = 'PRUEBA Doctora Titular'       where email = 'doctora@fedra.test';
update public.usuarios set rol = 'farmacia'::rol_usuario,  nombre = 'PRUEBA Mostrador Farmacia'    where email = 'farmacia@fedra.test';
update public.usuarios set rol = 'asistente'::rol_usuario, nombre = 'PRUEBA Asistente Consultorio' where email = 'asistente@fedra.test';
update public.usuarios set rol = 'gerente'::rol_usuario,   nombre = 'PRUEBA Gerente Operativo'     where email = 'gerente@fedra.test';

-- ----------------------------------------------------------------------------
-- 2. Catálogos. `tipos_historia` y `campos_historia` ya vienen de las
-- migraciones 8, 12, 13, 17 y 18, así que aquí no se tocan para no duplicar.
-- ----------------------------------------------------------------------------
insert into public.categorias (id, nombre) values
  ('a3f5c81d-27b9-4e60-bd14-8f9026c5713a', 'PRUEBA Medicamento'),
  ('d7e04b62-5a13-49cf-8207-4b6ce18f39d5', 'PRUEBA Suplemento');

insert into public.proveedores (id, nombre, contacto, rfc) values
  ('6be1470c-9d38-4f25-a17b-2c04e8f5d316', 'PRUEBA Distribuidora del Valle', 'Contacto de prueba', 'XAXX010101000');

insert into public.servicios (id, nombre, categoria, precio) values
  ('a3315e40-d76e-455e-9341-5f31b4832c28', 'PRUEBA Consulta de control', 'otro',   600.00),
  ('43c486b7-9a15-4b17-be13-60fd7a1d8f8f', 'PRUEBA Fase de tratamiento', 'fase',  2500.00),
  ('a10c067e-d4fa-4711-b14b-b9e6f2ace5bd',  'PRUEBA Limpieza facial',     'facial', 900.00);

-- ----------------------------------------------------------------------------
-- 3. Productos y lotes.
-- Uno controlado (entra al Libro de Control), dos que exigen receta, y uno por
-- debajo de su stock mínimo para que el cron de alertas tenga qué reportar.
-- ----------------------------------------------------------------------------
insert into public.productos
  (id, nombre, categoria_id, descripcion, precio_venta, stock_minimo,
   requiere_receta, es_controlado, fraccion_cofepris, unidad, codigo_barras) values
  ('ad0cd49a-9eaa-4019-84e4-7e9bb681afdd',  'PRUEBA Metformina 850 mg',  'a3f5c81d-27b9-4e60-bd14-8f9026c5713a',
   'Caja con 30 tabletas. Dato sintético.', 185.50, 40, true,  false, 'na', 'caja', '7500000000017'),
  ('0cab3dfb-fa7c-4010-9fec-d9bfd7cb3fae', 'PRUEBA Clonazepam 2 mg',    'a3f5c81d-27b9-4e60-bd14-8f9026c5713a',
   'Controlado fracción II. Dato sintético.', 240.00, 10, true, true,  'II', 'caja', '7500000000024'),
  ('2b18af85-074d-480f-9c86-e9b9a1e0b961',  'PRUEBA Vitamina D3 5000UI', 'd7e04b62-5a13-49cf-8207-4b6ce18f39d5',
   'Frasco con 60 cápsulas. Dato sintético.', 320.00, 25, false, false, 'na', 'frasco', '7500000000031'),
  ('2d524237-7c7a-432d-8d65-4f1f7d3ca401', 'PRUEBA Proteína en polvo',  'd7e04b62-5a13-49cf-8207-4b6ce18f39d5',
   'Bote de 900 g. Dato sintético.', 890.00, 20, false, false, 'na', 'bote', '7500000000048');

insert into public.lotes (id, producto_id, lote, caducidad, cantidad_actual, costo) values
  ('7bd3436f-218e-43ac-9457-f275375ddf8f', 'ad0cd49a-9eaa-4019-84e4-7e9bb681afdd',  'PR-MET-2401', current_date + interval '18 months', 120,  92.00),
  ('b2fececd-abc5-4989-9170-dddce05bbcda', 'ad0cd49a-9eaa-4019-84e4-7e9bb681afdd',  'PR-MET-2402', current_date + interval '25 days',    30,  92.00),
  ('e47e4b96-20fe-43c7-a761-f246eb200492',  '0cab3dfb-fa7c-4010-9fec-d9bfd7cb3fae', 'PR-CLO-2401', current_date + interval '11 months',  40, 130.00),
  ('ce178c4e-8b7d-4d89-8a74-af5241bb73d2',   '2b18af85-074d-480f-9c86-e9b9a1e0b961',  'PR-VIT-2401', current_date + interval '30 months', 195, 160.00),
  ('6cdf70be-51e0-49ef-bcde-f055cc0e20a9',  '2d524237-7c7a-432d-8d65-4f1f7d3ca401', 'PR-PRO-2401', current_date + interval '8 months',   15, 470.00);

-- ----------------------------------------------------------------------------
-- 4. Pacientes. Todos con prefijo PRUEBA. La tercera no tiene teléfono, para
-- que exista el caso de una paciente a la que no se le puede mandar
-- recordatorio.
-- ----------------------------------------------------------------------------
insert into public.pacientes
  (id, nombre, apellidos, fecha_nac, sexo, telefono_wpp, email,
   peso_inicial, cintura_inicial, notas, creado_por, direccion) values
  ('27e8af7e-5565-4791-b714-70ed415e0242', 'PRUEBA Ana', 'Sintética Ficticia', '1990-04-12', 'F', '+520000000001',
   'ana@fedra.test', 78.40, 92.00, 'Paciente inventada para pruebas.',
   (select id from public.usuarios where email = 'asistente@fedra.test'), 'Calle Falsa 000, Los Mochis'),
  ('940b3028-51f4-4329-8842-d18414cba887', 'PRUEBA Beatriz', 'Inventada Prueba', '1985-11-30', 'F', '+520000000002',
   'beatriz@fedra.test', 91.10, 104.50, 'Paciente inventada para pruebas.',
   (select id from public.usuarios where email = 'asistente@fedra.test'), 'Avenida Ejemplo 000, Los Mochis'),
  ('79aa2d23-15c6-4c53-8aa2-be3f1b13c96c', 'PRUEBA Carmen', 'Simulada Datos', '2001-07-05', 'F', null,
   null, 64.00, 80.20, 'Sin teléfono a propósito: no se le puede recordar cita.',
   (select id from public.usuarios where email = 'doctora@fedra.test'), null);

-- ----------------------------------------------------------------------------
-- 5. Compra de proveedor. Es la ENTRADA que sostiene todo el inventario.
-- ----------------------------------------------------------------------------
insert into public.compras (id, proveedor_id, factura, fecha, total, usuario_id) values
  ('343c16d1-4be6-4187-a4c9-b650a6e09d11', '6be1470c-9d38-4f25-a17b-2c04e8f5d316', 'PRUEBA-A-000123',
   current_date - interval '20 days', 63520.00,
   (select id from public.usuarios where email = 'farmacia@fedra.test'));

insert into public.compra_items (compra_id, producto_id, lote_id, cantidad, costo_unit) values
  ('343c16d1-4be6-4187-a4c9-b650a6e09d11', 'ad0cd49a-9eaa-4019-84e4-7e9bb681afdd',  '7bd3436f-218e-43ac-9457-f275375ddf8f', 150,  92.00),
  ('343c16d1-4be6-4187-a4c9-b650a6e09d11', 'ad0cd49a-9eaa-4019-84e4-7e9bb681afdd',  'b2fececd-abc5-4989-9170-dddce05bbcda',  30,  92.00),
  ('343c16d1-4be6-4187-a4c9-b650a6e09d11', '0cab3dfb-fa7c-4010-9fec-d9bfd7cb3fae', 'e47e4b96-20fe-43c7-a761-f246eb200492',   50, 130.00),
  ('343c16d1-4be6-4187-a4c9-b650a6e09d11', '2b18af85-074d-480f-9c86-e9b9a1e0b961',  'ce178c4e-8b7d-4d89-8a74-af5241bb73d2',   200, 160.00),
  ('343c16d1-4be6-4187-a4c9-b650a6e09d11', '2d524237-7c7a-432d-8d65-4f1f7d3ca401', '6cdf70be-51e0-49ef-bcde-f055cc0e20a9',   18, 470.00);

insert into public.movimientos_inv
  (producto_id, lote_id, tipo, cantidad, motivo, referencia_id, usuario_id, fecha) values
  ('ad0cd49a-9eaa-4019-84e4-7e9bb681afdd',  '7bd3436f-218e-43ac-9457-f275375ddf8f', 'entrada', 150, 'Compra a proveedor', '343c16d1-4be6-4187-a4c9-b650a6e09d11',
   (select id from public.usuarios where email = 'farmacia@fedra.test'), now() - interval '20 days'),
  ('ad0cd49a-9eaa-4019-84e4-7e9bb681afdd',  'b2fececd-abc5-4989-9170-dddce05bbcda', 'entrada',  30, 'Compra a proveedor', '343c16d1-4be6-4187-a4c9-b650a6e09d11',
   (select id from public.usuarios where email = 'farmacia@fedra.test'), now() - interval '20 days'),
  ('0cab3dfb-fa7c-4010-9fec-d9bfd7cb3fae', 'e47e4b96-20fe-43c7-a761-f246eb200492',  'entrada',  50, 'Compra a proveedor', '343c16d1-4be6-4187-a4c9-b650a6e09d11',
   (select id from public.usuarios where email = 'farmacia@fedra.test'), now() - interval '20 days'),
  ('2b18af85-074d-480f-9c86-e9b9a1e0b961',  'ce178c4e-8b7d-4d89-8a74-af5241bb73d2',   'entrada', 200, 'Compra a proveedor', '343c16d1-4be6-4187-a4c9-b650a6e09d11',
   (select id from public.usuarios where email = 'farmacia@fedra.test'), now() - interval '20 days'),
  ('2d524237-7c7a-432d-8d65-4f1f7d3ca401', '6cdf70be-51e0-49ef-bcde-f055cc0e20a9',  'entrada',  18, 'Compra a proveedor', '343c16d1-4be6-4187-a4c9-b650a6e09d11',
   (select id from public.usuarios where email = 'farmacia@fedra.test'), now() - interval '20 days');

-- ----------------------------------------------------------------------------
-- 6. Ventas de mostrador. Una en efectivo y una con pago dividido, para que el
-- corte de caja tenga los dos casos. Cada renglón tiene su salida de
-- inventario, y las cantidades cuadran con lo que quedó en los lotes.
-- ----------------------------------------------------------------------------
insert into public.ventas (id, paciente_id, usuario_id, fecha, subtotal, total, metodo_pago, estado) values
  ('bf332d77-345c-452a-b296-6eb886c8851a', '27e8af7e-5565-4791-b714-70ed415e0242', (select id from public.usuarios where email = 'farmacia@fedra.test'),
   now() - interval '3 days', 5310.00, 5310.00, 'efectivo', 'pagada'),
  ('6699c9cb-8dba-443a-a888-fdd83754a5cd', null,    (select id from public.usuarios where email = 'farmacia@fedra.test'),
   now() - interval '1 day',  4525.00, 4525.00, 'otro',     'pagada');

insert into public.venta_items (venta_id, producto_id, lote_id, cantidad, precio_unit) values
  ('bf332d77-345c-452a-b296-6eb886c8851a', 'ad0cd49a-9eaa-4019-84e4-7e9bb681afdd',  '7bd3436f-218e-43ac-9457-f275375ddf8f', 20, 185.50),
  ('bf332d77-345c-452a-b296-6eb886c8851a', '2b18af85-074d-480f-9c86-e9b9a1e0b961',  'ce178c4e-8b7d-4d89-8a74-af5241bb73d2',    5, 320.00),
  ('6699c9cb-8dba-443a-a888-fdd83754a5cd', '2d524237-7c7a-432d-8d65-4f1f7d3ca401', '6cdf70be-51e0-49ef-bcde-f055cc0e20a9',   3, 890.00),
  ('6699c9cb-8dba-443a-a888-fdd83754a5cd', 'ad0cd49a-9eaa-4019-84e4-7e9bb681afdd',  '7bd3436f-218e-43ac-9457-f275375ddf8f', 10, 185.50);

insert into public.pagos (venta_id, monto, metodo, fecha) values
  ('bf332d77-345c-452a-b296-6eb886c8851a', 5310.00, 'efectivo',      now() - interval '3 days'),
  ('6699c9cb-8dba-443a-a888-fdd83754a5cd', 2000.00, 'efectivo',      now() - interval '1 day'),
  ('6699c9cb-8dba-443a-a888-fdd83754a5cd', 2525.00, 'tarjeta',       now() - interval '1 day');

insert into public.movimientos_inv
  (producto_id, lote_id, tipo, cantidad, motivo, referencia_id, usuario_id, fecha) values
  ('ad0cd49a-9eaa-4019-84e4-7e9bb681afdd',  '7bd3436f-218e-43ac-9457-f275375ddf8f', 'salida', 20, 'Venta de mostrador', 'bf332d77-345c-452a-b296-6eb886c8851a',
   (select id from public.usuarios where email = 'farmacia@fedra.test'), now() - interval '3 days'),
  ('2b18af85-074d-480f-9c86-e9b9a1e0b961',  'ce178c4e-8b7d-4d89-8a74-af5241bb73d2',   'salida',  5, 'Venta de mostrador', 'bf332d77-345c-452a-b296-6eb886c8851a',
   (select id from public.usuarios where email = 'farmacia@fedra.test'), now() - interval '3 days'),
  ('2d524237-7c7a-432d-8d65-4f1f7d3ca401', '6cdf70be-51e0-49ef-bcde-f055cc0e20a9',  'salida',  3, 'Venta de mostrador', '6699c9cb-8dba-443a-a888-fdd83754a5cd',
   (select id from public.usuarios where email = 'farmacia@fedra.test'), now() - interval '1 day'),
  ('ad0cd49a-9eaa-4019-84e4-7e9bb681afdd',  '7bd3436f-218e-43ac-9457-f275375ddf8f', 'salida', 10, 'Venta de mostrador', '6699c9cb-8dba-443a-a888-fdd83754a5cd',
   (select id from public.usuarios where email = 'farmacia@fedra.test'), now() - interval '1 day'),
  ('0cab3dfb-fa7c-4010-9fec-d9bfd7cb3fae', 'e47e4b96-20fe-43c7-a761-f246eb200492',  'merma',  10, 'Caja dañada en almacén', null,
   (select id from public.usuarios where email = 'admin@fedra.test'), now() - interval '5 days');

-- ----------------------------------------------------------------------------
-- 7. Consultorio: consulta, tratamiento, fase, historias, receta y agenda.
-- ----------------------------------------------------------------------------
insert into public.consultas (id, paciente_id, doctora_id, fecha, motivo, costo, incluye_medicamento) values
  ('7ca07e7c-461f-4421-9847-3f56c79f5a7b', '27e8af7e-5565-4791-b714-70ed415e0242', (select id from public.usuarios where email = 'doctora@fedra.test'),
   now() - interval '3 days', 'Control de peso, dato sintético', 600.00, true);

insert into public.tratamientos (id, paciente_id, tipo, inicio, estado) values
  ('e1776dcf-12ee-417d-9479-ffc10dc166ad', '940b3028-51f4-4329-8842-d18414cba887', 'combinado', current_date - interval '60 days', 'activo');

insert into public.fases (id, tratamiento_id, numero, peso_actual, cintura_actual, peso_perdido, meta_siguiente, fecha) values
  ('46ee24a9-f6ba-4b5e-b76b-a566df149324', 'e1776dcf-12ee-417d-9479-ffc10dc166ad', 2, 86.30, 99.00, 4.80, 'Bajar 3 kg en la fase 3', current_date - interval '15 days');

insert into public.historias_clinicas (id, paciente_id, tipo_historia_id, fecha, datos, doctora_id) values
  ('7e3fb0c8-862a-41cd-a70d-277e61dbfb8d', '27e8af7e-5565-4791-b714-70ed415e0242', (select id from public.tipos_historia where nombre = 'General' limit 1),
   now() - interval '3 days',
   '{"¿Toma algún medicamento?": "Ninguno (dato sintético)", "¿Tiene alguna enfermedad?": "No"}'::jsonb,
   (select id from public.usuarios where email = 'doctora@fedra.test')),
  ('ca772486-efd1-4eb3-943b-25c101ef0153', '940b3028-51f4-4329-8842-d18414cba887', (select id from public.tipos_historia where nombre = 'InBody' limit 1),
   now() - interval '15 days',
   '{"Peso (kg)": "86.3", "Grasa corporal (%)": "38.1", "Masa muscular (kg)": "27.4"}'::jsonb,
   (select id from public.usuarios where email = 'doctora@fedra.test'));

insert into public.recetas (id, paciente_id, consulta_id, fase, fecha, estado, metricas) values
  ('cf5ce875-8418-4b05-9a23-67996fe28511', '27e8af7e-5565-4791-b714-70ed415e0242', '7ca07e7c-461f-4421-9847-3f56c79f5a7b', 1, now() - interval '3 days', 'emitida',
   '{"peso": "78.4", "cintura": "92.0"}'::jsonb);

insert into public.receta_items (receta_id, producto_id, medicamento, dosis, duracion_dias, indicaciones) values
  ('cf5ce875-8418-4b05-9a23-67996fe28511', 'ad0cd49a-9eaa-4019-84e4-7e9bb681afdd', null, '1 tableta con la cena', 30, 'Tomar con alimentos. Indicación sintética.'),
  ('cf5ce875-8418-4b05-9a23-67996fe28511', null, 'PRUEBA Complejo B (fuera de catálogo)', '1 cápsula al día', 30, 'Indicación sintética.');

insert into public.citas (id, paciente_id, doctora_id, fecha_hora, estado, limite_confirmacion, tipo, titulo, notas) values
  ('f29b5147-cd66-4557-8851-4a0eba8dc699', '27e8af7e-5565-4791-b714-70ed415e0242', (select id from public.usuarios where email = 'doctora@fedra.test'),
   now() + interval '2 days', 'agendada', now() + interval '1 day', 'cita_paciente', null, 'Cita sintética futura'),
  ('dc46ff53-148b-42cf-87ba-d771d5f2bac1', '940b3028-51f4-4329-8842-d18414cba887', (select id from public.usuarios where email = 'doctora@fedra.test'),
   now() - interval '15 days', 'atendida', null, 'cita_paciente', null, 'Cita sintética ya atendida'),
  ('757e9f1c-716f-409f-94bf-c40eb0ac5f44', '79aa2d23-15c6-4c53-8aa2-be3f1b13c96c', (select id from public.usuarios where email = 'doctora@fedra.test'),
   now() + interval '9 days', 'agendada', now() + interval '8 days', 'cita_paciente', null,
   'Paciente sin teléfono: no se le puede recordar');

insert into public.seguimientos (paciente_id, fecha, nota, alerta_en) values
  ('940b3028-51f4-4329-8842-d18414cba887', now() - interval '10 days', 'Seguimiento sintético de fase 2.', now() + interval '5 days');

-- ----------------------------------------------------------------------------
-- 8. Cobros del consultorio, con su desglose de pago.
-- ----------------------------------------------------------------------------
insert into public.cobros (id, paciente_id, fecha, total, nota, doctora_id, estado) values
  ('4a59181f-f70c-4cb4-bcbc-8fae5166aecf', '27e8af7e-5565-4791-b714-70ed415e0242', now() - interval '3 days', 1500.00, 'Cobro sintético',
   (select id from public.usuarios where email = 'doctora@fedra.test'), 'activo'),
  ('3493c54c-f40d-4cac-b8d6-cd8a4726bc19', '940b3028-51f4-4329-8842-d18414cba887', now() - interval '1 day',  2500.00, 'Cobro sintético',
   (select id from public.usuarios where email = 'doctora@fedra.test'), 'activo');

insert into public.cobro_items (cobro_id, servicio_id, descripcion, afeccion, cantidad, precio_unit, descuento, subtotal) values
  ('4a59181f-f70c-4cb4-bcbc-8fae5166aecf', 'a3315e40-d76e-455e-9341-5f31b4832c28', null, null, 1,  600.00, 0,  600.00),
  ('4a59181f-f70c-4cb4-bcbc-8fae5166aecf', 'a10c067e-d4fa-4711-b14b-b9e6f2ace5bd',  null, null, 1,  900.00, 0,  900.00),
  ('3493c54c-f40d-4cac-b8d6-cd8a4726bc19', '43c486b7-9a15-4b17-be13-60fd7a1d8f8f', null, null, 1, 2500.00, 0, 2500.00);

insert into public.cobro_pagos (cobro_id, monto, metodo, fecha) values
  ('4a59181f-f70c-4cb4-bcbc-8fae5166aecf', 1500.00, 'efectivo',      now() - interval '3 days'),
  ('3493c54c-f40d-4cac-b8d6-cd8a4726bc19', 2500.00, 'transferencia', now() - interval '1 day');

-- ----------------------------------------------------------------------------
-- 9. Un corte de caja ya cerrado y cuadrado.
-- ----------------------------------------------------------------------------
insert into public.cortes_caja
  (id, usuario_id, apertura, cierre, fondo, total_efectivo, total_ventas, diferencia,
   total_cobros, total_productos, pacientes_atendidos, efectivo_contado, desglose) values
  ('6137a2f2-da97-4c58-9c9a-b2714e8daae4', (select id from public.usuarios where email = 'admin@fedra.test'),
   now() - interval '3 days' - interval '9 hours', now() - interval '3 days',
   500.00, 8810.00, 9835.00, 0.00, 4000.00, 38, 2, 8810.00,
   '{"efectivo": 8810.00, "tarjeta": 2525.00, "transferencia": 2500.00}'::jsonb);

-- ============================================================================
-- 10. Verificación de la propia semilla.
--
-- Si algo de esto falla, "supabase db reset" termina en error y la corrida de
-- integración continua se cae. Una semilla que se aplica a medias y sigue
-- adelante es peor que no tener semilla.
-- ============================================================================
do $verificacion$
declare
  v_msg text;
  v_n int;
begin
  -- Un usuario por rol, cada uno con identidad en Auth.
  select count(*) into v_n from public.usuarios where auth_uid is not null;
  if v_n <> 5 then
    raise exception 'Semilla inválida: se esperaban 5 perfiles con identidad, hay %.', v_n;
  end if;
  select count(distinct rol) into v_n from public.usuarios where auth_uid is not null;
  if v_n <> 5 then
    raise exception 'Semilla inválida: los 5 perfiles no cubren los 5 roles.';
  end if;

  -- Todo paciente es de prueba.
  select count(*) into v_n from public.pacientes where nombre not like 'PRUEBA %';
  if v_n > 0 then
    raise exception 'Semilla inválida: % paciente(s) sin el prefijo PRUEBA.', v_n;
  end if;

  -- Inventario: la existencia de cada lote es exactamente entradas menos salidas.
  select string_agg(format('lote %s: lotes=%s movimientos=%s', l.lote, l.cantidad_actual, m.saldo), '; ')
    into v_msg
  from public.lotes l
  join (
    select lote_id,
           sum(case when tipo = 'entrada' then cantidad
                    when tipo in ('salida','merma') then -cantidad
                    else 0 end) as saldo
    from public.movimientos_inv group by lote_id
  ) m on m.lote_id = l.id
  where l.cantidad_actual <> m.saldo;
  if v_msg is not null then
    raise exception 'Semilla inválida: el inventario no cuadra con los movimientos. %', v_msg;
  end if;

  -- Cada venta vale lo que suman sus renglones, y sus pagos la cubren exactamente.
  select string_agg(format('venta %s: total=%s renglones=%s', v.id, v.total, i.suma), '; ')
    into v_msg
  from public.ventas v
  join (select venta_id, sum(cantidad * precio_unit) as suma from public.venta_items group by venta_id) i
    on i.venta_id = v.id
  where v.total <> i.suma;
  if v_msg is not null then
    raise exception 'Semilla inválida: hay ventas cuyo total no es la suma de sus renglones. %', v_msg;
  end if;

  select string_agg(format('venta %s: total=%s pagos=%s', v.id, v.total, p.suma), '; ')
    into v_msg
  from public.ventas v
  join (select venta_id, sum(monto) as suma from public.pagos group by venta_id) p on p.venta_id = v.id
  where v.total <> p.suma;
  if v_msg is not null then
    raise exception 'Semilla inválida: hay ventas cuyos pagos no cubren el total. %', v_msg;
  end if;

  -- Lo mismo para los cobros del consultorio.
  select string_agg(format('cobro %s: total=%s renglones=%s', c.id, c.total, i.suma), '; ')
    into v_msg
  from public.cobros c
  join (select cobro_id, sum(subtotal) as suma from public.cobro_items group by cobro_id) i
    on i.cobro_id = c.id
  where c.total <> i.suma;
  if v_msg is not null then
    raise exception 'Semilla inválida: hay cobros cuyo total no es la suma de sus renglones. %', v_msg;
  end if;

  select string_agg(format('cobro %s: total=%s pagos=%s', c.id, c.total, p.suma), '; ')
    into v_msg
  from public.cobros c
  join (select cobro_id, sum(monto) as suma from public.cobro_pagos group by cobro_id) p
    on p.cobro_id = c.id
  where c.total <> p.suma;
  if v_msg is not null then
    raise exception 'Semilla inválida: hay cobros cuyos pagos no cubren el total. %', v_msg;
  end if;

  raise notice 'FED-004A: semilla sintética aplicada y verificada.';
end
$verificacion$;
