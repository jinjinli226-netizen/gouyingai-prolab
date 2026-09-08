-- Recover jobs after a worker process dies in any active execution state.
create index if not exists gouyingai_canvas_jobs_target_revision_idx
    on public.gouyingai_canvas_jobs(user_id, canvas_id, target_node_id, generation_revision desc);

drop index if exists public.gouyingai_canvas_jobs_lease_idx;
create index if not exists gouyingai_canvas_jobs_lease_idx
    on public.gouyingai_canvas_jobs(lease_expires_at)
    where status in ('leased', 'submitting', 'running', 'cancel_requested');

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
