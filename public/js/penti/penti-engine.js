/* ==========================================================================
   PENTI ENGINE — sdílené výpočetní jádro kalkulaček
   --------------------------------------------------------------------------
   Záměrně oddělené od obrazovky (žádné čtení DOM, žádné kreslení).
   Dostane vstupní objekt, vrátí čísla. Stejný engine použije web i SkladPRO.

   Dva moduly:
     PentiEngine.geometrieStrechy(zadani) ... MODUL STŘECHA (plochy, hrany)
     PentiEngine.cenaVazniku(geom, opts)  ... MODUL VAZNÍKY (cena)

   Logika i konstanty jsou převzaté 1:1 z původní kalkulačky vazníků
   (verze 2026-06-15) — pouze přesunuté sem a zbavené vazby na DOM.
   ========================================================================== */
(function(global){
"use strict";

/* ---- POPISKY TVARŮ ----
   Jen texty do rozhraní. Sazby a koeficienty, které tu dřív stály vedle
   nich, se 28. 8. 2026 přestěhovaly do `penti-cenik-vazniky.js` — tenhle
   soubor se totiž načítá i na veřejném webu a neměl by tam co dělat
   montážní balíček ani jména dopravců. */
/* `lomena` = lomená sedlová (od 13. 9. 2026): každá strana má dva sklony —
   mírnější od okapu po zlom, strmější od zlomu k hřebeni. Zlom se zadává
   vodorovně od zdi (pozednice), stejně jako se „ze zdí" počítá hřeben. */
const POPISKY_STRECHY={pultova:'pultová', sedlova:'sedlová', valbova:'valbová', lomena:'lomená sedlová'};
const POPISKY_PUDORYSU={obdelnik:'obdélník', ctverec:'čtverec', L:'L', U:'U',
  T:'T', lichobeznik:'lichoběžník', vlastni:'vlastní půdorys'};

/* ==========================================================================
   GEOMETRIE (modul STŘECHA) — čisté funkce
   ========================================================================== */

/* půdorysný polygon podle tvaru a rozměrů (d = objekt rozměrů v metrech) */
function buildPoly(fp,d){
  const v=k=>parseFloat(d[k])||0;
  if(fp==='obdelnik'){const A=v('A'),B=v('B');return {poly:[[0,0],[A,0],[A,B],[0,B]],span:Math.min(A,B),rect:[A,B]};}
  if(fp==='ctverec'){const A=v('A');return {poly:[[0,0],[A,0],[A,A],[0,A]],span:A,rect:[A,A]};}
  if(fp==='L'){const L1=v('L1'),W1=v('W1'),L2=v('L2'),W2=v('W2');
    return {poly:[[0,0],[L1,0],[L1,W1],[W2,W1],[W2,L2],[0,L2]],span:Math.max(W1,W2)};}
  if(fp==='T'){const A=v('A'),TW=v('TW'),SW=v('SW'),SL=v('SL');const c0=(A-SW)/2,c1=(A+SW)/2;
    return {poly:[[c0,0],[c1,0],[c1,SL],[A,SL],[A,SL+TW],[0,SL+TW],[0,SL],[c0,SL]],span:Math.max(TW,SW)};}
  if(fp==='U'){const UA=v('UA'),UD=v('UD'),WW=v('WW'),WL=v('WL');
    return {poly:[[0,0],[UA,0],[UA,UD+WL],[UA-WW,UD+WL],[UA-WW,UD],[WW,UD],[WW,UD+WL],[0,UD+WL]],span:Math.max(UD,WW)};}
  if(fp==='lichobeznik'){const A=v('A'),C=v('C'),B=v('B');
    return {poly:[[0,0],[A,0],[C,B],[0,B]],span:B};}
}
function parea(poly){let s=0,n=poly.length;for(let i=0;i<n;i++){const[x1,y1]=poly[i],[x2,y2]=poly[(i+1)%n];s+=x1*y2-x2*y1;}return s/2;}
function perim(poly){let p=0,n=poly.length;for(let i=0;i<n;i++){const[x1,y1]=poly[i],[x2,y2]=poly[(i+1)%n];p+=Math.hypot(x2-x1,y2-y1);}return p;}
function ensureCCW(poly){return parea(poly)<0?poly.slice().reverse():poly;}
/* ══════════════════════════════════════════════════════════════════════
   OBRYS STŘECHY = ZDIVO ODSAZENÉ O PŘESAHY
   ----------------------------------------------------------------------
   Každá stěna se odsadí o svůj vlastní přesah (u okapu jiný než u štítu)
   a rohy vzniknou protnutím dvou sousedních odsazených přímek.

   SCHOD, KDYŽ JEDNA ZEĎ NESE DVA PŘESAHY
   Jedna přímá zeď může sloužit dvěma křídlům — zčásti pod štítem, zčásti
   pod okapem. Její dvě části pak mají různý přesah a odsazené přímky jsou
   ROVNOBĚŽNÉ, takže se neprotnou. Do 26. 8. 2026 se v tom případě vzal
   jen začátek té druhé, čímž vznikla ŠIKMÁ ČÁRA přes celý ten rozdíl.
   Střecha se pak sama v sobě přesahovala a úžlabí, které z toho schodu
   má vzniknout, se nevytvořilo.

   Nahlásil PENTI 26. 8. 2026 na zakázce 165_26 RD Bohuslavice a doložil
   to dvěma délkami krokví na témže štítu: 4,456 a 4,099 m. Rozdíl je
   v půdoryse 0,292 m — přesně rozdíl přesahů 0,5 a 0,2.

   Místo šikmé čáry se proto vloží PRAVOÚHLÝ SCHOD: dva body kolmo ke zdi
   místo jednoho. Rovnoběžné hrany se stejným přesahem se chovají jako
   dřív, takže obdélník ani žádný jiný dosud zadaný tvar se nehne.
   ══════════════════════════════════════════════════════════════════════ */
function offsetPer(poly,oArr){const n=poly.length,lines=[]; // odsadí každou hranu vlastní hodnotou (okap vs štít)
  for(let i=0;i<n;i++){const[x1,y1]=poly[i],[x2,y2]=poly[(i+1)%n];let dx=x2-x1,dy=y2-y1,Ln=Math.hypot(dx,dy);dx/=Ln;dy/=Ln;const o=oArr[i]||0;lines.push([x1+dy*o,y1-dx*o,dx,dy,o]);}
  const res=[];for(let i=0;i<n;i++){const a=lines[(i-1+n)%n],b=lines[i];const[ax,ay,adx,ady,ao]=a,[bx,by,bdx,bdy,bo]=b;const den=adx*bdy-ady*bdx;
    if(Math.abs(den)<1e-9){
      /* Rovnoběžné odsazené přímky. Stejný přesah = zeď pokračuje rovně,
         stačí jeden bod. Různý přesah = SCHOD kolmo ke zdi. */
      if(Math.abs(ao-bo)<1e-9){res.push([bx,by]);continue;}
      const roh=poly[i], kx=bdy, ky=-bdx;              // normála zdi, ven
      res.push([roh[0]+kx*ao, roh[1]+ky*ao]);          // konec prvního odsazení
      res.push([roh[0]+kx*bo, roh[1]+ky*bo]);          // začátek druhého
      continue;
    }
    const t=((bx-ax)*bdy-(by-ay)*bdx)/den;res.push([ax+adx*t,ay+ady*t]);}return res;}

/* indexy ŠTÍTOVÝCH hran (dostanou přesah u štítu); ctx={roof,fp,pultDir,endState} */
function gableEdgesForPoly(poly,sh,ctx){
  const n=poly.length;
  if(ctx.roof==='valbova')return new Set();
  if(ctx.fp==='obdelnik'||ctx.fp==='ctverec'){
    if(ctx.roof==='pultova'){const EV={dolu:[0,-1],nahoru:[0,1],vlevo:[-1,0],vpravo:[1,0]}[ctx.pultDir];const s=new Set();
      for(let i=0;i<n;i++){const p=poly[i],q=poly[(i+1)%n];let dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;if(Math.abs(dx*EV[0]+dy*EV[1])>0.7)s.add(i);}return s;}
    const A=sh.rect[0],B=sh.rect[1];return (A>=B)?new Set([1,3]):new Set([0,2]);  // sedlová: štít = kratší pár
  }
  return new Set(Object.keys(ctx.endState).filter(k=>ctx.endState[k]).map(Number)); // L/U/T dle voleb konců
}
function pip(px,py,poly){let n=poly.length,ins=false,j=n-1;for(let i=0;i<n;i++){const[xi,yi]=poly[i],[xj,yj]=poly[j];if(((yi>py)!=(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi))ins=!ins;j=i;}return ins;}
function solve2(a11,a12,b1,a21,a22,b2){const d=a11*a22-a12*a21;if(Math.abs(d)<1e-12)return null;return [(b1*a22-a12*b2)/d,(a11*b2-b1*a21)/d];}

/* VÁŽENÝ přímý skelet: každá hrana má svůj sklon (slopes[i] ve °); uzly = stejná výška */
function skeleton(poly,slopes,gableSet,vyskyOkapu){
  gableSet=gableSet||new Set();const n=poly.length;
  /* VÝŠKA OKAPU PO HRANÁCH (PENTI 8. 10. 2026: „zdi stejně vysoko")
     Rovina hrany i je z = h_i + g_i·(vzdálenost od okapové hrany). Dřív
     bylo h = 0 pro všechny hrany, tj. všechny OKAPY ve stejné výšce — u
     nesouměrné sedlové (jiný sklon nebo přesah) to posunulo hřeben jinam,
     než kde ho má krov (zdi stejně vysoko). Bez `vyskyOkapu` je vše 0
     jako dřív. */
  const hO=poly.map((p,i)=>(vyskyOkapu&&vyskyOkapu[i])||0);
  const ed=poly.map((p,i)=>{const q=poly[(i+1)%n];let dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;return {a:p,b:q,dir:[dx,dy],nrm:[-dy,dx],c:(-dy)*p[0]+dx*p[1],i};});
  const ori=e=>Math.abs(e.dir[0])>Math.abs(e.dir[1])?'H':'V';
  const dsg=(px,py,e)=>{const[x1,y1]=e.a,[x2,y2]=e.b;let dx=x2-x1,dy=y2-y1,L2=dx*dx+dy*dy;let t=L2?Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/L2)):0;return Math.hypot(px-(x1+t*dx),py-(y1+t*dy));};
  const sv3=(A,B)=>{const M=A.map((r,i)=>r.concat(B[i]));for(let c=0;c<3;c++){let pv=c;for(let r=c+1;r<3;r++)if(Math.abs(M[r][c])>Math.abs(M[pv][c]))pv=r;[M[c],M[pv]]=[M[pv],M[c]];if(Math.abs(M[c][c])<1e-9)return null;for(let r=0;r<3;r++)if(r!=c){const f=M[r][c]/M[c][c];for(let k=c;k<4;k++)M[r][k]-=f*M[c][k];}}return [M[0][3]/M[0][0],M[1][3]/M[1][1],M[2][3]/M[2][2]];};
  const g=ed.map(e=>Math.tan(((slopes[e.i]||30))*Math.PI/180)); // gradient roviny každé hrany
  const sites=ed.filter(e=>!gableSet.has(e.i));
  const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
  const span=Math.max(maxx-minx,maxy-miny);
  /* ROVINA NESAHÁ ZA ÚŽLABÍ SVÉHO KOUTA (PENTI 23. 9. 2026)
     Uzly se hledají jako průsečíky tří NEKONEČNÝCH rovin. U vnitřního
     (konkávního) kouta půdorysu ale rovina okapu končí na úžlabí — dál
     už je rovina sousedního okapu. Bez téhle kontroly vznikl u valbové
     střechy do L (282_25: křídlo 5,9 m na čtverci 11,7 m) falešný uzel
     tam, kde rovina východního okapu křídla „prosakovala" pod čtvercovou
     část: hřeben křídla pokračoval o 5,8 m za styk nároží a úžlabí,
     nároží čtverce se v tom bodě zlomilo a trojúhelník 8,4 m² mezi
     falešným hřebenem a pravým nárožím nepatřil žádné rovině — chyběl
     v ploše střechy i v nabídce.
     Pro každou okapovou hranu s koutem (reflexní vrchol, soused je také
     okap) se vezme úžlabí v tom koutě (vážená osa obou rovin) a uzel
     rovin smí ležet jen na straně své hrany, nebo přímo na úžlabí. */
  const orient=(()=>{let s=0;for(let q=0;q<n;q++){const a=poly[q],b=poly[(q+1)%n];s+=a[0]*b[1]-b[0]*a[1];}return s>=0?1:-1;})();
  const kouty=ed.map(e=>{
    const out=[];
    [[ (e.i-1+n)%n, e.a ],[ (e.i+1)%n, e.b ]].forEach(([j,v])=>{
      if(gableSet.has(j)||gableSet.has(e.i))return;
      const f=ed[j];
      /* reflexní vrchol = zatáčka proti orientaci obrysu */
      const prev=(j===(e.i-1+n)%n)?f:e, next=(j===(e.i-1+n)%n)?e:f;
      const cr=prev.dir[0]*next.dir[1]-prev.dir[1]*next.dir[0];
      if(cr*orient>-1e-9)return;
      /* úžlabí: g_e·(nrm_e·p − c_e) = g_f·(nrm_f·p − c_f) */
      const ge=g[e.i], gf=g[f.i];
      const A=ge*e.nrm[0]-gf*f.nrm[0], B=ge*e.nrm[1]-gf*f.nrm[1], C=ge*e.c-gf*f.c;
      const mid=[(e.a[0]+e.b[0])/2,(e.a[1]+e.b[1])/2];
      const sgn=Math.sign(A*mid[0]+B*mid[1]-C);
      if(sgn) out.push({A,B,C,sgn});
    });
    return out;
  });
  const vKoute=(e,px,py)=>kouty[e.i].every(k=>{const v=k.A*px+k.B*py-k.C; return Math.abs(v)<1e-6 || Math.sign(v)===k.sgn;});
  let nodes=[];
  for(let a=0;a<sites.length;a++)for(let b=a+1;b<sites.length;b++)for(let c=b+1;c<sites.length;c++){
    const ei=sites[a],ej=sites[b],ek=sites[c],gi=g[ei.i],gj=g[ej.i],gk=g[ek.i];
    const sol=sv3([[gi*ei.nrm[0],gi*ei.nrm[1],-1],[gj*ej.nrm[0],gj*ej.nrm[1],-1],[gk*ek.nrm[0],gk*ek.nrm[1],-1]],[gi*ei.c-hO[ei.i],gj*ej.c-hO[ej.i],gk*ek.c-hO[ek.i]]);
    if(!sol)continue;const px=sol[0],py=sol[1],z=sol[2];
    if(z<1e-6||z>span*3)continue;
    if(!pip(px,py,poly)&&!pip(px+1e-4,py+1e-4,poly))continue;
    if(!vKoute(ei,px,py)||!vKoute(ej,px,py)||!vKoute(ek,px,py))continue;
    let ok=true;for(const m of sites){if(m===ei||m===ej||m===ek)continue;if(hO[m.i]+g[m.i]*dsg(px,py,m)<z-1e-3){ok=false;break;}}
    if(!ok)continue;
    nodes.push({p:[px,py],z,set:new Set([ei.i,ej.i,ek.i])});}
  {const TOL=Math.max(0.2,span*0.085);for(let pass=0;pass<4;pass++){const merged=[];for(const nd of nodes){let m=merged.find(x=>Math.hypot(x.p[0]-nd.p[0],x.p[1]-nd.p[1])<TOL);if(m){m.p=[(m.p[0]+nd.p[0])/2,(m.p[1]+nd.p[1])/2];m.z=(m.z+nd.z)/2;nd.set.forEach(v=>m.set.add(v));}else merged.push({p:nd.p.slice(),z:nd.z,set:new Set(nd.set)});}nodes=merged;}}
  for(const e of sites){const pv=(e.i-1+n)%n;if(!gableSet.has(pv))nodes.push({p:e.a.slice(),z:hO[e.i],set:new Set([pv,e.i])});}
  const parEdge=(a,b)=>Math.abs(a.dir[0]*b.dir[1]-a.dir[1]*b.dir[0])<0.03;
  for(const gg of gableSet){const pv=(gg-1+n)%n,nn=(gg+1)%n;if(gableSet.has(pv)||gableSet.has(nn))continue;const ep=ed[pv],en=ed[nn];   // uzel hřebene u štítu i pro nerovnoběžné okapy (šikmý hřeben)
    const Eg=ed[gg],gi=g[pv],gj=g[nn];
    const sol=solve2(gi*ep.nrm[0]-gj*en.nrm[0],gi*ep.nrm[1]-gj*en.nrm[1],gi*ep.c-gj*en.c-hO[pv]+hO[nn], Eg.nrm[0],Eg.nrm[1],Eg.c);
    if(!sol)continue;const z=hO[pv]+gi*(ep.nrm[0]*sol[0]+ep.nrm[1]*sol[1]-ep.c);
    nodes.push({p:sol,z,set:new Set([pv,nn])});}
  const segs=[];let ridge=0,hip=0,valley=0;
  const pairset=new Set();for(const nd of nodes){const arr=[...nd.set];for(let x=0;x<arr.length;x++)for(let y=x+1;y<arr.length;y++)pairset.add(Math.min(arr[x],arr[y])+'_'+Math.max(arr[x],arr[y]));}
  for(const key of pairset){const[i,j]=key.split('_').map(Number);if(gableSet.has(i)||gableSet.has(j))continue;
    const nn2=nodes.filter(nd=>nd.set.has(i)&&nd.set.has(j));if(nn2.length<2)continue;
    let dir=[nn2[1].p[0]-nn2[0].p[0],nn2[1].p[1]-nn2[0].p[1]],dl=Math.hypot(dir[0],dir[1])||1;dir=[dir[0]/dl,dir[1]/dl];
    nn2.sort((u,v)=>(u.p[0]*dir[0]+u.p[1]*dir[1])-(v.p[0]*dir[0]+v.p[1]*dir[1]));
    const ei=ed[i],ej=ed[j],par=parEdge(ei,ej),adj=(Math.abs(i-j)===1||Math.abs(i-j)===n-1),dotN=ei.nrm[0]*ej.nrm[0]+ei.nrm[1]*ej.nrm[1];
    // par = rovnoběžné protilehlé okapy → vodorovný hřeben; nesousední okapy s normálami proti sobě (dotN<−0,3) → ŠIKMÝ (stoupavý) hřeben u sbíhavých okapů; sousední → nároží/úžlabí
    let type;if(par)type='hreben';else if(adj){const sx=((i+1)%n===j)?j:i;const p0=poly[(sx-1+n)%n],p1=poly[sx],p2=poly[(sx+1)%n];const cr=(p1[0]-p0[0])*(p2[1]-p1[1])-(p1[1]-p0[1])*(p2[0]-p1[0]);type=cr<0?'uzlabi':'narozi';}else type=(dotN<-0.3)?'hreben':'narozi';
    for(let s=0;s<nn2.length-1;s++){const A=nn2[s],B=nn2[s+1];const Lp=Math.hypot(B.p[0]-A.p[0],B.p[1]-A.p[1]);if(Lp<0.05)continue;
      const mid=[(A.p[0]+B.p[0])/2,(A.p[1]+B.p[1])/2];if(!pip(mid[0],mid[1],poly))continue;
      const L3=Math.hypot(Lp,B.z-A.z);
      if(type=='hreben')ridge+=L3;else if(type=='uzlabi')valley+=L3;else hip+=L3;segs.push({type,A:A.p,B:B.p,delka:L3});}}   // delka = skutečná délka ve sklonu
  /* ══════════════════════════════════════════════════════════════════════
     TÁŽ ČÁRA JEN JEDNOU
     ----------------------------------------------------------------------
     Hřeben vzniká jako osa mezi DVOJICÍ protilehlých okapů. Když je jedna
     stěna domu rozdělená na víc okapových hran — což je přesně případ
     tvaru T, kde krček dělí zadní stěnu na tři kusy — vyjde stejná osa
     z několika dvojic a do seznamu se dostane několikrát.

     Objeveno 1. 9. 2026: na téčku 14×6 s krčkem 5×5 vycházel hřeben
     29,5 m místo 13,5 m, protože hlavní hřeben tam byl třikrát. Nešlo
     o zaokrouhlení — byly to doslova tři úsečky se stejnými konci.
     Platilo se podle toho montáž hřebene, hřebenáče, větrací pás
     i držáky latě; na jedné střeše to dělalo kolem 28 000 Kč navíc.
     Obdélníku, L, U, čtverce ani lichoběžníku se to netýkalo.

     Úseky se proto porovnají podle konců (na centimetr, a nezáleží na
     tom, kterým směrem jsou zapsané) a druhu. Co se opakuje, vypadne
     — a stejnou délku je nutné odečíst i ze součtů, jinak by tabulka
     říkala něco jiného než výkres. */
  { const rnd2=p=>Math.round(p[0]*100)+','+Math.round(p[1]*100);
    const klic=s=>{ const a=rnd2(s.A), b=rnd2(s.B); return s.type+'|'+(a<b?a+'|'+b:b+'|'+a); };
    const videno=new Set(), keep=[]; let dupR=0,dupH=0,dupU=0;
    segs.forEach(s=>{ const k=klic(s);
      if(videno.has(k)){ if(s.type==='hreben')dupR+=s.delka; else if(s.type==='uzlabi')dupU+=s.delka; else dupH+=s.delka; return; }
      videno.add(k); keep.push(s); });
    if(keep.length!==segs.length){
      segs.length=0; keep.forEach(s=>segs.push(s));
      ridge=Math.max(0,ridge-dupR); hip=Math.max(0,hip-dupH); valley=Math.max(0,valley-dupU);
    } }

  // ODŘÍZNI FALEŠNÝ (nižší) HŘEBEN: úsek mezi uzlem KŘÍŽENÍ nároží+úžlabí a uzlem, kde hřeben SLEPĚ dobíhá jen do nároží
  // (za křížením už to není hřeben, ale střešní plocha). Nároží/úžlabí se nemění.
  { const rnd=p=>Math.round(p[0]*20)+'_'+Math.round(p[1]*20);
    const inc={}; const ai=(p,ty)=>{const k=rnd(p);const o=inc[k]||(inc[k]={h:0,nar:0,uz:0});if(ty==='hreben')o.h++;else if(ty==='uzlabi')o.uz++;else o.nar++;};
    segs.forEach(s=>{ai(s.A,s.type);ai(s.B,s.type);});
    const isCross=k=>!!(inc[k]&&inc[k].nar>0&&inc[k].uz>0);                 // kříží se nároží i úžlabí
    const isHipDead=k=>!!(inc[k]&&inc[k].nar>0&&inc[k].uz===0&&inc[k].h<=1); // jen nároží (+ tento jeden hřeben)
    const keep=[]; let rem=0;
    segs.forEach(s=>{ if(s.type==='hreben'){ const ka=rnd(s.A),kb=rnd(s.B);
      // skutečný hřeben křídla (U/L) je VODOROVNÝ → ponech; odřízni jen výrazně ŠIKMÝ (>~3,4°) falešný úsek
      const _Lp=Math.hypot(s.B[0]-s.A[0],s.B[1]-s.A[1])||1, _dz=Math.sqrt(Math.max(0,s.delka*s.delka-_Lp*_Lp));
      if(_dz/_Lp>0.06 && ((isCross(ka)&&isHipDead(kb))||(isCross(kb)&&isHipDead(ka)))){ rem+=s.delka; return; } } keep.push(s); });
    if(rem>0){ segs.length=0; keep.forEach(s=>segs.push(s)); ridge-=rem; }
  }
  let roofArea=0,okap=0,stit=0;
  const planeAgg={};   // per rovinu (klíč = index okapové hrany): projekční plocha + max vzdálenost od okapu
  const NG=200, cw=(maxx-minx)/NG||1, ch=(maxy-miny)/NG||1, ca=cw*ch;
  const own=new Int16Array(NG*NG); own.fill(-1);   // vlastnictví buňky (index okapové hrany) pro obrys roviny
  {for(let j=0;j<NG;j++){const py=miny+(j+0.5)*ch;for(let i=0;i<NG;i++){const px=minx+(i+0.5)*cw;if(!pip(px,py,poly))continue;
      let best=1e18,bg=g[sites[0].i],bestI=-1,bestSd=0;for(const e of sites){const sd=e.nrm[0]*px+e.nrm[1]*py-e.c;if(sd<-1e-9)continue;const z=hO[e.i]+g[e.i]*sd;if(z<best){best=z;bg=g[e.i];bestI=e.i;bestSd=sd;}}
      roofArea+=ca*Math.sqrt(1+bg*bg);
      if(bestI>=0){own[j*NG+i]=bestI;const pa=planeAgg[bestI]||(planeAgg[bestI]={proj:0,maxSd:0,cx:0,cy:0,cnt:0});pa.proj+=ca;if(bestSd>pa.maxSd)pa.maxSd=bestSd;pa.cx+=px;pa.cy+=py;pa.cnt++;}}}}  // cx,cy = těžiště roviny (půdorys)
  const gableLens={};   // skutečná (ve sklonu) délka štítové hrany na jednotlivé hraně obrysu (součet za hranu)
  for(let k=0;k<n;k++){const e=ed[k],len=Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1]);
    if(gableSet.has(k)){const pv=(k-1+n)%n,nx=(k+1)%n;const ga=!gableSet.has(pv)?g[pv]:(!gableSet.has(nx)?g[nx]:0);const sl=len*Math.sqrt(1+ga*ga);stit+=sl;gableLens[k]=sl;}else okap+=len;}
  // Rozdělení štítové hrany na jednotlivé rakové (štítové) úseky podle toho, kde na ni dosedá hřeben/nároží.
  // Každý úsek dostane vlastní délku VE SKLONU (sec dle přilehlé roviny) — aby se u sedlové ukázala každá polovina zvlášť.
  const gableSegs=[];
  let stit_L=0, stit_P=0;   // délka rakových (štítových) hran VE SKLONU rozdělená na LEVÉ a PRAVÉ krajovky (pohled na rovinu zvenčí)
  const dstep=Math.max(cw,ch)*1.5;   // krok dovnitř obrysu, aby vzorek nepadl přesně na hranu
  for(let k=0;k<n;k++){ if(!gableSet.has(k))continue;
    const a=ed[k].a, b=ed[k].b, dir=ed[k].dir, len=Math.hypot(b[0]-a[0],b[1]-a[1]); if(len<1e-6)continue;
    const pv=(k-1+n)%n, nx=(k+1)%n, slA=!gableSet.has(pv)?g[pv]:(!gableSet.has(nx)?g[nx]:0), slB=!gableSet.has(nx)?g[nx]:slA;
    const tol=Math.max(0.25, len*0.06);
    const cuts=[0,1];   // parametr t podél hrany, kde rozdělit
    segs.forEach(s=>{ [s.A,s.B].forEach(p=>{ const t=((p[0]-a[0])*dir[0]+(p[1]-a[1])*dir[1])/len;
      const perp=Math.abs((p[0]-a[0])*(-dir[1])+(p[1]-a[1])*dir[0]);
      if(perp<tol && t>0.04 && t<0.96){ if(!cuts.some(c=>Math.abs(c-t)<0.04)) cuts.push(t); } }); });
    cuts.sort((x,y)=>x-y);
    for(let c=0;c<cuts.length-1;c++){ const t0=cuts[c],t1=cuts[c+1],tm=(t0+t1)/2;
      const ga=(tm<0.5)?slA:slB; const projL=len*(t1-t0);
      const p0=[a[0]+dir[0]*len*t0, a[1]+dir[1]*len*t0], p1=[a[0]+dir[0]*len*t1, a[1]+dir[1]*len*t1];
      const segLen=projL*Math.sqrt(1+ga*ga);
      const gseg={a:p0, b:p1, delka:segLen, hrana:k, projL:projL};   // hrana + půdorysná délka: lomená střecha si délku ve sklonu přepočítá
      gableSegs.push(gseg);
      // --- L/P: ke kterému okapu (rovině) úsek patří + na které straně té roviny leží ---
      const mseg=[a[0]+dir[0]*len*tm, a[1]+dir[1]*len*tm];                 // střed úseku
      const pin=[mseg[0]+ed[k].nrm[0]*dstep, mseg[1]+ed[k].nrm[1]*dstep];  // krok dovnitř (nrm = do obrysu)
      let oi=-1; const gi=Math.floor((pin[0]-minx)/cw), gj=Math.floor((pin[1]-miny)/ch);
      if(gi>=0&&gi<NG&&gj>=0&&gj<NG) oi=own[gj*NG+gi];
      if(oi<0){ let best=1e18; for(const e of sites){const sd=e.nrm[0]*pin[0]+e.nrm[1]*pin[1]-e.c; if(sd<-1e-9)continue; const z=hO[e.i]+g[e.i]*sd; if(z<best){best=z; oi=e.i;}} }
      if(oi>=0){ const ea=ed[oi].a, edir=ed[oi].dir, elen=Math.hypot(ed[oi].b[0]-ea[0],ed[oi].b[1]-ea[1])||1;
        const um=(mseg[0]-ea[0])*edir[0]+(mseg[1]-ea[1])*edir[1];   // u v rámci roviny: nrm=dir⟲+90° (CCW) → čelem k +nrm je +dir vpravo
        if(um < elen/2){ stit_L+=segLen; gseg.strana='L'; } else { stit_P+=segLen; gseg.strana='P'; }   // malé u = levá strana roviny, velké u = pravá
        gseg.okapHrana=oi;                                             // ke které okapové hraně (rovině) úsek patří
      } else { stit_L+=segLen/2; stit_P+=segLen/2; gseg.strana=null; gseg.okapHrana=-1; }   // záloha: nepřiřazeno → 50/50
    }
  }
  // --- skutečný tvar roviny: obrys vlastnictví v mřížce (marching squares) -> uhlazení -> rozvinutí ---
  const inOwn=(i,j,t)=> i>=0&&i<NG&&j>=0&&j<NG && own[j*NG+i]===t;
  const cX=gi=>minx+gi*cw, cY=gj=>miny+gj*ch;
  function traceRegion(t){
    const out=new Map(); const key=(x,y)=>x+'_'+y;
    const add=(sx,sy,ex,ey)=>{const k=key(sx,sy);(out.get(k)||out.set(k,[]).get(k)).push([ex,ey]);};
    for(let j=0;j<NG;j++)for(let i=0;i<NG;i++){ if(own[j*NG+i]!==t)continue;
      if(!inOwn(i,j-1,t)) add(i,j,i+1,j);         // dolní hrana BL->BR (interiér vlevo, CCW)
      if(!inOwn(i+1,j,t)) add(i+1,j,i+1,j+1);     // pravá  BR->TR
      if(!inOwn(i,j+1,t)) add(i+1,j+1,i,j+1);     // horní  TR->TL
      if(!inOwn(i-1,j,t)) add(i,j+1,i,j);         // levá   TL->BL
    }
    if(!out.size)return [];
    const usedE=new Set(), ek=(sx,sy,ex,ey)=>sx+'_'+sy+'>'+ex+'_'+ey;
    const loops=[];   // VŠECHNY smyčky (i odškrcená špička úžlabí)
    for(const [sk,ends] of out){ const [sx0,sy0]=sk.split('_').map(Number);
      for(const [ex0,ey0] of ends){ if(usedE.has(ek(sx0,sy0,ex0,ey0)))continue;
        const loop=[[sx0,sy0]]; usedE.add(ek(sx0,sy0,ex0,ey0));
        let px=sx0,py=sy0,cx=ex0,cy=ey0,guard=0;
        while(guard++<NG*8){ loop.push([cx,cy]); if(cx===sx0&&cy===sy0)break;
          const cand=out.get(key(cx,cy)); if(!cand)break;
          const idx=cx-px,idy=cy-py; let bestN=null,bestAng=Infinity;
          for(const [nx,ny] of cand){ if(usedE.has(ek(cx,cy,nx,ny)))continue;
            const odx=nx-cx,ody=ny-cy; const ang=Math.atan2(idx*ody-idy*odx, idx*odx+idy*ody); // pravidlo pravé ruky
            if(ang<bestAng){bestAng=ang;bestN=[nx,ny];} }
          if(!bestN)break; usedE.add(ek(cx,cy,bestN[0],bestN[1])); px=cx;py=cy;cx=bestN[0];cy=bestN[1]; }
        if(loop.length>=4)loops.push(loop); }
    }
    return loops.map(L=>L.map(([gi,gj])=>[cX(gi),cY(gj)]));   // pole smyček (world)
  }
  // uhlazení uzavřeného prstence: opakovaně odeber vrchol s nejmenší kolmou odchylkou < eps
  function simplifyRing(pts,eps){ let r=pts.slice();
    while(r.length>3){ let bi=-1,bd=eps;
      for(let i=0;i<r.length;i++){const a=r[(i-1+r.length)%r.length],b=r[i],c=r[(i+1)%r.length];
        const dx=c[0]-a[0],dy=c[1]-a[1],L=Math.hypot(dx,dy)||1; const d=Math.abs((b[0]-a[0])*dy-(b[1]-a[1])*dx)/L;
        if(d<bd){bd=d;bi=i;} }
      if(bi<0)break; r.splice(bi,1); }
    return r; }
  // svaření krátkých artefaktových hran z mřížky: hrany kratší než práh sloučí do středu → ostrá špička / čisté rohy
  // (u pravoúhlých půdorysů tak vyjdou rovnoramenné trojúhelníky a lichoběžníky, ne useklé rohy)
  function weldRing(r,minE){ r=r.map(p=>p.slice()); let guard=0;
    while(r.length>3 && guard++<200){ let done=true;
      for(let i=0;i<r.length;i++){ const a=r[i], b=r[(i+1)%r.length];
        if(Math.hypot(b[0]-a[0],b[1]-a[1])<minE){ r[i]=[(a[0]+b[0])/2,(a[1]+b[1])/2]; r.splice((i+1)%r.length,1); done=false; break; } }
      if(done)break; }
    return r; }
  // sloučení rozdvojené špičky: čtyřúhelník, kde dva nejvyšší (sousední) vrcholy tvoří krátkou horní hranu vysoko nad základnou → trojúhelník
  function collapseApex(r){ if(r.length!==4) return r;
    const idx=[0,1,2,3].sort((p,q)=>r[q][1]-r[p][1]); const t1=idx[0],t2=idx[1];
    const adj=(Math.abs(t1-t2)===1||Math.abs(t1-t2)===3);
    const d=Math.hypot(r[t1][0]-r[t2][0], r[t1][1]-r[t2][1]);
    const baseMaxV=Math.max(r[idx[2]][1], r[idx[3]][1]), topMinV=Math.min(r[t1][1], r[t2][1]);
    const dv=Math.abs(r[t1][1]-r[t2][1]);   // reálný hřeben = vodorovný (dv≈0) → NEslučovat; rozdvojená špička = šikmá (dv>0)
    if(adj && d<1.3 && dv>0.3 && topMinV>baseMaxV+1.0){ const m=[(r[t1][0]+r[t2][0])/2, Math.max(r[t1][1],r[t2][1])];  // špička = nejvyšší bod (zachová plochu)
      const keep=Math.min(t1,t2); r[keep]=m; r.splice(Math.max(t1,t2),1); }
    return r; }
  /* ROBUSTNÍ tvar roviny: vzorkování vlastněných buněk po v-pásmech. Detekuje i NEKONVEXNÍ (dvouvrcholové)
     plochy u L-střech (dva shluky v pásmu) → vrátí jeden správný polygon (případně do M-tvaru). */
  function planeShapeUV(i, eaveLen){
    const a=ed[i].a, dir=ed[i].dir, nrm=ed[i].nrm, gi2=g[i], sec=Math.sqrt(1+gi2*gi2);
    let vmax=0, umin=Infinity, umax=-Infinity; const cells=[];
    for(let jj=0;jj<NG;jj++)for(let ii=0;ii<NG;ii++){ if(own[jj*NG+ii]!==i)continue;
      const px=minx+(ii+0.5)*cw, py=miny+(jj+0.5)*ch;
      const u=(px-a[0])*dir[0]+(py-a[1])*dir[1];
      const v=((px-a[0])*nrm[0]+(py-a[1])*nrm[1])*sec;
      if(v>vmax)vmax=v; if(u<umin)umin=u; if(u>umax)umax=u; cells.push([u,v]); }
    if(cells.length<6||vmax<=0.2) return null;
    const csz=Math.max(cw,ch), half=csz*0.5;
    const NV=Math.max(6, Math.min(200, Math.round(vmax/(csz*sec))));
    const lo=new Array(NV).fill(Infinity), hi=new Array(NV).fill(-Infinity);
    cells.forEach(([u,v])=>{ let b=Math.floor(v/vmax*NV); if(b<0)b=0; if(b>=NV)b=NV-1; if(u<lo[b])lo[b]=u; if(u>hi[b])hi[b]=u; });
    const right=[], left=[];
    for(let b=0;b<NV;b++){ if(lo[b]===Infinity)continue; const vMid=(b+0.5)/NV*vmax; right.push([hi[b]+half,vMid]); left.push([lo[b]-half,vMid]); }
    if(right.length<2) return null;
    let poly=[[0,0],[eaveLen,0]];                       // okapová hrana
    for(let k=0;k<right.length;k++) poly.push(right[k]); // pravý okraj nahoru
    for(let k=left.length-1;k>=0;k--) poly.push(left[k]); // levý okraj dolů
    poly=simplifyRing(poly,csz*1.3);
    return poly.length>=3 ? [poly] : null;
  }
  // rozdělení polygonu na konvexní lichoběžníky svislým řezem v konkávním vrcholu
  function area2(p){let A=0;for(let q=0;q<p.length;q++){const a=p[q],b=p[(q+1)%p.length];A+=a[0]*b[1]-b[0]*a[1];}return A;}
  function crossAt(p,q){const m=p.length,a=p[(q-1+m)%m],b=p[q],c=p[(q+1)%m];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);}
  function buildLoop(p,ri,be,V,first){const m=p.length,out=[]; if(first){for(let k=ri;;k=(k+1)%m){out.push(p[k]);if(k===be){out.push(V);break;}}}else{out.push(V);for(let k=(be+1)%m;;k=(k+1)%m){out.push(p[k]);if(k===ri)break;}}return out;}
  function splitTrap(poly,depth){
    depth=depth||0; if(depth>16||!poly||poly.length<4) return [poly];
    let p=poly.slice(); if(area2(p)<0) p=p.reverse();
    const m=p.length; let ri=-1, worst=-0.12;             // dělit jen na VÝRAZNÉM reflexním vrcholu (ne grid-šum)
    for(let q=0;q<m;q++){ const a=p[(q-1+m)%m],b=p[q],c=p[(q+1)%m];
      const cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
      const la=Math.hypot(b[0]-a[0],b[1]-a[1]), lb=Math.hypot(c[0]-b[0],c[1]-b[1]);
      const nrm2=cr/((la*lb)||1); if(nrm2<worst){ worst=nrm2; ri=q; } }
    if(ri<0) return [p];                                  // (skoro) konvexní
    const uc=p[ri][0]; let bestT=Infinity,bestV=null,bestE=-1;
    for(let e=0;e<m;e++){ if(e===ri||((e+1)%m)===ri) continue; const a=p[e],b=p[(e+1)%m];
      if(Math.abs(b[0]-a[0])<1e-9) continue; const t=(uc-a[0])/(b[0]-a[0]); if(t<1e-6||t>1-1e-6) continue;
      const vy=a[1]+t*(b[1]-a[1]); const dv=Math.abs(vy-p[ri][1]); if(dv<bestT){bestT=dv;bestV=[uc,vy];bestE=e;} }
    if(bestE<0) return [p];
    const out=splitTrap(buildLoop(p,ri,bestE,bestV,true),depth+1).concat(splitTrap(buildLoop(p,ri,bestE,bestV,false),depth+1));
    return out.filter(x=>x&&x.length>=3 && Math.abs(area2(x))/2 > 0.25);   // odfiltruj nulové úlomky
  }
  /* PŘESNÉ PLOCHY z rovinného grafu: okapové/štítové hrany + segmenty (hřeben/nároží/úžlabí) → buňky grafu.
     Vrací mapu indexOkapu → pole půdorysných polygonů (přesné, bez mřížkových artefaktů). */
  function buildFaces(){
    const fn=[], fmap=new Map(); const fk=p=>Math.round(p[0]*1e3)+'_'+Math.round(p[1]*1e3);
    const nidf=p=>{const k=fk(p); if(fmap.has(k))return fmap.get(k); const id=fn.length; fn.push([p[0],p[1]]); fmap.set(k,id); return id;};
    let EE=[]; const aE=(p,q,ty,ei)=>{const aa=nidf(p),bb=nidf(q); if(aa===bb)return; EE.push({a:aa,b:bb,type:ty,ei});};
    for(let i=0;i<n;i++) aE(poly[i],poly[(i+1)%n], gableSet.has(i)?'gable':'eave', gableSet.has(i)?-1:i);
    segs.forEach(s=>aE(s.A,s.B,s.type,-1));
    const onS=(p,A,B)=>{const dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy;if(L2<1e-12)return -1;const t=((p[0]-A[0])*dx+(p[1]-A[1])*dy)/L2;if(t<1e-6||t>1-1e-6)return -1;return Math.hypot(p[0]-(A[0]+t*dx),p[1]-(A[1]+t*dy))<1.5e-3?t:-1;};
    const E2=[];
    EE.forEach(e=>{const A=fn[e.a],B=fn[e.b],onl=[];for(let ni=0;ni<fn.length;ni++){if(ni===e.a||ni===e.b)continue;const t=onS(fn[ni],A,B);if(t>=0)onl.push([t,ni]);}if(!onl.length){E2.push(e);return;}onl.sort((x,y)=>x[0]-y[0]);let pr=e.a;onl.forEach(([t,ni])=>{E2.push({a:pr,b:ni,type:e.type,ei:e.ei});pr=ni;});E2.push({a:pr,b:e.b,type:e.type,ei:e.ei});});
    EE=E2;
    const HE=[]; EE.forEach((e,ei)=>{HE.push({from:e.a,to:e.b,e:ei});HE.push({from:e.b,to:e.a,e:ei});});
    const outA=fn.map(()=>[]);
    HE.forEach((h,hi)=>{const ff=fn[h.from],tt=fn[h.to];h.ang=Math.atan2(tt[1]-ff[1],tt[0]-ff[0]);outA[h.from].push(hi);});
    outA.forEach(lst=>lst.sort((x,y)=>HE[x].ang-HE[y].ang));
    const idxIn=HE.map(()=>0); outA.forEach(lst=>lst.forEach((hi,k)=>idxIn[hi]=k));
    const nxt=hi=>{const h=HE[hi];let rev=-1;for(const o of outA[h.to])if(HE[o].to===h.from&&HE[o].e===h.e){rev=o;break;}if(rev<0)return -1;const lst=outA[h.to],k=idxIn[rev];return lst[(k-1+lst.length)%lst.length];};
    const usd=new Array(HE.length).fill(false); const res={};
    for(let s2=0;s2<HE.length;s2++){ if(usd[s2])continue; const loop=[]; let h=s2,gd=0;
      while(h>=0&&!usd[h]&&gd++<HE.length*2){usd[h]=true;loop.push(h);h=nxt(h);if(h===s2)break;}
      if(loop.length<3)continue; const pts=loop.map(hi=>fn[HE[hi].from]);
      let A=0;for(let q=0;q<pts.length;q++){const a=pts[q],b=pts[(q+1)%pts.length];A+=a[0]*b[1]-b[0]*a[1];}
      if(A<=0.05)continue; const eIdx=loop.map(hi=>EE[HE[hi].e]).filter(e=>e.type==='eave').map(e=>e.ei);
      if(eIdx.length){ (res[eIdx[0]]=res[eIdx[0]]||[]).push(pts); } }
    return res;
  }
  const FACES=(()=>{ try{ return buildFaces(); }catch(e){ return {}; } })();
  const eps=Math.max(cw,ch)*1.6, weldTol=Math.max(0.28, 4*Math.max(cw,ch));
  const shoe=t=>{let s=0;for(let q=0;q<t.length;q++){const a=t[q],b=t[(q+1)%t.length];s+=a[0]*b[1]-b[0]*a[1];}return Math.abs(s/2);};
  // Globální kontrola přesných ploch: musí beze zbytku pokrýt celý půdorys (žádné díry/překryvy).
  const polyPlan=(()=>{let s=0;for(let q=0;q<n;q++){const a=poly[q],b=poly[(q+1)%n];s+=a[0]*b[1]-b[0]*a[1];}return Math.abs(s/2);})();
  let facesPlan=0, facesCnt=0; for(const k in FACES){ FACES[k].forEach(fp=>facesPlan+=shoe(fp)); facesCnt++; }
  const facesOK = facesCnt>0 && polyPlan>0.5 && Math.abs(facesPlan-polyPlan)/polyPlan<0.04;   // plochy přesně tvoří půdorys → důvěřuj jim
  const planes=[]; let pn=0;
  for(let i=0;i<n;i++){ if(gableSet.has(i))continue; pn++;
    const gi=g[i], sec=Math.sqrt(1+gi*gi), slope=Math.atan(gi)*180/Math.PI;
    const a=ed[i].a, dir=ed[i].dir, nrm=ed[i].nrm, eaveLen=Math.hypot(ed[i].b[0]-a[0], ed[i].b[1]-a[1]);
    const agg=planeAgg[i]||{proj:0,maxSd:0}; let pudorysna=agg.proj, sikma=agg.proj*sec;
    // PRIMÁRNĚ přesné plochy z rovinného grafu (face-extraction) → rozdělené na čisté lichoběžníky;
    // fallback: vzorkování po v-pásmech; krajně marching-squares / obdélník.
    let rings=null, robust=false;
    const myF=FACES[i];
    if(facesOK && myF && myF.length){ let rr=[], fa=0;
      myF.forEach(fp=>{ fa+=shoe(fp);
        const uv=fp.map(p=>[(p[0]-a[0])*dir[0]+(p[1]-a[1])*dir[1], ((p[0]-a[0])*nrm[0]+(p[1]-a[1])*nrm[1])*sec]);
        splitTrap(uv).forEach(t=>{ if(t&&t.length>=3 && shoe(t)>0.3) rr.push(t); }); });
      const rrA=rr.reduce((s,r)=>s+shoe(r),0), faS=fa*sec;   // rrA je ŠIKMÁ plocha (v už ×sec) → porovnej s fa*sec
      if(rr.length && faS>0.2 && Math.abs(rrA-faS)/faS<0.05){ rings=rr; robust=true; pudorysna=fa; sikma=faS; }   // přesná plocha (lichoběžníky věrně pokrývají)
    }
    const uvShape=(!rings)?planeShapeUV(i, eaveLen):null;   // pole smyček (konvexní nebo M-tvar)
    if(uvShape){ const ar=uvShape.reduce((s,r)=>s+shoe(r),0); if(sikma>0.2 && Math.abs(ar-sikma)/sikma<0.08){ rings=[]; uvShape.forEach(r=>splitTrap(r).forEach(t=>{if(t&&t.length>=3&&shoe(t)>0.4)rings.push(t);})); robust=rings.length>0; } }   // rozděl nekonvexní na lichoběžníky (bez mrňavých úlomků)
    if(!rings||!rings.length){ robust=false;
      rings=traceRegion(i).map(r=>simplifyRing(r,eps)).filter(r=>r.length>=3)
        .map(r=>r.map(x=>[(x[0]-a[0])*dir[0]+(x[1]-a[1])*dir[1], ((x[0]-a[0])*nrm[0]+(x[1]-a[1])*nrm[1])*sec]))
        .map(r=>collapseApex(weldRing(r,weldTol))).filter(r=>r.length>=3);   // svař krátké artefakty + sluč rozdvojenou špičku
    }
    const area=rings.reduce((s,r)=>s+shoe(r),0);
    let presne;
    if(sikma<0.2){ presne=true; }   // degenerovaná (nulová) rovina
    else if(robust && Math.abs(area-sikma)/sikma<0.08){ presne=true; }  // robustní tvar (lichoběžníky) – plocha sedí
    else { presne = rings.length===1 && Math.abs(area-sikma)/sikma<0.04;   // jen JEDEN čistý tvar se shodou plochy
      if(!presne){ const hh=(eaveLen>0.01)?(sikma/eaveLen):(agg.maxSd*sec||1); rings=[[[0,0],[eaveLen,0],[eaveLen,hh],[0,hh]]]; } }  // jinak JEDEN plochově správný obdélník (šířka okapu × sikma/okap)
    const maxV=rings.reduce((m,r)=>Math.max(m,r.reduce((mm,p)=>Math.max(mm,p[1]),0)),0);
    const tvar=rings.reduce((bg,r)=>shoe(r)>shoe(bg)?r:bg, rings[0]);                 // největší smyčka (pro jednoduché použití)
    let cx=agg.cnt?agg.cx/agg.cnt:(a[0]+ed[i].b[0])/2, cy=agg.cnt?agg.cy/agg.cnt:(a[1]+ed[i].b[1])/2;   // těžiště roviny (půdorys) pro popisek
    if(facesOK && myF && myF.length){ let sx=0,sy=0,sa=0; myF.forEach(fp=>{const ar=shoe(fp);let mx=0,my=0;fp.forEach(p=>{mx+=p[0];my+=p[1];});sx+=mx/fp.length*ar;sy+=my/fp.length*ar;sa+=ar;}); if(sa>0){cx=sx/sa;cy=sy/sa;} }   // těžiště z přesné plochy
    planes.push({cislo:pn, sklon:slope, pudorysna:pudorysna, sikma:sikma, sirka_okap:eaveLen, delka_spad:maxV, tvar:tvar, tvarRings:rings, presne:presne, cx:cx, cy:cy,
      baze:{a:[a[0],a[1]], dir:[dir[0],dir[1]], nrm:[nrm[0],nrm[1]], sec:sec},   // báze roviny: svět→(u,v): u=(p-a)·dir, v=((p-a)·nrm)·sec
      hrana:i, vyskaOkapu:hO[i]||0});   // (14. 10. 2026, skládání střechy) okapová hrana roviny a její výška okapu
  }
  // === VYNUCENÍ ZRCADLOVÉ SYMETRIE TVARŮ PLOCH ===
  // U symetrických střech (např. křížový štít) je rastrový rozklad v místě křížení úžlabí nestabilní →
  // zrcadlové plochy vyjdou různě. Tady najdeme dvojice zrcadlových ploch a vynutíme přesné zrcadlo.
  // Mění se JEN tvar pro kladečák — plocha (sikma) a tím i cena zůstávají beze změny.
  (function enforceMirror(){
    if(planes.length<3) return;
    const cxp=(minx+maxx)/2, cyp=(miny+maxy)/2, tol=Math.max(0.06, span*0.012);
    const hAxis=p=>[p[0], 2*cyp-p[1]];   // vodorovná osa y=cyp
    const vAxis=p=>[2*cxp-p[0], p[1]];   // svislá osa x=cxp
    const setMatch=refl=>poly.every(p=>{const r=refl(p);return poly.some(q=>Math.hypot(q[0]-r[0],q[1]-r[1])<tol);});
    let axis=null; if(setMatch(hAxis)) axis=hAxis; else if(setMatch(vAxis)) axis=vAxis;
    if(!axis) return;   // není osová symetrie → nic neměníme (L a atypické střechy zůstávají)
    const uv2w=(P,u,v)=>[P.baze.a[0]+u*P.baze.dir[0]+(v/P.baze.sec)*P.baze.nrm[0], P.baze.a[1]+u*P.baze.dir[1]+(v/P.baze.sec)*P.baze.nrm[1]];
    const w2uv=(P,x,y)=>[(x-P.baze.a[0])*P.baze.dir[0]+(y-P.baze.a[1])*P.baze.dir[1], ((x-P.baze.a[0])*P.baze.nrm[0]+(y-P.baze.a[1])*P.baze.nrm[1])*P.baze.sec];
    const ctol=Math.max(0.3, span*0.05);
    const done=new Set();
    for(let i=0;i<planes.length;i++){ if(done.has(i))continue; const P=planes[i]; const rc=axis([P.cx,P.cy]);
      if(Math.hypot(rc[0]-P.cx,rc[1]-P.cy)<ctol){ done.add(i); continue; }   // rovina leží na ose (unikát) → neřešíme
      let ji=-1; for(let j=0;j<planes.length;j++){ if(j===i||done.has(j))continue; const Q=planes[j];
        if(Math.abs(Q.sikma-P.sikma)<Math.max(0.5,P.sikma*0.05) && Math.hypot(Q.cx-rc[0],Q.cy-rc[1])<ctol){ ji=j; break; } }
      if(ji<0){ done.add(i); continue; }
      const Q=planes[ji]; done.add(i); done.add(ji);
      // kanonická = přesnější rovina (presne) nebo ta s plochou tvaru bližší sikmě
      const errP=Math.abs(P.tvarRings.reduce((s,r)=>s+shoe(r),0)-P.sikma), errQ=Math.abs(Q.tvarRings.reduce((s,r)=>s+shoe(r),0)-Q.sikma);
      let C=P,Tp=Q; if((Q.presne&&!P.presne)||((P.presne===Q.presne)&&errQ<errP)){ C=Q; Tp=P; }
      const mir=C.tvarRings.map(ring=>{ const nr=ring.map(([u,v])=>{ const w=uv2w(C,u,v), wr=axis(w); return w2uv(Tp,wr[0],wr[1]); }); nr.reverse(); return nr; });
      Tp.tvarRings=mir; Tp.tvar=mir.reduce((bg,r)=>shoe(r)>shoe(bg)?r:bg, mir[0]);
      Tp.delka_spad=mir.reduce((m,r)=>Math.max(m,r.reduce((mm,p)=>Math.max(mm,p[1]),0)),0);
      Tp.presne=C.presne;
    }
  })();
  if(facesOK){ const sp=planes.reduce((s,p)=>s+p.sikma,0); if(sp>0.5) roofArea=sp; }   // celková plocha = součet přesných ploch (konzistence)
  /* ══════════════════════════════════════════════════════════════════════
     JAKÝ PRVEK PATŘÍ DO UZLU
     ----------------------------------------------------------------------
     Do 1. 9. 2026 se rozhodovalo jen podle POČTU čar v uzlu: tři čáry =
     rozdělovací hřebenáč, čtyři a víc = vrcholový prvek. Jenže výrobci to
     dělí podle toho, JAKÉ čáry se potkají — a pro každý případ mají jiný
     kus. Doslova z ceníku Bramac 2026-2:

       • Rozdělovací hřebenáč ......... napojení hřebene a nároží
       • typ T (levý a pravý) ......... „pro kolmé napojení dvou hřebenů
                                        v jedné rovině", 1 ks / 3 hřebeny
       • typ X ........................ „pro kolmé napojení dvou protínajících
                                        se hřebenů", 1 ks / 4 hřebeny
       • typ XS ....................... „pro napojení čtyř nároží"

     Tondach má totéž (rozdělovací valbový / T levý a pravý / X), ale jen
     u některých řad hřebenáčů — u drážkového hřebenáče, na kterém jede
     Granát 13, žádný T-kus není. Proto se tady jen POČÍTÁ, co v uzlu je;
     jestli na to výrobce prvek má, rozhoduje ceník daného modelu. Stejně
     jako u půltašky.

     Rozdělení uzlů:
       1 čára, hřeben ................ uzávěra hřebene
       1 čára, nároží ................ nárožní začáteční prvek
       3+ čar, hřeben i nároží ....... rozdělovací (Y) — tenhle prvek máme
       3 čáry, samé hřebeny .......... typ T
       4+ čar, samé hřebeny .......... typ X
       3+ čar, samá nároží ........... typ XS (vrchol stanové střechy)
     Dvě čáry jsou průchozí uzel — tam se nic nedává. */
  const ni={}, kk=p=>Math.round(p[0]*10)+'_'+Math.round(p[1]*10);
  const addInc=(p,type)=>{const k=kk(p); const o=ni[k]||(ni[k]={h:0,nar:0}); if(type==='hreben')o.h++; else o.nar++;};
  segs.filter(s=>s.type==='hreben'||s.type==='narozi').forEach(s=>{addInc(s.A,s.type); addInc(s.B,s.type);});
  let uzavery_hrebene=0, narozni_zacatecni=0;
  let rozdelovaci_y=0, rozdelovaci_t=0, rozdelovaci_x=0, rozdelovaci_xs=0;
  Object.values(ni).forEach(o=>{ const d=o.h+o.nar;
    if(d===1){ if(o.h>0) uzavery_hrebene++; else narozni_zacatecni++; return; }
    if(d<3) return;                                   // průchozí uzel
    if(o.h>0 && o.nar>0) rozdelovaci_y++;             // hřeben dobíhá do nároží
    else if(o.h>0) { if(o.h>=4) rozdelovaci_x++; else rozdelovaci_t++; }
    else rozdelovaci_xs++;                            // samá nároží = vrchol
  });
  /* `hreben_rozdelovaci` je to, co se opravdu objedná jako rozdělovací
     hřebenáč — tedy JEN uzly hřeben+nároží. T, X a XS jsou jiné zboží
     a vedou se zvlášť, aby se nedaly tiše zaplatit špatným prvkem. */
  const hreben_koncovych=uzavery_hrebene+narozni_zacatecni, hreben_rozdelovaci=rozdelovaci_y;
  /* Staré názvy pro výkaz v původní kalkulačce — beze změny významu:
     „T/Y" je uzel hřeben+nároží, „vrcholový" je čtyřcestný prvek. */
  const rozdelovaci_ty=rozdelovaci_y, vrcholovy=rozdelovaci_x+rozdelovaci_xs;
  return {ridge,hip,valley,segs,roofArea,okap,stit,stit_L,stit_P,gableLens,gableSegs,minx,miny,maxx,maxy,planes,
    hreben_koncovych,hreben_rozdelovaci, uzavery_hrebene,narozni_zacatecni,rozdelovaci_ty,vrcholovy,
    rozdelovaci_y,rozdelovaci_t,rozdelovaci_x,rozdelovaci_xs};
}

