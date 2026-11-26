-- Première mission accompagnée (26/11/2026, accord de Michael) : remplace la « mission test rémunérée 40 € par Cleaneroo »
-- (Cleaneroo n'a pas de trésorerie). La mission test est une vraie mission d'un client, payée par le client au prix normal ;
-- Cleaneroo y prend 0 % de commission (le Cleaneur touche 100 % du prix). Tant qu'elle n'est pas réussie :
--  · une seule mission à la fois (ni une autre en cours, ni une terminée en attente de décision) ;
--  · chez un particulier seulement, jamais une mission urgente ;
--  · une seule proposition en attente à la fois.
-- Réussie automatiquement si le client laisse un avis d'au moins 4/5 ; sinon l'administrateur décide (decider_mission_test).

alter table public.demandes add column if not exists mission_accompagnee boolean not null default false;
alter table public.profils add column if not exists mission_test_le timestamptz;

-- La demande est marquée au moment où un Cleaneur dont la mission test n'est pas réussie la reçoit (prise directe ou proposition acceptée).
create or replace function public.marquer_mission_accompagnee() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cleaneur_id is null then new.mission_accompagnee := false;
  elsif new.cleaneur_id is distinct from old.cleaneur_id then
    new.mission_accompagnee := exists (select 1 from public.profils p where p.id = new.cleaneur_id and p.mission_test <> 'REUSSIE' and p.employeur_id is null);
  end if;
  return new;
end $$;
drop trigger if exists mission_accompagnee on public.demandes;
create trigger mission_accompagnee before update of cleaneur_id on public.demandes for each row execute function public.marquer_mission_accompagnee();

-- Missions qu'un Cleaneur en mission test peut prendre : particulier, non urgente.
create or replace function public.test_autorise(d public.demandes) returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
      or coalesce((select p.mission_test = 'REUSSIE' from public.profils p where p.id = auth.uid()), true)
      or (coalesce(d.espace, 'personnel') = 'personnel' and not coalesce(d.urgence, false));
$$;

create or replace function public.cleaneur_actif() returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin() or exists (select 1 from public.profils p where p.id = auth.uid() and p.role = 'cleaneur' and p.dossier = 'VALIDE'
    and p.banni_le is null and p.employeur_id is null
    and (p.mission_test = 'REUSSIE' or not exists (select 1 from public.demandes x where x.cleaneur_id = p.id and x.mission_accompagnee
      and (x.statut in ('CONFIRMEE', 'EN_ROUTE', 'SUR_PLACE', 'EN_COURS', 'A_VALIDER')
           or (x.statut = 'TERMINEE' and coalesce(x.creneau, x.cree_le) > coalesce(p.mission_test_le, '-infinity'::timestamptz))))));
$$;

create or replace function public.decider_mission_test(p_cleaneur uuid, p_reussie boolean, p_motif text default '') returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not public.est_admin() then return 'interdit'; end if;
  update public.profils set mission_test = case when p_reussie then 'REUSSIE' else 'A_REFAIRE' end, mission_test_le = now(),
    mission_test_motif = case when p_reussie then '' else left(coalesce(p_motif, ''), 300) end where id = p_cleaneur;
  perform public.notifier(p_cleaneur, 'cleaneur', case when p_reussie then 'confirmee' else 'alerte' end, 'important',
    case when p_reussie then 'Première mission réussie' else 'Première mission à refaire' end,
    case when p_reussie then 'Votre compte est activé : toutes les missions vous sont maintenant proposées.'
         else left(coalesce(nullif(p_motif, ''), 'Vous pouvez prendre une nouvelle mission accompagnée.'), 300) end, null);
  return 'ok';
end $$;

-- Avis du client d'au moins 4/5 sur la mission accompagnée : le compte est activé tout de suite.
create or replace function public.activer_apres_avis() returns trigger language plpgsql security definer set search_path = '' as $$
declare d public.demandes;
begin
  select * into d from public.demandes where reference = new.reference;
  if d.id is null or not d.mission_accompagnee or new.note < 4 then return new; end if;
  update public.profils set mission_test = 'REUSSIE', mission_test_le = now(), mission_test_motif = ''
   where id = d.cleaneur_id and mission_test <> 'REUSSIE';
  if found then
    perform public.notifier(d.cleaneur_id, 'cleaneur', 'confirmee', 'important', 'Première mission réussie',
      'Le client vous a donné ' || new.note || '/5 : votre compte est activé, toutes les missions vous sont maintenant proposées.', d.reference);
  end if;
  return new;
end $$;
drop trigger if exists activer_apres_avis on public.avis;
create trigger activer_apres_avis after insert on public.avis for each row execute function public.activer_apres_avis();

-- Restrictions ajoutées aux fonctions existantes (remplacement exact d'un passage, vérifié avant exécution).
do $$
declare f text;
begin
  f := pg_get_functiondef('public.missions_disponibles'::regproc);
  if position('public.test_autorise(d)' in f) = 0 then
    f := replace(f, 'and public.mission_visible(d) and public.qualifie(d) and not public.periode_fermee(d) and public.rc_pro_couvre(d)',
                    'and public.mission_visible(d) and public.qualifie(d) and not public.periode_fermee(d) and public.rc_pro_couvre(d) and public.test_autorise(d)');
    if position('public.test_autorise(d)' in f) = 0 then raise exception 'missions_disponibles : passage introuvable'; end if;
    execute f;
  end if;

  f := pg_get_functiondef('public.prendre_mission'::regproc);
  if position('mission_test' in f) = 0 then
    f := replace(f, '  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.rc_pro_couvre(d)) then return ''assurance''; end if;',
                    '  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.rc_pro_couvre(d)) then return ''assurance''; end if;
  if not exists (select 1 from public.demandes d where d.reference = p_reference and public.test_autorise(d)) then return ''mission_test''; end if;');
    if position('mission_test' in f) = 0 then raise exception 'prendre_mission : passage introuvable'; end if;
    execute f;
  end if;

  f := pg_get_functiondef('public.proposer(text,integer,text,text,integer,timestamp with time zone,text,integer)'::regprocedure);
  if position('mission_test' in f) = 0 then
    f := replace(f, '  if not public.rc_pro_couvre(d) then return ''assurance''; end if;',
                    '  if not public.rc_pro_couvre(d) then return ''assurance''; end if;
  -- Première mission accompagnée : particulier non urgent, une seule proposition en attente à la fois.
  if not public.test_autorise(d) then return ''mission_test''; end if;
  if exists (select 1 from public.profils p where p.id = auth.uid() and p.mission_test <> ''REUSSIE'')
     and exists (select 1 from public.propositions x where x.cleaneur_id = auth.uid() and x.reference <> p_reference and x.statut = ''EN_ATTENTE'' and x.expire_le > now())
    then return ''mission_test''; end if;');
    if position('mission_test' in f) = 0 then raise exception 'proposer : passage introuvable'; end if;
    execute f;
  end if;

  f := pg_get_functiondef('public.emettre_factures'::regproc);
  if position('mission_accompagnee' in f) = 0 then
    f := replace(f, 'if d.urgence then com_pb := 0; end if;',
                    'if d.urgence or d.mission_accompagnee then com_pb := 0; end if;   -- et première mission accompagnée (26/11/2026)');
    if position('mission_accompagnee' in f) = 0 then raise exception 'emettre_factures : passage introuvable'; end if;
    execute f;
  end if;
end $$;

-- Contrat 2026-12-d (article « Première mission accompagnée ») : même valeur que CONTRAT_VERSION dans assets/js/dossier.js.
create or replace function public.contrat_version_actuelle() returns text language sql immutable set search_path to '' as $$ select '2026-12-d'::text $$;
