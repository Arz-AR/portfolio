const ABS = ['pa1','pa2','pa3','pa4','pa5','pa1'];

/* BUILD CARDS */
const wt = document.getElementById('wt');

/* Pick a YouTube thumbnail tier based on the CSS pixel width the image will
   actually render at, multiplied by device pixel ratio.
   Only the 16:9 tiers are used — mq (320x180) and maxres (1280x720). The
   intermediate hq/sd tiers are 4:3 with the video letterboxed inside, which
   would bake black bars into the rendered card. */
function ytSizeFor(cssPx){
  const px = cssPx * (window.devicePixelRatio || 1);
  return px < 320 ? 'mqdefault' : 'maxresdefault';
}
function ytVid(url){ const m = url && url.match(/embed\/([A-Za-z0-9_-]+)/); return m ? m[1] : null; }
/* Cards: biggest tile is 54vw on desktop, 88vw on mobile (see .wt grid). */
function cardTargetPx(){ return innerWidth < 768 ? innerWidth*0.88 : innerWidth*0.54; }
/* Modal video column: ~58% of (viewport − panel padding) on desktop, full-bleed on mobile. */
function modalTargetPx(){ return innerWidth < 768 ? innerWidth - 48 : (innerWidth - 168)*0.58; }
function ytThumb(url, cssPx){
  const id = ytVid(url);
  if(!id) return null;
  return `https://i.ytimg.com/vi/${id}/${ytSizeFor(cssPx != null ? cssPx : cardTargetPx())}.jpg`;
}

/* HORIZONTAL SCROLL */
const workEl = document.getElementById('work');
const isMobile = () => matchMedia('(max-width: 900px)').matches;
function setWH(){
  if(isMobile()){ workEl.style.height=''; wt.style.transform=''; return; }
  workEl.style.height = (innerHeight + Math.max(0, wt.scrollWidth - innerWidth)) + 'px';
}
function upH(sy){
  if(isMobile()) return;
  const r = workEl.getBoundingClientRect();
  if(r.top<=0 && r.bottom>=innerHeight){
    const p = Math.min(1,-r.top/(workEl.offsetHeight-innerHeight));
    wt.style.transform = `translateX(${-p*(wt.scrollWidth-innerWidth)}px)`;
  }
}
window.addEventListener('load',()=>{ window.scrollTo(0,0); cy=0; ty=0; setWH(); upH(0); });
window.addEventListener('resize',()=>{ setWH(); upH(window.scrollY); });

/* Shared signal — resolved by the intro loader once every thumbnail has
   completed decode(). Cards wait on this before being inserted into the DOM
   so they always appear with their backgrounds painted in one frame. */
let resolveThumbsReady; const thumbsReadyP = new Promise(r => resolveThumbsReady = r);

/* LOAD PROJECTS — fetched from external JSON.
   Shared promise so the intro loader can wait on it and preload thumbnails. */
const projectsP = fetch('projects.json').then(r => {
  if(!r.ok) throw new Error('projects.json '+r.status);
  return r.json();
});
Promise.all([projectsP, thumbsReadyP])
  .then(([data]) => {
    const frag = document.createDocumentFragment();
    data.forEach((p,i) => {
      const c = document.createElement('div'); c.className='pc rv'; c.style.transitionDelay=(i*.06)+'s';
      const thumb = p.bg || ytThumb(p.v, cardTargetPx());
      const bgH = thumb ? `<div class="pc-bg" style="background-image:url('${thumb}')"></div>` : `<div class="pc-ab ${ABS[i]}"></div>`;
      const tagsH = (p.tags||[]).map(t=>`<span class="pc-tag">${t}</span>`).join('');
      c.innerHTML = `${bgH}<div class="pc-vl"></div><div class="pc-c"><div class="pc-meta"><b>${String(p.n).padStart(2,'0')}</b><span>— ${p.year}</span></div><div class="pc-pl"><i class="fas fa-play"></i></div><h3 class="pc-tt">${p.t}</h3><p class="pc-ds">${p.s}</p><div class="pc-tags">${tagsH}</div></div>`;
      c.addEventListener('click',()=>openModal(p));
      frag.appendChild(c);
    });
    wt.appendChild(frag);
    document.querySelectorAll('.pc.rv').forEach(el => { if(typeof rvo!=='undefined') rvo.observe(el); else el.classList.add('in'); });
    document.querySelectorAll('.pc').forEach(el=>{el.addEventListener('mouseenter',()=>document.body.classList.add('ch'));el.addEventListener('mouseleave',()=>document.body.classList.remove('ch'));});
    setWH(); upH(0);
  })
  .catch(err => console.error('Failed to load projects:', err));

