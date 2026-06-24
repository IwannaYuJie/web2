/* 猫猫求生（躲避生存） · 纯前端，零依赖；含全站排行榜对接 */
const $=s=>document.querySelector(s);
const cv=$('#cv'), X=cv.getContext('2d'), W=cv.width, H=cv.height;
const FONT='-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif';
const BEST_KEY='sbjumao_survive_best';
const API='/api/scores', GAME='survive';
const escH=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const rand=(a,b)=>Math.random()*(b-a)+a;
const TAU=Math.PI*2;
const dd=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
let best=+(localStorage.getItem(BEST_KEY)||0);
let lastScore=0, lastT=0, pendRank=0;

/* —— 音效：Web Audio 合成，无外部文件 —— */
let actx=null, muted=false;
function audioOn(){ if(!actx){try{actx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}} if(actx&&actx.state==='suspended')actx.resume(); }
function tone(f,dur,type,vol,to){ if(muted||!actx)return; const t=actx.currentTime,o=actx.createOscillator(),g=actx.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(f,t); if(to)o.frequency.exponentialRampToValueAtTime(to,t+dur);
  g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol||.2,t+.01); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t+dur+.03); }
function noise(dur,vol,hp){ if(muted||!actx)return; const t=actx.currentTime,n=actx.createBufferSource(),
  buf=actx.createBuffer(1,actx.sampleRate*dur|0,actx.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
  n.buffer=buf; const g=actx.createGain(); g.gain.value=vol||.15; const f=actx.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp||500;
  n.connect(f).connect(g).connect(actx.destination); n.start(); }
const SFX={
  eat(c){tone(480+Math.min(c,14)*36,.12,'triangle',.16,820+Math.min(c,14)*48);},
  dash(){noise(.18,.1,300);tone(280,.16,'sawtooth',.07,110);},
  hit(){tone(170,.3,'square',.22,55);noise(.22,.16,250);},
  power(){tone(640,.16,'sine',.16,960);tone(960,.18,'sine',.12,1280);},
  over(){tone(420,.5,'sine',.2,105);},
  go(){tone(330,.12,'sine',.14,660);}
};

/* —— 星空背景（一次性生成） —— */
const stars=Array.from({length:64},()=>({x:rand(0,W),y:rand(0,H),z:rand(.25,1)}));

/* —— 状态 —— */
const cat={x:W/2,y:H/2,vx:0,vy:0,r:17,dir:{x:0,y:-1}};
const pointer={x:W/2,y:H/2,active:false};
const keys=new Set();
let g=null;
function fresh(){return{run:false,over:false,t:0,score:0,combo:1,lives:3,
  hz:[],fish:[],pw:[],pt:[],fl:[],
  spawnT:.8,fishT:1,powerT:9,
  inv:0,dashCD:0,dashT:0,shield:0,slow:0,shake:0,flash:0,last:0};}

/* —— 生成 —— */
function spawnHz(){
  const e=Math.floor(rand(0,4));let px,py;
  if(e===0){px=rand(0,W);py=-28;}else if(e===1){px=W+28;py=rand(0,H);}
  else if(e===2){px=rand(0,W);py=H+28;}else{px=-28;py=rand(0,H);}
  const hunter=Math.random()<Math.min(.30,.04+g.t*.004);
  const spd=hunter?rand(95,128):rand(155,205)+Math.min(g.t*4,170);
  const tx=rand(W*.25,W*.75),ty=rand(H*.25,H*.75),a=Math.atan2(ty-py,tx-px);
  g.hz.push({x:px,y:py,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,r:hunter?15:rand(11,16),spd,hunter,rot:rand(0,TAU),life:0});
}
function spawnFish(){g.fish.push({x:rand(46,W-46),y:rand(46,H-46),r:13,bob:rand(0,TAU),ttl:rand(6,9)});}
function spawnPw(){const ty=['shield','slow','clear'][Math.floor(rand(0,3))];
  g.pw.push({x:rand(60,W-60),y:rand(60,H-60),r:16,ty,bob:rand(0,TAU),ttl:10});}

/* —— 特效 —— */
function burst(px,py,col,n,sp){for(let i=0;i<n;i++){const a=rand(0,TAU),s=rand(sp*.3,sp);
  g.pt.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.4,.9),col,sz:rand(2,4)});}}
function fl(px,py,txt,col){g.fl.push({x:px,y:py,txt,col,life:1});}

