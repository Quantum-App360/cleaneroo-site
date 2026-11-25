-- Fiches Cleaneur et Cleaneur choisi par le client (prompt 4, lot 5, 25 novembre 2026). Appliqué avec l'accord de Michael (25/11, 15 h 13).
-- 1. Exclusivité selon la date de la prestation (validé par Michael) : 2 h si la prestation a lieu dans moins de 48 h,
--    6 h dans moins de 7 jours, 12 h au-delà. Comptée à la mise en ligne (favori_jusqu), et non plus à la création de la demande.
-- 2. Le Cleaneur demandé qui n'est pas disponible libère la demande tout de suite ; le client peut aussi la proposer à tous
--    à tout moment (liberer_favori). Le client est prévenu quand son Cleaneur se désiste.
-- 3. Le client peut demander un Cleaneur vu sur sa fiche, même s'il n'est pas dans ses favoris (Cleaneur validé qui fait la prestation).
-- 4. cleaneurs_publics : Cleaneurs validés qui couvrent une adresse, avec uniquement ce qu'une fiche publique montre
--    (prénom et initiale, note, nombre d'avis et de prestations, niveau, Pro, prestations, prochains jours disponibles,
--    mois d'inscription, distance arrondie). Jamais le nom complet, le téléphone, l'adresse, la position, le SIRET ni les documents.

alter table public.demandes add column if not exists favori_jusqu timestamptz;

create or replace function public.delai_favori(p_creneau timestamptz, p_depuis timestamptz) returns interval
 language sql immutable set search_path = '' as $$
  select case when p_creneau is null then interval '12 hours'
              when p_creneau - p_depuis < interval '48 hours' then interval '2 hours'
              when p_creneau - p_depuis < interval '7 days' then interval '6 hours'
              else interval '12 hours' end;
$$;

create or replace function public.favori_exclusif(d public.demandes) returns boolean language sql stable set search_path = '' as $$
  select d.choix_cleaneur = 'favori' and d.cleaneur_favori is not null
     and now() < coalesce(d.favori_jusqu, d.cree_le + public.delai_favori(d.creneau, d.cree_le));
$$;

-- Fin de l'exclusivité fixée à la mise en ligne.
create or replace function public.fixer_exclusivite_favori() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.choix_cleaneur = 'favori' and new.cleaneur_favori is not null and new.statut = 'PUBLIEE' and new.favori_jusqu is null
     and (tg_op = 'INSERT' or old.statut is distinct from 'PUBLIEE') then
    new.favori_jusqu := now() + public.delai_favori(new.creneau, now());
  end if;
  return new;
end $$;
drop trigger if exists fixer_exclusivite_favori on public.demandes;
create trigger fixer_exclusivite_favori before insert or update of statut on public.demandes
  for each row execute function public.fixer_exclusivite_favori();

-- Cleaneur demandé : dans le carnet de favoris du client, ou Cleaneur validé (non banni) qui fait cette prestation.
create or replace function public.controler_favori_demande() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.choix_cleaneur = 'favori' and (new.cleaneur_favori is null or not (
       (new.client_id is not null and exists (select 1 from public.favoris f where f.client_id = new.client_id and f.cleaneur_id = new.cleaneur_favori))
       or exists (select 1 from public.profils p where p.id = new.cleaneur_favori and p.dossier = 'VALIDE' and p.banni_le is null
                    and (p.role = 'cleaneur' or 'cleaneur' = any (p.statuts)) and new.rubrique_id = any (coalesce(p.prestations, '{}'))))) then
    new.choix_cleaneur := 'candidatures'; new.cleaneur_favori := null;
  end if;
  if new.choix_cleaneur <> 'favori' then new.cleaneur_favori := null; end if;
  return new;
end $$;

-- Prévenu à la mise en ligne, avec la vraie durée d'exclusivité.
create or replace function public.prevenir_favoris() returns trigger language plpgsql security definer set search_path = '' as $$
declare f record; h integer;
begin
  if new.statut = 'PUBLIEE' and old.statut is distinct from 'PUBLIEE' and new.cleaneur_id is null then
    if new.choix_cleaneur = 'favori' and new.cleaneur_favori is not null then
      h := greatest(1, round(extract(epoch from coalesce(new.favori_jusqu, now() + public.delai_favori(new.creneau, now())) - now()) / 3600)::int);
      perform public.notifier(new.cleaneur_favori, 'cleaneur', 'mission', 'important', 'Un client vous demande personnellement',
        new.ville || ' · réservée pour vous pendant ' || h || ' h, acceptez-la directement', new.reference);
    else
      for f in select cleaneur_id from public.favoris where client_id = new.client_id loop
        perform public.notifier(f.cleaneur_id, 'cleaneur', 'mission', 'important', 'Un client qui vous a mis en favori a une nouvelle demande', new.ville, new.reference);
      end loop;
    end if;
  end if;
  return new;
end $$;

-- Libérer la demande : par le Cleaneur demandé (pas disponible) ou par le client (« Proposer à tous maintenant », jeton pour un invité).
create or replace function public.liberer_favori(p_reference text, p_jeton text default null) returns text
 language plpgsql security definer set search_path = '' as $$
declare d public.demandes;
begin
  select * into d from public.demandes where reference = p_reference;
  if not found then return 'introuvable'; end if;
  if d.statut <> 'PUBLIEE' or d.cleaneur_id is not null or not public.favori_exclusif(d) then return 'deja'; end if;
  if auth.uid() is not null and auth.uid() = d.cleaneur_favori then
    update public.demandes set favori_jusqu = now() where id = d.id;
    if d.client_id is not null then
      perform public.notifier(d.client_id, 'client', 'info', 'standard', 'Votre Cleaneur n''est pas disponible',
        'Votre demande est maintenant proposée aux autres Cleaneurs vérifiés de votre secteur.', d.reference);
    end if;
    return 'ok';
  end if;
  if (auth.uid() is not null and auth.uid() = d.client_id) or (p_jeton is not null and p_jeton = d.jeton::text) or public.est_admin() then
    update public.demandes set favori_jusqu = now() where id = d.id;
    return 'ok';
  end if;
  return 'interdit';
end $$;

-- Suivi côté client : à qui la demande est proposée en premier, et jusqu'à quand (rien si l'exclusivité est terminée).
create or replace function public.favori_de_demande(p_reference text, p_jeton text)
 returns table(prenom text, initiale text, jusqu timestamptz) language sql stable security definer set search_path = '' as $$
  select p.prenom, left(coalesce(p.nom, ''), 1), coalesce(d.favori_jusqu, d.cree_le + public.delai_favori(d.creneau, d.cree_le))
  from public.demandes d join public.profils p on p.id = d.cleaneur_favori
  where d.reference = p_reference and d.jeton::text = p_jeton and d.statut = 'PUBLIEE' and d.cleaneur_id is null and public.favori_exclusif(d);
