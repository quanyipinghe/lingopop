import { today, nextStreak, displayStreak, shuffle, pickDaily, audioFile, linkEnglish, mergeProgress, migrate, nearest, mathGate } from './logic.js';

// Levels follow the Cambridge English path (CEFR); content lives in data/<id>.json.
const LEVELS = {
  L0: { name: '启蒙', emoji: '🐣', age: '3–4 岁', desc: '看图听音，认识身边的东西' },
  L1: { name: 'Starters', emoji: '🌱', age: '5–6 岁', desc: '剑桥少儿一级: 字母、拼读和第一句英语' },
  L2: { name: 'Movers', emoji: '🚲', age: '小学低年级', desc: '剑桥少儿二级: 学校、天气、日常动作' },
  L3: { name: 'Flyers', emoji: '🪁', age: '小学高年级', desc: '剑桥少儿三级: 单词背后的故事' },
  L4: { name: 'KET', emoji: '🗺️', age: '初一', desc: 'A2: 购物问路，说完整的句子' },
  L5: { name: 'PET', emoji: '🎒', age: '初中', desc: 'B1: 词根词缀与旅行场景' },
  L6: { name: 'FCE', emoji: '🎓', age: '高中', desc: 'B2: 习语和地道搭配' },
  L7: { name: 'CAE', emoji: '💼', age: '大学', desc: 'C1: 学术与职场英语' },
};
const LV_IDS = Object.keys(LEVELS);

const store = {
  get(k, d) {
    try { return JSON.parse(localStorage.getItem('lp:' + k)) ?? d; } catch { return d; }
  },
  set(k, v) { localStorage.setItem('lp:' + k, JSON.stringify(v)); push(); },
};

// Cloud sync (optional): localStorage stays the working copy, KV holds each account's copy.
// ponytail: credentials live in localStorage; switch to an HttpOnly cookie session if accounts ever hold anything sensitive.
const pw = () => localStorage.getItem('lp:pw');
const api = (opts = {}) => fetch('api/progress', {
  ...opts,
  headers: { 'x-user': encodeURIComponent(localStorage.getItem('lp:user') ?? ''), 'x-pw': encodeURIComponent(pw()) },
});
const forget = () => { localStorage.removeItem('lp:user'); localStorage.removeItem('lp:pw'); };

const snapshot = () => Object.fromEntries(Object.keys(localStorage)
  .filter((k) => k.startsWith('lp:') && k !== 'lp:pw' && k !== 'lp:user')
  .map((k) => [k.slice(3), store.get(k.slice(3))]));

let pushTimer;
function push() {
  if (!pw()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => api({ method: 'PUT', body: JSON.stringify(snapshot()) }).catch(() => {}), 2000);
}

// Replace this browser's progress with p, keeping the login.
function save(p) {
  Object.keys(snapshot()).forEach((k) => localStorage.removeItem('lp:' + k));
  for (const [k, v] of Object.entries(p)) localStorage.setItem('lp:' + k, JSON.stringify(v));
}

async function pull() {
  let p = snapshot();
  let synced = false;
  if (pw()) {
    try {
      const r = await api();
      if (r.status === 401) { forget(); return showAccount('用户名或密码不对'); }
      if (r.ok) { p = mergeProgress(p, await r.json()); synced = true; }
    } catch { /* offline: keep local */ }
  }
  save(migrate(p));
  if (synced) push();
  goHome();
}

// Save to the cloud, then wipe this browser, so the next person to log in here starts clean.
async function logout() {
  clearTimeout(pushTimer);
  const r = await api({ method: 'PUT', body: JSON.stringify(snapshot()) }).catch(() => null);
  if (!r?.ok) return alert('进度还没同步上去，联网后再退出');
  Object.keys(localStorage).filter((k) => k.startsWith('lp:')).forEach((k) => localStorage.removeItem(k));
  goHome();
}

