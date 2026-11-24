// « Ma société » · Activité (24 novembre 2026, demande de Vincent) : chiffre d'affaires par période, par salarié et jour par jour.
// Calculs purs, sans accès à la base : testés dans tests.html. L'affichage est dans societe.js (rubrique « Activité »).
// Règles :
//  - date retenue : celle de l'intervention (creneau), en heure de Paris, quel que soit le fuseau du navigateur ;
//  - semaine du lundi au dimanche ; périodes : jour, semaine, mois, année ;
//  - chiffre d'affaires : missions TERMINEE de la société (montant de la mission, prix inchangés) ; les missions A_VALIDER
//    sont affichées à part (« en attente de validation ») et ne comptent pas encore ;
//  - par salarié : le montant d'une mission est partagé à parts égales entre le chef d'équipe et ses équipiers ; chacun compte
//    la durée de la mission dans ses heures travaillées. Une mission sans chef d'équipe revient au gérant ;
//  - net après commission : commission réelle de la facture quand elle existe, sinon taux de la formule (Pro 12 %, Gratuit 20 %).

export const TYPES_PERIODE = [["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"], ["annee", "Année"]];
const FMT_PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/** Jour de Paris (AAAA-MM-JJ) d'un instant. */
export const jourParis = instant => FMT_PARIS.format(new Date(instant));
const FMT_HEURE_PARIS = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** Heure et minutes de Paris d'un instant : [h, m]. */
export const heureParis = instant => FMT_HEURE_PARIS.format(new Date(instant)).split(":").map(Number);
/** Aujourd'hui à Paris (AAAA-MM-JJ). */
export const aujourdhuiParis = (maintenant = new Date()) => jourParis(maintenant);

// Calcul sur des dates civiles (sans heure), en UTC pour ne dépendre d'aucun fuseau.
const versDate = j => { const [a, m, d] = j.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const versJour = d => d.toISOString().slice(0, 10);
const plus = (j, n) => { const d = versDate(j); d.setUTCDate(d.getUTCDate() + n); return versJour(d); };

/** Bornes d'une période contenant le jour j : { debut, fin } inclus (AAAA-MM-JJ). */
export function bornesActivite(type, j) {
  const d = versDate(j), a = d.getUTCFullYear(), m = d.getUTCMonth();
  if (type === "jour") return { debut: j, fin: j };
  if (type === "semaine") { const lundi = plus(j, -((d.getUTCDay() + 6) % 7)); return { debut: lundi, fin: plus(lundi, 6) }; }
  if (type === "mois") return { debut: versJour(new Date(Date.UTC(a, m, 1))), fin: versJour(new Date(Date.UTC(a, m + 1, 0))) };
  return { debut: `${a}-01-01`, fin: `${a}-12-31` };
}

/** Jour de référence de la période précédente (sens = -1) ou suivante (sens = +1). */
export function decalerActivite(type, j, sens) {
  if (type === "jour") return plus(j, sens);
  if (type === "semaine") return plus(j, 7 * sens);
  const d = versDate(j);
  if (type === "mois") return versJour(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + sens, 1)));
  return `${d.getUTCFullYear() + sens}-01-01`;
}

/** Jours d'une période (pour « Jour par jour »). */
export function joursDe({ debut, fin }) {
  const l = [];
  for (let j = debut; j <= fin; j = plus(j, 1)) l.push(j);
  return l;
}

/**
 * Résumé d'une période. missions : lignes de missions_societe / activite_societe
 * ({ reference, statut, creneau, duree_min, estimation_c, commission_c?, chef_id, chef_prenom, equipiers, equipiers_prenoms }).
 * Montants en centimes, durées en minutes.
 */
export function resumeActivite(missions, { debut, fin }, { tauxCommissionPb = 1200, gerant = { id: "gerant", nom: "Moi (gérant)" }, nomDe = (id, defaut) => defaut } = {}) {
  const dans = m => { if (!m.creneau) return false; const j = jourParis(m.creneau); return j >= debut && j <= fin; };
  const periode = (missions || []).filter(dans);
  const terminees = periode.filter(m => m.statut === "TERMINEE");
  const aValider = periode.filter(m => m.statut === "A_VALIDER");
  const montant = m => m.estimation_c || 0;
  const commission = m => m.commission_c != null ? m.commission_c : Math.round(montant(m) * tauxCommissionPb / 10000);

  const salaries = new Map(), parJour = new Map();
  const ajouter = (id, nom, part, min) => {
    const s = salaries.get(id) || { id, nom, missions: 0, minutes: 0, ca_c: 0 };
    s.missions += 1; s.minutes += min; s.ca_c += part; salaries.set(id, s);
  };
  for (const m of terminees) {
    const intervenants = [m.chef_id ? [m.chef_id, nomDe(m.chef_id, m.chef_prenom || "")] : [gerant.id, gerant.nom],
      ...(m.equipiers || []).map((id, i) => [id, nomDe(id, (m.equipiers_prenoms || [])[i] || "")])];
    const n = intervenants.length, total = montant(m), min = m.duree_min || 0;
    // Parts égales en centimes ; le reste de la division va au chef d'équipe pour que les parts tombent juste.
    intervenants.forEach(([id, nom], i) => ajouter(id, nom, Math.floor(total / n) + (i === 0 ? total % n : 0), min));
    const j = jourParis(m.creneau);
    parJour.set(j, (parJour.get(j) || 0) + total);
  }
  const caC = terminees.reduce((s, m) => s + montant(m), 0);
  const commissionC = terminees.reduce((s, m) => s + commission(m), 0);
  const minutes = [...salaries.values()].reduce((s, x) => s + x.minutes, 0);
  return {
    caC, commissionC, netC: caC - commissionC, missions: terminees.length, minutes,
    parHeureC: minutes ? Math.round(caC * 60 / minutes) : 0,
    aValider: aValider.length, aValiderC: aValider.reduce((s, m) => s + montant(m), 0),
    salaries: [...salaries.values()].map(s => ({ ...s, parHeureC: s.minutes ? Math.round(s.ca_c * 60 / s.minutes) : 0 }))
      .sort((a, b) => b.ca_c - a.ca_c || a.nom.localeCompare(b.nom)),
    parJour,
  };
}

/** Évolution en % par rapport à la période précédente (null si la précédente est vide). */
export const evolutionPct = (actuel, precedent) => precedent > 0 ? Math.round((actuel - precedent) * 100 / precedent) : null;

/** Regroupement par mois (vue « Année »). */
export function parMois(parJour, annee) {
  return [...Array(12)].map((_, i) => {
    const prefixe = `${annee}-${String(i + 1).padStart(2, "0")}`;
    return [prefixe, [...parJour].filter(([j]) => j.startsWith(prefixe)).reduce((s, [, c]) => s + c, 0)];
  });
}
