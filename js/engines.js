/* Anestezi Asistanı — hesap motorları.
 * iOS sürümündeki Core/Calculations katmanının birebir karşılığıdır. Görünüm katmanı
 * hesap yapmaz; yalnızca bu motorların çıktısını okur.
 * Uyarı biçimi: { severity: 0 bilgi | 1 dikkat | 2 kritik, title, message } */
(function () {
  'use strict';
  const AA = window.AA;
  const { T, Fmt, inRange } = AA;
  const W = (severity, title, message) => ({ severity, title, message });
  const bySeverity = list => list.sort((a, b) => b.severity - a.severity);
  AA.bySeverity = bySeverity;

  // ================================================================ Hazırlık (konsantrasyon)
  const Preparation = {
    /** Etkin konsantrasyon (mg/mL); geçersizse null. */
    concentrationMgPerMl(prep, concUnit) {
      const factor = AA.CONC_UNITS[concUnit].displayFactor;
      if (prep.mode === 'direct') {
        const v = prep.directConcentration;
        return v > 0 ? v / factor : null;
      }
      const mg = prep.totalDrugMg, ml = prep.totalVolumeMl;
      return mg > 0 && ml > 0 ? mg / ml : null;
    },
    reservoirVolumeMl(prep) { return prep.mode === 'mixture' ? prep.totalVolumeMl : null; },
    formatted(mgPerMl, concUnit) {
      const u = AA.CONC_UNITS[concUnit];
      return Fmt.smart(mgPerMl * u.displayFactor) + ' ' + T(u.title);
    },
    summary(prep, concUnit) {
      const c = Preparation.concentrationMgPerMl(prep, concUnit);
      if (c == null) return T('prep.undefined');
      const f = Preparation.formatted(c, concUnit);
      if (prep.mode === 'direct') return f;
      return Fmt.smart(prep.totalDrugMg || 0) + ' mg / ' + Fmt.smart(prep.totalVolumeMl || 0) + ' mL = ' + f;
    }
  };
  AA.Preparation = Preparation;

  // ================================================================ İnfüzyon motoru (anestezi)
  const InfusionLimits = { implausibleRate: 999, veryLowRate: 0.5, elderlyAge: 65, pediatricAge: 12 };

  /** İlacın dile bağlı metinleri ile sayısal tanımını birleştirir (iOS DrugFactory). */
  function makeDrug(id) {
    const bp = AA.DRUGS[id];
    const content = AA.I18n.drug(id);
    if (!bp || !content) return null;
    const indications = bp.indications.map(plan => {
      const text = content.indications.find(i => i.id === plan.id);
      if (!text) return null;
      return Object.assign({}, plan, {
        title: text.title, subtitle: text.subtitle, titrationTarget: text.target,
        notes: text.notes, monitoring: text.monitoring
      });
    }).filter(Boolean);
    const presets = bp.presets.map(([mg, ml], i) => ({
      title: content.presetTitles[i] || '', subtitle: content.presetSubtitles[i] || '',
      totalDrugMg: mg, totalVolumeMl: ml, concentration: mg / ml
    }));
    const standing = content.standingWarnings.map((w, i) => W(bp.standingSeverities[i] ?? 0, w.title, w.message));
    return {
      id, bp, name: content.name, genericName: content.genericName, tagline: content.tagline,
      icon: bp.icon, tint: bp.tint, badges: content.badges,
      doseUnit: bp.doseUnit, concUnit: bp.concentrationUnit,
      unit: Object.assign({}, AA.DOSE_UNITS[bp.doseUnit], bp.loadingUnit || {}),
      indications, presets, standing,
      defaultPreparation: Object.assign({}, bp.defaultPreparation),
      limits: Object.assign({}, bp.limits, {
        peripheralMessage: content.limitMessages.peripheral || null,
        maximumMessage: content.limitMessages.maximum || ''
      }),
      rules: bp.rules.map(rule => evaluation => {
        const values = rule.evaluate(evaluation);
        const text = content.ruleMessages[rule.key];
        if (!values || !text) return null;
        return W(rule.severity, AA.format(text.title, values), AA.format(text.message, values));
      }),
      reference: content.reference
    };
  }
  AA.makeDrug = makeDrug;

  const InfusionEngine = {
    calculate(input) {
      const { drug, indication, profile, basis, dose, preparation, includeLoadingDose, loadingDose, dropFactor } = input;
      const concentration = Preparation.concentrationMgPerMl(preparation, drug.concUnit);
      if (!(concentration > 0)) return null;

      const weight = profile.weight(basis);
      const mgPerHour = dose * weight * drug.unit.mgPerHourFactor;
      const rate = mgPerHour / concentration;
      const loadingMg = includeLoadingDose ? loadingDose * weight * drug.unit.bolusMgFactor : 0;
      const loadingMl = concentration > 0 ? loadingMg / concentration : 0;
      const cumulative = [1, 4, 12, 24].map(h => ({ hours: h, mg: mgPerHour * h, ml: rate * h }));
      const reservoir = Preparation.reservoirVolumeMl(preparation);

      const evaluation = {
        drug, indication, profile, basis, dosingWeightKg: weight, dose,
        concentrationMgPerMl: concentration, rateMlPerHour: rate, mgPerHour,
        mgPer24Hours: mgPerHour * 24, includesLoadingDose: includeLoadingDose, loadingDose
      };

      return {
        dosingWeightKg: weight, concentrationMgPerMl: concentration,
        rateMlPerHour: rate, rateMlPerMinute: rate / 60,
        mgPerHour, mgPerMinute: mgPerHour / 60,
        mcgPerKgPerMinute: weight > 0 ? (mgPerHour * 1000) / (weight * 60) : 0,
        mgPerKgPerHour: weight > 0 ? mgPerHour / weight : 0,
        dropsPerMinute: rate * dropFactor / 60,
        loadingDoseMg: loadingMg, loadingVolumeMl: loadingMl,
        cumulative,
        reservoirDurationHours: reservoir > 0 && rate > 0 ? reservoir / rate : null,
        titrationRows: InfusionEngine.titrationRows(input, weight, concentration),
        warnings: InfusionEngine.warnings(input, evaluation)
      };
    },

    titrationRows(input, weight, concentration) {
      const range = input.indication.doseRange, step = input.indication.titrationStep;
      const doses = [];
      let v = range.lo;
      while (v <= range.hi + 0.0001 && doses.length < 40) { doses.push(Math.round(v * 1000) / 1000); v += step; }
      const current = Math.round(input.dose * 1000) / 1000;
      if (!doses.some(d => Math.abs(d - current) < 0.0005)) { doses.push(current); doses.sort((a, b) => a - b); }
      const factor = input.drug.unit.mgPerHourFactor;
      return doses.map(d => {
        const mgh = d * weight * factor;
        return { dose: d, rate: mgh / concentration, mgPerHour: mgh,
                 isCurrent: Math.abs(d - current) < 0.0005, isOutOfRange: !inRange(range, d) };
      });
    },

    warnings(input, e) {
      const result = [];
      const { drug, profile, indication } = input;
      const unit = T(drug.unit.title);
      const range = indication.doseRange;

      if (input.dose > range.hi) {
        result.push(W(2, T('warn.doseAbove.title'), T('warn.doseAbove.message', {
          indication: indication.title, min: Fmt.smart(range.lo), max: Fmt.smart(range.hi), unit, dose: Fmt.smart(input.dose) })));
      } else if (input.dose < range.lo) {
        result.push(W(1, T('warn.doseBelow.title'), T('warn.doseBelow.message', {
          dose: Fmt.smart(input.dose), min: Fmt.smart(range.lo), unit, target: indication.titrationTarget })));
      }

      const c = e.concentrationMgPerMl, limits = drug.limits;
      if (c > limits.absoluteMaximum) {
        result.push(W(2, T('warn.concentrationHigh.title'), T('warn.concentrationHigh.message', {
          concentration: Preparation.formatted(c, drug.concUnit), detail: limits.maximumMessage })));
      } else if (limits.peripheralMaximum != null && c > limits.peripheralMaximum) {
        result.push(W(1, T('warn.concentrationPeripheral.title'), limits.peripheralMessage || T('warn.concentrationPeripheral.message')));
      }
      if (c < limits.minimumUseful) {
        result.push(W(1, T('warn.concentrationLow.title'), T('warn.concentrationLow.message', {
          concentration: Preparation.formatted(c, drug.concUnit), rate: Fmt.smart(e.rateMlPerHour) })));
      }

      if (e.rateMlPerHour > InfusionLimits.implausibleRate) {
        result.push(W(2, T('warn.rateHigh.title'), T('warn.rateHigh.message', { rate: Fmt.smart(e.rateMlPerHour) })));
      } else if (e.rateMlPerHour > 0 && e.rateMlPerHour < InfusionLimits.veryLowRate) {
        result.push(W(0, T('warn.rateLow.title'), T('warn.rateLow.message', { rate: Fmt.smart(e.rateMlPerHour) })));
      }

      if (profile.isObese) {
        result.push(W(1, T('warn.obesity.title'), T('warn.obesity.message', {
          bmi: Fmt.decimal(profile.bmi), category: profile.bmiCategory, basis: T('basis.' + input.basis + '.title'),
          weight: Fmt.decimal(e.dosingWeightKg), lean: Fmt.decimal(profile.leanBodyWeight), adjusted: Fmt.decimal(profile.adjustedBodyWeight) })));
      }
      if (profile.isUnderweight) {
        result.push(W(1, T('warn.underweight.title'), T('warn.underweight.message', { bmi: Fmt.decimal(profile.bmi) })));
      }
      if (profile.ageYears != null) {
        if (profile.ageYears >= InfusionLimits.elderlyAge) {
          result.push(W(1, T('warn.elderly.title'), T('warn.elderly.message', { age: Fmt.smart(profile.ageYears) })));
        }
        if (profile.ageYears < InfusionLimits.pediatricAge) {
          result.push(W(1, T('warn.pediatric.title'), T('warn.pediatric.message', { age: Fmt.smart(profile.ageYears) })));
        }
      }

      if (input.includeLoadingDose && indication.loadingRange && !inRange(indication.loadingRange, input.loadingDose)) {
        result.push(W(1, T('warn.loadingRange.title'), T('warn.loadingRange.message', {
          indication: indication.title, min: Fmt.smart(indication.loadingRange.lo),
          max: Fmt.smart(indication.loadingRange.hi), unit: T(drug.unit.bolusTitle) })));
      }

      for (const rule of drug.rules) { const w = rule(e); if (w) result.push(w); }
      result.push(...drug.standing);
      return bySeverity(result);
    }
  };
  AA.InfusionEngine = InfusionEngine;

  // ================================================================ Vazoaktif motor (yoğun bakım)
  const VasoactiveEngine = {
    calculate(input) {
      const { drug, weightKg, concentration, direction } = input;
      if (!(concentration > 0)) return null;
      const weight = weightKg || 0;
      if (drug.unit.weightBased && !(weight > 0)) return null;
      const divisor = drug.unit.perHour * (drug.unit.weightBased ? weight : 1);
      if (!(divisor > 0)) return null;

      let rate, dose;
      if (direction === 'rateToDose') {
        rate = Math.max(0, input.rateMlPerHour || 0);
        dose = (rate * concentration) / divisor;
      } else {
        dose = Math.max(0, input.dose || 0);
        rate = (dose * divisor) / concentration;
      }
      const amountPerHour = rate * concentration;
      const amountPerMinute = amountPerHour / 60;
      const band = drug.bandFor(dose);

      return {
        rateMlPerHour: rate, dose, amountPerHour, amountPerMinute,
        perKgPerMinute: weight > 0 ? amountPerMinute / weight : null,
        perKgPerHour: weight > 0 ? amountPerHour / weight : null,
        milligramPerHour: drug.unit.amount === 'microgram' ? amountPerHour / 1000 : null,
        unitsPerHour: drug.unit.amount === 'unit' ? amountPerHour : null,
        bandID: band ? band.id : null,
        rows: VasoactiveEngine.rows(input, concentration, divisor, rate, dose),
        warnings: VasoactiveEngine.warnings(input, rate, dose)
      };
    },

    rows(input, concentration, divisor, currentRate, currentDose) {
      if (input.direction === 'rateToDose') {
        return [1, 2, 3, 4, 5, 7.5, 10, 15, 20, 25, 30, 40, 50].map(rate => ({
          rate, dose: (rate * concentration) / divisor, isCurrent: Math.abs(rate - currentRate) < 0.26
        }));
      }
      const range = input.drug.doseRange;
      const step = (range.hi - range.lo) / 9;
      return Array.from({ length: 10 }, (_, i) => range.lo + i * step).map(dose => ({
        rate: (dose * divisor) / concentration, dose, isCurrent: Math.abs(dose - currentDose) < step / 2
      }));
    },

    warnings(input, rate, dose) {
      const result = [];
      const { drug } = input;
      const unit = T('unit.' + drug.doseUnit);
      const name = T('vaso.' + drug.key + '.name');
      if (dose > drug.maximumDose) {
        result.push(W(2, T('vaso.warn.aboveMax.title'), T('vaso.warn.aboveMax.message', {
          dose: Fmt.dose(dose), unit, max: Fmt.dose(drug.maximumDose), drug: name })));
      } else if (dose > drug.doseRange.hi) {
        result.push(W(1, T('vaso.warn.aboveUsual.title'), T('vaso.warn.aboveUsual.message', {
          dose: Fmt.dose(dose), unit, max: Fmt.dose(drug.doseRange.hi) })));
      } else if (dose > 0 && dose < drug.doseRange.lo) {
        result.push(W(0, T('vaso.warn.belowUsual.title'), T('vaso.warn.belowUsual.message', {
          dose: Fmt.dose(dose), unit, min: Fmt.dose(drug.doseRange.lo) })));
      }
      if (rate > 0 && rate < 0.5) {
        result.push(W(1, T('vaso.warn.lowRate.title'), T('vaso.warn.lowRate.message', { rate: Fmt.decimal(rate, 2) })));
      }
      if (rate > 50) {
        result.push(W(1, T('vaso.warn.highRate.title'), T('vaso.warn.highRate.message', { rate: Fmt.smart(rate) })));
      }
      if (!drug.unit.weightBased) {
        result.push(W(0, T('vaso.warn.notWeightBased.title'), T('vaso.warn.notWeightBased.message', { drug: name, unit })));
      }
      for (let i = 1; i <= drug.warningCount; i++) {
        result.push(W(i === 1 ? 1 : 0, T('vaso.' + drug.key + '.warn' + i + '.title'), T('vaso.' + drug.key + '.warn' + i + '.message')));
      }
      return bySeverity(result);
    }
  };
  AA.VasoactiveEngine = VasoactiveEngine;

  // ================================================================ İdame sıvı + açlık defisiti + cerrahi alan kaybı
  const FluidEngine = {
    /** 4-2-1 kuralı (Holliday–Segar saatlik karşılığı) */
    maintenancePerHour(w) {
      if (!(w > 0)) return 0;
      if (w <= 10) return 4 * w;
      if (w <= 20) return 40 + 2 * (w - 10);
      return 60 + (w - 20);
    },
    /** 100-50-20 mL/kg/gün */
    maintenancePerDay(w) {
      if (!(w > 0)) return 0;
      if (w <= 10) return 100 * w;
      if (w <= 20) return 1000 + 50 * (w - 10);
      return 1500 + 20 * (w - 20);
    },
    calculate(input) {
      if (!(input.weightKg > 0)) return null;
      const maintenance = FluidEngine.maintenancePerHour(input.weightKg);
      const deficit = input.includeDeficit ? maintenance * Math.max(0, input.npoHours || 0) : 0;
      const surgical = input.traumaLevel * input.weightKg;
      const d1 = deficit * 0.5, d2 = deficit * 0.25, d3 = deficit * 0.25;
      return {
        maintenancePerHour: maintenance, maintenancePerDay: FluidEngine.maintenancePerDay(input.weightKg),
        deficitTotal: deficit, deficitHour1: d1, deficitHour2: d2, deficitHour3: d3,
        surgicalLossPerHour: surgical,
        hour1Total: maintenance + surgical + d1, hour2Total: maintenance + surgical + d2,
        hour3Total: maintenance + surgical + d3, steadyStatePerHour: maintenance + surgical,
        warnings: FluidEngine.warnings(input, maintenance, deficit, surgical)
      };
    },
    warnings(input, maintenance, deficit, surgical) {
      const r = [];
      const p = input.profile;
      if (p && p.isObese) {
        r.push(W(1, T('fluid.warn.obesity.title'), T('fluid.warn.obesity.message', {
          bmi: Fmt.decimal(p.bmi), adjusted: Fmt.decimal(p.adjustedBodyWeight),
          rate: Fmt.smart(FluidEngine.maintenancePerHour(p.adjustedBodyWeight)) })));
      }
      if (p && p.ageYears != null) {
        if (p.ageYears < 1) r.push(W(1, T('fluid.warn.neonate.title'), T('fluid.warn.neonate.message')));
        else if (p.ageYears < 12) r.push(W(1, T('fluid.warn.pediatric.title'), T('fluid.warn.pediatric.message')));
      }
      if (input.includeDeficit && input.npoHours > 12) {
        r.push(W(1, T('fluid.warn.longFasting.title'), T('fluid.warn.longFasting.message', {
          hours: Fmt.smart(input.npoHours), deficit: Fmt.smart(deficit) })));
      }
      if (input.traumaLevel >= 7) {
        r.push(W(1, T('fluid.warn.majorSurgery.title'), T('fluid.warn.majorSurgery.message', {
          coefficient: Fmt.smart(input.traumaLevel), loss: Fmt.smart(surgical) })));
      }
      r.push(W(0, T('fluid.warn.goalDirected.title'), T('fluid.warn.goalDirected.message')));
      r.push(W(0, T('fluid.warn.solution.title'), T('fluid.warn.solution.message')));
      return bySeverity(r);
    }
  };
  AA.FluidEngine = FluidEngine;
  AA.traumaTint = level => level <= 2 ? 'success' : level <= 4 ? 'accent' : level <= 6 ? 'info' : level <= 8 ? 'warning' : 'danger';
  AA.traumaSeverity = level => T(level <= 2 ? 'fluid.severity.minimal' : level <= 4 ? 'fluid.severity.mild'
    : level <= 6 ? 'fluid.severity.moderate' : level <= 8 ? 'fluid.severity.severe' : 'fluid.severity.extreme');

  // ================================================================ İzin verilen kan kaybı
  const BLOOD_GROUPS = ['prematureNeonate', 'termNeonate', 'infant', 'child', 'adult'];
  const bloodMlPerKg = (group, sex) => ({ prematureNeonate: 95, termNeonate: 85, infant: 80, child: 75 })[group] ?? (sex === 'male' ? 75 : 65);
  const BloodVolumeEngine = {
    groups: BLOOD_GROUPS,
    mlPerKg: bloodMlPerKg,
    calculate(input) {
      if (!(input.weightKg > 0) || !(input.initialHct > 0) || !(input.targetHct > 0)) return null;
      const factor = bloodMlPerKg(input.group, input.sex);
      const ebv = input.weightKg * factor;
      const delta = Math.max(0, input.initialHct - input.targetHct);
      const avg = (input.initialHct + input.targetHct) / 2;
      const abl = ebv * delta / input.initialHct;
      const ablAvg = avg > 0 ? ebv * delta / avg : 0;
      const pct = AA.I18n.language === 'tr';
      const thresholds = [[1, pct ? '< %15' : '< 15%', 0.15], [2, pct ? '%15–30' : '15–30%', 0.30], [3, pct ? '%30–40' : '30–40%', 0.40], [4, pct ? '> %40' : '> 40%', 0.40]]
        .map(([n, text, f]) => ({ classNumber: n, percentText: text, volume: ebv * f }));
      return {
        mlPerKg: factor, estimatedBloodVolume: ebv, allowableLoss: abl, allowableLossAverageHct: ablAvg,
        allowableLossPercent: ebv > 0 ? abl / ebv * 100 : 0,
        targetHemoglobin: input.targetHct / 3, initialHemoglobin: input.initialHct / 3,
        crystalloidReplacement: abl * 3, colloidReplacement: abl,
        classThresholds: thresholds,
        warnings: BloodVolumeEngine.warnings(input, ebv, abl)
      };
    },
    warnings(input, ebv, abl) {
      const r = [];
      if (input.targetHct >= input.initialHct) {
        r.push(W(2, T('blood.warn.invalid.title'), T('blood.warn.invalid.message', {
          initial: Fmt.smart(input.initialHct), target: Fmt.smart(input.targetHct) })));
      }
      if (input.targetHct < 21) {
        r.push(W(2, T('blood.warn.lowTarget.title'), T('blood.warn.lowTarget.message', {
          target: Fmt.smart(input.targetHct), hb: Fmt.decimal(input.targetHct / 3) })));
      } else if (input.targetHct < 24) {
        r.push(W(1, T('blood.warn.restrictive.title'), T('blood.warn.restrictive.message', {
          target: Fmt.smart(input.targetHct), hb: Fmt.decimal(input.targetHct / 3) })));
      }
      if (input.initialHct < 30) {
        r.push(W(1, T('blood.warn.anemia.title'), T('blood.warn.anemia.message', {
          initial: Fmt.smart(input.initialHct), hb: Fmt.decimal(input.initialHct / 3) })));
      }
      if (['prematureNeonate', 'termNeonate', 'infant'].includes(input.group)) {
        r.push(W(1, T('blood.warn.neonate.title'), T('blood.warn.neonate.message')));
      } else if (input.group === 'child') {
        r.push(W(0, T('blood.warn.pediatric.title'), T('blood.warn.pediatric.message')));
      }
      r.push(W(0, T('blood.warn.estimate.title'), T('blood.warn.estimate.message', { percent: Fmt.smart(abl / Math.max(ebv, 1) * 100) })));
      r.push(W(0, T('blood.warn.transfusion.title'), T('blood.warn.transfusion.message')));
      return bySeverity(r);
    }
  };
  AA.BloodVolumeEngine = BloodVolumeEngine;

  // ================================================================ Zor havayolu skorları
  const AirwayScoreEngine = {
    calculate(score, selections) {
      let total = 0;
      for (const it of score.items) {
        const idx = AA.clamp(selections[it.key] ?? 0, 0, it.options.length - 1);
        total += it.options[idx].points;
      }
      const band = score.bandFor(total);
      const above = score.threshold != null ? total >= score.threshold : false;
      const r = [];
      if (above) {
        r.push(W(1, T('airway.warn.positive.title'), T('airway.warn.positive.message', {
          score: T('airway.' + score.key + '.name'), total: String(total), threshold: String(score.threshold || 0) })));
        r.push(W(1, T('airway.warn.plan.title'), T('airway.warn.plan.message')));
      }
      r.push(W(0, T('airway.warn.singleTest.title'), T('airway.warn.singleTest.message')));
      r.push(W(0, T('airway.warn.documentation.title'), T('airway.warn.documentation.message')));
      return { total, maxPoints: score.maxPoints, bandKey: band ? band.key : null, isAboveThreshold: above, warnings: bySeverity(r) };
    }
  };
  AA.AirwayScoreEngine = AirwayScoreEngine;

  /** Tiromental, sternomental, interinsizör mesafe ve türetilmiş oranlar. */
  const AirwayMeasurementEngine = {
    calculate(input) {
      const f = [];
      const add = (key, value, statusKey, isRisk) => f.push({ key, value, statusKey, isRisk });
      const tmd = input.thyromentalCm, smd = input.sternomentalCm, gap = input.interincisorCm, neck = input.neckCircumferenceCm;
      if (tmd > 0) { const s = tmd >= 6.5 ? 'normal' : tmd >= 6.0 ? 'borderline' : 'difficult'; add('thyromental', Fmt.decimal(tmd) + ' cm', s, s !== 'normal'); }
      if (smd > 0) { const s = smd >= 12.5 ? 'normal' : 'difficult'; add('sternomental', Fmt.decimal(smd) + ' cm', s, s !== 'normal'); }
      if (gap > 0) { const s = gap >= 4 ? 'normal' : gap >= 3 ? 'borderline' : 'difficult'; add('interincisor', Fmt.decimal(gap) + ' cm', s, s !== 'normal'); }
      if (neck > 0) { const s = neck < 40 ? 'normal' : neck < 43 ? 'borderline' : 'difficult'; add('neck', Fmt.decimal(neck) + ' cm', s, s !== 'normal'); }
      const ulbt = AA.clamp(input.upperLipBiteIndex || 0, 0, 2);
      add('ulbt', T('airwayMeasure.ulbt.' + ulbt), ['normal', 'borderline', 'difficult'][ulbt], ulbt === 2);
      let heightRatio = null, neckRatio = null;
      if (tmd > 0) {
        if (input.heightCm > 0) { heightRatio = input.heightCm / tmd; add('rhtmd', Fmt.decimal(heightRatio), heightRatio > 23.5 ? 'difficult' : 'normal', heightRatio > 23.5); }
        if (neck > 0) { neckRatio = neck / tmd; add('ntmd', Fmt.decimal(neckRatio), neckRatio > 5 ? 'difficult' : 'normal', neckRatio > 5); }
      }
      const riskCount = f.filter(x => x.isRisk).length;
      const r = [];
      if (riskCount > 0) r.push(W(riskCount >= 2 ? 1 : 0, T('airwayMeasure.warn.risk.title'), T('airwayMeasure.warn.risk.message', { count: String(riskCount) })));
      r.push(W(0, T('airway.warn.singleTest.title'), T('airway.warn.singleTest.message')));
      r.push(W(0, T('airwayMeasure.warn.technique.title'), T('airwayMeasure.warn.technique.message')));
      return { findings: f, riskCount, heightToThyromental: heightRatio, neckToThyromental: neckRatio, warnings: bySeverity(r) };
    }
  };
  AA.AirwayMeasurementEngine = AirwayMeasurementEngine;

  // ================================================================ Parametre tabanlı skorlar
  const bracketContains = (b, v) => !(b.lower != null && v < b.lower) && !(b.upper != null && v >= b.upper);
  const ParameterScoreEngine = {
    defaultValue(item) { return item.input.type === 'numeric' ? item.input.defaultValue : 0; },
    points(item, value) {
      const inp = item.input;
      if (inp.type === 'numeric') { const b = inp.brackets.find(x => bracketContains(x, value)); return b ? b.points : 0; }
      if (inp.type === 'choice') { const i = AA.clamp(Math.trunc(value), 0, inp.options.length - 1); return inp.options[i].points; }
      return value > 0 ? inp.points : 0;
    },
    calculate(score, values) {
      const itemPoints = {};
      let total = 0;
      for (const it of score.items) {
        const v = values[it.key] ?? ParameterScoreEngine.defaultValue(it);
        // "doubles" anahtarlı onay kutusu, bağlı maddenin puanını bir kez daha ekler (APACHE II'de ABY)
        const p = it.input.doubles ? (v > 0 ? itemPoints[it.input.doubles] || 0 : 0) : ParameterScoreEngine.points(it, v);
        itemPoints[it.key] = p; total += p;
      }
      if (score.logic === 'camICU') return ParameterScoreEngine.camICU(score, values, itemPoints);
      if (score.logic === 'preDeliric') return ParameterScoreEngine.preDeliric(score, values, itemPoints);

      const band = score.bandFor(total);
      const above = score.threshold != null ? total >= score.threshold : false;
      const single = score.singleParameterAlert != null ? Object.values(itemPoints).some(p => p >= score.singleParameterAlert) : false;
      const r = [];
      if (above) {
        r.push(W(1, T('sepsis.warn.positive.title'), T('sepsis.warn.positive.message', {
          score: T('sepsis.' + score.key + '.name'), total: String(total), threshold: String(score.threshold || 0) })));
      }
      if (single) {
        r.push(W(1, T('sepsis.warn.singleParameter.title'), T('sepsis.warn.singleParameter.message', { points: String(score.singleParameterAlert) })));
      }
      r.push(W(0, T('sepsis.warn.trend.title'), T('sepsis.warn.trend.message')));
      if (score.showsSepsisWarnings) r.push(W(0, T('sepsis.warn.bundle.title'), T('sepsis.warn.bundle.message')));
      return { total, itemPoints, bandKey: band ? band.key : null, isAboveThreshold: above, singleParameterAlert: single, warnings: bySeverity(r), percent: null, algorithmicResultKey: null };
    },

    /** CAM-ICU (Ely 2001): Özellik 1 VE 2 ve (3 VEYA 4) → pozitif; RASS −4/−5 değerlendirilemez. */
    camICU(score, values, itemPoints) {
      const sedation = values.sedation || 0;
      const f1 = (values.acuteChange || 0) > 0, f2 = (values.inattention || 0) > 0;
      const f3 = (values.consciousness || 0) > 0, f4 = (values.disorganized || 0) > 0;
      const key = sedation > 0 ? 'unassessable' : (f1 && f2 && (f3 || f4)) ? 'positive' : 'negative';
      const r = [];
      if (key === 'positive') r.push(W(1, T('sepsis.camicu.warn.positive.title'), T('sepsis.camicu.warn.positive.message')));
      if (key === 'unassessable') r.push(W(1, T('sepsis.camicu.warn.unassessable.title'), T('sepsis.camicu.warn.unassessable.message')));
      r.push(W(0, T('sepsis.warn.trend.title'), T('sepsis.warn.trend.message')));
      const total = Object.values(itemPoints).reduce((a, b) => a + b, 0);
      return { total, itemPoints, bandKey: key, isAboveThreshold: key === 'positive', singleParameterAlert: false, warnings: bySeverity(r), percent: null, algorithmicResultKey: key };
    },

    /** PRE-DELIRIC (van den Boogaard 2012) — yayınlanan regresyon katsayıları. */
    preDeliric(score, values, itemPoints) {
      const age = values.age ?? 60, apache = values.apache ?? 15, urea = values.urea ?? 6;
      const admission = [0.0, 0.31, 1.13, 1.36];
      const coma = [0.0, 0.55, 2.70, 2.84];
      const morphine = [0.0, 0.41, 0.13, 0.51];
      const pick = (table, key) => table[AA.clamp(Math.trunc(values[key] || 0), 0, table.length - 1)];
      let x = -6.31;
      x += 0.04 * age;
      x += 0.06 * apache;
      x += pick(admission, 'admission');
      x += pick(coma, 'coma');
      x += (values.infection || 0) > 0 ? 1.05 : 0;
      x += (values.acidosis || 0) > 0 ? 0.29 : 0;
      x += pick(morphine, 'morphine');
      x += (values.sedatives || 0) > 0 ? 1.39 : 0;
      x += 0.03 * urea;
      x += (values.urgent || 0) > 0 ? 0.40 : 0;
      const percent = AA.clamp(100 / (1 + Math.exp(-x)), 0, 100);
      const rounded = Math.round(percent);
      const band = score.bandFor(rounded);
      const thr = score.threshold ?? 50;
      const r = [];
      if (rounded >= thr) r.push(W(1, T('sepsis.prediliric.warn.title'), T('sepsis.prediliric.warn.message', { percent: String(rounded) })));
      r.push(W(0, T('sepsis.warn.trend.title'), T('sepsis.warn.trend.message')));
      return { total: rounded, itemPoints, bandKey: band ? band.key : null, isAboveThreshold: rounded >= thr, singleParameterAlert: false, warnings: bySeverity(r), percent, algorithmicResultKey: null };
    }
  };
  AA.ParameterScoreEngine = ParameterScoreEngine;

  // ================================================================ Sıvı ve elektrolit motoru
  const ElectrolyteEngine = {
    defaultValue(field) { return field.input.type === 'numeric' ? field.input.defaultValue : 0; },
    calculate(tool, values) {
      const v = key => {
        if (values[key] != null) return values[key];
        const f = tool.fields.find(x => x.key === key);
        return f ? ElectrolyteEngine.defaultValue(f) : 0;
      };
      const option = key => {
        const f = tool.fields.find(x => x.key === key);
        if (!f || f.input.type !== 'choice') return null;
        return f.input.options[AA.clamp(Math.trunc(v(key)), 0, f.input.options.length - 1)];
      };
      const flag = key => v(key) > 0;
      return ElectrolyteEngine[tool.calc](tool, v, option, flag);
    },

    // Hiponatremi · Adrogué–Madias (NEJM 2000)
    hyponatremia(tool, v, option, flag) {
      const tbw = v('weight') * (option('tbw')?.value ?? 0.6);
      const serum = v('sodium');
      const infusate = option('fluid')?.value ?? 513;
      const limit = flag('highRisk') ? 6 : 8;
      const target = Math.min(v('target'), limit);
      const deltaPerLitre = (infusate - serum) / (tbw + 1);
      const volumeLitres = deltaPerLitre > 0 ? target / deltaPerLitre : Infinity;
      const ratePerHour = isFinite(volumeLitres) ? volumeLitres * 1000 / 24 : NaN;
      const warnings = [
        W(2, T('electro.hyponatremia.warn.limit.title'), T('electro.hyponatremia.warn.limit.message', { limit: Fmt.decimal(limit, 0) })),
        W(1, T('electro.hyponatremia.warn.formula.title'), T('electro.hyponatremia.warn.formula.message')),
        W(0, T('electro.hyponatremia.warn.symptoms.title'), T('electro.hyponatremia.warn.symptoms.message'))
      ];
      if (deltaPerLitre <= 0) warnings.unshift(W(2, T('electro.hyponatremia.warn.hypotonic.title'), T('electro.hyponatremia.warn.hypotonic.message')));
      return {
        primaryKey: 'rate', primaryValue: isFinite(ratePerHour) ? Fmt.decimal(ratePerHour, 0) : '—',
        primaryUnit: 'mL/' + T('unit.hourShort'),
        rows: [
          { key: 'tbw', value: Fmt.decimal(tbw, 1), unit: 'L' },
          { key: 'deltaPerLitre', value: Fmt.decimal(deltaPerLitre, 2), unit: 'mmol/L' },
          { key: 'volume', value: isFinite(volumeLitres) ? Fmt.decimal(volumeLitres * 1000, 0) : '—', unit: 'mL' },
          { key: 'appliedTarget', value: Fmt.decimal(target, 0), unit: 'mmol/L' }
        ],
        verdictKey: flag('highRisk') ? 'highRisk' : 'standard', verdictTint: flag('highRisk') ? 'danger' : tool.tint, warnings
      };
    },

    // Hipernatremi · serbest su açığı
    hypernatremia(tool, v, option, flag) {
      const tbw = v('weight') * (option('tbw')?.value ?? 0.6);
      const sodium = v('sodium'), target = v('target');
      const hours = Math.max(v('hours'), 1);
      const deficit = tbw * (sodium / Math.max(target, 1) - 1);
      const total = deficit * 1000 + v('losses');
      const rate = total / hours;
      const drop = (sodium - target) / hours;
      const dailyDrop = drop * 24;
      const isAcute = flag('acute');
      const maxDaily = isAcute ? 24 : 10;
      const warnings = [
        W(dailyDrop > maxDaily ? 2 : 0, T('electro.hypernatremia.warn.rate.title'), T('electro.hypernatremia.warn.rate.message', {
          daily: Fmt.decimal(dailyDrop, 1), max: Fmt.decimal(maxDaily, 0) })),
        W(1, T('electro.hypernatremia.warn.losses.title'), T('electro.hypernatremia.warn.losses.message'))
      ];
      if (sodium <= target) warnings.unshift(W(1, T('electro.hypernatremia.warn.noDeficit.title'), T('electro.hypernatremia.warn.noDeficit.message')));
      return {
        primaryKey: 'rate', primaryValue: Fmt.decimal(Math.max(rate, 0), 0), primaryUnit: 'mL/' + T('unit.hourShort'),
        rows: [
          { key: 'tbw', value: Fmt.decimal(tbw, 1), unit: 'L' },
          { key: 'deficit', value: Fmt.decimal(Math.max(deficit, 0) * 1000, 0), unit: 'mL' },
          { key: 'total', value: Fmt.decimal(Math.max(total, 0), 0), unit: 'mL' },
          { key: 'drop', value: Fmt.decimal(drop, 2), unit: 'mmol/L/' + T('unit.hourShort') },
          { key: 'dailyDrop', value: Fmt.decimal(dailyDrop, 1), unit: 'mmol/L' }
        ],
        verdictKey: dailyDrop > maxDaily ? 'tooFast' : (isAcute ? 'acute' : 'chronic'),
        verdictTint: dailyDrop > maxDaily ? 'danger' : tool.tint, warnings
      };
    },

    // Potasyum replasmanı
    potassium(tool, v, option, flag) {
      const current = v('potassium'), target = v('target');
      const gap = Math.max(target - current, 0);
      const low = gap * 200, high = gap * 400;
      const maxRate = option('route')?.value ?? 10;
      const hours = v('dose') / Math.max(maxRate, 1);
      const isPeripheral = (option('route')?.key ?? 'peripheral') === 'peripheral';
      const maxConc = isPeripheral ? 40 : 100;
      const warnings = [
        W(2, T('electro.potassium.warn.rate.title'), T('electro.potassium.warn.rate.message', {
          rate: Fmt.decimal(maxRate, 0), concentration: Fmt.decimal(maxConc, 0) })),
        W(1, T('electro.potassium.warn.magnesium.title'), T('electro.potassium.warn.magnesium.message'))
      ];
      if (flag('renal')) warnings.unshift(W(2, T('electro.potassium.warn.renal.title'), T('electro.potassium.warn.renal.message')));
      if (current < 2.5) warnings.unshift(W(2, T('electro.potassium.warn.severe.title'), T('electro.potassium.warn.severe.message')));
      return {
        primaryKey: 'deficit', primaryValue: Fmt.decimal(low, 0) + '–' + Fmt.decimal(high, 0), primaryUnit: 'mmol',
        rows: [
          { key: 'gap', value: Fmt.decimal(gap, 1), unit: 'mmol/L' },
          { key: 'maxRate', value: Fmt.decimal(maxRate, 0), unit: 'mmol/' + T('unit.hourShort') },
          { key: 'maxConcentration', value: Fmt.decimal(maxConc, 0), unit: 'mmol/L' },
          { key: 'duration', value: Fmt.duration(hours), unit: null }
        ],
        verdictKey: current < 2.5 ? 'severe' : current < 3.0 ? 'moderate' : 'mild',
        verdictTint: current < 2.5 ? 'danger' : current < 3.0 ? 'warning' : tool.tint, warnings
      };
    },

    // Anyon açığı paketi
    anionGap(tool, v) {
      const na = v('sodium'), cl = v('chloride'), hco3 = v('bicarbonate'), albumin = v('albumin'), paco2 = v('paco2');
      const ag = na - (cl + hco3);
      const corrected = ag + 2.5 * (4.0 - albumin);
      const deltaRatio = (24 - hco3) !== 0 ? (corrected - 12) / (24 - hco3) : NaN;
      const expected = 1.5 * hco3 + 8;
      let verdict;
      if (corrected <= 12) verdict = 'normalGap';
      else if (!isFinite(deltaRatio)) verdict = 'highGap';
      else if (deltaRatio < 0.4) verdict = 'nagma';
      else if (deltaRatio < 0.8) verdict = 'mixed';
      else if (deltaRatio <= 2) verdict = 'pureAgma';
      else verdict = 'alkalosis';
      const warnings = [];
      const diff = paco2 - expected;
      if (Math.abs(diff) > 2) {
        warnings.push(W(1, T(diff > 0 ? 'electro.aniongap.warn.respAcidosis.title' : 'electro.aniongap.warn.respAlkalosis.title'),
          T(diff > 0 ? 'electro.aniongap.warn.respAcidosis.message' : 'electro.aniongap.warn.respAlkalosis.message', { expected: Fmt.decimal(expected, 0) })));
      }
      if (albumin < 3.5) warnings.push(W(1, T('electro.aniongap.warn.albumin.title'), T('electro.aniongap.warn.albumin.message')));
      warnings.push(W(0, T('electro.aniongap.warn.winter.title'), T('electro.aniongap.warn.winter.message', { expected: Fmt.decimal(expected, 0) })));
      return {
        primaryKey: 'corrected', primaryValue: Fmt.decimal(corrected, 1), primaryUnit: 'mmol/L',
        rows: [
          { key: 'ag', value: Fmt.decimal(ag, 1), unit: 'mmol/L' },
          { key: 'deltaRatio', value: isFinite(deltaRatio) ? Fmt.decimal(deltaRatio, 2) : '—', unit: null },
          { key: 'expectedCO2', value: Fmt.decimal(expected - 2, 0) + '–' + Fmt.decimal(expected + 2, 0), unit: 'mmHg' },
          { key: 'measuredCO2', value: Fmt.decimal(paco2, 0), unit: 'mmHg' }
        ],
        verdictKey: verdict, verdictTint: corrected > 12 ? 'warning' : tool.tint, warnings
      };
    },

    // Kümülatif sıvı yükü
    fluidBalance(tool, v) {
      const weight = Math.max(v('weight'), 1);
      const balance = v('intake') - v('output');
      const percent = balance / weight * 100;
      const daily = balance / Math.max(v('days'), 1);
      const verdict = percent >= 10 ? 'severe' : percent >= 5 ? 'moderate' : percent >= 0 ? 'mild' : 'negative';
      const warnings = [];
      if (percent >= 10) warnings.push(W(2, T('electro.fluidbalance.warn.overload.title'), T('electro.fluidbalance.warn.overload.message', { percent: Fmt.decimal(percent, 1) })));
      warnings.push(W(0, T('electro.fluidbalance.warn.weight.title'), T('electro.fluidbalance.warn.weight.message')));
      warnings.push(W(0, T('electro.fluidbalance.warn.deresuscitation.title'), T('electro.fluidbalance.warn.deresuscitation.message')));
      return {
        primaryKey: 'percent', primaryValue: Fmt.decimal(percent, 1), primaryUnit: '%',
        rows: [
          { key: 'balance', value: Fmt.decimal(balance, 1), unit: 'L' },
          { key: 'daily', value: Fmt.decimal(daily, 2), unit: 'L' },
          { key: 'estimatedWeight', value: Fmt.decimal(weight + balance, 1), unit: 'kg' }
        ],
        verdictKey: verdict, verdictTint: percent >= 10 ? 'danger' : percent >= 5 ? 'warning' : tool.tint, warnings
      };
    },

    // KDIGO 2012 evrelemesi
    kdigo(tool, v, option, flag) {
      const baseline = Math.max(v('baseline'), 0.1), current = v('current');
      const ratio = current / baseline, rise = current - baseline;
      let cs = 0;
      if (flag('rrt') || ratio >= 3 || current >= 4.0) cs = 3;
      else if (ratio >= 2) cs = 2;
      else if (ratio >= 1.5 || rise >= 0.3) cs = 1;
      const urine = v('urine');
      const di = Math.trunc(option('duration')?.value ?? 0);
      let us = 0;
      if (flag('anuria') && di >= 2) us = 3;
      else if (urine < 0.3 && di >= 3) us = 3;
      else if (urine < 0.5 && di >= 2) us = 2;
      else if (urine < 0.5 && di >= 1) us = 1;
      const stage = Math.max(cs, us);
      const warnings = [];
      if (stage >= 2) warnings.push(W(2, T('electro.kdigo.warn.stage.title'), T('electro.kdigo.warn.stage.message', { stage: String(stage) })));
      warnings.push(W(1, T('electro.kdigo.warn.nephrotoxic.title'), T('electro.kdigo.warn.nephrotoxic.message')));
      warnings.push(W(0, T('electro.kdigo.warn.baseline.title'), T('electro.kdigo.warn.baseline.message')));
      return {
        primaryKey: 'stage', primaryValue: stage === 0 ? T('electro.kdigo.result.noAki') : String(stage),
        primaryUnit: stage === 0 ? '' : '/ 3',
        rows: [
          { key: 'ratio', value: Fmt.decimal(ratio, 2), unit: '×' },
          { key: 'rise', value: Fmt.decimal(rise, 2), unit: 'mg/dL' },
          { key: 'creatinineStage', value: String(cs), unit: null },
          { key: 'urineStage', value: String(us), unit: null }
        ],
        verdictKey: 'stage' + stage,
        verdictTint: stage >= 3 ? 'danger' : stage === 2 ? 'warning' : stage === 1 ? 'info' : 'success', warnings
      };
    },

    // Düzeltilmiş sodyum ve kalsiyum
    corrections(tool, v, option) {
      const measuredNa = v('sodium'), glucose = v('glucose');
      const factor = option('factor')?.value ?? 1.6;
      const correctedNa = measuredNa + factor * (Math.max(glucose - 100, 0) / 100);
      const calcium = v('calcium'), albumin = v('albumin');
      const correctedCa = calcium + 0.8 * (4.0 - albumin);
      const warnings = [
        W(0, T('electro.corrections.warn.ionized.title'), T('electro.corrections.warn.ionized.message')),
        W(0, T('electro.corrections.warn.factor.title'), T('electro.corrections.warn.factor.message'))
      ];
      if (correctedNa >= 145) warnings.unshift(W(1, T('electro.corrections.warn.hidden.title'), T('electro.corrections.warn.hidden.message')));
      return {
        primaryKey: 'correctedSodium', primaryValue: Fmt.decimal(correctedNa, 1), primaryUnit: 'mmol/L',
        rows: [
          { key: 'sodiumShift', value: Fmt.decimal(correctedNa - measuredNa, 1), unit: 'mmol/L' },
          { key: 'correctedCalcium', value: Fmt.decimal(correctedCa, 2), unit: 'mg/dL' },
          { key: 'calciumShift', value: Fmt.decimal(correctedCa - calcium, 2), unit: 'mg/dL' }
        ],
        verdictKey: correctedNa >= 145 ? 'hypernatremic' : correctedNa < 135 ? 'hyponatremic' : 'normal',
        verdictTint: correctedNa >= 145 ? 'warning' : tool.tint, warnings
      };
    },

    // FENa ve FEÜre
    fena(tool, v) {
      const sNa = v('serumNa'), uNa = v('urineNa'), sCr = v('serumCr'), uCr = v('urineCr');
      const sU = v('serumUrea'), uU = v('urineUrea');
      const feNa = (sNa * uCr) !== 0 ? (uNa * sCr) / (sNa * uCr) * 100 : NaN;
      const feUrea = (sU * uCr) !== 0 ? (uU * sCr) / (sU * uCr) * 100 : NaN;
      const verdict = !isFinite(feNa) ? 'invalid' : feNa < 1 ? 'prerenal' : feNa > 2 ? 'intrinsic' : 'indeterminate';
      const warnings = [
        W(1, T('electro.fena.warn.diuretic.title'), T('electro.fena.warn.diuretic.message')),
        W(1, T('electro.fena.warn.exceptions.title'), T('electro.fena.warn.exceptions.message')),
        W(0, T('electro.fena.warn.oliguria.title'), T('electro.fena.warn.oliguria.message'))
      ];
      return {
        primaryKey: 'feNa', primaryValue: isFinite(feNa) ? Fmt.decimal(feNa, 2) : '—', primaryUnit: '%',
        rows: [
          { key: 'feUrea', value: isFinite(feUrea) ? Fmt.decimal(feUrea, 1) : '—', unit: '%' },
          { key: 'urineNaRow', value: Fmt.decimal(uNa, 0), unit: 'mmol/L' }
        ],
        verdictKey: verdict, verdictTint: verdict === 'prerenal' ? 'info' : verdict === 'intrinsic' ? 'warning' : tool.tint, warnings
      };
    }
  };
  AA.ElectrolyteEngine = ElectrolyteEngine;

  // ================================================================ Arter kan gazı (6 adımlı Boston akışı)
  const BloodGasEngine = {
    phLow: 7.35, phHigh: 7.45, paco2Low: 35, paco2High: 45, hco3Low: 22, hco3High: 26, agLow: 8, agHigh: 12,
    defaults() {
      const d = {};
      AA.BLOODGAS_FIELDS.forEach(f => { d[f.key] = ElectrolyteEngine.defaultValue(f); });
      return d;
    },
    analyze(values) {
      const E = BloodGasEngine;
      const def = E.defaults();
      const v = k => values[k] ?? def[k] ?? 0;
      const ph = v('ph'), paco2 = v('paco2'), hco3 = v('hco3');
      const na = v('sodium'), cl = v('chloride'), albumin = v('albumin'), lactate = v('lactate');
      const isChronic = v('chronicity') > 0;
      const sbe = v('sbe'), phosphate = v('phosphate');
      const out = { steps: [], conclusion: '', conclusionTint: 'accent', rows: [], advancedRows: [], etiologies: [], warnings: [] };
      const disorders = [];

      // 1. adım: pH
      const acidemia = ph < E.phLow, alkalemia = ph > E.phHigh;
      const s1 = acidemia ? 'acidemia' : alkalemia ? 'alkalemia' : 'normal';
      out.steps.push({ index: 1, summary: T('bg.step1.' + s1), detail: T('bg.step1.detail', { ph: Fmt.fixed(ph, 2) }), tint: acidemia || alkalemia ? 'warning' : 'success' });

      // 2. adım: birincil bozukluk
      let primary;
      if (acidemia) {
        if (hco3 < E.hco3Low && paco2 > E.paco2High) primary = 'combinedAcidosis';
        else if (hco3 < E.hco3Low) primary = 'metabolicAcidosis';
        else if (paco2 > E.paco2High) primary = 'respiratoryAcidosis';
        else primary = 'indeterminate';
      } else if (alkalemia) {
        if (hco3 > E.hco3High && paco2 < E.paco2Low) primary = 'combinedAlkalosis';
        else if (hco3 > E.hco3High) primary = 'metabolicAlkalosis';
        else if (paco2 < E.paco2Low) primary = 'respiratoryAlkalosis';
        else primary = 'indeterminate';
      } else {
        if (hco3 < E.hco3Low && paco2 < E.paco2Low) primary = 'compensatedAcidosis';
        else if (hco3 > E.hco3High && paco2 > E.paco2High) primary = 'compensatedAlkalosis';
        else if (hco3 < E.hco3Low || hco3 > E.hco3High || paco2 < E.paco2Low || paco2 > E.paco2High) primary = 'indeterminate';
        else primary = 'none';
      }
      const isMetAcidosis = ['metabolicAcidosis', 'combinedAcidosis', 'compensatedAcidosis'].includes(primary);
      const isResp = primary === 'respiratoryAcidosis' || primary === 'respiratoryAlkalosis';
      if (primary !== 'none') disorders.push(T('bg.primary.' + primary));
      out.steps.push({ index: 2, summary: T('bg.primary.' + primary),
        detail: T('bg.step2.detail', { hco3: Fmt.decimal(hco3, 1), paco2: Fmt.decimal(paco2, 0) }),
        tint: primary === 'none' ? 'success' : 'warning' });

      // 3. adım: anyon açığı ve albümin düzeltmesi
      const ag = na - (cl + hco3);
      const agk = ag + 2.5 * (4.0 - albumin);
      const highGap = agk > E.agHigh;
      const gapKey = highGap ? 'high' : agk < E.agLow ? 'low' : 'normal';
      out.steps.push({ index: 3, summary: T('bg.step3.' + gapKey),
        detail: T('bg.step3.detail', { ag: Fmt.decimal(ag, 1), agk: Fmt.decimal(agk, 1), albumin: Fmt.decimal(albumin, 1) }),
        tint: highGap ? 'danger' : 'success' });
      if (highGap && !isMetAcidosis) disorders.push(T('bg.disorder.hiddenHagma'));

      // 4. adım: kompanzasyon
      let expectedText = '—', compKey = 'notApplicable', compTint = 'textTertiary';
      const judge = (measured, low, high, aboveKey, belowKey, aboveTint, belowTint, aboveDisorder, belowDisorder) => {
        if (measured > high) { compKey = aboveKey; compTint = aboveTint; disorders.push(T(aboveDisorder)); }
        else if (measured < low) { compKey = belowKey; compTint = belowTint; disorders.push(T(belowDisorder)); }
        else { compKey = 'appropriate'; compTint = 'success'; }
      };
      if (primary === 'metabolicAcidosis' || primary === 'compensatedAcidosis') {
        const exp = 1.5 * hco3 + 8, low = exp - 2, high = exp + 2;
        expectedText = Fmt.decimal(low, 0) + '–' + Fmt.decimal(high, 0) + ' mmHg';
        judge(paco2, low, high, 'addedRespAcidosis', 'addedRespAlkalosis', 'danger', 'warning', 'bg.disorder.respAcidosis', 'bg.disorder.respAlkalosis');
      } else if (primary === 'metabolicAlkalosis' || primary === 'compensatedAlkalosis') {
        const exp = 0.7 * hco3 + 20, low = exp - 5, high = exp + 5;
        expectedText = Fmt.decimal(low, 0) + '–' + Fmt.decimal(high, 0) + ' mmHg';
        judge(paco2, low, high, 'addedRespAcidosis', 'addedRespAlkalosis', 'danger', 'warning', 'bg.disorder.respAcidosis', 'bg.disorder.respAlkalosis');
      } else if (isResp) {
        const delta = (paco2 - 40) / 10;
        let lf, hf;
        if (primary === 'respiratoryAcidosis') { lf = isChronic ? 3.5 : 1.0; hf = isChronic ? 4.0 : 1.0; }
        else { lf = isChronic ? -5.0 : -2.0; hf = lf; }
        const a = 24 + lf * delta, b = 24 + hf * delta;
        const low = Math.min(a, b) - 2, high = Math.max(a, b) + 2;
        expectedText = Fmt.decimal(low, 1) + '–' + Fmt.decimal(high, 1) + ' mEq/L';
        if (hco3 > high) { compKey = 'addedMetAlkalosis'; compTint = 'warning'; disorders.push(T('bg.disorder.metAlkalosis')); }
        else if (hco3 < low) { compKey = 'addedMetAcidosis'; compTint = 'danger'; disorders.push(T('bg.disorder.metAcidosis')); }
        else { compKey = 'appropriate'; compTint = 'success'; }
      } else if (primary === 'combinedAcidosis' || primary === 'combinedAlkalosis') {
        compKey = 'combined'; compTint = 'danger';
      }
      out.steps.push({ index: 4, summary: T('bg.step4.' + compKey),
        detail: T('bg.step4.detail', { expected: expectedText, measured: isResp ? Fmt.decimal(hco3, 1) + ' mEq/L' : Fmt.decimal(paco2, 0) + ' mmHg' }),
        tint: compTint });

      // 5. adım: delta oranı
      let deltaRatio = NaN, deltaKey = 'notApplicable';
      if (highGap && (24 - hco3) !== 0) {
        deltaRatio = (agk - 12) / (24 - hco3);
        if (deltaRatio < 0.4) { deltaKey = 'nagma'; disorders.push(T('bg.disorder.nagma')); }
        else if (deltaRatio < 0.8) { deltaKey = 'mixed'; disorders.push(T('bg.disorder.nagma')); }
        else if (deltaRatio <= 2.0) deltaKey = 'pureHagma';
        else { deltaKey = 'hagmaAlkalosis'; disorders.push(T('bg.disorder.metAlkalosis')); }
      }
      out.steps.push({ index: 5, summary: T('bg.step5.' + deltaKey),
        detail: isFinite(deltaRatio) ? T('bg.step5.detail', { ratio: Fmt.decimal(deltaRatio, 2) }) : T('bg.step5.detailNone'),
        tint: deltaKey === 'notApplicable' ? 'textTertiary' : 'info' });

      // 6. adım: sonuç
      const unique = [...new Set(disorders)];
      out.conclusion = unique.length ? unique.join(' + ') : T('bg.primary.none');
      out.conclusionTint = primary === 'none' && !highGap ? 'success' : 'warning';
      out.steps.push({ index: 6, summary: out.conclusion, detail: T('bg.step6.detail'), tint: out.conclusionTint });

      if (highGap) {
        out.etiologies.push(T('bg.etiology.hagma'));
        if (lactate > 2) out.etiologies.push(T('bg.etiology.lactate', { lactate: Fmt.decimal(lactate, 1) }));
      }
      if (deltaKey === 'nagma' || deltaKey === 'mixed') out.etiologies.push(T('bg.etiology.nagma'));
      if (primary === 'metabolicAlkalosis' || primary === 'compensatedAlkalosis' || deltaKey === 'hagmaAlkalosis') out.etiologies.push(T('bg.etiology.metAlkalosis'));
      if (primary === 'respiratoryAcidosis' || compKey === 'addedRespAcidosis') out.etiologies.push(T('bg.etiology.respAcidosis'));
      if (primary === 'respiratoryAlkalosis' || compKey === 'addedRespAlkalosis') out.etiologies.push(T('bg.etiology.respAlkalosis'));

      out.rows = [
        { key: 'ag', value: Fmt.decimal(ag, 1), unit: 'mEq/L' },
        { key: 'agk', value: Fmt.decimal(agk, 1), unit: 'mEq/L' },
        { key: 'deltaRatio', value: isFinite(deltaRatio) ? Fmt.decimal(deltaRatio, 2) : '—', unit: null },
        { key: 'expected', value: expectedText, unit: null }
      ];

      // İleri blok: Stewart ve partitioned BE (Story)
      const albGL = albumin * 10;
      const sid = na - cl;
      // Zayıf asit yükü (Figge 1992): albümin × (0,123·pH − 0,631) + fosfat × (0,309·pH − 0,469); pH 7,40'ta ≈ 0,28 ve 1,8
      const weakAcidCharge = albGL * (0.123 * ph - 0.631) + phosphate * (0.309 * ph - 0.469);
      const sig = ag - weakAcidCharge;
      const beCl = na - cl - 32, beAlb = 0.25 * (42 - albGL), beLac = 1 - lactate;
      const beGap = sbe - (beCl + beAlb + beLac);
      out.advancedRows = [
        { key: 'sid', value: Fmt.decimal(sid, 1), unit: 'mEq/L' },
        { key: 'sig', value: Fmt.decimal(sig, 1), unit: 'mmol/L' },
        { key: 'beCl', value: Fmt.decimal(beCl, 1), unit: 'mEq/L' },
        { key: 'beAlb', value: Fmt.decimal(beAlb, 1), unit: 'mEq/L' },
        { key: 'beLac', value: Fmt.decimal(beLac, 1), unit: 'mEq/L' },
        { key: 'beGap', value: Fmt.decimal(beGap, 1), unit: 'mEq/L' }
      ];

      const w = out.warnings;
      if (ph < 7.10) w.push(W(2, T('bg.warn.severeAcidemia.title'), T('bg.warn.severeAcidemia.message')));
      if (ph >= 7.60) w.push(W(2, T('bg.warn.severeAlkalemia.title'), T('bg.warn.severeAlkalemia.message')));
      if (hco3 < 6) w.push(W(2, T('bg.warn.compensationLimit.title'), T('bg.warn.compensationLimit.message')));
      if (albumin < 3.5 && ag <= E.agHigh && agk > E.agHigh) {
        w.push(W(1, T('bg.warn.albuminTrap.title'), T('bg.warn.albuminTrap.message', { ag: Fmt.decimal(ag, 1), agk: Fmt.decimal(agk, 1) })));
      }
      if (!acidemia && !alkalemia && (highGap || primary !== 'none')) w.push(W(1, T('bg.warn.normalPh.title'), T('bg.warn.normalPh.message')));
      if (isFinite(deltaRatio) && deltaRatio >= 1.8 && deltaRatio <= 2.0) {
        w.push(W(1, T('bg.warn.deltaBorderline.title'), T('bg.warn.deltaBorderline.message', { ratio: Fmt.decimal(deltaRatio, 2) })));
      }
      if (sig > 2) w.push(W(1, T('bg.warn.sig.title'), T('bg.warn.sig.message', { sig: Fmt.decimal(sig, 1) })));
      w.push(W(0, T('bg.warn.chronicity.title'), T('bg.warn.chronicity.message')));
      w.push(W(0, T('bg.warn.interpretation.title'), T('bg.warn.interpretation.message')));
      bySeverity(w);
      return out;
    }
  };
  AA.BloodGasEngine = BloodGasEngine;
})();
