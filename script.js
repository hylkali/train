const baseRules = [
  ["1", "티켓이 없는 승객과는 대화하지 마십시오.", ""],
  ["2", "자신의 티켓을 아무에게나 보여주지 마십시오. 그곳에는 당신이 생각하는 것보다 중요한 정보가 들어있습니다.", ""],
  ["3", "티켓을 한 공간 이내에서 2번 이상 꺼내서 보지 마십시오. 그들은 알아차릴 것입니다. 그들의 눈은 사방에 있습니다.", ""],
  ["4", "기차가 멈췄을 때에는, 절대 그 어떤 문도 열어서는 안됩니다. 이 기차는 중간에 멈추지 않고 종착역까지 가는 기차입니다.", ""],
  ["5", "만약 객실을 탐험하다가, 3번 이상 같은 객실이 나온다면, 칸 구석을 바라보며 몸을 웅크리고 눈을 감고 귀를 막으십시오.", ""],
  ["6", "절대 한 공간(사면이 일시적으로, 또는 영구적으로 차단된 공간) 안에 혼자 있지 마십시오.", ""],
  ["7", "만약 자신의 폰으로 전화가 온다면 절대 받지 마십시오. 여기는 모바일데이터나 와이파이가 터지는 공간이 아닙니다. 단, 메시지가 온다면 그건 받으십시오. 열차는 당신에게 말을 걸 수도 있습니다.", "정정: 열차가 보낸 메시지는 받으시면 안됩니다. 이 열차에는 메시지를 보낼 만한 수단이 없습니다."],
  ["8", "만약 처음에는 어두웠던 방이 갑자기 밝아진다면, 그 즉시 방을 벗어나십시오. 열차에는 불을 끄고 키는 스위치가 없습니다.", ""],
  ["9", "언제나 인원체크를 잘 하십시오. 만약 방의 모두가 있는데도 누군가 노크를 4번 이상 한다면, 절대로 그에게 당신들의 어떤 것도 노출해서는 안됩니다.", ""],
  ["10", "비어있는 칸을 탐험하다가, 커다란 피얼룩이 보이셔도 걱정하지 마시고 탐사를 이어가십시오. 단, 절대 핏자국을 3초 이상 응시하시면 안됩니다.", ""],
  ["11", "저희 열차에는 흡연칸이 없습니다. 이 칸이 보여도 절대 들어가지 마세요.", ""]
];

const state = JSON.parse(localStorage.getItem("trainManualState") || "null") || {
  visitCount: 0,
  totalSeconds: 0,
  maxScroll: 0,
  readRules: [],
  clicked: [],
  version: "1.0",
  unlocked: false
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
let lastSavedSeconds = 0;
const visitedRules = new Set(state.readRules);

function persist() {
  state.totalSeconds += seconds - lastSavedSeconds;
  lastSavedSeconds = seconds;
  state.maxScroll = Math.max(state.maxScroll, window.scrollY + window.innerHeight);
  state.readRules = [...visitedRules];
  localStorage.setItem("trainManualState", JSON.stringify(state));
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function getRulesForStage(stage = 0) {
  const rules = baseRules.map(rule => [...rule]);

  // The core rules remain unchanged. Later stages alter only the document's
  // presentation/metadata, preserving the rules supplied by the author.
  if (stage >= 3) {
    rules.splice(4, 0, ["5", "제5조는 존재하지 않습니다.", "본 문서에는 제5조가 존재하지 않는 것으로 기록되어 있습니다."]);
  }

  if (stage >= 4) {
    rules.splice(4, 0, ["", "이 항목은 이전 열람 기록에 의해 표시되었습니다.", "현재 열람자에게만 표시되는 문서 기록입니다."]);
  }

  return rules;
}

function renderRules(stage = 0) {
  rulesEl.innerHTML = "";
  const rules = getRulesForStage(stage);

  rules.forEach((rule, index) => {
    const [number, text, note] = rule;
    const article = document.createElement("article");
    article.className = "rule";
    article.dataset.index = index;
    article.innerHTML = `${number ? `<span class="rule-num">제${number}조.</span>` : ""}<span class="rule-text">${text}</span>${note ? `<span class="rule-note">${note}</span>` : ""}`;

    if (visitedRules.has(index)) article.classList.add("read");
    rulesEl.appendChild(article);
  });

  const versions = ["1.0", "1.1", "1.2", "1.3", "2.0"];
  versionEl.textContent = versions[Math.min(stage, versions.length - 1)];
  observeRules();
}

function setStage(stage) {
  if (stage <= currentStage) return;
  currentStage = stage;
  renderRules(stage);

  if (stage === 1) toast("문서가 수정되었습니다.");

  if (stage === 2) {
    toast("일부 문서 기록이 변경되었습니다.");
  }

  if (stage === 3) {
    warningEl.classList.remove("hidden");
    warningEl.textContent = "문서의 항목 번호가 정상적으로 표시되지 않습니다.";
    toast("문서 구조에 오류가 발견되었습니다.");
  }

  if (stage === 4) {
    readerStateEl.textContent = "문서 열람 기록 확인됨";
    toast("이 문서는 열람자의 기록을 유지합니다.");
  }
}

const ruleObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = Number(entry.target.dataset.index);
      visitedRules.add(idx);
      entry.target.classList.add("read");
      persist();
    }
  });
}, { threshold: 0.65 });