/* ==========================================================================
   LOMENÁ SEDLOVÁ — rozříznutí rovin ve zlomu (od 13. 9. 2026)
   --------------------------------------------------------------------------
   PROČ
   Na zakázce 108_26 (Kroměřížská) má střecha od okapu mírnou část 10°
   a nad ní strmou 31°. Kalkulačka takový tvar neznala; zkusila se
   namodelovat vikýři a vyšel nesmysl (vikýř kreslený až do hřebene).

   JAK
   Půdorysný skelet (hřeben, úžlabí, nároží) se u lomené střechy NEMĚNÍ:
   když mají všechny strany stejný spodní sklon, stejný horní sklon
   a stejnou vzdálenost zlomu od zdi, je výška střechy nad každým bodem
   stejnou funkcí vzdálenosti od okapu — a čáry stejné výšky zůstávají
   tam, kde je spočítal skelet se spodním sklonem. Stačí proto každou
   rovinu ROZŘÍZNOUT ve zlomu na dvě: spodní (sklon A) a horní (sklon B).
   Všechno, co pak počítá po rovinách (latě, kontralatě, kladečák, bednění,
   fólie, sníh), dostane prostě víc rovin a nic dalšího nemusí vědět.

   SOUŘADNICE ROVINY: u = podél okapu, v = po spádu (už rozvinuté, tj.
   vodorovná vzdálenost × sec). Zlom leží na v = (zlom od zdi + přesah) × secA.
   Horní rovina má vlastní bázi posunutou o (zlom + přesah) dovnitř
   a v se přepočítá: v' = (v/secA − X) × secB.

   ČÍSLOVÁNÍ: spodní roviny si nechají čísla 1..n (na ně se váže mapa
   hrana→rovina v kalkulačce), horní dostanou n+1..2n. Každá nese
   `lom = {cast:'dolni'|'horni', par:číslo protějšku, zlomOdZdi}`.
   ========================================================================== */
