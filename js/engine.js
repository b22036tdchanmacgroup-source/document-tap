/**
 * 하이브리드 규칙 엔진 (Rule Engine) — v3 (GS 정합 버전)
 *
 * 구글 시트 분류 로직과 일치하도록 개선된 3단계 카테고리 추론:
 *   1) D2 폴더명 기반 직접 매핑  ← 핵심 신규 로직
 *   2) 전체 맥락 키워드 매칭 (fallback)
 *   3) Z.작업장·공통참조 기본값 (catch-all)
 *
 * 하위폴더 구조 변경:
 *   기존: 새 D2 = 원본 D2, 새 D3 = 원본 D3
 *   변경: 새 D2 = 원본 D3 (더 구체적), 새 D3 = null → GS 구조와 일치
 */

class RuleEngine {
  constructor() {
    // S/W 유형별 2단계 카테고리 템플릿
    this.swTemplates = {
      "A": {
        "1.기획·조사": "1.기획·조사", "2.엔지니어링 설계": "2.엔지니어링 설계",
        "3.기능 요건·명세": "3.기능 요건·명세", "4.개발·구현": "4.개발·구현",
        "5.검수·품질관리": "5.검수·품질관리", "Z.작업장·공통참조": "Z.작업장·공통참조"
      },
      "B": {
        "1.기획·조사": "1.기획·조사", "2.데이터 설계·구조": "2.데이터 설계·구조",
        "3.기능 요건·명세": "3.기능 요건·명세", "4.개발·구현": "4.개발·구현",
        "5.연동·검증": "5.연동·검증", "Z.작업장·공통참조": "Z.작업장·공통참조"
      },
      "C": {
        "1.기획·조사": "1.기획·조사", "2.UX·화면설계": "2.UX·화면설계",
        "3.기능 요건·명세": "3.기능 요건·명세", "4.개발·구현": "4.개발·구현",
        "5.릴리즈·운영": "5.릴리즈·운영", "Z.작업장·공통참조": "Z.작업장·공통참조"
      },
      "D": {
        "1.기획·조사": "1.기획·조사", "2.수치해석·알고리즘": "2.수치해석·알고리즘",
        "3.기능 요건·명세": "3.기능 요건·명세", "4.개발·구현": "4.개발·구현",
        "5.성능·최적화": "5.성능·최적화", "Z.작업장·공통참조": "Z.작업장·공통참조"
      }
    };

    /**
     * D2 폴더 토픽 → 카테고리 매핑 테이블 (GS 분류 로직 재현)
     * D2 값은 보통 "A.형상", "B.계획", "C.일반사항" 등 "기호.토픽" 패턴
     * 기호(A,B,C,D)를 제거하고 토픽 키워드로 카테고리를 결정
     */
    this._d2CategoryMap = [
      // 2단계: 엔지니어링/설계 → "형상", "설계", "구조", "해석" 등
      {
        keywords: ['형상', '설계', '구조계산', '수리계산', '해석', '역학', '단면', '배근',
                   '도면', '도안', '공법', '앙토', '뒤채움', '기초형식', '앙카', '사면',
                   '엔지니어링', 'engineering', 'design', '계산', '검토보고'],
        category: key => this._cat2(key)
      },
      // 3단계: 기능 요건/명세
      {
        keywords: ['명세', '요건', '요구사항', 'spec', '스펙', '기능정의', '기능요건', 'requirement'],
        category: key => this._cat3(key)
      },
      // 4단계: 개발/구현
      {
        keywords: ['개발', '구현', '기능개발', '모듈', '코드', '프로그래밍', '빌드', '릴리즈', '배포'],
        category: key => this._cat4(key)
      },
      // 5단계: 검수/품질
      {
        keywords: ['검수', '품질', '테스트', '시험', '검증', '오류', 'qa', 'test', '결함'],
        category: key => this._cat5(key)
      },
      // Z단계: 참고/부록/일반 행정
      {
        keywords: ['부록', '참고', '자료', '참조', '레퍼런스', 'appendix', 'reference',
                   '회의', '보고', '일일', '주간', '메모', '공문', '행정', '기타'],
        category: key => this._catZ(key)
      },
      // 1단계: 기획/조사/계획 — 마지막에 배치 (광범위해서 다른 것과 겹침)
      {
        keywords: ['기획', '조사', '계획', '일반사항', '개요', '현황', '타당성', '예비',
                   '방향', '연구', '분석', '기본계획', '사전', '제안', '검토', '방침'],
        category: key => this._cat1(key)
      },
    ];

    // 부서명(D0)/대분류(D1) 패턴 → S/W 매핑 (키워드 0점 시 보완)
    this._deptPatterns = [
      // ── 구조 Solution ──
      { regex: /교량/i,                            swNames: ["BridgePlanner"],              weight: 40 },
      { regex: /교각/i,                            swNames: ["PierZainer", "BridgePlanner"], weight: 55 },
      { regex: /교대|날개벽|abutment/i,            swNames: ["AbutZainer", "BridgePlanner"], weight: 55 },
      { regex: /박스.*거더|box.*거더|상자형/i,      swNames: ["BoxZainer"],                  weight: 55 },
      { regex: /옹벽|흙막이|보강토/i,              swNames: ["WallZainer"],                 weight: 55 },
      { regex: /터널/i,                            swNames: ["TunnelZainer"],               weight: 55 },
      { regex: /강선|psc|pc보|프리스트레스/i,       swNames: ["DRZainer"],                   weight: 50 },
      { regex: /nodular|절점/i,                    swNames: ["NodularZainer"],              weight: 55 },
      // ── 도로·교통 Solution ──
      { regex: /도로.*설계|선형설계|노선설계/i,     swNames: ["WayPrimal"],                  weight: 50 },
      { regex: /도로/i,                            swNames: ["WayPrimal"],                  weight: 25 },
      { regex: /교통량|교통분석|교통조사|tova/i,    swNames: ["TOVA"],                       weight: 55 },
      { regex: /고속도로|highway/i,                swNames: ["TwinHighway"],                weight: 55 },
      { regex: /bim.*도로|도로.*bim|watchbim/i,    swNames: ["WatchBIM"],                   weight: 55 },
      // ── 수리·수공 Solution ──
      { regex: /수공|수리|하천|댐|저수지|제방/i,    swNames: ["LifeLine-Water"],             weight: 50 },
      { regex: /강우|수문|홍수|유량|강수|첨두/i,    swNames: ["강우강도산정 S/W"],           weight: 55 },
      { regex: /관로|상하수도|관망|파이프망/i,      swNames: ["IPIPES"],                     weight: 55 },
      // ── 지반·지형 Solution ──
      { regex: /지반|지질|토질|기초.*설계/i,       swNames: ["천지인"],                     weight: 45 },
      { regex: /지형|수치지형|dem|dtm/i,           swNames: ["GAIA"],                       weight: 50 },
      { regex: /지반조사|시추|보링|표준관입|spt/i,  swNames: ["KNGIL"],                      weight: 55 },
      { regex: /측량|gnss|gps.*측량|기준점/i,      swNames: ["Surveyor"],                   weight: 55 },
      { regex: /gis|공간정보|수치지도/i,           swNames: ["GIS Mapper"],                 weight: 50 },
      { regex: /지적|필지|지목|토지경계/i,         swNames: ["Cadaster"],                   weight: 55 },
      // ── 서비스(시공·관리) Solution ──
      { regex: /시공관리|공정관리|건설관리|현장관리/i, swNames: ["bCMf"],                   weight: 50 },
      { regex: /안전관리|재해예방|위험성.*평가/i,   swNames: ["GSIM"],                       weight: 55 },
      // ── 그래픽·엔진 ──
      { regex: /구조해석|fem|유한요소|해석모델/i,   swNames: ["STRANA"],                     weight: 55 },
      { regex: /eg.*bim|bim.*엔진/i,              swNames: ["EG-BIM"],                     weight: 55 },
      { regex: /3d.*모델|모델러/i,                 swNames: ["3D Modeler"],                 weight: 50 },
      { regex: /hmge|hmdraw|그래픽.*엔진/i,        swNames: ["HmGE & HmDraw"],              weight: 55 },
    ];
  }

