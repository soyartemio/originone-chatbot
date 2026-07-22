const axios = require('axios');
const { processUserMessage } = require('./geminiEngine');

/**
 * Responder a un comentario en una publicación de LinkedIn
 * @param {string} commentUrn - URN del comentario o share en LinkedIn (ej. "urn:li:comment:...")
 * @param {string} text - Texto de respuesta generado por Gemini
 */
async function sendLinkedInCommentReply(commentUrn, text) {
  const linkedinAccessToken = process.env.LINKEDIN_ACCESS_TOKEN;

  if (!linkedinAccessToken) {
    console.log(`[LinkedInService] ℹ️ LINKEDIN_ACCESS_TOKEN no configurado. Respuesta a comentario:\n"${text}"`);
    return { success: false, mode: 'simulation' };
  }

  try {
    const url = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(commentUrn)}/comments`;
    const response = await axios.post(
      url,
      {
        actor: process.env.LINKEDIN_ORGANIZATION_URN, // ej. "urn:li:organization:123456"
        message: {
          text: text
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${linkedinAccessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    console.log(`[LinkedInService] ✅ Respuesta publicada exitosamente en LinkedIn URN ${commentUrn}`);
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`[LinkedInService] ❌ Error publicando respuesta en LinkedIn:`, error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

/**
 * Procesar comentario entrante desde LinkedIn
 */
async function handleLinkedInComment(commentUrn, authorName, commentText) {
  console.log(`[LinkedInService] 💼 Nuevo comentario en LinkedIn por ${authorName}: "${commentText}"`);

  const prompt = `Un profesional llamado ${authorName} comentó en la página de LinkedIn de Origin One: "${commentText}".
Genera una respuesta cordial, altamente profesional, corporativa y directa (máximo 3 oraciones). Ofrece agendar un Diagnóstico de 30 minutos sin costo para su empresa o resolver sus dudas sobre IA y automatización.`;

  const replyText = await processUserMessage(`linkedin_${commentUrn}`, prompt, 'LinkedIn Comment');
  return await sendLinkedInCommentReply(commentUrn, replyText);
}

module.exports = {
  sendLinkedInCommentReply,
  handleLinkedInComment
};
