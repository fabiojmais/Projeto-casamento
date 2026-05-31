/* ══════════════════════════════════════════════════════
⚙️  CONFIGURAÇÕES
══════════════════════════════════════════════════════ */
const CONFIG = {
  PIX_KEY:      '79593049630',
  PIX_NAME:     'Aline Cristina',
  PIX_CITY:     'Patrocinio',
  SHEET_ID:     '1dpfOiA3-uXsoyvXDT8ZoIF-y-vIpRZB-GR8m5IrqggU',
  WEDDING_DATE: '2027-05-20T00:00:00',
  REFRESH_INTERVAL: 5 * 60 * 1000,
  RESERVATION_DURATION: 2 * 60 * 60 * 1000,
  CATEGORY_ICON: {
    'Eletrodomésticos': '🏠', 'Eletrônicos': '💻', 'Decoração': '🪴',
    'Cama, Mesa e Banho': '🛏', 'Cozinha': '🍳', 'Viagem': '✈️', 'Utilidades': '🔧',
  },
};
const STORAGE_CACHE = 'alira_gifts_cache_v2';
const STORAGE_RES   = 'alira_reservations_v1';

/* ══════════════════════════════════════════════════════
🔒  HELPERS & SEGURANÇA
══════════════════════════════════════════════════════ */
const escapeHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const escapeAttr = s => String(s).replace(/"/g,'&quot;');
const isSafeUrl  = u => { try { return /^https?:/.test(new URL(u, location.href).protocol); } catch { return false; } };

// Converte qualquer formato de link do Google Drive para link direto de imagem
function normalizeImgUrl(url) {
  if (!url) return '';
  // Extrai o ID de qualquer formato de link do Google Drive
  const m1 = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (m1) return `https://lh3.googleusercontent.com/d/${m1[1]}`;
  const m2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (m2) return `https://lh3.googleusercontent.com/d/${m2[1]}`;
  const m3 = url.match(/drive\.google\.com\/uc\?.*[?&]id=([^&]+)/);
  if (m3) return `https://lh3.googleusercontent.com/d/${m3[1]}`;
  // Link externo — usa como está
  return url;
}
const debounce   = (fn,ms=200) => { let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
const delay      = ms => new Promise(r => setTimeout(r, ms));

/* ══════════════════════════════════════════════════════
📦  CACHE & RESERVA TEMPORÁRIA
══════════════════════════════════════════════════════ */
function getCache() {
  try { return JSON.parse(localStorage.getItem(STORAGE_CACHE)) || null; } catch { return null; }
}
function setCache(data) {
  try { localStorage.setItem(STORAGE_CACHE, JSON.stringify(data)); } catch {}
}
function getReservations() {
  try { return JSON.parse(localStorage.getItem(STORAGE_RES)) || {}; } catch { return {}; }
}
function setReservations(res) { localStorage.setItem(STORAGE_RES, JSON.stringify(res)); }
function isReserved(name) {
  const res = getReservations();
  return res[name] && res[name] > Date.now();
}
function reserveGift(name) {
  const res = getReservations();
  res[name] = Date.now() + CONFIG.RESERVATION_DURATION;
  setReservations(res);
  showToast(`⏳ "${name}" reservado por 2h no seu dispositivo`);
}
function clearExpiredReservations() {
  const res = getReservations();
  Object.keys(res).forEach(k => { if (res[k] <= Date.now()) delete res[k]; });
  setReservations(res);
}

/* ══════════════════════════════════════════════════════
🌐  BUSCA GOOGLE SHEETS (CSV PÚBLICO — PUBLICADO NA WEB)
══════════════════════════════════════════════════════ */
const PUBLISHED_ID = '2PACX-1vROdU8-LYVY-g87jed2r5D1I2MQ-S1VxhrS9f1R4XXWX5_dT0uoZyNmaaTGj9k43iOG14x7AouOuAPH';
const SHEET_URLS = [
  `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_ID}/pub?output=csv`,
  `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_ID}/pub?output=csv&gid=0`,
];

// Parser CSV simples e robusto (lida com campos entre aspas e vírgulas internas)
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  return lines.slice(1).map(line => {
    const cols = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  });
}

let allGifts       = [];
let activeCategory = 'Todos';
let hideGiven      = false;
let sheetLoaded    = false;
let refreshTimer   = null;

async function loadGifts(silent = false) {
  let lastError;
  for (const url of SHEET_URLS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { credentials:'omit', cache:'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        if (!text || text.length < 10) throw new Error('Empty response');

        const rows = parseCsv(text);
        if (!rows.length) throw new Error('No rows');

        const fetched = rows.map(c => ({
          categoria: (c[0]||'').trim(),
          nome:      (c[1]||'').trim(),
          valor:     (() => {
            let s = (c[2]||'').trim().replace(/[^\d.,]/g,'');
            if (!s) return 0;
            // Formato BR com ponto de milhar: "1.500" ou "1.500,00"
            if (/\.\d{3}/.test(s)) { s = s.replace(/\./g,'').replace(',','.'); }
            // Só vírgula decimal: "1500,50"
            else if (s.includes(',')) { s = s.replace(',','.'); }
            // Número puro: "1500" ou "1500.50"
            const n = parseFloat(s);
            return isNaN(n) || n < 0 ? 0 : n;
          })(),
          foto:      normalizeImgUrl((c[3]||'').trim()),
          status:    (c[4]||'').trim(),
          comprado:  (c[5]||'').trim().toLowerCase() === 'sim',
        })).filter(g => g.nome && g.nome.length <= 200);

        if (!fetched.length) throw new Error('Empty');

        const changed = sheetLoaded && (fetched.length !== allGifts.length || JSON.stringify(fetched.map(x=>x.nome).sort()) !== JSON.stringify(allGifts.map(x=>x.nome).sort()));
        allGifts = fetched; sheetLoaded = true;
        setCache(fetched);

        const cats = new Set(allGifts.map(g=>g.categoria).filter(Boolean));
        if (activeCategory!=='Todos' && !cats.has(activeCategory)) activeCategory='Todos';

        buildFilters(); updateProgress();
        const container = document.getElementById('gifts-container');
        if (!container) return true;

        if (silent) {
          applyFiltersAndRender();
          if (changed) showToast(`✦ Lista atualizada — ${allGifts.length} presentes`);
        } else {
          container.style.transition='opacity 0.3s ease'; container.style.opacity='0';
          await delay(300); applyFiltersAndRender(); container.style.opacity='1';
        }
        return true;
      } catch(e) {
        lastError = e;
        if (attempt < 2) await delay(1500);
      }
    }
  }

  // Fallback para cache local
  const cached = getCache();
  if (cached && cached.length) {
    allGifts = cached; sheetLoaded = true;
    buildFilters(); updateProgress(); applyFiltersAndRender();
    showToast('📴 Exibindo versão salva recentemente');
    return true;
  }
  if (!sheetLoaded) showSheetError();
  return false;
}

