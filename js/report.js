/**
 * 이관 검증 리포트 엔진 — Phase 2
 * swList 구조 반영, 4탭: 개요/미이관/구조/완료
 */

class ReportEngine {
  constructor() {
    this.docs = window.Store.documents || [];
    this.mainDocs = this.docs.filter(d => !d.isAttachment);
    this.matchedDocs = this.mainDocs.filter(d => d.simulation.status === 'matched');
    this.unclassifiedDocs = this.mainDocs.filter(d => d.simulation.status === 'unclassified');
    this.excludedDocs = this.mainDocs.filter(d => d.simulation.status === 'excluded');
    this.migratedDocs = [...this.matchedDocs, ...this.unclassifiedDocs];
  }

  renderOverview() {
    const total = this.mainDocs.length;
    const migrated = this.migratedDocs.length;
    const unmigrated = total - migrated;
    const rate = total > 0 ? ((migrated / total) * 100).toFixed(1) : '0';

    let html = `<div class="summary-cards">
      <div class="summary-card card-blue"><div class="sc-value">${total.toLocaleString()}</div><div class="sc-label">전체 문서</div></div>
      <div class="summary-card card-sage"><div class="sc-value">${migrated.toLocaleString()}</div><div class="sc-label">이관 완료</div></div>
      <div class="summary-card card-terra"><div class="sc-value">${unmigrated.toLocaleString()}</div><div class="sc-label">미이관</div></div>
      <div class="summary-card card-green"><div class="sc-value">${rate}%</div><div class="sc-label">이관율</div></div>
    </div>`;
    html += `<div class="progress-label"><span>전체 이관 진행률</span><span>${rate}%</span></div>`;
    html += `<div class="progress-bar-container"><div class="progress-bar-fill-inner fill-sage" style="width:${rate}%"></div></div>`;
    html += `<div style="margin-top:20px;"><strong>📋 부서별 문서 이관 요약</strong></div>`;
    html += this._renderDeptTable();
    return html;
  }

  _renderDeptTable() {
    const deptMap = {};
    this.mainDocs.forEach(doc => {
      const d0 = doc.original.d0 || '미분류';
      if (!deptMap[d0]) deptMap[d0] = { total: 0, matched: 0, unclassified: 0, excluded: 0, fileNames: [] };
      deptMap[d0].total++;
      if (doc.simulation.status === 'matched') deptMap[d0].matched++;
      else if (doc.simulation.status === 'unclassified') deptMap[d0].unclassified++;
      else deptMap[d0].excluded++;
      deptMap[d0].fileNames.push(doc.fileName);
    });

    let html = `<table class="report-table"><thead><tr>
      <th>부서</th><th class="num-col">전체</th><th class="num-col">완료</th><th class="num-col">미완료</th><th class="num-col">이관율</th><th class="num-col">파일명품질</th>
    </tr></thead><tbody>`;

    Object.entries(deptMap).sort((a, b) => b[1].total - a[1].total).forEach(([dept, d]) => {
      const m = d.matched + d.unclassified;
      const r = d.total > 0 ? ((m / d.total) * 100).toFixed(0) : '0';
      const q = this._calcQuality(d.fileNames);
      const qc = q >= 70 ? 'score-high' : q >= 40 ? 'score-mid' : 'score-low';
      html += `<tr><td>${this._e(dept)}</td><td class="num-col">${d.total.toLocaleString()}</td><td class="num-col">${m.toLocaleString()}</td><td class="num-col">${(d.total - m).toLocaleString()}</td><td class="num-col">${r}%</td><td class="num-col score-cell ${qc}">${q.toFixed(1)}</td></tr>`;
    });
    html += `</tbody></table>`;
    return html;
  }

  renderUnmigrated() {
    if (this.excludedDocs.length === 0) return `<div class="empty-state" style="height:200px;">모든 문서가 이관되었습니다. ✅</div>`;

    const gm = {};
    this.excludedDocs.forEach(doc => {
      const d0 = doc.original.d0 || '미분류';
      if (!gm[d0]) gm[d0] = { total: 0, subs: {} };
      gm[d0].total++;
      const d1 = doc.original.d1 || '기타';
      if (!gm[d0].subs[d1]) gm[d0].subs[d1] = [];
      gm[d0].subs[d1].push(doc);
    });

    let html = `<div style="margin-bottom:12px;font-size:12px;">총 <strong style="color:var(--terra);">${this.excludedDocs.length.toLocaleString()}</strong>건 미이관</div>`;

    Object.entries(gm).sort((a, b) => b[1].total - a[1].total).forEach(([d0, g]) => {
      html += `<div class="accordion"><div class="accordion-header" data-accordion>`;
      html += `<div><span class="acc-toggle">▶</span> 📁 ${this._e(d0)} — <span style="color:var(--terra);">미이관 ${g.total}건</span></div>`;
      html += `<div>${g.total}건</div></div><div class="accordion-body">`;
      Object.entries(g.subs).sort((a, b) => b[1].length - a[1].length).forEach(([d1, files]) => {
        html += `<div style="margin-bottom:6px;"><div style="font-size:12px;font-weight:600;">📂 ${this._e(d1)} <span style="color:var(--terra);font-size:11px;">${files.length}건</span></div>`;
        files.slice(0, 30).forEach(doc => {
          html += `<div class="file-list-item"><span class="file-dot dot-unclassified"></span><span class="file-name">${this._e(doc.fileName)}</span></div>`;
        });
        if (files.length > 30) html += `<div style="font-size:11px;color:var(--text3);">외 ${files.length - 30}건</div>`;
        html += `</div>`;
      });
      html += `</div></div>`;
    });
    return html;
  }