  // ─── 카테고리 헬퍼 (S/W 유형 독립적으로 적합한 카테고리 반환) ───
  _cat1(type) { const t = this.swTemplates[type]; return t?.['1.기획·조사']; }
  _cat2(type) { const t = this.swTemplates[type]; return t?.['2.엔지니어링 설계'] || t?.['2.데이터 설계·구조'] || t?.['2.UX·화면설계'] || t?.['2.수치해석·알고리즘']; }
  _cat3(type) { const t = this.swTemplates[type]; return t?.['3.기능 요건·명세']; }
  _cat4(type) { const t = this.swTemplates[type]; return t?.['4.개발·구현']; }
  _cat5(type) { const t = this.swTemplates[type]; return t?.['5.검수·품질관리'] || t?.['5.연동·검증'] || t?.['5.릴리즈·운영'] || t?.['5.성능·최적화']; }
  _catZ(type) { const t = this.swTemplates[type]; return t?.['Z.작업장·공통참조']; }

  // ─── 통합 시뮬레이션 실행 ───
  runSimulation(documents, filterOptions = { mode: 'all' }) {
    documents.forEach(doc => {
      doc.simulation = { status: 'pending', matchedBy: null, newPath: null };
    });

    let matchedCount = 0, unclassifiedCount = 0, excludedCount = 0, noSwCount = 0;
    const isGlobal = filterOptions.mode === 'all' || filterOptions.mode === 'nosw';
    const isNoSwMode = filterOptions.mode === 'nosw';

    for (let doc of documents) {
      if (doc.isAttachment) continue;

      let finalSW = null, finalCategory = null, matchedBy = null;

      // ─── TIER 0: 명시적 사용자 룰 ───
      const explicitRule = this._applyExplicitRules(doc);
      if (explicitRule) {
        matchedBy = `Tier0 (${explicitRule.id})`;
        if (explicitRule.target.swName !== 'auto') {
          finalSW = window.Store.swList.find(sw => sw.swName === explicitRule.target.swName);
        }
        finalCategory = explicitRule.target.category;
      }

      // ─── TIER 1+2: 키워드 + 부서 컨텍스트 통합 S/W 매칭 ───
      if (!finalSW) {
        const { sw, tier } = this._matchDocumentSW(doc);
        finalSW = sw;
        if (sw) matchedBy = matchedBy || tier;
      }

      if (!finalSW) {
        doc.simulation.status = 'no_sw';
        doc.simulation.newPath = {
          swName: 'S/W 미매칭', swDomain: '',
          d1_category: doc.original.d1 || '기타',
          d2_subcat: doc.original.d2 || '기타',
          d3_detail: doc.original.d3 || null,
          originalPath: this._buildOriginalPath(doc),
          originalD0: doc.original.d0
        };
        noSwCount++;
        continue;
      }

      if (isNoSwMode) { doc.simulation.status = 'excluded'; excludedCount++; continue; }

      if (!isGlobal) {
        if (filterOptions.mode === 'domain' && finalSW.domain.toLowerCase() !== filterOptions.value.toLowerCase()) {
          doc.simulation.status = 'excluded'; excludedCount++; continue;
        }
        if (filterOptions.mode === 'sw' && finalSW.swName.toLowerCase() !== filterOptions.value.toLowerCase()) {
          doc.simulation.status = 'excluded'; excludedCount++; continue;
        }
      }

      // ─── TIER 3: 카테고리 추론 (3단계 순서로) ───
      if (!finalCategory) {
        finalCategory = this._inferCategory(doc, finalSW.type);
        matchedBy = matchedBy || 'Tier3 (Heuristic)';
      }

      if (finalSW && finalCategory) {
        const subFolders = this._buildSubFolders(doc);
        doc.simulation.status = 'matched';
        doc.simulation.matchedBy = matchedBy;
        doc.simulation.newPath = {
          swName: window.Store.getDisplayName(finalSW),
          swDomain: finalSW.domain,
          d1_category: finalCategory,
          d2_subcat: subFolders.d2_subcat,
          d3_detail: subFolders.d3_detail,
          originalPath: this._buildOriginalPath(doc),
          originalD0: doc.original.d0
        };
        matchedCount++;
      } else {
        this._markAsUnclassified(doc, window.Store.getDisplayName(finalSW), "카테고리 미상");
        unclassifiedCount++;
      }
    }

    this._processAttachments(documents);

    const result = { matched: matchedCount, unclassified: unclassifiedCount, excluded: excludedCount, noSw: noSwCount, totalMain: matchedCount + unclassifiedCount + excludedCount + noSwCount };
    window.Store.lastSimResult = result;
    return result;
  }

