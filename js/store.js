/**
 * HM 시뮬레이터 전역 상태 관리 (Store) — Phase 2
 * swList 배열 기반 32개 S/W 관리, CRUD, 키워드 매칭 지원
 */

class AppState {
  constructor() {
    this.documents = [];
    this.mainDocsCount = 0;
    this.attachDocsCount = 0;
    this.folderRenames = new Map();
    this.lastSimResult = null;

    /**
     * S/W 리스트 (배열 기반, 편집 가능)
     * domain: 분야명
     * swName: S/W 공식 명칭 (PDF 기준)
     * type: 폴더 유형 (A/B/C/D/None)
     * keywords: 엑셀 매칭용 키워드 배열 (소문자)
     * isExcluded: 이관 제외 여부
     */
    this.swList = [
      // ─── 구조 Solution (A형) ───
      { domain: "구조 Solution", swName: "BridgePlanner", type: "A", keywords: ["bridge planner", "bridgeplanner", "bridge_planner"], isExcluded: false },
      { domain: "구조 Solution", swName: "DRZainer", type: "A", keywords: ["dr", "drzainer", "dr자이너"], isExcluded: false },
      { domain: "구조 Solution", swName: "NodularZainer", type: "A", keywords: ["nodular", "nodularzainer", "nodular자이너"], isExcluded: false },
      { domain: "구조 Solution", swName: "AbutZainer", type: "A", keywords: ["abutment", "abutzainer", "교대", "abut"], isExcluded: false },
      { domain: "구조 Solution", swName: "PierZainer", type: "A", keywords: ["pier", "pierzainer", "교각"], isExcluded: false },
      { domain: "구조 Solution", swName: "BoxZainer", type: "A", keywords: ["dfma", "boxzainer", "box", "박스"], isExcluded: false },
      { domain: "구조 Solution", swName: "WallZainer", type: "A", keywords: ["retaining wall", "wallzainer", "옹벽", "wall"], isExcluded: false },
      { domain: "구조 Solution", swName: "TunnelZainer", type: "A", keywords: ["tunnel", "tunnelzainer", "터널"], isExcluded: false },

      // ─── 도로·교통 Solution ───
      { domain: "도로·교통 Solution", swName: "WayPrimal", type: "A", keywords: ["wayprimal", "wayzainer", "way primal"], isExcluded: false },
      { domain: "도로·교통 Solution", swName: "WayConfirm", type: "A", keywords: ["wayconfirm", "way confirm"], isExcluded: false },
      { domain: "도로·교통 Solution", swName: "WayDraw", type: "C", keywords: ["waydraw", "wayshop", "way draw", "way shop"], isExcluded: false },
      { domain: "도로·교통 Solution", swName: "WayShop", type: "C", keywords: ["wayshop", "way shop"], isExcluded: false },
      { domain: "도로·교통 Solution", swName: "TOVA", type: "C", keywords: ["tova"], isExcluded: false },
      { domain: "도로·교통 Solution", swName: "TwinHighway", type: "A", keywords: ["twinhighway", "twin highway", "트윈하이웨이"], isExcluded: false },
      { domain: "도로·교통 Solution", swName: "WatchBIM", type: "C", keywords: ["watchbim", "watch bim", "왓치빔"], isExcluded: false },

      // ─── 수리·수공 Solution ───
      { domain: "수리·수공 Solution", swName: "LifeLine-Water", type: "A", keywords: ["lifeline", "life line", "라이프라인"], isExcluded: false },
      { domain: "수리·수공 Solution", swName: "강우강도산정 S/W", type: "A", keywords: ["강우강도", "강우", "rainfall"], isExcluded: false },
      { domain: "수리·수공 Solution", swName: "IPIPES", type: "A", keywords: ["ipipes", "i-pipes", "상하수도관"], isExcluded: false },

      // ─── 서비스(시공·관리) Solution ───
      { domain: "서비스(시공·관리) Solution", swName: "bCMf", type: "C", keywords: ["bcmf", "bcmf_대당", "bcmf_터널", "시공관리"], isExcluded: false },
      { domain: "서비스(시공·관리) Solution", swName: "GSIM", type: "C", keywords: ["gsim", "안전관리", "안전"], isExcluded: false },
      { domain: "서비스(시공·관리) Solution", swName: "CCP", type: "C", keywords: ["ccp"], isExcluded: false },
      { domain: "서비스(시공·관리) Solution", swName: "Domainer", type: "B", keywords: ["domainer", "도메이너"], isExcluded: false },

      // ─── 지반·지형 Solution ───
      { domain: "지반·지형 Solution", swName: "천지인", type: "B", keywords: ["천지인"], isExcluded: false },
      { domain: "지반·지형 Solution", swName: "GAIA", type: "B", keywords: ["gaia", "가이아"], isExcluded: false },
      { domain: "지반·지형 Solution", swName: "KNGIL", type: "B", keywords: ["kngil"], isExcluded: false },
      { domain: "지반·지형 Solution", swName: "Surveyor", type: "B", keywords: ["surveyor", "서베이어", "측량"], isExcluded: false },
      { domain: "지반·지형 Solution", swName: "GIS Mapper", type: "B", keywords: ["gis mapper", "gis", "hmmap", "hm map"], isExcluded: false },
      { domain: "지반·지형 Solution", swName: "Cadaster", type: "B", keywords: ["cadaster", "카다스터", "지적"], isExcluded: false },

      // ─── 그래픽·엔진 ───
      { domain: "그래픽·엔진", swName: "STRANA", type: "D", keywords: ["strana"], isExcluded: false },
      { domain: "그래픽·엔진", swName: "HmGE & HmDraw", type: "D", keywords: ["hmge", "hmeg", "hmdraw", "hm ge", "hm draw", "그래픽스"], isExcluded: false },
      { domain: "그래픽·엔진", swName: "EG-BIM", type: "D", keywords: ["eg-bim", "eg_bim", "egbim", "eg bim"], isExcluded: false },
      { domain: "그래픽·엔진", swName: "3D Modeler", type: "D", keywords: ["modeler", "3d modeler", "모델러"], isExcluded: false }
    ];
  }

