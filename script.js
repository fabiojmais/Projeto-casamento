/* ══════════════════════════════════════════════════════
   ⚙️  CONFIGURAÇÕES — DADOS REAIS
══════════════════════════════════════════════════════ */
const CONFIG = {
  PIX_KEY:  '79593049630',
  PIX_NAME: 'Aline Cristina',
  PIX_CITY: 'Patrocinio',
  SHEET_ID: '1dpfOiA3-uXsoyvXDT8ZoIF-y-vIpRZB-GR8m5IrqggU',
  CATEGORY_ICON: {
    'Eletrodomésticos':   '🏠',
    'Eletrônicos':        '💻',
    'Decoração':          '🪴',
    'Cama, Mesa e Banho': '🛏',
    'Cozinha':            '🍳',
    'Viagem':             '✈️',
    'Utilidades':         '🔧',
  },
};

/* ══════════════════════════════════════════════════════
   📦  BUSCA DADOS DO GOOGLE SHEETS
══════════════════════════════════════════════════════ */
const BASE = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}`;
const SHEET_URLS = [
  `${BASE}/gviz/tq?tqx=out:json&headers=1`,
  `${BASE}/gviz/tq?tqx=out:json&headers=1&sheet=P%C3%A1gina1`,
  `${BASE}/gviz/tq?tqx=out:json&headers=1&sheet=Sheet1`,
  `${BASE}/gviz/tq?tqx=out:json&headers=1&gid=0`,
];

let allGifts       = [];
let activeCategory = 'Todos';
let hideGiven      = false;

async function loadGifts() {
  let lastError = null;
  for (const url of SHEET_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text || text.includes('"errors"')) continue;
      const jsonStr = text
        .replace(/^[\s\S]*?setResponse\(/, '')
        .replace(/\s*\);\s*$/, '')
        .trim();
      const json = JSON.parse(jsonStr);
      if (!json.table || !json.table.rows) continue;
      const fetched = json.table.rows
        .map(row => ({
          categoria: cell(row, 0),
          nome:      cell(row, 1),
          valor:     cellNum(row, 2),
          foto:      cell(row, 3),
          status:    cell(row, 4),
          comprado:  cell(row, 5).toLowerCase() === 'sim',
        }))
        .filter(g => g.nome);
      if (fetched.length === 0) continue;
      allGifts = fetched;
      buildFilters();
      updateProgress();
      const container = document.getElementById('gifts-container');
      container.style.transition = 'opacity 0.3s ease';
      container.style.opacity    = '0';
      await delay(300);
      applyFiltersAndRender();
      container.style.opacity = '1';
      return;
    } catch (err) {
      lastError = err;
      console.warn('Tentativa falhou:', url, err?.message ?? err);
    }
  }
  console.error('Erro ao carregar planilha:', lastError);
  showSheetError();
}

function showSheetError() {
  document.getElementById('gifts-container').innerHTML = `
    <div class="gifts-empty">
      <p style="font-size:2rem;margin-bottom:1.2rem;">⚠️</p>
      <p style="color:var(--gold);font-size:0.68rem;letter-spacing:0.3em;text-transform:uppercase;margin-bottom:1rem;">Atenção</p>
      <p>
        Não foi possível carregar os presentes.<br><br>
        Certifique-se de que a planilha está compartilhada como<br>
        <strong style="color:var(--cream);">"Qualquer pessoa com o link → Visualizador"</strong>
      </p>
      <a href="https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}"
        target="_blank" rel="noopener noreferrer"
        style="display:inline-block;margin-top:1.5rem;color:var(--gold);font-size:0.72rem;letter-spacing:0.2em;"
      >Abrir planilha ↗</a>
    </div>`;
}

function cell(row, i) {
  return row.c?.[i]?.v != null ? String(row.c[i].v).trim() : '';
}
function cellNum(row, i) {
  if (row.c?.[i]?.v == null) return 0;
  const v = Number(row.c[i].v);
  return isNaN(v) ? 0 : v;
}
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/* ══════════════════════════════════════════════════════
   1️⃣  BARRA DE PROGRESSO
══════════════════════════════════════════════════════ */
function updateProgress() {
  const total   = allGifts.length;
  const given   = allGifts.filter(g => g.comprado).length;
  const percent = total > 0 ? Math.round((given / total) * 100) : 0;
  const bar     = document.getElementById('progress-bar-fill');
  const label   = document.getElementById('progress-label');
  const counter = document.getElementById('progress-counter');
  if (!bar) return;
  bar.style.width = percent + '%';
  if (label)   label.textContent   = `${given} de ${total} presentes já foram dados`;
  if (counter) counter.textContent = percent + '%';
}


/* ══════════════════════════════════════════════════════
   🏷️  FILTROS POR CATEGORIA
══════════════════════════════════════════════════════ */
function buildFilters() {
  const cats      = ['Todos', ...new Set(allGifts.map(g => g.categoria).filter(Boolean))];
  const container = document.getElementById('filters');
  container.innerHTML = '';

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = 'filter-btn' + (cat === activeCategory ? ' active' : '');
    btn.dataset.cat = cat;
    btn.textContent = cat === 'Todos' ? '✦ Todos' : cat;
    btn.addEventListener('click', () => {
      activeCategory = cat;
      document.querySelectorAll('.filter-btn:not(.btn-free-gift):not(.btn-toggle-given)').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFiltersAndRender();
    });
    container.appendChild(btn);
  });

  /* #9 — Toggle disponíveis */
  const toggleBtn = document.createElement('button');
  toggleBtn.id        = 'btn-toggle-given';
  toggleBtn.className = 'filter-btn btn-toggle-given' + (hideGiven ? ' active' : '');
  toggleBtn.innerHTML = hideGiven ? '👁 Mostrar todos' : '✦ Apenas disponíveis';
  toggleBtn.addEventListener('click', () => {
    hideGiven = !hideGiven;
    toggleBtn.innerHTML = hideGiven ? '👁 Mostrar todos' : '✦ Apenas disponíveis';
    toggleBtn.classList.toggle('active', hideGiven);
    applyFiltersAndRender();
  });
  container.appendChild(toggleBtn);

  /* Presente Livre — sempre ao final */
  const freeBtn = document.createElement('button');
  freeBtn.id          = 'btn-free-gift';
  freeBtn.className   = 'filter-btn btn-free-gift';
  freeBtn.textContent = '🎁 Presente Livre';
  freeBtn.addEventListener('click', () => openModal('Presente Livre', 0));
  container.appendChild(freeBtn);
}

/* Centraliza toda lógica de filtro + busca */
function applyFiltersAndRender() {
  const input = document.getElementById('search-input');
  const query = input ? input.value.trim().toLowerCase() : '';
  let list = activeCategory === 'Todos'
    ? allGifts
    : allGifts.filter(g => g.categoria === activeCategory);
  if (hideGiven) list = list.filter(g => !g.comprado);
  if (query)     list = list.filter(g => g.nome.toLowerCase().includes(query));
  renderGifts(list);
}


/* ══════════════════════════════════════════════════════
   3️⃣  CAMPO DE BUSCA
══════════════════════════════════════════════════════ */
function buildSearch() {
  const wrap = document.getElementById('search-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="search-box">
      <span class="search-icon" aria-hidden="true">✦</span>
      <input
        type="search"
        id="search-input"
        class="search-input"
        placeholder="Buscar presente…"
        aria-label="Buscar presente por nome"
        autocomplete="off"
      />
      <button class="search-clear" id="search-clear" aria-label="Limpar busca" hidden>✕</button>
    </div>`;
  const input    = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  input.addEventListener('input', () => {
    clearBtn.hidden = !input.value.trim();
    applyFiltersAndRender();
  });
  clearBtn.addEventListener('click', () => {
    input.value     = '';
    clearBtn.hidden = true;
    input.focus();
    applyFiltersAndRender();
  });
}


