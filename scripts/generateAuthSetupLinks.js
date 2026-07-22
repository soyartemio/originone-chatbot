const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });
const configPath = path.join(__dirname, '../CONFIGURACION_CLAVES.txt');
if (fs.existsSync(configPath)) dotenv.config({ path: configPath, override: true });

const { createSetupToken } = require('../src/authService');

const baseUrl = String(process.env.AUTH_ORIGIN || 'http://localhost:3000')
  .split(',')[0]
  .trim()
  .replace(/\/$/, '');

for (const username of ['artemio', 'edgar']) {
  const token = createSetupToken(username);
  const url = `${baseUrl}/auth?user=${encodeURIComponent(username)}&setup=${encodeURIComponent(token)}`;
  console.log(`${username}: ${url}`);
}
