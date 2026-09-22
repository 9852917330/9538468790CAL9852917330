/* =============================================================================
   BỘ TEST NHẬN DIỆN & TÍNH CALO
   Chạy:  node test-food.js            (cần: npm i jsdom)
   Mục đích: mỗi lần sửa parser, chạy file này trước khi deploy.
   Ba nhóm kiểm tra:
     RECOGNITION — món phải nhận ra đúng tên
     AMOUNT      — số calo phải nằm trong khoảng hợp lý so với giá trị tham chiếu
     TRAP        — bẫy nhập nhằng: bò/bơ, cơm/cốm, "mì" trong "bánh mì bò kho"…
   ========================================================================== */
const fs = require("fs"), path = require("path");
const { JSDOM } = require("jsdom");
const ROOT = __dirname;

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), { url: "https://example.com/", pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document;
global.localStorage = window.localStorage; global.navigator = window.navigator; global.location = window.location;
window.requestAnimationFrame = () => {}; window.setInterval = () => 0; window.fetch = async () => { throw new Error("offline"); };
global.requestAnimationFrame = window.requestAnimationFrame; global.setInterval = window.setInterval; global.fetch = window.fetch;

/* Thông số cơ thể cố định cho nhóm test CƠ THỂ (không ảnh hưởng test món ăn). */
window.localStorage.setItem("inAndOutSettingsV2", JSON.stringify({ sheetId: "x".repeat(30), sheetGid: "", sex: "male", age: 35, height: 160, defaultWeight: 70, startWaist: 92, startBodyFat: 30, targetBodyFat: 12, activityFactor: 1.2 }));
let code = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
code = code.replace(/\n\}\)\(\);\s*$/, "\n  window.__T = { estimateFood, findFood, parseCardioV75, cardioBurnV75, v75WalkPlan, v76WalkPlan, compute, goalStateV76, rfmEstimate, writeSettings, PROFILE };\n})();\n");
window.eval(code);
const T = window.__T;

/* [câu nhập, tên món mong đợi (chuỗi con), kcal tham chiếu, sai số cho phép] */
const RECOGNITION = [
  ["150g ức gà", "Ức gà", 171, .12], ["200g cơm trắng", "Cơm", 260, .12],
  ["1 bát phở bò", "Phở bò", 500, .25], ["2 quả trứng", "Trứng", 140, .15],
  ["100g thịt bò", "Thịt bò", 212, .15], ["100g cá hồi", "Cá hồi", 196, .15],
  ["300g rau muống luộc", "Rau muống", 75, .25], ["3 quả trứng luộc", "Trứng", 210, .15],
  ["250g thịt lợn ba chỉ", "ba chỉ", 1295, .15], ["1 ly cà phê sữa", "Cà phê sữa", 180, .25],
  ["1 cốc trà sữa trân châu", "Trà sữa", 450, .3], ["150g khoai lang luộc", "Khoai lang", 135, .2],
  ["200g bắp cải luộc", "Bắp cải", 58, .25], ["1 lon coca", "Coca", 139, .15],
  ["150 g uc ga", "Ức gà", 171, .12], ["200g com", "Cơm", 260, .12],
  ["2 qua trung ga", "Trứng", 140, .15], ["1 bowl of rice", "Cơm", 260, .15],
  ["100g giá đỗ", "Giá đỗ", 30, .2], ["tai heo", "Tai heo", 240, .2],
  ["1 cốc nước lọc", "Nước lọc", 0, 0], ["10g muối", "Muối", 0, 0],
  ["1 phần sushi", "Sushi", 350, .2], ["1 bát mì cay", "Mì cay", 650, .25],
  ["chicken breast 150g", "Ức gà", 171, .12], ["100g salmon", "Cá hồi", 196, .15],
  ["1 quả chuối", "Chuối", 110, .2], ["1 bát bún chả", "Bún chả", 653, .25],
  ["100g đậu phụ", "Đậu phụ", 80, .2], ["1 suất cơm tấm sườn", "Cơm tấm", 700, .25],
  ["1 miếng pizza", "Pizza", 290, .25], ["100g khoai tây chiên", "Khoai tây chiên", 313, .2],
  ["50g hạnh nhân", "Hạnh nhân", 290, .15], ["1 hộp sữa chua", "Sữa chua", 100, .3],
];

