// Contenu de départ de connaissances_ia (outils/connaissances-ia-initiales.json) → SQL. N'écrase pas une entrée modifiée depuis la gestion.
import { readFileSync, writeFileSync } from "node:fs";
const k = JSON.parse(readFileSync(new URL("./connaissances-ia-initiales.json", import.meta.url)));
const lignes = [
  ...k.objets.map(o => [`objet:${o.id}`, "objet", o]),
  ...k.matieres.map(o => [`matiere:${o.id}`, "matiere", o]),
  ...k.codes_etiquette.map(o => [`code_etiquette:${o.code}`, "code_etiquette", o]),
  ...k.salissures.map(o => [`salissure:${o.id}`, "salissure", o]),
  ...k.avertissements.map(o => [`avertissement:${o.tache}`, "avertissement", o]),
  ...k.equipements.map(o => [`equipement:${o.id}`, "equipement", o]),
  ...k.regles.map((t, i) => [`regle:${String(i + 1).padStart(2, "0")}`, "regle", { texte: t }]),
];
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const sql = `-- Généré par outils/generer_connaissances_ia_sql.mjs (${lignes.length} entrées).\ninsert into public.connaissances_ia (id, type, donnees) values\n`
  + lignes.map(([id, t, d]) => `  (${q(id)}, ${q(t)}, ${q(JSON.stringify(d))}::jsonb)`).join(",\n") + "\non conflict (id) do nothing;\n";
writeFileSync(new URL("./base-assistant-ia-contenu.sql", import.meta.url), sql);
console.log(lignes.length, "entrées");
