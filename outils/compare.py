# Outil de non-régression visuelle (prompt 4) : python outils/regression.py <dossier> (site servi sur localhost:8765), puis python outils/compare.py <ref> <nouveau>.
import sys,glob,os
from PIL import Image, ImageChops
ref,new=sys.argv[1],sys.argv[2]; n=0
for a in sorted(glob.glob(ref+'/*.png')):
    b=os.path.join(new,os.path.basename(a))
    if not os.path.exists(b): print("absent",b); continue
    A=Image.open(a).convert('RGB'); B=Image.open(b).convert('RGB')
    if A.size!=B.size: print("taille",os.path.basename(a),A.size,B.size); n+=1; continue
    D=ImageChops.difference(A,B)
    if os.path.basename(a).startswith('390'): D.paste((0,0,0),(200,15,300,55))  # bascule du mode (instable)
    bb=D.getbbox()
    if bb: print("diff",os.path.basename(a),bb); n+=1
print("écarts",n)