function plochaSmycky(r){ let s=0; for(let q=0;q<r.length;q++){ const a=r[q], b=r[(q+1)%r.length]; s+=a[0]*b[1]-b[0]*a[1]; } return Math.abs(s/2); }
/* Ořez smyčky polorovinou v ≤ vMez (dolni=true) nebo v ≥ vMez (Sutherland–Hodgman). */
function orezSmyckuV(ring, vMez, dolni){
  const uvnitr = p => dolni ? (p[1] <= vMez + 1e-9) : (p[1] >= vMez - 1e-9);
  const out=[];
  for(let i=0;i<ring.length;i++){
    const A=ring[i], B=ring[(i+1)%ring.length], inA=uvnitr(A), inB=uvnitr(B);
    if(inA) out.push(A);
    if(inA!==inB){ const t=(vMez-A[1])/(B[1]-A[1]); out.push([A[0]+t*(B[0]-A[0]), vMez]); }
  }
  return out;
}
function rozlomRoviny(out, z, eave, gset, oArr){
  const L=z.lomena||{};
  const A=+z.slope, B=+L.sklonHorni, X=+L.zlomOdZdi;
  if(!(B>0) || !(X>0)) throw new Error('PENTI: lomená střecha potřebuje horní sklon a vzdálenost zlomu od zdi.');
  /* MANSARDA (4. 10. 2026) = obrácená lomená: dole strmá, nahoře mírná.
     Půdorysný skelet platí pro obě pořadí sklonů stejně (viz komentář
     nahoře), takže výpočet je společný — liší se jen kontrola pořadí. */
  const mansarda = (L.typ==='mansard');
  if(!mansarda && B<=A) throw new Error('PENTI: u lomené střechy musí být horní sklon strmější než spodní ('+A+'° → '+B+'°).');
  if(mansarda && B>=A) throw new Error('PENTI: u mansardové střechy musí být spodní sklon strmější než horní ('+A+'° → '+B+'°).');
  const tA=Math.tan(A*Math.PI/180), tB=Math.tan(B*Math.PI/180);
  const secA=Math.sqrt(1+tA*tA), secB=Math.sqrt(1+tB*tB);
  const n=eave.length;
  /* pořadí rovin = pořadí neštítových hran (stejně jako ve skeletonu) */
  const hranaRoviny=[]; for(let i=0;i<n;i++){ if(!gset.has(i)) hranaRoviny.push(i); }
  const puv=out.planes, dolni=[], horni=[]; let rozlomeno=0;
  puv.forEach((p,idx)=>{
    const hrana=hranaRoviny[idx]; const o=(hrana!=null && oArr[hrana]!=null)?oArr[hrana]:(z.oOkap||0);
    const Xe=X+o;                       // zlom od HRANY OKAPU (obrys je odsazený o přesah)
    const vLom=Xe*secA;
    const rings=p.tvarRings||[p.tvar];
    if(!(vLom < (p.delka_spad||0)-0.05)){ p.lom=null; dolni.push(p); return; }   // zlom za hřebenem této roviny → celá mírná (krátké roviny v křídlech)
    const dR=rings.map(r=>orezSmyckuV(r,vLom,true)).filter(r=>r.length>=3 && plochaSmycky(r)>0.05);
    const hR=rings.map(r=>orezSmyckuV(r,vLom,false)).filter(r=>r.length>=3 && plochaSmycky(r)>0.05)
                  .map(r=>r.map(pt=>[pt[0], (pt[1]/secA - Xe)*secB]));
    const sD=dR.reduce((s,r)=>s+plochaSmycky(r),0), sH=hR.reduce((s,r)=>s+plochaSmycky(r),0);
    const bz=p.baze;
    /* těžiště v půdorysu z rozvinutých smyček (pro popisky v kresbě) */
    const tez=(rr, vNaSvet)=>{ let sx=0,sy=0,sa=0; rr.forEach(r=>{ const ar=plochaSmycky(r); let mu=0,mv=0; r.forEach(q=>{mu+=q[0];mv+=q[1];}); mu/=r.length; mv/=r.length;
      const w=vNaSvet(mu,mv); sx+=w[0]*ar; sy+=w[1]*ar; sa+=ar; }); return sa>0?[sx/sa,sy/sa]:[p.cx,p.cy]; };
    const svetD=(u,v)=>[bz.a[0]+u*bz.dir[0]+(v/secA)*bz.nrm[0], bz.a[1]+u*bz.dir[1]+(v/secA)*bz.nrm[1]];
    const aH=[bz.a[0]+Xe*bz.nrm[0], bz.a[1]+Xe*bz.nrm[1]];
    const svetH=(u,v)=>[aH[0]+u*bz.dir[0]+(v/secB)*bz.nrm[0], aH[1]+u*bz.dir[1]+(v/secB)*bz.nrm[1]];
    const cD=tez(dR,svetD), cH=tez(hR,svetH);
    const maxV=rr=>rr.reduce((m,r)=>Math.max(m,r.reduce((mm,q)=>Math.max(mm,q[1]),0)),0);
    const nejv=rr=>rr.reduce((bg,r)=>plochaSmycky(r)>plochaSmycky(bg)?r:bg, rr[0]);
    const cisloH=puv.length+p.cislo;
    dolni.push({ cislo:p.cislo, sklon:A, pudorysna:sD/secA, sikma:sD, sirka_okap:p.sirka_okap, delka_spad:maxV(dR),
      tvar:nejv(dR), tvarRings:dR, presne:p.presne, cx:cD[0], cy:cD[1],
      baze:{a:[bz.a[0],bz.a[1]], dir:[bz.dir[0],bz.dir[1]], nrm:[bz.nrm[0],bz.nrm[1]], sec:secA},
      lom:{cast:'dolni', par:cisloH, zlomOdZdi:X, zlomOdOkapu:Xe} });
    horni.push({ cislo:cisloH, sklon:B, pudorysna:sH/secB, sikma:sH, sirka_okap:rowWidthAt(hR,0.02), delka_spad:maxV(hR),
      tvar:nejv(hR), tvarRings:hR, presne:p.presne, cx:cH[0], cy:cH[1],
      baze:{a:aH, dir:[bz.dir[0],bz.dir[1]], nrm:[bz.nrm[0],bz.nrm[1]], sec:secB},
      lom:{cast:'horni', par:p.cislo, zlomOdZdi:X, zlomOdOkapu:Xe} });
    rozlomeno++;
  });
  if(!rozlomeno) throw new Error('PENTI: zlom '+X+' m od zdi leží za hřebenem — lomená střecha nevznikne. Zmenšete vzdálenost zlomu.');
  out.planes=dolni.concat(horni);
  out.roofArea=out.planes.reduce((s,p)=>s+p.sikma,0);
  /* ŠTÍTOVÉ HRANY ve sklonu: skelet je násobil jedním sec (spodním). Délka
     krajovky po lomené hraně = mírný úsek + strmý úsek; každý úsek štítu se
     přepočítá z půdorysné délky a výšek na jeho koncích. */
  let stit=0, stit_L=0, stit_P=0; const gableLens={};
  (out.gableSegs||[]).forEach(gs=>{
    const oi=gs.okapHrana; if(oi==null || oi<0 || !(gs.projL>0)) { stit+=gs.delka; if(gs.strana==='L') stit_L+=gs.delka; else if(gs.strana==='P') stit_P+=gs.delka; else { stit_L+=gs.delka/2; stit_P+=gs.delka/2; } gableLens[gs.hrana]=(gableLens[gs.hrana]||0)+gs.delka; return; }
    const ea=eave[oi], eb=eave[(oi+1)%n]; let dx=eb[0]-ea[0], dy=eb[1]-ea[1]; const l=Math.hypot(dx,dy)||1; dx/=l; dy/=l;
    const nrm=[-dy,dx]; const sd=p=>(p[0]-ea[0])*nrm[0]+(p[1]-ea[1])*nrm[1];   // půdorysná vzdálenost od okapové hrany
    const Xe=X+((oArr[oi]!=null)?oArr[oi]:(z.oOkap||0));
    const h=d=> d<=Xe ? d*tA : Xe*tA+(d-Xe)*tB;                                   // výška střechy nad okapem ve vzdálenosti d
    const d0=sd(gs.a), d1=sd(gs.b); const kusy=[[0,1]];
    if((d0-Xe)*(d1-Xe)<0){ const t=(Xe-d0)/(d1-d0); kusy.length=0; kusy.push([0,t],[t,1]); }
    let delka=0; kusy.forEach(([t0,t1])=>{ const dA=d0+t0*(d1-d0), dB=d0+t1*(d1-d0); delka+=Math.hypot(gs.projL*(t1-t0), h(dB)-h(dA)); });
    gs.delka=delka; stit+=delka; gableLens[gs.hrana]=(gableLens[gs.hrana]||0)+delka;
    if(gs.strana==='L') stit_L+=delka; else if(gs.strana==='P') stit_P+=delka; else { stit_L+=delka/2; stit_P+=delka/2; }
  });
  out.stit=stit; out.stit_L=stit_L; out.stit_P=stit_P; out.gableLens=gableLens;
  /* NÁROŽÍ A ÚŽLABÍ ve sklonu (4. 10. 2026): skelet je počítal celé ve
     spodním sklonu. Výška nad bodem nároží/úžlabí = výška střechy ve
     vzdálenosti d od okapu (d = vzdálenost od obrysu okapu), ve zlomu
     se úsek rozdělí na spodní a horní kus — stejně jako u štítu.
     U mansardy 12 × 8 / 70° vycházelo nároží o polovinu delší. */
  const vzdOkapu=p=>{ let best={d:Infinity,i:0};
    for(let i=0;i<n;i++){ const a=eave[i], b=eave[(i+1)%n]; const dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy||1;
      let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2; t=Math.max(0,Math.min(1,t));
      const d=Math.hypot(p[0]-a[0]-t*dx, p[1]-a[1]-t*dy); if(d<best.d) best={d,i}; }
    return best; };
  let hip=0, valley=0;
  (out.segs||[]).forEach(sg=>{
    if(sg.type!=='narozi' && sg.type!=='uzlabi') return;
    const m=vzdOkapu([(sg.A[0]+sg.B[0])/2,(sg.A[1]+sg.B[1])/2]);
    const Xe=X+((oArr[m.i]!=null)?oArr[m.i]:(z.oOkap||0));
    const h=d=> d<=Xe ? d*tA : Xe*tA+(d-Xe)*tB;
    const d0=vzdOkapu(sg.A).d, d1=vzdOkapu(sg.B).d, Lp=Math.hypot(sg.B[0]-sg.A[0], sg.B[1]-sg.A[1]);
    const kusy=((d0-Xe)*(d1-Xe)<0) ? (t=>[[0,t],[t,1]])((Xe-d0)/(d1-d0)) : [[0,1]];
    let delka=0; kusy.forEach(([t0,t1])=>{ const dA=d0+t0*(d1-d0), dB=d0+t1*(d1-d0); delka+=Math.hypot(Lp*(t1-t0), h(dB)-h(dA)); });
    sg.delka=delka; if(sg.type==='narozi') hip+=delka; else valley+=delka;
  });
  if((out.segs||[]).some(sg=>sg.type==='narozi'||sg.type==='uzlabi')){ out.hip=hip; out.valley=valley; }
  /* DÉLKA ZLOMU (4. 10. 2026) — spodní hrana horních rovin, pro lemování
     zlomu a příchytky; ceník položky zatím nemá (dodá PENTI) */
  out.zlom = horni.reduce((s,p)=>s+rowWidthAt(p.tvarRings,1e-6),0);   // přesně ve zlomu (sirka_okap je kousek nad ním)
  out.lomena={sklonDolni:A, sklonHorni:B, zlomOdZdi:X, typ: mansarda ? 'mansard' : 'lomena', zlom: out.zlom};
}

/* HLAVNÍ GEOMETRIE: ze zadání spočítá plochy a délky hran střechy.
   zadani = {fp, dims, roof, slope, oOkap, oStit, planeSlopes, endState, pultDir}
   Lomená sedlová navíc: slope = SPODNÍ sklon, lomena={sklonHorni, zlomOdZdi};
   sklony po rovinách (planeSlopes) se u ní nepoužijí — všechny strany mají
   stejný pár sklonů, jinak by skelet neplatil (viz rozlomRoviny).
   Pro NAKRESLENÝ půdorys: fp='vlastni', polygon=[[x,y]...] (v metrech),
   gableEdges=[indexy štítových hran] (uživatel je označil kliknutím). */
function geometrieStrechy(z){
  /* JEN TŘI TVARY STŘECHY — pultová, sedlová, valbová.
     Cokoli jiného sem nepatří: kód se dál větví jen na `valbova`
     a `pultova`, takže neznámý tvar by se počítal jako SEDLOVÁ a výkaz
     by vyšel celý — pro jinou střechu. Přesně to se 30. 8. 2026 stalo
     na webu, kde jsem do nabídky přidal „polovalbu" a „stanovou", které
     jádro nezná (PENTI si toho všiml).

     Stanová střecha se nezadává: vznikne sama ze čtvercového půdorysu
     s valbou a stejnými sklony. Z jiného půdorysu vzniknout nemůže. */
  if(z.roof && !POPISKY_STRECHY[z.roof]){
    throw new Error('PENTI: tvar střechy "'+z.roof+'" jádro nezná. '
      +'Umí pultovou, sedlovou, valbovou a lomenou sedlovou.');
  }
  let sh, wallPoly, gset;
  if(z.fp==='vlastni'){
    wallPoly=ensureCCW((z.polygon||[]).map(p=>[p[0],p[1]]));   // kanonické pořadí (CCW)
    const xs=wallPoly.map(p=>p[0]),ys=wallPoly.map(p=>p[1]);
    sh={poly:wallPoly, span:Math.min(Math.max(...xs)-Math.min(...xs), Math.max(...ys)-Math.min(...ys))};
    gset = (z.roof==='valbova') ? new Set() : new Set((z.gableEdges||[]).map(Number)); // štíty z UI; valba=samý okap
  } else {
    sh=buildPoly(z.fp,z.dims); wallPoly=ensureCCW(sh.poly);
    gset=gableEdgesForPoly(wallPoly,sh,z);                     // štítové hrany (parametrický tvar)
  }
  // přesah každé hrany: štítové → oStit, ostatní → oOkap; volitelně přepis po hranách
  // (z.planeOverhangs[i] pro okapové, z.gableOverhangs[i] pro štítové)
  const oArr=wallPoly.map((p,i)=> gset.has(i)
    ? ((z.gableOverhangs && z.gableOverhangs[i]!=null) ? z.gableOverhangs[i] : z.oStit)
    : ((z.planeOverhangs && z.planeOverhangs[i]!=null) ? z.planeOverhangs[i] : z.oOkap));
  const eave=offsetPer(wallPoly,oArr);                        // obrys vč. přesahů
  const area=Math.abs(parea(eave)); const span=sh.span;
  const sec=1/Math.cos(z.slope*Math.PI/180);
  /* lomená: skelet se staví se SPODNÍM sklonem na všech stranách (viz rozlomRoviny) */
  const jeLomena=(z.roof==='lomena');
  const slopesArr=eave.map((p,i)=>((!jeLomena && z.planeSlopes && z.planeSlopes[i]!=null)?z.planeSlopes[i]:z.slope));
  const out={fp:z.fp,roof:z.roof,area,span,sec,eave,gable:[...gset],slopesArr};
  if(z.roof==='pultova'){
    out.roofArea=area*sec;
    const EV={dolu:[0,-1],nahoru:[0,1],vlevo:[-1,0],vpravo:[1,0]}[z.pultDir];
    let okap=0,horni=0,stit=0; const edges=[];
    for(let k=0;k<eave.length;k++){const p=eave[k],q=eave[(k+1)%eave.length];
      const dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy);if(len<1e-9)continue;
      const nx=dy/len,ny=-dx/len;const d=nx*EV[0]+ny*EV[1];
      let type; if(d>0.5){type='okap';okap+=len;} else if(d<-0.5){type='horni';horni+=len;} else {type='stit';stit+=len*sec;}
      edges.push({a:p,b:q,type});}
    out.okap=okap;out.horni=horni;out.stit=stit;out.pultEdges=edges;out.EV=EV;
    const xs=eave.map(p=>p[0]),ys=eave.map(p=>p[1]);
    out.bbox={minx:Math.min(...xs),maxx:Math.max(...xs),miny:Math.min(...ys),maxy:Math.max(...ys)};
    // pultová = jedna rovina; tvar: osa spádu = proti EV (do kopce), šířka = kolmo na EV
    const sAx=[-EV[0],-EV[1]], wAx=[-EV[1],EV[0]];
    const ss=eave.map(p=>p[0]*sAx[0]+p[1]*sAx[1]), ws=eave.map(p=>p[0]*wAx[0]+p[1]*wAx[1]);
    const minS=Math.min(...ss), minW=Math.min(...ws); const widthP=Math.max(...ws)-minW, runP=Math.max(...ss)-minS;
    const tvar=eave.map((p,k)=>[ws[k]-minW, (ss[k]-minS)*sec]);
    out.planes=[{cislo:1,sklon:z.slope,pudorysna:area,sikma:area*sec,sirka_okap:widthP,delka_spad:runP*sec,tvar}];
  } else {
    /* ZDI STEJNĚ VYSOKO (PENTI 8. 10. 2026): okap hrany i leží o o_i·tg(sklon_i)
       pod korunou zdi. Liší-li se to mezi okapy (nesouměrná sedlová: jiný
       sklon nebo přesah), dostane každá hrana vlastní výšku okapu, aby hřeben
       vyšel tam, kde ho má krov. Jen když žádné dva okapy nesousedí (bez
       nároží a úžlabí u okapu) — u valeb by rozdílné výšky okapů rozbily
       rohy; tam zůstává dosavadní výpočet. Souměrná střecha: beze změny. */
    let vyskyOkapu=null;
    { const nE=eave.length, okapy=[]; for(let i=0;i<nE;i++) if(!gset.has(i)) okapy.push(i);
      const sousedi=okapy.some(i=>!gset.has((i+1)%nE));
      const pokles=okapy.map(i=>oArr[i]*Math.tan(slopesArr[i]*Math.PI/180));
      const mx=pokles.length?Math.max(...pokles):0, mn=pokles.length?Math.min(...pokles):0;
      if(!sousedi && mx-mn>1e-4){ vyskyOkapu=eave.map(()=>0); okapy.forEach((i,k)=>{ vyskyOkapu[i]=mx-pokles[k]; }); }
    }
    const sk=skeleton(eave,slopesArr,gset,vyskyOkapu);
    out.roofArea=sk.roofArea;out.okap=sk.okap;out.ridge=sk.ridge;out.hip=sk.hip;out.valley=sk.valley;out.stit=sk.stit;out.stit_L=sk.stit_L;out.stit_P=sk.stit_P;out.segs=sk.segs;out.gableLens=sk.gableLens;out.gableSegs=sk.gableSegs;
    out.bbox={minx:sk.minx,maxx:sk.maxx,miny:sk.miny,maxy:sk.maxy};
    out.planes=sk.planes;
    out.hreben_koncovych=sk.hreben_koncovych; out.hreben_rozdelovaci=sk.hreben_rozdelovaci;
    out.uzavery_hrebene=sk.uzavery_hrebene; out.narozni_zacatecni=sk.narozni_zacatecni;
    out.rozdelovaci_ty=sk.rozdelovaci_ty; out.vrcholovy=sk.vrcholovy;
    /* Rozlišené uzly (od 1. 9. 2026) — T, X a XS jsou jiné zboží než Y. */
    out.rozdelovaci_y=sk.rozdelovaci_y; out.rozdelovaci_t=sk.rozdelovaci_t;
    out.rozdelovaci_x=sk.rozdelovaci_x; out.rozdelovaci_xs=sk.rozdelovaci_xs;
    if(jeLomena) rozlomRoviny(out, z, eave, gset, oArr);   // každou rovinu rozřízne ve zlomu na mírnou a strmou
    /* PERGOLY (PENTI 24. 9. 2026): prodloužení roviny ve stejném sklonu
       na okapové hraně. Dělá to modul penti-pergola.js (když je načtený) —
       jádro jen předá geometrii; bez zadaných pergol se nic nemění. */
    out.pergoly=[];
    if(z.pergoly && z.pergoly.length && global.PentiPergola && global.PentiPergola.aplikuj)
      global.PentiPergola.aplikuj(out, z);
  }
  out.maxSlope=(z.roof==='pultova')?z.slope:Math.max(z.slope,...eave.map((p,i)=>gset.has(i)?0:slopesArr[i]));
  if(jeLomena) out.maxSlope=Math.max(out.maxSlope, out.lomena.sklonHorni);   // nejstrmější část řídí DHV a podklad krytiny
  if(jeLomena) out.minSlope=Math.min(+z.slope, out.lomena.sklonHorni);         // nejmírnější část rozhoduje o minimálním sklonu krytiny (mansarda: horní)
  return out;
}

