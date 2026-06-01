-- Tipo de historia "InBody" para guardar las mediciones de composición corporal.
-- Las claves de datos se guardan con etiquetas legibles desde el lector con IA.
do $$
begin
  if not exists (select 1 from tipos_historia where nombre = 'InBody') then
    insert into tipos_historia (nombre) values ('InBody');
  end if;
end $$;
