/* IMP-18: device-local courtesy policy. No server, clock attestation or inferred history. */
const CouponPolicy = {
  lastMonthlyAttempt: 0,
  lastMonthlyKey: "",
  dayMs: 86400000,
  offset() { return COUPON_POLICY.kstOffsetMinutes * 60000; },
  day(ts = Date.now()) { return new Date(ts + this.offset()).toISOString().slice(0, 10); },
  dayStart(ts = Date.now()) { return Math.floor((ts + this.offset()) / this.dayMs) * this.dayMs - this.offset(); },
  month(ts = Date.now()) { return this.day(ts).slice(0, 7); },
  week(ts = Date.now()) {
    const monday = this.dayStart(ts) - ((new Date(ts + this.offset()).getUTCDay() + 6) % 7) * this.dayMs;
    return this.day(monday);
  },
  nextMonth(ts = Date.now()) {
    const d = new Date(ts + this.offset());
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - this.offset();
  },
  dateText(ts) { return new Date(ts).toLocaleString("ko-KR", {timeZone:"Asia/Seoul"}); },
  create(fresh = false) {
    const now = Date.now();
    return {
      version: COUPON_POLICY.version, installedAt: now,
      dailyFrom: fresh ? now : this.dayStart(now) + this.dayMs,
      weeklyFrom: fresh ? now : Math.max(now, state.missions?.weekEndAt || now),
      welcomeEligible: fresh, welcomeCompletedAt: 0,
      stamps: 0, lots: [],
      claims: {daily:{}, weekly:{}, exchange:{}, visit:{}},
      issuedMonths: {}, usedDays: {},
    };
  },
  migrate(fresh = false) {
    if (!state.couponLedger) {
      state.couponLedger = this.create(fresh);
      for (const m of [state.missions, ...Object.values(state.branches || {}).map(b => b.data?.missions)]) {
        if (!m) continue;
        if (m.dailyKey) m.dailyRewardPolicy ??= 1;
        if (m.weekStartAt) m.weeklyRewardPolicy ??= 1;
      }
      markStateChanged("coupon-policy-migration", false);
    }
    if (state.version !== CONFIG.version) {
      state.version = CONFIG.version; markStateChanged("save-version-migration", false);
    }
  },
  period(weekly = false) {
    return Date.now() >= state.couponLedger[weekly ? "weeklyFrom" : "dailyFrom"] ? 2 : 1;
  },
  claim(bucket, key, limit) {
    if (!SessionOwner.canMutate()) return false;
    const claims = state.couponLedger.claims[bucket];
    if ((claims[key] || 0) >= limit) return false;
    claims[key] = (claims[key] || 0) + 1;
    return true;
  },
  issue(type, source, usableAt = Date.now()) {
    if (!SessionOwner.canMutate()) return false;
    const now = Date.now(), lot = {
      id: crypto.randomUUID(), type, source, issuedAt: now, usableAt,
      expiresAt: now + (type === "drink" ? COUPON_POLICY.drinkValidDays : COUPON_POLICY.vegValidDays) * this.dayMs,
      usedAt: 0,
    };
    state.couponLedger.lots.push(lot);
    logBenefit({type, source, note:`신규 쿠폰 · 사용 가능 ${this.dateText(usableAt)} · 만료 ${this.dateText(lot.expiresAt)}`, lotId:lot.id});
    return lot;
  },
  monthlyAvailable() {
    const l = state.couponLedger;
    const reserved = l.welcomeEligible && COUPON_POLICY.welcomeCountsTowardMonthlyLimit ? COUPON_POLICY.welcomeDrink : 0;
    return (l.issuedMonths[this.month()] || 0) + reserved < COUPON_POLICY.monthlyDrinkLimit;
  },
  settle() {
    if (!SessionOwner.canMutate()) return false;
    const l = state.couponLedger;
    let issued = 0;
    while (l.stamps >= COUPON_POLICY.cardSize && this.monthlyAvailable()) {
      l.stamps -= COUPON_POLICY.cardSize;
      this.issue("drink", "stamp_card");
      l.issuedMonths[this.month()] = (l.issuedMonths[this.month()] || 0) + 1;
      issued++;
    }
    return issued;
  },
  addStamps(qty, source) {
    if (!SessionOwner.canMutate()) return false;
    if (!Number.isSafeInteger(qty) || qty < 0) throw new RangeError("Invalid stamp amount");
    const l = state.couponLedger, before = l.stamps;
    l.stamps += qty;
    this.settle();
    l.stamps = Math.min(COUPON_POLICY.stampCapacity, l.stamps);
    logBenefit({type:"stamp", qty, source, note:"음료 스탬프", before, after:l.stamps});
  },
  completeWelcome() {
    if (!SessionOwner.canMutate()) return false;
    const l = state.couponLedger;
    if (!l.welcomeEligible || l.welcomeCompletedAt) return false;
    l.welcomeEligible = false; l.welcomeCompletedAt = Date.now();
    for (let i = 0; i < COUPON_POLICY.welcomeDrink; i++) this.issue("drink", "welcome", this.dayStart() + this.dayMs);
    if (COUPON_POLICY.welcomeCountsTowardMonthlyLimit)
      l.issuedMonths[this.month()] = (l.issuedMonths[this.month()] || 0) + COUPON_POLICY.welcomeDrink;
    return true;
  },
  dailyReward() {
    if (!this.claim("daily", this.day(), COUPON_POLICY.dailyAwardLimit)) return false;
    this.addStamps(COUPON_POLICY.dailyStamps, "daily"); return true;
  },
  weeklyReward(completedAt) {
    if (!this.claim("weekly", this.week(completedAt), COUPON_POLICY.weeklyAwardLimit)) return false;
    this.addStamps(COUPON_POLICY.weeklyStamps, "weekly");
    for (let i = 0; i < COUPON_POLICY.weeklyVegCoupons; i++) this.issue("veg", "weekly");
    return true;
  },
  maybeSettle(force = false) {
    if (!SessionOwner.canMutate() || deferRecoveryWrites || !state.couponLedger ||
        state.couponLedger.stamps < COUPON_POLICY.cardSize || !this.monthlyAvailable()) return false;
    if (!force && this.lastMonthlyKey === this.month() && Date.now() - this.lastMonthlyAttempt < CONFIG.autosaveSec * 1000) return false;
    this.lastMonthlyKey = this.month(); this.lastMonthlyAttempt = Date.now();
    return BenefitService.commit(() => this.settle());
  },
  availableLots(type, now = Date.now()) {
    return (state.couponLedger?.lots || []).filter(l=>l.type === type && !l.usedAt && l.usableAt <= now && now < l.expiresAt)
      .sort((a,b)=>a.expiresAt-b.expiresAt || a.issuedAt-b.issuedAt || a.id.localeCompare(b.id));
  },
  available(type) { return (state.coupons[type] || 0) + this.availableLots(type).length; },
  usedToday() { return state.couponLedger?.usedDays[this.day()] || 0; },
  canUse(type) {
    return this.available(type) > 0 && (type !== "drink" || this.usedToday() < COUPON_POLICY.dailyDrinkUseLimit);
  },
  consume(type) {
    if (!SessionOwner.canMutate()) return false;
    const before = this.available(type), lot = this.availableLots(type)[0];
    if (lot) lot.usedAt = Date.now(); else state.coupons[type]--;
    if (type === "drink") state.couponLedger.usedDays[this.day()] = this.usedToday() + 1;
    return {before, after:this.available(type), lotId:lot?.id || "legacy-unexpired"};
  },
  minuteIncome() {
    const rates = computeRates(), eff = rates.eff, pool = getOrderMenuPool();
    const average = moneyQuotient(pool.reduce((sum,m)=>moneyAdd(sum,getMenuPrice(m.id, eff)),0), pool.length);
    const tips = 1.01 + rates.tipChance * rates.tipMul + getHiredStaff().reduce((n,s)=>n+levelCurve(state.staffStats[s.key].tip)*0.02,0)/Math.max(1,getStaffCount());
    const serving = moneyScale(average, Math.min(rates.ordersPerMin, rates.autoServesPerMin * 2), tips, Date.now() < (window._fxState?.boss?.buffUntil || 0) ? 2 : 1);
    const buff = Date.now() < (state.buffEndTime || 0) ? 2 : 1;
    const online = moneyScale(average, rates.onlineOrdersPerMin, 1+(eff.onlineMul||0), 1+(eff.onlineEarningMul||0), buff);
    const delivery = state.delivery.riders > 0
      ? moneyScale(average, 60000/(0.88 * computeDeliveryIntervalMs(VEHICLES[clampInt(state.delivery.level,0,9)],0.5,1) + 0.12 * computeDeliveryIntervalMs(VEHICLES[clampInt(state.delivery.level,0,9)],0.5,0)), 1+(eff.deliveryEarningMul||0), buff) : 0;
    return moneyAdd(moneyAdd(serving, online), delivery);
  },
  quote() {
    const modern = this.period(true) === 2;
    try {
      const minute = modern ? this.minuteIncome() : 0;
      const price = modern ? moneyMax(COUPON_POLICY.exchangeMinWon, moneyScale(minute,COUPON_POLICY.exchangeMinutes)) : CONFIG.exchangeUnit;
      const remaining = modern ? Math.max(0, COUPON_POLICY.exchangeWeeklyLimit - (state.couponLedger.claims.exchange[this.week()] || 0)) : moneyQuotient(moneyMax(0,state.money), price);
      return {modern, minute, price, remaining, allowed:moneyCompare(state.money,price)>=0 && moneyCompare(remaining,0)>0};
    } catch { return {modern,price:null,minute:null,remaining:0,allowed:false}; }
  },
  exchange(displayed) {
    if (!SessionOwner.canMutate()) return false;
    const q = this.quote();
    if (!q.allowed || String(q.price) !== String(displayed)) {
      renderExchange(); showToast("이번 주 한도·잔액·변경된 가격을 확인해 주세요."); return false;
    }
    const ok = BenefitService.commit(()=>{
      state.money = moneySub(state.money,q.price);
      if (q.modern) {
        this.claim("exchange",this.week(),COUPON_POLICY.exchangeWeeklyLimit);
        this.addStamps(COUPON_POLICY.exchangeStamps,"exchange");
      } else {
        const before=state.coupons.drink; state.coupons.drink++;
        logBenefit({type:"drink",source:"exchange",note:"이행 전 확정 기간의 기존 교환",before,after:state.coupons.drink});
      }
    });
    showToast(ok ? (q.modern ? "스탬프 구매 저장 완료" : "기존 기간 교환 완료") : "저장 실패. 돈과 혜택을 유지합니다.");
    updateUI(); renderExchange(); renderCoupons(); return ok;
  },
  protectImported(data) {
    // An import restores game progress, never adds or rolls back this device's new benefits.
    const next = structuredClone(data);
    next.couponLedger = structuredClone(state.couponLedger);
    const physicalActivity = Object.keys(state.couponLedger.usedDays).length || Object.keys(state.couponLedger.claims.visit).length;
    if (physicalActivity) {
      next.serviceVisit = structuredClone(state.serviceVisit);
      next.benefitsLog = structuredClone(state.benefitsLog);
    }
    if (state.cert.rewardPolicy === 2) next.cert = structuredClone(state.cert);
    return next;
  },
  validate(l) {
    const object=v=>!!v&&typeof v==="object"&&!Array.isArray(v), time=v=>Number.isSafeInteger(v)&&v>=0&&v<=8640000000000000;
    if (!object(l) || l.version !== COUPON_POLICY.version || ![l.installedAt,l.dailyFrom,l.weeklyFrom,l.welcomeCompletedAt].every(time) ||
        typeof l.welcomeEligible!=="boolean" || !Number.isSafeInteger(l.stamps) || l.stamps<0 || l.stamps>COUPON_POLICY.stampCapacity ||
        !Array.isArray(l.lots) || !object(l.claims) || !object(l.issuedMonths) || !object(l.usedDays)) return "새 쿠폰 원장 구조가 올바르지 않습니다.";
    const ids=new Set();
    for(const c of l.lots) {
      if (!object(c)||typeof c.id!=="string"||!c.id||ids.has(c.id)||!["drink","veg"].includes(c.type)||typeof c.source!=="string"||
          ![c.issuedAt,c.usableAt,c.expiresAt,c.usedAt].every(time)||c.usableAt<c.issuedAt||c.expiresAt<=c.usableAt||
          (c.usedAt && (c.usedAt<c.usableAt||c.usedAt>=c.expiresAt))) return "새 쿠폰 날짜/사용 상태가 올바르지 않습니다.";
      ids.add(c.id);
    }
    for(const [bucket,pattern] of [[l.issuedMonths,/^\d{4}-\d{2}$/],[l.usedDays,/^\d{4}-\d{2}-\d{2}$/],
      ...["daily","weekly","exchange","visit"].map(k=>[l.claims[k],/^\d{4}-\d{2}-\d{2}$/])]) {
      if(!object(bucket)||Object.entries(bucket).some(([key,n])=>!pattern.test(key)||!Number.isSafeInteger(n)||n<0)) return "쿠폰 기간 한도 기록이 올바르지 않습니다.";
    }
    return "";
  },
  render() {
    if (!state.couponLedger) return;
    const l=state.couponLedger, host=document.getElementById("couponPolicyStatus");
    if(host) {
      const count=l.issuedMonths[this.month()]||0, due=l.stamps>=COUPON_POLICY.cardSize&&!this.monthlyAvailable();
      const text=`음료 스탬프 ${l.stamps}/${COUPON_POLICY.cardSize}\n이번 달 ${count}/${COUPON_POLICY.monthlyDrinkLimit}장${COUPON_POLICY.welcomeCountsTowardMonthlyLimit?" · 웰컴 포함":" · 웰컴 별도"}`;
      const details=document.getElementById("couponPolicyDetails");
      const detailText=`음료 스탬프 적립: 일간 +${COUPON_POLICY.dailyStamps}, 주간 +${COUPON_POLICY.weeklyStamps}, 주 1회 구매 +${COUPON_POLICY.exchangeStamps}, 매장 방문 +${COUPON_POLICY.visitStamps}\n${due?`다음 지급 예정: ${this.dateText(this.nextMonth())} 이후 앱을 열 때`:`${COUPON_POLICY.cardSize}개를 채우면 이번 달 음료 쿠폰을 받을 수 있어요.`}\n남은 음료 스탬프는 최대 ${COUPON_POLICY.stampCapacity}개까지 이어가요.\n기존 음료 ${state.coupons.drink}장 · 무/양배추 ${state.coupons.veg}장: 무기한\n일간 적립 시작 ${this.dateText(l.dailyFrom)} · 주간 적립·새 교환 시작 ${this.dateText(l.weeklyFrom)}`;
      if(details&&details.textContent!==detailText)details.textContent=detailText;
      if(host.textContent!==text)host.textContent=text;
    }
    const list=document.getElementById("datedCouponList");
    if(list) {
      const text=l.lots.map(c=>`${c.type==="drink"?"음료":"무/양배추"} · ${({welcome:"웰컴",stamp_card:"음료 스탬프",weekly:"주간 미션"})[c.source]||"쿠폰"} · ${c.usedAt?"사용 완료":Date.now()>=c.expiresAt?"만료":Date.now()<c.usableAt?"🔒 내일부터 사용 가능":"사용 가능"}\n발급 ${this.dateText(c.issuedAt)} · 사용 가능 ${this.dateText(c.usableAt)} · 만료 ${this.dateText(c.expiresAt)}${c.usedAt?` · 사용 ${this.dateText(c.usedAt)}`:""}`).join("\n\n")||"미션을 채우고 쿠폰을 모아보세요. 기존 쿠폰도 사용할 수 있어요.";
      if(list.textContent!==text)list.textContent=text;
    }
    for(const [id,type] of [["useDrinkCoupon","drink"],["useVegCoupon","veg"]]) {
      const button=document.getElementById(id);
      if(button) {
        const disabled=!this.canUse(type), losingFocus=disabled && button===document.activeElement;
        if(button.disabled!==disabled)button.disabled=disabled;
        if(losingFocus && host && document.getElementById("modalCoupons").classList.contains("on") && !document.getElementById("modalPin").classList.contains("on")) host.focus();
      }
    }
    const certificateInfo=document.getElementById("certificateRewardInfo");
    if(certificateInfo) {
      const modern=(state.cert.issuedThisWeek?state.cert.rewardPolicy:state.missions.weeklyRewardPolicy)===2;
      const rewardText=modern?`이번 주 보상: 음료 스탬프 +${COUPON_POLICY.weeklyStamps} · 무/양배추 쿠폰 ${COUPON_POLICY.weeklyVegCoupons}장(${COUPON_POLICY.vegValidDays}일)` : "이번 주에는 인증서를 발급하면 음료 쿠폰 1장을 받아요.";
      if(certificateInfo.textContent!==rewardText)certificateInfo.textContent=rewardText;
    }
    for(const [id,text] of [["dailyRewardInfo",state.missions.dailyRewardPolicy===2?`일간 완료: 음료 스탬프 +${COUPON_POLICY.dailyStamps}` : "일간 완료: 무/양배추 쿠폰 1장"],
      ["weeklyRewardInfo",state.missions.weeklyRewardPolicy===2?`주간 완료: 음료 스탬프 +${COUPON_POLICY.weeklyStamps} · 무/양배추 쿠폰 ${COUPON_POLICY.weeklyVegCoupons}장` : "인증서 발급: 음료 쿠폰 1장"]]) {
      const node=document.getElementById(id);if(node&&node.textContent!==text)node.textContent=text;
    }
  },
};
