/**
 * ================================================================
 * SUPABASE SYNC v5.6 — DEFAULT STATUS + SHEET B OVERRIDE
 * ================================================================
 *
 * Thay đổi chính so với v5.3:
 *
 * [NEW] Sheet A KHÔNG push STATUS. STATUS không có trong COLUMN_MAP.
 *
 * [NEW] PCODE mới (chưa có STATUS trên Supabase) tự động được gán
 *       DEFAULT_STATUS (cấu hình được, mặc định "Đang SX").
 *
 * [NEW] Sheet B chỉ ghi đè STATUS khi giá trị là "Đã giao" hoặc "Đã sx".
 *       Các trạng thái khác trên Sheet B bị bỏ qua.
 *
 * Luồng:
 *   1. Sheet A sync data (KHÔNG có STATUS).
 *   2. syncSheetB_Status: gán DEFAULT_STATUS cho NULL, override "Đã giao"/"Đã sx".
 *   3. Record đã có STATUS khác → giữ nguyên, không bị ghi đè.
 *
 * ================================================================
 */

// ================================================================
// DEFAULT CONFIG
// ================================================================
const DEFAULT_CONFIG = {
  // Sheet A (chính) — sheet đang gắn script
  SHEET_A_FILE_ID:    "",  // "" = active spreadsheet
  SHEET_A_TAB_NAME:   "Tổng hợp 2026",

  // Sheet B (onlyview) — file ngoài, chỉ override STATUS "Đã giao" / "Đã sx"
  SHEET_B_FILE_ID:    "",
  SHEET_B_TAB_NAME:   "OnlyView",
  SHEET_B_PCODE_COL:  "số YCSX",
  SHEET_B_STATUS_COL: "Tình trạng",

  // Sheet B chỉ được quyền override các trạng thái này
  SHEET_B_OVERRIDE_STATUSES: ["Đã giao", "Đã sx"],

  // Cutoff: chỉ sync record có INITIALDATE >= cutoff
  // Format: "YYYY-MM-DD" hoặc "" để tắt filter
  CUTOFF_DATE: "",

  // STATUS mặc định cho record mới (PCODE chưa có STATUS trên Supabase)
  // Cấu hình qua menu. Sheet B có thể ghi đè bằng "Đã giao" / "Đã sx".
  DEFAULT_STATUS: "Đang SX",

  // Supabase
  TABLE_NAME:         "data",
  UPSERT_ON_CONFLICT: "PCODE",
  BATCH_SIZE:         200,
  SLEEP_BETWEEN_MS:   500,
  MAX_RETRIES:        3,
  RETRY_BASE_MS:      2000,

  // Timezone
  TIMEZONE_NAME:      "Asia/Ho_Chi_Minh",
  TIMEZONE_OFFSET:    "+07:00",

  // Monitoring
  STALE_THRESHOLD_MIN: 30,
  ALERT_EMAIL:         "",
  HEARTBEAT_KEY:       "LAST_HEARTBEAT",
  LAST_ERROR_KEY:      "LAST_ERROR",
  LAST_SUCCESS_KEY:    "LAST_SUCCESS",

  // Column mapping cho Sheet A (KHÔNG bao gồm STATUS — xử lý riêng bởi syncSheetB_Status)
  COLUMN_MAP: [
    { source: "số YCSX",        dest: "PCODE",        type: "string",   required: true  },
    { source: "Ngày lập phiếu", dest: "INITIALDATE",  type: "date",     required: true  },
    { source: "Khách hàng",     dest: "CUSTOMER",     type: "string",   required: true  },
    { source: "Xưởng Sản Xuất", dest: "WORKSHOP",     type: "string",   required: true  },
    { source: "Diễn giải",      dest: "DESCRIPTION",  type: "string",   required: false },
    { source: "Số lượng",       dest: "QUANTITY",     type: "number",   required: true  },
    { source: "Ngày KD",        dest: "DEADLINEDATE", type: "datetime", required: true  },
  ],
};

const CONFIG_KEYS = {
  SHEET_A_FILE_ID:    "CFG_SHEET_A_FILE_ID",
  SHEET_A_TAB_NAME:   "CFG_SHEET_A_TAB_NAME",
  SHEET_B_FILE_ID:    "CFG_SHEET_B_FILE_ID",
  SHEET_B_TAB_NAME:   "CFG_SHEET_B_TAB_NAME",
  SHEET_B_PCODE_COL:  "CFG_SHEET_B_PCODE_COL",
  SHEET_B_STATUS_COL: "CFG_SHEET_B_STATUS_COL",
  CUTOFF_DATE:        "CFG_CUTOFF_DATE",
  DEFAULT_STATUS:     "CFG_DEFAULT_STATUS",
  TABLE_NAME:         "CFG_TABLE_NAME",
  COLUMN_MAP:         "CFG_COLUMN_MAP",
  ALERT_EMAIL:        "CFG_ALERT_EMAIL",
};

const PASSWORD_KEY         = "ADMIN_PASSWORD_HASH";
const SESSION_KEY          = "ADMIN_SESSION_UNTIL";
const SESSION_DURATION_MIN = 15;

// ================================================================
// CONFIG LOADER
// ================================================================
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  const cfg   = Object.assign({}, DEFAULT_CONFIG);

  const overrides = [
    [CONFIG_KEYS.SHEET_A_FILE_ID,    "SHEET_A_FILE_ID"],
    [CONFIG_KEYS.SHEET_A_TAB_NAME,   "SHEET_A_TAB_NAME"],
    [CONFIG_KEYS.SHEET_B_FILE_ID,    "SHEET_B_FILE_ID"],
    [CONFIG_KEYS.SHEET_B_TAB_NAME,   "SHEET_B_TAB_NAME"],
    [CONFIG_KEYS.SHEET_B_PCODE_COL,  "SHEET_B_PCODE_COL"],
    [CONFIG_KEYS.SHEET_B_STATUS_COL, "SHEET_B_STATUS_COL"],
    [CONFIG_KEYS.CUTOFF_DATE,        "CUTOFF_DATE"],
    [CONFIG_KEYS.DEFAULT_STATUS,     "DEFAULT_STATUS"],
    [CONFIG_KEYS.TABLE_NAME,         "TABLE_NAME"],
    [CONFIG_KEYS.ALERT_EMAIL,        "ALERT_EMAIL"],
  ];

  overrides.forEach(([key, prop]) => {
    const v = props.getProperty(key);
    if (v !== null) cfg[prop] = v;
  });

  const cmJson = props.getProperty(CONFIG_KEYS.COLUMN_MAP);
  if (cmJson) {
    try { cfg.COLUMN_MAP = JSON.parse(cmJson); }
    catch (e) { Logger.log("COLUMN_MAP parse error: " + e.message); }
  }

  return cfg;
}

function getSheetA() {
  const cfg = getConfig();
  let file;
  if (cfg.SHEET_A_FILE_ID) {
    file = SpreadsheetApp.openById(cfg.SHEET_A_FILE_ID);
  } else {
    file = SpreadsheetApp.getActiveSpreadsheet();
  }
  const sheet = file.getSheetByName(cfg.SHEET_A_TAB_NAME);
  if (!sheet) throw new Error(`Sheet A "${cfg.SHEET_A_TAB_NAME}" không tồn tại`);
  return sheet;
}

function getSheetB() {
  const cfg = getConfig();
  if (!cfg.SHEET_B_FILE_ID) {
    throw new Error("Sheet B chưa cấu hình (Menu Cấu hình → Sheet B onlyview)");
  }
  const file  = SpreadsheetApp.openById(cfg.SHEET_B_FILE_ID);
  const sheet = file.getSheetByName(cfg.SHEET_B_TAB_NAME);
  if (!sheet) throw new Error(`Sheet B "${cfg.SHEET_B_TAB_NAME}" không tồn tại`);
  return sheet;
}

