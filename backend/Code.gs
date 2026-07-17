/**
 * Registro de Peso — backend (Google Apps Script)
 * API JSON sobre la Google Sheet que actúa como base de datos. El frontend
 * (GitHub Pages, estático) le pega a esto por fetch(); este script no sirve HTML.
 */

var SPREADSHEET_ID = '1ZYoBPSLDR3CuYrv_6bkFDoMCLxjlAIkqIYYCn8sP4JI';

var PROFILES = [
  { key: 'ivan', sheetName: 'Iván ', name: 'Iván', type: 'person', icon: '🧔' },
  { key: 'isa', sheetName: 'Isa', name: 'Isa', type: 'person', icon: '👩' },
  { key: 'yami', sheetName: 'Yami', name: 'Yami', type: 'pet', icon: '🐱' },
  { key: 'yoshi', sheetName: 'Yoshi', name: 'Yoshi', type: 'pet', icon: '🐱' },
  { key: 'spike', sheetName: 'Spike', name: 'Spike', type: 'pet', icon: '🐱' }
];

function doGet(e) {
  return handleRequest_(e.parameter.action, e.parameter);
}

// El body va como text/plain (no application/json) a propósito: eso mantiene
// el POST como "simple request" y evita el preflight OPTIONS, que Apps
// Script no puede responder con los headers CORS que un fetch cross-origin necesita.
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { /* body inválido: sigue vacío */ }
  return handleRequest_(body.action, body);
}

function handleRequest_(action, params) {
  var result;
  try {
    if (action === 'profiles') result = getProfiles();
    else if (action === 'data') result = getProfileData(params.profile);
    else if (action === 'addRecord') result = addRecord(params.profileKey, params.data);
    else throw new Error('Acción desconocida: ' + action);
    return jsonOutput_({ ok: true, result: result });
  } catch (err) {
    return jsonOutput_({ ok: false, error: err.message });
  }
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getProfiles() {
  return PROFILES.map(function (p) {
    return { key: p.key, name: p.name, type: p.type, icon: p.icon };
  });
}

function findProfile_(profileKey) {
  var profile = null;
  for (var i = 0; i < PROFILES.length; i++) {
    if (PROFILES[i].key === profileKey) profile = PROFILES[i];
  }
  if (!profile) throw new Error('Perfil no encontrado: ' + profileKey);
  return profile;
}

function getSheet_(profileKey) {
  var profile = findProfile_(profileKey);
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(profile.sheetName);
  if (!sheet) throw new Error('Hoja no encontrada: ' + profile.sheetName);
  return { profile: profile, sheet: sheet };
}

function parseNumber_(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  var cleaned = String(value).replace(/kg/i, '').trim().replace(',', '.');
  var n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Lee y normaliza los registros + objetivo de un perfil. */
function getProfileData(profileKey) {
  var found = getSheet_(profileKey);
  var profile = found.profile;
  var sheet = found.sheet;
  var lastRow = sheet.getLastRow();
  var records = [];
  var objetivo = null;

  if (profile.type === 'person') {
    var objetivoRow = sheet.getRange(1, 2, 1, 5).getValues()[0];
    objetivo = {
      peso: parseNumber_(objetivoRow[0]),
      grasa: parseNumber_(objetivoRow[1]),
      masaMagra: parseNumber_(objetivoRow[2]),
      edad: parseNumber_(objetivoRow[3]),
      grasaVisceral: parseNumber_(objetivoRow[4])
    };
    var numDataRows = Math.max(0, lastRow - 2);
    var raw = numDataRows > 0 ? sheet.getRange(3, 1, numDataRows, 6).getValues() : [];
    records = raw
      .filter(function (r) { return r[0] instanceof Date; })
      .map(function (r) {
        return {
          date: formatDate_(r[0]),
          peso: parseNumber_(r[1]),
          grasa: parseNumber_(r[2]),
          masaMagra: parseNumber_(r[3]),
          edad: parseNumber_(r[4]),
          grasaVisceral: parseNumber_(r[5])
        };
      });
  } else {
    var numRows = Math.max(0, lastRow);
    var rawPet = numRows > 0 ? sheet.getRange(1, 1, numRows, 2).getValues() : [];
    records = rawPet
      .filter(function (r) { return r[0] instanceof Date; })
      .map(function (r) {
        return { date: formatDate_(r[0]), peso: parseNumber_(r[1]) };
      });
  }

  records.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

  var metricKeys = profile.type === 'person'
    ? ['peso', 'grasa', 'masaMagra', 'edad', 'grasaVisceral']
    : ['peso'];

  var stats = {};
  metricKeys.forEach(function (key) {
    stats[key] = computeMetricStats_(records, key, objetivo ? objetivo[key] : null);
  });

  return {
    profile: profile,
    objetivo: objetivo,
    records: records,
    stats: stats
  };
}

function computeMetricStats_(records, key, goal) {
  var vals = records.filter(function (r) { return r[key] !== null && r[key] !== undefined; });
  if (!vals.length) return null;

  var current = vals[vals.length - 1][key];
  var start = vals[0][key];
  var currentDate = new Date(vals[vals.length - 1].date + 'T00:00:00');

  var findAsOf = function (daysAgo) {
    var target = new Date(currentDate);
    target.setDate(target.getDate() - daysAgo);
    var candidate = null;
    for (var i = 0; i < vals.length; i++) {
      if (new Date(vals[i].date + 'T00:00:00') <= target) candidate = vals[i];
    }
    return candidate ? candidate[key] : null;
  };

  var v7 = findAsOf(7);
  var v30 = findAsOf(30);
  var min = Math.min.apply(null, vals.map(function (r) { return r[key]; }));
  var max = Math.max.apply(null, vals.map(function (r) { return r[key]; }));
  var sparkline = vals.slice(-12).map(function (r) { return r[key]; });

  var progress = null;
  var goodDirection = null;
  if (goal !== null && goal !== undefined) {
    if (goal === start) {
      progress = current === goal ? 100 : 0;
    } else {
      progress = ((current - start) / (goal - start)) * 100;
      progress = Math.max(0, Math.min(100, progress));
    }
    goodDirection = goal < start ? 'down' : goal > start ? 'up' : null;
  }

  return {
    current: current,
    start: start,
    min: min,
    max: max,
    delta7: v7 !== null ? current - v7 : null,
    delta30: v30 !== null ? current - v30 : null,
    goal: goal !== undefined ? goal : null,
    progress: progress,
    goodDirection: goodDirection,
    sparkline: sparkline
  };
}

/** Agrega un nuevo registro para el perfil indicado y devuelve los datos actualizados. */
function addRecord(profileKey, data) {
  var found = getSheet_(profileKey);
  var profile = found.profile;
  var sheet = found.sheet;

  if (!data || !data.date) throw new Error('Falta la fecha');
  var date = new Date(data.date + 'T00:00:00');
  if (isNaN(date.getTime())) throw new Error('Fecha inválida');

  var peso = parseNumber_(data.peso);
  if (peso === null) throw new Error('El peso es obligatorio y debe ser un número');

  if (profile.type === 'person') {
    var grasaPct = parseNumber_(data.grasa);
    var row = [
      date,
      peso,
      grasaPct !== null ? grasaPct / 100 : '',
      parseNumber_(data.masaMagra),
      parseNumber_(data.edad),
      parseNumber_(data.grasaVisceral)
    ].map(function (v) { return v === null ? '' : v; });
    sheet.appendRow(row);
  } else {
    sheet.appendRow([date, peso]);
  }

  return getProfileData(profileKey);
}
