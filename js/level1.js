import { getState, setState } from './state.js';
import { isAdmin } from './admin.js';
import { logEvent } from './analytics.js';

let fogCtx = null;
let fogCanvas = null;
let container = null;
let sparkleData = [];
let ctaText = '';
const BRUSH_RADIUS = 40;

export function initLevel1(data) {
  sparkleData = data.sparkles;
  ctaText = data.ctaText;

  container = document.getElementById('level-1');
  fogCanvas = document.getElementById('fog-canvas');
  fogCtx = fogCanvas.getContext('2d');

  // Set up subtitle
  const subtitle = container.querySelector('.subtitle');
  if (subtitle) subtitle.textContent = data.subtitle;

  initFogCanvas();
  createSparkleHitboxes();
  bindWipeEvents();
  restoreState();
  updateProgress();
  startFogCheckLoop();

  window.addEventListener('resize', handleResize);
}

function initFogCanvas() {
  fogCanvas.width = container.clientWidth;
  fogCanvas.height = container.clientHeight;
  fogCtx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-fog').trim() || 'rgba(40, 20, 60, 0.95)';
  fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
}

function bindWipeEvents() {
  const overlay = document.getElementById('sparkle-overlay');
  let isWiping = false;

  function wipeAt(x, y) {
    const grad = fogCtx.createRadialGradient(x, y, 0, x, y, BRUSH_RADIUS);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    fogCtx.globalCompositeOperation = 'destination-out';
    fogCtx.fillStyle = grad;
    fogCtx.beginPath();
    fogCtx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2);
    fogCtx.fill();
    fogCtx.globalCompositeOperation = 'source-over';
  }

  function getCoords(e) {
    const rect = overlay.getBoundingClientRect();
    if (e.touches) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  overlay.addEventListener('mousedown', (e) => {
    // Don't wipe if clicking sparkle hitbox
    if (e.target.classList.contains('sparkle-hitbox') ||
        e.target.closest('.sparkle-hitbox')) return;
    isWiping = true;
    const { x, y } = getCoords(e);
    wipeAt(x, y);
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isWiping) return;
    const { x, y } = getCoords(e);
    wipeAt(x, y);
  });

  overlay.addEventListener('mouseup', () => { isWiping = false; });
  overlay.addEventListener('mouseleave', () => { isWiping = false; });

  overlay.addEventListener('touchstart', (e) => {
    // Don't wipe if touching sparkle hitbox
    if (e.target.classList.contains('sparkle-hitbox') ||
        e.target.closest('.sparkle-hitbox')) return;
    e.preventDefault();
    isWiping = true;
    const { x, y } = getCoords(e);
    wipeAt(x, y);
  }, { passive: false });

  overlay.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isWiping) return;
    const { x, y } = getCoords(e);
    wipeAt(x, y);
  }, { passive: false });

  overlay.addEventListener('touchend', () => { isWiping = false; });
}

// Generate well-spaced random positions (Poisson-disc-like)
function generateSparklePositions(count) {
  const MARGIN = 0.12;     // keep away from edges (12% of each side)
  const MIN_DIST = 0.18;   // minimum distance between sparkles (as fraction of screen)
  const positions = [];

  for (let i = 0; i < count; i++) {
    let best = null;
    let bestMinDist = -1;

    // Try many candidates, pick the one farthest from its nearest neighbour
    const attempts = 80;
    for (let a = 0; a < attempts; a++) {
      const x = MARGIN + Math.random() * (1 - 2 * MARGIN);
      const y = MARGIN + Math.random() * (1 - 2 * MARGIN);

      let nearest = Infinity;
      for (const p of positions) {
        const dx = p.x - x;
        const dy = p.y - y;
        nearest = Math.min(nearest, Math.sqrt(dx * dx + dy * dy));
      }

      if (nearest > bestMinDist) {
        bestMinDist = nearest;
        best = { x, y };
      }

      // Good enough — well spaced
      if (nearest >= MIN_DIST) break;
    }

    positions.push(best);
  }

  return positions;
}

