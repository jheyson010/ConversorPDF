import { api } from './api.js?v=20260606-google';
import { $, escapeHtml, toast } from './ui.js?v=20260606-google';

export function setupAuth(onAuthChange) {
  const dialog = $('#authDialog');
  const authNote = $('#authNote');
  const closeButton = $('#closeAuthButton');
  const googleButton = $('#googleButton');
  const startButton = $('#startButton');
  const accountChip = $('#accountChip');

  function open() {
    if (!dialog.open) dialog.showModal();
    authNote.textContent = '';
  }

  function close() {
    dialog.close();
  }

  async function loadSession() {
    const { user } = await api.me();
    renderUser(user);
    onAuthChange(user);
    if (user && window.location.pathname === '/') {
      window.location.href = '/dashboard.html';
    }
    return user;
  }

  function renderUser(user) {
    if (user) {
      startButton.textContent = 'Salir';
      const label = user.name || user.email;
      accountChip.innerHTML = `
        ${user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt="">` : '<i class="fas fa-user"></i>'}
        <span>${escapeHtml(label)}</span>
      `;
      accountChip.title = user.email;
      accountChip.classList.remove('hidden');
      return;
    }
    startButton.textContent = 'Continuar con Google';
    accountChip.classList.add('hidden');
    accountChip.textContent = '';
    accountChip.removeAttribute('title');
  }

  async function renderGoogleButton() {
    try {
      const { clientId } = await api.googleClient();
      if (!clientId) {
        authNote.textContent = 'Configura GOOGLE_CLIENT_ID para activar Google.';
        return;
      }
      if (!window.google?.accounts?.id) {
        setTimeout(renderGoogleButton, 500);
        return;
      }

      googleButton.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const { user } = await api.googleLogin(response.credential);
            renderUser(user);
            onAuthChange(user);
            close();
            toast(`Sesion iniciada: ${user.email}`);
            window.location.href = '/dashboard.html';
          } catch (error) {
            authNote.textContent = error.message;
          }
        },
      });
      window.google.accounts.id.renderButton(googleButton, {
        theme: 'filled_blue',
        size: 'large',
        width: Math.min(420, Math.max(260, googleButton.clientWidth || 420)),
        text: 'continue_with',
      });
    } catch (error) {
      authNote.textContent = error.message;
    }
  }

  startButton.addEventListener('click', async () => {
    const { user } = await api.me();
    if (!user) return open();
    await api.logout();
    renderUser(null);
    onAuthChange(null);
    toast('Sesion cerrada.');
  });

  accountChip.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  renderGoogleButton();

  return { open, close, loadSession };
}
