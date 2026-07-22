const { exec } = require('child_process');

function startTunnel() {
  console.log('[Tunnel] Iniciando túnel local para Meta Webhooks...');
  const child = exec('npx -y localtunnel --port 3000 --subdomain originone-chatbot-live');

  child.stdout.on('data', (data) => {
    console.log(`[Tunnel] ${data}`);
  });

  child.stderr.on('data', (data) => {
    console.error(`[Tunnel Error] ${data}`);
  });

  child.on('close', (code) => {
    console.log(`[Tunnel] El túnel se cerró con código ${code}. Reiniciando en 3 segundos...`);
    setTimeout(startTunnel, 3000);
  });
}

startTunnel();