function createSparkleHitboxes() {
  const overlay = document.getElementById('sparkle-overlay');
  const w = container.clientWidth;
  const h = container.clientHeight;

  // Generate or restore positions — persist so they survive refresh
  const state = getState();
  let savedPositions = state.level1.sparklePositions || null;

  if (!savedPositions || Object.keys(savedPositions).length !== sparkleData.length) {
    const generated = generateSparklePositions(sparkleData.length);
    savedPositions = {};
    sparkleData.forEach((sparkle, i) => {
      savedPositions[sparkle.id] = { x: generated[i].x, y: generated[i].y };
    });
    setState({ level1: { sparklePositions: savedPositions } });
  }

  sparkleData.forEach((sparkle, i) => {
    const pos = savedPositions[sparkle.id] || { x: 0.5, y: 0.5 };
    sparkle.xPercent = pos.x;
    sparkle.yPercent = pos.y;

    const el = document.createElement('div');
    el.className = 'sparkle-hitbox';
    el.dataset.id = sparkle.id;
    el.style.left = `${sparkle.xPercent * w}px`;
    el.style.top = `${sparkle.yPercent * h}px`;

    if (sparkle.photo) {
      const img = document.createElement('img');
      img.className = 'sparkle-photo';
      img.src = `photos/level1/${sparkle.photo}`;
      img.alt = sparkle.label;
      img.draggable = false;
      el.appendChild(img);
    }

    const label = document.createElement('span');
    label.className = 'sparkle-label';
    label.textContent = sparkle.label;
    el.appendChild(label);

    el.addEventListener('click', (e) => {
      console.log('Sparkle clicked:', sparkle.id);
      e.stopPropagation();
      onSparkleFound(sparkle, el);
    });

    // Also handle touch tap
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSparkleFound(sparkle, el);
    });

    if (isAdmin) {
      el.style.outline = '2px solid red';
      el.style.background = 'rgba(255,0,0,0.3)';
    }

    overlay.appendChild(el);

  });
}

function onSparkleFound(sparkle, el) {
  console.log('onSparkleFound called:', sparkle.id, 'already found?', el.classList.contains('sparkle-found'));
  if (el.classList.contains('sparkle-found')) return;

  console.log('Marking sparkle as found:', sparkle.id);
  el.classList.add('sparkle-found');

  // Nudge label so it doesn't overflow the viewport on mobile
  requestAnimationFrame(() => {
    const label = el.querySelector('.sparkle-label');
    if (!label) return;
    const rect = label.getBoundingClientRect();
    if (rect.left < 4) {
      label.style.transform = `translateX(${-rect.left + 4}px)`;
    } else if (rect.right > window.innerWidth - 4) {
      label.style.transform = `translateX(${window.innerWidth - 4 - rect.right}px)`;
    }
  });

  // Update state
  const state = getState();
  if (!state.level1.foundSparkles.includes(sparkle.id)) {
    state.level1.foundSparkles.push(sparkle.id);
    setState({ level1: { foundSparkles: state.level1.foundSparkles } });
  }

  logEvent('level1_sparkle_found', { sparkleId: sparkle.id });
  spawnHeartAnimation(el);
  updateProgress();

  // Check if all found
  if (state.level1.foundSparkles.length >= sparkleData.length) {
    logEvent('level1_completed');
    showCTAButton();
    // Fade out subtitle
    const subtitle = container.querySelector('.subtitle');
    if (subtitle) subtitle.classList.add('fade-out');
  }
}

function spawnHeartAnimation(el) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const hearts = ['\u2764\uFE0F', '\u{1F497}', '\u{1F496}', '\u2728', '\u{1F49B}'];

  for (let i = 0; i < 5; i++) {
    const heart = document.createElement('div');
    heart.className = 'heart';
    heart.textContent = hearts[i % hearts.length];
    heart.style.left = `${cx}px`;
    heart.style.top = `${cy}px`;
    heart.style.setProperty('--drift-x', `${(Math.random() - 0.5) * 60}px`);
    heart.style.animationDelay = `${i * 0.1}s`;
    document.body.appendChild(heart);
    heart.addEventListener('animationend', () => heart.remove());
  }
}

function showCTAButton() {
  const btn = document.getElementById('level1-cta');
  btn.textContent = ctaText;
  btn.removeAttribute('hidden');
  btn.classList.add('fade-in');
}