/* ==========================================================================
   CENĚNÍ (modul VAZNÍKY) — PŘESTĚHOVANÉ
   --------------------------------------------------------------------------
   Samotný výpočet i sazby žijí od 28. 8. 2026 v `penti-cenik-vazniky.js`.
   Ten se po načtení sám připne zpátky sem, takže stránky, které volají
   `PentiEngine.cenaVazniku`, fungují dál — jen musí ten soubor načíst.

   Tenhle zástupce zůstává kvůli jedinému pravidlu: SPADLÝ VÝPOČET NESMÍ
   VRÁTIT NULU. Kdyby chybějící ceník znamenal cenu 0 Kč, nabídka by tiše
   vyšla levněji a nikdo by si toho nevšiml.
   ========================================================================== */
function cenaVazniku(){
  throw new Error("PENTI: cena vazníků se počítá v modulu penti-cenik-vazniky.js, "+
    "který na této stránce není načtený. Doplňte <script src=\"penti-cenik-vazniky.js\">.");
}

/* ==========================================================================
   MATERIÁL — modul KRYTINY / PODSTŘEŠÍ (zatím Bramac Classic)
   Vstup: geom (s rovinami), opts={roztecKrokvi, latProfil, pozadavky, lehkyStrop}
   Pravidla převzata z Technické příručky / strecha_pravidla.md (sekce 5.0, 5.1, 6).
   ========================================================================== */
// DHV fólie dle třídy těsnosti (1 = nejtěsnější) — PENTI standard JUTA/Dörken (zdroj: PENTI pravidla 5.5.5, Juta manuál 07/2023, Dörken návod DHV)
const FOLIE=(()=>{ const f36='Jutadach THERMOISOL 2AP (= HG Fol 240 Plus) / Delta Maxx Plus / Superdach Profi (ekonomická volba)';
  return {6:f36, 5:f36, 4:f36, 3:f36, 2:'Jutatop 2AP', 1:'Delta Alpina'}; })();
function dhvTridaClassic(sklon,req){           // třída těsnosti DHV pro Bramac Classic (tab. 5.0)
  req=Math.max(0,req|0); const r=req>=3?3:req;
  if(sklon<12) return null;                    // pod minimálním sklonem
  if(r===0){ if(sklon>=22)return 6; if(sklon>=14)return 4; return 2; }
  if(r===1){ if(sklon>=18)return 4; if(sklon>=14)return 4; return 2; }
  if(r===2){ if(sklon>=18)return 4; if(sklon>=14)return 3; return 2; }
  if(sklon>=18)return 3; if(sklon>=14)return 3; return 1;   // 3+ požadavky
}
function rowWidthAt(rings,v){ let lo=Infinity,hi=-Infinity;   // šířka roviny ve výšce v (pro délku latě v dané řadě)
  (rings||[]).forEach(r=>{for(let k=0;k<r.length;k++){const A=r[k],B=r[(k+1)%r.length],a=A[1],b=B[1];
    if(((a<=v&&b>=v)||(b<=v&&a>=v))&&Math.abs(b-a)>1e-9){const t=(v-a)/(b-a),u=A[0]+t*(B[0]-A[0]); if(u<lo)lo=u; if(u>hi)hi=u;}}}); return hi>lo?hi-lo:0; }
/* KRYTINOVÁ ROVINA: latě/tašky/plech leží na bednění + kontralatích, tj. nad nosnou rovinou o tloušťku h (m).
   Krytinová rovina je proto delší ve spádu o h·tg(sklon) a úměrně větší. Rozvinuté obrysy natáhneme ve směru spádu (v). */
function krytinaRovina(p,h){ const L=p.delka_spad||0, a=(p.sklon||0)*Math.PI/180;
  const f=(L>0&&h>0)?(L+h*Math.tan(a))/L:1;
  const rings=(p.tvarRings||[p.tvar]||[]).map(r=>(r||[]).map(pt=>[pt[0], pt[1]*f]));
  return {f, delka_spad:L*f, sikma:(p.sikma||0)*f, rings}; }
/* Modely tašek (z technické příručky Bramac TP 2026) – parametry, kterými se liší kladečák a latě.
   vlMax(sklon) = maximální rozteč latí [mm] pro daný sklon (latě se pak rozdělí ≤ této hodnoty). */
// vlMax(sklon) = maximální rozteč latí [mm] dle sklonu; vlMin = minimální rozteč latí [mm] (posuvná taška se pod ni neposune).
// hrebenacKsM = spotřeba hřebenáčů na 1 bm (Bramac 2,5 · Tondach 3,0 · Erlus 2,6)
// vetrLQ = účinný větrací průřez jedné větrací tašky [cm²] (pro výpočet odvětrání podle průřezu)
const MODELY_TASEK={
  classic:  { maPultasku:true,nazev:'Bramac Classic', typ:'betonová',  krycMm:300, vetrPer100:10, vetrPlosne:true, krajMm:40,  minSklon:12, kladeni:'strih', kladeniVolba:false, vlMin:315, vlMax:s=> s>30?340:s>25?330:315, hrebenacKsM:2.5, vetrLQ:50, bezpecnySklon:22, vlo_mm:330, vlh_mm:40, vlPO_K:400, krajovka:{pulena:true, kryci_l_mm:300, kryci_p_mm:300, pozn:'Krajní P + n×základní + půlená + krajní L; konstrukční šíře = krycí − 2×40 mm; krok 0,5 tašky'}},
  // Tegalit má v pásmu 25–30° max. rozteč latí 325 mm (NE 330 jako Classic) — TP Bramac 2026, str. 16.
  // Tabulka z příručky: 15–25° → 315 mm · 25–30° → 325 mm · nad 30° → 340 mm.
  tegalit:  { maPultasku:true,nazev:'Bramac Tegalit',  typ:'betonová',  krycMm:300, vetrPer100:20, vetrPlosne:true, krajMm:40,  minSklon:15, kladeni:'vazba', kladeniVolba:false, vlMin:315, vlMax:s=> s>30?340:s>25?325:315, hrebenacKsM:2.5, vetrLQ:25, bezpecnySklon:25, vlo_mm:330, vlh_mm:40, vlPO_K:400, krajovka:{pulena:true, kryci_l_mm:300, kryci_p_mm:300, pozn:'Krajní L/P (Tegalit); konstrukční šíře = krycí − 2×40 mm'}, krajovkaKazdaRada:true},
  // ---- Bramac MAX (betonová, velkoformátová) — TP Bramac 2026 str. 18 + ceník str. 71 ----
  // Rozteč latí podle sklonu: 12–25° → 375 · 25–30° → 390 · nad 30° → 405 mm. Krycí šířka 330, závěsná délka 458.
  // Spotřeba 7,5–8,2 ks/m² sedí: 1/(0,330×0,405)=7,5 a 1/(0,330×0,370)=8,2.
  // VLO+PO = 460 mm (tabulka VLO 360–420 / PO 100–40). Odvětrávací taška min. 10 ks/100 m², hřebenáč 2,5 ks/m.
  bramacmax: { maPultasku:true,nazev:'Bramac MAX', typ:'betonová', krycMm:330, vetrPer100:10, vetrPlosne:true, krajMm:40, minSklon:12, kladeni:'strih', kladeniVolba:false, vlMin:370, vlMax:s=> s>30?405:s>25?390:375, hrebenacKsM:2.5, vetrLQ:50, bezpecnySklon:22, vlo_mm:380, vlh_mm:40, vlPO_K:460, krajovka:{pulena:true, kryci_l_mm:330, kryci_p_mm:330, pozn:'Krajní L/P + půlená; konstrukční šíře = krycí − 2×40 mm; krajní taška cca 2,6 ks/m'}},

  // ---- Bramac Viva (betonová) — TP Bramac 2026 str. 22 + ceník str. 66 ----
  // Rozteč latí podle sklonu: 20–25° → 310 · 25–35° → 320 · nad 35° → 330 mm. Kladení na vazbu.
  // Nejvyšší bezpečný sklon z betonových tašek (30°). Odvětrávací taška min. 20 ks/100 m².
  viva: { maPultasku:true,nazev:'Bramac Viva', typ:'betonová', krycMm:300, vetrPer100:20, vetrPlosne:true, krajMm:40, minSklon:20, kladeni:'vazba', kladeniVolba:false, vlMin:310, vlMax:s=> s>35?330:s>25?320:310, hrebenacKsM:2.5, vetrLQ:25, bezpecnySklon:30, vlo_mm:330, vlh_mm:40, vlPO_K:400, krajovka:{pulena:true, kryci_l_mm:300, kryci_p_mm:300, pozn:'Krajní L/P celá i 3/4; konstrukční šíře = krycí − 2×40 mm; krajní taška cca 1,5 ks/m'}},

  // ---- Bramac Moravská taška Protector PLUS (betonová) — TP Bramac 2026 str. 24 + ceník str. 48 ----
  // Rozteč latí stejná jako Classic: 12–25° → 315 · 25–30° → 330 · nad 30° → 340 mm.
  moravska: { maPultasku:true,nazev:'Bramac Moravská taška Protector PLUS', typ:'betonová', krycMm:300, vetrPer100:10, vetrPlosne:true, krajMm:40, minSklon:12, kladeni:'strih', kladeniVolba:false, vlMin:315, vlMax:s=> s>30?340:s>25?330:315, hrebenacKsM:2.5, vetrLQ:50, bezpecnySklon:22, vlo_mm:330, vlh_mm:40, vlPO_K:400, krajovka:{pulena:true, kryci_l_mm:300, kryci_p_mm:300, pozn:'Krajní L/P + půlená; konstrukční šíře = krycí − 2×40 mm; krajní taška cca 3 ks/m'}},

  // ---- Bramac Granát 11 (keramická posuvná) — TP Bramac 2026 str. 36 + ceník str. 92 ----
  // Rozměr 445×265, střední krycí šířka 230 mm, střední závěsná délka 418 mm, rozteč latí 338–380 mm.
  // Spotřeba 11,4–12,9 ks/m² sedí: 1/(0,230×0,380)=11,4 a 1/(0,230×0,338)=12,9.
  // Lze klást na vazbu i na střih (proto kladeniVolba). Hřebenáč kónický K 3 ks/m, odvětrávací taška min. 25 ks/100 m².
  // VLH je závislá na sklonu (TP str. 36): do 30° → 45 mm · 30–45° → 35 mm · nad 45° → 25 mm.
  granat11: { maPultasku:true,nazev:'Bramac Granát 11', typ:'keramická', krycMm:230, vetrPer100:25, vetrPlosne:true, krajMm:110, minSklon:15, kladeni:'vazba', kladeniVolba:true, vlMin:338, vlMax:s=> 380, hrebenacKsM:3.0, vetrLQ:20, bezpecnySklon:25, vlo_mm:335, vlh_mm:35, vlPO_K:415,
    vlhTab:{ pas:{20:45,25:45,30:45,35:35,40:35,45:35,50:25} },
    krajovka:{pulena:true, kryci_l_mm:230, kryci_p_mm:230, pozn:'Krajní L/P + půlená; krajní taška cca 2,7 ks/m'}, krajovkaKazdaRada:true},

  // Bramac Granát 13 – KERAMICKÁ posuvná taška (Bramac ceník 2026 str.97 + TP). Rozměr 428×260, spotřeba 12,9 ks/m². VL 338–380, VLO ~335, VLH 30, krycí šíře ~214 (půlená 107), krajMm 110.
  // POZN.: minSklon/bezpecnySklon a vetrLQ zatím NEOVĚŘENO v podkladech – k potvrzení.
  // OPRAVENO dle TP Bramac 2026 str. 38: střední krycí šířka 215 mm (ne 214) a rozteč latí 330–360 mm (ne 338–380).
  // Kontrola spotřeby: 1/(0,215×0,360)=12,9 a 1/(0,215×0,330)=14,1 ks/m² — přesně jak uvádí příručka.
  // VLO+PO = 400 mm (tabulka VLO 300–360 / PO 100–40). VLH závisí na sklonu: do 30° → 40 · 30–45° → 30 · nad 45° → 20 mm.
  granat13: { maPultasku:true,nazev:'Bramac Granát 13', typ:'keramická', krycMm:215, vetrPer100:25, vetrPlosne:true, krajMm:110, minSklon:12, kladeni:'vazba', kladeniVolba:true,  vlMin:330, vlMax:s=> 360, hrebenacKsM:2.5, vetrLQ:20, bezpecnySklon:22, vlo_mm:330, vlh_mm:30, vlPO_K:400,
    vlhTab:{ pas:{12:40,15:40,20:40,25:40,30:40,35:30,40:30,45:30,50:20} },
    krajovka:{pulena:true, kryci_l_mm:215, kryci_p_mm:215, pozn:'Krajní L/P + půlená (krycí ~107 mm); konstrukční = krycí − 2×110'}, krajovkaKazdaRada:true},
  // Bramac Topas 13 — keramická POSUVNÁ taška, formát 431×262 mm, cca 3,5 kg/ks (přidáno 2026.10.183).
  // Zdroj: TP Bramac 2026-2, str. 40–41: VL 320–360 mm, kladení NA STŘIH, střední krycí šířka 216 mm,
  //   spotřeba 12,9–14,5 ks/m², bezpečný sklon 25°, minimální 15°.
  //   VLO 290–350 / PO 100–40 → VLO+PO = 390 mm; doporučená VLO 295 mm (PO 95).
  //   VLH: do 30° → 40 · 30–45° → 30 · nad 45° → 20 mm.
  //   Konstrukční šíře = krycí − 2×85 mm = krajní P + n× základní + krajní L
  //   (2 krajní tašky = konstrukční 292 → krycí 462 mm, tj. obě krajní dohromady 462 mm).
  // Ceník 2026 str. 103–104: hřebenáč drážkový HO 3 ks/m, odvětrávací taška min. 25 ks/100 m² (i TP str. 63).
  // Půlená taška v sortimentu není → maPultasku:false. Účinný průřez větrací tašky Bramac neuvádí —
  //   převzato 20 cm² jako u Granátu 13 a Rubínu 9.
  topas13: { maPultasku:false,nazev:'Bramac Topas 13', typ:'keramická', krycMm:216, vetrPer100:25, vetrPlosne:true, krajMm:85, minSklon:15, kladeni:'strih', kladeniVolba:false, vlMin:320, vlMax:s=> 360, hrebenacKsM:3.0, vetrLQ:20, bezpecnySklon:25, vlo_mm:295, vlh_mm:30, vlPO_K:390,
    vlhTab:{ pas:{12:40,15:40,20:40,25:40,30:40,35:30,40:30,45:30,50:20} },
    krajovka:{pulena:false, kryci_l_mm:231, kryci_p_mm:231, pozn:'Krajní P + n×základní + krajní L; obě krajní dohromady krycí 462 mm (TP str. 41); konstrukční = krycí − 2×85 mm; krajní taška cca 2,8 ks/m'}},
  // Bramac Rubín 9 — keramická POSUVNÁ taška (posuv až 30 mm), formát 472×311 mm, hmotnost 4,0 kg/ks.
  // Krycí šířka 265 mm a rozteč latí 370–400 mm sedí na spotřebu z ceníku Bramac 2026:
  //   1/(0,265 × 0,400) = 9,4 ks/m²   a   1/(0,265 × 0,370) = 10,2 ks/m²   (ceník uvádí 9,4–10,2 ks/m²)
  // Sklony dle TP Bramac 2026 str. 42: bezpečný 16°, minimální 12°. Střední závěsná délka 437 mm, hmotnost 4,0 kg/ks.
  // Krajní taška 2,5 ks/m → krycí délka 400 mm. Hřebenáč drážkový HO 3 ks/m. Odvětrávací taška min. 25 ks/100 m².
  // OVĚŘENO z příručky: VLO+PO = 435 mm (tabulka VLO 335–395 / PO 100–40) — dřív tu chybně stálo 400.
  // VLH závisí na sklonu: do 30° → 40 · 30–45° → 30 · nad 45° → 20 mm.
  rubin9: { maPultasku:false,nazev:'Bramac Rubín 9', typ:'keramická', krycMm:265, vetrPer100:25, vetrPlosne:true, krajMm:400, minSklon:12, kladeni:'strih', kladeniVolba:false, vlMin:370, vlMax:s=> 400, hrebenacKsM:3.0, vetrLQ:20, bezpecnySklon:16, vlo_mm:335, vlh_mm:30, vlPO_K:435,
    vlhTab:{ pas:{12:40,15:40,20:40,25:40,30:40,35:30,40:30,45:30,50:20} },
    /* POZOR NA SMĚR POSUVU (opraveno 31. 8. 2026).
       Do té doby tu stálo „posuv až 30 mm — šířka se dorovnává posunem".
       To je špatně: posuvná taška se posouvá PO DÉLCE, mění se jí krycí
       délka a tím rozteč latí. Na šířku posuv vliv nemá.
       Šířku řídí STŘEDNÍ KRYCÍ ŠÍŘKA. U pálené tašky se keramika při
       výpalu smršťuje pokaždé trochu jinak, takže 265 mm je jmenovitá
       hodnota z ceníku a skutečnou je potřeba na stavbě změřit. Malý
       zbytek se srovná mírným roztažením spár. */
    krajovka:{pulena:false, kryci_l_mm:265, kryci_p_mm:265, pozn:'Půltašku nemá — zbytek na šířku se srovná roztažením spár; střední krycí šířku je nutné změřit'}},
  // pripojHreben = systém „taška pro připojení hřebene" (podhřebenová): nahradí větrací pás + bodové větrací tašky.
  //   ksBm = spotřeba podhřebenových tašek na 1 bm hřebene (8,8 = oboustranně, tj. obě střešní roviny), lqTaska = větrací průřez 1 ks [cm²]
  /* Krycí délka 323–363 mm platí u Contitonu BEZ OHLEDU NA SKLON — technický
     list Stodo 12 (str. 4 a 8) žádné zkrácení podle sklonu nezná. Do 24. 8. 2026
     tu byl strop 345 mm pro sklony 22–30°, což trefovalo většinu střech,
     protože 30° je u Contitonu bezpečný sklon. Vycházela z toho řada tašek navíc.

     `okapPrvniLat:'spodek1_vrch2'` — u okapu se první rozteč kótuje jinak než
     zbytek: od SPODNÍ hrany okapní latě k HORNÍ hraně druhé latě (list, detail
     okapu: 80 přesah tašky do žlabu, pak 320, pak 323–363). Okapní lať stojí
     nastojato (PENTI 24. 8. 2026), takže podél spádu měří užší rozměr profilu.

     ── PRVNÍ LAŤ SE ODVOZUJE Z PŘESAHU DO ŽLABU (`vlPO_K:400`) ──────────
     Do 26. 8. 2026 tu bylo 320 mm NATVRDO a zadaný přesah do žlabu se
     ignoroval. Jenže těch 320 platí jen pro přesah 80 mm, se kterým počítá
     technický list — a PENTI klade 90. Když taška visí o centimetr hlouběji,
     první lať jde o centimetr výš.

     Ukázala to realizace Blišic (PENTI 26. 8. 2026): na střeše vyšla první
     lať 310 mm, ne 320. Přesně 320 − (90 − 80).

     CO JE TA KONSTANTA. Není to součet dvou kót z listu, ale ZMĚŘENÝ ROZMĚR
     TAŠKY: od závěsného nosu ke konci (patě). PENTI ho 26. 8. 2026 změřilo
     na kuse — přesně 400 mm. Z listu vychází totéž (80 mm do žlabu + 320 mm
     za okapní hranu) a sedí to i s celkovou délkou tašky 433 mm: nad nosem
     zbývá 33 mm na hlavu.

     Tímhle se dá konstanta zjistit u kterékoli tašky — stačí na ní změřit
     vzdálenost od nosu ke konci. Nemusí se shánět technický list.

     Ať se taška zavěsí do žlabu jakkoli hluboko, ten rozměr se nemění:

         vrch druhé latě = 400 − přesah do žlabu

     Stejné pravidlo už používá osm modelů Bramacu. Zbylých šest Tondachů
     a Erlus mají první lať pořád natvrdo — jejich konstanty neznáme,
     chtělo by to jejich technické listy. */
  contiton: { maPultasku:false,nazev:'Tondach Contiton 12', typ:'keramická', krycMm:230, vetrPer100:28, krajMm:100, minSklon:20, kladeni:'strih', kladeniVolba:false, vlMin:323, vlMax:s=> 363, hrebenacKsM:3.0, vetrLQ:18, bezpecnySklon:30, vlo_mm:320, vlPO_K:400, delkaMm:433, vlh_mm:35, okapPrvniLat:'spodek1_vrch2',
    // VLH (OLH = odstup poslední latě od osy hřebene) dle Tondach manuálu – LIŠÍ se podle řešení hřebene a sklonu [°]
    vlhTab:{ pripoj:{20:45,25:40,30:35,35:30,40:30,45:25,50:25},   // s podhřebenovou (připojení hřebene)
             pas:   {20:47,25:43,30:40,35:38,40:37,45:36,50:35} }, // s větrací taškou
    pripojHreben:{ksBm:8.8, lqTaska:20}, krajovka:{pulena:false, kryci_l_mm:129, kryci_p_mm:94, lem_mm:30, pozn:'Okrajová – krycí šířka levá 129, pravá 94 mm (Tondach detail okraje); pole b=230 mm; vnější líc lemu krajovky je 30 mm za lícem čelní desky = konec laťování (Tondach detail, PENTI 20. 11. 2026)'}},
  // Planoton 11 (Figaro 11): posuvná taška, formát 27,7×47, spotřeba ~10,9 ks/m². Krycí délka 360–385 mm (doporučená 365–380) dle Tondach manuálu.
  // Sklony dle Wienerberger/Tondach: minimální (s doplňkovými opatřeními + DHV) 20°, bezpečný 30°.
  planoton11: { maPultasku:true,nazev:'Tondach Planoton 11', typ:'keramická', krycMm:238, vetrPer100:25, krajMm:100, minSklon:20, kladeni:'vazba', kladeniVolba:false, vlMin:360, vlMax:s=> 380, hrebenacKsM:3.0, vetrLQ:25, bezpecnySklon:30, vlo_mm:355, vlh_mm:40,
    // VLH (OLH) dle Tondach manuálu – Planoton má jen jedno řešení (větrací taška), dle sklonu [°]
    vlhTab:{ pas:{20:45,25:40,30:40,35:35,40:30,45:30,50:25} },
    krajovka:{pulena:false, kryci_l_mm:277, kryci_p_mm:238, pozn:'Tondach Figaro/Planoton 11 TP: S = 277(levá) + Y×238(řadová SKS) + 238(pravá) — asymetrický okraj'}},
  // Planoton 14 (Figaro Deluxe): posuvná taška, formát 24,0×42,1, krycí šířka 210, krycí délka 280–347 (dop. 290–337), spotřeba ~13,7 ks/m², jen barva engoba granit.
  // Sklony dle TP: minimální 20°, bezpečný 30°. Okraj (TP): S = 241(levá celková) + Y×210(řadová) + 210(pravá). VLO=300 (KD=(K−300−OLH)/X). vetrLQ převzato z Planoton 11 (v listu Figaro Deluxe neuvedeno).
  planoton14: { maPultasku:true,nazev:'Tondach Planoton 14', typ:'keramická', krycMm:210, vetrPer100:17, krajMm:100, minSklon:20, kladeni:'vazba', kladeniVolba:false, vlMin:280, vlMax:s=> 347, hrebenacKsM:3.0, vetrLQ:25, bezpecnySklon:30, vlo_mm:300, vlh_mm:40,
    vlhTab:{ pas:{20:45,25:40,30:40,35:30,40:30,45:30,50:25} },
    krajovka:{pulena:false, kryci_l_mm:241, kryci_p_mm:210, pozn:'Tondach Figaro Deluxe TP: levá krycí 241 (celková š.), pravá 210 (= řadová), pole b=210 mm'}},
  sensaton11: { maPultasku:false,nazev:'Tondach Sensaton 11', typ:'keramická', krycMm:228, vetrPer100:25, krajMm:100, minSklon:12, kladeni:'strih', kladeniVolba:false, vlMin:355, vlMax:s=> s>30?380:s>22?375:365, hrebenacKsM:3.0, vetrLQ:25, bezpecnySklon:22, vlo_mm:355, vlh_mm:30,
    // Univerzální posuvná taška (dříve Samba 11), 11 ks/m², kladení NA STŘIH. Tondach technický list + detaily T18/T19/T20 (01/2023).
    // VLH (OLH = odstup hřebenové latě od osy hřebene) – detail hřebene T.19 var. B: OLH ≈ 30 mm; okap T18: okapní lať ~355 mm od 1. polní latě, přesah přes okapní lať 90 mm.
    vlhTab:{ pas:{12:30,20:30,25:30,30:30,35:30,40:30,45:30,50:30} },
    pripojHreben:{ksBm:9, lqTaska:25},
    krajovka:{pulena:false, kryci_l_mm:282, kryci_p_mm:228, pozn:'Okrajová – krycí šířka levá 282, pravá 228 mm (Tondach detail okraje T.20.u1.b); základní taška krycí 228 mm'}},
  renoton11: { maPultasku:true,nazev:'Tondach Renoton 11', typ:'keramická', krycMm:232, vetrPer100:25, krajMm:100, minSklon:20, kladeni:'vazba', kladeniVolba:false, vlMin:340, vlMax:s=> s>30?400:s>22?380:360, hrebenacKsM:3.0, vetrLQ:25, bezpecnySklon:30, vlo_mm:355, vlh_mm:35,
    // Univerzální posuvná taška (Hranice 11), 11 ks/m², dvojitá drážka, posuv až 60 mm, kladení NA VAZBU. Tondach technický list.
    vlhTab:{ pas:{20:35,25:32,30:30,35:30,40:30,45:30,50:30} }, pripojHreben:{ksBm:9, lqTaska:25},
    krajovka:{pulena:false, kryci_l_mm:277, kryci_p_mm:232, pozn:'Okrajová levá 277, pravá 232 mm — S = 277 + Y×SKS + 232 (Tondach produktový list Renoton 11, 3|2026, str. 8–9; opraveno 20. 11. 2026, dřív levá 232)'}},
  renoton14: { maPultasku:true,nazev:'Tondach Renoton 14', typ:'keramická', krycMm:204, vetrPer100:17, krajMm:100, minSklon:20, kladeni:'vazba', kladeniVolba:false, vlMin:280, vlMax:s=> s>30?340:s>22?320:300, hrebenacKsM:3.0, vetrLQ:15, bezpecnySklon:30, vlo_mm:300, vlh_mm:35,
    // Univerzální posuvná taška (Brněnka 14, francouzský typ), 14 ks/m², dvojitá drážka, kladení NA VAZBU. Tondach technický list.
    vlhTab:{ pas:{20:35,25:32,30:30,35:30,40:30,45:30,50:30} }, pripojHreben:{ksBm:9, lqTaska:15},
    krajovka:{pulena:false, kryci_l_mm:245, kryci_p_mm:204, pozn:'Okrajová levá 245, pravá 204 mm — S = 245 + Y×SKS + 204 (Tondach produktový list Renoton 14, 3|2026, str. 8–9; opraveno 20. 11. 2026, dřív levá 204)'}},
  /* Reformpfanne XXL je DRÁŽKOVÁ taška — do vazby se posunout nedá, drážky
     jí to nedovolí. Klade se na střih. Do 16. 8. 2026 tu bylo chybně
     „na vazbu" (nahlásil PENTI, ověřeno u výrobce:
     https://www.erluscz.cz/produkt/reformpfanne-xxl/ — v příslušenství
     stojí „Taška poloviční – používá se Grossfalzziegel XXL", tedy vlastní
     půltašku tenhle model ani nemá). */
  erlusxxl: { maPultasku:false,nazev:'ERLUS Reformpfanne XXL', typ:'keramická', krycMm:257, vetrPer100:18, krajMm:100, minSklon:16, kladeni:'strih', kladeniVolba:false, vlMin:377, vlMax:s=> s>30?397:s>22?387:377, hrebenacKsM:2.6, vetrLQ:28, bezpecnySklon:22, vlo_mm:385, vlh_mm:35,
    // VLH (odstup hřebenové latě) dle sklonu — Erlus produktový list, tabulka „Hodnoty LAF" (s větracím hřebenovým pásem)
    vlhTab:{ pas:{10:50,15:45,20:35,25:30,30:35,35:35,40:35,45:30,50:30,55:30} },
    krajovka:{pulena:false, kryci_l_mm:257, kryci_p_mm:257, pozn:'Krajní L/P (krycí 257 mm); vlastní poloviční taška se nevyrábí — půjčuje se z Grossfalzziegel XXL'}}
};
function modelTasky(id){ return MODELY_TASEK[id]||MODELY_TASEK.classic; }

