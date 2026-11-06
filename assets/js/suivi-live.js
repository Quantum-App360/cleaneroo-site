// Suivi en direct du Cleaneur sur une carte, comme une livraison : itinéraire, position qui avance, heure d'arrivée.
// Même écran que l'application (SuiviCarte.kt). Carte OpenStreetMap (Leaflet), itinéraire OSRM, adresse : Base Adresse Nationale.
import { REGLES, heure } from "./regles.js";
import { traduire, tr } from "./langue.js";
import { suivrePosition } from "./donnees.js";

let leaflet = null;
export function chargerLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leaflet) return leaflet;
  leaflet = new Promise((ok, ko) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    js.onload = () => ok(window.L); js.onerror = ko;
    document.head.appendChild(js);
  });
  return leaflet;
}

/** Position d'une adresse (Base Adresse Nationale). null si introuvable. */
export async function positionAdresse(rue, cp, ville) {
  const r = await fetch(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(`${rue} ${cp} ${ville}`)}&limit=1`);
  const f = (await r.json()).features?.[0];
  return f ? { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] } : null;
}

const RAD = Math.PI / 180;
export function distanceKm(a, b) {
  const h = Math.sin((b.lat - a.lat) * RAD / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin((b.lon - a.lon) * RAD / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Itinéraire routier : { points: [[lat, lon]…], km, min }. Sans réponse : ligne droite et vitesse moyenne (Regles). */
export async function itineraire(a, b) {
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`);
    const route = (await r.json()).routes?.[0];
    if (route) return { points: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]), km: route.distance / 1000, min: Math.max(1, Math.round(route.duration / 60)) };
  } catch { /* hors ligne : estimation */ }
  const km = distanceKm(a, b);
  return { points: [[a.lat, a.lon], [b.lat, b.lon]], km, min: Math.max(1, Math.round(km / REGLES.VITESSE_MOYENNE_KMH * 60)) };
}

/** Point situé à la fraction f (0 → 1) du trajet. */
export function pointSurTrajet(points, f) {
  if (points.length < 2) return { lat: points[0][0], lon: points[0][1] };
  const seg = []; let total = 0;
  for (let i = 1; i < points.length; i++) { const d = distanceKm({ lat: points[i - 1][0], lon: points[i - 1][1] }, { lat: points[i][0], lon: points[i][1] }); seg.push(d); total += d; }
  let reste = Math.min(Math.max(f, 0), 1) * total;
  for (let i = 0; i < seg.length; i++) {
    if (reste <= seg[i] || i === seg.length - 1) {
      const t = seg[i] ? Math.min(reste / seg[i], 1) : 0, [la, lo] = points[i], [lb, lob] = points[i + 1];
      return { lat: la + (lb - la) * t, lon: lo + (lob - lo) * t };
    }
    reste -= seg[i];
  }
}

/**
 * Bloc de suivi : carte + panneau « arrive dans N min ». Renvoie { placer(position, statut), arreter() }.
 * statut : "EN_ROUTE" ou "SUR_PLACE".
 */
