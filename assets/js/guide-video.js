// Guides vidéo (13 novembre 2026) : une courte vidéo en tête de chaque espace pour aider à démarrer.
// « client » : réserver un ménage (Particulier, Entreprise, Conciergerie ou SCI) ; « cleaneur » : devenir Cleaneur et réaliser une mission.
// Carte compacte, la vidéo s'ouvre en grand ; « Masquer » la réduit à un simple lien (mémorisé sur l'appareil). Même chose dans l'appli (GuideVideo.kt).
import { tr, langue } from "./langue.js";

export const GUIDES_VIDEO = {
  client: { video: "assets/video/guide-client.mp4", image: "assets/video/guide-client.jpg",
    titre: "Votre ménage en 2 minutes", texte: "Choisir, décrire, réserver, suivre en direct puis valider : tout le parcours en 40 secondes." },
  cleaneur: { video: "assets/video/guide-cleaneur.mp4", image: "assets/video/guide-cleaneur.jpg",
    titre: "Votre première mission, pas à pas", texte: "Trouver une mission, vous proposer, être guidé le jour J puis être payé : tout en 40 secondes." },
};

const cleMasque = cle => `cleaneroo-guide-masque-${cle}`;
const estMasque = cle => { try { return localStorage.getItem(cleMasque(cle)) === "1"; } catch { return false; } };

/** Carte du guide vidéo. type : "client" | "cleaneur" ; cle : l'espace (pour se souvenir de « Masquer » espace par espace). */
export function guideVideo(type, cle = type) {
  const g = GUIDES_VIDEO[type];
  if (!g) return "";
  const enFrancais = langue !== "fr" ? ` <span class="petit muet">(${tr("vidéo en français")})</span>` : "";
  if (estMasque(cle)) return `<p class="guide-video-lien"><button type="button" class="lien-bouton" data-guide-afficher="${cle}" data-guide-type="${type}">▶ ${tr("Guide vidéo")}</button></p>`;
  return `<div class="carte guide-video" data-guide="${cle}">
      <button type="button" class="guide-video-vignette" data-guide-lire="${type}" aria-label="${tr("Regarder la vidéo")}">
        <img src="${g.image}" alt="" loading="lazy" width="90" height="160"><span class="guide-video-play" aria-hidden="true">▶</span></button>
      <div class="guide-video-corps"><span class="surtitre">${tr("Guide vidéo")} · 40 s</span>
        <b>${tr(g.titre)}</b>${enFrancais}
        <p class="petit muet" style="margin:2px 0 8px">${tr(g.texte)}</p>
        <div class="guide-video-actions"><button type="button" class="bouton petit-bouton" data-guide-lire="${type}">▶ ${tr("Regarder")}</button>
          <button type="button" class="lien-bouton petit" data-guide-masquer="${cle}" data-guide-type="${type}">${tr("Masquer")}</button></div></div>
    </div>`;
}

/** Ouvre la vidéo en grand (fenêtre par-dessus la page). */
export function ouvrirGuideVideo(type) {
  const g = GUIDES_VIDEO[type]; if (!g) return;
  const f = document.createElement("div");
  f.className = "guide-video-fenetre";
  f.innerHTML = `<div class="guide-video-cadre" role="dialog" aria-modal="true" aria-label="${tr(g.titre)}">
      <button type="button" class="guide-video-fermer" aria-label="${tr("Fermer")}">✕</button>
      <video src="${g.video}" poster="${g.image}" controls autoplay muted playsinline preload="auto"></video>
      <p class="petit" style="margin:8px 0 0;color:#fff;text-align:center">${tr(g.titre)}</p></div>`;
  const fermer = () => { f.querySelector("video")?.pause(); f.remove(); document.removeEventListener("keydown", echap); };
  const echap = e => { if (e.key === "Escape") fermer(); };
  f.addEventListener("click", e => { if (e.target === f || e.target.closest(".guide-video-fermer")) fermer(); });
  document.addEventListener("keydown", echap);
  document.body.appendChild(f);
  f.querySelector(".guide-video-fermer").focus();
}

// Un seul écouteur pour toutes les cartes, quel que soit l'écran qui les affiche.
if (typeof document !== "undefined" && !window.__guidesVideo) {
  window.__guidesVideo = true;
  document.addEventListener("click", e => {
    const lire = e.target.closest("[data-guide-lire]");
    if (lire) { ouvrirGuideVideo(lire.dataset.guideLire); return; }
    const masquer = e.target.closest("[data-guide-masquer]"), afficher = e.target.closest("[data-guide-afficher]");
    const b = masquer || afficher; if (!b) return;
    const cle = masquer ? masquer.dataset.guideMasquer : afficher.dataset.guideAfficher;
    try { masquer ? localStorage.setItem(cleMasque(cle), "1") : localStorage.removeItem(cleMasque(cle)); } catch { /* stockage indisponible */ }
    const bloc = b.closest(".guide-video, .guide-video-lien");
    const tmp = document.createElement("div"); tmp.innerHTML = guideVideo(b.dataset.guideType, cle);
    bloc.replaceWith(tmp.firstElementChild);
  });
}
