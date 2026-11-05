
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const W=1080,H=1350;
const DIR='assets/editorial/my-fair-lady-70-years-musical-legend';
const OUT='assets/social/my-fair-lady-70-years-ig';
await fs.mkdir(OUT,{recursive:true});
const colors={dark:'#10182b',ink:'#15162a',gold:'#deb878',cream:'#fff5e8',muted:'#d5c5af'};
const photoNames={
  crowd:'eliza-ensemble-jeff-busby.jpg',
  solo:'eliza-solo-jeff-busby.jpg',
  duo:'eliza-higgins-jeff-busby.jpg',
  dance:'ensemble-jeff-busby.jpg',
};
const photos={};
for(const [k,v] of Object.entries(photoNames))photos[k]='data:image/jpeg;base64,'+(await fs.readFile(path.join(DIR,v))).toString('base64');
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const txt=(x,y,str,size=40,opts={})=>{
 const {fill=colors.cream,font='serif',weight=400,italic=false,spacing=0,anchor='start',opacity=1}=opts;
 const family=font==='sans'?'DejaVu Sans,Arial,sans-serif':'Liberation Serif,Georgia,serif';
 return '<text x="'+x+'" y="'+y+'" fill="'+fill+'" opacity="'+opacity+'" font-size="'+size+'" font-family="'+family+'" font-weight="'+weight+'" '+(italic?'font-style="italic" ':'')+'letter-spacing="'+spacing+'" text-anchor="'+anchor+'">'+xml(str)+'</text>';
};
const rect=(x,y,w,h,color,extra='')=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+color+'" '+extra+'/>';
const rule=(x,y,w=140)=>rect(x,y,w,2,colors.gold);
const bg=rect(0,0,W,H,'url(#navy)');
const photograph=(key,x=0,y=0,w=W,h=H,op=1)=>'<image x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" href="'+photos[key]+'" preserveAspectRatio="xMidYMid slice" opacity="'+op+'"/>';
const credit=txt(74,1196,'FOTO: JEFF BUSBY / OPERA AUSTRALIA',14,{font:'sans',spacing:1.7,opacity:.86});
const base=(i)=>txt(76,178,'AJSEE EDITORIAL',23,{font:'sans',weight:600,spacing:5})+rect(76,192,210,2,colors.gold)+txt(996,178,String(i).padStart(2,'0')+' / 07',20,{font:'sans',anchor:'end',spacing:1.5});
const defs='<defs><linearGradient id="navy" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#0d1128"/><stop offset=".56" stop-color="#22172f"/><stop offset="1" stop-color="#0a1827"/></linearGradient><linearGradient id="shade" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#0b1023" stop-opacity=".68"/><stop offset=".25" stop-color="#0b1023" stop-opacity=".12"/><stop offset=".57" stop-color="#101329" stop-opacity=".54"/><stop offset=".79" stop-color="#0e1021" stop-opacity=".94"/><stop offset="1" stop-color="#0d0f20" stop-opacity="1"/></linearGradient><linearGradient id="shademore" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#0e152c" stop-opacity=".87"/><stop offset=".38" stop-color="#10172e" stop-opacity=".40"/><stop offset=".7" stop-color="#11162c" stop-opacity=".88"/><stop offset="1" stop-color="#0e1229" stop-opacity="1"/></linearGradient><linearGradient id="horizontal" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#10142a" stop-opacity=".98"/><stop offset=".67" stop-color="#10142a" stop-opacity=".64"/><stop offset="1" stop-color="#10142a" stop-opacity=".22"/></linearGradient></defs>';
const render=async (number,name,body)=>{
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+defs+body+'</svg>';
 const bytes=await sharp(Buffer.from(svg)).png({compressionLevel:9}).toBuffer();
 const info=await sharp(bytes).metadata();
 if(info.width!==W||info.height!==H)throw new Error('Bad canvas');
 await fs.writeFile(path.join(OUT,String(number).padStart(2,'0')+'-'+name+'.png'),bytes);
 console.log(name+' '+Math.round(bytes.length/1024)+' KiB');
};
// Slide 1: optional true-photo alternative to the previously approved AI cover
await render(1,'uvod', photograph('crowd')+rect(0,0,W,H,'url(#shade)')+
 base(1)+
 txt(540,828,'MY FAIR LADY',108,{weight:700,anchor:'middle',spacing:-1})+
 rule(388,858,304)+
 txt(540,955,'SLAVÍ 70 LET',72,{weight:700,anchor:'middle'})+
 txt(540,1036,'Od londýnské květinářky',40,{italic:true,anchor:'middle'})+
 txt(540,1084,'k muzikálové legendě',40,{italic:true,anchor:'middle'})+
 txt(540,1164,'OYA CANLI',20,{font:'sans',anchor:'middle',spacing:5})+
 credit
);
// Slide 2: historical facts without fabricated 1956 photographs
await render(2,'broadway-1956',bg+
 rect(75,262,930,732,'none','stroke="#d7b680" stroke-width="1" opacity=".42"')+
 txt(540,560,'1956',232,{weight:700,fill:'#d6b27d',anchor:'middle',opacity:.25,spacing:-8})+
 txt(540,680,'TADY TO',79,{weight:700,anchor:'middle'})+
 txt(540,765,'ZAČALO.',91,{weight:700,anchor:'middle'})+
 rule(436,806,208)+
 txt(540,886,'15. BŘEZNA  •  BROADWAY',26,{font:'sans',anchor:'middle',spacing:2})+
 txt(540,933,'Julie Andrews a Rex Harrison',34,{italic:true,anchor:'middle'})+
 txt(540,1043,'2 717 PŘEDSTAVENÍ',31,{font:'sans',weight:700,anchor:'middle',spacing:2})+
 txt(540,1100,'Tony 1957 za nejlepší muzikál',27,{anchor:'middle'})+
 base(2)
);
// Slide 3: Hollywood relationship, no fake actor portraits
await render(3,'dve-elizy',bg+
 base(3)+txt(76,340,'DVĚ ELIZY.',85,{weight:700})+
 txt(76,431,'JEDNA LEGENDA.',70,{weight:700})+rule(76,470,237)+
 rect(72,525,936,440,'none','stroke="#bc9975" stroke-width="1" opacity=".6"')+
 rect(540,525,1,440,'#bc9975')+
 txt(120,622,'BROADWAY',24,{font:'sans',spacing:3.5,fill:colors.gold})+
 txt(120,731,'JULIE',71,{weight:700})+
 txt(120,804,'ANDREWS',62,{weight:700})+
 txt(120,889,'1956',29,{font:'sans',spacing:4})+
 txt(594,622,'HOLLYWOOD',24,{font:'sans',spacing:3.5,fill:colors.gold})+
 txt(594,731,'AUDREY',65,{weight:700})+
 txt(594,804,'HEPBURN',65,{weight:700})+
 txt(594,889,'1964',29,{font:'sans',spacing:4})+
 txt(540,1050,'8 OSCARŮ PRO FILM Z ROKU 1964',27,{font:'sans',anchor:'middle',spacing:1})+
 txt(540,1107,'Většinu Eliziných písní nazpívala Marni Nixon.',28,{italic:true,anchor:'middle'})
);
// Slide 4: actual 2026 production photo of ballroom ensemble
await render(4,'pisne',photograph('dance')+rect(0,0,W,H,'url(#shade)')+
 base(4)+txt(76,339,'PÍSNĚ, KTERÉ',75,{weight:700})+
 txt(76,426,'NESTÁRNOU.',85,{weight:700})+rule(76,456,186)+
 txt(76,813,'I Could Have Danced All Night',44,{italic:true})+
 rect(76,843,930,1,'#9d8e7f')+
 txt(76,901,'Wouldn’t It Be Loverly?',43,{italic:true})+
 rect(76,934,930,1,'#9d8e7f')+
 txt(76,991,'On the Street Where You Live',43,{italic:true})+
 rect(76,1023,930,1,'#9d8e7f')+
 txt(76,1100,'Hudba, která vypráví víc než slova.',35,{italic:true})+
 credit
);
// Slide 5: central thematic conclusion; authentic Claire Lyon photo
await render(5,'vlastni-hlas',photograph('solo')+rect(0,0,W,H,'url(#shademore)')+
 base(5)+txt(75,348,'KDO ROZHODUJE,',69,{weight:700})+
 txt(75,423,'CO Z NĚKOHO',69,{weight:700})+
 txt(75,499,'DĚLÁ „DÁMU“?',72,{weight:700})+
 rule(75,529,190)+
 txt(76,924,'Elizina skutečná proměna',44,{italic:true})+
 txt(76,982,'není v jejím přízvuku.',44,{italic:true})+
 txt(76,1078,'Je v odvaze najít',56,{weight:700})+
 txt(76,1138,'vlastní hlas.',63,{weight:700})+
 credit
);
// Slide 6: clearly labelled contemporaneous Sydney photo
await render(6,'jubilejni-rok',photograph('duo')+rect(0,0,W,H,'url(#shade)')+
 base(6)+txt(76,331,'70 LET. A PŘÍBĚH',72,{weight:700})+
 txt(76,411,'ŽIJE DÁL.',91,{weight:700})+
 rule(76,453,165)+
 txt(76,820,'SYDNEY',46,{font:'sans',weight:700,spacing:4,fill:colors.gold})+
 txt(76,883,'16.–31. 10. 2026',38,{weight:700})+
 txt(76,940,'Inscenace vycházející z režie Julie Andrews.',28,{italic:true})+
 rect(76,970,930,1,'#d6b27d')+
 txt(76,1033,'PITLOCHRY, SKOTSKO',36,{font:'sans',weight:700,spacing:2,fill:colors.gold})+
 txt(76,1095,'21. 11.–31. 12. 2026',36,{weight:700})+
 credit
);
// Slide 7: CTA, quiet closing, photo under tint
await render(7,'zaver',photograph('crowd')+rect(0,0,W,H,'url(#shademore)')+
 base(7)+txt(540,553,'NEJDE O TO',69,{weight:700,anchor:'middle'})+
 txt(540,637,'STÁT SE DÁMOU.',69,{weight:700,anchor:'middle'})+
 rule(387,679,306)+
 txt(540,796,'JDE O TO NAJÍT',70,{weight:700,anchor:'middle'})+
 txt(540,884,'VLASTNÍ HLAS.',78,{weight:700,anchor:'middle'})+
 txt(540,1035,'Celý článek Oyi Canli',37,{italic:true,anchor:'middle'})+
 txt(540,1098,'NA AJSEE.CZ',35,{font:'sans',weight:700,anchor:'middle',spacing:3})+
 credit
);
