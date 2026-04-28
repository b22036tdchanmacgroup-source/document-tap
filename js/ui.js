/**
 * UI 매니저 — Phase 2
 * 카드 기반 비교뷰, 넘버링 부여, S/W 모달 편집+미리보기, 상세 패널
 */

class UIManager {

  // ─── Before Tree ───
  static buildTreeDataBefore(documents) {
    const root = { name: "전사 부서 트리", children: {}, count: 0, files: [] };
    documents.forEach(doc => {
      if (doc.isAttachment) return;
      let path = [doc.original.d0, doc.original.d1, doc.original.d2, doc.original.d3].filter(x => x);
      let cur = root; cur.count++;
      path.forEach(p => {
        if (!cur.children[p]) cur.children[p] = { name: p, children: {}, count: 0, files: [] };
        cur = cur.children[p]; cur.count++;
      });
      cur.files.push({ fileName: doc.fileName, id: doc.id });
    });
    return root;
  }

  // ─── After Tree (with numbering: 1,2,3 / A,B,C / A-1,A-2) ───
  static buildTreeDataAfter(documents) {
    const root = { name: "S/W 중심 하이브리드 트리", children: {}, count: 0, files: [] };
    
    // nosw 모드 감지: no_sw 문서가 있고 matched가 없으면 nosw 모드
    const hasNoSw = documents.some(d => !d.isAttachment && d.simulation.status === 'no_sw');
    const hasMatched = documents.some(d => !d.isAttachment && d.simulation.status === 'matched');
    const isNoSwView = hasNoSw && !hasMatched;
    
    if (isNoSwView) {
      root.name = "⚠️ S/W 미매칭 문서 (원본 부서 기준)";
    }
    
    documents.forEach(doc => {
      if (doc.isAttachment) return;
      
      if (isNoSwView) {
        // nosw 모드: no_sw 문서를 원본 경로 기준으로 표시
        if (doc.simulation.status !== 'no_sw') return;
        let path = [doc.original.d0, doc.original.d1, doc.original.d2].filter(x => x);
        let cur = root; cur.count++;
        path.forEach((p, i) => {
          if (!cur.children[p]) {
            cur.children[p] = { name: p, originalName: p, children: {}, count: 0, files: [], level: i + 1 };
          }
          cur = cur.children[p]; cur.count++;
        });
        cur.files.push({
          fileName: doc.fileName, id: doc.id,
          status: 'no_sw',
          originalPath: [doc.original.d0, doc.original.d1, doc.original.d2].filter(x => x).join(' > '),
          originalD0: doc.original.d0 || ''
        });
      } else {
        // 정상 모드: matched/unclassified만 표시
        if (doc.simulation.status === 'excluded' || doc.simulation.status === 'pending' || doc.simulation.status === 'no_sw') return;
        if (!doc.simulation.newPath) return;
        const np = doc.simulation.newPath;
        let path = [np.swName, np.d1_category, np.d2_subcat];
        if (np.d3_detail) path.push(np.d3_detail);
        path = path.filter(x => x);
        let cur = root; cur.count++;
        path.forEach((p, i) => {
          const renames = window.Store.folderRenames;
          const displayP = renames.get(p) || p;
          if (!cur.children[displayP]) {
            cur.children[displayP] = { name: displayP, originalName: p, children: {}, count: 0, files: [], level: i + 1 };
          }
          cur = cur.children[displayP]; cur.count++;
        });
        cur.files.push({
          fileName: doc.fileName, id: doc.id,
          status: doc.simulation.status,
          originalPath: np.originalPath || '',
          originalD0: np.originalD0 || ''
        });
      }
    });
    // Apply numbering to children
    if (!isNoSwView) this._applyNumbering(root, 0);
    return root;
  }

  /**
   * 재귀적으로 넘버링 부여
   * Level 1: 없음 (분야:S/W명 그대로)
   * Level 2: 1,2,3...Z
   * Level 3: A,B,C...
   * Level 4: A-1,A-2,B-1...
   */
  static _applyNumbering(node, level) {
    const children = Object.keys(node.children);
    if (children.length === 0) return;

    const sorted = children.sort();

    sorted.forEach((key, idx) => {
      const child = node.children[key];
      // Always use originalName as base to prevent double-numbering
      const origName = child.originalName || child.name;
      // Strip ALL existing numbering prefixes from original data:
      // Patterns: "A-1.", "A-1 ", "A.", "A ", "1.", "1 ", "C_", "D.C_" etc.
      const cleanName = origName
        .replace(/^[A-Z](?:-\d+)?[.\s_]+/i, '')  // A-1. A-1 A. A_ etc
        .replace(/^D\.[A-Z]_/i, '')               // D.C_ style
        .replace(/^\d+[.\s_]+/, '')               // 1. 2. etc
        .trim() || origName;

      if (level === 2) {
        // 3단계: A, B, C...
        const letter = String.fromCharCode(65 + idx);
        child.name = `${letter}.${cleanName}`;
      } else if (level === 3) {
        // 4단계: 부모 letter + "-" + 순번
        const pLetter = node.name.match(/^([A-Z])\./)?.[1] || 'X';
        child.name = `${pLetter}-${idx + 1}.${cleanName}`;
      }

      this._applyNumbering(child, level + 1);
    });
  }

  // ─── Tree HTML 렌더링 ───
  static renderTreeHTML(node, level = 0, opts = {}) {
    const defaults = { showFiles: true, showOrigin: false, editable: false };
    opts = { ...defaults, ...opts };
    let html = '';
    const isRoot = level === 0;
    const hasChildren = Object.keys(node.children).length > 0;
    const hasFiles = opts.showFiles && node.files && node.files.length > 0;
    const isExpandable = hasChildren || hasFiles;
    const isExpanded = level <= 1;

    if (!isRoot) {
      const pad = (level - 1) * 20;
      const toggleIcon = isExpandable ? (isExpanded ? '▼' : '▶') : '·';
      const isFolder = isExpandable;
      html += `<div class="tree-item" style="padding-left:${pad}px">`;
      html += `<div class="tree-row ${isFolder ? 'is-folder' : 'is-file'}" data-id="${node.id || ''}" data-type="${isFolder ? 'folder' : 'file'}">`;
      html += `<span class="tree-toggle">${toggleIcon}</span>`;
      html += `<span class="tree-folder-icon">${isFolder ? '📁' : '📄'}</span>`;
      if (opts.editable) {
        html += `<span class="tree-name editable-name" data-orig="${this._esc(node.originalName || node.name)}">${this._esc(node.name)}</span>`;
        html += `<button class="btn-icon" title="폴더명 수정">✏️</button>`;
      } else {
        html += `<span class="tree-name">${this._esc(node.name)}</span>`;
      }
      html += `<span class="tree-count">${node.count}건</span>`;
      html += `</div>`;
      html += `<div class="tree-children${isExpanded ? '' : ' collapsed'}">`;
    }

    const sortedKeys = Object.keys(node.children).sort();
    sortedKeys.forEach(key => {
      html += this.renderTreeHTML(node.children[key], level + 1, opts);
    });

    if (hasFiles) {
      const maxShow = 80;
      node.files.slice(0, maxShow).forEach(f => {
        const pad = level * 20;
        html += `<div class="tree-file-item" style="padding-left:${pad}px">`;
        html += `<span class="tree-file-icon">📄</span>`;
        html += `<span class="tree-file-name" title="${this._esc(f.fileName)}">${this._esc(f.fileName)}</span>`;
        if (f.status === 'matched') html += `<span class="badge badge-matched">매칭</span>`;
        else if (f.status === 'unclassified') html += `<span class="badge badge-unclassified">미분류</span>`;
        if (opts.showOrigin && f.originalPath) {
          html += `<span class="origin-tag" title="${this._esc(f.originalPath)}">← ${this._esc(f.originalPath)}</span>`;
        }
        html += `</div>`;
      });
      if (node.files.length > maxShow) {
        html += `<div class="tree-file-item" style="padding-left:${level * 20}px;color:var(--text3);font-style:italic;">···외 ${node.files.length - maxShow}건</div>`;
      }
    }

    if (!isRoot) { html += `</div></div>`; }
    return html;
  }

