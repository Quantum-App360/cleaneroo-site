-- Paiement à la réservation, argent bloqué jusqu'à la validation (22 novembre 2026, demande de l'utilisateur).
-- Règle : le client paie la prestation en réservant (page sécurisée Stripe). Le montant reste bloqué par Cleaneroo et n'est
-- libéré pour le versement au Cleaneur (calendrier du vendredi) qu'après la validation du client, ou la validation automatique
-- 48 h après la fin. Une demande annulée est remboursée. Une demande non payée n'est pas montrée aux Cleaneurs.
--
-- Statuts de paiement (demandes.paiement_statut) :
--   null / EN_ATTENTE : pas encore payé : invisible pour les Cleaneurs, annulée sans frais si elle reste impayée (24 h)
--   PAYE       : débité, bloqué par Cleaneroo
--   A_PRELEVER : passage suivant d'un entretien régulier : carte enregistrée, prélevé automatiquement 3 jours avant le passage
--   ECHEC      : prélèvement automatique refusé : le client paie depuis son suivi, sinon annulation 24 h avant le passage
--   LIBERE     : prestation validée : montant libéré pour le versement au Cleaneur
--   REMBOURSE  : demande annulée après paiement : montant remboursé
--   AUTORISE / ENCAISSE / ANNULE : ancien fonctionnement (empreinte), gardé pour les demandes déjà garanties.
--
-- À appliquer AVANT de mettre en ligne le site et l'appli (ils envoient la colonne groupe_paiement), puis redéployer la
-- fonction « paiement » (supabase/functions/paiement/index.ts).

alter table public.demandes
  add column if not exists paiement_client text,
  add column if not exists paiement_moyen text,
  add column if not exists groupe_paiement uuid,
  add column if not exists paiement_journal jsonb not null default '[]'::jsonb;
create index if not exists demandes_groupe_paiement on public.demandes (groupe_paiement) where groupe_paiement is not null;
create index if not exists demandes_paiement_statut on public.demandes (paiement_statut);

-- Les champs de paiement ne s'écrivent jamais depuis le navigateur ou l'appli : seul le serveur les remplit.
-- La pré-réservation gratuite n'existe qu'avant l'ouverture ; « pilote » (ménages créés par le pilote auto) est réservé au serveur.
create or replace function public.demande_paiement_initial() returns trigger
  language plpgsql set search_path to '' as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;
  new.paiement_statut := null; new.paiement_session := null; new.paiement_intent := null; new.paiement_c := null;
  new.paiement_test := null; new.paiement_client := null; new.paiement_moyen := null; new.paiement_journal := '[]'::jsonb;
  new.prelancement := coalesce(new.prelancement, false) and now() < timestamptz '2026-12-31 00:00 Europe/Paris';
  new.details := coalesce(new.details, '{}'::jsonb) - 'pilote';
  return new;
end $$;
drop trigger if exists demandes_paiement_initial on public.demandes;
create trigger demandes_paiement_initial before insert on public.demandes
  for each row execute function public.demande_paiement_initial();

-- Une demande est « garantie » (montrée aux Cleaneurs) quand elle est payée, ou que la carte est enregistrée pour un passage suivant.
-- Exceptions : demandes sur devis (le paiement vient avec le devis) et ménages du pilote auto (créés par le serveur).
create or replace function public.paiement_garanti(d public.demandes) returns boolean
  language sql stable set search_path to '' as $$
  select coalesce(d.sur_devis, false) or coalesce(d.details->>'pilote', '') = 'true'
      or coalesce(d.paiement_statut, '') in ('PAYE', 'A_PRELEVER', 'LIBERE', 'AUTORISE', 'ENCAISSE');
$$;

