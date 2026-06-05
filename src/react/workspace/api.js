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
  if (!response.ok) throw new Error(data?.message || 'Solicitud no completada.');
  return data;
}

export const api = {
  me: () => request('/api/auth/me'),
  history: () => request('/api/files/history'),
  fileMeta: (id) => request(`/api/files/${id}/meta`),
  upload: (files) => {
    const body = new FormData();
    [...files].forEach((file) => body.append('files', file));
    return request('/api/files/upload', { method: 'POST', body });
  },
  runTool: (tool, documentIds, options = {}) =>
    request(`/api/tools/${tool}`, {
      method: 'POST',
      body: JSON.stringify({ documentIds, options }),
    }),
};

export function downloadDocument(document) {
  const link = window.document.createElement('a');
  link.href = document.downloadUrl;
  link.download = document.name || 'resultado';
  window.document.body.appendChild(link);
  link.click();
  link.remove();
}
