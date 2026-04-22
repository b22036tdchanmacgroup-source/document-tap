/**
 * 하이브리드 규칙 엔진 (Rule Engine) — 차세대 엔진 (Phase 1)
 * Tier 1: 사용자 명시적 조건 룰 (Explicit Rules)
 * Tier 2: 크로스부서 키워드 기반 휴리스틱 (Fallback)
 */

class RuleEngine {
  constructor() {
    // 2단계 카테고리 명칭 (S/W 유형별)
    this.swTemplates = {
      "A": {
        "1.기획·조사": "1.기획·조사", "2.엔지니어링 설계": "2.엔지니어링 설계", "3.기능 요건·명세": "3.기능 요건·명세",
        "4.개발·구현": "4.개발·구현", "5.검수·품질관리": "5.검수·품질관리", "Z.작업장·공통참조": "Z.작업장·공통참조"
      },
      "B": {
        "1.기획·조사": "1.기획·조사", "2.데이터 설계·구조": "2.데이터 설계·구조", "3.기능 요건·명세": "3.기능 요건·명세",
        "4.개발·구현": "4.개발·구현", "5.연동·검증": "5.연동·검증", "Z.작업장·공통참조": "Z.작업장·공통참조"
      },
      "C": {
        "1.기획·조사": "1.기획·조사", "2.UX·화면설계": "2.UX·화면설계", "3.기능 요건·명세": "3.기능 요건·명세",
        "4.개발·구현": "4.개발·구현", "5.릴리즈·운영": "5.릴리즈·운영", "Z.작업장·공통참조": "Z.작업장·공통참조"
      },
      "D": {
        "1.기획·조사": "1.기획·조사", "2.수치해석·알고리즘": "2.수치해석·알고리즘", "3.기능 요건·명세": "3.기능 요건·명세",
        "4.개발·구현": "4.개발·구현", "5.성능·최적화": "5.성능·최적화", "Z.작업장·공통참조": "Z.작업장·공통참조"
      }
    };
  }

  // ─── 통합 시뮬레이션 실행 ───
  // filterOptions: { mode: 'all' | 'domain' | 'sw', value: string }
  runSimulation(documents, filterOptions = { mode: 'all' }) {
    // 초기화
    documents.forEach(doc => {
      doc.simulation = { status: 'pending', matchedBy: null, newPath: null };
    });

    let matchedCount = 0;
    let unclassifiedCount = 0;
    let excludedCount = 0;
    const isGlobal = filterOptions.mode === 'all';

    // === 필터 설정 ===
    let targetDomains = [];
    let targetSWNames = [];
    
    if (filterOptions.mode === 'domain') {
      targetDomains.push(filterOptions.value.toLowerCase());
    } else if (filterOptions.mode === 'sw') {
      targetSWNames.push(filterOptions.value.toLowerCase());
    }

    // 문서 순회 처리
    for (let doc of documents) {
      if (doc.isAttachment) continue;

      let finalSW = null;
      let finalCategory = null;
      let matchedBy = null;

      // ─── TIER 1: 명시적 사용자 룰 평가 ───
      const explicitRule = this._applyExplicitRules(doc);
      if (explicitRule) {
        matchedBy = `Tier1 (${explicitRule.id})`;
        if (explicitRule.target.swName !== 'auto') {
          finalSW = window.Store.swList.find(sw => sw.swName === explicitRule.target.swName);
        }
        finalCategory = explicitRule.target.category; 
      }

      // ─── TIER 2: 휴리스틱 S/W 파악 ───
      if (!finalSW) {
        finalSW = this._matchDocumentSWFallback(doc);
      }

      if (!finalSW) {
        this._markAsUnclassified(doc, "S/W 미상", "검토 필요");
        unclassifiedCount++;
        continue;
      }

      // === 단일 S/W 모드 또는 분야(Domain) 모드 사후 필터링 ===
      if (!isGlobal) {
        if (filterOptions.mode === 'domain' && finalSW.domain.toLowerCase() !== filterOptions.value.toLowerCase()) {
           doc.simulation.status = 'excluded';
           excludedCount++;
           continue;
        }
        if (filterOptions.mode === 'sw' && finalSW.swName.toLowerCase() !== filterOptions.value.toLowerCase()) {
           doc.simulation.status = 'excluded';
           excludedCount++;
           continue;
        }
      }

      // ─── TIER 2: 휴리스틱 파악 (Tier1에서 카테고리를 못 잡은 경우) ───
      if (!finalCategory) {
        const docContext = [doc.original.d0, doc.original.d1, doc.original.d2, doc.original.d3, doc.fileName].join(' ').toLowerCase();
        const inferred = this._inferCategoryFallback(docContext, finalSW.type);
        
        if (inferred) {
          finalCategory = inferred;
          matchedBy = matchedBy || 'Tier2 (Heuristic)';
        }
      }

      // ─── 최종 성공 판정 ───
      if (finalSW && finalCategory) {
        const subFolders = this._buildSubFolders(doc);
        const originalPath = this._buildOriginalPath(doc);
        
        doc.simulation.status = 'matched';
        doc.simulation.matchedBy = matchedBy;
        doc.simulation.newPath = {
          swName: window.Store.getDisplayName(finalSW),
          swDomain: finalSW.domain,
          d1_category: finalCategory,
          d2_subcat: subFolders.d2_subcat,
          d3_detail: subFolders.d3_detail,
          originalPath: originalPath,
          originalD0: doc.original.d0
        };
        matchedCount++;
      } else {
        this._markAsUnclassified(doc, window.Store.getDisplayName(finalSW), "카테고리 미상");
        unclassifiedCount++;
      }
    }

    // 첨부문서 처리 (메인을 따라감)
    this._processAttachments(documents);

    const result = { matched: matchedCount, unclassified: unclassifiedCount, excluded: excludedCount, totalMain: matchedCount + unclassifiedCount + excludedCount };
    window.Store.lastSimResult = result;
    return result;
  }

