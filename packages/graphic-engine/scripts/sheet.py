"""Planche-contact des rendus du corpus : sheet.py <dossier> <préfixe> [colonnes] [largeur] -> <dossier>/sheet-<préfixe>.png"""
import sys, glob, os
from PIL import Image
d, pre = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 5
w = int(sys.argv[4]) if len(sys.argv) > 4 else 500
ids = sorted(os.path.basename(f)[:-4] for f in glob.glob(f'{d}/{pre}*.png') if not os.path.basename(f).startswith('sheet'))
ims = [Image.open(f'{d}/{i}.png').convert('RGB') for i in ids]
ims = [im.resize((w, int(im.height * w / im.width))) for im in ims]
H = max(i.height for i in ims); rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols + 10 * (cols + 1), H * rows + 10 * (rows + 1)), '#888')
for k, im in enumerate(ims): sheet.paste(im, (10 + (k % cols) * (w + 10), 10 + (k // cols) * (H + 10)))
sheet.save(f'{d}/sheet-{pre}.png'); print(len(ims), sheet.size)
