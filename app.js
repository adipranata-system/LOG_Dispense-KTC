// ... existing code ...
let balancePreviewData = [];
let rawRecentOutData = [];
let rawRecentInData = [];
let rawRecentMutasiData = [];
let rawRecentReturnData = [];
let modalCallback = null;

let serviceCart = [];
// ... existing code ...
let currentFilteredSuppliers = [];
let activeSupplierIndex = -1;

let currentFilteredRetUnits = [];
let activeRetUnitIndex = -1;
let currentFilteredRetSuppliers = [];
let activeRetSupplierIndex = -1;
let currentFilteredRetParts = [];
let activeRetPartIndex = -1;

let selectedUnitLastHM = 0;
// ... existing code ...
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
// ... existing code ...
  const navBtnMap = {
    'tab-monitoring': 'nav-monitoring',
    'tab-out': 'nav-out',
    'tab-in': 'nav-in',
    'tab-transfer': 'nav-transfer',
    'tab-return': 'nav-return',
    'tab-balance': 'nav-balance'
  };

  const activeBtn = document.getElementById(navBtnMap[targetTabId]);
// ... existing code ...
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
// ... existing code ...
  checkAndClose('partInSearchInput', 'partInDropdownList');
  checkAndClose('trfPartSearchInput', 'trfPartDropdownList');
  checkAndClose('supplierSearchInput', 'supplierDropdownList');
  checkAndClose('retUnitSearchInput', 'retUnitDropdownList');
  checkAndClose('retSupplierSearchInput', 'retSupplierDropdownList');
  checkAndClose('retPartSearchInput', 'retPartDropdownList');
});