/* ══ LENIS-STYLE SMOOTH SCROLL ═════════════════════════════════════ */
if('scrollRestoration' in history){ history.scrollRestoration='manual'; }
window.scrollTo(0,0);
const isTouch = window.matchMedia('(hover:none)').matches;
let cy = 0, ty = 0;
let lastWheelTs = 0;
const LERP = 0.085;
const SNAP_THRESHOLD = 140;
const SNAP_IDLE_MS = 180;
const SNAP_PULL = 0.06;

function maxScroll(){ return Math.max(0, document.documentElement.scrollHeight - innerHeight); }
function snapTargets(){
  return [
    0,
    workEl.offsetTop,
    document.getElementById('about').offsetTop,
    document.getElementById('contact').offsetTop
  ];
}
function nearestTarget(y){
  const ss = snapTargets();
  let best = ss[0], bd = Math.abs(ss[0]-y);
  for(let i=1;i<ss.length;i++){ const d=Math.abs(ss[i]-y); if(d<bd){bd=d;best=ss[i];} }
  return {target:best, dist:bd};
}

if(!isTouch){
  document.documentElement.style.scrollBehavior='auto';
  window.addEventListener('wheel', e=>{
    if(document.body.classList.contains('intro-active')){ e.preventDefault(); return; }
    if(mov.classList.contains('open')) return;
    e.preventDefault();
    let d = e.deltaY;
    if(e.deltaMode === 1) d *= 16;
    else if(e.deltaMode === 2) d *= innerHeight;
    ty = Math.max(0, Math.min(maxScroll(), ty + d));
    lastWheelTs = performance.now();
  }, {passive:false});

  window.addEventListener('keydown', e=>{
    if(document.body.classList.contains('intro-active')) return;
    let handled = true;
    if(['ArrowDown'].includes(e.key))      ty = Math.min(maxScroll(), ty + 80);
    else if(['ArrowUp'].includes(e.key))   ty = Math.max(0, ty - 80);
    else if(['PageDown',' '].includes(e.key)) ty = Math.min(maxScroll(), ty + innerHeight*.85);
    else if(e.key==='PageUp')              ty = Math.max(0, ty - innerHeight*.85);
    else if(e.key==='Home')                ty = 0;
    else if(e.key==='End')                 ty = maxScroll();
    else handled = false;
    if(handled){ e.preventDefault(); lastWheelTs = performance.now(); }
  });

  let navTween=null;
  function tweenTo(target,duration=1100){
    target=Math.max(0,Math.min(maxScroll(),target));
    const start=cy, change=target-start, t0=performance.now();
    navTween={start,change,t0,duration,target};
    lastWheelTs=performance.now()+duration; // suppress snap during tween
  }
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click', e=>{
      const el = document.querySelector(a.getAttribute('href'));
      if(!el) return;
      e.preventDefault();
      tweenTo(el.offsetTop);
    });
  });

  (function loop(){
    const now = performance.now();
    if(navTween){
      const t=Math.min(1,(now-navTween.t0)/navTween.duration);
      // easeInOutCubic
      const e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
      cy=navTween.start+navTween.change*e;
      ty=cy;
      window.scrollTo(0,cy);
      upH(cy);
      if(t>=1){ navTween=null; }
      requestAnimationFrame(loop);
      return;
    }
    if(now - lastWheelTs > SNAP_IDLE_MS){
      const max = maxScroll();
      if(max - ty > 120){
        const {target, dist} = nearestTarget(ty);
        if(dist > 0 && dist < SNAP_THRESHOLD){
          ty += (target - ty) * SNAP_PULL;
        }
      }
    }
    const diff = ty - cy;
    if(Math.abs(diff) > 0.05){
      cy += diff * LERP;
      window.scrollTo(0, cy);
      upH(cy);
    } else if(cy !== ty){
      cy = ty;
      window.scrollTo(0, cy);
      upH(cy);
    }
    requestAnimationFrame(loop);
  })();

  window.addEventListener('scroll', ()=>{
    if(Math.abs(window.scrollY - cy) > 4){ cy = ty = window.scrollY; }
  }, {passive:true});
} else {
  window.addEventListener('scroll',()=>upH(window.scrollY),{passive:true});
}

/* ══ MODAL ══════════════════════════════════════════════════════════ */
const mov=document.getElementById('mov'),mttl=document.getElementById('mttl'),mttlN=document.getElementById('mttl-n'),mttlY=document.getElementById('mttl-y'),mvw=document.getElementById('mvw'),mdesc=document.getElementById('mdesc'),mimgs=document.getElementById('mimgs'),mtags=document.getElementById('mtags');
document.getElementById('mcl').addEventListener('click',closeM);
mov.addEventListener('click',e=>{if(e.target===mov)closeM();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeM();});

