begin;
create or replace function public.registrar_cobro_mixto(
  p_paciente uuid, p_metodo public.metodo_pago, p_nota text, p_items jsonb, p_pagos jsonb
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cobro uuid;
  v_total numeric;
  v_suma numeric := 0;
  v_pago jsonb;
  v_monto numeric;
  v_metodos text[] := '{}';
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El cobro no tiene conceptos.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) i where
      (i->>'cantidad') is null or (i->>'precio_unit') is null or
      (i->>'cantidad')::numeric <= 0 or (i->>'cantidad')::numeric > 100000 or
      (i->>'precio_unit')::numeric < 0 or (i->>'precio_unit')::numeric > 100000000 or
      (i->>'precio_unit')::numeric <> round((i->>'precio_unit')::numeric,2)) then
    raise exception 'Cantidad o precio inválido.';
  end if;
  select round(sum((i->>'cantidad')::numeric * (i->>'precio_unit')::numeric),2)
    into v_total from jsonb_array_elements(p_items) i;
  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) <> 2 then
    raise exception 'El pago mixto requiere dos métodos.';
  end if;
  for v_pago in select * from jsonb_array_elements(p_pagos) loop
    if coalesce(v_pago->>'metodo','') not in ('efectivo','tarjeta','transferencia','otro') then
      raise exception 'Método de pago inválido.';
    end if;
    if (v_pago->>'metodo') = any(v_metodos) then raise exception 'Elige métodos distintos.'; end if;
    v_metodos := array_append(v_metodos, v_pago->>'metodo');
    v_monto := (v_pago->>'monto')::numeric;
    if v_monto is null or v_monto <= 0 or v_monto > 100000000 or v_monto <> round(v_monto,2) then
      raise exception 'Monto de pago inválido.';
    end if;
    v_suma := v_suma + v_monto;
  end loop;
  if v_suma <> v_total then raise exception 'Los pagos no suman el total.'; end if;
  -- La función existente verifica identidad, rol y registra inventario.
  -- Cualquier fallo posterior revierte todo el cobro y sus movimientos.
  v_cobro := public.registrar_cobro(p_paciente,p_metodo,p_nota,p_items);
  delete from public.cobro_pagos where cobro_id = v_cobro;
  for v_pago in select * from jsonb_array_elements(p_pagos) loop
    insert into public.cobro_pagos(cobro_id,metodo,monto)
    values (v_cobro,(v_pago->>'metodo')::public.metodo_pago,(v_pago->>'monto')::numeric);
  end loop;
  return v_cobro;
end $$;
revoke all on function public.registrar_cobro_mixto(uuid,public.metodo_pago,text,jsonb,jsonb) from public, anon;
grant execute on function public.registrar_cobro_mixto(uuid,public.metodo_pago,text,jsonb,jsonb) to authenticated;
commit;
