alter table public.recetas
  add column if not exists ajustes_impresion jsonb;

alter table public.receta_items
  add column if not exists orden integer not null default 0;

with posiciones as (
  select ctid, row_number() over (partition by receta_id order by ctid) - 1 as posicion
  from public.receta_items
)
update public.receta_items ri
set orden = posiciones.posicion
from posiciones
where ri.ctid = posiciones.ctid;

create or replace function public.editar_receta(
  p_receta_id uuid,
  p_fase integer,
  p_items jsonb,
  p_ajustes jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  p_item jsonb;
  v_item_id uuid;
  v_ids uuid[] := array[]::uuid[];
  v_orden integer := 0;
begin
  if current_rol()::text not in ('admin', 'doctora', 'gerente') then
    raise exception 'No tienes permiso para editar recetas.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'La receta debe contener entre 1 y 50 medicamentos.' using errcode = '22023';
  end if;

  if p_fase is not null and p_fase not between 1 and 999 then
    raise exception 'La fase no es válida.' using errcode = '22023';
  end if;

  if coalesce((p_ajustes->>'tamano')::numeric, 0) not between 1.2 and 1.7
    or coalesce((p_ajustes->>'separacion')::numeric, 0) not between 0.6 and 2
    or coalesce((p_ajustes->>'izquierda')::numeric, 0) not between 3 and 10
    or coalesce((p_ajustes->>'inicio')::numeric, 0) not between 25 and 36
    or jsonb_typeof(p_ajustes->'mostrar_metricas') <> 'boolean' then
    raise exception 'Los ajustes de impresión no son válidos.' using errcode = '22023';
  end if;

  perform 1 from public.recetas where id = p_receta_id for update;
  if not found then
    raise exception 'No se encontró la receta.' using errcode = 'P0002';
  end if;

  for p_item in select value from jsonb_array_elements(p_items)
  loop
    if length(trim(coalesce(p_item->>'medicamento', ''))) not between 1 and 500
      or length(coalesce(p_item->>'dosis', '')) > 4000
      or length(coalesce(p_item->>'indicaciones', '')) > 4000
      or (nullif(p_item->>'duracion_dias', '') is not null
          and (p_item->>'duracion_dias')::integer not between 1 and 3650) then
      raise exception 'Un medicamento contiene datos no válidos.' using errcode = '22023';
    end if;

    v_item_id := nullif(p_item->>'id', '')::uuid;
    if v_item_id is null then
      insert into public.receta_items (receta_id, medicamento, dosis, duracion_dias, indicaciones, orden)
      values (
        p_receta_id,
        trim(p_item->>'medicamento'),
        nullif(trim(coalesce(p_item->>'dosis', '')), ''),
        nullif(p_item->>'duracion_dias', '')::integer,
        nullif(trim(coalesce(p_item->>'indicaciones', '')), ''),
        v_orden
      ) returning id into v_item_id;
    else
      update public.receta_items
      set medicamento = trim(p_item->>'medicamento'),
          dosis = nullif(trim(coalesce(p_item->>'dosis', '')), ''),
          duracion_dias = nullif(p_item->>'duracion_dias', '')::integer,
          indicaciones = nullif(trim(coalesce(p_item->>'indicaciones', '')), ''),
          orden = v_orden
      where id = v_item_id and receta_id = p_receta_id;
      if not found then
        raise exception 'Un medicamento no pertenece a esta receta.' using errcode = '22023';
      end if;
    end if;
    v_ids := array_append(v_ids, v_item_id);
    v_orden := v_orden + 1;
  end loop;

  delete from public.receta_items
  where receta_id = p_receta_id and not (id = any(v_ids));

  update public.recetas
  set fase = p_fase,
      ajustes_impresion = p_ajustes
  where id = p_receta_id;
end;
$$;

revoke all on function public.editar_receta(uuid, integer, jsonb, jsonb) from public, anon;
grant execute on function public.editar_receta(uuid, integer, jsonb, jsonb) to authenticated;