/* Đơn vị đong: kích thước do dụng cụ quyết định, không phải do bảng dinh dưỡng. */
const AMOUNT = [
  ["1 thìa đường", 50, .25], ["1 thìa dầu ăn", 120, .2], ["1 thìa mật ong", 64, .2],
  ["1 cup milk", 150, .2], ["1 cốc sữa tươi", 150, .2], ["1 lát bánh mì", 80, .3],
  ["2 lát bánh mì sandwich", 160, .25], ["2 cái nem rán", 240, .3],
  ["1 đĩa rau xào", 160, .3], ["1 quả trứng", 70, .2], ["100g dầu ăn", 884, .1],
  ["1 lon nước ngọt", 140, .15], ["100g yến mạch", 389, .1],
];

/* Bẫy: kết quả SAI mà bản cũ hay mắc. expectNot = tuyệt đối không được ra tên này. */
const TRAP = [
  ["100g bò", "Thịt bò", "Bơ"], ["100g bơ", "Bơ", "Thịt bò"],
  ["200g com", "Cơm", "Cốm"], ["100g cốm", "Cốm", "Cơm"],
  ["1 quả dừa", "Dừa", "Dứa"], ["1 quả dứa", "Dứa", "Dừa"],
  ["thịt bò khô", "khô", null], ["bánh mì bò kho", "bò kho", null],
  ["1 lát bánh mì", "Bánh mì", "bò kho"], ["10g muối", "Muối", "Prosciutto"],
  ["100g nho", "Nho", "Nhót"], ["100g thịt lợn", "Thịt lợn", null],
  /* V71: bí danh mô tả của Philly cheesesteak có chữ "bánh mì bò phô mai" —
     không được để nó cướp mất truy vấn "bánh mì". */
  ["1 lát bánh mì", "Bánh mì", "cheesesteak"], ["bánh mì", "Bánh mì", "cheesesteak"],
  ["bánh mì bò kho", "bò kho", null], ["trà chanh", "Trà chanh", "Lipton"],
  ["panna cotta", "Panna cotta", "khúc bạch"], ["chân gà nướng", "Chân gà", null],
];

/* Món của 5 nền ẩm thực: gõ tên gốc hay tên tiếng Việt đều phải ra đúng món. */
const CUISINE = [
  ["1 bát bún ốc","Bún ốc",420,.25], ["1 đĩa cơm chiên dương châu","Cơm chiên",620,.25],
  ["1 bát súp cua","Súp cua",220,.3], ["100g chân gà nướng","Chân gà",215,.2],
  ["1 đĩa gỏi gà","Gỏi gà",280,.3], ["1 cốc trà chanh","Trà chanh",90,.3],
  ["330ml bia hơi","Bia hơi",116,.2],
  ["pad thai","Pad Thai",750,.3], ["mì xào thái","Pad Thai",750,.3],
  ["tom yum goong","Tom yum goong",340,.3], ["cà ri xanh","Cà ri xanh",520,.3],
  ["1 phần xôi xoài","Xôi xoài",480,.25], ["mango sticky rice","Xôi xoài",480,.25],
  ["1 cốc trà sữa thái","Trà sữa Thái",250,.3],
  ["1 bát gyudon","Gyudon",730,.25], ["cơm thịt bò nhật","Gyudon",730,.25],
  ["2 cái onigiri","Onigiri",360,.2], ["1 bát súp miso","Súp miso",45,.35],
  ["miso ramen","Ramen",600,.3], ["japanese curry","Cơm cà ri Nhật",800,.3],
  ["1 phần gyoza","Gyoza",380,.3], ["100g edamame","edamame",122,.2],
  ["1 đĩa risotto","Risotto",560,.3], ["1 cái calzone","Calzone",750,.3],
  ["fettuccine","Mì Ý",750,.3], ["1 phần panna cotta","Panna cotta",320,.3],
  ["mì ý hải sản","Mì Ý hải sản",620,.3],
  ["1 cái philly cheesesteak","Philly",780,.3], ["1 phần nachos","Nachos",720,.3],
  ["1 bát chili con carne","Chili",420,.3], ["100g coleslaw","Coleslaw",150,.3],
  ["1 phần trứng ốp lết","Trứng ốp lết",260,.25], ["scrambled eggs","Trứng bác",220,.25],
  ["chocolate chip cookie","Bánh quy",145,.3],
];