  static renderBeforeTree() {
    const c = document.getElementById('before-tree');
    const e = document.getElementById('before-empty');
    if (!c || !window.Store.documents.length) return;
    e.style.display = 'none'; c.style.display = 'block';
    c.innerHTML = `<div class="tree-controls"><button class="btn btn-sm btn-dark-outline" id="btn-before-expand">📂 모두 펼치기</button><button class="btn btn-sm btn-dark-outline" id="btn-before-collapse">📁 모두 접기</button></div>` +
      this.renderTreeHTML(this.buildTreeDataBefore(window.Store.documents), 0, { showFiles: true });
  }

  static renderAfterTree() {
    const c = document.getElementById('after-tree');
    const e = document.getElementById('after-empty');
    if (!c || !window.Store.documents.length) return;
    e.style.display = 'none'; c.style.display = 'block';
    c.innerHTML = `<div class="tree-controls"><button class="btn btn-sm btn-dark-outline" id="btn-after-expand">📂 모두 펼치기</button><button class="btn btn-sm btn-dark-outline" id="btn-after-collapse">📁 모두 접기</button></div>` +
      this.renderTreeHTML(this.buildTreeDataAfter(window.Store.documents), 0, { showFiles: true, showOrigin: true, editable: true });
  }

  // ─── 비교 뷰: 카드 그리드 (부서 관점 필터링 추가) ───
  static renderCompareView(result, targetDept = 'ALL') {
    const c = document.getElementById('compare-content');
    const e = document.getElementById('compare-empty');
    if (!c) return;
    e.style.display = 'none'; c.style.display = 'block';

    const docs = window.Store.documents;
    
    // 전체 D0(부서) 목록 추출
    const allDepts = [...new Set(docs.filter(d => !d.isAttachment).map(d => d.original.d0 || '기타'))].sort();

    // 1. 문서 필터링 (부서 선택 시 해당 부서 문서만)
    let filteredDocs = docs;
    if (targetDept !== 'ALL') {
      filteredDocs = docs.filter(d => d.original.d0 === targetDept || (d.original.d0 || '기타') === targetDept);
    }
    
    const filteredMain = filteredDocs.filter(d => !d.isAttachment);
    const totalMain = filteredMain.length;
    let migrated = 0;
    filteredMain.forEach(d => { if(d.simulation.status === 'matched' || d.simulation.status === 'unclassified') migrated++; });
    const migrationRate = totalMain > 0 ? ((migrated / totalMain) * 100).toFixed(1) : '0';

    // AS-IS: group by D0 → D1
    const asisGroups = {};
    filteredMain.forEach(doc => {
      const d0 = doc.original.d0 || '기타';
      const d1 = doc.original.d1 || '기타';
      if (!asisGroups[d0]) asisGroups[d0] = { total: 0, subs: {} };
      asisGroups[d0].total++;
      if (!asisGroups[d0].subs[d1]) asisGroups[d0].subs[d1] = 0;
      asisGroups[d0].subs[d1]++;
    });

    // TO-BE: group by domain → swName
    const tobeGroups = {};
    filteredMain.forEach(doc => {
      if (doc.simulation.status !== 'matched' && doc.simulation.status !== 'unclassified') return;
      const domain = doc.simulation.newPath?.swDomain || '기타';
      const swName = doc.simulation.newPath?.swName || '미분류';
      if (!tobeGroups[domain]) tobeGroups[domain] = { total: 0, sws: {} };
      tobeGroups[domain].total++;
      if (!tobeGroups[domain].sws[swName]) tobeGroups[domain].sws[swName] = 0;
      tobeGroups[domain].sws[swName]++;
    });

    let html = `<div class="compare-full">`;

    // Toolbar (부서 필터 드롭다운 추가)
    html += `<div class="compare-toolbar">`;
    html += `<div style="display:flex; align-items:center; gap:12px;">`;
    html += `<select id="compare-dept-filter" class="input-select" style="width:200px; padding:4px;">`;
    html += `<option value="ALL" ${targetDept === 'ALL' ? 'selected' : ''}>🌍 전사 통합 보기</option>`;
    allDepts.forEach(dept => {
      html += `<option value="${this._esc(dept)}" ${targetDept === dept ? 'selected' : ''}>📂 ${this._esc(dept)} 관점</option>`;
    });
    html += `</select>`;
    html += `<div><strong>기준 문서:</strong> ${totalMain.toLocaleString()}건 · <strong>이관:</strong> ${migrated.toLocaleString()}건 · <strong>이관율:</strong> <span style="color:var(--sage-d);font-weight:800;">${migrationRate}%</span></div>`;
    html += `</div>`;
    html += `<div class="toolbar-btns">`;
    html += `<div class="compare-mode-toggle">`;
    html += `<button class="compare-mode-btn active" data-compare-mode="card">📊 카드 보기</button>`;
    html += `<button class="compare-mode-btn" data-compare-mode="vtab">🗂️ 시각적 탭보기</button>`;
    html += `</div>`;
    html += `<button class="btn btn-sm btn-dark-outline" id="btn-open-compare-stats">📊 전체 통계</button>`;
    html += `<button class="btn btn-sm btn-dark-outline" id="btn-open-flow-from-compare">🔄 문서 흐름</button>`;
    html += `</div></div>`;

    // Split view
    html += `<div class="compare-split">`;

    // ─ AS-IS side ─
    html += `<div class="compare-half">`;
    html += `<div class="compare-half-title">📂 AS-IS 현행 문서 체계 <span class="tag tag-asis">Before</span></div>`;
    if (totalMain === 0) {
      html += `<div class="empty-state" style="min-height:200px;">해당 부서에 문서가 없습니다.</div>`;
    } else {
      Object.entries(asisGroups).sort((a, b) => b[1].total - a[1].total).forEach(([d0, group]) => {
        html += `<div class="domain-group-card">`;
        html += `<div class="domain-group-header" data-dgcard><span class="dg-name">📂 ${this._esc(d0)}</span><span class="dg-count">${group.total.toLocaleString()}건</span></div>`;
        html += `<div class="domain-group-body">`;
        Object.entries(group.subs).sort((a, b) => b[1] - a[1]).forEach(([d1, cnt]) => {
          html += `<div class="sw-card asis" data-card-type="asis" data-d0="${this._esc(d0)}" data-d1="${this._esc(d1)}">`;
          html += `<div class="sw-card-name" title="${this._esc(d1)}">${this._esc(d1)}</div>`;
          html += `<div class="sw-card-count">${cnt.toLocaleString()}</div>`;
          html += `<div class="sw-card-label">포함 문서</div>`;
          html += `</div>`;
        });
        html += `</div></div>`;
      });
    }
    html += `</div>`;

    // ─ TO-BE side ─
    html += `<div class="compare-half">`;
    html += `<div class="compare-half-title">🎯 TO-BE S/W 중심 분류 <span class="tag tag-tobe">After</span></div>`;
    if (Object.keys(tobeGroups).length === 0) {
      html += `<div class="empty-state" style="min-height:200px;">이관된 문서가 없습니다.</div>`;
    } else {
      Object.entries(tobeGroups).sort((a, b) => b[1].total - a[1].total).forEach(([domain, group]) => {
        const swCount = Object.keys(group.sws).length;
        html += `<div class="domain-group-card">`;
        html += `<div class="domain-group-header" data-dgcard><span class="dg-name">📦 ${this._esc(domain)}</span><span class="dg-count">${swCount}개 S/W · ${group.total.toLocaleString()}건</span></div>`;
        html += `<div class="domain-group-body">`;
        Object.entries(group.sws).sort((a, b) => b[1] - a[1]).forEach(([swName, cnt]) => {
          const shortName = swName.includes(':') ? swName.split(':')[1] : swName;
          html += `<div class="sw-card tobe" data-card-type="tobe" data-sw="${this._esc(swName)}">`;
          html += `<div class="sw-card-name" title="${this._esc(swName)}">${this._esc(shortName)}</div>`;
          html += `<div class="sw-card-count">${cnt.toLocaleString()}</div>`;
          html += `<div class="sw-card-label">이관 됨</div>`;
          html += `</div>`;
        });
        html += `</div></div>`;
      });
    }
    html += `</div>`;

    html += `</div></div>`; // close compare-split, compare-full
    c.innerHTML = html;
  }

