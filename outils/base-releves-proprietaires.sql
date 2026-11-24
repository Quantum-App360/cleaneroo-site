-- Relevé mensuel par propriétaire (24 novembre 2026, repris de l'appli iPhone) : ses logements, nuits occupées, ménages et leur coût,
-- incidents à sa charge, total à refacturer. La conciergerie le calcule (site), le télécharge en PDF et le partage : le relevé partagé
-- est gardé tel quel (instantané) et le propriétaire invité le voit dans « Mes équipes ». Jamais de code d'accès ni d'autre propriétaire :
-- l'instantané ne contient que le nom, la ville, les chiffres du mois et les incidents à sa charge.
create table if not exists public.releves_proprietaires (
  id uuid primary key default gen_random_uuid(),
  conciergerie_id uuid not null references public.profils (id) on delete cascade,
  membre_id uuid not null references public.equipe_membres (id) on delete cascade,
  mois date not null,
  donnees jsonb not null check (pg_column_size(donnees) < 200000),
  cree_le timestamptz not null default now(),
  unique (membre_id, mois)
);
alter table public.releves_proprietaires enable row level security;   -- aucune règle : lecture et écriture par les fonctions ci-dessous

-- Partage par la conciergerie (remplace le relevé du même mois).
create or replace function public.publier_releve(p_membre uuid, p_mois date, p_donnees jsonb) returns text
 language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.equipe_membres m where m.id = p_membre and m.conciergerie_id = auth.uid() and m.role = 'PROPRIETAIRE') then return 'interdit'; end if;
  if p_donnees is null or jsonb_typeof(p_donnees) <> 'object' or pg_column_size(p_donnees) >= 200000 then return 'donnees'; end if;
  insert into public.releves_proprietaires (conciergerie_id, membre_id, mois, donnees)
  values (auth.uid(), p_membre, date_trunc('month', p_mois)::date, p_donnees)
  on conflict (membre_id, mois) do update set donnees = excluded.donnees, cree_le = now();
  perform public.notifier(m.membre_id, 'client', 'info', 'standard', 'Nouveau relevé mensuel',
    'Votre conciergerie a partagé le relevé de ' || to_char(p_mois, 'MM/YYYY') || ' : retrouvez-le dans « Équipe et propriétaires ».', null)
  from public.equipe_membres m where m.id = p_membre and m.membre_id is not null;
  return 'ok';
end $$;
revoke all on function public.publier_releve(uuid, date, jsonb) from public, anon;
grant execute on function public.publier_releve(uuid, date, jsonb) to authenticated;

-- Relevés d'un propriétaire : lus par lui-même (invitation acceptée) ou par sa conciergerie.
create or replace function public.releves_de(p_membre uuid) returns table(mois date, donnees jsonb, cree_le timestamptz)
 language sql stable security definer set search_path = '' as $$
  select r.mois, r.donnees, r.cree_le from public.releves_proprietaires r join public.equipe_membres m on m.id = r.membre_id
  where r.membre_id = p_membre and ((m.membre_id = auth.uid() and m.statut = 'ACTIF') or m.conciergerie_id = auth.uid())
  order by r.mois desc limit 36;
$$;
revoke all on function public.releves_de(uuid) from public, anon;
grant execute on function public.releves_de(uuid) to authenticated;
