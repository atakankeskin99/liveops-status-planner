// -----------------------------
// 1) Sabit veri: çalışanlar + slotlar
// -----------------------------

const EMPLOYEES = [
  "Elif Yıldırım",
  "Mert Arslan",
  "Zeynep Kaya",
  "Burak Demirtaş",
  "Sena Çelik",
  "Emre Aydın",
  "Derya Koç",
  "Onur Şahin",
  "Gizem Kurt",
  "Kaan Yalçın",
  "Buse Aksoy",
  "Tolga Özkan",
  "İrem Polat",
  "Serkan Doğan",
  "Nazlı Kılıç",
  "Ege Karaman",
  "Melis Türkmen",
  "Umut Erdem",
  "Selin Acar",
  "Oğuzhan Çetin",
  "Rabia Şimşek",
  "Hakan Taş",
  "Ceyda Güneş",
  "Barış Eren",
  "Asena Toprak",
  "Kerem Bulut",
  "Yağmur Işık",
  "Furkan Avcı",
  "Deniz Öztürk",
];

const SLOTS = [
  { id: "0830-0900", start: "08:30", end: "09:00", mode: "DISTRIBUTE_ALL" },
  { id: "0900-1030", start: "09:00", end: "10:30", mode: "DISTRIBUTE" },
  { id: "1030-1230", start: "10:30", end: "12:30", mode: "DISTRIBUTE" },
  { id: "1231-1400", start: "12:31", end: "14:00", mode: "DISTRIBUTE" },
  { id: "1401-1530", start: "14:01", end: "15:30", mode: "DISTRIBUTE" },
  { id: "1531-1730", start: "15:31", end: "17:30", mode: "DISTRIBUTE" },
  { id: "1731-1900", start: "17:31", end: "19:00", mode: "DISTRIBUTE" },
  { id: "1901-2030", start: "19:01", end: "20:30", mode: "DISTRIBUTE" },
  { id: "2031-2230", start: "20:31", end: "22:30", mode: "DISTRIBUTE" },
  { id: "2231-0030", start: "22:31", end: "00:30", mode: "NIGHT_SPLIT", crossesMidnight: true },
];


const SHIFT_PRESETS = [
  { id: "custom", label: "— Shift seç —", slotIds: [] },

  // Net slot sınırına oturanlar
  { id: "0900-1900", label: "09:00 - 19:00", slotIds: [
    "0900-1030","1030-1230","1231-1400","1401-1530","1531-1730","1731-1900"
  ]},
  { id: "1030-2030", label: "10:30 - 20:30", slotIds: [
    "1030-1230","1231-1400","1401-1530","1531-1730","1731-1900","1901-2030"
  ]},
  { id: "1230-2230", label: "12:30 - 22:30", slotIds: [
    "1231-1400","1401-1530","1531-1730","1731-1900","1901-2030","2031-2230"
  ]},
  { id: "1400-0030", label: "14:00 - 00:30", slotIds: [
    "1401-1530","1531-1730","1731-1900","1901-2030","2031-2230","2231-0030"
  ]},

  // Yuvarlananlar (slot mantığına uygun, kullanıcıya kolay)
  { id: "1130-2130", label: "11:30 - 21:30", slotIds: [
    "1231-1400","1401-1530","1531-1730","1731-1900","1901-2030","2031-2230"
  ]},
  { id: "1300-0000", label: "13:00 - 00:00", slotIds: [
    "1401-1530","1531-1730","1731-1900","1901-2030","2031-2230","2231-0030"
  ]},

  // ÖZEL KURAL: UI 18:30 dese de checkbox’ta 19:00’a kadar işaretli
  { id: "0830-1830", label: "08:30 - 18:30", slotIds: [
    "0830-0900","0900-1030","1030-1230","1231-1400","1401-1530","1531-1730","1731-1900"
  ]},
];

