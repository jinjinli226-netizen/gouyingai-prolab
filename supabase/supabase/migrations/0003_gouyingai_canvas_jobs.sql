-- Durable canvas projects, generation jobs, and worker leases.

alter table public.gouyingai_canvas_projects
    add column if not exists revision bigint not null default 0;

alter table public.gouyingai_canvas_projects
    add column if not exists deleted_at timestamptz;

create table if not exists public.gouyingai_canvas_jobs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    canvas_id text not null,
    parent_job_id uuid references public.gouyingai_canvas_jobs(id) on delete set null,
    target_node_id text not null,
    generation_revision bigint not null default 1 check (generation_revision > 0),
    client_request_id text not null,
    kind text not null check (kind in ('text', 'image', 'video', 'audio', 'viral-analysis', 'viral-plan', 'viral-video')),
    status text not null default 'queued' check (status in ('queued', 'leased', 'submitting', 'running', 'succeeded', 'failed', 'cancel_requested', 'cancelled')),
    model_id uuid references public.gouyingai_models(id) on delete set null,
    channel_id uuid references public.gouyingai_channels(id) on delete set null,
    input jsonb not null default '{}'::jsonb,
    upstream_task_id text,
    result jsonb,
    result_patch jsonb,
    error jsonb,
    attempt integer not null default 0 check (attempt >= 0),
    max_attempts integer not null default 1 check (max_attempts > 0),
    lease_owner text,
    lease_expires_at timestamptz,
    heartbeat_at timestamptz,
    queued_at timestamptz not null default now(),
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, client_request_id),
    foreign key (user_id, canvas_id) references public.gouyingai_canvas_projects(user_id, id) on delete restrict
);

create index if not exists gouyingai_canvas_jobs_queue_idx
    on public.gouyingai_canvas_jobs(status, queued_at);

create index if not exists gouyingai_canvas_jobs_canvas_idx
    on public.gouyingai_canvas_jobs(user_id, canvas_id, updated_at desc);

create index if not exists gouyingai_canvas_jobs_target_revision_idx
    on public.gouyingai_canvas_jobs(user_id, canvas_id, target_node_id, generation_revision desc);

create index if not exists gouyingai_canvas_jobs_lease_idx
    on public.gouyingai_canvas_jobs(lease_expires_at)
    where status in ('leased', 'submitting', 'running', 'cancel_requested');

alter table public.gouyingai_canvas_jobs enable row level security;

create table if not exists public.gouyingai_canvas_job_events (
    id bigint generated always as identity primary key,
    job_id uuid not null references public.gouyingai_canvas_jobs(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    canvas_id text not null,
    status text not null,
    stage text,
    details jsonb,
    created_at timestamptz not null default now()
);

create index if not exists gouyingai_canvas_job_events_user_idx
    on public.gouyingai_canvas_job_events(user_id, id);

alter table public.gouyingai_canvas_job_events enable row level security;

create or replace function public.claim_gouyingai_canvas_jobs(
    p_worker_id text,
    p_limit integer,
    p_lease_seconds integer default 60
)
returns setof public.gouyingai_canvas_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.gouyingai_canvas_jobs
    set status = 'cancelled',
        finished_at = coalesce(finished_at, now()),
        lease_owner = null,
        lease_expires_at = null,
        updated_at = now()
    where status = 'cancel_requested'
      and lease_expires_at < now();

    return query
    with candidates as (
        select job.id
        from public.gouyingai_canvas_jobs as job
        where job.status = 'queued'
           or (job.status in ('leased', 'submitting', 'running') and job.lease_expires_at < now())
        order by job.queued_at, job.created_at
        for update skip locked
        limit greatest(0, least(p_limit, 100))
    ), claimed as (
        update public.gouyingai_canvas_jobs as job
        set status = 'leased',
            lease_owner = p_worker_id,
            lease_expires_at = now() + make_interval(secs => greatest(5, p_lease_seconds)),
            heartbeat_at = now(),
            started_at = coalesce(job.started_at, now()),
            attempt = job.attempt + 1,
            updated_at = now()
        from candidates
        where job.id = candidates.id
        returning job.*
    )
    select * from claimed;
end;
$$;

revoke all on function public.claim_gouyingai_canvas_jobs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_gouyingai_canvas_jobs(text, integer, integer) to service_role;
