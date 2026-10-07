# 공용 Google Sheet 연결 방법

1. [설문기록 시트](https://docs.google.com/spreadsheets/d/1o2Cu2nkmiyiNo1lsz8VNBrly43EltYo0UmHMKC0Nuds/edit)의 **확장 프로그램 → Apps Script**를 엽니다.
2. 기본 `Code.gs` 내용을 지우고 `apps-script/Code.gs` 전체를 붙여 넣은 뒤 저장합니다.
3. **배포 → 새 배포 → 웹 앱**을 선택합니다.
4. 실행 사용자: **나**, 액세스 권한: **모든 사용자**로 설정하고 배포합니다. 권한을 승인합니다.
5. 끝이 `/exec`인 웹 앱 URL을 복사합니다.
6. `config.js`의 `SLEEPWELL_SHARED_ENDPOINT`에 URL을 넣어 GitHub에 올립니다.

공개 GET은 참여자·날짜·저장 시각만 반환합니다. 카페인·피로·심박 등 상세값은 Google Sheet 안에만 저장됩니다.
