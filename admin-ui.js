/* Indoor Padel Zone — iconografia e animação do painel (somente Admin/Recepcionista). */
(function(){'use strict';
 const NS='http://www.w3.org/2000/svg';
 const PATHS={
   'admin':'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
   'admin-pedidos':'<path d="M4 7h16l-1.2 13H5.2L4 7Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
   'admin-reservas':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15l2 2 5-5"/>',
   'admin-produtos':'<path d="M3 7 12 3l9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10"/>',
   'admin-galeria':'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
   'admin-torneios':'<path d="M8 4h8v8a4 4 0 0 1-8 0V4ZM8 6H4v3a4 4 0 0 0 4 4M16 6h4v3a4 4 0 0 1-4 4M12 16v4m-4 1h8"/>',
   'admin-pagamentos':'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20m-15 5h4"/>',
   'admin-mensagens':'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
   'admin-relatorios':'<path d="M4 20V5a2 2 0 0 1 2-2h9l5 5v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M14 3v6h6M8 16h2m2-4v4m2-2v2m2-5v5"/>',
   'home':'<path d="m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7"/>',
   'loja':'<path d="M4 9h16l-1 12H5L4 9ZM9 10V7a3 3 0 0 1 6 0v3"/>',
   'logout':'<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 16l4-4-4-4m4 4H9"/>',
   'arrow':'<path d="M5 19 19 5M9 5h10v10"/>'
 };
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let previousArea='',animated=false,timeout=null;
 function svg(name){return '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">'+PATHS[name]+'</svg>';}
 function sidebar(){const sb=document.querySelector('.adm .ad-sb');if(!sb)return;
   sb.querySelectorAll('.nl').forEach((a,i)=>{const key=a.hasAttribute('data-logout')?'logout':(a.getAttribute('href')||'').replace('#','');const target=a.querySelector(':scope > i');if(target&&PATHS[key]&&target.dataset.icon!==key){target.innerHTML=svg(key);target.dataset.icon=key;}a.style.setProperty('--item-order',i);});
   // Garante que o botão de saída é o último elemento, inclusive após actualizações anteriores.
   const exit=sb.querySelector('[data-logout]');if(exit){exit.classList.add('ad-logout');if(sb.lastElementChild!==exit)sb.appendChild(exit);}
 }
 function numbers(){if(reduced.matches)return;const el=document.querySelector('.adm .ad-pg');if(!el)return;
   el.querySelectorAll('.kn').forEach((node)=>{if(node.dataset.counted)return; const first=node.firstChild; if(!first||first.nodeType!==3)return;const raw=first.textContent;const cleaned=raw.replace(/\s/g,'');if(!/^\d+(?:[.,]\d+)?$/.test(cleaned))return;const target=Number(cleaned.replace(',','.'));if(!Number.isFinite(target)||target>1000000000)return;node.dataset.counted='1'; const duration=850,start=performance.now(),fmt=new Intl.NumberFormat('pt-PT',{maximumFractionDigits:cleaned.includes(',')?1:0});function tick(now){if(!node.isConnected)return;const p=Math.min((now-start)/duration,1),e=1-Math.pow(1-p,3);first.textContent=fmt.format(target*e);if(p<1)requestAnimationFrame(tick);else first.textContent=raw;}requestAnimationFrame(tick);});
 }
 function refresh(){const page=document.querySelector('.adm .ad-wrap');if(!page){previousArea='';return;}sidebar();const pg=page.querySelector('.ad-pg');if(!pg)return;
  pg.querySelectorAll('.ka').forEach(a=>{if(a.dataset.iconReady)return;const t=a.textContent.trim();if(t==='↗'){a.innerHTML=svg('arrow');a.dataset.iconReady='1';a.setAttribute('aria-label',a.getAttribute('aria-label')||'Abrir detalhes');}});
  pg.querySelectorAll('.kp').forEach((p,i)=>{p.style.setProperty('--item-order',i);p.querySelectorAll('.bb').forEach((b,j)=>b.style.setProperty('--item-order',j));});
  const area=location.hash.replace(/^#/,'')||'admin';
  if(!animated || previousArea!==area){previousArea=area;animated=true;if(!reduced.matches){const sb=page.querySelector('.ad-sb');if(sb){sb.classList.remove('is-entering');void sb.offsetHeight;sb.classList.add('is-entering');}pg.classList.remove('is-entering');void pg.offsetHeight;pg.classList.add('is-entering');setTimeout(()=>{sb?.classList.remove('is-entering');pg.classList.remove('is-entering');},1250);}numbers();}
 }
 // O painel volta a desenhar widgets a cada sincronização. Observa alterações sem alterar estados nem dados.
 const observer=new MutationObserver(()=>{if(timeout!==null)return;timeout=setTimeout(()=>{timeout=null;refresh()},35);});
 function boot(){observer.observe(document.getElementById('adm')||document.body,{childList:true,subtree:true});refresh();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 window.addEventListener('hashchange',()=>{previousArea='';});
})();
