/* Indoor Padel Zone · V43 · Sistema de ícones geométricos, sem dependências externas.
   Fonte única de SVG, assegura consistência em navegadores e respeita acessibilidade. */
(function(){'use strict';
 const lime='var(--ipz-icon-accent,#CFF902)', light='var(--ipz-icon-base,#FFFFFF)';
 const shapes={
  'home':['<path d="M4 11 12 4l8 7"/>','<path d="M7 11v9h10v-9M10 20v-6h4v6"/>'],
  'dashboard':['<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/>','<rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'],
  'bag':['<path d="M4 9h16l-1 11H5L4 9Z"/>','<path d="M9 10V7a3 3 0 0 1 6 0v3"/>'],
  'calendar':['<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18"/>','<path d="M8 3v4M16 3v4M8 15h3"/>'],
  'check-calendar':['<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18"/>','<path d="M8 3v4M16 3v4m-9 9 2.5 2.5 5-5"/>'],
  'box':['<path d="m3 7 9-4 9 4v10l-9 4-9-4V7Z"/>','<path d="m3 7 9 4 9-4M12 11v10"/>'],
  'image':['<rect x="3" y="3" width="18" height="18" rx="3"/>','<path d="m5 18 5-5 3 3 4-5 3 4M8 8h.01"/>'],
  'trophy':['<path d="M8 3h8v9a4 4 0 0 1-8 0V3Z"/>','<path d="M8 6H4v3a4 4 0 0 0 4 4M16 6h4v3a4 4 0 0 1-4 4M12 16v4m-4 1h8"/>'],
  'mail':['<rect x="3" y="5" width="18" height="14" rx="3"/>','<path d="m4 8 8 6 8-6"/>'],
  'report':['<path d="M6 3h9l5 5v13H4V5a2 2 0 0 1 2-2Z"/>','<path d="M15 3v6h5M8 17v-3m4 3v-6m4 6v-4"/>'],
  'users':['<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/>','<path d="M18 5v6m-3-3h6m-5 9h5"/>'],
  'logout':['<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/>','<path d="m14 8 4 4-4 4m4-4H9"/>'],
  'arrow-up-right':['<path d="M5 19 19 5"/>','<path d="M9 5h10v10"/>'],
  'arrow-right':['<path d="M4 12h16"/>','<path d="m13 5 7 7-7 7"/>'],
  'arrow-up':['<path d="M12 20V4"/>','<path d="m5 11 7-7 7 7"/>'],
  'arrow-down':['<path d="M12 4v16"/>','<path d="m5 13 7 7 7-7"/>'],
  'plus':['<path d="M4 12h16"/>','<path d="M12 4v16"/>'],
  'minus':['<path d="M4 12h16"/>',''],
  'close':['<path d="m5 5 14 14"/>','<path d="M19 5 5 19"/>'],
  'check':['<path d="m4 12 5 5 11-11"/>','<circle cx="12" cy="12" r="10"/>'],
  'search':['<circle cx="10" cy="10" r="6"/>','<path d="m15 15 6 6"/>'],
  'menu':['<path d="M4 6h16M4 12h16"/>','<path d="M4 18h16"/>'],
  'settings':['<circle cx="12" cy="12" r="3"/>','<path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>'],
  'alert':['<path d="M12 3 2 21h20L12 3Z"/>','<path d="M12 9v5m0 4h.01"/>'],
  'location':['<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/>','<circle cx="12" cy="10" r="2.5"/>'],
  'whatsapp':['<path d="M20.4 11.7A8.5 8.5 0 0 1 7.6 19l-4.4 1.2 1.2-4.3A8.5 8.5 0 1 1 20.4 11.7Z"/>','<path d="M8.2 8.6c.4-.6.8-.6 1.1-.1l.9 1.4c.2.3.1.7-.2 1l-.5.5c.7 1.3 1.9 2.4 3.3 3l.5-.6c.3-.3.6-.4 1-.2l1.5.7c.6.3.6.8.1 1.3-.6.7-1.4.8-2.2.5a10 10 0 0 1-5.9-5.5c-.3-.8-.2-1.5.4-2Z"/>']
 };
 const map={'admin':'dashboard','admin-pedidos':'bag','admin-reservas':'check-calendar','admin-calendario':'calendar','admin-produtos':'box','admin-galeria':'image','admin-torneios':'trophy','admin-mensagens':'mail','admin-relatorios':'report','admin-gerir-paineis':'users','admin-pagamentos':'check','loja':'bag','logout':'logout','arrow':'arrow-up-right'};
 function svg(name,extra=''){
  name=map[name]||name;const parts=shapes[name]||shapes['arrow-up-right'];
  return '<svg class="ipz-symbol" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" '+extra+'><g stroke="'+light+'" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round">'+parts[0]+'</g><g stroke="'+lime+'" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">'+parts[1]+'</g></svg>';
 }
 window.IPZIcons={svg};
 const glyphs={'↗':'arrow-up-right','→':'arrow-right','↑':'arrow-up','↓':'arrow-down','+':'plus','−':'minus'};
 // Apenas substitui ícones isolados. Não modifica textos longos, labels nem conteúdo editável.
 function decorate(root){
  if(!root||root.nodeType!==1)return;
  if(root.matches('[data-ipz-icon]')&&!root.dataset.ipzReady){root.innerHTML=svg(root.dataset.ipzIcon);root.dataset.ipzReady='1';}
  root.querySelectorAll('[data-ipz-icon]:not([data-ipz-ready])').forEach(n=>{n.innerHTML=svg(n.dataset.ipzIcon);n.dataset.ipzReady='1';});
  const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const target=[];
  while(walk.nextNode()){
   const t=walk.currentNode, v=t.nodeValue.trim();
   if(!t.parentElement||t.parentElement.closest('script,style,textarea,select,option,[contenteditable],.adm'))continue;
   const trailing=v.match(/^(.{1,65}?)\s*([↗→↑↓])$/u);
   if(!glyphs[v]&&!trailing)continue;
   if(t.parentElement.closest('.ipz-symbol'))continue;
   if(v==='+'&&!(t.parentElement.closest('button,a,.faq-q,.qty,.cart')))continue;
   if(trailing&&!t.parentElement.closest('a,button'))continue;
   target.push([t,v,trailing]);
  }
  target.forEach(([node,v,trailing])=>{const shell=document.createElement('span');shell.className='ipz-inline-icon';shell.innerHTML=svg(glyphs[trailing?trailing[2]:v]);if(trailing){const frag=document.createDocumentFragment();frag.appendChild(document.createTextNode(trailing[1].trimEnd()+' '));frag.appendChild(shell);node.parentNode.replaceChild(frag,node);}else node.parentNode.replaceChild(shell,node);});
 }
 let scheduled=false;
 const rerender=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate(document.body);});};
 function init(){decorate(document.body);new MutationObserver(rerender).observe(document.body,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
