/**
 * 애플리케이션 초기화 및 이벤트 핸들러 — Phase 2
 * 모든 모달/이벤트 바인딩 + Sankey + 카드 상세 패널
 */

(function () {
  const engine = new RuleEngine();
  let sankeyChart = null;
  let currentSankeyMode = 'sw';

  // ─── Data Load Modal ───
  document.getElementById('btn-open-import').addEventListener('click', () => {
    document.getElementById('modal-import').classList.add('active');
  });
  document.getElementById('btn-close-import').addEventListener('click', () => {
    document.getElementById('modal-import').classList.remove('active');
  });

  // DnD + file input
  const dropZone = document.getElementById('excel-drop-zone');
  const fileInput = document.getElementById('excel-upload');
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

  function handleFile(file) {
    if (!file) return;
    ExcelParser.parse(file, () => {
      document.getElementById('import-stats').style.display = 'block';
      document.getElementById('modal-total-docs').innerText = window.Store.documents.length.toLocaleString();
      document.getElementById('target-sw-name').disabled = false;
      document.getElementById('target-sw-type').disabled = false;
      document.getElementById('btn-run-sim').disabled = false;
      UIManager.renderBeforeTree();
      setTimeout(() => document.getElementById('modal-import').classList.remove('active'), 1200);
    });
  }

  // ─── Tab Navigation ───
  document.querySelectorAll('.ptab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
    });
  });

  // ─── All S/W mode toggle ───
  const chkAll = document.getElementById('chk-all-sw');
  chkAll.addEventListener('change', () => {
    const nameInput = document.getElementById('target-sw-name');
    const typeSelect = document.getElementById('target-sw-type');
    if (chkAll.checked) {
      nameInput.disabled = true; nameInput.value = '(전체 S/W 자동)';
      typeSelect.disabled = true;
    } else {
      nameInput.disabled = false; nameInput.value = '';
      typeSelect.disabled = false;
    }
  });

  // ─── Run Simulation ───
  document.getElementById('btn-run-sim').addEventListener('click', () => {
    const docs = window.Store.documents;
    if (!docs.length) { alert('먼저 데이터를 로드하세요.'); return; }
    window.Store.resetSimulation();

    let result;
    if (chkAll.checked) {
      result = engine.runGlobalAll(docs);
    } else {
      const kwVal = document.getElementById('target-sw-name').value.trim();
      const tType = document.getElementById('target-sw-type').value;
      if (!kwVal) { alert('S/W 키워드를 입력하세요.'); return; }
      result = engine.runGlobal(docs, kwVal, tType);
    }

    UIManager.renderAfterTree();
    UIManager.updateSimulationStats(result);
    UIManager.renderCompareView(result);
    UIManager.renderCompareStatsModal(result);

    // Switch to After tab
    document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view-pane').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-target="view-after"]').classList.add('active');
    document.getElementById('view-after').classList.add('active');
  });

  // ─── S/W Modal ───
  document.getElementById('btn-open-sw-list').addEventListener('click', () => {
    UIManager.renderSWListTable();
    document.getElementById('modal-sw-list').classList.add('active');
  });
  document.getElementById('btn-close-sw-list').addEventListener('click', () => {
    document.getElementById('modal-sw-list').classList.remove('active');
  });

  // Add S/W
  document.getElementById('btn-add-sw').addEventListener('click', () => {
    const domain = document.getElementById('add-domain-input').value.trim();
    const swName = document.getElementById('add-sw-input').value.trim();
    const type = document.getElementById('add-type-select').value;
    if (!swName) { alert('S/W명을 입력하세요.'); return; }
    const d = domain || window.Store.getDomains()[0] || '기타';
    window.Store.addSW(d, swName, type);
    document.getElementById('add-domain-input').value = '';
    document.getElementById('add-sw-input').value = '';
    UIManager.renderSWListTable();
  });

  // Expand/Collapse all in SW modal
  document.getElementById('btn-sw-expand-all').addEventListener('click', () => {
    document.querySelectorAll('#sw-table-container .domain-header').forEach(h => {
      h.closest('.sw-table')?.querySelectorAll('tr').forEach(r => r.style.display = '');
    });
    // Folder preview expand
    document.querySelectorAll('.fp-node').forEach(n => n.style.display = 'flex');
  });
  document.getElementById('btn-sw-collapse-all').addEventListener('click', () => {
    // For folder preview, hide level 3+
    document.querySelectorAll('.fp-level-3, .fp-level-4').forEach(n => n.style.display = 'none');
  });

  // ─── Report Modal ───
  document.getElementById('btn-open-report').addEventListener('click', () => {
    const rpt = new ReportEngine();
    document.getElementById('rtab-overview').innerHTML = rpt.renderOverview();
    document.getElementById('rtab-unmigrated').innerHTML = rpt.renderUnmigrated();
    document.getElementById('rtab-structure').innerHTML = rpt.renderStructure();
    document.getElementById('rtab-completed').innerHTML = rpt.renderCompleted();
    document.getElementById('report-footer-info').innerText = `검증일시: ${new Date().toLocaleString('ko-KR')}`;
    document.getElementById('modal-report').classList.add('active');
  });
  document.getElementById('btn-close-report').addEventListener('click', () => document.getElementById('modal-report').classList.remove('active'));
  document.getElementById('btn-close-report-bottom').addEventListener('click', () => document.getElementById('modal-report').classList.remove('active'));
  document.getElementById('btn-report-csv').addEventListener('click', () => new ReportEngine().exportCSV());

  // Report tabs
  document.querySelectorAll('.report-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.report-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.rtab).classList.add('active');
    });
  });

  // ─── Compare Stats Modal ───
  document.addEventListener('click', e => {
    if (e.target.id === 'btn-open-compare-stats' || e.target.closest('#btn-open-compare-stats')) {
      document.getElementById('modal-compare-stats').classList.add('active');
    }
    if (e.target.id === 'btn-close-compare-stats') {
      document.getElementById('modal-compare-stats').classList.remove('active');
    }
  });

  // ─── Flow Modal (Sankey) ───
  function openFlowModal() {
    if (!window.Store.lastSimResult) { alert('먼저 시뮬레이션을 실행하세요.'); return; }
    document.getElementById('modal-flow').classList.add('active');
    sankeyChart = new SankeyChart('sankey-canvas');
    renderSankey(currentSankeyMode);
  }

  function renderSankey(mode) {
    if (!sankeyChart) return;
    currentSankeyMode = mode;
    const docs = window.Store.documents;
    const flows = mode === 'category'
      ? SankeyChart.buildCategoryFlows(docs)
      : SankeyChart.buildSWFlows(docs);
    sankeyChart.render(flows, mode);
  }

  document.getElementById('btn-open-flow').addEventListener('click', openFlowModal);
  document.addEventListener('click', e => {
    if (e.target.id === 'btn-open-flow-from-compare' || e.target.closest('#btn-open-flow-from-compare')) {
      openFlowModal();
    }
  });
  document.getElementById('btn-close-flow').addEventListener('click', () => {
    document.getElementById('modal-flow').classList.remove('active');
  });

  // Sankey tabs
  document.querySelectorAll('.sankey-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sankey-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderSankey(tab.dataset.smode);
    });
  });

  // ─── Card click → Detail Panel ───
  document.addEventListener('click', e => {
    const card = e.target.closest('.sw-card');
    if (!card) return;
    const type = card.dataset.cardType;
    if (type === 'asis') {
      UIManager.showCardDetail('asis', { d0: card.dataset.d0, d1: card.dataset.d1 });
    } else if (type === 'tobe') {
      UIManager.showCardDetail('tobe', { sw: card.dataset.sw });
    }
  });
  document.getElementById('btn-close-detail').addEventListener('click', () => {
    document.getElementById('detail-panel').classList.remove('open');
  });

  // ─── Tree toggle (expand/collapse) ───
  document.addEventListener('click', e => {
    const toggle = e.target.closest('.tree-toggle');
    if (!toggle) return;
    const treeItem = toggle.closest('.tree-item');
    if (!treeItem) return;
    const children = treeItem.querySelector('.tree-children');
    if (!children) return;
    if (children.classList.contains('collapsed')) {
      children.classList.remove('collapsed');
      toggle.textContent = '▼';
    } else {
      children.classList.add('collapsed');
      toggle.textContent = '▶';
    }
  });

  // Domain group card toggle
  document.addEventListener('click', e => {
    const dg = e.target.closest('[data-dgcard]');
    if (!dg) return;
    const body = dg.nextElementSibling;
    if (!body) return;
    body.classList.toggle('collapsed');
  });

  // Accordion toggle in Report
  document.addEventListener('click', e => {
    const accH = e.target.closest('[data-accordion]');
    if (!accH) return;
    const body = accH.nextElementSibling;
    if (!body) return;
    body.classList.toggle('open');
    const icon = accH.querySelector('.acc-toggle');
    if (icon) icon.textContent = body.classList.contains('open') ? '▼' : '▶';
  });

  // ─── Expand/Collapse All (Before/After trees) ───
  document.addEventListener('click', e => {
    if (e.target.id === 'btn-before-expand' || e.target.id === 'btn-after-expand') {
      const container = e.target.closest('.view-pane');
      container.querySelectorAll('.tree-children.collapsed').forEach(c => c.classList.remove('collapsed'));
      container.querySelectorAll('.tree-toggle').forEach(t => { if (t.textContent === '▶') t.textContent = '▼'; });
    }
    if (e.target.id === 'btn-before-collapse' || e.target.id === 'btn-after-collapse') {
      const container = e.target.closest('.view-pane');
      container.querySelectorAll('.tree-children').forEach(c => c.classList.add('collapsed'));
      container.querySelectorAll('.tree-toggle').forEach(t => { if (t.textContent === '▼') t.textContent = '▶'; });
    }
  });

  // Editable folder names
  document.addEventListener('click', e => {
    if (e.target.closest('.btn-icon') && e.target.closest('.btn-icon').title === '폴더명 수정') {
      const nameSpan = e.target.closest('.tree-row').querySelector('.editable-name');
      if (!nameSpan) return;
      const orig = nameSpan.dataset.orig;
      const currentVal = nameSpan.textContent;
      const input = document.createElement('input');
      input.className = 'edit-input';
      input.value = currentVal;
      nameSpan.replaceWith(input);
      input.focus(); input.select();
      const commit = () => {
        const newVal = input.value.trim() || currentVal;
        if (newVal !== currentVal) window.Store.folderRenames.set(orig, newVal);
        const span = document.createElement('span');
        span.className = 'tree-name editable-name';
        span.dataset.orig = orig;
        span.textContent = newVal;
        input.replaceWith(span);
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', ev => { if (ev.key === 'Enter') input.blur(); if (ev.key === 'Escape') { input.value = currentVal; input.blur(); } });
    }
  });

  // ─── Export ───
  document.getElementById('btn-export-excel').addEventListener('click', () => UIManager.exportToExcel());

})();
