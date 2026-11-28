/**
 * ============================================================================
 * MODUL 3: OPERATIONAL TRANSACTIONS & DISPATCH (03_transactions.js)
 * LOG DISPENSE MANAGEMENT SYSTEM v3.5 ENTERPRISE
 * PT.KTC Coal Mining & Energy
 * Architect & Lead Engineer: Adi Pranata
 * ============================================================================
 */

// ==========================================
// 1. TAB 1: DISPENSE ORDER (LOG OUT)
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
    container?.classList.add('hidden');
    if (btnLabel) btnLabel.innerText = "Submit Dispense Order";
    return;
  }

  container?.classList.remove('hidden');
  if (countEl) countEl.innerText = serviceCart.length;
  if (btnLabel) btnLabel.innerText = `Submit Batch (${serviceCart.length} Service Items)`;

  if (listEl) {
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
  const isResetChecked = document.getElementById('checkResetHM')?.checked || false;
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
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span id="btnSubmitOutLabel">Submit Dispense Order</span>';
      return;
    }
    if (!partNumber) {
      showModalAlert("Required Field", "Please select Lubricant Item.");
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span id="btnSubmitOutLabel">Submit Dispense Order</span>';
      return;
    }
    if (qty <= 0) {
      showModalAlert("Required Field", "Dispense volume must be an integer greater than 0 L.");
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span id="btnSubmitOutLabel">Submit Dispense Order</span>';
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
    if (document.getElementById('checkResetHM')) document.getElementById('checkResetHM').checked = false;
    document.getElementById('resetHMPanel')?.classList.add('hidden');
    clearServiceCart();
    clearUnitSelection();
    clearPartSelection();
    triggerCheckStock();
    fetchRecentPartOut();
    fetchAllTankStocks();
    fetchExecutiveKPI();

    showModalAlert("Transaction Successful", res.message, true, () => {
      setTimeout(() => { document.getElementById('partSearchInput')?.focus(); }, 50);
    });
  } else {
    showModalAlert("Transaction Rejected", res.message);
  }
}

let dispenseLogRangeMode = '7D';

function handleDispenseRangeChange(newMode) {
  const mode = String(newMode || '7D').trim().toUpperCase();
  dispenseLogRangeMode = mode;

  const sel = document.getElementById('rangeFilterOut');
  if (sel && sel.value !== mode) sel.value = mode;

  fetchRecentPartOut(mode);
}

function updateDispenseRangeUI(mode, count) {
  const subEl = document.getElementById('lblDispenseLogSubtitle');
  const footerTextEl = document.getElementById('lblDispenseFooterText');
  const switchBtnEl = document.getElementById('btnSwitchDispenseMTD');

  if (mode === 'MTD') {
    if (subEl) subEl.innerText = `Showing all ${count} operational records for current month (MTD)`;
    if (footerTextEl) footerTextEl.innerText = `Displaying complete Month-to-Date (MTD) records (${count} entries).`;
    if (switchBtnEl) {
      switchBtnEl.setAttribute('onclick', "handleDispenseRangeChange('7D')");
      switchBtnEl.innerHTML = '<i class="fa-solid fa-bolt text-[10px]"></i><span>Back to Last 7 Days</span>';
    }
  } else {
    if (subEl) subEl.innerText = 'Showing last 7 days operational records for fast loading';
    if (footerTextEl) footerTextEl.innerText = 'Showing last 7 days of records. Need to view earlier transactions this month?';
    if (switchBtnEl) {
      switchBtnEl.setAttribute('onclick', "handleDispenseRangeChange('MTD')");
      switchBtnEl.innerHTML = '<i class="fa-solid fa-calendar-days text-[10px]"></i><span>Load Full Month (MTD)</span>';
    }
  }
}