  // ─── 카테고리 추론 (통합 진입점) ───

  /**
   * 3단계 카테고리 추론:
   *   1) D2 폴더명 토픽 기반 직접 매핑 (구글 시트 분류 로직 재현)
   *   2) 전체 맥락 키워드 매칭 (기존 휴리스틱)
   *   3) Z.작업장·공통참조 기본값 (catch-all)
   */
  _inferCategory(doc, baseType) {
    // Step 1: D2 폴더명에서 토픽 추출 → 카테고리 매핑
    const d2 = (doc.original.d2 || '').trim();
    if (d2) {
      const cat = this._inferCategoryFromD2(d2, baseType);
      if (cat) return cat;
    }

    // Step 2: 전체 맥락 키워드 매칭
    const fullCtx = [doc.original.d0, doc.original.d1, doc.original.d2, doc.original.d3, doc.fileName].join(' ').toLowerCase();
    const cat2 = this._inferCategoryFromContext(fullCtx, baseType);
    if (cat2) return cat2;

    // Step 3: catch-all
    return this._catZ(baseType);
  }

  /**
   * D2 폴더명 기반 카테고리 결정 (핵심 신규 로직)
   *
   * D2 값은 보통 "A.형상", "B-1.기획·계획", "C.일반사항" 같은 패턴
   * → 기호(A, B, C...) 접두어를 제거하고 토픽 키워드로 매핑
   */
  _inferCategoryFromD2(d2raw, baseType) {
    // 기호 접두어 제거: "A.형상", "B-1.기획" → "형상", "기획"
    const topic = d2raw.replace(/^[A-Za-z가-힣][-.]?\s*\d*[-.]?\s*/g, '').toLowerCase().trim();
    const d2lower = d2raw.toLowerCase();

    for (const rule of this._d2CategoryMap) {
      const matched = rule.keywords.some(kw => topic.includes(kw) || d2lower.includes(kw));
      if (matched) return rule.category(baseType);
    }

    return null;
  }

