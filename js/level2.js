import { getState, setState } from './state.js';
import { isAdmin } from './admin.js';
import { logEvent } from './analytics.js';

let selectedDate = null;
let selectedPhoto = null;
let locked = false;
let pairs = [];
let matchedIds = [];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function updateProgress() {
  const el = document.getElementById('level2-progress');
  if (el) el.textContent = `${matchedIds.length} of ${pairs.length} pairs matched`;
}

function createCard(type, pair) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.pairId = pair.id;
  card.dataset.type = type;

  const inner = document.createElement('div');
  inner.className = 'card-inner';

  const back = document.createElement('div');
  back.className = 'card-back';
  back.textContent = isAdmin ? pair.id.replace('p', '') : '?';

  const front = document.createElement('div');
  if (type === 'date') {
    front.className = 'card-front date-face';
    front.textContent = pair.date;
  } else {
    front.className = 'card-front photo-face';
    if (pair.photo) {
      const img = document.createElement('img');
      img.className = 'card-photo';
      img.src = `photos/level2/${pair.photo}`;
      img.alt = pair.caption;
      img.draggable = false;
      front.appendChild(img);
    }
    const emoji = document.createElement('span');
    emoji.className = 'card-emoji';
    emoji.textContent = pair.emoji;
    front.appendChild(emoji);
  }

  inner.append(back, front);
  card.appendChild(inner);
  card.addEventListener('click', () => handleCardClick(card));
  return card;
}

function handleCardClick(card) {
  if (locked) return;
  if (card.classList.contains('flipped') || card.classList.contains('matched')) return;

  const type = card.dataset.type;

  // Only allow one of each type selected at a time
  if (type === 'date' && selectedDate) return;
  if (type === 'photo' && selectedPhoto) return;

  card.classList.add('flipped');

  if (type === 'date') {
    selectedDate = card;
  } else {
    selectedPhoto = card;
  }

  if (selectedDate && selectedPhoto) {
    locked = true;
    checkMatch(selectedDate, selectedPhoto);
  }
}

function checkMatch(dateCard, photoCard) {
  const isMatch = dateCard.dataset.pairId === photoCard.dataset.pairId;

  if (isMatch) {
    dateCard.classList.add('matched');
    photoCard.classList.add('matched');
    const pairId = dateCard.dataset.pairId;
    matchedIds.push(pairId);
    logEvent('level2_pair_matched', { pairId });
    setState({ level2: { matchedPairs: matchedIds } });
    updateProgress();
    revealTimelineNode(pairId);
    selectedDate = null;
    selectedPhoto = null;
    locked = false;

    if (matchedIds.length === pairs.length) {
      logEvent('level2_completed');
      setTimeout(onAllMatched, 800);
    }
  } else {
    dateCard.classList.add('mismatch');
    photoCard.classList.add('mismatch');
    setTimeout(() => {
      dateCard.classList.remove('flipped', 'mismatch');
      photoCard.classList.remove('flipped', 'mismatch');
      selectedDate = null;
      selectedPhoto = null;
      locked = false;
    }, 2500);
  }
}

function buildTimeline() {
  const container = document.getElementById('level2-timeline');
  container.classList.add('visible');

  // Clear existing nodes (keep the line)
  container.querySelectorAll('.timeline-node').forEach(n => n.remove());

  // Create fixed slots for all pairs in order
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const node = document.createElement('div');
    node.className = `timeline-node ${i % 2 === 1 ? 'right' : ''}`;
    node.dataset.pairId = pair.id;

    const photoHtml = pair.photo
      ? `<img class="timeline-node-photo" src="photos/level2/${pair.photo}" alt="${pair.caption}" draggable="false">`
      : `<span class="timeline-node-emoji">${pair.emoji}</span>`;

    node.innerHTML = `
      <div class="timeline-node-dot"></div>
      <div class="timeline-node-date">${pair.date}</div>
      <div class="timeline-node-card">
        ${photoHtml}
        <span class="timeline-node-caption">${pair.caption}</span>
      </div>
    `;

    if (matchedIds.includes(pair.id)) {
      node.classList.add('visible');
    }

    container.appendChild(node);
  }
}

function revealTimelineNode(pairId) {
  const container = document.getElementById('level2-timeline');
  container.classList.add('visible');
  const node = container.querySelector(`.timeline-node[data-pair-id="${pairId}"]`);
  if (node) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        node.classList.add('visible');
        setTimeout(() => {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      });
    });
  }
}

function onAllMatched() {
  const gameArea = document.querySelector('.game-area');
  if (gameArea) gameArea.style.display = 'none';

  const cta = document.getElementById('level2-cta');
  if (cta) cta.removeAttribute('hidden');
}

function restoreState(dateGrid, photoGrid) {
  const state = getState();
  const saved = state.level2.matchedPairs || [];
  matchedIds = [...saved];

  if (matchedIds.length > 0) {
    const allCards = [...dateGrid.querySelectorAll('.card'), ...photoGrid.querySelectorAll('.card')];
    for (const card of allCards) {
      if (matchedIds.includes(card.dataset.pairId)) {
        card.classList.add('flipped', 'matched');
      }
    }

    if (matchedIds.length === pairs.length) {
      const gameArea = document.querySelector('.game-area');
      if (gameArea) gameArea.style.display = 'none';
      document.getElementById('level2-cta')?.removeAttribute('hidden');
    }
  }

  updateProgress();
}

export function initLevel2(data) {
  pairs = data.pairs;

  const container = document.getElementById('level-2');
  const shuffledDates = shuffle(pairs);
  const shuffledPhotos = shuffle(pairs);

  container.innerHTML = `
    <div class="level2-background"></div>
    <h1 class="level2-title">${data.title}</h1>
    <p id="level2-progress" class="progress-indicator"></p>
    <p class="subtitle">${data.subtitle}</p>
    <div class="game-area">
      <div class="grid-column">
        <div class="grid-label">Dates</div>
        <div class="card-grid" id="date-grid"></div>
      </div>
      <div class="grid-column">
        <div class="grid-label">Memories</div>
        <div class="card-grid" id="photo-grid"></div>
      </div>
    </div>
    <div class="timeline-container" id="level2-timeline">
      <div class="timeline-line"></div>
    </div>
    <button id="level2-cta" class="cta-button" hidden>${data.ctaText}</button>
    <button class="go-top-btn" id="go-top-btn" aria-label="Go to top">&uarr;</button>
  `;

  const dateGrid = document.getElementById('date-grid');
  const photoGrid = document.getElementById('photo-grid');

  for (const pair of shuffledDates) {
    dateGrid.appendChild(createCard('date', pair));
  }
  for (const pair of shuffledPhotos) {
    photoGrid.appendChild(createCard('photo', pair));
  }

  restoreState(dateGrid, photoGrid);
  buildTimeline();

  // Go-to-top button
  const goTopBtn = document.getElementById('go-top-btn');
  goTopBtn.addEventListener('click', () => {
    container.scrollTo({ top: 0, behavior: 'smooth' });
  });

  container.addEventListener('scroll', () => {
    if (container.scrollTop > 200) {
      goTopBtn.classList.add('visible');
    } else {
      goTopBtn.classList.remove('visible');
    }
  });
}