/* —— 技能 —— */
function dash(){
  if(!g||!g.run||g.dashCD>0)return;
  const l=Math.hypot(cat.dir.x,cat.dir.y)||1;
  cat.vx=cat.dir.x/l*880; cat.vy=cat.dir.y/l*880;
  g.dashT=.16; g.dashCD=1.1; g.inv=Math.max(g.inv,.18); g.shake=Math.max(g.shake,6);
  burst(cat.x,cat.y,'#7fe9ff',14,260); SFX.dash();
}
function hit(h){
  h.dead=true; g.lives--; g.combo=1; g.inv=1.3; g.flash=.35; g.shake=15;
  burst(cat.x,cat.y,'#ff5f7a',24,330); SFX.hit();
  if(g.lives<=0)over();
}
function power(ty){
  SFX.power(); burst(cat.x,cat.y,'#fff',16,240);
  if(ty==='shield'){g.shield=Math.min(g.shield+1,3);fl(cat.x,cat.y-28,'🛡 护盾 +1','#6aa6ff');}
  else if(ty==='slow'){g.slow=4;fl(cat.x,cat.y-28,'⏳ 慢动作！','#b46aff');}
  else{for(const h of g.hz)burst(h.x,h.y,'#ffd27a',8,170);g.hz=[];g.flash=.2;g.shake=10;fl(cat.x,cat.y-28,'💥 清屏！','#ffd27a');}
}

/* —— 更新 —— */
function update(dt){
  if(!g.run)return;
  g.t+=dt; g.score+=dt*10*g.combo*(g.slow>0?.6:1);
  g.dashCD=Math.max(0,g.dashCD-dt); g.dashT=Math.max(0,g.dashT-dt);
  g.inv=Math.max(0,g.inv-dt); g.flash=Math.max(0,g.flash-dt); g.slow=Math.max(0,g.slow-dt);
  g.shake*=Math.pow(.0001,dt);
  const ts=g.slow>0?.45:1;

  let ix=0,iy=0;
  if(keys.has('a')||keys.has('arrowleft'))ix--;
  if(keys.has('d')||keys.has('arrowright'))ix++;
  if(keys.has('w')||keys.has('arrowup'))iy--;
  if(keys.has('s')||keys.has('arrowdown'))iy++;
  if(pointer.active){const px=pointer.x-cat.x,py=pointer.y-cat.y,l=Math.hypot(px,py);if(l>5){ix=px/l;iy=py/l;}}
  const il=Math.hypot(ix,iy);
  if(il>0){cat.dir.x=ix/il;cat.dir.y=iy/il;}
  if(g.dashT<=0){
    const acc=2600,mx=(g.slow>0?300:330);
    if(il>0){cat.vx+=ix/il*acc*dt;cat.vy+=iy/il*acc*dt;}
    cat.vx*=Math.pow(.0009,dt); cat.vy*=Math.pow(.0009,dt);
    const sp=Math.hypot(cat.vx,cat.vy);if(sp>mx){cat.vx=cat.vx/sp*mx;cat.vy=cat.vy/sp*mx;}
  }
  cat.x+=cat.vx*dt; cat.y+=cat.vy*dt;
  if(cat.x<cat.r){cat.x=cat.r;cat.vx=0;} if(cat.x>W-cat.r){cat.x=W-cat.r;cat.vx=0;}
  if(cat.y<cat.r){cat.y=cat.r;cat.vy=0;} if(cat.y>H-cat.r){cat.y=H-cat.r;cat.vy=0;}

  g.spawnT-=dt;
  const itv=Math.max(.34,1.15-g.t*.012);
  if(g.spawnT<=0){spawnHz();g.spawnT=itv*rand(.7,1.1);if(g.t>22&&Math.random()<.3)spawnHz();}
  g.fishT-=dt; if(g.fishT<=0){if(g.fish.length<4)spawnFish();g.fishT=rand(1.3,2.4);}
  g.powerT-=dt; if(g.powerT<=0){if(g.pw.length<1)spawnPw();g.powerT=rand(11,16);}

  for(const h of g.hz){
    if(h.hunter){
      const a=Math.atan2(cat.y-h.y,cat.x-h.x),ca=Math.atan2(h.vy,h.vx);
      let da=a-ca;while(da>Math.PI)da-=TAU;while(da<-Math.PI)da+=TAU;
      const na=ca+Math.max(-1.8*dt,Math.min(1.8*dt,da));
      h.vx=Math.cos(na)*h.spd;h.vy=Math.sin(na)*h.spd;
    }
    h.x+=h.vx*dt*ts;h.y+=h.vy*dt*ts;h.rot+=dt*4;h.life+=dt;
    if(g.inv<=0&&dd(h,cat)<h.r+cat.r-3){
      if(g.shield>0){g.shield--;g.inv=.8;h.dead=true;burst(cat.x,cat.y,'#6aa6ff',16,260);SFX.power();fl(cat.x,cat.y-24,'护盾抵消','#6aa6ff');}
      else hit(h);
    }
  }
  g.hz=g.hz.filter(h=>!h.dead&&h.x>-60&&h.x<W+60&&h.y>-60&&h.y<H+60&&h.life<32);

  for(const f of g.fish){f.ttl-=dt;f.bob+=dt*4;
    if(dd(f,cat)<f.r+cat.r){f.dead=true;g.combo++;const gain=10*g.combo;g.score+=gain;
      burst(f.x,f.y,'#2fe3b4',12,220);fl(f.x,f.y-18,'+'+gain,'#2fe3b4');SFX.eat(g.combo);
      if(g.combo>1&&g.combo%5===0)fl(cat.x,cat.y-32,'连击 ×'+g.combo+'!','#ffd27a');}}
  g.fish=g.fish.filter(f=>!f.dead&&f.ttl>0);

  for(const p of g.pw){p.ttl-=dt;p.bob+=dt*4;if(dd(p,cat)<p.r+cat.r){p.dead=true;power(p.ty);}}
  g.pw=g.pw.filter(p=>!p.dead&&p.ttl>0);

  for(const pa of g.pt){pa.x+=pa.vx*dt;pa.y+=pa.vy*dt;pa.vx*=Math.pow(.02,dt);pa.vy*=Math.pow(.02,dt);pa.life-=dt;}
  g.pt=g.pt.filter(p=>p.life>0);
  for(const t of g.fl){t.y-=42*dt;t.life-=dt*1.2;}
  g.fl=g.fl.filter(t=>t.life>0);

  syncHud();
}

