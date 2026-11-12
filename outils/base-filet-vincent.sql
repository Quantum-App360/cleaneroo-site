-- Filet de sécurité aux délais de l'appli de Vincent (12 novembre 2026) :
-- « Êtes-vous en route ? » 45 min avant l'arrivée si le Cleaneur n'est pas parti ; sans réponse, appel 10 min après ;
-- sans réponse, mission retirée 5 min après (pénalités et prime d'urgence inchangées : remettre_en_urgence).
-- Retard déclaré : nouvelle relance si le Cleaneur n'est pas arrivé 15 min après l'heure qu'il a annoncée.
-- Côté client : le remplaçant est accepté d'office s'il arrive au plus tard 60 min après l'heure prévue ; le client peut refuser
-- (annulation sans frais + avoir de 15 €) ; sans remplaçant 60 min après l'heure prévue : annulation sans frais + avoir de 15 €.

create or replace function public.verifier_missions_urgence() returns void language plpgsql security definer set search_path to '' as $$
declare d record; arrivee timestamptz;
begin
  -- 1. Cleaneur confirmé qui n'est pas parti.
  for d in select * from public.demandes where statut = 'CONFIRMEE' and cleaneur_id is not null and creneau is not null
             and creneau <= now() + interval '45 minutes' loop
    if d.etapes ? 'retard' then
      arrivee := (d.etapes->'retard'->>'arrivee')::timestamptz;
      if now() >= arrivee + interval '15 minutes' and not (d.etapes ? 'appel_retard') then
        update public.demandes set etapes = etapes || jsonb_build_object('appel_retard', now()) where id = d.id;
        insert into public.alertes_cleaneur (type, reference, destinataire) values ('appel', d.reference, d.cleaneur_id);
      elsif (d.etapes->>'appel_retard')::timestamptz <= now() - interval '5 minutes' then
        perform public.remettre_en_urgence(d.reference, 'absence');
      end if;
    elsif not (d.etapes ? 'rappel') then
      update public.demandes set etapes = etapes || jsonb_build_object('rappel', now()) where id = d.id;
      insert into public.alertes_cleaneur (type, reference, destinataire) values ('rappel', d.reference, d.cleaneur_id);
      perform public.notifier(d.cleaneur_id, 'cleaneur', 'alerte', 'urgent', 'Êtes-vous en route ?', 'Répondez : en route, en retard ou empêché.', d.reference);
    elsif d.etapes ? 'confirme' and (d.etapes->>'confirme')::timestamptz >= (d.etapes->>'rappel')::timestamptz then
      -- A répondu « je suis en route » mais n'a pas démarré le trajet à l'heure : appel, puis retrait.
      if now() >= d.creneau and not (d.etapes ? 'appel_depart') then
        update public.demandes set etapes = etapes || jsonb_build_object('appel_depart', now()) where id = d.id;
        insert into public.alertes_cleaneur (type, reference, destinataire) values ('appel', d.reference, d.cleaneur_id);
      elsif (d.etapes->>'appel_depart')::timestamptz <= now() - interval '5 minutes' then
        perform public.remettre_en_urgence(d.reference, 'absence');
      end if;
    elsif not (d.etapes ? 'appel') and (d.etapes->>'rappel')::timestamptz <= now() - interval '10 minutes' then
      update public.demandes set etapes = etapes || jsonb_build_object('appel', now()) where id = d.id;
      insert into public.alertes_cleaneur (type, reference, destinataire) values ('appel', d.reference, d.cleaneur_id);
    elsif (d.etapes->>'appel')::timestamptz <= now() - interval '5 minutes' then
      perform public.remettre_en_urgence(d.reference, 'absence');
    end if;
  end loop;
  -- 2. Mission remise en ligne sans remplaçant 60 min après l'heure prévue : annulation sans frais et avoir de 15 €.
  for d in select * from public.demandes where statut = 'PUBLIEE' and cleaneur_id is null and etapes ? 'urgence'
             and creneau is not null and creneau <= now() - interval '60 minutes' loop
    perform public.annuler_sans_remplacant(d.reference);
  end loop;
end $$;

create or replace function public.annuler_sans_remplacant(p_reference text) returns void language plpgsql security definer set search_path to '' as $$
declare d public.demandes;
begin
  select * into d from public.demandes where reference = p_reference;
  if d.id is null or d.statut not in ('PUBLIEE', 'CONFIRMEE') then return; end if;
  update public.demandes set statut = 'ANNULEE', cleaneur_id = null,
    notes_admin = trim(coalesce(notes_admin, '') || ' Annulée sans frais : pas de remplaçant (avoir de 15 €).') where id = d.id;
  insert into public.cagnotte (profil_id, espace, montant_c, motif, reference)
  values (d.client_id, case when coalesce(d.espace, 'personnel') = 'personnel' then 'particulier' else 'pro' end, 1500, 'avoir', d.reference);
  perform public.notifier(d.client_id, 'client', 'paiement', 'important', 'Avoir de 15 € offert',
    'Nous n''avons pas trouvé de remplaçant à temps : prestation annulée sans frais, 15 € offerts sur votre prochaine réservation.', d.reference);
end $$;
revoke execute on function public.annuler_sans_remplacant(text) from anon, public, authenticated;

-- Le client refuse le remplaçant (dans les 15 min suivant la remise en ligne) : annulation sans frais et avoir de 15 €.
create or replace function public.refuser_remplacement(p_reference text, p_jeton uuid default null) returns text
language plpgsql security definer set search_path to '' as $$
declare d public.demandes;
begin
  select * into d from public.demandes where reference = p_reference
    and ((p_jeton is not null and jeton = p_jeton) or (auth.uid() is not null and client_id = auth.uid()));
  if d.id is null then return 'introuvable'; end if;
  if not (d.etapes ? 'urgence') or d.statut not in ('PUBLIEE', 'CONFIRMEE') then return 'etape'; end if;
  if (d.etapes->>'urgence')::timestamptz < now() - interval '15 minutes' then return 'delai'; end if;
  perform public.annuler_sans_remplacant(p_reference);
  return 'ok';
end $$;
grant execute on function public.refuser_remplacement(text, uuid) to anon, authenticated;

-- Remplacement en cours (client) : depuis quand, et s'il peut encore le refuser.
create or replace function public.remplacement_en_cours(p_reference text, p_jeton uuid default null) returns json
language sql stable security definer set search_path to '' as $$
  select json_build_object('depuis', d.etapes->>'urgence', 'refusable', (d.etapes->>'urgence')::timestamptz >= now() - interval '15 minutes',
    'limite', d.creneau + interval '60 minutes')
  from public.demandes d where d.reference = p_reference and d.etapes ? 'urgence' and d.statut in ('PUBLIEE', 'CONFIRMEE')
    and ((p_jeton is not null and d.jeton = p_jeton) or (auth.uid() is not null and d.client_id = auth.uid()));
$$;
grant execute on function public.remplacement_en_cours(text, uuid) to anon, authenticated;
