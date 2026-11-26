// Calcul de l'estimation : copie EXACTE de Estimation.kt (§ 8 du cahier des charges), dans le même ordre.
import { REGLES, duree, pctZone, libelleZone, fraisServicePct, palierPass } from "./regles.js";
import { prixSpecialC, minutesSpeciales, equipementsPour, surfaceEffective, TYPES_IMMEUBLE, tranchesConvives, minutesEtapesLocation, prixOptionsLocationC, PACK_ETAPES_CONSEILLE, PACK_CONSOMMABLES_CONSEILLE } from "./catalogue.js";
import { ANCIENNES_FORMULES_LOCATION } from "./catalogue.js";
import { rubrique, formulesPour, TYPES_LIEU, RUBRIQUES_CREDIT_IMPOT, TYPES_VITRES_ELIGIBLES, prixLigne, minutesLigne, libelleLigne,
  arrondiEuro, tachesPour, tacheChiffree, packsPour, remisePack } from "./catalogue.js";

export const SALISSURE = {
  LEGER: { libelle: "Léger", tempsPct: 0, prixPct: -10 },
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
  engagementMois: 0, espacePersonnel: true, typeLieuId: "", panier: [], minutesEnPlus: 0, minimumApresMin: 0,
  lavageDrapsLits: 0, zonePct: 0, tauxC: 0, suiviSms: false, optionsLocationC: 0, formuleId: "", tachesFormule: [], fraisServicePct: 0,
  remiseParrainageC: 0, cagnotteC: 0, entretienPass: false, fidelitePct: 0,
};

