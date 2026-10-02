/* Cardio calculator V80. Units: kg, km/h, percent grade, minutes, kcal.
   Sources: ACSM walking/running equations; 2024 Adult Compendium.
   Calculations retain full precision; only the displayed values are rounded. */
(function (root) {
  'use strict';
  const SOURCES = {
    acsm: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7356312/',
    conditioning: 'https://pacompendium.com/conditioning-exercise/',
    cycling: 'https://pacompendium.com/bicycling/',
    sports: 'https://pacompendium.com/sports/',
    stepmill: 'https://jhk.termedia.pl/pdf-158728-84987?filename=84987.pdf'
  };
  const ACTIVITIES = {
    walk: { name: 'Đi bộ / đi bộ dốc', treadmill: true, horizontal: 0.1, vertical: 1.8, source: SOURCES.acsm },
    run: { name: 'Chạy bộ / chạy dốc', treadmill: true, horizontal: 0.2, vertical: 0.9, source: SOURCES.acsm },
    bike: { name: 'Xe đạp tập', source: SOURCES.cycling, presets: [
      ['25–30 W · rất nhẹ đến nhẹ', 3.5, '01210'], ['50 W · nhẹ', 4, '01214'], ['60 W · nhẹ đến vừa', 5, '01216'],
      ['70–80 W', 5.8, '01218'], ['90–100 W · vừa đến mạnh', 6, '01220'],
      ['101–125 W', 6.8, '01224'], ['126–150 W', 8, '01228'],
      ['151–199 W', 10.3, '01232'], ['200–229 W · mạnh', 10.8, '01236'],
      ['230–250 W · rất mạnh', 12.5, '01240'], ['270–305 W · rất mạnh', 13.8, '01244'],
      ['Trên 325 W · rất mạnh', 16.3, '01248'], ['Spin / RPM · lớp tập', 9, '01270']
    ] },
    elliptical: { name: 'Máy elliptical', source: SOURCES.conditioning, presets: [
      ['Cường độ vừa', 5, '02048'], ['Cường độ mạnh', 9, '02049']
    ] },
    stairs: { name: 'Máy leo cầu thang · bậc xoay', stepmill: true, source: SOURCES.conditioning, presets: [
      ['Tham chiếu chung · không theo nhịp leo', 9.3, '02065']
    ] },
    rowing: { name: 'Máy chèo thuyền', source: SOURCES.conditioning, presets: [
      ['Dưới 100 W · vừa', 5, '02071'], ['100–149 W · mạnh', 7.5, '02072'],
      ['150–199 W · mạnh', 11, '02073'], ['Từ 200 W · rất mạnh', 14, '02074']
    ] },
    rope: { name: 'Nhảy dây', source: SOURCES.sports, presets: [
      ['Dưới 100 lần/phút · chậm', 8.3, '15552'], ['100–120 lần/phút · vừa', 11.8, '15551'],
      ['120–160 lần/phút · nhanh', 12.3, '15550']
    ] },
    hiit: { name: 'HIIT', source: SOURCES.conditioning, presets: [
      ['Cường độ vừa', 7, '02210'], ['Cường độ mạnh · burpees / Tabata', 11, '02214']
    ] }
  };
  const LIMITS = { weight: [30, 250], height: [120, 220], calories: [0, 10000], minutes: [0, 1440], speed: [0.1, 30], grade: [0, 30], stepRate: [1, 200], stepHeight: [5, 40] };
  const NAMES = { weight: 'Cân nặng', height: 'Chiều cao', calories: 'Calo', minutes: 'Thời gian', speed: 'Tốc độ', grade: 'Độ dốc', stepRate: 'Nhịp leo', stepHeight: 'Chiều cao bậc' };
  const DEFAULTS = { activity: 'walk', preset: 0, target: 'minutes', basis: 'net', calories: 500, minutes: 60, speed: 3.3, grade: 12, unit: 'min', stepMode: 'cadence', stepRate: null, stepHeight: null };
  function parseNumber(raw) {
    const text = String(raw ?? '').trim();
    if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) return null;
    const n = Number(text.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  function inRange(key, value) {
    return Number.isFinite(value) && value >= LIMITS[key][0] && value <= LIMITS[key][1];
  }
  const activityExists = key => Object.prototype.hasOwnProperty.call(ACTIVITIES, key);
  const isStepCadence = s => s.activity === 'stairs' && s.stepMode === 'cadence';
  function targets(s) {
    return ['minutes', 'calories', ...(ACTIVITIES[s.activity]?.treadmill ? ['speed', 'grade'] : []), ...(isStepCadence(s) ? ['stepRate'] : [])];
  }
  function rate(s) {
    const a = ACTIVITIES[s.activity];
    // Holland et al. (1990), as evaluated in von Schaumburg et al. (2022).
    // Revolving stairs: VO2 = 2 × steps/min × step height (m) + 3.5.
    // Bench stepping (up-up-down-down) is a DIFFERENT activity/equation.
    const vo2 = a.treadmill
      ? (s.speed * 1000 / 60) * (a.horizontal + a.vertical * s.grade / 100) + 3.5
      : isStepCadence(s) ? 2 * s.stepRate * s.stepHeight / 100 + 3.5
      : a.presets[s.preset][1] * 3.5;
    const gross = vo2 * s.weight / 200;
    const rest = 3.5 * s.weight / 200;
    return { gross, net: gross - rest, rest, met: vo2 / 3.5 };
  }
  function solve(input) {
    const s = { ...input }, a = ACTIVITIES[s.activity];
    const fail = (message, field) => ({ ok: false, message, field });
    if (!activityExists(s.activity)) return fail('Chọn một bài cardio trong danh sách.', 'activity');
    if (!['net', 'gross'].includes(s.basis)) return fail('Chọn cách tính calo.', 'basis');
    if (!targets(s).includes(s.target)) return fail('Chọn ô cần tự tính.', 'target');
    if (a.stepmill && !['cadence', 'reference'].includes(s.stepMode)) return fail('Chọn cách tính cường độ leo cầu thang.', 'step-mode');
    if (!a.treadmill && !isStepCadence(s) && (!Number.isInteger(s.preset) || !a.presets[s.preset])) return fail('Chọn cường độ của bài tập.', 'preset');
    const required = ['weight', 'calories', 'minutes', ...(a.treadmill ? ['speed', 'grade'] : []), ...(isStepCadence(s) ? ['stepRate', 'stepHeight'] : [])];
    for (const key of required) {
      if (key === s.target) continue;
      if (s[key] === null || s[key] === undefined) return fail(`Nhập ${NAMES[key].toLowerCase()} để tính tiếp.`, key);
      if (!inRange(key, s[key])) {
        const unit = { weight: 'kg', calories: 'kcal', minutes: 'phút', speed: 'km/h', grade: '%', stepRate: 'bậc/phút', stepHeight: 'cm' }[key];
        return fail(`${NAMES[key]} cần nằm trong khoảng ${LIMITS[key][0]}–${LIMITS[key][1]} ${unit}.`, key);
      }
    }
    if (s.target === 'speed' || s.target === 'grade') {
      if (s.minutes <= 0 || s.calories <= 0) return fail('Calo và thời gian phải lớn hơn 0 để tính tốc độ hoặc độ dốc.', s.minutes <= 0 ? 'minutes' : 'calories');
      const requiredVo2 = s.calories / s.minutes * 200 / s.weight - (s.basis === 'gross' ? 3.5 : 0);
      if (s.target === 'speed') {
        s.speed = requiredVo2 / (a.horizontal + a.vertical * s.grade / 100) * 60 / 1000;
        if (!inRange('speed', s.speed)) return fail('Không có tốc độ phù hợp trong khoảng 0,1–30 km/h. Hãy đổi calo, thời gian hoặc độ dốc.', 'speed');
      } else {
        s.grade = (requiredVo2 / (s.speed * 1000 / 60) - a.horizontal) / a.vertical * 100;
        if (Math.abs(s.grade) < 1e-9) s.grade = 0;
        if (!inRange('grade', s.grade)) return fail('Không có độ dốc phù hợp trong khoảng 0–30%. Hãy đổi calo, thời gian hoặc tốc độ.', 'grade');
      }
    }
    if (s.target === 'stepRate') {
      if (s.minutes <= 0 || s.calories <= 0) return fail('Calo và thời gian phải lớn hơn 0 để tính nhịp leo.', s.minutes <= 0 ? 'minutes' : 'calories');
      const netVo2 = s.calories / s.minutes * 200 / s.weight - (s.basis === 'gross' ? 3.5 : 0);
      s.stepRate = netVo2 / (2 * s.stepHeight / 100);
      if (!inRange('stepRate', s.stepRate)) return fail('Không có nhịp leo phù hợp trong khoảng 1–200 bậc/phút. Hãy đổi mục tiêu hoặc thời gian.', 'stepRate');
    }
    // Never silently change walking into running: gait is a user choice.
    if (a.treadmill && s.activity === 'walk' && s.speed > 8) return fail('Kết quả vượt 8 km/h cho bài đi bộ. Hãy tăng thời gian, đổi độ dốc hoặc chọn bài chạy bộ.', 'speed');
    const rates = rate(s), selectedRate = rates[s.basis];
    if (!Number.isFinite(selectedRate) || selectedRate <= 0) return fail('Thông số hiện tại không tạo ra mức đốt calo hợp lệ.', s.target);
    if (s.target === 'minutes') s.minutes = s.calories / selectedRate;
    if (s.target === 'calories') s.calories = s.minutes * selectedRate;
    if (!inRange('minutes', s.minutes)) return fail('Thời gian tính được vượt 24 giờ vận động. Hãy điều chỉnh mục tiêu hoặc cường độ.', 'minutes');
    if (!inRange('calories', s.calories)) return fail('Calo tính được vượt 10.000 kcal. Hãy kiểm tra lại thời gian hoặc cường độ.', 'calories');
    const warnings = [];
    if (s.activity === 'walk' && (s.speed < 3 || s.speed > 6)) warnings.push('Tốc độ nằm ngoài khoảng 3–6 km/h thường dùng cho phương trình đi bộ ACSM; kết quả có độ tin cậy thấp hơn.');
    if (s.activity === 'run' && s.speed < 8) warnings.push('Phương trình chạy ACSM phù hợp hơn từ khoảng 8 km/h. Chạy chậm hơn có sai số lớn; nếu đang đi bộ, hãy chọn bài đi bộ.');
    if (a.treadmill && s.grade > 20) warnings.push('Độ dốc trên 20%: phép ngoại suy có sai số lớn, cần kiểm tra giới hạn máy.');
    if (a.stepmill && !isStepCadence(s)) warnings.push('Mức 9,3 MET là tham chiếu chung, không phản ánh nhịp leo hay level máy. Chọn cách tính theo nhịp leo khi biết thông số.');
    return { ok: true, state: s, rates, warnings, steps: isStepCadence(s) ? s.stepRate * s.minutes : null, ascent: isStepCadence(s) ? s.stepRate * s.stepHeight / 100 * s.minutes : null, grossKcal: rates.gross * s.minutes, netKcal: rates.net * s.minutes, distance: a.treadmill ? s.speed * s.minutes / 60 : null };
  }
  const api = { ACTIVITIES, LIMITS, DEFAULTS, parseNumber, solve, rate, targets };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root.document) return;
  root.CardioCalculator = api;

  function init() {
    const page = document.getElementById('page-cardio');
    if (!page) return;
    const $ = (id) => document.getElementById('cardio-' + id);
    const BODY_KEY = 'inAndOutCardioBodyV1', SESSION_KEY = 'inAndOutCardioSessionV1';
    let storageFailed = false, state = { ...DEFAULTS, weight: null, height: null };
    const read = (key) => { try { const obj = JSON.parse(localStorage.getItem(key) || 'null'); return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null; } catch (_) { return null; } };
    const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { storageFailed = true; return false; } };
    const shared = read('inAndOutSettingsV2');
    const body = read(BODY_KEY) || { weight: shared?.defaultWeight, height: shared?.height };
    for (const key of ['weight', 'height']) if (inRange(key, body[key])) state[key] = body[key];
    const CONFIG_KEYS = ['preset', 'speed', 'grade', 'stepMode', 'stepRate', 'stepHeight'];
    const NUMERIC = ['weight', 'height', 'calories', 'minutes', 'speed', 'grade', 'stepRate', 'stepHeight'];
    const OUTPUTS = ['calories', 'minutes', 'speed', 'grade', 'stepRate'];
    const activityConfigs = {};
    function defaultConfig(activity) {
      return { preset: 0, speed: activity === 'run' ? 8 : 3.3, grade: activity === 'run' ? 0 : 12, stepMode: 'cadence', stepRate: null, stepHeight: null };
    }
    function cleanConfig(activity, raw) {
      const next = defaultConfig(activity), a = ACTIVITIES[activity];
      if (!raw || typeof raw !== 'object') return next;
      for (const key of ['speed', 'grade', 'stepRate', 'stepHeight']) if (raw[key] === null || inRange(key, raw[key])) next[key] = raw[key];
      if (Number.isInteger(raw.preset) && a.presets?.[raw.preset]) next.preset = raw.preset;
      if (['cadence', 'reference'].includes(raw.stepMode)) next.stepMode = raw.stepMode;
      return next;
    }
    const saved = read(SESSION_KEY);
    if (saved) {
      if (activityExists(saved.activity)) state.activity = saved.activity;
      if (['net', 'gross'].includes(saved.basis)) state.basis = saved.basis;
      if (['minutes', 'calories', 'speed', 'grade', 'stepRate'].includes(saved.target)) state.target = saved.target;
      if (['min', 'hour'].includes(saved.unit)) state.unit = saved.unit;
      // V79 bike indices changed when adding the two missing power bands.
      const old = { ...saved };
      if (saved.schema !== 2 && state.activity === 'bike' && Number.isInteger(old.preset)) old.preset = old.preset === 10 ? 12 : old.preset + 1;
      Object.assign(state, cleanConfig(state.activity, old));
      for (const key of ['calories', 'minutes']) if (saved[key] === null || inRange(key, saved[key])) state[key] = saved[key];
      if (saved.schema === 2 && saved.activityConfigs && typeof saved.activityConfigs === 'object') {
        for (const activity of Object.keys(ACTIVITIES)) if (saved.activityConfigs[activity]) activityConfigs[activity] = cleanConfig(activity, saved.activityConfigs[activity]);
      }
    }
    const fmt = (n, digits = 1) => Number.isFinite(n) ? n.toLocaleString('vi-VN', { maximumFractionDigits: digits }) : '—';
    const inputValue = (n, digits = 4) => Number.isFinite(n) ? String(Number(n.toFixed(digits))).replace('.', ',') : '';
    function timeText(minutes) {
      const total = Math.round(minutes * 60), h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
      return [h ? `${h} giờ` : '', m ? `${m} phút` : '', s ? `${s} giây` : ''].filter(Boolean).join(' ') || '0 phút';
    }
    function fillNumeric(key) {
      const value = key === 'minutes' && state.unit === 'hour' && state.minutes !== null ? state.minutes / 60 : state[key];
      $(key).value = inputValue(value, key === 'calories' || (key === 'minutes' && state.unit === 'min') ? 2 : 4);
    }
    function saveBody() {
      write(BODY_KEY, { weight: inRange('weight', state.weight) ? state.weight : null, height: inRange('height', state.height) ? state.height : null });
      updateSavedLabel();
    }
    function updateSavedLabel() {
      $('saved').textContent = storageFailed ? 'Trình duyệt đang chặn lưu. Thông số chỉ dùng trong lần mở này.' : inRange('weight', state.weight) ? 'Đã nhớ thông số trên trình duyệt này' : 'Nhập một lần, tự nhớ cho lần sau';
      $('saved').classList.toggle('cc-save-error', storageFailed);
    }
    function saveSession() {
      const { weight, height, ...session } = state;
      activityConfigs[state.activity] = Object.fromEntries(CONFIG_KEYS.map(key => [key, state[key]]));
      write(SESSION_KEY, { ...session, schema: 2, activityConfigs });
      if (storageFailed) updateSavedLabel();
    }
    function syncMode() {
      const a = ACTIVITIES[state.activity];
      if (!targets(state).includes(state.target)) state.target = 'minutes';
      for (const option of $('target').options) option.disabled = !targets(state).includes(option.value);
      $('target').value = state.target;
      $('basis').value = state.basis;
      for (const key of OUTPUTS) {
        const computed = key === state.target;
        $('field-' + key).classList.toggle('cc-computed', computed);
        $('tag-' + key).hidden = !computed;
        $(key).setAttribute('aria-describedby', 'cardio-auto-help' + (key === 'grade' ? ' cardio-grade-help' : ''));
      }
      $('auto-help').textContent = `Đang tự tính ${NAMES[state.target].toLowerCase()}. Các thông số còn lại được giữ nguyên. Gõ vào ô tự tính để chuyển sang nhập tay.`;
      $('basis-help').textContent = state.basis === 'net' ? 'Chỉ tính phần đốt thêm do tập, đã trừ mức nghỉ 1 MET. Cùng cách tính với cardio ở trang Lịch sử.' : 'Gồm cả phần cơ thể vẫn đốt lúc nghỉ trong cùng thời gian. Không cộng toàn bộ số này vào TDEE nền.';
    }
    function syncActivity() {
      const a = ACTIVITIES[state.activity];
      $('activity').value = state.activity;
      for (const key of ['speed', 'grade']) {
        $('field-' + key).hidden = !a.treadmill;
        $(key).disabled = !a.treadmill;
        $('target').querySelector(`option[value="${key}"]`).disabled = !a.treadmill;
      }
      $('preset-wrap').hidden = !!a.treadmill || !!a.stepmill;
      $('step-wrap').hidden = !a.stepmill;
      syncSteps();
      $('preset').replaceChildren();
      if (!a.treadmill) {
        a.presets.forEach((p, i) => $('preset').add(new Option(p[0], String(i))));
        if (!a.presets[state.preset]) state.preset = 0;
        $('preset').value = String(state.preset);
      }
      $('activity-note').textContent = a.stepmill
        ? 'Dùng cho máy có bậc xoay liên tục. Nhịp bậc/phút và chiều cao bậc quyết định mức tính; level của từng máy không quy đổi chung.'
        : a.treadmill
        ? 'Dốc dùng đơn vị %, tốc độ dùng km/h. Nhập dốc 0 nếu tập đường bằng.'
        : 'Chọn mức tập gần nhất. Level và tốc độ hiển thị khác nhau giữa các máy nên không quy đổi trực tiếp thành calo.';
      $('example').textContent = a.stepmill ? 'Ví dụ leo thang' : 'Thử ví dụ';
      syncMode();
    }
    function syncSteps() {
      $('step-mode').value = state.stepMode;
      const active = isStepCadence(state);
      $('step-inputs').hidden = !active;
      $('step-reference').hidden = active;
      for (const key of ['stepRate', 'stepHeight']) $(key).disabled = !active;
      $('step-quick').value = ['20','30','40','50','60','80','100','120'].includes(String(state.stepRate)) ? String(state.stepRate) : '';
      $('step-quick').disabled = state.target === 'stepRate';
    }
    function methodInfo() {
      const a = ACTIVITIES[state.activity];
      if (isStepCadence(state)) return { label: 'Ước tính bậc xoay · Holland', source: SOURCES.stepmill };
      if (a.treadmill) return { label: `Phương trình ${state.activity === 'walk' ? 'đi bộ' : 'chạy'} ACSM`, source: a.source };
      const p = a.presets[state.preset];
      return { label: p ? `Compendium 2024 · mã ${p[2]} · ${fmt(p[1])} MET` : 'Chọn cường độ để tính', source: a.source };
    }
    function clearResult(message) {
      $('result-value').textContent = '—';
      $('result-unit').textContent = '';
      $('result-equivalent').textContent = message;
      $('result-caption').textContent = 'Chưa đủ thông số hợp lệ';
      for (const key of ['rate', 'hourly', 'net-total', 'gross-total', 'distance', 'met', 'steps']) $(key).textContent = '—';
      $('summary').textContent = '';
      $('warnings').textContent = '';
      $('warnings').hidden = true;
      $('result').classList.add('cc-result-empty');
    }
    function recalc() {
      syncMode(); syncSteps();
      const method = methodInfo();
      $('method').textContent = method.label; $('source').href = method.source;
      $('result-basis').textContent = state.basis === 'net' ? 'CALO VẬN ĐỘNG' : 'TỔNG CALO';
      $('steps-row').hidden = !isStepCadence(state);
      $('distance-label').textContent = isStepCadence(state) ? 'Độ cao leo tương đương' : 'Quãng đường';
      for (const key of NUMERIC) $(key).removeAttribute('aria-invalid');
      const invalidHeight = state.height !== null && !inRange('height', state.height);
      const result = invalidHeight ? { ok: false, message: 'Chiều cao cần nằm trong khoảng 120–220 cm; có thể để trống.', field: 'height' } : solve(state);
      if (!result.ok) {
        $(state.target).value = '';
        state[state.target] = null;
        $('error').textContent = result.message;
        $('error').hidden = false;
        if (result.field && $(result.field)) $(result.field).setAttribute('aria-invalid', 'true');
        clearResult(result.message);
        saveSession();
        return;
      }
      state = result.state;
      fillNumeric(state.target); syncSteps();
      $('error').hidden = true;
      $('error').textContent = '';
      $('result').classList.remove('cc-result-empty');
      const displayed = state.target === 'minutes' && state.unit === 'hour' ? state.minutes / 60 : state[state.target];
      const units = { minutes: state.unit === 'hour' ? 'giờ' : 'phút', calories: 'kcal', speed: 'km/h', grade: '%', stepRate: 'bậc/phút' };
      $('result-value').textContent = fmt(displayed, state.target === 'minutes' && state.unit === 'hour' ? 3 : 2);
      $('result-unit').textContent = units[state.target];
      $('result-caption').textContent = { minutes: 'THỜI GIAN CẦN TẬP', calories: 'CALO ĐỐT ƯỚC TÍNH', speed: 'TỐC ĐỘ CẦN TẬP', grade: 'ĐỘ DỐC CẦN TẬP', stepRate: 'NHỊP LEO CẦN TẬP' }[state.target];
      $('result-equivalent').textContent = state.target === 'minutes' ? `≈ ${timeText(state.minutes)}` : `Trong ${timeText(state.minutes)}`;
      const selectedRate = result.rates[state.basis];
      $('rate').textContent = fmt(selectedRate, 2);
      $('hourly').textContent = fmt(selectedRate * 60, 1);
      $('net-total').textContent = `${fmt(result.netKcal, 1)} kcal`;
      $('gross-total').textContent = `${fmt(result.grossKcal, 1)} kcal`;
      $('distance').textContent = isStepCadence(state) ? `${fmt(result.ascent, 1)} m` : result.distance === null ? 'Không áp dụng' : `${fmt(result.distance, 2)} km`;
      $('steps').textContent = `${fmt(result.steps, 0)} bậc`;
      $('met').textContent = fmt(result.rates.met, 2);
      $('result-basis').textContent = state.basis === 'net' ? 'CALO VẬN ĐỘNG' : 'TỔNG CALO';
      const a = ACTIVITIES[state.activity];
      const detail = isStepCadence(state) ? `${fmt(state.stepRate, 2)} bậc/phút · bậc cao ${fmt(state.stepHeight, 2)} cm` : a.treadmill ? `${fmt(state.speed, 2)} km/h · dốc ${fmt(state.grade, 2)}%` : a.presets[state.preset][0];
      $('summary').textContent = `${a.name} · ${detail}. ${fmt(state.calories, 1)} kcal ${state.basis === 'net' ? 'vận động' : 'tổng'} trong ${timeText(state.minutes)}.`;
      $('warnings').textContent = result.warnings.join(' ');
      $('warnings').hidden = !result.warnings.length;
      saveSession();
    }
    for (const [key, a] of Object.entries(ACTIVITIES)) $('activity').add(new Option(a.name, key));
    for (const key of NUMERIC) {
      fillNumeric(key);
      $(key).addEventListener('input', () => {
        const n = parseNumber($(key).value);
        state[key] = key === 'height' && n === null && $(key).value.trim() !== '' ? NaN : key === 'minutes' && state.unit === 'hour' && n !== null ? n * 60 : n;
        if (key === state.target) state.target = key === 'minutes' ? 'calories' : 'minutes';
        if (key === 'weight' || key === 'height') saveBody();
        recalc();
      });
    }
    $('activity').addEventListener('change', () => {
      activityConfigs[state.activity] = Object.fromEntries(CONFIG_KEYS.map(key => [key, state[key]]));
      state.activity = $('activity').value;
      Object.assign(state, cleanConfig(state.activity, activityConfigs[state.activity]));
      for (const key of ['speed', 'grade', 'stepRate', 'stepHeight']) fillNumeric(key);
      syncActivity(); recalc();
    });
    $('step-mode').addEventListener('change', () => { state.stepMode = $('step-mode').value; syncActivity(); recalc(); });
    $('step-quick').addEventListener('change', () => {
      if ($('step-quick').value) { state.stepRate = Number($('step-quick').value); fillNumeric('stepRate'); recalc(); }
      else $('stepRate').focus();
    });
    $('preset').addEventListener('change', () => { state.preset = Number($('preset').value); recalc(); });
    $('target').addEventListener('change', () => { state.target = $('target').value; recalc(); });
    $('basis').addEventListener('change', () => { state.basis = $('basis').value; recalc(); });
    $('unit').value = state.unit;
    $('unit').addEventListener('change', () => { state.unit = $('unit').value; fillNumeric('minutes'); recalc(); });
    $('example').addEventListener('click', () => {
      const weight = inRange('weight', state.weight) ? state.weight : 72;
      const height = inRange('height', state.height) ? state.height : 160;
      const stairs = state.activity === 'stairs';
      state = { ...DEFAULTS, weight, height, ...(stairs ? { activity: 'stairs', target: 'calories', minutes: 25, stepRate: 30, stepHeight: 25 } : {}) };
      for (const key of NUMERIC) fillNumeric(key);
      $('unit').value = state.unit;
      syncActivity(); saveBody(); recalc();
    });
    document.querySelector('.nav-btn[data-page="cardio"]')?.addEventListener('click', () => {
      if (!read(BODY_KEY)) {
        const profile = read('inAndOutSettingsV2');
        if (inRange('weight', profile?.defaultWeight)) { state.weight = profile.defaultWeight; fillNumeric('weight'); }
        if (inRange('height', profile?.height)) { state.height = profile.height; fillNumeric('height'); }
        updateSavedLabel(); recalc();
      }
    });
    updateSavedLabel(); syncActivity(); recalc();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
