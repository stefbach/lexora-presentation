/* ============================================================
   Lexora — Vidéo guidée : moteur "réalisateur"
   Pilote la présentation (iframe) : intro animée, doigt qui
   circule pour défiler, passage de page à page. Lent, pour
   pouvoir commenter en direct.
   ============================================================ */
(function(){
  'use strict';

  // ---- Géométrie de la scène (coordonnées stage 1920×1080) ----
  const IFRAME_X = 96;             // left du navigateur
  const IFRAME_Y = 64 + 52;        // top navigateur + barre
  const IFRAME_H = 836;

  // ---- Rythme (lent, pour la narration et la lecture) ----
  const INTRO = 7000;              // ms d'intro (titre)
  const PAGE_DUR = 22000;          // ms par page (défilement lent, temps de lire)

  // ---- Langue (FR / EN) — sélecteur intégré ----
  // Priorité : langue forcée par l'URL (pages /fr et /en via window.LEXORA_LANG)
  // puis langue mémorisée, sinon français par défaut.
  const FORCED = (window.LEXORA_LANG === 'en' || window.LEXORA_LANG === 'fr') ? window.LEXORA_LANG : null;
  let lang = FORCED || ((localStorage.getItem('lexora_video_lang') === 'en') ? 'en' : 'fr');
  // chemins absolus → fonctionnent depuis la racine comme depuis /fr et /en
  const SRC = { fr: '/presentation.html', en: '/presentation-en.html' };
  const I18N = {
    fr: { badge: "Intelligent Accounting · powered by AI",
          tagline: "L'ERP comptable piloté par l'IA — conçu pour l'Île Maurice" },
    en: { badge: "Intelligent Accounting · powered by AI",
          tagline: "The AI-driven accounting ERP — built for Mauritius" },
  };

  // ---- Pages parcourues (ordre du menu) ----
  // title / kicker sont bilingues : {fr, en}
  const PAGES = [
    {key:'intro',    title:{fr:"Vue d'ensemble",            en:"Overview"},                 kicker:{fr:"Panorama plateforme",       en:"Platform panorama"},     url:"lexora.finance/client/tableau-de-bord"},
    {key:'philo',    title:{fr:"La philosophie Lexora",     en:"The Lexora philosophy"},    kicker:{fr:"Le concept",                en:"The concept"},           url:"lexora.finance/client/philosophie"},
    {key:'compta',   title:{fr:"Comptabilité",              en:"Accounting"},               kicker:{fr:"Les modules",               en:"The modules"},           url:"lexora.finance/client/factures"},
    {key:'banque',   title:{fr:"Banque & Rapprochement IA", en:"Banking & AI Reconciliation"}, kicker:{fr:"Les modules",            en:"The modules"},           url:"lexora.finance/client/rapprochement"},
    {key:'mra',      title:{fr:"MRA & Fiscalité",           en:"MRA & Taxation"},           kicker:{fr:"Les modules",               en:"The modules"},           url:"lexora.finance/client/mra-hub"},
    {key:'ifrs',     title:{fr:"IFRS & Reporting",          en:"IFRS & Reporting"},         kicker:{fr:"Les modules",               en:"The modules"},           url:"lexora.finance/client/bilan"},
    {key:'gbc',      title:{fr:"GBC Offshore",              en:"GBC Offshore"},             kicker:{fr:"Les modules",               en:"The modules"},           url:"lexora.finance/client/gbc-per"},
    {key:'rh',       title:{fr:"RH & Paie",                 en:"HR & Payroll"},             kicker:{fr:"Les modules",               en:"The modules"},           url:"lexora.finance/rh"},
    {key:'stocks',   title:{fr:"Stocks & Inventaire",       en:"Stock & Inventory"},        kicker:{fr:"Les modules",               en:"The modules"},           url:"lexora.finance/client/stocks"},
    {key:'agents',   title:{fr:"Agents IA",                 en:"AI Agents"},                kicker:{fr:"Intelligence & pilotage",   en:"Intelligence & steering"}, url:"lexora.finance/client/agents"},
    {key:'mcp',      title:{fr:"MCP · Claude Desktop",      en:"MCP · Claude Desktop"},     kicker:{fr:"Intelligence & pilotage",   en:"Intelligence & steering"}, url:"lexora.finance/client/mcp-setup"},
    {key:'telegram', title:{fr:"Telegram",                  en:"Telegram"},                 kicker:{fr:"Intelligence & pilotage",   en:"Intelligence & steering"}, url:"lexora.finance/client/telegram"},
    {key:'archi',    title:{fr:"PCM & Architecture",        en:"PCM & Architecture"},       kicker:{fr:"Intelligence & pilotage",   en:"Intelligence & steering"}, url:"lexora.finance/client/architecture"},
    {key:'compare',  title:{fr:"Lexora vs Concurrents",     en:"Lexora vs Competitors"},    kicker:{fr:"Positionnement",            en:"Positioning"},           url:"lexora.finance/client/comparatif"},
  ];
  const N = PAGES.length;

  // ---- Durées par page : calculées selon la densité de contenu ----
  // (temps de base de lecture + temps proportionnel à la hauteur à défiler)
  const BASE_MS   = 10000;   // temps plancher de lecture (haut + bas de page)
  const MS_PER_PX = 26;      // ms par pixel à défiler → vitesse de scroll lente/lisible
  const MIN_MS    = 14000;   // durée minimale d'une page
  const MAX_MS    = 46000;   // durée maximale d'une page
  let durs   = new Array(N).fill(PAGE_DUR);   // valeurs par défaut (avant mesure)
  let starts = new Array(N).fill(0);
  let TOTAL  = INTRO + N * PAGE_DUR;
  let measured = false;

  function recomputeTimeline(){
    let acc = INTRO;
    for(let i=0;i<N;i++){ starts[i]=acc; acc+=durs[i]; }
    TOTAL = acc;
  }
  recomputeTimeline();

  // ---- Éléments ----
  const stage   = document.getElementById('stage');
  const browser = document.getElementById('browser');
  const appFr   = document.getElementById('app');
  const curtain = document.getElementById('curtain');
  const badge   = curtain.querySelector('.badge');
  const tagline = document.getElementById('tagline');
  const letters = [...document.querySelectorAll('#title .ltr')];
  const cursor  = document.getElementById('cursor');
  const ring    = document.getElementById('ring');
  const chapter = document.getElementById('chapter');
  const burl    = document.getElementById('burl');
  const fill    = document.getElementById('fill');
  const ticks   = document.getElementById('ticks');
  const timeEl  = document.getElementById('time');
  const chips   = document.getElementById('chips');
  const btnPlay = document.getElementById('btnPlay');
  const btnRestart = document.getElementById('btnRestart');
  const langBtns = [...document.querySelectorAll('#lang button')];

  // ---- Easings ----
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const easeInOut = t=> t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
  const easeOut = t=> 1-Math.pow(1-t,3);
  const lerp = (a,b,t)=>a+(b-a)*t;

  // ---- État ----
  let appWin=null, appDoc=null, ready=false;
  let renderedPage=-1;
  let elapsed=0, playing=true, last=performance.now();

  // ===== Mise à l'échelle du stage =====
  function fit(){
    const s = Math.min(window.innerWidth/1920, (window.innerHeight-110)/1080);
    stage.style.transform = 'scale('+s+')';
  }
  window.addEventListener('resize', fit); fit();

  // ===== iframe prête =====
  appFr.addEventListener('load', ()=>{
    appWin = appFr.contentWindow;
    appDoc = appFr.contentDocument;
    // pas de défilement "smooth" interne : on pilote le scroll image par image
    try{
      appDoc.documentElement.style.scrollBehavior='auto';
      appDoc.body.style.scrollBehavior='auto';
    }catch(e){}
    ready = true;
    measured = false;            // re-mesure à chaque (re)chargement / changement de langue
    renderedPage = -1;           // force le re-rendu de la page courante
    // Mesure la densité de chaque page pour adapter sa durée
    setTimeout(measureDurations, 120);
  });

  // ===== Mesure la hauteur de contenu de chaque page =====
  function measureDurations(){
    if(!ready || measured) return;
    for(let i=0;i<N;i++){
      const it = getItem(PAGES[i].key);
      if(it){ it.click(); }
      const sh = appDoc.documentElement.scrollHeight;
      const mx = Math.max(0, sh - IFRAME_H);
      let d = BASE_MS + mx * MS_PER_PX;
      durs[i] = Math.round(clamp(d, MIN_MS, MAX_MS));
    }
    measured = true;
    recomputeTimeline();
    buildChips();
    // remet la 1re page et neutralise le défilement interne
    const it0 = getItem(PAGES[0].key); if(it0){ it0.click(); }
    setScroll(0);
    renderedPage = -1;
  }

  // ===== Navigation dans la présentation =====
  function getItem(key){ return appDoc && appDoc.querySelector('.nav-item[data-p="'+key+'"]'); }
  function getRail(){ return appDoc && appDoc.querySelector('.rail'); }

  function railToItem(key, center){
    const it = getItem(key), rail = getRail();
    if(!it||!rail) return;
    const target = it.offsetTop - rail.clientHeight*(center?0.5:0.42) + it.offsetHeight/2;
    rail.scrollTop = clamp(target, 0, rail.scrollHeight - rail.clientHeight);
  }
  function navStagePos(key){
    const it = getItem(key);
    if(!it) return {x:IFRAME_X+130, y:IFRAME_Y+120};
    const r = it.getBoundingClientRect();
    return { x: IFRAME_X + r.left + 26, y: IFRAME_Y + r.top + r.height/2 };
  }
  function switchPage(i){
    const p = PAGES[i], it = getItem(p.key);
    if(it){ it.click(); }
    railToItem(p.key, false);
    burl.textContent = p.url;
    updateChapter(i);
  }
  function setScroll(y){ if(appWin) appWin.scrollTo(0, y); }
  function maxScroll(){
    if(!appDoc) return 0;
    return Math.max(0, appDoc.documentElement.scrollHeight - IFRAME_H);
  }

  // ===== Chapitre (bas de cadre) =====
  function updateChapter(i){
    const p = PAGES[i];
    chapter.querySelector('.idx').textContent = String(i+1).padStart(2,'0');
    chapter.querySelector('.ct').textContent = p.kicker[lang];
    chapter.querySelector('.cn').textContent = p.title[lang];
    chapter.animate(
      [{opacity:0, transform:'translateY(16px)'},{opacity:1, transform:'translateY(0)'}],
      {duration:560, easing:'cubic-bezier(.22,.61,.36,1)', fill:'forwards'}
    );
    chips.querySelectorAll('.chip').forEach((c,k)=>c.classList.toggle('on', k===i));
  }

  // ===== Curseur (doigt) =====
  function placeCursor(x,y,press){
    cursor.style.transform = 'translate('+x+'px,'+y+'px) scale('+(press?0.86:1)+')';
  }
  function showCursor(v){ cursor.style.opacity = v?1:0; }

  // ===== INTRO (titre animé) =====
  function renderIntro(f){          // f: 0..1
    curtain.style.display='flex';
    curtain.style.opacity = f>0.86 ? clamp((1-f)/0.14,0,1) : 1;
    showCursor(false);
    chapter.style.opacity = 0;
    // navigateur révélé en fond pendant la sortie d'intro
    const bShow = clamp((f-0.78)/0.22,0,1);
    browser.style.opacity = bShow;
    browser.style.transform = 'translateY('+lerp(26,0,bShow)+'px) scale('+lerp(.985,1,bShow)+')';

    badge.style.opacity = clamp((f-0.04)/0.10,0,1);
    // lettres en cascade
    letters.forEach((el,i)=>{
      const start = 0.10 + i*0.075;
      const p = clamp((f-start)/0.20, 0, 1);
      const e = easeOut(p);
      // mouvement perpétuel léger (les lettres "bougent")
      const wob = p>=1 ? Math.sin(performance.now()/640 + i*0.9) : 0;
      const ty = lerp(70,0,e) + wob*5;
      const rot = lerp(-14,0,e) + wob*2.2;
      const sc = lerp(0.6,1,e);
      el.style.opacity = p;
      el.style.transform = 'translateY('+ty+'px) rotate('+rot+'deg) scale('+sc+')';
    });
    tagline.style.opacity = clamp((f-0.58)/0.16,0,1);
    const tl = clamp((f-0.58)/0.16,0,1);
    tagline.style.transform = 'translateY('+lerp(18,0,easeOut(tl))+'px)';
  }

  // ===== Parcours (page par page) =====
  function renderWalk(t){
    curtain.style.opacity = 0; curtain.style.display='none';
    browser.style.opacity = 1; browser.style.transform='none';

    // page courante d'après la timeline à durées variables
    let i = 0;
    while(i < N-1 && t >= starts[i+1]) i++;
    const dur = durs[i];
    const frac = clamp((t - starts[i]) / dur, 0, 1);

    if(renderedPage !== i){ switchPage(i); renderedPage = i; }

    // ---- défilement (lent, linéaire, pauses de lecture haut ET bas) ----
    // 0–0.12 : lecture du haut · 0.12–0.74 : défilement régulier
    // 0.74–0.86 : lecture du bas · 0.86–1 : passage à la page suivante
    const mx = maxScroll();
    let sy;
    if(frac < 0.12) sy = 0;
    else if(frac < 0.74) sy = mx * ((frac-0.12)/0.62);
    else sy = mx;
    setScroll(sy);

    // ---- doigt ----
    showCursor(true);
    const now = performance.now();
    let fx, fy, press=false, rScale=0.3, rOp=0;

    if(frac < 0.12){
      // entrée depuis le bas-droite
      const p = easeOut(frac/0.12);
      fx = lerp(IFRAME_X+1560, IFRAME_X+1180, p);
      fy = lerp(IFRAME_Y+940,  IFRAME_Y+250, p);
    } else if(frac < 0.74){
      // circule doucement en suivant le scroll
      const sp = (frac-0.12)/0.62;
      const baseX = IFRAME_X + 1190;
      const baseY = IFRAME_Y + 250 + sp*430;
      fx = baseX + Math.cos(now/1000)*38;
      fy = baseY + Math.sin(now/1000)*48;
    } else if(frac < 0.86){
      // reste près du bas, mouvement très calme (lecture du bas de page)
      fx = IFRAME_X + 1190 + Math.cos(now/1100)*30;
      fy = IFRAME_Y + 690  + Math.sin(now/1100)*34;
    } else {
      // se dirige vers la page suivante et tape
      const pp = (frac-0.86)/0.14;
      const nextKey = PAGES[(i+1)%N].key;
      railToItem(nextKey, true);
      const tgt = navStagePos(nextKey);
      const fromX = IFRAME_X + 1190, fromY = IFRAME_Y + 690;
      const e = easeInOut(clamp(pp/0.78,0,1));
      fx = lerp(fromX, tgt.x, e);
      fy = lerp(fromY, tgt.y, e);
      // onde + pression près de l'impact
      const rp = clamp((pp-0.74)/0.26, 0, 1);
      if(rp>0){ press = rp<0.6; rScale = lerp(0.3,2.3,rp); rOp = (1-rp)*0.9; }
    }
    placeCursor(fx, fy, press);
    ring.style.opacity = rOp;
    ring.style.transform = 'translate('+fx+'px,'+fy+'px) scale('+rScale+')';
  }

  // ===== Boucle =====
  function render(){
    if(elapsed < INTRO) renderIntro(elapsed/INTRO);
    else if(ready) renderWalk(elapsed);
    // HUD
    fill.style.width = (elapsed/TOTAL*100)+'%';
    timeEl.textContent = fmt(elapsed)+' / '+fmt(TOTAL);
  }
  function fmt(ms){ const s=Math.floor(ms/1000); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }

  function loop(now){
    const dt = now - last; last = now;
    if(playing){
      elapsed += dt;
      if(elapsed >= TOTAL){ elapsed = TOTAL; setPlaying(false); }
    }
    render();
    if(now % 8 < 4) localStorage.setItem('lexora_video_t', String(Math.floor(elapsed)));
    requestAnimationFrame(loop);
  }

  // ===== Contrôles =====
  function setPlaying(v){ playing=v; btnPlay.textContent = v?'⏸':'▶'; }
  btnPlay.addEventListener('click', ()=>{
    if(elapsed>=TOTAL){ seek(0); setPlaying(true); }
    else setPlaying(!playing);
  });
  btnRestart.addEventListener('click', ()=>{ seek(0); setPlaying(true); });
  function seek(t){
    elapsed = clamp(t,0,TOTAL);
    renderedPage = -1;            // force le re-rendu de page
    last = performance.now();
    render();
  }
  document.getElementById('track').addEventListener('click', (e)=>{
    const r = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX-r.left)/r.width)*TOTAL);
  });
  document.addEventListener('keydown', (e)=>{
    if(e.code==='Space'){ e.preventDefault(); btnPlay.click(); }
    else if(e.code==='ArrowRight') seek(elapsed+5000);
    else if(e.code==='ArrowLeft') seek(elapsed-5000);
  });

  // ===== Langue (FR / EN) =====
  // Applique les textes statiques (badge + tagline d'intro) selon la langue.
  function applyStaticLang(){
    document.documentElement.lang = lang;
    badge.textContent = I18N[lang].badge;
    tagline.innerHTML = I18N[lang].tagline + '<span id="tdot"></span>';
    langBtns.forEach(b=>b.classList.toggle('on', b.dataset.lang===lang));
  }
  function setLang(l){
    if(l!=='fr' && l!=='en') return;
    const changed = (l!==lang);
    lang = l;
    localStorage.setItem('lexora_video_lang', lang);
    applyStaticLang();
    buildChips();                 // libellés des chapitres dans la nouvelle langue
    if(renderedPage>=0) updateChapter(renderedPage);
    if(changed){
      // recharge la présentation dans la bonne langue → re-mesure des durées
      ready = false; measured = false; renderedPage = -1;
      appFr.src = SRC[lang];
    }
  }
  langBtns.forEach(b=> b.addEventListener('click', ()=> setLang(b.dataset.lang)) );

  // ===== Chips chapitres + ticks (positions selon la timeline réelle) =====
  function buildChips(){
    chips.innerHTML = ''; ticks.innerHTML = '';
    PAGES.forEach((p,i)=>{
      const c = document.createElement('div');
      c.className='chip'; c.textContent=(i+1)+'. '+p.title[lang];
      c.addEventListener('click', ()=>{ seek(starts[i]); setPlaying(true); });
      chips.appendChild(c);
      const tk = document.createElement('div');
      tk.className='tk'; tk.style.left = (starts[i]/TOTAL*100)+'%';
      ticks.appendChild(tk);
    });
  }
  buildChips();

  // ===== Démarrage =====
  applyStaticLang();
  // pointe l'iframe vers la présentation dans la langue mémorisée
  if(appFr.getAttribute('src') !== SRC[lang]) appFr.src = SRC[lang];
  const saved = parseInt(localStorage.getItem('lexora_video_t')||'0',10);
  if(saved>0 && saved<TOTAL) elapsed = saved;
  setPlaying(true);
  requestAnimationFrame(loop);

  // hook de vérification (sans effet sur la lecture)
  window.LexoraVideo = { seek, render, setLang, get lang(){return lang;}, get t(){return elapsed;}, get TOTAL(){return TOTAL;}, get durs(){return durs;}, get starts(){return starts;}, get measured(){return measured;} };
})();
