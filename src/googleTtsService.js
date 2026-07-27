let client = null;

function getCredentials() {
  const raw = process.env.GOOGLE_CLOUD_TTS_CREDENTIALS_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_CLOUD_TTS_CREDENTIALS_JSON no contiene JSON válido');
  }
}

function isGoogleTtsConfigured() {
  return Boolean(
    process.env.GOOGLE_CLOUD_TTS_CREDENTIALS_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_CLOUD_PROJECT
  );
}

function getClient() {
  if (!client) {
    const textToSpeech = require('@google-cloud/text-to-speech');
    const credentials = getCredentials();
    client = new textToSpeech.TextToSpeechClient({
      ...(credentials ? { credentials, projectId: credentials.project_id } : {})
    });
  }
  return client;
}

async function synthesizeVoice(text, configuration = {}) {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) throw new Error('La publicación no tiene guion de locución');
  if (Buffer.byteLength(normalizedText, 'utf8') > 5000) throw new Error('El guion supera el límite de 5,000 bytes');
  if (!isGoogleTtsConfigured()) throw new Error('Google Cloud Text-to-Speech todavía requiere credenciales');

  const speakingRate = Math.min(1.25, Math.max(0.8, Number(configuration.speakingRate || 1.03)));
  const [response] = await getClient().synthesizeSpeech({
    input: { text: normalizedText },
    voice: {
      languageCode: configuration.languageCode || 'es-US',
      name: configuration.name || 'es-US-Neural2-A'
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate,
      effectsProfileId: ['small-bluetooth-speaker-class-device']
    }
  });
  if (!response.audioContent) throw new Error('Google TTS no devolvió audio');
  return Buffer.from(response.audioContent);
}

module.exports = { isGoogleTtsConfigured, synthesizeVoice };
