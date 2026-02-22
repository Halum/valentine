import { getState, setState, resetState } from './state.js';
import { isAdmin } from './admin.js';
import { logEvent } from './analytics.js';

const CLICKS_NEEDED = 3;
const GIFT_DELAY = 10000;

let wordEls = {};
let wordVelocities = {};
let clickCounts = {};
let heartSegments = {};
let animationId = null;
let allCaptured = false;

// Cached layout positions computed dynamically based on actual word widths
let computedPositions = {};

export function initLevel3(data) {
  const container = document.getElementById('level-3');
  if (!container) return;

  if (isAdmin) container.classList.add('admin-mode');

  container.innerHTML = `
    <div class="level3-background"></div>
    <h1 class="level3-title">${data.title}</h1>
    <p class="level3-subtitle">${data.subtitle}</p>
    <p class="level3-progress"></p>
    <div class="gift-box-container">
      <div class="gift-box">
        <div class="gift-body">
          <div class="gift-ribbon-v"></div>
          <div class="gift-ribbon-h"></div>
        </div>
        <div class="gift-lid">
          <div class="gift-lid-ribbon"></div>
        </div>
      </div>
      <div class="gift-message">Forever & Always 💕</div>
    </div>
    <button id="level3-restart">Start Over</button>
  `;

  const state = getState();
  const captured = state.level3.capturedWords || [];

  // Create floating words
  data.keywords.forEach((kw) => {
    const el = document.createElement('div');
    el.className = 'floating-word';
    el.dataset.id = kw.id;
    const needed = isAdmin ? 1 : CLICKS_NEEDED;
    el.innerHTML = `<span class="word-text">${kw.word}</span><span class="click-badge">0/${needed}</span>`;
    container.appendChild(el);
    wordEls[kw.id] = el;
    clickCounts[kw.id] = 0;

    const x = Math.random() * (window.innerWidth - 150);
    const y = 100 + Math.random() * (window.innerHeight - 200);
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    const speed = 0.15 + Math.random() * 0.35;
    const angle = Math.random() * Math.PI * 2;
    wordVelocities[kw.id] = {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed
    };

    el.addEventListener('click', () => handleWordClick(kw, el, data));
  });

  createHeartOutline(container, data);

  // Restore previously captured words
  if (captured.length > 0) {
    captured.forEach((id) => {
      const kw = data.keywords.find(k => k.id === id);
      if (kw && wordEls[id]) {
        clickCounts[id] = CLICKS_NEEDED;
        // Clear the CSS blur immediately (no animation on restore)
        const textEl = wordEls[id].querySelector('.word-text');
        if (textEl) textEl.style.filter = 'blur(0px)';
        captureWord(kw, wordEls[id], data, true);
      }
    });
  }

  startFlying(data);
  updateProgress(data);

  // If all were already captured (e.g. reload after completing), restore completed state immediately
  if (captured.length >= data.keywords.length) {
    onAllCaptured(data, true);
  }

  document.getElementById('level3-restart').addEventListener('click', () => {
    logEvent('reset');
    resetState();
    location.reload();
  });
}

function createHeartOutline(container, data) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'heart-outline-svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');

  const heartPathD = 'M 50 88 C 25 68, 4 48, 4 32 C 4 18, 16 8, 30 8 C 38 8, 45 13, 50 20 C 55 13, 62 8, 70 8 C 84 8, 96 18, 96 32 C 96 48, 75 68, 50 88 Z';

  const measurePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  measurePath.setAttribute('d', heartPathD);
  measurePath.style.visibility = 'hidden';
  svg.appendChild(measurePath);
  container.appendChild(svg);

  const totalLength = measurePath.getTotalLength();
  const segCount = data.keywords.length;
  const segLen = totalLength / segCount;

  svg.removeChild(measurePath);

  // Sequential assignment: word i → segment i
  data.keywords.forEach((kw, i) => {
    const segStart = i * segLen;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', heartPathD);
    path.setAttribute('class', 'heart-segment');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-width', '1.2');
    path.setAttribute('stroke-dasharray', `${segLen} ${totalLength - segLen}`);
    path.setAttribute('stroke-dashoffset', `-${segStart}`);

    svg.appendChild(path);
    heartSegments[kw.id] = path;
  });
}

