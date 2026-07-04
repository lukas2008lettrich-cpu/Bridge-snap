let cleanup=null;

export function initGame(){
  if(cleanup)cleanup();

const $=id=>document.getElementById(id);
const board=$('board'),flash=$('flash');
let ovl=$('ovl');

/* ---------- settings state ---------- */
const S={diff:'normal',len:14,lan:4,chg:3,daily:false};
const LS_KEY='bridgeSnap.v1';
function loadSave(){
  try{const d=JSON.parse(localStorage.getItem(LS_KEY));return d&&typeof d==='object'?d:{};}catch(e){return{};}
}
function persist(){
  try{
    localStorage.setItem(LS_KEY,JSON.stringify({
      streaks,daily:dailyMap,settings:S
    }));
  }catch(e){}
}
const SAVE=loadSave();
const WR={easy:'12%',normal:'48%',hard:'79%',insane:'94%'};
document.querySelectorAll('.opts').forEach(g=>{
  g.addEventListener('click',e=>{
    const b=e.target.closest('.opt');if(!b)return;
    g.querySelectorAll('.opt').forEach(o=>o.classList.remove('sel'));
    b.classList.add('sel');
    const k=g.dataset.key;S[k]=isNaN(+b.dataset.v)?b.dataset.v:+b.dataset.v;
    if(k==='diff'){$('rustyWr').textContent=WR[S.diff];updateStreakChip();}
    persist();
  });
});
$('dailyTgl').addEventListener('click',()=>{S.daily=!S.daily;$('dailyTgl').classList.toggle('on',S.daily);syncDailyBest();updateDailyNote();persist();});
function todayKey(){const d=new Date();return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();}
let dailyBest=null;
function syncDailyBest(){const v=dailyMap[todayKey()];dailyBest=(typeof v==='number')?v:null;}
function updateDailyNote(){
  $('dailyNote').textContent=S.daily
    ?(dailyBest?('Bridge #'+todayKey()+' · your best: '+dailyBest.toFixed(1)+'s'):('Bridge #'+todayKey()+' · no clear yet'))
    :'Same layout for everyone today';
}

/* ---------- streaks & escalation ---------- */
const streaks=Object.assign({easy:0,normal:0,hard:0,insane:0},SAVE.streaks||{});
const dailyMap=Object.assign({},SAVE.daily||{});
function updateStreakChip(){
  const st=streaks[S.diff],chip=$('streakChip');
  if(st>0){chip.style.display='inline-block';chip.textContent='🔥 '+st+' win streak vs Rusty ('+S.diff+') — he\'s getting faster';}
  else chip.style.display='none';
}

/* ---------- seeded rng ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}

/* ---------- audio ---------- */
let AC=null;
function beep(f,d,ty,v){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();o.type=ty||'square';o.frequency.value=f;g.gain.value=v||.035;o.connect(g);g.connect(AC.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+d);o.stop(AC.currentTime+d);}catch(e){}}

/* ---------- game state ---------- */
/* plank: 0 gone · 1 cracking · 2 solid · 3 rotten · 4 iron */
const CFG={
  easy:  {iv:900,snap:.06,rand:.35,feint:0,   hangSurv:.30},
  normal:{iv:640,snap:.16,rand:.12,feint:0,   hangSurv:.55},
  hard:  {iv:450,snap:.30,rand:.05,feint:.12, hangSurv:.78},
  insane:{iv:360,snap:.42,rand:.02,feint:.18, hangSurv:.90}
};
const SNAPCD=1600,PAD=14,GX=8,GY=6,CH=28;
let R,C,CW,BW,plank,cells,pickups,pl,bt,pS,bS,cfg,running=false,gen=0,
    snapMode=false,cdUntil=0,t0=0,tIv=null,bIv=null,broken=0,got=0,
    hangSurvived=false,botFrozenUntil=0,botSlowUntil=0,slowSkip=false,
    pDiv,bDiv,bubble,hang=null;

const TAUNT_SNAP=["Oops. Watch your step.","That plank? Mine.","Nothing personal.","Shortcut? Denied."];
const TAUNT_HANG=["Hanging around?","Let go already.","This is my favorite part."];
const TAUNT_SURV=["Close one. Not close enough.","Nice try.","I don't fall. I decide."];

