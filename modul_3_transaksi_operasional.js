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
// 2. TAB 2: INBOUND RECEIVING (LOG IN)
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
        document.getElementById('inHarga').value = Number(first.price).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }

      const cartCont = document.getElementById('inboundCartContainer');
      const listEl = document.getElementById('inboundCartList');
      if (document.getElementById('inboundCartCount')) document.getElementById('inboundCartCount').innerText = inboundSJMatchedItems.length;
      cartCont?.classList.remove('hidden');

      if (listEl) {
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
      }

      if (statusLbl) statusLbl.innerText = `✓ Found ${inboundSJMatchedItems.length} cargo items for Waybill ${first.noSJ}`;
    } else {
      if (statusLbl) statusLbl.innerText = "⚠️ " + (res.message || "Waybill not found in active dispatch registry.");
      showModalAlert("Waybill Not Found", res.message || "Waybill not found or already verified.");
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
  const isTransferMode = document.querySelector('input[name="inSourceType"]:checked')?.value === 'TRANSFER_SJ';
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
    document.getElementById('lblSJLookupStatus')?.classList.add('hidden');
    document.getElementById('inboundCartContainer')?.classList.add('hidden');
    inboundSJMatchedItems = [];
    clearVendorInCart();
    clearPartInSelection();
    clearSupplierSelection();
    fetchRecentPartIn();
    fetchAllTankStocks();
    checkPendingInboundTransfers();

    showModalAlert("Inbound Logged", res.message, true, () => {
      setTimeout(() => { document.getElementById('supplierSearchInput')?.focus(); }, 50);
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
// 3. TAB 3: INTERNAL TRANSFER & DISPATCH
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
    pMR?.classList.add('hidden');
    pPetugas?.classList.add('hidden');
    pInt?.classList.add('hidden');
    pSite?.classList.remove('hidden');
    pInter?.classList.remove('hidden');
    if (mrInput) mrInput.required = false;
    if (petugasInput) petugasInput.required = false;
    if (toStInput) toStInput.required = false;
    badgeStore?.classList.remove('hidden');
    lockTransferFromStorageToStore(true);
    handleToSiteChange();
  } else {
    pMR?.classList.remove('hidden');
    pPetugas?.classList.remove('hidden');
    pInt?.classList.remove('hidden');
    pSite?.classList.add('hidden');
    pInter?.classList.add('hidden');
    pNon?.classList.add('hidden');
    if (mrInput) mrInput.required = true;
    if (petugasInput) petugasInput.required = true;
    if (toStInput) toStInput.required = true;
    badgeStore?.classList.add('hidden');
    lockTransferFromStorageToStore(false);
    if (btnLbl) btnLbl.innerText = "⚡ Execute Internal Tank Transfer";
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
  if (qty <= 0) { showModalAlert("Invalid Volume", "Transfer quantity must be an integer greater than 0."); return; }

  const itemMeta = liveItems.find(i => i.partNumber === partNum) || { partDesc: partNum, defaultPrice: 0, satuan: 'LTR' };
  transferCart.push({
    fromStorage: fromSt,
    partNumber: partNum,
    partDescription: itemMeta.partDesc,
    qty: qty,
    price: itemMeta.defaultPrice || 0,
    satuan: itemMeta.satuan || 'LTR'
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
    container?.classList.add('hidden');
    return;
  }

  container?.classList.remove('hidden');
  if (countEl) countEl.innerText = transferCart.length;

  if (listEl) {
    listEl.innerHTML = transferCart.map((item, idx) => {
      const rawSatuan = String(item.satuan || 'LTR').trim().toUpperCase();
      const unitBadge = (rawSatuan === 'KG' || rawSatuan === 'KGM') ? 'Kg' : 'L';

      return `
        <div class="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-xs">
          <div class="truncate pr-2">
            <span class="font-bold text-slate-800 font-mono">${item.partNumber}</span>
            <span class="text-amber-700 font-black font-mono ml-1.5">${item.qty.toLocaleString('en-US')} ${unitBadge}</span>
            <span class="text-[10px] text-slate-400 block">${item.partDescription} (From ${item.fromStorage})</span>
          </div>
          <button type="button" onclick="removeTransferCartItem(${idx})" class="text-rose-500 hover:text-rose-700 p-1">
            <i class="fa-solid fa-trash-can text-[11px]"></i>
          </button>
        </div>
      `;
    }).join('');
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
  const isInterSite = document.querySelector('input[name="trfTypeOption"]:checked')?.value === 'INTER_SITE';
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
// 4. TAB 4: RETURN & REVERSAL MANAGEMENT
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