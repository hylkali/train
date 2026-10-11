(() => {
  'use strict';

  const STORAGE_KEY = 'trainManualState_v6';
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
    unlocked:false, ending:false, clueFlags:[], endingType:null,
    bottomOverscrollCount:0, maintenanceRevealed:false
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
      merged.bottomOverscrollCount = Number(merged.bottomOverscrollCount) || 0;
      merged.maintenanceRevealed = Boolean(merged.maintenanceRevealed);
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
    // 매 단계는 새 조항을 무작정 늘리지 않고 기존 조항을 수정합니다.
    const rules = BASE_RULES.map(rule => Object.assign({}, rule));
    if (stage >= 1) {
      rules[6].note = '정정: 열차가 보낸 메시지는 받으시면 안 됩니다. 이 열차에는 메시지를 보낼 만한 수단이 없습니다.';
    }
    if (stage >= 2) {
      rules[3].text = '기차가 멈췄을 때에는 절대 그 어떤 문도 열어서는 안 됩니다. 이 기차는 중간에 멈추지 않고 종착역까지 가는 기차입니다.\n\n[추가 정정] 문이 이미 열려 있다면 닫지 마십시오.';
      rules[10].note = '※ 이전 판본에는 이 항목의 존재 여부가 기록되어 있지 않습니다.';
    }
    if (stage >= 3) {
      // 기존 제5조(r5)를 제거하고, 같은 번호를 부정하는 항목으로 교체합니다.
      const oldFifth = rules.findIndex(rule => rule.id === 'r5');
      if (oldFifth !== -1) rules.splice(oldFifth, 1);
      rules.splice(4, 0, {
        id:'ghost5', number:'5',
        text:'제5조는 존재하지 않습니다. 제5조를 읽었다고 보고하지 마십시오.',
        note:'※ 본 항목은 제5조가 삭제된 이후에 등록되었습니다.'
      });
      rules[6].note = '정정: 열차가 보낸 메시지는 받으시면 안 됩니다. 이 열차에는 메시지를 보낼 만한 수단이 없습니다.\n[이전 판본과 불일치]';
      rules[8].note = '문서 기록: 살아있는 것들은 이 기차에서 4번 이상 노크할 수 없습니다.';
    }
    if (stage >= 4) {
      rules[0].text = '티켓이 없는 승객과는 대화하지 마십시오.\n\n 티켓을 함부로 꺼내지도 마십시오.';
      rules[0].note = '※ 티켓을 함부로 보여주어서도 안됩니다..';
      rules[10].note = '열람자 기록: 이 항목을 검색한 기록이 있습니다. 검색 기록은 열람자의 기억과 일치하지 않을 수 있습니다.';
    }
    if (stage >= 5) {
      rules[3].note = '문서 주석: 열차가 멈추었다는 기록과, 열차가 멈추지 않는다는 기록이 동일한 판본에 보존되어 있습니다.';
      rules[10].text = '저희 열차에는 흡연칸이 없습니다. 이 칸이 보여도 절대 들어가지 마세요.\n\n[열람자 기록] 귀하는 이 문장을 이전에 읽었습니다.';
    }
    if (stage >= 6) {
      rules[10].text = '저희 열차에는 흡연칸이 없습니다. 이 칸이 보여도 절대 들어가지 마세요.\n\n문서 열람을 종료하기 전에 제4조와 제7조를 대조하십시오.';
      rules[10].note = '최종 기록: 인쇄본에는 이 문장이 없습니다. 화면을 닫아도 열람 기록은 삭제되지 않습니다.';
    }
    return rules;
  }

  // 검색으로 발견할 수 있는 별도 문서들. 검색 결과에서 실제 내용을 열람할 수 있습니다.
  const ARCHIVE_DOCUMENTS = [
    {
      id:'telephone-rules', title:'전화기 사용 수칙 / 배포 경로 미상',
      terms:['312493214378'],
      content:[
        '문서번호: TEL-00 / 작성자 및 배포 경로 확인 불가',
        '1. 전화기로 전화가 오면 응답하십시오. 응답하지 않은 경우, 모든 감각을 완벽하게 차단하십시오. 감각이 남아 있다면 그들이 당신을 찾을 수 있습니다.',
        '2. 전화기에서 지시하는 내용은 어떻게든 이행되어야 합니다.',
        '3. 제2항과 열차의 규칙이 충돌한다면, 전화기의 지시를 이행해서는 안 됩니다.',
        '4. 전화기에서 여자의 목소리가 나온다면, 우선 “그렇게 했습니다”라고 대답한 후 모든 지시를 거꾸로 이행하십시오.',
        '5. 전화기에서 남자의 목소리가 나온다면, 우선 “알겠습니다”라고 대답한 후 모든 지시를 똑바로 이행하십시오.',
        '6. 아는 이의 목소리로 당장 객실에서 나오라는 지시가 들린다면, 모든 문과 사방의 구멍을 막고 절대로 밖으로 나가지 마십시오.',
        '7. 누구의 것인지 알 수 없는 목소리가 나온다면, 신원을 밝히지 말고 전화기를 내려놓은 뒤 객실에서 나오십시오.',
        '※ 제6항과 제7항을 동시에 적용해야 하는 경우, 발신자의 신원을 확인하지 마십시오.',
        '※ 이 문서에는 발신자를 확인할 수 있는 항목이 없습니다.'
      ]
    },
    {
      id:'crew-rules', title:'승무원 휴게실 출입 수칙 / 원본 여부 미상',
      terms:['312493214378'],
      content:[
        '문서번호: CR-02 / 적용 공간: 승무원 휴게실',
        '1. 누군가 두 번 노크한다면 반드시 문을 열어주십시오.',
        '   1-1. 문밖에 아무도 없다면 문을 잠시 열어두고 피얼룩이 나타날 때까지 기다리십시오. 피얼룩이 사라지기 시작하면 테이블 위의 모래시계를 뒤집으십시오. 모래시계의 모래가 모두 떨어지면 문을 닫으십시오.',
        '   1-2. 문을 열었을 때 괴물 또는 괴이한 형상이 보이더라도 놀라지 마십시오. 이곳에서 환각을 보는 것은 정상입니다. 곰팡이가 눈을 좀먹고 있을 뿐입니다. 가장 가까운 세면대에서 눈을 씻으십시오.',
        '   1-3. 세면대로 가서는 안 됩니다. 눈을 씻으려면 다른 방법을 사용하십시오.',
        '2. 누군가 두 번 노크하며 승무원 휴게실의 청소가 필요하다고 말한다면, 인간 또는 인간과 유사한 존재는 즉시 숨을 참고 냉장고 안으로 들어가십시오. 그들은 숨과 체온으로 인간을 구별합니다.',
        '3. 절대로 당신들의 이름을 그가 알게 해서는 안 됩니다.',
        '4. 누군가 세 번 노크한다면, [이하 기록 손상]',
        '5. 네 번 이상 노크하는 존재를 들이지 마십시오. 이 기차에서 살아 있는 것들은 네 번 이상 노크하지 못합니다. 객실 안의 모든 입구와 구멍을 막으십시오.',
        '※ 제1항은 제4항 및 제5항과 대조하지 마십시오.',
        '※ 이 문서를 읽는 동안 들린 노크는 열람 기록에 포함되지 않습니다.'
      ]
    },
    {
      id:'deleted-rule', title:'제5조 삭제·대조 기록 / 문서관리실',
      terms:['312493214378'],
      content:[
        '대조 대상: PS-0714 판본 1.0 / 판본 1.3',
        '판본 1.0: 객실 탐험 중 동일한 객실이 세 번 나타날 경우 취해야 할 행동을 규정함.',
        '판본 1.3: 제5조는 존재하지 않는다고 규정함.',
        '삭제 처리자: 공란. 승인자: 공란. 삭제 일시: 삭제된 날짜보다 이전.',
        '주의: 이름 없는 자에게서, 또는 이름을 빼앗긴 자에게서 이 문서를 받았다면 믿지 마십시오.'
      ]
    },
    {
      id:'arrival-notice', title:'종착역 안내문 / 배포 중지본',
      terms:['312493214378'],
      content:[
        '승객 여러분께 안내드립니다.',
        '본 열차는 종착역까지 운행하며 중간역에는 정차하지 않습니다.',
        '정차 기록: 04:12 / 장소 미기재. 문 개폐 기록: 있음. 승객 하차 기록: ???명.',
        '정차 기록: 없음. 장소 미기재. 문 개폐 기록: ??회. 승객 하차 기록: x명.',
        '※ 서로 다른 두 기록은 동일한 운행 번호에 속합니다. 어느 쪽도 폐기하지 마십시오.'
      ]
    },
    {
      id:'message-correction', title:'통신 장애 보고서 / 자동 수신',
      terms:['312493214378'],
      content:[
        '장애 유형: 외부 통신망 연결 불가',
        '발신 장치: 설치 기록 없음',
        '접수 내용: 승객 단말기로 메시지가 전달됨.',
        '처리 결과: 메시지는 열차에서 발신되지 않았음. 다만 발신 시각은 열차 내부 시계와 일치함.',
        '정정: 본 보고서는 자동 수신되었으며, 수신을 승인한 담당자는 없습니다.',
        '첨부 메시지: “제7조를 다시 읽으십시오.”'
      ]
    },
    {
      id:'reader-copy', title:'열람자별 문서 사본 / 생성 시각 미상',
      terms:['312493214378'],
      content:[
        '이 사본은 모든 열람자에게 동일하게 표시되지 않을 수 있습니다.',
        '기록 A: 열람자가 제7조를 읽은 후 검색창에 “승무원”을 입력함.',
        '기록 B: 열람자가 검색창에 “승무원”을 입력한 후 제7조를 읽음.',
        '두 기록의 순서는 확인할 수 없습니다. 둘 다 현재 열람 기록으로 저장되어 있습니다.',
        '이 문서의 사본을 인쇄한 사람은 없습니다. 보관함에는 인쇄본 한 부가 있습니다.'
      ]
    }
    ,
    {
      id:'ticket-inspector-rules', title:'검표원 규칙 / 열람 기록에서만 확인 가능',
      terms:['검표원','검표','ticket inspector'],
      content:[
        '문서번호: TI-05 / 배포 경로 확인 불가',
        '1. 표에 적힌 이름과 자신이 알고 있는 이름이 다르다면, 자신의 이름을 말하지 마십시오.',
        '2. 검표원이 표를 요구하면 꼭 표를 보여주십시오.',
        '3. 만약 표가 없다면, 규칙을 굳이 따를 필요 없습니다. 자유롭게 행동하십시오.',
        '4. 이 규칙에는 3조가 없습니다.',
        '5. 검표원은 거짓말을 하지 않습니다.'
      ]
    }
  ];

  // 페이지 맨 아래에서 더 스크롤하려는 행동을 5회 반복하면 나타나는 별도 정비 문서.
  const MAINTENANCE_RULES = [
    '1. 정비 방송이 나오면 움직이지 마십시오.',
    '2. 정비 중에는 객실 내 어떤 종류의 문도 개방해서는 안 됩니다.',
    '3. 정비 중 발견된 물건을 만지지 마십시오.',
    '4. 정비 대상은 <정비 대상표>를 확인하시길 바랍니다. 이곳에 기재된 모든 것을 정비기관은 주어진 정비시간에 무조건 정비해야만 합니다.',
    '5. 정비 대상표에는 정비 대상을 기재해 두십시오.'
  ];

  function addMaintenanceDocument() {
    if ($('maintenanceReveal')) return $('maintenanceReveal');
    const style = document.createElement('style');
    style.textContent = `
      #maintenanceReveal { box-sizing:border-box; max-height:0; overflow:hidden; opacity:0; padding:0 24px; margin:0 auto; width:min(900px, calc(100% - 32px)); border:1px solid transparent; background:#f4f0e7; color:#25231f; transition:max-height 1.5s ease, opacity 1s ease, padding .8s ease, margin .8s ease, border-color 1s ease; scroll-margin-top:24px; font-family:inherit; }
      #maintenanceReveal.revealed { max-height:1800px; opacity:1; padding:28px 24px; margin:48px auto 80px; border-color:#8d8578; }
      #maintenanceReveal .maintenance-kicker { font-size:.78rem; letter-spacing:.12em; color:#71695e; text-transform:uppercase; }
      #maintenanceReveal h2 { margin:10px 0 8px; font-size:1.35rem; font-weight:600; }
      #maintenanceReveal .maintenance-warning { margin:0 0 22px; font-size:.9rem; color:#625b52; }
      #maintenanceReveal .maintenance-rule { border-top:1px solid #d2cabb; padding:14px 0; line-height:1.8; white-space:pre-line; }
      #maintenanceReveal .maintenance-stamp { margin-top:20px; padding-top:12px; border-top:1px dashed #a79e90; font-size:.8rem; color:#756d61; }
    `;
    document.head.appendChild(style);
    const section = document.createElement('section');
    section.id = 'maintenanceReveal';
    section.setAttribute('aria-hidden', state.maintenanceRevealed ? 'false' : 'true');
    section.innerHTML = '<div class="maintenance-kicker">철도안전관리부 · 별도 업무 문서</div>' +
      '<h2>정비기관 규칙</h2>' +
      '<p class="maintenance-warning">열람 위치: 일반 매뉴얼 하단 / 문서 등록 여부 확인 불가</p>' +
      MAINTENANCE_RULES.map(rule => '<div class="maintenance-rule">' + escapeHTML(rule) + '</div>').join('') +
      '<div class="maintenance-stamp">문서 상태: 등록 기록 없음 · 본 문서의 열람은 정비 요청으로 간주되지 않습니다.</div>';
    document.body.appendChild(section);
    if (state.maintenanceRevealed) section.classList.add('revealed');
    return section;
  }

  function revealMaintenanceDocument() {
    if (state.maintenanceRevealed) return;
    state.maintenanceRevealed = true;
    addEvent('페이지 하단에서 정비기관 규칙이 발견되었습니다.');
    addClue('maintenance-document');
    const section = addMaintenanceDocument();
    section.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      section.classList.add('revealed');
      toast('문서 하단에 등록되지 않은 정비기관 규칙이 추가되었습니다.');
      setTimeout(() => section.scrollIntoView({behavior:'smooth', block:'start'}), 250);
    });
    persist();
  }

  function openArchiveDocument(doc) {
    $('secretTitle').textContent = doc.title;
    const wrap = document.createElement('div');
    doc.content.forEach(line => {
      const p = document.createElement('p');
      p.className = 'secret-text';
      p.textContent = line;
      wrap.appendChild(p);
    });
    const content = $('secretContent');
    content.replaceChildren(wrap);
    $('secret').classList.remove('hidden');
    state.clicks += 1;
    addClue('archive:' + doc.id);
    addEvent('별도 문서 열람: ' + doc.title);
    persist();
    checkProgress();
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
    if (stage >= 4) $('readingNote').textContent = stage >= 5
      ? '※ 화면을 보고 있는 동안, 화면도 열람자를 확인합니다.'
      : '※ 동일한 문서가 모든 열람자에게 동일하게 표시된다는 보장은 없습니다.';
    readerStateEl.textContent = stage >= 4 ? '열람 기록 확인됨' : '정상';
    document.body.classList.toggle('unstable', stage >= 4);
    if (localRender !== renderVersion) return;
    document.querySelectorAll('.rule').forEach(article => {
      article.addEventListener('click', () => {
        const id = article.dataset.id;
        if (!id) return;
        state.clicks += 1;
        if (!state.clicked.includes(id)) state.clicked.push(id);
        if (id === 'ghost5') { addClue('ghost-rule'); toast('그들이 보고 있습니다. 화면을 끄지 마십시오. 화면이 먼저 꺼질 수 있습니다.'); }
        if (id === 'reader-record') { addClue('reader-record'); toast('네 번째 노크는 승객의 것이 아닙니다. 문을 열지 마십시오.'); }
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

  let resetting = false;
  let blackoutTimer = null;
  function triggerBlackout() {
    const overlay = $('blackout');
    if (!overlay) return;
    clearTimeout(blackoutTimer);
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('blacked-out');
    blackoutTimer = setTimeout(() => {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('blacked-out');
      toast('열람을 계속하십시오. 방금의 화면 변화는 기록되지 않았습니다.');
    }, 3000);
  }

  function setStage(stage, reason) {
    stage = Math.max(0, Math.min(MAX_STAGE, Number(stage) || 0));
    if (stage <= currentStage) return;
    currentStage = stage;
    renderRules(stage);
    const messages = {
      1:'열람자가 살아있는 자인지 확인 중입니다...',
      2:'환각을 봐도 두려워하지 마십시오. 이곳에서 그런 것은 아주 평범한 일입니다.',
      3:'존재하지 않는 항목에 대해서 발설하는 것을 주의하십시오.',
      4:'티켓이 없다고 걱정하지 마십시오. 이제 당신은 규칙이 필요없습니다.',
      5:'그들이 보고 있습니다.',
      6:'아무것도 바뀌지 않았습니다. 처음부터 이 문서에는 제5조가 없었습니다.'
    };
    addEvent(messages[stage] || '문서가 수정되었습니다.');
    if (reason) addEvent(reason);
    toast(messages[stage]);
    if (stage === 5) triggerBlackout();
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

    // 검색어와 관련된 실제 보관 문서를 결과에 추가합니다.
    const archiveMatches = ARCHIVE_DOCUMENTS.filter(doc =>
      doc.terms.some(term => lower.includes(term.toLowerCase())) ||
      doc.title.toLowerCase().includes(lower)
    );
    count.textContent = '검색 결과 ' + (matches.length + archiveMatches.length) + '건';
    archiveMatches.forEach(doc => {
      const item = document.createElement('div');
      item.className = 'result archive-result';
      const title = document.createElement('strong');
      title.textContent = '[별도 문서] ' + doc.title;
      const description = document.createElement('p');
      description.textContent = '일반 매뉴얼 검색 색인에는 등록되어 있지 않은 문서입니다.';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '문서 열람';
      button.addEventListener('click', () => openArchiveDocument(doc));
      item.append(title, description, button);
      searchResults.appendChild(item);
    });
    if (archiveMatches.length === 0 && matches.length === 0) {
      const none = document.createElement('div');
      none.className = 'result';
      none.textContent = currentStage >= 3 ? '검색 결과가 없습니다. 단, 검색 결과가 없다는 사실은 해당 문서가 존재하지 않는다는 증거가 아닙니다.' : '검색 결과가 없습니다.';
      searchResults.appendChild(none);
    }
    if (lower === '예외' && currentStage >= 4) { addClue('exception-search'); toast('검색어가 문서의 일부 기록과 일치합니다.'); }
    if (lower === '제4조' && currentStage >= 5) { addClue('rule4-search'); toast('제4조의 수정 기록이 존재합니다.'); }
    if (lower === '제7조' && currentStage >= 5) { addClue('rule7-search'); toast('제7조에는 정정 기록이 존재합니다.'); }
    checkProgress();
  }

  function showHistory() {
    const historyIds = [...new Set([...visitedRules].map(id =>
      (id === 'r5' || id === 'ghost5') ? 'article5' : id
    ))].sort();
    const fifthReads = (Number(state.ruleReads.r5) || 0) + (Number(state.ruleReads.ghost5) || 0);
    const reads = historyIds.map(id => {
      if (id === 'article5') {
        const button = fifthReads >= 3
          ? '<br><button type="button" data-open-archive="deleted-rule">삭제된 규칙 열람</button>'
          : '';
        return '<li>제5조 열람' + button + '</li>';
      }
      return '<li>' + escapeHTML(id) + ' 열람</li>';
    }).join('') || '<li>기록 없음</li>';
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
  addMaintenanceDocument();
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

  // 페이지 끝에 도달한 뒤에도 아래로 더 내리려는 행동을 5회 세어 정비기관 규칙을 공개합니다.
  let lastBottomAttemptAt = 0;
  window.addEventListener('wheel', event => {
    if (state.maintenanceRevealed || event.deltaY <= 0) return;
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 6;
    if (!atBottom) return;
    const now = Date.now();
    // 트랙패드의 한 번의 긴 제스처에서 발생하는 연속 이벤트는 한 번으로 취급합니다.
    if (now - lastBottomAttemptAt < 700) return;
    lastBottomAttemptAt = now;
    state.bottomOverscrollCount = (Number(state.bottomOverscrollCount) || 0) + 1;
    persist();
    if (state.bottomOverscrollCount >= 5) revealMaintenanceDocument();
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
  $('historyContent').addEventListener('click', event => {
    const button = event.target.closest('[data-open-archive]');
    if (!button) return;
    const doc = ARCHIVE_DOCUMENTS.find(item => item.id === button.dataset.openArchive);
    if (doc) openArchiveDocument(doc);
  });
  $('closeHistory').addEventListener('click', () => $('history').classList.add('hidden'));
  $('closeSecret').addEventListener('click', () => $('secret').classList.add('hidden'));
  $('secret').addEventListener('click', event => { if (event.target === $('secret')) $('secret').classList.add('hidden'); });
  $('history').addEventListener('click', event => { if (event.target === $('history')) $('history').classList.add('hidden'); });
  $('resetBtn').addEventListener('click', () => {
    if (!window.confirm('이 브라우저에 저장된 열람 기록을 초기화하시겠습니까?')) return;
    // beforeunload에서 삭제한 기록을 다시 저장하지 않도록 먼저 초기화 상태를 표시합니다.
    resetting = true;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    location.reload();
  });
  window.addEventListener('beforeunload', () => {
    if (!resetting) persist();
    clearInterval(timer);
  });
})();
