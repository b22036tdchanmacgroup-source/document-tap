/**
 * HM 시뮬레이터 전역 상태 관리 (Store) — 개선판
 * - S/W 키워드 한글 대폭 확장 (영문 위주 → 한글 폴더명/파일명 매칭 강화)
 * - 명시적 룰(Rules) 관리
 */

class AppState {
  constructor() {
    this.documents = [];
    this.mainDocsCount = 0;
    this.attachDocsCount = 0;
    this.folderRenames = new Map();
    this.lastSimResult = null;

    // 명시적 매핑 규칙 (Tier 0)
    this.rules = [
      {
        id: 'rule_sample_1',
        enabled: true,
        description: '설계서 폴더는 엔지니어링 카테고리로 강제 할당',
        condition: { field: 'd2', operator: 'contains', value: '설계서' },
        target: { swName: 'auto', category: '2.엔지니어링 설계' }
      },
      {
        id: 'rule_sample_2',
        enabled: true,
        description: 'AI기획실 문서 전체를 Z.작업장으로 우선 대피',
        condition: { field: 'd0', operator: 'equals', value: 'AI 기획' },
        target: { swName: 'auto', category: 'Z.작업장·공통참조' }
      }
    ];

    /**
     * S/W 리스트 — 키워드 한글 확장 버전
     * keywords 배열: 영문 키워드 + 한글 키워드(폴더명·파일명에서 자주 쓰이는 표현) 모두 포함
     */
    this.swList = [

      // ─── 구조 Solution (A형) ───
      {
        domain: "구조 Solution", swName: "BridgePlanner", type: "A",
        keywords: [
          "bridge planner", "bridgeplanner", "bridge_planner", "bridge",
          "교량", "교량설계", "교량계획", "교량기획", "교량공", "교량상부공", "교량하부공",
          "상부공", "하부공", "거더", "girder", "강교", "pc교", "psc교", "교량해석",
          "교량기본설계", "교량실시설계", "교량검토"
        ],
        isExcluded: false
      },
      {
        domain: "구조 Solution", swName: "DRZainer", type: "A",
        keywords: [
          "dr", "drzainer", "dr자이너",
          "강선", "psc", "pc보", "프리스트레스", "prestress", "post tension", "posttension",
          "ps강재", "ps강선", "강선배치", "긴장재"
        ],
        isExcluded: false
      },
      {
        domain: "구조 Solution", swName: "NodularZainer", type: "A",
        keywords: [
          "nodular", "nodularzainer", "nodular자이너",
          "절점", "노드", "node", "절점설계"
        ],
        isExcluded: false
      },
      {
        domain: "구조 Solution", swName: "AbutZainer", type: "A",
        keywords: [
          "abutment", "abutzainer", "교대", "abut",
          "교량교대", "날개벽", "받침", "교대설계", "교대기초"
        ],
        isExcluded: false
      },
      {
        domain: "구조 Solution", swName: "PierZainer", type: "A",
        keywords: [
          "pier", "pierzainer", "교각",
          "교량교각", "교각설계", "교각기초", "기둥식교각", "벽식교각"
        ],
        isExcluded: false
      },
      {
        domain: "구조 Solution", swName: "BoxZainer", type: "A",
        keywords: [
          "dfma", "boxzainer", "box", "박스",
          "박스거더", "box거더", "박스교", "박스형", "상자형", "박스단면"
        ],
        isExcluded: false
      },
      {
        domain: "구조 Solution", swName: "WallZainer", type: "A",
        keywords: [
          "retaining wall", "wallzainer", "옹벽", "wall",
          "흙막이", "석축", "보강토", "보강토옹벽", "역t형옹벽", "중력식옹벽"
        ],
        isExcluded: false
      },
      {
        domain: "구조 Solution", swName: "TunnelZainer", type: "A",
        keywords: [
          "tunnel", "tunnelzainer", "터널",
          "natm", "shield", "쉴드", "굴착", "복공", "지보", "터널설계",
          "터널계획", "터널굴착", "터널라이닝"
        ],
        isExcluded: false
      },

      // ─── 도로·교통 Solution ───
      {
        domain: "도로·교통 Solution", swName: "WayPrimal", type: "A",
        keywords: [
          "wayprimal", "wayzainer", "way primal",
          "도로", "도로설계", "선형", "종단", "횡단", "노선", "도로계획",
          "도로기획", "도로기본설계", "도로실시설계", "평면선형", "종단선형",
          "도로폭", "도로개설", "신설도로", "도로확장"
        ],
        isExcluded: false
      },
      {
        domain: "도로·교통 Solution", swName: "WayConfirm", type: "A",
        keywords: [
          "wayconfirm", "way confirm",
          "도로검토", "타당성검토", "경제성", "노선비교", "도로타당성",
          "노선선정", "비교노선", "도로경제성"
        ],
        isExcluded: false
      },
      {
        domain: "도로·교통 Solution", swName: "WayDraw", type: "C",
        keywords: [
          "waydraw", "wayshop", "way draw", "way shop",
          "도로도면", "도면작성", "도면생성", "도로cad"
        ],
        isExcluded: false
      },
      {
        domain: "도로·교통 Solution", swName: "WayShop", type: "C",
        keywords: ["wayshop", "way shop"],
        isExcluded: false
      },
      {
        domain: "도로·교통 Solution", swName: "TOVA", type: "C",
        keywords: [
          "tova",
          "교통량", "교통분석", "교통조사", "traffic", "tps",
          "교통계획", "신호", "교통영향", "교통영향평가", "교통수요"
        ],
        isExcluded: false
      },
      {
        domain: "도로·교통 Solution", swName: "TwinHighway", type: "A",
        keywords: [
          "twinhighway", "twin highway", "트윈하이웨이",
          "고속도로", "highway", "자동차전용도로", "고속국도", "고속화도로"
        ],
        isExcluded: false
      },
      {
        domain: "도로·교통 Solution", swName: "WatchBIM", type: "C",
        keywords: [
          "watchbim", "watch bim", "왓치빔",
          "bim", "bim모델", "ifc", "lod", "bim설계", "bim기반", "bim활용"
        ],
        isExcluded: false
      },

      // ─── 수리·수공 Solution ───
      {
        domain: "수리·수공 Solution", swName: "LifeLine-Water", type: "A",
        keywords: [
          "lifeline", "life line", "라이프라인",
          "수계", "수로", "수공", "하천", "댐", "저수지", "수리",
          "수문", "홍수", "유량", "수리계획", "하천계획", "제방",
          "하천기본계획", "치수", "이수", "하천정비", "수리시설"
        ],
        isExcluded: false
      },
      {
        domain: "수리·수공 Solution", swName: "강우강도산정 S/W", type: "A",
        keywords: [
          "강우강도", "강우", "rainfall",
          "수문", "확률강우", "강수", "강수량", "홍수빈도",
          "수문분석", "첨두유량", "확률홍수", "설계강우", "강우분석"
        ],
        isExcluded: false
      },
      {
        domain: "수리·수공 Solution", swName: "IPIPES", type: "A",
        keywords: [
          "ipipes", "i-pipes", "상하수도관",
          "관로", "파이프", "상수도", "하수도", "관망", "pipe",
          "배수관", "관로설계", "관로계획", "상수관", "오수관", "우수관"
        ],
        isExcluded: false
      },

      // ─── 서비스(시공·관리) Solution ───
      {
        domain: "서비스(시공·관리) Solution", swName: "bCMf", type: "C",
        keywords: [
          "bcmf", "bcmf_대당", "bcmf_터널", "시공관리",
          "시공", "공정", "건설관리", "현장관리", "공정관리",
          "공사관리", "진도관리", "공사진도", "시공계획", "현장"
        ],
        isExcluded: false
      },
      {
        domain: "서비스(시공·관리) Solution", swName: "GSIM", type: "C",
        keywords: [
          "gsim", "안전관리", "안전",
          "재해", "위험", "safety", "사고", "안전점검",
          "위험성평가", "재해예방", "안전진단", "안전계획"
        ],
        isExcluded: false
      },
      {
        domain: "서비스(시공·관리) Solution", swName: "CCP", type: "C",
        keywords: [
          "ccp", "계약", "협력사", "발주", "하도급", "협력"
        ],
        isExcluded: false
      },
      {
        domain: "서비스(시공·관리) Solution", swName: "Domainer", type: "B",
        keywords: [
          "domainer", "도메이너", "도메인", "포털", "플랫폼"
        ],
        isExcluded: false
      },

      // ─── 지반·지형 Solution ───
      {
        domain: "지반·지형 Solution", swName: "천지인", type: "B",
        keywords: [
          "천지인",
          "지반", "지질", "지층", "토질", "기초", "기초설계",
          "말뚝", "파일", "지반해석", "연약지반", "지반개량"
        ],
        isExcluded: false
      },
      {
        domain: "지반·지형 Solution", swName: "GAIA", type: "B",
        keywords: [
          "gaia", "가이아",
          "지형", "dem", "수치지형", "지형분석", "지형모델",
          "수치표고", "dtm", "지형데이터", "지형도", "지형측량"
        ],
        isExcluded: false
      },
      {
        domain: "지반·지형 Solution", swName: "KNGIL", type: "B",
        keywords: [
          "kngil",
          "지반조사", "시추", "spt", "보링", "표준관입",
          "현장시험", "지반시험", "코어", "주상도", "시추주상도"
        ],
        isExcluded: false
      },
      {
        domain: "지반·지형 Solution", swName: "Surveyor", type: "B",
        keywords: [
          "surveyor", "서베이어", "측량", "survey",
          "기준점", "gps", "gnss", "토탈스테이션", "ts",
          "측량성과", "측량도", "측량계획", "기준점측량"
        ],
        isExcluded: false
      },
      {
        domain: "지반·지형 Solution", swName: "GIS Mapper", type: "B",
        keywords: [
          "gis mapper", "gis", "hmmap", "hm map",
          "공간정보", "지도", "qgis", "arcgis", "gis분석",
          "공간분석", "수치지도", "gis데이터", "공간데이터"
        ],
        isExcluded: false
      },
      {
        domain: "지반·지형 Solution", swName: "Cadaster", type: "B",
        keywords: [
          "cadaster", "카다스터", "지적", "필지", "토지",
          "경계", "지목", "토지이용", "지적도", "토지경계"
        ],
        isExcluded: false
      },

      // ─── 그래픽·엔진 ───
      {
        domain: "그래픽·엔진", swName: "STRANA", type: "D",
        keywords: [
          "strana",
          "구조해석", "fem", "유한요소", "해석모델",
          "구조계산서", "내진", "내진해석", "fea", "구조해석모델"
        ],
        isExcluded: false
      },
      {
        domain: "그래픽·엔진", swName: "HmGE & HmDraw", type: "D",
        keywords: [
          "hmge", "hmeg", "hmdraw", "hm ge", "hm draw", "그래픽스",
          "그래픽엔진", "그래픽", "렌더링", "cad엔진"
        ],
        isExcluded: false
      },
      {
        domain: "그래픽·엔진", swName: "EG-BIM", type: "D",
        keywords: [
          "eg-bim", "eg_bim", "egbim", "eg bim",
          "bim엔진", "bim라이브러리", "bim플랫폼"
        ],
        isExcluded: false
      },
      {
        domain: "그래픽·엔진", swName: "3D Modeler", type: "D",
        keywords: [
          "modeler", "3d modeler", "모델러", "3d",
          "3d모델", "solid", "형상", "3d설계", "3d모델링", "형상모델"
        ],
        isExcluded: false
      }
    ];
  }