// ================================================================
// PASSWORD PROTECTION
// ================================================================
function hashPassword(plain) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, plain, Utilities.Charset.UTF_8);
  return bytes.map(b => {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

function isPasswordSet() {
  return PropertiesService.getScriptProperties().getProperty(PASSWORD_KEY) !== null;
}

function isSessionActive() {
  const until = PropertiesService.getScriptProperties().getProperty(SESSION_KEY);
  if (!until) return false;
  return new Date().getTime() < parseInt(until, 10);
}

function clearSession() {
  PropertiesService.getScriptProperties().deleteProperty(SESSION_KEY);
}

function requireAdminAuth() {
  const ui    = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  if (!isPasswordSet()) {
    const ok = ui.alert(
      "Setup mật khẩu Admin",
      "Chưa có mật khẩu admin. Tạo bây giờ?\n\n" +
      "Mật khẩu sẽ bảo vệ tất cả menu cấu hình.\n" +
      "Lưu ý: Quên mật khẩu phải chỉnh trong Script Properties.",
      ui.ButtonSet.OK_CANCEL
    );
    if (ok !== ui.Button.OK) return false;

    const pwd1 = ui.prompt("Setup password (1/2)",
      "Nhập mật khẩu mới (tối thiểu 4 ký tự):", ui.ButtonSet.OK_CANCEL);
    if (pwd1.getSelectedButton() !== ui.Button.OK) return false;
    const p1 = pwd1.getResponseText();
    if (p1.length < 4) { ui.alert("Mật khẩu phải >= 4 ký tự"); return false; }

    const pwd2 = ui.prompt("Setup password (2/2)",
      "Nhập lại mật khẩu để xác nhận:", ui.ButtonSet.OK_CANCEL);
    if (pwd2.getSelectedButton() !== ui.Button.OK) return false;
    if (p1 !== pwd2.getResponseText()) { ui.alert("Hai lần nhập không khớp"); return false; }

    props.setProperty(PASSWORD_KEY, hashPassword(p1));
    extendSession();
    ui.alert("Đã setup mật khẩu. Phiên có hiệu lực " + SESSION_DURATION_MIN + " phút.");
    return true;
  }

  if (isSessionActive()) { extendSession(); return true; }

  const res = ui.prompt("Yêu cầu mật khẩu admin",
    "Nhập mật khẩu để vào menu cấu hình:", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return false;

  const stored = props.getProperty(PASSWORD_KEY);
  if (hashPassword(res.getResponseText()) !== stored) {
    ui.alert("Sai mật khẩu");
    return false;
  }

  extendSession();
  return true;
}

function extendSession() {
  const until = new Date().getTime() + SESSION_DURATION_MIN * 60 * 1000;
  PropertiesService.getScriptProperties().setProperty(SESSION_KEY, until.toString());
}

function changeAdminPassword() {
  if (!requireAdminAuth()) return;
  const ui    = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  const pwd1 = ui.prompt("Đổi mật khẩu (1/2)", "Nhập mật khẩu mới:", ui.ButtonSet.OK_CANCEL);
  if (pwd1.getSelectedButton() !== ui.Button.OK) return;
  if (pwd1.getResponseText().length < 4) { ui.alert("Mật khẩu phải >= 4 ký tự"); return; }

  const pwd2 = ui.prompt("Đổi mật khẩu (2/2)", "Xác nhận lại:", ui.ButtonSet.OK_CANCEL);
  if (pwd2.getSelectedButton() !== ui.Button.OK) return;
  if (pwd1.getResponseText() !== pwd2.getResponseText()) { ui.alert("Không khớp"); return; }

  props.setProperty(PASSWORD_KEY, hashPassword(pwd1.getResponseText()));
  ui.alert("Đã đổi mật khẩu");
}

function logoutAdmin() {
  clearSession();
  SpreadsheetApp.getActiveSpreadsheet().toast("Đã đăng xuất admin", "Logout", 5);
}

// ================================================================
// MENU
// ================================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Supabase Sync")
    .addItem("Sync Sheet A (dòng mới)",            "syncSheetA_Incremental")
    .addItem("Sync Sheet B (STATUS override)",     "syncSheetB_Status")
    .addItem("Sync toàn bộ (A rồi B)",             "syncAll")
    .addSeparator()
    .addItem("Health Check",                   "healthCheck")
    .addItem("Xem trạng thái sync",            "showSyncStatus")
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu("Cấu hình (cần password)")
        .addItem("Xem cấu hình hiện tại",      "menuShowConfig")
        .addSeparator()
        .addItem("Sheet A — sheet chính",      "menuConfigSheetA")
        .addItem("Sheet B — sheet onlyview",   "menuConfigSheetB")
        .addItem("Mapping cột Sheet A",        "menuConfigColumnMapping")
        .addSeparator()
        .addItem("Cutoff date — ngày bắt đầu", "menuConfigCutoffDate")
        .addItem("Default STATUS (record mới)", "menuConfigDefaultStatus")
        .addSeparator()
        .addItem("Tên bảng Supabase",          "menuConfigTable")
        .addItem("Email nhận alert",           "menuConfigAlertEmail")
        .addSeparator()
        .addItem("Đổi mật khẩu admin",         "changeAdminPassword")
        .addItem("Đăng xuất admin",            "logoutAdmin")
        .addSeparator()
        .addItem("Bật/Tắt Stable UID",         "menuToggleStableUid")
        .addSeparator()
        .addItem("Setup triggers tự động",     "menuSetupTriggers")
        .addItem("Xóa tất cả triggers",        "menuRemoveTriggers")
        .addSeparator()
        .addItem("Reset config về mặc định",   "menuResetConfig")
    )
    .addSeparator()
    .addItem("Cài đặt Supabase credentials",   "menuSetupSupabase")
    .addItem("Test insert 1 dòng mẫu",         "insertTestRow")
    .addItem("Xóa dòng TEST-001",              "cleanupTestRow")
    .addItem("Reset pointer",                  "menuResetPointer")
    .addToUi();
}

// ================================================================
// MENU HANDLERS
// ================================================================
function menuShowConfig()          { if (requireAdminAuth()) showCurrentConfig(); }
function menuConfigSheetA()        { if (requireAdminAuth()) configureSheetA(); }
function menuConfigSheetB()        { if (requireAdminAuth()) configureSheetB(); }
function menuConfigColumnMapping() { if (requireAdminAuth()) configureColumnMapping(); }
function menuConfigCutoffDate()    { if (requireAdminAuth()) configureCutoffDate(); }
function menuConfigDefaultStatus() { if (requireAdminAuth()) configureDefaultStatus(); }
function menuConfigTable()         { if (requireAdminAuth()) configureTable(); }
function menuConfigAlertEmail()    { if (requireAdminAuth()) configureAlertEmail(); }
function menuSetupTriggers()       { if (requireAdminAuth()) setupAllTriggers(); }
function menuRemoveTriggers()      { if (requireAdminAuth()) removeAllTriggersConfirm(); }
function menuResetConfig()         { if (requireAdminAuth()) resetConfigToDefault(); }
function menuSetupSupabase()       { if (requireAdminAuth()) setupProperties(); }
function menuResetPointer()        { if (requireAdminAuth()) resetPointer(); }
function menuToggleStableUid()     { if (requireAdminAuth()) toggleStableUid(); }

// ================================================================
// CONFIG UI
// ================================================================
function showCurrentConfig() {
  const cfg   = getConfig();
  const props = PropertiesService.getScriptProperties();
  const ui    = SpreadsheetApp.getUi();

  const uidEnabled = props.getProperty("ENABLE_STABLE_UID") === "true";
  const lines = [];
  lines.push("CẤU HÌNH HIỆN TẠI");
  lines.push("==================");
  lines.push("");
  lines.push("SHEET A (chính):");
  lines.push(`  File ID: ${cfg.SHEET_A_FILE_ID || "(active spreadsheet)"}`);
  lines.push(`  Tab:     "${cfg.SHEET_A_TAB_NAME}"`);
  lines.push(`  STATUS:  KHÔNG push từ Sheet A`);
  lines.push("");
  lines.push("SHEET B (onlyview):");
  lines.push(`  File ID:    ${cfg.SHEET_B_FILE_ID || "(chưa set)"}`);
  lines.push(`  Tab:        "${cfg.SHEET_B_TAB_NAME}"`);
  lines.push(`  PCODE col:  "${cfg.SHEET_B_PCODE_COL}"`);
  lines.push(`  STATUS col: "${cfg.SHEET_B_STATUS_COL}"`);
  lines.push(`  Chỉ override: ${getSheetBOverrideStatusesLabel(cfg)}`);
  lines.push("");
  lines.push("FILTER:");
  lines.push(`  Cutoff date: ${cfg.CUTOFF_DATE || "(không filter)"}`);
  lines.push(`  Default STATUS (record mới): "${cfg.DEFAULT_STATUS}"`);
  lines.push("");
  lines.push("TARGET (Supabase):");
  lines.push(`  Table: ${cfg.TABLE_NAME}`);
  lines.push("");
  lines.push(`Stable UID: ${uidEnabled ? "BẬT" : "TẮT"}`);
  lines.push("");
  lines.push("COLUMN MAPPING (" + cfg.COLUMN_MAP.length + " cột):");
  cfg.COLUMN_MAP.forEach((m, i) => {
    const req = m.required ? "x" : " ";
    lines.push(`  ${i + 1}. [${req}] ${m.source} -> ${m.dest} (${m.type})`);
  });
  lines.push("");
  lines.push(`Alert email: ${cfg.ALERT_EMAIL || "(không set)"}`);

  ui.alert("Config", lines.join("\n"), ui.ButtonSet.OK);
}

function configureSheetA() {
  const ui    = SpreadsheetApp.getUi();
  const cfg   = getConfig();
  const props = PropertiesService.getScriptProperties();

  const idRes = ui.prompt(
    "Sheet A — File ID (1/2)",
    "Sheet A là sheet CHÍNH có phân quyền nội bộ.\n" +
    "Để TRỐNG = dùng active spreadsheet.\n\n" +
    "Hiện tại: " + (cfg.SHEET_A_FILE_ID || "(active spreadsheet)"),
    ui.ButtonSet.OK_CANCEL
  );
  if (idRes.getSelectedButton() !== ui.Button.OK) return;

  const nameRes = ui.prompt(
    "Sheet A — Tab name (2/2)",
    "Tên tab:\n\nHiện tại: \"" + cfg.SHEET_A_TAB_NAME + "\"",
    ui.ButtonSet.OK_CANCEL
  );
  if (nameRes.getSelectedButton() !== ui.Button.OK) return;

  const id   = idRes.getResponseText().trim();
  const name = nameRes.getResponseText().trim();

  if (id === "") {
    props.deleteProperty(CONFIG_KEYS.SHEET_A_FILE_ID);
  } else {
    props.setProperty(CONFIG_KEYS.SHEET_A_FILE_ID, id);
  }
  if (name) props.setProperty(CONFIG_KEYS.SHEET_A_TAB_NAME, name);

  try {
    const sheet = getSheetA();
    ui.alert("Sheet A OK",
      `Tab: "${sheet.getName()}"\nRows: ${sheet.getLastRow()}`, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert("Sheet A lỗi", e.message, ui.ButtonSet.OK);
  }
}

function configureSheetB() {
  const ui    = SpreadsheetApp.getUi();
  const cfg   = getConfig();
  const props = PropertiesService.getScriptProperties();

  const idRes = ui.prompt(
    "Sheet B — File ID (1/4)",
    "Sheet B là sheet ONLYVIEW. Script chỉ lấy STATUS = \"Đã giao\" hoặc \"Đã sx\".\n" +
    "Bắt buộc nhập File ID.\n\n" +
    "Hiện tại: " + (cfg.SHEET_B_FILE_ID || "(chưa set)"),
    ui.ButtonSet.OK_CANCEL
  );
  if (idRes.getSelectedButton() !== ui.Button.OK) return;
  const id = idRes.getResponseText().trim();
  if (!id) { ui.alert("File ID không được trống"); return; }

  const nameRes = ui.prompt("Sheet B — Tab name (2/4)",
    "Tên tab:\n\nHiện tại: \"" + cfg.SHEET_B_TAB_NAME + "\"", ui.ButtonSet.OK_CANCEL);
  if (nameRes.getSelectedButton() !== ui.Button.OK) return;

  const pcodeRes = ui.prompt("Sheet B — Tên cột PCODE (3/4)",
    "Tên cột chứa PCODE:\n\nHiện tại: \"" + cfg.SHEET_B_PCODE_COL + "\"", ui.ButtonSet.OK_CANCEL);
  if (pcodeRes.getSelectedButton() !== ui.Button.OK) return;

  const statusRes = ui.prompt("Sheet B — Tên cột STATUS (4/4)",
    "Tên cột chứa STATUS:\n\nHiện tại: \"" + cfg.SHEET_B_STATUS_COL + "\"", ui.ButtonSet.OK_CANCEL);
  if (statusRes.getSelectedButton() !== ui.Button.OK) return;

  props.setProperty(CONFIG_KEYS.SHEET_B_FILE_ID, id);
  if (nameRes.getResponseText().trim())   props.setProperty(CONFIG_KEYS.SHEET_B_TAB_NAME,   nameRes.getResponseText().trim());
  if (pcodeRes.getResponseText().trim())  props.setProperty(CONFIG_KEYS.SHEET_B_PCODE_COL,  pcodeRes.getResponseText().trim());
  if (statusRes.getResponseText().trim()) props.setProperty(CONFIG_KEYS.SHEET_B_STATUS_COL, statusRes.getResponseText().trim());

  try {
    const sheet = getSheetB();
    ui.alert("Sheet B OK",
      `Tab: "${sheet.getName()}"\nRows: ${sheet.getLastRow()}`, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert("Sheet B lỗi", e.message, ui.ButtonSet.OK);
  }
}

function configureCutoffDate() {
  const ui    = SpreadsheetApp.getUi();
  const cfg   = getConfig();
  const props = PropertiesService.getScriptProperties();

  const res = ui.prompt(
    "Cutoff date",
    "Chỉ sync record có INITIALDATE >= ngày này.\n\n" +
    "Format: YYYY-MM-DD (vd: 2026-01-01)\n" +
    "Để trống = TẮT filter (sync tất cả)\n\n" +
    "Hiện tại: " + (cfg.CUTOFF_DATE || "(không filter)"),
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const v = res.getResponseText().trim();
  if (!v) {
    props.deleteProperty(CONFIG_KEYS.CUTOFF_DATE);
    ui.alert("Đã tắt filter cutoff");
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    ui.alert("Format sai. Phải là YYYY-MM-DD");
    return;
  }
  props.setProperty(CONFIG_KEYS.CUTOFF_DATE, v);
  ui.alert(`Cutoff date -> ${v}`);
}

function configureDefaultStatus() {
  const ui  = SpreadsheetApp.getUi();
  const cfg = getConfig();
  const res = ui.prompt(
    "Default STATUS",
    "STATUS mặc định cho PCODE mới (chưa có STATUS trên Supabase).\n" +
    "Sheet B có thể ghi đè bằng \"Đã giao\" hoặc \"Đã sx\".\n\n" +
    "Hiện tại: \"" + cfg.DEFAULT_STATUS + "\"",
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const v = res.getResponseText().trim();
  if (!v) { ui.alert("Không được trống"); return; }
  PropertiesService.getScriptProperties().setProperty(CONFIG_KEYS.DEFAULT_STATUS, v);
  ui.alert(`Default STATUS -> "${v}"`);
}

function configureTable() {
  const ui  = SpreadsheetApp.getUi();
  const cfg = getConfig();
  const res = ui.prompt(
    "Table name",
    "Tên bảng Supabase:\n\nHiện tại: " + cfg.TABLE_NAME,
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const v = res.getResponseText().trim();
  if (!v) return;
  PropertiesService.getScriptProperties().setProperty(CONFIG_KEYS.TABLE_NAME, v);
  ui.alert(`Table -> ${v}`);
}

function configureAlertEmail() {
  const ui  = SpreadsheetApp.getUi();
  const cfg = getConfig();
  const res = ui.prompt(
    "Alert email",
    "Email nhận alert (để trống = tắt):\n\nHiện tại: " + (cfg.ALERT_EMAIL || "(chưa set)"),
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;
  PropertiesService.getScriptProperties().setProperty(
    CONFIG_KEYS.ALERT_EMAIL, res.getResponseText().trim());
  ui.alert("Alert email updated");
}

function configureColumnMapping() {
  const html = HtmlService.createHtmlOutput(buildColumnMappingHtml())
    .setWidth(800).setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, "Column Mapping (Sheet A)");
}

function buildColumnMappingHtml() {
  const cfg     = getConfig();
  const mapJson = JSON.stringify(cfg.COLUMN_MAP);
  return `<!DOCTYPE html><html><head><base target="_top"><style>
    body{font-family:-apple-system,Roboto,Arial,sans-serif;padding:12px;font-size:13px}
    h2{margin-top:0;font-size:16px}
    .help{background:#fff7e0;padding:8px 12px;border-left:3px solid #f5a623;margin-bottom:12px;border-radius:2px;font-size:12px}
    table{border-collapse:collapse;width:100%;margin-bottom:12px}
    th,td{padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:12px}
    th{background:#f5f5f5}
    input[type=text]{width:100%;box-sizing:border-box;padding:4px 6px;border:1px solid #ccc;border-radius:3px;font-size:12px}
    select{padding:4px;font-size:12px}
    .btn{padding:6px 14px;border:none;border-radius:3px;cursor:pointer;font-size:13px}
    .btn-primary{background:#1a73e8;color:white}
    .btn-secondary{background:#e8eaed;color:#202124}
    .btn-danger{background:#d93025;color:white}
    .btn:hover{opacity:.85}
    .actions{display:flex;gap:8px;align-items:center}
    .small{font-size:11px;color:#666}
  </style></head><body>
  <h2>Column Mapping — Sheet A (chính)</h2>
  <div class="help">
    <b>STATUS không có ở đây</b> — xử lý riêng bởi syncSheetB_Status.<br>
    Record mới tự động được gán DEFAULT_STATUS. Sheet B ghi đè <b>Đã giao</b> / <b>Đã sx</b>.
  </div>
  <table id="mapTable">
    <thead><tr>
      <th style="width:35px">#</th><th>Source</th><th>Dest</th>
      <th style="width:110px">Type</th><th style="width:75px">Required</th>
      <th style="width:90px">Actions</th>
    </tr></thead>
    <tbody id="mapBody"></tbody>
  </table>
  <div class="actions" style="margin-bottom:16px">
    <button class="btn btn-secondary" onclick="addRow()">+ Thêm cột</button>
    <span class="small">Lưu để áp dụng.</span>
  </div>
  <div class="actions">
    <button class="btn btn-primary" onclick="saveMapping()">Lưu</button>
    <button class="btn btn-secondary" onclick="google.script.host.close()">Đóng</button>
    <button class="btn btn-danger" onclick="resetDefault()" style="margin-left:auto">Reset default</button>
  </div>
  <script>
    const initialMap=${mapJson};
    function render(){const body=document.getElementById('mapBody');body.innerHTML='';initialMap.forEach((m,i)=>body.appendChild(createRow(m,i)));}
    function createRow(m,idx){const tr=document.createElement('tr');tr.innerHTML='<td>'+(idx+1)+'</td>'+
      '<td><input type="text" class="src" value="'+escapeHtml(m.source||'')+'"></td>'+
      '<td><input type="text" class="dest" value="'+escapeHtml(m.dest||'')+'"></td>'+
      '<td><select class="type">'+['string','date','datetime','number'].map(t=>'<option value="'+t+'"'+(m.type===t?' selected':'')+'>'+t+'</option>').join('')+'</select></td>'+
      '<td style="text-align:center"><input type="checkbox" class="req"'+(m.required?' checked':'')+'></td>'+
      '<td><button class="btn btn-secondary" onclick="moveUp(this)">↑</button> <button class="btn btn-danger" onclick="deleteRow(this)">X</button></td>';return tr;}
    function escapeHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML.replace(/"/g,'&quot;');}
    function addRow(){initialMap.push({source:'',dest:'',type:'string',required:false});render();}
    function deleteRow(btn){const tr=btn.closest('tr');const idx=Array.from(tr.parentNode.children).indexOf(tr);if(confirm('Xóa dòng '+(idx+1)+'?')){initialMap.splice(idx,1);render();}}
    function moveUp(btn){const tr=btn.closest('tr');const idx=Array.from(tr.parentNode.children).indexOf(tr);if(idx===0)return;const tmp=initialMap[idx];initialMap[idx]=initialMap[idx-1];initialMap[idx-1]=tmp;render();}
    function collectMapping(){const rows=document.querySelectorAll('#mapBody tr');const result=[];for(const tr of rows){const source=tr.querySelector('.src').value.trim();const dest=tr.querySelector('.dest').value.trim();const type=tr.querySelector('.type').value;const required=tr.querySelector('.req').checked;if(!source&&!dest)continue;if(!source||!dest){alert('Source/dest không được trống');return null;}result.push({source,dest,type,required});}return result;}
    function saveMapping(){const m=collectMapping();if(!m)return;if(m.length===0){alert('Phải có ít nhất 1 cột');return;}const seen=new Set();for(const x of m){if(seen.has(x.dest)){alert('Dest trùng: '+x.dest);return;}seen.add(x.dest);}google.script.run.withSuccessHandler(()=>{alert('Đã lưu '+m.length+' cột');google.script.host.close();}).withFailureHandler(e=>alert(e.message)).saveColumnMapping(JSON.stringify(m));}
    function resetDefault(){if(!confirm('Reset về default?'))return;google.script.run.withSuccessHandler(()=>{alert('Reset OK');google.script.host.close();}).resetColumnMappingToDefault();}
    render();
  </script></body></html>`;
}

function saveColumnMapping(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Invalid mapping");
  PropertiesService.getScriptProperties().setProperty(CONFIG_KEYS.COLUMN_MAP, JSON.stringify(parsed));
}

function resetColumnMappingToDefault() {
  PropertiesService.getScriptProperties().deleteProperty(CONFIG_KEYS.COLUMN_MAP);
}

function resetConfigToDefault() {
  const ui  = SpreadsheetApp.getUi();
  const res = ui.alert("Reset config", "Xóa toàn bộ config override?", ui.ButtonSet.YES_NO);
  if (res !== ui.Button.YES) return;
  const props = PropertiesService.getScriptProperties();
  Object.values(CONFIG_KEYS).forEach(k => props.deleteProperty(k));
  ui.alert("Reset OK");
}

// ================================================================
// STABLE UID (opt-in)
// ================================================================
function generateStableUid(pcode) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(pcode),
    Utilities.Charset.UTF_8
  );
  return bytes.slice(0, 8)
    .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0"))
    .join("");
}

function addStableUid(record, cfg) {
  const enabled = PropertiesService.getScriptProperties()
    .getProperty("ENABLE_STABLE_UID");
  if (enabled !== "true") return record;
  const pcode = record[cfg.UPSERT_ON_CONFLICT];
  if (!pcode) return record;
  return Object.assign({}, record, { uid: generateStableUid(pcode) });
}

function toggleStableUid() {
  const ui      = SpreadsheetApp.getUi();
  const props   = PropertiesService.getScriptProperties();
  const current = props.getProperty("ENABLE_STABLE_UID") === "true";

  const res = ui.alert(
    "Stable UID",
    `Hiện tại: ${current ? "BẬT" : "TẮT"}\n\n` +
    "uid = SHA256(PCODE)[0:16] — stable qua mọi upsert\n" +
    "Không phụ thuộc Supabase sequence.\n\n" +
    "Lưu ý: cần cột 'uid text' trong bảng Supabase.\n" +
    "SQL: ALTER TABLE data ADD COLUMN IF NOT EXISTS uid text;\n\n" +
    `${current ? "TẮT" : "BẬT"} stable UID?`,
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;
  props.setProperty("ENABLE_STABLE_UID", current ? "false" : "true");
  ui.alert(`Stable UID -> ${!current ? "BẬT" : "TẮT"}`);
}

// ================================================================
// CREDENTIALS
// ================================================================
function setupProperties() {
  const ui     = SpreadsheetApp.getUi();
  const urlRes = ui.prompt("Supabase (1/2)", "SUPABASE_URL:", ui.ButtonSet.OK_CANCEL);
  if (urlRes.getSelectedButton() !== ui.Button.OK) return;
  const keyRes = ui.prompt("Supabase (2/2)", "SUPABASE_ANON_KEY:", ui.ButtonSet.OK_CANCEL);
  if (keyRes.getSelectedButton() !== ui.Button.OK) return;
  PropertiesService.getScriptProperties().setProperties({
    SUPABASE_URL:      urlRes.getResponseText().trim(),
    SUPABASE_ANON_KEY: keyRes.getResponseText().trim(),
  });
  ui.alert("Đã lưu");
}

function getCredentials() {
  const props = PropertiesService.getScriptProperties();
  const url   = props.getProperty("SUPABASE_URL");
  const key   = props.getProperty("SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("Chưa cấu hình Supabase credentials");
  return { url: url.replace(/\/$/, ""), key };
}

// ================================================================
// MONITORING
// ================================================================
function recordHeartbeat(status, details) {
  const cfg   = getConfig();
  const now   = new Date().toISOString();
  const props = PropertiesService.getScriptProperties();
  props.setProperty(cfg.HEARTBEAT_KEY, now);
  if (status === "success") {
    props.setProperty(cfg.LAST_SUCCESS_KEY, now);
    props.deleteProperty(cfg.LAST_ERROR_KEY);
  } else if (status === "error") {
    props.setProperty(cfg.LAST_ERROR_KEY, now + " | " + (details || ""));
  }
}

function sendAlertEmail(subject, body) {
  const cfg = getConfig();
  if (!cfg.ALERT_EMAIL) return;
  try {
    MailApp.sendEmail({
      to: cfg.ALERT_EMAIL,
      subject: `[DMC Sync] ${subject}`,
      body: body + "\n\n---\nAuto-sent",
    });
  } catch (e) { Logger.log("Email fail: " + e.message); }
}

function formatLocal(date) {
  return Utilities.formatDate(date, getConfig().TIMEZONE_NAME, "yyyy-MM-dd HH:mm:ss");
}

// ================================================================
// STATUS HELPERS
// ================================================================
function normalizeStatusText(v) {
  let s = String(v || "").trim().replace(/\s+/g, " ");
  if (s.normalize) s = s.normalize("NFC");
  return s.toLowerCase();
}

function getSheetBOverrideStatuses(cfg) {
  return cfg.SHEET_B_OVERRIDE_STATUSES || ["Đã giao", "Đã sx"];
}

function getSheetBOverrideStatusesLabel(cfg) {
  return getSheetBOverrideStatuses(cfg).map(s => `"${s}"`).join(", ");
}

function getSheetBOverrideStatus(v, cfg) {
  const normalized = normalizeStatusText(v);
  const statuses = getSheetBOverrideStatuses(cfg);
  for (const status of statuses) {
    if (normalized === normalizeStatusText(status)) return status;
  }
  return null;
}

// ================================================================
// SHEET B: Fetch valid PCODEs from Supabase (with pagination)
// ================================================================
function fetchValidPcodesFromSupabase(creds, cfg) {
  const PAGE_SIZE = 1000;
  let all    = [];
  let offset = 0;

  while (true) {
    let url = `${creds.url}/rest/v1/${cfg.TABLE_NAME}` +
      `?select=${cfg.UPSERT_ON_CONFLICT},STATUS` +
      `&limit=${PAGE_SIZE}&offset=${offset}` +
      `&order=${cfg.UPSERT_ON_CONFLICT}`;

    if (cfg.CUTOFF_DATE) {
      url += `&INITIALDATE=gte.${cfg.CUTOFF_DATE}`;
    }

    const res = UrlFetchApp.fetch(url, {
      method: "GET",
      headers: {
        apikey:        creds.key,
        Authorization: `Bearer ${creds.key}`,
      },
      muteHttpExceptions: true,
    });

    if (res.getResponseCode() !== 200) {
      throw new Error(`Không lấy được PCODE từ Supabase: HTTP ${res.getResponseCode()}`);
    }

    const page = JSON.parse(res.getContentText());
    all = all.concat(page);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    Utilities.sleep(200);
  }

  Logger.log(`Supabase: ${all.length} PCODE hợp lệ` +
    (cfg.CUTOFF_DATE ? ` (cutoff: ${cfg.CUTOFF_DATE})` : ""));
  return all;
}

function patchStatusBatch(records, creds, cfg) {
  if (!records.length) return { success: 0, failed: 0 };
  let success = 0, failed = 0;

  for (let i = 0; i < records.length; i += cfg.BATCH_SIZE) {
    const batch = records.slice(i, i + cfg.BATCH_SIZE);
    const url   = `${creds.url}/rest/v1/${cfg.TABLE_NAME}` +
      `?on_conflict=${cfg.UPSERT_ON_CONFLICT}`;

    const res = UrlFetchApp.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        apikey:          creds.key,
        Authorization:   `Bearer ${creds.key}`,
        Prefer:          "resolution=merge-duplicates,return=minimal",
      },
      payload: JSON.stringify(batch),
      muteHttpExceptions: true,
    });

    const code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      success += batch.length;
      Logger.log(`patchStatus batch OK (${batch.length})`);
    } else {
      failed += batch.length;
      Logger.log(`patchStatus batch fail HTTP ${code}: ${res.getContentText().substring(0, 200)}`);
      break;
    }

    if (i + cfg.BATCH_SIZE < records.length) Utilities.sleep(cfg.SLEEP_BETWEEN_MS);
  }

  return { success, failed };
}

// ================================================================
// SYNC SHEET B STATUS
// 1. Gán DEFAULT_STATUS cho record có STATUS = NULL/empty
// 2. Ghi đè STATUS bằng "Đã giao" / "Đã sx" nếu có trong Sheet B
// 3. Các record đã có STATUS khác → giữ nguyên
// ================================================================
function syncSheetB_Status() {
  Logger.log("========== syncSheetB_Status (v5.6) ==========");
  const cfg = getConfig();
  const overrideLabel = getSheetBOverrideStatusesLabel(cfg);
  recordHeartbeat("running", "sheetB-status");

  try {
    const creds = getCredentials();
    const dbRecords = fetchValidPcodesFromSupabase(creds, cfg);

    if (dbRecords.length === 0) {
      Logger.log("Không có record hợp lệ trong DB");
      recordHeartbeat("success", "no valid records");
      return;
    }

    // Bước 1: Đọc Sheet B → build map { PCODE → STATUS } chỉ với "Đã giao"/"Đã sx"
    const sheetBMap = new Map();
    try {
      const sheetB  = getSheetB();
      const lastRow = sheetB.getLastRow();
      const lastCol = sheetB.getLastColumn();

      if (lastRow >= 2) {
        const headers = sheetB.getRange(1, 1, 1, lastCol).getValues()[0]
          .map(h => String(h).trim().toLowerCase());

        const pcodeIdx  = headers.indexOf(cfg.SHEET_B_PCODE_COL.toLowerCase());
        const statusIdx = headers.indexOf(cfg.SHEET_B_STATUS_COL.toLowerCase());

        if (pcodeIdx  === -1) throw new Error(`Sheet B thiếu cột "${cfg.SHEET_B_PCODE_COL}"`);
        if (statusIdx === -1) throw new Error(`Sheet B thiếu cột "${cfg.SHEET_B_STATUS_COL}"`);

        const allRows = sheetB.getRange(2, 1, lastRow - 1, lastCol).getValues();
        let ignoredNonOverride = 0;

        for (const row of allRows) {
          const pcode  = String(row[pcodeIdx]  || "").trim();
          const status = String(row[statusIdx] || "").trim();

          if (!pcode) continue;

          const overrideStatus = getSheetBOverrideStatus(status, cfg);
          if (overrideStatus) {
            sheetBMap.set(pcode.toUpperCase(), overrideStatus);
          } else {
            ignoredNonOverride++;
          }
        }

        Logger.log(`Sheet B: ${sheetBMap.size} PCODE thuộc ${overrideLabel}, bỏ qua ${ignoredNonOverride} trạng thái khác`);
      } else {
        Logger.log("Sheet B trống");
      }
    } catch (e) {
      Logger.log(`⚠️ Không đọc được Sheet B: ${e.message} → chỉ gán DEFAULT cho NULL`);
    }

    // Bước 2: Build update list
    const toUpdate = [];
    let overrideFromSheetB = 0;
    let setDefault = 0;
    let unchanged = 0;

    for (const dbRow of dbRecords) {
      const pcode    = dbRow[cfg.UPSERT_ON_CONFLICT];
      const dbStatus = dbRow.STATUS || "";
      const key      = String(pcode).trim().toUpperCase();

      let newStatus = null;

      // Ưu tiên 1: Sheet B có "Đã giao" / "Đã sx" → ghi đè
      if (sheetBMap.has(key)) {
        newStatus = sheetBMap.get(key);
        overrideFromSheetB++;
      }
      // Ưu tiên 2: DB STATUS NULL/empty → gán DEFAULT_STATUS
      else if (!dbStatus) {
        newStatus = cfg.DEFAULT_STATUS;
        setDefault++;
      }

      // Chỉ update nếu có thay đổi
      if (newStatus && newStatus !== dbStatus) {
        toUpdate.push({ [cfg.UPSERT_ON_CONFLICT]: pcode, STATUS: newStatus });
      } else {
        unchanged++;
      }
    }

    Logger.log(`${overrideFromSheetB} override (${overrideLabel}), ` +
      `${setDefault} gán default "${cfg.DEFAULT_STATUS}", ${unchanged} giữ nguyên`);
    Logger.log(`Cần update: ${toUpdate.length}`);

    if (toUpdate.length === 0) {
      recordHeartbeat("success", "no status changes");
      return;
    }

    const result = patchStatusBatch(toUpdate, creds, cfg);
    if (result.failed === 0) {
      Logger.log(`${result.success} STATUS updated`);
      recordHeartbeat("success", `status ${result.success} (${overrideFromSheetB} override, ${setDefault} default)`);
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `${result.success} STATUS (${overrideFromSheetB} override, ${setDefault} default)`,
        "Sheet B Sync", 5);
    } else {
      Logger.log(`${result.failed} fail`);
      recordHeartbeat("error", `status: ${result.failed} failed`);
    }

  } catch (e) {
    Logger.log("syncSheetB_Status ERROR: " + e.message);
    recordHeartbeat("error", "status: " + e.message);
    SpreadsheetApp.getActiveSpreadsheet().toast("Lỗi: " + e.message, "Lỗi", 10);
  }

  Logger.log("========== syncSheetB_Status KẾT THÚC ==========");
}

function syncSheetB_DefaultStatus() {
  Logger.log("syncSheetB_DefaultStatus: đã merge vào syncSheetB_Status, skip.");
}

// ================================================================
// SYNC ALL
// ================================================================
function syncAll() {
  Logger.log("========== syncAll ==========");
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = getConfig();
  recordHeartbeat("running", "full-sync");
  ss.toast("Đang full sync (A rồi B)...", "Sync", 5);

  try {
    const creds = getCredentials();

    Logger.log("--- Sheet A full ---");
    const sheetA  = getSheetA();
    const lastCol = sheetA.getLastColumn();
    const allData = sheetA.getRange(1, 1, sheetA.getLastRow(), lastCol).getValues();
    const headers = allData[0];
    const rawRows = allData.slice(1);
    const mapping = mapColumns(headers, cfg);

    const records  = buildRecords(rawRows, mapping, cfg);
    const filtered = filterByCutoff(records, cfg);
    const withUids = filtered.map(r => addStableUid(r, cfg));
    const deduped  = dedupeRecords(withUids, cfg);

    Logger.log(`Sheet A: ${deduped.length}/${rawRows.length} records`);
    const resultA = pushToSupabase(deduped, creds, cfg);

    if (resultA.failed === 0) {
      PropertiesService.getScriptProperties()
        .setProperty("LAST_SYNCED_ROW", sheetA.getLastRow().toString());
    }

    Logger.log("--- Sheet B status (default + overrides) ---");
    syncSheetB_Status();

    recordHeartbeat("success", `full ${resultA.success}+B`);
    ss.toast(`A: ${resultA.success}/${deduped.length}, B: status done`, "Full", 10);

  } catch (e) {
    Logger.log("syncAll ERROR: " + e.message);
    recordHeartbeat("error", e.message);
    ss.toast("Lỗi: " + e.message, "Error", 10);
  }
}

// ================================================================
// CUTOFF FILTER
// ================================================================
function filterByCutoff(records, cfg) {
  if (!cfg.CUTOFF_DATE) return records;
  const cutoff = cfg.CUTOFF_DATE;
  const before = records.length;

  const filtered = records.filter(r => {
    const raw = r.INITIALDATE;
    if (!raw) return false;
    const dateStr = String(raw).substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    return dateStr >= cutoff;
  });

  if (before > filtered.length) {
    Logger.log(`Cutoff filter: ${filtered.length}/${before} ` +
      `(bỏ ${before - filtered.length} record < ${cutoff})`);
  }
  return filtered;
}

// ================================================================
// HEALTH & RECOVERY
// ================================================================
function healthCheckAndRecover() {
  Logger.log("========== healthCheckAndRecover ==========");
  const cfg       = getConfig();
  const props     = PropertiesService.getScriptProperties();
  const now       = new Date();
  const heartbeat = props.getProperty(cfg.HEARTBEAT_KEY);

  if (!heartbeat) {
    try { syncSheetA_Incremental(); } catch (e) { sendAlertEmail("Recovery fail", e.message); }
    return;
  }

  const minAgo = Math.floor((now - new Date(heartbeat)) / 60000);
  if (minAgo > cfg.STALE_THRESHOLD_MIN) {
    Logger.log(`Stale ${minAgo}p, recovery...`);
    try { syncSheetA_Incremental(); }
    catch (e) { sendAlertEmail("Recovery exception", e.message); }
  } else {
    Logger.log(`Healthy (${minAgo}p)`);
  }
}

function healthCheck_Trigger() { healthCheckAndRecover(); }

function dailyAudit() {
  Logger.log("========== dailyAudit ==========");
  const cfg       = getConfig();
  const startTime = new Date();
  const report    = [`DAILY AUDIT — ${formatLocal(startTime)}`, ""];

  try {
    syncAll();
    report.push("Full sync OK");
  } catch (e) {
    report.push(e.message);
  }

  const txt = report.join("\n");
  Logger.log(txt);
  if (cfg.ALERT_EMAIL) {
    try {
      MailApp.sendEmail({
        to:      cfg.ALERT_EMAIL,
        subject: `[DMC Daily] ${formatLocal(startTime).substring(0, 10)}`,
        body:    txt,
      });
    } catch (e) {}
  }
}

// ================================================================
// TRIGGERS
// ================================================================
function setupAllTriggers() {
  const ui  = SpreadsheetApp.getUi();
  const cfg = getConfig();
  removeAllTriggers(true);

  if (!cfg.SHEET_A_FILE_ID) {
    ScriptApp.newTrigger("onEditTrigger")
      .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
      .onEdit().create();
  } else {
    ScriptApp.newTrigger("onEditTrigger")
      .forSpreadsheet(cfg.SHEET_A_FILE_ID)
      .onEdit().create();
  }

  ScriptApp.newTrigger("syncSheetA_Incremental").timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger("syncSheetB_Status").timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger("healthCheckAndRecover").timeBased().everyHours(1).create();
  ScriptApp.newTrigger("dailyAudit")
    .timeBased().everyDays(1).atHour(1)
    .inTimezone(cfg.TIMEZONE_NAME).create();

  ui.alert("Setup Triggers",
    "Đã setup 5 triggers:\n\n" +
    "  1. onEditTrigger — Sheet A real-time\n" +
    "  2. syncSheetA_Incremental — 10 phút\n" +
    "  3. syncSheetB_Status — 10 phút, chỉ Đã giao/Đã sx\n" +
    "  4. healthCheckAndRecover — 1 giờ\n" +
    "  5. dailyAudit — 1h sáng",
    ui.ButtonSet.OK);
}

function removeAllTriggers(silent) {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  if (!silent) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Đã xóa ${triggers.length} triggers`, "Triggers", 8);
  }
}

function removeAllTriggersConfirm() {
  const ui  = SpreadsheetApp.getUi();
  const res = ui.alert("Xóa triggers", "Xác nhận?", ui.ButtonSet.YES_NO);
  if (res === ui.Button.YES) removeAllTriggers(false);
}

// ================================================================
// HEALTH CHECK UI
// ================================================================
function healthCheck() {
  const ui    = SpreadsheetApp.getUi();
  const cfg   = getConfig();
  const props = PropertiesService.getScriptProperties();
  const now   = new Date();
  const r     = ["HEALTH CHECK", "============", `Time: ${formatLocal(now)}`, ""];

  r.push("0. Config:");
  r.push(`   Sheet A: ${cfg.SHEET_A_FILE_ID || "(active)"} / "${cfg.SHEET_A_TAB_NAME}"`);
  r.push(`   Sheet A: KHÔNG push STATUS`);
  r.push(`   Sheet B: ${cfg.SHEET_B_FILE_ID || "(chưa set)"} / "${cfg.SHEET_B_TAB_NAME}"`);
  r.push(`   Sheet B override: ${getSheetBOverrideStatusesLabel(cfg)}`);
  r.push(`   Default STATUS: "${cfg.DEFAULT_STATUS}"`);
  r.push(`   Cutoff:  ${cfg.CUTOFF_DATE || "(không filter)"}`);
  r.push(`   Table:   ${cfg.TABLE_NAME}`);
  r.push(`   UID:     ${props.getProperty("ENABLE_STABLE_UID") === "true" ? "stable" : "off"}`);
  r.push("");

  r.push("1. Supabase:");
  r.push(`   URL: ${props.getProperty("SUPABASE_URL") ? "OK" : "MISSING"}`);
  r.push(`   KEY: ${props.getProperty("SUPABASE_ANON_KEY") ? "OK" : "MISSING"}`);
  r.push("");

  const hb = props.getProperty(cfg.HEARTBEAT_KEY);
  r.push("2. Status:");
  if (hb) {
    const min = Math.floor((now - new Date(hb)) / 60000);
    r.push(`   Last run: ${min}p trước`);
  } else {
    r.push(`   Last run: Never`);
  }
  r.push("");

  r.push("3. Sheet A:");
  try {
    const s       = getSheetA();
    const pointer = props.getProperty("LAST_SYNCED_ROW") || "1";
    r.push(`   OK "${s.getName()}", rows: ${s.getLastRow()}, pointer: ${pointer}`);
  } catch (e) { r.push(`   ERROR ${e.message}`); }

  r.push("4. Sheet B:");
  try {
    const s = getSheetB();
    r.push(`   OK "${s.getName()}", rows: ${s.getLastRow()}`);
  } catch (e) { r.push(`   ERROR ${e.message}`); }
  r.push("");

  r.push("5. Triggers:");
  const trgs = ScriptApp.getProjectTriggers();
  if (trgs.length === 0) r.push(`   KHÔNG CÓ`);
  else trgs.forEach(t => r.push(`   ${t.getHandlerFunction()} (${t.getEventType()})`));

  r.push("");
  r.push("6. Admin auth:");
  r.push(`   Password set:   ${isPasswordSet() ? "YES" : "NO"}`);
  r.push(`   Session active: ${isSessionActive() ? "YES" : "NO"}`);

  ui.alert("Health Check", r.join("\n"), ui.ButtonSet.OK);
}

function showSyncStatus() {
  const cfg = getConfig();
  const hb  = PropertiesService.getScriptProperties().getProperty(cfg.HEARTBEAT_KEY);
  if (!hb) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Chưa chạy", "Status", 10);
    return;
  }
  const min = Math.floor((new Date() - new Date(hb)) / 60000);
  SpreadsheetApp.getActiveSpreadsheet().toast(`${min}p trước`, "Status", 10);
}

// ================================================================
// TRANSFORM
// ================================================================
function mapColumns(sourceHeaders, cfg) {
  const normalized = sourceHeaders.map(h => String(h).trim().toLowerCase());
  const missing    = [];
  const mapping    = cfg.COLUMN_MAP.map(item => {
    const idx = normalized.indexOf(item.source.toLowerCase());
    if (idx === -1) { missing.push(`"${item.source}"`); return null; }
    return { sourceIndex: idx, destName: item.dest, type: item.type, required: item.required };
  });
  if (missing.length > 0) throw new Error(`Thiếu cột: ${missing.join(", ")}`);
  return mapping;
}

function isEmpty(v) { return v === "" || v === null || v === undefined; }

function castValue(value, type, columnName, cfg) {
  if (isEmpty(value)) return null;
  switch (type) {
    case "date":     return toISODate(value, columnName, cfg);
    case "datetime": return toISODateTime(value, columnName, cfg);
    case "number": {
      const n = Number(value);
      return isFinite(n) ? n : null;
    }
    case "string":
    default:
      if (value instanceof Date) {
        if (isNaN(value.getTime())) return null;
        return Utilities.formatDate(value, cfg.TIMEZONE_NAME, "dd/MM/yyyy");
      }
      if (typeof value === "boolean") return value;
      if (typeof value === "number")  return isFinite(value) ? String(value) : null;
      return String(value).trim();
  }
}

function toISODate(value, columnName, cfg) {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return Utilities.formatDate(value, cfg.TIMEZONE_NAME, "yyyy-MM-dd");
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const s = value.trim();
  let m;
  m = s.match(/^\d{1,2}:\d{2}\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return null;
}

function toISODateTime(value, columnName, cfg) {
  const tz     = cfg.TIMEZONE_NAME;
  const offset = cfg.TIMEZONE_OFFSET;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return Utilities.formatDate(value, tz, "yyyy-MM-dd'T'HH:mm:ss") + offset;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const s = value.trim();
  let m;
  m = s.match(/^(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[5]}-${pad2(m[4])}-${pad2(m[3])}T${pad2(m[1])}:${m[2]}:00${offset}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}T00:00:00${offset}`;
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return s + offset;
  m = s.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (m) return `${m[1]}T00:00:00${offset}`;
  return null;
}

function pad2(s) { return String(s).padStart(2, "0"); }

function dedupeRecords(records, cfg) {
  const seen = new Map();
  for (const r of records) seen.set(r[cfg.UPSERT_ON_CONFLICT], r);
  return Array.from(seen.values());
}

// ================================================================
// BUILD RECORDS
// Strip null fields tránh overwrite data tốt bằng null.
// STATUS không có trong COLUMN_MAP — xử lý bởi syncSheetB_Status.
// ================================================================
function stripNullFields(record) {
  const clean = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== null && value !== undefined && value !== "") {
      clean[key] = value;
    }
  }
  return clean;
}