function applyShiftPreset(employeeName, presetId) {
  const preset = SHIFT_PRESETS.find(p => p.id === presetId);
  if (!preset) return;

  // Önce hepsini kapat
  for (const s of SLOTS) state.attendance[employeeName][s.id] = false;

  // Sonra preset slotlarını aç
  for (const slotId of preset.slotIds) {
    if (state.attendance[employeeName][slotId] !== undefined) {
      state.attendance[employeeName][slotId] = true;
    }
  }
}


const MAX_STREAK = 3;

// -----------------------------
// 2) Parser: statü satırı -> obje
// -----------------------------

function normalizeRegion(regionRaw) {
  const r = regionRaw.trim();

  // birleşik yazım: Güney-Kuzey Ege => bundle
  const egeBundlePatterns = [
    /güney\s*[-/]\s*kuzey\s*ege/i,
    /kuzey\s*[-/]\s*güney\s*ege/i,
    /güney\s*ve\s*kuzey\s*ege/i,
    /güney\s*-\s*kuzey\s*ege/i,
    /güney\s*kuzey\s*ege/i,
  ];

  const isEgeBundle = egeBundlePatterns.some((re) => re.test(r));
  if (isEgeBundle) return { region: "Ege (Kuzey+Güney)", isEgeBundle: true };

  return { region: r, isEgeBundle: false };
}

function slugifyTr(s) {
  return s
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9+ -]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function parseStatusLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Kabul ettiğimiz format:
  // "Hemen- Kurye Mağazada (İç Anadolu)"
  // "Yemek- Yolda & Adreste (Genel)"
  // "Yemek Genel" / "Hemen Genel" gibi satırlar da gelebilir.
  const generalMatch = trimmed.match(/^(Hemen|Yemek)\s*Genel$/i);
  if (generalMatch) {
    const category = generalMatch[1].toUpperCase();
    return {
      id: `${category.toLowerCase()}__genel__genel`,
      category,
      action: "Genel",
      region: "Genel",
      isEgeBundle: false,
      label: `${generalMatch[1]} - Genel (Genel)`,
    };
  }

  const match = trimmed.match(/^(Hemen|Yemek)\s*-\s*(.+?)\s*\((.+)\)\s*$/i);
  if (!match) return null;

  const category = match[1].toUpperCase();
  const action = match[2].replace(/\s+/g, " ").trim();
  const { region, isEgeBundle } = normalizeRegion(match[3]);

  const id = `${category.toLowerCase()}__${slugifyTr(action)}__${slugifyTr(region)}`;

  return {
    id,
    category,  // HEMEN | YEMEK
    action,
    region,
    isEgeBundle,
    label: `${match[1]} - ${action} (${region})`,
  };
}

function parseStatuses(multilineText) {
  return multilineText
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(parseStatusLine)
    .filter(Boolean);
}

// -----------------------------
// 3) UI: Katılım tablosu + slot editörleri
// -----------------------------

const attendanceTable = document.getElementById("attendanceTable");
const planTable = document.getElementById("planTable");
const slotEditors = document.getElementById("slotEditors");

const btnSelectAllSlots = document.getElementById("btnSelectAllSlots");
const btnClearAllSlots = document.getElementById("btnClearAllSlots");
const btnGenerate = document.getElementById("btnGenerate");

