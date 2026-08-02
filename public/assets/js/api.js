export async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof data === 'object' && data.message ? data.message : 'Solicitud no completada.';
    throw new Error(message);
  }

  return data;
}

export const api = {
  me: () => request('/api/auth/me'),
  emailLogin: (email) => request('/api/auth/email', { method: 'POST', body: JSON.stringify({ email }) }),
  googleLogin: (credential) => request('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  googleClient: () => request('/api/auth/google/client'),
  logout: () => request('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) }),
  subscriptionStatus: () => request('/api/subscriptions/status'),
  createSubscriptionCheckout: () => request('/api/subscriptions/checkout', { method: 'POST', body: JSON.stringify({}) }),
  upload: (files) => {
    const body = new FormData();
    [...files].forEach((file) => body.append('files', file));
    return request('/api/files/upload', { method: 'POST', body });
  },
  history: () => request('/api/files/history'),
  runTool: (tool, documentIds, options) =>
    request(`/api/tools/${tool}`, {
      method: 'POST',
      body: JSON.stringify({ documentIds, options }),
    }),
  ocrImage: (imageData) =>
    request('/api/ocr/image', {
      method: 'POST',
      body: JSON.stringify({ imageData }),
    }),
};