function buildRecords(rawRows, mapping, cfg) {
  const records = [];
  let skipped   = 0;
  const samples = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    const missingRequired = mapping
      .filter(m => m.required)
      .filter(m => isEmpty(row[m.sourceIndex]));

    if (missingRequired.length > 0) {
      skipped++;
      if (samples.length < 3) {
        samples.push({ row: i + 2, missing: missingRequired.map(m => m.destName).join(", ") });
      }
      continue;
    }

    const record = {};
    for (const m of mapping) {
      record[m.destName] = castValue(row[m.sourceIndex], m.type, m.destName, cfg);
    }

    const missingAfterCast = mapping
      .filter(m => m.required)
      .filter(m => record[m.destName] === null || record[m.destName] === undefined);

    if (missingAfterCast.length > 0) {
      skipped++;
      if (samples.length < 3) {
        samples.push({
          row: i + 2,
          missing: "cast->null: " + missingAfterCast.map(m => m.destName).join(", "),
        });
      }
      continue;
    }

    const cleanRecord = stripNullFields(record);
    if (!cleanRecord[cfg.UPSERT_ON_CONFLICT]) { skipped++; continue; }

    records.push(cleanRecord);
  }

  if (skipped > 0) {
    Logger.log(`buildRecords: skip ${skipped} dòng không hợp lệ`);
    samples.forEach(s => Logger.log(`  row ${s.row}: thiếu [${s.missing}]`));
  }

  return records;
}

