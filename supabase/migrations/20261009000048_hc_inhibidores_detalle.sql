-- Detalle condicional solicitado por Fer. No modifica respuestas clínicas.
do $$
declare
  padre record;
  hijo record;
begin
  if not exists (select 1 from public.campos_historia where etiqueta = '¿Ha consumido inhibidores del apetito?' and tipo_dato = 'booleano') then
    raise exception 'No existe la pregunta de inhibidores del apetito. Revisar la plantilla antes de aplicar.';
  end if;
  for padre in select * from public.campos_historia where etiqueta = '¿Ha consumido inhibidores del apetito?' loop
    if padre.tipo_dato <> 'booleano' or
       (select count(*) from public.campos_historia where tipo_historia_id = padre.tipo_historia_id and etiqueta = padre.etiqueta) <> 1 then
      raise exception 'Pregunta de inhibidores ambigua o modificada. No se cambia la plantilla.';
    end if;
    if (select count(*) from public.campos_historia where tipo_historia_id = padre.tipo_historia_id and etiqueta = '¿Cuáles inhibidores del apetito ha consumido?') > 1 then
      raise exception 'Detalle de inhibidores duplicado.';
    end if;
    select * into hijo from public.campos_historia where tipo_historia_id = padre.tipo_historia_id and etiqueta = '¿Cuáles inhibidores del apetito ha consumido?';
    if found then
      if hijo.depende_de is distinct from padre.id or hijo.depende_valor is distinct from 'true' or hijo.tipo_dato <> 'texto' then
        raise exception 'El detalle existente tiene una configuración distinta. No se sobrescribe.';
      end if;
      continue;
    end if;
    update public.campos_historia set orden = orden + 1 where tipo_historia_id = padre.tipo_historia_id and orden > padre.orden;
    insert into public.campos_historia (tipo_historia_id, etiqueta, tipo_dato, orden, requerido, seccion, depende_de, depende_valor)
    values (padre.tipo_historia_id, '¿Cuáles inhibidores del apetito ha consumido?', 'texto', padre.orden + 1, false, padre.seccion, padre.id, 'true');
  end loop;
end $$;
