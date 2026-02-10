# Quota File Validation Tool - Project Documentation

## Overview

Sales Compensation Quota 파일을 Reference 파일과 대조하여 3가지 검증을 수행하는 웹 앱.
클라이언트 사이드 전용 (서버 없음, 데이터 외부 전송 없음).

- **GitHub Repo**: https://github.com/LI-JBLEE/QuotaValidator
- **Live URL**: https://li-jblee.github.io/QuotaValidator/
- **Tech Stack**: Vite + React + TypeScript + Tailwind CSS + SheetJS (xlsx)
- **Project Path**: `C:\Claude\Quota_validation\quota-validation-app\`

---

## App Features

### Input Files
1. **Quota File** (.xlsx): IC Quota, MGR Quota 등 "Quota"로 끝나는 시트를 자동 감지 (Instructions, hidden 시트 제외)
2. **Reference File** (.xlsx): Sales Compensation Report (Daily) - "Employee ID" 헤더를 자동 탐색

### Configuration
- **Submission Month**: Mon-YY 형식 드롭다운 (예: Jan-26, Oct-25) - 파일 업로드 시 자동 파싱
- **Region**: APAC / EMEAL / NAMER 선택

### Validations

#### V1: EID Reference Check
- Quota 파일의 각 EID가 Reference 파일에 존재하는지 확인
- 조건: Active Status = "Yes", On Leave = blank, Country가 선택된 Region에 포함
- TBH/blank EID는 "SKIP"으로 분류

#### V2: Duplicate EID Check
- 선택된 submission month 내에서 동일 EID가 여러 시트에 중복 존재하는지 확인

#### V3: Quota Amount Completeness
- Quota Start Date 이후 해당 fiscal half 기간의 월별 금액이 채워져 있는지 확인
- **Fiscal Half**: H1 (Jul-Dec) for submission months 7-12, H2 (Jan-Jun) for submission months 1-6
- **Components checked**:
  - Comp1 Y1 (모든 레코드)
  - Comp1 Y2&Y3 (해당 컬럼이 있는 경우)
  - Comp2 Y1 (Single/Dual Metric = "DMC"인 경우만)
  - Comp2 Y2&Y3 (DMC + 해당 컬럼이 있는 경우만)
- Missing/zero 값을 빨간색으로 표시

### Export
- Export All (CSV): V1+V2+V3 통합
- V1 - Failed Only / V1 - All
- V2 - Duplicates
- V3 - Missing Quota

---

## File Structure

```
quota-validation-app/
├── .github/workflows/deploy.yml   # GitHub Pages 자동 배포
├── src/
│   ├── App.tsx                     # Main app, state management, reset
│   ├── types.ts                    # 모든 타입 정의, Region/Country 매핑
│   ├── components/
│   │   ├── FileUpload.tsx          # Drag & drop 파일 업로드
│   │   ├── ConfigPanel.tsx         # Month 드롭다운 + Region 선택
│   │   └── ResultsPanel.tsx        # 결과 테이블 (V1/V2/V3 탭)
│   └── utils/
│       ├── excelParser.ts          # Excel 파싱, 동적 컬럼 감지
│       ├── validators.ts           # 3가지 검증 로직
│       └── csvExport.ts            # CSV 내보내기
├── vite.config.ts                  # base: '/QuotaValidator/'
├── package.json
└── tsconfig.json
```

---

## Key Technical Decisions & Fixes

### 1. Timezone 문제 해결
- **문제**: Excel serial 날짜를 `cellDates: true`로 파싱하면 timezone offset으로 날짜가 하루 밀림 (예: Jan 1, 2026 -> Dec 31, 2025)
- **해결**: `cellDates` 사용 안 함. Raw serial number를 직접 `Date.UTC()`로 변환하는 `excelSerialToDate()` 함수 구현. 모든 곳에서 `getUTCFullYear()`/`getUTCMonth()` 사용.

### 2. Reference 파일 !ref 메타데이터 오류
- **문제**: 일부 Excel 파일의 `!ref`가 "A1"로만 설정되어 1행만 읽힘
- **해결**: `fixSheetRange()` 함수로 실제 셀 키를 스캔하여 올바른 범위 재계산

### 3. 동적 컬럼 감지 (LSS vs LTS 호환)
- **문제**: LSS 파일은 단순 "JAN" 헤더, LTS 파일은 "Comp1: Y1 - JAN" 형식으로 컬럼 위치가 다름
- **해결**: `detectQuotaColumns()` 함수가 헤더 행(row index 4)을 스캔하여 컬럼 위치를 자동 감지. 4가지 카테고리로 분류:
  - Comp1 Y1: COMP2도 Y2도 없는 월 컬럼
  - Comp1 Y2&Y3: Y2가 있고 COMP2는 없는 월 컬럼
  - Comp2 Y1: COMP2가 있고 Y2는 없는 월 컬럼
  - Comp2 Y2&Y3: COMP2와 Y2가 모두 있는 월 컬럼

### 4. Sheet 필터링
- "Instructions" 시트 제외
- Hidden 시트 제외 (`wb.Workbook.Sheets[idx].Hidden`)
- 시트 이름이 "quota"로 끝나는 것만 포함 (대소문자 무시)

### 5. Fiscal Half 로직
- 회사 FY는 7월 시작
- H1 = Jul-Dec (submission month 7-12), H2 = Jan-Jun (submission month 1-6)
- Quota Start Date 기준으로 해당 half 내 effective start month 계산

---

## Country-Region Mapping

| Region | Countries |
|--------|-----------|
| APAC | Australia, China, Hong Kong, India, Japan, Malaysia, Singapore |
| EMEAL | Austria, Belgium, Brazil, France, Germany, Ireland, Israel, Italy, Mexico, Netherlands, Spain, Sweden, United Arab Emirates, United Kingdom |
| NAMER | Canada, United States of America |

---

## Deployment

- GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`)
- `main` 브랜치에 push 시 자동 빌드 및 배포
- Settings > Pages > Source를 "GitHub Actions"로 설정 필요

---

## Data Privacy

- 100% 클라이언트 사이드 처리 (브라우저 내 JavaScript)
- 서버/백엔드 없음
- 외부 API 호출/네트워크 요청 없음
- 업로드 파일은 브라우저 메모리에서만 처리, 탭 닫으면 사라짐

---

*Document created: 2026-02-09*
