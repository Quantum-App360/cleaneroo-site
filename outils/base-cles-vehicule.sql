-- Véhicules : preuve de remise et de restitution des clés (26/11/2026, proposition validée par Michael : « ok d'accord on part là-dessus »).
-- À appliquer seulement avec son accord. Même logique à reporter dans les applis (Vincent).
--
-- Le Cleaneur appuie sur « Clés reçues » puis « Clés rendues », avec une photo du tableau de bord (kilométrage et carburant) :
-- l'heure et la photo sont enregistrées dans les étapes de la mission (etapes.cles_recues, etapes.cles_rendues), le client est prévenu
-- (« Vos clés ont été rendues à l'accueil à 14 h 32 »). Rien d'autre ne change en base : pas de nouvelle table ni de nouvelle colonne.
-- Photo : dossier de la mission dans « photos-controles » (dépôt déjà permis au Cleaneur sur place ou en cours, lecture par le client).

create or replace function public.noter_cles(p_reference text, p_moment text, p_photo text default '') returns text
 language plpgsql security definer set search_path = '' as $$
declare d public.demandes; cle text; lieu text; h text;
begin
  select * into d from public.demandes where reference = p_reference;
  if not found then return 'introuvable'; end if;
  if auth.uid() is null or d.cleaneur_id is distinct from auth.uid() then return 'interdit'; end if;
  if p_moment not in ('recues', 'rendues') then return 'invalide'; end if;
  if d.statut not in ('SUR_PLACE', 'EN_COURS') then return 'etape'; end if;
  if coalesce(p_photo, '') <> '' and p_photo not like p_reference || '/%' then return 'invalide'; end if;
  cle := 'cles_' || p_moment;
  if coalesce(d.etapes, '{}'::jsonb) ? cle then return 'deja'; end if;
  if p_moment = 'rendues' and not (coalesce(d.etapes, '{}'::jsonb) ? 'cles_recues') then return 'ordre'; end if;
  update public.demandes set etapes = coalesce(etapes, '{}'::jsonb) || jsonb_build_object(cle, jsonb_build_object('le', now(), 'photo', nullif(p_photo, '')))
   where id = d.id;
  h := to_char(now() at time zone 'Europe/Paris', 'FMHH24" h "MI');
  if d.client_id is not null then
    lieu := case coalesce(d.acces->>'restitution', 'MEME')
      when 'BOITE' then 'dans la boîte à clés' when 'ACCUEIL' then 'à l''accueil' when 'MAIN' then 'en main propre'
      else case coalesce(d.acces->>'cles', '') when 'ACCUEIL' then 'à l''accueil' when 'BOITE' then 'dans la boîte à clés' when 'PERSONNE' then 'à la personne désignée'
           else case d.accueil when 'BOITE' then 'dans la boîte à clés' when 'TIERS' then 'à la personne désignée' else 'en main propre' end end end;
    perform public.notifier(d.client_id, 'client', 'progression', case when p_moment = 'rendues' then 'important' else 'standard' end,
      case when p_moment = 'recues' then 'Votre Cleaneur a les clés' else 'Vos clés ont été rendues' end,
      case when p_moment = 'recues' then 'Clés reçues à ' || h || case when coalesce(p_photo, '') <> '' then '. Photo du tableau de bord enregistrée.' else '.' end
           else 'Clés rendues ' || lieu || ' à ' || h || '.' end,
      p_reference);
  end if;
  return 'ok';
end $$;

revoke all on function public.noter_cles(text, text, text) from public, anon;
grant execute on function public.noter_cles(text, text, text) to authenticated;

-- « Je suis devant le véhicule » / « Je ne trouve pas le véhicule » pour un véhicule (au lieu de « logement » / « accès »).
create or replace function public.signaler_acces(p_reference text, p_type text) returns text
 language plpgsql security definer set search_path = '' as $$
declare d public.demandes; t text; v boolean;
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or not (d.cleaneur_id = auth.uid() or auth.uid() = any (d.equipiers)) then return 'interdit'; end if;
  if d.statut not in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS') then return 'statut'; end if;
  v := d.rubrique_id = 'car';
  t := case p_type when 'devant' then case when v then 'Je suis devant le véhicule.' else 'Je suis devant le logement.' end
                   when 'acces' then case when v then 'Je ne trouve pas le véhicule ou les clés : pouvez-vous m''aider ?' else 'Je ne trouve pas l''accès : pouvez-vous m''indiquer comment entrer ?' end
                   else null end;
  if t is null then return 'type'; end if;
  perform public.envoyer_message(p_reference, t);
  begin
    perform public.notifier(d.client_id, 'client', 'alerte', 'important',
      case p_type when 'devant' then case when v then 'Votre Cleaneur est devant le véhicule' else 'Votre Cleaneur est devant le logement' end
                  else case when v then 'Votre Cleaneur ne trouve pas le véhicule' else 'Votre Cleaneur ne trouve pas l''accès' end end,
      case p_type when 'devant' then 'Il arrive : vous n''avez rien à faire si l''accès est prévu.' else 'Répondez-lui dans la messagerie de la prestation.' end, p_reference);
  exception when others then null; end;
  return 'ok';
end $$;