  renderStructure() {
    const afterTree = window.UIManager.buildTreeDataAfter(this.docs);
    const stats = { total: 0, empty: 0, depths: {} };
    this._analyzeFolders(afterTree, 0, stats);

    const usedRate = stats.total > 0 ? (((stats.total - stats.empty) / stats.total) * 100).toFixed(0) : '0';
    const maxDepth = Math.max(...Object.keys(stats.depths).map(Number), 0);

    let html = `<div style="margin-bottom:20px;"><strong>📁 구조 타당성</strong>`;
    html += `<div class="summary-cards" style="grid-template-columns:repeat(3,1fr);margin-top:12px;">`;
    html += `<div class="summary-card"><div class="sc-value">${stats.total}</div><div class="sc-label">전체 폴더</div></div>`;
    html += `<div class="summary-card"><div class="sc-value">${stats.empty}</div><div class="sc-label">빈 폴더</div></div>`;
    html += `<div class="summary-card card-green"><div class="sc-value">${usedRate}%</div><div class="sc-label">활용률</div></div>`;
    html += `</div></div>`;

    // Depth chart
    html += `<div style="margin-bottom:20px;"><strong>🏗 깊이 분석 (최대 ${maxDepth}단계)</strong><div class="bar-h-section">`;
    const maxDC = Math.max(...Object.values(stats.depths), 1);
    for (let d = 1; d <= maxDepth; d++) {
      const cnt = stats.depths[d] || 0;
      const pct = ((cnt / maxDC) * 100).toFixed(0);
      html += `<div class="bar-h-row"><div class="bar-h-label">레벨 ${d}</div><div class="bar-h-track"><div class="bar-h-fill fill-d${Math.min(d, 4)}" style="width:${pct}%">${cnt}</div></div><div class="bar-h-count">${cnt}개</div></div>`;
    }
    html += `</div></div>`;

    // Distribution balance
    html += this._renderBalance();
    html += this._renderReflection();
    return html;
  }

  _analyzeFolders(node, depth, stats) {
    const ch = Object.keys(node.children);
    if (depth > 0) { stats.total++; if (ch.length === 0 && (!node.files || node.files.length === 0)) stats.empty++; stats.depths[depth] = (stats.depths[depth] || 0) + 1; }
    ch.forEach(k => this._analyzeFolders(node.children[k], depth + 1, stats));
  }

  _renderBalance() {
    const catCounts = {};
    this.migratedDocs.forEach(d => { const c = d.simulation.newPath?.d1_category || '미분류'; catCounts[c] = (catCounts[c] || 0) + 1; });
    const vals = Object.values(catCounts).sort((a, b) => a - b);
    const n = vals.length; const t = vals.reduce((s, v) => s + v, 0);
    let gini = 0;
    if (n > 1 && t > 0) { let sd = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) sd += Math.abs(vals[i] - vals[j]); gini = sd / (2 * n * t); }
    const score = ((1 - gini) * 100).toFixed(0);
    const sc = score >= 70 ? 'score-high' : score >= 40 ? 'score-mid' : 'score-low';

