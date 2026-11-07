-- Visites uniques (7 novembre 2026, demande de l'utilisateur) : une même adresse IP ne compte qu'une visite par jour,
-- même si elle recharge la page, ouvre plusieurs onglets ou se connecte plusieurs fois.
-- L'adresse IP n'est jamais enregistrée en clair (RGPD) : on garde seulement une empreinte (md5 de l'IP + jour + sel secret),
-- qui change chaque jour et ne permet pas de retrouver l'adresse.

alter table public.visites add column if not exists visiteur text;
create index if not exists visites_jour_visiteur on public.visites (jour, visiteur);

-- Sel secret, illisible par le site (aucune règle de lecture).
create table if not exists public.sel_visites (sel text not null);
alter table public.sel_visites enable row level security;
insert into public.sel_visites (sel) select md5(random()::text || clock_timestamp()::text) where not exists (select 1 from public.sel_visites);

create or replace function public.empreinte_visiteur() returns trigger
language plpgsql security definer set search_path = '' as $$
declare h json := nullif(current_setting('request.headers', true), '')::json; ip text;
begin
  ip := trim(split_part(coalesce(h->>'cf-connecting-ip', h->>'x-real-ip', h->>'x-forwarded-for', ''), ',', 1));
  new.visiteur := case when ip = '' then null else md5(ip || '|' || new.jour::text || '|' || (select sel from public.sel_visites limit 1)) end;
  return new;
end $$;
drop trigger if exists visites_empreinte on public.visites;
create trigger visites_empreinte before insert on public.visites for each row execute function public.empreinte_visiteur();

-- Statistiques : visiteurs uniques par jour (anciennes lignes sans empreinte : comptées comme avant, « nouvelle visite »).
create or replace function public.statistiques_visites() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  if not public.est_admin() then raise exception 'réservé à l''administration'; end if;
  return jsonb_build_object(
    'periodes', (select jsonb_agg(jsonb_build_object('jours', j,
      'visites', (select count(distinct case when v.visiteur is not null then v.jour || v.visiteur when v.nouvelle then v.id::text end) from public.visites v where v.source = 'site' and v.jour > aujourdhui - j),
      'pages', (select count(*) from public.visites v where v.jour > aujourdhui - j and v.source = 'site'),
      'appli', (select count(distinct coalesce(v.jour || v.visiteur, v.id::text)) from public.visites v where v.jour > aujourdhui - j and v.source = 'appli'))) from unnest(array[1, 7, 30, 36500]) j),
    'par_jour', (select coalesce(jsonb_agg(x order by x->>'jour'), '[]') from (select jsonb_build_object('jour', d::date,
        'visites', count(distinct case when v.visiteur is not null then v.visiteur when v.nouvelle then v.id::text end) filter (where v.source = 'site'),
        'appli', count(distinct coalesce(v.visiteur, v.id::text)) filter (where v.source = 'appli')) x
      from generate_series(aujourdhui - 29, aujourdhui, interval '1 day') d left join public.visites v on v.jour = d::date group by d) t),
    'pages', (select coalesce(jsonb_agg(jsonb_build_object('page', page, 'n', n) order by n desc), '[]') from (select page, count(*) n from public.visites
      where jour > aujourdhui - 30 and source = 'site' group by page order by n desc limit 15) t),
    'appareils', (select coalesce(jsonb_object_agg(appareil, n), '{}') from (select appareil, count(distinct case when visiteur is not null then jour || visiteur when nouvelle then id::text end) n
      from public.visites where jour > aujourdhui - 30 and source = 'site' group by appareil) t),
    'origines', (select coalesce(jsonb_agg(jsonb_build_object('origine', origine, 'n', n) order by n desc), '[]') from (select origine, count(distinct case when visiteur is not null then jour || visiteur when nouvelle then id::text end) n
      from public.visites where jour > aujourdhui - 30 and source = 'site' and origine <> '' group by origine order by n desc limit 10) t)
  );
end $$;
