const VIDEO_HOSTS = [
  'ujeklsj.site',
  'vid1.ujeklsj.site',
  'q-drama.com',
];

const SPOOFED_ORIGIN = 'https://q-drama.com';
const SPOOFED_REFERER = 'https://q-drama.com/';

function isVideoHost(url) {
  try {
    const hostname = new URL(url).hostname;
    return VIDEO_HOSTS.some(host => hostname === host || hostname.endsWith('.' + host));
  } catch {
    return false;
  }
}

function shouldSpoof(request) {
  return isVideoHost(request.url) && 
    (request.destination === 'video' || 
     request.headers.get('range') !== null ||
     request.url.includes('.mp4') ||
     request.url.includes('.m3u8') ||
     request.url.includes('.ts'));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  if (!shouldSpoof(request)) {
    return;
  }

  event.respondWith((async () => {
    try {
      const headers = new Headers(request.headers);
      
      headers.set('Referer', SPOOFED_REFERER);
      headers.set('Origin', SPOOFED_ORIGIN);
      
      headers.delete('sec-fetch-site');
      headers.delete('sec-fetch-mode');
      headers.delete('sec-fetch-dest');
      
      const modifiedRequest = new Request(request.url, {
        method: request.method,
        headers: headers,
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'follow',
        referrer: SPOOFED_REFERER,
        referrerPolicy: 'no-referrer',
        integrity: request.integrity,
        signal: request.signal,
      });

      const response = await fetch(modifiedRequest);
      
      const responseHeaders = new Headers(response.headers);
      
      if (!responseHeaders.has('access-control-allow-origin')) {
        responseHeaders.set('Access-Control-Allow-Origin', '*');
      }
      if (!responseHeaders.has('access-control-expose-headers')) {
        responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
      }
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, RANGE');
      responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Range, Content-Length, Accept-Ranges');
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      console.error('[SW] Fetch failed for:', request.url, err);
      return fetch(request);
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});