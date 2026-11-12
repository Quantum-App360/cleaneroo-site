-- Règle d'ouverture par déclencheur (12 novembre 2026) — appliqué (migration « ouverture_par_declencheur »).
-- Remplace la contrainte demandes_ouverture_check de base-comptes.sql, qui bloquait toute modification (même l'annulation)
-- d'une ancienne demande d'essai datée avant l'ouverture.
-- - Créneau avant le 1er janvier 2027 0 h (Paris) refusé à la création et à chaque changement de date (erreur « ouverture »).
-- - Mise en ligne (PUBLIEE) refusée si la date est déjà passée (erreur « creneau_passe »).
-- - Les autres changements (notes, annulation) restent possibles. La gestion traduit ces erreurs en français simple.
alter table public.demandes drop constraint if exists demandes_ouverture_check;
create or replace function public.verifier_ouverture() returns trigger language plpgsql set search_path to '' as $$
begin
  if new.creneau is not null and new.creneau < timestamptz '2026-12-31 23:00:00+00'
     and (tg_op = 'INSERT' or new.creneau is distinct from old.creneau) then
    raise exception 'ouverture' using hint = 'Aucune intervention avant l''ouverture du 1er janvier 2027.';
  end if;
  if tg_op = 'UPDATE' and new.statut = 'PUBLIEE' and old.statut is distinct from 'PUBLIEE'
     and new.creneau is not null and new.creneau < now() then
    raise exception 'creneau_passe' using hint = 'La date de cette demande est déjà passée.';
  end if;
  return new;
end $$;
drop trigger if exists demandes_ouverture on public.demandes;
create trigger demandes_ouverture before insert or update on public.demandes for each row execute function public.verifier_ouverture();
