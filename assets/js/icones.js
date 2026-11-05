// Icônes Cleaneroo : dessinées à la main en SVG (grille 24 × 24, marge 2, trait 1,75 arrondi, couleur du texte).
// Deux tons : le trait (currentColor) et une seule zone pleine par icône (classe « a », var(--ico-aplat)), dessinée sous le trait.
// Les 14 icônes de rubrique portent l'étincelle Cleaneroo en haut à droite (classe « e », var(--ico-accent)).
// Aucun emoji, aucune bibliothèque externe. Page de contrôle : #/icones.

/** Étoile à quatre branches centrée sur (x, y), de rayon r (étincelles). */
const branches = (x, y, r, k = 0.2) => {
  const c = r * k, f = n => +n.toFixed(2);
  return `M${f(x)} ${f(y - r)}Q${f(x + c)} ${f(y - c)} ${f(x + r)} ${f(y)}Q${f(x + c)} ${f(y + c)} ${f(x)} ${f(y + r)}`
    + `Q${f(x - c)} ${f(y + c)} ${f(x - r)} ${f(y)}Q${f(x - c)} ${f(y - c)} ${f(x)} ${f(y - r)}Z`;
};
/** Étoile à cinq branches (les angles sont arrondis par le trait). */
const etoile5 = (x, y, R, r) => "M" + Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R;
  return `${(x + d * Math.cos(a)).toFixed(2)} ${(y + d * Math.sin(a)).toFixed(2)}`;
}).join("L") + "Z";

const ETINCELLE = `<path class="e" d="${branches(20, 4, 2.1, 0.22)}"/>`;
const aplat = d => `<path class="a" d="${d}"/>`;

