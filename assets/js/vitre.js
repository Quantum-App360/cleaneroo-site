// Transition « laveur de vitres » entre les espaces (12 novembre 2026, reprise de l'appli de Vincent, comme App.kt) :
// une vitre savonneuse couvre l'écran, l'espace change pendant qu'elle est couverte, puis une raclette la nettoie en bandes
// (≈ 2,35 s). Sécurité : la vitre ne reste jamais plus de 4 s. Désactivée si l'utilisateur préfère moins d'animations.
let derniere = 0;

export function transitionVitre() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || Date.now() - derniere < 5000) return;
  derniere = Date.now();
  if (!document.getElementById("styles-vitre")) {
    const s = document.createElement("style"); s.id = "styles-vitre";
    s.textContent = `.vitre{position:fixed;inset:0;z-index:9999;pointer-events:none;display:grid;grid-template-rows:repeat(5,1fr)}
      .vitre i{display:block;background:radial-gradient(circle at 30% 40%,rgba(255,255,255,.75) 0 3px,transparent 4px) 0 0/46px 38px,
        radial-gradient(circle at 70% 70%,rgba(255,255,255,.6) 0 5px,transparent 6px) 0 0/90px 64px,
        radial-gradient(circle at 50% 20%,rgba(255,255,255,.5) 0 2px,transparent 3px) 0 0/28px 24px,
        linear-gradient(135deg,rgba(226,241,243,.96),rgba(203,228,232,.96));transform-origin:right;animation:raclette .42s ease-in forwards}
      .vitre i:nth-child(2){animation-delay:.72s}.vitre i:nth-child(3){animation-delay:1.04s}.vitre i:nth-child(4){animation-delay:1.36s}.vitre i:nth-child(5){animation-delay:1.68s}
      .vitre i:first-child{animation-delay:.4s}
      .vitre b{position:absolute;left:0;width:64px;height:20%;background:linear-gradient(90deg,#1F8A80,#2BA89C);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.25);animation:passe 1.95s linear .4s forwards}
      @keyframes raclette{to{transform:scaleX(0);opacity:.2}}
      @keyframes passe{0%{top:0;transform:translateX(-80px)}19%{top:0;transform:translateX(100vw)}20%{top:20%;transform:translateX(-80px)}39%{top:20%;transform:translateX(100vw)}
        40%{top:40%;transform:translateX(-80px)}59%{top:40%;transform:translateX(100vw)}60%{top:60%;transform:translateX(-80px)}79%{top:60%;transform:translateX(100vw)}
        80%{top:80%;transform:translateX(-80px)}100%{top:80%;transform:translateX(100vw)}}`;
    document.head.appendChild(s);
  }
  const v = document.createElement("div");
  v.className = "vitre"; v.setAttribute("aria-hidden", "true");
  v.innerHTML = "<i></i><i></i><i></i><i></i><i></i><b></b>";
  document.body.append(v);
  setTimeout(() => v.remove(), 2400);
  setTimeout(() => v.isConnected && v.remove(), 4000);   // jamais plus de 4 s
}
