/* Cardio calculator V79. Units: kg, km/h, percent grade, minutes, kcal.
   Sources: ACSM walking/running equations; 2024 Adult Compendium.
   Calculations retain full precision; only the displayed values are rounded. */
(function (root) {
  'use strict';
  const SOURCES = {
    acsm: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7356312/',
    conditioning: 'https://pacompendium.com/conditioning-exercise/',
    cycling: 'https://pacompendium.com/bicycling/',
    sports: 'https://pacompendium.com/sports/'
  };
  const ACTIVITIES = {
    walk: { name: 'Đi bộ / đi bộ dốc', treadmill: true, horizontal: 0.1, vertical: 1.8, source: SOURCES.acsm },
    run: { name: 'Chạy bộ / chạy dốc', treadmill: true, horizontal: 0.2, vertical: 0.9, source: SOURCES.acsm },
    bike: { name: 'Xe đạp tập', source: SOURCES.cycling, presets: [
      ['50 W · nhẹ', 4, '01214'], ['60 W · nhẹ đến vừa', 5, '01216'],
      ['70–80 W', 5.8, '01218'], ['90–100 W · vừa đến mạnh', 6, '01220'],
      ['101–125 W', 6.8, '01224'], ['126–150 W', 8, '01228'],
      ['151–199 W', 10.3, '01232'], ['200–229 W · mạnh', 10.8, '01236'],
      ['230–250 W · rất mạnh', 12.5, '01240'], ['270–305 W · rất mạnh', 13.8, '01244'],
      ['Spin / RPM · lớp tập', 9, '01270']
    ] },
    elliptical: { name: 'Máy elliptical', source: SOURCES.conditioning, presets: [
      ['Cường độ vừa', 5, '02048'], ['Cường độ mạnh', 9, '02049']
    ] },
    stairs: { name: 'Máy leo cầu thang', source: SOURCES.conditioning, presets: [
      ['Mức tập chung', 9.3, '02065']
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
  const LIMITS = { weight: [30, 250], height: [120, 220], calories: [0, 10000], minutes: [0, 1440], speed: [0.1, 30], grade: [0, 30] };
  const NAMES = { weight: 'Cân nặng', height: 'Chiều cao', calories: 'Calo', minutes: 'Thời gian', speed: 'Tốc độ', grade: 'Độ dốc' };
  const DEFAULTS = { activity: 'walk', preset: 0, target: 'minutes', basis: 'net', calories: 500, minutes: 60, speed: 3.3, grade: 12, unit: 'min' };
  function parseNumber(raw) {
    const text = String(raw ?? '').trim();
    if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) return null;
    const n = Number(text.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  function inRange(key, value) {
    return Number.isFinite(value) && value >= LIMITS[key][0] && value <= LIMITS[key][1];
  }
  function rate(s) {
    const a = ACTIVITIES[s.activity];
    const vo2 = a.treadmill
      ? (s.speed * 1000 / 60) * (a.horizontal + a.vertical * s.grade / 100) + 3.5
      : a.presets[s.preset][1] * 3.5;
    const gross = vo2 * s.weight / 200;
    const rest = 3.5 * s.weight / 200;
    return { gross, net: gross - rest, rest, met: vo2 / 3.5 };
  }
  function solve(input) {
    const s = { ...input }, a = ACTIVITIES[s.activity];
    const fail = (message, field) => ({ ok: false, message, field });
    if (!a) return fail('Chọn một bài cardio trong danh sách.', 'activity');
    if (!['net', 'gross'].includes(s.basis)) return fail('Chọn cách tính calo.', 'basis');
    if (!['minutes', 'calories', 'speed', 'grade'].includes(s.target)) return fail('Chọn ô cần tự tính.', 'target');
    if (!a.treadmill && (s.target === 'speed' || s.target === 'grade')) return fail('Bài này chỉ tính calo hoặc thời gian theo cường độ đã chọn.', 'target');
    if (!a.treadmill && !a.presets[s.preset]) return fail('Chọn cường độ của bài tập.', 'preset');
    const required = ['weight', 'calories', 'minutes', ...(a.treadmill ? ['speed', 'grade'] : [])];
    for (const key of required) {
      if (key === s.target) continue;
      if (s[key] === null || s[key] === undefined) return fail(`Nhập ${NAMES[key].toLowerCase()} để tính tiếp.`, key);
      if (!inRange(key, s[key])) {
        const unit = { weight: 'kg', calories: 'kcal', minutes: 'phút', speed: 'km/h', grade: '%' }[key];
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
    return { ok: true, state: s, rates, warnings, grossKcal: rates.gross * s.minutes, netKcal: rates.net * s.minutes, distance: a.treadmill ? s.speed * s.minutes / 60 : null };
  }
  const api = { ACTIVITIES, LIMITS, DEFAULTS, parseNumber, solve, rate };
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
    const saved = read(SESSION_KEY);
    if (saved) {
      if (ACTIVITIES[saved.activity]) state.activity = saved.activity;
      if (['net', 'gross'].includes(saved.basis)) state.basis = saved.basis;
      if (['minutes', 'calories', 'speed', 'grade'].includes(saved.target)) state.target = saved.target;
      if (['min', 'hour'].includes(saved.unit)) state.unit = saved.unit;
      if (Number.isInteger(saved.preset) && ACTIVITIES[state.activity].presets?.[saved.preset]) state.preset = saved.preset;
      for (const key of ['calories', 'minutes', 'speed', 'grade']) if (saved[key] === null || inRange(key, saved[key])) state[key] = saved[key];
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
      write(SESSION_KEY, session);
      if (storageFailed) updateSavedLabel();
    }
    function syncMode() {
      const a = ACTIVITIES[state.activity];
      if (!a.treadmill && ['speed', 'grade'].includes(state.target)) state.target = 'minutes';
      $('target').value = state.target;
      $('basis').value = state.basis;
      for (const key of ['calories', 'minutes', 'speed', 'grade']) {
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
      $('preset-wrap').hidden = !!a.treadmill;
      $('preset').replaceChildren();
      if (!a.treadmill) {
        a.presets.forEach((p, i) => $('preset').add(new Option(p[0], String(i))));
        if (!a.presets[state.preset]) state.preset = 0;
        $('preset').value = String(state.preset);
      }
      $('activity-note').textContent = a.treadmill
        ? 'Dốc dùng đơn vị %, tốc độ dùng km/h. Nhập dốc 0 nếu tập đường bằng.'
        : 'Chọn mức tập gần nhất. Level và tốc độ hiển thị khác nhau giữa các máy nên không quy đổi trực tiếp thành calo.';
      syncMode();
    }
    function clearResult(message) {
      $('result-value').textContent = '—';
      $('result-unit').textContent = '';
      $('result-equivalent').textContent = message;
      $('result-caption').textContent = 'Chưa đủ thông số hợp lệ';
      for (const key of ['rate', 'hourly', 'net-total', 'gross-total', 'distance', 'met']) $(key).textContent = '—';
      $('summary').textContent = '';
      $('warnings').textContent = '';
      $('warnings').hidden = true;
      $('result').classList.add('cc-result-empty');
    }
    function recalc() {
      syncMode();
      for (const key of ['weight', 'height', 'calories', 'minutes', 'speed', 'grade']) $(key).removeAttribute('aria-invalid');
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
      fillNumeric(state.target);
      $('error').hidden = true;
      $('error').textContent = '';
      $('result').classList.remove('cc-result-empty');
      const displayed = state.target === 'minutes' && state.unit === 'hour' ? state.minutes / 60 : state[state.target];
      const units = { minutes: state.unit === 'hour' ? 'giờ' : 'phút', calories: 'kcal', speed: 'km/h', grade: '%' };
      $('result-value').textContent = fmt(displayed, state.target === 'minutes' && state.unit === 'hour' ? 3 : 2);
      $('result-unit').textContent = units[state.target];
      $('result-caption').textContent = { minutes: 'THỜI GIAN CẦN TẬP', calories: 'CALO ĐỐT ƯỚC TÍNH', speed: 'TỐC ĐỘ CẦN TẬP', grade: 'ĐỘ DỐC CẦN TẬP' }[state.target];
      $('result-equivalent').textContent = state.target === 'minutes' ? `≈ ${timeText(state.minutes)}` : `Trong ${timeText(state.minutes)}`;
      const selectedRate = result.rates[state.basis];
      $('rate').textContent = fmt(selectedRate, 2);
      $('hourly').textContent = fmt(selectedRate * 60, 1);
      $('net-total').textContent = `${fmt(result.netKcal, 1)} kcal`;
      $('gross-total').textContent = `${fmt(result.grossKcal, 1)} kcal`;
      $('distance').textContent = result.distance === null ? 'Không áp dụng' : `${fmt(result.distance, 2)} km`;
      $('met').textContent = fmt(result.rates.met, 2);
      $('result-basis').textContent = state.basis === 'net' ? 'CALO VẬN ĐỘNG' : 'TỔNG CALO';
      const a = ACTIVITIES[state.activity];
      const detail = a.treadmill ? `${fmt(state.speed, 2)} km/h · dốc ${fmt(state.grade, 2)}%` : a.presets[state.preset][0];
      $('summary').textContent = `${a.name} · ${detail}. ${fmt(state.calories, 1)} kcal ${state.basis === 'net' ? 'vận động' : 'tổng'} trong ${timeText(state.minutes)}.`;
      $('warnings').textContent = result.warnings.join(' ');
      $('warnings').hidden = !result.warnings.length;
      $('method').textContent = a.treadmill ? `Phương trình ${state.activity === 'walk' ? 'đi bộ' : 'chạy'} ACSM` : `Compendium 2024 · mã ${a.presets[state.preset][2]} · ${fmt(a.presets[state.preset][1])} MET`;
      $('source').href = a.source;
      saveSession();
    }
    for (const [key, a] of Object.entries(ACTIVITIES)) $('activity').add(new Option(a.name, key));
    for (const key of ['weight', 'height', 'calories', 'minutes', 'speed', 'grade']) {
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
      state.activity = $('activity').value;
      state.preset = 0;
      // Keep treadmill values when switching away and back; initialize a useful
      // running speed only on an explicit switch to running from a walking pace.
      if (state.activity === 'run' && state.speed !== null && state.speed < 8) { state.speed = 8; fillNumeric('speed'); }
      if (state.activity === 'walk' && state.speed > 8) { state.speed = 3.3; fillNumeric('speed'); }
      syncActivity(); recalc();
    });
    $('preset').addEventListener('change', () => { state.preset = Number($('preset').value); recalc(); });
    $('target').addEventListener('change', () => { state.target = $('target').value; recalc(); });
    $('basis').addEventListener('change', () => { state.basis = $('basis').value; recalc(); });
    $('unit').value = state.unit;
    $('unit').addEventListener('change', () => { state.unit = $('unit').value; fillNumeric('minutes'); recalc(); });
    $('example').addEventListener('click', () => {
      state = { ...DEFAULTS, weight: 72, height: 160 };
      for (const key of ['weight', 'height', 'calories', 'minutes', 'speed', 'grade']) fillNumeric(key);
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
