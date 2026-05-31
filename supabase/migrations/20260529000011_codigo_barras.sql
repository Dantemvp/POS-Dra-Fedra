-- Código de barras / SKU para identificar productos al escanear.
alter table productos add column if not exists codigo_barras text;
create index if not exists idx_productos_codigo_barras on productos (codigo_barras);
