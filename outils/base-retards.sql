-- Retards déclarés par le Cleaneur (12 novembre 2026, repris de l'appli iPhone de Vincent).
-- Le Cleaneur annonce son retard (minutes + motif) avant d'arriver ; le client le voit tout de suite sur son suivi.
-- Tolérance : 30 min (REGLES.RETARD_TOLERE_MIN). Seul retard justifié : ≤ 30 min à cause d'une intervention Cleaneroo
-- précédente du même jour. Au-delà de 30 min, le client peut annuler sans frais (avertissement pour le Cleaneur).

create or replace function public.declarer_retard(p_reference text, p_minutes integer, p_motif text) returns text
language plpgsql security definer set search_path to '' as $$
declare d public.demandes; justifie boolean;
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null then return 'introuvable'; end if;
  if d.cleaneur_id is distinct from auth.uid() then return 'interdit'; end if;
  if d.statut not in ('CONFIRMEE', 'EN_ROUTE') or d.creneau is null then return 'etape'; end if;
  if p_minutes is null or p_minutes not between 5 and 180 then return 'minutes'; end if;
  if p_motif not in ('MISSION_PRECEDENTE', 'CIRCULATION', 'AUTRE') then return 'motif'; end if;
  -- Justifié seulement si une autre intervention Cleaneroo du même Cleaneur a lieu le même jour, juste avant.
  justifie := p_motif = 'MISSION_PRECEDENTE' and p_minutes <= 30 and exists (
    select 1 from public.demandes x where x.cleaneur_id = auth.uid() and x.reference <> p_reference
      and x.creneau::date = d.creneau::date and x.creneau < d.creneau and x.statut in ('EN_COURS', 'A_VALIDER', 'TERMINEE', 'SUR_PLACE'));
  update public.demandes set etapes = etapes || jsonb_build_object('retard', jsonb_build_object('minutes', p_minutes, 'motif', p_motif,
      'le', now(), 'arrivee', greatest(d.creneau, now()) + make_interval(mins => p_minutes), 'justifie', justifie))
   where id = d.id;
  return 'ok';
end $$;

-- Retard annoncé d'une demande (client : lien de suivi ou connecté).
create or replace function public.retard_annonce(p_reference text, p_jeton uuid default null) returns jsonb
language sql stable security definer set search_path to '' as $$
  select d.etapes->'retard' from public.demandes d where d.reference = p_reference and d.statut in ('CONFIRMEE', 'EN_ROUTE')
    and ((p_jeton is not null and d.jeton = p_jeton) or (auth.uid() is not null and d.client_id = auth.uid()));
$$;

-- Retard de plus de 30 min : le client peut annuler sans frais ; avertissement pour le Cleaneur.
create or replace function public.annuler_pour_retard(p_reference text, p_jeton uuid default null) returns text
language plpgsql security definer set search_path to '' as $$
declare d public.demandes;
begin
  select * into d from public.demandes where reference = p_reference
    and ((p_jeton is not null and jeton = p_jeton) or (auth.uid() is not null and client_id = auth.uid()));
  if d.id is null then return 'introuvable'; end if;
  if d.statut not in ('CONFIRMEE', 'EN_ROUTE') then return 'etape'; end if;
  if coalesce((d.etapes->'retard'->>'minutes')::int, 0) <= 30
     and not (d.creneau is not null and now() > d.creneau + interval '30 minutes') then return 'tolere'; end if;
  update public.demandes set statut = 'ANNULEE', etapes = etapes || jsonb_build_object('annule_retard', now()),
    notes_admin = trim(coalesce(notes_admin, '') || ' Annulée sans frais par le client : retard de plus de 30 min.') where id = d.id;
  if d.cleaneur_id is not null then
    insert into public.avertissements_cleaneur (cleaneur_id, motif, reference) values (d.cleaneur_id, 'Retard de plus de 30 min : annulation par le client', d.reference);
  end if;
  return 'ok';
end $$;

revoke execute on function public.declarer_retard(text, integer, text) from anon, public;
grant execute on function public.declarer_retard(text, integer, text) to authenticated;
grant execute on function public.retard_annonce(text, uuid) to anon, authenticated;
grant execute on function public.annuler_pour_retard(text, uuid) to anon, authenticated;
