/**
 * 규칙 엔진 코어 — Phase 2
 * 키워드 기반 크로스부서 매칭 + 넘버링 체계 1,2,3/A,B,C/A-1
 * 대소문자 무시, 전사 전체 문서에서 키워드 스캔
 */

class RuleEngine {
  constructor() {
    // 2단계 폴더 템플릿 (번호 1,2,3...Z)
    this.swTemplates = {
      "A": {
        "기획명세": "1.기획·조사",
        "엔지니어링": "2.엔지니어링 설계",
        "요건": "3.기능 요건·명세",
        "개발": "4.개발·구현",
        "검수": "5.검수·품질관리",
        "작업장": "Z.작업장·공통참조"
      },
      "B": {
        "기획명세": "1.기획·조사",
        "엔지니어링": "2.데이터 설계·구조",
        "요건": "3.기능 요건·명세",
        "개발": "4.개발·구현",
        "검수": "5.연동·검증",
        "작업장": "Z.작업장·공통참조"
      },
      "C": {
        "기획명세": "1.기획·조사",
        "엔지니어링": "2.UX·화면설계",
        "요건": "3.기능 요건·명세",
        "개발": "4.개발·구현",
        "검수": "5.릴리즈·운영",
        "작업장": "Z.작업장·공통참조"
      },
      "D": {
        "기획명세": "1.기획·조사",
        "엔지니어링": "2.수치해석·알고리즘",
        "요건": "3.기능 요건·명세",
        "개발": "4.개발·구현",
        "검수": "5.성능·최적화",
        "작업장": "Z.작업장·공통참조"
      }
    };
  }

  /**
   * 문서 맥락에서 2단계 카테고리 추론
   */
  inferCategory(docContext, baseType) {
    if (!this.swTemplates[baseType]) return null;
    const ctx = docContext.toLowerCase();

    // 엔지니어링/설계 계열
    if (ctx.includes('수량') || ctx.includes('설계도') || ctx.includes('단가') ||
        ctx.includes('구조계산') || ctx.includes('db') || ctx.includes('데이터베이스') ||
        ctx.includes('알고리즘') || ctx.includes('해석') || ctx.includes('ux') ||
        ctx.includes('ui') || ctx.includes('화면') || ctx.includes('산출') ||
        ctx.includes('도면') || ctx.includes('3d') || ctx.includes('모델')) {
      return this.swTemplates[baseType]['엔지니어링'];
    }
    // 기획
    if (ctx.includes('기획') || ctx.includes('조사') || ctx.includes('계획') ||
        ctx.includes('마스터플랜') || ctx.includes('project master') ||
        ctx.includes('연구') || ctx.includes('분석')) {
      return this.swTemplates[baseType]['기획명세'];
    }
    // 요건·명세
    if (ctx.includes('요구사항') || ctx.includes('요건') || ctx.includes('사양') ||
        ctx.includes('명세') || ctx.includes('spec') || ctx.includes('기능정의')) {
      return this.swTemplates[baseType]['요건'];
    }
    // 개발
    if (ctx.includes('코드') || ctx.includes('개발') || ctx.includes('구현') ||
        ctx.includes('소스') || ctx.includes('프로토') || ctx.includes('빌드') ||
        ctx.includes('기능') || ctx.includes('모듈') || ctx.includes('version') ||
        ctx.includes('ver') || ctx.includes('릴리즈')) {
      return this.swTemplates[baseType]['개발'];
    }
    // 검수·품질
    if (ctx.includes('검수') || ctx.includes('테스트') || ctx.includes('품질') ||
        ctx.includes('오류') || ctx.includes('결함') || ctx.includes('검증') ||
        ctx.includes('qa') || ctx.includes('bug')) {
      return this.swTemplates[baseType]['검수'];
    }
    // 파일 확장자 기반
    if (ctx.endsWith('.dwg') || ctx.endsWith('.dxf') || ctx.endsWith('.ifc')) {
      return this.swTemplates[baseType]['엔지니어링'];
    }
    // 작업장·참고
    if (ctx.includes('회의') || ctx.includes('세미나') || ctx.includes('보고') ||
        ctx.includes('참고') || ctx.includes('일일') || ctx.includes('주간') ||
        ctx.includes('공문') || ctx.includes('memo') || ctx.includes('temp') ||
        ctx.includes('작업') || ctx.includes('raw data') || ctx.includes('raw_data') ||
        ctx.includes('안전') || ctx.includes('공정') || ctx.includes('기성') ||
        ctx.includes('품질') || ctx.includes('환경') || ctx.includes('민원')) {
      return this.swTemplates[baseType]['작업장'];
    }

    return null;
  }

  /**
   * 원본 경로 문자열
   */
  _buildOriginalPath(doc) {
    return [doc.original.d0, doc.original.d1, doc.original.d2].filter(x => x).join(' > ');
  }

  /**
   * 3~4단계 하위 폴더 정보 (원본 기반, 넘버링은 UI에서 부여)
   */
  _buildSubFolders(doc) {
    return {
      d2_subcat: doc.original.d2 || '기타',
      d3_detail: doc.original.d3 || null
    };
  }

  /**
   * 키워드 매칭: 문서 맥락에서 swList의 keywords 와 비교 (대소문자 무시)
   * 크로스부서 스캔: 어떤 부서(D0)에 있든 키워드에 걸리면 해당 S/W로 분류
   * @returns {Object|null} 매칭된 swList 항목
   */
  _matchDocument(doc) {
    const swList = window.Store.swList;
    // 문서의 전체 맥락: D0 + D1 + D2 + D3 + 파일명
    const docContext = [
      doc.original.d0, doc.original.d1,
      doc.original.d2, doc.original.d3,
      doc.fileName
    ].join(' ').toLowerCase();

    // 가장 긴 키워드 매칭 우선 (정확도 높은 것 우선)
    let bestMatch = null;
    let bestKeyLen = 0;

    for (const sw of swList) {
      if (sw.isExcluded || sw.type === 'None') continue;

      for (const keyword of sw.keywords) {
        const kw = keyword.toLowerCase();
        if (docContext.includes(kw) && kw.length > bestKeyLen) {
          bestMatch = sw;
          bestKeyLen = kw.length;
        }
      }
    }

    return bestMatch;
  }

