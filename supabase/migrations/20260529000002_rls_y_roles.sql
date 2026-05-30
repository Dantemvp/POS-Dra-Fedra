-- ============================================================================
-- RLS y roles — esqueleto de seguridad
-- Resuelve el agujero #1 de v5: TODAS las tablas tenían filtro 'none'.
-- Modelo: admin (todo) | farmacia (POS/inventario + lee pacientes) |
--         doctora (clínica + lee farmacia) | asistente (agenda/pacientes).
-- NOTA: esqueleto inicial — afinar con Raúl antes de producción.
-- ============================================================================

-- Helper: rol del usuario autenticado
create or replace function current_rol()
returns rol_usuario
language sql stable security definer
as $$
  select rol from usuarios where auth_uid = auth.uid() limit 1;
$$;

create or replace function es_admin() returns boolean
language sql stable as $$ select current_rol() = 'admin'; $$;

-- ----------------------------------------------------------------------------
-- Habilitar RLS en todas las tablas
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename not like 'pg_%'
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Política base: admin todo
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname='public'
  loop
    execute format($f$
      create policy "admin_all_%1$s" on public.%1$I
      for all using (es_admin()) with check (es_admin());
    $f$, t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- FARMACIA: gestiona POS e inventario; lee pacientes
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'categorias','proveedores','productos','lotes','compras','compra_items',
    'movimientos_inv','ventas','venta_items','pagos','cortes_caja'
  ]
  loop
    execute format($f$
      create policy "farmacia_%1$s" on public.%1$I
      for all using (current_rol() in ('farmacia','admin'))
      with check (current_rol() in ('farmacia','admin'));
    $f$, t);
  end loop;
end $$;

create policy "farmacia_lee_pacientes" on pacientes
  for select using (current_rol() in ('farmacia','doctora','asistente','admin'));

-- ----------------------------------------------------------------------------
-- DOCTORA / ASISTENTE: clínica + agenda; lectura de farmacia
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'tipos_historia','campos_historia','historias_clinicas','consultas',
    'tratamientos','fases','recetas','receta_items','citas','seguimientos',
    'mensajes_wpp'
  ]
  loop
    execute format($f$
      create policy "clinica_%1$s" on public.%1$I
      for all using (current_rol() in ('doctora','asistente','admin'))
      with check (current_rol() in ('doctora','asistente','admin'));
    $f$, t);
  end loop;
end $$;

-- Doctora/asistente pueden crear y editar pacientes
create policy "clinica_escribe_pacientes" on pacientes
  for all using (current_rol() in ('doctora','asistente','admin'))
  with check (current_rol() in ('doctora','asistente','admin'));

-- Clínica lee catálogo de productos (para recetas)
create policy "clinica_lee_productos" on productos
  for select using (current_rol() in ('doctora','asistente','admin'));

-- Cada quien lee su propio registro de usuario
create policy "usuario_lee_propio" on usuarios
  for select using (auth_uid = auth.uid() or es_admin());

-- ----------------------------------------------------------------------------
-- Trigger de auditoría genérico
-- ----------------------------------------------------------------------------
create or replace function fn_audit()
returns trigger language plpgsql security definer as $$
declare uid uuid;
begin
  select id into uid from usuarios where auth_uid = auth.uid() limit 1;
  insert into audit_log(usuario_id, accion, tabla, registro_id, datos)
  values (
    uid, tg_op, tg_table_name,
    coalesce(new.id::text, old.id::text),
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

-- Auditar tablas sensibles (dinero + controlados + pacientes)
do $$
declare t text;
begin
  foreach t in array array[
    'ventas','pagos','movimientos_inv','recetas','pacientes','productos'
  ]
  loop
    execute format($f$
      create trigger audit_%1$s after insert or update or delete on public.%1$I
      for each row execute function fn_audit();
    $f$, t);
  end loop;
end $$;
