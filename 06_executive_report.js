/**
 * ============================================================================
 * MODUL 6: EXECUTIVE PDF REPORT & HYBRID AI ENGINE (06_executive_report.js)
 * LOG DISPENSE MANAGEMENT SYSTEM v3.5 ENTERPRISE
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

  // --- BAB II: DIPISAH PER TANGKI TANPA KOLOM "NO" ---
  let bab2TanksHtml = '';
  if (d.stockBalance && d.stockBalance.length > 0) {
    const tankGroupsMap = {};
    d.stockBalance.forEach(r => {
      const stKey = r.storageId || 'UNKNOWN';
      if (!tankGroupsMap[stKey]) {
        const metaSt = (d.storageLedgers || []).find(s => s.storageId === stKey);
        tankGroupsMap[stKey] = {
          storageId: stKey,
          storageName: metaSt ? metaSt.storageName : stKey,
          rows: [],
          subAwal: 0,
          subMasuk: 0,
          subKeluar: 0,
          subBuku: 0,
          subSounding: 0,
          subSelisih: 0,
          subValue: 0
        };
      }
      const grp = tankGroupsMap[stKey];
      grp.rows.push(r);
      grp.subAwal += Number(r.qtyAwal) || 0;
      grp.subMasuk += Number(r.qtyMasuk) || 0;
      grp.subKeluar += Number(r.qtyKeluar) || 0;
      grp.subBuku += Number(r.qtyAkhirBuku) || 0;
      grp.subSounding += Number(r.soundingQty) || 0;
      grp.subSelisih += Number(r.selisih) || 0;
      grp.subValue += Number(r.endingValue) || 0;
    });

    const tankGroups = Object.values(tankGroupsMap).sort((a, b) => a.storageId.localeCompare(b.storageId));

    bab2TanksHtml = tankGroups.map((grp, gIdx) => {
      const rowsHtml = grp.rows.map(r => {
        const diffCls = Math.abs(r.selisih) <= 10 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-black';
        return `
          <tr class="border-b border-slate-200 even:bg-slate-50/60 avoid-page-break">
            <td class="py-1.5 px-2">
              <span class="font-bold font-mono text-slate-900">${r.partNumber}</span>
              <span class="text-slate-500 block text-[9px] leading-tight">${r.partDesc}</span>
            </td>
            <td class="py-1.5 px-2 text-right font-mono">${r.qtyAwal.toLocaleString('id-ID')}</td>
            <td class="py-1.5 px-2 text-right font-mono text-blue-700">+${r.qtyMasuk.toLocaleString('id-ID')}</td>
            <td class="py-1.5 px-2 text-right font-mono text-amber-800">-${r.qtyKeluar.toLocaleString('id-ID')}</td>
            <td class="py-1.5 px-2 text-right font-mono font-bold bg-slate-100/70">${r.qtyAkhirBuku.toLocaleString('id-ID')}</td>
            <td class="py-1.5 px-2 text-right font-mono font-bold text-slate-900">${r.soundingQty.toLocaleString('id-ID')}</td>
            <td class="py-1.5 px-2 text-right font-mono ${diffCls}">${r.selisih > 0 ? '+' : ''}${Number(r.selisih.toFixed(2)).toLocaleString('id-ID')}</td>
            <td class="py-1.5 px-2 text-right font-mono font-semibold text-slate-800">Rp ${Math.round(r.endingValue).toLocaleString('id-ID')}</td>
          </tr>
        `;
      }).join('');

      const subDiffRounded = Number(grp.subSelisih.toFixed(2));
      return `
        <div class="mb-4">
          <div class="flex items-center justify-between bg-slate-800 text-white px-3 py-1.5 rounded-t-lg avoid-page-break">
            <span class="text-[10.5px] font-extrabold tracking-wide">2.${gIdx + 1}. TANGKI / UNIT: ${grp.storageId} — ${grp.storageName}</span>
            <span class="text-[9.5px] font-mono text-amber-300">Valuasi Tangki: Rp ${Math.round(grp.subValue).toLocaleString('id-ID')}</span>
          </div>
          <table class="w-full text-left text-[10px] border border-slate-300">
            <thead class="bg-slate-100 text-slate-800 font-bold uppercase text-[9px] border-b border-slate-300">
              <tr>
                <th class="py-1.5 px-2">Kode & Deskripsi Pelumas</th>
                <th class="py-1.5 px-2 text-right">Saldo Awal</th>
                <th class="py-1.5 px-2 text-right">Masuk</th>
                <th class="py-1.5 px-2 text-right">Keluar</th>
                <th class="py-1.5 px-2 text-right">Akhir Buku</th>
                <th class="py-1.5 px-2 text-right">Sounding</th>
                <th class="py-1.5 px-2 text-right">Selisih</th>
                <th class="py-1.5 px-2 text-right">Valuasi Akhir (IDR)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="bg-slate-100 font-extrabold text-[9.5px] border-t border-slate-300 avoid-page-break">
                <td class="py-1.5 px-2 text-right uppercase text-slate-700">Subtotal (${grp.storageId}):</td>
                <td class="py-1.5 px-2 text-right font-mono">${Number(grp.subAwal.toFixed(2)).toLocaleString('id-ID')}</td>
                <td class="py-1.5 px-2 text-right font-mono text-blue-700">+${Number(grp.subMasuk.toFixed(2)).toLocaleString('id-ID')}</td>
                <td class="py-1.5 px-2 text-right font-mono text-amber-800">-${Number(grp.subKeluar.toFixed(2)).toLocaleString('id-ID')}</td>
                <td class="py-1.5 px-2 text-right font-mono">${Number(grp.subBuku.toFixed(2)).toLocaleString('id-ID')}</td>
                <td class="py-1.5 px-2 text-right font-mono">${Number(grp.subSounding.toFixed(2)).toLocaleString('id-ID')}</td>
                <td class="py-1.5 px-2 text-right font-mono ${Math.abs(subDiffRounded) <= 10 ? 'text-emerald-700' : 'text-rose-700'}">${subDiffRounded > 0 ? '+' : ''}${subDiffRounded.toLocaleString('id-ID')}</td>
                <td class="py-1.5 px-2 text-right font-mono text-slate-900">Rp ${Math.round(grp.subValue).toLocaleString('id-ID')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    bab2TanksHtml += `
      <div class="p-2.5 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-extrabold avoid-page-break">
        <span class="uppercase tracking-wider">TOTAL AKUMULASI PERSEDIAAN SITE ${m.site}:</span>
        <div class="flex flex-wrap items-center gap-4 font-mono">
          <span>Akhir Buku: ${k.totalBookEndingQty.toLocaleString('id-ID')} L</span>
          <span>Sounding: ${k.totalSoundingQty.toLocaleString('id-ID')} L</span>
          <span>Selisih: ${k.totalDiscrepancyQty > 0 ? '+' : ''}${k.totalDiscrepancyQty.toLocaleString('id-ID')} L</span>
          <span class="text-amber-400">Valuasi Total: Rp ${k.totalBookEndingValue.toLocaleString('id-ID')}</span>
        </div>
      </div>
    `;
  } else {
    bab2TanksHtml = '<p class="py-4 text-center text-slate-400 italic border border-slate-200 rounded-xl">Belum ada data neraca rekonsiliasi tersimpan untuk periode ini.</p>';
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

  // --- BAB IV: VENDOR (TANPA KOLOM "NO"), MUTASI & RETURN ---
  const vendorHtml = (d.vendorSummary && d.vendorSummary.length > 0)
    ? d.vendorSummary.map(v => `
        <tr class="border-b border-slate-200 even:bg-slate-50/60 avoid-page-break">
          <td class="py-1.5 px-2 font-bold text-slate-800">${v.supplier}</td>
          <td class="py-1.5 px-2 text-center font-mono">${v.docCount} DO</td>
          <td class="py-1.5 px-2 text-right font-mono font-bold text-blue-700">${v.qty.toLocaleString('id-ID')} L</td>
          <td class="py-1.5 px-2 text-right font-mono font-semibold">Rp ${v.cost.toLocaleString('id-ID')}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" class="py-3 text-center text-slate-400 italic">Tidak ada penerimaan DO vendor pada periode ini.</td></tr>';

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
          const rowsHtml = st.rows.map(rw => {
            const cleanRemarks = String(rw.remarks || '').replace(/^(\[RETURN UNIT\]\s*)+/i, '[RETURN UNIT] ');
            return `
            <tr class="border-b border-slate-200/80 even:bg-slate-50/50 avoid-page-break">
              <td class="py-1 px-2 font-mono whitespace-nowrap text-slate-600">${rw.tanggal}</td>
              <td class="py-1 px-2 font-mono font-semibold text-slate-800 whitespace-nowrap">${rw.docOrUnit}</td>
              <td class="py-1 px-2">
                <span class="font-mono font-bold text-slate-900">${rw.partNumber}</span>
                <span class="text-slate-500 text-[9px] ml-1">${rw.partDesc}</span>
              </td>
              <td class="py-1 px-2 text-right font-mono font-bold text-blue-700">${rw.qtyIn > 0 ? '+' + rw.qtyIn.toLocaleString('id-ID') : '-'}</td>
              <td class="py-1 px-2 text-right font-mono font-bold text-amber-800">${rw.qtyOut > 0 ? '-' + rw.qtyOut.toLocaleString('id-ID') : '-'}</td>
              <td class="py-1 px-2 text-slate-600 text-[9.5px]">${cleanRemarks}</td>
            </tr>
          `;
          }).join('');

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
                <tbody>
                  ${rowsHtml}
                  <tr class="bg-slate-100 font-extrabold text-[10px] border-t border-slate-300 avoid-page-break">
                    <td colspan="3" class="py-1.5 px-2 text-right uppercase text-slate-700">Subtotal Pergerakan (${st.storageId}):</td>
                    <td class="py-1.5 px-2 text-right font-mono text-blue-800">+${st.totalIn.toLocaleString('id-ID')} L</td>
                    <td class="py-1.5 px-2 text-right font-mono text-amber-900">-${st.totalOut.toLocaleString('id-ID')} L</td>
                    <td class="py-1.5 px-2 text-slate-500 font-normal">${st.rows.length} catatan transaksi</td>
                  </tr>
                </tbody>
              </table>
            </div>
          `;
        }).join('')
      : '<p class="text-xs text-slate-400 italic">Tidak ada aktivitas transaksi harian pada rentang tanggal ini.</p>';

    bab5Html = `
      <div class="pt-3">
        <div class="border-b-2 border-slate-900 pb-1.5 mb-3 flex items-center justify-between avoid-page-break">
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

      <!-- BAB II: NERACA PERSEDIAAN & REKONSILIASI TANGKI (DIPISAH PER TANGKI) -->
      <div class="mb-6">
        <div class="border-b-2 border-slate-800 pb-1 mb-2.5">
          <h2 class="text-sm font-black uppercase tracking-wider text-slate-900">BAB II. NERACA PERSEDIAAN & REKONSILIASI FISIK TANGKI (STOCK BALANCE)</h2>
        </div>

        <div class="p-3.5 bg-slate-50 border-l-4 border-blue-700 rounded-r-xl mb-3 text-[11.5px] text-slate-800 leading-relaxed text-justify">
          ${nar.chapter2 || '-'}
        </div>

        ${bab2TanksHtml}
      </div>

      <!-- BAB III: ANALISIS KONSUMSI ARMADA ALAT BERAT -->
      <div class="mb-6 pt-2">
        <div class="border-b-2 border-slate-800 pb-1 mb-2.5 avoid-page-break">
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
        <div class="border-b-2 border-slate-800 pb-1 mb-2.5 avoid-page-break">
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
            <p>AP Systems • Independent Initiative</p>
          </div>
        </div>
        ${manualSignatureHtml}
      </div>

      <!-- PREVIEW FOOTER (MPS STYLE) -->
      <div class="mt-4 pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-400">
        <span>Generated automatically by AP Systems - LOG Dispense Management System v3.5 | Digital Lubricant &amp; Inventory . Designed &amp; Developed by Adi Pranata</span>
        <span class="font-bold text-slate-600">A4 Landscape Direct PDF Ready</span>
      </div>

    </div>
  `;
}

// ==========================================
// 6. DIRECT PDF GENERATOR (A4 LANDSCAPE - ZERO URL & MPS FOOTER)
// ==========================================
function loadLogoDataUrl_(src) {
  return new Promise(resolve => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = function () {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 200;
          canvas.height = img.naturalHeight || 80;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve({
            dataUrl: canvas.toDataURL('image/png'),
            ratio: (img.naturalWidth && img.naturalHeight) ? (img.naturalWidth / img.naturalHeight) : 2.4
          });
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = src;
    } catch (e) {
      resolve(null);
    }
  });
}

async function printExecutiveReportPDF() {
  if (currentRole !== 'SUPERADMIN') return;

  if (!execReportData) {
    await loadExecutiveReportData();
    if (!execReportData) return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showModalAlert("PDF Engine Loading", "Library PDF belum siap. Silakan muat ulang halaman (Ctrl + F5).");
    return;
  }

  const statusLbl = document.getElementById('lblExecReportStatus');
  if (statusLbl) {
    statusLbl.className = "text-xs font-bold text-rose-700";
    statusLbl.innerText = "Compiling A4 Landscape PDF file...";
  }

  try {
    const logoObj = await loadLogoDataUrl_('logo-ktc.png');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const d = execReportData;
    const m = d.meta;
    const k = d.kpi;
    const nar = d.narratives || {};

    const includeDailyLedger = document.getElementById('chkIncludeDailyLedger')?.checked ?? true;
    const includeManualSign = document.getElementById('chkIncludeManualSign')?.checked ?? false;
    const specialNotes = (document.getElementById('execSpecialNotes')?.value || '').trim();

    const pageWidth = doc.internal.pageSize.getWidth();   // 297 mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
    const marginX = 12;
    const contentWidth = pageWidth - (marginX * 2);
    const maxY = pageHeight - 16; // Ruang bawah untuk footer resmi

    let curY = 12;

    function ensureSpace(neededMm) {
      if (curY + neededMm > maxY) {
        doc.addPage();
        curY = 14;
      }
    }

    function drawChapterHeader(titleText, accentRgb = [15, 23, 42]) {
      ensureSpace(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.text(titleText, marginX, curY);
      curY += 1.8;
      doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.setLineWidth(0.5);
      doc.line(marginX, curY, pageWidth - marginX, curY);
      curY += 4.5;
    }

    function drawNarrativeBox(textStr, borderRgb = [30, 41, 59]) {
      if (!textStr) return;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(textStr, contentWidth - 8);
      const boxHeight = (lines.length * 4.1) + 5;
      ensureSpace(boxHeight + 3);

      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, curY, contentWidth, boxHeight, 'F');
      doc.setFillColor(borderRgb[0], borderRgb[1], borderRgb[2]);
      doc.rect(marginX, curY, 1.4, boxHeight, 'F');

      doc.setTextColor(30, 41, 59);
      doc.text(lines, marginX + 4, curY + 4.2);
      curY += boxHeight + 4.5;
    }

    // ------------------------------------------
    // KOP SURAT & LOGO PERUSAHAAN (HALAMAN 1)
    // ------------------------------------------
    let headerTextX = marginX;
    if (logoObj && logoObj.dataUrl) {
      const logoH = 11.5;
      const logoW = Math.min(34, logoH * logoObj.ratio);
      doc.addImage(logoObj.dataUrl, 'PNG', marginX, curY - 1.5, logoW, logoH);
      headerTextX = marginX + logoW + 3.5;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 83, 9);
    doc.text(`PT. KTC COAL MINING & ENERGY  •  PROJECT SITE ${m.site}`, headerTextX, curY + 1);

    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    const statusText = m.periodStatus === 'FINAL_LOCKED' ? 'STATUS: FINAL LOCKED (CLOSED)' : 'STATUS: DRAFT / RUNNING';
    doc.text(statusText, pageWidth - marginX, curY + 1, { align: 'right' });

    curY += 5.5;
    doc.setFontSize(12.5);
    doc.setTextColor(15, 23, 42);
    const mainTitle = m.reportMode === 'WEEKLY'
      ? 'LAPORAN OPERASIONAL MINGGUAN LOGISTIK PELUMAS (WEEKLY TACTICAL REVIEW)'
      : 'LAPORAN EKSEKUTIF MANAJEMEN LOGISTIK PELUMAS (MONTHLY MANAGEMENT AUDIT)';
    doc.text(mainTitle, headerTextX, curY);

    curY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(71, 85, 105);
    doc.text(`Model Filter: ${m.modelFilter} | Periode: ${m.fromDate} s.d. ${m.toDate} | Acuan Tutup Buku: ${m.refMonth} ${m.refYear} | Penyusun: ${currentFullName || 'Adi Pranata'}`, headerTextX, curY);

    curY += 2.8;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.8);
    doc.line(marginX, curY, pageWidth - marginX, curY);
    curY += 6;

    // ------------------------------------------
    // BAB I. RINGKASAN EKSEKUTIF & KPI
    // ------------------------------------------
    drawChapterHeader('BAB I. RINGKASAN EKSEKUTIF & INDIKATOR KINERJA UTAMA (KPI)');
    drawNarrativeBox(nar.chapter1 || '-', [15, 23, 42]);

    // 4 Kartu KPI Horizontal
    ensureSpace(22);
    const cardGap = 4;
    const cardW = (contentWidth - (cardGap * 3)) / 4;
    const cardH = 18;
    const kpiCards = [
      {
        label: 'TOTAL KONSUMSI ARMADA',
        value: `${k.totalConsumeQty.toLocaleString('id-ID')} L/Kg`,
        sub: `${k.activeFleetCount} unit alat berat aktif`,
        rgb: [146, 64, 14]
      },
      {
        label: 'ESTIMASI BEBAN BIAYA',
        value: `Rp ${k.totalConsumeCost.toLocaleString('id-ID')}`,
        sub: 'Valuasi pemakaian aktual',
        rgb: [15, 23, 42]
      },
      {
        label: 'TOTAL PENERIMAAN DO',
        value: `${k.totalInboundQty.toLocaleString('id-ID')} L/Kg`,
        sub: `Nilai: Rp ${k.totalInboundCost.toLocaleString('id-ID')}`,
        rgb: [29, 78, 216]
      },
      {
        label: 'SALDO AKHIR FISIK (SOUNDING)',
        value: `${k.totalSoundingQty.toLocaleString('id-ID')} L/Kg`,
        sub: `Aset: Rp ${k.totalBookEndingValue.toLocaleString('id-ID')}`,
        rgb: [4, 120, 87]
      }
    ];

    kpiCards.forEach((c, idx) => {
      const cx = marginX + idx * (cardW + cardGap);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cx, curY, cardW, cardH, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(c.label, cx + 3, curY + 4.5);

      doc.setFontSize(11);
      doc.setTextColor(c.rgb[0], c.rgb[1], c.rgb[2]);
      doc.text(c.value, cx + 3, curY + 10.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(c.sub, cx + 3, curY + 15.2);
    });
    curY += cardH + 7;

    // ------------------------------------------
    // BAB II. NERACA PERSEDIAAN & REKONSILIASI TANGKI (PER TANGKI, TANPA KOLOM NO)
    // ------------------------------------------
    drawChapterHeader('BAB II. NERACA PERSEDIAAN & REKONSILIASI FISIK TANGKI (STOCK BALANCE)', [29, 78, 216]);
    drawNarrativeBox(nar.chapter2 || '-', [29, 78, 216]);

    if (d.stockBalance && d.stockBalance.length > 0) {
      const tankGroupsMap = {};
      d.stockBalance.forEach(r => {
        const stKey = r.storageId || 'UNKNOWN';
        if (!tankGroupsMap[stKey]) {
          const metaSt = (d.storageLedgers || []).find(s => s.storageId === stKey);
          tankGroupsMap[stKey] = {
            storageId: stKey,
            storageName: metaSt ? metaSt.storageName : stKey,
            rows: [],
            subAwal: 0,
            subMasuk: 0,
            subKeluar: 0,
            subBuku: 0,
            subSounding: 0,
            subSelisih: 0,
            subValue: 0
          };
        }
        const grp = tankGroupsMap[stKey];
        grp.rows.push(r);
        grp.subAwal += Number(r.qtyAwal) || 0;
        grp.subMasuk += Number(r.qtyMasuk) || 0;
        grp.subKeluar += Number(r.qtyKeluar) || 0;
        grp.subBuku += Number(r.qtyAkhirBuku) || 0;
        grp.subSounding += Number(r.soundingQty) || 0;
        grp.subSelisih += Number(r.selisih) || 0;
        grp.subValue += Number(r.endingValue) || 0;
      });

      const tankGroups = Object.values(tankGroupsMap).sort((a, b) => a.storageId.localeCompare(b.storageId));

      tankGroups.forEach((grp, gIdx) => {
        ensureSpace(34);
        // Header Sub-Bab Tangki
        doc.setFillColor(30, 41, 59);
        doc.rect(marginX, curY, contentWidth, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text(`2.${gIdx + 1}. TANGKI / UNIT: ${grp.storageId} — ${grp.storageName}`, marginX + 2.5, curY + 4.2);
        doc.setTextColor(252, 211, 77);
        doc.text(`Valuasi Tangki: Rp ${Math.round(grp.subValue).toLocaleString('id-ID')}`, pageWidth - marginX - 2.5, curY + 4.2, { align: 'right' });
        curY += 6;

        const bodyRows = grp.rows.map(r => [
          `${r.partNumber}\n${r.partDesc}`,
          r.qtyAwal.toLocaleString('id-ID'),
          `+${r.qtyMasuk.toLocaleString('id-ID')}`,
          `-${r.qtyKeluar.toLocaleString('id-ID')}`,
          r.qtyAkhirBuku.toLocaleString('id-ID'),
          r.soundingQty.toLocaleString('id-ID'),
          `${r.selisih > 0 ? '+' : ''}${Number(r.selisih.toFixed(2)).toLocaleString('id-ID')}`,
          `Rp ${Math.round(r.endingValue).toLocaleString('id-ID')}`
        ]);

        const subDiff = Number(grp.subSelisih.toFixed(2));
        bodyRows.push([
          { content: `SUBTOTAL (${grp.storageId})`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
          { content: Number(grp.subAwal.toFixed(2)).toLocaleString('id-ID'), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
          { content: `+${Number(grp.subMasuk.toFixed(2)).toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right', textColor: [29, 78, 216] } },
          { content: `-${Number(grp.subKeluar.toFixed(2)).toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right', textColor: [146, 64, 14] } },
          { content: Number(grp.subBuku.toFixed(2)).toLocaleString('id-ID'), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
          { content: Number(grp.subSounding.toFixed(2)).toLocaleString('id-ID'), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
          { content: `${subDiff > 0 ? '+' : ''}${subDiff.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
          { content: `Rp ${Math.round(grp.subValue).toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } }
        ]);

        doc.autoTable({
          startY: curY,
          margin: { left: marginX, right: marginX, bottom: 16 },
          head: [[
            'Kode & Deskripsi Pelumas', 'Saldo Awal', 'Masuk', 'Keluar',
            'Akhir Buku', 'Sounding', 'Selisih', 'Valuasi Akhir (IDR)'
          ]],
          body: bodyRows,
          theme: 'grid',
          styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.2 },
          headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5 },
          columnStyles: {
            0: { cellWidth: 88 },
            1: { halign: 'right' },
            2: { halign: 'right', textColor: [29, 78, 216] },
            3: { halign: 'right', textColor: [146, 64, 14] },
            4: { halign: 'right', fontStyle: 'bold' },
            5: { halign: 'right', fontStyle: 'bold' },
            6: { halign: 'right' },
            7: { halign: 'right', fontStyle: 'bold' }
          }
        });

        curY = doc.lastAutoTable.finalY + 4;
      });

      // Grand Total Bar Site
      ensureSpace(12);
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(marginX, curY, contentWidth, 7.5, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`TOTAL AKUMULASI PERSEDIAAN SITE ${m.site}:`, marginX + 3, curY + 5);
      doc.setTextColor(252, 211, 77);
      const grandStr = `Akhir Buku: ${k.totalBookEndingQty.toLocaleString('id-ID')} L   |   Sounding: ${k.totalSoundingQty.toLocaleString('id-ID')} L   |   Selisih: ${k.totalDiscrepancyQty > 0 ? '+' : ''}${k.totalDiscrepancyQty.toLocaleString('id-ID')} L   |   Valuasi: Rp ${k.totalBookEndingValue.toLocaleString('id-ID')}`;
      doc.text(grandStr, pageWidth - marginX - 3, curY + 5, { align: 'right' });
      curY += 12;
    }

    // ------------------------------------------
    // BAB III. ANALISIS KONSUMSI ARMADA ALAT BERAT (SMART FLOW)
    // ------------------------------------------
    ensureSpace(55);
    drawChapterHeader('BAB III. ANALISIS KONSUMSI ARMADA ALAT BERAT & PERUNTUKAN KERJA', [180, 83, 9]);
    drawNarrativeBox(nar.chapter3 || '-', [180, 83, 9]);

    // 3.1 Proporsi Konsumsi per Model (Dengan Grafik Batang Mini Visual)
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('3.1. Proporsi Konsumsi per Model Alat Berat', marginX, curY);
    curY += 2.5;

    const maxModelShare = (d.modelBreakdown && d.modelBreakdown.length > 0)
      ? Math.max(...d.modelBreakdown.map(x => Number(x.sharePct) || 0), 1)
      : 100;

    doc.autoTable({
      startY: curY,
      margin: { left: marginX, right: marginX, bottom: 16 },
      head: [['Model Alat Berat', 'Frekuensi Pengisian', 'Total Volume (L/Kg)', 'Kontribusi (%)', 'Estimasi Biaya (IDR)']],
      body: (d.modelBreakdown && d.modelBreakdown.length > 0)
        ? d.modelBreakdown.map(mb => [
            mb.model,
            `${mb.txCount}x`,
            `${mb.qty.toLocaleString('id-ID')} L`,
            `${mb.sharePct}%`,
            `Rp ${mb.cost.toLocaleString('id-ID')}`
          ])
        : [['Belum ada data konsumsi model', '-', '-', '-', '-']],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right', fontStyle: 'bold' },
        3: { halign: 'right', cellWidth: 42 },
        4: { halign: 'right', fontStyle: 'bold' }
      },
      didDrawCell: function (data) {
        if (data.section === 'body' && data.column.index === 3 && d.modelBreakdown && d.modelBreakdown[data.row.index]) {
          const pctVal = Number(d.modelBreakdown[data.row.index].sharePct) || 0;
          const barMaxW = 20;
          const barH = 2.6;
          const bx = data.cell.x + 2.5;
          const by = data.cell.y + (data.cell.height / 2) - (barH / 2);

          doc.setFillColor(226, 232, 240);
          doc.rect(bx, by, barMaxW, barH, 'F');

          const fillW = Math.max(0.8, (pctVal / maxModelShare) * barMaxW);
          doc.setFillColor(217, 119, 6);
          doc.rect(bx, by, fillW, barH, 'F');
        }
      }
    });
    curY = doc.lastAutoTable.finalY + 5;

    // 3.2 Rekapitulasi Peruntukan
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('3.2. Rekapitulasi Berdasarkan Peruntukan Kerja (Issued For)', marginX, curY);
    curY += 2.5;

    doc.autoTable({
      startY: curY,
      margin: { left: marginX, right: marginX, bottom: 16 },
      head: [['Kategori Peruntukan', 'Frekuensi', 'Total Volume (L/Kg)', 'Porsi (%)', 'Estimasi Biaya (IDR)']],
      body: (d.purposeBreakdown && d.purposeBreakdown.length > 0)
        ? d.purposeBreakdown.map(pb => [
            pb.purpose,
            `${pb.txCount}x`,
            `${pb.qty.toLocaleString('id-ID')} L`,
            `${pb.sharePct}%`,
            `Rp ${pb.cost.toLocaleString('id-ID')}`
          ])
        : [['Belum ada data peruntukan', '-', '-', '-', '-']],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right', fontStyle: 'bold' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' }
      }
    });
    curY = doc.lastAutoTable.finalY + 5;

    // 3.3 Top 10 Unit Watchlist
    ensureSpace(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('3.3. Daftar 10 Unit Alat Berat dengan Konsumsi Pelumas Tertinggi (Top 10 Watchlist)', marginX, curY);
    curY += 2.5;

    doc.autoTable({
      startY: curY,
      margin: { left: marginX, right: marginX, bottom: 16 },
      head: [['Rank', 'Unit ID', 'Model', 'Deskripsi Equipment', 'Charge Site', 'Freq', 'Total Volume', 'Estimasi Biaya (IDR)']],
      body: (d.topUnits && d.topUnits.length > 0)
        ? d.topUnits.map((u, i) => [
            i + 1,
            u.unitId,
            u.model,
            u.desc,
            u.chargeSite,
            `${u.txCount}x`,
            `${u.qty.toLocaleString('id-ID')} L`,
            `Rp ${u.cost.toLocaleString('id-ID')}`
          ])
        : [['-', 'Belum ada data unit', '-', '-', '-', '-', '-', '-']],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { fontStyle: 'bold' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'right', fontStyle: 'bold', textColor: [146, 64, 14] },
        7: { halign: 'right', fontStyle: 'bold' }
      }
    });
    curY = doc.lastAutoTable.finalY + 7;

    // ------------------------------------------
    // BAB IV. REKAPITULASI PASOKAN VENDOR, MUTASI & AUDIT KOREKSI (SMART FLOW)
    // ------------------------------------------
    ensureSpace(55);
    drawChapterHeader('BAB IV. REKAPITULASI PASOKAN VENDOR, MUTASI LOGISTIK & AUDIT KOREKSI', [4, 120, 87]);
    drawNarrativeBox(nar.chapter4 || '-', [4, 120, 87]);

    // 4.1 Vendor Summary (Tanpa Kolom NO)
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('4.1. Ringkasan Penerimaan Pasokan per Vendor / Supplier', marginX, curY);
    curY += 2.5;

    doc.autoTable({
      startY: curY,
      margin: { left: marginX, right: marginX, bottom: 16 },
      head: [['Nama Vendor / Pemasok', 'Jumlah DO', 'Total Volume Diterima', 'Total Nilai Pembelian (IDR)']],
      body: (d.vendorSummary && d.vendorSummary.length > 0)
        ? d.vendorSummary.map(v => [
            v.supplier,
            `${v.docCount} DO`,
            `${v.qty.toLocaleString('id-ID')} L`,
            `Rp ${v.cost.toLocaleString('id-ID')}`
          ])
        : [['Tidak ada penerimaan DO vendor pada periode ini', '-', '-', '-']],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right', fontStyle: 'bold', textColor: [29, 78, 216] },
        3: { halign: 'right', fontStyle: 'bold' }
      }
    });
    curY = doc.lastAutoTable.finalY + 5;

    // 4.2 Log Mutasi Internal & Antar Site
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('4.2. Log Mutasi Internal Tangki & Pengiriman Antar-Site', marginX, curY);
    curY += 2.5;

    doc.autoTable({
      startY: curY,
      margin: { left: marginX, right: marginX, bottom: 16 },
      head: [['Tanggal', 'Tipe', 'Rute (Asal -> Tujuan)', 'Item Pelumas', 'Volume', 'Dokumen / Keterangan']],
      body: (d.interSiteMovements && d.interSiteMovements.length > 0)
        ? d.interSiteMovements.map(mt => [
            mt.tanggal,
            mt.type === 'INTER_SITE' ? 'INTER-SITE' : 'INTERNAL',
            `${mt.origin} -> ${mt.destination}`,
            `${mt.partNumber} (${mt.partDesc})`,
            `${mt.qty.toLocaleString('id-ID')} L`,
            mt.remarks
          ])
        : [['-', '-', 'Tidak ada mutasi tangki maupun transfer antar-site pada periode ini', '-', '-', '-']],
      theme: 'grid',
      styles: { fontSize: 7.2, cellPadding: 1.6 },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 22, fontStyle: 'bold' },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 22 }
      }
    });
    curY = doc.lastAutoTable.finalY + 5;

    // 4.3 Catatan Audit Koreksi & Return
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('4.3. Catatan Audit Koreksi & Pengembalian (Return / Reversal)', marginX, curY);
    curY += 2.5;

    doc.autoTable({
      startY: curY,
      margin: { left: marginX, right: marginX, bottom: 16 },
      head: [['Tanggal', 'Kategori', 'Referensi & Tangki', 'Kode Part', 'Volume Koreksi', 'Justifikasi & Pelaksana']],
      body: (d.returnAuditLog && d.returnAuditLog.length > 0)
        ? d.returnAuditLog.map(rt => [
            rt.tanggal,
            rt.category === 'FLEET_RETURN' ? 'FLEET REVERSAL' : 'VENDOR RETUR',
            `${rt.refId} (${rt.storage})`,
            rt.partNumber,
            `${rt.qty.toLocaleString('id-ID')} L`,
            rt.remarks
          ])
        : [['-', '-', 'Nihil — Tidak ada transaksi pembatalan/koreksi (Return) selama periode ini', '-', '-', '-']],
      theme: 'grid',
      styles: { fontSize: 7.2, cellPadding: 1.6 },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 24 }
      }
    });
    curY = doc.lastAutoTable.finalY + 6;

    if (specialNotes) {
      drawNarrativeBox(`CATATAN KHUSUS LAPANGAN (SUPERADMIN NOTES): ${specialNotes}`, [217, 119, 6]);
    }

    // ------------------------------------------
    // BAB V. LAMPIRAN RINCIAN TRANSAKSI HARIAN PER TANGKI (SMART FLOW)
    // ------------------------------------------
    if (includeDailyLedger && d.storageLedgers && d.storageLedgers.length > 0) {
      ensureSpace(55);
      drawChapterHeader(`BAB V. LAMPIRAN RINCIAN MUTASI & TRANSAKSI HARIAN PER TANGKI (SITE ${m.site})`);

      d.storageLedgers.forEach((st, sIdx) => {
        const letter = String.fromCharCode(65 + sIdx);
        ensureSpace(34);

        doc.setFillColor(15, 23, 42);
        doc.rect(marginX, curY, contentWidth, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.setTextColor(255, 255, 255);
        doc.text(`${letter}. TANGKI / UNIT: ${st.storageId} — ${st.storageName} [${st.storageType}]`, marginX + 2.5, curY + 4.2);
        doc.setTextColor(252, 211, 77);
        doc.text(`Total Masuk: +${st.totalIn.toLocaleString('id-ID')} L | Total Keluar: -${st.totalOut.toLocaleString('id-ID')} L`, pageWidth - marginX - 2.5, curY + 4.2, { align: 'right' });
        curY += 6;

        const ledgerRows = st.rows.map(rw => {
          const cleanRemarks = String(rw.remarks || '').replace(/^(\[RETURN UNIT\]\s*)+/i, '[RETURN UNIT] ');
          return [
            rw.tanggal,
            rw.docOrUnit,
            `${rw.partNumber} — ${rw.partDesc}`,
            rw.qtyIn > 0 ? `+${rw.qtyIn.toLocaleString('id-ID')}` : '-',
            rw.qtyOut > 0 ? `-${rw.qtyOut.toLocaleString('id-ID')}` : '-',
            cleanRemarks
          ];
        });

        ledgerRows.push([
          { content: `SUBTOTAL PERGERAKAN (${st.storageId}):`, colSpan: 3, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
          { content: `+${st.totalIn.toLocaleString('id-ID')} L`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right', textColor: [29, 78, 216] } },
          { content: `-${st.totalOut.toLocaleString('id-ID')} L`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right', textColor: [146, 64, 14] } },
          { content: `${st.rows.length} catatan transaksi`, styles: { fillColor: [241, 245, 249], textColor: [100, 116, 139] } }
        ]);

        doc.autoTable({
          startY: curY,
          margin: { left: marginX, right: marginX, bottom: 16 },
          head: [['Tanggal', 'No. Dokumen / Unit ID', 'Kode & Nama Pelumas', 'Masuk (+)', 'Keluar (-)', 'Keperluan / Keterangan']],
          body: ledgerRows,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.2 },
          headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.2 },
          columnStyles: {
            0: { cellWidth: 21 },
            1: { cellWidth: 36, fontStyle: 'bold' },
            2: { cellWidth: 78 },
            3: { halign: 'right', cellWidth: 20, textColor: [29, 78, 216], fontStyle: 'bold' },
            4: { halign: 'right', cellWidth: 20, textColor: [146, 64, 14], fontStyle: 'bold' }
          }
        });

        curY = doc.lastAutoTable.finalY + 5;
      });
    }

    // ------------------------------------------
    // STEMPEL VERIFIKASI DIGITAL OTOMATIS (HALAMAN AKHIR)
    // ------------------------------------------
    const stampHeight = includeManualSign ? 44 : 18;
    ensureSpace(stampHeight + 4);

    const docHashId = `KTC-LOG-${m.site}-${m.toDate.replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.35);
    doc.roundedRect(marginX, curY, contentWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('DIGITAL SYSTEM VERIFICATION STAMP (NO WET SIGNATURE REQUIRED)', marginX + 3.5, curY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Disusun & Diverifikasi Secara Digital Oleh: ${currentFullName || 'Adi Pranata'} (${currentRole})  |  Project Site: ${m.site}  |  Timestamp: ${m.generatedAt} WIB`,
      marginX + 3.5,
      curY + 9.8
    );
    doc.text(
      `Analysis Engine: ${execAnalysisEngine}  |  Document ID: ${docHashId}`,
      marginX + 3.5,
      curY + 14
    );
    curY += 19;

    if (includeManualSign) {
      const colW = contentWidth / 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text('Dibuat & Diverifikasi Oleh,', marginX + colW * 0.5, curY, { align: 'center' });
      doc.text('Diperiksa Oleh,', marginX + colW * 1.5, curY, { align: 'center' });
      doc.text('Disetujui Oleh,', marginX + colW * 2.5, curY, { align: 'center' });

      curY += 16;
      doc.text(currentFullName || 'Adi Pranata', marginX + colW * 0.5, curY, { align: 'center' });
      doc.text('______________________________', marginX + colW * 1.5, curY, { align: 'center' });
      doc.text('______________________________', marginX + colW * 2.5, curY, { align: 'center' });

      curY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Superadmin & System Lead', marginX + colW * 0.5, curY, { align: 'center' });
      doc.text('Logistics / Plant Superintendent', marginX + colW * 1.5, curY, { align: 'center' });
      doc.text(`Project Manager — Site ${m.site}`, marginX + colW * 2.5, curY, { align: 'center' });
    }

    // ------------------------------------------
    // FOOTER RESMI DI SETIAP HALAMAN (ALA MPS, BEBAS URL WEB)
    // ------------------------------------------
    const totalPages = doc.internal.getNumberOfPages();
    const footerLeftText = 'Generated automatically by AP Systems - LOG Dispense Management System v3.5 | Digital Lubricant & Inventory . Designed & Developed by Adi Pranata';

    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const fy = pageHeight - 7.5;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.line(marginX, fy - 3.5, pageWidth - marginX, fy - 3.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      doc.text(footerLeftText, marginX, fy);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - marginX, fy, { align: 'right' });
    }

    // Nama File Otomatis Satu Garis Bawah: LOG_Monthly_Report_TTLP_Nov_2026.pdf
    const modePrefix = m.reportMode === 'WEEKLY' ? 'Weekly' : 'Monthly';
    const fileName = `LOG_${modePrefix}_Report_${m.site}_${m.refMonth}_${m.refYear}.pdf`;
    doc.save(fileName);

    if (statusLbl) {
      statusLbl.className = "text-xs font-extrabold text-emerald-700";
      statusLbl.innerText = `✓ PDF Downloaded: ${fileName} (${totalPages} Halaman A4 Landscape).`;
    }
  } catch (err) {
    console.error("PDF Generation Error:", err);
    showModalAlert("PDF Error", "Gagal menyusun berkas PDF: " + err.message);
  }
}
