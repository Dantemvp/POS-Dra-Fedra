create or replace function public.registrar_entrada_inventario(
  p_producto_id uuid,
  p_cantidad numeric,
  p_lote text default null,
  p_caducidad date default null,
  p_costo numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_usuario_id uuid;
  v_lote_id uuid;
begin
  if current_rol()::text not in ('admin', 'farmacia', 'gerente') then
    raise exception 'No tienes permiso para registrar entradas de inventario.' using errcode = '42501';
  end if;

  if p_producto_id is null then
    raise exception 'Falta el producto.' using errcode = '22023';
  end if;

  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0.' using errcode = '22023';
  end if;

  if p_costo is not null and p_costo < 0 then
    raise exception 'El costo no puede ser negativo.' using errcode = '22023';
  end if;

  perform 1
  from public.productos
  where id = p_producto_id and activo
  for update;

  if not found then
    raise exception 'No se encontró un producto activo.' using errcode = 'P0002';
  end if;

  select id into v_usuario_id
  from public.usuarios
  where auth_uid = auth.uid();

  if v_usuario_id is null then
    raise exception 'No se encontró el usuario.' using errcode = '42501';
  end if;

  insert into public.lotes (
    producto_id,
    lote,
    caducidad,
    cantidad_actual,
    costo
  ) values (
    p_producto_id,
    nullif(trim(coalesce(p_lote, '')), ''),
    p_caducidad,
    p_cantidad,
    p_costo
  )
  returning id into v_lote_id;

  insert into public.movimientos_inv (
    producto_id,
    lote_id,
    tipo,
    cantidad,
    motivo,
    usuario_id
  ) values (
    p_producto_id,
    v_lote_id,
    'entrada',
    p_cantidad,
    'Entrada de inventario',
    v_usuario_id
  );

  return v_lote_id;
end;
$$;

revoke all on function public.registrar_entrada_inventario(uuid, numeric, text, date, numeric)
  from public, anon;
grant execute on function public.registrar_entrada_inventario(uuid, numeric, text, date, numeric)
  to authenticated;
