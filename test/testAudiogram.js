const assert = require('node:assert/strict');
const test = require('node:test');

const { pcmToWav } = require('../src/googleTtsService');
const { captionChunks, createSrt, renderAudiogram, wavDuration } = require('../src/audiogramService');

test('genera subtítulos breves sin leer los nombres de hablante', () => {
  const script = 'Dueño: Mi chatbot contesta.\nOrigin One: Pero, ¿realmente resuelve el problema?';
  const chunks = captionChunks(script, 4);
  assert.deepEqual(chunks, ['Mi chatbot contesta. Pero,', '¿realmente resuelve el problema?']);
  const srt = createSrt(script, 4);
  assert.match(srt, /00:00:00,000 -->/);
  assert.doesNotMatch(srt, /Dueño:|Origin One:/);
});

test('renderiza un MP4 vertical con onda y subtítulos', { timeout: 30000 }, async () => {
  const seconds = 1.4;
  const sampleRate = 24000;
  const pcm = Buffer.alloc(Math.floor(seconds * sampleRate) * 2);
  for (let index = 0; index < pcm.length / 2; index += 1) {
    pcm.writeInt16LE(Math.sin(index / sampleRate * Math.PI * 2 * 220) * 7000, index * 2);
  }
  const wav = pcmToWav(pcm);
  assert.ok(Math.abs(wavDuration(wav) - seconds) < 0.01);
  const video = await renderAudiogram({
    audio: wav,
    script: 'Origin One: Un asistente útil no sólo contesta. También prepara el siguiente paso.'
  });
  assert.ok(video.length > 10000);
  assert.equal(video.subarray(4, 8).toString(), 'ftyp');
});
