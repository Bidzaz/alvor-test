-- =====================================================================
-- Alvor · life in the circle (October, step 2)
-- Run once: SQL Editor → New query → paste everything → Run.
-- Safe to run again.
--
-- Adds:
--   tighter rules   reactions and comments from switched-off accounts are
--                   hidden; switched-off accounts can't write; areas and
--                   gardens only accept real targets; a calm hourly limit
--   clean-up        deleting a plant deletes its reactions and comments
--   activity_feed   the small feed on the Friends screen
--   activity_seen   when you last looked at it (for the badge)
--   notifications   a new reaction or comment asks the "notify" function
--                   to tell the people involved (social_push_for decides who)
-- =====================================================================


-- ---------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------

-- Only real areas, and 'garden' for the whole garden. (Not checked on old rows.)
alter table public.reactions drop constraint if exists reactions_target_ok;
alter table public.reactions add constraint reactions_target_ok check (
  target_type = 'plant'
  or (target_type = 'area' and target_id in ('house','balcony','porch','outside','greenhouse'))
  or (target_type = 'garden' and target_id = 'garden')) not valid;
alter table public.comments drop constraint if exists comments_target_ok;
alter table public.comments add constraint comments_target_ok check (
  target_type = 'plant'
  or (target_type = 'area' and target_id in ('house','balcony','porch','outside','greenhouse'))
  or (target_type = 'garden' and target_id = 'garden')) not valid;

drop policy if exists reactions_read   on public.reactions;
drop policy if exists reactions_insert on public.reactions;
drop policy if exists comments_read    on public.comments;
drop policy if exists comments_insert  on public.comments;
drop policy if exists comments_update  on public.comments;

create policy reactions_read on public.reactions for select to authenticated
  using (private.can_see_target(garden_owner, target_type, target_id)
         and not private.blocked_between(user_id, (select auth.uid()))
         and (user_id = (select auth.uid()) or not private.is_disabled(user_id)));
create policy reactions_insert on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid())
              and not private.is_disabled((select auth.uid()))
              and private.can_see_target(garden_owner, target_type, target_id));

create policy comments_read on public.comments for select to authenticated
  using (private.can_see_target(garden_owner, target_type, target_id)
         and not private.blocked_between(user_id, (select auth.uid()))
         and (user_id = (select auth.uid()) or not private.is_disabled(user_id)));
create policy comments_insert on public.comments for insert to authenticated
  with check (user_id = (select auth.uid())
              and not private.is_disabled((select auth.uid()))
              and private.can_see_target(garden_owner, target_type, target_id));

-- Comments and reactions aren't changed after the fact (delete and write again).
revoke update on public.comments  from authenticated;
revoke update on public.reactions from authenticated;

-- A calm limit, so nobody can flood a garden.
create or replace function private.social_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'comments' then
    if (select count(*) from public.comments where user_id = new.user_id
        and created_at > now() - interval '1 hour') >= 60 then
      raise exception 'You''ve written a lot of comments in the last hour. Try again a little later.';
    end if;
  elsif (select count(*) from public.reactions where user_id = new.user_id
         and created_at > now() - interval '1 hour') >= 300 then
    raise exception 'That''s a lot of reactions for one hour. Try again a little later.';
  end if;
  return new;
end;
$$;
drop trigger if exists comments_limit  on public.comments;
drop trigger if exists reactions_limit on public.reactions;
create trigger comments_limit  before insert on public.comments  for each row execute function private.social_limit();
create trigger reactions_limit before insert on public.reactions for each row execute function private.social_limit();

-- Deleting a plant deletes what was said about it.
create or replace function private.on_plant_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.reactions where target_type = 'plant' and target_id = old.id::text;
  delete from public.comments  where target_type = 'plant' and target_id = old.id::text;
  return old;
end;
$$;
drop trigger if exists plants_after_delete on public.plants;
create trigger plants_after_delete after delete on public.plants for each row execute function private.on_plant_delete();


-- ---------------------------------------------------------------------
-- The activity feed
-- ---------------------------------------------------------------------

alter table public.accounts add column if not exists activity_seen_at timestamptz;
grant update (activity_seen_at) on public.accounts to authenticated;

-- What's new, newest first:
--   reaction  someone reacted to your plant, area or garden (one line per person and thing)
--   comment   someone commented on your plant, area or garden
--   reply     someone commented where you commented before, in someone else's garden
--   photo     a friend added photos of a plant (one line per plant and day, last 14 days)
-- Everything goes through the same visibility rules as the rest of the app.
create or replace function public.activity_feed(p_limit int default 40)
returns table(kind text, happened_at timestamptz, actor_id uuid, actor_username text, actor_name text,
              actor_avatar text, garden_owner uuid, owner_name text, owner_home text,
              target_type text, target_id text, target_name text, detail text, n int)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  lim int := least(greatest(coalesce(p_limit, 40), 1), 100);
