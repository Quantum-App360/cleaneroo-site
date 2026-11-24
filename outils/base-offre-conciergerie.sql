-- Offre « Conciergerie fondatrice » (24 novembre 2026, remplace « 1er mois offert »). Copie des règles de regles.js
-- (OFFRE_CONCIERGERIE_*, etatOffreConciergerie) : à garder identiques.
--  - inscription jusqu'au 31 janvier 2027 23 h 59 (heure de Paris), sans limite de nombre ;
--  - 3 mois de la tranche gratuits et 0 % de frais de service à partir de la PREMIÈRE INTERVENTION TERMINÉE ET VALIDÉE ;
--  - +1 mois (une seule fois, ajouté à la fin) si 3 Cleaneurs invités ont leur dossier validé et au moins une intervention ;
--  - prix garanti 12 mois après la fin ; rappels 30 et 7 jours avant ; AUCUN PRÉLÈVEMENT SANS ACCORD EXPLICITE :
--    sans réponse, la conciergerie reste sans abonnement (8 % de frais de service).
-- Ne touche ni aux prix, ni aux commissions, ni aux tranches. Appliqué dans Supabase le 24/11/2026 (migration offre_conciergerie_fondatrice_2411) ;
-- fonction « paiement » (version 8) : 0 % de frais de service pendant l'offre (estAbonne).

alter table public.profils add column if not exists offre_conciergerie_debut timestamptz;
alter table public.profils add column if not exists offre_conciergerie_choix text not null default '';
alter table public.profils add column if not exists offre_conciergerie_rappels smallint[] not null default '{}';
-- Fin de la période offerte, tenue à jour (démarrage, puis chaque jour pour le mois bonus) : le site la lit dans le profil.
alter table public.profils add column if not exists offre_conciergerie_fin timestamptz;

create or replace function public.offre_conciergerie_eligible(p public.profils) returns boolean language sql stable set search_path = '' as $$
  select 'pro' = any (coalesce(p.statuts, '{}')) and p.cree_le <= timestamptz '2027-01-31 23:59:59 Europe/Paris';
$$;

-- Cleaneurs invités par la conciergerie qui comptent pour le mois bonus.
create or replace function public.offre_conciergerie_cleaneurs(p_pro uuid) returns integer language sql stable security definer set search_path = '' as $$
  select count(distinct i.cleaneur_id)::integer from public.invitations_pro i join public.profils c on c.id = i.cleaneur_id
  where i.pro_id = p_pro and i.statut = 'ACTIF' and c.dossier = 'VALIDE'
    and exists (select 1 from public.demandes d where d.statut = 'TERMINEE' and (d.cleaneur_id = i.cleaneur_id or i.cleaneur_id = any (d.equipiers)));
$$;
revoke all on function public.offre_conciergerie_cleaneurs(uuid) from public, anon, authenticated;

create or replace function public.offre_conciergerie_fin(p public.profils) returns timestamptz language sql stable security definer set search_path = '' as $$
  select case when p.offre_conciergerie_debut is null then null
    else p.offre_conciergerie_debut + make_interval(months => 3 + case when public.offre_conciergerie_cleaneurs(p.id) >= 3 then 1 else 0 end) end;
$$;
revoke all on function public.offre_conciergerie_fin(public.profils) from public, anon, authenticated;

-- Démarrage : première intervention TERMINEE (validée) dans un logement de la conciergerie.
create or replace function public.demarrer_offre_conciergerie() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.statut = 'TERMINEE' and old.statut is distinct from 'TERMINEE' and new.client_id is not null then
    update public.profils p set offre_conciergerie_debut = now(), offre_conciergerie_fin = now() + interval '3 months'
    where p.id = new.client_id and p.offre_conciergerie_debut is null and public.offre_conciergerie_eligible(p);
  end if;
  return new;
end $$;
drop trigger if exists demarrer_offre_conciergerie on public.demandes;
create trigger demarrer_offre_conciergerie after update of statut on public.demandes
  for each row execute function public.demarrer_offre_conciergerie();

