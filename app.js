/**
 * ============================================================================
 * LOG DISPENSE MANAGEMENT SYSTEM v3.5 ENTERPRISE
 * PT.KTC Coal Mining & Energy
 * Architect & Lead Engineer: Adi Pranata
 * ============================================================================
 */

// ==========================================
// 1. GLOBAL CONFIGURATION & STATE
// ==========================================
// GANTI DENGAN URL WEB APP DEPLOYMENT GOOGLE APPS SCRIPT ANDA JIKA BERBEDA
const API_URL = "https://script.google.com/macros/s/AKfycbx2JMKLEla_q7_EkeyZFtx4sx6HvZ6VObqY4S8DQCG0pNJsCqv3hHdwBpWB7z8fkeZkNg/exec";

let currentUser = "";
let currentRole = "ADMIN";
let currentSite = "TTLP";
let sessionToken = "";

// Master Data Cache
let liveItems = [];
let liveSuppliers = [];
let liveUnits = [];
let liveStorages = [];

// Transaction Queues (Batch Carts)
let serviceCart = [];
let vendorInCart = [];
let transferCart = [];

// History Cache
let rawRecentOutData = [];
let rawRecentInData = [];
let rawRecentMutasiData = [];
let rawRecentReturnData = [];
let balancePreviewData = [];

// Combobox States
let currentFilteredUnits = [];
let activeUnitIndex = -1;
let currentFilteredParts = [];
let activePartIndex = -1;
let currentFilteredSuppliers = [];
let activeSupplierIndex = -1;
let currentFilteredInParts = [];
let activeInPartIndex = -1;
let currentFilteredTrfParts = [];
let activeTrfPartIndex = -1;

// Combobox States - Tab Return
let currentFilteredRetUnits = [];
let activeRetUnitIndex = -1;
let currentFilteredRetSuppliers = [];
let activeRetSupplierIndex = -1;
let currentFilteredRetParts = [];
let activeRetPartIndex = -1;

let selectedUnitLastHM = 0;
let modalCallback = null;
let activeExportType = "OUT";

// ==========================================
// 2. BACKEND API CALL BRIDGE
// ==========================================
async function callBackend(action, payload = {}) {
  try {
    if (!API_URL || API_URL.includes("AKfycbw9Q6-1k2jL5pL7N8vF0")) {
      console.warn("API_URL is using demo endpoint. Central master synchronization active.");
    }
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload: { ...payload, token: sessionToken, site: payload.site || currentSite } })
    });
    return await response.json();
  } catch (err) {
    console.error("API Gateway Error:", err);
    return { success: false, message: "Database connection timed out or unreachable. Check connection and deployment." };
  }
}

// ==========================================
// 3. AUTHENTICATION & SESSION MANAGEMENT
// ==========================================
async function submitLogin() {
  const uInput = document.getElementById('loginUsername');
  const pInput = document.getElementById('loginPassword');
  const btn = document.getElementById('btnLogin');

  const username = (uInput?.value || '').trim();
  const password = (pInput?.value || '').trim();

  if (!username || !password) {
    showModalAlert("Required Field", "Please enter both User ID and Account Password.");
    return;
  }

  const origBtnHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Authenticating...';

  const res = await callBackend('LOGIN', { username, password });

  btn.disabled = false;
  btn.innerHTML = origBtnHtml;

  if (res.success && res.user) {
    currentUser = res.user.fullName || res.user.username;
    currentRole = (res.user.role || 'ADMIN').toUpperCase();
    sessionToken = res.token || "";

    // Set site akses user
    if (res.user.siteAccess && res.user.siteAccess !== 'ALL') {
      currentSite = res.user.siteAccess;
    } else {
      currentSite = 'TTLP';
    }

    // Tampilkan data user pada header
    document.getElementById('lblUserFullName').innerText = currentUser;
    document.getElementById('lblUserRoleSite').innerText = `${currentRole} • SITE ${currentSite}`;

    // Penyesuaian Role: Superadmin vs Admin
    const isSuper = (currentRole === 'SUPERADMIN' && (!res.user.siteAccess || res.user.siteAccess === 'ALL'));
    const siteSelect = document.getElementById('appSiteSelect');
    const siteBadge = document.getElementById('appSiteAdminBadge');

    if (siteSelect) siteSelect.value = currentSite;

    if (isSuper) {
      if (siteSelect) { siteSelect.classList.remove('hidden'); siteSelect.disabled = false; }
      if (siteBadge) siteBadge.classList.add('hidden');
      document.getElementById('btnFinalLock')?.classList.remove('hidden');
      document.getElementById('superadminClosePeriodSection')?.classList.remove('hidden');
      document.getElementById('superadminBatchAction')?.classList.remove('hidden');
      document.getElementById('balanceKpiContainer')?.classList.remove('hidden');
    } else {
      if (siteSelect) { siteSelect.classList.add('hidden'); siteSelect.disabled = true; }
      if (siteBadge) { siteBadge.classList.remove('hidden'); siteBadge.innerText = `SITE ${currentSite}`; }
      document.getElementById('btnFinalLock')?.classList.add('hidden');
      document.getElementById('superadminClosePeriodSection')?.classList.add('hidden');
      document.getElementById('superadminBatchAction')?.classList.add('hidden');
      document.getElementById('balanceKpiContainer')?.classList.add('hidden');
    }

    // Transisi layar
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('mainAppSection').classList.remove('hidden');

    // Inisialisasi data aplikasi
    await fetchInitialMasterData();
    initAppDashboard();
  } else {
    showModalAlert("Authentication Failed", res.message || "Invalid username or password credentials.");
  }
}

function handleLogout() {
  currentUser = "";
  currentRole = "ADMIN";
  sessionToken = "";
  document.getElementById('loginPassword').value = '';
  document.getElementById('mainAppSection').classList.add('hidden');
  document.getElementById('loginSection').classList.remove('hidden');
}

function switchSite(newSite) {
  if (currentRole !== 'SUPERADMIN') return;
  currentSite = newSite;
  document.getElementById('lblUserRoleSite').innerText = `SUPERADMIN • SITE ${currentSite}`;
  fetchInitialMasterData();
  initAppDashboard();
}

// ==========================================
// 4. NAVIGATION TABS CONTROLLER
// ==========================================
function switchTab(targetTabId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(targetTabId);
  if (target) target.classList.remove('hidden');

  const navBtnMap = {
    'tab-monitoring': 'nav-monitoring',
    'tab-out': 'nav-out',
    'tab-in': 'nav-in',
    'tab-transfer': 'nav-transfer',
    'tab-return': 'nav-return',
    'tab-balance': 'nav-balance'
  };

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.className = "nav-btn px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 font-semibold flex items-center gap-2 transition-all";
  });

  const activeBtn = document.getElementById(navBtnMap[targetTabId]);
  if (activeBtn) {
    activeBtn.className = "nav-btn px-4 py-2 rounded-xl bg-white text-slate-900 shadow-sm border border-slate-200/20 font-black flex items-center gap-2 transition-all";
  }

  // Muat data spesifik tab
  if (targetTabId === 'tab-out') {
    fetchRecentPartOut();
  } else if (targetTabId === 'tab-in') {
    fetchRecentPartIn();
    checkPendingInboundTransfers(false);
  } else if (targetTabId === 'tab-transfer') {
    fetchRecentMutasi();
  } else if (targetTabId === 'tab-return') {
    fetchRecentReturns();
  } else if (targetTabId === 'tab-monitoring') {
    fetchExecutiveKPI();
    fetchAllTankStocks();
  }
}

function initAppDashboard() {
  const today = new Date().toISOString().split('T')[0];
  if (document.getElementById('outDate')) document.getElementById('outDate').value = today;
  if (document.getElementById('inDate')) document.getElementById('inDate').value = today;
  if (document.getElementById('trfDate')) document.getElementById('trfDate').value = today;
  if (document.getElementById('retDate')) document.getElementById('retDate').value = today;

  fetchExecutiveKPI();
  fetchRecentPartOut();
  fetchRecentPartIn();
  fetchRecentMutasi();
  fetchRecentReturns();
  fetchAllTankStocks();
  checkPendingInboundTransfers(true);
}

// ==========================================
// 5. MASTER DATA LOADER
// ==========================================
async function fetchInitialMasterData() {
  const res = await callBackend('GET_INITIAL_DATA', { site: currentSite });
  if (res.success && res.data) {
    liveItems = res.data.items || [];
    liveSuppliers = res.data.suppliers || [];
    liveUnits = res.data.units || [];
    liveStorages = res.data.storages || [];

    populateSelect('outStorage', liveStorages, 'storageId', 'storageName');
    populateSelect('trfFromStorage', liveStorages, 'storageId', 'storageName');
    populateSelect('retStorage', liveStorages, 'storageId', 'storageName');
    populateSelect('balStorage', liveStorages, 'storageId', 'storageName', '-- All Storages & Lube Trucks --');
    populateSelect('storageFilterOut', liveStorages, 'storageId', 'storageName', 'All Storage & Dispenser');
    populateSelect('storageFilterIn', liveStorages, 'storageId', 'storageName', 'All Receiving Storages');

    updateTransferTargetOptions();
    lockInStorageToWarehouse(liveStorages);

    renderUnitDropdownItems(liveUnits);
    renderPartDropdownItems(liveItems);
    renderPartInDropdownItems(liveItems);
    renderTrfPartDropdownItems(liveItems);
    renderSupplierDropdownItems(liveSuppliers);

    renderRetUnitDropdownItems(liveUnits);
    renderRetSupplierDropdownItems(liveSuppliers);
    renderRetPartDropdownItems(liveItems);
  }
}

function populateSelect(elemId, items, valKey, labelKey, defaultAllText = "") {
  const sel = document.getElementById(elemId);
  if (!sel) return;
  sel.innerHTML = defaultAllText ? `<option value="">${defaultAllText}</option>` : '';
  (items || []).forEach(it => {
    sel.innerHTML += `<option value="${it[valKey]}">${it[labelKey] || it[valKey]}</option>`;
  });
}

function lockInStorageToWarehouse(storages) {
  const selIn = document.getElementById('inStorage');
  if (!selIn) return;
  const storeTank = (storages || []).find(s => {
    const t = String(s.type || '').toUpperCase();
    const n = String(s.storageName || s.storageId).toUpperCase();
    return t.includes('STORE') || t.includes('WAREHOUSE') || n.includes('STORE') || n.includes('GUDANG');
  }) || storages[0];

  if (storeTank) {
    selIn.innerHTML = `<option value="${storeTank.storageId}" selected>${storeTank.storageName} (Locked Store)</option>`;
  }
}

// ==========================================
// 6. EXECUTIVE KPI METRICS
// ==========================================
async function fetchExecutiveKPI() {
  const res = await callBackend('GET_EXECUTIVE_KPI', { site: currentSite });
  if (res.success && res.data) {
    document.getElementById('kpiDispenseVolume').innerText = (res.data.totalVolume || 0).toLocaleString('en-US');
    document.getElementById('kpiDispenseCost').innerText = (res.data.totalCost || 0).toLocaleString('en-US');
    document.getElementById('kpiTopUnitId').innerText = res.data.topUnit || '-';
    document.getElementById('kpiTopUnitVol').innerText = `${(res.data.topVolume || 0).toLocaleString('en-US')} L`;
    if (document.getElementById('kpiDispenseMonth')) {
      document.getElementById('kpiDispenseMonth').innerText = `Period: ${res.data.month} ${res.data.year}`;
    }
  }
}

