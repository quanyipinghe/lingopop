// Run: node test.mjs
import assert from 'node:assert/strict';
import { nextStreak, displayStreak, pickDaily, today, audioFile, audioTexts, linkEnglish } from './public/logic.js';
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

const cards = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ id: 'c' + i }));
assert.deepEqual(pickDaily(cards, ['c1', 'c3']).map((c) => c.id), ['c2', 'c4', 'c5', 'c6', 'c7']);
assert.deepEqual(pickDaily(cards, ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']).map((c) => c.id), ['c7']);
assert.equal(pickDaily(cards, cards.map((c) => c.id)).length, 5);

// Content sanity: unique ids, quiz shape valid, spell words are single words.
for (const aud of ['kids', 'students', 'adults']) {
  const list = JSON.parse(readFileSync(`public/data/${aud}.json`, 'utf8'));
  const ids = new Set(list.map((c) => c.id));
  assert.equal(ids.size, list.length, `${aud}: duplicate id`);
  for (const c of list) {
    assert.ok(c.emoji && c.word && c.zh && c.fact, `${c.id}: missing field`);
    const q = c.quiz;
    if (q.type === 'spell') assert.match(c.word, /^[A-Za-z]+$/, `${c.id}: spell needs one word`);
    else {
      assert.ok(['choice', 'listen'].includes(q.type), `${c.id}: bad type`);
      assert.ok(q.options.length >= 2 && new Set(q.options).size === q.options.length, `${c.id}: options`);
      if (q.type === 'choice') assert.ok(q.q, `${c.id}: choice needs q`);
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