function startAutoRefresh() { clearInterval(refreshTimer); refreshTimer=setInterval(()=>loadGifts(true), CONFIG.REFRESH_INTERVAL); }
function showSheetError() {
  if (document.getElementById('sheet-error-banner')) return;
  const b = document.createElement('div'); b.id='sheet-error-banner'; b.role='alert';
  b.style.cssText='position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:var(--mid,#3d3428);border:1px solid var(--gold,#b8965a);color:var(--cream,#f5f0e8);font-family:var(--font-body,sans-serif);font-size:0.72rem;letter-spacing:0.08em;padding:0.85rem 1.4rem;border-radius:4px;display:flex;align-items:center;gap:0.8rem;z-index:9999;max-width:90vw;box-shadow:0 4px 24px rgba(0,0,0,0.5);';
  b.innerHTML=`<span>⚠️ Planilha offline. Exibindo cache local.</span><button aria-label="Fechar" style="background:none;border:none;color:var(--gold,#b8965a);cursor:pointer;font-size:0.9rem;padding:0;margin-left:0.4rem;">✕</button>`;
  b.querySelector('button').onclick=()=>b.remove(); document.body.appendChild(b); setTimeout(()=>b?.remove(),6000);
}

/* ══════════════════════════════════════════════════════
1️⃣  BARRA DE PROGRESSO + CONTADOR
══════════════════════════════════════════════════════ */
function updateProgress() {
  const total = allGifts.length, given = allGifts.filter(g=>g.comprado).length;
  const missing = total - given;
  const percent = total>0 ? Math.round((given/total)*100) : 0;
  const bar = document.getElementById('progress-bar-fill');
  const label = document.getElementById('progress-label');
  const ctr = document.getElementById('progress-counter');
  if (bar) bar.style.width = percent+'%';
  if (label) label.textContent = `Faltam ${missing} presente${missing!==1?'s':''} ✦ ${given} de ${total} já garantidos`;
  if (ctr) ctr.textContent = percent+'%';
}

