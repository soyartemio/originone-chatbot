const express = require('express');
const router = express.Router();
const axios = require('axios');
const { processUserMessage } = require('./geminiEngine');
const { processUserMessageGroq } = require('./groqEngine');
const { scheduleAppointment, getAppointments } = require('./agendaService');

/**
 * Función unificada para seleccionar Groq o Gemini según la API Key disponible
 */
async function generateBotResponse(userId, text, channel) {
  if (process.env.GROQ_API_KEY) {
    return await processUserMessageGroq(userId, text, channel);
  }
  return await processUserMessage(userId, text, channel);
}


/**
 * GET /webhook
 * Endpoint de verificación exigido por Meta (Facebook, Instagram y WhatsApp Cloud API)
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.META_VERIFY_TOKEN || 'originone_secure_token_2026';

  if (mode && token) {
    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[MetaWebhook] ✅ Webhook verificado exitosamente por Meta!');
      return res.status(200).send(challenge);
    } else {
      console.warn('[MetaWebhook] ❌ Falló la verificación del token de Meta');
      return res.sendStatus(403);
    }
  }

  res.status(400).send('Faltan parámetros de verificación');
});

/**
 * POST /webhook
 * Manejo unificado de mensajes entrantes de Facebook Messenger, Instagram Direct y WhatsApp
 */
router.post('/webhook', async (req, res) => {
  const body = req.body;

  // Responder inmediatamente con 200 OK a Meta para evitar retintentos
  res.status(200).send('EVENT_RECEIVED');

  try {
    // 1. Mensajes de WhatsApp Cloud API
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message && message.type === 'text') {
        const from = message.from; // Número del cliente
        const text = message.text.body;

        console.log(`[MetaWebhook] 💬 Mensaje de WhatsApp de +${from}: "${text}"`);
        const botReply = await generateBotResponse(from, text, 'WhatsApp Direct');

        // Enviar respuesta por WhatsApp
        const { sendWhatsAppNotification } = require('./whatsappService');
        await sendWhatsAppNotification(from, botReply);
      }
    }

    // 2. Mensajes de Facebook Messenger o Instagram Direct
    else if (body.object === 'page' || body.object === 'instagram') {
      for (const entry of body.entry || []) {
        // A) Mensajes Directos (DMs)
        const webhookEvent = entry.messaging?.[0];
        if (webhookEvent && webhookEvent.message && webhookEvent.message.text) {
          const senderPsid = webhookEvent.sender.id;
          const text = webhookEvent.message.text;
          const channelName = body.object === 'instagram' ? 'Instagram Direct' : 'Facebook Messenger';

          console.log(`[MetaWebhook] 💬 DM de ${channelName} (ID ${senderPsid}): "${text}"`);
          const botReply = await generateBotResponse(senderPsid, text, channelName);

          // Enviar respuesta vía Meta Graph API
          await sendMetaMessage(senderPsid, botReply, channelName);

        }

        // B) Comentarios en Publicaciones (Posts / Reels)
        const changes = entry.changes?.[0];
        if (changes && changes.field === 'feed') {
          const val = changes.value;
          if (val && val.item === 'comment' && val.verb === 'add' && val.message) {
            const commentId = val.comment_id;
            const userComment = val.message;
            const senderName = val.from?.name || 'Usuario';

            console.log(`[MetaWebhook] 💬 Nuevo comentario en Post de Origin One por ${senderName}: "${userComment}"`);

            // Solicitar una respuesta pública senior y concisa para el comentario
            const promptComentario = `Un usuario llamado ${senderName} comentó en una publicación de Origin One: "${userComment}". 
Genera una respuesta pública profesional, senior y cordial (máximo 2 o 3 frases). Ofrécele resolver sus dudas o invítalo a enviarnos un mensaje privado para agendar un Diagnóstico de 30 minutos sin costo.`;

            const publicReply = await generateBotResponse(`comment_${commentId}`, promptComentario, 'Comentario en Publicación');

            // Publicar la respuesta al comentario en la API de Meta
            await sendMetaCommentReply(commentId, publicReply);
          }
        }
      }
    }


  } catch (error) {
    console.error('[MetaWebhook] ❌ Error procesando evento de Webhook:', error);
  }
});

/**
 * Función auxiliar para responder mensajes en Facebook Messenger / Instagram
 */
