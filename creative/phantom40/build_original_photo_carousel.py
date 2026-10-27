#!/usr/bin/env python3
"""AJSEE Phantom 40th Instagram carousel — REAL photographs only.
All photo pixels originate from original credited editorial sources. Pillow only
resizes/crops, overlays a dark fade and renders editable typography.
Output: five 1080x1350 JPEG images and one ZIP.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import io, math, zipfile

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/"public/uploads/reviews/phantom-of-the-opera-40th-anniversary-reunion"
OUT=ROOT/"creative-output/phantom40-original-photo-carousel"
S=2
W,H=1080*S,1350*S
BG=(12,19,27)
GOLD=(195,157,99)
LIGHT=(245,236,217)
MUTED=(190,186,177)

def findfont(fname):
    for d in ["/usr/share/fonts/truetype/liberation2","/usr/share/fonts/truetype/liberation","/usr/share/fonts/truetype/dejavu"]:
        x=Path(d)/fname
        if x.exists():return str(x)
    raise FileNotFoundError(fname)

SERIF=findfont("LiberationSerif-Regular.ttf")
BOLD=findfont("LiberationSerif-Bold.ttf")
ITALIC=findfont("LiberationSerif-Italic.ttf")
SANS=findfont("DejaVuSans.ttf")
SANSB=findfont("DejaVuSans-Bold.ttf")

def f(path,pt): return ImageFont.truetype(path,int(pt*S))
def tc(d,t,y,ft,color=LIGHT):
    box=d.textbbox((0,0),t,font=ft)
    d.text(((W-box[2]+box[0])/2,int(y*S)),t,font=ft,fill=color,stroke_width=0)

def track(d,t,y,ft,color=LIGHT,space=3):
    widths=[d.textlength(ch,font=ft) for ch in t]
    length=sum(widths)+(len(t)-1)*space*S
    pos=(W-length)/2
    for ch,wi in zip(t,widths):
        d.text((int(pos),int(y*S)),ch,font=ft,fill=color)
        pos+=wi+space*S

def fit(d,text,desired,maxwidth,fontpath=BOLD,minimum=25):
    pt=desired
    while pt>minimum:
        ft=f(fontpath,pt)
        if d.textlength(text,font=ft)<=maxwidth*S: return ft
        pt-=1
    return f(fontpath,minimum)

def cover(img, target_w, target_h, focus_x=.5, focus_y=.5):
    iw,ih=img.size
    scale=max(target_w/iw,target_h/ih)
    nw,nh=int(math.ceil(iw*scale)),int(math.ceil(ih*scale))
    resized=img.resize((nw,nh),Image.Resampling.LANCZOS)
    x=int((nw-target_w)*focus_x)
    y=int((nh-target_h)*focus_y)
    return resized.crop((x,y,x+target_w,y+target_h))

def photography(image_path, style):
    photo=Image.open(image_path).convert("RGB")
    board=Image.new("RGB",(W,H),BG)
    if style=="wide":
        region=cover(photo,W,750*S,.5,.46); board.paste(region,(0,100*S))
    elif style=="portrait":
        region=cover(photo,W,750*S,.5,.08);board.paste(region,(0,100*S))
    elif style=="detail":
        region=cover(photo,W,750*S,.51,.43);board.paste(region,(0,100*S))
    # Vertical fade is only a gradient overlay, not any photographic synthesis.
    fade=Image.new("RGBA",(W,H),(0,0,0,0))
    px=fade.load()
    for yy in range(H):
        y=yy/S
        if y<605: alpha=0
        elif y<895: alpha=int(245*(y-605)/290)
        else: alpha=245
        if y<128: alpha=max(alpha,int(32*(1-y/128)))
        for xx in range(W):px[xx,yy]=(BG[0],BG[1],BG[2],alpha)
    board=Image.alpha_composite(board.convert("RGBA"),fade).convert("RGB")
    return board

def baseline(d,n,credit):
    m=60*S
    d.line((m,42*S,W-m,42*S),fill=GOLD,width=2*S)
    d.line((m,1284*S,W-m,1284*S),fill=GOLD,width=2*S)
    track(d,"A J S E E",59,f(SANSB,18),LIGHT,2.3)
    track(d,"E D I T O R I A L",91,f(SANS,11),MUTED,1.5)
    d.text((m,1301*S),credit,font=f(SANS,13),fill=MUTED)
    ntext=f"{n:02d} / 05"
    nfont=f(SANS,16)
    d.text((W-m-d.textlength(ntext,font=nfont),1301*S),ntext,font=nfont,fill=MUTED)

def middlebar(d,txt,y=842):
    d.line((66*S,y*S,236*S,y*S),fill=GOLD,width=2*S)
    d.line(((W/S-236)*S,y*S,(W/S-66)*S,y*S),fill=GOLD,width=2*S)
    track(d,txt,y-16,f(SANS,16),LIGHT,1.5)

def lines(d,headline,starting=895,desired=87):
    y=starting
    for ln in headline:
        ft=fit(d,ln,desired,930,BOLD,60)
        tc(d,ln,y,ft,GOLD)
        y+=82
    return y

def textpair(d,english,czech,yn=1106):
    enf=fit(d,english,32,925,SERIF,22)
    czf=fit(d,czech,37,925,SERIF,21)
    tc(d,english,yn,enf,LIGHT)
    tc(d,czech,yn+48,czf,LIGHT)

def create(n, source, style, kicker, headline, eng, cz, credit, detail="",detail2=""):
    original=SOURCE/source if not str(source).startswith("/") else Path(source)
    if not original.exists():raise FileNotFoundError(original)
    board=photography(original,style)
    d=ImageDraw.Draw(board)
    baseline(d,n,credit)
    middlebar(d,kicker)
    if n==1:
        tc(d,"THE PHANTOM OF THE OPERA",880,fit(d,"THE PHANTOM OF THE OPERA",47,950,SERIF),LIGHT)
        tc(d,"40 YEARS",940,fit(d,"40 YEARS",124,940,BOLD),GOLD)
        d.line((425*S,1104*S,655*S,1104*S),fill=GOLD,width=2*S)
        textpair(d,eng,cz,1132)
    elif n==5:
        lines(d,headline,879,88)
        textpair(d,eng,cz,1062)
        track(d,"OYA CANLI  •  2 NOVEMBER 2026",1215,f(SANS,17),GOLD,1.8)
    else:
        y=lines(d,headline,878,81 if n==2 else 83)
        textpair(d,eng,cz,max(y+7,1060))
        if detail:
            tc(d,detail,1190,fit(d,detail,20,950,SANS,15),MUTED)
        if detail2:
            tc(d,detail2,1222,fit(d,detail2,20,950,SANS,15),MUTED)
    OUT.mkdir(parents=True,exist_ok=True)
    path=OUT/f"{n:02d}-phantom40-original-photo.jpg"
    board.resize((1080,1350),Image.Resampling.LANCZOS).save(path,quality=92,optimize=True,subsampling=0)
    assert path.stat().st_size>30_000
    print(f"{path.name} | {round(path.stat().st_size/1024)} KB | {credit}",flush=True)

def main():
    create(1,"phantom-40th-crawford-brightman-gala.webp","wide",
        "LONDON  /  1986—2026",["40 YEARS"],
        "FORTY YEARS. ONE HISTORIC REUNION.",
        "Čtyřicet let. Jedno historické setkání.",
        "PHOTO: MATTHEW HEMLEY / THE STAGE")
    create(2,"phantom-40th-crawford-brightman-gala.webp","wide",
        "THE REUNION  /  NÁVRAT",["BACK WHERE","IT ALL BEGAN."],
        "MICHAEL CRAWFORD & SARAH BRIGHTMAN",
        "Zpátky tam, kde to všechno začalo.",
        "PHOTO: MATTHEW HEMLEY / THE STAGE",
        "HIS MAJESTY’S THEATRE  •  9 OCTOBER 2026")
    create(3,"phantom-40th-donica-penny-toure-gondola.webp","wide",
        "ANNIVERSARY CAST  /  JUBILEJNÍ OBSAZENÍ",["THE MUSIC","LIVES ON."],
        "JORDAN DONICA & BEATRICE PENNY-TOURÉ",
        "Hudba žije dál.",
        "PHOTO: JOHAN PERSSON",
        "2026 WEST END ANNIVERSARY PRODUCTION")
    sierra=SOURCE/"phantom-40th-sierra-boggess-carlotta.jpg"
    create(4,str(sierra),"portrait",
        "SIERRA BOGGESS  /  CARLOTTA",["A MEANINGFUL","RETURN."],
        "FROM CHRISTINE TO CARLOTTA.",
        "Od Christine ke Carlottě.",
        "PHOTO: JOHAN PERSSON",
        "OYA VIDĚLA SIERRU NAŽIVO V SRPNU 2026.",
        "OYA SAW SIERRA PERFORM IN AUGUST 2026.")
    create(5,"phantom-40th-donica-penny-toure-production.webp","detail",
        "COMING MONDAY  /  V PONDĚLÍ",["THE STORY","CONTINUES."],
        "FULL ARTICLE MONDAY, 2 NOVEMBER",
        "Celý článek v pondělí 2. listopadu.",
        "PHOTO: JOHAN PERSSON")
    zipfile_path=OUT/"ajsee-phantom40-carousel-original-photos.zip"
    with zipfile.ZipFile(zipfile_path,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=7) as z:
        for image in sorted(OUT.glob("*-original-photo.jpg")):
            z.write(image,image.name)
    print(f"ZIP: {zipfile_path.name} | {round(zipfile_path.stat().st_size/1024)} KB",flush=True)

if __name__=="__main__":main()