  // ─── 상세 통계 모달 렌더 ───
  static renderCompareStatsModal(result) {
    const body = document.getElementById('compare-stats-body');
    if (!body) return;

    const docs = window.Store.documents;
    const totalMain = docs.filter(d => !d.isAttachment).length;
    const migrated = result.matched + result.unclassified;
    const rate = totalMain > 0 ? ((migrated / totalMain) * 100).toFixed(1) : '0';

    let html = '';
    // Summary
    html += `<div class="summary-cards">`;
    html += `<div class="summary-card card-blue"><div class="sc-value">${totalMain.toLocaleString()}</div><div class="sc-label">전체 문서</div></div>`;
    html += `<div class="summary-card card-sage"><div class="sc-value">${result.matched.toLocaleString()}</div><div class="sc-label">자동 매칭</div></div>`;
    html += `<div class="summary-card card-terra"><div class="sc-value">${result.unclassified.toLocaleString()}</div><div class="sc-label">미분류</div></div>`;
    html += `<div class="summary-card card-green"><div class="sc-value">${rate}%</div><div class="sc-label">이관율</div></div>`;
    html += `</div>`;

    // Progress
    html += `<div class="progress-label"><span>이관 진행률</span><span>${rate}%</span></div>`;
    html += `<div class="progress-bar-container"><div class="progress-bar-fill-inner fill-sage" style="width:${rate}%"></div></div>`;

    // Category distribution
    const catDist = {};
    docs.forEach(doc => {
      if (doc.isAttachment) return;
      if (doc.simulation.status !== 'matched' && doc.simulation.status !== 'unclassified') return;
      const cat = doc.simulation.newPath?.d1_category || '미분류';
      catDist[cat] = (catDist[cat] || 0) + 1;
    });

    html += `<div style="margin-top:24px;"><strong>📊 카테고리별 분포</strong></div>`;
    const maxCat = Math.max(...Object.values(catDist), 1);
    const colors = ['fill-d1', 'fill-d2', 'fill-d3', 'fill-d4'];
    let ci = 0;
    Object.entries(catDist).sort((a, b) => b[1] - a[1]).forEach(([cat, cnt]) => {
      const pct = ((cnt / maxCat) * 100).toFixed(0);
      html += `<div class="dist-bar"><div class="dist-label">${this._esc(cat)}</div>`;
      html += `<div class="dist-bar-track"><div class="dist-bar-fill ${colors[ci % 4]}" style="width:${pct}%">${cnt}</div></div>`;
      html += `<div class="dist-count">${cnt}건</div></div>`;
      ci++;
    });

    // Flow table
    const flowMap = {};
    docs.forEach(doc => {
      if (doc.isAttachment) return;
      if (doc.simulation.status !== 'matched' && doc.simulation.status !== 'unclassified') return;
      const d0 = doc.original.d0 || '기타';
      const cat = doc.simulation.newPath?.d1_category || '미분류';
      const key = `${d0}|||${cat}`;
      flowMap[key] = (flowMap[key] || 0) + 1;
    });
    const flowEntries = Object.entries(flowMap).map(([k, v]) => { const [s, d] = k.split('|||'); return { s, d, v }; }).sort((a, b) => b.v - a.v).slice(0, 20);

    if (flowEntries.length > 0) {
      html += `<div style="margin-top:24px;"><strong>🔄 문서 이관 흐름 Top 20</strong></div>`;
      html += `<table class="flow-table"><thead><tr><th>원본 (D0)</th><th></th><th>신규 카테고리</th><th>문서 수</th></tr></thead><tbody>`;
      flowEntries.forEach(f => {
        html += `<tr><td>${this._esc(f.s)}</td><td>→</td><td>${this._esc(f.d)}</td><td class="num-col">${f.v}</td></tr>`;
      });
      html += `</tbody></table>`;
    }

    body.innerHTML = html;
  }

