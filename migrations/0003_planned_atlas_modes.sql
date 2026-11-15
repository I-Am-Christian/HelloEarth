begin;
alter table public.helloearth_plans
  add column if not exists planned_atlas_runtime text not null default 'local',
  add column if not exists planned_byo_api_support boolean not null default true;
alter table public.helloearth_plans
  add constraint helloearth_planned_atlas_runtime_check
  check (planned_atlas_runtime in ('local', 'cloud'));
update public.helloearth_plans
set planned_atlas_runtime = case
  when code in ('free','starter') then 'local'
  when code in ('growth','studio') then 'cloud'
end,
planned_byo_api_support = true;
comment on column public.helloearth_plans.planned_atlas_runtime is
'Planned product positioning only. Does not grant inference access; actual hosted Atlas is not yet released.';
comment on column public.helloearth_plans.planned_byo_api_support is
'Planned: support tutor-owned AI API keys on every plan. Does not indicate a currently available API integration.';
commit;