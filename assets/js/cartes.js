// Cartes et géolocalisation, communes au site et à l'application : l'appli affiche carte.html (même module) dans une vue web.
// Fond OpenStreetMap avec Leaflet ; adresses : Géoplateforme de l'IGN (Base Adresse Nationale), recherche et position → adresse.
// Rien n'est envoyé sans action de la personne : la position n'est lue qu'au toucher de « Me géolocaliser ».

const LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
const GEO = "https://data.geopf.fr/geocodage";
let chargement = null;

/** Charge Leaflet une seule fois (feuille de style et script). */
export function chargerLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (chargement) return chargement;
  chargement = new Promise((ok, ko) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = LEAFLET + "leaflet.min.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = LEAFLET + "leaflet.min.js"; js.onload = () => ok(window.L); js.onerror = () => { chargement = null; ko(new Error("carte")); };
    document.head.appendChild(js);
  });
  return chargement;
}

/* ------------------------------------------------------------------ Adresses (Base Adresse Nationale) */

// Monaco n'est pas dans la Base Adresse Nationale : la principauté est reconnue à part (code postal 98000).
const MONACO = { lat: 43.7384, lon: 7.4246 };
const dansMonaco = (lat, lon) => lat > 43.723 && lat < 43.7525 && lon > 7.405 && lon < 7.44;

const versAdresse = f => f && {
  lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
  rue: f.properties.type === "municipality" ? "" : (f.properties.name || ""),
  codePostal: f.properties.postcode || "", ville: f.properties.city || "", type: f.properties.type || "",
};

/** Cherche une adresse (« 12 rue des Pins 83700 Saint-Raphaël ») : { lat, lon, rue, codePostal, ville } ou null. */
export async function chercherAdresse(texte, codePostal = "") {
  if (String(codePostal).trim() === "98000") return { ...MONACO, rue: "", codePostal: "98000", ville: "Monaco", type: "municipality" };
  const q = String(texte || "").trim();
  if (q.length < 3) return null;
  try {
    const r = await fetch(`${GEO}/search?q=${encodeURIComponent(q)}${/^\d{5}$/.test(codePostal) ? `&postcode=${codePostal}` : ""}&limit=1`);
    if (!r.ok) return null;
    return versAdresse((await r.json()).features?.[0]) || null;
  } catch { return null; }
}

/** Adresse la plus proche d'une position (rue, code postal, ville), ou null. */
export async function adresseDe(lat, lon) {
  if (dansMonaco(lat, lon)) return { lat, lon, rue: "", codePostal: "98000", ville: "Monaco", type: "municipality" };
  try {
    const r = await fetch(`${GEO}/reverse?lon=${lon}&lat=${lat}&index=address&limit=1`);
    if (!r.ok) return null;
    const a = versAdresse((await r.json()).features?.[0]);
    return a ? { ...a, lat, lon } : null;
  } catch { return null; }
}

/** Position du téléphone ou de l'ordinateur : { lat, lon, precision } ; erreur "refus" ou "indisponible". */
export function maPosition() {
  return new Promise((ok, ko) => {
    if (!navigator.geolocation) return ko(new Error("indisponible"));
    navigator.geolocation.getCurrentPosition(
      p => ok({ lat: p.coords.latitude, lon: p.coords.longitude, precision: p.coords.accuracy }),
      e => ko(new Error(e.code === 1 ? "refus" : "indisponible")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}

/** Coordonnées d'une adresse enregistrée, mémorisées sur l'appareil (pas de nouvelle recherche à chaque affichage). */
const CLE_GEO = "cleaneroo-geo";
export async function coordonnees(rue, codePostal, ville) {
  const cle = `${rue}|${codePostal}|${ville}`.toLowerCase().trim();
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(CLE_GEO) || "{}"); } catch { /* rien */ }
  if (cache[cle]) return cache[cle];
  const a = await chercherAdresse(`${rue} ${codePostal} ${ville}`, codePostal);
  if (!a) return null;
  cache[cle] = { lat: a.lat, lon: a.lon };
  try { localStorage.setItem(CLE_GEO, JSON.stringify(Object.fromEntries(Object.entries(cache).slice(-300)))); } catch { /* rien */ }
  return cache[cle];
}

/* ------------------------------------------------------------------ Carte */

/** Épingle aux couleurs d'un bien (même dessin que l'appli). */
const epingle = (L, couleur, texte = "") => L.divIcon({
  className: "epingle", html: `<span style="--c:${couleur}"><b>${texte}</b></span>`, iconSize: [32, 42], iconAnchor: [16, 40], popupAnchor: [0, -36],
});

/**
 * Affiche une carte dans [boite] : marqueurs [{ lat, lon, couleur, texte, titre, popup, approx (rayon en m, adresse non communiquée) }],
 * cercle { lat, lon, km } (périmètre), marqueur déplaçable (onDeplace(lat, lon)) pour placer l'entrée du logement.
 */
export async function afficherCarte(boite, { marqueurs = [], cercle = null, deplacable = false, onDeplace = null, zoom = 16, plein = false } = {}) {
  const L = await chargerLeaflet();
  if (!boite.isConnected) return null;
  if (boite._carte) { boite._carte.remove(); boite._carte = null; }
  const carte = L.map(boite, {
    scrollWheelZoom: plein, dragging: plein || !L.Browser.mobile, tap: false, zoomControl: true, attributionControl: true, zoomSnap: 0.5,
  });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(carte);
  const points = [];
  if (cercle) {
    L.circle([cercle.lat, cercle.lon], { radius: cercle.km * 1000, color: "#1F8A80", weight: 2, fillColor: "#2EC4B6", fillOpacity: 0.16 }).addTo(carte);
    points.push(...[[cercle.lat - cercle.km / 111, cercle.lon], [cercle.lat + cercle.km / 111, cercle.lon]]);
  }
  for (const m of marqueurs) {
    const couleur = m.couleur || "#1F8A80";
    if (m.approx) L.circle([m.lat, m.lon], { radius: m.approx, color: couleur, weight: 1.5, fillColor: couleur, fillOpacity: 0.12 }).addTo(carte);
    const mk = L.marker([m.lat, m.lon], { icon: epingle(L, couleur, m.texte || ""), draggable: deplacable, keyboard: false, title: m.titre || "" }).addTo(carte);
    if (m.popup) mk.bindPopup(m.popup);
    if (deplacable && onDeplace) mk.on("dragend", () => { const p = mk.getLatLng(); onDeplace(p.lat, p.lng); });
    points.push([m.lat, m.lon]);
  }
  if (points.length === 1) carte.setView(points[0], zoom);
  else if (points.length) carte.fitBounds(points, { padding: [34, 34], maxZoom: 15 });
  else carte.setView([43.43, 6.74], 9);   // Var et Alpes-Maritimes
  boite._carte = carte;
  setTimeout(() => carte.invalidateSize(), 60);
  return carte;
}
