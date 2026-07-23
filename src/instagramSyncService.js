const axios = require('axios');
const { importChatMessages } = require('./agendaService');

const GRAPH_BASE_URL = 'https://graph.instagram.com/v21.0';

function getInstagramToken() {
  const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('Instagram no está conectado en producción');
  return token;
}

async function instagramGet(pathname, params = {}) {
  const response = await axios.get(`${GRAPH_BASE_URL}${pathname}`, {
    params: {
      ...params,
      access_token: getInstagramToken()
    },
    timeout: 20000
  });
  return response.data;
}

function getAttachmentText(message) {
  const attachments = message?.attachments?.data || [];
  if (attachments.length === 0) return null;
  const types = [...new Set(attachments.map(item => item?.mime_type || item?.type).filter(Boolean))];
  return types.length > 0
    ? `[Contenido recibido: ${types.join(', ')}]`
    : '[Contenido multimedia recibido]';
}

async function syncInstagramInteractions({ conversationLimit = 50, messageLimit = 100 } = {}) {
  const account = await instagramGet('/me', { fields: 'id,user_id,username' });
  const accountIds = new Set([account.id, account.user_id].filter(Boolean).map(String));
  const conversationResponse = await instagramGet('/me/conversations', {
    platform: 'instagram',
    fields: 'id,updated_time',
    limit: conversationLimit
  });

  const conversations = conversationResponse.data || [];
  const interactions = [];

  for (const conversation of conversations) {
    const detail = await instagramGet(`/${encodeURIComponent(conversation.id)}`, {
      fields: `id,participants,messages.limit(${messageLimit}){id,created_time,from,to,message,attachments}`
    });
    const participants = detail.participants?.data || [];
    const customer = participants.find(participant => !accountIds.has(String(participant.id))) || null;
    const messages = detail.messages?.data || [];

    for (const message of messages) {
      const senderId = String(message.from?.id || '');
      const isBusinessMessage = accountIds.has(senderId);
      const externalId = isBusinessMessage
        ? String(customer?.id || message.to?.data?.find(item => !accountIds.has(String(item.id)))?.id || '')
        : senderId;
      const messageText = String(message.message || getAttachmentText(message) || '').trim();
      if (!externalId || !messageText || !message.id) continue;

      interactions.push({
        userId: externalId,
        role: isBusinessMessage ? 'assistant' : 'user',
        messageText,
        channelName: 'Instagram Direct',
        userName: customer?.username || message.from?.username || null,
        eventId: `instagram:${message.id}`,
        createdAt: message.created_time || conversation.updated_time || null
      });
    }
  }

  const importResult = await importChatMessages(interactions);
  return {
    conversationsFound: conversations.length,
    messagesFound: interactions.length,
    ...importResult
  };
}

module.exports = {
  getAttachmentText,
  syncInstagramInteractions
};