  // ─── S/W CRUD ───

  getDomains() {
    return [...new Set(this.swList.map(s => s.domain))];
  }

  getSWsByDomain(domain) {
    return this.swList.filter(s => s.domain === domain);
  }

  getDisplayName(sw) {
    return `${sw.domain}:${sw.swName}`;
  }

  addSW(domain, swName, type, keywords) {
    this.swList.push({
      domain, swName, type,
      keywords: keywords || [swName.toLowerCase()],
      isExcluded: type === 'None'
    });
  }

  removeSW(index) {
    if (index >= 0 && index < this.swList.length) {
      this.swList.splice(index, 1);
    }
  }

  updateSW(index, field, value) {
    if (index >= 0 && index < this.swList.length) {
      this.swList[index][field] = value;
      if (field === 'type') {
        this.swList[index].isExcluded = value === 'None';
      }
    }
  }

  renameDomain(oldName, newName) {
    this.swList.forEach(sw => {
      if (sw.domain === oldName) sw.domain = newName;
    });
  }

  removeDomain(domain) {
    this.swList = this.swList.filter(sw => sw.domain !== domain);
  }

  // ─── 룰 관리 (Rule CRUD) ───
  addRule(rule) {
    this.rules.push(rule);
  }

  removeRule(id) {
    this.rules = this.rules.filter(r => r.id !== id);
  }

  toggleRule(id, enabled) {
    const r = this.rules.find(r => r.id === id);
    if (r) r.enabled = enabled;
  }

  // ─── 상태 리셋 ───
  resetSimulation() {
    this.documents.forEach(doc => {
      doc.simulation = { status: 'pending', matchedBy: null, newPath: null };
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
      matchedBy: null,
      newPath: null
    };
  }
}

window.Store = new AppState();
window.DocumentModel = Document;
