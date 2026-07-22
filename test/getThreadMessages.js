const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function getThread() {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  try {
    const res = await axios.get(`https://graph.facebook.com/v21.0/t_27481082618217963?fields=messages{message,from}&access_token=${token}`);
    console.log('Mensajes del hilo:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
  }
}

getThread();
