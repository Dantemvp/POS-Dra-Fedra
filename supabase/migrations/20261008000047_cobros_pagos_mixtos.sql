begin;
-- Un núcleo privado para cobro simple y mixto: no crea pagos provisionales.
create or replace function public._registrar_cobro_con_pagos(
  p_paciente uuid, p_metodo public.metodo_pago, p_nota text, p_items jsonb, p_pagos jsonb
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cobro uuid;
  v_total numeric;
  v_suma numeric := 0;
  v_pago jsonb;
  v_monto numeric;
  v_metodos text[] := '{}';
  v_usuario uuid;
  v_rol text;
  it jsonb;
  agg record;
  lote_rec record;
  v_disp numeric;
  restante numeric;
  deducir numeric;
begin
  select id, rol::text into v_usuario, v_rol from public.usuarios where auth_uid = auth.uid();
  if v_usuario is null then raise exception 'No se encontró el usuario de la sesión.'; end if;
  if v_rol not in ('doctora','asistente','admin','gerente') then
    raise exception 'No tienes permiso para registrar cobros.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El cobro no tiene conceptos.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) i where
      (i->>'cantidad') is null or (i->>'precio_unit') is null or
      (i->>'cantidad')::numeric <= 0 or (i->>'cantidad')::numeric > 100000 or
      (i->>'cantidad')::numeric <> round((i->>'cantidad')::numeric,2) or
      (i->>'precio_unit')::numeric < 0 or (i->>'precio_unit')::numeric > 100000000 or
      (i->>'precio_unit')::numeric <> round((i->>'precio_unit')::numeric,2)) then
    raise exception 'Cantidad o precio inválido.';
  end if;
  select sum(round((i->>'cantidad')::numeric * (i->>'precio_unit')::numeric,2))
    into v_total from jsonb_array_elements(p_items) i;
  if p_pagos is null then
    p_pagos := case when v_total > 0 then jsonb_build_array(jsonb_build_object('metodo',p_metodo,'monto',v_total)) else '[]'::jsonb end;
  else
  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) <> 2 then
    raise exception 'El pago mixto requiere dos métodos.';
  end if;
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
  -- Mismo flujo de inventario del cobro anterior, con bloqueo de lotes.
  for agg in
    select (e->>'producto_id')::uuid as pid, sum((e->>'cantidad')::numeric) as cant
    from jsonb_array_elements(p_items) e
    where e->>'tipo' = 'producto' and e->>'producto_id' is not null
    group by 1 order by 1
  loop
    perform id from public.lotes where producto_id = agg.pid order by id for update;
    select coalesce(sum(cantidad_actual),0) into v_disp from public.lotes where producto_id = agg.pid;
    if v_disp < agg.cant then raise exception 'Stock insuficiente: disponible %, requerido %', v_disp, agg.cant; end if;
  end loop;
  insert into public.cobros(paciente_id,fecha,total,nota,doctora_id)
    values(p_paciente,now(),v_total,nullif(p_nota,''),v_usuario) returning id into v_cobro;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.cobro_items(cobro_id,servicio_id,producto_id,descripcion,cantidad,precio_unit,subtotal)
      values(v_cobro,nullif(it->>'servicio_id','')::uuid,nullif(it->>'producto_id','')::uuid,
        nullif(it->>'descripcion',''),(it->>'cantidad')::numeric,(it->>'precio_unit')::numeric,
        round((it->>'cantidad')::numeric*(it->>'precio_unit')::numeric,2));
    if it->>'tipo' = 'producto' and it->>'producto_id' is not null then
      restante := (it->>'cantidad')::numeric;
      for lote_rec in select id,cantidad_actual from public.lotes
        where producto_id = (it->>'producto_id')::uuid and cantidad_actual > 0
        order by caducidad asc nulls last, creado_en asc, id asc
      loop
        exit when restante <= 0;
        deducir := least(restante,lote_rec.cantidad_actual);
        update public.lotes set cantidad_actual = cantidad_actual - deducir where id = lote_rec.id;
        insert into public.movimientos_inv(producto_id,lote_id,tipo,cantidad,motivo,referencia_id,usuario_id)
          values((it->>'producto_id')::uuid,lote_rec.id,'salida',deducir,'Cobro consultorio',v_cobro::text,v_usuario);
        restante := restante - deducir;
      end loop;
      if restante > 0 then raise exception 'Stock insuficiente al descontar inventario.'; end if;
    end if;
  end loop;
  for v_pago in select * from jsonb_array_elements(p_pagos) loop
    insert into public.cobro_pagos(cobro_id,metodo,monto)
    values (v_cobro,(v_pago->>'metodo')::public.metodo_pago,(v_pago->>'monto')::numeric);
  end loop;
  return v_cobro;
end $$;
revoke all on function public._registrar_cobro_con_pagos(uuid,public.metodo_pago,text,jsonb,jsonb) from public, anon, authenticated, service_role;

-- Conserva ambas firmas públicas y los permisos de la función anterior.
create or replace function public.registrar_cobro(
  p_paciente uuid,p_metodo public.metodo_pago,p_nota text,p_items jsonb
) returns uuid language sql security definer set search_path = public, pg_temp as $$
  select public._registrar_cobro_con_pagos(p_paciente,p_metodo,p_nota,p_items,null);
$$;
create or replace function public.registrar_cobro_mixto(
  p_paciente uuid,p_metodo public.metodo_pago,p_nota text,p_items jsonb,p_pagos jsonb
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_pagos is null then raise exception 'El pago mixto requiere dos métodos.'; end if;
  return public._registrar_cobro_con_pagos(p_paciente,p_metodo,p_nota,p_items,p_pagos);
end $$;
revoke all on function public.registrar_cobro(uuid,public.metodo_pago,text,jsonb) from public, anon;
grant execute on function public.registrar_cobro(uuid,public.metodo_pago,text,jsonb) to authenticated;
revoke all on function public.registrar_cobro_mixto(uuid,public.metodo_pago,text,jsonb,jsonb) from public, anon;
grant execute on function public.registrar_cobro_mixto(uuid,public.metodo_pago,text,jsonb,jsonb) to authenticated;
commit;