// ================================================================
// ONEDIT TRIGGER
// ================================================================
function onEditTrigger(e) {
  if (!e || !e.range) return;
  try {
    const cfg         = getConfig();
    const editedSheet = e.range.getSheet();
    const editedFile  = editedSheet.getParent();

    const expectedId = cfg.SHEET_A_FILE_ID ||
      SpreadsheetApp.getActiveSpreadsheet().getId();
    if (editedFile.getId() !== expectedId) return;
    if (editedSheet.getName() !== cfg.SHEET_A_TAB_NAME) return;

    const editedRow = e.range.getRow();
    if (editedRow < 2) return;

    const lastCol = editedSheet.getLastColumn();
    const allData = editedSheet.getRange(1, 1, editedRow, lastCol).getValues();
    const headers = allData[0];
    const row     = allData[editedRow - 1];

    const mapping = mapColumns(headers, cfg);

    const missingRequired = mapping
      .filter(m => m.required)
      .filter(m => isEmpty(row[m.sourceIndex]));

    if (missingRequired.length > 0) {
      Logger.log(`onEdit row ${editedRow}: SKIP — thiếu: ` +
        missingRequired.map(m => `"${m.source}"`).join(", "));
      return;
    }

    const record = {};
    for (const m of mapping) {
      record[m.destName] = castValue(row[m.sourceIndex], m.type, m.destName, cfg);
    }

    const missingAfterCast = mapping
      .filter(m => m.required)
      .filter(m => record[m.destName] === null || record[m.destName] === undefined);

    if (missingAfterCast.length > 0) {
      Logger.log(`onEdit row ${editedRow}: SKIP — null sau cast: ` +
        missingAfterCast.map(m => m.destName).join(", "));
      return;
    }

    const cleanRecord = stripNullFields(record);
    if (!cleanRecord[cfg.UPSERT_ON_CONFLICT]) {
      Logger.log(`onEdit row ${editedRow}: SKIP — PCODE rỗng`);
      return;
    }

    const withUid  = addStableUid(cleanRecord, cfg);
    const filtered = filterByCutoff([withUid], cfg);
    if (filtered.length === 0) {
      Logger.log(`onEdit row ${editedRow}: SKIP — trước cutoff`);
      return;
    }

    const creds  = getCredentials();
    const result = pushToSupabase(filtered, creds, cfg);

    if (result.success > 0) {
      Logger.log(`onEdit row ${editedRow} PCODE="${cleanRecord[cfg.UPSERT_ON_CONFLICT]}" -> Supabase`);
      recordHeartbeat("success", `onEdit row ${editedRow}`);
    } else {
      Logger.log(`onEdit row ${editedRow} push fail`);
    }

  } catch (err) {
    Logger.log("onEditTrigger ERROR: " + err.message);
  }
}

