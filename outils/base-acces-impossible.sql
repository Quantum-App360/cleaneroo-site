-- Accès impossible / client absent (11 novembre 2026, repris de l'appli iPhone de Vincent).
-- Sur place depuis au moins 15 min et après avoir tenté de joindre le client, le Cleaneur déclare l'accès impossible
-- (client absent, clé ou code introuvable, accès refusé, logement inaccessible ou dangereux). La mission est annulée ;
-- le client doit une indemnité de 30 % du prix, entre 20 € et 60 € (prélevée avec les vrais paiements), contestable 48 h
-- avec « Un problème avec ce ménage ? ». Mêmes valeurs dans regles.js et Regles.kt (INDEMNITE_*, ATTENTE_ACCES_MIN).

create or replace function public.indemnite_acces_c(p_prix_c int) returns int language sql immutable set search_path to '' as $$
  select least(greatest(round(coalesce(p_prix_c, 0) * 0.30)::int, 2000), 6000);
$$;

-- Renvoie "ok", "attente:<minutes restantes>", "etape", "motif", "interdit" ou "introuvable".
create or replace function public.acces_impossible(p_reference text, p_motif text, p_note text default '')
returns text language plpgsql security definer set search_path to '' as $$
declare d public.demandes; v_arrivee timestamptz; v_reste int;
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null then return 'introuvable'; end if;
  if d.cleaneur_id is distinct from auth.uid() then return 'interdit'; end if;
  if d.statut <> 'SUR_PLACE' then return 'etape'; end if;
  if p_motif not in ('ABSENT', 'CLE_INTROUVABLE', 'ACCES_REFUSE', 'DANGEREUX') then return 'motif'; end if;
  v_arrivee := coalesce((d.etapes->>'sur_place')::timestamptz, d.maj_le);
  v_reste := ceil(extract(epoch from (v_arrivee + interval '15 minutes' - now())) / 60);
  if v_reste > 0 and p_motif <> 'DANGEREUX' then return 'attente:' || v_reste; end if;
  update public.demandes set statut = 'ANNULEE',
    etapes = etapes || jsonb_build_object('acces_impossible', jsonb_build_object('le', now(), 'motif', p_motif,
      'note', left(coalesce(trim(p_note), ''), 500), 'indemnite_c', public.indemnite_acces_c(d.estimation_c)))
   where id = d.id;
  return 'ok';
end $$;
grant execute on function public.acces_impossible(text, text, text) to authenticated;

-- Le client peut contester un accès impossible avec « Un problème avec ce ménage ? » (48 h).
create or replace function public.ouvrir_litige(p_reference text, p_jeton uuid, p_genre text, p_motif text, p_description text,
  p_montant_c int default null, p_photos text[] default '{}')
returns text language plpgsql security definer set search_path to '' as $$
declare d public.demandes; v_fin timestamptz;
begin
  select * into d from public.demandes where reference = p_reference and jeton = p_jeton;
  if d.id is null then return 'introuvable'; end if;
  if d.statut not in ('A_VALIDER', 'TERMINEE') and not (d.statut = 'ANNULEE' and d.etapes ? 'acces_impossible') then return 'etape'; end if;
  v_fin := coalesce((d.etapes->'acces_impossible'->>'le')::timestamptz, (d.etapes->>'fin')::timestamptz, d.maj_le);
  if v_fin < now() - interval '48 hours' then return 'delai'; end if;
  if exists (select 1 from public.litiges l where l.demande_id = d.id and l.statut = 'OUVERT') then return 'deja'; end if;
  if char_length(coalesce(trim(p_description), '')) < 20 then return 'description'; end if;
  if p_genre = 'DOMMAGE' and (p_montant_c is null or p_montant_c <= 0 or p_montant_c > 300000) then return 'montant'; end if;
  insert into public.litiges (demande_id, reference, client_id, cleaneur_id, genre, motif, description, montant_c, photos)
  values (d.id, d.reference, d.client_id, d.cleaneur_id,
          case when p_genre = 'DOMMAGE' then 'DOMMAGE' else 'LITIGE' end,
          case when p_genre = 'DOMMAGE' then 'DOMMAGE' when p_motif in ('INCOMPLETE', 'NON_CONFORME', 'AUTRE') then p_motif else 'AUTRE' end,
          left(trim(p_description), 2000), case when p_genre = 'DOMMAGE' then p_montant_c end,
          coalesce((select array_agg(x) from unnest(p_photos) x where x like d.reference || '/%'), '{}'));
  return 'ok';
end $$;

-- Accès impossible déclaré : motif, note et indemnité, lisibles avec le lien de suivi (null sinon).
create or replace function public.acces_impossible_de(p_reference text, p_jeton uuid) returns jsonb
language sql stable security definer set search_path to '' as $$
  select d.etapes->'acces_impossible' from public.demandes d where d.reference = p_reference and d.jeton = p_jeton;
$$;
grant execute on function public.acces_impossible_de(text, uuid) to anon, authenticated;
