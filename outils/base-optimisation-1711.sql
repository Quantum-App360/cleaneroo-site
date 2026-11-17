-- Optimisation de la base (17 novembre 2026), appliquée : index des clés étrangères,
-- règles d'accès évaluées une fois par requête, règle en double supprimée, clé primaire.
create index if not exists attente_secteur_client_idx on public.attente_secteur(client_id);
create index if not exists avertissements_cleaneur_par_idx on public.avertissements_cleaneur(par);
create index if not exists avis_clients_cleaneur_idx on public.avis_clients(cleaneur_id);
create index if not exists avis_clients_client_idx on public.avis_clients(client_id);
create index if not exists demandes_cleaneur_favori_idx on public.demandes(cleaneur_favori);
create index if not exists equipe_membres_membre_idx on public.equipe_membres(membre_id);
create index if not exists favoris_cleaneur_idx on public.favoris(cleaneur_id);
create index if not exists invitations_pro_pro_idx on public.invitations_pro(pro_id);
create index if not exists litiges_cleaneur_idx on public.litiges(cleaneur_id);
create index if not exists litiges_client_idx on public.litiges(client_id);
create index if not exists messages_auteur_idx on public.messages(auteur);
create index if not exists profils_employeur_idx on public.profils(employeur_id);
create index if not exists profils_parrain_idx on public.profils(parrain_id);
create index if not exists propositions_cleaneur_idx on public.propositions(cleaneur_id);
create index if not exists signalements_arrivee_cleaneur_idx on public.signalements_arrivee(cleaneur_id);
create index if not exists societe_salaries_membre_idx on public.societe_salaries(membre_id);
create index if not exists supplements_cleaneur_idx on public.supplements(cleaneur_id);
alter policy invitations_lecture on public.invitations_pro
  using (pro_id = (select auth.uid()) or cleaneur_id = (select auth.uid()) or (select est_admin()));
alter policy litiges_lecture on public.litiges
  using (client_id = (select auth.uid()) or cleaneur_id = (select auth.uid()) or (select est_admin()));
alter policy salaries_lecture on public.societe_salaries
  using (societe_id = (select auth.uid()) or membre_id = (select auth.uid()) or (select est_admin()));
drop policy if exists "Administration : suppression des inscriptions" on public.inscriptions;
alter table public.sel_visites add primary key (sel);