const MULTI = [
  ["150g ức gà, 200g cơm trắng, 1 quả trứng", 3, 0],
  ["150g ức gà + 200g cơm", 2, 0],
  ["cơm 200g, rau muống 300g, cá hồi 100g, món lạ xyz", 4, 1],
  ["1,5 kg thịt bò", 1, 0],
];

/* ---------- CARDIO ----------
   Số kỳ vọng được tính ĐỘC LẬP ngay trong file test từ công thức gốc, không lấy
   từ app — để test bắt được cả lỗi công thức chứ không chỉ lỗi đọc chữ.
   ACSM đi bộ: VO₂ ròng = 0,1·S + 1,8·S·G ; chạy: 0,2·S + 0,9·S·G  (S m/phút)
   MET: VO₂ ròng = (MET − 1) × 3,5 ; kcal/phút = VO₂ròng × kg × 5 / 1000 */
const KG = 70;
const walkK = (kmh, g) => { const S = kmh * 1000 / 60; return (0.1 * S + 1.8 * S * g / 100) * KG * 5 / 1000; };
const runK = (kmh, g) => { const S = kmh * 1000 / 60; return (0.2 * S + 0.9 * S * g / 100) * KG * 5 / 1000; };
const metK = (met) => (met - 1) * 3.5 * KG * 5 / 1000;
/* [câu nhập, số phút mong đợi, kcal mong đợi, chữ phải có trong nhãn] */
const CARDIO = [
  ["30mins", 30, 30 * walkK(4, 0), "Đi bộ 4 km/h"],
  ["30 phút", 30, 30 * walkK(4, 0), "Đi bộ 4 km/h"],
  ["1h đi bộ dốc 12 3.3km/h", 60, 60 * walkK(3.3, 12), "dốc 12%"],
  ["30mins elliptical level 5", 30, 30 * metK(4 + 4 * 5 / 19), "Elliptical level 5"],
  ["45 phút đạp xe 10km/h", 45, 45 * metK(4.0), "Đạp xe 10 km/h"],
  ["1h đi bộ dốc 12, 3.3km/h", 60, 60 * walkK(3.3, 12), "dốc 12%"],
  ["30 min incline 12% 3.3 km/h", 30, 30 * walkK(3.3, 12), "dốc 12%"],
  ["dốc 12 độ 3.3km/h 60 phút", 60, 60 * walkK(3.3, 12), "dốc 12%"],
  ["30 + 45", 75, 75 * walkK(4, 0), "Đi bộ"],
  ["30 phút đi bộ + 20 phút chạy bộ 9km/h", 50, 30 * walkK(4, 0) + 20 * runK(9, 0), "Chạy 9 km/h"],
  ["chạy 5km trong 30 phút", 30, 30 * runK(10, 0), "Chạy 10 km/h"],
  ["45p máy chạy bộ", 45, 45 * walkK(4, 0), "Đi bộ"],
  ["30 phút máy chạy bộ 8km/h", 30, 30 * runK(8, 0), "Chạy 8 km/h"],
  ["20 phút nhảy dây", 20, 20 * metK(11.0), "Nhảy dây"],
  ["1 tiếng cầu lông", 60, 60 * metK(5.5), "Cầu lông"],
  ["40 phút xe đạp tập 120W", 40, 40 * metK(6.8), "Xe đạp tập"],
  ["30p rowing 160w", 30, 30 * metK(11.0), "Chèo"],
  ["30 phút bơi sải nhanh", 30, 30 * metK(9.8), "Bơi"],
  ["1:30", 90, 90 * walkK(4, 0), "Đi bộ"],
  ["300 kcal", 0, 300, ""],
  ["45 phút elliptical 350 kcal", 45, 350, "Elliptical"],
];

let pass = 0, fail = 0;
const bad = (msg) => { console.log("  ❌ " + msg); fail++; };
const good = () => pass++;

console.log("\n=== RECOGNITION ===");
for (const [input, expect, ref, tol] of RECOGNITION) {
  const r = T.estimateFood(input), it = r.items[0] || {};
  if (!it.resolved) { bad(`${input} → chưa nhận diện`); continue; }
  if (!String(it.label).toLowerCase().includes(String(expect).toLowerCase())) { bad(`${input} → "${it.label}", mong đợi "${expect}"`); continue; }
  const lo = ref * (1 - tol), hi = ref * (1 + tol) + 1;
  if (r.total < lo || r.total > hi) { bad(`${input} → ${r.total} kcal, ngoài khoảng ${Math.round(lo)}–${Math.round(hi)}`); continue; }
  good();
}

