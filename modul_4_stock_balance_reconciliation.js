/**
 * ============================================================================
 * MODUL 4: STOCK BALANCE & RECONCILIATION (04_stock_balance.js)
 * LOG DISPENSE MANAGEMENT SYSTEM v3.5 ENTERPRISE
 * PT.KTC Coal Mining & Energy
 * Architect & Lead Engineer: Adi Pranata
 * ============================================================================
 */

// ==========================================
// 1. MONTH DICTIONARY & DATE CUTOFF ENGINE
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

// ==========================================
// 2. STOCK BALANCE PREVIEW & SOUNDING
// ==========================================
async function fetchStockBalancePreview() {
  updateNextPeriodLabel();
  const month = document.getElementById('balMonth').value;
  const year = document.getElementById('balYear').value;
  const storageId = document.getElementById('balStorage').value;
  const tbody = document.getElementById('tableBalanceBody');

  const btn = document.getElementById('btnCalcBalance');
  let origBtnHtml = '';
  if (btn) {
    origBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Calculating...</span>';
    btn.classList.add('opacity-70', 'cursor-not-allowed');
  }

  tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Calculating inventory reconciliation...</td></tr>';

  try {
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
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-rose-500 font-bold">Communication Error: ${err.message}</td></tr>`;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnHtml;
      btn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
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

    // Kunci: Bila isLockFinal false (klik draft), role dikirim 'ADMIN' agar backend TIDAK mengunci jadi FINAL_LOCKED
    const effectiveRole = isLockFinal ? 'SUPERADMIN' : 'ADMIN';

    const payload = {
      site: currentSite,
      month: month,
      year: year,
      role: effectiveRole,
      isLockFinal: isLockFinal,
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
// 3. HYBRID AUTO-ADJUST REVIEW (SUPERADMIN)
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
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Calculating allocation vectors...</td></tr>';
  modal?.classList.remove('hidden');

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
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-rose-500 font-bold">${res.message || 'Failed to load allocation preview.'}</td></tr>`;
  }
}

function renderHybridAdjustModal(data) {
  const tbody = document.getElementById('tableModalAdjustBody');
  const boxWarn = document.getElementById('boxWarningSmallPool');
  const residualLbl = document.getElementById('lblModalAdjustResidual');
  const dirBox = document.getElementById('lblModalAdjustDirection');
  const dirTxt = document.getElementById('lblModalAdjustDirectionTxt');

  if (data.isSmallPool) {
    boxWarn?.classList.remove('hidden');
  } else {
    boxWarn?.classList.add('hidden');
  }

  if (data.isSurplus) {
    if (dirBox) dirBox.className = "mb-3 p-2.5 rounded-xl text-[11px] font-semibold flex items-center gap-2 bg-blue-50 text-blue-900 border border-blue-200";
    if (dirTxt) dirTxt.innerHTML = "<b>Positive Physical Variance (+):</b> Outbound volumes below are <b>reduced</b> proportionally to align book balance with sounding.";
  } else {
    if (dirBox) dirBox.className = "mb-3 p-2.5 rounded-xl text-[11px] font-semibold flex items-center gap-2 bg-amber-50 text-amber-900 border border-amber-200";
    if (dirTxt) dirTxt.innerHTML = "<b>Negative Physical Variance (-):</b> Outbound volumes below are <b>augmented</b> proportionally to absorb variance into equipment operation.";
  }

  if (residualLbl) residualLbl.innerText = `${data.residualVariance} L`;

  if (!currentHybridAllocations || currentHybridAllocations.length === 0) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">No matching operational transactions found.</td></tr>';
    return;
  }

  if (tbody) {
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
  const resLbl = document.getElementById('lblModalAdjustResidual');
  if (resLbl) resLbl.innerText = `${residual} L`;
}

function closeHybridAdjustModal() {
  document.getElementById('modalHybridAdjust')?.classList.add('hidden');
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