export function calculer(entree) {
  const e = { ...ENTREE_DEFAUT, ...entree };
  const r = rubrique(e.rubriqueId);
  // Taux de la formule (location : 30 / 28,50 / 27 €/h selon le niveau, 20/11/2026), sinon celui de la prestation.
  const taux = e.tauxC || r.tauxHoraireC || 0;
  const vehicule = e.rubriqueId === "car";
  const forfait = e.rubriqueId === "textiles" || e.rubriqueId === "hospitality";
  const panier = e.panier || [];
  const lignes = [];
  const sal = SALISSURE[e.salissure || "NORMAL"];
  // Prix selon la ville : main-d'œuvre, forfaits et tâches ajustés à la zone (les minimums ne changent pas).
  const zp = e.zonePct || 0;
  const zone = c => (zp ? Math.round(c * (100 + zp) / 100) : c);
  const zoneEuro = c => (zp ? arrondiEuro(c * (100 + zp) / 100) : c);

  // 1. Temps de base (textiles : somme des éléments du panier, pour le planning seulement)
  let dureeBase = 0, dureePrix = 0, tSansOptions = null;
  if (forfait) {
    dureeBase = arrondiQuartSup(Math.max(REGLES.DUREE_MIN_TEXTILES_MIN, panier.reduce((s, l) => s + minutesLigne(l), 0)));
  } else if (!vehicule) {
    let t = e.dureeBaseImposeeMin > 0 ? e.dureeBaseImposeeMin
      : e.m2ParHeure > 0 ? Math.max(e.minimumMin, e.surfaceM2 * 60 / e.m2ParHeure) : e.minimumMin;
    t *= e.coefTemps;
    if (r.salissureSurTemps) t *= (100 + sal.tempsPct) / 100;
    t += (e.niveauxSupplementaires || 0) * REGLES.DUREE_PAR_NIVEAU_SUPP_MIN;
    if (e.rubriqueId === "rental") {
      // Étapes en plus : comptées dans le temps (planning) mais facturées au forfait, pas au temps.
      tSansOptions = t + (e.consommablesAControler ? REGLES.CONSOMMABLES_MIN : 0);
      t += e.minutesEtapesLocation || 0;
      if (e.consommablesAControler) t += REGLES.CONSOMMABLES_MIN;
    }
    t += e.minutesEnPlus || 0;           // ex. 15 min par fenêtre en fin de chantier
    t = Math.max(t, e.minimumApresMin || 0); // ex. minimum 2 h en fin de chantier
    dureeBase = arrondiQuartSup(t);
    dureePrix = tSansOptions == null ? dureeBase : arrondiQuartSup(tSansOptions);
  }

  // 2. Prix de base (textiles : une ligne par élément du panier, au prix forfaitaire)
  // Prestations spécialisées : prix fixé à l'avance (forfait + m²), calculé dans entreeEstimation.
  const prixBase = vehicule ? 0 : forfait ? panier.reduce((s, l) => s + zone(prixLigne(l)), 0) : e.prixImposeC > 0 ? zone(e.prixImposeC) : zone(Math.round(taux * (dureePrix || dureeBase) / 60));
  if (forfait) panier.forEach(l => lignes.push({ libelle: libelleLigne(l), montantC: zone(prixLigne(l)) }));
  else if (!vehicule) lignes.push({ libelle: `${r.nom} · ${duree(dureeBase)}`, montantC: prixBase });

  // 3. Salissure en prix
  let sousTotal = prixBase;
  // « Léger » (réduction) s'applique à toutes les rubriques, même celles où la salissure joue sur le temps
  if ((!r.salissureSurTemps || sal.prixPct < 0) && sal.prixPct !== 0 && !vehicule) {
    const s = pct(prixBase, sal.prixPct);
    lignes.push({ libelle: `Salissure ${sal.libelle.toLowerCase()} (${sal.prixPct > 0 ? "+" : "−"}${Math.abs(sal.prixPct)} %)`, montantC: s });
    sousTotal += s;
  }

  // 4. Tâches / options
  const taches = e.taches || [];
  // Prix d'une tâche arrondi à l'euro (le prorata de surface est déjà appliqué par entreeEstimation).
  const prixTache = t => zoneEuro(e.coefPrix === 1 ? t.prixC : arrondiEuro(t.prixC * e.coefPrix));
  const tachesC = taches.reduce((s, t) => s + prixTache(t), 0);
  const tachesMin = taches.reduce((s, t) => s + t.minutes, 0);
  taches.forEach(t => lignes.push({ libelle: t.nom, montantC: prixTache(t) }));
  const baseFormule = sousTotal;   // prix Standard (avant tâches) : sert de repère aux formules
  sousTotal += tachesC;
  // Étapes en plus de la location : petits forfaits (2, 4 ou 6 €), les mêmes dans toutes les zones.
  if (e.optionsLocationC > 0) { lignes.push({ libelle: "Étapes en plus", montantC: e.optionsLocationC }); sousTotal += e.optionsLocationC; }
  // Option « Lavage des draps » (location saisonnière) : prix fixe par lit, le même dans toutes les zones.
  // Linge de toilette et de cuisine (serviettes, tapis de bain et de WC, torchons) : ligne à part.
  if (e.lingeC > 0) { lignes.push({ libelle: e.drapsLaverie ? "Serviettes, tapis et torchons en laverie" : "Serviettes, tapis et torchons (sur place)", montantC: e.lingeC }); sousTotal += e.lingeC; }
  const lits = e.lavageDrapsLits || 0;
  if (lits > 0) {
    const c = e.drapsC ?? lits * REGLES.LAVAGE_DRAPS_PAR_LIT_C;
    lignes.push({ libelle: `${e.drapsLaverie ? "Lavage des draps en laverie" : "Lavage des draps sur place"} × ${lits}`, montantC: c });
    sousTotal += c;
  }

  // 5. Remise de pack (sur le prix des tâches du pack, arrondie à l'euro)
  if (e.remisePackPct > 0) {
    let rem = e.remisePackC != null ? zoneEuro(e.remisePackC) : arrondiEuro(tachesC * e.remisePackPct / 100);
    // Formules Confort / Premium : leurs tâches coûtent au plus 40 % / 90 % du prix Standard.
    // (Sans prix de base, comme les véhicules 100 % à la carte : remise classique du pack.)
    const plusPct = baseFormule > 0 ? { confort: REGLES.FORMULE_CONFORT_PLUS_PCT, prestige: REGLES.FORMULE_PREMIUM_PLUS_PCT }[e.formuleId] : 0;
    if (plusPct) {
      const brutFormule = taches.filter(t => (e.tachesFormule || []).includes(t.id)).reduce((s, t) => s + prixTache(t), 0);
      rem = Math.max(rem, brutFormule - arrondiEuro(baseFormule * plusPct / 100));
    }
    // Plancher horaire (20/11/2026, audit) : la remise ne fait jamais descendre la prestation sous temps planifié × plancher.
    const plancherH = (REGLES.PLANCHER_HORAIRE_C || {})[e.rubriqueId];
    if (plancherH) {
      const minutesPlanifiees = (dureePrix || dureeBase) + tachesMin;
      const plancherC = zone(Math.round(plancherH * minutesPlanifiees / 60));
      rem = Math.max(0, Math.min(rem, sousTotal - plancherC));
    }
    if (rem > 0) lignes.push({ libelle: plusPct ? `Remise formule ${e.formuleId === "confort" ? "Confort" : "Premium"}` : `Remise pack (−${e.remisePackPct} %)`, montantC: -rem });
    sousTotal -= rem;
  }

  // 6. Tâches particulières (15 min chacune au taux horaire)
  const persoMin = (e.tachesPersonnalisees || 0) * REGLES.TACHE_PERSO_MIN;
  if (e.tachesPersonnalisees > 0) {
    const c = zone(Math.round(taux * persoMin / 60));
    lignes.push({ libelle: `Tâches particulières (${e.tachesPersonnalisees})`, montantC: c, note: "à confirmer" });
    sousTotal += c;
  }

  // 6 bis. Pass Entretien (véhicules, 26/11/2026) : le véhicule a été lavé récemment, le passage est plus court ;
  // le prix baisse du même pourcentage que le temps (le gain par heure du Cleaneur ne change pas).
  const entretienPct = vehicule && e.entretienPass ? REGLES.PASS_ENTRETIEN.ENTRETIEN_PCT : 0;
  if (entretienPct > 0) {
    const m = arrondiEuro(sousTotal * entretienPct / 100);
    lignes.push({ libelle: `Passage d'entretien (−${entretienPct} %)`, montantC: -m });
    sousTotal -= m;
  }

  // 7. Déplacement (inclus jusqu'à 15 km)
  lignes.push({ libelle: "Déplacement", montantC: 0, note: "inclus" });
  // Ligne d'information : l'ajustement de la zone est déjà compris dans les prix ci-dessus.
  if (zp) lignes.push({ libelle: libelleZone(zp), montantC: 0, note: "inclus" });

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
  // 10 bis. Pass Entretien : palier de fidélité (véhicules), calculé par le serveur à partir des passages du client.
  if (vehicule && e.fidelitePct > 0) {
    const g = arrondiEuro(total * e.fidelitePct / 100);
    lignes.push({ libelle: `Fidélité Pass Entretien (−${e.fidelitePct} %)`, montantC: -g });
    total -= g;
  }
  // 11. Minimum de commande (véhicules, textiles) ou par ménage (location saisonnière)
  const min = minimumC(e.rubriqueId);
  if (min != null) {
    const c = complementMinimum(total, min);
    if (c > 0) { lignes.push({ libelle: e.rubriqueId === "rental" ? "Complément minimum par ménage" : "Complément minimum de commande", montantC: c }); total += c; }
  }

  // Véhicules : durée affichée d'au moins 30 min.
  const drapsMin = lits * REGLES.LAVAGE_DRAPS_MIN_PAR_LIT + (e.lingeC > 0 ? REGLES.LINGE_MIN : 0) + ((lits > 0 || e.lingeC > 0) && e.drapsLaverie ? REGLES.LAVERIE_TRAJET_MIN : 0);
  const dureeVehicule = dureeBase + tachesMin + persoMin;
  const dureeTotale = vehicule ? Math.max(REGLES.DUREE_MIN_VEHICULE_MIN, entretienPct ? Math.round(dureeVehicule * (100 - entretienPct) / 100 / 5) * 5 : dureeVehicule) : dureeBase + tachesMin + persoMin + drapsMin;
  const deux = dureeTotale > REGLES.SEUIL_DEUX_CLEANEURS_MIN;
  const devis = r.toujoursSurDevis || e.surfaceM2 > REGLES.SEUIL_DEVIS_SURFACE_M2;
  const totalPrestation = total;
  // Option « Suivi par SMS » : hors crédit d'impôt (ce n'est pas un service à la personne).
  if (e.suiviSms) { lignes.push({ libelle: "Suivi par SMS", montantC: REGLES.OPTION_SMS_C }); total += REGLES.OPTION_SMS_C; }
  // Parrainage : remise de bienvenue (1re prestation, à partir de 40 €) et cagnotte, prises sur la marge de Cleaneroo.
  const remise = !devis && e.remiseParrainageC > 0 && total >= REGLES.PARRAINAGE_MIN_COMMANDE_C ? Math.min(e.remiseParrainageC, total) : 0;
  const cagnotte = devis ? 0 : Math.max(0, Math.min(e.cagnotteC || 0, total - remise));
  // Crédit d'impôt : calculé sur ce que le client paie vraiment (après remise et cagnotte).
  const credit = eligibleCreditImpot(e.rubriqueId, e.espacePersonnel, e.typeLieuId)
    ? Math.min(pct(Math.max(0, totalPrestation - remise - cagnotte), REGLES.CREDIT_IMPOT_PCT), REGLES.CREDIT_IMPOT_PLAFOND_C / 2) : 0;

  // Frais de service Cleaneroo (hors crédit d'impôt) : affichés à part, en plus du prix de la prestation.
  const fraisPct = e.fraisServicePct || 0, fraisC = Math.round(total * fraisPct / 100);
  const aPayer = total + fraisC - remise - cagnotte;
  return {
    lignes, totalC: total, dureeMin: deux ? arrondiQuartSup(dureeTotale / 2) : dureeTotale,
    nombreCleaneurs: deux ? 2 : 1, devisObligatoire: devis, creditImpotC: credit,
    fraisServicePct: fraisPct, fraisServiceC: fraisC, remiseParrainageC: remise, cagnotteC: cagnotte,
    totalAPayerC: aPayer, apresCreditImpotC: aPayer - credit,
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
/** Immeubles : temps de base = hall et entrée + par palier max(15 min, surface du palier à la cadence). */
export const dureeImmeubleMin = (surfacePalier, paliers, m2ParHeure) =>
  REGLES.IMMEUBLE_HALL_MIN + paliers * Math.max(REGLES.IMMEUBLE_MIN_PAR_PALIER, surfacePalier * 60 / m2ParHeure);

export function tachesChiffrees(b) {
  const r = rubrique(b.rubriqueId);
  // Véhicules : le gabarit joue sur le prix ET la durée de chaque tâche.
  const gabarit = b.rubriqueId === "car" ? ((TYPES_LIEU.car || []).find(l => l.id === b.typeLieuId)?.coef ?? 1) : 1;
  const surface = b.rubriqueId === "windows" ? (b.surfaceVitree ?? 20) : surfaceEffective(b);
  return tachesPour(r, b.typeLieuId).map(t => {
    const c = tacheChiffree(t, r, surface, gabarit, gabarit);
    if (!t.parConvives) return c;
    const n = tranchesConvives(b.convives ?? 50);
    return { ...c, prixC: c.prixC * n, minutes: c.minutes * n };
  });
}
/** Occasion choisie (22/11/2026) : les tâches de pack sont REMPLACÉES par celles du pack de l'occasion, plus ses tâches en plus ;
 *  les options ajoutées par le client hors packs restent. Changer d'occasion ne garde donc jamais le niveau précédent.
 *  Même règle que Reservation.kt (tachesPourOccasion). */
export function tachesPourOccasion(b, occasionId) {
  const r = rubrique(b.rubriqueId), o = (r.occasions || []).find(x => x.id === occasionId);
  const packs = packsPour(r, b.typeLieuId), proposees = tachesChiffrees(b).map(t => t.id);
  const dansPacks = new Set(packs.flatMap(p => p.tacheIds));
  const enPlusOccasions = new Set((r.occasions || []).flatMap(x => x.tachesEnPlus || []));
  const pack = packs.find(p => p.id === o?.packId);
  const garder = (b.taches || []).filter(id => !dansPacks.has(id) && !enPlusOccasions.has(id));
  const ajouts = [...(pack ? pack.tacheIds : []), ...(o?.tachesEnPlus || [])].filter(id => proposees.includes(id));
  return [...new Set([...garder, ...ajouts])];
}
/** Niveau (standard, confort, prestige) que donne une occasion. */
export const niveauOccasion = (r, occasionId) => (r.occasions || []).find(x => x.id === occasionId)?.packId || "standard";
/** Cuisines : minutes des équipements choisis (proposés pour le type d'établissement). */
export const minutesEquipements = b => equipementsPour(b.typeLieuId).reduce((s, e) => s + e.minutes * ((b.equipements || {})[e.id] || 0), 0);
/** Cuisines : prix indicatif d'un équipement (temps × coefficients × taux, arrondi à l'euro). */
export function prixIndicatifEquipement(e, b) {
  const coefLieu = (TYPES_LIEU.kitchen || []).find(l => l.id === b.typeLieuId)?.coef ?? 1;
  return arrondiEuro(e.minutes * coefLieu * formuleDe(b).coef * rubrique("kitchen").tauxHoraireC / 60);
}
/** Événements : heures de début possibles (avant : fini avant le début ; après : à partir de la fin). */
export function heuresEvenement(b, dureeMin, heures) {
  const debut = b.evtDebutH ?? 18, fin = b.evtFinH ?? 23;
  if (b.formuleId === "apres") { const h = heures.filter(x => x >= fin); return h.length ? h : [fin]; }
  return heures.filter(x => x * 60 + dureeMin <= debut * 60);
}
/** Formule choisie (la première par défaut). */
export function formuleDe(b) { const f = formulesPour(rubrique(b.rubriqueId)); const id = b.rubriqueId === "rental" ? niveauLocation(b).formuleId : b.formuleId; return f.find(x => x.id === id) || f[0]; }
/** Entretien régulier : chaque passage est une demande séparée, au même prix. */
const bornerPassages = b => Math.min(REGLES.PASSAGES_MAX, Math.max(REGLES.PASSAGES_MIN, b.passages || REGLES.PASSAGES_DEFAUT));
export const passagesPlanifies = b => (b.rubriqueId === "car" ? ((b.frequenceVehicule || "unique") !== "unique" ? bornerPassages(b) : 1)
  : formuleDe(b)?.genre === "REGULIER" ? bornerPassages(b) : 1);
/** Fréquence qui espace les passages (véhicules : chaque mois / chaque trimestre). */
export const frequenceDe = b => (b.rubriqueId === "car" ? b.frequenceVehicule || "unique" : b.frequence);
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
  // Fréquences en mois : chaque mois, tous les 2 mois, chaque trimestre / saison, deux fois par an
  const mois = { mois: 1, deux_mois: 2, trimestre: 3, saison: 3, semestre: 6 }[frequence];
  if (mois) {
    const pas = mois;
    for (let i = 0; i < nombre; i++) { const d = new Date(premier); d.setMonth(d.getMonth() + i * pas); res.push(d); }
    return res;
  }
  const pas = { jour: 1, deux_semaines: 14, quatre_semaines: 28 }[frequence] || 7;
  for (let i = 0; i < nombre; i++) { const d = new Date(premier); d.setDate(d.getDate() + i * pas); res.push(d); }
  return res;
}

/** Minimum facturé par rubrique (centimes), null s'il n'y en a pas. */
export const minimumC = id => ({ car: REGLES.MINIMUM_COMMANDE_VEHICULE_C, textiles: REGLES.MINIMUM_COMMANDE_TEXTILES_C, hospitality: REGLES.MINIMUM_COMMANDE_HEBERGEMENT_C, boat: REGLES.MINIMUM_COMMANDE_BATEAU_C, leisure: REGLES.MINIMUM_COMMANDE_LOISIRS_C, rental: REGLES.MINIMUM_MENAGE_LOCATION_C })[id] ?? null;
/** Ligne « Complément minimum » : ce qu'il manque pour atteindre le minimum (0 si atteint). */
export const complementMinimum = (totalC, minC) => Math.max(0, minC - totalC);

/** Location saisonnière : temps de rotation. Un studio (0 chambre) compte comme 1 chambre. */
/** Location courte durée (20/11/2026) : temps Standard = 45 min + 30 min par pièce (chambres + séjour ; un studio compte 1 pièce),
 *  + 20 min par salle de bain au-delà de la première, + 0,35 min par m² au-delà de 25 m² par pièce. Studio 1 h 15, T2 1 h 45, T3 2 h 15. */
export const tempsRotationLocation = (chambres, sdb, surface, coef) => {
  const pieces = Math.max(1, (chambres || 0) + ((chambres || 0) > 0 ? 1 : 0));
  return (REGLES.ROTATION_BASE_MIN + REGLES.ROTATION_PAR_PIECE_MIN * pieces + REGLES.ROTATION_PAR_SDB_SUPP_MIN * Math.max(0, (sdb || 1) - 1)
    + REGLES.ROTATION_PAR_M2_MIN * Math.max(0, (surface || 0) - REGLES.ROTATION_M2_PAR_PIECE * pieces)) * coef;
};
/** Niveau et durée de séjour d'un brouillon de location (les anciennes formules court / semaine / long / grand sont converties). */
export const niveauLocation = b => { const a = ANCIENNES_FORMULES_LOCATION[b.formuleId]; return a ? { formuleId: a[0], sejour: b.sejour || a[1] } : { formuleId: b.formuleId || "standard", sejour: b.sejour || "court" }; };

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
/** Étapes comprises dans une autre option (26/11/2026, demande de Michael) : avec un lavage du linge (draps ou serviettes, sur place ou
 *  en laverie), « Lancer et étendre le linge » est cochée d'office et incluse, sans prix ni temps en plus (déjà comptés dans le lavage). */
export const etapesIncluses = b => (b.rubriqueId === "rental" && (b.lavageDraps || b.lavageLinge) ? ["linge"] : []);
/** Étapes choisies par le client (sans les étapes incluses d'office). */
export const etapesChoisiesDe = b => b.etapesChoisies ?? PACK_ETAPES_CONSEILLE;
/** Étapes à valider en photo : celles choisies et celles incluses d'office. */
export const etapesDe = b => [...new Set([...etapesChoisiesDe(b), ...etapesIncluses(b)])];
/** Étapes facturées : sans celles incluses dans une autre option. */
const etapesPayantes = b => etapesDe(b).filter(x => !etapesIncluses(b).includes(x));
export const consommablesDe = b => b.consommablesChoisis ?? PACK_CONSOMMABLES_CONSEILLE;
/** Option « Lavage des draps » : nombre de lits (par défaut un par chambre, un studio compte 1). */
export const litsDe = b => Math.min(REGLES.LITS_MAX, Math.max(1, b.lits ?? Math.max(1, b.chambres ?? 1)));
/** Lits à laver par taille (18 novembre 2026) : 1 place, 2 places, king size. Ancien brouillon (« lits ») : comptés en 2 places. */
export const litsTailles = b => {
  const un = b.lits1 ?? 0, king = b.litsKing ?? 0, deux = b.lits2 ?? (b.lits1 == null && b.litsKing == null ? litsDe(b) : 0);
  return { un, deux, king, total: un + deux + king };
};
/** Linge de toilette et de cuisine : forfait sur place, ou en laverie par salle de bain (serviettes, tapis) + torchons. */
export const prixLingeC = b => b.drapsLieu === "laverie"
  ? Math.max(1, b.sdb ?? 1) * REGLES.LINGE_LAVERIE_PAR_SDB_C + REGLES.TORCHONS_LAVERIE_C + (b.lavageDraps ? 0 : REGLES.LAVERIE_TRAJET_C)
  : REGLES.LINGE_SUR_PLACE_FORFAIT_C;
/** Prix du lavage des draps : selon le lieu (sur place / laverie) et la taille de chaque lit. */
export const prixDrapsC = b => {
  const t = litsTailles(b), p = REGLES.DRAPS_LAVERIE_C;
  if (!t.total) return 0;
  // 20/11/2026 : sur place 5 € par lit ; en laverie, prix par lit + aller-retour (une fois par ménage, ajouté au linge s'il y en a).
  return b.drapsLieu === "laverie" ? t.un * p.un + t.deux * p.deux + t.king * p.king + REGLES.LAVERIE_TRAJET_C : t.total * REGLES.DRAPS_SUR_PLACE_PAR_LIT_C;
};
/** Le ménage tient-il entre le départ des voyageurs et l'arrivée suivante ? */
export const menageTientEntreVoyageurs = (b, dureeMin) => (b.departVoyageursH ?? 10) * 60 + dureeMin <= (b.arriveeSuivanteH ?? 16) * 60;

/** Construit l'entrée de l'estimateur à partir d'un brouillon (entreeEstimation de Reservation.kt). */
export function entreeEstimation(b, espacePersonnel, debut) {
  const r = rubrique(b.rubriqueId);
  const formules = formulesPour(r);
  const f = formuleDe(b);
  const lieu = (TYPES_LIEU[b.rubriqueId] || []).find(x => x.id === b.typeLieuId);
  const coefLieu = lieu ? lieu.coef : 1.0;
  // Tâches proposées pour ce type de lieu, au prix du client (prorata de surface, gabarit, arrondi à l'euro).
  const chiffrees = tachesChiffrees(b);
  // Véhicules : tâches et remise multipliées par le nombre de véhicules.
  const n = b.rubriqueId === "car" ? Math.min(REGLES.VEHICULES_MAX, Math.max(REGLES.VEHICULES_MIN, b.nombreVehicules || 1)) : 1;
  const tachesChoisies = chiffrees.filter(t => b.taches.includes(t.id)).map(t => (n === 1 ? t : { ...t, nom: `${t.nom} × ${n}`, prixC: t.prixC * n, minutes: t.minutes * n }));
  const pack = meilleurPack(packsPour(r, b.typeLieuId), b.taches, chiffrees);
  let dureeImposee = 0, m2h = f.m2ParHeure, surface = surfaceEffective(b);
  // Temps de rotation exact (sans arrondi intermédiaire) : × formule, × salissure, + étapes, + consommables, puis quart d'heure.
  if (b.rubriqueId === "rental") {
    // Niveau (×1 / ×1,4 / ×2,1) puis durée du séjour : +20 % ou +35 % du temps Standard (20/11/2026).
    const base = tempsRotationLocation(b.chambres, b.sdb, b.surface, 1.0), sejourPct = REGLES.SEJOUR_PCT[niveauLocation(b).sejour] || 0;
    dureeImposee = base * f.coef + base * sejourPct / 100; m2h = 0;
  }
  if (b.rubriqueId === "windows") { dureeImposee = Math.max(f.minimumMin, b.fenetres * 15); m2h = 0; surface = 0; }
  if (b.rubriqueId === "textiles" || b.rubriqueId === "hospitality") { m2h = 0; surface = 0; }
  // Prestations spécialisées : durée et prix fixés par le type d'intervention et la surface à traiter
  if (b.rubriqueId === "special") { dureeImposee = minutesSpeciales(b.typeLieuId, b.surface); m2h = 0; surface = b.surface; }
  // Immeubles : hall et entrée + chaque palier (au moins un quart d'heure), puis formule et type
  if (b.rubriqueId === "communal" && TYPES_IMMEUBLE.includes(b.typeLieuId)) { dureeImposee = dureeImmeubleMin(b.surfacePalier ?? REGLES.SURFACE_PALIER_DEFAUT_M2, b.paliers ?? REGLES.PALIERS_DEFAUT, f.m2ParHeure); m2h = 0; }
  if (b.rubriqueId === "construction") { dureeImposee = b.surface * 60 / f.m2ParHeure * coefLieu; m2h = 0; }
  // Cuisines : max(1 h, (surface / 25 m²/h + équipements) × établissement × intensité), puis salissure
  if (b.rubriqueId === "kitchen") { dureeImposee = Math.max(f.minimumMin, (b.surface * 60 / f.m2ParHeure + minutesEquipements(b)) * coefLieu * f.coef); m2h = 0; }
  const dispo = debut ? disponibilite(new Date(), debut) : null;
  return {
    rubriqueId: b.rubriqueId, surfaceM2: surface, m2ParHeure: m2h, minimumMin: f.minimumMin,
    prixImposeC: b.rubriqueId === "special" ? prixSpecialC(b.typeLieuId, b.surface, b.formuleId === "urgente") : 0,
    coefTemps: ["car", "construction", "kitchen", "special", "rental"].includes(b.rubriqueId) ? 1.0 : f.coef * coefLieu,
    tauxC: f.tauxC || 0,
    coefPrix: 1.0, // déjà appliqué aux tâches chiffrées
    dureeBaseImposeeMin: dureeImposee,
    niveauxSupplementaires: ["home", "moving"].includes(b.rubriqueId) ? Math.max(0, b.niveaux - 1) : 0,
    minutesEtapesLocation: b.rubriqueId === "rental" ? minutesEtapesLocation(etapesPayantes(b), (b.etapesPerso || []).length, b.chambres, b.sdb) : 0,
    optionsLocationC: b.rubriqueId === "rental" ? prixOptionsLocationC(etapesPayantes(b), (b.etapesPerso || []).length, b.chambres, b.sdb) : 0,
    consommablesAControler: b.rubriqueId === "rental" && consommablesDe(b).length > 0,
    salissure: b.salissure, taches: tachesChoisies, remisePackPct: pack ? pack.remisePct : 0, remisePackC: pack ? remisePack(pack, chiffrees) * n : null,
    formuleId: pack && ["confort", "prestige"].includes(pack.id) ? pack.id : "", tachesFormule: pack ? pack.tacheIds : [],
    fraisServicePct: fraisServicePct(espacePersonnel, !!b.abonnePro),
    tachesPersonnalisees: b.tachesPerso.length,
    dimanche: debut ? debut.getDay() === 0 : false,
    creneauMalin: dispo === "MALIN" && !b.flexible,
    engagementMois: b.engagementMois, espacePersonnel, typeLieuId: b.typeLieuId,
    panier: b.rubriqueId === "textiles" || b.rubriqueId === "hospitality" ? b.panier || [] : [],
    minutesEnPlus: b.rubriqueId === "construction" ? (b.fenetres || 0) * REGLES.CHANTIER_MIN_PAR_FENETRE : 0,
    minimumApresMin: b.rubriqueId === "construction" ? REGLES.CHANTIER_MINIMUM_MIN : 0,
    lavageDrapsLits: b.rubriqueId === "rental" && b.lavageDraps ? litsTailles(b).total : 0,
    drapsC: b.rubriqueId === "rental" && b.lavageDraps ? prixDrapsC(b) : 0,
    drapsLaverie: b.rubriqueId === "rental" && (!!b.lavageDraps || !!b.lavageLinge) && b.drapsLieu === "laverie",
    lingeC: b.rubriqueId === "rental" && b.lavageLinge ? prixLingeC(b) : 0,
    zonePct: pctZone(b.codePostal),
    suiviSms: !!b.suiviSms,
    remiseParrainageC: b.remiseParrainageC || 0, cagnotteC: b.utiliserCagnotte ? b.cagnotteDispoC || 0 : 0,
    // Pass Entretien (véhicules) : b.pass = { n, bonus, entretien } (calculé par la base ; le serveur le recalcule avant le paiement).
    entretienPass: b.rubriqueId === "car" && !!b.pass?.entretien,
    fidelitePct: b.rubriqueId === "car" ? palierPass((b.pass?.n || 0) + (b.pass?.bonus || 0)).pct : 0,
  };
}