// ==========================================
// 7. MONITORING TANK INVENTORY (TAB 0)
// ==========================================
async function fetchAllTankStocks() {
  const container = document.getElementById('tankCardsContainer');
  if (!container) return;
  container.innerHTML = '<div class="col-span-full py-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading inventory balances...</div>';

  const res = await callBackend('GET_ALL_TANK_STOCKS', { site: currentSite });
  if (res.success && res.data) {
    renderTankCards(res.data);
  } else {
    container.innerHTML = '<div class="col-span-full py-8 text-center text-slate-400">Failed to load inventory stock.</div>';
  }
}

function renderTankCards(tanks) {
  const container = document.getElementById('tankCardsContainer');
  if (!container) return;
  if (!tanks || tanks.length === 0) {
    container.innerHTML = '<div class="col-span-full py-8 text-center text-slate-400">No active storage units found.</div>';
    return;
  }

  container.innerHTML = tanks.map(t => {
    const isWarehouse = String(t.type || '').toUpperCase().includes('STORE') || String(t.type || '').toUpperCase().includes('WAREHOUSE');
    const iconClass = isWarehouse ? 'fa-warehouse' : 'fa-truck-fast';
    const totalTankLiters = (t.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

    const itemsHtml = (t.items && t.items.length > 0)
      ? t.items.map(it => `
          <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-none">
            <span class="font-mono font-bold text-slate-700">${it.partNumber}</span>
            <span class="font-mono font-extrabold text-amber-700">${Math.round(it.qty).toLocaleString('en-US')} L</span>
          </div>
        `).join('')
      : '<div class="text-[11px] text-slate-400 italic py-2">No lubricant stock recorded</div>';

    return `
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 hover:shadow-md transition-all">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl ${isWarehouse ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'} flex items-center justify-center text-xs">
              <i class="fa-solid ${iconClass}"></i>
            </div>
            <div>
              <h4 class="font-black text-xs text-slate-900 leading-tight font-mono">${t.id}</h4>
              <p class="text-[10px] text-slate-400">${t.name}</p>
            </div>
          </div>
          <span class="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800">${Math.round(totalTankLiters).toLocaleString('en-US')} L</span>
        </div>
        <div class="mt-3 pt-2 border-t border-slate-100 space-y-0.5 max-h-36 overflow-y-auto pr-1">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 8. COMBOBOX SEARCH & FILTER HELPERS
// ==========================================
function genericRenderPartDropdown(containerId, items, activeIdx, onSelectFnName, bgHighlight = 'bg-amber-100/80') {
  const dropdown = document.getElementById(containerId);
  if (!dropdown) return;
  if (!items || items.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs italic">No items found</div>';
    return;
  }
  dropdown.innerHTML = items.map((p, i) => `
    <div onclick="${onSelectFnName}('${p.partNumber}')" class="p-2.5 ${i === activeIdx ? `${bgHighlight} font-bold` : 'hover:bg-slate-50'} cursor-pointer transition-colors flex items-center justify-between text-xs">
      <div>
        <div class="font-black text-slate-800 font-mono text-[11px]">${p.partNumber}</div>
        <div class="text-[10px] text-slate-400">${p.partDesc || '-'}</div>
      </div>
      <i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
    </div>
  `).join('');
}

// Part Out Combobox
function renderPartDropdownItems(items, idx = -1) {
  currentFilteredParts = items || [];
  activePartIndex = idx;
  genericRenderPartDropdown('partDropdownList', currentFilteredParts, activePartIndex, 'selectPartItem', 'bg-amber-100/80');
}
function openPartDropdown() {
  document.getElementById('partDropdownList').classList.remove('hidden');
  filterPartDropdown(document.getElementById('partSearchInput').value.trim());
}
function filterPartDropdown(kw) {
  const q = (kw || '').toLowerCase().trim();
  const filtered = liveItems.filter(p => `${p.partNumber} ${p.partDesc || ''}`.toLowerCase().includes(q));
  renderPartDropdownItems(filtered);
}
function selectPartItem(partNum) {
  const p = liveItems.find(it => String(it.partNumber) === String(partNum));
  if (!p) return;
  document.getElementById('outPart').value = p.partNumber;
  document.getElementById('partSearchInput').value = `${p.partNumber} — ${p.partDesc || ''}`;
  document.getElementById('labelPartDesc').innerText = p.partDesc || '-';
  document.getElementById('btnClearPart').classList.remove('hidden');
  document.getElementById('partDropdownList').classList.add('hidden');
  triggerCheckStock();
  document.getElementById('unitSearchInput')?.focus();
}
function clearPartSelection() {
  document.getElementById('outPart').value = '';
  document.getElementById('partSearchInput').value = '';
  document.getElementById('labelPartDesc').innerText = '-';
  document.getElementById('labelLiveStock').innerHTML = 'Available: <span class="text-amber-700 font-mono">0 L</span>';
  document.getElementById('btnClearPart').classList.add('hidden');
  renderPartDropdownItems(liveItems);
}
function handlePartKeydown(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
  if (e.key === 'Enter') {
    e.preventDefault();
    if (currentFilteredParts.length > 0) selectPartItem(currentFilteredParts[0].partNumber);
  }
}

// Unit Out Combobox
function renderUnitDropdownItems(units, idx = -1) {
  const dropdown = document.getElementById('unitDropdownList');
  if (!dropdown) return;
  currentFilteredUnits = units || [];
  activeUnitIndex = idx;
  if (!units || units.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs italic">Equipment not found</div>';
    return;
  }
  dropdown.innerHTML = units.map((u, i) => `
    <div onclick="selectUnitItem('${u.unitId}')" class="p-2.5 ${i === activeUnitIndex ? 'bg-amber-100 font-bold' : 'hover:bg-slate-50'} cursor-pointer transition-colors flex items-center justify-between text-xs">
      <div>
        <span class="font-black font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">${u.unitId}</span>
        <span class="text-slate-600 ml-1">${u.desc || '-'}</span>
      </div>
      <i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
    </div>
  `).join('');
}
function openUnitDropdown() {
  document.getElementById('unitDropdownList').classList.remove('hidden');
  filterUnitDropdown(document.getElementById('unitSearchInput').value.trim());
}
function filterUnitDropdown(kw) {
  const q = (kw || '').toLowerCase().trim();
  const filtered = liveUnits.filter(u => `${u.unitId} ${u.desc || ''} ${u.model || ''}`.toLowerCase().includes(q));
  renderUnitDropdownItems(filtered);
}
function selectUnitItem(unitId) {
  const u = liveUnits.find(it => String(it.unitId) === String(unitId));
  if (!u) return;
  document.getElementById('outUnit').value = u.unitId;
  document.getElementById('unitSearchInput').value = `${u.unitId} — ${u.desc || ''} (${u.model || '-'})`;
  document.getElementById('labelUnitModel').innerText = u.model || '-';
  document.getElementById('labelUnitDesc').innerText = u.desc || '-';
  document.getElementById('outChargeSite').value = (u.chargeSite && u.chargeSite !== 'ALL') ? u.chargeSite : currentSite;
  selectedUnitLastHM = Number(u.lastHM || 0);
  document.getElementById('labelLastHM').innerHTML = `Last: <b>${selectedUnitLastHM}</b>`;
  document.getElementById('outHM').value = selectedUnitLastHM;
  document.getElementById('btnClearUnit').classList.remove('hidden');
  document.getElementById('unitDropdownList').classList.add('hidden');
  document.getElementById('outQty')?.focus();
}
function clearUnitSelection() {
  document.getElementById('outUnit').value = '';
  document.getElementById('unitSearchInput').value = '';
  document.getElementById('labelUnitModel').innerText = '-';
  document.getElementById('labelUnitDesc').innerText = '-';
  document.getElementById('outChargeSite').value = '-';
  document.getElementById('labelLastHM').innerHTML = 'Last: <b>-</b>';
  document.getElementById('outHM').value = '0';
  document.getElementById('btnClearUnit').classList.add('hidden');
  renderUnitDropdownItems(liveUnits);
}
function handleUnitKeydown(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
  if (e.key === 'Enter') {
    e.preventDefault();
    if (currentFilteredUnits.length > 0) selectUnitItem(currentFilteredUnits[0].unitId);
  }
}

// Supplier Combobox
function renderSupplierDropdownItems(suppliers, idx = -1) {
  const dropdown = document.getElementById('supplierDropdownList');
  if (!dropdown) return;
  currentFilteredSuppliers = suppliers || [];
  activeSupplierIndex = idx;
  if (!suppliers || suppliers.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs italic">No supplier found</div>';
    return;
  }
  dropdown.innerHTML = suppliers.map((s, i) => `
    <div onclick="selectSupplierItem('${s.kode}')" class="p-2.5 ${i === activeSupplierIndex ? 'bg-blue-100 font-bold' : 'hover:bg-slate-50'} cursor-pointer text-xs flex justify-between">
      <div>
        <span class="font-mono font-bold bg-slate-100 px-1 py-0.5 rounded text-[11px]">${s.kode}</span>
        <span class="text-slate-700 ml-1">${s.nama}</span>
      </div>
      <i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
    </div>
  `).join('');
}
function openSupplierDropdown() {
  document.getElementById('supplierDropdownList').classList.remove('hidden');
  filterSupplierDropdown(document.getElementById('supplierSearchInput').value.trim());
}
function filterSupplierDropdown(kw) {
  const q = (kw || '').toLowerCase().trim();
  const filtered = liveSuppliers.filter(s => `${s.kode} ${s.nama}`.toLowerCase().includes(q));
  renderSupplierDropdownItems(filtered);
}
function selectSupplierItem(kode) {
  const s = liveSuppliers.find(it => String(it.kode) === String(kode));
  if (!s) return;
  document.getElementById('inSupplierCode').value = s.kode;
  document.getElementById('inSupplierName').value = s.nama;
  document.getElementById('supplierSearchInput').value = `${s.kode} — ${s.nama}`;
  document.getElementById('lblSelectedSupplierDesc').innerHTML = `Verified Master: <b class="text-blue-700">${s.nama}</b>`;
  document.getElementById('btnClearSupplier').classList.remove('hidden');
  document.getElementById('supplierDropdownList').classList.add('hidden');
  document.getElementById('partInSearchInput')?.focus();
}
function clearSupplierSelection() {
  document.getElementById('inSupplierCode').value = '';
  document.getElementById('inSupplierName').value = '';
  document.getElementById('supplierSearchInput').value = '';
  document.getElementById('lblSelectedSupplierDesc').innerHTML = 'Verified Master: <b>-</b>';
  document.getElementById('btnClearSupplier').classList.add('hidden');
  renderSupplierDropdownItems(liveSuppliers);
}
function handleSupplierKeydown(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
  if (e.key === 'Enter') {
    e.preventDefault();
    if (currentFilteredSuppliers.length > 0) selectSupplierItem(currentFilteredSuppliers[0].kode);
  }
}

// Part In Combobox
function renderPartInDropdownItems(items, idx = -1) {
  currentFilteredInParts = items || [];
  activeInPartIndex = idx;
  genericRenderPartDropdown('partInDropdownList', currentFilteredInParts, activeInPartIndex, 'selectPartInItem', 'bg-blue-100/80');
}
function openPartInDropdown() {
  document.getElementById('partInDropdownList').classList.remove('hidden');
  filterPartInDropdown(document.getElementById('partInSearchInput').value.trim());
}
function filterPartInDropdown(kw) {
  const q = (kw || '').toLowerCase().trim();
  const filtered = liveItems.filter(p => `${p.partNumber} ${p.partDesc || ''}`.toLowerCase().includes(q));
  renderPartInDropdownItems(filtered);
}
function selectPartInItem(partNum) {
  const p = liveItems.find(it => String(it.partNumber) === String(partNum));
  if (!p) return;
  document.getElementById('inPart').value = p.partNumber;
  document.getElementById('partInSearchInput').value = `${p.partNumber} — ${p.partDesc || ''}`;
  document.getElementById('labelPartInDesc').innerText = p.partDesc || '-';
  if (p.defaultPrice) document.getElementById('inHarga').value = Number(p.defaultPrice).toLocaleString('en-US');
  document.getElementById('btnClearPartIn').classList.remove('hidden');
  document.getElementById('partInDropdownList').classList.add('hidden');
  document.getElementById('inQty')?.focus();
}
function clearPartInSelection() {
  document.getElementById('inPart').value = '';
  document.getElementById('partInSearchInput').value = '';
  document.getElementById('labelPartInDesc').innerText = '-';
  document.getElementById('btnClearPartIn').classList.add('hidden');
  renderPartInDropdownItems(liveItems);
}
function handlePartInKeydown(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
  if (e.key === 'Enter') {
    e.preventDefault();
    if (currentFilteredInParts.length > 0) selectPartInItem(currentFilteredInParts[0].partNumber);
  }
}

// Transfer Part Combobox
function renderTrfPartDropdownItems(items, idx = -1) {
  currentFilteredTrfParts = items || [];
  activeTrfPartIndex = idx;
  genericRenderPartDropdown('trfPartDropdownList', currentFilteredTrfParts, activeTrfPartIndex, 'selectTrfPartItem', 'bg-amber-100/80');
}
function openTrfPartDropdown() {
  document.getElementById('trfPartDropdownList').classList.remove('hidden');
  filterTrfPartDropdown(document.getElementById('trfPartSearchInput').value.trim());
}
function filterTrfPartDropdown(kw) {
  const q = (kw || '').toLowerCase().trim();
  const filtered = liveItems.filter(p => `${p.partNumber} ${p.partDesc || ''}`.toLowerCase().includes(q));
  renderTrfPartDropdownItems(filtered);
}
function selectTrfPartItem(partNum) {
  const p = liveItems.find(it => String(it.partNumber) === String(partNum));
  if (!p) return;
  document.getElementById('trfPart').value = p.partNumber;
  document.getElementById('trfPartSearchInput').value = `${p.partNumber} — ${p.partDesc || ''}`;
  document.getElementById('labelTrfPartDesc').innerText = p.partDesc || '-';
  document.getElementById('btnClearTrfPart').classList.remove('hidden');
  document.getElementById('trfPartDropdownList').classList.add('hidden');
  triggerCheckTrfStock();
  document.getElementById('trfQty')?.focus();
}
function clearTrfPartSelection() {
  document.getElementById('trfPart').value = '';
  document.getElementById('trfPartSearchInput').value = '';
  document.getElementById('labelTrfPartDesc').innerText = '-';
  document.getElementById('labelTrfStock').innerHTML = 'Available: <span class="text-amber-700 font-mono">0 L</span>';
  document.getElementById('btnClearTrfPart').classList.add('hidden');
  renderTrfPartDropdownItems(liveItems);
}
function handleTrfPartKeydown(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
  if (e.key === 'Enter') {
    e.preventDefault();
    if (currentFilteredTrfParts.length > 0) selectTrfPartItem(currentFilteredTrfParts[0].partNumber);
  }
}

// ==========================================
// 9. RETURN & REVERSAL COMBOBOX (TAB 6)
// ==========================================
function renderRetUnitDropdownItems(units, idx = -1) {
  const dropdown = document.getElementById('retUnitDropdownList');
  if (!dropdown) return;
  currentFilteredRetUnits = units || [];
  activeRetUnitIndex = idx;
  if (!units || units.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs italic">Equipment not found</div>';
    return;
  }
  dropdown.innerHTML = units.map((u, i) => `
    <div onclick="selectRetUnitItem('${u.unitId}')" class="p-2.5 ${i === activeRetUnitIndex ? 'bg-teal-100 font-bold' : 'hover:bg-slate-50'} cursor-pointer text-xs flex justify-between">
      <div>
        <span class="font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">${u.unitId}</span>
        <span class="text-slate-700 ml-1">${u.desc || '-'}</span>
      </div>
      <i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
    </div>
  `).join('');
}
function openRetUnitDropdown() {
  document.getElementById('retUnitDropdownList').classList.remove('hidden');
  filterRetUnitDropdown(document.getElementById('retUnitSearchInput').value.trim());
}
function filterRetUnitDropdown(kw) {
  const q = (kw || '').toLowerCase().trim();
  const filtered = liveUnits.filter(u => `${u.unitId} ${u.desc || ''} ${u.model || ''}`.toLowerCase().includes(q));
  renderRetUnitDropdownItems(filtered);
}
function selectRetUnitItem(unitId) {
  const u = liveUnits.find(it => String(it.unitId) === String(unitId));
  if (!u) return;
  document.getElementById('retUnit').value = u.unitId;
  document.getElementById('retUnitSearchInput').value = `${u.unitId} — ${u.desc || ''}`;
  document.getElementById('labelRetUnitDesc').innerText = u.desc || '-';
  document.getElementById('labelRetUnitModel').innerText = u.model || '-';
  document.getElementById('retChargeSite').value = (u.chargeSite && u.chargeSite !== 'ALL') ? u.chargeSite : currentSite;
  document.getElementById('retHM').value = u.lastHM || 0;
  document.getElementById('btnClearRetUnit').classList.remove('hidden');
  document.getElementById('retUnitDropdownList').classList.add('hidden');
  document.getElementById('retPartSearchInput')?.focus();
}
function clearRetUnitSelection() {
  document.getElementById('retUnit').value = '';
  document.getElementById('retUnitSearchInput').value = '';
  document.getElementById('labelRetUnitDesc').innerText = '-';
  document.getElementById('labelRetUnitModel').innerText = '-';
  document.getElementById('retChargeSite').value = '-';
  document.getElementById('retHM').value = '0';
  document.getElementById('btnClearRetUnit').classList.add('hidden');
  renderRetUnitDropdownItems(liveUnits);
}
function handleRetUnitKeydown(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
  if (e.key === 'Enter') {
    e.preventDefault();
    if (currentFilteredRetUnits.length > 0) selectRetUnitItem(currentFilteredRetUnits[0].unitId);
  }
}

// Ret Supplier Combobox
function renderRetSupplierDropdownItems(suppliers, idx = -1) {
  const dropdown = document.getElementById('retSupplierDropdownList');
  if (!dropdown) return;
  currentFilteredRetSuppliers = suppliers || [];
  activeRetSupplierIndex = idx;
  if (!suppliers || suppliers.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs italic">Supplier not found</div>';
    return;
  }
  dropdown.innerHTML = suppliers.map((s, i) => `
    <div onclick="selectRetSupplierItem('${s.kode}')" class="p-2.5 ${i === activeRetSupplierIndex ? 'bg-teal-100 font-bold' : 'hover:bg-slate-50'} cursor-pointer text-xs flex justify-between">
      <div>
        <span class="font-mono font-bold bg-slate-100 px-1 py-0.5 rounded text-[11px]">${s.kode}</span>
        <span class="text-slate-700 ml-1">${s.nama}</span>
      </div>
      <i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
    </div>
  `).join('');
}
function openRetSupplierDropdown() {
  document.getElementById('retSupplierDropdownList').classList.remove('hidden');
  filterRetSupplierDropdown(document.getElementById('retSupplierSearchInput').value.trim());
}
function filterRetSupplierDropdown(kw) {
  const q = (kw || '').toLowerCase().trim();
  const filtered = liveSuppliers.filter(s => `${s.kode} ${s.nama}`.toLowerCase().includes(q));
  renderRetSupplierDropdownItems(filtered);
}
function selectRetSupplierItem(kode) {
  const s = liveSuppliers.find(it => String(it.kode) === String(kode));
  if (!s) return;
  document.getElementById('retSupplierCode').value = s.kode;
  document.getElementById('retSupplierName').value = s.nama;
  document.getElementById('retSupplierSearchInput').value = `${s.kode} — ${s.nama}`;
  document.getElementById('lblRetSelectedSupplierDesc').innerHTML = `Verified Master: <b class="text-teal-700">${s.nama}</b>`;
  document.getElementById('btnClearRetSupplier').classList.remove('hidden');
  document.getElementById('retSupplierDropdownList').classList.add('hidden');
  document.getElementById('retPartSearchInput')?.focus();
}
function clearRetSupplierSelection() {
  document.getElementById('retSupplierCode').value = '';
  document.getElementById('retSupplierName').value = '';
  document.getElementById('retSupplierSearchInput').value = '';
  document.getElementById('lblRetSelectedSupplierDesc').innerHTML = 'Verified Master: <b>-</b>';
  document.getElementById('btnClearRetSupplier').classList.add('hidden');
  renderRetSupplierDropdownItems(liveSuppliers);
}
function handleRetSupplierKeydown(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
  if (e.key === 'Enter') {
    e.preventDefault();
    if (currentFilteredRetSuppliers.length > 0) selectRetSupplierItem(currentFilteredRetSuppliers[0].kode);
  }
}

// Ret Part Combobox
function renderRetPartDropdownItems(items, idx = -1) {
  currentFilteredRetParts = items || [];
  activeRetPartIndex = idx;
  genericRenderPartDropdown('retPartDropdownList', currentFilteredRetParts, activeRetPartIndex, 'selectRetPartItem', 'bg-teal-100/80');
}
function openRetPartDropdown() {
  document.getElementById('retPartDropdownList').classList.remove('hidden');
  filterRetPartDropdown(document.getElementById('retPartSearchInput').value.trim());
}
function filterRetPartDropdown(kw) {
  const q = (kw || '').toLowerCase().trim();
  const filtered = liveItems.filter(p => `${p.partNumber} ${p.partDesc || ''}`.toLowerCase().includes(q));
  renderRetPartDropdownItems(filtered);
}
function selectRetPartItem(partNum) {
  const p = liveItems.find(it => String(it.partNumber) === String(partNum));
  if (!p) return;
  document.getElementById('retPart').value = p.partNumber;
  document.getElementById('retPartSearchInput').value = `${p.partNumber} — ${p.partDesc || ''}`;
  document.getElementById('labelRetPartDesc').innerText = p.partDesc || '-';
  if (p.defaultPrice) document.getElementById('retHarga').value = Number(p.defaultPrice).toLocaleString('en-US');
  document.getElementById('btnClearRetPart').classList.remove('hidden');
  document.getElementById('retPartDropdownList').classList.add('hidden');
  triggerCheckReturnStock();
  document.getElementById('retQty')?.focus();
}
function clearRetPartSelection() {
  document.getElementById('retPart').value = '';
  document.getElementById('retPartSearchInput').value = '';
  document.getElementById('labelRetPartDesc').innerText = '-';
  document.getElementById('labelRetLiveStock').innerHTML = 'Available: <span class="text-teal-700 font-mono">0 L</span>';
  document.getElementById('btnClearRetPart').classList.add('hidden');
  renderRetPartDropdownItems(liveItems);
}
function handleRetPartKeydown(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
  if (e.key === 'Enter') {
    e.preventDefault();
    if (currentFilteredRetParts.length > 0) selectRetPartItem(currentFilteredRetParts[0].partNumber);
  }
}

// Global click outside to close dropdowns
document.addEventListener('click', (e) => {
  const checkClose = (inputElemId, dropdownId) => {
    const inp = document.getElementById(inputElemId);
    const drop = document.getElementById(dropdownId);
    if (inp && drop && !inp.contains(e.target) && !drop.contains(e.target)) {
      drop.classList.add('hidden');
    }
  };
  checkClose('partSearchInput', 'partDropdownList');
  checkClose('unitSearchInput', 'unitDropdownList');
  checkClose('supplierSearchInput', 'supplierDropdownList');
  checkClose('partInSearchInput', 'partInDropdownList');
  checkClose('trfPartSearchInput', 'trfPartDropdownList');
  checkClose('retUnitSearchInput', 'retUnitDropdownList');
  checkClose('retSupplierSearchInput', 'retSupplierDropdownList');
  checkClose('retPartSearchInput', 'retPartDropdownList');
});

// ==========================================
// 10. STOCK LEVEL VALIDATION HELPERS
// ==========================================
async function queryLiveStock(storageId, partNumber, targetLabelId) {
  if (!storageId || !partNumber) return;
  const res = await callBackend('CHECK_STOCK', { site: currentSite, storageId, partNumber });
  const lbl = document.getElementById(targetLabelId);
  if (lbl) {
    const stockVal = res.success ? Math.round(Number(res.stock || 0)) : 0;
    lbl.innerHTML = `Available: <span class="font-mono font-bold ${stockVal <= 0 ? 'text-rose-600' : 'text-amber-700'}">${stockVal.toLocaleString('en-US')} L</span>`;
  }
}
function triggerCheckStock() {
  queryLiveStock(document.getElementById('outStorage')?.value, document.getElementById('outPart')?.value, 'labelLiveStock');
}
function triggerCheckTrfStock() {
  queryLiveStock(document.getElementById('trfFromStorage')?.value, document.getElementById('trfPart')?.value, 'labelTrfStock');
}
function triggerCheckReturnStock() {
  queryLiveStock(document.getElementById('retStorage')?.value, document.getElementById('retPart')?.value, 'labelRetLiveStock');
}

// ==========================================
// 11. TAB 1: DISPENSE ORDER (LOG OUT)
// ==========================================
function validateHMInput(val) {
  const currentHM = parseFloat(val) || 0;
  const isReset = document.getElementById('checkResetHM')?.checked;
  const warnLower = document.getElementById('warnHM');
  const warnHigh = document.getElementById('warnHMHigh');

  if (warnLower) {
    if (!isReset && selectedUnitLastHM > 0 && currentHM < selectedUnitLastHM) {
      warnLower.classList.remove('hidden');
    } else {
      warnLower.classList.add('hidden');
    }
  }

  if (warnHigh) {
    if (!isReset && selectedUnitLastHM > 0 && (currentHM - selectedUnitLastHM) > 30) {
      warnHigh.classList.remove('hidden');
    } else {
      warnHigh.classList.add('hidden');
    }
  }
}

function validateAntiMinus(val) {
  // Validasi lokal non-blocking
}

function toggleResetHMPanel() {
  const p = document.getElementById('resetHMPanel');
  if (p) p.classList.toggle('hidden');
}

function toggleResetHM(checked) {
  validateHMInput(document.getElementById('outHM')?.value);
}

function addOliToServiceCart() {
  const partNumber = document.getElementById('outPart').value.trim();
  const storageId = document.getElementById('outStorage').value.trim();
  const qty = parseInt(document.getElementById('outQty').value, 10) || 0;

  if (!storageId) { showModalAlert("Required Field", "Please select Source Storage first."); return; }
  if (!partNumber) { showModalAlert("Required Field", "Please select Lubricant Item."); return; }
  if (qty <= 0) { showModalAlert("Invalid Volume", "Please enter volume greater than 0 Liters."); return; }

  const itemMeta = liveItems.find(it => it.partNumber === partNumber) || { partDesc: partNumber, defaultPrice: 0 };
  serviceCart.push({
    sourceStorage: storageId,
    partNumber: partNumber,
    partDescription: itemMeta.partDesc,
    qty: qty,
    price: itemMeta.defaultPrice || 0
  });

  renderServiceCart();
  clearPartSelection();
  document.getElementById('outQty').value = '';
}

function renderServiceCart() {
  const container = document.getElementById('serviceCartContainer');
  const list = document.getElementById('serviceCartList');
  const countLbl = document.getElementById('cartCount');
  const btnSubmitLabel = document.getElementById('btnSubmitOutLabel');

  if (!container || !list) return;
  if (serviceCart.length === 0) {
    container.classList.add('hidden');
    if (btnSubmitLabel) btnSubmitLabel.innerText = "Submit Dispense Order";
    return;
  }

  container.classList.remove('hidden');
  if (countLbl) countLbl.innerText = serviceCart.length;
  if (btnSubmitLabel) btnSubmitLabel.innerText = `Submit Batch (${serviceCart.length} Service Items)`;

  list.innerHTML = serviceCart.map((it, idx) => `
    <div class="p-2 bg-white rounded-xl border border-amber-200 flex items-center justify-between text-xs">
      <div>
        <div class="font-bold text-slate-800 font-mono">${it.partNumber} <span class="text-amber-700 font-black">${it.qty} L</span></div>
        <div class="text-[10px] text-slate-400">${it.partDescription} (${it.sourceStorage})</div>
      </div>
      <button type="button" onclick="removeServiceCartItem(${idx})" class="text-rose-500 hover:text-rose-700 p-1">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `).join('');
}

function removeServiceCartItem(idx) {
  serviceCart.splice(idx, 1);
  renderServiceCart();
}

function clearServiceCart() {
  serviceCart = [];
  renderServiceCart();
}

async function submitPartOutData() {
  const tanggal = document.getElementById('outDate').value.trim();
  const unitId = document.getElementById('outUnit').value.trim();
  const hm = parseFloat(document.getElementById('outHM').value) || 0;
  const chargeSite = document.getElementById('outChargeSite').value.trim() || currentSite;
  const issuedFor = document.getElementById('outIssuedFor').value.trim();
  const ket = document.getElementById('outKet').value.trim();
  const isReset = document.getElementById('checkResetHM')?.checked;

  if (!tanggal) { showModalAlert("Required Field", "Please select Transaction Date."); return; }
  if (!unitId) { showModalAlert("Required Field", "Please select Fleet Unit / Equipment ID."); return; }
  if (!isReset && selectedUnitLastHM > 0 && hm < selectedUnitLastHM) {
    showModalAlert("Invalid Meter Reading", `Entered HM (${hm}) is lower than last recorded meter (${selectedUnitLastHM}).`);
    return;
  }
  if (!ket) { showModalAlert("Required Field", "Technician / Operator name is mandatory."); return; }

  const btn = document.getElementById('btnSubmitOut');
  const origBtnHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Committing Dispense Order...';

  const unitMeta = liveUnits.find(u => u.unitId === unitId) || { desc: '-', model: '-' };
  let res;

  if (serviceCart.length > 0) {
    const payload = {
      site: currentSite,
      tanggal: tanggal,
      unitId: unitId,
      hm: hm,
      unitDescription: unitMeta.desc,
      model: unitMeta.model,
      issuedFor: issuedFor,
      keterangan: ket,
      chargeSite: chargeSite,
      createdBy: currentUser || 'ADMIN',
      items: serviceCart
    };
    res = await callBackend('SUBMIT_PART_OUT_BATCH', payload);
  } else {
    const storageId = document.getElementById('outStorage').value.trim();
    const partNumber = document.getElementById('outPart').value.trim();
    const qty = parseInt(document.getElementById('outQty').value, 10) || 0;

    if (!storageId) { showModalAlert("Required Field", "Please select Source Storage."); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }
    if (!partNumber) { showModalAlert("Required Field", "Please select Lubricant Item."); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }
    if (qty <= 0) { showModalAlert("Invalid Volume", "Please enter volume greater than 0 Liters."); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }

    const itemMeta = liveItems.find(it => it.partNumber === partNumber) || { partDesc: partNumber, defaultPrice: 0 };
    const payload = {
      site: currentSite,
      tanggal: tanggal,
      sourceStorage: storageId,
      partNumber: partNumber,
      partDescription: itemMeta.partDesc,
      qty: qty,
      price: itemMeta.defaultPrice || 0,
      unitId: unitId,
      hm: hm,
      unitDescription: unitMeta.desc,
      model: unitMeta.model,
      issuedFor: issuedFor,
      keterangan: ket,
      chargeSite: chargeSite,
      createdBy: currentUser || 'ADMIN'
    };
    res = await callBackend('SUBMIT_PART_OUT', payload);
  }

  btn.disabled = false;
  btn.innerHTML = origBtnHtml;

  if (res.success) {
    clearServiceCart();
    clearPartSelection();
    clearUnitSelection();
    document.getElementById('outQty').value = '';
    document.getElementById('outKet').value = '';
    fetchRecentPartOut();
    fetchAllTankStocks();
    fetchExecutiveKPI();
    showModalAlert("Dispense Order Recorded", res.message, true);
  } else {
    showModalAlert("Dispense Order Rejected", res.message);
  }
}

async function fetchRecentPartOut() {
  const tbody = document.getElementById('tableRecentOut');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading dispense log...</td></tr>';

  const res = await callBackend('GET_RECENT_OUT', { site: currentSite });
  if (res.success && res.data) {
    rawRecentOutData = res.data;
    renderRecentOutRows(rawRecentOutData);
  } else {
    tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-slate-400">Failed to load dispense records.</td></tr>';
  }
}

function renderRecentOutRows(data) {
  const tbody = document.getElementById('tableRecentOut');
  if (!tbody) return;
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-slate-400">No dispense transactions recorded this period.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr class="hover:bg-slate-50 transition-colors font-medium text-slate-700">
      <td class="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">${r.tanggal}</td>
      <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-800">${r.sourceStorage}</td>
      <td class="py-2.5 px-3">
        <div class="font-bold text-slate-900 leading-tight font-mono">${r.partNumber}</div>
        <div class="text-[10px] text-slate-400 truncate max-w-[150px] leading-tight">${r.partDescription}</div>
      </td>
      <td class="py-2.5 px-3 text-right font-black font-mono text-amber-700 whitespace-nowrap">${Math.round(r.qty).toLocaleString('en-US')} L</td>
      <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-900 font-mono">${r.unitId}</td>
      <td class="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600">${r.hm || '-'}</td>
      <td class="py-2.5 px-3 whitespace-nowrap text-blue-700 font-bold font-mono text-[11px]">${r.chargeSite || currentSite}</td>
      <td class="py-2.5 px-3 whitespace-nowrap"><span class="px-2 py-0.5 rounded bg-slate-100 font-bold text-[10px]">${r.issuedFor}</span></td>
    </tr>
  `).join('');
}

function filterRecentOutTable() {
  const q = (document.getElementById('searchFilterOut')?.value || '').trim().toLowerCase();
  const st = (document.getElementById('storageFilterOut')?.value || '').trim().toLowerCase();
  const cat = (document.getElementById('categoryFilterOut')?.value || '').trim();

  const filtered = rawRecentOutData.filter(r => {
    const matchQ = !q || `${r.tanggal} ${r.sourceStorage} ${r.partNumber} ${r.partDescription} ${r.unitId} ${r.keterangan || ''}`.toLowerCase().includes(q);
    const matchSt = !st || String(r.sourceStorage).toLowerCase() === st;
    const matchCat = !cat || r.issuedFor === cat;
    return matchQ && matchSt && matchCat;
  });
  renderRecentOutRows(filtered);
}

// ==========================================
// 12. TAB 2: INBOUND RECEIVING (LOG IN)
// ==========================================
function toggleInSourceType(type) {
  const panelSJ = document.getElementById('panelSJLookup');
  const suppContainer = document.getElementById('containerInSupplier');
  const itemDetailSection = document.getElementById('containerInItemDetailSection');
  const btnSubmit = document.getElementById('lblBtnSubmitIn');

  if (type === 'TRANSFER_SJ') {
    panelSJ?.classList.remove('hidden');
    suppContainer?.classList.add('hidden');
    itemDetailSection?.classList.add('hidden');
    if (btnSubmit) btnSubmit.innerText = "Confirm Inbound Inter-Site Transfer";
  } else {
    panelSJ?.classList.add('hidden');
    suppContainer?.classList.remove('hidden');
    itemDetailSection?.classList.remove('hidden');
    if (btnSubmit) btnSubmit.innerText = "Submit Inbound Receiving";
  }
}

async function triggerSJAutoFill() {
  const noSJ = document.getElementById('lookupSJInput')?.value.trim();
  const statusLbl = document.getElementById('lblSJLookupStatus');
  if (!noSJ) { showModalAlert("Required Field", "Please enter Waybill (SJ) number."); return; }

  if (statusLbl) {
    statusLbl.classList.remove('hidden');
    statusLbl.innerText = "Searching central dispatch records...";
  }

  const res = await callBackend('LOOKUP_TRANSFER_SJ', { site: currentSite, noSJ });
  if (res.success && res.data && res.data.length > 0) {
    if (statusLbl) statusLbl.innerText = `Found ${res.data.length} transfer items from Site ${res.data[0].originSite}.`;
    document.getElementById('inNoDok').value = res.data[0].noSJ;
    document.getElementById('inboundCartContainer')?.classList.remove('hidden');
    document.getElementById('inboundCartCount').innerText = res.data.length;

    document.getElementById('inboundCartList').innerHTML = res.data.map(it => `
      <div class="p-2 bg-white rounded-xl border border-amber-200 flex items-center justify-between text-xs">
        <div>
          <span class="font-bold text-slate-800 font-mono">${it.partNumber}</span>
          <span class="text-amber-800 font-extrabold ml-2">${it.qtyKirim} L</span>
          <div class="text-[10px] text-slate-400">From Site: ${it.originSite} (${it.sourceStorage})</div>
        </div>
        <span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">IN_TRANSIT</span>
      </div>
    `).join('');
  } else {
    if (statusLbl) statusLbl.innerText = "No active in-transit waybill found.";
    showModalAlert("Waybill Not Found", res.message || "Waybill not found in active dispatch registry.");
  }
}

function addOliToVendorInCart() {
  const partNumber = document.getElementById('inPart').value.trim();
  const qty = parseInt(document.getElementById('inQty').value, 10) || 0;
  const rawHarga = document.getElementById('inHarga').value.trim();
  const harga = parseFloat(rawHarga.replace(',', '.')) || 0;

  if (!partNumber) { showModalAlert("Required Field", "Please select Lubricant Item."); return; }
  if (qty <= 0) { showModalAlert("Invalid Volume", "Please enter received volume greater than 0 L."); return; }

  const itemMeta = liveItems.find(it => it.partNumber === partNumber) || { partDesc: partNumber, defaultPrice: 0 };
  vendorInCart.push({
    partNumber,
    partDescription: itemMeta.partDesc,
    qty,
    hargaSatuan: harga > 0 ? harga : (itemMeta.defaultPrice || 0)
  });

  renderVendorInCart();
  clearPartInSelection();
  document.getElementById('inQty').value = '';
}

function renderVendorInCart() {
  const container = document.getElementById('vendorInCartContainer');
  const list = document.getElementById('vendorInCartList');
  const countLbl = document.getElementById('vendorCartCount');

  if (!container || !list) return;
  if (vendorInCart.length === 0) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  if (countLbl) countLbl.innerText = vendorInCart.length;

  list.innerHTML = vendorInCart.map((it, idx) => `
    <div class="p-2 bg-white rounded-xl border border-blue-200 flex items-center justify-between text-xs">
      <div>
        <span class="font-bold text-slate-800 font-mono">${it.partNumber}</span>
        <span class="text-blue-700 font-extrabold ml-2">${it.qty} L</span>
        <div class="text-[10px] text-slate-400">@ IDR ${it.hargaSatuan.toLocaleString('en-US')}</div>
      </div>
      <button type="button" onclick="removeVendorInCartItem(${idx})" class="text-rose-500 hover:text-rose-700 p-1">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `).join('');
}

function removeVendorInCartItem(idx) {
  vendorInCart.splice(idx, 1);
  renderVendorInCart();
}

function clearVendorInCart() {
  vendorInCart = [];
  renderVendorInCart();
}

async function submitPartInData() {
  const mode = document.querySelector('input[name="inSourceType"]:checked')?.value || 'VENDOR';
  const tanggal = document.getElementById('inDate').value.trim();
  const noDok = document.getElementById('inNoDok').value.trim();
  const storageId = document.getElementById('inStorage').value.trim();

  if (!tanggal) { showModalAlert("Required Field", "Please specify Receiving Date."); return; }
  if (!noDok) { showModalAlert("Required Field", "Please enter DO / Waybill No."); return; }

  const btn = document.getElementById('btnSubmitIn');
  const origBtnHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Committing Inbound Receiving...';

  let res;

  if (mode === 'TRANSFER_SJ') {
    const lookupRes = await callBackend('LOOKUP_TRANSFER_SJ', { site: currentSite, noSJ: noDok });
    if (!lookupRes.success || !lookupRes.data || lookupRes.data.length === 0) {
      showModalAlert("Waybill Verification Failed", "Unable to retrieve items for this transfer shipment.");
      btn.disabled = false;
      btn.innerHTML = origBtnHtml;
      return;
    }
    const originSite = lookupRes.data[0].originSite;
    const items = lookupRes.data.map(it => ({
      partNumber: it.partNumber,
      partDescription: it.partDescription,
      qtyTerima: it.qtyKirim,
      price: it.price,
      noSJ: it.noSJ,
      targetStorage: storageId
    }));

    res = await callBackend('CONFIRM_INBOUND_TRANSFER', {
      site: currentSite,
      originSite,
      tanggalTerima: tanggal,
      targetStorage: storageId,
      items
    });
  } else {
    const suppCode = document.getElementById('inSupplierCode').value.trim();
    const suppName = document.getElementById('inSupplierName').value.trim();

    if (!suppCode && !suppName) {
      showModalAlert("Required Field", "Please select Supplier / Vendor from master list.");
      btn.disabled = false;
      btn.innerHTML = origBtnHtml;
      return;
    }

    let itemsToProcess = [];
    if (vendorInCart.length > 0) {
      itemsToProcess = vendorInCart;
    } else {
      const partNumber = document.getElementById('inPart').value.trim();
      const qty = parseInt(document.getElementById('inQty').value, 10) || 0;
      const rawHarga = document.getElementById('inHarga').value.trim();
      const harga = parseFloat(rawHarga.replace(',', '.')) || 0;

      if (!partNumber) { showModalAlert("Required Field", "Please select Lubricant Item."); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }
      if (qty <= 0) { showModalAlert("Invalid Volume", "Please enter received volume greater than 0 L."); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }

      const itemMeta = liveItems.find(it => it.partNumber === partNumber) || { partDesc: partNumber, defaultPrice: 0 };
      itemsToProcess.push({
        partNumber,
        partDescription: itemMeta.partDesc,
        qty,
        hargaSatuan: harga > 0 ? harga : (itemMeta.defaultPrice || 0)
      });
    }

    const payload = {
      site: currentSite,
      tanggal,
      noDokumen: noDok,
      codeSupplier: suppCode || 'VENDOR',
      supplierDescription: suppName || 'VENDOR',
      targetStorage: storageId,
      items: itemsToProcess
    };
    res = await callBackend('SUBMIT_PART_IN', payload);
  }

  btn.disabled = false;
  btn.innerHTML = origBtnHtml;

  if (res.success) {
    clearVendorInCart();
    clearPartInSelection();
    clearSupplierSelection();
    document.getElementById('inNoDok').value = '';
    document.getElementById('inQty').value = '';
    document.getElementById('inHarga').value = '';
    document.getElementById('inboundCartContainer')?.classList.add('hidden');
    document.getElementById('lookupSJInput').value = '';

    fetchRecentPartIn();
    fetchAllTankStocks();
    checkPendingInboundTransfers(false);
    showModalAlert("Inbound Receiving Logged", res.message, true);
  } else {
    showModalAlert("Receiving Failed", res.message);
  }
}

async function fetchRecentPartIn() {
  const tbody = document.getElementById('tableRecentIn');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading inbound log...</td></tr>';

  const res = await callBackend('GET_RECENT_IN', { site: currentSite });
  if (res.success && res.data) {
    rawRecentInData = res.data;
    renderRecentInRows(rawRecentInData);
  } else {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Failed to load inbound records.</td></tr>';
  }
}

function renderRecentInRows(data) {
  const tbody = document.getElementById('tableRecentIn');
  if (!tbody) return;
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">No inbound receiving transactions recorded this period.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr class="hover:bg-slate-50 transition-colors font-medium text-slate-700">
      <td class="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">${r.tanggal}</td>
      <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-900 font-mono text-xs">${r.noDokumen}</td>
      <td class="py-2.5 px-3 whitespace-nowrap font-semibold text-slate-800">${r.supplier}</td>
      <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-700">${r.targetStorage}</td>
      <td class="py-2.5 px-3">
        <div class="font-bold text-slate-900 leading-tight font-mono">${r.partNumber}</div>
        <div class="text-[10px] text-slate-400 truncate max-w-[150px] leading-tight">${r.partDescription}</div>
      </td>
      <td class="py-2.5 px-3 text-right whitespace-nowrap">
        <span class="font-black font-mono text-blue-700">${Math.round(r.qty).toLocaleString('en-US')} L</span>
        <div class="text-[10px] text-slate-400 font-mono">@ IDR ${Number(r.hargaSatuan || 0).toLocaleString('en-US')}</div>
      </td>
    </tr>
  `).join('');
}

function filterRecentInTable() {
  const q = (document.getElementById('searchFilterIn')?.value || '').trim().toLowerCase();
  const st = (document.getElementById('storageFilterIn')?.value || '').trim().toLowerCase();
  const src = (document.getElementById('sourceFilterIn')?.value || '').trim();

  const filtered = rawRecentInData.filter(r => {
    const matchQ = !q || `${r.tanggal} ${r.noDokumen} ${r.supplier} ${r.partNumber} ${r.partDescription}`.toLowerCase().includes(q);
    const matchSt = !st || String(r.targetStorage).toLowerCase() === st;
    const isTrf = String(r.noDokumen).toUpperCase().startsWith('SJ') || String(r.supplier).toUpperCase().includes('TRANSFER');
    const matchSrc = !src || (src === 'TRANSFER' ? isTrf : !isTrf);
    return matchQ && matchSt && matchSrc;
  });
  renderRecentInRows(filtered);
}

// ==========================================
// 13. TAB 3: INTERNAL TRANSFER & DISPATCH
// ==========================================
function toggleTransferType(type) {
  const pInternal = document.getElementById('panelTargetInternal');
  const pSite = document.getElementById('panelTargetSite');
  const pMR = document.getElementById('panelTrfMR');
  const pPetugas = document.getElementById('panelTrfPetugas');
  const pNonSystem = document.getElementById('panelNonSystemSite');
  const pInterDetail = document.getElementById('panelInterSiteDetail');
  const btnSubmit = document.getElementById('lblBtnSubmitTrf');
  const badgeStoreLock = document.getElementById('badgeTrfStoreLock');

  if (type === 'INTER_SITE') {
    pInternal?.classList.add('hidden');
    pSite?.classList.remove('hidden');
    pMR?.classList.add('hidden');
    pPetugas?.classList.add('hidden');
    pInterDetail?.classList.remove('hidden');
    badgeStoreLock?.classList.remove('hidden');
    if (btnSubmit) btnSubmit.innerText = "🚀 Dispatch Inter-Site Shipment";

    // Kunci origin ke Store
    const storeTank = (liveStorages || []).find(s => {
      const t = String(s.type || '').toUpperCase();
      const n = String(s.storageName || s.storageId).toUpperCase();
      return t.includes('STORE') || t.includes('WAREHOUSE') || n.includes('STORE') || n.includes('GUDANG');
    });
    if (storeTank && document.getElementById('trfFromStorage')) {
      document.getElementById('trfFromStorage').value = storeTank.storageId;
    }
    populateDestinationSites();
  } else {
    pInternal?.classList.remove('hidden');
    pSite?.classList.add('hidden');
    pMR?.classList.remove('hidden');
    pPetugas?.classList.remove('hidden');
    pNonSystem?.classList.add('hidden');
    pInterDetail?.classList.add('hidden');
    badgeStoreLock?.classList.add('hidden');
    if (btnSubmit) btnSubmit.innerText = "⚡ Execute Internal Tank Transfer";
    updateTransferTargetOptions();
  }
}

function handleTrfFromStorageChange() {
  updateTransferTargetOptions();
  triggerCheckTrfStock();
}

function updateTransferTargetOptions() {
  const fromVal = document.getElementById('trfFromStorage')?.value;
  const toSel = document.getElementById('trfToStorage');
  if (!toSel) return;
  toSel.innerHTML = '<option value="">-- Select Destination --</option>';
  (liveStorages || []).forEach(s => {
    if (s.storageId !== fromVal) {
      toSel.innerHTML += `<option value="${s.storageId}">${s.storageName}</option>`;
    }
  });
}

function populateDestinationSites() {
  const sel = document.getElementById('trfToSite');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Select Destination Site --</option>';
  const sites = ['TTLP', 'TNPN'];
  sites.forEach(s => {
    if (s !== currentSite) {
      sel.innerHTML += `<option value="${s}">SITE ${s}</option>`;
    }
  });
  sel.innerHTML += '<option value="NON_SYSTEM">OTHER / NON-SYSTEM CONTRACTOR</option>';
}

function handleToSiteChange() {
  const toSite = document.getElementById('trfToSite')?.value;
  const pNonSys = document.getElementById('panelNonSystemSite');
  if (toSite === 'NON_SYSTEM') {
    pNonSys?.classList.remove('hidden');
  } else {
    pNonSys?.classList.add('hidden');
  }
  generateAutoSJNumber();
}

function generateAutoSJNumber() {
  const toSite = document.getElementById('trfToSite')?.value || 'DEST';
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const noSJ = `SJ/${currentSite}-${toSite}/${dateStr}/${rand}`;
  const inputSJ = document.getElementById('trfNoSJ');
  if (inputSJ) inputSJ.value = noSJ;
}

function addOliToTransferCart() {
  const fromStorage = document.getElementById('trfFromStorage').value.trim();
  const partNumber = document.getElementById('trfPart').value.trim();
  const qty = parseInt(document.getElementById('trfQty').value, 10) || 0;

  if (!fromStorage) { showModalAlert("Required Field", "Please select Origin Storage."); return; }
  if (!partNumber) { showModalAlert("Required Field", "Please select Lubricant Item."); return; }
  if (qty <= 0) { showModalAlert("Invalid Volume", "Please enter volume greater than 0 L."); return; }

  const itemMeta = liveItems.find(it => it.partNumber === partNumber) || { partDesc: partNumber, defaultPrice: 0 };
  transferCart.push({
    fromStorage,
    partNumber,
    partDescription: itemMeta.partDesc,
    qty,
    price: itemMeta.defaultPrice || 0
  });

  renderTransferCart();
  clearTrfPartSelection();
  document.getElementById('trfQty').value = '';
}

function renderTransferCart() {
  const container = document.getElementById('trfCartContainer');
  const list = document.getElementById('trfCartList');
  const countLbl = document.getElementById('trfCartCount');

  if (!container || !list) return;
  if (transferCart.length === 0) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  if (countLbl) countLbl.innerText = transferCart.length;

  list.innerHTML = transferCart.map((it, idx) => `
    <div class="p-2 bg-white rounded-xl border border-amber-200 flex items-center justify-between text-xs">
      <div>
        <span class="font-bold text-slate-800 font-mono">${it.partNumber}</span>
        <span class="text-amber-800 font-black ml-2">${it.qty} L</span>
        <div class="text-[10px] text-slate-400">From: ${it.fromStorage}</div>
      </div>
      <button type="button" onclick="removeTransferCartItem(${idx})" class="text-rose-500 hover:text-rose-700 p-1">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `).join('');
}

function removeTransferCartItem(idx) {
  transferCart.splice(idx, 1);
  renderTransferCart();
}

function clearTransferCart() {
  transferCart = [];
  renderTransferCart();
}

async function submitTransferData() {
  const mode = document.querySelector('input[name="trfTypeOption"]:checked')?.value || 'INTERNAL';
  const tanggal = document.getElementById('trfDate').value.trim();

  if (!tanggal) { showModalAlert("Required Field", "Please specify Transfer Date."); return; }

  const btn = document.getElementById('btnSubmitTrf');
  const origBtnHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Executing Transfer...';

  let res;

  if (mode === 'INTER_SITE') {
    const toSite = document.getElementById('trfToSite').value.trim();
    const noSJ = document.getElementById('trfNoSJ').value.trim();
    const driver = document.getElementById('trfDriver').value.trim();
    const isNonSystem = (toSite === 'NON_SYSTEM');
    const nonSysName = document.getElementById('trfNonSystemName')?.value.trim();

    if (!toSite) { showModalAlert("Required Field", "Please select Destination Site."); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }
    if (!noSJ) { showModalAlert("Required Field", "Waybill No is required."); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }

    let itemsToProcess = [];
    if (transferCart.length > 0) {
      itemsToProcess = transferCart;
    } else {
      const fromSt = document.getElementById('trfFromStorage').value.trim();
      const partNumber = document.getElementById('trfPart').value.trim();
      const qty = parseInt(document.getElementById('trfQty').value, 10) || 0;
      if (!fromSt || !partNumber || qty <= 0) {
        showModalAlert("Required Field", "Please select origin, item, and valid volume.");
        btn.disabled = false;
        btn.innerHTML = origBtnHtml;
        return;
      }
      const itemMeta = liveItems.find(it => it.partNumber === partNumber) || { partDesc: partNumber, defaultPrice: 0 };
      itemsToProcess.push({ fromStorage: fromSt, partNumber, partDescription: itemMeta.partDesc, qty, price: itemMeta.defaultPrice || 0 });
    }

    const payload = {
      site: currentSite,
      tanggal,
      toSite: isNonSystem ? nonSysName : toSite,
      isNonSystem,
      noSJ,
      driver,
      createdBy: currentUser || 'ADMIN',
      items: itemsToProcess
    };
    res = await callBackend('SUBMIT_TRANSFER_BATCH', payload);
  } else {
    const fromSt = document.getElementById('trfFromStorage').value.trim();
    const toSt = document.getElementById('trfToStorage').value.trim();
    const noMR = document.getElementById('trfMRNo').value.trim();
    const petugas = document.getElementById('trfPetugas').value.trim();

    if (!fromSt) { showModalAlert("Required Field", "Please select Origin Storage."); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }
    if (!toSt) { showModalAlert("Required Field", "Please select Destination Storage."); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }
    if (fromSt === toSt) { showModalAlert("Invalid Route", "Origin and Destination cannot be identical."); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }
    if (!noMR) { showModalAlert("Required Field", "Material Request (MR) No is required."); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }
    if (!petugas) { showModalAlert("Required Field", "Operator / Technician name is mandatory."); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }

    let itemsToProcess = [];
    if (transferCart.length > 0) {
      itemsToProcess = transferCart;
    } else {
      const partNumber = document.getElementById('trfPart').value.trim();
      const qty = parseInt(document.getElementById('trfQty').value, 10) || 0;
      if (!partNumber || qty <= 0) {
        showModalAlert("Required Field", "Please select item and valid volume.");
        btn.disabled = false;
        btn.innerHTML = origBtnHtml;
        return;
      }
      const itemMeta = liveItems.find(it => it.partNumber === partNumber) || { partDesc: partNumber, defaultPrice: 0 };
      itemsToProcess.push({ fromStorage: fromSt, partNumber, partDescription: itemMeta.partDesc, qty, price: itemMeta.defaultPrice || 0 });
    }

    const payload = {
      site: currentSite,
      transferType: 'INTERNAL',
      tanggal,
      fromStorage: fromSt,
      toStorage: toSt,
      noMR,
      petugas,
      createdBy: currentUser || 'ADMIN',
      items: itemsToProcess
    };
    res = await callBackend('SUBMIT_TRANSFER_LOCAL', payload);
  }

  btn.disabled = false;
  btn.innerHTML = origBtnHtml;

  if (res.success) {
    clearTransferCart();
    clearTrfPartSelection();
    document.getElementById('trfQty').value = '';
    fetchRecentMutasi();
    fetchAllTankStocks();
    showModalAlert("Transfer Completed", res.message, true);
  } else {
    showModalAlert("Transfer Rejected", res.message);
  }
}

async function fetchRecentMutasi() {
  const tbody = document.getElementById('tableRecentMutasi');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading transfer log...</td></tr>';

  const res = await callBackend('GET_RECENT_MUTASI', { site: currentSite });
  if (res.success && res.data) {
    rawRecentMutasiData = res.data;
    renderRecentMutasiRows(rawRecentMutasiData);
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Failed to load transfer records.</td></tr>';
  }
}

function renderRecentMutasiRows(data) {
  const tbody = document.getElementById('tableRecentMutasi');
  if (!tbody) return;
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">No transfer records found for this period.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr class="hover:bg-slate-50 transition-colors font-medium text-slate-700">
      <td class="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">${r.tanggal}</td>
      <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-800">${r.sourceStorage} → <span class="text-amber-800">${r.unitTarget}</span></td>
      <td class="py-2.5 px-3">
        <div class="font-bold text-slate-900 leading-tight font-mono">${r.partNumber}</div>
        <div class="text-[10px] text-slate-400 truncate max-w-[150px] leading-tight">${r.partDescription}</div>
      </td>
      <td class="py-2.5 px-3 text-right font-black font-mono text-amber-700 whitespace-nowrap">${Math.round(r.qty).toLocaleString('en-US')} L</td>
      <td class="py-2.5 px-3 text-[11px] text-slate-600 truncate max-w-[200px]">${r.keterangan}</td>
    </tr>
  `).join('');
}

function filterRecentMutasiTable() {
  const q = (document.getElementById('searchFilterMutasi')?.value || '').trim().toLowerCase();
  const type = (document.getElementById('typeFilterMutasi')?.value || '').trim();

  const filtered = rawRecentMutasiData.filter(r => {
    const matchQ = !q || `${r.tanggal} ${r.sourceStorage} ${r.unitTarget} ${r.partNumber} ${r.partDescription} ${r.keterangan}`.toLowerCase().includes(q);
    const isInter = String(r.issuedFor).includes('TRANSFER');
    const matchType = !type || (type === 'TRANSFER_SITE' ? isInter : !isInter);
    return matchQ && matchType;
  });
  renderRecentMutasiRows(filtered);
}

async function checkPendingInboundTransfers(showBanner = true) {
  const res = await callBackend('GET_PENDING_INBOUND_TRANSFERS', { site: currentSite });
  const banner = document.getElementById('bannerInboundTransit');
  const countLbl = document.getElementById('lblPendingSJCount');
  const kpiCount = document.getElementById('kpiInboundCount');

  const count = (res.success && res.sjCount !== undefined) ? res.sjCount : 0;
  if (kpiCount) kpiCount.innerText = count;

  if (count > 0) {
    if (countLbl) countLbl.innerText = `${count} SJ`;
    if (banner && showBanner) banner.classList.remove('hidden');
  } else {
    if (banner) banner.classList.add('hidden');
  }
}

// ==========================================
// 14. TAB 6: RETURN & REVERSAL MANAGEMENT
// ==========================================
function toggleReturnType(mode) {
  const pFleet = document.getElementById('panelReturnFleet');
  const pVendor = document.getElementById('panelReturnVendor');
  const bannerTxt = document.getElementById('bannerReturnModeTxt');
  const btnSubmit = document.getElementById('lblBtnSubmitReturn');
  const lblStorage = document.getElementById('lblRetStorage');
  const selStorage = document.getElementById('retStorage');

  if (mode === 'VENDOR') {
    pFleet?.classList.add('hidden');
    pVendor?.classList.remove('hidden');
    if (lblStorage) lblStorage.innerHTML = 'Source Warehouse (Tangki yang Dipotong) <span class="text-rose-500">*</span>';
    if (bannerTxt) bannerTxt.innerHTML = '<b>Vendor Inbound Reversal:</b> Returning lubricant to vendor/supplier. Storage stock will <b>decrease</b> and DO purchase amount will be <b>credited</b>.';
    if (btnSubmit) btnSubmit.innerText = '↩️ Commit Vendor DO Inbound Reversal';

    const storeTank = (liveStorages || []).find(s => {
      const type = String(s.type || '').toUpperCase();
      const name = String(s.storageName || s.storageId).toUpperCase();
      return type.includes('STORE') || type.includes('WAREHOUSE') || name.includes('STORE') || name.includes('GUDANG');
    });
    if (storeTank && selStorage) selStorage.value = storeTank.storageId;
  } else {
    pFleet?.classList.remove('hidden');
    pVendor?.classList.add('hidden');
    if (lblStorage) lblStorage.innerHTML = 'Receiving Storage (Target Tank) <span class="text-rose-500">*</span>';
    if (bannerTxt) bannerTxt.innerHTML = '<b>Fleet Dispense Reversal:</b> Returning lubricant to tank from heavy equipment. Storage stock will <b>increase</b> and fleet consumption will be <b>deducted</b>.';
    if (btnSubmit) btnSubmit.innerText = '↩️ Commit Fleet Dispense Reversal';
  }
  triggerCheckReturnStock();
}

async function submitReturnData() {
  const mode = document.querySelector('input[name="retTypeOption"]:checked')?.value || 'FLEET';
  const tanggal = document.getElementById('retDate').value.trim();
  const storageId = document.getElementById('retStorage').value.trim();
  const partNumber = document.getElementById('retPart').value.trim();
  const qty = parseInt(document.getElementById('retQty').value, 10) || 0;
  const petugas = document.getElementById('retPetugas').value.trim();
  const alasan = document.getElementById('retAlasan').value.trim();

  if (!tanggal) { showModalAlert("Required Field", "Please specify Return Date."); return; }
  if (!storageId) { showModalAlert("Required Field", "Please select Target/Source Storage."); return; }
  if (!partNumber) { showModalAlert("Required Field", "Please select Lubricant Item."); return; }
  if (qty <= 0) { showModalAlert("Invalid Volume", "Return volume must be an integer greater than 0 L."); return; }
  if (!petugas) { showModalAlert("Required Field", "Executor / Technician name is mandatory."); return; }
  if (!alasan || alasan.length < 5) {
    showModalAlert("Mandatory Reason", "Please provide a clear justification reason (min. 5 characters) for audit transparency.");
    document.getElementById('retAlasan').focus();
    return;
  }

  const btn = document.getElementById('btnSubmitReturn');
  const origBtnHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Committing Reversal...';

  const itemMeta = liveItems.find(i => i.partNumber === partNumber) || { partDesc: partNumber, defaultPrice: 0 };
  let res;

  if (mode === 'FLEET') {
    const unitId = document.getElementById('retUnit').value.trim();
    if (!unitId) {
      showModalAlert("Required Field", "Please select Fleet Equipment ID being corrected.");
      btn.disabled = false;
      btn.innerHTML = origBtnHtml;
      return;
    }
    const unitMeta = liveUnits.find(u => u.unitId === unitId) || { desc: '-', model: '-' };
    const hm = parseFloat(document.getElementById('retHM').value) || 0;
    const chargeSite = document.getElementById('retChargeSite').value.trim() || currentSite;

    const payload = {
      site: currentSite,
      tanggal,
      targetStorage: storageId,
      partNumber,
      partDescription: itemMeta.partDesc,
      qty,
      price: itemMeta.defaultPrice || 0,
      unitId,
      hm,
      unitDescription: unitMeta.desc,
      model: unitMeta.model,
      chargeSite,
      petugas,
      alasan,
      createdBy: currentUser || 'ADMIN'
    };
    res = await callBackend('SUBMIT_RETURN_OUT', payload);
  } else {
    const noDok = document.getElementById('retNoDok').value.trim();
    const suppCode = document.getElementById('retSupplierCode').value.trim();
    const suppName = document.getElementById('retSupplierName').value.trim();
    const rawHarga = document.getElementById('retHarga').value.trim();
    const hargaSatuan = parseFloat(rawHarga.replace(',', '.')) || (itemMeta.defaultPrice || 0);

    if (!noDok) {
      showModalAlert("Required Field", "Reference DO / Waybill No. is required for vendor reversal.");
      btn.disabled = false;
      btn.innerHTML = origBtnHtml;
      return;
    }

    const payload = {
      site: currentSite,
      tanggal,
      sourceStorage: storageId,
      partNumber,
      partDescription: itemMeta.partDesc,
      qty,
      noDokumen: noDok,
      codeSupplier: suppCode || 'VENDOR',
      supplierDescription: suppName || 'VENDOR',
      hargaSatuan,
      petugas,
      alasan,
      createdBy: currentUser || 'ADMIN'
    };
    res = await callBackend('SUBMIT_RETURN_IN', payload);
  }

  btn.disabled = false;
  btn.innerHTML = origBtnHtml;

  if (res.success) {
    document.getElementById('retQty').value = '';
    document.getElementById('retPetugas').value = '';
    document.getElementById('retAlasan').value = '';
    document.getElementById('retNoDok').value = '';
    clearRetUnitSelection();
    clearRetSupplierSelection();
    clearRetPartSelection();

    fetchRecentReturns();
    fetchRecentPartOut();
    fetchRecentPartIn();
    fetchAllTankStocks();
    fetchExecutiveKPI();

    showModalAlert("Reversal Processed", res.message, true);
  } else {
    showModalAlert("Reversal Rejected", res.message);
  }
}

async function fetchRecentReturns() {
  const tbody = document.getElementById('tableRecentReturns');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading reversal records...</td></tr>';

  const res = await callBackend('GET_RECENT_RETURNS', { site: currentSite });
  if (res.success && res.data) {
    rawRecentReturnData = res.data;
    renderRecentReturnRows(rawRecentReturnData);
  } else {
    tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400">Failed to load return records.</td></tr>';
  }
}

function renderRecentReturnRows(data) {
  const tbody = document.getElementById('tableRecentReturns');
  if (!tbody) return;
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400">No return/reversal transactions recorded for this period.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(r => {
    const isFleet = r.category === 'FLEET_RETURN';
    const catBadge = isFleet
      ? '<span class="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-extrabold text-[9px] font-mono">FLEET REVERSAL</span>'
      : '<span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-extrabold text-[9px] font-mono">VENDOR RETUR</span>';

    return `
      <tr class="hover:bg-slate-50 transition-colors font-medium text-slate-700">
        <td class="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">${r.tanggal}</td>
        <td class="py-2.5 px-3 whitespace-nowrap">${catBadge}</td>
        <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-900 font-mono text-xs">${r.refId || '-'}</td>
        <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-800">${r.storage || '-'}</td>
        <td class="py-2.5 px-3">
          <div class="font-bold text-slate-900 leading-tight font-mono">${r.partNumber}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[150px] leading-tight">${r.partDescription}</div>
        </td>
        <td class="py-2.5 px-3 text-right font-black font-mono text-teal-700 whitespace-nowrap">
          ${isFleet ? '+' : '-'}${Math.round(Number(r.qty)).toLocaleString('en-US')} L
        </td>
        <td class="py-2.5 px-3">
          <div class="text-[11px] text-slate-800 font-semibold truncate max-w-[200px]">${r.keterangan || '-'}</div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterRecentReturnTable() {
  const q = (document.getElementById('searchFilterReturn')?.value || '').trim().toLowerCase();
  const cat = (document.getElementById('typeFilterReturn')?.value || '').trim();

  const filtered = rawRecentReturnData.filter(r => {
    const matchCat = !cat || r.category === cat;
    const matchText = !q || `${r.tanggal} ${r.refId || ''} ${r.storage || ''} ${r.partNumber} ${r.partDescription || ''} ${r.keterangan || ''}`.toLowerCase().includes(q);
    return matchCat && matchText;
  });
  renderRecentReturnRows(filtered);
}

// ==========================================
// 15. TAB 4: STOCK BALANCE & RECONCILIATION
// ==========================================
async function fetchStockBalancePreview() {
  const month = document.getElementById('balMonth').value;
  const year = document.getElementById('balYear').value;
  const storageId = document.getElementById('balStorage').value;

  const tbody = document.getElementById('tableBalanceBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Calculating inventory reconciliation...</td></tr>';

  const res = await callBackend('GET_STOCK_BALANCE_PREVIEW', { site: currentSite, month, year, storageId });
  if (res.success && res.data) {
    balancePreviewData = res.data;
    renderStockBalanceTable(balancePreviewData);

    const isLocked = (res.periodStatus === 'FINAL_LOCKED');
    const lockBanner = document.getElementById('badgePeriodLockedBanner');
    if (lockBanner) {
      if (isLocked) lockBanner.classList.remove('hidden');
      else lockBanner.classList.add('hidden');
    }

    if (document.getElementById('kpiPeriodStatusBadge')) {
      document.getElementById('kpiPeriodStatusBadge').innerText = res.periodStatus;
    }
  } else {
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-400">${res.message || 'Failed to calculate balance.'}</td></tr>`;
  }
}

