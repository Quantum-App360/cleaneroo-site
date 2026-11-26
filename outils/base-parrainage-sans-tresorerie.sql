-- Parrainage sans trésorerie (26/11/2026, accord de Michael) : Cleaneroo ne dépense jamais un euro.
-- Les récompenses sont des frais de service offerts (clients) ou des missions sans commission (Cleaneurs) : un revenu en moins sur une
-- vraie réservation, jamais une sortie d'argent. Plus de remise ni de cagnotte en euros pour les nouvelles demandes.
--  · filleul client : 3 réservations sans frais de service dès le rattachement ;
--  · parrain client : 1 réservation sans frais à la 1re prestation terminée du filleul, 2 de plus à la 3e ;
--  · client qui fait venir un Cleaneur : 3 réservations sans frais après 3 missions terminées du Cleaneur ;
--  · Cleaneur parrain : 3 missions sans commission et 10 min d'avance sur les nouvelles missions pendant 1 mois, après 3 missions du filleul ;
--  · conciergerie : 1 mois d'abonnement offert (inchangé) ;
--  · Ambassadeur : 3 filleuls récompensés → plus aucuns frais de service pendant 3 mois ; 10 filleuls → 12 mois ;
--  · tout avantage expire 12 mois après avoir été gagné ; annulation d'une demande : l'avantage utilisé est rendu.

create table if not exists public.avantages (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null references public.profils (id) on delete cascade,
  type text not null check (type in ('frais', 'commission')),
  restant smallint not null check (restant >= 0),
  motif text not null default '',
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null default now() + interval '12 months');
create index if not exists avantages_profil on public.avantages (profil_id, type);
alter table public.avantages enable row level security;
drop policy if exists avantages_lecture on public.avantages;
create policy avantages_lecture on public.avantages for select using (profil_id = auth.uid() or public.est_admin());

alter table public.profils add column if not exists ambassadeur_jusqu timestamptz, add column if not exists ambassadeur_niveau smallint not null default 0,
  add column if not exists avance_parrain_jusqu timestamptz;
alter table public.parrainages add column if not exists etape smallint not null default 0;
alter table public.demandes add column if not exists frais_offerts text check (frais_offerts in ('parrainage', 'ambassadeur')),
  add column if not exists commission_offerte boolean not null default false;

create or replace function public.avantage_dispo(p_profil uuid, p_type text) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(restant), 0)::int from public.avantages where profil_id = p_profil and type = p_type and restant > 0 and expire_le > now();
$$;
create or replace function public.accorder_avantage(p_profil uuid, p_type text, p_nombre int, p_motif text) returns void
language sql security definer set search_path = '' as $$
  insert into public.avantages (profil_id, type, restant, motif) select p_profil, p_type, p_nombre, p_motif where p_profil is not null and p_nombre > 0;