async function sendMetaMessage(recipientPsid, text, channelName = 'Facebook Messenger') {
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
  const igAccessToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || pageAccessToken;

  try {
    if (channelName === 'Instagram Direct') {
      console.log(`[MetaWebhook] 📤 Enviando respuesta a Instagram Direct via graph.instagram.com a ID ${recipientPsid}...`);
      const response = await axios.post(
        'https://graph.instagram.com/v21.0/me/messages',
        {
          recipient: { id: recipientPsid },
          message: { text: text }
        },
        {
          headers: {
            'Authorization': `Bearer ${igAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`[MetaWebhook] ✅ Respuesta entregada exitosamente en Instagram Direct:`, response.data);
    } else {
      console.log(`[MetaWebhook] 📤 Enviando respuesta a Facebook Messenger a ID ${recipientPsid}...`);
      const fbPayload = {
        messaging_type: 'RESPONSE',
        recipient: { id: recipientPsid },
        message: { text: text }
      };

      const fbEndpoints = [
        `https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`,
        `https://graph.facebook.com/v21.0/1287784707740447/messages?access_token=${pageAccessToken}`
      ];

      for (const ep of fbEndpoints) {
        try {
          const response = await axios.post(ep, fbPayload);
          console.log(`[MetaWebhook] ✅ Respuesta entregada exitosamente en Facebook Messenger:`, response.data);
          return;
        } catch (err) {
          console.warn(`[MetaWebhook] ⚠️ Falló intento FB en ${ep}:`, err.response?.data?.error?.message || err.message);
        }
      }
    }
  } catch (error) {
    console.error(`[MetaWebhook] ❌ Error entregando respuesta en ${channelName}:`, error.response?.data || error.message);
  }
}






/**
 * Responder públicamente a un comentario en Facebook o Instagram
 */
async function sendMetaCommentReply(commentId, replyText) {
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;

  if (!pageAccessToken) {
    console.log(`[MetaWebhook] ℹ️ Respuesta a comentario generada:\n"${replyText}"`);
    return;
  }

  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/${commentId}/comments?access_token=${pageAccessToken}`,
      {
        message: replyText
      }
    );
    console.log(`[MetaWebhook] ✅ Respuesta pública enviada exitosamente al comentario ID ${commentId}`);
  } catch (error) {
    console.error(`[MetaWebhook] ❌ Error enviando comentario a Meta Graph API:`, error.response?.data || error.message);
  }
}


/**
 * POST /webhook/linkedin
 * Endpoint para recibir comentarios y mensajes de la página de empresa de LinkedIn
 */
router.post('/webhook/linkedin', async (req, res) => {
  res.status(200).send('LINKEDIN_EVENT_RECEIVED');

  try {
    const { commentUrn, authorName, commentText } = req.body;
    if (commentUrn && commentText) {
      const { handleLinkedInComment } = require('./linkedinService');
      await handleLinkedInComment(commentUrn, authorName || 'Contacto LinkedIn', commentText);
    }
  } catch (error) {
    console.error('[LinkedInWebhook] ❌ Error procesando evento de LinkedIn:', error);
  }
});

/**
 * API REST Endpoints para gestión de citas y consulta local
 */

router.get('/api/citas', (req, res) => {
  const citas = getAppointments();
  res.json({
    total: citas.length,
    citas: citas
  });
});

router.post('/api/citas', async (req, res) => {
  try {
    const result = await scheduleAppointment(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Endpoint para el Widget de S1GNAL en originone.com.mx (Chat directo Web)
 */
router.post('/api/signal/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'El campo message es requerido' });
    }

    const sid = userId || `signal_web_${Date.now()}`;
    console.log(`[S1GNAL Web] 💬 Mensaje recibido de ${sid}: "${message}"`);

    const reply = await generateBotResponse(sid, message, 'S1GNAL Web Chat (originone.com.mx)');
    res.json({
      success: true,
      canal: 'S1GNAL Web Chat',
      userId: sid,
      reply: reply
    });
  } catch (error) {
    console.error('[S1GNAL Web] ❌ Error en /api/signal/chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Endpoint para que S1GNAL agende citas directamente desde Gemini Flash Live / Frontend
 */
router.post('/api/signal/agendar-cita', async (req, res) => {
  try {
    const payload = req.body;
    payload.canal_origen = payload.canal_origen || 'S1GNAL Web Chat (originone.com.mx)';
    console.log(`[S1GNAL Web] 🗓️ Petición directa de agendamiento recibida:`, payload);

    const result = await scheduleAppointment(payload);
    res.json(result);
  } catch (error) {
    console.error('[S1GNAL Web] ❌ Error registrando cita en /api/signal/agendar-cita:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

