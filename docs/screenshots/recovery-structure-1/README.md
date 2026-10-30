# 복구-구조-1 전후 화면

2026-10-30, 기준 c66d96f와 이번 재구현의 실제 Chromium151.0.7922.34 캡처다. 이전 구조 작업의 검증 자료를 재사용하지 않았다.

360×640/390×844/640×360/1280×800 × 지역6개/효과/메뉴8화면 =32쌍/64 PNG. 모든 PNG 바이트·DOM·위치/크기가 같고, 캡처 전후 state/본 저장/backup/dirty/서비스 캐시도 유지됐다. [비교 기록](comparison.json).

| 화면 | 기준 | 새 분리본 |
| --- | --- | --- |
| 360px 창녕 | [before](before/360x640-changnyeong.png) | [after](after/360x640-changnyeong.png) |
| 390px 부산 | [before](before/390x844-busan.png) | [after](after/390x844-busan.png) |
| 작은 가로 효과 | [before](before/640x360-effects.png) | [after](after/640x360-effects.png) |
| 데스크톱 화성 | [before](before/1280x800-mars.png) | [after](after/1280x800-mars.png) |

시각·rAF·합성 손님/라이더를 고정한 표시 비교다. 지역 변경 캡처는 합성 view이며 실제 지점 이동/서빙·재접속은 별도 입력 검사로 확인했다. 실기기·스크린리더·사람의 음질/플레이 시간 평가는 하지 않았다.