begin
  if me is null then raise exception 'Please sign in.'; end if;
  return query
  with items as (
    select 'reaction'::text as k, max(x.created_at) as t, x.user_id as actor, x.garden_owner as owner,
           x.target_type as tt, x.target_id as tid, string_agg(x.kind, ',' order by x.created_at) as d, count(*)::int as cnt
    from public.reactions x
    where x.garden_owner = me and x.user_id <> me and x.created_at > now() - interval '60 days'
    group by x.user_id, x.garden_owner, x.target_type, x.target_id
    union all
    select 'comment', c.created_at, c.user_id, c.garden_owner, c.target_type, c.target_id, left(c.body, 200), 1
    from public.comments c
    where c.garden_owner = me and c.user_id <> me and c.created_at > now() - interval '60 days'
    union all
    select 'reply', c.created_at, c.user_id, c.garden_owner, c.target_type, c.target_id, left(c.body, 200), 1
    from public.comments c
    where c.garden_owner <> me and c.user_id <> me and c.created_at > now() - interval '60 days'
      and exists (select 1 from public.comments m
                  where m.user_id = me and m.garden_owner = c.garden_owner and m.target_type = c.target_type
                    and m.target_id = c.target_id and m.created_at < c.created_at)
    union all
    select 'photo', max(coalesce(ph.taken_at, ph.created_at)), ph.owner_id, ph.owner_id, 'plant', ph.plant_id::text, null, count(*)::int
    from public.photos ph
    where ph.owner_id <> me and not ph.hidden
      and ph.created_at > now() - interval '14 days'
      and coalesce(ph.taken_at, ph.created_at) > now() - interval '14 days'
      and private.are_friends(ph.owner_id, me)
    group by ph.owner_id, ph.plant_id, (coalesce(ph.taken_at, ph.created_at))::date
  )
  select i.k, i.t, i.actor, pa.username, pa.display_name, pa.avatar_path,
         i.owner, po.display_name, coalesce(g.home, 'house'),
         i.tt, i.tid, pl.name, i.d, i.cnt
  from items i
  join public.profiles pa on pa.id = i.actor
  join public.profiles po on po.id = i.owner
  left join public.gardens g on g.owner_id = i.owner
  left join public.plants pl on i.tt = 'plant' and pl.id::text = i.tid
  where not private.is_disabled(i.actor)
    and not private.blocked_between(i.actor, me)
    and private.can_see_target(i.owner, i.tt, i.tid)
  order by i.t desc
  limit lim;
end;
$$;


-- ---------------------------------------------------------------------
-- Notifications for reactions and comments
-- ---------------------------------------------------------------------

-- Server only: when someone was last told about a person's reactions on one thing,
-- so a burst of reactions sends one notification, not six.
create table if not exists public.social_push_log (
  recipient  uuid not null references public.profiles(id) on delete cascade,
  actor      uuid not null references public.profiles(id) on delete cascade,
  target     text not null,
  sent_at    timestamptz not null default now(),
  primary key (recipient, actor, target)
);
alter table public.social_push_log enable row level security;
revoke all on public.social_push_log from anon, authenticated;

