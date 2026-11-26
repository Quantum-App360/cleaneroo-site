-- Contrat de prestataire 2026-12-c (26/11/2026, accord de Michael) — appliqué par Claude.
-- 1. Version du contrat en vigueur : « 2026-12-c » (la base attendait encore « 2026-12 » alors que le site faisait signer « 2026-12-b »).
-- 2. Plus de réserve de garantie : les pénalités (annulation tardive, absence, litige) sont retenues sur les versements suivants
--    (fonction serveur « paiement », verser()), au plus RETENUE_MAX_PCT (50 %) de chaque versement, pour que le Cleaneur ne travaille
--    jamais pour 0 €. Chaque retenue est enregistrée (retenues_penalites) et visible par le Cleaneur (mes_penalites).
-- profils.garantie_c n'est plus utilisée par le site (toujours 0 : aucune fonction ne l'alimentait).

-- 1
create or replace function public.contrat_version_actuelle() returns text language sql immutable set search_path = '' as $$
  select '2026-12-c'::text
$$;

-- 2
create table if not exists public.retenues_penalites (
  id uuid primary key default gen_random_uuid(),
  penalite_id uuid not null references public.penalites_cleaneur (id) on delete cascade,
  cleaneur_id uuid not null references auth.users (id) on delete cascade,
  reference text not null,                       -- prestation dont le versement a été réduit
  montant_c integer not null check (montant_c > 0),
  cree_le timestamptz not null default now(),
  unique (penalite_id, reference)
);
alter table public.retenues_penalites enable row level security;
drop policy if exists retenues_lecture on public.retenues_penalites;
create policy retenues_lecture on public.retenues_penalites for select to authenticated using (cleaneur_id = auth.uid() or public.est_admin());

-- Retenue sur le versement d'une prestation : au plus p_max_c, pénalités les plus anciennes d'abord. Idempotente : rejouée pour la
-- même prestation, elle renvoie la retenue déjà faite. Réservée au serveur (fonction « paiement »).
create or replace function public.retenir_penalites(p_cleaneur uuid, p_reference text, p_max_c integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare deja integer; reste integer := greatest(0, coalesce(p_max_c, 0)); x record; pris integer; total integer := 0;
begin
  select coalesce(sum(montant_c), 0) into deja from public.retenues_penalites where cleaneur_id = p_cleaneur and reference = p_reference;
  if deja > 0 then return deja; end if;
  for x in select id, reste_a_retenir_c from public.penalites_cleaneur
           where cleaneur_id = p_cleaneur and statut = 'APPLIQUEE' and reste_a_retenir_c > 0 order by cree_le for update loop
    exit when reste <= 0;
    pris := least(reste, x.reste_a_retenir_c);
    update public.penalites_cleaneur set reste_a_retenir_c = reste_a_retenir_c - pris where id = x.id;
    insert into public.retenues_penalites (penalite_id, cleaneur_id, reference, montant_c) values (x.id, p_cleaneur, p_reference, pris);
    reste := reste - pris; total := total + pris;
  end loop;
  return total;
end $$;
revoke all on function public.retenir_penalites(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.retenir_penalites(uuid, text, integer) to service_role;

-- Ce que voit le Cleaneur : pénalités en cours et retenues déjà faites.
create or replace function public.mes_penalites() returns json language sql stable security definer set search_path = '' as $$
  select json_build_object('garantie_c', 0,
    'liste', coalesce((select json_agg(json_build_object('reference', reference, 'raison', raison, 'montant_c', montant_c, 'reste_c', reste_a_retenir_c, 'le', cree_le) order by cree_le desc)
                       from public.penalites_cleaneur where cleaneur_id = auth.uid() and statut = 'APPLIQUEE'), '[]'::json),
    'retenues', coalesce((select json_agg(json_build_object('reference', reference, 'montant_c', montant_c, 'le', cree_le) order by cree_le desc)
                          from (select * from public.retenues_penalites where cleaneur_id = auth.uid() order by cree_le desc limit 20) r), '[]'::json));
$$;
