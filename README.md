# 수학교과 통합 웹앱 Next.js 운영용

MVP에서 검증한 기능을 실제 배포 가능한 Next.js 구조로 옮기는 프로젝트입니다.

## 준비

```powershell
cd math-teacher-next
copy .env.local.example .env.local
```

`.env.local`에 Supabase와 OpenAI 값을 넣습니다.

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

## 설치 및 실행

이 폴더는 일반 Node.js/npm 환경에서 실행합니다. Windows에서는 Node.js LTS 설치 파일을 설치하면 npm도 함께 설치됩니다.

공식 다운로드:

```txt
https://nodejs.org/en/download
```

설치 후 새 PowerShell에서 확인합니다.

```powershell
node --version
npm --version
```

그다음 프로젝트를 실행합니다.

```powershell
npm install
npm run dev
```

브라우저에서 엽니다.

```txt
http://localhost:3000
```

## 이식 순서

1. 기본 Next.js 구조 생성: 완료
2. Supabase 연결 모듈 및 API route 작성: 완료
3. 관리자 로그인 화면 이식: 완료
4. 관리자 단원/PDF 관리 화면 이식: 완료
5. 교사용 자료 조회 화면 이식: 완료
6. AI 생성 API route 이식: 완료
7. 결과 편집/저장 기능 이식: 완료
8. 배포 준비

## 빌드 검증

```powershell
npm install --cache .\.npm-cache
npm run build
```

현재 빌드 성공 확인 완료.

## 도메인 배포

`mathteach.jbot.kr`로 운영 배포하려면 아래 문서를 따라 진행합니다.

```txt
DEPLOYMENT.md
```

## 현재 구현된 API

```txt
GET  /api/bootstrap
POST /api/subunits
POST /api/subunit-text
POST /api/subunit-standard
POST /api/generate
POST /api/save-generated
POST /api/delete-generated
GET  /api/admin-status
POST /api/admin-login
POST /api/admin-logout
```

## Node.js 설치 후 npm이 안 잡힐 때

Node.js 설치 직후 기존 PowerShell에는 경로가 반영되지 않을 수 있습니다.

```txt
1. PowerShell 창을 모두 닫기
2. 새 PowerShell 열기
3. node --version
4. npm --version
```

그래도 안 되면 Node.js 설치 프로그램에서 `Add to PATH` 옵션이 켜져 있는지 확인하고 다시 설치합니다.
