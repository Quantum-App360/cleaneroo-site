// Cartes et géolocalisation, communes au site et à l'application : l'appli affiche carte.html (même module) dans une vue web.
// Fond OpenStreetMap avec Leaflet ; adresses : Géoplateforme de l'IGN (Base Adresse Nationale), recherche et position → adresse.
// Rien n'est envoyé sans action de la personne : la position n'est lue qu'au toucher de « Me géolocaliser ».

import { tr } from "./langue.js";

/** Textes de la carte MapLibre dans la langue du site (26/11/2026 : « Use ⌘ + scroll to zoom » s'affichait en anglais). */
const localeCarte = () => ({
  "CooperativeGesturesHandler.WindowsHelpText": tr("Utilisez Ctrl + molette pour zoomer"),
  "CooperativeGesturesHandler.MacHelpText": tr("Utilisez ⌘ + molette pour zoomer"),
  "CooperativeGesturesHandler.MobileHelpText": tr("Utilisez deux doigts pour déplacer la carte"),
  "NavigationControl.ZoomIn": tr("Zoomer"), "NavigationControl.ZoomOut": tr("Dézoomer"), "NavigationControl.ResetBearing": tr("Réorienter vers le nord"),
  "AttributionControl.ToggleAttribution": tr("Afficher ou masquer les crédits"), "FullscreenControl.Enter": tr("Plein écran"), "FullscreenControl.Exit": tr("Quitter le plein écran"),
});

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

/* ------------------------------------------------------------------ Carte Cleaneroo (prompt 4, lot 2) */
// Carte vectorielle MapLibre (hébergée sur le site, assets/vendor/maplibre) sur les tuiles libres d'OpenFreeMap (données OpenStreetMap),
// avec un style propre à Cleaneroo : clair à dominante bleue côté client, sombre à dominante verte côté Cleaneur (comme le design system).
// Bâtiments en relief seulement sur les grandes cartes (relief: true), jamais par effet gratuit. Sans WebGL : carte Leaflet de secours.
const V = (() => { try { return new URL(import.meta.url).search; } catch { return ""; } })();
const MAPLIBRE = "/assets/vendor/maplibre/";
const TUILES = "https://tiles.openfreemap.org/planet";
const POLICES = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
let chargementGL = null;

/** WebGL disponible (sinon : carte Leaflet de secours). */
export function webglDisponible() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}
/** Charge MapLibre une seule fois. */
export function chargerMaplibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (chargementGL) return chargementGL;
  chargementGL = new Promise((ok, ko) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = MAPLIBRE + "maplibre-gl.css" + V; document.head.appendChild(css);
    const js = document.createElement("script"); js.src = MAPLIBRE + "maplibre-gl.js" + V;
    js.onload = () => ok(window.maplibregl); js.onerror = () => { chargementGL = null; ko(new Error("carte")); };
    document.head.appendChild(js);
  });
  return chargementGL;
}

/** Thème de la carte : « cleaneur » (sombre, vert) dans l'espace Cleaneur, sinon « client » (clair, bleu). */
export const themeCarte = () => document.body?.classList.contains("mode-cleaneur") ? "cleaneur" : "client";

/** Couleurs de la carte, reprises du design system (jamais d'autres teintes). */
export const PALETTES_CARTE = {
  client: { fond: "#EEF4F3", eau: "#BDE5F1", vert: "#D3EFDD", bois: "#C6E8D3", habitat: "#E9F0EF", route: "#FFFFFF", bord: "#D3E0DF",
    majeure: "#FFFFFF", bordMajeure: "#C9D8D7", autoroute: "#FFE3D3", bordAutoroute: "#F1BFA3", chemin: "#C5D4D2", bati: "#E1EAE9", batiHaut: "#D3DFDE",
    texte: "#3E5A5E", halo: "#FFFFFF", ville: "#0B2F33", marque: "#0596C4", trajet: "#0A6F93" },
  cleaneur: { fond: "#0E1A1C", eau: "#10303A", vert: "#13302A", bois: "#143328", habitat: "#132426", route: "#1F3437", bord: "#0E1A1C",
    majeure: "#28464A", bordMajeure: "#0E1A1C", autoroute: "#3B4A3A", bordAutoroute: "#0E1A1C", chemin: "#24393C", bati: "#1A2B2E", batiHaut: "#22383B",
    texte: "#93ABA9", halo: "#0E1A1C", ville: "#ECF5F3", marque: "#1AD934", trajet: "#3FE07A" },
};