/* ══════════════════════════════════════════════════════
🏷️  FILTROS + AUTOCOMPLETE
══════════════════════════════════════════════════════ */
function buildFilters() {
  const cats = ['Todos', ...new Set(allGifts.map(g=>g.categoria).filter(Boolean))];
  const container = document.getElementById('filters'); if(!container) return; container.innerHTML='';
  cats.forEach(cat => {
    const btn = document.createElement('button'); btn.className='filter-btn'+(cat===activeCategory?' active':''); btn.dataset.cat=cat;
    btn.textContent = cat==='Todos' ? '✦ Todos' : cat;
    btn.onclick = () => { activeCategory=cat; container.querySelectorAll('.filter-btn:not(.btn-free-gift):not(.btn-toggle-given)').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); applyFiltersAndRender(); };
    container.appendChild(btn);
  });
  const toggle = document.createElement('button'); toggle.id='btn-toggle-given'; toggle.className='filter-btn btn-toggle-given'+(hideGiven?' active':'');
  toggle.textContent = hideGiven ? '👁 Mostrar todos' : '✦ Apenas disponíveis';
  toggle.onclick = () => { hideGiven=!hideGiven; toggle.textContent=hideGiven?'👁 Mostrar todos':'✦ Apenas disponíveis'; toggle.classList.toggle('active',hideGiven); applyFiltersAndRender(); };
  container.appendChild(toggle);
  const free = document.createElement('button'); free.id='btn-free-gift'; free.className='filter-btn btn-free-gift'; free.textContent='🎁 Presente Livre';
  free.onclick = () => openModal('Presente Livre', 0); container.appendChild(free);
}
function applyFiltersAndRender() {
  const input = document.getElementById('search-input');
  const q = input ? input.value.trim().toLowerCase() : '';
  let list = activeCategory==='Todos' ? allGifts : allGifts.filter(g=>g.categoria===activeCategory);
  if (hideGiven) list = list.filter(g=>!g.comprado && !isReserved(g.nome));
  if (q) list = list.filter(g=>g.nome.toLowerCase().includes(q));
  renderGifts(list);
  updateAutocomplete(input?.value.trim() || '');
}
function setupAutocomplete() {
  const wrap = document.getElementById('search-wrap'); if(!wrap) return;
  wrap.innerHTML = `<div class="search-box"><span class="search-icon" aria-hidden="true">✦</span><input type="search" id="search-input" class="search-input" placeholder="Buscar presente…" aria-label="Buscar presente por nome" autocomplete="off" autocorrect="off" autocapitalize="off" maxlength="100"/><button class="search-clear" id="search-clear" aria-label="Limpar busca" hidden>✕</button></div>`;
  if(!document.getElementById('dyn-autocomplete')) {
    const s = document.createElement('style'); s.id='dyn-autocomplete';
    s.textContent = `.ac-list{position:absolute;top:100%;left:0;right:0;background:var(--bg-card,#131008);border:1px solid rgba(184,150,90,0.25);border-top:none;max-height:200px;overflow-y:auto;z-index:50;border-radius:0 0 4px 4px;}.ac-item{padding:0.7rem 1.2rem;cursor:pointer;font-size:0.78rem;color:var(--cream);transition:background 0.2s;}.ac-item:hover{background:rgba(184,150,90,0.1);}.ac-item small{display:block;font-size:0.62rem;color:var(--muted);margin-top:2px;}`;
    document.head.appendChild(s);
  }
  const input = document.getElementById('search-input'), clearBtn = document.getElementById('search-clear');
  const list = document.createElement('div'); list.className='ac-list'; list.hidden=true; wrap.appendChild(list);
  const render = debounce(applyFiltersAndRender, 200);
  input.addEventListener('input', () => { clearBtn.hidden=!input.value.trim(); render(); });
  clearBtn.addEventListener('click', () => { input.value=''; clearBtn.hidden=true; input.focus(); applyFiltersAndRender(); });
  window.updateAutocomplete = (q) => {
    const matches = q.length>=2 ? allGifts.filter(g=>g.nome.toLowerCase().includes(q)).slice(0,5) : [];
    list.innerHTML = matches.map(g => `<div class="ac-item" data-name="${escapeAttr(g.nome)}">${escapeHtml(g.nome)} <small>${g.categoria}</small></div>`).join('');
    list.hidden = !matches.length;
    list.querySelectorAll('.ac-item').forEach(el => {
      el.onclick = () => { input.value=el.dataset.name; clearBtn.hidden=false; applyFiltersAndRender(); list.hidden=true; };
    });
  };
  document.addEventListener('click', e => { if(!wrap.contains(e.target)) list.hidden=true; });
}

/* ══════════════════════════════════════════════════════
5️⃣  INTERSECTION OBSERVER
══════════════════════════════════════════════════════ */
const cardObserver = new IntersectionObserver(entries => entries.forEach(e => { if(e.isIntersecting){e.target.classList.add('card-visible');cardObserver.unobserve(e.target);}}), {threshold:0.08});

/* ══════════════════════════════════════════════════════
🃏  RENDERIZA CARDS (COM PAGINAÇÃO)
══════════════════════════════════════════════════════ */
const PAGE_SIZE = 12;
let currentPage = 0;
let currentList = [];

