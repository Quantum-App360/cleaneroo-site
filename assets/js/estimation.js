// Calcul de l'estimation : copie EXACTE de Estimation.kt (§ 8 du cahier des charges), dans le même ordre.
import { REGLES, duree } from "./regles.js";
import { minutesEtapesLocation, PACK_ETAPES_CONSEILLE, PACK_CONSOMMABLES_CONSEILLE } from "./catalogue.js";
import { rubrique, formulesPour, TYPES_LIEU, RUBRIQUES_CREDIT_IMPOT, TYPES_VITRES_ELIGIBLES, prixLigne, minutesLigne, libelleLigne,
  arrondiEuro, tachesPour, tacheChiffree, packsPour, remisePack } from "./catalogue.js";

export const SALISSURE = {
  LEGER: { libelle: "Léger", tempsPct: -10, prixPct: 0 },
  NORMAL: { libelle: "Normal", tempsPct: 0, prixPct: 0 },
  MARQUE: { libelle: "Marqué", tempsPct: 20, prixPct: 15 },
  INTENSE: { libelle: "Intense", tempsPct: 40, prixPct: 30 },
};

export const arrondiQuartSup = min => Math.ceil(min / REGLES.ARRONDI_DUREE_MIN - 1e-9) * REGLES.ARRONDI_DUREE_MIN;
const pct = (base, p) => Math.round(base * p / 100);

/** Valeurs par défaut de EstimationEntree (Kotlin). */
const ENTREE_DEFAUT = {
  surfaceM2: 0, m2ParHeure: 0, minimumMin: 0, coefTemps: 1.0, coefPrix: 1.0, dureeBaseImposeeMin: 0,
  niveauxSupplementaires: 0, minutesEtapesLocation: 0, consommablesAControler: false, salissure: "NORMAL",
  taches: [], remisePackPct: 0, remisePackC: null, tachesPersonnalisees: 0, dimanche: false, creneauMalin: false,
  engagementMois: 0, espacePersonnel: true, typeLieuId: "", panier: [],
};