const NOM = ["coalesce", ["get", "name:fr"], ["get", "name:latin"], ["get", "name"]];
/** Style MapLibre Cleaneroo (schéma OpenMapTiles). relief : bâtiments en volume à partir du zoom 15. */
export function styleCleaneroo(theme = themeCarte(), { relief = false } = {}) {
  const c = PALETTES_CARTE[theme] || PALETTES_CARTE.client;
  const route = (id, filtre, couleur, largeurs, extra = {}) => ({ id, type: "line", source: "omt", "source-layer": "transportation", filter: filtre,
    layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": couleur, "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], ...largeurs], ...extra } });
  const majeures = ["match", ["get", "class"], ["primary", "secondary", "tertiary", "trunk"], true, false];
  const mineures = ["match", ["get", "class"], ["minor", "service", "track"], true, false];
  const autoroute = ["==", ["get", "class"], "motorway"];
  return {
    version: 8, name: `Cleaneroo ${theme}`, glyphs: POLICES,
    sources: { omt: { type: "vector", url: TUILES, attribution: ATTRIBUTION } },
    layers: [
      { id: "fond", type: "background", paint: { "background-color": c.fond } },
      { id: "habitat", type: "fill", source: "omt", "source-layer": "landuse", filter: ["match", ["get", "class"], ["residential", "suburb", "neighbourhood"], true, false], paint: { "fill-color": c.habitat } },
      { id: "bois", type: "fill", source: "omt", "source-layer": "landcover", filter: ["match", ["get", "class"], ["wood", "forest"], true, false], paint: { "fill-color": c.bois, "fill-opacity": .8 } },
      { id: "vert", type: "fill", source: "omt", "source-layer": "landcover", filter: ["match", ["get", "class"], ["grass", "farmland", "scrub"], true, false], paint: { "fill-color": c.vert, "fill-opacity": .6 } },
      { id: "parcs", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": c.vert } },
      { id: "eau", type: "fill", source: "omt", "source-layer": "water", filter: ["!=", ["get", "brunnel"], "tunnel"], paint: { "fill-color": c.eau } },
      { id: "cours-eau", type: "line", source: "omt", "source-layer": "waterway", paint: { "line-color": c.eau, "line-width": ["interpolate", ["linear"], ["zoom"], 10, .5, 16, 3] } },
      route("chemins", ["==", ["get", "class"], "path"], c.chemin, [14, .6, 18, 2], { "line-dasharray": [2, 2] }),
      route("mineures-bord", mineures, c.bord, [12, .5, 14, 3, 18, 18]),
      route("mineures", mineures, c.route, [12, .3, 14, 2, 18, 15]),
      route("majeures-bord", majeures, c.bordMajeure, [8, .6, 12, 2.4, 18, 26]),
      route("majeures", majeures, c.majeure, [8, .4, 12, 1.6, 18, 22]),
      route("autoroutes-bord", autoroute, c.bordAutoroute, [5, .6, 10, 2.4, 18, 28]),
      route("autoroutes", autoroute, c.autoroute, [5, .4, 10, 1.6, 18, 24]),
      relief
        ? { id: "batiments", type: "fill-extrusion", source: "omt", "source-layer": "building", minzoom: 14,
            paint: { "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 6], 0, c.bati, 40, c.batiHaut],
              "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, ["coalesce", ["get", "render_height"], 6]],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0], "fill-extrusion-opacity": .9 } }
        : { id: "batiments", type: "fill", source: "omt", "source-layer": "building", minzoom: 14, paint: { "fill-color": c.bati, "fill-outline-color": c.batiHaut } },
      { id: "noms-rues", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 14,
        layout: { "symbol-placement": "line", "text-field": NOM, "text-font": ["Noto Sans Regular"], "text-size": 11.5 },
        paint: { "text-color": c.texte, "text-halo-color": c.halo, "text-halo-width": 1.4 } },
      { id: "noms-quartiers", type: "symbol", source: "omt", "source-layer": "place", minzoom: 12, filter: ["match", ["get", "class"], ["suburb", "neighbourhood", "quarter", "hamlet"], true, false],
        layout: { "text-field": NOM, "text-font": ["Noto Sans Regular"], "text-size": 12, "text-transform": "uppercase", "text-letter-spacing": .08 },
        paint: { "text-color": c.texte, "text-halo-color": c.halo, "text-halo-width": 1.4 } },
      { id: "noms-villes", type: "symbol", source: "omt", "source-layer": "place", filter: ["match", ["get", "class"], ["city", "town", "village"], true, false],
        layout: { "text-field": NOM, "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 6, 11, 12, 16] },
        paint: { "text-color": c.ville, "text-halo-color": c.halo, "text-halo-width": 1.6 } },
    ],
  };
}

/** Polygone d'un cercle (rayon en km), pour les périmètres et les secteurs approximatifs. */
export function cerclePolygone(lat, lon, km, pas = 64) {
  const pts = [];
  for (let i = 0; i <= pas; i++) {
    const a = (i / pas) * 2 * Math.PI;
    pts.push([lon + (km / (111.32 * Math.cos(lat * Math.PI / 180))) * Math.cos(a), lat + (km / 110.57) * Math.sin(a)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [pts] } };
}

/** Épingle HTML aux couleurs d'un bien (même dessin que l'appli et que la carte de secours). */
function elementEpingle(couleur, texte = "", titre = "") {
  const el = document.createElement("div");
  el.className = "epingle";
  if (titre) { el.title = titre; el.setAttribute("aria-label", titre); }
  el.innerHTML = `<span style="--c:${couleur}"><b${String(texte).length > 2 ? ' style="font-size:8.5px;letter-spacing:-.3px"' : ""}>${texte}</b></span>`;
  return el;
}

/** Bouton « Vue 2D / 3D » (seulement sur les cartes en relief). */
class ControleRelief {
  onAdd(carte) {
    this.c = carte; const d = document.createElement("div"); d.className = "maplibregl-ctrl maplibregl-ctrl-group";
    d.innerHTML = `<button type="button" class="ctrl-relief" aria-label="${tr("Vue en relief")}" title="${tr("Vue en relief")}">3D</button>`;
    const b = d.querySelector("button");
    const maj = () => { const r = carte.getPitch() > 5; b.textContent = r ? "2D" : "3D"; b.setAttribute("aria-pressed", String(r)); };
    b.onclick = () => { carte.easeTo({ pitch: carte.getPitch() > 5 ? 0 : 50, bearing: carte.getPitch() > 5 ? 0 : -12, duration: reduit() ? 0 : 600 }); };
    carte.on("pitchend", maj); maj(); this.d = d; return d;
  }
  onRemove() { this.d.remove(); }
}
const reduit = () => matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Affiche une carte dans [boite] : marqueurs [{ lat, lon, couleur, texte, titre, popup, approx (rayon en m, adresse non communiquée), i }],
 * cercle { lat, lon, km } (périmètre), zones [{ lat, lon, km, couleur }] (secteurs approximatifs), marqueur déplaçable (onDeplace(lat, lon)),
 * trajet : trait reliant les épingles dans l'ordre (tournée), onChoix(i) : épingle touchée (i = m.i, sinon son rang),
 * relief : bâtiments en volume et bouton 2D / 3D (grandes cartes seulement), plein : carte d'écran entier (molette, déplacement),
 * vue { lat, lon, zoom } : cadrage quand il n'y a rien à montrer.
 * Renvoie { remove(), carte } ; même interface que la carte de secours.
 */
export async function afficherCarte(boite, options = {}) {
  if (!webglDisponible()) return afficherCarteLeaflet(boite, options);
  let gl;
  try { gl = await chargerMaplibre(); } catch { return afficherCarteLeaflet(boite, options); }
  if (!boite.isConnected) return null;
  const { marqueurs = [], cercle = null, zones = [], deplacable = false, onDeplace = null, zoom = 16, plein = false, trajet = false, onChoix = null, relief = false, vue = null } = options;
  if (boite._carte) { boite._carte.remove(); boite._carte = null; }
  const theme = themeCarte(), c = PALETTES_CARTE[theme];
  boite.classList.add("carte-cleaneroo", `carte-theme-${theme}`);
  const carte = new gl.Map({
    container: boite, style: styleCleaneroo(theme, { relief }), center: vue ? [vue.lon, vue.lat] : [6.74, 43.43], zoom: vue?.zoom ?? 9, attributionControl: false,
    cooperativeGestures: !plein, dragRotate: relief, pitchWithRotate: relief, touchPitch: relief, maxPitch: 60, fadeDuration: reduit() ? 0 : 200,
    locale: localeCarte(),
  });
  carte.addControl(new gl.AttributionControl({ compact: true }), "bottom-right");
  carte.addControl(new gl.NavigationControl({ showCompass: relief, visualizePitch: relief }), "top-right");
  if (relief) carte.addControl(new ControleRelief(), "top-right");
  // Fond de carte injoignable (réseau, bloqueur) : message clair au bout de 7 s, les épingles restent affichées.
  let fondCharge = false, erreurs = 0;
  const signaler = () => { if (!fondCharge && boite.isConnected && !boite.querySelector(".carte-hors-ligne"))
    boite.insertAdjacentHTML("beforeend", `<p class="carte-hors-ligne" role="status">${tr("Fond de carte indisponible pour le moment : les repères restent affichés.")}</p>`); };
  carte.on("sourcedata", e => { if (e.sourceId === "omt" && e.tile) { fondCharge = true; boite.querySelector(".carte-hors-ligne")?.remove(); } });
  carte.on("error", e => { if ((!e?.sourceId || e.sourceId === "omt") && ++erreurs >= 3) signaler(); });
  setTimeout(signaler, 7000);
  const points = [];
  const ajouts = [];
  carte.on("load", () => {
    const sourceSurfaces = { type: "FeatureCollection", features: [] };
    if (cercle) sourceSurfaces.features.push({ ...cerclePolygone(cercle.lat, cercle.lon, cercle.km), properties: { couleur: c.marque, contour: 2 } });
    for (const z of zones) sourceSurfaces.features.push({ ...cerclePolygone(z.lat, z.lon, z.km), properties: { couleur: z.couleur || c.marque, contour: 1.5 } });
    for (const m of marqueurs) if (m.approx) sourceSurfaces.features.push({ ...cerclePolygone(m.lat, m.lon, m.approx / 1000), properties: { couleur: m.couleur || c.marque, contour: 1.5 } });
    carte.addSource("surfaces", { type: "geojson", data: sourceSurfaces });
    carte.addLayer({ id: "surfaces", type: "fill", source: "surfaces", paint: { "fill-color": ["get", "couleur"], "fill-opacity": .14 } });
    carte.addLayer({ id: "surfaces-bord", type: "line", source: "surfaces", paint: { "line-color": ["get", "couleur"], "line-width": ["get", "contour"], "line-opacity": .7 } });
    if (trajet && marqueurs.length > 1) {
      carte.addSource("trajet", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: marqueurs.map(m => [m.lon, m.lat]) } } });
      carte.addLayer({ id: "trajet-halo", type: "line", source: "trajet", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.halo, "line-width": 7, "line-opacity": .8 } });
      carte.addLayer({ id: "trajet", type: "line", source: "trajet", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.trajet, "line-width": 3.5, "line-dasharray": [1.5, 1.6] } });
    }
  });
  for (const [rang, m] of marqueurs.entries()) {
    const mk = new gl.Marker({ element: elementEpingle(m.couleur || c.marque, m.texte || "", m.titre || ""), anchor: "bottom", draggable: deplacable })
      .setLngLat([m.lon, m.lat]).addTo(carte);
    if (m.popup) mk.setPopup(new gl.Popup({ offset: 34, closeButton: true, maxWidth: "280px" }).setHTML(m.popup));
    if (onChoix) mk.getElement().addEventListener("click", () => onChoix(Number.isInteger(m.i) ? m.i : rang));
    if (deplacable && onDeplace) mk.on("dragend", () => { const p = mk.getLngLat(); onDeplace(p.lat, p.lng); });
    ajouts.push(mk); points.push([m.lon, m.lat]);
  }
  if (cercle) { points.push([cercle.lon, cercle.lat - cercle.km / 111], [cercle.lon, cercle.lat + cercle.km / 111]); }
  for (const z of zones) { points.push([z.lon, z.lat - z.km / 111], [z.lon, z.lat + z.km / 111]); }
  const cadrer = (anime = false) => {
    if (points.length === 1) carte.jumpTo({ center: points[0], zoom });
    else if (points.length) {
      const lons = points.map(p => p[0]), lats = points.map(p => p[1]);
      carte.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 48, maxZoom: 15, duration: anime && !reduit() ? 600 : 0 });
    }
  };
  cadrer();
  if (relief && points.length) carte.once("load", () => carte.easeTo({ pitch: 45, bearing: -12, duration: reduit() ? 0 : 900 }));
  const objet = { carte, remove: () => { ajouts.forEach(m => m.remove()); carte.remove(); }, recadrer: () => cadrer(true) };
  boite._carte = objet;
  return objet;
}