console.log("=== AMOUNT ===");
for (const [input, ref, tol] of AMOUNT) {
  const r = T.estimateFood(input);
  if (r.unresolvedCount) { bad(`${input} → chưa nhận diện`); continue; }
  const lo = ref * (1 - tol), hi = ref * (1 + tol) + 1;
  if (r.total < lo || r.total > hi) { bad(`${input} → ${r.total} kcal, mong đợi ${Math.round(lo)}–${Math.round(hi)}`); continue; }
  good();
}

console.log("=== 5 NỀN ẨM THỰC ===");
for (const [input, expect, ref, tol] of CUISINE) {
  const r = T.estimateFood(input), it = r.items[0] || {};
  if (!it.resolved) { bad(`${input} → chưa nhận diện`); continue; }
  if (!String(it.label).toLowerCase().includes(String(expect).toLowerCase())) { bad(`${input} → "${it.label}", mong đợi "${expect}"`); continue; }
  const lo = ref * (1 - tol), hi = ref * (1 + tol) + 1;
  if (r.total < lo || r.total > hi) { bad(`${input} → ${r.total} kcal, ngoài khoảng ${Math.round(lo)}–${Math.round(hi)}`); continue; }
  good();
}

console.log("=== CARDIO ===");
for (const [input, minutes, kcal, label] of CARDIO) {
  const parsed = T.parseCardioV75(input), burn = T.cardioBurnV75(parsed, KG);
  if (parsed.minutes !== Math.round(minutes)) { bad(`${input} → ${parsed.minutes} phút, mong đợi ${Math.round(minutes)}`); continue; }
  if (Math.abs(burn.kcal - Math.round(kcal)) > 1) { bad(`${input} → ${burn.kcal} kcal, công thức ra ${Math.round(kcal)}`); continue; }
  if (label && !burn.label.includes(label)) { bad(`${input} → nhãn "${burn.label}", mong đợi chứa "${label}"`); continue; }
  good();
}
/* Thẻ Tổng quan phải dùng ĐÚNG tốc độ đốt ròng mà lịch sử dùng. */
{
  const plan = T.v75WalkPlan(10000, KG, { speedKmh: 4, gradePct: 0 });
  const day = T.cardioBurnV75(T.parseCardioV75("60 phút"), KG);
  if (Math.abs(plan.kcalPerMinute * 60 - day.kcal) > 1) bad(`Tổng quan đốt ${Math.round(plan.kcalPerMinute * 60)} kcal/giờ nhưng lịch sử ghi ${day.kcal}`); else good();
}

console.log("=== TRAP ===");
for (const [input, expect, expectNot] of TRAP) {
  const r = T.estimateFood(input), it = r.items[0] || {};
  if (!it.resolved) { bad(`${input} → chưa nhận diện`); continue; }
  const label = String(it.label).toLowerCase();
  if (expect && !label.includes(expect.toLowerCase())) { bad(`${input} → "${it.label}", mong đợi chứa "${expect}"`); continue; }
  if (expectNot && label.includes(expectNot.toLowerCase())) { bad(`${input} → "${it.label}" — đây là món KHÁC`); continue; }
  good();
}

console.log("=== MULTI + NĂNG LƯỢNG 4-4-9 ===");
for (const [input, items, unresolved] of MULTI) {
  const r = T.estimateFood(input);
  if (r.items.length !== items) { bad(`${input} → tách được ${r.items.length} món, mong đợi ${items}`); continue; }
  if (r.unresolvedCount !== unresolved) { bad(`${input} → ${r.unresolvedCount} món lạ, mong đợi ${unresolved}`); continue; }
  if (r.total === null) { bad(`${input} → total null, ngày sẽ bị loại khỏi lũy kế`); continue; }
  good();
}

/* Calo và macro phải là cùng một phép nhân: chênh lệch 4-4-9 phải nhỏ.
   Bỏ qua đồ uống có cồn: năng lượng ở đó đến từ ethanol (7 kcal/g) chứ không
   phải đạm/carb/fat, nên lệch là ĐÚNG chứ không phải lỗi. */
