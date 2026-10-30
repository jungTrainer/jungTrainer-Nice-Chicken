# 복구-구조-2 전후 화면

기준은 origin/recovery-structure-1의0274d0e다. 이번 브랜치에서 실제 Chromium151.0.7922.34로 새로 캡처했다. 기본 목록의 sources가 비어 있어 이전 이모지/그림을 유지한다.

360×640/390×844/640×360/1280×800 × 지역6개/효과/메뉴8화면 = **32쌍/64 PNG**. 모든 PNG 바이트·DOM·위치/크기가 같고, 캡처 전후 state/본 저장/backup/dirty/서비스 캐시도 같았다. [비교 기록](comparison.json).

| 화면 | 기준 | 이미지 기반 추가 후 |
| --- | --- | --- |
| 360px 창녕 | [before](before/360x640-changnyeong.png) | [after](after/360x640-changnyeong.png) |
| 390px 부산 | [before](before/390x844-busan.png) | [after](after/390x844-busan.png) |
| 작은 가로 효과 | [before](before/640x360-effects.png) | [after](after/640x360-effects.png) |
| 데스크톱 메뉴 | [before](before/1280x800-menu.png) | [after](after/1280x800-menu.png) |

시각/rAF·합성 손님/라이더를 고정한 표시 비교다. 실제 이미지 교체/캐시·지연·실패·입력은 별도의 임시 색상 SVG fixture로 검사했고, 해당 그림은 앱에 등록하지 않았다. 실기기·스크린리더·Firefox/WebKit·사람의 음질 평가는 하지 않았다.