// Compute evenly-spaced positions inside the heart for all captured words.
// Measures actual element sizes to prevent overlap.
function computeCapturedLayout(data) {
  const captured = (getState().level3.capturedWords || []);
  const capturedKws = captured
    .map(id => data.keywords.find(k => k.id === id))
    .filter(Boolean);

  if (capturedKws.length === 0) return;

  const FONT_SIZE = 0.9; // rem — uniform for all
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Heart bounding box (matches CSS: top:10%, left:15%, width:70%, height:75%)
  // But we use a tighter inner area to avoid edges
  const heartTop = vh * 0.16;
  const heartBottom = vh * 0.72;
  const heartCenterX = vw * 0.5;

  // Heart width at a given Y fraction (0=top, 1=bottom) — simplified heart shape
  function heartWidthAt(fraction) {
    // Two bumps at top, widest at ~30%, narrows to point at bottom
    if (fraction < 0.15) return 0.3 + fraction * 2.5;       // opening up from top
    if (fraction < 0.35) return 0.65 + (fraction - 0.15) * 0.5; // near widest
    if (fraction < 0.45) return 0.75;                         // widest band
    return 0.75 * (1 - ((fraction - 0.45) / 0.55));          // narrows to tip
  }

  // Temporarily set font size on all captured elements to measure widths
  const measurements = [];
  capturedKws.forEach(kw => {
    const el = wordEls[kw.id];
    if (!el) return;
    el.style.fontSize = FONT_SIZE + 'rem';
    el.style.position = 'absolute';
    el.style.visibility = 'hidden';
    el.style.left = '0px';
    el.style.top = '0px';
    el.classList.add('captured'); // ensure captured styles for measurement
  });

  // Force layout
  document.body.offsetHeight;

  capturedKws.forEach(kw => {
    const el = wordEls[kw.id];
    if (!el) return;
    measurements.push({
      kw,
      w: el.offsetWidth,
      h: el.offsetHeight,
    });
  });

  // Pack words into rows inside the heart
  const totalH = heartBottom - heartTop;
  const rowGap = 8;

  // Estimate row height from first measurement
  const rowH = measurements.length > 0 ? measurements[0].h : 24;

  // Calculate how many rows we need, and distribute words into rows
  // that fit within the heart width at each row's Y position
  const rows = [];
  let wordQueue = [...measurements];
  let y = heartTop;

  while (wordQueue.length > 0 && y + rowH <= heartBottom) {
    const fraction = (y - heartTop) / totalH;
    const maxWidth = heartWidthAt(fraction) * vw * 0.65; // leave some padding
    const wordGap = 12;

    // Greedily fill this row
    const row = [];
    let rowWidth = 0;

    for (let i = 0; i < wordQueue.length; i++) {
      const needed = rowWidth + wordQueue[i].w + (row.length > 0 ? wordGap : 0);
      if (needed <= maxWidth || row.length === 0) {
        // Always place at least 1 word per row
        rowWidth = needed;
        row.push(wordQueue[i]);
        wordQueue.splice(i, 1);
        i--;
        if (rowWidth >= maxWidth) break;
      }
    }

    rows.push({ y: y + rowH / 2, items: row, totalWidth: rowWidth });
    y += rowH + rowGap;
  }

  // If there are leftover words (shouldn't happen often), force them into the last row area
  if (wordQueue.length > 0 && rows.length > 0) {
    wordQueue.forEach(m => rows[rows.length - 1].items.push(m));
  }

  // Center rows vertically within the heart
  const usedHeight = rows.length * (rowH + rowGap) - rowGap;
  const yOffset = (totalH - usedHeight) / 2;

  // Assign positions
  rows.forEach((row, ri) => {
    const rowY = heartTop + yOffset + ri * (rowH + rowGap) + rowH / 2;
    const totalRowW = row.items.reduce((s, m) => s + m.w, 0) + (row.items.length - 1) * 12;
    let x = heartCenterX - totalRowW / 2;

    row.items.forEach(m => {
      computedPositions[m.kw.id] = {
        x: x + m.w / 2,
        y: rowY,
        size: FONT_SIZE
      };
      x += m.w + 12;
    });
  });

  // Restore visibility
  capturedKws.forEach(kw => {
    const el = wordEls[kw.id];
    if (el) el.style.visibility = '';
  });
}

