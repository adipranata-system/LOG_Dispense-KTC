/**
 * ============================================================================
 * MODUL 6: EXECUTIVE PDF REPORT & HYBRID AI ENGINE (06_executive_report.js)
 * LOG DISPENSE MANAGEMENT SYSTEM v3.5 ENTERPRISE
 * PT.KTC Coal Mining & Energy
 * Architect & Lead Engineer: Adi Pranata
 * ============================================================================
 */

// ==========================================
// 1. EXECUTIVE REPORT STATE
// ==========================================
let execReportData = null;
let execReportMode = 'MONTHLY'; // 'WEEKLY' | 'MONTHLY'
let execAnalysisEngine = 'Smart Rule Engine';

// ==========================================
// 2. INITIALIZATION & DATE RANGE HELPERS
// ==========================================
function initExecutiveReportTab() {
  if (currentRole !== 'SUPERADMIN') return;

  const fromEl = document.getElementById('execFromDate');
  const toEl = document.getElementById('execToDate');
  const monthEl = document.getElementById('execQuickMonth');

  if (fromEl && !fromEl.value) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    if (monthEl) monthEl.value = `${y}-${m}`;
    fromEl.value = `${y}-${m}-01`;
    toEl.value = `${y}-${m}-${d}`;
  }
}

function selectExecReportMode(mode) {
  execReportMode = mode;
  const cardW = document.getElementById('cardModeWeekly');
  const cardM = document.getElementById('cardModeMonthly');
  const badgeW = document.getElementById('badgeModeWeekly');
  const badgeM = document.getElementById('badgeModeMonthly');

  if (mode === 'WEEKLY') {
    if (cardW) cardW.className = "p-4 rounded-2xl border-2 border-blue-600 bg-blue-50/40 cursor-pointer transition-all shadow-sm";
    if (cardM) cardM.className = "p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 cursor-pointer transition-all";
    if (badgeW) {
      badgeW.className = "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white";
      badgeW.innerText = "Active • Tactical";
    }
    if (badgeM) {
      badgeM.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500";
      badgeM.innerText = "Comprehensive";
    }
    setExecQuickRange('LAST_7_DAYS');
  } else {
    if (cardM) cardM.className = "p-4 rounded-2xl border-2 border-blue-600 bg-blue-50/40 cursor-pointer transition-all shadow-sm";
    if (cardW) cardW.className = "p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 cursor-pointer transition-all";
    if (badgeM) {
      badgeM.className = "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white";
      badgeM.innerText = "Active • Full Audit";
    }
    if (badgeW) {
      badgeW.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500";
      badgeW.innerText = "Tactical Focus";
    }
    setExecQuickRange('MTD');
  }
}