async function showAccount(msg = '', signup = false) {
  main.innerHTML = `
    <form class="card account">
      <h2>${signup ? '创建账号' : '登录'}</h2>
      <p class="zh">登录后学习进度保存在云端，换设备也不丢</p>
      <label>用户名 <input name="user" required maxlength="64" autocomplete="username"></label>
      <label>密码 <input name="pw" type="password" required minlength="6" maxlength="128"
        autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
      ${signup ? '<label>再输一次密码 <input name="pw2" type="password" required minlength="6" autocomplete="new-password"></label>' : ''}
      <p class="no" role="alert">${msg}</p>
      <button class="big-btn">${signup ? '创建并登录' : '登录'}</button>
      <button type="button" class="link" id="mode">${signup ? '已有账号？去登录' : '还没有账号？创建一个'}</button>
      <button type="button" class="link" id="back">← 先不用了</button>
    </form>`;
  $('#mode').onclick = () => showAccount('', !signup);
  $('#back').onclick = goBack;
  focusFirst('input');
  $('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (signup) {
      if (f.pw !== f.pw2) return showAccount('两次密码不一样', true);
      const r = await fetch('api/account', { method: 'POST', body: JSON.stringify({ user: f.user, pw: f.pw }) }).catch(() => null);
      if (!r?.ok) return showAccount(r?.status === 409 ? '这个用户名已经有人用了' : '创建失败，请稍后再试', true);
    }
    localStorage.setItem('lp:user', f.user.trim());
    localStorage.setItem('lp:pw', f.pw);
    pull();
  };
}

const main = document.querySelector('main');
const $ = (sel) => main.querySelector(sel);

// TV remote: every re-render drops focus, so land it on the page's main button.
const focusFirst = (sel) => (main.querySelector(`${sel}:not(:disabled)`) || main.querySelector('button:not(:disabled)'))?.focus();
const focusLost = () => { const a = document.activeElement; return !a || a === document.body || a.disabled; };

// The remote's Back key = the on-screen back button. Each sub-page pushes one history
// entry plus the function that re-renders its parent (without pushing again).
const backs = [];
function forward(render, back) {
  backs.push(back);
  history.pushState({ d: backs.length }, '');
  render();
}
const goBack = () => (backs.length ? history.back() : showHome()); // no entry of ours (e.g. reload): just go home
const goHome = () => (backs.length ? history.go(-backs.length) : showHome());
addEventListener('popstate', (e) => {
  const d = e.state?.d ?? 0;
  let back = showHome;
  while (backs.length > d) back = backs.pop();
  d === 0 ? showHome() : back();
});

// Arrow keys move between buttons; we do it ourselves since not every TV WebView does.
const DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
document.addEventListener('keydown', (e) => {
  const dir = DIRS[e.key];
  if (!dir) return;
  const a = document.activeElement;
  if (a?.tagName === 'INPUT' && (dir === 'left' || dir === 'right')) return; // moving the text cursor
  const els = [...main.querySelectorAll('button:not(:disabled), summary, input')].filter((el) => el.offsetParent !== null);
  if (!els.length) return;
  const i = els.includes(a) ? nearest(a.getBoundingClientRect(), els.map((el) => el.getBoundingClientRect()), dir) : 0;
  if (i < 0) return; // nothing that way: let the page scroll
  e.preventDefault();
  els[i].focus();
  els[i].scrollIntoView({ block: 'nearest' });
});
let lv, data;
const cache = {};
const load = async (id) => (cache[id] ??= await (await fetch(`data/${id}.json`)).json());
const gotAll = () => store.get('got:all', []);

// Pre-generated Kokoro clip; browser voice only if the clip is missing.
const player = new Audio();
function speak(text) {
  player.pause();
  player.onerror = () => robotSpeak(text);
  player.src = 'audio/' + audioFile(text);
  player.play().catch(() => {}); // missing file is handled by onerror; autoplay blocks are fine to ignore
}

// Tiny synthesized cues so kids who can't read still know right from wrong. No audio files needed.
let actx;
function beep(kind) {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    const notes = { ok: [660, 990], no: [240, 190], pop: [880] }[kind];
    notes.forEach((f, k) => {
      const t = actx.currentTime + k * 0.12;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = kind === 'no' ? 'triangle' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(actx.destination);
      o.start(t);
      o.stop(t + 0.22);
    });
  } catch { /* no Web Audio: stay silent */ }
}

// Cards collected this session, so the wall can stamp them in once.
const fresh = new Set();

function robotSpeak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

const cardHTML = (c) => `
  <article class="card">
    <button class="emoji" aria-label="朗读 ${c.word}">${c.emoji}</button>
    <h2 lang="en">${c.word} <button class="say" aria-label="朗读 ${c.word}">🔊</button></h2>
    <p class="zh">${c.zh}</p>
    <p class="fact"><b>原来如此：</b>${linkEnglish(c.fact)}</p>
  </article>`;