/* ══════════════════════════════════════════════════════
   5️⃣  INTERSECTION OBSERVER PARA CARDS
══════════════════════════════════════════════════════ */
const cardObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('card-visible');
      cardObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });


/* ══════════════════════════════════════════════════════
   🃏  RENDERIZA CARDS  (com skeleton #6)
══════════════════════════════════════════════════════ */
function renderGifts(list) {
  const container = document.getElementById('gifts-container');
  container.removeAttribute('role');

  if (!list.length) {
    container.innerHTML = `<p class="gifts-empty">Nenhum presente encontrado nesta categoria.</p>`;
    return;
  }

  /* Skeleton enquanto monta */
  container.innerHTML = buildSkeletons(Math.min(list.length, 6));

  requestAnimationFrame(() => {
    const grid = document.createElement('div');
    grid.className = 'gifts-grid';

    list.forEach((gift) => {
      const card     = document.createElement('div');
      card.className = `gift-card card-io${gift.comprado ? ' comprado' : ''}`;

      const icon     = CONFIG.CATEGORY_ICON[gift.categoria] ?? '🎁';
      const imgSafe  = escapeAttr(gift.foto);
      const nameSafe = escapeHtml(gift.nome);
      const catSafe  = escapeHtml(gift.categoria);

      const imageHTML = gift.foto
        ? `<img class="gift-image" src="${imgSafe}" alt="Foto de ${nameSafe}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
           <div class="gift-image-placeholder" style="display:none" aria-hidden="true">${icon}</div>`
        : `<div class="gift-image-placeholder" aria-hidden="true">${icon}</div>`;

      const valorFormatado = gift.valor > 0
        ? gift.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : 'A combinar';

      card.innerHTML = `
        ${imageHTML}
        <div class="gift-body">
          <p class="gift-category">${catSafe}</p>
          <h3 class="gift-name">${nameSafe}</h3>
          <div class="gift-footer">
            <div class="gift-value">
              <span class="gift-value-label">Valor estimado</span>
              <strong>${valorFormatado}</strong>
            </div>
            <div class="gift-actions">
              <button class="btn-share" data-name="${escapeAttr(gift.nome)}"
                aria-label="Compartilhar ${nameSafe}" title="Compartilhar este presente">⬆</button>
              <button class="btn-pix"
                ${gift.comprado ? 'disabled aria-disabled="true"' : ''}
                data-name="${escapeAttr(gift.nome)}" data-value="${gift.valor}"
                aria-label="Presentear ${nameSafe} via PIX">PIX ✦</button>
            </div>
          </div>
        </div>`;

      grid.appendChild(card);
      cardObserver.observe(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);

    grid.addEventListener('click', e => {
      const pixBtn   = e.target.closest('.btn-pix');
      const shareBtn = e.target.closest('.btn-share');
      if (pixBtn && !pixBtn.disabled) {
        openModal(pixBtn.dataset.name, parseFloat(pixBtn.dataset.value) || 0);
      } else if (shareBtn) {
        shareGift(shareBtn.dataset.name);
      }
    });
  });
}

/* Gera HTML de skeletons (#6) */
function buildSkeletons(n) {
  let html = '<div class="gifts-grid">';
  for (let i = 0; i < n; i++) {
    html += `
      <div class="gift-card gift-skeleton">
        <div class="skel skel-image"></div>
        <div class="gift-body">
          <div class="skel skel-cat"></div>
          <div class="skel skel-name"></div>
          <div class="gift-footer">
            <div class="skel skel-value"></div>
            <div class="skel skel-btn"></div>
          </div>
        </div>
      </div>`;
  }
  return html + '</div>';
}


/* ══════════════════════════════════════════════════════
   2️⃣  COMPARTILHAR PRESENTE
══════════════════════════════════════════════════════ */
function shareGift(name) {
  const url  = window.location.href.split('?')[0];
  const text = `Vou presentear "${name}" para o casamento de Aline & Raul! 💛\n${url}`;
  if (navigator.share) {
    navigator.share({ title: 'Lista de Presentes — Aline & Raul', text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Mensagem copiada! Cole no WhatsApp ou onde quiser 💛');
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      showToast('Mensagem copiada! Cole no WhatsApp ou onde quiser 💛');
    });
  }
}


/* ══════════════════════════════════════════════════════
   8️⃣  TOAST DE FEEDBACK
══════════════════════════════════════════════════════ */
let toastTimer = null;
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove('toast-hide');
  toast.classList.add('toast-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
  }, 3200);
}


