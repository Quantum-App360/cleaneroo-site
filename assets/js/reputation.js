// Réputation d'un Cleaneur (lot 7 du prompt 4, 25/11/2026) : note globale, nombre d'avis, répartition 5 → 1 étoile, notes par
// critère, taux de satisfaction (avis à 4 ou 5 étoiles), badges et avis récents. Seulement des avis publiés (double aveugle
// respecté) : reputation_cleaneur en base (outils/base-lot7.sql) pour les fiches publiques, avis_recus pour le Cleaneur lui-même.
// Aucun chiffre inventé : sans avis publié, la fiche le dit simplement.
import { icone } from "./icones.js";
import { rubrique } from "./catalogue.js";
import { CRITERES } from "./avis.js";
import { tr, LOCALE } from "./langue.js";
import { esc } from "./commun.js";

const virgule = n => String(n).replace(".", ",");
const etoiles = n => { const p = Math.round(Number(n) || 0); return `<span class="etoiles-rep" aria-hidden="true">${"★".repeat(p)}${"☆".repeat(5 - p)}</span>`; };
const moisTxt = m => m ? new Date(m + "-15T12:00").toLocaleDateString(LOCALE, { month: "long", year: "numeric" }) : "";

/** Même structure que reputation_cleaneur, calculée à partir des avis reçus par le Cleaneur (publiés seulement). Fonction pure, testée. */
export function reputationDepuisAvis(liste) {
  const a = (liste || []).filter(x => x.revele && x.note >= 1 && x.note <= 5);
  const n = a.length;
  const moy = vals => vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10 : null;
  const repartition = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  a.forEach(x => { repartition[x.note]++; });
  return {
    nombre: n,
    moyenne: moy(a.map(x => x.note)),
    satisfaction: n ? Math.round(100 * a.filter(x => x.note >= 4).length / n) : null,
    repartition,
    criteres: Object.fromEntries(CRITERES.map(([id]) => [id, moy(a.filter(x => x.categories && x.categories[id] != null).map(x => Number(x.categories[id])))])),
    avis: [...a].sort((x, y) => String(y.recu_le).localeCompare(String(x.recu_le))).slice(0, 5)
      .map(x => ({ note: x.note, commentaire: x.commentaire || null, rubrique: x.rubrique_id, mois: String(x.recu_le || "").slice(0, 7), auteur: null })),
  };
}

/**
 * Bloc de réputation. rep : { nombre, moyenne, satisfaction, repartition, criteres, avis } ; options : badges déjà écrits,
 * titre (défaut « Avis des clients »), vide : texte quand il n'y a aucun avis publié.
 */
export function blocReputation(rep, { badges = "", titre = "Avis des clients", vide = "Pas encore d'avis publié : ce Cleaneur vient d'arriver sur Cleaneroo." } = {}) {
  const n = rep?.nombre || 0;
  if (!n) return `<section class="reputation vide-rep"><h3>${tr(titre)}</h3>${badges ? `<p class="badges-rep">${badges}</p>` : ""}<p class="petit muet">${tr(vide)}</p></section>`;
  const max = Math.max(1, ...[5, 4, 3, 2, 1].map(k => Number(rep.repartition?.[k]) || 0));
  const crit = CRITERES.filter(([id]) => rep.criteres?.[id] != null);
  return `<section class="reputation"><h3>${tr(titre)}</h3>
    <div class="rep-tete">
      <div class="rep-note"><b>${virgule(Number(rep.moyenne).toFixed(1))}</b>${etoiles(rep.moyenne)}<span class="petit">${n} ${tr(n > 1 ? "avis vérifiés" : "avis vérifié")}</span></div>
      <div class="rep-barres" role="list" aria-label="${tr("Répartition des notes")}">${[5, 4, 3, 2, 1].map(k => { const v = Number(rep.repartition?.[k]) || 0;
        return `<div class="rep-barre" role="listitem" aria-label="${k} ${tr("étoiles")} : ${v}"><span>${k} ★</span><span class="rep-piste"><span style="width:${Math.round(100 * v / max)}%"></span></span><span class="petit">${v}</span></div>`; }).join("")}</div>
    </div>
    ${rep.satisfaction != null ? `<p class="rep-satisfaction">${icone("valide")} <b>${rep.satisfaction} %</b> ${tr("de clients satisfaits")} <span class="petit muet">${tr("(avis à 4 ou 5 étoiles)")}</span></p>` : ""}
    ${badges ? `<p class="badges-rep">${badges}</p>` : ""}
    ${crit.length ? `<div class="rep-criteres">${crit.map(([id, nom]) => `<div><span>${tr(nom)}</span><b>${virgule(Number(rep.criteres[id]).toFixed(1))}</b></div>`).join("")}</div>` : ""}
    ${(rep.avis || []).length ? `<div class="rep-avis">${rep.avis.map(a => `<figure class="avis-rep">${etoiles(a.note)}
        ${a.commentaire ? `<blockquote>${esc(a.commentaire)}</blockquote>` : ""}
        <figcaption class="petit muet">${a.auteur ? `${esc(a.auteur)} · ` : ""}${esc(rubrique(a.rubrique)?.nom || "")}${a.mois ? ` · ${esc(moisTxt(a.mois))}` : ""} · ${tr("Avis vérifié")}</figcaption></figure>`).join("")}</div>` : ""}
    <p class="petit muet"><a href="#/gestion-des-avis">${tr("Comment nous gérons les avis")}</a></p>
  </section>`;
}
