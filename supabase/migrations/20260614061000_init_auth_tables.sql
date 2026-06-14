create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  username text null,
  avatar_url text null,
  cover_url text null,
  bio text null,
  website text null,
  location text null,
  gender text null,
  birth_date date null,
  role text null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_users_email_unique
on public.users (lower(email));

create unique index if not exists idx_users_username_unique
on public.users (lower(username))
where username is not null;

create table if not exists public.refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_refresh_tokens_hash_unique
on public.refresh_tokens (token_hash);

create index if not exists idx_refresh_tokens_user_id
on public.refresh_tokens (user_id);
