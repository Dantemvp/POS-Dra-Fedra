-- Permisos del rol GERENTE. Políticas ADITIVAS (RLS hace OR), así que esto
-- otorga acceso a gerente sin tocar las políticas existentes.
-- Comparamos current_rol()::text = 'gerente' (texto, no literal de enum) para
-- no depender de cuándo se comitea el valor del enum.

-- 1) FARMACIA / POS — acceso completo salvo borrar productos -----------------
do $$
declare t text;
begin
  foreach t in array array[
    'categorias','proveedores','lotes','compras','compra_items',
    'movimientos_inv','ventas','venta_items','pagos','cortes_caja'
  ]
  loop
    execute format($f$
      create policy "gerente_%1$s" on public.%1$I
      for all using (current_rol()::text = 'gerente')
      with check (current_rol()::text = 'gerente');
    $f$, t);
  end loop;
end $$;

-- productos: leer / crear / actualizar (NO borrar — eso es admin)
create policy "gerente_lee_productos" on productos
  for select using (current_rol()::text = 'gerente');
create policy "gerente_inserta_productos" on productos
  for insert with check (current_rol()::text = 'gerente');
create policy "gerente_actualiza_productos" on productos
  for update using (current_rol()::text = 'gerente')
  with check (current_rol()::text = 'gerente');

-- 2) CLÍNICA — acceso completo (como doctora) --------------------------------
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
      create policy "gerente_%1$s" on public.%1$I
      for all using (current_rol()::text = 'gerente')
      with check (current_rol()::text = 'gerente');
    $f$, t);
  end loop;
end $$;

-- pacientes: lectura y escritura
create policy "gerente_pacientes" on pacientes
  for all using (current_rol()::text = 'gerente')
  with check (current_rol()::text = 'gerente');

-- servicios: lectura (la edición de precios queda en admin/doctora)
create policy "gerente_lee_servicios" on servicios
  for select using (current_rol()::text = 'gerente');

-- 3) COBROS (servicios + productos) — acceso completo ------------------------
do $$
declare t text;
begin
  foreach t in array array['cobros','cobro_items','cobro_pagos']
  loop
    execute format($f$
      create policy "gerente_%1$s" on public.%1$I
      for all using (current_rol()::text = 'gerente')
      with check (current_rol()::text = 'gerente');
    $f$, t);
  end loop;
end $$;

-- 4) RPC registrar_cobro: permitir a gerente (chequeo de rol hardcodeado) -----
create or replace function public.registrar_cobro(
  p_paciente uuid,
  p_metodo   metodo_pago,
  p_nota     text,
  p_items    jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid;
  v_rol     rol_usuario;
  v_cobro   uuid;
  v_total   numeric := 0;
  it        jsonb;
  agg       record;
  lote_rec  record;
  v_prod    uuid;
  v_cant    numeric;
  v_precio  numeric;
  v_disp    numeric;
  restante  numeric;
  deducir   numeric;
begin
  select id, rol into v_usuario, v_rol from usuarios where auth_uid = auth.uid();
  if v_usuario is null then
    raise exception 'No se encontró el usuario de la sesión.';
  end if;
  -- gerente incluido (comparación por texto para no depender del enum)
  if v_rol::text not in ('doctora','asistente','admin','gerente') then
    raise exception 'No tienes permiso para registrar cobros.';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El cobro no tiene conceptos.';
  end if;

  -- Validar stock agregado de los productos
  for agg in
    select (e->>'producto_id')::uuid as pid, sum((e->>'cantidad')::numeric) as cant
    from jsonb_array_elements(p_items) e
    where e->>'tipo' = 'producto' and e->>'producto_id' is not null
    group by 1
  loop
    select coalesce(sum(cantidad_actual),0) into v_disp from lotes where producto_id = agg.pid;
    if v_disp < agg.cant then
      raise exception 'Stock insuficiente para "%": disponible %, requerido %',
        (select nombre from productos where id = agg.pid), v_disp, agg.cant;
    end if;
  end loop;

  -- Total
  for it in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + coalesce((it->>'cantidad')::numeric,1) * coalesce((it->>'precio_unit')::numeric,0);
  end loop;

  insert into cobros (paciente_id, fecha, total, nota, doctora_id)
  values (p_paciente, now(), v_total, nullif(p_nota,''), v_usuario)
  returning id into v_cobro;

  -- Renglones
  for it in select * from jsonb_array_elements(p_items) loop
    v_cant   := coalesce((it->>'cantidad')::numeric,1);
    v_precio := coalesce((it->>'precio_unit')::numeric,0);

    insert into cobro_items (cobro_id, servicio_id, producto_id, descripcion, cantidad, precio_unit, subtotal)
    values (
      v_cobro,
      nullif(it->>'servicio_id','')::uuid,
      nullif(it->>'producto_id','')::uuid,
      nullif(it->>'descripcion',''),
      v_cant, v_precio, v_cant * v_precio
    );

    -- Descontar inventario FIFO si es producto
    if it->>'tipo' = 'producto' and it->>'producto_id' is not null then
      v_prod := (it->>'producto_id')::uuid;
      restante := v_cant;
      for lote_rec in
        select id, cantidad_actual from lotes
        where producto_id = v_prod and cantidad_actual > 0
        order by caducidad asc nulls last, creado_en asc
      loop
        exit when restante <= 0;
        deducir := least(restante, lote_rec.cantidad_actual);
        update lotes set cantidad_actual = cantidad_actual - deducir where id = lote_rec.id;
        insert into movimientos_inv (producto_id, lote_id, tipo, cantidad, motivo, referencia_id, usuario_id)
        values (v_prod, lote_rec.id, 'salida', deducir, 'Cobro consultorio', v_cobro::text, v_usuario);
        restante := restante - deducir;
      end loop;
    end if;
  end loop;

  if v_total > 0 then
    insert into cobro_pagos (cobro_id, monto, metodo) values (v_cobro, v_total, p_metodo);
  end if;

  return v_cobro;
end;
$$;

grant execute on function public.registrar_cobro(uuid, metodo_pago, text, jsonb) to authenticated;
