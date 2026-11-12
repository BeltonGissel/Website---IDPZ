'use strict';
// Indoor Padel Zone: servidor público com PostgreSQL persistente (Neon/Supabase).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {Pool} = require('pg');
const ExcelJS = require('exceljs');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const PROD = process.env.NODE_ENV === 'production';
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL não configurada. Consulta README.md.'); process.exit(1); }
const passwords = {
  'admin@idpz.com': { role:'admin', password:process.env.ADMIN_PASSWORD },
  'geral@idpz.com': { role:'recepcionista', password:process.env.RECEPTION_PASSWORD }
};
if (Object.values(passwords).some(a => !a.password || a.password.length < 12)) {
  console.error('Define ADMIN_PASSWORD e RECEPTION_PASSWORD com pelo menos 12 caracteres (não uses as credenciais antigas).'); process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 12000,
  idleTimeoutMillis: 30000, ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: true } });
const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'catalog.json'),'utf8'));
const courts=['Campo 1','Campo 2','Campo 3','Campo 4'];
const times=Array.from({length:17},(_,i)=>String(i+6).padStart(2,'0')+':00');
const bookingPrice=1700;
const normalizePhone=v=>'+258'+String(v||'').replace(/\D/g,'').replace(/^258/,'');
const phoneValid=(v,method)=>{const n=normalizePhone(v);return method==='emola'?/^\+2588[67]\d{7}$/.test(n):method==='mpesa'?/^\+2588[45]\d{7}$/.test(n):/^\+2588\d{8}$/.test(n);};
const ordersStatuses=['Por processar','Em preparação','Pronto','Entregue','Cancelado'];
const bookingStatuses=['Pendente','Confirmada','Cancelada'];
const attempts=new Map();
const communityWrites=new Map();
function limitCommunity(req){
 const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
 const current=communityWrites.get(ip);const now=Date.now();
 const entry=current&&now-current.start<600000?current:{start:now,count:0};
 entry.count++;communityWrites.set(ip,entry);
 if(communityWrites.size>10000)communityWrites.clear();
 if(entry.count>5)bad('Demasiados pedidos. Tenta novamente mais tarde.',429);
}
const esc=v=>String(v??'').trim();
const cut=(v,n=160)=>esc(v).slice(0,n);
const ref=p=>p+'-'+crypto.randomBytes(6).toString('hex').toUpperCase();
const safeCompare=(a,b)=>{
  const ah=crypto.createHash('sha256').update(String(a)).digest(), bh=crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ah,bh);
};
function json(res,code,data,headers={}){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));}
function error(res,code,message){json(res,code,{error:message});}
function setCookie(token,clear=false){return `ipz_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear?0:28800}${PROD||process.env.COOKIE_SECURE==='1'?'; Secure':''}`;}
function cookies(req){return (req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('ipz_session='))?.slice(12)||'';}
function sameOrigin(req){const o=req.headers.origin;if(!o)return true;try{return new URL(o).host===req.headers.host}catch{return false;}}
function parse(req,maxBytes=80000){return new Promise((resolve,reject)=>{let data='',ended=false;req.on('data',b=>{data+=b;if(Buffer.byteLength(data,'utf8')>maxBytes&&!ended){ended=true;reject(Object.assign(new Error('Corpo demasiado grande'),{status:413}));req.destroy();}});req.on('end',()=>{if(ended)return;try{resolve(JSON.parse(data||'{}'))}catch{reject(Object.assign(new Error('JSON inválido'),{status:400}))}});req.on('error',reject);});}
async function session(req){const raw=cookies(req);if(!/^[a-f0-9]{64}$/.test(raw))return null;
 const key=crypto.createHash('sha256').update(raw).digest('hex');
 const q=await pool.query('SELECT role,email FROM ipz_sessions WHERE token_hash=$1 AND expires_at>now()',[key]);return q.rows[0]||null;}