function updateProgress() {
  const state = getState();
  const found = state.level1.foundSparkles.length;
  const total = sparkleData.length;
  const el = document.getElementById('level1-progress');
  if (el) {
    el.textContent = `${found} of ${total} sparkles found`;
    if (found >= total) el.style.opacity = '0';
  }
}

let resizeTimeout = null;
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // Snapshot current canvas
    const snapshot = fogCanvas.toDataURL();
    const w = container.clientWidth;
    const h = container.clientHeight;

    fogCanvas.width = w;
    fogCanvas.height = h;

    // Refill fog
    fogCtx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-fog').trim() || 'rgba(40, 20, 60, 0.95)';
    fogCtx.fillRect(0, 0, w, h);

    // Restore wiped areas
    const img = new Image();
    img.onload = () => {
      fogCtx.globalCompositeOperation = 'destination-in';
      fogCtx.drawImage(img, 0, 0, w, h);
      fogCtx.globalCompositeOperation = 'source-over';
    };
    img.src = snapshot;

    // Reposition hitboxes and hints
    const overlay = document.getElementById('sparkle-overlay');
    sparkleData.forEach((sparkle) => {
      const hitbox = overlay.querySelector(`[data-id="${sparkle.id}"]`);
      if (hitbox) {
        hitbox.style.left = `${sparkle.xPercent * w}px`;
        hitbox.style.top = `${sparkle.yPercent * h}px`;
      }
    });
  }, 150);
}

function startFogCheckLoop() {
  function checkFogClearance() {
    const overlay = document.getElementById('sparkle-overlay');
    const w = container.clientWidth;
    const h = container.clientHeight;

    sparkleData.forEach((sparkle) => {
      const hitbox = overlay.querySelector(`[data-id="${sparkle.id}"]`);
      if (!hitbox || hitbox.classList.contains('sparkle-found')) return;

      // In admin mode, always show
      if (isAdmin) {
        hitbox.classList.add('revealed');
        return;
      }

      // Check if fog is cleared at sparkle position
      const x = sparkle.xPercent * w;
      const y = sparkle.yPercent * h;

      // Sample a few points around the sparkle
      const checkRadius = 25;
      let clearedPixels = 0;
      let totalSamples = 0;

      for (let dx = -checkRadius; dx <= checkRadius; dx += 10) {
        for (let dy = -checkRadius; dy <= checkRadius; dy += 10) {
          const px = Math.floor(x + dx);
          const py = Math.floor(y + dy);
          if (px < 0 || px >= fogCanvas.width || py < 0 || py >= fogCanvas.height) continue;

          const imgData = fogCtx.getImageData(px, py, 1, 1).data;
          const alpha = imgData[3];
          totalSamples++;
          if (alpha < 128) clearedPixels++; // Consider cleared if alpha < 50%
        }
      }

      // Reveal if at least 40% of sampled area is cleared
      if (clearedPixels / totalSamples > 0.4) {
        hitbox.classList.add('revealed');
      } else {
        hitbox.classList.remove('revealed');
      }
    });

    requestAnimationFrame(checkFogClearance);
  }

  requestAnimationFrame(checkFogClearance);
}

function restoreState() {
  const state = getState();
  const overlay = document.getElementById('sparkle-overlay');
  const w = container.clientWidth;
  const h = container.clientHeight;

  state.level1.foundSparkles.forEach((id) => {
    const el = overlay.querySelector(`[data-id="${id}"]`);
    if (!el) return;
    el.classList.add('sparkle-found', 'revealed');

    // Clear fog around the found sparkle so it's visible
    const sparkle = sparkleData.find(s => s.id === id);
    if (sparkle) {
      const x = sparkle.xPercent * w;
      const y = sparkle.yPercent * h;
      const clearRadius = 60;
      const grad = fogCtx.createRadialGradient(x, y, 0, x, y, clearRadius);
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fogCtx.globalCompositeOperation = 'destination-out';
      fogCtx.fillStyle = grad;
      fogCtx.beginPath();
      fogCtx.arc(x, y, clearRadius, 0, Math.PI * 2);
      fogCtx.fill();
      fogCtx.globalCompositeOperation = 'source-over';
    }
  });

  // If all already found, show CTA
  if (state.level1.foundSparkles.length >= sparkleData.length) {
    showCTAButton();
  }
}

