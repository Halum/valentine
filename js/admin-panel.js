import { JSONEditor } from 'https://cdn.jsdelivr.net/npm/vanilla-jsoneditor@0.23.8/standalone.js';

// ---- State ----
let editor;
let currentData = null;

// ---- Toast ----
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ---- Tabs ----
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    if (tab.dataset.tab === 'photos') refreshPhotos();
    if (tab.dataset.tab === 'logs') refreshLogs();
  });
});

// ---- JSON Editor ----
async function loadData() {
  const res = await fetch('/data.json?' + Date.now());
  currentData = await res.json();
  return currentData;
}

async function initEditor() {
  const data = await loadData();
  const container = document.getElementById('jsoneditor-container');
  editor = new JSONEditor({
    target: container,
    props: {
      content: { json: data },
      mode: 'tree',
      mainMenuBar: true,
      statusBar: true,
      darkTheme: true,
      onChange: (updatedContent) => {
        if (updatedContent.json !== undefined) {
          currentData = updatedContent.json;
        } else if (updatedContent.text !== undefined) {
          try { currentData = JSON.parse(updatedContent.text); } catch {}
        }
      }
    }
  });
}

async function saveData() {
  if (!currentData) return;
  try {
    const res = await fetch('/api/save-json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentData, null, 2)
    });
    const result = await res.json();
    if (result.ok) {
      toast('Saved successfully!');
    } else {
      toast(result.error || 'Save failed', 'error');
    }
  } catch (e) {
    toast('Save failed: ' + e.message, 'error');
  }
}

document.getElementById('btn-save').addEventListener('click', saveData);
document.getElementById('btn-reload').addEventListener('click', async () => {
  const data = await loadData();
  editor.set({ json: data });
  toast('Reloaded');
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveData();
  }
});

// ---- Photo Manager ----
const photoLevel = document.getElementById('photo-level');
const photoGrid = document.getElementById('photo-grid');
const fileInput = document.getElementById('file-input');
const uploadPreview = document.getElementById('upload-preview');
const uploadControls = document.getElementById('upload-controls');
const uploadPairSelect = document.getElementById('upload-pair');
const uploadFilename = document.getElementById('upload-filename');

photoLevel.addEventListener('change', refreshPhotos);

async function refreshPhotos() {
  const level = photoLevel.value;
  const res = await fetch(`/api/list-photos?level=${level}`);
  const files = await res.json();

  // Get pairs from current data
  const pairs = currentData?.[level]?.pairs || [];

  // Populate pair select
  uploadPairSelect.innerHTML = '<option value="">-- None --</option>';
  pairs.forEach(p => {
    uploadPairSelect.innerHTML += `<option value="${p.id}">${p.id} — ${p.date || p.word || p.label || ''}</option>`;
  });

  // Build grid: show existing photos + missing pair photos
  const shown = new Set();
  let html = '';

  for (const file of files) {
    const pair = pairs.find(p => p.photo === file);
    shown.add(file);
    html += photoCard(level, file, pair);
  }

  // Show placeholders for pairs with photo field that don't have a file
  for (const pair of pairs) {
    if (pair.photo && !shown.has(pair.photo)) {
      html += photoCard(level, pair.photo, pair, true);
    }
  }

  photoGrid.innerHTML = html || '<p style="color:#555">No photos found.</p>';

  // Attach event listeners
  photoGrid.querySelectorAll('[data-action="replace"]').forEach(btn => {
    btn.addEventListener('click', () => {
      uploadFilename.value = btn.dataset.file;
      fileInput.click();
    });
  });

  photoGrid.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete ${btn.dataset.file}?`)) return;
      const res = await fetch(`/api/delete-photo?level=${level}&file=${encodeURIComponent(btn.dataset.file)}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.ok) { toast('Deleted'); refreshPhotos(); }
      else toast(result.error || 'Delete failed', 'error');
    });
  });
}

function photoCard(level, file, pair, missing = false) {
  const src = missing ? '' : `photos/${level}/${file}`;
  const img = missing
    ? `<div class="placeholder">?</div>`
    : `<img src="${src}" alt="${file}" onerror="this.outerHTML='<div class=\\'placeholder\\'>?</div>'">`;
  const pairInfo = pair ? `${pair.id} — ${pair.date || ''} ${pair.emoji || ''}` : 'Unlinked';
  return `
    <div class="photo-card">
      ${img}
      <div class="info">
        <div class="name">${file}</div>
        <div class="pair">${pairInfo}</div>
        <div class="actions">
          <button class="btn btn-secondary" data-action="replace" data-file="${file}">Replace</button>
          ${!missing ? `<button class="btn btn-danger" data-action="remove" data-file="${file}">Remove</button>` : ''}
        </div>
      </div>
    </div>`;
}

