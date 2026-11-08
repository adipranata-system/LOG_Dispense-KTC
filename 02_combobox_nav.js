/**
 * ============================================================================
 * MODUL 2: COMBOBOX ENGINE, KEYBOARD NAVIGATION & VALIDATION (02_combobox_nav.js)
 * LOG DISPENSE MANAGEMENT SYSTEM v3.5 ENTERPRISE
 * PT.KTC Coal Mining & Energy
 * Architect & Lead Engineer: Adi Pranata
 * ============================================================================
 */

// ==========================================
// 1. GENERIC COMBOBOX RENDERING & KEYBOARD LOGIC
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

// ==========================================
// 2. PART OUT COMBOBOX (TAB 1: DISPENSE)
// ==========================================
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

  // Alur Enter: Jika mode batch service -> fokus ke outQty, jika normal -> fokus ke unitSearchInput
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

// ==========================================
// 3. FLEET UNIT ID COMBOBOX (TAB 1: DISPENSE)
// ==========================================
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

// ==========================================
// 4. SUPPLIER COMBOBOX (TAB 2: INBOUND)
// ==========================================
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

// ==========================================
// 5. PART IN COMBOBOX (TAB 2: INBOUND)
// ==========================================
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

// ==========================================
// 6. TRANSFER PART COMBOBOX (TAB 3: TRANSFER)
// ==========================================
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

  // Deteksi Satuan Otomatis (Kg vs L)
  const rawSatuan = String(p.satuan || 'LTR').trim().toUpperCase();
  const isKg = (rawSatuan === 'KG' || rawSatuan === 'KGM');
  const unitBadge = isKg ? 'Kg' : 'L';
  const unitFull = isKg ? 'Kilograms' : 'Liters';

  const lblUnit = document.getElementById('lblTrfUnit');
  if (lblUnit) lblUnit.innerText = unitFull;

  const lblTitle = document.getElementById('lblTrfQtyTitle');
  if (lblTitle) lblTitle.innerHTML = `${isKg ? 'Weight' : 'Volume'} (${unitBadge}) <span class="text-rose-500">*</span>`;

  triggerCheckTransferStock();
  const nextInput = document.getElementById('trfQty');
  if (nextInput) { nextInput.focus(); nextInput.select(); }
}

function clearTrfPartSelection(shouldFocus = false) {
  document.getElementById('trfPart').value = '';
  document.getElementById('trfPartSearchInput').value = '';
  document.getElementById('labelTrfPartDesc').innerText = '-';
  document.getElementById('labelTrfStock').innerHTML = 'Available: <span class="text-amber-700 font-mono">0 L</span>';

  const lblUnit = document.getElementById('lblTrfUnit');
  if (lblUnit) lblUnit.innerText = 'Liters';

  const lblTitle = document.getElementById('lblTrfQtyTitle');
  if (lblTitle) lblTitle.innerHTML = 'Volume (Liters) <span class="text-rose-500">*</span>';

  document.getElementById('btnClearTrfPart').classList.add('hidden');
  const drop = document.getElementById('trfPartDropdownList');
  if (drop) drop.classList.add('hidden');
  renderTrfPartDropdownItems(liveItems);
  if (shouldFocus) document.getElementById('trfPartSearchInput').focus();
}

// ==========================================
// 7. RETURN COMBOBOXES (TAB 5: RETURN)
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
// 8. STOCK LEVEL QUERY & ANTI-MINUS / HM CHECK
// ==========================================
async function queryLiveStock(storageId, partNumber, labelElemId, isTransfer = false) {
  const label = document.getElementById(labelElemId);
  const itemMeta = liveItems.find(i => String(i.partNumber) === String(partNumber));
  const rawSatuan = String(itemMeta?.satuan || 'LTR').trim().toUpperCase();
  const unitTxt = (rawSatuan === 'KG' || rawSatuan === 'KGM') ? 'Kg' : 'L';

  if (!storageId || !partNumber) {
    if (label) {
      label.innerHTML = `Available: <span class="text-amber-700 font-mono">0 ${unitTxt}</span>`;
    }
    if (!isTransfer) currentAvailableStock = 0;
    return 0;
  }
  if (label) label.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
  const res = await callBackend('CHECK_STOCK', { site: currentSite, storageId: storageId, partNumber: partNumber });
  const stock = res.success ? Math.round(Number(res.stock) || 0) : 0;
  if (label) {
    label.innerHTML = `Available: <span class="text-amber-700 font-bold font-mono">${stock.toLocaleString('en-US')} ${unitTxt}</span>`;
  }
  if (!isTransfer) {
    currentAvailableStock = stock;
    validateAntiMinus(document.getElementById('outQty')?.value);
  }
  return stock;
}