/** Rubriques (avec étincelle). */
const RUBRIQUES = {
  logement: aplat("M2.8 11 12 3.6 21.2 11Z") + `<path d="M2.8 11 12 3.6 21.2 11M5 9.3V20.5h14V9.3M10 20.5V16.5a2 2 0 0 1 4 0v4"/>`,
  location: `<rect class="a" x="4" y="8" width="11" height="11.5" rx="2"/><rect x="4" y="8" width="11" height="11.5" rx="2"/>`
    + `<path d="M7.5 8V3.8h4V8M8 11.5v4.5M11 11.5v4.5"/><circle cx="6.8" cy="21" r="1"/><circle cx="12.2" cy="21" r="1"/>`
    + `<path d="M11.5 5.2c3 0 6 1.2 6 4"/><circle cx="17.5" cy="10.8" r="1.6"/><path d="M17.5 12.4v5.1m0-2h1.5m-1.5 2h1.5"/>`,
  demenagement: aplat("M3 11 11 13v8l-8-2.5Z") + `<path d="M3 11 11 13v8l-8-2.5ZM11 13l8-2v8l-8 2M3 11l8-2 8 2M3 11 2 6.8 9.5 5 11 9M11 9l1.5-4 6 2.2.5 3.8"/>`,
  vehicule: aplat("M8.2 14.1 10.3 11.7H15l2 2.4Z")
    + `<path d="M4.8 19H2.5v-2.5c0-1 .7-1.6 1.7-1.8l2.8-.6 2.5-3c.4-.4.9-.6 1.5-.6h4.2c.6 0 1.1.3 1.5.8l2.3 2.8 1.5.4c.8.2 1 .8 1 1.6V19h-2.3M15.2 19H8.8M7 14.1h12M12.7 11.7v2.4"/>`
    + `<circle cx="6.8" cy="19" r="2"/><circle cx="17.2" cy="19" r="2"/>`
    + `<path d="M6.5 3.2S4.8 5.3 4.8 6.5a1.7 1.7 0 0 0 3.4 0c0-1.2-1.7-3.3-1.7-3.3ZM11 3s-1.2 1.5-1.2 2.4a1.2 1.2 0 0 0 2.4 0C12.2 4.5 11 3 11 3Z"/>`,
  canape: `<rect class="a" x="6.5" y="12.5" width="11" height="4"/>`
    + `<path d="M6.5 12V9.5A2.5 2.5 0 0 1 9 7h6a2.5 2.5 0 0 1 2.5 2.5V12M6.5 12.5h11M6.5 16.5h11M12 12.5v4M5 18.5v2M19 18.5v2"/>`
    + `<rect x="2.5" y="11" width="4" height="7.5" rx="2"/><rect x="17.5" y="11" width="4" height="7.5" rx="2"/><path d="M6.5 18.5h11"/>`,
  chantier: aplat("M5 12a7 7 0 0 1 14 0Z") + `<path d="M5 12a7 7 0 0 1 14 0M3.5 12h17M10 5.3V9M14 5.3V9M4 21c1.6-3.4 4.7-5.4 9-5.8l1.3 1.3c-.4 4-3.6 5-10.3 4.5ZM14.3 16.5l2.2-2h4"/>`,
  cuisine: aplat("M4.5 13a7.5 3.3 0 0 1 15 0Z")
    + `<path d="M4.5 13a7.5 3.3 0 0 1 15 0M4 13h16M5 13v5.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V13M5 14.8H2.8M19 14.8h2.2M12 9.7V8.5M10.8 8.5h2.4"/>`
    + `<path d="M9.3 6.8c-1-1 1-2 0-3.5M14.3 6.8c-1-1 1-2 0-3.5"/>`,
  bureaux: `<rect class="a" x="4" y="6" width="11" height="8" rx="1.5"/><rect x="4" y="6" width="11" height="8" rx="1.5"/>`
    + `<path d="M9.5 14v5M2.5 19h19M4 19v2.5M20 19v2.5M16 14h4v3.5a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5ZM20 15h.6a1.2 1.2 0 0 1 0 2.4H20"/>`,
  commerce: aplat("M3 8h18v2.5a1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0Z")
    + `<path d="M3 8h18v2.5a1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0 1.5 1.5 0 0 1-3 0ZM4.5 12.5V21h15v-8.5M3 21h18M7 21v-5.5h4V21"/>`
    + `<rect x="13" y="14.5" width="4" height="3.5" rx=".6"/>`,
  "parties-communes": aplat("M4 21V9h4v3h4v3h4v3h4v3Z") + `<path d="M4 21V9h4v3h4v3h4v3h4v3ZM6 9V4.2M10 12V7.2M14 15v-4.8M18 18v-4.8M5 3.5l14 10.5"/>`,
  vitres: aplat("M5 7.5h6v7H4v-6a1 1 0 0 1 1-1Z") + `<rect x="4" y="7.5" width="14" height="14" rx="1"/><path d="M11 7.5v14M4 14.5h14M6.2 12 9 9.2M8 12.8l1.6-1.6"/>`,
  exterieurs: aplat("M5.5 12.5C5.5 7 9.5 4 16 4c0 6-3.5 9-10.5 8.5Z") + `<path d="M5.5 12.5C5.5 7 9.5 4 16 4c0 6-3.5 9-10.5 8.5ZM5.5 12.5l7-6M5.5 12.5 4 14"/>`
    + `<rect x="3" y="16" width="5.3" height="5.5" rx="1"/><rect x="9.35" y="16" width="5.3" height="5.5" rx="1"/><rect x="15.7" y="16" width="5.3" height="5.5" rx="1"/>`,
  evenement: `<ellipse class="a" cx="8.5" cy="8.5" rx="4" ry="4.8"/><ellipse cx="8.5" cy="8.5" rx="4" ry="4.8"/><ellipse cx="15" cy="10.3" rx="3.5" ry="4.2"/>`
    + `<path d="M8.5 13.3c-1 2.7 1 4.7 0 8.2M15 14.5c1 2.4-1 4.4 0 7M3.3 16.3l1.2.8M19.3 17.3l1.2-.8M3.5 3.5l.8 1.2"/>`,
  specialise: aplat("M7 13l1.2-2h5.6l1.2 2v7a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 7 20Z")
    + `<path d="M7 13l1.2-2h5.6l1.2 2v7a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 7 20ZM9.5 11V8.5h3V11M8 8.5V5.8h5.5l1.5 1.4v1.3ZM8 6.6H6.3M9.5 8.5l-1.2 2.2"/>`
    + `<path d="M3.6 4.8h.01M3.4 7h.01M3.8 9.2h.01M14 13.5h4a2.3 2.3 0 0 1 2.3 2.3v5.7M14 16.4h4.2M14 19.2h2.4c.9 0 1.6.7 1.6 1.6v.7"/>`,
};

