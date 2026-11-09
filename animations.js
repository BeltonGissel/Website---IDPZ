/* Indoor Padel Zone | native motion: IntersectionObserver + requestAnimationFrame */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isAdmin = () => document.body.classList.contains('adm') || location.hash.startsWith('#admin');
  let observer, nodes = [], scenes = [], story, progress, ticking = false;
  const clamp = (x,min=0,max=1) => Math.min(max,Math.max(min,x));
  function setupProgress(){
    progress=document.querySelector('.ipz-scroll-progress');
    if(!progress){ progress=document.createElement('div'); progress.className='ipz-scroll-progress';progress.setAttribute('aria-hidden','true');progress.innerHTML='<span></span>';document.body.appendChild(progress);}
  }
  function scan(){
    if(observer) observer.disconnect();
    document.body.classList.remove('ipz-motion-ready');
    if(isAdmin()){if(progress)progress.hidden=true;return;}
    setupProgress();progress.hidden=false;
    nodes=[...document.querySelectorAll('.view.on .section-heading,.view.on .energy-copy,.view.on .glass-intro,.view.on .hero-reserve,.view.on .experience-card,.view.on .court-bottom,.view.on .closing-inner,.view.on .editorial-grid>*,.view.on .service-card,.view.on .page-hero>*,.view.on .pc')];
    // Existing markup controls page views; track visible/current route only.
    nodes.forEach((el,i)=>{el.classList.add('ipz-reveal');el.style.setProperty('--ipz-delay',((i%3)*75)+'ms');el.classList.remove('ipz-inview');});
    if(!reduced.matches && 'IntersectionObserver' in window){
      observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('ipz-inview');observer.unobserve(e.target);}}),{threshold:.12,rootMargin:'0px 0px -35px 0px'});
      nodes.forEach(el=>observer.observe(el));
      document.body.classList.add('ipz-motion-ready');
    } else nodes.forEach(el=>el.classList.add('ipz-inview'));
    scenes=[...document.querySelectorAll('.view.on .scene-photo,.view.on .scene-court,.view.on .scene-balls,.view.on .scene-player-one,.view.on .scene-player-two')];
    story=document.querySelector('.view.on .ipz-story-scroll');
    requestFrame();
  }
  function render(){
    ticking=false;
    if(isAdmin()||!progress)return;
    const doc=document.documentElement,range=Math.max(1,doc.scrollHeight-innerHeight);
    document.body.style.setProperty('--ipz-scroll',clamp(scrollY/range).toFixed(4));
    if(reduced.matches){scenes.forEach(el=>el.style.setProperty('--ipz-parallax','0px'));return;}
    for(const el of scenes){
      const b=el.getBoundingClientRect();
      if(b.bottom<0||b.top>innerHeight)continue;
      const ratio=(b.top+b.height/2-innerHeight/2)/innerHeight;
      el.style.setProperty('--ipz-parallax',(clamp(-ratio,-1,1)*25).toFixed(1)+'px');
    }
    const hero=document.querySelector('.view.on .ipz-hero');
    if(hero){const b=hero.getBoundingClientRect();hero.style.setProperty('--ipz-hero-lift',(-clamp(-b.top/Math.max(1,b.height))*45).toFixed(1)+'px');}
    if(story){
      const b=story.getBoundingClientRect(), travel=Math.max(1,b.height-innerHeight+100),p=clamp((-b.top)/travel);
      story.style.setProperty('--ipz-story-progress',p.toFixed(4));
      const stage=Math.min(2,Math.floor(p*3));
      story.querySelectorAll('[data-story-panel]').forEach((el,i)=>el.classList.toggle('is-active',i===stage));
      const counter=story.querySelector('.ipz-story-counter');if(counter)counter.textContent=String(stage+1).padStart(2,'0')+' / 03';
      const sticky=story.querySelector('.ipz-story-sticky');if(sticky)sticky.style.setProperty('--ipz-story-parallax',(-p*32).toFixed(1)+'px');
    }
  }
  function requestFrame(){if(!ticking){ticking=true;requestAnimationFrame(render);}}
  addEventListener('scroll',requestFrame,{passive:true});
  addEventListener('resize',requestFrame,{passive:true});
  addEventListener('hashchange',()=>{requestAnimationFrame(()=>{scan();requestFrame();});});
  reduced.addEventListener?.('change',scan);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();
})();
