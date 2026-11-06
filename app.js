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
// 7. KEYBOARD NAVIGATION & COMBOBOX ENGINE
// ==========================================
function genericRenderPartDropdown(containerId, items, activeIdx, clickFnName, activeBg = 'bg-amber-100/80') {
  const dropdown = document.getElementById(containerId);
  if (!dropdown) return;
  if (!items || items.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs italic">Lubricant product not found</div>';
    return;
  }
  dropdown.innerHTML = items.map((p, idx) => {
    const pNum = p.partNumber || '';
    const pDesc = p.partDesc || pNum;
    const pSatuan = p.satuan || 'LTR';
    const isSelected = idx === activeIdx;
    return `
      <div id="${containerId}-opt-${idx}" onclick="${clickFnName}('${pNum}')" class="p-2.5 ${isSelected ? activeBg + ' font-bold' : 'hover:bg-slate-50'} cursor-pointer transition-colors flex items-center justify-between text-xs">
        <div class="truncate pr-2">
          <div class="flex items-center gap-1.5">
            <span class="font-black text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">${pNum}</span>
            <span class="font-medium text-slate-600 truncate">${pDesc}</span>
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5 ml-0.5">Unit: <span class="font-semibold text-slate-600">${pSatuan}</span></div>
        </div>
        <i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
      </div>
    `;
  }).join('');

  if (activeIdx >= 0) {
    const activeEl = document.getElementById(`${containerId}-opt-${activeIdx}`);
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }
}

function genericHandleKeydown(e, dropdownId, filteredList, activeIdx, selectFn, renderFn) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return activeIdx;
  const isHidden = dropdown.classList.contains('hidden');

  if (isHidden) {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      dropdown.classList.remove('hidden');
      e.preventDefault();
    }
    return activeIdx;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (filteredList.length > 0) {
      activeIdx = (activeIdx + 1) % filteredList.length;
      renderFn(filteredList, activeIdx);
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (filteredList.length > 0) {
      activeIdx = (activeIdx - 1 + filteredList.length) % filteredList.length;
      renderFn(filteredList, activeIdx);
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (activeIdx >= 0 && activeIdx < filteredList.length) {
      selectFn(filteredList[activeIdx].partNumber || filteredList[activeIdx].unitId || filteredList[activeIdx].kode);
    } else if (filteredList.length === 1) {
      selectFn(filteredList[0].partNumber || filteredList[0].unitId || filteredList[0].kode);
    }
  } else if (e.key === 'Escape') {
    dropdown.classList.add('hidden');
  }
  return activeIdx;
}

// 7.1. Part Out Combobox
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
  activePartIndex = filtered.length > 0 ? 0 : -1;
  renderPartDropdownItems(filtered, activePartIndex);
}
function handlePartKeydown(e) {
  activePartIndex = genericHandleKeydown(e, 'partDropdownList', currentFilteredParts, activePartIndex, selectPartItem, (l, i) => renderPartDropdownItems(l, i));
}
function selectPartItem(partNum) {
  const p = liveItems.find(item => String(item.partNumber) === String(partNum));
  if (!p) return;
  document.getElementById('outPart').value = p.partNumber;
  document.getElementById('partSearchInput').value = `${p.partNumber} — ${p.partDesc || ''}`;
  document.getElementById('labelPartDesc').innerText = p.partDesc || '-';
  document.getElementById('btnClearPart').classList.remove('hidden');
  document.getElementById('partDropdownList').classList.add('hidden');
  triggerCheckStock();

  // ALUR ENTER: Jika sedang mode batch service -> fokus ke outQty, jika normal -> fokus ke unitSearchInput
  if (serviceCart.length > 0) {
    const nextInput = document.getElementById('outQty');
    if (nextInput) { nextInput.focus(); nextInput.select(); }
  } else {
    const nextInput = document.getElementById('unitSearchInput');
    if (nextInput) nextInput.focus();
  }
}
function clearPartSelection() {
  document.getElementById('outPart').value = '';
  document.getElementById('partSearchInput').value = '';
  document.getElementById('labelPartDesc').innerText = '-';
  document.getElementById('labelLiveStock').innerHTML = 'Available: <span class="text-amber-700 font-mono">0 L</span>';
  document.getElementById('btnClearPart').classList.add('hidden');
  currentAvailableStock = 0;
  renderPartDropdownItems(liveItems);
  document.getElementById('partSearchInput').focus();
}

// 7.2. Fleet Unit ID Combobox
function renderUnitDropdownItems(units, idx = -1) {
  const dropdown = document.getElementById('unitDropdownList');
  if (!dropdown) return;
  currentFilteredUnits = units || [];
  activeUnitIndex = idx;

  if (!units || units.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs italic">Fleet equipment not found</div>';
    return;
  }

  dropdown.innerHTML = units.map((u, i) => {
    const uId = u.unitId || '';
    const uDesc = u.desc || '-';
    const uModel = u.model || '-';
    const uCharge = u.chargeSite || currentSite;
    const isSelected = i === activeUnitIndex;
    return `
      <div id="unitDropdownList-opt-${i}" onclick="selectUnitItem('${uId}')" class="p-2.5 ${isSelected ? 'bg-amber-100/80 font-bold' : 'hover:bg-amber-50'} cursor-pointer transition-colors flex items-center justify-between text-xs">
        <div class="truncate pr-2">
          <div class="flex items-center gap-1.5">
            <span class="font-black text-slate-800 ${isSelected ? 'bg-amber-200' : 'bg-slate-100'} px-1.5 py-0.5 rounded text-[11px] font-mono">${uId}</span>
            <span class="font-medium text-slate-700 truncate">${uDesc}</span>
            ${uCharge && uCharge !== currentSite ? `<span class="bg-blue-100 text-blue-800 font-extrabold text-[9px] px-1.5 py-0.2 rounded border border-blue-200 font-mono">${uCharge}</span>` : ''}
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5 ml-0.5">Model: <span class="text-amber-800 font-semibold">${uModel}</span></div>
        </div>
        <i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
      </div>
    `;
  }).join('');

  if (activeUnitIndex >= 0) {
    const activeEl = document.getElementById(`unitDropdownList-opt-${activeUnitIndex}`);
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }
}
function openUnitDropdown() {
  document.getElementById('unitDropdownList').classList.remove('hidden');
  filterUnitDropdown(document.getElementById('unitSearchInput').value.trim());
}
function filterUnitDropdown(keyword) {
  const q = (keyword || '').toLowerCase().trim();
  const filtered = liveUnits.filter(u => `${u.unitId} ${u.desc || ''} ${u.model || ''} ${u.chargeSite || ''}`.toLowerCase().includes(q));
  activeUnitIndex = filtered.length > 0 ? 0 : -1;
  renderUnitDropdownItems(filtered, activeUnitIndex);
}
function handleUnitKeydown(e) {
  activeUnitIndex = genericHandleKeydown(e, 'unitDropdownList', currentFilteredUnits, activeUnitIndex, selectUnitItem, (l, i) => renderUnitDropdownItems(l, i));
}
function selectUnitItem(unitId) {
  const u = liveUnits.find(item => String(item.unitId) === String(unitId));
  if (!u) return;
  document.getElementById('outUnit').value = u.unitId;
  document.getElementById('unitSearchInput').value = `${u.unitId} — ${u.desc || ''} (${u.model || '-'})`;
  document.getElementById('labelUnitDesc').innerText = u.desc || '-';
  document.getElementById('labelUnitModel').innerText = u.model || '-';

  const chargeSiteVal = (u.chargeSite && u.chargeSite !== 'ALL') ? u.chargeSite : currentSite;
  const chargeSiteEl = document.getElementById('outChargeSite');
  const badgeCross = document.getElementById('badgeCrossSiteCharge');
  if (chargeSiteEl) chargeSiteEl.value = chargeSiteVal;
  if (badgeCross) {
    if (chargeSiteVal && chargeSiteVal !== currentSite) badgeCross.classList.remove('hidden');
    else badgeCross.classList.add('hidden');
  }

  selectedUnitLastHM = parseFloat(u.lastHM) || 0;
  const lastLabel = document.getElementById('labelLastHM');
  if (lastLabel) lastLabel.innerHTML = `Last HM: <b class="text-amber-800 font-mono">${selectedUnitLastHM.toLocaleString('en-US')}</b>`;

  document.getElementById('btnClearUnit').classList.remove('hidden');
  document.getElementById('unitDropdownList').classList.add('hidden');
  validateHMInput(document.getElementById('outHM').value);

  const nextInput = document.getElementById('outHM');
  if (nextInput) { nextInput.focus(); nextInput.select(); }
}
function clearUnitSelection() {
  document.getElementById('outUnit').value = '';
  document.getElementById('unitSearchInput').value = '';
  document.getElementById('labelUnitDesc').innerText = '-';
  document.getElementById('labelUnitModel').innerText = '-';
  const chargeSiteEl = document.getElementById('outChargeSite');
  if (chargeSiteEl) chargeSiteEl.value = '-';
  const badgeCross = document.getElementById('badgeCrossSiteCharge');
  if (badgeCross) badgeCross.classList.add('hidden');

  document.getElementById('btnClearUnit').classList.add('hidden');
  selectedUnitLastHM = 0;
  const lastLabel = document.getElementById('labelLastHM');
  if (lastLabel) lastLabel.innerHTML = 'Last HM: <b>-</b>';
  validateHMInput(document.getElementById('outHM').value);
  renderUnitDropdownItems(liveUnits);
}

// 7.3. Supplier Combobox (m_supplier)
function renderSupplierDropdownItems(suppliers, idx = -1) {
  const dropdown = document.getElementById('supplierDropdownList');
  if (!dropdown) return;
  currentFilteredSuppliers = suppliers || [];
  activeSupplierIndex = idx;

  if (!suppliers || suppliers.length === 0) {
    dropdown.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs italic">Vendor not found in Master m_supplier</div>';
    return;
  }

  dropdown.innerHTML = suppliers.map((s, i) => {
    const isSelected = i === activeSupplierIndex;
    return `
      <div id="supplierDropdownList-opt-${i}" onclick="selectSupplierItem('${s.kode}')" class="p-2.5 ${isSelected ? 'bg-blue-100/80 font-bold' : 'hover:bg-blue-50'} cursor-pointer transition-colors flex items-center justify-between text-xs">
        <div class="truncate pr-2">
          <div class="flex items-center gap-1.5">
            <span class="font-black text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">${s.kode}</span>
            <span class="font-medium text-slate-700 truncate">${s.nama}</span>
          </div>
        </div>
        <i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
      </div>
    `;
  }).join('');

  if (activeSupplierIndex >= 0) {
    const activeEl = document.getElementById(`supplierDropdownList-opt-${activeSupplierIndex}`);
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }
}
function openSupplierDropdown() {
  const inputEl = document.getElementById('supplierSearchInput');
  if (inputEl.disabled || inputEl.readOnly) return;
  document.getElementById('supplierDropdownList').classList.remove('hidden');
  filterSupplierDropdown(inputEl.value.trim());
}
function filterSupplierDropdown(kw) {
  const q = (kw || '').toLowerCase().trim();
  const filtered = liveSuppliers.filter(s => `${s.kode} ${s.nama}`.toLowerCase().includes(q));
  activeSupplierIndex = filtered.length > 0 ? 0 : -1;
  renderSupplierDropdownItems(filtered, activeSupplierIndex);
}
function handleSupplierKeydown(e) {
  activeSupplierIndex = genericHandleKeydown(e, 'supplierDropdownList', currentFilteredSuppliers, activeSupplierIndex, selectSupplierItem, (l, i) => renderSupplierDropdownItems(l, i));
}
function selectSupplierItem(kodeSupp) {
  const s = liveSuppliers.find(item => String(item.kode).trim() === String(kodeSupp).trim());
  if (!s) return;
  document.getElementById('inSupplierCode').value = s.kode;
  document.getElementById('inSupplierName').value = s.nama;
  document.getElementById('supplierSearchInput').value = `${s.kode} — ${s.nama}`;
  document.getElementById('lblSelectedSupplierDesc').innerHTML = `Verified Master: <b class="text-blue-700">${s.nama}</b>`;
  document.getElementById('btnClearSupplier').classList.remove('hidden');
  document.getElementById('supplierDropdownList').classList.add('hidden');

  const nextInput = document.getElementById('partInSearchInput');
  if (nextInput) nextInput.focus();
}
function clearSupplierSelection() {
  document.getElementById('inSupplierCode').value = '';
  document.getElementById('inSupplierName').value = '';
  document.getElementById('supplierSearchInput').value = '';
  document.getElementById('lblSelectedSupplierDesc').innerHTML = 'Verified Master: <b>-</b>';
  document.getElementById('btnClearSupplier').classList.add('hidden');
  renderSupplierDropdownItems(liveSuppliers);
  document.getElementById('supplierSearchInput').focus();
}