/** Interface (sans étincelle). */
const INTERFACE = {
  calendrier: `<rect class="a" x="12.5" y="13" width="5" height="5" rx="1"/><rect x="3.5" y="5" width="17" height="16" rx="2"/>`
    + `<path d="M3.5 9.5h17M8 3v3.5M16 3v3.5M13.8 15.6l1 1 1.7-2.1M7 13.5h1.5M7 17h1.5"/>`,
  cleaneurs: aplat("M3 21v-1.5a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5V21ZM12.2 9.5a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0Z")
    + `<path d="M3 21v-1.5a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5V21"/><circle cx="9" cy="9.5" r="3.2"/><circle cx="16" cy="7.3" r="2.6"/><path d="M16.5 12.5c2.7.2 4.5 2.2 4.5 4.9V19"/>`,
  position: aplat("M12 21.5S5 14.8 5 9.5a7 7 0 0 1 14 0c0 5.3-7 12-7 12Z") + `<path d="M12 21.5S5 14.8 5 9.5a7 7 0 0 1 14 0c0 5.3-7 12-7 12Z"/><circle cx="12" cy="9.5" r="2.5"/>`,
  photo: `<circle class="a" cx="12" cy="13" r="3.7"/><path d="M3 8.5a2 2 0 0 1 2-2h2.5L9 4.5h6l1.5 2H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>`
    + `<circle cx="12" cy="13" r="3.7"/><path d="M17.5 9.5h.01"/>`,
  valide: `<circle class="a" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.7 2.7L16 9.5"/>`,
  "sur-place": aplat("M12 9.6S9.2 7 9.2 5a2.8 2.8 0 0 1 5.6 0c0 2-2.8 4.6-2.8 4.6Z")
    + `<path d="M12 9.6S9.2 7 9.2 5a2.8 2.8 0 0 1 5.6 0c0 2-2.8 4.6-2.8 4.6Z"/><circle cx="12" cy="5" r=".9"/><path d="M3 17l9-5.2 9 5.2M5.5 15.6v5.9h13v-5.9M10.5 21.5v-3.2h3v3.2"/>`,
  termine: aplat(branches(9.5, 13, 7.5)) + `<path d="${branches(9.5, 13, 7.5)}"/><path d="${branches(18, 5.5, 3.3)}"/><path d="${branches(19, 17.8, 2.3)}"/>`,
  avis: aplat(etoile5(12, 12.6, 9.6, 4.1)) + `<path d="${etoile5(12, 12.6, 9.6, 4.1)}"/>`,
  paiement: `<rect class="a" x="5.5" y="12.5" width="4.5" height="3.5" rx=".8"/><rect x="2.5" y="5.5" width="19" height="13" rx="2"/>`
    + `<path d="M2.5 9.5h19M13 15h5.5"/><rect x="5.5" y="12.5" width="4.5" height="3.5" rx=".8"/>`,
  instantane: aplat("M13.5 2.5 5 13.5h6.5l-1 8 8.5-11h-6.5Z") + `<path d="M13.5 2.5 5 13.5h6.5l-1 8 8.5-11h-6.5Z"/>`,
  garantie: aplat("M12 2.8l7.5 3V11.5c0 4.8-3.2 8.3-7.5 9.8-4.3-1.5-7.5-5-7.5-9.8V5.8Z")
    + `<path d="M12 2.8l7.5 3V11.5c0 4.8-3.2 8.3-7.5 9.8-4.3-1.5-7.5-5-7.5-9.8V5.8Z"/><path d="m8.8 12 2.3 2.3 4.4-4.5"/>`,
  "credit-impot": aplat("M5.5 2.8h13V21l-2.2-1.4-2.1 1.4-2.2-1.4-2.2 1.4-2.1-1.4L5.5 21Z")
    + `<path d="M5.5 2.8h13V21l-2.2-1.4-2.1 1.4-2.2-1.4-2.2 1.4-2.1-1.4L5.5 21Z"/><circle cx="9.5" cy="8" r="1.3"/><circle cx="14.5" cy="13.5" r="1.3"/><path d="M15 7 9 14.5"/>`,
  menu: `<path d="M4 7h16M4 12h16M4 17h16"/>`,
  telephone: aplat("M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z")
    + `<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z"/>`,
};

export const ICONES_RUBRIQUES = Object.keys(RUBRIQUES);
export const ICONES_INTERFACE = Object.keys(INTERFACE);
export const ICONES = {
  ...Object.fromEntries(Object.entries(RUBRIQUES).map(([n, d]) => [n, d + ETINCELLE])),
  ...INTERFACE,
};

/** SVG complet d'une icône. tuile : dans un carré arrondi (cartes). Nom inconnu : chaîne vide, jamais un emoji. */
export function icone(nom, { tuile = false, classe = "" } = {}) {
  const contenu = ICONES[nom];
  if (!contenu) return "";
  const svg = `<svg class="ico${classe ? " " + classe : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" `
    + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${contenu}</svg>`;
  return tuile ? `<span class="tuile-ico">${svg}</span>` : svg;
}
