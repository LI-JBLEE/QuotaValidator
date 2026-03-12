# Quota Validator Power Apps Deployment

이 문서는 현재 Quota Validator를 Power Apps Code App으로 배포할 때 사용하는 실제 절차를 정리합니다.

## 대상 폴더

Power Apps 배포 소스는 루트가 아니라 아래 폴더입니다.

```powershell
cd "C:\Codex\PowerApps\Quota Validator\quota-validation-powerapp"
```

이 폴더에는 `power.config.json`이 있으며, 기존 Power Apps app에 연결되어 있습니다.

## 현재 포함 기능

- LTS / LSS validation
- LMS validation
- LMS Overlay validation
- SD validation
  - `SD IC`, `SD MGRs` 시트 기반
  - submission month 기준 validation
  - V3는 `Component 1`, `Component 2` 월별 quota 검사

## 사전 확인

```powershell
pac auth list
pac env select --environment 8c0f0998-b44d-e8f1-b0b8-97534410a116
```

## 로컬 빌드

```powershell
npm run build
```

## Power Apps 배포

```powershell
npx power-apps push --solutionId Default
```

성공하면 업데이트된 app URL 또는 실행 정보가 출력됩니다.

## 주의사항

- `zz_test data/`는 로컬 테스트 전용이며 GitHub에 올리지 않습니다.
- sensitivity / 암호화가 적용된 SD workbook은 브라우저 앱에서 직접 읽지 못할 수 있습니다.
- Power Apps 배포 전에는 반드시 `quota-validation-powerapp/`에서 build 성공 여부를 확인합니다.
