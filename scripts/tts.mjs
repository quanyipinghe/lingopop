// Pre-generate pronunciation clips with Kokoro-82M (Apache-2.0). Run: npm run tts
import { KokoroTTS } from 'kokoro-js';
import { readFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { audioFile, audioTexts } from '../public/logic.js';

const VOICE = 'af_heart';
const OUT = new URL('../public/audio/', import.meta.url).pathname;
const DATA = new URL('../public/data/', import.meta.url).pathname;

const wanted = new Map(); // file -> text
for (const f of readdirSync(DATA).filter((f) => f.endsWith('.json'))) {
  for (const t of audioTexts(JSON.parse(readFileSync(join(DATA, f), "utf8")).cards)) wanted.set(audioFile(t), t);
}

let removed = 0;
for (const f of readdirSync(OUT)) {
  if (f.endsWith('.mp3') && !wanted.has(f)) { unlinkSync(join(OUT, f)); removed++; }
}

const todo = [...wanted].filter(([f]) => !existsSync(join(OUT, f)));
if (todo.length) {
  const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp32', device: 'cpu' });
  const wav = join(tmpdir(), 'lingopop-tts.wav');
  for (const [f, text] of todo) {
    await (await tts.generate(text, { voice: VOICE })).save(wav);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-b:a', '48k', join(OUT, f)]);
    console.log('  +', f);
  }
}
console.log(`generated ${todo.length}, skipped ${wanted.size - todo.length}, removed ${removed}`);