// ================================================================
// SYNC SHEET A INCREMENTAL
// ================================================================
function syncSheetA_Incremental() {
  Logger.log("========== syncSheetA_Incremental (v5.6) ==========");
  const cfg = getConfig();
  recordHeartbeat("running", "sheetA-incremental");

  try {
    const creds      = getCredentials();
    const props      = PropertiesService.getScriptProperties();
    const lastSynced = parseInt(props.getProperty("LAST_SYNCED_ROW") || "1", 10);

    const sheet          = getSheetA();
    const currentLastRow = sheet.getLastRow();

    if (currentLastRow <= lastSynced) {
      Logger.log("Không có dòng mới");
      recordHeartbeat("success", "no new rows");
      return;
    }

    const lastCol = sheet.getLastColumn();
    const numNew  = currentLastRow - lastSynced;

    const allData = sheet.getRange(1, 1, currentLastRow, lastCol).getValues();
    const headers = allData[0];
    const rawRows = allData.slice(lastSynced);

    Logger.log(`Đọc ${numNew} dòng mới (row ${lastSynced + 1} -> ${currentLastRow})`);

    const mapping  = mapColumns(headers, cfg);
    const records  = buildRecords(rawRows, mapping, cfg);
    Logger.log(`Sau validate: ${records.length}/${numNew}`);

    const filtered = filterByCutoff(records, cfg);
    Logger.log(`Sau cutoff: ${filtered.length}/${records.length}`);

    const withUids = filtered.map(r => addStableUid(r, cfg));
    const deduped  = dedupeRecords(withUids, cfg);
    Logger.log(`Sau dedupe: ${deduped.length}`);

    if (deduped.length === 0) {
      props.setProperty("LAST_SYNCED_ROW", currentLastRow.toString());
      recordHeartbeat("success", "no valid records");
      return;
    }

    const result = pushToSupabase(deduped, creds, cfg);

    if (result.failed === 0) {
      props.setProperty("LAST_SYNCED_ROW", currentLastRow.toString());
      Logger.log(`Pointer -> ${currentLastRow}, pushed ${result.success}`);
      recordHeartbeat("success", `sheetA-inc ${result.success}`);
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `Sync ${result.success} YCSX mới`, "Sheet A Sync", 3);
    } else {
      Logger.log(`${result.failed} fail, giữ pointer tại ${lastSynced}`);
      recordHeartbeat("error", `sheetA-inc: ${result.failed} failed`);
      sendAlertEmail("Sheet A sync failed", `${result.failed}/${deduped.length} failed`);
    }

  } catch (e) {
    Logger.log("syncSheetA_Incremental ERROR: " + e.message);
    recordHeartbeat("error", e.message);
    sendAlertEmail("Sheet A exception", e.message);
  }

  Logger.log("========== syncSheetA_Incremental KẾT THÚC ==========");
}

