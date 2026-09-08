create table if not exists public.gouyingai_universal_remake_runs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    canvas_id text not null,
    target_node_id text not null,
    generation_revision integer not null,
    client_request_id text not null,
    template_id text not null,
    model_id text,
    channel_id text,
    max_in_flight integer not null default 2 check (max_in_flight between 1 and 20),
    status text not null default 'queued' check (status in ('queued','running','paused','completed','failed','cancelled')),
    candidates jsonb not null default '[]'::jsonb,
    succeeded_count integer not null default 0,
    failed_count integer not null default 0,
    cancelled_count integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    finished_at timestamptz,
    unique (user_id, client_request_id)
);

create index if not exists gouyingai_universal_remake_runs_active_idx
    on public.gouyingai_universal_remake_runs(status, created_at)
    where status in ('queued','running');

alter table public.gouyingai_universal_remake_runs enable row level security;
create policy "users read own universal remake runs" on public.gouyingai_universal_remake_runs
    for select using (auth.uid() = user_id);
