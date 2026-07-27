let geminiClient = null;

const PCM_SAMPLE_RATE = 24000;

function isGeminiTtsConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function isGoogleTtsConfigured() {
  return isGeminiTtsConfigured();
}

function getGeminiClient() {
  if (!geminiClient) {
    const { GoogleGenAI } = require('@google/genai');
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

function pcmToWav(pcm, sampleRate = PCM_SAMPLE_RATE, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function parseDialogue(text) {
  const lines = String(text || '').split('\n').map(line => line.trim()).filter(Boolean);
  const speakers = Array.from(new Set(lines.map(line => line.match(/^([^:]{1,40}):\s+/)?.[1]).filter(Boolean)));
  return { lines, speakers: speakers.slice(0, 2) };
}

function geminiVoiceName(value, fallback = 'Charon') {
  const name = String(value || '').split('-').at(-1);
  const allowed = new Set([
    'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede',
    'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba',
    'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
    'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi',
    'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'
  ]);
  return allowed.has(name) ? name : fallback;
}

async function synthesizeWithGemini(text, configuration) {
  const { speakers } = parseDialogue(text);
  const isDialogue = speakers.length === 2;
  const style = String(configuration.style || (
    isDialogue
      ? 'Programa de radio empresarial mexicano, conversación natural, inteligente y cálida; humor seco y pausas breves.'
      : 'Narración empresarial mexicana natural, cercana, clara y sin tono de anuncio.'
  )).slice(0, 800);
  const prompt = [
    'Genera únicamente la locución del siguiente guion en español mexicano.',
    `Dirección de voz: ${style}`,
    'No leas estas instrucciones. Respeta exactamente el texto y los nombres de los hablantes.',
    '',
    'GUION:',
    text
  ].join('\n');
  const speechConfig = isDialogue ? {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: [
        {
          speaker: speakers[0],
          voiceConfig: { prebuiltVoiceConfig: { voiceName: geminiVoiceName(configuration.primaryVoice || configuration.name, 'Charon') } }
        },
        {
          speaker: speakers[1],
          voiceConfig: { prebuiltVoiceConfig: { voiceName: geminiVoiceName(configuration.secondaryVoice, 'Kore') } }
        }
      ]
    }
  } : {
    voiceConfig: {
      prebuiltVoiceConfig: { voiceName: geminiVoiceName(configuration.primaryVoice || configuration.name, 'Charon') }
    }
  };

  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await getGeminiClient().models.generateContent({
        model: process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseModalities: ['AUDIO'], speechConfig }
      });
      const data = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data)?.inlineData?.data;
      if (!data) throw new Error('Gemini TTS no devolvió audio');
      return pcmToWav(Buffer.from(data, 'base64'));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function synthesizeVoice(text, configuration = {}) {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) throw new Error('La publicación no tiene guion de locución');
  if (normalizedText.length > 12000) throw new Error('Divide el guion en episodios o escenas de menos de 12,000 caracteres');
  if (isGeminiTtsConfigured()) {
    return { audio: await synthesizeWithGemini(normalizedText, configuration), contentType: 'audio/wav', provider: 'gemini-free' };
  }
  throw new Error('Falta configurar GEMINI_API_KEY para generar voz con el nivel gratuito');
}

module.exports = {
  isGeminiTtsConfigured,
  isGoogleTtsConfigured,
  pcmToWav,
  synthesizeVoice
};