// ==========================================
// 8.1. COMBOBOX RETURN & REVERSAL (TAB 6)
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

  dropdown.innerHTML = units.map((u, i) => {
    const isSelected = i === activeRetUnitIndex;
    return `
      <div id="ret-unit-opt-${i}" onclick="selectRetUnitItem('${u.unitId}')" class="p-2.5 ${isSelected ? 'bg-teal-100/80 font-bold' : 'hover:bg-teal-50'} cursor-pointer transition-colors flex items-center justify-between text-xs">
        <div class="truncate pr-2">
          <div class="flex items-center gap-1.5">
            <span class="font-black text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">${u.unitId}</span>
            <span class="font-medium text-slate-700 truncate">${u.desc || '-'}</span>
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5 ml-0.5">Model: <span class="text-teal-800 font-semibold">${u.model || '-'}</span></div>
        </div>
        <i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
      </div>
    `;
  }).join('');

  if (activeRetUnitIndex >= 0) {
    const el = document.getElementById(`ret-unit-opt-${activeRetUnitIndex}`);
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
  const dropdown = document.getElementById('retUnitDropdownList');
  const isHidden = dropdown.classList.contains('hidden');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (isHidden) { openRetUnitDropdown(); return; }
    if (currentFilteredRetUnits.length > 0) {
      activeRetUnitIndex = (activeRetUnitIndex + 1) % currentFilteredRetUnits.length;
      renderRetUnitDropdownItems(currentFilteredRetUnits, activeRetUnitIndex);
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (isHidden) { openRetUnitDropdown(); return; }
    if (currentFilteredRetUnits.length > 0) {
      activeRetUnitIndex = (activeRetUnitIndex - 1 + currentFilteredRetUnits.length) % currentFilteredRetUnits.length;
      renderRetUnitDropdownItems(currentFilteredRetUnits, activeRetUnitIndex);
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (!isHidden && currentFilteredRetUnits.length > 0) {
      const idx = (activeRetUnitIndex >= 0 && activeRetUnitIndex < currentFilteredRetUnits.length) ? activeRetUnitIndex : 0;
      selectRetUnitItem(currentFilteredRetUnits[idx].unitId);
    } else {
      const hmInput = document.getElementById('retHM');
      if (hmInput) { hmInput.focus(); hmInput.select(); }
    }
  } else if (e.key === 'Escape') {
    dropdown.classList.add('hidden');
  }
}

function selectRetUnitItem(unitId) {
  const u = liveUnits.find(item => String(item.unitId) === String(unitId));
  if (!u) return;
  document.getElementById('retUnit').value = u.unitId;
  document.getElementById('retUnitSearchInput').value = `${u.unitId} — ${u.desc || ''} (${u.model || '-'})`;
  document.getElementById('labelRetUnitDesc').innerText = u.desc || '-';
  document.getElementById('labelRetUnitModel').innerText = u.model || '-';

  const chargeSiteVal = (u.chargeSite && u.chargeSite !== 'ALL') ? u.chargeSite : currentSite;
  document.getElementById('retChargeSite').value = chargeSiteVal;
  document.getElementById('retHM').value = u.lastHM || 0;

  document.getElementById('btnClearRetUnit').classList.remove('hidden');
  document.getElementById('retUnitDropdownList').classList.add('hidden');
  const nextInput = document.getElementById('retPartSearchInput');
  if (nextInput) nextInput.focus();
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

  dropdown.innerHTML = suppliers.map((s, i) => {
    const isSelected = i === activeRetSupplierIndex;
    return `
      <div id="ret-supp-opt-${i}" onclick="selectRetSupplierItem('${s.kode}')" class="p-2.5 ${isSelected ? 'bg-teal-100/80 font-bold' : 'hover:bg-teal-50'} cursor-pointer transition-colors flex items-center justify-between text-xs">
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
  const dropdown = document.getElementById('retSupplierDropdownList');
  const isHidden = dropdown.classList.contains('hidden');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (isHidden) { openRetSupplierDropdown(); return; }
    if (currentFilteredRetSuppliers.length > 0) {
      activeRetSupplierIndex = (activeRetSupplierIndex + 1) % currentFilteredRetSuppliers.length;
      renderRetSupplierDropdownItems(currentFilteredRetSuppliers, activeRetSupplierIndex);
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (isHidden) { openRetSupplierDropdown(); return; }
    if (currentFilteredRetSuppliers.length > 0) {
      activeRetSupplierIndex = (activeRetSupplierIndex - 1 + currentFilteredRetSuppliers.length) % currentFilteredRetSuppliers.length;
      renderRetSupplierDropdownItems(currentFilteredRetSuppliers, activeRetSupplierIndex);
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (!isHidden && currentFilteredRetSuppliers.length > 0) {
      const idx = (activeRetSupplierIndex >= 0 && activeRetSupplierIndex < currentFilteredRetSuppliers.length) ? activeRetSupplierIndex : 0;
      selectRetSupplierItem(currentFilteredRetSuppliers[idx].kode);
    }
  } else if (e.key === 'Escape') {
    dropdown.classList.add('hidden');
  }
}

function selectRetSupplierItem(kode) {
  const s = liveSuppliers.find(item => String(item.kode) === String(kode));
  if (!s) return;
  document.getElementById('retSupplierCode').value = s.kode;
  document.getElementById('retSupplierName').value = s.nama;
  document.getElementById('retSupplierSearchInput').value = `${s.kode} — ${s.nama}`;
  document.getElementById('lblRetSelectedSupplierDesc').innerHTML = `Verified Master: <b class="text-teal-700">${s.nama}</b>`;
  document.getElementById('btnClearRetSupplier').classList.remove('hidden');
  document.getElementById('retSupplierDropdownList').classList.add('hidden');
  const nextInput = document.getElementById('retPartSearchInput');
  if (nextInput) nextInput.focus();
}

function clearRetSupplierSelection() {
  document.getElementById('retSupplierCode').value = '';
  document.getElementById('retSupplierName').value = '';
  document.getElementById('retSupplierSearchInput').value = '';
  document.getElementById('lblRetSelectedSupplierDesc').innerHTML = 'Verified Master: <b>-</b>';
  document.getElementById('btnClearRetSupplier').classList.add('hidden');
  renderRetSupplierDropdownItems(liveSuppliers);
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

function handleRetPartKeydown(e) {
  activeRetPartIndex = genericHandleKeydown(e, 'retPartDropdownList', currentFilteredRetParts, activeRetPartIndex, selectRetPartItem, (l, i) => renderRetPartDropdownItems(l, i));
}

function selectRetPartItem(partNum) {
  const p = liveItems.find(item => String(item.partNumber) === String(partNum));
  if (!p) return;
  document.getElementById('retPart').value = p.partNumber;
  document.getElementById('retPartSearchInput').value = `${p.partNumber} — ${p.partDesc || ''}`;
  document.getElementById('labelRetPartDesc').innerText = p.partDesc || '-';
  if (p.defaultPrice !== undefined && p.defaultPrice !== null) {
    document.getElementById('retHarga').value = Number(p.defaultPrice).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  document.getElementById('btnClearRetPart').classList.remove('hidden');
  document.getElementById('retPartDropdownList').classList.add('hidden');
  triggerCheckReturnStock();
  const nextInput = document.getElementById('retQty');
  if (nextInput) { nextInput.focus(); nextInput.select(); }
}

function clearRetPartSelection() {
  document.getElementById('retPart').value = '';
  document.getElementById('retPartSearchInput').value = '';
  document.getElementById('labelRetPartDesc').innerText = '-';
  document.getElementById('labelRetLiveStock').innerHTML = 'Available: <span class="text-teal-700 font-mono">0 L</span>';
  document.getElementById('btnClearRetPart').classList.add('hidden');
  renderRetPartDropdownItems(liveItems);
  document.getElementById('retPartSearchInput').focus();
}

function triggerCheckReturnStock() {
  queryLiveStock(document.getElementById('retStorage').value, document.getElementById('retPart').value, 'labelRetLiveStock', true);
}

// ==========================================
// 8.2. RETURN MANAGEMENT CONTROLLER (TAB 6)
// ==========================================
function toggleReturnType(mode) {
  const pFleet = document.getElementById('panelReturnFleet');
  const pVendor = document.getElementById('panelReturnVendor');
  const bannerTxt = document.getElementById('bannerReturnModeTxt');
  const btnSubmit = document.getElementById('lblBtnSubmitReturn');
  const lblStorage = document.getElementById('lblRetStorage');
  const selStorage = document.getElementById('retStorage');

  if (mode === 'VENDOR') {
    pFleet.classList.add('hidden');
    pVendor.classList.remove('hidden');
    lblStorage.innerHTML = 'Source Warehouse (Tangki yang Dipotong) <span class="text-rose-500">*</span>';
    bannerTxt.innerHTML = '<b>Vendor Inbound Reversal:</b> Returning lubricant to vendor/supplier. Storage stock will <b>decrease</b> and DO purchase amount will be <b>credited</b>.';
    btnSubmit.innerText = '↩️ Commit Vendor DO Inbound Reversal';

    // Kunci tangki ke store jika retur vendor
    const storeTank = (liveStorages || []).find(s => {
      const type = String(s.type || '').toUpperCase();
      const name = String(s.storageName || s.storageId).toUpperCase();
      return type.includes('STORE') || type.includes('WAREHOUSE') || name.includes('STORE') || name.includes('GUDANG');
    });
    if (storeTank && selStorage) selStorage.value = storeTank.storageId;
  } else {
    pFleet.classList.remove('hidden');
    pVendor.classList.add('hidden');
    lblStorage.innerHTML = 'Receiving Storage (Target Tank) <span class="text-rose-500">*</span>';
    bannerTxt.innerHTML = '<b>Fleet Dispense Reversal:</b> Returning lubricant to tank from heavy equipment. Storage stock will <b>increase</b> and fleet consumption will be <b>deducted</b>.';
    btnSubmit.innerText = '↩️ Commit Fleet Dispense Reversal';
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
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Committing Reversal to Central Database...';

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
      tanggal: tanggal,
      targetStorage: storageId,
      partNumber: partNumber,
      partDescription: itemMeta.partDesc,
      qty: qty,
      price: itemMeta.defaultPrice || 0,
      unitId: unitId,
      hm: hm,
      unitDescription: unitMeta.desc,
      model: unitMeta.model,
      chargeSite: chargeSite,
      petugas: petugas,
      alasan: alasan,
      createdBy: currentUser || 'ADMIN'
    };
    res = await callBackend('SUBMIT_RETURN_OUT', payload);
  } else {
    const noDok = document.getElementById('retNoDok').value.trim();
    const suppCode = document.getElementById('retSupplierCode').value.trim();
    const suppName = document.getElementById('retSupplierName').value.trim();
    const hargaSatuan = parseDecimalInput(document.getElementById('retHarga').value, itemMeta.defaultPrice || 0);

    if (!noDok) {
      showModalAlert("Required Field", "Reference DO / Waybill No. is required for vendor reversal.");
      btn.disabled = false;
      btn.innerHTML = origBtnHtml;
      return;
    }

    const payload = {
      site: currentSite,
      tanggal: tanggal,
      sourceStorage: storageId,
      partNumber: partNumber,
      partDescription: itemMeta.partDesc,
      qty: qty,
      noDokumen: noDok,
      codeSupplier: suppCode || 'VENDOR',
      supplierDescription: suppName || 'VENDOR',
      hargaSatuan: hargaSatuan,
      petugas: petugas,
      alasan: alasan,
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
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400">No return/reversal transactions recorded for this period.</td></tr>';
    return;
  }

  data.forEach(row => {
    const isFleet = row.category === 'FLEET_RETURN';
    const catBadge = isFleet
      ? '<span class="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-extrabold text-[9px] font-mono">FLEET REVERSAL</span>'
      : '<span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-extrabold text-[9px] font-mono">VENDOR RETUR</span>';

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 transition-colors font-medium text-slate-700">
        <td class="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">${row.tanggal}</td>
        <td class="py-2.5 px-3 whitespace-nowrap">${catBadge}</td>
        <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-900 font-mono text-xs">${row.refId || '-'}</td>
        <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-800">${row.storage || '-'}</td>
        <td class="py-2.5 px-3">
          <div class="font-bold text-slate-900 leading-tight font-mono">${row.partNumber}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[150px] leading-tight">${row.partDescription}</div>
        </td>
        <td class="py-2.5 px-3 text-right font-black font-mono text-teal-700 whitespace-nowrap">
          ${isFleet ? '+' : '-'}${Math.round(Number(row.qty)).toLocaleString('en-US')} L
        </td>
        <td class="py-2.5 px-3">
          <div class="text-[11px] text-slate-800 font-semibold truncate max-w-[200px]">${row.keterangan || '-'}</div>
          ${row.user && row.user !== '-' ? `<span class="text-[9px] text-slate-400 block">User: ${row.user}</span>` : ''}
        </td>
      </tr>
    `;
  });
}

function filterRecentReturnTable() {
  const q = (document.getElementById('searchFilterReturn')?.value || '').trim().toLowerCase();
  const cat = (document.getElementById('typeFilterReturn')?.value || '').trim();

  const filtered = rawRecentReturnData.filter(row => {
    const matchCat = !cat || row.category === cat;
    const matchText = !q || `${row.tanggal} ${row.refId || ''} ${row.storage || ''} ${row.partNumber} ${row.partDescription || ''} ${row.keterangan || ''}`.toLowerCase().includes(q);
    return matchCat && matchText;
  });
  renderRecentReturnRows(filtered);
}

// ==========================================
// 19. EXPORT CSV DATA
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
    notice.innerText = "CSV export contains all ledger-balanced reversal entries.";
  } else {
    title.innerText = "Export Stock Balance Reconciliation";
    if (isSuper) {
      notice.innerText = "Superadmin Mode: You may export records under either DRAFT or FINAL_LOCKED status.";
    } else {
      notice.innerText = "Notice: Site Administrators may only export reconciliation reports that have been finalized (FINAL_LOCKED).";
    }
  }

  const now = new Date();
// ... existing code ...
async function executeDownloadCSV() {
// ... existing code ...
  if (reportType === 'RETURN') {
    exportHeaders = ["Tanggal", "Kategori", "Referensi (Unit / DO)", "Tangki", "Kode Part", "Nama Pelumas", "Qty (Liter)", "Justifikasi & Pelaksana"];
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
  link.download = `Laporan_${reportType}_${currentSite}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  closeExportModal();
}