function revealHeartSegment(kwId) {
  const seg = heartSegments[kwId];
  if (seg) seg.classList.add('revealed');
}

function hideHeartSegment(kwId) {
  const seg = heartSegments[kwId];
  if (seg) seg.classList.remove('revealed');
}

function startFlying(data) {
  function animate() {
    data.keywords.forEach((kw) => {
      const el = wordEls[kw.id];
      if (!el || el.classList.contains('captured')) return;

      const vel = wordVelocities[kw.id];
      let x = parseFloat(el.style.left);
      let y = parseFloat(el.style.top);
      const w = el.offsetWidth;
      const h = el.offsetHeight;

      x += vel.vx;
      y += vel.vy;

      if (x <= 0) { x = 0; vel.vx = Math.abs(vel.vx); }
      if (x + w >= window.innerWidth) { x = window.innerWidth - w; vel.vx = -Math.abs(vel.vx); }
      if (y <= 80) { y = 80; vel.vy = Math.abs(vel.vy); }
      if (y + h >= window.innerHeight) { y = window.innerHeight - h; vel.vy = -Math.abs(vel.vy); }

      el.style.left = x + 'px';
      el.style.top = y + 'px';
    });

    animationId = requestAnimationFrame(animate);
  }
  animationId = requestAnimationFrame(animate);
}

function handleWordClick(kw, el, data) {
  if (allCaptured) return;

  if (el.classList.contains('captured')) {
    releaseWord(kw, el, data);
    return;
  }

  const needed = isAdmin ? 1 : CLICKS_NEEDED;
  clickCounts[kw.id]++;
  const badge = el.querySelector('.click-badge');
  badge.textContent = `${clickCounts[kw.id]}/${needed}`;
  el.classList.add('clicked');

  // Progressive deblur on the text only
  const progress = Math.min(clickCounts[kw.id] / needed, 1);
  const blur = 8 * (1 - progress);
  const textEl = el.querySelector('.word-text');
  if (textEl) textEl.style.filter = `blur(${blur}px)`;

  if (clickCounts[kw.id] >= needed) {
    logEvent('level3_word_captured', { wordId: kw.id });
    captureWord(kw, el, data, false);
  }
}

function captureWord(kw, el, data, isRestore) {
  const state = getState();
  const captured = state.level3.capturedWords || [];

  el.classList.add('captured');
  revealHeartSegment(kw.id);

  if (!captured.includes(kw.id)) {
    captured.push(kw.id);
    setState({ level3: { capturedWords: captured } });
  }

  // Recompute layout for all captured words (ensures even spacing)
  computeCapturedLayout(data);

  // Apply positions to all captured words
  for (const id of Object.keys(computedPositions)) {
    const pos = computedPositions[id];
    const wordEl = wordEls[id];
    if (!wordEl) continue;
    wordEl.style.fontSize = pos.size + 'rem';
    const elW = wordEl.offsetWidth / 2;
    const elH = wordEl.offsetHeight / 2;
    wordEl.style.left = (pos.x - elW) + 'px';
    wordEl.style.top = (pos.y - elH) + 'px';
  }

  updateProgress(data);

  if (captured.length >= data.keywords.length) {
    logEvent('level3_completed');
    onAllCaptured(data);
  }
}

