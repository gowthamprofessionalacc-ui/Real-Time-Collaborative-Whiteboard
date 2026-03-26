-- =============================================================
-- WHITEBOARD DATABASE SCHEMA (Safe to re-run)
-- =============================================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/oqapmvxkupaxsoxohuel/sql/new

-- ============ DROP EXISTING (clean slate) ============
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.board_elements cascade;
drop table if exists public.boards cascade;
drop table if exists public.profiles cascade;

-- ============ PROFILES ============
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ============ BOARDS ============
create table public.boards (
  id text primary key,
  title text not null default 'Untitled Board',
  owner_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.boards enable row level security;

create policy "Boards are viewable by everyone"
  on public.boards for select using (true);

create policy "Users can create boards"
  on public.boards for insert with check (auth.uid() = owner_id);

create policy "Owners can update boards"
  on public.boards for update using (auth.uid() = owner_id);

create policy "Owners can delete boards"
  on public.boards for delete using (auth.uid() = owner_id);

-- ============ BOARD ELEMENTS ============
create table public.board_elements (
  id text primary key,
  board_id text references public.boards(id) on delete cascade not null,
  element_type text not null,
  element_data jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.board_elements enable row level security;

create policy "Elements are viewable by everyone"
  on public.board_elements for select using (true);

create policy "Authenticated users can add elements"
  on public.board_elements for insert with check (auth.uid() is not null);

create policy "Authenticated users can update elements"
  on public.board_elements for update using (auth.uid() is not null);

create policy "Authenticated users can delete elements"
  on public.board_elements for delete using (auth.uid() is not null);

create index idx_board_elements_board_id on public.board_elements(board_id);

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