  /**
   * 전체 맥락 기반 카테고리 결정 (기존 휴리스틱, 한글 키워드 확장)
   */
  _inferCategoryFromContext(ctx, baseType) {
    const tmpl = this.swTemplates[baseType];
    if (!tmpl) return null;

    // 2단계: 엔지니어링/설계
    if (ctx.includes('설계') || ctx.includes('설계도') || ctx.includes('도면') ||
        ctx.includes('단면') || ctx.includes('배근') || ctx.includes('구조계산') ||
        ctx.includes('수리계산') || ctx.includes('해석') || ctx.includes('역학') ||
        ctx.includes('알고리즘') || ctx.includes('수치해석') || ctx.includes('수치') ||
        ctx.includes('단가') || ctx.includes('수량') || ctx.includes('산출') ||
        ctx.includes('db') || ctx.includes('데이터베이스') || ctx.includes('데이터 설계') ||
        ctx.includes('ux') || ctx.includes('ui') || ctx.includes('화면설계') || ctx.includes('화면') ||
        ctx.includes('3d') || ctx.includes('모델') || ctx.includes('bim') ||
        ctx.includes('cad') || ctx.includes('fem') || ctx.includes('ifc') ||
        ctx.includes('구조도') || ctx.includes('평면도') || ctx.includes('종단도') ||
        ctx.includes('횡단도') || ctx.includes('배치도') || ctx.includes('상세도') ||
        ctx.includes('앙토도') || ctx.includes('형상') ||
        ctx.includes('.dwg') || ctx.includes('.dxf') || ctx.includes('.ifc') || ctx.includes('.rvt'))
      return this._cat2(baseType);

    // 1단계: 기획/조사
    if (ctx.includes('기획') || ctx.includes('조사') || ctx.includes('계획') ||
        ctx.includes('마스터플랜') || ctx.includes('연구') || ctx.includes('분석') ||
        ctx.includes('타당성') || ctx.includes('예비타당성') || ctx.includes('현황') ||
        ctx.includes('개요') || ctx.includes('제안') || ctx.includes('검토') ||
        ctx.includes('방향') || ctx.includes('기본계획') || ctx.includes('일반사항'))
      return this._cat1(baseType);

    // 3단계: 요건/명세
    if (ctx.includes('요구사항') || ctx.includes('요건') || ctx.includes('사양') ||
        ctx.includes('명세') || ctx.includes('spec') || ctx.includes('기능정의') ||
        ctx.includes('정의서') || ctx.includes('requirement'))
      return this._cat3(baseType);

    // 4단계: 개발/구현
    if (ctx.includes('개발') || ctx.includes('구현') || ctx.includes('코드') ||
        ctx.includes('소스') || ctx.includes('프로토') || ctx.includes('빌드') ||
        ctx.includes('모듈') || ctx.includes('version') || ctx.includes('ver') ||
        ctx.includes('릴리즈') || ctx.includes('배포') || ctx.includes('프로그램') ||
        ctx.includes('api') || ctx.includes('sw개발'))
      return this._cat4(baseType);

    // 5단계: 검수/품질
    if (ctx.includes('검수') || ctx.includes('테스트') || ctx.includes('품질') ||
        ctx.includes('오류') || ctx.includes('결함') || ctx.includes('검증') ||
        ctx.includes('qa') || ctx.includes('bug') || ctx.includes('시험') ||
        ctx.includes('검사') || ctx.includes('성능테스트'))
      return this._cat5(baseType);

    return null;
  }