function observeRules() {
  ruleObserver.disconnect();
  document.querySelectorAll(".rule").forEach(el => ruleObserver.observe(el));
}

renderRules(0);

const timer = setInterval(() => {
  seconds++;
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  timerEl.textContent = `문서 열람 시간 ${m}:${s}`;

  if (seconds === 30) setStage(1);
  if (seconds === 65) setStage(2);
  if (seconds === 105) setStage(3);
  if (seconds === 155) setStage(4);

  if (seconds % 10 === 0) persist();
}, 1000);

window.addEventListener("scroll", () => {
  state.maxScroll = Math.max(state.maxScroll, window.scrollY + window.innerHeight);
  localStorage.setItem("trainManualState", JSON.stringify(state));
});

document.getElementById("searchBtn").addEventListener("click", () => {
  const q = document.getElementById("searchInput").value.trim();
  const out = document.getElementById("searchResults");

  if (!q) {
    out.textContent = "검색어를 입력하십시오.";
    return;
  }

  const results = [...document.querySelectorAll(".rule")].filter(rule => rule.textContent.includes(q));
  out.innerHTML = `<div class="result">검색 결과 ${results.length}건</div>`;

  results.forEach(rule => {
    const result = document.createElement("div");
    result.className = "result";
    result.textContent = rule.textContent;
    out.appendChild(result);
  });

  if (q.includes("승무원") && currentStage >= 2) {
    const ghost = document.createElement("div");
    ghost.className = "result";
    ghost.innerHTML = `<b>[삭제된 문서]</b> 승무원 관련 기록 <button id="ghost">열람</button>`;
    out.appendChild(ghost);
    document.getElementById("ghost").onclick = () => toast("해당 문서는 존재하지 않습니다.");
  }
});

document.getElementById("docInfo").addEventListener("click", () => {
  if (!state.clicked.includes("docInfo")) {
    state.clicked.push("docInfo");
    persist();
    toast(state.visitCount > 1 ? "이 문서는 이전 열람 기록을 포함합니다." : "정상 문서입니다.");
  } else {
    toast("문서번호 PS-0714는 수정할 수 없습니다.");
  }
});

document.getElementById("closeSecret").addEventListener("click", () => {
  document.getElementById("secret").classList.add("hidden");
});

window.addEventListener("beforeunload", () => {
  persist();
  clearInterval(timer);
});

if (state.visitCount > 1) {
  setTimeout(() => toast("다시 오셨군요."), 900);
}