/* YouTube facade: poster + play overlay → on click, mount a fresh iframe.
   Tried-and-true lite-youtube-embed pattern. Fresh iframe per play avoids
   stale player state; fallback link guarantees the user can always reach
   the video even if the embed itself is blocked by environment. */
function buildYTFacade(vid,title){
  mvw.innerHTML='';
  if(!vid) return;
  const poster=document.createElement('div');
  poster.className='yt-poster';
  poster.style.backgroundImage=`url('https://i.ytimg.com/vi/${vid}/${ytSizeFor(modalTargetPx())}.jpg')`;
  poster.setAttribute('role','button');
  poster.setAttribute('aria-label','Play '+title);
  poster.innerHTML=`<div class="yt-play"><i class="fas fa-play"></i></div><a class="yt-fallback" href="https://www.youtube.com/watch?v=${vid}" target="_blank" rel="noopener">Open on YouTube ↗</a>`;
  poster.addEventListener('click',e=>{
    if(e.target.closest('.yt-fallback')) return;
    const ifr=document.createElement('iframe');
    ifr.src=`https://www.youtube.com/embed/${vid}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    ifr.title=title||'YouTube video player';
    ifr.setAttribute('frameborder','0');
    ifr.setAttribute('allow','accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    ifr.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
    ifr.setAttribute('allowfullscreen','');
    mvw.innerHTML='';
    mvw.appendChild(ifr);
  });
  mvw.appendChild(poster);
}

function openModal(p){
  mttl.textContent=p.t; mttlN.textContent=String(p.n).padStart(2,'0'); mttlY.textContent='— '+p.year+' · Project File';
  mdesc.textContent=p.d||''; mimgs.innerHTML='';
  mtags.innerHTML=(p.tags||[]).map(t=>`<span class="m-tag">${t}</span>`).join('');
  const idMatch=p.v && p.v.match(/embed\/([A-Za-z0-9_-]+)/);
  buildYTFacade(idMatch?idMatch[1]:'', p.t);
  (p.imgs||[]).forEach(src=>{const img=document.createElement('img');img.src=src;img.alt=p.t;img.className='mi';mimgs.appendChild(img);});
  mov.classList.add('open'); document.body.classList.add('mod-open'); document.body.style.overflow='hidden';
  if(!isTouch){ty=cy;}
}
function closeM(){ mov.classList.remove('open'); document.body.classList.remove('mod-open'); document.body.style.overflow=''; setTimeout(()=>{mvw.innerHTML='';},600); }

/* ══ INTRO LOADER + HERO ANIMATION ═════════════════════════════════ */
function playHero(){
  document.querySelector('.h-li').style.transform='translateY(0)';
  const chars=document.querySelectorAll('.h-char');
  chars.forEach((ch,i)=>setTimeout(()=>{ ch.style.transform='translateY(0)'; ch.style.opacity='1'; },120+i*48));
  setTimeout(()=>document.querySelector('.h-ri').style.transform='translateY(0)', 120+chars.length*48+60);
  setTimeout(()=>document.getElementById('sc').style.opacity='1',1300);
  document.querySelectorAll('.wrv').forEach(el=>{
    const r=el.getBoundingClientRect();
    if(r.top<innerHeight && r.bottom>0) el.classList.add('in');
  });
}

/* Real-progress intro loader. Waits on:
   - fonts ready (Google Fonts: Fraunces, Neue Montreal, JetBrains Mono, Archivo)
   - projects.json fetch
   - every project thumbnail (YouTube maxres + hqdefault fallback)
   - any other <img>/background image already in the DOM
   Counts loaded/total and dismisses only when fully ready. */
(function intro(){
  const introEl=document.getElementById('intro'),nEl=document.getElementById('intro-n'),iEl=document.getElementById('intro-i');
  document.body.classList.add('intro-active');
  document.documentElement.classList.add('intro-active');
  let loaded=0,total=0,displayed=0,rafId=null,registrationDone=false,dismissed=false;

  // While we're still discovering assets to load (projects.json hasn't resolved
  // yet, so thumbnails aren't registered), cap "effective" loaded at total-1
  // so the bar can't reach 100% prematurely and then snap backwards.
  function effLoaded(){ return registrationDone ? loaded : Math.min(loaded, Math.max(0,total-1)); }
  function render(){
    const pct=total?Math.floor((displayed/total)*100):0;
    nEl.textContent=pct;
    iEl.style.right=(100-pct)+'%';
  }
  // Minimum on-screen time so the bar always reads smoothly, even on a hot cache.
  const MIN_MS=2400, startTs=performance.now();
  // Slow lerp + a small floor (~0.18%/frame at 60fps) keeps the counter creeping
  // forward instead of standing still or jumping.
  function loop(){
    const eff=effLoaded();
    const target=total?eff/total:0;
    const cur=total?displayed/total:0;
    const step=Math.max(.045*(eff-displayed), .0018*total);   // ease + creep floor
    if(target>cur+1e-4){
      displayed=Math.min(eff, displayed+step);
    } else {
      displayed=eff;
    }
    render();
    const elapsed=performance.now()-startTs;
    if(displayed>=total && total>0 && registrationDone && elapsed>=MIN_MS && !dismissed){
      dismissed=true;
      resolveThumbsReady();
      setTimeout(()=>{
        introEl.classList.add('gone');
        document.body.classList.remove('intro-active');
        document.documentElement.classList.remove('intro-active');
        setTimeout(()=>{ introEl.style.display='none'; playHero(); },900);
      },360);
      return;
    }
    rafId=requestAnimationFrame(loop);
  }
  function tick(){ loaded++; }
  // Use decode() when available so the image is decoded into memory and
  // ready to paint — guarantees no late blank-thumbnail flash after the
  // loader dismisses. Falls back to onload for older browsers.
  function preloadImg(url){
    total++;
    const img=new Image();
    img.decoding='async';
    if(img.decode){
      img.src=url;
      img.decode().then(tick,tick);
    } else {
      img.onload=tick; img.onerror=tick;
      img.src=url;
    }
  }

  // 1) Fonts
  total++;
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(tick);

  // 2) Projects JSON + every thumbnail referenced
  total++;
  projectsP.then(data=>{
    const seen=new Set();
    const queue=url=>{ if(url && !seen.has(url)){ seen.add(url); preloadImg(url); } };
    data.forEach(p=>{
      const id=ytVid(p.v);
      if(id){
        queue(`https://i.ytimg.com/vi/${id}/${ytSizeFor(cardTargetPx())}.jpg`);
        queue(`https://i.ytimg.com/vi/${id}/${ytSizeFor(modalTargetPx())}.jpg`);
      }
      if(p.bg) queue(p.bg);
      (p.imgs||[]).forEach(queue);
    });
    tick();              // count the JSON fetch itself
    registrationDone=true;
  }).catch(()=>{ tick(); registrationDone=true; });

  // 3) Any <img> already in the DOM at script-load
  document.querySelectorAll('img').forEach(im=>{
    total++;
    if(im.complete && im.naturalWidth>0){ tick(); return; }
    im.addEventListener('load',tick,{once:true});
    im.addEventListener('error',tick,{once:true});
  });

  // Hard ceiling so a hung resource never strands the user.
  setTimeout(()=>{ if(loaded<total){ loaded=total; } registrationDone=true; resolveThumbsReady(); }, 12000);

  rafId=requestAnimationFrame(loop);
})();

