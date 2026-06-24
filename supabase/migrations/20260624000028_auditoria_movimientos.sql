-- ============================================================================
-- "Movimientos": bitácora de actividad del personal para admin/Dra.
--   1) fn_audit ahora guarda ANTERIOR + NUEVO (para ver qué cambió, ej.
--      precio $650 → $600). Compatible hacia atrás: las filas viejas tienen
--      `datos` plano; las nuevas tienen {anterior, nuevo}.
--   2) Se amplían las tablas auditadas a las acciones sensibles que un gerente
--      con permisos podría hacer: stock (lotes), cobros + sus renglones
--      (descuentos), renglones de receta, servicios/precios, compras, historias.
-- ============================================================================

create or replace function fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid;
begin
  select id into uid from usuarios where auth_uid = auth.uid() limit 1;
  insert into audit_log(usuario_id, accion, tabla, registro_id, datos)
  values (
    uid, tg_op, tg_table_name,
    coalesce(new.id::text, old.id::text),
    case
      when tg_op = 'INSERT' then jsonb_build_object('nuevo', to_jsonb(new))
      when tg_op = 'DELETE' then jsonb_build_object('anterior', to_jsonb(old))
      else jsonb_build_object('anterior', to_jsonb(old), 'nuevo', to_jsonb(new))
    end
  );
  return coalesce(new, old);
end $$;

-- Ampliar cobertura de auditoría (idempotente).
do $$
declare t text;
begin
  foreach t in array array[
    'lotes','cobros','cobro_items','receta_items',
    'servicios','compras','compra_items','historias_clinicas'
  ]
  loop
    execute format('drop trigger if exists audit_%1$s on public.%1$I;', t);
    execute format($f$
      create trigger audit_%1$s after insert or update or delete on public.%1$I
      for each row execute function fn_audit();
    $f$, t);
  end loop;
end $$;
