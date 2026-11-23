// Cartes de l'espace Cleaneur (23/11/2026), identiques à l'appli (CartesCleaneur.kt) :
// - « Ma tournée » dans Aujourd'hui : missions du jour numérotées, reliées par un trait, itinéraire (Google Maps pour la tournée,
//   Waze pour la prochaine étape) et départ conseillé ;
// - Missions → Disponibles : bascule Liste / Carte ; une épingle touchée affiche la fiche de la mission (et son bouton) sous la carte ;
// - page « Devenir Cleaneur » : la même tournée sur une journée d'exemple autour de Fréjus.
// Règle anti-contournement : une mission pas encore prise n'a jamais d'adresse, seulement une zone d'environ 1,5 km.
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";
import { afficherCarte, coordonnees } from "./cartes.js";

export const ZONE_APPROX_M = 1500;
export const VERT = "#087A69", CORAIL = "#FA8C66";

/** Durée de trajet estimée (min) : vol d'oiseau × 1,3 (routes), 40 km/h de moyenne, arrondie aux 5 min (5 min au moins). */
export const minutesTrajet = km => Math.max(5, Math.ceil(km * 1.3 / 40 * 60 / 5) * 5);
/** Départ conseillé : début − trajet − 10 min de marge (se garer, trouver l'accès). */
export const departConseille = (debut, km) => new Date(debut.getTime() - (minutesTrajet(km) + 10) * 60000);

