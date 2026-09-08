-- Durable viral-remake batches with bounded candidate materialization.

create table if not exists public.gouyingai_viral_batches (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    canvas_id text not null,
    target_node_id text not null,
    generation_revision bigint not null default 1 check (generation_revision > 0),
    client_request_id text not null,
    template_id text not null,
    candidate_count integer not null check (candidate_count between 1 and 1000),
    model_id uuid references public.gouyingai_models(id) on delete set null,
    channel_id uuid references public.gouyingai_channels(id) on delete set null,
    status text not null default 'queued' check (status in ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    input jsonb not null default '{}'::jsonb,
    max_in_flight integer not null default 2 check (max_in_flight between 1 and 20),
    next_candidate_index integer not null default 0 check (next_candidate_index >= 0),
    queued_count integer not null default 0,
    running_count integer not null default 0,
    succeeded_count integer not null default 0,
    failed_count integer not null default 0,
    cancelled_count integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    finished_at timestamptz,
    unique (user_id, client_request_id),
    foreign key (user_id, canvas_id) references public.gouyingai_canvas_projects(user_id, id) on delete restrict
);

create index if not exists gouyingai_viral_batches_active_idx
    on public.gouyingai_viral_batches(status, created_at)
    where status in ('queued', 'running');

create index if not exists gouyingai_viral_batches_canvas_idx
    on public.gouyingai_viral_batches(user_id, canvas_id, updated_at desc);

alter table public.gouyingai_viral_batches enable row level security;

alter table public.gouyingai_canvas_jobs add column if not exists batch_id uuid references public.gouyingai_viral_batches(id) on delete set null;
alter table public.gouyingai_canvas_jobs add column if not exists candidate_index integer check (candidate_index >= 0);
create index if not exists gouyingai_canvas_jobs_batch_idx on public.gouyingai_canvas_jobs(batch_id, candidate_index);
create unique index if not exists gouyingai_canvas_jobs_batch_candidate_root_idx
    on public.gouyingai_canvas_jobs(batch_id, candidate_index)
    where batch_id is not null and parent_job_id is null;

alter table public.gouyingai_canvas_jobs drop constraint if exists gouyingai_canvas_jobs_kind_check;
alter table public.gouyingai_canvas_jobs add constraint gouyingai_canvas_jobs_kind_check
    check (kind in ('text', 'image', 'video', 'audio', 'viral-analysis', 'viral-plan', 'viral-video', 'viral-quality'));
