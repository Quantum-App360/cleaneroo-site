"""Formations des Cleaneurs : fabrique les fichiers du site, de l'appli et les bonnes réponses du serveur.

Source : fr.json (référence, avec les bonnes réponses) + en.json, it.json, es.json (mêmes modules, même ordre).
Les réponses de chaque question sont mélangées une fois pour toutes (toujours le même ordre), pour que la
bonne réponse ne soit pas toujours à la même place. Les bonnes réponses ne vont QUE dans la base (SQL) :
les fichiers publics n'en contiennent aucune.

Lancer : python outils/formations/generer.py   (depuis le dossier cleaneroo-site)
"""
import io, json, os, random, hashlib

ICI = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(ICI))
APPLI = os.path.join(os.path.dirname(SITE), "Cleanova", "app", "src", "main", "assets")
LANGUES = ["fr", "en", "it", "es"]
# Document à déposer pour les qualifications « sur attestation » (type de documents_cleaneur).
DOC = {"hauteur": "formation_hauteur", "haccp": "formation_haccp", "biocides": "formation_biocides",
       "nuisibles": "certibiocide", "electrique": "formation_electrique", "specialise": "formation_specialise"}

def lire(l):
    return json.load(io.open(os.path.join(ICI, l + ".json"), encoding="utf-8"))

src = {l: lire(l) for l in LANGUES}
fr = src["fr"]
for l in LANGUES[1:]:
    t = src[l]
    assert [m["id"] for m in t] == [m["id"] for m in fr], l + " : modules différents"
    for a, b in zip(fr, t):
        for k in ("gestes", "produits", "securite", "documents"):
            assert len(a[k]) == len(b[k]), (l, a["id"], k)
        assert len(a["quiz"]) == len(b["quiz"]), (l, a["id"], "quiz")
        for qa, qb in zip(a["quiz"], b["quiz"]):
            assert len(qa["options"]) == len(qb["options"]), (l, a["id"], qa["q"])
            assert all(x.strip() for x in qb["options"]) and qb["q"].strip() and qb["explication"].strip(), (l, a["id"])
        assert b["titre"].strip() and b["resume"].strip(), (l, a["id"])

modules, reponses = [], []
for i, m in enumerate(fr):
    assert m["externe"] == (m["id"] in DOC), m["id"]
    assert m["externe"] == (not m["quiz"]), m["id"]
    ordres = []
    for n, q in enumerate(m["quiz"]):
        ordre = list(range(len(q["options"])))
        random.Random(int(hashlib.sha256(f"{m['id']}/{n}".encode()).hexdigest(), 16)).shuffle(ordre)
        ordres.append(ordre)
        reponses.append((m["id"], n, ordre.index(q["bonne"])))
    sortie = {"id": m["id"], "categorie": m["categorie"], "externe": m["externe"], "document": DOC.get(m["id"])}
    for l in LANGUES:
        t = src[l][i]
        sortie[l] = {"titre": t["titre"], "resume": t["resume"], "gestes": t["gestes"], "produits": t["produits"],
                     "securite": t["securite"], "documents": t["documents"],
                     "quiz": [{"q": q["q"], "options": [q["options"][k] for k in ordres[n]], "explication": q["explication"]}
                              for n, q in enumerate(t["quiz"])]}
    modules.append(sortie)

texte = json.dumps(modules, ensure_ascii=False, separators=(",", ":"))
os.makedirs(os.path.join(SITE, "assets", "data"), exist_ok=True)
io.open(os.path.join(SITE, "assets", "data", "formations.json"), "w", encoding="utf-8", newline="\n").write(texte)
os.makedirs(APPLI, exist_ok=True)
io.open(os.path.join(APPLI, "formations.json"), "w", encoding="utf-8", newline="\n").write(texte)

sql = ["-- Bonnes réponses des quiz (fabriqué par outils/formations/generer.py, ne pas modifier à la main).",
       "delete from public.quiz_reponses;",
       "insert into public.quiz_reponses (module, num, bonne) values"]
sql.append(",\n".join(f"  ('{a}', {n}, {b})" for a, n, b in reponses) + ";")
io.open(os.path.join(SITE, "outils", "base-formations-reponses.sql"), "w", encoding="utf-8", newline="\n").write("\n".join(sql) + "\n")
print(len(modules), "modules,", len(reponses), "questions ; bonnes réponses par place :",
      [sum(1 for r in reponses if r[2] == k) for k in range(4)])
