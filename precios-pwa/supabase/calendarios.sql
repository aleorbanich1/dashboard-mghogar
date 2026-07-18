-- ═══════════════════════════════════════════════════════════════════════════
--  MG Precios — SQL para las funciones nuevas.
--  Pegar en Supabase → SQL Editor → Run. Es idempotente: se puede correr de nuevo.
--
--  Contiene DOS cosas:
--    1. La tabla `calendarios` (Registro de calendarios / cartera de clientes).
--    2. El permiso de DELETE en `tipos_visita`, para poder borrar los tipos de
--       cliente desde la app (antes solo se podían crear).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Registro de calendarios ──────────────────────────────────────────────
-- Réplica de la base de Notion "Calendario de contactos": a quién se contactó,
-- qué día, de qué segmento, en qué estado quedó y qué pasó en la charla.

create table if not exists public.calendarios (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nombre     text not null default '',
  dia        date,
  segmento   text not null default '',
  notas      text not null default '',
  estado     text not null default 'Pendiente',
  wsp        text not null default ''
);

-- Los reportes se piden por rango de fechas: el índice los hace instantáneos.
create index if not exists calendarios_dia_idx on public.calendarios (dia desc);

alter table public.calendarios enable row level security;

-- La app usa la anon key (login propio, sin Supabase Auth), igual que `registros`
-- y `categorias_producto`. Por eso la policy habilita a anon, como el resto.
drop policy if exists calendarios_todo on public.calendarios;
create policy calendarios_todo on public.calendarios
  for all
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.calendarios to anon, authenticated;

-- ── 2. Borrar tipos de cliente ──────────────────────────────────────────────
-- La tabla `tipos_visita` ya existe (los tipos de cliente que carga el negocio).
-- Faltaba el permiso de DELETE: sin esto, el tacho de la app falla en silencio.

drop policy if exists tipos_visita_delete on public.tipos_visita;
create policy tipos_visita_delete on public.tipos_visita
  for delete
  to anon, authenticated
  using (true);

grant delete on public.tipos_visita to anon, authenticated;

-- ── 3. Multiselección en Clientes ───────────────────────────────────────────
-- "¿Qué hizo la persona?" y "¿Qué pidió?" ahora aceptan VARIAS opciones. Se
-- agregan columnas array y se migran los valores viejos (una sola opción).
-- Las columnas viejas `visit`/`demand` quedan (se siguen llenando con el 1º
-- valor) para no romper nada anterior.

alter table public.registros add column if not exists visits   text[] not null default '{}';
alter table public.registros add column if not exists demandas text[] not null default '{}';

-- Migrar lo ya cargado: el valor único pasa a ser el primer (y único) elemento.
update public.registros
  set visits = array[visit]
  where visit is not null and visits = '{}';

update public.registros
  set demandas = array[demand]
  where demand is not null and demandas = '{}';

-- ── 4. Ocultar tipos de cliente FIJOS ───────────────────────────────────────
-- Los 4 tipos fijos viven en el código de la app. Para poder "borrarlos" se
-- guarda su id acá y la app los esconde (las visitas viejas se conservan).

create table if not exists public.tipos_visita_ocultos (
  visit_id text primary key
);

alter table public.tipos_visita_ocultos enable row level security;

drop policy if exists tipos_visita_ocultos_todo on public.tipos_visita_ocultos;
create policy tipos_visita_ocultos_todo on public.tipos_visita_ocultos
  for all
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, delete on public.tipos_visita_ocultos to anon, authenticated;