const bindSay = (c) => {
  main.querySelectorAll('.card .say, .card .emoji').forEach((b) => { b.onclick = () => speak(c.word); });
  main.querySelectorAll('.en').forEach((b) => { b.onclick = () => speak(b.dataset.say); });
};

function showPicker() {
  main.innerHTML = `
    <h2 class="center">从哪一级开始？</h2>
    <p class="zh">按年龄选就好，以后随时能换</p>
    <div class="pick">${Object.entries(LEVELS).map(([k, a]) => `
      <button class="tile" data-lv="${k}">
        <span class="big" aria-hidden="true">${a.emoji}</span><b>${a.name} · ${a.age}</b><small>${a.desc}</small>
      </button>`).join('')}
    </div>`;
  main.querySelectorAll('[data-lv]').forEach((b) => {
    b.onclick = () => { store.set('lv', b.dataset.lv); showHome(); };
  });
  focusFirst('.tile');
}

async function showHome() {
  lv = store.get('lv');
  if (!LEVELS[lv]) return showPicker();
  try {
    data = await load(lv);
  } catch {
    main.innerHTML = '<p class="center">内容加载失败，请刷新再试。</p>';
    return;
  }
  const got = gotAll();
  const done = (list) => list.filter((c) => got.includes(c.id)).length;
  const s = store.get('streak', { last: '', count: 0 });
  const a = LEVELS[lv];
  const next = LV_IDS[LV_IDS.indexOf(lv) + 1];
  const ready = next && data.cards.length && done(data.cards) >= data.cards.length * 0.8;
  const streak = displayStreak(s);
  main.innerHTML = `
    <section class="hello">
      <p>${a.emoji} <b>${a.name}</b> · ${a.age}</p>
      <p class="zh">${a.desc}</p>
      <div class="stats">
        <div>${streak ? `<b>🔥 ${streak}</b>天连续打卡` : '<b>👋</b>今天来碰第一下吧'}</div>
        <div><b>${done(data.cards)}/${data.cards.length}</b>本级已发现</div>
      </div>
      ${ready ? `<button class="link up" id="up">🎉 这一级快学完啦，升到 ${LEVELS[next].emoji} ${LEVELS[next].name} →</button>` : ''}
      ${data.cards.length
        ? `<button class="big-btn" id="go">${s.last === today() ? '再碰一组 ✨' : '开始今日一碰 🎈'}</button>`
        : '<p class="center">这一级的内容还在准备中～</p>'}
    </section>
    ${data.topics.length ? '<h3>选个场景</h3>' : ''}
    <div class="topics">${data.topics.map((t) => {
      const list = data.cards.filter((c) => c.topic === t.id);
      return `<button class="topic" data-t="${t.id}"><span class="big" aria-hidden="true">${t.emoji}</span>
        <b>${t.name}</b><small>${t.kind === 'talk' ? '💬 对话 · ' : ''}${done(list)}/${list.length}</small></button>`;
    }).join('')}</div>
    <details class="parent">
      <summary>🔧 家长设置</summary>
      <p>换等级</p>
      <nav class="levels" aria-label="等级">${LV_IDS.map((k) => `<button class="chip${k === lv ? ' on' : ''}" data-lv="${k}"
        ${k === lv ? 'aria-current="true"' : ''}>${LEVELS[k].emoji} ${LEVELS[k].name}</button>`).join('')}</nav>
      <button class="link" id="sync">${pw() ? `☁️ ${localStorage.getItem('lp:user').replace(/</g, '&lt;')} · 退出` : '☁️ 登录 / 注册，换设备进度不丢'}</button>
    </details>`;
  main.querySelectorAll('.chip').forEach((b) => {
    b.onclick = () => { store.set('lv', b.dataset.lv); showHome(); };
  });
  $('#sync').onclick = () => (pw() ? logout() : forward(() => showAccount(), showHome));
  if (ready) $('#up').onclick = () => { store.set('lv', next); showHome(); };
  if (data.cards.length) $('#go').onclick = () => forward(() => play(pickDaily(data.cards, got), goBack, data.cards), showHome);
  main.querySelectorAll('.topic').forEach((b) => {
    b.onclick = () => forward(() => showTopic(data.topics.find((t) => t.id === b.dataset.t)), showHome);
  });
  gateParent($('details.parent'));
  focusFirst(data.cards.length ? '#go' : '.topic');
}

