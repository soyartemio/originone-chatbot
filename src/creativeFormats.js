// Catálogo de formatos creativos verticales para el módulo de publicaciones.
//
// Cada formato traduce una publicación aprobada (gancho, historia, solución, CTA)
// en una secuencia de beats con las técnicas de retención vigentes en 2026:
//
// - El gancho ocupa los primeros 3 segundos completos y abre en el primer cuadro,
//   sin cortinilla de marca: la retención de intro decide el alcance.
// - Todo el texto va quemado en pantalla porque el consumo ocurre sin sonido.
// - La locución refuerza el texto en pantalla, nunca lo sustituye.
// - El CTA aparece antes del final para que se lea aunque el video se corte.

const CANVAS = { width: 1080, height: 1920, fps: 30 };

const RETENTION_NOTES = [
  'Gancho visible en el cuadro 0, sin intro de marca.',
  'Texto quemado en pantalla para consumo sin audio.',
  'Un solo mensaje por beat; sin párrafos densos.',
  'CTA presente antes del último segundo.'
];

function clean(value, limit) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

// Recorta a la frase completa más larga que quepa; si la primera ya excede el
// límite, corta en la última palabra para no partir a media palabra.
function trimToSentence(value, limit) {
  const text = clean(value, 2000);
  if (text.length <= limit) return text;
  const sentences = text.split(/(?<=[.?!])\s+/);
  let result = '';
  for (const sentence of sentences) {
    if (result && (`${result} ${sentence}`).length > limit) break;
    result = result ? `${result} ${sentence}` : sentence;
  }
  if (result.length <= limit && result) return result;
  const hard = text.slice(0, limit);
  return `${hard.slice(0, hard.lastIndexOf(' ')).trim()}…`;
}

// Igual que `trimToSentence`, pero nunca devuelve un fragmento: si ni la primera
// frase cabe, devuelve cadena vacía. Se usa para el cuerpo de la locución, donde
// una frase a medias suena peor que no decirla.
function trimToWholeSentences(value, limit) {
  const text = clean(value, 2000);
  if (limit <= 0) return '';
  if (text.length <= limit) return text;
  let result = '';
  for (const sentence of text.split(/(?<=[.?!])\s+/)) {
    if ((result ? `${result} ${sentence}` : sentence).length > limit) break;
    result = result ? `${result} ${sentence}` : sentence;
  }
  return result;
}

// El guion vive completo en `voiceoverScript`, con el CTA como frase final.
// `voiceoverCta` marca cuál es esa cola para poder protegerla del recorte; si la
// publicación no la declara, se toma la última frase del guion por convención.
function splitVoiceover(publication) {
  const script = clean(publication?.voiceoverScript, 5000);
  const declared = clean(publication?.voiceoverCta, 300);
  if (!script) return { body: '', cta: declared };
  if (declared) {
    const body = script.endsWith(declared) ? script.slice(0, -declared.length).trim() : script;
    return { body, cta: declared };
  }
  const sentences = script.split(/(?<=[.?!])\s+/).filter(Boolean);
  if (sentences.length < 2) return { body: '', cta: script };
  return { body: sentences.slice(0, -1).join(' '), cta: sentences.at(-1) };
}

// El tamaño tipográfico baja por tramos según la longitud real del texto para
// que el bloque no desborde el lienzo vertical.
function fitFontSize(text, { max, min }) {
  const length = String(text || '').length;
  const size = Math.round(max - (length / 6) * ((max - min) / 12));
  return Math.max(min, Math.min(max, size));
}