/* ══════════════════════════════════════════════════════
   💸  PIX PAYLOAD (EMV / BACEN)
══════════════════════════════════════════════════════ */
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}
function emv(id, value) {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}
function buildPixPayload(key, name, city, valor, txId = '***') {
  const merchantInfo = emv('00', 'BR.GOV.BCB.PIX') + emv('01', key);
  const payload =
    emv('00', '01') + emv('26', merchantInfo) + emv('52', '0000') + emv('53', '986') +
    (valor > 0 ? emv('54', valor.toFixed(2)) : '') +
    emv('58', 'BR') + emv('59', name.substring(0, 25)) +
    emv('60', city.substring(0, 15)) + emv('62', emv('05', txId));
  return payload + emv('63', crc16(payload + '6304'));
}


/* ══════════════════════════════════════════════════════
   📲  MODAL PIX & FOCUS TRAP
══════════════════════════════════════════════════════ */
const overlay    = document.getElementById('modal-overlay');
const modalEl    = overlay.querySelector('.modal');
const modalClose = document.getElementById('modal-close');
const btnCopy    = document.getElementById('btn-copy');
let previouslyFocused = null;

function openModal(name, value) {
  previouslyFocused = document.activeElement;
  document.getElementById('modal-title').textContent = name;
  document.getElementById('modal-val').textContent   = value > 0
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Valor livre';
  document.getElementById('modal-key').textContent = CONFIG.PIX_KEY;
  const qrLoader    = document.getElementById('qr-loader');
  const qrContainer = document.getElementById('qr-canvas');
  qrContainer.innerHTML = '';
  qrLoader.classList.remove('hidden');
  setTimeout(() => {
    const payload = buildPixPayload(CONFIG.PIX_KEY, CONFIG.PIX_NAME, CONFIG.PIX_CITY, value);
    new QRCode(qrContainer, {
      text: payload, width: 200, height: 200,
      colorDark: '#1a1612', colorLight: '#fdfaf5',
      correctLevel: QRCode.CorrectLevel.M,
    });
    qrLoader.classList.add('hidden');
  }, 100);
  btnCopy.textContent = 'Copiar chave PIX';
  btnCopy.classList.remove('copied');
  overlay.removeAttribute('hidden');
  requestAnimationFrame(() => overlay.classList.add('open'));
  document.body.style.overflow = 'hidden';
  setTimeout(() => modalClose.focus(), 50);
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => {
    overlay.setAttribute('hidden', '');
    previouslyFocused?.focus();
  }, 400);
}

