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
  // Maison : toit débordant, cheminée, porte et fenêtre
  logement: aplat("M3 10.5 12 3l9 7.5Z")
    + `<path d="M3 10.5 12 3l9 7.5M5.5 8.8v11.7h13V8.8M10 20.5v-4.6a2 2 0 0 1 4 0v4.6M14.4 4.9V3.4h2v3.2"/><rect x="14.8" y="11.6" width="2.2" height="2.2" rx=".4"/>`,
  // Valise à roulettes
  location: `<rect class="a" x="4.5" y="7.5" width="15" height="12" rx="2.5"/><rect x="4.5" y="7.5" width="15" height="12" rx="2.5"/>`
    + `<path d="M9 7.5V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6v1.9M8.5 7.5v12M15.5 7.5v12"/><circle cx="7.5" cy="21.2" r=".9"/><circle cx="16.5" cy="21.2" r=".9"/>`,
  // Carton ouvert
  demenagement: aplat("M4 10.5h16v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5Z")
    + `<path d="M4 10.5h16v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5ZM4 10.5 2.3 6.8h7.4L12 10.5l2.3-3.7h7.4L20 10.5M9.5 14.5h5"/>`,
  // Voiture de profil et bulles
  vehicule: aplat("M8 12.6 9.7 10h4.8l1.9 2.6Z")
    + `<path d="M4.8 17.2H3.6a1 1 0 0 1-1-1v-2.4a1 1 0 0 1 .7-1l2.6-.8 2.4-3.4A2 2 0 0 1 9.9 7.8h4.6a2 2 0 0 1 1.6.8l2.7 3.7 1.6.5a1 1 0 0 1 .7 1v2.4a1 1 0 0 1-1 1h-1.2M9 17.2h6M8 12.6 9.7 10h4.8l1.9 2.6Z"/>`
    + `<circle cx="6.9" cy="17.2" r="2.1"/><circle cx="17.1" cy="17.2" r="2.1"/><circle cx="5" cy="4.6" r="1.4"/><circle cx="8.6" cy="3.4" r=".8"/>`,
  // Canapé
  canape: `<path class="a" d="M6.5 13h11v3.5h-11Z"/>`
    + `<path d="M6.3 12.5V9.6A2.6 2.6 0 0 1 8.9 7h6.2a2.6 2.6 0 0 1 2.6 2.6v2.9M6.5 16.5h11M12 13v3.5M5.2 18.5V20.5M18.8 18.5V20.5"/>`
    + `<rect x="2.5" y="11" width="4" height="7.5" rx="2"/><rect x="17.5" y="11" width="4" height="7.5" rx="2"/><path d="M6.5 13h11M6.5 18.5h11"/>`,
  // Casque de chantier et poussière
  chantier: aplat("M5 14.5a7 7 0 0 1 14 0Z")
    + `<path d="M5 14.5a7 7 0 0 1 14 0M10 8V11.5M14 8v3.5M10 8a7.3 7.3 0 0 1 4 0"/><path d="M3 14.5h18v1.2a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 15.7Z"/>`
    + `<path d="M6 20.8h.01M10 21h.01M14 21h.01M18 20.8h.01"/>`,
  // Faitout fumant
  cuisine: aplat("M5 12h14v6.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18.5Z")
    + `<path d="M5 12h14v6.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18.5ZM3.5 12h17M5 14.3H2.8M19 14.3h2.2M10.5 9.6h3"/>`
    + `<path d="M9 7.5c-.9-.9.9-1.8 0-3.2M12 7.5c-.9-.9.9-1.8 0-3.2M15 7.5c-.9-.9.9-1.8 0-3.2"/>`,
  // Immeuble de bureaux
  bureaux: `<rect class="a" x="4" y="4" width="12.5" height="17" rx="1.5"/><rect x="4" y="4" width="12.5" height="17" rx="1.5"/>`
    + `<path d="M7.5 7.8h1.6M11.4 7.8H13M7.5 11.2h1.6M11.4 11.2H13M7.5 14.6h1.6M11.4 14.6H13M8.8 21v-2.8h2.9V21M16.5 11h2.5a1.5 1.5 0 0 1 1.5 1.5V21M2.5 21h19"/>`,
  // Boutique à auvent
  commerce: aplat("M3.5 4h17l1 4.5a2 2 0 0 1-4 .5 2.2 2.2 0 0 1-4.3 0 2.2 2.2 0 0 1-4.4 0 2.2 2.2 0 0 1-4.3 0 2 2 0 0 1-4-.5Z")
    + `<path d="M3.5 4h17l1 4.5a2 2 0 0 1-4 .5 2.2 2.2 0 0 1-4.3 0 2.2 2.2 0 0 1-4.4 0 2.2 2.2 0 0 1-4.3 0 2 2 0 0 1-4-.5ZM8.2 4l-.4 5M12 4v5M15.8 4l.4 5"/>`
    + `<path d="M4.5 11v10h15V11M2.8 21h18.4M7.5 21v-5h3.5v5"/><rect x="13" y="14" width="4" height="3.5" rx=".6"/>`,
  // Immeuble d'habitation, hall et escalier
  "parties-communes": aplat("M4 21V9h4v3h4v3h4v3h4v3Z")
    + `<path d="M4 21V9h4v3h4v3h4v3h4v3ZM2.5 21h19M6 9V5M10 12V8M14 15v-4M18 18v-4M6 5l12 9"/>`,
  // Fenêtre et reflets
  vitres: `<rect class="a" x="4" y="6" width="7" height="7"/><rect x="4" y="6" width="14" height="14" rx="1.5"/>`
    + `<path d="M11 6v14M4 13h14M6.2 10.6l2.4-2.4M6.4 12.2l.9-.9M2.5 20h17"/>`,
  // Arbre et pelouse
  exterieurs: `<circle class="a" cx="11" cy="9" r="5.5"/><circle cx="11" cy="9" r="5.5"/>`
    + `<path d="M11 13.5V21M11 17l2.4-2.2M11 15.6 9 13.8M3 21h17M16.5 21v-1.6M18.5 21v-2.6M5 21v-1.8"/>`,
  // Ballons
  evenement: `<ellipse class="a" cx="8.8" cy="8.3" rx="4.2" ry="5"/><ellipse cx="8.8" cy="8.3" rx="4.2" ry="5"/><ellipse cx="15.6" cy="10.4" rx="3.6" ry="4.3"/>`
    + `<path d="m8.1 13.3.7 1 .7-1M14.9 14.7l.7 1 .7-1M8.8 14.3c-.9 2.4.9 4.4 0 7.2M15.6 15.7c.9 2-.9 3.8 0 5.8M6.6 6.4a2.3 2.3 0 0 1 1.5-1.5"/>`,
  // Pulvérisateur professionnel
  specialise: aplat("M8 11.5h7l1.2 2.6v6.4a1.5 1.5 0 0 1-1.5 1.5H8.3a1.5 1.5 0 0 1-1.5-1.5v-6.4Z")
    + `<path d="M8 11.5h7l1.2 2.6v6.4a1.5 1.5 0 0 1-1.5 1.5H8.3a1.5 1.5 0 0 1-1.5-1.5v-6.4ZM9.6 11.5V9h3.8v2.5M15.5 9H8.8L7 7.4V5.5h8.5ZM15.5 7.2h1.8M9.3 16h4.4M9.3 18.4h2.8"/>`
    + `<path d="M4.3 4.3h.01M3.2 6.5h.01M4.4 8.6h.01"/>`,
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
  // Clé : anneau et panneton (accès au logement, boîte à clés)
  cle: `<circle class="a" cx="7.5" cy="12" r="4"/><circle cx="7.5" cy="12" r="4"/><path d="M11.5 12h9.5M17.5 12v3.2M20.5 12v2.2"/><circle cx="7.5" cy="12" r="1.2"/>`,
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
  return tuile ? `<span class="tuile-ico${RUBRIQUES[nom] ? " tuile-rubrique" : ""}">${svg}</span>` : svg;
}
