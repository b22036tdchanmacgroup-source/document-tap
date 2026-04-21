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
    documents.forEach(doc => {
      if (doc.isAttachment) return;
      if (doc.simulation.status === 'excluded' || doc.simulation.status === 'pending') return;
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
    });
    // Apply numbering to children
    this._applyNumbering(root, 0);
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
    let parentLetter = '';

    sorted.forEach((key, idx) => {
      const child = node.children[key];
      const origName = child.originalName || child.name;

      if (level === 1) {
        // 2단계: 기존 이름에 이미 1,2,3 포함되어 있으면 유지
        // 없으면 유지 (엔진에서 이미 1. 붙여줌)
      } else if (level === 2) {
        // 3단계: A, B, C...
        const letter = String.fromCharCode(65 + idx); // A=65
        parentLetter = letter;
        if (!origName.match(/^[A-Z]\./)) {
          child.name = `${letter}.${origName}`;
        }
      } else if (level === 3) {
        // 4단계: 부모 letter + "-" + 순번
        const parentKey = Object.keys(node.children).sort().indexOf(key);
        // 부모의 letter 찾기
        const pLetter = node.name.match(/^([A-Z])\./)?.[1] || String.fromCharCode(65 + parentKey);
        child.name = `${pLetter}-${idx + 1}.${origName}`;
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
      html += `<div class="tree-item" style="padding-left:${pad}px">`;
      html += `<div class="tree-row">`;
      html += `<span class="tree-toggle">${toggleIcon}</span>`;
      html += `<span class="tree-folder-icon">📁</span>`;
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

  // ─── 비교 뷰: 카드 그리드 ───
  static renderCompareView(result) {
    const c = document.getElementById('compare-content');
    const e = document.getElementById('compare-empty');
    if (!c) return;
    e.style.display = 'none'; c.style.display = 'block';

    const docs = window.Store.documents;
    const totalMain = docs.filter(d => !d.isAttachment).length;
    const migrated = result.matched + result.unclassified;
    const migrationRate = totalMain > 0 ? ((migrated / totalMain) * 100).toFixed(1) : '0';

    // AS-IS: group by D0 → D1
    const asisGroups = {};
    docs.forEach(doc => {
      if (doc.isAttachment) return;
      const d0 = doc.original.d0 || '기타';
      const d1 = doc.original.d1 || '기타';
      if (!asisGroups[d0]) asisGroups[d0] = { total: 0, subs: {} };
      asisGroups[d0].total++;
      if (!asisGroups[d0].subs[d1]) asisGroups[d0].subs[d1] = 0;
      asisGroups[d0].subs[d1]++;
    });

    // TO-BE: group by domain → swName
    const tobeGroups = {};
    docs.forEach(doc => {
      if (doc.isAttachment) return;
      if (doc.simulation.status !== 'matched' && doc.simulation.status !== 'unclassified') return;
      const domain = doc.simulation.newPath?.swDomain || '기타';
      const swName = doc.simulation.newPath?.swName || '미분류';
      if (!tobeGroups[domain]) tobeGroups[domain] = { total: 0, sws: {} };
      tobeGroups[domain].total++;
      if (!tobeGroups[domain].sws[swName]) tobeGroups[domain].sws[swName] = 0;
      tobeGroups[domain].sws[swName]++;
    });

    let html = `<div class="compare-full">`;

    // Toolbar
    html += `<div class="compare-toolbar">`;
    html += `<div><strong>전체 문서:</strong> ${totalMain.toLocaleString()} · <strong>이관:</strong> ${migrated.toLocaleString()} · <strong>이관율:</strong> <span style="color:var(--sage-d);font-weight:800;">${migrationRate}%</span></div>`;
    html += `<div class="toolbar-btns">`;
    html += `<button class="btn btn-sm btn-dark-outline" id="btn-open-compare-stats">📊 상세 통계</button>`;
    html += `<button class="btn btn-sm btn-dark-outline" id="btn-open-flow-from-compare">🔄 문서 흐름</button>`;
    html += `</div></div>`;

    // Split view
    html += `<div class="compare-split">`;

    // ─ AS-IS side ─
    html += `<div class="compare-half">`;
    html += `<div class="compare-half-title">📂 AS-IS 현행 문서 체계 <span class="tag tag-asis">Before</span></div>`;
    Object.entries(asisGroups).sort((a, b) => b[1].total - a[1].total).forEach(([d0, group]) => {
      html += `<div class="domain-group-card">`;
      html += `<div class="domain-group-header" data-dgcard><span class="dg-name">📂 ${this._esc(d0)}</span><span class="dg-count">${group.total.toLocaleString()}건</span></div>`;
      html += `<div class="domain-group-body">`;
      Object.entries(group.subs).sort((a, b) => b[1] - a[1]).forEach(([d1, cnt]) => {
        html += `<div class="sw-card asis" data-card-type="asis" data-d0="${this._esc(d0)}" data-d1="${this._esc(d1)}">`;
        html += `<div class="sw-card-name" title="${this._esc(d1)}">${this._esc(d1)}</div>`;
        html += `<div class="sw-card-count">${cnt.toLocaleString()}</div>`;
        html += `<div class="sw-card-label">문서</div>`;
        html += `</div>`;
      });
      html += `</div></div>`;
    });
    html += `</div>`;

    // ─ TO-BE side ─
    html += `<div class="compare-half">`;
    html += `<div class="compare-half-title">🎯 TO-BE S/W 중심 체계 <span class="tag tag-tobe">After</span></div>`;
    if (Object.keys(tobeGroups).length === 0) {
      html += `<div class="empty-state" style="min-height:200px;">이관된 문서가 없습니다.</div>`;
    } else {
      Object.entries(tobeGroups).sort((a, b) => b[1].total - a[1].total).forEach(([domain, group]) => {
        const swCount = Object.keys(group.sws).length;
        html += `<div class="domain-group-card">`;
        html += `<div class="domain-group-header" data-dgcard><span class="dg-name">📦 ${this._esc(domain)}</span><span class="dg-count">${swCount}개 S/W · ${group.total.toLocaleString()}건</span></div>`;
        html += `<div class="domain-group-body">`;
        Object.entries(group.sws).sort((a, b) => b[1] - a[1]).forEach(([swName, cnt]) => {
          // Extract just the SW name from "domain:swName"
          const shortName = swName.includes(':') ? swName.split(':')[1] : swName;
          html += `<div class="sw-card tobe" data-card-type="tobe" data-sw="${this._esc(swName)}">`;
          html += `<div class="sw-card-name" title="${this._esc(swName)}">${this._esc(shortName)}</div>`;
          html += `<div class="sw-card-count">${cnt.toLocaleString()}</div>`;
          html += `<div class="sw-card-label">이관 문서</div>`;
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
      // Sample 3rd level
      const sampleSubs = ['A.기획이력', 'B.산출물', 'C.검토자료'];
      sampleSubs.forEach((sub, i) => {
        html += `<div class="fp-node fp-level-3"><span class="fp-icon">📁</span><span class="fp-label">${sub}</span></div>`;
        if (i === 0) {
          html += `<div class="fp-node fp-level-4"><span class="fp-icon">📁</span><span class="fp-label">${String.fromCharCode(65 + i)}-1.프로젝트 Master</span></div>`;
          html += `<div class="fp-node fp-level-4"><span class="fp-icon">📁</span><span class="fp-label">${String.fromCharCode(65 + i)}-2.회의록</span></div>`;
        }
      });
    });

    preview.innerHTML = html;
  }

  // ─── Stats update + chart ───
  static updateSimulationStats(result) {
    document.getElementById('stats-panel').style.display = 'block';
    document.getElementById('stat-matched').innerText = result.matched.toLocaleString();
    document.getElementById('stat-unclass').innerText = result.unclassified.toLocaleString();

    const ctx = document.getElementById('chart-sim-result');
    if (!ctx) return;
    if (window.simChart) window.simChart.destroy();
    window.simChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['자동 매칭', '미분류', '타겟 외'],
        datasets: [{ data: [result.matched, result.unclassified, result.excluded], backgroundColor: ['#568A7D', '#D96941', '#E5E9ED'], borderWidth: 0 }]
      },
      options: { cutout: '70%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }, maintainAspectRatio: false }
    });

    document.getElementById('btn-export-excel').style.display = 'inline-block';
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

  static _esc(s) { return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }
}

window.UIManager = UIManager;
