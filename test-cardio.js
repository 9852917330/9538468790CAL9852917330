// Run with: node test-cardio.js (no dependencies).
const assert = require('node:assert/strict');
const C = require('./cardio.js');
let checks = 0;
const eq = (actual, expected, tolerance = 1e-8) => { assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`); checks++; };
const ok = (condition) => { assert.ok(condition); checks++; };
const base = { ...C.DEFAULTS, weight: 72, height: 160 };
// Independently worked example: S=55, G=.12, VO2=20.88; net=17.38.
const example = C.solve(base);
ok(example.ok);
eq(example.rates.gross, 7.5168); eq(example.rates.net, 6.2568);
eq(example.state.minutes, 79.91305459659888);
eq(example.grossKcal, 600.6904487917145);
eq(C.solve({ ...base, basis: 'gross' }).state.minutes, 66.51766709237972);
// Familiar flat-walk invariant: 0.5 kcal per kg per km (net).
const flat = C.solve({ ...base, target: 'calories', speed: 4, grade: 0, minutes: 60 });
eq(flat.netKcal, 144); eq(flat.grossKcal, 219.6); eq(flat.distance, 4);
// Running, 10 km/h, 30 minutes, 72 kg: 5 km => 360 net kcal.
const run = C.solve({ ...base, activity: 'run', target: 'calories', speed: 10, grade: 0, minutes: 30 });
eq(run.netKcal, 360); eq(run.grossKcal, 397.8);
// Solve every variable backward from a known session (both energy bases).
for (const activity of ['walk', 'run']) for (const basis of ['net', 'gross']) {
  const session = C.solve({ ...base, activity, basis, target: 'calories', minutes: 45, speed: activity === 'walk' ? 4.2 : 9, grade: 8 }).state;
  for (const target of ['minutes', 'calories', 'speed', 'grade']) {
    const result = C.solve({ ...session, target, [target]: null });
    ok(result.ok); eq(result.state[target], session[target]);
  }
}
// Unit conversion is handled by UI; core minutes must remain linear.
eq(C.solve({ ...base, target: 'calories', minutes: 90 }).netKcal, 563.112);
// Independent MET reference: elliptical 5 MET, 72 kg, 30 min.
const ell = C.solve({ ...base, activity: 'elliptical', preset: 0, target: 'calories', minutes: 30 });
eq(ell.netKcal, 151.2); eq(ell.grossKcal, 189);
for (const [activity, a] of Object.entries(C.ACTIVITIES)) if (!a.treadmill && !a.stepmill) {
  for (let preset = 0; preset < a.presets.length; preset++) {
    const r = C.solve({ ...base, activity, preset });
    ok(r.ok); ok(r.rates.net > 0); eq(r.netKcal, 500);
  }
}
// Height is stored for convenience, never changes these metabolic equations.
eq(C.solve({ ...base, height: 190 }).state.minutes, example.state.minutes);
// Reject ambiguous/impossible/invalid inputs; never clamp them into a plan.
for (const overrides of [
  { weight: 0 }, { weight: NaN }, { weight: 300 }, { weight: null },
  { calories: -1 }, { calories: Infinity }, { speed: 0 }, { speed: -1 }, { speed: 9 },
  { grade: -1 }, { grade: 31 }, { activity: 'unknown' }, { target: 'unknown' },
  { target: 'grade', minutes: 10, calories: 500 },
  { target: 'grade', minutes: 500, calories: 1 },
  { target: 'speed', minutes: 0 }, { target: 'speed', minutes: 1, calories: 10000 },
  { activity: 'bike', preset: 99 }, { activity: 'elliptical', target: 'grade' }
]) ok(!C.solve({ ...base, ...overrides }).ok);
const zero = C.solve({ ...base, calories: 0 }); ok(zero.ok); eq(zero.state.minutes, 0);
ok(C.solve({ ...base, speed: 2 }).warnings.length > 0);
eq(C.parseNumber('3,3'), 3.3); eq(C.parseNumber('3.3'), 3.3); eq(C.parseNumber(' 72 '), 72);
for (const value of ['', 'Infinity', '1e4', '3.3.3', 'abc', '-12']) ok(C.parseNumber(value) === null);
// V80: independently worked stairmill example (Holland): 2×30×.25+3.5 = 18.5 ml/kg/min.
const stairs = { ...base, activity: 'stairs', stepRate: 30, stepHeight: 25, weight: 71, minutes: 25, target: 'calories' };
const sr = C.solve(stairs); ok(sr.ok); eq(sr.netKcal, 133.125); eq(sr.grossKcal, 164.1875); eq(sr.steps, 750); eq(sr.ascent, 187.5);
for (const basis of ['net', 'gross']) {
  const r = C.solve({ ...stairs, basis });
  for (const target of ['minutes', 'calories', 'stepRate']) {
    const inverse = C.solve({ ...r.state, target, [target]: null });
    ok(inverse.ok); eq(inverse.state[target], r.state[target]);
  }
}
for (const stepRate of [20,30,40,50,60,80,100,120]) {
 const r=C.solve({...stairs,stepRate});ok(r.ok);eq(r.netKcal,133.125*stepRate/30);
}
eq(C.solve({...stairs,stepHeight:20}).netKcal,106.5);
eq(C.solve({...stairs,stepMode:'reference',preset:0}).rates.met,9.3);
ok(C.solve({...stairs,stepMode:'reference',preset:0}).warnings.length > 0);
for (const x of [{stepRate:null},{stepHeight:null},{stepRate:0},{stepRate:201},{stepHeight:4},{stepHeight:41},{stepMode:'bad'},{stepRate:Infinity},{target:'stepRate',minutes:0},{target:'stepRate',calories:0},{target:'stepRate',basis:'gross',calories:1}]) ok(!C.solve({...stairs,...x}).ok);
ok(!C.solve({...base,activity:'toString'}).ok);
// Newly restored cycling bands: 25–30 W and >325 W.
eq(C.solve({...base,activity:'bike',preset:0}).rates.met,3.5);
eq(C.solve({...base,activity:'bike',preset:11}).rates.met,16.3);
console.log(`PASS: ${checks} cardio assertions`);