  // ─── 하위 폴더 구성 (GS 구조 재현) ───

  /**
   * GS 구조: 새 D2 = 원본 D3 (더 구체적인 서브토픽을 상위로 승격)
   *          새 D3 = null (한 레벨 평탄화)
   * 원본 D3가 없으면 원본 D2를 사용
   */
  _buildSubFolders(doc) {
    const d3 = (doc.original.d3 || '').trim();
    const d2 = (doc.original.d2 || '').trim();

    // D3가 있으면 D3를 새 D2로 승격 (GS 패턴과 일치)
    // D3가 없으면 D2를 그대로 사용
    const d2_subcat = d3 || d2 || '기타';
    const d3_detail = null; // 평탄화: GS는 D1-D2-파일 3단계 구조

    return { d2_subcat, d3_detail };
  }

  // ─── S/W 매칭 ───

  _matchDocumentSW(doc) {
    const swList = window.Store.swList.filter(sw => !sw.isExcluded && sw.type !== 'None');
    const scoreMap = new Map();
    swList.forEach(sw => scoreMap.set(sw, 0));

    // Tier 1: 키워드 점수
    for (const sw of swList) {
      let score = 0;
      for (const keyword of sw.keywords) {
        const kw = keyword.toLowerCase().trim();
        if (!kw) continue;
        if (doc.fileName.toLowerCase().includes(kw))          score += 100 + kw.length * 2;
        if (doc.original.d3?.toLowerCase().includes(kw))      score += 50 + kw.length;
        if (doc.original.d2?.toLowerCase().includes(kw))      score += 30 + kw.length;
        if (doc.original.d1?.toLowerCase().includes(kw))      score += 10 + kw.length;
        if (doc.original.d0?.toLowerCase().includes(kw))      score +=  5 + kw.length;
      }
      if (score > 0) scoreMap.set(sw, score);
    }

    // Tier 2: 부서/맥락 패턴 점수
    const deptCtx = [doc.original.d0, doc.original.d1, doc.original.d2].join(' ');
    for (const dp of this._deptPatterns) {
      if (dp.regex.test(deptCtx)) {
        for (const swName of dp.swNames) {
          const sw = swList.find(s => s.swName === swName);
          if (sw) scoreMap.set(sw, (scoreMap.get(sw) || 0) + dp.weight);
        }
      }
    }

    let bestSW = null, maxScore = 0;
    for (const [sw, score] of scoreMap) {
      if (score > maxScore) { maxScore = score; bestSW = sw; }
    }

    if (!bestSW) return { sw: null, tier: null };
    const kwContrib = this._calcKeywordScore(doc, bestSW);
    return { sw: bestSW, tier: kwContrib > 0 ? 'Tier1 (Keyword)' : 'Tier2 (Dept Context)' };
  }

