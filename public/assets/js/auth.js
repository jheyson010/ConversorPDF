import { api } from './api.js?v=20260606-access';
import { $, escapeHtml, toast } from './ui.js?v=20260606-access';

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

  if (authIntro && emailForm) {
    authIntro.textContent = 'Ingresa con cualquier correo, incluido Gmail, para guardar tu historial y descargar resultados.';
    authCard.insertBefore(authIntro, emailForm);
  }

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
    toast(`Sesion iniciada: ${user.email}`);
    window.location.href = '/dashboard.html';
  }

  emailForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    authNote.textContent = '';
    const email = emailInput.value.trim();
    if (!email) {
      authNote.textContent = 'Ingresa tu correo.';
      return;
    }
    try {
      await completeLogin(api.emailLogin(email));
    } catch (error) {
      authNote.textContent = error.message;
    }
  });

  async function renderGoogleButton() {
    try {
      const { enabled, clientId } = await api.googleClient();
      if (!enabled || !clientId) {
        googleButton.classList.add('hidden');
        googleDivider?.classList.add('hidden');
        return;
      }
      googleButton.classList.remove('hidden');
      googleDivider?.classList.remove('hidden');
      if (!window.google?.accounts?.id) {
        setTimeout(renderGoogleButton, 500);
        return;
      }

      googleButton.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            await completeLogin(api.googleLogin(response.credential));
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
