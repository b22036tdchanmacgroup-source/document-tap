/**
 * 애플리케이션 초기화 및 이벤트 핸들러 — Phase 2
 * 모든 모달/이벤트 바인딩 + Sankey + 카드 상세 패널
 */

(function () {
  const engine = new RuleEngine();

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
      document.getElementById('target-sw-select').disabled = false;
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
    const swSelect = document.getElementById('target-sw-select');
    if (chkAll.checked) {
      swSelect.disabled = true; swSelect.value = 'ALL';
    } else {
      swSelect.disabled = false;
    }
  });

  // ─── Run Simulation ───
  document.getElementById('btn-run-sim').addEventListener('click', () => {
    const docs = window.Store.documents;
    if (!docs.length) { alert('먼저 데이터를 로드하세요.'); return; }
    window.Store.resetSimulation();

    const targetVal = document.getElementById('target-sw-select').value;
    let filterOptions = { mode: 'all' };

    if (!chkAll.checked && targetVal !== 'ALL') {
      const [type, val] = targetVal.split('|');
      if (type === 'DOMAIN') {
        filterOptions = { mode: 'domain', value: val };
      } else if (type === 'SW') {
        filterOptions = { mode: 'sw', value: val };
      } else if (type === 'NOSW') {
        filterOptions = { mode: 'nosw' };
      }
    }

    const result = engine.runSimulation(docs, filterOptions);

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

  // ─── Visual Map Modal ───
  document.getElementById('btn-open-visual-map').addEventListener('click', () => {
    UIManager.renderVisualMap();
    document.getElementById('modal-visual-map').classList.add('active');
  });
  document.getElementById('btn-close-visual-map').addEventListener('click', () => {
    document.getElementById('modal-visual-map').classList.remove('active');
  });
  document.getElementById('btn-open-visual-map-from-main')?.addEventListener('click', () => {
    // 혹시 메인화면에도 버튼을 둔다면... (현재는 S/W 리스트 모달에만 있음)
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
    UIManager.renderTargetSWSelect();
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

  // ─── Rule Builder Modal ───
  document.getElementById('btn-open-rule-list').addEventListener('click', () => {
    UIManager.renderRuleListTable();
    document.getElementById('modal-rules').classList.add('active');
  });
  document.getElementById('btn-close-rules').addEventListener('click', () => {
    document.getElementById('modal-rules').classList.remove('active');
  });

  document.getElementById('btn-add-rule').addEventListener('click', () => {
    const desc = document.getElementById('add-rule-desc').value.trim();
    const field = document.getElementById('add-rule-field').value;
    const op = document.getElementById('add-rule-op').value;
    const val = document.getElementById('add-rule-val').value.trim();
    const swName = document.getElementById('add-rule-sw').value;
    const category = document.getElementById('add-rule-cat').value;

    if (!val) { alert('조건 문자열을 입력하세요.'); return; }
    
    const newRule = {
      id: 'rule_' + Date.now(),
      enabled: true,
      description: desc || '사용자 지정 규칙',
      condition: { field, operator: op, value: val },
      target: { swName, category }
    };
    
    window.Store.addRule(newRule);
    UIManager.renderRuleListTable();
    
    document.getElementById('add-rule-desc').value = '';
    document.getElementById('add-rule-val').value = '';
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




  // ─── Flow Modal (부서별 이관 내역) ───
  function openFlowModal() {
    if (!window.Store.lastSimResult) { alert('먼저 시뮬레이션을 실행하세요.'); return; }
    document.getElementById('modal-flow').classList.add('active');
    UIManager.renderDeptFlowSummary();
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
    const row = e.target.closest('.tree-row.is-folder');
    if (!row) return;
    
    // ✏️ 편집 버튼 클릭 시에는 토글 무시
    if (e.target.closest('.btn-icon')) return;

    const treeItem = row.closest('.tree-item');
    if (!treeItem) return;
    const children = treeItem.querySelector('.tree-children');
    if (!children) return;
    
    const toggle = row.querySelector('.tree-toggle');
    if (children.classList.contains('collapsed')) {
      children.classList.remove('collapsed');
      if (toggle) toggle.textContent = '▼';
    } else {
      children.classList.add('collapsed');
      if (toggle) toggle.textContent = '▶';
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



  // Dept flow card accordion toggle
  document.addEventListener('click', e => {
    const header = e.target.closest('[data-dept-toggle]');
    if (!header) return;
    const body = header.nextElementSibling;
    if (!body) return;
    body.classList.toggle('open');
    const icon = header.querySelector('.dfl-name span');
    if (icon) icon.textContent = body.classList.contains('open') ? '▼' : '▶';
  });

  // ─── Compare View Mode Toggle (Card ↔ Visual Tab) ───
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-compare-mode]');
    if (!btn) return;
    const mode = btn.dataset.compareMode;
    document.querySelectorAll('.compare-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const cardView = document.getElementById('compare-content');
    const vtabView = document.getElementById('compare-visual-tab');
    if (!cardView || !vtabView) return;

    if (mode === 'card') {
      // Show card view, hide visual tab
      const splitEl = cardView.querySelector('.compare-split');
      if (splitEl) splitEl.style.display = 'flex';
      vtabView.style.display = 'none';
    } else {
      // Show visual tab, hide card grid
      const splitEl = cardView.querySelector('.compare-split');
      if (splitEl) splitEl.style.display = 'none';
      vtabView.style.display = 'block';
      // Get current dept filter
      const deptFilter = document.getElementById('compare-dept-filter');
      const dept = deptFilter ? deptFilter.value : 'ALL';
      UIManager.renderCompareVisualTab(dept);
    }
  });

  // ─── Visual Tab internal tab switching ───
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-vtab-group]');
    if (!tab) return;
    const group = tab.dataset.vtabGroup;
    const idx = tab.dataset.vtabIdx;
    // Deactivate sibling tabs
    document.querySelectorAll(`[data-vtab-group="${group}"]`).forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    // Toggle bodies
    document.querySelectorAll(`[data-vtab-body="${group}"]`).forEach(b => {
      b.classList.remove('active');
      if (b.dataset.vtabIdx === idx) b.classList.add('active');
    });
  });

  // ─── Visual Tab dept card toggle (AS-IS side) ───
  document.addEventListener('click', e => {
    const header = e.target.closest('[data-vtab-dept]');
    if (!header) return;
    const targetId = header.dataset.vtabDept;
    const body = document.getElementById(targetId);
    if (!body) return;
    body.classList.toggle('open');
  });

  // ─── Compare dept filter → also update visual tab ───
  document.addEventListener('change', e => {
    if (e.target.id === 'compare-dept-filter') {
      const selectedDept = e.target.value;
      if (window.Store.lastSimResult) {
        UIManager.renderCompareView(window.Store.lastSimResult, selectedDept);
        // If visual tab is visible, re-render it too
        const vtabView = document.getElementById('compare-visual-tab');
        if (vtabView && vtabView.style.display !== 'none') {
          UIManager.renderCompareVisualTab(selectedDept);
        }
      }
    }
  });

  // Init UI
  UIManager.renderTargetSWSelect();
  UIManager.initResizer();

})();