  _calcKeywordScore(doc, sw) {
    let score = 0;
    for (const keyword of sw.keywords) {
      const kw = keyword.toLowerCase().trim();
      if (!kw) continue;
      const fields = [doc.fileName, doc.original.d3, doc.original.d2, doc.original.d1, doc.original.d0];
      if (fields.some(f => f?.toLowerCase().includes(kw))) score++;
    }
    return score;
  }

  // ─── 공통 헬퍼 ───

  _markAsUnclassified(doc, swName, reason) {
    doc.simulation.status = 'unclassified';
    doc.simulation.newPath = {
      swName, swDomain: '',
      d1_category: "Z.미분류", d2_subcat: reason, d3_detail: null,
      originalPath: this._buildOriginalPath(doc), originalD0: doc.original.d0
    };
  }

  _applyExplicitRules(doc) {
    for (const rule of window.Store.rules.filter(r => r.enabled)) {
      if (this._evaluateCondition(doc, rule.condition)) return rule;
    }
    return null;
  }

  _evaluateCondition(doc, cond) {
    let tv = '';
    if (cond.field === 'd0') tv = doc.original.d0;
    else if (cond.field === 'd1') tv = doc.original.d1;
    else if (cond.field === 'd2') tv = doc.original.d2;
    else if (cond.field === 'd3') tv = doc.original.d3;
    else if (cond.field === 'filename') tv = doc.fileName;
    tv = (tv || '').toLowerCase();
    const cv = cond.value.toLowerCase();
    if (cond.operator === 'equals') return tv === cv;
    if (cond.operator === 'contains') return tv.includes(cv);
    if (cond.operator === 'endswith') return tv.endsWith(cv);
    return false;
  }

  _buildOriginalPath(doc) {
    return [doc.original.d0, doc.original.d1, doc.original.d2].filter(x => x).join(' > ');
  }

  _processAttachments(documents) {
    for (let doc of documents) {
      if (doc.isAttachment && doc.mainDocumentId) {
        const mainDoc = documents.find(d => d.id === doc.mainDocumentId);
        if (mainDoc) {
          doc.simulation.status = mainDoc.simulation.status;
          doc.simulation.matchedBy = mainDoc.simulation.matchedBy;
          doc.simulation.newPath = mainDoc.simulation.newPath ? { ...mainDoc.simulation.newPath } : null;
        }
      }
    }
  }
}

window.RuleEngine = RuleEngine;
