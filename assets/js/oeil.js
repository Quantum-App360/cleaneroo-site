// Afficher ou masquer le mot de passe (12 novembre 2026) : une icône d'œil dans chaque champ mot de passe du site
// (connexion, création de compte, nouveau mot de passe, gestion). Même chose dans l'appli (Champ de EcranCompte.kt).
import { tr } from "./langue.js";

const OEIL = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const OEIL_BARRE = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M2 2l20 20"/></svg>`;

function equiper(champ) {
  if (champ.dataset.oeil) return;
  champ.dataset.oeil = "1";
  const boite = document.createElement("span");
  boite.className = "champ-mdp";
  champ.parentNode.insertBefore(boite, champ);
  boite.appendChild(champ);
  const bouton = document.createElement("button");
  bouton.type = "button"; bouton.className = "oeil-mdp";
  const majBouton = () => {
    const visible = champ.type === "text";
    bouton.innerHTML = visible ? OEIL_BARRE : OEIL;
    bouton.setAttribute("aria-label", tr(visible ? "Masquer le mot de passe" : "Afficher le mot de passe"));
    bouton.title = bouton.getAttribute("aria-label");
    bouton.setAttribute("aria-pressed", String(visible));
  };
  bouton.addEventListener("click", () => {
    const debut = champ.selectionStart, fin = champ.selectionEnd;
    champ.type = champ.type === "password" ? "text" : "password";
    majBouton(); champ.focus();
    try { champ.setSelectionRange(debut, fin); } catch { /* rien */ }
  });
  majBouton();
  boite.appendChild(bouton);
}

function tout() { document.querySelectorAll('input[type="password"]:not([data-oeil])').forEach(equiper); }
if (!document.getElementById("styles-oeil")) {
  const s = document.createElement("style"); s.id = "styles-oeil";
  s.textContent = `.champ-mdp{position:relative;display:block}.champ-mdp input{padding-right:52px!important;width:100%}
    .oeil-mdp{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:42px;height:42px;display:grid;place-items:center;
      border:0;border-radius:10px;background:transparent;color:var(--texte-2,#5b6f70);cursor:pointer}
    .oeil-mdp:hover,.oeil-mdp:focus-visible{color:var(--primaire,#14948a);background:rgba(20,148,138,.08)}`;
  document.head.appendChild(s);
}
tout();
new MutationObserver(tout).observe(document.body, { childList: true, subtree: true });
