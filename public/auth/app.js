const params = new URLSearchParams(window.location.search);
const setupToken = params.get('setup') || '';
const requestedUser = (params.get('user') || '').toLowerCase();
const requestedNext = params.get('next') || '/admin/';
const safeNext = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/admin/';

const form = document.getElementById('passwordForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const passwordLabel = document.getElementById('passwordLabel');
const passwordHelp = document.getElementById('passwordHelp');
const submitButton = document.getElementById('submitButton');
const alertBox = document.getElementById('alert');
const passkeyStep = document.getElementById('passkeyStep');
const passkeyButton = document.getElementById('passkeyButton');
const passkeyTitle = document.getElementById('passkeyTitle');
const passkeyCopy = document.getElementById('passkeyCopy');
let pendingCeremony = null;

function showAlert(message, success = false) {
  alertBox.textContent = message;
  alertBox.classList.toggle('success', success);
  alertBox.hidden = !message;
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.textContent = busy ? label : button.dataset.label;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No fue posible completar la solicitud');
  return data;
}

async function loadInitialState() {
  if (!window.PublicKeyCredential || !window.SimpleWebAuthnBrowser) {
    showAlert('Este navegador no admite passkeys. Usa una versión reciente de Safari, Chrome, Edge o Firefox.');
    submitButton.disabled = true;
    return;
  }

  const session = await fetch('/api/auth/session', { credentials: 'same-origin' }).then(response => response.json());
  if (session.authenticated) {
    window.location.replace(safeNext);
    return;
  }

  const response = await fetch('/api/auth/users', { credentials: 'same-origin' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'El acceso seguro aún no está configurado');

  if (setupToken && ['artemio', 'edgar'].includes(requestedUser)) {
    const user = data.users.find(item => item.username === requestedUser);
    usernameInput.value = requestedUser;
    usernameInput.disabled = true;
    if (!user?.configured) {
      document.getElementById('stepLabel').textContent = 'ACTIVACIÓN · PASO 1 DE 2';
      document.getElementById('formTitle').textContent = `Hola, ${user?.displayName || requestedUser}`;
      document.getElementById('formSubtitle').textContent = 'Crea tu contraseña personal. Después registrarás una passkey en este dispositivo.';
      passwordLabel.textContent = 'Crea una contraseña';
      passwordInput.autocomplete = 'new-password';
      passwordHelp.hidden = false;
      submitButton.textContent = 'Crear contraseña y continuar';
      submitButton.dataset.label = submitButton.textContent;
    }
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  showAlert('');
  setBusy(submitButton, true, 'Verificando…');
  try {
    const data = await postJson('/api/auth/password', {
      username: usernameInput.value,
      password: passwordInput.value,
      setupToken
    });
    pendingCeremony = data;
    form.hidden = true;
    passkeyStep.hidden = false;
    const registration = data.next === 'register_passkey';
    document.getElementById('stepLabel').textContent = registration ? 'ACTIVACIÓN · PASO 2 DE 2' : 'VERIFICACIÓN FINAL';
    document.getElementById('formTitle').textContent = registration ? 'Crea tu passkey' : 'Confirma que eres tú';
    document.getElementById('formSubtitle').textContent = registration
      ? 'Quedará protegida por la seguridad de tu dispositivo.'
      : 'Usa la passkey registrada para terminar el acceso.';
    passkeyTitle.textContent = registration ? 'Registrar passkey' : 'Usar passkey';
    passkeyCopy.textContent = registration
      ? 'Tu dispositivo te pedirá huella, rostro o PIN. Origin One solo recibirá una llave pública.'
      : 'Tu dispositivo abrirá una ventana segura para usar tu huella, rostro o PIN.';
    passkeyButton.textContent = registration ? 'Crear passkey' : 'Verificar passkey';
    passkeyButton.dataset.label = passkeyButton.textContent;
  } catch (error) {
    showAlert(error.message);
  } finally {
    setBusy(submitButton, false, '');
  }
});

passkeyButton.addEventListener('click', async () => {
  if (!pendingCeremony) return;
  showAlert('');
  setBusy(passkeyButton, true, 'Abriendo seguridad…');
  try {
    const registration = pendingCeremony.next === 'register_passkey';
    const response = registration
      ? await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: pendingCeremony.options })
      : await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: pendingCeremony.options });
    const endpoint = registration
      ? '/api/auth/passkey/register/verify'
      : '/api/auth/passkey/authenticate/verify';
    await postJson(endpoint, { response });
    showAlert('Acceso verificado. Abriendo el CRM…', true);
    window.location.replace(safeNext);
  } catch (error) {
    const cancelled = error.name === 'NotAllowedError';
    showAlert(cancelled ? 'La verificación fue cancelada. Puedes intentarlo de nuevo.' : error.message);
  } finally {
    setBusy(passkeyButton, false, '');
  }
});

document.getElementById('backButton').addEventListener('click', () => window.location.reload());
document.getElementById('revealPassword').addEventListener('click', event => {
  const reveal = passwordInput.type === 'password';
  passwordInput.type = reveal ? 'text' : 'password';
  event.currentTarget.textContent = reveal ? 'Ocultar' : 'Ver';
});

loadInitialState().catch(error => showAlert(error.message));