// ================================================================
// SUPABASE PUSH
// ================================================================
function pushToSupabase(records, creds, cfg) {
  if (!records.length) return { success: 0, failed: 0 };
  let success = 0, failed = 0;

  for (let i = 0; i < records.length; i += cfg.BATCH_SIZE) {
    const batch  = records.slice(i, i + cfg.BATCH_SIZE);
    const result = upsertBatch(batch, creds, cfg);
    if (result.ok) success += batch.length;
    else { failed += batch.length; break; }
    if (i + cfg.BATCH_SIZE < records.length) Utilities.sleep(cfg.SLEEP_BETWEEN_MS);
  }

  return { success, failed };
}

function upsertBatch(records, creds, cfg) {
  const url     = `${creds.url}/rest/v1/${cfg.TABLE_NAME}?on_conflict=${cfg.UPSERT_ON_CONFLICT}`;
  const options = {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        creds.key,
      "Authorization": `Bearer ${creds.key}`,
      "Prefer":        "resolution=merge-duplicates,return=minimal",
    },
    payload:            JSON.stringify(records),
    muteHttpExceptions: true,
  };

  for (let attempt = 0; attempt <= cfg.MAX_RETRIES; attempt++) {
    try {
      const res  = UrlFetchApp.fetch(url, options);
      const code = res.getResponseCode();
      if (code >= 200 && code < 300) return { ok: true };
      if ((code === 429 || code === 503) && attempt < cfg.MAX_RETRIES) {
        Utilities.sleep(cfg.RETRY_BASE_MS * Math.pow(2, attempt));
        continue;
      }
      Logger.log(`HTTP ${code}: ${res.getContentText().substring(0, 200)}`);
      return { ok: false };
    } catch (e) {
      const isRl = e.message && (e.message.indexOf("hạn mức") !== -1 ||
        e.message.indexOf("rate") !== -1 || e.message.indexOf("quota") !== -1);
      if (isRl && attempt < cfg.MAX_RETRIES) {
        Utilities.sleep(cfg.RETRY_BASE_MS * Math.pow(2, attempt));
        continue;
      }
      Logger.log(`Exception: ${e.message}`);
      return { ok: false };
    }
  }
  return { ok: false };
}