/* Live local time in hero meta */
(function clock(){
  const el=document.getElementById('h-time'); if(!el) return;
  const tick=()=>{
    const d=new Date();
    el.textContent=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  };
  tick(); setInterval(tick,30000);
})();

/* ══ REVEALS ════════════════════════════════════════════════════════ */
const rvo=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('in');}),{threshold:.08,rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.rv').forEach(el=>rvo.observe(el));

const wrvSections=new Map();
document.querySelectorAll('.wrv').forEach(el=>{
  const par=el.closest('h2,p,a,h3')||el;
  if(!wrvSections.has(par)) wrvSections.set(par,[]);
  wrvSections.get(par).push(el);
});
const wrvo=new IntersectionObserver(es=>es.forEach(e=>{
  if(!e.isIntersecting) return;
  const list=wrvSections.get(e.target);
  if(!list) return;
  list.forEach((el,i)=>setTimeout(()=>el.classList.add('in'),i*70));
  wrvo.unobserve(e.target);
}),{threshold:.2});
wrvSections.forEach((_,par)=>wrvo.observe(par));

/* ══ MARQUEE ════════════════════════════════════════════════════════ */
(function buildTick(){
  /* Build with n duplicated sets and keep growing (in even increments to
     preserve the translateX(-50%) seamless-loop math) until one half of the
     track is wider than the viewport — otherwise a visible empty strip flashes
     at the loop boundary on narrow screens. */
  function fill(track, items){
    function set(n){
      let html='';
      for(let r=0;r<n;r++) items.forEach(it=>{ html+=`<span class="tick-item">${it}<span class="tick-dot"></span></span>`; });
      track.innerHTML=html;
    }
    let n=2;
    set(n);
    while((track.scrollWidth/2) < innerWidth + 100 && n < 16){
      n+=2;
      set(n);
    }
  }
  fill(document.getElementById('tick-track'),   ['Available for Work','<em>2026</em>','Cinematic 3D','<em>Beirut · Worldwide</em>','Frames per Second','<em>Multimedia Engineer</em>']);
  fill(document.getElementById('tick-track-2'), ['Render slow','<em>edit slower</em>','3DS Max · V-Ray','<em>PhoenixFD</em>','TyFlow','<em>Light · Smoke · Particles</em>']);
})();

/* ══ MAGNETIC HOVER ═══════════════════════════════════════════════ */
document.querySelectorAll('.ce, .soc, .mc, .mag').forEach(el=>{
  el.classList.add('mag');
  el.addEventListener('mousemove',e=>{
    const r=el.getBoundingClientRect();
    const x=(e.clientX-(r.left+r.width/2))*.3;
    const y=(e.clientY-(r.top+r.height/2))*.3;
    el.style.transform=`translate(${x}px,${y}px)`;
  });
  el.addEventListener('mouseleave',()=>{ el.style.transform=''; });
});

/* ══ CURSOR LABEL ══════════════════════════════════════════════════ */
const lblEl=document.getElementById('cur-lbl');
document.addEventListener('mousemove',e=>{ lblEl.style.left=e.clientX+'px'; lblEl.style.top=e.clientY+'px'; },{passive:true});
document.querySelectorAll('[data-cur]').forEach(el=>{
  el.addEventListener('mouseenter',()=>{ lblEl.textContent=el.dataset.cur; document.body.classList.add('ch-lbl'); });
  el.addEventListener('mouseleave',()=>document.body.classList.remove('ch-lbl'));
});
document.querySelectorAll('.pc').forEach(el=>{
  el.addEventListener('mouseenter',()=>{ lblEl.textContent='Open'; document.body.classList.add('ch-lbl'); });
  el.addEventListener('mouseleave',()=>document.body.classList.remove('ch-lbl'));
});

/* ══ RAIL TRACKING ═════════════════════════════════════════════════ */
const rails=[...document.querySelectorAll('.rail-i')];
function updateRail(){
  const y=window.scrollY+innerHeight*0.4;
  const secs=['hero','work','about','contact'].map(id=>{
    const el=document.getElementById(id);
    return {id, top:el.offsetTop, bot:el.offsetTop+el.offsetHeight};
  });
  // Find the section whose range contains y; if between sections, keep last active
  let active=null;
  for(const s of secs){ if(y>=s.top && y<s.bot){ active=s.id; break; } }
  if(!active){
    // Past end → last; before start → first
    if(y<secs[0].top) active='hero';
    else {
      // Use the closest section by top edge
      let best=secs[0], bd=Math.abs(y-secs[0].top);
      for(let i=1;i<secs.length;i++){
        const d=Math.abs(y-secs[i].top);
        if(d<bd){bd=d;best=secs[i];}
      }
      active=best.id;
    }
  }
  rails.forEach(r=>r.classList.toggle('on', r.dataset.r===active));
}
updateRail();
window.addEventListener('scroll',updateRail,{passive:true});
window.addEventListener('resize',updateRail);
// (legacy hero observer removed — single observer above handles all sections)

/* ══ CUSTOM CURSOR ══════════════════════════════════════════════════ */
const curEl=document.getElementById('cur'),curR=document.getElementById('cur-r');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;curEl.style.left=mx+'px';curEl.style.top=my+'px';},{passive:true});
(function ac(){rx+=(mx-rx)*.11;ry+=(my-ry)*.11;curR.style.left=rx+'px';curR.style.top=ry+'px';requestAnimationFrame(ac);})();
document.querySelectorAll('a,button,.pc').forEach(el=>{el.addEventListener('mouseenter',()=>document.body.classList.add('ch'));el.addEventListener('mouseleave',()=>document.body.classList.remove('ch'));});

