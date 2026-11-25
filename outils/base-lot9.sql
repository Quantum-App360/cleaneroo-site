-- Lot 9 du prompt 4 (audit), partie base de données. 25/11/2026. À appliquer seulement avec l'accord de Michael.
-- Même logique à reporter dans les applis si elles notifient elles-mêmes (Vincent).
--
-- Problème trouvé : une demande « Cleaneur demandé » (favori) n'était annoncée à personne d'autre quand l'exclusivité se terminait
-- (fin du délai de 2 h / 6 h / 12 h, ou « Je ne suis pas disponible », ou « Proposer à tous maintenant ») : les alertes ciblées
-- ne partent qu'au passage en ligne. La demande pouvait rester sans Cleaneur sans que personne ne soit prévenu.
-- Correction : le ciblage devient une fonction (cibler_cleaneurs), appelée à la mise en ligne comme avant, aussitôt que le favori
-- est libéré, et toutes les 5 minutes pour les exclusivités arrivées à leur fin. Un Cleaneur n'est jamais prévenu deux fois.
-- Au passage : heure écrite « 9 h 30 » au lieu de « 09h30 » dans l'alerte.

create or replace function public.cibler_cleaneurs(d public.demandes) returns integer
 language plpgsql security definer set search_path = '' as $$
declare c record; j text; h integer; n integer := 0;
begin
  if d.statut <> 'PUBLIEE' or d.cleaneur_id is not null or d.lat is null or d.lon is null or coalesce(d.prelancement, false) then return 0; end if;
  if d.creneau is not null then
    j := extract(isodow from d.creneau at time zone 'Europe/Paris')::int::text;
    h := extract(hour from d.creneau at time zone 'Europe/Paris')::int;
  end if;
  for c in
    select p.id from public.profils p
    where p.dossier = 'VALIDE' and p.banni_le is null and p.employeur_id is null and (p.role = 'cleaneur' or 'cleaneur' = any (p.statuts))
      and d.rubrique_id = any (coalesce(p.prestations, '{}'))
      and p.zone_lat is not null and p.zone_lon is not null
      and public.km_entre(p.zone_lat, p.zone_lon, d.lat, d.lon) <= least(coalesce(p.zone_km, 20), 50)
      and (d.creneau is null or jsonb_typeof(p.disponibilites) is distinct from 'object' or p.disponibilites = '{}'::jsonb
           or coalesce(p.disponibilites -> j, '[]'::jsonb) @> to_jsonb(h))
      and not exists (select 1 from public.periodes_fermees f where f.cleaneur_id = p.id and d.creneau is not null and d.creneau >= f.debut and d.creneau < f.fin)
      and not exists (select 1 from public.demandes x where x.cleaneur_id = p.id and x.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS')
           and d.creneau is not null and x.creneau is not null
           and x.creneau < d.creneau + make_interval(mins => coalesce(d.duree_min, 60))
           and d.creneau < x.creneau + make_interval(mins => coalesce(x.duree_min, 60)))
      and not exists (select 1 from public.favoris fv where fv.client_id = d.client_id and fv.cleaneur_id = p.id)   -- déjà prévenus (prevenir_favoris)
      and p.id is distinct from d.cleaneur_favori                                                                   -- le Cleaneur demandé l'a déjà vue
      and not exists (select 1 from public.notifications n where n.destinataire = p.id and n.reference = d.reference
           and n.titre in ('Nouvelle mission pour vous', 'Un client vous demande personnellement', 'Un client qui vous a mis en favori a une nouvelle demande'))
    order by public.km_entre(p.zone_lat, p.zone_lon, d.lat, d.lon)
    limit 40
  loop
    perform public.notifier(c.id, 'cleaneur', 'mission', 'important', 'Nouvelle mission pour vous',
      coalesce(d.ville, '') || case when d.creneau is not null then ' · ' || to_char(d.creneau at time zone 'Europe/Paris', 'DD/MM à FMHH24" h "MI') else ' · date flexible' end
      || ' · dans vos créneaux et votre secteur', d.reference);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Mise en ligne : comme avant (le Cleaneur demandé garde son exclusivité, les autres attendent sa fin).
create or replace function public.alerter_cleaneurs_cibles() returns trigger
 language plpgsql security definer set search_path = '' as $$
begin
  if not (new.statut = 'PUBLIEE' and old.statut is distinct from 'PUBLIEE' and new.cleaneur_id is null) then return new; end if;
  if new.choix_cleaneur = 'favori' and new.cleaneur_favori is not null and public.favori_exclusif(new) then return new; end if;
  perform public.cibler_cleaneurs(new);
  return new;
end $$;

-- Fin d'exclusivité anticipée (« Je ne suis pas disponible », « Proposer à tous maintenant ») : alertes aussitôt.
create or replace function public.ouvrir_apres_favori() returns trigger
 language plpgsql security definer set search_path = '' as $$
begin
  if new.statut = 'PUBLIEE' and new.cleaneur_id is null and new.choix_cleaneur = 'favori'
     and new.favori_jusqu is distinct from old.favori_jusqu and new.favori_jusqu <= now() then
    perform public.cibler_cleaneurs(new);
  end if;
  return new;
end $$;
drop trigger if exists ouvrir_apres_favori on public.demandes;
create trigger ouvrir_apres_favori after update of favori_jusqu on public.demandes for each row execute function public.ouvrir_apres_favori();

-- Fin d'exclusivité à l'échéance : toutes les 5 minutes.
create or replace function public.ouvrir_favoris_expires() returns integer
 language plpgsql security definer set search_path = '' as $$
declare d public.demandes; n integer := 0;
begin
  for d in select x.* from public.demandes x
     where x.statut = 'PUBLIEE' and x.cleaneur_id is null and x.choix_cleaneur = 'favori'
       and not public.favori_exclusif(x)
       and coalesce(x.favori_jusqu, x.cree_le + public.delai_favori(x.creneau, x.cree_le)) > now() - interval '2 days' loop
    n := n + public.cibler_cleaneurs(d);
  end loop;
  return n;
end $$;
select cron.unschedule('ouvrir-favoris') where exists (select 1 from cron.job where jobname = 'ouvrir-favoris');
select cron.schedule('ouvrir-favoris', '*/5 * * * *', 'select public.ouvrir_favoris_expires()');

revoke all on function public.cibler_cleaneurs(public.demandes) from public, anon, authenticated;
revoke all on function public.ouvrir_favoris_expires() from public, anon, authenticated;
revoke all on function public.ouvrir_apres_favori() from public, anon, authenticated;
revoke all on function public.alerter_cleaneurs_cibles() from public, anon, authenticated;
