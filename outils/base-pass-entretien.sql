-- Pass Entretien véhicule (26/11/2026, accord de Michael) : fidélité calculée par le serveur, jamais par le navigateur.
-- Règles (mêmes valeurs que REGLES.PASS_ENTRETIEN dans assets/js/regles.js — à changer ensemble) :
--  · palier : −5 % à partir du 3e passage, −10 % à partir du 6e (n = passages véhicules précédents du client, non annulés) ;
--  · deux passages prévus sautés (écart > 91 jours en mensuel, > 273 jours sinon) : on redescend d'un palier ;
--  · parrainage : un filleul dont un véhicule a été lavé ajoute 3 passages comptés (une seule fois) ;
--  · passage d'entretien (−15 % de temps et de prix) : le même véhicule a un passage dans les 45 jours avant (120 en trimestriel) ;
--  · un report gratuit par an d'un passage déjà confirmé (au moins 48 h avant, 14 jours au plus, hors dimanche).

alter table public.profils add column if not exists report_pass_le timestamptz;

-- Véhicule d'une demande : immatriculation (sans espaces ni tirets) ou, à défaut, adresse.
create or replace function public.cle_vehicule(p_immat text, p_rue text, p_cp text)
returns text language sql immutable set search_path = '' as $$
  select case when coalesce(upper(regexp_replace(p_immat, '[^A-Za-z0-9]', '', 'g')), '') <> ''
    then 'I:' || upper(regexp_replace(p_immat, '[^A-Za-z0-9]', '', 'g'))
    else 'A:' || lower(regexp_replace(coalesce(p_rue, ''), '\s+', ' ', 'g')) || '|' || trim(coalesce(p_cp, '')) end;
$$;

