-- Anti-spam des pré-inscriptions et des demandes de rappel (13 novembre 2026).
-- Un robot peut écrire directement dans la table inscriptions (la clé publique du site est visible) : les contrôles de la page
-- (champ piège, délai, liens refusés) sont donc refaits ici, avant chaque enregistrement.
--  • aucun lien dans le message, le prénom ou le nom ;
--  • téléphone français valable s'il est donné, code postal à 5 chiffres s'il est donné, message de 1 000 caractères au plus ;
--  • au plus 3 inscriptions par jour pour un même e-mail ou un même téléphone.
-- L'administration peut supprimer une inscription (spam) depuis le back-office.

create or replace function public.inscription_anti_spam() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  lien constant text := '(https?://|www\.|[a-z0-9-]+\.(online|xyz|top|site|click|link|ru|id|info|biz|shop|store|live|icu|cfd|sbs|win|bond|vip)([^a-z0-9]|$))';
  tel text := regexp_replace(coalesce(new.telephone, ''), '[\s.-]', '', 'g');
begin
  if concat_ws(' ', new.message, new.prenom, new.nom) ~* lien then raise exception 'spam_lien' using errcode = 'P0001'; end if;
  if tel <> '' and tel !~ '^(\+33|0)[1-9][0-9]{8}$' then raise exception 'spam_telephone' using errcode = 'P0001'; end if;
  if coalesce(new.code_postal, '') <> '' and new.code_postal !~ '^[0-9]{5}$' then raise exception 'spam_code_postal' using errcode = 'P0001'; end if;
  if length(coalesce(new.message, '')) > 1000 then raise exception 'spam_message' using errcode = 'P0001'; end if;
  if (select count(*) from public.inscriptions i where i.cree_le > now() - interval '1 day'
      and ((coalesce(new.email, '') <> '' and lower(i.email) = lower(new.email)) or (tel <> '' and regexp_replace(coalesce(i.telephone, ''), '[\s.-]', '', 'g') = tel))) >= 3
  then raise exception 'spam_repetition' using errcode = 'P0001'; end if;
  return new;
end $$;

drop trigger if exists inscriptions_anti_spam on public.inscriptions;
create trigger inscriptions_anti_spam before insert on public.inscriptions for each row execute function public.inscription_anti_spam();

drop policy if exists "Administration : suppression des inscriptions" on public.inscriptions;
create policy "Administration : suppression des inscriptions" on public.inscriptions for delete to authenticated using (public.est_admin());
