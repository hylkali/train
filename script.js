const baseRules = [
  ["1", "승객은 승차권을 항상 소지하여야 합니다.", "승차권은 타인에게 양도할 수 없습니다."],
  ["2", "승객은 본인의 좌석 또는 지정된 객실에서 대기하여야 합니다.", ""],
  ["3", "열차가 완전히 정차하기 전까지 객실을 이동하지 마십시오.", ""],
  ["4", "승무원의 안내방송이 있을 경우 그 내용을 숙지하십시오.", ""],
  ["5", "창문을 임의로 개방하지 마십시오.", ""],
  ["6", "객실 내에서 발견한 물품은 원래 위치에 두십시오.", ""],
  ["7", "승객의 안전을 위하여 다른 승객의 상태를 확인할 필요가 있습니다.", ""],
  ["8", "열차 내에서 이름을 묻는 사람이 있다면 대답하지 마십시오.", ""],
  ["9", "이상 현상을 발견한 경우 가까운 승무원에게 알리십시오.", ""],
  ["10", "방송실에서 송출되는 내용은 사실에 근거합니다.", ""],
  ["11", "본 매뉴얼의 내용과 상충하는 안내가 있을 경우 본 매뉴얼을 우선하십시오.", ""],
  ["12", "모든 승객은 종착 시까지 열차의 안내에 따라 행동하여야 합니다.", ""]
];

const state = JSON.parse(localStorage.getItem("trainManualState") || "null") || {
  visitCount: 0, totalSeconds: 0, maxScroll: 0, readRules: [],
  clicked: [], version: "1.0", unlocked: false
};
state.visitCount++;
localStorage.setItem("trainManualState", JSON.stringify(state));

const rulesEl = document.getElementById("rules");
const timerEl = document.getElementById("timer");
const versionEl = document.getElementById("version");
const warningEl = document.getElementById("warning");
const readerStateEl = document.getElementById("readerState");
const toastEl = document.getElementById("toast");

let seconds = 0;
let currentStage = 0;
let visitedRules = new Set(state.readRules);

function save(){
  state.totalSeconds += seconds;
  state.maxScroll = Math.max(state.maxScroll, window.scrollY + window.innerHeight);
  state.readRules = [...visitedRules];
  localStorage.setItem("trainManualState", JSON.stringify(state));
}

function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(()=>toastEl.classList.remove("show"), 2600);
}

function renderRules(stage=0){
  rulesEl.innerHTML = "";
  let rules = baseRules.map(x=>[...x]);

  if(stage >= 1) {
    rules[6][1] = "승객의 안전을 위하여 다른 승객의 상태를 확인할 필요가 있습니다. 단, 이름을 확인해서는 안 됩니다.";
  }
  if(stage >= 2) {
    rules[8][1] = "이상 현상을 발견한 경우 가까운 승무원에게 알리지 마십시오.";
    rules[4][2] = "※ 창문 밖에서 사람의 모습이 보이는 경우에도 동일합니다.";
  }
  if(stage >= 3) {
    rules.splice(4,0,["5", "제5조는 존재하지 않습니다.", "본 문서에는 제5조가 존재하지 않는 것으로 기록되어 있습니다."]);
    rules[5][0] = "6";
    rules[6][0] = "7";
    rules[7][0] = "8";
    rules[8][0] = "9";
    rules[9][0] = "10";
    rules[10][0] = "11";
    rules[11][0] = "12";
    rules[12][0] = "13";
  }
  if(stage >= 4) {
    rules[4][1] = "제5조를 읽지 마십시오.";
    rules[4][2] = "이미 읽었다면 제3조로 돌아가십시오.";
    readerStateEl.textContent = "문서 열람 기록 확인됨";
  }

  rules.forEach((r,i)=>{
    const article = document.createElement("article");
    article.className = "rule";
    article.dataset.index = i;
    article.innerHTML = `<span class="rule-num">제${r[0]}조.</span><span class="rule-text">${r[1]}</span>${r[2]?`<span class="rule-note">${r[2]}</span>`:""}`;
    if(visitedRules.has(i)) article.classList.add("read");
    rulesEl.appendChild(article);
  });

  versionEl.textContent = ["1.0","1.1","1.2","1.3","2.0"][stage];
}

function setStage(stage){
  if(stage <= currentStage) return;
  currentStage = stage;
  renderRules(stage);
  if(stage===1) toast("문서가 수정되었습니다.");
  if(stage===2) toast("일부 항목의 내용이 변경되었습니다.");
  if(stage===3) {
    warningEl.classList.remove("hidden");
    warningEl.textContent = "문서의 항목 번호가 정상적으로 표시되지 않습니다.";
    toast("문서 구조에 오류가 발견되었습니다.");
  }
  if(stage===4) toast("이 문서는 열람자의 기록을 유지합니다.");
}

renderRules(0);

const timer = setInterval(()=>{
  seconds++;
  const m=String(Math.floor(seconds/60)).padStart(2,"0");
  const s=String(seconds%60).padStart(2,"0");
  timerEl.textContent=`문서 열람 시간 ${m}:${s}`;
  if(seconds===30) setStage(1);
  if(seconds===65) setStage(2);
  if(seconds===105) setStage(3);
  if(seconds===155) setStage(4);
  if(seconds % 10 === 0) save();
},1000);

const observer = new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      const idx = Number(entry.target.dataset.index);
      visitedRules.add(idx);
      entry.target.classList.add("read");
      state.readRules=[...visitedRules];
      localStorage.setItem("trainManualState", JSON.stringify(state));
    }
  });
},{threshold:.65});

function observeRules(){
  document.querySelectorAll(".rule").forEach(el=>observer.observe(el));
}
observeRules();

const oldRender = renderRules;
renderRules = function(stage){
  oldRender(stage);
  observeRules();
};

window.addEventListener("scroll",()=>{
  state.maxScroll=Math.max(state.maxScroll,window.scrollY+window.innerHeight);
  localStorage.setItem("trainManualState",JSON.stringify(state));
});

document.getElementById("searchBtn").addEventListener("click",()=>{
  const q=document.getElementById("searchInput").value.trim();
  const out=document.getElementById("searchResults");
  if(!q){out.textContent="검색어를 입력하십시오.";return;}
  const results=[...document.querySelectorAll(".rule")].filter(x=>x.textContent.includes(q));
  if(q.includes("승무원") && currentStage>=2){
    out.innerHTML=`<div class="result">검색 결과 ${results.length+1}건</div>
      <div class="result"><b>[삭제된 문서]</b> 승무원 관련 기록 <button id="ghost">열람</button></div>`;
    document.getElementById("ghost").onclick=()=>{
      toast("해당 문서는 존재하지 않습니다.");
    };
  } else {
    out.innerHTML=`<div class="result">검색 결과 ${results.length}건</div>`;
    results.forEach(x=>{
      const d=document.createElement("div"); d.className="result";
      d.textContent=x.textContent; out.appendChild(d);
    });
  }
});

document.getElementById("docInfo").addEventListener("click",()=>{
  if(!state.clicked.includes("docInfo")){
    state.clicked.push("docInfo"); save();
    toast(state.visitCount>1 ? "이 문서는 이전 열람 기록을 포함합니다." : "정상 문서입니다.");
  } else {
    toast("문서번호 PS-0714는 수정할 수 없습니다.");
  }
});

document.getElementById("closeSecret").addEventListener("click",()=>{
  document.getElementById("secret").classList.add("hidden");
});

window.addEventListener("beforeunload",save);

if(state.visitCount>1){
  setTimeout(()=>toast("다시 오셨군요."),900);
}
