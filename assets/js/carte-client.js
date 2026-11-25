// Carte client « Cleaneroo près de chez vous » (#/carte, prompt 4, lot 2).
// Le client choisit une prestation et son adresse : on lui dit honnêtement si un Cleaneur vérifié couvre son secteur.
// Oui : estimer et réserver. Non : « Être prévenu » (liste d'attente du secteur), sans rien payer.
// Les secteurs affichés viennent de la base, arrondis à une grille d'environ 5 km : jamais d'adresse ni de position exacte d'un Cleaneur.
import { RUBRIQUES, rubrique } from "./catalogue.js";
import { afficherCarte, chercherAdresse, maPosition, adresseDe } from "./cartes.js";
import { secteurCouvert, secteursPublics, rejoindreAttente } from "./donnees.js";
import { blocEtat, afficherToast } from "./commun.js";
import { icone } from "./icones.js";
import { reservationsFermees } from "./regles.js";
import { tr, traduire } from "./langue.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const FRANCE = { lat: 46.6, lon: 2.4, zoom: 4.6 };
const CORAIL = "#F2775C";
const PRESTATIONS = RUBRIQUES.filter(r => r.id !== "special");

/** État de la page : prestation, adresse trouvée, couverture (null = pas encore vérifiée, -1 = service indisponible). */
let etat = { rubriqueId: "home", adresse: null, n: null, secteurs: null, attente: "" };

export function pageCarteClient() {
  return `<section class="fond-cleaneroo" style="padding:36px 0 64px"><div class="conteneur">
      <h1>Cleaneroo près de chez vous</h1><div class="trait-corail"></div>
      <p>Choisissez une prestation et votre adresse : vous savez tout de suite si un Cleaneur vérifié intervient chez vous.</p></div></section>
    <section class="bloc" style="padding-top:0"><div class="conteneur page-carte">
      <form class="carte carte-client-recherche" data-recherche novalidate>
        <label class="champ"><span>Prestation</span><select name="rubrique">${PRESTATIONS.map(r => `<option value="${r.id}"${r.id === etat.rubriqueId ? " selected" : ""}>${esc(r.nom)}</option>`).join("")}</select></label>
        <label class="champ"><span>Votre adresse ou votre ville</span><input name="adresse" type="text" autocomplete="street-address" maxlength="160" placeholder="12 rue des Pins, 83700 Saint-Raphaël" value="${esc(etat.adresse?.texte || "")}"></label>
        <div class="carte-client-actions"><button type="submit" class="bouton">Vérifier</button>
          <button type="button" class="bouton secondaire" data-position>${icone("position")} <span>Ma position</span></button></div>
      </form>
      <div class="carte-client-corps">
        <div class="carte-client-boite" data-boite role="region" aria-label="Carte des secteurs couverts"></div>
        <div class="carte-client-resultat" data-resultat aria-live="polite"></div>
      </div>
      <p class="petit muet carte-client-note">${icone("garantie")} Les secteurs sont approximatifs (à quelques kilomètres près) : la position d'un Cleaneur n'est jamais affichée.</p>
    </div></section>`;
}

