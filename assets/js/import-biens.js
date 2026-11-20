// Import de tous ses logements en une fois (20 novembre 2026, demande de l'utilisateur) : une seule méthode pour toutes les conciergeries,
// quel que soit leur outil. N'importe quel tableau (Excel .xlsx, CSV, export d'un logiciel de gestion, copier-coller depuis Excel ou Google Sheets),
// colonnes reconnues quel que soit leur nom, aperçu vérifié, puis import en un clic ; un nouvel envoi met à jour sans créer de doublon.
// Onglet « Mon logiciel de gestion » : marche à suivre par logiciel et demande de connexion directe (connecteurs ouverts après le lancement).
import { synchroniserBiens, enregistrerBiens, demanderConnexionLogiciel, session } from "./donnees.js";
import { REGLES } from "./regles.js";
import { TYPES_LOGEMENT } from "./catalogue.js";
import { traduire, tr } from "./langue.js";
import { icone } from "./icones.js";
import { chargeur } from "./commun.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** Texte simplifié pour reconnaître une colonne : minuscules, sans accents ni ponctuation. */
const simple = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Champs d'un logement et noms de colonnes reconnus (français, anglais, exports des logiciels de gestion). */
export const CHAMPS = [
  { id: "ref", nom: "Référence", aide: "Identifiant du logement dans votre outil : sert à mettre à jour sans doublon", mots: ["reference", "ref", "id", "identifiant", "code", "listing id", "property id", "apartment id", "id logement", "numero"] },
  { id: "nom", nom: "Nom du logement", aide: "Ex. : Studio Vieux-Port", mots: ["nom", "name", "nom du logement", "logement", "bien", "titre", "title", "listing", "listing name", "property", "property name", "apartment", "annonce", "internal name", "nickname"] },
  { id: "rue", nom: "Adresse", aide: "Numéro et rue", obligatoire: true, mots: ["adresse", "address", "rue", "street", "adresse postale", "address line 1", "address1", "street address", "localisation", "location", "voie"] },
  { id: "complement", nom: "Complément d'adresse", aide: "Bâtiment, étage, porte", mots: ["complement", "complement d adresse", "address line 2", "address2", "batiment", "etage", "appartement numero", "porte"] },
  { id: "codePostal", nom: "Code postal", obligatoire: true, mots: ["code postal", "cp", "zip", "zip code", "postal code", "postcode"] },
  { id: "ville", nom: "Ville", obligatoire: true, mots: ["ville", "city", "commune", "localite", "town"] },
  { id: "type", nom: "Type", aide: "Studio, T2, appartement, maison…", mots: ["type", "type de logement", "typologie", "property type", "categorie", "category", "type de bien"] },
  { id: "surface", nom: "Surface (m²)", mots: ["surface", "superficie", "m2", "m²", "surface m2", "size", "area", "square meters", "sqm", "taille"] },
  { id: "chambres", nom: "Chambres", mots: ["chambres", "nb chambres", "nombre de chambres", "bedrooms", "rooms", "chambre", "nb ch", "ch"] },
  { id: "sdb", nom: "Salles de bain", mots: ["salles de bain", "salle de bain", "sdb", "nb sdb", "bathrooms", "baths", "bathroom"] },
  { id: "lits", nom: "Lits", mots: ["lits", "nb lits", "beds", "nombre de lits", "couchages"] },
  { id: "calAirbnb", nom: "Calendrier Airbnb (lien iCal)", mots: ["airbnb", "ical airbnb", "calendrier airbnb", "lien airbnb", "airbnb ical", "airbnb calendar"] },
  { id: "calBooking", nom: "Calendrier Booking (lien iCal)", mots: ["booking", "ical booking", "calendrier booking", "booking com", "booking ical", "booking calendar"] },
  { id: "calAutre", nom: "Autre calendrier (lien iCal)", mots: ["ical", "calendrier", "calendar", "lien ical", "ics", "ical url", "calendar url", "abritel", "vrbo", "export ical"] },
  { id: "acces", nom: "Accès", aide: "Boîte à clés, concierge, présent, autonome", mots: ["acces", "access", "check in", "arrivee", "type d acces", "remise des cles", "cles"] },
  { id: "boite", nom: "Emplacement de la boîte à clés", mots: ["boite a cles", "emplacement boite", "keybox", "key box", "lockbox", "emplacement"] },
  { id: "consignes", nom: "Consignes", aide: "Instructions pour le Cleaneur", mots: ["consignes", "instructions", "notes", "remarques", "commentaires", "commentaire", "note", "cleaning instructions"] },
  { id: "depart", nom: "Heure de départ habituelle", mots: ["heure de depart", "depart", "check out", "checkout", "check out time"] },
  { id: "arrivee", nom: "Heure d'arrivée habituelle", mots: ["heure d arrivee", "arrivee voyageurs", "check in time", "checkin time"] },
];
const IGNORER = "";

/* ------------------------------------------------------------------ Lecture des fichiers */

