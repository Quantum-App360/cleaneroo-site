-- Ouverture des réservations par interrupteur (24 novembre 2026, décision de Michael) : plus de date de lancement fixe.
-- Les réservations, paiements, prises de mission et propositions restent fermés tant que l'interrupteur n'est pas ouvert ;
-- il ne s'ouvre que si la SAS est renseignée (raison sociale, SIRET à 14 chiffres, adresse) et Stripe en mode réel.
-- Les comptes, espaces, logements, agendas, vitrines et dossiers des Cleaneurs fonctionnent normalement en attendant.
-- Remplace les dates du 31 décembre 2026 / 1er janvier 2027 de base-ouverture.sql, base-propositions*.sql, base-favoris-choix.sql,
-- base-formules-cleaneurs.sql, base-periodes-fermees.sql, base-formations.sql et demande_paiement_initial.

insert into public.infos_cleaneroo (cle, valeur) values ('reservations_ouvertes', 'non'), ('stripe_reel', 'non'), ('ouvert_le', '')
  on conflict (cle) do nothing;

create or replace function public.reservations_ouvertes() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select valeur = 'oui' from public.infos_cleaneroo where cle = 'reservations_ouvertes'), false);
$$;
grant execute on function public.reservations_ouvertes() to anon, authenticated;

-- Ce qui manque pour ouvrir (vide : tout est prêt). Lu par l'espace de gestion.
create or replace function public.manques_ouverture() returns text[] language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when coalesce((select valeur from public.infos_cleaneroo where cle = 'raison_sociale'), '') = '' then 'raison_sociale' end,
    case when coalesce((select valeur from public.infos_cleaneroo where cle = 'siret'), '') !~ '^[0-9]{14}$' then 'siret' end,
    case when coalesce((select valeur from public.infos_cleaneroo where cle = 'adresse'), '') = '' then 'adresse' end,
    case when coalesce((select valeur from public.infos_cleaneroo where cle = 'stripe_reel'), '') <> 'oui' then 'stripe' end], null);
$$;
grant execute on function public.manques_ouverture() to authenticated;

-- Interrupteur (administrateur seulement). Ouvrir : refusé tant qu'il manque quelque chose. Fermer : toujours possible.
create or replace function public.ouvrir_reservations(p_oui boolean) returns text language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_admin() then return 'interdit'; end if;
  if p_oui and cardinality(public.manques_ouverture()) > 0 then return 'manque:' || array_to_string(public.manques_ouverture(), ','); end if;
  update public.infos_cleaneroo set valeur = case when p_oui then 'oui' else 'non' end where cle = 'reservations_ouvertes';
  -- Date de la première ouverture : départ du délai de paiement des anciennes pré-réservations (fonction « paiement »).
  if p_oui then update public.infos_cleaneroo set valeur = now()::text where cle = 'ouvert_le' and valeur = ''; end if;
  return 'ok';
end $$;
revoke all on function public.ouvrir_reservations(boolean) from public, anon;
grant execute on function public.ouvrir_reservations(boolean) to authenticated;

-- Contrôle des demandes : plus de date ; aucune nouvelle demande tant que les réservations sont fermées (sauf administrateur, pour les essais).
create or replace function public.verifier_ouverture() returns trigger language plpgsql set search_path = '' as $$
declare admin boolean := false;
begin
  -- Aucune nouvelle demande tant que les réservations sont fermées (aussi pour le pilote automatique) ; l'administrateur peut tester.
  -- est_admin() n'est appelé que pour un compte connecté (anon n'a pas le droit de l'exécuter).
  if tg_op = 'INSERT' and not public.reservations_ouvertes() then
    if coalesce(auth.role(), '') = 'authenticated' then admin := public.est_admin(); end if;
    if not admin then
      raise exception 'ouverture' using hint = 'Les réservations ne sont pas encore ouvertes.';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.statut = 'PUBLIEE' and old.statut is distinct from 'PUBLIEE'
     and new.creneau is not null and new.creneau < now() then
    raise exception 'creneau_passe' using hint = 'La date de cette demande est déjà passée.';
  end if;
  return new;
end $$;

-- Prise de mission et propositions : même interrupteur au lieu du 1er janvier 2027 ; plus de pré-réservation.
do $$
declare f text; nom text;
begin
  foreach nom in array array['public.prendre_mission(text)', 'public.proposer(text, integer, text, text, integer, timestamp with time zone, text, integer)'] loop
    f := pg_get_functiondef(nom::regprocedure);
    f := replace(f, 'now() < timestamptz ''2027-01-01 00:00 Europe/Paris''', 'not public.reservations_ouvertes()');
    execute f;
  end loop;
  f := pg_get_functiondef('public.demande_paiement_initial()'::regprocedure);
  f := regexp_replace(f, 'new\.prelancement := [^;]*;', 'new.prelancement := false;');
  execute f;
end $$;

-- Appliqué dans Supabase le 24/11/2026 (migrations ouverture_reservations_interrupteur_2411 et ouverture_reservations_correctif_anon_2411).
-- Pré-réservations déjà enregistrées (3 au 24/11/2026) : gardées telles quelles ; la fonction « paiement » ne les fait payer
-- qu'à partir de l'ouverture (ouvert_le), avec le délai de 48 h.
-- « stripe_reel » est mis à jour par la fonction « paiement » (action etat_ouverture, administrateur) selon la clé Stripe en service.
