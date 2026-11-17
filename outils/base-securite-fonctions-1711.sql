-- Sécurité (17 novembre 2026), appliquée : fonctions internes (déclencheurs, tâche d'expiration)
-- fermées au public ; fonctions réservées aux comptes connectés fermées aux visiteurs anonymes.
revoke execute on function public.controler_favori_demande() from public, anon, authenticated;
revoke execute on function public.empreinte_visiteur() from public, anon, authenticated;
revoke execute on function public.inscription_anti_spam() from public, anon, authenticated;
revoke execute on function public.expirer_supplements() from public, anon, authenticated;
revoke execute on function public.stats_supplements() from public, anon;
revoke execute on function public.proposer_supplement(text, integer, text) from public, anon;
grant execute on function public.stats_supplements() to authenticated;
grant execute on function public.proposer_supplement(text, integer, text) to authenticated;