/* ══════════════════════════════════════════════════════════════════════
   TVAR A MATERIÁL KRYTINY — PRO VÝBĚR OČIMA
   ----------------------------------------------------------------------
   PROČ TO TU JE
   Zákazník na webu nepozná rozdíl mezi Renotonem a Planotonem podle
   názvu, ale podle tvaru profilu ano. Vybírá proto nejdřív TVAR, pak
   MATERIÁL, a teprve potom konkrétní model (PENTI 11. 8. a 30. 8. 2026).

   Je to samostatná tabulka, ne nové pole uvnitř `MODELY_TASEK`. Tam jsou
   technické parametry, na kterých stojí výpočet — do těch hustých řádků
   se nesahá kvůli popisce. Tvar výpočet nijak neovlivňuje.

   PŮVOD ÚDAJŮ
   · keramické — zadal PENTI 11. 8. 2026
   · plechové  — zadal PENTI 30. 8. 2026
   · betonové a ERLUS — návrh, POTVRDIT (30. 8. 2026)
   ══════════════════════════════════════════════════════════════════════ */
const TVARY_KRYTIN = {
  klasicka:    { nazev:'Klasická',     popis:'Tradiční profil s vlnou a drážkou' },
  plocha:      { nazev:'Plochá',       popis:'Rovný povrch bez vlny, moderní vzhled' },
  /* Pátý tvar, doplněn 30. 8. 2026 na žádost PENTI. Reformpfanne
     a Contiton nejsou ani ploché, ani vlnovky — mají mělkou vlnu na
     jinak rovné tašce a v obou sousedních skupinách působily cizí. */
  plocha_vlna: { nazev:'Plochá s mírnou vlnou',
                 popis:'Rovná taška s mělkou vlnou — klidná, ale ne úplně hladká' },
  mirna_vlna:  { nazev:'Mírná vlna',   popis:'Jemné zvlnění, klidný celkový dojem' },
  velka_vlna:  { nazev:'Velká vlna',   popis:'Výrazná vlna, plastický stín' }
};
const MATERIALY_KRYTIN = {
  'betonová':  'Betonová',
  'keramická': 'Keramická',
  'plechová':  'Plechová'
};
/* Model → tvar. Co tu chybí, se pozná: katalog se odmítne postavit. */
const TVAR_MODELU = {
  /* keramické — základ zadal PENTI 11. 8. 2026, upřesnil 30. 8. */
  renoton11:'klasicka', renoton14:'klasicka', granat11:'klasicka', granat13:'klasicka',
  topas13:'plocha_vlna',        // PENTI 15. 10. 2026
  planoton11:'plocha',  planoton14:'plocha',
  contiton:'plocha_vlna',       // PENTI 30. 8. — dřív mírná vlna
  erlusxxl:'plocha_vlna',       // PENTI 30. 8. — Reformpfanne
  rubin9:'velka_vlna',  sensaton11:'velka_vlna',
  /* betonové — zařadil PENTI 30. 8. 2026 */
  classic:'mirna_vlna', moravska:'mirna_vlna', bramacmax:'mirna_vlna',
  tegalit:'plocha',
  viva:'mirna_vlna',            // NÁVRH, jako jediný z betonových nepotvrzen
  /* plechové — PENTI 30. 8. 2026: falcovaná a click patří k plochým
     (hladký povrch bez vlny), Bella Sara má mírnou vlnu. */
  bella:'mirna_vlna', falcovana:'plocha', click:'plocha'
};

/* ══════════════════════════════════════════════════════════════════════
   PLECHOVÉ KRYTINY
   ----------------------------------------------------------------------
   Nejsou to taškové modely — nemají krycí délku ani rozteč latí, vedou se
   proto zvlášť. Do 30. 8. 2026 stály zapsané uvnitř `Rozpocet_profi.html`
   a webová kalkulačka o nich nevěděla. Teď jsou v jádru, ze kterého čtou
   obě rozhraní, aby se nemohly rozejít.

   `bella` je výjimka: maloformátová plechová TAŠKA, klade se na latě
   s pevnou roztečí 350 mm, ne v pásech.
   ══════════════════════════════════════════════════════════════════════ */
const MODELY_PLECH = {
  falcovana: { nazev:'Falcovaná krytina (hliník)', typ:'plechová', minSklon:7,  bezpecnySklon:10,
               popis:'KJG hliník mat nebo PREFA Prefalz, tl. 0,7 mm',
               kryciMm:560, vPasech:true, podklad:'bedneni2x' },
  click:     { nazev:'Click panel',                typ:'plechová', minSklon:12, bezpecnySklon:15,
               popis:'Lakovaný pozink KJG',
               kryciMm:510, vPasech:true, podklad:'bedneni' },
  bella:     { nazev:'Bella Sara (Budmat)',        typ:'plechová', minSklon:12, bezpecnySklon:14,
               popis:'Maloformátová plechová taška, krycí 1150 × 700 mm, laťování fixně 350 mm',
               kryciMm:1150, roztecLatiMm:350, vPasech:false, podklad:'late' }
};
function jePlech(kod){ return !!MODELY_PLECH[kod]; }
function modelKrytiny(kod){ return MODELY_PLECH[kod] || MODELY_TASEK[kod] || null; }

/* ══════════════════════════════════════════════════════════════════════
   NA ČEM KRYTINA LEŽÍ — JEDNO MÍSTO MÍSTO PĚTI KOPIÍ PODMÍNKY
   ----------------------------------------------------------------------
   Do 7. 9. 2026 byla znalost „falc = dvě vrstvy bednění, click = jedna,
   Bella a taška = latě" zapsaná jen jako podmínky v rozhraní staré
   kalkulačky (`krTyp==='falcovana'` a spol.). Profi verze, web, řez
   skladbou i technický popis si to musely odvozovat znovu — a profi
   verze to neuměla vůbec, takže bednění hlavní střechy nepočítala.

   Teď je to vlastnost krytiny:

     'late'       — klade se na latě (tašky, Bella Sara)
     'bedneni'    — potřebuje celoplošné bednění (Click)
     'bedneni2x'  — dvě vrstvy bednění (falcovaná)

   POZOR NA ROZDÍL MEZI „POTŘEBUJE" A „BUDE". Tohle říká, co krytina
   vyžaduje sama o sobě. Krytina na latích může bednění dostat taky —
   z jiného důvodu (úžlabí, nároží, nízká třída DHV, vazníky s lehkým
   stropem). To řeší `duvodyProBedneni()` níž.
   ══════════════════════════════════════════════════════════════════════ */
function podkladKrytiny(kod){
  var m = modelKrytiny(kod);
  return (m && m.podklad) || 'late';     // taška bez příznaku = latě
}

/* Kolik vrstev bednění krytina sama vyžaduje. */
function vrstvyBedneni(kod){
  var p = podkladKrytiny(kod);
  return p === 'bedneni2x' ? 2 : (p === 'bedneni' ? 1 : 0);
}

/* Proč by měla mít bednění i krytina, která se klade na latě.
   Vrací seznam důvodů — prázdný znamená, že bednění potřeba není.

   Stejná pravidla, jaká měla stará kalkulačka v `materialBramacClassic`;
   tady jsou samostatně, aby si je mohla vzít i profi verze a web. */
function duvodyProBedneni(g, o){
  o = o || {};
  var d = [];
  if((g && g.valley || 0) > 0.01) d.push('úžlabí');
  if((g && g.hip || 0) > 0.01)    d.push('nároží');
  if(o.tridaDHV != null && o.tridaDHV <= 3) d.push('DHV třída ' + o.tridaDHV);
  /* Vazníky nad vytápěným prostorem nesou i strop — střecha pak musí
     být celoplošně bedněná. Lidově „bungalov" (PENTI 7. 9. 2026). */
  if(o.lehkyStrop) d.push('vazníky s lehkým stropem');
  return d;
}
function tvarModelu(kod){ return TVAR_MODELU[kod] || null; }

/* ══════════════════════════════════════════════════════════════════════
   KOLIK ŘAD TAŠEK VYJDE NA ROVINU — JEDEN ZDROJ PRO VŠECHNY
   ----------------------------------------------------------------------
   Počet řad potřebují tři různá místa: laťování (kolik latí a v jaké
   rozteči), počet tašek (plocha × ks/m², kde ks/m² závisí na rozteči)
   a počet krajovek (jedna na řadu podél štítu). Dokud si to každé počítalo
   po svém, rozcházelo se to — u Contitonu, který má u okapu vlastní
   kótování, dokonce o celou řadu.

   Vrací: { rady, roztecM, okapniLatM, prvniRoztecM, okapKota }
     rady        počet ŘAD TAŠEK (= počet latí, na kterých taška visí)
     roztecM     rozteč v poli (od druhé latě k hřebeni)
     okapniLatM  kde leží horní hrana okapní latě (0 = běžné modely)
     prvniRoztecM první rozteč vrch → vrch (0 = běžné modely)              */
/* ODSTUP POSLEDNÍ LATĚ OD OSY HŘEBENE (OLH).
   Není to jedno číslo — u Tondachu závisí na SKLONU a na tom, čím se
   hřeben odvětrává:
     `pas`    = základní taška + větrací pás hřebene  (u Tondachu „s taškou větrací")
     `pripoj` = celá podhřebenová větrací řada
   Bere se nejbližší sklon z tabulky; hodnoty výrobce jsou „cca", takže se
   mezi nimi neinterpoluje. Když model tabulku nemá, platí jeho `vlh_mm`. */
function olhModelu(M, sklon, odvHreben){
  if(!M.vlhTab) return (M.vlh_mm||0);
  const tab=M.vlhTab[(odvHreben==='pripoj'?'pripoj':'pas')]||M.vlhTab.pas;
  if(!tab) return (M.vlh_mm||0);
  const klice=Object.keys(tab).map(Number);
  if(!klice.length) return (M.vlh_mm||0);
  const nej=klice.reduce((a,b)=>Math.abs(b-sklon)<Math.abs(a-sklon)?b:a, klice[0]);
  return (tab[nej]!=null) ? tab[nej] : (M.vlh_mm||0);
}

/* Vstupy se předávají POJMENOVANĚ, ne pořadím — přibývaly a u osmi
   argumentů za sebou už nešlo poznat, který je který:
     { vlo, vlh, latProfil, odvHreben, vloMaxM, radaNavic } */
function radyRovinyLati(M, L, sklon, vst){
  vst = vst || {};
  var vlo = (vst.vlo != null) ? vst.vlo : (M.vlo_mm||0)/1000;
  var vlh = vst.vlh, latProfil = vst.latProfil, odvHreben = vst.odvHreben;
  var vloMaxM = vst.vloMaxM || 0;
  /* Kdo OLH nepošle, dostane ho z tabulky modelu podle SKUTEČNÉHO sklonu
     té roviny. Dřív si ho počet tašek bral z výchozí hodnoty modelu,
     takže se u Contitonu rozcházel s laťováním (35 proti 40 mm). */
  if(vlh==null) vlh=olhModelu(M, sklon, odvHreben)/1000;
  const vlMax=M.vlMax(sklon)/1000;

  /* ── LAŤ NENÍ ŘADA TAŠEK ────────────────────────────────────────────
     OKAPNÍ LAŤ NENESE ŽÁDNOU ŘADU. Jen zvedá spodní hranu první řady,
     aby ležela pod stejným úhlem jako ostatní — taška se zavěšuje až
     na DRUHOU lať (PENTI 24. 8. 2026).

         řad tašek = latí − 1

     Do 24. 8. 2026 se počet tašek počítal z počtu LATÍ, takže na každé
     rovině byla jedna řada navíc. Vrací se proto obojí zvlášť a kdo
     počítá tašky nebo krajovky, musí sáhnout po `radyTasek`. */
  let poleM, nPoli, okapniLatM=0, prvniRoztecM=0, okapKota=false;
  if(M.okapPrvniLat==='spodek1_vrch2'){
    /* Okapní lať stojí NASTOJATO — podél spádu měří užší rozměr profilu.
       Její spodní hrana leží na okapní hraně roviny, kóta 320 mm jde od ní
       k HORNÍ hraně druhé latě (technický list Tondach, detail okapu). */
    const pr=String(latProfil||'60/40').split('/').map(n=>parseInt(n,10)||0);
    okapniLatM=(Math.min(pr[0]||60,pr[1]||40)||40)/1000;
    prvniRoztecM=Math.max(0,vlo-okapniLatM);
    okapKota=true;
    poleM=Math.max(0.001,(L-vlh)-vlo);
    nPoli=Math.max(1,Math.ceil(poleM/vlMax-1e-9));
  }else{
    poleM=Math.max(0.001,L-vlo-vlh);
    nPoli=Math.max(1,Math.ceil(poleM/vlMax));
  }
  /* ── ŘADA NAVÍC, KDYŽ JE ROZTEČ NA HRANĚ ──────────────────────────────
     Rozdělení hledá NEJMENŠÍ počet polí, aby rozteč nepřesáhla maximum.
     Často pak vyjde těsně pod ním — na Blišicích 356 mm proti dovoleným
     363, tedy 7 mm rezervy. To je na střeše, kde se měří na centimetry,
     hodně nabito: stačí, aby se lať posunula, a přesah tašky je pod
     hranicí výrobce.

     Kdo chce klidnější rozměření, přidá jednu řadu — rozteč pak spadne
     doprostřed rozsahu (na Blišicích na 339 mm). Je to VOLBA, ne
     automatika: přidaná řada stojí celou řadu tašek, a ta se nesmí
     objevit v nabídce bez vědomí toho, kdo ji vystavuje.
     Zadal PENTI 24. 8. 2026.

     Pod minimum se jít nesmí — posuvná taška se dál neposune, takže když
     by přidaná řada rozteč stlačila pod `vlMin`, volba se neuplatní. */
  let rezervaM=Math.max(0, vlMax - poleM/nPoli);
  let radaNavicMozna=false;
  if(nPoli>=1){
    const zkusMM=poleM/(nPoli+1);
    radaNavicMozna = (zkusMM >= (M.vlMin||315)/1000 - 1e-9);
    if(vst.radaNavic && radaNavicMozna){ nPoli=nPoli+1; }
  }
  let roztecM=poleM/nPoli, vloEffM=vlo, vloDorovnano=false;

  /* ── DOROVNÁNÍ DO OKAPOVÉ LATĚ ────────────────────────────────────────
     Rozteč nesmí pod minimum (posuvná taška se dál neposune). Ubere se
     proto řada, rozteč se drží na maximu a zbytek pohltí odstup první
     latě. MUSÍ TO BÝT TADY, ne až u laťování — jinak si počet tašek
     spočítá jinou rozteč než řez a kladečský plán se s ním rozejde
     (u ERLUS XXL o celou řadu, chyceno 24. 8. 2026). */
  if(!okapKota && roztecM < (M.vlMin||315)/1000 && nPoli>1){
    const vloStrop=(vloMaxM>0) ? vloMaxM : vlMax;
    nPoli=nPoli-1; roztecM=vlMax;
    vloEffM=Math.min(vlo + (poleM - nPoli*vlMax), vloStrop);
    vloDorovnano=(Math.abs(vloEffM-vlo)>0.0005);
  }

  const polnichLati=nPoli+1;                 // latě, na kterých taška visí
  return { radyTasek:polnichLati,            // ŘAD TAŠEK = polních latí
           polnichLati:polnichLati,
           lati:polnichLati+1,               // + okapní lať, která nenese
           rady:polnichLati,                 // zpětná kompatibilita
           roztecM:roztecM, vloEffM:vloEffM, vloDorovnano:vloDorovnano,
           okapniLatM:okapniLatM, prvniRoztecM:prvniRoztecM, okapKota:okapKota,
           /* Kolik zbývá do maximální krycí délky a jestli by se dala
              přidat řada — rozhraní z toho staví nabídku uživateli. */
           rezervaM:Math.max(0, vlMax-roztecM),
           radaNavicMozna:radaNavicMozna,
           radaNavicPouzita:!!(vst.radaNavic && radaNavicMozna),
           roztecBezRady:(vst.radaNavic && radaNavicMozna) ? poleM/(nPoli-1) : roztecM,
           roztecSRadou:radaNavicMozna
             ? ((vst.radaNavic) ? roztecM : poleM/(nPoli+1)) : null };
}
function materialBramacClassic(g,o){
  o=o||{}; const roztec=o.roztecKrokvi||1.0, latProfil=o.latProfil||'60/40', req=o.pozadavky||0;
  const M=modelTasky(o.model);                               // model tašky (Classic/Tegalit/Granát 13)
  const vlo=(o.vlo_mm||0)/1000, vlh=(o.vlh_mm||0)/1000;     // okapová (VLO) a hřebenová (VLH) vzdálenost latí (z technické příručky)
  const h=o.h_kryt_m||0;                                    // tloušťka bednění+kontralatě (krytinová rovina je o ni nad nosnou)
  // ČSN 73 1901-2, příloha B: krytina s VYSOKÝM difuzním odporem (plech) NEBO tašky s celoplošným bedněním + separační vrstvou → tab. B.2 (mezera dle SKLONU);
  // jinak (tašky kladené bez bednění) → tab. B.1 (mezera dle DÉLKY KROKVE).
  const _sklonMinB = (g.planes&&g.planes.length)?Math.min(...g.planes.map(p=>p.sklon)):0;
  const _tridaB = dhvTridaClassic(_sklonMinB, req);
  const _bedneniProv = (g.valley||0)>0.01 || (g.hip||0)>0.01 || (_tridaB!=null&&_tridaB<=3) || !!o.lehkyStrop;   // bude celoplošné bednění?
  const _highDiffVrstva = !!o.plech || (_bedneniProv && !o.bedneniVyp);
  const planes=(g.planes||[]).map(p=>{
    const vlMax = M.vlMax(p.sklon)/1000;                   // max rozteč [m] dle sklonu
    const vlMin = (M.vlMin||315)/1000;                      // min rozteč [m] (posuvná se pod ni neposune)
    const Ls=p.delka_spad;                                  // NOSNÁ rovina (krokve/bednění) – sem patří kontralatě
    const kr=krytinaRovina(p,h);                            // KRYTINOVÁ rovina (na kontralatích) – sem patří latě
    const rings=kr.rings, L=kr.delka_spad;
    // rozměření latí: pole = KD − VLO − VLH, rozdělit rovnoměrně tak, aby rozteč ≤ max VL
    const field=Math.max(0.001, L - vlo - vlh);
    // rozměření latí (metoda příručky KD = n×VL + VLO + VLH):
    // rovnoměrné dělení s roztečí ≤ max (nikdy nepřekročí → bez zatékání). Když by padlo POD min (posuvná se pod min neposune),
    // ubereme řadu, rozteč držíme na max a zbytek pohltí okapová lať VLO (se stropem, ať nevyskočí nereálně).
    let nPoli, roztecM, vloEff=vlo, vloDorovnano=false;
    let vloNedostacuje=false, vloChybiM=0;
    /* ══════════════════════════════════════════════════════════════════
       OKAP: PRVNÍ ROZTEČ SE KÓTUJE JINAK NEŽ ZBYTEK
       ------------------------------------------------------------------
       U modelů s `okapPrvniLat:'spodek1_vrch2'` (dnes Tondach Contiton 12)
       dává technický list u okapu zvláštní kótu: od SPODNÍ hrany okapní
       latě k HORNÍ hraně druhé latě. Okapní lať přitom stojí NASTOJATO,
       takže podél spádu měří užší rozměr profilu (u latě 60/40 jen 40 mm).

       Spodní hrana okapní latě leží na okapní hraně roviny, tedy na konci
       krokve s kontralatí. Z toho plyne:

           horní hrana okapní latě   = šířka latě nastojato   (40 mm)
           horní hrana druhé latě    = vlo_mm                 (320 mm)
           první rozteč vrch → vrch  = vlo_mm − šířka latě    (280 mm)

       a teprve od druhé latě dál platí krycí délka od vrchu k vrchu.

       Do 24. 8. 2026 se bralo vlo_mm jako odstup PRVNÍ latě od okapní
       hrany a dál se dělilo rovnoměrně — první lať tak seděla o čtvrt
       metru výš a celé laťování bylo posunuté. Nahlásil PENTI. */
    const _rl = radyRovinyLati(M, L, p.sklon, {
      vlo:vlo, vlh:vlh, latProfil:o.latProfil, odvHreben:o.odvHreben,
      vloMaxM:(o.vlo_max_mm>0 ? o.vlo_max_mm/1000 : 0),
      radaNavic:!!o.radaNavic });
    const okapKota = _rl.okapKota;
    const latNaKantM = _rl.okapniLatM;
    const fix=(o.roztecFix_mm||0)/1000;   // PEVNÁ rozteč latí dle modulu krytiny (Bella Sara = 350 mm dle montážního návodu Budmat) — nedopočítává se z modelu tašky
    if(okapKota){
      /* Pole se dělí až OD DRUHÉ latě (vlo) po poslední (L − vlh). */
      nPoli=_rl.polnichLati-1; roztecM=_rl.roztecM; vloEff=vlo;
    } else if(fix>0){
      roztecM=fix;                                        // rozteč je PEVNÁ (modul krytiny), nesmí ji přebít výpočet z tašky
      // Bella se klade od okapu po pevných 350 mm; poslední pole u hřebene se zastřihne (rozteč ≤ 350).
      // ceil (ne round) → u hřebene je vždy lať do 350 mm, nikdy větší mezera; spíš o lať víc než míň.
      nPoli=Math.max(1, Math.ceil(field/fix - 1e-6));
    } else {
      /* Dělení i případné dorovnání do okapové latě dělá SPOLEČNÁ funkce
         radyRovinyLati() — aby počet tašek, laťování i kladečský plán
         mluvily o týchž řadách (24. 8. 2026). */
      nPoli=_rl.polnichLati-1; roztecM=_rl.roztecM;
      vloEff=_rl.vloEffM; vloDorovnano=_rl.vloDorovnano;
      /* Když se dorovnávalo, může se stát, že ani plný rozsah VLO nestačí.
         Pak laťování na tuhle délku roviny prostě nevyjde a musí se upravit
         délka roviny nebo přesah. Radši to říct, než tiše nakreslit něco,
         co nedoběhne k hřebeni.

         STROP MÁ VLASTNÍ ROZSAH. Dřív se VLO zastropovalo na MAXIMÁLNÍ
         ROZTEČ LATÍ, což je úplně jiná veličina — u Classicu ve 25°
         dokonce menší než výchozí VLO, takže se odstup místo zvětšení
         ZMENŠIL a 290 mm roviny se ztratilo (PENTI 16. 8. 2026). */
      if(vloDorovnano || _rl.vloDorovnano){
        var vloStrop = (o.vlo_max_mm>0) ? (o.vlo_max_mm/1000) : vlMax;
        var vloChteno = vlo + (field - nPoli*vlMax);
        vloNedostacuje = (vloChteno > vloStrop + 0.0005);
        vloChybiM = vloNedostacuje ? (vloChteno - vloStrop) : 0;
      }
    }
    const vl=fix>0?Math.round(fix*1000):Math.round(vlMax*1000);
    // bm latí z reálné šířky roviny v každé řadě: zdvojená okapová (2×) + řady pole od VLO po hřebenovou lať
    let _lateRows=[], late_bm=0, pocet_rad=0;
    if(okapKota){
      /* Okapní lať nastojato je JEDNA (ne zdvojená) — zvednutí první řady
         tašek obstará právě to, že stojí na kant. Pak druhá lať na vlo
         a od ní pole. */
      const _okapW=rowWidthAt(rings, Math.min(latNaKantM, L));
      _lateRows.push(_okapW); late_bm+=_okapW;
      for(let k=0;k<=nPoli;k++){ const _w=rowWidthAt(rings, vloEff + k*roztecM); late_bm+=_w; _lateRows.push(_w); }
      pocet_rad=1+nPoli+1;                                  // okapní + druhá + pole
    } else {
      const _okapW=rowWidthAt(rings,0.02); _lateRows=[_okapW,_okapW];   // zdvojená okapová lať = 2 řady o šířce okapu
      late_bm=2*_okapW;
      for(let k=0;k<=nPoli;k++){ const _w=rowWidthAt(rings, vloEff + k*roztecM); late_bm+=_w; _lateRows.push(_w); }   // skutečná šířka roviny v každé řadě (pro řezání latí po kusech)
      pocet_rad=nPoli+1+1;                                  // pole (nPoli+1 latí) + zdvojená okapová lať navíc
    }
    // kontralatě = výška větrané vzduchové mezery dle ČSN 73 1901-2, příloha B
    let kMezeraMm;
    if (_highDiffVrstva) {
      // Tab. B.2 — dle SKLONU vzduchové vrstvy: <5° → 100 mm, 5–25° → 60 mm, 25–45° → 40 mm, >45° → 40 mm
      kMezeraMm = (p.sklon < 5) ? 100 : (p.sklon <= 25 ? 60 : 40);
    } else {
      // Tab. B.1 — dle DÉLKY KROKVE: ≤10 m → 40 mm, 11–15 m → 60 mm; >15 m norma výpočtem (konzervativně 60)
      kMezeraMm = (Ls <= 10) ? 40 : 60;
    }
    const kProfilCSN = (kMezeraMm>=95) ? '45/95' : (kMezeraMm>=60 ? '60/60' : '40/60');   // mezera ≥95 mm → skladový profil 45×95 (ne 60×100); 60 → 60×60; jinak 40×60
    // vysvětlení pro UI: dle které tabulky ČSN 73 1901-2 a proč
    let kTab, kDuvod;
    if(_highDiffVrstva){ kTab='B.2';
      const _band=(p.sklon<5)?'<5°':(p.sklon<=25?'5–25°':(p.sklon<=45?'25–45°':'>45°'));
      kDuvod='ČSN B.2 (s bedněním), sklon '+Math.round(p.sklon)+'° ('+_band+')';
    } else { kTab='B.1';
      kDuvod='ČSN B.1 (bez bednění), krokev '+Ls.toFixed(1)+' m '+(Ls<=10?'≤ 10 m':(Ls<=15?'(11–15 m)':'> 15 m'));
    }
    /* RUČNÍ VOLBA PROFILU (od 13. 9. 2026). Norma dává minimum; projekt
       nebo zvyk firmy může chtít víc (108_26: na 10° části 45×95, ČSN by
       stačilo 60×60). Volba platí pro všechny roviny; důvod se dopíše,
       ať je ve výkazu vidět, že to není z normy. Profil se ověří proti
       známým — překlep by jinak tiše spadl do „jiného" koše ceníku. */
    let kProfil = kProfilCSN;
    /* volba po rovinách (o.kontralatProfily[cislo]) má přednost před celostřešní */
    let kVolba = (o.kontralatProfily && o.kontralatProfily[p.cislo]) || null;
    if(kVolba==='auto') kVolba=null;
    if(!kVolba) kVolba = o.kontralatProfil;
    let kRucni=false;
    if(kVolba && kVolba!=='auto'){
      if(['40/60','60/60','45/95'].indexOf(kVolba)<0) throw new Error('PENTI: neznámý profil kontralatí "'+kVolba+'" (umí 40/60, 60/60, 45/95).');
      kProfil = kVolba; kRucni=true;
      kDuvod = 'zvoleno ručně '+kVolba+' mm ('+kDuvod+' by dala '+kProfilCSN+')';
    }
    const kPocet=Math.ceil(p.sirka_okap/roztec)+1;          // počet kontralatí (po roztečích krokví)
    const kontra_bm=kPocet*Ls;                              // kontralatě na nosné rovině
    return {cislo:p.cislo, sklon:+p.sklon.toFixed(1), sikma:+p.sikma.toFixed(1), delka_spad:+Ls.toFixed(2),
      sikma_kryt:+kr.sikma.toFixed(1), delka_spad_kryt:+L.toFixed(2),
      /* Latí je o jednu víc než řad tašek — okapní lať žádnou nenese,
         jen zvedá spodní hranu první řady. */
      pocet_rad_tasek:Math.max(0, pocet_rad-1),
      /* Jak blízko je rozteč k maximu a co by udělala řada navíc.
         Rozhraní z toho nabízí volbu — viz radyRovinyLati(). */
      rezerva_mm:Math.round((_rl.rezervaM||0)*1000),
      rada_navic_mozna:!!_rl.radaNavicMozna,
      rada_navic_pouzita:!!_rl.radaNavicPouzita,
      roztec_s_radou_mm:_rl.roztecSRadou!=null?Math.round(_rl.roztecSRadou*1000):null,
      sirka_okap:+p.sirka_okap.toFixed(2), vl_mm:vl, roztec_mm:Math.round(roztecM*1000), pocet_rad_lati:pocet_rad, late_bm:+late_bm.toFixed(1),
      vlo_mm:Math.round(vloEff*1000), vlo_pozadovano_mm:Math.round(vlo*1000), vlo_dorovnano:vloDorovnano,
      /* Okap s vlastním kótováním: řez i kladečák potřebují vědět, kde
         okapní lať stojí a jak velká je první (jiná) rozteč. */
      okap_kota:okapKota?'spodek1_vrch2':null,
      okapni_lat_mm:okapKota?Math.round(latNaKantM*1000):0,
      prvni_roztec_mm:okapKota?Math.round((vlo-latNaKantM)*1000):0,
      /* Laťování na tuhle délku roviny nevyjde ani při plném rozsahu VLO. */
      vlo_nedostacuje:vloNedostacuje, vlo_chybi_mm:Math.round(vloChybiM*1000),
      vlh_mm:Math.round(vlh*1000),
      kontralate_profil:kProfil, kontralate_profil_csn:kProfilCSN, kontralate_rucni:kRucni, kontralate_mezera_mm:kMezeraMm, kontralate_tab:kTab, kontralate_duvod:kDuvod, kontralate_pocet:kPocet, kontralate_bm:+kontra_bm.toFixed(1),
      late_rows:_lateRows.map(w=>+w.toFixed(2))};
  });
  const late_celkem=planes.reduce((s,p)=>s+p.late_bm,0);
  const kontra_celkem=planes.reduce((s,p)=>s+p.kontralate_bm,0);
  const sklonMin=g.planes&&g.planes.length?Math.min(...g.planes.map(p=>p.sklon)):0;
  const trida=dhvTridaClassic(sklonMin,req);
  const duvody=[];
  if((g.valley||0)>0.01)duvody.push('úžlabí');
  if((g.hip||0)>0.01)duvody.push('nároží');
  if(trida!=null&&trida<=3)duvody.push('DHV třída '+trida);
  if(o.lehkyStrop)duvody.push('lehký strop / vazníky');
  const paskaPovinna=(trida!=null&&trida<=3)||!!o.paskaForce;   // páska i při podkročení bezpečného sklonu (o.paskaForce)
  return {krytina:M.nazev, kryci_sirka_mm:M.krycMm, latProfil, roztecKrokvi:roztec, pozadavky:req, h_kryt_m:h,
    planes, late_bm_celkem:+late_celkem.toFixed(1), kontralate_bm_celkem:+kontra_celkem.toFixed(1),
    dhv:{trida, folie: trida!=null?FOLIE[trida]:'sklon pod minimem 12° – krytinu nelze použít'},
    paska_pod_kontralate:{povinna:paskaPovinna, bm: paskaPovinna?+kontra_celkem.toFixed(1):+(g.valley||0).toFixed(1),
      pozn: paskaPovinna?'pod všechny kontralatě (DHV třída ≤3 nebo podkročený bezpečný sklon)':'jen pásmo ~2 m podél úžlabí'},
    bedneni:{nutne:duvody.length>0, duvod:duvody, plocha_m2:+g.roofArea.toFixed(1)}};
}