async function boot(){
 await pool.query(`CREATE TABLE IF NOT EXISTS ipz_products (id TEXT PRIMARY KEY, data JSONB NOT NULL);
 CREATE TABLE IF NOT EXISTS ipz_orders (ref TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ipz_bookings (ref TEXT PRIMARY KEY, court TEXT NOT NULL, booking_date DATE NOT NULL, booking_time TEXT NOT NULL, status TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE UNIQUE INDEX IF NOT EXISTS ipz_booking_slot_active ON ipz_bookings(court,booking_date,booking_time) WHERE status <> 'Cancelada';
 CREATE TABLE IF NOT EXISTS ipz_messages (ref TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ipz_sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, role TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
 CREATE TABLE IF NOT EXISTS ipz_gallery (id TEXT PRIMARY KEY, caption TEXT NOT NULL, image TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS ipz_tournaments (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
 // Migração idempotente de categorias antigas (0-5) para o catálogo v2 (0-9).
 // Só converte artigos sem categoryVersion; preserva preços, imagens, stock e vendas.
 await pool.query(`UPDATE ipz_products
 SET data = jsonb_set(
   jsonb_set(data, '{c}', to_jsonb(CASE (data->>'c')::integer
     WHEN 0 THEN 0 WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 5 WHEN 4 THEN 3 WHEN 5 THEN 6
     ELSE 6 END)),
   '{categoryVersion}', '2'::jsonb)
 WHERE NOT (data ? 'categoryVersion')
   AND (data->>'c') ~ '^[0-5]$'`);
 for(const p of catalog)await pool.query('INSERT INTO ipz_products(id,data) VALUES($1,$2::jsonb) ON CONFLICT(id) DO NOTHING',[p.id,JSON.stringify({...p,pub:true})]);
}
function publicProduct(item){
 const images=Array.isArray(item.images)?item.images:[];
 return {...item,images:images.map((data,i)=>'/api/product-image/'+encodeURIComponent(item.id)+'/'+i+'?v='+crypto.createHash('sha256').update(data).digest('hex').slice(0,12))};
}
const recordTables={orders:'ipz_orders',bookings:'ipz_bookings',messages:'ipz_messages',products:'ipz_products'};
async function snapshot(c){const q=await pool.query(`SELECT ${c==='products'?'id':'ref'} AS id, data FROM ${recordTables[c]} ORDER BY ${c==='products'?'id':'created_at DESC'} LIMIT 2000`);
 if(c==='products')return q.rows.map(x=>({id:x.id,data:publicProduct(x.data)}));
 return [{id:'local',data:{list:q.rows.map(x=>x.data)}}];}
async function getDoc(c,id){if(c==='products'){let r=await pool.query('SELECT data FROM ipz_products WHERE id=$1',[id]);return r.rows[0]?publicProduct(r.rows[0].data):null;}
 if(id!=='local')return null;
 const docs=await snapshot(c);return docs[0].data;}
async function tx(fn){const c=await pool.connect();try{await c.query('BEGIN');const out=await fn(c);await c.query('COMMIT');return out;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
function bad(m,status=400){const e=new Error(m);e.status=status;throw e;}
async function submitOrder(b){return tx(async db=>{
 const input=Array.isArray(b.items)?b.items:[];
 if(!input.length||input.length>30)bad('Carrinho inválido');
 const quantities=new Map(),sizes=new Map();
 for(const i of input){let id=cut(i.id,40),q=Number(i.q);if(!/^[\w-]{2,40}$/.test(id)||!Number.isInteger(q)||q<1||q>100)bad('Quantidade inválida');quantities.set(id,(quantities.get(id)||0)+q);sizes.set(id+'|'+cut(i.sz,10),{id,sz:cut(i.sz,10),q:(sizes.get(id+'|'+cut(i.sz,10))?.q||0)+q});}
 if(!cut(b.cn)||!phoneValid(b.cp)||!/^\S+@\S+\.\S+$/.test(cut(b.ce)))bad('Dados de contacto inválidos');
  if(!['card','emola','mpesa'].includes(b.pm))bad('Método de pagamento inválido');
  if(b.pm!=='card'&&!phoneValid(b.w,b.pm))bad('Número de pagamento incompatível com a operadora');
  if(b.pm==='card'&&!cardConfig())bad('Pagamento por cartão indisponível. Selecciona outra forma de pagamento.',503);
 if(b.dl==='del'&&!cut(b.a))bad('Indica o endereço de entrega');
 // Bloqueio determinístico de linhas evita venda acima do stock em compras simultâneas.
 const products=new Map();for(const id of [...quantities.keys()].sort()){
  const r=await db.query('SELECT data FROM ipz_products WHERE id=$1 FOR UPDATE',[id]);if(!r.rows.length)bad('Produto não encontrado',404);
  const p=r.rows[0].data,q=quantities.get(id);if(p.pub===false||!Number.isFinite(p.p)||!Number.isInteger(p.s)||q>p.s)bad('Stock insuficiente para '+p.n,409);products.set(id,p);
 }
 const normalized=[...sizes.values()].map(i=>{const p=products.get(i.id);return{id:i.id,n:p.n,sz:i.sz,q:i.q,u:p.p,t:p.p*i.q};});
 const total=normalized.reduce((v,i)=>v+i.t,0);
 const o={ref:ref('PED'),at:new Date().toISOString(),cn:cut(b.cn),cp:normalizePhone(b.cp),ce:cut(b.ce,220),co:cut(b.co,500),pm:b.pm,w:b.pm==='card'?'':normalizePhone(b.w),dl:b.dl==='del'?'del':'pick',a:cut(b.a,250),total,pay:b.pm==='card'?'Aguardando pagamento bancário':'Pago (simulado)',payAuto:b.pm!=='card',st:'Por processar',ap:true,items:normalized};
 for(const [id,q] of quantities){const p=products.get(id);await db.query('UPDATE ipz_products SET data=$2::jsonb WHERE id=$1',[id,JSON.stringify({...p,s:p.s-q})]);}
 await db.query('INSERT INTO ipz_orders(ref,data) VALUES($1,$2::jsonb)',[o.ref,JSON.stringify(o)]);
 return o;
});}
function hoursValue(time){return Number(String(time||'').slice(0,2));}
function bookingInterval(record){const start=hoursValue(record.time);const duration=Number(record.duration)||60;const end=record.endTime?hoursValue(record.endTime):start+Math.ceil(duration/60);return {start,end};}
function bookingOverlaps(other,start,end){const r=bookingInterval(other);return start<r.end&&end>r.start;}
async function submitBooking(b){
 const date=cut(b.date,10),time=cut(b.time,5),endTime=cut(b.endTime,5),pm=cut(b.pm,10),bi=cut(b.bi,30),name=cut(b.cn,160),wallet=cut(b.wallet,24),phone=cut(b.cp,24);
 const from=hoursValue(time),to=hoursValue(endTime),duration=(to-from)*60;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d\d:00$/.test(time)||!/^\d\d:00$/.test(endTime)||from<6||from>=23||to>23||to<=from||!name.includes(' ')||name.length<3||!/[\p{L}]/u.test(name)||!/^[\p{L}\p{N}/. -]{5,30}$/u.test(bi))bad('Data, horário, nome ou B.I. inválidos');
 if(!phoneValid(phone))bad('Indica um contacto moçambicano válido.');
 if(!['card','emola','mpesa'].includes(pm))bad('Escolhe um método de pagamento válido');
 if(pm!=='card'&&!phoneValid(wallet,pm))bad(pm==='emola'?'e-Mola exige +25886 ou +25887.':'M-Pesa exige +25884 ou +25885.');
 if(pm==='card'&&!cardConfig())bad('Pagamento por cartão indisponível. Escolhe outro método.',503);
 if(pm==='card'&&!validateEmail(cut(b.ce,160)))bad('Indica um email válido para o pagamento bancário.');
 const d=new Date(date+'T12:00:00Z'),today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Maputo'});
 if(Number.isNaN(d.valueOf())||d.toISOString().slice(0,10)!==date||date<today)bad('Data inválida ou passada');
 if(Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z')>44*86400000)bad('As marcações estão disponíveis até 45 dias.');
 return tx(async db=>{
   // O mesmo lock por data é usado para todas as novas reservas, impedindo sobreposição em concorrência.
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['ipz-booking-'+date]);
   const entries=(await db.query("SELECT court,booking_time,data FROM ipz_bookings WHERE booking_date=$1 AND status <> 'Cancelada'",[date])).rows;
   for(const court of courts){
     if(entries.some(x=>x.court===court&&bookingOverlaps({...x.data,time:x.booking_time},from,to)))continue;
     const item={ref:ref('RES'),at:new Date().toISOString(),court,date,time,endTime,cn:name,ce:pm==='card'?cut(b.ce,160):'',bi,cp:normalizePhone(phone),pm,wallet:pm==='card'?'':normalizePhone(wallet),duration,price:(duration/60)*bookingPrice,pay:pm==='card'?'Aguardando pagamento bancário':'Pagamento simulado',payAuto:pm!=='card',st:'Pendente'};
     await db.query('INSERT INTO ipz_bookings(ref,court,booking_date,booking_time,status,data) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[item.ref,court,date,time,item.st,JSON.stringify(item)]);
     return item;
   }
   bad('Todos os quatro campos estão ocupados nesse período. Escolhe outro horário.',409);
 });
}
async function submitMessage(b){if(!cut(b.n)||!cut(b.m)||!/^\S+@\S+\.\S+$/.test(cut(b.e)))bad('Dados da mensagem inválidos');const o={ref:ref('MSG'),at:new Date().toISOString(),n:cut(b.n),e:cut(b.e,220),m:cut(b.m,2000),rd:false};await pool.query('INSERT INTO ipz_messages(ref,data) VALUES($1,$2::jsonb)',[o.ref,JSON.stringify(o)]);return o;}
async function modifyRecord(c,payload){return tx(async db=>{
  if(!payload||!Array.isArray(payload.list))bad('Alteração inválida');
  const table=recordTables[c];
  // A interface envia a lista inteira. Actualizamos SOMENTE os campos permitidos.
  for(const patch of payload.list){if(!patch||!/^\w+-[A-Za-z0-9]+$/.test(String(patch.ref||'')))bad('Referência inválida');
   const r=await db.query(`SELECT data FROM ${table} WHERE ref=$1 FOR UPDATE`,[patch.ref]);if(!r.rows.length)bad('Registo não encontrado',404);
   const current=r.rows[0].data, next={...current};
   if(c==='messages'){if(typeof patch.rd!=='boolean')bad('Estado inválido');next.rd=patch.rd;}
   if(c==='orders'){
    if(!ordersStatuses.includes(patch.st))bad('Estado de compra inválido');
    if(current.st!==patch.st){
      if(current.st!=='Cancelado'&&patch.st==='Cancelado'){
       for(const it of current.items){const pr=await db.query('SELECT data FROM ipz_products WHERE id=$1 FOR UPDATE',[it.id]);if(pr.rows.length){const p=pr.rows[0].data;await db.query('UPDATE ipz_products SET data=$2::jsonb WHERE id=$1',[it.id,JSON.stringify({...p,s:p.s+it.q})]);}}
      }else if(current.st==='Cancelado'&&patch.st!=='Cancelado'){
       for(const it of current.items){const pr=await db.query('SELECT data FROM ipz_products WHERE id=$1 FOR UPDATE',[it.id]);if(!pr.rows.length||pr.rows[0].data.s<it.q)bad('Stock insuficiente para reactivar o pedido',409);const p=pr.rows[0].data;await db.query('UPDATE ipz_products SET data=$2::jsonb WHERE id=$1',[it.id,JSON.stringify({...p,s:p.s-it.q})]);}
      }
    }next.st=patch.st;
   }
   if(c==='bookings'){if(!bookingStatuses.includes(patch.st))bad('Estado de reserva inválido');next.st=patch.st;
    if(current.st==='Cancelada'&&next.st!=='Cancelada'){
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['ipz-booking-'+current.date]);
      const entries=(await db.query("SELECT ref,court,booking_time,data FROM ipz_bookings WHERE booking_date=$1 AND status <> 'Cancelada'",[current.date])).rows;
      const it=bookingInterval(current);
      if(entries.some(x=>x.ref!==patch.ref&&x.court===current.court&&bookingOverlaps({...x.data,time:x.booking_time},it.start,it.end)))bad('Conflito: o campo está ocupado neste intervalo.',409);
    }
    try{await db.query('UPDATE ipz_bookings SET status=$2,data=$3::jsonb WHERE ref=$1',[patch.ref,next.st,JSON.stringify(next)]);}catch(e){if(e.code==='23505')bad('Conflito: este campo e horário já estão ocupados',409);throw e;}continue;
   }
   await db.query(`UPDATE ${table} SET data=$2::jsonb WHERE ref=$1`,[patch.ref,JSON.stringify(next)]);
  }return true;
});}
async function saveProduct(id,v){if(!/^[a-zA-Z0-9_-]{2,60}$/.test(id))bad('ID inválido');
 const current=(await pool.query('SELECT data FROM ipz_products WHERE id=$1',[id])).rows[0]?.data;
 if(!current&&v.custom!==true)bad('Produto inexistente');
 const n=cut(v.n||current?.n,150),p=Number(v.p),s=Number(v.s),c=Number(v.c??current?.c??0);
 if(!n||!Number.isFinite(p)||p<0||!Number.isInteger(s)||s<0||!Number.isInteger(c)||c<0||c>9)bad('Dados do produto inválidos');
 let images=current?.images||[];
 if(Object.prototype.hasOwnProperty.call(v,'images')){
  if(!Array.isArray(v.images))bad('Formato de imagens inválido');
  if(current&&v.images.length===0&&(!current.images||current.images.length===0))images=[];
  else {
  if(v.images.length!==4)bad('Selecciona exactamente 4 imagens do produto');
  const unchanged=current&&v.images.every((source,i)=>typeof source==='string'&&source.startsWith('/api/product-image/'+id+'/'+i+'?v='));
  if(unchanged)images=current.images||[];
  else images=v.images.map((source,i)=>{
   if(typeof source!=='string'||!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(source))bad('Formato de imagem inválido na posição '+(i+1));
   const data=source.slice(source.indexOf(',')+1);
   if(Buffer.byteLength(data,'base64')>180*1024)bad('Imagem '+(i+1)+' excede 180 KB. Tenta novamente com imagens menores.');
   return source;
  });
  }
 }
 if(!current&&images.length!==4)bad('Os produtos novos precisam de exactamente 4 imagens');
 const item={...(current||{}),custom:current?.custom||v.custom===true,n,p,s,c,pub:v.pub!==false,id,categoryVersion:2,t:current?.t||['racket','shoe','shirt','bag','bag','ball','grip','racket','racket','racket'][c],col:current?.col||'#1673B8',images};
 await pool.query('INSERT INTO ipz_products(id,data) VALUES($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET data=excluded.data',[id,JSON.stringify(item)]);}


async function excel45Days(res){
 const until=new Date(), start=new Date(until.getTime()-45*86400000);
 const [orders,bookings,messages,products,tournaments,gallery]=await Promise.all([
  pool.query('SELECT data FROM ipz_orders WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC',[start,until]),
  pool.query('SELECT data FROM ipz_bookings WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC',[start,until]),
  pool.query('SELECT data FROM ipz_messages WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC',[start,until]),
  pool.query('SELECT data FROM ipz_products ORDER BY id'),
  pool.query('SELECT id,data FROM ipz_tournaments WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC',[start,until]),
  pool.query('SELECT id,caption,created_at FROM ipz_gallery ORDER BY created_at DESC')
 ]);
 const O=orders.rows.map(r=>r.data), B=bookings.rows.map(r=>r.data), M=messages.rows.map(r=>r.data), P=products.rows.map(r=>r.data), T=tournaments.rows.map(r=>({...r.data,id:r.id})), G=gallery.rows;
 const active=O.filter(x=>x.st!=='Cancelado');const revenue=active.reduce((n,x)=>n+Number(x.total||0),0);
 const wb=new ExcelJS.Workbook();wb.creator='Indoor Padel Zone';wb.created=until;
 wb.properties.date1904=false;
 const green='CFF902', dark='10232B';
 function sheet(name,headers,rows,widths){const ws=wb.addWorksheet(name,{views:[{state:'frozen',ySplit:2}]});
  ws.mergeCells(1,1,1,headers.length);const title=ws.getCell(1,1);title.value='INDOOR PADEL ZONE | '+name.toUpperCase();title.font={bold:true,size:15,color:{argb:'FFFFFFFF'}};title.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+dark}};title.alignment={vertical:'middle'};ws.getRow(1).height=32;
  ws.addRow(headers);ws.getRow(2).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+green}};c.font={bold:true,color:{argb:'FF'+dark}};c.alignment={vertical:'middle'}});ws.getRow(2).height=26;
  for(const row of rows)ws.addRow(row);
  (widths||headers.map(()=>22)).forEach((w,i)=>ws.getColumn(i+1).width=w);
  for(let i=3;i<=ws.rowCount;i++){const r=ws.getRow(i);if(i%2===0)r.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2F7F6'}});r.height=21;}
  ws.autoFilter={from:{row:2,column:1},to:{row:Math.max(2,ws.rowCount),column:headers.length}};
  ws.pageSetup={fitToPage:true,fitToWidth:1,fitToHeight:0,orientation:'landscape'};
  return ws;
 }
 const period='De '+start.toISOString().slice(0,10)+' até '+until.toISOString().slice(0,10)+' (UTC)';
 const stats=[['Período de análise',period],['Compras registadas',O.length],['Compras activas',active.length],['Compras canceladas',O.length-active.length],['Valor de encomendas não canceladas (MT)',revenue],['Pagamentos bancários confirmados (MT)',O.filter(x=>x.pay==='Pago (confirmado)').reduce((n,x)=>n+Number(x.total||0),0)+B.filter(x=>x.pay==='Pago (confirmado)').reduce((n,x)=>n+Number(x.price||0),0)],['Reservas registadas',B.length],['Reservas pendentes',B.filter(x=>x.st==='Pendente').length],['Reservas confirmadas',B.filter(x=>x.st==='Confirmada').length],['Reservas canceladas',B.filter(x=>x.st==='Cancelada').length],['Mensagens recebidas',M.length],['Mensagens não lidas',M.filter(x=>!x.rd).length],['Produtos no catálogo (estado actual)',P.length],['Produtos publicados (estado actual)',P.filter(x=>x.pub!==false).length],['Produtos com stock baixo ≤ 3 (estado actual)',P.filter(x=>Number(x.s)<=3).length],['Torneios criados nos últimos 45 dias',T.length],['Fotografias da galeria (estado actual)',G.length]];
 const summary=sheet('Resumo',['Indicador','Valor'],stats,[51,73]);summary.getColumn(2).alignment={vertical:'middle',wrapText:true};
 summary.getCell(7,2).numFmt='#,##0.00 "MT"';
 const date=x=>x?new Date(x).toISOString().replace('T',' ').slice(0,16):'';
 const so=sheet('Compras',['Referência','Criada em (UTC)','Cliente','Telefone','Email','Estado','Pagamento','Método','Entrega','Endereço','Total MT','Itens'],O.map(x=>[x.ref,date(x.at),x.cn,x.cp,x.ce,x.st,x.pay,x.pm,x.dl,x.a,Number(x.total)||0,(x.items||[]).map(i=>`${i.q}x ${i.n}${i.sz?' ['+i.sz+']':''}`).join('; ')]),[22,22,26,18,30,20,22,14,16,32,17,65]);so.getColumn(11).numFmt='#,##0.00 "MT"';
 sheet('Reservas',['Referência','Criada em (UTC)','Campo','Data reservada','Hora','Cliente','B.I.','Pagamento','Telefone / carteira','Preço (MT)','Estado'],B.map(x=>[x.ref,date(x.at),x.court,x.date,x.time,x.cn,x.bi||'',x.pm||'',x.cp||'',Number(x.price)||0,x.st]),[24,23,18,20,13,28,24,18,23,17,18]);
 sheet('Mensagens',['Referência','Criada em (UTC)','Nome','Email','Mensagem','Lida'],M.map(x=>[x.ref,date(x.at),x.n,x.e,x.m,x.rd?'Sim':'Não']),[24,23,28,35,70,14]);
 const sp=sheet('Produtos',['ID','Nome','Categoria','Preço MT','Stock','Publicado','Imagens'],P.map(x=>[x.id,x.n,['Raquetes','Sapatilhas','Roupa','Sacos','Packs','Bolas','Acessórios','Outlet','Pickleball','Outras raquetes'][x.c]||'',Number(x.p)||0,Number(x.s)||0,x.pub!==false?'Sim':'Não',(x.images||[]).length]),[22,47,26,20,16,16,15]);sp.getColumn(4).numFmt='#,##0.00 "MT"';
 sheet('Torneios',['ID','Nome','Data','Estado','Organizador','Email','Telefone','Capacidade','Inscritos','Jogos sorteados'],T.map(x=>[x.id,x.title,x.date,x.status,x.name,x.email,x.phone,x.capacity,(x.participants||[]).length,(x.draw||[]).length]),[25,33,16,27,30,32,20,17,16,20]);
 sheet('Galeria',['ID','Legenda','Adicionada em (UTC)'],G.map(x=>[x.id,x.caption,date(x.created_at)]),[27,65,25]);
 const days=new Map();for(let i=44;i>=0;i--){const d=new Date(Date.UTC(until.getUTCFullYear(),until.getUTCMonth(),until.getUTCDate()-i));days.set(d.toISOString().slice(0,10),{orders:0,bookings:0,messages:0,revenue:0})}
 for(const o of O){const d=String(o.at).slice(0,10),v=days.get(d);if(v){v.orders++;if(o.st!=='Cancelado')v.revenue+=Number(o.total)||0}}
 for(const b of B){const v=days.get(String(b.at).slice(0,10));if(v)v.bookings++}
 for(const m of M){const v=days.get(String(m.at).slice(0,10));if(v)v.messages++}
 const daily=sheet('Evolução diária',['Data (UTC)','Compras','Reservas','Mensagens','Valor não cancelado MT'],[...days].map(([d,v])=>[d,v.orders,v.bookings,v.messages,v.revenue]),[22,19,19,19,30]);daily.getColumn(5).numFmt='#,##0.00 "MT"';
 const buffer=await wb.xlsx.writeBuffer();res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="IDPZ-relatorio-45-dias-${until.toISOString().slice(0,10)}.xlsx"`,'Cache-Control':'no-store','Content-Length':buffer.length,'X-Content-Type-Options':'nosniff'});res.end(Buffer.from(buffer));
}