// ---- Upload ----
let selectedFile = null;

fileInput.addEventListener('change', (e) => {
  selectedFile = e.target.files[0];
  if (!selectedFile) return;

  uploadPreview.hidden = false;
  uploadControls.hidden = false;
  uploadPreview.innerHTML = `<img src="${URL.createObjectURL(selectedFile)}">`;

  // Default filename from pair selection or original name
  if (!uploadFilename.value) {
    const pairId = uploadPairSelect.value;
    const ext = selectedFile.name.split('.').pop();
    uploadFilename.value = pairId ? `${pairId}.${ext}` : selectedFile.name;
  }
});

uploadPairSelect.addEventListener('change', () => {
  if (selectedFile && uploadPairSelect.value) {
    const ext = selectedFile.name.split('.').pop();
    uploadFilename.value = `${uploadPairSelect.value}.${ext}`;
  }
});

document.getElementById('btn-upload').addEventListener('click', async () => {
  if (!selectedFile) return;
  const level = photoLevel.value;
  const filename = uploadFilename.value || selectedFile.name;

  const form = new FormData();
  form.append('file', selectedFile);
  form.append('level', level);
  form.append('filename', filename);

  try {
    const res = await fetch('/api/upload-photo', { method: 'POST', body: form });
    const result = await res.json();
    if (result.ok) {
      toast(`Uploaded ${filename}`);
      selectedFile = null;
      fileInput.value = '';
      uploadPreview.hidden = true;
      uploadControls.hidden = true;
      uploadFilename.value = '';
      refreshPhotos();
    } else {
      toast(result.error || 'Upload failed', 'error');
    }
  } catch (e) {
    toast('Upload failed: ' + e.message, 'error');
  }
});

// ---- Log Viewer ----
let allLogs = [];
let autoRefreshInterval = null;

const logFilterEvent = document.getElementById('log-filter-event');
const logFilterSession = document.getElementById('log-filter-session');
const logFilterIp = document.getElementById('log-filter-ip');
const logAutoRefresh = document.getElementById('log-auto-refresh');
const logTable = document.getElementById('log-table').querySelector('tbody');

async function refreshLogs() {
  try {
    const res = await fetch('/api/logs?limit=500');
    allLogs = await res.json();
  } catch { allLogs = []; }

  // Populate event filter options
  const events = [...new Set(allLogs.map(l => l.event).filter(Boolean))].sort();
  const currentFilter = logFilterEvent.value;
  logFilterEvent.innerHTML = '<option value="">All events</option>';
  events.forEach(e => {
    logFilterEvent.innerHTML += `<option value="${e}"${e === currentFilter ? ' selected' : ''}>${e}</option>`;
  });

  renderLogs();
}

function renderLogs() {
  const eventFilter = logFilterEvent.value;
  const sessionFilter = logFilterSession.value.trim().toLowerCase();
  const ipFilter = logFilterIp.value.trim();

  const filtered = allLogs.filter(l => {
    if (eventFilter && l.event !== eventFilter) return false;
    if (sessionFilter && !(l.session || '').toLowerCase().includes(sessionFilter)) return false;
    if (ipFilter && !(l.ip || '').includes(ipFilter)) return false;
    return true;
  });

  logTable.innerHTML = filtered.map(l => {
    const ts = l.ts ? new Date(l.ts).toLocaleString() : '';
    const details = l.data ? JSON.stringify(l.data) : '';
    const sessionShort = (l.session || '').slice(0, 8);
    return `<tr>
      <td>${ts}</td>
      <td>${l.ip || ''}</td>
      <td>${l.event || ''}</td>
      <td class="details" title="${details.replace(/"/g, '&quot;')}">${details}</td>
      <td>${l.browser || ''}</td>
      <td>${l.device || ''}</td>
      <td class="session" title="${l.session || ''}">${sessionShort}</td>
    </tr>`;
  }).join('');
}

logFilterEvent.addEventListener('change', renderLogs);
logFilterSession.addEventListener('input', renderLogs);
logFilterIp.addEventListener('input', renderLogs);

document.getElementById('btn-refresh-logs').addEventListener('click', refreshLogs);

logAutoRefresh.addEventListener('change', () => {
  if (logAutoRefresh.checked) {
    autoRefreshInterval = setInterval(refreshLogs, 10000);
  } else {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
});

document.getElementById('btn-download-logs').addEventListener('click', () => {
  window.open('/logs/analytics.jsonl');
});

// ---- Init ----
initEditor();
