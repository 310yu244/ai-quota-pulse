from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
for size in [16, 32, 48, 128]:
    im = Image.new('RGBA', (256, 256))
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((0, 0, 255, 255), radius=58, fill='#173d39')
    draw.rounded_rectangle((43, 42, 213, 190), radius=28, fill='#edf4d9')
    draw.polygon([(73, 180), (73, 219), (119, 180)], fill='#edf4d9')
    draw.line([(79, 113), (113, 146), (179, 82)], fill='#237964', width=20, joint='curve')
    im.resize((size, size), Image.Resampling.LANCZOS).save(root / 'icons' / f'{size}.png')
