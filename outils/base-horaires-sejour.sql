-- Horaires par séjour (24 novembre 2026, repris de l'appli iPhone) : départ tardif (6 à 14 h) et arrivée anticipée (12 à 22 h)
-- Appliqué dans Supabase le 24/11/2026 (migration horaires_sejour_decaler_menage_2411), testé : décalage à 12 h Paris, départ à 15 h refusé.
-- réglés séjour par séjour par la conciergerie. Le ménage déjà programmé ce jour-là est décalé à la nouvelle heure de départ,
-- le Cleaneur (et ses équipiers) prévenus ; l'heure d'arrivée suivante est gardée avec le ménage (à terminer avant).
-- Le prix ne change pas (déjà payé) ; le jour ne change pas ; mission non commencée seulement.
create or replace function public.decaler_menage(p_reference text, p_depart_h integer, p_arrivee_h integer default null)
 returns text language plpgsql security definer set search_path = '' as $$
declare d public.demandes; jour date; nouveau timestamptz; x uuid; texte text;
begin
  select * into d from public.demandes where reference = p_reference and client_id = auth.uid() for update;
  if not found then return 'introuvable'; end if;
  if d.statut not in ('VERIFICATION', 'PUBLIEE', 'CONFIRMEE') or d.creneau is null then return 'statut'; end if;
  if p_depart_h is null or p_depart_h < 6 or p_depart_h > 14 then return 'depart'; end if;
  if p_arrivee_h is not null and (p_arrivee_h < 12 or p_arrivee_h > 22 or p_arrivee_h <= p_depart_h) then return 'arrivee'; end if;
  jour := (d.creneau at time zone 'Europe/Paris')::date;
  nouveau := (jour + make_time(p_depart_h, 0, 0)) at time zone 'Europe/Paris';
  if nouveau <> d.creneau and nouveau < now() + interval '2 hours' then return 'creneau'; end if;
  update public.demandes set creneau = nouveau,
    details = coalesce(d.details, '{}'::jsonb) || jsonb_build_object('departVoyageursH', p_depart_h)
      || case when p_arrivee_h is null then '{}'::jsonb else jsonb_build_object('arriveeSuivanteH', p_arrivee_h) end
  where id = d.id;
  texte := 'Départ des voyageurs à ' || p_depart_h || ' h le ' || to_char(jour, 'DD/MM') || ' : le ménage commence à ' || p_depart_h || ' h'
    || case when p_arrivee_h is null then '' else ', à terminer avant l''arrivée suivante à ' || p_arrivee_h || ' h' end || '.';
  for x in select distinct y from unnest(array_remove(coalesce(d.equipiers, '{}') || array[d.cleaneur_id, d.societe_id], null)) y loop
    perform public.notifier(x, 'cleaneur', 'info', 'important', 'Horaire du ménage modifié', texte, d.reference);
  end loop;
  for x in select distinct cleaneur_id from public.propositions where reference = d.reference and statut = 'EN_ATTENTE' loop
    perform public.notifier(x, 'cleaneur', 'info', 'standard', 'Horaire du ménage modifié', texte, d.reference);
  end loop;
  return 'ok';
end $$;
revoke all on function public.decaler_menage(text, integer, integer) from public, anon;
grant execute on function public.decaler_menage(text, integer, integer) to authenticated;
