// Pilote automatique des locations (18 novembre 2026) — fonction serveur « pilote-auto », lancée toutes les heures par la base (pg_cron).
// Pour chaque logement en mode « Automatique » : lit ses calendriers iCal (Airbnb, Booking…), et pour chaque départ de voyageurs
// des 14 prochains jours sans ménage, programme un ménage sur le modèle du dernier ménage réservé pour ce logement (même prix,
// mêmes consignes), dans la limite du plafond mensuel fixé par la conciergerie. Plafond atteint : rien n'est programmé, une alerte prévient.
// Ménage proposé d'abord au dernier Cleaneur du logement s'il est en favori (25/11/2026).
// Le mode « Automatique » est un accord explicite, logement par logement (aucune dépense sans accord). Notification à chaque ménage programmé.
// Appel protégé par l'en-tête x-cle-alertes (même clé privée que les autres tâches automatiques, table config_privee).
import { createClient } from "jsr:@supabase/supabase-js@2";

const HORIZON_JOURS = 14;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const HOTES = [/(^|\.)airbnb\.[a-z.]+$/, /(^|\.)booking\.com$/, /(^|\.)vrbo\.com$/, /(^|\.)abritel\.fr$/, /(^|\.)homeaway\.[a-z.]+$/,
  /(^|\.)google\.com$/, /(^|\.)outlook\.(com|live\.com|office365\.com)$/, /(^|\.)office365\.com$/, /(^|\.)icloud\.com$/,
  /(^|\.)lodgify\.com$/, /(^|\.)smoobu\.com$/, /(^|\.)beds24\.com$/, /(^|\.)hostaway\.com$/, /(^|\.)guesty\.com$/,
  /(^|\.)avantio\.com$/, /(^|\.)gites-de-france\.com$/, /(^|\.)leboncoin\.fr$/, /(^|\.)tripadvisor\.[a-z.]+$/, /(^|\.)expedia\.[a-z.]+$/];

const jourParis = (d: Date) => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(d);   // AAAA-MM-JJ
const date = (v: string) => { const m = v.match(/(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };

/** Départs et arrivées (jours de fin et de début des vraies réservations, pas les dates bloquées) lus dans un calendrier iCal. */
async function sejours(url: string): Promise<{ fins: string[]; debuts: string[] }> {
  const vide = { fins: [] as string[], debuts: [] as string[] };
  let u: URL;
  try { u = new URL(String(url).trim().replace(/^webcal:/i, "https:")); } catch { return vide; }
  if (u.protocol !== "https:" || !HOTES.some(r => r.test(u.hostname.toLowerCase()))) return vide;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000);
  const r = await fetch(u.toString(), { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "Cleaneroo-Pilote/1.0" } }).catch(() => null);
  clearTimeout(t);
  if (!r || !r.ok) return vide;
  const ics = (await r.text()).slice(0, 2_000_000);
  const lignes = ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const sortie: string[] = [], debuts: string[] = [];
  let e: Record<string, string> | null = null;
  for (const l of lignes) {
    if (l === "BEGIN:VEVENT") e = {};
    else if (l === "END:VEVENT" && e) {
      const fin = date(e.DTEND || e.DTSTART || ""), titre = e.SUMMARY || "";
      const debut = date(e.DTSTART || "");
      if (fin && !/not available|indisponible|blocked|closed/i.test(titre)) { sortie.push(fin); if (debut) debuts.push(debut); }
      e = null;
    } else if (e) { const i = l.indexOf(":"); if (i > 0) { const k = l.slice(0, i).split(";")[0].toUpperCase(); if (!(k in e)) e[k] = l.slice(i + 1); } }
  }
  return { fins: sortie, debuts };
}

const LETTRES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const morceau = () => Array.from({ length: 4 }, () => LETTRES[Math.floor(Math.random() * LETTRES.length)]).join("");