// GALERIA E TORNEIOS: todas as gravações permanecem no PostgreSQL Neon.
function galleryImage(input){
 if(typeof input!=='string'||input.length>380000||!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(input))bad('Imagem inválida ou demasiado grande (máximo ~250 KB)',400);
 return input;
}
function validateEmail(v){return /^\S+@\S+\.\S+$/.test(v)}
function tournamentBody(b,isAdmin){
 const name=cut(b.name,100),email=cut(b.email,160),phone=cut(b.phone,24),title=cut(b.title||b.name,110),date=cut(b.date,10);
 const max=Number(b.capacity||b.count), roster=Array.isArray(b.participants)?b.participants:[];
 if(!name||!validateEmail(email)||!phoneValid(phone)||!Number.isInteger(max)||max<2||max>128)bad('Preenche organizador, email, telefone e capacidade (2–128).');
 if(title.length<3||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z')))bad('Indica nome e data válidos para o torneio.');
 if(!isAdmin && date<new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Maputo'}))bad('A data do torneio deve ser futura.');
 if(roster.length>max)bad('Participantes excedem as vagas disponíveis.');
 const names=roster.map(x=>cut(x,80)).filter(Boolean);
 if(names.some(x=>x.length<2)||new Set(names.map(x=>x.toLocaleLowerCase('pt'))).size!==names.length)bad('Os participantes não podem repetir-se.');
 return {name,email,phone,title,date,capacity:max,participants:names};
}
function drawMatches(names){
 if(names.length<2)bad('São necessários pelo menos dois participantes para sortear.');
 const list=[...names];for(let i=list.length-1;i>0;i--){const j=crypto.randomInt(i+1);[list[i],list[j]]=[list[j],list[i]];}
 const matches=[];for(let i=0;i<list.length;i+=2)matches.push({a:list[i],b:list[i+1]||null});return matches;
}
async function galleryList(){const q=await pool.query('SELECT id,caption,created_at FROM ipz_gallery ORDER BY created_at DESC LIMIT 150');return q.rows.map(x=>({...x,url:'/api/gallery/image/'+x.id}));}
async function tournamentList(admin=false){const q=await pool.query('SELECT id,data FROM ipz_tournaments ORDER BY (data->>\'date\') DESC LIMIT 300');return q.rows.filter(x=>admin||['Publicado','Concluído'].includes(x.data.status)).map(x=>({id:x.id,...x.data}));}
// pay.co.mz: cartão com checkout alojado. Sem credenciais não há cobrança.
const cardConfig=()=>!!(process.env.PAY_API_KEY&&process.env.PAY_MERCHANT_ID&&process.env.PAY_WALLET_ID);
async function cardStart(kind,id){
 if(!cardConfig())bad('O pagamento por cartão ainda não foi activado pela Indoor Padel Zone.',503);
 const table=kind==='order'?'ipz_orders':kind==='booking'?'ipz_bookings':null;if(!table)bad('Tipo de pagamento inválido');
 const row=await pool.query(`SELECT data FROM ${table} WHERE ref=$1`,[id]);if(!row.rows.length)bad('Registo não encontrado',404);
 const record=row.rows[0].data;if(record.pm!=='card')bad('O método de pagamento não é cartão');
 if(record.pay==='Pago (confirmado)')bad('Pagamento já confirmado',409);
 if(record.checkoutUrl&&record.checkoutUrl.startsWith('https://pay.co.mz/checkout/'))return {checkout_url:record.checkoutUrl};
 const amount=kind==='order'?record.total:record.price;
 const resp=await fetch('https://pay.co.mz/api/public/v1/charges',{method:'POST',headers:{'Authorization':'Bearer '+process.env.PAY_API_KEY,'X-Merchant-Id':process.env.PAY_MERCHANT_ID,'X-Wallet-Id':process.env.PAY_WALLET_ID,'Idempotency-Key':id,'Content-Type':'application/json'},body:JSON.stringify({method:'card',amount,customer_name:record.cn,customer_contact:record.ce||record.cp}),signal:AbortSignal.timeout(12000)});
 const payload=await resp.json();const checkout=payload?.data?.checkout_url;
 if(!resp.ok||typeof checkout!=='string'||!/^https:\/\/pay\.co\.mz\/checkout\//.test(checkout))bad('Não foi possível iniciar o pagamento bancário. Tenta novamente.',502);
 const updated={...record,checkoutUrl:checkout,paymentReference:payload.data.reference,pay:'Aguardando pagamento bancário',payAuto:false};
 await pool.query(`UPDATE ${table} SET data=$2::jsonb WHERE ref=$1`,[id,JSON.stringify(updated)]);
 return {checkout_url:checkout};
}
// Consulta servidor-a-servidor (não aceita status fornecido pelo navegador).
async function reconcileCard(kind,id){
 if(!cardConfig())bad('Gateway não configurado',503);
 const table=kind==='order'?'ipz_orders':kind==='booking'?'ipz_bookings':null;if(!table)bad('Tipo inválido');
 const row=await pool.query(`SELECT data FROM ${table} WHERE ref=$1`,[id]);if(!row.rows.length)bad('Registo inexistente',404);
 const record=row.rows[0].data;if(!record.paymentReference)bad('Pagamento ainda não iniciado',409);
 const response=await fetch('https://pay.co.mz/api/public/v1/charges?limit=100',{headers:{Authorization:'Bearer '+process.env.PAY_API_KEY,'X-Merchant-Id':process.env.PAY_MERCHANT_ID,'X-Wallet-Id':process.env.PAY_WALLET_ID},signal:AbortSignal.timeout(10000)});
 if(!response.ok)bad('Não foi possível consultar o prestador',502);const data=await response.json();
 const charge=(Array.isArray(data.data)?data.data:[]).find(x=>x.reference===record.paymentReference);
 if(!charge)return {status:'pendente',verified:false,note:'Transacção não encontrada nas últimas 100 cobranças; requer reconciliação manual.'};
 const expected=kind==='order'?record.total:record.price;
 if(Number(charge.amount)!==Number(expected)||charge.method!=='card')bad('Divergência de pagamento. Contacta a administração.',409);
 const verified=['paid','completed','success','successful'].includes(String(charge.status||charge.state).toLowerCase());
 if(verified&&record.pay!=='Pago (confirmado)'){
  const updated={...record,pay:'Pago (confirmado)',payAuto:false,paymentVerifiedAt:new Date().toISOString()};
  await pool.query(`UPDATE ${table} SET data=$2::jsonb WHERE ref=$1`,[id,JSON.stringify(updated)]);
 }
 return {status:charge.status||charge.state||'pending',verified};
}

const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
async function handler(req,res){const u=new URL(req.url,'http://localhost'),r=u.pathname,m=req.method;
 if(r==='/health'&&m==='GET')return json(res,200,{ok:true});
 if(r.startsWith('/api/')){
  if(m!=='GET'&&!sameOrigin(req))return error(res,403,'Origem não autorizada');

  if(r==='/api/gallery'&&m==='GET')return json(res,200,{items:await galleryList()});
  if(r==='/api/gallery/image/'+(r.split('/').pop())&&m==='GET'&&/^\/api\/gallery\/image\/[a-zA-Z0-9_-]+$/.test(r)){
   const id=r.split('/').pop(),q=await pool.query('SELECT image FROM ipz_gallery WHERE id=$1',[id]),uri=q.rows[0]?.image;
   if(!uri)return error(res,404,'Imagem não encontrada');const type=uri.slice(5,uri.indexOf(';')),bytes=Buffer.from(uri.split(',')[1],'base64');
   res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=600'});return res.end(bytes);
  }
  if(r==='/api/tournaments'&&m==='GET')return json(res,200,{items:await tournamentList()});
  if(r==='/api/tournaments'&&m==='POST'){
    limitCommunity(req);
    const v=tournamentBody(await parse(req),false),id=ref('TOR');
    const data={...v,organizer:v.name,status:'A aguardar aprovação',createdAt:new Date().toISOString(),draw:v.participants.length>=2?drawMatches(v.participants):[]};
    await pool.query('INSERT INTO ipz_tournaments(id,data) VALUES($1,$2::jsonb)',[id,JSON.stringify(data)]);
    return json(res,201,{id,status:data.status,draw:data.draw});
  }
  if(r==='/api/payments/card/config'&&m==='GET')return json(res,200,{enabled:cardConfig(),provider:'pay.co.mz'});
  if(r==='/api/payments/card/start'&&m==='POST'){
    const input=await parse(req),result=await cardStart(cut(input.kind,10),cut(input.ref,100));return json(res,200,result);
  }
  if(r==='/api/availability'&&m==='GET'){
   const date=u.searchParams.get('date')||'',court=u.searchParams.get('court')||'',start=u.searchParams.get('start')||'',end=u.searchParams.get('end')||'';
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||(court&&!courts.includes(court)))return error(res,400,'Data ou campo inválido');
   if((start||end)&&(!/^\d\d:00$/.test(start)||!/^\d\d:00$/.test(end)||hoursValue(start)<6||hoursValue(end)>23||hoursValue(end)<=hoursValue(start)))return error(res,400,'Intervalo de horas inválido');
   const rows=await pool.query("SELECT court,booking_time,data FROM ipz_bookings WHERE booking_date=$1 AND status <> 'Cancelada'",[date]);
   if(start&&end){const st=hoursValue(start),en=hoursValue(end);const free=courts.filter(c=>!rows.rows.some(x=>x.court===c&&bookingOverlaps({...x.data,time:x.booking_time},st,en)));return json(res,200,{availableCount:free.length,start,end,date,price:(en-st)*bookingPrice});}
   const available=Object.fromEntries(times.map(t=>[t,courts.length-courts.filter(c=>rows.rows.some(x=>x.court===c&&bookingOverlaps({...x.data,time:x.booking_time},hoursValue(t),hoursValue(t)+1))).length]));
   if(court)return json(res,200,{occupied:times.filter(t=>rows.rows.some(x=>x.court===court&&bookingOverlaps({...x.data,time:x.booking_time},hoursValue(t),hoursValue(t)+1)))});
   return json(res,200,{available,times,price:bookingPrice,duration:60});
  }
  if(r==='/api/session'&&m==='GET'){const s=await session(req);return json(res,200,{admin:!!s,role:s?.role||null,email:s?.email||null,online:true});}
  if(r==='/api/login'&&m==='POST'){
   const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').toString().split(',')[0].trim(),prev=attempts.get(ip)||{n:0,until:0};
   if(prev.until>Date.now())return error(res,429,'Demasiadas tentativas. Tenta daqui a 15 minutos.');
   const b=await parse(req),email=cut(b.email,200).toLowerCase(),acc=passwords[email];
   if(!acc||!safeCompare(b.password||'',acc.password)){prev.n++;if(prev.n>=5){prev.n=0;prev.until=Date.now()+15*60000;}attempts.set(ip,prev);return error(res,401,'Email ou palavra-passe inválidos');}
   attempts.delete(ip);const token=crypto.randomBytes(32).toString('hex'),hash=crypto.createHash('sha256').update(token).digest('hex');
   await pool.query('INSERT INTO ipz_sessions(token_hash,email,role,expires_at) VALUES($1,$2,$3,now()+interval \'8 hours\')',[hash,email,acc.role]);
   return json(res,200,{admin:true,role:acc.role,email},{'Set-Cookie':setCookie(token)});
  }
  if(r==='/api/logout'&&m==='POST'){const token=cookies(req);if(token)await pool.query('DELETE FROM ipz_sessions WHERE token_hash=$1',[crypto.createHash('sha256').update(token).digest('hex')]);return json(res,200,{ok:true},{'Set-Cookie':setCookie('',true)});}
  const photoRoute=r.match(/^\/api\/product-image\/([a-zA-Z0-9_-]+)\/([0-3])$/);
  if(photoRoute&&m==='GET'){
   const q=await pool.query(`SELECT data->'images'->>$2::int AS img FROM ipz_products WHERE id=$1`,[photoRoute[1],Number(photoRoute[2])]);
   const uri=q.rows[0]?.img;
   if(!uri||!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(uri))return error(res,404,'Imagem indisponível');
   const type=uri.slice(5,uri.indexOf(';')),bytes=Buffer.from(uri.slice(uri.indexOf(',')+1),'base64');
   res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'});return res.end(bytes);
  }
  if(r==='/api/snapshot/products'&&m==='GET')return json(res,200,{docs:await snapshot('products')});
  if(r.startsWith('/api/submit/')&&m==='POST'){
   const c=r.split('/').pop(),b=await parse(req);let item;
   if(c==='orders')item=await submitOrder(b);else if(c==='bookings')item=await submitBooking(b);else if(c==='messages')item=await submitMessage(b);else return error(res,404,'Rota inexistente');
   return json(res,201,{ok:true,item});
  }
  const s=await session(req);if(!s)return error(res,401,'Inicia sessão para aceder ao painel');

  if(r==='/api/admin/gallery'&&m==='POST'){
    if(s.role!=='admin')return error(res,403,'Apenas Admin');const b=await parse(req,400000),id=ref('GAL');
    const caption=cut(b.caption,160);if(!caption)bad('Indica uma legenda');
    await pool.query('INSERT INTO ipz_gallery(id,caption,image) VALUES($1,$2,$3)',[id,caption,galleryImage(b.image)]);return json(res,201,{ok:true,id});
  }
  if(r.startsWith('/api/admin/gallery/')&&m==='DELETE'){
    if(s.role!=='admin')return error(res,403,'Apenas Admin');const id=r.split('/').pop();await pool.query('DELETE FROM ipz_gallery WHERE id=$1',[id]);return json(res,200,{ok:true});
  }
  if(r==='/api/admin/tournaments'&&m==='GET'){if(s.role!=='admin')return error(res,403,'Apenas Admin');return json(res,200,{items:await tournamentList(true)});}
  if(r==='/api/admin/tournaments'&&m==='POST'){
    if(s.role!=='admin')return error(res,403,'Apenas Admin');const v=tournamentBody(await parse(req),true),id=ref('TOR');
    await pool.query('INSERT INTO ipz_tournaments(id,data) VALUES($1,$2::jsonb)',[id,JSON.stringify({...v,organizer:v.name,status:'Publicado',draw:[],createdAt:new Date().toISOString()})]);return json(res,201,{ok:true,id});
  }
  if(r.startsWith('/api/admin/tournaments/')&&m==='PATCH'){
    if(s.role!=='admin')return error(res,403,'Apenas Admin');const id=r.split('/').pop(),b=await parse(req);
    const row=await pool.query('SELECT data FROM ipz_tournaments WHERE id=$1',[id]);if(!row.rows.length)return error(res,404,'Torneio não encontrado');
    let data=row.rows[0].data;
    if(b.action==='publish')data={...data,status:'Publicado'};
    else if(b.action==='finish')data={...data,status:'Concluído'};
    else if(b.action==='draw'){
       const participants=Array.isArray(data.participants)?data.participants:[];
       if(participants.length<2)bad('Inscreve pelo menos dois participantes antes do sorteio.');
       data={...data,draw:drawMatches(participants),drawnAt:new Date().toISOString()};
    }else if(b.action==='roster'){
       const participants=Array.isArray(b.participants)?b.participants.map(x=>cut(x,80)).filter(Boolean):[];
       if(participants.length>data.capacity||new Set(participants.map(x=>x.toLowerCase())).size!==participants.length)bad('Lista inválida ou nomes repetidos.');
       data={...data,participants,draw:[]};
    } else bad('Operação inválida');
    await pool.query('UPDATE ipz_tournaments SET data=$2::jsonb WHERE id=$1',[id,JSON.stringify(data)]);return json(res,200,{ok:true});
  }
  if(r.startsWith('/api/admin/tournaments/')&&m==='DELETE'){
     if(s.role!=='admin')return error(res,403,'Apenas Admin');await pool.query('DELETE FROM ipz_tournaments WHERE id=$1',[r.split('/').pop()]);return json(res,200,{ok:true});
  }
  if(r==='/api/admin/payments/reconcile'&&m==='POST'){
    if(s.role!=='admin')return error(res,403,'Apenas Admin');const b=await parse(req);return json(res,200,await reconcileCard(cut(b.kind,10),cut(b.ref,100)));
  }
  if(r==='/api/admin/export-45-days'&&m==='GET'){if(s.role!=='admin')return error(res,403,'Apenas Admin pode exportar o relatório');return excel45Days(res);}
  const sm=r.match(/^\/api\/snapshot\/(orders|bookings|messages|products)$/);
  if(sm&&m==='GET')return json(res,200,{docs:await snapshot(sm[1])});
  const itemRoute=r.match(/^\/api\/item\/(orders|bookings|messages)\/([A-Za-z0-9_-]+)$/);
  if(itemRoute&&m==='PATCH'){
   const [,c,id]=itemRoute,patch=await parse(req);
   if(!/^\w+-[A-Za-z0-9]+$/.test(id))return error(res,400,'Referência inválida');
   await modifyRecord(c,{list:[{ref:id,...patch}]});return json(res,200,{ok:true});
  }
  const doc=r.match(/^\/api\/doc\/(orders|bookings|messages|products)\/([a-zA-Z0-9_-]+)$/);
  if(doc){const [,c,id]=doc;
   if(m==='GET'){if(c==='products'&&s.role!=='admin')return error(res,403,'Acesso restrito');let data=await getDoc(c,id);return json(res,200,{exists:!!data,data});}
   if(m==='PUT'){
    if(c==='products'){if(s.role!=='admin')return error(res,403,'Apenas Admin pode editar produtos');await saveProduct(id,await parse(req,1100000));}
    else {if(id!=='local')return error(res,400,'Identificador inválido');await modifyRecord(c,await parse(req));}
    return json(res,200,{ok:true});
   }
  }
  return error(res,404,'Rota inexistente');
 }
 if(m!=='GET'&&m!=='HEAD')return error(res,405,'Método não permitido');
 const file=r==='/'?'index.html':decodeURIComponent(r.slice(1));
 if(!['index.html','admin.html','script.js','styles.css','redesign.css','animations.css','animations.js','community.js','community.css','admin-enhancements.css','booking-v7.css','court.svg','padel-balls.svg','favicon.ico'].includes(file))return error(res,404,'Ficheiro não encontrado');
 const abs=path.resolve(ROOT,file);fs.stat(abs,(e,info)=>{if(e||!info.isFile())return error(res,404,'Ficheiro não encontrado');
  res.writeHead(200,{'Content-Type':mime[path.extname(abs)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':file.endsWith('.html')?'no-cache':'public, max-age=600'});
  if(m==='HEAD')return res.end();fs.createReadStream(abs).pipe(res);
 });
}
boot().then(()=>http.createServer((req,res)=>Promise.resolve(handler(req,res)).catch(e=>{console.error('[API]',e.message);if(!res.headersSent)error(res,e.status||500,e.status?e.message:'Erro interno. Tenta novamente.');})).listen(PORT,'0.0.0.0',()=>console.log(`Indoor Padel Zone em http://localhost:${PORT}`)))
.catch(e=>{console.error('Falha a ligar PostgreSQL:',e.message);process.exit(1);});
