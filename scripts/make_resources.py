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
def place(src, size, frac, bg):
    c = Image.new('RGBA', (size, size), bg)
    s = src.copy(); s.thumbnail((int(size * frac), int(size * frac)), Image.LANCZOS)
    c.alpha_composite(s, ((size - s.width) // 2, (size - s.height) // 2)); return c
place(emblem, 1024, .78, (255, 255, 255, 255)).save('resources/icon-only.png')
place(emblem, 1024, .56, (0, 0, 0, 0)).save('resources/icon-foreground.png')
Image.new('RGBA', (1024, 1024), (255, 255, 255, 255)).save('resources/icon-background.png')
for name in ('splash.png', 'splash-dark.png'):
    c = Image.new('RGBA', (2732, 2732), (14, 28, 54, 255))
    s = logo.copy(); s.thumbnail((1100, 1100), Image.LANCZOS)
    c.alpha_composite(s, ((2732 - s.width) // 2, (2732 - s.height) // 2)); c.save('resources/' + name)
print('resources ready')
os.makedirs('www/icons', exist_ok=True)
base = Image.open('resources/icon-only.png').convert('RGB')
for s in (180, 192, 512): base.resize((s, s), Image.LANCZOS).save(f'www/icons/icon-{s}.png')