// ================================================================
// TOOLS
// ================================================================
function insertTestRow() {
  const cfg = getConfig();
  try {
    const creds = getCredentials();
    const test  = { [cfg.UPSERT_ON_CONFLICT]: "TEST-001" };
    cfg.COLUMN_MAP.forEach(m => {
      if (m.dest === cfg.UPSERT_ON_CONFLICT) return;
      switch (m.type) {
        case "date":     test[m.dest] = "2026-01-01"; break;
        case "datetime": test[m.dest] = "2026-01-05T16:30:00" + cfg.TIMEZONE_OFFSET; break;
        case "number":   test[m.dest] = 1; break;
        default:
          test[m.dest] = m.dest === "STATUS" ? cfg.DEFAULT_STATUS : "TEST";
          break;
      }
    });
    if (!test.STATUS) test.STATUS = cfg.DEFAULT_STATUS;
    if (PropertiesService.getScriptProperties().getProperty("ENABLE_STABLE_UID") === "true") {
      test.uid = generateStableUid("TEST-001");
    }
    const result = upsertBatch([test], creds, cfg);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      result.ok ? "Test OK" : "Fail", "Test", 8);
  } catch (e) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Lỗi: " + e.message, "Test", 10);
  }
}

function cleanupTestRow() {
  const cfg = getConfig();
  try {
    const creds = getCredentials();
    const url   = `${creds.url}/rest/v1/${cfg.TABLE_NAME}?${cfg.UPSERT_ON_CONFLICT}=eq.TEST-001`;
    UrlFetchApp.fetch(url, {
      method:  "DELETE",
      headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` },
      muteHttpExceptions: true,
    });
    SpreadsheetApp.getActiveSpreadsheet().toast("Cleaned", "Cleanup", 5);
  } catch (e) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Lỗi: " + e.message, "Cleanup", 10);
  }
}

function resetPointer() {
  PropertiesService.getScriptProperties().deleteProperty("LAST_SYNCED_ROW");
  SpreadsheetApp.getActiveSpreadsheet().toast("Đã reset pointer", "Pointer", 5);
}

// ================================================================
// DEBUG
// ================================================================
function debugStatusNull() {
  Logger.log("========== DEBUG STATUS NULL ==========");
  const cfg   = getConfig();
  const creds = getCredentials();

  const urlNull = `${creds.url}/rest/v1/${cfg.TABLE_NAME}` +
    `?select=${cfg.UPSERT_ON_CONFLICT},STATUS,INITIALDATE` +
    `&STATUS=is.null&limit=20`;
  const resNull = UrlFetchApp.fetch(urlNull, {
    method: "GET",
    headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` },
    muteHttpExceptions: true,
  });
  const nullRecords = JSON.parse(resNull.getContentText());
  Logger.log(`20 record đầu NULL STATUS:`);
  nullRecords.forEach((r, i) => {
    Logger.log(`  ${i+1}. PCODE="${r[cfg.UPSERT_ON_CONFLICT]}" INITIALDATE="${r.INITIALDATE}" STATUS=${r.STATUS}`);
  });

  if (nullRecords.length === 0) { Logger.log("Không có NULL STATUS."); return; }

  const samplePcodes = nullRecords.slice(0, 5).map(r => r[cfg.UPSERT_ON_CONFLICT]);
  Logger.log(`Sample PCODE bị null: ${samplePcodes.join(", ")}`);

  Logger.log("\n--- Check Sheet A ---");
  Logger.log("Sheet A KHÔNG push STATUS (v5.6)");
  Logger.log(`Default STATUS: "${cfg.DEFAULT_STATUS}"`);

  Logger.log("\n--- Check Sheet B status overrides ---");
  try {
    const sheetB  = getSheetB();
    const lastRow = sheetB.getLastRow();
    const lastCol = sheetB.getLastColumn();
    const headers = sheetB.getRange(1, 1, 1, lastCol).getValues()[0]
      .map(h => String(h).trim().toLowerCase());
    Logger.log(`Sheet B headers: ${headers.join(" | ")}`);

    const pcodeIdx  = headers.indexOf(cfg.SHEET_B_PCODE_COL.toLowerCase());
    const statusIdx = headers.indexOf(cfg.SHEET_B_STATUS_COL.toLowerCase());
    Logger.log(`PCODE col: ${pcodeIdx}, STATUS col: ${statusIdx}`);

    if (lastRow >= 2 && pcodeIdx !== -1 && statusIdx !== -1) {
      const allRows  = sheetB.getRange(2, 1, Math.min(lastRow - 1, 1000), lastCol).getValues();
      const sheetBMap = new Map();
      allRows.forEach(row => {
        const pcode  = String(row[pcodeIdx] || "").trim().toUpperCase();
        const status = String(row[statusIdx] || "").trim();
        const overrideStatus = getSheetBOverrideStatus(status, cfg);
        if (pcode && overrideStatus) sheetBMap.set(pcode, overrideStatus);
      });
      Logger.log(`Sheet B overrides (${getSheetBOverrideStatusesLabel(cfg)}): ${sheetBMap.size} PCODE`);
      samplePcodes.forEach(pcode => {
        const key = String(pcode).toUpperCase();
        Logger.log(`  "${pcode}" -> ${sheetBMap.has(key) ? `STATUS="${sheetBMap.get(key)}"` : "không có trạng thái override ở Sheet B"}`);
      });
    }
  } catch (e) { Logger.log(`Sheet B error: ${e.message}`); }

  Logger.log("\n--- Cutoff config ---");
  Logger.log(`Cutoff date: "${cfg.CUTOFF_DATE}"`);
  nullRecords.forEach(r => {
    const initDate = r.INITIALDATE;
    const passes   = !cfg.CUTOFF_DATE || (initDate && initDate >= cfg.CUTOFF_DATE);
    Logger.log(`  PCODE="${r[cfg.UPSERT_ON_CONFLICT]}" INITIALDATE="${initDate}" -> ${passes ? "PASS" : "FAIL cutoff"}`);
  });

  Logger.log("\n========== DEBUG KẾT THÚC ==========");
}

