// Run: node test.mjs
import assert from 'node:assert/strict';
import { nextStreak, displayStreak, pickDaily, today, audioFile, audioTexts, linkEnglish, mergeProgress, migrate } from './public/logic.js';
import { readdirSync } from 'node:fs';
import { readFileSync, existsSync } from 'node:fs';

assert.equal(audioFile('Check, please.'), 'check-please.mp3');
assert.equal(audioFile("It's on me."), 'it-s-on-me.mp3');
assert.equal(audioFile('Sunday'), 'sunday.mp3');

const d = (s) => new Date(s + 'T12:00:00');

assert.deepEqual(nextStreak({ last: '', count: 0 }, d('2026-10-21')), { last: '2026-10-21', count: 1 });
assert.deepEqual(nextStreak({ last: '2026-10-20', count: 3 }, d('2026-10-21')), { last: '2026-10-21', count: 4 });
assert.deepEqual(nextStreak({ last: '2026-10-21', count: 4 }, d('2026-10-21')), { last: '2026-10-21', count: 4 });
assert.deepEqual(nextStreak({ last: '2026-10-18', count: 9 }, d('2026-10-21')), { last: '2026-10-21', count: 1 });
assert.deepEqual(nextStreak({ last: '2026-10-31', count: 2 }, d('2026-11-01')), { last: '2026-11-01', count: 3 });
assert.equal(displayStreak({ last: '2026-10-20', count: 5 }, d('2026-10-21')), 5);
assert.equal(displayStreak({ last: '2026-10-19', count: 5 }, d('2026-10-21')), 0);
assert.equal(today(d('2026-01-05')), '2026-01-05');

const local = { aud: 'kids', streak: { last: '2026-10-21', count: 2 }, 'got:kids': ['k1', 'k2'] }; // old shape still merges
const remote = { aud: 'adults', streak: { last: '2026-10-20', count: 9 }, 'got:kids': ['k2', 'k3'], 'got:adults': ['a1'] };
assert.deepEqual(mergeProgress(local, remote), {
  aud: 'adults', streak: { last: '2026-10-21', count: 2 }, 'got:kids': ['k1', 'k2', 'k3'], 'got:adults': ['a1'],
});
assert.deepEqual(mergeProgress(local, {}), local);
assert.deepEqual(mergeProgress({}, remote), remote);
assert.deepEqual(mergeProgress({ streak: { last: 'x', count: 1 } }, { streak: { last: 'x', count: 3 } }).streak.count, 3);

const cards = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ id: 'c' + i }));
assert.deepEqual(pickDaily(cards, ['c1', 'c3']).map((c) => c.id), ['c2', 'c4', 'c5', 'c6', 'c7']);
{ // 5+ seen: 4 new cards in order, then 1 review card
  const ids = pickDaily(cards, ['c1', 'c2', 'c3', 'c4', 'c5']).map((c) => c.id);
  assert.deepEqual(ids.slice(0, 2), ['c6', 'c7']);
  assert.equal(ids.length, 3);
  assert.ok(['c1', 'c2', 'c3', 'c4', 'c5'].includes(ids[2]));
}
assert.equal(pickDaily(cards, cards.map((c) => c.id)).length, 5);

assert.deepEqual(
  migrate({ aud: 'kids', streak: { last: 'x', count: 1 }, 'got:kids': ['k01'], 'got:adults': ['a01', 'k01'] }),
  { streak: { last: 'x', count: 1 }, 'got:all': ['k01', 'a01'], lv: 'L0' },
);
assert.deepEqual(migrate({ lv: 'L2', 'got:all': ['x'] }), { lv: 'L2', 'got:all': ['x'] });
assert.deepEqual(migrate({ aud: 'adults', lv: 'L1' }), { lv: 'L1' });

// Content sanity: ids unique across levels, topics exist, quiz shape valid, audio present.
const seen = new Set();
const EMOJI = /^\p{Extended_Pictographic}/u;
for (const f of readdirSync('public/data').filter((f) => f.endsWith('.json'))) {
  const { topics, cards: list } = JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));
  const tids = new Set(topics.map((t) => t.id));
  assert.equal(tids.size, topics.length, `${f}: duplicate topic`);
  for (const t of topics) assert.ok(t.emoji && t.name && ['words', 'talk'].includes(t.kind), `${f}/${t.id}: topic fields`);
  for (const c of list) {
    assert.ok(!seen.has(c.id), `${c.id}: duplicate id`);
    seen.add(c.id);
    assert.ok(tids.has(c.topic), `${c.id}: unknown topic ${c.topic}`);
    assert.ok(c.emoji && c.word && c.zh && c.fact, `${c.id}: missing field`);
    const q = c.quiz;
    if (q.type === 'spell') assert.match(c.word, /^[A-Za-z]+$/, `${c.id}: spell needs one word`);
    else {
      assert.ok(['choice', 'listen', 'picture'].includes(q.type), `${c.id}: bad type`);
      assert.ok(q.options.length >= 2 && new Set(q.options).size === q.options.length, `${c.id}: options`);
      if (q.type === 'choice') assert.ok(q.q, `${c.id}: choice needs q`);
      if (q.type === 'picture') {
        for (const o of q.options) assert.ok(EMOJI.test(o) && !/[A-Za-z]/.test(o), `${c.id}: picture options must be emoji`);
        assert.equal(q.options[0], c.emoji, `${c.id}: picture answer should be the card emoji`);
      }
    }
  }
  for (const t of audioTexts(list)) {
    assert.ok(existsSync(`public/audio/${audioFile(t)}`), `missing audio for "${t}", run: npm run tts`);
  }
}

console.log('ok');
assert.equal(
  linkEnglish('说 Check, please!（英式说 the bill）'),
  '说 <button class="en" lang="en" data-say="Check, please!">Check, please!</button>（英式说 <button class="en" lang="en" data-say="the bill">the bill</button>）',
);
console.log('linkEnglish ok');