/* ------------------------------------------------------------------ Carte de secours (Leaflet), si le navigateur n'affiche pas WebGL */

/** Épingle aux couleurs d'un bien (même dessin que l'appli). */
const epingle = (L, couleur, texte = "") => L.divIcon({
  className: "epingle", html: `<span style="--c:${couleur}"><b${String(texte).length > 2 ? ' style="font-size:8.5px;letter-spacing:-.3px"' : ""}>${texte}</b></span>`, iconSize: [32, 42], iconAnchor: [16, 40], popupAnchor: [0, -36],
});

/**
 * Affiche une carte dans [boite] : marqueurs [{ lat, lon, couleur, texte, titre, popup, approx (rayon en m, adresse non communiquée) }],
 * cercle { lat, lon, km } (périmètre), marqueur déplaçable (onDeplace(lat, lon)) pour placer l'entrée du logement.
 * trajet : trait pointillé reliant les épingles dans l'ordre (tournée de la journée). onChoix(i) : épingle touchée (i = m.i, sinon son rang).
 */
async function afficherCarteLeaflet(boite, { marqueurs = [], cercle = null, zones = [], vue = null, deplacable = false, onDeplace = null, zoom = 16, plein = false, trajet = false, onChoix = null } = {}) {
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
  for (const z of zones) {
    L.circle([z.lat, z.lon], { radius: z.km * 1000, color: z.couleur || "#1F8A80", weight: 1.5, fillColor: z.couleur || "#2EC4B6", fillOpacity: 0.12 }).addTo(carte);
    points.push([z.lat - z.km / 111, z.lon], [z.lat + z.km / 111, z.lon]);
  }
  if (trajet && marqueurs.length > 1) {
    L.polyline(marqueurs.map(m => [m.lat, m.lon]), { color: "#087A69", weight: 3, opacity: 0.8, dashArray: "6 8" }).addTo(carte);
  }
  for (const [rang, m] of marqueurs.entries()) {
    const couleur = m.couleur || "#1F8A80";
    if (m.approx) L.circle([m.lat, m.lon], { radius: m.approx, color: couleur, weight: 1.5, fillColor: couleur, fillOpacity: 0.12 }).addTo(carte);
    const mk = L.marker([m.lat, m.lon], { icon: epingle(L, couleur, m.texte || ""), draggable: deplacable, keyboard: false, title: m.titre || "" }).addTo(carte);
    if (m.popup) mk.bindPopup(m.popup);
    if (onChoix) mk.on("click", () => onChoix(Number.isInteger(m.i) ? m.i : rang));
    if (deplacable && onDeplace) mk.on("dragend", () => { const p = mk.getLatLng(); onDeplace(p.lat, p.lng); });
    points.push([m.lat, m.lon]);
  }
  if (points.length === 1) carte.setView(points[0], zoom);
  else if (points.length) carte.fitBounds(points, { padding: [34, 34], maxZoom: 15 });
  else if (vue) carte.setView([vue.lat, vue.lon], vue.zoom ?? 9);
  else carte.setView([43.43, 6.74], 9);   // Var et Alpes-Maritimes
  boite._carte = carte;
  setTimeout(() => carte.invalidateSize(), 60);
  return carte;
}