/* ==========================================================================
   ZÁKLOP (celoplošné bednění) — prkna nebo DHF desky, po jednotlivých rovinách
   Vstup: geom (s rovinami), opts={typ:'prkna'|'dhf', prorez_pct,
          prkno_tloustka_mm, prkno_sirka_mm, prkno_delka_m, deska_w_mm, deska_h_mm}
   Spotřeba z plochy roviny + prořez (není to přesný nesting řezů).
   ========================================================================== */
function materialZaklop(g,o){
  o=o||{}; const typ=o.typ||'prkna'; const prorez=(o.prorez_pct!=null?o.prorez_pct:10)/100;
  const planes=(g.planes||[]).map(p=>{
    const plocha=p.sikma*(1+prorez);                 // šikmá plocha + prořez
    if(typ==='dhf'){
      const w=(o.deska_w_mm||675)/1000, h=(o.deska_h_mm||2500)/1000, ba=w*h;
      const ks=Math.ceil(plocha/ba);
      return {cislo:p.cislo, sikma:+p.sikma.toFixed(1), ks, m2:+(ks*ba).toFixed(1)};
    }
    const sm=(o.prkno_sirka_mm||100)/1000, dl=(o.prkno_delka_m||4), tl=(o.prkno_tloustka_mm||22)/1000, ba=sm*dl;
    const ks=Math.ceil(plocha/ba), m2=ks*ba, m3=m2*tl;
    return {cislo:p.cislo, sikma:+p.sikma.toFixed(1), ks, bm:+(ks*dl).toFixed(1), m2:+m2.toFixed(1), m3:+m3.toFixed(3)};
  });
  const out={typ, prorez_pct:(o.prorez_pct!=null?o.prorez_pct:10), planes,
    ks_celkem:planes.reduce((s,p)=>s+p.ks,0), plocha_strechy_m2:+g.roofArea.toFixed(1),
    m2_celkem:+planes.reduce((s,p)=>s+p.m2,0).toFixed(1)};
  if(typ==='dhf'){ out.deska_rozmer=(o.deska_w_mm||675)+'×'+(o.deska_h_mm||2500)+' mm'; }
  else { out.prkno=(o.prkno_tloustka_mm||22)+'×'+(o.prkno_sirka_mm||100)+' mm, délka '+(o.prkno_delka_m||4)+' m';
    out.bm_celkem=+planes.reduce((s,p)=>s+p.bm,0).toFixed(1); out.m3_celkem=+planes.reduce((s,p)=>s+(p.m3||0),0).toFixed(3); }
  return out;
}

/* ==========================================================================
   PLECHOVÝ KLADEČÁK — falcovaná / click (svislé pásy ve směru spádu)
   Pásy o krycí šíři vedené od okapu k hřebeni/nároží; délka pásu = výška
   obrysu roviny v dané poloze + přesah u okapu + přídavek u hřebene.
   ========================================================================== */
function plech_shoelace(t){let s=0;for(let i=0;i<t.length;i++){const a=t[i],b=t[(i+1)%t.length];s+=a[0]*b[1]-b[0]*a[1];}return Math.abs(s/2);}
function plech_topV(tvar,u){   // horní hranice (v) obrysu roviny při dané u (spodní = okap, v=0)
  let top=0;
  for(let k=0;k<tvar.length;k++){const A=tvar[k],B=tvar[(k+1)%tvar.length];
    const x1=A[0],x2=B[0]; if(Math.abs(x2-x1)<1e-9)continue;
    if(u>=Math.min(x1,x2)-1e-9 && u<=Math.max(x1,x2)+1e-9){const t=(u-x1)/(x2-x1);const v=A[1]+t*(B[1]-A[1]);if(v>top)top=v;}}
  return top;
}
/* SYMETRICKÉ hranice pásů na šířce roviny [uMin,uMax]: rastr kotvený od OSY → zbytek se rozdělí
   na dvě stejné poloviny u obou krajů. Pravidlo „úzký kraj": je-li okrajový pás < ⅓ krycí šířky,
   ubere se jeden plný pás a zbytek se rozdělí do dvou širších krajních pásů. Vrací pole hranic (u). */
function plechHranice(uMin,uMax,k){
  const W=uMax-uMin;
  if(W<=k+1e-9) return [uMin,uMax];                          // jediný pás
  let nFull=Math.floor(W/k), r=W-nFull*k;
  if(r<1e-6){ const b=[]; for(let i=0;i<=nFull;i++) b.push(uMin+i*k); return b; }   // přesné dělení = samé celé
  let edge=r/2;
  if(edge < k/3 && nFull>=1){ nFull-=1; edge=(r+k)/2; }      // úzký kraj → uber pás, rozděl do dvou širších krajů
  const b=[uMin]; let x=uMin+edge; b.push(x);
  for(let i=0;i<nFull;i++){ x+=k; b.push(x); }
  b.push(uMax);                                              // poslední (krajní) pás
  return b;
}
/* OTVORY V PÁSECH (13. 9. 2026). `o.otvory` = { cisloRoviny: [ {u0,u1,v0,v1}, … ] }
   v souřadnicích roviny (u podél okapu, v po spádu od okapu). Pás, který otvor
   protíná, se rozdělí na KUSY pod otvorem a nad ním; každý kus má vlastní délku.
   Přesah k okapu dostane jen kus, který u okapu začíná; přídavek k hřebeni jen
   kus, který sahá na vrchol obrysu. Bez otvorů je výsledek stejný jako dřív —
   jeden kus na pás.
   PENTI 13. 9. 2026 na RD Kroměřížská: vikýř přes celou rovinu, a kladečák
   kreslil 37 pásů po 7,3 m napříč vikýřem, kde plech hlavní střechy není. */
function plechKusyPasu(u0,u1,topV,otvory){
  let useky=[[0,topV]];
  (otvory||[]).forEach(ot=>{
    if(ot.u1<=u0+1e-6 || ot.u0>=u1-1e-6) return;       // otvor leží mimo pás
    const a=Math.max(0,ot.v0), b=Math.min(topV,ot.v1); if(b<=a) return;
    const nove=[];
    useky.forEach(([s,e])=>{
      if(b<=s || a>=e){ nove.push([s,e]); return; }      // bez překryvu
      if(a>s) nove.push([s,a]);
      if(b<e) nove.push([b,e]);
    });
    useky=nove;
  });
  return useky.filter(([s,e])=>e-s>0.02);
}
function kladecakPlech(g,o){
  o=o||{}; const system=o.system||'falcovana';
  const kryci=(o.kryci_sire_mm||(system==='click'?510:560))/1000;
  const pOkap=(o.presah_okap_mm!=null?o.presah_okap_mm:50)/1000;
  const pHreben=(o.pridavek_hreben_mm!=null?o.pridavek_hreben_mm:50)/1000;
  const h=o.h_kryt_m||0;                                                      // plech leží na bednění+kontralatích → krytinová rovina
  const otvoryVse=o.otvory||{};
  const planes=(g.planes||[]).map(p=>{
    const kr=krytinaRovina(p,h);
    const rings=kr.rings;   // obrysy roviny natažené do krytinové roviny
    let uMin=Infinity,uMax=-Infinity; rings.forEach(r=>r.forEach(q=>{if(q[0]<uMin)uMin=q[0];if(q[0]>uMax)uMax=q[0];}));
    if(!isFinite(uMin)){uMin=0;uMax=0;}
    const W=uMax-uMin;
    if(W<=0.05) return {cislo:p.cislo, sirka_okap:0, pocet_pasu:0, spolehlivost:'přesně', delka_min:0, delka_max:0, bm:0, delky:[], sirky:[], hranice:[], tvarRings:[], kusy:[], otvory:[]};
    const approx=(p.presne===false);
    /* Otvory v téhle rovině, natažené do krytinové roviny stejně jako obrys. */
    const otvory=(otvoryVse[p.cislo]||[]).map(ot=>({u0:ot.u0,u1:ot.u1,v0:ot.v0*kr.f,v1:ot.v1*kr.f}));
    const bnds=plechHranice(uMin,uMax,kryci);     // SYMETRICKÉ hranice pásů (od osy)
    const nPasu=bnds.length-1; const delky=[], sirky=[], kusy=[];
    for(let s=0;s<nPasu;s++){ const u0=bnds[s], u1=bnds[s+1];
      // délka pásu = NEJDELŠÍ místo v jeho šířce → pás přesahuje přes nároží/úžlabí o celý trojúhelník (plech zastřižen pod pravým úhlem)
      let v=0; for(let q=0;q<=8;q++){ const u=u0+(u1-u0)*q/8; rings.forEach(r=>{const tv=plech_topV(r,u); if(tv>v)v=tv;}); }
      const useky=plechKusyPasu(u0,u1,v,otvory);
      useky.forEach(([vs,ve])=>{
        const d=(ve-vs)+(vs<1e-6?pOkap:0)+(ve>=v-1e-6?pHreben:0);
        delky.push(+d.toFixed(2)); sirky.push(+(u1-u0).toFixed(3));
        kusy.push({pas:s, u0:+u0.toFixed(3), u1:+u1.toFixed(3), v0:+vs.toFixed(3), v1:+ve.toFixed(3), delka:+d.toFixed(2)});
      });
    }
    const bm=delky.reduce((a,b)=>a+b,0);
    return {cislo:p.cislo, nazev:p.nazev||null, sirka_okap:+W.toFixed(2), pocet_pasu:delky.length, pocet_pruhu:nPasu,
      spolehlivost:approx?'přibližně':'přesně',
      delka_min:delky.length?+Math.min(...delky).toFixed(2):0, delka_max:delky.length?+Math.max(...delky).toFixed(2):0,
      bm:+bm.toFixed(1), delky, sirky, hranice:bnds, tvarRings:rings, kusy, otvory};
  });
  return {system, kryci_sire_mm:Math.round(kryci*1000), presah_okap_mm:Math.round(pOkap*1000), pridavek_hreben_mm:Math.round(pHreben*1000),
    planes, pocet_pasu_celkem:planes.reduce((s,p)=>s+p.pocet_pasu,0), bm_celkem:+planes.reduce((s,p)=>s+p.bm,0).toFixed(1)};
}

/* TYČOVÉ (trubkové) ZACHYTÁVAČE SNĚHU — návrh dle ČSN EN 1991-1-3 (sněhová oblast I–VIII) × sklon.
   DMAX_SNEH = max. vzdálenost mezi řadami [m] (Satjam, falc rozteč 310 mm); řádky = sklony, sloupce = oblast I–VIII. */
const DMAX_SNEH={ sklony:[17,18,20,25,30,35,40,45,50],
  T:[ [42.5,29.0,19.8,14.9,11.9,9.9,7.4,6.9],
      [40.5,28.3,18.9,14.1,11.3,9.4,7.0,6.5],
      [37.0,25.9,17.2,12.9,10.3,8.6,6.4,6.0],
      [31.0,21.7,14.5,10.8,8.7,7.2,5.4,5.0],
      [27.4,19.2,12.8,9.6,7.6,6.4,4.8,4.5],
      [25.3,17.7,11.8,8.8,7.0,5.9,4.4,4.1],
      [24.1,16.9,11.2,8.4,6.7,5.6,4.2,3.9],
      [23.8,16.6,11.1,8.3,6.6,5.5,4.1,3.8],
      [24.1,16.9,11.2,8.4,6.7,5.6,4.2,3.9] ] };
function dmaxZTab(tab,sklon,obl){ const S=tab.sklony; let ri=0; for(let i=0;i<S.length;i++){ if(sklon>=S[i]) ri=i; } const row=tab.T[ri]||tab.T[tab.T.length-1]; return row[Math.max(0,Math.min(7,(obl|0)-1))]||row[row.length-1]; }
function zachytavacSnehu(g,o){
  o=o||{};
  const obl=Math.max(1,Math.min(8, o.oblast||2));
  const Lt=o.delka_tyce_m||3.0;             // délka nosné tyče [m]
  const roz=o.roztec_drzaku_m||0.56;        // rozteč držáků (plech = krycí šířka / na každý falc; tašky ≤ 0,9 m)
  const Dmax=o.Dmax||DMAX_SNEH;
  let rady=0, tyce=0, drzaky=0, spojky=0, koncovky=0; const detail=[];
  (g.planes||[]).forEach(p=>{
    /* LOMENÁ STŘECHA: strmá horní část nemá okap — sníh z ní sjede na mírnou
       spodní část a zachytí ho až řada nad okapem. Horní rovina se proto
       přeskočí a její délka se přičte ke spodní (řady se počítají z celé
       délky od okapu k hřebeni). */
    if(p.lom && p.lom.cast==='horni') return;
    let Ls=p.delka_spad||0;
    if(p.lom && p.lom.cast==='dolni'){ const h=(g.planes||[]).find(q=>q.cislo===p.lom.par); if(h) Ls+=(h.delka_spad||0); }
    /* složená střecha (D2) nese skutečnou délku okapu roviny zvlášť — rovina bez vlastního okapu zábrany nemá */
    const okap=(p.okap_vlastni!=null ? p.okap_vlastni : p.sirka_okap)||0; if(okap<=0.05) return;
    const dmax=dmaxZTab(Dmax, p.sklon||30, obl);
    const R=Math.max(1, Math.ceil(Ls/dmax));          // počet řad nad sebou
    const tycRada=Math.max(1, Math.ceil(okap/Lt));    // nosníků (tyčí/mříží) na řadu
    let drzRada, spojRada, koncRada;
    if(o.drzaky_na_kus!=null){                         // MŘÍŽ (komplet): pevný počet na nosník (4 držáky, 2 spojky / 3m mříž)
      drzRada=o.drzaky_na_kus*tycRada;
      /* Spojky: mříž má pevný počet na kus. U TYČE s předepsaným počtem
         držáků na kus (Bella Sara — výrobce žádá 3 držáky na 2m tyč) se
         ale tyče spojují jen MEZI sebou a mají koncovky, stejně jako
         u falcu. Proto ty dvě volby navíc — bez nich se chová přesně
         jako dřív, takže stará kalkulačka ani web se nehnuly. */
      spojRada = o.spojky_mezi_tycemi ? Math.max(0,tycRada-1) : (o.spojky_na_kus||0)*tycRada;
      koncRada = o.koncovky_na_radu||0;
    } else {                                           // TYČ (plech): držáky na každý falc, spojky mezi tyčemi, koncovky 2/řadu
      drzRada=Math.ceil(okap/roz)+1; spojRada=Math.max(0,tycRada-1); koncRada=2;
    }
    rady+=R; tyce+=tycRada*R; drzaky+=drzRada*R; spojky+=spojRada*R; koncovky+=koncRada*R;
    detail.push({cislo:p.cislo, sklon:+(p.sklon||0).toFixed(1), okap:+okap.toFixed(2), delka_spad:+Ls.toFixed(2), dmax:+dmax.toFixed(1), rady:R, tyce:tycRada*R, drzaky:drzRada*R});
  });
  const prost=o.prostupy||0;                          // krátká řada navíc nad každým prostupem: +1 tyč + 2 držáky
  if(prost>0){ tyce+=prost; drzaky+=prost*2; }
  return {oblast:obl, delka_tyce_m:Lt, roztec_drzaku_m:roz, rady, tyce, drzaky, spojky, koncovky, prostupy:prost, planes:detail};
}

/* ==========================================================================
   KLADEČÁK TAŠEK — keramika/beton (Bramac Classic)
   Počty z ploch a délek hran (spotřeba dle příručky), vizualizace mřížky tašek.
   ========================================================================== */
/* ══════════════════════════════════════════════════════════════════════
   SCHÉMA PROTISNĚHOVÉ OCHRANY A–G
   ----------------------------------------------------------------------
   Zdroj: BMI Bramac, Technická příručka 2026, str. 71–91.

   Doslovné znění příručky:
     „Háky se umísťují od 2. řady od okapní hrany dle doporučeného
      schématu pro příslušný model tašky. V první a druhé řadě pod
      hřebenem nebo pod pultovou hranou se protisněhové háky neosazují."
     „SCHÉMA A — Na každé 8. tašce je protisněhový hák, spotřeba cca
      1,3 ks/m² A JEDNA PRŮBĚŽNÁ ŘADA."

   Z toho plyne trojí, co se do 2. 9. 2026 nedodržovalo:

   1) Schéma NENÍ jen spotřeba na m². Je to OBRAZEC: hák na každé N-té
      tašce v každé R-té řadě. Kresba to od 24. 8. 2026 nahradila
      rovnoměrným rozprostřením zadaného počtu, takže háky vycházely
      do svislých sloupců. Nahlásil PENTI 2. 9. 2026.

   2) Průběžná řada je NAVÍC k té spotřebě na m², ne její součást.
      Ověřeno zpětným výpočtem: taška Classic 300×330 mm dává
      10,1 tašek/m²; děleno osmi je 1,3 ks/m², přesně jak uvádí
      příručka u schématu A. Ta hodnota tedy pokrývá jen plochu.
      Výkaz průběžnou řadu nepočítal a nabídky háky podstřelovaly —
      na sedlové 14×9 s Classicem o 98 kusů.

   3) Krok se LIŠÍ PODLE MODELU. Classic má u schématu A každou
      8. tašku, Granát 13 každou 5. a 4. střídavě v každé 2. řadě.
      Do té doby platila jedna tabulka na všechno.
   ══════════════════════════════════════════════════════════════════════ */

/* ── OBRAZCE PODLE PŘÍRUČKY ────────────────────────────────────────────
   Přepsáno doslova z Bramac TP 2026, str. 76–91.

   `t`       = hák na každé t-té tašce
   `tStrida` = druhý krok, STŘÍDÁ SE s `t` uvnitř řady
               („na každé 5. a 4. tašce, 5, 4, 5, 4…")
   `tSude`   = jiný krok v SUDÝCH řadách
               („na každé 4. v liché a na každé 8. v sudé řadě")
   `r`       = jen v každé r-té řadě
   `ks`      = spotřeba na m² dle příručky (bez průběžné řady)

   Pozor, `ks` se mezi skupinami liší: u schématu G je to
   u velkoformátových tašek 5 ks/m², u Granátu 6 ks/m². */
const SCHEMA_TABULKY = {
  /* Classic STAR / Protector Plus / NOVO, Moravská taška Protector PLUS,
     Tegalit (všechny), Viva — v příručce tři samostatné strany se
     SHODNÝMI kroky, proto jedna tabulka. */
  velky: {
    A:{t:8,r:1,ks:1.3}, B:{t:7,r:1,ks:1.4}, C:{t:6,r:1,ks:1.8},
    D:{t:5,r:1,ks:2.0}, E:{t:2,r:2,ks:2.8}, F:{t:3,r:1,ks:3.4},
    G:{t:2,r:1,ks:5.0}
  },
  /* Granát 11, Rubín 9, Turmalín. */
  granat11: {
    A:{t:5,tStrida:4,r:2,ks:1.3}, B:{t:4,r:2,ks:1.4}, C:{t:3,r:2,ks:1.8},
    D:{t:4,tSude:8,r:1,ks:2.0},   E:{t:2,r:2,ks:2.8}, F:{t:3,r:1,ks:3.4},
    G:{t:2,r:1,ks:6.0}
  },
  /* Granát 13, Topas 13, Rubín 13.
     Pozn. příručky: u háku Rubín 13 se každý hák šroubuje do latě. */
  granat13: {
    A:{t:5,r:2,ks:1.3},           B:{t:5,tStrida:4,r:2,ks:1.4},
    C:{t:4,r:2,ks:1.8},           D:{t:3,r:2,ks:2.0},
    E:{t:4,tStrida:3,r:1,ks:2.8}, F:{t:3,r:1,ks:3.4},
    G:{t:2,r:1,ks:6.0}
  },
  /* Bramac MAX a MAX 7° mají vlastní řadu M1–M6 — o jeden stupeň
     méně než A–G (chybí stupeň 2,0 ks/m²). Přiřazuje se proto podle
     nejbližší spotřeby, viz `schemaSnih`. */
  max: {
    M1:{t:6,r:1,ks:1.3}, M2:{t:5,r:1,ks:1.4}, M3:{t:2,r:2,ks:1.8},
    M4:{t:3,r:1,ks:2.8}, M5:{t:2,r:1,ks:3.4},
    M6:{t:2,tSude:1,r:1,ks:6.0}   // v liché řadě každá 2. taška, v sudé každá
  }
};
/* Který model do které tabulky. Co tu není (Tondach, Erlus), dostane
   krok dopočítaný z rozměru tašky — viz `schemaSnih`. */
