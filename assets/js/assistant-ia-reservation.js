// Cleaneroo AI → réservation existante (26/11/2026, lot C). La fiche validée devient un brouillon de réservation prérempli :
// même parcours (photos, adresse, créneau, Cleaneur, paiement), mêmes règles, même prix. Le diagnostic voyage dans la demande
// (details.diagnosticIa : matière, salissures, vu sur photo / indiqué par le client, résultat attendu, options et avertissements),
// pour le Cleaneur et en cas de réclamation. Plusieurs prestations dans la fiche : la première s'ouvre, les suivantes attendent
// dans « cleaneroo-ia-suite » et sont proposées sur la page de suivi une fois la première réservée.
import { preremplir, fournirPhotos } from "./reserver.js";
import { champsDepuisObjet, cocheesDepart, connaissancesObjet } from "./assistant-ia.js";

const CLE_SUITE = "cleaneroo-ia-suite";

/** Brouillon prérempli d'un objet de la fiche (champs de réservation + diagnostic). */
export function preremplissage(etat, i) {
  const o = etat.objets[i], cochees = etat.cochees[i] || cocheesDepart(o), k = connaissancesObjet(o);
  return {
    rubriqueId: o.rubrique_id, etape: 3,
    // Matériel exigé (base de connaissances) : la mission n'est proposée qu'aux Cleaneurs équipés (base-equipements.sql).
    champs: { ...champsDepuisObjet(o, cochees), ...(etat.bienId ? { bienIa: etat.bienId } : {}), equipementsRequis: k.equipementsRequis, diagnosticIa: {
      analyseId: etat.analyseId || null, libelle: o.libelle, matiere: o.matiere, matiereNom: k.matiereNom, matiereSource: o.matiere_source,
      precautions: k.precautions, equipementsNoms: k.equipementsNoms, salissures: k.salissures,
      vuSurPhoto: o.vu_sur_photo || [], indiqueParClient: o.confirme_par_client || [], resultat: o.resultat || {},
      options: (o.options || []).map(x => ({ tache: x.tache_id, niveau: x.niveau, raison: x.raison, retenue: cochees.includes(x.tache_id) })),
      retirees: (etat.retirees || []).filter(r => r.objet === i), confiance: o.confiance || "" } },
  };
}

export function continuerVersReservation(etat, photos, fermer) {
  const suite = etat.objets.map((_, i) => preremplissage(etat, i));
  const [premier, ...autres] = suite;
  try { if (autres.length) localStorage.setItem(CLE_SUITE, JSON.stringify(autres)); else localStorage.removeItem(CLE_SUITE); } catch { /* rien */ }
  preremplir(premier);
  fournirPhotos(photos.map(p => p.blob));
  fermer();
  location.hash = `#/reserver/${premier.rubriqueId}`;
}

/** Prestations de la fiche qui restent à réserver (page de suivi). */
export function suiteIa() { try { return JSON.parse(localStorage.getItem(CLE_SUITE) || "[]"); } catch { return []; } }
export function reserverSuivante() {
  const [suivant, ...reste] = suiteIa();
  if (!suivant) return;
  try { if (reste.length) localStorage.setItem(CLE_SUITE, JSON.stringify(reste)); else localStorage.removeItem(CLE_SUITE); } catch { /* rien */ }
  preremplir(suivant);
  location.hash = `#/reserver/${suivant.rubriqueId}`;
}
