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

// New cards first, in file order; once everything is collected, a random review set.
export function pickDaily(cards, collected, n = 5) {
  const fresh = cards.filter((c) => !collected.includes(c.id));
  return fresh.length ? fresh.slice(0, n) : shuffle(cards).slice(0, n);
}

// Shared by the browser and scripts/tts.mjs: "Check, please." -> "check-please.mp3"
export const audioFile = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.mp3';

// Every text that needs a pre-generated clip.
export const audioTexts = (cards) =>
  cards.flatMap((c) => [c.word, ...(c.quiz.type === 'listen' ? c.quiz.options : []), ...englishRuns(c.fact)]);

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
// Shape: { aud: 'kids', streak: {last, count}, 'got:kids': ['k1', ...], ... }
export function mergeProgress(local, remote) {
  const out = { ...local, ...remote };
  for (const k of Object.keys(out)) {
    if (k.startsWith('got:')) out[k] = [...new Set([...(local[k] ?? []), ...(remote[k] ?? [])])];
  }
  const a = local.streak, b = remote.streak;
  if (a && b) out.streak = a.last > b.last || (a.last === b.last && a.count > b.count) ? a : b;
  return out;
}