// 7.4. Part In Combobox
function renderPartInDropdownItems(items, idx = -1) {
  currentFilteredInParts = items || [];
  activePartInIndex = idx;
  genericRenderPartDropdown('partInDropdownList', currentFilteredInParts, activePartInIndex, 'selectPartInItem', 'bg-blue-100/80');
}
function openPartInDropdown() {
  document.getElementById('partInDropdownList').classList.remove('hidden');
  filterPartInDropdown(document.getElementById('partInSearchInput').value.trim());
}
function filterPartInDropdown(kw) {
  const q = (kw || '').toLowerCase().trim();
  const filtered = liveItems.filter(p => `${p.partNumber} ${p.partDesc || ''}`.toLowerCase().includes(q));
  activePartInIndex = filtered.length > 0 ? 0 : -1;
  renderPartInDropdownItems(filtered, activePartInIndex);
}
function handlePartInKeydown(e) {
  activePartInIndex = genericHandleKeydown(e, 'partInDropdownList', currentFilteredInParts, activePartInIndex, selectPartInItem, (l, i) => renderPartInDropdownItems(l, i));
}
function selectPartInItem(partNum) {
  const p = liveItems.find(item => String(item.partNumber) === String(partNum));
  if (!p) return;
  document.getElementById('inPart').value = p.partNumber;
  document.getElementById('partInSearchInput').value = `${p.partNumber} — ${p.partDesc || ''}`;
  document.getElementById('labelPartInDesc').innerText = p.partDesc || '-';
  if (p.defaultPrice !== undefined && p.defaultPrice !== null) {
    document.getElementById('inHarga').value = Number(p.defaultPrice).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  document.getElementById('btnClearPartIn').classList.remove('hidden');
  document.getElementById('partInDropdownList').classList.add('hidden');
  const nextInput = document.getElementById('inQty');
  if (nextInput) { nextInput.focus(); nextInput.select(); }
}
function clearPartInSelection() {
  document.getElementById('inPart').value = '';
  document.getElementById('partInSearchInput').value = '';
  document.getElementById('labelPartInDesc').innerText = '-';
  document.getElementById('btnClearPartIn').classList.add('hidden');
  renderPartInDropdownItems(liveItems);
  document.getElementById('partInSearchInput').focus();
}

// 7.5. Transfer Part Combobox
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
  activeTrfPartIndex = filtered.length > 0 ? 0 : -1;
  renderTrfPartDropdownItems(filtered, activeTrfPartIndex);
}
function handleTrfPartKeydown(e) {
  activeTrfPartIndex = genericHandleKeydown(e, 'trfPartDropdownList', currentFilteredTrfParts, activeTrfPartIndex, selectTrfPartItem, (l, i) => renderTrfPartDropdownItems(l, i));
}
function selectTrfPartItem(partNum) {
  const p = liveItems.find(item => String(item.partNumber) === String(partNum));
  if (!p) return;
  document.getElementById('trfPart').value = p.partNumber;
  document.getElementById('trfPartSearchInput').value = `${p.partNumber} — ${p.partDesc || ''}`;
  document.getElementById('labelTrfPartDesc').innerText = p.partDesc || '-';
  document.getElementById('btnClearTrfPart').classList.remove('hidden');
  document.getElementById('trfPartDropdownList').classList.add('hidden');
  triggerCheckTransferStock();
  const nextInput = document.getElementById('trfQty');
  if (nextInput) { nextInput.focus(); nextInput.select(); }
}
function clearTrfPartSelection(shouldFocus = false) {
  document.getElementById('trfPart').value = '';
  document.getElementById('trfPartSearchInput').value = '';
  document.getElementById('labelTrfPartDesc').innerText = '-';
  document.getElementById('labelTrfStock').innerHTML = 'Available: <span class="text-amber-700 font-mono">0 L</span>';
  document.getElementById('btnClearTrfPart').classList.add('hidden');
  const drop = document.getElementById('trfPartDropdownList');
  if (drop) drop.classList.add('hidden');
  renderTrfPartDropdownItems(liveItems);
  if (shouldFocus) document.getElementById('trfPartSearchInput').focus();
}

// 7.6. Return Comboboxes (Tab 6)
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
    <div id="retUnitDropdownList-opt-${i}" onclick="selectRetUnitItem('${u.unitId}')" class="p-2.5 ${i === activeRetUnitIndex ? 'bg-teal-100 font-bold' : 'hover:bg-slate-50'} cursor-pointer text-xs flex justify-between">
      <div>
        <span class="font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">${u.unitId}</span>
        <span class="text-slate-700 ml-1">${u.desc || '-'}</span>
      </div>
      <i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
    </div>
  `).join('');
  if (activeRetUnitIndex >= 0) {
    const el = document.getElementById(`retUnitDropdownList-opt-${activeRetUnitIndex}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
}
function openRetUnitDropdown() {
  document.getElementById('retUnitDropdownList').classList.remove('hidden');
  filterRetUnitDropdown(document.getElementById('retUnitSearchInput').value.trim());
}
function filterRetUnitDropdown(kw) {
  const q = (kw || '').toLowerCase().trim();
  const filtered = liveUnits.filter(u => `${u.unitId} ${u.desc || ''} ${u.model || ''}`.toLowerCase().includes(q));
  activeRetUnitIndex = filtered.length > 0 ? 0 : -1;
  renderRetUnitDropdownItems(filtered, activeRetUnitIndex);
}
function handleRetUnitKeydown(e) {
  activeRetUnitIndex = genericHandleKeydown(e, 'retUnitDropdownList', currentFilteredRetUnits, activeRetUnitIndex, selectRetUnitItem, (l, i) => renderRetUnitDropdownItems(l, i));
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
    <div id="retSupplierDropdownList-opt-${i}" onclick="selectRetSupplierItem('${s.kode}')" class="p-2.5 ${i === activeRetSupplierIndex ? 'bg-teal-100 font-bold' : 'hover:bg-slate-50'} cursor-pointer text-xs flex justify-between">
      <div>
        <span class="font-mono font-bold bg-slate-100 px-1 py-0.5 rounded text-[11px]">${s.kode}</span>
        <span class="text-slate-700 ml-1">${s.nama}</span>
      </div>
      <i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
    </div>
  `).join('');
  if (activeRetSupplierIndex >= 0) {
    const el = document.getElementById(`retSupplierDropdownList-opt-${activeRetSupplierIndex}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
}
function openRetSupplierDropdown() {
  document.getElementById('retSupplierDropdownList').classList.remove('hidden');
  filterRetSupplierDropdown(document.getElementById('retSupplierSearchInput').value.trim());
}
function filterRetSupplierDropdown(kw) {
  const q = (kw || '').toLowerCase().trim();
  const filtered = liveSuppliers.filter(s => `${s.kode} ${s.nama}`.toLowerCase().includes(q));
  activeRetSupplierIndex = filtered.length > 0 ? 0 : -1;
  renderRetSupplierDropdownItems(filtered, activeRetSupplierIndex);
}
function handleRetSupplierKeydown(e) {
  activeRetSupplierIndex = genericHandleKeydown(e, 'retSupplierDropdownList', currentFilteredRetSuppliers, activeRetSupplierIndex, selectRetSupplierItem, (l, i) => renderRetSupplierDropdownItems(l, i));
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
  activeRetPartIndex = filtered.length > 0 ? 0 : -1;
  renderRetPartDropdownItems(filtered, activeRetPartIndex);
}
function handleRetPartKeydown(e) {
  activeRetPartIndex = genericHandleKeydown(e, 'retPartDropdownList', currentFilteredRetParts, activeRetPartIndex, selectRetPartItem, (l, i) => renderRetPartDropdownItems(l, i));
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

  const isVendor = document.querySelector('input[name="retTypeOption"]:checked')?.value === 'VENDOR';
  if (isVendor) {
    document.getElementById('retVendorQty')?.focus();
  } else {
    document.getElementById('retQty')?.focus();
  }
}
function clearRetPartSelection() {
  document.getElementById('retPart').value = '';
  document.getElementById('retPartSearchInput').value = '';
  document.getElementById('labelRetPartDesc').innerText = '-';
  document.getElementById('labelRetLiveStock').innerHTML = 'Available: <span class="text-teal-700 font-mono">0 L</span>';
  document.getElementById('btnClearRetPart').classList.add('hidden');
  renderRetPartDropdownItems(liveItems);
}

// Global Click-Outside Listener for Comboboxes
document.addEventListener('click', function(e) {
  const checkAndClose = (inputElId, dropElId) => {
    const inp = document.getElementById(inputElId);
    const drop = document.getElementById(dropElId);
    if (inp && drop && !inp.contains(e.target) && !drop.contains(e.target)) {
      drop.classList.add('hidden');
    }
  };
  checkAndClose('unitSearchInput', 'unitDropdownList');
  checkAndClose('partSearchInput', 'partDropdownList');
  checkAndClose('partInSearchInput', 'partInDropdownList');
  checkAndClose('trfPartSearchInput', 'trfPartDropdownList');
  checkAndClose('supplierSearchInput', 'supplierDropdownList');
  checkAndClose('retUnitSearchInput', 'retUnitDropdownList');
  checkAndClose('retSupplierSearchInput', 'retSupplierDropdownList');
  checkAndClose('retPartSearchInput', 'retPartDropdownList');
});

// ==========================================
// 8. STOCK LEVEL QUERY & ANTI-MINUS CHECK
// ==========================================
async function queryLiveStock(storageId, partNumber, labelElemId, isTransfer = false) {
  const label = document.getElementById(labelElemId);
  if (!storageId || !partNumber) {
    label.innerHTML = isTransfer ? 'Available: <span class="text-amber-700 font-mono">0 L</span>' : 'Available: <span class="text-amber-700 font-mono">0 Liters</span>';
    if (!isTransfer) currentAvailableStock = 0;
    return 0;
  }
  label.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
  const res = await callBackend('CHECK_STOCK', { site: currentSite, storageId: storageId, partNumber: partNumber });
  const stock = res.success ? Math.round(Number(res.stock) || 0) : 0;
  label.innerHTML = `Available: <span class="text-amber-700 font-bold font-mono">${stock.toLocaleString('en-US')} L</span>`;
  if (!isTransfer) {
    currentAvailableStock = stock;
    validateAntiMinus(document.getElementById('outQty').value);
  }
  return stock;
}

function triggerCheckStock() {
  queryLiveStock(document.getElementById('outStorage').value, document.getElementById('outPart').value, 'labelLiveStock', false);
}
function triggerCheckTransferStock() {
  queryLiveStock(document.getElementById('trfFromStorage').value, document.getElementById('trfPart').value, 'labelTrfStock', true);
}
function triggerCheckReturnStock() {
  queryLiveStock(document.getElementById('retStorage').value, document.getElementById('retPart').value, 'labelRetLiveStock', false);
}

