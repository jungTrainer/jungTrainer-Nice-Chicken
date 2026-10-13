# 쿠폰 검증의 현재 범위와 서버 연결 조건

IMP-12, 2026-10-13. 사용자 확인 결과 백엔드·인증·운영 담당자가 아직 없다. 정적 Pages는 브라우저 저장/게임 쿠폰/공개 PIN `0000`만 사용한다. 브라우저 값을 편집할 수 있으므로 **PIN은 로컬 확인이며 서버 검증·실제 매장 승인·부정 사용 방지가 아니다**. 인증서 이미지와 혜택 내역도 기기 기록이다. 이번 단계는 합성 fixture만 사용하며 실제 혜택 사용/운영 데이터를 변경하지 않는다.

## 정적 구현과 보존

manifest/셸/업데이트와 화면의 로컬 한계 표시는 구현 가능하다. 기존 쿠폰 수량·기기 내 사용 로그·지급 완료 플래그·인증서 발급/주간 미션 동작은 보존한다. 서버가 없다는 이유로 기존 쿠폰을 새 서버 쿠폰이라고 변환하거나 과거 기록으로 가상 서버 잔액을 만들지 않는다. 앱 셸 워커는 향후 인증/API POST를 캐시하거나 오프라인 사용 성공을 흉내내지 않는다.

## 연결 전 필요한 결정

운영 주체는 혜택/유효 기간/가맹점 승인/취소·환불/개인정보 보존 기간을 확정한다. 백엔드 HTTPS URL·스테이징·장애 담당자·DB/backup·감사 로그·키 회전·알림을 제공해야 한다. 인증은 매장 직원의 서버 세션 또는 OIDC, 권한은 매장별 redeem/refund로 분리한다. 짧은 공개 PIN이나 클라이언트에 secret을 넣는 방식은 인증이 아니다. Pages origin만 CORS 허용하며 쿠키 인증이면 SameSite/CSRF와 정확한 Origin 검증을 적용한다.

쿠폰의 **발급**도 서버가 승인하는 ledger여야 한다. 수정 가능한 게임 LocalStorage 숫자·주간 완료 플래그를 발급 증거로 신뢰하지 않는다. 사용자 식별/계정과 게임 보상을 어떻게 검증할지, 기존 로컬 쿠폰을 어떤 수동 정책으로 취급할지 승인되어야 한다. 이 결정 없이 redeem endpoint만 붙여 실제 혜택을 제공할 수 없다.

## 제안 API 계약 (연결하지 않음)

`POST /v1/coupons/{serverCouponId}/redemptions`, JSON `{requestId, storeId, expectedRevision}`. 서버 인증 세션에서 operator/account를 가져온다. 브라우저가 money/잔액/사용 성공/operator를 보내 확정하지 못한다. requestId는 UUID이며 동일 authenticated actor·쿠폰·동일 body의 재전송만 같은 receipt를 반환한다. 다른 body로 같은 key를 재사용하면 409다.

서버 DB transaction에서 권한·유효기간·발급 원본·미사용·revision을 확인하고 UNIQUE(coupon_id, active_redemption), UNIQUE(actor_id, request_id)로 경쟁 요청/중복 차감을 막는다. 원본 영수증 `{receiptId, requestId, couponId, storeId, redeemedAt, revision, status:"redeemed"}`과 서버 ledger/audit를 함께 commit한다. 서버 시각을 사용한다. audit에는 operator·매장·이전/이후 revision·reason을 기록하고 공개 CDN/앱 캐시에 저장하지 않는다. 금액이 있다면 정확한 정수 원 문자열 정책을 사용한다.

응답은 `Cache-Control: no-store`. 401 재인증, 403 권한 없음, 409 사용/키 충돌, 410 만료, 422 입력, 429 제한, 503 재시도다. 연결 끊김/timeout은 **사용 실패나 성공으로 단정하지 않는다**. 같은 requestId로 재시도하거나 권한 있는 status endpoint로 commit 결과를 조회한다. 오프라인에서는 사용을 막고 로컬 쿠폰을 먼저 차감하지 않는다. 인증 실패/서버 불명확 응답을 공개 PIN으로 fallback하지 않는다.

서버가 생긴 뒤 스테이징에서 미인증/타매장·변조 발급·만료·경쟁 요청·재시도·충돌·commit 직후 단절·감사/복구·취소를 실제 DB/인증으로 검증한다. 현재의 순수 계약 검사는 서버 인증·DB 원자성·실혜택 안전성을 증명하지 않는다. 실제 연결·쿠폰 발급/이행·운영 변경은 별도 승인으로 진행한다.