export function calculer(entree) {
  const e = { ...ENTREE_DEFAUT, ...entree };
  const r = rubrique(e.rubriqueId);
  const taux = r.tauxHoraireC ?? 0;
  const vehicule = e.rubriqueId === "car";
  const forfait = e.rubriqueId === "textiles";
  const panier = e.panier || [];
  const lignes = [];
  const sal = SALISSURE[e.salissure || "NORMAL"];

  // 1. Temps de base (textiles : somme des éléments du panier, pour le planning seulement)
  let dureeBase = 0;
  if (forfait) {
    dureeBase = arrondiQuartSup(Math.max(REGLES.DUREE_MIN_TEXTILES_MIN, panier.reduce((s, l) => s + minutesLigne(l), 0)));
  } else if (!vehicule) {
    let t = e.dureeBaseImposeeMin > 0 ? e.dureeBaseImposeeMin
      : e.m2ParHeure > 0 ? Math.max(e.minimumMin, e.surfaceM2 * 60 / e.m2ParHeure) : e.minimumMin;
    t *= e.coefTemps;
    if (r.salissureSurTemps) t *= (100 + sal.tempsPct) / 100;
    t += (e.niveauxSupplementaires || 0) * REGLES.DUREE_PAR_NIVEAU_SUPP_MIN;
    if (e.rubriqueId === "rental") {
      t += e.minutesEtapesLocation || 0;
      if (e.consommablesAControler) t += REGLES.CONSOMMABLES_MIN;
    }
    dureeBase = arrondiQuartSup(t);
  }

  // 2. Prix de base (textiles : une ligne par élément du panier, au prix forfaitaire)
  const prixBase = vehicule ? 0 : forfait ? panier.reduce((s, l) => s + prixLigne(l), 0) : Math.round(taux * dureeBase / 60);
  if (forfait) panier.forEach(l => lignes.push({ libelle: libelleLigne(l), montantC: prixLigne(l) }));
  else if (!vehicule) lignes.push({ libelle: `${r.nom} · ${duree(dureeBase)}`, montantC: prixBase });

  // 3. Salissure en prix
  let sousTotal = prixBase;
  if (!r.salissureSurTemps && sal.prixPct !== 0 && !vehicule) {
    const s = pct(prixBase, sal.prixPct);
    lignes.push({ libelle: `Salissure ${sal.libelle.toLowerCase()} (+${sal.prixPct} %)`, montantC: s });
    sousTotal += s;
  }

  // 4. Tâches / options
  const taches = e.taches || [];
  // Prix d'une tâche arrondi à l'euro (le prorata de surface est déjà appliqué par entreeEstimation).
  const prixTache = t => (e.coefPrix === 1 ? t.prixC : arrondiEuro(t.prixC * e.coefPrix));
  const tachesC = taches.reduce((s, t) => s + prixTache(t), 0);
  const tachesMin = taches.reduce((s, t) => s + t.minutes, 0);
  taches.forEach(t => lignes.push({ libelle: t.nom, montantC: prixTache(t) }));
  sousTotal += tachesC;

  // 5. Remise de pack (sur le prix des tâches du pack, arrondie à l'euro)
  if (e.remisePackPct > 0) {
    const rem = e.remisePackC ?? arrondiEuro(tachesC * e.remisePackPct / 100);
    lignes.push({ libelle: `Remise pack (−${e.remisePackPct} %)`, montantC: -rem });
    sousTotal -= rem;
  }

  // 6. Tâches particulières (15 min chacune au taux horaire)
  const persoMin = (e.tachesPersonnalisees || 0) * REGLES.TACHE_PERSO_MIN;
  if (e.tachesPersonnalisees > 0) {
    const c = Math.round(taux * persoMin / 60);
    lignes.push({ libelle: `Tâches particulières (${e.tachesPersonnalisees})`, montantC: c, note: "à confirmer" });
    sousTotal += c;
  }

  // 7. Déplacement (inclus jusqu'à 15 km)
  lignes.push({ libelle: "Déplacement", montantC: 0, note: "inclus" });

  // 8. Majoration dimanche
  let total = sousTotal;
  if (e.dimanche) {
    const d = pct(sousTotal, REGLES.MAJORATION_DIMANCHE_PCT);
    lignes.push({ libelle: `Majoration dimanche (+${REGLES.MAJORATION_DIMANCHE_PCT} %)`, montantC: d });
    total += d;
  }
  // 9. Créneau malin
  if (e.creneauMalin) {
    const m = pct(sousTotal, REGLES.CRENEAU_MALIN_PCT);
    lignes.push({ libelle: `Créneau malin (−${REGLES.CRENEAU_MALIN_PCT} %)`, montantC: -m });
    total -= m;
  }
  // 10. Engagement
  const engPct = REGLES.ENGAGEMENT_PCT[e.engagementMois] ?? 0;
  if (engPct > 0) {
    const g = pct(total, engPct);
    lignes.push({ libelle: `Engagement ${e.engagementMois} mois (−${engPct} %)`, montantC: -g });
    total -= g;
  }
  // 11. Minimum de commande (véhicules, textiles) ou par ménage (location saisonnière)
  const min = minimumC(e.rubriqueId);
  if (min != null) {
    const c = complementMinimum(total, min);
    if (c > 0) { lignes.push({ libelle: e.rubriqueId === "rental" ? "Complément minimum par ménage" : "Complément minimum de commande", montantC: c }); total += c; }
  }

  const dureeTotale = dureeBase + tachesMin + persoMin;
  const deux = dureeTotale > REGLES.SEUIL_DEUX_CLEANEURS_MIN;
  const devis = r.toujoursSurDevis || e.surfaceM2 > REGLES.SEUIL_DEVIS_SURFACE_M2;
  const credit = eligibleCreditImpot(e.rubriqueId, e.espacePersonnel, e.typeLieuId)
    ? Math.min(pct(total, REGLES.CREDIT_IMPOT_PCT), REGLES.CREDIT_IMPOT_PLAFOND_C / 2) : 0;

  return {
    lignes, totalC: total, dureeMin: deux ? arrondiQuartSup(dureeTotale / 2) : dureeTotale,
    nombreCleaneurs: deux ? 2 : 1, devisObligatoire: devis, creditImpotC: credit, apresCreditImpotC: total - credit,
  };
}

