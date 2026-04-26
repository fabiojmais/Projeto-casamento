/* ══════════════════════════════════════════
⚙️  CONFIGURAÇÕES — DADOS REAIS
══════════════════════════════════════════ */
const CONFIG = {
  PIX_KEY: '79593049630',
  PIX_NAME: 'Aline Cristina',
  PIX_CITY: 'Patrocinio',
  SHEET_ID: '1dpfOiA3-uXsoyvXDT8ZoIF-y-vIpRZB-GR8m5IrqggU',
  CATEGORY_ICON: {
    'Eletrodomésticos': '🏠', 'Eletrônicos': '💻', 'Decoração': '🪴',
    'Cama, Mesa e Banho': '🛏', 'Cozinha': '🍳', 'Viagem': '✈️', 'Utilidades': '🔧',
  },
};

/* ══════════════════════════════════════════
📦  BUSCA DADOS DO GOOGLE SHEETS
══════════════════════════════════════════ */
const BASE = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}`;
// 🔧 Corrigida concatenação de strings para evitar erros de sintaxe
const SHEET_URLS = [
  `${BASE}/gviz/tq?tqx=out:json&headers=1`,
  `${BASE}/gviz/tq?tqx=out:json&headers=1&sheet=P%C3%A1gina1`,
  `${BASE}/gviz/tq?tqx=out:json&headers=1&sheet=Sheet1`,
  `${BASE}/gviz/tq?tqx=out:json&headers=1&gid=0`,
];

let allGifts = [];
let activeCategory = 'Todos';

async function loadGifts() {
  let lastError = null;
  for (const url of SHEET_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text || text.includes('"errors"')) continue;
      
      const jsonStr = text.replace(/^[\s\S]*?setResponse\(/, '').replace(/\s*\);\s*$/, '').trim();
      const json = JSON.parse(jsonStr);

      if (!json.table || !json.table.rows) continue;

      allGifts = json.table.rows
        .map(row => ({
          categoria: cell(row, 0),
          nome:      cell(row, 1),
          valor:     cellNum(row, 2),
          foto:      cell(row, 3),
          status:    cell(row, 4),
          comprado:  cell(row, 5).toLowerCase() === 'sim',
        }))
        .filter(g => g.nome);

      if (allGifts.length === 0) continue;

      buildFilters();
      renderGifts(allGifts);
      return;

    } catch (err) {
      lastError = err;
      console.warn('Tentativa falhou:', url, err.message);
    }
  }
  console.error('Erro ao carregar planilha:', lastError);
  // 🔧 Template literal corrigido
  document.getElementById('gifts-container').innerHTML = 
    `<div style="text-align:center;padding:5rem 2rem;max-width:480px;margin:0 auto;">
      <p style="font-size:2rem;margin-bottom:1.5rem;">⚠️</p>
      <p style="color:var(--gold);font-size:0.7rem;letter-spacing:0.3em;text-transform:uppercase;margin-bottom:1rem;">Atenção</p>
      <p style="color:var(--muted);font-size:0.85rem;line-height:1.8;">
        Não foi possível carregar os presentes.<br><br>
        Certifique-se de que a planilha está compartilhada como<br>
        <strong style="color:var(--cream);">"Qualquer pessoa com o link → Visualizador"</strong><br><br>
        <a href="https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}" target="_blank" style="color:var(--gold);font-size:0.75rem;letter-spacing:0.2em;">Abrir planilha ↗</a>
      </p>
    </div>`;
}

function cell(row, i) {
  return row.c && row.c[i] && row.c[i].v != null ? String(row.c[i].v).trim() : '';
}
function cellNum(row, i) {
  if (!row.c || !row.c[i] || row.c[i].v == null) return 0;
  const v = Number(row.c[i].v);
  return isNaN(v) ? 0 : v;
}

/* ══════════════════════════════════════════
🏷️  FILTROS POR CATEGORIA
══════════════════════════════════════════ */
function buildFilters() {
  const cats = ['Todos', ...new Set(allGifts.map(g => g.categoria).filter(Boolean))];
  const container = document.getElementById('filters');
  // Mantém o botão de presente livre existente
  const freeBtn = container.querySelector('#btn-free-gift');
  container.innerHTML = '';
  if(freeBtn) container.appendChild(freeBtn);

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (cat === 'Todos' ? ' active' : '');
    btn.dataset.cat = cat;
    btn.textContent = cat === 'Todos' ? '✦ Todos' : cat;
    btn.addEventListener('click', () => {
      activeCategory = cat;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filtered = cat === 'Todos' ? allGifts : allGifts.filter(g => g.categoria === cat);
      renderGifts(filtered);
    });
    container.appendChild(btn);
  });
}

/* ══════════════════════════════════════════
🃏  RENDERIZA CARDS
══════════════════════════════════════════ */
function renderGifts(list) {
  const container = document.getElementById('gifts-container');
  if (!list.length) {
    container.innerHTML = `<p style="text-align:center;padding:4rem;color:var(--muted);">Nenhum presente encontrado.</p>`;
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'gifts-grid';
  
  list.forEach((gift, i) => {
    const card = document.createElement('div');
    card.className = 'gift-card card-enter' + (gift.comprado ? ' comprado' : '');
    card.style.animationDelay = `${i * 0.06}s`;
    card.style.opacity = '0';
    
    const icon = CONFIG.CATEGORY_ICON[gift.categoria] || '🎁';
    const imageHTML = gift.foto
      ? `<img class="gift-image" src="${gift.foto}" alt="${gift.nome}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
         <div class="gift-image-placeholder" style="display:none">${icon}</div>`
      : `<div class="gift-image-placeholder">${icon}</div>`;

    const valorFormatado = gift.valor
      ? gift.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'A combinar';

    card.innerHTML = `
      ${imageHTML}
      <div class="gift-body">
        <p class="gift-category">${gift.categoria}</p>
        <h3 class="gift-name">${gift.nome}</h3>
        <div class="gift-footer">
          <div class="gift-value">
            <span class="gift-value-label">Valor estimado</span>
            <strong>${valorFormatado}</strong>
          </div>
          <button class="btn-pix" ${gift.comprado ? 'disabled' : ''} data-name="${gift.nome}" data-value="${gift.valor}">
            PIX ✦
          </button>
        </div>
      </div>`;
    grid.appendChild(card);
  });
  
  container.innerHTML = '';
  container.appendChild(grid);
  
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.btn-pix');
    if (btn && !btn.disabled) openModal(btn.dataset.name, parseFloat(btn.dataset.value) || 0);
  });
}

/* ══════════════════════════════════════════
💸  GERADOR DE PAYLOAD PIX (EMV)
══════════════════════════════════════════ */
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return ((crc & 0xFFFF).toString(16).toUpperCase()).padStart(4, '0');
}

function emv(id, value) {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function buildPixPayload(key, name, city, valor, txId = '***') {
  const merchantInfo = emv('00', 'BR.GOV.BCB.PIX') + emv('01', key);
  const payload =
    emv('00', '01') +
    emv('26', merchantInfo) +
    emv('52', '0000') +
    emv('53', '986') +
    (valor > 0 ? emv('54', valor.toFixed(2)) : '') +
    emv('58', 'BR') +
    emv('59', name.substring(0, 25)) +
    emv('60', city.substring(0, 15)) +
    emv('62', emv('05', txId));
  return payload + emv('63', crc16(payload + '6304'));
}

/* ══════════════════════════════════════════
📲  MODAL & PRESENTE LIVRE
══════════════════════════════════════════ */
const overlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const btnCopy = document.getElementById('btn-copy');

function openModal(name, value) {
  document.getElementById('modal-name').textContent = name;
  document.getElementById('modal-val').textContent = value
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Valor livre';
  document.getElementById('modal-key').textContent = CONFIG.PIX_KEY;
  
  const qrContainer = document.getElementById('qr-canvas');
  qrContainer.innerHTML = '';
  
  const payload = buildPixPayload(CONFIG.PIX_KEY, CONFIG.PIX_NAME, CONFIG.PIX_CITY, value);
  new QRCode(qrContainer, {
    text: payload,
    width: 200,
    height: 200,
    colorDark: '#1a1612',
    colorLight: '#fdfaf5',
    correctLevel: QRCode.CorrectLevel.M,
  });
  
  btnCopy.textContent = 'Copiar chave PIX';
  btnCopy.classList.remove('copied');
  btnCopy.onclick = () => {
    navigator.clipboard.writeText(CONFIG.PIX_KEY).then(() => {
      btnCopy.textContent = '✓ Chave copiada!';
      btnCopy.classList.add('copied');
      setTimeout(() => {
        btnCopy.textContent = 'Copiar chave PIX';
        btnCopy.classList.remove('copied');
      }, 2500);
    });
  };
  
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// 🆕 Evento para Presente Livre
document.getElementById('btn-free-gift').addEventListener('click', () => {
  openModal('Presente Livre / Valor Livre', 0);
});

/* ══════════════════════════════════════════
🎁  DADOS DE DEMONSTRAÇÃO
══════════════════════════════════════════ */
const DEMO_GIFTS = [
  { categoria: 'Eletrodomésticos', nome: 'Air Fryer',   valor: 0, foto: '', status: 'Disponível', comprado: false },
  { categoria: 'Eletrodomésticos', nome: 'Geladeira',   valor: 0, foto: '', status: 'Disponível', comprado: false },
  { categoria: 'Eletrônicos',      nome: 'TV',          valor: 0, foto: '', status: 'Disponível', comprado: false },
  { categoria: 'Decoração',        nome: 'Quadros',     valor: 0, foto: '', status: 'Disponível', comprado: false },
];

/* ══════════════════════════════════════════
🚀  INIT
══════════════════════════════════════════ */
allGifts = DEMO_GIFTS;
buildFilters();
renderGifts(allGifts);
loadGifts();

// 🆕 Ano dinâmico no footer
document.getElementById('current-year').textContent = new Date().getFullYear();