const SCHEMA_SKUPINA = {
  classic:"velky", moravska:"velky", tegalit:"velky", viva:"velky",
  granat11:"granat11", rubin9:"granat11", turmalin:"granat11",
  granat13:"granat13", topas13:"granat13", rubin13:"granat13",
  bramacmax:"max"
};

function schemaSnih(sklon,obl,model){    // schéma protisněhové ochrany (sklon × sněhová oblast) + obrazec
  obl=Math.max(1,Math.min(8,obl|0));
  const rows=[20,25,30,35,40,45,50]; let ri=0; for(let i=0;i<rows.length;i++){ if(sklon>=rows[i]) ri=i; }
  const T={20:['A','A','B','C','D','E','F','*'],25:['A','B','C','D','E','F','G','*'],30:['A','B','C','D','E','F','G','*'],
    35:['B','C','D','E','F','G','G','*'],40:['B','C','D','E','F','G','G','*'],45:['C','D','E','F','G','G','G','*'],50:['C','D','E','F','G','G','G','*']};
  let letter=T[rows[ri]][obl-1];
  if(letter==='*') letter='G';                     // 8. oblast — nejhustší schéma
  const skupina = SCHEMA_SKUPINA[model] || null;

  if(skupina){
    const tab = SCHEMA_TABULKY[skupina];
    let s = tab[letter];
    if(!s){
      /* Bramac MAX: A–G se přeloží na M1–M6 podle nejbližší spotřeby. */
      const cil = SCHEMA_TABULKY.velky[letter].ks;
      let nej=null, rozdil=1e9;
      Object.keys(tab).forEach(k=>{
        const d=Math.abs(tab[k].ks-cil); if(d<rozdil){ rozdil=d; nej=k; }
      });
      letter=nej; s=tab[nej];
    }
    return {schema:letter, hak_ks_m2:s.ks,
            krok_tasek:s.t, krok_strida:s.tStrida||null,
            krok_sude:s.tSude||null, krok_rad:s.r||1, odvozeno:false};
  }

  /* MODELY MIMO PŘÍRUČKU (Tondach — Contiton, Planoton, Sensaton,
     Renoton; Erlus). Krok se dopočítá z rozměru tašky tak, aby vyšla
     spotřeba daného schématu: tašek na m² dělíme požadovanými ks/m².
     Je to totéž pravidlo, jen odvozené — proto `odvozeno:true`, ať je
     vidět, že to není přepsané z příručky výrobce. */
  const ksm2 = SCHEMA_TABULKY.velky[letter].ks;
  const M=(model && MODELY_TASEK) ? MODELY_TASEK[model] : null;
  let krok={t:5,r:1};
  if(M && M.krycMm && M.vlo_mm){
    const tasekM2 = 1/((M.krycMm/1000)*(M.vlo_mm/1000));
    const t = Math.max(2, Math.round(tasekM2/ksm2));
    /* Krok přes osm tašek je řidší než cokoli v příručce — rozloží se
       proto do každé druhé řady, aby háky nebyly v jedné řadě daleko
       od sebe. */
    krok = (t>8) ? {t:Math.max(2,Math.round(t/2)), r:2} : {t:t, r:1};
  }
  return {schema:letter, hak_ks_m2:ksm2,
          krok_tasek:krok.t, krok_strida:null, krok_sude:null,
          krok_rad:krok.r, odvozeno:true};
}
function kladecakTasky(g,o){
  o=o||{}; const M=modelTasky(o.model);               // model tašky (Classic/Tegalit/Granát 13)
  const ks=M.krycMm/1000, obl=o.snehovaOblast||2, hKryci=o.hrebenacKryciM||0.30;  // krycí šířka = tabulková hodnota modelu (fixní)
  const hrebKsM = M.hrebenacKsM || (1/hKryci);   // spotřeba hřebenáčů na 1 bm hřebene/nároží dle modelu
  const h=o.h_kryt_m||0;                              // tašky leží na bednění+kontralatích → krytinová rovina
  const kladeni = (M.kladeniVolba && (o.kladeni==='strih'||o.kladeni==='vazba')) ? o.kladeni : M.kladeni;  // na vazbu / na střih
  let celych=0;
  const planes=(g.planes||[]).map(p=>{ const kr=krytinaRovina(p,h);
    const vmax=M.vlMax(p.sklon)/1000, Lspd=kr.delka_spad||vmax;
    /* Počet řad a rozteč ze SPOLEČNÉ funkce — aby počet tašek, laťování
       a počet krajovek mluvily o týchž řadách (24. 8. 2026). */
    const rl=radyRovinyLati(M, Lspd, p.sklon, {
      vlo:(M.vlo_mm||0)/1000, vlh:null, latProfil:o.latProfil, odvHreben:o.odvHreben,
      vloMaxM:(M.vlPO_K>0 ? (M.vlPO_K-40)/1000 : 0),
      radaNavic:!!o.radaNavic });
    /* Krycí délka, na kterou se ptá spotřeba: plochu pokrývají řady
       v poli. U okapu jsou dvě řady s vlastními odstupy, takže se bere
       průměr přes celou rovinu — kolik plochy připadá na jednu řadu. */
    /* Plochu pokrývají ŘADY TAŠEK, ne latě — okapní lať žádnou nenese. */
    const vlm = (Lspd>0 && rl.radyTasek>0) ? Lspd/rl.radyTasek : vmax;
    const ksm2=1/(ks*vlm), tc=Math.round(kr.sikma*ksm2); celych+=tc;
    /* ── KDE ŘADY OPRAVDU LEŽÍ ────────────────────────────────────────
       Kladečský plán si donedávna dělil rovinu rovnoměrně (spád / rozteč),
       zatímco řez laťování kladl latě na skutečné polohy. Na Contitonu
       se to rozešlo hned u okapu: kladečák měl první řadu po 340 mm,
       řez po 40 a 320 mm. Pokrývač si podle toho rozměřuje střechu, takže
       obojí musí ukazovat totéž.

       Taška visí na své lati a tělem sahá DOLŮ po spádu. Viditelný pruh
       řady proto končí na její vlastní lati a začíná na lati pod ní:

           řada k  =  ⟨lať k−1 , lať k⟩,   první řada od okapní hrany

       ZA POSLEDNÍ LATÍ SE UŽ ŽÁDNÁ ŘADA NEKRESLÍ. Kousek mezi ní a osou
       hřebene (u Contitonu ve 30° jen 40 mm) je pod hřebenáčem. Dokud se
       tam pruh kreslil, tvářil se jako dvaadvacátá řada a větrací tašky
       pak vypadaly, že jsou v úplně první řadě u hřebene. Nahlásil PENTI
       24. 8. 2026 na vykresleném kladečáku. */
    const vloM=(rl.vloEffM!=null)?rl.vloEffM:((M.vlo_mm||0)/1000);
    const radyV=[0];
    for(let k=0;k<rl.polnichLati;k++) radyV.push(vloM + k*rl.roztecM);
    /* Hranice musí být rostoucí a uvnitř roviny — u velmi krátkých rovin
       by se jinak překryly a kresba by dělala nesmysly. */
    /* Hranice musí být rostoucí a uvnitř roviny. Poslední se k hřebeni
       NEDOPLŇUJE — viz komentář výš, ten kus je pod hřebenáčem. */
    const radyCiste=radyV.filter((x,i,a)=> i===0 || (x>a[i-1]+1e-6 && x<=Lspd+1e-6));
    const rings=kr.rings; let okapD=0;   // délka okapu této roviny (hrana ve výšce v≈0)
    rings.forEach(r=>{for(let k=0;k<r.length;k++){const A=r[k],B=r[(k+1)%r.length]; if(A[1]<0.05&&B[1]<0.05) okapD+=Math.abs(B[0]-A[0]);}});
    /* PERGOLA (24. 9. 2026): rovina má okap ve DVOU výškách — hlavní okap
       leží ve v = d (o hloubku pergoly výš), okap pergoly ve v = 0. Hrany
       ve v ≈ d se přičtou a odečte se DVAKRÁT šířka pergoly: jednou horní
       hrana obdélníku pergoly, jednou kus původního okapu, který pergola
       zakryla — ani jedno už okap není. */
    if(p.pergola && p.pergola.delkaPoSpaduM>0){ const d=p.pergola.delkaPoSpaduM; let naD=0;
      rings.forEach(r=>{for(let k=0;k<r.length;k++){const A=r[k],B=r[(k+1)%r.length]; if(Math.abs(A[1]-d)<0.05&&Math.abs(B[1]-d)<0.05) naD+=Math.abs(B[0]-A[0]);}});
      okapD+=Math.max(0, naD-2*(p.pergola.sirkaM||0)); }
    return {cislo:p.cislo, sklon:p.sklon, sikma:+kr.sikma.toFixed(1), vl_mm:Math.round(vlm*1000), ksm2:+ksm2.toFixed(1), tasky_celych:tc, vetracky_ks:0, haky_ks:0, okap_delka:+okapD.toFixed(2), tvarRings:rings,
      sirka_okap:p.sirka_okap, baze:p.baze,
      /* Skutečné hranice řad (m od okapní hrany) — kladečský plán z nich
         kreslí, aby seděl s řezem laťování. */
      rady_v:radyCiste, pocet_rad:radyCiste.length-1}; });   // báze a šířka okapu: kladečák z nich pozná, od kterého štítu skládat (aby protilehlé roviny vyšly stejně)
  // ODVĚTRÁNÍ HŘEBENE — dva režimy:
  //  'pas'    = větrací pás hřebene + bodové větrací tašky (výchozí)
  //  'pripoj' = celá podhřebenová řada „tašek pro připojení hřebene" (jen modely s M.pripojHreben, např. Contiton)
  const odvHreben = (o.odvHreben==='pripoj' && M.pripojHreben) ? 'pripoj' : 'pas';
  let _vetrInfo={req_cm2m:0, pas_cm2m:0, max_krokev_m:0, pas_pokryl:false, prurez_ks:0, plosne_ks:0};   // detail pro posudek větrání
  if(odvHreben==='pas'){
    // VĚTRACÍ TAŠKY = max(plošné minimum dle výrobce, průřezová metoda)
    //  • PRŮŘEZ: N = (A_požadovaný − A_hřebene) / LQ tašky — hřeben(pás) je hlavní odvod, tašky doplní zbytek
    // ČSN 73 1901-2, tab. B.1: odváděcí otvory u hřebene = DÉLKA KROKVE × 10 cm²/m. Větrací pás (HPI/DIN 4108) = 145 cm²/m → pokryje krokve do ~14,5 m.
    const _maxKrokev=Math.max(0,...((g.planes||[]).map(p=>p.delka_spad||0)));     // nejdelší krokev na střeše
    const reqPerM=Math.max(50, Math.ceil(_maxKrokev*10));             // požadovaný odvod u hřebene [cm²/m] (min. 50 dle tabulky)
    const pasPerM=(o.vetrPasCm2M!=null)?o.vetrPasCm2M:145;            // účinný průřez větracího pásu hřebene [cm²/m]
    const LQ=M.vetrLQ||30;                                            // účinný větrací průřez 1 tašky [cm²]
    const delkaHN=(g.ridge||0)+(g.hip||0);
    const vetrPrurez=Math.max(0, Math.ceil((reqPerM*delkaHN - pasPerM*delkaHN)/Math.max(1,LQ)));
    //  • PLOŠNÉ MINIMUM (Bramac TP, záruka): ceil(plocha krytiny /100 × ks na 100 m²) — Classic 10, Tegalit 20, Granát 25
    const plocha=planes.reduce((s,p)=>s+p.sikma,0);
    const vetrPlosne=(M.vetrPer100)?Math.ceil(plocha/100*M.vetrPer100):0;   // DOPORUČENÍ VÝROBCE: počet větracích tašek na 100 m² (vetrPer100) jako spodní mez pro VŠECHNY tašky (ČSN průřez jen jako alternativa)
    let vetrTotal=Math.max(vetrPrurez, vetrPlosne);                      // B) nikdy pod záruční minimum ani pod průřez
    vetrTotal=Math.ceil(vetrTotal/2)*2;                                  // sudý počet (sedlová: stejně na obě roviny)
    _vetrInfo={req_cm2m:reqPerM, pas_cm2m:pasPerM, max_krokev_m:+_maxKrokev.toFixed(2), pas_pokryl:(pasPerM>=reqPerM), prurez_ks:vetrPrurez, plosne_ks:vetrPlosne};
    const totalS=plocha||1; let assigned=0;                             // rozdělit po rovinách proporčně k ploše (u valby → podél nároží)
    planes.forEach((p,i)=>{ const share=(i<planes.length-1)?Math.round(vetrTotal*p.sikma/totalS):(vetrTotal-assigned); p.vetracky_ks=Math.max(0,share); assigned+=p.vetracky_ks; });
    /* ── PEVNÝ VZOR POD HŘEBENEM (2026.11.251, PENTI 23. 11. 2026) ──────
       „Rozmístění větracích tašek by mělo být vždy symetrické a pro
       pokrývače jednoznačné — např. každá třetí taška v druhé řadě pod
       hřebenem." Dřív se počet výrobce (u 109_26 30 ks na rovinu) rozkládal
       s krokem 2,77 tašky — mezery 2 a 3 střídavě, dvojice.
       Teď: krok N = počet tašek pod hřebenem / potřeba výrobce, zaokrouhleno.
       Vzor jde po celé délce a je souměrný od středu, počet ve výkazu =
       počet ve vzoru (i když vyjde pod doporučením výrobce — PENTI: „dal
       bych každou třetí i pod minimem a doplnil výpočtem větrání").
       Požadavek NORMY (průřez) se ale nikdy nepodkročí — pak se vzor zhustí.
       Jen roviny se štítem na obou stranách; valba zůstává po staru. */
    const kLm=((M.krajovka&&M.krajovka.kryci_l_mm)||M.krycMm)/1000, kPm=((M.krajovka&&M.krajovka.kryci_p_mm)||M.krycMm)/1000;
    const bezKraj=(o.okrajTyp==='lista');
    /* Pultová střecha hřeben nemá (horní okraj), výpočet odvodu u hřebene
       by nic nedokázal — tam vzor nepoužít, zůstává rozmístění po staru. */
    if(delkaHN>0) planes.forEach(p=>{
      const sh=stitStitRovina(p.tvarRings); if(!sh || !(p.vetracky_ks>0)) return;
      const pole=sh.sirkaTop-(bezKraj?0:(kLm+kPm));
      const L=bezKraj ? Math.floor(pole/ks+1e-6) : Math.max(1, Math.round(pole/ks));
      const minNorma=Math.ceil(vetrPrurez*p.sikma/totalS);
      const v=vzorVetracek(L, p.vetracky_ks, minNorma);
      if(!v) return;
      p.vetracky_doporuceno=p.vetracky_ks;
      p.vetracky_ks=v.ks; p.vetracky_krok=v.krok; p.vetracky_L=L; p.vetracky_prvni=v.prvni;
    });
    const _tasekVz=planes.reduce((s,p)=>s+(p.vetracky_ks||0),0);
    _vetrInfo.lq_cm2=LQ; _vetrInfo.delka_hrebene_m=+delkaHN.toFixed(2);
    _vetrInfo.tasky_ks=_tasekVz;
    _vetrInfo.tasky_cm2m=delkaHN>0 ? Math.round(_tasekVz*LQ/delkaHN) : 0;
    _vetrInfo.celkem_cm2m=pasPerM+_vetrInfo.tasky_cm2m;
    _vetrInfo.vyhovuje=(_vetrInfo.celkem_cm2m>=reqPerM);
    _vetrInfo.vyrobce_na100=M.vetrPer100||0;
    _vetrInfo.na100_skutecne=plocha>0 ? +(_tasekVz/plocha*100).toFixed(1) : 0;
  } // jinak (pripoj): vetracky_ks zůstávají 0, odvod řeší podhřebenové tašky níže
  // PODHŘEBENOVÉ TAŠKY (připojení hřebene) — celá první řada pod hřebenem, oboustranně
  let podhreben=0, podhreben_l=0, podhreben_p=0;
  if(odvHreben==='pripoj'){
    const ridgeL=g.ridge||0, ksBm=M.pripojHreben.ksBm||8.8;
    if(ridgeL>0){ podhreben_l=2; podhreben_p=2;                        // sedlová: 2 levé + 2 pravé okrajové (u štítů)
      podhreben=Math.max(0, Math.ceil(ridgeL*ksBm) - podhreben_l - podhreben_p); }   // pole = celkem − okrajové
  }
  // SKUTEČNÁ krycí délka řad (ne paušálně max) — řady vyjdou na celé tašky, jako při skutečné pokládce
  /* SKUTEČNÁ ROZTEČ ŘAD, ne teoretická. Krajovek je tolik, kolik je ŘAD
     TAŠEK podél štítu — takže se musí počítat z počtu řad, který opravdu
     vyšel, ne ze vzorce „délka / max rozteč". U modelů s vlastním kótováním
     okapu (Contiton) se ta dvě čísla rozcházejí, protože okapní lať a druhá
     lať mají svoje pevné odstupy. Rozešlo by se pak i to, co ukazuje kladečák
     (24. 8. 2026). */
  const vlAvg=(planes&&planes.length)
    ? planes.reduce((s,p)=>s+(p.vl_mm>0? p.vl_mm/1000 : M.vlMax(30)/1000),0)/planes.length
    : M.vlMax(30)/1000;
  // krajové tašky podél štítu. NA STŘIH: každá řada celá krajovka. NA VAZBU: střídavě celá / poloviční (posun o půl tašky).
  // okraj střechy (štít): 'krajovky' = krajové tašky L/P, nebo 'lista' = závětrná lišta (krajovky se neberou, řada = okap/krycí šířka)
  const okrajTyp=(o.okrajTyp==='lista')?'lista':'krajovky';
  const nVerge=Math.round((g.stit||0)/vlAvg);          // počet krajových pozic přes všechny štíty
  let krajove, polovicni_stit;
  /* KRAJOVKA V KAŽDÉ ŘADĚ (PENTI 20. 10. 2026, 2026.10.195): u Tegalitu
     a Granátu 11/13 je krajní taška v KAŽDÉ řadě a vazbu srovná půltaška
     vedle ní (každá druhá řada) — kladečák to tak kreslí. Dřív se krajovka
     počítala jen do každé druhé řady (Tegalit 12 × 4,3 m: 13 + 13 místo
     26 + 26). Viva má krajní celou i 3/4 střídavě (TP 1,5 ks/m) — zůstává. */
  if(kladeni==='vazba' && M.krajovkaKazdaRada){ krajove=nVerge; polovicni_stit=Math.floor(nVerge/2); }
  else if(kladeni==='vazba'){ krajove=Math.ceil(nVerge/2); polovicni_stit=Math.floor(nVerge/2); }
  /* NA STŘIH: každá řada dostane celou krajovku a poloviční tašky se
     u štítu NEPOUŽÍVAJÍ. Zbytek na šířku se srovná mírným roztažením
     spár mezi krajovkami.
     (Do 31. 8. 2026 tu stálo, že se šířka dorovná „posuvnou taškou".
     Závěr platí, zdůvodnění ne — posuv je po DÉLCE, ne po šířce.) */
  else { krajove=nVerge; polovicni_stit=0; }
  krajove=Math.ceil(krajove/2)*2;                      // sudý celkový počet (zachováno)
  // L/P PŘESNĚ podle geometrie: poměr délek levých/pravých rakových hran (skeleton). Symetrická sedlová → L=P; nesymetrické (L/U/T…) → L≠P.
  const stitL=g.stit_L||0, stitP=g.stit_P||0, stitTot=(stitL+stitP);
  let krajove_L, krajove_P;
  if(stitTot>0.01){ krajove_L=Math.round(krajove*stitL/stitTot); krajove_P=krajove-krajove_L; }
  else { krajove_L=krajove/2; krajove_P=krajove/2; }   // záloha (chybí geometrie) → 50/50
  let zavetrna_lista_m=0;
  if(okrajTyp==='lista'){ krajove=0; krajove_L=0; krajove_P=0; polovicni_stit=0; zavetrna_lista_m=+(g.stit||0).toFixed(1); }   // místo krajovek závětrná lišta po délce štítů

  /* ══════════════════════════════════════════════════════════════════════
     KRAJOVKA ZABÍRÁ ŠÍŘKU — MUSÍ SE ODEČÍST OD ZÁKLADNÍCH TAŠEK
     ----------------------------------------------------------------------
     Základní tašky se počítají z PLOCHY roviny (plocha × ks/m²), takže
     v nich je i pruh podél štítu. Krajovky se pak přičítaly navrch a nic
     se neodečítalo — ten pruh se tedy platil dvakrát.

     Kolik odečíst: krajovka nemá vlastní řadu, jen zabere kus šířky.
     Levá pokryje `kryci_l_mm`, pravá `kryci_p_mm`; základní taška pokryje
     krycí šířku. Odečet je tedy prostý podíl:

         ubyde tašek = (krajovek_L × kryci_l + krajovek_P × kryci_p) / krycí šířka

     U Tondach Contiton 12 je krajovka levá 129 a pravá 94 mm proti krycí
     šířce 230 mm (technický list, str. 8: S = 129 + Y × SKS + 94), takže
     dvě krajovky nahradí jednu základní tašku. U modelů, kde je krajovka
     plný modul (Bramac Classic a spol.), nahradí každá krajovka přesně
     jednu základní tašku.

     Nahlásil PENTI 24. 8. 2026 na Contitonu — na řadu vycházela jedna
     taška navíc a rozměření nesedělo se šířkou střechy.
     ══════════════════════════════════════════════════════════════════════ */
  let odecet_krajovek=0;
  if(okrajTyp==='krajovky' && (krajove_L>0 || krajove_P>0)){
    const kj=M.krajovka||{};
    const kl=(kj.kryci_l_mm>0)?kj.kryci_l_mm:M.krycMm;
    const kp=(kj.kryci_p_mm>0)?kj.kryci_p_mm:M.krycMm;
    odecet_krajovek=Math.round((krajove_L*kl + krajove_P*kp)/M.krycMm);
    /* Odečet nesmí sežrat víc, než kolik tašek vůbec je — jinak by
       vyšel záporný počet a nabídka by tvrdila nesmysl. */
    odecet_krajovek=Math.min(odecet_krajovek, celych);
    celych=celych-odecet_krajovek;
    /* Rozpustit i po rovinách, ať kladečák a výkaz ukazují totéž. */
    if(odecet_krajovek>0){
      const celkemPred=planes.reduce((s,p)=>s+p.tasky_celych,0)||1;
      let rozdano=0;
      planes.forEach((p,i)=>{
        const dil=(i<planes.length-1)
          ? Math.round(odecet_krajovek*p.tasky_celych/celkemPred)
          : (odecet_krajovek-rozdano);
        p.tasky_celych=Math.max(0, p.tasky_celych-dil); rozdano+=dil;
      });
    }
  }
  /* Poloviční tašky = u vazby na štítu (výše) + při řezání v nároží/úžlabí
     (aby nezbývaly malé kousky).
     POZOR: čtyři modely poloviční tašku vůbec nemají v sortimentu — Rubín 9,
     Contiton 12, Sensaton 11 a ERLUS XXL. U nich se v nároží řeže základní
     taška, takže se do polovičních nepočítají žádné. Zůstávají celé v položce
     `rezane` (poloviční jsou jen její podmnožina), takže se nic neztratí.
     Nahlásil PENTI 19. 8. 2026. */
  const polovicni = M.maPultasku === false ? 0
    : polovicni_stit + Math.round(((g.hip||0)+(g.valley||0))/(2*vlAvg));
  const rezane=Math.round(((g.hip||0)+(g.valley||0))/vlAvg);       // řezané tašky podél nároží/úžlabí
  const hrebenace=Math.ceil(((g.ridge||0)+(g.hip||0))*hrebKsM);    // hřebenáče = (hřeben+nároží) × ks/m dle modelu
  const hrebenacove_spony=hrebenace;                               // spony hřebenáčů – 1 ks na hřebenáč
  const maxSklon=Math.max(0,...(g.planes||[]).map(p=>p.sklon));
  const sh=schemaSnih(maxSklon,obl,o.model);
  const haky_zap=(o.snehHaky===false)?false:true;   // lze vypnout (uživatel volí jen tyčový systém)
  /* HÁKY NA ROVINU = plocha dle schématu + JEDNA PRŮBĚŽNÁ ŘADA.
     Příručka Bramac: „spotřeba cca X ks/m² A JEDNA PRŮBĚŽNÁ ŘADA."
     Do 2. 9. 2026 se počítala jen ta plocha, takže v nabídce chyběla
     celá jedna řada háků nad okapem — na sedlové 14×9 s Classicem
     98 kusů. Průběžná řada je druhá od okapu, tedy tolik háků, kolik
     je v řadě tašek; krajové tašky se neosazují, proto −2. */
  planes.forEach(p=>{
    if(!haky_zap){ p.haky_ks=0; p.haky_prubezna=0; p.haky_plocha=0; return; }
    /* Tašek v řadě celkem, a bez obou krajovek — na krajovou tašku hák
       nepatří, takže průběžná řada je o dvě kratší. */
    const vSirce = Math.max(0, Math.round((p.okap_delka||0)/ks));
    const vRade  = Math.max(0, vSirce - 2);
    const R = p.pocet_rad||0;
    p.haky_prubezna = vRade;                 // průběžná řada, 2. od okapu
    /* Řady se počítají od okapu: 0 = okapní (bez háků), 1 = průběžná,
       2 až R−3 nese obrazec. Horní dvě řady pod hřebenem zůstávají
       prázdné, jak žádá příručka. */
    let plocha = 0;
    for(let j=2; j<=R-3; j++){
      if(((j-2) % sh.krok_rad) !== 0) continue;      // jen každá r-tá řada
      /* Zaokrouhluje se NAHORU a z plné šířky řady. Tenhle odhad slouží
         jako spodní mez objednávky, takže musí být spíš štědrý — kdyby
         vyšel níž, než kolik kresba doopravdy rozmístí, došly by háky
         na střeše. */
      let vR;
      if(sh.krok_strida){
        /* Střídavý krok uvnitř řady („5, 4, 5, 4…"): na dvojici háků
           připadá součet obou kroků. */
        vR = Math.ceil(vSirce*2/(sh.krok_tasek + sh.krok_strida));
      } else {
        /* Jiný krok v sudých řadách („4. v liché, 8. v sudé"). Řada
           číslo j+1 od okapu. */
        const suda = ((j+1) % 2) === 0;
        const krok = (sh.krok_sude && suda) ? sh.krok_sude : sh.krok_tasek;
        vR = Math.ceil(vSirce/krok);
      }
      plocha += vR;
    }
    /* TŘI ČÍSLA, A KAŽDÉ ODPOVÍDÁ NA JINOU OTÁZKU.
       `haky_vzor`  = kolik jich obrazec potřebuje. Počítá se ze SHORA
                      ZAOKROUHLENÉ plné šířky řady, takže vyjde o pár
                      kusů výš než kresba, která krajové tašky opravdu
                      vynechá. Na Contitonu 13×11,94 je to 164 proti
                      160 nakresleným.
                      (Do 7. 9. 2026 tu stálo, že tohle číslo kladečák
                      kreslí — nekreslí, je to jeho horní odhad.)
       `haky_ks`    = kolik se OBJEDNÁ. Příručka udává spotřebu na m²
                      plošně, bez ohledu na to, že okapní řada, dvě řady
                      pod hřebenem a krajovky se vynechávají. Její „cca"
                      hodnota je tedy o pětinu štědřejší než obrazec —
                      a to je záměr, ne chyba. Objednávka má rezervu.

       Kdyby to bylo obráceně a kreslilo se víc, než se objednává,
       došly by háky na střeše. Takhle zbydou. */
    p.haky_vzor = vRade + plocha;
    /* Objednávka nesmí být NIKDY pod obrazcem — u hustých schémat
       (Granát 13, schéma E) vycházela plošná spotřeba níž než skutečný
       rozvrh a pokrývači by háky na střeše došly. Proto se bere to
       větší z obou čísel. */
    p.haky_ks   = Math.max(Math.round(sh.hak_ks_m2*p.sikma) + vRade,
                           p.haky_vzor);
  });
  const haky=planes.reduce((s,p)=>s+p.haky_ks,0);
  const vetracky=planes.reduce((s,p)=>s+(p.vetracky_ks||0),0);          // součet po rovinách (symetricky)
  // při režimu „připojení hřebene" pás na hřebeni odpadá (řeší podhřebenové tašky) – zůstává jen na nároží
  const pasHrebenBm=(odvHreben==='pripoj')?(g.hip||0):((g.ridge||0)+(g.hip||0)); const pasBaleni=Math.ceil(pasHrebenBm/5);  // balení po 5 m
  const okapCele=planes.reduce((s,p)=>s+Math.ceil(p.okap_delka),0);     // celé metry okapu na každé okapní rovině, sečteno
  /* Má tenhle model v sortimentu poloviční tašku? Bere se z katalogu
     (pole `maPultasku`, které odpovídá ceníku). Kladečský výkres podle toho
     pozná, jestli smí u nároží vložit půltašku, nebo musí řezat.
     Není to totéž co `krajovka.pulena` — ta říká, čím se dorovnává šířka
     u ŠTÍTU. Např. Planoton 11 má půltašku v sortimentu, ale štít dorovnává
     asymetrickou krajovkou. */
  const maPultasku = (M.maPultasku !== false);
  return {krytina:M.nazev, typ:M.typ, model:o.model||'classic', kryci_sirka_mm:Math.round(ks*1000),
    /* Krycí šířka krajovek — kladečský plán z nich skládá krajní tašky,
       aby v řadě vyšel stejný počet jako ve výkazu. */
    krajovka_l_mm:((M.krajovka&&M.krajovka.kryci_l_mm)||M.krycMm),
    krajovka_p_mm:((M.krajovka&&M.krajovka.kryci_p_mm)||M.krycMm),
    snehova_oblast:obl, kladeni:(kladeni==='vazba'?'na vazbu':'na střih'), hrebenac_kryci_m:hKryci, ma_pultasku:maPultasku, planes,
    souhrn:{ tasky_celych:celych, polovicni, krajove, krajove_L, krajove_P, rezane,
      okraj_typ:okrajTyp, zavetrna_lista_m:zavetrna_lista_m,
      hrebenace_ks:hrebenace, hrebenace_spony:hrebenacove_spony,
      uzavery_hrebene:g.uzavery_hrebene||0, narozni_zacatecni:g.narozni_zacatecni||0,
      rozdelovaci_ty:g.rozdelovaci_ty||0, vrcholovy:g.vrcholovy||0,
      rozdelovaci_y:g.rozdelovaci_y||0, rozdelovaci_t:g.rozdelovaci_t||0,
      rozdelovaci_x:g.rozdelovaci_x||0, rozdelovaci_xs:g.rozdelovaci_xs||0,
      hrebenace_koncove:g.hreben_koncovych||0, hrebenace_rozdelovaci:g.hreben_rozdelovaci||0,
      // Tondach: hřebenáč má 2 různá ukončení (vrchní/spodní) — na každý hřeben 1 vrchní + 1 spodní. Nárožní začáteční drží u vrchního.
      hrebenace_koncove_vrchni:Math.ceil((g.uzavery_hrebene||0)/2)+(g.narozni_zacatecni||0),
      hrebenace_koncove_spodni:Math.floor((g.uzavery_hrebene||0)/2),
      vetraci_tasky_ks:vetracky,
      vetrani:_vetrInfo,                                               // detail dle ČSN 73 1901-2 tab. B.1 (požadavek = krokev×10, pás 145 cm²/m)
      odv_hreben:odvHreben,                                            // 'pas' | 'pripoj'
      podhrebenova_ks:podhreben, podhrebenova_okraj_l:podhreben_l, podhrebenova_okraj_p:podhreben_p,
      vetraci_pas_hreben:{bm:+pasHrebenBm.toFixed(1), baleni:pasBaleni, delka_m:pasBaleni*5},   // balení po 5 m
      vetraci_mrizky_ks:okapCele,                                       // okapní větrací mřížka 1 ks = 1 m
      vetraci_pas_okap_m:okapCele,                                      // okapní větrací pás (šířka 80 mm), celé metry
      /* Obrazec putuje se schématem, aby kladečák kreslil přesně to,
         co se objednává — a nemusel si vymýšlet vlastní rozvrh. */
      snehove_haky:{schema:sh.schema, ks_m2:sh.hak_ks_m2, ks:haky,
                    krok_tasek:sh.krok_tasek, krok_strida:sh.krok_strida,
                    krok_sude:sh.krok_sude, krok_rad:sh.krok_rad,
                    odvozeno:sh.odvozeno} } };
}