const ALCOHOL_RE = /\b(bia|beer|rượu|ruou|wine|vang|cider|vodka|whisky|sake|soju|cocktail)\b/i;
const ALL = [...RECOGNITION.map((x) => x[0]), ...AMOUNT.map((x) => x[0]), ...CUISINE.map((x) => x[0])];
let drift = 0;
for (const input of ALL) {
  const r = T.estimateFood(input);
  if (!r.total || r.unresolvedCount) continue;
  if (ALCOHOL_RE.test(input)) continue;
  const macroKcal = r.proteinTotal * 4 + r.carbsTotal * 4 + r.fatTotal * 9;
  const gap = Math.abs(macroKcal - r.total) / r.total;
  if (gap > 0.2) { console.log(`  ⚠️  ${input}: ${r.total} kcal nhưng macro quy ra ${Math.round(macroKcal)} kcal (lệch ${Math.round(gap * 100)}%)`); drift++; }
}
console.log(`  Số dòng lệch năng lượng > 20%: ${drift}`);

/* ---------- V76 · MÓN HAY GHI ---------- */
console.log("=== V76 · MÓN HAY GHI ===");
{
  const a = T.estimateFood("500g hoa quả và rau"), b = T.estimateFood("500g rau và hoa quả");
  if (a.total !== b.total) bad(`"hoa quả và rau" ${a.total} ≠ "rau và hoa quả" ${b.total} — đảo thứ tự không được đổi số`); else good();
  if (Math.abs(a.total - 220) > 5 || a.items.length !== 1) bad(`500g hoa quả và rau → ${a.total} kcal / ${a.items.length} món, mong đợi 1 món ≈220 kcal (500 g hỗn hợp)`); else good();
  for (const [input, n] of [["cơm và rau", 2], ["2 trứng và bánh mì", 2], ["300g thịt bò và rau", 2], ["300g rau và 200g hoa quả", 2]]) {
    const r = T.estimateFood(input);
    if (r.items.length !== n) bad(`${input} → ${r.items.length} món, mong đợi ${n}`); else good();
  }
  const f = T.estimateFood("100g cá nục");
  if (Math.abs(f.total - 111) > 2 || Math.abs(f.proteinTotal - 20.2) > 0.3) bad(`100g cá nục → ${f.total} kcal / ${f.proteinTotal} g đạm, Bảng TPTP VN: 111 kcal / 20,2 g`); else good();
}

/* ---------- V76 · CƠ THỂ & MỤC TIÊU ----------
   Kỳ vọng tính ĐỘC LẬP từ nguyên lý, không lấy từ app. */