function fig(col){return '<svg width="24" height="32" viewBox="0 0 24 32" aria-hidden="true"><circle cx="12" cy="5.5" r="4.4" fill="'+col+'"/><line x1="12" y1="11" x2="12" y2="20" stroke="'+col+'" stroke-width="2.8" stroke-linecap="round"/><line x1="12" y1="14" x2="4.5" y2="18" stroke="'+col+'" stroke-width="2.5" stroke-linecap="round"/><line x1="12" y1="14" x2="19.5" y2="18" stroke="'+col+'" stroke-width="2.5" stroke-linecap="round"/><line x1="12" y1="20" x2="6.5" y2="29" stroke="'+col+'" stroke-width="2.5" stroke-linecap="round"/><line x1="12" y1="20" x2="17.5" y2="29" stroke="'+col+'" stroke-width="2.5" stroke-linecap="round"/></svg>';}

function xy(r,c){return[PAD+c*(CW+GX),PAD+r*(CH+GY)];}
function inb(r,c){return r>=0&&r<R&&c>=0&&c<C;}
function occ(r,c){return (pl&&pl.r===r&&pl.c===c)||(bt&&bt.r===r&&bt.c===c);}
function standable(r,c){return plank[r][c]>=1;}
function snappable(r,c){const v=plank[r][c];return (v===2||v===3)&&!occ(r,c);}

function pMoves(){
  if(hang)return[];
  const m=[[pl.r-1,pl.c],[pl.r-1,pl.c-1],[pl.r-1,pl.c+1],[pl.r,pl.c-1],[pl.r,pl.c+1]]
    .filter(x=>inb(x[0],x[1])&&standable(x[0],x[1])&&!(bt.r===x[0]&&bt.c===x[1]));
  if(inb(pl.r-2,pl.c)&&plank[pl.r-1][pl.c]===0&&standable(pl.r-2,pl.c)&&!(bt.r===pl.r-2&&bt.c===pl.c))m.push([pl.r-2,pl.c]);
  return m;
}

function paint(r,c){
  const el=cells[r][c],v=plank[r][c];
  el.className='plank '+(v===2?'p-solid':v===3?'p-rot':v===4?'p-iron':v===1?'p-crack':'gone');
}
function hl(){
  for(let r=0;r<R;r++)for(let c=0;c<C;c++)cells[r][c].classList.remove('hl-move','hl-snap');
  if(!running||hang)return;
  if(snapMode){for(let r=0;r<R;r++)for(let c=0;c<C;c++)if(snappable(r,c))cells[r][c].classList.add('hl-snap');}
  else pMoves().forEach(m=>cells[m[0]][m[1]].classList.add('hl-move'));
}
function hud(){
  $('pS').textContent=pS;$('bS').textContent=bS;
  const sb=$('snapBtn'),cd=cdUntil-Date.now();
  sb.classList.toggle('armed',snapMode);
  sb.classList.toggle('cd',cd>0||pS<1);
  sb.textContent=cd>0?('⚡ SNAP IN '+(cd/1000).toFixed(1)+'s'):(snapMode?'⚡ PICK A PLANK':'⚡ SNAP MODE');
}
function place(d,r,c){const p=xy(r,c);d.style.left=(p[0]+CW/2-12)+'px';d.style.top=(p[1]+CH/2-17)+'px';}
function tag(r,c,txt,col){
  const p=xy(r,c),e=document.createElement('div');
  e.className='effect-tag';e.textContent=txt;e.style.left=(p[0]+4)+'px';e.style.top=(p[1]-6)+'px';e.style.color=col;
  board.appendChild(e);setTimeout(()=>e.remove(),1000);
}
function say(lines){
  const t=lines[Math.floor(Math.random()*lines.length)];
  const p=xy(bt.r,bt.c);
  bubble.textContent=t;
  bubble.style.left=Math.min(BW-160,Math.max(6,p[0]-20))+'px';
  bubble.style.top=Math.max(4,p[1]-42)+'px';
  bubble.classList.add('show');
  clearTimeout(bubble._t);bubble._t=setTimeout(()=>bubble.classList.remove('show'),1500);
}
function slowmo(ms){
  flash.classList.add('on');botFrozenUntil=Date.now()+ms;
  setTimeout(()=>flash.classList.remove('on'),ms);
}

