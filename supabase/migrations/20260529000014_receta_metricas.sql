-- Métricas de control de peso en la receta (formato de la Dra., fase 1 inicial).
-- Se guardan como jsonb flexible: peso, estatura, imc, peso_ideal, peso_sugerido, cintura.
alter table recetas add column if not exists metricas jsonb;