console.log("=== V76 · CƠ THỂ & MỤC TIÊU ===");
{
  const near = (x, y, tol) => Math.abs(x - y) <= tol;
  const W0 = 70, BF0 = 30, t = 0.12, lean0 = W0 * (1 - BF0 / 100), target0 = lean0 / (1 - t);
  const day = (d, food, extra = {}) => ({ date: d, food, strength: "", cardio: "", weight: "", waist: "", ...extra });
  const pad = (n) => String(n).padStart(2, "0");
  const dateOf = (i) => { const x = new Date(2026, 8, 22 + i); return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };

  /* 1) Chưa có dòng nào: mục tiêu và mỡ còn lại lấy đúng từ Cài đặt. */
  const g0 = T.goalStateV76(null);
  if (!near(g0.targetWeight, target0, 1e-6) || !near(g0.fatToLoseKg, W0 - target0, 1e-6)) bad(`Mốc đầu: mục tiêu ${g0.targetWeight} / mỡ còn ${g0.fatToLoseKg}, mong đợi ${target0} / ${W0 - target0}`); else good();

  /* 2) Một ngày KHÔNG đo: calo cần thâm hụt giảm ĐÚNG bằng thâm hụt của ngày. */
  const d1 = T.compute([day(dateOf(0), "1000 kcal")]).at(-1);
  const drop = (W0 - target0) * 7700 - d1.remainingKcal;
  if (!near(drop, d1.deficit, 0.5)) bad(`Thâm hụt ngày ${d1.deficit} kcal nhưng calo còn lại chỉ giảm ${Math.round(drop)}`); else good();

  /* 3) Mọi ô trên Tổng quan phải cùng một phép tính: mỡ còn lại = cân − mục tiêu; kcal = kg × 7.700. */
  if (!near(d1.fatToLoseKg, d1.projectedWeight - d1.targetWeightNow, 1e-9) || !near(d1.remainingKcal, d1.fatToLoseKg * 7700, 1e-6)) bad("Mỡ còn lại ≠ cân hiện tại − cân mục tiêu"); else good();

  /* 4) Neo theo cân: 60 ngày ghi ăn dư 500 kcal/ngày nhưng cân vẫn đứng 70 kg.
        Sổ cái cũ sẽ trôi +30.000 kcal (≈3,9 kg mỡ ảo); bản mới phải bám cân. */
  const tdee = Math.round((370 + 21.6 * lean0) * 1.2);
  const rows60 = Array.from({ length: 60 }, (_, i) => day(dateOf(i), `${tdee + 500} kcal`, { weight: "70", waist: "92" }));
  const last60 = T.compute(rows60).at(-1);
  if (Math.abs(last60.projectedWeight - 70) > 0.3) bad(`Cân đứng 70 kg suốt 60 ngày mà mô hình ra ${last60.projectedWeight.toFixed(2)} kg`); else good();
  if (Math.abs(last60.fatToLoseKg - (W0 - target0)) > 0.35) bad(`Mỡ còn lại trôi ${(last60.fatToLoseKg - (W0 - target0)).toFixed(2)} kg dù cân không đổi`); else good();

  /* 5) Cân nhà nhảy +2 kg một hôm (nước): số liệu không được giật trọn 15.400 kcal. */
  const spike = T.compute([day(dateOf(0), `${tdee} kcal`, { weight: "70" }), day(dateOf(1), `${tdee} kcal`, { weight: "72" })]);
  const jump = spike[1].remainingKcal - spike[0].remainingKcal;
  if (jump > 7700) bad(`Một lần cân +2 kg làm calo còn lại nhảy ${Math.round(jump)} kcal`); else good();

  /* 6) Eo: cân giữ nguyên nhưng eo giảm 92 → 88 cm (tập tạ, mỡ giảm) → % mỡ phải giảm, mỡ còn lại giảm. */
  const recomp = T.compute(Array.from({ length: 21 }, (_, i) => day(dateOf(i), `${tdee} kcal`, { weight: "70", waist: String(92 - Math.min(4, Math.floor(i / 5))) }))).at(-1);
  if (!(recomp.bodyFat < 29.5) || !(recomp.fatToLoseKg < W0 - target0 - 0.3)) bad(`Eo giảm 4 cm mà % mỡ ${recomp.bodyFat.toFixed(2)} / mỡ còn ${recomp.fatToLoseKg.toFixed(2)} kg không giảm`); else good();

  /* 7) Bỏ trống % mỡ: máy dùng RFM = 64 − 20 × cao/eo. */
  T.writeSettings({ startBodyFat: null });
  const rfmExpect = 64 - 20 * (160 / 92);
  if (!near(T.PROFILE.startBodyFat, Math.round(rfmExpect * 10) / 10, 0.051) || T.PROFILE.bodyFatSource !== "waist") bad(`Ô % mỡ trống → ${T.PROFILE.startBodyFat}% (${T.PROFILE.bodyFatSource}), RFM ra ${rfmExpect.toFixed(2)}%`); else good();
  T.writeSettings({ startBodyFat: 30 });
  if (T.PROFILE.startBodyFat !== 30 || T.PROFILE.bodyFatSource !== "input") bad("Nhập lại 30% nhưng máy không dùng số đã nhập"); else good();

  /* 8) Giờ đi bộ: cân giảm dần nên phải cộng dồn theo ln(W/T), không chia thẳng. */
  const perKg = (0.1 * (4 * 1000 / 60)) * 5 / 1000, T0 = target0;
  const plan = T.v76WalkPlan(W0, T0, (W0 - T0) * 7700, { speedKmh: 4, gradePct: 0 });
  const expectMin = 7700 / perKg * Math.log(W0 / T0);
  if (!near(plan.minutes, expectMin, 1)) bad(`Giờ đi bộ ${Math.round(plan.minutes)} phút, công thức ra ${Math.round(expectMin)}`); else good();
  if (!(plan.minutes > (W0 - T0) * 7700 / (perKg * W0))) bad("Giờ đi bộ không được ít hơn cách chia thẳng ở cân hiện tại"); else good();
}

console.log(`\n===== KẾT QUẢ: ${pass} đạt · ${fail} lỗi · lệch năng lượng ${drift} =====\n`);
process.exit(fail || drift ? 1 : 0);
