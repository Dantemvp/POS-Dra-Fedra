-- H-035 · Quién puede ejecutar qué, medido contra la base y no contra el texto
-- de las migraciones.
--
-- Este archivo existe porque el paso de GRANT de `fed004a-rls.yml` corría
-- `grant all on all functions in schema public` después de las migraciones y le
-- devolvía a `anon` el `execute` que `20260824020537` acababa de quitarle. La
-- integración continua quedaba verde afirmando una protección que en ese mismo
-- entorno no existía, que es la peor clase de prueba: la que tranquiliza.
--
-- Se corre con psql contra la base local de la corrida, después de aplicar las
-- migraciones y de conceder los privilegios de tablas, para medir exactamente
-- el estado contra el que se ejecutan las pruebas de políticas.
--
-- Imprime siempre la matriz completa, incluso cuando pasa. Si algún día falla,
-- el log ya trae el estado real de los tres roles y no hay que adivinarlo.

do $$
declare
  caso     record;
  permitido boolean;
  faltas   text[] := '{}';
  lineas   text[] := '{}';
  n        int := 0;
begin
  for caso in
    select * from (values
      -- Helpers de autorización. `anon` no ejecuta ninguno: sin sesión no hay
      -- rol que consultar, y dejárselos abiertos es regalar un oráculo.
      ('anon',          'public.current_rol()',                                        false),
      ('authenticated', 'public.current_rol()',                                        true),

      -- Los cuatro auxiliares de FED-014. `service_role` los necesita de verdad:
      -- `usuario_actual_id()` es el valor por omisión de
      -- `documentos_clinicos.subido_por`, y una columna con valor por omisión se
      -- evalúa con los privilegios de quien inserta.
      ('anon',          'public.usuario_actual_id()',                                  false),
      ('authenticated', 'public.usuario_actual_id()',                                  true),
      ('service_role',  'public.usuario_actual_id()',                                  true),
      ('anon',          'public.es_paciente_existente(text)',                          false),
      ('authenticated', 'public.es_paciente_existente(text)',                          true),
      ('service_role',  'public.es_paciente_existente(text)',                          true),
      ('anon',          'public.existe_objeto_archivos(text)',                         false),
      ('authenticated', 'public.existe_objeto_archivos(text)',                         true),
      ('service_role',  'public.existe_objeto_archivos(text)',                         true),
      ('anon',          'public.es_objeto_de_producto(text)',                          false),
      ('authenticated', 'public.es_objeto_de_producto(text)',                          true),
      ('service_role',  'public.es_objeto_de_producto(text)',                          true),

      -- RPC de dinero. Las ejecuta una sesión con rol, nunca la llave anónima.
      ('anon',          'public.cancelar_cobro(uuid)',                                 false),
      ('authenticated', 'public.cancelar_cobro(uuid)',                                 true),
      ('anon',          'public.eliminar_cobro(uuid)',                                 false),
      ('authenticated', 'public.eliminar_cobro(uuid)',                                 true),
      ('anon',          'public.eliminar_compra(uuid)',                                false),
      ('authenticated', 'public.eliminar_compra(uuid)',                                true),
      ('anon',          'public.productos_de_receta(bigint)',                          false),
      ('authenticated', 'public.productos_de_receta(bigint)',                          true),
      ('anon',          'public.registrar_cobro(uuid, public.metodo_pago, text, jsonb)', false),
      ('authenticated', 'public.registrar_cobro(uuid, public.metodo_pago, text, jsonb)', true),

      -- Funciones de disparador. No son endpoints para nadie, tampoco para la
      -- llave de servicio. PostgreSQL no comprueba este privilegio al disparar
      -- un trigger, así que revocarlo no apaga la auditoría: lo comprueban las
      -- pruebas de `auditoria.test.mts`, que miden por efecto.
      ('anon',          'public.fn_audit()',                                           false),
      ('authenticated', 'public.fn_audit()',                                           false),
      ('service_role',  'public.fn_audit()',                                           false),
      ('anon',          'public.handle_new_user()',                                    false),
      ('authenticated', 'public.handle_new_user()',                                    false),
      ('service_role',  'public.handle_new_user()',                                    false),
      ('anon',          'public.fn_retiros_clinicos_inmutable()',                      false),
      ('authenticated', 'public.fn_retiros_clinicos_inmutable()',                      false),
      ('service_role',  'public.fn_retiros_clinicos_inmutable()',                      false)
    ) as t(rol, firma, debe_poder)
  loop
    n := n + 1;

    -- Una firma que no existe haría que `has_function_privilege` reventara con
    -- un mensaje que no dice nada. Peor: si algún día se renombra una función,
    -- una comprobación que espera "no puede" pasaría por no existir el objeto.
    if to_regprocedure(caso.firma) is null then
      faltas := faltas || format('la función %s no existe', caso.firma);
      continue;
    end if;

    permitido := has_function_privilege(caso.rol, caso.firma, 'execute');
    lineas := lineas || format('%-14s %-52s %s',
      caso.rol, caso.firma, case when permitido then 'ejecuta' else 'no ejecuta' end);

    if permitido <> caso.debe_poder then
      faltas := faltas || format('%s: %s',
        caso.firma,
        case
          when caso.debe_poder then format('%s debería poder ejecutarla y no puede', caso.rol)
          else format('%s NO debería poder ejecutarla y sí puede', caso.rol)
        end);
    end if;
  end loop;

  raise notice E'Privilegios de ejecución medidos (% comprobaciones):\n%',
    n, array_to_string(lineas, E'\n');

  if array_length(faltas, 1) > 0 then
    raise exception E'Privilegios de ejecución incorrectos:\n  - %',
      array_to_string(faltas, E'\n  - ');
  end if;
end $$;
