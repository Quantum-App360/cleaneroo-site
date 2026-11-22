-- Pilote automatique prépayé, validation par l'IA, versements Stripe Connect (22 novembre 2026, demande de l'utilisateur).
-- 1. Les ménages du pilote automatique (conciergeries) sont prépayés comme les autres : carte du dernier ménage payé, prélevée
--    3 jours avant (statut A_PRELEVER), argent bloqué jusqu'à la validation. Plus d'exception « pilote » sans paiement.
-- 2. Validation par l'IA (option du logement, réglée dans « Pilote automatique ») : si toutes les pièces du compte rendu sont
--    jugées conformes par l'IA, la prestation est validée tout de suite ; sinon validation par le client, ou automatique à 48 h.
-- 3. Stripe Connect : compte de versement du Cleaneur (ou de sa société). À la validation, sa part (prestation − commission
--    + pourboire + prime d'urgence) lui est transférée ; virement sur son IBAN chaque vendredi.
-- À appliquer après base-paiement-reservation.sql, puis redéployer la fonction « paiement ».

alter table public.profils
  add column if not exists stripe_compte text,
  add column if not exists stripe_compte_actif boolean not null default false;
alter table public.demandes
  add column if not exists versement_statut text,
  add column if not exists versement_c integer,
  add column if not exists versement_id text;
create index if not exists demandes_versement on public.demandes (versement_statut) where versement_statut is not null;

-- Compte de versement : écrit seulement par le serveur (personne ne peut y mettre le compte d'un autre).
create or replace function public.proteger_compte_versement() returns trigger
  language plpgsql set search_path to '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then new.stripe_compte := null; new.stripe_compte_actif := false;
    else new.stripe_compte := old.stripe_compte; new.stripe_compte_actif := old.stripe_compte_actif; end if;
  end if;
  return new;
end $$;
drop trigger if exists profils_compte_versement on public.profils;
create trigger profils_compte_versement before insert or update on public.profils
  for each row execute function public.proteger_compte_versement();

-- Champs de paiement et de versement : jamais écrits par le navigateur ou l'appli. Ménage du pilote automatique (serveur) :
-- copie du modèle sans son paiement ; prélevé 3 jours avant sur la carte du dernier ménage payé du client.
create or replace function public.demande_paiement_initial() returns trigger
  language plpgsql set search_path to '' as $$
declare c text; m text; t boolean;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    if coalesce(new.details->>'pilote', '') = 'true' then
      new.paiement_statut := null; new.paiement_session := null; new.paiement_intent := null; new.paiement_c := null;
      new.paiement_client := null; new.paiement_moyen := null; new.paiement_journal := '[]'::jsonb; new.groupe_paiement := null;
      new.versement_statut := null; new.versement_c := null; new.versement_id := null;
      select x.paiement_client, x.paiement_moyen, x.paiement_test into c, m, t from public.demandes x
       where x.client_id = new.client_id and x.paiement_client is not null and x.paiement_moyen is not null
       order by x.cree_le desc limit 1;
      if m is not null then
        new.paiement_statut := 'A_PRELEVER'; new.paiement_client := c; new.paiement_moyen := m; new.paiement_test := t;
      end if;
    end if;
    return new;
  end if;
  new.paiement_statut := null; new.paiement_session := null; new.paiement_intent := null; new.paiement_c := null;
  new.paiement_test := null; new.paiement_client := null; new.paiement_moyen := null; new.paiement_journal := '[]'::jsonb;
  new.versement_statut := null; new.versement_c := null; new.versement_id := null;
  new.prelancement := coalesce(new.prelancement, false) and now() < timestamptz '2026-12-31 00:00 Europe/Paris';
  new.details := coalesce(new.details, '{}'::jsonb) - 'pilote';
  return new;
end $$;

-- Garantie : payée, ou carte enregistrée (passage suivant, ménage du pilote). Seules les demandes sur devis font exception.
create or replace function public.paiement_garanti(d public.demandes) returns boolean
  language sql stable set search_path to '' as $$
  select coalesce(d.sur_devis, false)
      or coalesce(d.paiement_statut, '') in ('PAYE', 'A_PRELEVER', 'LIBERE', 'AUTORISE', 'ENCAISSE');
$$;

-- Validation par l'IA : option « validationIa » du pilote du logement. Toutes les pièces conformes, aucun litige ouvert :
-- la prestation est validée dès la fin (le paiement est alors libéré et versé au Cleaneur).
create or replace function public.validation_par_ia() returns trigger
  language plpgsql security definer set search_path to '' as $$
begin
  if new.statut = 'A_VALIDER' and old.statut is distinct from 'A_VALIDER'
     and exists (select 1 from public.biens b where b.id = new.details->>'logementId' and b.client_id = new.client_id
                 and coalesce((b.donnees->'pilote'->>'validationIa')::boolean, false))
     and exists (select 1 from public.controles_pieces c where c.reference = new.reference)
     and not exists (select 1 from public.controles_pieces c where c.reference = new.reference and coalesce(c.ia_statut, '') <> 'ok')
     and not exists (select 1 from public.litiges l where l.demande_id = new.id and l.statut = 'OUVERT') then
    new.statut := 'TERMINEE';
    new.etapes := coalesce(new.etapes, '{}'::jsonb) || jsonb_build_object('valide_ia', now());
  end if;
  return new;
end $$;
drop trigger if exists demandes_validation_ia on public.demandes;
create trigger demandes_validation_ia before update of statut on public.demandes
  for each row execute function public.validation_par_ia();
