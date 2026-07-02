-- Adds per-task reminder mode (all-day vs specific time) and a precomputed
-- due_at instant that the reminder cron and the client both read from.
-- Run this once in the Supabase SQL Editor (or via `supabase db push`).

alter table tasks add column if not exists reminder_mode text not null default 'daily'
    check (reminder_mode in ('daily', 'exact'));

-- 'HH:MM' 24h string, only meaningful when reminder_mode = 'exact'.
alter table tasks add column if not exists due_time text;

-- Minutes before due_at to send the push, only used when reminder_mode = 'exact'.
alter table tasks add column if not exists reminder_lead_minutes integer not null default 0;

-- The single precomputed UTC instant used for sorting, overdue checks, and
-- the reminder cron. Computed client-side from dueDate (+ due_time) using
-- the device's local timezone, since dueDate/due_time carry no timezone info.
alter table tasks add column if not exists due_at timestamptz;

-- Backfill existing rows: treat legacy all-day tasks as due at local midnight.
-- This is an approximation (assumes UTC) for rows that predate this migration.
update tasks
set due_at = ("dueDate" || 'T00:00:00Z')::timestamptz
where due_at is null and "dueDate" is not null;
