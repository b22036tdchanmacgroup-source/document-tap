/**
 * Canvas 기반 Sankey 다이어그램 렌더러
 * 부서(D0) → S/W명 흐름 + 부서 → 카테고리 흐름
 */

class SankeyChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.padding = { top: 40, right: 40, bottom: 40, left: 40 };
    this.nodeWidth = 18;
    this.nodePadding = 6;
    this.colors = {
      sources: ['#568A7D', '#4A7A6E', '#78A898', '#9BBFB2', '#3D6B5E', '#6BA594', '#89C4B0', '#2F5A4E', '#A8D4C5', '#4E8B7D'],
      targets: ['#D96941', '#E88B6C', '#C4573A', '#F0A78F', '#B04A30', '#DA7B5E', '#CD6148', '#E59880', '#A33E26', '#EFB5A0'],
      categories: ['#4A90D9', '#6BA3E3', '#3A7DC9', '#8BB8ED', '#2B6DB8', '#5C96DD', '#7DADE7', '#1C5DA7', '#9DC5F1', '#4D93DB']
    };
  }

  /**
   * Sankey 다이어그램 렌더링
   * @param {Array} flows - [{source, target, value}]
   * @param {String} mode - 'sw' or 'category'
   */
  render(flows, mode = 'sw') {
    if (!this.canvas || !this.ctx) return;

    // Canvas 크기 설정
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth || 900;
    this.canvas.height = Math.max(500, flows.length * 12 + 200);

    const W = this.canvas.width;
    const H = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, W, H);

    if (flows.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '14px "Noto Sans KR"';
      ctx.textAlign = 'center';
      ctx.fillText('시뮬레이션 후 데이터가 표시됩니다.', W / 2, H / 2);
      return;
    }

    // Aggregate: unique sources and targets
    const sourceMap = {};
    const targetMap = {};

    flows.forEach(f => {
      sourceMap[f.source] = (sourceMap[f.source] || 0) + f.value;
      targetMap[f.target] = (targetMap[f.target] || 0) + f.value;
    });

    const sources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);
    const targets = Object.entries(targetMap).sort((a, b) => b[1] - a[1]);

    // Layout nodes
    const leftX = this.padding.left;
    const rightX = W - this.padding.right - this.nodeWidth;
    const usableH = H - this.padding.top - this.padding.bottom;

    const totalSourceVal = sources.reduce((s, e) => s + e[1], 0);
    const totalTargetVal = targets.reduce((s, e) => s + e[1], 0);

    // Source node positions
    let yOffset = this.padding.top;
    const sourceNodes = {};
    sources.forEach(([name, val], idx) => {
      const h = Math.max(12, (val / totalSourceVal) * (usableH - sources.length * this.nodePadding));
      sourceNodes[name] = { x: leftX, y: yOffset, w: this.nodeWidth, h, val, idx };
      yOffset += h + this.nodePadding;
    });

    // Target node positions
    yOffset = this.padding.top;
    const targetNodes = {};
    targets.forEach(([name, val], idx) => {
      const h = Math.max(12, (val / totalTargetVal) * (usableH - targets.length * this.nodePadding));
      targetNodes[name] = { x: rightX, y: yOffset, w: this.nodeWidth, h, val, idx };
      yOffset += h + this.nodePadding;
    });

    // Draw flows (bezier curves)
    const sourceYTracker = {};
    const targetYTracker = {};
    Object.keys(sourceNodes).forEach(k => sourceYTracker[k] = sourceNodes[k].y);
    Object.keys(targetNodes).forEach(k => targetYTracker[k] = targetNodes[k].y);

    // Sort flows by value desc for cleaner rendering
    const sortedFlows = [...flows].sort((a, b) => b.value - a.value);

    sortedFlows.forEach(flow => {
      const sn = sourceNodes[flow.source];
      const tn = targetNodes[flow.target];
      if (!sn || !tn) return;

      const flowH = Math.max(2, (flow.value / sn.val) * sn.h);
      const flowHT = Math.max(2, (flow.value / tn.val) * tn.h);

      const sy = sourceYTracker[flow.source];
      const ty = targetYTracker[flow.target];

      sourceYTracker[flow.source] += flowH;
      targetYTracker[flow.target] += flowHT;

      // Bezier curve
      const x1 = sn.x + sn.w;
      const x2 = tn.x;
      const cp1x = x1 + (x2 - x1) * 0.4;
      const cp2x = x1 + (x2 - x1) * 0.6;

      const colorIdx = sn.idx % this.colors.sources.length;
      const color = mode === 'category' ? this.colors.categories[colorIdx] : this.colors.sources[colorIdx];

      ctx.beginPath();
      ctx.moveTo(x1, sy);
      ctx.bezierCurveTo(cp1x, sy, cp2x, ty, x2, ty);
      ctx.lineTo(x2, ty + flowHT);
      ctx.bezierCurveTo(cp2x, ty + flowHT, cp1x, sy + flowH, x1, sy + flowH);
      ctx.closePath();

      ctx.globalAlpha = 0.35;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Draw source nodes
    sources.forEach(([name, val]) => {
      const n = sourceNodes[name];
      const colorIdx = n.idx % this.colors.sources.length;
      ctx.fillStyle = this.colors.sources[colorIdx];
      ctx.fillRect(n.x, n.y, n.w, n.h);

      // Label
      ctx.fillStyle = '#333';
      ctx.font = '11px "Noto Sans KR"';
      ctx.textAlign = 'right';
      const labelY = n.y + n.h / 2 + 4;
      const label = name.length > 20 ? name.substring(0, 18) + '..' : name;
      // Put label to left of node
      ctx.textAlign = 'right';
      // Name
      ctx.fillText(label, n.x - 6, labelY);
      // Count
      ctx.fillStyle = '#999';
      ctx.font = '10px "IBM Plex Mono"';
      ctx.fillText(`${val}건`, n.x - 6, labelY + 13);
    });

    // Draw target nodes
    const targetColorSet = mode === 'category' ? this.colors.categories : this.colors.targets;
    targets.forEach(([name, val]) => {
      const n = targetNodes[name];
      const colorIdx = n.idx % targetColorSet.length;
      ctx.fillStyle = targetColorSet[colorIdx];
      ctx.fillRect(n.x, n.y, n.w, n.h);

      // Label
      ctx.fillStyle = '#333';
      ctx.font = '11px "Noto Sans KR"';
      ctx.textAlign = 'left';
      const labelY = n.y + n.h / 2 + 4;
      const label = name.length > 28 ? name.substring(0, 26) + '..' : name;
      ctx.fillText(label, n.x + n.w + 6, labelY);
      ctx.fillStyle = '#999';
      ctx.font = '10px "IBM Plex Mono"';
      ctx.fillText(`${val}건`, n.x + n.w + 6, labelY + 13);
    });

    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 13px "Noto Sans KR"';
    ctx.textAlign = 'left';
    ctx.fillText('기존 부서 (AS-IS)', leftX, this.padding.top - 14);
    ctx.textAlign = 'right';
    const targetTitle = mode === 'category' ? '신규 카테고리 (분류)' : '신규 S/W (TO-BE)';
    ctx.fillText(targetTitle, rightX + this.nodeWidth, this.padding.top - 14);
  }

  /**
   * 부서→S/W 흐름 데이터 생성
   */
  static buildSWFlows(documents) {
    const flowMap = {};
    documents.forEach(doc => {
      if (doc.isAttachment) return;
      if (doc.simulation.status !== 'matched' && doc.simulation.status !== 'unclassified') return;
      const source = doc.original.d0 || '기타';
      const target = doc.simulation.newPath?.swName || '미분류';
      const key = `${source}|||${target}`;
      flowMap[key] = (flowMap[key] || 0) + 1;
    });
    return Object.entries(flowMap).map(([key, value]) => {
      const [source, target] = key.split('|||');
      return { source, target, value };
    });
  }

  /**
   * 부서→카테고리 흐름 데이터 생성
   */
  static buildCategoryFlows(documents) {
    const flowMap = {};
    documents.forEach(doc => {
      if (doc.isAttachment) return;
      if (doc.simulation.status !== 'matched' && doc.simulation.status !== 'unclassified') return;
      const source = doc.original.d0 || '기타';
      const target = doc.simulation.newPath?.d1_category || '미분류';
      const key = `${source}|||${target}`;
      flowMap[key] = (flowMap[key] || 0) + 1;
    });
    return Object.entries(flowMap).map(([key, value]) => {
      const [source, target] = key.split('|||');
      return { source, target, value };
    });
  }
}

window.SankeyChart = SankeyChart;
