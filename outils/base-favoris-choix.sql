-- Choix du Cleaneur, carnet de favoris et alerte de secteur (16 novembre 2026). Appliqué par Claude avec l'accord de l'utilisateur.
-- 1. Trois choix à la réservation : « directe » (Cleaneur attribué automatiquement : le premier qui accepte au prix estimé),
--    « candidatures » (le client valide son Cleaneur), « favori » (proposée d'abord à un Cleaneur du carnet de favoris,
--    seul à la voir pendant 12 h ; sans réponse, elle s'ouvre aux candidatures).
-- 2. Carnet de favoris : mes_favoris(), retirer_favori(cleaneur).
-- 3. Alerte « Agrandissez votre secteur » : alerte_secteur() notifie le Cleaneur au plus une fois par semaine.

alter table public.demandes add column if not exists cleaneur_favori uuid references public.profils(id) on delete set null;
alter table public.demandes drop constraint if exists demandes_choix_cleaneur_check;
alter table public.demandes add constraint demandes_choix_cleaneur_check check (choix_cleaneur = any (array['candidatures', 'directe', 'favori']));

-- Le favori demandé doit être dans le carnet du client ; sinon la demande passe aux candidatures.
create or replace function public.controler_favori_demande() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.choix_cleaneur = 'favori' and (new.cleaneur_favori is null or new.client_id is null
      or not exists (select 1 from public.favoris f where f.client_id = new.client_id and f.cleaneur_id = new.cleaneur_favori)) then
    new.choix_cleaneur := 'candidatures'; new.cleaneur_favori := null;
  end if;
  if new.choix_cleaneur <> 'favori' then new.cleaneur_favori := null; end if;
  return new;
end $$;
drop trigger if exists controler_favori_demande on public.demandes;
create trigger controler_favori_demande before insert or update of choix_cleaneur, cleaneur_favori on public.demandes
  for each row execute function public.controler_favori_demande();

-- Exclusivité du favori : 12 h après la mise en ligne (même valeur que REGLES.FAVORI_EXCLUSIVITE_H).
create or replace function public.favori_exclusif(d public.demandes) returns boolean language sql stable set search_path = '' as $$
  select d.choix_cleaneur = 'favori' and d.cleaneur_favori is not null and d.cree_le > now() - interval '12 hours';
$$;

create or replace function public.mission_visible(d public.demandes) returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
    or (public.favori_exclusif(d) and d.cleaneur_favori = auth.uid())
    or (not public.favori_exclusif(d) and (
      public.formule_effective(auth.uid()) = 'pro'
      or (coalesce(d.espace, 'personnel') = 'personnel'
          and (d.urgence or d.cree_le <= now() - make_interval(mins => 30 - public.avance_niveau(auth.uid()))))
      or (coalesce(d.espace, 'personnel') <> 'personnel' and coalesce((public.niveau_de(auth.uid())->>'niveau')::int, 0) >= 2)
      or exists (select 1 from public.invitations_pro i where i.statut = 'ACTIF' and i.cleaneur_id = auth.uid() and i.pro_id = d.client_id)
      or exists (select 1 from public.favoris f where f.client_id = d.client_id and f.cleaneur_id = auth.uid())));
$$;

-- Choix affiché au Cleaneur : le favori pendant son exclusivité prend la mission directement ; ensuite, candidatures.
create or replace function public.missions_disponibles()
 returns table(reference text, rubrique_id text, creneau timestamp with time zone, flexible boolean, duree_min integer, nombre_cleaneurs smallint, estimation_c integer, sur_devis boolean, code_postal text, ville text, cree_le timestamp with time zone, urgence boolean, prime_urgence_c integer, choix_cleaneur text)
 language sql stable security definer set search_path = '' as $$
  select d.reference, d.rubrique_id, d.creneau, d.flexible, d.duree_min, d.nombre_cleaneurs, d.estimation_c, d.sur_devis, d.code_postal, d.ville, d.cree_le,
         d.urgence, d.prime_urgence_c,
         case when d.urgence then 'directe' when public.favori_exclusif(d) then 'directe' when d.choix_cleaneur = 'favori' then 'candidatures' else coalesce(d.choix_cleaneur, 'candidatures') end
  from public.demandes d
  where public.cleaneur_actif() and d.statut = 'PUBLIEE' and d.cleaneur_id is null
    and (public.est_admin() or d.rubrique_id = any (coalesce((select p.prestations from public.profils p where p.id = auth.uid()), '{}')))
    and public.mission_visible(d) and public.qualifie(d) and not public.periode_fermee(d) and public.rc_pro_couvre(d)
  order by public.favori_exclusif(d) desc, d.urgence desc, d.creneau nulls last, d.cree_le
  limit 100;
$$;

create or replace function public.prendre_mission(p_reference text) returns text language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null then return 'connexion'; end if;
  if not public.cleaneur_actif() then return 'dossier'; end if;
  if now() < timestamptz '2027-01-01 00:00 Europe/Paris' and not public.est_admin() then return 'ouverture'; end if;
  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.mission_visible(d)) then return 'formule'; end if;
  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.qualifie(d)) then return 'qualification'; end if;
  if exists (select 1 from public.demandes d where d.reference = p_reference and public.periode_fermee(d)) then return 'fermee'; end if;
  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.rc_pro_couvre(d)) then return 'assurance'; end if;
  if exists (select 1 from public.demandes d where d.reference = p_reference and not d.urgence
      and not (public.favori_exclusif(d) and d.cleaneur_favori = auth.uid())
      and (coalesce(d.choix_cleaneur, 'candidatures') = 'candidatures' or d.choix_cleaneur = 'favori')) then return 'candidature'; end if;
  update public.demandes set cleaneur_id = auth.uid(), statut = 'CONFIRMEE'
   where reference = p_reference and statut = 'PUBLIEE' and cleaneur_id is null;
  get diagnostics n = row_count;
  if n = 1 then
    update public.profils p set pro_offert_jusqu = now() + interval '3 months'
     where p.id = auth.uid() and p.pro_offert_jusqu is null and public.offre_lancement(p);
  end if;
  return case when n = 1 then 'ok' else 'deja_prise' end;