/* —— 绘制 —— */
function drawBg(){
  X.fillStyle='#070b12';X.fillRect(0,0,W,H);
  for(const s of stars){const y=(s.y+(g?g.t:0)*12*s.z)%H;X.globalAlpha=.5*s.z;X.fillStyle='#9fb4ff';X.fillRect(s.x,y,s.z*2,s.z*2);}
  X.globalAlpha=1;
  X.strokeStyle='rgba(47,227,180,.05)';X.lineWidth=1;
  for(let i=48;i<W;i+=48){X.beginPath();X.moveTo(i,0);X.lineTo(i,H);X.stroke();}
  for(let j=48;j<H;j+=48){X.beginPath();X.moveTo(0,j);X.lineTo(W,j);X.stroke();}
  const v=X.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,H*.75);
  v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.55)');
  X.fillStyle=v;X.fillRect(0,0,W,H);
}
function drawFish(f){
  const y=f.y+Math.sin(f.bob)*3,fade=f.ttl<1.5?.4+.6*Math.abs(Math.sin(f.ttl*8)):1;
  X.globalAlpha=fade;X.save();X.translate(f.x,y);
  X.shadowColor='#2fe3b4';X.shadowBlur=14;X.fillStyle='#36e6c4';
  X.beginPath();X.ellipse(0,0,f.r,f.r*.62,0,0,TAU);X.fill();
  X.beginPath();X.moveTo(f.r*.7,0);X.lineTo(f.r*1.5,-f.r*.6);X.lineTo(f.r*1.5,f.r*.6);X.closePath();X.fill();
  X.shadowBlur=0;X.fillStyle='#06131b';X.beginPath();X.arc(-f.r*.4,-1,1.8,0,TAU);X.fill();
  X.restore();X.globalAlpha=1;
}
function drawPw(p){
  const y=p.y+Math.sin(p.bob)*3,c=p.ty==='shield'?'#6aa6ff':p.ty==='slow'?'#b46aff':'#ffd27a',
    ic=p.ty==='shield'?'🛡':p.ty==='slow'?'⏳':'💥';
  X.save();X.translate(p.x,y);X.rotate((g?g.t:0)*1.4);
  X.shadowColor=c;X.shadowBlur=18;X.fillStyle=c;
  X.beginPath();for(let i=0;i<4;i++){const a=i/4*TAU;X[i?'lineTo':'moveTo'](Math.cos(a)*p.r,Math.sin(a)*p.r);}X.closePath();X.fill();
  X.restore();
  X.save();X.translate(p.x,y);X.shadowBlur=0;X.font='15px '+FONT;X.textAlign='center';X.textBaseline='middle';X.fillText(ic,0,1);X.restore();
}
function drawHz(h){
  X.globalAlpha=.22;X.strokeStyle=h.hunter?'#b46aff':'#ff6b4a';X.lineWidth=h.r*1.3;X.lineCap='round';
  X.beginPath();X.moveTo(h.x,h.y);X.lineTo(h.x-h.vx*.045,h.y-h.vy*.045);X.stroke();X.globalAlpha=1;
  X.save();X.translate(h.x,h.y);X.rotate(h.rot);
  const c=h.hunter?'#b46aff':'#ff6b4a';X.shadowColor=c;X.shadowBlur=15;X.fillStyle=c;
  if(h.hunter){
    X.beginPath();for(let i=0;i<12;i++){const rr=i%2?h.r*1.35:h.r;const a=i/12*TAU;X[i?'lineTo':'moveTo'](Math.cos(a)*rr,Math.sin(a)*rr);}X.closePath();X.fill();
    X.shadowBlur=0;X.restore();
    X.save();X.translate(h.x,h.y);const a=Math.atan2(cat.y-h.y,cat.x-h.x);
    X.fillStyle='#fff';X.beginPath();X.arc(Math.cos(a)*4,Math.sin(a)*4,3.2,0,TAU);X.fill();
    X.fillStyle='#3a0f4f';X.beginPath();X.arc(Math.cos(a)*5,Math.sin(a)*5,1.5,0,TAU);X.fill();X.restore();
  }else{
    X.beginPath();for(let i=0;i<14;i++){const rr=i%2?h.r*1.7:h.r;const a=i/14*TAU;X[i?'lineTo':'moveTo'](Math.cos(a)*rr,Math.sin(a)*rr);}X.closePath();X.fill();
    X.shadowBlur=0;X.fillStyle='rgba(7,11,18,.55)';X.beginPath();X.arc(0,0,h.r*.5,0,TAU);X.fill();X.restore();
  }
}
function drawCat(){
  const col=g.flash>0?'#ff5f7a':'#2fe3b4';
  if(g.dashT>0){for(let i=1;i<=3;i++){X.globalAlpha=.16*(3-i);X.fillStyle=col;X.beginPath();
    X.arc(cat.x-cat.vx*.012*i,cat.y-cat.vy*.012*i,cat.r*(1-.12*i),0,TAU);X.fill();}X.globalAlpha=1;}
  if(g.inv>0&&Math.floor(g.t*22)%2===0)return;
  X.save();X.translate(cat.x,cat.y);
  const sp=Math.hypot(cat.vx,cat.vy);
  if(sp>20){const ang=Math.atan2(cat.vy,cat.vx),st=Math.min(sp/330,1);X.rotate(ang);X.scale(1+st*.28,1-st*.14);X.rotate(-ang);}
  if(g.shield>0){X.save();X.rotate(g.t*2);X.strokeStyle='rgba(106,166,255,.85)';X.lineWidth=2.5;X.setLineDash([6,5]);
    X.beginPath();X.arc(0,0,cat.r+8,0,TAU);X.stroke();X.restore();}
  X.shadowColor=col;X.shadowBlur=20;X.fillStyle=col;
  for(const s of[-1,1]){X.beginPath();X.moveTo(s*7,-cat.r+4);X.lineTo(s*15,-cat.r-9);X.lineTo(s*1,-cat.r-1);X.closePath();X.fill();}
  X.beginPath();X.arc(0,0,cat.r,0,TAU);X.fill();X.shadowBlur=0;
  X.fillStyle='rgba(4,18,13,.28)';X.beginPath();X.arc(0,0,cat.r*.72,0,TAU);X.fill();
  const ex=cat.dir.x*4,ey=cat.dir.y*4;X.fillStyle='#06131b';
  for(const s of[-1,1]){X.beginPath();X.ellipse(s*6+ex*.5,-1+ey*.5,2.6,3.4,0,0,TAU);X.fill();}
  X.fillStyle='#ff9ab8';X.beginPath();X.arc(ex*.6,3+ey*.6,1.8,0,TAU);X.fill();
  X.restore();
}
function scene(){
  drawBg();
  for(const p of g.pw)drawPw(p);
  for(const f of g.fish)drawFish(f);
  for(const h of g.hz)drawHz(h);
  for(const pa of g.pt){X.globalAlpha=Math.max(0,pa.life);X.fillStyle=pa.col;X.beginPath();X.arc(pa.x,pa.y,pa.sz,0,TAU);X.fill();}
  X.globalAlpha=1;
  drawCat();
  X.textAlign='center';X.textBaseline='middle';
  for(const t of g.fl){X.globalAlpha=Math.max(0,t.life);X.fillStyle=t.col;X.font='bold 22px '+FONT;X.fillText(t.txt,t.x,t.y);}
  X.globalAlpha=1;
}
function overlay(){
  X.fillStyle='rgba(6,10,16,.66)';X.fillRect(0,0,W,H);
  X.textAlign='center';X.textBaseline='middle';
  if(g&&g.over){
    const ns=Math.floor(g.score);
    X.fillStyle='#e9eef6';X.font='bold 46px '+FONT;X.fillText(ns+' 分',W/2,H/2-40);
    X.font='17px '+FONT;X.fillStyle='#838fa1';X.fillText('存活 '+g.t.toFixed(1)+' 秒',W/2,H/2-4);
    X.font='bold 19px '+FONT;
    if(ns>=best&&ns>0){X.fillStyle='#2fe3b4';X.fillText('🏆 新纪录！',W/2,H/2+30);}
    else{X.fillStyle='#838fa1';X.fillText('最高 '+best+' 分',W/2,H/2+30);}
    X.fillStyle='#2fe3b4';X.font='15px '+FONT;X.fillText('下方留名上榜 · 空格再来一局',W/2,H/2+64);
  }else{
    X.fillStyle='#2fe3b4';X.font='bold 34px '+FONT;X.fillText('🐱 猫猫求生',W/2,H/2-34);
    X.fillStyle='#cdd6e3';X.font='16px '+FONT;X.fillText('躲开飞来的尖刺，捡鱼涨分',W/2,H/2+2);
    X.fillStyle='#838fa1';X.font='14px '+FONT;X.fillText('移动躲避 · 空格冲刺闪避 · 活得越久越高分',W/2,H/2+32);
    X.fillStyle='#2fe3b4';X.font='15px '+FONT;X.fillText('点击画布或「开始游戏」',W/2,H/2+64);
  }
}
function render(){
  X.save();
  if(g&&g.shake>.4)X.translate(rand(-g.shake,g.shake)*.6,rand(-g.shake,g.shake)*.6);
  if(g)scene();else drawBg();
  X.restore();
  if(g&&g.flash>0){X.fillStyle='rgba(255,70,100,'+(g.flash*.5)+')';X.fillRect(0,0,W,H);}
  if(g&&g.slow>0){X.fillStyle='rgba(140,106,255,.06)';X.fillRect(0,0,W,H);}
  if(!g||!g.run)overlay();
}

