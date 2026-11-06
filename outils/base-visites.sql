-- Base Supabase « cleaneroo » (Paris) : compteur de visites du site et des ouvertures de l'appli (6 novembre 2026).
-- Remplace GoatCounter (jamais activé). Aucune donnée personnelle : ni adresse IP, ni cookie, ni identifiant.
-- Une ligne par page vue : nom de la page, site ou appli, type d'appareil, site d'origine (nom de domaine seul),
-- et « nouvelle » = première page de la visite (repérée par le navigateur le temps de l'onglet, sans cookie).
create table if not exists public.visites (
  id bigint generated always as identity primary key,
  jour date not null default (now() at time zone 'Europe/Paris')::date,
  page text not null check (char_length(page) between 1 and 80),
  source text not null default 'site' check (source in ('site', 'appli')),
  appareil text not null default 'ordinateur' check (appareil in ('mobile', 'tablette', 'ordinateur')),
  origine text not null default '' check (char_length(origine) <= 100),
  nouvelle boolean not null default false,
  cree_le timestamptz not null default now()
);
alter table public.visites enable row level security;
create index if not exists visites_jour_idx on public.visites (jour);

-- Tout le monde peut compter une page vue (jamais lire) ; la date est toujours celle du serveur.
create policy "visite : compter" on public.visites for insert to anon, authenticated
  with check (jour = (now() at time zone 'Europe/Paris')::date and cree_le > now() - interval '1 minute');
create policy "visite : admin lit" on public.visites for select to authenticated using ((select public.est_admin()));

-- Statistiques pour la gestion (administration seulement).
create or replace function public.statistiques_visites()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  if not public.est_admin() then raise exception 'réservé à l''administration'; end if;
  return jsonb_build_object(
    'periodes', (select jsonb_agg(jsonb_build_object('jours', j, 'visites', (select count(*) from public.visites v where v.nouvelle and v.source = 'site' and v.jour > aujourdhui - j),
      'pages', (select count(*) from public.visites v where v.jour > aujourdhui - j and v.source = 'site'),
      'appli', (select count(*) from public.visites v where v.jour > aujourdhui - j and v.source = 'appli'))) from unnest(array[1, 7, 30, 36500]) j),
    'par_jour', (select coalesce(jsonb_agg(x order by x->>'jour'), '[]') from (select jsonb_build_object('jour', d::date, 'visites', count(v.id) filter (where v.nouvelle and v.source = 'site'),
        'appli', count(v.id) filter (where v.source = 'appli')) x
      from generate_series(aujourdhui - 29, aujourdhui, interval '1 day') d left join public.visites v on v.jour = d::date group by d) t),
    'pages', (select coalesce(jsonb_agg(jsonb_build_object('page', page, 'n', n) order by n desc), '[]') from (select page, count(*) n from public.visites
      where jour > aujourdhui - 30 and source = 'site' group by page order by n desc limit 15) t),
    'appareils', (select coalesce(jsonb_object_agg(appareil, n), '{}') from (select appareil, count(*) n from public.visites where jour > aujourdhui - 30 and nouvelle and source = 'site' group by appareil) t),
    'origines', (select coalesce(jsonb_agg(jsonb_build_object('origine', origine, 'n', n) order by n desc), '[]') from (select origine, count(*) n from public.visites
      where jour > aujourdhui - 30 and nouvelle and source = 'site' and origine <> '' group by origine order by n desc limit 10) t)
  );
end;
$$;
revoke all on function public.statistiques_visites() from public, anon;
grant execute on function public.statistiques_visites() to authenticated;
