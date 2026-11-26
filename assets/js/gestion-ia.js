// Back-office › Cleaneroo AI (26/11/2026, lot F) : pilotage et amélioration de l'assistant « Décrire mon besoin ».
// 1. Chiffres : analyses, fiches, questions, validations humaines, erreurs, fiches devenues des demandes.
// 2. À reprendre : demandes envoyées en validation humaine (à traiter, puis marquer « traité »).
// 3. Ce que les clients demandent et qui n'existe pas : raisons des validations humaines et identifiants écartés.
// 4. Options retirées le plus souvent (avec l'avertissement lu).
// 5. Après mission : demandes préparées par l'IA avec un écart signalé sur place ou un avis de 3/5 ou moins.
// 6. Base de connaissances : activer, désactiver, modifier ou ajouter une entrée (lue par l'IA à chaque analyse).
import { supabase } from "./donnees.js";
import { rubrique } from "./catalogue.js";
import { icone } from "./icones.js";
import { esc } from "./commun.js";

const ETATS = { fiche: "Fiche", questions: "Questions", validation_humaine: "Validation humaine", erreur: "Erreur" };
const TYPES = [["objet", "Objets"], ["matiere", "Matières"], ["code_etiquette", "Étiquettes"], ["salissure", "Salissures"], ["avertissement", "Avertissements"], ["equipement", "Équipements"], ["regle", "Règles"]];
let typeOuvert = "objet";