  // ─── Card Detail Panel ───
  static showCardDetail(type, data) {
    const panel = document.getElementById('detail-panel');
    const title = document.getElementById('dp-title');
    const content = document.getElementById('dp-content');
    if (!panel || !content) return;

    const docs = window.Store.documents;
    let html = '';

    if (type === 'asis') {
      title.textContent = `📂 ${data.d0} > ${data.d1}`;
      const filtered = docs.filter(d => !d.isAttachment && d.original.d0 === data.d0 && d.original.d1 === data.d1);

      // Folder tree
      html += `<div style="margin-bottom:12px;font-size:12px;color:var(--text2);">총 <strong>${filtered.length}</strong>건</div>`;
      // Mini tree by d2
      const byD2 = {};
      filtered.forEach(d => {
        const d2 = d.original.d2 || '기타';
        if (!byD2[d2]) byD2[d2] = [];
        byD2[d2].push(d);
      });

      Object.entries(byD2).sort((a, b) => b[1].length - a[1].length).forEach(([d2, files]) => {
        html += `<div style="margin-bottom:8px;">`;
        html += `<div style="font-size:12px;font-weight:600;">📁 ${this._esc(d2)} <span style="color:var(--text3);">${files.length}건</span></div>`;
        files.slice(0, 30).forEach(f => {
          html += `<div class="file-list-item"><span class="tree-file-icon">📄</span><span class="file-name">${this._esc(f.fileName)}</span></div>`;
        });
        if (files.length > 30) html += `<div style="color:var(--text3);font-size:11px;">...외 ${files.length - 30}건</div>`;
        html += `</div>`;
      });
    } else if (type === 'tobe') {
      title.textContent = `🎯 ${data.sw}`;
      const filtered = docs.filter(d => !d.isAttachment && d.simulation.newPath?.swName === data.sw);

      html += `<div style="margin-bottom:12px;font-size:12px;color:var(--text2);">총 <strong>${filtered.length}</strong>건 이관</div>`;

      // By category
      const byCat = {};
      filtered.forEach(d => {
        const cat = d.simulation.newPath?.d1_category || '미분류';
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push(d);
      });

      Object.entries(byCat).sort().forEach(([cat, files]) => {
        html += `<div style="margin-bottom:8px;">`;
        html += `<div style="font-size:12px;font-weight:600;">📁 ${this._esc(cat)} <span style="color:var(--text3);">${files.length}건</span></div>`;
        files.slice(0, 20).forEach(f => {
          html += `<div class="file-list-item"><span class="tree-file-icon">📄</span><span class="file-name">${this._esc(f.fileName)}</span>`;
          if (f.simulation.newPath?.originalD0) {
            html += `<span class="origin-tag">← ${this._esc(f.simulation.newPath.originalD0)}</span>`;
          }
          html += `</div>`;
        });
        if (files.length > 20) html += `<div style="color:var(--text3);font-size:11px;">...외 ${files.length - 20}건</div>`;
        html += `</div>`;
      });
    }

    content.innerHTML = html;
    panel.classList.add('open');
  }

  // ─── S/W 리스트 테이블 (편집 가능 + 미리보기) ───
  static renderSWListTable() {
    const container = document.getElementById('sw-table-container');
    if (!container) return;

    const swList = window.Store.swList;
    const domains = window.Store.getDomains();
    const typeNames = { A: '엔지니어링', B: 'GIS·데이터', C: '시각화·서비스', D: '그래픽·엔진', None: '제외' };

    let html = `<table class="sw-table"><thead><tr>
      <th style="width:20%">분야</th>
      <th style="width:25%">S/W명</th>
      <th style="width:15%">유형</th>
      <th style="width:20%">키워드</th>
      <th style="width:10%">변경</th>
      <th style="width:10%">작업</th>
    </tr></thead><tbody>`;

    let prevDomain = '';
    swList.forEach((sw, idx) => {
      const showDomain = sw.domain !== prevDomain;
      prevDomain = sw.domain;
      const rowClass = sw.isExcluded ? 'row-excluded' : '';
      const tc = sw.type.toLowerCase();

      if (showDomain) {
        html += `<tr><td colspan="6" class="domain-header">📦 ${this._esc(sw.domain)} <button class="btn-danger btn-delete-domain" data-domain="${this._esc(sw.domain)}">분야 삭제</button></td></tr>`;
      }

      html += `<tr class="${rowClass}" data-sw-idx="${idx}">`;
      html += `<td></td>`;
      html += `<td><span class="sw-editable-name" data-idx="${idx}">${this._esc(sw.swName)}</span></td>`;
      html += `<td><span class="sw-type-badge type-${tc === 'none' ? 'none' : tc}">${sw.type} (${typeNames[sw.type] || ''})</span></td>`;
      html += `<td style="font-size:10px;color:var(--text3);">${sw.keywords.slice(0, 3).join(', ')}${sw.keywords.length > 3 ? '...' : ''}</td>`;
      html += `<td><select class="sw-type-select" data-idx="${idx}">`;
      ['A', 'B', 'C', 'D', 'None'].forEach(t => {
        html += `<option value="${t}" ${sw.type === t ? 'selected' : ''}>${t}</option>`;
      });
      html += `</select></td>`;
      html += `<td><button class="btn-danger btn-delete-sw" data-idx="${idx}">삭제</button></td>`;
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Bind events
    container.querySelectorAll('.sw-type-select').forEach(sel => {
      sel.addEventListener('change', e => {
        const idx = parseInt(e.target.dataset.idx);
        window.Store.updateSW(idx, 'type', e.target.value);
        this.renderSWListTable();
        this._showFolderPreview(idx);
      });
    });

    container.querySelectorAll('.sw-editable-name').forEach(span => {
      span.addEventListener('dblclick', e => {
        const idx = parseInt(e.target.dataset.idx);
        const currentName = window.Store.swList[idx].swName;
        const input = document.createElement('input');
        input.className = 'sw-name-input';
        input.value = currentName;
        span.replaceWith(input);
        input.focus();
        input.select();
        const commit = () => {
          const newName = input.value.trim() || currentName;
          window.Store.updateSW(idx, 'swName', newName);
          this.renderSWListTable();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', ev => { if (ev.key === 'Enter') input.blur(); if (ev.key === 'Escape') { input.value = currentName; input.blur(); } });
      });

      // Show preview on click
      span.addEventListener('click', e => {
        const idx = parseInt(e.target.dataset.idx);
        this._showFolderPreview(idx);
        // Highlight row
        container.querySelectorAll('tr').forEach(tr => tr.style.background = '');
        const row = e.target.closest('tr');
        if (row) row.style.background = 'var(--sage-l)';
      });
    });

    container.querySelectorAll('.btn-delete-sw').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(e.target.dataset.idx);
        if (confirm(`"${window.Store.swList[idx].swName}" S/W를 삭제하시겠습니까?`)) {
          window.Store.removeSW(idx);
          this.renderSWListTable();
        }
      });
    });

