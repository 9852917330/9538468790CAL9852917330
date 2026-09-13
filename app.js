(() => {
  "use strict";
  const APP_BUILD = "2026-09-13-v68-nutrition-core";
  try {
    if (localStorage.getItem("inAndOutAppBuild") !== APP_BUILD) {
      localStorage.setItem("inAndOutAppBuild", APP_BUILD);
      /* V53: xóa cache tra cứu online cũ vì alias có cả số gram từng có thể chiếm nhầm tên món nội bộ (vd. “300g hoa quả”). */
      localStorage.removeItem("inAndOutOnlineFoodCacheV4");
      /* Service Worker V62 is registered by the tiny bootstrap before app.js loads. */
    }
  } catch (_) {}
  const SHEET_ID = "1oiraviDfjkyPk3cC9On76bvCyUloNI9UVFalCeI0ZQg",
    SHEET_NAME = "Sheet1",
    SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
  const CACHE_KEY = "inAndOutSheetCacheV2";
  const OVERVIEW_SNAPSHOT_KEY = "inAndOutOverviewSnapshotV1";
  const PROFILE = {
    sex: "male",
    age: 35,
    height: 160,
    defaultWeight: 70,
    startBodyFat: 28,
    targetBodyFat: 12,
    activityFactor: 1.2,
    strengthMet: 5,
    refreshSeconds: 60,
  };
  const VI_TIME_ZONE = "Asia/Ho_Chi_Minh";
  const SAMPLE_ROWS = [];
  let rawRows = [],
    computedDays = [],
    refreshTimer = null,
    currentPage = "overview";
  const historyDetailsState = new Map();
  const FOOD_DB = [
    {
      id: "skim_milk_powder",
      name: "Sữa bột tách béo",
      en: "Nonfat dry milk powder",
      aliases: [
        "sữa bột tách béo",
        "bột sữa tách béo",
        "bột skim milk",
        "skim milk powder",
        "skimmed milk powder",
        "powdered skim milk",
        "nonfat dry milk",
        "non-fat dry milk",
        "dry skim milk",
      ],
      per100g: 362,
      protein100g: 36.2,
      carbs100g: 52.0,
      fat100g: 0.77,
      perUnit: 109,
      gramsPerUnit: 30,
      defaultKcal: 109,
      defaultProtein: 10.9,
      defaultCarbs: 15.6,
      defaultFat: 0.2,
      rangePct: 0.08,
      rangeNote: "tùy thương hiệu và công thức sản phẩm",
      source: "USDA FoodData Central · sữa bột không béo, dạng khô",
    },
    {
      id: "silken_tofu",
      name: "Đậu hũ non",
      en: "Soft / silken tofu",
      aliases: [
        "đậu hũ non",
        "đậu phụ non",
        "tàu hũ non",
        "tofu non",
        "soft tofu",
        "silken tofu",
        "tofu mềm",
        "đậu phụ mềm",
      ],
      per100g: 61,
      protein100g: 6.55,
      carbs100g: 1.8,
      fat100g: 3.69,
      perUnit: 73,
      gramsPerUnit: 120,
      defaultKcal: 73,
      defaultProtein: 7.9,
      defaultCarbs: 2.2,
      defaultFat: 4.4,
      rangePct: 0.15,
      rangeNote: "tùy thương hiệu và hàm lượng nước",
      source: "USDA FoodData Central · tofu mềm (nigari/calcium sulfate)",
    },
    {
      id: "soy_isolate",
      name: "Soy protein isolate",
      en: "Soy protein isolate",
      aliases: [
        "soy protein isolate",
        "spi",
        "protein đậu nành",
        "đạm đậu nành cô lập",
      ],
      per100g: 370,
      defaultKcal: 111,
      source: "Nhãn sản phẩm / CSDL nội bộ",
    },
    {
      id: "whey",
      name: "Whey protein",
      en: "Whey protein",
      aliases: ["whey", "whey protein", "protein whey"],
      per100g: 400,
      perUnit: 120,
      defaultKcal: 120,
      source: "Nhãn sản phẩm / CSDL nội bộ",
    },
    {
      id: "egg_white",
      name: "Lòng trắng trứng",
      en: "Egg white",
      aliases: ["lòng trắng trứng", "lòng trắng", "egg white", "egg whites"],
      per100g: 52,
      perUnit: 17,
      gramsPerUnit: 33,
      defaultKcal: 17,
      source: "CSDL nội bộ",
      protein100g: 10.9,
      carbs100g: 0.73,
      fat100g: 0.17,
    },
    {
      id: "whole_egg",
      name: "Trứng nguyên quả",
      en: "Whole egg",
      aliases: [
        "trứng gà",
        "trứng vịt",
        "trứng nguyên quả",
        "whole egg",
        "egg",
        "eggs",
      ],
      per100g: 143,
      perUnit: 72,
      gramsPerUnit: 50,
      defaultKcal: 72,
      source: "CSDL nội bộ",
      protein100g: 12.6,
      carbs100g: 0.72,
      fat100g: 9.5,
    },
    {
      id: "skim_milk",
      name: "Sữa tách béo",
      en: "Skim milk",
      aliases: ["sữa tách béo", "sữa không béo", "skim milk", "nonfat milk"],
      per100ml: 35,
      perCup: 85,
      defaultKcal: 85,
      source: "CSDL nội bộ",
      protein100ml: 3.4,
      carbs100ml: 5.0,
      fat100ml: 0.1,
    },
    {
      id: "fresh_milk",
      name: "Sữa tươi",
      en: "Fresh milk",
      aliases: [
        "sữa tươi",
        "sữa nguyên kem",
        "whole milk",
        "fresh milk",
        "milk",
      ],
      per100ml: 61,
      perCup: 150,
      defaultKcal: 150,
      source: "CSDL nội bộ",
      protein100ml: 3.2,
      carbs100ml: 4.8,
      fat100ml: 3.3,
    },
    {
      id: "yogurt_plain",
      name: "Sữa chua không đường",
      en: "Plain yogurt",
      aliases: ["sữa chua không đường", "plain yogurt", "unsweetened yogurt"],
      per100g: 63,
      perUnit: 63,
      gramsPerUnit: 100,
      defaultKcal: 63,
      source: "CSDL nội bộ",
    },
    {
      id: "yogurt_sweet",
      name: "Sữa chua có đường",
      en: "Sweetened yogurt",
      aliases: ["sữa chua có đường", "sữa chua", "sweetened yogurt", "yogurt"],
      per100g: 100,
      perUnit: 100,
      gramsPerUnit: 100,
      defaultKcal: 100,
      source: "CSDL nội bộ",
    },
    {
      id: "cheese",
      name: "Phô mai lát",
      en: "Cheese slice",
      aliases: ["phô mai lát", "phô mai", "cheese slice", "cheese"],
      per100g: 300,
      perSlice: 50,
      perUnit: 50,
      defaultKcal: 50,
      source: "CSDL nội bộ",
    },
    {
      id: "rice_cooked",
      name: "Cơm trắng chín",
      en: "Cooked white rice",
      aliases: [
        "cơm trắng chín",
        "cơm trắng",
        "cơm chín",
        "cơm",
        "cooked white rice",
        "cooked rice",
        "white rice",
        "rice",
      ],
      per100g: 130,
      perBowl: 200,
      defaultKcal: 200,
      source: "CSDL món Việt",
    },
    {
      id: "brown_rice",
      name: "Cơm gạo lứt chín",
      en: "Cooked brown rice",
      aliases: [
        "cơm gạo lứt",
        "gạo lứt chín",
        "brown rice",
        "cooked brown rice",
      ],
      per100g: 123,
      perBowl: 190,
      defaultKcal: 190,
      source: "CSDL món Việt",
    },
    {
      id: "sticky_rice",
      name: "Xôi / cơm nếp chín",
      en: "Cooked sticky rice",
      aliases: [
        "cơm nếp",
        "xôi trắng",
        "xôi",
        "sticky rice",
        "glutinous rice cooked",
      ],
      per100g: 170,
      perBowl: 340,
      defaultKcal: 340,
      source: "CSDL món Việt",
    },
    {
      id: "raw_rice",
      name: "Gạo sống",
      en: "Uncooked rice",
      aliases: [
        "gạo sống",
        "gạo trắng sống",
        "uncooked rice",
        "raw rice",
        "dry rice",
      ],
      per100g: 360,
      defaultKcal: 360,
      source: "CSDL nội bộ",
    },
    {
      id: "raw_sticky_rice",
      name: "Gạo nếp sống",
      en: "Uncooked glutinous rice",
      aliases: [
        "gạo nếp",
        "nếp sống",
        "gạo nếp sống",
        "uncooked glutinous rice",
      ],
      per100g: 360,
      protein100g: 7.2,
      carbs100g: 80,
      fat100g: 0.7,
      defaultKcal: 360,
      source: "CSDL nội bộ",
    },
    {
      id: "sweet_potato",
      name: "Khoai lang",
      en: "Sweet potato",
      aliases: ["khoai lang", "sweet potato", "yam"],
      per100g: 90,
      perUnit: 180,
      gramsPerUnit: 200,
      defaultKcal: 180,
      source: "CSDL nội bộ",
    },
    {
      id: "potato",
      name: "Khoai tây",
      en: "Potato",
      aliases: ["khoai tây", "potato", "potatoes"],
      per100g: 87,
      perUnit: 150,
      gramsPerUnit: 170,
      defaultKcal: 150,
      source: "CSDL nội bộ",
    },
    {
      id: "corn",
      name: "Ngô / bắp luộc",
      en: "Boiled corn",
      aliases: [
        "ngô luộc",
        "bắp luộc",
        "ngô",
        "bắp",
        "boiled corn",
        "corn on the cob",
        "corn",
      ],
      per100g: 96,
      perUnit: 150,
      gramsPerUnit: 155,
      defaultKcal: 150,
      source: "CSDL món Việt",
    },
    {
      id: "oats",
      name: "Yến mạch",
      en: "Oats",
      aliases: ["yến mạch", "oatmeal", "rolled oats", "oats"],
      per100g: 389,
      defaultKcal: 195,
      source: "CSDL nội bộ",
      protein100g: 16.89,
      carbs100g: 66.27,
      fat100g: 6.9,
    },
    {
      id: "banh_bao_pork",
      name: "Bánh bao nhân thịt",
      en: "Steamed pork bun",
      aliases: [
        "bánh bao nhân thịt",
        "bánh bao thịt",
        "steamed pork bun",
        "pork bao",
        "pork bun",
        "baozi pork",
      ],
      per100g: 240,
      perUnit: 270,
      gramsPerUnit: 112,
      defaultKcal: 270,
      source: "CSDL món Việt",
    },
    {
      id: "banh_bao_veg",
      name: "Bánh bao chay",
      en: "Vegetarian steamed bun",
      aliases: [
        "bánh bao chay",
        "vegetarian steamed bun",
        "vegetable bao",
        "veggie bao",
      ],
      per100g: 190,
      perUnit: 180,
      gramsPerUnit: 95,
      defaultKcal: 180,
      source: "CSDL món Việt",
    },
    {
      id: "banh_bao",
      name: "Bánh bao",
      en: "Steamed bun",
      aliases: ["bánh bao", "steamed bun", "bao bun", "baozi"],
      per100g: 230,
      perUnit: 250,
      gramsPerUnit: 108,
      defaultKcal: 250,
      source: "CSDL món Việt",
    },
    {
      id: "baguette",
      name: "Bánh mì Việt Nam",
      en: "Vietnamese baguette",
      aliases: [
        "bánh mì không",
        "bánh mì việt nam",
        "ổ bánh mì",
        "vietnamese baguette",
        "baguette",
      ],
      per100g: 270,
      perUnit: 230,
      gramsPerUnit: 85,
      defaultKcal: 230,
      source: "CSDL món Việt",
    },
    {
      id: "bread_slice",
      name: "Bánh mì lát",
      en: "Bread slice",
      aliases: [
        "bánh mì lát",
        "bánh mì sandwich",
        "sandwich bread",
        "bread slice",
        "toast",
        "bread",
      ],
      per100g: 265,
      perSlice: 80,
      perUnit: 80,
      gramsPerUnit: 30,
      defaultKcal: 80,
      source: "CSDL nội bộ",
    },
    {
      id: "banh_mi_thit",
      name: "Bánh mì thịt",
      en: "Vietnamese pork sandwich",
      aliases: [
        "bánh mì thịt",
        "bánh mì pate",
        "bánh mì kẹp thịt",
        "vietnamese pork sandwich",
        "banh mi sandwich",
        "banh mi",
      ],
      perUnit: 480,
      defaultKcal: 480,
      source: "CSDL món Việt",
    },
    {
      id: "banh_chung",
      name: "Bánh chưng",
      en: "Vietnamese square sticky rice cake",
      aliases: [
        "bánh chưng",
        "vietnamese square sticky rice cake",
        "banh chung",
      ],
      per100g: 181,
      perUnit: 1450,
      defaultKcal: 360,
      source: "CSDL món Việt",
    },
    {
      id: "banh_tet",
      name: "Bánh tét",
      en: "Vietnamese cylindrical sticky rice cake",
      aliases: ["bánh tét", "banh tet", "cylindrical sticky rice cake"],
      per100g: 190,
      perSlice: 190,
      defaultKcal: 190,
      source: "CSDL món Việt",
    },
    {
      id: "banh_cuon",
      name: "Bánh cuốn",
      en: "Steamed rice rolls",
      aliases: [
        "bánh cuốn",
        "steamed rice rolls",
        "rice rolls vietnamese",
        "banh cuon",
      ],
      per100g: 140,
      perPortion: 450,
      defaultKcal: 450,
      source: "CSDL món Việt",
    },
    {
      id: "banh_xeo",
      name: "Bánh xèo",
      en: "Vietnamese sizzling pancake",
      aliases: [
        "bánh xèo",
        "vietnamese pancake",
        "sizzling pancake",
        "banh xeo",
      ],
      perUnit: 350,
      defaultKcal: 350,
      source: "CSDL món Việt",
    },
    {
      id: "banh_gio",
      name: "Bánh giò",
      en: "Pyramidal rice dumpling",
      aliases: ["bánh giò", "banh gio", "pyramidal rice dumpling"],
      perUnit: 440,
      defaultKcal: 440,
      source: "CSDL món Việt",
    },
    {
      id: "banh_day",
      name: "Bánh dày",
      en: "Round glutinous rice cake",
      aliases: [
        "bánh dày",
        "bánh giầy",
        "banh day",
        "round glutinous rice cake",
      ],
      perUnit: 180,
      defaultKcal: 180,
      source: "CSDL món Việt",
    },
    {
      id: "pho_bo",
      name: "Phở bò",
      en: "Beef pho",
      aliases: [
        "phở bò",
        "phở tái",
        "phở chín",
        "beef pho",
        "pho bo",
        "pho with beef",
      ],
      perBowl: 500,
      defaultKcal: 500,
      source: "CSDL món Việt",
    },
    {
      id: "pho_ga",
      name: "Phở gà",
      en: "Chicken pho",
      aliases: ["phở gà", "chicken pho", "pho ga", "pho with chicken"],
      perBowl: 450,
      defaultKcal: 450,
      source: "CSDL món Việt",
    },
    {
      id: "pho_plain",
      name: "Phở",
      en: "Pho noodle soup",
      aliases: ["phở", "pho noodle soup", "pho"],
      perBowl: 470,
      defaultKcal: 470,
      source: "CSDL món Việt",
    },
    {
      id: "bun_bo_hue",
      name: "Bún bò Huế",
      en: "Hue spicy beef noodle soup",
      aliases: [
        "bún bò huế",
        "bun bo hue",
        "hue beef noodle soup",
        "spicy beef noodle soup",
      ],
      perBowl: 600,
      defaultKcal: 600,
      source: "CSDL món Việt",
    },
    {
      id: "bun_cha",
      name: "Bún chả",
      en: "Grilled pork with rice noodles",
      aliases: ["bún chả", "bun cha", "grilled pork with rice noodles"],
      perPortion: 600,
      defaultKcal: 600,
      source: "CSDL món Việt",
    },
    {
      id: "bun_rieu",
      name: "Bún riêu",
      en: "Crab tomato noodle soup",
      aliases: ["bún riêu", "bun rieu", "crab tomato noodle soup"],
      perBowl: 450,
      defaultKcal: 450,
      source: "CSDL món Việt",
    },
    {
      id: "bun_ca",
      name: "Bún cá",
      en: "Fish noodle soup",
      aliases: ["bún cá", "bun ca", "fish noodle soup"],
      perBowl: 450,
      defaultKcal: 450,
      source: "CSDL món Việt",
    },
    {
      id: "bun_moc",
      name: "Bún mọc",
      en: "Pork meatball noodle soup",
      aliases: ["bún mọc", "bun moc", "pork meatball noodle soup"],
      perBowl: 430,
      defaultKcal: 430,
      source: "CSDL món Việt",
    },
    {
      id: "bun_thit_nuong",
      name: "Bún thịt nướng",
      en: "Grilled pork vermicelli bowl",
      aliases: [
        "bún thịt nướng",
        "bun thit nuong",
        "grilled pork vermicelli bowl",
      ],
      perBowl: 550,
      defaultKcal: 550,
      source: "CSDL món Việt",
    },
    {
      id: "mien_ga",
      name: "Miến gà",
      en: "Chicken glass noodle soup",
      aliases: ["miến gà", "mien ga", "chicken glass noodle soup"],
      perBowl: 400,
      defaultKcal: 400,
      source: "CSDL món Việt",
    },
    {
      id: "mien_luon",
      name: "Miến lươn",
      en: "Eel glass noodle soup",
      aliases: ["miến lươn", "mien luon", "eel glass noodle soup"],
      perBowl: 480,
      defaultKcal: 480,
      source: "CSDL món Việt",
    },
    {
      id: "hu_tieu",
      name: "Hủ tiếu",
      en: "Hu tieu noodle soup",
      aliases: ["hủ tiếu", "hu tieu", "southern vietnamese noodle soup"],
      perBowl: 480,
      defaultKcal: 480,
      source: "CSDL món Việt",
    },
    {
      id: "cao_lau",
      name: "Cao lầu",
      en: "Cao lau noodles",
      aliases: ["cao lầu", "cao lau", "cao lau noodles"],
      perBowl: 550,
      defaultKcal: 550,
      source: "CSDL món Việt",
    },
    {
      id: "quang_noodle",
      name: "Mì Quảng",
      en: "Quang noodles",
      aliases: ["mì quảng", "mi quang", "quang noodles"],
      perBowl: 550,
      defaultKcal: 550,
      source: "CSDL món Việt",
    },
    {
      id: "instant_noodles",
      name: "Mì ăn liền",
      en: "Instant noodles",
      aliases: [
        "mì tôm",
        "mì ăn liền",
        "instant noodles",
        "ramen packet",
        "noodle packet",
      ],
      perPack: 380,
      perUnit: 380,
      defaultKcal: 380,
      source: "Nhãn sản phẩm / CSDL nội bộ",
    },
    {
      id: "noodles_generic",
      name: "Mì / bún chín",
      en: "Cooked noodles",
      aliases: [
        "mì chín",
        "bún chín",
        "cooked noodles",
        "rice noodles",
        "noodles",
      ],
      per100g: 110,
      perBowl: 250,
      defaultKcal: 250,
      source: "CSDL nội bộ",
    },
    {
      id: "chao",
      name: "Cháo trắng",
      en: "Rice porridge",
      aliases: ["cháo trắng", "cháo", "rice porridge", "congee"],
      per100g: 50,
      perBowl: 150,
      defaultKcal: 150,
      source: "CSDL món Việt",
    },
    {
      id: "chao_suon",
      name: "Cháo sườn",
      en: "Pork rib congee",
      aliases: ["cháo sườn", "pork rib congee", "chao suon"],
      perBowl: 350,
      defaultKcal: 350,
      source: "CSDL món Việt",
    },
    {
      id: "chicken_breast",
      name: "Ức gà chín",
      en: "Cooked chicken breast",
      aliases: [
        "ức gà chín",
        "ức gà",
        "chicken breast cooked",
        "cooked chicken breast",
        "chicken breast",
      ],
      per100g: 165,
      defaultKcal: 250,
      source: "CSDL nội bộ",
    },
    {
      id: "chicken_thigh",
      name: "Đùi gà",
      en: "Chicken thigh",
      aliases: ["đùi gà", "chicken thigh", "chicken leg"],
      per100g: 210,
      perUnit: 230,
      gramsPerUnit: 110,
      defaultKcal: 230,
      source: "CSDL nội bộ",
    },
    {
      id: "boiled_chicken",
      name: "Thịt gà luộc",
      en: "Boiled chicken",
      aliases: ["gà luộc", "thịt gà luộc", "boiled chicken"],
      per100g: 190,
      defaultKcal: 285,
      source: "CSDL món Việt",
    },
    {
      id: "roast_chicken",
      name: "Gà nướng",
      en: "Roast chicken",
      aliases: ["gà nướng", "roast chicken", "grilled chicken"],
      per100g: 220,
      defaultKcal: 330,
      source: "CSDL món Việt",
    },
    {
      id: "lean_pork",
      name: "Thịt thăn heo",
      en: "Lean pork",
      aliases: ["thịt lợn nạc", "thịt heo nạc", "lean pork", "pork loin"],
      per100g: 230,
      protein100g: 27,
      carbs100g: 0,
      fat100g: 13.6,
      defaultKcal: 300,
      source: "CSDL nội bộ",
    },
    {
      id: "pork_tenderloin",
      name: "Thịt thăn heo",
      en: "Pork tenderloin",
      aliases: [
        "thịt thăn rang",
        "thịt thăn lợn",
        "thịt thăn",
        "pork tenderloin",
      ],
      per100g: 210,
      protein100g: 27,
      carbs100g: 0,
      fat100g: 11.3,
      gramsPerPiece: 35,
      defaultKcal: 250,
      source: "CSDL món Việt",
    },
    {
      id: "pork_belly",
      name: "Thịt ba chỉ",
      en: "Pork belly",
      aliases: ["thịt ba chỉ", "ba chỉ", "pork belly"],
      per100g: 430,
      protein100g: 14,
      carbs100g: 0,
      fat100g: 41.6,
      defaultKcal: 430,
      source: "CSDL nội bộ",
    },
    {
      id: "pork_ribs",
      name: "Sườn lợn",
      en: "Pork ribs",
      aliases: ["sườn lợn", "sườn heo", "pork ribs", "spare ribs"],
      per100g: 300,
      defaultKcal: 360,
      source: "CSDL nội bộ",
    },
    {
      id: "beef_lean",
      name: "Thịt bò nạc",
      en: "Lean beef",
      aliases: ["thịt bò nạc", "bò nạc", "lean beef", "beef steak", "beef"],
      per100g: 250,
      protein100g: 26,
      carbs100g: 0,
      fat100g: 16.2,
      defaultKcal: 300,
      source: "CSDL nội bộ",
    },
    {
      id: "beef_stirfry",
      name: "Bò xào",
      en: "Stir-fried beef",
      aliases: ["bò xào", "thịt bò xào", "stir fried beef", "beef stir fry"],
      per100g: 270,
      protein100g: 26,
      carbs100g: 3,
      fat100g: 17.1,
      perPortion: 400,
      defaultKcal: 400,
      source: "CSDL món Việt",
    },
    {
      id: "pork_meatball",
      name: "Thịt viên",
      en: "Meatball",
      aliases: ["thịt viên", "xíu mại", "meatball", "pork meatball"],
      per100g: 250,
      perUnit: 60,
      gramsPerUnit: 24,
      defaultKcal: 60,
      source: "CSDL món Việt",
    },
    {
      id: "cha_lua",
      name: "Chả lụa / giò lụa",
      en: "Vietnamese pork sausage",
      aliases: [
        "chả lụa",
        "giò lụa",
        "giò",
        "vietnamese pork sausage",
        "pork roll vietnamese",
      ],
      per100g: 230,
      perSlice: 45,
      defaultKcal: 115,
      source: "CSDL món Việt",
    },
    {
      id: "cha_com",
      name: "Chả cốm",
      en: "Green rice pork patty",
      aliases: ["chả cốm", "green rice pork patty", "cha com"],
      per100g: 280,
      perUnit: 170,
      defaultKcal: 170,
      source: "CSDL món Việt",
    },
    {
      id: "salmon",
      name: "Cá hồi",
      en: "Salmon",
      aliases: ["cá hồi", "salmon"],
      per100g: 208,
      defaultKcal: 300,
      source: "CSDL nội bộ",
    },
    {
      id: "tuna",
      name: "Cá ngừ",
      en: "Tuna",
      aliases: ["cá ngừ", "tuna"],
      per100g: 132,
      defaultKcal: 200,
      source: "CSDL nội bộ",
    },
    {
      id: "mackerel",
      name: "Cá thu",
      en: "Mackerel",
      aliases: ["cá thu", "mackerel"],
      per100g: 205,
      defaultKcal: 300,
      source: "CSDL nội bộ",
    },
    {
      id: "tilapia",
      name: "Cá rô phi",
      en: "Tilapia",
      aliases: ["cá rô phi", "tilapia"],
      per100g: 128,
      defaultKcal: 190,
      source: "CSDL nội bộ",
    },
    {
      id: "white_fish",
      name: "Cá nạc / cá trắng",
      en: "Lean white fish",
      aliases: [
        "cá nạc",
        "cá trắng",
        "white fish",
        "lean fish",
        "fish fillet",
        "fish",
      ],
      per100g: 150,
      defaultKcal: 225,
      source: "CSDL nội bộ",
    },
    {
      id: "shrimp",
      name: "Tôm",
      en: "Shrimp",
      aliases: ["tôm", "shrimp", "prawn", "prawns"],
      per100g: 100,
      defaultKcal: 150,
      source: "CSDL nội bộ",
    },
    {
      id: "squid",
      name: "Mực",
      en: "Squid",
      aliases: ["mực", "squid", "calamari"],
      per100g: 92,
      defaultKcal: 140,
      source: "CSDL nội bộ",
    },
    {
      id: "crab",
      name: "Cua",
      en: "Crab",
      aliases: ["cua", "crab"],
      per100g: 97,
      defaultKcal: 145,
      source: "CSDL nội bộ",
    },
    {
      id: "tofu",
      name: "Đậu phụ",
      en: "Tofu",
      aliases: ["đậu phụ", "đậu hũ", "tofu", "bean curd"],
      per100g: 90,
      perUnit: 180,
      gramsPerUnit: 200,
      defaultKcal: 180,
      source: "CSDL món Việt",
      protein100g: 9.0,
      carbs100g: 2.0,
      fat100g: 5.0,
    },
    {
      id: "fried_tofu",
      name: "Đậu phụ rán",
      en: "Fried tofu",
      aliases: ["đậu phụ rán", "đậu hũ chiên", "fried tofu"],
      per100g: 270,
      protein100g: 17.2,
      carbs100g: 10.5,
      fat100g: 20.2,
      perUnit: 135,
      gramsPerUnit: 50,
      defaultKcal: 270,
      source: "CSDL món Việt",
    },
    {
      id: "mung_beans",
      name: "Đậu xanh chín",
      en: "Cooked mung beans",
      aliases: ["đậu xanh chín", "cooked mung beans", "mung beans"],
      per100g: 105,
      defaultKcal: 210,
      source: "CSDL nội bộ",
    },
    {
      id: "peanuts",
      name: "Lạc / đậu phộng",
      en: "Peanuts",
      aliases: ["lạc", "đậu phộng", "peanuts", "peanut"],
      per100g: 567,
      defaultKcal: 170,
      source: "CSDL nội bộ",
    },
    {
      id: "mixed_nuts",
      name: "Các loại hạt",
      en: "Mixed nuts",
      aliases: ["các loại hạt", "hạt hỗn hợp", "mixed nuts", "nuts"],
      per100g: 590,
      defaultKcal: 180,
      source: "CSDL nội bộ",
    },
    {
      id: "cucumber",
      name: "Dưa chuột",
      en: "Cucumber",
      aliases: ["dưa chuột", "dưa leo", "cucumber"],
      per100g: 15,
      perUnit: 30,
      gramsPerUnit: 200,
      defaultKcal: 30,
      source: "CSDL nội bộ",
    },
    {
      id: "tomato",
      name: "Cà chua",
      en: "Tomato",
      aliases: ["cà chua", "tomato", "tomatoes"],
      per100g: 18,
      perUnit: 22,
      gramsPerUnit: 123,
      defaultKcal: 22,
      source: "CSDL nội bộ",
    },
    {
      id: "carrot",
      name: "Cà rốt",
      en: "Carrot",
      aliases: ["cà rốt", "carrot", "carrots"],
      per100g: 41,
      perUnit: 30,
      gramsPerUnit: 73,
      defaultKcal: 30,
      source: "CSDL nội bộ",
    },
    {
      id: "broccoli",
      name: "Súp lơ xanh",
      en: "Broccoli",
      aliases: ["súp lơ xanh", "bông cải xanh", "broccoli"],
      per100g: 35,
      defaultKcal: 70,
      source: "CSDL nội bộ",
    },
    {
      id: "cabbage",
      name: "Bắp cải",
      en: "Cabbage",
      aliases: ["bắp cải", "cabbage"],
      per100g: 25,
      defaultKcal: 50,
      source: "CSDL nội bộ",
    },
    {
      id: "water_spinach",
      name: "Rau muống",
      en: "Water spinach",
      aliases: ["rau muống", "water spinach", "morning glory vegetable"],
      per100g: 19,
      defaultKcal: 40,
      source: "CSDL món Việt",
    },
    {
      id: "boiled_veg",
      name: "Rau luộc",
      en: "Boiled vegetables",
      aliases: ["rau luộc", "boiled vegetables", "steamed vegetables"],
      per100g: 30,
      defaultKcal: 60,
      source: "CSDL món Việt",
    },
    {
      id: "stirfried_veg",
      name: "Rau xào",
      en: "Stir-fried vegetables",
      aliases: ["rau xào", "stir fried vegetables", "vegetable stir fry"],
      per100g: 80,
      perPortion: 160,
      defaultKcal: 160,
      source: "CSDL món Việt",
    },
    {
      id: "salad",
      name: "Rau sống / salad",
      en: "Salad vegetables",
      aliases: [
        "rau sống",
        "salad rau",
        "green salad",
        "salad vegetables",
        "salad",
      ],
      per100g: 25,
      defaultKcal: 50,
      source: "CSDL nội bộ",
    },
    {
      id: "banana",
      name: "Chuối",
      en: "Banana",
      aliases: ["chuối", "banana", "bananas"],
      per100g: 89,
      perUnit: 105,
      gramsPerUnit: 118,
      defaultKcal: 105,
      source: "CSDL nội bộ",
    },
    {
      id: "apple",
      name: "Táo",
      en: "Apple",
      aliases: ["quả táo", "trái táo", "táo", "apple", "apples"],
      per100g: 52,
      perUnit: 95,
      gramsPerUnit: 182,
      defaultKcal: 95,
      source: "CSDL nội bộ",
    },
    {
      id: "orange",
      name: "Cam",
      en: "Orange",
      aliases: ["quả cam", "trái cam", "cam", "orange", "oranges"],
      per100g: 47,
      perUnit: 62,
      gramsPerUnit: 131,
      defaultKcal: 62,
      source: "CSDL nội bộ",
    },
    {
      id: "guava",
      name: "Ổi",
      en: "Guava",
      aliases: ["quả ổi", "trái ổi", "ổi", "guava"],
      per100g: 68,
      perUnit: 110,
      gramsPerUnit: 162,
      defaultKcal: 110,
      source: "CSDL nội bộ",
    },
    {
      id: "dragon_fruit",
      name: "Thanh long",
      en: "Dragon fruit",
      aliases: ["thanh long", "dragon fruit", "pitaya"],
      per100g: 50,
      perUnit: 150,
      gramsPerUnit: 300,
      defaultKcal: 150,
      source: "CSDL nội bộ",
    },
    {
      id: "watermelon",
      name: "Dưa hấu",
      en: "Watermelon",
      aliases: ["dưa hấu", "watermelon"],
      per100g: 30,
      defaultKcal: 120,
      source: "CSDL nội bộ",
    },
    {
      id: "mango",
      name: "Xoài",
      en: "Mango",
      aliases: ["xoài", "mango", "mangoes"],
      per100g: 60,
      perUnit: 135,
      gramsPerUnit: 225,
      defaultKcal: 135,
      source: "CSDL nội bộ",
    },
    {
      id: "pomelo",
      name: "Bưởi",
      en: "Pomelo",
      aliases: ["bưởi", "pomelo", "grapefruit"],
      per100g: 42,
      defaultKcal: 90,
      source: "CSDL nội bộ",
    },
    {
      id: "grapes",
      name: "Nho",
      en: "Grapes",
      aliases: ["nho", "grape", "grapes"],
      per100g: 69,
      defaultKcal: 140,
      source: "CSDL nội bộ",
    },
    {
      id: "pineapple",
      name: "Dứa / thơm",
      en: "Pineapple",
      aliases: ["dứa", "thơm", "khóm", "pineapple"],
      per100g: 50,
      defaultKcal: 100,
      source: "CSDL nội bộ",
    },
    {
      id: "papaya",
      name: "Đu đủ",
      en: "Papaya",
      aliases: ["đu đủ", "papaya"],
      per100g: 43,
      defaultKcal: 86,
      source: "CSDL nội bộ",
    },
    {
      id: "avocado",
      name: "Bơ",
      en: "Avocado",
      aliases: ["quả bơ", "trái bơ", "avocado"],
      per100g: 160,
      perUnit: 240,
      gramsPerUnit: 150,
      defaultKcal: 240,
      source: "CSDL nội bộ",
    },
    {
      id: "goi_cuon",
      name: "Gỏi cuốn",
      en: "Vietnamese fresh spring roll",
      aliases: [
        "gỏi cuốn",
        "nem cuốn",
        "fresh spring roll",
        "vietnamese summer roll",
        "summer roll",
      ],
      perUnit: 90,
      defaultKcal: 90,
      source: "CSDL món Việt",
    },
    {
      id: "nem_ran",
      name: "Nem rán / chả giò",
      en: "Fried spring roll",
      aliases: [
        "nem rán",
        "chả giò",
        "fried spring roll",
        "egg roll vietnamese",
        "spring roll fried",
      ],
      perUnit: 130,
      defaultKcal: 130,
      source: "CSDL món Việt",
    },
    {
      id: "nem_chua",
      name: "Nem chua",
      en: "Fermented pork roll",
      aliases: ["nem chua", "fermented pork roll"],
      perUnit: 70,
      defaultKcal: 70,
      source: "CSDL món Việt",
    },
    {
      id: "boiled_dumpling",
      name: "Há cảo hấp",
      en: "Steamed dumpling",
      aliases: ["há cảo hấp", "dumpling hấp", "steamed dumpling", "har gow"],
      perUnit: 45,
      defaultKcal: 45,
      source: "CSDL nội bộ",
    },
    {
      id: "fried_chicken",
      name: "Gà rán",
      en: "Fried chicken",
      aliases: ["gà rán", "fried chicken"],
      per100g: 280,
      perUnit: 320,
      defaultKcal: 320,
      source: "CSDL nội bộ",
    },
    {
      id: "french_fries",
      name: "Khoai tây chiên",
      en: "French fries",
      aliases: ["khoai tây chiên", "french fries", "fries"],
      per100g: 312,
      perPortion: 310,
      defaultKcal: 310,
      source: "CSDL nội bộ",
    },
    {
      id: "rice_paper",
      name: "Bánh tráng",
      en: "Rice paper",
      aliases: ["bánh tráng", "rice paper", "spring roll wrapper"],
      perUnit: 35,
      per100g: 340,
      defaultKcal: 35,
      source: "CSDL món Việt",
    },
    {
      id: "banh_trang_tron",
      name: "Bánh tráng trộn",
      en: "Vietnamese rice paper salad",
      aliases: ["bánh tráng trộn", "rice paper salad", "banh trang tron"],
      perPortion: 500,
      defaultKcal: 500,
      source: "CSDL món Việt",
    },
    {
      id: "cooking_oil",
      name: "Dầu ăn",
      en: "Cooking oil",
      aliases: [
        "dầu ăn",
        "dầu olive",
        "dầu ô liu",
        "cooking oil",
        "olive oil",
        "oil",
      ],
      perGram: 9,
      perTbsp: 120,
      defaultKcal: 120,
      source: "CSDL nội bộ",
    },
    {
      id: "honey",
      name: "Mật ong",
      en: "Honey",
      aliases: ["mật ong", "honey"],
      perTbsp: 64,
      defaultKcal: 64,
      source: "CSDL nội bộ",
    },
    {
      id: "soy_sauce",
      name: "Nước tương / xì dầu",
      en: "Soy sauce",
      aliases: ["xì dầu", "nước tương", "soy sauce"],
      perTbsp: 9,
      perPortion: 15,
      defaultKcal: 15,
      source: "CSDL nội bộ",
    },
    {
      id: "fish_sauce",
      name: "Nước mắm",
      en: "Fish sauce",
      aliases: ["nước mắm", "fish sauce"],
      perTbsp: 10,
      defaultKcal: 10,
      source: "CSDL món Việt",
    },
    {
      id: "sugar",
      name: "Đường",
      en: "Sugar",
      aliases: ["đường trắng", "đường", "sugar"],
      perGram: 4,
      perTbsp: 48,
      defaultKcal: 48,
      source: "CSDL nội bộ",
    },
    {
      id: "sugarcane_juice",
      name: "Nước mía",
      en: "Sugarcane juice",
      aliases: ["nước mía", "sugarcane juice"],
      per100ml: 80,
      perCup: 200,
      defaultKcal: 200,
      source: "CSDL món Việt",
    },
    {
      id: "pennywort_juice",
      name: "Nước rau má",
      en: "Pennywort juice",
      aliases: ["nước rau má", "rau má", "pennywort juice"],
      perCup: 120,
      defaultKcal: 120,
      source: "CSDL món Việt",
    },
    {
      id: "sugarcane_pennywort",
      name: "Nước mía rau má",
      en: "Sugarcane pennywort juice",
      aliases: ["nước mía rau má", "sugarcane pennywort juice"],
      perCup: 190,
      defaultKcal: 190,
      source: "CSDL món Việt",
    },
    {
      id: "black_coffee",
      name: "Cà phê đen không đường",
      en: "Black coffee",
      aliases: [
        "cà phê đen không đường",
        "cà phê đen",
        "black coffee",
        "coffee no sugar",
      ],
      perCup: 5,
      defaultKcal: 5,
      source: "CSDL nội bộ",
    },
    {
      id: "milk_coffee",
      name: "Cà phê sữa",
      en: "Vietnamese milk coffee",
      aliases: [
        "cà phê sữa",
        "cà phê sữa đá",
        "vietnamese milk coffee",
        "vietnamese iced coffee",
      ],
      perCup: 180,
      defaultKcal: 180,
      source: "CSDL món Việt",
    },
    {
      id: "bubble_tea",
      name: "Trà sữa",
      en: "Milk tea with pearls",
      aliases: [
        "trà sữa",
        "trà sữa trân châu",
        "bubble tea",
        "boba tea",
        "milk tea",
      ],
      perCup: 450,
      defaultKcal: 450,
      source: "CSDL nội bộ",
    },
    {
      id: "beer",
      name: "Bia",
      en: "Beer",
      aliases: ["bia", "beer"],
      per100ml: 43,
      nonMacroEnergy: true,
      perCan: 150,
      perUnit: 150,
      defaultKcal: 150,
      source: "CSDL nội bộ",
    },
    {
      id: "soft_drink",
      name: "Nước ngọt có đường",
      en: "Sugary soft drink",
      aliases: [
        "nước ngọt",
        "coca cola",
        "pepsi",
        "soft drink",
        "soda",
        "cola",
      ],
      per100ml: 42,
      perCan: 140,
      perUnit: 140,
      defaultKcal: 140,
      source: "Nhãn sản phẩm / CSDL nội bộ",
    },
  ];
  const VI_FOOD_DB_EXTRA = [
    {
      id: "bun_fresh",
      name: "Bún tươi",
      en: "Fresh rice vermicelli",
      aliases: [
        "bún tươi",
        "bún trắng",
        "bún sợi",
        "bún",
        "fresh rice vermicelli",
        "rice vermicelli",
      ],
      per100g: 110,
      perBowl: 220,
      defaultKcal: 220,
      source: "CSDL thực phẩm Việt tích hợp · theo 100 g/khẩu phần",
      protein100g: 1.8,
      carbs100g: 24.0,
      fat100g: 0.2,
    },
    {
      id: "pho_noodle_fresh",
      name: "Bánh phở tươi",
      en: "Fresh pho noodles",
      aliases: ["bánh phở tươi", "bánh phở", "sợi phở", "fresh pho noodles"],
      per100g: 110,
      perBowl: 220,
      defaultKcal: 220,
      source: "CSDL thực phẩm Việt tích hợp · theo 100 g/khẩu phần",
    },
    {
      id: "banh_nhan_hai_hau",
      name: "Bánh nhãn Hải Hậu",
      en: "Hai Hau fried glutinous rice balls",
      aliases: [
        "bánh nhãn hải hậu",
        "bánh nhãn nam định",
        "bánh nhãn",
        "banh nhan hai hau",
        "hai hau bánh nhãn",
      ],
      per100g: 430,
      perUnit: 32,
      gramsPerUnit: 7.5,
      defaultKcal: 215,
      source: "CSDL đặc sản Việt tích hợp · công thức/khẩu phần ước tính",
    },
    {
      id: "banh_gai",
      name: "Bánh gai",
      en: "Vietnamese ramie leaf cake",
      aliases: ["bánh gai", "bánh gai ninh giang", "banh gai"],
      per100g: 250,
      perUnit: 250,
      defaultKcal: 250,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "banh_dau_xanh",
      name: "Bánh đậu xanh Hải Dương",
      en: "Hai Duong mung bean cake",
      aliases: ["bánh đậu xanh hải dương", "bánh đậu xanh", "banh dau xanh"],
      per100g: 430,
      perUnit: 52,
      gramsPerUnit: 12,
      defaultKcal: 215,
      source: "CSDL đặc sản Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "keo_lac",
      name: "Kẹo lạc",
      en: "Peanut brittle",
      aliases: ["kẹo lạc", "kẹo đậu phộng", "peanut brittle"],
      per100g: 500,
      perUnit: 75,
      gramsPerUnit: 15,
      defaultKcal: 150,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "com_vong",
      name: "Cốm làng Vòng",
      en: "Green rice flakes",
      aliases: [
        "cốm làng vòng",
        "cốm vòng",
        "cốm tươi",
        "cốm",
        "green rice flakes",
      ],
      per100g: 350,
      defaultKcal: 175,
      source: "CSDL thực phẩm Việt tích hợp · theo 100 g",
    },
    {
      id: "banh_com",
      name: "Bánh cốm",
      en: "Green rice cake",
      aliases: ["bánh cốm", "bánh cốm hàng than", "green rice cake"],
      per100g: 300,
      perUnit: 180,
      defaultKcal: 180,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "banh_pia",
      name: "Bánh pía Sóc Trăng",
      en: "Soc Trang pia cake",
      aliases: ["bánh pía sóc trăng", "bánh pía", "banh pia"],
      per100g: 400,
      perUnit: 400,
      defaultKcal: 400,
      source: "CSDL đặc sản Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "banh_it_la_gai",
      name: "Bánh ít lá gai",
      en: "Ramie leaf sticky rice cake",
      aliases: ["bánh ít lá gai", "bánh ít", "banh it la gai"],
      per100g: 260,
      perUnit: 180,
      defaultKcal: 180,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "banh_bo",
      name: "Bánh bò",
      en: "Vietnamese honeycomb cake",
      aliases: [
        "bánh bò",
        "bánh bò hấp",
        "bánh bò nướng",
        "honeycomb cake vietnamese",
      ],
      per100g: 240,
      perUnit: 120,
      defaultKcal: 120,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "banh_boteloc",
      name: "Bánh bột lọc",
      en: "Tapioca dumpling",
      aliases: ["bánh bột lọc", "bột lọc huế", "tapioca dumpling vietnamese"],
      perUnit: 45,
      defaultKcal: 225,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "banh_beo",
      name: "Bánh bèo",
      en: "Steamed rice cake cups",
      aliases: ["bánh bèo", "bánh bèo huế", "steamed rice cake cups"],
      perUnit: 45,
      perPortion: 360,
      defaultKcal: 360,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "banh_khot",
      name: "Bánh khọt",
      en: "Vietnamese mini savory pancakes",
      aliases: ["bánh khọt", "banh khot", "mini savory pancakes vietnamese"],
      perUnit: 60,
      perPortion: 480,
      defaultKcal: 480,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "com_tam_suon",
      name: "Cơm tấm sườn",
      en: "Broken rice with grilled pork chop",
      aliases: [
        "cơm tấm sườn",
        "cơm tấm sườn bì chả",
        "cơm tấm",
        "broken rice grilled pork",
      ],
      perPortion: 650,
      defaultKcal: 650,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "com_ga_hoi_an",
      name: "Cơm gà Hội An",
      en: "Hoi An chicken rice",
      aliases: [
        "cơm gà hội an",
        "cơm gà tam kỳ",
        "cơm gà",
        "hoi an chicken rice",
      ],
      perPortion: 600,
      defaultKcal: 600,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "com_hen",
      name: "Cơm hến Huế",
      en: "Hue baby clam rice",
      aliases: ["cơm hến huế", "cơm hến", "baby clam rice"],
      perBowl: 450,
      defaultKcal: 450,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "bun_dau_mam_tom",
      name: "Bún đậu mắm tôm",
      en: "Rice vermicelli with tofu and shrimp paste",
      aliases: ["bún đậu mắm tôm", "bún đậu", "bun dau mam tom"],
      perPortion: 700,
      defaultKcal: 700,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "bun_mam",
      name: "Bún mắm",
      en: "Vietnamese fermented fish noodle soup",
      aliases: ["bún mắm", "bun mam", "fermented fish noodle soup"],
      perBowl: 550,
      defaultKcal: 550,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "bun_nuoc_leo",
      name: "Bún nước lèo",
      en: "Southern fermented fish noodle soup",
      aliases: ["bún nước lèo", "bún nước lèo sóc trăng", "bun nuoc leo"],
      perBowl: 500,
      defaultKcal: 500,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "bun_quay",
      name: "Bún quậy Phú Quốc",
      en: "Phu Quoc stirred noodle soup",
      aliases: ["bún quậy phú quốc", "bún quậy", "bun quay"],
      perBowl: 500,
      defaultKcal: 500,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "bun_sua",
      name: "Bún sứa Nha Trang",
      en: "Nha Trang jellyfish noodle soup",
      aliases: ["bún sứa nha trang", "bún sứa", "jellyfish noodle soup"],
      perBowl: 400,
      defaultKcal: 400,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "bun_thang",
      name: "Bún thang Hà Nội",
      en: "Hanoi chicken noodle soup",
      aliases: ["bún thang hà nội", "bún thang", "bun thang"],
      perBowl: 450,
      defaultKcal: 450,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "pho_cuon",
      name: "Phở cuốn",
      en: "Fresh pho rolls",
      aliases: ["phở cuốn", "pho cuon", "fresh pho rolls"],
      perUnit: 80,
      perPortion: 480,
      defaultKcal: 480,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "pho_chien_phong",
      name: "Phở chiên phồng",
      en: "Crispy fried pho noodles",
      aliases: ["phở chiên phồng", "phở chiên", "crispy fried pho noodles"],
      perPortion: 700,
      defaultKcal: 700,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "mi_vit_tiem",
      name: "Mì vịt tiềm",
      en: "Braised duck noodle soup",
      aliases: ["mì vịt tiềm", "mi vit tiem", "braised duck noodle soup"],
      perBowl: 650,
      defaultKcal: 650,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "mi_quang_ga",
      name: "Mì Quảng gà",
      en: "Quang chicken noodles",
      aliases: ["mì quảng gà", "mì quảng", "mi quang ga"],
      perBowl: 550,
      defaultKcal: 550,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "cao_lau_hoian",
      name: "Cao lầu Hội An",
      en: "Hoi An cao lau noodles",
      aliases: ["cao lầu hội an", "cao lầu", "cao lau hoi an"],
      perBowl: 550,
      defaultKcal: 550,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "banh_canh_cua",
      name: "Bánh canh cua",
      en: "Crab thick noodle soup",
      aliases: ["bánh canh cua", "bánh canh ghẹ", "crab thick noodle soup"],
      perBowl: 550,
      defaultKcal: 550,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "banh_canh_ca_loc",
      name: "Bánh canh cá lóc",
      en: "Snakehead fish thick noodle soup",
      aliases: [
        "bánh canh cá lóc",
        "bánh canh cá",
        "snakehead fish noodle soup",
      ],
      perBowl: 450,
      defaultKcal: 450,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "hu_tieu_nam_vang",
      name: "Hủ tiếu Nam Vang",
      en: "Phnom Penh style noodle soup",
      aliases: ["hủ tiếu nam vang", "hu tieu nam vang"],
      perBowl: 550,
      defaultKcal: 550,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "hu_tieu_my_tho",
      name: "Hủ tiếu Mỹ Tho",
      en: "My Tho noodle soup",
      aliases: ["hủ tiếu mỹ tho", "hu tieu my tho"],
      perBowl: 500,
      defaultKcal: 500,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "chao_long",
      name: "Cháo lòng",
      en: "Pork offal congee",
      aliases: ["cháo lòng", "chao long", "pork offal congee"],
      perBowl: 450,
      defaultKcal: 450,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "chao_luon",
      name: "Cháo lươn Nghệ An",
      en: "Nghe An eel congee",
      aliases: ["cháo lươn nghệ an", "cháo lươn", "eel congee"],
      perBowl: 400,
      defaultKcal: 400,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "nem_nuong_nhatrang",
      name: "Nem nướng Nha Trang",
      en: "Nha Trang grilled pork rolls",
      aliases: [
        "nem nướng nha trang",
        "nem nướng",
        "grilled pork rolls nha trang",
      ],
      perPortion: 600,
      defaultKcal: 600,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "cha_muc_halong",
      name: "Chả mực Hạ Long",
      en: "Ha Long squid cake",
      aliases: ["chả mực hạ long", "chả mực", "squid cake vietnamese"],
      per100g: 260,
      perUnit: 90,
      defaultKcal: 260,
      source: "CSDL đặc sản Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "cha_ca_lavong",
      name: "Chả cá Lã Vọng",
      en: "Hanoi turmeric fish with dill",
      aliases: ["chả cá lã vọng", "chả cá hà nội", "cha ca la vong"],
      perPortion: 550,
      defaultKcal: 550,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "thit_kho_trung",
      name: "Thịt kho trứng",
      en: "Vietnamese braised pork and eggs",
      aliases: [
        "thịt kho trứng",
        "thịt kho tàu",
        "braised pork and eggs vietnamese",
      ],
      per100g: 250,
      perPortion: 500,
      defaultKcal: 500,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "ca_kho_to",
      name: "Cá kho tộ",
      en: "Vietnamese caramelized braised fish",
      aliases: ["cá kho tộ", "cá kho", "caramelized braised fish"],
      per100g: 180,
      perPortion: 270,
      defaultKcal: 270,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "canh_chua_ca",
      name: "Canh chua cá",
      en: "Vietnamese sour fish soup",
      aliases: ["canh chua cá", "canh chua", "sour fish soup vietnamese"],
      perBowl: 180,
      defaultKcal: 180,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "che_dau_xanh",
      name: "Chè đậu xanh",
      en: "Mung bean sweet soup",
      aliases: ["chè đậu xanh", "chè đỗ xanh", "mung bean sweet soup"],
      perCup: 250,
      defaultKcal: 250,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "che_ba_mau",
      name: "Chè ba màu",
      en: "Vietnamese three color dessert",
      aliases: ["chè ba màu", "three color dessert vietnamese"],
      perCup: 400,
      defaultKcal: 400,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "che_buoi",
      name: "Chè bưởi",
      en: "Pomelo sweet soup",
      aliases: ["chè bưởi", "pomelo sweet soup"],
      perCup: 300,
      defaultKcal: 300,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "tao_pho",
      name: "Tào phớ",
      en: "Vietnamese tofu pudding",
      aliases: ["tào phớ", "tàu hũ nước đường", "tofu pudding vietnamese"],
      perCup: 180,
      defaultKcal: 180,
      source: "CSDL món Việt tích hợp · khẩu phần tham chiếu",
    },
    {
      id: "ngan_roasted_skinless",
      name: "Ngan cháy tỏi không da",
      en: "Skinless garlic roasted Muscovy duck",
      aliases: [
        "ngan cháy tỏi không da",
        "ngan chay toi khong da",
        "ngan cháy tỏi",
        "ngan chay toi",
        "thịt ngan không da",
        "thit ngan khong da",
        "ngan không da",
        "ngan khong da",
      ],
      per100g: 190,
      perUnit: 760,
      gramsPerUnit: 400,
      defaultKcal: 250,
      source: "CSDL món Việt tích hợp",
    },
    {
      id: "bun_ngan_skinless",
      name: "Bún ngan không da",
      en: "Vietnamese Muscovy duck noodle soup, skinless",
      aliases: [
        "bún ngan không da",
        "bun ngan khong da",
        "bún ngan",
        "bun ngan",
      ],
      perBowl: 430,
      defaultKcal: 430,
      source: "CSDL món Việt tích hợp",
    },
  ];
  const PRO_FOOD_DB_V3 = [
    {
      id: "v3_bun_fresh",
      name: "Bún tươi chín",
      en: "Cooked fresh rice vermicelli",
      aliases: [
        "bún tươi",
        "bún chín",
        "bún trắng",
        "bún sợi",
        "bún",
        "fresh rice vermicelli",
        "cooked rice vermicelli",
      ],
      per100g: 110,
      perBowl: 220,
      defaultKcal: 220,
      rangePct: 0.05,
      rangeNote: "tùy loại bún và độ ẩm sau khi chín",
      source: "Bảng thành phần thực phẩm Việt Nam · 110 kcal/100 g",
      protein100g: 1.8,
      carbs100g: 24.0,
      fat100g: 0.2,
    },
    {
      id: "v3_pho_noodle",
      name: "Bánh phở tươi chín",
      en: "Cooked fresh pho noodles",
      aliases: [
        "bánh phở tươi",
        "bánh phở chín",
        "bánh phở",
        "sợi phở",
        "fresh pho noodles",
      ],
      per100g: 110,
      perBowl: 220,
      defaultKcal: 220,
      rangePct: 0.05,
      source: "Bảng thành phần thực phẩm Việt Nam · theo 100 g",
    },
    {
      id: "v3_glass_noodle",
      name: "Miến dong chín",
      en: "Cooked glass noodles",
      aliases: [
        "miến dong chín",
        "miến chín",
        "miến dong",
        "glass noodles cooked",
        "cooked glass noodles",
      ],
      per100g: 85,
      perBowl: 170,
      defaultKcal: 170,
      rangePct: 0.08,
      source: "Bảng thành phần thực phẩm Việt Nam · khẩu phần chín",
    },
    {
      id: "v3_egg_noodle",
      name: "Mì trứng chín",
      en: "Cooked egg noodles",
      aliases: [
        "mì trứng chín",
        "mì trứng",
        "mì vàng chín",
        "mì chín",
        "cooked egg noodles",
        "egg noodles cooked",
      ],
      per100g: 138,
      perBowl: 276,
      defaultKcal: 276,
      rangePct: 0.08,
      source: "USDA FoodData Central · khẩu phần chín",
    },
    {
      id: "v3_hu_tieu_noodle",
      name: "Sợi hủ tiếu chín",
      en: "Cooked hu tieu rice noodles",
      aliases: [
        "sợi hủ tiếu",
        "hủ tiếu chín",
        "hu tieu noodles",
        "cooked rice noodles",
      ],
      per100g: 110,
      perBowl: 220,
      defaultKcal: 220,
      rangePct: 0.08,
      source: "Bảng thành phần thực phẩm Việt Nam · khẩu phần chín",
    },
    {
      id: "v3_rice_cooked",
      name: "Cơm trắng chín",
      en: "Cooked white rice",
      aliases: [
        "cơm trắng chín",
        "cơm chín",
        "cơm trắng",
        "cơm",
        "cooked white rice",
        "cooked rice",
      ],
      per100g: 130,
      perBowl: 200,
      defaultKcal: 200,
      rangePct: 0.04,
      source: "USDA/Bảng thành phần thực phẩm Việt Nam · 130 kcal/100 g",
    },
    {
      id: "v3_fried_rice",
      name: "Cơm rang / cơm chiên",
      en: "Fried rice",
      aliases: ["cơm rang", "cơm chiên", "fried rice"],
      per100g: 180,
      perPortion: 630,
      defaultKcal: 630,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh · phụ thuộc dầu, trứng và thịt",
    },
    {
      id: "v3_sticky_rice",
      name: "Xôi chín",
      en: "Cooked sticky rice",
      aliases: [
        "xôi trắng",
        "xôi chín",
        "xôi",
        "cơm nếp",
        "sticky rice cooked",
      ],
      per100g: 170,
      perBowl: 340,
      defaultKcal: 340,
      rangePct: 0.1,
      source: "Bảng thành phần thực phẩm Việt Nam · món chín",
    },
    {
      id: "v3_pho_beef",
      name: "Phở bò",
      en: "Beef pho",
      aliases: [
        "phở bò",
        "phở tái",
        "phở chín",
        "phở bò tái",
        "beef pho",
        "pho bo",
      ],
      perBowl: 550,
      defaultKcal: 550,
      rangePct: 0.18,
      source: "Khẩu phần Viện Dinh dưỡng + thành phần chuẩn; tô thường",
    },
    {
      id: "v3_pho_beef_stir",
      name: "Phở bò tái lăn",
      en: "Stir-fried beef pho",
      aliases: ["phở bò tái lăn", "phở tái lăn", "stir fried beef pho"],
      perBowl: 620,
      defaultKcal: 620,
      rangePct: 0.15,
      source: "Viện Dinh dưỡng Việt Nam · mẫu phở bò tái lăn 620 kcal",
    },
    {
      id: "v3_pho_chicken",
      name: "Phở gà",
      en: "Chicken pho",
      aliases: ["phở gà", "chicken pho", "pho ga"],
      perBowl: 470,
      defaultKcal: 470,
      rangePct: 0.18,
      source: "Khẩu phần món hoàn chỉnh · bánh phở, gà và nước dùng",
    },
    {
      id: "v3_bun_bo_hue",
      name: "Bún bò Huế",
      en: "Hue beef noodle soup",
      aliases: ["bún bò huế", "bún bò", "bun bo hue"],
      perBowl: 600,
      defaultKcal: 600,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh · phụ thuộc giò, thịt và dầu sa tế",
    },
    {
      id: "v3_bun_cha",
      name: "Bún chả",
      en: "Grilled pork with rice vermicelli",
      aliases: ["bún chả", "bun cha", "grilled pork rice vermicelli"],
      perPortion: 650,
      defaultKcal: 650,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh · bún, chả nướng, nước chấm",
    },
    {
      id: "v3_bun_rieu",
      name: "Bún riêu cua",
      en: "Crab tomato noodle soup",
      aliases: ["bún riêu cua", "bún riêu", "bun rieu"],
      perBowl: 480,
      defaultKcal: 480,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh · phụ thuộc riêu, đậu và giò",
    },
    {
      id: "v3_bun_fish",
      name: "Bún cá",
      en: "Fish noodle soup",
      aliases: ["bún cá", "bun ca", "fish noodle soup"],
      perBowl: 450,
      defaultKcal: 450,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh · cá luộc/chiên làm thay đổi calo",
    },
    {
      id: "v3_bun_moc",
      name: "Bún mọc",
      en: "Pork meatball noodle soup",
      aliases: ["bún mọc", "bun moc"],
      perBowl: 450,
      defaultKcal: 450,
      rangePct: 0.18,
      source: "Khẩu phần món hoàn chỉnh",
    },
    {
      id: "v3_bun_thit_nuong",
      name: "Bún thịt nướng",
      en: "Grilled pork vermicelli bowl",
      aliases: ["bún thịt nướng", "bun thit nuong"],
      perBowl: 600,
      defaultKcal: 600,
      rangePct: 0.22,
      source: "Khẩu phần món hoàn chỉnh · phụ thuộc thịt, lạc và nước chấm",
    },
    {
      id: "v3_bun_dau",
      name: "Bún đậu mắm tôm",
      en: "Rice vermicelli with fried tofu and shrimp paste",
      aliases: ["bún đậu mắm tôm", "bún đậu", "bun dau mam tom"],
      perPortion: 750,
      defaultKcal: 750,
      rangePct: 0.25,
      source: "Khẩu phần món hoàn chỉnh · mẹt thường có đậu rán, thịt, chả cốm",
    },
    {
      id: "v3_bun_ngan_skinless",
      name: "Bún ngan không da",
      en: "Skinless Muscovy duck noodle soup",
      aliases: ["bún ngan không da", "bún ngan bỏ da", "bun ngan khong da"],
      perBowl: 500,
      defaultKcal: 500,
      rangePct: 0.18,
      source: "Khẩu phần món hoàn chỉnh · bún, thịt ngan không da, nước dùng",
    },
    {
      id: "v3_bun_ngan",
      name: "Bún ngan",
      en: "Muscovy duck noodle soup",
      aliases: ["bún ngan", "bun ngan", "duck vermicelli soup"],
      perBowl: 560,
      defaultKcal: 560,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh · có thể gồm da và măng",
    },
    {
      id: "v3_bun_thang",
      name: "Bún thang",
      en: "Hanoi chicken noodle soup",
      aliases: ["bún thang", "bun thang"],
      perBowl: 450,
      defaultKcal: 450,
      rangePct: 0.18,
      source: "Khẩu phần món hoàn chỉnh",
    },
    {
      id: "v3_mi_quang",
      name: "Mì Quảng",
      en: "Quang noodles",
      aliases: ["mì quảng", "mi quang"],
      perBowl: 580,
      defaultKcal: 580,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh · phụ thuộc thịt, lạc và bánh tráng",
    },
    {
      id: "v3_cao_lau",
      name: "Cao lầu",
      en: "Cao lau noodles",
      aliases: ["cao lầu", "cao lau"],
      perBowl: 550,
      defaultKcal: 550,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh",
    },
    {
      id: "v3_hu_tieu_nam_vang",
      name: "Hủ tiếu Nam Vang",
      en: "Phnom Penh style noodle soup",
      aliases: ["hủ tiếu nam vang", "hu tieu nam vang"],
      perBowl: 570,
      defaultKcal: 570,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh",
    },
    {
      id: "v3_banh_canh_cua",
      name: "Bánh canh cua",
      en: "Crab thick noodle soup",
      aliases: ["bánh canh cua", "bánh canh ghẹ", "crab thick noodle soup"],
      perBowl: 550,
      defaultKcal: 550,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh",
    },
    {
      id: "v3_mien_chicken",
      name: "Miến gà",
      en: "Chicken glass noodle soup",
      aliases: ["miến gà", "mien ga"],
      perBowl: 420,
      defaultKcal: 420,
      rangePct: 0.18,
      source: "Khẩu phần món hoàn chỉnh",
    },
    {
      id: "v3_mien_eel",
      name: "Miến lươn",
      en: "Eel glass noodle soup",
      aliases: ["miến lươn", "mien luon"],
      perBowl: 520,
      defaultKcal: 520,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh · lươn chiên làm tăng calo",
    },
    {
      id: "v3_duck_noodle",
      name: "Mì vịt tiềm",
      en: "Braised duck noodle soup",
      aliases: ["mì vịt tiềm", "mi vit tiem", "duck noodle soup"],
      perBowl: 700,
      defaultKcal: 700,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh · mì, đùi vịt và nước tiềm",
    },
    {
      id: "v3_beef_fried_noodle",
      name: "Mì xào bò",
      en: "Stir-fried noodles with beef",
      aliases: ["mì xào bò", "mi xao bo", "beef fried noodles"],
      perPortion: 700,
      defaultKcal: 700,
      rangePct: 0.22,
      source: "Khẩu phần món hoàn chỉnh · dầu xào là biến số lớn",
    },
    {
      id: "v3_beef_fried_pho",
      name: "Phở xào bò",
      en: "Stir-fried pho noodles with beef",
      aliases: ["phở xào bò", "pho xao bo"],
      perPortion: 720,
      defaultKcal: 720,
      rangePct: 0.22,
      source: "Khẩu phần món hoàn chỉnh · dầu xào là biến số lớn",
    },
    {
      id: "v3_duck_meat_skinless",
      name: "Thịt ngan/vịt chín không da",
      en: "Cooked roasted duck meat, skinless",
      aliases: [
        "thịt ngan không da",
        "ngan không da",
        "thịt vịt không da",
        "vịt không da",
        "duck meat skinless",
        "roasted duck meat only",
      ],
      per100g: 201,
      defaultKcal: 201,
      defaultProtein: 25,
      defaultCarbs: 0,
      defaultFat: 11.2,
      rangePct: 0.08,
      source:
        "USDA FoodData Central · thịt vịt quay chín, bỏ da: 201 kcal/100 g",
    },
    {
      id: "v3_duck_meat_skin",
      name: "Thịt ngan/vịt chín cả da",
      en: "Cooked roasted duck meat and skin",
      aliases: [
        "thịt ngan cả da",
        "ngan có da",
        "thịt vịt cả da",
        "vịt quay có da",
        "duck meat and skin roasted",
      ],
      per100g: 337,
      defaultKcal: 337,
      rangePct: 0.08,
      source: "USDA FoodData Central · thịt và da vịt quay: 337 kcal/100 g",
    },
    {
      id: "v3_ngan_garlic_skinless",
      name: "Ngan cháy tỏi không da",
      en: "Skinless garlic-fried Muscovy duck",
      aliases: [
        "ngan cháy tỏi không da",
        "ngan chay toi khong da",
        "ngan cháy tỏi bỏ da",
        "ngan cháy tỏi",
        "ngan chay toi",
      ],
      per100g: 225,
      perWhole: 2250,
      perPortion: 750,
      defaultKcal: 750,
      rangePct: 0.2,
      source:
        "USDA thịt vịt bỏ da 201 kcal/100 g + dầu/tỏi; 1 con quy đổi khoảng 1 kg thịt chín ăn được",
    },
    {
      id: "v3_ngan_boiled_skinless",
      name: "Ngan luộc không da",
      en: "Boiled Muscovy duck, skinless",
      aliases: [
        "ngan luộc không da",
        "ngan luộc bỏ da",
        "boiled duck skinless",
      ],
      per100g: 200,
      perWhole: 2000,
      perPortion: 670,
      defaultKcal: 670,
      rangePct: 0.18,
      source: "Thịt gia cầm chín bỏ da · quy đổi phần ăn được",
    },
    {
      id: "v3_pork_intestine_fried",
      name: "Lòng rán",
      en: "Fried pork intestines/offal",
      aliases: [
        "lòng rán",
        "lòng chiên",
        "lòng non rán",
        "fried pork intestine",
        "fried pork offal",
      ],
      per100g: 300,
      perPortion: 450,
      defaultKcal: 450,
      rangePct: 0.25,
      source:
        "Nội tạng chín + dầu chiên; khẩu phần ước tính, phụ thuộc loại lòng và lượng dầu",
    },
    {
      id: "v3_pork_intestine_cooked",
      name: "Lòng lợn luộc",
      en: "Cooked pork intestines/offal",
      aliases: [
        "lòng lợn luộc",
        "lòng luộc",
        "pork intestine cooked",
        "boiled pork offal",
      ],
      per100g: 185,
      perPortion: 280,
      defaultKcal: 280,
      rangePct: 0.2,
      source: "Dữ liệu nội tạng lợn chín tham chiếu USDA/FCT",
    },
    {
      id: "v3_beef_steak_plain",
      name: "Bò bít tết nguyên miếng",
      en: "Cooked beef steak",
      aliases: [
        "bò bít tết nguyên miếng",
        "bít tết bò",
        "beef steak",
        "steak bò",
        "steak",
      ],
      per100g: 210,
      perPortion: 420,
      defaultKcal: 420,
      rangePct: 0.15,
      source:
        "USDA FoodData Central · steak chín thường 170–242 kcal/100 g tùy phần thịt",
    },
    {
      id: "v3_beef_steak_butter",
      name: "Bò bít tết áp chảo bơ",
      en: "Butter-seared beef steak",
      aliases: [
        "bò bít tết áp chảo bơ",
        "steak áp chảo bơ",
        "butter steak",
        "pan seared steak with butter",
      ],
      per100g: 250,
      perPortion: 500,
      defaultKcal: 500,
      rangePct: 0.18,
      source: "Steak chín + lượng bơ/dầu áp chảo tham chiếu",
    },
    {
      id: "v3_vietnamese_steak_set",
      name: "Bò bít tết kiểu Việt Nam",
      en: "Vietnamese steak platter",
      aliases: [
        "bò bít tết kiểu việt",
        "bò né",
        "bít tết việt nam",
        "vietnamese steak platter",
      ],
      perPortion: 780,
      defaultKcal: 780,
      rangePct: 0.25,
      source:
        "Khẩu phần món hoàn chỉnh · bò, trứng, pate/xúc xích, khoai và bánh mì",
    },
    {
      id: "v3_beef_stirfry",
      name: "Bò xào",
      en: "Stir-fried beef",
      aliases: ["bò xào", "thịt bò xào", "stir fried beef"],
      per100g: 250,
      protein100g: 26,
      carbs100g: 3,
      fat100g: 14.9,
      perPortion: 400,
      defaultKcal: 400,
      rangePct: 0.18,
      source: "Thịt bò chín + dầu xào",
    },
    {
      id: "v3_pork_belly_fried",
      name: "Ba chỉ rán / quay",
      en: "Fried or roasted pork belly",
      aliases: [
        "ba chỉ rán",
        "ba chỉ chiên",
        "ba chỉ quay",
        "pork belly fried",
        "roasted pork belly",
      ],
      per100g: 500,
      perPortion: 500,
      defaultKcal: 500,
      rangePct: 0.15,
      source: "Thịt ba chỉ chín nhiều mỡ · tham chiếu USDA",
    },
    {
      id: "v3_chicken_breast",
      name: "Ức gà chín không da",
      en: "Cooked skinless chicken breast",
      aliases: [
        "ức gà chín",
        "ức gà không da",
        "cooked chicken breast skinless",
        "chicken breast",
      ],
      per100g: 165,
      defaultKcal: 248,
      rangePct: 0.06,
      source: "USDA FoodData Central · 165 kcal/100 g",
    },
    {
      id: "v3_fried_chicken",
      name: "Gà rán",
      en: "Fried chicken",
      aliases: ["gà rán", "gà chiên", "fried chicken"],
      per100g: 280,
      perUnit: 320,
      defaultKcal: 320,
      rangePct: 0.18,
      source: "USDA/nhãn chuỗi thức ăn nhanh · phụ thuộc lớp bột và phần gà",
    },
    {
      id: "v3_banh_cuon",
      name: "Bánh cuốn",
      en: "Steamed rice rolls",
      aliases: ["bánh cuốn", "banh cuon"],
      perPortion: 480,
      defaultKcal: 480,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh · bánh, nhân thịt, chả và hành phi",
    },
    {
      id: "v3_banh_xeo",
      name: "Bánh xèo",
      en: "Vietnamese sizzling pancake",
      aliases: ["bánh xèo", "banh xeo"],
      perUnit: 350,
      perPortion: 700,
      defaultKcal: 350,
      rangePct: 0.22,
      source: "Khẩu phần món hoàn chỉnh · lượng dầu chiên thay đổi lớn",
    },
    {
      id: "v3_banh_mi_meat",
      name: "Bánh mì thịt",
      en: "Vietnamese pork sandwich",
      aliases: [
        "bánh mì thịt",
        "bánh mì pate",
        "bánh mì kẹp thịt",
        "banh mi sandwich",
      ],
      perUnit: 500,
      defaultKcal: 500,
      rangePct: 0.22,
      source: "Khẩu phần món hoàn chỉnh · nhân và sốt quyết định calo",
    },
    {
      id: "v3_com_tam",
      name: "Cơm tấm sườn bì chả",
      en: "Broken rice pork chop plate",
      aliases: [
        "cơm tấm sườn bì chả",
        "cơm tấm sườn",
        "cơm tấm",
        "broken rice pork chop",
      ],
      perPortion: 750,
      defaultKcal: 750,
      rangePct: 0.22,
      source: "Khẩu phần món hoàn chỉnh · cơm, sườn, bì, chả, mỡ hành",
    },
    {
      id: "v3_com_ga",
      name: "Cơm gà",
      en: "Chicken rice",
      aliases: ["cơm gà hội an", "cơm gà", "chicken rice"],
      perPortion: 650,
      defaultKcal: 650,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh",
    },
    {
      id: "v3_banh_nhan",
      name: "Bánh nhãn Hải Hậu",
      en: "Hai Hau fried glutinous rice balls",
      aliases: [
        "bánh nhãn hải hậu",
        "bánh nhãn nam định",
        "bánh nhãn",
        "banh nhan hai hau",
      ],
      per100g: 430,
      perUnit: 32,
      gramsPerUnit: 7.5,
      defaultKcal: 215,
      rangePct: 0.12,
      source: "Đặc sản chiên đường · ước tính từ bột nếp, trứng, dầu và đường",
    },
    {
      id: "v3_spaghetti_bolognese",
      name: "Mì Ý sốt bò bằm",
      en: "Spaghetti bolognese",
      aliases: [
        "mì ý sốt bò bằm",
        "mì spaghetti bò bằm",
        "spaghetti bolognese",
        "bolognese pasta",
      ],
      perPortion: 600,
      defaultKcal: 600,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh · pasta, thịt bò và sốt cà",
    },
    {
      id: "v3_carbonara",
      name: "Mì Ý carbonara",
      en: "Spaghetti carbonara",
      aliases: ["mì ý carbonara", "spaghetti carbonara", "carbonara"],
      perPortion: 750,
      defaultKcal: 750,
      rangePct: 0.22,
      source: "Khẩu phần món hoàn chỉnh · kem/phô mai/thịt xông khói",
    },
    {
      id: "v3_pizza_margherita",
      name: "Pizza Margherita",
      en: "Margherita pizza",
      aliases: ["pizza margherita", "margherita pizza"],
      per100g: 250,
      perSlice: 250,
      perUnit: 250,
      defaultKcal: 250,
      rangePct: 0.15,
      source: "USDA/nhãn nhà hàng · phụ thuộc đường kính và đế bánh",
    },
    {
      id: "v3_pizza_pepperoni",
      name: "Pizza pepperoni",
      en: "Pepperoni pizza",
      aliases: ["pizza pepperoni", "pepperoni pizza"],
      per100g: 290,
      perSlice: 300,
      perUnit: 300,
      defaultKcal: 300,
      rangePct: 0.15,
      source: "USDA/nhãn nhà hàng · phụ thuộc đường kính và đế bánh",
    },
    {
      id: "v3_hamburger",
      name: "Hamburger",
      en: "Hamburger",
      aliases: ["hamburger", "burger bò", "beef burger"],
      perUnit: 550,
      defaultKcal: 550,
      rangePct: 0.22,
      source: "Khẩu phần món hoàn chỉnh · bánh, thịt và sốt",
    },
    {
      id: "v3_cheeseburger",
      name: "Cheeseburger",
      en: "Cheeseburger",
      aliases: ["cheeseburger", "burger phô mai"],
      perUnit: 650,
      defaultKcal: 650,
      defaultProtein: 32,
      defaultCarbs: 45,
      defaultFat: 38,
      rangePct: 0.22,
      source: "Khẩu phần món hoàn chỉnh · bánh, thịt, phô mai và sốt",
    },
    {
      id: "v3_fries",
      name: "Khoai tây chiên",
      en: "French fries",
      aliases: ["khoai tây chiên", "french fries", "fries"],
      per100g: 312,
      perPortion: 350,
      defaultKcal: 350,
      rangePct: 0.15,
      source: "USDA FoodData Central · khoảng 312 kcal/100 g",
    },
    {
      id: "v3_fish_chips",
      name: "Fish and chips",
      en: "Fish and chips",
      aliases: ["fish and chips", "cá tẩm bột chiên khoai tây"],
      perPortion: 900,
      defaultKcal: 900,
      rangePct: 0.22,
      source: "Khẩu phần món hoàn chỉnh · cá tẩm bột, dầu và khoai chiên",
    },
    {
      id: "v3_caesar_salad",
      name: "Caesar salad",
      en: "Caesar salad",
      aliases: ["caesar salad", "salad caesar"],
      perPortion: 450,
      defaultKcal: 450,
      rangePct: 0.25,
      source:
        "Khẩu phần món hoàn chỉnh · sốt, phô mai và crouton là biến số lớn",
    },
    {
      id: "v3_grilled_chicken_salad",
      name: "Salad gà nướng",
      en: "Grilled chicken salad",
      aliases: ["salad gà nướng", "grilled chicken salad"],
      perPortion: 380,
      defaultKcal: 380,
      rangePct: 0.22,
      source: "Khẩu phần món hoàn chỉnh · phụ thuộc sốt",
    },
    {
      id: "v3_ramen",
      name: "Ramen",
      en: "Ramen noodle soup",
      aliases: ["ramen", "mì ramen", "ramen noodle soup"],
      perBowl: 600,
      defaultKcal: 600,
      rangePct: 0.22,
      source: "Khẩu phần món hoàn chỉnh · nước béo, thịt và topping",
    },
    {
      id: "v3_udon",
      name: "Udon nước",
      en: "Udon noodle soup",
      aliases: ["udon nước", "mì udon", "udon noodle soup", "udon"],
      perBowl: 480,
      defaultKcal: 480,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh",
    },
    {
      id: "v3_pad_thai",
      name: "Pad Thai",
      en: "Pad Thai",
      aliases: ["pad thai", "phở xào thái"],
      perPortion: 750,
      defaultKcal: 750,
      rangePct: 0.22,
      source: "Khẩu phần món hoàn chỉnh · dầu, lạc và đường trong sốt",
    },
    {
      id: "v3_japanese_curry",
      name: "Cơm cà ri Nhật",
      en: "Japanese curry rice",
      aliases: ["cơm cà ri nhật", "japanese curry rice", "curry rice"],
      perPortion: 800,
      defaultKcal: 800,
      rangePct: 0.2,
      source: "Khẩu phần món hoàn chỉnh · cơm, roux và thịt",
    },
    {
      id: "v3_sushi_salmon",
      name: "Sushi cá hồi",
      en: "Salmon sushi",
      aliases: ["sushi cá hồi", "salmon sushi", "salmon nigiri"],
      perUnit: 55,
      defaultKcal: 330,
      rangePct: 0.12,
      source: "Khẩu phần sushi chuẩn · kích thước miếng thay đổi",
    },
    {
      id: "v3_croissant",
      name: "Bánh croissant",
      en: "Croissant",
      aliases: ["bánh croissant", "croissant", "bánh sừng bò"],
      per100g: 406,
      perUnit: 230,
      defaultKcal: 230,
      rangePct: 0.15,
      source: "USDA FoodData Central · phụ thuộc kích thước và lượng bơ",
    },
    {
      id: "v3_pancakes",
      name: "Pancake",
      en: "Pancakes",
      aliases: ["pancake", "pancakes", "bánh kếp mỹ"],
      perPortion: 400,
      defaultKcal: 400,
      rangePct: 0.22,
      source: "Khẩu phần 2–3 bánh + bơ/siro tham chiếu",
    },
    {
      id: "v3_icecream",
      name: "Kem sữa",
      en: "Ice cream",
      aliases: ["kem sữa", "kem lạnh", "ice cream"],
      per100g: 210,
      perCup: 270,
      defaultKcal: 270,
      rangePct: 0.15,
      source: "USDA/nhãn sản phẩm · hương vị quyết định calo",
    },
    {
      id: "v3_chocolate",
      name: "Sô cô la",
      en: "Chocolate",
      aliases: ["sô cô la", "socola", "chocolate"],
      per100g: 550,
      defaultKcal: 165,
      rangePct: 0.12,
      source: "USDA/nhãn sản phẩm",
    },
  ];
  const FOOD_DB_V4 = [
    {
      id: "v4_com_suon",
      name: "Cơm sườn nướng",
      en: "Vietnamese grilled pork chop rice",
      aliases: [
        "cơm sườn",
        "cơm sườn nướng",
        "com suon",
        "com suon nuong",
        "grilled pork chop rice",
        "pork chop rice",
      ],
      perPortion: 650,
      defaultKcal: 650,
      defaultProtein: 32,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · khẩu phần cơm Việt",
    },
    {
      id: "v4_com_suon_bi_cha",
      name: "Cơm tấm sườn bì chả",
      en: "Com tam with pork chop, shredded pork and egg meatloaf",
      aliases: [
        "cơm tấm sườn bì chả",
        "cơm tấm đặc biệt",
        "com tam suon bi cha",
        "com tam dac biet",
      ],
      perPortion: 850,
      defaultKcal: 850,
      defaultProtein: 42,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · khẩu phần cơm tấm",
    },
    {
      id: "v4_com_tam_suon",
      name: "Cơm tấm sườn",
      en: "Broken rice with grilled pork chop",
      aliases: ["cơm tấm sườn", "com tam suon", "broken rice pork chop"],
      perPortion: 700,
      defaultKcal: 700,
      defaultProtein: 34,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · khẩu phần cơm tấm",
    },
    {
      id: "v4_com_ga_xoi_mo",
      name: "Cơm gà xối mỡ",
      en: "Fried chicken rice",
      aliases: ["cơm gà xối mỡ", "com ga xoi mo", "fried chicken rice"],
      perPortion: 780,
      defaultKcal: 780,
      defaultProtein: 35,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · dầu chiên là biến số lớn",
    },
    {
      id: "v4_com_ga_hai_nam",
      name: "Cơm gà Hải Nam",
      en: "Hainanese chicken rice",
      aliases: [
        "cơm gà hải nam",
        "com ga hai nam",
        "hainanese chicken rice",
        "chicken rice",
      ],
      perPortion: 680,
      defaultKcal: 680,
      defaultProtein: 32,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · khẩu phần cơm gà",
    },
    {
      id: "v4_com_thit_kho",
      name: "Cơm thịt kho",
      en: "Rice with caramelized pork",
      aliases: [
        "cơm thịt kho",
        "com thit kho",
        "rice with caramelized pork",
        "rice pork stew",
      ],
      perPortion: 650,
      defaultKcal: 650,
      defaultProtein: 28,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · cơm + thịt kho",
    },
    {
      id: "v4_com_ca_kho",
      name: "Cơm cá kho",
      en: "Rice with braised fish",
      aliases: ["cơm cá kho", "com ca kho", "rice with braised fish"],
      perPortion: 570,
      defaultKcal: 570,
      defaultProtein: 32,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · cơm + cá kho",
    },
    {
      id: "v4_com_bo_luc_lac",
      name: "Cơm bò lúc lắc",
      en: "Shaking beef rice",
      aliases: [
        "cơm bò lúc lắc",
        "com bo luc lac",
        "shaking beef rice",
        "beef cubes rice",
      ],
      perPortion: 720,
      defaultKcal: 720,
      defaultProtein: 38,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · khẩu phần cơm bò",
    },
    {
      id: "v4_com_van_phong",
      name: "Suất cơm văn phòng",
      en: "Vietnamese office lunch rice set",
      aliases: [
        "cơm văn phòng",
        "suất cơm văn phòng",
        "suat com van phong",
        "office lunch rice",
        "rice set",
      ],
      perPortion: 650,
      defaultKcal: 650,
      defaultProtein: 28,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · suất cơm hỗn hợp",
    },
    {
      id: "v4_com_hop",
      name: "Cơm hộp",
      en: "Boxed rice meal",
      aliases: ["cơm hộp", "com hop", "boxed rice", "rice box"],
      perPortion: 650,
      defaultKcal: 650,
      defaultProtein: 28,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · cơm hộp hỗn hợp",
    },
    {
      id: "v4_com_rang_dua_bo",
      name: "Cơm rang dưa bò",
      en: "Fried rice with beef and pickled mustard greens",
      aliases: [
        "cơm rang dưa bò",
        "cơm chiên dưa bò",
        "com rang dua bo",
        "com chien dua bo",
        "fried rice beef pickled mustard greens",
      ],
      perPortion: 780,
      defaultKcal: 780,
      defaultProtein: 32,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · cơm rang nhiều dầu",
    },
    {
      id: "v4_com_rang_thap_cam",
      name: "Cơm rang thập cẩm",
      en: "Mixed fried rice",
      aliases: [
        "cơm rang thập cẩm",
        "cơm chiên thập cẩm",
        "com rang thap cam",
        "mixed fried rice",
      ],
      perPortion: 720,
      defaultKcal: 720,
      defaultProtein: 25,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · cơm rang",
    },
    {
      id: "v4_com_chien_hai_san",
      name: "Cơm chiên hải sản",
      en: "Seafood fried rice",
      aliases: [
        "cơm chiên hải sản",
        "cơm rang hải sản",
        "com chien hai san",
        "seafood fried rice",
      ],
      perPortion: 700,
      defaultKcal: 700,
      defaultProtein: 28,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · cơm chiên hải sản",
    },
    {
      id: "v4_com_chien_trung",
      name: "Cơm chiên trứng",
      en: "Egg fried rice",
      aliases: [
        "cơm chiên trứng",
        "cơm rang trứng",
        "com chien trung",
        "egg fried rice",
      ],
      perPortion: 620,
      defaultKcal: 620,
      defaultProtein: 18,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · cơm chiên trứng",
    },
    {
      id: "v4_com_nieu",
      name: "Cơm niêu",
      en: "Claypot rice meal",
      aliases: ["cơm niêu", "com nieu", "claypot rice"],
      perPortion: 700,
      defaultKcal: 700,
      defaultProtein: 25,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · suất cơm nhà hàng",
    },
    {
      id: "v4_com_chay",
      name: "Cơm chay",
      en: "Vegetarian rice meal",
      aliases: ["cơm chay", "com chay", "vegetarian rice meal"],
      perPortion: 560,
      defaultKcal: 560,
      defaultProtein: 18,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · cơm chay",
    },
    {
      id: "v4_bun_dau_mam_tom",
      name: "Bún đậu mắm tôm",
      en: "Rice vermicelli with fried tofu and shrimp paste",
      aliases: ["bún đậu mắm tôm", "bún đậu", "bun dau mam tom", "bun dau"],
      perPortion: 720,
      defaultKcal: 720,
      defaultProtein: 30,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · bún, đậu chiên, thịt/chả",
    },
    {
      id: "v4_bun_bo_nam_bo",
      name: "Bún bò Nam Bộ",
      en: "Southern beef vermicelli bowl",
      aliases: [
        "bún bò nam bộ",
        "bun bo nam bo",
        "southern beef vermicelli bowl",
        "beef vermicelli bowl",
      ],
      perBowl: 650,
      defaultKcal: 650,
      defaultProtein: 32,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · bún trộn bò",
    },
    {
      id: "v4_bun_hai_san",
      name: "Bún hải sản",
      en: "Seafood rice noodle soup",
      aliases: ["bún hải sản", "bun hai san", "seafood noodle soup"],
      perBowl: 520,
      defaultKcal: 520,
      defaultProtein: 32,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · bún nước hải sản",
    },
    {
      id: "v4_bun_ca_ro",
      name: "Bún cá rô",
      en: "Fish rice noodle soup",
      aliases: ["bún cá rô", "bun ca ro", "fish rice noodle soup"],
      perBowl: 480,
      defaultKcal: 480,
      defaultProtein: 30,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · bún cá",
    },
    {
      id: "v4_bun_cha_ca",
      name: "Bún chả cá",
      en: "Fish cake noodle soup",
      aliases: ["bún chả cá", "bun cha ca", "fish cake noodle soup"],
      perBowl: 500,
      defaultKcal: 500,
      defaultProtein: 28,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · bún chả cá",
    },
    {
      id: "v4_bun_thang",
      name: "Bún thang",
      en: "Hanoi bun thang noodle soup",
      aliases: ["bún thang", "bun thang", "hanoi noodle soup"],
      perBowl: 480,
      defaultKcal: 480,
      defaultProtein: 27,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · món Hà Nội",
    },
    {
      id: "v4_bun_mam",
      name: "Bún mắm",
      en: "Fermented fish noodle soup",
      aliases: ["bún mắm", "bun mam", "fermented fish noodle soup"],
      perBowl: 650,
      defaultKcal: 650,
      defaultProtein: 35,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · nước lèo, hải sản, thịt",
    },
    {
      id: "v4_bun_nuoc_leo",
      name: "Bún nước lèo",
      en: "Vietnamese fish broth noodle soup",
      aliases: ["bún nước lèo", "bun nuoc leo", "fish broth noodle soup"],
      perBowl: 560,
      defaultKcal: 560,
      defaultProtein: 30,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · bún nước lèo",
    },
    {
      id: "v4_bun_sua",
      name: "Bún sứa",
      en: "Jellyfish noodle soup",
      aliases: ["bún sứa", "bun sua", "jellyfish noodle soup"],
      perBowl: 420,
      defaultKcal: 420,
      defaultProtein: 24,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · bún sứa",
    },
    {
      id: "v4_pho_cuon",
      name: "Phở cuốn",
      en: "Fresh pho rolls",
      aliases: [
        "phở cuốn",
        "pho cuon",
        "fresh pho rolls",
        "vietnamese beef rolls",
      ],
      perUnit: 65,
      defaultKcal: 520,
      defaultProtein: 28,
      gramsPerUnit: 55,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · 1 cuốn khoảng 60–70 kcal",
    },
    {
      id: "v4_pho_xao_bo",
      name: "Phở xào bò",
      en: "Stir-fried pho noodles with beef",
      aliases: [
        "phở xào bò",
        "pho xao bo",
        "stir fried pho beef",
        "beef fried pho",
      ],
      perPortion: 800,
      defaultKcal: 800,
      defaultProtein: 34,
      rangePct: 0.24,
      source: "CSDL mở rộng V4 · món xào nhiều dầu",
    },
    {
      id: "v4_pho_tron",
      name: "Phở trộn",
      en: "Dry mixed pho noodles",
      aliases: ["phở trộn", "pho tron", "dry pho noodles", "mixed pho noodles"],
      perPortion: 620,
      defaultKcal: 620,
      defaultProtein: 30,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · phở trộn",
    },
    {
      id: "v4_mien_tron",
      name: "Miến trộn",
      en: "Mixed glass noodles",
      aliases: ["miến trộn", "mien tron", "mixed glass noodles"],
      perPortion: 560,
      defaultKcal: 560,
      defaultProtein: 26,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · miến trộn",
    },
    {
      id: "v4_mien_xao_cua",
      name: "Miến xào cua",
      en: "Stir-fried glass noodles with crab",
      aliases: ["miến xào cua", "mien xao cua", "crab glass noodles"],
      perPortion: 720,
      defaultKcal: 720,
      defaultProtein: 30,
      rangePct: 0.24,
      source: "CSDL mở rộng V4 · miến xào nhiều dầu",
    },
    {
      id: "v4_mien_ngan",
      name: "Miến ngan",
      en: "Muscovy duck glass noodle soup",
      aliases: ["miến ngan", "mien ngan", "duck glass noodle soup"],
      perBowl: 460,
      defaultKcal: 460,
      defaultProtein: 32,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · miến ngan",
    },
    {
      id: "v4_banh_da_cua",
      name: "Bánh đa cua",
      en: "Crab red noodle soup",
      aliases: ["bánh đa cua", "banh da cua", "crab red noodle soup"],
      perBowl: 520,
      defaultKcal: 520,
      defaultProtein: 28,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · món Hải Phòng",
    },
    {
      id: "v4_banh_canh_cua",
      name: "Bánh canh cua",
      en: "Crab thick noodle soup",
      aliases: ["bánh canh cua", "banh canh cua", "crab thick noodle soup"],
      perBowl: 620,
      defaultKcal: 620,
      defaultProtein: 32,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · bánh canh cua",
    },
    {
      id: "v4_hu_tieu_nam_vang",
      name: "Hủ tiếu Nam Vang",
      en: "Nam Vang noodle soup",
      aliases: ["hủ tiếu nam vang", "hu tieu nam vang", "nam vang noodle soup"],
      perBowl: 620,
      defaultKcal: 620,
      defaultProtein: 32,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · hủ tiếu",
    },
    {
      id: "v4_mi_vit_tiem",
      name: "Mì vịt tiềm",
      en: "Braised duck egg noodle soup",
      aliases: ["mì vịt tiềm", "mi vit tiem", "braised duck noodle soup"],
      perBowl: 780,
      defaultKcal: 780,
      defaultProtein: 38,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · mì vịt tiềm",
    },
    {
      id: "v4_mi_xao_bo",
      name: "Mì xào bò",
      en: "Stir-fried noodles with beef",
      aliases: [
        "mì xào bò",
        "mi xao bo",
        "beef stir fried noodles",
        "beef fried noodles",
      ],
      perPortion: 780,
      defaultKcal: 780,
      defaultProtein: 32,
      rangePct: 0.24,
      source: "CSDL mở rộng V4 · món xào nhiều dầu",
    },
    {
      id: "v4_chao_ga",
      name: "Cháo gà",
      en: "Chicken congee",
      aliases: ["cháo gà", "chao ga", "chicken congee"],
      perBowl: 330,
      defaultKcal: 330,
      defaultProtein: 22,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · cháo",
    },
    {
      id: "v4_chao_thit_bam",
      name: "Cháo thịt bằm",
      en: "Minced pork congee",
      aliases: [
        "cháo thịt bằm",
        "cháo thịt băm",
        "chao thit bam",
        "minced pork congee",
      ],
      perBowl: 350,
      defaultKcal: 350,
      defaultProtein: 20,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · cháo",
    },
    {
      id: "v4_chao_ca",
      name: "Cháo cá",
      en: "Fish congee",
      aliases: ["cháo cá", "chao ca", "fish congee"],
      perBowl: 320,
      defaultKcal: 320,
      defaultProtein: 22,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · cháo",
    },
    {
      id: "v4_chao_long",
      name: "Cháo lòng",
      en: "Pork offal congee",
      aliases: ["cháo lòng", "chao long", "pork offal congee"],
      perBowl: 420,
      defaultKcal: 420,
      defaultProtein: 24,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · cháo lòng",
    },
    {
      id: "v4_chao_trai",
      name: "Cháo trai",
      en: "Clam congee",
      aliases: ["cháo trai", "chao trai", "clam congee"],
      perBowl: 300,
      defaultKcal: 300,
      defaultProtein: 18,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · cháo",
    },
    {
      id: "v4_lau_thai",
      name: "Lẩu Thái",
      en: "Thai hotpot",
      aliases: ["lẩu thái", "lau thai", "thai hotpot"],
      perPortion: 650,
      defaultKcal: 650,
      defaultProtein: 38,
      rangePct: 0.3,
      source: "CSDL mở rộng V4 · 1 phần ăn cá nhân từ nồi lẩu",
    },
    {
      id: "v4_lau_hai_san",
      name: "Lẩu hải sản",
      en: "Seafood hotpot",
      aliases: ["lẩu hải sản", "lau hai san", "seafood hotpot"],
      perPortion: 600,
      defaultKcal: 600,
      defaultProtein: 42,
      rangePct: 0.3,
      source: "CSDL mở rộng V4 · 1 phần ăn cá nhân",
    },
    {
      id: "v4_lau_bo",
      name: "Lẩu bò",
      en: "Beef hotpot",
      aliases: ["lẩu bò", "lau bo", "beef hotpot"],
      perPortion: 700,
      defaultKcal: 700,
      defaultProtein: 40,
      rangePct: 0.3,
      source: "CSDL mở rộng V4 · 1 phần ăn cá nhân",
    },
    {
      id: "v4_ga_luoc",
      name: "Gà luộc",
      en: "Boiled chicken",
      aliases: ["gà luộc", "ga luoc", "boiled chicken"],
      per100g: 165,
      perPortion: 250,
      defaultKcal: 250,
      protein100g: 27,
      defaultProtein: 40,
      rangePct: 0.12,
      source: "CSDL mở rộng V4 · thịt gà chín",
    },
    {
      id: "v4_ga_rang_gung",
      name: "Gà rang gừng",
      en: "Vietnamese ginger chicken",
      aliases: ["gà rang gừng", "ga rang gung", "ginger chicken"],
      per100g: 230,
      perPortion: 420,
      defaultKcal: 420,
      protein100g: 24,
      defaultProtein: 36,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · món rang có dầu",
    },
    {
      id: "v4_ga_kho",
      name: "Gà kho",
      en: "Braised chicken",
      aliases: ["gà kho", "ga kho", "braised chicken"],
      per100g: 220,
      perPortion: 380,
      defaultKcal: 380,
      protein100g: 25,
      defaultProtein: 36,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · gà kho",
    },
    {
      id: "v4_canh_ga_nuong",
      name: "Cánh gà nướng",
      en: "Grilled chicken wings",
      aliases: [
        "cánh gà nướng",
        "canh ga nuong",
        "grilled chicken wings",
        "chicken wings",
      ],
      perUnit: 110,
      defaultKcal: 330,
      defaultProtein: 28,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · 1 cánh khoảng 100–120 kcal",
    },
    {
      id: "v4_chan_ga",
      name: "Chân gà",
      en: "Chicken feet",
      aliases: ["chân gà", "chan ga", "chicken feet"],
      perUnit: 80,
      defaultKcal: 240,
      defaultProtein: 18,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · phụ thuộc sốt/ngâm",
    },
    {
      id: "v4_bo_luc_lac",
      name: "Bò lúc lắc",
      en: "Shaking beef",
      aliases: ["bò lúc lắc", "bo luc lac", "shaking beef"],
      perPortion: 520,
      defaultKcal: 520,
      defaultProtein: 42,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · bò xào dầu/sốt",
    },
    {
      id: "v4_bo_kho",
      name: "Bò kho",
      en: "Vietnamese beef stew",
      aliases: ["bò kho", "bo kho", "vietnamese beef stew"],
      perBowl: 480,
      defaultKcal: 480,
      defaultProtein: 35,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · chưa gồm bánh mì nếu ăn kèm",
    },
    {
      id: "v4_bo_sot_vang",
      name: "Bò sốt vang",
      en: "Vietnamese beef stew with wine sauce",
      aliases: ["bò sốt vang", "bo sot vang", "beef stew wine sauce"],
      perBowl: 520,
      defaultKcal: 520,
      defaultProtein: 35,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · chưa gồm bánh mì nếu ăn kèm",
    },
    {
      id: "v4_bo_nuong",
      name: "Bò nướng",
      en: "Grilled beef",
      aliases: ["bò nướng", "bo nuong", "grilled beef"],
      per100g: 240,
      perPortion: 420,
      defaultKcal: 420,
      protein100g: 26,
      defaultProtein: 45,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · bò nướng",
    },
    {
      id: "v4_thit_luoc",
      name: "Thịt lợn luộc",
      en: "Boiled pork",
      aliases: [
        "thịt luộc",
        "thịt lợn luộc",
        "thịt heo luộc",
        "thit luoc",
        "boiled pork",
      ],
      per100g: 250,
      perPortion: 375,
      defaultKcal: 375,
      protein100g: 22,
      defaultProtein: 33,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · phụ thuộc nạc/mỡ",
    },
    {
      id: "v4_thit_nuong",
      name: "Thịt nướng",
      en: "Grilled pork",
      aliases: ["thịt nướng", "thit nuong", "grilled pork"],
      per100g: 290,
      perPortion: 480,
      defaultKcal: 480,
      protein100g: 24,
      defaultProtein: 40,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · thịt ướp/nướng",
    },
    {
      id: "v4_suon_nuong",
      name: "Sườn nướng",
      en: "Grilled pork ribs",
      aliases: ["sườn nướng", "suon nuong", "grilled pork ribs"],
      per100g: 300,
      perPortion: 520,
      defaultKcal: 520,
      protein100g: 22,
      defaultProtein: 38,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · sườn có xương/sốt",
    },
    {
      id: "v4_nem_nuong",
      name: "Nem nướng",
      en: "Vietnamese grilled pork sausage",
      aliases: ["nem nướng", "nem nuong", "grilled pork sausage"],
      perPortion: 450,
      defaultKcal: 450,
      defaultProtein: 30,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · nem nướng",
    },
    {
      id: "v4_ca_hoi_ap_chao",
      name: "Cá hồi áp chảo",
      en: "Pan-seared salmon",
      aliases: [
        "cá hồi áp chảo",
        "ca hoi ap chao",
        "pan seared salmon",
        "seared salmon",
      ],
      per100g: 230,
      perPortion: 410,
      defaultKcal: 410,
      protein100g: 22,
      defaultProtein: 40,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · cá hồi + dầu áp chảo",
    },
    {
      id: "v4_ca_basa",
      name: "Cá basa",
      en: "Basa fish",
      aliases: ["cá basa", "ca basa", "basa fish", "pangasius"],
      per100g: 120,
      perPortion: 220,
      defaultKcal: 220,
      protein100g: 20,
      defaultProtein: 36,
      rangePct: 0.16,
      source: "CSDL mở rộng V4 · cá trắng",
    },
    {
      id: "v4_ca_thu",
      name: "Cá thu",
      en: "Mackerel",
      aliases: ["cá thu", "ca thu", "mackerel"],
      per100g: 205,
      perPortion: 330,
      defaultKcal: 330,
      protein100g: 23,
      defaultProtein: 37,
      rangePct: 0.16,
      source: "CSDL mở rộng V4 · cá béo",
    },
    {
      id: "v4_muc_xao",
      name: "Mực xào",
      en: "Stir-fried squid",
      aliases: ["mực xào", "muc xao", "stir fried squid"],
      perPortion: 360,
      defaultKcal: 360,
      defaultProtein: 30,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · mực xào dầu",
    },
    {
      id: "v4_tom_hap",
      name: "Tôm hấp",
      en: "Steamed shrimp",
      aliases: ["tôm hấp", "tom hap", "steamed shrimp"],
      per100g: 100,
      perPortion: 180,
      defaultKcal: 180,
      protein100g: 24,
      defaultProtein: 43,
      rangePct: 0.12,
      source: "CSDL mở rộng V4 · tôm hấp",
    },
    {
      id: "v4_hai_san_nuong",
      name: "Hải sản nướng",
      en: "Grilled seafood",
      aliases: ["hải sản nướng", "hai san nuong", "grilled seafood"],
      perPortion: 450,
      defaultKcal: 450,
      defaultProtein: 42,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · phụ thuộc bơ/sốt",
    },
    {
      id: "v4_rau_muong_xao_toi",
      name: "Rau muống xào tỏi",
      en: "Stir-fried water spinach with garlic",
      aliases: [
        "rau muống xào tỏi",
        "rau muong xao toi",
        "stir fried water spinach",
      ],
      perPortion: 180,
      defaultKcal: 180,
      defaultProtein: 5,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · dầu xào quyết định calo",
    },
    {
      id: "v4_rau_cai_luoc",
      name: "Rau cải luộc",
      en: "Boiled leafy greens",
      aliases: [
        "rau cải luộc",
        "rau luộc",
        "rau cai luoc",
        "boiled vegetables",
        "boiled greens",
      ],
      perPortion: 70,
      defaultKcal: 70,
      defaultProtein: 4,
      rangePct: 0.15,
      source: "CSDL mở rộng V4 · rau luộc",
    },
    {
      id: "v4_salad_dau_giam",
      name: "Salad dầu giấm",
      en: "Vinaigrette salad",
      aliases: ["salad dầu giấm", "salad dau giam", "vinaigrette salad"],
      perPortion: 180,
      defaultKcal: 180,
      defaultProtein: 4,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · sốt quyết định calo",
    },
    {
      id: "v4_canh_rau",
      name: "Canh rau",
      en: "Vegetable soup",
      aliases: ["canh rau", "vegetable soup"],
      perBowl: 80,
      defaultKcal: 80,
      defaultProtein: 4,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · canh rau",
    },
    {
      id: "v4_canh_bi_do",
      name: "Canh bí đỏ",
      en: "Pumpkin soup",
      aliases: ["canh bí đỏ", "canh bi do", "pumpkin soup"],
      perBowl: 120,
      defaultKcal: 120,
      defaultProtein: 5,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · canh bí đỏ",
    },
    {
      id: "v4_canh_mong_toi",
      name: "Canh mồng tơi",
      en: "Malabar spinach soup",
      aliases: ["canh mồng tơi", "canh mong toi", "malabar spinach soup"],
      perBowl: 70,
      defaultKcal: 70,
      defaultProtein: 4,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · canh rau",
    },
    {
      id: "v4_che_buoi",
      name: "Chè bưởi",
      en: "Pomelo sweet soup",
      aliases: ["chè bưởi", "che buoi", "pomelo sweet soup"],
      perCup: 320,
      defaultKcal: 320,
      defaultProtein: 5,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · chè ngọt",
    },
    {
      id: "v4_che_do_den",
      name: "Chè đỗ đen",
      en: "Black bean sweet soup",
      aliases: [
        "chè đỗ đen",
        "chè đậu đen",
        "che do den",
        "black bean sweet soup",
      ],
      perCup: 300,
      defaultKcal: 300,
      defaultProtein: 9,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · chè đậu",
    },
    {
      id: "v4_che_thai",
      name: "Chè Thái",
      en: "Thai-style Vietnamese dessert",
      aliases: ["chè thái", "che thai", "thai dessert"],
      perCup: 420,
      defaultKcal: 420,
      defaultProtein: 5,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · nước cốt dừa/sữa",
    },
    {
      id: "v4_banh_flan",
      name: "Bánh flan",
      en: "Crème caramel",
      aliases: ["bánh flan", "flan", "creme caramel"],
      perUnit: 160,
      defaultKcal: 160,
      defaultProtein: 5,
      rangePct: 0.15,
      source: "CSDL mở rộng V4 · 1 hộp nhỏ",
    },
    {
      id: "v4_khoai_lang_ken",
      name: "Khoai lang kén",
      en: "Fried sweet potato balls",
      aliases: ["khoai lang kén", "khoai lang ken", "fried sweet potato balls"],
      perPortion: 350,
      defaultKcal: 350,
      defaultProtein: 5,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · món chiên",
    },
    {
      id: "v4_sua_chua_nep_cam",
      name: "Sữa chua nếp cẩm",
      en: "Yogurt with black sticky rice",
      aliases: [
        "sữa chua nếp cẩm",
        "sua chua nep cam",
        "yogurt black sticky rice",
      ],
      perCup: 230,
      defaultKcal: 230,
      defaultProtein: 6,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · cốc nhỏ",
    },
    {
      id: "v4_mochi",
      name: "Mochi",
      en: "Mochi",
      aliases: ["mochi", "bánh mochi"],
      perUnit: 90,
      defaultKcal: 90,
      defaultProtein: 1,
      rangePct: 0.15,
      source: "CSDL mở rộng V4 · 1 viên",
    },
    {
      id: "v4_sau_rieng",
      name: "Sầu riêng",
      en: "Durian",
      aliases: ["sầu riêng", "sau rieng", "durian"],
      per100g: 147,
      perUnit: 250,
      defaultKcal: 250,
      protein100g: 1.5,
      rangePct: 0.1,
      source: "CSDL mở rộng V4 · trái cây",
    },
    {
      id: "v4_vai",
      name: "Vải",
      en: "Lychee",
      aliases: ["vải", "vai", "lychee"],
      per100g: 66,
      perUnit: 7,
      defaultKcal: 100,
      protein100g: 0.8,
      rangePct: 0.1,
      source: "CSDL mở rộng V4 · trái cây",
    },
    {
      id: "v4_nhan",
      name: "Nhãn",
      en: "Longan",
      aliases: ["nhãn", "nhan", "longan"],
      per100g: 60,
      perUnit: 6,
      defaultKcal: 90,
      protein100g: 1.3,
      rangePct: 0.1,
      source: "CSDL mở rộng V4 · trái cây",
    },
    {
      id: "v4_chom_chom",
      name: "Chôm chôm",
      en: "Rambutan",
      aliases: ["chôm chôm", "chom chom", "rambutan"],
      per100g: 68,
      perUnit: 7,
      defaultKcal: 100,
      protein100g: 0.9,
      rangePct: 0.1,
      source: "CSDL mở rộng V4 · trái cây",
    },
    {
      id: "v4_kiwi",
      name: "Kiwi",
      en: "Kiwi fruit",
      aliases: ["kiwi", "kiwi fruit"],
      per100g: 61,
      perUnit: 45,
      defaultKcal: 45,
      protein100g: 1.1,
      rangePct: 0.08,
      source: "CSDL mở rộng V4 · trái cây",
    },
    {
      id: "v4_le",
      name: "Lê",
      en: "Pear",
      aliases: ["lê", "le", "pear"],
      per100g: 57,
      perUnit: 100,
      defaultKcal: 100,
      protein100g: 0.4,
      rangePct: 0.08,
      source: "CSDL mở rộng V4 · trái cây",
    },
    {
      id: "v4_oatmeal_milk",
      name: "Yến mạch nấu sữa",
      en: "Oatmeal with milk",
      aliases: ["yến mạch nấu sữa", "oatmeal with milk", "porridge oats milk"],
      perBowl: 320,
      defaultKcal: 320,
      defaultProtein: 14,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · yến mạch + sữa",
    },
    {
      id: "v4_granola",
      name: "Granola",
      en: "Granola",
      aliases: ["granola"],
      per100g: 470,
      perCup: 420,
      defaultKcal: 230,
      protein100g: 10,
      rangePct: 0.15,
      source: "CSDL mở rộng V4 · phụ thuộc hãng",
    },
    {
      id: "v4_cereal_milk",
      name: "Ngũ cốc ăn sáng với sữa",
      en: "Breakfast cereal with milk",
      aliases: ["ngũ cốc ăn sáng", "cereal with milk", "breakfast cereal milk"],
      perBowl: 330,
      defaultKcal: 330,
      defaultProtein: 11,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · cereal + sữa",
    },
    {
      id: "v4_bagel",
      name: "Bagel",
      en: "Bagel",
      aliases: ["bagel", "bánh bagel"],
      perUnit: 280,
      defaultKcal: 280,
      defaultProtein: 10,
      rangePct: 0.12,
      source: "CSDL mở rộng V4 · bánh mì kiểu Mỹ",
    },
    {
      id: "v4_waffle",
      name: "Waffle",
      en: "Waffle",
      aliases: ["waffle", "bánh waffle"],
      perUnit: 220,
      defaultKcal: 440,
      defaultProtein: 9,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · chưa gồm siro nhiều",
    },
    {
      id: "v4_french_toast",
      name: "French toast",
      en: "French toast",
      aliases: ["french toast", "bánh mì trứng sữa áp chảo"],
      perPortion: 450,
      defaultKcal: 450,
      defaultProtein: 14,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · bánh mì + trứng + bơ",
    },
    {
      id: "v4_avocado_toast",
      name: "Avocado toast",
      en: "Avocado toast",
      aliases: ["avocado toast", "bánh mì bơ avocado", "toast bơ"],
      perPortion: 380,
      defaultKcal: 380,
      defaultProtein: 10,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · bánh mì + avocado",
    },
    {
      id: "v4_peanut_butter",
      name: "Bơ đậu phộng",
      en: "Peanut butter",
      aliases: ["bơ đậu phộng", "bo dau phong", "peanut butter"],
      per100g: 588,
      perTbsp: 95,
      defaultKcal: 95,
      protein100g: 25,
      rangePct: 0.08,
      source: "CSDL mở rộng V4 · USDA/nhãn sản phẩm",
    },
    {
      id: "v4_almond_butter",
      name: "Bơ hạnh nhân",
      en: "Almond butter",
      aliases: ["bơ hạnh nhân", "almond butter"],
      per100g: 614,
      perTbsp: 100,
      defaultKcal: 100,
      protein100g: 21,
      rangePct: 0.08,
      source: "CSDL mở rộng V4 · USDA/nhãn sản phẩm",
    },
    {
      id: "v4_protein_bar",
      name: "Protein bar",
      en: "Protein bar",
      aliases: ["protein bar", "thanh protein", "thanh đạm"],
      perUnit: 220,
      defaultKcal: 220,
      defaultProtein: 20,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · phụ thuộc hãng",
    },
    {
      id: "v4_burrito",
      name: "Burrito",
      en: "Burrito",
      aliases: ["burrito", "bánh burrito"],
      perUnit: 700,
      defaultKcal: 700,
      defaultProtein: 32,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · tortilla, thịt, cơm, sốt",
    },
    {
      id: "v4_taco_beef",
      name: "Beef taco",
      en: "Beef taco",
      aliases: ["beef taco", "taco bò", "taco"],
      perUnit: 220,
      defaultKcal: 440,
      defaultProtein: 18,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · 1 taco khoảng 200–240 kcal",
    },
    {
      id: "v4_quesadilla",
      name: "Quesadilla",
      en: "Quesadilla",
      aliases: ["quesadilla", "bánh quesadilla"],
      perPortion: 650,
      defaultKcal: 650,
      defaultProtein: 30,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · tortilla + phô mai",
    },
    {
      id: "v4_club_sandwich",
      name: "Club sandwich",
      en: "Club sandwich",
      aliases: ["club sandwich", "sandwich gà bacon"],
      perUnit: 650,
      defaultKcal: 650,
      defaultProtein: 35,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · sandwich nhiều tầng",
    },
    {
      id: "v4_tuna_sandwich",
      name: "Tuna sandwich",
      en: "Tuna sandwich",
      aliases: ["tuna sandwich", "sandwich cá ngừ"],
      perUnit: 480,
      defaultKcal: 480,
      defaultProtein: 30,
      defaultCarbs: 42,
      defaultFat: 21,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · phụ thuộc mayo",
    },
    {
      id: "v4_grilled_cheese",
      name: "Grilled cheese sandwich",
      en: "Grilled cheese sandwich",
      aliases: [
        "grilled cheese",
        "grilled cheese sandwich",
        "sandwich phô mai áp chảo",
      ],
      perUnit: 420,
      defaultKcal: 420,
      defaultProtein: 15,
      defaultCarbs: 38,
      defaultFat: 23,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · bánh mì + phô mai + bơ",
    },
    {
      id: "v4_doner_kebab",
      name: "Doner kebab",
      en: "Doner kebab",
      aliases: ["doner kebab", "kebab", "bánh kebab"],
      perUnit: 700,
      defaultKcal: 700,
      defaultProtein: 35,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · bánh, thịt, sốt",
    },
    {
      id: "v4_gyro",
      name: "Gyro",
      en: "Gyro",
      aliases: ["gyro", "greek gyro"],
      perUnit: 650,
      defaultKcal: 650,
      defaultProtein: 32,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · pita + thịt + sốt",
    },
    {
      id: "v4_chicken_alfredo",
      name: "Chicken Alfredo pasta",
      en: "Chicken Alfredo pasta",
      aliases: ["chicken alfredo", "pasta alfredo gà", "mì ý sốt kem gà"],
      perPortion: 850,
      defaultKcal: 850,
      defaultProtein: 42,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · sốt kem/phô mai",
    },
    {
      id: "v4_mac_cheese",
      name: "Mac and cheese",
      en: "Macaroni and cheese",
      aliases: ["mac and cheese", "macaroni and cheese", "mì nui phô mai"],
      perPortion: 650,
      defaultKcal: 650,
      defaultProtein: 22,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · pasta + cheese",
    },
    {
      id: "v4_lasagna",
      name: "Lasagna",
      en: "Lasagna",
      aliases: ["lasagna", "mì lasagna"],
      perPortion: 620,
      defaultKcal: 620,
      defaultProtein: 32,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · khẩu phần nhà hàng",
    },
    {
      id: "v4_mashed_potatoes",
      name: "Khoai tây nghiền",
      en: "Mashed potatoes",
      aliases: ["khoai tây nghiền", "mashed potatoes"],
      perPortion: 240,
      defaultKcal: 240,
      defaultProtein: 5,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · bơ/sữa quyết định calo",
    },
    {
      id: "v4_hash_browns",
      name: "Hash browns",
      en: "Hash browns",
      aliases: ["hash browns", "khoai tây bào chiên"],
      perPortion: 320,
      defaultKcal: 320,
      defaultProtein: 4,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · khoai chiên",
    },
    {
      id: "v4_chicken_nuggets",
      name: "Chicken nuggets",
      en: "Chicken nuggets",
      aliases: ["chicken nuggets", "nuggets gà", "gà viên chiên"],
      perUnit: 48,
      defaultKcal: 290,
      defaultProtein: 18,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · 1 miếng khoảng 45–50 kcal",
    },
    {
      id: "v4_buffalo_wings",
      name: "Buffalo wings",
      en: "Buffalo wings",
      aliases: ["buffalo wings", "cánh gà buffalo", "cánh gà sốt cay"],
      perUnit: 100,
      defaultKcal: 500,
      defaultProtein: 36,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · sốt/dầu thay đổi lớn",
    },
    {
      id: "v4_hot_dog",
      name: "Hot dog",
      en: "Hot dog",
      aliases: ["hot dog", "bánh mì xúc xích"],
      perUnit: 330,
      defaultKcal: 330,
      defaultProtein: 12,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · 1 cái tiêu chuẩn",
    },
    {
      id: "v4_quinoa_salad",
      name: "Quinoa salad",
      en: "Quinoa salad",
      aliases: ["quinoa salad", "salad quinoa"],
      perPortion: 430,
      defaultKcal: 430,
      defaultProtein: 14,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · sốt/dầu quyết định",
    },
    {
      id: "v4_greek_salad",
      name: "Greek salad",
      en: "Greek salad",
      aliases: ["greek salad", "salad hy lạp"],
      perPortion: 350,
      defaultKcal: 350,
      defaultProtein: 12,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · phô mai feta/dầu olive",
    },
    {
      id: "v4_poke_bowl",
      name: "Poke bowl",
      en: "Poke bowl",
      aliases: ["poke bowl", "cơm poke", "poke"],
      perBowl: 650,
      defaultKcal: 650,
      defaultProtein: 35,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · cơm + cá + sốt",
    },
    {
      id: "v4_latte",
      name: "Latte",
      en: "Latte",
      aliases: ["latte", "cafe latte", "cà phê latte"],
      perCup: 190,
      defaultKcal: 190,
      defaultProtein: 10,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · phụ thuộc sữa/đường",
    },
    {
      id: "v4_cappuccino",
      name: "Cappuccino",
      en: "Cappuccino",
      aliases: ["cappuccino", "cà phê cappuccino"],
      perCup: 120,
      defaultKcal: 120,
      defaultProtein: 6,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · phụ thuộc sữa/đường",
    },
    {
      id: "v4_fruit_smoothie",
      name: "Sinh tố trái cây",
      en: "Fruit smoothie",
      aliases: ["sinh tố trái cây", "fruit smoothie", "smoothie"],
      perCup: 280,
      defaultKcal: 280,
      defaultProtein: 5,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · sữa/đường quyết định",
    },
    {
      id: "v4_donut",
      name: "Donut",
      en: "Donut",
      aliases: ["donut", "doughnut", "bánh donut"],
      perUnit: 260,
      defaultKcal: 260,
      defaultProtein: 4,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · bánh ngọt",
    },
    {
      id: "v4_muffin",
      name: "Muffin",
      en: "Muffin",
      aliases: ["muffin", "bánh muffin"],
      perUnit: 420,
      defaultKcal: 420,
      defaultProtein: 7,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · bánh ngọt",
    },
    {
      id: "v4_brownie",
      name: "Brownie",
      en: "Brownie",
      aliases: ["brownie", "bánh brownie"],
      perUnit: 300,
      defaultKcal: 300,
      defaultProtein: 4,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · bánh chocolate",
    },
    {
      id: "v4_cheesecake",
      name: "Cheesecake",
      en: "Cheesecake",
      aliases: ["cheesecake", "bánh phô mai"],
      perSlice: 420,
      defaultKcal: 420,
      defaultProtein: 7,
      defaultCarbs: 42,
      defaultFat: 25,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · 1 lát",
    },
    {
      id: "v4_tiramisu",
      name: "Tiramisu",
      en: "Tiramisu",
      aliases: ["tiramisu", "bánh tiramisu"],
      perSlice: 380,
      defaultKcal: 380,
      defaultProtein: 6,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · 1 lát",
    },
    {
      id: "v4_bibimbap",
      name: "Bibimbap",
      en: "Bibimbap",
      aliases: ["bibimbap", "cơm trộn hàn quốc", "korean mixed rice"],
      perBowl: 650,
      defaultKcal: 650,
      defaultProtein: 28,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · cơm trộn Hàn Quốc",
    },
    {
      id: "v4_kimbap",
      name: "Kimbap",
      en: "Kimbap",
      aliases: ["kimbap", "gimbap", "cơm cuộn hàn quốc"],
      perUnit: 55,
      defaultKcal: 440,
      defaultProtein: 16,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · 1 miếng khoảng 50–60 kcal",
    },
    {
      id: "v4_tteokbokki",
      name: "Tteokbokki",
      en: "Tteokbokki",
      aliases: ["tteokbokki", "tokbokki", "bánh gạo cay hàn quốc"],
      perPortion: 520,
      defaultKcal: 520,
      defaultProtein: 10,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · bánh gạo + sốt",
    },
    {
      id: "v4_kimchi",
      name: "Kimchi",
      en: "Kimchi",
      aliases: ["kimchi", "kim chi"],
      per100g: 25,
      perPortion: 25,
      defaultKcal: 25,
      protein100g: 1.5,
      rangePct: 0.15,
      source: "CSDL mở rộng V4 · món lên men",
    },
    {
      id: "v4_sashimi_salmon",
      name: "Sashimi cá hồi",
      en: "Salmon sashimi",
      aliases: ["sashimi cá hồi", "salmon sashimi", "sashimi"],
      per100g: 208,
      perUnit: 40,
      defaultKcal: 240,
      protein100g: 20,
      defaultProtein: 24,
      rangePct: 0.12,
      source: "CSDL mở rộng V4 · cá hồi sống",
    },
    {
      id: "v4_tempura",
      name: "Tempura",
      en: "Tempura",
      aliases: ["tempura", "tôm tempura"],
      perPortion: 450,
      defaultKcal: 450,
      defaultProtein: 18,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · đồ chiên bột",
    },
    {
      id: "v4_yakitori",
      name: "Yakitori",
      en: "Yakitori chicken skewers",
      aliases: ["yakitori", "xiên gà nhật", "japanese chicken skewers"],
      perUnit: 110,
      defaultKcal: 330,
      defaultProtein: 24,
      rangePct: 0.18,
      source: "CSDL mở rộng V4 · 1 xiên",
    },
    {
      id: "v4_dumplings_fried",
      name: "Há cảo/mandu chiên",
      en: "Fried dumplings",
      aliases: [
        "há cảo chiên",
        "sủi cảo chiên",
        "mandu chiên",
        "fried dumplings",
        "fried gyoza",
      ],
      perUnit: 70,
      defaultKcal: 420,
      defaultProtein: 18,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · 1 miếng khoảng 65–75 kcal",
    },
    {
      id: "v4_wonton_soup",
      name: "Súp hoành thánh",
      en: "Wonton soup",
      aliases: ["súp hoành thánh", "hoành thánh nước", "wonton soup"],
      perBowl: 350,
      defaultKcal: 350,
      defaultProtein: 20,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · hoành thánh nước",
    },
    {
      id: "v4_mapo_tofu",
      name: "Đậu phụ sốt Tứ Xuyên (Mapo tofu)",
      en: "Mapo tofu",
      aliases: ["đậu phụ sốt Tứ Xuyên", "đậu phụ mapo", "mapo tofu", "ma po tofu"],
      perPortion: 420,
      defaultKcal: 420,
      defaultProtein: 22,
      defaultCarbs: 25,
      defaultFat: 26,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · đậu phụ + thịt bằm + dầu",
    },
    {
      id: "v4_peking_duck",
      name: "Vịt quay Bắc Kinh",
      en: "Peking duck",
      aliases: ["vịt quay bắc kinh", "peking duck"],
      perPortion: 650,
      defaultKcal: 650,
      defaultProtein: 35,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · gồm da/vỏ/sốt nếu ăn kèm",
    },
    {
      id: "v4_tom_yum",
      name: "Tom Yum",
      en: "Tom Yum soup",
      aliases: ["tom yum", "tom yum soup", "canh chua thái"],
      perBowl: 180,
      defaultKcal: 180,
      defaultProtein: 16,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · súp Thái",
    },
    {
      id: "v4_green_curry",
      name: "Cà ri xanh Thái",
      en: "Thai green curry",
      aliases: ["cà ri xanh thái", "thai green curry", "green curry"],
      perPortion: 520,
      defaultKcal: 520,
      defaultProtein: 25,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · nước cốt dừa",
    },
    {
      id: "v4_som_tam",
      name: "Som tam",
      en: "Thai papaya salad",
      aliases: ["som tam", "gỏi đu đủ thái", "thai papaya salad"],
      perPortion: 180,
      defaultKcal: 180,
      defaultProtein: 6,
      rangePct: 0.2,
      source: "CSDL mở rộng V4 · salad đu đủ",
    },
    {
      id: "v4_nasi_goreng",
      name: "Nasi goreng",
      en: "Nasi goreng",
      aliases: ["nasi goreng", "cơm chiên indonesia"],
      perPortion: 750,
      defaultKcal: 750,
      defaultProtein: 28,
      rangePct: 0.22,
      source: "CSDL mở rộng V4 · cơm chiên Indonesia",
    },
    {
      id: "v4_beef_rendang",
      name: "Rendang bò",
      en: "Beef rendang",
      aliases: ["rendang bò", "beef rendang", "rendang"],
      perPortion: 550,
      defaultKcal: 550,
      defaultProtein: 35,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · bò + nước cốt dừa",
    },
    {
      id: "v4_laksa",
      name: "Laksa",
      en: "Laksa noodle soup",
      aliases: ["laksa", "laksa noodle soup"],
      perBowl: 700,
      defaultKcal: 700,
      defaultProtein: 28,
      rangePct: 0.25,
      source: "CSDL mở rộng V4 · nước cốt dừa + mì",
    },
  ];

  // ===== CSDL ƯU TIÊN V6: các món người dùng thường ăn =====
  function v6Food100g(d) {
    const g = Number(d.defaultGrams || 100), factor = g / 100;
    return {
      id:d.id, name:d.name, en:d.en, aliases:d.aliases || [],
      per100g:d.kcal, protein100g:d.protein, carbs100g:d.carbs, fat100g:d.fat,
      defaultKcal:Math.round(d.kcal * factor), defaultProtein:d.protein * factor,
      defaultCarbs:d.carbs * factor, defaultFat:d.fat * factor, defaultGrams:g,
      gramsPerUnit:d.gramsPerUnit, perUnit:d.perUnit, perTbsp:d.perTbsp,
      methodClass:d.methodClass || null, allowCookingMethod:d.allowCookingMethod !== false,
      rangePct:d.rangePct || 0, rangeNote:d.rangeNote || "tùy nguyên liệu, dầu và sốt",
      nonMacroEnergy:!!d.nonMacroEnergy, priority:500, source:d.source
    };
  }
  function v6Food100ml(d) {
    const ml = Number(d.defaultMl || 240), factor = ml / 100;
    return {
      id:d.id, name:d.name, en:d.en, aliases:d.aliases || [],
      per100ml:d.kcal, protein100ml:d.protein, carbs100ml:d.carbs, fat100ml:d.fat,
      defaultKcal:Math.round(d.kcal * factor), defaultProtein:d.protein * factor,
      defaultCarbs:d.carbs * factor, defaultFat:d.fat * factor, defaultMl:ml,
      perCan:d.perCan, nonMacroEnergy:!!d.nonMacroEnergy, allowCookingMethod:false,
      rangePct:d.rangePct || 0, rangeNote:d.rangeNote || "tùy nhãn sản phẩm", priority:500, source:d.source
    };
  }
  function v6FoodPortion(d) {
    const grams = Number(d.grams || 1), factor = 100 / grams;
    const x = {
      id:d.id, name:d.name, en:d.en, aliases:d.aliases || [],
      per100g:d.kcal * factor, protein100g:d.protein * factor,
      carbs100g:d.carbs * factor, fat100g:d.fat * factor,
      perPortion:d.kcal, defaultKcal:d.kcal, defaultProtein:d.protein,
      defaultCarbs:d.carbs, defaultFat:d.fat, defaultGrams:grams,
      methodClass:d.methodClass || null, allowCookingMethod:!!d.allowCookingMethod,
      rangePct:d.rangePct || 0, rangeNote:d.rangeNote || "tùy khẩu phần, dầu và sốt",
      nonMacroEnergy:!!d.nonMacroEnergy, priority:500, source:d.source
    };
    if (d.unit === "bowl") x.perBowl = d.kcal;
    if (d.unit === "cup") x.perCup = d.kcal;
    if (d.unit === "slice") x.perSlice = d.kcal;
    if (d.unit === "pack") x.perPack = d.kcal;
    if (d.unit === "can") x.perCan = d.kcal;
    if (d.unit === "unit") x.perUnit = Number.isFinite(d.perUnit) ? d.perUnit : d.kcal;
    if (Number.isFinite(d.gramsPerUnit)) x.gramsPerUnit = d.gramsPerUnit;
    return x;
  }
  const USER_FOOD_DB_V6 = [
    v6Food100g({"id":"u7_roast_duck","name":"Vịt quay","en":"Chinese-style roast duck","aliases":["vịt quay","vit quay","vịt quay bắc kinh","vit quay bac kinh","roast duck","roasted duck","peking duck","chinese roast duck"],"protein":19,"carbs":4,"fat":28,"kcal":344,"source":"CSDL ưu tiên V7 · thịt vịt quay có da, giá trị trung bình theo 100 g","rangePct":0.18,"defaultGrams":180,"methodClass":"fattyProtein","allowCookingMethod":false}),
    v6FoodPortion({"id":"u7_mi_vit_quay","name":"Mì vịt quay","en":"Roast duck egg noodle soup","aliases":["mì vịt quay","mỳ vịt quay","mi vit quay","my vit quay","1 bát mì vịt quay","mì trứng vịt quay","roast duck noodles","roast duck noodle soup","duck noodle soup"],"protein":31,"carbs":72,"fat":25,"kcal":637,"source":"CSDL ưu tiên V7 · khẩu phần mì, vịt quay và nước dùng ước tính","rangePct":0.18,"grams":560,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u7_pho_bo_bowl","name":"Phở bò","en":"Beef pho noodle soup","aliases":["1 bát phở bò","một bát phở bò","1 tô phở bò","một tô phở bò","bát phở bò","tô phở bò"],"protein":28,"carbs":58,"fat":14,"kcal":470,"source":"CSDL ưu tiên V7 · khẩu phần phở bò hoàn chỉnh ước tính","rangePct":0.18,"grams":500,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u7_bun_ngan_bowl","name":"Bún ngan","en":"Rice vermicelli soup with Muscovy duck","aliases":["1 bát bún ngan","một bát bún ngan","1 tô bún ngan","một tô bún ngan","bát bún ngan","tô bún ngan"],"protein":29,"carbs":68,"fat":19,"kcal":559,"source":"CSDL ưu tiên V7 · khẩu phần bún ngan hoàn chỉnh ước tính","rangePct":0.18,"grams":540,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_pho_bo","name":"Phở bò","en":"Beef pho noodle soup","aliases":["phở bò","pho bo","beef pho","beef pho noodle soup"],"protein":28,"carbs":58,"fat":14,"kcal":470,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":500,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_pho_ga","name":"Phở gà","en":"Chicken pho noodle soup","aliases":["phở gà","pho ga","chicken pho","chicken pho noodle soup"],"protein":30,"carbs":55,"fat":10,"kcal":430,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":500,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_bun_bo_hue","name":"Bún bò Huế","en":"Hue spicy beef noodle soup","aliases":["bún bò huế","bun bo hue","hue beef noodle soup"],"protein":30,"carbs":68,"fat":19,"kcal":563,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":550,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_bun_mam_pork","name":"Bún mắm thịt quay nạc","en":"Fermented fish noodle soup with lean roast pork","aliases":["bún mắm với thịt quay nạc","bún mắm thịt quay nạc","bun mam lean roast pork"],"protein":34,"carbs":72,"fat":23,"kcal":631,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":550,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_bun_rieu_cha_oc","name":"Bún riêu chả ốc","en":"Crab tomato noodle soup with snail cake","aliases":["bún riêu với chả ốc","bún riêu chả ốc","bun rieu snail cake"],"protein":28,"carbs":62,"fat":18,"kcal":522,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":550,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_bun_ca","name":"Bún cá","en":"Vietnamese fish noodle soup","aliases":["bún cá","bun ca","fish rice noodle soup"],"protein":27,"carbs":61,"fat":11,"kcal":451,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":520,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_banh_da_cua_cha_ca","name":"Bánh đa cua chả cá","en":"Red rice noodle soup with crab and fish cake","aliases":["bánh đa cua với chả cá","bánh đa cua chả cá","crab red rice noodles fish cake"],"protein":29,"carbs":67,"fat":20,"kcal":564,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":550,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_mi_van_than","name":"Mì vằn thắn","en":"Wonton egg noodle soup","aliases":["mỳ vằn thắn","mì vằn thắn","wonton noodle soup","wonton egg noodles"],"protein":29,"carbs":74,"fat":21,"kcal":601,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":520,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_banh_canh_cha_ca","name":"Bánh canh chả cá","en":"Thick noodle soup with fish cake","aliases":["bánh canh chả cá","fish cake thick noodle soup"],"protein":25,"carbs":66,"fat":13,"kcal":481,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":520,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_mi_quang","name":"Mì Quảng","en":"Quang-style turmeric noodles","aliases":["mỳ quảng","mì quảng","mi quang","quang noodles"],"protein":28,"carbs":66,"fat":20,"kcal":556,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":480,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_mien_ngan","name":"Miến ngan","en":"Glass noodle soup with Muscovy duck","aliases":["miến ngan","mien ngan","duck glass noodle soup"],"protein":28,"carbs":63,"fat":18,"kcal":526,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":520,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_bun_ngan","name":"Bún ngan","en":"Rice vermicelli soup with Muscovy duck","aliases":["bún ngan","bun ngan","duck rice vermicelli soup"],"protein":29,"carbs":68,"fat":19,"kcal":559,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":540,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_banh_da_ngan","name":"Bánh đa ngan","en":"Red rice noodle soup with Muscovy duck","aliases":["bánh đa ngan","banh da ngan","duck red rice noodle soup"],"protein":30,"carbs":70,"fat":21,"kcal":589,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":560,"unit":"bowl","allowCookingMethod":false}),
    v6Food100g({"id":"u6_ngan_chay_toi","name":"Ngan cháy tỏi","en":"Garlic-fried Muscovy duck","aliases":["ngan cháy tỏi","garlic fried muscovy duck","garlic duck"],"protein":24,"carbs":6,"fat":26,"kcal":354,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.18,"defaultGrams":150,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_ngan_luoc","name":"Ngan luộc","en":"Boiled Muscovy duck","aliases":["ngan luộc","boiled muscovy duck","boiled duck meat"],"protein":25,"carbs":0,"fat":12,"kcal":208,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"fattyProtein","allowCookingMethod":false}),
    v6Food100g({"id":"u6_shrimp","name":"Tôm","en":"Shrimp","aliases":["tôm","tom","shrimp","prawn","prawns"],"protein":24,"carbs":0.2,"fat":0.5,"kcal":101,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"seafood","allowCookingMethod":true}),
    v6Food100g({"id":"u6_mantis_shrimp","name":"Bề bề","en":"Mantis shrimp","aliases":["bề bề","tôm tít","mantis shrimp"],"protein":20,"carbs":1,"fat":1.5,"kcal":98,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"seafood","allowCookingMethod":true}),
    v6Food100g({"id":"u6_scallop_scallion","name":"Sò điệp nướng mỡ hành","en":"Grilled scallops with scallion oil","aliases":["sò điệp nướng mỡ hành","grilled scallops scallion oil"],"protein":18,"carbs":5,"fat":11,"kcal":191,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.18,"defaultGrams":150,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_oyster_scallion","name":"Hàu nướng mỡ hành","en":"Grilled oysters with scallion oil","aliases":["hàu nướng mỡ hành","grilled oysters scallion oil"],"protein":10,"carbs":8,"fat":12,"kcal":180,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.18,"defaultGrams":180,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_snail_lemongrass","name":"Ốc xào sả ớt","en":"Stir-fried snails with lemongrass and chili","aliases":["ốc xào sả ớt","stir fried snails lemongrass chili"],"protein":17,"carbs":7,"fat":10,"kcal":186,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.2,"defaultGrams":180,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_snail_boiled_sauce","name":"Ốc luộc mắm","en":"Boiled snails with fish sauce","aliases":["ốc luộc mắm","ốc luộc chấm mắm","boiled snails fish sauce"],"protein":18,"carbs":5,"fat":3,"kcal":119,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.15,"defaultGrams":180,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_roast_bird_macmat","name":"Chim quay lá mắc mật","en":"Roast bird with mac mat leaves","aliases":["chim quay lá mắc mật","roast pigeon mac mat leaves","roast quail mac mat"],"protein":25,"carbs":5,"fat":18,"kcal":282,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.2,"defaultGrams":150,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_plain_baguette","name":"Bánh mì không","en":"Plain Vietnamese baguette","aliases":["bánh mỳ không","bánh mì không","plain baguette","plain vietnamese bread"],"protein":8,"carbs":55,"fat":2,"kcal":270,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":80,"methodClass":"starch","allowCookingMethod":true}),
    v6Food100g({"id":"u6_butter_sugar_bread","name":"Bánh mì bơ đường","en":"Butter and sugar bread","aliases":["bánh mỳ bơ đường","bánh mì bơ đường","butter sugar bread"],"protein":7,"carbs":56,"fat":16,"kcal":396,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.15,"defaultGrams":100,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_croissant","name":"Croissant","en":"Croissant","aliases":["croissant","bánh sừng bò"],"protein":8,"carbs":46,"fat":21,"kcal":405,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.1,"defaultGrams":67,"allowCookingMethod":false,"gramsPerUnit":67}),
    v6Food100g({"id":"u6_sticky_rice","name":"Xôi","en":"Cooked sticky rice","aliases":["xôi","sticky rice","glutinous rice cooked"],"protein":4,"carbs":43,"fat":1,"kcal":197,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"starch","allowCookingMethod":true}),
    v6Food100g({"id":"u6_cooked_rice","name":"Cơm","en":"Cooked white rice","aliases":["cơm","cơm trắng","cooked rice","white rice cooked"],"protein":2.7,"carbs":28.2,"fat":0.3,"kcal":126,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"starch","allowCookingMethod":true}),
    v6Food100g({"id":"u6_potato","name":"Khoai tây","en":"Potato","aliases":["khoai tây","potato","potatoes"],"protein":2,"carbs":20,"fat":0.1,"kcal":89,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"starch","allowCookingMethod":true}),
    v6Food100g({"id":"u6_sweet_potato","name":"Khoai lang","en":"Sweet potato","aliases":["khoai lang","sweet potato"],"protein":1.6,"carbs":20.7,"fat":0.1,"kcal":90,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"starch","allowCookingMethod":true}),
    v6Food100g({"id":"u6_oats","name":"Yến mạch","en":"Oats","aliases":["yến mạch","oats","oatmeal","rolled oats"],"protein":16.9,"carbs":66.3,"fat":6.9,"kcal":395,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":50,"methodClass":"starch","allowCookingMethod":false}),
    v6Food100g({"id":"u6_pumpkin","name":"Bí đỏ","en":"Pumpkin","aliases":["bí đỏ","bí đó","pumpkin"],"protein":1,"carbs":6.5,"fat":0.1,"kcal":31,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"vegetable","allowCookingMethod":true}),
    v6Food100g({"id":"u6_whole_egg","name":"Trứng","en":"Whole egg","aliases":["trứng","trứng gà","whole egg","egg","eggs"],"protein":12.6,"carbs":0.7,"fat":9.5,"kcal":139,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":50,"methodClass":"leanProtein","allowCookingMethod":true,"gramsPerUnit":50}),
    v6Food100g({"id":"u6_egg_white","name":"Lòng trắng trứng","en":"Egg white","aliases":["lòng trắng trứng","egg white","egg whites"],"protein":10.9,"carbs":0.7,"fat":0.2,"kcal":48,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":100,"methodClass":"leanProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_cucumber","name":"Dưa chuột","en":"Cucumber","aliases":["dưa chuột","dưa leo","cucumber"],"protein":0.7,"carbs":3.6,"fat":0.1,"kcal":18,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"vegetable","allowCookingMethod":true}),
    v6Food100g({"id":"u6_carrot","name":"Cà rốt","en":"Carrot","aliases":["cà rốt","carrot"],"protein":0.9,"carbs":9.6,"fat":0.2,"kcal":44,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"vegetable","allowCookingMethod":true}),
    v6Food100g({"id":"u6_broccoli","name":"Súp lơ xanh","en":"Broccoli","aliases":["súp lơ xanh","bông cải xanh","broccoli"],"protein":2.8,"carbs":7,"fat":0.4,"kcal":43,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"vegetable","allowCookingMethod":true}),
    v6Food100g({"id":"u6_cauliflower","name":"Súp lơ trắng","en":"Cauliflower","aliases":["súp lơ trắng","bông cải trắng","cauliflower"],"protein":1.9,"carbs":5,"fat":0.3,"kcal":30,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"vegetable","allowCookingMethod":true}),
    v6Food100g({"id":"u6_cabbage","name":"Bắp cải","en":"Cabbage","aliases":["bắp cải","cabbage"],"protein":1.3,"carbs":5.8,"fat":0.1,"kcal":29,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"vegetable","allowCookingMethod":true}),
    v6Food100g({"id":"u6_jicama","name":"Củ đậu","en":"Jicama","aliases":["củ đậu","củ sắn","jicama"],"protein":0.7,"carbs":8.8,"fat":0.1,"kcal":39,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"vegetable","allowCookingMethod":true}),
    v6Food100g({"id":"u6_sweet_leaf","name":"Rau ngót","en":"Sweet leaf","aliases":["rau ngót","sweet leaf","sauropus androgynus"],"protein":5.3,"carbs":3.4,"fat":0.5,"kcal":39,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"vegetable","allowCookingMethod":true}),
    v6Food100g({"id":"u6_water_spinach","name":"Rau muống","en":"Water spinach","aliases":["rau muống","water spinach","morning glory vegetable"],"protein":2.6,"carbs":3.1,"fat":0.2,"kcal":25,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"vegetable","allowCookingMethod":true}),
    v6Food100g({"id":"u6_mustard_greens","name":"Rau cải","en":"Mustard greens","aliases":["rau cải","cải xanh","mustard greens","leafy greens"],"protein":2.7,"carbs":4.7,"fat":0.4,"kcal":33,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"vegetable","allowCookingMethod":true}),
    v6Food100g({"id":"u6_firm_tofu","name":"Đậu phụ","en":"Firm tofu","aliases":["đậu phụ","đậu hũ","firm tofu","tofu"],"protein":8,"carbs":1.9,"fat":4.8,"kcal":83,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"tofu","allowCookingMethod":true}),
    v6Food100g({"id":"u6_silken_tofu","name":"Đậu hũ non","en":"Silken tofu","aliases":["đậu hũ non","đậu phụ non","silken tofu","soft tofu"],"protein":5.3,"carbs":1.4,"fat":3,"kcal":54,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":240,"methodClass":"tofu","allowCookingMethod":true}),
    v6Food100ml({"id":"u6_soda","name":"Nước ngọt có ga","en":"Carbonated soft drink","aliases":["nước ngọt có ga","nước ngọt","soft drink","soda","cola"],"protein":0,"carbs":10.6,"fat":0,"kcal":42,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 ml","rangePct":0.06,"defaultMl":330,"perCan":140}),
    v6Food100g({"id":"u6_chicken_breast","name":"Ức gà","en":"Chicken breast","aliases":["ức gà","chicken breast"],"protein":31,"carbs":0,"fat":3.6,"kcal":156,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"leanProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_chicken_thigh","name":"Đùi gà","en":"Chicken thigh","aliases":["đùi gà","chicken thigh"],"protein":26,"carbs":0,"fat":10.9,"kcal":202,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"fattyProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_roast_chicken","name":"Gà quay","en":"Roast chicken","aliases":["gà quay","rotisserie chicken","roast chicken"],"protein":27,"carbs":2,"fat":13,"kcal":233,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.15,"defaultGrams":200,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_peking_duck","name":"Vịt quay Bắc Kinh","en":"Peking duck","aliases":["vịt quay bắc kinh","peking duck"],"protein":19,"carbs":3,"fat":28,"kcal":340,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.18,"defaultGrams":180,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_salmon","name":"Cá hồi","en":"Salmon","aliases":["cá hồi","salmon"],"protein":22,"carbs":0,"fat":12,"kcal":196,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"fattyProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_tuna","name":"Cá ngừ","en":"Tuna","aliases":["cá ngừ","tuna"],"protein":29,"carbs":0,"fat":1,"kcal":125,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"leanProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_scad","name":"Cá nục","en":"Scad fish","aliases":["cá nục","scad fish","mackerel scad"],"protein":22,"carbs":0,"fat":8,"kcal":160,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"fattyProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_mackerel","name":"Cá thu","en":"Mackerel","aliases":["cá thu","mackerel"],"protein":24,"carbs":0,"fat":14,"kcal":222,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"fattyProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_basa","name":"Cá basa","en":"Basa fish","aliases":["cá basa","basa fish","pangasius"],"protein":18,"carbs":0,"fat":5,"kcal":117,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"seafood","allowCookingMethod":true}),
    v6Food100g({"id":"u6_snakehead","name":"Cá quả","en":"Snakehead fish","aliases":["cá quả","cá lóc","snakehead fish"],"protein":21,"carbs":0,"fat":4,"kcal":120,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"seafood","allowCookingMethod":true}),
    v6Food100g({"id":"u6_hemibagrus","name":"Cá lăng","en":"Hemibagrus catfish","aliases":["cá lăng","hemibagrus","lang fish"],"protein":20,"carbs":0,"fat":7,"kcal":143,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"seafood","allowCookingMethod":true}),
    v6Food100g({"id":"u6_tilapia","name":"Cá rô phi","en":"Tilapia","aliases":["cá rô phi","tilapia"],"protein":26,"carbs":0,"fat":3,"kcal":131,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"leanProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_pomfret","name":"Cá chim","en":"Pomfret","aliases":["cá chim","pomfret"],"protein":20,"carbs":0,"fat":8,"kcal":152,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"seafood","allowCookingMethod":true}),
    v6Food100g({"id":"u6_crab","name":"Cua","en":"Crab meat","aliases":["cua","crab","crab meat"],"protein":19,"carbs":0,"fat":1.5,"kcal":90,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"seafood","allowCookingMethod":true}),
    v6Food100g({"id":"u6_blue_crab","name":"Ghẹ","en":"Blue swimming crab","aliases":["ghẹ","blue swimming crab","blue crab"],"protein":20,"carbs":0,"fat":1.5,"kcal":94,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"seafood","allowCookingMethod":true}),
    v6Food100g({"id":"u6_chicken_feet","name":"Chân gà sả tắc","en":"Chicken feet with lemongrass and kumquat","aliases":["chân gà sả tắc","lemongrass kumquat chicken feet"],"protein":19,"carbs":7,"fat":14,"kcal":230,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.2,"defaultGrams":200,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_grilled_wings","name":"Cánh gà nướng","en":"Grilled chicken wings","aliases":["cánh gà nướng","grilled chicken wings"],"protein":25,"carbs":4,"fat":15,"kcal":251,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.18,"defaultGrams":180,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_pizza","name":"Pizza","en":"Pizza","aliases":["pizza"],"protein":11,"carbs":33,"fat":10,"kcal":266,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.2,"defaultGrams":200,"allowCookingMethod":false,"gramsPerUnit":110}),
    v6FoodPortion({"id":"u6_pumpkin_soup","name":"Súp bí đỏ","en":"Pumpkin soup","aliases":["súp bí đỏ","pumpkin soup"],"protein":5,"carbs":30,"fat":7,"kcal":203,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":320,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_cream_pasta","name":"Mì Ý sốt kem","en":"Cream sauce pasta","aliases":["mỳ ý sốt kem","mì ý sốt kem","cream pasta","pasta alfredo"],"protein":23,"carbs":82,"fat":32,"kcal":708,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":420,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_bolognese","name":"Mì Ý sốt bò bằm","en":"Spaghetti Bolognese","aliases":["mỳ ý sốt bò bằm","mì ý sốt bò bằm","spaghetti bolognese","pasta with minced beef sauce"],"protein":31,"carbs":84,"fat":20,"kcal":640,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":450,"unit":"portion","allowCookingMethod":false}),
    v6Food100g({"id":"u6_beef","name":"Thịt bò","en":"Beef","aliases":["thịt bò","beef"],"protein":26,"carbs":0,"fat":12,"kcal":212,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"leanProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_steak","name":"Steak","en":"Beef steak","aliases":["steak","beef steak","bít tết","bo bit tet"],"protein":27,"carbs":1,"fat":15,"kcal":247,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.15,"defaultGrams":200,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_pork_tenderloin","name":"Thịt thăn heo","en":"Pork tenderloin","aliases":["thịt lợn thăn","thịt heo thăn","pork tenderloin"],"protein":26,"carbs":0,"fat":3.5,"kcal":136,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"leanProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_braised_pork","name":"Thịt kho","en":"Vietnamese braised pork","aliases":["thịt kho","braised pork","caramelized pork"],"protein":18,"carbs":8,"fat":20,"kcal":284,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.2,"defaultGrams":180,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_crispy_edge_pork","name":"Thịt rang cháy cạnh","en":"Caramelized pan-fried pork","aliases":["thịt rang cháy cạnh","crispy edge pork","caramelized pork belly"],"protein":22,"carbs":7,"fat":27,"kcal":359,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.2,"defaultGrams":180,"allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_banh_cuon_plain","name":"Bánh cuốn không nhân","en":"Plain steamed rice rolls","aliases":["bánh cuốn không nhân","plain bánh cuốn","plain steamed rice rolls"],"protein":7,"carbs":62,"fat":6,"kcal":330,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":300,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_banh_cuon_filled","name":"Bánh cuốn có nhân","en":"Steamed rice rolls with pork filling","aliases":["bánh cuốn có nhân","bánh cuốn nhân thịt","filled steamed rice rolls"],"protein":18,"carbs":65,"fat":17,"kcal":485,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":380,"unit":"portion","allowCookingMethod":false}),
    v6Food100g({"id":"u6_meatballs","name":"Thịt viên","en":"Meatballs","aliases":["thịt viên","meatballs","pork meatballs","beef meatballs"],"protein":16,"carbs":8,"fat":17,"kcal":249,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"fattyProtein","allowCookingMethod":true}),
    v6FoodPortion({"id":"u6_banh_khoai_shrimp","name":"Bánh khoái tép","en":"Vietnamese crispy shrimp pancake","aliases":["bánh khoái tép","shrimp bánh khoái","crispy shrimp pancake"],"protein":22,"carbs":75,"fat":30,"kcal":658,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":350,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_banh_duc_tau","name":"Bánh đúc tàu","en":"Hai Phong savory rice cake bowl","aliases":["bánh đúc tàu","hai phong savory rice cake"],"protein":20,"carbs":70,"fat":22,"kcal":558,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":400,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_che_khuc_bach","name":"Chè khúc bạch","en":"Almond panna cotta dessert soup","aliases":["chè khúc bạch","khuc bach dessert"],"protein":8,"carbs":45,"fat":14,"kcal":338,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":300,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_che_black_bean","name":"Chè đỗ đen","en":"Black bean sweet soup","aliases":["chè đỗ đen","chè đậu đen","black bean sweet soup"],"protein":10,"carbs":58,"fat":3,"kcal":299,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":300,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_thach_gang","name":"Thạch găng","en":"Vietnamese green jelly","aliases":["thạch găng","green jelly vietnam"],"protein":0.5,"carbs":20,"fat":0,"kcal":82,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":220,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_grass_jelly","name":"Thạch đen","en":"Grass jelly","aliases":["thạch đen","sương sáo","grass jelly","black jelly"],"protein":0.5,"carbs":22,"fat":0,"kcal":90,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":220,"unit":"bowl","allowCookingMethod":false}),
    v6Food100g({"id":"u6_soy_isolate","name":"Soy protein isolate","en":"Soy protein isolate","aliases":["soy protein isolate","đạm đậu nành cô lập","bột đạm đậu nành"],"protein":88,"carbs":3,"fat":1.5,"kcal":378,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.05,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_skim_milk_powder","name":"Skim milk powder","en":"Skim milk powder","aliases":["skim milk powder","sữa bột tách béo","nonfat dry milk"],"protein":36,"carbs":52,"fat":0.8,"kcal":359,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.05,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_whey","name":"Whey protein","en":"Whey protein powder","aliases":["whey protein","whey protein powder","bột whey"],"protein":80,"carbs":8,"fat":6,"kcal":406,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_cottage_cheese","name":"Cottage cheese","en":"Cottage cheese","aliases":["cottage cheese","phô mai cottage"],"protein":11,"carbs":3.4,"fat":4.3,"kcal":96,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_greek_yogurt","name":"Greek yogurt","en":"Greek yogurt","aliases":["greek yogurt","sữa chua hy lạp"],"protein":10,"carbs":4,"fat":2,"kcal":74,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_plain_yogurt","name":"Sữa chua không đường","en":"Plain unsweetened yogurt","aliases":["sữa chua không đường","plain yogurt","unsweetened yogurt"],"protein":3.5,"carbs":4.7,"fat":3.3,"kcal":62,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":100,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_pineapple","name":"Dứa","en":"Pineapple","aliases":["dứa","thơm","pineapple"],"protein":0.5,"carbs":13.1,"fat":0.1,"kcal":55,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_watermelon","name":"Dưa hấu","en":"Watermelon","aliases":["dưa hấu","watermelon"],"protein":0.6,"carbs":7.6,"fat":0.2,"kcal":35,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":250,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_peach","name":"Đào","en":"Peach","aliases":["đào","peach"],"protein":0.9,"carbs":9.5,"fat":0.3,"kcal":44,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_apricot","name":"Mơ","en":"Apricot","aliases":["mơ","apricot"],"protein":1.4,"carbs":11.1,"fat":0.4,"kcal":54,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_plum","name":"Mận","en":"Plum","aliases":["mận","plum"],"protein":0.7,"carbs":11.4,"fat":0.3,"kcal":51,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_grapes","name":"Nho","en":"Grapes","aliases":["nho","grape","grapes"],"protein":0.7,"carbs":18.1,"fat":0.2,"kcal":77,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_lychee","name":"Vải","en":"Lychee","aliases":["vải","lychee","litchi"],"protein":0.8,"carbs":16.5,"fat":0.4,"kcal":73,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_longan","name":"Nhãn","en":"Longan","aliases":["nhãn","longan"],"protein":1.3,"carbs":15.1,"fat":0.1,"kcal":66,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_rambutan","name":"Chôm chôm","en":"Rambutan","aliases":["chôm chôm","rambutan"],"protein":0.7,"carbs":20.9,"fat":0.2,"kcal":88,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_custard_apple","name":"Na","en":"Custard apple","aliases":["na","mãng cầu ta","custard apple","sugar apple"],"protein":2.1,"carbs":23.6,"fat":0.3,"kcal":106,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_sapodilla","name":"Hồng xiêm","en":"Sapodilla","aliases":["hồng xiêm","sapodilla"],"protein":0.4,"carbs":20,"fat":1.1,"kcal":92,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_crisp_persimmon","name":"Hồng giòn","en":"Crisp persimmon","aliases":["hồng giòn","persimmon","crisp persimmon"],"protein":0.6,"carbs":18.6,"fat":0.2,"kcal":79,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_durian","name":"Sầu riêng","en":"Durian","aliases":["sầu riêng","durian"],"protein":1.5,"carbs":27.1,"fat":5.3,"kcal":162,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_coconut","name":"Dừa","en":"Coconut meat","aliases":["dừa","cơm dừa","coconut meat","coconut flesh"],"protein":3.3,"carbs":15.2,"fat":33.5,"kcal":376,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":100,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_cantaloupe","name":"Dưa lưới","en":"Cantaloupe","aliases":["dưa lưới","cantaloupe","melon"],"protein":0.8,"carbs":8.2,"fat":0.2,"kcal":38,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":250,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_orange","name":"Cam","en":"Orange","aliases":["cam","orange"],"protein":0.9,"carbs":11.8,"fat":0.1,"kcal":52,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_mango","name":"Xoài","en":"Mango","aliases":["xoài","mango"],"protein":0.8,"carbs":15,"fat":0.4,"kcal":67,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":200,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_apple","name":"Táo","en":"Apple","aliases":["táo","apple"],"protein":0.3,"carbs":13.8,"fat":0.2,"kcal":58,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_avocado","name":"Quả bơ","en":"Avocado","aliases":["quả bơ","avocado"],"protein":2,"carbs":8.5,"fat":14.7,"kcal":174,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"fruit","allowCookingMethod":true}),
    v6Food100g({"id":"u6_banana","name":"Chuối","en":"Banana","aliases":["chuối","banana"],"protein":1.1,"carbs":22.8,"fat":0.3,"kcal":98,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":120,"methodClass":"fruit","allowCookingMethod":true,"gramsPerUnit":120}),
    v6Food100g({"id":"u6_shiitake","name":"Nấm hương","en":"Shiitake mushroom","aliases":["nấm hương","nấm đông cô","shiitake mushroom"],"protein":2.2,"carbs":6.8,"fat":0.5,"kcal":40,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"vegetable","allowCookingMethod":true}),
    v6Food100g({"id":"u6_straw_mushroom","name":"Nấm rơm","en":"Straw mushroom","aliases":["nấm rơm","straw mushroom"],"protein":3.8,"carbs":5.2,"fat":0.3,"kcal":39,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"vegetable","allowCookingMethod":true}),
    v6Food100g({"id":"u6_pork_liver","name":"Gan lợn","en":"Pork liver","aliases":["gan lợn","gan heo","pork liver"],"protein":26,"carbs":3.8,"fat":4.4,"kcal":159,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"leanProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_pork_heart","name":"Tim lợn","en":"Pork heart","aliases":["tim lợn","tim heo","pork heart"],"protein":24,"carbs":0.4,"fat":8,"kcal":170,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"leanProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_beef_heart","name":"Tim bò","en":"Beef heart","aliases":["tim bò","beef heart"],"protein":29,"carbs":0.1,"fat":4,"kcal":152,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"leanProtein","allowCookingMethod":true}),
    v6FoodPortion({"id":"u6_nom_bo_kho","name":"Nộm bò khô","en":"Green papaya salad with dried beef","aliases":["nộm bò khô","gỏi khô bò","green papaya salad dried beef"],"protein":20,"carbs":40,"fat":14,"kcal":366,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":300,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_nom_bo_bop_thau","name":"Nộm bò bóp thấu","en":"Vietnamese beef and herb salad","aliases":["nộm bò bóp thấu","gỏi bò bóp thấu","vietnamese beef salad"],"protein":28,"carbs":24,"fat":17,"kcal":361,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":300,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_fried_rice","name":"Cơm rang","en":"Fried rice","aliases":["cơm rang","cơm chiên","fried rice"],"protein":17,"carbs":88,"fat":24,"kcal":636,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":380,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_stirfried_noodles","name":"Mì xào","en":"Stir-fried noodles","aliases":["mỳ xào","mì xào","stir fried noodles","fried noodles"],"protein":20,"carbs":90,"fat":28,"kcal":692,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":420,"unit":"portion","allowCookingMethod":false}),
    v6Food100g({"id":"u6_tofu_fish_sauce","name":"Đậu chiên mắm","en":"Fried tofu with fish sauce","aliases":["đậu chiên mắm","đậu phụ chiên mắm","fried tofu fish sauce"],"protein":11,"carbs":7,"fat":17,"kcal":225,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.2,"defaultGrams":180,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_pork_cracklings","name":"Tóp mỡ","en":"Pork cracklings","aliases":["tóp mỡ","pork cracklings","pork fat cracklings"],"protein":11,"carbs":0,"fat":64,"kcal":620,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.12,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_peanuts","name":"Lạc","en":"Peanuts","aliases":["lạc","đậu phộng","peanut","peanuts"],"protein":25.8,"carbs":16.1,"fat":49.2,"kcal":610,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":30,"methodClass":"fattyProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_mixed_beans","name":"Mixed beans","en":"Cooked mixed beans","aliases":["mixed beans","đậu hỗn hợp","cooked mixed beans"],"protein":8.5,"carbs":23,"fat":0.6,"kcal":131,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"methodClass":"starch","allowCookingMethod":true}),
    v6Food100g({"id":"u6_walnuts","name":"Hạt óc chó","en":"Walnuts","aliases":["hạt óc chó","walnut","walnuts"],"protein":15.2,"carbs":13.7,"fat":65.2,"kcal":702,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_macadamia","name":"Hạt mắc ca","en":"Macadamia nuts","aliases":["hạt mắc ca","macadamia","macadamia nuts"],"protein":7.9,"carbs":13.8,"fat":75.8,"kcal":769,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_cashews","name":"Hạt điều","en":"Cashews","aliases":["hạt điều","cashew","cashews"],"protein":18.2,"carbs":30.2,"fat":43.8,"kcal":588,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_almonds","name":"Hạt hạnh nhân","en":"Almonds","aliases":["hạt hạnh nhân","almond","almonds"],"protein":21.2,"carbs":21.6,"fat":49.9,"kcal":620,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_pumpkin_seeds","name":"Hạt bí","en":"Pumpkin seeds","aliases":["hạt bí","pumpkin seeds","pepitas"],"protein":30.2,"carbs":10.7,"fat":49.1,"kcal":606,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_pine_nuts","name":"Hạt thông","en":"Pine nuts","aliases":["hạt thông","pine nuts"],"protein":13.7,"carbs":13.1,"fat":68.4,"kcal":723,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_dates","name":"Chà là","en":"Dates","aliases":["chà là","date fruit","dates"],"protein":1.8,"carbs":75,"fat":0.2,"kcal":309,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":40,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_cocoa","name":"Bột cacao","en":"Cocoa powder","aliases":["bột cacao","cocoa powder","unsweetened cocoa"],"protein":19.6,"carbs":57.9,"fat":13.7,"kcal":228,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":10,"allowCookingMethod":false,"nonMacroEnergy":true,"perUnit":228}),
    v6Food100g({"id":"u6_dark_choc70","name":"Socola đắng 70%","en":"70% dark chocolate","aliases":["socola đắng 70%","sô cô la đen 70%","70 dark chocolate","70% dark chocolate"],"protein":7.8,"carbs":46,"fat":43,"kcal":602,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":25,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_milk_choc","name":"Socola sữa","en":"Milk chocolate","aliases":["socola sữa","sô cô la sữa","milk chocolate"],"protein":7.6,"carbs":59,"fat":30,"kcal":536,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":25,"allowCookingMethod":false}),
    v6Food100ml({"id":"u6_whole_milk","name":"Sữa tươi","en":"Whole milk","aliases":["sữa tươi","whole milk","fresh milk"],"protein":3.2,"carbs":4.8,"fat":3.3,"kcal":62,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 ml","rangePct":0.06,"defaultMl":240}),
    v6Food100ml({"id":"u6_skim_milk","name":"Sữa tách béo","en":"Skim milk","aliases":["sữa tách béo","skim milk","nonfat milk"],"protein":3.4,"carbs":5,"fat":0.1,"kcal":34,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 ml","rangePct":0.06,"defaultMl":240}),
    v6FoodPortion({"id":"u6_banh_mi_huynh_hoa","name":"Bánh mì Huỳnh Hoa","en":"Huynh Hoa loaded Vietnamese sandwich","aliases":["bánh mỳ huynh hoa","bánh mì huỳnh hoa","huynh hoa banh mi"],"protein":28,"carbs":78,"fat":33,"kcal":721,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.22,"grams":320,"unit":"unit","allowCookingMethod":false,"perUnit":721,"gramsPerUnit":320}),
    v6FoodPortion({"id":"u6_com_tam_suon_trung","name":"Cơm tấm sườn trứng","en":"Broken rice with pork chop and egg","aliases":["cơm tấm sườn trứng","broken rice pork chop egg"],"protein":36,"carbs":92,"fat":29,"kcal":773,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":550,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_hotpot_generic","name":"Lẩu các loại","en":"Mixed hot pot meal","aliases":["lẩu các loại","lẩu","hot pot","mixed hot pot"],"protein":46,"carbs":55,"fat":34,"kcal":710,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.3,"grams":900,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_thai_hotpot","name":"Lẩu Thái","en":"Thai hot pot","aliases":["lẩu thái","thai hot pot","tom yum hot pot"],"protein":45,"carbs":58,"fat":35,"kcal":727,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.28,"grams":900,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_beef_hotpot","name":"Lẩu bò","en":"Beef hot pot","aliases":["lẩu bò","beef hot pot"],"protein":52,"carbs":45,"fat":38,"kcal":730,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.28,"grams":900,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_chicken_hotpot","name":"Lẩu gà","en":"Chicken hot pot","aliases":["lẩu gà","chicken hot pot"],"protein":50,"carbs":48,"fat":30,"kcal":662,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.28,"grams":900,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_seafood_hotpot","name":"Lẩu hải sản","en":"Seafood hot pot","aliases":["lẩu hải sản","seafood hot pot"],"protein":50,"carbs":58,"fat":25,"kcal":657,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.28,"grams":900,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_mushroom_hotpot","name":"Lẩu nấm","en":"Mushroom hot pot","aliases":["lẩu nấm","mushroom hot pot"],"protein":25,"carbs":75,"fat":18,"kcal":562,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.28,"grams":900,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_crab_hotpot","name":"Lẩu riêu cua","en":"Crab tomato hot pot","aliases":["lẩu riêu cua","crab tomato hot pot"],"protein":42,"carbs":62,"fat":30,"kcal":686,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.28,"grams":900,"unit":"portion","allowCookingMethod":false}),
    v6Food100g({"id":"u6_pork_jowl","name":"Nọng heo","en":"Pork jowl","aliases":["nọng heo","má heo","pork jowl"],"protein":16,"carbs":0,"fat":38,"kcal":406,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"fattyProtein","allowCookingMethod":true}),
    v6Food100g({"id":"u6_pork_belly","name":"Thịt ba chỉ","en":"Pork belly","aliases":["thịt ba chỉ","ba chỉ","pork belly"],"protein":9.3,"carbs":0,"fat":53,"kcal":514,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":180,"methodClass":"fattyProtein","allowCookingMethod":true}),
    v6FoodPortion({"id":"u6_bun_cha","name":"Bún chả","en":"Grilled pork with rice vermicelli","aliases":["bún chả","bun cha","grilled pork rice vermicelli"],"protein":31,"carbs":76,"fat":25,"kcal":653,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":500,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_ga_tan","name":"Gà tần","en":"Herbal stewed chicken","aliases":["gà tần","ga tan","herbal stewed chicken"],"protein":31,"carbs":16,"fat":25,"kcal":413,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":500,"unit":"bowl","allowCookingMethod":false}),
    v6Food100g({"id":"u6_pate","name":"Patê","en":"Pâté","aliases":["patê","pate","pâté","liver pate"],"protein":14,"carbs":5,"fat":27,"kcal":319,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":50,"allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_banh_mi_pate","name":"Bánh mì patê","en":"Vietnamese baguette with pâté","aliases":["bánh mỳ patê","bánh mì patê","banh mi pate","pate baguette"],"protein":18,"carbs":65,"fat":21,"kcal":521,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":250,"unit":"unit","allowCookingMethod":false,"perUnit":521,"gramsPerUnit":250}),
    v6Food100g({"id":"u6_pork_floss","name":"Ruốc","en":"Pork floss","aliases":["ruốc","chà bông","pork floss"],"protein":45,"carbs":10,"fat":14,"kcal":346,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_peanut_sesame_salt","name":"Muối lạc vừng","en":"Peanut sesame salt","aliases":["muối lạc vừng","muối vừng","peanut sesame salt"],"protein":18,"carbs":20,"fat":45,"kcal":557,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_mozzarella","name":"Mozzarella","en":"Mozzarella cheese","aliases":["mozzarella","phô mai mozzarella"],"protein":22,"carbs":2.2,"fat":22,"kcal":295,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_cheddar","name":"Cheddar","en":"Cheddar cheese","aliases":["cheddar","phô mai cheddar"],"protein":25,"carbs":1.3,"fat":33,"kcal":402,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_cream_cheese","name":"Cream cheese","en":"Cream cheese","aliases":["cream cheese","phô mai kem"],"protein":6,"carbs":5.5,"fat":34,"kcal":352,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":30,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_butter","name":"Butter","en":"Butter","aliases":["butter","bơ lạt","bơ động vật"],"protein":0.9,"carbs":0.1,"fat":81,"kcal":733,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":10,"allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_banh_duc_lac","name":"Bánh đúc lạc","en":"Vietnamese peanut rice cake","aliases":["bánh đúc lạc","peanut rice cake vietnamese"],"protein":12,"carbs":65,"fat":14,"kcal":434,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":320,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_bun_dau","name":"Bún đậu mắm tôm","en":"Rice vermicelli with fried tofu and shrimp paste","aliases":["bún đậu mắm tôm","bún đậu","bun dau mam tom"],"protein":32,"carbs":82,"fat":30,"kcal":726,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":600,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_ramen","name":"Mì ramen","en":"Ramen noodle soup","aliases":["mỳ ramen","mì ramen","ramen","ramen noodle soup"],"protein":26,"carbs":78,"fat":27,"kcal":659,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":600,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_tom_yum","name":"Tom yum","en":"Tom yum soup","aliases":["tomyum","tom yum","tom yum soup"],"protein":21,"carbs":18,"fat":16,"kcal":300,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":420,"unit":"bowl","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_som_tam","name":"Som tam Thái","en":"Thai green papaya salad","aliases":["somtum thái","som tam thái","som tam","thai papaya salad"],"protein":5,"carbs":31,"fat":5,"kcal":189,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":280,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_thai_spicy_ribs","name":"Sườn cay Thái","en":"Thai spicy pork ribs","aliases":["sườn cay thái","thai spicy ribs"],"protein":41,"carbs":26,"fat":40,"kcal":628,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":500,"unit":"portion","allowCookingMethod":false}),
    v6Food100ml({"id":"u6_beer","name":"Bia","en":"Beer","aliases":["bia","beer"],"protein":0.5,"carbs":3.6,"fat":0,"kcal":43,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 ml","rangePct":0.06,"defaultMl":330,"nonMacroEnergy":true,"perCan":142}),
    v6Food100ml({"id":"u6_spirits","name":"Rượu","en":"Distilled spirits","aliases":["rượu","spirits","liquor","vodka","whisky","whiskey"],"protein":0,"carbs":0,"fat":0,"kcal":231,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 ml","rangePct":0.06,"defaultMl":45,"nonMacroEnergy":true}),
    v6Food100ml({"id":"u6_electrolyte","name":"Nước điện giải","en":"Electrolyte drink","aliases":["nước điện giải","electrolyte drink","sports drink"],"protein":0,"carbs":6,"fat":0,"kcal":24,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 ml","rangePct":0.06,"defaultMl":500}),
    v6Food100g({"id":"u6_molasses","name":"Mật mía","en":"Molasses","aliases":["mật mía","molasses","sugarcane molasses"],"protein":0,"carbs":75,"fat":0,"kcal":300,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":15,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_honey","name":"Mật ong","en":"Honey","aliases":["mật ong","honey"],"protein":0.3,"carbs":82.4,"fat":0,"kcal":331,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":15,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_sugar","name":"Đường","en":"Sugar","aliases":["đường","sugar","granulated sugar"],"protein":0,"carbs":100,"fat":0,"kcal":400,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":10,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_laoganma","name":"Ớt Laoganma","en":"Lao Gan Ma chili crisp","aliases":["ớt laoganma","laoganma","lao gan ma","chili crisp"],"protein":6,"carbs":15,"fat":64,"kcal":660,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.12,"defaultGrams":15,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_chili_oil","name":"Ớt chưng","en":"Chili oil","aliases":["ớt chưng","dầu ớt","chili oil"],"protein":1,"carbs":5,"fat":90,"kcal":834,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.1,"defaultGrams":10,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_olive_oil","name":"Dầu oliu","en":"Olive oil","aliases":["dầu oliu","dầu olive","olive oil"],"protein":0,"carbs":0,"fat":100,"kcal":900,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":14,"allowCookingMethod":false,"perTbsp":124}),
    v6Food100g({"id":"u6_veg_oil","name":"Dầu thực vật","en":"Vegetable oil","aliases":["dầu thực vật","cooking oil","vegetable oil"],"protein":0,"carbs":0,"fat":100,"kcal":900,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":14,"allowCookingMethod":false,"perTbsp":124}),
    v6Food100g({"id":"u6_tahini","name":"Tahini","en":"Tahini sesame paste","aliases":["tahini","sốt mè tahini","sesame paste"],"protein":17,"carbs":21,"fat":54,"kcal":638,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":15,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_hummus","name":"Hummus","en":"Hummus","aliases":["hummus","chickpea dip"],"protein":8,"carbs":14,"fat":10,"kcal":178,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":50,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_sesame_dressing","name":"Sốt mè rang","en":"Roasted sesame dressing","aliases":["sốt mè rang","roasted sesame dressing","sesame dressing"],"protein":3,"carbs":18,"fat":41,"kcal":453,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.15,"defaultGrams":20,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_peanut_butter","name":"Peanut butter","en":"Peanut butter","aliases":["peanut butter","bơ đậu phộng","bơ lạc"],"protein":25,"carbs":20,"fat":50,"kcal":630,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":20,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_jam","name":"Jam","en":"Fruit jam","aliases":["jam","mứt phết bánh mì","fruit jam"],"protein":0.5,"carbs":65,"fat":0.2,"kcal":264,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":20,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_peri_peri","name":"Sốt peri peri","en":"Peri-peri sauce","aliases":["sốt peri peri","peri peri sauce","piri piri sauce"],"protein":1,"carbs":8,"fat":4,"kcal":72,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.25,"defaultGrams":20,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_braised_fish","name":"Cá kho","en":"Vietnamese braised fish","aliases":["cá kho","braised fish","caramelized fish"],"protein":20,"carbs":6,"fat":8,"kcal":176,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.2,"defaultGrams":180,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_sweet_sour_ribs","name":"Sườn xào chua ngọt","en":"Sweet and sour pork ribs","aliases":["sườn xào chua ngọt","sweet and sour pork ribs"],"protein":18,"carbs":15,"fat":18,"kcal":294,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.2,"defaultGrams":200,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_braised_chicken","name":"Gà kho","en":"Vietnamese braised chicken","aliases":["gà kho","braised chicken","caramelized chicken"],"protein":24,"carbs":7,"fat":10,"kcal":214,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.18,"defaultGrams":180,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_nem_chua","name":"Nem chua","en":"Vietnamese fermented pork roll","aliases":["nem chua","fermented pork roll"],"protein":21,"carbs":5,"fat":4,"kcal":140,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":50,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_nem_nuong_thanhhoa","name":"Nem nướng Thanh Hóa","en":"Grilled Thanh Hoa fermented pork","aliases":["nem nướng thanh hóa","nem chua nướng thanh hóa","grilled thanh hoa fermented pork"],"protein":20,"carbs":7,"fat":13,"kcal":225,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.15,"defaultGrams":100,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_nem_thinh","name":"Nem thính","en":"Pork skin with roasted rice powder","aliases":["nem thính","pork skin roasted rice powder"],"protein":18,"carbs":12,"fat":15,"kcal":255,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.08,"defaultGrams":150,"allowCookingMethod":false}),
    v6Food100g({"id":"u6_fried_spring_roll","name":"Chả nem chiên giòn","en":"Crispy fried spring rolls","aliases":["chả nem chiên giòn","nem rán","chả giò chiên","crispy fried spring rolls"],"protein":12,"carbs":25,"fat":17,"kcal":301,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.2,"defaultGrams":120,"allowCookingMethod":false,"gramsPerUnit":35}),
    v6FoodPortion({"id":"u6_tteokbokki","name":"Bánh gạo Hàn Quốc","en":"Tteokbokki","aliases":["bánh gạo hàn quốc","tteokbokki","tokbokki","korean rice cakes"],"protein":14,"carbs":90,"fat":8,"kcal":488,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":400,"unit":"portion","allowCookingMethod":false}),
    v6FoodPortion({"id":"u6_nem_nuong_nhatrang","name":"Nem nướng Nha Trang","en":"Nha Trang grilled pork rolls","aliases":["nem nướng nha trang","nha trang grilled pork rolls"],"protein":30,"carbs":70,"fat":28,"kcal":652,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.18,"grams":500,"unit":"portion","allowCookingMethod":false}),
    v6Food100g({"id":"u6_nem_lui","name":"Nem lụi","en":"Hue grilled pork skewers","aliases":["nem lụi","hue grilled pork skewers"],"protein":18,"carbs":8,"fat":15,"kcal":239,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.15,"defaultGrams":150,"allowCookingMethod":false,"gramsPerUnit":35}),
    v6Food100g({"id":"u6_cheese_fish_ball","name":"Viên cá phô mai","en":"Cheese-filled fish balls","aliases":["viên cá phô mai","cheese fish balls","cheese filled fish balls"],"protein":12,"carbs":18,"fat":14,"kcal":246,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.15,"defaultGrams":100,"allowCookingMethod":false,"gramsPerUnit":25}),
    v6Food100g({"id":"u6_kfc_chicken","name":"Gà rán KFC","en":"KFC fried chicken","aliases":["gà rán kfc","kfc fried chicken","kfc chicken"],"protein":23,"carbs":9,"fat":17,"kcal":281,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.18,"defaultGrams":150,"allowCookingMethod":false,"gramsPerUnit":120}),
    v6FoodPortion({"id":"u6_burger","name":"Burger","en":"Burger","aliases":["burger","hamburger","cheeseburger"],"protein":25,"carbs":31,"fat":24,"kcal":440,"source":"CSDL ưu tiên V6 · khẩu phần món hoàn chỉnh ước tính","rangePct":0.25,"grams":220,"unit":"unit","allowCookingMethod":false,"perUnit":440,"gramsPerUnit":220}),
    v6Food100g({"id":"u6_fries","name":"Khoai tây chiên","en":"French fries","aliases":["khoai tây chiên","french fries","fries"],"protein":3.4,"carbs":41,"fat":15,"kcal":313,"source":"CSDL ưu tiên V6 · giá trị tham chiếu trung bình theo 100 g","rangePct":0.15,"defaultGrams":120,"allowCookingMethod":false}),
  ];

  const COOKING_METHODS_V6 = [
    { key:"deepFried", label:"chiên giòn/ngập dầu", re:/(?:chien gion|chien ngap dau|deep fried|crispy fried)/ },
    { key:"stirFried", label:"xào", re:/(?:^|\s)(?:xao|stir fried|stir fry)(?=\s|$)/ },
    { key:"panFried", label:"chiên/rán/áp chảo", re:/(?:^|\s)(?:chien|ran|ap chao|fried|pan fried|pan seared)(?=\s|$)/ },
    { key:"roasted", label:"quay", re:/(?:^|\s)(?:quay|roasted|rotisserie)(?=\s|$)/ },
    { key:"grilled", label:"nướng", re:/(?:^|\s)(?:nuong|grilled|barbecue|barbecued|bbq)(?=\s|$)/ },
    { key:"steamed", label:"hấp", re:/(?:^|\s)(?:hap|steamed)(?=\s|$)/ },
    { key:"boiled", label:"luộc", re:/(?:^|\s)(?:luoc|boiled|poached)(?=\s|$)/ },
    { key:"stewed", label:"hầm/tần", re:/(?:^|\s)(?:ham|tan|stewed|slow cooked|herbal stew)(?=\s|$)/ },
    { key:"mixed", label:"trộn", re:/(?:^|\s)(?:tron|mixed|tossed)(?=\s|$)/ }
  ];
  const COOKING_ADJUSTMENTS_V6 = {
    leanProtein:{grilled:[0,2],roasted:[0,2],stirFried:[1,5],panFried:[1,8],deepFried:[4,12],mixed:[2,4]},
    fattyProtein:{grilled:[0,0],roasted:[0,0],stirFried:[1,2],panFried:[1,3],deepFried:[3,6],mixed:[2,3]},
    seafood:{grilled:[0,2],roasted:[0,2],stirFried:[1,5],panFried:[1,8],deepFried:[4,11],mixed:[2,4]},
    tofu:{grilled:[0,2],roasted:[0,2],stirFried:[2,5],panFried:[2,8],deepFried:[4,12],mixed:[3,5]},
    vegetable:{grilled:[1,2],roasted:[2,3],stirFried:[2,5],panFried:[3,7],deepFried:[8,10],mixed:[3,5]},
    starch:{grilled:[1,1],roasted:[2,2],stirFried:[2,5],panFried:[3,7],deepFried:[8,11],mixed:[3,5]},
    fruit:{grilled:[1,0],roasted:[2,0],stirFried:[2,2],panFried:[3,3],deepFried:[8,8],mixed:[2,1]}
  };
  function detectCookingMethodV6(norm="") {
    return COOKING_METHODS_V6.find((m)=>m.re.test(norm)) || null;
  }
  function foodAmountGramsV6(food, weight, quantity, kind, isBiteSize) {
    if (weight) {
      let q = +weight[1].replace(",", ".");
      if (["kg","kilogram","kilograms"].includes(weight[2])) q *= 1000;
      return q;
    }
    if (Number.isFinite(quantity)) {
      if (kind === "piece") return quantity * (isBiteSize ? food.gramsPerBite || 18 : food.gramsPerPiece || food.gramsPerUnit || 30);
      if (kind === "unit" && Number.isFinite(food.gramsPerUnit)) return quantity * food.gramsPerUnit;
      if (["bowl","cup","pack","can","whole","unit"].includes(kind) && Number.isFinite(food.defaultGrams)) return quantity * food.defaultGrams;
    }
    return Number.isFinite(food.defaultGrams) ? food.defaultGrams : 100;
  }
  function applyCookingMethodV6({food,norm,match,weight,quantity,kind,isBiteSize,kcal,carbs,fat,basis,confidence}) {
    const method = detectCookingMethodV6(norm);
    if (!method || food?.allowCookingMethod === false || !food?.methodClass)
      return {kcal,carbs,fat,basis,confidence};
    const matched = normalizePhrase(match?.matchedAlias || "");
    if (method.re.test(matched)) return {kcal,carbs,fat,basis,confidence};
    if (["boiled","steamed","stewed"].includes(method.key)) {
      return {kcal,carbs,fat,basis:`${basis} · ${method.label}: không cộng dầu mặc định`,confidence:confidence === "high" ? "medium" : confidence};
    }
    const pair = COOKING_ADJUSTMENTS_V6[food.methodClass]?.[method.key];
    if (!pair) return {kcal,carbs,fat,basis,confidence};
    const grams = Math.max(1, foodAmountGramsV6(food,weight,quantity,kind,isBiteSize));
    const factor = grams / 100, addCarbs = pair[0] * factor, addFat = pair[1] * factor;
    return {
      kcal:Math.round(kcal + addCarbs * 4 + addFat * 9),
      carbs:carbs + addCarbs,
      fat:fat + addFat,
      basis:`${basis} · ${method.label}: cộng khoảng ${fmt(addCarbs,1)} g Carb + ${fmt(addFat,1)} g Fat cho ${fmt(grams)} g`,
      confidence:confidence === "exact" ? "exact" : "medium"
    };
  }

  const ONLINE_FOOD_CACHE_KEY = "inAndOutOnlineFoodCacheV67",
    ONLINE_LOOKUP_FAIL_KEY = "inAndOutLookupFailuresV67",
    GEMINI_API_KEY_STORAGE = "inAndOutGeminiApiKeyV1",
    GEMINI_MODEL = "gemini-3.6-flash";
  let activeGeminiModel = GEMINI_MODEL;
  async function discoverGeminiModels(apiKey) {
    const models=[]; let token="";
    do {
      const url=new URL("https://generativelanguage.googleapis.com/v1beta/models");
      url.searchParams.set("pageSize","1000");
      if(token)url.searchParams.set("pageToken",token);
      const response=await fetch(url,{headers:{"x-goog-api-key":apiKey},signal:AbortSignal.timeout(20000)});
      const data=await response.json();
      if(!response.ok)throw new Error(geminiErrorMessage(response.status,data));
      models.push(...(data.models||[]));token=data.nextPageToken||"";
    }while(token);
    return models.filter(m=>m.supportedGenerationMethods?.includes("generateContent") && /^models\/gemini-.*flash/.test(m.name) && !/image|audio|tts|live|native|experimental/.test(m.name)).map(m=>m.name.replace(/^models\//,"")).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  }
  function strip(text = "") {
    return String(text)
      .toLowerCase()
      .replace(/dứa/g, "duapineapple")
      .replace(/dừa/g, "duacoconut")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  }
  function cleanNumber(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(
      String(v)
        .replace(",", ".")
        .replace(/[^0-9.-]/g, ""),
    );
    return Number.isFinite(n) ? n : null;
  }
  function fmt(n, d = 0) {
    return Number.isFinite(n)
      ? n.toLocaleString("vi-VN", {
          maximumFractionDigits: d,
          minimumFractionDigits: d,
        })
      : "—";
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  function escapeHtml(s = "") {
    return String(s).replace(
      /[&<>'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c],
    );
  }
  function formatFoodText(s = "") {
    return String(s)
      .replace(/\s*\+\s*/g, " • ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  function makeCalendarDate(year, monthIndex, day) {
    year = Number(year);
    monthIndex = Number(monthIndex);
    day = Number(day);
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(monthIndex) ||
      !Number.isInteger(day) ||
      year < 1900 ||
      year > 2200 ||
      monthIndex < 0 ||
      monthIndex > 11 ||
      day < 1 ||
      day > 31
    )
      return null;
    const d = new Date(year, monthIndex, day, 12, 0, 0, 0);
    return d.getFullYear() === year &&
      d.getMonth() === monthIndex &&
      d.getDate() === day
      ? d
      : null;
  }
  function vietnamDateParts(value = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: VI_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const get = (t) => Number(parts.find((p) => p.type === t)?.value);
    return { year: get("year"), month: get("month"), day: get("day") };
  }
  function getVietnamToday() {
    const p = vietnamDateParts(new Date());
    return makeCalendarDate(p.year, p.month - 1, p.day);
  }
  function parseDate(v, slashOrder = "DMY") {
    if (v === null || v === undefined || v === "") return null;
    const validDate = (year, monthIndex, day) => {
      if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;
      if (year < 2000 || year > 2100 || monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
      const d = makeCalendarDate(year, monthIndex, day);
      return d.getFullYear() === year && d.getMonth() === monthIndex && d.getDate() === day ? d : null;
    };
    if (v instanceof Date && !Number.isNaN(v.getTime()))
      return validDate(v.getFullYear(), v.getMonth(), v.getDate());
    if (typeof v === "number" && Number.isFinite(v)) {
      const serial = Math.floor(v);
      if (serial > 20000 && serial < 100000) {
        const utcMs = Date.UTC(1899, 11, 30) + serial * 86400000,
          d = new Date(utcMs);
        return validDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      }
    }
    const s = String(v).trim().replace(/^['"]|['"]$/g, "");
    let m = s.match(/(?:new\s+)?Date\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})(?:\s*,[^)]*)?\s*\)/i);
    if (m) return validDate(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})(?:[T\s].*)?$/);
    if (m) return validDate(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s+.*)?$/);
    if (m) {
      const a = +m[1], b = +m[2], year = +m[3];
      if (slashOrder === "MDY") return validDate(year, a - 1, b);
      if (slashOrder === "DMY") return validDate(year, b - 1, a);
      if (a > 12 && b <= 12) return validDate(year, b - 1, a);
      if (b > 12 && a <= 12) return validDate(year, a - 1, b);
      return validDate(year, a - 1, b) || validDate(year, b - 1, a);
    }
    if (/^\d+(?:\.\d+)?$/.test(s)) {
      const n = Number(s);
      if (n > 20000 && n < 100000) return parseDate(n);
    }
    return null;
  }
  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function formatDateVi(d) {
    return d instanceof Date && !Number.isNaN(d.getTime())
      ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
      : "—";
  }
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function escapeRegExp(s = "") {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function normalizePhrase(text = "") {
    return strip(text)
      .replace(/[^a-z0-9.%/]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  /* V51: giữ dấu cho exact match tiếng Việt để phân biệt các tên như “Cốm” và “Cơm”. */
  function normalizePhraseAccentV51(text = "") {
    return String(text)
      .toLowerCase()
      .normalize("NFC")
      .replace(/[^a-z0-9à-ỹđ.%/]+/gi," ")
      .replace(/\s+/g," ")
      .trim();
  }
  function getOnlineFoods() {
    try {
      const x = JSON.parse(localStorage.getItem(ONLINE_FOOD_CACHE_KEY) || "[]");
      return Array.isArray(x) ? x : [];
    } catch {
      return [];
    }
  }
  let FOOD_INDEX_CACHE = null;
  const FOOD_MATCH_MEMO = new Map(), FOOD_ESTIMATE_MEMO = new Map();
  function invalidateFoodIndex() { FOOD_INDEX_CACHE = null; V68_FOOD_TOKEN_SET = null; FOOD_MATCH_MEMO.clear(); FOOD_ESTIMATE_MEMO.clear(); }
  function saveOnlineFoods(items) {
    try {
      localStorage.setItem(
        ONLINE_FOOD_CACHE_KEY,
        JSON.stringify(items.slice(0, 300)),
      );
      invalidateFoodIndex();
    } catch {}
  }
  /* V52 · Hồ sơ parser-only cho cách nhập chung chung trong Excel.
     Không đưa các dòng này vào trang Thực phẩm để giữ nguyên danh sách hiển thị.
     Đây là giá trị trung bình tham chiếu, dùng khi người dùng chỉ ghi “rau”, “hoa quả” hoặc “rau củ quả”. */
  const GENERIC_PRODUCE_PARSER_V52 = [
    {
      id:"generic_vegetables_v52", name:"Rau (ước tính chung)", en:"Generic vegetables",
      aliases:["rau","rau củ","rau cu","rau xanh","các loại rau","cac loai rau","vegetable","vegetables","mixed vegetables","fresh vegetables","greens"],
      per100g:30, protein100g:1.8, carbs100g:5.2, fat100g:0.3,
      defaultKcal:30, defaultProtein:1.8, defaultCarbs:5.2, defaultFat:0.3, defaultGrams:100,
      priority:2000000, rangePct:0.30, rangeNote:"vì loại rau cụ thể có thể khác đáng kể",
      genericEstimateV52:true, genericNote:"ước tính chung cho rau không xác định loại", source:"Hồ sơ ước tính chung V52"
    },
    {
      id:"generic_fruit_v52", name:"Hoa quả (ước tính chung)", en:"Generic fruit",
      aliases:["hoa quả","hoa qua","trái cây","trai cay","các loại hoa quả","cac loai hoa qua","fruit","fruits","mixed fruit","fresh fruit","mixed fruits"],
      per100g:55, protein100g:0.7, carbs100g:13.0, fat100g:0.2,
      defaultKcal:55, defaultProtein:0.7, defaultCarbs:13.0, defaultFat:0.2, defaultGrams:100,
      priority:2000000, rangePct:0.30, rangeNote:"vì loại hoa quả cụ thể có thể khác đáng kể",
      genericEstimateV52:true, genericNote:"ước tính chung cho hoa quả không xác định loại", source:"Hồ sơ ước tính chung V52"
    },
    {
      id:"generic_produce_mix_v52", name:"Rau củ quả (ước tính chung)", en:"Generic fruit and vegetables",
      aliases:["rau củ quả","rau cu qua","rau củ và hoa quả","rau cu va hoa qua","rau và hoa quả","rau va hoa qua","rau hoa quả","rau hoa qua","vegetables and fruit","vegetables and fruits","fruit and vegetables","fruits and vegetables","mixed fruit and vegetables","mixed fruits and vegetables"],
      per100g:44, protein100g:1.2, carbs100g:9.1, fat100g:0.3,
      defaultKcal:44, defaultProtein:1.2, defaultCarbs:9.1, defaultFat:0.3, defaultGrams:100,
      priority:2100000, rangePct:0.35, rangeNote:"vì tỉ lệ rau/hoa quả và loại thực phẩm thực tế không được ghi rõ",
      genericEstimateV52:true, genericNote:"ước tính chung cho hỗn hợp rau củ và hoa quả không xác định loại", source:"Hồ sơ ước tính chung V52"
    }
  ];

  /* V53 · Khóa nhận diện trực tiếp cho “rau / hoa quả / rau củ quả”.
     Chạy trước mọi fuzzy-match để cache online cũ hoặc tên gần giống không thể chiếm kết quả. */
  function findGenericProduceV53(text="") {
    const cleaned = normalizePhrase(cleanLookupQuery(String(text||"")))
      .replace(/\b(?:tuoi|fresh|song|raw)\b/g," ")
      .replace(/\s+/g," ").trim();
    if(!cleaned) return null;
    let best=null;
    for(const food of GENERIC_PRODUCE_PARSER_V52){
      for(const raw of [food.name,food.en,...(food.aliases||[])].filter(Boolean)){
        const alias=normalizePhrase(raw);
        if(cleaned===alias){
          const score=(Number(food.priority)||0)+alias.length*20;
          if(!best||score>best.score) best={food,score:9500000+score,matchedAlias:raw,genericExactV53:true};
        }
      }
    }
    return best;
  }

  function baseFoodsV50() {
    return [
      ...USER_FOOD_DB_V6,
      ...FOOD_DB_V4,
      ...PRO_FOOD_DB_V3,
      ...FOOD_DB,
      ...VI_FOOD_DB_EXTRA,
      ...getOnlineFoods(),
    ];
  }
  function allFoods() {
    /* V50: dữ liệu đang hiển thị trên trang Thực phẩm là nguồn chuẩn cao nhất cho bộ nhận diện Excel. */
    return [
      ...GENERIC_PRODUCE_PARSER_V52,
      ...getAuthoritativeFoodDbV50(),
      ...baseFoodsV50(),
      /* V53: Excel chỉ nhận diện từ danh mục nội bộ + hồ sơ chung.
         Dữ liệu USDA/OFF online chỉ phục vụ ô tìm kiếm, tuyệt đối không được chiếm alias món đã nhập trong Sheet. */
    ];
  }
  function foodIndex() {
    if (FOOD_INDEX_CACHE) return FOOD_INDEX_CACHE;
    const exact = new Map(), exactAccent = new Map(), aliases = [], catalogTexts = [];
    for (const item of allFoods()) {
      /* V68: gắn bí danh bổ sung tại đây để phủ được CẢ hồ sơ cũ (id milk_coffee…)
         lẫn hồ sơ sinh từ bảng Thực phẩm — hai nguồn này đi hai đường khác nhau. */
      const extraAliases = [item.name, item.en].filter(Boolean)
        .flatMap((n)=>V68_EXTRA_ALIASES.get(String(n).toLowerCase().normalize("NFC").trim())||[]);
      for (const raw of [item.name, item.en, ...(item.aliases || []), ...extraAliases].filter(Boolean)) {
        const key = normalizePhrase(raw);
        const accentKey = normalizePhraseAccentV51(raw);
        if (!key) continue;
        const primaryBoost = raw===item.name ? 50000 : (item.en && raw===item.en ? 40000 : 0);
        const score = (Number(item.priority) || 0) + primaryBoost + key.length * 20 + key.split(" ").length * 100;
        const current = exact.get(key);
        if (!current || score > current.baseScore) exact.set(key, { food:item, matchedAlias:raw, baseScore:score });
        if (accentKey) {
          const currentAccent = exactAccent.get(accentKey);
          if (!currentAccent || score > currentAccent.baseScore) exactAccent.set(accentKey,{food:item,matchedAlias:raw,baseScore:score});
        }
        aliases.push({ key, raw, food:item, baseScore:score });
      }
      if (item.authoritativeV50 && item.catalogAliasText) {
        const text = normalizePhrase(item.catalogAliasText);
        if (text) catalogTexts.push({
          text,
          accentText: normalizePhraseAccentV51(item.catalogAliasText),
          singularText: singularizeEnglish(text),
          food: item,
          sourceScore: Number(item.catalogSourceScore) || 0,
          curated: !!item.catalogCurated
        });
      }
    }
    aliases.sort((a,b)=>b.key.length-a.key.length || b.baseScore-a.baseScore);
    catalogTexts.sort((a,b)=>(b.curated-a.curated)||(b.sourceScore-a.sourceScore)||b.text.length-a.text.length);
    FOOD_INDEX_CACHE = { exact, exactAccent, aliases, catalogTexts };
    return FOOD_INDEX_CACHE;
  }
  function setLookupText(text) {
    setText("lookupText", text);
  }
  function getLookupFailures() {
    try {
      const x = JSON.parse(
        localStorage.getItem(ONLINE_LOOKUP_FAIL_KEY) || "{}",
      );
      return x && typeof x === "object" ? x : {};
    } catch {
      return {};
    }
  }
  function saveLookupFailures(x) {
    try {
      localStorage.setItem(ONLINE_LOOKUP_FAIL_KEY, JSON.stringify(x));
    } catch {}
  }
  function cleanLookupQuery(text = "") {
    return String(text)
      .replace(
        /\b\d+(?:[.,]\d+)?\s*(?:kcal|kg|kilograms?|g|grams?|ml|l|lit(?:er|re)?s?|cái|chiếc|quả|trái|miếng|viên|cuốn|ổ|cốc|ly|bát|chén|tô|đĩa|hộp|gói|bịch|lon|que|xiên|thìa|muỗng|lát|servings?|pieces?|pcs?|units?|cups?|bowls?|glasses?|packs?|packets?|cans?)\b/gi,
        " ",
      )
      .replace(/\b\d+(?:[.,]\d+)?\b/g, " ")
      .replace(/[=,:;+/]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function translateVietnameseQuery(text = "") {
    let q = strip(text);
    const pairs = [
      ["banh bao", "steamed bun"],
      ["banh mi", "vietnamese sandwich"],
      ["pho", "pho noodle soup"],
      ["bun bo", "beef rice noodle soup"],
      ["bun cha", "grilled pork rice noodles"],
      ["bun", "rice noodles"],
      ["com rang", "fried rice"],
      ["com", "cooked rice"],
      ["xoi", "sticky rice"],
      ["chao", "rice porridge"],
      ["mi", "noodles"],
      ["thit lon", "pork"],
      ["thit heo", "pork"],
      ["thit bo", "beef"],
      ["thit ga", "chicken"],
      ["ga", "chicken"],
      ["ca", "fish"],
      ["tom", "shrimp"],
      ["trung", "egg"],
      ["dau phu", "tofu"],
      ["rau", "vegetable"],
      ["canh", "soup"],
      ["chien", "fried"],
      ["ran", "fried"],
      ["nuong", "grilled"],
      ["luoc", "boiled"],
      ["xao", "stir fried"],
      ["hap", "steamed"],
      ["sua", "milk"],
      ["nuoc ep", "juice"],
      ["tra sua", "milk tea"],
      ["banh", "cake"],
    ];
    for (const [a, b] of pairs)
      q = q.replace(new RegExp(`(^|\\s)${a}(?=\\s|$)`, "g"), ` ${b} `);
    return q.replace(/\s+/g, " ").trim();
  }
  function heuristicFoodFor(norm, original) {
    const has = (...xs) =>
      xs.some((x) => new RegExp(`(^|\\s)${x}(?=\\s|$)`).test(norm));
    let f = {
      id: `auto_${Math.abs([...norm].reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0))}`,
      name: cleanLookupQuery(original) || "Món tự động",
      en: "",
      aliases: [cleanLookupQuery(original), norm],
      per100g: 200,
      defaultKcal: 220,
      source: "Ước lượng tự động tạm thời",
      isHeuristic: true,
    };
    if (
      has(
        "pho",
        "bun",
        "mi",
        "noodle",
        "noodles",
        "rice",
        "com",
        "xoi",
        "chao",
        "soup",
        "canh",
      )
    )
      Object.assign(f, { per100g: 140, perBowl: 450, defaultKcal: 450 });
    else if (
      has("drink", "juice", "coffee", "tea", "milk", "sua", "nuoc", "smoothie")
    )
      Object.assign(f, { per100ml: 55, perCup: 180, defaultKcal: 180 });
    else if (has("vegetable", "vegetables", "rau", "salad", "cucumber"))
      Object.assign(f, { per100g: 55, defaultKcal: 110 });
    else if (
      has(
        "fruit",
        "banana",
        "apple",
        "orange",
        "mango",
        "grape",
        "chuoi",
        "tao",
        "cam",
        "xoai",
        "nho",
      )
    )
      Object.assign(f, { per100g: 65, perUnit: 100, defaultKcal: 100 });
    else if (
      has(
        "chicken",
        "beef",
        "pork",
        "fish",
        "shrimp",
        "meat",
        "ga",
        "bo",
        "heo",
        "lon",
        "ca",
        "tom",
      )
    )
      Object.assign(f, { per100g: 210, defaultKcal: 250 });
    else if (has("fried", "chien", "ran"))
      Object.assign(f, { per100g: 280, defaultKcal: 350 });
    else if (has("cake", "bread", "bun", "banh", "pastry", "snack"))
      Object.assign(f, { per100g: 300, perUnit: 250, defaultKcal: 250 });
    return f;
  }
  function fetchJsonWithTimeout(url, timeout = 3500) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), timeout);
    return fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .finally(() => clearTimeout(timer));
  }
  function tokenScore(a = "", b = "") {
    const aa = new Set(
        normalizePhrase(a)
          .split(" ")
          .filter((x) => x.length > 1),
      ),
      bb = new Set(
        normalizePhrase(b)
          .split(" ")
          .filter((x) => x.length > 1),
      );
    let hit = 0;
    aa.forEach((x) => {
      if (bb.has(x)) hit++;
    });
    return aa.size ? hit / aa.size : 0;
  }
  async function lookupOpenFoodFacts(query) {
    const fields =
      "product_name,product_name_vi,nutriments,serving_quantity,serving_size,countries_tags";
    const build = (country) =>
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24${country ? `&tagtype_0=countries&tag_contains_0=contains&tag_0=${country}` : ""}&fields=${fields}`;
    let data = await fetchJsonWithTimeout(build("vietnam"));
    let products = scoreOpenFoodProducts(data, query);
    if (!products.length || products[0].score < 0.34) {
      try {
        data = await fetchJsonWithTimeout(build(""));
        products = scoreOpenFoodProducts(data, query);
      } catch {}
    }
    if (!products.length || products[0].score < 0.34) return null;
    const { p, k, protein, carbs, fat } = products[0],
      serv = Number(p.serving_quantity);
    return {
      id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: p.product_name_vi || p.product_name || query,
      en: p.product_name || p.product_name_vi || query,
      aliases: [query],
      per100g: Math.round(k),
      protein100g: Number.isFinite(protein) && protein >= 0 ? protein : null,
      carbs100g: Number.isFinite(carbs) && carbs >= 0 ? carbs : null,
      fat100g: Number.isFinite(fat) && fat >= 0 ? fat : null,
      defaultKcal:
        Number.isFinite(serv) && serv > 0
          ? Math.round((k * serv) / 100)
          : Math.round(k),
      defaultCarbs:
        Number.isFinite(serv) && serv > 0 && Number.isFinite(carbs)
          ? (carbs * serv) / 100
          : null,
      defaultFat:
        Number.isFinite(serv) && serv > 0 && Number.isFinite(fat)
          ? (fat * serv) / 100
          : null,
      source: "Open Food Facts · sản phẩm đóng gói",
      onlineConfidence: "medium",
    };
  }
  function scoreOpenFoodProducts(data, query) {
    return (data.products || [])
      .map((p) => {
        const n = p.nutriments || {},
          k = Number(n["energy-kcal_100g"] ?? n["energy-kcal"]),
          protein = Number(n.proteins_100g),
          carbs = Number(n.carbohydrates_100g),
          fat = Number(n.fat_100g);
        return {
          p,
          k,
          protein,
          carbs,
          fat,
          score: Math.max(
            tokenScore(query, p.product_name_vi || ""),
            tokenScore(query, p.product_name || ""),
          ),
        };
      })
      .filter((x) => Number.isFinite(x.k) && x.k > 0 && x.k < 1000)
      .sort((a, b) => b.score - a.score);
  }
  async function lookupUsda(query) {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&query=${encodeURIComponent(query)}&pageSize=8`;
    const data = await fetchJsonWithTimeout(url),
      foods = (data.foods || [])
        .map((f) => {
          const nutrients = f.foodNutrients || [],
            en = nutrients.find(
              (n) =>
                Number(n.nutrientId) === 1008 ||
                (/energy/i.test(n.nutrientName || "") &&
                  String(n.unitName || "").toUpperCase() === "KCAL"),
            ),
            pn = nutrients.find(
              (n) =>
                Number(n.nutrientId) === 1003 ||
                /protein/i.test(n.nutrientName || ""),
            ),
            cn = nutrients.find(
              (n) =>
                Number(n.nutrientId) === 1005 ||
                /carbohydrate/i.test(n.nutrientName || ""),
            ),
            fn = nutrients.find(
              (n) =>
                Number(n.nutrientId) === 1004 ||
                /total lipid|total fat|fat/i.test(n.nutrientName || ""),
            ),
            k = Number(en?.value),
            protein = Number(pn?.value),
            carbs = Number(cn?.value),
            fat = Number(fn?.value),
            priority =
              {
                Foundation: 4,
                "SR Legacy": 4,
                "Survey (FNDDS)": 3,
                Branded: 1,
              }[f.dataType] || 2;
          return {
            f,
            k,
            protein,
            carbs,
            fat,
            score: tokenScore(query, f.description || "") + priority * 0.08,
          };
        })
        .filter((x) => Number.isFinite(x.k) && x.k > 0 && x.k < 1000)
        .sort((a, b) => b.score - a.score);
    if (!foods.length || foods[0].score < 0.28) return null;
    const { f, k, protein, carbs, fat } = foods[0],
      serv = Number(f.servingSize),
      unit = String(f.servingSizeUnit || "").toLowerCase();
    return {
      id: `usda_${f.fdcId || Date.now()}`,
      name: f.description || query,
      en: f.description || query,
      aliases: [query],
      per100g: Math.round(k),
      protein100g: Number.isFinite(protein) && protein >= 0 ? protein : null,
      carbs100g: Number.isFinite(carbs) && carbs >= 0 ? carbs : null,
      fat100g: Number.isFinite(fat) && fat >= 0 ? fat : null,
      defaultKcal:
        Number.isFinite(serv) && serv > 0 && unit === "g"
          ? Math.round((k * serv) / 100)
          : Math.round(k),
      defaultCarbs:
        Number.isFinite(serv) &&
        serv > 0 &&
        unit === "g" &&
        Number.isFinite(carbs)
          ? (carbs * serv) / 100
          : null,
      defaultFat:
        Number.isFinite(serv) &&
        serv > 0 &&
        unit === "g" &&
        Number.isFinite(fat)
          ? (fat * serv) / 100
          : null,
      source: "USDA FoodData Central",
      onlineConfidence: "medium",
    };
  }
  async function lookupFoodOnline(original) {
    const raw = cleanLookupQuery(original);
    if (!raw || raw.length < 2) return null;
    const translated = translateVietnameseQuery(raw) || raw;
    const normRaw = normalizePhrase(raw),
      looksPackaged =
        /\b(?:whey|protein bar|oreo|coca|pepsi|yakult|milo|vinamilk|th true|snack|chips|biscuit|cookie|cereal|yogurt|sua|mi goi|instant|barcode)\b/.test(
          normRaw,
        ) || /^\d{8,14}$/.test(normRaw);
    if (!looksPackaged) {
      try {
        const usda = await lookupUsda(translated);
        if (usda) return usda;
      } catch {}
    }
    try {
      const off = await lookupOpenFoodFacts(raw);
      if (off) return off;
    } catch {}
    if (looksPackaged) {
      try {
        const usda = await lookupUsda(translated);
        if (usda) return usda;
      } catch {}
    }
    return null;
  }
  function unresolvedQueriesFromRows(rows) {
    const seen = new Set(),
      out = [],
      failed = getLookupFailures(),
      now = Date.now();
    for (const r of rows) {
      /* V68: dùng chung bộ tách món với parser, nếu không thì các món lạ nằm sau
         dấu phẩy sẽ không bao giờ được gửi đi tra cứu/AI. */
      const segments = splitFoodSegmentsV51(String(r.food ?? ""));
      for (const seg of segments) {
        const norm = normalizePhrase(seg);
        if (/\d+(?:[.,]\d+)?\s*kcal\b/.test(norm) || findFood(seg)) continue;
        const q = cleanLookupQuery(seg),
          key = normalizePhrase(q);
        if (failed[key] && now - failed[key] < 21600000) continue;
        if (key && !seen.has(key)) {
          seen.add(key);
          out.push({ original: seg, key });
        }
      }
    }
    return out;
  }
  let onlineLookupBusy = false;
  function getGeminiApiKey() {
    try { return String(localStorage.getItem(GEMINI_API_KEY_STORAGE) || "").trim(); }
    catch (_) { return ""; }
  }
  function geminiErrorMessage(status, payload) {
    const detail = payload?.error?.message || "";
    if (status === 400) return "API key hoặc yêu cầu Gemini không hợp lệ.";
    if (status === 401 || status === 403) return "API key Gemini không hợp lệ hoặc chưa được cấp quyền.";
    if (status === 429) return "Gemini đã hết hạn mức tạm thời. Hãy thử lại sau.";
    if(status===404 || /no longer|not found|not available/i.test(detail))return "Model Gemini không còn khả dụng. Hãy thử Lưu & kiểm tra lại để chọn model khác.";
    return `Không gọi được Gemini (HTTP ${status}). Hãy thử lại sau.`;
  }
  async function callGeminiFoodParser(segments, apiKey = getGeminiApiKey()) {
    if (!apiKey) throw new Error("Chưa nhập Gemini API key.");
    const schema = {type:"OBJECT",properties:{foods:{type:"ARRAY",items:{type:"OBJECT",properties:{
      original:{type:"STRING"},canonicalName:{type:"STRING"},aliases:{type:"ARRAY",items:{type:"STRING"}},
      per100g:{type:"NUMBER"},protein100g:{type:"NUMBER"},carbs100g:{type:"NUMBER"},fat100g:{type:"NUMBER"},
      defaultGrams:{type:"NUMBER"},gramsPerUnit:{type:"NUMBER"},confidence:{type:"NUMBER"},note:{type:"STRING"}
    },required:["original","canonicalName","per100g","protein100g","carbs100g","fat100g","defaultGrams","gramsPerUnit","confidence"]}}},required:["foods"]};
    const prompt = `Bạn là bộ chuẩn hóa thực phẩm cho ứng dụng dinh dưỡng Việt Nam. Với từng chuỗi đầu vào, trả đúng một mục theo cùng thứ tự. Hiểu số lượng, đơn vị, cách chế biến và tên địa phương. Dinh dưỡng là kcal, protein, carb, fat trên 100 g phần ăn được; defaultGrams là khối lượng khẩu phần khi không ghi; gramsPerUnit là gram cho 1 quả/cái/miếng/hộp/bát phù hợp. Ví dụ 1 trứng gà nguyên quả khoảng 50 g. Không nhân dinh dưỡng theo số lượng trong kết quả. Món hỗn hợp dùng trung bình hợp lý và confidence thấp hơn. confidence từ 0 đến 1. Đầu vào JSON: ${JSON.stringify(segments)}`;
    const body=JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.1,responseMimeType:"application/json",responseSchema:schema}});
    const request=async(model)=>{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},body,signal:AbortSignal.timeout(45000)});
      return {response,payload:await response.json().catch(()=>null)};
    };
    let {response,payload}=await request(activeGeminiModel);
    if(!response.ok && (response.status===404 || /no longer|not found|not available/i.test(payload?.error?.message||""))){
      const candidates=await discoverGeminiModels(apiKey);
      for(const model of candidates.filter(m=>m!==activeGeminiModel).slice(0,3)){
        ({response,payload}=await request(model));
        if(response.ok){activeGeminiModel=model;break;}
        if(response.status===429 || response.status===401 || response.status===403)break;
      }
    }
    if (!response.ok) throw new Error(geminiErrorMessage(response.status,payload));
    const output = payload?.candidates?.[0]?.content?.parts?.map((part)=>part.text||"").join("") || "";
    const parsed = JSON.parse(output);
    if (!Array.isArray(parsed?.foods)) throw new Error("Gemini không trả về dữ liệu món ăn hợp lệ.");
    return parsed.foods;
  }
  function hashTextV64(text="") { let h=2166136261; for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);} return (h>>>0).toString(36); }
  function geminiResultToFood(result, requested) {
    if(!result || result.original!==requested || typeof result.canonicalName!=="string")return null;
    if(!["per100g","protein100g","carbs100g","fat100g","defaultGrams","gramsPerUnit","confidence"].every(k=>typeof result[k]==="number"&&Number.isFinite(result[k])))return null;
    if(result.confidence<0.65||result.confidence>1||result.per100g<0||result.per100g>950||result.defaultGrams<=0||result.gramsPerUnit<=0)return null;
    if([result.protein100g,result.carbs100g,result.fat100g].some(n=>n<0||n>100)||result.protein100g+result.carbs100g+result.fat100g>105)return null;
    const canonical=String(result?.canonicalName||requested||"").trim(),known=canonical?findFood(canonical)?.food:null;
    const aliases=[v68FoodName(requested),canonical];
    if(known)return {...known,id:`ai_alias_${hashTextV64(requested)}`,aliases:[...(known.aliases||[]),...aliases],source:`${known.source||"CSDL nội bộ"} · tên món do Gemini chuẩn hóa`,aiRecognized:true};
    const finite=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?clamp(n,min,max):fallback;};
    const kcal=finite(result?.per100g,0,950,0),protein=finite(result?.protein100g,0,100,0),carbs=finite(result?.carbs100g,0,100,0),fat=finite(result?.fat100g,0,100,0),defaultGrams=finite(result?.defaultGrams,1,2000,100),confidence=finite(result?.confidence,0,1,.65);
    if(!canonical||kcal<=0)return null;
    return {id:`ai_food_${hashTextV64(requested)}`,name:canonical,en:canonical,aliases,per100g:kcal,protein100g:protein,carbs100g:carbs,fat100g:fat,defaultKcal:kcal,defaultProtein:protein,defaultCarbs:carbs,defaultFat:fat,defaultGrams,gramsPerUnit:finite(result?.gramsPerUnit,1,2000,defaultGrams),priority:1500000,rangePct:clamp(1-confidence,.1,.45),source:"Gemini AI · ước tính dinh dưỡng",onlineConfidence:confidence>=.8?"medium":"low",aiRecognized:true};
  }
  async function resolveUnknownFoods(rows) {
    if (onlineLookupBusy) return false;
    const queue = unresolvedQueriesFromRows(rows);
    if (!queue.length) {
      setLookupText("Nhận diện nhanh: toàn bộ món đã có dữ liệu nội bộ");
      return false;
    }
    onlineLookupBusy = true;
    setLookupText(`Nhận diện nhanh hoàn tất · đang bổ sung nền ${queue.length} món lạ`);
    let cache = getOnlineFoods(), changed = false, failures = getLookupFailures();
    try {
      let results=[];
      if(getGeminiApiKey()){
        try{
          for(let offset=0;offset<queue.length;offset+=12){
            const batch=queue.slice(offset,offset+12);
            const aiFoods=await callGeminiFoodParser(batch.map(q=>q.original));
            results.push(...batch.map(item=>{
              const matches=aiFoods.filter(food=>food.original===item.original);
              return {item,food:matches.length===1?geminiResultToFood(matches[0],item.original):null};
            }));
          }
        }catch(error){setLookupText(error.message||"Gemini chưa thể nhận diện món.");return false;}
      }
      if(!results.length){setLookupText("Có món cần Gemini nhận diện. Bấm API key để kết nối; món chưa rõ chưa được cộng vào tổng.");return false;}
      for (const {item:q, food:item} of results) {
        if (item) {
          item.aliases = [...new Set([...(item.aliases || []), v68FoodName(q.original)])];
          cache = cache.filter((x) => x.id !== item.id && !item.aliases.some((a) => (x.aliases || []).includes(a)));
          cache.unshift(item);
          delete failures[q.key];
          changed = true;
        } else failures[q.key] = Date.now();
      }
      if (changed) saveOnlineFoods(cache);
      saveLookupFailures(failures);
      setLookupText(changed ? "Nhận diện nhanh · dữ liệu món lạ đã được bổ sung" : "Món lạ chưa được tính để tránh sai calo và macro");
      if (changed) render();
      return changed;
    } finally {
      onlineLookupBusy = false;
    }
  }


  function foodCoreV6(text = "") {
    return cleanLookupQuery(text)
      .replace(/\b(?:luoc|hap|xao|chien|ran|ap chao|quay|nuong|ham|tan|tron|boiled|steamed|stir fried|stir fry|fried|pan fried|pan seared|roasted|rotisserie|grilled|barbecue|barbecued|bbq|stewed|slow cooked|mixed|tossed)\b/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  function foodMatchScore(norm, key, item = null) {
    const cleanKey = normalizePhrase(key);
    if (!cleanKey) return -1;
    const pattern = escapeRegExp(cleanKey).replace(/\s+/g, "\\s+"),
      re = new RegExp(`(^|[^a-z0-9])${pattern}(?=$|[^a-z0-9])`, "i");
    if (!re.test(norm)) return -1;
    const exact = norm === cleanKey ? 5000 : 0;
    const words = cleanKey.split(" ").length;
    const normCore = foodCoreV6(norm), keyCore = foodCoreV6(cleanKey);
    const coreExact = keyCore && normCore === keyCore ? 2000 : 0;
    const priority = Number(item?.priority) || 0;
    return exact + coreExact + priority + cleanKey.length * 20 + words * 100;
  }
  function singularizeEnglish(text = "") {
    return String(text)
      .split(" ")
      .map((w) => {
        if (w.length <= 3) return w;
        if (/ies$/.test(w)) return w.slice(0, -3) + "y";
        if (/(ches|shes|xes|zes|ses)$/.test(w)) return w.slice(0, -2);
        if (/s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
        return w;
      })
      .join(" ");
  }
  function cleanCatalogAliasQueryV51(query) {
    return normalizePhrase(query)
      .replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|kilogram|kilograms|g|gram|grams|ml|l|lit|liter|litre|liters|litres|cai|chiec|qua|trai|mieng|vien|cuon|o|coc|ly|bat|chen|to|dia|plate|plates|hop|box|boxes|bich|bag|bags|goi|lon|que|xien|skewer|skewers|thia|muong|lat|slice|slices|serving|servings|phan|suat|piece|pieces|pc|pcs|unit|units|cup|cups|bowl|bowls|glass|glasses|pack|packet|packets|can|cans|con|whole|bird)\b/g," ")
      .replace(/\b\d+(?:[.,]\d+)?\b/g," ")
      .replace(/\s+/g," ").trim();
  }
  function authoritativeCatalogAliasMatchV51(query, idx) {
    const raw = normalizePhrase(query);
    const cleaned = cleanCatalogAliasQueryV51(query);
    if ((!raw && !cleaned) || !idx?.catalogTexts?.length) return null;
    const variants = [...new Set([cleaned, raw, singularizeEnglish(cleaned), singularizeEnglish(raw)].filter(Boolean))];
    const genericSingles = new Set([
      "raw","cooked","fresh","dried","food","dish","meal","meat","fish","rice","bread","cake","cheese","milk","bean","beans","seed","seeds","drink","tea","coffee","soup","noodle","noodles"
    ]);
    const matches = [];
    for (const entry of idx.catalogTexts) {
      let hitVariant = "";
      for (const variant of variants) {
        const words = variant.split(" ").filter(Boolean);
        if (!variant || (words.length === 1 && (variant.length < 4 || genericSingles.has(variant)))) continue;
        const pattern = escapeRegExp(variant).replace(/\s+/g, "\\s+");
        const re = new RegExp(`(^|[^a-z0-9])${pattern}(?=$|[^a-z0-9])`, "i");
        if (re.test(entry.text) || re.test(entry.singularText)) { hitVariant = variant; break; }
      }
      if (!hitVariant) continue;
      const words = hitVariant.split(" ").length;
      const canonical = normalizePhrase(entry.food?.name || "");
      const curatedBoost = entry.curated ? 50000 : 0;
      const canonicalBoost = canonical === hitVariant ? 100000 : 0;
      const contextWords = entry.text.split(" ").filter(Boolean).length;
      const specificityBoost = Math.max(0, 5000 - Math.max(0, contextWords - words) * 120);
      const score = (Number(entry.food?.priority) || 0) + curatedBoost + canonicalBoost + specificityBoost + entry.sourceScore * 100 + hitVariant.length * 30 + words * 500;
      matches.push({entry,score,hitVariant});
    }
    if (!matches.length) return null;
    matches.sort((a,b)=>b.score-a.score);
    const top = matches[0];
    const sameFood = matches.filter((m)=>m.entry.food?.id===top.entry.food?.id);
    const competing = matches.find((m)=>m.entry.food?.id!==top.entry.food?.id && m.score>=top.score-250);
    if (competing && top.hitVariant.split(" ").length===1 && !top.entry.curated) return null;
    return {
      food: top.entry.food,
      score: top.score,
      matchedAlias: top.hitVariant,
      catalogAlias: true,
      duplicateHits: sameFood.length
    };
  }
  /* =================== V68 · LÕI NHẬN DIỆN MÓN ===================
     Nguyên lý: một dòng nhập = [số lượng] + [đơn vị] + [TÊN MÓN] + [cách chế biến].
     Tách ba phần rồi so khớp riêng phần TÊN MÓN theo ba tầng, dừng ở tầng đầu tiên có kết quả:

       Tầng 1 — khớp nguyên văn CÓ DẤU.      "thịt bò khô" → đúng món khô, không rơi về "thịt bò".
       Tầng 2 — bỏ từ chế biến rồi khớp lại.  "rau muống luộc" → "rau muống".
       Tầng 3 — khớp bao phủ: MỌI chữ trong tên món phải có mặt trong câu,
                phần dư chỉ được là từ bổ nghĩa vô hại.
                Nhờ vậy "mì" không cướp được "bánh mì bò kho",
                "đùi heo muối" không cướp được "10g muối".

     Quy tắc dấu (điểm chết của bản V67 cũ):
       - Câu CÓ dấu chỉ khớp alias cùng dấu  → bò ≠ bơ, cơm ≠ cốm.
       - Câu KHÔNG dấu khớp mọi biến thể, tranh chấp xử bằng bảng ưu tiên bên dưới.
     V67 cũ chọn cách an toàn tuyệt đối: hễ có dấu mà không khớp nguyên văn thì trả null.
     Đó là lý do 29% số món bị coi là "chưa nhận diện". */

  const V68_UNIT_WORDS_RAW = [
    "kilograms","kilogram","grams","gram","kg","gr","g","lạng","lang",
    "mililit","ml","liters","litres","liter","litre","lit","l","cc",
    "cái","cai","chiếc","chiec","quả","qua","trái","trai","miếng","mieng","viên","vien",
    "cuốn","cuon","ổ","cốc","coc","ly","cup","cups","glass","glasses",
    "bát","bat","chén","chen","tô","đĩa","dia","plate","plates",
    "hộp","hop","box","boxes","gói","goi","pack","packs","packet","packets",
    "bịch","bich","bag","bags","lon","cans","can","chai","bottle","bottles",
    "que","xiên","xien","skewer","skewers","thìa","thia","muỗng","muong",
    "tbsp","tablespoons","tablespoon","tsp","teaspoons","teaspoon",
    "lát","lat","slices","slice","suất","suat","phần","phan",
    "servings","serving","portions","portion","pieces","piece","pcs","pc","units","unit",
    "bowls","bowl","con","whole","bird","khay","vỉ","nải","nai","múi","mui","tép","tep"
  ].sort((a,b)=>b.length-a.length);
  const V68_UNIT_ALT = V68_UNIT_WORDS_RAW.map((u)=>u.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|");
  const V68_AMOUNT_RE = new RegExp(`(^|[^\\p{L}])\\d+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?\\s*(?:${V68_UNIT_ALT})?(?=$|[^\\p{L}])`,"giu");
  /* Chỉ những từ CHẮC CHẮN là vật đựng/khẩu phần mới được bỏ khi đứng đầu câu.
     "tép", "múi", "nải", "con" không nằm đây vì "Tép khô" là tên món, không phải đơn vị. */
  const V68_LEAD_UNIT_ALT = [
    "bát","bat","chén","chen","tô","đĩa","dia","cốc","coc","ly","lon","hộp","hop","gói","goi",
    "chai","bịch","bich","khay","miếng","mieng","lát","lat","cái","cai","chiếc","chiec",
    "quả","qua","trái","trai","suất","suat","phần","phan","ổ","cup","bowl","glass","can",
    "plate","slice","piece","serving","portion","box","pack","packet","bottle"
  ].sort((a,b)=>b.length-a.length).map((u)=>u.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|");
  const V68_LEAD_UNIT_RE = new RegExp(`^(?:${V68_LEAD_UNIT_ALT})\\s+(?=\\p{L})`,"iu");

  /* Từ bổ nghĩa CÓ DẤU — bỏ được mà không đổi bản chất món. */
  const V68_MOD_ACCENTED = new Set(("luộc hấp xào chiên rán nướng quay kho hầm om rang trộn tái chần ninh tần nấu "+
    "sống chín tươi nguội nóng lạnh mới thái xắt cắt băm xay nghiền bóc gọt lọc "+
    "phi lê fillet bỏ không có da xương vảy đầu đuôi "+
    "nhỏ lớn vừa ít nhiều đầy cỡ khoảng chừng tầm độ "+
    "ăn uống thêm với của loại kiểu ngon tự làm nhà mình").split(/\s+/));
  /* Từ bổ nghĩa KHÔNG DẤU — chỉ liệt kê những từ KHÔNG trùng tên thực phẩm nào.
     Cố ý loại bỏ: bo (bò/bơ), lon (lợn), to (tô), do (đỗ), cua (cua), gia (giá),
     nho (nho), ca (cá), ga (gà), tai (tai heo), vo (vỏ/vò) — bỏ nhầm là hỏng món. */
  const V68_MOD_PLAIN = new Set(("luoc hap xao chien ran nuong quay ham tron chan ninh nau "+
    "song chin tuoi nguoi nong lanh thai xat cat bam xay nghien "+
    "phile fillet khoang chung them loai kieu "+
    "boiled steamed fried grilled roasted baked raw cooked fresh sliced chopped diced minced "+
    "skinless boneless plain small large medium homemade").split(/\s+/));

  /* Câu không dấu gõ vội thì trùng nhau rất nhiều. Bảng này quyết định ai thắng.
     Trái: chữ không dấu người dùng gõ. Phải: chữ có dấu phải nằm trong tên món thắng cuộc. */
  const V68_ACCENT_PREFERENCE = new Map(Object.entries({
    "com":"cơm", "bo":"bò", "ga":"gà", "ca":"cá", "muoi":"muối", "duong":"đường",
    "trung":"trứng", "nuoc":"nước", "sua":"sữa", "mi":"mì", "bun":"bún", "pho":"phở",
    "xoi":"xôi", "chao":"cháo", "thit":"thịt", "tom":"tôm", "mo":"mỡ", "bot":"bột",
    "dau":"dầu", "do":"đỗ", "che":"chè", "cha":"chả", "gio":"giò", "dua":"dưa",
    "rau":"rau", "banh":"bánh", "canh":"canh", "hanh":"hành", "toi":"tỏi", "ot":"ớt",
    "muc":"mực", "so":"sò", "oc":"ốc", "ech":"ếch", "luon":"lươn", "ngo":"ngô",
    "khoai":"khoai", "dua hau":"dưa hấu", "sua chua":"sữa chua", "nuoc mam":"nước mắm"
  }));

  let V68_FOOD_TOKEN_SET = null;
  function v68FoodTokenSet(){
    if(V68_FOOD_TOKEN_SET) return V68_FOOD_TOKEN_SET;
    const set=new Set();
    for(const item of allFoods()){
      for(const raw of [item.name,item.en].filter(Boolean)){
        for(const tok of v68Tokens(raw)) if(tok.length>1) set.add(strip(tok));
      }
    }
    V68_FOOD_TOKEN_SET=set;
    return set;
  }
  function v68HasAccent(token=""){ return strip(token)!==String(token).toLowerCase(); }
  function v68Tokens(text=""){ return String(text).toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(Boolean); }

  /* Bỏ số lượng + đơn vị, giữ nguyên dấu của phần tên món. */
  function v68FoodName(text=""){
    return String(text).toLowerCase().normalize("NFC")
      .replace(/[()[\]{}"“”'’]/g," ")
      .replace(V68_AMOUNT_RE," ")
      .replace(/\s+/g," ").trim()
      .replace(V68_LEAD_UNIT_RE," ")
      .replace(/[^\p{L}\s]/gu," ")
      .replace(/\s+/g," ").trim();
  }
  function v68IsModifier(token=""){
    return V68_MOD_ACCENTED.has(token) || V68_MOD_PLAIN.has(strip(token));
  }
  function v68StripModifiers(tokens){
    const kept=tokens.filter((t)=>!v68IsModifier(t));
    return kept.length?kept:tokens;
  }
  /* So khớp từng chữ: câu có dấu buộc phải trùng dấu; câu không dấu được khớp rộng. */
  function v68TokenEq(queryToken,aliasToken){
    if(queryToken===aliasToken) return true;
    if(strip(queryToken)!==strip(aliasToken)) return false;
    return !v68HasAccent(queryToken);
  }
  function v68AccentPreferenceOk(queryTokens,aliasRaw,foodName){
    const haystack=`${String(aliasRaw||"").toLowerCase()} ${String(foodName||"").toLowerCase()}`.normalize("NFC");
    for(const token of queryTokens){
      if(v68HasAccent(token)) continue;
      const wanted=V68_ACCENT_PREFERENCE.get(strip(token));
      if(!wanted) continue;
      /* Chỉ áp dụng khi alias thật sự chứa một biến thể của chữ đó. */
      const variants=[...haystack.matchAll(/\p{L}+/gu)].map((m)=>m[0]).filter((w)=>strip(w)===strip(token));
      if(variants.length && !variants.includes(wanted)) return false;
    }
    return true;
  }
  function v68AliasCovered(queryTokens,aliasTokens){
    const pool=[...queryTokens];
    for(const aliasToken of aliasTokens){
      const hit=pool.findIndex((q)=>v68TokenEq(q,aliasToken));
      if(hit<0) return null;
      pool.splice(hit,1);
    }
    return pool;
  }
  function v68Entries(){
    const idx=foodIndex();
    if(!idx.v68) idx.v68=idx.aliases.map((entry)=>({...entry,tokens:v68Tokens(entry.raw)})).filter((entry)=>entry.tokens.length);
    return idx.v68;
  }
  function v68ExactLookup(tokens){
    if(!tokens.length) return null;
    const idx=foodIndex(), phrase=tokens.join(" ");
    const accent=idx.exactAccent.get(normalizePhraseAccentV51(phrase));
    if(accent) return {food:accent.food,matchedAlias:accent.matchedAlias,score:9000000+accent.baseScore,accentExact:true};
    /* Chỉ cho phép khớp không dấu khi chính người dùng gõ không dấu. */
    if(tokens.some(v68HasAccent)) return null;
    const plain=normalizePhrase(phrase);
    const hits=v68Entries().filter((entry)=>entry.key===plain||singularizeEnglish(entry.key)===plain||entry.key===singularizeEnglish(plain));
    const allowed=hits.filter((entry)=>v68AccentPreferenceOk(tokens,entry.raw,entry.food?.name));
    const pool=allowed.length?allowed:hits;
    if(!pool.length) return null;
    const best=pool.sort((a,b)=>b.baseScore-a.baseScore)[0];
    return {food:best.food,matchedAlias:best.raw,score:8000000+best.baseScore};
  }
  /* Tầng 3: tên món phải được câu bao phủ trọn vẹn, phần dư phải vô hại. */
  function v68CoverageLookup(tokens){
    if(!tokens.length) return null;
    const foodTokens=v68FoodTokenSet();
    let best=null;
    for(const entry of v68Entries()){
      if(entry.tokens.length>tokens.length) continue;
      const leftover=v68AliasCovered(tokens,entry.tokens);
      if(!leftover) continue;
      if(!v68AccentPreferenceOk(tokens,entry.raw,entry.food?.name)) continue;
      /* Chữ dư mà lại là tên một thực phẩm khác ⇒ đây là món khác, không phải món này. */
      const harmful=leftover.filter((t)=>!v68IsModifier(t)&&foodTokens.has(strip(t))&&strip(t).length>1);
      if(harmful.length) continue;
      const softLeftover=leftover.length-leftover.filter(v68IsModifier).length;
      const score=entry.tokens.length*100000-leftover.length*6000-softLeftover*4000+Math.min(entry.baseScore,900000)/10;
      if(!best||score>best.score) best={food:entry.food,matchedAlias:entry.raw,score,coverageV68:true};
    }
    return best;
  }
  /* Tầng 2.5 — bí danh gom trong chuỗi alias của bảng Thực phẩm.
     Chuỗi đó là một dãy từ liền nhau ("tai heo tai lợn pig ear …") nên không tách
     thành từng bí danh riêng được; cách duy nhất là tìm cụm liền mạch trong dãy,
     rồi áp lại đúng luật dấu của V68 để "bò" không chui vào chỗ của "bơ". */
  function v68CatalogTextLookup(tokens){
    const idx=foodIndex();
    if(!idx?.catalogTexts?.length||!tokens.length) return null;
    const accentPhrase=tokens.join(" ");
    const plainPhrase=normalizePhrase(accentPhrase);
    const queryHasAccent=tokens.some(v68HasAccent);
    if(tokens.length===1&&plainPhrase.length<4) return null;
    const variants=[...new Set([plainPhrase,singularizeEnglish(plainPhrase)].filter(Boolean))];
    let best=null;
    for(const entry of idx.catalogTexts){
      let hit="";
      for(const variant of variants){
        const pattern=escapeRegExp(variant).replace(/\s+/g,"\\s+");
        const re=new RegExp(`(^|[^a-z0-9])${pattern}(?=$|[^a-z0-9])`,"i");
        if(re.test(entry.text)||re.test(entry.singularText)){hit=variant;break;}
      }
      if(!hit) continue;
      /* Luật dấu: câu có dấu buộc từng chữ phải trùng dấu trong chuỗi alias gốc. */
      if(queryHasAccent){
        const words=(entry.accentText||"").split(" ").filter(Boolean);
        const missing=tokens.some((t)=>v68HasAccent(t)&&!words.includes(t));
        if(missing) continue;
      } else if(!v68AccentPreferenceOk(tokens,entry.accentText,entry.food?.name)) continue;
      const words=hit.split(" ").length;
      const canonical=normalizePhrase(entry.food?.name||"");
      /* Cụm "bánh mì" nằm trong cả "Bánh mì baguette" lẫn "Bánh mì bò kho".
         Phạt theo số chữ thừa của tên món để "1 lát bánh mì" không thành suất bò kho. */
      const canonicalWords=canonical.split(" ").filter(Boolean).length;
      const specificity=-Math.max(0,canonicalWords-words)*120000;
      const score=(entry.curated?30000:0)+(canonical===hit?400000:0)+specificity+words*50000+hit.length*300+entry.sourceScore*10;
      if(!best||score>best.score) best={food:entry.food,matchedAlias:hit,score,catalogAlias:true};
    }
    return best;
  }
  function findFoodV68(input){
    const name=v68FoodName(input);
    if(!name) return null;
    const tokens=v68Tokens(name);
    if(!tokens.length) return null;
    const bare=v68StripModifiers(tokens);
    return v68ExactLookup(tokens)
        || v68ExactLookup(bare)
        || v68CatalogTextLookup(tokens)
        || v68CatalogTextLookup(bare)
        || v68CoverageLookup(tokens)
        || v68CoverageLookup(bare);
  }

  function findFood(norm) {
    const key=String(norm||"");
    if(FOOD_MATCH_MEMO.has(key))return FOOD_MATCH_MEMO.get(key);
    const result=findFoodV68(key);
    if(FOOD_MATCH_MEMO.size>=3000)FOOD_MATCH_MEMO.clear();
    FOOD_MATCH_MEMO.set(key,result);
    return result;
  }
  const UNIT_GROUPS = {
    unit: [
      "cai","chiec","qua","trai","vien","cuon","o",
      "hop","box","boxes","bich","bag","bags","que","xien","skewer","skewers",
      "piece","pieces","pc","pcs","unit","units","each",
    ],
    /* V68: "suất/phần/đĩa" là khẩu phần của cả món, không phải một cái/một miếng.
       Gộp chung như bản cũ khiến "2 cái nem rán" bị tính thành 2 suất. */
    portion: ["suat","phan","dia","plate","plates","serving","servings","portion","portions"],
    whole: ["con", "whole", "bird"],
    slice: ["lat", "slice", "slices"],
    bowl: ["bat", "chen", "to", "bowl", "bowls"],
    cup: ["coc", "ly", "cup", "cups", "glass", "glasses"],
    tbsp: ["thia", "muong", "tbsp", "tablespoon", "tablespoons"],
    tsp: ["thia ca phe", "tsp", "teaspoon", "teaspoons"],
    pack: ["goi", "pack", "packet", "packets"],
    can: ["lon", "can", "cans"],
    piece: ["mieng", "piece", "pieces"],
  };
  function unitKind(raw = "") {
    const u = normalizePhrase(raw);
    if ((UNIT_GROUPS.piece || []).includes(u)) return "piece";
    for (const [k, arr] of Object.entries(UNIT_GROUPS))
      if (arr.includes(u)) return k;
    return "unit";
  }
  const PROTEIN_RULES = [
    { re: /soy_isolate/, per100g: 85, perUnit: 25.5, defaultProtein: 25.5 },
    { re: /whey/, per100g: 80, perUnit: 24, defaultProtein: 24 },
    { re: /egg_white/, per100g: 10.9, perUnit: 3.6, defaultProtein: 3.6 },
    { re: /whole_egg/, per100g: 12.6, perUnit: 6.3, defaultProtein: 6.3 },
    { re: /skim_milk/, per100ml: 3.4, perCup: 8.2, defaultProtein: 8.2 },
    { re: /fresh_milk/, per100ml: 3.2, perCup: 8, defaultProtein: 8 },
    {
      re: /yogurt_plain|yogurt_sweet/,
      per100g: 3.6,
      perUnit: 3.6,
      defaultProtein: 3.6,
    },
    { re: /cheese/, per100g: 23, perSlice: 4, perUnit: 4, defaultProtein: 4 },
    { re: /chicken_breast/, per100g: 31 },
    { re: /chicken_thigh/, per100g: 26, perUnit: 28, defaultProtein: 28 },
    { re: /boiled_chicken|roast_chicken/, per100g: 27 },
    { re: /fried_chicken/, per100g: 22, perUnit: 24, defaultProtein: 24 },
    { re: /lean_pork|pork_tenderloin/, per100g: 27 },
    { re: /pork_belly/, per100g: 14, defaultProtein: 14 },
    { re: /pork_ribs/, per100g: 22, defaultProtein: 26 },
    { re: /pork_meatball/, per100g: 18, perUnit: 4.3, defaultProtein: 4.3 },
    { re: /cha_lua/, per100g: 21, perSlice: 4.2, defaultProtein: 10.5 },
    { re: /cha_com/, per100g: 16, perUnit: 10, defaultProtein: 10 },
    { re: /beef_lean|beef_stirfry/, per100g: 26, defaultProtein: 31 },
    { re: /salmon/, per100g: 22, defaultProtein: 32 },
    { re: /tuna/, per100g: 29, defaultProtein: 44 },
    { re: /mackerel/, per100g: 24, defaultProtein: 35 },
    { re: /tilapia/, per100g: 26, defaultProtein: 39 },
    { re: /white_fish/, per100g: 24, defaultProtein: 36 },
    { re: /shrimp/, per100g: 24, defaultProtein: 36 },
    { re: /squid/, per100g: 16, defaultProtein: 24 },
    { re: /crab/, per100g: 19, defaultProtein: 28 },
    { re: /fried_tofu/, per100g: 16, perUnit: 8, defaultProtein: 16 },
    {
      re: /tofu(?!_pudding)|(^|_)tao_pho/,
      per100g: 9,
      perUnit: 18,
      defaultProtein: 18,
    },
    { re: /mung_beans/, per100g: 7, defaultProtein: 14 },
    { re: /peanuts/, per100g: 26, defaultProtein: 7.8 },
    { re: /mixed_nuts/, per100g: 20, defaultProtein: 6 },
    { re: /oats/, per100g: 16.9, defaultProtein: 8.5 },
    {
      re: /rice_cooked|brown_rice|v3_rice_cooked/,
      per100g: 2.7,
      perBowl: 4.2,
      defaultProtein: 4.2,
    },
    {
      re: /sticky_rice|v3_sticky_rice/,
      per100g: 3.5,
      perBowl: 7,
      defaultProtein: 7,
    },
    { re: /raw_rice|raw_sticky_rice/, per100g: 7.2 },
    { re: /sweet_potato/, per100g: 1.6, perUnit: 3.2, defaultProtein: 3.2 },
    {
      re: /potato(?!_fried)|^v3_fries$|french_fries/,
      per100g: 3.4,
      defaultProtein: 3.8,
    },
    { re: /corn/, per100g: 3.4, perUnit: 5.3, defaultProtein: 5.3 },
    {
      re: /bread_slice/,
      per100g: 9,
      perSlice: 2.7,
      perUnit: 2.7,
      defaultProtein: 2.7,
    },
    { re: /baguette/, per100g: 8.5, perUnit: 7.2, defaultProtein: 7.2 },
    { re: /banh_bao_pork/, per100g: 9, perUnit: 10, defaultProtein: 10 },
    { re: /banh_bao_veg/, per100g: 6, perUnit: 5.7, defaultProtein: 5.7 },
    { re: /banh_bao/, per100g: 7, perUnit: 7.5, defaultProtein: 7.5 },
    { re: /banh_mi_thit|v3_banh_mi_meat/, perUnit: 23, defaultProtein: 23 },
    { re: /banh_chung|banh_tet/, per100g: 6, defaultProtein: 12 },
    { re: /banh_cuon|v3_banh_cuon/, perPortion: 18, defaultProtein: 18 },
    {
      re: /banh_xeo|v3_banh_xeo/,
      perUnit: 14,
      perPortion: 28,
      defaultProtein: 14,
    },
    { re: /banh_gio/, perUnit: 13, defaultProtein: 13 },
    { re: /banh_day/, perUnit: 3, defaultProtein: 3 },
    {
      re: /bun_fresh|pho_noodle|glass_noodle|hu_tieu_noodle|noodles_generic/,
      per100g: 2.5,
      perBowl: 5,
      defaultProtein: 5,
    },
    { re: /egg_noodle/, per100g: 4.5, perBowl: 9, defaultProtein: 9 },
    { re: /instant_noodles/, perPack: 8, perUnit: 8, defaultProtein: 8 },
    { re: /pho_beef_stir|pho_bo|v3_pho_beef/, perBowl: 32, defaultProtein: 32 },
    { re: /pho_ga|v3_pho_chicken/, perBowl: 28, defaultProtein: 28 },
    { re: /pho_plain/, perBowl: 18, defaultProtein: 18 },
    { re: /bun_bo_hue|v3_bun_bo_hue/, perBowl: 30, defaultProtein: 30 },
    { re: /bun_cha|v3_bun_cha/, perPortion: 35, defaultProtein: 35 },
    { re: /bun_rieu|v3_bun_rieu/, perBowl: 24, defaultProtein: 24 },
    { re: /bun_ca|v3_bun_fish/, perBowl: 28, defaultProtein: 28 },
    { re: /bun_moc|v3_bun_moc/, perBowl: 25, defaultProtein: 25 },
    { re: /bun_thit_nuong|v3_bun_thit_nuong/, perBowl: 31, defaultProtein: 31 },
    { re: /bun_dau|bun_dau_mam_tom/, perPortion: 29, defaultProtein: 29 },
    { re: /bun_ngan_skinless/, perBowl: 38, defaultProtein: 38 },
    { re: /v3_bun_ngan$/, perBowl: 35, defaultProtein: 35 },
    { re: /bun_thang/, perBowl: 27, defaultProtein: 27 },
    {
      re: /bun_mam|bun_nuoc_leo|bun_quay|bun_sua/,
      perBowl: 28,
      defaultProtein: 28,
    },
    { re: /mien_ga|v3_mien_chicken/, perBowl: 27, defaultProtein: 27 },
    { re: /mien_luon|v3_mien_eel/, perBowl: 25, defaultProtein: 25 },
    {
      re: /hu_tieu|banh_canh|cao_lau|quang_noodle|mi_quang/,
      perBowl: 24,
      defaultProtein: 24,
    },
    { re: /duck_noodle|mi_vit_tiem/, perBowl: 31, defaultProtein: 31 },
    {
      re: /beef_fried_noodle|beef_fried_pho/,
      perPortion: 34,
      defaultProtein: 34,
    },
    { re: /chao_suon/, perBowl: 17, defaultProtein: 17 },
    { re: /^chao$|v3_glass_noodle/, perBowl: 4, defaultProtein: 4 },
    {
      re: /duck_meat_skinless|ngan_roasted_skinless|ngan_garlic_skinless|ngan_boiled_skinless/,
      per100g: 25,
      perPortion: 75,
      defaultProtein: 75,
    },
    { re: /duck_meat_skin/, per100g: 19, defaultProtein: 19 },
    { re: /pork_intestine/, per100g: 16, perPortion: 24, defaultProtein: 24 },
    {
      re: /beef_steak_plain|beef_steak_butter/,
      per100g: 26,
      perPortion: 52,
      defaultProtein: 52,
    },
    { re: /vietnamese_steak_set/, perPortion: 48, defaultProtein: 48 },
    { re: /com_tam/, perPortion: 34, defaultProtein: 34 },
    { re: /com_ga/, perPortion: 32, defaultProtein: 32 },
    { re: /fried_rice/, perPortion: 20, defaultProtein: 20 },
    { re: /com_hen/, perBowl: 22, defaultProtein: 22 },
    { re: /goi_cuon/, perUnit: 5, defaultProtein: 5 },
    { re: /nem_ran/, perUnit: 5, defaultProtein: 5 },
    { re: /nem_chua/, perUnit: 4, defaultProtein: 4 },
    { re: /boiled_dumpling/, perUnit: 3, defaultProtein: 3 },
    { re: /nem_nuong/, perPortion: 30, defaultProtein: 30 },
    { re: /cha_muc/, per100g: 17, perUnit: 6, defaultProtein: 17 },
    { re: /cha_ca/, perPortion: 35, defaultProtein: 35 },
    { re: /thit_kho_trung/, perPortion: 28, defaultProtein: 28 },
    { re: /ca_kho_to/, perPortion: 32, defaultProtein: 32 },
    { re: /canh_chua_ca/, perBowl: 18, defaultProtein: 18 },
    { re: /spaghetti_bolognese/, perPortion: 28, defaultProtein: 28 },
    { re: /carbonara/, perPortion: 25, defaultProtein: 25 },
    { re: /pizza_margherita/, perSlice: 11, perUnit: 11, defaultProtein: 11 },
    { re: /pizza_pepperoni/, perSlice: 13, perUnit: 13, defaultProtein: 13 },
    { re: /cheeseburger/, perUnit: 32, defaultProtein: 32 },
    { re: /hamburger/, perUnit: 28, defaultProtein: 28 },
    { re: /fish_chips/, perPortion: 36, defaultProtein: 36 },
    { re: /caesar_salad/, perPortion: 16, defaultProtein: 16 },
    { re: /grilled_chicken_salad/, perPortion: 35, defaultProtein: 35 },
    { re: /ramen/, perBowl: 24, defaultProtein: 24 },
    { re: /udon/, perBowl: 17, defaultProtein: 17 },
    { re: /pad_thai/, perPortion: 25, defaultProtein: 25 },
    { re: /japanese_curry/, perPortion: 27, defaultProtein: 27 },
    { re: /sushi_salmon/, perUnit: 3.5, defaultProtein: 21 },
    { re: /cucumber/, per100g: 0.7, perUnit: 1.4, defaultProtein: 1.4 },
    { re: /tomato/, per100g: 0.9, perUnit: 1.1, defaultProtein: 1.1 },
    { re: /carrot/, per100g: 0.9, perUnit: 0.7, defaultProtein: 0.7 },
    { re: /broccoli/, per100g: 2.8, defaultProtein: 5.6 },
    { re: /cabbage/, per100g: 1.3, defaultProtein: 2.6 },
    { re: /water_spinach/, per100g: 2.6, defaultProtein: 5.2 },
    { re: /boiled_veg/, per100g: 2, defaultProtein: 4 },
    { re: /stirfried_veg/, per100g: 2.5, perPortion: 5, defaultProtein: 5 },
    { re: /salad(?!_chicken)/, per100g: 1.5, defaultProtein: 3 },
    { re: /banana/, per100g: 1.1, perUnit: 1.3, defaultProtein: 1.3 },
    { re: /apple/, per100g: 0.3, perUnit: 0.5, defaultProtein: 0.5 },
    { re: /orange/, per100g: 0.9, perUnit: 1.2, defaultProtein: 1.2 },
    { re: /guava/, per100g: 2.6, perUnit: 4.2, defaultProtein: 4.2 },
    { re: /dragon_fruit/, per100g: 1.2, perUnit: 3.6, defaultProtein: 3.6 },
    { re: /watermelon/, per100g: 0.6, defaultProtein: 2.4 },
    { re: /mango/, per100g: 0.8, perUnit: 1.8, defaultProtein: 1.8 },
    { re: /pomelo/, per100g: 0.8, defaultProtein: 1.7 },
    { re: /grapes/, per100g: 0.7, defaultProtein: 1.4 },
    { re: /pineapple/, per100g: 0.5, defaultProtein: 1 },
    { re: /papaya/, per100g: 0.5, defaultProtein: 1 },
    { re: /avocado/, per100g: 2, perUnit: 3, defaultProtein: 3 },
    { re: /rice_paper/, perUnit: 0.3, per100g: 6, defaultProtein: 0.3 },
    { re: /banh_trang_tron/, perPortion: 10, defaultProtein: 10 },
    {
      re: /banh_nhan|banh_gai|banh_dau_xanh|keo_lac|banh_com|banh_pia|banh_it|banh_bo|banh_boteloc|banh_beo|banh_khot|croissant|pancakes|icecream|chocolate|che_/,
      defaultProtein: 4,
    },
    { re: /tao_pho/, perCup: 6, defaultProtein: 6 },
    { re: /milk_coffee/, perCup: 4, defaultProtein: 4 },
    { re: /bubble_tea/, perCup: 5, defaultProtein: 5 },
    {
      re: /black_coffee|soft_drink|beer|sugarcane|pennywort|cooking_oil|honey|sugar$|soy_sauce|fish_sauce/,
      defaultProtein: 0,
    },
  ];
  function nutrientNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function proteinProfile(food, norm = "") {
    const direct100 = nutrientNumber(food?.protein100g),
      direct100ml = nutrientNumber(food?.protein100ml),
      directDefault = nutrientNumber(food?.defaultProtein);
    if (direct100 !== null)
      return {
        per100g: direct100,
        defaultProtein: directDefault,
      };
    if (direct100ml !== null)
      return {
        per100ml: direct100ml,
        defaultProtein: directDefault,
      };
    if (directDefault !== null) return { defaultProtein: directDefault };
    const id = String(food?.id || ""),
      rule = PROTEIN_RULES.find((r) => r.re.test(id));
    if (rule) return rule;
    const text = `${id} ${norm} ${normalizePhrase(food?.name || "")} ${normalizePhrase(food?.en || "")}`;
    if (
      /(?:chicken|beef|pork|duck|fish|shrimp|tuna|salmon|meat|ga|bo|heo|lon|vit|ngan|ca|tom)/.test(
        text,
      )
    )
      return { per100g: 24, defaultProtein: 30 };
    if (/(?:egg|trung|tofu|dau phu|milk|sua|yogurt|cheese)/.test(text))
      return { defaultProtein: 8 };
    if (/(?:rice|noodle|bread|bun|pho|com|banh|mi|xoi|potato|oat)/.test(text))
      return { defaultProtein: 7 };
    if (/(?:vegetable|salad|rau|fruit|banana|apple|orange)/.test(text))
      return { defaultProtein: 2 };
    return {};
  }
  function estimateProteinAmount({
    food,
    original,
    norm,
    weight,
    volume,
    quantity,
    kind,
    isBiteSize,
    kcal,
  }) {
    const directA = norm.match(
        /(?:dam|protein)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*g\b/,
      ),
      directB = norm.match(/(\d+(?:[.,]\d+)?)\s*g\s*dam\b/);
    if (directA || directB)
      return Math.max(0, +(directA || directB)[1].replace(",", "."));
    const p = proteinProfile(food, norm);
    if (weight && Number.isFinite(p.per100g)) {
      let qty = +weight[1].replace(",", "."),
        u = weight[2];
      if (["kg", "kilogram", "kilograms"].includes(u)) qty *= 1000;
      return Math.max(0, (qty * p.per100g) / 100);
    }
    if (volume && Number.isFinite(p.per100ml)) {
      let qty = +volume[1].replace(",", "."),
        u = volume[2];
      if (["l", "lit", "liter", "litre", "liters", "litres"].includes(u))
        qty *= 1000;
      return Math.max(0, (qty * p.per100ml) / 100);
    }
    if (Number.isFinite(quantity)) {
      const rate =
        kind === "whole"
          ? p.perWhole
          : kind === "bowl"
            ? p.perBowl
            : kind === "cup"
              ? p.perCup
              : kind === "tbsp"
                ? p.perTbsp
                : kind === "slice"
                  ? p.perSlice
                  : kind === "pack"
                    ? p.perPack
                    : kind === "can"
                      ? p.perCan
                      : p.perUnit;
      if (Number.isFinite(rate)) return Math.max(0, quantity * rate);
      if (kind === "piece" && Number.isFinite(p.per100g)) {
        const grams = isBiteSize
          ? food.gramsPerBite || 18
          : food.gramsPerPiece || food.gramsPerUnit || 30;
        return Math.max(0, (quantity * grams * p.per100g) / 100);
      }
      if (Number.isFinite(food.gramsPerUnit) && Number.isFinite(p.per100g))
        return Math.max(0, (quantity * food.gramsPerUnit * p.per100g) / 100);
      if (Number.isFinite(p.defaultProtein))
        return Math.max(0, quantity * p.defaultProtein);
    }
    if (Number.isFinite(p.defaultProtein)) return Math.max(0, p.defaultProtein);
    if (
      Number.isFinite(p.per100g) &&
      Number.isFinite(food.per100g) &&
      food.per100g > 0 &&
      Number.isFinite(kcal)
    )
      return Math.max(0, (kcal / food.per100g) * p.per100g);
    if (
      Number.isFinite(p.per100ml) &&
      Number.isFinite(food.per100ml) &&
      food.per100ml > 0 &&
      Number.isFinite(kcal)
    )
      return Math.max(0, (kcal / food.per100ml) * p.per100ml);
    const text = `${String(food?.id || "")} ${norm}`;
    let share = 0.1;
    if (/(?:oil|sugar|honey|soft drink|beer|coffee)/.test(text)) share = 0;
    else if (
      /(?:meat|chicken|beef|pork|duck|fish|shrimp|egg|tofu|whey|protein)/.test(
        text,
      )
    )
      share = 0.28;
    else if (/(?:fruit|vegetable|salad)/.test(text)) share = 0.08;
    return Math.max(0, ((Number(kcal) || 0) * share) / 4);
  }

  const MACRO_RULES = [
    {
      re: /soy_isolate/,
      carbs100g: 3,
      fat100g: 1.5,
      carbsUnit: 0.9,
      fatUnit: 0.5,
      defaultCarbs: 0.9,
      defaultFat: 0.5,
    },
    {
      re: /whey/,
      carbs100g: 8,
      fat100g: 6,
      carbsUnit: 3,
      fatUnit: 2,
      defaultCarbs: 3,
      defaultFat: 2,
    },
    {
      re: /egg_white/,
      carbs100g: 0.7,
      fat100g: 0.2,
      carbsUnit: 0.2,
      fatUnit: 0.1,
      defaultCarbs: 0.2,
      defaultFat: 0.1,
    },
    {
      re: /whole_egg/,
      carbs100g: 0.7,
      fat100g: 9.5,
      carbsUnit: 0.4,
      fatUnit: 4.8,
      defaultCarbs: 0.4,
      defaultFat: 4.8,
    },
    {
      re: /skim_milk/,
      carbs100ml: 5,
      fat100ml: 0.1,
      carbsCup: 12,
      fatCup: 0.2,
      defaultCarbs: 12,
      defaultFat: 0.2,
    },
    {
      re: /fresh_milk/,
      carbs100ml: 4.8,
      fat100ml: 3.3,
      carbsCup: 12,
      fatCup: 8,
      defaultCarbs: 12,
      defaultFat: 8,
    },
    {
      re: /yogurt_plain/,
      carbs100g: 4.7,
      fat100g: 3.3,
      carbsUnit: 4.7,
      fatUnit: 3.3,
      defaultCarbs: 4.7,
      defaultFat: 3.3,
    },
    {
      re: /yogurt_sweet/,
      carbs100g: 14,
      fat100g: 3,
      carbsUnit: 14,
      fatUnit: 3,
      defaultCarbs: 14,
      defaultFat: 3,
    },
    {
      re: /cheese/,
      carbs100g: 2,
      fat100g: 24,
      carbsSlice: 0.4,
      fatSlice: 4,
      carbsUnit: 0.4,
      fatUnit: 4,
      defaultCarbs: 0.4,
      defaultFat: 4,
    },
    { re: /chicken_breast/, carbs100g: 0, fat100g: 3.6 },
    {
      re: /chicken_thigh/,
      carbs100g: 0,
      fat100g: 10.9,
      defaultCarbs: 0,
      defaultFat: 12,
    },
    { re: /boiled_chicken|roast_chicken/, carbs100g: 0, fat100g: 8 },
    { re: /lean_pork|pork_tenderloin/, carbs100g: 0, fat100g: 7 },
    {
      re: /pork_belly/,
      carbs100g: 0,
      fat100g: 53,
      defaultCarbs: 0,
      defaultFat: 53,
    },
    {
      re: /beef_lean|beef_stirfry/,
      carbs100g: 0,
      fat100g: 10,
      defaultCarbs: 3,
      defaultFat: 14,
    },
    {
      re: /salmon/,
      carbs100g: 0,
      fat100g: 12,
      defaultCarbs: 0,
      defaultFat: 18,
    },
    { re: /tuna/, carbs100g: 0, fat100g: 1, defaultCarbs: 0, defaultFat: 1.5 },
    {
      re: /mackerel/,
      carbs100g: 0,
      fat100g: 14,
      defaultCarbs: 0,
      defaultFat: 21,
    },
    {
      re: /tilapia|white_fish/,
      carbs100g: 0,
      fat100g: 3,
      defaultCarbs: 0,
      defaultFat: 4.5,
    },
    {
      re: /shrimp/,
      carbs100g: 0.2,
      fat100g: 0.3,
      defaultCarbs: 0.3,
      defaultFat: 0.5,
    },
    {
      re: /squid/,
      carbs100g: 3.1,
      fat100g: 1.4,
      defaultCarbs: 4.7,
      defaultFat: 2.1,
    },
    {
      re: /crab/,
      carbs100g: 0,
      fat100g: 1.5,
      defaultCarbs: 0,
      defaultFat: 2.3,
    },
    {
      re: /tofu(?!_pudding)|(^|_)tao_pho/,
      carbs100g: 2,
      fat100g: 5,
      carbsUnit: 4,
      fatUnit: 10,
      defaultCarbs: 4,
      defaultFat: 10,
    },
    {
      re: /fried_tofu/,
      carbs100g: 4,
      fat100g: 11,
      carbsUnit: 2,
      fatUnit: 5.5,
      defaultCarbs: 4,
      defaultFat: 11,
    },
    {
      re: /rice_cooked|v3_rice_cooked/,
      carbs100g: 28,
      fat100g: 0.3,
      carbsBowl: 44,
      fatBowl: 0.5,
      defaultCarbs: 44,
      defaultFat: 0.5,
    },
    {
      re: /brown_rice/,
      carbs100g: 25.6,
      fat100g: 1,
      carbsBowl: 40,
      fatBowl: 1.6,
      defaultCarbs: 40,
      defaultFat: 1.6,
    },
    {
      re: /sticky_rice|v3_sticky_rice/,
      carbs100g: 37,
      fat100g: 0.3,
      carbsBowl: 74,
      fatBowl: 0.6,
      defaultCarbs: 74,
      defaultFat: 0.6,
    },
    {
      re: /raw_rice|raw_sticky_rice/,
      carbs100g: 80,
      fat100g: 0.7,
      defaultCarbs: 80,
      defaultFat: 0.7,
    },
    {
      re: /oats/,
      carbs100g: 66.3,
      fat100g: 6.9,
      defaultCarbs: 33.2,
      defaultFat: 3.5,
    },
    {
      re: /sweet_potato/,
      carbs100g: 20.7,
      fat100g: 0.2,
      carbsUnit: 41.4,
      fatUnit: 0.4,
      defaultCarbs: 41.4,
      defaultFat: 0.4,
    },
    {
      re: /potato(?!_fried)/,
      carbs100g: 20.1,
      fat100g: 0.1,
      carbsUnit: 34,
      fatUnit: 0.2,
      defaultCarbs: 34,
      defaultFat: 0.2,
    },
    {
      re: /corn/,
      carbs100g: 21,
      fat100g: 1.5,
      carbsUnit: 32.5,
      fatUnit: 2.3,
      defaultCarbs: 32.5,
      defaultFat: 2.3,
    },
    {
      re: /bread_slice/,
      carbs100g: 49,
      fat100g: 3.2,
      carbsSlice: 14.7,
      fatSlice: 1,
      carbsUnit: 14.7,
      fatUnit: 1,
      defaultCarbs: 14.7,
      defaultFat: 1,
    },
    {
      re: /baguette/,
      carbs100g: 57,
      fat100g: 1.5,
      carbsUnit: 48.5,
      fatUnit: 1.3,
      defaultCarbs: 48.5,
      defaultFat: 1.3,
    },
    {
      re: /instant_noodles/,
      carbsPack: 52,
      fatPack: 17,
      carbsUnit: 52,
      fatUnit: 17,
      defaultCarbs: 52,
      defaultFat: 17,
    },
    {
      re: /banana/,
      carbs100g: 22.8,
      fat100g: 0.3,
      carbsUnit: 27,
      fatUnit: 0.4,
      defaultCarbs: 27,
      defaultFat: 0.4,
    },
    {
      re: /apple/,
      carbs100g: 13.8,
      fat100g: 0.2,
      carbsUnit: 25,
      fatUnit: 0.3,
      defaultCarbs: 25,
      defaultFat: 0.3,
    },
    {
      re: /orange/,
      carbs100g: 11.8,
      fat100g: 0.1,
      carbsUnit: 15.4,
      fatUnit: 0.2,
      defaultCarbs: 15.4,
      defaultFat: 0.2,
    },
    {
      re: /guava/,
      carbs100g: 14.3,
      fat100g: 1,
      defaultCarbs: 23,
      defaultFat: 1.6,
    },
    {
      re: /dragon_fruit/,
      carbs100g: 13,
      fat100g: 0.1,
      defaultCarbs: 39,
      defaultFat: 0.3,
    },
    {
      re: /watermelon/,
      carbs100g: 7.6,
      fat100g: 0.2,
      defaultCarbs: 30.4,
      defaultFat: 0.8,
    },
    {
      re: /mango/,
      carbs100g: 15,
      fat100g: 0.4,
      defaultCarbs: 34,
      fatUnit: 0.9,
    },
    {
      re: /grapes/,
      carbs100g: 18.1,
      fat100g: 0.2,
      defaultCarbs: 36.2,
      defaultFat: 0.4,
    },
    {
      re: /pineapple/,
      carbs100g: 13.1,
      fat100g: 0.1,
      defaultCarbs: 26.2,
      defaultFat: 0.2,
    },
    {
      re: /papaya/,
      carbs100g: 10.8,
      fat100g: 0.3,
      defaultCarbs: 21.6,
      defaultFat: 0.6,
    },
    {
      re: /avocado/,
      carbs100g: 8.5,
      fat100g: 14.7,
      carbsUnit: 12.8,
      fatUnit: 22,
      defaultCarbs: 12.8,
      defaultFat: 22,
    },
    {
      re: /cucumber/,
      carbs100g: 3.6,
      fat100g: 0.1,
      defaultCarbs: 7.2,
      defaultFat: 0.2,
    },
    {
      re: /tomato/,
      carbs100g: 3.9,
      fat100g: 0.2,
      defaultCarbs: 4.8,
      defaultFat: 0.2,
    },
    {
      re: /carrot/,
      carbs100g: 9.6,
      fat100g: 0.2,
      defaultCarbs: 7.2,
      defaultFat: 0.2,
    },
    {
      re: /cooking_oil/,
      carbs100g: 0,
      fat100g: 100,
      carbsTbsp: 0,
      fatTbsp: 13.6,
      defaultCarbs: 0,
      defaultFat: 13.6,
    },
    {
      re: /sugar$/,
      carbs100g: 100,
      fat100g: 0,
      carbsTbsp: 12.6,
      fatTbsp: 0,
      defaultCarbs: 12.6,
      defaultFat: 0,
    },
    {
      re: /honey/,
      carbs100g: 82.4,
      fat100g: 0,
      carbsTbsp: 17.3,
      fatTbsp: 0,
      defaultCarbs: 17.3,
      defaultFat: 0,
    },
    {
      re: /soy_sauce/,
      carbs100ml: 4.9,
      fat100ml: 0.1,
      carbsTbsp: 0.8,
      fatTbsp: 0,
      defaultCarbs: 0.8,
      defaultFat: 0,
    },
    {
      re: /fish_sauce/,
      carbs100ml: 3.6,
      fat100ml: 0,
      carbsTbsp: 0.5,
      fatTbsp: 0,
      defaultCarbs: 0.5,
      defaultFat: 0,
    },
    {
      re: /black_coffee/,
      carbsCup: 0,
      fatCup: 0,
      defaultCarbs: 0,
      defaultFat: 0,
    },
    {
      re: /soft_drink/,
      carbs100ml: 10.6,
      fat100ml: 0,
      carbsCan: 37,
      fatCan: 0,
      defaultCarbs: 37,
      defaultFat: 0,
    },
    {
      re: /beer/,
      carbs100ml: 3.6,
      fat100ml: 0,
      carbsCan: 12.6,
      fatCan: 0,
      defaultCarbs: 12.6,
      defaultFat: 0,
    },
  ];
  function macroProfile(food, norm = "") {
    const direct = {
      carbs100g: nutrientNumber(food?.carbs100g),
      fat100g: nutrientNumber(food?.fat100g),
      carbs100ml: nutrientNumber(food?.carbs100ml),
      fat100ml: nutrientNumber(food?.fat100ml),
      defaultCarbs: nutrientNumber(food?.defaultCarbs),
      defaultFat: nutrientNumber(food?.defaultFat),
    };
    const hasDirect = Object.values(direct).some((v) => v !== null);
    if (hasDirect) return direct;
    const id = String(food?.id || ""),
      rule = MACRO_RULES.find((r) => r.re.test(id));
    return rule || {};
  }
  function macroResidualCarbRatio(food, norm = "") {
    const text = `${String(food?.id || "")} ${norm} ${normalizePhrase(food?.name || "")} ${normalizePhrase(food?.en || "")}`;
    if (
      /(?:cooking_oil|butter|mayonnaise|pork_belly|duck_meat_skin|nuts|peanuts|avocado|cheese)/.test(
        text,
      )
    )
      return 0.05;
    if (
      /(?:sugar|honey|soft_drink|sugarcane|juice|fruit|banana|apple|orange|mango|grape|watermelon|pineapple|papaya)/.test(
        text,
      )
    )
      return 0.96;
    if (
      /(?:rice|sticky|noodle|bun|pho|bread|banh|xoi|potato|corn|oat|porridge|chao)/.test(
        text,
      )
    )
      return 0.88;
    if (
      /(?:chicken|beef|pork|duck|fish|shrimp|tuna|salmon|egg|meat|steak|crab|squid)/.test(
        text,
      )
    )
      return 0.03;
    if (/(?:tofu|bean|milk|yogurt)/.test(text)) return 0.45;
    /* V68: phải xét cách chế biến TRƯỚC nhóm thực phẩm. Rau xào/chiên dư calo là do
       dầu chứ không phải tinh bột — bản cũ gán 90% phần dư thành carb nên một đĩa
       rau xào ra 32 g carb. */
    const friedText=/(?:xao|chien|ran|quay|stir fried|stir fry|deep fried|pan fried|fried|sauteed)/.test(text);
    if (/(?:vegetable|salad|rau|cucumber|tomato|carrot|cai|nam|mushroom)/.test(text)) return friedText ? 0.35 : 0.9;
    if (
      /(?:fried|chien|ran|pizza|burger|pasta|curry|noodle soup|sandwich|dumpling|spring roll|rice bowl)/.test(
        text,
      )
    )
      return 0.58;
    if (
      /(?:cake|cookie|donut|muffin|brownie|cheesecake|tiramisu|icecream|chocolate|sweet)/.test(
        text,
      )
    )
      return 0.68;
    return 0.58;
  }
  function profileMacroRate(p, kind, key) {
    const cap = key === "carbs" ? "Carbs" : "Fat";
    const field =
      kind === "whole"
        ? `${key}Whole`
        : kind === "bowl"
          ? `${key}Bowl`
          : kind === "cup"
            ? `${key}Cup`
            : kind === "tbsp"
              ? `${key}Tbsp`
              : kind === "slice"
                ? `${key}Slice`
                : kind === "pack"
                  ? `${key}Pack`
                  : kind === "can"
                    ? `${key}Can`
                    : `${key}Unit`;
    return Number(p[field]);
  }
  function estimateMacroAmounts({
    food,
    norm,
    weight,
    volume,
    quantity,
    kind,
    isBiteSize,
    kcal,
    protein,
  }) {
    const directCarb =
      norm.match(
        /(?:carb(?:s|ohydrate)?|tinh bot)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*g\b/,
      ) || norm.match(/(\d+(?:[.,]\d+)?)\s*g\s*(?:carb(?:s)?|tinh bot)\b/);
    const directFat =
      norm.match(/(?:fat|chat beo)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*g\b/) ||
      norm.match(/(\d+(?:[.,]\d+)?)\s*g\s*(?:fat|chat beo)\b/);
    const p = macroProfile(food, norm);
    let carbs = directCarb
        ? Math.max(0, +directCarb[1].replace(",", "."))
        : null,
      fat = directFat ? Math.max(0, +directFat[1].replace(",", ".")) : null;
    if (weight) {
      let qty = +weight[1].replace(",", "."),
        u = weight[2];
      if (["kg", "kilogram", "kilograms"].includes(u)) qty *= 1000;
      if (carbs === null && Number.isFinite(p.carbs100g))
        carbs = (qty * p.carbs100g) / 100;
      if (fat === null && Number.isFinite(p.fat100g))
        fat = (qty * p.fat100g) / 100;
    }
    if (volume) {
      let qty = +volume[1].replace(",", "."),
        u = volume[2];
      if (["l", "lit", "liter", "litre", "liters", "litres"].includes(u))
        qty *= 1000;
      if (carbs === null && Number.isFinite(p.carbs100ml))
        carbs = (qty * p.carbs100ml) / 100;
      if (fat === null && Number.isFinite(p.fat100ml))
        fat = (qty * p.fat100ml) / 100;
    }
    if (Number.isFinite(quantity)) {
      const cr = profileMacroRate(p, kind, "carbs"),
        fr = profileMacroRate(p, kind, "fat");
      if (carbs === null && Number.isFinite(cr)) carbs = quantity * cr;
      if (fat === null && Number.isFinite(fr)) fat = quantity * fr;
      const grams =
        kind === "piece"
          ? isBiteSize
            ? food.gramsPerBite || 18
            : food.gramsPerPiece || food.gramsPerUnit || 30
          : food.gramsPerUnit;
      if (Number.isFinite(grams)) {
        if (carbs === null && Number.isFinite(p.carbs100g))
          carbs = (quantity * grams * p.carbs100g) / 100;
        if (fat === null && Number.isFinite(p.fat100g))
          fat = (quantity * grams * p.fat100g) / 100;
      }
      if (carbs === null && Number.isFinite(p.defaultCarbs))
        carbs = quantity * p.defaultCarbs;
      if (fat === null && Number.isFinite(p.defaultFat))
        fat = quantity * p.defaultFat;
    }
    if (carbs === null && Number.isFinite(p.defaultCarbs))
      carbs = p.defaultCarbs;
    if (fat === null && Number.isFinite(p.defaultFat)) fat = p.defaultFat;
    if (
      carbs === null &&
      Number.isFinite(p.carbs100g) &&
      Number.isFinite(food.per100g) &&
      food.per100g > 0
    )
      carbs = (kcal / food.per100g) * p.carbs100g;
    if (
      fat === null &&
      Number.isFinite(p.fat100g) &&
      Number.isFinite(food.per100g) &&
      food.per100g > 0
    )
      fat = (kcal / food.per100g) * p.fat100g;
    if (
      carbs === null &&
      Number.isFinite(p.carbs100ml) &&
      Number.isFinite(food.per100ml) &&
      food.per100ml > 0
    )
      carbs = (kcal / food.per100ml) * p.carbs100ml;
    if (
      fat === null &&
      Number.isFinite(p.fat100ml) &&
      Number.isFinite(food.per100ml) &&
      food.per100ml > 0
    )
      fat = (kcal / food.per100ml) * p.fat100ml;
    const remaining = Math.max(
        0,
        (Number(kcal) || 0) -
          (Number(protein) || 0) * 4 -
          (Number(carbs) || 0) * 4 -
          (Number(fat) || 0) * 9,
      ),
      ratio = macroResidualCarbRatio(food, norm);
    if (carbs === null && fat === null) {
      carbs = (remaining * ratio) / 4;
      fat = (remaining * (1 - ratio)) / 9;
    } else if (carbs === null) {
      carbs = Math.max(0, remaining / 4);
    } else if (fat === null) {
      fat = Math.max(0, remaining / 9);
    }
    return {
      carbs: Math.max(0, Number(carbs) || 0),
      fat: Math.max(0, Number(fat) || 0),
    };
  }
  function macroEntries(item) {
    return [
      { key: "protein", label: "Protein", value: Number(item?.protein) || 0 },
      { key: "carb", label: "Carb", value: Number(item?.carbs) || 0 },
      { key: "fat", label: "Fat", value: Number(item?.fat) || 0 },
    ].sort(
      (a, b) =>
        b.value - a.value ||
        { protein: 0, carb: 1, fat: 2 }[a.key] -
          { protein: 0, carb: 1, fat: 2 }[b.key],
    );
  }
  function fmtMacro(value) {
    const n = Math.max(0, Number(value) || 0);
    return n >= 10 ? fmt(n) : fmt(n, 1);
  }
  function macroPillsHtml(item) {
    return macroEntries(item)
      .map(
        (m) =>
          `<span class="macro-pill ${m.key}">${m.label} ${fmtMacro(m.value)}g</span>`,
      )
      .join("");
  }

  function macroEnergy(protein, carbs, fat) {
    return (
      Math.max(0, Number(protein) || 0) * 4 +
      Math.max(0, Number(carbs) || 0) * 4 +
      Math.max(0, Number(fat) || 0) * 9
    );
  }
  function directPer100gRate(food, norm = "") {
    const direct = nutrientNumber(food?.per100g);
    if (direct !== null && direct > 0) return { rate: direct, method: "database" };
    const perGram = nutrientNumber(food?.perGram);
    if (perGram !== null && perGram > 0)
      return { rate: perGram * 100, method: "database" };
    const grams = nutrientNumber(food?.gramsPerUnit);
    const unitKcal = nutrientNumber(food?.perUnit) ?? nutrientNumber(food?.defaultKcal);
    if (grams !== null && grams > 0 && unitKcal !== null && unitKcal > 0)
      return { rate: (unitKcal / grams) * 100, method: "derived-serving" };
    const p = proteinProfile(food, norm), m = macroProfile(food, norm);
    const protein = nutrientNumber(p.per100g), carbs = nutrientNumber(m.carbs100g), fat = nutrientNumber(m.fat100g);
    if (protein !== null || carbs !== null || fat !== null) {
      const energy = macroEnergy(protein, carbs, fat);
      if (energy > 0) return { rate: energy, method: "derived-macros" };
    }
    const per100ml = nutrientNumber(food?.per100ml);
    const isPowder = /(?:powder|bot|dry milk)/.test(`${norm} ${normalizePhrase(food?.name || "")} ${normalizePhrase(food?.en || "")}`);
    if (!isPowder && per100ml !== null && per100ml > 0)
      return { rate: per100ml, method: "liquid-density" };
    return null;
  }
  function directPer100mlRate(food, norm = "") {
    const direct = nutrientNumber(food?.per100ml);
    if (direct !== null && direct > 0) return { rate: direct, method: "database" };
    const perCup = nutrientNumber(food?.perCup);
    if (perCup !== null && perCup > 0)
      return { rate: perCup / 2.4, method: "derived-serving" };
    const perCan = nutrientNumber(food?.perCan);
    if (perCan !== null && perCan > 0)
      return { rate: perCan / 3.3, method: "derived-serving" };
    const p = proteinProfile(food, norm), m = macroProfile(food, norm);
    const protein = nutrientNumber(p.per100ml), carbs = nutrientNumber(m.carbs100ml), fat = nutrientNumber(m.fat100ml);
    if (protein !== null || carbs !== null || fat !== null) {
      const energy = macroEnergy(protein, carbs, fat);
      if (energy > 0) return { rate: energy, method: "derived-macros" };
    }
    return null;
  }
  /* Cồn cho 7 kcal/g nhưng không phải đạm, carb hay fat. Không đánh dấu thì mọi
     dòng bia/rượu đều bị báo "macro lệch calo" dù số liệu hoàn toàn đúng. */
  function v68AlcoholEnergy(food){
    const text=`${String(food?.id||"")} ${normalizePhrase(food?.name||"")} ${normalizePhrase(food?.en||"")}`;
    return /(?:^|[\s_])(?:bia|beer|ruou|wine|vodka|whisky|whiskey|rum|gin|tequila|sake|soju|champagne|cocktail|lager|ale|stout)(?:$|[\s_])/.test(text);
  }
  function reconcileNutritionEnergy({ kcal, protein, carbs, fat, confidence, basis, food }) {
    const macroKcal = macroEnergy(protein, carbs, fat);
    if (food?.nonMacroEnergy || v68AlcoholEnergy(food))
      return { kcal, basis, warning: false, macroKcal };
    if (!(kcal > 0) || !(macroKcal > 0))
      return { kcal, basis, warning: false, macroKcal };
    const gap = macroKcal - kcal;
    const materialGap = Math.abs(gap) > Math.max(18, kcal * 0.18);
    if (!materialGap) return { kcal, basis, warning: false, macroKcal };
    const estimated = confidence === "low" || /(?:ước lượng|tự động|tham chiếu)/i.test(basis);
    if (gap > 0 && estimated) {
      return {
        kcal: Math.round(macroKcal),
        basis: `${basis} · calo đã tự hiệu chỉnh theo Protein/Carb/Fat`,
        warning: true,
        macroKcal,
      };
    }
    return {
      kcal,
      basis: `${basis} · cảnh báo: macro quy đổi khoảng ${fmt(Math.round(macroKcal))} kcal`,
      warning: true,
      macroKcal,
    };
  }

  function confidenceLabel(level) {
    return (
      {
        exact: "Chính xác",
        high: "Tin cậy cao",
        medium: "Ước lượng khá",
        low: "Ước lượng thấp",
        unresolved: "Chưa nhận diện",
      }[level] || level
    );
  }
  function formatQuantity(q, fraction) {
    if (fraction && Number(fraction[2]) !== 0)
      return `${fraction[1]}/${fraction[2]}`;
    return Number.isInteger(q) ? String(q) : fmt(q, 2);
  }
  /* V55 · Dữ liệu tự nhập: chỉ cần có kcal là đã là một món hợp lệ.
     Macro là tùy chọn. Ví dụ: “Buffet 3000kcal” hoặc “Bánh 2000kcal 30g đạm”. */
  function parseExplicitMacroValueV51(text, labels) {
    const raw = String(text || "");
    const label = labels.map(escapeRegExp).join("|");
    /* Cho phép: “30g đạm”, “30 đạm”, “protein 30g”, “protein 30”. */
    const numberFirst = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:g(?:ram|rams)?)?\\s*(?:${label})\\b`, "i");
    const labelFirst = new RegExp(`\\b(?:${label})\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:g(?:ram|rams)?)?\\b`, "i");
    const m = raw.match(numberFirst) || raw.match(labelFirst);
    return m ? Number(String(m[1]).replace(",", ".")) : null;
  }
  function parseExplicitCustomNutritionV51(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const kcalMatch = raw.match(/(?:^|[^a-z0-9])(\d+(?:[.,]\d+)?)\s*(?:kcal|calo|calorie|calories)\b/i);
    if (!kcalMatch) return null;
    const protein = parseExplicitMacroValueV51(raw,["đạm","dam","protein","proteins"]);
    const carbs = parseExplicitMacroValueV51(raw,["carb","carbs","carbohydrate","carbohydrates","tinh bột","tinh bot"]);
    const fat = parseExplicitMacroValueV51(raw,["fat","fats","chất béo","chat beo"]);
    const kcal = Number(String(kcalMatch[1]).replace(",","."));
    if (!(kcal>=0) || kcal>20000) return null;
    const stripMacroPairs = (value) => String(value)
      .replace(/(?:^|[^a-z0-9])(\d+(?:[.,]\d+)?)\s*(?:kcal|calo|calorie|calories)\b/ig," ")
      .replace(/(\d+(?:[.,]\d+)?)\s*(?:g(?:ram|rams)?)?\s*(?:đạm|dam|protein|proteins|carb|carbs|carbohydrate|carbohydrates|tinh bột|tinh bot|fat|fats|chất béo|chat beo)\b/ig," ")
      .replace(/\b(?:đạm|dam|protein|proteins|carb|carbs|carbohydrate|carbohydrates|tinh bột|tinh bot|fat|fats|chất béo|chat beo)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:g(?:ram|rams)?)?\b/ig," ")
      .replace(/(?:^|\s)(?:và|and)(?=\s|$)/ig," ")
      .replace(/[=,:;|]+/g," ")
      .replace(/[.!?…]+$/g," ")
      .replace(/\s+/g," ").trim();
    const name = stripMacroPairs(raw) || "Món tự nhập";
    const missing = [protein===null?"Đạm":null,carbs===null?"Carb":null,fat===null?"Fat":null].filter(Boolean);
    return {
      name,kcal,
      protein:protein??0,
      carbs:carbs??0,
      fat:fat??0,
      hasAnyMacro:[protein,carbs,fat].some((v)=>Number.isFinite(v)),
      missingMacros:missing,
      completeMacros:missing.length===0
    };
  }
  function splitFoodSegmentsV51(source) {
    /* V68: Excel/Sheet thường ghi "150g ức gà, 200g cơm, 1 quả trứng".
       Bản cũ không tách dấu phẩy nên cả dòng thành MỘT món lạ và cả ngày bị loại.
       Dấu phẩy chỉ tách khi không phải dấu thập phân (1,5 kg) và không nằm trong
       cụm macro tự nhập ("500 kcal, 30g đạm"). */
    const raw=String(source||"")
      .replace(/(\d)\s*,\s*(\d)/g,"$1<V68DEC>$2")
      .split(/\s*(?:\+|;|•|·|\n|\u2013|\u2014|,)\s*/i)
      .map((s)=>s.replace(/<V68DEC>/g,",").trim())
      .filter(Boolean);
    /* Ghép lại các mảnh chỉ chứa macro rời ("30g đạm") vào món ngay trước nó. */
    const merged=[];
    for(const part of raw){
      const macroOnly=/^\s*\d+(?:[.,]\d+)?\s*g?\s*(?:kcal|calo|protein|dam|đạm|carb(?:s|ohydrate)?|tinh bot|tinh bột|fat|chat beo|chất béo)\b/i.test(part)
        || /^(?:kcal|calo|protein|đạm|carb|fat)\b/i.test(part);
      if(macroOnly&&merged.length) merged[merged.length-1]=`${merged[merged.length-1]}, ${part}`;
      else merged.push(part);
    }
    const hard = merged;
    return hard.flatMap((part)=>{
      /* Hai món tự nhập nối bằng “và/and” được tách; nhưng
         “Bánh 2000kcal và 30g đạm” vẫn là một món duy nhất. */
      const connectorParts = part.split(/\s+(?:và|and)\s+/i).map((s)=>s.trim()).filter(Boolean);
      if (connectorParts.length > 1 && connectorParts.every((s)=>!!parseExplicitCustomNutritionV51(s)))
        return connectorParts;
      /* Nếu có kcal tự nhập, giữ nguyên cả cụm để parser lấy các macro đi kèm. */
      if (parseExplicitCustomNutritionV51(part)) return [part];
      const viParts = part.split(/\s+và\s+/i).map((s)=>s.trim()).filter(Boolean);
      return viParts.flatMap((viPart)=>{
        if (!/\s+and\s+/i.test(viPart)) return [viPart];
        const whole = findFood(viPart);
        const alias = normalizePhrase(whole?.matchedAlias || "");
        return /\band\b/.test(alias) ? [viPart] : viPart.split(/\s+and\s+/i).map((s)=>s.trim()).filter(Boolean);
      });
    });
  }
  /* =================== V68 · LÕI TÍNH DINH DƯỠNG ===================
     Sai lầm gốc của bản cũ: calo đi một đường, macro đi một đường khác.
     Calo lấy từ bảng, còn Carb/Fat thì suy ngược từ "phần calo còn thừa" theo một
     tỉ lệ đoán mò. Hai đường đó không bao giờ gặp nhau, nên mới ra 100 g phô mai
     26 g carb, hay đĩa rau xào 32 g carb.

     Nguyên lý mới, đúng như cách một bảng dinh dưỡng vận hành:
        1 khẩu phần  →  1 khối lượng (g hoặc ml)  →  1 hệ số  →  nhân cho CẢ BỐN chỉ số.
     Calo và macro từ đó luôn khớp nhau vì chúng là cùng một phép nhân. */

  const V68_UNIT_DEFAULT_GRAMS = {
    tbsp:14, tsp:5, cup:240, bowl:250, can:330, bottle:500,
    slice:28, piece:40, pack:40, box:180, whole:1000, unit:100
  };
  /* Đơn vị đong thể tích: với món lỏng thì quy ra ml, món đặc quy ra gram. */
  const V68_VOLUME_UNITS = new Set(["cup","can","bottle","tbsp","tsp","bowl"]);
  /* Một thìa canh không phải lúc nào cũng 14 g: mật ong đặc hơn dầu, đường nhẹ hơn bơ. */
  const V68_TBSP_GRAMS = [
    [/(?:mat ong|honey|syrup|mach nha)/,21],
    [/(?:sua dac|condensed milk)/,19],
    [/(?:bo dau phong|peanut butter|bo hat)/,16],
    [/(?:dau an|dau oliu|dau me|oil|olive oil|sesame oil|mo)/,13.6],
    [/(?:bo lat|butter|bo thuc vat|margarine)/,14],
    [/(?:duong|sugar)/,12.5],
    [/(?:muoi|salt)/,18],
    [/(?:bot|flour|powder|cocoa|whey)/,8],
    [/(?:nuoc mam|nuoc tuong|xi dau|giam|fish sauce|soy sauce|vinegar|sot|sauce)/,15]
  ];
  function v68TbspGrams(food){
    const text=`${String(food?.id||"")} ${normalizePhrase(food?.name||"")} ${normalizePhrase(food?.en||"")}`;
    for(const [re,grams] of V68_TBSP_GRAMS) if(re.test(text)) return grams;
    return V68_UNIT_DEFAULT_GRAMS.tbsp;
  }

  function v68Num(value){ const n=Number(value); return Number.isFinite(n)&&n>=0?n:null; }
  /* Bảng dinh dưỡng chuẩn hóa của một món: luôn quy về 100 g hoặc 100 ml. */
  function v68Vector(food,norm=""){
    const g=v68Num(food?.per100g), gp=v68Num(food?.protein100g), gc=v68Num(food?.carbs100g), gf=v68Num(food?.fat100g);
    if(g!==null&&g>0&&(gp!==null||gc!==null||gf!==null))
      return {unit:"g",kcal:g,protein:gp??0,carbs:gc??0,fat:gf??0,complete:gp!==null&&gc!==null&&gf!==null,method:"database"};
    const m=v68Num(food?.per100ml), mp=v68Num(food?.protein100ml), mc=v68Num(food?.carbs100ml), mf=v68Num(food?.fat100ml);
    if(m!==null&&m>0&&(mp!==null||mc!==null||mf!==null))
      return {unit:"ml",kcal:m,protein:mp??0,carbs:mc??0,fat:mf??0,complete:mp!==null&&mc!==null&&mf!==null,method:"database"};
    /* Món chưa có bảng đầy đủ (tra online, ước tính AI): dựng tạm từ hồ sơ chung. */
    const rate=directPer100gRate(food,norm);
    if(rate){
      const pp=proteinProfile(food,norm), mm=macroProfile(food,norm);
      return {unit:"g",kcal:rate.rate,protein:v68Num(pp.per100g)??null,carbs:v68Num(mm.carbs100g)??null,fat:v68Num(mm.fat100g)??null,complete:false,method:rate.method};
    }
    const rateMl=directPer100mlRate(food,norm);
    if(rateMl){
      const pp=proteinProfile(food,norm), mm=macroProfile(food,norm);
      return {unit:"ml",kcal:rateMl.rate,protein:v68Num(pp.per100ml)??null,carbs:v68Num(mm.carbs100ml)??null,fat:v68Num(mm.fat100ml)??null,complete:false,method:rateMl.method};
    }
    return null;
  }
  /* Khối lượng một khẩu phần của món theo từng loại đơn vị người dùng gõ. */
  function v68ServingAmount(food,kind,isBiteSize,vector){
    const per100=vector?.kcal||0;
    const fromKcal=(kcal)=>{const k=v68Num(kcal);return k!==null&&k>0&&per100>0?(k/per100)*100:null;};
    const own={
      piece:isBiteSize?(v68Num(food?.gramsPerBite)??18):(v68Num(food?.gramsPerPiece)??fromKcal(food?.perPiece)??v68Num(food?.gramsPerUnit)),
      slice:v68Num(food?.gramsPerSlice)??fromKcal(food?.perSlice),
      bowl:v68Num(food?.gramsPerBowl)??fromKcal(food?.perBowl),
      cup:v68Num(food?.gramsPerCup)??fromKcal(food?.perCup),
      can:v68Num(food?.gramsPerCan)??fromKcal(food?.perCan),
      pack:v68Num(food?.gramsPerPack)??fromKcal(food?.perPack),
      tbsp:v68Num(food?.gramsPerTbsp)??fromKcal(food?.perTbsp),
      whole:v68Num(food?.gramsPerWhole)??fromKcal(food?.perWhole),
      portion:v68Num(food?.gramsPerPortion)??fromKcal(food?.perPortion),
      unit:v68Num(food?.gramsPerUnit)??fromKcal(food?.perUnit)
    };
    /* 1. Bảng có sẵn khối lượng đúng loại đơn vị người dùng gõ → chính xác nhất. */
    if(own[kind]>0) return {amount:own[kind],source:"food"};
    /* 2. Đơn vị ĐONG (thìa, cốc, lon, chai, bát): kích thước do dụng cụ quyết định,
          không phải do món. Một thìa đường mãi mãi là ~14 g, dù bảng ghi theo 100 g. */
    const generic=V68_UNIT_DEFAULT_GRAMS[kind];
    /* Thìa là dụng cụ đong, không bảng nào ghi khẩu phần theo thìa. */
    if(kind==="tbsp") return {amount:v68TbspGrams(food),source:"generic"};
    if(kind==="tsp") return {amount:v68TbspGrams(food)/3,source:"generic"};
    /* 3. Khẩu phần thật ghi trên bảng. "1 bát bún chả" là khẩu phần của MÓN,
          không phải 250 ml đong bằng bát — nên khẩu phần của món được ưu tiên.
          Bảng ghi theo "100 g" thì không có khẩu phần thật, rơi xuống bảng quy đổi
          chung: một cốc sữa vẫn là 240 ml dù bảng ghi theo 100 ml. */
    const serving=food?.per100Basis?null:(v68Num(food?.gramsPerServing)??v68Num(food?.mlPerServing)??v68Num(food?.defaultGrams)??v68Num(food?.defaultMl));
    if(serving>0) return {amount:serving,source:"serving"};
    if(V68_VOLUME_UNITS.has(kind)) return {amount:generic,source:"generic"};
    /* 4. Món cũ chỉ có "một khẩu phần bao nhiêu calo" → suy ngược ra khối lượng.
          Bỏ qua với bảng ghi theo 100 g, vì ở đó defaultKcal chính là số/100 g:
          suy ngược sẽ ra đúng 100 g và một lát bánh mì thành cả 100 g bánh. */
    const fromServingKcal=food?.per100Basis?(fromKcal(food?.perPortion)??null):(fromKcal(food?.perPortion)??fromKcal(food?.defaultKcal));
    if(fromServingKcal>0) return {amount:fromServingKcal,source:"serving"};
    if(generic>0) return {amount:generic,source:"generic"};
    const last=v68Num(food?.defaultGrams)??v68Num(food?.defaultMl)??100;
    return {amount:last,source:"fallback"};
  }
  /* Ghi lại đúng từ người dùng gõ ("2 quả", "1 ổ") thay vì "2 đơn vị" chung chung. */
  const V68_UNIT_DISPLAY = {
    qua:"quả",trai:"trái",cai:"cái",chiec:"chiếc",mieng:"miếng",vien:"viên",cuon:"cuốn",o:"ổ",
    bat:"bát",chen:"chén",to:"tô",dia:"đĩa",coc:"cốc",ly:"ly",lon:"lon",chai:"chai",
    hop:"hộp",goi:"gói",bich:"bịch",lat:"lát",que:"que",xien:"xiên",thia:"thìa",muong:"muỗng",
    suat:"suất",phan:"phần",con:"con",khay:"khay",
    cup:"cốc",cups:"cốc",bowl:"bát",bowls:"bát",glass:"ly",glasses:"ly",can:"lon",cans:"lon",
    slice:"lát",slices:"lát",piece:"miếng",pieces:"miếng",pack:"gói",packs:"gói",
    serving:"suất",servings:"suất",plate:"đĩa",plates:"đĩa",box:"hộp",boxes:"hộp",whole:"con"
  };
  function v68UnitLabel(kind,unitWord=""){
    const typed=V68_UNIT_DISPLAY[normalizePhrase(unitWord)];
    if(typed) return typed;
    return {whole:"con",bowl:"bát",cup:"cốc",slice:"lát",pack:"gói",can:"lon",tbsp:"thìa",tsp:"thìa cà phê",piece:"miếng",portion:"suất",unit:"đơn vị"}[kind]||"đơn vị";
  }
  /* Quy mọi cách ghi về một con số duy nhất: bao nhiêu gram (hoặc ml) đã ăn. */
  function v68ResolveAmount({food,norm,weight,volume,quantity,kind,isBiteSize,vector,unitWord}){
    if(weight){
      let q=+weight[1].replace(",",".");
      if(["kg","kilogram","kilograms"].includes(weight[2]))q*=1000;
      return {amount:q,unit:"g",basis:`${fmt(q)} g`,confidence:"high"};
    }
    if(volume){
      let q=+volume[1].replace(",",".");
      if(["l","lit","liter","litre","liters","litres"].includes(volume[2]))q*=1000;
      return {amount:q,unit:"ml",basis:`${fmt(q)} ml`,confidence:"high"};
    }
    if(Number.isFinite(quantity)){
      const serving=v68ServingAmount(food,kind,isBiteSize,vector);
      const amount=quantity*serving.amount;
      const unit=vector?.unit==="ml"&&V68_VOLUME_UNITS.has(kind)?"ml":vector?.unit||"g";
      const note=serving.source==="food"?"":serving.source==="serving"?" (theo khẩu phần ghi trên bảng)":" (quy đổi đơn vị đong tiêu chuẩn)";
      return {amount,unit,basis:`${formatQuantity(quantity)} ${v68UnitLabel(kind,unitWord)} ≈ ${fmt(serving.amount)} ${unit}${note}`,confidence:serving.source==="food"?"high":"medium"};
    }
    const serving=v68ServingAmount(food,"portion",false,vector);
    const fallback=serving.amount>0?serving.amount:(v68Num(food?.defaultGrams)??v68Num(food?.defaultMl)??100);
    return {amount:fallback,unit:vector?.unit||"g",basis:`1 khẩu phần tham chiếu ≈ ${fmt(fallback)} ${vector?.unit||"g"}`,confidence:"low"};
  }
  /* Một hệ số duy nhất, nhân cho cả bốn chỉ số. Đó là toàn bộ phép tính. */
  function v68Scale(vector,amount){
    const factor=amount/100;
    return {
      kcal:vector.kcal*factor,
      protein:vector.protein===null?null:vector.protein*factor,
      carbs:vector.carbs===null?null:vector.carbs*factor,
      fat:vector.fat===null?null:vector.fat*factor
    };
  }
  /* Suy ra nhóm chế biến để cộng dầu khi người dùng ghi "chiên/xào/nướng"
     mà tên món trên bảng lại là nguyên liệu sống. */
  function v68MethodClass(food){
    if(food?.methodClass) return food.methodClass;
    const text=`${String(food?.id||"")} ${normalizePhrase(food?.name||"")} ${normalizePhrase(food?.en||"")}`;
    if(/(?:dau phu|tofu|dau hu)/.test(text)) return "tofu";
    if(/(?:tom|ca |ca$|muc|so |ngao|hen|cua|ghe|shrimp|fish|squid|salmon|tuna|crab|clam|oyster)/.test(text)) return "seafood";
    if(/(?:ba chi|thit mo|pork belly|duck|vit|ngan|bacon|xuc xich|lap xuong|salami)/.test(text)) return "fattyProtein";
    if(/(?:ga|bo|heo|lon|thit|trung|chicken|beef|pork|egg|meat|steak)/.test(text)) return "leanProtein";
    if(/(?:com|rice|banh|bun|pho|mi |mien|xoi|khoai|potato|noodle|bread|oat|yen mach|ngo|corn)/.test(text)) return "starch";
    if(/(?:rau|cai|nam|mushroom|vegetable|salad|bi |ca rot|carrot|dau que|gia do)/.test(text)) return "vegetable";
    if(/(?:chuoi|tao|cam|xoai|banana|apple|orange|mango|fruit|du du|dua hau)/.test(text)) return "fruit";
    return null;
  }

  function estimateFood(text) {
    const key=String(text??"");
    if(FOOD_ESTIMATE_MEMO.has(key))return FOOD_ESTIMATE_MEMO.get(key);
    const result=estimateFoodUncachedV66(key);
    if(FOOD_ESTIMATE_MEMO.size>=2000)FOOD_ESTIMATE_MEMO.clear();
    FOOD_ESTIMATE_MEMO.set(key,result);
    return result;
  }
  function estimateFoodUncachedV66(text) {
    const source = String(text ?? "").trim();
    if (!source || /^0+(?:[.,]0+)?$/.test(source))
      return {
        total: 0,
        proteinTotal: 0,
        carbsTotal: 0,
        fatTotal: 0,
        items: [],
        unresolvedCount: 0,
        warningCount: 0,
      };
    const segments = splitFoodSegmentsV51(source);
    let total = 0,
      proteinTotal = 0,
      carbsTotal = 0,
      fatTotal = 0,
      warningCount = 0,
      unresolvedCount = 0;
    const items = [];
    for (const original of segments) {
      const explicitCustom = parseExplicitCustomNutritionV51(original);
      if (explicitCustom) {
        const missingNote = explicitCustom.missingMacros.length
          ? ` · chưa nhập ${explicitCustom.missingMacros.join("/")} nên các macro đó không được tự đoán`
          : "";
        total += explicitCustom.kcal;
        proteinTotal += explicitCustom.protein;
        carbsTotal += explicitCustom.carbs;
        fatTotal += explicitCustom.fat;
        if (!explicitCustom.completeMacros) warningCount++;
        items.push({
          label: explicitCustom.name,
          original,
          kcal: Math.round(explicitCustom.kcal),
          protein: explicitCustom.protein,
          carbs: explicitCustom.carbs,
          fat: explicitCustom.fat,
          basis: `${explicitCustom.hasAnyMacro ? "Calo và macro nhập trực tiếp" : "Calo nhập trực tiếp"}${missingNote}`,
          confidence: "exact",
          confidenceText: confidenceLabel("exact"),
          source: "Dữ liệu tự nhập trong Excel",
          resolved: true,
          foodId: "custom_explicit_v55",
          customNutrition: true
        });
        continue;
      }
      const norm = normalizePhrase(original),
        match = findGenericProduceV53(original) || findFood(original);
      if (!match?.food) {
        unresolvedCount++;
        warningCount++;
        items.push({
          label: original,
          original,
          kcal: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          basis: "Chưa nhận diện — không cộng calo hoặc macro để tránh tính sai. Hãy dùng đúng tên trong bảng Thực phẩm hoặc ghi rõ khối lượng/khẩu phần.",
          confidence: "unresolved",
          confidenceText: confidenceLabel("unresolved"),
          source: "Không dùng ước lượng tự động",
          resolved: false,
          foodId: null,
        });
        continue;
      }
      let food = match.food;
      const weight = norm.match(
        /(\d+(?:[.,]\d+)?)\s*(kg|kilogram|kilograms|g|gram|grams)\b/,
      );
      const volume = norm.match(
        /(\d+(?:[.,]\d+)?)\s*(ml|l|lit|liter|litre|liters|litres)\b/,
      );
      const biteCount = norm.match(
          /(\d+(?:[.,]\d+)?)\s*(?:bite[ -]?size(?:d)?|small)?\s*(mieng|piece|pieces)\b/,
        ),
        count =
          biteCount ||
          norm.match(
            /(\d+(?:[.,]\d+)?)\s*(cai|chiec|qua|trai|mieng|vien|cuon|o|coc|ly|bat|chen|to|dia|plate|plates|hop|box|boxes|bich|bag|bags|goi|lon|que|xien|skewer|skewers|thia|muong|lat|slice|slices|serving|servings|phan|suat|piece|pieces|pc|pcs|unit|units|cup|cups|bowl|bowls|glass|glasses|pack|packet|packets|can|cans|con|whole|bird)\b/,
          );
      const fraction = norm.match(/^\s*(\d+)\s*\/\s*(\d+)\b/),
        fractionWhole = !!(fraction && /\b(?:con|whole|bird)\b/.test(norm)),
        leading = norm.match(/^\s*(\d+(?:[.,]\d+)?)\b/),
        ambiguousFoodUnit =
          count &&
          count[2] === "goi" &&
          normalizePhrase(match?.matchedAlias || "").startsWith("goi "),
        actualCount = fractionWhole ? null : ambiguousFoodUnit ? null : count,
        quantity = actualCount
          ? +actualCount[1].replace(",", ".")
          : fraction && +fraction[2] !== 0
            ? +fraction[1] / +fraction[2]
            : leading
              ? +leading[1].replace(",", ".")
              : null,
        kind = actualCount
          ? unitKind(actualCount[2])
          : fractionWhole
            ? "whole"
            : "unit",
        isBiteSize =
          /\b(?:bite[ -]?size(?:d)?|small bites?|mieng nho|nho vua an|hat luu)\b/.test(
            norm,
          );
      const per100 = norm.match(
        /(\d+(?:[.,]\d+)?)\s*kcal\s*(?:\/|per)\s*100\s*(g|gram|grams|ml)\b/,
      );
      const perUnit = norm.match(
        /(\d+(?:[.,]\d+)?)\s*kcal\s*(?:\/|per|moi)\s*(cai|chiec|qua|trai|mieng|vien|cuon|o|coc|ly|bat|chen|to|dia|plate|hop|box|bich|bag|goi|lon|que|xien|skewer|thia|muong|lat|slice|serving|phan|suat|piece|pc|unit|cup|bowl|glass|pack|packet|can|each|con|whole|bird)\b/,
      );
      const direct = norm.match(
        /(?:^|[=,:;\s])(\d+(?:[.,]\d+)?)\s*kcal\b(?!\s*(?:\/|per))/,
      );
      /* ---- V68: một khẩu phần → một hệ số → nhân cho cả kcal, đạm, carb, fat ---- */
      const vector = v68Vector(food, norm);
      const explicitProtein = norm.match(/(?:protein|dam|đạm)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*g\b/) || norm.match(/(\d+(?:[.,]\d+)?)\s*g\s*(?:protein|dam|đạm)\b/);
      const explicitCarb = norm.match(/(?:carb(?:s|ohydrate)?|tinh bot)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*g\b/) || norm.match(/(\d+(?:[.,]\d+)?)\s*g\s*(?:carb(?:s)?|tinh bot)\b/);
      const explicitFat = norm.match(/(?:fat|chat beo)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*g\b/) || norm.match(/(\d+(?:[.,]\d+)?)\s*g\s*(?:fat|chat beo)\b/);
      let kcal = 0, basis = "", confidence = "low",
        protein = null, carbs = null, fat = null, scaledAmount = null, amountUnit = "g";

      if (per100 && (weight || volume)) {
        const m = weight || volume;
        let qty = +m[1].replace(",", "."), u = m[2];
        if (["kg","kilogram","kilograms"].includes(u)) qty *= 1000;
        if (["l","lit","liter","litre","liters","litres"].includes(u)) qty *= 1000;
        const rate = +per100[1].replace(",", ".");
        kcal = (qty * rate) / 100; scaledAmount = qty; amountUnit = volume ? "ml" : "g";
        basis = `${fmt(qty)} ${amountUnit} × ${fmt(rate)} kcal/100 ${amountUnit} (nhập trực tiếp)`;
        confidence = "exact";
      } else if (perUnit && Number.isFinite(quantity)) {
        const rate = +perUnit[1].replace(",", ".");
        kcal = quantity * rate;
        basis = `${fmt(quantity)} đơn vị × ${fmt(rate)} kcal/đơn vị (nhập trực tiếp)`;
        confidence = "exact";
      } else if (direct) {
        kcal = +direct[1].replace(",", ".");
        basis = "Tổng calo nhập trực tiếp";
        confidence = "exact";
      } else if (vector) {
        const resolved = v68ResolveAmount({ food, norm, weight, volume, quantity, kind, isBiteSize, vector, unitWord: actualCount ? actualCount[2] : "" });
        /* Người dùng ghi ml nhưng bảng chỉ có số liệu theo gram (hoặc ngược lại):
           nước và món lỏng lấy khối lượng riêng ≈ 1, sai số nhỏ hơn nhiều so với bỏ qua. */
        const amount = resolved.amount;
        const scaled = v68Scale(vector, amount);
        kcal = scaled.kcal; protein = scaled.protein; carbs = scaled.carbs; fat = scaled.fat;
        scaledAmount = amount; amountUnit = vector.unit;
        const rateNote = vector.method === "database" ? "" : " (quy đổi từ hồ sơ dinh dưỡng)";
        basis = `${resolved.basis} × ${fmt(vector.kcal, 1)} kcal/100 ${vector.unit}${rateNote}`;
        confidence = food.isHeuristic ? "low"
          : resolved.confidence === "low" ? "low"
          : food.isOnline || vector.method !== "database" ? "medium"
          : resolved.confidence;
      } else {
        kcal = v68Num(food.perPortion) ?? v68Num(food.defaultKcal) ?? v68Num(food.perUnit) ?? 0;
        basis = "Không đủ dữ liệu theo khối lượng — dùng 1 khẩu phần tham chiếu";
        confidence = "low";
        warningCount++;
      }

      /* Giá trị người dùng tự ghi luôn thắng số liệu tra bảng. */
      if (explicitProtein) protein = Math.max(0, +explicitProtein[1].replace(",", "."));
      if (explicitCarb) carbs = Math.max(0, +explicitCarb[1].replace(",", "."));
      if (explicitFat) fat = Math.max(0, +explicitFat[1].replace(",", "."));

      if (food.genericEstimateV52 && confidence !== "exact") {
        confidence = "medium";
        basis += ` · ${food.genericNote || "ước tính chung do không ghi rõ loại thực phẩm"}`;
      }
      if (food.aiRecognized && confidence !== "exact") {
        confidence = "low";
        basis += " · Ước tính bởi AI; khẩu phần và công thức thực tế có thể khác";
      }
      if (food.isHeuristic) { basis += " · sẽ tự tra lại khi có kết nối"; warningCount++; }
      if (!food.isHeuristic && confidence !== "exact" && Number(food.rangePct) > 0 && kcal > 0) {
        const rp = clamp(Number(food.rangePct), 0.03, 0.35),
          lo = Math.max(0, Math.round(kcal * (1 - rp))),
          hi = Math.round(kcal * (1 + rp));
        basis += ` · khoảng hợp lý ${fmt(lo)}–${fmt(hi)} kcal ${food.rangeNote || "tùy kích thước, dầu và sốt"}`;
      }
      kcal = Math.max(0, Math.round(kcal));

      /* Chỉ những món thiếu số liệu mới phải ước tính macro; món có bảng đầy đủ thì không. */
      if (protein === null)
        protein = Math.max(0, estimateProteinAmount({ food, original, norm, weight, volume, quantity, kind, isBiteSize, kcal }));
      if (carbs === null || fat === null) {
        const guessed = estimateMacroAmounts({ food, original, norm, weight, volume, quantity, kind, isBiteSize, kcal, protein });
        if (carbs === null) carbs = guessed.carbs;
        if (fat === null) fat = guessed.fat;
      }
      protein = Math.max(0, Number(protein) || 0);
      carbs = Math.max(0, Number(carbs) || 0);
      fat = Math.max(0, Number(fat) || 0);

      /* Cộng dầu khi người dùng ghi cách chế biến mà bảng lại ghi nguyên liệu sống. */
      const cookingFood = food.methodClass ? food : { ...food, methodClass: v68MethodClass(food) };
      const cooked = applyCookingMethodV6({
        food: cookingFood, norm, match, weight, quantity, kind, isBiteSize,
        kcal, carbs, fat, basis, confidence
      });
      kcal = cooked.kcal; carbs = cooked.carbs; fat = cooked.fat;
      basis = cooked.basis; confidence = cooked.confidence;
      const integrity = reconcileNutritionEnergy({
        kcal,
        protein,
        carbs,
        fat,
        confidence,
        basis,
        food,
      });
      kcal = integrity.kcal;
      basis = integrity.basis;
      if (integrity.warning) warningCount++;
      total += kcal;
      proteinTotal += protein;
      carbsTotal += carbs;
      fatTotal += fat;
      items.push({
        label: food.name || original,
        original,
        kcal,
        protein,
        carbs,
        fat,
        basis,
        confidence,
        confidenceText: confidenceLabel(confidence),
        source: food.source || "Ước lượng tự động",
        resolved: true,
        foodId: food.id || null,
      });
    }
    /* V68: trước đây chỉ cần MỘT món lạ là total = null, cả ngày bị vứt khỏi
       thâm hụt lũy kế, biểu đồ và dự báo cân nặng. Một ngày 5 món mà lỡ 1 món thì
       mất luôn 4 món có thật — sai nhiều hơn là ước lượng thiếu.
       Từ V68: cộng đủ những món đã nhận diện, giữ unresolvedCount để gắn cảnh báo. */
    return {
      total: Math.round(total),
      proteinTotal: Math.round(proteinTotal),
      carbsTotal: Math.round(carbsTotal),
      fatTotal: Math.round(fatTotal),
      items,
      unresolvedCount,
      resolvedCount: items.length - unresolvedCount,
      warningCount,
    };
  }
  function renderFoodDatabase() {}
  function previewFoodText() {}
  function parseDurationMinutes(text, type) {
    if (text === null || text === undefined || text === "") return 0;
    if (Array.isArray(text)) {
      const h = Number(text[0]) || 0,
        m = Number(text[1]) || 0,
        s = Number(text[2]) || 0;
      return Math.max(0, Math.round(h * 60 + m + s / 60));
    }
    if (typeof text === "number" && Number.isFinite(text)) {
      if (text === 0) return 0;
      if (text > 0 && text < 1) return Math.max(0, Math.round(text * 1440));
      return type === "strength" && text <= 5 ? Math.round(text * 60) : Math.round(text);
    }
    const src = strip(String(text).trim()).trim();
    if (!src || /^(0|0\.0+|khong|none|no|null|nan|-)$/.test(src)) return 0;
    if (/\b(kcal|calo|calories?)\b/.test(src)) return 0;
    let minutes = 0;
    const clock = src.match(/\b(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?\b/);
    if (clock) minutes += +clock[1] * 60 + +clock[2] + ((+clock[3] || 0) / 60);
    const hour = src.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours|gio|tieng)\b/);
    if (hour) minutes += parseFloat(hour[1].replace(",", ".")) * 60;
    const min = src.match(/(\d+(?:[.,]\d+)?)\s*(m|min|mins|minute|minutes|phut|p)\b/);
    if (min) minutes += parseFloat(min[1].replace(",", "."));
    const hourMin = src.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|gio|tieng)\s*(\d{1,2})\b/);
    if (hourMin && !hour) minutes += parseFloat(hourMin[1].replace(",", ".")) * 60 + +hourMin[3];
    if (!minutes) {
      const bare = cleanNumber(src);
      if (bare !== null) {
        if (bare > 0 && bare < 1) minutes = bare * 1440;
        else minutes = type === "strength" && bare <= 5 ? bare * 60 : bare;
      }
    }
    return Math.max(0, Math.round(minutes));
  }
  function exerciseCaloriesFromInput(value, fallbackKcal = 0) {
    const src = strip(value ?? "").trim();
    if (!src) return fallbackKcal;
    const m = src.match(/(\d+(?:[.,]\d+)?)\s*(kcal|calo|calories?)\b/);
    if (m) return Math.max(0, Math.round(parseFloat(m[1].replace(",", "."))));
    return fallbackKcal;
  }
  function rfm(waist) {
    return Number.isFinite(waist) && waist > 0
      ? (PROFILE.sex === "male" ? 64 : 76) - 20 * (PROFILE.height / waist)
      : null;
  }
  function katchBmr(weight, bodyFat) {
    const lean = weight * (1 - bodyFat / 100);
    return 370 + 21.6 * lean;
  }
  function addCalendarDays(date, days) {
    const d = makeCalendarDate(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    d.setDate(d.getDate() + days);
    return makeCalendarDate(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function simulateTodayPattern(todayData, currentWeight, currentBodyFat) {
    if (
      !todayData ||
      !todayData.complete ||
      !Number.isFinite(todayData.foodEst?.total)
    )
      return { state: "missing" };
    const intake = todayData.foodEst.total,
      leanMass = currentWeight * (1 - currentBodyFat / 100),
      startDate = getVietnamToday(),
      maxDays = 36525;
    const statsForWeight = (weight) => {
      const bodyFat = clamp(100 * (1 - leanMass / weight), 3, 70),
        baseTdee = Math.round(
          katchBmr(weight, bodyFat) * PROFILE.activityFactor,
        ),
        rawStrengthBurn = strengthCalories(
          todayData.strengthMin,
          weight,
          todayData.strength,
        ),
        rawCardioBurn = cardioCalories(todayData.cardioMin, weight),
        strengthBurn = exerciseCaloriesFromInput(todayData.strength, rawStrengthBurn),
        cardioBurn = exerciseCaloriesFromInput(todayData.cardio, rawCardioBurn),
        totalOut = baseTdee + strengthBurn + cardioBurn;
      return {
        bodyFat,
        baseTdee,
        strengthBurn,
        cardioBurn,
        totalOut,
        balance: totalOut - intake,
      };
    };
    const first = statsForWeight(currentWeight);
    if (Math.abs(first.balance) < 1)
      return {
        state: "neutral",
        intake,
        firstBalance: 0,
        firstTotalOut: first.totalOut,
      };
    const direction = first.balance > 0 ? "deficit" : "surplus",
      targetBodyFat = direction === "deficit" ? PROFILE.targetBodyFat : 40;
    if (direction === "deficit" && currentBodyFat <= targetBodyFat)
      return {
        state: "reached",
        direction,
        targetBodyFat,
        days: 0,
        date: startDate,
        finalWeight: currentWeight,
        finalBodyFat: currentBodyFat,
        intake,
        firstBalance: first.balance,
        firstTotalOut: first.totalOut,
      };
    if (direction === "surplus" && currentBodyFat >= targetBodyFat)
      return {
        state: "reached",
        direction,
        targetBodyFat,
        days: 0,
        date: startDate,
        finalWeight: currentWeight,
        finalBodyFat: currentBodyFat,
        intake,
        firstBalance: first.balance,
        firstTotalOut: first.totalOut,
      };
    let weight = currentWeight,
      days = 0,
      last = first;
    while (days < maxDays) {
      const bf = clamp(100 * (1 - leanMass / weight), 3, 70);
      if (
        (direction === "deficit" && bf <= targetBodyFat) ||
        (direction === "surplus" && bf >= targetBodyFat)
      )
        break;
      last = statsForWeight(weight);
      if (
        (direction === "deficit" && last.balance <= 0) ||
        (direction === "surplus" && last.balance >= 0)
      )
        return {
          state: "stalled",
          direction,
          targetBodyFat,
          days,
          finalWeight: weight,
          finalBodyFat: bf,
          intake,
          firstBalance: first.balance,
          firstTotalOut: first.totalOut,
        };
      weight = Math.max(leanMass / 0.97, weight - last.balance / 7700);
      days++;
    }
    const finalBodyFat = clamp(100 * (1 - leanMass / weight), 3, 70);
    if (days >= maxDays)
      return {
        state: "stalled",
        direction,
        targetBodyFat,
        days,
        finalWeight: weight,
        finalBodyFat,
        intake,
        firstBalance: first.balance,
        firstTotalOut: first.totalOut,
      };
    return {
      state: "projected",
      direction,
      targetBodyFat,
      days,
      date: addCalendarDays(startDate, days),
      finalWeight: weight,
      finalBodyFat,
      intake,
      firstBalance: first.balance,
      firstTotalOut: first.totalOut,
    };
  }
  function strengthCalories(minutes, weight, text = "") {
    if (!minutes) return 0;
    let met = PROFILE.strengthMet,
      n = strip(text);
    if (n.includes("nhe") || n.includes("light")) met = 3.5;
    if (n.includes("nang") || n.includes("heavy") || n.includes("intense"))
      met = 6;
    return Math.round(
      ((Math.max(0, met - 1.2) * 3.5 * weight) / 200) * minutes,
    );
  }
  function cardioCalories(minutes, weight) {
    if (!minutes) return 0;
    const speed = (3.3 * 1000) / 60,
      grade = 0.15,
      grossVo2 = 0.1 * speed + 1.8 * speed * grade + 3.5,
      netVo2 = Math.max(0, grossVo2 - 3.5);
    return Math.round(((netVo2 * weight) / 1000) * 5 * minutes);
  }
  function normalizeRows(rows) {
    const grouped = new Map();
    rows.forEach((r) => {
      const d = parseDate(r.date);
      if (!d) return;
      const key = dateKey(d);
      if (!grouped.has(key))
        grouped.set(key, {
          date: d,
          food: [],
          strength: [],
          cardio: [],
          weight: null,
          waist: null,
        });
      const g = grouped.get(key),
        foodValue = String(r.food ?? 0).trim(),
        strengthValue = String(r.strength ?? 0).trim(),
        cardioValue = String(r.cardio ?? 0).trim();
      g.food.push(foodValue || "0");
      g.strength.push(strengthValue || "0");
      g.cardio.push(cardioValue || "0");
      const w = cleanNumber(r.weight);
      if (w !== null && w > 0) g.weight = w;
      const e = cleanNumber(r.waist);
      if (e !== null && e > 0) g.waist = e;
    });
    return [...grouped.values()]
      .sort((a, b) => a.date - b.date)
      .map((g) => ({
        ...g,
        food: g.food.filter(Boolean).join(" + ") || "0",
        strength: g.strength.filter(Boolean).join(" + ") || "0",
        cardio: g.cardio.filter(Boolean).join(" + ") || "0",
      }));
  }
  function rowsThroughToday(rows) {
    const todayKey = dateKey(getVietnamToday());
    return rows.filter((r) => {
      const d = parseDate(r.date);
      return d && dateKey(d) <= todayKey;
    });
  }
  function rowsThroughTomorrowForHistory(rows) {
    const tomorrowKey = dateKey(addCalendarDays(getVietnamToday(), 1));
    return rows.filter((r) => {
      const d = parseDate(r.date);
      return d && dateKey(d) <= tomorrowKey;
    });
  }
  function compute(rows) {
    const normalized = normalizeRows(rows),
      firstWeight =
        normalized.find((r) => r.weight !== null)?.weight ||
        PROFILE.defaultWeight,
      firstWaist = normalized.find((r) => r.waist !== null)?.waist || null,
      initialLean = firstWeight * (1 - PROFILE.startBodyFat / 100),
      rawInitialRfm = firstWaist ? rfm(firstWaist) : null,
      rfmOffset =
        rawInitialRfm === null ? 0 : PROFILE.startBodyFat - rawInitialRfm;
    let projectedWeight = firstWeight,
      currentBf = PROFILE.startBodyFat,
      lastWaist = firstWaist,
      cumulative = 0,
      lastMeasuredWeight = firstWeight;
    return normalized.map((r) => {
      if (r.weight !== null) {
        projectedWeight = r.weight;
        lastMeasuredWeight = r.weight;
      }
      if (r.waist !== null) lastWaist = r.waist;
      const weightStart = projectedWeight;
      const bfByWeight = clamp(100 * (1 - initialLean / weightStart), 3, 60),
        bfByWaist =
          lastWaist !== null ? clamp(rfm(lastWaist) + rfmOffset, 3, 60) : null;
      currentBf = clamp(
        bfByWaist === null ? bfByWeight : 0.58 * bfByWaist + 0.42 * bfByWeight,
        3,
        60,
      );
      const baseTdee = Math.round(
          katchBmr(weightStart, currentBf) * PROFILE.activityFactor,
        ),
        foodEst = estimateFood(r.food),
        strengthMin = parseDurationMinutes(r.strength, "strength"),
        cardioMin = parseDurationMinutes(r.cardio, "cardio"),
        rawStrengthBurn = strengthCalories(strengthMin, weightStart, r.strength),
        rawCardioBurn = cardioCalories(cardioMin, weightStart),
        strengthBurn = exerciseCaloriesFromInput(r.strength, rawStrengthBurn),
        cardioBurn = exerciseCaloriesFromInput(r.cardio, rawCardioBurn),
        exerciseBurn = strengthBurn + cardioBurn,
        totalOut = baseTdee + exerciseBurn,
        /* Ngày để trống hoặc ghi "0" là CHƯA NHẬP, không phải ngày nhịn ăn 0 kcal.
           Tính nó thành thâm hụt trọn một ngày TDEE sẽ thổi phồng lũy kế. */
        complete = foodEst.total !== null && foodEst.resolvedCount > 0,
        partial = foodEst.unresolvedCount > 0,
        deficit = complete ? totalOut - foodEst.total : null;
      if (complete) cumulative += deficit;
      const endWeight = complete
        ? Math.max(35, weightStart - deficit / 7700)
        : weightStart;
      const endBfWeight = clamp(100 * (1 - initialLean / endWeight), 3, 60),
        endBfWaist =
          lastWaist !== null ? clamp(rfm(lastWaist) + rfmOffset, 3, 60) : null,
        endBodyFat = clamp(
          endBfWaist === null
            ? endBfWeight
            : 0.58 * endBfWaist + 0.42 * endBfWeight,
          3,
          60,
        );
      currentBf = endBodyFat;
      projectedWeight = endWeight;
      return {
        ...r,
        startWeight: firstWeight,
        startWaist: firstWaist,
        leanMass: initialLean,
        weightUsed: weightStart,
        measuredWeight: r.weight,
        projectedWeight: endWeight,
        lastMeasuredWeight,
        waistUsed: lastWaist,
        bodyFat: currentBf,
        foodEst,
        strengthMin,
        cardioMin,
        strengthBurn,
        cardioBurn,
        exerciseBurn,
        baseTdee,
        totalOut,
        deficit,
        cumulative,
        complete,
        partial,
        achieved: complete && deficit > 0,
      };
    });
  }
  function render() {
    const today = getVietnamToday(),
      eligibleRows = rowsThroughToday(rawRows);
    computedDays = compute(eligibleRows);
    const completeDays = computedDays.filter((d) => d.complete),
      latest = computedDays.at(-1) || null,
      latestComplete = completeDays.at(-1) || null,
      startWeight = latest?.startWeight || PROFILE.defaultWeight,
      leanMass = startWeight * (1 - PROFILE.startBodyFat / 100),
      targetWeight = leanMass / (1 - PROFILE.targetBodyFat / 100),
      totalGoal = Math.max(1, (startWeight - targetWeight) * 7700),
      cumulative = latestComplete?.cumulative || 0,
      currentWeight = latest?.projectedWeight || startWeight,
      currentWaist = latest?.waistUsed ?? null,
      currentBf = latest?.bodyFat ?? PROFILE.startBodyFat,
      progress = cumulative / totalGoal,
      initialMeasured =
        computedDays.find((d) => d.measuredWeight !== null)?.measuredWeight ??
        startWeight,
      initialWaist = computedDays.find((d) => d.waist !== null)?.waist ?? null;
    setText(
      "latestDate",
      latest
        ? formatDateVi(latest.date)
        : `Chưa có dữ liệu đến ${formatDateVi(today)}`,
    );
    setText("kpiWeight", `${fmt(currentWeight, 1)} kg`);
    setText(
      "kpiWeightSub",
      `${currentWeight <= initialMeasured ? "Giảm" : "Tăng"} ${fmt(Math.abs(currentWeight - initialMeasured), 2)} kg; cân thật gần nhất ${fmt(latest?.lastMeasuredWeight || startWeight, 1)} kg`,
    );
    setText(
      "kpiWaist",
      currentWaist !== null ? `${fmt(currentWaist, 1)} cm` : "—",
    );
    setText(
      "kpiWaistSub",
      currentWaist !== null && initialWaist !== null
        ? `${currentWaist <= initialWaist ? "Giảm" : "Tăng"} ${fmt(Math.abs(currentWaist - initialWaist), 1)} cm từ mốc đầu`
        : "Chưa có số đo vòng eo",
    );
    setText("kpiBodyFat", `${fmt(currentBf, 1)}%`);
    setText("kpiBodyFatSub", "Đồng bộ từ cân, eo và khối nạc nền");
    setText("kpiTdee", latest ? `${fmt(latest.baseTdee)} kcal` : "—");
    setText(
      "kpiTdeeSub",
      latest
        ? `TDEE nền hệ số 1,20; calo tập gần nhất ${fmt(latest.exerciseBurn)} kcal`
        : "—",
    );
    setText("kpiTargetWeight", `${fmt(targetWeight, 1)} kg`);
    setText(
      "kpiTargetSub",
      `Còn khoảng ${fmt(Math.max(0, currentWeight - targetWeight), 1)} kg nếu giữ khối nạc`,
    );
    setText(
      "latestStatus",
      latestComplete
        ? latestComplete.deficit > 0
          ? "✓ Đạt — đang thâm hụt calo"
          : latestComplete.deficit < 0
            ? "✕ Chưa đạt — đang dư thừa calo"
            : "Chưa tạo thâm hụt"
        : "Chưa đủ dữ liệu",
    );
    updateTargetBurnHighlight(currentWeight, currentBf, cumulative, totalGoal, targetWeight);
    updateCalorieJar(cumulative, totalGoal);
    updateSlope(progress, cumulative, totalGoal, targetWeight);
    const todayData =
      computedDays.find((d) => dateKey(d.date) === dateKey(today)) || null;
    const recent = completeDays.slice(-7),
      avg = recent.length
        ? recent.reduce((a, d) => a + d.deficit, 0) / recent.length
        : null;
    let streak = 0;
    for (
      let i = completeDays.length - 1;
      i >= 0 && completeDays[i].deficit > 0;
      i--
    )
      streak++;
    setText(
      "avg7Deficit",
      avg === null
        ? "—"
        : avg >= 0
          ? `${fmt(avg)} kcal/ngày`
          : `Dư ${fmt(Math.abs(avg))} kcal/ngày`,
    );
    setText("streakDays", `${streak} ngày`);
    setText("loggedDays", `${completeDays.length} ngày`);
    setText(
      "todayNet",
      todayData
        ? `${fmt(todayData.foodEst.total - todayData.exerciseBurn)} kcal`
        : "—",
    );
    renderTargetDates(
      cumulative,
      totalGoal,
      todayData,
      currentWeight,
      currentBf,
    );
    writeOverviewSnapshot();
    /* V61: overview paints first. Calendar/history/charts are rendered only when opened. */
    if (currentPage !== "overview" && currentPage !== "lookup") {
      renderActiveSecondaryView(currentPage, today);
    }
  }
  function renderActiveSecondaryView(name, today = getVietnamToday()) {
    if (name === "calendar") {
      renderCalendar(computedDays, today.getFullYear());
      return;
    }
    if (name === "history") {
      const historyPreviewDays = compute(rowsThroughTomorrowForHistory(rawRows));
      const tomorrowPreviewCount = Math.max(0, historyPreviewDays.length - computedDays.length);
      renderHistory(historyPreviewDays, today);
      setText(
        "historyCount",
        tomorrowPreviewCount
          ? `${computedDays.length} ngày đã tính · +${tomorrowPreviewCount} ngày mai dự kiến`
          : `${computedDays.length} ngày`,
      );
      return;
    }
    if (name === "charts") {
      const completeDays = computedDays.filter((d) => d.complete);
      requestAnimationFrame(() => renderCharts(completeDays));
    }
  }

  function updateSlope(progressRaw, cumulative, totalGoal, targetWeight) {
    const p = clamp(progressRaw, 0, 1),
      percent = p * 100,
      fill = document.getElementById("fatProgressFill"),
      marker = document.getElementById("fatProgressMarker"),
      track = document.getElementById("fatProgressTrack");
    if (fill) fill.style.width = `${percent}%`;
    if (marker) marker.style.left = `${percent}%`;
    if (track) {
      track.setAttribute("aria-valuenow", String(Number(percent.toFixed(1))));
      track.classList.toggle("surplus", cumulative < 0);
    }
    setText("progressPercent", `${fmt(percent, 1)}%`);
    setText(
      "fatProgressStartLabel",
      `${fmt(PROFILE.startBodyFat, 0)}% mỡ ban đầu`,
    );
    const remain = Math.max(0, totalGoal - cumulative),
      fatChange = Math.abs(cumulative) / 7700;
    setText(
      "slopeDescription",
      cumulative > 0
        ? `Đã thâm hụt tổng cộng ${fmt(cumulative)} kcal; cần thâm hụt thêm ${fmt(remain)} kcal để tiến tới khoảng ${fmt(targetWeight, 1)} kg.`
        : cumulative < 0
          ? `Đang dư thừa lũy kế ${fmt(Math.abs(cumulative))} kcal; thanh tiến độ đang ở 0% cho tới khi bù hết lượng dư thừa.`
          : `Hiện đang cân bằng năng lượng; cần tạo thâm hụt ${fmt(remain)} kcal để tiến tới khoảng ${fmt(targetWeight, 1)} kg.`,
    );
    setText(
      "slopeDone",
      cumulative > 0
        ? `Thâm hụt ${fmt(cumulative)} kcal`
        : cumulative < 0
          ? `Dư thừa ${fmt(Math.abs(cumulative))} kcal`
          : "Cân bằng 0 kcal",
    );
    setText("slopeRemaining", `Cần thâm hụt thêm ${fmt(remain)} kcal`);
    setText(
      "slopeFatEquivalent",
      cumulative > 0
        ? `Giảm ${fmt(fatChange, 2)} kg mỡ`
        : cumulative < 0
          ? `Tăng ${fmt(fatChange, 2)} kg mỡ`
          : "Không thay đổi: 0,00 kg",
    );
  }

  function formatTargetBurnDuration(minutes) {
    if (!Number.isFinite(minutes) || minutes <= 0) return "0 giờ";
    const totalMinutes = Math.round(minutes);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return `${fmt(hours)} giờ ${mins ? `${mins} phút` : ""} · ${fmt(days)} ngày ${remHours ? `${remHours} giờ` : ""}`.trim();
    }
    if (hours > 0) return `${fmt(hours)} giờ ${mins ? `${mins} phút` : ""}`.trim();
    return `${fmt(mins)} phút`;
  }
  /* V54 · The target-burn hero and the progress panel MUST use one identical goal ledger.
     Baseline target = start weight + PROFILE.startBodyFat, then only cumulative energy balance
     advances/regresses progress. Current scale/BF readings remain informational and are NOT
     allowed to silently reset the calorie goal. */
  function calculateTargetBurnPlan(currentWeight, cumulative, totalGoal, targetWeight) {
    const remainingKcal = Math.max(0, totalGoal - cumulative);
    const fatKgToLose = remainingKcal / 7700;

    const treadmillSpeedKmh = 3.3;
    const treadmillGrade = 0.15;
    const speedMetersPerMinute = treadmillSpeedKmh * 1000 / 60;
    const vo2 = 0.1 * speedMetersPerMinute + 1.8 * speedMetersPerMinute * treadmillGrade + 3.5;
    const kcalPerMinute = vo2 * currentWeight * 5 / 1000;
    const walkMinutes = kcalPerMinute > 0 ? remainingKcal / kcalPerMinute : 0;

    return {
      targetWeightNow: targetWeight,
      fatKgToLose,
      kcalToBurn: remainingKcal,
      treadmillSpeedKmh,
      treadmillGrade,
      vo2,
      kcalPerMinute,
      walkMinutes,
    };
  }
  function updateTargetBurnHighlight(currentWeight, currentBodyFat, cumulative, totalGoal, targetWeight) {
    const plan = calculateTargetBurnPlan(currentWeight, cumulative, totalGoal, targetWeight);
    const achieved = plan.kcalToBurn <= 1;
    setText("targetBurnKcal", achieved ? "0" : fmt(plan.kcalToBurn));
    setText("targetBurnWeight", `${fmt(plan.targetWeightNow, 1)} kg`);
    setText("targetBurnFatKg", achieved ? "Đã đạt" : `${fmt(plan.fatKgToLose, 2)} kg mỡ`);
    setText(
      "targetBurnSub",
      achieved
        ? `Đã đạt mục tiêu năng lượng tích lũy.`
        : `Mỡ hiện tại ${fmt(currentBodyFat, 1)}% · đã tính toàn bộ lịch sử ăn và tập.`,
    );
    setText(
      "targetBurnWalkTime",
      achieved ? "0" : fmt(Math.ceil(plan.walkMinutes / 60)),
    );
    setText(
      "targetBurnWalkSub",
      achieved
        ? "Đã đạt mục tiêu."
        : `Quy đổi toàn bộ calo còn lại ở cân nặng ${fmt(currentWeight, 1)} kg.`,
    );
    setText("targetBurnRate", `${fmt(plan.kcalPerMinute, 2)} kcal/phút`);
    setText("targetBurnSessions60", `${fmt(Math.ceil(plan.walkMinutes / 60))} buổi`);
    setText("targetBurnSessions90", `${fmt(Math.ceil(plan.walkMinutes / 90))} buổi`);
  }

  function updateCalorieJar(cumulative, totalGoal) {
    const saved = Math.max(0, Math.round(cumulative));
    const percent = totalGoal > 0 ? clamp(saved / totalGoal, 0, 1) * 100 : 0;
    setText("calorieJarValue", `$${fmt(saved)}`);
    setText(
      "calorieJarSub",
      cumulative > 0
        ? `Đã tích ${fmt(percent, 1)}% mục tiêu · còn ${fmt(Math.max(0, totalGoal - cumulative))} kcal`
        : cumulative < 0
          ? `Hũ về $0 · đang dư lũy kế ${fmt(Math.abs(cumulative))} kcal`
          : "Chưa tích được tiền kcal nào",
    );
  }

  function renderTargetDates(
    cumulative,
    totalGoal,
    todayData,
    currentWeight,
    currentBodyFat,
  ) {
    const remaining = Math.max(0, totalGoal - cumulative),
      rates = [300, 500, 800, 1000],
      now = getVietnamToday(),
      projection = simulateTodayPattern(
        todayData,
        currentWeight,
        currentBodyFat,
      );

    let todayCard = "";
    if (projection.state === "missing") {
      todayCard = `<article class="forecast-compact today"><span>Hôm nay</span><strong>Ăn hôm nay —</strong><b>—</b><small>Chưa đủ dữ liệu để tính Hụt/Dư</small></article>`;
    } else {
      const intakeText = `Ăn hôm nay ${fmt(projection.intake)} kcal`;
      const balance = Number(projection.firstBalance) || 0;
      const sign = balance > 0 ? "deficit" : balance < 0 ? "surplus" : "neutral";
      const toneClass = sign === "surplus" ? " surplus" : "";
      const balanceText = sign === "deficit"
        ? `✓ Hụt ${fmt(balance)} kcal`
        : sign === "surplus"
          ? `✕ Dư ${fmt(Math.abs(balance))} kcal`
          : "• Cân bằng 0 kcal";
      let foot = "";
      if (sign === "deficit" && projection.state === "projected") {
        foot = `Nếu giữ nhịp này: ${fmt(projection.days)} ngày · ${formatDateVi(projection.date)}`;
      } else if (sign === "deficit") {
        foot = "Thâm hụt hiện tại chưa đủ để chạm mốc 12% mỡ.";
      } else if (sign === "surplus") {
        foot = "Giữ nhịp này sẽ xa mục tiêu hơn.";
      } else {
        foot = "Không có mốc mới nếu giữ nguyên hôm nay.";
      }
      todayCard = `<article class="forecast-compact today${toneClass}"><span>Hôm nay</span><strong>${intakeText}</strong><b>${balanceText}</b><small>${foot}</small></article>`;
    }

    const fixedCards = rates
      .map((rate) => {
        const days = Math.ceil(remaining / rate),
          date = addCalendarDays(now, days);
        return `<article class="forecast-compact"><span>${fmt(rate)} kcal/ngày</span><b>${fmt(days)} ngày</b><small>${formatDateVi(date)}</small></article>`;
      })
      .join("");
    document.getElementById("targetDates").innerHTML = todayCard + fixedCards;
  }
  function renderCalendar(days, preferredYear) {
    const latest = days.at(-1) || null,
      year = Number.isInteger(preferredYear)
        ? preferredYear
        : latest?.date?.getFullYear() || getVietnamToday().getFullYear(),
      yearDays = days.filter((d) => d.date.getFullYear() === year),
      map = new Map(yearDays.map((d) => [dateKey(d.date), d])),
      months = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`),
      week = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
      today = getVietnamToday(),
      todayKey = dateKey(today),
      latestKey =
        latest && latest.date.getFullYear() === year
          ? dateKey(latest.date)
          : null,
      shortKcal = (n) => {
        const value = Math.round(Math.abs(Number(n) || 0));
        return value >= 1000
          ? `${(value / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}k`
          : fmt(value);
      };
    setText("calendarTitle", `Lịch năm ${year}`);
    let good = 0,
      bad = 0,
      empty = 0;
    const cards = [];
    for (let month = 0; month < 12; month++) {
      const daysIn = new Date(year, month + 1, 0).getDate(),
        first = (new Date(year, month, 1).getDay() + 6) % 7;
      let cells = "",
        monthGood = 0,
        monthBad = 0;
      for (let i = 0; i < first; i++)
        cells += '<span class="cal-day blank"></span>';
      for (let day = 1; day <= daysIn; day++) {
        const d = makeCalendarDate(year, month, day),
          key = dateKey(d),
          entry = map.get(key);
        let cls = "cal-day",
          mark = "",
          title = formatDateVi(d);
        if (entry?.complete) {
          if (entry.deficit > 0) {
            cls += " good";
            mark = `Hụt<br>${shortKcal(entry.deficit)}`;
            good++;
            monthGood++;
            title += ` — thâm hụt ${fmt(entry.deficit)} kcal`;
          } else if (entry.deficit < 0) {
            cls += " bad";
            mark = `Dư<br>${shortKcal(entry.deficit)}`;
            bad++;
            monthBad++;
            title += ` — dư thừa ${fmt(Math.abs(entry.deficit))} kcal`;
          } else {
            cls += " bad";
            mark = "Cân<br>bằng";
            bad++;
            monthBad++;
            title += " — cân bằng 0 kcal";
          }
        } else {
          cls += " incomplete";
          empty++;
          title += " — chưa đủ dữ liệu";
        }
        if (key === todayKey) cls += " today";
        if (key === latestKey) cls += " latest";
        if (d > today) cls += " future";
        cells += `<span class="${cls}" data-key="${entry ? key : ""}" title="${escapeHtml(title)}"><span class="day-num">${day}</span><b class="mark">${mark}</b></span>`;
      }
      cards.push(
        `<article class="month-card"><div class="month-title"><strong>${months[month]} ${year}</strong><span>${monthGood} ngày hụt · ${monthBad} ngày dư</span></div><div class="week-head">${week.map((x) => `<span>${x}</span>`).join("")}</div><div class="month-days">${cells}</div></article>`,
      );
    }
    document.getElementById("yearCalendar").innerHTML = cards.join("");
    setText("calendarGood", good);
    setText("calendarBad", bad);
    setText("calendarEmpty", empty);
    document
      .querySelectorAll('.cal-day[data-key]:not([data-key=""])')
      .forEach((el) =>
        el.addEventListener("click", () => {
          showPage("history");
          setTimeout(
            () =>
              document
                .getElementById(`day-${el.dataset.key}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" }),
            60,
          );
        }),
      );
  }
  function renderHistory(days, today = getVietnamToday()) {
    const list = document.getElementById("historyList"),
      todayKey = dateKey(today),
      tomorrowKey = dateKey(addCalendarDays(today, 1));
    list.querySelectorAll("details[data-day-key]").forEach((details) => {
      historyDetailsState.set(details.dataset.dayKey, details.open);
    });
    if (!days.length) {
      list.innerHTML =
        '<div class="panel" style="padding:20px;color:var(--muted)">Chưa có dữ liệu trong Sheet.</div>';
      return;
    }
    list.innerHTML = [...days]
      .reverse()
      .map((d) => {
        const dayKey = dateKey(d.date),
          isToday = dayKey === todayKey,
          isTomorrowPreview = dayKey === tomorrowKey,
          daySpecialClass = isTomorrowPreview
            ? "tomorrow-preview"
            : isToday
              ? "today-highlight"
              : "",
          state = !d.complete ? "incomplete" : d.achieved ? "good" : "bad",
          /* V68: ngày thiếu món vẫn được tính, nhưng phải nói rõ là đang tính thiếu. */
          missingNote = d.partial ? ` · còn ${d.foodEst.unresolvedCount} món chưa nhận diện, chưa cộng vào` : "",
          status = !d.complete
            ? `Chưa đủ dữ liệu${d.foodEst.unresolvedCount ? ` — ${d.foodEst.unresolvedCount} món chưa nhận diện` : ""}`
            : d.deficit > 0
              ? `✓ Đạt — thâm hụt calo${missingNote}`
              : d.deficit < 0
                ? `✕ Chưa đạt — dư thừa calo${missingNote}`
                : `✕ Chưa đạt — chưa tạo thâm hụt${missingNote}`,
          balance = !d.complete
            ? "Chưa tính"
            : d.deficit > 0
              ? `Thâm hụt ${fmt(d.deficit)} kcal`
              : d.deficit < 0
                ? `Dư thừa ${fmt(Math.abs(d.deficit))} kcal`
                : "Cân bằng 0 kcal",
          intake = d.complete && !d.partial
            ? fmt(d.foodEst.total)
            : `${fmt(d.foodEst.total)} + ?`,
          breakdown = d.foodEst.items
            .map(
              (i) =>
                `<div class="breakdown-row ${i.resolved ? "" : "unresolved-row"}"><span><strong>${escapeHtml(i.label)}</strong><div class="macro-line">${i.resolved ? macroPillsHtml(i) : ""}</div><small>${escapeHtml(i.basis)}</small><br><em>${escapeHtml(i.confidenceText)} · ${escapeHtml(i.source)}</em></span><b>${i.resolved ? `${fmt(i.kcal)} kcal` : "Cần bổ sung"}</b></div>`,
            )
            .join(""),
          detailsOpen = historyDetailsState.has(dayKey)
            ? historyDetailsState.get(dayKey)
            : d.foodEst.unresolvedCount > 0;
        return `<article id="day-${dayKey}" class="day-card ${state} ${daySpecialClass}"><div class="day-head"><div class="day-date"><strong>${formatDateVi(d.date)}</strong><span>${d.foodEst.items.length} nhóm thực phẩm${d.foodEst.unresolvedCount ? ` · ${d.foodEst.unresolvedCount} chưa nhận diện` : ""}</span></div><div class="flow"><div class="flow-box"><span>Calo vào</span><b class="orange">${intake}</b></div><span class="flow-arrow">→</span><div class="flow-box"><span>Tổng calo ra</span><b class="blue">${fmt(d.totalOut)}</b></div><span class="flow-arrow">→</span><div class="flow-box"><span>Kết quả năng lượng</span><b class="${d.complete ? (d.deficit > 0 ? "green" : d.deficit < 0 ? "red" : "blue") : "orange"}">${balance}</b></div></div><div class="day-summary-row"><span class="status-badge ${state}${d.partial ? " partial" : ""}">${status}</span><span class="daily-macro-wrap" title="Tổng Protein, Carb và Fat ước tính trong ngày">${macroPillsHtml({ protein: d.foodEst.proteinTotal, carbs: d.foodEst.carbsTotal, fat: d.foodEst.fatTotal })}</span></div></div><div class="day-body"><div class="food-box"><p>${escapeHtml(formatFoodText(d.food || "Chưa nhập đồ ăn"))}</p><details data-day-key="${dayKey}"${detailsOpen ? " open" : ""}><summary>Xem từng món và cách tính</summary><div class="breakdown">${breakdown || '<div style="color:var(--muted);font-size:10px">Chưa có dữ liệu món ăn.</div>'}</div></details></div><div class="metric-box"><div class="metric-grid"><div class="mini-metric key-metric base-tdee"><span>TDEE nền</span><b>${fmt(d.baseTdee)} kcal</b></div><div class="mini-metric total-out key-metric"><span>Tổng calo ra</span><b>${fmt(d.totalOut)} kcal</b><em>TDEE nền ${fmt(d.baseTdee)} + calo tập ${fmt(d.exerciseBurn)}</em></div><div class="mini-metric workout-metric strength-metric"><span>Tập tạ</span><b>${fmt(d.strengthMin)} phút · tiêu hao ${fmt(d.strengthBurn)} kcal</b></div><div class="mini-metric workout-metric cardio-metric"><span>Cardio 15% · 3,3 km/h</span><b>${fmt(d.cardioMin)} phút · tiêu hao ${fmt(d.cardioBurn)} kcal</b></div><div class="mini-metric body-metric weight-metric"><span>Cân hiện tại</span><b>${fmt(d.projectedWeight, 2)} kg</b></div><div class="mini-metric body-metric bodyfat-metric"><span>Vòng eo · Mỡ</span><b>${d.waistUsed !== null ? `${fmt(d.waistUsed, 1)} cm · ` : ""}${fmt(d.bodyFat, 1)}%</b></div></div></div></div></article>`;
      })
      .join("");
    list.querySelectorAll("details[data-day-key]").forEach((details) => {
      details.addEventListener("toggle", () => {
        historyDetailsState.set(details.dataset.dayKey, details.open);
      });
    });
  }
  function setupCanvas(canvas) {
    const ratio = window.devicePixelRatio || 1,
      rect = canvas.getBoundingClientRect(),
      width = Math.max(300, rect.width || 600),
      height = 270;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width, height };
  }
  function drawLineChart(id, labels, series, opts = {}) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const { ctx, width, height } = setupCanvas(canvas);
    ctx.clearRect(0, 0, width, height);
    const pad = { l: 54, r: 18, t: 18, b: 42 },
      plotW = width - pad.l - pad.r,
      plotH = height - pad.t - pad.b,
      values = series.flatMap((s) => s.values.filter(Number.isFinite));
    if (!values.length) {
      ctx.fillStyle =
        document.documentElement.dataset.theme === "dark"
          ? "#c2d0df"
          : "#526b75";
      ctx.font = "13px system-ui";
      ctx.fillText("Chưa đủ dữ liệu", pad.l, height / 2);
      return;
    }
    let min = opts.minZero ? Math.min(0, ...values) : Math.min(...values),
      max = Math.max(...values);
    if (Number.isFinite(opts.fixedMin)) min = Math.min(min, opts.fixedMin);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const margin = (max - min) * 0.12;
    min -= margin;
    max += margin;
    if (opts.minZero && min > 0) min = 0;
    const x = (i) =>
        labels.length <= 1
          ? pad.l + plotW / 2
          : pad.l + (i * plotW) / (labels.length - 1),
      y = (v) => pad.t + ((max - v) / (max - min)) * plotH;
    const darkTheme = document.documentElement.dataset.theme === "dark";
    ctx.strokeStyle = darkTheme
      ? "rgba(168,196,225,.18)"
      : "rgba(45,93,103,.14)";
    ctx.fillStyle = darkTheme ? "#c2d0df" : "#526b75";
    ctx.font = "10px system-ui";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const yy = pad.t + (i * plotH) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(width - pad.r, yy);
      ctx.stroke();
      ctx.fillText(
        fmt(max - (i * (max - min)) / 4, opts.decimals || 0),
        pad.l - 8,
        yy,
      );
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const step = Math.max(1, Math.ceil(labels.length / 6));
    labels.forEach((lab, i) => {
      if (i % step === 0 || i === labels.length - 1)
        ctx.fillText(lab, x(i), height - pad.b + 12);
    });
    series.forEach((s) => {
      ctx.beginPath();
      let started = false;
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v)) return;
        const xx = x(i),
          yy = y(v);
        if (!started) {
          ctx.moveTo(xx, yy);
          started = true;
        } else ctx.lineTo(xx, yy);
      });
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width || 2.6;
      ctx.setLineDash(s.dash || []);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.setLineDash([]);
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v) || s.point === 0) return;
        ctx.beginPath();
        ctx.arc(x(i), y(v), s.point || 3.2, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.strokeStyle = darkTheme ? "#102037" : "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });
    });
  }
  function renderCharts(days) {
    const multiYear = new Set(days.map((d) => d.date.getFullYear())).size > 1,
      labels = days.map((d) =>
        multiYear
          ? formatDateVi(d.date)
          : `${String(d.date.getDate()).padStart(2, "0")}/${String(d.date.getMonth() + 1).padStart(2, "0")}`,
      );
    drawLineChart(
      "calorieChart",
      labels,
      [
        {
          values: days.map((d) => d.foodEst.total - d.exerciseBurn),
          color: "#ff6b6b",
          width: 3,
        },
      ],
      {},
    );
    drawLineChart(
      "weightChart",
      labels,
      [
        {
          values: days.map((d) => d.projectedWeight),
          color: "#20c997",
          width: 3,
        },
        {
          values: days.map((d) => d.measuredWeight),
          color: "#4263eb",
          width: 2,
          point: 4,
        },
      ],
      { decimals: 1 },
    );
    drawLineChart(
      "waistChart",
      labels,
      [{ values: days.map((d) => d.waistUsed), color: "#15aabf", width: 3 }],
      { decimals: 1 },
    );
    drawLineChart(
      "bodyFatChart",
      labels,
      [
        { values: days.map((d) => d.bodyFat), color: "#845ef7", width: 3 },
        {
          values: days.map(() => PROFILE.targetBodyFat),
          color: "#ff4d6d",
          width: 2,
          dash: [7, 6],
          point: 0,
        },
      ],
      { decimals: 1, fixedMin: PROFILE.targetBodyFat },
    );
  }
  function showBanner(message) {
    const el = document.getElementById("dataBanner");
    el.textContent = message;
    el.className = "banner show";
  }
  function hideBanner() {
    document.getElementById("dataBanner").className = "banner";
  }
  function setSync(state, text) {
    setText("syncText", text);
    document.getElementById("syncDot").className =
      `status-dot ${state === "ok" ? "ok" : state === "error" ? "err" : ""}`;
  }
  function gvizToRows(response) {
    if (!response || response.status !== "ok" || !response.table)
      throw new Error("Google Sheet không trả dữ liệu hợp lệ.");
    const COL = { date: 0, food: 1, strength: 2, cardio: 3, weight: 4, waist: 5 };
    const rawCell = (row, n) => row?.c?.[n] ?? null;
    const valueCell = (row, n) => {
      const c = rawCell(row, n);
      if (!c) return "";
      const value = c.f ?? c.v ?? "";
      return value === null || value === undefined ? "" : value;
    };
    const dateCell = (row) => {
      const c = rawCell(row, COL.date);
      if (!c) return null;
      let d = parseDate(c.v);
      if (!d) d = parseDate(c.f, "MDY") || parseDate(c.f, "DMY");
      return d ? dateKey(d) : null;
    };
    return response.table.rows
      .map((row) => ({
        date: dateCell(row),
        food: valueCell(row, COL.food),
        strength: valueCell(row, COL.strength),
        cardio: valueCell(row, COL.cardio),
        weight: valueCell(row, COL.weight),
        waist: valueCell(row, COL.waist),
      }))
      .filter((r) => r.date);
  }
  function parseCsvLine(line) {
    const out = [];
    let cell = "", quote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quote && line[i + 1] === '"') { cell += '"'; i++; }
        else quote = !quote;
      } else if (ch === "," && !quote) { out.push(cell); cell = ""; }
      else cell += ch;
    }
    out.push(cell);
    return out;
  }
  function parseCsv(text = "") {
    const rows = [];
    let row = "", quote = false;
    text = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        row += ch;
        if (quote && text[i + 1] === '"') row += text[++i];
        else quote = !quote;
      } else if ((ch === "\n" || ch === "\r") && !quote) {
        if (row.trim()) rows.push(parseCsvLine(row));
        row = "";
        if (ch === "\r" && text[i + 1] === "\n") i++;
      } else row += ch;
    }
    if (row.trim()) rows.push(parseCsvLine(row));
    return rows;
  }
  function inferSlashOrderFromCsv(rows) {
    let mdy = 0, dmy = 0;
    rows.forEach((r) => {
      const s = String(r?.[0] ?? "").trim();
      const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
      if (!m) return;
      const a = +m[1], b = +m[2];
      if (a > 12 && b <= 12) dmy += 3;
      if (b > 12 && a <= 12) mdy += 3;
    });
    return dmy > mdy ? "DMY" : "MDY";
  }
  function parseSheetDateCell(value, slashOrder = "MDY") {
    return parseDate(value, slashOrder) || parseDate(value, slashOrder === "MDY" ? "DMY" : "MDY") || parseDate(value);
  }
  function csvToRows(text) {
    const table = parseCsv(text);
    if (!table.length) return [];
    const slashOrder = inferSlashOrderFromCsv(table.slice(0, 100));
    const rows = [];
    table.forEach((r) => {
      if (!r || r.length < 2) return;
      const d = parseSheetDateCell(r[0], slashOrder);
      if (!d) return;
      rows.push({
        date: dateKey(d),
        food: (r[1] ?? "").trim(),
        strength: (r[2] ?? "").trim(),
        cardio: (r[3] ?? "").trim(),
        weight: (r[4] ?? "").trim(),
        waist: (r[5] ?? "").trim(),
      });
    });
    return rows;
  }
  async function loadCsvRows() {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}&range=A:F&headers=1&tqx=out:csv&_=${Date.now()}`;
    const res = await fetch(csvUrl, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`CSV ${res.status}`);
    const rows = csvToRows(await res.text());
    if (!rows.length) throw new Error("CSV không có dòng ngày hợp lệ.");
    return rows;
  }
  function loadGvizRows() {
    return new Promise((resolve, reject) => {
      document.getElementById("gvizLoader")?.remove();
      let done = false;
      const cb = `inAndOut_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
      window[cb] = (response) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        delete window[cb];
        try {
          const rows = gvizToRows(response);
          if (!rows.length) throw new Error("Không đọc được dòng ngày hợp lệ từ Google Sheet.");
          resolve(rows);
        } catch (e) { reject(e); }
      };
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        delete window[cb];
        reject(new Error("Hết thời gian kết nối Google Sheet."));
      }, 15000);
      const script = document.createElement("script");
      script.id = "gvizLoader";
      script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}&range=A:F&headers=1&tqx=${encodeURIComponent(`out:json;responseHandler:${cb}`)}&_=${Date.now()}`;
      script.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        delete window[cb];
        reject(new Error("Không tải được Google Sheet. Kiểm tra quyền xem bằng liên kết."));
      };
      document.head.appendChild(script);
    });
  }
  function readSheetCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!cached || cached.version !== 1 || !Array.isArray(cached.rows) || !cached.rows.length) return null;
      const rows = cached.rows.filter((row) => row && typeof row.date === "string");
      if (!rows.length) return null;
      return { rows, savedAt: cached.savedAt || null };
    } catch (_) {
      return null;
    }
  }
  function writeOverviewSnapshot() {
    try {
      const ids = [
        "latestDate", "latestStatus",
        "targetBurnKcal", "targetBurnSub", "targetBurnWeight", "targetBurnFatKg",
        "targetBurnWalkTime", "targetBurnWalkSub", "targetBurnRate",
        "kpiWeight", "kpiBodyFat", "kpiWaist", "kpiTdee", "progressPercent",
        "calorieJarValue", "calorieJarSub"
      ];
      const text = {};
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) text[id] = el.textContent;
      });
      const fill = document.getElementById("fatProgressFill");
      const marker = document.getElementById("fatProgressMarker");
      const track = document.getElementById("fatProgressTrack");
      const targetDates = document.getElementById("targetDates");
      localStorage.setItem(
        OVERVIEW_SNAPSHOT_KEY,
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          text,
          targetDatesHtml: targetDates?.innerHTML || "",
          progressWidth: fill?.style.width || "0%",
          markerLeft: marker?.style.left || "0%",
          progressSurplus: !!track?.classList.contains("surplus")
        })
      );
    } catch (_) {}
  }

  function hydrateOverviewSnapshot() {
    try {
      const snap = JSON.parse(localStorage.getItem(OVERVIEW_SNAPSHOT_KEY) || "null");
      if (!snap || snap.version !== 1 || !snap.text) return false;
      Object.entries(snap.text).forEach(([id, value]) => setText(id, value));
      const targetDates = document.getElementById("targetDates");
      if (targetDates && snap.targetDatesHtml) targetDates.innerHTML = snap.targetDatesHtml;
      const fill = document.getElementById("fatProgressFill");
      const marker = document.getElementById("fatProgressMarker");
      const track = document.getElementById("fatProgressTrack");
      if (fill) fill.style.width = snap.progressWidth || "0%";
      if (marker) marker.style.left = snap.markerLeft || "0%";
      if (track) track.classList.toggle("surplus", !!snap.progressSurplus);
      return true;
    } catch (_) {
      return false;
    }
  }

  function writeSheetCache(rows) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ version: 1, savedAt: new Date().toISOString(), rows }),
      );
    } catch (_) {}
  }
  function hydrateSheetCache() {
    const cached = readSheetCache();
    if (!cached) return false;
    rawRows = cached.rows;
    setSync("loading", "Đang cập nhật · hiển thị dữ liệu lần trước");
    return true;
  }
  async function loadSheet() {
    setSync("loading", rawRows.length ? "Đang cập nhật · giữ dữ liệu hiện tại" : "Đang cập nhật Sheet…");
    hideBanner();
    try {
      return await loadCsvRows();
    } catch (csvErr) {
      return await loadGvizRows();
    }
  }
  let refreshBusy = false;
  async function prepareFoodRowsV66(rows){
    let sliceStart=performance.now();
    for(const text of new Set(rows.map(row=>String(row.food??"")))){
      estimateFood(text);
      if(performance.now()-sliceStart>8){
        await new Promise(resolve=>setTimeout(resolve,0));
        sliceStart=performance.now();
      }
    }
  }
  async function refreshData() {
    if (refreshBusy) return;
    refreshBusy = true;
    const refreshButtons = ["refreshBtn", "stickyRefreshBtn"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    refreshButtons.forEach((button) => {
      button.disabled = true;
      button.classList.add("is-loading");
    });
    try {
      const rows = await loadSheet();
      await prepareFoodRowsV66(rows);
      rawRows = rows;
      writeSheetCache(rows);
      setSync("ok", "Sheet đã đồng bộ");
      setText(
        "lastSync",
        new Intl.DateTimeFormat("vi-VN", {
          timeZone: VI_TIME_ZONE,
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
      hideBanner();
      render();
      const runLookup = () => resolveUnknownFoods(rows);
      if ("requestIdleCallback" in window) requestIdleCallback(runLookup, { timeout: 1200 });
      else setTimeout(runLookup, 50);
    } catch (err) {
      const hasFallback = rawRows.length > 0;
      render();
      setSync(
        "error",
        hasFallback ? "Chưa cập nhật được · đang dùng dữ liệu lần trước" : "Chưa đọc được dữ liệu Sheet",
      );
      setLookupText(
        hasFallback
          ? "Dữ liệu lần trước vẫn được giữ nguyên; sẽ thử đồng bộ lại tự động"
          : "Tự động tra món tạm dừng vì chưa có dữ liệu Sheet",
      );
      showBanner(
        hasFallback
          ? `${err.message} Đang giữ nguyên dữ liệu của lần truy cập gần nhất.`
          : `${err.message} Chưa có dữ liệu đã lưu trên thiết bị này.`,
      );
      setText("lastSync", hasFallback ? "Đang dùng dữ liệu lần trước" : "Chưa đồng bộ trực tiếp");
    } finally {
      refreshBusy = false;
      refreshButtons.forEach((button) => {
        button.disabled = false;
        button.classList.remove("is-loading");
      });
    }
  }
  function showPage(name) {
    currentPage = name;
    document
      .querySelectorAll(".page")
      .forEach((p) => p.classList.toggle("active", p.id === `page-${name}`));
    document
      .querySelectorAll(".nav-btn")
      .forEach((b) => b.classList.toggle("active", b.dataset.page === name));
    history.replaceState(null, "", `#${name}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (name === "lookup") {
      setTimeout(ensureNutritionCatalogRendered, 0);
    } else if (name !== "overview") {
      setTimeout(() => renderActiveSecondaryView(name, getVietnamToday()), 0);
    }
  }
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) =>
      b.addEventListener("click", () => showPage(b.dataset.page)),
    );
  const FREQUENT_FOODS = [{"name":"Tôm bóc vỏ","icon":"🦐","category":"protein","basis":"100 g","state":"sống, phần ăn được","protein":20,"carb":0.2,"fat":0.5,"kcal":85},{"name":"Thịt cua/ghẹ","icon":"🦀","category":"protein","basis":"100 g","state":"thịt sống","protein":18,"carb":0,"fat":1.5,"kcal":87},{"name":"Thịt bề bề","icon":"🦐","category":"protein","basis":"100 g","state":"thịt sống","protein":20,"carb":0,"fat":1,"kcal":95},{"name":"Cá ngừ phi lê","icon":"🐟","category":"protein","basis":"100 g","state":"sống","protein":24,"carb":0,"fat":0.5,"kcal":109},{"name":"Ức gà phi lê không da","icon":"🍗","category":"protein","basis":"100 g","state":"sống","protein":23,"carb":0,"fat":2,"kcal":114},{"name":"Cá rô phi phi lê","icon":"🐟","category":"protein","basis":"100 g","state":"sống","protein":20,"carb":0,"fat":1.7,"kcal":96},{"name":"Cá điêu hồng","icon":"🐟","category":"protein","basis":"100 g","state":"phi lê sống","protein":20,"carb":0,"fat":1.7,"kcal":96},{"name":"Tép","icon":"🦐","category":"protein","basis":"100 g","state":"tươi, phần ăn được","protein":20,"carb":0,"fat":1,"kcal":90},{"name":"Thịt ốc bươu","icon":"🐚","category":"protein","basis":"100 g","state":"tươi, phần ăn được","protein":11.1,"carb":8.3,"fat":0.7,"kcal":84},{"name":"Thịt ốc hương","icon":"🐚","category":"protein","basis":"100 g","state":"tươi, phần ăn được","protein":17,"carb":4,"fat":1.2,"kcal":95},{"name":"Cá quả","icon":"🐟","category":"protein","basis":"100 g","state":"phi lê sống","protein":18.2,"carb":0,"fat":2.7,"kcal":97},{"name":"Cá bò khô","icon":"🐟","category":"protein","basis":"100 g","state":"khô, không tẩm đường; mức trung bình","protein":62,"carb":0,"fat":4.7,"kcal":290},{"name":"Tim bò","icon":"🥩","category":"protein","basis":"100 g","state":"sống","protein":17.7,"carb":0.1,"fat":3.9,"kcal":112},{"name":"Cá trắm","icon":"🐟","category":"protein","basis":"100 g","state":"phi lê sống","protein":18.6,"carb":0,"fat":4.5,"kcal":112},{"name":"Cá basa/tra phi lê","icon":"🐟","category":"protein","basis":"100 g","state":"sống","protein":16,"carb":0,"fat":3.5,"kcal":92},{"name":"Thịt thăn heo","icon":"🥩","category":"protein","basis":"100 g","state":"sống","protein":20,"carb":0,"fat":4.4,"kcal":120},{"name":"Dạ dày heo","icon":"🥩","category":"protein","basis":"100 g","state":"sống, làm sạch","protein":16.9,"carb":0,"fat":4.2,"kcal":105},{"name":"Mực","icon":"🦑","category":"protein","basis":"100 g","state":"sống","protein":15,"carb":3.1,"fat":1.4,"kcal":92},{"name":"Bạch tuộc","icon":"🐙","category":"protein","basis":"100 g","state":"sống","protein":14,"carb":2.2,"fat":1,"kcal":82},{"name":"Cá lăng phi lê","icon":"🐟","category":"protein","basis":"100 g","state":"sống","protein":19,"carb":0,"fat":4.1,"kcal":113},{"name":"Tim lợn","icon":"🥩","category":"protein","basis":"100 g","state":"sống","protein":17.3,"carb":0,"fat":4.4,"kcal":118},{"name":"Cá cam phi lê","icon":"🐟","category":"protein","basis":"100 g","state":"sống","protein":23,"carb":0,"fat":5.6,"kcal":146},{"name":"Thịt bò nạc","icon":"🥩","category":"protein","basis":"100 g","state":"sống","protein":20,"carb":0,"fat":6.7,"kcal":140},{"name":"Cá thu phi lê","icon":"🐟","category":"protein","basis":"100 g","state":"sống","protein":20,"carb":0,"fat":7,"kcal":142},{"name":"Gan lợn","icon":"🥩","category":"protein","basis":"100 g","state":"sống","protein":21.4,"carb":3.8,"fat":3.7,"kcal":134},{"name":"Mussels (vẹm)","icon":"🦪","category":"protein","basis":"100 g","state":"thịt sống","protein":11.9,"carb":3.7,"fat":2.2,"kcal":86},{"name":"Thịt hàu","icon":"🦪","category":"protein","basis":"100 g","state":"sống","protein":7,"carb":4.5,"fat":2.5,"kcal":68},{"name":"Thịt sò điệp","icon":"🦪","category":"protein","basis":"100 g","state":"sống","protein":12,"carb":3.2,"fat":0.5,"kcal":69},{"name":"Lòng trắng trứng","icon":"🥚","category":"protein","basis":"100 g","state":"sống","protein":10,"carb":0.7,"fat":0.2,"kcal":52},{"name":"Sữa chua Hy Lạp","icon":"🥣","category":"protein","basis":"100 g","state":"không đường, ít béo","protein":10,"carb":3.6,"fat":0.4,"kcal":59},{"name":"Phô mai Cottage ít béo","icon":"🧀","category":"protein","basis":"100 g","state":"loại ít béo","protein":12,"carb":3,"fat":1,"kcal":72},{"name":"Sữa tách béo","icon":"🥛","category":"protein","basis":"100 ml","state":"đồ uống","protein":3,"carb":5,"fat":0.1,"kcal":34},{"name":"Sữa đậu nành","icon":"🥛","category":"protein","basis":"100 ml","state":"không đường","protein":3,"carb":1.7,"fat":1.8,"kcal":33},{"name":"Đậu hũ non","icon":"⬜","category":"protein","basis":"100 g","state":"chưa chế biến","protein":6,"carb":2,"fat":3.5,"kcal":61},{"name":"Đậu phụ","icon":"⬜","category":"protein","basis":"100 g","state":"chưa chiên","protein":8,"carb":1.9,"fat":4.8,"kcal":76},{"name":"Sữa tươi","icon":"🥛","category":"protein","basis":"100 ml","state":"nguyên chất","protein":3,"carb":4.8,"fat":3.3,"kcal":61},{"name":"Ham (giăm bông)","icon":"🍖","category":"protein","basis":"100 g","state":"thành phẩm trung bình","protein":18,"carb":1.5,"fat":7,"kcal":145},{"name":"Đùi gà phi lê không da","icon":"🍗","category":"protein","basis":"100 g","state":"sống","protein":19,"carb":0,"fat":7.5,"kcal":144},{"name":"Cá chép","icon":"🐟","category":"protein","basis":"100 g","state":"phi lê sống","protein":17.8,"carb":0,"fat":5.6,"kcal":127},{"name":"Trứng cá","icon":"🟠","category":"protein","basis":"100 g","state":"sống","protein":20,"carb":1.5,"fat":8.8,"kcal":171},{"name":"Trứng gà nguyên quả","icon":"🥚","category":"protein","basis":"100 g","state":"sống","protein":12,"carb":0.7,"fat":9.5,"kcal":143},{"name":"Trứng vịt lộn","icon":"🥚","category":"protein","basis":"100 g","state":"trong vỏ, phần ăn được","protein":13,"carb":1.5,"fat":14,"kcal":182},{"name":"Nhộng tằm","icon":"🐛","category":"protein","basis":"100 g","state":"tươi","protein":14,"carb":4,"fat":6.5,"kcal":120},{"name":"Cá hồi phi lê","icon":"🐟","category":"protein","basis":"100 g","state":"sống","protein":20,"carb":0,"fat":13,"kcal":208},{"name":"Cá cơm khô","icon":"🐟","category":"protein","basis":"100 g","state":"khô","protein":43,"carb":0,"fat":4,"kcal":208},{"name":"Cá chỉ vàng khô","icon":"🐟","category":"protein","basis":"100 g","state":"khô, không tẩm đường; mức trung bình","protein":55,"carb":0,"fat":3.9,"kcal":255},{"name":"Thịt bò khô","icon":"🥩","category":"protein","basis":"100 g","state":"thành phẩm trung bình","protein":40,"carb":10,"fat":10,"kcal":290},{"name":"Gà khô","icon":"🍗","category":"protein","basis":"100 g","state":"thành phẩm trung bình","protein":55,"carb":10,"fat":8,"kcal":330},{"name":"Chà bông","icon":"🍖","category":"protein","basis":"100 g","state":"thành phẩm trung bình","protein":40,"carb":20,"fat":18,"kcal":400},{"name":"Đậu nành","icon":"🫘","category":"protein","basis":"100 g","state":"đã nấu chín","protein":18.2,"carb":8.4,"fat":8.9,"kcal":172},{"name":"Bí đỏ","icon":"🎃","category":"carb","basis":"100 g","state":"sống","protein":1,"carb":6.5,"fat":0.1,"kcal":26},{"name":"Cà chua","icon":"🍅","category":"carb","basis":"100 g","state":"sống","protein":0.9,"carb":3.9,"fat":0.2,"kcal":18},{"name":"Dưa chuột","icon":"🥒","category":"carb","basis":"100 g","state":"sống","protein":0.7,"carb":3.6,"fat":0.1,"kcal":15},{"name":"Nấm hương","icon":"🍄","category":"carb","basis":"100 g","state":"tươi","protein":2.2,"carb":6.8,"fat":0.5,"kcal":34},{"name":"Nấm đùi gà","icon":"🍄","category":"carb","basis":"100 g","state":"tươi","protein":3.3,"carb":6.1,"fat":0.4,"kcal":35},{"name":"Cà tím","icon":"🍆","category":"carb","basis":"100 g","state":"sống","protein":1,"carb":5.9,"fat":0.2,"kcal":25},{"name":"Cà rốt","icon":"🥕","category":"carb","basis":"100 g","state":"sống","protein":0.9,"carb":9.6,"fat":0.2,"kcal":41},{"name":"Nước dừa","icon":"🥥","category":"carb","basis":"100 ml","state":"đồ uống nguyên chất","protein":0.7,"carb":3.7,"fat":0.2,"kcal":19},{"name":"Bia","icon":"🍺","category":"carb","basis":"100 ml","state":"đồ uống","protein":0.5,"carb":3.6,"fat":0,"kcal":43},{"name":"Nước mía","icon":"🥤","category":"carb","basis":"100 ml","state":"đồ uống nguyên chất","protein":0,"carb":18,"fat":0,"kcal":74},{"name":"Khoai tây","icon":"🥔","category":"carb","basis":"100 g","state":"sống","protein":2,"carb":17,"fat":0.1,"kcal":77},{"name":"Khoai lang","icon":"🍠","category":"carb","basis":"100 g","state":"sống","protein":1.6,"carb":20.1,"fat":0.1,"kcal":86},{"name":"Đậu xanh","icon":"🫘","category":"carb","basis":"100 g","state":"đã nấu chín","protein":7,"carb":19.2,"fat":0.4,"kcal":105},{"name":"Lentils (đậu lăng)","icon":"🫘","category":"carb","basis":"100 g","state":"đã nấu chín","protein":9,"carb":20.1,"fat":0.4,"kcal":116},{"name":"Đậu đỏ","icon":"🫘","category":"carb","basis":"100 g","state":"đã nấu chín","protein":8.7,"carb":22.8,"fat":0.5,"kcal":127},{"name":"Đậu đen","icon":"🫘","category":"carb","basis":"100 g","state":"đã nấu chín","protein":8.9,"carb":23.7,"fat":0.5,"kcal":132},{"name":"Soba","icon":"🍜","category":"carb","basis":"100 g","state":"đã luộc","protein":5,"carb":21.4,"fat":0.1,"kcal":99},{"name":"Udon","icon":"🍜","category":"carb","basis":"100 g","state":"đã luộc","protein":2.6,"carb":21.6,"fat":0.5,"kcal":105},{"name":"Miến","icon":"🍜","category":"carb","basis":"100 g","state":"đã luộc","protein":0.2,"carb":22.8,"fat":0.1,"kcal":96},{"name":"Cơm gạo lứt","icon":"🍚","category":"carb","basis":"100 g","state":"đã nấu chín","protein":2.6,"carb":23,"fat":0.9,"kcal":112},{"name":"Bún","icon":"🍜","category":"carb","basis":"100 g","state":"tươi, đã chín","protein":1.8,"carb":25.7,"fat":0.2,"kcal":110},{"name":"Phở","icon":"🍜","category":"carb","basis":"100 g","state":"bánh phở tươi","protein":3,"carb":25,"fat":0.4,"kcal":110},{"name":"Bánh đa trắng","icon":"🍜","category":"carb","basis":"100 g","state":"đã luộc","protein":2,"carb":25,"fat":0.2,"kcal":110},{"name":"Bánh canh","icon":"🍜","category":"carb","basis":"100 g","state":"đã chín","protein":1.5,"carb":25,"fat":0.2,"kcal":110},{"name":"Bánh đa đỏ","icon":"🍜","category":"carb","basis":"100 g","state":"đã luộc","protein":2,"carb":26,"fat":0.3,"kcal":115},{"name":"Mì","icon":"🍜","category":"carb","basis":"100 g","state":"sợi mì đã luộc","protein":4.5,"carb":25,"fat":1.5,"kcal":138},{"name":"Cơm trắng","icon":"🍚","category":"carb","basis":"100 g","state":"đã nấu chín","protein":2.7,"carb":28.2,"fat":0.3,"kcal":130},{"name":"Khoai môn","icon":"🍠","category":"carb","basis":"100 g","state":"sống","protein":1.5,"carb":26.5,"fat":0.2,"kcal":112},{"name":"Hạt dẻ","icon":"🌰","category":"carb","basis":"100 g","state":"hạt sống","protein":2.4,"carb":45.5,"fat":2.3,"kcal":213},{"name":"Tteokbokki","icon":"🍡","category":"carb","basis":"100 g","state":"bánh gạo chín, chưa sốt","protein":3.5,"carb":50,"fat":0.5,"kcal":220},{"name":"Sắn dẻo","icon":"🍠","category":"carb","basis":"100 g","state":"đã nấu chín","protein":1.4,"carb":38.1,"fat":0.3,"kcal":160},{"name":"Yến mạch","icon":"🥣","category":"carb","basis":"100 g","state":"khô","protein":16.9,"carb":66.3,"fat":6.9,"kcal":389},{"name":"Nấm hương sấy lạnh","icon":"🍄","category":"carb","basis":"100 g","state":"khô","protein":9.6,"carb":75.4,"fat":1,"kcal":296},{"name":"Butter (bơ động vật)","icon":"🧈","category":"fat","basis":"100 g","state":"nguyên chất","protein":0.9,"carb":0.1,"fat":81.1,"kcal":717,"group":"spread"},{"name":"Sữa kem","icon":"🥛","category":"fat","basis":"100 ml","state":"heavy cream","protein":2,"carb":2.8,"fat":36,"kcal":340},{"name":"Hạt mắc ca","icon":"🌰","category":"fat","basis":"100 g","state":"hạt sống","protein":7.9,"carb":13.8,"fat":75.8,"kcal":718},{"name":"Hạt óc chó","icon":"🌰","category":"fat","basis":"100 g","state":"hạt sống","protein":15.2,"carb":13.7,"fat":65.2,"kcal":654},{"name":"Hạt flax (hạt lanh)","icon":"🌾","category":"fat","basis":"100 g","state":"hạt khô","protein":18.3,"carb":28.9,"fat":42.2,"kcal":534},{"name":"Hạt chia","icon":"🌱","category":"fat","basis":"100 g","state":"hạt khô","protein":16.5,"carb":42.1,"fat":30.7,"kcal":486},{"name":"Hạt hướng dương","icon":"🌻","category":"fat","basis":"100 g","state":"nhân hạt","protein":20.8,"carb":20,"fat":51.5,"kcal":584},{"name":"Lạc","icon":"🥜","category":"fat","basis":"100 g","state":"hạt sống","protein":25.8,"carb":16.1,"fat":49.2,"kcal":567},{"name":"Almond (hạnh nhân)","icon":"🌰","category":"fat","basis":"100 g","state":"hạt sống","protein":21.2,"carb":21.6,"fat":49.9,"kcal":579},{"name":"Hạt bí","icon":"🎃","category":"fat","basis":"100 g","state":"nhân hạt","protein":30.2,"carb":10.7,"fat":49.1,"kcal":559},{"name":"Hạt dẻ cười","icon":"🌰","category":"fat","basis":"100 g","state":"nhân hạt","protein":20.2,"carb":27.2,"fat":45.3,"kcal":562},{"name":"Cashew (hạt điều)","icon":"🌰","category":"fat","basis":"100 g","state":"hạt sống","protein":18.2,"carb":30.2,"fat":43.8,"kcal":553},{"name":"Bacon","icon":"🥓","category":"fat","basis":"100 g","state":"thành phẩm","protein":37,"carb":1.4,"fat":42,"kcal":541},{"name":"Pate gan","icon":"🍖","category":"fat","basis":"100 g","state":"thành phẩm trung bình","protein":12,"carb":4,"fat":28,"kcal":319},{"name":"Phô mai Cheddar","icon":"🧀","category":"fat","basis":"100 g","state":"thành phẩm","protein":22,"carb":1.3,"fat":33,"kcal":403},{"name":"Phô mai Mozzarella","icon":"🧀","category":"fat","basis":"100 g","state":"thành phẩm","protein":18,"carb":3,"fat":19,"kcal":254},{"name":"Phô mai Parmesan bào","icon":"🧀","category":"fat","basis":"100 g","state":"thành phẩm","protein":35,"carb":3.2,"fat":28,"kcal":392},{"name":"Thịt vịt có da","icon":"🍗","category":"fat","basis":"100 g","state":"sống","protein":17,"carb":0,"fat":22,"kcal":267},{"name":"Thịt ngan có da","icon":"🍗","category":"fat","basis":"100 g","state":"sống","protein":17,"carb":0,"fat":17,"kcal":225},{"name":"Cánh gà có da","icon":"🍗","category":"fat","basis":"100 g","state":"sống","protein":17,"carb":0,"fat":15,"kcal":203},{"name":"Lòng heo","icon":"🥩","category":"fat","basis":"100 g","state":"sống, làm sạch","protein":14,"carb":0,"fat":15,"kcal":190},{"name":"Bì heo","icon":"🥩","category":"fat","basis":"100 g","state":"đã luộc","protein":26,"carb":0,"fat":15,"kcal":240},{"name":"Dưa hấu","icon":"🍉","category":"fruit","basis":"100 g","state":"phần ăn được","protein":0.6,"carb":7.6,"fat":0.2,"kcal":30},{"name":"Dâu","icon":"🍓","category":"fruit","basis":"100 g","state":"tươi","protein":0.7,"carb":7.7,"fat":0.3,"kcal":32},{"name":"Melon (dưa lưới)","icon":"🍈","category":"fruit","basis":"100 g","state":"phần ăn được","protein":0.8,"carb":8.2,"fat":0.2,"kcal":34},{"name":"Đào","icon":"🍑","category":"fruit","basis":"100 g","state":"tươi","protein":0.9,"carb":9.5,"fat":0.3,"kcal":39},{"name":"Cam quýt","icon":"🍊","category":"fruit","basis":"100 g","state":"phần ăn được","protein":0.9,"carb":11.8,"fat":0.1,"kcal":47},{"name":"Dứa","icon":"🍍","category":"fruit","basis":"100 g","state":"phần ăn được","protein":0.5,"carb":13.1,"fat":0.1,"kcal":50},{"name":"Táo","icon":"🍎","category":"fruit","basis":"100 g","state":"tươi, cả vỏ","protein":0.3,"carb":13.8,"fat":0.2,"kcal":52},{"name":"Thanh long","icon":"🐉","category":"fruit","basis":"100 g","state":"phần ăn được","protein":1.2,"carb":13,"fat":0.1,"kcal":57},{"name":"Lê","icon":"🍐","category":"fruit","basis":"100 g","state":"tươi","protein":0.4,"carb":15.2,"fat":0.1,"kcal":57},{"name":"Xoài","icon":"🥭","category":"fruit","basis":"100 g","state":"chín","protein":0.8,"carb":15,"fat":0.4,"kcal":60},{"name":"Kiwi","icon":"🥝","category":"fruit","basis":"100 g","state":"tươi","protein":1.1,"carb":14.7,"fat":0.5,"kcal":61},{"name":"Cherry","icon":"🍒","category":"fruit","basis":"100 g","state":"tươi","protein":1.1,"carb":16,"fat":0.2,"kcal":63},{"name":"Vải","icon":"🔴","category":"fruit","basis":"100 g","state":"phần ăn được","protein":0.8,"carb":16.5,"fat":0.4,"kcal":66},{"name":"Nho","icon":"🍇","category":"fruit","basis":"100 g","state":"tươi","protein":0.7,"carb":18.1,"fat":0.2,"kcal":69},{"name":"Chôm chôm","icon":"🔴","category":"fruit","basis":"100 g","state":"phần ăn được","protein":0.7,"carb":20.9,"fat":0.2,"kcal":82},{"name":"Chuối","icon":"🍌","category":"fruit","basis":"100 g","state":"phần ăn được","protein":1.1,"carb":22.8,"fat":0.3,"kcal":89},{"name":"Mít","icon":"🍈","category":"fruit","basis":"100 g","state":"phần ăn được","protein":1.7,"carb":23.2,"fat":0.6,"kcal":95},{"name":"Na","icon":"🍈","category":"fruit","basis":"100 g","state":"phần ăn được","protein":2.1,"carb":23.6,"fat":0.6,"kcal":101},{"name":"Quả bơ","icon":"🥑","category":"fruit","basis":"100 g","state":"phần ăn được","protein":2,"carb":8.5,"fat":14.7,"kcal":160},{"name":"Sầu riêng","icon":"🍈","category":"fruit","basis":"100 g","state":"phần ăn được, tươi","protein":1.5,"carb":27.1,"fat":5.3,"kcal":147},{"name":"Chuối sấy","icon":"🍌","category":"fat","basis":"100 g","state":"thành phẩm sấy/chiên giòn trung bình","protein":2.3,"carb":58.4,"fat":33.6,"kcal":519},{"name":"Mít sấy","icon":"🍈","category":"carb","basis":"100 g","state":"thành phẩm sấy giòn trung bình","protein":4,"carb":64,"fat":14,"kcal":414},{"name":"Khoai môn sấy","icon":"🍠","category":"carb","basis":"100 g","state":"thành phẩm sấy giòn trung bình","protein":2.3,"carb":68.1,"fat":24.9,"kcal":498},{"name":"Bông cải xanh","icon":"🥦","category":"carb","group":"vegetable","basis":"100 g","state":"sống","protein":2.8,"carb":6.6,"fat":0.4,"kcal":34},{"name":"Bông cải trắng","icon":"🥦","category":"carb","group":"vegetable","basis":"100 g","state":"sống","protein":1.9,"carb":5.0,"fat":0.3,"kcal":25},{"name":"Bắp cải","icon":"🥬","category":"carb","group":"vegetable","basis":"100 g","state":"sống","protein":1.3,"carb":5.8,"fat":0.1,"kcal":25},{"name":"Ngô","icon":"🌽","category":"carb","group":"grain","basis":"100 g","state":"ngô ngọt đã luộc","protein":3.4,"carb":21.0,"fat":1.5,"kcal":96},{"name":"Thịt chim","icon":"🐦","category":"protein","group":"poultry","basis":"100 g","state":"thịt nạc bồ câu/cút, sống; mức trung bình","protein":22.0,"carb":0.0,"fat":5.5,"kcal":138},{"name":"Bánh croissant","icon":"🥐","category":"carb","group":"pastry","basis":"100 g","state":"croissant bơ; thành phẩm trung bình","protein":8.2,"carb":45.8,"fat":21.0,"kcal":406},{"name":"Bánh Mexican coffee bun","icon":"🍞","category":"carb","group":"pastry","basis":"100 g","state":"bánh mì phủ cà phê và bơ; thành phẩm trung bình","protein":7.0,"carb":54.0,"fat":14.0,"kcal":367},{"name":"Bánh cinnamon swirl","icon":"🌀","category":"carb","group":"pastry","basis":"100 g","state":"bánh cuộn quế; thành phẩm trung bình","protein":6.5,"carb":53.0,"fat":15.0,"kcal":372},{"name":"Bánh mochi","icon":"🍡","category":"carb","group":"pastry","basis":"100 g","state":"mochi nhân ngọt; thành phẩm trung bình","protein":3.0,"carb":52.0,"fat":1.0,"kcal":235},{"name":"Bánh bông lan","icon":"🍰","category":"carb","group":"pastry","basis":"100 g","state":"không kem; thành phẩm trung bình","protein":6.0,"carb":54.0,"fat":7.0,"kcal":297},{"name":"Bánh Katka Hải Phòng","icon":"🍰","category":"carb","group":"pastry","basis":"100 g","state":"bánh bông lan bơ kiểu pound cake; mức trung bình","protein":5.5,"carb":53.6,"fat":18.3,"kcal":389},{"name":"Donut","icon":"🍩","category":"carb","group":"pastry","basis":"100 g","state":"donut chiên phủ đường; thành phẩm trung bình","protein":4.9,"carb":51.0,"fat":25.0,"kcal":452},{"name":"Apple pie","icon":"🥧","category":"carb","group":"pastry","basis":"100 g","state":"bánh táo; thành phẩm trung bình","protein":1.9,"carb":34.0,"fat":11.0,"kcal":237},{"name":"Cookies","icon":"🍪","category":"carb","group":"pastry","basis":"100 g","state":"bánh quy bơ; thành phẩm trung bình","protein":5.5,"carb":64.0,"fat":24.0,"kcal":488},{"name":"Muffin","icon":"🧁","category":"carb","group":"pastry","basis":"100 g","state":"muffin ngọt; thành phẩm trung bình","protein":6.0,"carb":56.0,"fat":15.0,"kcal":377},{"name":"Bánh flan caramen","icon":"🍮","category":"carb","group":"dessert","basis":"100 g","state":"thành phẩm trung bình","protein":4.5,"carb":23.0,"fat":4.0,"kcal":145},{"name":"Crème brûlée","icon":"🍮","category":"carb","group":"dessert","basis":"100 g","state":"thành phẩm trung bình","protein":4.5,"carb":30.0,"fat":22.0,"kcal":336},{"name":"Cheese cake","icon":"🍰","category":"carb","group":"dessert","basis":"100 g","state":"thành phẩm trung bình","protein":5.5,"carb":25.5,"fat":22.5,"kcal":321},{"name":"Kem","icon":"🍨","category":"carb","group":"dessert","basis":"100 g","state":"kem sữa vani; thành phẩm trung bình","protein":3.5,"carb":24.0,"fat":11.0,"kcal":207},{"name":"Hash brown","icon":"🥔","category":"carb","group":"side","basis":"100 g","state":"khoai tây bào chiên; thành phẩm trung bình","protein":3.5,"carb":35.0,"fat":20.0,"kcal":326},{"name":"Khoai tây chiên","icon":"🍟","category":"carb","group":"side","basis":"100 g","state":"chiên dầu; thành phẩm trung bình","protein":3.4,"carb":41.0,"fat":15.0,"kcal":312},{"name":"Khoai lang chiên","icon":"🍠","category":"carb","group":"side","basis":"100 g","state":"chiên dầu; thành phẩm trung bình","protein":2.5,"carb":35.0,"fat":12.0,"kcal":259},{"name":"Khoai tây với gravy","icon":"🥔","category":"carb","group":"side","basis":"100 g","state":"khoai tây nghiền kèm sốt gravy; mức trung bình","protein":2.4,"carb":17.0,"fat":4.5,"kcal":120},{"name":"Coleslaw","icon":"🥗","category":"carb","group":"side","basis":"100 g","state":"bắp cải trộn sốt mayonnaise; mức trung bình","protein":1.0,"carb":14.0,"fat":10.0,"kcal":152},{"name":"Chè khúc bạch","icon":"🥣","category":"carb","group":"sweet_soup","basis":"100 g","state":"món hoàn chỉnh; công thức trung bình","protein":4.0,"carb":25.0,"fat":8.0,"kcal":180},{"name":"Chè đỗ đen","icon":"🥣","category":"carb","group":"sweet_soup","basis":"100 g","state":"món hoàn chỉnh; công thức trung bình","protein":4.0,"carb":26.0,"fat":1.0,"kcal":130},{"name":"Chè bà cốt","icon":"🥣","category":"carb","group":"sweet_soup","basis":"100 g","state":"nếp, mật/đường; công thức trung bình","protein":3.0,"carb":45.0,"fat":2.0,"kcal":210},{"name":"Chè sắn","icon":"🥣","category":"carb","group":"sweet_soup","basis":"100 g","state":"món hoàn chỉnh; công thức trung bình","protein":1.0,"carb":36.0,"fat":2.0,"kcal":160},{"name":"Chè bưởi","icon":"🥣","category":"carb","group":"sweet_soup","basis":"100 g","state":"món hoàn chỉnh; công thức trung bình","protein":1.5,"carb":33.0,"fat":2.0,"kcal":150},{"name":"Xôi nếp","icon":"🍚","category":"carb","group":"sticky_rice","basis":"100 g","state":"xôi trắng đã đồ chín","protein":4.0,"carb":49.0,"fat":0.5,"kcal":220},{"name":"Xôi lạc","icon":"🥜","category":"carb","group":"sticky_rice","basis":"100 g","state":"món hoàn chỉnh; công thức trung bình","protein":8.0,"carb":45.0,"fat":9.0,"kcal":285},{"name":"Xôi đỗ","icon":"🫘","category":"carb","group":"sticky_rice","basis":"100 g","state":"xôi đậu xanh; công thức trung bình","protein":7.0,"carb":45.0,"fat":3.0,"kcal":235},{"name":"Xôi ngô","icon":"🌽","category":"carb","group":"sticky_rice","basis":"100 g","state":"món hoàn chỉnh; công thức trung bình","protein":5.0,"carb":46.0,"fat":2.0,"kcal":215},{"name":"Xôi gấc","icon":"🔴","category":"carb","group":"sticky_rice","basis":"100 g","state":"món hoàn chỉnh; công thức trung bình","protein":4.0,"carb":46.0,"fat":6.0,"kcal":250},{"name":"Xôi đỗ đen","icon":"🫘","category":"carb","group":"sticky_rice","basis":"100 g","state":"món hoàn chỉnh; công thức trung bình","protein":7.0,"carb":44.0,"fat":3.0,"kcal":230},{"name":"Bánh cuốn chay","icon":"🥟","category":"carb","group":"complete_dish","basis":"1 suất","state":"suất phổ biến tại Việt Nam; gồm bánh, rau và nước chấm; ước tính","protein":8.0,"carb":65.0,"fat":6.5,"kcal":352},{"name":"Bánh cuốn nhân","icon":"🥟","category":"carb","group":"complete_dish","basis":"1 suất","state":"nhân thịt và mộc nhĩ, rau và nước chấm; suất phổ biến; ước tính","protein":18.0,"carb":64.0,"fat":17.0,"kcal":481},{"name":"Thịt viên","icon":"🧆","category":"protein","group":"processed","basis":"100 g","state":"thịt viên chín; thành phẩm trung bình","protein":15.0,"carb":8.0,"fat":18.0,"kcal":250},{"name":"Lạp xưởng","icon":"🌭","category":"protein","group":"processed","basis":"100 g","state":"thành phẩm trung bình","protein":24.0,"carb":12.0,"fat":35.0,"kcal":455},{"name":"Xúc xích Đức","icon":"🌭","category":"protein","group":"processed","basis":"100 g","state":"bratwurst; thành phẩm trung bình","protein":13.0,"carb":2.0,"fat":27.0,"kcal":301},{"name":"KFC chicken","icon":"🍗","category":"protein","group":"fast_food","basis":"100 g","state":"gà rán có lớp bột; mức trung bình","protein":24.0,"carb":8.0,"fat":14.0,"kcal":260},{"name":"Pizza phô mai","icon":"🍕","category":"protein","group":"fast_food","basis":"100 g","state":"thành phẩm trung bình","protein":11.0,"carb":33.0,"fat":10.0,"kcal":266},{"name":"Hamburger","icon":"🍔","category":"protein","group":"fast_food","basis":"100 g","state":"burger bò kèm bánh; mức trung bình","protein":17.0,"carb":24.0,"fat":14.0,"kcal":295},{"name":"Bánh mì baguette","icon":"🥖","category":"carb","group":"bread_pasta","basis":"100 g","state":"bánh mì trắng","protein":9.0,"carb":57.0,"fat":1.5,"kcal":274},{"name":"Bánh mì sandwich","icon":"🍞","category":"carb","group":"bread_pasta","basis":"100 g","state":"bánh mì lát trắng","protein":8.9,"carb":49.0,"fat":3.2,"kcal":266},{"name":"Wholewheat pasta","icon":"🍝","category":"carb","group":"bread_pasta","basis":"100 g","state":"pasta nguyên cám đã luộc","protein":6.0,"carb":30.0,"fat":1.7,"kcal":149},{"name":"Pasta","icon":"🍝","category":"carb","group":"bread_pasta","basis":"100 g","state":"pasta trắng đã luộc","protein":5.8,"carb":30.9,"fat":0.9,"kcal":158},{"name":"Vỏ tortilla","icon":"🌯","category":"carb","group":"bread_pasta","basis":"100 g","state":"tortilla bột mì","protein":8.3,"carb":52.0,"fat":8.3,"kcal":312},{"name":"Vỏ bánh tráng","icon":"⚪","category":"carb","group":"bread_pasta","basis":"100 g","state":"bánh tráng gạo khô","protein":5.8,"carb":81.0,"fat":0.5,"kcal":333},{"name":"Naan bread","icon":"🫓","category":"carb","group":"bread_pasta","basis":"100 g","state":"bánh naan; thành phẩm trung bình","protein":9.0,"carb":53.0,"fat":7.0,"kcal":310},{"name":"Đuôi bò","icon":"🐂","category":"protein","group":"meat","basis":"100 g","state":"sống, phần ăn được; mức trung bình","protein":19.0,"carb":0.0,"fat":23.0,"kcal":283},{"name":"Cháo","icon":"🥣","category":"carb","group":"grain","basis":"100 g","state":"cháo gạo trắng nấu loãng, không topping","protein":0.7,"carb":6.5,"fat":0.1,"kcal":30},{"name":"Quẩy","icon":"🥖","category":"carb","group":"side","basis":"100 g","state":"quẩy chiên; mức trung bình","protein":8.5,"carb":45.0,"fat":22.0,"kcal":412},{"name":"Tiết luộc","icon":"🩸","category":"protein","group":"meat","basis":"100 g","state":"tiết lợn luộc; mức trung bình","protein":15.0,"carb":0.5,"fat":1.5,"kcal":76},{"name":"Phở bò","icon":"🍜","category":"carb","group":"complete_dish","basis":"1 bát","state":"bát phổ biến tại Việt Nam; bánh phở, thịt bò và nước dùng; ước tính","protein":25.0,"carb":55.0,"fat":14.0,"kcal":446},{"name":"Phở gà","icon":"🍜","category":"carb","group":"complete_dish","basis":"1 bát","state":"bát phổ biến tại Việt Nam; bánh phở, thịt gà và nước dùng; ước tính","protein":28.0,"carb":52.0,"fat":11.0,"kcal":419},{"name":"Mì vằn thắn","icon":"🍜","category":"carb","group":"complete_dish","basis":"1 bát","state":"mì, sủi cảo, xá xíu, trứng và nước dùng; suất phổ biến; ước tính","protein":25.0,"carb":70.0,"fat":16.0,"kcal":524},{"name":"Bún riêu","icon":"🍜","category":"carb","group":"complete_dish","basis":"1 bát","state":"bún riêu cua cỡ vừa; suất phổ biến; ước tính","protein":22.0,"carb":55.0,"fat":16.0,"kcal":452},{"name":"Bún ngan","icon":"🍜","category":"carb","group":"complete_dish","basis":"1 bát","state":"bún, thịt ngan và nước dùng; suất phổ biến; ước tính","protein":28.0,"carb":60.0,"fat":16.0,"kcal":496},{"name":"Bún mắm","icon":"🍜","category":"carb","group":"complete_dish","basis":"1 bát","state":"bún, hải sản/thịt và nước mắm nấu; suất phổ biến; ước tính","protein":30.0,"carb":68.0,"fat":18.0,"kcal":554},{"name":"Bún bò Huế","icon":"🍜","category":"carb","group":"complete_dish","basis":"1 bát","state":"bát cỡ vừa có thịt, giò/chả và nước dùng; ước tính","protein":31.0,"carb":78.0,"fat":22.0,"kcal":637},{"name":"Bún cá","icon":"🍜","category":"carb","group":"complete_dish","basis":"1 bát","state":"bún, cá/chả cá và nước dùng; suất phổ biến; ước tính","protein":25.0,"carb":62.0,"fat":12.0,"kcal":456},{"name":"Bánh đa cua","icon":"🍜","category":"carb","group":"complete_dish","basis":"1 bát","state":"bánh đa đỏ, riêu cua, chả/thịt và nước dùng; suất phổ biến; ước tính","protein":24.0,"carb":70.0,"fat":16.0,"kcal":520},{"name":"Hủ tiếu","icon":"🍜","category":"carb","group":"complete_dish","basis":"1 bát","state":"hủ tiếu nước với thịt/tôm; suất phổ biến; ước tính","protein":24.0,"carb":67.0,"fat":13.0,"kcal":481},{"name":"Cơm tấm sườn bì trứng","icon":"🍛","category":"carb","group":"complete_dish","basis":"1 suất","state":"cơm tấm, sườn nướng, bì, trứng và nước mắm; suất phổ biến; ước tính","protein":38.0,"carb":105.0,"fat":31.0,"kcal":851},{"name":"Bánh rán ngọt","icon":"🍩","category":"carb","group":"complete_dish","basis":"1 cái","state":"khoảng 70 g; nhân đậu xanh/đường; ước tính","protein":3.0,"carb":27.0,"fat":7.0,"kcal":183},{"name":"Bánh khoai","icon":"🍠","category":"carb","group":"complete_dish","basis":"1 cái","state":"khoảng 100 g; khoai lang tẩm bột chiên; ước tính","protein":3.0,"carb":35.0,"fat":9.0,"kcal":233},{"name":"Bánh chuối","icon":"🍌","category":"carb","group":"complete_dish","basis":"1 cái","state":"khoảng 120 g; chuối tẩm bột chiên; ước tính","protein":4.0,"carb":42.0,"fat":11.0,"kcal":283},{"name":"Xôi khúc","icon":"🟢","category":"carb","group":"sticky_rice","basis":"100 g","state":"xôi nếp bọc nhân đậu xanh và thịt; thành phẩm trung bình","protein":7.0,"carb":38.0,"fat":7.0,"kcal":243},{"name":"Việt quất","icon":"🫐","category":"fruit","group":"fruit","basis":"100 g","state":"tươi","protein":0.7,"carb":14.5,"fat":0.3,"kcal":57},{"name":"Phúc bồn tử","icon":"🫐","category":"fruit","group":"fruit","basis":"100 g","state":"tươi","protein":1.2,"carb":11.9,"fat":0.7,"kcal":52},{"name":"Nhãn","icon":"🟤","category":"fruit","group":"fruit","basis":"100 g","state":"tươi, phần ăn được","protein":1.3,"carb":15.1,"fat":0.1,"kcal":60},{"name":"Mận","icon":"🟣","category":"fruit","group":"fruit","basis":"100 g","state":"mận tươi, phần ăn được","protein":0.7,"carb":11.4,"fat":0.3,"kcal":46},{"name":"Hồng giòn","icon":"🟠","category":"fruit","group":"fruit","basis":"100 g","state":"tươi, phần ăn được","protein":0.6,"carb":18.6,"fat":0.2,"kcal":70},{"name":"Mãng cầu xiêm","icon":"🍈","category":"fruit","group":"fruit","basis":"100 g","state":"tươi, phần ăn được","protein":1.0,"carb":16.8,"fat":0.3,"kcal":66},{"name":"Thịt nạc vai heo","icon":"🥩","category":"protein","group":"meat","basis":"100 g","state":"sống, phần nạc có vân mỡ; mức trung bình","protein":19.5,"carb":0.0,"fat":8.0,"kcal":155},{"name":"Thịt ba chỉ heo","icon":"🥓","category":"fat","group":"meat","basis":"100 g","state":"sống, cả nạc và mỡ","protein":9.3,"carb":0.0,"fat":53.0,"kcal":518},{"name":"Thịt ba chỉ bò","icon":"🥩","category":"fat","group":"meat","basis":"100 g","state":"sống, phần nạc mỡ xen kẽ; mức trung bình","protein":17.5,"carb":0.0,"fat":28.0,"kcal":322},{"name":"Gân bò","icon":"🐂","category":"protein","group":"meat","basis":"100 g","state":"đã luộc/chín, phần ăn được; mức trung bình","protein":35.0,"carb":0.0,"fat":0.5,"kcal":150},{"name":"Bì bò","icon":"🐂","category":"protein","group":"meat","basis":"100 g","state":"đã làm sạch và luộc; mức trung bình","protein":27.0,"carb":0.0,"fat":15.0,"kcal":243},{"name":"Giò lụa","icon":"🍖","category":"protein","group":"processed","basis":"100 g","state":"thành phẩm trung bình","protein":21.5,"carb":0.0,"fat":5.5,"kcal":136},{"name":"Giò bò","icon":"🍖","category":"protein","group":"processed","basis":"100 g","state":"thành phẩm trung bình","protein":21.0,"carb":3.0,"fat":8.0,"kcal":168},{"name":"Chả cá","icon":"🍥","category":"protein","group":"processed","basis":"100 g","state":"chả cá chín; thành phẩm trung bình","protein":16.0,"carb":7.0,"fat":8.0,"kcal":164},{"name":"Nấm kim châm","icon":"🍄","category":"carb","group":"vegetable","basis":"100 g","state":"tươi","protein":2.7,"carb":7.8,"fat":0.3,"kcal":37},{"name":"Nấm mỡ","icon":"🍄","category":"carb","group":"vegetable","basis":"100 g","state":"tươi","protein":3.1,"carb":3.3,"fat":0.3,"kcal":22},{"name":"Mộc nhĩ","icon":"🍄","category":"carb","group":"vegetable","basis":"100 g","state":"đã ngâm nở, để ráo","protein":1.7,"carb":6.8,"fat":0.1,"kcal":25},{"name":"Đường","icon":"🧂","category":"carb","group":"seasoning","basis":"100 g","state":"đường trắng tinh luyện","protein":0.0,"carb":100.0,"fat":0.0,"kcal":387},{"name":"Dầu hào","icon":"🫙","category":"carb","group":"seasoning","basis":"100 g","state":"sốt đóng chai; mức trung bình theo nhãn","protein":1.4,"carb":11.0,"fat":0.3,"kcal":51},{"name":"Mayonnaise","icon":"🥫","category":"fat","group":"spread","basis":"100 g","state":"loại thường, nguyên béo","protein":1.0,"carb":0.6,"fat":75.0,"kcal":680},{"name":"Bơ đậu phộng","icon":"🥜","category":"fat","group":"spread","basis":"100 g","state":"loại mịn, không tách béo; mức trung bình","protein":25.0,"carb":20.0,"fat":50.0,"kcal":588},{"name":"Sữa đặc","icon":"🥛","category":"carb","group":"dairy","basis":"100 g","state":"sữa đặc có đường","protein":7.9,"carb":54.4,"fat":8.7,"kcal":321},{"name":"Bơ thực vật","icon":"🧈","category":"fat","group":"spread","basis":"100 g","state":"margarine khoảng 80% chất béo","protein":0.2,"carb":0.7,"fat":80.7,"kcal":717},{"name":"Chấm chao","icon":"🥣","category":"carb","group":"seasoning","basis":"100 g","state":"sốt chao pha đường/gia vị; công thức trung bình","protein":4.0,"carb":14.0,"fat":8.0,"kcal":140},{"name":"Bún chả","icon":"🍜","category":"carb","group":"complete_dish","basis":"1 suất","state":"suất phổ biến tại Việt Nam gồm bún, thịt nướng, chả và nước chấm; ước tính","protein":32.0,"carb":75.0,"fat":20.0,"kcal":608},{"name":"Nộm bò khô","icon":"🥗","category":"carb","group":"complete_dish","basis":"1 đĩa","state":"đu đủ/cà rốt, bò khô, lạc và nước trộn; suất phổ biến; ước tính","protein":18.0,"carb":38.0,"fat":14.0,"kcal":350},{"name":"Bún đậu mắm tôm","icon":"🍱","category":"carb","group":"complete_dish","basis":"1 suất","state":"bún, đậu rán, thịt/giò/chả cốm và mắm tôm; suất phổ biến; ước tính","protein":38.0,"carb":80.0,"fat":34.0,"kcal":778},{"name":"Bún bò Nam Bộ","icon":"🍜","category":"carb","group":"complete_dish","basis":"1 bát","state":"bún trộn thịt bò, rau, lạc và nước mắm; suất phổ biến; ước tính","protein":29.6,"carb":96.9,"fat":15.2,"kcal":657},{"name":"Bánh Tôm Hồ Tây","icon":"🍤","category":"carb","group":"complete_dish","basis":"1 suất","state":"bánh tôm chiên kèm rau và nước chấm; suất phổ biến; ước tính","protein":22.0,"carb":62.0,"fat":25.0,"kcal":561},{"name":"Mực khô","icon":"🦑","category":"protein","group":"seafood","basis":"100 g","state":"mực phơi/sấy khô, chưa tẩm đường; mức trung bình","protein":60.0,"carb":3.1,"fat":4.5,"kcal":300},{"name":"Cơm rang","icon":"🍳","category":"carb","group":"complete_dish","basis":"1 đĩa","state":"cơm rang trứng/thịt và rau; suất phổ biến; ước tính","protein":20.0,"carb":95.0,"fat":22.0,"kcal":658},{"name":"Bánh bột lọc","icon":"🥟","category":"carb","group":"complete_dish","basis":"1 suất","state":"khoảng 10 chiếc nhân tôm thịt; suất phổ biến; ước tính","protein":13.0,"carb":72.0,"fat":12.0,"kcal":448},{"name":"Bánh bèo Hải Phòng","icon":"🥣","category":"carb","group":"complete_dish","basis":"1 suất","state":"bánh bèo nhân thịt/mộc nhĩ và nước chấm; suất phổ biến; ước tính","protein":20.0,"carb":70.0,"fat":10.0,"kcal":450},{"name":"Mì Quảng","icon":"🍜","category":"carb","group":"complete_dish","basis":"1 bát","state":"mì, thịt/tôm, trứng, lạc và bánh tráng; suất phổ biến; ước tính","protein":28.0,"carb":68.0,"fat":16.0,"kcal":528},{"name":"Nem chua","icon":"🍖","category":"protein","group":"processed","basis":"100 g","state":"thành phẩm lên men; mức trung bình","protein":21.0,"carb":5.0,"fat":4.0,"kcal":140},{"name":"Nem chua rán","icon":"🍢","category":"fat","group":"side","basis":"100 g","state":"nem chua tẩm bột/chiên; mức trung bình","protein":14.0,"carb":22.0,"fat":18.0,"kcal":306},{"name":"Nem thính","icon":"🍖","category":"protein","group":"processed","basis":"100 g","state":"thịt/bì trộn thính; thành phẩm trung bình","protein":17.0,"carb":18.0,"fat":14.0,"kcal":266},{"name":"Nem Phùng","icon":"🍖","category":"protein","group":"processed","basis":"100 g","state":"thịt, bì và thính; thành phẩm trung bình","protein":18.0,"carb":15.0,"fat":17.0,"kcal":285},{"name":"Nem tai","icon":"🐷","category":"protein","group":"processed","basis":"100 g","state":"tai heo trộn thính/gia vị; thành phẩm trung bình","protein":20.0,"carb":8.0,"fat":12.0,"kcal":220},{"name":"Nem rán","icon":"🥟","category":"fat","group":"side","basis":"100 g","state":"nem rán nhân thịt, miến và rau; mức trung bình","protein":12.0,"carb":25.0,"fat":18.0,"kcal":310},{"name":"Bánh mì Huỳnh Hoa","icon":"🥖","category":"carb","group":"complete_dish","basis":"1 ổ","state":"ổ đầy đủ thịt nguội, chả, pate, bơ/mayonnaise và đồ chua; ước tính","protein":36.0,"carb":95.0,"fat":47.0,"kcal":950},{"name":"Xôi cốm","icon":"🟢","category":"carb","group":"sticky_rice","basis":"100 g","state":"xôi nếp trộn cốm, thường có đường/dừa; thành phẩm trung bình","protein":5.0,"carb":49.0,"fat":7.0,"kcal":279},{"name":"Cốm","icon":"🌾","category":"carb","group":"grain","basis":"100 g","state":"cốm tươi, chưa trộn đường/dừa","protein":6.1,"carb":72.0,"fat":2.4,"kcal":334},{"name":"Bánh cốm","icon":"🟩","category":"carb","group":"pastry","basis":"100 g","state":"bánh cốm nhân đậu xanh; thành phẩm trung bình","protein":4.0,"carb":65.0,"fat":6.0,"kcal":330},{"name":"Bánh pía","icon":"🥮","category":"carb","group":"pastry","basis":"100 g","state":"nhân đậu xanh/sầu riêng, có thể có trứng muối; mức trung bình","protein":8.0,"carb":55.0,"fat":20.0,"kcal":432},{"name":"Bánh bò","icon":"🧁","category":"carb","group":"pastry","basis":"100 g","state":"bánh bò hấp/nướng; mức trung bình","protein":3.0,"carb":48.0,"fat":4.0,"kcal":240},{"name":"Bánh đúc","icon":"⬜","category":"carb","group":"bread_pasta","basis":"100 g","state":"bánh đúc gạo không nhân; mức trung bình","protein":2.0,"carb":22.0,"fat":2.0,"kcal":114},{"name":"Hạt đác","icon":"⚪","category":"fruit","group":"fruit","basis":"100 g","state":"đã sơ chế/luộc, chưa ngâm đường","protein":0.3,"carb":6.2,"fat":0.1,"kcal":27},{"name":"Hạt thốt nốt","icon":"🟡","category":"fruit","group":"fruit","basis":"100 g","state":"cùi hạt tươi, chưa ngâm đường","protein":1.0,"carb":23.0,"fat":0.2,"kcal":96},{"name":"Mật ong","icon":"🍯","category":"carb","group":"seasoning","basis":"100 g","state":"mật ong nguyên chất","protein":0.3,"carb":82.4,"fat":0.0,"kcal":304},{"name":"Mật mía","icon":"🍯","category":"carb","group":"seasoning","basis":"100 g","state":"mật mía cô đặc; mức trung bình","protein":0.0,"carb":74.7,"fat":0.1,"kcal":290}];
  const FOOD_TYPE_GROUPS = [
    {key:"meat", icon:"🥩", title:"Thịt & nội tạng", cluster:"protein", focus:"protein", macroLabel:"Đạm", macroClass:"macro-protein", hue:4},
    {key:"poultry", icon:"🍗", title:"Gia cầm", cluster:"protein", focus:"protein", macroLabel:"Đạm", macroClass:"macro-protein", hue:27},
    {key:"fish", icon:"🐟", title:"Cá", cluster:"protein", focus:"protein", macroLabel:"Đạm", macroClass:"macro-protein", hue:205},
    {key:"seafood", icon:"🦐", title:"Hải sản", cluster:"protein", focus:"protein", macroLabel:"Đạm", macroClass:"macro-protein", hue:184},
    {key:"egg", icon:"🥚", title:"Trứng", cluster:"protein", focus:"protein", macroLabel:"Đạm", macroClass:"macro-protein", hue:47},
    {key:"dairy", icon:"🥛", title:"Sữa & phô mai", cluster:"protein", focus:"protein", macroLabel:"Đạm", macroClass:"macro-protein", hue:274},
    {key:"legume", icon:"🫘", title:"Đậu & họ đậu", cluster:"protein", focus:"protein", macroLabel:"Đạm", macroClass:"macro-protein", hue:132},
    {key:"insect", icon:"🐛", title:"Côn trùng", cluster:"protein", focus:"protein", macroLabel:"Đạm", macroClass:"macro-protein", hue:78},

    {key:"grain", icon:"🍚", title:"Cơm, cháo & ngũ cốc", cluster:"carb", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:57},
    {key:"noodle", icon:"🍜", title:"Bún, phở & mì nguyên liệu", cluster:"carb", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:18},
    {key:"sticky_rice", icon:"🍚", title:"Xôi", cluster:"carb", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:52},
    {key:"bread_pasta", icon:"🥖", title:"Bánh mì, pasta & vỏ bánh", cluster:"carb", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:39},
    {key:"tuber", icon:"🍠", title:"Khoai, củ & bí", cluster:"carb", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:316},
    {key:"vegetable", icon:"🥬", title:"Rau & nấm", cluster:"carb", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:106},
    {key:"fruit", icon:"🍎", title:"Hoa quả", cluster:"carb", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:334},
    {key:"drink", icon:"🥤", title:"Đồ uống", cluster:"carb", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:194},

    {key:"nut", icon:"🌰", title:"Hạt & quả hạch", cluster:"fat", focus:"fat", macroLabel:"Fat", macroClass:"macro-fat", hue:31},

    {key:"spread", icon:"🧈", title:"Bơ, mayonnaise & đồ phết", cluster:"fat", focus:"fat", macroLabel:"Fat", macroClass:"macro-fat", hue:43},

    {key:"seasoning", icon:"🫙", title:"Đường, sốt & gia vị", cluster:"processed", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:24},
    {key:"processed", icon:"🍖", title:"Thịt, cá & đồ khô chế biến", cluster:"processed", focus:"protein", macroLabel:"Đạm", macroClass:"macro-protein", hue:344},
    {key:"complete_dish", icon:"🍲", title:"Món hoàn chỉnh · 1 suất/bát", cluster:"processed", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:226},
    {key:"snack", icon:"🍘", title:"Đồ sấy & snack", cluster:"processed", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:258},
    {key:"side", icon:"🍟", title:"Món chiên & ăn kèm", cluster:"processed", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:14},
    {key:"pastry", icon:"🥐", title:"Bánh ngọt & bánh nướng", cluster:"processed", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:322},
    {key:"dessert", icon:"🍮", title:"Kem & tráng miệng", cluster:"processed", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:286},
    {key:"sweet_soup", icon:"🥣", title:"Chè", cluster:"processed", focus:"carb", macroLabel:"Carb", macroClass:"macro-carb", hue:172},
    {key:"fast_food", icon:"🍔", title:"Fast food", cluster:"processed", focus:"protein", macroLabel:"Đạm", macroClass:"macro-protein", hue:356}
  ];

  const FOOD_TYPE_CLUSTERS = [
    {key:"protein", icon:"🥩", title:"Nguồn đạm", note:"Thịt, cá, hải sản, trứng, sữa và đậu được đặt liền nhau.", hue:205},
    {key:"carb", icon:"🍚", title:"Nguồn carb", note:"Ngũ cốc, mì, bánh mì, khoai củ, rau, quả và đồ uống được đặt liền nhau.", hue:39},
    {key:"fat", icon:"🥑", title:"Nguồn fat", note:"Các thực phẩm thiên về chất béo được gom cùng một cụm.", hue:278},
    {key:"processed", icon:"🍽️", title:"Món chế biến & ăn ngoài", note:"Bánh ngọt, kem, chè, fast food và món hoàn chỉnh được xếp dưới cùng.", hue:348}
  ];
  const frequentFoodSearch = document.getElementById("frequentFoodSearch");
  const frequentFoodGroups = document.getElementById("frequentFoodGroups");
  const foodTableEmpty = document.getElementById("foodTableEmpty");
  const normalizeFoodText = (value) => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/đ/g, "d").trim();
  const fmtFoodRatio = (value) => fmt(Number(value) || 0, 1);
  const escapeFoodHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const foodNameHas = (normalizedName, terms) => terms.some((term) => normalizedName.includes(term));
  function getFoodTypeKey(food) {
    if (food.group && FOOD_TYPE_GROUPS.some((group) => group.key === food.group)) return food.group;
    const rawName = String(food.name || "").trim().toLowerCase();
    const name = normalizeFoodText(food.name);
    if (foodNameHas(name, ["chuoi say", "mit say", "khoai mon say"])) return "snack";
    if (foodNameHas(name, ["hat ", "lac", "almond", "cashew"])) return "nut";
    if (["duong", "dau hao", "cham chao", "mat ong", "mat mia"].some((term) => name === term || name.startsWith(`${term} `))) return "seasoning";
    if (foodNameHas(name, ["mayonnaise", "bo dau phong", "bo thuc vat", "butter"])) return "spread";
    if (foodNameHas(name, ["nuoc dua", "nuoc mia", "bia"])) return "drink";
    if (food.category === "fruit") return "fruit";
    if (foodNameHas(name, ["sua dau nanh", "dau phu", "dau hu", "dau nanh", "dau xanh", "dau do", "dau den", "lentils", "dau lang"])) return "legume";
    if (foodNameHas(name, ["sua ", "sua chua", "pho mai", "cottage", "mozzarella", "cheddar", "parmesan", "butter", "bo dong vat"])) return "dairy";
    if (foodNameHas(name, ["long trang trung", "trung ga", "trung vit"])) return "egg";
    if (rawName.startsWith("cá ") || foodNameHas(name, ["trung ca"])) return "fish";
    if (foodNameHas(name, ["tom", "tep", "muc", "bach tuoc", "be be", "cua", "ghe", "so diep", "mussels", "vem"]) || rawName.includes("hàu") || rawName.includes("ốc ")) return "seafood";
    if (rawName.startsWith("nấm ") || foodNameHas(name, ["ca chua", "dua chuot", "ca tim", "ca rot"])) return "vegetable";
    if (foodNameHas(name, ["thit bo kho", "ga kho", "cha bong", "ham", "giam bong", "bacon", "pate gan"])) return "processed";
    if (foodNameHas(name, ["uc ga", "dui ga", "canh ga", "thit ga", "thit vit", "thit ngan"])) return "poultry";
    if (foodNameHas(name, ["thit bo", "thit lon", "gan lon", "tim lon", "tim bo", "da day heo", "long heo", "bi heo"])) return "meat";
    if (foodNameHas(name, ["nhong tam"])) return "insect";
    if (["bún", "phở", "mì", "miến", "bánh đa", "bánh canh", "udon", "soba", "tteokbokki"].some((term) => rawName.startsWith(term))) return "noodle";
    if (foodNameHas(name, ["khoai", "san deo", "bi do"])) return "tuber";
    if (foodNameHas(name, ["com", "yen mach"])) return "grain";
    return food.category === "fat" ? "nut" : food.category === "carb" ? "grain" : "meat";
  }
  function getFoodTypeGroup(food) {
    return FOOD_TYPE_GROUPS.find((group) => group.key === getFoodTypeKey(food)) || FOOD_TYPE_GROUPS[0];
  }
  function foodEfficiency(food, focus) {
    return food.kcal > 0 ? (Number(food[focus] || 0) * 100 / food.kcal) : 0;
  }
  function renderFoodRows(rows, group) {
    return rows.map((food) => {
      const detail = [food.state, food.basis].filter(Boolean).join(" · ");
      const macroValue = Number(food[group.focus] || 0);
      return `<tr data-food-name="${escapeFoodHtml(food.name)}">
        <td><div class="food-name-cell"><span class="food-emoji" aria-hidden="true">${food.icon}</span><div class="food-name-copy"><strong>${escapeFoodHtml(food.name)}</strong><small>${escapeFoodHtml(detail)}</small></div></div></td>
        <td class="food-number ${group.macroClass}">${fmtMacro(macroValue)}</td>
        <td class="food-number macro-kcal">${fmtMacro(food.kcal)}</td>
        <td class="food-ratio-number" title="${group.macroLabel} trên 100 kcal">${fmtFoodRatio(foodEfficiency(food, group.focus))}</td>
      </tr>`;
    }).join("");
  }
  function renderFoodTypeGroup(rows, group) {
    const sortedRows = [...rows].sort((a, b) => foodEfficiency(b, group.focus) - foodEfficiency(a, group.focus) || a.kcal - b.kcal || a.name.localeCompare(b.name, "vi"));
    return `<section class="food-category food-type-card" data-food-group="${group.key}" style="--food-hue:${group.hue}">
      <div class="food-category-head"><h4><span class="food-category-icon" aria-hidden="true">${group.icon}</span>${group.title}</h4><div class="food-category-meta"><span class="food-category-count">${sortedRows.length}</span></div></div>
      <div class="food-table-scroll"><table class="frequent-food-table"><colgroup><col class="food-col-name"><col class="food-col-macro"><col class="food-col-kcal"><col class="food-col-ratio"></colgroup><thead><tr><th>Thực phẩm</th><th>${group.macroLabel}</th><th>Calo</th><th title="Gram ${group.macroLabel.toLowerCase()} trên 100 kcal">Tỷ lệ</th></tr></thead><tbody>${renderFoodRows(sortedRows, group)}</tbody></table></div>
    </section>`;
  }
  function renderFrequentFoods(query = "") {
    if (!frequentFoodGroups) return;
    const normalizedQuery = normalizeFoodText(query);
    const filtered = FREQUENT_FOODS.filter((food) => {
      const group = getFoodTypeGroup(food);
      return !normalizedQuery || normalizeFoodText(`${food.name} ${food.state} ${food.category} ${group.title}`).includes(normalizedQuery);
    });
    foodTableEmpty?.classList.toggle("show", filtered.length === 0);
    frequentFoodGroups.innerHTML = FOOD_TYPE_CLUSTERS.map((cluster) => {
      const cards = FOOD_TYPE_GROUPS.filter((group) => group.cluster === cluster.key).map((group) => {
        const rows = filtered.filter((food) => getFoodTypeKey(food) === group.key);
        return rows.length ? renderFoodTypeGroup(rows, group) : "";
      }).join("");
      if (!cards) return "";
      return `<section class="food-macro-cluster" data-food-cluster="${cluster.key}" style="--cluster-hue:${cluster.hue}">
        <div class="food-macro-cluster-head"><div><h3><span aria-hidden="true">${cluster.icon}</span>${cluster.title}</h3><p>${cluster.note}</p></div></div>
        <div class="food-macro-cluster-grid">${cards}</div>
      </section>`;
    }).join("");
  }
  renderFrequentFoods();
  if (frequentFoodSearch) frequentFoodSearch.addEventListener("input", () => renderFrequentFoods(frequentFoodSearch.value));

  /* V35 · Unified food catalog: all internal databases + live USDA/Open Food Facts search. */
  const nutritionLookupForm = document.getElementById("nutritionLookupForm");
  const nutritionLookupInput = document.getElementById("nutritionLookupInput");
  const nutritionLookupStatus = document.getElementById("nutritionLookupStatus");
  const nutritionMacroCatalog = document.getElementById("nutritionMacroCatalog");
  const nutritionCatalogEmpty = document.getElementById("nutritionCatalogEmpty");
  let nutritionOnlineCache = [];
  let expandedUsdaCatalog = [];
  let activeCatalogQuery = "";

  const VI_FOOD_NAME_EXACT = {
    "mozzarella":"Phô mai Mozzarella","cheddar":"Phô mai Cheddar","greek yogurt":"Sữa chua Hy Lạp","cottage cheese":"Phô mai Cottage","soy protein isolate":"Bột đạm đậu nành cô lập","wholewheat pasta":"Mì nguyên cám",
    "beef liver":"Gan bò","chicken liver":"Gan gà","cod liver oil":"Dầu gan cá tuyết","tuna":"Cá ngừ","goat cheese":"Phô mai dê","mackerel":"Cá thu","squid":"Mực","feta cheese":"Phô mai Feta","salmon":"Cá hồi","salmon smoked":"Cá hồi hun khói","cow milk":"Sữa bò","butter":"Bơ động vật","trout":"Cá hồi vân","egg":"Trứng gà","chicken":"Thịt gà","carrot":"Cà rốt","sweet potato":"Khoai lang","grapefruit":"Bưởi chùm","peanut butter":"Bơ đậu phộng","beef":"Thịt bò","pork":"Thịt heo","turkey":"Thịt gà tây","duck":"Thịt vịt","shrimp":"Tôm","prawn":"Tôm","crab":"Cua","lobster":"Tôm hùm","oyster":"Hàu","mussels":"Vẹm","octopus":"Bạch tuộc","sardine":"Cá mòi","anchovy":"Cá cơm","cod":"Cá tuyết","tilapia":"Cá rô phi","catfish":"Cá da trơn","rice":"Gạo","brown rice":"Gạo lứt","oats":"Yến mạch","barley":"Lúa mạch","corn":"Ngô","potato":"Khoai tây","cassava":"Sắn","yam":"Khoai mỡ","bread":"Bánh mì","pasta":"Mì pasta","noodles":"Mì sợi","tofu":"Đậu phụ","soy milk":"Sữa đậu nành","lentils":"Đậu lăng","chickpeas":"Đậu gà","kidney beans":"Đậu thận đỏ","black beans":"Đậu đen","peas":"Đậu Hà Lan","almonds":"Hạnh nhân","cashews":"Hạt điều","walnuts":"Hạt óc chó","pistachios":"Hạt dẻ cười","peanuts":"Lạc","sunflower seeds":"Hạt hướng dương","pumpkin seeds":"Hạt bí","chia seeds":"Hạt chia","flax seeds":"Hạt lanh","olive oil":"Dầu ô liu","coconut oil":"Dầu dừa","avocado":"Quả bơ","apple":"Táo","banana":"Chuối","orange":"Cam","mango":"Xoài","pineapple":"Dứa","watermelon":"Dưa hấu","strawberries":"Dâu tây","blueberries":"Việt quất","raspberries":"Phúc bồn tử","grapes":"Nho","pear":"Lê","peach":"Đào","cherries":"Cherry","kiwi":"Kiwi","papaya":"Đu đủ","dragon fruit":"Thanh long","durian":"Sầu riêng","tomato":"Cà chua","cucumber":"Dưa chuột","cabbage":"Bắp cải","broccoli":"Bông cải xanh","cauliflower":"Bông cải trắng","spinach":"Rau chân vịt","mushrooms":"Nấm","yogurt":"Sữa chua","greek yogurt":"Sữa chua Hy Lạp","cheddar cheese":"Phô mai Cheddar","mozzarella cheese":"Phô mai Mozzarella","cottage cheese":"Phô mai Cottage","cream cheese":"Phô mai kem","ice cream":"Kem","honey":"Mật ong","sugar":"Đường"
  };
  const VI_FOOD_ROOTS = {
    "chicken":"Thịt gà","beef":"Thịt bò","pork":"Thịt heo","turkey":"Thịt gà tây","duck":"Thịt vịt","fish":"Cá","salmon":"Cá hồi","tuna":"Cá ngừ","shrimp":"Tôm","crab":"Cua","egg":"Trứng","milk":"Sữa","cheese":"Phô mai","yogurt":"Sữa chua","rice":"Gạo","bread":"Bánh mì","potato":"Khoai tây","beans":"Đậu","mushroom":"Nấm","apple":"Táo","banana":"Chuối","orange":"Cam"
  };
  function translateFoodNameToVietnamese(value) {
    const original = String(value || "").trim();
    if (!original) return original;
    const lower = original.toLowerCase().replace(/\s+/g," ").trim();
    if (VI_FOOD_NAME_EXACT[lower]) return VI_FOOD_NAME_EXACT[lower];
    const parts = lower.split(",").map((x)=>x.trim()).filter(Boolean);
    const root = parts[0];
    if (VI_FOOD_NAME_EXACT[root]) {
      const notes = parts.slice(1).map((part)=>({raw:"sống",cooked:"chín",roasted:"rang/nướng",grilled:"nướng",boiled:"luộc",fried:"chiên",skinless:"không da",boneless:"không xương",smoked:"hun khói",dried:"khô",unsalted:"không muối",sweetened:"có đường",unsweetened:"không đường"}[part])).filter(Boolean);
      return `${VI_FOOD_NAME_EXACT[root]}${notes.length ? ` (${[...new Set(notes)].join(", ")})` : ""}`;
    }
    for (const [en, vi] of Object.entries(VI_FOOD_ROOTS)) {
      if (lower === en || lower.startsWith(`${en},`) || lower.startsWith(`${en} `)) return `${vi}${parts.length > 1 ? ` · ${parts.slice(1).join(", ")}` : ""}`;
    }
    return original;
  }
  function numberOrNull(value) { const n=Number(value); return Number.isFinite(n) ? n : null; }
  /* V68: nước lọc và muối là 0 kcal nhưng vẫn là món có thật. Chặn chúng ở đây
     khiến cả ngày ghi "1 cốc nước lọc" bị coi là chưa nhận diện. */
  function hasAllMacros(item) { return [item.kcal,item.protein,item.carb,item.fat].every((v)=>Number.isFinite(Number(v))) && (Number(item.kcal)>0 || item.zeroCalorieV68===true) && Number(item.kcal)<2000; }
  function foodIconForName(name) {
    const n=normalizeFoodText(name);
    if (/(strongbow|cider)/.test(n)) return "🍺";
    if (/(bia|beer|lager|ale)/.test(n)) return "🍺";
    if (/(ruou vang|wine)/.test(n)) return "🍷";
    if (/(ruou trang|vodka|whisky|whiskey|rum|gin)/.test(n)) return "🥃";
    if (/(bo huc|red bull|energy drink)/.test(n)) return "🥫";
    if (/(tra sua|milk tea|bubble tea)/.test(n)) return "🧋";
    if (/(nuoc mia|sugarcane)/.test(n)) return "🧃";
    if (/(coca|pepsi|cola|soft drink|nuoc ngot)/.test(n)) return "🥤";
    if (/(ca phe|coffee)/.test(n)) return "☕";
    if (/(^| )tra( |$)|tea/.test(n)) return "🍵";
    if (/(nuoc dua|coconut water)/.test(n)) return "🥥";
    if (/(nuoc|drink|juice)/.test(n)) return "🥤";

    if (/(tom|tep|shrimp|prawn)/.test(n)) return "🦐";
    if (/(cua|ghe|crab|lobster)/.test(n)) return "🦀";
    if (/(muc|squid)/.test(n)) return "🦑";
    if (/(bach tuoc|octopus)/.test(n)) return "🐙";
    if (/(hau|so|vem|oyster|mussel|scallop|oc )/.test(`${n} `)) return "🦪";
    if (/(ca |fish|salmon|tuna|mackerel|cod|trout|anchovy)/.test(`${n} `)) return "🐟";

    if (/(ga ran kfc|kfc chicken)/.test(n)) return "🍗";
    if (/(big mac|quarter pounder|mcchicken|filet o fish|whopper|burger|hamburger)/.test(n)) return "🍔";
    if (/(pizza)/.test(n)) return "🍕";
    if (/(khoai tay chien|french fries)/.test(n)) return "🍟";
    if (/(mi y|spaghetti|pasta)/.test(n)) return "🍝";
    if (/(pho |bun |mi quang|mi van than|mien luon|hu tieu|banh da cua|banh canh|noodle soup)/.test(`${n} `)) return "🍜";
    if (/(banh cuon|banh bot loc|nem cuon|nem ran|spring roll|dumpling)/.test(n)) return "🥟";
    if (/(banh tom)/.test(n)) return "🍤";
    if (/(banh chuoi)/.test(n)) return "🍌";
    if (/(bo bit tet|steak)/.test(n)) return "🥩";
    if (/(vit quay|ngan|chim quay|ga |chicken|turkey|duck)/.test(`${n} `)) return "🍗";
    if (/(nom|salad)/.test(n)) return "🥗";
    if (/(pate|pa te)/.test(n)) return "🥫";

    if (/(cheesecake|cheese cake|banh pho mai)/.test(n)) return "🍰";
    if (/(flan|caramen|creme brulee)/.test(n)) return "🍮";
    if (/(croissant)/.test(n)) return "🥐";
    if (/(mexican bun|cinnamon swirl|banh bong lan|sponge cake)/.test(n)) return "🧁";
    if (/(che |thach gang|thach den)/.test(`${n} `)) return "🍧";
    if (/(kem|ice cream|gelato)/.test(n)) return "🍨";

    if (/(tteokbokki)/.test(n)) return "🍢";
    if (/(banh bao)/.test(n)) return "🥟";
    if (/(banh day|banh duc)/.test(n)) return "🍘";
    if (/(tortilla|naan)/.test(n)) return "🫓";
    if (/(baguette|banh mi|bread)/.test(n)) return "🥖";
    if (/(xoi)/.test(n)) return "🍙";
    if (/(com|rice)/.test(n)) return "🍚";
    if (/(bun|pho|mi |noodle|mien|udon|soba)/.test(`${n} `)) return "🍜";
    if (/(khoai|potato|yam|cassava)/.test(n)) return "🍠";
    if (/(gao|yen mach|oat|ngu coc|grain|corn|ngo)/.test(n)) return "🌾";

    if (/(dau phu non|silken tofu)/.test(n)) return "◻️";
    if (/(dau phu|tofu|tempeh)/.test(n)) return "⬜";
    if (/(dau |bean|lentil|chickpea|soybean|pea)/.test(`${n} `)) return "🫘";
    if (/(hat|lac|almond|cashew|walnut|seed|pistachio)/.test(n)) return "🌰";

    if (/(trung|egg)/.test(n)) return "🥚";
    if (/(sua chua|yogurt)/.test(n)) return "🥣";
    if (/(pho mai|cheese)/.test(n)) return "🧀";
    if (/(bo dong vat|butter)/.test(n)) return "🧈";
    if (/(sua|milk|whey)/.test(n)) return "🥛";
    if (/(bo |beef|heo|lon|pork|thit|gan|tim|bacon|ham)/.test(`${n} `)) return "🥩";

    if (/(nam|mushroom)/.test(n)) return "🍄";
    if (/(rau|cai|broccoli|cauliflower|spinach|cabbage|cucumber)/.test(n)) return "🥬";
    if (/(tao|apple)/.test(n)) return "🍎";
    if (/(chuoi|banana)/.test(n)) return "🍌";
    if (/(cam|orange)/.test(n)) return "🍊";
    if (/(xoai|mango)/.test(n)) return "🥭";
    if (/(dua hau|watermelon)/.test(n)) return "🍉";
    if (/(bo$|avocado)/.test(n)) return "🥑";
    if (/(fruit|hoa qua|nho|grape|berry|viet quat|phuc bon tu|dau tay|cherry|le |pear|dao |peach|kiwi|du du|papaya|thanh long|sau rieng)/.test(`${n} `)) return "🍓";
    if (/(dau |oil)/.test(`${n} `)) return "🫒";
    if (/(muoi|salt)/.test(n)) return "🧂";
    if (/(duong|mat ong|honey|sugar)/.test(n)) return "🍯";
    return "🍽️";
  }
  function normalizeLegacyFood(food, sourceKind) {
    if (!food || !food.name) return null;
    let kcal=null, protein=null, carb=null, fat=null, basis="100 g";
    if ([food.per100g,food.protein100g,food.carbs100g,food.fat100g].every((v)=>Number.isFinite(Number(v)))) {
      kcal=Number(food.per100g); protein=Number(food.protein100g); carb=Number(food.carbs100g); fat=Number(food.fat100g); basis="100 g";
    } else if ([food.per100ml,food.protein100ml,food.carbs100ml,food.fat100ml].every((v)=>Number.isFinite(Number(v)))) {
      kcal=Number(food.per100ml); protein=Number(food.protein100ml); carb=Number(food.carbs100ml); fat=Number(food.fat100ml); basis="100 ml";
    } else if ([food.defaultKcal,food.defaultProtein,food.defaultCarbs,food.defaultFat].every((v)=>Number.isFinite(Number(v)))) {
      kcal=Number(food.defaultKcal); protein=Number(food.defaultProtein); carb=Number(food.defaultCarbs); fat=Number(food.defaultFat);
      basis=Number.isFinite(Number(food.defaultMl)) ? `${Number(food.defaultMl)} ml` : Number.isFinite(Number(food.defaultGrams)) ? `khẩu phần ${Number(food.defaultGrams)} g` : "1 khẩu phần";
    }
    const item={kind:"local",id:food.id || "",name:String(food.name),originalName:food.en || "",subtitle:basis,icon:food.icon || foodIconForName(food.name),kcal,protein,carb,fat,source:food.source || sourceKind,aliases:[food.name,food.en,...(food.aliases||[])].filter(Boolean).join(" "),catalogHint:food.group||food.category||"",processingText:[food.state,food.source,food.group,food.category,food.rangeNote,food.en].filter(Boolean).join(" ")};
    return hasAllMacros(item) ? item : null;
  }
  function normalizeFrequentFood(food) {
    const item={kind:"local",id:"",name:String(food.name),originalName:"",subtitle:[food.state,food.basis].filter(Boolean).join(" · ") || "100 g",icon:food.icon || foodIconForName(food.name),kcal:Number(food.kcal),protein:Number(food.protein),carb:Number(food.carb),fat:Number(food.fat),source:"CSDL thực phẩm thường ăn",aliases:`${food.name}`,catalogHint:food.group||food.category||"",processingText:[food.state,food.basis,food.group,food.category].filter(Boolean).join(" ")};
    return hasAllMacros(item) ? item : null;
  }

  /* V47 · Danh mục chuẩn hóa theo cách sử dụng thực tế của người dùng. */
  function curatedCatalogFood(id,name,group,kcal,protein,carb,fat,basis,icon,aliases="",subgroup=""){
    return {kind:"local",id:`v47_${id}`,name,originalName:"",subtitle:basis,icon,catalogIcon:icon,kcal,protein,carb,fat,source:"CSDL ưu tiên V47 · giá trị tham chiếu trung bình",aliases:`${name} ${aliases}`.trim(),catalogHint:"curated_v47",processingText:"curated_v47",curatedV47:true,forcedGroup:group,forcedSubgroup:subgroup||group};
  }
  const CURATED_CATALOG_V47 = [
    /* Thịt gà nguyên liệu chuẩn hóa */
    curatedCatalogFood("uc_ga_phi_le_khong_da","Ức gà phi lê không da","meat",114,23,0,2,"100 g · sống","🍗","ức gà chicken breast skinless boneless raw","poultry"),
    curatedCatalogFood("dui_ga_phi_le_khong_da","Đùi gà phi lê không da","meat",144,19,0,7.5,"100 g · sống","🍗","đùi gà chicken thigh skinless boneless raw","poultry"),

    /* Thịt chế biến thường dùng · giá trị tham chiếu trung bình trên 100 g. */
    curatedCatalogFood("bacon","Bacon","meat",541,37,1.4,42,"100 g · thịt heo xông khói, thành phẩm trung bình","🥓","thịt heo xông khói thịt xông khói bacon streaky bacon pork bacon","processed-meat"),
    curatedCatalogFood("lap_xuong","Lạp xưởng","meat",455,24,12,35,"100 g · thành phẩm trung bình","🌭","lạp xưởng lap xuong chinese sausage chinese pork sausage lap cheong lap chong","processed-meat"),
    curatedCatalogFood("xuc_xich","Xúc xích","meat",301,13,2,27,"100 g · xúc xích thịt heo/bratwurst, thành phẩm trung bình","🌭","xúc xích xuc xich sausage pork sausage german sausage bratwurst","processed-meat"),
    curatedCatalogFood("ham","Ham","meat",145,18,1.5,7,"100 g · giăm bông heo, thành phẩm trung bình","🍖","giăm bông heo giăm bông giam bong ham pork ham sliced ham","processed-meat"),
    curatedCatalogFood("prosciutto","Đùi heo muối (Prosciutto)","meat",195,27.2,0.4,8.8,"100 g · đùi heo muối khô, thành phẩm trung bình","🍖","đùi heo muối dui heo muoi prosciutto prosciutto ham dry cured ham italian ham","processed-meat"),
    curatedCatalogFood("salami","Salami","meat",407,22.6,1.6,33.7,"100 g · xúc xích lên men/ủ khô, thành phẩm trung bình","🍖","salami dry salami italian salami cured sausage","processed-meat"),
    curatedCatalogFood("top_mo_chien","Tóp mỡ chiên","meat",569,45,0,42,"100 g · thành phẩm chiên, giá trị tham chiếu trung bình","🥓","tóp mỡ fried pork cracklings pork cracklings fried pork fat pork fat cracklings","processed-meat"),

    /* Tinh bột */
    curatedCatalogFood("com_gao_trang","Cơm gạo trắng","starch",260,5.4,56.2,0.6,"1 bát · 200 g","🍚","cơm trắng cooked white rice","rice"),
    curatedCatalogFood("com_gao_lut","Cơm gạo lứt","starch",224,5.2,46,1.8,"1 bát · 200 g","🍚","brown rice cooked","rice"),
    curatedCatalogFood("xoi_trang","Xôi trắng","starch",300,6.5,67,1,"100 g","🍙","xôi gạo nếp sticky rice","rice"),
    curatedCatalogFood("com_tuoi","Cốm","starch",334,6.1,72,2.4,"100 g · cốm tươi, chưa trộn đường/dừa","🌾","cốm làng vòng green rice flakes","grain"),
    curatedCatalogFood("xoi_com","Xôi cốm","starch",279,5,49,7,"100 g","🍙","sticky rice with green rice flakes","rice"),
    curatedCatalogFood("xoi_khuc","Xôi khúc","starch",243,7,38,7,"100 g","🍙","khuc sticky rice mung bean pork","rice"),
    curatedCatalogFood("xoi_lac","Xôi lạc","starch",285,8,45,9,"100 g","🍙","peanut sticky rice","rice"),
    curatedCatalogFood("xoi_do_xanh","Xôi đỗ xanh","starch",235,7,45,3,"100 g","🍙","mung bean sticky rice xôi đỗ","rice"),
    curatedCatalogFood("xoi_do_den","Xôi đỗ đen","starch",230,7,44,3,"100 g","🍙","black bean sticky rice","rice"),
    curatedCatalogFood("banh_duc","Bánh đúc","starch",115,1.8,25,0.7,"100 g","🍘","plain rice cake","starch"),
    curatedCatalogFood("tteokbokki","Tteokbokki","starch",172,3.2,33.2,2.8,"100 g","🍲","korean rice cake","starch"),
    curatedCatalogFood("baguette","Bánh mì baguette","starch",274,9.6,57,0.8,"100 g","🥖","bánh mì không bánh mỳ không plain baguette baguette french bread","bread"),
    curatedCatalogFood("banh_bao_chay","Bánh bao chay","starch",280,7.5,55,3.5,"1 cái · 150 g","🥟","vegetarian steamed bun","bread"),
    curatedCatalogFood("banh_day","Bánh dày","starch",235,4,52,1,"1 cái · 100 g","🍘","glutinous rice cake","starch"),
    curatedCatalogFood("tortilla","Tortilla","starch",160,4,27,4,"1 cái · 50 g","🫓","tortilla wrap","bread"),
    curatedCatalogFood("naan","Bánh mì naan","starch",310,9,50,8,"1 cái · 100 g","🫓","naan bread","bread"),

    /* Rau củ */
    curatedCatalogFood("muop_dang","Mướp đắng","vegetables",17,1.0,3.7,0.2,"100 g · sống","🥒","khổ qua kho qua bitter melon bitter gourd balsam pear","vegetables"),

    /* Cá và hải sản khô */
    curatedCatalogFood("ca_bo_kho","Cá bò khô","fish",290,55,5,4.5,"100 g","🐟","dried leatherjacket fish","fish-dried"),
    curatedCatalogFood("ca_chi_vang_kho","Cá chỉ vàng khô","fish",290,58,2,5,"100 g","🐟","dried yellow stripe scad","fish-dried"),
    curatedCatalogFood("muc_kho","Mực khô","fish",291,60,11,4.5,"100 g","🦑","dried squid","squid-dried"),
    curatedCatalogFood("tep_kho","Tép khô","fish",300,63,8,3,"100 g","🦐","dried small shrimp","shrimp-dried"),
    curatedCatalogFood("tom_kho","Tôm khô","fish",300,62,5,4,"100 g","🦐","dried shrimp","shrimp-dried"),
    curatedCatalogFood("ca_com_kho","Cá cơm khô","fish",260,50,2,6,"100 g","🐟","dried anchovy","fish-dried"),

    /* Đậu: đậu phụ là thành phẩm nền; tất cả hạt đậu ghi theo trạng thái sống/khô, chưa nấu. */
    curatedCatalogFood("dau_phu","Đậu phụ","beans",76,8,1.9,4.8,"100 g · chưa chiên","⬜","tofu firm tofu","tofu"),
    curatedCatalogFood("dau_hu_non","Đậu hũ non","beans",55,5.3,1.5,3,"100 g · chưa chế biến","▫️","đậu phụ non silken tofu soft tofu","tofu"),
    curatedCatalogFood("dau_nanh","Đậu nành","beans",446,36.5,30.2,19.9,"100 g · hạt sống/khô, chưa nấu","🫘","soybean soy beans raw","raw-beans"),
    curatedCatalogFood("dau_do","Đậu đỏ","beans",329,19.9,62.9,0.5,"100 g · hạt sống/khô, chưa nấu","🫘","red bean adzuki bean raw","raw-beans"),
    curatedCatalogFood("dau_den","Đậu đen","beans",341,21.6,62.4,1.4,"100 g · hạt sống/khô, chưa nấu","🫘","black beans raw","raw-beans"),
    curatedCatalogFood("dau_xanh","Đậu xanh","beans",347,23.9,62.6,1.2,"100 g · hạt sống/khô, chưa nấu","🫘","mung beans raw","raw-beans"),
    curatedCatalogFood("dau_trang","Đậu trắng","beans",333,23.4,60.3,0.9,"100 g · hạt sống/khô, chưa nấu","🫘","white beans navy beans raw","raw-beans"),
    curatedCatalogFood("dau_ha_lan","Đậu Hà Lan","beans",352,23.8,63.7,1.2,"100 g · hạt sống/khô, chưa nấu","🫛","dry peas raw","raw-beans"),
    curatedCatalogFood("dau_ga","Đậu gà","beans",378,20.5,63,6,"100 g · hạt sống/khô, chưa nấu","🫘","chickpeas garbanzo raw","raw-beans"),
    curatedCatalogFood("dau_lang","Đậu lăng","beans",352,24.6,63.4,1.1,"100 g · hạt sống/khô, chưa nấu","🫘","lentils raw","raw-beans"),

    /* Hạt */
    curatedCatalogFood("hat_dac","Hạt đác","nuts",27,0.3,6.2,0.1,"100 g · đã sơ chế, chưa ngâm đường","🌴","palm seed dac seed","palm-seeds"),
    curatedCatalogFood("hat_thot_not","Hạt thốt nốt","nuts",96,1,23,0.2,"100 g · phần ăn được, chưa ngâm đường","🌴","palmyra palm seed","palm-seeds"),
    curatedCatalogFood("hat_vung","Hạt vừng","nuts",573,17.7,23.4,49.7,"100 g · hạt sống, chưa rang","🌰","vừng mè sesame seed raw","seeds"),

    /* Bơ sữa */
    curatedCatalogFood("kem_vani","Kem vani","dairy",207,3.5,24,11,"100 g","🍨","vanilla ice cream","ice-cream"),

    /* Bánh ngọt */
    curatedCatalogFood("cheesecake","Bánh cheesecake","sweet-cakes",430,7,36,28,"1 miếng · 120 g","🍰","cheese cake","cake"),
    curatedCatalogFood("flan","Bánh flan caramen","sweet-cakes",180,5,26,6,"1 cốc · 120 g","🍮","caramel flan creme caramel","pudding"),
    curatedCatalogFood("creme_brulee","Crème brûlée","sweet-cakes",320,5,27,22,"1 cốc · 120 g","🍮","creme brulee","pudding"),
    curatedCatalogFood("croissant","Bánh croissant","sweet-cakes",240,5,26,13,"1 cái · 60 g","🥐","croissant","pastry"),
    curatedCatalogFood("mexican_bun","Bánh Mexican bun","sweet-cakes",330,7,50,12,"1 cái · 85 g","🧁","mexican coffee bun roti boy","pastry"),
    curatedCatalogFood("cinnamon_swirl","Bánh cinnamon swirl","sweet-cakes",380,6,56,15,"1 cái · 100 g","🧁","cinnamon roll swirl","pastry"),
    curatedCatalogFood("bong_lan","Bánh bông lan","sweet-cakes",260,5,40,9,"1 miếng · 80 g","🍰","sponge cake","cake"),
    curatedCatalogFood("su_kem","Bánh su kem","sweet-cakes",245,5.5,27,13,"1 cái · 65 g","🧁","cream puff choux pastry","pastry"),
    curatedCatalogFood("mochi","Bánh mochi","sweet-cakes",188,2.5,40,2,"1 cái · 50 g","🍡","mochi rice cake sweet","cake"),
    curatedCatalogFood("banh_quy_bo","Bánh quy bơ","sweet-cakes",130,1.5,16,7,"2–3 cái · 25 g","🍪","butter cookies shortbread","cookie"),
    curatedCatalogFood("chocopie","Bánh Chocopie","sweet-cakes",125,1.5,20,4.5,"1 cái · 33 g","🍪","choco pie chocolate pie","cookie"),
    curatedCatalogFood("macaron","Bánh macaron","sweet-cakes",105,2,14,5,"1 cái · 25 g","🍪","french macaron","cookie"),
    curatedCatalogFood("donut","Bánh donut","sweet-cakes",280,4,34,14,"1 cái · 75 g","🍩","doughnut donut","cake"),
    curatedCatalogFood("tiramisu","Bánh tiramisu","sweet-cakes",360,6,32,23,"1 miếng · 100 g","🍰","tiramisu","cake"),
    curatedCatalogFood("muffin","Bánh muffin","sweet-cakes",340,5,48,14,"1 cái · 100 g","🧁","muffin","cake"),
    curatedCatalogFood("pancake","Bánh pancake","sweet-cakes",227,6.4,28,10,"2 cái · 100 g","🥞","pancake","cake"),
    curatedCatalogFood("banh_tao","Bánh táo","sweet-cakes",296,2.4,42,14,"1 miếng · 100 g","🥧","apple pie","pie"),
    curatedCatalogFood("banh_pia","Bánh pía","sweet-cakes",432,8,55,20,"100 g","🥮","pia cake","traditional-cake"),
    curatedCatalogFood("banh_com","Bánh cốm","sweet-cakes",330,4,65,6,"100 g","🍘","green rice cake","traditional-cake"),
    curatedCatalogFood("banh_bo","Bánh bò","sweet-cakes",240,3,48,4,"100 g","🧁","vietnamese honeycomb cake","traditional-cake"),
    curatedCatalogFood("banh_gao","Bánh gạo","sweet-cakes",392,7.1,81.1,4.3,"100 g · loại bánh gạo/cracker nguyên vị","🍘","rice cake rice cake cracker rice cracker plain rice cake snack","traditional-cake"),
    curatedCatalogFood("banh_trung_thu","Bánh trung thu","sweet-cakes",600,12,90,22,"1 cái · 150 g","🥮","mooncake moon cake","traditional-cake"),

    /* Hoa quả bổ sung */
    curatedCatalogFood("buoi","Bưởi","fruit",38,0.76,9.62,0.04,"100 g · phần múi ăn được, sống","🍊","pomelo pummelo shaddock","fruit"),

    /* Chè và thạch */
    curatedCatalogFood("che_khuc_bach","Chè khúc bạch","sweet-soups",350,7,52,13,"1 bát · 300 g","🍧","khuc bach sweet soup","che"),
    curatedCatalogFood("che_do_den","Chè đỗ đen","sweet-soups",330,10,65,4,"1 bát · 300 g","🍧","black bean sweet soup","che"),
    curatedCatalogFood("che_ba_cot","Chè bà cốt","sweet-soups",420,6,78,10,"1 bát · 300 g","🍧","ba cot sweet soup","che"),
    curatedCatalogFood("che_buoi","Chè bưởi","sweet-soups",360,5,70,8,"1 bát · 300 g","🍧","pomelo sweet soup","che"),
    curatedCatalogFood("che_sen_long_nhan","Chè sen long nhãn","sweet-soups",280,5,60,2,"1 bát · 300 g","🍧","lotus longan sweet soup","che"),
    curatedCatalogFood("thach_gang","Thạch găng","sweet-soups",120,0.5,30,0,"1 bát · 250 g","🍮","grass jelly vietnam","jelly"),
    curatedCatalogFood("thach_den","Thạch đen","sweet-soups",110,0.5,27,0,"1 bát · 250 g","🍮","black grass jelly","jelly"),

    /* Ăn vặt */
    curatedCatalogFood("com_chay_cha_bong","Cơm cháy chà bông","snacks",520,13,68,22,"1 gói/phần · 100 g","🍘","crispy rice pork floss","savory-snack"),
    curatedCatalogFood("nom_bo_kho","Nộm bò khô","snacks",480,25,45,22,"1 đĩa · 300 g","🥗","dried beef papaya salad","savory-snack"),
    curatedCatalogFood("banh_bot_loc","Bánh bột lọc","snacks",500,18,80,12,"1 suất · 10 cái · 400 g","🥟","tapioca dumpling","savory-snack"),
    curatedCatalogFood("banh_xeo","Bánh xèo","snacks",550,18,60,27,"1 cái/phần · 300 g","🥞","vietnamese sizzling pancake","savory-snack"),
    curatedCatalogFood("banh_beo_hp","Bánh bèo Hải Phòng","snacks",450,20,70,10,"1 suất · 400 g","🥣","hai phong banh beo","savory-snack"),
    curatedCatalogFood("banh_khoai_tep","Bánh khoái tép","snacks",420,14,55,16,"1 suất · 300 g","🍤","shrimp fritter cake","savory-snack"),
    curatedCatalogFood("banh_xiu_pao","Bánh xíu páo Nam Định","snacks",280,9,35,12,"1 cái · 90 g","🥟","nam dinh xiu pao","savory-snack"),
    curatedCatalogFood("banh_nhan","Bánh nhãn Hải Hậu","snacks",430,7,68,15,"100 g","🍪","hai hau longan cookie","sweet-snack"),
    curatedCatalogFood("mit_say","Mít sấy","snacks",350,3,82,2,"100 g","🌴","dried jackfruit chips","dried-snack"),
    curatedCatalogFood("chuoi_say","Chuối sấy","snacks",360,3,80,4,"100 g","🍌","dried banana chips","dried-snack"),
    curatedCatalogFood("khoai_say","Khoai sấy","snacks",430,5,70,15,"100 g","🍠","dried potato sweet potato chips","dried-snack"),
    curatedCatalogFood("ngo_say","Ngô sấy","snacks",450,9,68,16,"100 g","🌽","dried corn snack","dried-snack"),
    curatedCatalogFood("nam_huong_say_lanh","Nấm hương sấy lạnh","snacks",320,12,55,7,"100 g","🍄","freeze dried shiitake mushroom","dried-snack"),
    curatedCatalogFood("bo_kho_tam_uop","Thịt bò khô (đã tẩm ướp)","snacks",290,40,10,10,"100 g","🥩","seasoned beef jerky","jerky"),
    curatedCatalogFood("ga_kho_tam_uop","Gà khô (đã tẩm ướp)","snacks",330,55,10,8,"100 g","🍗","seasoned dried chicken","jerky"),
    curatedCatalogFood("heo_kho_tam_uop","Heo khô (đã tẩm ướp)","snacks",360,42,14,15,"100 g","🐖","lợn khô thịt heo khô seasoned pork jerky","jerky"),
    curatedCatalogFood("nem_chua","Nem chua","snacks",140,21,5,4,"100 g","🍖","fermented pork roll","savory-snack"),
    curatedCatalogFood("bong_ngo","Bỏng ngô","snacks",387,12.9,77.9,4.5,"100 g · loại nguyên vị, không phủ đường","🍿","plain popcorn air popped popcorn","snack"),
    curatedCatalogFood("caramel_popcorn","Caramel popcorn","snacks",431,3.8,78.7,11.5,"100 g","🍿","bỏng ngô caramel caramel corn","sweet-snack"),

    /* Gia vị bổ sung */
    curatedCatalogFood("bot_matcha","Bột matcha","seasoning",324,30.6,38.5,5.3,"100 g · bột nguyên chất","🍵","matcha powder green tea powder","dry-seasoning"),
    curatedCatalogFood("dau_me","Dầu mè","seasoning",884,0,0,100,"100 g","🫙","sesame oil","oils"),

    /* Đồ uống */
    curatedCatalogFood("bia","Bia lager","drinks",142,1.2,10.6,0,"1 lon · 330 ml","🍺","beer lager","alcohol"),
    curatedCatalogFood("ruou_vang","Rượu vang đỏ","drinks",125,0.1,3.8,0,"1 ly · 150 ml","🍷","red wine","alcohol"),
    curatedCatalogFood("ruou_manh","Rượu mạnh","drinks",105,0,0,0,"1 chén · 45 ml","🥃","spirits vodka whisky","alcohol"),
    curatedCatalogFood("strongbow","Strongbow cider","drinks",180,0,21,0,"1 chai/lon · 330 ml","🍏","strongbow apple cider","alcohol"),
    curatedCatalogFood("bo_huc","Bò Húc / Red Bull","drinks",110,0,27,0,"1 lon · 250 ml","⚡","red bull energy drink","soft-drink"),
    curatedCatalogFood("coca_pepsi","Coca-Cola / Pepsi","drinks",139,0,35,0,"1 lon · 330 ml","🥤","coke coca pepsi cola","soft-drink"),
    curatedCatalogFood("coca_pepsi_zero","Coca-Cola / Pepsi Zero","drinks",1,0,0,0,"1 lon · 330 ml","🥤","coke zero pepsi zero","soft-drink"),
    curatedCatalogFood("tra_sua","Trà sữa","drinks",450,6,70,16,"1 cốc · 500 ml","🧋","milk tea bubble tea","milk-tea"),
    curatedCatalogFood("nuoc_mia","Nước mía","drinks",180,0,45,0,"1 cốc · 300 ml","🧃","sugarcane juice","juice"),
    curatedCatalogFood("lipton_ice_tea","Lipton Ice Tea","drinks",116,0,29,0,"1 chai · 455 ml","🧃","lipton iced tea trà chanh đóng chai","soft-drink"),

    /* Món ăn ngoài */
    curatedCatalogFood("sup_kem_bi_do","Súp kem bí đỏ","restaurant",135,2.7,11.7,9.3,"1 bát · 300 g","🥣","creamy pumpkin soup pumpkin cream soup cream of pumpkin soup","bowl"),
    curatedCatalogFood("mi_y_bo_bam","Mì Ý bò bằm","restaurant",620,28,80,20,"1 đĩa · 350 g","🍝","spaghetti bolognese","western"),
    curatedCatalogFood("mi_y_sot_kem","Mì Ý sốt kem","restaurant",750,20,80,38,"1 đĩa · 350 g","🍝","creamy pasta alfredo","western"),
    curatedCatalogFood("vit_quay","Vịt quay","restaurant",680,45,8,52,"1 suất · 250 g","🦆","roast duck","street"),
    curatedCatalogFood("ngan_chay_toi","Ngan cháy tỏi","restaurant",850,55,20,60,"1 suất · 350 g","🦆","garlic fried muscovy duck","street"),
    curatedCatalogFood("chim_quay","Chim quay","restaurant",430,38,4,28,"1 con · 180 g phần ăn được","🐦","roast quail pigeon","street"),
    curatedCatalogFood("long_ran","Lòng rán","restaurant",720,35,20,55,"1 đĩa · 250 g","🥩","fried pork offal","street"),
    curatedCatalogFood("banh_ran_ngot","Bánh rán ngọt","snacks",300,5,48,10,"1 cái · 100 g","🍩","sweet fried donut vietnam","street"),
    curatedCatalogFood("banh_ran_man","Bánh rán mặn","snacks",350,10,42,16,"1 cái · 120 g","🥟","savory fried donut vietnam","street"),
    curatedCatalogFood("pate","Pa tê","snacks",320,14,5,27,"100 g","🥫","pate pâté","street"),
    curatedCatalogFood("khoai_tay_chien","Khoai tây chiên","snacks",470,5,62,23,"1 suất · 150 g","🍟","french fries","street"),
    curatedCatalogFood("khoai_lang_chien","Khoai lang chiên","snacks",430,4,65,18,"1 suất · 150 g","🍠","fried sweet potato","street"),
    curatedCatalogFood("bo_bit_tet","Bò bít tết","restaurant",650,55,20,38,"1 suất · 300 g","🥩","beef steak","western"),
    curatedCatalogFood("nem_thinh","Nem thính","snacks",320,18,16,20,"1 đĩa · 150 g","🥗","pork skin thinh","savory-snack"),
    curatedCatalogFood("nem_tai","Nem tai","snacks",300,22,12,18,"1 đĩa · 150 g","🐖","pork ear salad","savory-snack"),
    curatedCatalogFood("nem_ran","Nem rán","restaurant",550,22,55,28,"1 suất · 5 cái · 175 g","🥟","fried spring rolls","street"),
    curatedCatalogFood("nem_cuon","Nem cuốn","snacks",400,18,55,12,"1 suất · 4 cuốn · 320 g","🥬","fresh spring rolls","street"),
    curatedCatalogFood("banh_cuon_nhan","Bánh cuốn nhân","restaurant",520,20,78,14,"1 đĩa · 350 g","🥟","steamed rice rolls pork filling","street"),
    curatedCatalogFood("banh_cuon_chay","Bánh cuốn chay","restaurant",400,10,75,8,"1 đĩa · 350 g","🥟","vegetarian steamed rice rolls","street"),
    curatedCatalogFood("banh_tom_ho_tay","Bánh Tôm Hồ Tây","snacks",700,25,80,32,"1 đĩa · 4 cái · 320 g","🍤","west lake shrimp cake","street"),
    curatedCatalogFood("banh_chuoi_chien","Bánh chuối chiên","snacks",450,4,70,18,"1 suất · 2 cái · 240 g","🍌","fried banana fritter","street"),
    curatedCatalogFood("pho_bo","Phở bò","restaurant",500,30,60,15,"1 bát Việt Nam · 650 g","🍜","beef pho noodle soup","bowl"),
    curatedCatalogFood("pho_ga","Phở gà","restaurant",450,32,55,10,"1 bát Việt Nam · 650 g","🍜","chicken pho noodle soup","bowl"),
    curatedCatalogFood("bun_ngan","Bún ngan","restaurant",560,30,65,20,"1 bát Việt Nam · 650 g","🍜","muscovy duck rice vermicelli","bowl"),
    curatedCatalogFood("bun_mam","Bún mắm","restaurant",600,32,75,18,"1 bát Việt Nam · 650 g","🍜","fermented fish noodle soup","bowl"),
    curatedCatalogFood("bun_bo_hue","Bún bò Huế","restaurant",600,35,70,20,"1 bát Việt Nam · 650 g","🍜","hue beef noodle soup","bowl"),
    curatedCatalogFood("banh_da_cua","Bánh đa cua","restaurant",550,25,75,16,"1 bát Việt Nam · 650 g","🍜","crab red noodle soup","bowl"),
    curatedCatalogFood("bun_tom","Bún tôm","restaurant",480,25,65,12,"1 bát Việt Nam · 600 g","🍜","shrimp vermicelli soup","bowl"),
    curatedCatalogFood("bun_ca","Bún cá","restaurant",500,28,70,10,"1 bát Việt Nam · 600 g","🍜","fish vermicelli soup","bowl"),
    curatedCatalogFood("banh_canh_ghe","Bánh canh ghẹ","restaurant",580,30,75,18,"1 bát Việt Nam · 650 g","🍜","crab thick noodle soup","bowl"),
    curatedCatalogFood("hu_tieu","Hủ tiếu","restaurant",500,25,70,14,"1 bát Việt Nam · 600 g","🍜","hu tieu noodle soup","bowl"),
    curatedCatalogFood("mi_quang","Mì Quảng","restaurant",620,30,70,24,"1 bát Việt Nam · 550 g","🍜","quang noodle","bowl"),
    curatedCatalogFood("mi_van_than","Mì vằn thắn","restaurant",650,32,75,25,"1 bát Việt Nam · 600 g","🍜","wonton noodle soup","bowl"),
    curatedCatalogFood("mien_luon","Miến lươn","restaurant",520,28,70,12,"1 bát Việt Nam · 600 g","🍜","eel glass noodle soup","bowl"),

    /* Fastfood */
    curatedCatalogFood("ga_ran_kfc","Gà rán KFC","fastfood",250,18,9,16,"1 miếng · 120 g","🍗","kfc fried chicken","chicken"),
    curatedCatalogFood("big_mac","Big Mac","fastfood",590,25,46,34,"1 chiếc · 215 g","🍔","mcdonalds bigmac","burger"),
    curatedCatalogFood("quarter_pounder","Quarter Pounder with Cheese","fastfood",520,30,42,26,"1 chiếc · 206 g","🍔","quarter powder quarter pounder mcdonalds","burger"),
    curatedCatalogFood("filet_o_fish","Filet-O-Fish","fastfood",390,16,39,19,"1 chiếc · 142 g","🍔","fillet o fish mcdonalds","burger"),
    curatedCatalogFood("mcchicken","McChicken","fastfood",400,14,39,21,"1 chiếc · 143 g","🍔","mcdonalds chicken burger","burger"),
    curatedCatalogFood("whopper","Whopper","fastfood",670,31,54,40,"1 chiếc · 291 g","🍔","burger king whopper","burger"),
    curatedCatalogFood("whopper_cheese","Whopper Cheese","fastfood",740,35,55,45,"1 chiếc · 310 g","🍔","burger king whopper cheese","burger"),
    curatedCatalogFood("double_whopper","Double Whopper","fastfood",920,52,55,57,"1 chiếc · 354 g","🍔","burger king double whopper","burger"),
    curatedCatalogFood("double_whopper_cheese","Double Whopper Cheese","fastfood",990,56,56,62,"1 chiếc · 375 g","🍔","burger king double whopper cheese","burger"),
    curatedCatalogFood("bbq_chicken_pizza","Pizza BBQ chicken","fastfood",330,16,38,12,"1 miếng · 150 g","🍕","barbecue chicken pizza bbq chicken pizza","pizza"),
    curatedCatalogFood("cheese_pizza","Pizza phô mai","fastfood",285,12,36,10,"1 miếng · 130 g","🍕","cheese pizza pizza cheese","pizza"),
    curatedCatalogFood("minced_beef_pizza","Pizza bò bằm","fastfood",360,18,40,15,"1 miếng · 150 g","🍕","minced beef pizza ground beef pizza","pizza")
  ];

  /* V50 · Một nguồn dữ liệu duy nhất cho cả bảng Thực phẩm và dữ liệu nhập từ Excel. */
  const V50_EXPLICIT_ALIASES = {
    "uc ga phi le khong da":["ức gà","ức gà phi lê","ức gà không da","chicken breast"],
    "dui ga phi le khong da":["đùi gà","đùi gà phi lê","đùi gà không da","chicken thigh"],
    "trung ga nguyen qua":["trứng","trứng gà","whole egg"],
    "tom boc vo":["tôm","tôm nõn","shrimp","prawn"],
    "banh mi baguette":["bánh mì không","bánh mỳ không","bánh mì baguette","bánh mỳ baguette","baguette"],
    "pho mai regular cheese loai pho mai van cho vao burger":["phô mai","regular cheese","burger cheese","cheese slice","phô mai lát"],
    "coca cola pepsi":["coca","coca cola","coke","pepsi","cola"],
    "bo huc red bull":["bò húc","red bull","nước tăng lực bò húc"],
    "lipton ice tea":["lipton","lipton iced tea","lipton ice tea","trà lipton đóng chai"],
    "quarter pounder with cheese":["quarter pounder","quarter powder","quarter pounder cheese"],
    "filet o fish":["filet o fish","fillet o fish","filet-o-fish"],
    "pizza bbq chicken":["bbq chicken pizza","pizza gà bbq","barbecue chicken pizza"],
    "pizza pho mai":["cheese pizza","pizza cheese"],
    "pizza bo bam":["beef pizza","minced beef pizza","ground beef pizza"],
    "tteokbokki":["tokbokki","bánh gạo cay hàn quốc","bánh gạo hàn quốc"],
    "com gao trang":["cơm trắng","cơm","cơm gạo trắng","cooked white rice"],
    "dau hu non":["đậu phụ non","đậu hũ non","tàu hũ non","silken tofu"],
    "thit than heo":["thịt heo nạc","thịt lợn nạc","thịt heo thăn","thịt lợn thăn","pork tenderloin","pork loin"]
  };
  /* V51 · English aliases for every displayed food whose catalog row had no English primary name. Parser-only: does not alter UI/catalog. */
  const V51_BILINGUAL_EN_ALIAS_ROWS = [["Thịt cua/ghẹ",["crab and blue crab meat","mixed crab meat"]],["Ức gà phi lê không da",["skinless boneless chicken breast","raw skinless chicken breast","chicken breast fillet"]],["Cá điêu hồng",["red tilapia","red tilapia fillet"]],["Tép",["small shrimp","tiny shrimp"]],["Thịt ốc bươu",["apple snail meat","freshwater apple snail meat"]],["Thịt ốc hương",["babylon snail meat","spotted babylon snail meat"]],["Cá trắm",["grass carp","grass carp fillet"]],["Cá basa/tra phi lê",["basa fillet","pangasius fillet","swai fillet"]],["Dạ dày heo",["pork stomach","pig stomach"]],["Mực",["squid","calamari"]],["Bạch tuộc",["octopus"]],["Cá cam phi lê",["amberjack fillet","amberjack"]],["Thịt bò nạc",["lean beef","lean beef steak"]],["Vẹm",["mussels","mussel meat"]],["Thịt hàu",["oyster meat","oysters"]],["Thịt sò điệp",["scallop meat","scallops"]],["Phô mai Cottage ít béo",["low fat cottage cheese","reduced fat cottage cheese"]],["Sữa đậu nành",["soy milk","soya milk"]],["Đậu hũ non",["silken tofu","soft tofu"]],["Đùi gà phi lê không da",["skinless boneless chicken thigh","raw skinless chicken thigh","chicken thigh fillet"]],["Cá chép",["common carp","carp fillet"]],["Trứng cá",["fish roe","fish eggs"]],["Trứng vịt lộn",["balut","balut duck egg","fertilized duck egg"]],["Nhộng tằm",["silkworm pupae","silkworm pupa"]],["Cà chua",["tomato","tomatoes"]],["Nấm đùi gà",["king oyster mushroom","king trumpet mushroom"]],["Cà tím",["eggplant","aubergine"]],["Nước dừa",["coconut water"]],["Soba",["soba noodles","buckwheat noodles"]],["Udon",["udon noodles"]],["Miến",["glass noodles","cellophane noodles","mung bean vermicelli"]],["Cơm gạo lứt",["cooked brown rice","brown rice cooked"]],["Bún",["rice vermicelli","fresh rice vermicelli"]],["Phở",["pho noodles","flat rice noodles","pho rice noodles"]],["Bánh đa trắng",["white rice noodles","white banh da noodles","flat white rice noodles"]],["Bánh canh",["banh canh noodles","thick tapioca rice noodles","thick vietnamese noodles"]],["Mì",["noodles","wheat noodles"]],["Khoai môn",["taro","taro root"]],["Hạt dẻ",["chestnuts","chestnut"]],["Tteokbokki",["korean rice cakes","tteokbokki rice cakes","spicy korean rice cakes"]],["Sữa kem",["dairy cream","cream"]],["Hạt lanh",["flax seeds","flaxseed","linseed"]],["Hạt chia",["chia seeds","chia seed"]],["Hạt hướng dương",["sunflower seeds","sunflower seed"]],["Hạt dẻ cười",["pistachios","pistachio nuts"]],["Phô mai Parmesan bào",["grated parmesan cheese","shredded parmesan"]],["Thịt vịt có da",["duck meat with skin","skin on duck meat"]],["Thịt ngan có da",["muscovy duck meat with skin","skin on muscovy duck"]],["Lòng heo",["pork intestines","pig intestines","pork offal"]],["Dâu",["strawberries","strawberry"]],["Cam quýt",["citrus fruit","oranges and tangerines","orange tangerine"]],["Thanh long",["dragon fruit","pitaya"]],["Lê",["pear","pears"]],["Kiwi",["kiwi fruit","kiwifruit"]],["Cherry",["cherries","cherry fruit"]],["Mít",["jackfruit"]],["Na",["custard apple","sugar apple","sweetsop"]],["Bông cải xanh",["broccoli"]],["Bông cải trắng",["cauliflower"]],["Ngô",["corn","maize","sweet corn"]],["Thịt chim",["quail or pigeon meat","small bird meat","quail meat"]],["Phô mai regular cheese (loại phô mai vẫn cho vào burger)",["regular cheese slice","burger cheese","processed cheese slice","american cheese slice"]],["Kem",["ice cream"]],["Bánh mì baguette",["baguette","vietnamese baguette","plain baguette","plain vietnamese bread"]],["Vỏ bánh tráng",["rice paper wrapper","spring roll rice paper","rice paper sheets"]],["Đuôi bò",["oxtail","beef tail"]],["Cháo",["rice porridge","congee","plain rice porridge"]],["Việt quất",["blueberries","blueberry"]],["Phúc bồn tử",["raspberries","raspberry"]],["Mãng cầu xiêm",["soursop","guanabana"]],["Thịt nạc vai heo",["lean pork shoulder","pork shoulder"]],["Thịt ba chỉ heo",["pork belly","pork belly slices"]],["Thịt ba chỉ bò",["beef belly","beef short plate"]],["Nấm kim châm",["enoki mushroom","enoki mushrooms"]],["Nấm mỡ",["button mushroom","white mushroom"]],["Mộc nhĩ",["wood ear mushroom","black fungus","wood ear fungus"]],["Dầu hào",["oyster sauce"]],["Sữa đặc",["sweetened condensed milk","condensed milk"]],["Bánh đúc",["vietnamese rice flour cake","banh duc","savory rice flour cake"]],["Hạt thốt nốt",["palmyra palm seeds","palm fruit seeds","toddy palm seeds"]],["Đậu phụ",["firm tofu","tofu","bean curd"]],["Cơm gạo trắng",["cooked white rice","white rice cooked","steamed white rice"]],["Xôi trắng",["cooked sticky rice","glutinous rice","sticky rice"]],["Cốm",["green rice flakes","young green rice flakes","vietnamese green rice flakes"]],["Xôi cốm",["sticky rice with green rice flakes","green rice sticky rice"]],["Xôi khúc",["xoi khuc","mung bean pork sticky rice dumpling","sticky rice dumpling with mung bean and pork"]],["Xôi lạc",["peanut sticky rice","sticky rice with peanuts"]],["Xôi đỗ xanh",["mung bean sticky rice","sticky rice with mung beans"]],["Xôi đỗ đen",["black bean sticky rice","sticky rice with black beans"]],["Bánh bao chay",["vegetarian steamed bun","vegetable bao","veggie bao"]],["Bánh dày",["banh day","vietnamese glutinous rice cake","round glutinous rice cake"]],["Tortilla",["tortilla flatbread","tortilla wrap"]],["Bánh mì naan",["naan bread","naan"]],["Cá bò khô",["dried leatherjacket fish","dried filefish"]],["Cá chỉ vàng khô",["dried yellowstripe scad","dried yellow stripe scad"]],["Mực khô",["dried squid"]],["Tép khô",["dried small shrimp","dried tiny shrimp"]],["Tôm khô",["dried shrimp","dried shrimps"]],["Cá cơm khô",["dried anchovy","dried anchovies"]],["Đậu nành",["raw soybeans","dry soybeans","soybeans raw"]],["Đậu đỏ",["raw red beans","dry red beans","adzuki beans raw"]],["Đậu đen",["raw black beans","dry black beans","black beans raw"]],["Đậu xanh",["raw mung beans","dry mung beans","mung beans raw"]],["Đậu trắng",["raw white beans","dry white beans","white beans raw"]],["Đậu Hà Lan",["raw green peas","dry peas","green peas raw"]],["Đậu gà",["raw chickpeas","dry chickpeas","chickpeas raw"]],["Đậu lăng",["raw lentils","dry lentils","lentils raw"]],["Hạt đác",["attap seeds","nipa palm seeds","nipa palm fruit"]],["Hạt vừng",["sesame seeds","sesame seed"]],["Kem vani",["vanilla ice cream"]],["Bánh cheesecake",["cheesecake","cheese cake"]],["Bánh flan caramen",["caramel flan","creme caramel","caramel custard"]],["Crème brûlée",["creme brulee","crème brûlée"]],["Bánh croissant",["croissant","butter croissant"]],["Bánh Mexican bun",["mexican bun","mexican coffee bun","coffee bun"]],["Bánh cinnamon swirl",["cinnamon swirl","cinnamon swirl pastry"]],["Bánh bông lan",["sponge cake","vietnamese sponge cake"]],["Bánh su kem",["cream puff","choux cream","profiterole"]],["Bánh mochi",["mochi","mochi cake"]],["Bánh quy bơ",["butter cookies","butter cookie"]],["Bánh Chocopie",["choco pie","chocopie"]],["Bánh macaron",["macaron","french macaron"]],["Bánh donut",["donut","doughnut"]],["Bánh tiramisu",["tiramisu","tiramisu cake"]],["Bánh muffin",["muffin","muffins"]],["Bánh pancake",["pancake","pancakes"]],["Bánh táo",["apple cake","apple pie"]],["Bánh pía",["pia cake","vietnamese pia cake","durian mung bean pastry"]],["Bánh cốm",["green rice cake","vietnamese green rice cake"]],["Bánh bò",["vietnamese honeycomb cake","honeycomb cake","banh bo"]],["Bánh trung thu",["mooncake","moon cake"]],["Chè khúc bạch",["khuc bach sweet soup","almond panna cotta dessert soup","khuc bach dessert"]],["Chè đỗ đen",["black bean sweet soup","black bean dessert soup"]],["Chè bà cốt",["glutinous rice ginger sweet soup","sticky rice molasses sweet soup"]],["Chè bưởi",["pomelo sweet soup","pomelo dessert soup"]],["Chè sen long nhãn",["lotus seed longan sweet soup","longan lotus seed dessert"]],["Thạch găng",["vietnamese green jelly","green jelly vietnam"]],["Thạch đen",["black grass jelly","grass jelly","black jelly"]],["Cơm cháy chà bông",["crispy rice with pork floss","scorched rice with pork floss"]],["Nộm bò khô",["green papaya salad with dried beef","dried beef papaya salad"]],["Bánh bột lọc",["tapioca dumpling","vietnamese tapioca dumpling"]],["Bánh xèo",["vietnamese sizzling pancake","vietnamese crispy pancake","banh xeo"]],["Bánh bèo Hải Phòng",["hai phong steamed rice cake","hai phong banh beo"]],["Bánh khoái tép",["crispy shrimp pancake","shrimp banh khoai","vietnamese shrimp pancake"]],["Bánh xíu páo Nam Định",["nam dinh xiu pao pastry","xiu pao pastry","nam dinh pork pastry"]],["Bánh nhãn Hải Hậu",["hai hau fried glutinous rice balls","hai hau banh nhan"]],["Mít sấy",["dried jackfruit","jackfruit chips"]],["Chuối sấy",["dried banana","banana chips"]],["Khoai sấy",["dried sweet potato chips","dried root vegetable chips"]],["Ngô sấy",["dried corn","roasted dried corn","corn snacks"]],["Nấm hương sấy lạnh",["freeze dried shiitake mushroom","cold dried shiitake mushroom"]],["Thịt bò khô (đã tẩm ướp)",["seasoned dried beef","beef jerky","seasoned beef jerky"]],["Gà khô (đã tẩm ướp)",["seasoned dried chicken","chicken jerky","seasoned chicken jerky"]],["Heo khô (đã tẩm ướp)",["seasoned dried pork","pork jerky","seasoned pork jerky"]],["Nem chua",["vietnamese fermented pork roll","fermented pork roll"]],["Bỏng ngô",["popcorn","plain popcorn"]],["Caramel popcorn",["caramel popcorn","caramel corn"]],["Bột matcha",["matcha powder","green tea powder"]],["Dầu mè",["sesame oil"]],["Bia lager",["lager beer","beer lager"]],["Rượu vang đỏ",["red wine"]],["Rượu mạnh",["spirits","distilled spirits","liquor"]],["Strongbow cider",["strongbow cider","strongbow"]],["Bò Húc / Red Bull",["red bull","red bull energy drink","energy drink red bull"]],["Coca-Cola / Pepsi",["coca cola","coke","pepsi","cola"]],["Coca-Cola / Pepsi Zero",["coke zero","coca cola zero","pepsi zero","zero sugar cola"]],["Trà sữa",["milk tea","bubble tea","boba tea"]],["Nước mía",["sugarcane juice","sugar cane juice"]],["Lipton Ice Tea",["lipton iced tea","lipton ice tea"]],["Mì Ý bò bằm",["spaghetti bolognese","minced beef spaghetti","ground beef pasta"]],["Mì Ý sốt kem",["creamy pasta","cream sauce pasta","pasta alfredo"]],["Vịt quay",["roast duck","roasted duck","peking duck"]],["Ngan cháy tỏi",["garlic fried muscovy duck","garlic roasted muscovy duck","garlic duck"]],["Chim quay",["roast quail","roasted quail","roasted bird"]],["Lòng rán",["fried pork intestines","fried pork offal","fried intestines"]],["Bánh rán ngọt",["sweet fried glutinous rice ball","vietnamese sweet donut","sweet sesame ball"]],["Bánh rán mặn",["savory fried glutinous rice ball","vietnamese savory donut","savory rice ball"]],["Pa tê",["pate","pâté","pork liver pate"]],["Khoai tây chiên",["french fries","fries"]],["Khoai lang chiên",["sweet potato fries","fried sweet potato"]],["Bò bít tết",["beef steak","steak"]],["Nem thính",["pork skin with roasted rice powder","pork skin rice powder salad"]],["Nem tai",["pork ear with roasted rice powder","vietnamese pork ear nem","pork ear salad"]],["Nem rán",["fried spring roll","fried spring rolls","vietnamese egg roll"]],["Nem cuốn",["fresh spring roll","vietnamese summer roll","summer roll"]],["Bánh cuốn nhân",["filled steamed rice rolls","pork filled rice rolls","banh cuon with pork"]],["Bánh cuốn chay",["vegetarian steamed rice rolls","vegetarian banh cuon"]],["Bánh Tôm Hồ Tây",["west lake shrimp cake","hanoi shrimp fritter","west lake shrimp fritter"]],["Bánh chuối chiên",["fried banana fritter","banana fritter"]],["Phở bò",["beef pho","beef pho noodle soup","pho with beef"]],["Phở gà",["chicken pho","chicken pho noodle soup","pho with chicken"]],["Bún ngan",["muscovy duck rice vermicelli soup","duck rice vermicelli soup"]],["Bún mắm",["fermented fish noodle soup","vietnamese fermented fish noodle soup"]],["Bún bò Huế",["hue spicy beef noodle soup","hue beef noodle soup","spicy beef noodle soup"]],["Bánh đa cua",["crab red noodle soup","crab rice noodle soup"]],["Bún tôm",["shrimp rice vermicelli soup","shrimp noodle soup"]],["Bún cá",["fish noodle soup","fish rice noodle soup"]],["Bánh canh ghẹ",["crab thick noodle soup","blue crab thick noodle soup"]],["Hủ tiếu",["hu tieu noodle soup","southern vietnamese noodle soup"]],["Mì Quảng",["quang noodles","quang style turmeric noodles","mi quang"]],["Mì vằn thắn",["wonton egg noodle soup","wonton noodle soup"]],["Miến lươn",["eel glass noodle soup","eel vermicelli soup"]],["Gà rán KFC",["kfc fried chicken","kfc chicken"]],["Big Mac",["big mac"]],["Quarter Pounder with Cheese",["quarter pounder with cheese","quarter pounder cheese"]],["Filet-O-Fish",["filet o fish","fillet o fish"]],["McChicken",["mcchicken"]],["Whopper",["whopper"]],["Whopper Cheese",["whopper cheese","cheese whopper"]],["Double Whopper",["double whopper"]],["Double Whopper Cheese",["double whopper cheese"]],["Pizza BBQ chicken",["bbq chicken pizza","barbecue chicken pizza"]],["Pizza phô mai",["cheese pizza","pizza cheese"]],["Pizza bò bằm",["minced beef pizza","ground beef pizza","beef pizza"]]];
  const V51_BILINGUAL_EN_ALIASES = new Map(V51_BILINGUAL_EN_ALIAS_ROWS.map(([name,aliases])=>[normalizePhrase(name),aliases]));
  /* V56 · Lớp alias song ngữ bổ sung. Mục tiêu: mọi tên đang hiện trong menu Thực phẩm đều nhận được cả tiếng Việt lẫn tiếng Anh;
     đồng thời hỗ trợ các tên tiếng Anh ngắn thường nhập trong Excel như bacon, mushroom, ham, sausage, salami. */
  const V56_BILINGUAL_EN_ALIAS_ROWS = [["Tôm bóc vỏ",["peeled shrimp","peeled shrimps","peeled prawn","peeled prawns","shrimp meat"]],["Thịt bề bề",["mantis shrimp meat","peeled mantis shrimp"]],["Cá ngừ phi lê",["tuna fillet","tuna fillets","raw tuna fillet"]],["Cá rô phi phi lê",["tilapia fillet","tilapia fillets","raw tilapia fillet"]],["Cá lăng phi lê",["hemibagrus catfish fillet","catfish fillet","lang fish fillet"]],["Cá thu phi lê",["mackerel fillet","mackerel fillets","raw mackerel fillet"]],["Mussels (vẹm)",["mussels","mussel","mussel meat"]],["Sữa chua Hy Lạp",["greek yogurt","greek yoghurt"]],["Ham (giăm bông)",["ham","pork ham","sliced ham"]],["Trứng gà nguyên quả",["whole egg","whole chicken egg","chicken egg","eggs"]],["Cá hồi phi lê",["salmon fillet","salmon fillets","raw salmon fillet"]],["Thịt bò khô",["dried beef","beef jerky"]],["Gà khô",["dried chicken","chicken jerky"]],["Chà bông",["pork floss","meat floss","pork rousong"]],["Lentils (đậu lăng)",["lentils","lentil"]],["Bánh đa đỏ",["red rice noodles","red rice noodle","red banh da noodles"]],["Cơm trắng",["cooked white rice","steamed white rice","white rice cooked"]],["Sắn dẻo",["chewy cassava","dried chewy cassava","soft dried cassava"]],["Butter (bơ động vật)",["butter","dairy butter"]],["Hạt flax (hạt lanh)",["flaxseed","flax seeds","linseed"]],["Almond (hạnh nhân)",["almond","almonds"]],["Cashew (hạt điều)",["cashew","cashews","cashew nuts"]],["Bacon",["bacon","pork bacon","streaky bacon"]],["Pate gan",["liver pate","liver pâté","pork liver pate"]],["Phô mai Cheddar",["cheddar cheese","cheddar"]],["Phô mai Mozzarella",["mozzarella cheese","mozzarella"]],["Cánh gà có da",["chicken wings with skin","skin on chicken wings","chicken wing"]],["Bì heo",["pork skin","pig skin","pork rind"]],["Melon (dưa lưới)",["melon","cantaloupe","muskmelon"]],["Khoai môn sấy",["dried taro","taro chips","dried taro chips"]],["Bánh Mexican coffee bun",["mexican coffee bun","coffee bun","roti boy"]],["Bánh Katka Hải Phòng",["hai phong katka cake","katka cake"]],["Donut",["donut","doughnut"]],["Apple pie",["apple pie"]],["Cookies",["cookies","cookie"]],["Muffin",["muffin","muffins"]],["Cheese cake",["cheesecake","cheese cake"]],["Hash brown",["hash brown","hash browns"]],["Khoai tây với gravy",["mashed potatoes with gravy","potatoes with gravy"]],["Coleslaw",["coleslaw","cabbage slaw"]],["Chè sắn",["cassava sweet soup","cassava dessert soup"]],["Xôi nếp",["sticky rice","glutinous rice"]],["Xôi đỗ",["bean sticky rice","sticky rice with beans"]],["Xôi ngô",["corn sticky rice","sticky rice with corn"]],["Xôi gấc",["gac sticky rice","red gac sticky rice"]],["Lạp xưởng",["chinese sausage","chinese pork sausage","lap cheong","lap chong"]],["Xúc xích Đức",["german sausage","bratwurst","german bratwurst"]],["KFC chicken",["kfc chicken","kfc fried chicken"]],["Hamburger",["hamburger","beef burger","burger"]],["Bánh mì sandwich",["sandwich bread","sliced sandwich bread"]],["Wholewheat pasta",["wholewheat pasta","whole wheat pasta"]],["Pasta",["pasta"]],["Vỏ tortilla",["tortilla wrap","tortilla shell","tortilla wrapper"]],["Naan bread",["naan","naan bread"]],["Quẩy",["chinese fried dough","youtiao","fried dough stick"]],["Tiết luộc",["boiled pork blood","pork blood pudding","boiled blood curd"]],["Bún riêu",["bun rieu","crab noodle soup","vietnamese crab noodle soup"]],["Cơm tấm sườn bì trứng",["broken rice with pork chop pork skin and egg","com tam pork chop egg"]],["Bánh khoai",["sweet potato fritter","fried sweet potato fritter"]],["Bánh chuối",["banana fritter","fried banana fritter"]],["Gân bò",["beef tendon"]],["Bì bò",["beef skin","beef hide"]],["Giò lụa",["vietnamese pork sausage","pork silk sausage","cha lua"]],["Giò bò",["vietnamese beef sausage","beef sausage","beef cha lua"]],["Chả cá",["fish cake","vietnamese fish cake"]],["Mayonnaise",["mayonnaise","mayo"]],["Bơ đậu phộng",["peanut butter"]],["Bơ thực vật",["margarine"]],["Chấm chao",["fermented tofu dipping sauce","fermented bean curd sauce"]],["Bún bò Nam Bộ",["bun bo nam bo","southern vietnamese beef noodle salad","beef vermicelli salad"]],["Nem chua rán",["fried fermented pork roll","fried nem chua"]],["Nem Phùng",["nem phung","phung pork skin salad","vietnamese pork skin with roasted rice powder"]],["Nấm mỡ",["mushroom","mushrooms","button mushroom","button mushrooms","white mushroom","white mushrooms","champignon"]],["Nấm hương",["shiitake mushroom","shiitake mushrooms","shiitake"]],["Nấm rơm",["straw mushroom","straw mushrooms"]],["Nấm đùi gà",["king oyster mushroom","king oyster mushrooms","king trumpet mushroom"]],["Nấm kim châm",["enoki mushroom","enoki mushrooms","enoki"]],["Mộc nhĩ",["wood ear mushroom","wood ear mushrooms","black fungus"]],["Mướp đắng",["bitter melon","bitter gourd","balsam pear"]],["Xúc xích",["sausage","sausages","pork sausage","german sausage","bratwurst"]],["Ham",["ham","pork ham","sliced ham","cooked ham"]],["Đùi heo muối (Prosciutto)",["prosciutto","prosciutto ham","dry cured ham","italian ham"]],["Salami",["salami","dry salami","italian salami","cured sausage"]]];
  const V56_BILINGUAL_EN_ALIASES = new Map(V56_BILINGUAL_EN_ALIAS_ROWS.map(([name,aliases])=>[normalizePhrase(name),aliases]));
  /* V57 · Alias song ngữ khóa cứng cho các món mới và các cách gọi Excel phổ biến. */
  const V57_BILINGUAL_EN_ALIAS_ROWS = [
    ["Tóp mỡ chiên",["pork cracklings","fried pork cracklings","fried pork fat","pork fat cracklings"]],
    ["Bánh gạo",["rice cake","rice cake cracker","rice cracker","plain rice cake snack"]],
    ["Bưởi",["pomelo","pummelo","shaddock"]],
    ["Súp kem bí đỏ",["creamy pumpkin soup","pumpkin cream soup","cream of pumpkin soup"]]
  ];
  const V57_BILINGUAL_EN_ALIASES = new Map(V57_BILINGUAL_EN_ALIAS_ROWS.map(([name,aliases])=>[normalizePhrase(name),aliases]));
  /* V51: chặn một số alias cũ bị gộp nhầm giữa hai thực phẩm khác nhau. */
  const V51_BLOCKED_ALIASES = new Map([
    ["thit bo nac",["beef steak","beef"]],
    ["mi",["bun chin"]],
    ["pho mai regular cheese loai pho mai van cho vao burger",["cheese cake"]],
    ["bo bit tet",["thit bo nac","lean beef","bo nac","beef"]]
  ]);
  let AUTHORITATIVE_FOOD_DB_V50_CACHE=null;
  let catalogPeersV66=null, legacyAliasesV66=null;
  function prepareCatalogIndexesV66(){
    if(catalogPeersV66)return;
    catalogPeersV66=new Map();legacyAliasesV66=new Map();
    for(const peer of UNIFIED_FOOD_CATALOG){
      const key=catalogIdentity(peer);
      if(!catalogPeersV66.has(key))catalogPeersV66.set(key,[]);
      catalogPeersV66.get(key).push(peer);
    }
    baseFoodsV50().forEach((food,order)=>{
      const roots=[food.name,food.en,...(food.aliases||[])].filter(Boolean);
      const entry={food,roots,order};
      for(const key of new Set(roots.map(normalizePhraseAccentV51).filter(Boolean))){
        if(!legacyAliasesV66.has(key))legacyAliasesV66.set(key,[]);
        legacyAliasesV66.get(key).push(entry);
      }
    });
  }
  /* V68: bí danh một chữ và tên gọi đời thường. Phải là alias "hạng nhất" (có dấu)
     thì luật dấu mới bảo vệ được: "bò" khớp Thịt bò, còn "bơ" thì không. */
  const V68_EXTRA_ALIASES = new Map(Object.entries({
    "thịt bò":["bò","beef"],
    "thịt lợn":["lợn","heo"],
    "thịt gà":["gà"],
    "kem":["kem tràng tiền","kem ốc quế","kem que","kem ly","kem hộp","ice cream cone"],
    "bánh flan caramen":["caramen","ca ra men","kem flan","flan","bánh caramen"],
    "cà phê sữa":["nâu đá","nâu nóng","cà phê nâu","cafe sữa","cafe sữa đá","cà phê sữa đá"],
    "dồi lợn":["dồi","dồi heo","dồi trường"],
    "trà sữa":["trà sữa trân châu","trà sữa chân trâu","trà sữa full topping","milk tea boba","bubble tea"],
    "coca-cola / pepsi":["coca","coke","cola","pepsi","coca cola","nước có ga"],
    "nước lọc":["nước","nuoc loc"],
    "cơm gạo trắng":["cơm","cơm trắng"],
    "mì ăn liền":["mì tôm","mỳ tôm","mì gói","úp mì"],
    "sữa chua có đường":["sữa chua"],
    "quả bơ":["bơ","trái bơ"],
    "tôm bóc vỏ":["tôm"],
    "trứng gà nguyên quả":["trứng","trứng gà"]
  }));

  function aliasVariantsV50(name="") {
    const out=new Set(), add=(x)=>{x=String(x||"").trim();if(x)out.add(x);};
    add(name);
    add(String(name).replace(/\s*\([^)]*\)\s*/g," ").replace(/\s+/g," ").trim());
    const replacements=[
      [/mì/gi,"mỳ"],[/mỳ/gi,"mì"],[/bánh mì/gi,"bánh mỳ"],[/bánh mỳ/gi,"bánh mì"],
      [/heo/gi,"lợn"],[/lợn/gi,"heo"],[/đậu hũ/gi,"đậu phụ"],[/đậu phụ/gi,"đậu hũ"],
      [/phô mai/gi,"pho mai"],[/caramen/gi,"caramel"]
    ];
    [...out].forEach((base)=>replacements.forEach(([re,to])=>add(base.replace(re,to))));
    (V50_EXPLICIT_ALIASES[normalizePhrase(name)]||[]).forEach(add);
    (V68_EXTRA_ALIASES.get(String(name).toLowerCase().normalize("NFC").trim())||[]).forEach(add);
    (V51_BILINGUAL_EN_ALIASES.get(normalizePhrase(name))||[]).forEach(add);
    (V56_BILINGUAL_EN_ALIASES.get(normalizePhrase(name))||[]).forEach(add);
    (V57_BILINGUAL_EN_ALIASES.get(normalizePhrase(name))||[]).forEach(add);
    return [...out];
  }
  function basisAmountV50(text="") {
    const basis=normalizePhrase(text);
    const g=basis.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*g\b/);
    const ml=basis.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*ml\b/);
    /* V68: "1 suất · 5 cái · 175 g" nghĩa là một cái nặng 35 g, không phải 175 g.
       Không đọc con số này thì "2 cái nem rán" bị tính thành 2 suất (gấp 5 lần). */
    const pieces=basis.match(/(?:^|\s)(\d+)\s*(?:cai|chiec|mieng|vien|cuon|qua|trai|lat)\b/);
    return {
      grams:g?Number(g[1].replace(",",".")):null,
      ml:ml?Number(ml[1].replace(",",".")):null,
      pieces:pieces?Number(pieces[1]):null,
      basis
    };
  }
  function safeAliasEqualV51(a,b){
    const aa=normalizePhraseAccentV51(a), bb=normalizePhraseAccentV51(b);
    if(!aa||!bb)return false;
    if(aa===bb)return true;
    const an=normalizePhrase(a), bn=normalizePhrase(b);
    const aAccent=aa!==an, bAccent=bb!==bn;
    return !aAccent&&!bAccent&&an===bn;
  }
  function catalogItemToParserV50(item) {
    const name=canonicalCatalogName(item), info=basisAmountV50(item.subtitle||""), kcal=Number(item.kcal), protein=Number(item.protein), carbs=Number(item.carb), fat=Number(item.fat);
    const bilingualAliases=V51_BILINGUAL_EN_ALIASES.get(normalizePhrase(name))||[];
    const bilingualAliasesV56=V56_BILINGUAL_EN_ALIASES.get(normalizePhrase(name))||[];
    const bilingualAliasesV57=V57_BILINGUAL_EN_ALIASES.get(normalizePhrase(name))||[];
    const aliases=new Set(aliasVariantsV50(name));
    [item.name,item.originalName].filter(Boolean).forEach((x)=>aliasVariantsV50(x).forEach((a)=>aliases.add(a)));
    /* V56: nếu cùng thực phẩm còn tồn tại ở một CSDL nội bộ khác với tên tiếng Anh chính thức, gom tên đó vào alias.
       Điều này tránh việc bản tiếng Việt thắng khi de-duplicate làm mất tên English của cùng món. */
    const itemIdentity=catalogIdentity(item);
    prepareCatalogIndexesV66();
    for(const peer of catalogPeersV66.get(itemIdentity)||[]){
      if(peer===item)continue;
      [peer.originalName,peer.name].filter(Boolean).forEach((x)=>{
        const normalized=normalizePhrase(x);
        if(/[a-z]/.test(normalized) && !/[à-ỹđ]/i.test(String(x))) aliasVariantsV50(x).forEach((a)=>aliases.add(a));
      });
    }
    const canonical=normalizePhrase(name);
    let matchingLegacyFood=null;
    const matchingEntries=new Set();
    for(const alias of aliasVariantsV50(name)){
      for(const entry of legacyAliasesV66.get(normalizePhraseAccentV51(alias))||[])matchingEntries.add(entry);
    }
    for(const entry of [...matchingEntries].sort((a,b)=>a.order-b.order)){
      if(!matchingLegacyFood)matchingLegacyFood=entry.food;
      entry.roots.forEach(x=>aliases.add(x));
    }
    const blockedAliases=new Set((V51_BLOCKED_ALIASES.get(canonical)||[]).map(normalizePhrase));
    if(blockedAliases.size) for(const alias of [...aliases]) if(blockedAliases.has(normalizePhrase(alias))) aliases.delete(alias);
    const food={
      id:`authority_v50_${String(item.id||canonical).replace(/[^a-z0-9_]+/gi,"_")}`,
      name,en:item.originalName||bilingualAliases[0]||bilingualAliasesV56[0]||bilingualAliasesV57[0]||"",aliases:[...aliases],priority:1000000,
      source:`Nguồn chuẩn V50 · đồng bộ trực tiếp với bảng Thực phẩm · ${item.source||"dữ liệu nội bộ"}`,
      rangePct:/restaurant|snacks|fastfood|sweet-cakes|dessert/.test(item._catalogClass?.group||"")?0.18:0.08,
      authoritativeV50:true,
      /* V51: giữ nguyên toàn bộ chuỗi tên/alias gốc của chính dòng đang hiển thị để nhận diện song ngữ Excel. */
      catalogAliasText:[name,item.name,item.originalName,...bilingualAliases,...bilingualAliasesV56,...bilingualAliasesV57,Array.isArray(item.aliases)?item.aliases.join(" "):item.aliases].filter(Boolean).join(" "),
      catalogCurated:!!(item.curatedV47||item.curatedV44),
      catalogSourceScore:catalogItemScore(item),
      defaultKcal:kcal,defaultProtein:protein,defaultCarbs:carbs,defaultFat:fat
    };
    const is100ml=/^100\s*ml\b/.test(info.basis), is100g=/^100\s*g\b/.test(info.basis);
    /* V68: "100 g" là cách chuẩn hóa bảng, KHÔNG phải khẩu phần thật.
       Bản cũ coi nó là khẩu phần nên "1 cốc sữa" chỉ được tính 100 ml thay vì 240 ml. */
    if(is100ml||is100g) food.per100Basis=true;
    if(is100ml){Object.assign(food,{per100ml:kcal,protein100ml:protein,carbs100ml:carbs,fat100ml:fat,defaultMl:100});}
    else if(is100g){Object.assign(food,{per100g:kcal,protein100g:protein,carbs100g:carbs,fat100g:fat,defaultGrams:100});}
    else if(info.ml&&info.ml>0){
      Object.assign(food,{per100ml:kcal*100/info.ml,protein100ml:protein*100/info.ml,carbs100ml:carbs*100/info.ml,fat100ml:fat*100/info.ml,defaultMl:info.ml,mlPerServing:info.ml});
    } else if(info.grams&&info.grams>0){
      Object.assign(food,{per100g:kcal*100/info.grams,protein100g:protein*100/info.grams,carbs100g:carbs*100/info.grams,fat100g:fat*100/info.grams,defaultGrams:info.grams,gramsPerServing:info.grams});
      const pieces=Number(info.pieces)||0;
      if(pieces>1){
        /* Khẩu phần gồm nhiều cái: chia ra khối lượng từng cái. */
        food.gramsPerPiece=info.grams/pieces;
        food.gramsPerUnit=info.grams/pieces;
        food.piecesPerServing=pieces;
      } else if(/\b(?:cai|chiec|mieng|vien|cuon|qua|trai|con|chai|lat|o)\b/.test(info.basis)){
        food.gramsPerUnit=info.grams;
      } else {
        food.gramsPerPortion=info.grams;
      }
    }
    /* V64: bảng hiển thị thường ghi dinh dưỡng/100 g nhưng vẫn phải giữ khối lượng
       của từng quả/cái từ hồ sơ món tương ứng (vd. 1 trứng = 50 g, không phải 100 g). */
    if(is100g&&matchingLegacyFood){
      for(const field of ["gramsPerUnit","gramsPerPiece","gramsPerBite"]){
        const value=Number(matchingLegacyFood[field]);
        if(Number.isFinite(value)&&value>0) food[field]=value;
      }
    }
    /* Khóa đúng đơn vị khẩu phần ghi trên bảng. */
    if(/\b(?:bat|to)\b/.test(info.basis)) food.perBowl=kcal;
    if(/\b(?:coc|ly)\b/.test(info.basis)) food.perCup=kcal;
    if(/\blon\b/.test(info.basis)) food.perCan=kcal;
    if(/\b(?:goi)\b/.test(info.basis)) food.perPack=kcal;
    if(/\blat\b/.test(info.basis)) food.perSlice=kcal;
    if(/\b(?:suat|phan|dia)\b/.test(info.basis)) { food.perPortion=kcal; if(info.grams>0) food.gramsPerPortion=info.grams; }
    if(/\b(?:cai|chiec|mieng|vien|cuon|con|chai|chen)\b/.test(info.basis)) food.perUnit=kcal;
    if(Number.isFinite(food.piecesPerServing)&&food.piecesPerServing>1){
      /* Suất nhiều cái: perUnit phải là một cái, không phải cả suất. */
      food.perUnit=kcal/food.piecesPerServing;
      food.perPiece=food.perUnit;
    } else if(!Number.isFinite(food.perUnit)&&!Number.isFinite(food.perPortion)&&!Number.isFinite(food.perBowl)&&!Number.isFinite(food.perCup)&&!is100g&&!is100ml) food.perUnit=kcal;
    return food;
  }
  function getAuthoritativeFoodDbV50(){
    if(AUTHORITATIVE_FOOD_DB_V50_CACHE)return AUTHORITATIVE_FOOD_DB_V50_CACHE;
    const supported=new Set(FOOD_MAIN_GROUPS.map((g)=>g.key)), unique=new Map();
    UNIFIED_FOOD_CATALOG.filter(hasAllMacros).forEach((raw)=>{
      const classification=classifyCatalogItem(raw), item={...raw,_catalogClass:classification};
      if(!classification||!supported.has(classification.group)||!isRawCatalogIngredient(item,classification))return;
      const key=catalogIdentity(item);if(!key)return;
      unique.set(key,unique.has(key)?chooseCatalogItem(unique.get(key),item):item);
    });
    AUTHORITATIVE_FOOD_DB_V50_CACHE=[...unique.values()].map(catalogItemToParserV50);
    return AUTHORITATIVE_FOOD_DB_V50_CACHE;
  }

  /* =================== V68 · BỔ SUNG CSDL MÓN CÒN THIẾU ===================
     Các món dưới đây xuất hiện thường xuyên trong thực tế nhưng chưa có trong bảng,
     nên trước đây bị đánh dấu "chưa nhận diện" và kéo cả ngày ra khỏi phép tính.
     Giá trị là mức tham chiếu trung bình; món nấu ngoài hàng luôn dao động theo
     lượng dầu, topping và cỡ suất. */
  const CURATED_CATALOG_V68 = [
    /* Nước và đồ uống — tính theo 100 ml */
    curatedCatalogFood("nuoc_loc","Nước lọc","drinks",0,0,0,0,"100 ml","💧","nước suối nước khoáng nước tinh khiết nước đun sôi nước lọc water mineral water drinking water plain water","water"),
    curatedCatalogFood("tra_khong_duong","Trà xanh không đường","drinks",1,0,0.2,0,"100 ml","🍵","trà trà đá trà nóng trà xanh nước trà trà mạn green tea tea iced tea unsweetened tea","tea"),
    curatedCatalogFood("nuoc_chanh","Nước chanh đường","drinks",30,0.1,7.5,0,"100 ml","🍋","nước chanh chanh đường lemonade lemon juice drink","juice"),
    curatedCatalogFood("nuoc_cam_vat","Nước cam vắt","drinks",45,0.7,10.4,0.2,"100 ml","🍊","nước ép cam nước cam orange juice fresh orange juice","juice"),
    curatedCatalogFood("sinh_to_bo","Sinh tố bơ","drinks",360,5.4,36,22.5,"1 cốc · 300 ml","🥑","sinh tố bơ sữa avocado smoothie avocado shake","smoothie"),
    curatedCatalogFood("sinh_to_xoai","Sinh tố xoài","drinks",255,3.6,54,3.6,"1 cốc · 300 ml","🥭","sinh tố xoài mango smoothie mango shake","smoothie"),
    curatedCatalogFood("bac_xiu","Bạc xỉu","drinks",220,5,34,7,"1 cốc · 200 ml","☕","bạc xỉu bac xiu cà phê sữa nhiều sữa vietnamese white coffee","coffee"),
    curatedCatalogFood("nuoc_tang_luc","Nước tăng lực","drinks",45,0,11,0,"100 ml","⚡","sting redbull red bull bò húc number one energy drink nước tăng lực","soft-drink"),

    /* Gia vị — tính theo 100 g */
    curatedCatalogFood("muoi_an","Muối","seasoning",0,0,0,0,"100 g","🧂","muối muối ăn muối tinh muối biển salt table salt sea salt","seasoning"),
    curatedCatalogFood("hat_nem","Hạt nêm","seasoning",200,8,40,1,"100 g","🧂","hạt nêm bột nêm bột canh seasoning powder bouillon powder","seasoning"),
    curatedCatalogFood("tuong_ot","Tương ớt","seasoning",93,1.3,22,0.4,"100 g","🌶️","tương ớt chili sauce hot sauce sriracha","sauce"),
    curatedCatalogFood("tuong_ca","Tương cà","seasoning",100,1.3,24,0.2,"100 g","🍅","tương cà sốt cà chua ketchup tomato ketchup","sauce"),
    curatedCatalogFood("mayonnaise_v68","Mayonnaise","seasoning",680,1,1.5,75,"100 g","🥚","mayonnaise mayo sốt mayonnaise xốt mayo","sauce"),
    curatedCatalogFood("mam_tom","Mắm tôm","seasoning",80,12,3,2,"100 g","🦐","mắm tôm shrimp paste fermented shrimp paste","sauce"),
    curatedCatalogFood("giam_an","Giấm","seasoning",20,0,0.9,0,"100 g","🧴","giấm giấm gạo vinegar rice vinegar","seasoning"),

    /* Thịt, hải sản chưa có hồ sơ chung — 100 g phần ăn được, chưa chế biến */
    curatedCatalogFood("thit_lon_chung","Thịt lợn","meat",195,20,0,12,"100 g · nạc vai trung bình, sống","🐖","thịt heo thịt lợn nạc vai nạc heo pork raw pork pork shoulder","pork"),
    curatedCatalogFood("thit_ga_chung","Thịt gà","meat",143,20,0,6.5,"100 g · gà nguyên con bỏ xương, sống","🍗","gà thịt gà gà ta chicken whole chicken chicken meat","poultry"),
    curatedCatalogFood("ca_chung","Cá","fish",105,20,0,2.5,"100 g · cá nạc trung bình, sống","🐟","cá cá tươi cá nạc fish raw fish white fish","fish"),
    curatedCatalogFood("tai_heo","Tai heo luộc","meat",240,19,0,18,"100 g","🐖","tai heo tai lợn tai heo luộc pig ear boiled pig ear","offal"),
    curatedCatalogFood("doi_lon","Dồi lợn","meat",290,12,8,24,"100 g","🌭","dồi dồi lợn dồi heo dồi trường blood sausage vietnamese blood sausage","offal"),
    curatedCatalogFood("canh_ga_chien","Cánh gà chiên","meat",290,25,6,19,"100 g","🍗","cánh gà cánh gà chiên cánh gà rán chicken wings fried chicken wings","poultry"),
    curatedCatalogFood("thit_quay","Thịt quay","meat",400,22,1,34,"100 g","🥓","thịt quay heo quay thịt lợn quay roast pork crispy pork belly","pork"),
    curatedCatalogFood("gio_thu","Giò thủ","meat",290,17,1,24,"100 g","🍖","giò thủ giò xào head cheese pork head cheese","processed-meat"),
    curatedCatalogFood("ngao_hen","Ngao","fish",86,14.7,3,1,"100 g · phần thịt","🦪","ngao nghêu hến clam clams baby clam","shellfish"),
    curatedCatalogFood("hau_bien","Hàu","fish",68,7,4,2.5,"100 g · phần thịt","🦪","hàu hào oyster oysters","shellfish"),
    curatedCatalogFood("ech_thit","Ếch","fish",73,16.4,0,0.3,"100 g · phần thịt","🐸","ếch thịt ếch frog frog legs","other-seafood"),
    curatedCatalogFood("ca_ngu_hop","Cá ngừ hộp","fish",116,26,0,1,"100 g · ngâm nước, đã ráo","🐟","cá ngừ hộp cá hộp canned tuna tuna in water tinned tuna","fish"),

    /* Rau củ — 100 g tươi */
    curatedCatalogFood("gia_do","Giá đỗ","vegetables",30,3,6,0.2,"100 g","🌱","giá giá đỗ giá đậu bean sprouts mung bean sprouts","vegetable"),
    curatedCatalogFood("cai_thia","Cải thìa","vegetables",13,1.5,2.2,0.2,"100 g","🥬","cải thìa cải chíp bok choy pak choi","vegetable"),
    curatedCatalogFood("rau_den","Rau dền","vegetables",23,2.5,4,0.3,"100 g","🥬","rau dền dền đỏ amaranth amaranth greens","vegetable"),
    curatedCatalogFood("mong_toi","Mồng tơi","vegetables",19,1.8,3.1,0.3,"100 g","🥬","mồng tơi mùng tơi malabar spinach","vegetable"),
    curatedCatalogFood("su_su","Su su","vegetables",19,0.8,4.5,0.1,"100 g","🥒","su su quả su su chayote","vegetable"),
    curatedCatalogFood("bi_xanh","Bí xanh","vegetables",13,0.4,3,0.2,"100 g","🥒","bí xanh bí đao winter melon wax gourd","vegetable"),
    curatedCatalogFood("dau_bap","Đậu bắp","vegetables",33,1.9,7.5,0.2,"100 g","🥬","đậu bắp mướp tây okra lady finger","vegetable"),

    /* Món ăn hằng ngày */
    curatedCatalogFood("sushi_suat","Sushi","restaurant",350,12,65,3,"1 suất · 8 miếng · 250 g","🍣","sushi cơm cuộn sushi roll maki nigiri","japanese"),
    curatedCatalogFood("mi_cay","Mì cay","restaurant",650,28,80,24,"1 bát · 600 g","🍜","mì cay mì cay hàn quốc spicy noodles korean spicy ramen","noodle-soup"),
    curatedCatalogFood("banh_mi_bo_kho","Bánh mì bò kho","restaurant",620,30,68,24,"1 suất · 450 g","🥖","bánh mì bò kho bò kho bánh mì beef stew with bread","bread-dish"),
    curatedCatalogFood("bo_kho","Bò kho","restaurant",320,26,10,19,"1 bát · 300 g","🍲","bò kho thịt bò kho vietnamese beef stew braised beef","stew"),
    curatedCatalogFood("xoi_xeo","Xôi xéo","starch",290,6.5,45,9,"100 g","🍙","xôi xéo xôi đỗ hành phi sticky rice mung bean fried shallot","rice"),
    curatedCatalogFood("xoi_ga","Xôi gà","starch",250,10,38,6,"100 g","🍙","xôi gà sticky rice with chicken","rice"),
    curatedCatalogFood("banh_goi","Bánh gối","snacks",260,8,26,14,"1 cái · 90 g","🥟","bánh gối bánh quai vạc fried dumpling vietnamese empanada","fried-snack"),
    curatedCatalogFood("canh_cua","Canh cua rau đay","restaurant",90,8,6,4,"1 bát · 250 g","🍲","canh cua canh cua rau đay crab soup vietnamese crab soup","soup"),
    curatedCatalogFood("canh_rau_ngot","Canh rau ngót","restaurant",45,4,4,1.5,"1 bát · 250 g","🍲","canh rau ngót canh rau sweet leaf soup vegetable soup","soup"),
    curatedCatalogFood("banh_mi_trung","Bánh mì trứng","restaurant",380,14,48,14,"1 cái · 180 g","🥖","bánh mì trứng bánh mì ốp la banh mi with egg egg banh mi","bread-dish"),
    curatedCatalogFood("banh_mi_cha","Bánh mì chả","restaurant",450,16,55,18,"1 cái · 200 g","🥖","bánh mì chả bánh mì pate chả banh mi with pork roll","bread-dish"),
    curatedCatalogFood("banh_mi_den","Bánh mì đen","starch",250,9,42,3.5,"100 g","🍞","bánh mì đen bánh mì nguyên cám rye bread wholemeal bread whole wheat bread","bread"),
    curatedCatalogFood("trung_op_la","Trứng ốp la","eggs",185,12,0.8,15,"100 g · chiên với dầu","🍳","trứng ốp la trứng chiên trứng rán fried egg sunny side up","egg-dish"),
    curatedCatalogFood("protein_shake","Protein shake","dairy",135,25.5,3.9,1.5,"1 cốc · 300 ml · whey pha nước","🥤","protein shake sữa whey lắc protein whey shake protein drink","supplement"),
    curatedCatalogFood("keo_ngot","Kẹo","sweet-cakes",390,0,97,0.2,"100 g","🍬","kẹo kẹo cứng kẹo ngọt candy hard candy sweets","candy"),
    curatedCatalogFood("tiet_canh","Tiết canh","restaurant",200,24,3,10,"1 bát · 200 g","🍲","tiết canh tiết canh vịt tiết canh lợn raw blood pudding","other"),
    curatedCatalogFood("kem_oc_que","Kem ốc quế","sweet-cakes",230,3.5,30,11,"1 cái · 100 g","🍦","kem ốc quế kem tràng tiền kem que kem ly ice cream cone soft serve","ice-cream")
  ].map((item)=>item.kcal===0?{...item,zeroCalorieV68:true}:item);
  /* Chỉ những món 0 kcal được khai báo ở đây mới được nhận diện. Nếu mở cho mọi
     dòng 0 kcal thì các dòng trống trong CSDL cũ sẽ cướp mất tên "cơm", "bơ". */

  function buildUnifiedFoodCatalog() {
    const candidates=[];
    FREQUENT_FOODS.forEach((food)=>{const x=normalizeFrequentFood(food);if(x)candidates.push(x);});
    [
      [USER_FOOD_DB_V6,"CSDL nhận diện ưu tiên"],
      [FOOD_DB,"CSDL nhận diện nền"],
      [VI_FOOD_DB_EXTRA,"CSDL món Việt"],
      [PRO_FOOD_DB_V3,"CSDL chuyên sâu V3"],
      [FOOD_DB_V4,"CSDL mở rộng V4"]
    ].forEach(([rows,source])=>rows.forEach((food)=>{const x=normalizeLegacyFood(food,source);if(x)candidates.push(x);}));
    candidates.push(...CURATED_CATALOG_V47);
    candidates.push(...CURATED_CATALOG_V68);
    /* Không gộp ở đây: lọc và chọn bản ưu tiên tại renderUnifiedFoodCatalog. */
    return candidates;
  }
  const UNIFIED_FOOD_CATALOG = buildUnifiedFoodCatalog();

  /* V47 · Nhóm nguyên liệu và nhóm món chế biến được tách riêng, không trộn lẫn. */
  const FOOD_MAIN_GROUPS = [
    {key:"meat",icon:"🥩",title:"Thịt",hue:4,note:"Thịt, nội tạng và một số thịt chế biến thường dùng. Xếp theo tỉ lệ đạm/calo."},
    {key:"fish",icon:"🐟",title:"Cá",hue:201,note:"Cá tươi tính theo 100 g phần phi lê ăn được; tôm tính theo phần đã bóc vỏ."},
    {key:"eggs",icon:"🥚",title:"Trứng",hue:48,note:"Trứng là trứng gà nguyên quả, trừ khi tên ghi rõ loại khác."},
    {key:"dairy",icon:"🥛",title:"Bơ sữa",hue:55,note:"Sữa, sữa chua, phô mai, bơ, whey và kem."},
    {key:"starch",icon:"🍚",title:"Tinh bột",hue:38,note:"Cơm, xôi, bún, phở, mì, miến, bánh nền, củ và ngũ cốc."},
    {key:"beans",icon:"🫘",title:"Đậu",hue:102,note:"Đậu phụ, đậu hũ non và hạt đậu sống/khô chưa nấu."},
    {key:"vegetables",icon:"🥬",title:"Rau củ",hue:132,note:"Rau, củ và nấm dùng hằng ngày."},
    {key:"fruit",icon:"🍎",title:"Hoa quả",hue:350,note:"Hoa quả tươi và phần ăn được."},
    {key:"nuts",icon:"🌰",title:"Hạt",hue:82,note:"Quả hạch, hạt dinh dưỡng, hạt đác và hạt thốt nốt."},
    {key:"sweet-cakes",icon:"🍰",title:"Bánh ngọt",hue:326,note:"Bánh ngọt, bánh quy, pastry, flan và crème brûlée."},
    {key:"sweet-soups",icon:"🍧",title:"Chè",hue:304,note:"Các loại chè và thạch."},
    {key:"snacks",icon:"🍿",title:"Ăn vặt",hue:22,note:"Bánh ăn vặt, món chiên nhẹ, đồ sấy và thịt khô đã tẩm ướp."},
    {key:"fastfood",icon:"🍔",title:"Fastfood",hue:12,note:"Gà rán, burger và pizza chuỗi thức ăn nhanh."},
    {key:"restaurant",icon:"🍜",title:"Món ăn ngoài",hue:18,note:"Món gọi theo suất, theo đĩa hoặc theo bát Việt Nam."},
    {key:"drinks",icon:"🥤",title:"Đồ uống",hue:190,note:"Nước, nước ngọt, trà sữa, nước mía, bia và rượu."},
    {key:"seasoning",icon:"🧂",title:"Gia vị",hue:276,note:"Dầu mỡ, đường, muối, nước chấm và gia vị nền."}
  ];

  function catalogSearchText(item) {
    return normalizeFoodText(`${item.name||""} ${item.originalName||""} ${item.aliases||""}`).replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
  }
  function catalogPatternMatches(haystack,pattern) {
    const cleanHaystack=` ${String(haystack||"").replace(/\s+/g," ").trim()} `;
    const cleanPattern=normalizeFoodText(pattern).replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
    return cleanPattern ? cleanHaystack.includes(` ${cleanPattern} `) : false;
  }
  function catalogHasAny(text,patterns){return patterns.some((pattern)=>catalogPatternMatches(text,pattern));}
  function canonicalCatalogName(item) {
    const exactName=normalizeFoodText(item?.name||"");
    if(["banh mi khong","banh my khong"].includes(exactName)) return "Bánh mì baguette";
    if(["uc ga","uc ga phi le khong da"].includes(exactName)) return "Ức gà phi lê không da";
    if(["dui ga","dui ga phi le khong da"].includes(exactName)) return "Đùi gà phi lê không da";
    if(item?.curatedV47||item?.curatedV44) return String(item.name||"").trim();
    const text=`${catalogSearchText(item)} `;
    if(/(banh mi khong|banh my khong|plain vietnamese baguette|plain baguette)/.test(text)) return "Bánh mì baguette";
    if(/(kfc chicken|kfc fried chicken|ga ran kfc)/.test(text)) return "Gà rán KFC";
    if(/(mapo tofu|ma po tofu|dau phu mapo|dau phu sot tu xuyen)/.test(text)) return "Đậu phụ sốt Tứ Xuyên (Mapo tofu)";
    if(/tuna sandwich/.test(text)) return "Sandwich cá ngừ";
    if(/apple pie/.test(text)) return "Bánh táo";
    if(/grilled cheese sandwich/.test(text)) return "Sandwich phô mai nướng";
    if(/(melon dua luoi|cantaloupe)/.test(text)) return "Dưa lưới";
    if(/cashew hat dieu/.test(text)) return "Hạt điều";
    if(/almond hanh nhan|hat hanh nhan/.test(text)) return "Hạnh nhân";
    if(/^butter bo dong vat /.test(text)) return "Bơ động vật";
    if(/^skim milk powder /.test(text)) return "Sữa bột tách béo";
    if(/^mussels vem /.test(text)) return "Vẹm";
    if(/^hat flax hat lanh /.test(text)) return "Hạt lanh";
    if(/^be be /.test(text)) return "Thịt bề bề";
    if(/^trung nguyen qua /.test(text)) return "Trứng gà nguyên quả";
    if(/lentils dau lang/.test(text)) return "Đậu lăng";
    const translated=translateFoodNameToVietnamese(item.name)||item.name;
    let clean=String(translated||"").trim();
    if(normalizeFoodText(clean)==="trung") clean="Trứng gà nguyên quả";
    if(normalizeFoodText(clean)==="pho mai") clean="Phô mai regular cheese (loại phô mai vẫn cho vào burger)";
    if(normalizeFoodText(clean)==="tom") clean="Tôm bóc vỏ";
    clean=clean.replace(/\b[lL]ợn\b/g,(m)=>m[0]==="L"?"Heo":"heo");
    if(["thit heo nac","thit heo than","thit than heo"].includes(normalizeFoodText(clean))) clean="Thịt thăn heo";
    if(normalizeFoodText(clean)==="dau phu non") clean="Đậu hũ non";
    return clean;
  }
  function catalogNames(item){
    const display=canonicalCatalogName(item);
    return {
      display,
      accent:`${String(item.name||"").toLowerCase()} ${String(display||"").toLowerCase()} ${String(item.originalName||"").toLowerCase()}`,
      text:` ${catalogSearchText({...item,name:`${item.name||""} ${display||""}`})} `,
      hint:normalizeFoodText(item.catalogHint||"")
    };
  }
  function classifyCatalogItem(item) {
    if(item?.forcedGroup) return {group:item.forcedGroup,subgroup:item.forcedSubgroup||item.forcedGroup};
    const names=catalogNames(item),text=names.text,hint=names.hint;
    const normalizedName=normalizeFoodText(names.display||item.name||"");
    const displayLower=String(names.display||item.name||"").trim().toLowerCase();
    const has=(...patterns)=>catalogHasAny(text,patterns.flat());
    const starts=(...patterns)=>patterns.flat().some((pattern)=>{const p=normalizeFoodText(pattern);return normalizedName===p||normalizedName.startsWith(`${p} `);});

    /* Nhóm món chế biến có chủ đích. */
    if(starts("ga ran kfc","big mac","quarter pounder","filet o fish","mcchicken","whopper")||has("fast food","burger king","mcdonalds","kfc fried chicken","cheese pizza","bbq chicken pizza")) return {group:"fastfood",subgroup:"fastfood"};
    if(starts("che","thach gang","thach den")||has("sweet soup","grass jelly")) return {group:"sweet-soups",subgroup:"sweet-soups"};
    if(starts("kem","ice cream","gelato")||has("ice cream","gelato")) return {group:"dairy",subgroup:"ice-cream"};
    if(starts("banh cheesecake","banh flan","creme brulee","banh croissant","banh mexican","banh cinnamon","banh bong lan","banh su kem","banh mochi","banh quy","banh chocopie","banh macaron","banh donut","banh tiramisu","banh muffin","banh pancake","banh tao","banh pia","banh com","banh bo","banh trung thu")||has("cheesecake","cream puff","choux pastry","croissant","cookie","cookies","donut","doughnut","macaron","muffin","tiramisu","apple pie","sponge cake","pudding")) return {group:"sweet-cakes",subgroup:"sweet-cakes"};
    if(starts("com chay cha bong","nom bo kho","banh bot loc","banh xeo","banh beo hai phong","banh khoai tep","banh xiu pao","banh nhan hai hau","mit say","chuoi say","khoai say","ngo say","nam huong say lanh","thit bo kho","ga kho","heo kho","lon kho","bong ngo","caramel popcorn","banh ran ngot","banh ran man","pa te","pate","khoai tay chien","khoai lang chien","nem cuon","banh tom ho tay","banh chuoi chien")||has("seasoned beef jerky","seasoned chicken jerky","seasoned pork jerky","dried snack")) return {group:"snacks",subgroup:"snacks"};

    /* Đồ uống. */
    if(starts("bia","ruou","strongbow","wine","beer")||has("alcohol","vodka","whisky","whiskey","cider")) return {group:"drinks",subgroup:"alcohol"};
    if(starts("bot matcha")||has("matcha powder","green tea powder")) return {group:"seasoning",subgroup:"dry-seasoning"};
    if(starts("ca phe","tra","matcha","espresso","latte","cappuccino")||has("coffee","tea","milk tea")) return {group:"drinks",subgroup:"coffee-tea"};
    if(starts("nuoc ep","nuoc ngot","sinh to","cola","soda","nuoc mia","nuoc dua","nuoc dien giai","bo huc","lipton ice tea")||has("juice","soft drink","energy drink","coconut water","sugarcane juice","electrolyte drink")) return {group:"drinks",subgroup:"soft-drinks"};
    if(normalizedName==="nuoc"||starts("nuoc loc","nuoc khoang","nuoc co ga","nuoc tonic")||has("drinking water","mineral water","sparkling water","zero calorie drink")) return {group:"drinks",subgroup:"water"};

    /* Đậu và hạt. */
    if(starts("hat dac","hat thot not")) return {group:"nuts",subgroup:"palm-seeds"};
    if(starts("bo thuc vat","margarine")) return {group:"seasoning",subgroup:"oils"};
    if(starts("dau phu","dau hu","dau nanh","dau xanh","dau do","dau den","dau trang","dau ha lan","dau lang","dau ga")||has("tofu","soybean","soy bean","lentil","lentils","chickpea","kidney bean","black bean","white bean","mung bean")) return {group:"beans",subgroup:"beans"};
    if(starts("bo dau phong","bo lac")||has("peanut butter","almond butter","nut butter")) return {group:"nuts",subgroup:"nut-spreads"};
    if(starts("lac","dau phong","hanh nhan","oc cho","hat oc cho","hat dieu","mac ca","hat mac ca","hat de","hat de cuoi","hat thong","hat chia","hat lanh","hat flax","hat bi","hat huong duong","vung","me")||has("peanut","almond","walnut","cashew","macadamia","pistachio","hazelnut","chestnut","pine nut","chia seed","flaxseed","pumpkin seed","sunflower seed","sesame seed")) return {group:"nuts",subgroup:"nuts"};

    /* Cá và hải sản. */
    if(starts("muc","bach tuoc")||has("squid","octopus","cuttlefish")) return {group:"fish",subgroup:"squid-octopus"};
    if(starts("tom","tep","cua","ghe","thit cua","thit be be","be be")||has("thit cua","thit be be","shrimp","prawn","crab","lobster","crayfish","mantis shrimp")) return {group:"fish",subgroup:"shrimp-crab"};
    if(starts("hau","so","oc","vem","ngheu","thit hau","thit so","thit oc")||has("oyster","scallop","mussel","clam","snail","shellfish")) return {group:"fish",subgroup:"shellfish"};
    if(displayLower==="cá"||displayLower.startsWith("cá ")||displayLower.startsWith("cá/")||starts("trung ca")||has("fish","salmon","tuna","mackerel","cod","trout","tilapia","catfish","sardine","anchovy","fish roe")) return {group:"fish",subgroup:"fish-main"};

    /* Trứng và bơ sữa. */
    if(starts("trung","long trang trung")||has("egg","egg white")) return {group:"eggs",subgroup:"eggs"};
    if(starts("whey","sua bot","protein sua")||has("whey protein","casein","milk powder")) return {group:"dairy",subgroup:"dairy-protein"};
    if(starts("sua chua","yaourt")||has("yogurt","yoghurt","greek yogurt")) return {group:"dairy",subgroup:"yogurt"};
    if(starts("pho mai")||has("cheese","mozzarella","cheddar","feta","cottage cheese","cream cheese","parmesan")) return {group:"dairy",subgroup:"cheese"};
    if(starts("bo dong vat","bo lat","bo man","sua kem","kem sua","heavy cream","whipping cream")||has("butter","whipping cream","heavy cream")) return {group:"dairy",subgroup:"butter-cream"};
    if(starts("sua")||has("cow milk","whole milk","skim milk","nonfat milk")) return {group:"dairy",subgroup:"milk"};

    /* Thịt. */
    if(starts("thit ga","ga","uc ga","dui ga")||has("chicken","turkey")) return {group:"meat",subgroup:"poultry"};
    if(starts("thit vit","vit","ngan")||has("duck","muscovy")) return {group:"meat",subgroup:"poultry"};
    if(starts("thit heo","thit lon","heo","lon","ba chi heo","suon heo","bi heo","tim heo","gan heo","da day heo")||has("pork")) return {group:"meat",subgroup:"pork"};
    if(starts("thit bo","bo","be","ba chi bo","gan bo","tim bo","gan bo")||has("beef","veal")) return {group:"meat",subgroup:"beef"};
    if(starts("thit de","de","cuu","tho","ngua","nhong")||has("goat","lamb","mutton","rabbit","horse meat","insect")) return {group:"meat",subgroup:"other-meat"};
    if(starts("thit","gan","tim","da day","long")) return {group:"meat",subgroup:"other-meat"};

    /* Gia vị. */
    if(starts("dau hao","sot","nuoc cham","cham","tuong","mayonnaise","ot chung","ot laoganma")||has("sauce","dressing","mayonnaise","ketchup","mustard","soy sauce","fish sauce","chili crisp","tahini")) return {group:"seasoning",subgroup:"sauces"};
    if(starts("duong","mat ong","mat mia","sua dac","mut","syrup")||has("sugar","honey","sweetener","condensed milk","jam")) return {group:"seasoning",subgroup:"sweeteners"};
    if(starts("dau an","dau o liu","dau olive","dau thuc vat","mo heo","mo lon","bo thuc vat")||has("olive oil","coconut oil","cooking oil","vegetable oil","lard","margarine")) return {group:"seasoning",subgroup:"oils"};
    if(starts("muoi","tieu","bot ngot","bot cacao","hat nem","gia vi")||has("salt","pepper","cocoa powder","seasoning","spice","msg")) return {group:"seasoning",subgroup:"dry-seasoning"};

    /* Tinh bột. */
    if(displayLower==="bắp cải"||displayLower.startsWith("bắp cải ")) return {group:"vegetables",subgroup:"vegetables"};
    if(starts("com","gao","xoi","chao")||has("cooked rice","rice bowl","sticky rice","rice porridge","congee")) return {group:"starch",subgroup:"rice"};
    if(starts("bun","pho","mi","my","mien","hu tieu","banh da","banh canh","pasta","udon","soba","ramen","tteokbokki")||has("pasta","noodle","noodles","vermicelli")) return {group:"starch",subgroup:"noodles"};
    if(starts("banh mi","baguette","naan","tortilla","banh bao chay","banh day","banh duc")||has("bread","baguette","naan","tortilla")) return {group:"starch",subgroup:"bread-starch"};
    if(starts("khoai","san","cu dau","cu tu","khoai mon","bi do")||has("potato","sweet potato","cassava","yam","taro","pumpkin")) return {group:"starch",subgroup:"roots"};
    if(starts("yen mach","ngo","bap","lua mach","diem mach","quinoa","com")||has("oat","oats","corn","barley","quinoa","cereal","grain")) return {group:"starch",subgroup:"grains"};

    /* Rau củ và hoa quả. */
    if(starts("nam","moc nhi")||has("mushroom","fungi","wood ear")) return {group:"vegetables",subgroup:"mushrooms"};
    if(starts("rau","cai","ca rot","ca chua","ca tim","dua chuot","bi xanh","muop","su su","ot chuong","sup lo","bong cai","bap cai")||has("vegetable","carrot","tomato","eggplant","cucumber","zucchini","bell pepper","broccoli","cauliflower","cabbage","spinach","lettuce")) return {group:"vegetables",subgroup:"vegetables"};
    if(starts("qua bo","bo trai","dua","cam","quyt","buoi","chanh","dau","viet quat","mam xoi","phuc bon tu","tao","le","dao","man","mo","cherry","dua hau","dua luoi","thanh long","chuoi","xoai","du du","dua","thom","mit","sau rieng","nhan","vai","chom chom","mang cut","na","mang cau","hong xiêm","nho","kiwi","hong","cha la","hoa qua","trai cay")||has("fruit","avocado","coconut","orange","grapefruit","lemon","berry","apple","pear","peach","plum","cherry","watermelon","dragon fruit","banana","mango","papaya","pineapple","jackfruit","durian","longan","lychee","grape","kiwi","persimmon","date fruit")) return {group:"fruit",subgroup:"fruit"};

    /* Fallback metadata có kiểm soát. */
    if(["fish","seafood"].includes(hint)) return {group:"fish",subgroup:"fish-main"};
    if(["meat","poultry","protein","insect"].includes(hint)) return {group:"meat",subgroup:"other-meat"};
    if(hint==="egg") return {group:"eggs",subgroup:"eggs"};
    if(hint==="dairy") return {group:"dairy",subgroup:"milk"};
    if(hint==="legume") return {group:"beans",subgroup:"beans"};
    if(["grain","noodle","tuber","sticky_rice","carb","bread_pasta"].includes(hint)) return {group:"starch",subgroup:"grains"};
    if(hint==="vegetable") return {group:"vegetables",subgroup:"vegetables"};
    if(hint==="fruit") return {group:"fruit",subgroup:"fruit"};
    if(hint==="nut") return {group:"nuts",subgroup:"nuts"};
    if(["seasoning","spread"].includes(hint)) return {group:"seasoning",subgroup:"sauces"};
    if(hint==="drink") return {group:"drinks",subgroup:"soft-drinks"};
    return null;
  }

  const RAW_STAPLE_NAMES=new Set([
    "bun","pho","banh pho","mi","my","mien","udon","soba","pasta","banh da trang","banh canh",
    "com gao trang","com trang","com gao lut","xoi trang","banh duc","tteokbokki","baguette","banh mi baguette","banh bao chay","banh day","tortilla","banh mi naan",
    "gao","gao trang","gao lut","yen mach","ngo","bap","lua mach","diem mach","quinoa"
  ]);
  function isBasicSeasoningName(name){
    const exact=new Set(["muoi","duong","mat ong","mat mia","tieu","ot bot","bot nghe","bot toi","bot hanh","ngu vi huong","nuoc mam","xi dau","nuoc tuong","dau hao","giam","bot cacao","bot matcha","salt","sugar","honey","pepper","fish sauce","soy sauce","oyster sauce","vinegar","cocoa powder","matcha powder"]);
    return exact.has(name)||/^(dau an|dau thuc vat|dau oliu|dau olive|dau dua|dau me|dau lac|mo heo|mo lon|olive oil|coconut oil)(\b|$)/.test(name);
  }
  function isRawCatalogIngredient(item,classification){
    if(!classification) return false;
    const group=classification.group||"";
    const display=canonicalCatalogName(item);
    const name=normalizeFoodText(display||item.name||"");
    const nameText=normalizeFoodText(`${display||""} ${item.name||""} ${item.originalName||""} ${item.aliases||""}`);
    const processText=normalizeFoodText(`${item.processingText||""} ${item.subtitle||""} ${item.source||""} ${item.catalogHint||""}`);

    if(item?.id==="raw_sticky_rice"||name==="gao nep song") return false;
    if(name==="thit ba chi") return false;
    if(item?.curatedV47||item?.curatedV44) return true;
    if(item.kind==="off") return false;
    if(/^(chan ga sa tac|top mo|muoi lac vung|bo dau phong|sandwich pho mai nuong|banh mi bo duong|khoai tay voi gravy|san deo|khoai mon say|xoi do|vo tortilla|com|com trang|xoi|xoi nep)$/.test(name)) return false;

    /* Các nhóm món chế biến chỉ lấy từ danh mục V47 để tránh dữ liệu rác/trùng. */
    if(["snacks","fastfood","restaurant","sweet-soups","sweet-cakes"].includes(group)) return false;

    if(group==="seasoning") return isBasicSeasoningName(name);
    if(group==="beans"){
      if(/\b(ran|chien|sot|mapo|tu xuyen|fermented|chin|cooked)\b/.test(`${nameText} ${processText}`)) return false;
      return /^(dau phu|dau hu|tofu|dau nanh|dau do|dau den|dau xanh|dau trang|dau ha lan|dau ga|dau lang|soybean|bean|beans|lentil|chickpea)(\b|$)/.test(name);
    }
    if(group==="drinks") return /^(nuoc loc|nuoc dua|sua dau nanh|water|coconut water|soy milk)(\b|$)/.test(name);
    if(group==="dairy") return !/\b(sua chua uong|milkshake|tra sua|ca phe sua|pudding|flan)\b/.test(nameText);

    if(RAW_STAPLE_NAMES.has(name)) return true;
    if(/\b(1 bat|1 to|1 suat|1 dia|1 o|1 phan|khau phan|mon hoan chinh|complete dish|ready to eat|thanh pham trung binh|nhan thit|nhan tom)\b/.test(`${nameText} ${processText}`)) return false;
    if(/\b(lau|sup|soup|salad|goi|nom|sandwich|burger|pizza|hot dog|che|pudding|flan|caramen|rendang|laksa|steak|thit vien|vien ca|fish ball|meatball)\b/.test(nameText)) return false;
    if(/\b(nem|gio lua|gio bo|cha ca|cha lua|cha bo|cha bong|ruoc|xuc xich|lap xuong|pate|pa te|ham|bacon|sausage|salami|cold cuts)\b/.test(nameText)) return false;
    if(/\b(kho|rang|xao|nuong|quay|luoc|hap|ham|tan|sot|rim|om|chien|ran|ap chao|nau|ninh|roast|roasted|grill|grilled|fried|boil|boiled|steam|steamed|braise|braised|stew|stewed|bake|baked|smoked|cured|pickled)\b/.test(nameText)) return false;
    if(/\b(chin|luoc|hap|nuong|rang|xao|quay|chien|ran|nau|ham|om|rim|cooked|boiled|steamed|roasted|grilled|fried|ready cooked|thanh pham)\b/.test(processText)&&group!=="starch") return false;
    if(/\b(kho|say|jerky|dried|fruit chips)\b/.test(`${nameText} ${processText}`)&&["meat","fruit"].includes(group)) return false;
    if(group==="starch"&&classification.subgroup==="noodles"&&!RAW_STAPLE_NAMES.has(name)) return false;
    return true;
  }
  function catalogIdentity(item) {
    return normalizeFoodText(canonicalCatalogName(item))
      .replace(/\([^)]*\)/g," ")
      .replace(/\b(phi le|song|chin|tuoi|raw|cooked|boiled|grilled)\b/g," ")
      .replace(/\blon\b/g,"heo")
      .replace(/\s+/g," ").trim();
  }
  function catalogItemScore(item) {
    const source=normalizeFoodText(item.source||"");
    let score=item.kind==="local"?120:0;
    if(source.includes("v47")) score+=160;
    else if(source.includes("v44")) score+=140;
    else if(source.includes("v7")) score+=70;
    else if(source.includes("v6")) score+=65;
    else if(source.includes("thuong an")) score+=55;
    else if(source.includes("mon viet")) score+=45;
    if(/khau phan|1 bat|1 to|1 suat|1 dia|1 o/.test(normalizeFoodText(`${item.subtitle} ${item.aliases}`))) score+=18;
    if(/[À-ỹ]/.test(item.name||"")) score+=8;
    return score;
  }
  function chooseCatalogItem(a,b){return catalogItemScore(b)>catalogItemScore(a)?b:a;}
  /* V49: Header sticky đã ghi tên cột; trong ô chỉ hiển thị số liệu. */
  function renderMetric(kind,label,value,digits=1){const shown=formatNutrientValue(value,digits),displayValue=String(kind).includes("protein")?`${shown}g`:shown;return `<span class="food-metric ${kind}" aria-label="${escapeFoodHtml(label)} ${escapeFoodHtml(shown)}" title="${escapeFoodHtml(label)}"><b>${displayValue}</b></span>`;}
  const PROTEIN_DENSITY_GROUPS=new Set(["meat","fish","eggs","dairy"]);
  function proteinPerCalorie(item){
    const kcal=Number(item?.kcal),protein=Number(item?.protein);
    return Number.isFinite(kcal)&&kcal>0&&Number.isFinite(protein)?protein/kcal:0;
  }
  function sortFoodCatalog(items,groupKey){
    const rows=[...items];
    if(PROTEIN_DENSITY_GROUPS.has(groupKey)){
      return rows.sort((a,b)=>proteinPerCalorie(b)-proteinPerCalorie(a)||Number(b.protein)-Number(a.protein)||Number(a.kcal)-Number(b.kcal)||canonicalCatalogName(a).localeCompare(canonicalCatalogName(b),"vi"));
    }
    return rows.sort((a,b)=>Number(a.kcal)-Number(b.kcal)||canonicalCatalogName(a).localeCompare(canonicalCatalogName(b),"vi"));
  }
  function catalogSortLabel(groupKey){
    return PROTEIN_DENSITY_GROUPS.has(groupKey)?"Tỉ lệ đạm/calo cao đến thấp":"Calo thấp đến cao";
  }
  function proteinDensityPer100Kcal(item){return proteinPerCalorie(item)*100;}
  function displayCatalogName(item){
    let name=canonicalCatalogName(item);
    const cls=item?._catalogClass||{};
    if(cls.group==="fish"&&cls.subgroup==="fish-main") name=String(name||"").replace(/\s+phi\s+lê\s*$/i,"").trim();
    if(normalizeFoodText(name)==="trung") name="Trứng gà nguyên quả";
    if(normalizeFoodText(name)==="pho mai") name="Phô mai regular cheese (loại phô mai vẫn cho vào burger)";
    if(normalizeFoodText(name)==="tom") name="Tôm bóc vỏ";
    name=String(name||"").replace(/\b[lL]ợn\b/g,(m)=>m[0]==="L"?"Heo":"heo");
    if(normalizeFoodText(name)==="dau phu non") name="Đậu hũ non";
    return name;
  }
  function catalogIconForItem(item,displayName,classification){
    if(item?.catalogIcon) return item.catalogIcon;
    const raw=String(displayName||item?.name||"").trim().toLowerCase();
    const n=normalizeFoodText(raw);
    const group=classification?.group||"";
    const startsWord=(...words)=>words.some((word)=>{const w=normalizeFoodText(word);return n===w||n.startsWith(`${w} `);});
    if(group==="fastfood") return /pizza/.test(n)?"🍕":/ga ran/.test(n)?"🍗":"🍔";
    if(group==="sweet-soups") return /thach/.test(n)?"🍮":"🍧";
    if(group==="sweet-cakes"){
      if(/donut/.test(n)) return "🍩"; if(/croissant/.test(n)) return "🥐"; if(/mochi/.test(n)) return "🍡"; if(/quy|cookie|chocopie|macaron/.test(n)) return "🍪"; if(/pancake/.test(n)) return "🥞"; if(/tao|pie/.test(n)) return "🥧"; if(/flan|brulee/.test(n)) return "🍮"; if(/pia/.test(n)) return "🥮"; return "🍰";
    }
    if(group==="snacks"){
      if(/nom/.test(n)) return "🥗"; if(/bot loc|xiu pao/.test(n)) return "🥟"; if(/banh xeo/.test(n)) return "🥞"; if(/banh beo/.test(n)) return "🥣"; if(/tep/.test(n)) return "🍤"; if(/banh nhan/.test(n)) return "🍪"; if(/chuoi/.test(n)) return "🍌"; if(/khoai/.test(n)) return "🍠"; if(/ngo/.test(n)) return "🌽"; if(/nam/.test(n)) return "🍄"; if(/ga kho/.test(n)) return "🍗"; if(/heo kho/.test(n)) return "🐖"; if(/bo kho/.test(n)) return "🥩"; return "🍘";
    }
    if(group==="restaurant"){
      if(/pho|bun|mi |mien|hu tieu|banh da|banh canh/.test(`${n} `)) return "🍜"; if(/mi y/.test(n)) return "🍝"; if(/vit|ngan/.test(n)) return "🦆"; if(/chim/.test(n)) return "🐦"; if(/khoai tay chien/.test(n)) return "🍟"; if(/tom/.test(n)) return "🍤"; if(/nem cuon/.test(n)) return "🥬"; if(/nem|banh cuon|banh ran/.test(n)) return "🥟"; if(/bo bit tet|long ran/.test(n)) return "🥩"; return "🍽️";
    }
    if(group==="fish"){
      if(/tom|tep|be be/.test(n)) return "🦐"; if(/cua|ghe/.test(n)) return "🦀"; if(/muc/.test(n)) return "🦑"; if(/bach tuoc/.test(n)) return "🐙"; if(/hau|so|vem|ngheu/.test(n)) return "🦪"; if(/oc/.test(n)) return "🐚"; return "🐟";
    }
    if(group==="meat"){
      if(startsWord("thit ga","ga","uc ga","dui ga","chan ga")) return "🍗";
      if(startsWord("thit vit","vit","thit ngan","ngan")) return "🦆";
      if(/(^| )heo( |$)/.test(n)||startsWord("thit heo","ba chi heo","tim heo","gan heo","da day heo","long heo","nong heo")) return /ba chi/.test(n)?"🥓":"🐖";
      if(startsWord("de","thit de")) return "🐐"; if(startsWord("cuu","thit cuu")) return "🐑"; if(startsWord("tho","thit tho")) return "🐇"; if(startsWord("nhong","nhong tam")) return "🐛"; return "🥩";
    }
    if(group==="eggs") return "🥚";
    if(group==="dairy"){
      if(startsWord("pho mai")) return "🧀"; if(startsWord("sua chua")) return "🥣"; if(startsWord("bo dong vat","butter")) return "🧈"; if(startsWord("kem","kem vani","ice cream")) return "🍨"; return "🥛";
    }
    if(group==="beans") return /dau phu|dau hu/.test(n)?"⬜":/ha lan/.test(n)?"🫛":"🫘";
    if(group==="nuts") return /hat dac|hat thot not/.test(n)?"🌴":/lac|dau phong/.test(n)?"🥜":"🌰";
    if(group==="starch"){
      if(startsWord("com","com gao trang","com gao lut")) return "🍚"; if(startsWord("xoi")) return "🍙"; if(startsWord("bun","pho","mi","my","mien","udon","soba","pasta","banh canh","banh da")) return "🍜"; if(startsWord("baguette","banh mi")) return "🥖"; if(startsWord("naan","tortilla")) return "🫓"; if(startsWord("khoai tay")) return "🥔"; if(startsWord("bi do")) return "🎃"; if(startsWord("khoai","san","cu")) return "🍠"; if(startsWord("ngo","bap")) return "🌽"; return "🌾";
    }
    if(group==="vegetables"){
      if(startsWord("nam","moc nhi")) return "🍄"; if(startsWord("ca chua")) return "🍅"; if(startsWord("ca rot")) return "🥕"; if(startsWord("ca tim")) return "🍆"; if(startsWord("dua chuot")) return "🥒"; if(startsWord("bi do")) return "🎃"; if(startsWord("ot","ot chuong")) return "🫑"; return "🥬";
    }
    if(group==="fruit"){
      if(startsWord("tao")) return "🍎"; if(startsWord("chuoi")) return "🍌"; if(startsWord("cam","quyt","cam quyt")) return "🍊"; if(startsWord("xoai")) return "🥭"; if(startsWord("dua hau")) return "🍉"; if(raw.startsWith("dừa")) return "🥥"; if(raw.startsWith("dứa")||raw.startsWith("thơm")) return "🍍"; if(startsWord("nho")) return "🍇"; if(startsWord("le")) return "🍐"; if(startsWord("dao")) return "🍑"; if(startsWord("cherry")) return "🍒"; if(startsWord("kiwi")) return "🥝"; if(startsWord("viet quat")) return "🫐"; if(startsWord("dau","dau tay","phuc bon tu")) return "🍓"; if(startsWord("qua bo")) return "🥑"; if(startsWord("dua luoi")) return "🍈"; return "🍈";
    }
    if(group==="drinks"){
      if(/bia/.test(n)) return "🍺"; if(/vang/.test(n)) return "🍷"; if(/ruou/.test(n)) return "🥃"; if(/tra sua/.test(n)) return "🧋"; if(/bo huc|red bull/.test(n)) return "⚡"; return "🥤";
    }
    if(group==="seasoning"){
      if(startsWord("dau an","dau oliu","dau olive","dau thuc vat")) return "🫒"; if(startsWord("duong","mat ong","mat mia")) return "🍯"; if(startsWord("muoi")) return "🧂"; if(startsWord("ot","ot bot")) return "🌶️"; return "🫙";
    }
    return foodIconForName(displayName||item?.name||"");
  }
  function renderFoodTableRow(item,hue,groupKey){
    const translated=displayCatalogName(item),classification=item?._catalogClass||{},proteinPriority=PROTEIN_DENSITY_GROUPS.has(groupKey);
    const basis=item.subtitle||"100 g";
    const icon=catalogIconForItem(item,translated,classification),online=item.kind!=="local"?'<span class="online-food-badge">ONLINE</span>':"";
    const secondary=proteinPriority
      ? `Carb ${formatNutrientValue(item.carb,1)}g · Fat ${formatNutrientValue(item.fat,1)}g`
      : `Đạm ${formatNutrientValue(item.protein,1)}g · Carb ${formatNutrientValue(item.carb,1)}g · Fat ${formatNutrientValue(item.fat,1)}g`;
    const metrics=proteinPriority
      ? `${renderMetric("protein primary","ĐẠM",item.protein,1)}${renderMetric("kcal primary","KCAL",item.kcal,0)}${renderMetric("ratio primary","TỈ LỆ",proteinDensityPer100Kcal(item),1)}`
      : `${renderMetric("kcal primary","KCAL",item.kcal,0)}`;
    return `<div class="food-table-row taxonomy ${proteinPriority?"protein-priority":"calorie-priority"}" style="--cat-hue:${hue}"><div class="food-name-cell"><span class="food-row-icon" aria-hidden="true">${icon}</span><div class="food-row-copy"><strong>${escapeFoodHtml(translated)}${online}</strong><small>${escapeFoodHtml(basis)}</small><span class="food-secondary-macros">${escapeFoodHtml(secondary)}</span></div></div>${metrics}</div>`;
  }

  let activeFoodMainGroup="meat";
  let lastCatalogItems=[];
  let lastCatalogQuery="";
  function renderCatalogBrowser(){
    if(!nutritionMacroCatalog)return;
    const counts=Object.fromEntries(FOOD_MAIN_GROUPS.map((g)=>[g.key,0]));
    lastCatalogItems.forEach((item)=>{if(item._catalogClass&&Object.prototype.hasOwnProperty.call(counts,item._catalogClass.group))counts[item._catalogClass.group]++;});
    if(!counts[activeFoodMainGroup]) activeFoodMainGroup=FOOD_MAIN_GROUPS.find((g)=>counts[g.key])?.key||FOOD_MAIN_GROUPS[0].key;
    const group=FOOD_MAIN_GROUPS.find((g)=>g.key===activeFoodMainGroup)||FOOD_MAIN_GROUPS[0];
    const groupItems=lastCatalogItems.filter((item)=>item._catalogClass?.group===group.key);
    const sortedItems=sortFoodCatalog(groupItems,group.key);
    const proteinPriority=PROTEIN_DENSITY_GROUPS.has(group.key);
    const tabs=FOOD_MAIN_GROUPS.filter((entry)=>counts[entry.key]>0).map((entry)=>`<button class="catalog-main-tab ${entry.key===group.key?"active":""}" type="button" data-food-main-group="${entry.key}" style="--tab-hue:${entry.hue}" aria-pressed="${entry.key===group.key}"><span class="catalog-main-icon" aria-hidden="true">${entry.icon}</span><span class="catalog-main-label">${entry.title}</span><small>${counts[entry.key]}</small></button>`).join("");
    const tableHead=proteinPriority
      ? `<div class="food-table-head taxonomy protein-priority"><span>Thực phẩm</span><span>Đạm</span><span>Calo</span><span title="Số gram đạm trên 100 kcal">Tỉ lệ</span></div>`
      : `<div class="food-table-head taxonomy calorie-priority"><span>Thực phẩm</span><span>Calo</span></div>`;
    nutritionMacroCatalog.innerHTML=`<div class="catalog-browser"><aside class="catalog-category-picker" aria-label="Danh mục thực phẩm"><div class="catalog-picker-head"><div><strong>Danh mục</strong><span>Chọn nhanh</span></div><b>${lastCatalogItems.length}</b></div><div class="catalog-category-grid" role="tablist" aria-label="Danh mục thực phẩm">${tabs}</div></aside><section id="activeFoodGroupPanel" class="catalog-active-group" style="--active-hue:${group.hue}"><header class="catalog-active-head"><span aria-hidden="true">${group.icon}</span><div class="catalog-active-copy"><h3>${group.title}</h3><p>${group.note}</p><span class="catalog-sort-rule">${catalogSortLabel(group.key)}</span></div><b>${groupItems.length}</b></header><div class="catalog-flat-list">${tableHead}<div class="food-table-body">${sortedItems.map((item)=>renderFoodTableRow(item,group.hue,group.key)).join("")}</div></div></section></div>`;
    nutritionLookupStatus.textContent=lastCatalogQuery?`Kết quả cho “${lastCatalogQuery}”`:"";
  }
  function renderUnifiedFoodCatalog(items,query=""){
    if(!nutritionMacroCatalog)return;
    const classified=items.filter(hasAllMacros).map((item)=>{const classification=classifyCatalogItem(item);return {...item,_catalogClass:classification};}).filter((item)=>item._catalogClass&&isRawCatalogIngredient(item,item._catalogClass));
    const unique=new Map();
    const supportedGroups=new Set(FOOD_MAIN_GROUPS.map((g)=>g.key));
    classified.filter((item)=>supportedGroups.has(item._catalogClass?.group)).forEach((item)=>{const key=catalogIdentity(item);if(!key)return;unique.set(key,unique.has(key)?chooseCatalogItem(unique.get(key),item):item);});
    lastCatalogItems=[...unique.values()];lastCatalogQuery=query;
    nutritionCatalogEmpty.hidden=lastCatalogItems.length>0;
    if(!lastCatalogItems.length){nutritionMacroCatalog.innerHTML="";nutritionLookupStatus.textContent=query?`Không tìm thấy “${query}” trong các danh mục đã lọc.`:"Không có dữ liệu thực phẩm phù hợp.";return;}
    renderCatalogBrowser();
  }
  nutritionMacroCatalog?.addEventListener("click",(event)=>{
    const mainButton=event.target.closest("[data-food-main-group]");
    if(mainButton&&!mainButton.disabled){
      activeFoodMainGroup=mainButton.dataset.foodMainGroup;
      renderCatalogBrowser();
      requestAnimationFrame(()=>document.getElementById("activeFoodGroupPanel")?.scrollIntoView({behavior:"smooth",block:"start"}));
    }
  });
  function currentFullCatalog() { return [...UNIFIED_FOOD_CATALOG]; }
  function filterLocalCatalog(query) {
    const normalized=normalizeFoodText(query);
    const catalog=currentFullCatalog();
    if(!normalized) return catalog;
    return catalog.filter((item)=>normalizeFoodText(`${item.name} ${item.originalName||""} ${item.aliases||""} ${item.subtitle||""}`).includes(normalized));
  }
  function nutrientValueFromSearch(food,nutrientId,pattern) {
    const list=food.foodNutrients||[];const found=list.find((n)=>Number(n.nutrientId)===nutrientId||pattern.test(String(n.nutrientName||"")));const value=Number(found?.value);return Number.isFinite(value)?value:null;
  }
  function formatNutrientValue(value,digits=1) { if(!Number.isFinite(Number(value))) return "—";const n=Number(value),maxDigits=Math.abs(n)>=100?0:digits;return n.toLocaleString("vi-VN",{minimumFractionDigits:0,maximumFractionDigits:maxDigits}); }
  async function searchUsdaForLookup(query) {
    const translated=translateVietnameseQuery(query)||query;
    const url=`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&query=${encodeURIComponent(translated)}&pageSize=24`;
    const data=await fetchJsonWithTimeout(url,8000);
    return (data.foods||[]).map((food)=>({kind:"usda",id:food.fdcId,name:food.description||query,subtitle:"100 g",icon:foodIconForName(food.description||query),source:"USDA FoodData Central",kcal:nutrientValueFromSearch(food,1008,/energy/i),protein:nutrientValueFromSearch(food,1003,/protein/i),carb:nutrientValueFromSearch(food,1005,/carbohydrate/i),fat:nutrientValueFromSearch(food,1004,/total lipid|total fat|^fat$/i)})).filter(hasAllMacros);
  }
  async function searchOpenFoodFactsForLookup(query) {
    const translated=translateVietnameseQuery(query)||query;const fields="code,product_name,product_name_vi,brands,nutriments";
    const url=`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(translated)}&search_simple=1&action=process&json=1&page_size=18&fields=${fields}`;
    const data=await fetchJsonWithTimeout(url,8000);
    return (data.products||[]).map((p)=>{const n=p.nutriments||{};const name=p.product_name_vi||p.product_name||query;return {kind:"off",id:p.code,name,subtitle:"100 g",icon:foodIconForName(name),source:["Open Food Facts",p.brands].filter(Boolean).join(" · "),kcal:numberOrNull(n["energy-kcal_100g"]??n["energy-kcal"]),protein:numberOrNull(n.proteins_100g),carb:numberOrNull(n.carbohydrates_100g),fat:numberOrNull(n.fat_100g)};}).filter(hasAllMacros);
  }
  function usdaListFoodToCatalog(food) {
    const item={kind:"usda",id:food.fdcId,name:food.description||"",subtitle:"100 g",icon:foodIconForName(food.description||""),source:"USDA FoodData Central",kcal:nutrientValueFromSearch(food,1008,/energy/i),protein:nutrientValueFromSearch(food,1003,/protein/i),carb:nutrientValueFromSearch(food,1005,/carbohydrate/i),fat:nutrientValueFromSearch(food,1004,/total lipid|total fat|^fat$/i)};
    return item.name && hasAllMacros(item) ? item : null;
  }
  async function loadExpandedUsdaCatalog() {
    const cacheKey="inAndOutExpandedFoodCatalogV35";
    try {
      const cached=JSON.parse(localStorage.getItem(cacheKey)||"[]");
      if(Array.isArray(cached)&&cached.length){expandedUsdaCatalog=cached.filter(hasAllMacros);if(!activeCatalogQuery)renderUnifiedFoodCatalog(currentFullCatalog());return;}
    } catch(_) {}
    nutritionLookupStatus.classList.add("loading");
    nutritionLookupStatus.textContent=`Đang nạp thêm kho thực phẩm phổ thông…`;
    try {
      const pages=await Promise.all([1,2,3].map((page)=>fetchJsonWithTimeout(`https://api.nal.usda.gov/fdc/v1/foods/list?api_key=DEMO_KEY&pageSize=200&pageNumber=${page}&dataType=Foundation,SR%20Legacy`,10000)));
      expandedUsdaCatalog=pages.flatMap((rows)=>Array.isArray(rows)?rows:[]).map(usdaListFoodToCatalog).filter(Boolean);
      try{localStorage.setItem(cacheKey,JSON.stringify(expandedUsdaCatalog));}catch(_){}
      if(!activeCatalogQuery)renderUnifiedFoodCatalog(currentFullCatalog());
    } catch(_) {
      if(!activeCatalogQuery)nutritionLookupStatus.textContent=`Kho nội bộ có ${UNIFIED_FOOD_CATALOG.length} thực phẩm; dữ liệu trực tuyến sẽ được bổ sung khi tìm kiếm.`;
    } finally { nutritionLookupStatus.classList.remove("loading"); }
  }
  async function runNutritionLookup(query) {
    query=String(query||"").trim();activeCatalogQuery=query;
    if(!query){nutritionOnlineCache=[];renderUnifiedFoodCatalog(currentFullCatalog());return;}
    if(query.length<2){nutritionLookupStatus.textContent="Nhập ít nhất 2 ký tự để tìm.";return;}
    const local=filterLocalCatalog(query);renderUnifiedFoodCatalog(local,query);
    nutritionLookupStatus.classList.add("loading");nutritionLookupStatus.textContent=`Đang mở rộng kết quả cho “${query}”…`;
    let remote=[];let errors=0;
    try{remote.push(...await searchUsdaForLookup(query));}catch(_){errors++;}
    try{remote.push(...await searchOpenFoodFactsForLookup(query));}catch(_){errors++;}
    if(activeCatalogQuery!==query)return;
    nutritionOnlineCache=remote;
    renderUnifiedFoodCatalog([...local,...remote],query);
    nutritionLookupStatus.classList.remove("loading");
    const total=lastCatalogItems.length;
    nutritionLookupStatus.textContent=total?`Hiển thị ${total} kết quả đã lọc; dữ liệu nội bộ được ưu tiên, sau đó mới bổ sung nguồn trực tuyến.`:(errors?"Không kết nối được nguồn trực tuyến và không có kết quả nội bộ phù hợp.":"Không tìm thấy thực phẩm phù hợp.");
  }
  let nutritionCatalogPrimed = false;
  function ensureNutritionCatalogRendered() {
    if (nutritionCatalogPrimed) return;
    nutritionCatalogPrimed = true;
    renderUnifiedFoodCatalog(UNIFIED_FOOD_CATALOG);
  }
  window.__foodParserV50={estimateFood,findFood,getAuthoritativeFoodDbV50};
  window.__foodParserV51={estimateFood,findFood,getAuthoritativeFoodDbV50,parseExplicitCustomNutritionV51,authoritativeCatalogAliasMatchV51};
  window.__foodParserV52={estimateFood,findFood,genericProduce:GENERIC_PRODUCE_PARSER_V52};
  window.__foodParserV53={estimateFood,findFood,findGenericProduceV53,genericProduce:GENERIC_PRODUCE_PARSER_V52};
  window.__foodParserV57={estimateFood,findFood,getAuthoritativeFoodDbV50,V57_BILINGUAL_EN_ALIAS_ROWS};
  /* USDA/Open Food Facts chỉ được gọi khi người dùng chủ động tìm kiếm để trang mặc định luôn gọn. */
  nutritionLookupForm?.addEventListener("submit",(event)=>{event.preventDefault();runNutritionLookup(nutritionLookupInput.value);});
  /* V68: lọc kho nội bộ ngay khi gõ, không phải bấm "Tìm" rồi mới thấy kết quả.
     Chỉ lọc offline ở đây; nguồn trực tuyến vẫn chỉ gọi khi bấm Tìm/Enter. */
  let nutritionInstantTimer=null;
  nutritionLookupInput?.addEventListener("input",()=>{
    clearTimeout(nutritionInstantTimer);
    nutritionInstantTimer=setTimeout(()=>{
      const query=String(nutritionLookupInput.value||"").trim();
      activeCatalogQuery=query;
      if(!query){nutritionOnlineCache=[];renderUnifiedFoodCatalog(currentFullCatalog());return;}
      if(query.length<2){nutritionLookupStatus.textContent="Nhập ít nhất 2 ký tự để tìm.";return;}
      renderUnifiedFoodCatalog(filterLocalCatalog(query),query);
      nutritionLookupStatus.textContent=`${lastCatalogItems.length} kết quả trong kho nội bộ · bấm Tìm để bổ sung nguồn trực tuyến`;
    },180);
  });
  const geminiApiKeyInput=document.getElementById("geminiApiKeyInput"),geminiKeyState=document.getElementById("geminiKeyState"),geminiKeyMessage=document.getElementById("geminiKeyMessage");
  const keyDialog=document.createElement("dialog");
  keyDialog.id="geminiKeyDialog";
  keyDialog.setAttribute("aria-labelledby","aiKeyTitle");
  const keyPanel=document.querySelector(".ai-key-panel");
  if(keyPanel){keyDialog.appendChild(keyPanel);document.body.appendChild(keyDialog);}
  const closeKeyDialog=document.createElement("button");
  closeKeyDialog.type="button";closeKeyDialog.className="ai-key-delete";closeKeyDialog.textContent="Đóng";
  closeKeyDialog.addEventListener("click",()=>keyDialog.close());keyPanel?.appendChild(closeKeyDialog);
  const headerKeyBtn=document.createElement("button");
  headerKeyBtn.id="headerApiKeyBtn";headerKeyBtn.type="button";headerKeyBtn.className="header-api-key-btn";headerKeyBtn.textContent="API key";
  headerKeyBtn.setAttribute("aria-haspopup","dialog");
  headerKeyBtn.addEventListener("click",()=>{keyDialog.showModal();geminiApiKeyInput?.focus();});
  document.getElementById("stickyRefreshBtn")?.before(headerKeyBtn);
  keyDialog.addEventListener("click",event=>{if(event.target===keyDialog){const r=keyDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)keyDialog.close();}});
  function renderGeminiKeyState(message=""){const connected=!!getGeminiApiKey();if(geminiKeyState){geminiKeyState.textContent=connected?"Gemini đã kết nối ✓":"Chưa kết nối";geminiKeyState.classList.toggle("connected",connected);}if(geminiApiKeyInput)geminiApiKeyInput.value="";if(message&&geminiKeyMessage)geminiKeyMessage.textContent=message;}
  document.getElementById("saveGeminiKeyBtn")?.addEventListener("click",async()=>{const key=String(geminiApiKeyInput?.value||"").trim();if(!key){if(geminiKeyMessage)geminiKeyMessage.textContent="Hãy dán API key Gemini trước.";return;}const btn=document.getElementById("saveGeminiKeyBtn");btn.disabled=true;if(geminiKeyMessage)geminiKeyMessage.textContent="Đang kiểm tra kết nối Gemini…";try{await callGeminiFoodParser(["1 quả trứng gà"],key);localStorage.setItem(GEMINI_API_KEY_STORAGE,key);renderGeminiKeyState("Đã lưu key trên trình duyệt này. Món lạ sẽ được Gemini nhận diện khi cập nhật Sheet.");if(rawRows.length)await resolveUnknownFoods(rawRows);}catch(error){if(geminiKeyMessage)geminiKeyMessage.textContent=error.message||"Không kết nối được Gemini.";}finally{btn.disabled=false;}});
  document.getElementById("deleteGeminiKeyBtn")?.addEventListener("click",()=>{try{localStorage.removeItem(GEMINI_API_KEY_STORAGE);}catch(_){}renderGeminiKeyState("Đã xóa API key khỏi trình duyệt này.");});
  renderGeminiKeyState();
  document.getElementById("refreshBtn").addEventListener("click", refreshData);
  document.getElementById("stickyRefreshBtn").addEventListener("click", refreshData);
  document
    .getElementById("openSheetBtn")
    .addEventListener("click", () =>
      window.open(SHEET_URL, "_blank", "noopener"),
    );
  window.addEventListener("resize", () => {
    if (currentPage === "charts")
      renderCharts(computedDays.filter((d) => d.complete));
  });
  try {
    [
      "inAndOutOnlineFoodCacheV1",
      "inAndOutLookupFailuresV1",
      "inAndOutOnlineFoodCacheV2",
      "inAndOutLookupFailuresV2",
      "inAndOutOnlineFoodCacheV3",
      "inAndOutLookupFailuresV3",
    ].forEach((k) => localStorage.removeItem(k));
  } catch {}
  try {
    [
      "roadTo6PacksSheetCacheV1",
      "roadTo6PacksSheetCacheV2",
      "roadTo6PacksSheetCacheV3",
      "roadTo6PacksSheetCacheV4",
      "roadTo6PacksSheetCacheV5",
      "roadTo6PacksSheetCacheV6",
      "roadTo6PacksSheetCacheV7",
    ].forEach((k) => localStorage.removeItem(k));
  } catch {}
  const rawHash = location.hash.replace("#", "");
  const hash = rawHash === "foods" ? "lookup" : rawHash;
  if (["overview", "calendar", "charts", "history", "lookup"].includes(hash))
    showPage(hash);
  const hasCachedRows = hydrateSheetCache();
  const hasOverviewSnapshot = hydrateOverviewSnapshot();
  const boot = async () => {
    await prepareFoodRowsV66(rawRows);
    render();
    refreshData();
  };
  /* Paint the saved dashboard and activate controls before processing rows. */
  requestAnimationFrame(()=>setTimeout(boot,0));
  refreshTimer = setInterval(refreshData, PROFILE.refreshSeconds * 1000);

  /* theme-redraw-v6 · nutrition-integrity · priority-foods · cooking-engine */
  window.addEventListener("themechange", () => {
    try {
      if (computedDays.length)
        requestAnimationFrame(() => renderCharts(computedDays));
    } catch (_) {}
  });
})();