/* ---------- plank lifecycle ---------- */
function crack(r,c){
  const v=plank[r][c];if(v!==2&&v!==3&&v!==4)return;
  plank[r][c]=1;paint(r,c);
  const g=gen,delay=v===4?2200:900;
  setTimeout(()=>{
    if(g!==gen||plank[r][c]!==1)return;
    plank[r][c]=0;broken++;paint(r,c);
    onGone(r,c);hl();
  },delay);
}
function snap(r,c){
  plank[r][c]=0;broken++;
  beep(110,.18,'sawtooth',.06);
  const el=cells[r][c];el.classList.add('flash');
  const g=gen;setTimeout(()=>{if(g!==gen)return;el.classList.remove('flash');paint(r,c);},150);
  onGone(r,c);hl();
}
function onGone(r,c){
  if(!running)return;
  if(pl.r===r&&pl.c===c)startHang('pl');
  else if(bt.r===r&&bt.c===c)startHang('bt');
}
function rotStep(who,r,c){
  const g=gen;
  setTimeout(()=>{
    if(g!==gen||plank[r][c]!==3)return;
    plank[r][c]=0;broken++;paint(r,c);
    tag(r,c,'rotten!','#9AA86C');beep(150,.12,'sawtooth',.05);
    onGone(r,c);hl();
  },420);
}

/* ---------- edge grab / near miss ---------- */
function rescueCells(who){
  const a=who==='pl'?pl:bt, back=who==='pl'?1:-1;
  return [[a.r,a.c-1],[a.r,a.c+1],[a.r+back,a.c],[a.r+back,a.c-1],[a.r+back,a.c+1]]
    .filter(m=>inb(m[0],m[1])&&standable(m[0],m[1])&&!occ(m[0],m[1]));
}
function startHang(who){
  if(!running||hang)return;
  slowmo(who==='pl'?1500:900);
  beep(240,.3,'triangle',.05);
  if(who==='pl'){
    const resc=rescueCells('pl');
    if(!resc.length){end(false,'The plank vanished under you — nothing to grab');return;}
    pDiv.classList.add('hang');
    hang={who:'pl',need:5,hit:0,deadline:Date.now()+1500,resc};
    say(TAUNT_HANG);
    ovl.classList.add('on');
    ovl.innerHTML='<div class="mash">GRAB THE EDGE!</div><div class="cap">Mash SPACE or tap fast!</div><div class="mash-bar"><div class="mash-fill" id="mashFill"></div></div>';
  }else{
    bDiv.classList.add('hang');
    const g=gen;
    setTimeout(()=>{
      if(g!==gen||!running)return;
      bDiv.classList.remove('hang');
      const resc=rescueCells('bt');
      if(resc.length&&Math.random()<cfg.hangSurv){
        bt={r:resc[0][0],c:resc[0][1]};place(bDiv,bt.r,bt.c);
        say(TAUNT_SURV);beep(300,.1);hl();
      }else{
        end(true,'Rusty grabbed at air — and missed');
      }
    },850);
  }
}
function mash(){
  if(!hang||hang.who!=='pl')return;
  hang.hit++;beep(380+hang.hit*40,.05,'square',.03);
  const f=$('mashFill');if(f)f.style.width=Math.min(100,hang.hit/hang.need*100)+'%';
  if(hang.hit>=hang.need){
    const m=hang.resc.find(x=>standable(x[0],x[1])&&!occ(x[0],x[1]));
    hang=null;pDiv.classList.remove('hang');ovl.classList.remove('on');ovl.innerHTML='';
    if(m){pl={r:m[0],c:m[1]};place(pDiv,pl.r,pl.c);hangSurvived=true;tag(pl.r,pl.c,'saved!','#3FBF97');beep(520,.2,'triangle',.05);hl();}
    else end(false,'You climbed to a plank that was no longer there');
  }
}

/* ---------- pickups ---------- */
function spawnPickups(rng){
  pickups=[];
  const n=Math.max(2,Math.round(R/6)+1);
  let tries=0;
  while(pickups.length<n&&tries<200){
    tries++;
    const r=2+Math.floor(rng()*(R-4)),c=Math.floor(rng()*C);
    if(plank[r][c]!==2)continue;
    if(pickups.some(p=>p.r===r&&p.c===c))continue;
    const type=rng()<.55?'bolt':'slow';
    const el=document.createElement('div');el.className='pickup';
    el.innerHTML=type==='bolt'
      ?'<svg width="16" height="16" viewBox="0 0 16 16"><polygon points="9,1 3,9 7,9 6,15 13,6 9,6" fill="#E8B33C"/></svg>'
      :'<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#8FB4D8" stroke-width="2"/><line x1="8" y1="8" x2="8" y2="4.5" stroke="#8FB4D8" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="8" x2="11" y2="9.5" stroke="#8FB4D8" stroke-width="2" stroke-linecap="round"/></svg>';
    const p=xy(r,c);el.style.left=(p[0]+CW/2-11)+'px';el.style.top=(p[1]+CH/2-11)+'px';
    board.appendChild(el);
    pickups.push({r,c,type,el});
  }
}
function collect(who,r,c){
  const i=pickups.findIndex(p=>p.r===r&&p.c===c);if(i<0)return;
  const p=pickups[i];p.el.remove();pickups.splice(i,1);
  if(who==='pl'){
    got++;
    if(p.type==='bolt'){pS++;hud();tag(r,c,'+1 snap','#E8B33C');beep(660,.12,'triangle',.05);}
    else{botSlowUntil=Date.now()+3000;tag(r,c,'Rusty slowed!','#8FB4D8');beep(220,.25,'sine',.05);}
  }else{
    tag(r,c,'crushed','#B8AC97');
  }
}

