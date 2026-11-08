/**
 * ============================================================================
 * MODUL 1: STATE, API BRIDGE & AUTHENTICATION (01_state_auth.js)
 * LOG DISPENSE MANAGEMENT SYSTEM v3.5 ENTERPRISE
 * PT.KTC Coal Mining & Energy
 * Architect & Lead Engineer: Adi Pranata
 * ============================================================================
 */

// ==========================================
// 1. GLOBAL CONFIGURATION & STATE
// ==========================================
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbx2JMKLEla_q7_EkeyZFtx4sx6HvZ6VObqY4S8DQCG0pNJsCqv3hHdwBpWB7z8fkeZkNg/exec";

let currentUser = null;
let currentFullName = "";
let currentRole = "ADMIN";
let currentSite = "TTLP";
let sessionToken = null;

let liveItems = [];
let liveSuppliers = [];
let liveUnits = [];
let liveStorages = [];
let currentAvailableStock = 0;
let balancePreviewData = [];
let isPeriodLocked = false;

let rawRecentOutData = [];
let rawRecentInData = [];
let rawRecentMutasiData = [];
let rawRecentReturnData = [];
let modalCallback = null;

let serviceCart = [];
let transferCart = [];
let vendorInCart = [];
let pendingInboundGrouped = {};
let pendingInboundListRaw = [];

// Combobox States (Keyboard Navigation)
let currentFilteredUnits = [];
let activeUnitIndex = -1;
let currentFilteredParts = [];
let activePartIndex = -1;
let currentFilteredInParts = [];
let activePartInIndex = -1;
let currentFilteredTrfParts = [];
let activeTrfPartIndex = -1;
let currentFilteredSuppliers = [];
let activeSupplierIndex = -1;

// Combobox States - Tab Return
let currentFilteredRetUnits = [];
let activeRetUnitIndex = -1;
let currentFilteredRetSuppliers = [];
let activeRetSupplierIndex = -1;
let currentFilteredRetParts = [];
let activeRetPartIndex = -1;

let selectedUnitLastHM = 0;
let isHMValid = true;
let activeExportType = 'OUT';

// Hybrid Adjust Modal State
let currentHybridAllocations = [];
let currentHybridItemMeta = null;