// Parent settings open only after a sum a 3-year-old can't do. The quiz goes after the
// <details>, since a closed one hides its content.
function gateParent(parent) {
  const summary = parent.querySelector('summary');
  summary.onclick = (e) => {
    if (parent.open) return; // closing needs no check
    e.preventDefault();
    if ($('.gate')) { $('.gate').remove(); return summary.focus(); }
    const g = mathGate();
    parent.insertAdjacentHTML('afterend', `<div class="gate"><p>家长验证: ${g.q} = ?</p>
      <div class="opts">${g.options.map((n) => `<button class="opt">${n}</button>`).join('')}</div></div>`);
    main.querySelectorAll('.gate button').forEach((b) => {
      b.onclick = () => {
        $('.gate').remove();
        if (+b.textContent !== g.answer) return summary.focus();
        parent.open = true;
        focusFirst('.levels .chip.on');
      };
    });
    focusFirst('.gate button');
  };
}

function showTopic(t) {
  const list = data.cards.filter((c) => c.topic === t.id);
  const got = gotAll();
  const back = () => showTopic(t);
  main.innerHTML = `
    <h2 class="center">${t.emoji} ${t.name}</h2>
    <button class="big-btn" id="go">碰一组 ✨</button>
    <h3>贴纸墙 ${list.filter((c) => got.includes(c.id)).length}/${list.length}</h3>
    <div class="wall">${list.map((c) => got.includes(c.id)
      ? `<button class="cell on${fresh.has(c.id) ? ' new' : ''}" data-id="${c.id}" aria-label="${c.word}">${c.emoji}</button>`
      : '<span class="cell" aria-label="未发现">?</span>').join('')}
    </div>
    <button class="big-btn" id="home">← 回到首页</button>`;
  list.forEach((c) => fresh.delete(c.id)); // stamp each new sticker only once
  $('#go').onclick = () => forward(() => play(pickDaily(list, got), goBack, list), back);
  $('#home').onclick = goBack;
  main.querySelectorAll('.cell.on').forEach((b) => {
    b.onclick = () => forward(() => {
      const c = list.find((x) => x.id === b.dataset.id);
      main.innerHTML = cardHTML(c) + '<button class="big-btn" id="back">← 回到贴纸墙</button>';
      bindSay(c);
      speak(c.word);
      $('#back').onclick = goBack;
      focusFirst('#back');
    }, back);
  });
  focusFirst('#go');
}

// pool: the cards this set was drawn from (level or topic), for the progress bar at the end.
function play(list, back, pool) {
  let i = 0;
  const won = [];

  const step = () => {
    if (i >= list.length) return finish();
    const c = list[i];
    const dots = list.map((_, k) => `<span class="${k < i ? 'done' : k === i ? 'now' : ''}"></span>`).join('');
    main.innerHTML = `<p class="dots" role="img" aria-label="第 ${i + 1} 张, 共 ${list.length} 张">${dots}</p>${cardHTML(c)}
      <button class="big-btn" id="quiz">考考我 →</button>`;
    bindSay(c);
    speak(c.word);
    focusFirst('#quiz');
    $('#quiz').onclick = () => quiz(c, (ok, answer) => {
      beep(ok ? 'ok' : 'no');
      if (ok) setTimeout(() => speak(c.word), 350); // ding first, then hear the word once more
      const got = gotAll();
      if (!got.includes(c.id)) { got.push(c.id); store.set('got:all', got); won.push(c); fresh.add(c.id); }
      $('#fb').innerHTML = `
        <p class="${ok ? 'ok' : 'no'}">${ok ? '🎉 答对啦！' : `差一点！答案是 <b lang="en">${answer}</b>`}</p>
        <button class="big-btn" id="next">${i + 1 < list.length ? '下一张 →' : '完成 🎊'}</button>`;
      $('#next').onclick = () => { i++; step(); };
      $('#next').focus();
    });
  };

  const finish = () => {
    store.set('streak', nextStreak(store.get('streak', { last: '', count: 0 })));
    const got = gotAll();
    const have = pool.filter((c) => got.includes(c.id)).length;
    main.innerHTML = `
      <div class="card center">
        <h2>今日一碰完成！</h2>
        ${won.length
          ? `<div class="stickers">${won.map((c, k) => `<span style="--k:${k}">${c.emoji}</span>`).join('')}</div>
             <p>新集到 <b>${won.length}</b> 张贴纸，明天见～</p>`
          : '<div class="stickers"><span>🎊</span></div><p>复习了一轮老朋友，明天见～</p>'}
        <div class="bar" role="img" aria-label="已收集 ${have}/${pool.length}"><i style="width:${(100 * have) / pool.length}%"></i></div>
        <small>${have} / ${pool.length}</small>
      </div>
      <button class="big-btn" id="home">返回</button>`;
    won.forEach((_, k) => setTimeout(() => beep('pop'), 250 + k * 180)); // in step with the stamp animation
    $('#home').onclick = back;
    focusFirst('#home');
  };

  step();
}

