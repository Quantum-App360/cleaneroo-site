// Chiffres de l'aperçu de la page /cleaneur/ (lus par outils/generer_pages.py) : le MÊME calcul que la page « Devenir Cleaneur »
// (devenir-cleaneur.js : exempleCleaneur, gainCleaneur), mission test et mois de Pro offerts. Sortie JSON, aucun chiffre écrit à la main.
// Les modules du site sont faits pour le navigateur : la bibliothèque Supabase (chargée depuis internet) et le navigateur sont simulés.
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(s, c, suivant) {
    if (s.startsWith("https://")) return { url: "data:text/javascript," + encodeURIComponent("const p = new Proxy(function(){}, { get: (o, k) => k === 'then' ? undefined : p, apply: () => p }); export const createClient = () => p;"), shortCircuit: true };
    return suivant(s, c);
  }`));
const vide = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const classes = { toggle() {}, add() {}, remove() {}, contains: () => false };
Object.assign(globalThis, { localStorage: vide, sessionStorage: vide, addEventListener: () => {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
  location: { hash: "", search: "", origin: "https://cleaneroo.fr", pathname: "/" },
  document: { addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, documentElement: { lang: "fr", dataset: {} }, body: { classList: classes, dataset: {} }, createElement: () => ({ style: {}, classList: classes }) } });
globalThis.window = globalThis;
// Tout objet du navigateur non simulé ci-dessus : un objet « qui accepte tout », sans effet.
const faux = new Proxy(function () {}, { get: (o, k) => k === "then" ? undefined : k === Symbol.toPrimitive ? () => "" : faux, apply: () => faux, construct: () => faux });
for (const n of ["MutationObserver", "ResizeObserver", "IntersectionObserver", "requestAnimationFrame", "cancelAnimationFrame", "HTMLElement", "CustomEvent", "Event", "HashChangeEvent", "Image", "Audio", "AudioContext", "screen", "history", "fetch", "indexedDB", "caches", "speechSynthesis", "Notification"])
  if (!(n in globalThis)) globalThis[n] = faux;
try { Object.defineProperty(globalThis, "navigator", { value: { language: "fr-FR", languages: ["fr-FR"] }, configurable: true }); } catch { /* rien */ }
const { REGLES, euros, joursOffreLancement } = await import("../assets/js/regles.js");
const { exempleCleaneur } = await import("../assets/js/devenir-cleaneur.js");
const ex = exempleCleaneur();
const e = c => euros(c).replace(/[  ]/g, " ");
console.log(JSON.stringify({ prix: e(ex.prixC), duree: ex.dureeMin, horaireAvant: e(ex.pro.horaireAvantC), missionTest: e(REGLES.MISSION_TEST_C).replace(",00", ""), moisPro: REGLES.OFFRE_LANCEMENT_MOIS, offreOuverte: joursOffreLancement() > 0 }));
