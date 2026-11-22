-- HelloEarth teaching companion — schema snapshot
-- Applied to Hello Earth DB as migration add_lesson_feedback_and_exercise_links_20261122.
-- Never commit tokens, responses, student names, or service role keys.
create table if not exists public.he_lesson_feedback (
 id uuid primary key default gen_random_uuid(),
 tutor_id uuid not null references auth.users(id) on delete cascade,
 student_id uuid not null,
 lesson_date date not null default current_date,
 objective text not null default '' check (char_length(objective)<=500),
 summary text not null default '' check (char_length(summary)<=2500),
 strengths text not null default '' check (char_length(strengths)<=1500),
 next_steps text not null default '' check (char_length(next_steps)<=1500),
 homework text not null default '' check (char_length(homework)<=1500),
 items jsonb not null default '[]'::jsonb
   check (jsonb_typeof(items)='array' and octet_length(items::text)<=18000),
 status text not null default 'draft' check (status in ('draft','final')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint he_feedback_student_fk foreign key(tutor_id,student_id)
   references public.atlas_students(tutor_id,id) on delete cascade
);
create index if not exists he_feedback_student_date_idx
 on public.he_lesson_feedback(tutor_id,student_id,lesson_date desc,created_at desc);
alter table public.he_lesson_feedback enable row level security;
revoke all on public.he_lesson_feedback from anon;
grant select,insert,update,delete on public.he_lesson_feedback to authenticated;
drop policy if exists he_feedback_select_own on public.he_lesson_feedback;
drop policy if exists he_feedback_insert_own on public.he_lesson_feedback;
drop policy if exists he_feedback_update_own on public.he_lesson_feedback;
drop policy if exists he_feedback_delete_own on public.he_lesson_feedback;
create policy he_feedback_select_own on public.he_lesson_feedback for select to authenticated using ((select auth.uid())=tutor_id);
create policy he_feedback_insert_own on public.he_lesson_feedback for insert to authenticated with check ((select auth.uid())=tutor_id);
create policy he_feedback_update_own on public.he_lesson_feedback for update to authenticated using ((select auth.uid())=tutor_id) with check ((select auth.uid())=tutor_id);
create policy he_feedback_delete_own on public.he_lesson_feedback for delete to authenticated using ((select auth.uid())=tutor_id);

create table if not exists public.he_exercises (
 id uuid primary key default gen_random_uuid(),
 tutor_id uuid not null references auth.users(id) on delete cascade,
 student_id uuid not null,
 title text not null check(char_length(title) between 3 and 140),
 instructions text not null default '' check(char_length(instructions)<=1200),
 questions jsonb not null check(jsonb_typeof(questions)='array'
   and jsonb_array_length(questions) between 1 and 12 and octet_length(questions::text)<=22000),
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 status text not null default 'open' check(status in ('open','closed')),
 expires_at timestamptz not null default(now()+interval '30 days'),
 created_at timestamptz not null default now(),
 constraint he_exercises_student_fk foreign key(tutor_id,student_id)
   references public.atlas_students(tutor_id,id) on delete cascade
);
create index if not exists he_exercises_tutor_student_idx
 on public.he_exercises(tutor_id,student_id,created_at desc);
alter table public.he_exercises enable row level security;
revoke all on public.he_exercises from anon;
grant select,insert,update,delete on public.he_exercises to authenticated;
drop policy if exists he_exercises_select_own on public.he_exercises;
drop policy if exists he_exercises_insert_own on public.he_exercises;
drop policy if exists he_exercises_update_own on public.he_exercises;
drop policy if exists he_exercises_delete_own on public.he_exercises;
create policy he_exercises_select_own on public.he_exercises for select to authenticated using ((select auth.uid())=tutor_id);
create policy he_exercises_insert_own on public.he_exercises for insert to authenticated with check ((select auth.uid())=tutor_id);
create policy he_exercises_update_own on public.he_exercises for update to authenticated using ((select auth.uid())=tutor_id) with check ((select auth.uid())=tutor_id);
create policy he_exercises_delete_own on public.he_exercises for delete to authenticated using ((select auth.uid())=tutor_id);

create table if not exists public.he_exercise_submissions (
 id uuid primary key default gen_random_uuid(),
 exercise_id uuid not null unique references public.he_exercises(id) on delete cascade,
 tutor_id uuid not null references auth.users(id) on delete cascade,
 student_id uuid not null,
 answers jsonb not null check(jsonb_typeof(answers)='array' and octet_length(answers::text)<=14000),
 score smallint not null default 0 check(score between 0 and 12),
 max_score smallint not null default 0 check(max_score between 0 and 12 and score<=max_score),
 submitted_at timestamptz not null default now(),
 constraint he_exercise_answers_student_fk foreign key(tutor_id,student_id)
   references public.atlas_students(tutor_id,id) on delete cascade
);
create index if not exists he_exercise_submissions_tutor_idx
 on public.he_exercise_submissions(tutor_id,student_id,submitted_at desc);
alter table public.he_exercise_submissions enable row level security;
revoke all on public.he_exercise_submissions from anon;
grant select,insert,update,delete on public.he_exercise_submissions to authenticated;
drop policy if exists he_submissions_select_own on public.he_exercise_submissions;
drop policy if exists he_submissions_insert_own on public.he_exercise_submissions;
drop policy if exists he_submissions_update_own on public.he_exercise_submissions;
drop policy if exists he_submissions_delete_own on public.he_exercise_submissions;
create policy he_submissions_select_own on public.he_exercise_submissions for select to authenticated using ((select auth.uid())=tutor_id);
create policy he_submissions_insert_own on public.he_exercise_submissions for insert to authenticated with check ((select auth.uid())=tutor_id);
create policy he_submissions_update_own on public.he_exercise_submissions for update to authenticated using ((select auth.uid())=tutor_id) with check ((select auth.uid())=tutor_id);
create policy he_submissions_delete_own on public.he_exercise_submissions for delete to authenticated using ((select auth.uid())=tutor_id);
