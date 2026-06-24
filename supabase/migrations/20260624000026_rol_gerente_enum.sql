-- Rol nuevo: GERENTE (mano derecha de la Dra.).
-- = farmacia + asistente + doctora juntos (todo el POS y toda la clínica),
-- PERO sin gestión de usuarios y sin borrados directos (esos siguen siendo
-- admin / doctora). El valor del enum se agrega en su propia migración para
-- que quede comiteado antes de usarse en políticas/funciones (migración 27).

alter type rol_usuario add value if not exists 'gerente';
