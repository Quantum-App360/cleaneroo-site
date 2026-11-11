-- Litiges et Garantie Cleaneroo (11 novembre 2026, repris de l'appli iPhone de Vincent).
-- Le client signale un problème (prestation incomplète, non conforme, autre) ou déclare un dommage (Garantie Cleaneroo,
-- plafond 3 000 €) dans les 48 h qui suivent la fin du ménage, avec description et photos. Tant qu'un signalement est
-- ouvert, la prestation n'est pas validée automatiquement (et, avec les vrais paiements, le versement au Cleaneur est
-- suspendu). L'administration décide : reprise gratuite, remboursement, indemnisation ou refus, avec un motif.
-- Le Cleaneur concerné voit le signalement de ses missions et peut répondre.

create table if not exists public.litiges (
  id uuid primary key default gen_random_uuid(),
  cree_le timestamptz not null default now(),
  demande_id uuid not null references public.demandes(id) on delete cascade,
  reference text not null,
  client_id uuid references auth.users(id) on delete set null,
  cleaneur_id uuid references auth.users(id) on delete set null,
  genre text not null check (genre in ('LITIGE', 'DOMMAGE')),
  motif text not null check (motif in ('INCOMPLETE', 'NON_CONFORME', 'DOMMAGE', 'AUTRE')),
  description text not null check (char_length(description) between 20 and 2000),
  montant_c int check (montant_c is null or montant_c between 0 and 300000),
  photos text[] not null default '{}',
  statut text not null default 'OUVERT' check (statut in ('OUVERT', 'REPRISE_GRATUITE', 'REMBOURSEMENT', 'INDEMNISATION', 'REFUSE')),
  reponse_cleaneur text check (char_length(reponse_cleaneur) <= 1000),
  decision text check (char_length(decision) <= 1000),
  montant_decide_c int check (montant_decide_c is null or montant_decide_c between 0 and 300000),
  decide_le timestamptz
);
alter table public.litiges enable row level security;
drop policy if exists litiges_lecture on public.litiges;
create policy litiges_lecture on public.litiges for select
  using (client_id = auth.uid() or cleaneur_id = auth.uid() or public.est_admin());
create index if not exists litiges_demande on public.litiges (demande_id);

-- Ouverture (avec le lien de suivi : référence + jeton, sans compte nécessaire).
-- Renvoie "ok", "introuvable", "etape", "delai", "deja", "description" ou "montant".
create or replace function public.ouvrir_litige(p_reference text, p_jeton uuid, p_genre text, p_motif text, p_description text,
  p_montant_c int default null, p_photos text[] default '{}')
returns text language plpgsql security definer set search_path to '' as $$
declare d public.demandes; v_fin timestamptz;
begin
  select * into d from public.demandes where reference = p_reference and jeton = p_jeton;
  if d.id is null then return 'introuvable'; end if;
  if d.statut not in ('A_VALIDER', 'TERMINEE') then return 'etape'; end if;
  v_fin := coalesce((d.etapes->>'fin')::timestamptz, d.maj_le);
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
grant execute on function public.ouvrir_litige(text, uuid, text, text, text, int, text[]) to anon, authenticated;

-- Signalements d'une demande (lien de suivi).
create or replace function public.litiges_de(p_reference text, p_jeton uuid)
returns table (cree_le timestamptz, genre text, motif text, statut text, decision text, montant_decide_c int)
language sql stable security definer set search_path to '' as $$
  select l.cree_le, l.genre, l.motif, l.statut, l.decision, l.montant_decide_c
    from public.litiges l join public.demandes d on d.id = l.demande_id
   where d.reference = p_reference and d.jeton = p_jeton order by l.cree_le desc;
$$;
grant execute on function public.litiges_de(text, uuid) to anon, authenticated;

-- Réponse du Cleaneur concerné.
create or replace function public.repondre_litige(p_id uuid, p_reponse text) returns boolean language sql security definer set search_path to '' as $$
  with m as (update public.litiges set reponse_cleaneur = left(trim(p_reponse), 1000)
              where id = p_id and cleaneur_id = auth.uid() and statut = 'OUVERT' returning 1)
  select exists (select 1 from m);
$$;
grant execute on function public.repondre_litige(uuid, text) to authenticated;

-- Décision de l'administration.
create or replace function public.decider_litige(p_id uuid, p_statut text, p_decision text, p_montant_c int default null)
returns boolean language plpgsql security definer set search_path to '' as $$
begin
  if not public.est_admin() then return false; end if;
  if p_statut not in ('REPRISE_GRATUITE', 'REMBOURSEMENT', 'INDEMNISATION', 'REFUSE') then return false; end if;
  update public.litiges set statut = p_statut, decision = left(coalesce(trim(p_decision), ''), 1000),
    montant_decide_c = case when p_statut in ('REMBOURSEMENT', 'INDEMNISATION') then least(greatest(coalesce(p_montant_c, 0), 0), 300000) end,
    decide_le = now()
   where id = p_id;
  return found;
end $$;
grant execute on function public.decider_litige(uuid, text, text, int) to authenticated;

-- Pas de validation automatique tant qu'un signalement est ouvert.
create or replace function public.valider_automatiquement() returns void language sql security definer set search_path to '' as $$
  update public.demandes d set statut = 'TERMINEE', etapes = d.etapes || jsonb_build_object('valide_auto', now())
  where d.statut = 'A_VALIDER' and coalesce((d.etapes->>'fin')::timestamptz, d.maj_le) < now() - interval '48 hours'
    and not exists (select 1 from public.litiges l where l.demande_id = d.id and l.statut = 'OUVERT');
$$;