    let html = `<div style="margin-bottom:20px;"><strong>⚖️ 분산 균등성 — <span class="score-cell ${sc}">${score}점</span></strong>`;
    html += `<div class="bar-h-section" style="margin-top:8px;">`;
    const maxC = Math.max(...Object.values(catCounts), 1);
    const cols = ['fill-d1', 'fill-d2', 'fill-d3', 'fill-d4'];
    let ci = 0;
    Object.entries(catCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, cnt]) => {
      html += `<div class="bar-h-row"><div class="bar-h-label" style="width:160px;">${this._e(cat)}</div><div class="bar-h-track"><div class="bar-h-fill ${cols[ci % 4]}" style="width:${((cnt / maxC) * 100).toFixed(0)}%">${cnt}</div></div><div class="bar-h-count">${cnt}건</div></div>`;
      ci++;
    });
    html += `</div></div>`;
    return html;
  }

  _renderReflection() {
    const total = this.mainDocs.length;
    const migrated = this.migratedDocs.length;
    const rate = total > 0 ? ((migrated / total) * 100).toFixed(1) : '0';
    const sc = parseFloat(rate) >= 70 ? 'score-high' : parseFloat(rate) >= 40 ? 'score-mid' : 'score-low';

    let html = `<div style="margin-bottom:20px;"><strong>📊 이관 반영도 — <span class="score-cell ${sc}">${rate}%</span></strong>`;
    html += `<div class="progress-label" style="margin-top:8px;"><span>전체</span><span>${migrated.toLocaleString()} / ${total.toLocaleString()}</span></div>`;
    html += `<div class="progress-bar-container"><div class="progress-bar-fill-inner fill-sage" style="width:${rate}%"></div></div>`;

    // Per dept
    const dc = {};
    this.mainDocs.forEach(d => { const k = d.original.d0 || '기타'; if (!dc[k]) dc[k] = { t: 0, m: 0 }; dc[k].t++; if (d.simulation.status === 'matched' || d.simulation.status === 'unclassified') dc[k].m++; });

    html += `<div style="margin-top:12px;font-size:12px;font-weight:600;">부서별 반영</div><div class="bar-h-section">`;
    Object.entries(dc).sort((a, b) => b[1].t - a[1].t).forEach(([dept, d]) => {
      const dr = d.t > 0 ? ((d.m / d.t) * 100).toFixed(0) : '0';
      const fc = parseInt(dr) >= 70 ? 'fill-d1' : parseInt(dr) >= 40 ? 'fill-d2' : 'fill-d4';
      html += `<div class="bar-h-row"><div class="bar-h-label" style="width:160px;">${this._e(dept)}</div><div class="bar-h-track"><div class="bar-h-fill ${fc}" style="width:${dr}%">${dr}%</div></div><div class="bar-h-count">${d.m}/${d.t}</div></div>`;
    });
    html += `</div></div>`;
    return html;
  }

  renderCompleted() {
    if (this.migratedDocs.length === 0) return `<div class="empty-state" style="height:200px;">이관된 문서가 없습니다.</div>`;
    let html = `<div style="margin-bottom:12px;font-size:12px;">총 <strong style="color:var(--sage-d);">${this.migratedDocs.length.toLocaleString()}</strong>건 이관</div>`;
    html += `<table class="report-table"><thead><tr><th>파일명</th><th>상태</th><th>원본경로</th><th>신규 S/W</th><th>신규 카테고리</th></tr></thead><tbody>`;
    this.migratedDocs.slice(0, 500).forEach(doc => {
      const np = doc.simulation.newPath || {};
      const badge = doc.simulation.status === 'matched' ? '<span class="badge badge-matched">매칭</span>' : '<span class="badge badge-unclassified">미분류</span>';
      html += `<tr><td title="${this._e(doc.fileName)}">${this._e(this._trunc(doc.fileName, 35))}</td><td>${badge}</td><td><span class="origin-tag">${this._e(np.originalPath || '')}</span></td><td>${this._e(np.swName || '')}</td><td>${this._e(np.d1_category || '')}</td></tr>`;
    });
    html += `</tbody></table>`;
    if (this.migratedDocs.length > 500) html += `<div style="margin-top:12px;font-size:11px;color:var(--text3);text-align:center;">상위 500건. CSV 내보내기 이용.</div>`;
    return html;
  }

  exportCSV() {
    const rows = [["파일명", "타입", "상태", "원본_D0", "원본_D1", "원본_D2", "신규_SW(분야:명칭)", "신규_카테고리", "신규_하위", "원본경로", "원본부서"]];
    this.docs.forEach(doc => {
      const np = doc.simulation.newPath || {};
      rows.push([doc.fileName, doc.isAttachment ? '첨부' : '메인', doc.simulation.status, doc.original.d0, doc.original.d1, doc.original.d2, np.swName || '', np.d1_category || '', np.d2_subcat || '', np.originalPath || '', np.originalD0 || '']);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "이관검증");
    XLSX.writeFile(wb, `HM_이관검증_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  _calcQuality(fns) { if (!fns.length) return 0; let ts = 0; fns.forEach(n => { let s = 0; const p = n.split('_'); if (p.length >= 3) s += 30; if (p.length >= 5) s += 20; if (/V\d{1,3}/i.test(n)) s += 25; if (/\d{8}/.test(n)) s += 25; ts += Math.min(s, 100); }); return ts / fns.length; }
  _e(s) { return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }
  _trunc(s, m) { return !s || s.length <= m ? s : s.substring(0, m) + '...'; }
}
window.ReportEngine = ReportEngine;