function handleExecQuickMonthChange(ymVal) {
  if (!ymVal) return;
  const parts = ymVal.split('-');
  if (parts.length !== 2) return;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const lastDay = new Date(y, m, 0).getDate();

  const fromEl = document.getElementById('execFromDate');
  const toEl = document.getElementById('execToDate');
  if (fromEl) fromEl.value = `${y}-${String(m).padStart(2, '0')}-01`;
  if (toEl) toEl.value = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function setExecQuickRange(preset) {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  const localNow = new Date(now.getTime() - tzOffsetMs);
  const todayIso = localNow.toISOString().split('T')[0];

  const fromEl = document.getElementById('execFromDate');
  const toEl = document.getElementById('execToDate');
  const monthEl = document.getElementById('execQuickMonth');

  if (preset === 'LAST_7_DAYS') {
    const past = new Date(localNow.getTime() - (6 * 86400000));
    if (fromEl) fromEl.value = past.toISOString().split('T')[0];
    if (toEl) toEl.value = todayIso;
  } else if (preset === 'MTD') {
    const y = localNow.getUTCFullYear();
    const m = String(localNow.getUTCMonth() + 1).padStart(2, '0');
    if (monthEl) monthEl.value = `${y}-${m}`;
    if (fromEl) fromEl.value = `${y}-${m}-01`;
    if (toEl) toEl.value = todayIso;
  } else if (preset === 'FULL_LAST_MONTH') {
    let y = localNow.getUTCFullYear();
    let m = localNow.getUTCMonth(); // 0-indexed previous month
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    const lastDay = new Date(y, m, 0).getDate();
    const mStr = String(m).padStart(2, '0');
    if (monthEl) monthEl.value = `${y}-${mStr}`;
    if (fromEl) fromEl.value = `${y}-${mStr}-01`;
    if (toEl) toEl.value = `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`;
  }
}

// ==========================================
// 3. LOAD REPORT DATA FROM BACKEND
// ==========================================
async function loadExecutiveReportData() {
  if (currentRole !== 'SUPERADMIN') {
    showModalAlert("Access Denied", "Executive Report Generator is restricted to Superadmin.");
    return;
  }

  const fromDate = document.getElementById('execFromDate')?.value;
  const toDate = document.getElementById('execToDate')?.value;
  const modelFilter = document.getElementById('execModelFilter')?.value || 'ALL';

  if (!fromDate || !toDate) {
    showModalAlert("Required Field", "Please specify both From Date and To Date.");
    return;
  }

  const btnLoad = document.getElementById('btnLoadExecReport');
  const statusLbl = document.getElementById('lblExecReportStatus');
  const engineBadge = document.getElementById('lblAnalysisEngineBadge');
  let origBtnHtml = '';

  if (btnLoad) {
    origBtnHtml = btnLoad.innerHTML;
    btnLoad.disabled = true;
    btnLoad.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Loading Data...</span>';
    btnLoad.classList.add('opacity-70', 'cursor-not-allowed');
  }
  if (statusLbl) {
    statusLbl.className = "text-xs font-bold text-amber-700";
    statusLbl.innerText = "Aggregating multi-ledger logistics data...";
  }

  try {
    const res = await callBackend('GET_EXECUTIVE_REPORT_DATA', {
      site: currentSite,
      role: currentRole,
      reportMode: execReportMode,
      fromDate: fromDate,
      toDate: toDate,
      modelFilter: modelFilter
    });

    if (res.success && res.data) {
      execReportData = res.data;
      execAnalysisEngine = res.data.analysisEngine || 'Smart Rule Engine';

      // Populate dynamic model filter options
      populateExecModelOptions(res.data.availableModels || [], modelFilter);

      // Sync narrative textareas
      if (res.data.narratives) {
        if (document.getElementById('editNarrativeCh1')) document.getElementById('editNarrativeCh1').value = res.data.narratives.chapter1 || '';
        if (document.getElementById('editNarrativeCh2')) document.getElementById('editNarrativeCh2').value = res.data.narratives.chapter2 || '';
        if (document.getElementById('editNarrativeCh3')) document.getElementById('editNarrativeCh3').value = res.data.narratives.chapter3 || '';
        if (document.getElementById('editNarrativeCh4')) document.getElementById('editNarrativeCh4').value = res.data.narratives.chapter4 || '';
      }

      if (statusLbl) {
        statusLbl.className = "text-xs font-extrabold text-emerald-700";
        const modeLabel = execReportMode === 'WEEKLY' ? 'Weekly Operational Tactical' : 'Monthly Management Detail';
        statusLbl.innerText = `Report loaded (${modeLabel} • ${fromDate} to ${toDate}).`;
      }
      if (engineBadge) {
        engineBadge.innerText = `Analysis Engine: ${execAnalysisEngine}`;
        engineBadge.className = "px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700";
      }

      renderExecutiveReportPaper();
    } else {
      if (statusLbl) {
        statusLbl.className = "text-xs font-bold text-rose-600";
        statusLbl.innerText = res.message || "Failed to load executive report.";
      }
      showModalAlert("Report Generation Failed", res.message || "Unable to compile report data.");
    }
  } catch (err) {
    showModalAlert("Communication Error", err.message);
  } finally {
    if (btnLoad) {
      btnLoad.disabled = false;
      btnLoad.innerHTML = origBtnHtml;
      btnLoad.classList.remove('opacity-70', 'cursor-not-allowed');
    }
  }
}

function populateExecModelOptions(models, selectedVal) {
  const sel = document.getElementById('execModelFilter');
  if (!sel) return;
  let html = '<option value="ALL">All Unit Models</option>';
  models.forEach(m => {
    const isSel = (String(m).toUpperCase() === String(selectedVal).toUpperCase()) ? 'selected' : '';
    html += `<option value="${m}" ${isSel}>${m}</option>`;
  });
  sel.innerHTML = html;
}

// ==========================================
// 4. GEMINI AI NARRATIVE GENERATOR (HYBRID)
// ==========================================
async function triggerGeminiAiAnalysis() {
  if (currentRole !== 'SUPERADMIN') return;

  if (!execReportData) {
    await loadExecutiveReportData();
    if (!execReportData) return;
  }

  const btnAi = document.getElementById('btnGenerateAiReport');
  const statusLbl = document.getElementById('lblExecReportStatus');
  const engineBadge = document.getElementById('lblAnalysisEngineBadge');
  let origBtnHtml = '';

  if (btnAi) {
    origBtnHtml = btnAi.innerHTML;
    btnAi.disabled = true;
    btnAi.innerHTML = '<i class="fa-solid fa-sparkles fa-spin"></i><span>Synthesizing Gemini AI...</span>';
    btnAi.classList.add('opacity-75', 'cursor-not-allowed');
  }
  if (statusLbl) {
    statusLbl.className = "text-xs font-bold text-indigo-700";
    statusLbl.innerText = "Requesting executive commentary from Gemini AI...";
  }

  try {
    const res = await callBackend('GENERATE_AI_REPORT_NARRATIVE', {
      site: currentSite,
      role: currentRole,
      reportSummary: {
        meta: execReportData.meta,
        kpi: execReportData.kpi,
        modelBreakdown: execReportData.modelBreakdown,
        purposeBreakdown: execReportData.purposeBreakdown,
        topUnits: execReportData.topUnits,
        vendorSummary: execReportData.vendorSummary
      }
    });

    if (res.success && res.narratives) {
      execReportData.narratives = res.narratives;
      execAnalysisEngine = res.engine || 'Gemini AI Engine';

      if (document.getElementById('editNarrativeCh1')) document.getElementById('editNarrativeCh1').value = res.narratives.chapter1 || '';
      if (document.getElementById('editNarrativeCh2')) document.getElementById('editNarrativeCh2').value = res.narratives.chapter2 || '';
      if (document.getElementById('editNarrativeCh3')) document.getElementById('editNarrativeCh3').value = res.narratives.chapter3 || '';
      if (document.getElementById('editNarrativeCh4')) document.getElementById('editNarrativeCh4').value = res.narratives.chapter4 || '';

      if (engineBadge) {
        engineBadge.innerText = `Analysis Engine: ${execAnalysisEngine}`;
        if (!res.isFallback) {
          engineBadge.className = "px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] font-extrabold text-indigo-800";
        } else {
          engineBadge.className = "px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800";
        }
      }

      if (statusLbl) {
        statusLbl.className = "text-xs font-extrabold text-emerald-700";
        statusLbl.innerText = res.isFallback
          ? "Report updated using Smart Rule Engine fallback."
          : "✨ Gemini AI executive narratives synthesized and applied to all chapters.";
      }

      renderExecutiveReportPaper();
    } else {
      showModalAlert("AI Synthesis Notice", res.message || "Unable to reach AI service. Using standard rule engine.");
    }
  } catch (err) {
    showModalAlert("AI Service Error", err.message);
  } finally {
    if (btnAi) {
      btnAi.disabled = false;
      btnAi.innerHTML = origBtnHtml;
      btnAi.classList.remove('opacity-75', 'cursor-not-allowed');
    }
  }
}

function toggleCustomizeNarrativesPanel() {
  const panel = document.getElementById('panelCustomizeNarratives');
  if (panel) panel.classList.toggle('hidden');
}

function syncNarrativeEditsToPaper() {
  if (!execReportData) return;
  execReportData.narratives = {
    chapter1: document.getElementById('editNarrativeCh1')?.value || '',
    chapter2: document.getElementById('editNarrativeCh2')?.value || '',
    chapter3: document.getElementById('editNarrativeCh3')?.value || '',
    chapter4: document.getElementById('editNarrativeCh4')?.value || ''
  };
  renderExecutiveReportPaper();
}

// ==========================================
// 5. RENDER EXECUTIVE PAPER (MAKALAH A4 LANDSCAPE)
// ==========================================
function renderExecutiveReportPaper() {
  const container = document.getElementById('execReportPaperContainer');
  if (!container || !execReportData) return;

  const d = execReportData;
  const m = d.meta;
  const k = d.kpi;
  const nar = d.narratives || {};

  const includeDailyLedger = document.getElementById('chkIncludeDailyLedger')?.checked ?? true;
  const includeManualSign = document.getElementById('chkIncludeManualSign')?.checked ?? false;
  const specialNotes = (document.getElementById('execSpecialNotes')?.value || '').trim();

  const reportTitle = m.reportMode === 'WEEKLY'
    ? 'LAPORAN OPERASIONAL MINGGUAN LOGISTIK PELUMAS (WEEKLY TACTICAL REVIEW)'
    : 'LAPORAN EKSEKUTIF MANAJEMEN LOGISTIK PELUMAS (MONTHLY MANAGEMENT AUDIT)';

  const statusBadgeHtml = m.periodStatus === 'FINAL_LOCKED'
    ? '<span class="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-extrabold text-[10px] border border-emerald-300">FINAL LOCKED (CLOSED)</span>'
    : '<span class="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 font-extrabold text-[10px] border border-amber-300">DRAFT / RUNNING</span>';

  // --- BAB II: STOCK BALANCE ROWS ---
  let bab2RowsHtml = '';
  if (d.stockBalance && d.stockBalance.length > 0) {
    bab2RowsHtml = d.stockBalance.map((r, idx) => {
      const diffCls = Math.abs(r.selisih) <= 10 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-black';
      return `
        <tr class="border-b border-slate-200 even:bg-slate-50/60 avoid-page-break">
          <td class="py-1.5 px-2 text-center font-mono text-slate-500">${idx + 1}</td>
          <td class="py-1.5 px-2 font-bold text-slate-800 whitespace-nowrap">${r.storageId}</td>
          <td class="py-1.5 px-2">
            <span class="font-bold font-mono text-slate-900">${r.partNumber}</span>
            <span class="text-slate-500 block text-[9px] leading-tight">${r.partDesc}</span>
          </td>
          <td class="py-1.5 px-2 text-right font-mono">${r.qtyAwal.toLocaleString('id-ID')}</td>
          <td class="py-1.5 px-2 text-right font-mono text-blue-700">+${r.qtyMasuk.toLocaleString('id-ID')}</td>
          <td class="py-1.5 px-2 text-right font-mono text-amber-800">-${r.qtyKeluar.toLocaleString('id-ID')}</td>
          <td class="py-1.5 px-2 text-right font-mono font-bold bg-slate-100/70">${r.qtyAkhirBuku.toLocaleString('id-ID')}</td>
          <td class="py-1.5 px-2 text-right font-mono font-bold text-slate-900">${r.soundingQty.toLocaleString('id-ID')}</td>
          <td class="py-1.5 px-2 text-right font-mono ${diffCls}">${r.selisih > 0 ? '+' : ''}${r.selisih.toLocaleString('id-ID')}</td>
          <td class="py-1.5 px-2 text-right font-mono font-semibold text-slate-800">Rp ${r.endingValue.toLocaleString('id-ID')}</td>
        </tr>
      `;
    }).join('');
  } else {
    bab2RowsHtml = '<tr><td colspan="10" class="py-4 text-center text-slate-400 italic">Belum ada data neraca rekonsiliasi tersimpan untuk periode ini.</td></tr>';
  }

  // --- BAB III: MODEL BREAKDOWN CHART & PURPOSE ---
  const maxModelQty = d.modelBreakdown && d.modelBreakdown.length > 0 ? d.modelBreakdown[0].qty : 1;
  const modelChartHtml = (d.modelBreakdown && d.modelBreakdown.length > 0)
    ? d.modelBreakdown.map(mb => {
        const barPct = Math.max(4, Math.round((mb.qty / maxModelQty) * 100));
        return `
          <div class="mb-2 avoid-page-break">
            <div class="flex justify-between text-[10px] font-bold text-slate-800 mb-0.5">
              <span>${mb.model} <span class="text-slate-400 font-normal">(${mb.txCount}x pengisian)</span></span>
              <span class="font-mono">${mb.qty.toLocaleString('id-ID')} L (${mb.sharePct}%) • Rp ${mb.cost.toLocaleString('id-ID')}</span>
            </div>
            <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/70">
              <div class="bg-amber-600 h-full rounded-full" style="width: ${barPct}%"></div>
            </div>
          </div>
        `;
      }).join('')
    : '<p class="text-[10px] text-slate-400 italic">Tidak ada data konsumsi model unit.</p>';

  const purposeTableHtml = (d.purposeBreakdown && d.purposeBreakdown.length > 0)
    ? d.purposeBreakdown.map(pb => `
        <tr class="border-b border-slate-200 even:bg-slate-50/60 avoid-page-break">
          <td class="py-1.5 px-2 font-bold text-slate-800">${pb.purpose}</td>
          <td class="py-1.5 px-2 text-center font-mono">${pb.txCount}</td>
          <td class="py-1.5 px-2 text-right font-mono font-bold text-amber-800">${pb.qty.toLocaleString('id-ID')} L</td>
          <td class="py-1.5 px-2 text-right font-mono">${pb.sharePct}%</td>
          <td class="py-1.5 px-2 text-right font-mono">Rp ${pb.cost.toLocaleString('id-ID')}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="5" class="py-3 text-center text-slate-400 italic">Tidak ada data peruntukan.</td></tr>';

  const topUnitsHtml = (d.topUnits && d.topUnits.length > 0)
    ? d.topUnits.map((u, idx) => `
        <tr class="border-b border-slate-200 even:bg-slate-50/60 avoid-page-break">
          <td class="py-1.5 px-2 text-center font-mono font-bold">${idx + 1}</td>
          <td class="py-1.5 px-2 font-black font-mono text-slate-900">${u.unitId}</td>
          <td class="py-1.5 px-2 font-semibold text-slate-700">${u.model}</td>
          <td class="py-1.5 px-2 text-slate-600">${u.desc}</td>
          <td class="py-1.5 px-2 text-center font-mono text-[10px]">${u.chargeSite}</td>
          <td class="py-1.5 px-2 text-center font-mono">${u.txCount}</td>
          <td class="py-1.5 px-2 text-right font-mono font-black text-amber-800">${u.qty.toLocaleString('id-ID')} L</td>
          <td class="py-1.5 px-2 text-right font-mono font-semibold">Rp ${u.cost.toLocaleString('id-ID')}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="8" class="py-4 text-center text-slate-400 italic">Belum ada data pemakaian unit pada periode ini.</td></tr>';

  // --- BAB IV: VENDOR, MUTASI & RETURN ---
  const vendorHtml = (d.vendorSummary && d.vendorSummary.length > 0)
    ? d.vendorSummary.map((v, idx) => `
        <tr class="border-b border-slate-200 even:bg-slate-50/60 avoid-page-break">
          <td class="py-1.5 px-2 text-center font-mono">${idx + 1}</td>
          <td class="py-1.5 px-2 font-bold text-slate-800">${v.supplier}</td>
          <td class="py-1.5 px-2 text-center font-mono">${v.docCount} DO</td>
          <td class="py-1.5 px-2 text-right font-mono font-bold text-blue-700">${v.qty.toLocaleString('id-ID')} L</td>
          <td class="py-1.5 px-2 text-right font-mono font-semibold">Rp ${v.cost.toLocaleString('id-ID')}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="5" class="py-3 text-center text-slate-400 italic">Tidak ada penerimaan DO vendor pada periode ini.</td></tr>';

  const mutasiHtml = (d.interSiteMovements && d.interSiteMovements.length > 0)
    ? d.interSiteMovements.map(mt => `
        <tr class="border-b border-slate-200 even:bg-slate-50/60 avoid-page-break">
          <td class="py-1.5 px-2 font-mono whitespace-nowrap">${mt.tanggal}</td>
          <td class="py-1.5 px-2 font-bold">${mt.type === 'INTER_SITE' ? 'INTER-SITE' : 'INTERNAL'}</td>
          <td class="py-1.5 px-2 font-mono">${mt.origin} → ${mt.destination}</td>
          <td class="py-1.5 px-2 font-mono">${mt.partNumber} <span class="text-slate-500 font-sans">(${mt.partDesc})</span></td>
          <td class="py-1.5 px-2 text-right font-mono font-bold">${mt.qty.toLocaleString('id-ID')} L</td>
          <td class="py-1.5 px-2 text-slate-600">${mt.remarks}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="6" class="py-3 text-center text-slate-400 italic">Tidak ada mutasi tangki maupun transfer antar-site pada periode ini.</td></tr>';

  const returnHtml = (d.returnAuditLog && d.returnAuditLog.length > 0)
    ? d.returnAuditLog.map(rt => `
        <tr class="border-b border-slate-200 even:bg-slate-50/60 avoid-page-break">
          <td class="py-1.5 px-2 font-mono whitespace-nowrap">${rt.tanggal}</td>
          <td class="py-1.5 px-2 font-bold">${rt.category === 'FLEET_RETURN' ? 'FLEET REVERSAL' : 'VENDOR RETUR'}</td>
          <td class="py-1.5 px-2 font-mono">${rt.refId} (${rt.storage})</td>
          <td class="py-1.5 px-2 font-mono">${rt.partNumber}</td>
          <td class="py-1.5 px-2 text-right font-mono font-bold text-teal-800">${rt.qty.toLocaleString('id-ID')} L</td>
          <td class="py-1.5 px-2 text-slate-600">${rt.remarks}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="6" class="py-3 text-center text-slate-400 italic">Nihil — Tidak ada transaksi pembatalan/koreksi (Return) selama periode ini.</td></tr>';

  const specialNotesHtml = specialNotes
    ? `
      <div class="mt-3 p-3 bg-amber-50/80 border-l-4 border-amber-600 rounded-r-xl avoid-page-break">
        <p class="text-[10px] font-black uppercase tracking-wider text-amber-900 mb-1">Catatan Khusus Lapangan & Tindak Lanjut Manajemen (Superadmin Notes):</p>
        <p class="text-[11px] text-slate-800 whitespace-pre-line leading-relaxed">${specialNotes}</p>
      </div>
    `
    : '';

  // --- BAB V: LAMPIRAN RINCIAN TRANSAKSI HARIAN PER TANGKI (OPSIONAL) ---
  let bab5Html = '';
  if (includeDailyLedger) {
    const tankSections = (d.storageLedgers && d.storageLedgers.length > 0)
      ? d.storageLedgers.map((st, sIdx) => {
          const letter = String.fromCharCode(65 + sIdx);
          const rowsHtml = st.rows.map(rw => `
            <tr class="border-b border-slate-200/80 even:bg-slate-50/50 avoid-page-break">
              <td class="py-1 px-2 font-mono whitespace-nowrap text-slate-600">${rw.tanggal}</td>
              <td class="py-1 px-2 font-mono font-semibold text-slate-800 whitespace-nowrap">${rw.docOrUnit}</td>
              <td class="py-1 px-2">
                <span class="font-mono font-bold text-slate-900">${rw.partNumber}</span>
                <span class="text-slate-500 text-[9px] ml-1">${rw.partDesc}</span>
              </td>
              <td class="py-1 px-2 text-right font-mono font-bold text-blue-700">${rw.qtyIn > 0 ? '+' + rw.qtyIn.toLocaleString('id-ID') : '-'}</td>
              <td class="py-1 px-2 text-right font-mono font-bold text-amber-800">${rw.qtyOut > 0 ? '-' + rw.qtyOut.toLocaleString('id-ID') : '-'}</td>
              <td class="py-1 px-2 text-slate-600 text-[9.5px]">${rw.remarks}</td>
            </tr>
          `).join('');

          return `
            <div class="mb-5">
              <div class="flex items-center justify-between bg-slate-900 text-white px-3 py-1.5 rounded-t-lg avoid-page-break">
                <span class="text-[11px] font-extrabold tracking-wide">${letter}. TANGKI / UNIT: ${st.storageId} — ${st.storageName} <span class="text-amber-400 font-mono text-[9px] ml-1">[${st.storageType}]</span></span>
                <span class="text-[10px] font-mono">Total Masuk: +${st.totalIn.toLocaleString('id-ID')} L | Total Keluar: -${st.totalOut.toLocaleString('id-ID')} L</span>
              </div>
              <table class="w-full text-left text-[10px] border border-slate-300">
                <thead class="bg-slate-100 text-slate-700 font-bold uppercase text-[9px] border-b border-slate-300">
                  <tr>
                    <th class="py-1.5 px-2 w-24">Tanggal</th>
                    <th class="py-1.5 px-2 w-40">No. Dokumen / Unit ID</th>
                    <th class="py-1.5 px-2">Kode & Nama Pelumas</th>
                    <th class="py-1.5 px-2 text-right w-24">Masuk (+)</th>
                    <th class="py-1.5 px-2 text-right w-24">Keluar (-)</th>
                    <th class="py-1.5 px-2">Keperluan / Keterangan</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot class="bg-slate-100 font-extrabold text-[10px] border-t border-slate-300">
                  <tr>
                    <td colspan="3" class="py-1.5 px-2 text-right uppercase text-slate-700">Subtotal Pergerakan (${st.storageId}):</td>
                    <td class="py-1.5 px-2 text-right font-mono text-blue-800">+${st.totalIn.toLocaleString('id-ID')} L</td>
                    <td class="py-1.5 px-2 text-right font-mono text-amber-900">-${st.totalOut.toLocaleString('id-ID')} L</td>
                    <td class="py-1.5 px-2 text-slate-500 font-normal">${st.rows.length} catatan transaksi</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          `;
        }).join('')
      : '<p class="text-xs text-slate-400 italic">Tidak ada aktivitas transaksi harian pada rentang tanggal ini.</p>';

    bab5Html = `
      <div class="page-break-before pt-4">
        <div class="border-b-2 border-slate-900 pb-1.5 mb-3 flex items-center justify-between">
          <h2 class="text-sm font-black uppercase tracking-wider text-slate-900">BAB V. LAMPIRAN RINCIAN MUTASI & TRANSAKSI HARIAN PER TANGKI</h2>
          <span class="text-[10px] font-mono text-slate-500">Site ${m.site} • ${m.fromDate} s.d. ${m.toDate}</span>
        </div>
        ${tankSections}
      </div>
    `;
  }

  // --- BLOK VERIFIKASI DIGITAL OTOMATIS ---
  const docHashId = `KTC-LOG-${m.site}-${m.toDate.replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
  const manualSignatureHtml = includeManualSign
    ? `
      <div class="grid grid-cols-3 gap-6 mt-5 pt-4 border-t border-slate-200 text-center text-[10px] avoid-page-break">
        <div>
          <p class="font-bold text-slate-700 mb-14">Dibuat & Diverifikasi Oleh,</p>
          <p class="font-black text-slate-900 underline">${currentFullName || 'Adi Pranata'}</p>
          <p class="text-slate-500">Superadmin & System Lead</p>
        </div>
        <div>
          <p class="font-bold text-slate-700 mb-14">Diperiksa Oleh,</p>
          <p class="font-black text-slate-900 underline">__________________________</p>
          <p class="text-slate-500">Logistics / Plant Superintendent</p>
        </div>
        <div>
          <p class="font-bold text-slate-700 mb-14">Disetujui Oleh,</p>
          <p class="font-black text-slate-900 underline">__________________________</p>
          <p class="text-slate-500">Project Manager — Site ${m.site}</p>
        </div>
      </div>
    `
    : '';

  container.innerHTML = `
    <div id="printableExecutivePaper" class="bg-white text-slate-900 p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 max-w-[1120px] mx-auto text-xs leading-relaxed">
      
      <!-- KOP SURAT RESMI PERUSAHAAN -->
      <div class="flex flex-wrap items-center justify-between border-b-4 border-slate-900 pb-4 mb-5 gap-4">
        <div class="flex items-center gap-3.5">
          <img src="logo-ktc.png" alt="PT.KTC" onerror="this.style.display='none'" class="h-12 w-auto object-contain">
          <div>
            <p class="text-[10px] font-black tracking-widest text-amber-700 uppercase">PT. KTC COAL MINING & ENERGY</p>
            <h1 class="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">${reportTitle}</h1>
            <p class="text-[11px] text-slate-500 font-medium">Divisi Logistik & Workshop Alat Berat • Project Site <b class="text-slate-800">${m.site}</b></p>
          </div>
        </div>
        <div class="text-right space-y-1">
          <div>${statusBadgeHtml}</div>
          <p class="text-[11px] font-bold text-slate-800 font-mono">Periode: ${m.fromDate} s.d. ${m.toDate}</p>
          <p class="text-[10px] text-slate-500">Filter Model: <b>${m.modelFilter}</b> • Acuan Tutup Buku: <b>${m.refMonth} ${m.refYear}</b></p>
        </div>
      </div>

      <!-- BAB I: RINGKASAN EKSEKUTIF -->
      <div class="mb-6">
        <div class="border-b-2 border-slate-800 pb-1 mb-2.5">
          <h2 class="text-sm font-black uppercase tracking-wider text-slate-900">BAB I. RINGKASAN EKSEKUTIF & INDIKATOR KINERJA UTAMA (KPI)</h2>
        </div>

        <div class="p-3.5 bg-slate-50 border-l-4 border-slate-800 rounded-r-xl mb-4 text-[11.5px] text-slate-800 leading-relaxed text-justify">
          ${nar.chapter1 || '-'}
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 avoid-page-break">
          <div class="p-3 rounded-xl border border-slate-200 bg-white">
            <span class="text-[9.5px] font-bold uppercase text-slate-400 block">Total Konsumsi Armada</span>
            <span class="text-base font-black font-mono text-amber-800">${k.totalConsumeQty.toLocaleString('id-ID')} L/Kg</span>
            <span class="text-[10px] text-slate-500 block mt-0.5">${k.activeFleetCount} unit alat berat aktif</span>
          </div>
          <div class="p-3 rounded-xl border border-slate-200 bg-white">
            <span class="text-[9.5px] font-bold uppercase text-slate-400 block">Estimasi Beban Biaya</span>
            <span class="text-base font-black font-mono text-slate-900">Rp ${k.totalConsumeCost.toLocaleString('id-ID')}</span>
            <span class="text-[10px] text-slate-500 block mt-0.5">Valuasi pemakaian aktual</span>
          </div>
          <div class="p-3 rounded-xl border border-slate-200 bg-white">
            <span class="text-[9.5px] font-bold uppercase text-slate-400 block">Total Penerimaan DO</span>
            <span class="text-base font-black font-mono text-blue-700">${k.totalInboundQty.toLocaleString('id-ID')} L/Kg</span>
            <span class="text-[10px] text-slate-500 block mt-0.5">Nilai: Rp ${k.totalInboundCost.toLocaleString('id-ID')}</span>
          </div>
          <div class="p-3 rounded-xl border border-slate-200 bg-white">
            <span class="text-[9.5px] font-bold uppercase text-slate-400 block">Saldo Akhir Fisik (Sounding)</span>
            <span class="text-base font-black font-mono text-emerald-700">${k.totalSoundingQty.toLocaleString('id-ID')} L/Kg</span>
            <span class="text-[10px] text-slate-500 block mt-0.5">Aset: Rp ${k.totalBookEndingValue.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      <!-- BAB II: NERACA PERSEDIAAN & REKONSILIASI TANGKI -->
      <div class="mb-6">
        <div class="border-b-2 border-slate-800 pb-1 mb-2.5">
          <h2 class="text-sm font-black uppercase tracking-wider text-slate-900">BAB II. NERACA PERSEDIAAN & REKONSILIASI FISIK TANGKI (STOCK BALANCE)</h2>
        </div>

        <div class="p-3.5 bg-slate-50 border-l-4 border-blue-700 rounded-r-xl mb-3 text-[11.5px] text-slate-800 leading-relaxed text-justify">
          ${nar.chapter2 || '-'}
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-[10px] border border-slate-300">
            <thead class="bg-slate-900 text-white font-bold uppercase text-[9px]">
              <tr>
                <th class="py-2 px-2 text-center w-8">No</th>
                <th class="py-2 px-2">Tangki</th>
                <th class="py-2 px-2">Kode & Deskripsi Pelumas</th>
                <th class="py-2 px-2 text-right">Saldo Awal</th>
                <th class="py-2 px-2 text-right">Masuk</th>
                <th class="py-2 px-2 text-right">Keluar</th>
                <th class="py-2 px-2 text-right">Akhir Buku</th>
                <th class="py-2 px-2 text-right">Sounding</th>
                <th class="py-2 px-2 text-right">Selisih</th>
                <th class="py-2 px-2 text-right">Valuasi Akhir (IDR)</th>
              </tr>
            </thead>
            <tbody>${bab2RowsHtml}</tbody>
            <tfoot class="bg-slate-100 font-black text-[10px] border-t-2 border-slate-400">
              <tr>
                <td colspan="6" class="py-2 px-2 text-right uppercase">Total Akumulasi Persediaan Site ${m.site}:</td>
                <td class="py-2 px-2 text-right font-mono">${k.totalBookEndingQty.toLocaleString('id-ID')}</td>
                <td class="py-2 px-2 text-right font-mono">${k.totalSoundingQty.toLocaleString('id-ID')}</td>
                <td class="py-2 px-2 text-right font-mono ${Math.abs(k.totalDiscrepancyQty) <= 10 ? 'text-emerald-700' : 'text-rose-700'}">${k.totalDiscrepancyQty > 0 ? '+' : ''}${k.totalDiscrepancyQty.toLocaleString('id-ID')}</td>
                <td class="py-2 px-2 text-right font-mono text-slate-900">Rp ${k.totalBookEndingValue.toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- BAB III: ANALISIS KONSUMSI ARMADA ALAT BERAT -->
      <div class="mb-6 page-break-before pt-2">
        <div class="border-b-2 border-slate-800 pb-1 mb-2.5">
          <h2 class="text-sm font-black uppercase tracking-wider text-slate-900">BAB III. ANALISIS KONSUMSI ARMADA ALAT BERAT & PERUNTUKAN KERJA</h2>
        </div>

        <div class="p-3.5 bg-slate-50 border-l-4 border-amber-600 rounded-r-xl mb-4 text-[11.5px] text-slate-800 leading-relaxed text-justify">
          ${nar.chapter3 || '-'}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
          <div class="md:col-span-6 p-3.5 border border-slate-200 rounded-xl bg-white">
            <h3 class="text-[11px] font-black uppercase text-slate-800 mb-2.5 border-b border-slate-100 pb-1">3.1. Proporsi Konsumsi per Model Alat Berat</h3>
            ${modelChartHtml}
          </div>
          <div class="md:col-span-6 p-3.5 border border-slate-200 rounded-xl bg-white">
            <h3 class="text-[11px] font-black uppercase text-slate-800 mb-2.5 border-b border-slate-100 pb-1">3.2. Rekapitulasi Berdasarkan Peruntukan (Issued For)</h3>
            <table class="w-full text-left text-[10px] border border-slate-200">
              <thead class="bg-slate-100 text-slate-700 font-bold uppercase text-[9px]">
                <tr>
                  <th class="py-1.5 px-2">Kategori Peruntukan</th>
                  <th class="py-1.5 px-2 text-center">Freq</th>
                  <th class="py-1.5 px-2 text-right">Volume</th>
                  <th class="py-1.5 px-2 text-right">Porsi</th>
                  <th class="py-1.5 px-2 text-right">Biaya (IDR)</th>
                </tr>
              </thead>
              <tbody>${purposeTableHtml}</tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 class="text-[11px] font-black uppercase text-slate-800 mb-2">3.3. Daftar 10 Unit Alat Berat dengan Konsumsi Pelumas Tertinggi (Top 10 Watchlist)</h3>
          <table class="w-full text-left text-[10px] border border-slate-300">
            <thead class="bg-slate-900 text-white font-bold uppercase text-[9px]">
              <tr>
                <th class="py-1.5 px-2 text-center w-10">Rank</th>
                <th class="py-1.5 px-2">Unit ID</th>
                <th class="py-1.5 px-2">Model</th>
                <th class="py-1.5 px-2">Deskripsi Equipment</th>
                <th class="py-1.5 px-2 text-center">Charge Site</th>
                <th class="py-1.5 px-2 text-center">Frekuensi</th>
                <th class="py-1.5 px-2 text-right">Total Volume</th>
                <th class="py-1.5 px-2 text-right">Estimasi Biaya (IDR)</th>
              </tr>
            </thead>
            <tbody>${topUnitsHtml}</tbody>
          </table>
        </div>
      </div>

      <!-- BAB IV: PASOKAN VENDOR, MUTASI & AUDIT KOREKSI -->
      <div class="mb-6">
        <div class="border-b-2 border-slate-800 pb-1 mb-2.5">
          <h2 class="text-sm font-black uppercase tracking-wider text-slate-900">BAB IV. REKAPITULASI PASOKAN VENDOR, MUTASI LOGISTIK & AUDIT KOREKSI</h2>
        </div>

        <div class="p-3.5 bg-slate-50 border-l-4 border-emerald-700 rounded-r-xl mb-4 text-[11.5px] text-slate-800 leading-relaxed text-justify">
          ${nar.chapter4 || '-'}
        </div>

        <div class="space-y-4">
          <div>
            <h3 class="text-[11px] font-black uppercase text-slate-800 mb-1.5">4.1. Ringkasan Penerimaan Pasokan per Vendor / Supplier</h3>
            <table class="w-full text-left text-[10px] border border-slate-300">
              <thead class="bg-slate-100 text-slate-800 font-bold uppercase text-[9px]">
                <tr>
                  <th class="py-1.5 px-2 text-center w-10">No</th>
                  <th class="py-1.5 px-2">Nama Vendor / Pemasok</th>
                  <th class="py-1.5 px-2 text-center">Jumlah DO</th>
                  <th class="py-1.5 px-2 text-right">Total Volume Diterima</th>
                  <th class="py-1.5 px-2 text-right">Total Nilai Pembelian (IDR)</th>
                </tr>
              </thead>
              <tbody>${vendorHtml}</tbody>
            </table>
          </div>

          <div>
            <h3 class="text-[11px] font-black uppercase text-slate-800 mb-1.5">4.2. Log Mutasi Internal Tangki & Pengiriman Antar-Site</h3>
            <table class="w-full text-left text-[10px] border border-slate-300">
              <thead class="bg-slate-100 text-slate-800 font-bold uppercase text-[9px]">
                <tr>
                  <th class="py-1.5 px-2 w-24">Tanggal</th>
                  <th class="py-1.5 px-2 w-24">Tipe</th>
                  <th class="py-1.5 px-2">Rute (Asal → Tujuan)</th>
                  <th class="py-1.5 px-2">Item Pelumas</th>
                  <th class="py-1.5 px-2 text-right">Volume</th>
                  <th class="py-1.5 px-2">Dokumen / Keterangan</th>
                </tr>
              </thead>
              <tbody>${mutasiHtml}</tbody>
            </table>
          </div>

          <div>
            <h3 class="text-[11px] font-black uppercase text-slate-800 mb-1.5">4.3. Catatan Audit Koreksi & Pengembalian (Return / Reversal)</h3>
            <table class="w-full text-left text-[10px] border border-slate-300">
              <thead class="bg-slate-100 text-slate-800 font-bold uppercase text-[9px]">
                <tr>
                  <th class="py-1.5 px-2 w-24">Tanggal</th>
                  <th class="py-1.5 px-2 w-28">Kategori</th>
                  <th class="py-1.5 px-2">Referensi & Tangki</th>
                  <th class="py-1.5 px-2">Kode Part</th>
                  <th class="py-1.5 px-2 text-right">Volume Koreksi</th>
                  <th class="py-1.5 px-2">Justifikasi & Pelaksana</th>
                </tr>
              </thead>
              <tbody>${returnHtml}</tbody>
            </table>
          </div>

          ${specialNotesHtml}
        </div>
      </div>

      <!-- BAB V: LAMPIRAN TRANSAKSI HARIAN PER TANGKI (JIKA DICENTANG) -->
      ${bab5Html}

      <!-- STEMPEL VERIFIKASI DIGITAL OTOMATIS (DIGITAL AUDIT STAMP) -->
      <div class="mt-6 pt-4 border-t-2 border-slate-900 avoid-page-break">
        <div class="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-300">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center text-lg">
              <i class="fa-solid fa-certificate"></i>
            </div>
            <div>
              <p class="text-[10px] font-black uppercase tracking-wider text-slate-900">DIGITAL SYSTEM VERIFICATION STAMP (NO WET SIGNATURE REQUIRED)</p>
              <p class="text-[10px] text-slate-600">
                Disusun & Diverifikasi Secara Digital Oleh: <b class="text-slate-900">${currentFullName || 'Adi Pranata'}</b> (${currentRole}) • Project Site: <b>${m.site}</b>
              </p>
              <p class="text-[9.5px] text-slate-500 font-mono mt-0.5">
                Timestamp: ${m.generatedAt} WIB • Engine: ${execAnalysisEngine} • Doc ID: ${docHashId}
              </p>
            </div>
          </div>
          <div class="text-right text-[9.5px] text-slate-400">
            <p class="font-bold text-slate-700">LOG Dispense Management System v3.5</p>
            <p>PT.KTC Coal Mining & Energy</p>
          </div>
        </div>
        ${manualSignatureHtml}
      </div>

    </div>
  `;
}

// ==========================================
// 6. TRIGGER BROWSER PRINT-TO-PDF (A4 LANDSCAPE)
// ==========================================
async function printExecutiveReportPDF() {
  if (currentRole !== 'SUPERADMIN') return;

  if (!execReportData) {
    await loadExecutiveReportData();
    if (!execReportData) return;
  }

  // Beri jeda singkat agar DOM selesai merender sebelum dialog Print PDF muncul
  setTimeout(() => {
    window.print();
  }, 150);
}