const compter = (liste, cle) => [...liste.reduce((m, x) => m.set(cle(x), (m.get(cle(x)) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]);

export async function ecranIA(vue, titre, rebrancher) {
  const depuis = new Date(Date.now() - 30 * 864e5).toISOString();
  const [{ data: an, error }, { data: k }, { data: dem }] = await Promise.all([
    supabase.from("analyses_ia").select("id, cree_le, etat, message, nb_photos, reponse, ecartes, reference, options_retirees, traite_le, note_admin, langue").gte("cree_le", depuis).order("cree_le", { ascending: false }).limit(1000),
    supabase.from("connaissances_ia").select("*").order("id"),
    supabase.from("demandes").select("reference, rubrique_id, statut, details, cree_le").not("details->diagnosticIa", "is", null).gte("cree_le", depuis).limit(500),
  ]);
  if (error) { vue.innerHTML = `${titre}<p class="erreur">${esc(error.message)}</p>`; return rebrancher(); }
  const a = an || [], auj = new Date(); auj.setHours(0, 0, 0, 0);
  const n = e => a.filter(x => x.etat === e).length;
  const fiches = a.filter(x => x.etat === "fiche"), reliees = a.filter(x => x.reference).length;
  const aReprendre = a.filter(x => x.etat === "validation_humaine" && !x.traite_le);
  const refs = (dem || []).map(d => d.reference);
  const [{ data: sig }, { data: avis }] = refs.length ? await Promise.all([
    supabase.from("signalements_arrivee").select("reference, type, texte, cree_le").in("reference", refs),
    supabase.from("avis").select("reference, note, commentaire").in("reference", refs).lte("note", 3),
  ]) : [{ data: [] }, { data: [] }];
  const ecarts = [...(sig || []).filter(s => /Cleaneroo AI/i.test(s.texte || "")).map(s => ({ ref: s.reference, quoi: `Écart sur place : ${s.texte}` })),
    ...(avis || []).map(v => ({ ref: v.reference, quoi: `Avis ${v.note}/5${v.commentaire ? ` : ${v.commentaire}` : ""}` }))];
  const horsCatalogue = compter(a.filter(x => x.etat === "validation_humaine"), x => (x.reponse?.raison_validation_humaine || "Sans raison").slice(0, 140)).slice(0, 12);
  const ecartes = compter(a.flatMap(x => x.ecartes || []), x => x).slice(0, 12);
  const retirees = compter(a.flatMap(x => x.options_retirees || []), x => `${rubrique(x.rubrique)?.nom || x.rubrique} · ${rubrique(x.rubrique)?.taches.find(t => t.id === x.tache)?.nom || x.tache}`).slice(0, 12);
  const kpi = (v, l) => `<div class="carte" style="padding:14px 16px"><b style="font-size:26px">${v}</b><div class="petit muet">${l}</div></div>`;
  const tableau = (lignes, vide) => lignes.length ? `<ul class="liste-ia">${lignes.map(([t, c]) => `<li><span>${esc(t)}</span><b>${c}</b></li>`).join("")}</ul>` : `<p class="muet">${vide}</p>`;
  const parType = (k || []).filter(x => x.type === typeOuvert);

  vue.innerHTML = `${titre}
    <p class="muet">30 derniers jours. L'IA ne fixe aucun prix : elle choisit dans le catalogue, le moteur de la réservation calcule.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0 20px">
      ${kpi(a.filter(x => new Date(x.cree_le) >= auj).length, "analyses aujourd'hui")}${kpi(a.length, "analyses sur 30 jours")}${kpi(fiches.length, "fiches proposées")}
      ${kpi(n("questions"), "questions posées")}${kpi(n("validation_humaine"), "validations humaines")}${kpi(n("erreur"), "erreurs")}
      ${kpi(fiches.length ? `${Math.round(100 * reliees / fiches.length)} %` : "–", "fiches devenues une demande")}</div>

    <h2 class="titre-section">À reprendre (${aReprendre.length})</h2>
    ${aReprendre.length ? aReprendre.map(x => `<details class="carte" style="margin-bottom:10px" open><summary><b>${new Date(x.cree_le).toLocaleString("fr-FR")}</b> · ${esc(x.reponse?.raison_validation_humaine || "")}</summary>
      <p style="white-space:pre-wrap">${esc(x.message)}</p><p class="petit muet">${x.nb_photos} photo(s) · langue ${esc(x.langue)} · la demande d'avis du client (si envoyée) est dans « Support ».</p>
      <form data-traiter="${x.id}"><label class="champ">Note interne<input name="note" maxlength="500" value="${esc(x.note_admin || "")}"></label><button class="bouton" type="submit">Marquer traité</button></form></details>`).join("")
      : `<p class="muet">Rien à reprendre.</p>`}

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-top:8px">
      <section class="carte"><h3>${icone("ajouter")} Demandé mais absent du catalogue</h3>${tableau(horsCatalogue, "Aucune demande hors catalogue.")}
        <p class="petit muet">Pour ajouter une prestation : catalogue du site, tarif fixé par vous dans « Tarifs », puis mise en ligne. L'IA la propose dès la publication.</p></section>
      <section class="carte"><h3>${icone("alerte")} Identifiants écartés par le serveur</h3>${tableau(ecartes, "Aucun : l'IA reste dans le catalogue.")}</section>
      <section class="carte"><h3>${icone("document")} Options retirées par les clients</h3>${tableau(retirees, "Aucune option retirée.")}</section>
      <section class="carte"><h3>${icone("avis")} Après mission : écarts et avis faibles</h3>${ecarts.length ? `<ul class="liste-ia">${ecarts.map(e => `<li><span>${esc(e.ref)} · ${esc(e.quoi)}</span></li>`).join("")}</ul>
        <p class="petit muet">Un écart qui revient ? Corrigez l'entrée concernée de la base de connaissances ci-dessous.</p>` : `<p class="muet">Aucun écart signalé.</p>`}</section>
    </div>

    <h2 class="titre-section" style="margin-top:26px">Base de connaissances (${(k || []).length} entrées)</h2>
    <div class="filtres">${TYPES.map(([t, nom]) => `<button type="button" data-type-k="${t}" class="${typeOuvert === t ? "choisi" : ""}">${nom} (${(k || []).filter(x => x.type === t).length})</button>`).join("")}</div>
    ${parType.map(x => `<details class="carte" style="margin-bottom:8px"><summary><b>${esc(x.donnees?.nom || x.donnees?.texte?.slice(0, 90) || x.donnees?.tache || x.donnees?.code || x.id)}</b>
      <span class="petit muet">${esc(x.id)}</span> ${x.actif ? "" : `<span class="tampon gris">désactivée</span>`}</summary>
      <form data-k="${esc(x.id)}"><label class="champ">Contenu (JSON)<textarea name="json" rows="8" spellcheck="false" style="font-family:monospace;font-size:13px">${esc(JSON.stringify(x.donnees, null, 2))}</textarea></label>
        <label class="case"><input type="checkbox" name="actif" ${x.actif ? "checked" : ""}> <span>Active (lue par l'IA)</span></label>
        <button class="bouton" type="submit">Enregistrer</button> <span class="petit muet">Modifiée le ${new Date(x.maj_le).toLocaleString("fr-FR")}</span><p class="erreur" data-err></p></form></details>`).join("")}
    <details class="carte"><summary><b>${icone("ajouter")} Ajouter une entrée « ${TYPES.find(t => t[0] === typeOuvert)[1]} »</b></summary>
      <form data-nouvelle><label class="champ">Identifiant (sans espace)<input name="id" required pattern="[a-z0-9_:]+" maxlength="80"></label>
        <label class="champ">Contenu (JSON)<textarea name="json" rows="6" spellcheck="false" style="font-family:monospace;font-size:13px">{}</textarea></label>
        <button class="bouton" type="submit">Ajouter</button><p class="erreur" data-err></p></form></details>`;
  rebrancher();
  vue.querySelectorAll("[data-type-k]").forEach(b => b.onclick = () => { typeOuvert = b.dataset.typeK; ecranIA(vue, titre, rebrancher); });
  vue.querySelectorAll("[data-traiter]").forEach(f => f.onsubmit = async e => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error: er } = await supabase.from("analyses_ia").update({ traite_le: new Date().toISOString(), traite_par: u?.user?.id ?? null, note_admin: f.note.value.trim() || null }).eq("id", f.dataset.traiter);
    if (er) alert(er.message); else ecranIA(vue, titre, rebrancher);
  });
  const lireJson = (f) => { try { const v = JSON.parse(f.json.value); if (!v || typeof v !== "object" || Array.isArray(v)) throw 0; return v; } catch { f.querySelector("[data-err]").textContent = "Contenu invalide : vérifiez le JSON (accolades, guillemets, virgules)."; return null; } };
  vue.querySelectorAll("[data-k]").forEach(f => f.onsubmit = async e => {
    e.preventDefault();
    const v = lireJson(f); if (!v) return;
    const { error: er } = await supabase.from("connaissances_ia").update({ donnees: v, actif: f.actif.checked }).eq("id", f.dataset.k);
    if (er) f.querySelector("[data-err]").textContent = er.message; else ecranIA(vue, titre, rebrancher);
  });
  vue.querySelector("[data-nouvelle]").onsubmit = async e => {
    e.preventDefault();
    const f = e.target, v = lireJson(f); if (!v) return;
    const id = f.id.value.trim();
    const { error: er } = await supabase.from("connaissances_ia").insert({ id: id.startsWith(`${typeOuvert}:`) ? id : `${typeOuvert}:${id}`, type: typeOuvert, donnees: v });
    if (er) f.querySelector("[data-err]").textContent = er.message; else ecranIA(vue, titre, rebrancher);
  };
}
