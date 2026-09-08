-- GouYingAi cloud sync: user-owned JSON records and private media.

create table if not exists public.gouyingai_canvas_projects (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null,
    payload jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, id)
);

create table if not exists public.gouyingai_assets (
    user_id uuid not null references auth.users(id) on delete cascade,
    id text not null,
    payload jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, id)
);

create table if not exists public.gouyingai_generation_logs (
    user_id uuid not null references auth.users(id) on delete cascade,
    domain text not null check (domain in ('image-workbench', 'video-workbench')),
    id text not null,
    payload jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, domain, id)
);

alter table public.gouyingai_canvas_projects enable row level security;
alter table public.gouyingai_assets enable row level security;
alter table public.gouyingai_generation_logs enable row level security;

create policy "users manage their canvas projects" on public.gouyingai_canvas_projects
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage their assets" on public.gouyingai_assets
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage their generation logs" on public.gouyingai_generation_logs
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('gouyingai-media', 'gouyingai-media', false)
on conflict (id) do nothing;

create policy "users read their GouYingAi media" on storage.objects
    for select using (bucket_id = 'gouyingai-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users upload their GouYingAi media" on storage.objects
    for insert with check (bucket_id = 'gouyingai-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update their GouYingAi media" on storage.objects
    for update using (bucket_id = 'gouyingai-media' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'gouyingai-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete their GouYingAi media" on storage.objects
    for delete using (bucket_id = 'gouyingai-media' and (storage.foldername(name))[1] = auth.uid()::text);