export function brancherCarteClient(vue) {
  const racine = vue.querySelector(".page-carte");
  if (!racine) return;
  const form = racine.querySelector("[data-recherche]"), boite = racine.querySelector("[data-boite]"), zoneResultat = racine.querySelector("[data-resultat]");
  let jeton = 0, jetonSecteurs = 0;

  const dessiner = () => {
    const marqueurs = etat.adresse ? [{ lat: etat.adresse.lat, lon: etat.adresse.lon, couleur: CORAIL, texte: "", titre: tr("Votre adresse") }] : [];
    const zones = (etat.secteurs || []).map(z => ({ lat: z.lat, lon: z.lon, km: Math.min(z.rayon_km || 20, 50) }));
    afficherCarte(boite, { marqueurs, zones, zoom: 11, vue: FRANCE, relief: false }).catch(() => null);
  };

  const resultat = () => {
    const r = rubrique(etat.rubriqueId), nom = esc(tr(r.nom));
    let html;
    if (!etat.adresse) {
      html = etat.secteurs?.length
        ? blocEtat({ icone: "position", titre: tr("Où souhaitez-vous l'intervention ?"), texte: `${etat.secteurs.length} ${tr(etat.secteurs.length > 1 ? "secteurs couverts" : "secteur couvert")} ${tr("pour")} ${nom}. ${tr("Saisissez votre adresse pour vérifier la vôtre.")}`, compact: true })
        : blocEtat({ icone: "position", titre: tr("Où souhaitez-vous l'intervention ?"), texte: tr("Saisissez votre adresse ou utilisez votre position. Nous vérifions si un Cleaneur vérifié couvre votre secteur."), compact: true });
    } else if (etat.n === null) {
      html = `<div class="squelette-carte" aria-hidden="true"><div class="squelette squelette-titre"></div><div class="squelette squelette-ligne"></div><div class="squelette squelette-ligne courte"></div></div>`;
    } else if (etat.n < 0) {
      html = blocEtat({ icone: "alerte", erreur: true, compact: true, titre: tr("Vérification indisponible"), texte: tr("Le service ne répond pas pour le moment. Réessayez dans quelques minutes."),
        action: `<button type="button" class="bouton secondaire" data-reessayer>${tr("Réessayer")}</button>` });
    } else if (etat.n > 0) {
      const fermees = reservationsFermees();
      html = `<div class="carte carte-client-ok"><span class="badge succes">${icone("valide")} ${tr("Disponible")}</span>
        <h3>${nom} ${tr("à votre adresse")}</h3>
        <p class="muet">${etat.n} ${tr(etat.n > 1 ? "Cleaneurs vérifiés couvrent votre secteur." : "Cleaneur vérifié couvre votre secteur.")}</p>
        <p class="carte-client-adresse">${icone("position")} ${esc(etat.adresse.libelle)}</p>
        ${fermees ? `<p class="petit">${tr("Les réservations ouvrent très bientôt : votre estimation sera gardée.")}</p>` : ""}
        <a class="bouton" href="#/estimer/${r.id}">${tr(fermees ? "Estimer le prix" : "Estimer et réserver")}</a></div>`;
    } else if (etat.attente === "ok") {
      html = blocEtat({ icone: "valide", compact: true, titre: tr("C'est enregistré."), texte: tr("Nous vous prévenons par e-mail dès qu'un Cleaneur qualifié intervient dans votre secteur.") });
    } else {
      html = `<div class="carte carte-client-attente"><span class="badge alerte">${tr("Pas encore disponible")}</span>
        <h3>${tr("Pas encore de Cleaneur ici pour")} ${nom}</h3>
        <p class="muet">${tr("Nous recrutons dans votre secteur. Laissez votre e-mail : nous vous prévenons dès qu'un Cleaneur qualifié s'installe près de chez vous. Rien à payer.")}</p>
        <form data-attente novalidate><div class="grille-2">
          <label class="champ"><span>${tr("Prénom")}</span><input name="prenom" autocomplete="given-name" maxlength="80"></label>
          <label class="champ"><span>${tr("E-mail")}</span><input name="email" type="email" autocomplete="email" maxlength="200" required></label></div>
          ${etat.attente === "erreur" ? `<p class="erreur">${tr("Le service est momentanément indisponible. Réessayez dans quelques minutes.")}</p>` : ""}
          <button type="submit" class="bouton"${etat.attente === "envoi" ? " disabled" : ""}>${tr(etat.attente === "envoi" ? "Envoi en cours…" : "Être prévenu")}</button></form></div>`;
    }
    zoneResultat.innerHTML = html;
  };

  const verifier = async () => {
    if (!etat.adresse) { resultat(); return; }
    const moi = ++jeton;
    etat.n = null; etat.attente = ""; resultat();
    const n = await secteurCouvert(etat.rubriqueId, etat.adresse.lat, etat.adresse.lon).catch(() => null);
    if (moi !== jeton) return;
    etat.n = n === null || n === undefined ? -1 : n;
    resultat();
  };

  const chargerSecteurs = async () => {
    const moi = ++jetonSecteurs;
    const s = await secteursPublics(etat.rubriqueId).catch(() => null);
    if (moi !== jetonSecteurs) return;
    etat.secteurs = s || [];
    dessiner(); resultat();
  };

  const placer = async a => {
    if (!a) { afficherToast("Adresse introuvable. Précisez la rue ou le code postal.", "erreur"); return; }
    etat.adresse = { lat: a.lat, lon: a.lon, texte: form.adresse.value.trim(), libelle: [a.rue, [a.codePostal, a.ville].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      codePostal: a.codePostal || "", ville: a.ville || "" };
    if (!form.adresse.value.trim()) form.adresse.value = etat.adresse.libelle;
    dessiner();
    await verifier();
  };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const q = form.adresse.value.trim();
    if (q.length < 3) { form.adresse.focus(); afficherToast("Saisissez une adresse ou une ville.", "info"); return; }
    await placer(await chercherAdresse(q));
  });
  form.rubrique.addEventListener("change", async () => {
    etat.rubriqueId = form.rubrique.value; etat.secteurs = null;
    await chargerSecteurs();
    await verifier();
  });
  form.querySelector("[data-position]").addEventListener("click", async () => {
    try {
      const p = await maPosition();
      const a = await adresseDe(p.lat, p.lon);
      form.adresse.value = "";
      await placer(a || { ...p, rue: "", codePostal: "", ville: "" });
    } catch (err) {
      afficherToast(err?.message === "refus" ? "Position refusée : saisissez votre adresse." : "Position indisponible : saisissez votre adresse.", "info");
    }
  });
  zoneResultat.addEventListener("click", e => { if (e.target.closest("[data-reessayer]")) verifier(); });
  zoneResultat.addEventListener("submit", async e => {
    const f = e.target.closest("[data-attente]");
    if (!f) return;
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) { f.email.focus(); afficherToast("Saisissez une adresse e-mail valide.", "erreur"); return; }
    const prenom = f.prenom.value.trim(), email = f.email.value.trim();
    etat.attente = "envoi"; resultat();
    try {
      await rejoindreAttente({ rubriqueId: etat.rubriqueId, codePostal: etat.adresse.codePostal, ville: etat.adresse.ville, lat: etat.adresse.lat, lon: etat.adresse.lon, prenom, email });
      etat.attente = "ok";
    } catch { etat.attente = "erreur"; }
    resultat();
  });

  resultat();
  dessiner();
  chargerSecteurs();
  traduire(racine);
}
