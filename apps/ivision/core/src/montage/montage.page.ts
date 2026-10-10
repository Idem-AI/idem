/**
 * Le lecteur du montage (style et script de la page), embarqué tel quel dans le HTML.
 *
 * Écrit en JavaScript simple, sans dépendance : la page n'a qu'une vidéo, des sous-titres et des
 * cartes. Tout est calculé depuis t (`draw(t)`), jamais depuis une horloge : la même image sort
 * de l'aperçu et du rendu. Pas de littéraux de gabarit ici (le texte est lui-même un gabarit).
 */

export const MONTAGE_PAGE_STYLE = String.raw`
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0b0d10;overflow:hidden}
#stage{position:relative;width:var(--w);height:var(--h);overflow:hidden;background:#000;font-family:var(--f-body)}
#cam{position:absolute;inset:0;transform-origin:50% 38%;will-change:transform}
#cam video{width:100%;height:100%;object-fit:cover;display:block}
.el{position:absolute;opacity:0;will-change:transform,opacity}
#cap{position:absolute;left:7%;right:7%;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;text-align:center;gap:0 calc(var(--u)*1.4);pointer-events:none}
#cap .w{display:inline-block;transition:none}
#cap.pop{font-family:var(--f-display);font-weight:800;font-size:calc(var(--u)*7.4);line-height:1.12;text-transform:uppercase;color:#fff;-webkit-text-stroke:calc(var(--u)*0.32) #000;paint-order:stroke fill;text-shadow:0 calc(var(--u)*0.5) calc(var(--u)*1.6) rgba(0,0,0,.55)}
#cap.pop .w.on{background:var(--accent);color:var(--on-accent);-webkit-text-stroke:0;text-shadow:none;border-radius:calc(var(--u)*1.2);padding:0 calc(var(--u)*1.1)}
#cap.karaoke{font-family:var(--f-display);font-weight:750;font-size:calc(var(--u)*5.4);line-height:1.18;color:#fff;-webkit-text-stroke:calc(var(--u)*0.22) #000;paint-order:stroke fill;text-shadow:0 calc(var(--u)*0.4) calc(var(--u)*1.4) rgba(0,0,0,.6)}
#cap.karaoke .w.next{opacity:.55}
#cap.karaoke .w.on{color:var(--accent-text)}
#cap.minimal{font-family:var(--f-body);font-weight:600;font-size:calc(var(--u)*4.2);line-height:1.3;color:#fff}
#cap.minimal .box{background:rgba(17,20,24,.66);border-radius:calc(var(--u)*1.6);padding:calc(var(--u)*1) calc(var(--u)*2.2)}
.card{background:var(--bg);color:var(--text);border-radius:calc(var(--u)*3);box-shadow:0 calc(var(--u)*1.4) calc(var(--u)*4) rgba(0,0,0,.28)}
.kw{left:5%;right:5%;text-align:center;font-family:var(--f-display);font-weight:900;font-size:calc(var(--u)*13);line-height:1;text-transform:uppercase;color:#fff;-webkit-text-stroke:calc(var(--u)*0.4) #000;paint-order:stroke fill;text-shadow:0 calc(var(--u)*0.8) calc(var(--u)*2.4) rgba(0,0,0,.5)}
.kw i{display:block;height:calc(var(--u)*1.4);width:30%;margin:calc(var(--u)*2) auto 0;background:var(--accent);border-radius:99px}
.stat{left:50%;padding:calc(var(--u)*3) calc(var(--u)*5);text-align:center;min-width:46%}
.stat b{display:block;font-family:var(--f-display);font-weight:900;font-size:calc(var(--u)*14);line-height:1;color:var(--brand-on-light)}
.stat span{display:block;margin-top:calc(var(--u)*1.2);font-size:calc(var(--u)*4.2);font-weight:600}
.icon{left:50%;display:flex;align-items:center;gap:calc(var(--u)*2.2)}
.icon .disc{width:calc(var(--u)*15);height:calc(var(--u)*15);border-radius:50%;background:var(--primary);color:var(--on-primary);display:flex;align-items:center;justify-content:center;box-shadow:0 calc(var(--u)*1) calc(var(--u)*3) rgba(0,0,0,.3)}
.icon .disc svg{width:52%;height:52%}
.icon .lbl{padding:calc(var(--u)*1.6) calc(var(--u)*2.8);font-family:var(--f-display);font-weight:800;font-size:calc(var(--u)*4.6)}
.list{left:8%;right:8%;padding:calc(var(--u)*3.6) calc(var(--u)*4.2)}
.list h3{font-family:var(--f-display);font-weight:800;font-size:calc(var(--u)*5);color:var(--brand-on-light);margin-bottom:calc(var(--u)*1.6)}
.list li{list-style:none;display:flex;align-items:center;gap:calc(var(--u)*2);font-size:calc(var(--u)*4.6);font-weight:650;padding:calc(var(--u)*1.1) 0}
.list li:before{content:"";flex:none;width:calc(var(--u)*2.4);height:calc(var(--u)*2.4);border-radius:50%;background:var(--accent)}
.callout{left:8%;right:8%;padding:calc(var(--u)*3.4) calc(var(--u)*4);border-left:calc(var(--u)*1.4) solid var(--accent);font-family:var(--f-display);font-weight:800;font-size:calc(var(--u)*5.6);line-height:1.15}
.broll.card-mode{left:14%;right:14%;aspect-ratio:4/3;overflow:hidden;border:calc(var(--u)*0.9) solid #fff;border-radius:calc(var(--u)*3)}
.broll.full-mode{inset:0}
.broll img,.broll video{width:100%;height:100%;object-fit:cover;display:block}
.lt{left:7%;max-width:86%}
.lt b{display:inline-block;background:var(--primary);color:var(--on-primary);font-family:var(--f-display);font-weight:800;font-size:calc(var(--u)*5.2);padding:calc(var(--u)*1.2) calc(var(--u)*2.6);border-radius:calc(var(--u)*1.2) calc(var(--u)*1.2) calc(var(--u)*1.2) 0}
.lt span{display:block;width:max-content;max-width:100%;background:var(--bg);color:var(--text);font-size:calc(var(--u)*3.6);font-weight:600;padding:calc(var(--u)*0.9) calc(var(--u)*2.6);border-radius:0 0 calc(var(--u)*1.2) calc(var(--u)*1.2)}
.cta{left:50%;text-align:center}
.cta b{display:inline-block;background:var(--accent);color:var(--on-accent);font-family:var(--f-display);font-weight:900;font-size:calc(var(--u)*6);padding:calc(var(--u)*1.8) calc(var(--u)*4.2);border-radius:99px;box-shadow:0 calc(var(--u)*1) calc(var(--u)*3) rgba(0,0,0,.3)}
.cta span{display:block;margin:calc(var(--u)*1.4) auto 0;width:max-content;background:var(--bg);color:var(--text);font-weight:700;font-size:calc(var(--u)*4);padding:calc(var(--u)*0.9) calc(var(--u)*2.6);border-radius:99px}
#logo{position:absolute;right:6%;background:rgba(255,255,255,.92);border-radius:calc(var(--u)*1.6);padding:calc(var(--u)*1) calc(var(--u)*1.6);display:flex;align-items:center}
#logo img{height:calc(var(--u)*4.2);width:auto;max-width:calc(var(--u)*24);object-fit:contain;display:block}
#bar{position:absolute;left:0;top:0;height:calc(var(--u)*0.7);background:var(--accent);width:0}
#intro{position:absolute;inset:0;background:var(--primary);color:var(--on-primary);display:flex;flex-direction:column;justify-content:center;padding:0 9%;overflow:hidden;will-change:transform}
#intro .k{display:inline-block;align-self:flex-start;background:var(--accent);color:var(--on-accent);font-weight:800;font-size:calc(var(--u)*3.8);letter-spacing:.06em;text-transform:uppercase;padding:calc(var(--u)*0.8) calc(var(--u)*2);border-radius:99px;margin-bottom:calc(var(--u)*3)}
#intro h1{font-family:var(--f-display);font-weight:900;font-size:calc(var(--u)*11);line-height:1.02;letter-spacing:-.01em}
#intro h1 span{display:inline-block;margin-right:.22em}
#intro .rule{height:calc(var(--u)*1.2);background:var(--accent);border-radius:99px;margin-top:calc(var(--u)*4);width:0}
#intro img{position:absolute;left:9%;bottom:9%;height:calc(var(--u)*7);width:auto;max-width:40%;object-fit:contain;background:rgba(255,255,255,.92);border-radius:calc(var(--u)*1.4);padding:calc(var(--u)*1.2) calc(var(--u)*1.8)}
#outro{position:absolute;inset:0;background:var(--bg);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(var(--u)*3.4);padding:0 10%;text-align:center;opacity:0}
#outro img{max-width:44%;max-height:22%;object-fit:contain}
#outro h2{font-family:var(--f-display);font-weight:900;font-size:calc(var(--u)*7.6);line-height:1.08;color:var(--brand-on-light)}
#outro p{font-size:calc(var(--u)*4.4);font-weight:600}
#outro hr{border:0;width:18%;height:calc(var(--u)*1);border-radius:99px;background:var(--accent)}
body.preview{display:flex;align-items:center;justify-content:center;height:100vh;background:transparent}
.pv-wrap{position:relative;overflow:hidden;border-radius:14px}
.pv-ui{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(transparent,rgba(0,0,0,.55));font:600 12px system-ui,sans-serif;color:#fff;z-index:5}
.pv-btn{width:32px;height:32px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:#111;font-size:12px;cursor:pointer}
.pv-bar{flex:1;height:6px;border-radius:99px;background:rgba(255,255,255,.3);cursor:pointer}
.pv-fill{height:100%;border-radius:99px;background:#fff;width:0}
.pv-big{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:72px;height:72px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:#111;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5}
`;