function releaseWord(kw, el, data) {
  if (allCaptured) return;

  el.classList.remove('captured', 'clicked');
  el.style.fontSize = '';
  const textEl = el.querySelector('.word-text');
  if (textEl) textEl.style.filter = '';
  clickCounts[kw.id] = 0;
  hideHeartSegment(kw.id);
  const badge = el.querySelector('.click-badge');
  badge.textContent = `0/${isAdmin ? 1 : CLICKS_NEEDED}`;

  const x = Math.random() * (window.innerWidth - 150);
  const y = 100 + Math.random() * (window.innerHeight - 200);
  el.style.left = x + 'px';
  el.style.top = y + 'px';

  const speed = 0.15 + Math.random() * 0.35;
  const angle = Math.random() * Math.PI * 2;
  wordVelocities[kw.id] = {
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed
  };

  const state = getState();
  const captured = (state.level3.capturedWords || []).filter(id => id !== kw.id);
  setState({ level3: { capturedWords: captured } });
  delete computedPositions[kw.id];

  // Recompute layout for remaining captured words
  computeCapturedLayout(data);
  for (const id of Object.keys(computedPositions)) {
    const pos = computedPositions[id];
    const wordEl = wordEls[id];
    if (!wordEl) continue;
    const elW = wordEl.offsetWidth / 2;
    const elH = wordEl.offsetHeight / 2;
    wordEl.style.left = (pos.x - elW) + 'px';
    wordEl.style.top = (pos.y - elH) + 'px';
  }

  updateProgress(data);
}

function updateProgress(data) {
  const state = getState();
  const captured = state.level3.capturedWords || [];
  const progressEl = document.querySelector('.level3-progress');
  if (progressEl) {
    progressEl.textContent = `${captured.length} / ${data.keywords.length} words captured`;
  }
}

function onAllCaptured(data, isRestore = false) {
  allCaptured = true;

  data.keywords.forEach((kw) => {
    const el = wordEls[kw.id];
    if (el) el.classList.add('locked');
  });

  // Add glow to all captured words and heart outline
  Object.values(wordEls).forEach(el => el.classList.add('glowing'));
  const heartSvg = document.querySelector('.heart-outline-svg');
  if (heartSvg) heartSvg.classList.add('complete');

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  // On restore, show the gift box quickly; otherwise wait the full delay
  setTimeout(() => showGiftBox(), isRestore ? 800 : GIFT_DELAY);
}

function showGiftBox() {
  Object.values(wordEls).forEach(el => {
    el.style.transition = 'opacity 1s ease';
    el.style.opacity = '0';
  });

  const heartSvg = document.querySelector('.heart-outline-svg');
  if (heartSvg) { heartSvg.style.transition = 'opacity 1s ease'; heartSvg.style.opacity = '0'; }

  const subtitle = document.querySelector('.level3-subtitle');
  const progress = document.querySelector('.level3-progress');
  if (subtitle) subtitle.style.opacity = '0';
  if (progress) progress.style.opacity = '0';

  setTimeout(() => {
    const giftContainer = document.querySelector('.gift-box-container');
    giftContainer.classList.add('visible');

    setTimeout(() => {
      giftContainer.classList.add('open');

      const sparkles = ['✨', '💖', '🌟', '💕', '⭐'];
      sparkles.forEach((s, i) => {
        setTimeout(() => {
          const sparkle = document.createElement('span');
          sparkle.className = 'gift-sparkle';
          sparkle.textContent = s;
          sparkle.style.left = (50 + Math.random() * 40) + 'px';
          sparkle.style.top = '10px';
          giftContainer.querySelector('.gift-box').appendChild(sparkle);
        }, i * 300);
      });

      setTimeout(() => {
        const msg = document.querySelector('.gift-message');
        if (msg) msg.classList.add('visible');

        const btn = document.getElementById('level3-restart');
        if (btn) btn.classList.add('visible');
      }, 2000);
    }, 1000);
  }, 1200);
}
