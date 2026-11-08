/**
 * ============================================================================
 * MODUL 5: MONITORING, EXPORT CSV & MODALS (05_reports_export.js)
 * LOG DISPENSE MANAGEMENT SYSTEM v3.5 ENTERPRISE
 * PT.KTC Coal Mining & Energy
 * Architect & Lead Engineer: Adi Pranata
 * ============================================================================
 */

// ==========================================
// 1. INBOUND REAL-TIME MONITORING
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
// 2. STORAGE & LUBE TRUCK MONITORING (TAB 0)
// ==========================================
async function fetchAllTankStocks() {
  const container = document.getElementById('tankCardsContainer');
  if (!container) return;

  const btn = document.getElementById('btnRefreshTanks');
  let origBtnHtml = '';
  if (btn) {
    origBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i><span>Syncing...</span>';
    btn.classList.add('opacity-70', 'cursor-not-allowed');
  }

  container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-400"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Synchronizing storage balances...</div>';

  try {
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

        // Membaca kapasitas spesifik dari master m_storages (Kolom E), fallback jika kosong
        const defaultCap = (tank.type === 'LUBE_TRUCK') ? 8000 : 30000;
        const refCap = (tank.capacity && Number(tank.capacity) > 0) ? Number(tank.capacity) : defaultCap;
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
                <span class="font-mono font-bold text-slate-700">${totalQtyInTank.toLocaleString('en-US')} L / ${refCap.toLocaleString('en-US')} L (${pct}%)</span>
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
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnHtml;
      btn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
  }
}

