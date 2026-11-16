#!/usr/bin/env python3
"""Generate HelloEarth's social sharing preview from its existing SVG logo."""
from pathlib import Path
import io
import math
import random

import cairosvg
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "social-preview.png"
W, H = 1200, 630

def font(size, bold=False):
    base = "/usr/share/fonts/truetype/dejavu/"
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(base + name, size)

def gradient():
    img = Image.new("RGB", (W, H))
    pix = img.load()
    for y in range(H):
        for x in range(W):
            # Deep ink-to-indigo gradient, with gently diffused nebula color.
            t = y / H
            base = (11 + 4*t, 14 + 10*t, 32 + 18*t)
            glows = (
                (90, 65, 155, 180, 365, 270),
                (1050, 520, 80, 185, 405, 350),
                (1000, 90, 120, 55, 360, 300),
            )
            r, g, b = base
            for cx, cy, cr, cg, rx, ry in glows:
                d = ((x-cx)/rx)**2 + ((y-cy)/ry)**2
                a = math.exp(-d*1.8)*.35
                r += cr*a
                g += cg*a
                b += max(cr,cg)*1.15*a
            pix[x, y] = tuple(max(0, min(255, round(v))) for v in (r, g, b))
    return img

def centered(draw, text, y, typeface, color):
    bound = draw.textbbox((0,0), text, font=typeface)
    width = bound[2]-bound[0]
    draw.text(((W-width)/2,y),text,font=typeface,fill=color)

def build():
    image = gradient().convert("RGBA")
    star = Image.new("RGBA", (W,H), (0,0,0,0))
    d = ImageDraw.Draw(star)
    random.seed(161126)
    for _ in range(76):
        x = random.randint(35,W-35)
        y = random.randint(24,H-24)
        rad = random.choice((1,1,1,2))
        d.ellipse((x-rad,y-rad,x+rad,y+rad), fill=(204,195,246,random.randint(45,135)))
    image = Image.alpha_composite(image,star)
    glow=Image.new("RGBA",(W,H))
    gd=ImageDraw.Draw(glow)
    gd.ellipse((438,51,762,367),fill=(153,106,235,46))
    image=Image.alpha_composite(image,glow.filter(ImageFilter.GaussianBlur(65)))

    draw=ImageDraw.Draw(image)
    draw.rounded_rectangle((33,30,W-34,H-31),radius=30,outline=(162,139,215,89),width=2)
    # Preserve the exact HelloEarth brand globe instead of generating a new logo.
    logo_png = cairosvg.svg2png(url=str(ROOT/"logo.svg"), output_width=180,output_height=180)
    mark = Image.open(io.BytesIO(logo_png)).convert("RGBA")
    image.alpha_composite(mark,((W-180)//2,75))

    draw=ImageDraw.Draw(image)
    centered(draw,"helloearth",282,font(89,True),(250,247,255,255))
    # The violet final dot is its own wordmark accent.
    base=font(89,True)
    word="helloearth"
    bb=draw.textbbox((0,0),word,font=base)
    period_x=(W-(bb[2]-bb[0]))/2 + (bb[2]-bb[0]) + 2
    draw.text((period_x,282),".",font=base,fill=(185,145,251,255))
    centered(draw,"FOR TUTORS",397,font(22,True),(190,174,230,255))
    centered(draw,"One calm place for students, lessons and progress",454,font(27),(218,215,237,255))
    draw.line((480,537,720,537),fill=(153,124,210,145),width=2)
    centered(draw,"helloearth.co.za",554,font(22),(185,193,224,255))

    image.convert("RGB").save(OUT,format="PNG",optimize=True)
    print(f"Saved {OUT}: {W}x{H}")

if __name__=="__main__":
    build()
