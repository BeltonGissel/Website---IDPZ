/* Indoor Padel Zone V36 — selector visual de perfis e gestão de permissões.
   Usa exclusivamente os endpoints autenticados de V35; sem credenciais no cliente. */
(function () {
  'use strict';
  const ROOT_ID='ipz-panel-manager';
  const GROUPS=[
    ['Painel geral',[['dashboard.view','Consultar painel e indicadores']]],
    ['Compras',[['orders.view','Consultar compras'],['orders.edit','Gerir compras e estados']]],
    ['Reservas',[['bookings.view','Consultar reservas'],['bookings.edit','Confirmar, cancelar e reagendar']]],
    ['Calendário',[['calendar.view','Consultar a agenda'],['calendar.edit','Alterar reservas'],['calendar.blocks','Criar e remover bloqueios']]],
    ['Produtos',[['products.view','Consultar produtos'],['products.edit','Criar e editar produtos']]],
    ['Galeria',[['gallery.view','Consultar galeria'],['gallery.edit','Adicionar e apagar fotografias']]],
    ['Torneios',[['tournaments.view','Consultar torneios'],['tournaments.edit','Gerir torneios e resultados']]],
    ['Mensagens',[['messages.view','Ler mensagens'],['messages.edit','Marcar mensagens como lidas']]],
    ['Relatórios',[['reports.view','Consultar e exportar relatórios']]]
  ];
  const ICONS=['layout-dashboard','calendar-days','shopping-bag','users','shield-check','clipboard-list'];
  let panels=[],users=[],tab='panels',selected='',editMode=false,modal='',busy=false,notice='';
  const $=(selector,root=document)=>root.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const root=()=>document.getElementById(ROOT_ID);
  const initials=name=>String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0)).join('').toLocaleUpperCase('pt-PT');
  async function api(url,opts){const response=await fetch(url,{credentials:'same-origin',...opts});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Não foi possível concluir a operação');return data;}
  const jsonOpts=(method,payload)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const chosen=(form,name)=>Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(x=>x.value);
  const selectedPanel=()=>panels.find(p=>p.id===selected);
  const selectedUser=()=>users.find(u=>u.email===selected);
  function permEditor(current=[]){return GROUPS.map(([label,items])=>`<fieldset class="ipz-permissions"><legend>${esc(label)}</legend>${items.map(([key,title])=>`<label class="ipz-panel-check"><input type="checkbox" name="permission" value="${esc(key)}" ${current.includes(key)?'checked':''}><span>${esc(title)}</span></label>`).join('')}</fieldset>`).join('');}
  function panelsChecks(selectedIds=[]){return panels.map(p=>`<label class="ipz-panel-check ipz-panel-chip"><input type="checkbox" name="panel" value="${esc(p.id)}" ${selectedIds.includes(p.id)?'checked':''}><span>${esc(p.name)}</span></label>`).join('');}
  const tinyIcon=(name)=>({panel:'◈',user:'●'}[name]||'●');
  function avatarItem(item,index){const isPanel=tab==='panels';const id=isPanel?item.id:item.email;const active=id===selected;const label=isPanel?item.name:item.name;
   const desc=isPanel?((item.permissions||[]).length+' permissões'):(item.email==='geral@idpz.com'?'Recepção':item.active?'Conta activa':'Conta desactivada');
   return `<button type="button" class="ipz-circle-profile${active?' is-selected':''}" data-select-profile="${esc(id)}" aria-pressed="${active}" aria-label="${esc(label)}: ${esc(desc)}"><span class="ipz-circle-avatar ipz-tone-${index%5}" aria-hidden="true"><span>${isPanel?(item.id==='panel_admin'?'A':item.id==='panel_reception'?'R':initials(label)):initials(label)}</span></span><span class="ipz-circle-name">${esc(label)}</span><small>${esc(desc)}</small>${editMode?'<span class="ipz-circle-pencil" aria-hidden="true">✎</span>':''}</button>`;
  }
  function details(){const isPanel=tab==='panels',item=isPanel?selectedPanel():selectedUser();if(!item)return `<div class="ipz-profile-empty"><span aria-hidden="true">↗</span>Selecciona um perfil para consultar os seus acessos.</div>`;
   if(isPanel){const linked=users.filter(u=>(u.panels||[]).includes(item.id));return `<div class="ipz-selected-header"><div><span class="ipz-eyebrow">PAINEL SELECCIONADO</span><h3>${esc(item.name)}</h3><p>${item.protected?'Perfil base protegido':'Perfil personalizado'} · ${(item.permissions||[]).length} permissões</p></div>${!item.protected?'<span class="ipz-access-pill">Personalizado</span>':'<span class="ipz-access-pill">Protegido</span>'}</div><div class="ipz-permission-tags">${(item.permissions||[]).length?(item.permissions||[]).map(v=>`<span>${esc(GROUPS.flatMap(g=>g[1]).find(q=>q[0]===v)?.[1]||v)}</span>`).join(''):'<span>Sem permissões</span>'}</div><p class="ipz-linked-people"><strong>${linked.length}</strong> colaborador(es) associado(s)</p>${editMode&&!item.protected?`<div class="ipz-detail-actions"><button class="ipz-manager-primary" data-open-modal="edit-panel" type="button">Editar permissões</button><button class="ipz-manager-danger" data-delete-panel="${esc(item.id)}" type="button">Apagar painel</button></div>`:''}`;}
   return `<div class="ipz-selected-header"><div><span class="ipz-eyebrow">UTILIZADOR SELECCIONADO</span><h3>${esc(item.name)}</h3><p>${esc(item.email)}</p></div><span class="ipz-access-pill">${item.active?'Activo':'Inactivo'}</span></div><div class="ipz-permission-tags">${(item.panels||[]).map(id=>`<span>${esc(panels.find(x=>x.id===id)?.name||id)}</span>`).join('')||'<span>Sem painéis atribuídos</span>'}</div>${editMode?`<div class="ipz-detail-actions"><button class="ipz-manager-primary" data-open-modal="edit-user" type="button">Editar acessos</button>${item.email!=='geral@idpz.com'?`<button class="ipz-manager-danger" data-delete-staff="${esc(item.email)}" type="button">Apagar utilizador</button>`:''}</div>`:''}`;
  }
  function formModal(){if(!modal)return '';
   const isPanel=modal==='create-panel'||modal==='edit-panel';const editing=modal.startsWith('edit-');const entity=isPanel?(editing?selectedPanel():null):(editing?selectedUser():null);
   if(editing&&!entity)return '';
   const title=({ 'create-panel':'Adicionar painel','create-user':'Adicionar colaborador','edit-panel':'Editar painel','edit-user':'Editar utilizador'})[modal];
   const form=isPanel?`<label class="ipz-manager-field">Nome do painel<input name="name" maxlength="65" required autocomplete="off" value="${esc(entity?.name||'')}" placeholder="Ex.: Gestão da Loja"></label><p class="ipz-dialog-instruction">Escolhe o que os utilizadores deste painel podem visualizar e gerir.</p><div class="ipz-permissions-grid">${permEditor(entity?.permissions||[])}</div>`:`<div class="ipz-manager-fields"><label class="ipz-manager-field">Nome<input name="name" required maxlength="80" value="${esc(entity?.name||'')}" autocomplete="off" placeholder="Nome do colaborador"></label>${editing?'':`<label class="ipz-manager-field">Email<input name="email" required type="email" autocomplete="off" placeholder="colaborador@idpz.com"></label>`}<label class="ipz-manager-field">${editing?'Nova palavra-passe (opcional)':'Palavra-passe temporária'}<input name="password" type="password" ${editing?'':'required'} minlength="12" maxlength="160" autocomplete="new-password" placeholder="Mínimo de 12 caracteres"></label></div><p class="ipz-dialog-instruction">Painéis atribuídos ao colaborador</p><div class="ipz-panel-checks">${panelsChecks(entity?.panels||[])}</div>${editing?`<label class="ipz-panel-check"><input type="checkbox" name="active" ${entity.active?'checked':''} ${entity.email==='geral@idpz.com'?'disabled':''}>Conta activa</label>`:''}`;
   return `<div class="ipz-modal-backdrop" data-modal-backdrop><section class="ipz-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="ipz-dialog-title"><div class="ipz-profile-dialog-head"><div><span class="ipz-eyebrow">INDOOR PADEL ZONE · PERFIS</span><h2 id="ipz-dialog-title">${title}</h2></div><button class="ipz-dialog-close" type="button" data-close-modal aria-label="Fechar">×</button></div><form id="ipz-profile-form" data-modal-type="${modal}">${form}<p class="ipz-form-status" role="status" aria-live="polite"></p><div class="ipz-manager-actions"><button type="button" class="ipz-manager-outline" data-close-modal>Cancelar</button><button type="submit" class="ipz-manager-primary">${editing?'Guardar alterações':'Adicionar perfil'}</button></div></form></section></div>`;
  }
  function render(){const el=root();if(!el)return;const list=tab==='panels'?panels:users;if(!list.some(i=>(tab==='panels'?i.id:i.email)===selected))selected=list[0]?(tab==='panels'?list[0].id:list[0].email):'';
   el.innerHTML=`<div class="ipz-manager ipz-profile-selector"><header class="ipz-manager-head"><span class="ipz-eyebrow">INDOOR PADEL ZONE · ADMINISTRAÇÃO</span><h1>Gerir painéis</h1><p>Organiza os painéis e define quem pode aceder a cada funcionalidade.</p></header><div class="ipz-profile-shell"><div class="ipz-profile-shell-top"><span class="ipz-profile-symbol" aria-hidden="true">◉</span><div class="ipz-shell-caption">Quem vai gerir a Indoor Padel Zone?</div><div class="ipz-selector-tabs" role="group" aria-label="Tipo de perfil"><button type="button" data-profile-tab="panels" class="${tab==='panels'?'active':''}" aria-pressed="${tab==='panels'}">Painéis</button><button type="button" data-profile-tab="users" class="${tab==='users'?'active':''}" aria-pressed="${tab==='users'}">Colaboradores</button></div></div><div class="ipz-profile-grid">${list.map(avatarItem).join('')}${!list.length?'<p class="ipz-profile-noitems">Ainda não existem perfis nesta categoria.</p>':''}</div><section class="ipz-selected-profile" aria-live="polite">${details()}</section><div class="ipz-profile-toolbar"><button class="ipz-manager-outline ipz-bottom-action" type="button" data-open-modal="${tab==='panels'?'create-panel':'create-user'}"><span class="ipz-bottom-action-icon" aria-hidden="true">＋</span>Adicionar Perfil</button><button class="ipz-manager-primary ipz-bottom-action${editMode?' is-active':''}" type="button" data-edit-toggle aria-pressed="${editMode}"><span class="ipz-bottom-action-icon" aria-hidden="true">✎</span>${editMode?'Concluir edição':'Editar Perfil'}</button></div></div>${notice?`<p class="ipz-manager-feedback" role="status">${esc(notice)}</p>`:''}</div>${formModal()}`;
   if(modal){const input=$('.ipz-profile-dialog input:not([type=checkbox])',el);if(input)input.focus({preventScroll:true});}
  }
  async function load(){const el=root();if(!el)return;el.innerHTML='<div class="ipz-manager-loading" role="status">A carregar perfis e permissões…</div>';try{const data=await api('/api/admin/panels');panels=data.panels||[];users=data.users||[];render();}catch(e){el.innerHTML=`<div class="ipz-manager-card" role="alert">${esc(e.message)}</div>`;}}
  async function act(form,fn){if(busy)return;busy=true;const btn=form?.querySelector('[type=submit]');if(btn)btn.disabled=true;try{await fn();modal='';notice='Alterações guardadas com sucesso.';await load();}catch(e){const target=form?.querySelector('[role=status]');if(target)target.textContent=e.message;else {notice=e.message;render();}}finally{busy=false;if(btn)btn.disabled=false;}}
  document.addEventListener('submit',e=>{const form=e.target;if(form.id!=='ipz-profile-form'||!root())return;e.preventDefault();const kind=form.dataset.modalType;const name=form.elements.namedItem('name').value;
   if(kind==='create-panel')act(form,()=>api('/api/admin/panels',jsonOpts('POST',{name,permissions:chosen(form,'permission')})));
   if(kind==='edit-panel')act(form,()=>api('/api/admin/panels/'+encodeURIComponent(selected),jsonOpts('PATCH',{name,permissions:chosen(form,'permission')})));
   if(kind==='create-user')act(form,()=>api('/api/admin/staff',jsonOpts('POST',{name,email:form.elements.namedItem('email').value,password:form.elements.namedItem('password').value,panels:chosen(form,'panel')})));
   if(kind==='edit-user')act(form,()=>api('/api/admin/staff/'+encodeURIComponent(selected),jsonOpts('PATCH',{name,panels:chosen(form,'panel'),active:form.elements.namedItem('active').disabled||form.elements.namedItem('active').checked,password:form.elements.namedItem('password').value})));
  });
  document.addEventListener('click',e=>{const el=root();if(!el)return;
   const tabBtn=e.target.closest('[data-profile-tab]');if(tabBtn){tab=tabBtn.dataset.profileTab;selected='';modal='';editMode=false;notice='';render();return;}
   const select=e.target.closest('[data-select-profile]');if(select){selected=select.dataset.selectProfile;modal='';render();return;}
   const toggle=e.target.closest('[data-edit-toggle]');if(toggle){editMode=!editMode;render();return;}
   const open=e.target.closest('[data-open-modal]');if(open){modal=open.dataset.openModal;render();return;}
   if(e.target.closest('[data-close-modal]')||e.target.matches('[data-modal-backdrop]')){modal='';render();return;}
   const del=e.target.closest('[data-delete-panel]');if(del){if(!confirm('Apagar este painel personalizado? As atribuições associadas serão removidas.'))return;act(null,()=>api('/api/admin/panels/'+encodeURIComponent(del.dataset.deletePanel),{method:'DELETE'}));return;}
   const staff=e.target.closest('[data-delete-staff]');if(staff){if(!confirm('Eliminar este utilizador e terminar as suas sessões?'))return;act(null,()=>api('/api/admin/staff/'+encodeURIComponent(staff.dataset.deleteStaff),{method:'DELETE'}));}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal&&root()){modal='';render();}});
  window.IPZPanelManager={render:load};
})();
