-- Web Push: suscripciones de notificaciones por usuario/dispositivo.
-- Cada navegador instalado (PWA) genera UNA suscripción (endpoint único).
-- Un mismo usuario puede tener varias (cel + laptop). Guardamos la suscripción
-- cruda que devuelve el navegador para enviarle pushes con web-push (VAPID).

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  auth_uid    uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  creado_en   timestamptz not null default now(),
  usado_en    timestamptz
);
create index if not exists push_subscriptions_auth_uid_idx on push_subscriptions (auth_uid);

comment on table push_subscriptions is
  'Suscripciones Web Push por dispositivo. El envío real lo hace el servidor con service_role.';

alter table push_subscriptions enable row level security;

-- Cada usuario administra SOLO sus propias suscripciones (las de sus dispositivos).
-- El envío de notificaciones lo hace el backend con service_role (bypassa RLS).
drop policy if exists "push: ver propias" on push_subscriptions;
create policy "push: ver propias" on push_subscriptions
  for select using (auth_uid = auth.uid());

drop policy if exists "push: crear propias" on push_subscriptions;
create policy "push: crear propias" on push_subscriptions
  for insert with check (auth_uid = auth.uid());

drop policy if exists "push: borrar propias" on push_subscriptions;
create policy "push: borrar propias" on push_subscriptions
  for delete using (auth_uid = auth.uid());

drop policy if exists "push: actualizar propias" on push_subscriptions;
create policy "push: actualizar propias" on push_subscriptions
  for update using (auth_uid = auth.uid());
