import { api } from './api.js?v=20260615-public';
import { $, escapeHtml, toast } from './ui.js?v=20260615-public';

export function setupAuth(onAuthChange) {
  const dialog = $('#authDialog');
  const authNote = $('#authNote');
  const closeButton = $('#closeAuthButton');
  const emailForm = $('#emailAuthForm');
  const emailInput = $('#emailAuthInput');
  const googleButton = $('#googleButton');
  const startButton = $('#startButton');
  const accountChip = $('#accountChip');
  const authCard = $('#authCard');
  const googleDivider = authCard?.querySelector('.auth-divider');
  const authIntro = authCard?.querySelector('p:not(.auth-note)');

  if (authIntro) {
    authIntro.textContent = 'Inicia sesión de forma rápida y segura con tu cuenta de Google para acceder a tus documentos y funciones exclusivas.';
  }

  function open() {
    if (!dialog.open) dialog.showModal();
    authNote.textContent = '';
    renderGoogleButton();
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
      startButton.textContent = 'Cerrar sesión';
      const label = user.name || user.email;
      accountChip.innerHTML = `
        ${user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt="">` : '<i class="fas fa-user"></i>'}
        <span>${escapeHtml(label)}</span>
      `;
      accountChip.title = user.email;
      accountChip.classList.remove('hidden');
      return;
    }
    startButton.textContent = 'Ingresar';
    accountChip.classList.add('hidden');
    accountChip.textContent = '';
    accountChip.removeAttribute('title');
  }

  async function completeLogin(loginPromise) {
    const { user } = await loginPromise;
    renderUser(user);
    onAuthChange(user);
    close();
    toast(`Sesión iniciada: ${user.email}`);
    window.location.href = '/dashboard.html';
  }

  async function renderGoogleButton() {
    try {
      const { enabled, clientId } = await api.googleClient();
      if (!googleButton) return;
      if (!enabled || !clientId) {
        authNote.textContent = 'El inicio de sesión con Google no está habilitado actualmente.';
        return;
      }
      if (!window.google?.accounts?.id) {
        setTimeout(renderGoogleButton, 400);
        return;
      }

      googleButton.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        ux_mode: 'popup',
        callback: async (response) => {
          try {
            await completeLogin(api.googleLogin(response.credential));
          } catch (error) {
            authNote.textContent = error.message;
          }
        },
      });
      window.google.accounts.id.renderButton(googleButton, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      });
    } catch (error) {
      if (authNote) authNote.textContent = error.message;
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
