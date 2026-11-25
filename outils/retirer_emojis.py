# Retire les emojis du code du site (24/11/2026) : règle « aucun emoji, uniquement les icônes de icones.js ».
#  - dans un gabarit HTML (`…<…>…`) : l'emoji devient ${icone("…")} ;
#  - dans une chaîne "…" ou '…' qui contient du HTML : l'emoji devient " + icone("…") + " ;
#  - une chaîne qui ne contient que l'emoji ("✅") devient icone("…") ;
#  - partout ailleurs (texte simple, textContent, title, traductions) : l'emoji et l'espace qui le suit sont retirés.
# Les clés et les traductions de langue.js perdent l'emoji de la même façon, pour rester identiques aux textes du code.
# Lancer depuis le dossier du site : python outils/retirer_emojis.py
import re, glob, os, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RACINE)
EMO = re.compile("([\U0001F300-\U0001FAFF☀-⛿✀-➿⭐⬜⏰-⏺⌚⌛ℹ⌨⤴⤵][️]?)")
GARDER = set("✓✕★☆✔✗✖✦▶↩")       # signes typographiques (coches, étoiles de notation, lecture) gardés
NOMS = {
  "✅": "valide", "📍": "position", "⚠": "alerte", "📷": "appareil-photo", "📸": "appareil-photo", "🔔": "cloche", "💬": "message",
  "📄": "document", "🧾": "document", "📋": "document", "📝": "document", "📊": "document", "🪪": "document", "❓": "document", "ℹ": "document",
  "⭐": "avis", "🌟": "avis", "👑": "avis", "🎓": "formation", "⏱": "horloge", "⏳": "horloge", "🕘": "horloge", "🕒": "horloge", "⏰": "horloge",
  "🚗": "vehicule", "🧽": "termine", "✨": "termine", "🎉": "termine", "🚪": "sur-place", "🔒": "cadenas", "🔓": "cadenas", "🗂": "stock",
  "🏠": "logement", "🛟": "message", "🔑": "cle", "🧻": "stock", "🧺": "stock", "🛏": "logement", "🧴": "stock", "🛡": "garantie", "✍": "document",
  "🗓": "calendrier", "📅": "calendrier", "🏖": "calendrier", "🗺": "position", "🔎": "position", "🤳": "appareil-photo", "🎬": "appareil-photo",
  "🤝": "equipe", "🙋": "cleaneurs", "👤": "cleaneurs", "✋": "valide", "💳": "carte-bancaire", "💶": "paiement", "👛": "paiement",
  "🔄": "repeter", "🔁": "repeter", "❤": "coeur", "🤍": "coeur", "🎁": "cadeau", "🏷": "commerce", "📌": "position", "✉": "message",
  "☰": "menu", "⛔": "alerte", "🚨": "alerte", "❌": "alerte", "🟠": "alerte", "💧": "exterieurs", "⚙": "outil", "🔨": "outil",
  "⚕": "specialise", "🍳": "cuisine", "🪟": "vitres", "🪜": "chantier", "🐞": "specialise", "⚡": "instantane", "🦺": "specialise",
  "🧪": "specialise", "🛋": "canape", "🏢": "bureaux", "🥂": "evenement", "🧳": "valise", "🌸": "termine", "🏡": "logement",
}
SANS_ICONE = {"👍", "👎", "⬜", "✎", "✏"}   # retirés sans icône : le texte suffit

def nom(e): return NOMS.get(e.replace("️", ""))