-- Ce que le site affiche (même calcul que etatOffreConciergerie).
create or replace function public.mon_offre_conciergerie() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('inscrit_le', p.cree_le, 'eligible', public.offre_conciergerie_eligible(p), 'debut', p.offre_conciergerie_debut,
    'cleaneurs_bonus', public.offre_conciergerie_cleaneurs(p.id), 'fin', public.offre_conciergerie_fin(p), 'choix', p.offre_conciergerie_choix)
  from public.profils p where p.id = auth.uid();
$$;
revoke all on function public.mon_offre_conciergerie() from public, anon;
grant execute on function public.mon_offre_conciergerie() to authenticated;

-- Choix explicite de fin de période : « continuer » avec une tranche (seul cas où un abonnement payant démarre) ou « arreter ».
create or replace function public.choisir_suite_offre(p_choix text, p_tranche text default null) returns text language plpgsql security definer set search_path = '' as $$
declare p public.profils;
begin
  select * into p from public.profils where id = auth.uid();
  if p.id is null or not public.offre_conciergerie_eligible(p) or p.offre_conciergerie_debut is null then return 'interdit'; end if;
  if p_choix = 'continuer' and p_tranche in ('t1', 't2', 't3', 't4', 't5', 't6') then
    update public.profils set offre_conciergerie_choix = 'continuer', abonnement_pro = p_tranche,
      abonnement_pro_depuis = greatest(now(), public.offre_conciergerie_fin(p)) where id = p.id;
    return 'ok';
  elsif p_choix = 'arreter' then
    update public.profils set offre_conciergerie_choix = 'arreter', abonnement_pro = 'aucun', abonnement_pro_depuis = null where id = p.id;
    return 'ok';
  end if;
  return 'invalide';
end $$;
revoke all on function public.choisir_suite_offre(text, text) from public, anon;
grant execute on function public.choisir_suite_offre(text, text) to authenticated;

-- Tâche quotidienne (pg_cron) : rappels à 30 et 7 jours ; à la fin, sans réponse, sans abonnement (rien n'est prélevé).
create or replace function public.tache_offre_conciergerie() returns void language plpgsql security definer set search_path = '' as $$
declare p public.profils; fin timestamptz; j integer; r smallint;
begin
  for p in select * from public.profils where offre_conciergerie_debut is not null and offre_conciergerie_choix = '' loop
    fin := public.offre_conciergerie_fin(p);
    if fin is distinct from p.offre_conciergerie_fin then update public.profils set offre_conciergerie_fin = fin where id = p.id; end if;
    j := ceil(extract(epoch from fin - now()) / 86400);
    foreach r in array array[30, 7]::smallint[] loop
      if j <= r and j > 0 and not (r = any (p.offre_conciergerie_rappels)) then
        perform public.notifier(p.id, 'client', 'info', 'important', 'Votre offre Conciergerie fondatrice se termine dans ' || j || ' jours',
          'Choisissez « Continuer avec l''abonnement » ou « Ne pas continuer » dans « Mon abonnement ». Sans réponse, rien n''est prélevé : vous passez sans abonnement (8 % de frais de service).', null);
        update public.profils set offre_conciergerie_rappels = offre_conciergerie_rappels || r where id = p.id;
      end if;
    end loop;
    if fin <= now() then
      update public.profils set offre_conciergerie_choix = 'sans_reponse', abonnement_pro = 'aucun', abonnement_pro_depuis = null where id = p.id;
    end if;
  end loop;
end $$;
revoke all on function public.tache_offre_conciergerie() from public, anon, authenticated;
select cron.schedule('offre-conciergerie', '17 8 * * *', 'select public.tache_offre_conciergerie()');   -- appliqué le 24/11/2026
-- E-mail des rappels : à brancher sur l'envoi d'e-mails existant (la notification ci-dessus est déjà envoyée).