$$;

-- Demandes réservées au Cleaneur connecté (pour afficher « Je ne suis pas disponible » à côté de « Prendre la mission »).
create or replace function public.mes_demandes_personnelles()
 returns table(reference text, jusqu timestamptz) language sql stable security definer set search_path = '' as $$
  select d.reference, coalesce(d.favori_jusqu, d.cree_le + public.delai_favori(d.creneau, d.cree_le))
  from public.demandes d
  where auth.uid() is not null and d.cleaneur_favori = auth.uid() and d.statut = 'PUBLIEE' and d.cleaneur_id is null and public.favori_exclusif(d);
$$;

-- Fiches publiques : Cleaneurs validés qui couvrent l'adresse pour cette prestation.
create or replace function public.cleaneurs_publics(p_rubrique text, p_lat double precision, p_lon double precision)
 returns table(cleaneur_id uuid, prenom text, initiale text, note numeric, nb_avis integer, realisees integer, niveau integer, pro boolean,
               prestations text[], prochains_jours date[], inscrit_le date, distance_km integer)
 language sql stable security definer set search_path = '' as $$
  with c as (
    select p.*,
      -- distance mesurée depuis le centre arrondi du secteur (grille de 0,05°), puis arrondie au palier supérieur : jamais la position.
      public.km_entre(round(p.zone_lat::numeric * 20)::float8 / 20, round(p.zone_lon::numeric * 20)::float8 / 20, p_lat, p_lon) km
    from public.profils p
    where p.dossier = 'VALIDE' and p.banni_le is null and (p.role = 'cleaneur' or 'cleaneur' = any (p.statuts))
      and p.zone_lat is not null and p.zone_lon is not null and p_lat is not null and p_lon is not null
      and p_rubrique = any (coalesce(p.prestations, '{}'))
      and public.km_entre(p.zone_lat, p.zone_lon, p_lat, p_lon) <= least(coalesce(p.zone_km, 20), 50))
  select c.id, c.prenom, left(coalesce(c.nom, ''), 1),
    (select round(avg(a.note)::numeric, 1) from public.avis a where a.cleaneur_id = c.id),
    (select count(*)::int from public.avis a where a.cleaneur_id = c.id),
    (select count(*)::int from public.demandes d where d.cleaneur_id = c.id and d.statut = 'TERMINEE'),
    coalesce((public.niveau_de(c.id)->>'niveau')::int, 0),
    public.formule_effective(c.id) = 'pro',
    coalesce(c.prestations, '{}'),
    -- Créneaux habituels par jour de la semaine (« 1 » = lundi … « 7 » = dimanche, base-disponibilites.sql) : les 6 prochains jours
    -- ouverts sur 3 semaines, hors périodes fermées du Cleaneur. (Corrigé le 25/11 : les clés sont des jours de la semaine, pas des dates.)
    coalesce((select array_agg(j order by j) from (
       select g::date j from generate_series(current_date + 1, current_date + 20, interval '1 day') g
       where jsonb_typeof(c.disponibilites) = 'object'
         and jsonb_typeof(c.disponibilites -> extract(isodow from g)::int::text) = 'array'
         and jsonb_array_length(c.disponibilites -> extract(isodow from g)::int::text) > 0
         and not exists (select 1 from public.periodes_fermees f where f.cleaneur_id = c.id and g::date between f.debut and f.fin)
       order by 1 limit 6) x), '{}'),
    date_trunc('month', coalesce(c.valide_le, c.cree_le))::date,
    case when c.km < 5 then 5 when c.km < 10 then 10 when c.km < 20 then 20 when c.km < 30 then 30 else 50 end
  from c
  order by 4 desc nulls last, 6 desc, 1
  limit 30;
$$;

revoke all on function public.liberer_favori(text, text) from public;
revoke all on function public.favori_de_demande(text, text) from public;
grant execute on function public.favori_de_demande(text, text) to anon, authenticated;
revoke all on function public.mes_demandes_personnelles() from public, anon;
revoke all on function public.cleaneurs_publics(text, double precision, double precision) from public;
grant execute on function public.liberer_favori(text, text) to anon, authenticated;
grant execute on function public.mes_demandes_personnelles() to authenticated;
grant execute on function public.cleaneurs_publics(text, double precision, double precision) to anon, authenticated;