async function fetchRecentPartOut(overrideMode) {
  const tbody = document.getElementById('tableRecentOut');
  if (!tbody) return;

  const sel = document.getElementById('rangeFilterOut');
  const mode = String(overrideMode || (sel ? sel.value : dispenseLogRangeMode) || '7D').trim().toUpperCase();
  dispenseLogRangeMode = mode;
  if (sel && sel.value !== mode) sel.value = mode;

  const loadingText = mode === 'MTD'
    ? 'Loading full Month-to-Date (MTD) dispense log...'
    : 'Loading last 7 days dispense log...';
  tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>${loadingText}</td></tr>`;

  const res = await callBackend('GET_RECENT_OUT', { site: currentSite, rangeMode: mode });
  if (res.success && res.data) {
    rawRecentOutData = res.data;
    updateDispenseRangeUI(mode, rawRecentOutData.length);
    filterRecentOutTable();
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
// 2. TAB 2: INBOUND RECEIVING (LOG IN)
// ==========================================
let inboundSJMatchedItems = [];

/**
 * Parser cerdas untuk membaca format angka ribuan & desimal Indonesia (56.730,77)
 * maupun format US (56,730.77) tanpa terpotong di tanda titik kedua.
 */
function parseDecimalInput(strVal, defaultVal = 0) {
  if (strVal === undefined || strVal === null || String(strVal).trim() === '') return defaultVal;
  if (typeof strVal === 'number') return isNaN(strVal) ? defaultVal : Number(strVal.toFixed(2));

  let clean = String(strVal).trim().replace(/\s+/g, '');
  const hasComma = clean.includes(',');
  const hasDot = clean.includes('.');

  if (hasComma && hasDot) {
    // Format Indonesia: titik ribuan, koma desimal (contoh: 56.730,77)
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // Format US: koma ribuan, titik desimal (contoh: 56,730.77)
      clean = clean.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Hanya koma (contoh: 56730,77 atau ribuan ganda 1,250,000)
    const commaCount = (clean.match(/,/g) || []).length;
    if (commaCount > 1) {
      clean = clean.replace(/,/g, '');
    } else {
      clean = clean.replace(',', '.');
    }
  } else if (hasDot) {
    // Hanya titik dengan pola ribuan murni (contoh: 56.730 atau 1.250.000)
    if (/^-?\d{1,3}(\.\d{3})+$/.test(clean)) {
      clean = clean.replace(/\./g, '');
    }
  }

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
    pSJ?.classList.remove('hidden');
    cItemDetail?.classList.add('hidden');
    cPartSearch?.classList.add('hidden');
    cQtyDoc?.classList.add('hidden');
    vendorCartCont?.classList.add('hidden');
    if (btnLbl) btnLbl.innerText = "Confirm Inbound Inter-Site Transfer";

    if (suppInput) {
      suppInput.disabled = true;
      suppInput.classList.add('bg-slate-100', 'cursor-not-allowed');
    }
    btnClearSupp?.classList.add('hidden');
  } else {
    pSJ?.classList.add('hidden');
    cItemDetail?.classList.remove('hidden');
    cPartSearch?.classList.remove('hidden');
    cQtyDoc?.classList.remove('hidden');
    cartCont?.classList.add('hidden');
    inboundSJMatchedItems = [];
    renderVendorInCart();

    if (suppInput) {
      suppInput.disabled = false;
      suppInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
    }
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
    container?.classList.add('hidden');
    if (btnLabel) btnLabel.innerText = "Submit Inbound Receiving";
    return;
  }

  container?.classList.remove('hidden');
  if (countEl) countEl.innerText = vendorInCart.length;
  if (btnLabel) btnLabel.innerText = `Submit Batch (${vendorInCart.length} DO Items)`;

  if (listEl) {
    listEl.innerHTML = vendorInCart.map((item, idx) => `
      <div class="flex items-center justify-between bg-white p-1.5 rounded-xl border border-blue-200 text-xs">
        <div class="truncate pr-2">
          <span class="font-bold text-slate-800 font-mono">${item.partNumber}</span>
          <span class="text-blue-700 font-black font-mono ml-1.5">${item.qty.toLocaleString('id-ID')} L</span>
          <span class="text-[10px] text-emerald-700 font-bold ml-1.5 font-mono">@IDR ${item.hargaSatuan.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span class="text-[10px] text-slate-400 block">${item.partDescription} (Total: IDR ${item.hargaTotal.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
        </div>
        <button type="button" onclick="removeVendorInCartItem(${idx})" class="text-rose-500 hover:text-rose-700 p-1">
          <i class="fa-solid fa-trash-can text-[11px]"></i>
        </button>
      </div>
    `).join('');
  }
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

  const btn = document.getElementById('btnFetchCargo');
  let origBtnHtml = '';
  if (btn) {
    origBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Fetching...</span>';
    btn.classList.add('opacity-70', 'cursor-not-allowed');
  }

  if (statusLbl) {
    statusLbl.innerText = "Searching Logistics Registry...";
    statusLbl.classList.remove('hidden');
  }

  try {
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
        document.getElementById('inHarga').value = Number(first.price).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      const cartCont = document.getElementById('inboundCartContainer');
      const cartList = document.getElementById('inboundCartList');
      const cartCount = document.getElementById('inboundCartCount');

      cartCont?.classList.remove('hidden');
      if (cartCount) cartCount.innerText = inboundSJMatchedItems.length;
      if (cartList) {
        cartList.innerHTML = inboundSJMatchedItems.map(it => `
          <div class="flex items-center justify-between bg-white p-2 rounded-xl border border-amber-200 text-xs">
            <div>
              <span class="font-bold text-slate-800 font-mono">${it.partNumber}</span>
              <span class="text-slate-400 block text-[10px]">${it.partDescription}</span>
            </div>
            <span class="font-black text-amber-800 font-mono">${Math.round(Number(it.qtyKirim)).toLocaleString('id-ID')} L</span>
          </div>
        `).join('');
      }

      if (statusLbl) {
        statusLbl.innerText = `✓ Found ${inboundSJMatchedItems.length} cargo item(s) from Site ${first.originSite}.`;
        statusLbl.className = "text-[10px] text-emerald-700 font-bold mt-1 block";
      }
    } else {
      inboundSJMatchedItems = [];
      document.getElementById('inboundCartContainer')?.classList.add('hidden');
      if (statusLbl) {
        statusLbl.innerText = res.message || "No active in-transit cargo matched this Waybill.";
        statusLbl.className = "text-[10px] text-rose-600 font-bold mt-1 block";
      }
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnHtml;
      btn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
  }
}

async function submitPartInData() {
  const mode = document.querySelector('input[name="inSourceType"]:checked')?.value || 'VENDOR';
  const tanggal = document.getElementById('inDate').value.trim();
  const storageId = document.getElementById('inStorage').value.trim();
  const btn = document.getElementById('btnSubmitIn');

  if (!tanggal) { showModalAlert("Required Field", "Please specify Receiving Date."); return; }
  if (!storageId) { showModalAlert("Storage Error", "Receiving Store Tank is not configured for this site."); return; }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Committing Inbound to Central Database...';

  let res;
  if (mode === 'TRANSFER_SJ') {
    if (inboundSJMatchedItems.length === 0) {
      showModalAlert("Cargo Required", "Please search and fetch a valid Waybill (SJ) first.");
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> <span id="lblBtnSubmitIn">Confirm Inbound Inter-Site Transfer</span>';
      return;
    }

    const first = inboundSJMatchedItems[0];
    const payload = {
      site: currentSite,
      originSite: first.originSite,
      tanggalTerima: tanggal,
      targetStorage: storageId,
      items: inboundSJMatchedItems.map(it => ({
        partNumber: it.partNumber,
        partDescription: it.partDescription,
        qtyTerima: Math.round(Number(it.qtyKirim)),
        price: Number(it.price) || 0,
        noSJ: it.noSJ,
        targetStorage: storageId
      }))
    };
    res = await callBackend('CONFIRM_INBOUND_TRANSFER', payload);
  } else {
    const noDok = document.getElementById('inNoDok').value.trim();
    const suppCode = document.getElementById('inSupplierCode').value.trim();
    const suppName = document.getElementById('inSupplierName').value.trim();

    if (!noDok) {
      showModalAlert("Required Field", "Please enter Delivery Order (DO) / Waybill Number.");
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> <span id="lblBtnSubmitIn">Submit Inbound Receiving</span>';
      return;
    }
    if (!suppCode || !suppName) {
      showModalAlert("Required Field", "Please select Supplier / Vendor Origin from master list.");
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> <span id="lblBtnSubmitIn">Submit Inbound Receiving</span>';
      return;
    }

    let itemsPayload = [];
    if (vendorInCart.length > 0) {
      itemsPayload = vendorInCart;
    } else {
      const partNum = document.getElementById('inPart').value.trim();
      const rawQty = document.getElementById('inQty').value.trim();
      const rawHarga = document.getElementById('inHarga').value.trim();
      const qty = parseInt(rawQty, 10) || 0;

      if (!partNum || qty <= 0) {
        showModalAlert("Incomplete Item", "Please select Lubricant Item and enter a valid integer volume (> 0 L).");
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> <span id="lblBtnSubmitIn">Submit Inbound Receiving</span>';
        return;
      }

      const itemMeta = liveItems.find(i => i.partNumber === partNum) || { partDesc: partNum, defaultPrice: 0 };
      const hargaSatuan = parseDecimalInput(rawHarga, itemMeta.defaultPrice || 0);

      itemsPayload.push({
        partNumber: partNum,
        partDescription: itemMeta.partDesc,
        qty: qty,
        hargaSatuan: hargaSatuan
      });
    }

    const payload = {
      site: currentSite,
      tanggal: tanggal,
      noDokumen: noDok,
      codeSupplier: suppCode,
      supplierDescription: suppName,
      targetStorage: storageId,
      items: itemsPayload
    };
    res = await callBackend('SUBMIT_PART_IN', payload);
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> <span id="lblBtnSubmitIn">Submit Inbound Receiving</span>';

  if (res.success) {
    document.getElementById('inNoDok').value = '';
    document.getElementById('inQty').value = '';
    document.getElementById('inHarga').value = '';
    document.getElementById('lookupSJInput').value = '';
    document.getElementById('inboundCartContainer')?.classList.add('hidden');
    document.getElementById('lblSJLookupStatus')?.classList.add('hidden');
    inboundSJMatchedItems = [];
    clearVendorInCart();
    clearPartInSelection();

    fetchRecentPartIn();
    fetchAllTankStocks();
    checkPendingInboundTransfers(false);

    showModalAlert("Inbound Recorded", res.message, true);
  } else {
    showModalAlert("Inbound Rejected", res.message);
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
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">No inbound transactions found for current period.</td></tr>';
    return;
  }
  data.forEach(row => {
    const qtyNum = Math.round(Number(row.qty) || 0);
    const priceNum = Number(row.hargaSatuan) || 0;
    tbody.innerHTML += `
      <tr class="hover:bg-blue-50/40 transition-colors font-medium text-slate-700">
        <td class="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">${row.tanggal}</td>
        <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-800 font-mono">${row.noDokumen}</td>
        <td class="py-2.5 px-3 font-semibold text-slate-700 truncate max-w-[180px]">${row.supplier}</td>
        <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-800">${row.targetStorage}</td>
        <td class="py-2.5 px-3">
          <div class="font-bold text-slate-900 leading-tight font-mono">${row.partNumber}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[240px] leading-tight">${row.partDescription}</div>
        </td>
        <td class="py-2.5 px-3 text-right whitespace-nowrap">
          <div class="font-black font-mono text-blue-700">${qtyNum.toLocaleString('id-ID')} L</div>
          <div class="text-[10px] text-slate-400 font-mono">@IDR ${priceNum.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </td>
      </tr>
    `;
  });
}

function filterRecentInTable() {
  const q = (document.getElementById('searchFilterIn')?.value || '').trim().toLowerCase();
  const storage = (document.getElementById('storageFilterIn')?.value || '').trim().toLowerCase();
  const src = (document.getElementById('sourceFilterIn')?.value || '').trim().toUpperCase();

  const filtered = rawRecentInData.filter(row => {
    const suppStr = String(row.supplier || '').toUpperCase();
    const isTransfer = suppStr.includes('TRANSFER');
    const matchSrc = !src || (src === 'TRANSFER' && isTransfer) || (src === 'VENDOR' && !isTransfer);
    const matchStorage = !storage || String(row.targetStorage || '').toLowerCase() === storage;
    const matchText = !q || `${row.noDokumen} ${row.supplier} ${row.targetStorage} ${row.partNumber} ${row.partDescription} ${row.tanggal}`.toLowerCase().includes(q);
    return matchSrc && matchStorage && matchText;
  });
  renderRecentInRows(filtered);
}

// ==========================================
// 3. TAB 3: INTERNAL TRANSFER & DISPATCH
// ==========================================
function toggleTransferType(mode) {
  const pInternal = document.getElementById('panelTargetInternal');
  const pSite = document.getElementById('panelTargetSite');
  const pMR = document.getElementById('panelTrfMR');
  const pPetugas = document.getElementById('panelTrfPetugas');
  const pInterDetail = document.getElementById('panelInterSiteDetail');
  const badgeLock = document.getElementById('badgeTrfStoreLock');
  const btnLbl = document.getElementById('lblBtnSubmitTrf');
  const fromSel = document.getElementById('trfFromStorage');

  if (mode === 'INTER_SITE') {
    pInternal?.classList.add('hidden');
    pSite?.classList.remove('hidden');
    pMR?.classList.add('hidden');
    pPetugas?.classList.add('hidden');
    pInterDetail?.classList.remove('hidden');
    badgeLock?.classList.remove('hidden');

    // Kunci tangki asal ke Gudang Utama (Store)
    if (fromSel && liveStorages.length > 0) {
      const storeSt = liveStorages.find(s => String(s.type || '').toUpperCase().includes('STORE') || String(s.type || '').toUpperCase().includes('WAREHOUSE') || String(s.storageId || '').toUpperCase().includes('STORE'));
      if (storeSt) {
        fromSel.value = storeSt.storageId;
      }
    }
    if (btnLbl) btnLbl.innerText = "🚀 Dispatch Inter-Site Shipment";
    if (typeof handleToSiteChange === 'function') handleToSiteChange();
  } else {
    pInternal?.classList.remove('hidden');
    pSite?.classList.add('hidden');
    pMR?.classList.remove('hidden');
    pPetugas?.classList.remove('hidden');
    pInterDetail?.classList.add('hidden');
    badgeLock?.classList.add('hidden');
    document.getElementById('panelNonSystemSite')?.classList.add('hidden');
    if (btnLbl) btnLbl.innerText = "⚡ Execute Internal Tank Transfer";
  }

  updateTransferTargetOptions();
  triggerCheckTransferStock();
}

function updateTransferTargetOptions() {
  const fromVal = document.getElementById('trfFromStorage')?.value || '';
  const toSel = document.getElementById('trfToStorage');
  if (!toSel) return;

  const prevVal = toSel.value;
  toSel.innerHTML = '<option value="">-- Select Destination --</option>';
  (liveStorages || []).forEach(st => {
    if (!fromVal || String(st.storageId) !== String(fromVal)) {
      toSel.innerHTML += `<option value="${st.storageId}">${st.storageId} - ${st.storageName}</option>`;
    }
  });
  if (prevVal && prevVal !== fromVal) {
    toSel.value = prevVal;
  }
}

function handleTrfFromStorageChange() {
  updateTransferTargetOptions();
  triggerCheckTransferStock();
}

function addOliToTransferCart() {
  const fromSt = document.getElementById('trfFromStorage').value.trim();
  const partNum = document.getElementById('trfPart').value.trim();
  const qty = parseInt(document.getElementById('trfQty').value, 10) || 0;

  if (!fromSt) {
    showModalAlert("Missing Origin", "Please select Origin Storage first.");
    return;
  }
  if (!partNum) {
    showModalAlert("Missing Lubricant", "Please select Lubricant Item.");
    return;
  }
  if (qty <= 0) {
    showModalAlert("Invalid Quantity", "Transfer volume must be an integer greater than 0.");
    return;
  }

  const itemMeta = liveItems.find(i => i.partNumber === partNum) || { partDesc: partNum, defaultPrice: 0, satuan: 'LTR' };
  const isKg = String(itemMeta.satuan || '').trim().toUpperCase().startsWith('KG');

  transferCart.push({
    fromStorage: fromSt,
    partNumber: partNum,
    partDescription: itemMeta.partDesc,
    qty: qty,
    price: itemMeta.defaultPrice || 0,
    satuan: isKg ? 'Kg' : 'L'
  });

  renderTransferCart();
  document.getElementById('trfQty').value = '';
  clearTrfPartSelection(true);
}

function renderTransferCart() {
  const container = document.getElementById('trfCartContainer');
  const listEl = document.getElementById('trfCartList');
  const countEl = document.getElementById('trfCartCount');

  if (transferCart.length === 0) {
    container?.classList.add('hidden');
    return;
  }

  container?.classList.remove('hidden');
  if (countEl) countEl.innerText = transferCart.length;

  if (listEl) {
    listEl.innerHTML = transferCart.map((it, idx) => `
      <div class="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-xs">
        <div class="truncate pr-2">
          <span class="font-bold text-slate-900 font-mono">${it.partNumber}</span>
          <span class="font-black text-amber-700 font-mono ml-1.5">${it.qty.toLocaleString('en-US')} ${it.satuan || 'L'}</span>
          <span class="text-[10px] text-slate-400 block">${it.partDescription}</span>
        </div>
        <button type="button" onclick="removeTransferCartItem(${idx})" class="text-rose-500 hover:text-rose-700 p-1">
          <i class="fa-solid fa-trash-can text-[11px]"></i>
        </button>
      </div>
    `).join('');
  }
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
  const fromSt = document.getElementById('trfFromStorage').value.trim();
  const tanggal = document.getElementById('trfDate').value.trim();

  if (!fromSt) { showModalAlert("Required Field", "Please select Origin Storage."); return; }
  if (!tanggal) { showModalAlert("Required Field", "Please select Transfer Date."); return; }

  let itemsList = [];
  if (transferCart.length > 0) {
    itemsList = transferCart;
  } else {
    const partNum = document.getElementById('trfPart').value.trim();
    const qty = parseInt(document.getElementById('trfQty').value, 10) || 0;
    if (!partNum || qty <= 0) {
      showModalAlert("Incomplete Item", "Please select Lubricant Item and enter a valid volume (> 0).");
      return;
    }
    const itemMeta = liveItems.find(i => i.partNumber === partNum) || { partDesc: partNum, defaultPrice: 0, satuan: 'LTR' };
    itemsList.push({
      fromStorage: fromSt,
      partNumber: partNum,
      partDescription: itemMeta.partDesc,
      qty: qty,
      price: itemMeta.defaultPrice || 0,
      satuan: itemMeta.satuan || 'LTR'
    });
  }

  const btn = document.getElementById('btnSubmitTrf');
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Transfer...';

  let res;
  if (mode === 'INTER_SITE') {
    const toSiteRaw = document.getElementById('trfToSite').value.trim();
    const noSJ = document.getElementById('trfNoSJ').value.trim();
    const driver = document.getElementById('trfDriver').value.trim();
    const isNonSystem = (toSiteRaw === 'NON_SYSTEM');
    const customName = document.getElementById('trfNonSystemName')?.value.trim() || '';

    if (!toSiteRaw) {
      showModalAlert("Required Field", "Please select Destination Project Site.");
      btn.disabled = false; btn.innerHTML = origHtml; return;
    }
    if (isNonSystem && !customName) {
      showModalAlert("Required Field", "Please enter External Contractor / Project Name.");
      btn.disabled = false; btn.innerHTML = origHtml; return;
    }
    if (!noSJ || !driver) {
      showModalAlert("Required Field", "Waybill (SJ) Number and Transporter / Plate Number are required.");
      btn.disabled = false; btn.innerHTML = origHtml; return;
    }

    const payload = {
      site: currentSite,
      toSite: isNonSystem ? customName.toUpperCase() : toSiteRaw,
      isNonSystem: isNonSystem,
      tanggal: tanggal,
      noSJ: noSJ,
      driver: driver,
      createdBy: currentUser || 'ADMIN',
      items: itemsList
    };
    res = await callBackend('SUBMIT_TRANSFER_BATCH', payload);
  } else {
    const toSt = document.getElementById('trfToStorage').value.trim();
    const noMR = document.getElementById('trfMRNo').value.trim();
    const petugas = document.getElementById('trfPetugas').value.trim();

    if (!toSt) {
      showModalAlert("Required Field", "Please select Destination Storage.");
      btn.disabled = false; btn.innerHTML = origHtml; return;
    }
    if (fromSt === toSt) {
      showModalAlert("Invalid Route", "Origin and Destination storage cannot be identical.");
      btn.disabled = false; btn.innerHTML = origHtml; return;
    }
    if (!noMR || !petugas) {
      showModalAlert("Required Field", "Material Request (MR) No. and Dispense Operator Name are mandatory.");
      btn.disabled = false; btn.innerHTML = origHtml; return;
    }

    const payload = {
      site: currentSite,
      transferType: 'INTERNAL',
      tanggal: tanggal,
      fromStorage: fromSt,
      toStorage: toSt,
      noMR: noMR,
      petugas: petugas,
      createdBy: currentUser || 'ADMIN',
      items: itemsList
    };
    res = await callBackend('SUBMIT_TRANSFER_LOCAL', payload);
  }

  btn.disabled = false;
  btn.innerHTML = origHtml;

  if (res.success) {
    document.getElementById('trfQty').value = '';
    document.getElementById('trfMRNo').value = '';
    document.getElementById('trfPetugas').value = '';
    document.getElementById('trfDriver').value = '';
    clearTransferCart();
    clearTrfPartSelection(false);
    if (typeof generateAutoSJNumber === 'function') generateAutoSJNumber();

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
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Failed to load transfer log.</td></tr>';
  }
}

function renderRecentMutasiRows(data) {
  const tbody = document.getElementById('tableRecentMutasi');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">No transfer records found for current period.</td></tr>';
    return;
  }
  data.forEach(row => {
    const isInter = String(row.issuedFor || '').toUpperCase().includes('TRANSFER');
    tbody.innerHTML += `
      <tr class="hover:bg-amber-50/40 transition-colors font-medium text-slate-700">
        <td class="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">${row.tanggal}</td>
        <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-800">
          <span>${row.sourceStorage}</span>
          <i class="fa-solid fa-arrow-right text-[10px] text-amber-600 mx-1"></i>
          <span class="${isInter ? 'text-blue-700' : 'text-amber-800'}">${row.unitTarget}</span>
        </td>
        <td class="py-2.5 px-3">
          <div class="font-bold text-slate-900 leading-tight font-mono">${row.partNumber}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[200px] leading-tight">${row.partDescription}</div>
        </td>
        <td class="py-2.5 px-3 text-right font-black font-mono text-amber-700 whitespace-nowrap">${Math.round(Number(row.qty)).toLocaleString('en-US')}</td>
        <td class="py-2.5 px-3 text-[11px] text-slate-600 max-w-[250px] truncate" title="${row.keterangan || ''}">${row.keterangan || '-'}</td>
      </tr>
    `;
  });
}

function filterRecentMutasiTable() {
  const q = (document.getElementById('searchFilterMutasi')?.value || '').trim().toLowerCase();
  const tp = (document.getElementById('typeFilterMutasi')?.value || '').trim().toUpperCase();

  const filtered = rawRecentMutasiData.filter(row => {
    const iss = String(row.issuedFor || '').toUpperCase();
    const matchType = !tp || (tp === 'TRANSFER_SITE' && iss.includes('TRANSFER')) || (tp === 'MUTASI' && !iss.includes('TRANSFER'));
    const matchText = !q || `${row.sourceStorage} ${row.unitTarget} ${row.partNumber} ${row.partDescription} ${row.keterangan || ''} ${row.tanggal}`.toLowerCase().includes(q);
    return matchType && matchText;
  });
  renderRecentMutasiRows(filtered);
}

// ==========================================
// 4. TAB 5: RETURN & REVERSAL ORDER
// ==========================================
function toggleReturnType(mode) {
  const pFleet = document.getElementById('panelReturnFleet');
  const pVendor = document.getElementById('panelReturnVendor');
  const pVendorPrice = document.getElementById('panelVendorPriceQty');
  const pFleetQty = document.getElementById('panelFleetQtyPetugas');
  const bannerTxt = document.getElementById('bannerReturnModeTxt');
  const lblStorage = document.getElementById('lblRetStorage');
  const btnLbl = document.getElementById('lblBtnSubmitReturn');
  const retPetugasEl = document.getElementById('retPetugas');

  if (mode === 'VENDOR') {
    pFleet?.classList.add('hidden');
    pVendor?.classList.remove('hidden');
    pVendorPrice?.classList.remove('hidden');
    pFleetQty?.classList.add('hidden');
    if (retPetugasEl) retPetugasEl.required = false;

    if (lblStorage) lblStorage.innerHTML = 'Source Storage (Stock Deducted) <span class="text-rose-500">*</span>';
    if (bannerTxt) {
      bannerTxt.innerHTML = '<b>Vendor Inbound Reversal:</b> Returning defective/excess drums to supplier. Storage stock will be <b>deducted</b> (anti-minus validated).';
    }
    if (btnLbl) btnLbl.innerText = '↩️ Commit Vendor DO Inbound Reversal';
  } else {
    pFleet?.classList.remove('hidden');
    pVendor?.classList.add('hidden');
    pVendorPrice?.classList.add('hidden');
    pFleetQty?.classList.remove('hidden');
    if (retPetugasEl) retPetugasEl.required = true;

    if (lblStorage) lblStorage.innerHTML = 'Receiving Storage (Target Tank) <span class="text-rose-500">*</span>';
    if (bannerTxt) {
      bannerTxt.innerHTML = '<b>Fleet Dispense Reversal:</b> Returning lubricant to tank from heavy equipment. Storage stock will <b>increase</b> and fleet consumption will be <b>deducted</b>.';
    }
    if (btnLbl) btnLbl.innerText = '↩️ Commit Fleet Dispense Reversal';
  }
}

async function submitReturnData() {
  const mode = document.querySelector('input[name="retTypeOption"]:checked')?.value || 'FLEET';
  const tanggal = document.getElementById('retDate').value.trim();
  const storageId = document.getElementById('retStorage').value.trim();
  const partNum = document.getElementById('retPart').value.trim();
  const alasan = document.getElementById('retAlasan').value.trim();

  if (!tanggal) { showModalAlert("Required Field", "Please select Return Date."); return; }
  if (!storageId) { showModalAlert("Required Field", "Please select Storage / Tank."); return; }
  if (!partNum) { showModalAlert("Required Field", "Please select Lubricant Item."); return; }
  if (!alasan || alasan.length < 5) {
    showModalAlert("Mandatory Reason", "Please enter a clear correction reason (minimum 5 characters).");
    return;
  }

  const itemMeta = liveItems.find(i => i.partNumber === partNum) || { partDesc: partNum, defaultPrice: 0 };
  const btn = document.getElementById('btnSubmitReturn');
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Committing Reversal...';

  let res;
  if (mode === 'VENDOR') {
    const noDok = document.getElementById('retNoDok').value.trim();
    const suppCode = document.getElementById('retSupplierCode').value.trim();
    const suppName = document.getElementById('retSupplierName').value.trim();
    const qty = parseInt(document.getElementById('retVendorQty').value, 10) || 0;
    const rawHarga = document.getElementById('retHarga').value.trim();
    const hargaSatuan = parseDecimalInput(rawHarga, itemMeta.defaultPrice || 0);

    if (!noDok || !suppName) {
      showModalAlert("Required Field", "Reference DO / Waybill No. and Supplier Origin are required.");
      btn.disabled = false; btn.innerHTML = origHtml; return;
    }
    if (qty <= 0) {
      showModalAlert("Invalid Volume", "Return volume must be an integer greater than 0 L.");
      btn.disabled = false; btn.innerHTML = origHtml; return;
    }

    const payload = {
      site: currentSite,
      tanggal: tanggal,
      sourceStorage: storageId,
      noDokumen: noDok,
      codeSupplier: suppCode || 'VENDOR',
      supplierDescription: suppName,
      partNumber: partNum,
      partDescription: itemMeta.partDesc,
      qty: qty,
      hargaSatuan: hargaSatuan,
      alasan: alasan
    };
    res = await callBackend('SUBMIT_RETURN_IN', payload);
  } else {
    const unitId = document.getElementById('retUnit').value.trim();
    const hm = document.getElementById('retHM').value.trim();
    const qty = parseInt(document.getElementById('retQty').value, 10) || 0;
    const petugas = document.getElementById('retPetugas').value.trim();
    const chargeSite = document.getElementById('retChargeSite')?.value.trim() || currentSite;

    if (!unitId) {
      showModalAlert("Required Field", "Please select Fleet Equipment ID.");
      btn.disabled = false; btn.innerHTML = origHtml; return;
    }
    if (qty <= 0) {
      showModalAlert("Invalid Volume", "Return volume must be an integer greater than 0 L.");
      btn.disabled = false; btn.innerHTML = origHtml; return;
    }
    if (!petugas) {
      showModalAlert("Required Field", "Executor / Technician name is mandatory.");
      btn.disabled = false; btn.innerHTML = origHtml; return;
    }

    const unitMeta = liveUnits.find(u => u.unitId === unitId) || { desc: '-', model: '-' };
    const payload = {
      site: currentSite,
      tanggal: tanggal,
      targetStorage: storageId,
      unitId: unitId,
      unitDescription: unitMeta.desc,
      model: unitMeta.model,
      hm: hm || '-',
      partNumber: partNum,
      partDescription: itemMeta.partDesc,
      qty: qty,
      price: itemMeta.defaultPrice || 0,
      chargeSite: (chargeSite && chargeSite !== '-') ? chargeSite : currentSite,
      petugas: petugas,
      alasan: alasan,
      createdBy: currentUser || 'ADMIN'
    };
    res = await callBackend('SUBMIT_RETURN_OUT', payload);
  }

  btn.disabled = false;
  btn.innerHTML = origHtml;

  if (res.success) {
    document.getElementById('retQty').value = '';
    document.getElementById('retVendorQty').value = '';
    document.getElementById('retNoDok').value = '';
    document.getElementById('retAlasan').value = '';
    clearRetPartSelection();
    clearRetUnitSelection();
    clearRetSupplierSelection();

    fetchRecentReturns();
    fetchRecentPartOut();
    fetchRecentPartIn();
    fetchAllTankStocks();
    fetchExecutiveKPI();

    showModalAlert("Reversal Committed", res.message, true);
  } else {
    showModalAlert("Reversal Rejected", res.message);
  }
}

async function fetchRecentReturns() {
  const tbody = document.getElementById('tableRecentReturns');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading reversal log...</td></tr>';
  const res = await callBackend('GET_RECENT_RETURNS', { site: currentSite });
  if (res.success && res.data) {
    rawRecentReturnData = res.data;
    renderRecentReturnRows(rawRecentReturnData);
  } else {
    tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400">Failed to load reversal records.</td></tr>';
  }
}

function renderRecentReturnRows(data) {
  const tbody = document.getElementById('tableRecentReturns');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400">No return or reversal records found for current period.</td></tr>';
    return;
  }
  data.forEach(row => {
    const isFleet = row.category === 'FLEET_RETURN';
    tbody.innerHTML += `
      <tr class="hover:bg-teal-50/40 transition-colors font-medium text-slate-700">
        <td class="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">${row.tanggal}</td>
        <td class="py-2.5 px-3 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-md text-[9px] font-extrabold ${isFleet ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'}">
            ${isFleet ? 'FLEET RETURN' : 'VENDOR RETUR'}
          </span>
        </td>
        <td class="py-2.5 px-3 whitespace-nowrap font-bold font-mono text-slate-800">${row.refId || '-'}</td>
        <td class="py-2.5 px-3 whitespace-nowrap font-bold text-slate-700">${row.storage || '-'}</td>
        <td class="py-2.5 px-3">
          <div class="font-bold text-slate-900 leading-tight font-mono">${row.partNumber}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[180px] leading-tight">${row.partDescription}</div>
        </td>
        <td class="py-2.5 px-3 text-right font-black font-mono text-teal-700 whitespace-nowrap">${Math.round(Number(row.qty)).toLocaleString('en-US')} L</td>
        <td class="py-2.5 px-3 text-[11px] text-slate-600 max-w-[230px] truncate" title="${row.keterangan || ''}">${row.keterangan || '-'}</td>
      </tr>
    `;
  });
}

function filterRecentReturnTable() {
  const q = (document.getElementById('searchFilterReturn')?.value || '').trim().toLowerCase();
  const cat = (document.getElementById('typeFilterReturn')?.value || '').trim().toUpperCase();

  const filtered = rawRecentReturnData.filter(row => {
    const matchCat = !cat || String(row.category || '').toUpperCase() === cat;
    const matchText = !q || `${row.refId} ${row.storage} ${row.partNumber} ${row.partDescription} ${row.keterangan || ''} ${row.tanggal}`.toLowerCase().includes(q);
    return matchCat && matchText;
  });
  renderRecentReturnRows(filtered);
}
