const { exec } = require('child_process');

function startServeo() {
  console.log('[Serveo] Iniciando túnel SSH persistente para Meta Webhooks...');
  const child = exec('ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -R 80:localhost:3000 serveo.net');

  child.stdout.on('data', (data) => {
    console.log(`[Serveo] ${data}`);
  });

  child.stderr.on('data', (data) => {
    console.log(`[Serveo] ${data}`);
  });

  child.on('close', (code) => {
    console.log(`[Serveo] El túnel se desconectó con código ${code}. Reconectando automáticamente en 2 segundos...`);
    setTimeout(startServeo, 2000);
  });
}

startServeo();
