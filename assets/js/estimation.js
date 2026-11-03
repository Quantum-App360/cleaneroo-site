// Calcul de l'estimation : copie EXACTE de Estimation.kt (§ 8 du cahier des charges), dans le même ordre.
import { REGLES, duree } from "./regles.js";
import { rubrique, formulesPour, TYPES_LIEU, RUBRIQUES_CREDIT_IMPOT, TYPES_VITRES_ELIGIBLES } from "./catalogue.js";

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
  taches: [], remisePackPct: 0, tachesPersonnalisees: 0, dimanche: false, creneauMalin: false,
  engagementMois: 0, espacePersonnel: true, typeLieuId: "",
};

export function calculer(entree) {
  const e = { ...ENTREE_DEFAUT, ...entree };
  const r = rubrique(e.rubriqueId);
  const taux = r.tauxHoraireC ?? 0;
  const vehicule = e.rubriqueId === "car";
  const lignes = [];
  const sal = SALISSURE[e.salissure || "NORMAL"];

  // 1. Temps de base
  let dureeBase = 0;
  if (!vehicule) {
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

  // 2. Prix de base
  const prixBase = vehicule ? 0 : Math.round(taux * dureeBase / 60);
  if (!vehicule) lignes.push({ libelle: `${r.nom} · ${duree(dureeBase)}`, montantC: prixBase });

  // 3. Salissure en prix
  let sousTotal = prixBase;
  if (!r.salissureSurTemps && sal.prixPct !== 0 && !vehicule) {
    const s = pct(prixBase, sal.prixPct);
    lignes.push({ libelle: `Salissure ${sal.libelle.toLowerCase()} (+${sal.prixPct} %)`, montantC: s });
    sousTotal += s;
  }

  // 4. Tâches / options
  const taches = e.taches || [];
  const tachesC = taches.reduce((s, t) => s + Math.round(t.prixC * e.coefPrix), 0);
  const tachesMin = taches.reduce((s, t) => s + t.minutes, 0);
  taches.forEach(t => lignes.push({ libelle: t.nom, montantC: Math.round(t.prixC * e.coefPrix) }));
  sousTotal += tachesC;

  // 5. Remise de pack (sur les tâches)
  if (e.remisePackPct > 0) {
    const rem = pct(tachesC, e.remisePackPct);
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
  // 11. Véhicule : minimum de commande
  if (vehicule && total < REGLES.MINIMUM_COMMANDE_VEHICULE_C) {
    const c = REGLES.MINIMUM_COMMANDE_VEHICULE_C - total;
    lignes.push({ libelle: "Complément minimum de commande", montantC: c });
    total += c;
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

/** La remise la plus avantageuse parmi les packs dont toutes les tâches sont cochées. */
export function meilleurPack(packs, cochees) {
  return packs.filter(p => p.tacheIds.every(id => cochees.includes(id))).sort((a, b) => b.remisePct - a.remisePct)[0] || null;
}

export const tempsRotationLocation = (chambres, sdb, surface, coef) => (30 + 25 * chambres + 25 * sdb + 0.4 * surface) * coef;

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

/** Construit l'entrée de l'estimateur à partir d'un brouillon (entreeEstimation de Reservation.kt). */
export function entreeEstimation(b, espacePersonnel, debut) {
  const r = rubrique(b.rubriqueId);
  const formules = formulesPour(r);
  const f = formules.find(x => x.id === b.formuleId) || formules[0];
  const lieu = (TYPES_LIEU[b.rubriqueId] || []).find(x => x.id === b.typeLieuId);
  const coefLieu = lieu ? lieu.coef : 1.0;
  const tachesChoisies = r.taches.filter(t => b.taches.includes(t.id));
  const pack = meilleurPack(r.packs, b.taches);
  let dureeImposee = 0, m2h = f.m2ParHeure, surface = b.surface;
  if (b.rubriqueId === "rental") { dureeImposee = Math.round(tempsRotationLocation(b.chambres, b.sdb, b.surface, 1.0)); m2h = 0; }
  if (b.rubriqueId === "windows") { dureeImposee = Math.max(f.minimumMin, b.fenetres * 15); m2h = 0; surface = 0; }
  if (b.rubriqueId === "textiles") { m2h = f.id === "tapis" ? 25 : 0; }
  const dispo = debut ? disponibilite(new Date(), debut) : null;
  return {
    rubriqueId: b.rubriqueId, surfaceM2: surface, m2ParHeure: m2h, minimumMin: f.minimumMin,
    coefTemps: b.rubriqueId === "car" ? 1.0 : b.rubriqueId === "rental" ? f.coef : f.coef * coefLieu,
    coefPrix: b.rubriqueId === "car" ? coefLieu : 1.0,
    dureeBaseImposeeMin: dureeImposee,
    niveauxSupplementaires: b.rubriqueId === "home" ? Math.max(0, b.niveaux - 1) : 0,
    minutesEtapesLocation: 0,
    consommablesAControler: b.rubriqueId === "rental" && b.consommables,
    salissure: b.salissure, taches: tachesChoisies, remisePackPct: pack ? pack.remisePct : 0,
    tachesPersonnalisees: b.tachesPerso.length,
    dimanche: debut ? debut.getDay() === 0 : false,
    creneauMalin: dispo === "MALIN" && !b.flexible,
    engagementMois: b.engagementMois, espacePersonnel, typeLieuId: b.typeLieuId,
  };
}