export function eligibleCreditImpot(rubriqueId, espacePersonnel, typeLieuId = "") {
  if (!espacePersonnel) return false;
  if (!RUBRIQUES_CREDIT_IMPOT.includes(rubriqueId)) return false;
  if (rubriqueId === "windows") return TYPES_VITRES_ELIGIBLES.includes(typeLieuId);
  return true;
}

/** Une seule remise par demande : parmi les packs dont toutes les tâches sont cochées, la plus élevée en euros (sans prix : le plus fort %). */
export function meilleurPack(packs, cochees, chiffrees = []) {
  const complets = packs.filter(p => p.tacheIds.every(id => cochees.includes(id)));
  const valeur = p => (chiffrees.length ? remisePack(p, chiffrees) : 0);
  return complets.sort((a, b) => valeur(b) - valeur(a) || b.remisePct - a.remisePct)[0] || null;
}

/** Tâches proposées pour le type de lieu du brouillon, au prix du client. */
export function tachesChiffrees(b) {
  const r = rubrique(b.rubriqueId);
  const coefPrix = b.rubriqueId === "car" ? ((TYPES_LIEU.car || []).find(l => l.id === b.typeLieuId)?.coef ?? 1) : 1;
  return tachesPour(r, b.typeLieuId).map(t => tacheChiffree(t, r, b.surface, coefPrix));
}
/** Formule choisie (la première par défaut). */
export function formuleDe(b) { const f = formulesPour(rubrique(b.rubriqueId)); return f.find(x => x.id === b.formuleId) || f[0]; }
/** Entretien régulier : chaque passage est une demande séparée, au même prix. */
export const passagesPlanifies = b => (formuleDe(b)?.genre === "REGULIER" ? Math.min(REGLES.PASSAGES_MAX, Math.max(REGLES.PASSAGES_MIN, b.passages || REGLES.PASSAGES_DEFAUT)) : 1);
/** Dates des passages : selon la fréquence, ou les jours choisis (plusieurs fois par semaine). jour : 1 = lundi … 7 = dimanche. */
export function datesPassages(premier, frequence, jours, nombre) {
  const res = [];
  if (frequence === "plusieurs" && jours?.length) {
    for (let d = new Date(premier); res.length < nombre; d = new Date(d.getTime() + 864e5)) {
      const j = d.getDay() === 0 ? 7 : d.getDay();
      if (!res.length || jours.includes(j)) res.push(new Date(d));
    }
    return res;
  }
  if (frequence === "mois") {
    for (let i = 0; i < nombre; i++) { const d = new Date(premier); d.setMonth(d.getMonth() + i); res.push(d); }
    return res;
  }
  const pas = { deux_semaines: 14, quatre_semaines: 28 }[frequence] || 7;
  for (let i = 0; i < nombre; i++) { const d = new Date(premier); d.setDate(d.getDate() + i * pas); res.push(d); }
  return res;
}

/** Minimum facturé par rubrique (centimes), null s'il n'y en a pas. */
export const minimumC = id => ({ car: REGLES.MINIMUM_COMMANDE_VEHICULE_C, textiles: REGLES.MINIMUM_COMMANDE_TEXTILES_C, rental: REGLES.MINIMUM_MENAGE_LOCATION_C })[id] ?? null;
/** Ligne « Complément minimum » : ce qu'il manque pour atteindre le minimum (0 si atteint). */
export const complementMinimum = (totalC, minC) => Math.max(0, minC - totalC);

/** Location saisonnière : temps de rotation. Un studio (0 chambre) compte comme 1 chambre. */
export const tempsRotationLocation = (chambres, sdb, surface, coef) =>
  (REGLES.ROTATION_BASE_MIN + REGLES.ROTATION_PAR_CHAMBRE_MIN * Math.max(1, chambres) + REGLES.ROTATION_PAR_SDB_MIN * Math.max(1, sdb) + REGLES.ROTATION_PAR_M2_MIN * surface) * coef;