  // ─── 내부 헬퍼 메서드 ───

  _markAsUnclassified(doc, swName, reason) {
    doc.simulation.status = 'unclassified';
    doc.simulation.newPath = {
      swName: swName,
      swDomain: '',
      d1_category: "Z.미분류",
      d2_subcat: reason,
      d3_detail: null,
      originalPath: this._buildOriginalPath(doc),
      originalD0: doc.original.d0
    };
  }

  /** Tier 1: 명시적 규칙 적용 */
  _applyExplicitRules(doc) {
    const rules = window.Store.rules.filter(r => r.enabled);
    for (const rule of rules) {
      if (this._evaluateCondition(doc, rule.condition)) {
         return rule; // 적용할 rule 통째로 반환
      }
    }
    return null;
  }

  /** 조건문 파서 */
  _evaluateCondition(doc, cond) {
     let targetValue = '';
     if (cond.field === 'd0') targetValue = doc.original.d0;
     else if (cond.field === 'd1') targetValue = doc.original.d1;
     else if (cond.field === 'd2') targetValue = doc.original.d2;
     else if (cond.field === 'd3') targetValue = doc.original.d3;
     else if (cond.field === 'filename') targetValue = doc.fileName;

     targetValue = targetValue.toLowerCase();
     const condValue = cond.value.toLowerCase();

     if (cond.operator === 'equals') return targetValue === condValue;
     if (cond.operator === 'contains') return targetValue.includes(condValue);
     if (cond.operator === 'endswith') return targetValue.endsWith(condValue);
     return false;
  }

