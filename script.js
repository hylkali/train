(() => {
  'use strict';

  const STORAGE_KEY = 'trainManualState_v4';
  const MAX_STAGE = 6;
  const BASE_RULES = [
    { id:'r1', number:'1', text:'티켓이 없는 승객과는 대화하지 마십시오.' },
    { id:'r2', number:'2', text:'자신의 티켓을 아무에게나 보여주지 마십시오. 그곳에는 당신이 생각하는 것보다 중요한 정보가 들어있습니다.' },
    { id:'r3', number:'3', text:'티켓을 한 공간 이내에서 2번 이상 꺼내서 보지 마십시오. 그들은 알아차릴 것입니다. 그들의 눈은 사방에 있습니다.' },
    { id:'r4', number:'4', text:'기차가 멈췄을 때에는, 절대 그 어떤 문도 열어서는 안됩니다. 이 기차는 중간에 멈추지 않고 종착역까지 가는 기차입니다.' },
    { id:'r5', number:'5', text:'만약 객실을 탐험하다가, 3번 이상 같은 객실이 나온다면, 칸 구석을 바라보며 몸을 웅크리고 눈을 감고 귀를 막으십시오.' },
    { id:'r6', number:'6', text:'절대 한 공간(사면이 일시적으로, 또는 영구적으로 차단된 공간) 안에 혼자 있지 마십시오.' },
    { id:'r7', number:'7', text:'만약 자신의 폰으로 전화가 온다면 절대 받지 마십시오. 여기는 모바일데이터나 와이파이가 터지는 공간이 아닙니다. 단, 메시지가 온다면 그건 받으십시오. 열차는 당신에게 말을 걸 수도 있습니다.' },
    { id:'r8', number:'8', text:'만약 처음에는 어두웠던 방이 갑자기 밝아진다면, 그 즉시 방을 벗어나십시오. 열차에는 불을 끄고 키는 스위치가 없습니다.' },
    { id:'r9', number:'9', text:'언제나 인원체크를 잘 하십시오. 만약 방의 모두가 있는데도 누군가 노크를 4번 이상 한다면, 절대로 그에게 당신들의 어떤 것도 노출해서는 안됩니다.' },
    { id:'r10', number:'10', text:'비어있는 칸을 탐험하다가, 커다란 피얼룩이 보이셔도 걱정하지 마시고 탐사를 이어가십시오. 단, 절대 핏자국을 3초 이상 응시하시면 안됩니다.' },
    { id:'r11', number:'11', text:'저희 열차에는 흡연칸이 없습니다. 이 칸이 보여도 절대 들어가지 마세요.' }
  ];

  const DEFAULT = {
    visitCount:0, totalSeconds:0, maxScroll:0, readRules:[], ruleReads:{},
    searched:[], searchCount:0, clicks:0, metadataClicks:0, scrollBack:0,
    clicked:[], events:[], firstVisit:null, lastVisit:null, stage:0, version:'1.0',
    unlocked:false, ending:false, clueFlags:[], endingType:null
  };

  const $ = id => document.getElementById(id);
  const cloneDefault = () => JSON.parse(JSON.stringify(DEFAULT));
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefault();
      const saved = JSON.parse(raw);
      const merged = Object.assign(cloneDefault(), saved || {});
      merged.readRules = Array.isArray(merged.readRules) ? merged.readRules : [];
      merged.searched = Array.isArray(merged.searched) ? merged.searched : [];
      merged.clueFlags = Array.isArray(merged.clueFlags) ? merged.clueFlags : [];
      merged.clicked = Array.isArray(merged.clicked) ? merged.clicked : [];
      merged.events = Array.isArray(merged.events) ? merged.events : [];
      merged.ruleReads = merged.ruleReads && typeof merged.ruleReads === 'object' ? merged.ruleReads : {};
      return merged;
    } catch (error) {
      console.warn('저장된 문서를 읽지 못했습니다.', error);
      return cloneDefault();
    }
  }

  const state = loadState();
  const returning = state.visitCount > 0;
  state.visitCount += 1;
  state.firstVisit = state.firstVisit || new Date().toISOString();
  state.lastVisit = new Date().toISOString();

  const rulesEl = $('rules');
  const timerEl = $('timer');
  const versionEl = $('version');
  const warningEl = $('warning');
  const readerStateEl = $('readerState');
  const toastEl = $('toast');
  const searchInput = $('searchInput');
  const searchResults = $('searchResults');
  const effectiveDate = $('effectiveDate');
  const modified = $('modified');

  let sessionSeconds = 0;
  let lastPersistedSession = 0;
  let currentStage = Math.min(Number(state.stage) || 0, MAX_STAGE);
  let toastTimer = null;
  let lastScrollY = window.scrollY;
  let renderVersion = 0;
  const visitedRules = new Set(state.readRules);

  function escapeHTML(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function formatTime(seconds) {
    const n = Math.max(0, Math.floor(seconds));
    return String(Math.floor(n / 60)).padStart(2,'0') + ':' + String(n % 60).padStart(2,'0');
  }
  function addEvent(message) {
    if (!state.events.includes(message)) state.events.push(message);
    state.events = state.events.slice(-30);
  }
  function addClue(flag) {
    if (!state.clueFlags.includes(flag)) state.clueFlags.push(flag);
  }
  function persist() {
    state.totalSeconds += Math.max(0, sessionSeconds - lastPersistedSession);
    lastPersistedSession = sessionSeconds;
    state.maxScroll = Math.max(state.maxScroll, window.scrollY + window.innerHeight);
    state.readRules = [...visitedRules];
    state.stage = Math.max(state.stage, currentStage);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { console.warn('열람 기록을 저장하지 못했습니다.', error); }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  function getRules(stage) {
    const rules = BASE_RULES.map(rule => Object.assign({}, rule));
    if (stage >= 1) {
      rules[6].note = '정정: 열차가 보낸 메시지는 받으시면 안됩니다. 이 열차에는 메시지를 보낼 만한 수단이 없습니다.';
    }
    if (stage >= 2) {
      rules[3].text = '기차가 멈췄을 때에는, 절대 그 어떤 문도 열어서는 안됩니다. 이 기차는 중간에 멈추지 않고 종착역까지 가는 기차입니다.\n\n[열람 기록에 의해 추가됨] 단, 문이 열려 있는 상태라면 닫지 마십시오.';
      rules[10].note = '※ 이전 판본에는 이 항목의 존재 여부가 기록되어 있지 않습니다.';
    }
    if (stage >= 3) {
      rules.splice(4, 0, { id:'ghost5', number:'5', text:'제5조는 존재하지 않습니다.', note:'이 항목은 다른 판본에서 확인되지 않았습니다.' });
      rules[6].note = '정정: 열차가 보낸 메시지는 받으시면 안됩니다. 이 열차에는 메시지를 보낼 만한 수단이 없습니다.\n[이전 판본과 불일치]';
      rules[8].note = '문서 기록: 현재 인원 수와 이 항목의 전제 조건이 일치하지 않습니다.';
    }
    if (stage >= 4) {
      rules.splice(7, 0, { id:'reader-record', number:'', text:'이 항목은 이전 열람 기록에 의해 표시되었습니다.', note:'현재 열람자에게만 표시되는 문서 기록입니다.' });
      rules[0].text = '티켓이 없는 승객과는 대화하지 마십시오.\n\n단, 이 문서를 읽고 있는 승객에게는 예외가 적용됩니다.';
      rules[0].note = '※ 본 문서는 승객에게 말을 걸기 위한 문서가 아닙니다.';
    }
    if (stage >= 5) {
      rules[3].note = '문서 주석: 열차가 멈추었다는 사실과 이 항목의 존재가 동시에 기록된 적이 있습니다.';
      rules[10].text = '저희 열차에는 흡연칸이 없습니다. 이 칸이 보여도 절대 들어가지 마세요.\n\n[열람자 기록] 귀하는 이 문장을 이전에 읽었습니다.';
    }
    if (stage >= 6) {
      rules.push({ id:'final-record', number:'?', text:'이 문서를 닫기 전에, 제4조와 제7조를 다시 확인하십시오.', note:'※ 이 항목은 인쇄본에는 존재하지 않습니다.' });
    }
    return rules;
  }

  function highlightText(text, stage) {
    let safe = escapeHTML(text).replace(/\n/g, '<br>');
    if (stage >= 4) safe = safe.replace('예외', '<span class="secret-letter">예외</span>');
    if (stage >= 5) safe = safe.replace('이 문장을 이전에 읽었습니다.', '<span class="secret-letter">이 문장을 이전에 읽었습니다.</span>');
    return safe;
  }

  function renderRules(stage) {
    renderVersion += 1;
    const localRender = renderVersion;
    rulesEl.innerHTML = '';
    const rules = getRules(stage);
    rules.forEach((rule, index) => {
      const article = document.createElement('article');
      article.className = 'rule';
      article.dataset.id = rule.id;
      article.dataset.index = String(index);
      if (visitedRules.has(rule.id)) article.classList.add('read');
      if (['ghost5','reader-record','final-record'].includes(rule.id) || stage >= 2 && ['r4','r11'].includes(rule.id)) article.classList.add('changed');
      const number = rule.number ? '<span class="rule-num">제' + escapeHTML(rule.number) + '조.</span>' : '';
      const note = rule.note ? '<span class="rule-note">' + escapeHTML(rule.note).replace(/\n/g,'<br>') + '</span>' : '';
      article.innerHTML = number + '<span class="rule-text">' + highlightText(rule.text, stage) + '</span>' + note;
      rulesEl.appendChild(article);
    });
    versionEl.textContent = ['1.0','1.1','1.2','1.3','2.0','2.0-R','2.1-READ'][stage];
    state.version = versionEl.textContent;
    $('pageState').textContent = stage >= 4 ? '?' : '1';
    effectiveDate.textContent = stage >= 5 ? '시행일자 : 20XX. 07. 14. (기록 보정됨)' : '시행일자 : 20XX. 07. 14.';
    modified.textContent = stage === 0 ? '최종 수정 : 20XX. 07. 14.' : '최종 수정 : ' + (stage >= 5 ? '열람 중' : '20XX. 07. 14.  ' + ['','A','B','C','D'][Math.min(stage,4)] + '차 수정');
    warningEl.classList.toggle('hidden', stage < 3);
    if (stage >= 3) warningEl.textContent = stage >= 6 ? '문서 번호와 내용의 대응 관계가 확인되지 않습니다.' : '문서의 항목 번호가 정상적으로 표시되지 않습니다.';
    $('readingNote').classList.toggle('hidden', stage < 4);
    if (stage >= 4) $('readingNote').textContent = '※ 동일한 문서가 모든 열람자에게 동일하게 표시된다는 보장은 없습니다.';
    readerStateEl.textContent = stage >= 4 ? '열람 기록 확인됨' : '정상';
    document.body.classList.toggle('unstable', stage >= 4);
    if (localRender !== renderVersion) return;
    document.querySelectorAll('.rule').forEach(article => {
      article.addEventListener('click', () => {
        const id = article.dataset.id;
        if (!id) return;
        state.clicks += 1;
        if (!state.clicked.includes(id)) state.clicked.push(id);
        if (id === 'ghost5') { addClue('ghost-rule'); toast('제5조의 존재 여부를 확인할 수 없습니다.'); }
        if (id === 'reader-record') { addClue('reader-record'); toast('이 기록은 현재 열람자를 기준으로 작성되었습니다.'); }
        if (id === 'final-record') { addClue('final-check'); toast('제4조와 제7조의 변경 기록을 비교하십시오.'); }
        persist(); checkProgress();
      });
    });
    observeRules();
  }

  let observer = null;
  function observeRules() {
    if (observer) observer.disconnect();
    if (!('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.dataset.id;
        if (!id) return;
        visitedRules.add(id);
        state.ruleReads[id] = (state.ruleReads[id] || 0) + 1;
        entry.target.classList.add('read');
        persist();
        checkProgress();
      });
    }, {threshold:0.65});
    document.querySelectorAll('.rule').forEach(rule => observer.observe(rule));
  }

  function setStage(stage, reason) {
    stage = Math.max(0, Math.min(MAX_STAGE, Number(stage) || 0));
    if (stage <= currentStage) return;
    currentStage = stage;
    renderRules(stage);
    const messages = {
      1:'문서가 수정되었습니다.',
      2:'일부 문서 기록이 변경되었습니다.',
      3:'문서 구조에 오류가 발견되었습니다.',
      4:'이 문서는 열람자의 기록을 유지합니다.',
      5:'문서가 열람자를 구분하기 시작했습니다.',
      6:'문서의 최종 기록이 생성되었습니다.'
    };
    addEvent(messages[stage] || '문서가 수정되었습니다.');
    if (reason) addEvent(reason);
    toast(messages[stage]);
    persist();
    checkProgress();
  }

  function checkProgress() {
    const searched = state.searchCount >= 2;
    const readEnough = visitedRules.size >= 7;
    const scrolled = state.maxScroll >= Math.max(500, document.documentElement.scrollHeight * 0.45);
    if (currentStage >= 2 && searched) addClue('search');
    if (readEnough) addClue('read-seven');
    if (scrolled) addClue('deep-scroll');
    if (state.scrollBack >= 2) addClue('scroll-back');
    if (state.metadataClicks >= 2) addClue('metadata');
    if (returning) addClue('returning');
    if (currentStage >= 4 && searched && readEnough && scrolled) {
      if (!state.unlocked) {
        state.unlocked = true;
        addEvent('비공개 문서가 해금되었습니다.');
        toast('문서 하단에서 새로운 기록이 발견되었습니다.');
      }
    }
    if (currentStage >= 5 && state.unlocked && returning && visitedRules.size >= 10 && state.clueFlags.includes('ghost-rule')) {
      if (!state.ending) {
        state.ending = true;
        state.endingType = 'true';
        setTimeout(showEnding, 650);
      }
    }
    if (currentStage >= 6 && state.unlocked) addClue('final-stage');
    persist();
  }

  function doSearch() {
    const q = searchInput.value.trim();
    if (!q) { searchResults.textContent = '검색어를 입력하십시오.'; return; }
    state.searchCount += 1;
    state.searched.push(q);
    state.searched = state.searched.slice(-20);
    persist();
    const lower = q.toLowerCase();
    const rules = [...document.querySelectorAll('.rule')];
    const matches = rules.filter(rule => rule.textContent.includes(q));
    searchResults.innerHTML = '';
    const count = document.createElement('div'); count.className='result'; count.textContent='검색 결과 ' + matches.length + '건'; searchResults.appendChild(count);
    matches.forEach(rule => { const d=document.createElement('div'); d.className='result'; d.textContent=rule.textContent; searchResults.appendChild(d); });

    if (currentStage >= 2 && ['승무원','삭제','존재','열람','기록'].some(word => lower.includes(word))) {
      const ghost=document.createElement('div'); ghost.className='result';
      const label=document.createElement('b'); label.textContent='[삭제된 문서]';
      const text=document.createTextNode(' 승무원 관련 기록 ');
      const btn=document.createElement('button'); btn.type='button'; btn.textContent='열람';
      ghost.append(label,text,btn); searchResults.appendChild(ghost);
      btn.addEventListener('click',()=>{state.clicks+=1;addClue('ghost-search');persist();toast('해당 문서는 존재하지 않습니다.');});
    }
    if (lower === '예외' && currentStage >= 4) { addClue('exception-search'); toast('검색어가 문서의 일부 기록과 일치합니다.'); }
    if (lower === '제4조' && currentStage >= 5) { addClue('rule4-search'); toast('제4조의 수정 기록이 존재합니다.'); }
    if (lower === '제7조' && currentStage >= 5) { addClue('rule7-search'); toast('제7조에는 정정 기록이 존재합니다.'); }
    checkProgress();
  }

  function showHistory() {
    const reads = [...visitedRules].sort().map(id => '<li>' + escapeHTML(id) + ' 열람</li>').join('') || '<li>기록 없음</li>';
    const clues = state.clueFlags.length ? state.clueFlags.map(escapeHTML).join(', ') : '없음';
    $('historyContent').innerHTML = '<p>방문 횟수: <strong>'+state.visitCount+'</strong></p>' +
      '<p>누적 열람 시간: <strong>'+formatTime(state.totalSeconds + sessionSeconds)+'</strong></p>' +
      '<p>최대 스크롤 위치: <strong>'+Math.floor(state.maxScroll)+'px</strong></p>' +
      '<p>읽은 항목</p><ol class="history-list">'+reads+'</ol>' +
      '<p>최근 검색: '+(state.searched.length ? state.searched.slice(-5).map(escapeHTML).join(', ') : '없음')+'</p>' +
      '<p>발견 기록: '+escapeHTML(clues)+'</p>' +
      '<p>문서 버전: <strong>'+escapeHTML(state.version)+'</strong></p>';
    $('history').classList.remove('hidden');
  }

  function showEnding() {
    $('secretTitle').textContent = '승객용 매뉴얼 원본';
    $('secretContent').innerHTML = '<p class="secret-text">이 문서는 일반 승객에게 공개되지 않습니다.</p>' +
      '<p class="secret-text">규칙은 승객을 보호하기 위해 만들어진 것이 아닙니다.</p>' +
      '<p class="secret-text">규칙을 읽는 행위 자체가 열람 기록으로 남습니다.</p><hr>' +
      '<p class="secret-text"><strong>기록 대조:</strong> 제4조와 제7조는 동일한 문서 안에서 서로 다른 판본을 가리킵니다.</p>' +
      '<p class="secret-text">그리고 현재 표시되는 제5조는 인쇄본에 존재하지 않습니다.</p>' +
      '<p class="secret-text">당신이 발견한 것이 오류인지, 수정인지, 새로운 문서인지 판별할 수 없습니다.</p>' +
      '<p class="redacted">[최종 기록 일부 삭제]</p>';
    $('secret').classList.remove('hidden');
  }

  // 초기 화면
  renderRules(currentStage);
  if (returning) {
    addClue('returning');
    setTimeout(() => toast(state.stage >= 3 ? '이전 열람 기록을 반영했습니다.' : '다시 오셨군요.'), 900);
  }
  checkProgress();

  const timer = setInterval(() => {
    sessionSeconds += 1;
    timerEl.textContent = '문서 열람 시간 ' + formatTime(sessionSeconds);
    const thresholds = [30,65,105,155,220,300];
    thresholds.forEach((threshold, index) => { if (sessionSeconds === threshold) setStage(index + 1); });
    if (sessionSeconds % 10 === 0) persist();
  }, 1000);

  window.addEventListener('scroll', () => {
    if (window.scrollY < lastScrollY - 80) state.scrollBack += 1;
    lastScrollY = window.scrollY;
    state.maxScroll = Math.max(state.maxScroll, window.scrollY + window.innerHeight);
    checkProgress();
  }, {passive:true});

  $('searchBtn').addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', event => { if (event.key === 'Enter') doSearch(); });
  $('docInfo').addEventListener('click', () => {
    state.metadataClicks += 1; state.clicks += 1; addClue('metadata'); persist();
    if (state.metadataClicks >= 2 && currentStage >= 3) toast('문서번호는 수정할 수 없습니다.');
    else toast(returning ? '이 문서는 이전 열람 기록을 포함합니다.' : '정상 문서입니다.');
    checkProgress();
  });
  $('orgMark').addEventListener('click', () => { state.clicks += 1; addClue('organization'); persist(); toast(currentStage >= 4 ? '이 부서는 현재 운행 중인 열차에 존재하지 않습니다.' : '철도안전관리부 기록'); checkProgress(); });
  $('docNumber').addEventListener('click', () => { state.clicks += 1; addClue('document-number'); persist(); toast(currentStage >= 4 ? 'PS-0714: 열람 기록이 연결되었습니다.' : 'PS-0714'); checkProgress(); });
  $('historyBtn').addEventListener('click', showHistory);
  $('closeHistory').addEventListener('click', () => $('history').classList.add('hidden'));
  $('closeSecret').addEventListener('click', () => $('secret').classList.add('hidden'));
  $('secret').addEventListener('click', event => { if (event.target === $('secret')) $('secret').classList.add('hidden'); });
  $('history').addEventListener('click', event => { if (event.target === $('history')) $('history').classList.add('hidden'); });
  $('resetBtn').addEventListener('click', () => {
    if (!window.confirm('이 브라우저에 저장된 열람 기록을 초기화하시겠습니까?')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    location.reload();
  });
  window.addEventListener('beforeunload', () => { persist(); clearInterval(timer); });
})();