export const MONTAGE_PAGE_SCRIPT = String.raw`
(function(){
var D=window.__MONTAGE__;var W=D.width,H=D.height,U=Math.min(W,H)/100;
var C=D.colors;var root=document.documentElement.style;
root.setProperty('--primary',C.primary);root.setProperty('--accent',C.accent);root.setProperty('--bg',C.background);root.setProperty('--text',C.text);
root.setProperty('--on-primary',C.onPrimary);root.setProperty('--on-accent',C.onAccent);root.setProperty('--brand-on-light',C.brandOnLight);
root.setProperty('--accent-text',C.accent);
var story=H/W>1.5,land=D.landscape;
// Zones : haut (sous l'interface des réseaux), sous-titres, bas.
var safeTop=H*(story?0.12:0.08),capY=H*(story?0.69:land?0.8:0.76);
function clamp(x){return x<0?0:x>1?1:x}
function easeOut(x){x=clamp(x);return 1-Math.pow(1-x,3)}
function back(x){x=clamp(x);var c=1.6;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)}
function el(tag,cls,html){var n=document.createElement(tag);if(cls)n.className=cls;if(html!=null)n.innerHTML=html;return n}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

var stage=el('div');stage.id='stage';document.body.appendChild(stage);
var cam=el('div');cam.id='cam';stage.appendChild(cam);
var video=document.createElement('video');video.muted=D.mode!=='preview';video.playsInline=true;video.preload='auto';
if(D.poster)video.poster=D.poster;video.src=D.video;cam.appendChild(video);
var layer=el('div');stage.appendChild(layer);

// Les éléments : un nœud chacun, posé une fois ; draw(t) ne change que l'opacité et la transformation.
var nodes=D.elements.map(function(e){
  var n,place='top';
  if(e.type==='keyword'){n=el('div','el kw',esc(e.text)+'<i></i>');place='center'}
  else if(e.type==='stat'){n=el('div','el card stat','<b>'+esc(e.value)+'</b>'+(e.label?'<span>'+esc(e.label)+'</span>':''));place='center'}
  else if(e.type==='icon'){n=el('div','el icon','<div class="disc">'+(e.icon||'')+'</div>'+(e.label?'<div class="card lbl">'+esc(e.label)+'</div>':''))}
  else if(e.type==='list'){n=el('div','el card list',(e.text?'<h3>'+esc(e.text)+'</h3>':'')+'<ul>'+(e.items||[]).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul>')}
  else if(e.type==='callout'){n=el('div','el card callout',esc(e.text))}
  else if(e.type==='broll'){n=el('div','el broll '+(e.mode==='full'?'full-mode':'card-mode'),e.video?'<video muted playsinline preload="auto" src="'+esc(e.video)+'"'+(e.poster?' poster="'+esc(e.poster)+'"':'')+'></video>':e.image?'<img alt="" src="'+esc(e.image)+'">':'');place=e.mode==='full'?'full':'top'}
  else if(e.type==='lowerThird'){n=el('div','el lt','<b>'+esc(e.value)+'</b>'+(e.label?'<span>'+esc(e.label)+'</span>':''));place='lower'}
  else if(e.type==='cta'){n=el('div','el cta','<b>'+esc(e.text)+'</b>'+(e.value?'<span>'+esc(e.value)+'</span>':''))}
  else return null;
  // Paysage : les cartes du haut passent dans le tiers droit (la personne est au centre).
  var side=land&&place==='top';
  if(place==='center')n.style.top=(capY-H*0.07)+'px';
  else if(place==='top'){n.style.top=(safeTop+H*0.025)+'px';if(side){n.style.left='auto';n.style.right='5%';n.style.maxWidth='38%'}}
  else if(place==='lower')n.style.top=(capY-H*(story?0.16:0.2))+'px';
  if(e.type==='broll'&&e.mode!=='full'&&land){n.style.left='56%';n.style.right='5%'}
  layer.appendChild(n);
  return {e:e,n:n,items:n.querySelectorAll('li'),tx:side?'':'translateX(-50%) ',vid:n.querySelector('video')};
}).filter(Boolean);

var cap=el('div');cap.id='cap';cap.className=D.captions.style;cap.style.top=capY+'px';cap.style.transform='translateY(-50%)';stage.appendChild(cap);
var logo=null;
if(D.logo){logo=el('div','','<img alt="" src="'+esc(D.logo)+'">');logo.id='logo';logo.style.top=(safeTop-H*0.055)+'px';stage.appendChild(logo);
  logo.querySelector('img').onerror=function(){logo.style.display='none'}}
var bar=el('div');bar.id='bar';stage.appendChild(bar);
// L'intro animée (motion design) : par-dessus tout, jusqu'à ce que le volet découvre la vidéo.
var intro=null,introWords=[];
if(D.intro){intro=el('div','',(D.intro.kicker?'<span class="k">'+esc(D.intro.kicker)+'</span>':'')+'<h1>'+String(D.intro.title).split(/\s+/).map(function(w){return '<span>'+esc(w)+'</span>'}).join('')+'</h1><div class="rule"></div>'+(D.logo?'<img alt="" src="'+esc(D.logo)+'">':''));intro.id='intro';
  introWords=Array.prototype.slice.call(intro.querySelectorAll('h1 span'))}
var outro=null;
if(D.outro){outro=el('div','',(D.logo?'<img alt="" src="'+esc(D.logo)+'">':'')+'<h2>'+esc(D.outro.text)+'</h2><hr>'+(D.outro.detail?'<p>'+esc(D.outro.detail)+'</p>':''));outro.id='outro';stage.appendChild(outro)}
if(intro)stage.appendChild(intro);

// ── Sous-titres ──
var chunks=D.captions.chunks,words=D.words,lastChunk=-2;
function chunkAt(t){var lo=0,hi=chunks.length-1,k=-1;while(lo<=hi){var m=(lo+hi)>>1;if(chunks[m].s<=t+0.02){k=m;lo=m+1}else hi=m-1}
  if(k<0)return -1;var c=chunks[k],next=chunks[k+1];if(t>c.e+0.5)return -1;if(next&&t>=next.s)return k+1;return k}
function drawCaptions(t,hide){
  var k=hide||t>=D.speechEnd?-1:chunkAt(t);
  if(k!==lastChunk){lastChunk=k;
    if(k<0){cap.innerHTML='';}
    else{var c=chunks[k];var inner=c.w.map(function(i){return '<span class="w" data-i="'+i+'">'+esc(words[i].x)+'</span>'}).join(' ');
      cap.innerHTML=D.captions.style==='minimal'?'<span class="box">'+inner+'</span>':inner}}
  if(k<0)return;
  // Un seul mot allumé : le dernier dont le début est passé.
  var spans=cap.querySelectorAll('.w'),cur=-1;
  for(var j=0;j<spans.length;j++){if(t>=words[+spans[j].getAttribute('data-i')].s-0.02)cur=j}
  for(var j2=0;j2<spans.length;j2++){spans[j2].classList.toggle('on',j2===cur);spans[j2].classList.toggle('next',j2>cur)}
  if(D.captions.style==='pop'){var p=back((t-chunks[k].s)/0.14);cap.style.transform='translateY(-50%) scale('+(0.86+0.14*p)+')'}
}

// ── La caméra : deux cadrages alternés à chaque coupe (masque le saut), poussées sur les zooms ──
var cuts=D.cuts;
function camScale(t){var seg=0;for(var i=0;i<cuts.length;i++)if(cuts[i]<=t)seg++;var s=seg%2?1.07:1;
  for(var j=0;j<D.elements.length;j++){var e=D.elements[j];if(e.type!=='zoom'||t<e.tin||t>=e.tout)continue;
    var k=Math.min(easeOut((t-e.tin)/0.18),easeOut((e.tout-t)/0.3));s*=1+0.13*k}
  return s}

function draw(t){
  cam.style.transform='scale('+camScale(t).toFixed(4)+')';
  var hideCaps=false;
  for(var i=0;i<nodes.length;i++){var o=nodes[i],e=o.e,n=o.n;
    var vis=t>=e.tin&&t<e.tout;if(!vis){n.style.opacity='0';if(o.vid&&!o.vid.paused)o.vid.pause();continue}
    var a=(t-e.tin)/0.3,b=(e.tout-t)/0.22,op=Math.min(clamp(a*1.4),clamp(b)),tr='';
    if(e.zone==='center')hideCaps=true;
    if(e.type==='keyword'){tr='scale('+(1.35-0.35*back(a))+')'}
    else if(e.type==='stat'){tr=o.tx+'scale('+(0.7+0.3*back(a))+')'}
    else if(e.type==='icon'){tr=o.tx+'translateY('+((1-easeOut(a))*-6*U)+'px)'}
    else if(e.type==='broll'){var life=clamp((t-e.tin)/Math.max(0.5,e.tout-e.tin));var img=n.firstChild;if(img)img.style.transform='scale('+(o.vid?1:1.04+0.1*life)+')';
      if(o.vid&&D.mode==='preview'){var want=clipTime(o,t);if(previewPlaying){if(Math.abs(o.vid.currentTime-want)>0.3)o.vid.currentTime=want;if(o.vid.paused)o.vid.play().catch(function(){})}else{if(!o.vid.paused)o.vid.pause();if(Math.abs(o.vid.currentTime-want)>0.1)o.vid.currentTime=want}}
      tr=e.mode==='full'?'scale('+(1.08-0.08*easeOut(a))+')':'rotate(-2deg) translateY('+((1-easeOut(a))*8*U)+'px)'}
    else if(e.type==='lowerThird'){tr='translateX('+((1-easeOut(a))*-30*U)+'px)';op=Math.min(clamp(a*2),clamp(b))}
    else if(e.type==='cta'){tr=o.tx+'scale('+((0.8+0.2*back(a))*(1+0.025*Math.sin((t-e.tin)*6)))+')'}
    else{tr='translateY('+((1-easeOut(a))*5*U)+'px)'}
    if(e.type==='list'){for(var j=0;j<o.items.length;j++){var it=e.itemTimes[j],q=easeOut((t-it)/0.25);o.items[j].style.opacity=String(q);o.items[j].style.transform='translateX('+((1-q)*-4*U)+'px)'}}
    n.style.opacity=String(op);n.style.transform=tr}
  drawCaptions(t,hideCaps);
  bar.style.width=(clamp(t/D.duration)*100)+'%';
  var o2=outro?clamp((t-D.speechEnd)/0.35):0;
  if(outro){outro.style.opacity=String(o2);var h=outro.querySelector('h2');if(h)h.style.transform='translateY('+((1-easeOut((t-D.speechEnd-0.1)/0.4))*4*U)+'px)'}
  var hideLogo=o2;
  if(intro){var end=D.intro.end,wipe=easeOut((t-(end-0.38))/0.38);
    intro.style.display=t<end+0.02?'flex':'none';
    intro.style.transform='translateY('+(-100*wipe)+'%)';
    for(var w=0;w<introWords.length;w++){var q=back((t-0.12-w*0.09)/0.32);introWords[w].style.opacity=String(clamp((t-0.12-w*0.09)/0.18));introWords[w].style.transform='translateY('+((1-q)*7*U)+'px)'}
    var rule=intro.querySelector('.rule');if(rule)rule.style.width=(easeOut((t-0.35)/0.6)*28)+'%';
    if(t<end)hideLogo=1}
  if(logo)logo.style.opacity=String(0.95*(1-hideLogo));
}

// ── Plans de coupe : leur temps local (en boucle s'ils sont plus courts que leur passage) ──
var previewPlaying=false;
function clipTime(o,t){var d=o.e.videoDuration||(o.vid&&o.vid.duration)||1;var x=Math.max(0,t-o.e.tin)%Math.max(0.2,d-0.05);return Math.floor(x*30)/30+0.5/30}
function seekClips(t){var jobs=[];for(var i=0;i<nodes.length;i++){var o=nodes[i];if(!o.vid||t<o.e.tin||t>=o.e.tout)continue;var want=clipTime(o,t);if(Math.abs(o.vid.currentTime-want)<0.004)continue;
  jobs.push(new Promise(function(res){var v=o.vid,done=false;function fin(){if(!done){done=true;res()}}v.addEventListener('seeked',fin,{once:true});try{v.currentTime=want}catch(e){fin()}setTimeout(fin,4000)}))}
  return jobs.length?Promise.all(jobs):null}

// ── La vidéo, image par image (rendu) ──
var FPS=D.fps;
var V0=D.videoStart||0;
/** L'instant de la vidéo filmée pour l'instant t de la vidéo finale (elle commence après l'intro). */
function frameTime(t){var end=Math.max(0,D.speechEnd-V0-0.5/30);var x=Math.max(0,Math.min(t-V0,end));return Math.min(end,Math.floor(x*30)/30+0.5/30)}
function seekVideo(t){
  var want=frameTime(t);if(Math.abs(video.currentTime-want)<0.004)return null;
  return new Promise(function(res){var done=false;function fin(){if(!done){done=true;res()}}
    // « seeked » puis deux images d'affichage : requestVideoFrameCallback ne se déclenche presque
    // jamais en headless (mesuré : 12 fois sur 60), et son délai de secours coûtait 400 ms par image.
    video.addEventListener('seeked',fin,{once:true});
    try{video.currentTime=want}catch(e){fin()}setTimeout(fin,4000)})
  .then(function(){return new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(r)})})});
}

function waitImages(){return Promise.all(Array.prototype.map.call(document.images,function(img){return img.decode?img.decode().catch(function(){}):Promise.resolve()}))}
function oneReady(v){return new Promise(function(res){if(v.readyState>=2)return res();v.addEventListener('loadeddata',function(){res()},{once:true});v.addEventListener('error',function(){res()},{once:true});setTimeout(res,30000)})}
function videoReady(){return Promise.all([video].concat(nodes.filter(function(o){return o.vid}).map(function(o){return o.vid})).map(oneReady))}
function timeout(ms){return new Promise(function(r){setTimeout(r,ms)})}
var ready=(async function(){
  await Promise.race([document.fonts?document.fonts.ready:Promise.resolve(),timeout(10000)]);
  await Promise.race([waitImages(),timeout(15000)]);
  await videoReady();
  draw(0);
  if(D.mode!=='preview')await (seekVideo(0)||Promise.resolve());
  else setupPreview();
  return true})();

window.__IDEM_VIDEO__={duration:D.duration,ready:ready,seek:function(t){draw(t);var a=seekVideo(t),b=seekClips(t);if(!a&&!b)return undefined;
  return Promise.all([a,b]).then(function(){return new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(r)})})})},cues:function(){return []}};

// ── Aperçu : la vidéo joue (avec sa voix), l'habillage suit son horloge ──
function setupPreview(){
  document.body.classList.add('preview');
  var wrap=el('div','pv-wrap');document.body.insertBefore(wrap,stage);wrap.appendChild(stage);
  function resize(){var k=Math.min(window.innerWidth/W,window.innerHeight/H);stage.style.transform='scale('+k+')';stage.style.transformOrigin='0 0';wrap.style.width=W*k+'px';wrap.style.height=H*k+'px'}
  resize();window.addEventListener('resize',resize);
  var music=D.music?new Audio(D.music.url):null;if(music){music.preload='auto';music.volume=0.12}
  var ui=el('div','pv-ui','<button class="pv-btn" type="button" aria-label="Lecture">&#9654;</button><div class="pv-bar"><div class="pv-fill"></div></div><span class="pv-time">0:00</span>');wrap.appendChild(ui);
  var btn=ui.querySelector('.pv-btn'),pbar=ui.querySelector('.pv-bar'),fill=ui.querySelector('.pv-fill'),time=ui.querySelector('.pv-time');
  var big=el('button','pv-big','&#9654;');big.type='button';big.setAttribute('aria-label','Lecture');wrap.appendChild(big);
  var playing=false,offset=0,startedAt=0,lastPost=0,videoOn=false;
  // L'horloge : celle de la page pendant l'intro et le carton, celle de la vidéo pendant la parole
  // (sa voix ne saute jamais) ; les passages de l'une à l'autre sont continus.
  function now(){if(!playing)return offset;if(videoOn)return V0+video.currentTime;return Math.min(D.duration,offset+(performance.now()-startedAt)/1000)}
  function syncMusic(t){if(!music)return;var want=(D.music.startAt||0)+t;if(Math.abs(music.currentTime-want)>0.3)music.currentTime=want;music.volume=0.12*clamp(Math.min(t/0.6,(D.duration-t)/1.2))}
  function stopVideo(t){videoOn=false;offset=t;startedAt=performance.now();video.pause()}
  function play(){if(offset>=D.duration-0.05)offset=0;playing=true;previewPlaying=true;videoOn=false;startedAt=performance.now();btn.innerHTML='&#10074;&#10074;';big.style.display='none';
    if(music){syncMusic(offset);music.play().catch(function(){})}}
  function pause(){offset=now();playing=false;previewPlaying=false;videoOn=false;video.pause();if(music)music.pause();btn.innerHTML='&#9654;'}
  function seek(t){offset=Math.max(0,Math.min(D.duration,t));startedAt=performance.now();videoOn=false;video.pause();
    video.currentTime=Math.max(0,Math.min(D.speechEnd-V0-0.05,offset-V0));big.style.display='none';if(music)syncMusic(offset);draw(offset)}
  video.addEventListener('ended',function(){if(playing&&videoOn)stopVideo(D.speechEnd)});
  function fmt(t){return Math.floor(t/60)+':'+('0'+Math.floor(t%60)).slice(-2)}
  function loop(){var t=now();
    if(playing&&t>=D.duration){playing=false;previewPlaying=false;videoOn=false;offset=0;video.pause();if(music)music.pause();btn.innerHTML='&#9654;';big.style.display='flex';t=0;video.currentTime=0}
    // Entrée dans la parole : la vidéo démarre à l'instant voulu ; sortie : la page reprend la main.
    if(playing&&!videoOn&&t>=V0&&t<D.speechEnd-0.05){video.currentTime=t-V0;video.play().catch(function(){});videoOn=true}
    if(playing&&videoOn&&t>=D.speechEnd-0.03)stopVideo(D.speechEnd);
    draw(t);if(playing)syncMusic(t);
    fill.style.width=(t/D.duration*100)+'%';time.textContent=fmt(t);
    if(window.parent!==window&&performance.now()-lastPost>120){lastPost=performance.now();window.parent.postMessage({type:'montage:time',t:t,playing:playing},'*')}
    requestAnimationFrame(loop)}
  btn.addEventListener('click',function(){playing?pause():play()});
  big.addEventListener('click',function(){offset=0;play()});
  pbar.addEventListener('click',function(ev){var r=pbar.getBoundingClientRect();seek(clamp((ev.clientX-r.left)/r.width)*D.duration)});
  window.addEventListener('message',function(ev){if(ev.source!==window.parent)return;var m=ev.data||{};
    if(m.type==='montage:seek'&&typeof m.t==='number'){if(playing)pause();seek(m.t)}
    else if(m.type==='montage:play')play();else if(m.type==='montage:pause')pause()});
  draw(Math.min(1,D.duration*0.1));offset=0;
  requestAnimationFrame(loop);
  if(window.parent!==window)window.parent.postMessage({type:'montage:ready',duration:D.duration},'*');
}
})();
`;