-- Missions proposées aux Cleaneurs : seulement les demandes garanties (même règle qu'avant, plus le paiement).
create or replace function public.mission_visible(d demandes)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select public.est_admin() or (public.paiement_garanti(d) and not public.limite_meme_site(d) and (
    (public.favori_exclusif(d) and d.cleaneur_favori = auth.uid())
    or (not public.favori_exclusif(d) and (
      public.formule_effective(auth.uid()) = 'pro'
      or (coalesce(d.espace, 'personnel') = 'personnel'
          and (d.urgence or d.cree_le <= now() - make_interval(mins => 30 - public.avance_niveau(auth.uid()))))
      or (coalesce(d.espace, 'personnel') <> 'personnel' and coalesce((public.niveau_de(auth.uid())->>'niveau')::int, 0) >= 2)
      or exists (select 1 from public.invitations_pro i where i.statut = 'ACTIF' and i.cleaneur_id = auth.uid() and i.pro_id = d.client_id)
      or exists (select 1 from public.favoris f where f.client_id = d.client_id and f.cleaneur_id = auth.uid())))));
$function$;

-- Appel de la fonction serveur « paiement » (rembourser, liberer, synchroniser), protégé par la clé privée des tâches automatiques.
create or replace function public.paiement_appeler(p_action text, p_reference text) returns void
  language plpgsql security definer set search_path to '' as $$
begin
  perform net.http_post(url := 'https://wmxrmnujuqkdgvdtlnai.supabase.co/functions/v1/paiement',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cle-alertes', (select valeur from public.config_privee where cle = 'alertes')),
    body := jsonb_build_object('action', p_action, 'reference', coalesce(p_reference, '')));
end $$;
revoke execute on function public.paiement_appeler(text, text) from public, anon, authenticated;

-- Annulée → remboursement (ou empreinte levée) ; terminée (validée par le client ou automatiquement) → montant libéré,
-- et complément éventuel (supplément accepté, pourboire) prélevé sur la carte enregistrée.
create or replace function public.paiement_selon_statut() returns trigger
  language plpgsql security definer set search_path to '' as $$
begin
  if new.statut is distinct from old.statut then
    if new.statut = 'ANNULEE' and coalesce(new.paiement_statut, '') in ('PAYE', 'AUTORISE', 'A_PRELEVER', 'ECHEC', 'EN_ATTENTE') then
      perform public.paiement_appeler('rembourser', new.reference);
    elsif new.statut = 'TERMINEE' and coalesce(new.paiement_statut, '') in ('PAYE', 'AUTORISE') then
      perform public.paiement_appeler('liberer', new.reference);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists demandes_paiement_statut on public.demandes;
create trigger demandes_paiement_statut after update of statut on public.demandes
  for each row execute function public.paiement_selon_statut();

-- Toutes les 15 minutes : paiements revenus de Stripe, passages suivants à prélever, demandes impayées à annuler.
select cron.unschedule('paiements') where exists (select 1 from cron.job where jobname = 'paiements');
select cron.schedule('paiements', '*/15 * * * *', $$select public.paiement_appeler('synchroniser', '')$$);

-- Suivi du paiement (page de suivi et appli) : statut, montant payé, mode test, et ce qu'il reste à faire.
create or replace function public.paiement_de(p_reference text, p_jeton uuid default null)
 returns json
 language sql
 stable security definer
 set search_path to ''
as $function$
  select json_build_object('statut', d.paiement_statut, 'montant_c', d.paiement_c, 'test', coalesce(d.paiement_test, true),
    'a_payer', not coalesce(d.sur_devis, false) and d.statut not in ('ANNULEE', 'TERMINEE')
               and coalesce(d.paiement_statut, '') in ('', 'EN_ATTENTE', 'ECHEC'),
    'prelancement', coalesce(d.prelancement, false))
  from public.demandes d
  where d.reference = p_reference and (d.jeton = p_jeton or (d.client_id is not null and d.client_id = (select auth.uid())));
$function$;

-- Annulation sans remplaçant : la prestation était payée, le client est remboursé (plus « rien n'est débité »).
create or replace function public.annuler_sans_remplacant(p_reference text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare d public.demandes;
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or d.statut not in ('PUBLIEE', 'CONFIRMEE') then return; end if;
  update public.demandes set statut = 'ANNULEE', cleaneur_id = null,
    notes_admin = trim(coalesce(notes_admin, '') || ' Annulée sans frais : pas de remplaçant.') where id = d.id;
  perform public.notifier(d.client_id, 'client', 'paiement', 'important', 'Prestation annulée sans frais',
    'Nous n''avons pas trouvé de remplaçant à temps : prestation annulée, vous êtes remboursé intégralement. Vous pouvez réserver un autre créneau en deux minutes.', d.reference);
end $function$;