end $$;

-- Mise en ligne : le favori choisi est prévenu seul (« vous êtes demandé ») ; sinon tous les favoris du client, comme avant.
create or replace function public.prevenir_favoris() returns trigger language plpgsql security definer set search_path = '' as $$
declare f record;
begin
  if new.statut = 'PUBLIEE' and old.statut is distinct from 'PUBLIEE' and new.cleaneur_id is null then
    if new.choix_cleaneur = 'favori' and new.cleaneur_favori is not null then
      perform public.notifier(new.cleaneur_favori, 'cleaneur', 'mission', 'important', 'Un client vous demande personnellement',
        new.ville || ' · réservée pour vous pendant 12 h, acceptez-la directement', new.reference);
    else
      for f in select cleaneur_id from public.favoris where client_id = new.client_id loop
        perform public.notifier(f.cleaneur_id, 'cleaneur', 'mission', 'important', 'Un client qui vous a mis en favori a une nouvelle demande', new.ville, new.reference);
      end loop;
    end if;
  end if;
  return new;
end $$;

-- Carnet de favoris du client : prénom et initiale, niveau, note moyenne, prestations faites ensemble, dernière date.
create or replace function public.mes_favoris()
 returns table(cleaneur_id uuid, prenom text, initiale text, note numeric, nb_avis integer, ensemble integer, derniere timestamptz, prestations text[])
 language sql stable security definer set search_path = '' as $$
  select f.cleaneur_id, p.prenom, left(coalesce(p.nom, ''), 1),
         (select round(avg(a.note)::numeric, 1) from public.avis a where a.cleaneur_id = f.cleaneur_id),
         (select count(*)::int from public.avis a where a.cleaneur_id = f.cleaneur_id),
         (select count(*)::int from public.demandes d where d.client_id = auth.uid() and d.cleaneur_id = f.cleaneur_id and d.statut = 'TERMINEE'),
         (select max(d.creneau) from public.demandes d where d.client_id = auth.uid() and d.cleaneur_id = f.cleaneur_id and d.statut = 'TERMINEE'),
         coalesce(p.prestations, '{}')
  from public.favoris f join public.profils p on p.id = f.cleaneur_id
  where f.client_id = auth.uid()
  order by f.cree_le desc;
$$;

create or replace function public.retirer_favori(p_cleaneur uuid) returns boolean language sql security definer set search_path = '' as $$
  with x as (delete from public.favoris where client_id = auth.uid() and cleaneur_id = p_cleaneur returning 1) select exists (select 1 from x);
$$;

-- Alerte de secteur : notification « Agrandissez votre secteur » au plus une fois tous les 7 jours.
create or replace function public.alerte_secteur(p_dans_zone integer, p_zone_km integer, p_conseil_km integer, p_en_plus integer) returns boolean
 language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.profils p where p.id = auth.uid() and 'cleaneur' = any (p.statuts)) then return false; end if;
  if exists (select 1 from public.notifications n where n.destinataire = auth.uid() and n.titre = 'Peu de missions dans votre secteur' and n.cree_le > now() - interval '7 days') then return false; end if;
  perform public.notifier(auth.uid(), 'cleaneur', 'info', 'important', 'Peu de missions dans votre secteur',
    format('%s mission(s) à moins de %s km. En passant à %s km, vous en verriez %s de plus : modifiez votre périmètre dans votre profil.',
      greatest(p_dans_zone, 0), p_zone_km, p_conseil_km, greatest(p_en_plus, 0)), null);
  return true;
end $$;

revoke execute on function public.mes_favoris() from anon, public;
revoke execute on function public.retirer_favori(uuid) from anon, public;
revoke execute on function public.alerte_secteur(integer, integer, integer, integer) from anon, public;
grant execute on function public.mes_favoris() to authenticated;
grant execute on function public.retirer_favori(uuid) to authenticated;
grant execute on function public.alerte_secteur(integer, integer, integer, integer) to authenticated;