-- Calcul du Pass pour un passage à la date p_creneau.
-- p_exclure : la demande elle-même ; p_annulees_apres : passages annulés après cette date encore comptés
-- (le prix d'une demande a été calculé quand ils étaient prévus : tolérance du contrôle de prix).
create or replace function public.pass_entretien_calc(p_client uuid, p_creneau timestamptz, p_immat text, p_rue text, p_cp text,
  p_freq text default 'unique', p_exclure uuid default null, p_annulees_apres timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r record; n integer := 0; prec timestamptz := null; bonus integer := 0; entretien boolean := false;
  cle text := public.cle_vehicule(p_immat, p_rue, p_cp);
  ecart_max interval; delai interval := case when p_freq = 'trimestre' then interval '120 days' else interval '45 days' end;
begin
  if p_client is null or p_creneau is null then
    return jsonb_build_object('n', 0, 'bonus', 0, 'entretien', false);
  end if;
  for r in
    select d.creneau, coalesce(d.details->>'frequenceVehicule', 'unique') as freq,
           public.cle_vehicule(d.acces->'vehicule'->>'immat', d.rue, d.code_postal) as cle
      from public.demandes d
     where d.client_id = p_client and d.rubrique_id = 'car' and d.creneau is not null and d.creneau < p_creneau
       and not coalesce(d.sur_devis, false) and (p_exclure is null or d.id <> p_exclure)
       and (d.statut <> 'ANNULEE' or (p_annulees_apres is not null and d.maj_le > p_annulees_apres))
     order by d.creneau
  loop
    ecart_max := case when r.freq = 'mois' then interval '91 days' else interval '273 days' end;
    if prec is not null and r.creneau - prec > ecart_max then n := case when n >= 5 then 2 else 0 end; end if;
    n := n + 1; prec := r.creneau;
    if r.cle = cle and r.creneau >= p_creneau - delai then entretien := true; end if;
  end loop;
  ecart_max := case when p_freq = 'mois' then interval '91 days' else interval '273 days' end;
  if prec is not null and p_creneau - prec > ecart_max then n := case when n >= 5 then 2 else 0 end; end if;
  if exists (select 1 from public.parrainages pa join public.demandes f on f.client_id = pa.filleul_id
              where pa.parrain_id = p_client and f.rubrique_id = 'car' and f.statut = 'TERMINEE') then bonus := 3; end if;
  return jsonb_build_object('n', n, 'bonus', bonus, 'entretien', entretien);
end $$;
revoke all on function public.pass_entretien_calc(uuid, timestamptz, text, text, text, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pass_entretien_calc(uuid, timestamptz, text, text, text, text, uuid, timestamptz) to service_role;

-- Pour le client connecté : calcul pour un futur passage + ce qu'affiche la carte « Pass Entretien ».
create or replace function public.mon_pass_entretien(p_creneau timestamptz default null, p_immat text default '', p_rue text default '',
  p_cp text default '', p_freq text default 'unique')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare moi uuid := auth.uid(); calc jsonb; faits integer; att uuid; att_prenom text; rep timestamptz; prochain timestamptz;
begin
  if moi is null then return null; end if;
  calc := public.pass_entretien_calc(moi, coalesce(p_creneau, now()), p_immat, p_rue, p_cp, p_freq);
  select count(*) into faits from public.demandes where client_id = moi and rubrique_id = 'car' and statut = 'TERMINEE';
  select cleaneur_id into att from public.demandes where client_id = moi and rubrique_id = 'car' and statut = 'TERMINEE' and cleaneur_id is not null
   order by creneau desc limit 1;
  if att is not null then select prenom into att_prenom from public.profils where id = att; end if;
  select report_pass_le into rep from public.profils where id = moi;
  select min(creneau) into prochain from public.demandes where client_id = moi and rubrique_id = 'car' and statut not in ('ANNULEE', 'TERMINEE') and creneau > now();
  return calc || jsonb_build_object('faits', faits, 'attitre', att, 'attitre_prenom', att_prenom, 'prochain', prochain,
    'report_dispo', rep is null or rep < now() - interval '1 year', 'report_le', rep);
end $$;
revoke all on function public.mon_pass_entretien(timestamptz, text, text, text, text) from public, anon;
grant execute on function public.mon_pass_entretien(timestamptz, text, text, text, text) to authenticated;

-- Report gratuit (une fois par an) d'un passage véhicule déjà confirmé, réservé aux clients ayant atteint un palier.
-- Le Cleaneur est prévenu et reste prioritaire 24 h pour reprendre le passage à la nouvelle date.
create or replace function public.reporter_passage_pass(p_reference text, p_creneau timestamptz)
returns text language plpgsql security definer set search_path = '' as $$
declare moi uuid := auth.uid(); d public.demandes; calc jsonb; rep timestamptz; ancien uuid;
begin
  if moi is null then return 'connexion'; end if;
  select * into d from public.demandes where reference = p_reference and client_id = moi for update;
  if d.id is null then return 'introuvable'; end if;
  if d.rubrique_id <> 'car' or d.statut <> 'CONFIRMEE' or d.cleaneur_id is null then return 'statut'; end if;
  if d.creneau < now() + interval '48 hours' then return 'trop_tard'; end if;
  if p_creneau is null or p_creneau < now() + interval '48 hours' or abs(extract(epoch from (p_creneau - d.creneau))) > 14 * 86400 then return 'creneau'; end if;
  if extract(isodow from (p_creneau at time zone 'Europe/Paris')) = 7 then return 'dimanche'; end if;
  -- Le passage garde sa place dans la série (le prix déjà calculé reste juste).
  if exists (select 1 from public.demandes x where x.client_id = moi and x.rubrique_id = 'car' and x.id <> d.id and x.statut <> 'ANNULEE'
              and x.creneau between least(d.creneau, p_creneau) and greatest(d.creneau, p_creneau)) then return 'ordre'; end if;
  calc := public.pass_entretien_calc(moi, d.creneau, d.acces->'vehicule'->>'immat', d.rue, d.code_postal,
    coalesce(d.details->>'frequenceVehicule', 'unique'), d.id);
  if (calc->>'n')::int + (calc->>'bonus')::int < 2 then return 'palier'; end if;
  select report_pass_le into rep from public.profils where id = moi for update;
  if rep is not null and rep > now() - interval '1 year' then return 'deja_utilise'; end if;
  ancien := d.cleaneur_id;
  delete from public.positions_cleaneur where reference = d.reference;
  update public.demandes set creneau = p_creneau, statut = 'PUBLIEE', cleaneur_id = null, equipiers = '{}', etapes = '{}'::jsonb,
    choix_cleaneur = 'favori', cleaneur_favori = ancien, favori_jusqu = now() + interval '24 hours', maj_le = now()
   where id = d.id;
  update public.profils set report_pass_le = now() where id = moi;
  perform public.notifier(ancien, 'cleaneur', 'mission', 'important', 'Passage reporté par le client',
    'Le client a reporté le passage ' || d.reference || ' au ' || to_char(p_creneau at time zone 'Europe/Paris', 'DD/MM/YYYY à HH24:MI')
    || ' (report gratuit du Pass Entretien). Vous êtes prioritaire pendant 24 h pour le reprendre à cette date.', d.reference);
  return 'ok';
end $$;
revoke all on function public.reporter_passage_pass(text, timestamptz) from public, anon;
grant execute on function public.reporter_passage_pass(text, timestamptz) to authenticated;
