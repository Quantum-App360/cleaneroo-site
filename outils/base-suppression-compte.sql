-- Suppression du compte par la personne elle-même (12 novembre 2026, reprise de l'appli iPhone de Vincent ;
-- obligatoire pour le Play Store). Confirmation en tapant « SUPPRIMER ».
-- Réservations à venir annulées ; missions acceptées par un Cleaneur remises en ligne ; compte effacé tout de suite
-- (profil, logements, documents, selfies, positions… par effacement en cascade). Conservés comme la loi l'exige :
-- factures (10 ans, sans lien avec le compte) et demandes passées, détachées du compte.

create or replace function public.supprimer_mon_compte(p_confirmation text) returns text
language plpgsql security definer set search_path to '' as $$
declare u uuid := auth.uid();
begin
  if u is null then return 'connexion'; end if;
  if p_confirmation is distinct from 'SUPPRIMER' then return 'confirmation'; end if;
  if public.est_admin() then return 'admin'; end if;   -- un compte d'administration se retire à la main
  -- Client : réservations pas encore réalisées annulées.
  update public.demandes set statut = 'ANNULEE', notes_admin = trim(coalesce(notes_admin, '') || ' Annulée : compte supprimé par le client.')
   where client_id = u and statut in ('VERIFICATION', 'PUBLIEE', 'CONFIRMEE');
  -- Cleaneur : missions acceptées et pas commencées remises en ligne pour un autre Cleaneur.
  update public.demandes set cleaneur_id = null, statut = 'PUBLIEE'
   where cleaneur_id = u and statut = 'CONFIRMEE';
  delete from auth.users where id = u;
  return 'ok';
end $$;

revoke execute on function public.supprimer_mon_compte(text) from anon, public;
grant execute on function public.supprimer_mon_compte(text) to authenticated;