// ==========================================
// 2. BACKEND API CALL BRIDGE
// ==========================================
async function callBackend(action, payload = {}) {
  try {
    if (sessionToken && !payload.token) {
      payload.token = sessionToken;
    }
    const bodyData = JSON.stringify({ action: action, payload: payload });
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: bodyData
    });
    if (!response.ok) throw new Error(`HTTP Error status: ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error("Central Database Communication Failed:", err);
    return { success: false, message: "Database Connection Timed Out: " + err.message };
  }
}

// ==========================================
// 3. AUTHENTICATION & SESSION MANAGEMENT
// ==========================================
async function submitLogin() {
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value.trim();
  const btn = document.getElementById('btnLogin');

  if (!u || !p) {
    showModalAlert("Authentication Failed", "Please enter both User ID and Password.");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Authenticating...</span>';

  const res = await callBackend('LOGIN', { username: u, password: p });
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i><span>Authenticate & Access</span>';

  if (res.success && res.user) {
    currentUser = res.user.username;
    currentFullName = res.user.fullName || res.user.username;
    currentRole = res.user.role || 'ADMIN';
    currentSite = (res.user.siteAccess && res.user.siteAccess !== 'ALL') ? res.user.siteAccess : 'TTLP';
    sessionToken = res.token || null;

    document.getElementById('lblUserFullName').innerText = currentFullName;
    document.getElementById('lblUserRoleSite').innerText = `${currentRole} • SITE ${currentSite}`;

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

    filterToSiteOptions();

    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('mainAppSection').classList.remove('hidden');

    const todayStr = new Date().toISOString().split('T')[0];
    if (document.getElementById('outDate')) document.getElementById('outDate').value = todayStr;
    if (document.getElementById('inDate')) document.getElementById('inDate').value = todayStr;
    if (document.getElementById('trfDate')) document.getElementById('trfDate').value = todayStr;
    if (document.getElementById('retDate')) document.getElementById('retDate').value = todayStr;
    updateNextPeriodLabel();

    fetchInitialMasterData();
    initAppDashboard();
  } else {
    showModalAlert("Access Denied", res.message || "Invalid credentials or account suspended.");
  }
}

function handleLogout() {
  currentUser = null;
  sessionToken = null;
  document.getElementById('loginPassword').value = '';
  document.getElementById('mainAppSection').classList.add('hidden');
  document.getElementById('loginSection').classList.remove('hidden');
}

function switchSite(newSite) {
  if (currentRole !== 'SUPERADMIN') return;
  currentSite = newSite;
  document.getElementById('lblUserRoleSite').innerText = `${currentRole} • SITE ${currentSite}`;
  filterToSiteOptions();
  fetchInitialMasterData();
  initAppDashboard();
}

function filterToSiteOptions() {
  const selToSite = document.getElementById('trfToSite');
  if (!selToSite) return;
  const allSites = ['TTLP', 'TNPN'];
  selToSite.innerHTML = '<option value="">-- Select Destination Site --</option>';
  allSites.forEach(s => {
    if (s !== currentSite) {
      selToSite.innerHTML += `<option value="${s}">SITE ${s}</option>`;
    }
  });
  selToSite.innerHTML += '<option value="NON_SYSTEM">OTHER / NON-SYSTEM CONTRACTOR (Custom Entry)</option>';
  handleToSiteChange();
}

function handleToSiteChange() {
  const sel = document.getElementById('trfToSite');
  const val = sel ? sel.value : '';
  const pNon = document.getElementById('panelNonSystemSite');
  const btn = document.getElementById('lblBtnSubmitTrf');

  if (val === 'NON_SYSTEM') {
    if (pNon) pNon.classList.remove('hidden');
    if (btn) btn.innerText = "🚀 Final Dispatch to Non-System Contractor";
  } else {
    if (pNon) pNon.classList.add('hidden');
    if (btn) {
      const isInter = document.querySelector('input[name="trfTypeOption"]:checked')?.value === 'INTER_SITE';
      btn.innerText = isInter ? "🚀 Dispatch Inter-Site Shipment" : "⚡ Execute Internal Tank Transfer";
    }
  }
  generateAutoSJNumber();
}

function generateAutoSJNumber() {
  const isInter = document.querySelector('input[name="trfTypeOption"]:checked')?.value === 'INTER_SITE';
  const toSiteSelect = document.getElementById('trfToSite');
  const sjInput = document.getElementById('trfNoSJ');
  if (!isInter || !toSiteSelect || !sjInput) return;

  let toSite = toSiteSelect.value.trim();
  if (!toSite) {
    sjInput.value = '';
    sjInput.placeholder = "Select destination site first...";
    return;
  }

  if (toSite === 'NON_SYSTEM') {
    const customName = document.getElementById('trfNonSystemName')?.value.trim();
    toSite = customName ? customName.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10) : 'EXT';
  }

  const tglVal = document.getElementById('trfDate')?.value || new Date().toISOString().split('T')[0];
  const dClean = tglVal.replace(/-/g, '');
  const originSite = String(currentSite || 'TTLP').trim().toUpperCase();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  sjInput.value = `SJ/${originSite}-${toSite}/${dClean}/${randomSuffix}`;
}

function initAppDashboard() {
  fetchExecutiveKPI();
  fetchRecentPartOut();
  fetchRecentPartIn();
  fetchRecentMutasi();
  fetchRecentReturns();
  fetchAllTankStocks();
  checkPendingInboundTransfers();
}

// ==========================================
// 4. EXECUTIVE KPI METRICS
// ==========================================
async function fetchExecutiveKPI() {
  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = monthNames[now.getMonth()];
  const currentYear = now.getFullYear();

  const res = await callBackend('GET_EXECUTIVE_KPI', {
    site: currentSite,
    month: currentMonth,
    year: currentYear
  });

  if (res.success && res.data) {
    const d = res.data;
    const volEl = document.getElementById('kpiDispenseVolume');
    const costEl = document.getElementById('kpiDispenseCost');
    const unitEl = document.getElementById('kpiTopUnitId');
    const unitVolEl = document.getElementById('kpiTopUnitVol');
    const monthEl = document.getElementById('kpiDispenseMonth');

    if (volEl) volEl.innerText = Math.round(Number(d.totalVolume || 0)).toLocaleString('en-US');
    if (costEl) costEl.innerText = Math.round(Number(d.totalCost || 0)).toLocaleString('en-US');
    if (unitEl) unitEl.innerText = d.topUnit && d.topUnit !== '-' ? d.topUnit : 'None Recorded';
    if (unitVolEl) unitVolEl.innerText = d.topVolume ? `${Math.round(d.topVolume).toLocaleString('en-US')} L` : '0 L';
    if (monthEl) monthEl.innerText = `Active Period: ${d.month} ${d.year}`;
  }
}

// ==========================================
// 5. TAB NAVIGATION CONTROLLER
// ==========================================
function switchTab(targetTabId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
  const targetPane = document.getElementById(targetTabId);
  if (targetPane) targetPane.classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.className = "nav-btn px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 font-semibold flex items-center gap-2 transition-all";
    const icon = btn.querySelector('i');
    if (icon) icon.className = icon.className.replace('text-amber-600', '');
  });

  const navBtnMap = {
    'tab-monitoring': 'nav-monitoring',
    'tab-out': 'nav-out',
    'tab-in': 'nav-in',
    'tab-transfer': 'nav-transfer',
    'tab-return': 'nav-return',
    'tab-balance': 'nav-balance'
  };

  const activeBtn = document.getElementById(navBtnMap[targetTabId]);
  if (activeBtn) {
    activeBtn.className = "nav-btn px-4 py-2 rounded-xl bg-white text-slate-900 shadow-sm border border-slate-200/20 font-black flex items-center gap-2 transition-all";
    const icon = activeBtn.querySelector('i');
    if (icon) icon.classList.add('text-amber-600');
  }

  if (targetTabId === 'tab-in' || targetTabId === 'tab-monitoring') {
    checkPendingInboundTransfers(false);
  } else if (targetTabId === 'tab-transfer') {
    fetchRecentMutasi();
  } else if (targetTabId === 'tab-return') {
    fetchRecentReturns();
  }
}

// ==========================================
// 6. MASTER DATA LOADER
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

function lockInStorageToWarehouse(storages) {
  const sel = document.getElementById('inStorage');
  if (!sel) return;
  sel.innerHTML = '';
  const targetSite = String(currentSite || 'TTLP').trim().toUpperCase();

  let warehouseTank = (storages || []).find(s => {
    const sSite = String(s.site || '').trim().toUpperCase();
    const type = String(s.type || '').toUpperCase();
    const name = String(s.storageName || s.storageId).toUpperCase();
    const isSiteMatch = (sSite === targetSite || sSite === 'ALL' || name.includes(targetSite));
    const isStoreType = type.includes('STORE') || type.includes('WAREHOUSE') || name.includes('STORE') || name.includes('GUDANG') || name.includes('MAIN');
    return isSiteMatch && isStoreType;
  });

  if (!warehouseTank) {
    warehouseTank = (storages || []).find(s => {
      const sSite = String(s.site || '').trim().toUpperCase();
      const type = String(s.type || '').toUpperCase();
      return (sSite === targetSite || sSite === 'ALL') && !type.includes('TRUCK');
    });
  }

  if (warehouseTank) {
    sel.innerHTML = `<option value="${warehouseTank.storageId}" selected>${warehouseTank.storageId} - ${warehouseTank.storageName}</option>`;
  } else {
    sel.innerHTML = `<option value="" selected>⚠️ Site ${targetSite} Store Tank Not Found in Master Repository</option>`;
  }
}

function populateSelect(elemId, dataList, valKey, labelKey, defaultFirstText = null) {
  const sel = document.getElementById(elemId);
  if (!sel) return;
  sel.innerHTML = defaultFirstText !== null ? `<option value="">${defaultFirstText}</option>` : `<option value="">-- Select --</option>`;
  dataList.forEach(item => {
    const val = item[valKey];
    const lbl = item[labelKey] || val;
    sel.innerHTML += `<option value="${val}">${val} - ${lbl}</option>`;
  });
}

// ==========================================
// 7. DOM INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const currentYear = new Date().getFullYear();
  const balY = document.getElementById('balYear');
  if (balY) balY.value = currentYear;
  const expY = document.getElementById('exportYear');
  if (expY) expY.value = currentYear;

  const bM = document.getElementById('balMonth');
  if (bM) bM.addEventListener('change', updateNextPeriodLabel);
  if (balY) balY.addEventListener('input', updateNextPeriodLabel);
});