/* —— HUD —— */
function syncHud(){
  $('#score').textContent=Math.floor(g.score);
  $('#time').textContent=g.t.toFixed(1)+'″';
  $('#combo').textContent='×'+g.combo;
  $('#best').textContent=best;
  let hh='';for(let i=0;i<3;i++)hh+='<i class="heart'+(i<g.lives?'':' off')+'"></i>';
  $('#hearts').innerHTML=hh;
  $('#shieldn').textContent=g.shield>0?'  🛡×'+g.shield:'';
  const f=$('#dashfill'),rdy=g.dashCD<=0;f.style.width=(100*(1-g.dashCD/1.1))+'%';f.className=rdy?'':'cool';
}

/* —— 流程 —— */
function reset(){g=fresh();cat.x=W/2;cat.y=H/2;cat.vx=cat.vy=0;cat.dir={x:0,y:-1};hideSubmit();syncHud();render();}
function begin(){audioOn();g=fresh();g.run=true;cat.x=W/2;cat.y=H/2;cat.vx=cat.vy=0;cat.dir={x:0,y:-1};
  pendRank=0;hideSubmit();g.last=performance.now();SFX.go();requestAnimationFrame(loop);}
function over(){g.run=false;g.over=true;const ns=Math.floor(g.score);
  if(ns>best){best=ns;localStorage.setItem(BEST_KEY,best);}
  lastScore=ns;lastT=g.t;syncHud();SFX.over();render();showSubmit(ns);}