function buildCardElement(gift) {
  clearExpiredReservations();
  const card = document.createElement('div');
  const reserved = isReserved(gift.nome);
  card.className = `gift-card card-io${gift.comprado?' comprado':''}${reserved?' reservado':''}`;
  const icon = CONFIG.CATEGORY_ICON[gift.categoria] ?? '🎁';
  const nameSafe = escapeHtml(gift.nome), catSafe = escapeHtml(gift.categoria);
  const safeImg = isSafeUrl(gift.foto) ? escapeAttr(gift.foto) : '';
  const imgTag = safeImg
    ? `<div class="gift-image-wrap"><img class="gift-image" src="${safeImg}" alt="Foto de ${nameSafe}" loading="lazy" decoding="async" width="400" height="533" onerror="this.parentElement.outerHTML='<div class=\\'gift-image-placeholder\\' aria-hidden=\\'true\\'>${icon}</div>'"/></div>`
    : `<div class="gift-image-placeholder" aria-hidden="true">${icon}</div>`;
  let statusBadge = gift.comprado ? `<span class="gift-badge comprado">✓ Confirmado</span><span class="gift-card-label" style="position:absolute;top:0.9rem;right:0.9rem;font-size:0.52rem;letter-spacing:0.25em;text-transform:uppercase;color:var(--gold);background:rgba(184,150,90,0.12);padding:0.3rem 0.7rem;border:1px solid rgba(184,150,90,0.25);pointer-events:none;z-index:2;">Presenteado ✦</span>` :
                    reserved ? `<span class="gift-badge reserved">⏳ Reservado</span>` :
                               `<span class="gift-badge available">✦ Disponível</span>`;
  const valorFmt = gift.valor>0 ? gift.valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : 'A combinar';
  card.innerHTML = `
    <div class="gift-card-line"></div>
    ${statusBadge}
    ${imgTag}
    <div class="gift-body">
      <p class="gift-category">${catSafe}</p>
      <h3 class="gift-name">${nameSafe}</h3>
      <div class="gift-footer">
        <div class="gift-value"><span class="gift-value-label">Valor estimado</span><strong>${valorFmt}</strong></div>
        <div class="gift-actions">
          <button class="btn-share" data-name="${escapeAttr(gift.nome)}" aria-label="Compartilhar ${nameSafe}">⬆</button>
          <button class="btn-reserve" data-name="${escapeAttr(gift.nome)}" ${reserved||gift.comprado?'disabled':''} aria-label="Reservar ${nameSafe}">⏳</button>
          <button class="btn-pix" ${gift.comprado||reserved?'disabled aria-disabled="true"':''} data-name="${escapeAttr(gift.nome)}" data-value="${gift.valor}" aria-label="Presentear ${nameSafe} via PIX">PIX ✦</button>
        </div>
      </div>
    </div>`;
  cardObserver.observe(card);
  return card;
}

