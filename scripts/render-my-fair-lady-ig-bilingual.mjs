import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const W=1080,H=1350;
const originals='assets/editorial/my-fair-lady-70-years-musical-legend';
const out='assets/social/my-fair-lady-70-years-ig-bilingual';
await fs.mkdir(out,{recursive:true});
const P={
  crowd:'eliza-ensemble-jeff-busby.jpg',
  solo:'eliza-solo-jeff-busby.jpg',
  duo:'eliza-higgins-jeff-busby.jpg',
  dance:'ensemble-jeff-busby.jpg'
};
const p={};
for(const [key,f] of Object.entries(P))p[key]='data:image/jpeg;base64,'+(await fs.readFile(path.join(originals,f))).toString('base64');
const cl={bg:'#121326',gold:'#E4BD7B',white:'#FAF3EB',muted:'#E3D0B4',line:'#C9A473'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function text(x,y,value,size=40,o={}){
  const {color=cl.white,family='serif',bold=false,italic=false,anchor='start',spacing=0,opacity=1}=o;
  const font=family==='sans'?'DejaVu Sans,Arial,sans-serif':'Liberation Serif,Georgia,serif';
  return '<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" fill="'+color+'" opacity="'+opacity+'" font-family="'+font+'" font-size="'+size+'" font-weight="'+(bold?700:400)+'" '+(italic?'font-style="italic"':'')+' letter-spacing="'+spacing+'">'+esc(value)+'</text>';
}
const rect=(x,y,w,h,fill,extra='')=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fill+'" '+extra+'/>';
const line=(x,y,w=180)=>rect(x,y,w,2,cl.gold);
const photo=(name,x=0,y=0,w=W,h=H,position='xMidYMid slice')=>'<image href="'+p[name]+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" preserveAspectRatio="'+position+'"/>';
const head=n=>text(75,174,'AJSEE EDITORIAL',24,{family:'sans',bold:true,spacing:4})+line(75,192,211)+text(1006,173,String(n).padStart(2,'0')+' / 07',20,{family:'sans',anchor:'end',spacing:1.8});
const credits=()=>text(75,1197,'FOTO / PHOTO: JEFF BUSBY / OPERA AUSTRALIA',15,{family:'sans',spacing:1.15,opacity:.88});
const def='<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#101426"/><stop offset=".6" stop-color="#24162e"/><stop offset="1" stop-color="#101729"/></linearGradient><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#07132c" stop-opacity=".74"/><stop offset=".28" stop-color="#07132c" stop-opacity=".12"/><stop offset=".47" stop-color="#08132e" stop-opacity=".50"/><stop offset=".72" stop-color="#0e1127" stop-opacity=".92"/><stop offset="1" stop-color="#0e1127" stop-opacity="1"/></linearGradient><linearGradient id="shaded" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#0d142b" stop-opacity=".82"/><stop offset=".38" stop-color="#0d142b" stop-opacity=".49"/><stop offset=".65" stop-color="#0d142b" stop-opacity=".82"/><stop offset="1" stop-color="#0d142b" stop-opacity="1"/></linearGradient></defs>';
async function save(n,name,inner){
 const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+def+inner+'</svg>');
 const bytes=await sharp(svg).jpeg({quality:90,mozjpeg:true}).toBuffer();
 const file=path.join(out,String(n).padStart(2,'0')+'-'+name+'.jpg');
 await fs.writeFile(file,bytes);
 const m=await sharp(bytes).metadata();
 if(m.width!==1080||m.height!==1350)throw Error(file+' invalid geometry');
 console.log(file,bytes.length,m.width,m.height);
}
await save(1,'cover',
  photo('crowd')+rect(0,0,W,H,'url(#shade)')+head(1)+
  text(540,760,'MY FAIR LADY',109,{anchor:'middle',bold:true})+
  line(405,795,270)+
  text(540,876,'SLAVÍ 70 LET',73,{anchor:'middle',bold:true})+
  text(540,934,'CELEBRATES 70 YEARS',46,{anchor:'middle',italic:true,color:cl.gold})+
  text(540,1017,'Od londýnské květinářky k legendě.',33,{anchor:'middle'})+
  text(540,1067,'From a flower girl to a legend.',34,{anchor:'middle',italic:true})+
  text(540,1153,'OYA CANLI',20,{anchor:'middle',family:'sans',spacing:4})+
  credits()
);
await save(2,'broadway',
  rect(0,0,W,H,'url(#bg)')+head(2)+
  text(540,456,'1956',235,{anchor:'middle',bold:true,color:cl.gold,opacity:.38})+
  text(540,596,'ZROD LEGENDY',78,{anchor:'middle',bold:true})+
  text(540,658,'A LEGEND IS BORN',50,{anchor:'middle',italic:true,color:cl.gold})+
  line(421,704,238)+
  text(540,804,'15. BŘEZNA · BROADWAY',30,{anchor:'middle',family:'sans',spacing:1.1})+
  text(540,849,'15 MARCH · BROADWAY',25,{anchor:'middle',family:'sans',spacing:1.2,color:cl.gold})+
  text(540,941,'JULIE ANDREWS  ×  REX HARRISON',33,{anchor:'middle',bold:true})+
  text(540,1036,'2 717 představení / 2,717 performances',31,{anchor:'middle'})+
  text(540,1103,'Tony 1957 · nejlepší muzikál / Best Musical',27,{anchor:'middle',italic:true})
);
await save(3,'eliza',
  rect(0,0,W,H,'url(#bg)')+head(3)+
  text(75,347,'DVĚ IKONICKÉ ELIZY',74,{bold:true})+
  text(75,410,'TWO ICONIC ELIZAS',52,{italic:true,color:cl.gold})+
  line(75,446,220)+
  rect(74,517,932,429,'none','stroke="#CBA676" stroke-width="1" opacity=".65"')+
  rect(540,517,1,429,'#CBA676')+
  text(118,608,'BROADWAY',24,{family:'sans',spacing:2.7,color:cl.gold})+
  text(118,717,'JULIE',75,{bold:true})+
  text(118,799,'ANDREWS',65,{bold:true})+
  text(118,881,'1956',29,{family:'sans',spacing:4})+
  text(585,608,'FILM / MOVIE',24,{family:'sans',spacing:2.7,color:cl.gold})+
  text(585,717,'AUDREY',71,{bold:true})+
  text(585,799,'HEPBURN',67,{bold:true})+
  text(585,881,'1964',29,{family:'sans',spacing:4})+
  text(540,1021,'8 OSCARŮ / 8 ACADEMY AWARDS',30,{anchor:'middle',family:'sans',bold:true})+
  text(540,1103,'Většinu Eliziných písní zpívala Marni Nixon.',28,{anchor:'middle',italic:true})+
  text(540,1147,'Marni Nixon sang most of Eliza’s songs.',29,{anchor:'middle',italic:true,color:cl.gold})
);
await save(4,'songs',
  photo('dance')+rect(0,0,W,H,'url(#shade)')+head(4)+
  text(75,348,'PÍSNĚ, KTERÉ NESTÁRNOU',67,{bold:true})+
  text(75,411,'SONGS THAT NEVER GROW OLD',45,{italic:true,color:cl.gold})+
  line(75,449,210)+
  text(76,800,'I Could Have Danced All Night',46,{italic:true})+
  rect(76,823,926,1,cl.muted)+
  text(76,901,'Wouldn’t It Be Loverly?',48,{italic:true})+
  rect(76,926,926,1,cl.muted)+
  text(76,1007,'On the Street Where You Live',46,{italic:true})+
  text(75,1094,'Hudba, která vypráví příběh.',33,{italic:true})+
  text(75,1135,'Music that tells the story.',35,{italic:true,color:cl.gold})+
  credits()
);
await save(5,'voice',
  photo('solo')+rect(0,0,W,H,'url(#shaded)')+head(5)+
  text(75,352,'VÍC NEŽ PROMĚNA',73,{bold:true})+
  text(75,416,'MORE THAN A MAKEOVER',48,{italic:true,color:cl.gold})+
  line(75,459,225)+
  text(75,928,'Nejde o přízvuk.',54,{bold:true})+
  text(75,990,'It isn’t about her accent.',42,{italic:true,color:cl.gold})+
  text(75,1086,'Jde o vlastní hlas.',56,{bold:true})+
  text(75,1142,'It’s about finding her own voice.',39,{italic:true,color:cl.gold})+
  credits()
);
await save(6,'2026',
  rect(0,0,W,H,'url(#bg)')+head(6)+
  text(76,331,'2026: PŘÍBĚH ŽIJE DÁL',69,{bold:true})+
  text(76,390,'THE STORY LIVES ON',49,{italic:true,color:cl.gold})+
  line(76,425,224)+
  photo('duo',75,475,930,490)+
  rect(75,475,930,490,'none','stroke="#C9A473" stroke-width="1" opacity=".7"')+
  text(995,999,'FOTO / PHOTO: SYDNEY 2026',16,{family:'sans',anchor:'end',spacing:1.5})+
  text(76,1071,'SYDNEY',39,{family:'sans',bold:true,spacing:2,color:cl.gold})+
  text(76,1127,'16.–31. 10. 2026',34,{bold:true})+
  text(559,1071,'PITLOCHRY',39,{family:'sans',bold:true,spacing:2,color:cl.gold})+
  text(559,1127,'21. 11.–31. 12. 2026',34,{bold:true})+
  credits()
);
await save(7,'closing',
  photo('crowd')+rect(0,0,W,H,'url(#shade)')+head(7)+
  text(540,586,'NEJDE JEN O PROMĚNU.',69,{anchor:'middle',bold:true})+
  text(540,655,'IT’S MORE THAN A MAKEOVER.',46,{anchor:'middle',italic:true,color:cl.gold})+
  line(388,707,304)+
  text(540,798,'JDE O VLASTNÍ HLAS.',71,{anchor:'middle',bold:true})+
  text(540,864,'IT’S ABOUT FINDING HER OWN VOICE.',40,{anchor:'middle',italic:true,color:cl.gold})+
  text(540,1012,'Celý článek Oyi Canli',38,{anchor:'middle',italic:true})+
  text(540,1059,'Read Oya Canli’s article',36,{anchor:'middle',italic:true,color:cl.gold})+
  text(540,1143,'AJSEE.CZ',39,{anchor:'middle',family:'sans',bold:true,spacing:4})+
  credits()
);