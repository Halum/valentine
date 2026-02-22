/**
 * Lightweight analytics module — fire-and-forget event logging.
 * No third-party services; events go to POST /api/log.
 */

let sessionId = null;
let deviceInfo = null;

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function getSessionId() {
  if (sessionId) return sessionId;
  sessionId = sessionStorage.getItem('analytics_session');
  if (!sessionId) {
    sessionId = generateUUID();
    sessionStorage.setItem('analytics_session', sessionId);
  }
  return sessionId;
}

function getDeviceInfo() {
  if (deviceInfo) return deviceInfo;

  const ua = navigator.userAgent;
  let browser = 'Unknown', os = 'Unknown', device = 'desktop';

  // Browser detection
  if (ua.includes('Firefox/')) browser = 'Firefox ' + (ua.match(/Firefox\/(\d+)/) || [])[1];
  else if (ua.includes('Edg/')) browser = 'Edge ' + (ua.match(/Edg\/(\d+)/) || [])[1];
  else if (ua.includes('Chrome/')) browser = 'Chrome ' + (ua.match(/Chrome\/(\d+)/) || [])[1];
  else if (ua.includes('Safari/') && ua.includes('Version/')) browser = 'Safari ' + (ua.match(/Version\/(\d+)/) || [])[1];

  // OS detection
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS ' + (ua.match(/Mac OS X (\d+[._]\d+)/) || ['', ''])[1].replace('_', '.');
  else if (ua.includes('Android')) os = 'Android ' + (ua.match(/Android (\d+)/) || [])[1];
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS ' + (ua.match(/OS (\d+)/) || [])[1];
  else if (ua.includes('Linux')) os = 'Linux';

  // Device type
  if (/Mobi|Android|iPhone/.test(ua)) device = 'mobile';
  else if (/iPad|Tablet/.test(ua)) device = 'tablet';

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  deviceInfo = {
    ua,
    browser,
    os,
    device,
    screen: `${screen.width}x${screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    colorDepth: screen.colorDepth,
    lang: navigator.language,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    referrer: document.referrer || '',
    connection: conn?.effectiveType || ''
  };
  return deviceInfo;
}

export function initAnalytics() {
  getSessionId();
  getDeviceInfo();
}

export function logEvent(name, data = {}) {
  const payload = {
    event: name,
    session: getSessionId(),
    data,
    ...getDeviceInfo()
  };

  const body = JSON.stringify(payload);

  // Prefer sendBeacon (non-blocking, works on unload)
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/log', new Blob([body], { type: 'application/json' }));
  } else {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {}); // silent fail
  }
}