$$;
-- Utilise un avantage (le plus ancien encore valable). Renvoie vrai s'il y en avait un.
create or replace function public.prendre_avantage(p_profil uuid, p_type text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare a uuid;
begin
  select id into a from public.avantages where profil_id = p_profil and type = p_type and restant > 0 and expire_le > now()
   order by expire_le limit 1 for update skip locked;
  if a is null then return false; end if;
  update public.avantages set restant = restant - 1 where id = a;
  return true;
end $$;
revoke all on function public.avantage_dispo(uuid, text) from public, anon, authenticated;
revoke all on function public.accorder_avantage(uuid, text, int, text) from public, anon, authenticated;
revoke all on function public.prendre_avantage(uuid, text) from public, anon, authenticated;

-- Filleul client rattaché : 3 réservations sans frais de service.
create or replace function public.bienvenue_parrainage() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type = 'client' then perform public.accorder_avantage(new.filleul_id, 'frais', 3, 'bienvenue'); end if;
  return new;
end $$;
drop trigger if exists bienvenue_parrainage on public.parrainages;
create trigger bienvenue_parrainage after insert on public.parrainages for each row execute function public.bienvenue_parrainage();

-- Récompenses (appelée à chaque prestation terminée du filleul) : mêmes garde-fous qu'avant (téléphone, adresse, 10 par an).
create or replace function public.recompenser_parrainage(p_filleul uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare pa public.parrainages; p public.profils; f public.profils; n int; actifs int;
begin
  select * into pa from public.parrainages where filleul_id = p_filleul
     and (statut = 'en_attente' or (statut = 'recompense' and type = 'client' and etape < 3)) for update;
  if pa.filleul_id is null then return; end if;
  select * into p from public.profils where id = pa.parrain_id;
  select * into f from public.profils where id = pa.filleul_id;
  -- 2e étape d'un filleul client fidèle : 3e prestation terminée → 2 réservations sans frais de plus pour le parrain.
  if pa.statut = 'recompense' then
    select count(*) into n from public.demandes where client_id = p_filleul and statut = 'TERMINEE';
    if n >= 3 then
      perform public.accorder_avantage(p.id, 'frais', 2, 'parrainage_fidele');
      update public.parrainages set etape = 3 where filleul_id = p_filleul;
    end if;
    return;
  end if;
  if pa.type in ('cleaneur', 'client_cleaneur') then
    select count(*) into n from public.demandes where cleaneur_id = p_filleul and statut = 'TERMINEE';
    if n < 3 then return; end if;
  elsif not exists (select 1 from public.demandes where client_id = p_filleul and statut = 'TERMINEE') then return;
  end if;
  if (coalesce(regexp_replace(p.telephone, '\D', '', 'g'), '') <> '' and regexp_replace(p.telephone, '\D', '', 'g') = regexp_replace(coalesce(f.telephone, ''), '\D', '', 'g'))
     or exists (select 1 from public.demandes a join public.demandes b on lower(trim(a.rue)) = lower(trim(b.rue)) and a.code_postal = b.code_postal
                where a.client_id = p.id and b.client_id = f.id) then
    update public.parrainages set statut = 'refuse' where filleul_id = p_filleul; return;
  end if;
  if (select count(*) from public.parrainages where parrain_id = p.id and statut = 'recompense' and recompense_le > now() - interval '365 days') >= 10 then
    update public.parrainages set statut = 'plafond' where filleul_id = p_filleul; return;
  end if;
  if pa.type = 'conciergerie' then
    update public.profils set mois_abonnement_offerts = mois_abonnement_offerts + 1 where id in (p.id, f.id);
  elsif pa.type = 'cleaneur' then
    perform public.accorder_avantage(p.id, 'commission', 3, 'parrainage');
    update public.profils set avance_parrain_jusqu = greatest(coalesce(avance_parrain_jusqu, now()), now()) + interval '1 month' where id = p.id;
  elsif pa.type = 'client_cleaneur' then
    perform public.accorder_avantage(p.id, 'frais', 3, 'parrainage');
  else
    perform public.accorder_avantage(p.id, 'frais', 1, 'parrainage');
  end if;
  update public.parrainages set statut = 'recompense', recompense_le = now(), etape = 1 where filleul_id = p_filleul;
  -- Ambassadeur : 3 filleuls récompensés → 3 mois sans frais de service ; 10 → 12 mois (une fois chacun).
  select count(*) into actifs from public.parrainages where parrain_id = p.id and statut = 'recompense';
  if actifs >= 10 and p.ambassadeur_niveau < 2 then
    update public.profils set ambassadeur_niveau = 2, ambassadeur_jusqu = greatest(coalesce(ambassadeur_jusqu, now()), now()) + interval '12 months' where id = p.id;
  elsif actifs >= 3 and p.ambassadeur_niveau < 1 then
    update public.profils set ambassadeur_niveau = 1, ambassadeur_jusqu = greatest(coalesce(ambassadeur_jusqu, now()), now()) + interval '3 months' where id = p.id;
  end if;
  if actifs in (3, 10) then
    perform public.notifier(p.id, 'client', 'info', 'important', 'Vous êtes Ambassadeur Cleaneroo',
      'Merci ! ' || actifs || ' filleuls : plus aucuns frais de service sur vos réservations pendant ' || case when actifs = 10 then '12' else '3' end || ' mois.', null);
  end if;
end $$;
revoke all on function public.recompenser_parrainage(uuid) from public, anon, authenticated;

-- Dépôt d'une demande : plus de remise ni de cagnotte en euros ; frais de service offerts si Ambassadeur ou avantage disponible
-- (jamais pour un devis, ni pour un client déjà à 0 % : abonné Pro ou offre conciergerie).
create or replace function public.demande_remises() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.profils;
begin
  new.remise_parrainage_c := 0; new.cagnotte_c := 0; new.frais_offerts := null; new.commission_offerte := false;
  if new.client_id is null or new.sur_devis then return new; end if;
  select * into c from public.profils where id = new.client_id;
  if coalesce(c.abonnement_pro, 'aucun') <> 'aucun' or c.offre_conciergerie_fin > now() then return new; end if;
  if c.ambassadeur_jusqu > now() then new.frais_offerts := 'ambassadeur';
  elsif public.prendre_avantage(new.client_id, 'frais') then new.frais_offerts := 'parrainage';
  end if;
  return new;
end $$;

-- Fin d'une demande : terminée → récompenses ; annulée → avantage rendu (et ancienne cagnotte rendue).
create or replace function public.demande_fin_parrainage() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.statut = 'TERMINEE' and old.statut <> 'TERMINEE' then
    if new.client_id is not null then perform public.recompenser_parrainage(new.client_id); end if;
    if new.cleaneur_id is not null then perform public.recompenser_parrainage(new.cleaneur_id); end if;
  elsif new.statut = 'ANNULEE' and old.statut <> 'ANNULEE' and new.client_id is not null then
    if new.frais_offerts = 'parrainage' then perform public.accorder_avantage(new.client_id, 'frais', 1, 'rendu'); end if;
    if new.cagnotte_c > 0 then
      insert into public.cagnotte (profil_id, espace, montant_c, motif, reference, expire_le)
      values (new.client_id, case when new.espace = 'personnel' then 'particulier' else 'pro' end, new.cagnotte_c, 'remboursement', new.reference, now() + interval '12 months');
    end if;
  end if;
  return new;
end $$;

-- Avantages du compte connecté (écran Parrainage, réservation, espace Cleaneur).
create or replace function public.mes_avantages() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('frais', public.avantage_dispo(p.id, 'frais'), 'commission', public.avantage_dispo(p.id, 'commission'),
    'ambassadeur_jusqu', case when p.ambassadeur_jusqu > now() then p.ambassadeur_jusqu end, 'ambassadeur_niveau', p.ambassadeur_niveau,
    'avance_jusqu', case when p.avance_parrain_jusqu > now() then p.avance_parrain_jusqu end,
    'expire_le', (select min(expire_le) from public.avantages a where a.profil_id = p.id and a.restant > 0 and a.expire_le > now()),
    'abonne', coalesce(p.abonnement_pro, 'aucun') <> 'aucun' or p.offre_conciergerie_fin > now())
  from public.profils p where p.id = auth.uid();
$$;
revoke all on function public.mes_avantages() from public, anon;
grant execute on function public.mes_avantages() to authenticated;

-- Commission offerte (Cleaneur parrain) et avance de 10 min : remplacements exacts, vérifiés.
do $$
declare f text;
begin
  f := pg_get_functiondef('public.emettre_factures'::regproc);
  if position('commission_offerte' in f) = 0 then
    f := replace(f, 'if d.urgence or d.mission_accompagnee then com_pb := 0; end if;',
'if d.urgence or d.mission_accompagnee then com_pb := 0; end if;
  -- Parrainage sans trésorerie (26/11/2026) : mission sans commission gagnée en parrainant un Cleaneur.
  if d.commission_offerte then com_pb := 0;
  elsif com_pb > 0 and not exists (select 1 from public.factures where reference = d.reference and type = ''commission'')
        and public.prendre_avantage(payeur, ''commission'') then
    update public.demandes set commission_offerte = true where id = d.id; com_pb := 0;
  end if;');
    if position('commission_offerte' in f) = 0 then raise exception 'emettre_factures : passage introuvable'; end if;
    execute f;
  end if;
  f := pg_get_functiondef('public.avance_niveau'::regproc);
  if position('avance_parrain_jusqu' in f) = 0 then
    f := replace(f, 'and d.maj_le > now() - interval ''24 hours'') then 10 else 0 end;',
'and d.maj_le > now() - interval ''24 hours'') then 10 else 0 end
    + case when exists (select 1 from public.profils x where x.id = p_cleaneur and x.avance_parrain_jusqu > now()) then 10 else 0 end;');
    if position('avance_parrain_jusqu' in f) = 0 then raise exception 'avance_niveau : passage introuvable'; end if;
    execute f;
  end if;
end $$;
