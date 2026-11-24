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
