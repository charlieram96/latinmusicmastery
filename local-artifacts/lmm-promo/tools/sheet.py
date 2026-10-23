# Contact sheet: sheet.py out.jpg cols w img1 img2 ...
import sys
from PIL import Image, ImageDraw
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); fs = sys.argv[4:]
h = int(w * 9 / 16)
rows = (len(fs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 22)), (30, 30, 30))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((w, h))
    x, y = (i % cols) * w, (i // cols) * (h + 22)
    sheet.paste(im, (x, y + 22)); d.text((x + 6, y + 4), f.split('/')[-1], fill=(255, 220, 160))
sheet.save(out, quality=82)