  /** Tier 2 Fallback: 가중치 기반 가장 적합한 S/W 찾기 (파일명 > 하위폴더 > 상위폴더) */
  _matchDocumentSWFallback(doc) {
    const swList = window.Store.swList;
    
    let bestMatch = null;
    let maxScore = 0;

    for (const sw of swList) {
      if (sw.isExcluded || sw.type === 'None') continue;
      
      let score = 0;
      for (const keyword of sw.keywords) {
        const kw = keyword.toLowerCase();
        if(!kw) continue;
        
        // 가중치: 파일명 매칭 시 제일 높은 점수
        if (doc.fileName.toLowerCase().includes(kw)) score += 100 + kw.length;
        // 하위 폴더일수록 해당 S/W에 대한 강력한 단서
        if (doc.original.d3?.toLowerCase().includes(kw)) score += 50 + kw.length;
        if (doc.original.d2?.toLowerCase().includes(kw)) score += 30 + kw.length;
        if (doc.original.d1?.toLowerCase().includes(kw)) score += 10 + kw.length;
        if (doc.original.d0?.toLowerCase().includes(kw)) score += 5 + kw.length;
      }
      
      if (score > maxScore) {
        maxScore = score;
        bestMatch = sw;
      }
    }
    return bestMatch;
  }

  /** Tier 2 Fallback: 휴리스틱 문맥으로 Category 찾기 */
  _inferCategoryFallback(docContext, baseType) {
    const tmpl = this.swTemplates[baseType];
    if (!tmpl) return null;
    const ctx = docContext.toLowerCase();

    if (ctx.includes('수량') || ctx.includes('설계도') || ctx.includes('단가') ||
        ctx.includes('구조계산') || ctx.includes('db') || ctx.includes('데이터베이스') ||
        ctx.includes('알고리즘') || ctx.includes('해석') || ctx.includes('ux') ||
        ctx.includes('ui') || ctx.includes('화면') || ctx.includes('산출') ||
        ctx.includes('도면') || ctx.includes('3d') || ctx.includes('모델') ||
        ctx.endsWith('.dwg') || ctx.endsWith('.dxf') || ctx.endsWith('.ifc')) return tmpl['2.엔지니어링 설계'] || tmpl['2.데이터 설계·구조'] || tmpl['2.UX·화면설계'] || tmpl['2.수치해석·알고리즘'];
    
    if (ctx.includes('기획') || ctx.includes('조사') || ctx.includes('계획') ||
        ctx.includes('마스터플랜') || ctx.includes('연구') || ctx.includes('분석')) return tmpl['1.기획·조사'];
    
    if (ctx.includes('요구사항') || ctx.includes('요건') || ctx.includes('사양') ||
        ctx.includes('명세') || ctx.includes('spec') || ctx.includes('기능정의')) return tmpl['3.기능 요건·명세'];
    
    if (ctx.includes('코드') || ctx.includes('개발') || ctx.includes('구현') ||
        ctx.includes('소스') || ctx.includes('프로토') || ctx.includes('빌드') ||
        ctx.includes('기능') || ctx.includes('모듈') || ctx.includes('version') ||
        ctx.includes('ver') || ctx.includes('릴리즈')) return tmpl['4.개발·구현'];
    
    if (ctx.includes('검수') || ctx.includes('테스트') || ctx.includes('품질') ||
        ctx.includes('오류') || ctx.includes('결함') || ctx.includes('검증') ||
        ctx.includes('qa') || ctx.includes('bug')) return tmpl['5.검수·품질관리'] || tmpl['5.연동·검증'] || tmpl['5.릴리즈·운영'] || tmpl['5.성능·최적화'];
    
    if (ctx.includes('회의') || ctx.includes('세미나') || ctx.includes('보고') ||
        ctx.includes('참고') || ctx.includes('일일') || ctx.includes('주간') ||
        ctx.includes('공문') || ctx.includes('memo') || ctx.includes('temp') ||
        ctx.includes('작업') || ctx.includes('raw data') || ctx.includes('안전') || 
        ctx.includes('공정') || ctx.includes('기성') || ctx.includes('환경') || ctx.includes('민원')) return tmpl['Z.작업장·공통참조'];

    return null;
  }

  _buildOriginalPath(doc) {
    return [doc.original.d0, doc.original.d1, doc.original.d2].filter(x => x).join(' > ');
  }

  _buildSubFolders(doc) {
    return {
      d2_subcat: doc.original.d2 || '기타',
      d3_detail: doc.original.d3 || null
    };
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
