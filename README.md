# Quota Validator Repo Notes

이 저장소는 두 가지 실행 경로를 함께 관리합니다.

- 루트 앱: GitHub Pages용 Quota Validator 웹 앱
- `quota-validation-powerapp/`: Power Apps Code App 배포용 앱

현재 탭 구성은 `LTS / LSS`, `LMS`, `LMS Overlay`, `SD` 입니다.

## Power Apps 배포 위치

Power Apps 배포는 루트가 아니라 `quota-validation-powerapp/` 폴더에서 수행합니다.

```powershell
cd "C:\Codex\PowerApps\Quota Validator\quota-validation-powerapp"
npm run build
npx power-apps push --solutionId Default
```

## SD Validator 메모

- SD 검증은 `SD IC`와 `SD MGRs` 시트만 읽습니다.
- Submission Month 기준으로 기존 V1 / V2 / V3 검증을 실행합니다.
- V3는 `Component 1`, `Component 2` 월별 quota를 검사합니다.
- sensitivity / 암호화가 적용된 SD 원본 workbook은 브라우저에서 직접 읽지 못할 수 있습니다.

## 로컬 테스트 파일

`zz_test data/` 폴더는 로컬 테스트 전용이며 `.gitignore`에 포함되어 GitHub로 올라가지 않습니다.

---

# New Power Apps Code App Quick Start

아래 내용은 완전히 새로운 Power Apps Code App을 이 폴더에서 시작할 때 참고용으로 남겨둔 가이드입니다.

## 1) 새 앱 폴더 만들기

Power Apps Code App은 앱별로 폴더를 분리하는 것이 가장 안전합니다.

```powershell
cd "C:\Codex\Quota Validator"
mkdir my-new-app
cd my-new-app
```

## 2) 템플릿 생성 및 패키지 설치

```powershell
npx degit github:microsoft/PowerAppsCodeApps/templates/vite .
npm install
```

## 3) Power Platform 로그인 및 환경 선택

처음이거나 세션이 만료된 경우 인증 후 환경을 선택합니다.

```powershell
pac auth create
pac env list
pac env select --environment <환경ID>
```

## 4) Code App 초기화 (새 앱 등록 준비)

```powershell
pac code init --displayname "My Brand New App"
```

이 단계에서 `power.config.json`이 생성됩니다.

## 5) 로컬 개발

```powershell
npm run dev
```

## 6) 배포 (환경에 새 앱 생성)

```powershell
npm run build
npx power-apps push --solutionId Default
```

성공하면 Play URL이 출력됩니다.

## 7) 자주 하는 실수

- 기존 앱 폴더에서 새 앱 작업을 시작함
  - 해결: 항상 새 폴더를 만들고 그 폴더를 VS Code에서 열기
- `power.config.json`의 `appId`가 기존 앱 ID로 들어가 있음
  - 결과: 새 앱 생성이 아니라 기존 앱 업데이트가 될 수 있음
- 환경 선택 없이 push 실행
  - 해결: `pac env select --environment <환경ID>` 먼저 실행

## 8) 체크리스트

- 새 폴더에서 작업 중인가?
- `power.config.json`이 현재 앱 폴더에 생성됐는가?
- 올바른 환경이 선택됐는가?
- `npm run build`가 성공했는가?
- push 후 출력된 URL로 앱 실행이 되는가?
