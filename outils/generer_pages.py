# Génère les pages statiques du site (référencement Google) et le numéro de version des fichiers.
# Lancer depuis le dossier du site :  python outils/generer_pages.py
#
# À chaque mise en ligne : augmenter VERSION ci-dessous, puis relancer ce script. Il met à jour :
#   - le bloc de chargement (feuille de style, carte des modules avec ?v=VERSION, script) de index.html, gestion.html, tests.html ;
#   - les 10 pages ville /menage/<slug>/ (liste VILLES de assets/js/villes.js), /calculateur/, /comparatif/<concurrent>/ ;
#   - sitemap.xml et robots.txt ;
#   - les traductions des textes locaux des villes dans assets/js/langue.js (bloc <villes-textes>).
import io, json, os, re, html

VERSION = "2026111239"          # ← une seule constante à changer à chaque mise en ligne (AAAAMMJJ + numéro du jour)
DATE_PLAN = "2026-11-06"        # date des pages dans sitemap.xml
SITE = "https://cleaneroo.fr"

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RACINE)
def lire(p): return io.open(p, encoding="utf-8").read()
def ecrire(p, s):
    os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
    io.open(p, "w", encoding="utf-8", newline="").write(s)
e = lambda s: html.escape(s, quote=True)

VILLES = json.loads(re.search(r"/\* <villes> \*/(.*?)/\* </villes> \*/", lire("assets/js/villes.js"), re.S).group(1))

# Comparatifs : remplir source (adresse de la page publique du concurrent) et date de vérification après contrôle,
# puis passer verifie à True (la page est alors indexée et ajoutée au plan du site).
CONCURRENTS = [
    {"slug": "bnb-cleaning", "nom": "BnB Cleaning", "source": "", "date": "", "verifie": False},
    {"slug": "turno", "nom": "Turno", "source": "", "date": "", "verifie": False},
    {"slug": "wecasa", "nom": "Wecasa", "source": "", "date": "", "verifie": False},
]
A_VERIFIER = "à vérifier"
# Critères factuels : [critère, valeur Cleaneroo (description du service à son lancement)]. Les cases concurrent restent « à vérifier ».
CRITERES = [
    ["Prestations proposées", None],  # liste des prestations remplie par le catalogue (page.js)
    ["Public", "Particuliers, professionnels et conciergeries"],
    ["Paiement", "Après validation de l'intervention (empreinte bancaire à la réservation)"],
    ["Crédit d'impôt", "Oui : 50 % sur les prestations éligibles réalisées à domicile"],
    ["Preuves photo avant / après", "Oui, dans le compte rendu de chaque intervention"],
    ["Suivi en direct", "Oui : en route, arrivée confirmée par géolocalisation"],
    ["Vérification des intervenants", "Identité, SIRET, attestation URSSAF et assurance RC Pro, puis une mission test"],
    ["Application mobile", "Android et iOS, à l'ouverture le 31 décembre 2026"],
    ["Synchronisation de calendriers", "Non"],
]

# ------------------------------------------------------------------ Bloc de chargement (version des fichiers)
MODULES = sorted(f for f in os.listdir("assets/js") if f.endswith(".js"))
def chargement(entree=None):
    carte = {"imports": {f"/assets/js/{m}": f"/assets/js/{m}?v={VERSION}" for m in MODULES}}
    return ("<!-- chargement : généré par outils/generer_pages.py, ne pas modifier à la main -->\n"
            f'  <script type="importmap">{json.dumps(carte, separators=(",", ":"))}</script>\n'
            f'  <link rel="stylesheet" href="/assets/style.css?v={VERSION}">\n'
            + (f'  <script type="module" src="/assets/js/{entree}?v={VERSION}"></script>\n' if entree else "")
            + "  <!-- /chargement -->")
BLOC = re.compile(r"<!-- chargement .*?<!-- /chargement -->", re.S)
def poser_chargement(p, entree, ancien=None):
    s = lire(p)
    if BLOC.search(s): s = BLOC.sub(lambda m: chargement(entree), s)
    else:
        for a in ancien or []:
            assert a in s, (p, a); s = s.replace(a, "", 1)
        s = s.replace("</head>", "  " + chargement(entree) + "\n</head>", 1)
    ecrire(p, s)

