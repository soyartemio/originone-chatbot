const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

function srtTimestamp(seconds) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const secs = Math.floor((milliseconds % 60000) / 1000);
  const ms = milliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function spokenText(script) {
  return String(script || '')
    .replace(/^\s*[^:\n]{1,40}:\s*/gm, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function captionChunks(script, maxWords = 8) {
  const words = spokenText(script).split(' ').filter(Boolean);
  const chunks = [];
  for (let index = 0; index < words.length; index += maxWords) {
    chunks.push(words.slice(index, index + maxWords).join(' '));
  }
  return chunks;
}

function wavDuration(wav) {
  if (wav.subarray(0, 4).toString() !== 'RIFF') return null;
  const byteRate = wav.readUInt32LE(28);
  const dataSize = wav.readUInt32LE(40);
  return byteRate ? dataSize / byteRate : null;
}

function createSrt(script, duration) {
  const chunks = captionChunks(script);
  const wordCounts = chunks.map(chunk => chunk.split(' ').length);
  const totalWords = wordCounts.reduce((sum, count) => sum + count, 0) || 1;
  let elapsed = 0;
  return chunks.map((chunk, index) => {
    const chunkDuration = duration * wordCounts[index] / totalWords;
    const start = elapsed;
    elapsed += chunkDuration;
    return `${index + 1}\n${srtTimestamp(start)} --> ${srtTimestamp(Math.min(duration, elapsed))}\n${chunk}\n`;
  }).join('\n');
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let errorOutput = '';
    process.stderr.on('data', chunk => { errorOutput += chunk.toString(); });
    process.on('error', reject);
    process.on('close', code => code === 0
      ? resolve()
      : reject(new Error(`No fue posible renderizar el audiograma: ${errorOutput.slice(-1200)}`)));
  });
}

function ffmpegFilterPath(filePath) {
  return filePath.replaceAll('\\', '/').replaceAll(':', '\\:').replaceAll("'", "\\'");
}

async function renderAudiogram({ audio, script }) {
  const duration = wavDuration(audio);
  if (!duration) throw new Error('El audiograma gratuito requiere audio WAV generado con Gemini TTS');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'origin-one-audiogram-'));
  const audioPath = path.join(directory, 'voice.wav');
  const subtitlePath = path.join(directory, 'captions.srt');
  const outputPath = path.join(directory, 'audiogram.mp4');
  await fs.writeFile(audioPath, audio);
  await fs.writeFile(subtitlePath, createSrt(script, duration), 'utf8');

  const filter = [
    '[0:a]showwaves=s=620x230:mode=line:colors=0xFFB000@0.95:rate=30,format=rgba[wave];',
    `[1:v][wave]overlay=50:500:shortest=1,`,
    `subtitles='${ffmpegFilterPath(subtitlePath)}':force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Shadow=0,MarginV=165,Alignment=2',`,
    "drawtext=text='ORIGIN ONE':fontcolor=0xFFB000:fontsize=28:x=(w-text_w)/2:y=170,",
    "drawtext=text='IA QUE RESUELVE':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=230[v]"
  ].join('');

  try {
    await runFfmpeg([
      '-y',
      '-i', audioPath,
      '-f', 'lavfi', '-i', `color=c=0x090A0C:s=720x1280:r=30:d=${duration.toFixed(3)}`,
      '-filter_complex', filter,
      '-map', '[v]', '-map', '0:a',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', '-shortest', outputPath
    ]);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

module.exports = { captionChunks, createSrt, renderAudiogram, spokenText, wavDuration };
