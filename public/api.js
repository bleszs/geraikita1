export async function request(path, body, csrf) {
  let response;
  try { response = await fetch('/api' + path, { credentials: 'same-origin', signal: AbortSignal.timeout(['/extractions','/kitchen/extractions'].includes(path) ? 60000 : 15000), ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, csrf }) } : {}) }); }
  catch { const error = new Error('Server tidak terjangkau. Pastikan aplikasi berjalan, lalu coba lagi.'); error.transport = true; window.dispatchEvent(new Event('gerai:connection-lost')); throw error; }
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || 'Permintaan belum berhasil.'); error.status = response.status; throw error; }
  return data;
}
export const startSession = () => request('/bootstrap');
