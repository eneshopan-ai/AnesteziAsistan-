/* Anestezi Asistanı — kaynakça kayıtları (DOI / PMID bağlantıları).
 * Kural: yalnızca doğrulanmış DOI/PMID yazılır; doğrulanamayan tanımlayıcı alanı boş bırakılır ve bağlantı üretilmez.
 * `REFS` kaynakları, `CALC_REFS` hesaplayıcı kimliğini kaynaklara eşler. */
(function () {
  'use strict';
  const AA = window.AA;
  const esc = AA.UI.esc;

  const REFS = {
    rosenberg2004: { cite: 'Rosenberg PH, Veering BT, Urmey WF. Maximum recommended doses of local anesthetics: a multifactorial concept. Reg Anesth Pain Med. 2004;29(6):564–575.', doi: '10.1016/j.rapm.2004.08.003', pmid: '15635516' },
    neal2018: { cite: 'Neal JM, Barrington MJ, Fettiplace MR, Gitman M, Memtsoudis SG, Mörwald EE, Rubin DS, Weinberg G. The Third American Society of Regional Anesthesia and Pain Medicine Practice Advisory on Local Anesthetic Systemic Toxicity: Executive Summary 2017. Reg Anesth Pain Med. 2018;43(2):113.', doi: '10.1097/AAP.0000000000000720', pmid: '29356773' },
    rosenberg2015: { cite: 'Rosenberg H, Pollock N, Schiemann A, Bulger T, Stowell K. Malignant hyperthermia: a review. Orphanet J Rare Dis. 2015;10:93.', doi: '10.1186/s13023-015-0310-1', pmid: '26238698' },
    topjian2020: { cite: 'Topjian AA, Raymond TT, Atkins D, et al. Part 4: Pediatric Basic and Advanced Life Support: 2020 American Heart Association Guidelines for Cardiopulmonary Resuscitation and Emergency Cardiovascular Care. Circulation. 2020;142(16 Suppl 2):S469–S523.', doi: '10.1161/CIR.0000000000000901' },
    mhaus: { cite: 'Malignant Hyperthermia Association of the United States (MHAUS). Emergency therapy for malignant hyperthermia (dantrolen 2,5 mg/kg).' },
    cormack1984: { cite: 'Cormack RS, Lehane J. Difficult tracheal intubation in obstetrics. Anaesthesia. 1984;39(11):1105–1111.', doi: '10.1111/j.1365-2044.1984.tb08932.x' },
    cook2000: { cite: 'Cook TM. A new practical classification of laryngeal view. Anaesthesia. 2000;55:274.' },
    mallampati1985: { cite: 'Mallampati SR, Gatt SP, Gugino LD, Desai SP, Waraksa B, Freiberger D, Liu PL. A clinical sign to predict difficult tracheal intubation: a prospective study. Can Anaesth Soc J. 1985;32(4):429–434.', pmid: '4027773' },
    samsoon1987: { cite: 'Samsoon GL, Young JR. Difficult tracheal intubation: a retrospective study. Anaesthesia. 1987;42(5):487–490.', doi: '10.1111/j.1365-2044.1987.tb04039.x', pmid: '3592174' },
    reed2005: { cite: 'Reed MJ, Dunn MJ, McKeown DW. Can an airway assessment score predict difficulty at intubation in the emergency department? Emerg Med J. 2005;22(2):99–102.', doi: '10.1136/emj.2003.008771', pmid: '15662057' },
    dejong2013: { cite: 'De Jong A, et al. Early identification of patients at risk for difficult intubation in the intensive care unit: development and validation of the MACOCHA score in a multicenter cohort study. Am J Respir Crit Care Med. 2013;187(8):832–839.', doi: '10.1164/rccm.201210-1851OC' },
    elganzouri1996: { cite: 'El-Ganzouri AR, McCarthy RJ, Tuman KJ, Tanck EN, Ivankovich AD. Preoperative airway assessment: predictive value of a multivariate risk index. Anesth Analg. 1996;82(6):1197–1204.' },
    wilson1988: { cite: 'Wilson ME, Spiegelhalter D, Robertson JA, Lesser P. Predicting difficult intubation. Br J Anaesth. 1988;61(2):211–216.' },
    savva1994: { cite: 'Savva D. Prediction of difficult tracheal intubation. Br J Anaesth. 1994;73(2):149–153.', pmid: '7917726' },
    khan2003: { cite: 'Khan ZH, et al. A comparison of the upper lip bite test (a simple new technique) with modified Mallampati classification in predicting difficulty in endotracheal intubation: a prospective blinded study. Anesth Analg. 2003;96:595–599.' },
    schmitt2002: { cite: 'Schmitt HJ, Kirmse M, Radespiel-Troger M. Ratio of patient\'s height to thyromental distance improves prediction of difficult laryngoscopy. Anaesth Intensive Care. 2002;30(6):763–765.', doi: '10.1177/0310057X0203000607', pmid: '12500514' },
    kim2011: { cite: 'Kim WH, Ahn HJ, Lee CJ, Shin BS, Ko JS, Choi SJ, Ryu SA. Neck circumference to thyromental distance ratio: a new predictor of difficult intubation in obese patients. Br J Anaesth. 2011;106(5):743–748.', pmid: '21354999' },
    albert1967: { cite: 'Albert MS, Dell RB, Winters RW. Quantitative displacement of acid-base equilibrium in metabolic acidosis. Ann Intern Med. 1967;66(2):312–322.' },
    figge1998: { cite: 'Figge J, Jabor A, Kazda A, Fencl V. Anion gap and hypoalbuminemia. Crit Care Med. 1998;26(11):1807–1810.', doi: '10.1097/00003246-199811000-00019', pmid: '9824071' },
    story2004: { cite: 'Story DA, Morimatsu H, Bellomo R. Strong ions, weak acids and base excess: a simplified Fencl-Stewart approach to clinical acid-base disorders. Br J Anaesth. 2004;92(1):54–60.' },
    semler2018: { cite: 'Semler MW, Self WH, Wanderer JP, et al. Balanced crystalloids versus saline in critically ill adults. N Engl J Med. 2018;378(9):829–839.', doi: '10.1056/NEJMoa1711584', pmid: '29485925' },
    finfer2022: { cite: 'Finfer S, Micallef S, Hammond N, et al. Balanced multielectrolyte solution versus saline in critically ill adults. N Engl J Med. 2022;386(9):815–826.', doi: '10.1056/NEJMoa2114464', pmid: '35041780' },
    espinel1976: { cite: 'Espinel CH. The FENa test. Use in the differential diagnosis of acute renal failure. JAMA. 1976;236(6):579–581.', doi: '10.1001/jama.236.6.579', pmid: '947239' },
    carvounis2002: { cite: 'Carvounis CP, Nisar S, Guro-Razuman S. Significance of the fractional excretion of urea in the differential diagnosis of acute renal failure. Kidney Int. 2002;62(6):2223–2229.', pmid: '12427149' },
    payen2008: { cite: 'Payen D, de Pont AC, Sakr Y, Spies C, Reinhart K, Vincent JL. A positive fluid balance is associated with a worse outcome in patients with acute renal failure. Crit Care. 2008;12(3):R74.', doi: '10.1186/cc6916', pmid: '18533029' },
    bouchard2009: { cite: 'Bouchard J, Soroko SB, Chertow GM, Himmelfarb J, Ikizler TA, Paganini EP, Mehta RL. Fluid accumulation, survival and recovery of kidney function in critically ill patients with acute kidney injury. Kidney Int. 2009;76(4):422–427.', pmid: '19436332' },
    adrogue2000a: { cite: 'Adrogué HJ, Madias NE. Hypernatremia. N Engl J Med. 2000;342(20):1493–1499.', doi: '10.1056/NEJM200005183422006', pmid: '10816188' },
    adrogue2000b: { cite: 'Adrogué HJ, Madias NE. Hyponatremia. N Engl J Med. 2000;342(21):1581–1589.' },
    sterns2019: { cite: 'Sterns RH. Evidence for managing hypernatremia: is it just hyponatremia in reverse? Clin J Am Soc Nephrol. 2019;14(5):645–647.', doi: '10.2215/CJN.02950319', pmid: '31064771' },
    spasovski2014: { cite: 'Spasovski G, Vanholder R, Allolio B, et al. Clinical practice guideline on diagnosis and treatment of hyponatraemia. Intensive Care Med. 2014;40(3):320–331.', doi: '10.1007/s00134-014-3210-2' },
    verbalis2013: { cite: 'Verbalis JG, Goldsmith SR, Greenberg A, et al. Diagnosis, evaluation, and treatment of hyponatremia: expert panel recommendations. Am J Med. 2013;126(10 Suppl 1):S1–S42.', doi: '10.1016/j.amjmed.2013.07.006', pmid: '24074529' },
    kdigo2012: { cite: 'KDIGO Clinical Practice Guideline for Acute Kidney Injury. Kidney Int Suppl. 2012;2(1):1–138.' },
    gennari1998: { cite: 'Gennari FJ. Hypokalemia. N Engl J Med. 1998;339(7):451–458.', doi: '10.1056/NEJM199808133390707', pmid: '9700180' },
    katz1973: { cite: 'Katz MA. Hyperglycemia-induced hyponatremia — calculation of expected serum sodium depression. N Engl J Med. 1973;289(16):843–844.', doi: '10.1056/NEJM197310182891607', pmid: '4763428' },
    hillier1999: { cite: 'Hillier TA, Abbott RD, Barrett EJ. Hyponatremia: evaluating the correction factor for hyperglycemia. Am J Med. 1999;106(4):399–403.', doi: '10.1016/S0002-9343(99)00055-8', pmid: '10225241' },
    payne1973: { cite: 'Payne RB, Little AJ, Williams RB, Milner JR. Interpretation of serum calcium in patients with abnormal serum proteins. Br Med J. 1973;4(5893):643–646.', doi: '10.1136/bmj.4.5893.643', pmid: '4758544' },
    knaus1985: { cite: 'Knaus WA, Draper EA, Wagner DP, Zimmerman JE. APACHE II: a severity of disease classification system. Crit Care Med. 1985;13(10):818–829.', doi: '10.1097/00003246-198510000-00009', pmid: '3928249' },
    elyjama2001: { cite: 'Ely EW, Inouye SK, Bernard GR, et al. Delirium in mechanically ventilated patients: validity and reliability of the confusion assessment method for the intensive care unit (CAM-ICU). JAMA. 2001;286:2703–2710.', pmid: '11730446' },
    elyccm2001: { cite: 'Ely EW, et al. Evaluation of delirium in critically ill patients: validation of the Confusion Assessment Method for the Intensive Care Unit (CAM-ICU). Crit Care Med. 2001;29(7):1370–1379.', doi: '10.1097/00003246-200107000-00012' },
    rockwood2005: { cite: 'Rockwood K, Song X, MacKnight C, Bergman H, Hogan DB, McDowell I, Mitnitski A. A global clinical measure of fitness and frailty in elderly people. CMAJ. 2005;173(5):489–495.', doi: '10.1503/cmaj.050051', pmid: '16129869' },
    bagshaw2014: { cite: 'Bagshaw SM, Stelfox HT, McDermid RC, et al. Association between frailty and short- and long-term outcomes among critically ill patients: a multicentre prospective cohort study. CMAJ. 2014;186(2):E95–E102.', doi: '10.1503/cmaj.130639' },
    charlson1987: { cite: 'Charlson ME, Pompei P, Ales KL, MacKenzie CR. A new method of classifying prognostic comorbidity in longitudinal studies: development and validation. J Chronic Dis. 1987;40(5):373–383.', doi: '10.1016/0021-9681(87)90171-8', pmid: '3558716' },
    charlson1994: { cite: 'Charlson M, Szatrowski TP, Peterson J, Gold J. Validation of a combined comorbidity index. J Clin Epidemiol. 1994;47(11):1245–1251.', doi: '10.1016/0895-4356(94)90129-5', pmid: '7722560' },
    pugin1991: { cite: 'Pugin J, et al. Diagnosis of ventilator-associated pneumonia by bacteriologic analysis of bronchoscopic and nonbronchoscopic "blind" bronchoalveolar lavage fluid. Am Rev Respir Dis. 1991;143:1121–1129.', pmid: '2024824' },
    singh2000: { cite: 'Singh N, Rogers P, Atwood CW, Wagener MM, Yu VL. Short-course empiric antibiotic therapy for patients with pulmonary infiltrates in the intensive care unit. Am J Respir Crit Care Med. 2000;162:505–511.' },
    gelinas2006: { cite: 'Gélinas C, Fillion L, Puntillo KA, Viens C, Fortier M. Critical-Care Pain Observation Tool. Am J Crit Care. 2006;15(4):420–427.' },
    taylor2001: { cite: 'Taylor FB Jr, Toh CH, Hoots WK, Wada H, Levi M. Towards definition, clinical and laboratory criteria, and a scoring system for disseminated intravascular coagulation. Thromb Haemost. 2001;86(5):1327–1330.', doi: '10.1055/s-0037-1616068', pmid: '11816725' },
    iba2019: { cite: 'Iba T, et al. Scoring system for sepsis-induced coagulopathy (ISTH SSC). J Thromb Haemost. 2019;17:1989.' },
    subbe2001: { cite: 'Subbe CP, Kruger M, Rutherford P, Gemmel L. Validation of a modified Early Warning Score in medical admissions. QJM. 2001;94(10):521–526.', doi: '10.1093/qjmed/94.10.521' },
    rcp2017: { cite: 'Royal College of Physicians. National Early Warning Score (NEWS) 2. London: RCP; 2017.' },
    heyland2011: { cite: 'Heyland DK, Dhaliwal R, Jiang X, Day AG. Identifying critically ill patients who benefit the most from nutrition therapy: the development and initial validation of a novel risk assessment tool. Crit Care. 2011;15:R268.', doi: '10.1186/cc10546' },
    rahman2016: { cite: 'Rahman A, Hasan RM, Agarwala R, Martin C, Day AG, Heyland DK. Identifying critically-ill patients who will benefit most from nutritional therapy: further validation of the "modified NUTRIC" nutritional risk assessment tool. Clin Nutr. 2016;35(1):158–162.', doi: '10.1016/j.clnu.2015.01.015', pmid: '25698099' },
    boogaard2012: { cite: 'van den Boogaard M, Pickkers P, Slooter AJC, et al. Development and validation of PRE-DELIRIC (PREdiction of DELIRium in ICu patients) delirium prediction model for intensive care patients: observational multicentre study. BMJ. 2012;344:e420.', doi: '10.1136/bmj.e420', pmid: '22323509' },
    boogaard2014: { cite: 'van den Boogaard M, et al. Recalibration of the delirium prediction model for ICU patients (PRE-DELIRIC): a multinational observational study. Intensive Care Med. 2014;40(3):361–369.', doi: '10.1007/s00134-013-3202-7', pmid: '24441670' },
    singer2016: { cite: 'Singer M, Deutschman CS, Seymour CW, et al. The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA. 2016;315(8):801–810.', doi: '10.1001/jama.2016.0287', pmid: '26903338' },
    vincent1996: { cite: 'Vincent JL, Moreno R, Takala J, et al. The SOFA (Sepsis-related Organ Failure Assessment) score to describe organ dysfunction/failure. Intensive Care Med. 1996;22(7):707–710.', doi: '10.1007/BF01709751', pmid: '8844239' },
    ranzani2025: { cite: 'Ranzani OT, Singer M, Salluh JIF, et al. Development and validation of the Sequential Organ Failure Assessment (SOFA)-2 score. JAMA. 2025;334:2090–2103.', doi: '10.1001/jama.2025.20516', pmid: '41159833' },
    moreno2025: { cite: 'Moreno R, et al. Rationale and methodological approach underlying the development of the Sequential Organ Failure Assessment (SOFA)-2 score. JAMA Netw Open. 2025;8(10):e2545040.', doi: '10.1001/jamanetworkopen.2025.45040' }
  };

  const CALC_REFS = {
    localAnestheticMax: ['rosenberg2004'],
    lastLipid: ['neal2018'],
    malignantHyperthermia: ['mhaus', 'rosenberg2015'],
    pediatricEmergency: ['topjian2020'],
    mallampatiScore: ['mallampati1985', 'samsoon1987'],
    cormackLehaneScore: ['cormack1984', 'cook2000'],
    wilsonScore: ['wilson1988'],
    elGanzouriScore: ['elganzouri1996'],
    lemonScore: ['reed2005'],
    macochaScore: ['dejong2013'],
    airwayMeasurements: ['savva1994', 'khan2003', 'schmitt2002', 'kim2011'],
    bloodGasAnalysis: ['albert1967', 'figge1998', 'story2004'],
    anionGapPanel: ['figge1998', 'albert1967'],
    electrolyteCorrections: ['katz1973', 'hillier1999', 'payne1973'],
    crystalloidTable: ['semler2018', 'finfer2022'],
    fractionalExcretion: ['espinel1976', 'carvounis2002'],
    cumulativeFluidBalance: ['payen2008', 'bouchard2009'],
    hypernatremiaCorrection: ['adrogue2000a', 'sterns2019'],
    hyponatremiaCorrection: ['adrogue2000b', 'spasovski2014', 'verbalis2013'],
    kdigoStaging: ['kdigo2012'],
    potassiumReplacement: ['gennari1998'],
    apacheIIScore: ['knaus1985'],
    camICUScore: ['elyjama2001', 'elyccm2001'],
    clinicalFrailtyScale: ['rockwood2005', 'bagshaw2014'],
    charlsonIndex: ['charlson1987', 'charlson1994'],
    cpisScore: ['pugin1991', 'singh2000'],
    cpotScore: ['gelinas2006'],
    dicScore: ['taylor2001'],
    sicScore: ['iba2019'],
    mewsScore: ['subbe2001'],
    news2Score: ['rcp2017'],
    mNutricScore: ['heyland2011', 'rahman2016'],
    preDelericScore: ['boogaard2012', 'boogaard2014'],
    qsofaScore: ['singer2016'],
    sofaScore: ['vincent1996', 'singer2016'],
    sofa2Score: ['ranzani2025', 'moreno2025']
  };

  const link = (href, label) => '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent);font-weight:700;text-decoration:none;margin-right:12px">' + esc(label) + ' ↗</a>';
  const refsList = ids => '<div style="display:flex;flex-direction:column;gap:12px">' + ids.map(id => {
    const r = REFS[id];
    return '<div style="font-size:12px;color:var(--textSecondary);line-height:1.45">' + esc(r.cite) +
      ((r.doi || r.pmid) ? '<div style="margin-top:4px">' + (r.doi ? link('https://doi.org/' + r.doi, 'DOI: ' + r.doi) : '') +
        (r.pmid ? link('https://pubmed.ncbi.nlm.nih.gov/' + r.pmid + '/', 'PMID: ' + r.pmid) : '') + '</div>' : '') + '</div>';
  }).join('') + '</div>';

  AA.REFS = REFS;
  AA.CALC_REFS = CALC_REFS;
  AA.refsHTML = calcId => CALC_REFS[calcId] ? refsList(CALC_REFS[calcId]) : '';
  AA.refsCard = (calcId, tint) => CALC_REFS[calcId] ? AA.UI.card(AA.UI.sectionHeader({ title: AA.T('emg.refs.title'), subtitle: AA.T('emg.refs.subtitle'), icon: 'book-open', tint }) + refsList(CALC_REFS[calcId])) : '';

  // Bilgi panelindeki her hesaplayıcıya kaynakça bağlantılarını ekler (screens-calc.js yüklendikten sonra).
  const baseInfo = AA.infoFor;
  AA.infoFor = calcId => {
    const info = baseInfo ? baseInfo(calcId) : null;
    if (info && !info.refsHTML && CALC_REFS[calcId]) info.refsHTML = AA.refsHTML(calcId);
    return info;
  };
})();
