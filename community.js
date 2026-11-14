/* Galeria, torneios e gestão do cartão: frontend independente do painel original. */
(function(){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
async function api(path,opts={}){const response=await fetch(path,{credentials:'same-origin',...opts});let data=await response.json();if(!response.ok)throw Error(data.error||'Erro ao comunicar com servidor');return data;}
const post=(path,data,method='POST')=>api(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
function notice(target,msg){const node=typeof target==='string'?$(target):target;if(node){node.textContent=msg;node.style.display='block';}}
function safeDate(d){if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return '';return d.split('-').reverse().join('/');}
function formTournament(id){return `<form id="${id}" class="ipz-com-form"><label>Nome do torneio<input name="title" required maxlength="110" placeholder="Nome do torneio"></label><label>Data prevista<input name="date" type="date" required></label><label>Nome do organizador<input name="name" maxlength="100" required></label><label>Email<input name="email" type="email" required></label><label>Contacto (+258)<input name="phone" type="tel" required placeholder="841234567"></label><label>Número de participantes (2 a 128)<input name="capacity" type="number" min="2" max="128" required value="8"></label><label class="wide">Participantes, um nome por linha (para sorteio sem repetição)<textarea name="participants" placeholder="Ana\nJoão\nMarta\nPaulo"></textarea></label><div class="wide"><small>O sorteio é feito com os nomes que introduzires. Se ainda não tiveres dois participantes, o Admin poderá completar a lista e sortear mais tarde. A criação e a gestão dos torneios são exclusivas dos painéis com autorização.</small></div><button type="submit" class="ipz-com-btn">Criar torneio e sortear</button><p class="wide" role="status"></p></form>`;}
function matches(list){return `<div class="ipz-com-bracket">${(list||[]).map((m,i)=>`<div class="ipz-match"><b>Jogo ${i+1}</b><span>${esc(m.a)} <strong>vs.</strong> ${m.b?esc(m.b):'Folga (avança)'}</span></div>`).join('')}</div>`;}
function renderGallery(){
 const el=$('#ipz-gallery-content');if(!el)return;el.innerHTML='<p>A carregar fotografias…</p>';
 api('/api/gallery').then(v=>{el.innerHTML=v.items.length?
 `<div class="ipz-editorial-gallery" aria-label="Fotografias da Indoor Padel Zone">${v.items.map((x,i)=>`<figure class="ipz-editorial-photo" tabindex="0"><img loading="lazy" decoding="async" src="${esc(x.url)}" alt="${esc(x.caption||'Fotografia da Indoor Padel Zone')}"><figcaption><span>${esc(x.caption||'Indoor Padel Zone')}</span></figcaption></figure>`).join('')}</div>`:
 '<div class="ipz-com-notice">Novas fotografias dos nossos campos e actividades serão publicadas aqui.</div>';}).catch(e=>notice(el,e.message));
}
function renderTournaments(){
 const el=$('#ipz-tournament-content');if(!el)return;el.innerHTML='<p>A carregar torneios…</p>';
 api('/api/tournaments').then(v=>{
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Maputo'});
  const card=(x,past=false)=>`<article class="ipz-tournament-card ${past?'is-past':'is-upcoming'}"><a class="ipz-tournament-cover" href="#torneio-${encodeURIComponent(x.id)}" aria-label="Ver detalhes de ${esc(x.title)}">${x.coverUrl?`<img loading="lazy" decoding="async" src="${esc(x.coverUrl)}" alt="Capa de ${esc(x.title)}">`:`<div class="ipz-tournament-cover-fallback"><span>INDOOR PADEL ZONE</span><strong>PADEL</strong><small>TORNEIO</small></div>`}</a><div class="ipz-tournament-card-body"><span class="ipz-com-meta">${esc(x.status)} · ${safeDate(x.date)}</span><h3>${esc(x.title)}</h3><p>${(x.participants||[]).length}/${Number(x.capacity||0)} participantes</p><a class="ipz-com-btn ipz-tournament-link" href="#torneio-${encodeURIComponent(x.id)}">${past?'Ver torneio e resultados':'Ver detalhes do torneio'} ↗</a></div></article>`;
  const upcoming=v.items.filter(x=>x.date>=today&&x.status!=='Concluído');
  const past=v.items.filter(x=>x.date<today||x.status==='Concluído');
  el.innerHTML=`<h2>Próximos torneios</h2>${upcoming.length?`<div class="ipz-tournament-grid">${upcoming.map(x=>card(x)).join('')}</div>`:'<div class="ipz-com-notice">O calendário de próximos torneios será divulgado nesta página.</div>'}<div class="ipz-tournament-separator"></div><h2>Torneios realizados</h2>${past.length?`<div class="ipz-tournament-grid">${past.map(x=>card(x,true)).join('')}</div>`:'<div class="ipz-com-notice">Os torneios concluídos serão apresentados aqui com imagens, resultados e classificações.</div>'}`;
 }).catch(e=>notice(el,e.message));
}
function renderTournamentDetail(id){
 const el=$('#ipz-tournament-detail');if(!el)return;
 if(!/^[A-Za-z0-9_-]+$/.test(id||'')){notice(el,'Torneio inválido.');return;}
 el.innerHTML='<p>A carregar dados do torneio…</p>';
 api('/api/tournaments/'+encodeURIComponent(id)).then(({item:t})=>{
  const ranking=Array.isArray(t.ranking)?[...t.ranking].sort((a,b)=>a.position-b.position):[];
  const photos=t.photos||[];
  const participants=Array.isArray(t.participants)?t.participants:[];
  const desc=t.description||`Consulta os resultados, a classificação final e os melhores momentos deste torneio da Indoor Padel Zone.`;
  el.innerHTML=`<article class="ipz-tour-layout" aria-label="Detalhes do torneio">
    <nav class="ipz-tour-topnav" aria-label="Navegação do torneio">
      <a href="#torneios" class="ipz-tour-back">← Torneios</a>
      <span class="ipz-tour-menu-label">MENU</span>
      <div class="ipz-tour-menu-links" role="tablist" aria-label="Secções do torneio">
        <button type="button" class="ipz-tour-tab is-active" role="tab" id="ipz-tab-info" aria-controls="ipz-panel-info" aria-selected="true" tabindex="0" data-tour-tab="info">Informações</button>
        <button type="button" class="ipz-tour-tab" role="tab" id="ipz-tab-ranking" aria-controls="ipz-panel-ranking" aria-selected="false" tabindex="-1" data-tour-tab="ranking">Ranking</button>
        <button type="button" class="ipz-tour-tab" role="tab" id="ipz-tab-gallery" aria-controls="ipz-panel-gallery" aria-selected="false" tabindex="-1" data-tour-tab="gallery">Galeria</button>
      </div>
    </nav>
    <div class="ipz-tour-filter-content">
      <section class="ipz-tour-panel" id="ipz-panel-info" role="tabpanel" aria-labelledby="ipz-tab-info" data-tour-panel="info">
        <div class="ipz-tour-intro">
          <span class="ipz-com-eyebrow">${esc(t.status)} · ${safeDate(t.date)}</span>
          <h1>${esc(t.title)}</h1>
          <p class="ipz-tour-description">${esc(desc)}</p>
          <p class="ipz-tour-metadata">${participants.length} participantes · ${safeDate(t.date)}</p>
          
          <h2 class="ipz-tour-subtitle">Participantes</h2>
          ${participants.length?`<ol class="ipz-participant-list">${participants.map(n=>`<li>${esc(n)}</li>`).join('')}</ol>`:'<p>Participantes ainda não publicados.</p>'}
        </div>
      </section>
      <section class="ipz-tour-panel" id="ipz-panel-ranking" role="tabpanel" aria-labelledby="ipz-tab-ranking" data-tour-panel="ranking" hidden>
        <div class="ipz-tour-ranking">
          <div class="ipz-tour-section-heading"><span class="ipz-com-eyebrow">CLASSIFICAÇÃO</span><h2>Ranking · ${esc(t.title)}</h2></div>
          ${ranking.length?`<div class="ipz-ranking-wrap"><table class="ipz-ranking"><thead><tr><th>Pos.</th><th>Participante</th><th>Vitórias</th><th>Pontos</th></tr></thead><tbody>${ranking.map(r=>`<tr><td>${Number(r.position)}º</td><td>${esc(r.name)}</td><td>${Number(r.wins)}</td><td>${Number(r.points)}</td></tr>`).join('')}</tbody></table></div>`:'<p>O ranking ainda não foi publicado.</p>'}
        </div>
      </section>
      <section class="ipz-tour-panel" id="ipz-panel-gallery" role="tabpanel" aria-labelledby="ipz-tab-gallery" data-tour-panel="gallery" hidden>
        <div class="ipz-tour-gallery">
          <div class="ipz-tour-section-heading"><span class="ipz-com-eyebrow">MELHORES MOMENTOS</span><h2>Galeria · ${esc(t.title)}</h2></div>
          ${photos.length?`<div class="ipz-tour-photo-grid">${photos.map((photo,i)=>`<figure class="ipz-tour-photo ${i===0?'ipz-tour-photo-featured':''}"><img loading="lazy" src="${esc(photo.url)}" alt="${esc(photo.caption||'Fotografia do torneio')}"><figcaption>${esc(photo.caption||'')}</figcaption></figure>`).join('')}</div>`:'<div class="ipz-tour-gallery-empty">As fotografias deste torneio ainda não foram publicadas.</div>'}
        </div>
      </section>
    </div>
  </article>`;
 }).catch(er=>notice(el,er.message));
}
function tournamentAdminExtras(t){
 const ranking=(t.ranking||[]).map(r=>`${r.position};${r.name};${r.points};${r.wins}`).join('\n');
 return `<details class="ipz-tournament-management"><summary>Ranking e galeria do torneio</summary>
 <label class="ipz-admin-label">Ranking: uma linha por posição (posição;nome;pontos;vitórias)<textarea data-ranking="${esc(t.id)}" rows="5" placeholder="1;Nome do vencedor;100;5\n2;Segundo classificado;80;4">${esc(ranking)}</textarea></label>
 <button type="button" data-ranking-save="${esc(t.id)}">Guardar ranking</button>
 <form class="ipz-tournament-photo-form" data-tournament-photo="${esc(t.id)}"><label>Legenda<input name="caption" maxlength="160" placeholder="Final do torneio"></label><label>Fotografia (JPG, PNG, WebP)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required></label><label class="ipz-cover-choice"><input type="checkbox" name="asCover" value="1"> Usar como capa do torneio</label><button type="submit">Adicionar fotografia</button><p role="status"></p></form>
 <div class="ipz-admin-tournament-photos" data-tournament-photo-list="${esc(t.id)}"><p>Selecciona “Carregar galeria” para ver as fotografias.</p></div><button type="button" data-tournament-photos-load="${esc(t.id)}">Carregar galeria</button>
 </details>`;
}
async function loadTournamentAdminPhotos(id){
 const el=document.querySelector('[data-tournament-photo-list="'+id+'"]');if(!el)return;
 const v=await api('/api/admin/tournaments/'+encodeURIComponent(id)+'/photos');
 el.innerHTML=v.items.length?`<div class="ipz-com-grid">${v.items.map(photo=>`<div class="ipz-com-card"><img loading="lazy" src="${esc(photo.url)}" alt="${esc(photo.caption)}"><div class="ipz-pad">${esc(photo.caption)}${photo.isCover?'<span class="ipz-cover-label">CAPA ACTUAL</span>':''}<div class="ipz-cover-actions"><button type="button" data-tournament-cover="${esc(photo.id)}" data-parent="${esc(id)}">Definir como capa</button><button type="button" class="danger" data-tournament-photo-delete="${esc(photo.id)}" data-parent="${esc(id)}">Apagar</button></div></div></div>`).join('')}</div>`:'<p>Sem fotografias neste torneio.</p>';
}
async function compress(file){if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Usa JPG, PNG ou WebP');const bitmap=await createImageBitmap(file);const ratio=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));const cv=document.createElement('canvas');cv.width=Math.round(bitmap.width*ratio);cv.height=Math.round(bitmap.height*ratio);cv.getContext('2d').drawImage(bitmap,0,0,cv.width,cv.height);bitmap.close();let quality=.78,uri=cv.toDataURL('image/webp',quality);while(uri.length>320000&&quality>.28){quality-=.1;uri=cv.toDataURL('image/webp',quality);}if(uri.length>350000)throw Error('Imagem demasiado grande. Reduz a resolução.');return uri;}
function submitTournament(e,admin){e.preventDefault();const form=e.target,fd=new FormData(form),data=Object.fromEntries(fd.entries());data.capacity=Number(data.capacity);data.phone='+258'+String(data.phone||'').replace(/\D/g,'').replace(/^258/,'');data.participants=String(data.participants||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);const b=form.querySelector('button[type=submit]');b.disabled=true;
post(admin?'/api/admin/tournaments':'/api/tournaments',data).then(v=>{form.reset();const status=form.querySelector('[role=status]');status.innerHTML=`Torneio registado (${esc(v.id)}). ${admin?'Publicado.':'Aguarda aprovação do Admin.'}`;if(v.draw?.length)status.innerHTML+=matches(v.draw);admin?renderAdmin('admin-torneios'):renderTournaments();}).catch(er=>notice(form.querySelector('[role=status]'),er.message)).finally(()=>b.disabled=false);}
function adminGallery(){const el=$('#ipz-community-admin');if(!el)return;const editable=!!window.IDPZCan?.('gallery.edit');el.innerHTML=`<h2>Galeria</h2><p>Adiciona fotografias para apresentar os melhores momentos da Indoor Padel Zone.</p><form ${editable?'':'hidden'} id="ipz-gallery-upload" class="ipz-com-form"><label>Legenda da fotografia<input name="caption" required maxlength="160"></label><label>Imagem<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required></label><button type="submit" class="ipz-com-btn">Adicionar foto</button><p role="status"></p></form><div id="ipz-gallery-admin-list"></div>`;api('/api/gallery').then(v=>{$('#ipz-gallery-admin-list').innerHTML=`<div class="ipz-com-grid">${v.items.map(x=>`<article class="ipz-com-card"><img src="${esc(x.url)}" alt="${esc(x.caption)}"><div class="ipz-pad">${esc(x.caption)}${editable?`<div class="ipz-admin-actions"><button class="danger" data-gallery-delete="${esc(x.id)}">Apagar fotografia</button></div>`:''}</div></article>`).join('')}</div>`;}).catch(e=>notice('#ipz-gallery-admin-list',e.message));}
function adminTournaments(){const el=$('#ipz-community-admin');if(!el)return;const editable=!!window.IDPZCan?.('tournaments.edit');el.innerHTML=`<h2>Gestão de torneios</h2><p>Criar, aprovar, sortear e concluir torneios.</p>${editable?formTournament('ipz-tournament-admin'):''}<div id="ipz-tournament-admin-list"></div>`;api('/api/admin/tournaments').then(v=>{$('#ipz-tournament-admin-list').innerHTML=`<div class="ipz-com-grid">${v.items.map(t=>`<article class="ipz-com-card">${t.coverUrl?`<img loading="lazy" src="${esc(t.coverUrl)}" alt="Capa de ${esc(t.title)}">`:""}<div class="ipz-pad"><div class="ipz-com-meta">${esc(t.status)} · ${safeDate(t.date)}${t.demo?' · DEMONSTRAÇÃO':''}</div><h3>${esc(t.title)}</h3><p>${esc(t.name)} · ${esc(t.email)} · ${esc(t.phone)}</p><p>${(t.participants||[]).length}/${t.capacity} participantes</p>${t.draw?.length?matches(t.draw):''}${editable?tournamentAdminExtras(t):''}${editable?`<details><summary>Editar participantes</summary><textarea style="width:100%;min-height:110px" data-roster="${esc(t.id)}">${esc((t.participants||[]).join('\n'))}</textarea><button data-tournament-action="roster" data-id="${esc(t.id)}">Guardar nomes</button></details><div class="ipz-admin-actions"><button data-tournament-action="publish" data-id="${esc(t.id)}">Publicar</button><button data-tournament-action="draw" data-id="${esc(t.id)}">Sortear jogos</button><button data-tournament-action="finish" data-id="${esc(t.id)}">Concluir</button><button class="danger" data-tournament-delete="${esc(t.id)}">Apagar</button></div>`:''}</div></article>`).join('')}</div>`;}).catch(e=>notice('#ipz-tournament-admin-list',e.message));}
function renderAdmin(section,info){if(section==='admin-galeria')adminGallery();if(section==='admin-torneios')adminTournaments();}
document.addEventListener('submit',async e=>{if(e.target.matches('[data-tournament-photo]')){
 e.preventDefault();const form=e.target,id=form.dataset.tournamentPhoto,button=form.querySelector('button[type="submit"]');button.disabled=true;
 try{const fd=new FormData(form);await post('/api/admin/tournaments/'+encodeURIComponent(id)+'/photos',{caption:fd.get('caption'),image:await compress(fd.get('photo')),asCover:fd.get('asCover')==='1'});form.reset();notice(form.querySelector('[role=status]'),'Fotografia adicionada.');await loadTournamentAdminPhotos(id);}
 catch(err){notice(form.querySelector('[role=status]'),err.message);}finally{button.disabled=false;}return;
}if(e.target.id==='ipz-tournament-admin')return submitTournament(e,true);if(e.target.id==='ipz-gallery-upload'){e.preventDefault();const form=e.target,b=form.querySelector('button');b.disabled=true;try{const fd=new FormData(form),file=fd.get('photo');await post('/api/admin/gallery',{caption:fd.get('caption'),image:await compress(file)});adminGallery();}catch(err){notice(form.querySelector('[role=status]'),err.message);}finally{b.disabled=false;}}});
function activateTournamentTab(tab,focus=false){
 const layout=tab.closest('.ipz-tour-layout');if(!layout)return;
 const target=tab.dataset.tourTab;
 layout.querySelectorAll('[data-tour-tab]').forEach(button=>{
  const active=button.dataset.tourTab===target;
  button.classList.toggle('is-active',active);
  button.setAttribute('aria-selected',String(active));
  button.tabIndex=active?0:-1;
 });
 layout.querySelectorAll('[data-tour-panel]').forEach(panel=>{panel.hidden=panel.dataset.tourPanel!==target;});
 if(focus)tab.focus();
}
document.addEventListener('keydown',e=>{
 const tab=e.target.closest('[data-tour-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 const tabs=[...tab.closest('[role="tablist"]').querySelectorAll('[data-tour-tab]')];
 const i=tabs.indexOf(tab);let j=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 e.preventDefault();activateTournamentTab(tabs[j],true);
});
document.addEventListener('click',async e=>{
 const tab=e.target.closest('[data-tour-tab]');if(tab){activateTournamentTab(tab);return;}

 const rankingBtn=e.target.closest('[data-ranking-save]');if(rankingBtn){
  const id=rankingBtn.dataset.rankingSave,textarea=document.querySelector('[data-ranking="'+id+'"]');
  const ranking=textarea.value.split(/\r?\n/).filter(x=>x.trim()).map(line=>{const v=line.split(';').map(x=>x.trim());return {position:Number(v[0]),name:v[1],points:Number(v[2]||0),wins:Number(v[3]||0)};});
  rankingBtn.disabled=true;try{await post('/api/admin/tournaments/'+encodeURIComponent(id)+'/ranking',{ranking},'PUT');alert('Ranking guardado.');}catch(err){alert(err.message);}finally{rankingBtn.disabled=false;}return;
 }
 const photoLoad=e.target.closest('[data-tournament-photos-load]');if(photoLoad){try{await loadTournamentAdminPhotos(photoLoad.dataset.tournamentPhotosLoad)}catch(err){alert(err.message)}return;}
 const setCover=e.target.closest('[data-tournament-cover]');if(setCover){
  const id=setCover.dataset.parent;
  try{await post('/api/admin/tournaments/'+encodeURIComponent(id)+'/cover',{photoId:setCover.dataset.tournamentCover},'PUT');await loadTournamentAdminPhotos(id);alert('Capa do torneio actualizada.');}
  catch(err){alert(err.message);}return;
 }
 const photoDelete=e.target.closest('[data-tournament-photo-delete]');if(photoDelete){if(!confirm('Apagar esta fotografia do torneio?'))return;try{await api('/api/admin/tournaments/'+encodeURIComponent(photoDelete.dataset.parent)+'/photos/'+encodeURIComponent(photoDelete.dataset.tournamentPhotoDelete),{method:'DELETE'});await loadTournamentAdminPhotos(photoDelete.dataset.parent);}catch(err){alert(err.message)}return;}

const del=e.target.closest('[data-gallery-delete]');if(del){if(!confirm('Apagar esta fotografia?'))return;try{await api('/api/admin/gallery/'+encodeURIComponent(del.dataset.galleryDelete),{method:'DELETE'});adminGallery();}catch(err){alert(err.message);}}
const td=e.target.closest('[data-tournament-delete]');if(td){if(!confirm('Apagar este torneio?'))return;try{await api('/api/admin/tournaments/'+encodeURIComponent(td.dataset.tournamentDelete),{method:'DELETE'});adminTournaments();}catch(err){alert(err.message);}}
const action=e.target.closest('[data-tournament-action]');if(action){let body={action:action.dataset.tournamentAction};if(body.action==='roster')body.participants=Array.from(document.querySelector('[data-roster="'+action.dataset.id+'"]')?.value.split(/\r?\n/)||[]).map(v=>v.trim()).filter(Boolean);try{await post('/api/admin/tournaments/'+encodeURIComponent(action.dataset.id),body,'PATCH');adminTournaments();}catch(err){alert(err.message);}}
});
window.IPZCommunity={render:function(h,id){if(h==='galeria')renderGallery();if(h==='torneios')renderTournaments();if(h==='torneio')renderTournamentDetail(id);},renderAdmin};
if(location.hash==='#galeria')renderGallery();if(location.hash==='#torneios')renderTournaments();if(location.hash.startsWith('#torneio-'))renderTournamentDetail(location.hash.slice(9));
})();
