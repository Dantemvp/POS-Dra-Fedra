-- ============================================================================
-- Fase 0 — Esquema para migración del AppSheet viejo ("Dra. Fedra v.5")
--   1. id_legacy en tablas núcleo  → trazabilidad + import idempotente
--   2. servicios                   → catálogo de tratamientos/fases (Aranceles)
--   3. cobros / cobro_items / cobro_pagos → cobro clínico minimalista
--      (Historial + DetalleHistorial + Pagos del sistema viejo)
-- Idempotente: se puede re-correr sin romper.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Trazabilidad: id del registro en el sistema viejo (PTE-NNNNN, etc.)
-- ----------------------------------------------------------------------------
alter table pacientes          add column if not exists id_legacy text;
alter table recetas            add column if not exists id_legacy text;
alter table citas              add column if not exists id_legacy text;
alter table historias_clinicas add column if not exists id_legacy text;
alter table receta_items       add column if not exists id_legacy text;

create unique index if not exists ux_pacientes_legacy  on pacientes(id_legacy)          where id_legacy is not null;
create unique index if not exists ux_recetas_legacy    on recetas(id_legacy)            where id_legacy is not null;
create unique index if not exists ux_citas_legacy      on citas(id_legacy)              where id_legacy is not null;
create unique index if not exists ux_hist_legacy       on historias_clinicas(id_legacy) where id_legacy is not null;
create unique index if not exists ux_recitems_legacy   on receta_items(id_legacy)       where id_legacy is not null;

-- ----------------------------------------------------------------------------
-- 2. Catálogo de servicios clínicos (tratamientos, fases, faciales, toxina...)
--    Origen: pestaña "Aranceles". Habilita cobro rápido y reportes.
-- ----------------------------------------------------------------------------
create table if not exists servicios (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  categoria text,                              -- fase | facial | toxina | otro
  precio    numeric(10,2) not null default 0,
  activo    boolean not null default true,
  id_legacy text,
  creado_en timestamptz not null default now()
);
create unique index if not exists ux_servicios_legacy on servicios(id_legacy) where id_legacy is not null;

-- ----------------------------------------------------------------------------
-- 3. Cobro clínico minimalista
--    cobros        = episodio de cobro (1 paciente, 1 fecha)   [Historial]
--    cobro_items   = renglones de tratamiento/servicio          [DetalleHistorial]
--    cobro_pagos   = pagos recibidos (la Dra cobra por transfer) [Pagos]
-- ----------------------------------------------------------------------------
create table if not exists cobros (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid references pacientes(id),
  fecha       timestamptz not null default now(),
  total       numeric(12,2) not null default 0,
  nota        text,
  doctora_id  uuid references usuarios(id),
  id_legacy   text,
  creado_en   timestamptz not null default now()
);
create unique index if not exists ux_cobros_legacy on cobros(id_legacy) where id_legacy is not null;
create index if not exists ix_cobros_paciente on cobros(paciente_id);

create table if not exists cobro_items (
  id          uuid primary key default gen_random_uuid(),
  cobro_id    uuid not null references cobros(id) on delete cascade,
  servicio_id uuid references servicios(id),
  descripcion text,                            -- libre si no está en catálogo
  afeccion    text,
  cantidad    numeric(10,2) not null default 1,
  precio_unit numeric(10,2) not null default 0,
  descuento   numeric(10,2) not null default 0,
  subtotal    numeric(12,2) not null default 0,
  id_legacy   text
);
create unique index if not exists ux_cobroitems_legacy on cobro_items(id_legacy) where id_legacy is not null;
create index if not exists ix_cobroitems_cobro on cobro_items(cobro_id);

create table if not exists cobro_pagos (
  id        uuid primary key default gen_random_uuid(),
  cobro_id  uuid not null references cobros(id) on delete cascade,
  monto     numeric(12,2) not null,
  metodo    metodo_pago not null default 'transferencia',
  fecha     timestamptz not null default now(),
  id_legacy text
);
create unique index if not exists ux_cobropagos_legacy on cobro_pagos(id_legacy) where id_legacy is not null;
create index if not exists ix_cobropagos_cobro on cobro_pagos(cobro_id);

-- ----------------------------------------------------------------------------
-- 4. RLS — mismo modelo clínico (doctora/asistente/admin)
-- ----------------------------------------------------------------------------
alter table servicios   enable row level security;
alter table cobros      enable row level security;
alter table cobro_items enable row level security;
alter table cobro_pagos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['servicios','cobros','cobro_items','cobro_pagos']
  loop
    -- admin todo
    execute format($f$
      create policy "admin_all_%1$s" on public.%1$I
      for all using (es_admin()) with check (es_admin());
    $f$, t);
    -- clínica gestiona
    execute format($f$
      create policy "clinica_%1$s" on public.%1$I
      for all using (current_rol() in ('doctora','asistente','admin'))
      with check (current_rol() in ('doctora','asistente','admin'));
    $f$, t);
  end loop;
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 5. Auditoría de las tablas de dinero nuevas
-- ----------------------------------------------------------------------------
do $$
begin
  create trigger audit_cobros after insert or update or delete on public.cobros
    for each row execute function fn_audit();
exception when duplicate_object then null;
end $$;
do $$
begin
  create trigger audit_cobro_pagos after insert or update or delete on public.cobro_pagos
    for each row execute function fn_audit();
exception when duplicate_object then null;
end $$;