-- Can this person (not the one signed in) see this plant, area or garden?
create or replace function private.can_see_target_for(viewer uuid, owner uuid, ttype text, tid text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if viewer = owner then return true; end if;
  if private.is_disabled(owner) or private.blocked_between(owner, viewer) then return false; end if;
  if ttype = 'plant' then
    if tid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
    return exists (select 1 from public.plants p where p.id = tid::uuid and p.owner_id = owner
                   and ((p.visibility = 'friends' and private.are_friends(owner, viewer)) or p.visibility = 'everyone'));
  end if;
  return private.are_friends(owner, viewer);
end;
$$;

-- How an area is named in a sentence ("your porch", "Ana's greenhouse").
create or replace function private.area_phrase(a text, home text) returns text
language sql immutable set search_path = '' as $$
  select case a when 'house' then case when home = 'apartment' then 'indoor plants' else 'house' end
                when 'outside' then 'outdoor garden' else a end;
$$;

-- Called by the "notify" function (server only). Says who to tell about one new
-- reaction or comment, and what to tell them.
create or replace function public.social_push_for(p_table text, p_id uuid)
returns table(recipient uuid, title text, body text, tag text, hash text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_actor uuid; v_owner uuid; v_tt text; v_tid text; v_text text; v_kind text;
  actor_name text; owner_name text; v_home text; thing text; r record; fresh boolean;
begin
  if p_table = 'reactions' then
    select x.user_id, x.garden_owner, x.target_type, x.target_id, x.kind
      into v_actor, v_owner, v_tt, v_tid, v_kind from public.reactions x where x.id = p_id;
  elsif p_table = 'comments' then
    select c.user_id, c.garden_owner, c.target_type, c.target_id, c.body
      into v_actor, v_owner, v_tt, v_tid, v_text from public.comments c where c.id = p_id;
  end if;
  if v_actor is null or private.is_disabled(v_actor) then return; end if;   -- gone already (an undone reaction)

  select p.display_name into actor_name from public.profiles p where p.id = v_actor;
  select p.display_name into owner_name from public.profiles p where p.id = v_owner;
  select coalesce(g.home, 'house') into v_home from public.gardens g where g.owner_id = v_owner;
  thing := case v_tt
    when 'plant' then (select p.name from public.plants p where p.id::text = v_tid and p.owner_id = v_owner)
    when 'area'  then private.area_phrase(v_tid, v_home)
    else 'garden' end;
  if thing is null then return; end if;

  for r in
    select v_owner as rid, 'owner'::text as role where v_owner <> v_actor
    union
    select distinct c.user_id, 'thread' from public.comments c
    where p_table = 'comments' and c.garden_owner = v_owner and c.target_type = v_tt and c.target_id = v_tid
      and c.user_id <> v_actor and c.user_id <> v_owner
  loop
    continue when private.is_disabled(r.rid) or private.blocked_between(r.rid, v_actor);
    continue when not private.can_see_target_for(r.rid, v_owner, v_tt, v_tid);
    continue when coalesce((select gp.settings->>'socialPush' from public.garden_private gp where gp.owner_id = r.rid), 'true') = 'false';

    if p_table = 'reactions' then
      -- one notification per person and thing every 30 minutes
      insert into public.social_push_log as l (recipient, actor, target)
      values (r.rid, v_actor, v_tt || ':' || v_tid)
      on conflict on constraint social_push_log_pkey do update set sent_at = now()
        where l.sent_at < now() - interval '30 minutes'
      returning true into fresh;
      continue when fresh is null;
      fresh := null;
    end if;

    recipient := r.rid;
    tag := 'talk-' || left(v_owner::text, 8) || '-' || v_tt || '-' || left(v_tid, 12);
    hash := 'talk=' || v_owner || '.' || v_tt || '.' || v_tid;
    if p_table = 'reactions' then
      title := actor_name || ' reacted to your ' || thing;
      body := case v_kind when 'love' then '❤️ Love it' when 'growing' then '🌱 Growing well'
                          when 'pretty' then '🌸 So pretty' when 'wow' then '😮 Impressive'
                          when 'thirsty' then '💧 Needs water?' when 'soggy' then '🌊 Too much water?' else '' end;
    elsif r.role = 'owner' then
      title := actor_name || ' commented on your ' || thing;
      body := left(v_text, 180);
    else
      title := 'New comment on ' || owner_name || '''s ' || thing;
      body := actor_name || ': ' || left(v_text, 160);
    end if;
    return next;
  end loop;

  -- Keep the log small.
  delete from public.social_push_log where sent_at < now() - interval '2 days';
end;
$$;

-- Each new reaction or comment asks the "notify" function to send its notifications.
-- If that call can't be made, the reaction or comment is still saved.
create or replace function private.social_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform net.http_post(
      url := 'https://ihufhwnwzmzuhfxiwbal.supabase.co/functions/v1/notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-key', (select value #>> '{}' from public.app_config where key = 'cron_key')),
      body := jsonb_build_object('action', 'social', 'table', tg_table_name, 'id', new.id),
      timeout_milliseconds := 10000);
  exception when others then
    null;
  end;
  return null;
end;
$$;
drop trigger if exists comments_notify  on public.comments;
drop trigger if exists reactions_notify on public.reactions;
create trigger comments_notify  after insert on public.comments  for each row execute function private.social_notify();
create trigger reactions_notify after insert on public.reactions for each row execute function private.social_notify();


-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
revoke all on function public.activity_feed(int), public.social_push_for(text, uuid) from public, anon, authenticated;
grant execute on function public.activity_feed(int) to authenticated;
grant execute on function public.social_push_for(text, uuid) to service_role;
revoke all on function private.can_see_target_for(uuid, uuid, text, text), private.area_phrase(text, text),
  private.social_notify(), private.social_limit(), private.on_plant_delete() from public, anon;
grant execute on function private.can_see_target_for(uuid, uuid, text, text), private.area_phrase(text, text)
  to authenticated, service_role;

-- Done.