// Modal
const modal = document.getElementById("modal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalText = document.getElementById("modalText");
const modalList = document.getElementById("modalList");
const btnModalOk = document.getElementById("btnModalOk");

function openModal({ text, items }) {
  modalText.textContent = text;
  modalList.innerHTML = "";
  for (const it of items) {
    const li = document.createElement("li");
    li.textContent = it;
    modalList.appendChild(li);
  }
  modal.classList.remove("hidden");
  modalBackdrop.classList.remove("hidden");

  return new Promise((resolve) => {
    btnModalOk.onclick = () => {
      modal.classList.add("hidden");
      modalBackdrop.classList.add("hidden");
      resolve(true);
    };
  });
}

// attendance state: employeeId -> slotId -> boolean
const state = {
  attendance: {},
  slotText: {},
  shiftPreset: {},   // ✅ ekle
};

// initialize state
for (const name of EMPLOYEES) {
  state.attendance[name] = {};
  for (const s of SLOTS) state.attendance[name][s.id] = true; // default açık
}
for (const s of SLOTS) state.slotText[s.id] = "";

// Build attendance table
function renderAttendanceTable() {
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const th0 = document.createElement("th");
  th0.textContent = "Çalışan";
  headRow.appendChild(th0);

  for (const s of SLOTS) {
    const th = document.createElement("th");
    th.innerHTML = `<div>
      <div><strong>${s.start}–${s.end}</strong></div>
      <div class="muted">${s.mode}</div>
    </div>`;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");

  for (const name of EMPLOYEES) {
    const tr = document.createElement("tr");

    // ✅ İsim + dropdown hücresi
    const tdName = document.createElement("td");
    tdName.innerHTML = `
      <div class="cellCol" style="gap:10px; justify-content:flex-start;">
        <div style="min-width:170px;">
          <div><strong>${name}</strong></div>
          <div class="muted" style="margin-top:4px;">Shift seç → otomatik işaretle</div>
        </div>

        <select class="shiftSelect">
          ${SHIFT_PRESETS.map(p => `<option value="${p.id}">${p.label}</option>`).join("")}
        </select>
      </div>
    `;

    // ✅ Event binding
    const select = tdName.querySelector(".shiftSelect");

// 🔹 render sonrası dropdown eski seçimi korusun
select.value = state.shiftPreset[name] || "custom";

select.addEventListener("change", () => {
  const presetId = select.value;

  if (presetId === "custom") {
    delete state.shiftPreset[name];   // custom = kaydı sil, manuel moda dön
    return;
  }

  state.shiftPreset[name] = presetId;
  applyShiftPreset(name, presetId);
  renderAttendanceTable();
});

    tr.appendChild(tdName);

    // ✅ Checkbox hücreleri
    for (const s of SLOTS) {
      const td = document.createElement("td");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!state.attendance[name][s.id];
      cb.onchange = () => {
  state.attendance[name][s.id] = cb.checked;
  delete state.shiftPreset[name];  
  renderAttendanceTable();          
};

      td.appendChild(cb);
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  attendanceTable.innerHTML = "";
  attendanceTable.appendChild(thead);
  attendanceTable.appendChild(tbody);
}

// Build slot editors
function renderSlotEditors() {
  slotEditors.innerHTML = "";

  for (const s of SLOTS) {
    const wrap = document.createElement("div");
    wrap.className = "slotEditor";

    wrap.innerHTML = `
      <div class="slotEditorHeader">
        <div>
          <strong>${s.start}–${s.end}</strong>
          <span class="muted"> • ${s.mode}</span>
        </div>
        <div class="muted">${s.id}</div>
      </div>
      <textarea id="ta-${s.id}" placeholder="Bu slota ait statüleri satır satır yapıştır..."></textarea>
    `;

    slotEditors.appendChild(wrap);

    const ta = wrap.querySelector(`#ta-${s.id}`);
    ta.value = state.slotText[s.id] || "";
    ta.addEventListener("input", () => {
      state.slotText[s.id] = ta.value;
    });
  }
}

// Quick actions
btnSelectAllSlots.addEventListener("click", () => {
  for (const name of EMPLOYEES) for (const s of SLOTS) state.attendance[name][s.id] = true;
  renderAttendanceTable();
});
btnClearAllSlots.addEventListener("click", () => {
  for (const name of EMPLOYEES) for (const s of SLOTS) state.attendance[name][s.id] = false;
  renderAttendanceTable();
});

// -----------------------------
// 4) Atama Motoru (streak + çeşitlilik)
// -----------------------------

function initStats() {
  const stats = {};
  for (const name of EMPLOYEES) {
    stats[name] = {
      lastCategory: null,
      streak: 0,
      categoryCount: { HEMEN: 0, YEMEK: 0 },
      actionCount: {},     // action -> count
      statusCount: {},     // statusId -> count
      totalAssigned: 0,
      lastAction: null,
    };
  }
  return stats;
}

function canTake(statsEmp, category) {
  if (statsEmp.lastCategory === category) return statsEmp.streak < MAX_STREAK;
  return true;
}

function scoreCandidate(statsEmp, status) {
  // Düşük skor daha iyi
  const cat = status.category;
  const action = status.action;

  const catCount = statsEmp.categoryCount[cat] || 0;
  const actionCount = statsEmp.actionCount[action] || 0;
  const stCount = statsEmp.statusCount[status.id] || 0;

  const sameCatPenalty = (statsEmp.lastCategory === cat) ? (statsEmp.streak * 6) : 0;
  const sameActionPenalty = (statsEmp.lastAction === action) ? 7 : 0;

  return (
    catCount * 10 +
    actionCount * 6 +
    stCount * 12 +
    statsEmp.totalAssigned * 1 +
    sameCatPenalty +
    sameActionPenalty
  );
}

function applyAssignment(statsEmp, status) {
  const cat = status.category;
  const action = status.action;

  if (statsEmp.lastCategory === cat) statsEmp.streak += 1;
  else {
    statsEmp.lastCategory = cat;
    statsEmp.streak = 1;
  }

  statsEmp.categoryCount[cat] = (statsEmp.categoryCount[cat] || 0) + 1;
  statsEmp.actionCount[action] = (statsEmp.actionCount[action] || 0) + 1;
  statsEmp.statusCount[status.id] = (statsEmp.statusCount[status.id] || 0) + 1;

  statsEmp.totalAssigned += 1;
  statsEmp.lastAction = action;
}

function getActiveEmployeesForSlot(slotId) {
  return EMPLOYEES.filter((name) => state.attendance[name][slotId]);
}

function pickBestEmployee(candidates, stats, status, alreadyAssignedThisSlot) {
  let best = null;
  let bestScore = Infinity;

  for (const name of candidates) {
    if (alreadyAssignedThisSlot.has(name)) continue;

    const st = stats[name];
    if (!canTake(st, status.category)) continue;

    const sc = scoreCandidate(st, status);
    if (sc < bestScore) {
      bestScore = sc;
      best = name;
    }
  }

  return best;
}

function pickBestEmployeeRelaxed(candidates, stats, status, alreadyAssignedThisSlot) {
  // streak kuralını görmezden gelen SON ÇARE seçim
  let best = null;
  let bestScore = Infinity;

  for (const name of candidates) {
    if (alreadyAssignedThisSlot.has(name)) continue;

    const st = stats[name];
    const sc = scoreCandidate(st, status) + 1000; // büyük ceza

    if (sc < bestScore) {
      bestScore = sc;
      best = name;
    }
  }

  return best;
}


function formatNightCell(type) {
  // type: "HEMEN_ALL" | "YEMEK_ALL"
  return type === "HEMEN_ALL" ? "TÜM HEMEN" : "TÜM YEMEK";
}

function pickNightResponsibles(active, stats) {
  // 1 kişi tüm Hemen, 1 kişi tüm Yemek
  // Basit ve mantıklı: kategori sayısı az olana o kategori
  // streak patlatmayacak şekilde seç
  let bestH = null, bestHScore = Infinity;
  let bestY = null, bestYScore = Infinity;

  for (const name of active) {
    const st = stats[name];

    // HEMEN sorumlusu için skor
    const hPenalty = (st.categoryCount.HEMEN || 0) * 10 + ((st.lastCategory === "HEMEN") ? (st.streak * 6) : 0);
    if (canTake(st, "HEMEN") && hPenalty < bestHScore) {
      bestHScore = hPenalty; bestH = name;
    }

    // YEMEK sorumlusu için skor
    const yPenalty = (st.categoryCount.YEMEK || 0) * 10 + ((st.lastCategory === "YEMEK") ? (st.streak * 6) : 0);
    if (canTake(st, "YEMEK") && yPenalty < bestYScore) {
      bestYScore = yPenalty; bestY = name;
    }
  }

  // Aynı kişi çıkarsa: ikinci en iyiyi ararız (minimum mantık)
  if (bestH && bestY && bestH === bestY) {
    // YEMEK için alternatif bul
    let altY = null, altScore = Infinity;
    for (const name of active) {
      if (name === bestH) continue;
      const st = stats[name];
      const yPenalty = (st.categoryCount.YEMEK || 0) * 10 + ((st.lastCategory === "YEMEK") ? (st.streak * 6) : 0);
      if (canTake(st, "YEMEK") && yPenalty < altScore) {
        altScore = yPenalty; altY = name;
      }
    }
    if (altY) bestY = altY;
  }

  return { hemenAll: bestH, yemekAll: bestY };
}

// Generate plan
btnGenerate.addEventListener("click", async () => {
  const stats = initStats();

  // plan: employee -> slotId -> cell text
  const plan = {};
  for (const name of EMPLOYEES) plan[name] = {};

  for (const slot of SLOTS) {
    const active = getActiveEmployeesForSlot(slot.id);

    if (slot.mode === "NIGHT_SPLIT") {
      const { hemenAll, yemekAll } = pickNightResponsibles(active, stats);

      if (hemenAll) {
        plan[hemenAll][slot.id] = formatNightCell("HEMEN_ALL");
        applyAssignment(stats[hemenAll], { id: "hemen_all", category: "HEMEN", action: "ALL", region: "ALL" });
      }
      if (yemekAll) {
        plan[yemekAll][slot.id] = formatNightCell("YEMEK_ALL");
        applyAssignment(stats[yemekAll], { id: "yemek_all", category: "YEMEK", action: "ALL", region: "ALL" });
      }

      continue;
    }

    const statuses = parseStatuses(state.slotText[slot.id] || "");
    if (statuses.length === 0) {
      // hiç statü girilmediyse skip
      continue;
    }

    // Fazla statü => kullanıcıya sor => boş bırak
    if (statuses.length > active.length) {
      const extra = statuses.slice(active.length).map((s) => s.label);
      await openModal({
        text: `${slot.start}–${slot.end} için ${statuses.length} statü var, ${active.length} aktif kişi var. Fazlalık statüler BOŞ bırakılacak:`,
        items: extra,
      });
    }

   // 1) Statü azsa: cycle ile aktif kişi sayısına tamamla
const assignable = [];
for (let i = 0; i < active.length; i++) {
  assignable.push(statuses[i % statuses.length]);
}

const alreadyAssignedThisSlot = new Set();

for (const status of assignable) {
  // 2) Önce normal seçim (streak kuralına uyarak)
  let emp = pickBestEmployee(active, stats, status, alreadyAssignedThisSlot);

  // 3) Uygun kimse yoksa: relaxed seçim (streak'i esneterek) -> boş bırakma yok
  let violated = false;
  if (!emp) {
    emp = pickBestEmployeeRelaxed(active, stats, status, alreadyAssignedThisSlot);
    violated = true;
  }

  // 4) Gerçekten hiç aday yoksa (çok uç): o statüyü "UNASSIGNED" say
  // Bu genelde ancak active listesi boşsa olur.
  if (!emp) {
    continue;
  }

  plan[emp][slot.id] = violated ? `⚠ ${status.label}` : status.label;
  alreadyAssignedThisSlot.add(emp);
  applyAssignment(stats[emp], status);
}
  }

  renderPlanTable(plan);
});

function renderPlanTable(plan) {
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const th0 = document.createElement("th");
  th0.textContent = "Çalışan";
  headRow.appendChild(th0);

  for (const s of SLOTS) {
    const th = document.createElement("th");
    th.innerHTML = `<div><strong>${s.start}–${s.end}</strong><div class="muted">${s.mode}</div></div>`;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");

  for (const name of EMPLOYEES) {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = name;
    tr.appendChild(tdName);

    for (const s of SLOTS) {
      const td = document.createElement("td");
      td.textContent = plan[name]?.[s.id] || "";
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  planTable.innerHTML = "";
  planTable.appendChild(thead);
  planTable.appendChild(tbody);
}

// initial render
renderAttendanceTable();
renderSlotEditors();