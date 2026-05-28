# mathteach.jbot.kr 배포 안내

이 문서는 Next.js 운영용 앱을 Vercel에 배포하고, 가비아에서 보유 중인 `jbot.kr` 도메인의 서브도메인 `mathteach.jbot.kr`를 연결하는 절차입니다.

## 1. 배포 구조

```txt
사용자 접속
  -> https://mathteach.jbot.kr
  -> 가비아 DNS CNAME
  -> Vercel 배포 앱
  -> Supabase DB/Storage
  -> OpenAI API
```

`jbot.kr` 전체를 옮기는 방식이 아니라, `mathteach.jbot.kr` 서브도메인만 Vercel 앱에 연결합니다.

## 2. Vercel 프로젝트 만들기

1. https://vercel.com 에 로그인합니다.
2. `Add New...` 또는 `New Project`를 선택합니다.
3. GitHub 저장소를 연결했다면 이 프로젝트 폴더를 포함한 저장소를 선택합니다.
4. Root Directory는 다음 폴더로 지정합니다.

```txt
math-teacher-next
```

5. Framework Preset은 `Next.js`로 자동 선택되면 그대로 둡니다.
6. 배포 전에 Environment Variables를 등록합니다.

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
APP_ADMIN_PASSWORD
```

7. `Deploy`를 누릅니다.

## 3. Vercel에 도메인 추가

1. Vercel 프로젝트 화면으로 들어갑니다.
2. `Settings` -> `Domains`를 엽니다.
3. 아래 도메인을 추가합니다.

```txt
mathteach.jbot.kr
```

4. Vercel이 안내하는 DNS 레코드 값을 확인합니다.

일반적인 서브도메인 연결은 CNAME 방식입니다.

```txt
Type: CNAME
Name: mathteach
Value: cname.vercel-dns.com
```

단, Vercel 프로젝트 화면에서 다른 CNAME 값을 안내하면 Vercel 화면의 값을 우선합니다.

## 4. 가비아에서 DNS 설정

1. https://www.gabia.com 에 로그인합니다.
2. 오른쪽 위 `My 가비아`로 이동합니다.
3. `DNS 관리툴`을 엽니다.
4. `jbot.kr` 도메인 오른쪽의 `설정`을 누릅니다.
5. DNS 레코드에 아래 항목을 추가합니다.

```txt
타입: CNAME
호스트: mathteach
값/위치: cname.vercel-dns.com
TTL: 기본값
```

6. 이미 `mathteach`라는 A 레코드나 CNAME 레코드가 있으면 중복되지 않게 기존 값을 수정하거나 삭제한 뒤 새 값으로 저장합니다.
7. 저장 후 Vercel의 `Domains` 화면으로 돌아가 `Refresh` 또는 `Verify`를 누릅니다.

DNS 반영은 보통 몇 분 안에 되지만, 경우에 따라 최대 24시간 정도 걸릴 수 있습니다.

## 5. 연결 확인

브라우저에서 아래 주소를 엽니다.

```txt
https://mathteach.jbot.kr
```

정상 연결되면 Vercel이 HTTPS 인증서를 자동으로 발급합니다. 처음에는 인증서 발급 중으로 보일 수 있으니 잠시 기다린 뒤 새로고침합니다.

## 6. 배포 전 체크리스트

- Vercel Environment Variables 5개가 모두 등록되어 있는지 확인
- Supabase Storage bucket `math-textbook-pdfs`가 있는지 확인
- Supabase DB 테이블이 만들어져 있는지 확인
- 관리자 비밀번호 `APP_ADMIN_PASSWORD`를 너무 쉬운 값으로 두지 않았는지 확인
- OpenAI 결제 크레딧 또는 사용 한도가 활성화되어 있는지 확인

## 참고 문서

- Vercel 공식 문서: https://vercel.com/docs/domains/set-up-custom-domain
- 가비아 DNS 매뉴얼: https://customer.gabia.com/manual/dns/3041
