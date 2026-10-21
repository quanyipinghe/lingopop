import { today, nextStreak, displayStreak, shuffle, pickDaily, audioFile, linkEnglish, mergeProgress } from './logic.js';

const AUDIENCES = {
  kids: { name: '小朋友', emoji: '🧒', desc: '动物、颜色、身边的小东西' },
  students: { name: '学生', emoji: '🎒', desc: '词根词缀，单词原来是拼出来的' },
  adults: { name: '大人', emoji: '💼', desc: '职场、旅行，告别中式英语' },
};

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

async function pull() {
  if (pw()) {
    try {
      const r = await api();
      if (r.status === 401) { forget(); return showAccount('用户名或密码不对'); }
      if (r.ok) {
        const merged = mergeProgress(snapshot(), await r.json());
        for (const [k, v] of Object.entries(merged)) localStorage.setItem('lp:' + k, JSON.stringify(v));
        push();
      }
    } catch { /* offline: keep local */ }
  }
  showHome();
}

// Save to the cloud, then wipe this browser, so the next person to log in here starts clean.
async function logout() {
  clearTimeout(pushTimer);
  const r = await api({ method: 'PUT', body: JSON.stringify(snapshot()) }).catch(() => null);
  if (!r?.ok) return alert('进度还没同步上去，联网后再退出');
  Object.keys(localStorage).filter((k) => k.startsWith('lp:')).forEach((k) => localStorage.removeItem(k));
  showHome();
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
  $('#back').onclick = showHome;
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
let aud, cards;

// Pre-generated Kokoro clip; browser voice only if the clip is missing.
const player = new Audio();
function speak(text) {
  player.pause();
  player.onerror = () => robotSpeak(text);
  player.src = 'audio/' + audioFile(text);
  player.play().catch(() => {}); // missing file is handled by onerror; autoplay blocks are fine to ignore
}

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
    <div class="emoji" aria-hidden="true">${c.emoji}</div>
    <h2 lang="en">${c.word} <button class="say" aria-label="朗读 ${c.word}">🔊</button></h2>
    <p class="zh">${c.zh}</p>
    <p class="fact"><b>原来如此：</b>${linkEnglish(c.fact)}</p>
  </article>`;

const bindSay = (c) => {
  $('.say').onclick = () => speak(c.word);
  main.querySelectorAll('.en').forEach((b) => { b.onclick = () => speak(b.dataset.say); });
};

function showPicker() {
  main.innerHTML = `
    <h2 class="center">你是哪一位？</h2>
    <div class="pick">${Object.entries(AUDIENCES).map(([k, a]) => `
      <button class="tile" data-aud="${k}">
        <span class="big" aria-hidden="true">${a.emoji}</span><b>${a.name}</b><small>${a.desc}</small>
      </button>`).join('')}
    </div>`;
  main.querySelectorAll('[data-aud]').forEach((b) => {
    b.onclick = () => { store.set('aud', b.dataset.aud); showHome(); };
  });
}

async function showHome() {
  aud = store.get('aud');
  if (!AUDIENCES[aud]) return showPicker();
  try {
    cards = await (await fetch(`data/${aud}.json`)).json();
  } catch {
    main.innerHTML = '<p class="center">内容加载失败，请刷新再试。</p>';
    return;
  }
  const got = store.get('got:' + aud, []);
  const s = store.get('streak', { last: '', count: 0 });
  const a = AUDIENCES[aud];
  main.innerHTML = `
    <section class="hello">
      <p>${a.emoji} ${a.name}模式 · <button class="link" id="switch">换一个</button>
      · <button class="link" id="sync">${pw() ? `☁️ ${localStorage.getItem('lp:user').replace(/</g, '&lt;')} · 退出` : '☁️ 登录 / 注册'}</button></p>
      <div class="stats">
        <div><b>${displayStreak(s)}</b>天连续打卡</div>
        <div><b>${got.length}/${cards.length}</b>已发现</div>
      </div>
      <button class="big-btn" id="go">${s.last === today() ? '再碰一组 ✨' : '开始今日一碰 🎈'}</button>
    </section>
    <h3>收集墙</h3>
    <div class="wall">${cards.map((c) => got.includes(c.id)
      ? `<button class="cell on" data-id="${c.id}" aria-label="${c.word}">${c.emoji}</button>`
      : '<span class="cell" aria-label="未发现">?</span>').join('')}
    </div>`;
  $('#switch').onclick = showPicker;
  $('#sync').onclick = () => (pw() ? logout() : showAccount());
  $('#go').onclick = () => play(pickDaily(cards, got));
  main.querySelectorAll('.cell.on').forEach((b) => {
    b.onclick = () => {
      const c = cards.find((x) => x.id === b.dataset.id);
      main.innerHTML = cardHTML(c) + '<button class="big-btn" id="back">← 回到收集墙</button>';
      bindSay(c);
      $('#back').onclick = showHome;
    };
  });
}

function play(list) {
  let i = 0;
  let newCount = 0;

  const step = () => {
    if (i >= list.length) return finish();
    const c = list[i];
    main.innerHTML = `<p class="progress">${i + 1} / ${list.length}</p>${cardHTML(c)}
      <button class="big-btn" id="quiz">考考我 →</button>`;
    bindSay(c);
    speak(c.word);
    $('#quiz').onclick = () => quiz(c, (ok, answer) => {
      const got = store.get('got:' + aud, []);
      if (!got.includes(c.id)) { got.push(c.id); store.set('got:' + aud, got); newCount++; }
      $('#fb').innerHTML = `
        <p class="${ok ? 'ok' : 'no'}">${ok ? '🎉 答对啦！' : `差一点！答案是 <b lang="en">${answer}</b>`}</p>
        <button class="big-btn" id="next">${i + 1 < list.length ? '下一张 →' : '完成 🎊'}</button>`;
      $('#next').onclick = () => { i++; step(); };
      $('#next').focus();
    });
  };

  const finish = () => {
    store.set('streak', nextStreak(store.get('streak', { last: '', count: 0 })));
    main.innerHTML = `
      <div class="card center">
        <div class="emoji">🎊</div>
        <h2>今日一碰完成！</h2>
        <p>${newCount ? `新点亮了 <b>${newCount}</b> 个发现` : '复习了一轮老朋友'}，明天见～</p>
      </div>
      <button class="big-btn" id="home">回到首页</button>`;
    $('#home').onclick = showHome;
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
        <button class="link" id="undo">⌫ 退一格</button>
      </div>
      <div id="fb"></div>`;
    const render = () => {
      $('.slots').textContent = word.split('').map((_, k) => typed[k]?.ch ?? '_').join(' ');
      main.querySelectorAll('.tile-l').forEach((b) => { b.disabled = typed.some((t) => t.k === +b.dataset.k); });
    };
    main.querySelectorAll('.tile-l').forEach((b) => {
      b.onclick = () => {
        typed.push({ ch: b.textContent, k: +b.dataset.k });
        render();
        if (typed.length === word.length) {
          main.querySelectorAll('.tiles button, #undo').forEach((x) => { x.disabled = true; });
          const ok = typed.map((t) => t.ch).join('') === word;
          if (ok) speak(word);
          done(ok, word);
        }
      };
    });
    $('#undo').onclick = () => { typed.pop(); render(); };
    render();
    return;
  }

  // choice / listen: options[0] is the correct one
  const answer = q.options[0];
  const listen = q.type === 'listen';
  main.innerHTML = `
    <div class="card">
      <p class="q">${listen ? '听一听，选出你听到的 <button class="say" aria-label="再听一遍">🔊</button>' : q.q}</p>
      <div class="opts">${shuffle(q.options).map((o) =>
        `<button class="opt" ${listen || /^[\x00-\x7F]+$/.test(o) ? 'lang="en"' : ''}>${o}</button>`).join('')}</div>
    </div>
    <div id="fb"></div>`;
  if (listen) { $('.say').onclick = () => speak(answer); speak(answer); }
  main.querySelectorAll('.opt').forEach((b) => {
    b.onclick = () => {
      main.querySelectorAll('.opt').forEach((x) => {
        x.disabled = true;
        if (x.textContent === answer) x.classList.add('right');
      });
      if (b.textContent !== answer) b.classList.add('wrong');
      done(b.textContent === answer, answer);
    };
  });
}

pull();
