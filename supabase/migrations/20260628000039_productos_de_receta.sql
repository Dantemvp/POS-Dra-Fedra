-- Escaneo de receta en el POS de farmacia. En vez de abrir las recetas (dato
-- clínico) al rol farmacia, esta función SECURITY DEFINER devuelve SOLO los
-- productos a surtir de una receta por folio: nada de diagnóstico, métricas ni
-- indicaciones. Así la cajera escanea el código "REC<folio>" y el POS carga los
-- medicamentos, sin exponer el expediente.
create or replace function public.productos_de_receta(p_folio bigint)
returns table(producto_id uuid, medicamento text)
language sql
security definer
set search_path = public
as $$
  select ri.producto_id, ri.medicamento
  from recetas r
  join receta_items ri on ri.receta_id = r.id
  where r.folio = p_folio;
$$;

grant execute on function public.productos_de_receta(bigint) to authenticated;
