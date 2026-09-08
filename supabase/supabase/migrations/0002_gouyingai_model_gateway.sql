-- GouYingAi fixed model catalog: admin-managed channels, models, and usage.
-- API keys are stored encrypted; the gateway service holds the decryption key.

create table if not exists public.gouyingai_admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table public.gouyingai_admins enable row level security;

create or replace function public.is_gouyingai_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1 from public.gouyingai_admins
        where user_id = auth.uid()
    );
$$;

create policy "admins can read admin membership" on public.gouyingai_admins
    for select using (auth.uid() = user_id);
create policy "admins can manage admin membership" on public.gouyingai_admins
    for all using (public.is_gouyingai_admin()) with check (public.is_gouyingai_admin());

create table if not exists public.gouyingai_channels (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    base_url text not null,
    api_format text not null default 'openai' check (api_format in ('openai', 'gemini', 'autodl_comfyui')),
    key_ciphertext text not null default '',
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.gouyingai_channels enable row level security;

create policy "everyone can see enabled channels" on public.gouyingai_channels
    for select using (enabled = true);
create policy "admins manage channels" on public.gouyingai_channels
    for all using (public.is_gouyingai_admin()) with check (public.is_gouyingai_admin());

create table if not exists public.gouyingai_models (
    id uuid primary key default gen_random_uuid(),
    channel_id uuid not null references public.gouyingai_channels(id) on delete cascade,
    model_name text not null,
    display_name text not null,
    capability text not null check (capability in ('image', 'video', 'text', 'audio')),
    api_format text not null default 'openai' check (api_format in ('openai', 'gemini', 'autodl_comfyui')),
    published boolean not null default true,
    sort_order integer not null default 0,
    options jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (channel_id, model_name)
);

alter table public.gouyingai_models enable row level security;

create policy "everyone can see published models" on public.gouyingai_models
    for select using (published = true);
create policy "admins manage models" on public.gouyingai_models
    for all using (public.is_gouyingai_admin()) with check (public.is_gouyingai_admin());

create table if not exists public.gouyingai_usage (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    model_id uuid references public.gouyingai_models(id) on delete set null,
    capability text not null,
    status text not null,
    tokens bigint not null default 0,
    cost_micros bigint not null default 0,
    created_at timestamptz not null default now()
);

alter table public.gouyingai_usage enable row level security;

create policy "users insert their usage" on public.gouyingai_usage
    for insert with check (auth.uid() = user_id);
create policy "users read their usage" on public.gouyingai_usage
    for select using (auth.uid() = user_id);
create policy "admins read all usage" on public.gouyingai_usage
    for select using (public.is_gouyingai_admin());

-- Long-running video tasks are mapped to their upstream id by the gateway.
-- Only the gateway (service role) touches this table, so no public RLS policies are created.
create table if not exists public.gouyingai_gateway_tasks (
    task_id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    channel_id uuid not null references public.gouyingai_channels(id) on delete cascade,
    model_id uuid not null references public.gouyingai_models(id) on delete cascade,
    upstream_task_id text not null,
    capability text not null,
    created_at timestamptz not null default now()
);

alter table public.gouyingai_gateway_tasks enable row level security;