/* ---------- movement ---------- */
function movePl(r,c){
  if(!running||hang)return;
  beep(r===pl.r-2?260:320,.06);
  crack(pl.r,pl.c);
  pl={r,c};place(pDiv,r,c);
  collect('pl',r,c);
  if(plank[r][c]===3)rotStep('pl',r,c);
  if(r===0){end(true,'Crossed first with Rusty still on the bridge');return;}
  if(r<=2)slowSkip=false;
  hl();
}
function solidAhead(r,c){let n=0;for(let dc=-1;dc<=1;dc++){if(inb(r+1,c+dc)&&plank[r+1][c+dc]>=2)n++;}return n;}
function botTick(){
  if(!running||hang)return;
  const now=Date.now();
  if(now<botFrozenUntil)return;
  if(now<botSlowUntil){slowSkip=!slowSkip;if(slowSkip)return;}
  /* streak escalation is baked into interval at start */
  let sc=cfg.snap;if(pl.r<=2)sc=Math.min(.6,sc*2.2);
  if(bS>0&&Math.random()<sc){
    let tg=[[pl.r-1,pl.c],[pl.r-1,pl.c-1],[pl.r-1,pl.c+1]];
    if((cfg===CFG.hard||cfg===CFG.insane)&&inb(pl.r-1,pl.c)&&plank[pl.r-1][pl.c]===0)tg.unshift([pl.r-2,pl.c]);
    tg=tg.filter(m=>inb(m[0],m[1])&&snappable(m[0],m[1]));
    if(tg.length){bS--;snap(tg[0][0],tg[0][1]);hud();say(TAUNT_SNAP);if(pl.r<=3)slowmo(400);return;}
  }
  let cand=[[bt.r+1,bt.c],[bt.r+1,bt.c-1],[bt.r+1,bt.c+1],[bt.r,bt.c-1],[bt.r,bt.c+1]]
    .filter(m=>inb(m[0],m[1])&&standable(m[0],m[1])&&!(pl.r===m[0]&&pl.c===m[1]));
  if(inb(bt.r+2,bt.c)&&plank[bt.r+1][bt.c]===0&&standable(bt.r+2,bt.c)&&!(pl.r===bt.r+2&&pl.c===bt.c))cand.push([bt.r+2,bt.c]);
  if(!cand.length)return;
  let ch=null;
  const lat=cand.filter(m=>m[0]===bt.r);
  if(cfg.feint&&lat.length&&Math.random()<cfg.feint)ch=lat[Math.floor(Math.random()*lat.length)];
  else if(Math.random()<cfg.rand)ch=cand[Math.floor(Math.random()*cand.length)];
  else{
    let best=-1e9;
    cand.forEach(m=>{
      let s=(m[0]-bt.r)*10+solidAhead(m[0],m[1])*2;
      const v=plank[m[0]][m[1]];
      s+=v===2?4:v===4?5:v===3?-3:-7;
      s+=Math.random();
      if(s>best){best=s;ch=m;}
    });
  }
  crack(bt.r,bt.c);
  bt={r:ch[0],c:ch[1]};place(bDiv,bt.r,bt.c);beep(190,.05,'square',.02);
  collect('bt',ch[0],ch[1]);
  if(plank[ch[0]][ch[1]]===3)rotStep('bt',ch[0],ch[1]);
  if(ch[0]===R-1){end(false,'Rusty crossed first');return;}
  hl();
}

/* ---------- grading ---------- */
function gradeOf(t){
  const par=R*0.95;
  let pts=(par/t)*60+pS*10+(hangSurvived?15:0)+got*5;
  return pts>=100?'S':pts>=80?'A':pts>=62?'B':'C';
}