    container.querySelectorAll('.btn-delete-domain').forEach(btn => {
      btn.addEventListener('click', e => {
        const domain = e.target.dataset.domain;
        if (confirm(`"${domain}" 분야와 소속 S/W를 모두 삭제하시겠습니까?`)) {
          window.Store.removeDomain(domain);
          this.renderSWListTable();
        }
      });
    });
  }

  // ─── 룰 빌더 테이블 렌더링 ───
  static renderRuleListTable() {
    const tbody = document.getElementById('rule-table-body');
    const swSelect = document.getElementById('add-rule-sw');
    if (!tbody || !swSelect) return;

    // S/W 드롭다운 옵션 갱신
    let swOptions = `<option value="auto">(자동 매칭 유지)</option>`;
    window.Store.swList.forEach(sw => {
      if(sw.type !== 'None') {
        const dName = this._esc(sw.swName);
        swOptions += `<option value="${dName}">${dName}</option>`;
      }
    });
    swSelect.innerHTML = swOptions;

    // 룰 리스트 생성
    let html = '';
    window.Store.rules.forEach(rule => {
      const fieldNames = { d0:'D0(부서)', d1:'D1', d2:'D2', d3:'D3', filename:'파일명' };
      const opNames = { equals:'일치(=)', contains:'포함', endswith:'끝남' };
      const field = fieldNames[rule.condition.field] || rule.condition.field;
      const op = opNames[rule.condition.operator] || rule.condition.operator;
      const val = this._esc(rule.condition.value);
      
      const swName = rule.target.swName === 'auto' ? '(자동 S/W 식별)' : this._esc(rule.target.swName);
      const catName = this._esc(rule.target.category);

      html += `<tr style="${rule.enabled ? '' : 'opacity:0.5'}">`;
      html += `<td><input type="checkbox" class="rule-toggle" data-id="${rule.id}" ${rule.enabled ? 'checked' : ''}></td>`;
      html += `<td>${this._esc(rule.description)}</td>`;
      html += `<td><span class="badge" style="background:var(--blue);color:white;">IF</span> [${field}]이(가) "${val}"을(를) ${op}할 때</td>`;
      html += `<td><span class="badge" style="background:var(--sage-d);color:white;">THEN</span> S/W: ${swName}<br>분류: ${catName}</td>`;
      html += `<td><button class="btn-danger btn-delete-rule" data-id="${rule.id}">삭제</button></td>`;
      html += `</tr>`;
    });

    if (window.Store.rules.length === 0) {
      html = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3);">등록된 규칙이 없습니다.</td></tr>`;
    }

    tbody.innerHTML = html;

    // 이벤트 바인딩
    tbody.querySelectorAll('.rule-toggle').forEach(chk => {
      chk.addEventListener('change', e => {
        window.Store.toggleRule(e.target.dataset.id, e.target.checked);
        this.renderRuleListTable();
      });
    });

    tbody.querySelectorAll('.btn-delete-rule').forEach(btn => {
      btn.addEventListener('click', e => {
        if(confirm('이 규칙을 삭제하시겠습니까?')) {
          window.Store.removeRule(e.target.dataset.id);
          this.renderRuleListTable();
        }
      });
    });
  }

  /** 폴더 구조 미리보기 */
  static _showFolderPreview(idx) {
    const preview = document.getElementById('sw-folder-preview');
    if (!preview) return;
    const sw = window.Store.swList[idx];
    if (!sw) return;

    const engine = new window.RuleEngine();
    const template = engine.swTemplates[sw.type];
    if (!template) {
      preview.innerHTML = `<div style="color:var(--text3);">유형 None은 미리보기가 없습니다.</div>`;
      return;
    }

    const displayName = window.Store.getDisplayName(sw);
    let html = `<div class="fp-node fp-level-1"><span class="fp-icon">📂</span><span class="fp-label">${this._esc(displayName)}</span></div>`;

    Object.entries(template).forEach(([key, val]) => {
      html += `<div class="fp-node fp-level-2"><span class="fp-icon">📁</span><span class="fp-label">${this._esc(val)}</span></div>`;
      // 하위 폴더는 동적 생성됨을 명시적으로 표시 (사용자 오해 방지)
      html += `<div class="fp-node fp-level-3"><span class="fp-icon">✨</span><span class="fp-label" style="color:var(--blue);font-style:italic;">[A. 자동생성] 이관된 문서의 원본 폴더명 (예: 조사자료)</span></div>`;
      html += `<div class="fp-node fp-level-4"><span class="fp-icon">✨</span><span class="fp-label" style="color:var(--blue);font-style:italic;">[A-1. 자동생성] 상세 하위 폴더명</span></div>`;
      html += `<div class="fp-node fp-level-3"><span class="fp-icon">✨</span><span class="fp-label" style="color:var(--blue);font-style:italic;">[B. 자동생성] 이관된 문서의 원본 폴더명 (예: 회의이력)</span></div>`;
    });

    preview.innerHTML = html;
  }

  // ─── Stats update + chart ───
  static updateSimulationStats(result) {
    document.getElementById('stats-panel').style.display = 'block';
    document.getElementById('stat-matched').innerText = result.matched.toLocaleString();
    document.getElementById('stat-unclass').innerText = result.unclassified.toLocaleString();

    // S/W 미매칭 카운트 표시
    let noSwEl = document.getElementById('stat-nosw');
    if (!noSwEl) {
      // 동적으로 S/W 미매칭 metric card 추가
      const g2 = document.querySelector('#stats-panel .g2');
      if (g2 && result.noSw > 0) {
        g2.style.gridTemplateColumns = 'repeat(3, 1fr)';
        const noSwCard = document.createElement('div');
        noSwCard.className = 'metric-card';
        noSwCard.innerHTML = `<div class="metric-label">S/W 미매칭</div><div class="metric-value" style="color:var(--text3)" id="stat-nosw">${result.noSw.toLocaleString()}</div>`;
        g2.appendChild(noSwCard);
      }
    } else {
      noSwEl.innerText = result.noSw.toLocaleString();
    }

    const ctx = document.getElementById('chart-sim-result');
    if (!ctx) return;
    if (window.simChart) window.simChart.destroy();
    window.simChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['자동 매칭', '미분류', 'S/W 미매칭', '타겟 외'],
        datasets: [{ data: [result.matched, result.unclassified, result.noSw || 0, result.excluded], backgroundColor: ['#568A7D', '#D96941', '#9AA8B8', '#E5E9ED'], borderWidth: 0 }]
      },
      options: { cutout: '70%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }, maintainAspectRatio: false }
    });

    document.getElementById('btn-export-excel').style.display = 'inline-block';
    
    // NEW: 출처 요약 리스트 업데이트
    this._renderOriginSummary();
  }

  static _renderOriginSummary() {
    const listEl = document.getElementById('origin-summary-list');
    const container = document.getElementById('origin-summary-container');
    if (!listEl || !container) return;

    if (!window.Store.documents) return;
    
    // 타겟이 선택된 상태라면 해당 타겟으로 분류된 문서들만 대상
    const matchedDocs = window.Store.documents.filter(d => !d.isAttachment && d.simulation.status === 'matched');
    
    if (matchedDocs.length === 0) {
      container.style.display = 'none';
      return;
    }
    
    const countMap = {};
    let total = 0;
    matchedDocs.forEach(d => {
      const origin = d.original.d0 || '미분류 부서';
      countMap[origin] = (countMap[origin] || 0) + 1;
      total++;
    });

    const sortedOrigins = Object.entries(countMap).sort((a,b) => b[1] - a[1]).slice(0, 5);

    let html = '';
    sortedOrigins.forEach(([origin, cnt]) => {
      const pct = Math.round((cnt / total) * 100);
      html += `<li style="padding:4px 0; display:flex; justify-content:space-between;">
                 <span>📂 ${this._esc(origin)}</span>
                 <span style="font-weight:600;">${cnt.toLocaleString()}건 <span style="font-weight:normal;opacity:0.7">(${pct}%)</span></span>
               </li>`;
    });
    
    if(Object.keys(countMap).length > 5) {
      html += `<li style="padding:4px 0; text-align:center; opacity:0.6; font-size:10px;">...외 ${Object.keys(countMap).length - 5}개 부서</li>`;
    }

    listEl.innerHTML = html;
    container.style.display = 'block';
  }

  // ─── Excel Export ───
  static exportToExcel() {
    if (!window.Store || window.Store.documents.length === 0) { alert("출력할 문서가 없습니다."); return; }
    const rows = [["원본_D0", "원본_D1", "원본_D2", "원본_D3", "파일명", "타입", "상태", "신규_SW(분야:명칭)", "신규_카테고리", "신규_하위", "신규_상세", "원본경로", "원본부서"]];
    window.Store.documents.forEach(doc => {
      const np = doc.simulation.newPath || {};
      rows.push([
        doc.original.d0, doc.original.d1, doc.original.d2, doc.original.d3,
        doc.fileName, doc.isAttachment ? "첨부" : "메인", doc.simulation.status || "미평가",
        np.swName || '', np.d1_category || '', np.d2_subcat || '', np.d3_detail || '',
        np.originalPath || '', np.originalD0 || ''
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "시뮬레이션_결과");
    XLSX.writeFile(wb, `HM_이관결과_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ─── 타겟 S/W 드롭다운 렌더링 (분야 / S/W 그룹) ───
  static renderTargetSWSelect() {
    const sel = document.getElementById('target-sw-select');
    if (!sel) return;

    let html = `<option value="ALL">전체 진행 (기본 추천)</option>`;
    
    // S/W 미매칭 항목 별도 옵션
    html += `<optgroup label="--- [특수 필터] ---">`;
    html += `<option value="NOSW|*">⚠️ S/W로 분리되지 않는 항목</option>`;
    html += `</optgroup>`;

    // 분야별 추출
    const domains = window.Store.getDomains();
    if (domains.length > 0) {
      html += `<optgroup label="--- [분야 묶음 이관] ---">`;
      domains.forEach(d => {
        html += `<option value="DOMAIN|${this._esc(d)}">📦 분야: ${this._esc(d)}</option>`;
      });
      html += `</optgroup>`;
    }

    // 개별 S/W 추출
    if (window.Store.swList.length > 0) {
      html += `<optgroup label="--- [개별 S/W 단독 이관] ---">`;
      window.Store.swList.forEach(sw => {
        html += `<option value="SW|${this._esc(sw.swName)}">🎯 ${this._esc(sw.swName)}</option>`;
      });
      html += `</optgroup>`;
    }

    sel.innerHTML = html;
  }

  // ─── 시각화 맵 (Simplified Hierarchy Map) ───
  static renderVisualMap() {
    const body = document.getElementById('visual-map-body');
    if (!body) return;

    const docs = window.Store.documents;
    if (!docs.length) { body.innerHTML = '<div class="empty-state">데이터가 없습니다.</div>'; return; }

    // Group by swName -> D1 category
    const map = {};
    docs.forEach(doc => {
      if (doc.isAttachment) return;
      if (doc.simulation.status !== 'matched' && doc.simulation.status !== 'unclassified') return;
      const sw = doc.simulation.newPath?.swName || '미분류';
      const cat = doc.simulation.newPath?.d1_category || '미분류';
      if (!map[sw]) {
        const swObj = window.Store.swList.find(s => s.swName === sw || window.Store.getDisplayName(s) === sw);
        map[sw] = { name: sw, type: swObj ? swObj.type : '?', cats: {} };
      }
      map[sw].cats[cat] = (map[sw].cats[cat] || 0) + 1;
    });

    let html = `<div class="visual-map-grid">`;
    Object.values(map).sort((a,b) => b.name.localeCompare(a.name)).forEach(sw => {
      const tc = sw.type.toLowerCase();
      html += `<div class="sw-visual-card">`;
      html += `<div class="sw-visual-header"><span class="sw-visual-name">${this._esc(sw.name)}</span><span class="sw-visual-type type-${tc}">${sw.type}형</span></div>`;
      html += `<div class="sw-visual-body">`;
      
      const sortedCats = Object.entries(sw.cats).sort();
      const maxVal = Math.max(...Object.values(sw.cats), 1);
      
      sortedCats.forEach(([cat, cnt]) => {
        const pct = (cnt / maxVal) * 100;
        const colorClass = cat.includes('1.') ? 'fill-d1' : cat.includes('2.') ? 'fill-d2' : cat.includes('3.') ? 'fill-d3' : cat.includes('4.') ? 'fill-d4' : 'fill-terra';
        html += `<div class="sw-phase-row">
          <div class="sw-phase-label" title="${this._esc(cat)}">${this._esc(cat)}</div>
          <div class="sw-phase-bar-track"><div class="sw-phase-bar-fill ${colorClass}" style="width:${pct}%"></div></div>
          <div class="sw-phase-count">${cnt}</div>
        </div>`;
      });
      
      html += `</div></div>`;
    });
    html += `</div>`;
    body.innerHTML = html;
  }

  // ─── Resizer ───
  static initResizer() {
    const resizer = document.getElementById('resizer');
    const sidebar = document.getElementById('sidebar');
    if (!resizer || !sidebar) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', e => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', e => {
      if (!isResizing) return;
      let newWidth = e.clientX;
      if (newWidth < 200) newWidth = 200;
      if (newWidth > 600) newWidth = 600;
      sidebar.style.width = `${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem('hm-sidebar-width', sidebar.style.width);
      }
    });

    // Load saved width
    const saved = localStorage.getItem('hm-sidebar-width');
    if (saved) sidebar.style.width = saved;
  }

  // ─── 부서별 이관 내역 (Flow Modal Table View) ───
  static renderDeptFlowSummary() {
    const container = document.getElementById('dept-flow-summary');
    if (!container) return;

    const docs = window.Store.documents;
    if (!docs.length) { container.innerHTML = '<div class="empty-state" style="height:200px;">데이터를 먼저 로드하세요.</div>'; return; }

    const mainDocs = docs.filter(d => !d.isAttachment);

    // Build dept → sw → { count, folders }
    const deptMap = {};
    mainDocs.forEach(doc => {
      const dept = doc.original.d0 || '기타';
      if (!deptMap[dept]) deptMap[dept] = { total: 0, migrated: 0, sws: {} };
      deptMap[dept].total++;

      if (doc.simulation.status === 'matched' || doc.simulation.status === 'unclassified') {
        deptMap[dept].migrated++;
        const swName = doc.simulation.newPath?.swName || '미분류';
        const shortSW = swName.includes(':') ? swName.split(':')[1] : swName;
        if (!deptMap[dept].sws[shortSW]) deptMap[dept].sws[shortSW] = { count: 0, folders: new Set() };
        deptMap[dept].sws[shortSW].count++;
        const cat = doc.simulation.newPath?.d1_category;
        if (cat) deptMap[dept].sws[shortSW].folders.add(cat);
      }
    });

    const typeColors = ['#568A7D', '#4A90D9', '#7C5CBF', '#D96941', '#C49B30', '#2D8B57'];
    let html = '';

    // Summary header
    const totalDepts = Object.keys(deptMap).length;
    const totalMigrated = Object.values(deptMap).reduce((s, d) => s + d.migrated, 0);
    const totalAll = mainDocs.length;
    const overallRate = totalAll > 0 ? ((totalMigrated / totalAll) * 100).toFixed(1) : '0';

    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:12px 16px;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border);">`;
    html += `<div><strong>📂 ${totalDepts}개 부서</strong> · 총 ${totalAll.toLocaleString()}건 문서</div>`;
    html += `<div style="font-size:14px;">이관 완료: <strong style="color:var(--sage-d);font-size:18px;font-family:'IBM Plex Mono',monospace;">${totalMigrated.toLocaleString()}</strong>건 <span style="color:var(--sage-d);font-weight:700;">(${overallRate}%)</span></div>`;
    html += `</div>`;

    // Per-dept cards
    Object.entries(deptMap).sort((a, b) => b[1].total - a[1].total).forEach(([dept, data]) => {
      const rate = data.total > 0 ? ((data.migrated / data.total) * 100).toFixed(0) : '0';
      const rateColor = parseInt(rate) >= 70 ? 'var(--sage-d)' : parseInt(rate) >= 40 ? 'var(--gold)' : 'var(--terra)';
      const swCount = Object.keys(data.sws).length;

      html += `<div class="dept-flow-card">`;
      html += `<div class="dept-flow-header" data-dept-toggle>`;
      html += `<div class="dfl-name"><span>▶</span> 📂 ${this._esc(dept)}</div>`;
      html += `<div class="dfl-stats">`;
      html += `<span>${data.total.toLocaleString()}건</span>`;
      html += `<span>→ ${swCount}개 S/W</span>`;
      html += `<span>이관 <strong>${data.migrated.toLocaleString()}</strong>건</span>`;
      html += `<span class="dfl-rate" style="color:${rateColor}">${rate}%</span>`;
      html += `</div></div>`;

      html += `<div class="dept-flow-body">`;

      if (swCount === 0) {
        html += `<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px;">이관 대상 S/W가 없습니다. (이관율 0%)</div>`;
      } else {
        // Table header
        html += `<div class="dept-sw-row" style="background:var(--surface2);font-weight:600;font-size:11px;color:var(--text2);padding:6px 16px;">`;
        html += `<div class="dept-sw-name">이관 대상 S/W</div>`;
        html += `<div class="dept-sw-bar-track" style="background:transparent;font-size:11px;">분포</div>`;
        html += `<div class="dept-sw-count">이관 건수</div>`;
        html += `<div class="dept-sw-folders" style="width:140px;">배정 카테고리</div>`;
        html += `</div>`;

        const maxSWCount = Math.max(...Object.values(data.sws).map(s => s.count), 1);
        let ci = 0;
        Object.entries(data.sws).sort((a, b) => b[1].count - a[1].count).forEach(([sw, info]) => {
          const pct = ((info.count / maxSWCount) * 100).toFixed(0);
          const color = typeColors[ci % typeColors.length];
          const folders = [...info.folders].sort().join(', ');

          html += `<div class="dept-sw-row">`;
          html += `<div class="dept-sw-name">🎯 ${this._esc(sw)}</div>`;
          html += `<div class="dept-sw-bar-track"><div class="dept-sw-bar-fill" style="width:${pct}%;background:${color};">${info.count > 3 ? info.count + '건' : ''}</div></div>`;
          html += `<div class="dept-sw-count">${info.count.toLocaleString()}건</div>`;
          html += `<div class="dept-sw-folders" style="width:140px;" title="${this._esc(folders)}">${this._esc(folders || '-')}</div>`;
          html += `</div>`;
          ci++;
        });
      }

      html += `</div></div>`;
    });

    container.innerHTML = html;
  }

  // ─── Compare 시각적 탭보기 (Visual Tab View) ───
  static renderCompareVisualTab(targetDept = 'ALL') {
    const container = document.getElementById('compare-visual-tab');
    if (!container) return;

    const docs = window.Store.documents;
    let filteredDocs = docs;
    if (targetDept !== 'ALL') {
      filteredDocs = docs.filter(d => d.original.d0 === targetDept || (d.original.d0 || '기타') === targetDept);
    }
    const mainDocs = filteredDocs.filter(d => !d.isAttachment);

    let html = `<div class="vtab-split">`;

    // ─── AS-IS Side ───
    html += `<div class="vtab-half">`;
    html += `<div class="compare-half-title">📂 AS-IS 폴더 구조 <span class="tag tag-asis">Before</span></div>`;

    // Group by D0 → D1 → D2 with doc counts
    const asisTree = {};
    mainDocs.forEach(doc => {
      const d0 = doc.original.d0 || '기타';
      const d1 = doc.original.d1 || '기타';
      const d2 = doc.original.d2 || '기타';
      if (!asisTree[d0]) asisTree[d0] = { total: 0, subs: {} };
      asisTree[d0].total++;
      if (!asisTree[d0].subs[d1]) asisTree[d0].subs[d1] = { total: 0, folders: {} };
      asisTree[d0].subs[d1].total++;
      asisTree[d0].subs[d1].folders[d2] = (asisTree[d0].subs[d1].folders[d2] || 0) + 1;
    });

    Object.entries(asisTree).sort((a, b) => b[1].total - a[1].total).forEach(([dept, data]) => {
      const deptId = 'asis_' + dept.replace(/\W/g, '_');
      html += `<div class="vtab-dept-card">`;
      html += `<div class="vtab-dept-header" data-vtab-dept="${deptId}">`;
      html += `<span class="vtab-dept-name">📂 ${this._esc(dept)}</span>`;
      html += `<span class="vtab-dept-count">${data.total.toLocaleString()}건</span>`;
      html += `</div>`;
      html += `<div class="vtab-dept-body" id="${deptId}">`;

      // Inside: tabs for each D1
      const d1Entries = Object.entries(data.subs).sort((a, b) => b[1].total - a[1].total);
      const tabGroupId = 'atg_' + dept.replace(/\W/g, '_');

      html += `<div class="vtab-cat-tabs">`;
      d1Entries.forEach(([d1, sub], i) => {
        html += `<button class="vtab-cat-tab ${i === 0 ? 'active' : ''}" data-vtab-group="${tabGroupId}" data-vtab-idx="${i}">${this._esc(d1.length > 12 ? d1.substring(0, 12) + '..' : d1)} <span class="tab-count">${sub.total}</span></button>`;
      });
      html += `</div>`;

      d1Entries.forEach(([d1, sub], i) => {
        html += `<div class="vtab-cat-body ${i === 0 ? 'active' : ''}" data-vtab-body="${tabGroupId}" data-vtab-idx="${i}">`;
        const maxFolder = Math.max(...Object.values(sub.folders), 1);
        Object.entries(sub.folders).sort((a, b) => b[1] - a[1]).forEach(([folder, cnt]) => {
          const pct = ((cnt / maxFolder) * 100).toFixed(0);
          html += `<div class="vtab-folder-row">`;
          html += `<span class="vtab-folder-icon">📁</span>`;
          html += `<span class="vtab-folder-name" title="${this._esc(folder)}">${this._esc(folder)}</span>`;
          html += `<div class="vtab-folder-bar"><div class="vtab-folder-bar-fill fill-terra" style="width:${pct}%"></div></div>`;
          html += `<span class="vtab-folder-count">${cnt}건</span>`;
          html += `</div>`;
        });
        html += `</div>`;
      });

      html += `</div></div>`;
    });
    html += `</div>`;

    // ─── TO-BE Side ───
    html += `<div class="vtab-half">`;
    html += `<div class="compare-half-title">🎯 TO-BE S/W 중심 분류 <span class="tag tag-tobe">After</span></div>`;

    // Group by domain → SW → category → subfolders
    const tobeTree = {};
    mainDocs.forEach(doc => {
      if (doc.simulation.status !== 'matched' && doc.simulation.status !== 'unclassified') return;
      const np = doc.simulation.newPath;
      if (!np) return;
      const domain = np.swDomain || '기타';
      const swFull = np.swName || '미분류';
      const sw = swFull.includes(':') ? swFull.split(':')[1] : swFull;
      const cat = np.d1_category || '미분류';
      const sub = np.d2_subcat || '기타';

      if (!tobeTree[domain]) tobeTree[domain] = {};
      if (!tobeTree[domain][sw]) tobeTree[domain][sw] = { total: 0, cats: {} };
      tobeTree[domain][sw].total++;
      if (!tobeTree[domain][sw].cats[cat]) tobeTree[domain][sw].cats[cat] = { total: 0, subs: {} };
      tobeTree[domain][sw].cats[cat].total++;
      tobeTree[domain][sw].cats[cat].subs[sub] = (tobeTree[domain][sw].cats[cat].subs[sub] || 0) + 1;
    });

    Object.entries(tobeTree).sort().forEach(([domain, sws]) => {
      html += `<div class="vtab-section">`;
      html += `<div class="vtab-section-title">📦 ${this._esc(domain)}</div>`;

      Object.entries(sws).sort((a, b) => b[1].total - a[1].total).forEach(([sw, swData]) => {
        const swId = 'tobe_' + sw.replace(/\W/g, '_');
        const swObj = window.Store.swList.find(s => s.swName === sw);
        const typeClass = swObj ? `type-${swObj.type.toLowerCase()}` : '';
        const typeLabel = swObj ? swObj.type + '형' : '?';

        html += `<div class="vtab-sw-card">`;
        html += `<div class="vtab-sw-header">`;
        html += `<div class="vtab-sw-name"><span class="sw-type-badge ${typeClass}" style="font-size:9px;padding:1px 6px;">${typeLabel}</span> ${this._esc(sw)}</div>`;
        html += `<div class="vtab-sw-total">${swData.total.toLocaleString()}건</div>`;
        html += `</div>`;

        // Category tabs
        const catEntries = Object.entries(swData.cats).sort();
        const catGroupId = 'ctg_' + sw.replace(/\W/g, '_');

        html += `<div class="vtab-cat-tabs">`;
        catEntries.forEach(([cat, catData], i) => {
          const shortCat = cat.length > 10 ? cat.substring(0, 10) + '..' : cat;
          html += `<button class="vtab-cat-tab ${i === 0 ? 'active' : ''}" data-vtab-group="${catGroupId}" data-vtab-idx="${i}">${this._esc(shortCat)} <span class="tab-count">${catData.total}</span></button>`;
        });
        html += `</div>`;

        catEntries.forEach(([cat, catData], i) => {
          html += `<div class="vtab-cat-body ${i === 0 ? 'active' : ''}" data-vtab-body="${catGroupId}" data-vtab-idx="${i}">`;
          const maxSub = Math.max(...Object.values(catData.subs), 1);
          Object.entries(catData.subs).sort((a, b) => b[1] - a[1]).forEach(([sub, cnt]) => {
            const pct = ((cnt / maxSub) * 100).toFixed(0);
            html += `<div class="vtab-folder-row">`;
            html += `<span class="vtab-folder-icon">📁</span>`;
            html += `<span class="vtab-folder-name" title="${this._esc(sub)}">${this._esc(sub)}</span>`;
            html += `<div class="vtab-folder-bar"><div class="vtab-folder-bar-fill fill-sage" style="width:${pct}%"></div></div>`;
            html += `<span class="vtab-folder-count">${cnt}건</span>`;
            html += `</div>`;
          });
          html += `</div>`;
        });

        html += `</div>`;
      });

      html += `</div>`;
    });

    html += `</div></div>`; // close vtab-half, vtab-split
    container.innerHTML = html;
  }

  static _esc(s) { return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }
}

window.UIManager = UIManager;