  /**
   * 단일 S/W 키워드 스캔
   */
  runGlobal(documents, targetKeyword, templateType) {
    const keywords = targetKeyword.toLowerCase().split(',').map(k => k.trim()).filter(k => k);
    if (keywords.length === 0) return { matched: 0, unclassified: 0, excluded: documents.length };

    documents.forEach(doc => {
      doc.simulation = { status: 'pending', matchedRuleType: null, newPath: null };
    });

    let matchedCount = 0;
    let unclassifiedCount = 0;
    let excludedCount = 0;

    // 단일 S/W에 해당하는 swList entry 찾기
    const targetSW = window.Store.swList.find(sw =>
      sw.swName.toLowerCase() === targetKeyword.toLowerCase() ||
      sw.keywords.some(kw => keywords.includes(kw.toLowerCase()))
    );

    const displayName = targetSW
      ? window.Store.getDisplayName(targetSW)
      : targetKeyword;

    for (let doc of documents) {
      if (doc.isAttachment) continue;

      const docContext = [doc.original.d0, doc.original.d1, doc.original.d2, doc.original.d3, doc.fileName].join(' ').toLowerCase();
      const isTargeted = keywords.some(kw => docContext.includes(kw));

      if (!isTargeted) {
        doc.simulation.status = 'excluded';
        excludedCount++;
        continue;
      }

      const inferredCategory = this.inferCategory(docContext, templateType);
      const subFolders = this._buildSubFolders(doc);
      const originalPath = this._buildOriginalPath(doc);

      if (inferredCategory) {
        doc.simulation.status = 'matched';
        doc.simulation.newPath = {
          swName: displayName,
          swDomain: targetSW ? targetSW.domain : '',
          d1_category: inferredCategory,
          d2_subcat: subFolders.d2_subcat,
          d3_detail: subFolders.d3_detail,
          originalPath: originalPath,
          originalD0: doc.original.d0
        };
        matchedCount++;
      } else {
        doc.simulation.status = 'unclassified';
        doc.simulation.newPath = {
          swName: displayName,
          swDomain: targetSW ? targetSW.domain : '',
          d1_category: "Z.미분류",
          d2_subcat: "검토 필요",
          d3_detail: null,
          originalPath: originalPath,
          originalD0: doc.original.d0
        };
        unclassifiedCount++;
      }
    }

    this._processAttachments(documents);

    const result = { matched: matchedCount, unclassified: unclassifiedCount, excluded: excludedCount, totalMain: matchedCount + unclassifiedCount + excludedCount };
    window.Store.lastSimResult = result;
    return result;
  }

  /**
   * 전체 S/W 일괄 이관 (swList 기반 크로스부서 키워드 매칭)
   */
  runGlobalAll(documents) {
    documents.forEach(doc => {
      doc.simulation = { status: 'pending', matchedRuleType: null, newPath: null };
    });

    let matchedCount = 0;
    let unclassifiedCount = 0;
    let excludedCount = 0;

    for (let doc of documents) {
      if (doc.isAttachment) continue;

      const matchedSW = this._matchDocument(doc);

      if (!matchedSW) {
        doc.simulation.status = 'excluded';
        excludedCount++;
        continue;
      }

      const templateType = matchedSW.type;
      const displayName = window.Store.getDisplayName(matchedSW);
      const docContext = [doc.original.d0, doc.original.d1, doc.original.d2, doc.original.d3, doc.fileName].join(' ').toLowerCase();
      const inferredCategory = this.inferCategory(docContext, templateType);
      const subFolders = this._buildSubFolders(doc);
      const originalPath = this._buildOriginalPath(doc);

      if (inferredCategory) {
        doc.simulation.status = 'matched';
        doc.simulation.newPath = {
          swName: displayName,
          swDomain: matchedSW.domain,
          d1_category: inferredCategory,
          d2_subcat: subFolders.d2_subcat,
          d3_detail: subFolders.d3_detail,
          originalPath: originalPath,
          originalD0: doc.original.d0
        };
        matchedCount++;
      } else {
        doc.simulation.status = 'unclassified';
        doc.simulation.newPath = {
          swName: displayName,
          swDomain: matchedSW.domain,
          d1_category: "Z.미분류",
          d2_subcat: "검토 필요",
          d3_detail: null,
          originalPath: originalPath,
          originalD0: doc.original.d0
        };
        unclassifiedCount++;
      }
    }

    this._processAttachments(documents);

    const result = { matched: matchedCount, unclassified: unclassifiedCount, excluded: excludedCount, totalMain: matchedCount + unclassifiedCount + excludedCount };
    window.Store.lastSimResult = result;
    return result;
  }

  /**
   * 첨부파일 처리
   */
  _processAttachments(documents) {
    for (let doc of documents) {
      if (doc.isAttachment && doc.mainDocumentId) {
        const mainDoc = documents.find(d => d.id === doc.mainDocumentId);
        if (mainDoc) {
          doc.simulation.status = mainDoc.simulation.status;
          doc.simulation.newPath = mainDoc.simulation.newPath ? { ...mainDoc.simulation.newPath } : null;
        }
      }
    }
  }
}

window.RuleEngine = RuleEngine;