function validateAntiMinus(val) {
  const requested = parseInt(val, 10) || 0;
  const warn = document.getElementById('warnMinus');
  const btn = document.getElementById('btnSubmitOut');
  if (requested > currentAvailableStock) {
    warn.classList.remove('hidden');
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
  } else {
    warn.classList.add('hidden');
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}

function toggleResetHMPanel() {
  document.getElementById('resetHMPanel').classList.toggle('hidden');
}

function validateHMInput(val) {
  const inputHM = parseFloat(val) || 0;
  const isResetChecked = document.getElementById('checkResetHM').checked;
  const warnBox = document.getElementById('warnHM');
  const warnTxt = document.getElementById('warnHMTxt');
  const warnHighBox = document.getElementById('warnHMHigh');
  const hmInputEl = document.getElementById('outHM');
  const btnSubmit = document.getElementById('btnSubmitOut');

  if (selectedUnitLastHM > 0 && !isResetChecked && inputHM > 0 && inputHM < selectedUnitLastHM) {
    isHMValid = false;
    warnBox.classList.remove('hidden');
    warnTxt.innerText = `Input HM (${inputHM.toLocaleString('en-US')}) is lower than last recorded meter (${selectedUnitLastHM.toLocaleString('en-US')})!`;
    hmInputEl.classList.add('border-rose-400', 'bg-rose-50', 'text-rose-700');
    btnSubmit.disabled = true;
    if (warnHighBox) warnHighBox.classList.add('hidden');
  } else {
    isHMValid = true;
    warnBox.classList.add('hidden');
    hmInputEl.classList.remove('border-rose-400', 'bg-rose-50', 'text-rose-700');
    btnSubmit.disabled = false;

    if (selectedUnitLastHM > 0 && !isResetChecked && inputHM > 0) {
      const deltaHM = Number((inputHM - selectedUnitLastHM).toFixed(1));
      if (deltaHM > 30) {
        if (warnHighBox) {
          warnHighBox.classList.remove('hidden');
          document.getElementById('warnHMHighTxt').innerText = `Notice: Elevated HM Delta (+${deltaHM.toLocaleString('en-US')} hrs from last log). Verify digit entry!`;
        }
      } else {
        if (warnHighBox) warnHighBox.classList.add('hidden');
      }
    } else {
      if (warnHighBox) warnHighBox.classList.add('hidden');
    }

    validateAntiMinus(document.getElementById('outQty').value);
  }
}

function toggleResetHM(isChecked) {
  const warnBox = document.getElementById('warnHM');
  const warnHighBox = document.getElementById('warnHMHigh');
  const hmInputEl = document.getElementById('outHM');
  if (isChecked) {
    if (warnHighBox) warnHighBox.classList.add('hidden');
    warnBox.classList.remove('hidden');
    warnBox.className = "text-[11px] text-blue-700 font-bold bg-blue-50 p-2 rounded-lg border border-blue-200";
    document.getElementById('warnHMTxt').innerText = "ℹ️ Gauge Override Mode Active: Newly initialized meter will be accepted.";
    isHMValid = true;
  } else {
    warnBox.className = "hidden text-[11px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200";
    validateHMInput(hmInputEl.value);
  }
}

// ==========================================
// 9. TAB 1: DISPENSE ORDER (LOG OUT)
// ==========================================
function addOliToServiceCart() {
  const partNum = document.getElementById('outPart').value.trim();
  const storageId = document.getElementById('outStorage').value.trim();
  const qty = parseInt(document.getElementById('outQty').value, 10) || 0;

  if (!storageId) {
    showModalAlert("Select Source Storage", "Please select Source Storage first.");
    return;
  }
  if (!partNum) {
    showModalAlert("Select Lubricant", "Please select the lubricant item to add to the service queue.");
    return;
  }
  if (qty <= 0) {
    showModalAlert("Invalid Volume", "Please enter a valid integer volume in liters.");
    return;
  }
  if (qty > currentAvailableStock) {
    showModalAlert("Insufficient Inventory", `Volume ${qty} L exceeds available storage balance (${currentAvailableStock} L).`);
    return;
  }

  const itemMeta = liveItems.find(i => i.partNumber === partNum) || { partDesc: partNum, defaultPrice: 0 };
  serviceCart.push({
    sourceStorage: storageId,
    partNumber: partNum,
    partDescription: itemMeta.partDesc,
    qty: qty,
    price: itemMeta.defaultPrice || 0,
    wasteOil: 0,
    keterangan: document.getElementById('outKet').value.trim() || 'PM SERVICE UNIT'
  });

  renderServiceCart();
  document.getElementById('outIssuedFor').value = 'SERVICE';
  document.getElementById('outQty').value = '';
  clearPartSelection();
}

function renderServiceCart() {
  const container = document.getElementById('serviceCartContainer');
  const listEl = document.getElementById('serviceCartList');
  const countEl = document.getElementById('cartCount');
  const btnLabel = document.getElementById('btnSubmitOutLabel');

  if (serviceCart.length === 0) {
    container.classList.add('hidden');
    btnLabel.innerText = "Submit Dispense Order";
    return;
  }

  container.classList.remove('hidden');
  countEl.innerText = serviceCart.length;
  btnLabel.innerText = `Submit Batch (${serviceCart.length} Service Items)`;

  listEl.innerHTML = serviceCart.map((item, idx) => `
    <div class="flex items-center justify-between bg-white p-1.5 rounded-xl border border-amber-200 text-xs">
      <div class="truncate pr-2">
        <span class="font-bold text-slate-800 font-mono">${item.partNumber}</span>
        <span class="text-amber-700 font-black font-mono ml-1.5">${item.qty.toLocaleString('en-US')} L</span>
        <span class="text-[10px] text-slate-400 block">${item.partDescription} (${item.sourceStorage})</span>
      </div>
      <button type="button" onclick="removeServiceCartItem(${idx})" class="text-rose-500 hover:text-rose-700 p-1">
        <i class="fa-solid fa-trash-can text-[11px]"></i>
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
  const hm = document.getElementById('outHM').value.trim();
  const issuedFor = document.getElementById('outIssuedFor').value.trim();
  const rawKet = document.getElementById('outKet').value.trim();
  const chargeSiteVal = document.getElementById('outChargeSite') ? document.getElementById('outChargeSite').value.trim() : currentSite;

  if (!tanggal) { showModalAlert("Required Field", "Please specify Transaction Date."); return; }
  if (!unitId) { showModalAlert("Required Field", "Please select Fleet Equipment ID."); return; }
  if (hm === '' || isNaN(parseFloat(hm))) { showModalAlert("Required Field", "Please provide a valid numeric HM."); return; }
  if (!isHMValid) { showModalAlert("HM Meter Discrepancy", "Input HM is lower than the last recorded meter value."); return; }
  if (!rawKet) { showModalAlert("Required Field", "Technician Name is mandatory!"); return; }

  const unit = liveUnits.find(u => u.unitId === unitId) || { desc: '-', model: '-' };
  const isResetChecked = document.getElementById('checkResetHM').checked;
  let finalKet = isResetChecked ? `${rawKet} [RESET HM]` : rawKet;

  const btn = document.getElementById('btnSubmitOut');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Committing Transaction to Central Database...';

  let res;
  if (serviceCart.length > 0) {
    const payload = {
      site: currentSite,
      tanggal: tanggal,
      unitId: unitId,
      hm: parseFloat(hm) || 0,
      unitDescription: unit.desc,
      model: unit.model,
      issuedFor: 'SERVICE',
      keterangan: finalKet,
      chargeSite: (chargeSiteVal && chargeSiteVal !== '-') ? chargeSiteVal : currentSite,
      createdBy: currentUser || 'ADMIN',
      items: serviceCart
    };
    res = await callBackend('SUBMIT_PART_OUT_BATCH', payload);
  } else {
    const storageId = document.getElementById('outStorage').value.trim();
    const partNumber = document.getElementById('outPart').value.trim();
    const qty = parseInt(document.getElementById('outQty').value, 10) || 0;

    if (!storageId) {
      showModalAlert("Required Field", "Please select Source Storage.");
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Submit Dispense Order';
      return;
    }
    if (!partNumber) {
      showModalAlert("Required Field", "Please select Lubricant Item.");
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Submit Dispense Order';
      return;
    }
    if (qty <= 0) {
      showModalAlert("Required Field", "Dispense volume must be an integer greater than 0 L.");
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Submit Dispense Order';
      return;
    }

    const item = liveItems.find(i => i.partNumber === partNumber);
    const payload = {
      site: currentSite,
      tanggal: tanggal,
      sourceStorage: storageId,
      partNumber: partNumber,
      partDescription: item ? item.partDesc : partNumber,
      qty: qty,
      price: item ? item.defaultPrice : 0,
      unitId: unitId,
      hm: parseFloat(hm) || 0,
      unitDescription: unit.desc,
      model: unit.model,
      issuedFor: issuedFor,
      keterangan: finalKet,
      chargeSite: (chargeSiteVal && chargeSiteVal !== '-') ? chargeSiteVal : currentSite,
      createdBy: currentUser || 'ADMIN'
    };
    res = await callBackend('SUBMIT_PART_OUT', payload);
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span id="btnSubmitOutLabel">Submit Dispense Order</span>';

  if (res.success) {
    document.getElementById('outQty').value = '';
    document.getElementById('outKet').value = '';
    document.getElementById('outHM').value = '0';
    document.getElementById('checkResetHM').checked = false;
    document.getElementById('resetHMPanel').classList.add('hidden');
    clearServiceCart();
    clearUnitSelection();
    clearPartSelection();
    triggerCheckStock();
    fetchRecentPartOut();
    fetchAllTankStocks();
    fetchExecutiveKPI();

    showModalAlert("Transaction Successful", res.message, true, () => {
      setTimeout(() => { document.getElementById('partSearchInput').focus(); }, 50);
    });
  } else {
    showModalAlert("Transaction Rejected", res.message);
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
  tbody.innerHTML = '';
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-slate-400">No dispense records found for current period.</td></tr>';
    return;
  }
  data.forEach(row => {
    const rowCharge = row.chargeSite || row.site || currentSite;
    const isCross = (rowCharge && rowCharge !== currentSite);
    tbody.innerHTML += `
      <tr class="hover:bg-amber-50/50 transition-colors font-medium text-slate-700">
        <td class="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">${row.tanggal}</td>
        <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-800">${row.sourceStorage}</td>
        <td class="py-2.5 px-3">
          <div class="font-bold text-slate-900 leading-tight font-mono">${row.partNumber}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[280px] leading-tight">${row.partDescription}</div>
        </td>
        <td class="py-2.5 px-3 text-right font-black font-mono text-amber-700 whitespace-nowrap">${Math.round(Number(row.qty)).toLocaleString('en-US')}</td>
        <td class="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap font-mono">${row.unitId}</td>
        <td class="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap text-[11px]">${row.hm || '-'}</td>
        <td class="py-2.5 px-3 whitespace-nowrap">
          <span class="px-2.5 py-0.5 rounded text-[10px] font-extrabold font-mono ${isCross ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-slate-100 text-slate-600'}">${rowCharge}</span>
        </td>
        <td class="py-2.5 px-3 whitespace-nowrap">
          <span class="px-2.5 py-0.5 rounded-md text-[9px] font-bold ${row.issuedFor === 'SERVICE' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}">${row.issuedFor}</span>
        </td>
      </tr>
    `;
  });
}

function filterRecentOutTable() {
  const q = (document.getElementById('searchFilterOut')?.value || '').trim().toLowerCase();
  const storage = (document.getElementById('storageFilterOut')?.value || '').trim().toLowerCase();
  const cat = (document.getElementById('categoryFilterOut')?.value || '').trim().toUpperCase();

  const filtered = rawRecentOutData.filter(row => {
    const matchCat = !cat || String(row.issuedFor || '').toUpperCase() === cat;
    const matchStorage = !storage || String(row.sourceStorage || '').toLowerCase() === storage;
    const matchText = !q || `${row.unitId} ${row.partNumber} ${row.partDescription} ${row.sourceStorage} ${row.chargeSite || ''} ${row.keterangan || ''} ${row.tanggal}`.toLowerCase().includes(q);
    return matchCat && matchStorage && matchText;
  });
  renderRecentOutRows(filtered);
}

// ==========================================
// 10. TAB 2: INBOUND RECEIVING (LOG IN)
// ==========================================
let inboundSJMatchedItems = [];

function parseDecimalInput(strVal, defaultVal = 0) {
  if (strVal === undefined || strVal === null || String(strVal).trim() === '') return defaultVal;
  const clean = String(strVal).trim().replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? defaultVal : Number(num.toFixed(2));
}

function toggleInSourceType(mode) {
  const pSJ = document.getElementById('panelSJLookup');
  const cPartSearch = document.getElementById('containerInPartSearch');
  const cQtyDoc = document.getElementById('containerInQtyDoc');
  const cItemDetail = document.getElementById('containerInItemDetailSection');
  const cartCont = document.getElementById('inboundCartContainer');
  const vendorCartCont = document.getElementById('vendorInCartContainer');
  const btnLbl = document.getElementById('lblBtnSubmitIn');
  const suppInput = document.getElementById('supplierSearchInput');
  const btnClearSupp = document.getElementById('btnClearSupplier');

  if (mode === 'TRANSFER_SJ') {
    pSJ.classList.remove('hidden');
    if (cItemDetail) cItemDetail.classList.add('hidden');
    if (cPartSearch) cPartSearch.classList.add('hidden');
    if (cQtyDoc) cQtyDoc.classList.add('hidden');
    vendorCartCont.classList.add('hidden');
    btnLbl.innerText = "Confirm Inbound Inter-Site Transfer";

    suppInput.disabled = true;
    suppInput.classList.add('bg-slate-100', 'cursor-not-allowed');
    btnClearSupp.classList.add('hidden');
  } else {
    pSJ.classList.add('hidden');
    if (cItemDetail) cItemDetail.classList.remove('hidden');
    if (cPartSearch) cPartSearch.classList.remove('hidden');
    if (cQtyDoc) cQtyDoc.classList.remove('hidden');
    cartCont.classList.add('hidden');
    inboundSJMatchedItems = [];
    renderVendorInCart();

    suppInput.disabled = false;
    suppInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
    clearSupplierSelection();
  }
}

function addOliToVendorInCart() {
  const partNum = document.getElementById('inPart').value.trim();
  const rawQty = document.getElementById('inQty').value.trim();
  const rawHarga = document.getElementById('inHarga').value.trim();

  if (!partNum) {
    showModalAlert("Select Lubricant", "Please select the lubricant item to add to the Delivery Order batch.");
    return;
  }

  const qty = parseInt(rawQty, 10) || 0;
  if (qty <= 0) {
    showModalAlert("Invalid Volume", "Received volume must be an integer greater than 0 L (e.g. 200).");
    return;
  }

  const itemMeta = liveItems.find(i => i.partNumber === partNum) || { partDesc: partNum, defaultPrice: 0 };
  const hargaSatuan = parseDecimalInput(rawHarga, itemMeta.defaultPrice || 0);

  vendorInCart.push({
    partNumber: partNum,
    partDescription: itemMeta.partDesc,
    qty: qty,
    hargaSatuan: hargaSatuan,
    hargaTotal: Number((qty * hargaSatuan).toFixed(2))
  });

  renderVendorInCart();
  clearPartInSelection();
  document.getElementById('inQty').value = '';
  document.getElementById('inHarga').value = '';
}

function renderVendorInCart() {
  const container = document.getElementById('vendorInCartContainer');
  const listEl = document.getElementById('vendorInCartList');
  const countEl = document.getElementById('vendorCartCount');
  const btnLabel = document.getElementById('lblBtnSubmitIn');

  if (vendorInCart.length === 0) {
    container.classList.add('hidden');
    btnLabel.innerText = "Submit Inbound Receiving";
    return;
  }

  container.classList.remove('hidden');
  countEl.innerText = vendorInCart.length;
  btnLabel.innerText = `Submit Batch (${vendorInCart.length} DO Items)`;

  listEl.innerHTML = vendorInCart.map((item, idx) => `
    <div class="flex items-center justify-between bg-white p-1.5 rounded-xl border border-blue-200 text-xs">
      <div class="truncate pr-2">
        <span class="font-bold text-slate-800 font-mono">${item.partNumber}</span>
        <span class="text-blue-700 font-black font-mono ml-1.5">${item.qty.toLocaleString('en-US')} L</span>
        <span class="text-[10px] text-emerald-700 font-bold ml-1.5 font-mono">@IDR ${item.hargaSatuan.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
        <span class="text-[10px] text-slate-400 block">${item.partDescription} (Total: IDR ${item.hargaTotal.toLocaleString('en-US')})</span>
      </div>
      <button type="button" onclick="removeVendorInCartItem(${idx})" class="text-rose-500 hover:text-rose-700 p-1">
        <i class="fa-solid fa-trash-can text-[11px]"></i>
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

async function triggerSJAutoFill() {
  const sjQuery = document.getElementById('lookupSJInput').value.trim();
  const statusLbl = document.getElementById('lblSJLookupStatus');

  if (!sjQuery) {
    showModalAlert("Waybill Search", "Please enter the inbound Waybill (SJ) number.");
    return;
  }

  statusLbl.innerText = "Searching Logistics Registry...";
  statusLbl.classList.remove('hidden');

  const res = await callBackend('LOOKUP_TRANSFER_SJ', { site: currentSite, noSJ: sjQuery });
  if (res.success && res.data && res.data.length > 0) {
    inboundSJMatchedItems = res.data;
    const first = inboundSJMatchedItems[0];

    document.getElementById('inSupplierCode').value = first.originSite;
    document.getElementById('inSupplierName').value = `TRANSFER SITE ${first.originSite}`;
    document.getElementById('supplierSearchInput').value = `[SITE ${first.originSite}] TRANSFER SITE ${first.originSite}`;
    document.getElementById('lblSelectedSupplierDesc').innerHTML = `Source: <b class="text-amber-700">Project Site ${first.originSite}</b>`;

    document.getElementById('inNoDok').value = first.noSJ;
    if (first.price !== undefined && first.price !== null) {
      document.getElementById('inHarga').value = Number(first.price).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    const cartCont = document.getElementById('inboundCartContainer');
    const listEl = document.getElementById('inboundCartList');
    document.getElementById('inboundCartCount').innerText = inboundSJMatchedItems.length;
    cartCont.classList.remove('hidden');

    listEl.innerHTML = inboundSJMatchedItems.map(it => `
      <div class="flex items-center justify-between bg-white p-2 rounded-xl border border-blue-200 text-xs">
        <div>
          <span class="font-bold text-slate-800 font-mono">${it.partNumber}</span>
          <span class="text-blue-700 font-black font-mono ml-1">${Math.round(Number(it.qtyKirim)).toLocaleString('en-US')} L</span>
          <span class="text-[10px] text-slate-400 block">${it.partDescription}</span>
          <span class="text-[10px] text-emerald-600 font-bold block font-mono">Valuation: IDR ${Number(it.price || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/L</span>
        </div>
        <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono">ORIGIN ${it.originSite}</span>
      </div>
    `).join('');

    statusLbl.innerText = `✓ Found ${inboundSJMatchedItems.length} cargo items for Waybill ${first.noSJ}`;
  } else {
    statusLbl.innerText = "⚠️ " + (res.message || "Waybill not found in active dispatch registry.");
    showModalAlert("Waybill Not Found", res.message || "Waybill not found or already verified.");
  }
}

async function submitPartInData() {
  const isTransferMode = document.querySelector('input[name="inSourceType"]:checked').value === 'TRANSFER_SJ';
  const targetStorage = document.getElementById('inStorage').value.trim();
  const tanggal = document.getElementById('inDate').value.trim();
  const noDok = document.getElementById('inNoDok').value.trim();
  const suppCode = document.getElementById('inSupplierCode').value.trim();
  const suppName = document.getElementById('inSupplierName').value.trim();

  if (!targetStorage) {
    showModalAlert("Storage Unavailable", "Site receiving storage is not yet registered.");
    return;
  }
  if (!tanggal) {
    showModalAlert("Required Field", "Please enter Receiving Date.");
    return;
  }
  if (!noDok) {
    showModalAlert("Required Field", "DO / Waybill No. is mandatory.");
    return;
  }

  if (!isTransferMode && (!suppCode || !suppName)) {
    showModalAlert("Select Official Vendor", "Please select an authorized supplier from Master Repository m_supplier.");
    document.getElementById('supplierSearchInput').focus();
    return;
  }

  const btn = document.getElementById('btnSubmitIn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Committing to Central Database...';

  let res;
  if (isTransferMode) {
    if (!inboundSJMatchedItems || inboundSJMatchedItems.length === 0) {
      showModalAlert("Cargo Data Not Loaded", "Please enter waybill number and click Fetch Cargo first.");
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> <span id="lblBtnSubmitIn">Submit Inbound Receiving</span>';
      return;
    }

    const first = inboundSJMatchedItems[0];
    const payload = {
      site: currentSite,
      originSite: first.originSite,
      noSJ: first.noSJ,
      tanggalTerima: tanggal,
      targetStorage: targetStorage,
      items: inboundSJMatchedItems.map(it => ({
        partNumber: it.partNumber,
        partDescription: it.partDescription,
        qtyTerima: Math.round(Number(it.qtyKirim)),
        price: it.price || 0,
        noSJ: it.noSJ,
        originRowIndex: it.rowIndex,
        targetStorage: targetStorage
      }))
    };
    res = await callBackend('CONFIRM_INBOUND_TRANSFER', payload);
  } else {
    if (vendorInCart.length > 0) {
      const payload = {
        site: currentSite,
        tanggal: tanggal,
        targetStorage: targetStorage,
        noDokumen: noDok,
        codeSupplier: suppCode,
        supplierDescription: suppName,
        items: vendorInCart
      };
      res = await callBackend('SUBMIT_PART_IN', payload);
    } else {
      const partNumber = document.getElementById('inPart').value.trim();
      const qty = parseInt(document.getElementById('inQty').value, 10) || 0;

      if (!partNumber) {
        showModalAlert("Required Field", "Please specify Lubricant Item.");
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> <span>Submit Inbound Receiving</span>';
        return;
      }
      if (qty <= 0) {
        showModalAlert("Required Field", "Received volume must be an integer greater than 0 L (e.g. 200).");
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> <span>Submit Inbound Receiving</span>';
        return;
      }

      const item = liveItems.find(i => i.partNumber === partNumber);
      const hargaSatuan = parseDecimalInput(document.getElementById('inHarga').value, item ? item.defaultPrice : 0);

      const payload = {
        site: currentSite,
        tanggal: tanggal,
        targetStorage: targetStorage,
        partNumber: partNumber,
        partDescription: item ? item.partDesc : partNumber,
        qty: qty,
        noDokumen: noDok,
        codeSupplier: suppCode,
        supplierDescription: suppName,
        hargaSatuan: hargaSatuan
      };
      res = await callBackend('SUBMIT_PART_IN', payload);
    }
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> <span id="lblBtnSubmitIn">Submit Inbound Receiving</span>';

  if (res.success) {
    document.getElementById('inQty').value = '';
    document.getElementById('inHarga').value = '';
    document.getElementById('inNoDok').value = '';
    document.getElementById('lookupSJInput').value = '';
    document.getElementById('lblSJLookupStatus').classList.add('hidden');
    document.getElementById('inboundCartContainer').classList.add('hidden');
    inboundSJMatchedItems = [];
    clearVendorInCart();
    clearPartInSelection();
    clearSupplierSelection();
    fetchRecentPartIn();
    fetchAllTankStocks();
    checkPendingInboundTransfers();

    showModalAlert("Inbound Logged", res.message, true, () => {
      setTimeout(() => { document.getElementById('supplierSearchInput').focus(); }, 50);
    });
  } else {
    showModalAlert("Submission Failed", res.message);
  }
}

async function fetchRecentPartIn() {
  const tbody = document.getElementById('tableRecentIn');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading inbound records...</td></tr>';
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
  tbody.innerHTML = '';
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">No inbound records found for current period.</td></tr>';
    return;
  }
  data.forEach(row => {
    const qtyDisplay = Math.round(Number(row.qty)).toLocaleString('en-US');
    const hargaDisplay = Number(row.hargaSatuan || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    tbody.innerHTML += `
      <tr class="hover:bg-blue-50/50 transition-colors font-medium text-slate-700">
        <td class="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">${row.tanggal}</td>
        <td class="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap text-[11px]">${row.noDokumen || '-'}</td>
        <td class="py-2.5 px-3 text-slate-700 truncate max-w-[180px] leading-tight font-medium">${row.supplier || '-'}</td>
        <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-800">${row.targetStorage}</td>
        <td class="py-2.5 px-3">
          <div class="font-bold text-slate-900 leading-tight font-mono">${row.partNumber}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[200px] leading-tight">${row.partDescription}</div>
        </td>
        <td class="py-2.5 px-3 text-right whitespace-nowrap font-mono">
          <span class="font-black text-blue-700">${qtyDisplay} L</span>
          <span class="text-[10px] text-slate-400 block">@IDR ${hargaDisplay}</span>
        </td>
      </tr>
    `;
  });
}

function filterRecentInTable() {
  const q = (document.getElementById('searchFilterIn')?.value || '').trim().toLowerCase();
  const storage = (document.getElementById('storageFilterIn')?.value || '').trim().toLowerCase();
  const source = (document.getElementById('sourceFilterIn')?.value || '').trim().toUpperCase();

  const filtered = rawRecentInData.filter(row => {
    const matchStorage = !storage || String(row.targetStorage || '').toLowerCase() === storage;

    let matchSource = true;
    if (source === 'VENDOR') {
      matchSource = !String(row.supplier || '').toUpperCase().includes('TRANSFER SITE');
    } else if (source === 'TRANSFER') {
      matchSource = String(row.supplier || '').toUpperCase().includes('TRANSFER SITE');
    }

    const matchText = !q || `${row.noDokumen || ''} ${row.supplier || ''} ${row.partNumber} ${row.partDescription} ${row.targetStorage} ${row.tanggal}`.toLowerCase().includes(q);
    return matchStorage && matchSource && matchText;
  });
  renderRecentInRows(filtered);
}

// ==========================================
// 11. TAB 3: INTERNAL TRANSFER & DISPATCH
// ==========================================
function toggleTransferType(mode) {
  const pMR = document.getElementById('panelTrfMR');
  const pPetugas = document.getElementById('panelTrfPetugas');
  const pInt = document.getElementById('panelTargetInternal');
  const pSite = document.getElementById('panelTargetSite');
  const pInter = document.getElementById('panelInterSiteDetail');
  const pNon = document.getElementById('panelNonSystemSite');
  const btnLbl = document.getElementById('lblBtnSubmitTrf');
  const mrInput = document.getElementById('trfMRNo');
  const petugasInput = document.getElementById('trfPetugas');
  const toStInput = document.getElementById('trfToStorage');
  const badgeStore = document.getElementById('badgeTrfStoreLock');

  if (mode === 'INTER_SITE') {
    pMR.classList.add('hidden');
    if (pPetugas) pPetugas.classList.add('hidden');
    pInt.classList.add('hidden');
    pSite.classList.remove('hidden');
    pInter.classList.remove('hidden');
    if (mrInput) mrInput.required = false;
    if (petugasInput) petugasInput.required = false;
    if (toStInput) toStInput.required = false;
    if (badgeStore) badgeStore.classList.remove('hidden');
    lockTransferFromStorageToStore(true);
    handleToSiteChange();
  } else {
    pMR.classList.remove('hidden');
    if (pPetugas) pPetugas.classList.remove('hidden');
    pInt.classList.remove('hidden');
    pSite.classList.add('hidden');
    pInter.classList.add('hidden');
    if (pNon) pNon.classList.add('hidden');
    if (mrInput) mrInput.required = true;
    if (petugasInput) petugasInput.required = true;
    if (toStInput) toStInput.required = true;
    if (badgeStore) badgeStore.classList.add('hidden');
    lockTransferFromStorageToStore(false);
    btnLbl.innerText = "⚡ Execute Internal Tank Transfer";
  }
}

function lockTransferFromStorageToStore(isLock) {
  const selFrom = document.getElementById('trfFromStorage');
  if (!selFrom) return;
  if (isLock) {
    const storeTank = (liveStorages || []).find(s => {
      const type = String(s.type || '').toUpperCase();
      const name = String(s.storageName || s.storageId).toUpperCase();
      return type.includes('STORE') || type.includes('WAREHOUSE') || name.includes('STORE') || name.includes('GUDANG');
    });
    if (storeTank) {
      selFrom.value = storeTank.storageId;
      selFrom.classList.add('bg-slate-100', 'font-bold', 'cursor-not-allowed');
      selFrom.style.pointerEvents = 'none';
    }
  } else {
    selFrom.classList.remove('bg-slate-100', 'font-bold', 'cursor-not-allowed');
    selFrom.style.pointerEvents = 'auto';
  }
  handleTrfFromStorageChange();
}

function handleTrfFromStorageChange() {
  triggerCheckTransferStock();
  updateTransferTargetOptions();
}

function updateTransferTargetOptions() {
  const fromSt = document.getElementById('trfFromStorage')?.value || '';
  const selTo = document.getElementById('trfToStorage');
  if (!selTo) return;

  const currentSelectedTo = selTo.value;
  selTo.innerHTML = '<option value="">-- Select Destination --</option>';

  liveStorages.forEach(st => {
    if (st.storageId !== fromSt) {
      selTo.innerHTML += `<option value="${st.storageId}">${st.storageId} - ${st.storageName}</option>`;
    }
  });

  if (currentSelectedTo && currentSelectedTo !== fromSt) {
    selTo.value = currentSelectedTo;
  } else {
    selTo.value = '';
  }
}

function addOliToTransferCart() {
  const fromSt = document.getElementById('trfFromStorage').value.trim();
  const partNum = document.getElementById('trfPart').value.trim();
  const qty = parseInt(document.getElementById('trfQty').value, 10) || 0;

  if (!fromSt) { showModalAlert("Select Origin Storage", "Please select origin storage first."); return; }
  if (!partNum) { showModalAlert("Select Lubricant", "Please select lubricant product to transfer."); return; }
  if (qty <= 0) { showModalAlert("Invalid Volume", "Transfer volume must be an integer greater than 0 L."); return; }

  const itemMeta = liveItems.find(i => i.partNumber === partNum) || { partDesc: partNum, defaultPrice: 0 };
  transferCart.push({
    fromStorage: fromSt,
    partNumber: partNum,
    partDescription: itemMeta.partDesc,
    qty: qty,
    price: itemMeta.defaultPrice || 0
  });

  renderTransferCart();
  document.getElementById('trfQty').value = '';
  clearTrfPartSelection();
}

function renderTransferCart() {
  const container = document.getElementById('trfCartContainer');
  const listEl = document.getElementById('trfCartList');
  const countEl = document.getElementById('trfCartCount');

  if (transferCart.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  countEl.innerText = transferCart.length;

  listEl.innerHTML = transferCart.map((item, idx) => `
    <div class="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-xs">
      <div class="truncate pr-2">
        <span class="font-bold text-slate-800 font-mono">${item.partNumber}</span>
        <span class="text-amber-700 font-black font-mono ml-1.5">${item.qty.toLocaleString('en-US')} L</span>
        <span class="text-[10px] text-slate-400 block">${item.partDescription} (From ${item.fromStorage})</span>
      </div>
      <button type="button" onclick="removeTransferCartItem(${idx})" class="text-rose-500 hover:text-rose-700 p-1">
        <i class="fa-solid fa-trash-can text-[11px]"></i>
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
  const isInterSite = document.querySelector('input[name="trfTypeOption"]:checked').value === 'INTER_SITE';
  const fromSt = document.getElementById('trfFromStorage').value.trim();
  const tanggal = document.getElementById('trfDate').value.trim();

  if (!fromSt) { showModalAlert("Required Field", "Please select Origin Storage."); return; }
  if (!tanggal) { showModalAlert("Required Field", "Please specify Transfer Date."); return; }

  const btn = document.getElementById('btnSubmitTrf');
  const origBtnHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Logistics Movement...';

  let res;
  if (isInterSite) {
    const toSiteSelect = document.getElementById('trfToSite').value.trim();
    if (!toSiteSelect) {
      showModalAlert("Select Destination Site", "Please select destination project site first.");
      btn.disabled = false;
      btn.innerHTML = origBtnHtml;
      return;
    }

    const isNonSystem = (toSiteSelect === 'NON_SYSTEM');
    let finalToSite = toSiteSelect;
    if (isNonSystem) {
      const nonName = document.getElementById('trfNonSystemName')?.value.trim();
      if (!nonName) {
        showModalAlert("Required Field", "External contractor/project destination is required.");
        btn.disabled = false;
        btn.innerHTML = origBtnHtml;
        return;
      }
      finalToSite = nonName.toUpperCase();
    }

    let noSJ = document.getElementById('trfNoSJ').value.trim();
    if (!noSJ) {
      generateAutoSJNumber();
      noSJ = document.getElementById('trfNoSJ').value.trim();
    }

    const driver = document.getElementById('trfDriver').value.trim() || '-';
    if (!driver || driver === '-') {
      showModalAlert("Required Field", "Transporter name or plate number is required for waybill issuance.");
      btn.disabled = false;
      btn.innerHTML = origBtnHtml;
      return;
    }

    let itemsToSend = transferCart.length > 0 ? transferCart : [];
    if (itemsToSend.length === 0) {
      const partNum = document.getElementById('trfPart').value.trim();
      const qty = parseInt(document.getElementById('trfQty').value, 10) || 0;
      if (!partNum || qty <= 0) {
        showModalAlert("Empty Cargo", "Please add at least 1 lubricant product to the dispatch batch.");
        btn.disabled = false;
        btn.innerHTML = origBtnHtml;
        return;
      }
      const itemMeta = liveItems.find(i => i.partNumber === partNum) || { partDesc: partNum, defaultPrice: 0 };
      itemsToSend.push({
        fromStorage: fromSt,
        partNumber: partNum,
        partDescription: itemMeta.partDesc,
        qty: qty,
        price: itemMeta.defaultPrice || 0
      });
    }

    const payload = {
      site: currentSite,
      toSite: finalToSite,
      isNonSystem: isNonSystem,
      tanggal: tanggal,
      noSJ: noSJ,
      driver: driver,
      items: itemsToSend,
      createdBy: currentUser || 'ADMIN'
    };
    res = await callBackend('SUBMIT_TRANSFER_BATCH', payload);
  } else {
    const toSt = document.getElementById('trfToStorage').value.trim();
    const noMR = document.getElementById('trfMRNo').value.trim();
    const petugas = document.getElementById('trfPetugas') ? document.getElementById('trfPetugas').value.trim() : '';

    if (!toSt) { showModalAlert("Required Field", "Please select Destination Storage."); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }
    if (!noMR) { showModalAlert("Required Field", "Material Request (MR) No. is mandatory!"); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }
    if (!petugas) { showModalAlert("Required Field", "Dispense Operator / Technician name is mandatory!"); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }
    if (fromSt === toSt) { showModalAlert("Invalid Transfer", "Origin and Destination storages cannot be identical!"); btn.disabled = false; btn.innerHTML = origBtnHtml; return; }

    let itemsToSend = transferCart.length > 0 ? transferCart : [];
    if (itemsToSend.length === 0) {
      const partNum = document.getElementById('trfPart').value.trim();
      const qty = parseInt(document.getElementById('trfQty').value, 10) || 0;
      if (!partNum || qty <= 0) {
        showModalAlert("Empty Queue", "Please specify at least 1 lubricant item to transfer.");
        btn.disabled = false;
        btn.innerHTML = origBtnHtml;
        return;
      }
      const itemMeta = liveItems.find(i => i.partNumber === partNum) || { partDesc: partNum, defaultPrice: 0 };
      itemsToSend.push({
        fromStorage: fromSt,
        partNumber: partNum,
        partDescription: itemMeta.partDesc,
        qty: qty,
        price: itemMeta.defaultPrice || 0
      });
    }

    const payload = {
      site: currentSite,
      transferType: 'INTERNAL',
      tanggal: tanggal,
      fromStorage: fromSt,
      toStorage: toSt,
      noMR: noMR,
      petugas: petugas,
      items: itemsToSend,
      createdBy: currentUser || 'ADMIN'
    };
    res = await callBackend('SUBMIT_TRANSFER_LOCAL', payload);
  }

  btn.disabled = false;
  btn.innerHTML = origBtnHtml;

  if (res.success) {
    document.getElementById('trfQty').value = '';
    if (document.getElementById('trfNonSystemName')) document.getElementById('trfNonSystemName').value = '';

    if (!isInterSite) {
      const toStEl = document.getElementById('trfToStorage');
      const mrEl = document.getElementById('trfMRNo');
      if (toStEl) toStEl.value = '';
      if (mrEl) mrEl.value = '';
    }

    clearTransferCart();
    clearTrfPartSelection(false);
    triggerCheckTransferStock();
    fetchAllTankStocks();
    fetchRecentMutasi();

    showModalAlert("Movement Committed", res.message, true, () => {
      if (!isInterSite) {
        setTimeout(() => {
          const toStEl = document.getElementById('trfToStorage');
          if (toStEl) toStEl.focus();
        }, 60);
      }
    });
  } else {
    showModalAlert("Transfer Failed", res.message);
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
  tbody.innerHTML = '';
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">No transfer movements recorded for this period.</td></tr>';
    return;
  }
  data.forEach(row => {
    const isInter = String(row.issuedFor || '').includes('TRANSFER');
    const badgeType = isInter 
      ? '<span class="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">INTER-SITE</span>' 
      : '<span class="bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">INTERNAL</span>';

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 transition-colors font-medium text-slate-700">
        <td class="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">${row.tanggal}</td>
        <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-800">
          ${row.sourceStorage} → <span class="text-amber-800 font-extrabold font-mono">${row.unitTarget}</span>
          <div class="mt-0.5">${badgeType}</div>
        </td>
        <td class="py-2.5 px-3">
          <div class="font-bold text-slate-900 leading-tight font-mono">${row.partNumber}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[140px] leading-tight">${row.partDescription}</div>
        </td>
        <td class="py-2.5 px-3 text-right font-black font-mono text-amber-700 whitespace-nowrap">${Math.round(Number(row.qty)).toLocaleString('en-US')}</td>
        <td class="py-2.5 px-3">
          <div class="text-[11px] text-slate-700 font-medium truncate max-w-[160px]">${row.keterangan || '-'}</div>
        </td>
      </tr>
    `;
  });
}

function filterRecentMutasiTable() {
  const q = (document.getElementById('searchFilterMutasi')?.value || '').trim().toLowerCase();
  const type = (document.getElementById('typeFilterMutasi')?.value || '').trim().toUpperCase();

  const filtered = rawRecentMutasiData.filter(row => {
    const matchType = !type || String(row.issuedFor || '').toUpperCase().includes(type);
    const matchText = !q || `${row.tanggal} ${row.sourceStorage} ${row.unitTarget} ${row.partNumber} ${row.partDescription} ${row.keterangan || ''}`.toLowerCase().includes(q);
    return matchType && matchText;
  });
  renderRecentMutasiRows(filtered);
}

// ==========================================
// 12. TAB 5: RETURN & REVERSAL MANAGEMENT
// ==========================================
function toggleReturnType(mode) {
  const pFleet = document.getElementById('panelReturnFleet');
  const pVendor = document.getElementById('panelReturnVendor');
  const pVendorPQ = document.getElementById('panelVendorPriceQty');
  const pFleetQP = document.getElementById('panelFleetQtyPetugas');
  const bannerTxt = document.getElementById('bannerReturnModeTxt');
  const btnSubmit = document.getElementById('lblBtnSubmitReturn');
  const lblStorage = document.getElementById('lblRetStorage');
  const selStorage = document.getElementById('retStorage');

  if (mode === 'VENDOR') {
    pFleet?.classList.add('hidden');
    pVendor?.classList.remove('hidden');
    pVendorPQ?.classList.remove('hidden');
    pFleetQP?.classList.add('hidden');
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
    pVendorPQ?.classList.add('hidden');
    pFleetQP?.classList.remove('hidden');
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
  const alasan = document.getElementById('retAlasan').value.trim();

  let qty = 0;
  let petugas = '';

  if (mode === 'VENDOR') {
    qty = parseInt(document.getElementById('retVendorQty').value, 10) || 0;
    petugas = document.getElementById('retPetugas') ? document.getElementById('retPetugas').value.trim() : (currentUser || 'ADMIN');
  } else {
    qty = parseInt(document.getElementById('retQty').value, 10) || 0;
    petugas = document.getElementById('retPetugas').value.trim();
  }

  if (!tanggal) { showModalAlert("Required Field", "Please specify Return Date."); return; }
  if (!storageId) { showModalAlert("Required Field", "Please select Target/Source Storage."); return; }
  if (!partNumber) { showModalAlert("Required Field", "Please select Lubricant Item."); return; }
  if (qty <= 0) { showModalAlert("Invalid Volume", "Return volume must be an integer greater than 0 L."); return; }
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
    if (document.getElementById('retQty')) document.getElementById('retQty').value = '';
    if (document.getElementById('retVendorQty')) document.getElementById('retVendorQty').value = '';
    if (document.getElementById('retPetugas')) document.getElementById('retPetugas').value = '';
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
// 13. TAB 4: STOCK BALANCE & RECONCILIATION
// ==========================================
const MONTH_DICT = {
  'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
  'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
};
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function calculateNextMonthCutoff(monthCode, yearNum) {
  const mIdx = MONTH_DICT[monthCode] !== undefined ? MONTH_DICT[monthCode] : 0;
  const y = parseInt(yearNum) || new Date().getFullYear();
  const nextDate = new Date(y, mIdx + 1, 1);
  const nextY = nextDate.getFullYear();
  const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
  const isoDate = `${nextY}-${nextM}-01`;
  const label = `1 ${MONTH_LABELS[nextDate.getMonth()]} ${nextY}`;
  return { isoDate, label };
}

function updateNextPeriodLabel() {
  const m = document.getElementById('balMonth') ? document.getElementById('balMonth').value : 'Nov';
  const y = document.getElementById('balYear') ? document.getElementById('balYear').value : '2026';
  const next = calculateNextMonthCutoff(m, y);
  const lbl = document.getElementById('lblNextPeriodAuto');
  if (lbl) lbl.innerText = next.label;
}

async function fetchStockBalancePreview() {
  updateNextPeriodLabel();
  const month = document.getElementById('balMonth').value;
  const year = document.getElementById('balYear').value;
  const storageId = document.getElementById('balStorage').value;
  const tbody = document.getElementById('tableBalanceBody');

  tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Calculating inventory reconciliation...</td></tr>';

  const res = await callBackend('GET_STOCK_BALANCE_PREVIEW', {
    site: currentSite,
    storageId: storageId,
    month: month,
    year: year
  });

  if (res.success && res.data) {
    balancePreviewData = res.data;
    isPeriodLocked = (res.periodStatus === 'FINAL_LOCKED');
    renderBalanceTable();
    updateBalanceKpiSummary(res.periodStatus);
  } else {
    tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-rose-500 font-bold">${res.message || 'Failed to load reconciliation.'}</td></tr>`;
  }
}

function renderBalanceTable() {
  const tbody = document.getElementById('tableBalanceBody');
  tbody.innerHTML = '';

  const bannerLocked = document.getElementById('badgePeriodLockedBanner');
  const btnSaveDraft = document.getElementById('btnSaveDraft');
  const btnQuick = document.getElementById('btnQuickFillSounding');

  if (isPeriodLocked) {
    if (bannerLocked) bannerLocked.classList.remove('hidden');
    if (btnSaveDraft) {
      btnSaveDraft.disabled = true;
      btnSaveDraft.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (btnQuick) {
      btnQuick.disabled = true;
      btnQuick.classList.add('opacity-50', 'cursor-not-allowed');
    }
  } else {
    if (bannerLocked) bannerLocked.classList.add('hidden');
    if (btnSaveDraft) {
      btnSaveDraft.disabled = false;
      btnSaveDraft.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    if (btnQuick) {
      btnQuick.disabled = false;
      btnQuick.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }

  if (balancePreviewData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400">No inventory transactions found for this storage & period.</td></tr>';
    return;
  }

  const isSuper = (currentRole === 'SUPERADMIN');

  balancePreviewData.forEach((row, idx) => {
    const roundingSounding = Math.round(Number(row.soundingQty) || 0);
    row.soundingQty = roundingSounding;
    const selisih = Number((roundingSounding - Number(row.qtyAkhirBuku)).toFixed(4));
    const absDiff = Math.abs(selisih);

    let actionBtnHtml = '-';
    if (absDiff <= 10) {
      actionBtnHtml = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
          <i class="fa-solid fa-circle-check text-[9px]"></i> Matched
        </span>
      `;
    } else if (isSuper && absDiff > 10 && !isPeriodLocked) {
      actionBtnHtml = `
        <button onclick="openHybridAdjustModal(${idx})" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all whitespace-nowrap">
          <i class="fa-solid fa-sliders mr-1"></i>Adjust
        </button>
      `;
    }

    const selisihClass = absDiff <= 10 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-black';
    const inputDisabledAttr = isPeriodLocked ? 'disabled readonly style="background-color: #f1f5f9; cursor: not-allowed;"' : '';

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 transition-all text-xs border-b border-slate-100 last:border-0">
        <td class="p-3 font-bold text-slate-800 whitespace-nowrap">${row.storageId}</td>
        <td class="p-3">
          <div class="font-extrabold text-slate-900 font-mono">${row.partNumber}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-xs">${row.partDesc}</div>
        </td>
        <td class="p-3 text-right font-mono text-slate-500">${row.qtyAwal}</td>
        <td class="p-3 text-right font-mono text-blue-600 font-bold">+${row.qtyMasuk}</td>
        <td class="p-3 text-right font-mono text-amber-700 font-bold">-${row.qtyKeluar}</td>
        <td class="p-3 text-right font-mono bg-slate-50 font-black text-slate-900">${row.qtyAkhirBuku}</td>
        <td class="p-3 text-center">
          <input type="number" step="1" min="0" value="${roundingSounding}" ${inputDisabledAttr} oninput="updateSoundingLive(${idx}, this.value)" class="w-28 text-center py-1.5 px-2 font-bold font-mono text-slate-900 border rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-slate-50">
        </td>
        <td class="p-3 text-right font-mono ${selisihClass}" id="diffCell_${idx}">
          ${selisih > 0 ? '+' : ''}${selisih}
        </td>
        <td class="p-3 text-center whitespace-nowrap" id="actionCell_${idx}">
          ${actionBtnHtml}
        </td>
      </tr>
    `;
  });
}

function updateSoundingLive(idx, val) {
  if (isPeriodLocked) return;
  const numVal = Math.round(parseFloat(val)) || 0;
  balancePreviewData[idx].soundingQty = numVal;

  const selisih = Number((numVal - Number(balancePreviewData[idx].qtyAkhirBuku)).toFixed(4));
  const absDiff = Math.abs(selisih);
  const diffCell = document.getElementById(`diffCell_${idx}`);
  const actionCell = document.getElementById(`actionCell_${idx}`);

  if (diffCell) {
    diffCell.innerText = `${selisih > 0 ? '+' : ''}${selisih}`;
    diffCell.className = `p-3 text-right font-mono ${absDiff <= 10 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-black'}`;
  }

  if (actionCell) {
    if (absDiff <= 10) {
      actionCell.innerHTML = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
          <i class="fa-solid fa-circle-check text-[9px]"></i> Matched
        </span>
      `;
    } else if (currentRole === 'SUPERADMIN') {
      actionCell.innerHTML = `
        <button onclick="openHybridAdjustModal(${idx})" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all whitespace-nowrap">
          <i class="fa-solid fa-sliders mr-1"></i>Adjust
        </button>
      `;
    } else {
      actionCell.innerHTML = '-';
    }
  }
  updateBalanceKpiSummary('DRAFT');
}

function quickFillSoundingFromBook() {
  if (isPeriodLocked) {
    showModalAlert("Period Locked", "This period is locked under FINAL_LOCKED status and is read-only.");
    return;
  }
  if (!balancePreviewData || balancePreviewData.length === 0) return;
  balancePreviewData.forEach(item => {
    item.soundingQty = Math.round(Number(item.qtyAkhirBuku) || 0);
  });
  renderBalanceTable();
  updateBalanceKpiSummary('DRAFT');
}

function updateBalanceKpiSummary(status) {
  const container = document.getElementById('balanceKpiContainer');
  if (currentRole !== 'SUPERADMIN') {
    if (container) container.classList.add('hidden');
    return;
  }
  if (container) container.classList.remove('hidden');

  let totalVariance = 0;
  let countNeedAction = 0;

  balancePreviewData.forEach(it => {
    const diff = Number((Number(it.soundingQty) - Number(it.qtyAkhirBuku)).toFixed(4));
    totalVariance += diff;
    if (Math.abs(diff) > 10) countNeedAction++;
  });

  totalVariance = Number(totalVariance.toFixed(2));
  const kpiTotal = document.getElementById('kpiTotalVariance');
  const kpiTotalSub = document.getElementById('kpiTotalVarianceSub');
  const kpiNeed = document.getElementById('kpiItemsNeedAction');
  const kpiBadge = document.getElementById('kpiPeriodStatusBadge');
  const kpiSub = document.getElementById('kpiPeriodStatusSub');
  const btnUnlock = document.getElementById('btnSuperadminUnlock');

  if (kpiTotal) {
    kpiTotal.innerText = `${totalVariance > 0 ? '+' : ''}${totalVariance.toLocaleString('en-US')} L`;
    kpiTotal.className = Math.abs(totalVariance) <= 10 ? 'text-base font-black font-mono text-emerald-700' : 'text-base font-black font-mono text-rose-700';
  }
  if (kpiTotalSub) {
    kpiTotalSub.innerText = Math.abs(totalVariance) <= 10 ? 'Within safe tolerance threshold (<= 10 L)' : 'Exceeds threshold, auto-adjust recommended';
  }
  if (kpiNeed) {
    kpiNeed.innerText = `${countNeedAction} Items`;
    kpiNeed.className = countNeedAction > 0 ? 'text-base font-black text-amber-700' : 'text-base font-black text-slate-800';
  }
  if (kpiBadge) {
    kpiBadge.innerText = status || 'DRAFT';
    kpiBadge.className = status === 'FINAL_LOCKED' ? 'text-sm font-extrabold text-emerald-700 uppercase' : 'text-sm font-extrabold text-blue-700 uppercase';
  }
  if (kpiSub) {
    kpiSub.innerText = status === 'FINAL_LOCKED' ? 'Officially finalized (Read-Only)' : 'Editable draft state';
  }
  if (btnUnlock) {
    if (status === 'FINAL_LOCKED') {
      btnUnlock.classList.remove('hidden');
    } else {
      btnUnlock.classList.add('hidden');
    }
  }
}

async function unlockStockBalancePeriod() {
  if (currentRole !== 'SUPERADMIN') return;
  const month = document.getElementById('balMonth').value;
  const year = document.getElementById('balYear').value;

  const btn = document.getElementById('btnSuperadminUnlock');
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Unlocking...';

  const res = await callBackend('UNLOCK_STOCK_BALANCE', {
    site: currentSite,
    month: month,
    year: year,
    role: currentRole,
    executedBy: currentUser || 'SUPERADMIN'
  });

  btn.disabled = false;
  btn.innerHTML = origHtml;

  if (res.success) {
    showModalAlert("Period Unlocked", res.message, true);
    fetchStockBalancePreview();
  } else {
    showModalAlert("Unlock Failed", res.message);
  }
}

async function saveStockBalanceData(isLockFinal) {
  if (balancePreviewData.length === 0) {
    showModalAlert("Attention", "No reconciliation records to save. Please calculate balance first.");
    return;
  }

  const btnDraft = document.getElementById('btnSaveDraft');
  const btnLock = document.getElementById('btnFinalLock');
  const origDraftHtml = btnDraft ? btnDraft.innerHTML : '';
  const origLockHtml = btnLock ? btnLock.innerHTML : '';

  if (btnDraft) {
    btnDraft.disabled = true;
    btnDraft.classList.add('opacity-60', 'cursor-not-allowed');
  }
  if (btnLock) {
    btnLock.disabled = true;
    btnLock.classList.add('opacity-60', 'cursor-not-allowed');
  }

  if (isLockFinal && btnLock) {
    btnLock.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Locking Books & Forwarding Opening...</span>';
  } else if (!isLockFinal && btnDraft) {
    btnDraft.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Saving Draft...</span>';
  }

  try {
    const month = document.getElementById('balMonth').value;
    const year = document.getElementById('balYear').value;
    const isSuper = (currentRole === 'SUPERADMIN');
    const checkOpeningEl = document.getElementById('checkSetAsOpening');
    const setOpening = isSuper && isLockFinal && checkOpeningEl && checkOpeningEl.checked;
    const nextInfo = calculateNextMonthCutoff(month, year);

    // KUNCI: Bila isLockFinal false (klik draft), role dikirim 'ADMIN' agar backend TIDAK mengunci jadi FINAL_LOCKED
    const effectiveRole = isLockFinal ? 'SUPERADMIN' : 'ADMIN';

    const payload = {
      site: currentSite,
      month: month,
      year: year,
      role: effectiveRole,
      items: balancePreviewData,
      setAsNextOpening: setOpening,
      nextCutOffDate: nextInfo.isoDate,
      createdBy: currentUser || (isSuper ? 'SUPERADMIN' : 'ADMIN')
    };

    const res = await callBackend('SAVE_STOCK_BALANCE', payload);
    if (res.success) {
      showModalAlert(isLockFinal ? "Period Finalized & Locked" : "Draft Saved", res.message, true);
      fetchStockBalancePreview();
      fetchAllTankStocks();
    } else {
      showModalAlert("Save Failed", res.message);
    }
  } catch (err) {
    showModalAlert("System Error", "An error occurred while processing reconciliation: " + err.message);
  } finally {
    if (btnDraft) {
      btnDraft.disabled = false;
      btnDraft.innerHTML = origDraftHtml;
      btnDraft.classList.remove('opacity-60', 'cursor-not-allowed');
    }
    if (btnLock) {
      btnLock.disabled = false;
      btnLock.innerHTML = origLockHtml;
      btnLock.classList.remove('opacity-60', 'cursor-not-allowed');
    }
  }
}

// ==========================================
// 14. HYBRID AUTO-ADJUST REVIEW (SUPERADMIN)
// ==========================================
async function openHybridAdjustModal(idx) {
  if (currentRole !== 'SUPERADMIN') {
    showModalAlert("Access Restricted", "Auto-adjustment is restricted to Superadmin.");
    return;
  }

  const item = balancePreviewData[idx];
  const selisih = Number((Number(item.soundingQty) - Number(item.qtyAkhirBuku)).toFixed(4));

  if (Math.abs(selisih) <= 10) {
    showModalAlert("Status", "Variance for this item is within safe tolerance (<= 10 L). No adjustment needed.");
    return;
  }

  const modal = document.getElementById('modalHybridAdjust');
  const tbody = document.getElementById('tableModalAdjustBody');
  tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Calculating allocation vectors...</td></tr>';
  modal.classList.remove('hidden');

  document.getElementById('lblModalAdjustItem').innerText = `${item.storageId} • ${item.partNumber}`;
  document.getElementById('lblModalAdjustDiff').innerText = `${selisih > 0 ? '+' : ''}${selisih} Liters`;
  document.getElementById('lblModalAdjustResidual').innerText = 'Calculating...';

  const payload = {
    site: currentSite,
    storageId: item.storageId,
    partNumber: item.partNumber,
    month: document.getElementById('balMonth').value,
    year: document.getElementById('balYear').value,
    discrepancyQty: selisih
  };

  const res = await callBackend('GET_ADJUST_PREVIEW', payload);
  if (res.success && res.data) {
    currentHybridItemMeta = res.data;
    currentHybridAllocations = res.data.allocations || [];
    renderHybridAdjustModal(res.data);
  } else {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-rose-500 font-bold">${res.message || 'Failed to load allocation preview.'}</td></tr>`;
  }
}

function renderHybridAdjustModal(data) {
  const tbody = document.getElementById('tableModalAdjustBody');
  const boxWarn = document.getElementById('boxWarningSmallPool');
  const residualLbl = document.getElementById('lblModalAdjustResidual');
  const dirBox = document.getElementById('lblModalAdjustDirection');
  const dirTxt = document.getElementById('lblModalAdjustDirectionTxt');

  if (data.isSmallPool) {
    boxWarn.classList.remove('hidden');
  } else {
    boxWarn.classList.add('hidden');
  }

  if (data.isSurplus) {
    dirBox.className = "mb-3 p-2.5 rounded-xl text-[11px] font-semibold flex items-center gap-2 bg-blue-50 text-blue-900 border border-blue-200";
    dirTxt.innerHTML = "<b>Positive Physical Variance (+):</b> Outbound volumes below are <b>reduced</b> proportionally to align book balance with sounding.";
  } else {
    dirBox.className = "mb-3 p-2.5 rounded-xl text-[11px] font-semibold flex items-center gap-2 bg-amber-50 text-amber-900 border border-amber-200";
    dirTxt.innerHTML = "<b>Negative Physical Variance (-):</b> Outbound volumes below are <b>augmented</b> proportionally to absorb variance into equipment operation.";
  }

  residualLbl.innerText = `${data.residualVariance} L`;

  if (!currentHybridAllocations || currentHybridAllocations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">No matching operational transactions found.</td></tr>';
    return;
  }

  tbody.innerHTML = currentHybridAllocations.map((row, idx) => {
    const isMinusAdjust = row.suggestedAdjust < 0;
    const adjustColorClass = isMinusAdjust ? 'text-blue-600' : 'text-amber-800';
    return `
      <tr class="hover:bg-slate-50 transition-colors text-xs">
        <td class="p-2 whitespace-nowrap text-slate-500 font-mono text-[11px]">${row.tanggal}</td>
        <td class="p-2 font-bold text-slate-900 whitespace-nowrap font-mono">
          ${row.unitId}
          ${row.isHeavy ? '<span class="ml-1 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold font-sans">HEAVY FLEET</span>' : ''}
        </td>
        <td class="p-2 text-slate-500 whitespace-nowrap">${row.model}</td>
        <td class="p-2 text-right font-mono font-bold text-slate-700">${Math.round(row.qtyActual)} L</td>
        <td class="p-2 text-center">
          <input type="number" step="1" value="${row.suggestedAdjust}" oninput="updateHybridAdjustInput(${idx}, this.value)" class="w-20 text-center py-1 px-1.5 border rounded-lg font-bold font-mono ${adjustColorClass} bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none">
        </td>
        <td class="p-2 text-right font-mono font-black text-slate-900" id="lblHybridFinal_${idx}">
          ${row.finalQty} L
        </td>
      </tr>
    `;
  }).join('');
}

function updateHybridAdjustInput(idx, val) {
  const intVal = Math.round(Number(val) || 0);
  currentHybridAllocations[idx].suggestedAdjust = intVal;
  const actual = Math.round(Number(currentHybridAllocations[idx].qtyActual) || 0);
  const newFinal = Math.max(1, actual + intVal);
  currentHybridAllocations[idx].finalQty = newFinal;

  const finalLbl = document.getElementById(`lblHybridFinal_${idx}`);
  if (finalLbl) finalLbl.innerText = `${newFinal} L`;

  let totalAssigned = 0;
  currentHybridAllocations.forEach(a => { totalAssigned += Number(a.suggestedAdjust || 0); });
  const origDiff = Number(currentHybridItemMeta.originalDiscrepancy) || 0;
  const residual = Number((origDiff + totalAssigned).toFixed(2));
  document.getElementById('lblModalAdjustResidual').innerText = `${residual} L`;
}

function closeHybridAdjustModal() {
  document.getElementById('modalHybridAdjust').classList.add('hidden');
  currentHybridAllocations = [];
  currentHybridItemMeta = null;
}

async function submitApprovedAdjust() {
  if (!currentHybridAllocations || currentHybridAllocations.length === 0) return;

  const btn = document.getElementById('btnApplyApprovedAdjust');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Committing to Central Database...';

  const payload = {
    site: currentSite,
    storageId: currentHybridItemMeta.storageId,
    partNumber: currentHybridItemMeta.partNumber,
    allocations: currentHybridAllocations.map(a => ({
      rowIndex: a.rowIndex,
      qtyActual: Math.round(Number(a.qtyActual)),
      adjustVal: Math.round(Number(a.suggestedAdjust || 0)),
      unitPrice: a.unitPrice
    })),
    executedBy: currentUser || 'SUPERADMIN'
  };

  const res = await callBackend('APPLY_APPROVED_ADJUST', payload);
  btn.disabled = false;
  btn.innerHTML = originalHtml;

  if (res.success) {
    closeHybridAdjustModal();
    showModalAlert("Adjustments Committed", res.message, true);
    fetchStockBalancePreview();
    fetchRecentPartOut();
    fetchExecutiveKPI();
  } else {
    showModalAlert("Commit Failed", res.message);
  }
}

async function runBatchAdjustForTank() {
  if (currentRole !== 'SUPERADMIN') {
    showModalAlert("Access Restricted", "Batch adjustments are restricted to Superadmin.");
    return;
  }

  const itemsToAdjust = balancePreviewData.filter(it => {
    const diff = Number((Number(it.soundingQty) - Number(it.qtyAkhirBuku)).toFixed(4));
    return Math.abs(diff) > 10;
  }).map(it => ({
    storageId: it.storageId,
    partNumber: it.partNumber,
    discrepancyQty: Number((Number(it.soundingQty) - Number(it.qtyAkhirBuku)).toFixed(4))
  }));

  if (itemsToAdjust.length === 0) {
    showModalAlert("Status", "No items with variance exceeding 10 Liters. All items are within safe tolerance.");
    return;
  }

  const batchContainer = document.getElementById('superadminBatchAction');
  const batchBtn = batchContainer ? batchContainer.querySelector('button') : null;
  let originalBatchHtml = '';
  if (batchBtn) {
    originalBatchHtml = batchBtn.innerHTML;
    batchBtn.disabled = true;
    batchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>⚡ Processing Batch (> 10 L)...</span>';
    batchBtn.classList.add('opacity-70', 'cursor-not-allowed');
  }

  const payload = {
    site: currentSite,
    month: document.getElementById('balMonth').value,
    year: document.getElementById('balYear').value,
    items: itemsToAdjust,
    executedBy: currentUser || 'SUPERADMIN'
  };

  const res = await callBackend('RUN_BATCH_AUTO_ADJUST', payload);

  if (batchBtn) {
    batchBtn.disabled = false;
    batchBtn.innerHTML = originalBatchHtml;
    batchBtn.classList.remove('opacity-70', 'cursor-not-allowed');
  }

  if (res.success) {
    showModalAlert("Batch Auto-Adjust Completed", res.message, true);
    fetchStockBalancePreview();
    fetchRecentPartOut();
    fetchExecutiveKPI();
  } else {
    showModalAlert("Execution Failed", res.message);
  }
}

// ==========================================
// 15. INBOUND REAL-TIME MONITORING
// ==========================================
async function checkPendingInboundTransfers(showAlert = false) {
  const banner = document.getElementById('bannerInboundTransit');
  const countLabel = document.getElementById('lblPendingSJCount');
  const kpiInbound = document.getElementById('kpiInboundCount');

  const res = await callBackend('GET_PENDING_INBOUND_TRANSFERS', { site: currentSite });
  if (res.success && res.data) {
    pendingInboundListRaw = res.data;
    pendingInboundGrouped = res.grouped || {};
    const count = res.sjCount || Object.keys(pendingInboundGrouped).length;

    if (kpiInbound) kpiInbound.innerText = count;

    if (count > 0) {
      if (banner) banner.classList.remove('hidden');
      if (countLabel) countLabel.innerText = `${count} Waybills (${pendingInboundListRaw.length} Cargo Items)`;
    } else {
      if (banner) banner.classList.add('hidden');
      if (showAlert) showModalAlert("Status", "No active inter-site shipments currently in transit.");
    }
  }
}

function openPendingInboundModal() {
  const modal = document.getElementById('modalPendingInbound');
  const listEl = document.getElementById('pendingInboundList');
  if (!modal || !listEl) return;
  modal.classList.remove('hidden');

  if (!pendingInboundGrouped || Object.keys(pendingInboundGrouped).length === 0) {
    listEl.innerHTML = '<p class="text-center text-slate-400 py-6">No inbound shipments waiting for verification.</p>';
    return;
  }

  listEl.innerHTML = Object.entries(pendingInboundGrouped).map(([noSJ, items]) => {
    const first = items[0];
    const rowsHtml = items.map(it => `
      <div class="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
        <div>
          <span class="font-bold text-slate-800 font-mono">${it.partNumber}</span>
          <span class="text-slate-400 block text-[10px]">${it.partDescription}</span>
          <span class="text-[10px] text-emerald-600 font-bold block font-mono">Origin Cost: IDR ${(it.price || 0).toLocaleString('en-US')}/L</span>
        </div>
        <span class="font-black text-amber-700 font-mono">${Math.round(Number(it.qtyKirim)).toLocaleString('en-US')} L</span>
      </div>
    `).join('');

    return `
      <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
        <div class="flex items-center justify-between border-b border-slate-200 pb-2">
          <div>
            <span class="font-black text-slate-900 text-sm font-mono">${noSJ}</span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-bold ml-2 font-mono">FROM PROJECT ${first.originSite}</span>
            <p class="text-[10px] text-slate-400 mt-0.5">${first.keteranganLengkap}</p>
          </div>
          <button onclick="transferInboundToPartInForm('${noSJ}')" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5">
            <i class="fa-solid fa-clipboard-check"></i>
            <span>Inspect in LOG In</span>
          </button>
        </div>
        <div class="space-y-1 bg-white p-2.5 rounded-xl border border-slate-100">${rowsHtml}</div>
      </div>
    `;
  }).join('');
}

function closePendingInboundModal() {
  document.getElementById('modalPendingInbound')?.classList.add('hidden');
}

function transferInboundToPartInForm(noSJ) {
  closePendingInboundModal();
  switchTab('tab-in');

  const radioTransfer = document.querySelector('input[name="inSourceType"][value="TRANSFER_SJ"]');
  if (radioTransfer) {
    radioTransfer.checked = true;
    toggleInSourceType('TRANSFER_SJ');
  }

  const lookupInput = document.getElementById('lookupSJInput');
  if (lookupInput) {
    lookupInput.value = noSJ;
    triggerSJAutoFill();
  }
}

// ==========================================
// 16. STORAGE & LUBE TRUCK MONITORING (TAB 0)
// ==========================================
async function fetchAllTankStocks() {
  const container = document.getElementById('tankCardsContainer');
  if (!container) return;
  container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Synchronizing storage balances...</div>';

  const res = await callBackend('GET_ALL_TANK_STOCKS', { site: currentSite });
  if (res.success && res.data) {
    container.innerHTML = '';
    if (res.data.length === 0) {
      container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400">No storages registered for this site.</div>';
      return;
    }

    res.data.forEach(tank => {
      let itemsHtml = '';
      let totalQtyInTank = 0;

      if (tank.items && tank.items.length > 0) {
        tank.items.forEach(it => {
          const q = Math.round(Number(it.qty) || 0);
          totalQtyInTank += q;
          itemsHtml += `
            <div class="flex items-center justify-between text-xs py-2 border-b border-slate-100 last:border-0">
              <div class="truncate pr-2">
                <p class="font-bold text-slate-800 truncate font-mono">${it.partNumber}</p>
                <p class="text-[10px] text-slate-400 truncate">${it.partDesc}</p>
              </div>
              <span class="font-black text-amber-700 text-sm whitespace-nowrap font-mono">${q.toLocaleString('en-US')} <span class="text-[10px] text-slate-400 font-sans">${it.satuan}</span></span>
            </div>
          `;
        });
      } else {
        itemsHtml = '<p class="text-xs text-slate-400 italic py-4 text-center">Storage empty / no stock registered.</p>';
      }

      const refCap = tank.type === 'LUBE_TRUCK' ? 10000 : 30000;
      const pct = Math.min(100, Math.max(0, Math.round((totalQtyInTank / refCap) * 100)));

      let barColor = 'bg-emerald-500';
      let statusBadge = '<span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Safe Stock</span>';
      if (totalQtyInTank <= 0) {
        barColor = 'bg-slate-300';
        statusBadge = '<span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">Depleted</span>';
      } else if (pct < 20) {
        barColor = 'bg-rose-500';
        statusBadge = '<span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">Low Stock</span>';
      } else if (pct < 50) {
        barColor = 'bg-amber-500';
        statusBadge = '<span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">Moderate</span>';
      }

      const isStoreOrWh = (tank.type === 'WAREHOUSE' || tank.type.includes('STORE') || tank.name.toUpperCase().includes('STORE') || tank.name.toUpperCase().includes('GUDANG') || tank.name.toUpperCase().includes('WAREHOUSE'));
      const tankIconClass = tank.type === 'LUBE_TRUCK' ? 'fa-truck-fast' : (isStoreOrWh ? 'fa-warehouse' : 'fa-gas-pump');

      const card = document.createElement('div');
      card.className = "bg-white p-4.5 rounded-3xl shadow-sm border border-slate-200/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between";
      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center text-base shadow-sm">
                <i class="fa-solid ${tankIconClass}"></i>
              </div>
              <div>
                <h4 class="font-black text-slate-900 text-sm leading-tight">${tank.name}</h4>
                <span class="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-mono tracking-wider">${tank.type}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="text-xs font-mono font-bold text-slate-400 block">#${tank.id}</span>
              ${statusBadge}
            </div>
          </div>

          <div class="mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div class="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1">
              <span>Capacity Level</span>
              <span class="font-mono font-bold text-slate-700">${totalQtyInTank.toLocaleString('en-US')} L (${pct}%)</span>
            </div>
            <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div class="${barColor} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
          </div>

          <div class="space-y-0.5 max-h-48 overflow-y-auto pr-1">
            ${itemsHtml}
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }
}

// ==========================================
// 17. EXPORT CSV DIALOG (NO COLUMN "NO")
// ==========================================
function downloadCSV(reportType) {
  activeExportType = reportType;
  const modal = document.getElementById('modalExportCSV');
  const title = document.getElementById('lblExportTitle');
  const notice = document.getElementById('lblExportNotice');
  const isSuper = (currentRole === 'SUPERADMIN');

  if (reportType === 'OUT') {
    title.innerText = "Export Dispense Log (Part Out)";
    notice.innerText = "CSV format is structured for Microsoft Excel (semicolon delimited & UTF-8 with BOM).";
  } else if (reportType === 'IN') {
    title.innerText = "Export Inbound Receiving Log (Part In)";
    notice.innerText = "CSV format is structured for Microsoft Excel (semicolon delimited & UTF-8 with BOM).";
  } else if (reportType === 'MUTASI') {
    title.innerText = "Export Transfer & Dispatch Log";
    notice.innerText = "CSV export contains all internal tank movements and cross-site shipments.";
  } else if (reportType === 'RETURN') {
    title.innerText = "Export Return & Reversal Audit Log";
    notice.innerText = "Chronological audit trail of all fleet reversals and vendor returns.";
  } else {
    title.innerText = "Export Stock Balance Reconciliation";
    if (isSuper) {
      notice.innerText = "Superadmin Mode: You may export records under either DRAFT or FINAL_LOCKED status.";
    } else {
      notice.innerText = "Notice: Site Administrators may only export reconciliation reports that have been finalized (FINAL_LOCKED).";
    }
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const balM = document.getElementById('balMonth') ? document.getElementById('balMonth').value : monthNames[now.getMonth()];
  const balY = document.getElementById('balYear') ? document.getElementById('balYear').value : now.getFullYear();

  document.getElementById('exportMonth').value = balM || monthNames[now.getMonth()];
  document.getElementById('exportYear').value = balY || now.getFullYear();
  document.getElementById('exportStartDate').value = todayStr;
  document.getElementById('exportEndDate').value = todayStr;

  toggleExportMode('MONTH');
  modal.classList.remove('hidden');
}

function closeExportModal() {
  document.getElementById('modalExportCSV')?.classList.add('hidden');
}

function toggleExportMode(mode) {
  const pMonth = document.getElementById('exportPanelMonth');
  const pRange = document.getElementById('exportPanelRange');
  if (mode === 'MONTH') {
    pMonth.classList.remove('hidden');
    pRange.classList.add('hidden');
  } else {
    pMonth.classList.add('hidden');
    pRange.classList.remove('hidden');
  }
}

async function executeDownloadCSV() {
  const btn = document.getElementById('btnExecuteDownloadCSV');
  const mode = document.querySelector('input[name="exportMode"]:checked').value;
  const reportType = activeExportType;

  const payload = { 
    site: currentSite, 
    reportType: reportType, 
    mode: mode,
    role: currentRole || 'ADMIN'
  };

  if (mode === 'MONTH') {
    payload.month = document.getElementById('exportMonth').value;
    payload.year = document.getElementById('exportYear').value;
  } else {
    payload.startDate = document.getElementById('exportStartDate').value;
    payload.endDate = document.getElementById('exportEndDate').value;
    if (!payload.startDate || !payload.endDate) {
      showModalAlert("Required Field", "Please select both Start Date and End Date.");
      return;
    }
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating CSV Data...';

  let exportHeaders = [];
  let exportRows = [];

  if (reportType === 'RETURN') {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-download"></i> Download CSV File';

    if (!rawRecentReturnData || rawRecentReturnData.length === 0) {
      showModalAlert("Empty Export", "No return records found for this period.");
      return;
    }
    exportHeaders = ["Date", "Category", "Reference ID", "Storage", "Lubricant Item", "Description", "Reversed Qty (L)", "Justification & Operator"];
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
    const res = await callBackend('EXPORT_REPORT_DATA', payload);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-download"></i> Download CSV File';

    if (!res.success || !res.rows || res.rows.length === 0) {
      showModalAlert("Empty Export", res.message || "No records match the requested interval.");
      return;
    }

    exportHeaders = res.headers || [];
    exportRows = res.rows || [];

    // HILANGKAN KOLOM "NO" (Index 0) PADA CSV HASIL DOWNLOAD
    if (exportHeaders.length > 0 && String(exportHeaders[0]).trim().toLowerCase() === 'no') {
      exportHeaders = exportHeaders.slice(1);
      exportRows = exportRows.map(row => row.slice(1));
    }
  }

  let csvContent = "\uFEFF";
  csvContent += exportHeaders.map(h => `"${h}"`).join(";") + "\r\n";
  exportRows.forEach(row => {
    csvContent += row.map(val => `"${val !== null && val !== undefined ? String(val).replace(/"/g, '""') : ''}"`).join(";") + "\r\n";
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Report_${reportType}_${currentSite}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  closeExportModal();
}

// ==========================================
// 18. SYSTEM MODAL NOTIFICATIONS
// ==========================================
function showModalAlert(title, message, isSuccess = false, onDismiss = null) {
  const box = document.getElementById('modalAlertBox');
  const icon = document.getElementById('modalAlertIcon');
  const btn = document.getElementById('modalBtnOk');
  document.getElementById('modalAlertTitle').innerText = title;
  document.getElementById('modalAlertMsg').innerText = message;
  modalCallback = onDismiss;

  if (isSuccess) {
    icon.className = "w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-4 bg-emerald-50 text-emerald-600";
    icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
  } else {
    icon.className = "w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-4 bg-rose-50 text-rose-600";
    icon.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';
  }
  box.classList.remove('hidden');
  setTimeout(() => { if (btn) btn.focus(); }, 50);
}

function closeModalAlert() {
  document.getElementById('modalAlertBox').classList.add('hidden');
  if (typeof modalCallback === 'function') {
    const cb = modalCallback;
    modalCallback = null;
    cb();
  }
}

function handleModalKeydown(e) {
  if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
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

// ==========================================
// 19. DOM INITIALIZATION
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