function goToPage(page, direction = 'next') {
  const container = document.getElementById('gifts-container');
  if (!container) return;
  const totalPages = Math.ceil(currentList.length / PAGE_SIZE);
  if (page < 0 || page >= totalPages) return;

  const pageItems = currentList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const grid = document.createElement('div');
  grid.className = 'gifts-grid';
  pageItems.forEach(gift => grid.appendChild(buildCardElement(gift)));
  grid.addEventListener('click', e => {
    const pix = e.target.closest('.btn-pix'), share = e.target.closest('.btn-share'), res = e.target.closest('.btn-reserve');
    if(pix && !pix.disabled) openModal(pix.dataset.name, parseFloat(pix.dataset.value)||0);
    else if(share) shareGift(share.dataset.name);
    else if(res && !res.disabled) { reserveGift(res.dataset.name); applyFiltersAndRender(); }
  });

  const oldGrid = container.querySelector('.gifts-grid');
  if (oldGrid) {
    const outDir = direction === 'next' ? '-100%' : '100%';
    const inDir  = direction === 'next' ? '100%'  : '-100%';
    grid.style.cssText = `position:absolute;inset:0;transform:translateX(${inDir});transition:transform 0.55s cubic-bezier(0.77,0,0.175,1);`;
    oldGrid.style.cssText = `position:absolute;inset:0;transform:translateX(0);transition:transform 0.55s cubic-bezier(0.77,0,0.175,1);`;
    container.style.position = 'relative';
    container.appendChild(grid);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        oldGrid.style.transform = `translateX(${outDir})`;
        grid.style.transform = 'translateX(0)';
        setTimeout(() => {
          oldGrid.remove();
          grid.style.cssText = '';
          container.style.position = '';
          updatePaginationUI(page, totalPages);
        }, 560);
      });
    });
  } else {
    container.innerHTML = '';
    container.appendChild(grid);
    updatePaginationUI(page, totalPages);
  }

  currentPage = page;
  if (page > 0) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updatePaginationUI(page, totalPages) {
  let nav = document.getElementById('pagination-nav');
  if (totalPages <= 1) { if (nav) nav.remove(); return; }
  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'pagination-nav';
    nav.setAttribute('aria-label', 'Paginação de presentes');
    const giftsSection = document.querySelector('.gifts-section');
    if (giftsSection) giftsSection.appendChild(nav);
  }
  nav.innerHTML = `
    <button class="pg-arrow pg-prev" aria-label="Página anterior" ${page===0?'disabled':''}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 14L6 9L11 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="pg-dots">
      ${Array.from({length:totalPages},(_,i)=>`<button class="pg-dot${i===page?' pg-dot--active':''}" data-pg="${i}" aria-label="Página ${i+1}">${i===page?'✦':''}</button>`).join('')}
    </div>
    <button class="pg-arrow pg-next" aria-label="Próxima página" ${page===totalPages-1?'disabled':''}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 4L12 9L7 14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;
  nav.querySelector('.pg-prev').onclick = () => goToPage(currentPage - 1, 'prev');
  nav.querySelector('.pg-next').onclick = () => goToPage(currentPage + 1, 'next');
  nav.querySelectorAll('.pg-dot').forEach(btn => {
    btn.onclick = () => goToPage(parseInt(btn.dataset.pg), parseInt(btn.dataset.pg) > currentPage ? 'next' : 'prev');
  });
  // Swipe touch
  let tx = null;
  const cont = document.getElementById('gifts-container');
  if (cont && !cont._swipeInit) {
    cont._swipeInit = true;
    cont.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, {passive:true});
    cont.addEventListener('touchend', e => {
      if (tx === null) return;
      const dx = e.changedTouches[0].clientX - tx; tx = null;
      if (Math.abs(dx) > 50) dx < 0 ? goToPage(currentPage+1,'next') : goToPage(currentPage-1,'prev');
    }, {passive:true});
  }
}

function renderGifts(list) {
  const container = document.getElementById('gifts-container'); if(!container) return;
  container.removeAttribute('role');
  if(!list.length) {
    container.innerHTML=`<p class="gifts-empty">Nenhum presente encontrado.</p>`;
    const nav = document.getElementById('pagination-nav'); if(nav) nav.remove();
    return;
  }
  currentList = list;
  currentPage = 0;
  container.innerHTML = buildSkeletons(Math.min(PAGE_SIZE, list.length));
  requestAnimationFrame(() => { goToPage(0, 'next'); });
}
function buildSkeletons(n) { let h='<div class="gifts-grid">'; for(let i=0;i<n;i++) h+=`<div class="gift-card gift-skeleton" aria-hidden="true"><div class="skel skel-image"></div><div class="gift-body"><div class="skel skel-cat"></div><div class="skel skel-name"></div><div class="gift-footer"><div class="skel skel-value"></div><div class="skel skel-btn"></div></div></div></div>`; return h+'</div>'; }

/* Injeta CSS de paginação uma única vez */
(function injectPaginationCSS(){
  if(document.getElementById('pg-styles')) return;
  const s = document.createElement('style'); s.id='pg-styles';
  s.textContent = `
    #pagination-nav {
      display: flex; align-items: center; justify-content: center;
      gap: 1.2rem; padding: 3rem 1rem 1.5rem; user-select: none;
    }
    .pg-arrow {
      width: 44px; height: 44px; border-radius: 50%;
      border: 1px solid rgba(184,150,90,0.3); background: transparent;
      color: var(--gold); cursor: pointer; display: flex; align-items: center;
      justify-content: center; transition: all 0.3s ease; flex-shrink: 0;
    }
    .pg-arrow:hover:not(:disabled) {
      border-color: var(--gold); background: rgba(184,150,90,0.08);
      transform: scale(1.08);
    }
    .pg-arrow:disabled { opacity: 0.2; cursor: not-allowed; }
    .pg-dots { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; justify-content: center; }
    .pg-dot {
      width: 28px; height: 28px; border-radius: 50%; border: 1px solid rgba(184,150,90,0.2);
      background: transparent; color: transparent; cursor: pointer;
      transition: all 0.35s cubic-bezier(0.25,0.46,0.45,0.94); position: relative; font-size: 0;
    }
    .pg-dot::after {
      content: ''; position: absolute; inset: 50%; transform: translate(-50%,-50%);
      width: 5px; height: 5px; border-radius: 50%; background: rgba(184,150,90,0.35);
      transition: all 0.35s ease;
    }
    .pg-dot--active {
      width: 36px; height: 36px; border-color: var(--gold);
      background: rgba(184,150,90,0.06); font-size: 0.75rem;
      color: var(--gold); display: flex; align-items: center; justify-content: center;
    }
    .pg-dot--active::after { display: none; }
    .pg-dot:hover:not(.pg-dot--active) { border-color: rgba(184,150,90,0.5); }
    .pg-dot:hover:not(.pg-dot--active)::after { background: rgba(184,150,90,0.6); width: 7px; height: 7px; }
  `;
  document.head.appendChild(s);
})();

/* ══════════════════════════════════════════════════════
2️⃣  COMPARTILHAR & TOAST
══════════════════════════════════════════════════════ */
function shareGift(name) {
  const text = `Vou presentear "${name}" para o casamento de Aline & Raul! 💛\n${location.href}`;
  navigator.share ? navigator.share({title:'Lista de Presentes — Aline & Raul',text}).catch(e=>{if(e.name!=='AbortError')console.warn(e);}) :
    copyToClipboard(text).then(()=>showToast('Mensagem copiada! Cole onde quiser 💛'));
}
let toastTimer; function showToast(msg) {
  let t=document.getElementById('toast')||Object.assign(document.createElement('div'),{id:'toast',role:'status','aria-live':'polite'});
  if(!document.body.contains(t)) document.body.appendChild(t);
  t.textContent=msg; t.className='toast-show'; clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.className='toast-hide',3200);
}
function copyToClipboard(txt) {
  return navigator.clipboard?.writeText(txt) || new Promise((ok,no)=>{const el=document.createElement('textarea');el.value=txt;Object.assign(el.style,{position:'fixed',top:'-9999px',left:'-9999px',opacity:'0',pointerEvents:'none'});document.body.appendChild(el);el.focus();el.select();document.execCommand('copy')?ok():no(new Error('Fail'));document.body.removeChild(el);});
}

/* ══════════════════════════════════════════════════════
💸  PIX PAYLOAD + QR PRELOAD
══════════════════════════════════════════════════════ */
const crc16 = str => { let c=0xFFFF; for(let i=0;i<str.length;i++){c^=str.charCodeAt(i)<<8;for(let j=0;j<8;j++)c=(c&0x8000)?(c<<1)^0x1021:c<<1;} return (c&0xFFFF).toString(16).toUpperCase().padStart(4,'0'); };
const emv = (id,val) => `${id}${val.length.toString().padStart(2,'0')}${val}`;
function buildPixPayload(key,name,city,valor,txId='**') {
  const m = emv('00','BR.GOV.BCB.PIX')+emv('01',key);
  const p = emv('00','01')+emv('26',m)+emv('52','0000')+emv('53','986')+(valor>0?emv('54',valor.toFixed(2)):'')+emv('58','BR')+emv('59',name.slice(0,25))+emv('60',city.slice(0,15))+emv('62',emv('05',txId));
  return p+emv('63',crc16(p+'6304'));
}

/* ══════════════════════════════════════════════════════
📲  MODAL
══════════════════════════════════════════════════════ */
let overlay, modalEl, modalClose, btnCopy; let prevFocus = null;
function openModal(name, value) {
  if(!overlay) return; prevFocus=document.activeElement;
  document.getElementById('modal-title').textContent = name;
  document.getElementById('modal-val').textContent   = value>0 ? value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : 'Valor livre';
  document.getElementById('modal-key').textContent = CONFIG.PIX_KEY;
  const qrL=document.getElementById('qr-loader'), qrC=document.getElementById('qr-canvas');
  qrC.innerHTML=''; qrL.classList.remove('hidden');
  Promise.resolve().then(()=>{
    if(typeof QRCode==='undefined'){qrL.classList.add('hidden');qrC.textContent='QR Code indisponível.';return;}
    try { new QRCode(qrC, {text:buildPixPayload(CONFIG.PIX_KEY,CONFIG.PIX_NAME,CONFIG.PIX_CITY,value),width:200,height:200,colorDark:'#1a1612',colorLight:'#fdfaf5',correctLevel:QRCode.CorrectLevel.M}); } 
    catch(e) { console.warn(e); qrC.textContent='Erro ao gerar QR.'; }
    qrL.classList.add('hidden');
  });
  btnCopy.textContent='Copiar chave PIX'; btnCopy.classList.remove('copied');
  overlay.removeAttribute('hidden'); requestAnimationFrame(()=>overlay.classList.add('open'));
  document.body.style.overflow='hidden'; setTimeout(()=>modalClose.focus(),50);
}
function closeModal() { if(!overlay)return; overlay.classList.remove('open'); document.body.style.overflow=''; setTimeout(()=>{overlay.setAttribute('hidden','');prevFocus?.focus();},400); }
function getFocusable() { return Array.from(modalEl.querySelectorAll('button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(e=>!e.hidden&&e.offsetParent!==null); }

/* ══════════════════════════════════════════════════════
✨  PARTÍCULAS & CONTADOR
══════════════════════════════════════════════════════ */
function spawnPhotoParticles() {
  const photo=document.querySelector('.hero-couple-photo'); if(!photo||photo.querySelector('.photo-particle'))return;
  for(let i=0;i<14;i++){const p=document.createElement('span');p.className='photo-particle';const a=(i/14)*2*Math.PI+Math.random()*0.6-0.3,r=0.38+Math.random()*0.18,cx=50+Math.cos(a)*r*100,cy=50+Math.sin(a)*r*100,s=2+Math.random()*3;Object.assign(p.style,{width:s+'px',height:s+'px',left:cx.toFixed(2)+'%',top:cy.toFixed(2)+'%','--duration':(2.4+Math.random()*2.4).toFixed(2)+'s','--delay':(Math.random()*3).toFixed(2)+'s','--tx':(Math.cos(a)*(4+Math.random()*6)).toFixed(1)+'px','--ty':(Math.sin(a)*(4+Math.random()*6)-4).toFixed(1)+'px'});photo.appendChild(p);}
}
function initCountdown() {
  const d=new Date(CONFIG.WEDDING_DATE), el=document.getElementById('countdown'); if(!el)return;
  const u=t=>el.querySelector(`[data-unit="${t}"] .countdown-num`);
  function up(){const df=d-new Date();if(df<=0){el.innerHTML=`<p class="countdown-over">O grande dia chegou! 💛</p>`;clearInterval(window.cdt);return;}const dd=Math.floor(df/864e5),hh=Math.floor(df%864e5/36e5),mm=Math.floor(df%36e5/6e4),ss=Math.floor(df%6e4/1e3);const q=u('days'),h=u('hours'),m=u('minutes'),s=u('seconds');if(q)q.textContent=String(dd).padStart(3,'0');if(h)h.textContent=String(hh).padStart(2,'0');if(m)m.textContent=String(mm).padStart(2,'0');if(s)s.textContent=String(ss).padStart(2,'0');}
  up(); window.cdt=setInterval(up,1000);
}

/* ══════════════════════════════════════════════════════
🔐  ADMIN — ÁREA DA NOIVA
   A senha nunca fica em texto puro aqui.
   Apenas o hash SHA-256 é armazenado; não é possível
   recuperar a senha original a partir dele.
══════════════════════════════════════════════════════ */
const ADMIN_HASH = 'e3fed8d80a04106f47cf7bef54c6d21bb983ea0fc18f577ac371ee911b8067b6';
const SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/edit`;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function openAdminModal() {
  const adminOverlay = document.getElementById('admin-overlay');
  const adminLogin   = document.getElementById('admin-login');
  const adminPanel   = document.getElementById('admin-panel');
  const adminPass    = document.getElementById('admin-pass');
  const adminError   = document.getElementById('admin-error');
  if (!adminOverlay) return;
  // Reset state
  adminLogin.style.display = '';
  adminPanel.style.display = 'none';
  if (adminPass) { adminPass.value = ''; }
  if (adminError) adminError.style.display = 'none';
  adminOverlay.removeAttribute('hidden');
  requestAnimationFrame(() => adminOverlay.classList.add('open'));
  document.body.style.overflow = 'hidden';
  setTimeout(() => adminPass?.focus(), 80);
}