poser_chargement("index.html", "app.js", ['  <link rel="stylesheet" href="assets/style.css">\n', '  <script type="module" src="assets/js/app.js"></script>\n'])
poser_chargement("gestion.html", "gestion.js", ['  <link rel="stylesheet" href="assets/style.css">\n', '  <script type="module" src="assets/js/gestion.js"></script>\n'])
poser_chargement("tests.html", None)
poser_chargement("carte.html", None)   # carte affichée par l'application (vue web)

# ------------------------------------------------------------------ Gabarit commun des pages statiques
MENU = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'

def gabarit(chemin, titre, description, corps, attrs="", indexer=True, og_type="website"):
    url = SITE + chemin
    autres = "".join(f'<a href="/menage/{v["slug"]}/">{e(v["nom"])}</a>' for v in VILLES)
    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(titre)}</title>
  <meta name="description" content="{e(description)}">
  {'' if indexer else '<meta name="robots" content="noindex">'}
  <meta name="theme-color" content="#FFFFFF">
  <link rel="canonical" href="{url}">
  <meta property="og:title" content="{e(titre)}">
  <meta property="og:description" content="{e(description)}">
  <meta property="og:image" content="{SITE}/assets/img/partage.jpg">
  <meta property="og:url" content="{url}">
  <meta property="og:type" content="{og_type}">
  <meta property="og:locale" content="fr_FR">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.png">
  <link rel="apple-touch-icon" href="/assets/img/icone-apple-180.png">
  <link rel="icon" type="image/svg+xml" href="/assets/img/logo-marque.svg">
  <link rel="preload" href="/assets/polices/plus-jakarta-sans.woff2" as="font" type="font/woff2" crossorigin>
  {chargement("page.js")}
</head>
<body>
  <header class="entete">
    <div class="conteneur">
      <a class="marque" href="/" aria-label="Cleaneroo, accueil">
        <img class="marque-tuile" src="/assets/img/logo-marque.svg" alt="" width="34" height="34">
        <span class="marque-nom">Cleaneroo</span>
      </a>
      <nav class="nav" aria-label="Navigation principale">
        <a href="/#/prestations">Prestations</a>
        <a href="/#/estimer">Estimer mon prix</a>
        <a href="/#/comment-ca-marche">Comment ça marche</a>
        <a href="/#/devenir-cleaneur">Devenir Cleaneur</a>
      </nav>
      <div class="actions-entete">
        <div id="choix-langue"></div>
        <div class="actions-compte"><a class="lien-connexion" href="/#/compte">Se connecter</a><a class="bouton bouton-entete" href="/#/compte/creer">Créer mon espace</a></div>
      </div>
      <button class="burger" aria-label="Menu" aria-expanded="false"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    </div>
  </header>
  <div id="lancement"></div>

  <main id="page"{attrs}>
{corps}
  </main>

  <footer class="fond-cleaneroo pied">
    <div class="conteneur">
      <span class="marque marque-pied"><img class="marque-tuile" src="/assets/img/logo-marque.svg" alt="" width="34" height="34"><span class="marque-nom">Cleaneroo</span></span>
      <div class="trait-corail"></div>
      <p style="margin:0 0 6px">Vos interventions de ménage, 100 % digitalisées.</p>
      <p class="titre-villes">Cleaneroo dans d'autres villes</p>
      <div class="liens autres-villes">{autres}</div>
      <div class="liens">
        <a href="/calculateur/">Calculateur de prix</a>
        <a href="/#/comment-ca-marche">Comment ça marche</a>
        <a href="/#/devenir-cleaneur">Devenir Cleaneur</a>
        <a href="/#/confidentialite">Confidentialité</a>
        <a href="/#/conditions">Conditions d'utilisation</a>
        <a href="/#/mentions-legales">Mentions légales</a>
        <a href="mailto:contact@cleaneroo.fr">contact@cleaneroo.fr</a>
      </div>
      <p class="petit" style="color:rgba(255,255,255,.75);margin-top:16px">© Cleaneroo</p>
    </div>
  </footer>