/** Disponibilité d'un créneau (ReglesMetier.disponibilite). jour : 1 = lundi … 7 = dimanche. */
export function disponibilite(maintenant, creneau) {
  if (creneau < new Date(maintenant.getTime() + REGLES.DELAI_MIN_RESERVATION_H * 3600e3)) return "INDISPONIBLE";
  const j = creneau.getDay() === 0 ? 7 : creneau.getDay();
  const h = creneau.getHours();
  if (h < 7 || h >= 20 || j === 7) return "PEU";
  if ((j === 1 && h < 12) || (j === 6 && h >= 10 && h <= 15) || (j === 5 && h >= 14)) return "FORTE_DEMANDE";
  if (j >= 2 && j <= 4 && h >= 13 && h <= 15) return "MALIN";
  return "DISPONIBLE";
}

/** Location saisonnière : étapes et consommables du brouillon (pack conseillé si rien n'est encore choisi). */
export const etapesDe = b => b.etapesChoisies ?? PACK_ETAPES_CONSEILLE;
export const consommablesDe = b => b.consommablesChoisis ?? PACK_CONSOMMABLES_CONSEILLE;
/** Le ménage tient-il entre le départ des voyageurs et l'arrivée suivante ? */
export const menageTientEntreVoyageurs = (b, dureeMin) => (b.departVoyageursH ?? 10) * 60 + dureeMin <= (b.arriveeSuivanteH ?? 16) * 60;

/** Construit l'entrée de l'estimateur à partir d'un brouillon (entreeEstimation de Reservation.kt). */
export function entreeEstimation(b, espacePersonnel, debut) {
  const r = rubrique(b.rubriqueId);
  const formules = formulesPour(r);
  const f = formules.find(x => x.id === b.formuleId) || formules[0];
  const lieu = (TYPES_LIEU[b.rubriqueId] || []).find(x => x.id === b.typeLieuId);
  const coefLieu = lieu ? lieu.coef : 1.0;
  // Tâches proposées pour ce type de lieu, au prix du client (prorata de surface, gabarit, arrondi à l'euro).
  const chiffrees = tachesChiffrees(b);
  const tachesChoisies = chiffrees.filter(t => b.taches.includes(t.id));
  const pack = meilleurPack(packsPour(r, b.typeLieuId), b.taches, chiffrees);
  let dureeImposee = 0, m2h = f.m2ParHeure, surface = b.surface;
  // Temps de rotation exact (sans arrondi intermédiaire) : × formule, × salissure, + étapes, + consommables, puis quart d'heure.
  if (b.rubriqueId === "rental") { dureeImposee = tempsRotationLocation(b.chambres, b.sdb, b.surface, 1.0); m2h = 0; }
  if (b.rubriqueId === "windows") { dureeImposee = Math.max(f.minimumMin, b.fenetres * 15); m2h = 0; surface = 0; }
  if (b.rubriqueId === "textiles") { m2h = 0; surface = 0; }
  const dispo = debut ? disponibilite(new Date(), debut) : null;
  return {
    rubriqueId: b.rubriqueId, surfaceM2: surface, m2ParHeure: m2h, minimumMin: f.minimumMin,
    coefTemps: b.rubriqueId === "car" ? 1.0 : b.rubriqueId === "rental" ? f.coef : f.coef * coefLieu,
    coefPrix: 1.0, // déjà appliqué aux tâches chiffrées
    dureeBaseImposeeMin: dureeImposee,
    niveauxSupplementaires: ["home", "moving"].includes(b.rubriqueId) ? Math.max(0, b.niveaux - 1) : 0,
    minutesEtapesLocation: b.rubriqueId === "rental" ? minutesEtapesLocation(etapesDe(b), (b.etapesPerso || []).length, b.chambres, b.sdb) : 0,
    consommablesAControler: b.rubriqueId === "rental" && consommablesDe(b).length > 0,
    salissure: b.salissure, taches: tachesChoisies, remisePackPct: pack ? pack.remisePct : 0, remisePackC: pack ? remisePack(pack, chiffrees) : null,
    tachesPersonnalisees: b.tachesPerso.length,
    dimanche: debut ? debut.getDay() === 0 : false,
    creneauMalin: dispo === "MALIN" && !b.flexible,
    engagementMois: b.engagementMois, espacePersonnel, typeLieuId: b.typeLieuId,
    panier: b.rubriqueId === "textiles" ? b.panier || [] : [],
  };
}
