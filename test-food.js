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

let code = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
code = code.replace(/\n\}\)\(\);\s*$/, "\n  window.__T = { estimateFood, findFood };\n})();\n");
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

console.log(`\n===== KẾT QUẢ: ${pass} đạt · ${fail} lỗi · lệch năng lượng ${drift} =====\n`);
process.exit(fail || drift ? 1 : 0);
