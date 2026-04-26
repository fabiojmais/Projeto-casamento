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

let allGifts      = [];
let activeCategory = 'Todos';

/**
 * Tenta buscar a planilha em múltiplas URLs.
 * Ao ter sucesso, substitui os dados demo com transição suave.
 */
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

      /* ✅ MELHORIA: substituição suave — sem flash brusco */
      allGifts = fetched;
      buildFilters();

      /* Fade out do conteúdo atual antes de renderizar novos dados */
      const container = document.getElementById('gifts-container');
      container.style.transition = 'opacity 0.3s ease';
      container.style.opacity    = '0';

      await delay(300);
      renderGifts(allGifts);
      container.style.opacity = '1';
      return;

    } catch (err) {
      lastError = err;
      console.warn('Tentativa falhou:', url, err?.message ?? err);
    }
  }

  /* Todas as tentativas falharam */
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
      <a
        href="https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}"
        target="_blank"
        rel="noopener noreferrer"
        style="display:inline-block;margin-top:1.5rem;color:var(--gold);font-size:0.72rem;letter-spacing:0.2em;"
      >Abrir planilha ↗</a>
    </div>`;
}

/* Helpers de leitura de célula */
function cell(row, i) {
  return row.c?.[i]?.v != null ? String(row.c[i].v).trim() : '';
}

function cellNum(row, i) {
  if (!row.c?.[i]?.v != null) return 0;
  const v = Number(row.c[i].v);
  return isNaN(v) ? 0 : v;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


/* ══════════════════════════════════════════════════════
   🏷️  FILTROS POR CATEGORIA
   CORREÇÃO: botão "Presente Livre" é sempre adicionado por ÚLTIMO
══════════════════════════════════════════════════════ */
function buildFilters() {
  const cats = ['Todos', ...new Set(allGifts.map(g => g.categoria).filter(Boolean))];
  const container = document.getElementById('filters');
  container.innerHTML = '';

  /* Botões de categoria */
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = 'filter-btn' + (cat === activeCategory ? ' active' : '');
    btn.dataset.cat = cat;
    btn.textContent = cat === 'Todos' ? '✦ Todos' : cat;

    btn.addEventListener('click', () => {
      activeCategory = cat;
      document.querySelectorAll('.filter-btn:not(.btn-free-gift)').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filtered = cat === 'Todos' ? allGifts : allGifts.filter(g => g.categoria === cat);
      renderGifts(filtered);
    });

    container.appendChild(btn);
  });

  /* ✅ "Presente Livre" sempre ao final dos filtros */
  const freeBtn = document.createElement('button');
  freeBtn.id          = 'btn-free-gift';
  freeBtn.className   = 'filter-btn btn-free-gift';
  freeBtn.textContent = '🎁 Presente Livre';
  freeBtn.addEventListener('click', () => openModal('Presente Livre', 0));
  container.appendChild(freeBtn);
}


/* ══════════════════════════════════════════════════════
   🃏  RENDERIZA CARDS
══════════════════════════════════════════════════════ */
function renderGifts(list) {
  const container = document.getElementById('gifts-container');
  container.removeAttribute('role');   /* remove role="status" após carregamento */

  if (!list.length) {
    container.innerHTML = `<p class="gifts-empty">Nenhum presente encontrado nesta categoria.</p>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'gifts-grid';

  list.forEach((gift, i) => {
    const card = document.createElement('div');
    card.className        = `gift-card card-enter${gift.comprado ? ' comprado' : ''}`;
    card.style.animationDelay = `${i * 0.055}s`;
    card.style.opacity    = '0';

    const icon       = CONFIG.CATEGORY_ICON[gift.categoria] ?? '🎁';
    const imgSafe    = escapeAttr(gift.foto);
    const nameSafe   = escapeHtml(gift.nome);
    const catSafe    = escapeHtml(gift.categoria);

    const imageHTML = gift.foto
      ? `<img
           class="gift-image"
           src="${imgSafe}"
           alt="Foto de ${nameSafe}"
           loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
         />
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
          <button
            class="btn-pix"
            ${gift.comprado ? 'disabled aria-disabled="true"' : ''}
            data-name="${escapeAttr(gift.nome)}"
            data-value="${gift.valor}"
            aria-label="Presentear ${nameSafe} via PIX"
          >PIX ✦</button>
        </div>
      </div>`;

    grid.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(grid);

  /* Delegação de evento para os botões PIX */
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.btn-pix');
    if (btn && !btn.disabled) {
      openModal(btn.dataset.name, parseFloat(btn.dataset.value) || 0);
    }
  });
}


/* ══════════════════════════════════════════════════════
   💸  GERADOR DE PAYLOAD PIX (EMV / BACEN)
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


/* ══════════════════════════════════════════════════════
   📲  MODAL & FOCUS TRAP
   CORREÇÃO: foco preso dentro do modal para acessibilidade
══════════════════════════════════════════════════════ */
const overlay    = document.getElementById('modal-overlay');
const modalEl    = overlay.querySelector('.modal');
const modalClose = document.getElementById('modal-close');
const btnCopy    = document.getElementById('btn-copy');

let previouslyFocused = null;  /* salva elemento que tinha foco antes do modal abrir */