function quiz(c, done) {
  const q = c.quiz;

  if (q.type === 'spell') {
    const word = c.word;
    let typed = [];
    main.innerHTML = `
      <div class="card">
        <p class="q">把字母拼回 <b>${c.zh}</b> ${c.emoji}</p>
        <p class="slots" lang="en" aria-live="polite"></p>
        <div class="tiles">${shuffle([...word].map((ch, k) => ({ ch, k })))
          .map((t) => `<button class="tile-l" data-k="${t.k}">${t.ch}</button>`).join('')}</div>
        <button class="tile-l undo" id="undo" aria-label="退一格">⌫</button>
      </div>
      <div id="fb"></div>`;
    let tries = 0;
    const slots = $('.slots');
    const render = () => {
      slots.innerHTML = [...word].map((_, k) => `<span>${typed[k]?.ch ?? ''}</span>`).join('');
      main.querySelectorAll('.tile-l[data-k]').forEach((b) => { b.disabled = typed.some((t) => t.k === +b.dataset.k); });
      $('#undo').disabled = !typed.length;
      if (focusLost()) (main.querySelector('.tile-l[data-k]:not(:disabled)') || $('#undo')).focus();
    };
    main.querySelectorAll('.tile-l[data-k]').forEach((b) => {
      b.onclick = () => {
        typed.push({ ch: b.textContent, k: +b.dataset.k });
        render();
        if (typed.length === word.length) {
          main.querySelectorAll('.tile-l').forEach((x) => { x.disabled = true; });
          const ok = typed.map((t) => t.ch).join('') === word;
          if (!ok && ++tries < 2) { // first miss: shake, clear, try again
            beep('no');
            slots.classList.add('miss');
            setTimeout(() => { slots.classList.remove('miss'); typed = []; render(); }, 700);
            return;
          }
          done(ok, word);
        }
      };
    });
    $('#undo').onclick = () => { typed.pop(); render(); };
    render();
    focusFirst('.tile-l[data-k]');
    return;
  }

  // choice / listen / picture: options[0] is the correct one
  const answer = q.options[0];
  const listen = q.type === 'listen';
  const pic = q.type === 'picture'; // hear the word, tap the emoji: works before kids can read
  const sayText = pic ? c.word : listen ? answer : null;
  const ask = '<button class="say" aria-label="再听一遍">🔊</button>';
  main.innerHTML = `
    <div class="card">
      <p class="q">${pic ? `听一听，点出对的图 ${ask}` : listen ? `听一听，选出你听到的 ${ask}` : q.q}</p>
      <div class="opts${pic ? ' pics' : ''}">${shuffle(q.options).map((o) =>
        `<button class="opt" ${listen || (!pic && /^[\x00-\x7F]+$/.test(o)) ? 'lang="en"' : ''}>${o}</button>`).join('')}</div>
    </div>
    <div id="fb"></div>`;
  if (sayText) { $('.say').onclick = () => speak(sayText); speak(sayText); }
  let tries = 0;
  main.querySelectorAll('.opt').forEach((b) => {
    b.onclick = () => {
      if (b.textContent !== answer && ++tries < 2) { // first miss: grey it out, let them try again
        b.disabled = true;
        b.classList.add('tried');
        focusFirst('.opt');
        beep('no');
        return;
      }
      main.querySelectorAll('.opt').forEach((x) => {
        x.disabled = true;
        if (x.textContent === answer) x.classList.add('right');
      });
      if (b.textContent !== answer) b.classList.add('wrong');
      done(b.textContent === answer, pic ? `${answer} ${c.word}` : answer);
    };
  });
  focusFirst('.opt');
}

pull();