export async function blocSuivi(boite, { arrivee, prenom }) {
  boite.innerHTML = `<div class="suivi-live">
    <div class="carte-live" aria-label="Carte du trajet du Cleaneur"></div>
    <div class="panneau-live">
      <div class="eta-live"><b data-eta>…</b><span data-heure></span></div>
      <div class="texte-live"><b data-titre></b><span class="petit" data-detail></span></div>
      <div class="etapes-live"><span class="fait">Confirmé</span><span data-etape="EN_ROUTE">En route</span><span data-etape="SUR_PLACE">Sur place</span><span>Ménage</span></div>
    </div></div>
    <div class="actions-live">
      ${"documentPictureInPicture" in window ? `<button type="button" class="bouton secondaire" data-mini>📌 Garder le suivi à l'écran</button>` : ""}
      ${"Notification" in window ? `<button type="button" class="bouton secondaire" data-alerte>🔔 Me prévenir à son arrivée</button>` : ""}
    </div>
    <p class="petit" data-info-fond style="margin:6px 0 0"></p>`;
  traduire(boite);
  const L = await chargerLeaflet();
  const carte = L.map(boite.querySelector(".carte-live"), { zoomControl: false, scrollWheelZoom: false, tap: false, dragging: !L.Browser.mobile, zoomSnap: 0.25 });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(carte);
  const maison = L.marker([arrivee.lat, arrivee.lon], { icon: L.divIcon({ className: "pin-maison", html: "<span>🏠</span>", iconSize: [40, 40], iconAnchor: [20, 48] }) }).addTo(carte);
  const initiale = (prenom || "C").trim().charAt(0).toUpperCase();
  const cleaneur = L.marker([arrivee.lat, arrivee.lon], { icon: L.divIcon({ className: "pin-cleaneur", html: `<span class="onde"></span><b>${initiale}</b>`, iconSize: [46, 46], iconAnchor: [23, 23] }), zIndexOffset: 500 });
  const trace = L.polyline([], { color: "#1F8A80", weight: 5, opacity: .9, lineCap: "round" }).addTo(carte);
  const ombre = L.polyline([], { color: "#0E3B40", weight: 9, opacity: .12 }).addTo(carte);
  carte.setView([arrivee.lat, arrivee.lon], 14);
  let actuelle = null, anim = 0, cadre = false, derniereRoute = 0, route = null, prevenu = false, mini = null;
  const titreAvant = document.title;

  /* En arrière-plan : petite fenêtre toujours au-dessus (ordinateur), titre de l'onglet, alerte du système à l'arrivée. */
  const suivi = boite.querySelector(".suivi-live");
  boite.querySelector("[data-mini]")?.addEventListener("click", async () => {
    if (mini) { mini.close(); return; }
    try {
      mini = await window.documentPictureInPicture.requestWindow({ width: 360, height: 460 });
      [...document.querySelectorAll('link[rel=stylesheet], style')].forEach(n => mini.document.head.appendChild(n.cloneNode(true)));
      mini.document.title = "Cleaneroo";
      mini.document.body.classList.add("corps-mini");
      mini.document.body.appendChild(suivi);
      setTimeout(() => carte.invalidateSize(), 100);
      boite.querySelector("[data-info-fond]").textContent = tr("Le suivi est dans la petite fenêtre : elle reste au-dessus de vos autres fenêtres.");
      mini.addEventListener("pagehide", () => {
        boite.prepend(suivi); mini = null;
        boite.querySelector("[data-info-fond]").textContent = "";
        setTimeout(() => carte.invalidateSize(), 100);
      });
    } catch { mini = null; }
  });
  boite.querySelector("[data-alerte]")?.addEventListener("click", async e => {
    const r = await Notification.requestPermission().catch(() => "denied");
    e.target.textContent = tr(r === "granted" ? "🔔 Alerte activée" : "Alertes bloquées par le navigateur");
    e.target.disabled = r === "granted";
  });

  const glisser = (vers) => {   // déplacement fluide de l'icône (1 s)
    const depuis = actuelle || vers, t0 = performance.now();
    cleaneur.setLatLng([depuis.lat, depuis.lon]);   // visible tout de suite, même si l'onglet est en arrière-plan (pas d'animation)
    if (document.hidden) { cleaneur.setLatLng([vers.lat, vers.lon]); actuelle = vers; return; }
    cancelAnimationFrame(anim);
    const pas = t => { const k = Math.min((t - t0) / 1000, 1); cleaneur.setLatLng([depuis.lat + (vers.lat - depuis.lat) * k, depuis.lon + (vers.lon - depuis.lon) * k]); if (k < 1) anim = requestAnimationFrame(pas); };
    anim = requestAnimationFrame(pas);
    actuelle = vers;
  };
  const panneau = (min, km, statut) => {
    const arrive = statut === "SUR_PLACE" || km < REGLES.RAYON_ARRIVEE_KM / 4;
    suivi.querySelector("[data-eta]").textContent = arrive ? "✓" : `${min} min`;
    const h = new Date(Date.now() + min * 60000);
    suivi.querySelector("[data-heure]").textContent = arrive ? tr("Arrivé(e)") : `${tr("vers")} ${heure(h.getHours(), h.getMinutes())}`;
    suivi.querySelector("[data-titre]").textContent = arrive ? `${prenom} ${tr("est sur place")}` : `${prenom} ${tr("est en route")}`;
    suivi.querySelector("[data-detail]").textContent = arrive ? tr("Arrivée confirmée par géolocalisation") : `${km.toFixed(1).replace(".", ",")} km · ${tr("position mise à jour en direct")}`;
    suivi.querySelectorAll("[data-etape]").forEach(e => e.classList.toggle("fait", e.dataset.etape === "EN_ROUTE" || (arrive && e.dataset.etape === "SUR_PLACE")));
    suivi.querySelector(".etapes-live [data-etape=EN_ROUTE]")?.classList.toggle("actif", !arrive);
    // Titre de l'onglet : visible même quand on travaille dans un autre onglet.
    document.title = arrive ? `✓ ${prenom} ${tr("est sur place")} · Cleaneroo` : `${min} min · ${prenom} ${tr("est en route")} · Cleaneroo`;
    if (arrive && !prevenu) {
      prevenu = true;
      if ("Notification" in window && Notification.permission === "granted")
        try { new Notification(`${prenom} ${tr("est sur place")}`, { body: tr("Arrivée confirmée par géolocalisation"), icon: "/favicon.png", tag: "cleaneroo-suivi" }); } catch { /* rien */ }
    }
  };
  return {
    /** Nouvelle position du Cleaneur. route (facultatif) : itinéraire déjà calculé (démo). */
    async placer(p, statut = "EN_ROUTE", routeConnue = null) {
      if (!cleaneur._map) cleaneur.addTo(carte);
      glisser(p);
      // Itinéraire restant recalculé au plus toutes les 30 s (ou fourni par la démo).
      if (routeConnue) route = routeConnue;
      else if (!route || Date.now() - derniereRoute > 30000) { derniereRoute = Date.now(); route = await itineraire(p, arrivee); }
      const reste = routeConnue ? routeConnue.reste : route;
      trace.setLatLngs(reste.points); ombre.setLatLngs(reste.points);
      const km = routeConnue ? reste.km : distanceKm(p, arrivee) * (route.km / Math.max(distanceKm(route.points[0] ? { lat: route.points[0][0], lon: route.points[0][1] } : p, arrivee), 0.01));
      const min = routeConnue ? reste.min : Math.max(1, Math.round(route.min * km / Math.max(route.km, 0.01)));
      panneau(min, km, statut);
      if (!cadre) { cadre = true; carte.invalidateSize(); carte.fitBounds(L.latLngBounds([...reste.points, [p.lat, p.lon], [arrivee.lat, arrivee.lon]]), { paddingTopLeft: [40, 40], paddingBottomRight: [50, 80] }); }
      else if (!carte.getBounds().pad(-0.1).contains([p.lat, p.lon])) carte.panTo([p.lat, p.lon]);
    },
    arreter() { cancelAnimationFrame(anim); mini?.close(); document.title = titreAvant; carte.remove(); },
  };
}

/** Suivi réel : lit la position envoyée par le téléphone du Cleaneur toutes les N secondes (Regles). */
export async function suivreEnDirect(boite, d) {
  const arrivee = await positionAdresse(d.rue, d.code_postal, d.ville).catch(() => null);
  if (!arrivee) { boite.hidden = true; return () => {}; }
  let bloc = null, minuterie = 0, fini = false;
  const lire = async () => {
    const p = await suivrePosition(d.reference, d.jeton).catch(() => null);
    if (fini) return;
    if (!p) { if (!bloc) boite.innerHTML = `<div class="note">${tr("La position du Cleaneur s'affichera ici dès qu'il partira.")}</div>`; return; }
    if (!bloc) bloc = await blocSuivi(boite, { arrivee, prenom: p.prenom });
    bloc.placer({ lat: p.lat, lon: p.lon }, d.statut);
  };
  await lire();
  minuterie = setInterval(lire, REGLES.SUIVI_INTERVALLE_S * 1000);
  return () => { fini = true; clearInterval(minuterie); bloc?.arreter(); };
}

/* ------------------------------------------------------------------ Démo : un trajet simulé (avant l'ouverture, aucune vraie mission) */

export async function demoSuivi(boite, { depart, arrivee, prenom, dureeS = 45 }) {
  const route = await itineraire(depart, arrivee);
  const bloc = await blocSuivi(boite, { arrivee, prenom });
  const t0 = Date.now();
  let minuterie = 0;
  const tic = () => {
    const f = Math.min((Date.now() - t0) / (dureeS * 1000), 1);
    const p = pointSurTrajet(route.points, f);
    // Reste du trajet : les points après la position actuelle.
    const i = Math.min(Math.floor(f * (route.points.length - 1)) + 1, route.points.length - 1);
    const reste = { points: [[p.lat, p.lon], ...route.points.slice(i)], km: route.km * (1 - f), min: Math.max(1, Math.round(route.min * (1 - f))) };
    bloc.placer(p, f >= 1 ? "SUR_PLACE" : "EN_ROUTE", { ...route, reste });
    if (f >= 1) clearInterval(minuterie);
  };
  tic();
  minuterie = setInterval(tic, 1000);
  return () => { clearInterval(minuterie); bloc.arreter(); };
}
