alter table public.template_items
  add column if not exists ai_mode text not null default 'manual' check (ai_mode in ('auto','suggest','manual')),
  add column if not exists ai_instructions text;

create table if not exists public.betty_scans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  coordinator_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid not null references public.templates(id),
  class_date date,
  level text,
  lob text,
  zoom_link text,
  transcript_raw text,
  transcript_hash text,
  transcript_metrics jsonb,
  class_timeline jsonb,
  deterministic jsonb,
  ai_output jsonb,
  ai_summary text,
  ai_kudos jsonb not null default '[]'::jsonb,
  ai_aois jsonb not null default '[]'::jsonb,
  ai_watch_minutes jsonb not null default '[]'::jsonb,
  betty_score numeric,
  betty_phrase text,
  status text not null default 'analizado' check (status in ('analizado','revisado','convertido')),
  converted_monitoring_id uuid references public.monitorings(id) on delete set null,
  share_token uuid unique,
  model text,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.betty_scan_answers (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.betty_scans(id) on delete cascade,
  item_id uuid not null references public.template_items(id) on delete cascade,
  ai_result text check (ai_result in ('si','parcial','no','nd')),
  ai_score numeric,
  ai_confidence text check (ai_confidence in ('alta','media','baja')),
  ai_evidence jsonb not null default '[]'::jsonb,
  ai_note text,
  final_result text check (final_result in ('si','no','na')),
  final_score numeric,
  coordinator_changed boolean not null default false,
  comment text,
  created_at timestamptz not null default now(),
  unique (scan_id, item_id)
);

grant select, insert, update, delete on public.betty_scans to authenticated;
grant all on public.betty_scans to service_role;
grant select, insert, update, delete on public.betty_scan_answers to authenticated;
grant all on public.betty_scan_answers to service_role;

alter table public.betty_scans enable row level security;
alter table public.betty_scan_answers enable row level security;

create or replace function public.can_read_betty(_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.betty_scans s where s.id = _id
    and (s.coordinator_id = auth.uid() or public.is_senior_or_admin()))
$$;

drop policy if exists betty_scans_select on public.betty_scans;
create policy betty_scans_select on public.betty_scans for select to authenticated
  using (coordinator_id = auth.uid() or public.is_senior_or_admin());
drop policy if exists betty_scans_insert on public.betty_scans;
create policy betty_scans_insert on public.betty_scans for insert to authenticated
  with check (coordinator_id = auth.uid() or public.is_admin());
drop policy if exists betty_scans_update on public.betty_scans;
create policy betty_scans_update on public.betty_scans for update to authenticated
  using (coordinator_id = auth.uid() or public.is_senior_or_admin())
  with check (coordinator_id = auth.uid() or public.is_senior_or_admin());
drop policy if exists betty_scans_delete on public.betty_scans;
create policy betty_scans_delete on public.betty_scans for delete to authenticated
  using (coordinator_id = auth.uid() or public.is_admin());

drop policy if exists betty_answers_select on public.betty_scan_answers;
create policy betty_answers_select on public.betty_scan_answers for select to authenticated
  using (public.can_read_betty(scan_id));
drop policy if exists betty_answers_write on public.betty_scan_answers;
create policy betty_answers_write on public.betty_scan_answers for all to authenticated
  using (public.can_read_betty(scan_id)) with check (public.can_read_betty(scan_id));

create trigger betty_scans_updated_at before update on public.betty_scans
  for each row execute function public.set_updated_at();

insert into public.app_config (key, value, description) values
  ('talk_time_target_kids', '50'::jsonb, '% meta de tiempo de alumnos · Kids/Juniors'),
  ('talk_time_target_teens', '60'::jsonb, '% meta de tiempo de alumnos · Teens'),
  ('talk_time_target_adults', '60'::jsonb, '% meta de tiempo de alumnos · Adults'),
  ('betty_model', '"google/gemini-2.5-flash"'::jsonb, 'Modelo de IA que usa Coach Betty Well'),
  ('betty_enabled', 'true'::jsonb, 'Activar la sección Coach Betty Well'),
  ('betty_daily_limit', '30'::jsonb, 'Máximo de análisis de Betty por coordinador al día')
on conflict (key) do nothing;