import { api } from './api.js?v=20260604-email';
import { $, escapeHtml, toast } from './ui.js?v=20260604-email';

export function setupAuth(onAuthChange) {
  const dialog = $('#authDialog');
  const authNote = $('#authNote');
  const closeButton = $('#closeAuthButton');
  const googleButton = $('#googleButton');
  const startButton = $('#startButton');
  const accountChip = $('#accountChip');
  const emailForm = $('#emailAuthForm');
  const emailInput = $('#emailAuthInput');

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
      if (!window.google?.accounts?.id || !clientId) {
        setTimeout(renderGoogleButton, 500);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const { user } = await api.googleLogin(response.credential);
            renderUser(user);
            onAuthChange(user);
            close();
            toast(`Sesión iniciada: ${user.email}`);
            window.location.href = '/dashboard.html';
          } catch (error) {
            authNote.textContent = error.message;
          }
        },
      });
      window.google.accounts.id.renderButton(googleButton, {
        theme: 'filled_blue',
        size: 'large',
        width: 360,
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
    toast('Sesión cerrada.');
  });

  accountChip.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  emailForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!email) {
      authNote.textContent = 'Ingresa tu correo para continuar.';
      return;
    }
    try {
      authNote.textContent = 'Iniciando sesión...';
      const { user } = await api.emailLogin(email);
      renderUser(user);
      onAuthChange(user);
      close();
      toast(`Sesión iniciada: ${user.email}`);
      window.location.href = '/dashboard.html';
    } catch (error) {
      authNote.textContent = error.message;
    }
  });

  renderGoogleButton();

  return { open, close, loadSession };
}
