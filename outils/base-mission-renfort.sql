-- Mission de renfort (26/11/2026, accord de Michael) — appliqué par Claude. Remplace la « prime d'urgence » (calculée sur la réserve
-- de garantie, toujours nulle) sans aucune trésorerie : Cleaneroo renonce à sa commission sur une mission remise en urgence.
-- 1. emettre_factures : commission 0 % quand la demande est une mission d'urgence (demandes.urgence).
-- 2. remettre_en_urgence : plus de prime ni de réserve ; l'indemnité du Cleaneur absent est entièrement « reste à retenir »
--    (retenue sur ses versements suivants, au plus 50 % de chacun : retenir_penalites, fonction paiement).
-- 3. avance_niveau : après un renfort (mission d'urgence prise dans les dernières 24 h), 10 min d'avance de plus sur les missions des
--    particuliers (même mécanisme que les niveaux).
-- 4. renforts_de : nombre de renforts réalisés (badge « Renfort » de la fiche publique).
-- Modifications par remplacement de texte dans la définition en vigueur (le reste des fonctions est inchangé) ; chaque remplacement
-- est contrôlé : s'il ne trouve pas son texte, la migration échoue sans rien changer.

do $$
declare def text; avant text;
begin
  -- 1
  def := pg_get_functiondef('public.emettre_factures(text)'::regprocedure); avant := def;
  def := replace(def, 'com_pb := least(com_pb, com_fid);',
    'com_pb := least(com_pb, com_fid);' || chr(10) || '  -- Mission de renfort (26/11/2026) : 0 % de commission sur une mission remise en urgence.' || chr(10) || '  if d.urgence then com_pb := 0; end if;');
  if def = avant then raise exception 'emettre_factures : texte introuvable'; end if;
  execute def;

  -- 2
  def := pg_get_functiondef('public.remettre_en_urgence(text,text)'::regprocedure); avant := def;
  def := replace(def, $r$    select garantie_c into garantie from public.profils where id = d.cleaneur_id for update;
    couvert := least(penalite, coalesce(garantie, 0));
    -- Sans perte : la prime ne dépasse jamais la part couverte, moins les frais d'appels et de SMS (URGENCE_FRAIS_C = 2 €).
    prime := least((d.estimation_c * pct) / 100, greatest(0, couvert - 200));
    update public.profils set garantie_c = garantie_c - couvert where id = d.cleaneur_id;$r$,
    $r$    -- Mission de renfort (26/11/2026) : plus de réserve ni de prime ; l'indemnité est retenue sur les versements suivants.
    couvert := 0; prime := 0;$r$);
  if def = avant then raise exception 'remettre_en_urgence : texte introuvable'; end if;
  execute def;
end $$;

-- 3
create or replace function public.avance_niveau(p_cleaneur uuid) returns integer language sql stable security definer set search_path = '' as $$
  select (array[0, 5, 10, 15])[1 + coalesce((public.niveau_de(p_cleaneur)->>'niveau')::int, 0)]
    + case when exists (select 1 from public.demandes d where d.cleaneur_id = p_cleaneur and d.urgence
                          and d.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS', 'A_VALIDER', 'TERMINEE')
                          and d.maj_le > now() - interval '24 hours') then 10 else 0 end;
$$;

-- 4
create or replace function public.renforts_de(p_cleaneur uuid) returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.demandes d where d.cleaneur_id = p_cleaneur and d.urgence and d.statut = 'TERMINEE';
$$;
grant execute on function public.renforts_de(uuid) to anon, authenticated;