/** CSV ou texte collé : séparateur détecté (tabulation, point-virgule ou virgule), guillemets gérés. */
export function lireTexte(texte) {
  const t = String(texte || "").replace(/^﻿/, "");
  const premiere = t.split(/\r?\n/).find(l => l.trim()) || "";
  const sep = ["\t", ";", ","].map(s => [s, premiere.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const lignes = []; let ligne = [], champ = "", guillemets = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') { champ += '"'; i++; } else if (c === '"') guillemets = false; else champ += c;
    } else if (c === '"' && champ === "") guillemets = true;
    else if (c === sep) { ligne.push(champ); champ = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; }
    else champ += c;
  }
  if (champ !== "" || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes.map(l => l.map(x => x.trim())).filter(l => l.some(x => x));
}

/** Excel (.xlsx) sans bibliothèque : le fichier est une archive zip ; on lit la première feuille et les textes partagés. */
export async function lireXlsx(buffer) {
  const u8 = new Uint8Array(buffer), dv = new DataView(buffer);
  let fin = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error("format");
  const nb = dv.getUint16(fin + 10, true); let p = dv.getUint32(fin + 16, true);
  const fichiers = {};
  for (let k = 0; k < nb; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const methode = dv.getUint16(p + 10, true), taille = dv.getUint32(p + 20, true), lnom = dv.getUint16(p + 28, true),
      lext = dv.getUint16(p + 30, true), lcom = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
    const nom = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + lnom));
    fichiers[nom] = { methode, taille, local };
    p += 46 + lnom + lext + lcom;
  }
  const lire = async nom => {
    const f = fichiers[nom]; if (!f) return null;
    const debut = f.local + 30 + dv.getUint16(f.local + 26, true) + dv.getUint16(f.local + 28, true);
    const brut = u8.subarray(debut, debut + f.taille);
    if (f.methode === 0) return new TextDecoder().decode(brut);
    const flux = new Blob([brut]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(flux).text();
  };
  const xml = s => new DOMParser().parseFromString(s, "application/xml");
  const partages = [];
  const sst = await lire("xl/sharedStrings.xml");
  if (sst) xml(sst).querySelectorAll("si").forEach(si => partages.push([...si.querySelectorAll("t")].map(t => t.textContent).join("")));
  const feuille = Object.keys(fichiers).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))[0];
  if (!feuille) throw new Error("format");
  const doc = xml(await lire(feuille));
  const colonne = ref => { let n = 0; for (const ch of String(ref).replace(/\d+/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const lignes = [];
  doc.querySelectorAll("sheetData > row").forEach(r => {
    const l = [];
    r.querySelectorAll("c").forEach(c => {
      const t = c.getAttribute("t"), v = c.querySelector("v")?.textContent ?? "";
      const val = t === "s" ? partages[Number(v)] ?? "" : t === "inlineStr" ? [...c.querySelectorAll("is t")].map(x => x.textContent).join("") : v;
      l[colonne(c.getAttribute("r") || "A")] = String(val).trim();
    });
    lignes.push(Array.from(l, x => x ?? ""));
  });
  return lignes.filter(l => l.some(x => x));
}

/* ------------------------------------------------------------------ Reconnaissance des colonnes et conversion */

/** Pour chaque colonne de l'en-tête : le champ reconnu (ou "" = ignorée). Chaque champ n'est pris qu'une fois. */
export function reconnaitre(entetes, memoire = {}) {
  const pris = new Set();
  return entetes.map(h => {
    const s = simple(h);
    if (memoire[s] !== undefined && !pris.has(memoire[s])) { if (memoire[s]) pris.add(memoire[s]); return memoire[s]; }
    let trouve = CHAMPS.find(c => !pris.has(c.id) && c.mots.some(m => simple(m) === s));
    // Sinon : le mot-clé le plus long contenu dans le nom de colonne (« Emplacement boîte à clés » → boîte, pas accès).
    if (!trouve && s.length > 1) {
      let meilleur = 0;
      for (const c of CHAMPS) if (!pris.has(c.id)) for (const m of c.mots.map(simple)) {
        const n = m.length > 3 && (` ${s} `.includes(` ${m} `) || s.includes(m)) ? m.length : s.length > 3 && m.startsWith(s) ? s.length - 1 : 0;
        if (n > meilleur) { meilleur = n; trouve = c; }
      }
    }
    if (trouve) { pris.add(trouve.id); return trouve.id; }
    return IGNORER;
  });
}

const entier = v => { const n = parseInt(String(v || "").replace(",", "."), 10); return Number.isFinite(n) ? n : null; };
const heure = v => { const m = String(v || "").match(/(\d{1,2})\s*[h:]/i) || String(v || "").match(/^(\d{1,2})$/); const h = m ? Number(m[1]) : null; return h != null && h >= 0 && h <= 23 ? h : null; };
const lien = v => { const s = String(v || "").trim().replace(/^webcal:/i, "https:"); return /^https:\/\/\S+$/.test(s) ? s : ""; };

/** Type, chambres et niveaux d'après le texte « Type » (Studio, T2, F3, appartement, maison, villa, duplex…). */
function typeDepuis(texte, chambres) {
  const s = simple(texte);
  const t = s.match(/\b[tf]\s?(\d)\b/);
  if (/studio|t1 bis/.test(s) || (t && t[1] === "1")) return { typeLogementId: "studio", chambres: chambres ?? 0 };
  if (/maison|villa|house|pavillon|chalet|mas|bastide/.test(s)) return { typeLogementId: "maison", chambres: chambres ?? 3 };
  if (/duplex|loft|triplex/.test(s)) return { typeLogementId: "duplex", chambres: chambres ?? 2 };
  if (t) return { typeLogementId: "appartement", chambres: chambres ?? Math.max(1, Number(t[1]) - 1) };
  return { typeLogementId: chambres === 0 ? "studio" : "appartement", chambres: chambres ?? 1 };
}

const ACCES = s => /boite|key|lock|cle/.test(simple(s)) ? "BOITE" : /concierg|tiers|gardien|voisin/.test(simple(s)) ? "TIERS" : /autonom|digicode|serrure|smart|code/.test(simple(s)) ? "AUTONOME" : /present|accueil|main propre|moi/.test(simple(s)) ? "PRESENT" : "";

/** Une ligne du tableau → un logement Cleaneroo (sans id), et ce qui manque. */
export function ligneVersBien(ligne, colonnes, categorie = "logement") {
  const v = id => { const i = colonnes.indexOf(id); return i >= 0 ? String(ligne[i] ?? "").trim() : ""; };
  const ch = entier(v("chambres")), sdb = entier(v("sdb")), surf = entier(v("surface"));
  const base = { refExterne: v("ref"), nom: v("nom").slice(0, 60), rue: [v("rue"), v("complement")].filter(Boolean).join(", ").slice(0, 160),
    codePostal: v("codePostal").replace(/\D/g, "").padStart(v("codePostal") ? 5 : 0, "0").slice(0, 5), ville: v("ville").slice(0, 80) };
  let bien;
  if (categorie === "local") bien = { ...base, categorie: "local", typeLocal: "autre_local", ...(surf ? { surface: surf } : {}) };
  else {
    const t = typeDepuis(v("type"), ch), modele = TYPES_LOGEMENT.find(x => x.id === t.typeLogementId);
    bien = { ...base, typeLogementId: t.typeLogementId, chambres: t.chambres, sdb: sdb ?? modele.sdb, surface: surf || modele.surface, niveaux: modele.niveaux,
      ...(entier(v("lits")) ? { lits: entier(v("lits")) } : {}) };
  }
  const calendriers = [["airbnb", lien(v("calAirbnb"))], ["booking", lien(v("calBooking"))], ["autre", lien(v("calAutre"))]].filter(([, u]) => u).map(([source, url]) => ({ source, url }));
  if (calendriers.length) bien.calendriers = calendriers;
  const acces = ACCES(v("acces"));
  bien.accueil = acces || (v("boite") ? "BOITE" : "PRESENT");
  if (v("boite")) bien.boiteEmplacement = v("boite").slice(0, 160);
  if (v("consignes")) bien.consignes = v("consignes").slice(0, 600);
  if (heure(v("depart")) != null) bien.departVoyageursH = heure(v("depart"));
  if (heure(v("arrivee")) != null) bien.arriveeSuivanteH = heure(v("arrivee"));
  const manque = [!bien.rue && "adresse", !/^\d{5}$/.test(bien.codePostal) && "code postal", !bien.ville && "ville"].filter(Boolean);
  const liensFaux = ["calAirbnb", "calBooking", "calAutre"].filter(id => v(id) && !lien(v(id))).length;
  return { bien, manque, liensFaux };
}

/** Clé de rapprochement avec un logement déjà enregistré : référence, sinon adresse + code postal. */
const cleRef = b => b.refExterne ? `ref:${simple(b.refExterne)}` : "";
const cleAdresse = b => `adr:${simple(b.rue)}|${b.codePostal}`;

/** Aperçu : chaque ligne avec son état (nouveau, mise à jour, doublon dans le fichier, à compléter). */
export function apercu(lignes, colonnes, existants, categorie = "logement") {
  const parRef = new Map(existants.filter(b => b.refExterne).map(b => [cleRef(b), b])), parAdr = new Map(existants.map(b => [cleAdresse(b), b]));
  const vus = new Set();
  return lignes.map((l, i) => {
    const { bien, manque, liensFaux } = ligneVersBien(l, colonnes, categorie);
    const k = cleRef(bien) || cleAdresse(bien);
    const existant = (cleRef(bien) && parRef.get(cleRef(bien))) || parAdr.get(cleAdresse(bien));
    const etat = manque.length ? "incomplet" : vus.has(k) ? "doublon" : existant ? "maj" : "nouveau";
    vus.add(k);
    return { n: i + 2, bien: existant ? { ...existant, ...bien, id: existant.id, calendriers: bien.calendriers || existant.calendriers } : bien, etat, manque, liensFaux };
  });
}

/* ------------------------------------------------------------------ Modèle à télécharger */
const MODELE = [
  ["Référence", "Nom du logement", "Adresse", "Code postal", "Ville", "Type", "Surface (m²)", "Chambres", "Salles de bain", "Lits", "Calendrier Airbnb", "Calendrier Booking", "Accès", "Emplacement boîte à clés", "Consignes", "Heure de départ", "Heure d'arrivée"],
  ["A12", "Studio Port-Fréjus", "12 quai Marc-Antoine", "83600", "Fréjus", "Studio", "25", "0", "1", "1", "https://www.airbnb.fr/calendar/ical/123.ics?s=…", "", "Boîte à clés", "Grille du portail, à gauche", "Linge dans le placard de l'entrée", "10 h", "16 h"],
  ["B07", "T3 vue mer", "4 boulevard de la Plage", "83700", "Saint-Raphaël", "T3", "62", "2", "1", "3", "", "https://admin.booking.com/hotel/hoteladmin/ical.html?t=…", "Concierge", "", "", "11 h", "17 h"],
];
const csv = lignes => "﻿" + lignes.map(l => l.map(x => /[;"\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x).join(";")).join("\r\n");

/* ------------------------------------------------------------------ Logiciels de gestion (vérifié le 20 novembre 2026) */
export const LOGICIELS = [
  { id: "smoobu", nom: "Smoobu", etapes: ["Dans Smoobu, ouvrez Avancé, puis Clés API.", "Cliquez sur « Créer » : une clé et son secret s'affichent une seule fois.", "Gardez-les : nous vous les demanderons par un canal sécurisé au moment de la connexion."],
    attention: "La création de clé est désactivée pendant l'essai gratuit de Smoobu ; une clé inutilisée 90 jours est désactivée." },
  { id: "hostaway", nom: "Hostaway", etapes: ["Dans Hostaway, ouvrez Paramètres, puis Hostaway API.", "Créez une clé API et notez votre numéro de compte (Account ID), affiché dans les paramètres.", "La clé n'est affichée qu'une fois : gardez-la en lieu sûr."],
    attention: "L'accès est valable au plus 24 mois, puis il se renouvelle." },
  { id: "lodgify", nom: "Lodgify", etapes: ["Dans Lodgify, ouvrez Paramètres, puis Public API.", "Copiez la clé affichée (une seule clé par compte)."],
    attention: "Selon les offres Lodgify, l'accès à l'API peut ne pas être inclus : vérifiez-le dans votre abonnement." },
  { id: "beds24", nom: "Beds24", etapes: ["Dans Beds24, ouvrez Paramètres, puis Apps & Integrations, puis API.", "Générez un code d'invitation."],
    attention: "Les mises à jour en temps réel des réservations sont à activer par le support Beds24." },
  { id: "guesty", nom: "Guesty", etapes: ["Indiquez-nous que vous utilisez Guesty : nous étudions la connexion."], attention: "" },
  { id: "autre", nom: "Autre logiciel", etapes: ["Indiquez son nom : nous vous recontactons."], attention: "" },
];

/* ------------------------------------------------------------------ Page */
let etat = { onglet: "tableau", lignes: null, entetes: [], colonnes: [], categorie: "logement", existants: [], resultat: null, fichier: "" };
const CLE_MEMOIRE = "cleaneroo-import-colonnes";
const memoire = () => { try { return JSON.parse(localStorage.getItem(CLE_MEMOIRE) || "{}"); } catch { return {}; } };
const memoriser = () => { try { const m = memoire(); etat.entetes.forEach((h, i) => { m[simple(h)] = etat.colonnes[i]; }); localStorage.setItem(CLE_MEMOIRE, JSON.stringify(m)); } catch { /* rien */ } };

export async function pageImportBiens(vue, onglet = "") {
  etat = { ...etat, onglet: onglet === "logiciel" ? "logiciel" : "tableau", lignes: null, resultat: null };
  vue.innerHTML = `<section class="section"><div class="conteneur etroit">${chargeur("Chargement de vos logements…")}</div></section>`;
  etat.existants = await synchroniserBiens().catch(() => []);
  rendre(vue);
}

function rendre(vue) {
  const o = etat.onglet;
  vue.innerHTML = `<section class="section import-biens"><div class="conteneur etroit">
    <a class="lien-retour" href="#/compte/pro">‹ ${tr("Mon espace")}</a>
    <h1>${tr("Importer tous vos logements")}</h1>
    <p class="muet">${tr("Vous gérez des dizaines ou des centaines de logements ? Ne les saisissez pas un par un : importez-les en une fois depuis un tableau, ou reliez votre logiciel de gestion.")}</p>
    <div class="segments deux" role="tablist" style="margin:18px 0">
      <button type="button" role="tab" data-onglet-import="tableau" class="${o === "tableau" ? "choisi" : ""}">${tr("Depuis un tableau")}</button>
      <button type="button" role="tab" data-onglet-import="logiciel" class="${o === "logiciel" ? "choisi" : ""}">${tr("Depuis mon logiciel de gestion")}</button></div>
    <div id="contenu-import">${o === "tableau" ? ongletTableau() : ongletLogiciel()}</div>
  </div></section>`;
  stylesImport();
  traduire(vue);
  vue.querySelectorAll("[data-onglet-import]").forEach(b => b.onclick = () => { etat.onglet = b.dataset.ongletImport; rendre(vue); });
  if (o === "tableau") brancherTableau(vue); else brancherLogiciel(vue);
}

function ongletTableau() {
  if (etat.resultat) return resultatImport();
  if (etat.lignes) return ecranApercu();
  return `<ol class="etapes-import">
      <li><b>${tr("Préparez votre tableau.")}</b> ${tr("Une ligne par logement. Le plus simple : l'export de votre logiciel de gestion ou votre fichier Excel habituel. Aucun modèle n'est imposé : Cleaneroo reconnaît les colonnes.")}</li>
      <li><b>${tr("Déposez-le ou collez-le.")}</b> ${tr("Excel (.xlsx), CSV, ou un copier-coller depuis Excel ou Google Sheets (sélectionnez les lignes avec l'en-tête, Ctrl+C, puis Ctrl+V ci-dessous).")}</li>
      <li><b>${tr("Vérifiez l'aperçu.")}</b> ${tr("Chaque colonne est associée à un champ ; corrigez celles qui ne sont pas reconnues. Les lignes incomplètes et les doublons sont signalés.")}</li>
      <li><b>${tr("Importez.")}</b> ${tr("Vos logements apparaissent dans votre espace, avec leur agenda si la colonne « calendrier » est remplie. Un nouvel envoi met à jour sans créer de doublon.")}</li></ol>
    <div class="carte zone-depot" id="zone-depot" tabindex="0">
      ${icone("logement", { tuile: true })}
      <b>${tr("Déposez votre fichier ici")}</b><span class="petit">${tr("ou")}</span>
      <label class="bouton secondaire">${tr("Choisir un fichier")}<input type="file" id="fichier-import" accept=".xlsx,.csv,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label>
      <span class="petit">${tr("Excel (.xlsx) ou CSV · jusqu'à")} ${REGLES.BIENS_MAX} ${tr("logements")}</span></div>
    <details class="carte"><summary><b>${tr("Ou collez vos lignes")}</b></summary>
      <textarea id="collage-import" rows="6" style="width:100%;margin-top:10px" placeholder="${esc(tr("Collez ici les lignes copiées depuis Excel ou Google Sheets, en-tête compris"))}"></textarea>
      <button type="button" class="bouton plein" id="lire-collage" style="margin-top:8px">${tr("Lire les lignes collées")}</button></details>
    <p class="erreur" id="erreur-import"></p>
    <details class="carte"><summary><b>${tr("Quelles colonnes sont reconnues ?")}</b></summary>
      <p class="petit">${tr("Seules l'adresse, le code postal et la ville sont obligatoires. Les noms de colonnes peuvent être en français ou en anglais : « Adresse », « Address », « Rue »… sont tous reconnus.")}</p>
      <table class="tableau-simple"><thead><tr><th>${tr("Champ")}</th><th>${tr("Exemples de noms de colonne")}</th></tr></thead><tbody>
      ${CHAMPS.map(c => `<tr><td><b>${esc(tr(c.nom))}</b>${c.obligatoire ? ` <span class="tampon">${tr("obligatoire")}</span>` : ""}${c.aide ? `<div class="petit">${esc(tr(c.aide))}</div>` : ""}</td><td class="petit">${esc(c.mots.slice(0, 5).join(", "))}</td></tr>`).join("")}
      </tbody></table>
      <button type="button" class="bouton secondaire" id="modele-import" style="margin-top:10px">${tr("Télécharger un modèle (CSV, s'ouvre dans Excel)")}</button></details>
    <details class="carte"><summary><b>${tr("Où trouver le lien de calendrier (iCal) de chaque logement ?")}</b></summary>
      <p class="petit"><b>Airbnb</b> : ${tr("Annonces › votre annonce › Disponibilités › Synchroniser les calendriers › Exporter le calendrier.")}</p>
      <p class="petit"><b>Booking.com</b> : ${tr("Extranet › Tarifs et disponibilités › Synchronisation des calendriers › Exporter le calendrier.")}</p>
      <p class="petit">${tr("Logiciel de gestion (Smoobu, Lodgify, Beds24…) : chaque logement a aussi un lien d'export iCal. Il ne donne que les dates, jamais les coordonnées des voyageurs.")}</p></details>`;
}

function ecranApercu() {
  const ap = apercu(etat.lignes, etat.colonnes, etat.existants, etat.categorie);
  const compte = k => ap.filter(x => x.etat === k).length;
  const aImporter = ap.filter(x => x.etat === "nouveau" || x.etat === "maj");
  const total = etat.existants.length + compte("nouveau");
  const trop = total > REGLES.BIENS_MAX;
  const manquants = CHAMPS.filter(c => c.obligatoire && !etat.colonnes.includes(c.id));
  const LIB = { nouveau: ["Nouveau", "vert"], maj: ["Mise à jour", ""], doublon: ["Doublon dans le fichier", "alerte"], incomplet: ["À compléter", "alerte"] };
  return `<div class="carte">
      <b>${esc(etat.fichier || tr("Lignes collées"))}</b> · ${etat.lignes.length} ${tr("lignes")}
      <div class="segments deux" style="margin:12px 0 0">${[["logement", "Ce sont des logements"], ["local", "Ce sont des locaux (bureaux, commerces…)"]].map(([id, nom]) =>
        `<button type="button" data-categorie-import="${id}" class="${etat.categorie === id ? "choisi" : ""}">${tr(nom)}</button>`).join("")}</div></div>
    <h2 class="titre-section">${tr("1. Vos colonnes")}</h2>
    <p class="petit" style="margin-top:0">${tr("Cleaneroo a reconnu les colonnes ci-dessous. Corrigez celles qui ne sont pas justes : votre choix est mémorisé pour votre prochain import.")}</p>
    <div class="carte colonnes-import">${etat.entetes.map((h, i) => `<label class="champ"><span>${esc(h || `${tr("Colonne")} ${i + 1}`)} <small class="petit">${esc(String(etat.lignes[0]?.[i] ?? "").slice(0, 40))}</small></span>
      <select data-colonne="${i}"><option value="">${tr("— Ignorer cette colonne —")}</option>${CHAMPS.map(c => `<option value="${c.id}" ${etat.colonnes[i] === c.id ? "selected" : ""}>${esc(tr(c.nom))}</option>`).join("")}</select></label>`).join("")}</div>
    ${manquants.length ? `<p class="note alerte">${tr("Colonne obligatoire non trouvée :")} ${manquants.map(c => esc(tr(c.nom))).join(", ")}. ${tr("Choisissez-la dans la liste ci-dessus.")}</p>` : ""}
    <h2 class="titre-section">${tr("2. Vérification")}</h2>
    <div class="tuiles-chiffres"><div class="tuile-chiffre succes"><b>${compte("nouveau")}</b><span>${tr("Nouveaux")}</span></div>
      <div class="tuile-chiffre"><b>${compte("maj")}</b><span>${tr("Mises à jour")}</span></div>
      <div class="tuile-chiffre alerte"><b>${compte("incomplet") + compte("doublon")}</b><span>${tr("Ignorés (à compléter ou doublons)")}</span></div></div>
    <div class="defile-import"><table class="tableau-simple"><thead><tr><th>${tr("Ligne")}</th><th>${tr("État")}</th><th>${tr("Logement")}</th><th>${tr("Adresse")}</th><th>${tr("Calendrier")}</th></tr></thead><tbody>
      ${ap.slice(0, 300).map(x => `<tr class="${x.etat}"><td>${x.n}</td><td><span class="tampon ${LIB[x.etat][1]}">${tr(LIB[x.etat][0])}</span>${x.manque.length ? `<div class="petit">${tr("Manque :")} ${x.manque.map(m => tr(m)).join(", ")}</div>` : ""}</td>
        <td>${esc(x.bien.nom || "—")}${x.bien.chambres != null && etat.categorie === "logement" ? `<div class="petit">${x.bien.chambres} ch. · ${x.bien.surface || "?"} m²</div>` : ""}</td>
        <td>${esc(x.bien.rue)}<div class="petit">${esc(x.bien.codePostal)} ${esc(x.bien.ville)}</div></td>
        <td>${(x.bien.calendriers || []).length ? `✓ ${(x.bien.calendriers || []).length}` : "—"}${x.liensFaux ? `<div class="petit erreur">${tr("lien non reconnu")}</div>` : ""}</td></tr>`).join("")}
    </tbody></table>${ap.length > 300 ? `<p class="petit">${tr("Aperçu limité aux 300 premières lignes ; toutes seront importées.")}</p>` : ""}</div>
    ${trop ? `<p class="note alerte">${tr("Un compte peut gérer au plus")} ${REGLES.BIENS_MAX} ${tr("biens : contactez-nous pour aller au-delà.")}</p>` : ""}
    <div class="boutons" style="margin-top:16px"><button type="button" class="bouton plein" id="importer" ${!aImporter.length || manquants.length || trop ? "disabled" : ""}>${tr("Importer")} ${aImporter.length} ${tr(aImporter.length > 1 ? "logements" : "logement")}</button>
      <button type="button" class="bouton secondaire" id="recommencer">${tr("Choisir un autre fichier")}</button></div>
    <p class="erreur" id="erreur-import"></p>`;
}

function resultatImport() {
  const r = etat.resultat;
  return `<div class="carte teintee">${icone("termine", { tuile: true })}
    <h2 style="margin:8px 0">${r.ok} ${tr(r.ok > 1 ? "logements importés" : "logement importé")}</h2>
    <p>${r.nouveaux} ${tr("nouveaux")} · ${r.majs} ${tr("mis à jour")}${r.calendriers ? ` · ${r.calendriers} ${tr("reliés à un calendrier")}` : ""}</p>
    ${r.erreur ? `<p class="erreur">${esc(r.erreur)}</p>` : ""}
    ${r.horsLigne ? `<p class="petit">${tr("Vous n'êtes pas connecté : les logements sont enregistrés sur cet appareil et rejoindront votre compte à la connexion.")}</p>` : ""}
    <div class="boutons"><a class="bouton plein" href="#/compte/pro">${tr("Voir mon espace")}</a><button type="button" class="bouton secondaire" id="recommencer">${tr("Importer un autre tableau")}</button></div></div>`;
}

function chargerLignes(vue, lignes, nom) {
  const err = vue.querySelector("#erreur-import");
  if (!lignes || lignes.length < 2) { if (err) err.textContent = tr("Le tableau doit contenir une ligne d'en-tête et au moins un logement."); return; }
  etat.entetes = lignes[0].map(h => String(h || ""));
  etat.lignes = lignes.slice(1).filter(l => l.some(x => String(x || "").trim()));
  etat.colonnes = reconnaitre(etat.entetes, memoire());
  etat.fichier = nom;
  rendre(vue);
}

function brancherTableau(vue) {
  const err = vue.querySelector("#erreur-import");
  const lireFichier = async f => {
    if (!f) return;
    try {
      if (/\.xlsx$/i.test(f.name)) chargerLignes(vue, await lireXlsx(await f.arrayBuffer()), f.name);
      else if (/\.(xls|ods|numbers)$/i.test(f.name)) err.textContent = tr("Ce format n'est pas lu directement : dans votre tableur, faites « Enregistrer sous » Excel (.xlsx) ou CSV, ou copiez-collez les lignes.");
      else chargerLignes(vue, lireTexte(await f.text()), f.name);
    } catch { err.textContent = tr("Ce fichier n'a pas pu être lu. Enregistrez-le en Excel (.xlsx) ou en CSV, ou copiez-collez les lignes."); }
  };
  const champ = vue.querySelector("#fichier-import");
  if (champ) champ.onchange = () => lireFichier(champ.files[0]);
  const zone = vue.querySelector("#zone-depot");
  if (zone) {
    zone.ondragover = e => { e.preventDefault(); zone.classList.add("survol"); };
    zone.ondragleave = () => zone.classList.remove("survol");
    zone.ondrop = e => { e.preventDefault(); zone.classList.remove("survol"); lireFichier(e.dataTransfer.files[0]); };
  }
  const lc = vue.querySelector("#lire-collage");
  if (lc) lc.onclick = () => chargerLignes(vue, lireTexte(vue.querySelector("#collage-import").value), "");
  const modele = vue.querySelector("#modele-import");
  if (modele) modele.onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv(MODELE)], { type: "text/csv;charset=utf-8" }));
    a.download = "modele-logements-cleaneroo.csv"; document.body.appendChild(a); a.click(); a.remove();
  };
  vue.querySelectorAll("[data-colonne]").forEach(s => s.onchange = () => {
    const i = Number(s.dataset.colonne);
    if (s.value) etat.colonnes = etat.colonnes.map((c, j) => (j !== i && c === s.value ? "" : c));
    etat.colonnes[i] = s.value; rendre(vue);
  });
  vue.querySelectorAll("[data-categorie-import]").forEach(b => b.onclick = () => { etat.categorie = b.dataset.categorieImport; rendre(vue); });
  vue.querySelectorAll("#recommencer").forEach(b => b.onclick = () => { etat.lignes = null; etat.resultat = null; rendre(vue); });
  const imp = vue.querySelector("#importer");
  if (imp) imp.onclick = async () => {
    imp.disabled = true; imp.textContent = tr("Import en cours…");
    memoriser();
    const ap = apercu(etat.lignes, etat.colonnes, etat.existants, etat.categorie).filter(x => x.etat === "nouveau" || x.etat === "maj");
    const t = Date.now();
    const biens = ap.map((x, i) => ({ ...x.bien, id: x.bien.id || `l${t}${String(i).padStart(4, "0")}`, importeLe: new Date().toISOString() }));
    const res = await enregistrerBiens(biens).catch(e => ({ erreur: e.message }));
    etat.resultat = { ok: res.erreur ? 0 : biens.length, nouveaux: ap.filter(x => x.etat === "nouveau").length, majs: ap.filter(x => x.etat === "maj").length,
      calendriers: biens.filter(b => (b.calendriers || []).length).length, horsLigne: !!res.horsLigne,
      erreur: res.erreur ? tr("L'enregistrement n'a pas abouti. Réessayez dans quelques minutes.") : "" };
    etat.existants = await synchroniserBiens().catch(() => etat.existants);
    rendre(vue);
  };
}

function ongletLogiciel() {
  return `<div class="carte teintee"><b style="color:var(--primaire)">${tr("Connexion directe : vos logements et vos réservations arrivent tout seuls")}</b>
      <p class="petit" style="margin:6px 0 0">${tr("Vous reliez une fois votre logiciel de gestion à Cleaneroo. Les nouveaux logements et les réservations sont ensuite synchronisés automatiquement : plus de fichier à refaire. Cleaneroo ne lit que vos logements et les dates de séjour.")}</p></div>
    <ol class="etapes-import">
      <li><b>${tr("Choisissez votre logiciel")}</b> ${tr("et suivez sa marche à suivre ci-dessous pour préparer votre accès.")}</li>
      <li><b>${tr("Envoyez votre demande de connexion.")}</b> ${tr("Nous vous recontactons pour l'activer avec vous. Votre clé d'accès vous sera demandée à ce moment-là, par un canal sécurisé : ne l'envoyez jamais par e-mail ni dans ce formulaire.")}</li>
      <li><b>${tr("En attendant,")}</b> ${tr("importez vos logements depuis l'export de votre logiciel (onglet « Depuis un tableau ») : rien ne sera en double après la connexion.")}</li></ol>
    <div class="grille-logiciels">${LOGICIELS.map(l => `<details class="carte logiciel" data-logiciel="${l.id}"><summary><b>${esc(l.nom)}</b></summary>
      <ol class="petit">${l.etapes.map(e => `<li>${esc(tr(e))}</li>`).join("")}</ol>${l.attention ? `<p class="note">${esc(tr(l.attention))}</p>` : ""}</details>`).join("")}</div>
    <h2 class="titre-section">${tr("Demander la connexion")}</h2>
    <form class="carte" id="form-connexion" novalidate>
      <label class="champ">${tr("Votre logiciel de gestion")}<select name="logiciel">${LOGICIELS.map(l => `<option value="${l.id}">${esc(l.nom)}</option>`).join("")}</select></label>
      <label class="champ" data-autre style="display:none">${tr("Nom du logiciel")}<input name="autre" maxlength="60"></label>
      <label class="champ">${tr("Nombre de logements")}<input name="logements" type="number" inputmode="numeric" min="1" max="100000" value="${Math.max(1, etat.existants.length)}"></label>
      <label class="champ">${tr("Téléphone pour vous rappeler")}<input name="telephone" type="tel" maxlength="20" autocomplete="tel"></label>
      <label class="champ">${tr("Un message ? (facultatif)")}<textarea name="message" rows="3" maxlength="500"></textarea></label>
      <p class="petit">${tr("Grand compte (plus de 100 logements) : essai gratuit de")} ${REGLES.ESSAI_GRAND_COMPTE_JOURS} ${tr("jours sur")} ${REGLES.ESSAI_GRAND_COMPTE_LOGEMENTS} ${tr("logements, interlocuteur dédié et connexion incluse dans l'abonnement.")}</p>
      <p class="erreur" id="erreur-connexion"></p>
      <button class="bouton plein" type="submit">${tr("Envoyer ma demande de connexion")}</button></form>`;
}

function brancherLogiciel(vue) {
  const f = vue.querySelector("#form-connexion");
  if (!f) return;
  f.logiciel.onchange = () => { vue.querySelector("[data-autre]").style.display = f.logiciel.value === "autre" ? "" : "none"; vue.querySelector(`[data-logiciel="${f.logiciel.value}"]`)?.setAttribute("open", ""); };
  f.onsubmit = async e => {
    e.preventDefault();
    const err = vue.querySelector("#erreur-connexion");
    if (/(sk_|api[_-]?key|secret|token)\S{6,}/i.test(f.message.value)) { err.textContent = tr("N'indiquez pas de clé d'accès ici : elle vous sera demandée par un canal sécurisé."); return; }
    if (!(await session().catch(() => null))) { err.textContent = tr("Connectez-vous à votre espace pour envoyer la demande."); return; }
    try {
      await demanderConnexionLogiciel({ logiciel: f.logiciel.value === "autre" ? `autre:${f.autre.value.trim()}` : f.logiciel.value,
        logements: Math.max(1, Number(f.logements.value) || 1), telephone: f.telephone.value.trim(), message: f.message.value.trim() });
      f.outerHTML = `<div class="carte teintee">${icone("termine", { tuile: true })}<b>${tr("Demande envoyée")}</b><p class="petit">${tr("Nous vous recontactons pour activer la connexion. En attendant, vous pouvez importer vos logements depuis un tableau.")}</p></div>`;
      traduire(vue);
    } catch { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
  };
}

function stylesImport() {
  if (document.getElementById("styles-import-biens")) return;
  const s = document.createElement("style"); s.id = "styles-import-biens";
  s.textContent = `.import-biens .etapes-import{padding-left:20px;margin:0 0 16px}.import-biens .etapes-import li{margin:6px 0}
    .zone-depot{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;border:2px dashed var(--separateur);margin-bottom:12px}
    .zone-depot.survol{border-color:var(--primaire);background:color-mix(in srgb,var(--primaire) 8%,var(--surface))}
    .colonnes-import{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px 14px}
    .defile-import{overflow-x:auto;max-height:480px;overflow-y:auto}.defile-import tr.incomplet td,.defile-import tr.doublon td{opacity:.7}
    .grille-logiciels{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}.grille-logiciels details.carte{margin:0}
    .tampon.vert{background:color-mix(in srgb,var(--succes,#1f8a5b) 15%,transparent)}.tampon.alerte{background:color-mix(in srgb,var(--alerte,#c0392b) 15%,transparent)}`;
  document.head.appendChild(s);
}