function debugOnEditConfig() {
  Logger.log("========== DEBUG ONEDIT CONFIG ==========");
  const cfg = getConfig();
  Logger.log(`Sheet A File ID: "${cfg.SHEET_A_FILE_ID || "(active)"}"`);
  Logger.log(`Sheet A Tab: "${cfg.SHEET_A_TAB_NAME}"`);
  Logger.log("\nColumn mapping:");
  cfg.COLUMN_MAP.forEach(m => {
    Logger.log(`  ${m.required ? "[REQUIRED]" : "[optional]"} ${m.source} -> ${m.dest} (${m.type})`);
  });
  Logger.log("\nTriggers:");
  ScriptApp.getProjectTriggers().forEach(t => {
    Logger.log(`  ${t.getHandlerFunction()} — ${t.getEventType()}`);
  });
  const activeId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const configId = cfg.SHEET_A_FILE_ID || activeId;
  Logger.log(`\nActive ID: ${activeId}`);
  Logger.log(`Config ID: ${configId}`);
  Logger.log(`Match: ${activeId === configId ? "YES" : "NO — onEdit sẽ không fire"}`);
}

/**
 * Fix 1 lần cho record đang bị NULL STATUS.
 * Chạy syncAll (Sheet A data + syncSheetB_Status gán default + override).
 */
function fixNullStatusOneTime() {
  Logger.log("========== fixNullStatusOneTime v5.6 ==========");
  const cfg   = getConfig();
  const creds = getCredentials();

  const url = `${creds.url}/rest/v1/${cfg.TABLE_NAME}` +
    `?select=${cfg.UPSERT_ON_CONFLICT},STATUS&STATUS=is.null&limit=10000`;

  const beforeRes = UrlFetchApp.fetch(url, {
    method: "GET",
    headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` },
    muteHttpExceptions: true,
  });
  const beforeNull = JSON.parse(beforeRes.getContentText());
  Logger.log(`${beforeNull.length} record NULL STATUS trước khi fix`);

  syncAll();

  const afterRes = UrlFetchApp.fetch(url, {
    method: "GET",
    headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` },
    muteHttpExceptions: true,
  });
  const afterNull = JSON.parse(afterRes.getContentText());
  Logger.log(`${afterNull.length} record NULL STATUS sau khi fix`);

  SpreadsheetApp.getActiveSpreadsheet().toast(
    `NULL STATUS: ${beforeNull.length} -> ${afterNull.length}`,
    "Fix NULL", 8);

  Logger.log("========== fixNullStatusOneTime KẾT THÚC ==========");
}