function triggerCheckStock() {
  queryLiveStock(document.getElementById('outStorage')?.value, document.getElementById('outPart')?.value, 'labelLiveStock', false);
}

function triggerCheckTransferStock() {
  queryLiveStock(document.getElementById('trfFromStorage')?.value, document.getElementById('trfPart')?.value, 'labelTrfStock', true);
}

function triggerCheckReturnStock() {
  const st = document.getElementById('retStorage')?.value;
  const pt = document.getElementById('retPart')?.value;
  queryLiveStock(st, pt, 'labelRetLiveStock', true);
}

function validateAntiMinus(val) {
  const requested = parseInt(val, 10) || 0;
  const warn = document.getElementById('warnMinus');
  const btn = document.getElementById('btnSubmitOut');
  if (!warn || !btn) return;
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
  document.getElementById('resetHMPanel')?.classList.toggle('hidden');
}

function validateHMInput(val) {
  const inputHM = parseFloat(val) || 0;
  const isResetChecked = document.getElementById('checkResetHM')?.checked || false;
  const warnBox = document.getElementById('warnHM');
  const warnTxt = document.getElementById('warnHMTxt');
  const warnHighBox = document.getElementById('warnHMHigh');
  const hmInputEl = document.getElementById('outHM');
  const btnSubmit = document.getElementById('btnSubmitOut');

  if (selectedUnitLastHM > 0 && !isResetChecked && inputHM > 0 && inputHM < selectedUnitLastHM) {
    isHMValid = false;
    if (warnBox) warnBox.classList.remove('hidden');
    if (warnTxt) warnTxt.innerText = `Input HM (${inputHM.toLocaleString('en-US')}) is lower than last recorded meter (${selectedUnitLastHM.toLocaleString('en-US')})!`;
    if (hmInputEl) hmInputEl.classList.add('border-rose-400', 'bg-rose-50', 'text-rose-700');
    if (btnSubmit) btnSubmit.disabled = true;
    if (warnHighBox) warnHighBox.classList.add('hidden');
  } else {
    isHMValid = true;
    if (warnBox) warnBox.classList.add('hidden');
    if (hmInputEl) hmInputEl.classList.remove('border-rose-400', 'bg-rose-50', 'text-rose-700');
    if (btnSubmit) btnSubmit.disabled = false;

    if (selectedUnitLastHM > 0 && !isResetChecked && inputHM > 0) {
      const deltaHM = Number((inputHM - selectedUnitLastHM).toFixed(1));
      if (deltaHM > 30) {
        if (warnHighBox) {
          warnHighBox.classList.remove('hidden');
          const warnHighTxt = document.getElementById('warnHMHighTxt');
          if (warnHighTxt) warnHighTxt.innerText = `Notice: Elevated HM Delta (+${deltaHM.toLocaleString('en-US')} hrs from last log). Verify digit entry!`;
        }
      } else {
        if (warnHighBox) warnHighBox.classList.add('hidden');
      }
    } else {
      if (warnHighBox) warnHighBox.classList.add('hidden');
    }

    validateAntiMinus(document.getElementById('outQty')?.value);
  }
}

function toggleResetHM(isChecked) {
  const warnBox = document.getElementById('warnHM');
  const warnHighBox = document.getElementById('warnHMHigh');
  const hmInputEl = document.getElementById('outHM');
  if (isChecked) {
    if (warnHighBox) warnHighBox.classList.add('hidden');
    if (warnBox) {
      warnBox.classList.remove('hidden');
      warnBox.className = "text-[11px] text-blue-700 font-bold bg-blue-50 p-2 rounded-lg border border-blue-200";
    }
    const warnTxt = document.getElementById('warnHMTxt');
    if (warnTxt) warnTxt.innerText = "ℹ️ Gauge Override Mode Active: Newly initialized meter will be accepted.";
    isHMValid = true;
  } else {
    if (warnBox) {
      warnBox.className = "hidden text-[11px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200";
    }
    validateHMInput(hmInputEl?.value);
  }
}
