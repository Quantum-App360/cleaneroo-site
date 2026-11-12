-- Centre de notifications (12 novembre 2026, repris de l'appli iPhone de Vincent) : une liste par espace (client, Cleaneur),
-- non lues, « Tout marquer comme lu », toucher = ouvrir la prestation. Niveaux : standard, important, urgent
-- (son et vibration différents dans l'appli). Remplie automatiquement par la base à chaque étape d'une prestation.
-- Les textes sont en français ; l'écran les traduit (tableau des textes : langue.js et Traductions*.kt).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  destinataire uuid not null references auth.users(id) on delete cascade,
  espace text not null check (espace in ('client', 'cleaneur')),
  type text not null check (type in ('mission', 'confirmee', 'progression', 'compte_rendu', 'paiement', 'alerte', 'info', 'avis')),
  niveau text not null default 'standard' check (niveau in ('standard', 'important', 'urgent')),
  titre text not null check (char_length(titre) <= 160),
  texte text not null default '' check (char_length(texte) <= 400),
  reference text,
  lu boolean not null default false,
  cree_le timestamptz not null default now());
alter table public.notifications enable row level security;
create index if not exists notifications_idx on public.notifications (destinataire, espace, cree_le desc);
drop policy if exists "notification : lire les siennes" on public.notifications;
create policy "notification : lire les siennes" on public.notifications for select to authenticated using (destinataire = (select auth.uid()));
drop policy if exists "notification : marquer les siennes" on public.notifications;
create policy "notification : marquer les siennes" on public.notifications for update to authenticated
  using (destinataire = (select auth.uid())) with check (destinataire = (select auth.uid()));
revoke all on public.notifications from anon;
grant select on public.notifications to authenticated;
grant update (lu) on public.notifications to authenticated;

create or replace function public.notifier(p_dest uuid, p_espace text, p_type text, p_niveau text, p_titre text, p_texte text, p_reference text)
returns void language sql security definer set search_path to '' as $$
  insert into public.notifications (destinataire, espace, type, niveau, titre, texte, reference)
  select p_dest, p_espace, p_type, p_niveau, left(p_titre, 160), left(coalesce(p_texte, ''), 400), p_reference where p_dest is not null;
$$;
revoke execute on function public.notifier(uuid, text, text, text, text, text, text) from anon, public, authenticated;

-- Étapes d'une prestation → notifications du client et du Cleaneur.
create or replace function public.notifier_etape() returns trigger language plpgsql security definer set search_path to '' as $$
declare prenom text := coalesce((select p.prenom from public.profils p where p.id = new.cleaneur_id), 'Votre Cleaneur');
begin
  if new.statut is distinct from old.statut then
    case new.statut
      when 'PUBLIEE' then perform public.notifier(new.client_id, 'client', 'info', 'standard', 'Votre annonce est en ligne', 'Les Cleaneurs de votre secteur peuvent la prendre.', new.reference);
      when 'CONFIRMEE' then
        perform public.notifier(new.client_id, 'client', 'confirmee', 'important', 'Prestation confirmée', prenom || ' interviendra chez vous.', new.reference);
        perform public.notifier(new.cleaneur_id, 'cleaneur', 'confirmee', 'important', 'Mission confirmée', 'Elle est dans votre agenda.', new.reference);
      when 'EN_ROUTE' then perform public.notifier(new.client_id, 'client', 'progression', 'important', prenom || ' est en route', 'Suivez son arrivée en direct.', new.reference);
      when 'SUR_PLACE' then perform public.notifier(new.client_id, 'client', 'progression', 'important', prenom || ' est arrivé(e) sur place', '', new.reference);
      when 'EN_COURS' then perform public.notifier(new.client_id, 'client', 'progression', 'standard', 'Intervention commencée', '', new.reference);
      when 'A_VALIDER' then perform public.notifier(new.client_id, 'client', 'compte_rendu', 'important', 'Prestation terminée : à valider', 'Sans réponse, elle est validée automatiquement après 48 h.', new.reference);
      when 'TERMINEE' then
        perform public.notifier(new.client_id, 'client', 'paiement', 'standard', 'Merci de votre confiance !', 'Votre facture est disponible.', new.reference);
        perform public.notifier(new.cleaneur_id, 'cleaneur', 'paiement', 'standard', 'Prestation validée', 'Le versement suit le calendrier du vendredi.', new.reference);
      when 'ANNULEE' then
        perform public.notifier(new.client_id, 'client', 'alerte', 'important', 'Prestation annulée', '', new.reference);
        perform public.notifier(coalesce(new.cleaneur_id, old.cleaneur_id), 'cleaneur', 'alerte', 'important', 'Mission annulée', '', new.reference);
      else null;
    end case;
    -- Mission remise en ligne alors qu'un Cleaneur l'avait (annulation par le Cleaneur, absence) : le client est prévenu.
    if new.statut = 'PUBLIEE' and old.cleaneur_id is not null and new.cleaneur_id is null then
      perform public.notifier(new.client_id, 'client', 'alerte', 'urgent', 'Nous cherchons un autre Cleaneur', 'Votre Cleaneur ne peut plus venir : la mission est remise en ligne en priorité.', new.reference);
    end if;
  end if;
  if (new.etapes ? 'retard') and (new.etapes->'retard' is distinct from old.etapes->'retard') then
    perform public.notifier(new.client_id, 'client', 'alerte', 'important', prenom || ' a annoncé un retard', (new.etapes->'retard'->>'minutes') || ' min', new.reference);
  end if;
  if (new.etapes ? 'presence_demandee') and not (old.etapes ? 'presence_demandee') then
    perform public.notifier(new.client_id, 'client', 'alerte', 'urgent', prenom || ' est-il arrivé ?', 'Confirmez sa présence depuis votre suivi.', new.reference);
  end if;
  return new;
end $$;
drop trigger if exists notifier_etape on public.demandes;
create trigger notifier_etape after update on public.demandes for each row execute function public.notifier_etape();

-- Avis et pourboire → notification du Cleaneur (avis en double aveugle : le contenu reste caché).
create or replace function public.notifier_avis() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.note is not null and (tg_op = 'INSERT' or old.note is null) then
    perform public.notifier(new.cleaneur_id, 'cleaneur', 'avis', 'standard', 'Le client a laissé son avis', 'Il sera visible dès que vous aurez noté le client, ou sous 14 jours.', new.reference);
  end if;
  if coalesce(new.pourboire_c, 0) > coalesce(case when tg_op = 'UPDATE' then old.pourboire_c end, 0) then
    perform public.notifier(new.cleaneur_id, 'cleaneur', 'paiement', 'standard', 'Pourboire reçu', to_char(new.pourboire_c / 100.0, 'FM999990D00') || ' €', new.reference);
  end if;
  return new;
end $$;
drop trigger if exists notifier_avis on public.avis;
create trigger notifier_avis after insert or update on public.avis for each row execute function public.notifier_avis();

-- Liste (120 dernières) et « Tout marquer comme lu ».
create or replace function public.mes_notifications(p_espace text) returns setof public.notifications
language sql stable security definer set search_path to '' as $$
  select * from public.notifications where destinataire = auth.uid() and espace = p_espace order by cree_le desc limit 120;
$$;
create or replace function public.notifications_non_lues() returns json language sql stable security definer set search_path to '' as $$
  select json_build_object('client', count(*) filter (where espace = 'client'), 'cleaneur', count(*) filter (where espace = 'cleaneur'))
  from public.notifications where destinataire = auth.uid() and not lu;
$$;
create or replace function public.tout_marquer_lu(p_espace text) returns void language sql security definer set search_path to '' as $$
  update public.notifications set lu = true where destinataire = auth.uid() and espace = p_espace and not lu;
$$;
revoke execute on function public.mes_notifications(text) from anon, public;
revoke execute on function public.notifications_non_lues() from anon, public;
revoke execute on function public.tout_marquer_lu(text) from anon, public;
grant execute on function public.mes_notifications(text) to authenticated;
grant execute on function public.notifications_non_lues() to authenticated;
grant execute on function public.tout_marquer_lu(text) to authenticated;