function closeAdminModal() {
  const adminOverlay = document.getElementById('admin-overlay');
  if (!adminOverlay) return;
  adminOverlay.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => adminOverlay.setAttribute('hidden', ''), 400);
}

function setupAdminModal() {
  const adminOverlay  = document.getElementById('admin-overlay');
  const adminClose    = document.getElementById('admin-close');
  const adminLoginBtn = document.getElementById('admin-login-btn');
  const adminPass     = document.getElementById('admin-pass');
  const adminError    = document.getElementById('admin-error');
  const adminPanel    = document.getElementById('admin-panel');
  const adminLogin    = document.getElementById('admin-login');
  const sheetLinkEl   = document.getElementById('admin-sheet-link');
  const copyLinkBtn   = document.getElementById('admin-copy-link');

  if (!adminOverlay) return;

  // Fechar ao clicar no backdrop
  adminOverlay.addEventListener('click', e => { if (e.target === adminOverlay) closeAdminModal(); });

  // Fechar com botão ✕
  if (adminClose) adminClose.onclick = closeAdminModal;

  // Fechar com Escape
  adminOverlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAdminModal();
    if (e.key === 'Enter' && document.activeElement === adminPass) adminLoginBtn?.click();
  });

  // Login
  if (adminLoginBtn) {
    adminLoginBtn.onclick = async () => {
      const typed = adminPass?.value || '';
      if (!typed) { if (adminError) { adminError.textContent = 'Digite a senha.'; adminError.style.display = 'block'; } return; }
      adminLoginBtn.textContent = 'Verificando…';
      adminLoginBtn.disabled = true;
      const hash = await sha256(typed);
      adminLoginBtn.textContent = 'Acessar Planilha';
      adminLoginBtn.disabled = false;
      if (hash === ADMIN_HASH) {
        if (adminError) adminError.style.display = 'none';
        if (adminLogin) adminLogin.style.display = 'none';
        if (sheetLinkEl) sheetLinkEl.textContent = SHEET_EDIT_URL;
        if (adminPanel) adminPanel.style.display = 'block';
      } else {
        if (adminError) { adminError.textContent = 'Senha incorreta. Tente novamente.'; adminError.style.display = 'block'; }
        adminPass.value = '';
        adminPass.focus();
      }
    };
  }

  // Copiar link
  if (copyLinkBtn) {
    copyLinkBtn.onclick = () => copyToClipboard(SHEET_EDIT_URL)
      .then(() => { copyLinkBtn.textContent = '✓ Link copiado!'; showToast('Link da planilha copiado! 💛'); setTimeout(() => { copyLinkBtn.textContent = 'Copiar Link'; }, 2500); })
      .catch(() => showToast('Copie o link manualmente.'));
  }

  // Injetar botão "Área da Noiva" no rodapé — discreto, não fica em destaque
  const footer = document.querySelector('.footer');
  if (footer && !document.getElementById('btn-admin-access')) {
    const btn = document.createElement('button');
    btn.id = 'btn-admin-access';
    btn.textContent = '✦ Noiva';
    btn.setAttribute('aria-label', 'Acesso restrito — Área da Noiva');
    Object.assign(btn.style, {
      display: 'block', margin: '1.5rem auto 0', background: 'none',
      border: '1px solid rgba(184,150,90,0.18)', color: 'rgba(184,150,90,0.45)',
      fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase',
      padding: '0.4rem 1.1rem', borderRadius: '2px', cursor: 'pointer',
      fontFamily: 'var(--font-body, sans-serif)', transition: 'all 0.3s ease',
    });
    btn.addEventListener('mouseenter', () => { btn.style.color = 'var(--gold, #b8965a)'; btn.style.borderColor = 'rgba(184,150,90,0.5)'; });
    btn.addEventListener('mouseleave', () => { btn.style.color = 'rgba(184,150,90,0.45)'; btn.style.borderColor = 'rgba(184,150,90,0.18)'; });
    btn.onclick = openAdminModal;
    footer.appendChild(btn);
  }
}