</body>
</html>
"""

TELEPHONE = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path class="a" d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z"/><path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z"/></svg>'
def boutons(v):
    return (f'<div class="boutons"><a class="bouton corail" href="/#/reserver" data-reserver-ville>Réserver un nettoyage</a>'
            f'<button type="button" class="bouton clair" data-rappel data-ville="{e(v["nom"])}">{TELEPHONE}<span>Être rappelé</span></button></div>')

# ------------------------------------------------------------------ Pages ville
plan = ["/", "/calculateur/"]
for v in VILLES:
    n = e(v["nom"])
    corps = f"""  <section class="fond-cleaneroo heros-page">
    <div class="aurore" aria-hidden="true"><i></i><i></i></div>
    <div class="conteneur">
      <span class="surtitre-heros"><i></i>{e(v["departement"])} · {n} et alentours</span>
      <h1>Ménage et location saisonnière à {n}</h1>
      <p class="sous">Réservez un Cleaneur vérifié en 2 minutes : le prix s'affiche tout de suite et vous ne payez qu'après validation.</p>
      {boutons(v)}
    </div>
  </section>
  <section class="bloc"><div class="conteneur">
    <div class="titre-section"><span class="surtitre">Prix</span><h2>Exemples de prix à {n}</h2><p class="muet">Calculés en direct avec le même moteur que la réservation.</p></div>
    <div data-exemples></div>
    <p class="centre" style="margin-top:22px"><a class="bouton secondaire" href="/calculateur/">Calculer mon prix ›</a></p>
  </div></section>
  <section class="bloc bloc-doux"><div class="conteneur etroit">
    <h2>Cleaneroo à {n}</h2>
    <p class="texte-local">{e(v["texte"][0])}</p>
    <p class="voisines"><b>Communes voisines :</b> {e(", ".join(v["voisines"]))}</p>
  </div></section>
  <section class="bloc"><div class="conteneur">
    <div class="titre-section"><span class="surtitre">En 3 étapes</span><h2>Comment ça marche ?</h2></div>
    <div data-etapes></div>
  </div></section>
  <section class="bloc bloc-doux"><div class="conteneur">
    <div class="titre-section"><span class="surtitre">Garanties</span><h2>Vos garanties</h2></div>
    <div data-reassurance></div>
    <div class="centre" style="margin-top:26px">{boutons(v)}</div>
  </div></section>"""
    chemin = f"/menage/{v['slug']}/"
    titre = f"Ménage à {v['nom']} · Cleaneur vérifié · Cleaneroo"
    desc = (f"Ménage à domicile et location saisonnière à {v['nom']} ({v['departement']}) et alentours : prix affiché tout de suite, "
            f"Cleaneurs vérifiés, compte rendu photo, payé après validation.")
    ecrire(chemin.strip("/") + "/index.html", gabarit(chemin, titre, desc, corps, f' data-ville="{v["slug"]}"'))
    plan.append(chemin)

# ------------------------------------------------------------------ Calculateur
corps = """  <section class="fond-cleaneroo heros-page">
    <div class="aurore" aria-hidden="true"><i></i><i></i></div>
    <div class="conteneur">
      <span class="surtitre-heros"><i></i>Calculateur de prix</span>
      <h1>Combien coûte votre ménage ?</h1>
      <p class="sous">Décrivez votre besoin : le prix s'affiche tout de suite, calculé comme lors de la réservation.</p>
    </div>
  </section>
  <section class="bloc"><div class="conteneur"><div data-calculateur></div></div></section>
  <section class="bloc bloc-doux"><div class="conteneur">
    <div class="titre-section"><span class="surtitre">Garanties</span><h2>Vos garanties</h2></div>
    <div data-reassurance></div>
  </div></section>"""
ecrire("calculateur/index.html", gabarit("/calculateur/", "Combien coûte votre ménage ? Calculateur de prix · Cleaneroo",
    "Calculez le prix de votre ménage, de votre location saisonnière, de vos vitres ou de votre canapé : prix immédiat, crédit d'impôt déduit, payé après validation.", corps))

# ------------------------------------------------------------------ Comparatifs (faits vérifiables uniquement : cases concurrent à remplir après contrôle)
for c in CONCURRENTS:
    date = e(c["date"]) or A_VERIFIER
    source = f'<a href="{e(c["source"])}" rel="nofollow noopener" target="_blank">{e(c["source"])}</a>' if c["source"] else A_VERIFIER
    lignes = "".join(
        f'<tr><th scope="row">{e(k)}</th><td{" data-prestations" if v is None else ""}>{"" if v is None else e(v)}</td><td class="a-verifier">{A_VERIFIER}</td></tr>'
        for k, v in CRITERES)
    corps = f"""  <section class="fond-cleaneroo heros-page">
    <div class="aurore" aria-hidden="true"><i></i><i></i></div>
    <div class="conteneur">
      <span class="surtitre-heros"><i></i>Comparatif</span>
      <h1>Cleaneroo et {e(c["nom"])} : comparatif</h1>
      <p class="sous">Des critères factuels, sur des services comparables.</p>
    </div>
  </section>
  <section class="bloc"><div class="conteneur">
    <p class="note"><span>Comparaison établie à partir des informations publiques au <b>{date}</b>. Signalez-nous toute erreur : nous corrigerons.</span></p>
    <div class="table-comparatif"><table>
      <thead><tr><th scope="col">Critère</th><th scope="col">Cleaneroo</th><th scope="col">{e(c["nom"])}</th></tr></thead>
      <tbody>{lignes}</tbody>
    </table></div>
    <p class="petit">Source {e(c["nom"])} : {source}</p>
    <p class="petit">Cleaneroo ouvre le 31 décembre 2026 : la colonne Cleaneroo décrit le service à son ouverture.</p>
  </div></section>"""
    chemin = f"/comparatif/{c['slug']}/"
    ecrire(chemin.strip("/") + "/index.html", gabarit(chemin, f"Cleaneroo et {c['nom']} : comparatif · Cleaneroo",
        f"Comparatif factuel entre Cleaneroo et {c['nom']} : prestations, public, paiement, crédit d'impôt, preuves photo, suivi, vérification des intervenants.",
        corps, indexer=c["verifie"]))
    if c["verifie"]: plan.append(chemin)

# ------------------------------------------------------------------ Plan du site et robots.txt
ecrire("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
       + "".join(f"  <url><loc>{SITE}{p}</loc><lastmod>{DATE_PLAN}</lastmod><changefreq>{'weekly' if p == '/' else 'monthly'}</changefreq>"
                 f"<priority>{'1.0' if p == '/' else '0.8'}</priority></url>\n" for p in plan) + "</urlset>\n")
ecrire("robots.txt", f"User-agent: *\nAllow: /\nDisallow: /gestion.html\nDisallow: /tests.html\n\nSitemap: {SITE}/sitemap.xml\n")

# ------------------------------------------------------------------ Traductions des textes locaux (langue.js)
def q(x): return json.dumps(x, ensure_ascii=False)
p = "assets/js/langue.js"; s = lire(p)
bloc = "  // <villes-textes> (généré par outils/generer_pages.py depuis villes.js)\n" + "".join(
    f"  [{q(v['texte'][0])}, {q(v['texte'][1])}, {q(v['texte'][2])}, {q(v['texte'][3])}],\n" for v in VILLES) + "  // </villes-textes>\n"
if "// <villes-textes>" in s: s = re.sub(r"  // <villes-textes>.*?// </villes-textes>\n", lambda m: bloc, s, flags=re.S)
else: s = s.replace("  // <rubriques-textes> (généré)", bloc + "  // <rubriques-textes> (généré)", 1)
ecrire(p, s)
print(f"Version {VERSION} · {len(VILLES)} villes · {len(CONCURRENTS)} comparatifs · {len(plan)} adresses dans sitemap.xml")
