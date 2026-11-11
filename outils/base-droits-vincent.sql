-- Droits (12 novembre 2026) : fonctions réservées aux comptes connectés, et fonctions de déclencheurs jamais appelables directement.
revoke execute on function public.acces_impossible(text, text, text) from public, anon;
revoke execute on function public.creer_invitation(text, text, text) from public, anon;
revoke execute on function public.relancer_invitation(uuid) from public, anon;
revoke execute on function public.utiliser_invitation(text) from public, anon;
revoke execute on function public.decider_litige(uuid, text, text, int) from public, anon;
revoke execute on function public.repondre_litige(uuid, text) from public, anon;
revoke execute on function public.missions_a_noter() from public, anon;
revoke execute on function public.noter_client(text, int, text[], text) from public, anon;
revoke execute on function public.notes_clients(text[]) from public, anon;
revoke execute on function public.secteurs_a_recruter() from public, anon;
revoke execute on function public.couvrir_attentes() from public, anon, authenticated;
revoke execute on function public.activer_invitations() from public, anon, authenticated;