function renderStockBalanceTable(items) {
  const tbody = document.getElementById('tableBalanceBody');
  if (!tbody) return;
  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400">No storage inventory matching selected criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((r, idx) => {
    const diff = Math.round(Number(r.soundingQty || r.qtyAkhirBuku) - Number(r.qtyAkhirBuku));
    const isMatched = Math.abs(diff) <= 10;
    const badgeDiff = isMatched
      ? `<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-mono text-[10px]">${diff > 0 ? '+' : ''}${diff} L (Safe)</span>`
      : `<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-black font-mono text-[10px]">${diff > 0 ? '+' : ''}${diff} L (Variance)</span>`;

    return `
      <tr class="hover:bg-slate-50 transition-colors text-xs font-medium text-slate-700">
        <td class="p-3 font-bold font-mono text-slate-900">${r.storageId}</td>
        <td class="p-3">
          <div class="font-bold text-slate-900 font-mono">${r.partNumber}</div>
          <div class="text-[10px] text-slate-400">${r.partDesc}</div>
        </td>
        <td class="p-3 text-right font-mono">${Math.round(r.qtyAwal).toLocaleString('en-US')}</td>
        <td class="p-3 text-right font-mono text-blue-700 font-bold">+${Math.round(r.qtyMasuk).toLocaleString('en-US')}</td>
        <td class="p-3 text-right font-mono text-amber-700 font-bold">-${Math.round(r.qtyKeluar).toLocaleString('en-US')}</td>
        <td class="p-3 text-right font-mono font-black text-slate-900 bg-slate-100">${Math.round(r.qtyAkhirBuku).toLocaleString('en-US')}</td>
        <td class="p-3 text-center">
          <input type="number" step="1" value="${Math.round(r.soundingQty !== null ? r.soundingQty : r.qtyAkhirBuku)}" oninput="updateRowSounding(${idx}, this.value)" class="w-24 text-center font-mono font-black text-slate-900 form-input-sm py-1 bg-white border-amber-300">
        </td>
        <td class="p-3 text-right">${badgeDiff}</td>
        <td class="p-3 text-center">
          <button type="button" onclick="setRowSoundingExact(${idx})" title="Match to book balance" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold">
            Match
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function updateRowSounding(idx, val) {
  if (!balancePreviewData[idx]) return;
  balancePreviewData[idx].soundingQty = parseInt(val, 10) || 0;
}

function setRowSoundingExact(idx) {
  if (!balancePreviewData[idx]) return;
  balancePreviewData[idx].soundingQty = Math.round(balancePreviewData[idx].qtyAkhirBuku);
  renderStockBalanceTable(balancePreviewData);
}

function quickFillSoundingFromBook() {
  if (!balancePreviewData || balancePreviewData.length === 0) return;
  balancePreviewData.forEach(r => {
    r.soundingQty = Math.round(r.qtyAkhirBuku);
  });
  renderStockBalanceTable(balancePreviewData);
  showModalAlert("Sounding Synchronized", "All physical sounding fields have been mirrored to match system book balances.", true);
}

async function saveStockBalanceData(isFinalLock = false) {
  if (!balancePreviewData || balancePreviewData.length === 0) {
    showModalAlert("Empty Reconciliation", "Please calculate and review reconciliation before saving.");
    return;
  }

  const month = document.getElementById('balMonth').value;
  const year = document.getElementById('balYear').value;

  const payload = {
    site: currentSite,
    month,
    year,
    role: currentRole,
    createdBy: currentUser || 'ADMIN',
    setAsNextOpening: document.getElementById('checkSetAsOpening')?.checked || false,
    nextCutOffDate: `${year}-${month}-01`,
    items: balancePreviewData
  };

  const res = await callBackend('SAVE_STOCK_BALANCE', payload);
  if (res.success) {
    showModalAlert(isFinalLock ? "Period Finalized" : "Draft Saved", res.message, true);
    fetchStockBalancePreview();
  } else {
    showModalAlert("Failed to Save", res.message);
  }
}

// ==========================================
// 16. EXPORT CSV MANAGEMENT
// ==========================================
function downloadCSV(reportType) {
  activeExportType = reportType;
  const modal = document.getElementById('modalExportCSV');
  const title = document.getElementById('lblExportTitle');

  if (title) {
    if (reportType === 'OUT') title.innerText = "Export Dispense Log (Part Out)";
    else if (reportType === 'IN') title.innerText = "Export Inbound Receiving Log (Part In)";
    else if (reportType === 'MUTASI') title.innerText = "Export Transfer & Dispatch Log";
    else if (reportType === 'RETURN') title.innerText = "Export Return & Reversal Audit Log";
    else title.innerText = "Export Stock Balance Reconciliation";
  }

  if (modal) modal.classList.remove('hidden');
}

function closeExportModal() {
  document.getElementById('modalExportCSV')?.classList.add('hidden');
}

function toggleExportMode(mode) {
  const pMonth = document.getElementById('exportPanelMonth');
  const pRange = document.getElementById('exportPanelRange');
  if (mode === 'RANGE') {
    pMonth?.classList.add('hidden');
    pRange?.classList.remove('hidden');
  } else {
    pMonth?.classList.remove('hidden');
    pRange?.classList.add('hidden');
  }
}

async function executeDownloadCSV() {
  const mode = document.querySelector('input[name="exportMode"]:checked')?.value || 'MONTH';
  const month = document.getElementById('exportMonth')?.value || '';
  const year = document.getElementById('exportYear')?.value || '';
  const startDate = document.getElementById('exportStartDate')?.value || '';
  const endDate = document.getElementById('exportEndDate')?.value || '';

  const btn = document.getElementById('btnExecuteDownloadCSV');
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Generating CSV...';

  let exportHeaders = [];
  let exportRows = [];

  if (activeExportType === 'RETURN') {
    exportHeaders = ["Tanggal", "Kategori", "Referensi (Unit / DO)", "Tangki", "Kode Part", "Nama Pelumas", "Qty (Liter)", "Justifikasi"];
    exportRows = rawRecentReturnData.map(r => [
      r.tanggal,
      r.categoryLabel || r.category,
      r.refId || '-',
      r.storage || '-',
      r.partNumber,
      r.partDescription,
      r.qty,
      r.keterangan || '-'
    ]);
  } else {
    const payload = {
      site: currentSite,
      reportType: activeExportType,
      mode,
      month,
      year,
      startDate,
      endDate
    };
    const res = await callBackend('EXPORT_REPORT_DATA', payload);
    if (!res.success || !res.rows || res.rows.length === 0) {
      showModalAlert("Empty Export", res.message || "No records match the requested interval.");
      btn.disabled = false;
      btn.innerHTML = origHtml;
      return;
    }
    exportHeaders = res.headers || [];
    exportRows = res.rows || [];

    // Hapus kolom "No" di index 0 jika ada
    if (exportHeaders.length > 0 && String(exportHeaders[0]).trim().toLowerCase() === 'no') {
      exportHeaders = exportHeaders.slice(1);
      exportRows = exportRows.map(row => row.slice(1));
    }
  }

  btn.disabled = false;
  btn.innerHTML = origHtml;

  let csvContent = "\uFEFF";
  csvContent += exportHeaders.map(h => `"${h}"`).join(";") + "\r\n";
  exportRows.forEach(row => {
    csvContent += row.map(val => `"${val !== null && val !== undefined ? String(val).replace(/"/g, '""') : ''}"`).join(";") + "\r\n";
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Laporan_${activeExportType}_${currentSite}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  closeExportModal();
}

