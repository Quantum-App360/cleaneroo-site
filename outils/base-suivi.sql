-- Suivi en direct du Cleaneur (comme une livraison) : position envoyée par son téléphone pendant le trajet.
-- Déjà appliqué sur la base (migration « suivi_cleaneur_en_direct »). Gardé ici pour mémoire.
alter table public.demandes add column if not exists cleaneur_id uuid references auth.users(id) on delete set null;

create table if not exists public.positions_cleaneur (
  reference text primary key references public.demandes(reference) on delete cascade,
  cleaneur_id uuid not null references auth.users(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  cap real check (cap is null or (cap >= 0 and cap < 360)),
  maj_le timestamptz not null default now()
);
alter table public.positions_cleaneur enable row level security;
revoke all on public.positions_cleaneur from anon, authenticated;

-- Le Cleaneur affecté (ou l'administration) envoie sa position, seulement en route et sur place.
-- envoyer_position(p_reference, p_lat, p_lon, p_cap) → 'ok', 'connexion', 'introuvable', 'interdit' ou 'statut'.
-- Le client lit la position avec son lien de suivi : position_suivi(p_reference, p_jeton), seulement en route / sur place
-- et si elle a moins de 10 minutes. La position est effacée dès que la mission passe à une autre étape (pas d'historique des trajets).