/* Rovina se štítem na obou stranách? (levý i pravý okraj svislý: u okapu
   i u hřebene začíná na stejném místě). Vrací šířku horní hrany, jinak null. */
function stitStitRovina(rings){
  if(!rings || !rings.length) return null;
  const pts=[].concat(...rings); if(pts.length<4) return null;
  const maxV=Math.max(...pts.map(q=>q[1])), minU=Math.min(...pts.map(q=>q[0])), maxU=Math.max(...pts.map(q=>q[0]));
  const naU=(u)=>pts.filter(q=>Math.abs(q[0]-u)<0.005).map(q=>q[1]);
  const vl=naU(minU), vp=naU(maxU);
  const ok=(vs)=>vs.length>=2 && Math.min(...vs)<0.02 && Math.max(...vs)>maxV-0.02;
  if(!ok(vl) || !ok(vp)) return null;
  return { sirkaTop:maxU-minU };
}
/* Pevný souměrný vzor větracích tašek v řadě o L taškách.
   Krok = L / potřeba zaokrouhleno (aspoň 2), vzor přes celou řadu.
   Souměrnost: před první a za poslední taškou zbývá stejně tašek.
   Požadavek normy `min` se nepodkročí — pak se krok zmenšuje. */
function vzorVetracek(L, potreba, min){
  if(!(L>0) || !(potreba>0)) return null;
  const k0=Math.max(2, Math.round(L/potreba));
  const kroky=[k0]; for(let d=1; d<=k0; d++){ if(k0-d>=1) kroky.push(k0-d); kroky.push(k0+d); }
  for(const k of kroky){
    let n=Math.floor((L-1)/k)+1;
    while(n>0 && ((L-(k*(n-1)+1))%2)) n--;
    if(n>0 && n>=(min||0)) return { krok:k, ks:n, prvni:(L-(k*(n-1)+1))/2+1 };   // prvni = pořadí 1. větračky od štítu (bez krajovky)
  }
  return null;
}

/* ==========================================================================
   LATĚ (metoda PENTI) — latě + kontralatě + hřebenová/nárožní lať, řezané PO KUSECH
   Vstup: geom (jehož roviny mají pocet_rad_lati, kontralate_pocet a late_rows
          z materialBramacClassic), opt={delka_late_m:4, reuse_min_m:1.3}

   METODA "řezání po řadách" (odpovídá realitě na stavbě):
     - Každá řada latí má svou skutečnou délku (late_rows – šířka roviny v dané řadě).
       Latě jsou 4 m; řada 11 m = 3 latě (12 m), 1 m odřezek. Odřezek se použije na
       ZAČÁTEK další řady, jen když je ≥ reuse_min (1,3 m) – jinak je to zmar.
       Tím prořez vzniká z reálného řezání, ne z paušálních %.
     - KONTRALATĚ: délka krokve × počet krokví, řezané stejnou metodou, dle profilu.
       + dvojité kontralatě podél úžlabí (2× délka úžlabí).
     - HŘEBENOVÁ + NÁROŽNÍ lať: délka hřebene i nároží (dřív chyběla nárožní).
   ========================================================================== */
function latovaniPENTI(geom, opt){
  opt=opt||{};
  const delkaLat=opt.delka_late_m||4, delka45=5;      // 45×95 má skladovou délku 5 m
  const reuseMin=opt.reuse_min_m||1.3;                // odřezek < 1,3 m se nevyužije (ani na kontralať)
  const planes=geom.planes||[];

  // Kolik kusů latí (dané skladové délky) na sadu řad, s využitím odřezku ≥ reuseMin.
  function ksProRady(delky, stock){
    let carry=0, ks=0;
    delky.forEach(function(L){
      if(!(L>0.001)) return;
      let rem=L;
      if(carry>=reuseMin){ const u=Math.min(carry,rem); rem-=u; carry-=u; }  // nastav odřezkem z minula
      while(rem>0.001){ ks++; const piece=Math.min(stock,rem); rem-=piece; carry=stock-piece; }
      if(carry<reuseMin) carry=0;                     // krátký zbytek = zmar (nepřenáší se dál)
    });
    return ks;
  }

  // VODOROVNÉ LATĚ — po jednotlivých řadách na skutečných šířkách (late_rows).
  // Fallback (kdyby late_rows chyběly): obdélníková náhrada okap × počet řad.
  let horizRady=[];
  planes.forEach(function(p){
    if(p.late_rows && p.late_rows.length){ p.late_rows.forEach(function(w){ if(w>0.01) horizRady.push(w); }); }
    else { const n=p.pocet_rad_lati||Math.max(1,Math.round((p.delka_spad||0)/0.315)); for(let i=0;i<n;i++) horizRady.push(p.sirka_okap||0); }
  });
  const late_ks=ksProRady(horizRady, delkaLat);

  // KONTRALATĚ — každá kontralať = délka krokve; tříděno dle profilu (40/60, 60/60, 45/95).
  let k40=[], k60=[], k45=[];
  planes.forEach(function(p){
    const n=p.kontralate_pocet||0, L=p.delka_spad||0, prof=p.kontralate_profil||'40/60';
    const arr=(prof==='60/60')?k60:(prof==='45/95')?k45:k40;
    for(let i=0;i<n;i++) arr.push(L);
  });
  // + DVOJITÉ kontralatě podél úžlabí (na obou stranách úžlabí), profil 40/60
  const uzlabi=(geom.valley||0);
  if(uzlabi>0.01){ k40.push(uzlabi); k40.push(uzlabi); }
  const kontra40_ks=ksProRady(k40, delkaLat);
  const kontra60_ks=ksProRady(k60, delkaLat);
  const kontra45_ks=ksProRady(k45, delka45);

  // HŘEBENOVÁ + NÁROŽNÍ lať (na držácích pod hřebenáčem/nárožníkem) — 4m, řezané po segmentech.
  const hreben_ks=ksProRady([ (geom.ridge||0), (geom.hip||0) ], delkaLat);

  // souhrnná pole (kvůli kompatibilitě se starým výpočtem)
  const kontra_bm=+((k40.reduce((s,x)=>s+x,0))+(k60.reduce((s,x)=>s+x,0))+(k45.reduce((s,x)=>s+x,0))).toFixed(1);
  const kontra_ks=kontra40_ks+kontra60_ks+kontra45_ks;
  return {
    late_vodorovne_ks:late_ks,
    kontralate_bm:kontra_bm, kontralate_ks:kontra_ks,
    hrebenova_lat_ks:hreben_ks,
    // kontralatě rozdělené dle profilu
    kontra40_ks:kontra40_ks, kontra60_ks:kontra60_ks, kontra45_ks:kontra45_ks,
    // "Dodávka latí 60x40x4000" = vodorovné latě + hřebenová/nárožní lať + kontralatě profilu 40/60 (stejný průřez)
    latovani_60x40_ks: late_ks + hreben_ks + kontra40_ks,
    celkem_ks:late_ks+kontra_ks+hreben_ks
  };
}

/* ===== F-K2: obecný 2D rámový řešič (přímá tuhost) — jednotky kN, m ===== */
function solveFrame2D(nodes, elems, fixed, loads){
  const nN=nodes.length, nD=nN*3;
  const K=Array.from({length:nD},()=>new Float64Array(nD));
  const F=new Float64Array(nD); const elemKG=[];
  for(const e of elems){
    const a1=nodes[e.a], a2=nodes[e.b];
    const dx=a2[0]-a1[0], dy=a2[1]-a1[1], L=Math.hypot(dx,dy), c=dx/L, s=dy/L;
    const a=e.EA/L, b=12*e.EI/(L*L*L), d=6*e.EI/(L*L), f=4*e.EI/L, g=2*e.EI/L;
    const kl=[[a,0,0,-a,0,0],[0,b,d,0,-b,d],[0,d,f,0,-d,g],[-a,0,0,a,0,0],[0,-b,-d,0,b,-d],[0,d,g,0,-d,f]];
    const T=[[c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],[0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]];
    const klT=Array.from({length:6},(_,i)=>{const r=new Float64Array(6);for(let j=0;j<6;j++){let v=0;for(let k=0;k<6;k++)v+=kl[i][k]*T[k][j];r[j]=v;}return r;});
    const kg=Array.from({length:6},(_,i)=>{const r=new Float64Array(6);for(let j=0;j<6;j++){let v=0;for(let k=0;k<6;k++)v+=T[k][i]*klT[k][j];r[j]=v;}return r;});
    const dofs=[e.a*3,e.a*3+1,e.a*3+2,e.b*3,e.b*3+1,e.b*3+2];
    for(let i=0;i<6;i++)for(let j=0;j<6;j++)K[dofs[i]][dofs[j]]+=kg[i][j];
    elemKG.push({kl,T,dofs});
  }
  for(const k in loads) F[+k]+=loads[k];
  const free=[], isFixed=new Set(fixed);
  for(let i=0;i<nD;i++) if(!isFixed.has(i)) free.push(i);
  const n=free.length, A=Array.from({length:n},()=>new Float64Array(n)), bb=new Float64Array(n);
  for(let i=0;i<n;i++){ bb[i]=F[free[i]]; for(let j=0;j<n;j++) A[i][j]=K[free[i]][free[j]]; }
  for(let i=0;i<n;i++){ let p=i; for(let r=i+1;r<n;r++) if(Math.abs(A[r][i])>Math.abs(A[p][i]))p=r;
    const tr=A[i];A[i]=A[p];A[p]=tr; const t=bb[i];bb[i]=bb[p];bb[p]=t;
    const piv=A[i][i]; for(let r=0;r<n;r++){ if(r===i)continue; const mm=A[r][i]/piv; for(let j=i;j<n;j++)A[r][j]-=mm*A[i][j]; bb[r]-=mm*bb[i]; } }
  const u=new Float64Array(nD); for(let i=0;i<n;i++) u[free[i]]=bb[i]/A[i][i];
  const R=new Float64Array(nD); for(let i=0;i<nD;i++){ let v=0; for(let j=0;j<nD;j++) v+=K[i][j]*u[j]; R[i]=v-F[i]; }
  const forces=elemKG.map(function(em){ const ug=em.dofs.map(d=>u[d]); const ul=em.T.map(row=>row.reduce((x,v,k)=>x+v*ug[k],0)); return em.kl.map(row=>row.reduce((x,v,k)=>x+v*ul[k],0)); });
  return {u,R,forces};
}
/* ==========================================================================
   TAH NEBO TLAK — jediné místo, které zná znaménko
   --------------------------------------------------------------------------
   Řešič vrací osovou sílu prutu se znaménkem. Ověřeno na jednom prutu:
   když ho natáhnu silou 10 kN, vrátí −10; když ho stlačím, vrátí +10.
   ZÁPORNÉ ČÍSLO TEDY ZNAMENÁ TAH.

   Je to snadné splést a splést se v tom je nebezpečné: tlačený prut se musí
   posoudit na vzpěr (může se vybočit), tažený ne. Proto se znaménko čte jen
   tady a ven jde hotová odpověď — velikost síly a příznak „je to tah".
   ========================================================================== */
function osovaSila(F){
  return { N: Math.abs(F), tah: F < 0, tlak: F >= 0,
           popis: (F < 0 ? "tah" : "tlak") };
}

/* Poloviční model HAMBALKOVÉHO krovu (symetrie): krokev A→C→R + hambalek C→osa.
   Vrací rozpěr H, svislou reakci V, max. ohyb krokve, osové síly, geometrii. */
function collarRoof(o){
  const L=o.L, alpha=o.alpha*Math.PI/180, k=o.k, wh=o.wh;
  const Hr=(L/2)*Math.tan(alpha), xC=k*(L/2), yC=k*Hr;
  const segs=4, nodes=[];
  function addLine(x0,y0,x1,y1,n,inc){ for(let i=(inc?0:1);i<=n;i++){const t=i/n; nodes.push([x0+(x1-x0)*t, y0+(y1-y0)*t]);} }
  addLine(0,0,xC,yC,segs,true); const iC=nodes.length-1;
  addLine(xC,yC,L/2,Hr,segs,false); const iR=nodes.length-1, iA=0;
  nodes.push([L/2,yC]); const iM=nodes.length-1;
  const elems=[]; for(let i=0;i<2*segs;i++) elems.push({a:i,b:i+1,EA:o.EAr,EI:o.EIr});
  const collarElem=elems.length; elems.push({a:iC,b:iM,EA:o.EAc,EI:o.EIc});
  const fixed=[iA*3, iA*3+1, iR*3, iM*3], loads={};
  for(let i=0;i<=2*segs;i++){ const xi=nodes[i][0], xp=i>0?nodes[i-1][0]:xi, xn=i<2*segs?nodes[i+1][0]:xi;
    const trib=(xi-xp)/2+(xn-xi)/2; loads[i*3+1]=(loads[i*3+1]||0)-wh*trib; }
  const r=solveFrame2D(nodes,elems,fixed,loads);
  let Mmax=0,Nraf=0; for(let i=0;i<2*segs;i++){ Mmax=Math.max(Mmax,Math.abs(r.forces[i][2]),Math.abs(r.forces[i][5])); Nraf=Math.max(Nraf,Math.abs(r.forces[i][0])); }
  /* Hambálek bývá tlačený, ale při sání větru se může obrátit do tahu —
     proto se znaménko nezahazuje, ale předá se dál. */
  var hamb = osovaSila(r.forces[collarElem][0]);
  return {H:Math.abs(r.R[iA*3]), V:r.R[iA*3+1], Mmax, Nraf, Ncollar:hamb.N,
          hambalek:hamb,
          Hr, totalV:wh*L/2, Lcollar:L*(1-k), LrafSeg:xC/Math.cos(alpha)};
}

/* ==========================================================================
   VĚŠADLO — JEDNODUCHÉ (jeden sloupek)
   --------------------------------------------------------------------------
   K ČEMU JE: překlene velký prostor bez sloupů uprostřed a do zdí přitom
   pošle jen svislou reakci — nerozpírá je. Proto se dělá nad sály, stodolami
   a všude, kde uprostřed nesmí být podpora.

   JAK FUNGUJE (a proč to tak je):
     – vazný trám leží na obou zdech a je TAŽENÝ,
     – od jeho středu jde nahoru SLOUPEK, který je TAŽENÝ — trám na něm visí,
       proto se tomu říká věšadlo,
     – od vrcholu sloupku jdou dolů na konce trámu nad zdmi dvě VZPĚRY,
       ty jsou TLAČENÉ a nesou celou tíhu do zdí.
   Vzpěry musí dosáhnout až nad zeď. Kdyby se zapřely doprostřed trámu,
   trám by je nesl v ohybu a celá vazba by ztratila smysl.

   CO VAZBU ZATĚŽUJE: vazby stojí po několika metrech od sebe a krokve na
   nich neleží přímo — leží na vaznicích. Krokev je prostý nosník mezi
   okapovou a vrcholovou vaznicí, takže:
     – polovina tíhy střechy jde do okapových vaznic, ty leží nad zdí
       a jdou rovnou do zdiva — vazbu vůbec nezatíží,
     – druhá polovina jde do vrcholové vaznice, a ta leží na vrcholu
       sloupku. Tam se tedy zatížení do vazby zavěsí.
   Strop zavěšený na trámu se přidá jako spojité zatížení po trámu.

   Krokve proto NEJSOU součástí této vazby a posuzují se zvlášť jako nosník.
   ========================================================================== */
/* GEOMETRIE VĚŠADLA — jedno místo, odkud si berou body VÝPOČET I VÝKRES.
   Dokud oba čtou odsud, nemůže se stát, že výkres ukazuje něco jiného, než
   co se počítá. Souřadnice jsou v metrech od levého konce vazného trámu,
   nula je horní hrana trámu.
     A = levý konec trámu nad zdí      B = pravý konec
     D = střed trámu, pata sloupku     C = vrchol sloupku
   Vzpěry vedou z C na A a na B — tedy až nad zeď, ne doprostřed trámu. */
function vesadloGeometrie(L, H){
  if(!(L>0) || !(H>0)) return null;
  return {
    L:L, H:H,
    A:[0,0], D:[L/2,0], B:[L,0], C:[L/2,H],
    delkaVzpery: Math.hypot(L/2, H),
    sklonVzpery: Math.atan(H/(L/2))*180/Math.PI,
    delkaSloupku: H
  };
}

function veshadloRef(o){
  var L=o.L, H=o.H, EAt=o.EAt, EIt=o.EIt, EA=o.EA, EI=o.EI;
  var W=o.W||0, wc=o.wc||0;
  /* Kolik z tíhy střechy dosedne na vrcholovou vaznici. Krokev je prostý
     nosník mezi dvěma vaznicemi, takže polovina — dá se ale přepsat. */
  var podilVrchol = (o.podilVrchol!=null) ? o.podilVrchol : 0.5;
  if(!(L>0) || !(H>0)) return null;

  /* Vazný trám se dělí na úseky, aby z něj vyšel poctivý průběh ohybu
     od stropu. Osm úseků stačí, střed vychází přesně na sloupek. */
  var G=vesadloGeometrie(L,H);
  var USEKU=8, N=[], el=[];
  for(var i=0;i<=USEKU;i++) N.push([L*i/USEKU, 0]);
  var A=0, D=USEKU/2, B=USEKU;
  N.push([G.C[0], G.C[1]]); var C=N.length-1;

  for(var i=0;i<USEKU;i++) el.push({a:i, b:i+1, EA:EAt, EI:EIt});   // trám 0..7
  var iSloupek=el.length; el.push({a:D, b:C, EA:EA, EI:EI});         // sloupek (tah)
  var iVzpera =el.length; el.push({a:A, b:C, EA:EA, EI:EI});         // levá vzpěra
                          el.push({a:C, b:B, EA:EA, EI:EI});         // pravá vzpěra

  /* Podpory: vlevo pevně, vpravo posuvně → do zdí jde jen svislá reakce
     a vodorovný rozpěr vyjde nula. Přesně to se od věšadla čeká. */
  var fixed=[A*3, A*3+1, B*3+1], loads={};
  var pridej=function(uzel, sila){ loads[uzel*3+1]=(loads[uzel*3+1]||0) - sila; };

  pridej(C, W*podilVrchol);                       // vrcholová vaznice na sloupku
  pridej(A, W*(1-podilVrchol)/2);                 // okapové vaznice — rovnou do zdí
  pridej(B, W*(1-podilVrchol)/2);
  if(wc>0) for(var i=0;i<=USEKU;i++){             // strop zavěšený na trámu
    var sirka = (i===0||i===USEKU) ? (L/USEKU)/2 : (L/USEKU);
    pridej(i, wc*sirka);
  }

  var r=solveFrame2D(N, el, fixed, loads);

  /* Z trámu se bere největší osová síla a největší ohyb. */
  var Ttie=0, Ftie=0, Mtie=0;
  for(var i=0;i<USEKU;i++){
    if(Math.abs(r.forces[i][0])>Ttie){ Ttie=Math.abs(r.forces[i][0]); Ftie=r.forces[i][0]; }
    Mtie=Math.max(Mtie, Math.abs(r.forces[i][2]), Math.abs(r.forces[i][5]));
  }
  var Fsloupek=r.forces[iSloupek][0], Fvzpera=r.forces[iVzpera][0];
  var oTram=osovaSila(Ftie), oSloupek=osovaSila(Fsloupek), oVzpera=osovaSila(Fvzpera);

  return {
    Ha: Math.abs(r.R[A*3]),          // vodorovný rozpěr do zdi — má vyjít ~0
    V:  Math.abs(r.R[A*3+1]),        // svislá reakce na zeď
    Ttie: oTram.N, Mtie: Mtie,
    Npost: Fsloupek, Nbrace: oVzpera.N,
    tram: oTram, sloupek: oSloupek, rozpera: oVzpera,
    Lpost: G.delkaSloupku,                        // délka sloupku
    Lbrace: G.delkaVzpery,                        // délka vzpěry
    braceDeg: G.sklonVzpery,                      // sklon vzpěry
    /* geometrie pro výkres — kreslí se z týchž čísel, ze kterých se počítá */
    geo: G, podilVrchol: podilVrchol
  };
}

global.PentiEngine={
  solveFrame2D, osovaSila, collarRoof, veshadloRef, vesadloGeometrie,
  geometrieStrechy, cenaVazniku, materialBramacClassic, materialZaklop, kladecakPlech, kladecakTasky, zachytavacSnehu,
  /* Schéma háků ven, aby si ho mohla vzít kresba i testy — jinak by
     každé místo počítalo obrazec po svém a rozešly by se. */
  schemaSnih,
  MODELY_TASEK, modelTasky, latovaniPENTI, olhModelu, radyRovinyLati,
  /* Plech a členění podle tvaru — čte je profi rozpočet i web. */
  MODELY_PLECH, jePlech, modelKrytiny,
  podkladKrytiny, vrstvyBedneni, duvodyProBedneni,
  TVARY_KRYTIN, MATERIALY_KRYTIN, TVAR_MODELU, tvarModelu,
  // pomocné (UI je potřebuje pro výpočet čísel ploch v rozšířeném zadání)
  buildPoly, ensureCCW, gableEdgesForPoly,
  /* Popisky tvarů — texty do rozhraní, žádné sazby.
     `konstanty` (cenové koeficienty) doplní penti-cenik-vazniky.js, pokud
     je načtený. Na veřejném webu záměrně načtený není. */
  POPISKY_STRECHY, POPISKY_PUDORYSU
};
})(typeof window!=='undefined'?window:globalThis);
