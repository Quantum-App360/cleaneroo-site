-- Vans, camping-cars, caravanes (activité RC Pro « vehicules ») et bateaux (nouvelle activité « nautique ») : 16 novembre 2026, appliqué par Claude.
create or replace function public.activite_rc_pro(p_rubrique text, p_type_lieu text) returns text language sql immutable set search_path = '' as $$
  select case p_rubrique
    when 'home' then 'domicile' when 'rental' then 'domicile' when 'moving' then 'domicile' when 'hospitality' then 'domicile'
    when 'kitchen' then case when coalesce(p_type_lieu, 'particulier') in ('', 'particulier') then 'domicile' else 'cuisines_pro' end
    when 'office' then case when p_type_lieu = 'medical' then 'medical' else 'locaux' end
    when 'commerce' then 'locaux' when 'communal' then 'locaux' when 'windows' then 'vitres' when 'construction' then 'chantier'
    when 'car' then 'vehicules' when 'leisure' then 'vehicules' when 'boat' then 'nautique'
    when 'textiles' then 'textiles' when 'outdoor' then 'exterieurs' when 'event' then 'evenementiel'
    when 'special' then 'specialise' else 'domicile' end;
$$;
