"""Builds app icon + splash sources (for @capacitor/assets) and in-app logos from the company logo files."""
import sys, os
from PIL import Image
logo_path, emblem_path = sys.argv[1], sys.argv[2]   # wide logo (emblem + wordmark), square-ish logo
os.makedirs('resources', exist_ok=True); os.makedirs('www/assets', exist_ok=True)
logo = Image.open(logo_path).convert('RGBA'); emblem = Image.open(emblem_path).convert('RGBA')
def trim(im):
    bb = im.getbbox(); return im.crop(bb) if bb else im
logo, emblem = trim(logo), trim(emblem)
logo.save('www/assets/logo.png'); emblem.save('www/assets/emblem.png')
def gold_only(im):
    """Crop to the gold calligraphy emblem only (drops a white/navy wordmark if the file has one)."""
    px = im.load(); w, h = im.size
    m = Image.new('L', im.size, 0); mp = m.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 40 and r - b > 35 and r > 90: mp[x, y] = 255
    bb = m.getbbox()
    if not bb: return im
    pad = int(max(bb[2] - bb[0], bb[3] - bb[1]) * .02)
    return im.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(w, bb[2] + pad), min(h, bb[3] + pad)))
mark = gold_only(emblem)
mark.save('www/assets/mark.png')   # the gold emblem alone, for the in-app opening screen
def place(src, size, frac, bg):
    c = Image.new('RGBA', (size, size), bg)
    k = size * frac / max(src.width, src.height)   # scale up or down to fill the box
    s = src.resize((max(1, round(src.width * k)), max(1, round(src.height * k))), Image.LANCZOS)
    c.alpha_composite(s, ((size - s.width) // 2, (size - s.height) // 2)); return c
# app icon: the gold emblem on the company navy (a soft lighter glow in the middle gives it depth)
NAVY, NAVY_HI = (14, 28, 54), (33, 50, 92)
def navy_bg(size):
    import math
    bg = Image.new('RGBA', (size, size)); px = bg.load(); c = size / 2; rmax = math.hypot(c, c)
    for y in range(size):
        for x in range(size):
            t = min(1, math.hypot(x - c, y - c * .9) / (rmax * .95)); t = t * t * (3 - 2 * t)
            px[x, y] = tuple(round(NAVY_HI[i] + (NAVY[i] - NAVY_HI[i]) * t) for i in range(3)) + (255,)
    return bg
def on_bg(src, size, frac):
    c = navy_bg(size); c.alpha_composite(place(src, size, frac, (0, 0, 0, 0))); return c
def icon_mark(src, H=1100):
    """the emblem for the icon: enlarged with smooth edges (the source file is small) and painted in the app's gold gradient"""
    from PIL import ImageFilter
    k = H / src.height; big = src.resize((max(1, round(src.width * k)), H), Image.BICUBIC)
    a = big.getchannel('A').filter(ImageFilter.GaussianBlur(H / 500))
    a = a.point(lambda v: 0 if v < 70 else 255 if v > 185 else round((v - 70) * 255 / 115))   # crisp but anti-aliased edge
    top, bot = (236, 206, 134), (196, 154, 66)
    g = Image.new('RGBA', big.size); gp = g.load()
    for y in range(big.height):
        t = y / max(1, big.height - 1); col = tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,)
        for x in range(big.width): gp[x, y] = col
    g.putalpha(a); return g
imark = icon_mark(mark)
on_bg(imark, 1024, .72).save('resources/icon-only.png')                 # iOS / web / store: full square
place(imark, 1024, .52, (0, 0, 0, 0)).save('resources/icon-foreground.png')   # Android adaptive: inside the safe zone
navy_bg(1024).save('resources/icon-background.png')
for name in ('splash.png', 'splash-dark.png'):
    c = Image.new('RGBA', (2732, 2732), (14, 28, 54, 255))
    s = logo.copy(); s.thumbnail((1100, 1100), Image.LANCZOS)
    c.alpha_composite(s, ((2732 - s.width) // 2, (2732 - s.height) // 2)); c.save('resources/' + name)
print('resources ready')
os.makedirs('www/icons', exist_ok=True)
base = Image.open('resources/icon-only.png').convert('RGB')
for s in (180, 192, 512): base.resize((s, s), Image.LANCZOS).save(f'www/icons/icon-{s}.png')
