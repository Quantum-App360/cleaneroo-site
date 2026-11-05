-- Base Supabase « cleaneroo » (Paris) : demandes « Être rappelé ».
-- Même table que les pré-inscriptions (inscriptions), type 'rappel' : téléphone obligatoire, e-mail et code postal facultatifs.
-- À appliquer une fois (éditeur SQL de Supabase, ou par Claude avec l'accord de l'utilisateur). Sans effet sur les inscriptions existantes.
alter table public.inscriptions add column if not exists profil text not null default '' check (profil in ('', 'particulier', 'professionnel', 'conciergerie'));
alter table public.inscriptions add column if not exists creneau text not null default '' check (creneau in ('', 'matin', 'midi', 'apres_midi', 'soir'));
alter table public.inscriptions drop constraint inscriptions_type_check;
alter table public.inscriptions add constraint inscriptions_type_check check (type = any (array['client', 'cleaneur', 'conciergerie', 'rappel']));
alter table public.inscriptions drop constraint inscriptions_email_check;
alter table public.inscriptions add constraint inscriptions_email_check check (char_length(email) <= 200 and (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or (type = 'rappel' and email = '')));
alter table public.inscriptions drop constraint inscriptions_code_postal_check;
alter table public.inscriptions add constraint inscriptions_code_postal_check check (code_postal ~ '^[0-9]{5}$' or (type = 'rappel' and code_postal = ''));
alter table public.inscriptions add constraint inscriptions_rappel_check check (type <> 'rappel' or (telephone ~ '^0[1-9][0-9]{8}$' and profil <> '' and creneau <> ''));
-- 14 prestations au catalogue : l'ancienne limite (13) empêchait de toutes les cocher.
alter table public.inscriptions drop constraint inscriptions_prestations_check;
alter table public.inscriptions add constraint inscriptions_prestations_check check (cardinality(prestations) <= 20);
-- Un même e-mail ne s'inscrit qu'une fois par type ; les rappels (sans e-mail) ne sont pas concernés.
drop index if exists public.inscriptions_email_type_idx;
create unique index inscriptions_email_type_idx on public.inscriptions (lower(email), type) where type <> 'rappel';