// ==========================================
// 17. SYSTEM MODAL DIALOGS
// ==========================================
function showModalAlert(title, message, isSuccess = false, callback = null) {
  const modal = document.getElementById('modalAlertBox');
  const icon = document.getElementById('modalAlertIcon');
  const titleElem = document.getElementById('modalAlertTitle');
  const msgElem = document.getElementById('modalAlertMsg');

  if (titleElem) titleElem.innerText = title;
  if (msgElem) msgElem.innerText = message;
  modalCallback = callback;

  if (icon) {
    if (isSuccess) {
      icon.className = "w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-4 bg-emerald-50 text-emerald-600";
      icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    } else {
      icon.className = "w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-4 bg-rose-50 text-rose-600";
      icon.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';
    }
  }

  if (modal) {
    modal.classList.remove('hidden');
    document.getElementById('modalBtnOk')?.focus();
  }
}

function closeModalAlert() {
  document.getElementById('modalAlertBox')?.classList.add('hidden');
  if (typeof modalCallback === 'function') {
    modalCallback();
    modalCallback = null;
  }
}

function handleModalKeydown(e) {
  if (e.key === 'Enter' || e.key === 'Escape') {
    e.preventDefault();
    closeModalAlert();
  }
}

function openAboutModal() {
  document.getElementById('modalAboutSystem')?.classList.remove('hidden');
}
function closeAboutModal() {
  document.getElementById('modalAboutSystem')?.classList.add('hidden');
}

function openPendingInboundModal() {
  document.getElementById('modalPendingInbound')?.classList.remove('hidden');
}
function closePendingInboundModal() {
  document.getElementById('modalPendingInbound')?.classList.add('hidden');
}