Deno.serve(async (req) => {
  const { data: cle } = await admin.from("config_privee").select("valeur").eq("cle", "alertes").maybeSingle();
  if (!cle?.valeur || req.headers.get("x-cle-alertes") !== cle.valeur) return new Response("refusé", { status: 403 });
  const { data: biens } = await admin.from("biens").select("id, client_id, donnees").in("donnees->pilote->>mode", ["auto", "propose"]);
  const aujourdhui = jourParis(new Date());
  const limite = jourParis(new Date(Date.now() + HORIZON_JOURS * 86400000));
  const bilan: Record<string, number> = { programmes: 0, plafond: 0, sans_modele: 0, proposes: 0 };
  for (const b of biens || []) {
    const p = b.donnees?.pilote || {};
    const urls: string[] = (b.donnees?.calendriers || []).map((c: { url?: string }) => c.url).filter(Boolean);
    if (!urls.length) continue;
    const lus = await Promise.all(urls.map(sejours));
    const arrivees = new Set(lus.flatMap(x => x.debuts));
    // Mode « Proposé » (26/11/2026, accord de Michael) : rien n'est réservé ni payé ; à chaque départ sans ménage, le client est prévenu
    // une fois et programme le ménage en un geste depuis son espace (bouton « Programmer le ménage » de l'agenda).
    if (p.mode === "propose") {
      const js = [...new Set(lus.flatMap(x => x.fins))].filter(j => j > aujourdhui && j <= limite).sort();
      const { data: ex } = await admin.from("demandes").select("creneau").eq("client_id", b.client_id).eq("details->>logementId", b.id).neq("statut", "ANNULEE");
      const prevusP = new Set((ex || []).filter(d => d.creneau).map(d => jourParis(new Date(d.creneau))));
      const dejaProposes: string[] = Array.isArray(p.proposes) ? p.proposes.filter((j: string) => j >= aujourdhui) : [];
      const nouveaux = js.filter(j => !prevusP.has(j) && !dejaProposes.includes(j));
      for (const j of nouveaux) {
        await admin.rpc("notifier", { p_dest: b.client_id, p_espace: "client", p_type: "info", p_niveau: "important",
          p_titre: "Ménage à programmer", p_texte: `Départ des voyageurs le ${j.split("-").reverse().join("/")}${arrivees.has(j) ? " (nouvelle arrivée le même jour)" : ""} : programmez le ménage en un geste depuis votre agenda.`, p_reference: null });
        bilan.proposes++;
      }
      if (nouveaux.length) await admin.from("biens").update({ donnees: { ...b.donnees, pilote: { ...p, proposes: [...dejaProposes, ...nouveaux] } } }).eq("id", b.id).eq("client_id", b.client_id);
      continue;
    }
    const { data: modele } = await admin.from("demandes").select("*").eq("reference", String(p.modele || "")).eq("client_id", b.client_id).maybeSingle();
    if (!modele) { bilan.sans_modele++; continue; }
    // Prix du ménage fixé par la conciergerie pour ce logement (prix libre, 23/11/2026) ; sinon le prix du dernier ménage.
    const prixLibre = Number(b.donnees?.prixMenageC) >= 1000 && ["conciergerie", "hotellerie"].includes(modele.espace) && modele.rubrique_id === "rental";
    const prix = prixLibre ? Math.round(Number(b.donnees.prixMenageC)) : modele.estimation_c || 0, plafond = Number(p.plafondC) || 0;
    const jours = [...new Set(lus.flatMap(x => x.fins))].filter(j => j > aujourdhui && j <= limite).sort();
    if (!jours.length) continue;
    // Ménages déjà prévus pour ce logement (un seul ménage par départ)
    const { data: existants } = await admin.from("demandes").select("creneau, estimation_c, statut, details").eq("client_id", b.client_id)
      .eq("details->>logementId", b.id).neq("statut", "ANNULEE");
    const prevus = new Set((existants || []).filter(d => d.creneau).map(d => jourParis(new Date(d.creneau))));
    // Favori d'abord (25/11/2026, validé par Michael) : le dernier Cleaneur venu dans ce logement, s'il est dans les favoris du client,
    // reçoit le ménage en premier (exclusivité selon delai_favori), puis tous les Cleaneurs. Même règle que « Programmer tout » sur le site.
    const { data: dernier } = await admin.from("demandes").select("cleaneur_id").eq("client_id", b.client_id).eq("details->>logementId", b.id)
      .in("statut", ["A_VALIDER", "TERMINEE"]).not("cleaneur_id", "is", null).order("creneau", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    const { data: fav } = dernier?.cleaneur_id ? await admin.from("favoris").select("cleaneur_id").eq("client_id", b.client_id).eq("cleaneur_id", dernier.cleaneur_id).maybeSingle() : { data: null };
    const attitre = fav?.cleaneur_id ? { choix_cleaneur: "favori", cleaneur_favori: fav.cleaneur_id } : {};
    for (const j of jours) {
      if (prevus.has(j)) continue;
      const mois = j.slice(0, 7);
      const depense = (existants || []).filter(d => d.details?.pilote && d.creneau && jourParis(new Date(d.creneau)).startsWith(mois)).reduce((s, d) => s + (d.estimation_c || 0), 0);
      if (plafond > 0 && depense + prix > plafond) {
        bilan.plafond++;
        if (p.alertePlafond !== mois) {
          await admin.rpc("notifier", { p_dest: b.client_id, p_espace: "client", p_type: "alerte", p_niveau: "important",
            p_titre: "Plafond du pilote automatique atteint", p_texte: `Plus aucun ménage n'est programmé tout seul en ${mois} pour ce logement : programmez-les vous-même ou relevez le plafond.`, p_reference: null });
          await admin.from("biens").update({ donnees: { ...b.donnees, pilote: { ...p, alertePlafond: mois } } }).eq("id", b.id).eq("client_id", b.client_id);
        }
        continue;
      }
      const depH = Number(modele.details?.departVoyageursH ?? 10);
      const heure = String(depH).padStart(2, "0");
      // Plage horaire (26/11/2026) : du départ des voyageurs jusqu'au dernier début qui finit avant l'arrivée suivante (30 min de marge),
      // ou avant 20 h s'il n'y a pas d'arrivée ce jour-là ; le Cleaneur choisit son heure dedans. Prix : celui du début (details.creneauPrix).
      const dureeH = (Number(modele.duree_min) || 120) / 60;
      const limiteH = arrivees.has(j) ? Number(modele.details?.arriveeSuivanteH ?? 16) - 0.5 : 20;
      const finPlageH = Math.floor((limiteH - dureeH) * 2) / 2;
      const iso = (h: number) => `${j} ${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}:00 Europe/Paris`;
      const reference = `CLN-${morceau()}-${morceau()}`;
      const { id: _i, reference: _r, jeton: _j, statut: _s, cree_le: _c, maj_le: _m, cleaneur_id: _cl, paiement_statut: _ps, paiement_session: _pss,
        paiement_intent: _pi, paiement_c: _pc, paiement_test: _pt, notes_admin: _n, relance_le: _rl, versement_statut: _vs, versement_c: _vc,
        versement_id: _vi, paiement_journal: _pj, ...copie } = modele;
      const { error } = await admin.from("demandes").insert({ ...copie, reference, creneau: `${j} ${heure}:00:00 Europe/Paris`,
        remise_parrainage_c: 0, cagnotte_c: 0, equipiers: [], societe_id: null, mission_accompagnee: false, ...attitre,
        plage_fin: finPlageH > depH && finPlageH - depH <= 12 ? iso(finPlageH) : null,
        ...(prixLibre ? { estimation_c: prix, estimation_initiale_c: prix } : {}),
        // creneauPrix et Pass du modèle retirés : la base repose l'heure de prix de ce ménage à sa création.
        details: { ...(modele.details || {}), creneauPrix: undefined, pass: undefined, pilote: true, depuisModele: modele.reference,
          ...(prixLibre ? { prixLibre: true, fraisServiceC: Math.round(prix * Number(modele.details?.fraisServicePctServeur ?? modele.details?.fraisServicePct ?? 8) / 100) } : {}) } });
      if (error) continue;
      prevus.add(j); bilan.programmes++;
      (existants || []).push({ creneau: `${j}T${heure}:00:00`, estimation_c: prix, statut: "VERIFICATION", details: { pilote: true } });
      await admin.rpc("notifier", { p_dest: b.client_id, p_espace: "client", p_type: "info", p_niveau: "standard",
        p_titre: "Ménage programmé automatiquement", p_texte: `Départ des voyageurs le ${j.split("-").reverse().join("/")} : le ménage est programmé au prix habituel du logement.`, p_reference: reference });
    }
  }
  return new Response(JSON.stringify(bilan), { headers: { "Content-Type": "application/json" } });
});