const FORMATS = {
  'video-hook': {
    id: 'video-hook',
    kind: 'video',
    label: 'Video gancho · 8 s',
    duration: 8,
    purpose: 'Tope de embudo. Instala el problema y deja la marca; no busca cierre.',
    voiceoverTarget: 105,
    beats: publication => [
      { id: 'hook', start: 0, duration: 3, role: 'gancho', text: trimToSentence(publication.visualHeadline || publication.title, 62) },
      { id: 'tension', start: 3, duration: 3, role: 'tension', text: trimToSentence(publication.visualCaption || publication.situation, 78) },
      { id: 'payoff', start: 6, duration: 2, role: 'solucion', text: trimToSentence(publication.solution, 70) }
    ]
  },
  'video-story': {
    id: 'video-story',
    kind: 'video',
    label: 'Video historia · 20 s',
    duration: 20,
    purpose: 'Arco completo problema → solución → CTA. Es el formato de conversión.',
    voiceoverTarget: 290,
    beats: publication => [
      { id: 'hook', start: 0, duration: 3, role: 'gancho', text: trimToSentence(publication.visualHeadline || publication.title, 62) },
      { id: 'problem', start: 3, duration: 5, role: 'problema', text: trimToSentence(publication.story || publication.situation, 150) },
      { id: 'cost', start: 8, duration: 4, role: 'consecuencia', text: trimToSentence(publication.ownerPain, 120) },
      { id: 'solution', start: 12, duration: 5, role: 'solucion', text: trimToSentence(publication.solution, 140) },
      { id: 'close', start: 17, duration: 3, role: 'cta', text: trimToSentence(publication.evidence, 90) }
    ]
  },
  'imagen': {
    id: 'imagen',
    kind: 'image',
    label: 'Imagen 9:16',
    duration: 0,
    purpose: 'Pieza única para feed. Un solo mensaje legible en miniatura.',
    voiceoverTarget: 0,
    beats: publication => [
      { id: 'hook', start: 0, duration: 1, role: 'gancho', text: trimToSentence(publication.visualHeadline || publication.title, 62) },
      { id: 'caption', start: 0, duration: 1, role: 'tension', text: trimToSentence(publication.visualCaption || publication.situation, 78) }
    ]
  },
  'carrusel': {
    id: 'carrusel',
    kind: 'carousel',
    label: 'Carrusel · 5 slides',
    duration: 0,
    purpose: 'Profundidad sin video. El slide 1 gancha; el 5 pide la acción.',
    voiceoverTarget: 0,
    beats: publication => [
      { id: 'slide-1', start: 0, duration: 1, role: 'gancho', text: trimToSentence(publication.visualHeadline || publication.title, 62) },
      { id: 'slide-2', start: 0, duration: 1, role: 'problema', text: trimToSentence(publication.situation, 150) },
      { id: 'slide-3', start: 0, duration: 1, role: 'consecuencia', text: trimToSentence(publication.ownerPain, 140) },
      { id: 'slide-4', start: 0, duration: 1, role: 'solucion', text: trimToSentence(publication.solution, 150) },
      { id: 'slide-5', start: 0, duration: 1, role: 'cta', text: trimToSentence(publication.evidence || publication.humor, 120) }
    ]
  }
};

function listFormats() {
  return Object.values(FORMATS).map(format => ({
    id: format.id,
    kind: format.kind,
    label: format.label,
    duration: format.duration,
    purpose: format.purpose,
    voiceoverTarget: format.voiceoverTarget
  }));
}

function getFormat(id) {
  const format = FORMATS[String(id || '').trim()];
  if (!format) throw new Error(`Formato creativo no válido: ${id}`);
  return format;
}

// `scale` estira los beats cuando la locución real dura más que el formato, para
// que no queden segundos muertos al final con la imagen congelada.
function planBeats(formatId, publication, scale = 1) {
  const format = getFormat(formatId);
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return format.beats(publication)
    .filter(beat => beat.text)
    .map(beat => ({
      ...beat,
      start: Number((beat.start * factor).toFixed(3)),
      duration: Number((beat.duration * factor).toFixed(3)),
      fontSize: fitFontSize(beat.text, beat.role === 'gancho' ? { max: 96, min: 58 } : { max: 62, min: 38 })
    }));
}

// Recorta el guion de locución a lo que cabe en la duración del formato.
// Gemini TTS produce del orden de 14 caracteres por segundo en español.
//
// El recorte sale del CUERPO, nunca del CTA: primero se reserva el presupuesto
// del CTA hablado y con lo que sobra se arma el cuerpo con frases completas. Así
// la pieza de 8 s dice menos, pero siempre pide la acción.
function voiceoverForFormat(formatId, publication) {
  const format = getFormat(formatId);
  if (!format.voiceoverTarget) return '';
  const { body, cta } = splitVoiceover(publication);
  if (!cta) return trimToSentence(body, format.voiceoverTarget);
  const spokenCta = trimToSentence(cta, format.voiceoverTarget);
  const room = format.voiceoverTarget - spokenCta.length - 1;
  const spokenBody = trimToWholeSentences(body, room);
  return spokenBody ? `${spokenBody} ${spokenCta}` : spokenCta;
}

module.exports = {
  CANVAS, FORMATS, RETENTION_NOTES,
  fitFontSize, getFormat, listFormats, planBeats,
  splitVoiceover, trimToSentence, trimToWholeSentences, voiceoverForFormat
};