/* ---------- end / result ---------- */
function end(won,cap){
  if(!running)return;
  running=false;gen++;hang=null;
  clearInterval(bIv);clearInterval(tIv);
  pDiv.classList.remove('hang');bDiv.classList.remove('hang');
  const t=(Date.now()-t0)/1000;
  if(won){streaks[S.diff]++;}else{streaks[S.diff]=0;}
  if(won&&S.daily&&(dailyBest===null||t<dailyBest)){dailyBest=t;dailyMap[todayKey()]=t;}
  persist();
  let gr='';
  if(won){
    const g=gradeOf(t);
    gr='<div class="grade g-'+g+'">'+g+'</div>';
  }
  const st=streaks[S.diff];
  const streakLine=won&&st>1?('🔥 '+st+' in a row — Rusty speeds up next match'):(won?'':'Streak reset. Rusty remembers.');
  ovl.classList.add('on');
  ovl.innerHTML=
    '<div class="result-title '+(won?'w':'l')+'">'+(won?'YOU WIN':'SNAPPED')+'</div>'
    +gr
    +'<div class="cap">'+cap+(streakLine?('<br>'+streakLine):'')+'</div>'
    +'<div class="stats-row">'
      +'<span><b>'+t.toFixed(1)+'s</b>time</span>'
      +'<span><b>'+(pS)+'</b>snaps left</span>'
      +'<span><b>'+broken+'</b>planks down</span>'
      +'<span><b>'+got+'</b>pickups</span>'
    +'</div>'
    +(S.daily&&dailyBest!==null?'<div class="cap">Daily bridge best: '+dailyBest.toFixed(1)+'s</div>':'')
    +'<div class="btn-row">'
      +'<button class="gbtn pri" id="reBtn">↻ REPLAY</button>'
      +'<button class="gbtn sec" id="homeBtn">SETTINGS</button>'
    +'</div>';
  $('reBtn').onclick=startMatch;
  $('homeBtn').onclick=()=>{gen++;$('scr-game').classList.remove('on');$('scr-home').classList.add('on');updateStreakChip();updateDailyNote();};
  beep(won?520:150,.35,won?'triangle':'sawtooth',.05);
  hl();
}

/* ---------- build & start ---------- */
function build(){
  gen++;clearInterval(bIv);clearInterval(tIv);
  running=false;snapMode=false;broken=0;got=0;hangSurvived=false;hang=null;
  cdUntil=0;botFrozenUntil=0;botSlowUntil=0;
  R=S.len;C=S.lan;cfg=CFG[S.diff];pS=bS=S.chg;
  BW=Math.min(420,Math.max(300,window.innerWidth-32));
  CW=Math.floor((BW-PAD*2-(C-1)*GX)/C);
  const H=PAD*2+R*CH+(R-1)*GY;
  board.style.width=BW+'px';board.style.height=H+'px';
  board.innerHTML='<div id="ovl"></div>';
  ovl=board.querySelector('#ovl');
  cells=[];plank=[];
  const seed=S.daily?todayKey():Math.floor(Math.random()*1e9);
  const rng=mulberry32(seed);
  /* rails */
  ['5px',''].forEach((l,i)=>{
    const rail=document.createElement('div');
    rail.style.cssText='position:absolute;top:8px;bottom:8px;width:3px;background:#4A4038;border-radius:2px;'+(i===0?'left:5px;':'right:5px;');
    board.appendChild(rail);
  });
  for(let r=0;r<R;r++){
    plank[r]=[];cells[r]=[];
    let gaps=0;
    for(let c=0;c<C;c++){
      let v=2;
      const safe=r<2||r>R-3;
      if(!safe){
        const roll=rng();
        if(roll<.07&&gaps<Math.floor(C/2)){v=0;gaps++;}
        else if(roll<.17)v=3;
        else if(roll<.23)v=4;
      }
      plank[r][c]=v;
      const d=document.createElement('div');
      const p=xy(r,c);
      d.style.left=p[0]+'px';d.style.top=p[1]+'px';d.style.width=CW+'px';d.style.height=CH+'px';
      d.addEventListener('click',()=>cellClick(r,c));
      board.appendChild(d);cells[r][c]=d;paint(r,c);
    }
  }
  spawnPickups(rng);
  const mid=Math.floor(C/2);
  pl={r:R-1,c:mid};bt={r:0,c:mid};
  bDiv=document.createElement('div');bDiv.className='chr';bDiv.innerHTML=fig('#E86A45');board.appendChild(bDiv);place(bDiv,0,mid);
  pDiv=document.createElement('div');pDiv.className='chr';pDiv.innerHTML=fig('#3FBF97');board.appendChild(pDiv);place(pDiv,R-1,mid);
  bubble=document.createElement('div');bubble.className='bubble';board.appendChild(bubble);
  $('timer').textContent='0.0';hud();
}
function startMatch(){
  build();
  const g=gen;let n=3;
  ovl.classList.add('on');
  const step=()=>{
    if(g!==gen)return;
    if(n>0){ovl.innerHTML='<div class="count">'+n+'</div>';beep(400,.1,'triangle',.04);n--;setTimeout(step,600);}
    else{
      ovl.innerHTML='<div class="count" style="color:var(--you)">GO</div>';beep(640,.2,'triangle',.05);
      setTimeout(()=>{
        if(g!==gen)return;
        ovl.classList.remove('on');ovl.innerHTML='';
        running=true;t0=Date.now();
        const st=Math.min(streaks[S.diff],6);
        const iv=Math.max(280,Math.round(cfg.iv*Math.pow(.95,st)));
        tIv=setInterval(()=>{
          $('timer').textContent=((Date.now()-t0)/1000).toFixed(1);
          hud();
          if(hang&&hang.who==='pl'&&Date.now()>hang.deadline){
            hang=null;end(false,'Your grip gave out');
          }
        },100);
        bIv=setInterval(botTick,iv);
        hl();
      },450);
    }
  };
  step();
}

