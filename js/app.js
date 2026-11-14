import { stations } from "./data/stations.js";
import { createPiPController } from "./features/pip.js";

const $=id=>document.getElementById(id), audio=$("audio");
let currentId=localStorage.getItem("radioLastStation")||"cbs981";
let favorites=JSON.parse(localStorage.getItem("radioFavorites")||"[]");
let baseVolume=Number(localStorage.getItem("radioVolume")||100)/100;
let hls=null, requestNo=0, timerDeadline=null, timerTick=null;
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
function setStatus(t,live=false){$("status").textContent=t;$("dot").classList.toggle("live",live);pip.update()}
function current(){return stations.find(s=>s.id===currentId)||stations[0]}
function isFav(s){return favorites.includes(s.id)}
function persist(){localStorage.setItem("radioFavorites",JSON.stringify(favorites))}
function updateCurrent(){const s=current();$("currentName").textContent=s.name;$("currentMeta").textContent=s.freq+" · "+s.group+(s.expires?" · 주소 만료 예정":"");$("currentStar").textContent=isFav(s)?"★":"☆";$("currentStar").classList.toggle("on",isFav(s))}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
const pip = createPiPController({
  getCurrent: current,
  getAudio: () => audio,
  onTogglePlay: () => $("play").click(),
  onChangeStation: changeStation,
  escapeHtml: esc
});
function row(s){return `<div class="station-row ${s.id===currentId?"selected":""}"><button class="station-pick" data-play="${s.id}">${esc(s.name)}<span class="station-sub">${esc(s.freq)} · ${esc(s.kind)}</span></button><button class="star ${isFav(s)?"on":""}" data-fav="${s.id}" aria-label="즐겨찾기">${isFav(s)?"★":"☆"}</button></div>`}
function renderFavorites(){const a=stations.filter(isFav);$("favCount").textContent=a.length;$("favorites").innerHTML=a.length?a.map(row).join(""):'<div class="empty">별표를 선택하면 즐겨찾기에 추가됩니다.</div>'}
function renderAll(){const q=$("search").value.trim().toLowerCase();const a=stations.filter(s=>(s.name+" "+s.group).toLowerCase().includes(q));$("channelCount").textContent=a.length+"개";const groups={};a.forEach(s=>(groups[s.group]??=[]).push(s));const priority=["KBS","MBC","SBS"];const ordered=Object.entries(groups).sort((a,b)=>{const ai=priority.indexOf(a[0]),bi=priority.indexOf(b[0]);return (ai<0?99:ai)-(bi<0?99:bi)});$("allChannels").innerHTML=ordered.map(([g,list])=>`<div class="group-title">${esc(g)}</div><div class="station-list">${list.map(row).join("")}</div>`).join("")||'<div class="empty">검색 결과가 없습니다.</div>'}
function render(){updateCurrent();renderFavorites();renderAll();pip.update()}
function destroy(){if(hls){hls.destroy();hls=null}audio.pause();audio.removeAttribute("src");audio.load()}
async function loadHls(){if(window.Hls)return window.Hls;await new Promise((ok,no)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";s.onload=ok;s.onerror=no;document.head.appendChild(s)});return window.Hls}
async function playStation(s){currentId=s.id;localStorage.setItem("radioLastStation",currentId);render();requestNo++;const n=requestNo;destroy();setStatus("LOADING");$("play").textContent="▶";try{if(audio.canPlayType("application/vnd.apple.mpegurl")){audio.src=s.url;audio.load();await audio.play()}else{const Hls=await loadHls();if(n!==requestNo)return;if(!Hls.isSupported())throw Error("HLS 미지원");hls=new Hls({enableWorker:true,lowLatencyMode:false,maxBufferLength:20});hls.loadSource(s.url);hls.attachMedia(audio);await new Promise((resolve,reject)=>{hls.once(Hls.Events.MANIFEST_PARSED,resolve);hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)reject(Error(d.details))})});if(n!==requestNo)return;await audio.play()}if(n===requestNo){setStatus("ON AIR",true);$("play").textContent="Ⅱ"}}catch(e){console.error("Stream error",s.id,e);if(n===requestNo){setStatus("PLAY ERROR");$("play").textContent="▶";alert(s.name+" 재생할 수 없습니다. 스트리밍 주소가 만료되었거나 방송사 서버에서 접근을 제한했을 수 있습니다.")}}}
document.addEventListener("click",e=>{const p=e.target.closest("[data-play]"),f=e.target.closest("[data-fav]");if(p){const s=stations.find(x=>x.id===p.dataset.play);if(s)playStation(s)}if(f){const s=stations.find(x=>x.id===f.dataset.fav);if(s){favorites=isFav(s)?favorites.filter(x=>x!==s.id):[...favorites,s.id];persist();render()}}});
$("currentStar").addEventListener("click",()=>{const s=current();favorites=isFav(s)?favorites.filter(x=>x!==s.id):[...favorites,s.id];persist();render()});
$("play").addEventListener("click",async()=>{if(!audio.paused){audio.pause();$("play").textContent="▶";setStatus("PAUSED")}else if(audio.src){try{await audio.play();$("play").textContent="Ⅱ";setStatus("ON AIR",true)}catch(e){playStation(current())}}else playStation(current())});
$("stop").addEventListener("click",()=>{requestNo++;destroy();$("play").textContent="▶";setStatus("STOPPED")});
audio.addEventListener("playing",()=>{setStatus("ON AIR",true);$("play").textContent="Ⅱ";pip.update()});audio.addEventListener("pause",()=>pip.update());audio.addEventListener("waiting",()=>{if(!audio.paused)setStatus("BUFFERING")});audio.addEventListener("error",()=>{if(audio.src&&!audio.paused)setStatus("PLAY ERROR")});
function changeStation(direction){const i=stations.findIndex(s=>s.id===currentId),next=(i+direction+stations.length)%stations.length;playStation(stations[next])}
$("pipButton").addEventListener("click",pip.open);
function fade(){if(timerDeadline===null)return 1;return Math.max(0,Math.min(1,(timerDeadline-Date.now())/60000))}
function applyVolume(){if(!isIOS)audio.volume=Math.max(0,Math.min(1,baseVolume*fade()))}
$("volume").value=Math.round(baseVolume*100);$("volumeValue").textContent=$("volume").value+"%";$("volumeText").textContent=$("volume").value+"%";audio.volume=baseVolume;
$("volume").addEventListener("input",()=>{baseVolume=Number($("volume").value)/100;$("volumeValue").textContent=$("volume").value+"%";$("volumeText").textContent=$("volume").value+"%";localStorage.setItem("radioVolume",$("volume").value);applyVolume()});
if(isIOS){$("volume").disabled=true;$("volumeNote").textContent="iPhone/iPad Safari에서는 웹페이지 음량 조절이 제한됩니다. 기기 측면 음량 버튼 또는 제어 센터를 이용해 주세요.";$("volumeNote").classList.add("warn")}else $("volumeNote").textContent="슬라이더로 재생 음량을 조절할 수 있습니다.";
function startTimer(mins){if(!Number.isFinite(mins)||mins<1||mins>720){alert("1~720분 사이로 설정해 주세요.");return}clearInterval(timerTick);timerDeadline=Date.now()+mins*60000;document.querySelectorAll(".timer-btn").forEach(b=>b.classList.toggle("active",Number(b.dataset.min)===mins));$("timerLabel").textContent="예약 작동 중";$("cancel").hidden=$("extend").hidden=false;tick();timerTick=setInterval(tick,250)}
function tick(){if(timerDeadline===null)return;const left=Math.max(0,timerDeadline-Date.now()),sec=Math.ceil(left/1000);$("timerTime").textContent=String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");applyVolume();if(left<=0){clearInterval(timerTick);timerTick=null;timerDeadline=null;requestNo++;destroy();$("timerLabel").textContent="재생 종료";$("timerTime").textContent="00:00";$("cancel").hidden=$("extend").hidden=true;document.querySelectorAll(".timer-btn").forEach(b=>b.classList.remove("active"));setStatus("TIMER ENDED")}}
function cancelTimer(){clearInterval(timerTick);timerTick=null;timerDeadline=null;applyVolume();$("timerLabel").textContent="예약 꺼짐";$("timerTime").textContent="--:--";$("cancel").hidden=$("extend").hidden=true;document.querySelectorAll(".timer-btn").forEach(b=>b.classList.remove("active"))}
document.querySelectorAll(".timer-btn").forEach(b=>b.addEventListener("click",()=>startTimer(Number(b.dataset.min))));$("customSet").addEventListener("click",()=>startTimer(Number($("custom").value)));$("cancel").addEventListener("click",cancelTimer);$("extend").addEventListener("click",()=>{if(timerDeadline!==null)startTimer(Math.ceil((timerDeadline-Date.now())/60000)+15)});$("search").addEventListener("input",renderAll);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&timerDeadline!==null)tick()});
render();