function loop(now){const dt=Math.min(.033,(now-g.last)/1000||0);g.last=now;update(dt);render();if(g.run)requestAnimationFrame(loop);}

/* —— 排行榜 —— */
function hideSubmit(){const b=$('#subbar');if(b)b.hidden=true;}
function showSubmit(score){
  const b=$('#subbar');if(!b)return;
  b.hidden=false;
  b.innerHTML='<span class="submsg">本局 <b>'+score+'</b> 分</span>'+
    '<input id="subName" class="subname" maxlength="12" placeholder="留个名字上榜">'+
    '<button class="btn go" id="subBtn" style="flex:0 0 auto">上传成绩</button>';
  const nm=$('#subName');try{nm.value=localStorage.getItem('sbjumao_name')||'';}catch(e){}
  nm.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitScore();}});
  $('#subBtn').onclick=submitScore;
}
async function submitScore(){
  const nm=$('#subName'),btn=$('#subBtn');if(!nm||!btn)return;
  const name=nm.value.trim();
  btn.disabled=true;btn.textContent='上传中…';
  try{
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({game:GAME,name,score:lastScore,t:lastT})});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d.ok){
      try{localStorage.setItem('sbjumao_name',name);}catch(e){}
      pendRank=d.rank||0;
      const b=$('#subbar');b.innerHTML='<span class="subdone">✅ 已上榜'+(d.rank?' · 第 '+d.rank+' 名':'')+'</span>';
      fetchBoard();
    }else{
      const tip=d&&d.error==='implausible'?'分数异常':d&&d.error==='rate limited'?'太频繁':'失败';
      btn.disabled=false;btn.textContent=tip+' · 重试';
    }
  }catch(e){ btn.disabled=false;btn.textContent='网络错误 · 重试'; }
}
async function fetchBoard(){
  const list=$('#lbList');if(!list)return;
  try{
    const r=await fetch(API+'?game='+GAME+'&ts='+Date.now(),{cache:'no-store'});
    const d=await r.json();const top=(d.top||[]).slice(0,10);
    if(!top.length){list.innerHTML='<li class="lbempty">还没有人上榜，来当第一个！</li>';return;}
    list.innerHTML=top.map((e,i)=>{
      const cls='lbrow'+(i<3?' t'+(i+1):'')+((i+1)===pendRank?' me':'');
      return '<li class="'+cls+'"><span class="lbrk">'+(i+1)+'</span><span class="lbname">'+escH(e.name)+
        '</span><span class="lbsc">'+e.score+'</span><span class="lbt">'+(Number(e.t)||0).toFixed(1)+'″</span></li>';
    }).join('');
  }catch(e){ list.innerHTML='<li class="lbfail">排行榜加载失败，点刷新重试</li>'; }
}

