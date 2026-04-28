/**
 * 엑셀 파서 로직
 * SheetJS 연동 및 데이터 정제, _attachment 종속성 해결
 */

class ExcelParser {
  /**
   * 엑셀 파일을 읽고 파싱합니다.
   * @param {File} file 
   * @param {Function} onComplete 콜백 (파싱 완료 시)
   */
  static parse(file, onComplete) {
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // header: 1 옵션으로 배열의 배열([][]) 형태로 가져옴
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      this.processRows(rows);
      if(onComplete) onComplete();
    };

    reader.readAsArrayBuffer(file);
  }

  static processRows(rows) {
    // 초기화
    window.Store.documents = [];
    window.Store.mainDocsCount = 0;
    window.Store.attachDocsCount = 0;
    
    // 메인 문서 빠른 검색용 Map (key: fileName, value: Document instance)
    const mainDocMap = new Map();
    // 나중에 처리할 첨부문서들 대기열
    const attachQueue = [];

    // 0번 인덱스는 헤더이므로 1번부터 순회
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const confirm = String(row[0] || '').trim();
      const path1 = String(row[1] || '').trim();
      const path2 = String(row[2] || '').trim();
      const path3 = String(row[3] || '').trim();
      const path4 = String(row[4] || '').trim();

      if (!path4) continue; // 파일명이 없는 행 무시

      const doc = new window.DocumentModel(i, confirm, path1, path2, path3, path4);
      window.Store.documents.push(doc);

      if (doc.isAttachment) {
        window.Store.attachDocsCount++;
        attachQueue.push(doc);
      } else {
        window.Store.mainDocsCount++;
        // 나중에 첨부를 찾아주기 위해 파일명 길이 자르고 이런거 필요 없이 그냥 통째로 매핑?
        // 엑셀에서 "_attachment"가 붙는 구조가 정확히 원본파일명 + "_attachment" 인지 확인 필요.
        // 예: "abc.hwp" -> "abc.hwp_attachment"
        mainDocMap.set(doc.fileName, doc);
      }
    }

    // 첨부문서들을 순회하며 메인 문서 찾기
    for (let attach of attachQueue) {
      // _attachment 제거 후 이름
      let baseName = attach.fileName.replace(/_attachemt$/, '').replace(/_attachment$/, '');
      if (mainDocMap.has(baseName)) {
        const mainDoc = mainDocMap.get(baseName);
        attach.mainDocumentId = mainDoc.id; // 메인 문서를 가리킴
      } else {
        // 매칭되는 메인문서가 없는 경우 (고아 첨부파일)
        // 일단은 미분류 대상에서 단독으로 처리되게 둠
      }
    }
    
    console.log(`파싱 완료: 총 ${window.Store.documents.length}건 (메인 ${window.Store.mainDocsCount}, 첨부 ${window.Store.attachDocsCount})`);
  }
}

window.ExcelParser = ExcelParser;
