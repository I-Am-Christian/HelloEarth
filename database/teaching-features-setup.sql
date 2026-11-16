-- HelloEarth learning history schema (reproducible reference for an existing Supabase project)
-- This file contains schema only. Never commit student names, notes or access tokens.

create table if not exists public.atlas_skill_assessments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null,
  assessed_on date not null default current_date,
  speaking smallint check (speaking between 1 and 5),
  listening smallint check (listening between 1 and 5),
  reading smallint check (reading between 1 and 5),
  writing smallint check (writing between 1 and 5),
  grammar smallint check (grammar between 1 and 5),
  confidence smallint check (confidence between 1 and 5),
  notes text not null default '' check (length(notes) <= 2000),
  created_at timestamptz not null default now(),
  constraint atlas_skill_assessments_student_fk foreign key (tutor_id, student_id)
    references public.atlas_students(tutor_id,id) on delete cascade,
  constraint atlas_skill_assessments_any_skill check
    (coalesce(speaking,listening,reading,writing,grammar,confidence) is not null)
);
create index if not exists idx_atlas_skill_assessments_tutor_student_date
  on public.atlas_skill_assessments (tutor_id,student_id,assessed_on desc);
alter table public.atlas_skill_assessments enable row level security;
revoke all on public.atlas_skill_assessments from anon;
grant select,insert,update,delete on public.atlas_skill_assessments to authenticated;
drop policy if exists "assessments select own" on public.atlas_skill_assessments;
drop policy if exists "assessments insert own" on public.atlas_skill_assessments;
drop policy if exists "assessments update own" on public.atlas_skill_assessments;
drop policy if exists "assessments delete own" on public.atlas_skill_assessments;
create policy "assessments select own" on public.atlas_skill_assessments for select to authenticated
  using ((select auth.uid()) = tutor_id);
create policy "assessments insert own" on public.atlas_skill_assessments for insert to authenticated
  with check ((select auth.uid()) = tutor_id);
create policy "assessments update own" on public.atlas_skill_assessments for update to authenticated
  using ((select auth.uid()) = tutor_id) with check ((select auth.uid()) = tutor_id);
create policy "assessments delete own" on public.atlas_skill_assessments for delete to authenticated
  using ((select auth.uid()) = tutor_id);

alter table public.atlas_lesson_notes add column if not exists homework
  text not null default '';
do $$ begin
 if not exists (select 1 from pg_constraint
     where conname='atlas_lesson_notes_homework_length') then
  alter table public.atlas_lesson_notes add constraint atlas_lesson_notes_homework_length
    check (length(homework) <= 1500);
 end if;
end $$;

-- atlas_students, atlas_lesson_notes and atlas_lesson_plans already exist in HelloEarth.
-- Keep their subscription quota triggers and existing tutor-ownership policies intact.
