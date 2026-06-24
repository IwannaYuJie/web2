/* 实时热搜 · 读取 /data/trends.json，每分钟刷新 */
const $=s=>document.querySelector(s);
const REGIONS={world:'🌍 全球',us:'🇺🇸 美国',uk:'🇬🇧 英国',jp:'🇯🇵 日本'};
let data=null,cur='world';
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

function segs(){
  $('#segs').innerHTML=Object.keys(REGIONS).map(k=>
    `<button class="seg${k===cur?' on':''}" data-k="${k}">${REGIONS[k]}</button>`).join('');
  $('#segs').querySelectorAll('.seg').forEach(b=>b.onclick=()=>{cur=b.dataset.k;segs();list()});
}
function list(){
  const box=$('#tlist');
  const items=(data&&data.regions&&data.regions[cur])||[];
  if(!items.length){
    box.innerHTML='<div class="tempty"><div>🐾</div><div class="mono">暂无数据 · 等待下一次抓取</div></div>';return;
  }
  box.innerHTML=items.slice(0,10).map((it,i)=>{
    const top=i<3, w=Math.round(96-i*8.4);
    const val=esc(it.count||'')||(top?'HOT':'LIVE');
    return `<div class="trend${top?' top':''}" style="animation-delay:${i*42}ms">
      <div class="rk">${String(i+1).padStart(2,'0')}</div>
      <div><div class="tname">${esc(it.name||'—')}</div>
        <div class="heat"><i style="width:${w}%"></i></div></div>
      <div class="tval">${val}</div>
    </div>`;
  }).join('');
}
async function loadTrends(){
  try{
    const r=await fetch('/data/trends.json?ts='+Date.now(),{cache:'no-store'});
    data=await r.json();
    const t=data.updated_at||'未知';
    const u=$('#updated');if(u)u.innerHTML='更新 <b>'+esc(t)+'</b>';
    const ut=$('#updTop');if(ut)ut.textContent=esc((t.split(' ')[1])||t);
    segs();list();
  }catch(e){
    const u=$('#updated');if(u)u.textContent='同步失败，稍后重试';
    $('#tlist').innerHTML='<div class="tempty"><div>⚠️</div><div class="mono">无法读取 /data/trends.json</div></div>';
  }
}
loadTrends();setInterval(loadTrends,60000);
const _yr=$('#yr');if(_yr)_yr.textContent=new Date().getFullYear();
