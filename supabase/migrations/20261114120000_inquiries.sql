-- PENTI: poptávky z webu (schéma penti.inquiry.v1)
-- Spusťte v Supabase SQL editoru, nebo přes supabase db push.
-- Zápis dělá jen Netlify Function se service role klíčem.
-- Anonymní a přihlášený klíč z prohlížeče k tabulkám přístup nemá.

create table if not exists public.inquiries (
  id uuid primary key,
  schema_version text not null default 'penti.inquiry.v1',
  created_at timestamptz not null,
  received_at timestamptz not null default now(),
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'in_review', 'quoted', 'won', 'lost')),
  locale text not null,
  channel text not null,
  category text not null,
  quality_score integer check (quality_score between 0 and 100),
  payload jsonb not null,
  contact_name text,
  contact_email text,
  contact_phone text
);

create index if not exists inquiries_status_received_idx
  on public.inquiries (status, received_at desc);

create table if not exists public.inquiry_events (
  id bigint generated always as identity primary key,
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  created_at timestamptz not null default now(),
  event_type text not null,
  detail jsonb
);

create index if not exists inquiry_events_inquiry_idx
  on public.inquiry_events (inquiry_id, created_at);

create table if not exists public.attachments (
  id text primary key,
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  type text not null check (type in ('foto', 'vykres', 'jiny')),
  filename text not null,
  bytes integer,
  sha256 text,
  url text
);

create index if not exists attachments_inquiry_idx
  on public.attachments (inquiry_id);

create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('kontakt', 'kariera')),
  name text not null,
  email text not null,
  phone text not null,
  message text,
  trade text
);

alter table public.inquiries enable row level security;
alter table public.inquiry_events enable row level security;
alter table public.attachments enable row level security;
alter table public.contact_messages enable row level security;

revoke all on table public.inquiries from anon, authenticated;
revoke all on table public.inquiry_events from anon, authenticated;
revoke all on table public.attachments from anon, authenticated;
revoke all on table public.contact_messages from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('inquiry-attachments', 'inquiry-attachments', false)
on conflict (id) do nothing;
