
(function(){var $=function(x){return document.querySelector(x)},P=["home","sobre","reservar","loja","contacto","produto","carrinho","checkout","pedido","galeria","torneios","torneio"];
function r(){var h=(location.hash||"#home").slice(1);if(h.indexOf("admin")===0){document.body.classList.add("adm");AH=h;admRender(true);window.scrollTo(0,0);return}document.body.classList.remove("adm");var pid=null;if(h.indexOf("produto-")===0){pid=h.slice(8);h="produto"}if(h.indexOf("torneio-")===0){pid=h.slice(8);h="torneio"}if(P.indexOf(h)<0)h="home";P.forEach(function(p){$("#v-"+p).classList.toggle("on",p===h)});var nh=h==="torneio"?"torneios":["produto","carrinho","checkout","pedido"].indexOf(h)>=0?"loja":h;if(h==="produto")prod(pid);if(h==="carrinho")cartView();if(h==="checkout"){location.replace(location.pathname+location.search+"#carrinho");return;}if(h==="pedido")od();if((h==="galeria"||h==="torneios"||h==="torneio")&&window.IPZCommunity)window.IPZCommunity.render(h,pid);$("#fab").style.display=["loja","produto","carrinho"].indexOf(h)>=0?"flex":"none";
document.querySelectorAll("#nv a:not(.cta)").forEach(function(a){a.classList.toggle("on",a.getAttribute("href")==="#"+nh)});$("#nv").classList.remove("open");window.scrollTo(0,0)}
addEventListener("hashchange",r);
setTimeout(function(){var l=$("#ld");l.style.opacity=0;setTimeout(function(){l.remove()},400)},1200);
$("#bg").onclick=function(){$("#nv").classList.toggle("open")};
var st={s:0,date:'',start:'',end:'',court:'',first:'',last:'',bi:'',phone:'',pm:'card',wallet:'',email:'',bk:null,availability:null};
var C=["Campo 1","Campo 2","Campo 3","Campo 4"],T=Array.from({length:18},function(_,i){return String(i+6).padStart(2,'0')+':00'});
var BOOKING_PRICE=1700;
function isoDay(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function localToday(){return isoDay(new Date())}
function mzPhone(raw){return '+258'+String(raw||'').replace(/\D/g,'').replace(/^258/,'').slice(0,9)}
function phoneValid(raw,kind){var n=mzPhone(raw);return kind==='emola'?/^\+2588[67]\d{7}$/.test(n):kind==='mpesa'?/^\+2588[45]\d{7}$/.test(n):/^\+2588\d{8}$/.test(n)}
function formatMobile(raw){var n=String(raw||'').replace(/\D/g,'').replace(/^258/,'').slice(0,9);return [n.slice(0,2),n.slice(2,5),n.slice(5,9)].filter(Boolean).join(' ')}
function mobileField(id,label,kind){return '<label for="'+id+'">'+label+'</label><div class="ipz-v7-phone"><span>+258</span><input type="tel" id="'+id+'" inputmode="numeric" autocomplete="tel-national" maxlength="11" placeholder="'+(kind==='emola'?'86':'84')+' xxx xxxx" value="'+formatMobile(st.wallet)+'" required></div>'}
function phoneField(id,label){return '<label for="'+id+'">'+label+'</label><div class="ipz-phone-wrap"><span>+258</span><input id="'+id+'" type="tel" inputmode="numeric" maxlength="9" pattern="[0-9]{9}" placeholder="84XXXXXXX" autocomplete="tel-national"></div>'}
// A Indoor Padel Zone não recolhe meios de pagamento. Todos os pedidos seguem por WhatsApp.
function bookingWhatsAppMessage(b){
 var lines=['Olá, Indoor Padel Zone! Gostaria de confirmar a seguinte reserva:',
  'Referência: '+(b.ref||'por confirmar'),
  'Campo: '+st.court,
  'Data: '+bookingDateLabel(st.date),
  'Horário: '+st.start+'–'+st.end,
  'Duração: '+bookingHours()+' hora(s)',
  'Valor estimado: '+(bookingHours()*BOOKING_PRICE).toLocaleString('pt-PT')+' MT',
  'Nome: '+st.first.trim()+' '+st.last.trim(),
  'Contacto: '+mzPhone(st.phone),
  '', 'Por favor, confirmem a disponibilidade e indiquem como efectuar o pagamento.'];
 return lines.join('\n');
}
function bookingWhatsAppUrl(b){return 'https://wa.me/258877388644?text='+encodeURIComponent(bookingWhatsAppMessage(b));}
function bookingHours(){var a=parseInt(st.start,10),b=parseInt(st.end,10);return Number.isFinite(a)&&Number.isFinite(b)&&b>a?b-a:0}
function bookingDateLabel(d){if(!d)return '—';var p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
function bookingCapture(){var el=document.querySelector('#bk');if(!el)return;
 var v=function(id){return el.querySelector('#'+id)?.value||''};
 if(st.s===0){st.date=v('ipz-cal')||st.date;st.start=v('ipz-start')||st.start;st.end=v('ipz-end')||st.end;st.court=el.querySelector('[name=ipz-court]:checked')?.value||st.court;st.first=v('bn');st.last=v('bl');st.bi=v('bi');st.phone=v('bt');}
}
function bookingError(message){var e=document.querySelector('#be');if(e)e.textContent=message;else toast(message)}
function bk(){var root=$('#bk');if(!root)return;var h='',progress=$('#stp');if(progress)progress.querySelectorAll('i').forEach(function(e,i){e.classList.toggle('on',i<=Math.min(st.s,1))});
 if(st.s===0){var today=localToday(),max=new Date();max.setDate(max.getDate()+44);
 h='<div class="ipz-v7-heading"><span class="ipz-v7-step">ETAPA 01 / 02</span><h2>Escolhe o teu campo</h2><p>Selecciona uma data no calendário e define a hora de início e de fim.</p></div>'+
 '<div class="ipz-v7-pair"><div class="ipz-v7-field"><label for="ipz-cal">Data · calendário</label><input type="date" id="ipz-cal" min="'+today+'" max="'+isoDay(max)+'" value="'+st.date+'" required></div>'+
 '<div class="ipz-v7-field"><label>Horário</label><div class="ipz-v7-timepair"><div><label for="ipz-start">Início</label><select id="ipz-start" required><option value="">Hora inicial</option>'+T.slice(0,-1).map(function(t){return '<option value="'+t+'" '+(t===st.start?'selected':'')+'>'+t+'</option>'}).join('')+'</select></div><div><label for="ipz-end">Fim</label><select id="ipz-end" required><option value="">Hora final</option>'+T.slice(1).map(function(t){return '<option value="'+t+'" '+(t===st.end?'selected':'')+'>'+t+'</option>'}).join('')+'</select></div></div></div></div>'+
 '<div class="ipz-v9-courts" role="group" aria-labelledby="ipz-courts-title"><div class="ipz-v9-courts-header"><span id="ipz-courts-title">Selecciona o teu campo</span><span id="availability-note" role="status" aria-live="polite">Escolhe a data e o horário para consultar a disponibilidade.</span></div><div class="ipz-v9-court-grid">'+C.map(function(c,i){return '<label class="ipz-v9-court" data-court="'+c+'"><input type="radio" name="ipz-court" value="'+c+'" '+(st.court===c?'checked':'')+'><span class="ipz-v9-court-icon">'+String(i+1).padStart(2,'0')+'</span><span class="ipz-v9-court-label">'+c+'<small data-court-status="'+c+'">Por verificar</small></span><span class="ipz-v9-check" aria-hidden="true">✓</span></label>'}).join('')+'</div></div>'+
 '<div class="ipz-v7-total"><span>Valor da reserva <small>1.700 MT / hora</small></span><strong id="ipz-v7-price">'+(bookingHours()*BOOKING_PRICE).toLocaleString('pt-PT')+' MT</strong></div>'+
 '<div class="ipz-v7-field"><label for="bn">Nome</label><input id="bn" autocomplete="given-name" maxlength="80" value="'+escapeBooking(st.first)+'" required></div>'+
 '<div class="ipz-v7-field"><label for="bl">Apelido</label><input id="bl" autocomplete="family-name" maxlength="80" value="'+escapeBooking(st.last)+'" required></div>'+
 '<div class="ipz-v7-pair"><div class="ipz-v7-field"><label for="bi">Número de B.I.</label><input id="bi" maxlength="30" autocomplete="off" value="'+escapeBooking(st.bi)+'" placeholder="Bilhete de Identidade" required></div><div class="ipz-v7-field"><label for="bt">Número de telefone</label><div class="ipz-v7-phone"><span>+258</span><input id="bt" type="tel" inputmode="numeric" maxlength="11" autocomplete="tel-national" value="'+formatMobile(st.phone)+'" placeholder="84 xxx xxxx" required></div></div></div>';
 }
 if(st.s===1){h='<div class="ipz-v7-heading"><span class="ipz-v7-step">ETAPA 02 / 02</span><h2>Confirmar por WhatsApp</h2><p>Revê os detalhes da reserva antes de a registar como pedido pendente.</p></div>'+
 '<div class="ipz-wa-booking-summary"><p><b>Data:</b> '+bookingDateLabel(st.date)+'</p><p><b>Campo:</b> '+escapeBooking(st.court)+'</p><p><b>Horário:</b> '+st.start+'–'+st.end+'</p><p><b>Nome:</b> '+escapeBooking(st.first+' '+st.last)+'</p><p><b>Contacto:</b> '+escapeBooking(mzPhone(st.phone))+'</p><p><b>Valor estimado:</b> '+(bookingHours()*BOOKING_PRICE).toLocaleString('pt-PT')+' MT</p></div>'+
 '<div class="ipz-wa-booking-notice">Não há pagamento no website. O pedido fica pendente no painel e a equipa confirma disponibilidade e pagamento através do WhatsApp (+258 87 738 8644).</div>';
 }
 if(st.s===2){var b=st.bk||{};h='<div class="ipz-v7-heading"><span class="ipz-v7-step">PEDIDO DE RESERVA</span><h2>'+(b.sync===true?'Pedido registado':b.sync===false?'Pedido não registado':'A registar o pedido…')+'</h2></div><div class="ipz-v7-result"><p><b>Data:</b> '+bookingDateLabel(st.date)+'</p><p><b>Horário:</b> '+st.start+' – '+st.end+'</p><p><b>Campo:</b> '+escapeBooking(st.court)+'</p><p><b>Valor estimado:</b> '+(bookingHours()*BOOKING_PRICE).toLocaleString('pt-PT')+' MT</p>'+(b.ref?'<p><b>Referência:</b> '+escapeBooking(b.ref)+'</p>':'')+'<p>'+(b.sync===true?'O pedido ficou pendente. Clica no botão abaixo para abrir o WhatsApp e enviar a mensagem. O envio só é concluído quando carregares em Enviar no WhatsApp.':b.sync===false?'Não foi possível registar a reserva. Tenta novamente.':'A contactar o servidor…')+'</p></div>'+
 (b.sync===true?'<a class="btn ipz-wa-reservation-btn" href="'+bookingWhatsAppUrl(b)+'" target="_blank" rel="noopener noreferrer">Abrir WhatsApp e enviar pedido ↗</a>':'');
 }
 if(st.s!==2)h+='<div class="er" id="be" role="alert"></div>';
 h+='<div class="ipz-v7-actions">'+(st.s===1?'<button type="button" class="btn bo" id="bb">Voltar</button>':'')+(st.s<2?'<button type="button" class="btn" id="nx">'+(st.s===0?'Continuar':'Registar pedido')+' ↗</button>':b&&b.sync===false?'<button class="btn" type="button" id="retry-booking">Tentar novamente</button>':'<a class="btn" href="#home">Voltar ao início</a>')+'</div>';
 root.innerHTML=h;
 if(st.s===0){['ipz-cal','ipz-start','ipz-end'].forEach(function(id){var el=$('#'+id);el.addEventListener('change',function(){bookingCapture();if(id==='ipz-start'&&st.end&&st.end<=st.start){st.end='';$('#ipz-end').value='';}refreshBookingAvailability()})});document.querySelectorAll('[name=ipz-court]').forEach(function(el){el.addEventListener('change',function(){st.court=el.value;bookingCapture();refreshBookingAvailability()})});['bt'].forEach(function(id){var el=$('#'+id);el.addEventListener('input',function(){var pos=el.selectionStart;el.value=formatMobile(el.value)})});refreshBookingAvailability();}

 if($('#bb'))$('#bb').onclick=function(){bookingCapture();st.s=0;bk()};
 if($('#retry-booking'))$('#retry-booking').onclick=function(){st.s=1;bk()};
 if($('#nx'))$('#nx').onclick=async function(){bookingCapture();if(st.s===0){if(!st.date||st.date<localToday())return bookingError('Escolhe uma data válida no calendário.');if(!bookingHours())return bookingError('A hora do fim deve ser posterior à de início.');if(!C.includes(st.court))return bookingError('Escolhe um dos quatro campos.');if(!st.first.trim()||!st.last.trim())return bookingError('Preenche o nome e o apelido.');if(!/^[\p{L}\p{N}/. -]{5,30}$/u.test(st.bi))return bookingError('Indica um B.I. válido (5 a 30 caracteres).');if(!phoneValid(st.phone))return bookingError('Indica um número moçambicano válido com nove dígitos.');if(st.availability!==true)return bookingError('O campo seleccionado não está disponível neste horário.');st.s=1;bk();return;}
 if(st.s===1){var btn=$('#nx');btn.disabled=true;st.s=2;st.bk={sync:null};bk();try{st.bk=await saveBooking();bk();}catch(e){st.bk={sync:false};bk();toast(e.message)}return;}}

}
function escapeBooking(t){return String(t||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var bookingAvailabilitySeq=0;
async function refreshBookingAvailability(){
 if(st.s!==0)return;
 var seq=++bookingAvailabilitySeq,price=$('#ipz-v7-price'),note=$('#availability-note');
 if(price)price.textContent=(bookingHours()*BOOKING_PRICE).toLocaleString('pt-PT')+' MT';
 st.availability=null;
 var cards=Array.from(document.querySelectorAll('.ipz-v9-court'));
 function updateCards(available,info){
  cards.forEach(function(card){
   var input=card.querySelector('input'),name=input.value,free=available?available.includes(name):null;
   card.classList.toggle('is-busy',free===false);
   card.classList.toggle('is-free',free===true);
   input.disabled=free===false;if(free===false&&input.checked){input.checked=false;st.court='';st.availability=false;}
   var label=card.querySelector('[data-court-status]');if(label)label.textContent=free===null?'Por verificar':free?'Disponível':'Ocupado';
  });
  if(note)note.textContent=info;
 }
 if(!st.date||!bookingHours()){
  updateCards(null,'Escolhe a data e o horário para consultar a disponibilidade.');return;
 }
 updateCards(null,'A verificar disponibilidade…');
 try{
  var r=await request('/api/availability?date='+encodeURIComponent(st.date)+'&start='+encodeURIComponent(st.start)+'&end='+encodeURIComponent(st.end));
  if(seq!==bookingAvailabilitySeq||st.s!==0)return;
  var free=Array.isArray(r.availableCourts)?r.availableCourts:[];
  st.availability=free.includes(st.court);
  updateCards(free,free.length?free.length+' de 4 campos disponíveis neste horário.':'Os quatro campos estão ocupados neste horário.');
 }catch(e){
  if(seq!==bookingAvailabilitySeq||st.s!==0)return;
  st.availability=false;updateCards(null,'Não foi possível verificar os campos. Tenta novamente.');
 }
}
bk();
var K=["Raquetes","Sapatilhas","Roupa","Sacos","Packs","Bolas","Acessórios","Outlet","Pickleball","Outras raquetes"],SZ={1:["38","39","40","41","42","43"],2:["S","M","L","XL"]};
var CT=["racket","shoe","shirt","bag","bag","ball","grip","racket","racket","racket"];
var DS=["Raquetes para todos os níveis de jogo. Confirma as especificações de cada modelo com a nossa equipa.","Sapatilhas de padel para conforto e estabilidade. Consulta os tamanhos e características disponíveis.","Roupa desportiva para treino e competição. Tamanhos e materiais disponíveis sob consulta.","Sacos e mochilas para transportar as tuas raquetes e acessórios.","Packs com artigos de padel reunidos para facilitar a escolha.","Bolas para jogos e treinos. Confirma a disponibilidade e as características do produto.","Acessórios para complementar o teu equipamento de padel.","Ofertas Outlet com disponibilidade e stock limitados.","Equipamento e acessórios para Pickleball.","Outros modelos de raquetes e equipamentos relacionados."];
var PR=[
{id:"raq1",c:0,t:"racket",col:"#1673B8",n:"Raquete Controlo Carbono",p:9500,s:8},
{id:"raq2",c:0,t:"racket",col:"#0d3d6b",n:"Raquete Potência Diamante",p:6800,s:5},
{id:"sap1",c:1,t:"shoe",col:"#1673B8",n:"Sapatilhas de Padel Aderência",p:5200,s:10},
{id:"sap2",c:1,t:"shoe",col:"#101E29",n:"Sapatilhas Indoor Leves",p:4600,s:3},
{id:"ves1",c:2,t:"shirt",col:"#CFF902",n:"T-shirt Técnica Respirável",p:1400,s:20},
{id:"ves2",c:2,t:"shirt",col:"#1673B8",n:"Camisola de Manga Comprida",p:2100,s:6},
{id:"bol1",c:5,t:"ball",col:"#CFF902",n:"Tubo de 3 Bolas de Padel",p:450,s:40},
{id:"bol2",c:5,t:"ball",col:"#CFF902",n:"Cesto de 24 Bolas de Treino",p:4200,s:4},
{id:"mo1",c:3,t:"bag",col:"#101E29",n:"Mochila de Padel",p:2800,s:7},
{id:"mo2",c:3,t:"bag",col:"#1673B8",n:"Saco para Raquetes",p:1900,s:2},
{id:"ac1",c:6,t:"grip",col:"#1673B8",n:"Overgrips (pack de 3)",p:300,s:60},
{id:"ac2",c:6,t:"grip",col:"#101E29",n:"Munhequeiras (par)",p:250,s:0}];
function gp(id){return PR.filter(function(x){return x.id===id})[0]}
function money(n){return n.toLocaleString("pt-PT")+" MT"}
function stk(p){return p.s<=0?"Esgotado":p.s<=3?"Últimas "+p.s+" unidades":"Em stock"}
function art(p,v){if(Array.isArray(p.images)&&p.images[v]&&(/^(data:image\/(webp|jpeg|png);base64,|\/api\/product-image\/[a-zA-Z0-9_-]+\/[0-3]\?v=[a-f0-9]+$)/.test(p.images[v])))return '<img class="ipz-product-photo" src="'+p.images[v]+'" alt="Fotografia '+(v+1)+' de '+E(p.n)+'" loading="lazy">';var c=p.col,g="",i,x,y;
if(p.t==="racket"){g='<ellipse cx="100" cy="78" rx="50" ry="60" fill="'+c+'"/><ellipse cx="100" cy="78" rx="41" ry="51" fill="#fff"/>';for(x=78;x<=122;x+=11)for(y=50;y<=106;y+=11)if(Math.pow((x-100)/36,2)+Math.pow((y-78)/46,2)<1)g+='<circle cx="'+x+'" cy="'+y+'" r="2.6" fill="'+c+'"/>';g+='<path d="M82 128L100 152L118 128z" fill="'+c+'"/><rect x="94" y="150" width="12" height="40" rx="5" fill="#101E29"/>'}
if(p.t==="shoe")g='<path d="M26 132V92Q58 88 78 66L100 78Q120 98 152 104Q178 108 180 132z" fill="'+c+'"/><rect x="22" y="130" width="162" height="16" rx="8" fill="#101E29"/><path d="M84 76l12 18M98 84l12 16M112 92l10 14" stroke="#CFF902" stroke-width="4" stroke-linecap="round"/>';
if(p.t==="shirt")g='<path d="M70 38L100 52L130 38L174 62L156 94L138 84V162H62V84L44 94L26 62z" fill="'+c+'"/><path d="M84 40Q100 64 116 40" stroke="#101E29" stroke-width="5" fill="none"/>';
if(p.t==="ball")g='<circle cx="100" cy="100" r="54" fill="#CFF902"/><path d="M58 66Q104 100 58 136M142 64Q96 100 142 134" stroke="#fff" stroke-width="5" fill="none"/>';
if(p.t==="bag")g='<path d="M78 62Q78 32 100 32Q122 32 122 62" stroke="#101E29" stroke-width="7" fill="none"/><rect x="48" y="58" width="104" height="116" rx="24" fill="'+c+'"/><rect x="66" y="112" width="68" height="46" rx="10" fill="#fff" opacity=".25"/><path d="M60 92H140" stroke="#CFF902" stroke-width="4"/>';
if(p.t==="grip")g='<rect x="46" y="64" width="108" height="30" rx="15" fill="'+c+'"/><rect x="46" y="104" width="108" height="30" rx="15" fill="#CFF902"/><rect x="46" y="144" width="108" height="30" rx="15" fill="'+c+'" opacity=".7"/>';
var bg=["#e9f1f8","#dfe9f2","#eef3df","#101E29"][v],tr=["","translate(100 100) scale(1.9) translate(-100 -92)","rotate(-18 100 100)","translate(100 100) scale(.85) translate(-100 -100)"][v];
return '<svg viewBox="0 0 200 200" role="img" aria-label="'+p.n+' (imagem ilustrativa)"><rect width="200" height="200" fill="'+bg+'"/><g transform="'+tr+'">'+g+'</g></svg>'}
function card(p){var o=p.s<=0;return '<div class="pc"><a href="#produto-'+p.id+'" aria-label="'+p.n+'">'+art(p,0)+'</a><div class="pb"><small>'+K[p.c]+'</small><h3><a href="#produto-'+p.id+'">'+p.n+'</a></h3><div class="pp">'+money(p.p)+'</div><small class="'+(o?"out":"ok")+'">'+stk(p)+'</small>'+(o?"":SZ[p.c]?'<a class="btn" href="#produto-'+p.id+'">Escolher tamanho</a>':'<button class="btn" data-add="'+p.id+'">Adicionar ao carrinho</button>')+'</div></div>'}
var F={c:-1,q:"",o:"f"},cart=[],ps={},ord=null;
try{cart=JSON.parse(localStorage.getItem("ipz-cart")||"[]").filter(function(l){return gp(l.id)})}catch(e){cart=[]}
function cc(){var n=0;cart.forEach(function(l){n+=l.q});$("#fc").textContent=n;try{localStorage.setItem("ipz-cart",JSON.stringify(cart))}catch(e){}}
function tot(){var t=0;cart.forEach(function(l){t+=gp(l.id).p*l.q});return t}
function toast(t){var e=$("#tt");e.textContent=t;e.classList.add("on");clearTimeout(toast.h);toast.h=setTimeout(function(){e.classList.remove("on")},2000)}
function msg(t){var e=$("#pm");if(e)e.textContent=t;else toast(t)}
function cats(){$("#cats").innerHTML=["Todos"].concat(K).map(function(c,i){return '<button class="ch" aria-pressed="'+(i-1===F.c)+'" data-c="'+(i-1)+'">'+c+"</button>"}).join("")}
function list(){var a=PR.filter(function(p){return p.pub!==false&&(F.c<0||p.c===F.c)&&(!F.q||(p.n+" "+K[p.c]).toLowerCase().indexOf(F.q)>=0)});
if(F.o==="a")a.sort(function(x,y){return x.p-y.p});if(F.o==="d")a.sort(function(x,y){return y.p-x.p});
$("#prods").innerHTML=a.length?a.map(card).join(""):'<p>Nenhum produto encontrado. <button class="lk" data-clr="1">Limpar filtros</button></p>'}
function add(id,sz,q){var p=gp(id);if(!p||p.s<=0){msg("Produto esgotado.");return false}
if(SZ[p.c]&&!sz){msg("Escolhe o tamanho antes de adicionar.");return false}
var have=0,ln=null;cart.forEach(function(l){if(l.id===id){have+=l.q;if(l.sz===sz)ln=l}});
if(have+q>p.s){msg("Só existem "+p.s+" unidades em stock.");return false}
if(ln)ln.q+=q;else cart.push({id:id,sz:sz,q:q});cc();toast("Adicionado ao carrinho");return true}
function prod(id){var p=gp(id);if(!p){$("#pv").innerHTML='<p>Produto não encontrado.</p><a class="btn" href="#loja">Voltar à loja</a>';return}ps={id:id,sz:null,q:1,v:0};drawP()}
function drawP(){var p=gp(ps.id),o=p.s<=0,rel=PR.filter(function(x){return x.c===p.c&&x.id!==p.id}).concat(PR.filter(function(x){return x.c!==p.c})).slice(0,3);
var h='<a href="#loja" class="lk" style="margin:0">← Voltar à loja</a><div class="pv" style="margin-top:14px"><div><div class="zm" id="zm">'+art(p,ps.v)+'</div><div class="ths">'+[0,1,2,3].map(function(i){return '<button data-th="'+i+'" aria-pressed="'+(i===ps.v)+'" aria-label="Foto '+(i+1)+'">'+art(p,i)+"</button>"}).join("")+'</div></div><div>';
h+='<small style="color:var(--mut)">'+K[p.c]+'</small><h2 style="text-transform:none;margin:6px 0 10px">'+p.n+'</h2><div class="pp" style="font-size:1.5rem">'+money(p.p)+'</div><small class="'+(o?"out":"ok")+'">'+stk(p)+'</small>';
if(SZ[p.c])h+='<label>Tamanho</label><div>'+SZ[p.c].map(function(z){return '<button class="ch" data-sz="'+z+'" aria-pressed="'+(ps.sz===z)+'">'+z+"</button>"}).join("")+"</div>";
h+='<label>Quantidade</label><div class="qt"><button data-q="-1" aria-label="Diminuir quantidade" title="Diminuir quantidade"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg></button><span>'+ps.q+'</span><button data-q="1" aria-label="Aumentar quantidade" title="Aumentar quantidade"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg></button></div><div class="er" id="pm" style="margin-top:8px"></div>';
h+=o?'<p class="out">Produto esgotado.</p>':'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn" data-addp="1" style="padding:13px 20px">Adicionar ao carrinho</button><button class="btn bo" data-buy="1" style="padding:13px 20px">Adicionar e ver carrinho</button></div>';
h+='<h3 style="margin:26px 0 8px;font-size:1rem">Descrição</h3><p style="color:var(--mut);font-size:.85rem">'+DS[p.c]+'</p><h3 style="margin:20px 0 8px;font-size:1rem">Especificações</h3><table class="spt"><tr><td>Categoria</td><td>'+K[p.c]+'</td></tr><tr><td>Marca</td><td>[por confirmar]</td></tr><tr><td>Material</td><td>[por confirmar]</td></tr><tr><td>Referência</td><td>'+p.id.toUpperCase()+'</td></tr></table><h3 style="margin:20px 0 8px;font-size:1rem">Entrega ou levantamento</h3><p style="color:var(--mut);font-size:.85rem">Levantamento na loja ou entrega local. Prazos e taxas: [por confirmar pela Indoor Padel Zone].</p></div></div>';
h+='<h2 style="margin:44px 0 14px;font-size:1.4rem">Também te pode interessar</h2><div class="pg">'+rel.map(card).join("")+"</div>";
$("#pv").innerHTML=h;var z=$("#zm"),sv=z.querySelector("svg");z.onmousemove=function(e){var r=z.getBoundingClientRect();sv.style.transformOrigin=((e.clientX-r.left)/r.width*100)+"% "+((e.clientY-r.top)/r.height*100)+"%"}}
// Pedidos comerciais via WhatsApp: registar no Neon ANTES de abrir a conversa.
var IPZ_WHATSAPP='258877388644',ipzOrderSaving=false;
function ipzCartSignature(){return JSON.stringify(cart.map(function(l){return {id:l.id,sz:l.sz||'',q:l.q}}));}
function ipzRequestKey(signature){
 var current=null;try{current=JSON.parse(sessionStorage.getItem('ipz-wa-request')||'null')}catch(e){}
 if(current&&current.signature===signature&&current.id)return current.id;
 var id=window.crypto&&crypto.randomUUID?crypto.randomUUID(): 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});
 try{sessionStorage.setItem('ipz-wa-request',JSON.stringify({signature:signature,id:id}))}catch(e){}return id;
}
function whatsappMessage(order){
 var rows=['Olá, Indoor Padel Zone! 👋','Gostaria de confirmar a disponibilidade destes produtos:'];
 if(order)rows.push('Referência do pedido: '+order.ref);
 rows.push('');
 (order?order.items:cart.map(function(l){var p=gp(l.id);return p?{n:p.n,sz:l.sz,q:l.q,u:p.p,t:p.p*l.q}:null}).filter(Boolean)).forEach(function(it,i){rows.push((i+1)+'. '+it.n+(it.sz?' (Tamanho '+it.sz+')':'')+' — '+it.q+' × '+money(it.u)+' = '+money(it.t));});
 rows.push('','Subtotal estimado: '+money(order?order.total:tot()),'Entrega/levantamento e pagamento a combinar pelo WhatsApp.','Por favor, confirmem a disponibilidade e o valor final.');
 return rows.join('\n');
}
function whatsappLink(order){return 'https://wa.me/'+IPZ_WHATSAPP+'?text='+encodeURIComponent(whatsappMessage(order));}
function cartView(){
 var el=$('#cv');
 if(!cart.length){el.innerHTML='<p>O teu carrinho está vazio.</p><a class="btn" href="#loja">Ir para a loja</a>';return;}
 el.innerHTML=cart.map(function(l,i){var p=gp(l.id);if(!p)return '';return '<div class="it"><div class="ti">'+art(p,0)+'</div><div><h3>'+E(p.n)+'</h3><small>'+(l.sz?'Tamanho '+E(l.sz)+' · ':'')+money(p.p)+'</small><div class="qt"><button data-cq="'+i+':-1" aria-label="Diminuir quantidade" title="Diminuir quantidade"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg></button><span>'+l.q+'</span><button data-cq="'+i+':1" aria-label="Aumentar quantidade" title="Aumentar quantidade"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg></button><button class="lk" data-rm="'+i+'">Remover</button></div></div><b>'+money(p.p*l.q)+'</b></div>'}).join('')+
 '<div class="sum"><div><span>Subtotal estimado</span><b>'+money(tot())+'</b></div><div><span>Entrega</span><span>A combinar</span></div><div class="ipz-wa-contact"><label for="ipz-order-name">Nome (opcional)</label><input id="ipz-order-name" type="text" autocomplete="name" maxlength="120" placeholder="Como te devemos identificar?"><label for="ipz-order-phone">Telefone (opcional)</label><input id="ipz-order-phone" type="tel" autocomplete="tel" placeholder="+258 84 123 4567"></div><p class="ipz-wa-note">Ao continuar, a lista fica registada no painel Admin como <b>pedido por confirmar</b>. Depois abre-se o WhatsApp para enviares a mensagem. Ainda não é uma compra paga ou concluída.</p><button type="button" class="btn ipz-wa-send" data-wa-submit="1">Enviar lista pelo WhatsApp ↗</button><p id="ipz-wa-feedback" role="status" aria-live="polite"></p><a class="btn bo" href="#loja">Continuar a escolher</a></div>';
}
document.addEventListener('click',async function(e){
 var button=e.target.closest('[data-wa-submit]');if(!button||ipzOrderSaving)return;
 e.preventDefault();if(!cart.length)return;
 var number=($('#ipz-order-phone')||{}).value||'',name=($('#ipz-order-name')||{}).value||'';
 if(number&&!/^(?:\+?258)?8\d{8}$/.test(number.replace(/[\s()-]/g,''))){toast('Verifica o número de telefone moçambicano.');return;}
 var sig=ipzCartSignature(),feedback=$('#ipz-wa-feedback');
 var popup=window.open('about:blank','_blank');if(popup){popup.document.title='A preparar pedido';popup.document.body.textContent='A registar o pedido na Indoor Padel Zone…';}
 ipzOrderSaving=true;button.disabled=true;button.textContent='A registar pedido…';
 try{
  var result=await request('/api/submit/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:ipzRequestKey(sig),cn:name,cp:number,items:cart.map(function(x){return{id:x.id,sz:x.sz||'',q:x.q}})})});
  var order=result.item,url=whatsappLink(order);
  if(feedback)feedback.textContent='Pedido '+order.ref+' registado no painel. Confirma o envio no WhatsApp.';
  if(popup&&!popup.closed)popup.location.href=url;else {var anchor=document.createElement('a');anchor.href=url;anchor.target='_blank';anchor.rel='noopener noreferrer';anchor.textContent='Abrir mensagem no WhatsApp';if(feedback)feedback.appendChild(anchor);}
  toast('Pedido registado. Envia a mensagem no WhatsApp.');
 }catch(err){if(popup&&!popup.closed)popup.close();if(feedback)feedback.textContent=err.message||'Não foi possível registar o pedido.';toast('Não foi possível registar. Tenta novamente.');}
 finally{ipzOrderSaving=false;button.disabled=false;button.textContent='Enviar lista pelo WhatsApp ↗';}
});
function checkout(){location.hash='#carrinho';}
function od(){location.hash='#carrinho';}
var REMOTE=false,DB=null,UID=null,CW=null,IS_ADM=false,ROLE=null,READY=false,ORD=[],BKG=[],MSG=[],AH="admin",AQ="",busy=false;
var E=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
function nowIso(){return new Date().toISOString()}
function pushList(col,item){
 if(REMOTE)return fetch('/api/submit/'+col,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)}).then(async function(r){var j=await r.json();if(!r.ok)throw Error(j.error||'Não foi possível guardar');if(col==='orders'&&ord&&ord.ref===item.ref)Object.assign(ord,j.item);if(col==='bookings'&&st.bk&&st.bk.ref===item.ref)Object.assign(st.bk,j.item);return true}).catch(function(err){toast(err.message);return false});
 if(!DB||!UID||CW===false)return Promise.resolve(false);var ref=DB.collection(col).doc(UID);
 return ref.get().then(function(s){var l=s.exists?(s.data().list||[]):[];l.push(item);return ref.set({list:l})}).then(function(){return true},function(){return false})
}
function updItem(col,u,rf,patch){
 if(!REMOTE)return Promise.reject(Error('Servidor indisponível'));
 return request('/api/item/'+col+'/'+encodeURIComponent(rf),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});
}
function flat(snap){var a=[];snap.docs.forEach(function(d){((d.data()||{}).list||[]).forEach(function(o){a.push(Object.assign({},o,{_u:d.id}))})});a.sort(function(x,y){return(y.at||"")>(x.at||"")?1:-1});return a}
function prodSnap(snap){snap.docs.forEach(function(d){var x=d.data(),p=gp(d.id);if(p){if(typeof x.p==="number")p.p=x.p;if(typeof x.s==="number")p.s=x.s;p.pub=x.pub!==false;p.images=Array.isArray(x.images)?x.images:[];p.n=x.n||p.n;p.c=Number.isInteger(x.c)?x.c:p.c;p.categoryVersion=x.categoryVersion||2;}else if(x.custom){PR.push({id:d.id,c:x.c,t:CT[x.c]||"racket",col:"#1673B8",n:x.n,p:x.p,s:x.s,pub:x.pub!==false,images:Array.isArray(x.images)?x.images:[],categoryVersion:x.categoryVersion||2})}});
cats();list();hf();if($("#v-produto").classList.contains("on")&&ps.id&&gp(ps.id))drawP();admRefresh()}
function stockSet(id,fn){var p=gp(id);if(!p)return Promise.resolve();var ref=DB.collection("products").doc(id);return ref.get().then(function(s){var b=s.exists?s.data():{p:p.p,s:p.s,pub:true};return ref.set(Object.assign({},b,{s:Math.max(0,fn(typeof b.s==="number"?b.s:p.s))}))})}
function applyStock(){if(REMOTE||busy||!IS_ADM)return;var o=ORD.filter(function(x){return!x.ap&&x.st!=="Cancelado"})[0];if(!o)return;busy=true;var ch=Promise.resolve();
o.items.forEach(function(it){ch=ch.then(function(){return stockSet(it.id,function(c){return c-it.q})})});
ch.then(function(){return updItem("orders",o._u,o.ref,{ap:true})}).then(function(){busy=false;applyStock()},function(){busy=false})}
function subAdm(){["orders","bookings","messages"].forEach(function(c){DB.collection(c).onSnapshot(function(snap){var a=flat(snap);if(c==="orders"){ORD=a;applyStock()}else if(c==="bookings")BKG=a;else MSG=a;admRefresh()},function(){})})}
// Cliente da API partilhada. A leitura de dados privados exige sessão admin.
function request(url,opts){return fetch(url,Object.assign({credentials:'same-origin'},opts||{})).then(async function(r){var j=await r.json();if(!r.ok)throw Error(j.error||'Erro da API');return j})}
function remoteDB(){return {collection:function(c){return{
 doc:function(id){return{
  get:function(){return request('/api/doc/'+c+'/'+encodeURIComponent(id)).then(function(v){return{exists:v.exists,data:function(){return v.data}}})},
  set:function(value){return request('/api/doc/'+c+'/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)})}
 }},
 onSnapshot:function(fn){var active=true,previous='';function poll(){if(!active)return;request('/api/snapshot/'+c).then(function(v){var key=JSON.stringify(v.docs);if(key===previous)return;previous=key;fn({docs:v.docs.map(function(o){return{id:o.id,data:function(){return o.data}}})})}).catch(function(e){console.warn('Sincronização '+c,e.message)})}poll();var timer=setInterval(poll,2500);return function(){active=false;clearInterval(timer)}}
}}}}
function beginData(){DB=remoteDB();UID='local';CW=true;READY=true;
 DB.collection('products').onSnapshot(prodSnap);if(IS_ADM)subAdm();admRenderIfNeeded()}
function admRenderIfNeeded(){if(document.body.classList.contains('adm'))admRender(true)}
function initData(){request('/api/session').then(function(v){REMOTE=true;IS_ADM=!!v.admin;ROLE=v.role||null;beginData()},function(){REMOTE=true;IS_ADM=false;ROLE=null;beginData();toast('Sem ligação ao servidor. Compras e reservas não podem ser registadas.')})}
function loginAdmin(email,password){return request('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,password:password})}).then(function(v){IS_ADM=true;ROLE=v.role;ORD=[];BKG=[];MSG=[];subAdm();admRender(true)})}

var SO=["Por processar","Em preparação","Pronto","Entregue","Cancelado"],SB=["Pendente","Confirmada","Cancelada"];
function fd(i){var d=new Date(i);return isNaN(d)?"":d.toLocaleDateString("pt-PT")+" "+d.toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})}
function sel(list,v,at){return "<select "+at+">"+list.map(function(x){return "<option"+(x===v?" selected":"")+">"+x+"</option>"}).join("")+"</select>"}
function chip(s){var c={Entregue:"g",Confirmada:"g",Pago:"g",Cancelado:"r",Cancelada:"r","Por processar":"y",Pendente:"y"}[s]||"b";return '<span class="cp2 '+c+'">'+E(s)+"</span>"}
function mt(o){return!AQ||JSON.stringify(o).toLowerCase().indexOf(AQ)>=0}
function admRender(sh){var el=$("#adm");if(!READY){el.innerHTML='<div class="ax">A carregar…</div>';return}
if(!IS_ADM){el.innerHTML='<div class="ax ipz-login"><div class="ipz-login-mark">◉</div><h2>Área reservada</h2><p>Inicia sessão com as credenciais de Admin ou Recepcionista.</p><form id="admin-login"><label for="admin-email">Email profissional</label><input type="email" id="admin-email" required autocomplete="username" placeholder="nome@idpz.com"><label for="admin-pass">Palavra-passe</label><input type="password" id="admin-pass" required autocomplete="current-password"><div class="er" id="login-error" role="alert"></div><button class="btn" type="submit" style="margin-top:16px">Entrar no painel</button> <a class="btn bo" href="#home">Voltar ao site</a></form></div>';return}
if(ROLE!=="admin"&&["admin-produtos","admin-galeria","admin-torneios","admin-relatorios"].includes(AH))AH="admin";if(sh||!el.querySelector(".ad-wrap")){var nav=[["admin","Painel"],["admin-pedidos","Compras"],["admin-reservas","Reservas"]].concat(ROLE==="admin"?[["admin-produtos","Produtos"],["admin-galeria","Galeria"],["admin-torneios","Torneios"]]:[]).concat([["admin-mensagens","Mensagens"]]).concat(ROLE==="admin"?[["admin-relatorios","Relatórios"]]:[]),lg=($(".hl")||{}).src||"";
var nb=MSG.filter(function(m){return!m.rd}).length;
el.innerHTML='<div class="ad-wrap"><aside class="ad-sb"><a href="#home" aria-label="Ver o site"><img src="'+lg+'" alt="Indoor Padel Zone"></a><div class="ad-mn">MENU</div>'+nav.map(function(n){return '<a class="nl'+(n[0]===AH?" on":"")+'" href="#'+n[0]+'"><i></i>'+n[1]+(n[0]==="admin-mensagens"&&nb?'<b class="nbd">'+nb+"</b>":"")+"</a>"}).join("")+'<div class="ad-mn">GERAL</div><a class="nl" href="#home"><i></i>Ver o site</a><a class="nl" href="#loja"><i></i>Ver a loja</a><div class="ad-sidebar-spacer"></div><button class="nl ad-logout" type="button" data-logout="1"><i></i>Terminar sessão</button></aside><div class="ad-main"><div class="ad-top"><input id="aq" type="search" placeholder="Pesquisar" aria-label="Pesquisar" value="'+E(AQ)+'"><div class="ad-pf"><i>A</i><div><b>'+(ROLE==="admin"?"Administração":"Recepcionista")+'</b><br><small>'+(ROLE==="admin"?"admin@idpz.com":"geral@idpz.com")+'</small></div></div></div><div class="ad-pg" id="adc"></div></div></div>'}
admContent();
// Compatibilidade com sessões antigas: a caixa informativa não pertence mais ao painel.
el.querySelectorAll('.ad-sb .ad-card').forEach(function(card){card.remove()});
}
function admRefresh(){if(document.body.classList.contains("adm")&&$("#adc")&&IS_ADM){var nb=MSG.filter(function(m){return!m.rd}).length,l=document.querySelector('a[href="#admin-mensagens"]');if(l)l.innerHTML="<i></i>Mensagens"+(nb?'<b class="nbd">'+nb+"</b>":"");admContent()}else if(document.body.classList.contains("adm"))admRender(true)}
function hd(t,s,x){return '<div class="ah"><div><h1>'+t+"</h1><p>"+s+"</p></div><div>"+(x||"")+"</div></div>"}
function admContent(){var el=$("#adc"),h=AH;
 try{
 el.innerHTML=h==="admin-pedidos"?tbO():h==="admin-reservas"?tbB():h==="admin-produtos"?(ROLE==="admin"?tbP():dash()):h==="admin-mensagens"?tbM():h==="admin-relatorios"?(ROLE==="admin"?reportsPage():dash()):["admin-galeria","admin-torneios"].includes(h)?'<section id="ipz-community-admin"><h2>A carregar…</h2></section>':dash();
 if(["admin-galeria","admin-torneios"].includes(h)&&window.IPZCommunity)window.IPZCommunity.renderAdmin(h,{orders:ORD,bookings:BKG});
 }catch(error){console.error('Erro ao apresentar a secção administrativa:',h,error);el.innerHTML='<section class="kp" role="alert"><h2>Não foi possível apresentar esta secção</h2><p>Actualiza a página. Se o erro continuar, abre a consola do navegador e envia a mensagem à equipa técnica.</p></section>';}
}
function dash(){
// O painel começa automaticamente um novo mês à meia-noite em Maputo;
// o histórico permanece no Neon e pode ser exportado em Relatórios.
var monthlyOrders=ORD.filter(ipzCreatedThisMonth),monthlyBookings=BKG.filter(ipzCreatedThisMonth),monthlyMessages=MSG.filter(ipzCreatedThisMonth);var ok=monthlyOrders.filter(function(o){return o.st!=="Cancelado"}),rev=0,i;ok.filter(function(o){return o.st==='Entregue'}).forEach(function(o){rev+=o.total});
var pend=monthlyBookings.filter(function(b){return b.st==="Pendente"}).length,unr=monthlyMessages.filter(function(m){return!m.rd}).length,days=[],mx=1,best=null;
for(i=6;i>=0;i--){var d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);days.push({d:d,n:0})}
ok.forEach(function(o){var t=new Date(o.at);t.setHours(0,0,0,0);days.forEach(function(x){if(x.d.getTime()===t.getTime())x.n++})});
days.forEach(function(x){if(x.n>mx)mx=x.n;if(x.n&&(!best||x.n>best.n))best=x});
var bars=days.map(function(x){return '<div class="bc"><div class="bb '+(x.n?(x===best?"hi":"md"):"hz")+'" style="height:'+(x.n?30+70*x.n/mx:40)+'%">'+(x.n||"")+"</div><small>"+"DSTQQSS".charAt(x.d.getDay())+"</small></div>"}).join("");
var nowT=new Date(),nx=monthlyBookings.filter(function(b){return b.st!=="Cancelada"&&new Date(b.date+"T"+b.time)>=nowT}).sort(function(a,b){return(a.date+a.time)>(b.date+b.time)?1:-1})[0];
var ty=nowT.getFullYear()+"-"+("0"+(nowT.getMonth()+1)).slice(-2)+"-"+("0"+nowT.getDate()).slice(-2),hoje=monthlyBookings.filter(function(b){return b.date===ty&&b.st!=="Cancelada"});
var dn=ok.filter(function(o){return o.st==="Entregue"}).length,pg=ok.filter(function(o){return o.st==="Em preparação"||o.st==="Pronto"}).length,pd=ok.length-dn-pg,pc=ok.length?Math.round(dn/ok.length*100):0,a1=ok.length?dn/ok.length*100:0,a2=ok.length?pg/ok.length*100:0,a3=ok.length?pd/ok.length*100:0;
var arc='<path d="M20 100A80 80 0 0 1 180 100" pathLength="100" fill="none" stroke-width="26" stroke-linecap="butt" ';
var low=PR.filter(function(p){return p.pub!==false&&p.s<=3}).sort(function(a,b){return a.s-b.s}).slice(0,5),cl=["#fbd5d5","#d5f0c8","#d5dcfb","#fbe9c4"];
return hd("Painel","Indicadores do mês actual · "+ipzCurrentMonthLabel()+" · Maputo. Histórico em Relatórios.",(ROLE==='admin'?'<a class="btn" href="#admin-produtos" style="padding:11px 20px">+ Adicionar Produto</a> ':'')+'<button class="btn bo" data-ex="1" style="padding:11px 20px">Exportar Excel · 45 dias</button>')+
'<div class="dg"><div class="kp k1"><div class="kt">Compras totais<a href="#admin-pedidos" class="ka">↗</a></div><div class="kn">'+monthlyOrders.length+'</div><small>'+monthlyOrders.filter(function(o){return o.st==="Por processar"}).length+' por processar</small></div>'+
'<div class="kp"><div class="kt">Vendas entregues no mês<a href="#admin-pedidos" class="ka">↗</a></div><div class="kn">'+rev.toLocaleString("pt-PT")+'<small> MT</small></div><small class="gr">Valor estimado das encomendas entregues; pagamento a confirmar</small></div>'+
'<div class="kp"><div class="kt">Reservas<a href="#admin-reservas" class="ka">↗</a></div><div class="kn">'+monthlyBookings.length+'</div><small class="gr">'+pend+' por confirmar</small></div>'+
'<div class="kp"><div class="kt">Mensagens<a href="#admin-mensagens" class="ka">↗</a></div><div class="kn">'+monthlyMessages.length+'</div><small class="gr">'+unr+' por ler</small></div>'+
'<div class="kp span2"><div class="kt">Compras nos últimos 7 dias</div><div class="bs">'+bars+'</div></div>'+
'<div class="kp"><div class="kt">Próxima reserva</div>'+(nx?'<div class="rm">'+E(nx.court)+"</div><small>"+E(nx.date.split("-").reverse().join("/"))+" · "+E(nx.time)+"<br>"+E(nx.cn)+"</small>":'<div class="rm" style="font-size:1rem;color:#7b8892">Sem reservas futuras</div>')+'<a class="btn" href="#admin-reservas" style="margin-top:14px;justify-content:center;padding:11px 16px">Ver reservas</a></div>'+
'<div class="kp"><div class="kt">Stock baixo<a href="#admin-produtos" class="ka">↗</a></div>'+(low.length?low.map(function(p){return '<div class="li"><span>'+E(p.n)+"</span><b>"+(p.s<=0?"Esgotado":p.s+" un.")+"</b></div>"}).join(""):"<small>Tudo em ordem.</small>")+"</div>"+
'<div class="kp span2"><div class="kt">Compras recentes<a href="#admin-pedidos" class="ka">↗</a></div>'+(ok.length?ok.slice(0,4).map(function(o,i){var n=o.items.reduce(function(a,x){return a+x.q},0);return '<div class="li" style="align-items:center"><span style="display:flex;gap:10px;align-items:center"><i class="av" style="background:'+cl[i%4]+'">'+E((o.cn||"?").charAt(0).toUpperCase())+"</i><span><b>"+E(o.cn)+"</b><br><small>"+n+" item(s) · "+o.total.toLocaleString("pt-PT")+" MT</small></span></span>"+chip(o.st)+"</div>"}).join(""):"<small>Ainda não há compras.</small>")+"</div>"+
'<div class="kp"><div class="kt">Estado das compras</div><svg viewBox="0 0 200 110" style="width:100%;margin-top:8px">'+arc+'stroke="#e3e8ec" d="M20 100A80 80 0 0 1 180 100"/>'+arc+'stroke="#101E29" stroke-dasharray="'+a1+' 100"/>'+arc+'stroke="#1673B8" stroke-dasharray="'+a2+' 100" stroke-dashoffset="'+(-a1)+'"/>'+arc+'stroke="#CFF902" stroke-dasharray="'+a3+' 100" stroke-dashoffset="'+(-(a1+a2))+'"/><text x="100" y="92" text-anchor="middle" font-size="34" font-weight="700" fill="#101E29">'+pc+'%</text></svg><div class="lg2"><span><i style="background:#101E29"></i>Entregue</span><span><i style="background:#1673B8"></i>Em curso</span><span><i style="background:#CFF902"></i>Por processar</span></div></div>'+
'<div class="kp k2"><div class="kt" style="color:#fff">Reservas de hoje</div><div class="kn" style="color:#CFF902">'+hoje.length+'</div><small style="color:#cdd6dd">'+(hoje.length?"Próxima às "+E(hoje.sort(function(a,b){return a.time>b.time?1:-1})[0].time):"Nenhuma reserva hoje")+"</small></div></div>"}
// Fecho automático do mês, sem eliminação de transacções ou reservas futuras.
function ipzLocalMonth(date){
 var d=new Date(date);if(!Number.isFinite(d.getTime()))return '';
 var parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Maputo',year:'numeric',month:'2-digit'}).format(d);
 return parts.slice(0,7);
}
function ipzCreatedThisMonth(item){return ipzLocalMonth(item.at||item.created_at||item.createdAt)===ipzLocalMonth(new Date());}
function ipzCurrentMonthLabel(){return new Intl.DateTimeFormat('pt-PT',{month:'long',year:'numeric',timeZone:'Africa/Maputo'}).format(new Date());}
var ipzLastMonth=ipzLocalMonth(new Date());
setInterval(function(){var current=ipzLocalMonth(new Date());if(current!==ipzLastMonth){ipzLastMonth=current;if(document.body.classList.contains('adm'))admRefresh();}},30000);

function ipzReportDownload(month,button){
 button.disabled=true;
 fetch('/api/admin/reports/export?month='+encodeURIComponent(month),{credentials:'same-origin'})
 .then(async function(response){if(!response.ok){var j=await response.json().catch(function(){return{}});throw Error(j.error||'Falha no relatório');}return response.blob();})
 .then(function(blob){var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='IDPZ-relatorio-'+month+'.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},10000);})
 .catch(function(err){toast(err.message)}).finally(function(){button.disabled=false;});
}
function reportsPage(){
 var now=new Date(),year=Number(ipzLocalMonth(now).slice(0,4)),month=Number(ipzLocalMonth(now).slice(5));
 var rows=Array.from({length:4},function(_,i){var d=new Date(Date.UTC(year,month-1-i,1)),key=d.toISOString().slice(0,7);return {key:key,label:new Intl.DateTimeFormat('pt-PT',{month:'long',year:'numeric',timeZone:'UTC'}).format(d),current:i===0};});
 return hd('Relatórios','Exportação Excel por mês · histórico disponível até 3 meses anteriores.')+
 '<div class="ipz-report-info"><strong>Fecho mensal automático</strong><p>Todos os dias 1 o Painel apresenta os indicadores do novo mês a zero. Os registos anteriores permanecem guardados no Neon. Os Excel são gerados no momento do download e não ficam armazenados no Render.</p></div>'+
 '<div class="ipz-report-grid">'+rows.map(function(x){return '<section class="ipz-report-card"><div><small>'+ (x.current?'MÊS ACTUAL':'MÊS ENCERRADO')+'</small><h2>'+E(x.label)+'</h2><p>'+ (x.current?'Relatório parcial até hoje.':'Compras, reservas, mensagens, produtos e torneios.')+'</p></div><button type="button" class="btn ipz-report-download" data-report-month="'+x.key+'">Descarregar Excel</button></section>'}).join('')+'</div>'+
 '<p class="ipz-report-footnote">O período disponível é renovado automaticamente: quando entra um novo mês, o relatório mais antigo deixa de estar disponível. Ficheiros já descarregados para o teu computador não podem ser eliminados pelo website.</p>';
}
document.addEventListener('click',function(e){var b=e.target.closest('[data-report-month]');if(b){if(ROLE!=='admin'){toast('Acesso reservado ao administrador.');return;}ipzReportDownload(b.dataset.reportMonth,b);}});

// Estados com filtros e alterações em rascunho, sem gravações involuntárias.
var IPZ_STATE_FILTER={orders:'Todos',bookings:'Todos'};
var IPZ_STATE_DRAFT={orders:{},bookings:{}};
var IPZ_STATE_SAVING=false;
function stateOptions(kind){return kind==='orders'?SO:SB}
function stateFilterUI(kind){var list=stateOptions(kind),active=IPZ_STATE_FILTER[kind],all=['Todos'].concat(list);
return '<div class="ipz-status-toolbar" role="group" aria-label="Filtrar '+(kind==='orders'?'compras':'reservas')+' por estado">'+all.map(function(v){var on=v===active;return '<button type="button" class="ipz-filter-chip'+(on?' is-selected':'')+'" data-state-filter="'+kind+'" data-filter-value="'+E(v)+'" aria-pressed="'+on+'">'+E(v)+'</button>'}).join('')+'</div>'}
function stateButtons(kind,item){var current=IPZ_STATE_DRAFT[kind][item.ref]||item.st;
return '<div class="ipz-state-buttons" role="group" aria-label="Estado de '+E(item.ref)+'">'+stateOptions(kind).map(function(v){var selected=current===v;return '<button type="button" class="ipz-state-choice'+(selected?' is-selected':'')+'" data-state-choose="'+kind+'" data-record-ref="'+E(item.ref)+'" data-new-state="'+E(v)+'" aria-pressed="'+selected+'">'+E(v)+'</button>'}).join('')+'</div>'+(current!==item.st?'<small class="ipz-state-pending">Alteração por guardar</small>':'')}
function stateFooter(kind){var count=Object.keys(IPZ_STATE_DRAFT[kind]).length;return '<div class="ipz-state-footer"><span id="ipz-draft-count">'+(count?count+' alteração(ões) por guardar':'Nenhuma alteração pendente')+'</span><button type="button" class="btn ipz-save-states" data-save-state="'+kind+'" '+(!count||IPZ_STATE_SAVING?'disabled':'')+'>Guardar alterações e aplicar filtro</button></div><p class="ipz-state-feedback" role="status" aria-live="polite"></p>'}
function stateFiltered(kind,list){var v=IPZ_STATE_FILTER[kind];return list.filter(mt).filter(function(x){return v==='Todos'||x.st===v})}
// Compatibilidade com os registos históricos: os gateways foram removidos,
// mas compras e reservas antigas ainda podem ter o campo `pm`.
function ipzPaymentLabel(item){
 var methods={card:'Cartão (histórico)',emola:'e-Mola (histórico)',mpesa:'M-Pesa (histórico)'};
 if(item&&item.channel==='whatsapp')return 'WhatsApp · pagamento a combinar';
 return (item&&methods[item.pm])||(item&&item.pm)||'A combinar';
}
function tbO(){var a=stateFiltered('orders',ORD);return hd('Compras','Pedidos recebidos do carrinho via WhatsApp; confirmar entrega e pagamento com o cliente.','<button class="btn bo" data-ex="1">Exportar Excel · 45 dias</button>')+stateFilterUI('orders')+'<div class="tw ipz-admin-state-table"><table class="tb2"><thead><tr><th>Referência</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Pagamento</th><th>Entrega</th><th>Estado da compra</th></tr></thead><tbody>'+(a.length?a.map(function(o){return '<tr><td><b>'+E(o.ref)+'</b><br><small>'+fd(o.at)+'</small></td><td>'+E(o.cn)+'<br><small>'+E(o.cp)+' · '+E(o.ce)+'</small></td><td>'+(o.items||[]).map(function(x){return E(x.q+'× '+x.n+(x.sz?' ('+x.sz+')':''))}).join('<br>')+'</td><td><b>'+money(o.total)+'</b></td><td>'+chip(o.pay||'A combinar')+'<br><small>'+E(ipzPaymentLabel(o))+'</small></td><td>'+(o.dl==='del'?'Entrega: '+E(o.a):'Levantamento')+'</td><td>'+stateButtons('orders',o)+'</td></tr>'}).join(''):'<tr><td colspan="7">Sem compras com este filtro.</td></tr>')+'</tbody></table></div>'+stateFooter('orders')}
function tbB(){var a=stateFiltered('bookings',BKG);return hd('Reservas','Filtrar, confirmar ou cancelar reservas de campo.')+stateFilterUI('bookings')+'<div class="tw ipz-admin-state-table"><table class="tb2"><thead><tr><th>Referência</th><th>Campo</th><th>Data e horário</th><th>Cliente</th><th>Pagamento</th><th>Estado da reserva</th></tr></thead><tbody>'+(a.length?a.map(function(b){return '<tr><td><b>'+E(b.ref)+'</b><br><small>'+fd(b.at)+'</small></td><td>'+E(b.court)+'</td><td>'+E((b.date||'').split('-').reverse().join('/'))+' · '+E(b.time)+(b.endTime?'–'+E(b.endTime):'')+'</td><td>'+E(b.cn)+'<br><small>'+E(b.bi||'')+'<br>'+E(b.cp||'')+'</small></td><td>'+chip(b.pay||'Pendente')+'<br><small>'+E(ipzPaymentLabel(b))+' · '+money(b.price||1700)+'</small></td><td>'+stateButtons('bookings',b)+'</td></tr>'}).join(''):'<tr><td colspan="6">Sem reservas com este filtro.</td></tr>')+'</tbody></table></div>'+stateFooter('bookings')}
document.addEventListener('click',async function(e){
 var filter=e.target.closest('[data-state-filter]');if(filter){IPZ_STATE_FILTER[filter.dataset.stateFilter]=filter.dataset.filterValue;admContent();return}
 var choice=e.target.closest('[data-state-choose]');if(choice){var kind=choice.dataset.stateChoose,ref=choice.dataset.recordRef,v=choice.dataset.newState,entry=(kind==='orders'?ORD:BKG).find(function(x){return x.ref===ref});if(!entry)return;if(v===entry.st)delete IPZ_STATE_DRAFT[kind][ref];else IPZ_STATE_DRAFT[kind][ref]=v;admContent();return}
 var save=e.target.closest('[data-save-state]');if(!save||IPZ_STATE_SAVING)return;
 var type=save.dataset.saveState,drafts=Object.entries(IPZ_STATE_DRAFT[type]);if(!drafts.length)return;
 IPZ_STATE_SAVING=true;save.disabled=true;var saved=0,errors=[];
 for(var [ref,st] of drafts){try{await updItem(type,'local',ref,{st:st});delete IPZ_STATE_DRAFT[type][ref];saved++;}catch(er){errors.push(ref+': '+er.message)}}
 IPZ_STATE_SAVING=false;admContent();var el=document.querySelector('.ipz-state-feedback');if(el)el.textContent=saved+' alteração(ões) guardada(s). '+(errors.length?'Erros: '+errors.join('; '):'Filtro aplicado.');
});
function tbP(){var a=PR.filter(mt);return hd('Produtos','Catálogo, preço, stock e fotografias. Cada produto pode ter 4 imagens.','')+
'<div class="tw"><table class="tb2"><tr><th>Produto</th><th>Fotos</th><th>Categoria</th><th>Preço (MT)</th><th>Stock</th><th>Publicado</th></tr>'+a.map(function(p){return '<tr><td>'+E(p.n)+'</td><td><div class="ipz-product-thumb">'+art(p,0)+'</div><button type="button" class="btn bo ipz-edit-photos" data-edit-images="'+p.id+'">Editar 4 fotos</button></td><td><select data-pf="'+p.id+'|c" aria-label="Categoria de '+E(p.n)+'">'+K.map(function(k,i){return '<option value="'+i+'" '+(p.c===i?'selected':'')+'>'+E(k)+'</option>'}).join('')+'</select></td><td><input type="number" min="0" value="'+p.p+'" data-pf="'+p.id+'|p" style="width:105px"></td><td><input type="number" min="0" value="'+p.s+'" data-pf="'+p.id+'|s" style="width:85px"></td><td><input type="checkbox" '+(p.pub!==false?'checked':'')+' data-pf="'+p.id+'|pub" style="width:auto"></td></tr>'}).join('')+'</table></div>'+
'<form id="npf" class="tw" style="margin-top:14px;padding:16px"><h3 style="margin-bottom:6px">Adicionar produto</h3><div class="npg"><div><label for="np1">Nome</label><input id="np1" required maxlength="150"></div><div><label for="np2">Categoria</label><select id="np2">'+K.map(function(k,i){return '<option value="'+i+'">'+k+'</option>'}).join('')+'</select></div><div><label for="np3">Preço (MT)</label><input id="np3" type="number" min="0" required></div><div><label for="np4">Stock</label><input id="np4" type="number" min="0" required></div></div><label for="np-images">4 fotografias obrigatórias (JPG, PNG ou WebP)</label><input id="np-images" type="file" accept="image/jpeg,image/png,image/webp" multiple required><small>As imagens serão optimizadas automaticamente e guardadas na base de dados Neon. Máximo 4 imagens por produto.</small><div id="np-images-preview" class="ipz-image-grid"></div><div class="er" id="np-error" role="alert"></div><button class="btn" type="submit" style="margin-top:14px;padding:11px 20px">Adicionar produto com imagens</button></form>'}
function tbM(){var a=MSG.filter(mt);return hd("Mensagens","Mensagens enviadas pelo formulário Fale Connosco.","")+(a.length?a.map(function(m){return '<div class="kp" style="margin-bottom:10px"><div class="kt"><span>'+E(m.n)+" · <small>"+E(m.e)+" · "+fd(m.at)+"</small></span>"+(m.rd?'<span class="cp2 b">Lida</span>':'<button class="btn" data-mr="'+E(m._u)+"|"+E(m.ref)+'" style="padding:7px 14px">Marcar como lida</button>')+"</div><p style=\"margin:8px 0 0\">"+E(m.m)+"</p></div>"}).join(""):'<div class="kp">Ainda não há mensagens.</div>')}
function csv(){var q=function(x){return '"'+String(x==null?"":x).replace(/"/g,'""')+'"'};return["Referência;Data;Cliente;Telefone;Email;Entrega;Pagamento;Estado;Total (MT);Itens"].concat(ORD.map(function(o){return[o.ref,fd(o.at),o.cn,o.cp,o.ce,o.dl==="del"?"Entrega: "+o.a:"Levantamento",ipzPaymentLabel(o),o.st,o.total,o.items.map(function(x){return x.q+"x "+x.n+(x.sz?" ("+x.sz+")":"")}).join(" | ")].map(q).join(";")})).join("\r\n")}
document.addEventListener("click",function(e){var logout=e.target.closest('[data-logout]');if(logout){request('/api/logout',{method:'POST'}).then(function(){IS_ADM=false;ROLE=null;ORD=[];BKG=[];MSG=[];admRender(true)});return}var t=e.target.closest("[data-ex],[data-mr]");if(!t)return;
if(t.hasAttribute("data-ex")){if(ROLE!=='admin'){toast('Apenas o administrador pode exportar o relatório.');return}t.disabled=true;fetch('/api/admin/export-45-days',{credentials:'same-origin'}).then(async function(r){if(!r.ok){var j=await r.json();throw Error(j.error||'Não foi possível exportar')}return r.blob()}).then(function(blob){var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='IDPZ-relatorio-45-dias.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1500)}).catch(function(e){toast(e.message)}).finally(function(){t.disabled=false})}
else{var a=t.getAttribute("data-mr").split("|");updItem("messages",a[0],a[1],{rd:true})}});
document.addEventListener("input",function(e){if(e.target.id==="aq"){AQ=e.target.value.trim().toLowerCase();admContent()}});
document.addEventListener("change",function(e){var t=e.target,a;
if(ROLE==="admin"&&t.hasAttribute&&t.hasAttribute("data-pf")){a=t.getAttribute("data-pf").split("|");var p=gp(a[0]),ref=DB.collection("products").doc(a[0]);ref.get().then(function(s){var b=s.exists?s.data():{p:p.p,s:p.s,pub:p.pub!==false},v=a[1]==="pub"?t.checked:Math.max(0,+t.value||0);b=Object.assign({},b);b[a[1]]=v;return ref.set(b)})}});
document.addEventListener("submit",function(e){if(e.target.id==='admin-login'){e.preventDefault();loginAdmin($('#admin-email').value,$('#admin-pass').value).catch(function(er){$('#login-error').textContent=er.message});return}if(e.target.id!=="npf"||ROLE!=="admin")return;e.preventDefault();var form=e.target,button=form.querySelector('[type="submit"]');button.disabled=true;var id="x"+Date.now().toString(36);readFourImages($("#np-images").files).then(function(images){return DB.collection("products").doc(id).set({custom:true,categoryVersion:2,n:$("#np1").value.trim(),c:+$("#np2").value,p:Math.max(0,+$("#np3").value||0),s:Math.max(0,+$("#np4").value||0),pub:true,images:images})}).then(function(){toast("Produto e 4 fotografias guardados");form.reset();$("#np-images-preview").innerHTML=''}).catch(function(err){$("#np-error").textContent=err.message}).finally(function(){button.disabled=false})});

function compressPhoto(file){return new Promise(function(resolve,reject){if(!/^image\/(jpeg|png|webp)$/.test(file.type))return reject(Error('Aceita apenas JPG, PNG e WebP.'));if(file.size>12*1024*1024)return reject(Error('Cada fotografia deve ter no máximo 12 MB antes de optimizar.'));var url=URL.createObjectURL(file),img=new Image();img.onload=function(){URL.revokeObjectURL(url);var scale=Math.min(1,900/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));var canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;var ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);var data='';for(var quality=.78;quality>=.28;quality-=.1){data=canvas.toDataURL('image/webp',quality);if(Math.ceil((data.length-data.indexOf(',')-1)*3/4)<=180*1024)break;}if(Math.ceil((data.length-data.indexOf(',')-1)*3/4)>180*1024)return reject(Error('A imagem é demasiado grande após a optimização. Escolhe outra.'));resolve(data)};img.onerror=function(){URL.revokeObjectURL(url);reject(Error('Não foi possível abrir uma imagem.'))};img.src=url})}
function readFourImages(files){if(!files||files.length!==4)return Promise.reject(Error('Selecciona exactamente 4 fotografias.'));return Promise.all(Array.from(files).map(compressPhoto))}
function previews(files,target){var el=document.querySelector(target);if(!el)return;el.innerHTML='';Array.from(files||[]).slice(0,4).forEach(function(f){var u=URL.createObjectURL(f),im=document.createElement('img');im.src=u;im.alt=f.name;im.onload=function(){URL.revokeObjectURL(u)};el.appendChild(im)})}
document.addEventListener('change',function(e){if(e.target.id==='np-images'){$('#np-error').textContent=e.target.files.length===4?'':'Selecciona exactamente 4 imagens.';previews(e.target.files,'#np-images-preview')}});
document.addEventListener('click',function(e){var b=e.target.closest('[data-edit-images]');if(!b||ROLE!=='admin')return;var p=gp(b.getAttribute('data-edit-images'));if(!p)return;var overlay=document.createElement('div');overlay.className='ipz-image-overlay';overlay.innerHTML='<form class="ipz-image-modal" id="ipz-image-edit"><button type="button" data-close-images="1" aria-label="Fechar" class="ipz-modal-close">×</button><h2>Fotografias de '+E(p.n)+'</h2><p>Substitui as quatro imagens. A primeira será a capa da loja.</p><div class="ipz-image-grid">'+[0,1,2,3].map(function(i){return art(p,i)}).join('')+'</div><label for="ipz-replace-photos">Seleccionar 4 fotografias</label><input id="ipz-replace-photos" type="file" multiple required accept="image/jpeg,image/png,image/webp"><div class="ipz-image-grid" id="ipz-replace-preview"></div><div class="er" id="ipz-replace-error" role="alert"></div><button class="btn" type="submit">Guardar quatro imagens</button></form>';document.body.appendChild(overlay);overlay.querySelector('[data-close-images]').onclick=function(){overlay.remove()};overlay.addEventListener('click',function(ev){if(ev.target===overlay)overlay.remove()});overlay.querySelector('input').onchange=function(e){previews(e.target.files,'#ipz-replace-preview')};overlay.querySelector('form').onsubmit=function(ev){ev.preventDefault();var btn=overlay.querySelector('[type=submit]');btn.disabled=true;readFourImages(overlay.querySelector('input').files).then(function(images){return DB.collection('products').doc(p.id).set(Object.assign({},p,{custom:!!p.custom,images:images}))}).then(function(){toast('Imagens actualizadas');overlay.remove()}).catch(function(er){overlay.querySelector('#ipz-replace-error').textContent=er.message}).finally(function(){btn.disabled=false})}});
async function saveBooking(){
 var signature=[st.court,st.date,st.start,st.end,st.first.trim(),st.last.trim(),st.bi.trim(),mzPhone(st.phone)].join('|');
 if(st.lastBookingSignature!==signature){st.lastBookingSignature=signature;st.lastBookingRequestId=(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID(): 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)})}
 var b={requestId:st.lastBookingRequestId,court:st.court,date:st.date,time:st.start,endTime:st.end,cn:st.first.trim()+' '+st.last.trim(),bi:st.bi.trim(),cp:mzPhone(st.phone),duration:bookingHours()*60};
 var response=await request('/api/submit/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
 return Object.assign({sync:true},response.item);
}

document.addEventListener("click",function(e){var t=e.target.closest("[data-add],[data-c],[data-clr],[data-th],[data-sz],[data-q],[data-addp],[data-buy],[data-cq],[data-rm]");if(!t)return;
if(t.hasAttribute("data-add"))add(t.getAttribute("data-add"),null,1);
else if(t.hasAttribute("data-c")){F.c=+t.getAttribute("data-c");cats();list()}
else if(t.hasAttribute("data-clr")){F={c:-1,q:"",o:"f"};$("#sq").value="";$("#so").value="f";cats();list()}
else if(t.hasAttribute("data-th")){ps.v=+t.getAttribute("data-th");drawP()}
else if(t.hasAttribute("data-sz")){ps.sz=t.getAttribute("data-sz");drawP()}
else if(t.hasAttribute("data-q")){var p=gp(ps.id);ps.q=Math.max(1,Math.min(p.s,ps.q+ +t.getAttribute("data-q")));drawP()}
else if(t.hasAttribute("data-addp")){if(add(ps.id,ps.sz,ps.q))drawP()}
else if(t.hasAttribute("data-buy")){if(add(ps.id,ps.sz,ps.q))location.hash="#carrinho"}
else if(t.hasAttribute("data-cq")){var a=t.getAttribute("data-cq").split(":"),l=cart[+a[0]],pp=gp(l.id),n=0;cart.forEach(function(x){if(x.id===l.id)n+=x.q});var d=+a[1];if(d>0&&n+d>pp.s){toast("Só existem "+pp.s+" unidades em stock.");return}l.q+=d;if(l.q<1)cart.splice(+a[0],1);cc();cartView()}
else if(t.hasAttribute("data-rm")){cart.splice(+t.getAttribute("data-rm"),1);cc();cartView()}});
document.addEventListener("input",function(e){if(e.target.id==="sq"){F.q=e.target.value.trim().toLowerCase();list()}});
document.addEventListener("change",function(e){var t=e.target;if(t.id==="so"){F.o=t.value;list()}

});
function hf(){$("#hf").innerHTML=PR.filter(function(p){return p.s>0&&p.pub!==false}).slice(0,4).map(card).join("")}
cats();list();hf();cc();
$("#cf").onsubmit=function(e){e.preventDefault();var ok=1;[["n","en","Indica o teu nome."],["m","em","Escreve uma mensagem."]].forEach(function(f){var b=!$("#"+f[0]).value.trim();$("#"+f[1]).textContent=b?f[2]:"";if(b)ok=0});
var b=!/^\S+@\S+\.\S+$/.test($("#e").value);$("#ee").textContent=b?"Indica um email válido.":"";if(b)ok=0;
if(ok){var mg={ref:"MSG-"+Date.now().toString(36).toUpperCase().slice(-6),at:nowIso(),n:$("#n").value.trim(),e:$("#e").value.trim(),m:$("#m").value.trim(),rd:false};$("#cm").textContent="A enviar…";pushList("messages",mg).then(function(o){$("#cm").textContent=o?"Mensagem enviada. Respondemos em breve.":"Não foi possível enviar. Verifica a ligação e tenta novamente.";if(o)$("#cf").reset()})}};
r();initData();})();
