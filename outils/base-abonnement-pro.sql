-- Abonnement des conciergeries par tranche de logements (modèle économique, 7 novembre 2026) :
-- t1 1-5 logements 29 € HT/mois ; t2 6-15 69 € ; t3 16-40 149 € ; t4 41 et plus 3 € par logement (sur devis au-delà de 100).
-- Abonnée : 0 % de frais de service (sinon 8 % ; particuliers 5 %). 1er mois offert ; prélèvement avec Stripe (rien n'est débité d'ici là).
alter table public.profils add column if not exists abonnement_pro text not null default 'aucun';
alter table public.profils add column if not exists abonnement_pro_depuis timestamptz;
alter table public.profils drop constraint if exists profils_abonnement_pro_check;
alter table public.profils add constraint profils_abonnement_pro_check check (abonnement_pro in ('aucun', 't1', 't2', 't3', 't4'));

create or replace function public.choisir_abonnement_pro(t text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if t not in ('aucun', 't1', 't2', 't3', 't4') then return 'invalide'; end if;
  update public.profils set abonnement_pro = t,
    abonnement_pro_depuis = case when t = 'aucun' then null when abonnement_pro = 'aucun' then now() else abonnement_pro_depuis end
  where id = auth.uid() and 'pro' = any (statuts);
  return case when found then 'ok' else 'interdit' end;
end $$;
revoke all on function public.choisir_abonnement_pro(text) from public, anon;
grant execute on function public.choisir_abonnement_pro(text) to authenticated;