function openModal(name, value) {
  /* Salva foco atual */
  previouslyFocused = document.activeElement;

  /* Atualiza conteúdo do modal */
  document.getElementById('modal-title').textContent = escapeHtml(name);
  document.getElementById('modal-val').textContent   = value > 0
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Valor livre';
  document.getElementById('modal-key').textContent   = CONFIG.PIX_KEY;

  /* Mostra loader, limpa QR anterior */
  const qrLoader    = document.getElementById('qr-loader');
  const qrContainer = document.getElementById('qr-canvas');
  qrContainer.innerHTML = '';
  qrLoader.classList.remove('hidden');

  /* Gera QR Code após pequeno delay (garante que lib está carregada) */
  setTimeout(() => {
    const payload = buildPixPayload(CONFIG.PIX_KEY, CONFIG.PIX_NAME, CONFIG.PIX_CITY, value);
    new QRCode(qrContainer, {
      text:         payload,
      width:        200,
      height:       200,
      colorDark:    '#1a1612',
      colorLight:   '#fdfaf5',
      correctLevel: QRCode.CorrectLevel.M,
    });
    qrLoader.classList.add('hidden');
  }, 100);

  /* Reseta botão de cópia */
  btnCopy.textContent = 'Copiar chave PIX';
  btnCopy.classList.remove('copied');

  /* Abre modal */
  overlay.removeAttribute('hidden');
  requestAnimationFrame(() => overlay.classList.add('open'));
  document.body.style.overflow = 'hidden';

  /* Move foco para o botão fechar */
  setTimeout(() => modalClose.focus(), 50);
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';

  /* Restaura foco após transição */
  setTimeout(() => {
    overlay.setAttribute('hidden', '');
    previouslyFocused?.focus();
  }, 400);
}

/* ✅ MELHORIA: Focus Trap dentro do modal */
function getFocusableElements() {
  return Array.from(modalEl.querySelectorAll(
    'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )).filter(el => !el.hidden && el.offsetParent !== null);
}

overlay.addEventListener('keydown', e => {
  if (!overlay.classList.contains('open')) return;

  if (e.key === 'Escape') {
    closeModal();
    return;
  }

  if (e.key === 'Tab') {
    const focusable = getFocusableElements();
    if (!focusable.length) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
});

modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

/* Copiar chave PIX */
btnCopy.addEventListener('click', () => {
  navigator.clipboard.writeText(CONFIG.PIX_KEY).then(() => {
    btnCopy.textContent = '✓ Chave copiada!';
    btnCopy.classList.add('copied');
    setTimeout(() => {
      btnCopy.textContent = 'Copiar chave PIX';
      btnCopy.classList.remove('copied');
    }, 2500);
  }).catch(() => {
    /* Fallback para browsers sem clipboard API */
    const tempInput = document.createElement('input');
    tempInput.value = CONFIG.PIX_KEY;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    btnCopy.textContent = '✓ Chave copiada!';
    btnCopy.classList.add('copied');
    setTimeout(() => {
      btnCopy.textContent = 'Copiar chave PIX';
      btnCopy.classList.remove('copied');
    }, 2500);
  });
});


/* ══════════════════════════════════════════════════════
   🔒  HELPERS DE SEGURANÇA
   Evita XSS caso a planilha tenha conteúdo malicioso
══════════════════════════════════════════════════════ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}


/* ══════════════════════════════════════════════════════
   🎁  DADOS DE DEMONSTRAÇÃO
   Exibidos enquanto a planilha carrega
══════════════════════════════════════════════════════ */
const DEMO_GIFTS = [
  { categoria: 'Eletrodomésticos', nome: 'Air Fryer',           valor: 0, foto: '', status: 'Disponível', comprado: false },
  { categoria: 'Eletrodomésticos', nome: 'Geladeira',           valor: 0, foto: '', status: 'Disponível', comprado: false },
  { categoria: 'Eletrônicos',      nome: 'TV 55"',              valor: 0, foto: '', status: 'Disponível', comprado: false },
  { categoria: 'Decoração',        nome: 'Quadros Decorativos', valor: 0, foto: '', status: 'Disponível', comprado: false },
  { categoria: 'Cozinha',          nome: 'Jogo de Panelas',     valor: 0, foto: '', status: 'Disponível', comprado: false },
  { categoria: 'Viagem',           nome: 'Lua de Mel',          valor: 0, foto: '', status: 'Disponível', comprado: false },
];


/* ══════════════════════════════════════════════════════
   🚀  INICIALIZAÇÃO
══════════════════════════════════════════════════════ */
(function init() {
  /* Ano dinâmico no footer */
  document.getElementById('current-year').textContent = new Date().getFullYear();

  /* Remove tela de entrada após a animação terminar (1.8s + 0.7s = 2.5s) */
  const pageIntro = document.getElementById('page-intro');
  if (pageIntro) {
    pageIntro.addEventListener('animationend', () => {
      pageIntro.classList.add('done');
    });
  }

  /* Mostra dados demo imediatamente (UX) */
  allGifts = DEMO_GIFTS;
  buildFilters();
  renderGifts(allGifts);

  /* Carrega dados reais em segundo plano */
  loadGifts();
})();
