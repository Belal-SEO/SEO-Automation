-- Lets an operator assign a free-text owner name to any issue -- surfaced on
-- the new cross-client Overview board.

alter table public.issues add column if not exists assigned_to text;