// ==========================================
// 3. EXPORT CSV DIALOG (CLEAN NUMERIC LOGIC)
// ==========================================
function downloadCSV(reportType) {
  activeExportType = reportType;
  const modal = document.getElementById('modalExportCSV');
  const title = document.getElementById('lblExportTitle');
  const notice = document.getElementById('lblExportNotice');
  const isSuper = (currentRole === 'SUPERADMIN');

  if (reportType === 'OUT') {
    if (title) title.innerText = "Export Dispense Log (Part Out)";
    if (notice) notice.innerText = "CSV format is structured for Microsoft Excel (semicolon delimited & UTF-8 with BOM).";
  } else if (reportType === 'IN') {
    if (title) title.innerText = "Export Inbound Receiving Log (Part In)";
    if (notice) notice.innerText = "CSV format is structured for Microsoft Excel (semicolon delimited & UTF-8 with BOM).";
  } else if (reportType === 'MUTASI') {
    if (title) title.innerText = "Export Transfer & Dispatch Log";
    if (notice) notice.innerText = "CSV export contains all internal tank movements and cross-site shipments.";
  } else if (reportType === 'RETURN') {
    if (title) title.innerText = "Export Return & Reversal Audit Log";
    if (notice) notice.innerText = "Chronological audit trail of all fleet reversals and vendor returns.";
  } else {
    if (title) title.innerText = "Export Stock Balance Reconciliation";
    if (isSuper) {
      if (notice) notice.innerText = "Superadmin Mode: You may export records under either DRAFT or FINAL_LOCKED status.";
    } else {
      if (notice) notice.innerText = "Notice: Site Administrators may only export reconciliation reports that have been finalized (FINAL_LOCKED).";
    }
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const balM = document.getElementById('balMonth') ? document.getElementById('balMonth').value : monthNames[now.getMonth()];
  const balY = document.getElementById('balYear') ? document.getElementById('balYear').value : now.getFullYear();

  if (document.getElementById('exportMonth')) document.getElementById('exportMonth').value = balM || monthNames[now.getMonth()];
  if (document.getElementById('exportYear')) document.getElementById('exportYear').value = balY || now.getFullYear();
  if (document.getElementById('exportStartDate')) document.getElementById('exportStartDate').value = todayStr;
  if (document.getElementById('exportEndDate')) document.getElementById('exportEndDate').value = todayStr;

  toggleExportMode('MONTH');
  modal?.classList.remove('hidden');
}

function closeExportModal() {
  document.getElementById('modalExportCSV')?.classList.add('hidden');
}

function toggleExportMode(mode) {
  const pMonth = document.getElementById('exportPanelMonth');
  const pRange = document.getElementById('exportPanelRange');
  if (mode === 'MONTH') {
    pMonth?.classList.remove('hidden');
    pRange?.classList.add('hidden');
  } else {
    pMonth?.classList.add('hidden');
    pRange?.classList.remove('hidden');
  }
}

async function executeDownloadCSV() {
  const btn = document.getElementById('btnExecuteDownloadCSV');
  const mode = document.querySelector('input[name="exportMode"]:checked')?.value || 'MONTH';
  const reportType = activeExportType;

  const payload = { 
    site: currentSite, 
    reportType: reportType, 
    mode: mode,
    role: currentRole || 'ADMIN'
  };

  if (mode === 'MONTH') {
    payload.month = document.getElementById('exportMonth')?.value;
    payload.year = document.getElementById('exportYear')?.value;
  } else {
    payload.startDate = document.getElementById('exportStartDate')?.value;
    payload.endDate = document.getElementById('exportEndDate')?.value;
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

    // Hilangkan kolom "No" (Index 0) pada CSV hasil download
    if (exportHeaders.length > 0 && String(exportHeaders[0]).trim().toLowerCase() === 'no') {
      exportHeaders = exportHeaders.slice(1);
      exportRows = exportRows.map(row => row.slice(1));
    }
  }

  // UTF-8 with BOM untuk kompatibilitas Microsoft Excel Indonesia
  let csvContent = "\uFEFF";
  csvContent += exportHeaders.map(h => `"${h}"`).join(";") + "\r\n";

  exportRows.forEach(row => {
    const formattedCells = row.map(val => {
      if (val === null || val === undefined) return '""';

      // 1. Jika tipe data berupa Angka Numerik
      if (typeof val === 'number') {
        // Jika angka bulat atau ekor desimal floating point js (misal .99999999)
        if (Math.abs(val - Math.round(val)) < 0.00001) {
          return String(Math.round(val)); // Tulis angka murni tanpa petik ganda
        }
        // Jika angka pecahan asli: ubah titik desimal jadi koma khas Excel Indonesia
        return String(Number(val.toFixed(2))).replace('.', ',');
      }

      // 2. Jika tipe data string namun murni angka
      const strVal = String(val).trim();
      if (!isNaN(strVal) && strVal !== '') {
        const numVal = parseFloat(strVal);
        if (Math.abs(numVal - Math.round(numVal)) < 0.00001) {
          return String(Math.round(numVal));
        }
        return String(Number(numVal.toFixed(2))).replace('.', ',');
      }

      // 3. Teks string umum dibungkus petik ganda
      return `"${strVal.replace(/"/g, '""')}"`;
    });

    csvContent += formattedCells.join(";") + "\r\n";
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
// 4. SYSTEM MODAL NOTIFICATIONS
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
  box?.classList.remove('hidden');
  setTimeout(() => { if (btn) btn.focus(); }, 50);
}

function closeModalAlert() {
  document.getElementById('modalAlertBox')?.classList.add('hidden');
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
// 5. SYSTEM REFRESH & CACHE SYNC
// ==========================================
async function refreshSystemData(isUserClick = false) {
  const btn = document.getElementById('btnSystemRefresh');
  const icon = btn ? btn.querySelector('i') : null;
  if (icon) icon.classList.add('fa-spin', 'text-amber-400');
  if (btn) btn.disabled = true;

  try {
    await fetchInitialMasterData();
    initAppDashboard();
    if (isUserClick) {
      showModalAlert(
        "System Refreshed",
        "✓ Master repository (Units, Items, Suppliers, Storages) and real-time tank balances have been successfully re-synchronized.\n\nTip: If you recently committed code updates to GitHub, press Ctrl + F5 for a complete browser cache reload.",
        true
      );
    }
  } catch (err) {
    if (isUserClick) {
      showModalAlert("Refresh Error", "Failed to re-sync data: " + err.message);
    }
  } finally {
    if (icon) icon.classList.remove('fa-spin', 'text-amber-400');
    if (btn) btn.disabled = false;
  }
}
