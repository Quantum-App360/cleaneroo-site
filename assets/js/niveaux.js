// Programme Cleaneur : 4 niveaux (12 novembre 2026, repris de l'appli iPhone de Vincent, sur le modèle d'Uber Pro).
// Seuils et avantages : REGLES.NIVEAUX (regles.js, copie dans Regles.kt). Calcul fait par la base (niveau_de, base-niveaux.sql).
// Même écran dans l'appli (Niveaux.kt).
import { supabase } from "./donnees.js";
import { REGLES } from "./regles.js";
import { tr, traduire } from "./langue.js";

/** Badge du niveau (rien pour le niveau de départ). */
export const badgeNiveau = n => { if (!(n > 0)) return ""; styles(); return `<span class="badge-niveau n${n}">${REGLES.NIVEAUX[n].icone} ${tr(REGLES.NIVEAUX[n].nom)}</span>`; };

/** Section « Mon niveau Cleaneroo » du tableau de bord du Cleaneur. */
export async function blocNiveau(boite) {
  if (!boite) return;
  const { data: n } = await supabase.rpc("mon_niveau");
  if (!boite.isConnected || !n) return;
  styles();
  const N = REGLES.NIVEAUX, actuel = N[n.niveau], suivant = N[n.niveau + 1];
  const note = n.note == null ? "—" : String(n.note).replace(".", ",");
  boite.innerHTML = `<h2 class="titre-section">${actuel.icone} ${tr("Mon niveau Cleaneroo")}</h2>
    <div class="carte teintee">
      <div class="tete-niveau"><b>${tr(actuel.nom)}</b><span class="petit">${n.missions} ${tr("missions réalisées")} · ${tr("note")} ${note} / 5 · ${tr("annulations")} ${String(n.annulation_pct).replace(".", ",")} %</span></div>
      ${n.merite > n.niveau ? `<p class="erreur" style="margin:6px 0 0">${tr("Un niveau de moins : taux d'annulation au-dessus de 5 % ou avertissement en cours.")}</p>` : ""}
      ${suivant ? `<p class="petit" style="margin:10px 0 4px">${tr("Prochain niveau :")} <b>${tr(suivant.nom)}</b> — ${suivant.missions} ${tr("missions et une note d'au moins")} ${String(suivant.note).replace(".", ",")}</p>
        <div class="jauge-niveau"><i style="width:${Math.min(100, Math.round(100 * n.missions / suivant.missions))}%"></i></div>`
        : `<p class="petit" style="margin:10px 0 0">${tr("Vous avez atteint le plus haut niveau. Bravo !")}</p>`}
    </div>
    <div class="grille-niveaux">${N.map((x, i) => `<div class="carte niveau-carte ${i === n.niveau ? "actuel" : ""}">
      <b>${x.icone} ${tr(x.nom)}</b><span class="petit">${i ? `${x.missions} ${tr("missions")} · ${tr("note")} ≥ ${String(x.note).replace(".", ",")}` : tr("Dès votre première mission")}</span>
      <ul>${x.avantages.map(a => `<li>${tr(a)}</li>`).join("")}</ul></div>`).join("")}</div>`;
  traduire(boite);
}

function styles() {
  if (document.getElementById("styles-niveaux")) return;
  const s = document.createElement("style");
  s.id = "styles-niveaux";
  s.textContent = `.tete-niveau{display:flex;flex-direction:column;gap:2px}.tete-niveau b{font-size:1.15rem}
    .jauge-niveau{height:8px;border-radius:99px;background:rgba(31,138,128,.12);overflow:hidden}.jauge-niveau i{display:block;height:100%;background:var(--primaire,#1F8A80)}
    .grille-niveaux{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:10px}
    .niveau-carte{margin:0;display:flex;flex-direction:column;gap:2px}.niveau-carte.actuel{outline:2px solid var(--primaire,#1F8A80)}.niveau-carte ul{margin:6px 0 0;padding-left:18px;font-size:.88rem}
    .badge-niveau{display:inline-block;font-size:.78rem;font-weight:700;padding:2px 9px;border-radius:99px;background:#FFF4D6;color:#8A5B00;margin-left:6px;vertical-align:middle}
    .badge-niveau.n2{background:#E3F1FF;color:#1E5A96}.badge-niveau.n3{background:#F3E8FF;color:#6B2BA8}`;
  document.head.appendChild(s);
}
