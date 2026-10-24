// Thin client for the local server in server.js.

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error('Cannot reach the local server. Is "npm run dev" still running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const enc = encodeURIComponent;

export const getConfig = () => request('/api/config');
export const listPages = () => request('/api/pages').then((d) => d.pages);
export const getPage = (name) => request(`/api/pages/${enc(name)}`);
export const savePage = (name, payload) => request(`/api/pages/${enc(name)}`, json('PUT', payload));
export const renamePage = (name, to) => request(`/api/pages/${enc(name)}/rename`, json('POST', { to }));
export const duplicatePage = (name, to) => request(`/api/pages/${enc(name)}/duplicate`, json('POST', { to }));
export const deletePage = (name) => request(`/api/pages/${enc(name)}`, { method: 'DELETE' });
export const listAssets = (name, kind = 'image') => request(`/api/pages/${enc(name)}/assets?kind=${kind}`).then((d) => d.data);

export const listDesignProfiles = () => request('/api/design-profiles').then((d) => d.profiles);
export const getDesignProfile = (name) => request(`/api/design-profiles/${enc(name)}`).then((d) => d.profile);
export const saveDesignProfile = (name, profile) => request(`/api/design-profiles/${enc(name)}`, json('PUT', profile));
export const deleteDesignProfile = (name) => request(`/api/design-profiles/${enc(name)}`, { method: 'DELETE' });
export const importDesignProfiles = (payload) => request('/api/design-profiles/import', json('POST', payload));

export const aiRewrite = (text, instruction) => request('/api/ai/rewrite', json('POST', { text, instruction }));
export const aiGenerateSection = (prompt, profile) => request('/api/ai/section', json('POST', { prompt, profile }));

// Uploads files into a page's assets folder. Uses XMLHttpRequest so large videos can report progress (0 to 1).
export function uploadAssets(name, files, onProgress) {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/pages/${enc(name)}/assets`);
    if (onProgress) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new Error('Cannot reach the local server. Is "npm run dev" still running?'));
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data.data);
      else reject(new Error(data.error || `Upload failed (${xhr.status})`));
    };
    xhr.send(form);
  });
}