/* ══ THREE.JS — ORGANIC KERNEL FIELD ═══════════════════════════════ */
let helixMats=[];
(function initThree(){
  const cv=document.getElementById('bg-cv');
  const renderer=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setSize(innerWidth,innerHeight);
  const scene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,200);
  cam.position.set(0,0,18);

  // Glow sprite — warm tint
  const gc=document.createElement('canvas'); gc.width=gc.height=64;
  const gx=gc.getContext('2d'),gr=gx.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,220,150,1)');gr.addColorStop(.25,'rgba(255,200,120,.7)');
  gr.addColorStop(.55,'rgba(255,160,90,.18)');gr.addColorStop(1,'rgba(255,140,60,0)');
  gx.fillStyle=gr;gx.fillRect(0,0,64,64);
  const sprite=new THREE.CanvasTexture(gc);

  /* Build a "kernel cob" — radial rows of points wrapped around a vertical axis,
     evoking corn-husk geometry without literal representation. */
  const ROWS=42, PER_ROW=22, H=20, R0=2.4;
  const kernels=[];
  for(let r=0;r<ROWS;r++){
    const yT=r/(ROWS-1);
    const y=(yT-.5)*H;
    // Slight cob taper
    const taper=1 - Math.pow(Math.abs(yT-.5)*1.6,3.2);
    const radius=R0*Math.max(.55,taper);
    const offset=(r%2)*(Math.PI/PER_ROW); // brick stagger
    for(let k=0;k<PER_ROW;k++){
      const a=k/PER_ROW*Math.PI*2 + offset + r*0.025;
      kernels.push(Math.cos(a)*radius, y, Math.sin(a)*radius);
    }
  }

  // Ambient particles drifting around
  const amb=[];
  for(let i=0;i<280;i++){
    const t=Math.random();
    const a=Math.random()*Math.PI*2;
    const spread=R0+1.2+Math.random()*5;
    amb.push(Math.cos(a)*spread,(t-.5)*H*1.2,Math.sin(a)*spread);
  }

  // Lines connecting near-neighbor kernels (sparse)
  const ln=[];
  for(let r=0;r<ROWS-1;r++){
    for(let k=0;k<PER_ROW;k++){
      if(Math.random()>.7) continue;
      const i1=r*PER_ROW+k, i2=(r+1)*PER_ROW+k;
      ln.push(kernels[i1*3],kernels[i1*3+1],kernels[i1*3+2], kernels[i2*3],kernels[i2*3+1],kernels[i2*3+2]);
    }
  }

  const mkPts=(arr,sz,op,col)=>{
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
    const m=new THREE.PointsMaterial({color:col||0xffd58a,size:sz,map:sprite,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true});
    helixMats.push(m); return new THREE.Points(g,m);
  };
  const cob=mkPts(kernels,.22,.85,0xf7c871);
  const ambPts=mkPts(amb,.24,.78,0xf4ead8);

  const lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.Float32BufferAttribute(ln,3));
  const lm=new THREE.LineBasicMaterial({color:0xc64d2a,transparent:true,opacity:.18});
  helixMats.push(lm);
  const lines=new THREE.LineSegments(lg,lm);

  const grp=new THREE.Group();
  grp.add(cob,lines,ambPts);
  grp.position.set(5.5,0,0);
  grp.rotation.z=-0.12;
  scene.add(grp);

  const ambGeo=ambPts.geometry, ambBase=new Float32Array(amb);

  let tRX=0,tRY=0,cRX=0,cRY=0,autoY=0;
  document.addEventListener('mousemove',e=>{
    tRY=(e.clientX/innerWidth-.5)*.55;
    tRX=-(e.clientY/innerHeight-.5)*.28;
  },{passive:true});

  window.addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

  function draw(t){
    requestAnimationFrame(draw);
    autoY+=.0028;
    cRY+=(tRY-cRY)*.05; cRX+=(tRX-cRX)*.05;
    const sp=Math.min(1,window.scrollY/Math.max(1,document.body.scrollHeight-innerHeight));
    grp.rotation.y=autoY+cRY+sp*Math.PI*2.5;
    grp.rotation.x=cRX-0.05+sp*.18;
    grp.position.y=Math.sin(autoY*.4)*.5+sp*-2.2;
    grp.position.x=5.5-sp*3;

    const pa=ambGeo.attributes.position;
    for(let i=0;i<280;i++){
      pa.setX(i,ambBase[i*3]+Math.sin(autoY*1.1+i*.73)*.95);
      pa.setY(i,ambBase[i*3+1]+Math.cos(autoY*.8+i*.51)*.6);
    }
    pa.needsUpdate=true;
    renderer.render(scene,cam);
  }
  draw(0);
})();