/* ══════════════════════════════════════════════════════
🚀  INICIALIZAÇÃO
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const y=document.getElementById('current-year'); if(y) y.textContent=new Date().getFullYear();
  const pi=document.getElementById('page-intro'); if(pi){pi.addEventListener('animationend',()=>pi.classList.add('done'));setTimeout(()=>pi.classList.add('done'),3000);}
  overlay=document.getElementById('modal-overlay'); modalEl=overlay?.querySelector('.modal'); modalClose=document.getElementById('modal-close'); btnCopy=document.getElementById('btn-copy');
  if(overlay&&modalClose&&btnCopy){
    overlay.addEventListener('keydown',e=>{if(!overlay.classList.contains('open'))return;if(e.key==='Escape')return closeModal();if(e.key==='Tab'){const f=getFocusable();if(!f.length)return;const a=f[0],z=f[f.length-1];e.shiftKey?document.activeElement===a&&(e.preventDefault(),z.focus()):document.activeElement===z&&(e.preventDefault(),a.focus());}});
    modalClose.onclick=closeModal; overlay.onclick=e=>{if(e.target===overlay)closeModal();};
    btnCopy.onclick=()=>copyToClipboard(CONFIG.PIX_KEY).then(()=>{btnCopy.textContent='✓ Chave copiada!';btnCopy.classList.add('copied');showToast('Chave PIX copiada! Abra seu banco e cole 💛');setTimeout(()=>{btnCopy.textContent='Copiar chave PIX';btnCopy.classList.remove('copied');},2500);}).catch(()=>showToast('Copie manualmente.'));
  }
  setTimeout(spawnPhotoParticles,2400); initCountdown(); setupAutocomplete();
  setupAdminModal();
  // Carga inicial garantida
  buildFilters(); updateProgress(); applyFiltersAndRender();
  loadGifts(false).then(ok=>{if(ok)startAutoRefresh();});
});