function getFocusableElements() {
  return Array.from(modalEl.querySelectorAll(
    'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )).filter(el => !el.hidden && el.offsetParent !== null);
}

overlay.addEventListener('keydown', e => {
  if (!overlay.classList.contains('open')) return;
  if (e.key === 'Escape') { closeModal(); return; }
  if (e.key === 'Tab') {
    const focusable = getFocusableElements();
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else            { if (document.activeElement === last)  { e.preventDefault(); first.focus(); } }
  }
});
modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

btnCopy.addEventListener('click', () => {
  const doCopy = () => {
    btnCopy.textContent = '✓ Chave copiada!';
    btnCopy.classList.add('copied');
    showToast('Chave PIX copiada! Abra seu banco e cole no PIX 💛');
    setTimeout(() => { btnCopy.textContent = 'Copiar chave PIX'; btnCopy.classList.remove('copied'); }, 2500);
  };
  navigator.clipboard.writeText(CONFIG.PIX_KEY).then(doCopy).catch(() => {
    const tmp = document.createElement('input');
    tmp.value = CONFIG.PIX_KEY;
    document.body.appendChild(tmp); tmp.select(); document.execCommand('copy'); document.body.removeChild(tmp);
    doCopy();
  });
});


/* ══════════════════════════════════════════════════════
   🔒  HELPERS DE SEGURANÇA
══════════════════════════════════════════════════════ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}


/* ══════════════════════════════════════════════════════
   🎁  DADOS DE DEMONSTRAÇÃO (com valores e 1 comprado para demo)
══════════════════════════════════════════════════════ */
const DEMO_GIFTS = [
  { categoria: 'Eletrodomésticos', nome: 'Air Fryer',           valor: 450,  foto: '', status: 'Disponível', comprado: false },
  { categoria: 'Eletrodomésticos', nome: 'Geladeira',           valor: 3200, foto: '', status: 'Disponível', comprado: false },
  { categoria: 'Eletrônicos',      nome: 'TV 55"',              valor: 2800, foto: '', status: 'Disponível', comprado: true  },
  { categoria: 'Decoração',        nome: 'Quadros Decorativos', valor: 380,  foto: '', status: 'Disponível', comprado: false },
  { categoria: 'Cozinha',          nome: 'Jogo de Panelas',     valor: 620,  foto: '', status: 'Disponível', comprado: false },
  { categoria: 'Viagem',           nome: 'Lua de Mel',          valor: 0,    foto: '', status: 'Disponível', comprado: false },
];


/* ══════════════════════════════════════════════════════
   ✨  PARTÍCULAS DOURADAS
══════════════════════════════════════════════════════ */
function spawnPhotoParticles() {
  const photo = document.querySelector('.hero-couple-photo');
  if (!photo) return;
  const TOTAL = 14, RADIUS_MIN = 0.38, RADIUS_MAX = 0.56;
  for (let i = 0; i < TOTAL; i++) {
    const p        = document.createElement('span');
    p.className    = 'photo-particle';
    const angle    = (i / TOTAL) * 2 * Math.PI + (Math.random() * 0.6 - 0.3);
    const radius   = RADIUS_MIN + Math.random() * (RADIUS_MAX - RADIUS_MIN);
    const cx       = 50 + Math.cos(angle) * radius * 100;
    const cy       = 50 + Math.sin(angle) * radius * 100;
    const size     = 2 + Math.random() * 3;
    const tx       = (Math.cos(angle) * (4 + Math.random() * 6)).toFixed(1) + 'px';
    const ty       = (Math.sin(angle) * (4 + Math.random() * 6) - 4).toFixed(1) + 'px';
    const dur      = (2.4 + Math.random() * 2.4).toFixed(2) + 's';
    const del      = (Math.random() * 3).toFixed(2) + 's';
    Object.assign(p.style, {
      width: size+'px', height: size+'px',
      left: cx.toFixed(2)+'%', top: cy.toFixed(2)+'%',
      '--duration': dur, '--delay': del, '--tx': tx, '--ty': ty,
    });
    photo.appendChild(p);
  }
}


/* ══════════════════════════════════════════════════════
   ⏳  CONTADOR REGRESSIVO
══════════════════════════════════════════════════════ */
function initCountdown() {
  const weddingDate = new Date('2027-05-20T00:00:00');
  const el = document.getElementById('countdown');
  if (!el) return;
  function update() {
    const diff = weddingDate - new Date();
    if (diff <= 0) { el.innerHTML = `<p class="countdown-over">O grande dia chegou! 💛</p>`; return; }
    const days    = Math.floor(diff / 86400000);
    const hours   = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    el.querySelector('[data-unit="days"] .countdown-num').textContent    = String(days).padStart(3, '0');
    el.querySelector('[data-unit="hours"] .countdown-num').textContent   = String(hours).padStart(2, '0');
    el.querySelector('[data-unit="minutes"] .countdown-num').textContent = String(minutes).padStart(2, '0');
    el.querySelector('[data-unit="seconds"] .countdown-num').textContent = String(seconds).padStart(2, '0');
  }
  update();
  setInterval(update, 1000);
}


/* ══════════════════════════════════════════════════════
   🚀  INICIALIZAÇÃO
══════════════════════════════════════════════════════ */
(function init() {
  document.getElementById('current-year').textContent = new Date().getFullYear();
  const pageIntro = document.getElementById('page-intro');
  if (pageIntro) pageIntro.addEventListener('animationend', () => pageIntro.classList.add('done'));
  setTimeout(spawnPhotoParticles, 2400);
  initCountdown();
  buildSearch();
  allGifts = DEMO_GIFTS;
  buildFilters();
  updateProgress();
  applyFiltersAndRender();
  loadGifts();
})();