/* —— 输入 —— */
function localPt(e){const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};}
cv.addEventListener('pointermove',e=>{const p=localPt(e);pointer.x=p.x;pointer.y=p.y;pointer.active=true;});
cv.addEventListener('pointerdown',e=>{audioOn();const p=localPt(e);pointer.x=p.x;pointer.y=p.y;pointer.active=true;if(!g||!g.run)begin();});
cv.addEventListener('pointerleave',()=>{pointer.active=false;});
addEventListener('keydown',e=>{const k=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)){if(document.activeElement&&document.activeElement.tagName==='INPUT')return;e.preventDefault();}
  if(document.activeElement&&document.activeElement.tagName==='INPUT')return;
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k))pointer.active=false;
  if(k===' '){if(!g||!g.run)begin();else dash();return;}
  keys.add(k);});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
const db=$('#dashbtn');
db.addEventListener('pointerdown',e=>{e.preventDefault();if(!g||!g.run)begin();else dash();});
$('#start').onclick=begin;
$('#reset').onclick=reset;
$('#mute').onclick=()=>{muted=!muted;$('#mute').textContent=muted?'🔇':'🔊';if(!muted)audioOn();};
const _yr=$('#yr');if(_yr)_yr.textContent=new Date().getFullYear();
const lbr=$('#lbRefresh');if(lbr)lbr.onclick=()=>{pendRank=0;fetchBoard();};
fetchBoard();
reset();
