// Pure helpers, kept separate so they can be tested in Node (see test.mjs).

export const today = (d = new Date()) => d.toLocaleDateString('sv'); // YYYY-MM-DD, local time

const yesterday = (now) => {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return today(d);
};

// Called when a daily set is finished.
export function nextStreak(s, now = new Date()) {
  const t = today(now);
  if (s.last === t) return s;
  return { last: t, count: s.last === yesterday(now) ? s.count + 1 : 1 };
}

// Streak shown on the home screen: broken if the last play was before yesterday.
export function displayStreak(s, now = new Date()) {
  return s.last === today(now) || s.last === yesterday(now) ? s.count : 0;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// New cards first, in file order, with one already-seen card mixed in for review
// once there are 5 to pick from; once everything is collected, a random review set.
export function pickDaily(cards, got, n = 5) {
  const fresh = cards.filter((c) => !got.includes(c.id));
  if (!fresh.length) return shuffle(cards).slice(0, n);
  const seen = cards.filter((c) => got.includes(c.id));
  if (seen.length < 5) return fresh.slice(0, n);
  return [...fresh.slice(0, n - 1), shuffle(seen)[0]];
}

// Old progress had one card list per audience; now there is one list and a level.
const OLD_AUD = { kids: 'L0', students: 'L3', adults: 'L5' };
export function migrate(p) {
  const out = { ...p };
  const old = Object.keys(out).filter((k) => k.startsWith('got:') && k !== 'got:all');
  if (old.length) out['got:all'] = [...new Set([...(out['got:all'] || []), ...[].concat(...old.map((k) => out[k]))])];
  old.forEach((k) => delete out[k]);
  if (out.aud) { if (out.lv == null) out.lv = OLD_AUD[out.aud]; delete out.aud; }
  return out;
}

// Shared by the browser and scripts/tts.mjs: "Check, please." -> "check-please.mp3"
export const audioFile = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.mp3';

// Every text that needs a pre-generated clip.
export const audioTexts = (cards) =>
  [].concat(...cards.map((c) => [c.word, ...(c.quiz.type === 'listen' ? c.quiz.options : []), ...englishRuns(c.fact)]));

// English runs inside mixed Chinese text, e.g. "说 Check, please!（英式说 the bill）".
const EN_RUN = /[A-Za-z][A-Za-z0-9'’ ,.!?-]*/g;
const trimRun = (m) => m.replace(/[\s,]+$/, '');
export const englishRuns = (s) => (s.match(EN_RUN) || []).map(trimRun);

// Wrap those runs in buttons that read them aloud.
export const linkEnglish = (s) =>
  s.replace(EN_RUN, (m) => {
    const t = trimRun(m);
    return `<button class="en" lang="en" data-say="${t.replace(/"/g, '&quot;')}">${t}</button>${m.slice(t.length)}`;
  });

// Combine local and cloud progress so neither side loses anything.
// Shape: { lv: 'L0', streak: {last, count}, 'got:all': ['k01', ...] }
export function mergeProgress(local, remote) {
  const out = { ...local, ...remote };
  for (const k of Object.keys(out)) {
    if (k.startsWith('got:')) out[k] = [...new Set([...(local[k] || []), ...(remote[k] || [])])];
  }
  const a = local.streak, b = remote.streak;
  if (a && b) out.streak = a.last > b.last || (a.last === b.last && a.count > b.count) ? a : b;
  return out;
}

// Parent check a 3-year-old can't pass by mashing buttons: two-digit sum, 4 choices.
export function mathGate(rand = Math.random) {
  const pick = () => 10 + Math.floor(rand() * 40);
  const a = pick(), b = pick(), answer = a + b;
  const opts = new Set([answer]);
  while (opts.size < 4) opts.add(answer + (rand() < 0.5 ? -1 : 1) * (1 + Math.floor(rand() * 10)));
  return { q: `${a} + ${b}`, answer, options: shuffle([...opts]) };
}

// After a wrong gate answer the gate stays shut for a while, so mashing OK can't win.
export function cooldown(ms, now = () => Date.now()) {
  let until = 0;
  return { ready: () => now() >= until, fail: () => { until = now() + ms; } };
}

// Spatial navigation for the TV remote: pick the closest box in the arrow's direction,
// weighting sideways drift x2 so a box straight ahead beats a nearer diagonal one.
export function nearest(from, rects, dir) {
  const cx = (r) => (r.left + r.right) / 2, cy = (r) => (r.top + r.bottom) / 2;
  let best = -1, bestScore = Infinity;
  rects.forEach((r, i) => {
    const dx = cx(r) - cx(from), dy = cy(r) - cy(from);
    const [main, side] = dir === 'left' || dir === 'right' ? [dx, dy] : [dy, dx];
    const forward = dir === 'right' || dir === 'down' ? main : -main;
    if (forward <= 1) return; // behind, level with, or the same box
    const score = forward + 2 * Math.abs(side);
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}