/* ══ HERO TITLE — MAGNETIC LETTER DISTORT (Corn Rev style) ═════════ */
(function initTitleMagnetic(){
  const heroEl=document.getElementById('hero');
  const nameEl=document.getElementById('h-name');
  const chars=[...nameEl.querySelectorAll('.h-char')];
  // Each char gets independent target/current offset & scale
  const state=chars.map(c=>({
    el:c, tx:0,ty:0,ts:1,tr:0,
    cx:0,cy:0,cs:1,cr:0
  }));
  let mouseX=-9999, mouseY=-9999, hovering=false;
  const PULL=80;        // max px a char can travel toward cursor
  const RANGE=320;      // influence radius
  const SCALE_BOOST=.55; // extra scale on closest char
  const ROT_RANGE=12;   // deg rotation toward cursor

  heroEl.addEventListener('mouseenter',()=>{ hovering=true; });
  heroEl.addEventListener('mouseleave',()=>{
    hovering=false; mouseX=-9999; mouseY=-9999;
  });
  heroEl.addEventListener('mousemove',e=>{
    mouseX=e.clientX; mouseY=e.clientY;
  });

  function compute(){
    state.forEach(s=>{
      const r=s.el.getBoundingClientRect();
      const cx=r.left+r.width/2, cy=r.top+r.height/2;
      let tx=0,ty=0,ts=1,tr=0;
      if(hovering && mouseX>-9000){
        const dx=mouseX-cx, dy=mouseY-cy, d=Math.sqrt(dx*dx+dy*dy);
        if(d<RANGE){
          const t=1-d/RANGE, e=t*t*(3-2*t);
          // Pull toward cursor
          tx=(dx/Math.max(d,1))*PULL*e;
          ty=(dy/Math.max(d,1))*PULL*e;
          ts=1+SCALE_BOOST*e;
          tr=(dx/Math.max(d,1))*ROT_RANGE*e;
        }
      }
      s.tx=tx; s.ty=ty; s.ts=ts; s.tr=tr;
      // Lerp toward target
      s.cx+=(s.tx-s.cx)*.18;
      s.cy+=(s.ty-s.cy)*.18;
      s.cs+=(s.ts-s.cs)*.18;
      s.cr+=(s.tr-s.cr)*.18;
      s.el.style.transform=`translate3d(${s.cx.toFixed(2)}px,${s.cy.toFixed(2)}px,0) scale(${s.cs.toFixed(3)}) rotate(${s.cr.toFixed(2)}deg)`;
    });
    requestAnimationFrame(compute);
  }
  // Wait until intro reveal sets char baseline transforms
  setTimeout(()=>{
    chars.forEach(c=>{ c.style.transition='transform .2s ease, opacity .8s ease'; c.style.willChange='transform'; });
    compute();
  },2400);
})();