const enc = s => encodeURIComponent(String(s).trim());
/** Itinéraire Google Maps de toute la tournée depuis la position actuelle : dernière adresse = destination, les autres = étapes. */
export function urlGoogleMaps(adresses) {
  const a = adresses.map(x => String(x || "").trim()).filter(Boolean);
  if (!a.length) return null;
  const base = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${enc(a.at(-1))}`;
  return a.length === 1 ? base : `${base}&waypoints=${a.slice(0, -1).map(enc).join("%7C")}`;
}
/** Waze (une seule destination) : la prochaine étape. */
export const urlWaze = adresse => String(adresse || "").trim() ? `https://waze.com/ul?q=${enc(adresse)}&navigate=yes` : null;

function km(a, b) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
const heure = d => d.toLocaleTimeString(document.documentElement.lang || "fr", { hour: "2-digit", minute: "2-digit" });
const decimal = v => v.toLocaleString(document.documentElement.lang || "fr", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

let styleFait = false;
function styles() {
  if (styleFait) return;
  styleFait = true;
  const s = document.createElement("style");
  s.textContent = `
  .carte-tournee { height: 240px; border-radius: 16px; overflow: hidden; border: 1px solid var(--separateur, #dde5e4); margin: 6px 0 10px; }
  .tournee-depart { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 12px; background: rgba(8, 122, 105, .08); margin-bottom: 8px; }
  .tournee-etape { display: flex; gap: 10px; align-items: center; padding: 5px 0; }
  .tournee-etape .num { flex: none; width: 26px; height: 26px; border-radius: 50%; background: #087A69; color: #fff; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: center; }
  .tournee-etape .corps { min-width: 0; }
  .tournee-etape .corps b, .tournee-etape .corps span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tournee-boutons { display: flex; gap: 8px; margin-top: 8px; }
  .tournee-boutons .bouton { flex: 1; text-align: center; }
  .tournee-boutons .bouton.secondaire { flex: .5; }
  .bascule-dispo { display: flex; gap: 6px; margin: 6px 0 10px; }
  .bascule-dispo button { flex: 1; }
  .vue-carte-dispo [data-dispo]:not(.choisie) { display: none; }
  .carte-dispo-boite { height: 340px; border-radius: 16px; overflow: hidden; border: 1px solid var(--separateur, #dde5e4); margin-bottom: 6px; }
  `;
  document.head.append(s);
}

/**
 * « Ma tournée ». etapes : [{ titre, debut (Date|null), adresse, rue, cp, ville, lat?, lon? }] ; depart : { lat, lon } (centre du secteur) ou null.
 * Renvoie le HTML ; brancherTournee(boite, etapes, depart) place la carte et calcule les temps.
 */
export function blocTournee(etapes) {
  if (!etapes.length) return "";
  styles();
  return `<div class="tournee">
    <h2 class="titre-section">🗺️ ${tr("Ma tournée")}</h2>
    <div class="carte-tournee" role="img" aria-label="${esc(tr("Ma tournée"))}"></div>
    <div class="tournee-depart" hidden>🚗<div><b data-depart></b><p class="petit" style="margin:2px 0 0" data-depart-detail></p></div></div>
    ${etapes.map((e, i) => `<div class="tournee-etape"><span class="num">${i + 1}</span><div class="corps">
      <b>${e.debut ? esc(heure(e.debut)) + " · " : ""}${esc(tr(e.titre))}</b><span class="petit muet">${esc(e.adresse)}</span>
      <span class="petit muet" data-trajet="${i}"></span></div></div>`).join("")}
    <div class="tournee-boutons">
      <a class="bouton" target="_blank" rel="noopener" href="${esc(urlGoogleMaps(etapes.map(e => e.adresse)) || "#")}">${tr(etapes.length > 1 ? "Itinéraire de la tournée" : "Itinéraire")}</a>
      <a class="bouton secondaire" target="_blank" rel="noopener" href="${esc(urlWaze(etapes[0].adresse) || "#")}">Waze</a>
    </div></div>`;
}

export async function brancherTournee(boite, etapes, depart) {
  const zone = boite?.querySelector(".carte-tournee");
  if (!zone) return;
  const positions = [];
  for (const e of etapes) positions.push(Number.isFinite(e.lat) ? { lat: e.lat, lon: e.lon } : await coordonnees(e.rue || "", e.cp || "", e.ville || "").catch(() => null));
  if (!boite.isConnected) return;
  const marqueurs = etapes.map((e, i) => positions[i] && { ...positions[i], couleur: VERT, texte: String(i + 1), titre: tr(e.titre),
    popup: `<b>${i + 1}. ${esc(tr(e.titre))}</b>${e.debut ? "<br>" + esc(heure(e.debut)) : ""}<br>${esc(e.adresse)}` }).filter(Boolean);
  if (marqueurs.length) afficherCarte(zone, { marqueurs, zoom: 14, trajet: true }).catch(() => zone.remove());
  else zone.remove();
  // Départ conseillé (depuis le secteur) et temps de route entre deux étapes.
  positions.forEach((p, i) => {
    const avant = i === 0 ? depart : positions[i - 1];
    if (!p || !avant || !Number.isFinite(avant.lat)) return;
    const d = km(avant, p), min = minutesTrajet(d);
    if (i === 0 && etapes[0].debut) {
      const z = boite.querySelector(".tournee-depart");
      z.hidden = false;
      z.querySelector("[data-depart]").textContent = `${tr("Départ conseillé")} : ${heure(departConseille(etapes[0].debut, d))}`;
      z.querySelector("[data-depart-detail]").textContent = tr("Environ {0} km et {1} min de route depuis votre secteur, 10 min de marge comprises.")
        .replace("{0}", decimal(d)).replace("{1}", String(min));
    } else if (i > 0) {
      const t = boite.querySelector(`[data-trajet="${i}"]`);
      if (t) t.textContent = `🚗 ${tr("{0} min depuis l'étape précédente").replace("{0}", String(min))} · ${decimal(d)} km`;
    }
  });
}

/* ------------------------------------------------------------------ Missions disponibles : Liste / Carte */

let vueDispo = "liste", choisie = null;

/** Bascule et boîte de la carte, à placer avant la liste des cartes [data-dispo]. */
export function blocListeCarte(nb) {
  if (!nb) return "";
  styles();
  return `<div class="bascule-dispo segments" role="tablist">
      <button type="button" data-vue-dispo="liste">☰ ${tr("Liste")}</button><button type="button" data-vue-dispo="carte">🗺️ ${tr("Carte")}</button></div>
    <div data-zone-carte-dispo hidden><div class="carte-dispo-boite" role="img" aria-label="Carte des missions"></div>
      <p class="petit legende-carte"><span><i style="--c:${VERT}"></i>${tr("Mes missions")}</span><span><i style="--c:${CORAIL}"></i>${tr("Missions disponibles (zone approximative)")}</span></p>
      <p class="petit muet" style="margin:0 0 8px">${tr("L'adresse exacte s'affiche une fois la mission prise. Touchez une épingle pour voir la mission.")}</p></div>`;
}

/**
 * Branche la bascule : en vue carte, seule la fiche de la mission choisie reste affichée sous la carte (ses boutons restent branchés).
 * dispo : missions disponibles (zone approximative autour de la commune) ; miennes : missions prises (adresse exacte).
 * conteneur : élément qui contient les fiches [data-dispo="référence"] ; libelle(m), quand(m), prix(m) : textes des bulles.
 */
export function brancherListeCarte(conteneur, dispo, miennes, { libelle, quand, prix }) {
  const zone = conteneur?.querySelector("[data-zone-carte-dispo]");
  if (!zone || !dispo.length) return;
  let faite = false;
  const choisir = ref => {
    choisie = ref;
    conteneur.querySelectorAll("[data-dispo]").forEach(f => f.classList.toggle("choisie", f.dataset.dispo === ref));
  };
  const appliquer = () => {
    const carte = vueDispo === "carte";
    conteneur.classList.toggle("vue-carte-dispo", carte);
    zone.hidden = !carte;
    conteneur.querySelectorAll("[data-vue-dispo]").forEach(b => b.classList.toggle("actif", b.dataset.vueDispo === vueDispo));
    if (!carte) return;
    choisir(dispo.some(m => m.reference === choisie) ? choisie : dispo[0].reference);
    if (faite) return;
    faite = true;
    (async () => {
      const marqueurs = [];
      for (const [i, m] of dispo.entries()) {
        const p = await coordonnees("", m.code_postal, m.ville).catch(() => null);
        if (p) marqueurs.push({ ...p, i, couleur: CORAIL, approx: ZONE_APPROX_M, texte: m.sur_devis ? "?" : String(Math.floor((m.estimation_c || 0) / 100)),
          titre: libelle(m), popup: `<b>${esc(libelle(m))}</b><br>${esc(quand(m))}<br>${esc(m.code_postal)} ${esc(m.ville)} · ${esc(prix(m))}` });
      }
      for (const m of miennes) {
        const p = await coordonnees(m.rue, m.code_postal, m.ville).catch(() => null);
        if (p) marqueurs.push({ ...p, i: -1, couleur: VERT, titre: libelle(m), popup: `<b>${esc(libelle(m))}</b><br>${esc(quand(m))}<br>${esc(m.rue)}, ${esc(m.ville)}` });
      }
      if (!zone.isConnected) return;
      afficherCarte(zone.querySelector(".carte-dispo-boite"), { marqueurs, zoom: 12,
        onChoix: i => { if (i >= 0 && dispo[i]) choisir(dispo[i].reference); } }).catch(() => null);
    })();
  };
  conteneur.querySelectorAll("[data-vue-dispo]").forEach(b => b.onclick = () => { vueDispo = b.dataset.vueDispo; appliquer(); });
  appliquer();
}

/* ------------------------------------------------------------------ Page « Devenir Cleaneur » : journée d'exemple */

const EXEMPLE = [
  { titre: "Ménage de location saisonnière", h: 9, m: 0, adresse: "12 avenue de Verdun, 83600 Fréjus", lat: 43.4330, lon: 6.7370 },
  { titre: "Ménage du logement", h: 11, m: 30, adresse: "3 rue Jean Aicard, 83700 Saint-Raphaël", lat: 43.4253, lon: 6.7684 },
  { titre: "Nettoyage de vitres", h: 15, m: 0, adresse: "Port-Fréjus, 83600 Fréjus", lat: 43.4228, lon: 6.7466 },
];

/** Aperçu de la tournée sur une journée d'exemple (comme la démo de l'appli). */
export function blocApercuTournee() {
  styles();
  const auj = new Date();
  const etapes = EXEMPLE.map(e => ({ ...e, debut: new Date(auj.getFullYear(), auj.getMonth(), auj.getDate(), e.h, e.m) }));
  return `<div class="carte" data-apercu-tournee style="margin:16px 0">
    <p class="surtitre" style="margin:0">${tr("Exemple de journée")}</p>
    <p class="petit muet" style="margin:4px 0 0">${tr("Voici à quoi ressemblera votre journée. Créez votre compte pour recevoir de vraies missions.")}</p>
    ${blocTournee(etapes)}</div>`;
}
export function brancherApercuTournee(vue) {
  const b = vue?.querySelector("[data-apercu-tournee]");
  if (!b) return;
  const auj = new Date();
  const etapes = EXEMPLE.map(e => ({ ...e, debut: new Date(auj.getFullYear(), auj.getMonth(), auj.getDate(), e.h, e.m) }));
  traduire(b);
  brancherTournee(b, etapes, { lat: 43.4400, lon: 6.7200 });
}
