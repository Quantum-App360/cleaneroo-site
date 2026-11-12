// Signature au doigt du compte rendu (12 novembre 2026, reprise de l'appli iPhone de Vincent) : tracé, effacer, valider.
// Image PNG enregistrée par la base (signer, signatures_de). Cleaneur : obligatoire avant « J'ai terminé ».
// Client présent : il signe en validant la prestation. Même écran dans l'appli (Signature.kt).
import { supabase } from "./donnees.js";
import { tr, traduire } from "./langue.js";

/** Zone de signature ; apres(ok) est appelé une fois la signature enregistrée. */
export function zoneSignature(boite, reference, { jeton = null, titre = "Signez le compte rendu", apres = () => {} } = {}) {
  if (!boite) return;
  boite.innerHTML = `<div class="carte signature" style="margin-top:10px"><b>✍️ ${tr(titre)}</b>
    <canvas width="600" height="200" class="toile-signature" aria-label="${tr("Zone de signature")}"></canvas>
    <div class="boutons"><button type="button" class="bouton secondaire" data-effacer>${tr("Effacer")}</button>
      <button type="button" class="bouton" data-signer disabled>${tr("Valider ma signature")}</button></div>
    <p class="petit" data-resultat-signature></p></div>`;
  traduire(boite);
  if (!document.getElementById("styles-signature")) {
    const s = document.createElement("style"); s.id = "styles-signature";
    s.textContent = `.toile-signature{display:block;width:100%;max-width:600px;aspect-ratio:3/1;background:#fff;border:1px dashed #9db5b5;border-radius:12px;margin:8px 0;touch-action:none;cursor:crosshair}`;
    document.head.appendChild(s);
  }
  const toile = boite.querySelector("canvas"), ctx = toile.getContext("2d"), bouton = boite.querySelector("[data-signer]");
  ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#16343A";
  let trace = false, vide = true;
  const point = e => { const r = toile.getBoundingClientRect(); return [(e.clientX - r.left) * toile.width / r.width, (e.clientY - r.top) * toile.height / r.height]; };
  toile.onpointerdown = e => { trace = true; toile.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...point(e)); };
  toile.onpointermove = e => { if (!trace) return; ctx.lineTo(...point(e)); ctx.stroke(); vide = false; bouton.disabled = false; };
  toile.onpointerup = () => { trace = false; };
  boite.querySelector("[data-effacer]").onclick = () => { ctx.clearRect(0, 0, toile.width, toile.height); vide = true; bouton.disabled = true; };
  bouton.onclick = async () => {
    if (vide) return;
    bouton.disabled = true;
    const { data } = await supabase.rpc("signer", { p_reference: reference, p_image: toile.toDataURL("image/png"), p_jeton: jeton });
    const res = boite.querySelector("[data-resultat-signature]");
    if (data === "ok") { res.textContent = tr("Signature enregistrée."); res.style.color = "var(--succes)"; apres(true); }
    else { bouton.disabled = false; res.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); res.style.color = "var(--erreur)"; }
  };
}

/** Signatures déjà enregistrées (compte rendu). */
export async function signaturesDe(reference, jeton = null) {
  const { data } = await supabase.rpc("signatures_de", { p_reference: reference, p_jeton: jeton });
  return data || [];
}