/* ══ (legacy) TEXT PARTICLE EFFECT — disabled ═════════════════════ */
(function initTextFx(){
  return;
  const heroEl=document.getElementById('hero');
  const nameEl=document.getElementById('h-name');
  const cv=document.getElementById('txt-cv');
  const ctx=cv.getContext('2d');
  let parts=[],active=false,raf2;
  let mouseX=-9999,mouseY=-9999;
  const REVEAL_R=180, SCATTER_R=60, CONN_DIST=52, MAX_CONN=2;

  function buildParts(){
    cv.width=innerWidth; cv.height=innerHeight;
    const rect=nameEl.getBoundingClientRect();
    const cs=getComputedStyle(nameEl);
    const fs=parseFloat(cs.fontSize), fw=cs.fontWeight||'900', ff=cs.fontFamily;
    const oc=document.createElement('canvas'); oc.width=cv.width; oc.height=cv.height;
    const ox=oc.getContext('2d');
    ox.font=`${fw} ${fs}px ${ff}`;
    if('letterSpacing' in ox) ox.letterSpacing=`${-0.04*fs}px`;
    ox.strokeStyle='rgba(255,255,255,1)';
    ox.lineWidth=Math.max(1.4,fs*.018);
    ox.textAlign='left'; ox.textBaseline='middle';
    ox.strokeText('Arz Abou Rached',rect.left,rect.top+rect.height/2);
    const id=ox.getImageData(0,0,cv.width,cv.height), d=id.data;
    const pts=[]; const STEP=Math.max(4,Math.round(fs*.045));
    for(let x=0;x<cv.width;x+=STEP)for(let y=0;y<cv.height;y+=STEP){
      const i=(y*cv.width+x)*4;
      if(d[i+3]>90) pts.push({x,y,bx:x,by:y,vx:0,vy:0});
    }
    const MAX=540;
    if(pts.length>MAX){const st=Math.floor(pts.length/MAX);parts=pts.filter((_,i)=>i%st===0).slice(0,MAX);}
    else parts=pts;
  }

  function buildNeighbors(){
    parts.forEach(p=>{
      const dists=parts
        .map((q,qi)=>({qi,d2:(p.bx-q.bx)**2+(p.by-q.by)**2}))
        .filter(o=>o.d2>0 && o.d2<CONN_DIST*CONN_DIST)
        .sort((a,b)=>a.d2-b.d2)
        .slice(0,MAX_CONN)
        .map(o=>o.qi);
      p.neighbors=dists;
    });
  }

  function animParts(){
    if(!active)return;
    ctx.clearRect(0,0,cv.width,cv.height);
    parts.forEach(p=>{
      p.vx+=(p.bx-p.x)*.025; p.vy+=(p.by-p.y)*.025;
      p.vx*=.84; p.vy*=.84; p.x+=p.vx; p.y+=p.vy;
    });
    const RR=REVEAL_R;
    parts.forEach((p,i)=>{
      const dxp=p.x-mouseX, dyp=p.y-mouseY, dp=Math.sqrt(dxp*dxp+dyp*dyp);
      if(dp>RR) return;
      const tP=1-(dp/RR), eP=tP*tP*(3-2*tP);
      (p.neighbors||[]).forEach(qi=>{
        if(qi<=i) return;
        const q=parts[qi];
        const dxq=q.x-mouseX, dyq=q.y-mouseY, dq=Math.sqrt(dxq*dxq+dyq*dyq);
        if(dq>RR) return;
        const tQ=1-(dq/RR), eQ=tQ*tQ*(3-2*tQ);
        const a=Math.min(eP,eQ)*.28;
        ctx.beginPath();
        ctx.lineWidth=.7;
        ctx.strokeStyle=`rgba(247,200,113,${a.toFixed(3)})`;
        ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y);
        ctx.stroke();
      });
    });
    parts.forEach(p=>{
      const dx=p.x-mouseX, dy=p.y-mouseY, dist=Math.sqrt(dx*dx+dy*dy);
      if(dist>RR) return;
      const t=1-(dist/RR), e=t*t*(3-2*t);
      ctx.beginPath();
      ctx.fillStyle=`rgba(247,200,113,${(0.18+e*.78).toFixed(3)})`;
      ctx.arc(p.x,p.y,1.0+e*1.6,0,Math.PI*2);
      ctx.fill();
    });
    raf2=requestAnimationFrame(animParts);
  }

  function updateNameMask(){
    if(!active){ nameEl.style.webkitMaskImage='none'; return; }
    nameEl.style.webkitMaskImage=
      `radial-gradient(circle ${REVEAL_R*0.85}px at ${mouseX}px ${mouseY}px,
        transparent 0%, transparent 45%, black 85%)`;
    nameEl.style.maskImage=nameEl.style.webkitMaskImage;
  }

  heroEl.addEventListener('mousemove',e=>{
    mouseX=e.clientX; mouseY=e.clientY;
    updateNameMask();
    if(!active)return;
    parts.forEach(p=>{
      const dx=p.x-e.clientX, dy=p.y-e.clientY, d2=dx*dx+dy*dy;
      if(d2<SCATTER_R*SCATTER_R && d2>0){
        const dist=Math.sqrt(d2), f=(SCATTER_R-dist)/SCATTER_R*2.6;
        p.vx+=dx/dist*f; p.vy+=dy/dist*f;
      }
    });
  });

  // Hover particle effect disabled per request.
  return;
})();