  // ─── S/W CRUD ───

  /** 분야 목록 (중복 제거) */
  getDomains() {
    return [...new Set(this.swList.map(s => s.domain))];
  }

  /** 특정 분야에 속한 S/W 목록 */
  getSWsByDomain(domain) {
    return this.swList.filter(s => s.domain === domain);
  }

  /** displayName 생성: "분야:S/W명" */
  getDisplayName(sw) {
    return `${sw.domain}:${sw.swName}`;
  }

  /** S/W 추가 */
  addSW(domain, swName, type, keywords) {
    this.swList.push({
      domain, swName, type,
      keywords: keywords || [swName.toLowerCase()],
      isExcluded: type === 'None'
    });
  }

  /** S/W 삭제 (index) */
  removeSW(index) {
    if (index >= 0 && index < this.swList.length) {
      this.swList.splice(index, 1);
    }
  }

  /** S/W 속성 업데이트 */
  updateSW(index, field, value) {
    if (index >= 0 && index < this.swList.length) {
      this.swList[index][field] = value;
      if (field === 'type') {
        this.swList[index].isExcluded = value === 'None';
      }
    }
  }

  /** 분야명 일괄 변경 */
  renameDomain(oldName, newName) {
    this.swList.forEach(sw => {
      if (sw.domain === oldName) sw.domain = newName;
    });
  }

  /** 분야 삭제 (해당 분야의 모든 S/W도 삭제) */
  removeDomain(domain) {
    this.swList = this.swList.filter(sw => sw.domain !== domain);
  }

  /** 시뮬레이션 상태 초기화 */
  resetSimulation() {
    this.documents.forEach(doc => {
      doc.simulation = { status: 'pending', matchedRuleType: null, newPath: null };
    });
    this.folderRenames.clear();
    this.lastSimResult = null;
  }
}

class Document {
  constructor(rowId, confirm, path1, path2, path3, path4) {
    this.id = rowId;
    this.original = {
      d0: confirm || '',
      d1: path1 || '',
      d2: path2 || '',
      d3: path3 || ''
    };
    this.fileName = path4 || '';

    const lowerName = this.fileName.toLowerCase();
    this.isAttachment = lowerName.endsWith('_attachment') || lowerName.endsWith('_attachemt');

    this.simulation = {
      status: 'pending',
      matchedRuleType: null,
      newPath: null
    };
  }
}

window.Store = new AppState();
window.DocumentModel = Document;
