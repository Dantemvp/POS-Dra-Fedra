-- Fase 5 — trazabilidad para migración de inventario del AppSheet viejo
alter table productos add column if not exists id_legacy text;
alter table lotes     add column if not exists id_legacy text;
create unique index if not exists ux_productos_legacy on productos(id_legacy) where id_legacy is not null;
create unique index if not exists ux_lotes_legacy     on lotes(id_legacy)     where id_legacy is not null;