def chaines(src):
    """Découpe un fichier JS en segments [(type, début, fin)] : type ∈ code, '"', "'", '`', commentaire."""
    i, n, segs, pile = 0, len(src), [], []
    debut, etat = 0, "code"
    def fermer(t, fin):
        segs.append((t, debut, fin))
    while i < n:
        c = src[i]
        if etat == "code":
            if src.startswith("//", i): fermer("code", i); debut = i; j = src.find("\n", i); i = n if j < 0 else j; fermer("com", i); debut = i; continue
            if src.startswith("/*", i): fermer("code", i); debut = i; j = src.find("*/", i + 2); i = n if j < 0 else j + 2; fermer("com", i); debut = i; continue
            if c in "\"'`": fermer("code", i); debut = i; etat = c; i += 1; continue
            if c == "}" and pile and pile[-1] == "${": pile.pop(); fermer("code", i + 1); debut = i + 1; etat = "`"; i += 1; continue
            if c == "{" and pile: pile.append("{")
            if c == "}" and pile and pile[-1] == "{": pile.pop()
            i += 1; continue
        if c == "\\": i += 2; continue
        if etat == "`" and src.startswith("${", i): fermer("`", i + 2); debut = i + 2; pile.append("${"); etat = "code"; i += 2; continue
        if c == etat: fermer(etat, i + 1); debut = i + 1; etat = "code"; i += 1; continue
        if etat in "\"'" and c == "\n": etat = "code"
        i += 1
    fermer(etat, n)
    return [s for s in segs if s[2] > s[1]]

def traiter_js(chemin):
    src = open(chemin, encoding="utf-8").read()
    if not EMO.search(src): return 0
    segs, morceaux, total, besoin_icone = chaines(src), [], 0, False
    # Un gabarit est « HTML » si l'ensemble de ses morceaux (jusqu'à la fermeture) contient une balise.
    for t, a, b in segs:
        txt = src[a:b]
        if t in ("code", "com") or not EMO.search(txt):
            morceaux.append(txt); continue
        ligne = src[src.rfind("\n", 0, a) + 1: (src.find("\n", b) if src.find("\n", b) >= 0 else len(src))]
        texte_brut = re.search(r"textContent|\.title\b|confirm\(|alert\(|aria-label|placeholder", ligne) is not None
        html = not texte_brut and ("<" in txt or (t == "`" and re.search(r"<\w", src[max(0, a - 400):b + 400]) is not None))
        q = txt[0] if txt[0] in "\"'" else None
        contenu = txt[1:-1] if q and len(txt) >= 2 and txt[-1] == q else None
        if q and not texte_brut and contenu is not None and EMO.fullmatch(contenu.strip()) and nom(contenu.strip()):
            morceaux.append(f'icone("{nom(contenu.strip())}")'); besoin_icone = True; total += 1; continue
        def rempl(m):
            nonlocal total, besoin_icone
            e = m.group(1); total += 1
            if e.replace("️", "") in GARDER: total -= 1; return m.group(0)
            ic = nom(e) if e.replace("️", "") not in SANS_ICONE else None
            if ic and html and t == "`": besoin_icone = True; return '${icone("' + ic + '")}' + m.group(2)
            if ic and html and q: besoin_icone = True; return q + ' + icone("' + ic + '") + ' + q + m.group(2)
            return ""
        morceaux.append(re.sub(EMO.pattern + r"( ?)", rempl, txt))
    out = "".join(morceaux)
    if besoin_icone and not re.search(r"import\s*\{[^}]*\bicone\b[^}]*\}\s*from\s*\"\./icones\.js\"", out) and not chemin.endswith("icones.js"):
        m = re.search(r"^import .*?;\s*$", out, re.M)
        ligne = 'import { icone } from "./icones.js";\n'
        out = out[:m.start()] + ligne + out[m.start():] if m else ligne + out
    open(chemin, "w", encoding="utf-8").write(out)
    return total

def traiter_langue(chemin):
    src = open(chemin, encoding="utf-8").read()
    n = len([m for m in EMO.finditer(src) if m.group(1).replace("️", "") not in GARDER])
    out = re.sub(EMO.pattern + r"( ?)", lambda m: m.group(0) if m.group(1).replace("️", "") in GARDER else "", src)
    open(chemin, "w", encoding="utf-8").write(out)
    return n

if __name__ == "__main__":
    fichiers = [f for f in sorted(glob.glob("assets/js/*.js")) if not f.endswith(("langue.js", "traductions.js", "icones.js"))] + sys.argv[1:]
    for f in fichiers:
        k = traiter_js(f)
        if k: print(f"{f} : {k}")
    print("assets/js/langue.js :", traiter_langue("assets/js/langue.js"))
