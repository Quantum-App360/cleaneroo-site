-- Litiges et moins-values dans les versements (22 novembre 2026, décision de l'utilisateur).
-- 1. Le Cleaneur est versé 48 h après la fin de la prestation (délai de réclamation du client), jamais avec un litige ouvert.
-- 2. Litige décidé « Remboursement de X € » : X € remboursés au client sur sa carte ; le versement du Cleaneur baisse au prorata
--    (il perd sa part, Cleaneroo rend sa commission sur ce montant).
-- 3. Cleaneur déjà versé (cas exceptionnel) : sa part est reprise sur son compte Stripe, sinon une moins-value « litige » est créée.
-- 4. Chaque versement retient les moins-values en cours (pénalités, litiges), au plus la moitié du versement.
-- À appliquer après base-pilote-connect.sql, puis redéployer la fonction « paiement ».

alter table public.demandes add column if not exists rembourse_c integer not null default 0;

-- Moins-value née d'un litige (en plus des annulations et absences).
alter table public.penalites_cleaneur drop constraint if exists penalites_cleaneur_raison_check;
alter table public.penalites_cleaneur add constraint penalites_cleaneur_raison_check
  check (raison = any (array['annulation', 'absence', 'litige']));

-- Décision « Remboursement » : la fonction paiement rembourse le client et ajuste le versement du Cleaneur.
create or replace function public.paiement_apres_litige() returns trigger
  language plpgsql security definer set search_path to '' as $$
begin
  if new.statut = 'REMBOURSEMENT' and old.statut is distinct from 'REMBOURSEMENT' and coalesce(new.montant_decide_c, 0) > 0 then
    perform public.paiement_appeler('litige', new.reference);
  end if;
  return new;
end $$;
drop trigger if exists litiges_paiement on public.litiges;
create trigger litiges_paiement after update of statut on public.litiges
  for each row execute function public.paiement_apres_litige();
