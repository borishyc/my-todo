import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getDatabase,ref,push,update,remove,onValue} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';
const config={apiKey:"AIzaSyDWrgpy-OISwOkOdOnic-ITw7_UfDM9OAQ",authDomain:"my-todo-sync-af551.firebaseapp.com",databaseURL:"https://my-todo-sync-af551-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"my-todo-sync-af551",storageBucket:"my-todo-sync-af551.firebasestorage.app",messagingSenderId:"83300635312",appId:"1:83300635312:web:f20e43227636e6b4286175"};
const fb=initializeApp(config),auth=getAuth(fb),db=getDatabase(fb);
const $=q=>document.querySelector(q),active=$('#activeList'),done=$('#doneList'),doneArea=$('#doneArea'),hint=$('#swipeHint'),form=$('#todoForm'),input=$('#todoInput'),error=$('#error'),live=$('#live'),login=$('#loginBtn'),logout=$('#logoutBtn'),who=$('#loginInfo'),sync=$('#syncStatus'),send=$('.send');
let detailId=null;let tasks=[],user=null,received=false,connected=false,busy=false,openId=null,unsubTasks=null,unsubConn=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=s=>{const [y,m,d]=s.split('-').map(Number);const day=new Date(y,m-1,d).getDay();return m+'/'+String(d).padStart(2,'0')+'('+'日一二三四五六'[day]+')'};
const dateMarkup=s=>{const label=dateText(s);const i=label.indexOf('(');return '<span class="date-main">'+label.slice(0,i)+'</span><span class="date-week">'+label.slice(i)+'</span>'};
const dateStart=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const stamp=d=>new Intl.DateTimeFormat('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d).replace(/：/g,':');
function parse(raw){const v=raw.trim(),code=v.slice(0,4),text=v.slice(4).trim();if(!/^\d{4}$/.test(code))return{error:'請在開頭輸入四碼日期，例如 1030下蓋試模'};if(!text)return{error:'請在四碼日期後輸入事項'};const m=Number(code.slice(0,2)),day=Number(code.slice(2));if(m<1||m>12)return{error:'月份必須介於 01 到 12'};const now=new Date();let y=now.getFullYear();let d=new Date(y,m-1,day);if(d.getMonth()!==m-1||d.getDate()!==day)return{error:'日期不存在'};if(d<dateStart(now))y++;if(new Date(y,m-1,day).getMonth()!==m-1)return{error:'日期不存在'};return{date:y+'-'+String(m).padStart(2,'0')+'-'+String(day).padStart(2,'0'),text}}
function dueClass(iso){const d=new Date(iso+'T00:00:00');if(Number.isNaN(d.getTime()))return '';const now=new Date();const days=Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);return days<0?' due-today':days>=0&&days<=2?' due-soon':''}
const ready=()=>!!(user&&received&&connected&&!busy);
function state(message){sync.textContent=message||(!user?'尚未登入':!connected?'離線':!received?'同步中…':busy?'儲存中…':'已同步');sync.dataset.online=String(!!(user&&received&&connected));send.disabled=input.disabled=!ready()}
function fail(e){console.error(e);error.textContent='操作失敗：'+(e.code||e.message||'未知錯誤')}
function setOpen(id){openId=id;render()}

function detailMarkup(t){
 const logs=Object.values(t.history||{}).filter(h=>h.type==='change').sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
 const [year,month,day]=t.date.split('-').map(Number);
 const years=Array.from({length:12},(_,i)=>new Date().getFullYear()-2+i);
 if(!years.includes(year))years.push(year);
 years.sort((a,b)=>a-b);
 const opts=(values,selected)=>values.map(v=>'<option value="'+v+'"'+(Number(v)===selected?' selected':'')+'>'+v+'</option>').join('');
 return '<section class="detail"><div class="detail-head"><strong>修改任務</strong><button data-close type="button">關閉</button></div>'+
 '<label>任務名稱<input id="editText" maxlength="100" value="'+esc(t.text)+'"></label>'+
 '<label>到期日期</label><div class="date-selects"><select id="editYear" aria-label="年">'+opts(years,year)+'</select><span>年</span><select id="editMonth" aria-label="月">'+opts(Array.from({length:12},(_,i)=>i+1),month)+'</select><span>月</span><select id="editDay" aria-label="日">'+opts(Array.from({length:31},(_,i)=>i+1),day)+'</select><span>日</span></div>'+
 '<button data-save="'+esc(t.id)+'" class="detail-save" type="button">儲存修改</button><h3>修改紀錄</h3>'+
 '<div class="history">'+(logs.length?logs.map(h=>'<div class="history-item"><small>'+esc(h.label||h.at||'')+'</small><div>'+esc(h.text||'')+'</div></div>').join(''):'尚無修改紀錄')+'</div></section>';
}
async function saveDetail(id){
 if(!ready())return;const t=tasks.find(x=>x.id===id);if(!t)return;
 const name=$('#editText').value.trim(),year=Number($('#editYear').value),month=Number($('#editMonth').value),day=Number($('#editDay').value),date=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'),d=new Date(year,month-1,day);
 if(!name||!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(d)||d.getFullYear()!==Number(date.slice(0,4))||d.getMonth()+1!==Number(date.slice(5,7))||d.getDate()!==Number(date.slice(8,10))){error.textContent='請輸入正確的名稱與日期';return}
 const changes=[];
 if(name!==t.text)changes.push('名稱：'+t.text+' → '+name);
 if(date!==t.date)changes.push('日期：'+t.date+' → '+date);
 if(!changes.length){detailId=null;render();return}
 const now=new Date(),base='users/'+user.uid+'/tasks/'+id,key=push(ref(db,base+'/history')).key,patch={};
 patch[base+'/text']=name;patch[base+'/date']=date;
 patch[base+'/history/'+key]={at:now.toISOString(),label:stamp(now),text:changes.join('；'),type:'change'};
 busy=true;state();error.textContent='';
 try{await update(ref(db),patch);detailId=null;live.textContent='已更新任務'}catch(e){fail(e)}finally{busy=false;state()}
}
function render(){
 if(!user||!received){active.innerHTML='<div class="empty">'+(!user?'請先登入 Google 帳號':'正在讀取雲端事項…')+'</div>';doneArea.hidden=hint.hidden=true;return}
 const pending=tasks.filter(t=>!t.completedAt).sort((a,b)=>a.date.localeCompare(b.date));
 const complete=tasks.filter(t=>t.completedAt).sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)));
 active.innerHTML=pending.length?pending.map(t=>'<div class="row"><button type="button" class="complete" data-complete="'+esc(t.id)+'" tabindex="-1">完成</button><button type="button" class="delete" data-delete="'+esc(t.id)+'" tabindex="-1">刪除</button><div class="card'+dueClass(t.date)+'" data-card="'+esc(t.id)+'" style="transform:translateX('+(openId===t.id?110:openId==='-'+t.id?-110:0)+'px)" tabindex="0"><div class="date">'+dateMarkup(t.date)+'</div><div class="text">'+esc(t.text)+'</div><button type="button" class="detail-open" data-detail="'+esc(t.id)+'">修改</button></div>'+(detailId===t.id?detailMarkup(t):'')+'</div>').join(''):'<div class="empty">目前沒有未完成事項</div>';
 hint.hidden=!pending.length;doneArea.hidden=!complete.length;
 done.innerHTML=complete.map(t=>'<div class="done"><div class="date">'+dateMarkup(t.date)+'</div><div><div class="text">'+esc(t.text)+'</div><div class="done-time">完成於 '+esc(t.completedLabel||'')+'</div><button type="button" class="detail-open" data-detail="'+esc(t.id)+'">修改 / 紀錄</button></div></div>'+(detailId===t.id?detailMarkup(t):'')).join('');
 document.querySelectorAll('[data-complete]').forEach(b=>b.onclick=()=>completeTask(b.dataset.complete));
 document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteTask(b.dataset.delete));
 document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>{detailId=b.dataset.detail;openId=null;render();document.querySelector('.detail')?.scrollIntoView({block:'nearest'})});
 document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{detailId=null;render()});
 document.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>saveDetail(b.dataset.save));
 document.querySelectorAll('[data-card]').forEach(card=>{const id=card.dataset.card;let sx=0,sy=0,base=0,drag=false;
 card.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;sx=e.clientX;sy=e.clientY;base=openId===id?110:openId==='-'+id?-110:0;drag=true;card.setPointerCapture(e.pointerId);card.style.transition='none'});
 card.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.abs(dy)>Math.abs(dx)+8)return;card.style.transform='translateX('+Math.max(-110,Math.min(110,base+dx))+'px)'});
 const finish=()=>{if(!drag)return;drag=false;card.style.transition='transform .2s ease';const offset=new DOMMatrixReadOnly(getComputedStyle(card).transform).m41;setOpen(offset>45?id:offset< -45?'-'+id:null)};
 card.addEventListener('pointerup',finish);card.addEventListener('pointercancel',finish);
 card.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();setOpen(id)}else if(e.key==='ArrowLeft'){e.preventDefault();setOpen('-'+id)}else if(e.key==='Escape'){e.preventDefault();setOpen(null)}})});
}
async function deleteTask(id){if(!ready())return;const t=tasks.find(t=>t.id===id);if(!t)return;busy=true;state();error.textContent='';try{await remove(ref(db,'users/'+user.uid+'/tasks/'+id));openId=null;detailId=null;live.textContent=t.text+' 已刪除'}catch(e){fail(e)}finally{busy=false;state()}}
async function completeTask(id){if(!ready())return;const t=tasks.find(t=>t.id===id);if(!t)return;busy=true;state();error.textContent='';try{const now=new Date();const base='users/'+user.uid+'/tasks/'+id,key=push(ref(db,base+'/history')).key,patch={};patch[base+'/completedAt']=now.toISOString();patch[base+'/completedLabel']=stamp(now);patch[base+'/status']='已完成';patch[base+'/history/'+key]={at:now.toISOString(),label:stamp(now),text:'狀態：已完成',type:'change'};await update(ref(db),patch);openId=null;live.textContent=t.text+' 已完成'}catch(e){fail(e)}finally{busy=false;state()}}
form.addEventListener('submit',async e=>{e.preventDefault();if(!ready())return;const r=parse(input.value);if(r.error){error.textContent=r.error;input.focus();return}busy=true;state();error.textContent='';try{await push(ref(db,'users/'+user.uid+'/tasks'),{date:r.date,text:r.text,createdAt:new Date().toISOString()});live.textContent='已新增 '+dateText(r.date)+' '+r.text;input.value='';input.focus()}catch(e){fail(e)}finally{busy=false;state()}});
input.addEventListener('input',()=>error.textContent='');document.addEventListener('pointerdown',e=>{if(openId&&!e.target.closest('.row'))setOpen(null)});
login.onclick=async()=>{login.disabled=true;error.textContent='';try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){fail(e);if(e.code==='auth/popup-blocked')error.textContent='請允許登入彈出式視窗後重試'}finally{login.disabled=false}};
logout.onclick=async()=>{try{await signOut(auth)}catch(e){fail(e)}};
onAuthStateChanged(auth,u=>{if(unsubTasks){unsubTasks();unsubTasks=null}if(unsubConn){unsubConn();unsubConn=null}user=u;tasks=[];received=connected=false;openId=null;detailId=null;error.textContent='';login.hidden=!!u;logout.hidden=!u;who.textContent=u?'已登入':'尚未登入';render();state();if(!u)return;const uid=u.uid;unsubConn=onValue(ref(db,'.info/connected'),s=>{if(user?.uid!==uid)return;connected=s.val()===true;state()},e=>{connected=false;fail(e);state()});unsubTasks=onValue(ref(db,'users/'+uid+'/tasks'),s=>{if(user?.uid!==uid)return;tasks=Object.entries(s.val()||{}).filter(([,t])=>t&&typeof t.date==='string'&&typeof t.text==='string').map(([id,t])=>({...t,id}));received=true;render();state()},e=>{received=false;fail(e);state('無法讀取，請確認 Firebase 規則');render()})});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js'));
state();render();