function cellClick(r,c){
  if(!running)return;
  if(hang){mash();return;}
  if(snapMode){
    if(snappable(r,c)&&pS>0&&Date.now()>=cdUntil){
      pS--;snapMode=false;cdUntil=Date.now()+SNAPCD;
      snap(r,c);hud();hl();
    }else if(plank[r][c]===4){tag(r,c,'iron!','#AEB4BE');beep(90,.08,'square',.04);}
    return;
  }
  if(pMoves().some(m=>m[0]===r&&m[1]===c))movePl(r,c);
}

$('snapBtn').addEventListener('click',()=>{
  if(!running||pS<1||Date.now()<cdUntil||hang)return;
  snapMode=!snapMode;hud();hl();
});
board.addEventListener('click',()=>{if(hang)mash();});
const onKeydown=e=>{
  if(!running)return;
  if(hang){if(e.key===' '){e.preventDefault();mash();}return;}
  let m=null;
  if(e.key==='ArrowUp'||e.key==='w'){m=[pl.r-1,pl.c];if(!pMoves().some(x=>x[0]===m[0]&&x[1]===m[1]))m=[pl.r-2,pl.c];}
  if(e.key==='ArrowLeft'||e.key==='a')m=[pl.r,pl.c-1];
  if(e.key==='ArrowRight'||e.key==='d')m=[pl.r,pl.c+1];
  if(e.key==='q')m=[pl.r-1,pl.c-1];
  if(e.key==='e')m=[pl.r-1,pl.c+1];
  if(e.key===' '){e.preventDefault();if(pS>0&&Date.now()>=cdUntil){snapMode=!snapMode;hud();hl();}return;}
  if(m&&pMoves().some(x=>x[0]===m[0]&&x[1]===m[1])){e.preventDefault();movePl(m[0],m[1]);}
};
document.addEventListener('keydown',onKeydown);

$('playBtn').addEventListener('click',()=>{
  $('scr-home').classList.remove('on');
  $('scr-game').classList.add('on');
  startMatch();
});
(function restore(){
  const st=SAVE.settings;
  if(st&&typeof st==='object'){
    ['diff','len','lan','chg'].forEach(k=>{if(st[k]!==undefined)S[k]=st[k];});
    S.daily=!!st.daily;
    document.querySelectorAll('.opts').forEach(g=>{
      const k=g.dataset.key;
      g.querySelectorAll('.opt').forEach(o=>{
        const v=isNaN(+o.dataset.v)?o.dataset.v:+o.dataset.v;
        o.classList.toggle('sel',v===S[k]);
      });
    });
    $('dailyTgl').classList.toggle('on',S.daily);
    $('rustyWr').textContent=WR[S.diff];
  }
  syncDailyBest();
  updateStreakChip();
  updateDailyNote();
})();

  cleanup=()=>{gen++;clearInterval(tIv);clearInterval(bIv);document.removeEventListener('keydown',onKeydown);};
  return cleanup;
}