/* ══ GRAIN ══════════════════════════════════════════════════════════ */
(function initGrain(){
  const cv=document.getElementById('grain'),ctx=cv.getContext('2d');
  function resize(){cv.width=innerWidth;cv.height=innerHeight;}
  resize(); window.addEventListener('resize',resize);
  let f=0;
  (function gen(){
    if(++f%3!==0){requestAnimationFrame(gen);return;}
    const id=ctx.createImageData(cv.width,cv.height),d=id.data;
    for(let i=0;i<d.length;i+=4){const v=Math.random()*255|0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}
    ctx.putImageData(id,0,0); requestAnimationFrame(gen);
  })();
  cv.style.opacity='.06';
})();

/* ══ TWEAKS ═════════════════════════════════════════════════════════ */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "variant": "b",
  "helixOpacity": "vivid",
  "grain": "high"
}/*EDITMODE-END*/;

let _baseOps = [];
function setVar(v){
  document.body.classList.toggle('vb',v==='b');
  document.getElementById('tc').classList.toggle('on',v==='c');
  document.getElementById('tb').classList.toggle('on',v==='b');
  window.parent.postMessage({type:'__edit_mode_set_keys',edits:{variant:v}},'*');
}
function setHelix(op){
  if(_baseOps.length===0) helixMats.forEach(m=>_baseOps.push(m.opacity));
  helixMats.forEach((m,i)=>{ m.opacity=_baseOps[i]*op; });
  const sub=op<.9;
  document.getElementById('tho').classList.toggle('on',sub);
  document.getElementById('thb').classList.toggle('on',!sub);
  window.parent.postMessage({type:'__edit_mode_set_keys',edits:{helixOpacity:sub?'subtle':'vivid'}},'*');
}
function setGrain(op){
  document.getElementById('grain').style.opacity=op;
  const low=op<.07;
  document.getElementById('tgl').classList.toggle('on',low);
  document.getElementById('tgh').classList.toggle('on',!low);
  window.parent.postMessage({type:'__edit_mode_set_keys',edits:{grain:low?'low':'high'}},'*');
}
setVar(TWEAK_DEFAULTS.variant==='b'?'b':'c');
setGrain(TWEAK_DEFAULTS.grain==='high'?.09:.04);
// helix opacity applied after three is initialized
setTimeout(()=>{ setHelix(TWEAK_DEFAULTS.helixOpacity==='subtle'?.5:1); },200);

window.addEventListener('message',e=>{
  if(e.data?.type==='__activate_edit_mode') document.getElementById('twk').classList.add('vis');
  if(e.data?.type==='__deactivate_edit_mode') document.getElementById('twk').classList.remove('vis');
});
window.parent.postMessage({type:'__edit_mode_available'},'*');
