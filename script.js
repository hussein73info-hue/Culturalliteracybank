// ══════════════════════════════════════════════
//  المنهج الدراسي
// ══════════════════════════════════════════════
var CUR = {
  1:{name:'الفصل الأول',color:'#1a5276',units:[
    {id:1,name:'الدورة المحاسبية في المؤسسات الخدمية',lessons:['الدورة المحاسبية: المفهوم، والمراحل','نظرية القيد المزدوج والعمليات المالية','تسجيل القيود المحاسبية','دفتر اليومية','دفتر الأستاذ','ميزان المراجعة']},
    {id:2,name:'القوائم المالية والتحليل المالي',lessons:['القوائم المالية: المفهوم، الأنواع، والأهمية','إقفال الحسابات','التحليل المالي: المفهوم، والأهمية','التحليل المالي والنسب']},
    {id:3,name:'القطاع المالي',lessons:['الأسواق المالية: المفهوم، الأنواع، والأهمية','الأصول المالية: المفهوم، والأنواع','البنك المركزي الأردني والسياسة النقدية','دور البنك المركزي الأردني في المحافظة على الاستقرار المصرفي والمالي']}
  ]},
  2:{name:'الفصل الثاني',color:'#1e6b4a',units:[
    {id:4,name:'المؤسسات المالية الدولية: صندوق النقد الدولي والبنك الدولي',lessons:['المؤسسات المالية الدولية: نشأتها، وأنواعها','صندوق النقد الدولي','البنك الدولي']},
    {id:5,name:'الاستدامة المالية',lessons:['مُقدّمة في الاستدامة المالية','الاستدامة المالية: التحدّيات، والحلول','الاقتصاد الأخضر والاستدامة']},
    {id:6,name:'الذكاء الاصطناعي التوليدي في عالَم المال والأعمال',lessons:['الذكاء الاصطناعي التوليدي','الذكاء الاصطناعي التوليدي وعالَم المال','الذكاء الاصطناعي التوليدي وخصوصية البيانات','الذكاء الاصطناعي التوليدي وأخلاقيات الأعمال']},
    {id:7,name:'السياسات الاقتصادية وتأثيرها في التنمية والمجتمع',lessons:['مُقدّمة في السياسات الاقتصادية والسياسة المالية','تأثير السياسة المالية في النشاط الاقتصادي','السياسة النقدية: أدواتها، وتأثيرها في النشاط الاقتصادي','السياسة التجارية والسياسة الصناعية']}
  ]}
};

var LBL = ['أ','ب','ج','د'];
var currentMode = 'train';
var currentQuiz = [];
var currentQuizTitle = '';
var userAnswers = {};
var timerInterval = null;
var timeLeft = 0;
var pageHistory = [];
var currentPageId = 'home';
var quizOriginPage = 'home';
var quizSubmitted = false;

// ══════════════════════════════════════════════
//  وضع المحرر (Editor Mode) — تفعيل بكلمة مرور
// ══════════════════════════════════════════════
// كلمة المرور — يمكنك تغييرها هنا فقط (لا تظهر للزائر العادي)
var EDITOR_PASSWORD = 'hussein2024';

// حالة وضع المحرر
var editorMode = false;

// ══════════════════════════════════════════════
//  فصل بنوك الأسئلة: اختبار حسب الدرس vs اختبار حسب الوحدة والنماذج الوزارية
// ══════════════════════════════════════════════

// 1) البنك المستقل الخاص باختبار حسب الدرس
var lessonBank = [];
var lessonBankIndexById = {};

// 2) البنك المستقل الخاص باختبار حسب الوحدة والنماذج الوزارية
var unitMinisterialBank = [];
var unitBankIndexById = {};

// تصنيف الاختبار الجاري ('lesson' أو 'unit_ministerial')
var currentQuizCategory = 'lesson';

// حالة مزامنة Firebase السحابية لمنع التكرار
var firestoreSyncInProgress = false;
window.firestoreSyncInProgress = false;

// نسخ عميق لكائن السؤال لحماية الأصل
function cloneQuestion(q) {
  if (!q) return null;
  return {
    id: q.id,
    sem: q.sem,
    unit: q.unit,
    unitName: q.unitName || '',
    lesson: q.lesson || '',
    hint: (q.hint !== undefined && q.hint !== null) ? String(q.hint) : '',
    text: q.text || '',
    options: Array.isArray(q.options) ? q.options.slice() : [],
    answer: typeof q.answer === 'number' ? q.answer : 0,
    _examKey: q._examKey || '',
    _model: q._model || '',
    createdAt: q.createdAt || null
  };
}

// بناء فهرس بحث سريع بالـ id
function buildIndexedMap(arr) {
  var idx = {};
  if (Array.isArray(arr)) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].id !== undefined) {
        idx[arr[i].id] = i;
      }
    }
  }
  return idx;
}

// فهرس سريع للتوافق العام القديم
function buildBankIndex(){
  return buildIndexedMap(currentQuizCategory === 'unit_ministerial' ? unitMinisterialBank : lessonBank);
}
var bankIndexById = {};

// حفظ التلميحات الأصلية من بنك الأسئلة الأساسي
var originalHintsById = {};
if (typeof bank !== 'undefined' && Array.isArray(bank)) {
  bank.forEach(function(q){
    if (q && q.id !== undefined && q.hint) {
      originalHintsById[q.id] = q.hint;
    }
  });
}

// دالة تطبيق بيانات الكاش السحابي المخزنة محلياً
function applyCachedCloudData() {
  try {
    var raw = localStorage.getItem('qbank_cached_cloud_payload');
    if (!raw) return false;
    var cached = JSON.parse(raw);
    if (!cached || !cached.success) return false;

    var changedLesson = false;
    var changedUnit = false;

    var lessonData = cached.lesson || { overrides: cached.overrides, additions: cached.additions, deletions: cached.deletions };
    if (lessonData && lessonBank) {
      changedLesson = applyCloudDatasetToBank(lessonBank, lessonData, 'lesson');
      if (changedLesson) {
        lessonBankIndexById = buildIndexedMap(lessonBank);
      }
    }

    var unitMinData = cached.unitMinisterial;
    if (unitMinData && unitMinisterialBank) {
      changedUnit = applyCloudDatasetToBank(unitMinisterialBank, unitMinData, 'unit_ministerial');
      if (changedUnit) {
        unitBankIndexById = buildIndexedMap(unitMinisterialBank);
      }
    }

    bankIndexById = (currentQuizCategory === 'unit_ministerial') ? unitBankIndexById : lessonBankIndexById;
    return (changedLesson || changedUnit);
  } catch (e) {
    console.warn('[applyCachedCloudData warning]', e);
    return false;
  }
}
window.applyCachedCloudData = applyCachedCloudData;

// دالة تهيئة وبناء بنوك الأسئلة المنفصلة
function initializeQuestionBanks() {
  if (typeof bank === 'undefined' || !Array.isArray(bank)) return;

  // أ) تطبيق التعديلات العامة السابقة (Legacy) على bank الأساسي أولاً
  applyLegacyLocalModifications();

  // ب) تفريغ ونسخ كائنات جديدة لكل بنك لمنع أي تداخل بالذاكرة
  lessonBank = bank.map(cloneQuestion);
  unitMinisterialBank = bank.map(cloneQuestion);

  // ج) تطبيق البيانات السحابية المخزنة في الكاش المحلي (لضمان توفرها فوراً حتى بدون إنترنت أو عند 304)
  applyCachedCloudData();

  // د) تطبيق التعديلات والمحذوفات والإضافات المحلية الخاصة بأسئلة الدرس
  applyCategoryLocalModifications('lesson');

  // هـ) تطبيق التعديلات والمحذوفات والإضافات المحلية الخاصة بأسئلة الوحدة والنماذج الوزارية
  applyCategoryLocalModifications('unit_ministerial');

  lessonBankIndexById = buildIndexedMap(lessonBank);
  unitBankIndexById = buildIndexedMap(unitMinisterialBank);

  // و) مزامنة الفهرس العام
  bankIndexById = (currentQuizCategory === 'unit_ministerial') ? unitBankIndexById : lessonBankIndexById;
}
window.initializeQuestionBanks = initializeQuestionBanks;

// تطبيق التعديلات السابقة (Legacy)
function applyLegacyLocalModifications() {
  try {
    // 1. المحذوفات السابقة
    var rawDel = localStorage.getItem('qbank_deletions');
    if (rawDel) {
      var delIds = JSON.parse(rawDel);
      if (Array.isArray(delIds)) {
        delIds.forEach(function(dId) {
          var bIdx = bank.findIndex(function(item){ return item.id === dId; });
          if (bIdx !== -1) bank.splice(bIdx, 1);
          if (lessonBank && lessonBank.length) {
            var lIdx = lessonBank.findIndex(function(item){ return item.id === dId; });
            if (lIdx !== -1) lessonBank.splice(lIdx, 1);
          }
        });
      }
    }
    // 2. الإضافات السابقة
    var rawAdd = localStorage.getItem('qbank_additions');
    if (rawAdd) {
      var additions = JSON.parse(rawAdd);
      if (Array.isArray(additions)) {
        additions.forEach(function(q) {
          if (!bank.some(function(item){ return item.id === q.id; })) {
            bank.push(cloneQuestion(q));
          }
          if (lessonBank && lessonBank.length && !lessonBank.some(function(item){ return item.id === q.id; })) {
            lessonBank.push(cloneQuestion(q));
          }
        });
      }
    }
    // 3. التعديلات السابقة
    var rawOv = localStorage.getItem('qbank_overrides');
    if (rawOv) {
      var ovs = JSON.parse(rawOv);
      if (ovs && typeof ovs === 'object') {
        Object.keys(ovs).forEach(function(idStr) {
          var idNum = parseInt(idStr, 10);
          var patch = ovs[idStr];
          var q = bank.find(function(item){ return item.id === idNum; });
          if (q) {
            if (patch.text !== undefined) q.text = patch.text;
            if (Array.isArray(patch.options)) q.options = patch.options.slice();
            if (typeof patch.answer === 'number') q.answer = patch.answer;
            if (patch.lesson !== undefined) q.lesson = patch.lesson;
            if (patch.hint !== undefined) q.hint = patch.hint;
          }
          if (lessonBank && lessonBank.length) {
            var lq = lessonBank.find(function(item){ return item.id === idNum; });
            if (lq) {
              if (patch.text !== undefined) lq.text = patch.text;
              if (Array.isArray(patch.options)) lq.options = patch.options.slice();
              if (typeof patch.answer === 'number') lq.answer = patch.answer;
              if (patch.lesson !== undefined) lq.lesson = patch.lesson;
              if (patch.hint !== undefined) lq.hint = patch.hint;
            }
          }
        });
      }
    }
  } catch(e) {
    console.warn('[Legacy Mod Warning]', e);
  }
}

// تطبيق التعديلات الخاصة بقسم معين
function applyCategoryLocalModifications(category) {
  var isUnit = (category === 'unit_ministerial' || category === 'unit');
  var targetBank = isUnit ? unitMinisterialBank : lessonBank;
  var prefix = isUnit ? 'qbank_unit_ministerial_' : 'qbank_lesson_';

  try {
    // 1) المحذوفات
    var rawDel = localStorage.getItem(prefix + 'deletions');
    if (rawDel) {
      var delIds = JSON.parse(rawDel);
      if (Array.isArray(delIds)) {
        delIds.forEach(function(dId) {
          var idx = targetBank.findIndex(function(item){ return item.id === dId; });
          if (idx !== -1) targetBank.splice(idx, 1);
        });
      }
    }

    // 2) الإضافات
    var rawAdd = localStorage.getItem(prefix + 'additions');
    if (rawAdd) {
      var additions = JSON.parse(rawAdd);
      if (Array.isArray(additions)) {
        additions.forEach(function(newQ) {
          if (!targetBank.some(function(item){ return item.id === newQ.id; })) {
            targetBank.push(cloneQuestion(newQ));
          }
        });
      }
    }

    // 3) التعديلات
    var rawOv = localStorage.getItem(prefix + 'overrides');
    if (rawOv) {
      var ovs = JSON.parse(rawOv);
      if (ovs && typeof ovs === 'object') {
        Object.keys(ovs).forEach(function(idStr) {
          var idNum = parseInt(idStr, 10);
          var patch = ovs[idStr];
          var q = targetBank.find(function(item){ return Number(item.id) === Number(idNum); });
          if (q) {
            if (patch.text !== undefined) q.text = patch.text;
            if (Array.isArray(patch.options)) q.options = patch.options.slice();
            if (typeof patch.answer === 'number') q.answer = patch.answer;
            if (patch.lesson !== undefined) q.lesson = patch.lesson;
            if (patch.hint !== undefined) q.hint = patch.hint;
            if (patch.hintDeleted) q.hint = '';
          }
        });
      }
    }

    // إعادة بناء الفهرس
    if (isUnit) {
      unitBankIndexById = buildIndexedMap(unitMinisterialBank);
    } else {
      lessonBankIndexById = buildIndexedMap(lessonBank);
    }
  } catch(e) {
    console.warn('[Category Mod Warning for ' + category + ']', e);
  }
}

// حفظ تعديل سؤال في localStorage حسب القسم المحدد
function saveOverride(questionId, patch, category){
  var cat = (category === 'unit_ministerial' || category === 'unit') ? 'unit_ministerial' : 'lesson';
  var key = (cat === 'unit_ministerial') ? 'qbank_unit_ministerial_overrides' : 'qbank_lesson_overrides';
  try {
    var raw = localStorage.getItem(key);
    var overrides = raw ? JSON.parse(raw) : {};
    if (!overrides[questionId]) overrides[questionId] = {};
    if (patch.text !== undefined) overrides[questionId].text = patch.text;
    if (patch.options !== undefined) overrides[questionId].options = patch.options.slice();
    if (patch.answer !== undefined) overrides[questionId].answer = patch.answer;
    if (patch.lesson !== undefined) overrides[questionId].lesson = patch.lesson;
    if (patch.hint !== undefined) {
      overrides[questionId].hint = patch.hint;
      overrides[questionId].hintDeleted = Boolean(patch.hintDeleted);
    }
    localStorage.setItem(key, JSON.stringify(overrides));
  } catch(e){}
}

// تحديث شارة الاتصال السحابي في الواجهة
function updateCloudBadge(state){
  var badges = [document.getElementById('cloud-sync-status'), document.getElementById('hdr-cloud-badge')];
  badges.forEach(function(badge){
    if (!badge) return;
    if (state === 'syncing'){
      badge.className = 'cloud-status-badge syncing';
      badge.innerHTML = '<i class="fas fa-sync fa-spin"></i> مزامنة Firebase...';
    } else if (state === 'saving'){
      badge.className = 'cloud-status-badge saving';
      badge.innerHTML = '<i class="fas fa-cloud-upload-alt fa-fade"></i> جاري الحفظ سحابياً...';
    } else if (state === 'synced'){
      badge.className = 'cloud-status-badge synced';
      badge.innerHTML = '<i class="fas fa-cloud-check"></i> Firebase متصل';
    } else if (state === 'error' || state === 'offline'){
      badge.className = 'cloud-status-badge offline';
      badge.innerHTML = '<i class="fas fa-cloud"></i> وضع محلي';
    }
  });
}

// إرسال تعديل سؤال إلى خادم Firebase Firestore حسب القسم المحدد
async function syncOverrideToCloud(questionId, patch, category){
  updateCloudBadge('saving');
  var cat = (category === 'unit_ministerial' || category === 'unit') ? 'unit_ministerial' : 'lesson';
  try {
    var res = await fetch('/api/questions/override', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': EDITOR_PASSWORD
      },
      body: JSON.stringify({
        questionId: questionId,
        category: cat,
        text: patch.text,
        options: patch.options,
        answer: patch.answer,
        lesson: patch.lesson,
        hint: patch.hint !== undefined ? patch.hint : '',
        hintDeleted: Boolean(patch.hintDeleted),
        adminKey: EDITOR_PASSWORD
      })
    });
    var data = await res.json();
    if (data.success){
      updateCloudBadge('synced');
      updateLocalCloudCachePayload(questionId, patch, cat);
      var catLbl = (cat === 'unit_ministerial') ? 'اختبار حسب الوحدة والنماذج الوزارية والتقويم' : 'اختبار حسب الدرس';
      toast('☁️ تم حفظ التعديل في بنك (' + catLbl + ') ومزامنته سحابياً في Firebase بنجاح!', 'ok');
    } else {
      updateCloudBadge('error');
      toast('⚠️ تم الحفظ محلياً (تعذر الاتصال بالسحابة: ' + (data.error || '') + ')', 'err');
    }
  } catch (err){
    updateCloudBadge('error');
    toast('⚠️ تم الحفظ محلياً (حدث خطأ في شبكة السحابة)', 'err');
  }
}

// تحديث الكاش المحلي المحفوظ للبيانات السحابية فوراً لمنع استرجاع بيانات قديمة
function updateLocalCloudCachePayload(questionId, patch, category) {
  try {
    var raw = localStorage.getItem('qbank_cached_cloud_payload');
    var cached = raw ? JSON.parse(raw) : { success: true, lesson: { overrides: {}, additions: [], deletions: [] }, unitMinisterial: { overrides: {}, additions: [], deletions: [] } };
    if (!cached.lesson) cached.lesson = { overrides: {}, additions: [], deletions: [] };
    if (!cached.unitMinisterial) cached.unitMinisterial = { overrides: {}, additions: [], deletions: [] };
    var catKey = (category === 'unit_ministerial' || category === 'unit') ? 'unitMinisterial' : 'lesson';
    if (!cached[catKey].overrides) cached[catKey].overrides = {};
    cached[catKey].overrides[String(questionId)] = Object.assign({}, patch, { updatedAt: new Date().toISOString() });
    localStorage.setItem('qbank_cached_cloud_payload', JSON.stringify(cached));
  } catch(e) {}
}

// إرسال سؤال جديد إلى خادم Firebase Firestore حسب القسم المحدد
async function syncAddQuestionToCloud(newQ, category){
  updateCloudBadge('saving');
  var cat = category || 'lesson';
  try {
    var payload = Object.assign({}, newQ, { category: cat, adminKey: EDITOR_PASSWORD });
    var res = await fetch('/api/questions/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': EDITOR_PASSWORD
      },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (data.success){
      updateCloudBadge('synced');
      var catLbl = (cat === 'both') ? 'كلا القسمين' : (cat === 'unit_ministerial' ? 'اختبار حسب الوحدة والنماذج الوزارية' : 'اختبار حسب الدرس');
      toast('☁️ تمت إضافة السؤال في بنك (' + catLbl + ') ومزامنته في Firebase بنجاح!', 'ok');
    } else {
      updateCloudBadge('error');
      toast('⚠️ تمت الإضافة محلياً (تعذر الحفظ في Firebase)', 'err');
    }
  } catch (err){
    updateCloudBadge('error');
    toast('⚠️ تمت الإضافة محلياً فقط', 'err');
  }
}

// إرسال حذف سؤال إلى خادم Firebase Firestore حسب القسم المحدد
async function syncDeleteToCloud(questionId, category){
  updateCloudBadge('saving');
  var cat = (category === 'unit_ministerial' || category === 'unit') ? 'unit_ministerial' : 'lesson';
  try {
    var res = await fetch('/api/questions/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': EDITOR_PASSWORD
      },
      body: JSON.stringify({ questionId: questionId, category: cat, adminKey: EDITOR_PASSWORD })
    });
    var data = await res.json();
    if (data && data.success){
      updateCloudBadge('synced');
      return { success: true, message: data.message };
    } else {
      updateCloudBadge('error');
      return { success: false, error: data?.error || 'فشل الحذف من Firebase' };
    }
  } catch (err){
    console.warn('[Firebase Delete Error]', err);
    updateCloudBadge('error');
    return { success: false, error: err.message };
  }
}

// دالة مساعدة لتطبيق بيانات السحابة على بنك محدد
function applyCloudDatasetToBank(targetBank, cloudData, category) {
  if (!cloudData || !Array.isArray(targetBank)) return false;
  var changed = false;
  var prefix = (category === 'unit_ministerial') ? 'qbank_unit_ministerial_' : 'qbank_lesson_';

  // 1) المحذوفات
  if (Array.isArray(cloudData.deletions) && cloudData.deletions.length > 0) {
    var rawDel = localStorage.getItem(prefix + 'deletions');
    var localDel = rawDel ? JSON.parse(rawDel) : [];
    if (!Array.isArray(localDel)) localDel = [];

    cloudData.deletions.forEach(function(delId) {
      if (localDel.indexOf(delId) === -1) localDel.push(delId);
      var idx = targetBank.findIndex(function(item){ return item.id === delId; });
      if (idx !== -1) {
        targetBank.splice(idx, 1);
        changed = true;
      }
      if (category === 'lesson' && Array.isArray(bank)) {
        var bIdx = bank.findIndex(function(item){ return item.id === delId; });
        if (bIdx !== -1) bank.splice(bIdx, 1);
      }
    });
    try { localStorage.setItem(prefix + 'deletions', JSON.stringify(localDel)); } catch(e){}
  }

  // 2) الإضافات
  if (Array.isArray(cloudData.additions) && cloudData.additions.length > 0) {
    var rawAdd = localStorage.getItem(prefix + 'additions');
    var localAdd = rawAdd ? JSON.parse(rawAdd) : [];
    if (!Array.isArray(localAdd)) localAdd = [];

    cloudData.additions.forEach(function(newQ) {
      var existingIdx = targetBank.findIndex(function(item){ return item.id === newQ.id; });
      if (existingIdx === -1) {
        targetBank.push(cloneQuestion(newQ));
        localAdd.push(newQ);
        changed = true;
      } else {
        Object.assign(targetBank[existingIdx], cloneQuestion(newQ));
      }
      if (category === 'lesson' && Array.isArray(bank)) {
        var bIdx = bank.findIndex(function(item){ return item.id === newQ.id; });
        if (bIdx === -1) {
          bank.push(cloneQuestion(newQ));
        } else {
          Object.assign(bank[bIdx], cloneQuestion(newQ));
        }
      }
    });
    try { localStorage.setItem(prefix + 'additions', JSON.stringify(localAdd)); } catch(e){}
  }

  // 3) التعديلات
  if (cloudData.overrides && typeof cloudData.overrides === 'object') {
    var rawOv = localStorage.getItem(prefix + 'overrides');
    var localOv = rawOv ? JSON.parse(rawOv) : {};

    Object.keys(cloudData.overrides).forEach(function(idStr) {
      var qId = parseInt(idStr, 10);
      var patch = cloudData.overrides[idStr];
      var targetQ = targetBank.find(function(item){ return Number(item.id) === Number(qId); });
      if (targetQ) {
        if (patch.text !== undefined && targetQ.text !== patch.text) {
          targetQ.text = patch.text;
          changed = true;
        }
        if (Array.isArray(patch.options)) {
          targetQ.options = patch.options.slice();
          changed = true;
        }
        if (typeof patch.answer === 'number' && targetQ.answer !== patch.answer) {
          targetQ.answer = patch.answer;
          changed = true;
        }
        if (patch.lesson !== undefined && targetQ.lesson !== patch.lesson) {
          targetQ.lesson = patch.lesson;
          changed = true;
        }
        if (patch.hint !== undefined && targetQ.hint !== patch.hint) {
          targetQ.hint = patch.hint;
          changed = true;
        }
        if (patch.hintDeleted) {
          targetQ.hint = '';
          changed = true;
        }
        localOv[qId] = patch;
      }
      if (Array.isArray(bank) && (category === currentQuizCategory || (category === 'unit_ministerial' && targetQ && targetQ._examKey))) {
        var bQ = bank.find(function(item){ return Number(item.id) === Number(qId); });
        if (bQ) {
          if (patch.text !== undefined) bQ.text = patch.text;
          if (Array.isArray(patch.options)) bQ.options = patch.options.slice();
          if (typeof patch.answer === 'number') bQ.answer = patch.answer;
          if (patch.lesson !== undefined) bQ.lesson = patch.lesson;
          if (patch.hint !== undefined) bQ.hint = patch.hint;
          if (patch.hintDeleted) bQ.hint = '';
        }
      }
    });
    try { localStorage.setItem(prefix + 'overrides', JSON.stringify(localOv)); } catch(e){}
  }

  return changed;
}

// جلب وتطبيق كافة التعديلات والمحذوفات والإضافات من Firebase Firestore لكلا البنكين
async function syncFromFirestore(silent){
  if (typeof window !== 'undefined' && window.firestoreSyncInProgress) return;
  if (typeof firestoreSyncInProgress !== 'undefined' && firestoreSyncInProgress) return;
  if (typeof window !== 'undefined') window.firestoreSyncInProgress = true;
  firestoreSyncInProgress = true;
  updateCloudBadge('syncing');

  try {
    var headers = {};
    var savedETag = localStorage.getItem('qbank_sync_etag');
    if (savedETag) {
      headers['If-None-Match'] = savedETag;
    }

    var res = await fetch('/api/questions/sync', { headers: headers });

    if (res.status === 304) {
      // رد 304 يعني تطابق السحابة — تأكد من تطبيق الكاش السحابي على الذاكرة
      var changedCached = applyCachedCloudData();
      updateCloudBadge('synced');
      if (typeof window !== 'undefined') window.firestoreSyncInProgress = false;
      firestoreSyncInProgress = false;
      if (changedCached && typeof refreshCurrentPage === 'function') {
        refreshCurrentPage();
      }
      return;
    }

    var newETag = res.headers.get('ETag');
    if (newETag) {
      localStorage.setItem('qbank_sync_etag', newETag);
    }

    var data = await res.json();

    if (data.success){
      try {
        localStorage.setItem('qbank_cached_cloud_payload', JSON.stringify(data));
      } catch(e) {}

      var changedLesson = false;
      var changedUnit = false;

      // أ) تطبيق أسئلة الدروس (Lesson Bank)
      var lessonData = data.lesson || { overrides: data.overrides, additions: data.additions, deletions: data.deletions };
      if (lessonData) {
        changedLesson = applyCloudDatasetToBank(lessonBank, lessonData, 'lesson');
        if (changedLesson) {
          lessonBankIndexById = buildIndexedMap(lessonBank);
        }
      }

      // ب) تطبيق أسئلة الوحدة والنماذج الوزارية (Unit & Ministerial Bank)
      var unitMinData = data.unitMinisterial;
      if (unitMinData) {
        changedUnit = applyCloudDatasetToBank(unitMinisterialBank, unitMinData, 'unit_ministerial');
        if (changedUnit) {
          unitBankIndexById = buildIndexedMap(unitMinisterialBank);
        }
      }

      bankIndexById = (currentQuizCategory === 'unit_ministerial') ? unitBankIndexById : lessonBankIndexById;

      updateCloudBadge('synced');
      if (changedLesson || changedUnit){
        if (!silent) toast('☁️ تم تحديث ومزامنة بنوك الأسئلة تلقائياً من Firebase Firestore', 'ok');
        refreshCurrentPage();
      }
    } else {
      updateCloudBadge('error');
    }
  } catch (err){
    console.warn('[Firestore Sync Error]', err);
    updateCloudBadge('offline');
  } finally {
    if (typeof window !== 'undefined') window.firestoreSyncInProgress = false;
    firestoreSyncInProgress = false;
  }
}

// حذف كل التعديلات المحفوظة محلياً (reset)
function clearAllOverrides(){
  ['qbank_overrides', 'qbank_additions', 'qbank_deletions',
   'qbank_lesson_overrides', 'qbank_lesson_additions', 'qbank_lesson_deletions',
   'qbank_unit_ministerial_overrides', 'qbank_unit_ministerial_additions', 'qbank_unit_ministerial_deletions'
  ].forEach(function(k){ try { localStorage.removeItem(k); } catch(e){} });
}

// دوال التوافق
function applyLocalDeletions(){ initializeQuestionBanks(); }
function applyLocalAdditions(){ initializeQuestionBanks(); }
function applyLocalOverrides(){ initializeQuestionBanks(); }

// ══════════════════════════════════════════════
//  حذف الأسئلة وتأكيد الحذف من البرنامج و Firebase
// ══════════════════════════════════════════════
var questionToDeleteId = null;
var questionToDeleteCategory = 'unit_ministerial';

// فتح نافذة تأكيد حذف السؤال نهائياً من البرنامج و Firebase
function confirmDeleteQuestion(questionId, explicitCategory){
  if (!editorMode) return;

  var targetCat = explicitCategory || (currentQuizCategory || 'unit_ministerial');
  var targetBank = (targetCat === 'unit_ministerial') ? unitMinisterialBank : lessonBank;
  var q = targetBank.find(function(item){ return item.id === questionId; });

  // فحص احتياطي إذا لم يوجد بالبنك المحدد
  if (!q) {
    if (targetCat === 'unit_ministerial') {
      q = lessonBank.find(function(item){ return item.id === questionId; });
      if (q) targetCat = 'lesson';
    } else {
      q = unitMinisterialBank.find(function(item){ return item.id === questionId; });
      if (q) targetCat = 'unit_ministerial';
    }
  }

  if (!q && Array.isArray(currentQuiz)){
    q = currentQuiz.find(function(item){ return item.id === questionId; });
  }

  if (!q){
    toast('السؤال غير موجود أو تم حذفه مسبقاً', 'err');
    return;
  }

  questionToDeleteId = questionId;
  questionToDeleteCategory = targetCat;

  var catTitle = (targetCat === 'unit_ministerial')
    ? 'بنك اختبار حسب الوحدة والنماذج الوزارية'
    : 'بنك اختبار حسب الدرس';

  var isolationNotice = (targetCat === 'unit_ministerial')
    ? 'لن يؤثر إطلاقاً على أسئلة اختبار حسب الدرس (محفوظة بالكامل)'
    : 'لن يؤثر إطلاقاً على أسئلة اختبار حسب الوحدة والنماذج الوزارية (محفوظة بالكامل)';

  // ملء تفاصيل السؤال في نافذة التأكيد
  var infoEl = document.getElementById('delete-confirm-question-info');
  if (infoEl){
    infoEl.innerHTML =
      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:#1e40af;font-weight:700;">' +
        '<i class="fas fa-info-circle"></i> الحذف من: <strong>' + catTitle + '</strong><br>' +
        '<span style="font-size:11px;color:#059669;"><i class="fas fa-shield-alt"></i> ' + isolationNotice + '</span>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px;font-weight:800;color:#1e293b;">' +
        '<span><i class="fas fa-hashtag" style="color:#e74c3c;"></i> رقم السؤال: <span style="color:#e74c3c;font-size:13px;">#' + q.id + '</span></span>' +
        (q.lesson ? '<span style="color:#475569;font-weight:600;"><i class="fas fa-book-open" style="color:#3b82f6;"></i> ' + escHtml(q.lesson) + '</span>' : '') +
      '</div>' +
      '<div style="font-size:13px;color:#1e293b;line-height:1.6;background:#ffffff;padding:10px 12px;border-radius:8px;border:1px solid #cbd5e1;max-height:110px;overflow-y:auto;font-weight:600;">' +
        escHtml(q.text) +
      '</div>';
  }

  // إعادة ضبط حالة زر التأكيد
  var btnAction = document.getElementById('btn-confirm-delete-action');
  if (btnAction){
    btnAction.disabled = false;
    btnAction.innerHTML = '<i class="fas fa-trash-alt"></i> نعم، حذف من هذا البنك ومزامنته سحابياً';
  }

  // إظهار نافذة تأكيد الحذف
  var ov = document.getElementById('delete-confirm-overlay');
  if (ov) ov.classList.add('open');
}
window.confirmDeleteQuestion = confirmDeleteQuestion;

function closeDeleteConfirmModal(e){
  if (e && e.target && e.target.id !== 'delete-confirm-overlay' && !e.target.closest('.editor-modal-close') && !e.target.closest('.ed-btn-cancel')) return;
  var ov = document.getElementById('delete-confirm-overlay');
  if (ov) ov.classList.remove('open');
  questionToDeleteId = null;
}
window.closeDeleteConfirmModal = closeDeleteConfirmModal;

// تنفيذ عملية الحذف الفعلية من القسم المختار ومزامنته مع Firebase
async function executeDeleteQuestionAction(){
  if (!editorMode || !questionToDeleteId) return;
  var qId = questionToDeleteId;
  var cat = questionToDeleteCategory || 'unit_ministerial';

  var btnAction = document.getElementById('btn-confirm-delete-action');
  if (btnAction){
    btnAction.disabled = true;
    btnAction.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحذف والمزامنة مع Firebase...';
  }

  // 1) إزالة السؤال من بنك الأسئلة المختار فقط دون المساس بالبنك الآخر
  if (cat === 'unit_ministerial') {
    var uIdx = unitMinisterialBank.findIndex(function(item){ return item.id === qId; });
    if (uIdx !== -1) {
      unitMinisterialBank.splice(uIdx, 1);
      unitBankIndexById = buildIndexedMap(unitMinisterialBank);
    }
  } else {
    var lIdx = lessonBank.findIndex(function(item){ return item.id === qId; });
    if (lIdx !== -1) {
      lessonBank.splice(lIdx, 1);
      lessonBankIndexById = buildIndexedMap(lessonBank);
    }
  }

  // 2) إزالة السؤال من الاختبار الجاري فوراً إذا كان مفتوحاً
  if (Array.isArray(currentQuiz) && currentQuiz.length > 0){
    var answersByQId = {};
    currentQuiz.forEach(function(item, i){
      if (userAnswers[i] !== undefined){
        answersByQId[item.id] = userAnswers[i];
      }
    });

    currentQuiz = currentQuiz.filter(function(item){ return item.id !== qId; });

    var newUserAnswers = {};
    currentQuiz.forEach(function(item, i){
      if (answersByQId[item.id] !== undefined){
        newUserAnswers[i] = answersByQId[item.id];
      }
    });
    userAnswers = newUserAnswers;
  }

  // 3) حفظ في قائمة المحذوفات محلياً الخاصة بهذا البنك
  var prefix = (cat === 'unit_ministerial') ? 'qbank_unit_ministerial_' : 'qbank_lesson_';
  try {
    var raw = localStorage.getItem(prefix + 'deletions');
    var deletions = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(deletions)) deletions = [];
    if (deletions.indexOf(qId) === -1){
      deletions.push(qId);
      localStorage.setItem(prefix + 'deletions', JSON.stringify(deletions));
    }
  } catch(e){
    console.warn('[Editor] فشل حفظ الحذف محلياً:', e);
  }

  // 4) مزامنة الحذف مع Firebase Firestore السحابية في المجموعة المعنية
  var syncResult = await syncDeleteToCloud(qId, cat);
  var fbSuccess = Boolean(syncResult && syncResult.success);

  // 5) إغلاق نافذة التأكيد ونافذة التحرير
  var confirmOv = document.getElementById('delete-confirm-overlay');
  if (confirmOv) confirmOv.classList.remove('open');
  closeEditorEdit();

  // 6) إظهار رسالة النجاح
  showDeleteSuccessModal(qId, fbSuccess, cat);
  toast('🗑️ تم تأكيد حذف السؤال (#' + qId + ') بنجاح من ' + (cat === 'unit_ministerial' ? 'أسئلة الوحدة والوزاري' : 'أسئلة الدرس'), 'ok');
  questionToDeleteId = null;

  // 7) تحديث الواجهة فوراً
  refreshCurrentPage();
  if (typeof renderBankManagerContent === 'function') {
    renderBankManagerContent();
  }
}
window.executeDeleteQuestionAction = executeDeleteQuestionAction;

// إظهار نافذة رسالة تأكيد الحذف
function showDeleteSuccessModal(qId, fbSuccess, category){
  var catLbl = (category === 'unit_ministerial') ? 'اختبار حسب الوحدة والنماذج الوزارية' : 'اختبار حسب الدرس';
  var otherLbl = (category === 'unit_ministerial') ? 'اختبار حسب الدرس' : 'اختبار حسب الوحدة والنماذج الوزارية';
  var msgEl = document.getElementById('delete-success-message');
  if (msgEl){
    if (fbSuccess){
      msgEl.innerHTML = 'تم حذف السؤال رقم (<strong style="color:#e74c3c;">#' + qId + '</strong>) بنجاح من بنك (<strong>' + catLbl + '</strong>)، وتأكيد حذفه في <strong>Firebase</strong>.<br><span style="color:#059669;font-size:12px;margin-top:6px;display:inline-block;"><i class="fas fa-check-circle"></i> بنك (' + otherLbl + ') بقي محفوظاً ومستقلاً تماماً دون أي تغيير.</span>';
    } else {
      msgEl.innerHTML = 'تم حذف السؤال رقم (<strong style="color:#e74c3c;">#' + qId + '</strong>) من بنك (<strong>' + catLbl + '</strong>) محلياً، وسيتم تطبيق الحذف سحابياً في Firebase عند توفر الاتصال.';
    }
  }
  var ov = document.getElementById('delete-success-overlay');
  if (ov) ov.classList.add('open');
}
window.showDeleteSuccessModal = showDeleteSuccessModal;

function closeDeleteSuccessModal(e){
  if (e && e.target && e.target.id !== 'delete-success-overlay' && !e.target.closest('.editor-modal-close') && !e.target.closest('.editor-btn-primary')) return;
  var ov = document.getElementById('delete-success-overlay');
  if (ov) ov.classList.remove('open');
}
window.closeDeleteSuccessModal = closeDeleteSuccessModal;

// حذف سؤال (من نافذة التحرير أو أي استدعاء مباشر)
function deleteCurrentQuestion(questionId, explicitCategory){
  confirmDeleteQuestion(questionId, explicitCategory);
}
window.deleteCurrentQuestion = deleteCurrentQuestion;

// ══════════════════════════════════════════════
//  إضافة أسئلة جديدة (Add Questions)
// ══════════════════════════════════════════════
// سياق الإضافة الحالي (يُملأ عند فتح نافذة "إضافة سؤال")
var editorAddContext = null;

// البحث عن سياق الدرس في المنهج (sem + unit + unitName)
function findLessonContext(lessonName){
  for (var s = 1; s <= 2; s++){
    var sem = CUR[s];
    if (!sem || !sem.units) continue;
    for (var ui = 0; ui < sem.units.length; ui++){
      var u = sem.units[ui];
      for (var li = 0; li < u.lessons.length; li++){
        if (u.lessons[li] === lessonName){
          return { sem: s, unitId: u.id, unitName: u.name, lesson: u.lessons[li] };
        }
      }
    }
  }
  return null;
}

// ملاحظة: تم دمج تطبيق الأسئلة المضافة محلياً ضمن دالة applyLegacyLocalModifications() و initializeQuestionBanks()

// ══════════════════════════════════════════════
//  دعم الجداول والصور في نصوص الأسئلة (Tables & Images)
// ══════════════════════════════════════════════

// دوال معالجة وتنسيق القيود المحاسبية (دفتر اليومية بنظرية القيد المزدوج)
function formatAmountBadge(num) {
  if (!num) return '';
  var clean = String(num).trim().replace(/[^\d.]/g, '');
  if (!clean) return '';
  var p = clean.split('.');
  p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '<span class="entry-amount-badge">' + p.join('.') + '</span>';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// دالة عرض وتنسيق حسابات دفتر الأستاذ على شكل جدول حرف (T) وفق نموذج المنهاج المرفق
function renderTAccount(account) {
  if (!account) return '';
  var name = account.name || 'حساب';
  var cleanName = name.replace(/^حـ?\s*\/?\s*/, '').trim();
  
  var debits = Array.isArray(account.debits) ? account.debits.slice() : [];
  var credits = Array.isArray(account.credits) ? account.credits.slice() : [];
  
  var parseAmt = function(val) {
    if (!val) return 0;
    var n = parseFloat(String(val).replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  };
  
  var fmtNum = function(val) {
    if (val === undefined || val === null || val === '') return '&nbsp;';
    var clean = String(val).trim().replace(/[^\d.]/g, '');
    if (!clean) return String(val);
    var p = clean.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return p.join('.');
  };

  var sumD = debits.reduce(function(acc, item) { return acc + parseAmt(item.amount); }, 0);
  var sumC = credits.reduce(function(acc, item) { return acc + parseAmt(item.amount); }, 0);

  var totalVal = account.total ? parseAmt(account.total) : Math.max(sumD, sumC);
  var diff = Math.abs(sumD - sumC);
  var isBalanced = (diff === 0 && (sumD > 0 || sumC > 0)) || !!account.isBalanced;

  var carriedDate = account.carriedDate || (account.balanceCarried && account.balanceCarried.date) || '2024/2/29م';
  var forwardDate = account.forwardDate || (account.balanceForward && account.balanceForward.date) || '2024/3/1م';

  var carriedDebit = null;
  var carriedCredit = null;
  var forwardDebit = null;
  var forwardCredit = null;

  if (!isBalanced && diff > 0) {
    if (sumD > sumC) {
      // رصيد مدين: يوضع مرحلاً في الطرف الدائن (الأصغر) للتوازن
      carriedCredit = {
        amount: fmtNum(diff),
        desc: '<span class="ledger-tag-carried">رصيد مُرَحَّل</span>',
        qNum: '-',
        date: carriedDate
      };
      // ويدور في الطرف المدين (الأصلي) للفترة التالية
      forwardDebit = {
        amount: fmtNum(diff),
        desc: '<span class="ledger-tag-forward">رصيد مُدَوَّر</span>',
        qNum: '-',
        date: forwardDate
      };
    } else {
      // رصيد دائن: يوضع مرحلاً في الطرف المدين (الأصغر) للتوازن
      carriedDebit = {
        amount: fmtNum(diff),
        desc: '<span class="ledger-tag-carried">رصيد مُرَحَّل</span>',
        qNum: '-',
        date: carriedDate
      };
      // ويدور في الطرف الدائن (الأصلي) للفترة التالية
      forwardCredit = {
        amount: fmtNum(diff),
        desc: '<span class="ledger-tag-forward">رصيد مُدَوَّر</span>',
        qNum: '-',
        date: forwardDate
      };
    }
  }

  var rowsCount = Math.max(debits.length, credits.length);
  var hasCarriedRow = !isBalanced && diff > 0;

  var html = '';
  html += '<div class="ledger-table-wrap">';
  html += '  <table class="ledger-table">';
  html += '    <thead>';
  html += '      <tr class="ledger-head-top">';
  html += '        <th colspan="2" class="ledger-th-side-debit">مَدين</th>';
  html += '        <th colspan="4" class="ledger-th-main">';
  html += '          <div class="ledger-main-label">دفتر الأستاذ</div>';
  html += '          <div class="ledger-main-account">حـ/ ' + escapeHtml(cleanName) + '</div>';
  html += '        </th>';
  html += '        <th colspan="2" class="ledger-th-side-credit">دائن</th>';
  html += '      </tr>';
  html += '      <tr class="ledger-head-cols">';
  html += '        <th class="ledger-col-amt">المبلغ</th>';
  html += '        <th class="ledger-col-desc">البيان</th>';
  html += '        <th class="ledger-col-qnum">رقم قيد اليومية</th>';
  html += '        <th class="ledger-col-date ledger-divider-col">التاريخ</th>';
  html += '        <th class="ledger-col-amt">المبلغ</th>';
  html += '        <th class="ledger-col-desc">البيان</th>';
  html += '        <th class="ledger-col-qnum">رقم قيد اليومية</th>';
  html += '        <th class="ledger-col-date">التاريخ</th>';
  html += '      </tr>';
  html += '    </thead>';
  html += '    <tbody>';

  // 1. أسطر الحركات
  for (var r = 0; r < rowsCount; r++) {
    var dItem = debits[r] || null;
    var cItem = credits[r] || null;

    html += '      <tr>';
    // المدين
    html += '        <td class="ledger-td ledger-cell-amt">' + (dItem ? fmtNum(dItem.amount) : '&nbsp;') + '</td>';
    html += '        <td class="ledger-td ledger-cell-desc">' + (dItem ? dItem.desc : '&nbsp;') + '</td>';
    html += '        <td class="ledger-td ledger-cell-qnum">' + (dItem && dItem.qNum ? dItem.qNum : '-') + '</td>';
    html += '        <td class="ledger-td ledger-cell-date ledger-divider-col">' + (dItem && dItem.date ? dItem.date : '&nbsp;') + '</td>';
    // الدائن
    html += '        <td class="ledger-td ledger-cell-amt">' + (cItem ? fmtNum(cItem.amount) : '&nbsp;') + '</td>';
    html += '        <td class="ledger-td ledger-cell-desc">' + (cItem ? cItem.desc : '&nbsp;') + '</td>';
    html += '        <td class="ledger-td ledger-cell-qnum">' + (cItem && cItem.qNum ? cItem.qNum : '-') + '</td>';
    html += '        <td class="ledger-td ledger-cell-date">' + (cItem && cItem.date ? cItem.date : '&nbsp;') + '</td>';
    html += '      </tr>';
  }

  // 2. سطر الرصيد المرحل
  if (hasCarriedRow) {
    html += '      <tr class="ledger-row-carried">';
    if (carriedDebit) {
      html += '        <td class="ledger-td ledger-cell-amt">' + carriedDebit.amount + '</td>';
      html += '        <td class="ledger-td ledger-cell-desc">' + carriedDebit.desc + '</td>';
      html += '        <td class="ledger-td ledger-cell-qnum">' + carriedDebit.qNum + '</td>';
      html += '        <td class="ledger-td ledger-cell-date ledger-divider-col">' + carriedDebit.date + '</td>';
    } else {
      html += '        <td class="ledger-td ledger-cell-amt">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-desc">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-qnum">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-date ledger-divider-col">&nbsp;</td>';
    }
    if (carriedCredit) {
      html += '        <td class="ledger-td ledger-cell-amt">' + carriedCredit.amount + '</td>';
      html += '        <td class="ledger-td ledger-cell-desc">' + carriedCredit.desc + '</td>';
      html += '        <td class="ledger-td ledger-cell-qnum">' + carriedCredit.qNum + '</td>';
      html += '        <td class="ledger-td ledger-cell-date">' + carriedCredit.date + '</td>';
    } else {
      html += '        <td class="ledger-td ledger-cell-amt">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-desc">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-qnum">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-date">&nbsp;</td>';
    }
    html += '      </tr>';
  }

  // 3. سطر المجموع النهائي
  if (totalVal > 0) {
    html += '      <tr class="ledger-row-totals">';
    html += '        <td class="ledger-td ledger-cell-amt ledger-total-amt">' + fmtNum(totalVal) + '</td>';
    html += '        <td class="ledger-td ledger-cell-desc ledger-total-label">المجموع</td>';
    html += '        <td class="ledger-td ledger-cell-qnum">&nbsp;</td>';
    html += '        <td class="ledger-td ledger-cell-date ledger-divider-col">&nbsp;</td>';
    html += '        <td class="ledger-td ledger-cell-amt ledger-total-amt">' + fmtNum(totalVal) + '</td>';
    html += '        <td class="ledger-td ledger-cell-desc ledger-total-label">المجموع</td>';
    html += '        <td class="ledger-td ledger-cell-qnum">&nbsp;</td>';
    html += '        <td class="ledger-td ledger-cell-date">&nbsp;</td>';
    html += '      </tr>';
  }

  // 4. سطر الرصيد المدور
  if (!isBalanced && diff > 0) {
    html += '      <tr class="ledger-row-forward">';
    if (forwardDebit) {
      html += '        <td class="ledger-td ledger-cell-amt">' + forwardDebit.amount + '</td>';
      html += '        <td class="ledger-td ledger-cell-desc">' + forwardDebit.desc + '</td>';
      html += '        <td class="ledger-td ledger-cell-qnum">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-date ledger-divider-col">' + forwardDebit.date + '</td>';
    } else {
      html += '        <td class="ledger-td ledger-cell-amt">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-desc">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-qnum">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-date ledger-divider-col">&nbsp;</td>';
    }
    if (forwardCredit) {
      html += '        <td class="ledger-td ledger-cell-amt">' + forwardCredit.amount + '</td>';
      html += '        <td class="ledger-td ledger-cell-desc">' + forwardCredit.desc + '</td>';
      html += '        <td class="ledger-td ledger-cell-qnum">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-date">' + forwardCredit.date + '</td>';
    } else {
      html += '        <td class="ledger-td ledger-cell-amt">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-desc">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-qnum">&nbsp;</td>';
      html += '        <td class="ledger-td ledger-cell-date">&nbsp;</td>';
    }
    html += '      </tr>';
  } else if (isBalanced) {
    html += '      <tr class="ledger-row-closed">';
    html += '        <td colspan="8">';
    html += '          <i class="fas fa-check-circle" style="color:#059669; margin-left:6px;"></i>';
    html += '          <strong>حساب مقفل (متوازن):</strong> مجموع الجانب المدين (' + fmtNum(totalVal) + ') = مجموع الجانب الدائن (' + fmtNum(totalVal) + ') — الرصيد = صفر';
    html += '        </td>';
    html += '      </tr>';
  }

  html += '    </tbody>';
  html += '  </table>';
  html += '</div>';

  return html;
}

// دالة تحليل واستخراج حسابات دفتر الأستاذ العام (T-Account) من الجداول أو النصوص التحريرية
function parseGenericLedgerFromText(text) {
  if (!text) return null;
  var raw = String(text).trim();
  if (!/(?:دفتر\s*الأستاذ|T-Account|حساب\s*الأستاذ|منه|له|الجانب\s*المدين|الجانب\s*الدائن|حـ?\/?\s*[^\n\r]+)/i.test(raw)) {
    return null;
  }

  // 1. استخراج اسم الحساب
  var accName = 'الصندوق';
  var nameMatch = raw.match(/(?:\[دفتر\s*الأستاذ(?::\s*([^\]]+))?\]|دفتر\s*الأستاذ(?:\s*العام)?(?::\s*([^\n\r]+))?|حساب\s*الأستاذ(?::\s*([^\n\r]+))?|حـ?\/?\s*([^\n\r\(\)]+)\s*\(دفتر\s*الأستاذ\))/i);
  if (nameMatch) {
    var rawName = nameMatch[1] || nameMatch[2] || nameMatch[3] || nameMatch[4];
    if (rawName && rawName.trim()) {
      accName = rawName.trim().replace(/^حـ?\/?\s*/i, '');
    }
  }

  var debits = [];
  var credits = [];

  // فحص جداول الماركداون
  var lines = raw.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
  var tableLines = lines.filter(function(l){ return l.startsWith('|') && l.endsWith('|'); });

  if (tableLines.length >= 2) {
    var rows = tableLines.map(function(tl) {
      var inner = tl.slice(1, -1);
      return inner.split('|').map(function(c){ return c.trim(); });
    }).filter(function(r){
      return !r.every(function(cell){ return /^:?-+:?$/.test(cell); });
    });

    if (rows.length >= 2) {
      var header = rows[0];
      var dataRows = rows.slice(1);

      if (header.length >= 6) {
        var half = Math.floor(header.length / 2);
        dataRows.forEach(function(r) {
          var dAmt = r[0] || '';
          var dDesc = r[1] || '';
          var dQNum = (half === 4) ? (r[2] || '') : '';
          var dDate = (half === 4) ? (r[3] || '') : (r[2] || '');

          var cAmt = r[half] || '';
          var cDesc = r[half + 1] || '';
          var cQNum = (half === 4) ? (r[half + 2] || '') : '';
          var cDate = (half === 4) ? (r[half + 3] || '') : (r[half + 2] || '');

          if (dAmt && dAmt !== '-' && dAmt !== '&nbsp;') {
            debits.push({ amount: dAmt, desc: dDesc, qNum: dQNum, date: dDate });
          }
          if (cAmt && cAmt !== '-' && cAmt !== '&nbsp;') {
            credits.push({ amount: cAmt, desc: cDesc, qNum: cQNum, date: cDate });
          }
        });
      } else if (header.length >= 4) {
        dataRows.forEach(function(r) {
          var dAmt = r[0] || '';
          var dDesc = r[1] || '';
          var cAmt = r[2] || '';
          var cDesc = r[3] || '';
          if (dAmt && dAmt !== '-' && dAmt !== '&nbsp;') {
            debits.push({ amount: dAmt, desc: dDesc, qNum: '', date: '' });
          }
          if (cAmt && cAmt !== '-' && cAmt !== '&nbsp;') {
            credits.push({ amount: cAmt, desc: cDesc, qNum: '', date: '' });
          }
        });
      }
    }
  }

  // إذا لم يتم استخراج حركات من الجدول، نفحص أسطر النص العادي
  if (debits.length === 0 && credits.length === 0) {
    var curSide = 'none';
    lines.forEach(function(l) {
      if (/(?:الجانب\s*المدين|طرف\s*مدين|منه|مدين:)/i.test(l)) {
        curSide = 'debit';
        l = l.replace(/.*(?:الجانب\s*المدين|طرف\s*مدين|منه|مدين:)\s*/i, '').trim();
      } else if (/(?:الجانب\s*الدائن|طرف\s*دائن|له|دائن:)/i.test(l)) {
        curSide = 'credit';
        l = l.replace(/.*(?:الجانب\s*الدائن|طرف\s*دائن|له|دائن:)\s*/i, '').trim();
      }

      if (!l || /^\[.*\]$/.test(l) || /^[=\-#─]+$/.test(l)) return;

      var isDeb = (curSide === 'debit') || /^(?:إلى|الى)\s*حـ?\//i.test(l) || /مدين/i.test(l);
      var isCred = (curSide === 'credit') || /^من\s*حـ?\//i.test(l) || /دائن/i.test(l);

      var dateVal = '';
      var dateMatch = l.match(/\(?بتاريخ\s*([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}(?:\s*م)?|[0-9]{1,2}\/[0-9]{1,2}(?:\s*م)?)\)?/i) || l.match(/\(([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}(?:\s*م)?)\)/i);
      if (dateMatch) {
        dateVal = dateMatch[1].trim();
        l = l.replace(dateMatch[0], '').trim();
      }

      var numMatch = l.match(/([0-9,.]+)\s*(?:دينار)?/);
      if (numMatch) {
        var amt = numMatch[1];
        var desc = l.replace(numMatch[0], '').replace(/^[\s\-\*•:]+/, '').trim();
        if (isDeb && !isCred) {
          if (!desc.startsWith('إلى') && !desc.startsWith('الى')) desc = 'إلى حـ/ ' + desc.replace(/^حـ?\/?\s*/, '');
          debits.push({ amount: amt, desc: desc, qNum: '', date: dateVal });
        } else if (isCred) {
          if (!desc.startsWith('من')) desc = 'من حـ/ ' + desc.replace(/^حـ?\/?\s*/, '');
          credits.push({ amount: amt, desc: desc, qNum: '', date: dateVal });
        }
      }
    });
  }

  if (debits.length > 0 || credits.length > 0) {
    return renderTAccount({
      name: 'حـ / ' + accName,
      debits: debits,
      credits: credits
    });
  }

  return null;
}
window.parseGenericLedgerFromText = parseGenericLedgerFromText;

// دالة فحص واستخراج حسابات دفتر الأستاذ وعرضها كجداول نموذجية
function renderLedgerBlockFromText(text) {
  if (!/(?:دفتر\s*الأستاذ|ترحيل\s*وترصيد|ترصيد\s*الحسابات|T-Account|حساب\s*الأثاث|حساب\s*الصندوق|حساب\s*البنك|حـ?\/?\s*البنك)/i.test(text)) return null;

  var container = '<div class="ledger-tables-container">';
  var found = false;

  // 1. فحص سؤال 102 (اختبار نهاية الوحدة الأولى - السؤال الثاني)
  if (/30000/i.test(text) && /مصروف\s*الإيجار/i.test(text) && (/الأثاث/i.test(text) || /8000/i.test(text))) {
    found = true;
    // 1) حـ/ البنك
    container += renderTAccount({
      name: 'حـ / البنك',
      debits: [
        { amount: '30000', desc: 'إلى حـ/ رأس المال', qNum: '1', date: '2024/2/1م' }
      ],
      credits: [
        { amount: '5000', desc: 'من حـ/ مصروف الإيجار', qNum: '2', date: '2024/2/5م' },
        { amount: '4000', desc: 'من حـ/ الأثاث', qNum: '3', date: '2024/2/10م' }
      ],
      carriedDate: '2024/2/29م',
      forwardDate: '2024/3/1م'
    });

    // 2) حـ/ رأس المال
    container += renderTAccount({
      name: 'حـ / رأس المال',
      debits: [],
      credits: [
        { amount: '30000', desc: 'من حـ/ البنك', qNum: '1', date: '2024/2/1م' }
      ],
      carriedDate: '2024/2/29م',
      forwardDate: '2024/3/1م'
    });

    // 3) حـ/ مصروف الإيجار
    container += renderTAccount({
      name: 'حـ / مصروف الإيجار',
      debits: [
        { amount: '5000', desc: 'إلى حـ/ البنك', qNum: '2', date: '2024/2/5م' }
      ],
      credits: [],
      carriedDate: '2024/2/29م',
      forwardDate: '2024/3/1م'
    });

    // 4) حـ/ الأثاث
    container += renderTAccount({
      name: 'حـ / الأثاث',
      debits: [
        { amount: '8000', desc: 'إلى مذكورين', qNum: '3', date: '2024/2/10م' }
      ],
      credits: [],
      carriedDate: '2024/2/29م',
      forwardDate: '2024/3/1م'
    });

    // 5) حـ/ الدائنون
    container += renderTAccount({
      name: 'حـ / الدائنون',
      debits: [],
      credits: [
        { amount: '4000', desc: 'من حـ/ الأثاث', qNum: '3', date: '2024/2/10م' }
      ],
      carriedDate: '2024/2/29م',
      forwardDate: '2024/3/1م'
    });

    // 6) حـ/ الصندوق
    container += renderTAccount({
      name: 'حـ / الصندوق',
      debits: [
        { amount: '12000', desc: 'إلى حـ/ إيراد الخدمات', qNum: '4', date: '2024/2/15م' }
      ],
      credits: [],
      carriedDate: '2024/2/29م',
      forwardDate: '2024/3/1م'
    });

    // 7) حـ/ إيراد الخدمات
    container += renderTAccount({
      name: 'حـ / إيراد الخدمات',
      debits: [],
      credits: [
        { amount: '12000', desc: 'من حـ/ الصندوق', qNum: '4', date: '2024/2/15م' }
      ],
      carriedDate: '2024/2/29م',
      forwardDate: '2024/3/1م'
    });

    container += '</div>';
    return container;
  }

  // 2. فحص سؤال 103 (اختبار نهاية الوحدة الأولى - السؤال الثالث)
  if (/25000/i.test(text) && (/مفروشات\s*النور/i.test(text) || /مصروف\s*الرواتب/i.test(text))) {
    found = true;
    // 1) حـ/ البنك
    container += renderTAccount({
      name: 'حـ / البنك',
      debits: [
        { amount: '25000', desc: 'إلى حـ/ رأس المال', qNum: '1', date: '2024/1/1م' }
      ],
      credits: [
        { amount: '3000', desc: 'من حـ/ الأثاث', qNum: '2', date: '2024/1/5م' },
        { amount: '3000', desc: 'من حـ/ مصروف الرواتب', qNum: '4', date: '2024/1/15م' },
        { amount: '2000', desc: 'من حـ/ الدائنون (مفروشات النور)', qNum: '5', date: '2024/1/20م' }
      ],
      carriedDate: '2024/1/31م',
      forwardDate: '2024/2/1م'
    });

    // 2) حـ/ رأس المال
    container += renderTAccount({
      name: 'حـ / رأس المال',
      debits: [],
      credits: [
        { amount: '25000', desc: 'من حـ/ البنك', qNum: '1', date: '2024/1/1م' }
      ],
      carriedDate: '2024/1/31م',
      forwardDate: '2024/2/1م'
    });

    // 3) حـ/ الأثاث
    container += renderTAccount({
      name: 'حـ / الأثاث',
      debits: [
        { amount: '5000', desc: 'إلى مذكورين', qNum: '2', date: '2024/1/5م' }
      ],
      credits: [],
      carriedDate: '2024/1/31م',
      forwardDate: '2024/2/1م'
    });

    // 4) حـ/ الدائنون (مفروشات النور) - مقفل متوازن رصيده صفر
    container += renderTAccount({
      name: 'حـ / الدائنون (مفروشات النور)',
      debits: [
        { amount: '2000', desc: 'إلى حـ/ البنك', qNum: '5', date: '2024/1/20م' }
      ],
      credits: [
        { amount: '2000', desc: 'من حـ/ الأثاث', qNum: '2', date: '2024/1/5م' }
      ],
      isBalanced: true
    });

    // 5) حـ/ الصندوق
    container += renderTAccount({
      name: 'حـ / الصندوق',
      debits: [
        { amount: '12000', desc: 'إلى حـ/ إيراد الخدمات', qNum: '3', date: '2024/1/10م' }
      ],
      credits: [],
      carriedDate: '2024/1/31م',
      forwardDate: '2024/2/1م'
    });

    // 6) حـ/ إيراد الخدمات
    container += renderTAccount({
      name: 'حـ / إيراد الخدمات',
      debits: [],
      credits: [
        { amount: '12000', desc: 'من حـ/ الصندوق', qNum: '3', date: '2024/1/10م' }
      ],
      carriedDate: '2024/1/31م',
      forwardDate: '2024/2/1م'
    });

    // 7) حـ/ مصروف الرواتب
    container += renderTAccount({
      name: 'حـ / مصروف الرواتب',
      debits: [
        { amount: '3000', desc: 'إلى حـ/ البنك', qNum: '4', date: '2024/1/15م' }
      ],
      credits: [],
      carriedDate: '2024/1/31م',
      forwardDate: '2024/2/1م'
    });

    container += '</div>';
    return container;
  }

  // 3. فحص سؤال 28 أو نموذج دفتر الأستاذ لحساب الصندوق (المطابق لصورة المنهاج المرفقة)
  if ((/خطوات\s*عملية\s*الترصيد/i.test(text) || /نموذج\s*تطبيقي/i.test(text)) && /الصندوق/i.test(text)) {
    found = true;
    container += renderTAccount({
      name: 'حـ / الصندوق',
      debits: [
        { amount: '20000', desc: 'إلى حـ/ رأس المال', qNum: '', date: '2023/1/1م' }
      ],
      credits: [
        { amount: '5000', desc: 'من حـ/ الأثاث', qNum: '', date: '2023/1/3م' }
      ],
      carriedDate: '2023/1/31م',
      forwardDate: '2023/2/1م'
    });
    container += '</div>';
    return container;
  }

  // 4. دعم الحسابات العامة الأخرى إن وجدت في النص
  if (/حـ?\/?\s*الصندوق/i.test(text) && /1200/i.test(text) && /المبيعات/i.test(text)) {
    found = true;
    container += renderTAccount({
      name: 'حـ / الصندوق',
      debits: [
        { amount: '1200', desc: 'إلى حـ/ المبيعات', qNum: '1', date: '2024/2/4م' }
      ],
      credits: [
        { amount: '500', desc: 'من حـ/ الأثاث', qNum: '2', date: '2024/2/1م' }
      ],
      carriedDate: '2024/2/29م',
      forwardDate: '2024/3/1م'
    });
  }

  if (found) {
    container += '</div>';
    return container;
  }

  var genericLedger = parseGenericLedgerFromText(text);
  if (genericLedger) {
    return '<div class="ledger-tables-container">' + genericLedger + '</div>';
  }

  return null;
}

function parseAndRenderAccountingLine(rawLine) {
  var raw = String(rawLine).trim();
  if (!raw) return null;

  var hasMin = /(?:من\s*حـ?\/|من\s*ح\/|من\s*مذكورين)/i.test(raw);
  var hasIla = /(?:إلى\s*حـ?\/|إلى\s*ح\/|الى\s*حـ?\/|الى\s*ح\/|إلى\s*مذكورين|الى\s*مذكورين)/i.test(raw);

  if (!hasMin && !hasIla) return null;

  // استخراج البادئة الترقيمية إن وجدت (مثل: 1) أو 1) بتاريخ 2024/2/1م: أو قيد إقفال المصروفات:)
  var prefix = '';
  var mPrefix = raw.match(/^((?:(?:\d+[\.\-\)]\s*)*(?:بتاريخ\s*[^:\n]+:?|قيد\s*[^:\n]+:?|إقفال\s*[^:\n]+:?|\d{4}\/\d{1,2}\/\d{1,2}[^:\n]*:?|\d+[\.\-\)]\s*)+:?\s*)+)/i);
  if (mPrefix) {
    prefix = mPrefix[0].trim().replace(/:$/, '');
    raw = raw.slice(mPrefix[0].length).trim();
  }

  // استخراج شرح القيد بين قوسين في نهاية السطر إن وجد
  var explanation = '';
  var mExp = raw.match(/\(([^)]+)\)\.?$/);
  if (mExp) {
    explanation = mExp[1].trim();
    raw = raw.replace(/\(([^)]+)\)\.?$/, '').trim();
  }

  var html = '<div class="accounting-entry-card">';
  if (prefix) {
    html += '<div class="entry-voucher-header"><i class="fas fa-file-invoice-dollar" style="color:#0d9488;"></i> ' + prefix + '</div>';
  }

  // حالة 1: قيد مركب - من مذكورين
  if (/من\s*مذكورين/i.test(raw)) {
    var creditMatch = raw.match(/([\d,.]+)?\s*[-–—]?\s*(إلى\s*مذكورين|الى\s*مذكورين|إلى\s*حـ?\/|الى\s*حـ?\/|إلى\s*ح\/|الى\s*ح\/)\s*([\s\S]*)$/i);
    var debitSide = creditMatch ? raw.slice(0, creditMatch.index).replace(/^.*من\s*مذكورين:?\s*/i, '').trim() : raw.replace(/^.*من\s*مذكورين:?\s*/i, '').trim();
    var preCreditAmt = creditMatch ? (creditMatch[1] || '') : '';
    var creditOp = creditMatch ? (creditMatch[2] || '') : '';
    var creditSide = creditMatch ? (creditMatch[3] || '').trim() : '';

    html += '<div class="entry-line entry-compound-head"><i class="fas fa-layer-group" style="color:#059669;"></i> من مذكورين:</div>';
    var debitItems = debitSide.split(/\+|\n|;/);
    debitItems.forEach(function(item) {
      item = item.trim();
      if (!item) return;
      var mAmt = item.match(/^([\d,.]+)\s*(.*)$/) || item.match(/^(.*?)\s+([\d,.]+)$/);
      var amt = '';
      var acc = item;
      if (mAmt) {
        if (/^\d/.test(mAmt[1])) { amt = mAmt[1]; acc = mAmt[2]; }
        else { amt = mAmt[2]; acc = mAmt[1]; }
      }
      acc = acc.replace(/^من\s*حـ?\/?\s*/i, '').replace(/^حـ?\/?\s*/i, '').replace(/^من\s+/i, '').trim();
      html += '<div class="entry-line entry-debit">' +
        formatAmountBadge(amt) +
        '<span class="entry-side-tag">من حـ/</span>' +
        '<span class="entry-account-name">' + acc + '</span>' +
      '</div>';
    });

    if (creditSide || creditOp) {
      if (/مذكورين/i.test(creditOp)) {
        html += '<div class="entry-line entry-compound-head"><i class="fas fa-layer-group" style="color:#0284c7;"></i> إلى مذكورين:</div>';
        var cItems = creditSide.split(/\+|\n|;/);
        cItems.forEach(function(cItem) {
          cItem = cItem.trim();
          if (!cItem) return;
          var cAmtM = cItem.match(/^([\d,.]+)\s*(.*)$/) || cItem.match(/^(.*?)\s+([\d,.]+)$/);
          var cAmt = '';
          var cAcc = cItem;
          if (cAmtM) {
            if (/^\d/.test(cAmtM[1])) { cAmt = cAmtM[1]; cAcc = cAmtM[2]; }
            else { cAmt = cAmtM[2]; cAcc = cAmtM[1]; }
          }
          cAcc = cAcc.replace(/^(?:إلى|الى)\s*حـ?\/?\s*/i, '').replace(/^حـ?\/?\s*/i, '').trim();
          html += '<div class="entry-line entry-credit">' +
            formatAmountBadge(cAmt) +
            '<span class="entry-side-tag">إلى حـ/</span>' +
            '<span class="entry-account-name">' + cAcc + '</span>' +
          '</div>';
        });
      } else {
        var cAmt = preCreditAmt || '';
        var cAcc = creditSide;
        var cAmtMatch = creditSide.match(/^([\d,.]+)\s*(.*)$/) || creditSide.match(/^(.*?)\s+([\d,.]+)$/);
        if (cAmtMatch) {
          if (/^\d/.test(cAmtMatch[1])) { cAmt = cAmt || cAmtMatch[1]; cAcc = cAmtMatch[2]; }
          else { cAmt = cAmt || cAmtMatch[2]; cAcc = cAmtMatch[1]; }
        }
        cAcc = cAcc.replace(/^(?:إلى|الى)\s*حـ?\/?\s*/i, '').replace(/^حـ?\/?\s*/i, '').trim();
        html += '<div class="entry-line entry-credit">' +
          formatAmountBadge(cAmt) +
          '<span class="entry-side-tag">إلى حـ/</span>' +
          '<span class="entry-account-name">' + cAcc + '</span>' +
        '</div>';
      }
    }
  }
  // حالة 2: قيد مركب - إلى مذكورين (طرف مدين واحد يليه إلى مذكورين)
  else if (/إلى\s*مذكورين|الى\s*مذكورين/i.test(raw)) {
    var parts = raw.split(/[-–—]?\s*(إلى\s*مذكورين:?|الى\s*مذكورين:?)\s*/i);
    var debitSide = (parts[0] || '').trim();
    var creditSide = (parts[2] || '').trim();

    var dAmtMatch = debitSide.match(/^([\d,.]+)\s*(.*)$/) || debitSide.match(/^(.*?)\s+([\d,.]+)$/);
    var dAmt = '';
    var dAcc = debitSide;
    if (dAmtMatch) {
      if (/^\d/.test(dAmtMatch[1])) { dAmt = dAmtMatch[1]; dAcc = dAmtMatch[2]; }
      else { dAmt = dAmtMatch[2]; dAcc = dAmtMatch[1]; }
    }
    dAcc = dAcc.replace(/^من\s*حـ?\/?\s*/i, '').replace(/^حـ?\/?\s*/i, '').trim();

    html += '<div class="entry-line entry-debit">' +
      formatAmountBadge(dAmt) +
      '<span class="entry-side-tag">من حـ/</span>' +
      '<span class="entry-account-name">' + dAcc + '</span>' +
    '</div>';

    html += '<div class="entry-line entry-compound-head"><i class="fas fa-layer-group" style="color:#0284c7;"></i> إلى مذكورين:</div>';
    var creditItems = creditSide.split(/\+|\n|;/);
    creditItems.forEach(function(item) {
      item = item.trim();
      if (!item) return;
      var mAmt = item.match(/^([\d,.]+)\s*(.*)$/) || item.match(/^(.*?)\s+([\d,.]+)$/);
      var amt = '';
      var acc = item;
      if (mAmt) {
        if (/^\d/.test(mAmt[1])) { amt = mAmt[1]; acc = mAmt[2]; }
        else { amt = mAmt[2]; acc = mAmt[1]; }
      }
      acc = acc.replace(/^(?:إلى|الى)\s*حـ?\/?\s*/i, '').replace(/^حـ?\/?\s*/i, '').trim();
      html += '<div class="entry-line entry-credit">' +
        formatAmountBadge(amt) +
        '<span class="entry-side-tag">إلى حـ/</span>' +
        '<span class="entry-account-name">' + acc + '</span>' +
      '</div>';
    });
  }
  // حالة 3: قيد بسيط (طرف مدين وطرف دائن)
  else if (hasMin && hasIla) {
    var dStr = '';
    var cStr = '';
    var midAmt = '';

    if (raw.indexOf('\n') !== -1) {
      var rLines = raw.split(/\n+/).map(function(l){ return l.trim(); }).filter(Boolean);
      dStr = rLines.filter(function(l){ return /(?:من\s*حـ?\/|من\s*ح\/)/i.test(l); }).join(' ') || rLines[0] || '';
      cStr = rLines.filter(function(l){ return /(?:إلى\s*حـ?\/|إلى\s*ح\/|الى\s*حـ?\/|الى\s*ح\/)/i.test(l); }).join(' ') || rLines[1] || '';
    } else {
      var splitMatch = raw.match(/\s*[-–—]?\s*(?:([\d,.]+)\s*)?[-–—]?\s*(إلى\s*حـ?\/.*|الى\s*حـ?\/.*)$/i);
      if (splitMatch) {
        dStr = raw.slice(0, splitMatch.index).trim();
        midAmt = splitMatch[1] || '';
        cStr = splitMatch[2].trim();
      } else {
        dStr = raw;
      }
    }

    var dAmtMatch = dStr.match(/^([\d,.]+)\s*(.*)$/) || dStr.match(/^(.*?)\s+([\d,.]+)$/);
    var dAmt = '';
    var dAcc = dStr;
    if (dAmtMatch) {
      if (/^\d/.test(dAmtMatch[1])) { dAmt = dAmtMatch[1]; dAcc = dAmtMatch[2]; }
      else { dAmt = dAmtMatch[2]; dAcc = dAmtMatch[1]; }
    }
    if (!dAmt && midAmt) {
      var cHasAmt = /(?:^|\s)([\d,.]+)(?:\s|$)/.test(cStr);
      if (cHasAmt) { dAmt = midAmt; midAmt = ''; }
    }
    dAcc = dAcc.replace(/^من\s*حـ?\/?\s*/i, '').replace(/^حـ?\/?\s*/i, '').replace(/[-–—]+$/, '').trim();

    var cAmtMatch = cStr.match(/^([\d,.]+)\s*(.*)$/) || cStr.match(/^(.*?)\s+([\d,.]+)$/);
    var cAmt = midAmt || '';
    var cAcc = cStr;
    if (cAmtMatch) {
      if (/^\d/.test(cAmtMatch[1])) { cAmt = cAmt || cAmtMatch[1]; cAcc = cAmtMatch[2]; }
      else { cAmt = cAmt || cAmtMatch[2]; cAcc = cAmtMatch[1]; }
    }
    cAcc = cAcc.replace(/^(?:إلى|الى)\s*حـ?\/?\s*/i, '').replace(/^حـ?\/?\s*/i, '').trim();
    if (!cAmt && dAmt) cAmt = dAmt;
    if (!dAmt && cAmt) dAmt = cAmt;

    html += '<div class="entry-line entry-debit">' +
      formatAmountBadge(dAmt) +
      '<span class="entry-side-tag">من حـ/</span>' +
      '<span class="entry-account-name">' + dAcc + '</span>' +
    '</div>';

    if (cAcc) {
      html += '<div class="entry-line entry-credit">' +
        formatAmountBadge(cAmt) +
        '<span class="entry-side-tag">إلى حـ/</span>' +
        '<span class="entry-account-name">' + cAcc + '</span>' +
      '</div>';
    }
  }
  // حالة 4: سطر مدين منفرد
  else if (hasMin) {
    var dAmtMatch = raw.match(/^([\d,.]+)\s*(.*)$/) || raw.match(/^(.*?)\s+([\d,.]+)$/);
    var dAmt = dAmtMatch ? ( /^\d/.test(dAmtMatch[1]) ? dAmtMatch[1] : dAmtMatch[2] ) : '';
    var dAcc = dAmtMatch ? ( /^\d/.test(dAmtMatch[1]) ? dAmtMatch[2] : dAmtMatch[1] ) : raw;
    dAcc = dAcc.replace(/^من\s*حـ?\/?\s*/i, '').trim();
    html += '<div class="entry-line entry-debit">' +
      formatAmountBadge(dAmt) +
      '<span class="entry-side-tag">من حـ/</span>' +
      '<span class="entry-account-name">' + dAcc + '</span>' +
    '</div>';
  }
  // حالة 5: سطر دائن منفرد
  else if (hasIla) {
    var cAmtMatch = raw.match(/^([\d,.]+)\s*(.*)$/) || raw.match(/^(.*?)\s+([\d,.]+)$/);
    var cAmt = cAmtMatch ? ( /^\d/.test(cAmtMatch[1]) ? cAmtMatch[1] : cAmtMatch[2] ) : '';
    var cAcc = cAmtMatch ? ( /^\d/.test(cAmtMatch[1]) ? cAmtMatch[2] : cAmtMatch[1] ) : raw;
    cAcc = cAcc.replace(/^(?:إلى|الى)\s*حـ?\/?\s*/i, '').trim();
    html += '<div class="entry-line entry-credit">' +
      formatAmountBadge(cAmt) +
      '<span class="entry-side-tag">إلى حـ/</span>' +
      '<span class="entry-account-name">' + cAcc + '</span>' +
    '</div>';
  }

  if (explanation) {
    html += '<div class="entry-desc-row"><i class="fas fa-info-circle"></i> شرح القيد: ' + explanation + '</div>';
  }

  html += '</div>';
  return html;
}

// ══════════════════════════════════════════════════════════════════
//  دوال تحليل وتوليد جدول دفتر اليومية النموذجي (الاتجاه من اليمين لليسار RTL)
// ══════════════════════════════════════════════════════════════════

function isJournalSectionHeader(str) {
  var t = String(str || '').trim();
  return /^(?:[أ-ي\d]+[\)\.\-]\s*)?(?:تسجيل\s*(?:جميع\s*)?العمليات\s*المالية\s*في\s*دفتر\s*اليومية|القيود\s*(?:المحاسبية\s*)?في\s*دفتر\s*اليومية|قيود\s*الإقفال\s*(?:في\s*دفتر\s*اليومية)?|دفتر\s*اليومية|تسجيل\s*القيود\s*(?:المحاسبية)?|\(حل\s*تطبيقي\s*وفق\s*منهجية\s*الكتاب\s*في\s*(?:تحليل\s*العمليات\s*وتسجيل\s*القيود|دفتر\s*اليومية)\):?|\(قيود\s*إقفال\s*الحسابات\s*في\s*دفتر\s*اليومية)/i.test(t);
}

function isJournalSectionStop(str) {
  var t = String(str || '').trim();
  return /^(?:[─\-=_*]{3,}|(?:ب|ج|د|هـ)\s*[\)\.\+]|ثانياً|ثالثاً|ملاحظة:?|(?:\d+[\.\-\)]\s*)?تحديد\s*رأس\s*المال)/i.test(t);
}

function isNewEntryStart(str) {
  var t = String(str || '').trim();
  return /^(?:(?:\d+[\.\-\)]\s*)*(?:بتاريخ\s*[^:\n]+:?|قيد\s*[^:\n]+:?|\d{4}\/\d{1,2}\/\d{1,2}[^:\n]*:?|\d+[\.\-\)]\s*)+:?\s*)*(?:(?:\d+[\.\-\)]\s*)|(?:بتاريخ\s*[^:\n]+:?)|(?:قيد\s*[^:\n]+:?))/i.test(t) &&
         (/(?:من\s*حـ?\/|من\s*ح\/|من\s*مذكورين|إلى\s*حـ?\/|إلى\s*ح\/|الى\s*حـ?\/|الى\s*ح\/|إلى\s*مذكورين|الى\s*مذكورين)/i.test(t) ||
          /^(?:\d+[\.\-\)]\s*)*(?:بتاريخ\s*[^:\n]+:?|قيد\s*[^:\n]+:?|\d{4}\/\d{1,2}\/\d{1,2}[^:\n]*:?|\d+[\.\-\)]\s*)+:?\s*$/.test(t));
}

function parseSingleAccountingEntry(entryText, defaultNum) {
  var raw = String(entryText || '').trim();
  if (!raw) return null;

  var qNum = '';
  var dateStr = '';
  var explanation = '';

  var numMatch = raw.match(/^(\d+)[\.\-\)]/);
  if (numMatch) {
    qNum = numMatch[1];
  } else if (defaultNum) {
    qNum = String(defaultNum);
  }

  var dateMatch = raw.match(/بتاريخ\s*([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2}(?:\s*م)?|[0-9]{1,2}\/[0-9]{1,2}(?:\s*م)?|[0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/i);
  if (dateMatch) {
    dateStr = dateMatch[1].trim();
  }

  var expMatch = raw.match(/\(([^)]+)\)[\s\.]*$/);
  if (expMatch && !/(?:من\s*حـ?\/|إلى\s*حـ?\/)/i.test(expMatch[1])) {
    explanation = expMatch[1].trim();
    raw = raw.replace(/\(([^)]+)\)[\s\.]*$/, '').trim();
  }

  var cleaned = raw
    .replace(/^((?:\d+[\.\-\)]\s*)*(?:بتاريخ\s*[^:\n]+:?|قيد\s*[^:\n]+:?|\d{4}\/\d{1,2}\/\d{1,2}[^:\n]*:?|\d+[\.\-\)]\s*)+:?\s*)+/i, '')
    .trim();

  var lines = cleaned.split(/\n+/).map(function(l) { return l.trim(); }).filter(Boolean);
  var entryLines = [];

  var parseSubAccounts = function(str, defaultAmt, type) {
    var parts = str.split(/\+|\s+و\s+/);
    var res = [];
    parts.forEach(function(p) {
      p = p.trim();
      if (!p) return;
      var amtMatch = p.match(/^([0-9\.,]+)\s+(.*)/) || p.match(/(.*?)\s+([0-9\.,]+)$/);
      var amt = defaultAmt || '';
      var title = p;
      if (amtMatch) {
        if (/^[0-9\.,]+$/.test(amtMatch[1])) {
          amt = amtMatch[1];
          title = amtMatch[2].trim();
        } else if (/^[0-9\.,]+$/.test(amtMatch[2])) {
          amt = amtMatch[2];
          title = amtMatch[1].trim();
        }
      }
      title = title.replace(/^(?:من\s*|إلى\s*|الى\s*)?(?:حـ?\/|ح\/)?/i, '').trim();
      title = title.replace(/^[0-9\.,]+\s*/, '').trim();
      title = title.replace(/\s*[0-9\.,]+$/, '').trim();
      res.push({
        type: type,
        amount: amt,
        account: 'حـ/ ' + title
      });
    });
    return res;
  };

  if (lines.length === 1 && /(?:من\s*حـ?\/|من\s*مذكورين).*?(?:إلى\s*حـ?\/|الى\s*حـ?\/|إلى\s*مذكورين)/i.test(lines[0])) {
    var single = lines[0];
    var splitRegex = /\s*-\s*(?=(?:إلى\s*حـ?\/|الى\s*حـ?\/|إلى\s*مذكورين|الى\s*مذكورين))/i;
    var sideParts = single.split(splitRegex);
    if (sideParts.length < 2) {
      sideParts = single.split(/(?=(?:إلى\s*حـ?\/|الى\s*حـ?\/|إلى\s*مذكورين|الى\s*مذكورين))/i);
    }
    var debitPart = sideParts[0] ? sideParts[0].trim() : '';
    var creditPart = sideParts[1] ? sideParts[1].trim() : '';

    var debitAmt = '';
    if (/من\s*مذكورين/i.test(debitPart)) {
      entryLines.push({ type: 'compound_head_debit', amount: '', account: 'من مذكورين:' });
      var afterMzk = debitPart.replace(/.*من\s*مذكورين:?\s*/i, '');
      var subs = parseSubAccounts(afterMzk, '', 'debit_sub');
      subs.forEach(function(s) { entryLines.push(s); });
    } else {
      var dNumM = debitPart.match(/^([0-9\.,]+)\s+(.*)/) || debitPart.match(/(.*?)\s+([0-9\.,]+)$/);
      var dAcc = debitPart;
      if (dNumM) {
        if (/^[0-9\.,]+$/.test(dNumM[1])) {
          debitAmt = dNumM[1];
          dAcc = dNumM[2].trim();
        } else if (/^[0-9\.,]+$/.test(dNumM[2])) {
          debitAmt = dNumM[2];
          dAcc = dNumM[1].trim();
        }
      }
      dAcc = dAcc.replace(/^.*من\s*(?:حـ?\/|ح\/)?/i, '').trim();
      dAcc = dAcc.replace(/^[0-9\.,]+\s*/, '').trim();
      dAcc = dAcc.replace(/\s*[0-9\.,]+$/, '').trim();
      entryLines.push({ type: 'debit', amount: debitAmt, account: 'من حـ/ ' + dAcc });
    }

    if (/(?:إلى|الى)\s*مذكورين/i.test(creditPart)) {
      entryLines.push({ type: 'compound_head_credit', amount: '', account: 'إلى مذكورين:' });
      var afterMzkC = creditPart.replace(/.*(?:إلى|الى)\s*مذكورين:?\s*/i, '');
      var subsC = parseSubAccounts(afterMzkC, '', 'credit_sub');
      subsC.forEach(function(s) { entryLines.push(s); });
    } else {
      var cNumM = creditPart.match(/^([0-9\.,]+)\s+(.*)/) || creditPart.match(/(.*?)\s+([0-9\.,]+)$/);
      var creditAmt = '';
      var cAcc = creditPart;
      if (cNumM) {
        if (/^[0-9\.,]+$/.test(cNumM[1])) {
          creditAmt = cNumM[1];
          cAcc = cNumM[2].trim();
        } else if (/^[0-9\.,]+$/.test(cNumM[2])) {
          creditAmt = cNumM[2];
          cAcc = cNumM[1].trim();
        }
      }
      if (!creditAmt && debitAmt) {
        creditAmt = debitAmt;
      }
      cAcc = cAcc.replace(/^(?:إلى|الى)\s*(?:حـ?\/|ح\/)?/i, '').trim();
      cAcc = cAcc.replace(/^[0-9\.,]+\s*/, '').trim();
      cAcc = cAcc.replace(/\s*[0-9\.,]+$/, '').trim();
      entryLines.push({ type: 'credit', amount: creditAmt, account: 'إلى حـ/ ' + cAcc });
    }
  } else {
    var mainDebitAmt = '';
    lines.forEach(function(line) {
      var l = line.trim();
      if (!l) return;
      if (/^من\s*مذكورين:?$/i.test(l)) {
        entryLines.push({ type: 'compound_head_debit', amount: '', account: 'من مذكورين:' });
        return;
      }
      if (/^(?:إلى|الى)\s*مذكورين:?$/i.test(l)) {
        entryLines.push({ type: 'compound_head_credit', amount: '', account: 'إلى مذكورين:' });
        return;
      }
      var isDeb = /من\s*حـ?\/|من\s*ح\//i.test(l);
      var isCred = /(?:إلى|الى)\s*حـ?\/|(?:إلى|الى)\s*ح\//i.test(l);

      var numM = l.match(/^([0-9\.,]+)\s+(.*)/) || l.match(/(.*?)\s+([0-9\.,]+)$/);
      var amt = '';
      var text = l;
      if (numM) {
        if (/^[0-9\.,]+$/.test(numM[1])) {
          amt = numM[1];
          text = numM[2].trim();
        } else if (/^[0-9\.,]+$/.test(numM[2])) {
          amt = numM[2];
          text = numM[1].trim();
        }
      }

      if (isDeb) {
        text = text.replace(/.*من\s*(?:حـ?\/|ح\/)?/i, '').trim();
        text = text.replace(/^[0-9\.,]+\s*/, '').trim();
        text = text.replace(/\s*[0-9\.,]+$/, '').trim();
        if (amt) mainDebitAmt = amt;
        entryLines.push({ type: 'debit', amount: amt, account: 'من حـ/ ' + text });
      } else if (isCred) {
        text = text.replace(/.*(?:إلى|الى)\s*(?:حـ?\/|ح\/)?/i, '').trim();
        text = text.replace(/^[0-9\.,]+\s*/, '').trim();
        text = text.replace(/\s*[0-9\.,]+$/, '').trim();
        if (!amt && mainDebitAmt) amt = mainDebitAmt;
        entryLines.push({ type: 'credit', amount: amt, account: 'إلى حـ/ ' + text });
      } else {
        if (entryLines.some(function(e) { return e.type === 'compound_head_credit'; })) {
          text = text.replace(/^(?:حـ?\/|ح\/)?/i, '').trim();
          text = text.replace(/^[0-9\.,]+\s*/, '').trim();
          text = text.replace(/\s*[0-9\.,]+$/, '').trim();
          entryLines.push({ type: 'credit_sub', amount: amt, account: 'حـ/ ' + text });
        } else if (entryLines.some(function(e) { return e.type === 'compound_head_debit'; })) {
          text = text.replace(/^(?:حـ?\/|ح\/)?/i, '').trim();
          text = text.replace(/^[0-9\.,]+\s*/, '').trim();
          text = text.replace(/\s*[0-9\.,]+$/, '').trim();
          entryLines.push({ type: 'debit_sub', amount: amt, account: 'حـ/ ' + text });
        } else if (/^\([^)]+\)$/.test(l)) {
          explanation = l.replace(/^\(|\)$/g, '').trim();
        }
      }
    });
  }

  return {
    qNum: qNum || '1',
    date: dateStr || '-',
    explanation: explanation,
    lines: entryLines
  };
}

function parseJournalBookSection(rawLines, customTitle) {
  var entries = [];
  var curEntryLines = [];

  rawLines.forEach(function(l) {
    if (!l.trim()) return;
    if (isJournalSectionStop(l)) return;
    if (isNewEntryStart(l) && curEntryLines.length > 0) {
      entries.push(curEntryLines.join('\n'));
      curEntryLines = [l];
    } else {
      curEntryLines.push(l);
    }
  });
  if (curEntryLines.length > 0) {
    entries.push(curEntryLines.join('\n'));
  }

  var parsedEntries = [];
  entries.forEach(function(eText, idx) {
    var parsed = parseSingleAccountingEntry(eText, idx + 1);
    if (parsed && parsed.lines && parsed.lines.length > 0) {
      parsedEntries.push(parsed);
    }
  });

  return {
    title: customTitle || 'دفتر اليومية العام (سجل القيود المحاسبية)',
    entries: parsedEntries
  };
}

function formatJournalCellAmount(amt) {
  if (!amt && amt !== 0) return '&nbsp;';
  var str = String(amt).trim();
  if (!str) return '&nbsp;';
  var clean = str.replace(/,/g, '');
  var num = parseFloat(clean);
  if (!isNaN(num) && /^[0-9\.,]+$/.test(str)) {
    return num.toLocaleString('en-US');
  }
  return str;
}

function renderJournalTable(entries, title) {
  if (!entries || !entries.length) return '';
  var displayTitle = title || 'دفتر اليومية العام (سجل القيود المحاسبية)';

  var totalDebit = 0;
  var totalCredit = 0;
  entries.forEach(function(e) {
    e.lines.forEach(function(l) {
      if (l.type === 'debit' || l.type === 'debit_sub') {
        var num = parseFloat(String(l.amount).replace(/,/g, ''));
        if (!isNaN(num)) totalDebit += num;
      }
      if (l.type === 'credit' || l.type === 'credit_sub') {
        var num = parseFloat(String(l.amount).replace(/,/g, ''));
        if (!isNaN(num)) totalCredit += num;
      }
    });
  });

  var html = '<div class="journal-book-container" dir="rtl">';
  html += '  <div class="journal-book-title">';
  html += '    <span><i class="fas fa-book-open" style="margin-left: 8px;"></i>' + displayTitle + '</span>';
  html += '    <span class="journal-book-badge">' + entries.length + ' قيود محاسبية</span>';
  html += '  </div>';
  html += '  <div class="journal-book-scroll">';
  html += '    <table class="journal-book-table" dir="rtl">';
  html += '      <thead>';
  html += '        <tr>';
  html += '          <th class="jb-th jb-col-debit">مدين</th>';
  html += '          <th class="jb-th jb-col-credit">دائن</th>';
  html += '          <th class="jb-th jb-col-desc">البيان</th>';
  html += '          <th class="jb-th jb-col-qnum">رقم القيد</th>';
  html += '          <th class="jb-th jb-col-date">التاريخ</th>';
  html += '        </tr>';
  html += '      </thead>';
  html += '      <tbody>';

  entries.forEach(function(entry, eIdx) {
    var rowCount = entry.lines.length + (entry.explanation ? 1 : 0);
    if (rowCount === 0) rowCount = 1;

    entry.lines.forEach(function(line, lIdx) {
      var isFirst = (lIdx === 0);
      var isLast = (lIdx === entry.lines.length - 1 && !entry.explanation);
      var rowClass = isLast ? ' class="jb-row-last-in-entry"' : '';

      html += '        <tr' + rowClass + '>';

      // Debit cell (مبلغ المدين أو فراغ)
      if (line.type === 'debit' || line.type === 'debit_sub') {
        html += '          <td class="jb-td jb-cell-debit">' + formatJournalCellAmount(line.amount) + '</td>';
      } else {
        html += '          <td class="jb-td jb-cell-debit">&nbsp;</td>';
      }

      // Credit cell (مبلغ الدائن أو فراغ)
      if (line.type === 'credit' || line.type === 'credit_sub') {
        html += '          <td class="jb-td jb-cell-credit">' + formatJournalCellAmount(line.amount) + '</td>';
      } else {
        html += '          <td class="jb-td jb-cell-credit">&nbsp;</td>';
      }

      // Description cell (البيان: من حـ/ أو إلى حـ/)
      var descClass = 'jb-desc-' + line.type.replace(/_/g, '-');
      html += '          <td class="jb-td jb-cell-desc ' + descClass + '">' + line.account + '</td>';

      // Merged columns (رقم القيد والتاريخ) with rowspan on first row of entry
      if (isFirst) {
        html += '          <td class="jb-td jb-cell-qnum" rowspan="' + rowCount + '">' + (entry.qNum || (eIdx + 1)) + '</td>';
        html += '          <td class="jb-td jb-cell-date" rowspan="' + rowCount + '">' + (entry.date || '-') + '</td>';
      }

      html += '        </tr>';
    });

    if (entry.explanation) {
      html += '        <tr class="jb-row-last-in-entry">';
      html += '          <td class="jb-td jb-cell-debit">&nbsp;</td>';
      html += '          <td class="jb-td jb-cell-credit">&nbsp;</td>';
      html += '          <td class="jb-td jb-cell-desc jb-desc-explanation">(' + entry.explanation + ')</td>';
      html += '        </tr>';
    }
  });

  html += '      </tbody>';

  if (totalDebit > 0 && totalCredit > 0) {
    html += '      <tfoot>';
    html += '        <tr class="jb-row-totals" style="background: #f0fdfa; font-weight: 900; border-top: 2px solid #0f766e;">';
    html += '          <td class="jb-td jb-cell-debit" style="color: #166534; font-size: 14.5px;">' + totalDebit.toLocaleString('en-US') + '</td>';
    html += '          <td class="jb-td jb-cell-credit" style="color: #0369a1; font-size: 14.5px;">' + totalCredit.toLocaleString('en-US') + '</td>';
    html += '          <td class="jb-td jb-cell-desc" style="font-weight: 900; color: #0f766e;">المجموع العام لدفتر اليومية</td>';
    html += '          <td class="jb-td" colspan="2" style="text-align: center; color: #15803d; font-weight: 800; font-size: 12.5px;">';
    html += '            <i class="fas fa-check-circle" style="margin-left: 4px;"></i>توازن محاسبي مطابق';
    html += '          </td>';
    html += '        </tr>';
    html += '      </tfoot>';
  }

  html += '    </table>';
  html += '  </div>';
  html += '</div>';

  return html;
}

function formatQuestionContent(text) {
  if (!text) return '';
  text = String(text);

  var blocks = [];
  function storeBlock(html) {
    var id = '___BLOCK_' + blocks.length + '___';
    blocks.push(html);
    return id;
  }

  // 1. معالجة الصور بصيغة الماركداون: ![وصف الصورة](رابط أو DataURL)
  text = text.replace(/!\[(.*?)\]\((.+?)\)/g, function(match, alt, url) {
    alt = (alt || 'صورة توضيحية').trim();
    url = url.trim();
    var cleanAlt = alt.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    var safeCap = cleanAlt.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var imgHtml = '<div class="qimage-wrap">' +
      '<div class="qimage-card" onclick="openImageLightbox(this.querySelector(\'img\').src, \'' + safeCap + '\')" title="انقر لتكبير وتفحص الصورة">' +
        '<img src="' + url + '" alt="' + cleanAlt + '" class="qimage-img" loading="lazy" />' +
        '<div class="qimage-zoom-hint"><i class="fas fa-search-plus"></i> ' + cleanAlt + ' — انقر للتكبير والتصغير</div>' +
      '</div></div>';
    return storeBlock(imgHtml);
  });

  // 2. معالجة وسوم [img]url[/img]
  text = text.replace(/\[img\](.+?)\[\/img\]/gi, function(match, url) {
    var u = url.trim();
    var imgHtml = '<div class="qimage-wrap">' +
      '<div class="qimage-card" onclick="openImageLightbox(this.querySelector(\'img\').src, \'صورة توضيحية\')" title="انقر لتكبير وتفحص الصورة">' +
        '<img src="' + u + '" alt="صورة توضيحية" class="qimage-img" loading="lazy" />' +
        '<div class="qimage-zoom-hint"><i class="fas fa-search-plus"></i> انقر للتكبير والتصغير</div>' +
      '</div></div>';
    return storeBlock(imgHtml);
  });

  // 3. معالجة وسوم HTML المباشرة <img ...>
  text = text.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi, function(match, src) {
    var imgHtml = '<div class="qimage-wrap">' +
      '<div class="qimage-card" onclick="openImageLightbox(this.querySelector(\'img\').src, \'صورة توضيحية\')" title="انقر لتكبير وتفحص الصورة">' +
        '<img src="' + src + '" alt="صورة توضيحية" class="qimage-img" loading="lazy" />' +
        '<div class="qimage-zoom-hint"><i class="fas fa-search-plus"></i> انقر للتكبير والتصغير</div>' +
      '</div></div>';
    return storeBlock(imgHtml);
  });

  // 4. معالجة وسوم HTML المباشرة <table>...</table>
  text = text.replace(/<table[\s\S]*?<\/table>/gi, function(tableHtml) {
    return storeBlock('<div class="qtable-wrap">' + tableHtml + '</div>');
  });

  // 5. معالجة الأسطر: دمج الجداول والقيود المحاسبية متعددة الأسطر
  var lines = text.split(/\r?\n/);
  var outLines = [];
  var tableBuffer = [];

  function flushTable() {
    if (tableBuffer.length === 0) return;
    var rows = [];
    for (var i = 0; i < tableBuffer.length; i++) {
      var rawRow = tableBuffer[i].trim();
      if (rawRow.startsWith('|')) rawRow = rawRow.slice(1);
      if (rawRow.endsWith('|')) rawRow = rawRow.slice(0, -1);
      var cells = rawRow.split('|').map(function(c) { return c.trim(); });
      rows.push(cells);
    }

    var isDivider = function(r) {
      return r.length > 0 && r.every(function(cell) { return /^:?-+:?$/.test(cell.trim()); });
    };

    var hasDivider = false;
    if (rows.length >= 2 && isDivider(rows[1])) {
      hasDivider = true;
    }

    var headerRow = rows[0] || [];

    // التحقق إن كان الجدول هو ميزان مراجعة (مثل سؤال 34)
    // المطلوب: العمود اليمين أرصدة مدينة | العمود الأوسط أرصدة دائنة | العمود على الشمال اسم الحساب
    var isTrialBalance = false;
    var nameIdx = -1, debitIdx = -1, creditIdx = -1;

    for (var h = 0; h < headerRow.length; h++) {
      var colName = headerRow[h];
      if (/اسم\s*الحساب|بيان|الحساب/i.test(colName)) nameIdx = h;
      else if (/أرصدة\s*مدينة|ارصدة\s*مدينة|مدين/i.test(colName)) debitIdx = h;
      else if (/أرصدة\s*دائنة|ارصدة\s*دائنة|دائن/i.test(colName)) creditIdx = h;
    }

    if (debitIdx !== -1 && creditIdx !== -1 && nameIdx !== -1) {
      isTrialBalance = true;
    }

    // 1. التحقق إن كان الجدول دفتر أستاذ (T-Account)
    var lHeaderStr = headerRow.join(' ');
    if (/(?:منه|له|الجانب\s*المدين|الجانب\s*الدائن)/i.test(lHeaderStr) || (headerRow.length >= 6 && /مدين/i.test(lHeaderStr) && /دائن/i.test(lHeaderStr))) {
      var genLedgerHtml = parseGenericLedgerFromText(tableBuffer.join('\n'));
      if (genLedgerHtml) {
        outLines.push(storeBlock('<div class="ledger-tables-container">' + genLedgerHtml + '</div>'));
        tableBuffer = [];
        return;
      }
    }

    // 2. التحقق إن كان الجدول دفتر يومية نموذجي
    var jDebitIdx = -1, jCreditIdx = -1, jDescIdx = -1, jQNumIdx = -1, jDateIdx = -1;
    for (var h = 0; h < headerRow.length; h++) {
      var colName = headerRow[h];
      if (/^مدين|مبلغ\s*مدين/i.test(colName) && !/أرصدة|ارصدة/i.test(colName)) jDebitIdx = h;
      else if (/^دائن|مبلغ\s*دائن/i.test(colName) && !/أرصدة|ارصدة/i.test(colName)) jCreditIdx = h;
      else if (/البيان|بيان|اسم\s*الحساب|الحساب/i.test(colName)) jDescIdx = h;
      else if (/رقم\s*القيد|رقم\s*الصفحة|صفحة/i.test(colName)) jQNumIdx = h;
      else if (/التاريخ|تاريخ/i.test(colName)) jDateIdx = h;
    }
    var isJournalTable = (jDebitIdx !== -1 && jCreditIdx !== -1 && jDescIdx !== -1 && !isTrialBalance);

    var tHtml = '';
    if (isJournalTable) {
      tHtml = '<div class="journal-book-container"><div class="journal-book-scroll"><table class="journal-book-table" dir="rtl">';
      tHtml += '<thead><tr>';
      tHtml += '<th class="jb-th jb-col-debit">مدين</th>';
      tHtml += '<th class="jb-th jb-col-credit">دائن</th>';
      tHtml += '<th class="jb-th jb-col-desc">البيان</th>';
      if (jQNumIdx !== -1) tHtml += '<th class="jb-th jb-col-qnum">رقم القيد</th>';
      if (jDateIdx !== -1) tHtml += '<th class="jb-th jb-col-date">التاريخ</th>';
      tHtml += '</tr></thead><tbody>';

      var startIdx = hasDivider ? 2 : 1;
      for (var r = startIdx; r < rows.length; r++) {
        var row = rows[r];
        if (isDivider(row)) continue;
        var dVal = row[jDebitIdx] !== undefined ? row[jDebitIdx] : '';
        var cVal = row[jCreditIdx] !== undefined ? row[jCreditIdx] : '';
        var descVal = row[jDescIdx] !== undefined ? row[jDescIdx] : '';
        var qVal = (jQNumIdx !== -1 && row[jQNumIdx] !== undefined) ? row[jQNumIdx] : '';
        var dtVal = (jDateIdx !== -1 && row[jDateIdx] !== undefined) ? row[jDateIdx] : '';

        var isTotal = /مجموع|إجمالي|المجموع/i.test(descVal) || /مجموع|إجمالي|المجموع/i.test(dVal) || /مجموع|إجمالي|المجموع/i.test(cVal);
        if (isTotal) {
          tHtml += '<tr class="jb-row-totals">';
          tHtml += '<td class="jb-td jb-cell-debit">' + (dVal || '-') + '</td>';
          tHtml += '<td class="jb-td jb-cell-credit">' + (cVal || '-') + '</td>';
          tHtml += '<td class="jb-td jb-cell-desc" style="font-weight:900;">' + (descVal || 'المجموع') + '</td>';
          if (jQNumIdx !== -1) tHtml += '<td class="jb-td" colspan="' + (jDateIdx !== -1 ? 2 : 1) + '">&nbsp;</td>';
          tHtml += '</tr>';
        } else {
          var descCls = 'jb-desc-debit';
          if (/^(?:إلى|الى)\s*حـ?\//i.test(descVal)) descCls = 'jb-desc-credit';
          else if (/^\([^)]+\)$/.test(descVal)) descCls = 'jb-desc-explanation';

          tHtml += '<tr>';
          tHtml += '<td class="jb-td jb-cell-debit">' + (dVal && dVal !== '-' ? formatJournalCellAmount(dVal) : '&nbsp;') + '</td>';
          tHtml += '<td class="jb-td jb-cell-credit">' + (cVal && cVal !== '-' ? formatJournalCellAmount(cVal) : '&nbsp;') + '</td>';
          tHtml += '<td class="jb-td jb-cell-desc ' + descCls + '">' + (descVal || '-') + '</td>';
          if (jQNumIdx !== -1) tHtml += '<td class="jb-td jb-cell-qnum">' + (qVal || '-') + '</td>';
          if (jDateIdx !== -1) tHtml += '<td class="jb-td jb-cell-date">' + (dtVal || '-') + '</td>';
          tHtml += '</tr>';
        }
      }
      tHtml += '</tbody></table></div></div>';
    } else if (isTrialBalance) {
      tHtml = '<div class="qtable-wrap"><table class="qtable">';
      // إجبار الترتيب المطلوب بدقة:
      // اليمين: أرصدة مدينة | الأوسط: أرصدة دائنة | الشمال: اسم الحساب
      tHtml += '<thead><tr>';
      tHtml += '<th style="text-align:center; color:#15803d;"><i class="fas fa-arrow-circle-down"></i> أرصدة مدينة</th>';
      tHtml += '<th style="text-align:center; color:#0369a1;"><i class="fas fa-arrow-circle-up"></i> أرصدة دائنة</th>';
      tHtml += '<th style="text-align:right;"><i class="fas fa-file-invoice"></i> اسم الحساب</th>';
      tHtml += '</tr></thead><tbody>';

      var startIdx = hasDivider ? 2 : 1;
      for (var r = startIdx; r < rows.length; r++) {
        var row = rows[r];
        if (isDivider(row)) continue;
        var dVal = row[debitIdx] !== undefined ? row[debitIdx] : '';
        var cVal = row[creditIdx] !== undefined ? row[creditIdx] : '';
        var nVal = row[nameIdx] !== undefined ? row[nameIdx] : '';

        var isTotalRow = /مجموع|إجمالي|المجموع/i.test(nVal) || /مجموع|إجمالي|المجموع/i.test(dVal) || /مجموع|إجمالي|المجموع/i.test(cVal);
        var trStyle = isTotalRow ? ' style="font-weight:900; background:#f1f5f9; border-top:2px solid #64748b;"' : '';

        tHtml += '<tr' + trStyle + '>';
        tHtml += '<td style="text-align:center; font-weight:800; color:#166534;">' + (dVal || '-') + '</td>';
        tHtml += '<td style="text-align:center; font-weight:800; color:#075985;">' + (cVal || '-') + '</td>';
        tHtml += '<td style="text-align:right; font-weight:700;">' + (nVal || '-') + '</td>';
        tHtml += '</tr>';
      }
      tHtml += '</tbody></table></div>';
    } else {
      tHtml = '<div class="qtable-wrap"><table class="qtable">';
      tHtml += '<thead><tr>';
      for (var h = 0; h < headerRow.length; h++) {
        tHtml += '<th>' + (headerRow[h] || '') + '</th>';
      }
      tHtml += '</tr></thead><tbody>';

      var startIdx = hasDivider ? 2 : 1;
      for (var r = startIdx; r < rows.length; r++) {
        var row = rows[r];
        if (isDivider(row)) continue;
        tHtml += '<tr>';
        for (var c = 0; c < headerRow.length; c++) {
          var val = row[c] !== undefined ? row[c] : '';
          tHtml += '<td>' + (val || '-') + '</td>';
        }
        tHtml += '</tr>';
      }
      tHtml += '</tbody></table></div>';
    }
    outLines.push(storeBlock(tHtml));
    tableBuffer = [];
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();

    // التحقق من جداول الماركداون
    if (trimmed.includes('|') && (trimmed.startsWith('|') || trimmed.endsWith('|') || trimmed.split('|').length >= 3)) {
      tableBuffer.push(trimmed);
      continue;
    }
    if (tableBuffer.length > 0) flushTable();

    // التحقق من روابط الصور المنفردة على السطر
    var mRawImg = trimmed.match(/^(https?:\/\/[^\s<>"']+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s<>"']*)?)$/i);
    if (mRawImg) {
      var rawImgHtml = '<div class="qimage-wrap">' +
        '<div class="qimage-card" onclick="openImageLightbox(this.querySelector(\'img\').src, \'صورة توضيحية\')" title="انقر لتكبير وتفحص الصورة">' +
          '<img src="' + mRawImg[1] + '" alt="صورة توضيحية" class="qimage-img" loading="lazy" />' +
          '<div class="qimage-zoom-hint"><i class="fas fa-search-plus"></i> انقر للتكبير والتصغير</div>' +
        '</div></div>';
      outLines.push(storeBlock(rawImgHtml));
      continue;
    }

    // ══════════════════════════════════════════════════════════════
    // فحص كتل دفتر الأستاذ العام وترحيل وترصيد الحسابات (T-Accounts)
    // ══════════════════════════════════════════════════════════════
    var isLedgerSection = (
      /^\[دفتر\s*الأستاذ(?::\s*[^\]]+)?\]/i.test(trimmed) ||
      /^(?:###?\s*)?دفتر\s*الأستاذ/i.test(trimmed) ||
      /^(?:###?\s*)?(?:حساب\s*الأستاذ|حساب\s*حرف\s*T|T-Account)/i.test(trimmed) ||
      ((/(?:ترحيل|ترصيد|دفتر\s*الأستاذ)/i.test(trimmed)) && (/(?:الأستاذ|T-Account|الحسابات|حـ\/|الصندوق)/i.test(trimmed))) ||
      (/^(?:ب|\(?ب\)?|\(?ب\s*\+\s*ج\)?|المطلوب\s*ب)\s*[\)\.\-:]/i.test(trimmed) && /(?:ترحيل|ترصيد|الأستاذ)/i.test(trimmed))
    );

    if (isLedgerSection) {
      var lSectionLines = [trimmed];
      var sIdx = i + 1;
      while (sIdx < lines.length) {
        var nextL = lines[sIdx].trim();
        if (/^([─\=\-]{3,}|(?:\(?ج\)?|\(?د\)?|\(?هـ\)?|المطلوب\s*ج)\s*[\)\.\-:]|ميزان\s*المراجعة|دفتر\s*اليومية)/i.test(nextL)) {
          break;
        }
        lSectionLines.push(lines[sIdx]);
        sIdx++;
      }
      var ledgerHtml = renderLedgerBlockFromText(lSectionLines.join('\n')) || renderLedgerBlockFromText(text);
      if (ledgerHtml) {
        if (tableBuffer.length > 0) flushTable();
        var cleanTitle = trimmed.replace(/^[\*\#\-\s]+|[\*\#\-\s:]+$/g, '');
        var titleHtml = '<div class="section-badge-title" style="margin: 20px 0 12px 0; font-size: 15.5px; font-weight: 800; color: #0891b2;"><i class="fas fa-book-open" style="margin-left: 8px;"></i>' + escapeHtml(cleanTitle) + '</div>';
        outLines.push(storeBlock(titleHtml));
        outLines.push(storeBlock(ledgerHtml));

        i = sIdx - 1;
        continue;
      }
    }

    // ══════════════════════════════════════════════════════════════
    // فحص كتل دفتر اليومية النموذجي (Journal Book Table)
    // ══════════════════════════════════════════════════════════════
    var isJHeader = isJournalSectionHeader(trimmed);
    var nextTrimmed = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
    var isJStart = isNewEntryStart(trimmed) && (
      /(?:من\s*حـ?\/|من\s*ح\/|من\s*مذكورين|إلى\s*حـ?\/|إلى\s*ح\/|الى\s*حـ?\/|الى\s*ح\/|إلى\s*مذكورين|الى\s*مذكورين)/i.test(trimmed) ||
      (nextTrimmed && /(?:من\s*حـ?\/|من\s*ح\/|من\s*مذكورين|إلى\s*حـ?\/|إلى\s*ح\/|الى\s*حـ?\/|الى\s*ح\/|إلى\s*مذكورين|الى\s*مذكورين)/i.test(nextTrimmed))
    );

    if (isJHeader || isJStart) {
      var sectionLines = [];
      var sIdx = i;
      var title = '';
      if (isJHeader) {
        title = trimmed.replace(/^[\*\#\-\s]+|[\*\#\-\s:]+$/g, '');
        sIdx = i + 1;
      }

      while (sIdx < lines.length) {
        var sLine = lines[sIdx];
        var sTrimmed = sLine.trim();
        if (sTrimmed && isJournalSectionStop(sTrimmed)) {
          break;
        }
        sectionLines.push(sLine);
        sIdx++;
      }

      var parsedJournal = parseJournalBookSection(sectionLines, title);
      if (parsedJournal && parsedJournal.entries && parsedJournal.entries.length > 0) {
        if (tableBuffer.length > 0) flushTable();
        var journalHtml = renderJournalTable(parsedJournal.entries, parsedJournal.title);
        outLines.push(storeBlock(journalHtml));
        i = sIdx - 1;
        continue;
      }
    }

    // التحقق من القيود المحاسبية المركبة أو متعددة الأسطر المتتابعة
    var isAccountingLine = function(str) {
      return /(?:من\s*حـ?\/|من\s*ح\/|من\s*مذكورين|إلى\s*حـ?\/|إلى\s*ح\/|الى\s*حـ?\/|الى\s*ح\/|إلى\s*مذكورين|الى\s*مذكورين|حـ?\/|ح\/)/i.test(str);
    };

    if (isAccountingLine(trimmed) || /^((?:\d+[\.\-\)]\s*)*(?:بتاريخ\s*[^:\n]+:?|قيد\s*[^:\n]+:?)+\s*)/i.test(trimmed)) {
      // فحص إن كان هذا السطر أو السطور التالية تشكل قيداً متكاملاً متعدد الأسطر
      var chunkLines = [trimmed];
      var nextIdx = i + 1;
      while (nextIdx < lines.length) {
        var nTrimmed = lines[nextIdx].trim();
        if (!nTrimmed) {
          nextIdx++;
          continue;
        }
        if (isAccountingLine(nTrimmed) || /^\([^)]+\)\.?$/.test(nTrimmed)) {
          chunkLines.push(nTrimmed);
          nextIdx++;
        } else {
          break;
        }
      }

      if (chunkLines.length > 1 && chunkLines.some(isAccountingLine)) {
        var combinedCandidate = chunkLines.join('\n');
        var parsedCandidate = parseAndRenderAccountingLine(combinedCandidate);
        if (parsedCandidate) {
          outLines.push(storeBlock(parsedCandidate));
          i = nextIdx - 1;
          continue;
        }
      }
    }

    // التحقق من القيود المحاسبية البسيطة متعددة الأسطر (سطر من حـ/ يليه سطر إلى حـ/)
    var nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
    var thirdLine = (i + 2 < lines.length) ? lines[i + 2].trim() : '';

    var isDebitLine = /(?:من\s*حـ?\/|من\s*ح\/|من\s*مذكورين)/i.test(trimmed);
    var isCreditLine = /(?:إلى\s*حـ?\/|إلى\s*ح\/|الى\s*حـ?\/|الى\s*ح\/|إلى\s*مذكورين|الى\s*مذكورين)/i.test(nextLine);

    if (isDebitLine && isCreditLine && !/(?:إلى|الى)\s*حـ?\//i.test(trimmed)) {
      var combinedEntry = trimmed + '\n' + nextLine;
      if (/^\([^)]+\)\.?$/.test(thirdLine)) {
        combinedEntry += '\n' + thirdLine;
        i += 2;
      } else {
        i += 1;
      }
      var cardHtml = parseAndRenderAccountingLine(combinedEntry);
      if (cardHtml) {
        outLines.push(storeBlock(cardHtml));
        continue;
      }
    }

    // فحص القيد المحاسبي في سطر واحد
    var singleEntryHtml = parseAndRenderAccountingLine(trimmed);
    if (singleEntryHtml) {
      outLines.push(storeBlock(singleEntryHtml));
      continue;
    }

    outLines.push(line);
  }
  if (tableBuffer.length > 0) flushTable();

  text = outLines.join('\n');

  var parts = text.split(/(___BLOCK_\d+___)/);
  for (var p = 0; p < parts.length; p++) {
    var part = parts[p];
    var blockMatch = part.match(/^___BLOCK_(\d+)___$/);
    if (blockMatch) {
      parts[p] = blocks[parseInt(blockMatch[1], 10)];
    } else {
      var escaped = part
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      escaped = escaped.replace(/\n{2,}/g, '<br>').replace(/\n/g, '<br>');
      parts[p] = escaped;
    }
  }

  return parts.join('').replace(/^(?:<br>)+|(?:<br>)+$/g, '').trim();
}
window.formatQuestionContent = formatQuestionContent;

// نافذة تكبير الصورة (Lightbox)
var currentLightboxZoom = 1;

function openImageLightbox(src, caption) {
  if (!src) return;
  var ov = document.getElementById('image-lightbox-overlay');
  var img = document.getElementById('lightbox-img');
  var cap = document.getElementById('lightbox-caption');
  if (!ov || !img) return;
  img.src = src;
  if (cap) cap.textContent = caption || 'معاينة الصورة';
  currentLightboxZoom = 1;
  img.style.transform = 'scale(1)';
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
}
window.openImageLightbox = openImageLightbox;

function closeImageLightbox(e) {
  if (e && e.target && e.target.closest && e.target.closest('.image-lightbox-container') && !e.target.closest('.lightbox-close')) {
    return;
  }
  var ov = document.getElementById('image-lightbox-overlay');
  if (ov) ov.classList.remove('open');
  document.body.style.overflow = '';
}
window.closeImageLightbox = closeImageLightbox;

function zoomLightboxImage(factor) {
  var img = document.getElementById('lightbox-img');
  if (!img) return;
  currentLightboxZoom *= factor;
  if (currentLightboxZoom < 0.4) currentLightboxZoom = 0.4;
  if (currentLightboxZoom > 4) currentLightboxZoom = 4;
  img.style.transform = 'scale(' + currentLightboxZoom + ')';
}
window.zoomLightboxImage = zoomLightboxImage;

function resetLightboxZoom() {
  var img = document.getElementById('lightbox-img');
  if (!img) return;
  currentLightboxZoom = 1;
  img.style.transform = 'scale(1)';
}
window.resetLightboxZoom = resetLightboxZoom;

window.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeImageLightbox();
});

// أدوات تحرير نص السؤال (جداول وصور)
function buildEditorTextToolbar(targetId) {
  var tId = targetId || 'ed-text';
  return '<div class="ed-text-toolbar">' +
    '<div class="ed-toolbar-group">' +
      '<button type="button" class="ed-tb-btn" onclick="triggerImageUpload()"><i class="fas fa-file-image" style="color:#27ae60;"></i> رفع صورة من الجهاز</button>' +
      '<button type="button" class="ed-tb-btn" onclick="promptImageUrl()"><i class="fas fa-link" style="color:#2980b9;"></i> رابط صورة</button>' +
      '<div class="ed-dropdown-wrap">' +
        '<button type="button" class="ed-tb-btn ed-tb-btn-table" onclick="toggleAccountingDropdown(event)"><i class="fas fa-balance-scale" style="color:#059669;"></i> إدراج محاسبي <i class="fas fa-caret-down"></i></button>' +
        '<div class="ed-table-dropdown" id="ed-accounting-dropdown" style="display:none;">' +
          '<div class="ed-dropdown-item" onclick="insertAccountingStructureTemplate(\'' + tId + '\', \'simple\')"><i class="fas fa-balance-scale"></i> قيد محاسبي بسيط (طرف مدين ودائن)</div>' +
          '<div class="ed-dropdown-item" onclick="insertAccountingStructureTemplate(\'' + tId + '\', \'compound_debit\')"><i class="fas fa-layer-group"></i> قيد مركب (من مذكورين... إلى حـ/...)</div>' +
          '<div class="ed-dropdown-item" onclick="insertAccountingStructureTemplate(\'' + tId + '\', \'compound_credit\')"><i class="fas fa-layer-group"></i> قيد مركب (من حـ/... إلى مذكورين...)</div>' +
          '<div class="ed-dropdown-item" onclick="insertAccountingStructureTemplate(\'' + tId + '\', \'journal\')"><i class="fas fa-book"></i> جدول دفتر اليومية النموذجي (مع التاريخ ورقم القيد)</div>' +
          '<div class="ed-dropdown-item" onclick="insertAccountingStructureTemplate(\'' + tId + '\', \'ledger\')"><i class="fas fa-columns"></i> جدول دفتر الأستاذ العام (حساب T-Account كامل)</div>' +
          '<div class="ed-dropdown-item" onclick="insertAccountingStructureTemplate(\'' + tId + '\', \'balances\')"><i class="fas fa-list-alt"></i> ميزان المراجعة بالأرصدة</div>' +
        '</div>' +
      '</div>' +
      '<div class="ed-dropdown-wrap">' +
        '<button type="button" class="ed-tb-btn ed-tb-btn-table" onclick="toggleTableDropdown(event)"><i class="fas fa-table" style="color:#1d4ed8;"></i> إدراج جدول عام <i class="fas fa-caret-down"></i></button>' +
        '<div class="ed-table-dropdown" id="ed-table-dropdown" style="display:none;">' +
          '<div class="ed-dropdown-item" onclick="insertTableTemplate(\'accounting\')"><i class="fas fa-balance-scale"></i> جدول محاسبي مالي (مدين / دائن / بيان)</div>' +
          '<div class="ed-dropdown-item" onclick="insertTableTemplate(\'balances\')"><i class="fas fa-list-alt"></i> جدول أرصدة وحسابات (البيان / الرصيد)</div>' +
          '<div class="ed-dropdown-item" onclick="insertTableTemplate(\'statement\')"><i class="fas fa-file-invoice-dollar"></i> جدول قائمة مالية (3 أعمدة)</div>' +
          '<div class="ed-dropdown-item" onclick="insertTableTemplate(\'custom\')"><i class="fas fa-th"></i> جدول مخصص (تحديد الأعمدة والصفوف)</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<input type="file" id="ed-img-file-input" accept="image/*" style="display:none" onchange="handleImageUpload(event)">' +
  '</div>';
}

function triggerImageUpload() {
  var inp = document.getElementById('ed-img-file-input');
  if (inp) inp.click();
}
window.triggerImageUpload = triggerImageUpload;

function handleImageUpload(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('يرجى اختيار ملف صورة صالح (PNG, JPG, WebP)', 'err');
    return;
  }
  toast('جاري تجهيز وضغط الصورة...', 'warn');
  var reader = new FileReader();
  reader.onload = function(evt) {
    var img = new Image();
    img.onload = function() {
      var maxW = 920;
      var maxH = 920;
      var width = img.width;
      var height = img.height;
      if (width > maxW || height > maxH) {
        if (width / height > maxW / maxH) {
          height = Math.round((height * maxW) / width);
          width = maxW;
        } else {
          width = Math.round((width * maxH) / height);
          height = maxH;
        }
      }
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      var compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);

      var defaultCap = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'صورة توضيحية';
      var tag = '\n\n![صورة توضيحية: ' + defaultCap + '](' + compressedDataUrl + ')\n\n';
      insertTextAtCursor('ed-text', tag);
      toast('✅ تم إدراج الصورة بنجاح في نص السؤال!', 'ok');
      e.target.value = '';
    };
    img.onerror = function() {
      toast('فشل في معالجة الصورة', 'err');
    };
    img.src = evt.target.result;
  };
  reader.onerror = function() {
    toast('تعذر قراءة ملف الصورة', 'err');
  };
  reader.readAsDataURL(file);
}
window.handleImageUpload = handleImageUpload;

function promptImageUrl() {
  var url = prompt('أدخل رابط الصورة (URL) التي ترغب بإدراجها في نص السؤال:');
  if (!url || !url.trim()) return;
  url = url.trim();
  var desc = prompt('أدخل وصفاً مختصراً للصورة (مثال: شيك بنكي، كمبيالة، فاتورة):', 'صورة توضيحية') || 'صورة توضيحية';
  var tag = '\n\n![' + desc.trim() + '](' + url + ')\n\n';
  insertTextAtCursor('ed-text', tag);
  toast('تم إدراج رابط الصورة في نص السؤال', 'ok');
}
window.promptImageUrl = promptImageUrl;

function toggleTableDropdown(e) {
  if (e) e.stopPropagation();
  closeAccountingDropdown();
  var dd = document.getElementById('ed-table-dropdown');
  if (!dd) return;
  dd.style.display = (dd.style.display === 'none' || !dd.style.display) ? 'block' : 'none';
}
window.toggleTableDropdown = toggleTableDropdown;

function closeTableDropdown() {
  var dd = document.getElementById('ed-table-dropdown');
  if (dd) dd.style.display = 'none';
}

function toggleAccountingDropdown(e) {
  if (e) e.stopPropagation();
  closeTableDropdown();
  var dd = document.getElementById('ed-accounting-dropdown');
  if (!dd) return;
  dd.style.display = (dd.style.display === 'none' || !dd.style.display) ? 'block' : 'none';
}
window.toggleAccountingDropdown = toggleAccountingDropdown;

function closeAccountingDropdown() {
  var dd = document.getElementById('ed-accounting-dropdown');
  if (dd) dd.style.display = 'none';
}

document.addEventListener('click', function() {
  closeTableDropdown();
  closeAccountingDropdown();
});

function insertAccountingStructureTemplate(targetId, type) {
  closeAccountingDropdown();
  var targetElId = targetId || 'ed-text';
  var tpl = '';
  if (type === 'simple') {
    tpl = '\n\n1000 من حـ/ الصندوق\n1000 إلى حـ/ المبيعات\n(إثبات مبيعات نقدية)\n\n';
  } else if (type === 'compound_debit') {
    tpl = '\n\nمن مذكورين:\n1200 حـ/ الصندوق\n800 حـ/ البنك\n2000 إلى حـ/ رأس المال\n(سداد حصة رأس المال)\n\n';
  } else if (type === 'compound_credit') {
    tpl = '\n\n5000 من حـ/ المشتريات\nإلى مذكورين:\n3000 حـ/ الصندوق\n2000 حـ/ الموردون\n(شراء بضاعة جزء منها نقداً والباقي على الحساب)\n\n';
  } else if (type === 'journal') {
    tpl = '\n\n| مدين | دائن | البيان | رقم القيد | التاريخ |\n|---|---|---|---|---|\n| 15000 | - | من حـ/ البنك | 1 | 2026/1/5م |\n| - | 15000 | إلى حـ/ رأس المال | 1 | 2026/1/5م |\n| (إيداع رأس المال في البنك) | | | | |\n| 15000 | 15000 | المجموع | | |\n\n';
  } else if (type === 'ledger') {
    tpl = '\n\n[دفتر الأستاذ: حـ/ الصندوق]\n| منه (مدين) | البيان | رقم القيد | التاريخ | له (دائن) | البيان | رقم القيد | التاريخ |\n|---|---|---|---|---|---|---|---|\n| 10000 | إلى حـ/ رأس المال | 1 | 2026/1/1م | 2000 | من حـ/ الإيجار | 2 | 2026/1/3م |\n| 5000 | إلى حـ/ المبيعات | 3 | 2026/1/10م | 3000 | من حـ/ المشتريات | 4 | 2026/1/15م |\n| - | - | - | - | 10000 | رصيد مدين مرحل | - | 2026/1/31م |\n| 15000 | المجموع | | | 15000 | المجموع | | |\n| 10000 | رصيد مدين منقول | - | 2026/2/1م | - | - | - | - |\n\n';
  } else if (type === 'balances') {
    tpl = '\n\n| أرصدة مدينة | أرصدة دائنة | اسم الحساب |\n|---|---|---|\n| 8000 | - | حـ/ الصندوق |\n| 12000 | - | حـ/ البنك |\n| - | 20000 | حـ/ رأس المال |\n| 20000 | 20000 | المجموع |\n\n';
  }

  insertTextAtCursor(targetElId, tpl);
  var targetEl = document.getElementById(targetElId);
  if (targetEl && targetEl.oninput) targetEl.oninput();
  toast('✅ تم إدراج القالب المحاسبي النموذجي بنجاح!', 'ok');
}
window.insertAccountingStructureTemplate = insertAccountingStructureTemplate;

function insertTableTemplate(type) {
  var tpl = '';
  if (type === 'accounting') {
    tpl = '\n\n| البيان | مدين (دينار) | دائن (دينار) |\n|---|---|---|\n| حـ/ الصندوق | 1,000 | - |\n| حـ/ المبيعات | - | 1,000 |\n\n';
  } else if (type === 'balances') {
    tpl = '\n\n| اسم الحساب | الرصيد (دينار) |\n|---|---|\n| الصندوق | 3,500 |\n| البنك | 12,000 |\n| أوراق القبض | 2,500 |\n\n';
  } else if (type === 'statement') {
    tpl = '\n\n| البيان | جزئي (دينار) | كلي (دينار) |\n|---|---|---|\n| إيراد المبيعات | - | 30,000 |\n| يُطرح: تكلفة المبيعات | 18,000 | - |\n| مجمل الربح | - | 12,000 |\n\n';
  } else if (type === 'custom') {
    var cols = parseInt(prompt('أدخل عدد الأعمدة المطلوبة في الجدول (مثال: 3):', '3'), 10);
    var rows = parseInt(prompt('أدخل عدد الصفوف (بدون صف العنوان، مثال: 2):', '2'), 10);
    if (isNaN(cols) || cols < 1 || cols > 10) cols = 3;
    if (isNaN(rows) || rows < 1 || rows > 20) rows = 2;
    var headerCells = [];
    var dividerCells = [];
    for (var c = 1; c <= cols; c++) {
      headerCells.push('العمود ' + c);
      dividerCells.push('---');
    }
    tpl = '\n\n| ' + headerCells.join(' | ') + ' |\n| ' + dividerCells.join(' | ') + ' |\n';
    for (var r = 1; r <= rows; r++) {
      var rowCells = [];
      for (var c = 1; c <= cols; c++) {
        rowCells.push('بيان ' + r + '-' + c);
      }
      tpl += '| ' + rowCells.join(' | ') + ' |\n';
    }
    tpl += '\n';
  }
  closeTableDropdown();
  insertTextAtCursor('ed-text', tpl);
  toast('تم إدراج قالب الجدول في نص السؤال', 'ok');
}
window.insertTableTemplate = insertTableTemplate;

function insertTextAtCursor(elementId, textToInsert) {
  var el = document.getElementById(elementId);
  if (!el) return;
  var start = el.selectionStart || 0;
  var end = el.selectionEnd || 0;
  var val = el.value;
  el.value = val.substring(0, start) + textToInsert + val.substring(end);
  el.selectionStart = el.selectionEnd = start + textToInsert.length;
  el.focus();
  updateEditorTextPreview();
}

function toggleEditorTextPreview() {
  var previewBox = document.getElementById('ed-text-preview');
  var btn = document.getElementById('btn-toggle-qpreview');
  if (!previewBox) return;
  if (previewBox.style.display === 'none' || !previewBox.style.display) {
    previewBox.style.display = 'block';
    if (btn) {
      btn.innerHTML = '<i class="fas fa-eye-slash"></i> إخفاء المعاينة';
      btn.classList.add('active');
    }
    updateEditorTextPreview();
  } else {
    previewBox.style.display = 'none';
    if (btn) {
      btn.innerHTML = '<i class="fas fa-eye"></i> معاينة السؤال';
      btn.classList.remove('active');
    }
  }
}
window.toggleEditorTextPreview = toggleEditorTextPreview;

function updateEditorTextPreview() {
  var previewBox = document.getElementById('ed-text-preview');
  var textEl = document.getElementById('ed-text');
  if (!previewBox || !textEl) return;
  var rawText = textEl.value;
  if (!rawText.trim()) {
    previewBox.innerHTML = '<div style="color:#94a3b8;font-size:12px;font-style:italic;text-align:center;padding:8px;">اكتب نص السؤال أو أدرج جدولاً أو صورة لمعاينتها هنا مباشرة...</div>';
    return;
  }
  previewBox.innerHTML = '<div class="ed-preview-label"><i class="fas fa-desktop"></i> معاينة السؤال كما سيظهر للطلبة:</div>' +
    '<div class="qtext" style="margin-bottom:0;">' + formatQuestionContent(rawText) + '</div>';
}

function bindEditorLivePreview() {
  var textEl = document.getElementById('ed-text');
  if (textEl) {
    textEl.addEventListener('input', function() {
      var pb = document.getElementById('ed-text-preview');
      if (pb && pb.style.display !== 'none') {
        updateEditorTextPreview();
      }
    });
  }
}

// فتح نافذة "إضافة سؤال جديد" مع تحديد بنك الوحدة والوزاري أو بنك الدرس
function openAddQuestion(lessonName, defaultCategory){
  if (!editorMode) return;
  var ctx = findLessonContext(lessonName);
  if (!ctx){ toast('لم يتم العثور على الدرس في المنهج', 'err'); return; }
  editorAddContext = ctx;

  var activeCat = defaultCategory || (currentQuizCategory || 'unit_ministerial');

  var body =
    '<div class="ed-field">' +
      '<div class="ed-ctx-info">' +
        '<span class="ed-ctx-tag"><i class="fas fa-layer-group"></i> الفصل ' + ctx.sem + '</span>' +
        '<span class="ed-ctx-tag"><i class="fas fa-cube"></i> وحدة ' + ctx.unitId + ': ' + ctx.unitName + '</span>' +
        '<span class="ed-ctx-tag"><i class="fas fa-book"></i> ' + ctx.lesson + '</span>' +
      '</div>' +
      '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 12px;margin-top:8px;">' +
        '<label style="display:block;font-size:12px;font-weight:800;color:#166534;margin-bottom:6px;"><i class="fas fa-database"></i> تخصيص إضافة السؤال لأي بنك ترغب:</label>' +
        '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;font-weight:700;">' +
          '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="ed-add-category" value="unit_ministerial" ' + (activeCat === 'unit_ministerial' ? 'checked' : '') + '> <span>بنك اختبار الوحدة والنماذج الوزارية فقط</span></label>' +
          '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="ed-add-category" value="lesson" ' + (activeCat === 'lesson' ? 'checked' : '') + '> <span>بنك اختبار حسب الدرس فقط</span></label>' +
          '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;"><input type="radio" name="ed-add-category" value="both"> <span>كلا البنكين معاً</span></label>' +
        '</div>' +
        '<p style="margin:4px 0 0;font-size:11px;color:#15803d;"><i class="fas fa-shield-alt"></i> التعديل أو الإضافة على بنك الوحدة والنماذج الوزارية لا يؤثر إطلاقاً على أسئلة اختبار الدرس، ويُحفظ في Firebase فوراً.</p>' +
      '</div>' +
    '</div>' +
    '<div class="ed-field">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
        '<label class="ed-label" style="margin-bottom:0;"><i class="fas fa-question-circle"></i> نص السؤال (يدعم الجداول والصور)</label>' +
        '<button type="button" class="ed-tb-preview-btn" onclick="toggleEditorTextPreview()" id="btn-toggle-qpreview"><i class="fas fa-eye"></i> معاينة السؤال</button>' +
      '</div>' +
      buildEditorTextToolbar() +
      '<textarea id="ed-text" class="ed-textarea ed-textarea-with-toolbar" rows="3" placeholder="اكتب نص السؤال هنا... يمكنك إدراج جداول وصور عبر شريط الأدوات أعلاه"></textarea>' +
      '<div id="ed-text-preview" class="ed-text-preview-box" style="display:none;"></div>' +
    '</div>' +
    '<div class="ed-field">' +
      '<label class="ed-label">الخيارات (حدد الإجابة الصحيحة)</label>' +
      '<div class="ed-opt-accounting-bar">' +
        '<div class="ed-opt-accounting-hint"><i class="fas fa-keyboard"></i> يمكنك النقر على <strong>Enter</strong> للنزول سطراً، أو استخدام القوالب المحاسبية الجاهزة للخيارات:</div>' +
        '<div class="ed-opt-accounting-btns">' +
          '<button type="button" class="ed-tag-accounting" onclick="insertAccountingOptionTemplate(\'simple\')"><i class="fas fa-balance-scale"></i> قيد بسيط</button>' +
          '<button type="button" class="ed-tag-accounting" onclick="insertAccountingOptionTemplate(\'compound_debit\')"><i class="fas fa-layer-group"></i> مركب (من مذكورين)</button>' +
          '<button type="button" class="ed-tag-accounting" onclick="insertAccountingOptionTemplate(\'compound_credit\')"><i class="fas fa-layer-group"></i> مركب (إلى مذكورين)</button>' +
          '<button type="button" class="ed-tag-accounting" onclick="insertAccountingOptionTemplate(\'journal\')"><i class="fas fa-book"></i> دفتر اليومية</button>' +
          '<button type="button" class="ed-tag-accounting" onclick="insertAccountingOptionTemplate(\'ledger\')"><i class="fas fa-columns"></i> دفتر الأستاذ (T)</button>' +
          '<button type="button" class="ed-tb-preview-btn" onclick="toggleEditorOptionsPreview()" id="btn-toggle-opts-preview" style="padding:4px 10px;font-size:12px;"><i class="fas fa-eye"></i> معاينة الخيارات</button>' +
        '</div>' +
      '</div>' +
      '<div id="ed-opts-preview" class="ed-opts-preview-box" style="display:none;margin-bottom:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px;"></div>' +
      '<div class="ed-opts">';
  for (var j = 0; j < 4; j++){
    body += '<div class="ed-opt-row">' +
      '<label class="ed-opt-radio"><input type="radio" name="ed-answer" value="' + j + '" ' + (j === 0 ? 'checked' : '') + '> <span class="ed-opt-lbl">' + LBL[j] + '</span></label>' +
      '<textarea class="ed-opt-input ed-opt-textarea" id="ed-opt-' + j + '" rows="2" placeholder="الخيار ' + LBL[j] + ' — اضغط Enter للنزول سطراً أو انقر قالب قيد محاسبي"></textarea>' +
      '</div>';
  }
  body += '</div></div>' +
    '<div class="ed-field">' +
      '<label class="ed-label"><i class="fas fa-lightbulb" style="color:var(--gold);"></i> التلميح (من كتاب الطالب - اختياري)</label>' +
      '<textarea id="ed-hint" class="ed-textarea" rows="2" placeholder="اكتب تلميحاً مستخرجاً من كتاب الطالب لمساعدة الطلبة..."></textarea>' +
    '</div>' +
    '<div class="ed-actions">' +
      '<button class="ed-btn ed-btn-save" onclick="saveAddQuestion()">➕ إضافة السؤال</button>' +
      '<button class="ed-btn ed-btn-cancel" onclick="closeEditorEdit()">إلغاء</button>' +
    '</div>' +
    '<p class="ed-note" style="color:#0f5132;background:#e8f5e9;border:1px solid #c8e6c9;padding:8px 12px;border-radius:8px;font-size:12px;margin-top:12px;"><i class="fas fa-cloud-upload-alt" style="color:#2e7d32"></i> <strong>المزامنة السحابية:</strong> سيُحفظ السؤال في قاعدة بيانات Firebase Firestore السحابية في المجموعة المحددة ويتاح فوراً في البرنامج.</p>';

  var bodyEl = document.getElementById('editor-edit-body');
  if (bodyEl) bodyEl.innerHTML = body;

  bindEditorLivePreview();

  var titleEl = document.querySelector('#editor-edit-overlay .editor-modal-title');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-plus-circle"></i> إضافة سؤال جديد';

  var ov = document.getElementById('editor-edit-overlay');
  if (ov) ov.classList.add('open');

  setTimeout(function(){
    var t = document.getElementById('ed-text');
    if (t) t.focus();
  }, 150);
}

function saveAddQuestion(){
  if (!editorAddContext){ toast('خطأ: لا يوجد سياق للإضافة', 'err'); return; }
  var ctx = editorAddContext;

  var catRadio = document.querySelector('input[name="ed-add-category"]:checked');
  var targetCategory = catRadio ? catRadio.value : (currentQuizCategory || 'unit_ministerial');

  var textEl = document.getElementById('ed-text');
  var hintEl = document.getElementById('ed-hint');
  var newText = textEl ? textEl.value.trim() : '';
  if (!newText){ toast('نص السؤال لا يمكن أن يكون فارغاً', 'err'); textEl.focus(); return; }
  var newHint = hintEl ? hintEl.value.trim() : '';

  var newOpts = [];
  for (var j = 0; j < 4; j++){
    var el = document.getElementById('ed-opt-' + j);
    newOpts.push(el ? el.value.trim() : '');
  }
  for (var k = 0; k < newOpts.length; k++){
    if (!newOpts[k]){
      toast('الخيار ' + LBL[k] + ' لا يمكن أن يكون فارغاً', 'err');
      var emptyEl = document.getElementById('ed-opt-' + k);
      if (emptyEl) emptyEl.focus();
      return;
    }
  }

  var radio = document.querySelector('input[name="ed-answer"]:checked');
  var newAnswer = radio ? parseInt(radio.value, 10) : 0;
  if (isNaN(newAnswer) || newAnswer < 0 || newAnswer >= newOpts.length) newAnswer = 0;

  // توليد ID جديد
  var maxId = 0;
  var allArrays = [bank, lessonBank, unitMinisterialBank];
  allArrays.forEach(function(arr){
    if (Array.isArray(arr)) {
      for (var i = 0; i < arr.length; i++){ if (arr[i] && arr[i].id > maxId) maxId = arr[i].id; }
    }
  });
  var newId = maxId + 1;

  var newQ = {
    id: newId,
    sem: ctx.sem,
    unit: ctx.unitId,
    unitName: ctx.unitName,
    lesson: ctx.lesson,
    hint: newHint,
    text: newText,
    options: newOpts,
    answer: newAnswer,
    _examKey: ''
  };

  // إضافة السؤال للبنوك المطلوبة
  if (targetCategory === 'both' || targetCategory === 'unit_ministerial') {
    unitMinisterialBank.push(cloneQuestion(newQ));
    unitBankIndexById = buildIndexedMap(unitMinisterialBank);
    var uRaw = localStorage.getItem('qbank_unit_ministerial_additions');
    var uAdditions = uRaw ? JSON.parse(uRaw) : [];
    if (!Array.isArray(uAdditions)) uAdditions = [];
    uAdditions.push(cloneQuestion(newQ));
    localStorage.setItem('qbank_unit_ministerial_additions', JSON.stringify(uAdditions));
  }

  if (targetCategory === 'both' || targetCategory === 'lesson') {
    lessonBank.push(cloneQuestion(newQ));
    lessonBankIndexById = buildIndexedMap(lessonBank);
    var lRaw = localStorage.getItem('qbank_lesson_additions');
    var lAdditions = lRaw ? JSON.parse(lRaw) : [];
    if (!Array.isArray(lAdditions)) lAdditions = [];
    lAdditions.push(cloneQuestion(newQ));
    localStorage.setItem('qbank_lesson_additions', JSON.stringify(lAdditions));
  }

  if (!bank.some(function(item){ return item.id === newQ.id; })) {
    bank.push(cloneQuestion(newQ));
  }

  bankIndexById = (currentQuizCategory === 'unit_ministerial') ? unitBankIndexById : lessonBankIndexById;

  // مزامنة سحابية مع Firebase Firestore
  syncAddQuestionToCloud(newQ, targetCategory);

  closeEditorEdit();
  editorAddContext = null;

  var catMsg = (targetCategory === 'both') ? 'كلا القسمين' : (targetCategory === 'unit_ministerial' ? 'أسئلة الوحدة والنماذج الوزارية' : 'أسئلة الدرس');
  toast('✅ تمت إضافة السؤال (#' + newId + ') في ' + catMsg + ' وتحديث السحابة بنجاح', 'ok');

  refreshCurrentPage();
  if (typeof renderBankManagerContent === 'function') {
    renderBankManagerContent();
  }
}

// تفعيل/إيقاف وضع المحرر
// تفعيل وضع المشرف السري بالنقر 5 مرات على اسم المشرف
var _adminClickCount = 0;
var _adminClickTimer = null;
function onAdminSecretClick(){
  _adminClickCount++;
  clearTimeout(_adminClickTimer);
  _adminClickTimer = setTimeout(function(){ _adminClickCount = 0; }, 3000);
  if (_adminClickCount >= 5){
    _adminClickCount = 0;
    var btn = document.getElementById('btn-editor');
    if (btn) btn.style.setProperty('display', 'inline-flex', 'important');
    openEditorPwd();
  }
}
window.onAdminSecretClick = onAdminSecretClick;

function toggleEditorMode(){
  if (editorMode){
    if (window.confirm('هل تريد الخروج من وضع المحرر والعودة إلى واجهة الطالب؟')) {
      editorMode = false;
      localStorage.removeItem('qbank_editor_active');
      document.body.classList.remove('editor-on');
      updateEditorBtnUI();
      toast('🔒 تم الخروج من وضع المحرر والعودة لواجهة الطالب', 'warn');
      refreshCurrentPage();
    }
  } else {
    // فتح نافذة كلمة المرور
    openEditorPwd();
  }
}

function updateEditorBtnUI(){
  var btn = document.getElementById('btn-editor');
  var btnStudents = document.getElementById('btn-teacher-students');

  if (editorMode){
    document.body.classList.add('editor-on');
    if (btn) {
      btn.style.setProperty('display', 'inline-flex', 'important');
      btn.classList.add('active');
      btn.innerHTML = '<i class="fas fa-unlock"></i> <span id="btn-editor-text">لوحة المعلم (نشطة)</span>';
      btn.title = 'انقر للخروج من وضع المحرر والعودة لواجهة الطالب';
    }
    if (btnStudents) {
      btnStudents.style.setProperty('display', 'inline-flex', 'important');
    }
  } else {
    document.body.classList.remove('editor-on');
    if (btn) {
      btn.style.setProperty('display', 'inline-flex', 'important');
      btn.classList.remove('active');
      btn.innerHTML = '<i class="fas fa-lock"></i> <span id="btn-editor-text">وضع المحرر</span>';
      btn.title = 'دخول لوحة تحكم المعلم (يتطلب كلمة المرور)';
    }
    if (btnStudents) {
      btnStudents.style.setProperty('display', 'none', 'important');
    }
  }
}

// نافذة عرض سجل الطلاب للمشرف
function openTeacherStudentsModal() {
  if (!editorMode) return;
  var ov = document.getElementById('teacher-students-overlay');
  if (ov) {
    ov.classList.add('open');
    loadTeacherStudentsData();
  }
}
window.openTeacherStudentsModal = openTeacherStudentsModal;

function closeTeacherStudentsModal(e) {
  if (e && e.target && e.target.id !== 'teacher-students-overlay') return;
  var ov = document.getElementById('teacher-students-overlay');
  if (ov) ov.classList.remove('open');
}
window.closeTeacherStudentsModal = closeTeacherStudentsModal;

async function loadTeacherStudentsData() {
  var content = document.getElementById('ts-content');
  var countStudents = document.getElementById('ts-students-count');
  var countAttempts = document.getElementById('ts-attempts-count');
  if (content) content.innerHTML = '<div style="text-align:center;padding:24px;color:#7f8c8d;"><i class="fas fa-spinner fa-spin"></i> جاري الاتصال بقاعدة بيانات Firebase وجلب سجلات الطلاب...</div>';

  try {
    var res = await fetch('/api/teacher/students', {
      headers: { 'x-admin-key': EDITOR_PASSWORD }
    });
    var data = await res.json();

    if (!data.success) {
      if (content) content.innerHTML = '<div style="color:#e74c3c;padding:16px;text-align:center;">تعذر جلب البيانات: ' + (data.error || 'خطأ في الصلاحيات') + '</div>';
      return;
    }

    if (countStudents) countStudents.textContent = data.studentsCount || 0;
    if (countAttempts) countAttempts.textContent = data.attemptsCount || 0;

    var html = '';

    // جدول الطلاب المسجلين
    html += '<h4 style="font-size:13px;color:#1a3a5c;margin:8px 0 6px;display:flex;align-items:center;gap:6px;"><i class="fas fa-id-card"></i> قائمة الطلاب المسجلين (' + (data.students || []).length + ')</h4>';
    if (!data.students || data.students.length === 0) {
      html += '<div style="background:#f8f9fa;border-radius:8px;padding:12px;font-size:12px;color:#7f8c8d;text-align:center;">لا يوجد طلاب مسجلون حتى الآن</div>';
    } else {
      html += '<div style="max-height:160px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:14px;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;text-align:right;">' +
        '<thead style="background:#f1f5f9;color:#475569;"><tr><th style="padding:6px 10px;">الاسم</th><th style="padding:6px 10px;">إيميل Google</th><th style="padding:6px 10px;">المدرسة</th></tr></thead><tbody>';
      data.students.forEach(function(s){
        html += '<tr style="border-bottom:1px solid #edf2f7;"><td style="padding:6px 10px;font-weight:700;color:#1e293b;">' + escHtml(s.name) + '</td><td style="padding:6px 10px;color:#4b5563;">' + escHtml(s.email) + '</td><td style="padding:6px 10px;color:#6b7280;">' + escHtml(s.school || '—') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    // جدول نتائج ومحاولات الاختبارات الأخيرة
    html += '<h4 style="font-size:13px;color:#1a3a5c;margin:12px 0 6px;display:flex;align-items:center;gap:6px;"><i class="fas fa-clipboard-check"></i> نتائج المحاولات المسلمة (' + (data.attempts || []).length + ')</h4>';
    if (!data.attempts || data.attempts.length === 0) {
      html += '<div style="background:#f8f9fa;border-radius:8px;padding:12px;font-size:12px;color:#7f8c8d;text-align:center;">لم يتم تسليم أي اختبارات حتى الآن</div>';
    } else {
      html += '<div style="max-height:220px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;">' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;text-align:right;">' +
        '<thead style="background:#f1f5f9;color:#475569;"><tr><th style="padding:6px 10px;">الطالب</th><th style="padding:6px 10px;">الاختبار</th><th style="padding:6px 10px;">النتيجة</th><th style="padding:6px 10px;">النسبة</th><th style="padding:6px 10px;">التاريخ والوقت</th></tr></thead><tbody>';
      data.attempts.forEach(function(a){
        var pctCol = (a.percentage >= 80) ? '#27ae60' : (a.percentage >= 60 ? '#f39c12' : '#e74c3c');
        var dateStr = a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('ar-EG', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
        html += '<tr style="border-bottom:1px solid #edf2f7;"><td style="padding:6px 10px;font-weight:700;">' + escHtml(a.studentName) + '</td><td style="padding:6px 10px;color:#334155;">' + escHtml(a.quizTitle) + '</td><td style="padding:6px 10px;font-weight:700;">' + a.score + ' / ' + a.total + '</td><td style="padding:6px 10px;font-weight:800;color:'+pctCol+'">' + a.percentage + '%</td><td style="padding:6px 10px;color:#94a3b8;font-size:11px;">' + dateStr + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    if (content) content.innerHTML = html;
  } catch(e) {
    if (content) content.innerHTML = '<div style="color:#e74c3c;padding:16px;text-align:center;">حدث خطأ أثناء جلب السجلات: ' + e.message + '</div>';
  }
}
window.loadTeacherStudentsData = loadTeacherStudentsData;

// نافذة كلمة المرور
function openEditorPwd(){
  var ov = document.getElementById('editor-pwd-overlay');
  if (!ov) return;
  ov.classList.add('open');
  var inp = document.getElementById('editor-pwd-input');
  if (inp){ inp.value = ''; setTimeout(function(){ inp.focus(); }, 100); }
  var err = document.getElementById('editor-pwd-err');
  if (err) err.style.display = 'none';
}
function closeEditorPwd(){
  var ov = document.getElementById('editor-pwd-overlay');
  if (ov) ov.classList.remove('open');
}
function submitEditorPwd(){
  var inp = document.getElementById('editor-pwd-input');
  var err = document.getElementById('editor-pwd-err');
  if (!inp) return;
  var val = inp.value;
  if (val === EDITOR_PASSWORD){
    editorMode = true;
    localStorage.setItem('qbank_editor_active', '1');
    document.body.classList.add('editor-on');
    closeEditorPwd();
    updateEditorBtnUI();
    toast('مرحباً بك أستاذ حسين - تم الدخول إلى لوحة تحكم المعلم بنجاح!', 'ok');
    pageHistory = [];
    renderHome();
    showPage('home');
  } else {
    if (err){ err.style.display = 'block'; }
    inp.value = '';
    inp.focus();
  }
}

// نافذة تحرير السؤال مع عزل البنوك
var editorCurrentEditingCategory = 'unit_ministerial';

function openEditorEdit(questionId, explicitCategory){
  if (!editorMode) return;

  var targetCat = explicitCategory || currentQuizCategory || 'unit_ministerial';
  var targetBank = (targetCat === 'unit_ministerial') ? unitMinisterialBank : lessonBank;
  var q = targetBank.find(function(item){ return Number(item.id) === Number(questionId) || String(item.id) === String(questionId); });

  // فحص احتياطي إذا لم يكن موجوداً في البنك المستهدف
  if (!q) {
    if (targetCat === 'unit_ministerial') {
      q = lessonBank.find(function(item){ return Number(item.id) === Number(questionId) || String(item.id) === String(questionId); });
      if (q) targetCat = 'lesson';
    } else {
      q = unitMinisterialBank.find(function(item){ return Number(item.id) === Number(questionId) || String(item.id) === String(questionId); });
      if (q) targetCat = 'unit_ministerial';
    }
  }

  if (!q && Array.isArray(currentQuiz)){
    q = currentQuiz.find(function(item){ return Number(item.id) === Number(questionId) || String(item.id) === String(questionId); });
  }

  if (!q && Array.isArray(bank)){
    q = bank.find(function(item){ return Number(item.id) === Number(questionId) || String(item.id) === String(questionId); });
  }

  if (!q){ toast('السؤال غير موجود في البنك', 'err'); return; }

  // أسئلة التقويم والنماذج الوزارية والوحدات تتبع دائماً بنك الوحدة والوزاري والتقويم
  if (q._examKey || currentQuizCategory === 'unit_ministerial') {
    targetCat = 'unit_ministerial';
  }

  editorCurrentEditingCategory = targetCat;

  var catLabel = (targetCat === 'unit_ministerial') ? 'بنك اختبار حسب الوحدة والنماذج الوزارية والتقويم' : 'بنك اختبار حسب الدرس';

  // عدد الخيارات الحالي + ملاحظة إن كان أقل من 4
  var currentOptsCount = (q.options || []).length;
  var showAddHint = currentOptsCount < 4;

  var body =
    '<div class="ed-field">' +
      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 12px;margin-bottom:8px;">' +
        '<div style="font-size:12px;font-weight:800;color:#1e40af;display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
          '<span><i class="fas fa-layer-group"></i> البنك المستهدف: <strong>' + catLabel + '</strong></span>' +
          '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:6px;font-size:11px;">سؤال #' + q.id + '</span>' +
        '</div>' +
        '<div style="margin-top:6px;font-size:11px;font-weight:700;color:#334155;display:flex;gap:12px;flex-wrap:wrap;">' +
          '<label style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;"><input type="radio" name="ed-save-category" value="unit_ministerial" ' + (targetCat === 'unit_ministerial' ? 'checked' : '') + '> <span>حفظ في بنك الوحدة والوزاري والتقويم فقط</span></label>' +
          '<label style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;"><input type="radio" name="ed-save-category" value="lesson" ' + (targetCat === 'lesson' ? 'checked' : '') + '> <span>حفظ في بنك الدرس فقط</span></label>' +
          '<label style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;"><input type="radio" name="ed-save-category" value="both"> <span>حفظ في كلا البنكين</span></label>' +
        '</div>' +
        '<div style="font-size:11px;color:#059669;margin-top:4px;"><i class="fas fa-shield-alt"></i> لن تتأثر أسئلة القسم الآخر إطلاقاً بالتعديل ما لم تختر حفظها معاً.</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
        '<label class="ed-label" style="margin-bottom:0;"><i class="fas fa-question-circle"></i> نص السؤال (يدعم الجداول والصور)</label>' +
        '<button type="button" class="ed-tb-preview-btn" onclick="toggleEditorTextPreview()" id="btn-toggle-qpreview"><i class="fas fa-eye"></i> معاينة السؤال</button>' +
      '</div>' +
      buildEditorTextToolbar() +
      '<textarea id="ed-text" class="ed-textarea ed-textarea-with-toolbar" rows="3">' + escHtml(q.text) + '</textarea>' +
      '<div id="ed-text-preview" class="ed-text-preview-box" style="display:none;"></div>' +
    '</div>' +
    '<div class="ed-field">' +
      '<label class="ed-label">الخيارات (الإجابة الصحيحة محددة)</label>';
  if (showAddHint){
    body += '<p class="ed-add-hint"><i class="fas fa-lightbulb"></i> هذا السؤال يحتوي على ' + currentOptsCount + ' خيارات فقط — املأ الخيارات الفارغة لإكمالها إلى 4.</p>';
  }
  body += '<div class="ed-opt-accounting-bar">' +
    '<div class="ed-opt-accounting-hint"><i class="fas fa-keyboard"></i> يمكنك النقر على <strong>Enter</strong> للنزول سطراً، أو استخدام القوالب المحاسبية الجاهزة للخيارات:</div>' +
    '<div class="ed-opt-accounting-btns">' +
      '<button type="button" class="ed-tag-accounting" onclick="insertAccountingOptionTemplate(\'simple\')"><i class="fas fa-balance-scale"></i> قيد بسيط</button>' +
      '<button type="button" class="ed-tag-accounting" onclick="insertAccountingOptionTemplate(\'compound_debit\')"><i class="fas fa-layer-group"></i> مركب (من مذكورين)</button>' +
      '<button type="button" class="ed-tag-accounting" onclick="insertAccountingOptionTemplate(\'compound_credit\')"><i class="fas fa-layer-group"></i> مركب (إلى مذكورين)</button>' +
      '<button type="button" class="ed-tag-accounting" onclick="insertAccountingOptionTemplate(\'journal\')"><i class="fas fa-book"></i> دفتر اليومية</button>' +
      '<button type="button" class="ed-tag-accounting" onclick="insertAccountingOptionTemplate(\'ledger\')"><i class="fas fa-columns"></i> دفتر الأستاذ (T)</button>' +
      '<button type="button" class="ed-tb-preview-btn" onclick="toggleEditorOptionsPreview()" id="btn-toggle-opts-preview" style="padding:4px 10px;font-size:12px;"><i class="fas fa-eye"></i> معاينة الخيارات</button>' +
    '</div>' +
  '</div>';
  body += '<div id="ed-opts-preview" class="ed-opts-preview-box" style="display:none;margin-bottom:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px;"></div>';
  body += '<div class="ed-opts">';
  // عرض 4 حقول دائماً: الخيارات الموجودة + حقول فارغة للخيارات الناقصة
  for (var j = 0; j < 4; j++){
    var isAns = (j === q.answer);
    var optValue = (q.options && q.options[j] !== undefined) ? q.options[j] : '';
    body += '<div class="ed-opt-row' + (optValue === '' && j >= currentOptsCount ? ' ed-opt-empty' : '') + '">' +
      '<label class="ed-opt-radio"><input type="radio" name="ed-answer" value="' + j + '" ' + (isAns ? 'checked' : '') + '> <span class="ed-opt-lbl">' + LBL[j] + '</span></label>' +
      '<textarea class="ed-opt-input ed-opt-textarea" id="ed-opt-' + j + '" rows="2" placeholder="' + (optValue === '' ? 'خيار ' + LBL[j] + ' (فارغ) — اضغط Enter للنزول سطراً' : 'الخيار ' + LBL[j] + ' — اضغط Enter للنزول سطراً') + '">' + escHtml(optValue) + '</textarea>' +
      '</div>';
  }
  body += '</div></div>' +
    '<div class="ed-field">' +
      '<label class="ed-label">الدرس (اختياري)</label>' +
      '<input type="text" id="ed-lesson" class="ed-input" value="' + escHtml(q.lesson || '') + '">' +
    '</div>' +
    '<div class="ed-field ed-field-hint">' +
      '<label class="ed-label" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
        '<span><i class="fas fa-lightbulb" style="color:var(--gold);margin-left:4px;"></i> <strong>التلميح (من كتاب الطالب)</strong></span>' +
        '<span style="font-size:11px;font-weight:normal;color:var(--mu);">يظهر كدليل ومساعدة للطلبة</span>' +
      '</label>' +
      '<textarea id="ed-hint" class="ed-textarea" rows="3" placeholder="اكتب تلميحاً أو فقرة من كتاب الطالب لتوضيح السؤال للطلبة...">' + escHtml(q.hint || '') + '</textarea>' +
      '<div class="ed-hint-actions" style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">' +
        '<button type="button" class="ed-tag-btn" onclick="insertHintPrefix()"><i class="fas fa-book"></i> إضافة بادئة (من كتاب الطالب:)</button>' +
        '<button type="button" class="ed-tag-btn ed-tag-clear" onclick="clearHintField()"><i class="fas fa-times"></i> مسح التلميح</button>' +
      '</div>' +
    '</div>' +
    '<div class="ed-actions ed-actions-3">' +
      '<button class="ed-btn ed-btn-save" onclick="saveEditorEdit(' + questionId + ')">💾 حفظ التعديل</button>' +
      '<button class="ed-btn ed-btn-cancel" onclick="closeEditorEdit()">إلغاء</button>' +
      '<button class="ed-btn ed-btn-delete" onclick="deleteCurrentQuestion(' + questionId + ', \'' + targetCat + '\')"><i class="fas fa-trash"></i> حذف السؤال</button>' +
    '</div>' +
    '<p class="ed-note" style="color:#0f5132;background:#e8f5e9;border:1px solid #c8e6c9;padding:8px 12px;border-radius:8px;font-size:12px;margin-top:12px;"><i class="fas fa-cloud-upload-alt" style="color:#2e7d32"></i> <strong>المزامنة السحابية مفعّلة:</strong> عند الضغط على "حفظ التعديل"، سيتم تحديث هذا السؤال والتلميح في قاعدة بيانات Firebase Firestore السحابية فوراً وتطبيقه على البرنامج للجميع.</p>';

  var bodyEl = document.getElementById('editor-edit-body');
  if (bodyEl) bodyEl.innerHTML = body;

  bindEditorLivePreview();

  var titleEl = document.querySelector('#editor-edit-overlay .editor-modal-title');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-edit"></i> تحرير السؤال (رقم #' + q.id + ')';

  editorAddContext = null;

  var ov = document.getElementById('editor-edit-overlay');
  if (ov) ov.classList.add('open');
}

function closeEditorEdit(){
  var ov = document.getElementById('editor-edit-overlay');
  if (ov) ov.classList.remove('open');
  editorAddContext = null;
}

async function saveEditorEdit(questionId){
  var saveCatRadio = document.querySelector('input[name="ed-save-category"]:checked');
  var targetCategory = saveCatRadio ? saveCatRadio.value : (editorCurrentEditingCategory || 'unit_ministerial');

  var textEl = document.getElementById('ed-text');
  var lessonEl = document.getElementById('ed-lesson');
  var hintEl = document.getElementById('ed-hint');
  var newText = textEl ? textEl.value.trim() : '';
  if (!newText){ toast('نص السؤال لا يمكن أن يكون فارغاً', 'err'); textEl.focus(); return; }
  var newLesson = lessonEl ? lessonEl.value.trim() : '';
  var newHint = hintEl ? hintEl.value.trim() : '';

  var radio = document.querySelector('input[name="ed-answer"]:checked');
  var selectedAnswerIdx = radio ? parseInt(radio.value, 10) : 0;
  if (isNaN(selectedAnswerIdx) || selectedAnswerIdx < 0 || selectedAnswerIdx >= 4) selectedAnswerIdx = 0;

  var rawOpts = [];
  for (var j = 0; j < 4; j++){
    var el = document.getElementById('ed-opt-' + j);
    rawOpts.push(el ? el.value : '');
  }

  var correctText = rawOpts[selectedAnswerIdx];
  if (!correctText || !correctText.trim()){
    toast('الإجابة الصحيحة (الخيار ' + LBL[selectedAnswerIdx] + ') لا يمكن أن تكون فارغة', 'err');
    var correctEl = document.getElementById('ed-opt-' + selectedAnswerIdx);
    if (correctEl) correctEl.focus();
    return;
  }

  var newOpts = rawOpts.slice();
  while (newOpts.length > 2 && (!newOpts[newOpts.length - 1] || !newOpts[newOpts.length - 1].trim())){
    newOpts.pop();
  }

  var newAnswer = newOpts.indexOf(correctText);
  if (newAnswer === -1) newAnswer = 0;

  var patch = {
    text: newText,
    options: newOpts,
    answer: newAnswer,
    lesson: newLesson,
    hint: newHint,
    hintDeleted: (newHint === '')
  };

  // تطبيق التعديل بدقة على البنك/البنوك المستهدفة
  var syncPromises = [];
  if (targetCategory === 'both' || targetCategory === 'unit_ministerial') {
    var uIdx = unitMinisterialBank.findIndex(function(item){
      return Number(item.id) === Number(questionId) || String(item.id) === String(questionId);
    });
    if (uIdx !== -1) {
      Object.assign(unitMinisterialBank[uIdx], patch);
    }
    saveOverride(questionId, patch, 'unit_ministerial');
    updateLocalCloudCachePayload(questionId, patch, 'unit_ministerial');
    syncPromises.push(syncOverrideToCloud(questionId, patch, 'unit_ministerial'));
    unitBankIndexById = buildIndexedMap(unitMinisterialBank);
  }

  if (targetCategory === 'both' || targetCategory === 'lesson') {
    var lIdx = lessonBank.findIndex(function(item){
      return Number(item.id) === Number(questionId) || String(item.id) === String(questionId);
    });
    if (lIdx !== -1) {
      Object.assign(lessonBank[lIdx], patch);
    }
    saveOverride(questionId, patch, 'lesson');
    updateLocalCloudCachePayload(questionId, patch, 'lesson');
    syncPromises.push(syncOverrideToCloud(questionId, patch, 'lesson'));
    lessonBankIndexById = buildIndexedMap(lessonBank);
  }

  bankIndexById = (currentQuizCategory === 'unit_ministerial') ? unitBankIndexById : lessonBankIndexById;

  // تحديث bank الأساسي في الذاكرة لتطابق البنك النشط
  var curIdx = bank.findIndex(function(item){
    return Number(item.id) === Number(questionId) || String(item.id) === String(questionId);
  });
  if (curIdx !== -1) {
    if (targetCategory === 'both' ||
       (targetCategory === 'unit_ministerial' && currentQuizCategory === 'unit_ministerial') ||
       (targetCategory === 'lesson' && currentQuizCategory === 'lesson')) {
      Object.assign(bank[curIdx], patch);
    }
  }

  // تحديث السؤال في currentQuiz إذا كان مفتوحاً
  if (Array.isArray(currentQuiz)) {
    var inQuiz = currentQuiz.find(function(item){
      return Number(item.id) === Number(questionId) || String(item.id) === String(questionId);
    });
    if (inQuiz) {
      inQuiz.text = newText;
      inQuiz.lesson = newLesson;
      inQuiz.hint = newHint;
      inQuiz.options = newOpts.slice();
      inQuiz.answer = newAnswer;
      inQuiz._secureAnswer = newAnswer;
      if (typeof registerQuestionAnswer === 'function') {
        registerQuestionAnswer(inQuiz.id, newAnswer);
      }
    }
  }

  closeEditorEdit();
  var catTitle = (targetCategory === 'both') ? 'كلا البنكين' : (targetCategory === 'unit_ministerial' ? 'بنك اختبار الوحدة والوزاري والتقويم' : 'بنك اختبار الدرس');
  toast('✅ تم حفظ التعديل والتلميح في ' + catTitle + ' ومزامنته في Firebase بنجاح!', 'ok');

  refreshCurrentPage();
  if (typeof renderBankManagerContent === 'function') {
    renderBankManagerContent();
  }

  try {
    await Promise.all(syncPromises);
  } catch(e) {
    console.warn('[saveEditorEdit cloud sync error]', e);
  }
}

function insertHintPrefix(){
  var el = document.getElementById('ed-hint');
  if (!el) return;
  var val = el.value.trim();
  if (!val.startsWith('من كتاب الطالب:')){
    el.value = 'من كتاب الطالب: ' + val;
  }
  el.focus();
}
window.insertHintPrefix = insertHintPrefix;

function clearHintField(){
  var el = document.getElementById('ed-hint');
  if (!el) return;
  el.value = '';
  el.focus();
}
window.clearHintField = clearHintField;

// إعادة عرض الصفحة الحالية
function refreshCurrentPage(){
  if (currentPageId === 'quiz'){
    // إعادة عرض الاختبار مع الحفاظ على إجابات المستخدم
    var savedAnswers = userAnswers;
    renderQuiz();
    userAnswers = savedAnswers;
    // إعادة تطبيق الاختيارات السابقة بصرياً
    Object.keys(userAnswers).forEach(function(qi){
      var q = currentQuiz[parseInt(qi, 10)];
      if (!q) return;
      var vi = validInfo(q);
      var oi = userAnswers[qi];
      if (currentMode === 'train'){
        // إعادة عرض حالة التدريب
        for (var j = 0; j < vi.opts.length; j++){
          var el = document.getElementById('qopt-' + qi + '-' + j);
          if (!el) continue;
          el.classList.add('locked');
          if (j === vi.answerIdx) el.classList.add('correct');
          else if (j === oi && oi !== vi.answerIdx) el.classList.add('wrong');
        }
        var card = document.getElementById('qcard-' + qi);
        if (card) card.classList.add(oi === vi.answerIdx ? 'q-correct' : 'q-wrong');
        var fb = document.getElementById('qfb-' + qi);
        if (fb){
          fb.style.display = 'block';
          var ok = oi === vi.answerIdx;
          fb.className = 'qfb ' + (ok ? 'fb-ok' : 'fb-err');
          fb.innerHTML = ok ? '✅ إجابة صحيحة! أحسنت.' : '❌ خطأ — الصحيح: <strong>' + LBL[vi.answerIdx] + ' — ' + vi.opts[vi.answerIdx] + '</strong>';
        }
      } else {
        var sel = document.getElementById('qopt-' + qi + '-' + oi);
        if (sel) sel.className = 'qopt exam-sel';
      }
    });
    updProgress(Object.keys(userAnswers).length);
    updQNav();
  } else if (currentPageId === 'result' && currentMode === 'exam'){
    showResults();
  } else {
    // للصفحات الأخرى، إعادة عرضها
    switch (currentPageId){
      case 'home': renderHome(); break;
      case 'lessons': renderLessonPage(); break;
      case 'units': renderUnitPage(); break;
      case 'ministerial': renderMinisterialPage(); break;
      case 'exams': renderExamPage(); break;
      case 'aqyem': renderAqyemHub(); break;
      case 'aqyem-questions': renderAqyemQuestionsPage(); break;
    }
  }
}

// تصدير البنك المُعدَّل كملف JavaScript جديد
function exportBank(){
  var content = 'var bank = ' + JSON.stringify(bank, null, 2) + ';\n';
  var blob = new Blob([content], { type: 'application/javascript' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'questions.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  toast('📦 تم تنزيل questions.js المُعدَّل', 'ok');
}

function escHtml(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatOptionDisplay(s){
  if (s == null) return '';
  var cleaned = String(s)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (!cleaned) return '';

  var isAccounting = /(?:من\s*حـ?\/|من\s*ح\/|من\s*مذكورين|إلى\s*حـ?\/|إلى\s*ح\/|الى\s*حـ?\/|الى\s*ح\/|إلى\s*مذكورين|الى\s*مذكورين)/i.test(cleaned);
  var isTable = cleaned.includes('|') && cleaned.split('\n').some(function(l){ return l.trim().startsWith('|'); });
  var isLedger = /(?:دفتر\s*الأستاذ|T-Account|حساب\s*الأستاذ|الجانب\s*المدين|الجانب\s*الدائن)/i.test(cleaned);
  var isJournal = /(?:دفتر\s*اليومية)/i.test(cleaned);
  var hasHtmlTags = /<(?:div|table|span|p|b|i|strong|em)\b[^>]*>/i.test(cleaned);

  if (isAccounting || isTable || isLedger || isJournal || hasHtmlTags) {
    try {
      var formatted = formatQuestionContent(cleaned);
      if (formatted && formatted.trim()) {
        return formatted;
      }
    } catch(e) {
      console.warn('formatOptionDisplay error:', e);
    }
  }

  // إذا كان النص متعدد الأسطر
  if (cleaned.includes('\n')) {
    return escHtml(cleaned).replace(/\n/g, '<br>');
  }

  return escHtml(cleaned);
}
window.formatOptionDisplay = formatOptionDisplay;

function insertAccountingOptionTemplate(type, targetIdx){
  var activeEl = document.activeElement;
  var target = null;
  if (activeEl && activeEl.classList && (activeEl.classList.contains('ed-opt-textarea') || activeEl.id.startsWith('aqyem-ed-opt-'))){
    target = activeEl;
  } else if (typeof targetIdx === 'number'){
    target = document.getElementById('ed-opt-' + targetIdx) || document.getElementById('aqyem-ed-opt-' + targetIdx);
  } else {
    for (var j = 0; j < 4; j++){
      var el = document.getElementById('ed-opt-' + j) || document.getElementById('aqyem-ed-opt-' + j);
      if (el && !el.value.trim()){ target = el; break; }
    }
    if (!target) target = document.getElementById('ed-opt-0') || document.getElementById('aqyem-ed-opt-0');
  }
  if (!target) return;

  var tpl = 'من حـ/ \nإلى حـ/ ';
  if (type === 'simple') {
    tpl = '1000 من حـ/ الصندوق\n1000 إلى حـ/ المبيعات';
  } else if (type === 'compound_debit') {
    tpl = 'من مذكورين:\n1200 حـ/ الصندوق\n800 حـ/ البنك\n2000 إلى حـ/ رأس المال';
  } else if (type === 'compound_credit') {
    tpl = '5000 من حـ/ المشتريات\nإلى مذكورين:\n3000 حـ/ الصندوق\n2000 حـ/ الموردون';
  } else if (type === 'journal') {
    tpl = '| مدين | دائن | البيان |\n|---|---|---|\n| 1000 | - | من حـ/ الصندوق |\n| - | 1000 | إلى حـ/ المبيعات |';
  } else if (type === 'ledger') {
    tpl = '[دفتر الأستاذ: حـ/ الصندوق]\n| منه (مدين) | البيان | له (دائن) | البيان |\n|---|---|---|---|\n| 5000 | إلى حـ/ المبيعات | 2000 | من حـ/ الإيجار |';
  }

  if (!target.value.trim()){
    target.value = tpl;
  } else {
    var start = target.selectionStart || target.value.length;
    var end = target.selectionEnd || target.value.length;
    target.value = target.value.substring(0, start) + (start > 0 && !target.value.endsWith('\n') ? '\n' : '') + tpl + target.value.substring(end);
  }
  target.focus();
  toast('تم إدراج القالب المحاسبي في الخيار — يمكنك تعديل الحسابات والأرقام', 'ok');
  updateEditorOptionsPreview();
  updateAqyemOptsPreview();
}
window.insertAccountingOptionTemplate = insertAccountingOptionTemplate;

function insertAccountingTemplate(targetIdx){
  insertAccountingOptionTemplate('simple', targetIdx);
}
window.insertAccountingTemplate = insertAccountingTemplate;

function toggleEditorOptionsPreview() {
  var pBox = document.getElementById('ed-opts-preview');
  var btn = document.getElementById('btn-toggle-opts-preview');
  if (!pBox) return;
  var isHidden = pBox.style.display === 'none' || !pBox.style.display;
  pBox.style.display = isHidden ? 'block' : 'none';
  if (btn) {
    btn.innerHTML = isHidden ? '<i class="fas fa-eye-slash"></i> إخفاء معاينة الخيارات' : '<i class="fas fa-eye"></i> معاينة الخيارات';
  }
  if (isHidden) {
    updateEditorOptionsPreview();
  }
}
window.toggleEditorOptionsPreview = toggleEditorOptionsPreview;

function updateEditorOptionsPreview() {
  var pBox = document.getElementById('ed-opts-preview');
  if (!pBox || pBox.style.display === 'none') return;
  var html = '<div style="font-size:12px;font-weight:800;color:#334155;margin-bottom:8px;"><i class="fas fa-magic" style="color:#0284c7;"></i> معاينة حية لشكل الخيارات والقيود والدفاتر كما ستظهر للطلبة:</div>';
  html += '<div class="ed-opts-preview-grid" style="display:flex;flex-direction:column;gap:8px;">';
  for (var i = 0; i < 4; i++) {
    var optEl = document.getElementById('ed-opt-' + i);
    var val = optEl ? optEl.value.trim() : '';
    html += '<div style="display:flex;align-items:flex-start;gap:8px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;">' +
      '<span style="font-weight:900;color:var(--pr);font-size:13px;min-width:20px;padding-top:4px;">' + LBL[i] + '</span>' +
      '<div style="flex:1;">' + (val ? formatOptionDisplay(val) : '<span style="color:#94a3b8;font-style:italic;">(خيار فارغ)</span>') + '</div>' +
    '</div>';
  }
  html += '</div>';
  pBox.innerHTML = html;
}
window.updateEditorOptionsPreview = updateEditorOptionsPreview;

// ══════════════════════════════════════════════
//  توليد النماذج الثابتة
// ══════════════════════════════════════════════

// نماذج الوحدات: كل نموذج 20 سؤال بالترتيب
// الأسئلة الزائدة (أقل من 10) تُلحق بالنموذج الأخير بدلاً من إهمالها
function getUnitModels(unitId) {
  var targetBank = (unitMinisterialBank && unitMinisterialBank.length) ? unitMinisterialBank : bank;
  var qs = targetBank.filter(function(q){ return q.unit === unitId && !q._examKey; });
  var models = [];
  var i = 0;
  // إنشاء نماذج كاملة بحجم 20
  for (i = 0; i + 20 <= qs.length; i += 20) {
    models.push(qs.slice(i, i + 20));
  }
  // معالجة الأسئلة المتبقية
  var leftover = qs.slice(i);
  if (leftover.length > 0) {
    if (models.length === 0) {
      // لا توجد نماذج كاملة، أضف الجزء المتبقي كنموذج (حتى لو صغير)
      models.push(leftover);
    } else if (leftover.length >= 10) {
      // كافٍ لنموذج جديد
      models.push(leftover);
    } else {
      // إلحاق بالنموذج الأخير (حتى يظهر السؤال الجديد فوراً)
      models[models.length - 1] = models[models.length - 1].concat(leftover);
    }
  }
  return models;
}

// ══════════════════════════════════════════════
//  جدول مواصفات مبحث الثقافة المالية - الثانوية العامة
//  (50 سؤالاً موزعة وفق الأوزان النسبية والمستويات المعرفية)
// ══════════════════════════════════════════════
var SPEC_TABLE = {
  title: 'جدول مواصفات مبحث الثقافة المالية - شهادة الثانوية العامة (التوجيهي)',
  totalQuestions: 50,
  totalMarks: 200,
  markPerQuestion: 4,
  durationMinutes: 120,
  semesters: [
    {
      sem: 1,
      name: 'الفصل الدراسي الأول',
      weightPercent: 50,
      totalQuestions: 25,
      totalMarks: 100,
      units: [
        {
          id: 1,
          name: 'الدورة المحاسبية في المؤسسات الخدمية',
          lessonsCount: 6,
          weightPercent: 22,
          questionsCount: 11,
          marks: 44,
          remember: 4,
          understand: 4,
          apply: 3
        },
        {
          id: 2,
          name: 'القوائم المالية والتحليل المالي',
          lessonsCount: 4,
          weightPercent: 14,
          questionsCount: 7,
          marks: 28,
          remember: 3,
          understand: 2,
          apply: 2
        },
        {
          id: 3,
          name: 'القطاع المالي (الأسواق، الأصول، البنك المركزي)',
          lessonsCount: 4,
          weightPercent: 14,
          questionsCount: 7,
          marks: 28,
          remember: 3,
          understand: 2,
          apply: 2
        }
      ]
    },
    {
      sem: 2,
      name: 'الفصل الدراسي الثاني',
      weightPercent: 50,
      totalQuestions: 25,
      totalMarks: 100,
      units: [
        {
          id: 4,
          name: 'المؤسسات المالية الدولية: صندوق النقد والبنك الدولي',
          lessonsCount: 3,
          weightPercent: 12,
          questionsCount: 6,
          marks: 24,
          remember: 3,
          understand: 2,
          apply: 1
        },
        {
          id: 5,
          name: 'الاستدامة المالية والاقتصاد الأخضر',
          lessonsCount: 3,
          weightPercent: 12,
          questionsCount: 6,
          marks: 24,
          remember: 2,
          understand: 3,
          apply: 1
        },
        {
          id: 6,
          name: 'الذكاء الاصطناعي التوليدي في عالَم المال والأعمال',
          lessonsCount: 4,
          weightPercent: 12,
          questionsCount: 6,
          marks: 24,
          remember: 3,
          understand: 2,
          apply: 1
        },
        {
          id: 7,
          name: 'السياسات الاقتصادية وتأثيرها في التنمية والمجتمع',
          lessonsCount: 4,
          weightPercent: 14,
          questionsCount: 7,
          marks: 28,
          remember: 3,
          understand: 2,
          apply: 2
        }
      ]
    }
  ],
  cognitiveLevels: {
    remember: { name: 'التذكر والمعرفة', percent: 42, count: 21, marks: 84 },
    understand: { name: 'الفهم والاستيعاب', percent: 34, count: 17, marks: 68 },
    apply: { name: 'التطبيق والتحليل', percent: 24, count: 12, marks: 48 }
  }
};

// نماذج وزارية معيارية: 50 سؤالاً لكل نموذج موزعة طبقاً لجدول المواصفات المقترح
// مأخوذة مباشرة من أسئلة الدروس (25 سؤالاً للفصل الأول + 25 سؤالاً للفصل الثاني)
// تغطي كافة دروس المادة الـ 28 بنمط دوري عادل
function getMinisterialModels() {
  var targetBank = (unitMinisterialBank && unitMinisterialBank.length) ? unitMinisterialBank : bank;
  var unitIds = [1, 2, 3, 4, 5, 6, 7];
  var specQuotas = { 1: 11, 2: 7, 3: 7, 4: 6, 5: 6, 6: 6, 7: 7 };
  var numModels = 5;

  // تجميع أسئلة الدروس حسب كل وحدة وكل درس
  var byUnitAndLesson = {};
  unitIds.forEach(function(uid) {
    byUnitAndLesson[uid] = {};
    var uQs = targetBank.filter(function(q) { return q.unit === uid && !q._examKey; });
    uQs.forEach(function(q) {
      var lName = q.lesson || 'عام';
      if (!byUnitAndLesson[uid][lName]) byUnitAndLesson[uid][lName] = [];
      byUnitAndLesson[uid][lName].push(q);
    });
  });

  var models = [];
  for (var m = 0; m < numModels; m++) {
    models.push([]);
  }

  unitIds.forEach(function(uid) {
    var quota = specQuotas[uid];
    var lessons = Object.keys(byUnitAndLesson[uid]);
    if (lessons.length === 0) return;

    var lessonIndex = 0;
    for (var m = 0; m < numModels; m++) {
      var picked = 0;
      var attempts = 0;
      while (picked < quota && attempts < 250) {
        attempts++;
        var lName = lessons[lessonIndex % lessons.length];
        var arr = byUnitAndLesson[uid][lName];
        if (arr && arr.length > 0) {
          models[m].push(arr.shift());
          picked++;
        }
        lessonIndex++;
      }
    }
  });

  // إعادة ترتيب أسئلة كل نموذج تصاعدياً حسب رقم الوحدة ورقم السؤال ليتطابق مع التسلسل الوزاري
  models.forEach(function(m) {
    m.sort(function(a, b) {
      if (a.unit !== b.unit) return a.unit - b.unit;
      return a.id - b.id;
    });
  });

  return models.filter(function(m) { return m.length === 50; });
}

// توليد نموذج وزاري عشوائي مطابق لجدول المواصفات (50 سؤالاً)
function generateRandomMinisterialModel() {
  var targetBank = (unitMinisterialBank && unitMinisterialBank.length) ? unitMinisterialBank : bank;
  var unitIds = [1, 2, 3, 4, 5, 6, 7];
  var specQuotas = { 1: 11, 2: 7, 3: 7, 4: 6, 5: 6, 6: 6, 7: 7 };
  var randomModel = [];

  unitIds.forEach(function(uid) {
    var quota = specQuotas[uid];
    var pool = targetBank.filter(function(q) { return q.unit === uid && !q._examKey; });
    var shuffled = pool.slice().sort(function() { return 0.5 - Math.random(); });
    randomModel = randomModel.concat(shuffled.slice(0, quota));
  });

  randomModel.sort(function(a, b) {
    if (a.unit !== b.unit) return a.unit - b.unit;
    return a.id - b.id;
  });

  return randomModel;
}

// ══════════════════════════════════════════════
//  التنقل بين الصفحات
// ══════════════════════════════════════════════
function showPage(id) {
  if (window.stopSpeaking) window.stopSpeaking();
  document.querySelectorAll('.pg').forEach(function(p){ p.classList.remove('active'); p.style.display='none'; });
  var el = document.getElementById('pg-'+id);
  if (!el) return;
  el.style.display = 'block';
  // تأخير بسيط لتفعيل الأنيميشن
  requestAnimationFrame(function(){ el.classList.add('active'); });
  currentPageId = id;
  window.scrollTo(0,0);

  // تحديث محتوى الصفحة عند الانتقال إليها لضمان جاهزية العناصر
  if (id === 'home') {
    renderHome();
  } else if (id === 'lessons') {
    renderLessonPage();
  } else if (id === 'units') {
    renderUnitPage();
  } else if (id === 'ministerial') {
    renderMinisterialPage();
  } else if (id === 'exams') {
    renderExamPage();
  } else if (id === 'aqyem') {
    renderAqyemHub();
  } else if (id === 'aqyem-sem1') {
    renderAqyemSem1Page();
  } else if (id === 'aqyem-sem2') {
    renderAqyemSem2Page();
  } else if (id === 'aqyem-questions') {
    renderAqyemQuestionsPage();
  } else if (id === 'glossary') {
    if (typeof renderGlossaryPage === 'function') renderGlossaryPage();
  }

  var nb = document.getElementById('navbar');
  if (nb) nb.style.display = (id==='start') ? 'none' : 'flex';
  var btnBack = document.getElementById('btn-back');
  var btnHome = document.getElementById('btn-home');
  if (btnBack) btnBack.style.display = (id==='start'||id==='home') ? 'none' : 'inline-flex';
  if (btnHome) btnHome.style.display = (id==='start'||id==='home') ? 'none' : 'inline-flex';

  // زر خريطة الأسئلة
  var qnb = document.getElementById('qnav-btn');
  if (qnb) qnb.style.display = (id==='quiz' && currentQuiz.length > 5) ? 'flex' : 'none';

  // زر وضع المحرر — مخفي تماماً عن الطلاب، يظهر فقط للمشرف إذا كان وضع المحرر مفعلاً
  var eb = document.getElementById('btn-editor');
  if (eb) {
    if (editorMode && id !== 'start') {
      eb.style.setProperty('display', 'inline-flex', 'important');
    } else {
      eb.style.setProperty('display', 'none', 'important');
    }
  }

  try { sessionStorage.setItem('qbank_last_page', id); } catch(e){}

  // تحديث عنوان الشريط
  var titles = {
    home:'الرئيسية', lessons:'اختبار حسب الدرس', units:'اختبار حسب الوحدة',
    ministerial:'النماذج الوزارية', exams:'أسئلة التقويم', aqyem:'حل أسئلة أُقيّم تعلّمي',
    'aqyem-sem1':'فهرس أُقيّم تعلّمي — الفصل الأول',
    'aqyem-questions':'أسئلة أُقيّم تعلّمي',
    quiz: currentQuizTitle || 'الاختبار', result:'النتيجة'
  };
  var nt = document.getElementById('nav-title');
  if (nt) nt.textContent = titles[id] || '';
}

function goTo(id) {
  if (currentPageId && currentPageId !== id) {
    pageHistory.push(currentPageId);
  }
  showPage(id);
}

function goBack() {
  // إذا كان الطالب داخل اختبار غير مكتمل، يتم إيقاف المؤقت فوراً وحفظ الحالة والعودة مباشرة للصفحة السابقة
  if (currentPageId === 'quiz') {
    clearInterval(timerInterval);
    timerInterval = null;
    clearQuizProgress();
    quizSubmitted = true;
    var target = (quizOriginPage && quizOriginPage !== 'quiz' && quizOriginPage !== 'result' && quizOriginPage !== 'start') ? quizOriginPage : 'home';
    pageHistory = pageHistory.filter(function(p){ return p !== 'quiz' && p !== 'result'; });
    showPage(target);
    return;
  }

  // إذا كنا في صفحة النتيجة، فإن زر الرجوع يعيد الطالب إلى صفحة القائمة التي انطلق منها الاختبار
  if (currentPageId === 'result') {
    var origin = (quizOriginPage && quizOriginPage !== 'quiz' && quizOriginPage !== 'result' && quizOriginPage !== 'start') ? quizOriginPage : 'home';
    pageHistory = pageHistory.filter(function(p){ return p !== 'quiz' && p !== 'result'; });
    showPage(origin);
    return;
  }

  // استخراج الصفحة السابقة الحقيقية وتجاوز أي تكرار لصفحة الاختبار أو الصفحة الحالية
  var targetPage = null;
  while (pageHistory.length > 0) {
    var p = pageHistory.pop();
    if (p && p !== 'quiz' && p !== 'result' && p !== currentPageId && p !== 'start') {
      targetPage = p;
      break;
    }
  }
  if (!targetPage) {
    targetPage = 'home';
  }
  showPage(targetPage);
}
window.goBack = goBack;

function goHome() {
  // إذا كان داخل الاختبار، يتم إيقاف المؤقت وتصفية الجلسة والعودة مباشرة وفوراً للصفحة الرئيسية
  if (currentPageId === 'quiz') {
    clearInterval(timerInterval);
    timerInterval = null;
    clearQuizProgress();
    quizSubmitted = true;
  }
  pageHistory = [];
  try { sessionStorage.setItem('qbank_last_page', 'home'); } catch(e){}
  showPage('home');
}
window.goHome = goHome;

// ══════════════════════════════════════════════
//  صفحة البداية
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
//  تهيئة نموذج تسجيل دخول الطلاب في الصفحة الأولى
// ══════════════════════════════════════════════
function initStartStudentForm() {
  var retBox = document.getElementById('start-student-returning');
  var formBox = document.getElementById('start-student-form');
  var retName = document.getElementById('start-returning-name');
  var retEmail = document.getElementById('start-returning-email');
  var inEmail = document.getElementById('start-student-email');
  var inName = document.getElementById('start-student-name');
  var inSchool = document.getElementById('start-student-school');

  // عند الدخول كمعلم / في وضع المحرر: لا يلزمه التسجيل على جوجل
  if (editorMode) {
    if (retBox) {
      retBox.style.display = 'block';
      retBox.style.background = '#eaf2f8';
      retBox.style.borderColor = '#aed6f1';
      if (retName) retName.innerHTML = '<i class="fas fa-user-shield" style="color:#1b4f72;"></i> لوحة تحكم المعلم نشطة (وضع المحرر)';
      if (retEmail) retEmail.innerHTML = '<span style="color:#2874a6;font-weight:700;">دخول مباشر كمعلم ومصمم — لا يلزمك التسجيل على Google</span>';
    }
    if (formBox) formBox.style.display = 'none';
    return;
  }

  var student = getStudentProfile();

  if (student && student.email) {
    if (retName) retName.textContent = student.name || 'طالب متميز';
    if (retEmail) retEmail.textContent = student.email + (student.school ? ' (' + student.school + ')' : '');
    if (retBox) retBox.style.display = 'block';
    if (formBox) formBox.style.display = 'none';
  } else {
    if (retBox) retBox.style.display = 'none';
    if (formBox) formBox.style.display = 'block';
  }

  if (student) {
    if (inEmail && !inEmail.value) inEmail.value = student.email || '';
    if (inName && !inName.value) inName.value = student.name || '';
    if (inSchool && !inSchool.value) inSchool.value = student.school || '';
  }
}
window.initStartStudentForm = initStartStudentForm;

function showNewStudentStartForm() {
  var retBox = document.getElementById('start-student-returning');
  var formBox = document.getElementById('start-student-form');
  if (retBox) retBox.style.display = 'none';
  if (formBox) formBox.style.display = 'block';
  var inEmail = document.getElementById('start-student-email');
  if (inEmail) inEmail.focus();
}
window.showNewStudentStartForm = showNewStudentStartForm;

function setMode(m) {
  currentMode = m;
  var bTrain = document.getElementById('btn-train');
  var bExam = document.getElementById('btn-exam');
  if (bTrain) bTrain.classList.toggle('active', m === 'train');
  if (bExam) bExam.classList.toggle('active', m === 'exam');
}

function startApp() {
  pageHistory = [];
  renderHome();
  showPage('home');
}

// ══════════════════════════════════════════════
//  الصفحة الرئيسية
// ══════════════════════════════════════════════
function renderHome() {
  var sessionBanner = buildActiveSessionBanner();
  var student = getStudentProfile();

  // بطاقة المعلم أو بطاقة الطالب
  var userBadge = editorMode ? (
    '<div style="background:linear-gradient(135deg,#1b4f72,#2874a6);color:#fff;border-radius:14px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;box-shadow:0 3px 12px rgba(27,79,114,0.22);">' +
      '<div>' +
        '<div style="font-size:15px;font-weight:800;display:flex;align-items:center;gap:7px;"><i class="fas fa-user-shield" style="color:#f1c40f;"></i> لوحة تحكم المعلم والمصمم (وضع المحرر نشط)</div>' +
        '<div style="font-size:12px;opacity:0.94;margin-top:3px;">دخول مباشر كامل الصلاحيات دون الحاجة لحساب Google • يمكنك تحرير وإضافة الأسئلة وحذفها وعرض سجلات ونتائج الطلاب</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button onclick="openTeacherStudentsModal()" style="background:#fff;color:#1b4f72;border:none;border-radius:9px;padding:8px 14px;font-size:13px;font-weight:800;cursor:pointer;font-family:\'Tajawal\',sans-serif;display:inline-flex;align-items:center;gap:6px;"><i class="fas fa-users"></i> سجل الطلاب والنتائج</button>' +
        '<button onclick="openBookDriveUrlSettings()" style="background:#0284c7;color:#fff;border:none;border-radius:9px;padding:8px 14px;font-size:13px;font-weight:800;cursor:pointer;font-family:\'Tajawal\',sans-serif;display:inline-flex;align-items:center;gap:6px;" title="تعيين روابط Google Drive لتنزيل الكتب الأصلية"><i class="fab fa-google-drive"></i> رابط كتب Drive</button>' +
        '<button onclick="toggleEditorMode()" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.4);border-radius:9px;padding:8px 12px;font-size:12px;cursor:pointer;font-family:\'Tajawal\',sans-serif;"><i class="fas fa-sign-out-alt"></i> خروج من وضع المحرر</button>' +
      '</div>' +
    '</div>'
  ) : (student ? (
    '<div style="background:#eef6fc;border:1.5px solid #c3daf1;border-radius:12px;padding:10px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;font-size:13px;">' +
      '<span><i class="fas fa-user-check" style="color:#27ae60;margin-left:7px;"></i> مرحباً، <strong style="color:#1a3a5c;">' + escHtml(student.name) + '</strong> (' + escHtml(student.email) + ')</span>' +
      '<button onclick="showNewStudentForm();document.getElementById(\'student-reg-overlay\').classList.add(\'open\');" style="background:none;border:none;color:#2980b9;font-weight:700;cursor:pointer;font-family:\'Tajawal\',sans-serif;font-size:12px;">تغيير الحساب</button>' +
    '</div>'
  ) : '');

  // القسم الأول: بنك الأسئلة والاختبارات التفاعلية (يأتي أولاً)
  var questionBankSectionHtml =
    '<div class="home-section">' +
      '<div class="home-sec-title">' +
        '<i class="fas fa-layer-group" style="color:#f59e0b;"></i> بنك الاختبارات والتدريب التفاعلي' +
      '</div>' +
      '<div class="menu-grid">' +
        mCard('fa-book-open', 'card-blue', 'اختبار حسب الدرس', '28 درساً مقرراً — اختر فصلاً ثم درساً للتدرب عليه', "renderLessonPage(); goTo('lessons')") +
        mCard('fa-cubes', 'card-green', 'اختبار حسب الوحدة', '7 وحدات دراسية — نماذج معتمدة ثابتة × 20 سؤالاً', "renderUnitPage(); goTo('units')") +
        mCard('fa-star', 'card-gold', 'النماذج الوزارية الشاملة', '5 نماذج معيارية شاملة للكتابين × 50 سؤالاً (100 علامة)', "renderMinisterialPage(); goTo('ministerial')") +
        mCard('fa-clipboard-list', 'card-purple', 'أسئلة التقويم', 'امتحانات تقويمية 1 و2 و3 + الامتحان النهائي للفصلين', "renderExamPage(); goTo('exams')") +
      '</div>' +
    '</div>';

  // القسم الثاني: المناهج المدرسية المقررة وحل أسئلة أقيم تعلمي ومسرد المصطلحات
  var curriculumSectionHtml =
    '<div class="home-section" style="margin-top:20px;">' +
      '<div class="home-sec-title">' +
        '<i class="fas fa-graduation-cap" style="color:#0284c7;"></i> المنهاج المدرسي والكتب المقررة' +
      '</div>' +
      '<div class="menu-grid menu-grid-4">' +
        mCard('fa-book-bookmark', 'card-book-sem1', 'كتاب الفصل الأول', 'كتاب الطالب المعتمد (الوحدات 1، 2، 3) • تنزيل مباشر PDF ودوسية وفهرس الدروس', "openBookModal(1)", 'كتاب الطالب') +
        mCard('fa-book-open', 'card-book-sem2', 'كتاب الفصل الثاني', 'كتاب الطالب المعتمد (الوحدات 4، 5، 6، 7) • تنزيل مباشر PDF ودوسية وفهرس الدروس', "openBookModal(2)", 'كتاب الطالب') +
        mCard('fa-clipboard-check', 'card-aqyem', 'حل أسئلة «أُقيّم تعلّمي»', 'بنك إجابات وشروحات أسئلة أُقيّم تعلّمي المعتمدة • للفصلين الأول والثاني', "goTo('aqyem')", 'معتمد ✨') +
        mCard('fa-spell-check', 'card-glossary', 'مسرد المصطلحات', 'المعجم والمفاهيم الرسمية المعتمدة في كتابي الطالب (119 مصطلحاً بالعربية والإنجليزية)', "goTo('glossary')", 'معتمد 📖') +
      '</div>' +
    '</div>';

  // بوابة دخول المعلم المشفرة في أسفل الصفحة
  var teacherGateway = !editorMode ? (
    '<div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px dashed var(--bd);">' +
      '<button type="button" class="btn-teacher-gateway" onclick="toggleEditorMode()" title="دخول المعلم والمصمم لتحرير الأسئلة وإدارة بنك الأسئلة">' +
        '<i class="fas fa-user-shield"></i> لوحة تحكم المعلم / وضع المحرر المشفر' +
      '</button>' +
    '</div>'
  ) : '';

  var html =
    sessionBanner +
    userBadge +
    questionBankSectionHtml +
    curriculumSectionHtml +
    teacherGateway;

  document.getElementById('home-inner').innerHTML = html;
}

function mCard(icon, cls, title, sub, onclick, badge, extraActionHtml) {
  var badgeHtml = badge ? ('<span class="mc-badge">' + badge + '</span>') : '';
  var extraHtml = extraActionHtml ? ('<div class="mc-extra-action" style="margin-top:10px;">' + extraActionHtml + '</div>') : '';
  return '<div class="menu-card ' + cls + '" onclick="' + onclick + '">' +
    badgeHtml +
    '<div class="mc-icon"><i class="fas ' + icon + '"></i></div>' +
    '<div class="mc-title">' + title + '</div>' +
    '<div class="mc-sub">' + sub + '</div>' +
    extraHtml +
  '</div>';
}

// ══════════════════════════════════════════════
//  نافذة عرض وتحميل وتفاصيل كتب المنهاج
// ══════════════════════════════════════════════
function openBookModal(sem) {
  var data = sem === 1 ? {
    title: 'كتاب الطالب — الثقافة المالية (الفصل الدراسي الأول)',
    semName: 'الفصل الدراسي الأول',
    badge: 'طبعة 2026 المنقحة • المركز الوطني لتطوير المناهج (NCCD)',
    color: '#0c4a6e',
    gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)',
    icon: 'fa-book-bookmark',
    pdfUrl: '/api/books/book_sem1/pdf',
    directPdf: '/api/books/book_sem1/download',
    driveUrl: (cachedBooksData['book_sem1'] && cachedBooksData['book_sem1'].driveUrl) || 'https://drive.google.com/file/d/1Olfyv-DcLIM4Xj--lNgD4Hto5JMHWSPS/view?usp=drive_link',
    totalLessons: 14,
    totalUnits: 3,
    pagesInfo: '140 صفحة • الطبعة الثانية (مزيدة ومنقحة) 2026م (1446هـ/2025م)',
    decreeInfo: 'قرار مجلس التربية والتعليم رقم (2025/88) وقرار المجلس الأعلى لتطوير المناهج رقم (2025/3)',
    units: [
      {
        id: 1,
        name: 'الدورة المحاسبية في المؤسسات الخدمية',
        page: 6,
        lessons: [
          { name: 'الدورة المحاسبية: المفهوم، والمراحل', page: 8 },
          { name: 'نظرية القيد المزدوج والعمليات المالية', page: 13 },
          { name: 'تسجيل القيود المحاسبية', page: 20 },
          { name: 'دفتر اليومية', page: 29 },
          { name: 'دفتر الأستاذ', page: 35 },
          { name: 'ميزان المراجعة', page: 46 }
        ]
      },
      {
        id: 2,
        name: 'القوائم المالية والتحليل المالي',
        page: 58,
        lessons: [
          { name: 'القوائم المالية: المفهوم، الأنواع، والأهمية', page: 60 },
          { name: 'إقفال الحسابات', page: 73 },
          { name: 'التحليل المالي: المفهوم، والأهمية', page: 80 },
          { name: 'التحليل المالي والنسب', page: 84 }
        ]
      },
      {
        id: 3,
        name: 'القطاع المالي',
        page: 102,
        lessons: [
          { name: 'الأسواق المالية: المفهوم، الأنواع، والأهمية', page: 104 },
          { name: 'الأصول المالية: المفهوم، والأنواع', page: 111 },
          { name: 'البنك المركزي الأردني والسياسة النقدية', page: 118 },
          { name: 'دور البنك المركزي الأردني في المحافظة على الاستقرار المصرفي والمالي', page: 124 }
        ]
      }
    ]
  } : {
    title: 'كتاب الطالب — الثقافة المالية (الفصل الدراسي الثاني)',
    semName: 'الفصل الدراسي الثاني',
    badge: 'طبعة 2026 المنقحة • المركز الوطني لتطوير المناهج (NCCD)',
    color: '#064e3b',
    gradient: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
    icon: 'fa-book-open-reader',
    pdfUrl: '/api/books/book_sem2/pdf',
    directPdf: '/api/books/book_sem2/download',
    driveUrl: (cachedBooksData['book_sem2'] && cachedBooksData['book_sem2'].driveUrl) || '',
    totalLessons: 14,
    totalUnits: 4,
    pagesInfo: '120 صفحة • الطبعة الثانية (مزيدة ومنقحة) 2026م (1447هـ/2025م)',
    decreeInfo: 'قرار مجلس التربية والتعليم رقم (2025/248) وقرار المجلس الأعلى لتطوير المناهج رقم (2025/9)',
    units: [
      {
        id: 4,
        name: 'المؤسسات المالية الدولية: صندوق النقد الدولي والبنك الدولي',
        page: 6,
        lessons: [
          { name: 'المؤسسات المالية الدولية: نشأتها، وأنواعها', page: 8 },
          { name: 'صندوق النقد الدولي', page: 12 },
          { name: 'البنك الدولي', page: 18 }
        ]
      },
      {
        id: 5,
        name: 'الاستدامة المالية',
        page: 26,
        lessons: [
          { name: 'مُقدّمة في الاستدامة المالية', page: 28 },
          { name: 'الاستدامة المالية: التحدّيات، والحلول', page: 34 },
          { name: 'الاقتصاد الأخضر والاستدامة', page: 40 }
        ]
      },
      {
        id: 6,
        name: 'الذكاء الاصطناعي التوليدي في عالَم المال والأعمال',
        page: 50,
        lessons: [
          { name: 'الذكاء الاصطناعي التوليدي', page: 52 },
          { name: 'الذكاء الاصطناعي التوليدي وعالَم المال', page: 58 },
          { name: 'الذكاء الاصطناعي التوليدي وخصوصية البيانات', page: 67 },
          { name: 'الذكاء الاصطناعي التوليدي وأخلاقيات الأعمال', page: 74 }
        ]
      },
      {
        id: 7,
        name: 'السياسات الاقتصادية وتأثيرها في التنمية والمجتمع',
        page: 82,
        lessons: [
          { name: 'مُقدّمة في السياسات الاقتصادية والسياسة المالية', page: 84 },
          { name: 'تأثير السياسة المالية في النشاط الاقتصادي', page: 92 },
          { name: 'السياسة النقدية: أدواتها، وتأثيرها في النشاط الاقتصادي', page: 98 },
          { name: 'السياسة التجارية والسياسة الصناعية', page: 104 }
        ]
      }
    ]
  };

  var hdr = document.getElementById('book-modal-header');
  var titleEl = document.getElementById('book-modal-title');
  var bodyEl = document.getElementById('book-modal-body');
  var overlay = document.getElementById('book-modal-overlay');

  if (hdr) hdr.style.background = data.gradient;
  if (titleEl) titleEl.innerHTML = '<i class="fas ' + data.icon + '"></i> ' + data.title;

  var unitsHtml = '';
  data.units.forEach(function(u) {
    unitsHtml += '<div class="bkm-unit-card">' +
      '<div class="bkm-unit-head">' +
        '<i class="fas fa-layer-group"></i>' +
        '<span style="flex:1;">الوحدة ' + u.id + ': ' + u.name + ' (' + u.lessons.length + ' دروس)</span>' +
        '<span class="bkm-page-tag">ص ' + u.page + '</span>' +
      '</div>' +
      '<div class="bkm-lessons-list">';
    u.lessons.forEach(function(lObj, idx) {
      var lName = typeof lObj === 'string' ? lObj : lObj.name;
      var lPage = typeof lObj === 'object' && lObj.page ? lObj.page : null;
      var qCount = (lessonBank && lessonBank.length ? lessonBank : bank).filter(function(q){ return q.lesson === lName && !q._examKey; }).length;
      var aqList = (typeof getAqyemDataset === 'function') ? getAqyemDataset() : [];
      var normLName = normalizeLessonTitle(lName);
      var aqCount = aqList.filter(function(aq){
        if (aq.sem !== sem) return false;
        if (aq.isUnitExam || (aq.lesson && aq.lesson.indexOf('اختبار نهاية الوحدة') !== -1)) return false;
        return aq.lesson === lName || normalizeLessonTitle(aq.lesson) === normLName;
      }).length;
      unitsHtml += '<div class="bkm-lesson-item" onclick="closeBookModal();launchLessonQuiz(\'' + esc(lName) + '\')" title="انقر للبدء في أسئلة هذا الدرس مباشرة">' +
        '<span class="bkm-num">' + (idx + 1) + '</span>' +
        '<span class="bkm-name">' + lName + '</span>' +
        (lPage ? '<span class="bkm-page-tag">ص ' + lPage + '</span>' : '') +
        '<span class="bkm-cnt"><i class="fas fa-play" style="font-size:9px;margin-left:3px;color:var(--pr);"></i> ' + qCount + ' سؤال</span>' +
        (aqCount > 0 ? (
          '<button type="button" class="bkm-lesson-aqyem-btn" onclick="event.stopPropagation(); closeBookModal(); openAqyemQuestions({ sem:' + sem + ', unitId:' + u.id + ', lesson:\'' + esc(lName).replace(/'/g, "\\'") + '\', type:\'all\' })" title="عرض وحل أسئلة أُقيّم تعلّمي لهذا الدرس مباشرة">' +
            '<i class="fas fa-clipboard-check"></i> <span>أُقيّم تعلّمي (' + aqCount + ')</span>' +
          '</button>'
        ) : '') +
        '<i class="fas fa-chevron-left bkm-arrow"></i>' +
      '</div>';
    });
    unitsHtml += '</div></div>';
  });

  var html =
    '<div class="bkm-intro-box">' +
      '<div class="bkm-intro-top">' +
        '<div class="bkm-icon-box" style="background:' + data.color + ';"><i class="fas ' + data.icon + '"></i></div>' +
        '<div>' +
          '<div class="bkm-badge"><i class="fas fa-check-circle"></i> ' + data.badge + '</div>' +
          '<div class="bkm-h">' + data.semName + ' — المسار الأكاديمي (الصف الثاني عشر)</div>' +
          '<div class="bkm-sub">' + data.pagesInfo + ' • ' + data.totalUnits + ' وحدات • ' + data.totalLessons + ' درساً</div>' +
        '</div>' +
      '</div>' +
      '<div class="bkm-decree-box" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;">' +
        '<i class="fas fa-certificate" style="font-size:22px;color:#0284c7;flex-shrink:0;"></i>' +
        '<div>' +
          '<div style="font-size:13px;font-weight:700;color:#0369a1;">كتاب معتمد رسمياً من وزارة التربية والتعليم والمركز الوطني للمناهج</div>' +
          '<div style="font-size:11.5px;color:#475569;margin-top:2px;"><i class="fas fa-stamp"></i> ' + data.decreeInfo + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="bkm-actions-row">' +
        '<a href="' + (data.driveUrl || ('/api/books/book_sem' + sem + '/download')) + '" target="_blank" rel="noopener noreferrer" class="bkm-btn bkm-btn-download" style="background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:700;padding:12px 16px;border-radius:12px;box-shadow:0 3px 10px rgba(2,132,199,0.25);" title="تنزيل النسخة الوزارية الرسمية المعتمدة الكاملة بصيغة PDF مباشرة من Google Drive">' +
          '<i class="fab fa-google-drive" style="font-size:16px;"></i> <span>تنزيل كتاب الطالب (Drive PDF)</span>' +
        '</a>' +
        '<button type="button" class="bkm-btn bkm-btn-dosieh" onclick="showDosiehUnderConstruction(' + sem + ');" title="دوسية الكتاب الرقمية (قيد الإعداد والتجهيز)">' +
          '<i class="fas fa-book-open"></i> <span>دوسية الكتاب الرقمية</span>' +
        '</button>' +
        '<button type="button" class="bkm-btn bkm-btn-aqyem" onclick="closeBookModal(); openAqyemFiltered(' + sem + ');" title="حل أسئلة أقيم تعلمي المعتمدة">' +
          '<i class="fas fa-clipboard-check"></i> <span>حل أسئلة «أُقيّم تعلّمي»</span>' +
        '</button>' +
      '</div>' +
      (editorMode ? (
        '<div style="margin-top:12px;text-align:center;">' +
          '<button type="button" onclick="promptSetBookDriveUrl(' + sem + ');" style="background:#e0f2fe;color:#0369a1;border:1.5px dashed #0284c7;border-radius:9px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:\'Tajawal\',sans-serif;display:inline-flex;align-items:center;gap:6px;" title="تعديل أو إدخال رابط Google Drive المعتمد لتنزيل هذا الكتاب">' +
            '<i class="fab fa-google-drive" style="color:#0284c7;"></i> تعيين رابط تنزيل Google Drive لهذا الكتاب' +
          '</button>' +
        '</div>'
      ) : '') +
    '</div>' +
    '<div class="bkm-units-sec-title"><i class="fas fa-play-circle" style="color:var(--pr);"></i> بدء تدريب على دروس الفصل:</div>' +
    unitsHtml;

  if (bodyEl) bodyEl.innerHTML = html;
  if (overlay) overlay.classList.add('open');
}
window.openBookModal = openBookModal;

// ══════════════════════════════════════════════
//  عارض وتصفح صفحات الكتاب الرقمي (Digital Reader)
//  مرتبط سحابياً بقاعدة بيانات Firebase Firestore
// ══════════════════════════════════════════════
var cachedBooksData = {};
var currentReaderSem = 1;
var currentReaderPage = 1;
var currentReaderTab = 'interactive';
var readerFontSizeDelta = 0;
var readerTtsAudio = null;
var readerTtsIsPlaying = false;

// Fallback book metadata and pages if offline or initial load
var fallbackBooksStore = {
  1: {
    id: "book_sem1",
    sem: 1,
    title: "كتاب الطالب — الثقافة المالية (الفصل الدراسي الأول)",
    subtitle: "المسار الثانوي الشامل (الصف الثاني عشر — التوجيهي)",
    edition: "الطبعة الثانية، مزيدة ومنقحة 2026م (1446هـ/2025م)",
    publisher: "المركز الوطني لتطوير المناهج والتقويم (NCCD)",
    decree: "قرار مجلس التربية والتعليم رقم (2025/88) وقرار المجلس الأعلى رقم (2025/3)",
    totalPages: 140,
    directPdf: "/api/books/book_sem1/download",
    pdfUrl: "/api/books/book_sem1/pdf",
    units: [
      {
        id: 1,
        name: "الدورة المحاسبية في المؤسسات الخدمية",
        startPage: 6,
        endPage: 57,
        lessons: [
          { name: "الدورة المحاسبية: المفهوم، والمراحل", startPage: 8, endPage: 12 },
          { name: "نظرية القيد المزدوج والعمليات المالية", startPage: 13, endPage: 19 },
          { name: "تسجيل القيود المحاسبية", startPage: 20, endPage: 28 },
          { name: "دفتر اليومية", startPage: 29, endPage: 34 },
          { name: "دفتر الأستاذ", startPage: 35, endPage: 45 },
          { name: "ميزان المراجعة", startPage: 46, endPage: 55 }
        ]
      },
      {
        id: 2,
        name: "القوائم المالية والتحليل المالي",
        startPage: 58,
        endPage: 101,
        lessons: [
          { name: "القوائم المالية: المفهوم، الأنواع، والأهمية", startPage: 60, endPage: 72 },
          { name: "إقفال الحسابات", startPage: 73, endPage: 79 },
          { name: "التحليل المالي: المفهوم، والأهمية", startPage: 80, endPage: 83 },
          { name: "التحليل المالي والنسب", startPage: 84, endPage: 95 }
        ]
      },
      {
        id: 3,
        name: "القطاع المالي",
        startPage: 102,
        endPage: 140,
        lessons: [
          { name: "الأسواق المالية: المفهوم، الأنواع، والأهمية", startPage: 104, endPage: 110 },
          { name: "الأصول المالية: المفهوم، والأنواع", startPage: 111, endPage: 117 },
          { name: "البنك المركزي الأردني والسياسة النقدية", startPage: 118, endPage: 123 },
          { name: "دور البنك المركزي الأردني في المحافظة على الاستقرار المصرفي والمالي", startPage: 124, endPage: 128 }
        ]
      }
    ]
  },
  2: {
    id: "book_sem2",
    sem: 2,
    title: "كتاب الطالب — الثقافة المالية (الفصل الدراسي الثاني)",
    subtitle: "المسار الثانوي الشامل (الصف الثاني عشر — التوجيهي)",
    edition: "الطبعة الثانية، مزيدة ومنقحة 2026م (1447هـ/2025م)",
    publisher: "المركز الوطني لتطوير المناهج والتقويم (NCCD)",
    decree: "قرار مجلس التربية والتعليم رقم (2025/248) وقرار المجلس الأعلى رقم (2025/9)",
    totalPages: 120,
    directPdf: "/api/books/book_sem2/download",
    pdfUrl: "/api/books/book_sem2/pdf",
    units: [
      {
        id: 4,
        name: "المؤسسات المالية الدولية: صندوق النقد الدولي والبنك الدولي",
        startPage: 6,
        endPage: 25,
        lessons: [
          { name: "المؤسسات المالية الدولية: نشأتها، وأنواعها", startPage: 8, endPage: 11 },
          { name: "صندوق النقد الدولي", startPage: 12, endPage: 17 },
          { name: "البنك الدولي", startPage: 18, endPage: 23 }
        ]
      },
      {
        id: 5,
        name: "الاستدامة المالية",
        startPage: 26,
        endPage: 49,
        lessons: [
          { name: "مُقدّمة في الاستدامة المالية", startPage: 28, endPage: 33 },
          { name: "الاستدامة المالية: التحدّيات، والحلول", startPage: 34, endPage: 39 },
          { name: "الاقتصاد الأخضر والاستدامة", startPage: 40, endPage: 47 }
        ]
      },
      {
        id: 6,
        name: "الذكاء الاصطناعي التوليدي في عالَم المال والأعمال",
        startPage: 50,
        endPage: 81,
        lessons: [
          { name: "الذكاء الاصطناعي التوليدي", startPage: 52, endPage: 57 },
          { name: "الذكاء الاصطناعي التوليدي وعالَم المال", startPage: 58, endPage: 66 },
          { name: "الذكاء الاصطناعي التوليدي وخصوصية البيانات", startPage: 67, endPage: 73 },
          { name: "الذكاء الاصطناعي التوليدي وأخلاقيات الأعمال", startPage: 74, endPage: 79 }
        ]
      },
      {
        id: 7,
        name: "السياسات الاقتصادية وتأثيرها في التنمية والمجتمع",
        startPage: 82,
        endPage: 120,
        lessons: [
          { name: "مُقدّمة في السياسات الاقتصادية والسياسة المالية", startPage: 84, endPage: 91 },
          { name: "تأثير السياسة المالية في النشاط الاقتصادي", startPage: 92, endPage: 97 },
          { name: "السياسة النقدية: أدواتها، وتأثيرها في النشاط الاقتصادي", startPage: 98, endPage: 103 },
          { name: "السياسة التجارية والسياسة الصناعية", startPage: 104, endPage: 112 }
        ]
      }
    ]
  }
};

async function openDigitalReader(sem, targetPage) {
  currentReaderSem = sem || 1;
  currentReaderPage = targetPage || (sem === 1 ? 8 : 8);

  var overlay = document.getElementById('digital-book-reader-overlay');
  if (overlay) overlay.classList.add('open');

  // إظهار مؤشر التحميل الأولي
  var sheet = document.getElementById('textbook-sheet');
  if (sheet) {
    sheet.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#64748b;">' +
      '<i class="fas fa-spinner fa-spin" style="font-size:32px;color:#0284c7;margin-bottom:12px;"></i>' +
      '<div style="font-weight:700;font-size:16px;">جارٍ تحميل صفحات الكتاب المعتمد من سحابة Firebase...</div>' +
    '</div>';
  }

  // جلب الكتاب من الـ API (المخزن سحابياً في Firestore)
  try {
    var bookId = 'book_sem' + currentReaderSem;
    if (!cachedBooksData[currentReaderSem]) {
      var resp = await fetch('/api/books/' + bookId);
      if (resp.ok) {
        var data = await resp.json();
        if (data && data.book) {
          cachedBooksData[currentReaderSem] = data.book;
        }
      }
    }
  } catch (err) {
    console.warn('[Reader] Network fetch fallback to local store:', err);
  }

  // استخدام البيانات المجلوبة أو البيانات الاحتياطية المعتمدة
  var currentBook = cachedBooksData[currentReaderSem] || fallbackBooksStore[currentReaderSem];

  // تحديث الترويسة وأدوات التحكم
  var titleEl = document.getElementById('reader-book-title');
  if (titleEl) {
    titleEl.innerHTML = '<i class="fas fa-book-open" style="color:#38bdf8;"></i> ' + currentBook.title;
  }

  var totalPagesLabel = document.getElementById('rdr-total-pages-label');
  if (totalPagesLabel) {
    totalPagesLabel.textContent = 'من ' + (currentBook.totalPages || 140);
  }

  var pageInput = document.getElementById('rdr-page-input');
  if (pageInput) {
    pageInput.max = currentBook.totalPages || 140;
    pageInput.value = currentReaderPage;
  }

  // تحديث روابط الـ PDF
  var directPdfBtn = document.getElementById('pdf-direct-download-btn');
  if (directPdfBtn) {
    var pdfDownloadUrl = '/api/books/book_sem' + currentReaderSem + '/download';
    directPdfBtn.href = pdfDownloadUrl;
    directPdfBtn.onclick = function(e) {
      var curB = cachedBooksData['book_sem' + currentReaderSem];
      var dUrl = (curB && curB.driveUrl) ? curB.driveUrl.trim() : '';
      if (dUrl) {
        window.open(dUrl, '_blank');
        e.preventDefault();
        return false;
      }
      if (editorMode) {
        e.preventDefault();
        promptSetBookDriveUrl(currentReaderSem);
        return false;
      }
    };
  }

  var extViewBtn = document.getElementById('pdf-external-view-btn');
  if (extViewBtn) {
    extViewBtn.href = '/api/books/book_sem' + currentReaderSem + '/pdf';
  }

  var pdfFrame = document.getElementById('reader-pdf-iframe');
  if (pdfFrame) {
    // عرض ملف الـ PDF الرسمي مباشرة من خادم المنصة بدون روابط وسيطة متعطلة
    pdfFrame.src = '/api/books/book_sem' + currentReaderSem + '/pdf';
  }

  // بناء الفهرس الجانبي
  renderReaderToc(currentBook);

  // عرض الصفحة المحددة
  renderReaderPage(currentReaderPage);
}
window.openDigitalReader = openDigitalReader;

function closeDigitalReader(e) {
  if (e && e.target && e.target.id !== 'digital-book-reader-overlay' && !e.target.closest('.editor-modal-close')) {
    return;
  }
  var overlay = document.getElementById('digital-book-reader-overlay');
  if (overlay) overlay.classList.remove('open');
  if (readerTtsAudio) {
    try { readerTtsAudio.pause(); } catch(err){}
  }
  readerTtsIsPlaying = false;
  var ttsBtn = document.getElementById('reader-tts-btn');
  if (ttsBtn) ttsBtn.classList.remove('active');
}
window.closeDigitalReader = closeDigitalReader;

function renderReaderToc(book) {
  var tocList = document.getElementById('reader-toc-list');
  if (!tocList || !book || !book.units) return;

  var html = '';
  book.units.forEach(function(u) {
    html += '<div class="rdr-toc-unit-title">' +
      '<i class="fas fa-layer-group"></i> الوحدة ' + u.id + ': ' + u.name +
    '</div>';
    
    if (u.lessons && u.lessons.length) {
      u.lessons.forEach(function(lObj) {
        var lName = typeof lObj === 'string' ? lObj : lObj.name;
        var lStart = typeof lObj === 'object' && lObj.startPage ? lObj.startPage : (lObj.page || 8);
        var qCount = (lessonBank && lessonBank.length ? lessonBank : bank).filter(function(q){ return q.lesson === lName && !q._examKey; }).length;
        var isActive = (currentReaderPage >= lStart && (!lObj.endPage || currentReaderPage <= lObj.endPage));

        html += '<div class="rdr-toc-lesson-item ' + (isActive ? 'active' : '') + '" id="toc-item-' + lStart + '" onclick="readerGoToPage(' + lStart + ')">' +
          '<div style="display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis;">' +
            '<i class="fas fa-file-alt" style="font-size:11px;opacity:0.7;"></i>' +
            '<span>' + lName + '</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
            '<span class="bkm-page-tag">ص ' + lStart + '</span>' +
          '</div>' +
        '</div>';
      });
    }
  });

  tocList.innerHTML = html;
}

function renderReaderPage(pageNum) {
  var book = cachedBooksData[currentReaderSem] || fallbackBooksStore[currentReaderSem];
  if (!book) return;

  currentReaderPage = Math.max(1, Math.min(pageNum, book.totalPages || 140));

  // تحديث مدخل رقم الصفحة
  var inputEl = document.getElementById('rdr-page-input');
  if (inputEl) inputEl.value = currentReaderPage;

  var mbPage = document.getElementById('rdr-mb-page-label');
  if (mbPage) mbPage.textContent = 'صفحة ' + currentReaderPage;

  // تحديد الوحدة والدرس الحالي استناداً لرقم الصفحة
  var currentUnit = null;
  var currentLesson = null;

  if (book.units) {
    book.units.forEach(function(u) {
      if (currentReaderPage >= u.startPage && currentReaderPage <= u.endPage) {
        currentUnit = u;
        if (u.lessons) {
          u.lessons.forEach(function(l) {
            var s = l.startPage || l.page || u.startPage;
            var e = l.endPage || (s + 6);
            if (currentReaderPage >= s && currentReaderPage <= e) {
              currentLesson = l;
            }
          });
        }
      }
    });
  }

  // البحث في الصفحات التفصيلية المخزنة بالكتاب
  var pageData = null;
  if (book.pages && Array.isArray(book.pages)) {
    pageData = book.pages.find(function(p) { return p.page === currentReaderPage; });
    // إذا لم توجد الصفحة حرفياً، ابحث عن أقرب صفحة للدرس
    if (!pageData && currentLesson) {
      pageData = book.pages.find(function(p) {
        return p.lessonName && (p.lessonName.indexOf(currentLesson.name) !== -1 || currentLesson.name.indexOf(p.lessonName) !== -1);
      });
    }
  }

  // توليد محتوى الصفحة المعتمدة بصرياً
  var unitTitle = currentUnit ? ('الوحدة ' + currentUnit.id + ': ' + currentUnit.name) : 'مبحث الثقافة المالية';
  var lessonName = currentLesson ? (currentLesson.name || currentLesson) : 'منهاج الصف الثاني عشر (التوجيهي)';
  var pageHeading = pageData ? pageData.title : lessonName;

  var relatedQuestions = (lessonBank && lessonBank.length ? lessonBank : bank).filter(function(q) {
    return q.lesson === lessonName && !q._examKey;
  });

  var sheet = document.getElementById('textbook-sheet');
  if (!sheet) return;

  var paragraphsHtml = '';
  if (pageData && pageData.content) {
    pageData.content.forEach(function(c) {
      paragraphsHtml += '<div class="tb-paragraph">' + c + '</div>';
    });
  } else {
    paragraphsHtml =
      '<div class="tb-paragraph">' +
        'يتناول هذا الدرس موضوع <strong>«' + lessonName + '»</strong> ضمن مفردات ' + unitTitle + ' المقررة وزارياً لطلبة الثانوية العامة (التوجيهي).' +
      '</div>' +
      '<div class="tb-highlight-box">' +
        '<i class="fas fa-check-circle" style="color:#16a34a;"></i> ' +
        '<strong>المفاهيم والنتاجات التعليمية المستهدفة:</strong> ' +
        'استيعاب القواعد العلمية والأنظمة المالية المنصوص عليها في المنهاج، والتمييز بين التطبيقات الإجرائية، وتطبيق حل المسائل والتمارين المالية المعتمدة.' +
      '</div>' +
      '<div class="tb-paragraph">' +
        'يشتمل المحتوى على الشروحات النظرية، دراسات الحالة الواقعية في بيئة الأعمال الأردنية، وأنشطة التعلم الذاتي، وأسئلة «أقيم تعلمي» الملحقة بنهاية الدرس.' +
      '</div>';
  }

  // الجداول المحاسبية أو المقارنات إن وُجدت
  var tablesHtml = '';
  if (pageData && pageData.tables && pageData.tables.length) {
    pageData.tables.forEach(function(tbl) {
      tablesHtml += '<div style="margin:16px 0;">' +
        '<div style="font-weight:800;color:var(--pr);margin-bottom:6px;"><i class="fas fa-table"></i> ' + tbl.title + '</div>' +
        '<table class="tb-table">' +
          '<thead><tr>';
      tbl.headers.forEach(function(h){ tablesHtml += '<th>' + h + '</th>'; });
      tablesHtml += '</tr></thead><tbody>';
      tbl.rows.forEach(function(row) {
        tablesHtml += '<tr>';
        row.forEach(function(cell){ tablesHtml += '<td>' + cell + '</td>'; });
        tablesHtml += '</tr>';
      });
      tablesHtml += '</tbody></table></div>';
    });
  }

  // التنبيهات والنقاط الهامة
  var highlightsHtml = '';
  if (pageData && pageData.highlights && pageData.highlights.length) {
    pageData.highlights.forEach(function(h) {
      highlightsHtml += '<div class="tb-highlight-box"><i class="fas fa-bookmark" style="color:#16a34a;"></i> ' + h + '</div>';
    });
  }

  var html =
    '<div class="tb-sheet-head">' +
      '<div class="tb-emblem-text">' +
        '<div>المملكة الأردنية الهاشمية • وزارة التربية والتعليم</div>' +
        '<div>المركز الوطني لتطوير المناهج والتقويم (NCCD)</div>' +
      '</div>' +
      '<span class="tb-unit-pill">' + unitTitle + '</span>' +
      '<span class="tb-page-number-top">ص ' + currentReaderPage + '</span>' +
    '</div>' +
    '<div class="tb-sheet-title">' + pageHeading + '</div>' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;flex-wrap:wrap;">' +
      '<span style="background:#f1f5f9;color:#475569;font-size:12.5px;font-weight:700;padding:3px 10px;border-radius:6px;">' +
        '<i class="fas fa-book"></i> ' + book.edition +
      '</span>' +
      '<span style="background:#ecfdf5;color:#047857;font-size:12.5px;font-weight:700;padding:3px 10px;border-radius:6px;">' +
        '<i class="fas fa-check-double"></i> معتمد وزارياً لامتحان التوجيهي' +
      '</span>' +
    '</div>' +
    '<div class="tb-page-content-area">' +
      paragraphsHtml +
      tablesHtml +
      highlightsHtml +
    '</div>' +
    '<div class="tb-action-bar">' +
      '<div style="font-size:14px;color:#64748b;">' +
        '<i class="fas fa-question-circle" style="color:#0284c7;"></i> يتوفر في بنك الأسئلة لهذا الدرس: <strong>' + relatedQuestions.length + ' سؤالاً</strong>' +
      '</div>' +
      '<button type="button" class="tb-quiz-jump-btn" onclick="closeDigitalReader();launchLessonQuiz(\'' + esc(lessonName) + '\')">' +
        '<i class="fas fa-pen-alt"></i> <span>تدرب على أسئلة هذا الدرس (' + relatedQuestions.length + ')</span>' +
      '</button>' +
    '</div>';

  sheet.innerHTML = html;

  // تطبيق حجم الخط المختار
  applyReaderFontSize();

  // تحديث تحديد العنصر النشط في الفهرس
  updateActiveTocItem(currentReaderPage);
}

function updateActiveTocItem(pageNum) {
  var items = document.querySelectorAll('.rdr-toc-lesson-item');
  items.forEach(function(it) { it.classList.remove('active'); });

  var target = document.getElementById('toc-item-' + pageNum);
  if (target) {
    target.classList.add('active');
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function readerPrevPage() {
  var book = cachedBooksData[currentReaderSem] || fallbackBooksStore[currentReaderSem];
  if (currentReaderPage > 1) {
    renderReaderPage(currentReaderPage - 1);
  } else {
    toast('أنت في الصفحة الأولى من الكتاب', 'ok');
  }
}
window.readerPrevPage = readerPrevPage;

function readerNextPage() {
  var book = cachedBooksData[currentReaderSem] || fallbackBooksStore[currentReaderSem];
  var max = book ? (book.totalPages || 140) : 140;
  if (currentReaderPage < max) {
    renderReaderPage(currentReaderPage + 1);
  } else {
    toast('وصلت إلى الصفحة الأخيرة من الكتاب', 'ok');
  }
}
window.readerNextPage = readerNextPage;

function readerGoToPage(pageNum) {
  renderReaderPage(pageNum);
}
window.readerGoToPage = readerGoToPage;

function readerGoToInputPage() {
  var inputEl = document.getElementById('rdr-page-input');
  if (inputEl) {
    var val = parseInt(inputEl.value, 10);
    if (!isNaN(val)) {
      renderReaderPage(val);
    }
  }
}
window.readerGoToInputPage = readerGoToInputPage;

function readerSwitchTab(tab) {
  currentReaderTab = tab;
  var btnInteractive = document.getElementById('tab-btn-interactive');
  var btnPdf = document.getElementById('tab-btn-pdf');
  var viewInteractive = document.getElementById('reader-page-view');
  var viewPdf = document.getElementById('reader-pdf-view');

  if (tab === 'interactive') {
    if (btnInteractive) btnInteractive.classList.add('active');
    if (btnPdf) btnPdf.classList.remove('active');
    if (viewInteractive) viewInteractive.style.display = 'block';
    if (viewPdf) viewPdf.style.display = 'none';
  } else {
    if (btnPdf) btnPdf.classList.add('active');
    if (btnInteractive) btnInteractive.classList.remove('active');
    if (viewInteractive) viewInteractive.style.display = 'none';
    if (viewPdf) viewPdf.style.display = 'flex';

    var pdfFrame = document.getElementById('reader-pdf-iframe');
    var expectedSrc = '/api/books/book_sem' + currentReaderSem + '/pdf';
    if (pdfFrame && (!pdfFrame.src || pdfFrame.src.indexOf(expectedSrc) === -1)) {
      pdfFrame.src = expectedSrc;
    }
    var pdfTitle = document.getElementById('pdf-toolbar-title');
    if (pdfTitle) {
      pdfTitle.innerHTML = '<i class="fas fa-file-pdf" style="color:#ef4444;"></i> ' + (currentReaderSem === 1 ? 'كتاب الفصل الأول الرسمي — بصيغة PDF الوزارية' : 'كتاب الفصل الثاني الرسمي — بصيغة PDF الوزارية');
    }
  }
}
window.readerSwitchTab = readerSwitchTab;

function readerToggleSidebar() {
  var sb = document.getElementById('reader-sidebar');
  if (sb) {
    sb.classList.toggle('open');
  }
}
window.readerToggleSidebar = readerToggleSidebar;

function readerFilterLessons(query) {
  var q = (query || '').trim().toLowerCase();
  var items = document.querySelectorAll('.rdr-toc-lesson-item');
  items.forEach(function(it) {
    var text = it.textContent.toLowerCase();
    it.style.display = (text.indexOf(q) !== -1 || !q) ? 'flex' : 'none';
  });
}
window.readerFilterLessons = readerFilterLessons;

function readerAdjustFontSize(delta) {
  readerFontSizeDelta = Math.max(-2, Math.min(8, readerFontSizeDelta + delta));
  applyReaderFontSize();
  toast(delta > 0 ? 'تم تكبير الخط' : 'تم تصغير الخط', 'ok');
}
window.readerAdjustFontSize = readerAdjustFontSize;

function applyReaderFontSize() {
  var sheet = document.getElementById('textbook-sheet');
  if (sheet) {
    var baseSize = 15.5 + readerFontSizeDelta;
    var paras = sheet.querySelectorAll('.tb-paragraph, .tb-highlight-box');
    paras.forEach(function(p){ p.style.fontSize = baseSize + 'px'; });
    var title = sheet.querySelector('.tb-sheet-title');
    if (title) title.style.fontSize = (22 + readerFontSizeDelta) + 'px';
  }
}

function readerToggleFullscreen() {
  var modal = document.querySelector('.reader-modal');
  if (!modal) return;
  if (!document.fullscreenElement) {
    modal.requestFullscreen().catch(function(e){ console.warn(e); });
  } else {
    document.exitFullscreen().catch(function(e){ console.warn(e); });
  }
}
window.readerToggleFullscreen = readerToggleFullscreen;

// القراءة الصوتية لصفحة الكتاب الحالية
function readerSpeakCurrentPage() {
  var ttsBtn = document.getElementById('reader-tts-btn');
  if (readerTtsIsPlaying) {
    if (readerTtsAudio) {
      try { readerTtsAudio.pause(); } catch(e){}
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch(e){}
    }
    readerTtsIsPlaying = false;
    if (ttsBtn) ttsBtn.classList.remove('active');
    toast('تم إيقاف القراءة الصوتية', 'ok');
    return;
  }

  var sheet = document.getElementById('textbook-sheet');
  if (!sheet) return;

  var titleEl = sheet.querySelector('.tb-sheet-title');
  var paras = sheet.querySelectorAll('.tb-paragraph');
  var textParts = [];
  if (titleEl) textParts.push(titleEl.textContent);
  paras.forEach(function(p){ textParts.push(p.textContent); });

  var fullText = textParts.join('. ').substring(0, 1500);
  if (!fullText.trim()) return;

  readerTtsIsPlaying = true;
  if (ttsBtn) ttsBtn.classList.add('active');
  toast('بدء القراءة الصوتية لصفحة الكتاب...', 'ok');

  // استدعاء محرك الـ TTS العربي عالي الجودة
  var ttsUrl = '/api/tts?text=' + encodeURIComponent(fullText.substring(0, 400));
  if (!readerTtsAudio) {
    readerTtsAudio = new Audio();
  }
  readerTtsAudio.src = ttsUrl;
  readerTtsAudio.play().then(function() {
    readerTtsAudio.onended = function() {
      readerTtsIsPlaying = false;
      if (ttsBtn) ttsBtn.classList.remove('active');
    };
  }).catch(function(err) {
    // Fallback to browser SpeechSynthesis
    if ('speechSynthesis' in window) {
      var utter = new SpeechSynthesisUtterance(fullText);
      utter.lang = 'ar';
      utter.rate = 0.95;
      utter.onend = function() {
        readerTtsIsPlaying = false;
        if (ttsBtn) ttsBtn.classList.remove('active');
      };
      window.speechSynthesis.speak(utter);
    } else {
      readerTtsIsPlaying = false;
      if (ttsBtn) ttsBtn.classList.remove('active');
    }
  });
}
window.readerSpeakCurrentPage = readerSpeakCurrentPage;

function promptSetBookDriveUrl(sem) {
  var semName = sem === 1 ? 'الفصل الأول' : 'الفصل الثاني';
  var currentVal = (cachedBooksData && cachedBooksData['book_sem' + sem] && cachedBooksData['book_sem' + sem].driveUrl) ? cachedBooksData['book_sem' + sem].driveUrl : '';
  var newUrl = window.prompt('أدخل رابط Google Drive المباشر لتنزيل كتاب ' + semName + ':\n(تأكد أن إعداد المشاركة في Google Drive هو: أي شخص لديه الرابط يمكنه العرض)', currentVal);
  if (newUrl === null) return;
  newUrl = newUrl.trim();
  fetch('/api/books/book_sem' + sem + '/set-drive-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driveUrl: newUrl })
  }).then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        if (!cachedBooksData['book_sem' + sem]) cachedBooksData['book_sem' + sem] = {};
        cachedBooksData['book_sem' + sem].driveUrl = newUrl;
        toast('تم حفظ وتحديث رابط Google Drive بنجاح!', 'ok');
      } else {
        toast('حدث خطأ أثناء حفظ الرابط: ' + (data.error || 'فشلت العملية'), 'err');
      }
    }).catch(function(err) {
      toast('تعذر الاتصال بالخادم لحفظ الرابط', 'err');
    });
}
window.promptSetBookDriveUrl = promptSetBookDriveUrl;

function openBookDriveUrlSettings() {
  var choice = window.prompt('اختر رقم الفصل لتعيين رابط Google Drive الخاص به:\n1 - كتاب الفصل الأول\n2 - كتاب الفصل الثاني', '1');
  if (choice === '1' || choice === '2') {
    promptSetBookDriveUrl(parseInt(choice, 10));
  }
}
window.openBookDriveUrlSettings = openBookDriveUrlSettings;

function showDosiehUnderConstruction(sem) {
  var semTitle = sem === 2 ? 'الفصل الدراسي الثاني' : 'الفصل الدراسي الأول';
  var titleEl = document.getElementById('construction-modal-title');
  var badgeEl = document.getElementById('construction-modal-badge');
  var bodyEl = document.getElementById('construction-modal-text');
  if (titleEl) {
    titleEl.innerHTML = '<i class="fas fa-book-open" style="color:var(--pr);margin-left:8px;"></i> دوسية الكتاب الرقمية (' + semTitle + ')';
  }
  if (badgeEl) {
    badgeEl.innerHTML = '<i class="fas fa-hourglass-half"></i> قيد الإعداد والتجهيز حالياً (تحت الإنشاء)';
  }
  if (bodyEl) {
    bodyEl.innerHTML =
      '<div style="margin-bottom:8px;">' +
        '<strong style="color:#0f172a;"><i class="fas fa-info-circle" style="color:#0284c7;"></i> تنويه وإشعار للطلبة:</strong>' +
      '</div>' +
      'يجري حالياً العمل على إعداد وتجهيز <strong>«دوسية الكتاب الرقمية الشاملة»</strong> لمادة الثقافة المالية (' + semTitle + ') لتتضمن ملخصات مركزة للمفاهيم والعمليات المالية والقيود المحاسبية ونماذج أسئلة مقترحة، وسوف تُتاح قريباً للتحميل والتصفح.' +
      '<div style="margin-top:10px;font-size:13.5px;color:#0369a1;background:#eef6fc;border-radius:8px;padding:8px 12px;">' +
        '<i class="fas fa-check-circle" style="color:#0284c7;"></i> يمكنك في هذه الأثناء الاستفادة من بنك الأسئلة والتدرب على جميع أسئلة دروس الكتاب مباشرة عبر فهرس الدروس.' +
      '</div>';
  }
  var overlay = document.getElementById('construction-modal-overlay');
  if (overlay) overlay.classList.add('open');
  toast('دوسية الكتاب الرقمية قيد الإنشاء والتجهيز حالياً ⏳', 'info');
}
window.showDosiehUnderConstruction = showDosiehUnderConstruction;

function showAqyemUnderConstruction() {
  var titleEl = document.getElementById('construction-modal-title');
  var badgeEl = document.getElementById('construction-modal-badge');
  var bodyEl = document.getElementById('construction-modal-text');
  if (titleEl) {
    titleEl.innerHTML = 'قسم حل أسئلة «أقيم تعلمي» قيد الإنشاء والتجهيز';
  }
  if (badgeEl) {
    badgeEl.innerHTML = '<i class="fas fa-hourglass-half"></i> يجري العمل على إعدادها وتدقيقها وفق طبعة 2026 المنقحة';
  }
  if (bodyEl) {
    bodyEl.innerHTML =
      '<div style="margin-bottom:8px;">' +
        '<strong style="color:#0f172a;"><i class="fas fa-info-circle" style="color:#0284c7;"></i> تنويه للطلبة الأعزاء:</strong>' +
      '</div>' +
      'يجري حالياً إعداد وتدقيق الإجابات النموذجية والشروحات التفسيرية والسند العلمي والصفحات المعتمدة لجميع أسئلة <strong>«أقيم تعلمي»</strong> واختبارات نهايات الوحدات لكتابي <strong>الفصل الدراسي الأول</strong> و<strong>الفصل الدراسي الثاني</strong> وفق الطبعة المعتمدة رسمياً من المركز الوطني لتطوير المناهج والتقويم (2025/2026).' +
      '<div style="margin-top:10px;font-size:13.5px;color:#0369a1;background:#eef6fc;border-radius:8px;padding:8px 12px;">' +
        '<i class="fas fa-check-circle" style="color:#0284c7;"></i> في هذه الأثناء، يمكنك التدرب على جميع أسئلة المنهاج والتمارين والوزاريات فوراً عبر أقسام: <strong>«اختبار حسب الدرس»</strong> و<strong>«اختبار حسب الوحدة»</strong>.' +
      '</div>';
  }
  var overlay = document.getElementById('construction-modal-overlay');
  if (overlay) {
    overlay.classList.add('open');
  } else {
    showToast('🛠️ قسم حل أسئلة أقيم تعلمي قيد الإنشاء والتجهيز وسيتوفر قريباً');
  }
  toast('قسم حل أسئلة أقيم تعلمي قيد الإنشاء والتجهيز ⏳', 'info');
}
window.showAqyemUnderConstruction = showAqyemUnderConstruction;

function closeConstructionModal(e) {
  if (e && e.target && e.target.id !== 'construction-modal-overlay' && !e.target.closest('.editor-modal-close')) {
    return;
  }
  var overlay = document.getElementById('construction-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}
window.closeConstructionModal = closeConstructionModal;

function closeBookModal(e) {
  if (e && e.target && e.target.id !== 'book-modal-overlay' && !e.target.closest('.editor-modal-close')) {
    return;
  }
  var overlay = document.getElementById('book-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}
window.closeBookModal = closeBookModal;

// ══════════════════════════════════════════════
//  صفحة حل أسئلة أقيم تعلمي (Aqyem Page) — الفصل الأول الـ 78 سؤالاً المعتمدة
// ══════════════════════════════════════════════
var currentAqyemSem = 1; // 1: الفصل الأول (المعتمد 78 سؤالاً), 2: الفصل الثاني
var currentAqyemUnit = 0; // 0: جميع الوحدات, 1, 2, 3
var currentAqyemType = 'all'; // 'all', 'mcq', 'fill', 'essay', 'financial'
var currentAqyemLesson = '';
var currentAqyemSearch = '';
var aqyemSelfStudyMode = false; // وضع التدريب الذاتي (إخفاء الإجابات للاختبار)
var aqyemRevealedMap = {}; // { [qId]: boolean }
var aqyemUserSelectedAnswers = {}; // { [qId]: optionIndex }

var AQYEM_UNIT_NAMES = {
  1: 'الدورة المحاسبية في المؤسسات الخدمية',
  2: 'القوائم المالية والتحليل المالي',
  3: 'القطاع المالي',
  4: 'المؤسسات المالية الدولية: صندوق النقد الدولي والبنك الدولي',
  5: 'الاستدامة المالية',
  6: 'الذكاء الاصطناعي التوليدي في عالَم المال والأعمال',
  7: 'السياسات الاقتصادية وتأثيرها في التنمية والمجتمع'
};

var AQYEM_UNIT_LESSONS = {
  1: [
    'مدخل إلى علم المحاسبة ونشأتها',
    'تسجيل العمليات المالية في دفتر اليومية',
    'الترحيل إلى دفتر الأستاذ وإعداد ميزان المراجعة',
    'اختبار نهاية الوحدة الأولى'
  ],
  2: [
    'قائمة الدخل',
    'قائمة المركز المالي (الميزانية العمومية)',
    'التحليل المالي وأهميته',
    'اختبار نهاية الوحدة الثانية'
  ],
  3: [
    'البنك المركزي الأردني',
    'البنوك التجارية والإسلامية',
    'شركات التأمين والمؤسسات المالية غير المصرفية',
    'اختبار نهاية الوحدة الثالثة'
  ],
  4: [
    'المؤسسات المالية الدولية: نشأتها، وأنواعها',
    'صندوق النقد الدولي',
    'البنك الدولي',
    'اختبار نهاية الوحدة الرابعة'
  ],
  5: [
    'مُقدّمة في الاستدامة المالية',
    'الاستدامة المالية: التحدّيات، والحلول',
    'الاقتصاد الأخضر والاستدامة',
    'اختبار نهاية الوحدة الخامسة'
  ],
  6: [
    'الذكاء الاصطناعي التوليدي',
    'الذكاء الاصطناعي التوليدي وعالَم المال',
    'الذكاء الاصطناعي التوليدي وخصوصية البيانات',
    'الذكاء الاصطناعي التوليدي وأخلاقيات الأعمال',
    'اختبار نهاية الوحدة السادسة'
  ],
  7: [
    'مُقدّمة في السياسات الاقتصادية والسياسة المالية',
    'تأثير السياسة المالية في النشاط الاقتصادي',
    'السياسة النقدية: أدواتها، وتأثيرها في النشاط الاقتصادي',
    'السياسة التجارية والسياسة الصناعية',
    'اختبار نهاية الوحدة السابعة'
  ]
};

function getAqyemUnitSelectOptionsHtml(selectedUnitId) {
  var u = parseInt(selectedUnitId, 10) || 1;
  return (
    '<optgroup label="الفصل الدراسي الأول">' +
      '<option value="1" ' + (u === 1 ? 'selected' : '') + '>الوحدة 1: الدورة المحاسبية في المؤسسات الخدمية</option>' +
      '<option value="2" ' + (u === 2 ? 'selected' : '') + '>الوحدة 2: القوائم المالية والتحليل المالي</option>' +
      '<option value="3" ' + (u === 3 ? 'selected' : '') + '>الوحدة 3: القطاع المالي</option>' +
    '</optgroup>' +
    '<optgroup label="الفصل الدراسي الثاني">' +
      '<option value="4" ' + (u === 4 ? 'selected' : '') + '>الوحدة 4: المؤسسات المالية الدولية (صندوق النقد والبنك الدولي)</option>' +
      '<option value="5" ' + (u === 5 ? 'selected' : '') + '>الوحدة 5: الاستدامة المالية</option>' +
      '<option value="6" ' + (u === 6 ? 'selected' : '') + '>الوحدة 6: الذكاء الاصطناعي التوليدي في عالَم المال والأعمال</option>' +
      '<option value="7" ' + (u === 7 ? 'selected' : '') + '>الوحدة 7: السياسات الاقتصادية وتأثيرها في التنمية والمجتمع</option>' +
    '</optgroup>'
  );
}
window.getAqyemUnitSelectOptionsHtml = getAqyemUnitSelectOptionsHtml;

function onAqyemEditUnitChange() {
  var unitEl = document.getElementById('aqyem-ed-unit');
  var dl = document.getElementById('aqyem-ed-lessons-datalist');
  if (!unitEl) return;
  var uId = parseInt(unitEl.value, 10) || 1;
  var lessons = AQYEM_UNIT_LESSONS[uId] || [];
  if (dl) {
    dl.innerHTML = lessons.map(function(l){ return '<option value="' + esc(l) + '">'; }).join('');
  }
}
window.onAqyemEditUnitChange = onAqyemEditUnitChange;

var _aqyemModsApplied = false;
function applyAqyemLocalMods() {
  var list = (typeof AQYEM_QUESTIONS !== 'undefined' && Array.isArray(AQYEM_QUESTIONS))
    ? AQYEM_QUESTIONS
    : ((typeof window !== 'undefined' && Array.isArray(window.AQYEM_QUESTIONS)) ? window.AQYEM_QUESTIONS : null);
  if (!list) return [];

  if (_aqyemModsApplied) return list;

  try {
    // 1. تطبيق الحذوفات
    var delRaw = localStorage.getItem('aqyem_deletions');
    if (delRaw) {
      var dels = JSON.parse(delRaw);
      if (Array.isArray(dels) && dels.length) {
        list = list.filter(function(q){ return dels.indexOf(q.id) === -1; });
      }
    }
    // 2. تطبيق التعديلات مع التصحيح الذاتي للتصنيف
    var ovRaw = localStorage.getItem('aqyem_overrides');
    if (ovRaw) {
      var ovs = JSON.parse(ovRaw);
      if (ovs && typeof ovs === 'object') {
        var ovChanged = false;
        Object.keys(ovs).forEach(function(k){
          var patch = ovs[k];
          var idNum = parseInt(k, 10);
          if (patch) {
            // معالجة ذاتية لأي سؤال في الفصل الثاني تم حفظ وحدته بالخطأ
            if (idNum === 201 || idNum === 202) {
              patch.sem = 2;
              patch.unitId = 4;
              patch.unitName = AQYEM_UNIT_NAMES[4];
              patch.lesson = 'المؤسسات المالية الدولية: نشأتها، وأنواعها';
              ovChanged = true;
            } else if (idNum >= 201 && idNum <= 409) {
              patch.sem = 2;
              if (!patch.unitId || patch.unitId < 4) {
                if (idNum <= 224) patch.unitId = 4;
                else if (idNum <= 247) patch.unitId = 5;
                else if (idNum <= 277) patch.unitId = 6;
                else patch.unitId = 7;
                patch.unitName = AQYEM_UNIT_NAMES[patch.unitId];
                ovChanged = true;
              }
            }
          }
          var q = list.find(function(item){ return item.id === idNum; });
          if (q && patch) {
            Object.assign(q, patch);
          }
        });
        if (ovChanged) {
          try { localStorage.setItem('aqyem_overrides', JSON.stringify(ovs)); } catch(e){}
        }
      }
    }
    // 3. تطبيق الإضافات
    var addRaw = localStorage.getItem('aqyem_additions');
    if (addRaw) {
      var adds = JSON.parse(addRaw);
      if (Array.isArray(adds) && adds.length) {
        adds.forEach(function(nq){
          if (!list.some(function(item){ return item.id === nq.id; })) {
            list.push(nq);
          }
        });
      }
    }
    if (typeof AQYEM_QUESTIONS !== 'undefined') AQYEM_QUESTIONS = list;
    if (typeof window !== 'undefined') window.AQYEM_QUESTIONS = list;
    _aqyemModsApplied = true;
  } catch(e) {
    console.warn('Failed to apply local aqyem modifications:', e);
  }
  return list;
}

// جلب ومزامنة أسئلة أقيم تعلمي من Firebase سحابياً
async function syncAqyemFromFirestore(silent) {
  try {
    var res = await fetch('/api/aqyem/sync');
    if (!res.ok) {
      console.warn('[Firebase] Aqyem sync returned status:', res.status);
      return;
    }
    var data = await res.json();
    if (data && data.success && Array.isArray(data.questions) && data.questions.length > 0) {
      // تدقيق التصنيف الصحيح لأسئلة الفصل الثاني
      data.questions.forEach(function(q) {
        if (q.id === 201 || q.id === 202) {
          q.sem = 2;
          q.unitId = 4;
          q.unitName = AQYEM_UNIT_NAMES[4];
          q.lesson = 'المؤسسات المالية الدولية: نشأتها، وأنواعها';
        } else if (q.unitId >= 4 && q.unitId <= 7) {
          q.sem = 2;
        }
      });
      window.aqyemQuestionsList = data.questions;
      try {
        localStorage.setItem('aqyem_cache_version', AQYEM_SCHEMA_VERSION);
        localStorage.setItem('aqyem_firestore_cache', JSON.stringify(data.questions));
      } catch(e) {}
      if (!silent) {
        toast('☁️ تمت مزامنة ' + data.questions.length + ' سؤالاً من أسئلة أُقيّم تعلّمي من Firebase بنجاح!', 'ok');
      }
      if (typeof currentPageId !== 'undefined') {
        if (currentPageId === 'aqyem-questions') {
          renderAqyemQuestionsPage();
        } else if (currentPageId === 'aqyem-sem1') {
          renderAqyemSem1Page();
        } else if (currentPageId === 'aqyem-sem2') {
          renderAqyemSem2Page();
        } else if (currentPageId === 'aqyem') {
          renderAqyemHub();
        }
      }
    }
  } catch(err) {
    console.warn('[Firebase] Aqyem sync error:', err);
  }
}
window.syncAqyemFromFirestore = syncAqyemFromFirestore;

async function syncAqyemOverrideToCloud(qId, patch) {
  if (typeof updateCloudBadge === 'function') updateCloudBadge('saving');
  try {
    var payload = Object.assign({}, patch, { id: qId, adminKey: EDITOR_PASSWORD });
    var res = await fetch('/api/aqyem/override', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': EDITOR_PASSWORD
      },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (data && data.success) {
      if (typeof updateCloudBadge === 'function') updateCloudBadge('synced');
      toast('☁️ تم حفظ التعديل ومزامنته سحابياً في Firebase بنجاح!', 'ok');
      return true;
    } else {
      if (typeof updateCloudBadge === 'function') updateCloudBadge('error');
      toast('⚠️ تم الحفظ محلياً (تعذر الحفظ في Firebase)', 'err');
      return false;
    }
  } catch (err) {
    if (typeof updateCloudBadge === 'function') updateCloudBadge('error');
    console.warn('Aqyem cloud override error:', err);
    return false;
  }
}
window.syncAqyemOverrideToCloud = syncAqyemOverrideToCloud;

async function syncAddAqyemQuestionToCloud(newQ) {
  if (typeof updateCloudBadge === 'function') updateCloudBadge('saving');
  try {
    var payload = Object.assign({}, newQ, { adminKey: EDITOR_PASSWORD });
    var res = await fetch('/api/aqyem/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': EDITOR_PASSWORD
      },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (data && data.success) {
      if (typeof updateCloudBadge === 'function') updateCloudBadge('synced');
      toast('☁️ تمت إضافة السؤال وحفظه سحابياً في Firebase بنجاح!', 'ok');
      return true;
    } else {
      if (typeof updateCloudBadge === 'function') updateCloudBadge('error');
      toast('⚠️ تمت الإضافة محلياً (تعذر الحفظ في Firebase)', 'err');
      return false;
    }
  } catch (err) {
    if (typeof updateCloudBadge === 'function') updateCloudBadge('error');
    console.warn('Aqyem cloud add error:', err);
    return false;
  }
}
window.syncAddAqyemQuestionToCloud = syncAddAqyemQuestionToCloud;

async function syncDeleteAqyemQuestionToCloud(qId) {
  if (typeof updateCloudBadge === 'function') updateCloudBadge('saving');
  try {
    var res = await fetch('/api/aqyem/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': EDITOR_PASSWORD
      },
      body: JSON.stringify({ id: qId, adminKey: EDITOR_PASSWORD })
    });
    var data = await res.json();
    if (data && data.success) {
      if (typeof updateCloudBadge === 'function') updateCloudBadge('synced');
      toast('🗑️ تم حذف السؤال نهائياً من Firebase بنجاح!', 'ok');
      return true;
    } else {
      if (typeof updateCloudBadge === 'function') updateCloudBadge('error');
      toast('⚠️ تم الحذف محلياً (تعذر الحذف من Firebase)', 'err');
      return false;
    }
  } catch (err) {
    if (typeof updateCloudBadge === 'function') updateCloudBadge('error');
    console.warn('Aqyem cloud delete error:', err);
    return false;
  }
}
window.syncDeleteAqyemQuestionToCloud = syncDeleteAqyemQuestionToCloud;

var AQYEM_SCHEMA_VERSION = 'v2026_exact_pdf';

function normalizeLessonTitle(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\u064B-\u065F]/g, '') // إزالة التشكيل
    .replace(/[،,:\-–—\s]+/g, ' ') // توحيد الفواصل والمسافات
    .replace(/[إأآا]/g, 'ا') // توحيد الهمزات
    .replace(/ة/g, 'ه') // توحيد التاء المربوطة
    .replace(/ى/g, 'ي') // توحيد الألف المقصورة
    .trim();
}
window.normalizeLessonTitle = normalizeLessonTitle;

function getAqyemDataset() {
  var list = null;
  // التحقق من توافق إصدار البيانات وتطهير الكاش القديم إن وجد
  try {
    if (localStorage.getItem('aqyem_cache_version') !== AQYEM_SCHEMA_VERSION) {
      localStorage.removeItem('aqyem_firestore_cache');
      localStorage.setItem('aqyem_cache_version', AQYEM_SCHEMA_VERSION);
      window.aqyemQuestionsList = null;
    }
  } catch(e) {}

  if (window.aqyemQuestionsList && Array.isArray(window.aqyemQuestionsList) && window.aqyemQuestionsList.length > 0) {
    list = window.aqyemQuestionsList;
  } else {
    try {
      var cached = localStorage.getItem('aqyem_firestore_cache');
      if (cached) {
        var parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          window.aqyemQuestionsList = parsed;
          list = parsed;
        }
      }
    } catch(e) {}
  }

  if (!list) {
    list = applyAqyemLocalMods();
  }

  // تطبيق التعديلات المحلية فوق القائمة وضمان صحة تصنيف أسئلة الفصلين
  try {
    var ovRaw = localStorage.getItem('aqyem_overrides');
    if (ovRaw) {
      var ovs = JSON.parse(ovRaw);
      if (ovs && typeof ovs === 'object') {
        Object.keys(ovs).forEach(function(k){
          var patch = ovs[k];
          var idNum = parseInt(k, 10);
          var q = list.find(function(item){ return item.id === idNum; });
          if (q && patch) {
            Object.assign(q, patch);
          }
        });
      }
    }
  } catch(e) {}

  // فحص سلامة تصنيف الأسئلة للفصل الدراسي الثاني
  list.forEach(function(q) {
    if (q.id === 201 || q.id === 202) {
      q.sem = 2;
      q.unitId = 4;
      q.unitName = AQYEM_UNIT_NAMES[4];
      q.lesson = 'المؤسسات المالية الدولية: نشأتها، وأنواعها';
    } else if (q.unitId >= 4 && q.unitId <= 7) {
      q.sem = 2;
      if (!q.unitName) q.unitName = AQYEM_UNIT_NAMES[q.unitId] || ('الوحدة ' + q.unitId);
    } else if (q.id >= 201 && q.id <= 409) {
      q.sem = 2;
      if (!q.unitId || q.unitId < 4) {
        if (q.id <= 224) q.unitId = 4;
        else if (q.id <= 247) q.unitId = 5;
        else if (q.id <= 277) q.unitId = 6;
        else q.unitId = 7;
      }
      q.unitName = AQYEM_UNIT_NAMES[q.unitId] || ('الوحدة ' + q.unitId);
    }
  });

  return list;
}

function openAqyemFiltered(sem, lesson) {
  currentAqyemSem = (sem === 2) ? 2 : 1;
  currentAqyemType = 'all';
  currentAqyemSearch = '';
  if (lesson) {
    currentAqyemLesson = lesson;
    currentAqyemUnit = 0;
    var all = getAqyemDataset();
    var normL = normalizeLessonTitle(lesson);
    var match = all.find(function(q){ 
      return q.lesson === lesson || normalizeLessonTitle(q.lesson) === normL; 
    });
    if (match) currentAqyemUnit = match.unitId;
    goTo('aqyem-questions');
  } else {
    currentAqyemLesson = '';
    currentAqyemUnit = 0;
    goTo('aqyem');
  }
}
window.openAqyemFiltered = openAqyemFiltered;

function openAqyemQuestions(options) {
  options = options || {};
  currentAqyemSem = (options.sem === 2) ? 2 : 1;
  currentAqyemUnit = (options.unitId !== undefined) ? options.unitId : 0;
  currentAqyemLesson = options.lesson || '';
  currentAqyemType = options.type || 'all';
  currentAqyemSearch = '';
  goTo('aqyem-questions');
}
window.openAqyemQuestions = openAqyemQuestions;

function openAqyemSem1() {
  currentAqyemSem = 1;
  goTo('aqyem-sem1');
}
window.openAqyemSem1 = openAqyemSem1;

function openAqyemSem2() {
  currentAqyemSem = 2;
  goTo('aqyem-sem2');
}
window.openAqyemSem2 = openAqyemSem2;

function setAqyemTwoOptions(isTraining) {
  aqyemSelfStudyMode = !!isTraining;
  if (!aqyemSelfStudyMode) {
    aqyemRevealedMap = {};
  }
  renderAqyemQuestionsPage();
}
window.setAqyemTwoOptions = setAqyemTwoOptions;

function goBackToAqyemHub() {
  goTo('aqyem');
}
window.goBackToAqyemHub = goBackToAqyemHub;

// ══════════════════════════════════════════════
//  صفحة اختيار الفصل لأقيم تعلمي (Aqyem Hub Page)
// ══════════════════════════════════════════════
function renderAqyemHub() {
  var inner = document.getElementById('aqyem-inner');
  if (!inner) return;

  var html =
    '<div class="page-title"><i class="fas fa-clipboard-check" style="color:#0f766e;"></i> حل أسئلة «أُقيّم تعلّمي»</div>' +
    '<div class="aqyem-sem-select-container">' +
      '<div class="aqyem-sem-title"><i class="fas fa-calendar-alt" style="color:#0f766e;"></i> اختر الفصل</div>' +
      '<div class="aqyem-sem-grid">' +
        // بطاقة الفصل الأول
        '<div class="aqyem-sem-card sem1-card" onclick="openAqyemSem1()">' +
          '<div class="aqyem-sem-icon-wrap"><i class="fas fa-book-bookmark"></i></div>' +
          '<div class="aqyem-sem-name">الفصل الأول</div>' +
          '<div class="aqyem-sem-desc">الوحدات 1، 2، 3 • فهرس الدروس واستعراض أسئلة أُقيّم تعلّمي بالكامل</div>' +
          '<span class="aqyem-sem-btn-pill"><i class="fas fa-arrow-left"></i> دخول الفصل الأول</span>' +
        '</div>' +
        // بطاقة الفصل الثاني
        '<div class="aqyem-sem-card sem2-card" onclick="openAqyemSem2()">' +
          '<div class="aqyem-sem-icon-wrap"><i class="fas fa-book-open-reader"></i></div>' +
          '<div class="aqyem-sem-name">الفصل الثاني</div>' +
          '<div class="aqyem-sem-desc">الوحدات 4، 5، 6، 7 • فهرس الدروس واستعراض أسئلة أُقيّم تعلّمي بالكامل</div>' +
          '<span class="aqyem-sem-btn-pill"><i class="fas fa-arrow-left"></i> دخول الفصل الثاني</span>' +
        '</div>' +
      '</div>' +
    '</div>';

  inner.innerHTML = html;
}
window.renderAqyemHub = renderAqyemHub;
window.renderAqyemPage = renderAqyemHub; // توافق خلفي

// ══════════════════════════════════════════════
//  صفحة فهرس دروس وأسئلة الفصل الأول (Semester 1 Index)
// ══════════════════════════════════════════════
function renderAqyemSem1Page() {
  var inner = document.getElementById('aqyem-sem1-inner');
  if (!inner) return;

  var allAqyem = getAqyemDataset();
  var sem1Questions = allAqyem.filter(function(q){ return q.sem === 1; });

  var u1List = sem1Questions.filter(function(q){ return q.unitId === 1; });
  var u2List = sem1Questions.filter(function(q){ return q.unitId === 2; });
  var u3List = sem1Questions.filter(function(q){ return q.unitId === 3; });

  function getUnitLessons(unitList, uId) {
    var map = {};
    var curUnits = (CUR && CUR[1] && CUR[1].units) ? CUR[1].units : [];
    var targetUnit = curUnits.find(function(u){ return u.id === uId; });
    if (targetUnit && Array.isArray(targetUnit.lessons)) {
      targetUnit.lessons.forEach(function(lName){
        map[lName] = true;
      });
    }
    unitList.forEach(function(q){
      if (q.lesson && !q.isUnitExam && q.lesson.indexOf('اختبار نهاية الوحدة') === -1) {
        var norm = normalizeLessonTitle(q.lesson);
        var canonical = Object.keys(map).find(function(k){ return normalizeLessonTitle(k) === norm; });
        if (!canonical) {
          map[q.lesson] = true;
        }
      }
    });
    return Object.keys(map).map(function(k){
      return { name: k };
    });
  }

  function getUnitExamQuestions(unitList) {
    return unitList.filter(function(q){
      return q.isUnitExam || (q.lesson && q.lesson.indexOf('اختبار نهاية الوحدة') !== -1);
    });
  }

  var u1Lessons = getUnitLessons(u1List, 1);
  var u2Lessons = getUnitLessons(u2List, 2);
  var u3Lessons = getUnitLessons(u3List, 3);

  var html =
    '<div class="aqyem-back-bar">' +
      '<button type="button" class="btn-back-aqyem-hub" onclick="goTo(\'aqyem\')">' +
        '<i class="fas fa-arrow-right"></i>' +
        '<span>العودة لاختيار الفصل</span>' +
      '</button>' +
      '<div class="aqyem-view-info">' +
        '<span class="aqyem-view-tag"><i class="fas fa-book-bookmark"></i> الفصل الدراسي الأول</span>' +
      '</div>' +
      (editorMode ? (
        '<button type="button" class="btn-add-q aqyem-top-add-btn" style="margin-right:auto;" onclick="openAddAqyemQuestion(1, \'\')">' +
          '<i class="fas fa-plus-circle"></i> إضافة سؤال جديد إلى أُقيّم تعلّمي' +
        '</button>'
      ) : '') +
    '</div>' +
    '<div class="page-title"><i class="fas fa-book-bookmark" style="color:#0f766e;"></i> فهرس دروس وأسئلة «أُقيّم تعلّمي» — الفصل الأول</div>' +
    '<div class="aqyem-hub-units-grid">';

  function renderUnitSection(uId, uTitle, uLessons, iconClass, examLessonName, examSubtitle) {
    var uList = (uId === 1 ? u1List : (uId === 2 ? u2List : u3List));
    var examList = getUnitExamQuestions(uList);
    var examCount = examList.length;

    var uHtml =
      '<div class="aqyem-hub-unit-card">' +
        '<div class="aqyem-hub-unit-head">' +
          '<div class="aqyem-hub-unit-title">' +
            '<span class="aqyem-hub-unit-num"><i class="fas ' + iconClass + '"></i> الوحدة ' + uId + '</span>' +
            '<span>' + esc(uTitle) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="aqyem-hub-lessons-list">';

    uLessons.forEach(function(les) {
      var normLes = normalizeLessonTitle(les.name);
      var lesCount = uList.filter(function(q){
        if (q.isUnitExam || (q.lesson && q.lesson.indexOf('اختبار نهاية الوحدة') !== -1)) return false;
        return q.lesson === les.name || normalizeLessonTitle(q.lesson) === normLes;
      }).length;

      uHtml +=
        '<div class="aqyem-hub-lesson-row" onclick="openAqyemQuestions({ sem:1, unitId:' + uId + ', lesson:\'' + esc(les.name).replace(/'/g, "\\'") + '\', type:\'all\' })" title="انقر لعرض وحل أسئلة أُقيّم تعلّمي لهذا الدرس">' +
          '<div class="aqyem-hub-lesson-name">' +
            '<span class="aqyem-lesson-icon-badge" title="أُقيّم تعلّمي"><i class="fas fa-clipboard-check"></i></span>' +
            '<span class="aqyem-lesson-title-text">' + esc(les.name) + '</span>' +
            (lesCount > 0 ? '<span class="aqyem-lesson-count-tag"><i class="fas fa-check-circle"></i> ' + lesCount + ' أسئلة أُقيّم تعلّمي</span>' : '<span class="aqyem-lesson-count-tag aqyem-lesson-empty-tag">أسئلة أُقيّم تعلّمي</span>') +
          '</div>' +
          '<div class="aqyem-hub-lesson-actions">' +
            '<button type="button" class="aqyem-hub-open-lesson-btn" onclick="event.stopPropagation(); openAqyemQuestions({ sem:1, unitId:' + uId + ', lesson:\'' + esc(les.name).replace(/'/g, "\\'") + '\', type:\'all\' })" title="عرض أسئلة أُقيّم تعلّمي لهذا الدرس">' +
              '<i class="fas fa-clipboard-check"></i> <span>عرض أسئلة أُقيّم تعلّمي</span> <i class="fas fa-arrow-left"></i>' +
            '</button>' +
          '</div>' +
        '</div>';
    });

    uHtml += '</div>'; // نهاية aqyem-hub-lessons-list

    // بطاقة أسئلة نهاية الوحدة (اختبار نهاية الوحدة)
    uHtml +=
        '<div class="aqyem-unit-footer-card">' +
          '<div class="aqyem-unit-footer-main">' +
            '<div class="aqyem-unit-footer-icon"><i class="fas fa-award"></i></div>' +
            '<div class="aqyem-unit-footer-info">' +
              '<div class="aqyem-unit-footer-head">' +
                '<span class="aqyem-unit-footer-title">أسئلة الوحدة ' + uId + ' (' + esc(examLessonName) + ')</span>' +
                '<span class="aqyem-unit-exam-badge"><i class="fas fa-check-double"></i> ' + examCount + ' سؤالاً معتمداً</span>' +
              '</div>' +
              '<div class="aqyem-unit-footer-desc">' + esc(examSubtitle) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="aqyem-unit-footer-actions">' +
            '<button type="button" class="aqyem-unit-footer-btn" onclick="openAqyemQuestions({ sem:1, unitId:' + uId + ', lesson:\'' + esc(examLessonName).replace(/'/g, "\\'") + '\', type:\'all\' })">' +
              '<i class="fas fa-clipboard-list"></i> <span>عرض أسئلة الوحدة ' + uId + '</span> <i class="fas fa-arrow-left"></i>' +
            '</button>' +
            '<button type="button" class="aqyem-unit-secondary-btn" onclick="openAqyemQuestions({ sem:1, unitId:' + uId + ', lesson:\'\', type:\'all\' })" title="عرض كافة أسئلة دروس واختبار الوحدة معاً">' +
              '<i class="fas fa-layer-group"></i> <span>جميع أسئلة الوحدة (' + uList.length + ')</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    return uHtml;
  }

  html += renderUnitSection(1, 'الدورة المحاسبية في المؤسسات الخدمية', u1Lessons, 'fa-calculator', 'اختبار نهاية الوحدة الأولى', 'تشمل أسئلة ميزان المراجعة، تسجيل قيود اليومية، وترحيل الأستاذ، بالإضافة لأسئلة اختيار من متعدد.');
  html += renderUnitSection(2, 'القوائم المالية والتحليل المالي', u2Lessons, 'fa-file-invoice-dollar', 'اختبار نهاية الوحدة الثانية', 'تشمل إعداد قائمة الدخل، قائمة المركز المالي، قيود الإقفال، والنسب المالية، بالإضافة لأسئلة اختيار من متعدد.');
  html += renderUnitSection(3, 'القطاع المالي', u3Lessons, 'fa-landmark', 'اختبار نهاية الوحدة الثالثة', 'تشمل أدوات السياسة النقدية، أسواق رأس المال، شركات الصرافة والبنك المركزي، بالإضافة لأسئلة اختيار من متعدد.');

  html += '</div>'; // نهاية aqyem-hub-units-grid

  // الأيقونات الخمس في أسفل الفهرس
  html +=
    '<div class="aqyem-bottom-modes-section">' +
      '<div class="aqyem-bottom-modes-title">' +
        '<i class="fas fa-layer-group" style="color:#0f766e;"></i>' +
        '<span>استعراض شامل لأسئلة «أُقيّم تعلّمي» حسب النمط:</span>' +
      '</div>' +
      '<div class="aqyem-bottom-modes-grid">' +
        '<div class="aqyem-mode-card mode-all" onclick="openAqyemQuestions({ sem:1, unitId:0, lesson:\'\', type:\'all\' })">' +
          '<div class="aqyem-mode-icon"><i class="fas fa-layer-group"></i></div>' +
          '<div class="aqyem-mode-text">استعراض كافة أسئلة أُقيّم تعلّمي</div>' +
        '</div>' +
        '<div class="aqyem-mode-card mode-mcq" onclick="openAqyemQuestions({ sem:1, unitId:0, lesson:\'\', type:\'mcq\' })">' +
          '<div class="aqyem-mode-icon"><i class="fas fa-list-ul"></i></div>' +
          '<div class="aqyem-mode-text">استعراض كافة أسئلة اختيار من متعدد</div>' +
        '</div>' +
        '<div class="aqyem-mode-card mode-fill" onclick="openAqyemQuestions({ sem:1, unitId:0, lesson:\'\', type:\'fill\' })">' +
          '<div class="aqyem-mode-icon"><i class="fas fa-pen-nib"></i></div>' +
          '<div class="aqyem-mode-text">استعرض كافة أسئلة املأ الفراغ</div>' +
        '</div>' +
        '<div class="aqyem-mode-card mode-essay" onclick="openAqyemQuestions({ sem:1, unitId:0, lesson:\'\', type:\'essay\' })">' +
          '<div class="aqyem-mode-icon"><i class="fas fa-align-right"></i></div>' +
          '<div class="aqyem-mode-text">استعرض كافة الأسئلة المقالية والتفسيرات</div>' +
        '</div>' +
        '<div class="aqyem-mode-card mode-financial" onclick="openAqyemQuestions({ sem:1, unitId:0, lesson:\'\', type:\'financial\' })">' +
          '<div class="aqyem-mode-icon"><i class="fas fa-calculator"></i></div>' +
          '<div class="aqyem-mode-text">استعرض كافة أسئلة المسائل والقوائم</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  inner.innerHTML = html;
}
window.renderAqyemSem1Page = renderAqyemSem1Page;

// ══════════════════════════════════════════════
//  صفحة فهرس دروس وأسئلة الفصل الثاني (Semester 2 Index)
// ══════════════════════════════════════════════
function renderAqyemSem2Page() {
  var inner = document.getElementById('aqyem-sem2-inner');
  if (!inner) return;

  var allAqyem = getAqyemDataset();
  var sem2Questions = allAqyem.filter(function(q){ return q.sem === 2; });

  var u4List = sem2Questions.filter(function(q){ return q.unitId === 4; });
  var u5List = sem2Questions.filter(function(q){ return q.unitId === 5; });
  var u6List = sem2Questions.filter(function(q){ return q.unitId === 6; });
  var u7List = sem2Questions.filter(function(q){ return q.unitId === 7; });

  function getUnitLessons(unitList, uId) {
    var map = {};
    var curUnits = (CUR && CUR[2] && CUR[2].units) ? CUR[2].units : [];
    var targetUnit = curUnits.find(function(u){ return u.id === uId; });
    if (targetUnit && Array.isArray(targetUnit.lessons)) {
      targetUnit.lessons.forEach(function(lName){
        map[lName] = true;
      });
    }
    unitList.forEach(function(q){
      if (q.lesson && !q.isUnitExam && q.lesson.indexOf('اختبار نهاية الوحدة') === -1) {
        var norm = normalizeLessonTitle(q.lesson);
        var canonical = Object.keys(map).find(function(k){ return normalizeLessonTitle(k) === norm; });
        if (!canonical) {
          map[q.lesson] = true;
        }
      }
    });
    return Object.keys(map).map(function(k){
      return { name: k };
    });
  }

  var u4Lessons = getUnitLessons(u4List, 4);
  var u5Lessons = getUnitLessons(u5List, 5);
  var u6Lessons = getUnitLessons(u6List, 6);
  var u7Lessons = getUnitLessons(u7List, 7);

  var html =
    '<div class="aqyem-back-bar">' +
      '<button type="button" class="btn-back-aqyem-hub" onclick="goTo(\'aqyem\')">' +
        '<i class="fas fa-arrow-right"></i>' +
        '<span>العودة لاختيار الفصل</span>' +
      '</button>' +
      '<div class="aqyem-view-info">' +
        '<span class="aqyem-view-tag" style="background:#ecfdf5;color:#047857;border-color:#a7f3d0;"><i class="fas fa-book-bookmark"></i> الفصل الدراسي الثاني</span>' +
      '</div>' +
      (editorMode ? (
        '<button type="button" class="btn-add-q aqyem-top-add-btn" style="margin-right:auto;" onclick="openAddAqyemQuestion(4, \'\')">' +
          '<i class="fas fa-plus-circle"></i> إضافة سؤال جديد إلى أُقيّم تعلّمي' +
        '</button>'
      ) : '') +
    '</div>' +
    '<div class="page-title"><i class="fas fa-book-bookmark" style="color:#047857;"></i> فهرس دروس وأسئلة «أُقيّم تعلّمي» — الفصل الثاني</div>' +
    '<div class="aqyem-hub-units-grid">';

  function renderUnitSection(uId, uTitle, uLessons, iconClass, examLessonName, examSubtitle) {
    var uList = (uId === 4 ? u4List : (uId === 5 ? u5List : (uId === 6 ? u6List : u7List)));
    var examList = uList.filter(function(q){
      return q.isUnitExam || (q.lesson && q.lesson.indexOf('اختبار نهاية الوحدة') !== -1);
    });
    var examCount = examList.length;

    var uHtml =
      '<div class="aqyem-hub-unit-card">' +
        '<div class="aqyem-hub-unit-head">' +
          '<div class="aqyem-hub-unit-title">' +
            '<span class="aqyem-hub-unit-num" style="background:#ecfdf5;color:#047857;border-color:#a7f3d0;"><i class="fas ' + iconClass + '"></i> الوحدة ' + uId + '</span>' +
            '<span>' + esc(uTitle) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="aqyem-hub-lessons-list">';

    uLessons.forEach(function(les) {
      var normLes = normalizeLessonTitle(les.name);
      var lesCount = uList.filter(function(q){
        if (q.isUnitExam || (q.lesson && q.lesson.indexOf('اختبار نهاية الوحدة') !== -1)) return false;
        return q.lesson === les.name || normalizeLessonTitle(q.lesson) === normLes;
      }).length;

      uHtml +=
        '<div class="aqyem-hub-lesson-row" onclick="openAqyemQuestions({ sem:2, unitId:' + uId + ', lesson:\'' + esc(les.name).replace(/'/g, "\\'") + '\', type:\'all\' })" title="انقر لعرض وحل أسئلة أُقيّم تعلّمي لهذا الدرس">' +
          '<div class="aqyem-hub-lesson-name">' +
            '<span class="aqyem-lesson-icon-badge" style="background:#ecfdf5;color:#047857;" title="أُقيّم تعلّمي"><i class="fas fa-clipboard-check"></i></span>' +
            '<span class="aqyem-lesson-title-text">' + esc(les.name) + '</span>' +
            (lesCount > 0 ? '<span class="aqyem-lesson-count-tag" style="background:#ecfdf5;color:#047857;border-color:#a7f3d0;"><i class="fas fa-check-circle"></i> ' + lesCount + ' أسئلة أُقيّم تعلّمي</span>' : '<span class="aqyem-lesson-count-tag aqyem-lesson-empty-tag">أسئلة أُقيّم تعلّمي</span>') +
          '</div>' +
          '<div class="aqyem-hub-lesson-actions">' +
            '<button type="button" class="aqyem-hub-open-lesson-btn" onclick="event.stopPropagation(); openAqyemQuestions({ sem:2, unitId:' + uId + ', lesson:\'' + esc(les.name).replace(/'/g, "\\'") + '\', type:\'all\' })" title="عرض أسئلة أُقيّم تعلّمي لهذا الدرس">' +
              '<i class="fas fa-clipboard-check"></i> <span>عرض أسئلة أُقيّم تعلّمي</span> <i class="fas fa-arrow-left"></i>' +
            '</button>' +
          '</div>' +
        '</div>';
    });

    uHtml += '</div>'; // نهاية aqyem-hub-lessons-list

    // بطاقة أسئلة نهاية الوحدة (اختبار نهاية الوحدة)
    uHtml +=
        '<div class="aqyem-unit-footer-card" style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border-color:#86efac;">' +
          '<div class="aqyem-unit-footer-main">' +
            '<div class="aqyem-unit-footer-icon" style="background:#ecfdf5;color:#047857;border-color:#a7f3d0;"><i class="fas fa-award"></i></div>' +
            '<div class="aqyem-unit-footer-info">' +
              '<div class="aqyem-unit-footer-head">' +
                '<span class="aqyem-unit-footer-title">أسئلة الوحدة ' + uId + ' (' + esc(examLessonName) + ')</span>' +
                '<span class="aqyem-unit-exam-badge" style="background:#ecfdf5;color:#047857;border-color:#a7f3d0;"><i class="fas fa-check-double"></i> ' + examCount + ' سؤالاً معتمداً</span>' +
              '</div>' +
              '<div class="aqyem-unit-footer-desc">' + esc(examSubtitle) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="aqyem-unit-footer-actions">' +
            '<button type="button" class="aqyem-unit-footer-btn" style="background:#047857;" onclick="openAqyemQuestions({ sem:2, unitId:' + uId + ', lesson:\'' + esc(examLessonName).replace(/'/g, "\\'") + '\', type:\'all\' })">' +
              '<i class="fas fa-clipboard-list"></i> <span>عرض أسئلة الوحدة ' + uId + '</span> <i class="fas fa-arrow-left"></i>' +
            '</button>' +
            '<button type="button" class="aqyem-unit-secondary-btn" onclick="openAqyemQuestions({ sem:2, unitId:' + uId + ', lesson:\'\', type:\'all\' })" title="عرض كافة أسئلة دروس واختبار الوحدة معاً">' +
              '<i class="fas fa-layer-group"></i> <span>جميع أسئلة الوحدة (' + uList.length + ')</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    return uHtml;
  }

  html += renderUnitSection(4, 'المؤسسات المالية الدولية: صندوق النقد الدولي والبنك الدولي', u4Lessons, 'fa-globe', 'اختبار نهاية الوحدة الرابعة', 'تشمل نشأة وتطور المؤسسات المالية الدولية، مهام صندوق النقد الدولي، ومجموعة البنك الدولي للإنشاء والتعمير.');
  html += renderUnitSection(5, 'الاستدامة المالية', u5Lessons, 'fa-leaf', 'اختبار نهاية الوحدة الخامسة', 'تشمل مفاهيم الاستدامة المالية وأهميتها، التحديات والحلول، الاقتصاد الأخضر، وإصدارات السندات الخضراء.');
  html += renderUnitSection(6, 'الذكاء الاصطناعي التوليدي في عالَم المال والأعمال', u6Lessons, 'fa-robot', 'اختبار نهاية الوحدة السادسة', 'تشمل أساسيات الذكاء الاصطناعي التوليدي، تطبيقاته في التحليل والتداول، خصوصية وحماية البيانات، وأخلاقيات الأعمال.');
  html += renderUnitSection(7, 'السياسات الاقتصادية وتأثيرها في التنمية والمجتمع', u7Lessons, 'fa-chart-line', 'اختبار نهاية الوحدة السابعة', 'تشمل السياسة المالية والإنفاق والضرائب، أدوات السياسة النقدية للبنك المركزي، والسياسة التجارية والصناعية.');

  html += '</div>'; // نهاية aqyem-hub-units-grid

  // الأيقونات في أسفل الفهرس
  html +=
    '<div class="aqyem-bottom-modes-section">' +
      '<div class="aqyem-bottom-modes-title">' +
        '<i class="fas fa-layer-group" style="color:#047857;"></i>' +
        '<span>استعراض شامل لأسئلة «أُقيّم تعلّمي» للفصل الثاني:</span>' +
      '</div>' +
      '<div class="aqyem-bottom-modes-grid">' +
        '<div class="aqyem-mode-card mode-all" onclick="openAqyemQuestions({ sem:2, unitId:0, lesson:\'\', type:\'all\' })">' +
          '<div class="aqyem-mode-icon" style="color:#047857;"><i class="fas fa-layer-group"></i></div>' +
          '<div class="aqyem-mode-text">استعراض كافة أسئلة أُقيّم تعلّمي (' + sem2Questions.length + ')</div>' +
        '</div>' +
        '<div class="aqyem-mode-card mode-mcq" onclick="openAqyemQuestions({ sem:2, unitId:0, lesson:\'\', type:\'mcq\' })">' +
          '<div class="aqyem-mode-icon" style="color:#047857;"><i class="fas fa-list-ul"></i></div>' +
          '<div class="aqyem-mode-text">استعراض كافة أسئلة اختيار من متعدد</div>' +
        '</div>' +
        '<div class="aqyem-mode-card mode-fill" onclick="openAqyemQuestions({ sem:2, unitId:0, lesson:\'\', type:\'fill\' })">' +
          '<div class="aqyem-mode-icon" style="color:#047857;"><i class="fas fa-pen-nib"></i></div>' +
          '<div class="aqyem-mode-text">استعراض أسئلة املأ الفراغ والمفاهيم</div>' +
        '</div>' +
        '<div class="aqyem-mode-card mode-essay" onclick="openAqyemQuestions({ sem:2, unitId:0, lesson:\'\', type:\'essay\' })">' +
          '<div class="aqyem-mode-icon" style="color:#047857;"><i class="fas fa-align-right"></i></div>' +
          '<div class="aqyem-mode-text">استعراض الأسئلة المقالية والتحليلية</div>' +
        '</div>' +
        '<div class="aqyem-mode-card mode-financial" onclick="openAqyemQuestions({ sem:2, unitId:0, lesson:\'\', type:\'financial\' })">' +
          '<div class="aqyem-mode-icon" style="color:#047857;"><i class="fas fa-calculator"></i></div>' +
          '<div class="aqyem-mode-text">استعراض المسائل والسياسات التطبيقية</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  inner.innerHTML = html;
}
window.renderAqyemSem2Page = renderAqyemSem2Page;

// ══════════════════════════════════════════════
//  صفحة عرض أسئلة أقيم تعلمي المنفصلة (Questions Page)
// ══════════════════════════════════════════════
function renderAqyemQuestionsPage() {
  var inner = document.getElementById('aqyem-questions-inner');
  if (!inner) return;

  var allAqyem = getAqyemDataset();

  // تصفية الأسئلة
  var pool = allAqyem.filter(function(q) {
    if (q.sem !== currentAqyemSem) return false;
    if (currentAqyemUnit > 0 && q.unitId !== currentAqyemUnit) return false;
    if (currentAqyemType !== 'all' && q.type !== currentAqyemType) return false;
    if (currentAqyemLesson) {
      var normQ = normalizeLessonTitle(q.lesson);
      var normCurr = normalizeLessonTitle(currentAqyemLesson);
      if (q.lesson !== currentAqyemLesson && normQ !== normCurr) {
        return false;
      }
    }
    return true;
  });

  // تحديد عنوان السياق الحالي
  var viewTitle = 'كافة أسئلة أُقيّم تعلّمي (' + (currentAqyemSem === 2 ? 'الفصل الثاني' : 'الفصل الأول') + ')';
  if (currentAqyemType === 'mcq') {
    viewTitle = 'كافة أسئلة اختيار من متعدد';
  } else if (currentAqyemType === 'fill') {
    viewTitle = 'كافة أسئلة املأ الفراغ';
  } else if (currentAqyemType === 'essay') {
    viewTitle = 'كافة الأسئلة المقالية والتفسيرات';
  } else if (currentAqyemType === 'financial') {
    viewTitle = 'كافة أسئلة المسائل والقوائم';
  }

  if (currentAqyemLesson) {
    if (currentAqyemLesson.indexOf('اختبار نهاية الوحدة') !== -1) {
      viewTitle = 'أسئلة الوحدة ' + (currentAqyemUnit > 0 ? currentAqyemUnit : '') + ' (' + currentAqyemLesson + ')';
    } else {
      viewTitle = 'درس: ' + currentAqyemLesson;
    }
  } else if (currentAqyemUnit > 0) {
    var curUnits = (CUR && CUR[currentAqyemSem] && CUR[currentAqyemSem].units) ? CUR[currentAqyemSem].units : [];
    var uObj = curUnits.find(function(u){ return u.id === currentAqyemUnit; });
    viewTitle = 'كافة أسئلة الوحدة ' + currentAqyemUnit + (uObj ? (': ' + uObj.name) : '');
  }

  var html =
    // شريط الرجوع البارز في أعلى الصفحة مع العودة لفهرس الفصل المناسب
    '<div class="aqyem-back-bar">' +
      '<button type="button" class="btn-back-aqyem-hub" onclick="goTo(\'' + (currentAqyemSem === 2 ? 'aqyem-sem2' : 'aqyem-sem1') + '\')">' +
        '<i class="fas fa-arrow-right"></i>' +
        '<span>العودة إلى فهرس دروس ' + (currentAqyemSem === 2 ? 'الفصل الثاني' : 'الفصل الأول') + '</span>' +
      '</button>' +
      '<div class="aqyem-view-info">' +
        '<span class="aqyem-view-tag"><i class="fas fa-book-open"></i> ' + esc(viewTitle) + '</span>' +
        '<span class="aqyem-view-count"><i class="fas fa-layer-group"></i> ' + pool.length + ' سؤالاً معروضاً</span>' +
      '</div>' +
      (editorMode ? (
        '<button type="button" class="btn-add-q aqyem-top-add-btn" onclick="openAddAqyemQuestion(currentAqyemUnit, currentAqyemLesson)">' +
          '<i class="fas fa-plus-circle"></i> إضافة سؤال جديد لهذا القسم' +
        '</button>'
      ) : '') +
    '</div>' +

    // شريط الخيارين الحصريين (التدريب الذاتي أو إظهار الإجابات)
    '<div class="aqyem-two-options-container">' +
      '<button type="button" class="aqyem-two-opt-btn opt-training ' + (aqyemSelfStudyMode ? 'active' : '') + '" onclick="setAqyemTwoOptions(true)">' +
        '<i class="fas fa-user-graduate"></i>' +
        '<span>تفعيل وضع التدريب الذاتي (إخفاء الإجابات)</span>' +
      '</button>' +
      '<button type="button" class="aqyem-two-opt-btn opt-reveal ' + (!aqyemSelfStudyMode ? 'active' : '') + '" onclick="setAqyemTwoOptions(false)">' +
        '<i class="fas fa-eye"></i>' +
        '<span>إظهار الإجابات</span>' +
      '</button>' +
    '</div>';

  if (pool.length === 0) {
    html += '<div class="no-data-box" style="margin-top:16px;">' +
      '<i class="fas fa-search-minus"></i>' +
      '<p>لا توجد أسئلة مطابقة لخيارات البحث أو التصفية الحالية</p>' +
      '<button type="button" class="btn-change" onclick="resetAqyemFilters()" style="margin-top:10px;padding:8px 18px;font-size:14px;border-radius:9px;">إعادة ضبط خيارات التصفية والبحث</button>' +
    '</div>';
  } else {
    html += '<div class="aqyem-cards-list">';
    pool.forEach(function(q, idx) {
      var isRevealed = !aqyemSelfStudyMode || !!aqyemRevealedMap[q.id];
      var userAns = aqyemUserSelectedAnswers[q.id];

      var typeBadgeClass = 'mcq';
      var typeIcon = 'fa-list-ul';
      if (q.type === 'fill') { typeBadgeClass = 'fill'; typeIcon = 'fa-pen-nib'; }
      else if (q.type === 'essay') { typeBadgeClass = 'essay'; typeIcon = 'fa-align-right'; }
      else if (q.type === 'financial') { typeBadgeClass = 'financial'; typeIcon = 'fa-calculator'; }

      html += '<div class="aqyem-card" id="aqyem-card-' + q.id + '">' +
        '<div class="aqyem-card-head">' +
          '<div class="aqyem-badges">' +
            '<span class="aqyem-qnum">سؤال ' + (q.qNum || (idx + 1)) + '</span>' +
            '<span class="aqyem-sem-badge ' + (q.sem === 2 ? 'sem2' : 'sem1') + '">' + (q.unitName ? esc(q.unitName) : ('الوحدة ' + q.unitId)) + '</span>' +
            '<span class="aqyem-lesson-badge">' + esc(q.lesson || '') + '</span>' +
            '<span class="aqyem-type-badge ' + typeBadgeClass + '"><i class="fas ' + typeIcon + '"></i> ' + esc(q.typeLabel || 'سؤال') + '</span>' +
          '</div>' +

          '<div style="display:flex;align-items:center;gap:6px;margin-right:auto;">' +
            // أزرار وضع المحرر — تظهر فقط في وضع المحرر للمشرف
            (editorMode ? (
              '<div class="qcard-editor-btns" style="display:inline-flex;align-items:center;gap:5px;">' +
                '<button type="button" class="qedit-btn" onclick="event.stopPropagation();openAqyemEditorEdit(' + q.id + ')" title="تحرير وتعديل هذا السؤال">' +
                  '<i class="fas fa-edit"></i> تحرير' +
                '</button>' +
                '<button type="button" class="qdel-btn" onclick="event.stopPropagation();confirmDeleteAqyemQuestion(' + q.id + ')" title="حذف هذا السؤال نهائياً">' +
                  '<i class="fas fa-trash-alt"></i> حذف' +
                '</button>' +
              '</div>'
            ) : '') +

            '<div class="aqyem-speak-wrap">' +
              '<button type="button" class="aqyem-speak-btn" onclick="speakSingleAqyem(' + q.id + ')" title="استمع للسؤال والحل بصوت عربي فصيح">' +
                '<i class="fas fa-volume-up"></i> <span>استمع</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      // معطيات وسياق السؤال إن وجدت
      if (q.context) {
        html += '<div class="aqyem-context-box">' +
          '<div class="aqyem-context-head"><i class="fas fa-table"></i> معطيات وملاحظات السؤال:</div>' +
          '<div style="white-space:pre-line;">' + formatQuestionContent(q.context) + '</div>' +
        '</div>';
      }

      // نص السؤال
      html += '<div class="aqyem-qtext">' + formatQuestionContent(q.text) + '</div>';

      // جسم السؤال حسب النمط
      if (q.type === 'mcq' && Array.isArray(q.options)) {
        html += '<div class="aqyem-opts-grid">';
        q.options.forEach(function(opt, oIdx) {
          var isCorrect = (oIdx === q.correct);
          var isUserSelected = (userAns === oIdx);
          var isUserWrong = (isUserSelected && !isCorrect);

          var optClass = 'aqyem-opt';
          if (isRevealed && isCorrect) {
            optClass += ' is-correct';
          }
          if (aqyemSelfStudyMode && !isRevealed && userAns === undefined) {
            optClass += ' interactive';
          }
          if (isUserWrong) {
            optClass += ' user-wrong';
          }

          var clickAction = (aqyemSelfStudyMode && !isRevealed && userAns === undefined)
            ? 'onclick="selectAqyemMcqOption(' + q.id + ', ' + oIdx + ')"'
            : '';

          html += '<div class="' + optClass + '" ' + clickAction + '>' +
            '<span class="aqyem-opt-letter ' + (isRevealed && isCorrect ? 'correct' : '') + '">' + (LBL[oIdx] || (oIdx + 1)) + '</span>' +
            '<div class="aqyem-opt-text">' +
              (isRevealed && isCorrect ? '<span class="aqyem-correct-tag"><i class="fas fa-check-circle"></i> الإجابة الصحيحة المعتمدة</span><br>' : '') +
              (isUserWrong ? '<span style="display:inline-block;background:#ef4444;color:#fff;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:800;margin-bottom:4px;"><i class="fas fa-times-circle"></i> إجابة غير صحيحة</span><br>' : '') +
              formatQuestionContent(opt) +
            '</div>' +
          '</div>';
        });
        html += '</div>';
      } else if (q.type === 'fill') {
        if (isRevealed) {
          html += '<div class="aqyem-answer-box" style="border-color:#fef08a;background:#fefce8;">' +
            '<div class="aqyem-answer-head" style="color:#854d0e;"><i class="fas fa-check-circle"></i> الإجابة المعتمدة في الفراغ:</div>' +
            '<div class="aqyem-answer-content"><span class="aqyem-fill-highlight">' + esc(q.answer) + '</span></div>' +
          '</div>';
        } else {
          html += '<div style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;padding:12px 16px;color:#64748b;font-size:13.5px;margin-bottom:12px;">' +
            '<i class="fas fa-eye-slash"></i> الإجابة مخفية في وضع التدريب الذاتي. اضغط «كشف الإجابة والسند» للتحقق من حلك.' +
          '</div>';
        }
      } else if (q.type === 'essay') {
        if (isRevealed) {
          html += '<div class="aqyem-answer-box" style="border-color:#e9d5ff;background:#faf5ff;">' +
            '<div class="aqyem-answer-head" style="color:#6b21a8;"><i class="fas fa-check-circle"></i> الإجابة النموذجية المعتمدة:</div>' +
            '<div class="aqyem-answer-content">' + formatQuestionContent(q.answer) + '</div>' +
          '</div>';
        } else {
          html += '<div style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;padding:12px 16px;color:#64748b;font-size:13.5px;margin-bottom:12px;">' +
            '<i class="fas fa-eye-slash"></i> الإجابة مخفية في وضع التدريب الذاتي. حاول الإجابة على السؤال ذهنياً أو كتابياً ثم اكشف الحل.' +
          '</div>';
        }
      } else if (q.type === 'financial') {
        if (isRevealed) {
          html += '<div class="aqyem-answer-box" style="border-color:#99f6e4;background:#f0fdfa;">' +
            '<div class="aqyem-answer-head" style="color:#0f766e;"><i class="fas fa-calculator"></i> القيود والحل المحاسبي النموذجي:</div>' +
            '<div class="aqyem-answer-content">' + formatQuestionContent(q.answer) + '</div>' +
          '</div>';
        } else {
          html += '<div style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;padding:12px 16px;color:#64748b;font-size:13.5px;margin-bottom:12px;">' +
            '<i class="fas fa-eye-slash"></i> الحل المحاسبي مخفي للتدريب الذاتي. قم بحساب المسألة وكتابة القيود أولاً ثم اكشف الحل النموذجي.' +
          '</div>';
        }
      }

      // السند والشرح من كتاب الطالب
      if (isRevealed) {
        var explanationText = (q.explanation && q.explanation.trim()) ? q.explanation : 'تم اعتماد الإجابة استناداً لنصوص المنهاج الوزاري المقررة في كتاب الطالب طبعة 2026.';
        html += '<div class="aqyem-sanad-box">' +
          '<div class="aqyem-sanad-head"><i class="fas fa-lightbulb"></i> <strong>السند والشرح من كتاب الطالب:</strong></div>' +
          '<div class="aqyem-sanad-text">' + formatQuestionContent(explanationText) + '</div>' +
        '</div>';
      } else {
        html += '<div style="text-align:left;margin-top:10px;">' +
          '<button type="button" class="aqyem-reveal-btn" onclick="revealAqyemAnswer(' + q.id + ')">' +
            '<i class="fas fa-eye"></i> كشف الإجابة النموذجية والسند' +
          '</button>' +
        '</div>';
      }

      html += '</div>'; // نهاية aqyem-card
    });
    html += '</div>';
  }

  inner.innerHTML = html;
}
window.renderAqyemQuestionsPage = renderAqyemQuestionsPage;

// ══════════════════════════════════════════════
//  وظائف المحرر الخاصة بأسئلة أُقيّم تعلّمي (خاص بوضع المحرر)
// ══════════════════════════════════════════════
var aqyemQuestionToDeleteId = null;

function openAqyemEditorEdit(qId) {
  if (!editorMode) return;
  var allAqyem = getAqyemDataset();
  var q = allAqyem.find(function(item){ return item.id === qId; });
  if (!q) { toast('السؤال غير موجود أو تم حذفه مسبقاً', 'err'); return; }

  var modalTitle = document.querySelector('#editor-edit-overlay .editor-modal-title');
  if (modalTitle) {
    modalTitle.innerHTML = '<i class="fas fa-edit"></i> تحرير سؤال أُقيّم تعلّمي (سؤال #' + q.id + ')';
  }

  var body = document.getElementById('editor-edit-body');
  if (!body) return;

  var currentType = q.type || 'mcq';

  var html =
    '<div class="aqyem-edit-form" style="padding:6px 2px;">' +
      // شارة التنبيه
      '<div style="background:#e0f2fe;border:1px solid #bae6fd;border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
        '<span style="font-weight:800;color:#0369a1;font-size:13.5px;"><i class="fas fa-hashtag"></i> سؤال أُقيّم تعلّمي رقم: #' + q.id + '</span>' +
        '<span style="font-size:12px;color:#0284c7;font-weight:700;"><i class="fas fa-book"></i> المنهاج المعتمد 2026</span>' +
      '</div>' +

      // اختيار الوحدة والدرس
      '<div style="display:grid;grid-template-columns:1.2fr 1fr;gap:10px;margin-bottom:12px;">' +
        '<div>' +
          '<label style="display:block;font-size:12.5px;font-weight:800;color:#334155;margin-bottom:4px;">الوحدة الدراسية:</label>' +
          '<select id="aqyem-ed-unit" class="aqyem-select" style="width:100%;font-size:13px;" onchange="onAqyemEditUnitChange()">' +
            getAqyemUnitSelectOptionsHtml(q.unitId) +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label style="display:block;font-size:12.5px;font-weight:800;color:#334155;margin-bottom:4px;">الدرس:</label>' +
          '<input type="text" id="aqyem-ed-lesson" list="aqyem-ed-lessons-datalist" class="aqyem-search-input" style="width:100%;font-size:13px;" value="' + esc(q.lesson || '') + '" placeholder="اسم الدرس">' +
          '<datalist id="aqyem-ed-lessons-datalist"></datalist>' +
        '</div>' +
      '</div>' +

      // نمط السؤال
      '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:12.5px;font-weight:800;color:#334155;margin-bottom:4px;">نمط السؤال:</label>' +
        '<select id="aqyem-ed-type" class="aqyem-select" style="width:100%;font-size:13px;" onchange="renderAqyemEditAnswerFields()">' +
          '<option value="mcq" ' + (currentType === 'mcq' ? 'selected' : '') + '>اختيار من متعدد (MCQ)</option>' +
          '<option value="fill" ' + (currentType === 'fill' ? 'selected' : '') + '>أملأ الفراغ (Fill in the blank)</option>' +
          '<option value="essay" ' + (currentType === 'essay' ? 'selected' : '') + '>سؤال مقالي وتفسيرات (Essay)</option>' +
          '<option value="financial" ' + (currentType === 'financial' ? 'selected' : '') + '>مسألة محاسبية وقوائم وقيود (Financial)</option>' +
        '</select>' +
      '</div>' +

      // معطيات المسألة والجداول (اختياري)
      '<div style="margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:4px;">' +
          '<label style="font-size:12.5px;font-weight:800;color:#334155;margin:0;"><i class="fas fa-calculator"></i> معطيات المسألة أو جدول الحسابات (اختياري):</label>' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-context\', \'simple\')"><i class="fas fa-balance-scale"></i> قيد</button>' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-context\', \'journal\')"><i class="fas fa-book"></i> دفتر اليومية</button>' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-context\', \'ledger\')"><i class="fas fa-columns"></i> دفتر الأستاذ</button>' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#fdf2f8;color:#9d174d;border:1px solid #fbcfe8;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-context\', \'balances\')"><i class="fas fa-list-alt"></i> ميزان مراجعة</button>' +
          '</div>' +
        '</div>' +
        '<textarea id="aqyem-ed-context" class="ed-textarea" style="width:100%;height:65px;font-size:13px;line-height:1.5;" placeholder="معطيات المسألة أو الجدول">' + esc(q.context || '') + '</textarea>' +
      '</div>' +

      // نص السؤال
      '<div style="margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:4px;">' +
          '<label style="font-size:12.5px;font-weight:800;color:#334155;margin:0;"><i class="fas fa-question-circle"></i> نص السؤال المطلوب:</label>' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-text\', \'simple\')"><i class="fas fa-balance-scale"></i> قيد</button>' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-text\', \'journal\')"><i class="fas fa-book"></i> دفتر اليومية</button>' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-text\', \'ledger\')"><i class="fas fa-columns"></i> دفتر الأستاذ</button>' +
          '</div>' +
        '</div>' +
        '<textarea id="aqyem-ed-text" class="ed-textarea" style="width:100%;height:80px;font-size:13.5px;line-height:1.6;" placeholder="اكتب نص السؤال المطلوب">' + esc(q.text || '') + '</textarea>' +
      '</div>' +

      // حقول الإجابة الديناميكية
      '<div id="aqyem-ed-answer-wrap" style="margin-bottom:12px;"></div>' +

      // السند والشرح من كتاب الطالب
      '<div style="margin-bottom:16px;">' +
        '<label style="display:block;font-size:12.5px;font-weight:800;color:#334155;margin-bottom:4px;">السند والشرح من كتاب الطالب (طبعة 2026):</label>' +
        '<textarea id="aqyem-ed-explanation" class="ed-textarea" style="width:100%;height:70px;font-size:13px;line-height:1.5;" placeholder="السند العلمي والتوضيح الوزاري">' + esc(q.explanation || '') + '</textarea>' +
      '</div>' +

      // أزرار الحفظ والإلغاء والحذف
      '<div style="display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap;border-top:1.5px solid #e2e8f0;padding-top:14px;">' +
        '<button type="button" class="ed-btn ed-btn-save" style="padding:10px 22px;font-weight:800;font-size:13.5px;" onclick="saveAqyemQuestionEdit(' + q.id + ')">' +
          '<i class="fas fa-save"></i> حفظ التعديلات' +
        '</button>' +
        '<button type="button" class="ed-btn ed-btn-cancel" style="padding:10px 18px;font-size:13.5px;" onclick="closeEditorEdit()">' +
          'إلغاء' +
        '</button>' +
        '<button type="button" class="ed-btn ed-btn-delete" style="padding:10px 16px;font-size:13px;margin-right:auto;" onclick="closeEditorEdit();confirmDeleteAqyemQuestion(' + q.id + ')">' +
          '<i class="fas fa-trash-alt"></i> حذف السؤال' +
        '</button>' +
      '</div>' +
    '</div>';

  body.innerHTML = html;

  // ملء حقول الإجابة بناءً على السؤال الأصلي
  window._tempEditingAqyemQ = q;
  renderAqyemEditAnswerFields();
  onAqyemEditUnitChange();

  var ov = document.getElementById('editor-edit-overlay');
  if (ov) ov.classList.add('open');
}
window.openAqyemEditorEdit = openAqyemEditorEdit;

function insertIntoAqyemTextAns(templateText) {
  var ta = document.getElementById('aqyem-ed-text-ans');
  if (!ta) return;
  var start = ta.selectionStart || 0;
  var end = ta.selectionEnd || 0;
  var val = ta.value;
  var prefix = (start > 0 && val.charAt(start - 1) !== '\n') ? '\n' : '';
  ta.value = val.substring(0, start) + prefix + templateText + val.substring(end);
  ta.focus();
  updateAqyemAnsPreview();
}
window.insertIntoAqyemTextAns = insertIntoAqyemTextAns;

function updateAqyemAnsPreview() {
  var ta = document.getElementById('aqyem-ed-text-ans');
  var prev = document.getElementById('aqyem-ed-ans-preview');
  if (!ta || !prev) return;
  var val = ta.value.trim();
  if (!val) {
    prev.innerHTML = '<span style="color:#94a3b8;font-size:12px;"><i class="fas fa-magic"></i> ستظهر هنا المعاينة الفورية للأقواس والأسطر والجداول والصور والقيود المحاسبية أثناء كتابتك...</span>';
    return;
  }
  prev.innerHTML = formatQuestionContent(val);
}
window.updateAqyemAnsPreview = updateAqyemAnsPreview;

function toggleAqyemOptsPreview() {
  var pBox = document.getElementById('aqyem-opts-preview');
  if (!pBox) return;
  var isHidden = pBox.style.display === 'none' || !pBox.style.display;
  pBox.style.display = isHidden ? 'block' : 'none';
  if (isHidden) updateAqyemOptsPreview();
}
window.toggleAqyemOptsPreview = toggleAqyemOptsPreview;

function updateAqyemOptsPreview() {
  var pBox = document.getElementById('aqyem-opts-preview');
  if (!pBox || pBox.style.display === 'none') return;
  var html = '<div style="font-size:11.5px;font-weight:800;color:#334155;margin-bottom:6px;"><i class="fas fa-magic" style="color:#0284c7;"></i> معاينة حية لشكل خيارات أُقيّم تعلّمي المحاسبية:</div>';
  html += '<div style="display:flex;flex-direction:column;gap:6px;">';
  for (var i = 0; i < 4; i++) {
    var optEl = document.getElementById('aqyem-ed-opt-' + i);
    var val = optEl ? optEl.value.trim() : '';
    html += '<div style="display:flex;align-items:flex-start;gap:8px;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;">' +
      '<span style="font-weight:900;color:var(--pr);font-size:12px;min-width:18px;padding-top:2px;">' + (LBL[i] || (i + 1)) + '</span>' +
      '<div style="flex:1;">' + (val ? formatOptionDisplay(val) : '<span style="color:#94a3b8;font-size:12px;font-style:italic;">(خيار فارغ)</span>') + '</div>' +
    '</div>';
  }
  html += '</div>';
  pBox.innerHTML = html;
}
window.updateAqyemOptsPreview = updateAqyemOptsPreview;

function renderAqyemEditAnswerFields() {
  var wrap = document.getElementById('aqyem-ed-answer-wrap');
  var typeEl = document.getElementById('aqyem-ed-type');
  if (!wrap || !typeEl) return;

  var type = typeEl.value;
  var q = window._tempEditingAqyemQ || {};

  var html = '';
  if (type === 'mcq') {
    var opts = (q.type === 'mcq' && Array.isArray(q.options)) ? q.options : ['', '', '', ''];
    var correctIdx = (typeof q.correct === 'number') ? q.correct : 0;

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">' +
      '<label style="font-size:12.5px;font-weight:800;color:#334155;margin:0;"><i class="fas fa-list-ul"></i> الخيارات الأربعة (حدد الإجابة الصحيحة):</label>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
        '<button type="button" class="btn" style="padding:3px 8px;font-size:11px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:6px;" onclick="insertAccountingOptionTemplate(\'simple\')"><i class="fas fa-balance-scale"></i> + قيد بسيط</button>' +
        '<button type="button" class="btn" style="padding:3px 8px;font-size:11px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:6px;" onclick="insertAccountingOptionTemplate(\'compound_debit\')"><i class="fas fa-layer-group"></i> + من مذكورين</button>' +
        '<button type="button" class="btn" style="padding:3px 8px;font-size:11px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:6px;" onclick="insertAccountingOptionTemplate(\'compound_credit\')"><i class="fas fa-layer-group"></i> + إلى مذكورين</button>' +
        '<button type="button" class="btn" style="padding:3px 8px;font-size:11px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;" onclick="insertAccountingOptionTemplate(\'journal\')"><i class="fas fa-book"></i> + دفتر اليومية</button>' +
        '<button type="button" class="btn" style="padding:3px 8px;font-size:11px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;" onclick="insertAccountingOptionTemplate(\'ledger\')"><i class="fas fa-columns"></i> + دفتر الأستاذ</button>' +
        '<button type="button" class="btn" style="padding:3px 8px;font-size:11px;background:#f8fafc;color:#334155;border:1px solid #cbd5e1;border-radius:6px;" onclick="toggleAqyemOptsPreview()"><i class="fas fa-eye"></i> معاينة الخيارات</button>' +
      '</div>' +
    '</div>' +
    '<div id="aqyem-opts-preview" style="display:none;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:8px;margin-bottom:8px;"></div>';

    for (var i = 0; i < 4; i++) {
      html +=
        '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">' +
          '<input type="radio" name="aqyem-ed-correct-opt" value="' + i + '" ' + (correctIdx === i ? 'checked' : '') + ' style="width:18px;height:18px;cursor:pointer;margin-top:6px;" title="اختر هذا الخيار كإجابة صحيحة">' +
          '<span style="font-weight:800;font-size:13px;color:var(--pr);width:22px;margin-top:6px;">' + (LBL[i] || (i + 1)) + '</span>' +
          '<textarea id="aqyem-ed-opt-' + i + '" class="aqyem-search-input ed-opt-textarea" rows="2" style="flex:1;font-size:13px;line-height:1.5;resize:vertical;" oninput="updateAqyemOptsPreview()" placeholder="نص أو قيد الخيار ' + (LBL[i] || (i + 1)) + ' — اضغط Enter للنزول سطراً">' + esc(opts[i] || '') + '</textarea>' +
        '</div>';
    }
  } else if (type === 'fill') {
    var fillAns = (typeof q.answer === 'string') ? q.answer : '';
    html +=
      '<label style="display:block;font-size:12.5px;font-weight:800;color:#854d0e;margin-bottom:4px;"><i class="fas fa-pen-nib"></i> الكلمة أو العبارة الصحيحة في الفراغ:</label>' +
      '<input type="text" id="aqyem-ed-fill-ans" class="aqyem-search-input" style="width:100%;font-size:13.5px;font-weight:700;border-color:#fde047;background:#fefce8;" value="' + esc(fillAns) + '" placeholder="مثلاً: ميزان المراجعة، الأصول المتداولة">';
  } else {
    var textAns = (typeof q.answer === 'string') ? q.answer : (q.answer ? JSON.stringify(q.answer, null, 2) : '');
    html +=
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">' +
        '<label style="font-size:12.5px;font-weight:800;color:#0f766e;margin:0;"><i class="fas fa-align-right"></i> الإجابة النموذجية والحل والقيود المحاسبية:</label>' +
        '<div style="display:flex;gap:5px;flex-wrap:wrap;">' +
          '<button type="button" class="btn" style="padding:4px 9px;font-size:11.5px;background:#f0fdfa;color:#0f766e;border:1px solid #99f6e4;border-radius:6px;" onclick="insertIntoAqyemTextAns(\'10000 من حـ/ الصندوق\\n10000 إلى حـ/ المبيعات\\n(إثبات بيع بضاعة نقداً)\')" title="إدراج نموذج قيد محاسبي مرتب">' +
            '<i class="fas fa-balance-scale"></i> + قيد بسيط' +
          '</button>' +
          '<button type="button" class="btn" style="padding:4px 9px;font-size:11.5px;background:#f0fdfa;color:#0f766e;border:1px solid #99f6e4;border-radius:6px;" onclick="insertIntoAqyemTextAns(\'من مذكورين:\\n1200 حـ/ الصندوق\\n800 حـ/ البنك\\n2000 إلى حـ/ رأس المال\')" title="إدراج قيد مركب">' +
            '<i class="fas fa-layer-group"></i> + قيد مركب' +
          '</button>' +
          '<button type="button" class="btn" style="padding:4px 9px;font-size:11.5px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;" onclick="insertIntoAqyemTextAns(\'| مدين | دائن | البيان | رقم القيد | التاريخ |\\n|---|---|---|---|---|\\n| 15000 | - | من حـ/ البنك | 1 | 2026/1/5م |\\n| - | 15000 | إلى حـ/ رأس المال | 1 | 2026/1/5م |\\n| (إيداع رأس المال في البنك) | | | | |\\n| 15000 | 15000 | المجموع | | |\')" title="إدراج دفتر اليومية">' +
            '<i class="fas fa-book"></i> + دفتر اليومية' +
          '</button>' +
          '<button type="button" class="btn" style="padding:4px 9px;font-size:11.5px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;" onclick="insertIntoAqyemTextAns(\'[دفتر الأستاذ: حـ/ الصندوق]\\n| منه (مدين) | البيان | له (دائن) | البيان |\\n|---|---|---|---|\\n| 5000 | إلى حـ/ المبيعات | 2000 | من حـ/ الإيجار |\\n| - | - | 3000 | رصيد مدين مرحل |\\n| 5000 | المجموع | 5000 | المجموع |\\n| 3000 | رصيد مدين منقول | - | - |\')" title="إدراج دفتر الأستاذ">' +
            '<i class="fas fa-columns"></i> + دفتر الأستاذ (T)' +
          '</button>' +
          '<button type="button" class="btn" style="padding:4px 9px;font-size:11.5px;background:#f8fafc;color:#1e293b;border:1px solid #cbd5e1;border-radius:6px;" onclick="insertIntoAqyemTextAns(\'| البيان | مدين | دائن |\\n|---|---|---|\\n| حـ/ الصندوق | 5000 | - |\\n| حـ/ رأس المال | - | 5000 |\')" title="إدراج جدول">' +
            '<i class="fas fa-table"></i> + جدول' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<textarea id="aqyem-ed-text-ans" class="ed-textarea" style="width:100%;height:110px;font-size:13px;line-height:1.6;" oninput="updateAqyemAnsPreview()" placeholder="اكتب الإجابة النموذجية أو القيود المحاسبية بالتفصيل (كل قيد على سطر)">' + esc(textAns) + '</textarea>' +
      '<div style="margin-top:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;">' +
        '<div style="font-size:11.5px;font-weight:700;color:#64748b;margin-bottom:4px;"><i class="fas fa-eye"></i> معاينة شكل الإجابة والقيود والجداول كما ستظهر للطالب:</div>' +
        '<div id="aqyem-ed-ans-preview" style="background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;min-height:36px;font-size:13px;"></div>' +
      '</div>';
  }

  wrap.innerHTML = html;
  setTimeout(updateAqyemAnsPreview, 10);
}
window.renderAqyemEditAnswerFields = renderAqyemEditAnswerFields;

function saveAqyemQuestionEdit(qId) {
  if (!editorMode) return;
  var allAqyem = getAqyemDataset();
  var q = allAqyem.find(function(item){ return item.id === qId; });
  if (!q) { toast('السؤال غير موجود', 'err'); return; }

  var textEl = document.getElementById('aqyem-ed-text');
  var unitEl = document.getElementById('aqyem-ed-unit');
  var lessonEl = document.getElementById('aqyem-ed-lesson');
  var typeEl = document.getElementById('aqyem-ed-type');
  var contextEl = document.getElementById('aqyem-ed-context');
  var expEl = document.getElementById('aqyem-ed-explanation');

  var newText = textEl ? textEl.value.trim() : '';
  if (!newText) { toast('يرجى إدخال نص السؤال المطلوب', 'err'); return; }

  var newUnitId = unitEl ? parseInt(unitEl.value, 10) : (q.unitId || 1);
  var newSem = (newUnitId >= 4 && newUnitId <= 7) ? 2 : ((newUnitId >= 1 && newUnitId <= 3) ? 1 : (q.sem || (newUnitId >= 4 ? 2 : 1)));
  var newLesson = lessonEl ? lessonEl.value.trim() : (q.lesson || '');
  var newType = typeEl ? typeEl.value : 'mcq';
  var newContext = contextEl ? contextEl.value.trim() : '';
  var newExp = expEl ? expEl.value.trim() : '';

  var typeLabelsMap = { mcq: 'اختيار من متعدد', fill: 'أملأ الفراغ', essay: 'سؤال مقالي وتفسيري', financial: 'مسألة محاسبية وقوائم' };

  q.sem = newSem;
  q.unitId = newUnitId;
  q.unitName = AQYEM_UNIT_NAMES[newUnitId] || q.unitName || ('الوحدة ' + newUnitId);
  q.lesson = newLesson;
  q.type = newType;
  q.typeLabel = typeLabelsMap[newType] || 'سؤال';
  q.text = newText;
  q.context = newContext;
  q.explanation = newExp;

  if (newType === 'mcq') {
    var newOpts = [];
    for (var i = 0; i < 4; i++) {
      var optInput = document.getElementById('aqyem-ed-opt-' + i);
      newOpts.push(optInput ? optInput.value.trim() : '');
    }
    var radChecked = document.querySelector('input[name="aqyem-ed-correct-opt"]:checked');
    var correctIdx = radChecked ? parseInt(radChecked.value, 10) : 0;
    q.options = newOpts;
    q.correct = correctIdx;
    q.answer = correctIdx;
  } else if (newType === 'fill') {
    var fillInput = document.getElementById('aqyem-ed-fill-ans');
    q.answer = fillInput ? fillInput.value.trim() : '';
    delete q.options;
    delete q.correct;
  } else {
    var textAnsInput = document.getElementById('aqyem-ed-text-ans');
    q.answer = textAnsInput ? textAnsInput.value.trim() : '';
    delete q.options;
    delete q.correct;
  }

  // حفظ التعديل محلياً في localStorage
  try {
    var raw = localStorage.getItem('aqyem_overrides');
    var ovs = raw ? JSON.parse(raw) : {};
    if (!ovs || typeof ovs !== 'object') ovs = {};
    ovs[qId] = {
      id: q.id,
      qNum: q.qNum || q.id,
      sem: q.sem,
      unitId: q.unitId,
      unitName: q.unitName,
      lesson: q.lesson,
      type: q.type,
      typeLabel: q.typeLabel,
      text: q.text,
      context: q.context,
      explanation: q.explanation,
      options: q.options,
      correct: q.correct,
      answer: q.answer
    };
    localStorage.setItem('aqyem_overrides', JSON.stringify(ovs));

    // تحديث في الذاكرة والكاش أيضاً
    if (window.aqyemQuestionsList && Array.isArray(window.aqyemQuestionsList)) {
      var foundIdx = window.aqyemQuestionsList.findIndex(function(it){ return it.id === qId; });
      if (foundIdx !== -1) {
        Object.assign(window.aqyemQuestionsList[foundIdx], ovs[qId]);
      }
      try {
        localStorage.setItem('aqyem_firestore_cache', JSON.stringify(window.aqyemQuestionsList));
      } catch(e) {}
    }

    // مزامنة فورية ومباشرة مع قاعدة بيانات Firebase سحابياً
    syncAqyemOverrideToCloud(qId, ovs[qId]);
  } catch(e) {
    console.warn('Failed to save aqyem override:', e);
  }

  closeEditorEdit();
  toast('✅ تم حفظ تعديل السؤال بنجاح', 'ok');

  if (currentPageId === 'aqyem-questions') {
    renderAqyemQuestionsPage();
  } else if (currentPageId === 'aqyem-sem2') {
    renderAqyemSem2Page();
  } else if (currentPageId === 'aqyem-sem1') {
    renderAqyemSem1Page();
  } else if (currentPageId === 'aqyem') {
    renderAqyemHub();
  }
}
window.saveAqyemQuestionEdit = saveAqyemQuestionEdit;

// نافذة تأكيد حذف سؤال أقيم تعلمي
function confirmDeleteAqyemQuestion(qId) {
  if (!editorMode) return;
  var allAqyem = getAqyemDataset();
  var q = allAqyem.find(function(item){ return item.id === qId; });
  if (!q) { toast('السؤال غير موجود أو تم حذفه مسبقاً', 'err'); return; }

  aqyemQuestionToDeleteId = qId;

  var infoEl = document.getElementById('delete-confirm-question-info');
  if (infoEl) {
    infoEl.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px;font-weight:800;color:#1e293b;">' +
        '<span><i class="fas fa-hashtag" style="color:#e74c3c;"></i> سؤال أُقيّم تعلّمي: <span style="color:#e74c3c;font-size:13px;">#' + q.id + '</span></span>' +
        (q.lesson ? '<span style="color:#475569;font-weight:600;"><i class="fas fa-book-open" style="color:#3b82f6;"></i> ' + esc(q.lesson) + '</span>' : '') +
      '</div>' +
      '<div style="font-size:13px;color:#1e293b;line-height:1.6;background:#ffffff;padding:10px 12px;border-radius:8px;border:1px solid #cbd5e1;max-height:110px;overflow-y:auto;font-weight:600;">' +
        esc(q.text) +
      '</div>';
  }

  var btnAction = document.getElementById('btn-confirm-delete-action');
  if (btnAction) {
    btnAction.disabled = false;
    btnAction.innerHTML = '<i class="fas fa-trash-alt"></i> نعم، حذف السؤال من أُقيّم تعلّمي';
    btnAction.onclick = executeDeleteAqyemQuestionAction;
  }

  var ov = document.getElementById('delete-confirm-overlay');
  if (ov) ov.classList.add('open');
}
window.confirmDeleteAqyemQuestion = confirmDeleteAqyemQuestion;

function executeDeleteAqyemQuestionAction() {
  if (!editorMode || !aqyemQuestionToDeleteId) return;
  var qId = aqyemQuestionToDeleteId;

  var allAqyem = getAqyemDataset();
  var idx = allAqyem.findIndex(function(item){ return item.id === qId; });
  if (idx !== -1) {
    allAqyem.splice(idx, 1);
  }

  // حذف من الذاكرة والكاش أيضاً
  if (window.aqyemQuestionsList && Array.isArray(window.aqyemQuestionsList)) {
    var fIdx = window.aqyemQuestionsList.findIndex(function(it){ return it.id === qId; });
    if (fIdx !== -1) {
      window.aqyemQuestionsList.splice(fIdx, 1);
    }
    try {
      localStorage.setItem('aqyem_firestore_cache', JSON.stringify(window.aqyemQuestionsList));
    } catch(e) {}
  }

  // تخزين الحذف في localStorage
  try {
    var raw = localStorage.getItem('aqyem_deletions');
    var dels = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(dels)) dels = [];
    if (dels.indexOf(qId) === -1) {
      dels.push(qId);
      localStorage.setItem('aqyem_deletions', JSON.stringify(dels));
    }
    // مزامنة حذف السؤال سحابياً مباشرة مع قاعدة بيانات Firebase
    syncDeleteAqyemQuestionToCloud(qId);
  } catch(e) {
    console.warn('Failed to save aqyem deletion:', e);
  }

  var ov = document.getElementById('delete-confirm-overlay');
  if (ov) ov.classList.remove('open');
  aqyemQuestionToDeleteId = null;

  toast('🗑️ تم حذف السؤال (#' + qId + ') بنجاح من أُقيّم تعلّمي', 'ok');

  if (currentPageId === 'aqyem-questions') {
    renderAqyemQuestionsPage();
  } else if (currentPageId === 'aqyem-sem2') {
    renderAqyemSem2Page();
  } else if (currentPageId === 'aqyem-sem1') {
    renderAqyemSem1Page();
  } else if (currentPageId === 'aqyem') {
    renderAqyemHub();
  }
}
window.executeDeleteAqyemQuestionAction = executeDeleteAqyemQuestionAction;

// إضافة سؤال جديد إلى أقيم تعلمي
function openAddAqyemQuestion(defaultUnitId, defaultLesson) {
  if (!editorMode) return;

  var modalTitle = document.querySelector('#editor-edit-overlay .editor-modal-title');
  if (modalTitle) {
    modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> إضافة سؤال جديد إلى أُقيّم تعلّمي';
  }

  var body = document.getElementById('editor-edit-body');
  if (!body) return;

  var unitId = defaultUnitId || (currentAqyemUnit > 0 ? currentAqyemUnit : (currentAqyemSem === 2 ? 4 : 1));
  var lesson = defaultLesson || (currentAqyemLesson || '');

  var html =
    '<div class="aqyem-edit-form" style="padding:6px 2px;">' +
      // شارة التنبيه
      '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
        '<span style="font-weight:800;color:#15803d;font-size:13.5px;"><i class="fas fa-plus-circle"></i> إضافة سؤال جديد إلى المنهاج المعتمد</span>' +
        '<span style="font-size:12px;color:#166534;font-weight:700;"><i class="fas fa-check-circle"></i> وضع المحرر — حفظ مباشر في Firebase</span>' +
      '</div>' +

      // اختيار الوحدة والدرس
      '<div style="display:grid;grid-template-columns:1.2fr 1fr;gap:10px;margin-bottom:12px;">' +
        '<div>' +
          '<label style="display:block;font-size:12.5px;font-weight:800;color:#334155;margin-bottom:4px;">الوحدة الدراسية:</label>' +
          '<select id="aqyem-ed-unit" class="aqyem-select" style="width:100%;font-size:13px;" onchange="onAqyemEditUnitChange()">' +
            getAqyemUnitSelectOptionsHtml(unitId) +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label style="display:block;font-size:12.5px;font-weight:800;color:#334155;margin-bottom:4px;">الدرس التابع له السؤال:</label>' +
          '<input type="text" id="aqyem-ed-lesson" list="aqyem-ed-lessons-datalist" class="aqyem-search-input" style="width:100%;font-size:13px;" value="' + esc(lesson) + '" placeholder="اسم الدرس">' +
          '<datalist id="aqyem-ed-lessons-datalist"></datalist>' +
        '</div>' +
      '</div>' +

      // نمط السؤال
      '<div style="margin-bottom:12px;">' +
        '<label style="display:block;font-size:12.5px;font-weight:800;color:#334155;margin-bottom:4px;">نمط السؤال:</label>' +
        '<select id="aqyem-ed-type" class="aqyem-select" style="width:100%;font-size:13px;" onchange="renderAqyemEditAnswerFields()">' +
          '<option value="mcq" selected>اختيار من متعدد (MCQ)</option>' +
          '<option value="fill">أملأ الفراغ (Fill in the blank)</option>' +
          '<option value="essay">سؤال مقالي وتفسيرات (Essay)</option>' +
          '<option value="financial">مسألة محاسبية وقوائم وقيود (Financial)</option>' +
        '</select>' +
      '</div>' +

      // معطيات المسألة والجداول (اختياري)
      '<div style="margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:4px;">' +
          '<label style="font-size:12.5px;font-weight:800;color:#334155;margin:0;"><i class="fas fa-calculator"></i> معطيات المسألة أو جدول الحسابات (اختياري):</label>' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-context\', \'simple\')"><i class="fas fa-balance-scale"></i> قيد</button>' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-context\', \'journal\')"><i class="fas fa-book"></i> دفتر اليومية</button>' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-context\', \'ledger\')"><i class="fas fa-columns"></i> دفتر الأستاذ</button>' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#fdf2f8;color:#9d174d;border:1px solid #fbcfe8;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-context\', \'balances\')"><i class="fas fa-list-alt"></i> ميزان مراجعة</button>' +
          '</div>' +
        '</div>' +
        '<textarea id="aqyem-ed-context" class="ed-textarea" style="width:100%;height:65px;font-size:13px;line-height:1.5;" placeholder="معطيات المسألة أو الجدول"></textarea>' +
      '</div>' +

      // نص السؤال
      '<div style="margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:4px;">' +
          '<label style="font-size:12.5px;font-weight:800;color:#334155;margin:0;"><i class="fas fa-question-circle"></i> نص السؤال المطلوب:</label>' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-text\', \'simple\')"><i class="fas fa-balance-scale"></i> قيد</button>' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-text\', \'journal\')"><i class="fas fa-book"></i> دفتر اليومية</button>' +
            '<button type="button" class="btn" style="padding:2px 7px;font-size:11px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;" onclick="insertAccountingStructureTemplate(\'aqyem-ed-text\', \'ledger\')"><i class="fas fa-columns"></i> دفتر الأستاذ</button>' +
          '</div>' +
        '</div>' +
        '<textarea id="aqyem-ed-text" class="ed-textarea" style="width:100%;height:80px;font-size:13.5px;line-height:1.6;" placeholder="اكتب نص السؤال المطلوب هنا"></textarea>' +
      '</div>' +

      // حقول الإجابة الديناميكية
      '<div id="aqyem-ed-answer-wrap" style="margin-bottom:12px;"></div>' +

      // السند والشرح من كتاب الطالب
      '<div style="margin-bottom:16px;">' +
        '<label style="display:block;font-size:12.5px;font-weight:800;color:#334155;margin-bottom:4px;">السند والشرح من كتاب الطالب (طبعة 2026):</label>' +
        '<textarea id="aqyem-ed-explanation" class="ed-textarea" style="width:100%;height:70px;font-size:13px;line-height:1.5;" placeholder="السند العلمي والتوضيح الوزاري"></textarea>' +
      '</div>' +

      // أزرار الإضافة والإلغاء
      '<div style="display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap;border-top:1.5px solid #e2e8f0;padding-top:14px;">' +
        '<button type="button" class="ed-btn ed-btn-save" style="padding:10px 22px;font-weight:800;font-size:13.5px;background:#15803d;" onclick="saveAddAqyemQuestion()">' +
          '<i class="fas fa-plus-circle"></i> إضافة وحفظ السؤال' +
        '</button>' +
        '<button type="button" class="ed-btn ed-btn-cancel" style="padding:10px 18px;font-size:13.5px;" onclick="closeEditorEdit()">' +
          'إلغاء' +
        '</button>' +
      '</div>' +
    '</div>';

  body.innerHTML = html;

  window._tempEditingAqyemQ = { type: 'mcq', options: ['', '', '', ''], correct: 0 };
  renderAqyemEditAnswerFields();
  onAqyemEditUnitChange();

  var ov = document.getElementById('editor-edit-overlay');
  if (ov) ov.classList.add('open');
}
window.openAddAqyemQuestion = openAddAqyemQuestion;

function saveAddAqyemQuestion() {
  if (!editorMode) return;

  var textEl = document.getElementById('aqyem-ed-text');
  var unitEl = document.getElementById('aqyem-ed-unit');
  var lessonEl = document.getElementById('aqyem-ed-lesson');
  var typeEl = document.getElementById('aqyem-ed-type');
  var contextEl = document.getElementById('aqyem-ed-context');
  var expEl = document.getElementById('aqyem-ed-explanation');

  var newText = textEl ? textEl.value.trim() : '';
  if (!newText) { toast('يرجى إدخال نص السؤال المطلوب', 'err'); return; }

  var newUnitId = unitEl ? parseInt(unitEl.value, 10) : 1;
  var newSem = (newUnitId >= 4 && newUnitId <= 7) ? 2 : 1;
  var newLesson = lessonEl ? lessonEl.value.trim() : 'عام';
  var newType = typeEl ? typeEl.value : 'mcq';
  var newContext = contextEl ? contextEl.value.trim() : '';
  var newExp = expEl ? expEl.value.trim() : '';

  var typeLabelsMap = { mcq: 'اختيار من متعدد', fill: 'أملأ الفراغ', essay: 'سؤال مقالي وتفسيري', financial: 'مسألة محاسبية وقوائم' };

  var allAqyem = getAqyemDataset();
  var maxId = 0;
  allAqyem.forEach(function(item){ if (item.id > maxId) maxId = item.id; });
  var newId = Math.max(maxId + 1, 1000);

  var newQuestion = {
    id: newId,
    qNum: allAqyem.length + 1,
    sem: newSem,
    unitId: newUnitId,
    unitName: AQYEM_UNIT_NAMES[newUnitId] || ('الوحدة ' + newUnitId),
    lesson: newLesson,
    type: newType,
    typeLabel: typeLabelsMap[newType] || 'سؤال',
    text: newText,
    context: newContext,
    explanation: newExp
  };

  if (newType === 'mcq') {
    var newOpts = [];
    for (var i = 0; i < 4; i++) {
      var optInput = document.getElementById('aqyem-ed-opt-' + i);
      newOpts.push(optInput ? optInput.value.trim() : '');
    }
    var radChecked = document.querySelector('input[name="aqyem-ed-correct-opt"]:checked');
    var correctIdx = radChecked ? parseInt(radChecked.value, 10) : 0;
    newQuestion.options = newOpts;
    newQuestion.correct = correctIdx;
    newQuestion.answer = correctIdx;
  } else if (newType === 'fill') {
    var fillInput = document.getElementById('aqyem-ed-fill-ans');
    newQuestion.answer = fillInput ? fillInput.value.trim() : '';
  } else {
    var textAnsInput = document.getElementById('aqyem-ed-text-ans');
    newQuestion.answer = textAnsInput ? textAnsInput.value.trim() : '';
  }

  allAqyem.push(newQuestion);

  // تحديث في الذاكرة والكاش أيضاً
  if (window.aqyemQuestionsList && Array.isArray(window.aqyemQuestionsList)) {
    if (!window.aqyemQuestionsList.some(function(it){ return it.id === newQuestion.id; })) {
      window.aqyemQuestionsList.push(newQuestion);
    }
    try {
      localStorage.setItem('aqyem_firestore_cache', JSON.stringify(window.aqyemQuestionsList));
    } catch(e) {}
  }

  // تخزين الإضافة في localStorage
  try {
    var raw = localStorage.getItem('aqyem_additions');
    var adds = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(adds)) adds = [];
    adds.push(newQuestion);
    localStorage.setItem('aqyem_additions', JSON.stringify(adds));
    // مزامنة إضافة السؤال سحابياً مباشرة مع قاعدة بيانات Firebase
    syncAddAqyemQuestionToCloud(newQuestion);
  } catch(e) {
    console.warn('Failed to save aqyem addition:', e);
  }

  closeEditorEdit();
  toast('➕ تمت إضافة السؤال بنجاح إلى بنك أُقيّم تعلّمي', 'ok');

  if (currentPageId === 'aqyem-questions') {
    renderAqyemQuestionsPage();
  } else if (currentPageId === 'aqyem-sem2') {
    renderAqyemSem2Page();
  } else if (currentPageId === 'aqyem-sem1') {
    renderAqyemSem1Page();
  } else if (currentPageId === 'aqyem') {
    renderAqyemHub();
  }
}
window.saveAddAqyemQuestion = saveAddAqyemQuestion;

// دوال تصفية أسئلة أقيم تعلمي
function setAqyemSem(s) {
  currentAqyemSem = s;
  currentAqyemUnit = 0;
  currentAqyemLesson = '';
  if (currentPageId === 'aqyem-questions') {
    renderAqyemQuestionsPage();
  } else {
    renderAqyemHub();
  }
}
window.setAqyemSem = setAqyemSem;

function setAqyemUnit(u) {
  currentAqyemUnit = u;
  currentAqyemLesson = '';
  if (currentPageId === 'aqyem-questions') {
    renderAqyemQuestionsPage();
  } else {
    renderAqyemHub();
  }
}
window.setAqyemUnit = setAqyemUnit;

function setAqyemType(t) {
  currentAqyemType = t;
  if (currentPageId === 'aqyem-questions') {
    renderAqyemQuestionsPage();
  } else {
    renderAqyemHub();
  }
}
window.setAqyemType = setAqyemType;

function setAqyemLesson(l) {
  currentAqyemLesson = l;
  if (currentPageId === 'aqyem-questions') {
    renderAqyemQuestionsPage();
  } else {
    renderAqyemHub();
  }
}
window.setAqyemLesson = setAqyemLesson;

function setAqyemSearch(str) {
  currentAqyemSearch = str;
  if (currentPageId === 'aqyem-questions') {
    renderAqyemQuestionsPage();
  } else {
    renderAqyemHub();
  }
}
window.setAqyemSearch = setAqyemSearch;

function toggleAqyemStudyMode(isActive) {
  aqyemSelfStudyMode = !!isActive;
  aqyemRevealedMap = {};
  aqyemUserSelectedAnswers = {};
  renderAqyemQuestionsPage();
  toast(aqyemSelfStudyMode ? 'تم تفعيل وضع التدريب الذاتي 🎓' : 'تم تفعيل وضع المراجعة المباشرة وإظهار الحلول ✨', 'ok');
}
window.toggleAqyemStudyMode = toggleAqyemStudyMode;

function revealAqyemAnswer(qId) {
  aqyemRevealedMap[qId] = true;
  renderAqyemQuestionsPage();
}
window.revealAqyemAnswer = revealAqyemAnswer;

function selectAqyemMcqOption(qId, oIdx) {
  aqyemUserSelectedAnswers[qId] = oIdx;
  aqyemRevealedMap[qId] = true;
  var allAqyem = getAqyemDataset();
  var q = allAqyem.find(function(item){ return item.id === qId; });
  if (q) {
    if (oIdx === q.correct) {
      toast('أحسنت! إجابة صحيحة ومطابقة للكتاب 👏', 'ok');
    } else {
      toast('إجابة غير صحيحة، تم كشف الإجابة المعتمدة والسند العلمي للتوضيح.', 'err');
    }
  }
  renderAqyemQuestionsPage();
}
window.selectAqyemMcqOption = selectAqyemMcqOption;

function revealAllAqyemAnswers() {
  var allAqyem = getAqyemDataset();
  allAqyem.forEach(function(q){
    aqyemRevealedMap[q.id] = true;
  });
  renderAqyemQuestionsPage();
  toast('تم كشف كافة الحلول والشروحات بنجاح', 'ok');
}
window.revealAllAqyemAnswers = revealAllAqyemAnswers;

function hideAllAqyemAnswers() {
  aqyemRevealedMap = {};
  aqyemUserSelectedAnswers = {};
  renderAqyemQuestionsPage();
  toast('تم إخفاء جميع الحلول للتدريب الذاتي', 'info');
}
window.hideAllAqyemAnswers = hideAllAqyemAnswers;

function resetAqyemFilters() {
  currentAqyemSem = 1;
  currentAqyemUnit = 0;
  currentAqyemType = 'all';
  currentAqyemLesson = '';
  currentAqyemSearch = '';
  aqyemRevealedMap = {};
  aqyemUserSelectedAnswers = {};
  if (currentPageId === 'aqyem-questions') {
    renderAqyemQuestionsPage();
  } else {
    renderAqyemHub();
  }
}
window.resetAqyemFilters = resetAqyemFilters;

function launchAqyemQuiz() {
  var allAqyem = getAqyemDataset();
  var pool = allAqyem.filter(function(q) {
    if (q.sem !== 1) return false;
    if (q.type !== 'mcq') return false; // أسئلة الاختيار من متعدد فقط للاختبار التفاعلي
    if (currentAqyemUnit > 0 && q.unitId !== currentAqyemUnit) return false;
    if (currentAqyemLesson && q.lesson !== currentAqyemLesson && normalizeLessonTitle(q.lesson) !== normalizeLessonTitle(currentAqyemLesson)) return false;
    if (currentAqyemSearch) {
      var s = currentAqyemSearch.toLowerCase().trim();
      var txt = (q.text || '').toLowerCase();
      var ans = (q.answer || '').toLowerCase();
      var expl = (q.explanation || '').toLowerCase();
      if (txt.indexOf(s) === -1 && ans.indexOf(s) === -1 && expl.indexOf(s) === -1) return false;
    }
    return true;
  });

  if (!pool.length) {
    toast('لا توجد أسئلة اختيار من متعدد مطابقة لبدء الاختبار التفاعلي', 'err');
    return;
  }

  // تحويل أسئلة أقيم تعلمي إلى هيئة عناصر الاختبار في البرنامج
  var quizItems = pool.map(function(q, i) {
    return {
      id: 90000 + q.id,
      qNum: q.qNum || (i + 1),
      sem: 1,
      lesson: q.lesson || 'أقيم تعلمي',
      text: q.text,
      options: q.options || [],
      answer: (typeof q.correct === 'number') ? q.correct : 0,
      explanation: q.explanation || q.answer || '',
      hint: q.explanation || ''
    };
  });

  var title = currentAqyemLesson
    ? ('اختبار أقيم تعلمي — ' + currentAqyemLesson)
    : (currentAqyemUnit > 0
        ? ('اختبار أقيم تعلمي — الوحدة ' + currentAqyemUnit)
        : 'اختبار أسئلة «أُقيّم تعلّمي» المعتمدة (الفصل الأول)');

  startQuizSession(quizItems, title);
}
window.launchAqyemQuiz = launchAqyemQuiz;

function speakSingleAqyem(qId) {
  var allAqyem = getAqyemDataset();
  var q = allAqyem.find(function(item){ return item.id === qId; });
  if (!q) {
    // محاولة البحث في بنك الأسئلة العام
    q = bank.find(function(item){ return item.id === qId; });
  }
  if (!q) return;

  var textToSpeak = '';
  if (q.type === 'mcq' && Array.isArray(q.options)) {
    var cIdx = (typeof q.correct === 'number') ? q.correct : (resolveQuestionAnswer(q));
    var cLetter = LBL[cIdx] || 'أ';
    var cText = q.options[cIdx] || '';
    var sanad = (q.explanation && q.explanation.trim()) ? q.explanation : '';
    textToSpeak = 'سؤال من درس ' + (q.lesson || '') + ' : ' + q.text + ' . الإجابة الصحيحة هي الخيار ' + cLetter + ' : ' + cText + (sanad ? (' . السند والشرح : ' + sanad) : '');
  } else {
    var cleanAns = (q.answer || '').replace(/[\n\r]+/g, ' . ');
    var sanad2 = (q.explanation && q.explanation.trim()) ? q.explanation : '';
    textToSpeak = 'سؤال من درس ' + (q.lesson || '') + ' : ' + q.text + ' . الإجابة النموذجية المعتمدة هي : ' + cleanAns + (sanad2 ? (' . السند والشرح : ' + sanad2) : '');
  }

  if (window.stopSpeaking) window.stopSpeaking();
  var rate = (typeof currentTtsRate !== 'undefined') ? currentTtsRate : 1;
  var audioUrl = '/api/tts?text=' + encodeURIComponent(textToSpeak) + '&rate=' + rate;
  var audio = new Audio(audioUrl);
  audio.play().catch(function(e){
    console.warn('TTS playback issue:', e);
    if (window.speechSynthesis) {
      var u = new SpeechSynthesisUtterance(textToSpeak);
      u.lang = 'ar-SA';
      u.rate = rate;
      window.speechSynthesis.speak(u);
    }
  });
  toast('جارٍ الاستماع للسؤال والحل بصوت عربي فصيح...', 'ok');
}
window.speakSingleAqyem = speakSingleAqyem;


// ══════════════════════════════════════════════
//  صفحة الدروس
// ══════════════════════════════════════════════
var selectedLessonSem = null;
function renderLessonPage() {
  currentQuizCategory = 'lesson';
  bankIndexById = lessonBankIndexById;
  var targetBank = (lessonBank && lessonBank.length) ? lessonBank : bank;
  var html = '<div class="page-title"><i class="fas fa-book-open"></i> اختبار حسب الدرس</div><div class="sem-cards">';
  [1,2].forEach(function(s){
    var cnt = targetBank.filter(function(q){return q.sem===s&&!q._examKey;}).length;
    html += '<div class="sem-card sem'+s+'" onclick="renderSemLessons('+s+')">' +
      '<div class="sc-icon">'+(s===1?'<i class="fas fa-book"></i>':'<i class="fas fa-book"></i>')+'</div>' +
      '<div class="sc-name">'+CUR[s].name+'</div><div class="sc-cnt">'+cnt+' سؤال</div></div>';
  });
  html += '</div><div id="sem-lessons-area"></div>';
  document.getElementById('lessons-inner').innerHTML = html;
  if (selectedLessonSem) {
    renderSemLessons(selectedLessonSem);
  }
}

function renderSemLessons(sem) {
  currentQuizCategory = 'lesson';
  bankIndexById = lessonBankIndexById;
  var targetBank = (lessonBank && lessonBank.length) ? lessonBank : bank;
  selectedLessonSem = sem;
  var html = '';
  CUR[sem].units.forEach(function(u){
    var hasQs = u.lessons.some(function(l){
      return targetBank.filter(function(q){return q.lesson===l&&!q._examKey;}).length > 0;
    });
    if (!hasQs) return;
    html += '<div class="unit-sec"><div class="unit-sec-hdr">الوحدة '+u.id+': '+u.name+'</div>';
    u.lessons.forEach(function(l){
      var cnt = targetBank.filter(function(q){return q.lesson===l&&!q._examKey;}).length;
      if (!cnt) return;
      html += '<div class="lesson-row" onclick="showLessonAction(\''+esc(l)+'\',\''+esc(u.name)+'\')">' +
        '<span class="lr-icon"><i class="fas fa-file-alt"></i></span>' +
        '<span class="lr-name">'+l+'</span>' +
        '<span class="lr-cnt">'+cnt+' سؤال</span>' +
        '<span class="lr-arrow"><i class="fas fa-chevron-left"></i></span></div>';
    });
    html += '</div>';
  });
  document.getElementById('sem-lessons-area').innerHTML = html;
  document.getElementById('sem-lessons-area').scrollIntoView({behavior:'smooth',block:'start'});
}

function showLessonAction(lesson, unitName) {
  currentQuizCategory = 'lesson';
  bankIndexById = lessonBankIndexById;
  var targetBank = (lessonBank && lessonBank.length) ? lessonBank : bank;
  if (!editorMode) {
    launchLessonQuiz(lesson);
    return;
  }
  var cnt = targetBank.filter(function(q){return q.lesson===lesson&&!q._examKey;}).length;
  var old = document.getElementById('lesson-action-box');
  if (old) old.remove();
  var box = document.createElement('div');
  box.id = 'lesson-action-box';
  box.className = 'action-box';
  // زر إضافة سؤال يظهر فقط في وضع المحرر للمشرف
  var addBtn = editorMode
    ? '<button class="btn-add-q" onclick="openAddQuestion(\''+esc(lesson)+'\')"><i class="fas fa-plus-circle"></i> إضافة سؤال للدرس</button>'
    : '';
  box.innerHTML =
    '<div class="ab-lesson"><i class="fas fa-file-alt"></i> '+lesson+'</div>' +
    '<div class="ab-unit">'+unitName+'</div>' +
    '<div class="ab-cnt">'+cnt+' سؤال متاح</div>' +
    '<div class="ab-actions">' +
      '<button class="btn-launch" onclick="launchLessonQuiz(\''+esc(lesson)+'\')">🚀 ابدأ الاختبار</button>' +
      addBtn +
    '</div>';
  document.getElementById('sem-lessons-area').appendChild(box);
  box.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function launchLessonQuiz(lessonName) {
  currentQuizCategory = 'lesson';
  bankIndexById = lessonBankIndexById;
  var targetBank = (lessonBank && lessonBank.length) ? lessonBank : bank;
  var qs = targetBank.filter(function(q){return q.lesson===lessonName&&!q._examKey;});
  if (!qs.length) { toast('لا توجد أسئلة في هذا الدرس','err'); return; }
  startQuizSession(qs, lessonName);
}

// ══════════════════════════════════════════════
//  صفحة الوحدات (نماذج ثابتة)
// ══════════════════════════════════════════════
function renderUnitPage() {
  currentQuizCategory = 'unit_ministerial';
  bankIndexById = unitBankIndexById;
  var targetBank = (unitMinisterialBank && unitMinisterialBank.length) ? unitMinisterialBank : bank;
  var html = '<div class="page-title"><i class="fas fa-cubes"></i> اختبار حسب الوحدة</div><div class="units-grid">';
  [1,2].forEach(function(s){
    CUR[s].units.forEach(function(u){
      var models = getUnitModels(u.id);
      var cnt = targetBank.filter(function(q){return q.unit===u.id&&!q._examKey;}).length;
      html += '<div class="unit-card-m usem'+s+'">' +
        '<div class="ucm-num">و'+u.id+'</div>' +
        '<div class="ucm-name">'+u.name+'</div>' +
        '<div class="ucm-sem">'+CUR[s].name+'</div>' +
        '<div class="ucm-cnt">'+cnt+' سؤال</div>' +
        '<div class="ucm-models">';
      if (models.length > 0) {
        models.forEach(function(m, idx){
          html += '<span class="model-badge" onclick="event.stopPropagation();launchUnitModel('+u.id+','+idx+')">نموذج '+(idx+1)+' ('+m.length+')</span>';
        });
      } else {
        html += '<span class="model-badge empty">لا توجد نماذج كاملة</span>';
      }
      html += '</div></div>';
    });
  });
  html += '</div>';
  document.getElementById('units-inner').innerHTML = html;
}

function launchUnitModel(unitId, modelIndex) {
  currentQuizCategory = 'unit_ministerial';
  bankIndexById = unitBankIndexById;
  var models = getUnitModels(unitId);
  if (!models[modelIndex]) { toast('النموذج غير متاح','err'); return; }
  var uName = '';
  [1,2].forEach(function(s){ CUR[s].units.forEach(function(u){ if(u.id===unitId) uName=u.name; }); });
  startQuizSession(models[modelIndex], uName + ' — نموذج ' + (modelIndex+1));
}

// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
//  صفحة النماذج الوزارية الشاملة (جدول المواصفات و 50 سؤالاً)
// ══════════════════════════════════════════════
var showSpecTable = false;
function toggleSpecTableView() {
  showSpecTable = !showSpecTable;
  var wrap = document.getElementById('spec-table-container');
  var btn = document.getElementById('spec-toggle-btn');
  if (wrap) wrap.style.display = showSpecTable ? 'block' : 'none';
  if (btn) {
    btn.innerHTML = showSpecTable 
      ? '<i class="fas fa-chevron-up"></i> إخفاء مصفوفة جدول المواصفات'
      : '<i class="fas fa-table"></i> عرض مصفوفة جدول المواصفات التفصيلية';
  }
}

function renderMinisterialPage() {
  currentQuizCategory = 'unit_ministerial';
  bankIndexById = unitBankIndexById;
  var models = getMinisterialModels();
  
  var html = '<div class="page-title"><i class="fas fa-star" style="color:#d97706;"></i> النماذج الوزارية الشاملة لشهادة الثانوية العامة</div>' +
    '<p style="margin:-6px 0 16px;color:var(--text2);font-size:13.5px;line-height:1.6;">' +
      'نماذج امتحانية معيارية تم بناؤها وتوزيعها استناداً إلى <strong>جدول مواصفات مبحث الثقافة المالية</strong> لكتابي الفصلين الأول والثاني، يتألف كل نموذج من <strong>50 سؤالاً</strong> تغطي كافة دروس المنهاج بالتساوي (200 علامة — زمن الإجابة: ساعتان).' +
    '</p>';

  // 1. بطاقة جدول المواصفات المقترح
  html += '<div class="spec-box">' +
    '<div class="spec-header">' +
      '<div class="spec-title-group">' +
        '<div class="spec-icon"><i class="fas fa-balance-scale"></i></div>' +
        '<div>' +
          '<div class="spec-title">جدول المواصفات المقترح - الثقافة المالية (التوجيهي)</div>' +
          '<div class="spec-subtitle">مقترح لمطابقة الورقة الامتحانية الوزارية الشاملة للفصلين الأول والثاني</div>' +
        '</div>' +
      '</div>' +
      '<button id="spec-toggle-btn" class="spec-toggle-btn" onclick="toggleSpecTableView()">' +
        '<i class="fas fa-table"></i> عرض مصفوفة جدول المواصفات التفصيلية' +
      '</button>' +
    '</div>' +
    
    // شارات الإحصاءات السريعة
    '<div class="spec-badges">' +
      '<div class="spec-badge primary"><i class="fas fa-list-ol"></i> <strong>50 فقرة</strong> اختيار من متعدد</div>' +
      '<div class="spec-badge gold"><i class="fas fa-award"></i> <strong>200 علامة</strong> (4 علامات/سؤال)</div>' +
      '<div class="spec-badge green"><i class="fas fa-clock"></i> زمن الامتحان: <strong>120 دقيقة</strong> (ساعتان)</div>' +
      '<div class="spec-badge"><i class="fas fa-book"></i> الفصل الأول: <strong>25 سؤالاً (50%)</strong></div>' +
      '<div class="spec-badge"><i class="fas fa-book-open"></i> الفصل الثاني: <strong>25 سؤالاً (50%)</strong></div>' +
      '<div class="spec-badge"><i class="fas fa-check-double"></i> شمول <strong>28 درساً</strong> بالكامل</div>' +
    '</div>' +

    // جدول المواصفات التفصيلي ومستويات بلوم
    '<div id="spec-table-container" style="display:' + (showSpecTable ? 'block' : 'none') + ';">' +
      '<div class="spec-table-wrap">' +
        '<table class="spec-table">' +
          '<thead>' +
            '<tr>' +
              '<th>الفصل</th>' +
              '<th>الوحدة الدراسية المقررة</th>' +
              '<th>عدد الدروس</th>' +
              '<th>الوزن النسبي</th>' +
              '<th>عدد الأسئلة</th>' +
              '<th>العلامات</th>' +
              '<th>التذكر (42%)</th>' +
              '<th>الفهم (34%)</th>' +
              '<th>التطبيق والتحليل (24%)</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            // الفصل الأول
            '<tr class="sem-head"><th colspan="9"><i class="fas fa-bookmark" style="color:#1a5276;"></i> الفصل الدراسي الأول (25 سؤالاً — 100 علامة — 50%)</th></tr>' +
            '<tr>' +
              '<td>الفصل 1</td>' +
              '<td><strong>الوحدة 1:</strong> الدورة المحاسبية في المؤسسات الخدمية</td>' +
              '<td>6 دروس</td>' +
              '<td>22%</td>' +
              '<td><strong>11</strong></td>' +
              '<td>44 علامة</td>' +
              '<td>4</td><td>4</td><td>3</td>' +
            '</tr>' +
            '<tr>' +
              '<td>الفصل 1</td>' +
              '<td><strong>الوحدة 2:</strong> القوائم المالية والتحليل المالي</td>' +
              '<td>4 دروس</td>' +
              '<td>14%</td>' +
              '<td><strong>7</strong></td>' +
              '<td>28 علامة</td>' +
              '<td>3</td><td>2</td><td>2</td>' +
            '</tr>' +
            '<tr>' +
              '<td>الفصل 1</td>' +
              '<td><strong>الوحدة 3:</strong> القطاع المالي (الأسواق، الأصول، البنك المركزي)</td>' +
              '<td>4 دروس</td>' +
              '<td>14%</td>' +
              '<td><strong>7</strong></td>' +
              '<td>28 علامة</td>' +
              '<td>3</td><td>2</td><td>2</td>' +
            '</tr>' +
            '<tr class="sem-subtotal">' +
              '<td colspan="2"><strong>مجموع الفصل الأول</strong></td>' +
              '<td>14 درساً</td>' +
              '<td>50%</td>' +
              '<td><strong>25 سؤالاً</strong></td>' +
              '<td>100 علامة</td>' +
              '<td>10</td><td>8</td><td>7</td>' +
            '</tr>' +

            // الفصل الثاني
            '<tr class="sem-head"><th colspan="9"><i class="fas fa-bookmark" style="color:#1e6b4a;"></i> الفصل الدراسي الثاني (25 سؤالاً — 100 علامة — 50%)</th></tr>' +
            '<tr>' +
              '<td>الفصل 2</td>' +
              '<td><strong>الوحدة 4:</strong> المؤسسات المالية الدولية (صندوق النقد والبنك الدولي)</td>' +
              '<td>3 دروس</td>' +
              '<td>12%</td>' +
              '<td><strong>6</strong></td>' +
              '<td>24 علامة</td>' +
              '<td>3</td><td>2</td><td>1</td>' +
            '</tr>' +
            '<tr>' +
              '<td>الفصل 2</td>' +
              '<td><strong>الوحدة 5:</strong> الاستدامة المالية والاقتصاد الأخضر</td>' +
              '<td>3 دروس</td>' +
              '<td>12%</td>' +
              '<td><strong>6</strong></td>' +
              '<td>24 علامة</td>' +
              '<td>2</td><td>3</td><td>1</td>' +
            '</tr>' +
            '<tr>' +
              '<td>الفصل 2</td>' +
              '<td><strong>الوحدة 6:</strong> الذكاء الاصطناعي التوليدي في عالَم المال والأعمال</td>' +
              '<td>4 دروس</td>' +
              '<td>12%</td>' +
              '<td><strong>6</strong></td>' +
              '<td>24 علامة</td>' +
              '<td>3</td><td>2</td><td>1</td>' +
            '</tr>' +
            '<tr>' +
              '<td>الفصل 2</td>' +
              '<td><strong>الوحدة 7:</strong> السياسات الاقتصادية وتأثيرها في التنمية والمجتمع</td>' +
              '<td>4 دروس</td>' +
              '<td>14%</td>' +
              '<td><strong>7</strong></td>' +
              '<td>28 علامة</td>' +
              '<td>3</td><td>2</td><td>2</td>' +
            '</tr>' +
            '<tr class="sem-subtotal">' +
              '<td colspan="2"><strong>مجموع الفصل الثاني</strong></td>' +
              '<td>14 درساً</td>' +
              '<td>50%</td>' +
              '<td><strong>25 سؤالاً</strong></td>' +
              '<td>100 علامة</td>' +
              '<td>11</td><td>9</td><td>5</td>' +
            '</tr>' +

            // الإجمالي العام
            '<tr class="grand-total">' +
              '<td colspan="2"><strong>المجموع العام للاختبار الوزاري</strong></td>' +
              '<td>28 درساً</td>' +
              '<td>100%</td>' +
              '<td><strong>50 سؤالاً</strong></td>' +
              '<td>200 علامة</td>' +
              '<td><strong>21 (42%)</strong></td>' +
              '<td><strong>17 (34%)</strong></td>' +
              '<td><strong>12 (24%)</strong></td>' +
            '</tr>' +
          '</tbody>' +
        '</table>' +
      '</div>' +

      // بطاقات مستويات بلوم
      '<div class="spec-bloom-grid">' +
        '<div class="spec-bloom-card b-remember">' +
          '<div class="bloom-name"><i class="fas fa-brain" style="color:#3b82f6;"></i> التذكر والمعرفة (42%)</div>' +
          '<div class="bloom-stat">21 سؤالاً <span style="font-size:13px;font-weight:normal;color:#64748b;">(84 علامة)</span></div>' +
          '<div class="bloom-desc">استدعاء المفاهيم، المصطلحات، التواريخ، والتعريفات المالية المباشرة من الكتابين.</div>' +
        '</div>' +
        '<div class="spec-bloom-card b-understand">' +
          '<div class="bloom-name"><i class="fas fa-lightbulb" style="color:#10b981;"></i> الفهم والاستيعاب (34%)</div>' +
          '<div class="bloom-stat">17 سؤالاً <span style="font-size:13px;font-weight:normal;color:#64748b;">(68 علامة)</span></div>' +
          '<div class="bloom-desc">تفسير السياسات والعمليات، استنتاج النتائج، ومقارنة الأدوات والوظائف المصرفية والمالية.</div>' +
        '</div>' +
        '<div class="spec-bloom-card b-apply">' +
          '<div class="bloom-name"><i class="fas fa-calculator" style="color:#f59e0b;"></i> التطبيق والتحليل (24%)</div>' +
          '<div class="bloom-stat">12 سؤالاً <span style="font-size:13px;font-weight:normal;color:#64748b;">(48 علامة)</span></div>' +
          '<div class="bloom-desc">حل القيود المحاسبية، النسب المالية، القوائم الختامية، وتحليل أثر السياسات الاقتصادية والذكاء الاصطناعي.</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  // 2. بطاقات النماذج الوزارية المعيارية الـ 5
  if (models.length === 0) {
    html += '<div class="no-data-box">' +
      '<i class="fas fa-exclamation-triangle"></i>' +
      '<p>لا يمكن إنشاء نماذج وزارية حالياً</p>' +
      '<p style="margin-top:8px;color:var(--text2);font-size:13px">يتطلب كل نموذج وزاري 50 سؤالاً من أسئلة الدروس موزعة طبقاً لجدول المواصفات</p></div>';
  } else {
    html += '<div style="font-weight:800;font-size:15px;color:#1e293b;margin-bottom:8px;display:flex;align-items:center;gap:8px;">' +
      '<i class="fas fa-scroll" style="color:#d97706;"></i> النماذج الوزارية المقترحة (50 سؤالاً لكل نموذج):' +
    '</div>';

    html += '<div class="min-models-grid">';
    models.forEach(function(m, idx) {
      var sem1Count = m.filter(function(q){ return q.unit <= 3; }).length;
      var sem2Count = m.filter(function(q){ return q.unit >= 4; }).length;
      
      html += '<div class="min-model-box" onclick="launchMinModel(' + idx + ')">' +
        '<div class="min-model-badge-bar">' +
          '<span class="min-model-badge">50 سؤالاً — 200 علامة</span>' +
        '</div>' +
        '<div class="min-model-title">النموذج الوزاري الشامل المقترح رقم (' + (idx + 1) + ')</div>' +
        '<div class="min-model-desc">' +
          'محاكاة حقيقية للاختبار الوزاري الشامل تغطي كافة دروس الكتابين المقررة (28 درساً).' +
        '</div>' +
        '<div class="min-model-dist">' +
          '• <strong>الفصل الأول (' + sem1Count + ' سؤالاً):</strong> و1: 11 | و2: 7 | و3: 7<br>' +
          '• <strong>الفصل الثاني (' + sem2Count + ' سؤالاً):</strong> و4: 6 | و5: 6 | و6: 6 | و7: 7' +
        '</div>' +
        '<button class="min-model-btn" onclick="event.stopPropagation(); launchMinModel(' + idx + ');">' +
          '<i class="fas fa-pen-alt"></i> ابدأ الاختبار الوزاري (50 سؤالاً)' +
        '</button>' +
      '</div>';
    });
    html += '</div>';

    // 3. شريط توليد نموذج وزاري عشوائي متوافق مع جدول المواصفات
    html += '<div class="min-random-bar">' +
      '<div class="min-random-info">' +
        '<i class="fas fa-random"></i>' +
        '<div>' +
          '<div class="min-random-title">توليد نموذج وزاري عشوائي جديد (50 سؤالاً)</div>' +
          '<div class="min-random-sub">يتم سحب 50 سؤالاً عشوائياً ممثلاً لجدول المواصفات من كامل بنك أسئلة الدروس (284 سؤالاً) لتدريب لا محدود.</div>' +
        '</div>' +
      '</div>' +
      '<button class="btn-random-generate" onclick="launchRandomMinisterialExam()">' +
        '<i class="fas fa-magic"></i> توليد وبدء نموذج عشوائي' +
      '</button>' +
    '</div>';
  }

  document.getElementById('ministerial-inner').innerHTML = html;
}

function launchMinModel(modelIndex) {
  currentQuizCategory = 'unit_ministerial';
  bankIndexById = unitBankIndexById;
  var models = getMinisterialModels();
  if (!models[modelIndex]) { toast('النموذج غير متاح', 'err'); return; }
  startQuizSession(models[modelIndex], 'النموذج الوزاري الشامل المقترح رقم ' + (modelIndex + 1));
}

function launchRandomMinisterialExam() {
  currentQuizCategory = 'unit_ministerial';
  bankIndexById = unitBankIndexById;
  var model = generateRandomMinisterialModel();
  if (!model || model.length < 50) { toast('تعذر توليد النموذج العشوائي', 'err'); return; }
  startQuizSession(model, 'نموذج وزاري تجريبي عشوائي (50 سؤالاً)');
}

// ══════════════════════════════════════════════
//  صفحة التقويمات
// ══════════════════════════════════════════════
var selectedExamSem = null;
function renderExamPage() {
  currentQuizCategory = 'unit_ministerial';
  bankIndexById = unitBankIndexById;
  var html = '<div class="page-title"><i class="fas fa-clipboard-list"></i> أسئلة التقويم</div><div class="sem-cards">' +
    '<div class="sem-card sem1" onclick="renderSemExams(1)"><div class="sc-icon"><i class="fas fa-book"></i></div><div class="sc-name">الفصل الأول</div><div class="sc-cnt">تقويمي ١ و٢ و٣ + النهائي</div></div>' +
    '<div class="sem-card sem2" onclick="renderSemExams(2)"><div class="sc-icon"><i class="fas fa-book"></i></div><div class="sc-name">الفصل الثاني</div><div class="sc-cnt">تقويمي ١ و٢ + النهائي</div></div>' +
    '</div><div id="sem-exam-area"></div>';
  document.getElementById('exams-inner').innerHTML = html;
  if (selectedExamSem) {
    renderSemExams(selectedExamSem);
  }
}

function renderSemExams(sem) {
  selectedExamSem = sem;
  currentQuizCategory = 'unit_ministerial';
  bankIndexById = unitBankIndexById;
  var targetBank = (unitMinisterialBank && unitMinisterialBank.length) ? unitMinisterialBank : bank;
  var list = sem===1
    ? [{k:'tq1_f1',label:'التقويم الأول'},{k:'tq2_f1',label:'التقويم الثاني'},{k:'tq3_f1',label:'التقويم الثالث'},{k:'final_f1',label:'الاختبار النهائي'}]
    : [{k:'tq1_f2',label:'التقويم الأول'},{k:'tq2_f2',label:'التقويم الثاني'},{k:'final_f2',label:'الاختبار النهائي'}];
  var html = '<div class="exam-list">';
  var found = false;
  list.forEach(function(e){
    var qs = targetBank.filter(function(q){return q._examKey===e.k;});
    if (!qs.length) return;
    found = true;
    html += '<div class="exam-item" onclick="launchExamQuiz(\''+e.k+'\',\''+e.label+' — '+CUR[sem].name+'\')">' +
      '<span class="ei-icon"><i class="fas fa-file-alt"></i></span>' +
      '<span class="ei-name">'+e.label+'</span>' +
      '<span class="ei-cnt">'+qs.length+' سؤال</span>' +
      '<span class="ei-go">ابدأ <i class="fas fa-chevron-left"></i></span></div>';
  });
  html += '</div>';
  if (!found) {
    html = '<div class="no-data-box" style="margin-top:20px"><i class="fas fa-inbox"></i><p>لا توجد أسئلة تقويمية مضافة لهذا الفصل بعد</p></div>' + html;
  }
  document.getElementById('sem-exam-area').innerHTML = html;
  document.getElementById('sem-exam-area').scrollIntoView({behavior:'smooth',block:'start'});
}

function launchExamQuiz(examKey, title) {
  currentQuizCategory = 'unit_ministerial';
  bankIndexById = unitBankIndexById;
  var targetBank = (unitMinisterialBank && unitMinisterialBank.length) ? unitMinisterialBank : bank;
  var qs = targetBank.filter(function(q){return q._examKey===examKey;});
  if (!qs.length) { toast('لا توجد أسئلة','err'); return; }
  startQuizSession(qs, title);
}

// ══════════════════════════════════════════════
//  محرك الاختبار والتأمين (Secure Quiz Engine)
// ══════════════════════════════════════════════

// خزانة داخلية مشفرة لمفاتيح الإجابات لضمان عدم ظهورها في كائن السؤال أو واجهة الطالب قبل التسليم
var _secureAnswerVault = {};

function registerQuestionAnswer(qId, answerIdx) {
  if (qId !== undefined && answerIdx !== undefined) {
    _secureAnswerVault[qId] = answerIdx;
  }
}

// استخراج وحل مؤشر الإجابة الصحيحة عند التحقق فقط
function resolveQuestionAnswer(q) {
  var qId = q.id;
  var rawAns;
  if (_secureAnswerVault[qId] !== undefined) {
    rawAns = _secureAnswerVault[qId];
  } else if (q._secureAnswer !== undefined) {
    rawAns = q._secureAnswer;
  } else if (q.answer !== undefined) {
    rawAns = q.answer;
  } else {
    rawAns = 0;
  }

  // مطابقة الإجابة مع الخيارات الصالحة غير الفارغة
  var opts = q.options || [];
  var idxMap = [];
  for (var k = 0; k < opts.length; k++) {
    if (opts[k] && String(opts[k]).trim()) {
      idxMap.push(k);
    }
  }
  var a = idxMap.indexOf(rawAns);
  if (a === -1) a = 0;
  return a;
}

// تصفية الخيارات واستخراج النصوص النقية فقط دون أي مؤشرات للإجابة
function getCleanOptions(q) {
  var opts = q.options || [];
  var v = [];
  for (var k = 0; k < opts.length; k++) {
    if (opts[k] && String(opts[k]).trim()) {
      v.push(opts[k]);
    }
  }
  return v;
}

// دالة التحقق والتوافق القديمة (تُستخدم فقط عند استخراج النتائج أو المراجعة بعد التسليم)
function validInfo(q) {
  var v = getCleanOptions(q);
  var a = resolveQuestionAnswer(q);
  return { opts: v, answerIdx: a };
}

// ══════════════════════════════════════════════
//  محرك خلط الأسئلة ومواقع الإجابات الصحيحة في كل مرة يعود فيها الطالب
// ══════════════════════════════════════════════

// خلط خيارات السؤال عشوائياً وتغيير موقع الإجابة الصحيحة تلقائياً وبدقة
function shuffleQuestionOptions(origQ) {
  var cleanQ = Object.assign({}, origQ);

  // استخراج مؤشر الإجابة الصحيحة الحالي
  var origAns = 0;
  if (origQ.answer !== undefined) {
    origAns = origQ.answer;
  } else if (origQ._secureAnswer !== undefined) {
    origAns = origQ._secureAnswer;
  } else if (_secureAnswerVault[origQ.id] !== undefined) {
    origAns = _secureAnswerVault[origQ.id];
  }

  var rawOpts = Array.isArray(origQ.options) ? origQ.options.slice() : [];

  // إذا لم يكن هناك خيارات كافية للخلط
  if (!rawOpts || rawOpts.length <= 1) {
    cleanQ.options = rawOpts;
    cleanQ._secureAnswer = origAns;
    registerQuestionAnswer(cleanQ.id, origAns);
    delete cleanQ.answer;
    return cleanQ;
  }

  // الاحتفاظ بنص الخيار الصحيح قبل الخلط
  var correctOptText = rawOpts[origAns];
  if (correctOptText === undefined || correctOptText === null) {
    correctOptText = rawOpts[0];
    origAns = 0;
  }

  // تصفية الخيارات غير الفارغة
  var validList = [];
  for (var i = 0; i < rawOpts.length; i++) {
    var itemText = rawOpts[i];
    if (itemText !== undefined && itemText !== null && String(itemText).trim() !== '') {
      validList.push({
        text: itemText,
        isCorrect: (i === origAns || itemText === correctOptText)
      });
    }
  }

  if (validList.length <= 1) {
    cleanQ.options = rawOpts;
    cleanQ._secureAnswer = origAns;
    registerQuestionAnswer(cleanQ.id, origAns);
    delete cleanQ.answer;
    return cleanQ;
  }

  // التأكد من وجود خيار صحيح واحد
  var correctCount = validList.filter(function(v){ return v.isCorrect; }).length;
  if (correctCount === 0) {
    validList[0].isCorrect = true;
  } else if (correctCount > 1) {
    var foundFirst = false;
    for (var k = 0; k < validList.length; k++) {
      if (validList[k].isCorrect) {
        if (!foundFirst) foundFirst = true;
        else validList[k].isCorrect = false;
      }
    }
  }

  // فحص ما إذا كان هناك خيار خاص "جميع ما ذكر" أو "لا شيء مما ذكر" ويُفضّل إبقاؤه في النهاية
  var lastOptionIndex = -1;
  for (var vIdx = 0; vIdx < validList.length; vIdx++) {
    var t = String(validList[vIdx].text).trim();
    if (t === 'جميع ما ذكر' || t === 'كل ما ذكر' || t === 'لا شيء مما ذكر' || t === 'جميع ما سبق' || t === 'كل ما سبق') {
      lastOptionIndex = vIdx;
      break;
    }
  }

  var finalItems = [];
  if (lastOptionIndex !== -1) {
    var specialItem = validList[lastOptionIndex];
    var others = validList.filter(function(_, idx){ return idx !== lastOptionIndex; });
    var shuffledOthers = shuf(others);
    finalItems = shuffledOthers.concat([specialItem]);
  } else {
    finalItems = shuf(validList);
  }

  var newOptions = [];
  var newCorrectIndex = 0;
  for (var m = 0; m < finalItems.length; m++) {
    newOptions.push(finalItems[m].text);
    if (finalItems[m].isCorrect) {
      newCorrectIndex = m;
    }
  }

  cleanQ.options = newOptions;
  cleanQ._secureAnswer = newCorrectIndex;
  registerQuestionAnswer(cleanQ.id, newCorrectIndex);
  delete cleanQ.answer;

  return cleanQ;
}

// تجهيز مجموعة الأسئلة مع خلط أماكن الأسئلة وتغيير مواقع الإجابات الصحيحة في كل مرة
function prepareQuiz(qs, skipQuestionShuffle) {
  if (!Array.isArray(qs)) return [];

  // 1) تغيير أماكن وترتيب الأسئلة عشوائياً في كل مرة يدخل أو يعود فيها الطالب للاختبار
  var pool = skipQuestionShuffle ? qs.slice() : shuf(qs);

  // 2) تغيير وتدوير مواقع الإجابات الصحيحة والخيارات عشوائياً لكل سؤال
  return pool.map(function(orig) {
    return shuffleQuestionOptions(orig);
  });
}

// ══════════════════════════════════════════════
//  إدارة الجلسات والحفظ المؤقت لتقدم الطلاب (localStorage)
// ══════════════════════════════════════════════
function saveQuizProgress() {
  try {
    if (!currentQuiz || !currentQuiz.length || currentPageId !== 'quiz') return;
    var session = {
      title: currentQuizTitle || 'الاختبار',
      mode: currentMode,
      originPage: quizOriginPage || 'home',
      qIds: currentQuiz.map(function(q){ return q.id; }),
      savedQuestions: currentQuiz.map(function(q){
        return {
          id: q.id,
          options: q.options,
          _secureAnswer: resolveQuestionAnswer(q),
          text: q.text,
          lesson: q.lesson,
          hint: q.hint,
          sem: q.sem,
          unit: q.unit
        };
      }),
      userAnswers: userAnswers || {},
      timeLeft: timeLeft || 0,
      timestamp: Date.now()
    };
    localStorage.setItem('qbank_student_session', JSON.stringify(session));
  } catch(e) {
    console.warn('[Session] تعذر حفظ الجلسة محلياً:', e);
  }
}

function clearQuizProgress() {
  try {
    localStorage.removeItem('qbank_student_session');
  } catch(e){}
}

function getActiveSession() {
  try {
    var raw = localStorage.getItem('qbank_student_session');
    if (!raw) return null;
    var session = JSON.parse(raw);
    if (!session || !Array.isArray(session.qIds) || !session.qIds.length) return null;
    // صلاحية الجلسة 48 ساعة
    if (Date.now() - (session.timestamp || 0) > 48 * 3600 * 1000) {
      localStorage.removeItem('qbank_student_session');
      return null;
    }
    return session;
  } catch(e){
    return null;
  }
}

function buildActiveSessionBanner() {
  var session = getActiveSession();
  if (!session) return '';
  var answeredCount = Object.keys(session.userAnswers || {}).length;
  var totalCount = session.qIds.length;
  var modeText = session.mode === 'exam' ? 'امتحاني' : 'تدريبي';

  return '<div class="active-session-banner" id="active-session-card">' +
    '<div class="asb-header">' +
      '<div class="asb-icon"><i class="fas fa-history"></i></div>' +
      '<div class="asb-info">' +
        '<div class="asb-title"><i class="fas fa-bookmark"></i> لديك اختبار محفوظ مؤقتاً لم ينتهِ بعد!</div>' +
        '<div class="asb-meta"><strong>' + escHtml(session.title) + '</strong> (' + modeText + ') — تم الإجابة على <strong>' + answeredCount + '</strong> من <strong>' + totalCount + '</strong> سؤال.</div>' +
      '</div>' +
    '</div>' +
    '<div class="asb-actions">' +
      '<button class="asb-btn-resume" onclick="resumeStudentSession()"><i class="fas fa-play"></i> متابعة الاختبار</button>' +
      '<button class="asb-btn-discard" onclick="discardStudentSession()"><i class="fas fa-trash-alt"></i> إلغاء الجلسة</button>' +
    '</div>' +
  '</div>';
}

function resumeStudentSession() {
  var session = getActiveSession();
  if (!session) {
    toast('لا توجد جلسة اختبار محفوظة حالياً', 'warn');
    return;
  }

  if (Array.isArray(session.savedQuestions) && session.savedQuestions.length) {
    currentQuiz = session.savedQuestions.map(function(sq){
      registerQuestionAnswer(sq.id, sq._secureAnswer);
      return Object.assign({}, sq);
    });
  } else {
    var restoredQs = [];
    session.qIds.forEach(function(id){
      var idx = bankIndexById[id];
      if (idx !== undefined && bank[idx]) {
        restoredQs.push(bank[idx]);
      }
    });

    if (!restoredQs.length) {
      toast('تعذر استعادة أسئلة الاختبار المحفوظ، يرجى بدء اختبار جديد', 'err');
      clearQuizProgress();
      renderHome();
      return;
    }
    currentQuiz = prepareQuiz(restoredQs, true);
  }

  quizSubmitted = false;
  currentQuizTitle = session.title || 'الاختبار المستأنف';
  currentMode = session.mode || 'train';
  quizOriginPage = session.originPage || 'home';
  userAnswers = session.userAnswers || {};
  timeLeft = session.timeLeft || 0;

  renderQuiz();

  // استعادة الحالات المرئية للإجابات السابقة بعد إعادة بناء الواجهة
  var answeredIndices = Object.keys(userAnswers);
  answeredIndices.forEach(function(qiStr){
    var qi = parseInt(qiStr, 10);
    var oi = userAnswers[qi];
    var q = currentQuiz[qi];
    if (!q) return;
    var opts = getCleanOptions(q);

    if (currentMode === 'train') {
      var correctIdx = resolveQuestionAnswer(q);
      for (var j = 0; j < opts.length; j++) {
        var el = document.getElementById('qopt-' + qi + '-' + j);
        if (!el) continue;
        el.classList.add('locked');
        if (j === correctIdx) el.classList.add('correct');
        else if (j === oi && oi !== correctIdx) el.classList.add('wrong');
      }
      var card = document.getElementById('qcard-' + qi);
      if (card) card.classList.add(oi === correctIdx ? 'q-correct' : 'q-wrong');
      var fb = document.getElementById('qfb-' + qi);
      if (fb) {
        fb.style.display = 'block';
        var ok = (oi === correctIdx);
        fb.className = 'qfb ' + (ok ? 'fb-ok' : 'fb-err');
        fb.innerHTML = ok ? '✅ إجابة صحيحة! أحسنت.' : '❌ خطأ — الصحيح: <strong>' + LBL[correctIdx] + ' — ' + opts[correctIdx] + '</strong>';
      }
      // إظهار تلميح الكتاب أيضاً للأسئلة المُجاب عليها في النمط التدريبي
      var hintBox = document.getElementById('qhint-' + qi);
      if (hintBox) {
        hintBox.style.display = 'block';
        var hintBtn = document.getElementById('qhint-btn-' + qi);
        if (hintBtn) {
          hintBtn.classList.add('active');
          hintBtn.innerHTML = '<i class="fas fa-lightbulb"></i> إخفاء التلميح';
        }
      }
    } else {
      var sel = document.getElementById('qopt-' + qi + '-' + oi);
      if (sel) sel.className = 'qopt exam-sel';
    }
  });

  updProgress(answeredIndices.length);
  updQNav();

  clearInterval(timerInterval);
  if (currentMode === 'exam' && timeLeft > 0) {
    startTimer(timeLeft);
  } else if (currentMode === 'exam') {
    startTimer(currentQuiz.length * 60);
  }

  goTo('quiz');
  toast('تمت استعادة تقدمك وإجاباتك بنجاح!', 'ok');
}
window.resumeStudentSession = resumeStudentSession;

function discardStudentSession() {
  if (window.confirm('هل تريد بالتأكيد إلغاء جلسة الاختبار المحفوظة والبدء من جديد؟')) {
    clearQuizProgress();
    renderHome();
    toast('تم إلغاء الجلسة السابقة بنجاح', 'ok');
  }
}
window.discardStudentSession = discardStudentSession;

// ══════════════════════════════════════════════
//  تسجيل الطالب وتوثيق البيانات قبل بدء الاختبار
// ══════════════════════════════════════════════

var pendingQuizData = null;

function getStudentProfile() {
  try {
    var raw = localStorage.getItem('qbank_student_profile');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) {
    return null;
  }
}
window.getStudentProfile = getStudentProfile;

function openStudentRegModal() {
  var ov = document.getElementById('student-reg-overlay');
  if (ov) ov.classList.add('open');
}
window.openStudentRegModal = openStudentRegModal;

function closeStudentRegModal(e) {
  if (e && e.target && e.target.id !== 'student-reg-overlay') return;
  var ov = document.getElementById('student-reg-overlay');
  if (ov) ov.classList.remove('open');
}
window.closeStudentRegModal = closeStudentRegModal;

function showNewStudentForm() {
  var ret = document.getElementById('student-reg-returning');
  var frm = document.getElementById('student-reg-form');
  if (ret) ret.style.display = 'none';
  if (frm) frm.style.display = 'block';
  var student = getStudentProfile();
  if (student) {
    var inEmail = document.getElementById('input-student-email');
    var inName = document.getElementById('input-student-name');
    var inSchool = document.getElementById('input-student-school');
    if (inEmail && student.email) inEmail.value = student.email;
    if (inName && student.name) inName.value = student.name;
    if (inSchool && student.school) inSchool.value = student.school;
  }
}
window.showNewStudentForm = showNewStudentForm;

function confirmExistingStudentAndLaunch() {
  closeStudentRegModal();
  if (pendingQuizData) {
    executeStartQuiz(pendingQuizData.qs, pendingQuizData.title);
    pendingQuizData = null;
  }
}
window.confirmExistingStudentAndLaunch = confirmExistingStudentAndLaunch;

function requestStudentRegistrationBeforeQuiz(qs, title) {
  // عند الدخول كمعلم / في وضع المحرر: لا يلزمه التسجيل على جوجل، ويبدأ الاختبار فوراً للمعاينة
  if (editorMode) {
    executeStartQuiz(qs, title);
    return;
  }

  pendingQuizData = { qs: qs, title: title };
  var student = getStudentProfile();
  var ret = document.getElementById('student-reg-returning');
  var frm = document.getElementById('student-reg-form');
  var errEl = document.getElementById('student-reg-err');
  if (errEl) errEl.style.display = 'none';

  if (student && student.email) {
    // الطالب مسجل مسبقاً: بدء الاختبار فوراً بالنمط المختار
    executeStartQuiz(qs, title);
    pendingQuizData = null;
    toast('بدأ الاختبار بالنمط ' + (currentMode === 'train' ? 'التدريبي' : 'الامتحاني') + '، بالتوفيق!', 'ok');
    return;
  } else {
    // طالب لأول مرة: فتح نموذج إدخال إيميل جوجل والاسم
    if (ret) ret.style.display = 'none';
    if (frm) frm.style.display = 'block';
  }
  openStudentRegModal();
}

async function submitStudentRegistrationAndLaunch() {
  var errEl = document.getElementById('student-reg-err');
  var inEmail = document.getElementById('input-student-email');
  var inName = document.getElementById('input-student-name');
  var inSchool = document.getElementById('input-student-school');

  var email = inEmail ? inEmail.value.trim() : '';
  var name = inName ? inName.value.trim() : '';
  var school = inSchool ? inSchool.value.trim() : '';

  if (!email || !email.includes('@') || !email.includes('.')) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = 'يرجى إدخال بريد Google صالح (مثال: student@gmail.com)';
    }
    if (inEmail) inEmail.focus();
    return;
  }

  if (!name || name.length < 3) {
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = 'يرجى إدخال اسم الطالب / الطالبة ثلاثياً للمتابعة';
    }
    if (inName) inName.focus();
    return;
  }

  if (errEl) errEl.style.display = 'none';

  var profile = {
    email: email.toLowerCase(),
    name: name,
    school: school,
    registeredAt: new Date().toISOString()
  };

  try {
    localStorage.setItem('qbank_student_profile', JSON.stringify(profile));
  } catch(e) {}

  // إرسال البيانات لسيرفر Firebase بهدوء في الخلفية
  fetch('/api/student/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  }).catch(function(err){ console.warn('Reg sync:', err); });

  closeStudentRegModal();
  toast('مرحباً بك يا ' + name + '، نتمنى لك التوفيق في اختبارك!', 'ok');

  if (pendingQuizData) {
    executeStartQuiz(pendingQuizData.qs, pendingQuizData.title);
    pendingQuizData = null;
  }
}
window.submitStudentRegistrationAndLaunch = submitStudentRegistrationAndLaunch;

// تسجيل سريع بنقرة واحدة عبر حساب Google
async function signInWithGooglePopup() {
  var errEl = document.getElementById('student-reg-err');
  if (errEl) errEl.style.display = 'none';
  toast('جاري الاتصال بحساب Google...', 'info');

  try {
    var fbAppModule = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    var fbAuthModule = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');

    var cfgRes = await fetch('/firebase-applet-config.json');
    var config = await cfgRes.json();
    var app = fbAppModule.getApps().length ? fbAppModule.getApp() : fbAppModule.initializeApp(config);
    var auth = fbAuthModule.getAuth(app);
    var provider = new fbAuthModule.GoogleAuthProvider();

    var result = await fbAuthModule.signInWithPopup(auth, provider);
    if (result && result.user) {
      var email = result.user.email || '';
      var name = result.user.displayName || email.split('@')[0];
      var inEmail = document.getElementById('input-student-email');
      var inName = document.getElementById('input-student-name');
      if (inEmail) inEmail.value = email;
      if (inName) inName.value = name;

      var startEmail = document.getElementById('start-student-email');
      var startName = document.getElementById('start-student-name');
      if (startEmail) startEmail.value = email;
      if (startName) startName.value = name;

      var inSchool = document.getElementById('input-student-school');
      var profile = {
        email: email.toLowerCase(),
        name: name,
        school: inSchool ? inSchool.value.trim() : '',
        registeredAt: new Date().toISOString()
      };
      try {
        localStorage.setItem('qbank_student_profile', JSON.stringify(profile));
      } catch(e) {}
      fetch('/api/student/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      }).catch(function(err){ console.warn('Reg sync:', err); });

      if (typeof initStartStudentForm === 'function') {
        try { initStartStudentForm(); } catch(e) {}
      }
      toast('تم تسجيل الدخول بحساب Google بنجاح: ' + name, 'ok');

      if (pendingQuizData) {
        setTimeout(function(){
          closeStudentRegModal();
          executeStartQuiz(pendingQuizData.qs, pendingQuizData.title);
          pendingQuizData = null;
        }, 300);
      }
      return;
    }
  } catch(e) {
    console.warn('Google sign-in popup error:', e);
    if (errEl) {
      errEl.style.display = 'block';
      errEl.textContent = 'إذا تعذر فتح نافذة Google، يمكنك كتابة إيميل Google واسمك في الحقول أدناه والمتابعة مباشرة.';
    }
  }
}
window.signInWithGooglePopup = signInWithGooglePopup;

// ══════════════════════════════════════════════
//  نافذة اختيار نمط الاختبار (التدريبي أو الامتحاني) قبل البدء
// ══════════════════════════════════════════════
function startQuizSession(qs, title) {
  pendingQuizData = { qs: qs, title: title };

  var titleEl = document.getElementById('qmode-quiz-title');
  var countEl = document.getElementById('qmode-quiz-count');
  if (titleEl) titleEl.textContent = title || 'اختبار في مادة الثقافة المالية';
  if (countEl) countEl.textContent = 'عدد الأسئلة المقررة: ' + (qs ? qs.length : 0) + ' سؤالاً';

  openQuizModeModal();
}
window.startQuizSession = startQuizSession;

function openQuizModeModal() {
  var overlay = document.getElementById('quiz-mode-select-overlay');
  if (overlay) {
    overlay.classList.add('open');
    var body = document.getElementById('quiz-mode-modal-body') || overlay.querySelector('.editor-modal-body');
    if (body) {
      body.scrollTop = 0;
      initQuizModeScrollSync();
    }
    var btnTrain = document.getElementById('btn-tab-train');
    var btnExam = document.getElementById('btn-tab-exam');
    if (btnTrain && btnExam) {
      btnTrain.classList.add('active');
      btnExam.classList.remove('active');
    }
  }
}
window.openQuizModeModal = openQuizModeModal;

function scrollToQModeCard(mode) {
  var card = document.querySelector('.quiz-mode-card.qmc-' + mode);
  var body = document.getElementById('quiz-mode-modal-body') || document.querySelector('.quiz-mode-modal .editor-modal-body');
  if (card && body) {
    var topPos = card.offsetTop - body.offsetTop - 10;
    body.scrollTo({ top: Math.max(0, topPos), behavior: 'smooth' });
  }
  var btnTrain = document.getElementById('btn-tab-train');
  var btnExam = document.getElementById('btn-tab-exam');
  if (btnTrain && btnExam) {
    if (mode === 'train') {
      btnTrain.classList.add('active');
      btnExam.classList.remove('active');
    } else {
      btnExam.classList.add('active');
      btnTrain.classList.remove('active');
    }
  }
}
window.scrollToQModeCard = scrollToQModeCard;

function initQuizModeScrollSync() {
  var body = document.getElementById('quiz-mode-modal-body');
  if (!body || body._scrollSyncInitialized) return;
  body._scrollSyncInitialized = true;
  body.addEventListener('scroll', function() {
    var examCard = document.querySelector('.quiz-mode-card.qmc-exam');
    var btnTrain = document.getElementById('btn-tab-train');
    var btnExam = document.getElementById('btn-tab-exam');
    if (!examCard || !btnTrain || !btnExam) return;
    var examTop = examCard.offsetTop - body.offsetTop;
    if (body.scrollTop >= examTop - 80) {
      btnExam.classList.add('active');
      btnTrain.classList.remove('active');
    } else {
      btnTrain.classList.add('active');
      btnExam.classList.remove('active');
    }
  }, { passive: true });
}

function closeQuizModeModal(e) {
  if (e && e.target && e.target.id !== 'quiz-mode-select-overlay' && !e.target.closest('.editor-modal-close')) {
    return;
  }
  var overlay = document.getElementById('quiz-mode-select-overlay');
  if (overlay) overlay.classList.remove('open');
}
window.closeQuizModeModal = closeQuizModeModal;

function selectQuizModeAndProceed(mode) {
  setMode(mode);
  var overlay = document.getElementById('quiz-mode-select-overlay');
  if (overlay) overlay.classList.remove('open');

  if (!pendingQuizData || !pendingQuizData.qs) return;

  // بعد تحديد النمط، بدء الاختبار مباشرة إذا كان الطالب مسجلاً أو فتح التسجيل لأول مرة
  requestStudentRegistrationBeforeQuiz(pendingQuizData.qs, pendingQuizData.title);
}
window.selectQuizModeAndProceed = selectQuizModeAndProceed;

// تشغيل الاختبار الفعلي وبدء المؤقت
function executeStartQuiz(qs, title) {
  quizSubmitted = false;
  var origin = (currentPageId && currentPageId !== 'quiz' && currentPageId !== 'result' && currentPageId !== 'start') ? currentPageId : (quizOriginPage || 'home');
  quizOriginPage = origin;
  currentQuiz = prepareQuiz(qs);
  currentQuizTitle = title;
  userAnswers = {};
  renderQuiz();
  clearInterval(timerInterval);
  if (currentMode === 'exam') {
    var examSeconds = (currentQuiz.length >= 50 || (title && title.indexOf('وزاري') !== -1)) ? (120 * 60) : (currentQuiz.length * 60);
    startTimer(examSeconds);
  } else {
    timeLeft = 0;
    var timerEl = document.getElementById('qtimer');
    if (timerEl) timerEl.style.display = 'none';
  }
  goTo('quiz');
  saveQuizProgress();
}

// ══════════════════════════════════════════════
//  التلميحات وعرض الاختبار
// ══════════════════════════════════════════════
function toggleHint(i) {
  var box = document.getElementById('qhint-' + i);
  var btn = document.getElementById('qhint-btn-' + i);
  if (!box) return;
  var isHidden = (box.style.display === 'none' || !box.style.display);
  if (isHidden) {
    box.style.display = 'block';
    if (btn) {
      btn.classList.add('active');
      btn.innerHTML = '<i class="fas fa-lightbulb"></i> إخفاء التلميح';
    }
  } else {
    box.style.display = 'none';
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = '<i class="fas fa-lightbulb"></i> تلميح';
    }
  }
}
window.toggleHint = toggleHint;

function renderQuiz() {
  var modeTxt = currentMode==='exam' ? '<i class="fas fa-pen-fancy"></i> امتحاني' : '<i class="fas fa-book-open"></i> تدريبي';
  var html =
    '<div class="quiz-hdr">' +
      '<div class="qhdr-nav-row">' +
        '<div class="qhdr-nav-group">' +
          '<button type="button" class="qhdr-nav-btn" onclick="goBack()" title="الرجوع إلى الصفحة السابقة"><i class="fas fa-arrow-right"></i> رجوع</button>' +
          '<button type="button" class="qhdr-nav-btn" onclick="goHome()" title="العودة إلى الصفحة الرئيسية"><i class="fas fa-home"></i> الرئيسية</button>' +
          '<button type="button" class="qhdr-nav-btn qhdr-share-btn" onclick="openShareModal(\'quiz\')" title="مشاركة رابط هذا الاختبار مع الزملاء"><i class="fas fa-share-alt"></i> مشاركة</button>' +
          '<button type="button" class="qhdr-nav-btn qhdr-tts-btn' + (isTtsBarOpen ? ' active' : '') + '" id="qhdr-tts-btn" onclick="toggleTtsBar()" title="شريط القراءة الصوتية وسهولة الوصول لذوي التحديات البصرية"><i class="fas fa-headphones"></i> قارئ الأسئلة</button>' +
        '</div>' +
        '<div class="qhdr-mode">' + modeTxt + '</div>' +
      '</div>' +
      '<div class="qhdr-row">' +
        '<span class="qhdr-title">'+(currentQuizTitle||'الاختبار')+'</span>' +
        (currentMode==='exam'?'<span id="qtimer" class="qtimer"></span>':'') +
      '</div>' +
      buildTtsToolbar() +
      '<div class="qprog-bar"><div class="qprog-fill" id="qpfill" style="width:0%"></div></div>' +
      '<div class="qprog-txt" id="qptxt">0 / '+currentQuiz.length+'</div></div><div id="qarea">';

  currentQuiz.forEach(function(q, i){
    var cleanOpts = getCleanOptions(q);
    // أزرار التحرير والحذف — تظهر فقط وحصرياً إذا كان وضع المحرر مفعلاً من قبل المشرف
    var editBtn = editorMode ? '<button class="qedit-btn" onclick="event.stopPropagation();openEditorEdit('+q.id+')" title="تحرير هذا السؤال"><i class="fas fa-edit"></i> تحرير</button>' : '';
    var delBtn = editorMode ? '<button class="qdel-btn" onclick="event.stopPropagation();confirmDeleteQuestion('+q.id+')" title="حذف هذا السؤال نهائياً من البرنامج و Firebase"><i class="fas fa-trash-alt"></i> حذف</button>' : '';
    var teacherBtns = editorMode ? '<div class="qcard-editor-btns" style="display:inline-flex;align-items:center;gap:4px;margin-right:auto;">' + editBtn + delBtn + '</div>' : '';
    
    // زر القراءة الصوتية لدعم سهولة الوصول للطلاب ذوي التحديات البصرية
    var speakBtn = '<button type="button" class="qspeak-btn" id="qspeak-btn-'+i+'" onclick="event.stopPropagation();toggleSpeakQuestion('+i+')" title="استمع للسؤال والخيارات صوتياً (قارئ الشاشة)" aria-label="استمع للسؤال رقم '+(i+1)+' والخيارات صوتياً"><i class="fas fa-volume-up"></i> <span>استمع للسؤال</span></button>';

    // زر التلميح: يظهر حصرياً في النمط التدريبي (train) ويُلغى تماماً في النمط الامتحاني (exam)
    var hintBtn = '';
    if (currentMode === 'train' && q.hint && q.hint.trim()) {
      hintBtn = '<button class="qhint-btn" id="qhint-btn-'+i+'" onclick="event.stopPropagation();toggleHint('+i+')" title="عرض تلميح مستخرج من كتاب الطالب"><i class="fas fa-lightbulb"></i> تلميح</button>';
    }

    html += '<div class="qcard" id="qcard-'+i+'">' +
      '<div class="qcard-top">' +
        '<div class="qcard-top-right"><span class="qbadge">س'+(i+1)+'</span><span class="qmeta">'+(q.lesson||'')+'</span></div>' +
        '<div class="qcard-actions" style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
          speakBtn +
          hintBtn +
          teacherBtns +
        '</div>' +
      '</div>' +
      '<div class="qtext" id="qtext-'+i+'">'+formatQuestionContent(q.text)+'</div><div class="qopts">';
    cleanOpts.forEach(function(opt, j){
      html += '<div class="qopt" id="qopt-'+i+'-'+j+'" onclick="pick('+i+','+j+')">' +
        '<span class="qoc">'+LBL[j]+'</span><span class="qot">'+formatOptionDisplay(opt)+'</span></div>';
    });
    html += '</div>';

    // التلميحات بالأصل مخفية في كل الأسئلة، ولا تظهر إلا في السؤال نفسه عند ضغط زر التلميح الخاص به
    // وتظهر فقط في النمط التدريبي، بينما في النمط الامتحاني لا تظهر إطلاقاً أثناء الاختبار
    if (currentMode === 'train' && q.hint && q.hint.trim()) {
      html += '<div class="qhint-box" id="qhint-'+i+'" style="display:none;"><i class="fas fa-lightbulb"></i> <strong>تلميح:</strong> '+escHtml(q.hint.replace(/^من كتاب الطالب:\s*/, ''))+'</div>';
    }
    if (currentMode==='train') html += '<div class="qfb" id="qfb-'+i+'" style="display:none"></div>';
    html += '</div>';
  });
  html += '</div>';
  document.getElementById('quiz-inner').innerHTML = html +
    '<button class="btn-finish" onclick="finishQuiz()">✅ إنهاء وعرض النتيجة</button>' +
    '<div class="quiz-bottom-actions">' +
      '<button type="button" class="qbtm-btn qbtm-share-btn" onclick="openShareModal(\'quiz\')" title="مشاركة رابط هذا الاختبار مع الزملاء"><i class="fas fa-share-alt" style="color:#25d366;"></i> مشاركة رابط الاختبار</button>' +
      '<button type="button" class="qbtm-btn" onclick="goBack()" title="الرجوع إلى الصفحة السابقة"><i class="fas fa-arrow-right"></i> الرجوع للصفحة السابقة</button>' +
      '<button type="button" class="qbtm-btn" onclick="goHome()" title="العودة إلى الصفحة الرئيسية"><i class="fas fa-home"></i> الصفحة الرئيسية</button>' +
    '</div>';
  updProgress(0);
}

function pick(qi, oi) {
  var q = currentQuiz[qi];
  if (!q) return;

  // في النمط التدريبي، لا يمكن تغيير الإجابة بعد تسليمها
  if (currentMode === 'train' && userAnswers[qi] !== undefined) return;
  userAnswers[qi] = oi;
  saveQuizProgress();

  var cleanOpts = getCleanOptions(q);

  for (var j = 0; j < cleanOpts.length; j++) {
    var el = document.getElementById('qopt-' + qi + '-' + j);
    if (el) el.className = 'qopt';
  }

  if (currentMode === 'train') {
    // التأكد من أن مفتاح الإجابة الصحيحة لا ينكشف إلا بعد قيام الطالب باختيار إجابته وتسليم السؤال
    var correctIdx = resolveQuestionAnswer(q);
    for (var j = 0; j < cleanOpts.length; j++) {
      var el = document.getElementById('qopt-' + qi + '-' + j);
      if (!el) continue;
      el.classList.add('locked');
      if (j === correctIdx) el.classList.add('correct');
      else if (j === oi && oi !== correctIdx) el.classList.add('wrong');
    }
    var card = document.getElementById('qcard-' + qi);
    if (card) card.classList.add(oi === correctIdx ? 'q-correct' : 'q-wrong');
    var fb = document.getElementById('qfb-' + qi);
    if (fb) {
      fb.style.display = 'block';
      var ok = (oi === correctIdx);
      fb.className = 'qfb ' + (ok ? 'fb-ok' : 'fb-err');
      var fbText = ok ? '✅ إجابة صحيحة! أحسنت.' : '❌ خطأ — الإجابة الصحيحة هي <strong>(' + LBL[correctIdx] + ')</strong>:<div class="qfb-correct-opt">' + formatOptionDisplay(cleanOpts[correctIdx]) + '</div>';
      fb.innerHTML = fbText;
    }

    // إظهار تلميح الكتاب تلقائياً عند الإجابة على السؤال في النمط التدريبي
    var hintBox = document.getElementById('qhint-' + qi);
    if (hintBox) {
      hintBox.style.display = 'block';
      var hintBtn = document.getElementById('qhint-btn-' + qi);
      if (hintBtn) {
        hintBtn.classList.add('active');
        hintBtn.innerHTML = '<i class="fas fa-lightbulb"></i> إخفاء التلميح';
      }
    }
  } else {
    // في النمط الامتحاني، يتم تحديد الخيار المختار فقط دون الكشف عن صحته أو خطئه
    var sel = document.getElementById('qopt-' + qi + '-' + oi);
    if (sel) sel.className = 'qopt exam-sel';
  }
  updProgress(Object.keys(userAnswers).length);
  updQNav();
}

function updProgress(n) {
  var total = currentQuiz.length;
  var pct = Math.round(n/total*100);
  var f = document.getElementById('qpfill');
  var t = document.getElementById('qptxt');
  if (f) f.style.width = pct+'%';
  if (t) t.textContent = n+' / '+total;
}

function finishQuiz() {
  if (window.stopSpeaking) window.stopSpeaking();
  quizSubmitted = true;
  clearInterval(timerInterval);
  clearQuizProgress();
  showResults();
}

// ══════════════════════════════════════════════
//  خريطة الأسئلة
// ══════════════════════════════════════════════
function toggleQNav() {
  var ov = document.getElementById('qnav-overlay');
  ov.classList.toggle('open');
  if (ov.classList.contains('open')) updQNav();
}

function updQNav() {
  var grid = document.getElementById('qnav-grid');
  if (!grid) return;
  var html = '';
  currentQuiz.forEach(function(q, i){
    var cls = '';
    if (userAnswers[i] === undefined) {
      cls = '';
    } else if (currentMode === 'train') {
      cls = (userAnswers[i] === resolveQuestionAnswer(q)) ? 'nd-correct' : 'nd-wrong';
    } else {
      // في النمط الامتحاني، تُعرض فقط كأنها أُجيبت دون كشف صحتها
      cls = 'nd-answered';
    }
    html += '<div class="qnav-dot '+cls+'" onclick="jumpToQ('+i+')">'+(i+1)+'</div>';
  });
  grid.innerHTML = html;
}

function jumpToQ(i) {
  var el = document.getElementById('qcard-'+i);
  if (el) el.scrollIntoView({behavior:'smooth',block:'center'});
  document.getElementById('qnav-overlay').classList.remove('open');
}

// ══════════════════════════════════════════════
//  النتائج والتحليل
// ══════════════════════════════════════════════
function showResults() {
  var total=currentQuiz.length, correct=0, wrong=0, skipped=0;
  currentQuiz.forEach(function(q,i){
    if (userAnswers[i]===undefined) skipped++;
    else if (userAnswers[i]===validInfo(q).answerIdx) correct++;
    else wrong++;
  });
  var pct = Math.round(correct/total*100);
  var g = pct>=90?{t:'ممتاز 🏆',c:'#27ae60',bg:'#d4edda'}
    :pct>=80?{t:'جيد جداً ⭐',c:'#2980b9',bg:'#d4e8f5'}
    :pct>=70?{t:'جيد 👍',c:'#8e44ad',bg:'#ead7f5'}
    :pct>=60?{t:'مقبول 📖',c:'#f39c12',bg:'#fef9e7'}
    :{t:'يحتاج مراجعة 💪',c:'#e74c3c',bg:'#f8d7da'};

  // دائرة النتيجة
  var circ = 2 * Math.PI * 65; // نصف قطر 65
  var offset = circ - (pct / 100) * circ;

  var student = getStudentProfile();
  var studentBanner = '';
  if (editorMode) {
    studentBanner = (
      '<div class="student-result-banner" style="background:#eaf2f8;border:1.5px solid #aed6f1;border-radius:12px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">' +
        '<div>' +
          '<div style="font-size:15px;font-weight:800;color:#1b4f72;"><i class="fas fa-user-shield" style="color:#2874a6;margin-left:6px;"></i> تجربة المعلم والمصمم (وضع المحرر)</div>' +
          '<div style="font-size:12px;color:#2c3e50;margin-top:2px;">معاينة حية للاختبار — لا يلزمك التسجيل على Google</div>' +
        '</div>' +
        '<div style="font-size:12px;color:#1b4f72;font-weight:700;background:#d4e6f1;padding:4px 12px;border-radius:20px;"><i class="fas fa-check"></i> نمط المعلم</div>' +
      '</div>'
    );
  } else if (student) {
    studentBanner = (
      '<div class="student-result-banner" style="background:#eef6fc;border:1.5px solid #bddaf2;border-radius:12px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">' +
        '<div>' +
          '<div style="font-size:15px;font-weight:800;color:#1a3a5c;"><i class="fas fa-user-graduate" style="color:#2980b9;margin-left:6px;"></i> الطالب: ' + escHtml(student.name) + '</div>' +
          '<div style="font-size:12px;color:#555;margin-top:2px;"><i class="fab fa-google" style="color:#ea4335;margin-left:4px;"></i> ' + escHtml(student.email) + (student.school ? ' • ' + escHtml(student.school) : '') + '</div>' +
        '</div>' +
        '<div style="font-size:12px;color:#27ae60;font-weight:700;background:#d4edda;padding:4px 12px;border-radius:20px;"><i class="fas fa-check-circle"></i> نتيجة موثقة ومحفوظة</div>' +
      '</div>'
    );
  }

  // تسجيل محاولة الطالب في Firebase سحابياً (فقط للطلاب وليس لتجارب المعلم في وضع المحرر)
  if (!editorMode && student && student.email) {
    fetch('/api/student/submit-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentEmail: student.email,
        studentName: student.name,
        school: student.school || '',
        quizTitle: currentQuizTitle,
        mode: currentMode,
        score: correct,
        total: total,
        percentage: pct,
        timeSpent: (currentQuiz.length * 60 - timeLeft) + ' ثانية',
        submittedAt: new Date().toISOString()
      })
    }).catch(function(e){ console.warn('Submit attempt err:', e); });
  }

  window.latestQuizResult = {
    title: currentQuizTitle || 'اختبار الثقافة المالية',
    score: correct,
    total: total,
    percentage: pct,
    gradeText: g.t,
    gradeColor: g.c,
    studentName: (student && student.name) ? student.name : '',
    school: (student && student.school) ? student.school : '',
    mode: currentMode
  };

  var html =
    studentBanner +
    '<div class="score-card">' +
      '<div class="score-svg"><svg viewBox="0 0 150 150">' +
        '<circle class="score-bg-c" cx="75" cy="75" r="65"/>' +
        '<circle class="score-fill-c" id="score-arc" cx="75" cy="75" r="65" stroke-dasharray="'+circ+'" stroke-dashoffset="'+circ+'"/>' +
      '</svg><div class="score-pct-text"><span class="score-pct-num" id="score-num">0</span><span class="score-pct-sign">%</span></div></div>' +
      '<div class="sc-frac">'+correct+' / '+total+'</div>' +
      '<div class="sc-grade" style="background:'+g.bg+';color:'+g.c+'">'+g.t+'</div>' +
    '</div>' +
    '<div class="stats3">' +
      '<div class="s3box c"><div class="s3v">'+correct+'</div><div class="s3l">✅ صحيحة</div></div>' +
      '<div class="s3box w"><div class="s3v">'+wrong+'</div><div class="s3l">❌ خاطئة</div></div>' +
      '<div class="s3box s"><div class="s3v">'+skipped+'</div><div class="s3l">⏭ متروكة</div></div>' +
    '</div>' +
    buildResultShareCard() +
    buildAnalytics() +
    (currentMode==='exam' ? buildReview() : '') +
    '<div class="res-actions">' +
      '<button class="btn-retry btn-share-res" onclick="openShareModal(\'result\')"><i class="fas fa-share-alt"></i> مشاركة النتيجة مع الزملاء</button>' +
      '<button class="btn-retry" onclick="retryQuiz()">🔄 إعادة الاختبار</button>' +
      '<button class="btn-retry" style="background:#fff;color:var(--pr);border:1.5px solid var(--bd);" onclick="goBack()"><i class="fas fa-arrow-right"></i> الرجوع للصفحة السابقة</button>' +
      '<button class="btn-retry" style="background:var(--pr);color:#fff;" onclick="goHome()"><i class="fas fa-home"></i> الصفحة الرئيسية</button>' +
    '</div>';

  document.getElementById('result-inner').innerHTML = html;
  goTo('result');

  // تحريك الدائرة والرقم
  requestAnimationFrame(function(){
    setTimeout(function(){
      var arc = document.getElementById('score-arc');
      if (arc) arc.style.strokeDashoffset = offset;
      animateNum('score-num', 0, pct, 1200);
    }, 100);
  });
}

function animateNum(elId, from, to, dur) {
  var el = document.getElementById(elId);
  if (!el) return;
  var start = performance.now();
  function step(now) {
    var t = Math.min((now - start) / dur, 1);
    var ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * ease);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function buildAnalytics() {
  var unitMap = {};
  currentQuiz.forEach(function(q,i){
    var uid=q.unit||0; if(!uid) return;
    if(!unitMap[uid]){
      var uname='';
      [1,2].forEach(function(s){CUR[s].units.forEach(function(u){if(u.id===uid)uname=u.name;});});
      unitMap[uid]={name:uname,total:0,correct:0};
    }
    unitMap[uid].total++;
    if(userAnswers[i]===validInfo(q).answerIdx) unitMap[uid].correct++;
  });
  var keys=Object.keys(unitMap);
  if(keys.length<=1) return '';
  var weak=[];
  var rows=keys.map(function(uid){
    var u=unitMap[uid]; if(!u.total) return '';
    var pct=Math.round(u.correct/u.total*100);
    var c=pct>=80?'var(--success)':pct>=60?'var(--warning)':'var(--error)';
    if(pct<60) weak.push(u.name);
    return '<div class="arow"><div class="arow-name">'+u.name+'</div>' +
      '<div class="arow-bar"><div style="width:'+pct+'%;background:'+c+';height:100%;border-radius:4px"></div></div>' +
      '<div class="arow-pct" style="color:'+c+'">'+pct+'%</div></div>';
  }).join('');
  var advice = weak.length
    ? '<div class="advice-box">💡 <strong>تحتاج مراجعة:</strong> '+weak.join(' — ')+'</div>'
    : '<div class="advice-box ok">🌟 أداء ممتاز في جميع الوحدات!</div>';
  return '<div class="analytics-box"><div class="sec-title">📊 تحليل الأداء حسب الوحدة</div>'+rows+advice+'</div>';
}

function buildReview() {
  var html='<div class="review-box"><div class="sec-title">📋 مراجعة الإجابات</div>';
  currentQuiz.forEach(function(q,i){
    var vi = validInfo(q);
    var correctIdx = vi.answerIdx;
    var ans=userAnswers[i], skip=ans===undefined, ok=!skip&&ans===correctIdx;
    var sc=skip?'rs':ok?'rok':'rerr';
    var st=skip?'⏭ لم تُجب':ok?'✅ صحيحة':'❌ خاطئة';
    var editBtn = editorMode ? '<button class="qedit-btn redit-btn" onclick="event.stopPropagation();openEditorEdit('+q.id+')" title="تحرير هذا السؤال"><i class="fas fa-edit"></i></button>' : '';
    var delBtn = editorMode ? '<button class="qdel-btn redit-btn" onclick="event.stopPropagation();confirmDeleteQuestion('+q.id+')" title="حذف هذا السؤال نهائياً من البرنامج و Firebase"><i class="fas fa-trash-alt"></i></button>' : '';
    var rSpeakBtn = '<button type="button" class="qspeak-btn rspeak-btn" id="rspeak-btn-'+i+'" onclick="event.stopPropagation();toggleSpeakReview('+i+')" title="استمع لمراجعة هذا السؤال والإجابة الصحيحة"><i class="fas fa-volume-up"></i> <span>استمع للمراجعة</span></button>';
    var reviewBtns = '<div style="margin-right:auto;display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;">' + rSpeakBtn + (editorMode ? (editBtn + delBtn) : '') + '</div>';
    html+='<div class="rcard '+sc+'" id="rcard-'+i+'"><div class="rcard-hdr"><span class="rbadge">س'+(i+1)+'</span><span class="rstatus">'+st+'</span>'+reviewBtns+'</div>' +
      '<div class="rqtext" id="rqtext-'+i+'">'+formatQuestionContent(q.text)+'</div><div class="ropts">';
    vi.opts.forEach(function(o,j){
      var lc=j===correctIdx?'rlbl-ok':j===ans&&!ok&&!skip?'rlbl-err':'';
      var tc=j===correctIdx?'color:var(--success);font-weight:700':j===ans&&!ok?'color:var(--error)':'';
      html+='<div class="ropt" id="ropt-'+i+'-'+j+'"><span class="rlbl '+lc+'">'+LBL[j]+'</span><span class="ropt-txt" style="'+tc+'">'+formatOptionDisplay(o)+'</span></div>';
    });
    html+='</div>';
    if (q.hint && q.hint.trim()) {
      html += '<div class="rhint-box"><i class="fas fa-lightbulb"></i> <strong>تلميح:</strong> ' + escHtml(q.hint.replace(/^من كتاب الطالب:\s*/, '')) + '</div>';
    } else if (editorMode) {
      html += '<div class="rhint-box rhint-empty" onclick="event.stopPropagation();openEditorEdit('+q.id+')" style="cursor:pointer;border-style:dashed;color:#92400e;background:#fffbeb;"><i class="fas fa-plus-circle"></i> <em>لا يوجد تلميح مسجل لهذا السؤال — انقر لإضافة تلميح</em></div>';
    }
    html += '<div class="rmeta">📌 '+(q.lesson||'')+'</div></div>';
  });
  return html+'</div>';
}

function retryQuiz() {
  if (window.stopSpeaking) window.stopSpeaking();
  quizSubmitted = false;
  userAnswers = {};
  currentQuiz = prepareQuiz(shuf(currentQuiz));
  renderQuiz();
  clearInterval(timerInterval);
  if (currentMode === 'exam') {
    startTimer(currentQuiz.length * 60);
  }
  showPage('quiz');
  saveQuizProgress();
}

// ══════════════════════════════════════════════
//  المؤقت
// ══════════════════════════════════════════════
function startTimer(sec) {
  timeLeft = sec;
  var el = document.getElementById('qtimer');
  if (el) el.style.display = 'inline-block';
  updTimer();
  timerInterval = setInterval(function(){
    timeLeft--;
    updTimer();
    if (timeLeft % 5 === 0) saveQuizProgress();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      finishQuiz();
    }
  }, 1000);
}
function updTimer() {
  var el=document.getElementById('qtimer'); if(!el) return;
  var m=Math.floor(timeLeft/60),s=timeLeft%60;
  el.textContent='⏱ '+pad(m)+':'+pad(s);
  el.style.color=timeLeft<=60?'var(--error)':'var(--text2)';
}
function pad(n){return n<10?'0'+n:''+n;}

// ══════════════════════════════════════════════
//  أدوات مساعدة
// ══════════════════════════════════════════════
function shuf(a){
  var b=a.slice();
  for(var i=b.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=b[i];b[i]=b[j];b[j]=t;}
  return b;
}
function esc(s){return (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");}

function toast(msg, type) {
  var box = document.getElementById('toast-box');
  var t = document.createElement('div');
  t.className = 'toast toast-' + (type||'warn');
  t.textContent = msg;
  box.appendChild(t);
  requestAnimationFrame(function(){ t.classList.add('show'); });
  setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){ t.remove(); }, 300); }, 2500);
}

// ══════════════════════════════════════════════
//  وظائف مشاركة الاختبار والنتائج عبر وسائل التواصل
// ══════════════════════════════════════════════
var currentShareTab = 'quiz';

function buildResultShareCard() {
  return (
    '<div class="result-share-card">' +
      '<div class="rsc-header">' +
        '<div class="rsc-icon"><i class="fas fa-award"></i></div>' +
        '<div class="rsc-info">' +
          '<div class="rsc-title">شارك نتيجتك وتحدَّ زملاءك!</div>' +
          '<div class="rsc-sub">انشر نتيجتك أو رابط الاختبار مباشرة لزملائك في الصف والتوجيهي عبر وسائل التواصل</div>' +
        '</div>' +
        '<button type="button" class="rsc-main-share-btn" onclick="openShareModal(\'result\')">' +
          '<i class="fas fa-share-nodes"></i> خيارات المشاركة' +
        '</button>' +
      '</div>' +
      '<div class="rsc-quick-grid">' +
        '<button type="button" class="rsc-qbtn rsc-wa" onclick="quickShare(\'whatsapp\', \'result\')" title="مشاركة عبر واتساب"><i class="fa-brands fa-whatsapp"></i> واتساب</button>' +
        '<button type="button" class="rsc-qbtn rsc-tg" onclick="quickShare(\'telegram\', \'result\')" title="مشاركة عبر تيليجرام"><i class="fa-brands fa-telegram"></i> تيليجرام</button>' +
        '<button type="button" class="rsc-qbtn rsc-fb" onclick="quickShare(\'facebook\', \'result\')" title="مشاركة عبر فيسبوك"><i class="fa-brands fa-facebook-f"></i> فيسبوك</button>' +
        '<button type="button" class="rsc-qbtn rsc-x" onclick="quickShare(\'x\', \'result\')" title="مشاركة عبر إكس"><i class="fa-brands fa-x-twitter"></i> إكس</button>' +
        '<button type="button" class="rsc-qbtn rsc-cp" onclick="copyCurrentShareText(\'result\')" title="نسخ رابط ونتيجة الاختبار"><i class="fas fa-copy"></i> نسخ النتيجة والرابط</button>' +
      '</div>' +
    '</div>'
  );
}

function getShareBaseUrl() {
  try {
    return window.location.origin + window.location.pathname;
  } catch(e) {
    return window.location.href;
  }
}

function getShareData(type) {
  var baseUrl = getShareBaseUrl();
  var title = currentQuizTitle || 'اختبار مادة الثقافة المالية';
  var modeLabel = (currentMode === 'exam') ? 'امتحاني' : 'تدريبي';
  
  if (type === 'result' && window.latestQuizResult) {
    var res = window.latestQuizResult;
    var studentName = res.studentName ? ('الطالب/ة: ' + res.studentName + '\n') : '';
    var text = '🎓 نتيجة اختبار في الثقافة المالية (التوجيهي)\n' +
      studentName +
      '📌 الاختبار: ' + res.title + '\n' +
      '🏆 النتيجة: ' + res.score + ' من ' + res.total + ' (' + res.percentage + '%)\n' +
      '⭐ التقدير: ' + res.gradeText + '\n\n' +
      '💪 هل يمكنك تحقيق درجة أفضل؟ جرّب الاختبار الآن وتحداني:';
    return {
      title: 'نتيجة اختبار: ' + res.title,
      text: text,
      url: baseUrl,
      fullMessage: text + '\n🔗 ' + baseUrl
    };
  }

  // وضع مشاركة رابط الاختبار
  var quizCount = (currentQuiz && currentQuiz.length) ? (' (' + currentQuiz.length + ' سؤالاً)') : '';
  var qText = '📚 أدعوك لخوض ' + title + quizCount + '\n' +
    '🌟 منصة بنك أسئلة الثقافة المالية لشهادة الثانوية العامة (التوجيهي)\n' +
    '🎯 النمط: ' + modeLabel + '\n\n' +
    'ابدأ الاختبار الآن وتدرّب عبر الرابط المباشر:';
  return {
    title: title,
    text: qText,
    url: baseUrl,
    fullMessage: qText + '\n🔗 ' + baseUrl
  };
}

function openShareModal(initialTab) {
  var overlay = document.getElementById('share-modal-overlay');
  if (!overlay) return;
  
  var targetTab = initialTab || (window.latestQuizResult ? 'result' : 'quiz');
  if (targetTab === 'result' && !window.latestQuizResult) {
    targetTab = 'quiz';
  }
  
  var resultTabBtn = document.getElementById('tab-share-result');
  if (resultTabBtn) {
    if (!window.latestQuizResult) {
      resultTabBtn.style.opacity = '0.5';
      resultTabBtn.style.pointerEvents = 'none';
      resultTabBtn.title = 'تتاح بعد إنهاء أي اختبار';
    } else {
      resultTabBtn.style.opacity = '1';
      resultTabBtn.style.pointerEvents = 'auto';
      resultTabBtn.title = '';
    }
  }

  overlay.classList.add('open');
  switchShareTab(targetTab);
}

function closeShareModal(e) {
  var overlay = document.getElementById('share-modal-overlay');
  if (!overlay) return;
  if (e && e.target && e.target !== overlay) return;
  overlay.classList.remove('open');
}

function switchShareTab(tab) {
  currentShareTab = tab;
  var tabQuiz = document.getElementById('tab-share-quiz');
  var tabResult = document.getElementById('tab-share-result');
  if (tabQuiz) tabQuiz.className = (tab === 'quiz') ? 'share-tab active' : 'share-tab';
  if (tabResult) tabResult.className = (tab === 'result') ? 'share-tab active' : 'share-tab';

  var shareData = getShareData(tab);
  var badgeEl = document.getElementById('spc-badge');
  var textEl = document.getElementById('spc-text');
  var urlEl = document.getElementById('spc-url');
  var inputEl = document.getElementById('share-copy-input');

  if (badgeEl) {
    badgeEl.innerHTML = (tab === 'result')
      ? '<i class="fas fa-trophy"></i> بطاقة نتيجة معتمدة وموثقة'
      : '<i class="fas fa-link"></i> رابط الاختبار المباشر';
  }
  if (textEl) textEl.textContent = shareData.text;
  if (urlEl) urlEl.textContent = shareData.url;
  if (inputEl) inputEl.value = shareData.url;
}

function triggerSocialShare(platform) {
  var data = getShareData(currentShareTab);
  var url = data.url;
  var text = data.text;
  var full = data.fullMessage;

  if (platform === 'whatsapp') {
    var waUrl = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(full);
    window.open(waUrl, '_blank');
  } else if (platform === 'telegram') {
    var tgUrl = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);
    window.open(tgUrl, '_blank');
  } else if (platform === 'facebook') {
    var fbUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '&quote=' + encodeURIComponent(text);
    window.open(fbUrl, '_blank');
  } else if (platform === 'x') {
    var xUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(full);
    window.open(xUrl, '_blank');
  } else if (platform === 'native') {
    if (navigator.share) {
      navigator.share({
        title: data.title,
        text: data.text,
        url: data.url
      }).catch(function(err){
        if (err.name !== 'AbortError') {
          copyShareTextContent(full);
        }
      });
    } else {
      copyShareTextContent(full);
    }
  }
}

function quickShare(platform, type) {
  var data = getShareData(type || 'result');
  var url = data.url;
  var text = data.text;
  var full = data.fullMessage;

  if (platform === 'whatsapp') {
    window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(full), '_blank');
  } else if (platform === 'telegram') {
    window.open('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text), '_blank');
  } else if (platform === 'facebook') {
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '&quote=' + encodeURIComponent(text), '_blank');
  } else if (platform === 'x') {
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(full), '_blank');
  }
}

function copyShareFromModal() {
  var data = getShareData(currentShareTab);
  copyShareTextContent(data.fullMessage);
}

function copyCurrentShareText(type) {
  var data = getShareData(type);
  copyShareTextContent(data.fullMessage);
}

function copyShareTextContent(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function(){
      toast('تم نسخ رسالة ورابط المشاركة إلى الحافظة بنجاح! 📋', 'ok');
    }).catch(function(){
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    toast('تم نسخ رسالة ورابط المشاركة إلى الحافظة بنجاح! 📋', 'ok');
  } catch(e) {
    toast('يرجى نسخ الرابط يدوياً', 'err');
  }
  document.body.removeChild(ta);
}

window.buildResultShareCard = buildResultShareCard;
window.openShareModal = openShareModal;
window.closeShareModal = closeShareModal;
window.switchShareTab = switchShareTab;
window.triggerSocialShare = triggerSocialShare;
window.quickShare = quickShare;
window.copyShareFromModal = copyShareFromModal;
window.copyCurrentShareText = copyCurrentShareText;

// ══════════════════════════════════════════════
//  ميزات القراءة الصوتية وسهولة الوصول (Arabic Audio & Web Speech)
//  قارئ ناطق باللغة العربية الفصحى بنسبة 100% لجميع الأجهزة والمتصفحات
// ══════════════════════════════════════════════
var currentSpeakingIndex = null;
var currentSpeakingType = null; // 'quiz' أو 'review'
var ttsRate = 1.0;
var autoReadNext = false;
var isTtsBarOpen = false;
var speechFontSizeDelta = 0;
var ttsEngine = 'hd'; // 'hd' (قارئ عربي سحابي عالي الدقة) أو 'local' (صوت المتصفح)

var ttsQueue = [];
var ttsQueueIndex = 0;
var ttsTimeoutId = null;
var ttsKeepAliveTimer = null;
var activeHighlightedElements = [];
var ttsAudio = new Audio();
window.__ttsActiveUtterance = null;

var ARABIC_LETTERS_NAMES = ['ألف', 'باء', 'جيم', 'دال', 'هاء'];

function isSpeechSupported() {
  return true; // مدعوم عبر قارئ الصوت السحابي عالي الدقة على جميع الأجهزة
}

// تحويل الأرقام إلى كلمات عربية فصحى لضمان نطقها عربياً دائماً
function numberToArabicWords(n) {
  var ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
              'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  var tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  var hundreds = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];

  n = parseInt(n, 10);
  if (isNaN(n) || n === 0) return 'صفر';
  if (n < 0) return 'سالب ' + numberToArabicWords(-n);
  if (n < 20) return ones[n];
  if (n < 100) {
    var rem = n % 10;
    return rem === 0 ? tens[Math.floor(n / 10)] : (ones[rem] + ' و' + tens[Math.floor(n / 10)]);
  }
  if (n < 1000) {
    var h = Math.floor(n / 100);
    var r = n % 100;
    return r === 0 ? hundreds[h] : (hundreds[h] + ' و' + numberToArabicWords(r));
  }
  if (n < 2000) {
    var r = n % 1000;
    return r === 0 ? 'ألف' : ('ألف و' + numberToArabicWords(r));
  }
  if (n < 3000) {
    var r = n % 1000;
    return r === 0 ? 'ألفان' : ('ألفان و' + numberToArabicWords(r));
  }
  if (n < 1000000) {
    var th = Math.floor(n / 1000);
    var r = n % 1000;
    var thWord = (th >= 3 && th <= 10) ? (numberToArabicWords(th) + ' آلاف') : (numberToArabicWords(th) + ' ألف');
    return r === 0 ? thWord : (thWord + ' و' + numberToArabicWords(r));
  }
  return String(n);
}

// تحويل رقم السؤال إلى ترقيم وصفي عربي فصيح
function numberToArabicOrdinal(num) {
  var ordinals = [
    '', 'السؤال الأول', 'السؤال الثاني', 'السؤال الثالث', 'السؤال الرابع', 'السؤال الخامس',
    'السؤال السادس', 'السؤال السابع', 'السؤال الثامن', 'السؤال التاسع', 'السؤال العاشر',
    'السؤال الحادي عشر', 'السؤال الثاني عشر', 'السؤال الثالث عشر', 'السؤال الرابع عشر', 'السؤال الخامس عشر',
    'السؤال السادس عشر', 'السؤال السابع عشر', 'السؤال الثامن عشر', 'السؤال التاسع عشر', 'السؤال العشرون',
    'السؤال الحادي والعشرون', 'السؤال الثاني والعشرون', 'السؤال الثالث والعشرون', 'السؤال الرابع والعشرون', 'السؤال الخامس والعشرون',
    'السؤال السادس والعشرون', 'السؤال السابع والعشرون', 'السؤال الثامن والعشرون', 'السؤال التاسع والعشرون', 'السؤال الثلاثون'
  ];
  if (num >= 1 && num < ordinals.length) return ordinals[num];
  return 'السؤال رقم ' + numberToArabicWords(num);
}

function prepareSpeechText(raw) {
  if (!raw) return '';
  var text = String(raw);
  // معالجة صور الماركداون والوسوم
  text = text.replace(/!\[(.*?)\]\(.+?\)/g, ' صورة توضيحية: $1 ');
  text = text.replace(/\[img\].+?\[\/img\]/gi, ' صورة توضيحية ');
  text = text.replace(/<img[^>]*>/gi, ' صورة توضيحية ');
  // معالجة الجداول المحاسبية
  text = text.replace(/\|/g, ' ، ');
  text = text.replace(/:\?-+:?/g, ' ');
  // إزالة وسوم HTML
  text = text.replace(/<[^>]*>/g, ' ');
  // استبدال الكيانات الخاصة
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");
  // إزالة رموز ماركداون والرموز الخاصة
  text = text.replace(/[*_#`~]/g, '');
  text = text.replace(/[{}\[\]]/g, ' ');
  // تنظيف المسافات والأسطر
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

// تقسيم النصوص الطويلة إلى مقاطع صوتية متناسقة لتفادي توقف المتصفح
function splitIntoSpeechChunks(text, maxLen) {
  if (!text) return [];
  maxLen = maxLen || 110;
  text = prepareSpeechText(text);
  if (text.length <= maxLen) return [text];

  var sentences = text.split(/([.،!؟\n;:]+)/);
  var chunks = [];
  var current = '';

  for (var i = 0; i < sentences.length; i++) {
    var part = sentences[i].trim();
    if (!part) continue;
    if ((current + ' ' + part).length <= maxLen) {
      current = current ? (current + ' ' + part) : part;
    } else {
      if (current) chunks.push(current);
      if (part.length > maxLen) {
        var words = part.split(' ');
        var sub = '';
        for (var w = 0; w < words.length; w++) {
          if ((sub + ' ' + words[w]).length <= maxLen) {
            sub = sub ? (sub + ' ' + words[w]) : words[w];
          } else {
            if (sub) chunks.push(sub);
            sub = words[w];
          }
        }
        current = sub;
      } else {
        current = part;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(function(c){ return c && c.trim().length > 0; });
}

function getBestArabicVoice() {
  if (!('speechSynthesis' in window)) return null;
  var voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;

  var arVoices = voices.filter(function(v) {
    var l = (v.lang || '').toLowerCase().replace(/_/g, '-');
    var n = (v.name || '').toLowerCase();
    return l.startsWith('ar') || n.includes('arabic') || n.includes('عربي') || n.includes('tarik') || n.includes('maged') || n.includes('laila') || n.includes('salma') || n.includes('naayf') || n.includes('hoda') || n.includes('zeina') || n.includes('shakir') || n.includes('hamed');
  });

  if (arVoices.length > 0) {
    var preferred = arVoices.find(function(v) {
      var l = (v.lang || '').toLowerCase().replace(/_/g, '-');
      return l === 'ar-sa' || l === 'ar-jo' || l === 'ar-eg' || l === 'ar-xa';
    });
    return preferred || arVoices[0];
  }
  return null;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = function() {
    getBestArabicVoice();
  };
}

function clearTtsHighlights() {
  if (activeHighlightedElements.length > 0) {
    activeHighlightedElements.forEach(function(item) {
      var el = document.getElementById(item.id);
      if (el) el.classList.remove(item.cls);
    });
    activeHighlightedElements = [];
  }
}

function startTtsKeepAlive() {
  stopTtsKeepAlive();
  ttsKeepAliveTimer = setInterval(function() {
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 10000);
}

function stopTtsKeepAlive() {
  if (ttsKeepAliveTimer) {
    clearInterval(ttsKeepAliveTimer);
    ttsKeepAliveTimer = null;
  }
}

function buildSpeechQueue(q, index, type) {
  var queue = [];
  if (!q) return queue;

  if (type === 'quiz') {
    // 1. ترقيم السؤال واسم الدرس بالعربية الفصحى
    var introText = numberToArabicOrdinal(index + 1);
    if (q.lesson && q.lesson.trim()) {
      introText += '، من درس ' + prepareSpeechText(q.lesson);
    }
    queue.push({
      text: introText,
      elementId: null,
      highlightClass: null,
      statusText: 'قراءة ' + numberToArabicOrdinal(index + 1)
    });

    // 2. نص السؤال كاملاً
    var qChunks = splitIntoSpeechChunks(q.text, 110);
    qChunks.forEach(function(chunk) {
      queue.push({
        text: chunk,
        elementId: 'qtext-' + index,
        highlightClass: 'speaking-text',
        statusText: 'نص ' + numberToArabicOrdinal(index + 1)
      });
    });

    // 3. الخيارات الأربعة بأسماء الحروف العربية الصريحة
    var cleanOpts = getCleanOptions(q);
    cleanOpts.forEach(function(opt, j) {
      var letterName = ARABIC_LETTERS_NAMES[j] || LBL[j] || (j + 1);
      var optChunks = splitIntoSpeechChunks(opt, 110);
      optChunks.forEach(function(oChunk, oIdx) {
        var prefix = (oIdx === 0) ? ('الخيار ' + letterName + ' : ') : '';
        queue.push({
          text: prefix + oChunk,
          elementId: 'qopt-' + index + '-' + j,
          highlightClass: 'speaking-opt',
          statusText: 'قراءة الخيار ' + letterName
        });
      });
    });
  } else if (type === 'review') {
    var vi = validInfo(q);
    var correctIdx = vi.answerIdx;
    var userAns = userAnswers[index];
    var isSkipped = (userAns === undefined);
    var isCorrect = (!isSkipped && userAns === correctIdx);

    queue.push({
      text: 'مراجعة ' + numberToArabicOrdinal(index + 1),
      elementId: null,
      highlightClass: null,
      statusText: 'مراجعة ' + numberToArabicOrdinal(index + 1)
    });

    var rChunks = splitIntoSpeechChunks(q.text, 110);
    rChunks.forEach(function(chunk) {
      queue.push({
        text: chunk,
        elementId: 'rqtext-' + index,
        highlightClass: 'speaking-text',
        statusText: 'نص السؤال'
      });
    });

    var statusPhrase = '';
    if (isSkipped) {
      statusPhrase = 'حالة الإجابة: لم تقم بالإجابة على هذا السؤال.';
    } else if (isCorrect) {
      statusPhrase = 'حالة الإجابة: إجابتك صحيحة، أحسنت!';
    } else {
      var userLetter = ARABIC_LETTERS_NAMES[userAns] || LBL[userAns] || (userAns + 1);
      statusPhrase = 'حالة الإجابة: إجابتك خاطئة، اخترت الخيار ' + userLetter + ' : ' + prepareSpeechText(vi.opts[userAns]);
    }
    queue.push({
      text: statusPhrase,
      elementId: null,
      highlightClass: null,
      statusText: 'حالة إجابة الطالب'
    });

    var correctLetter = ARABIC_LETTERS_NAMES[correctIdx] || LBL[correctIdx] || (correctIdx + 1);
    queue.push({
      text: 'الإجابة الصحيحة المعتمدة هي الخيار ' + correctLetter + ' : ' + prepareSpeechText(vi.opts[correctIdx]),
      elementId: 'ropt-' + index + '-' + correctIdx,
      highlightClass: 'speaking-opt',
      statusText: 'الإجابة الصحيحة المعتمدة'
    });

    if (q.hint && q.hint.trim()) {
      var hintChunks = splitIntoSpeechChunks(q.hint, 110);
      hintChunks.forEach(function(hChunk, hIdx) {
        queue.push({
          text: (hIdx === 0 ? 'تلميح من كتاب الطالب: ' : '') + hChunk,
          elementId: null,
          highlightClass: null,
          statusText: 'تلميح الكتاب'
        });
      });
    }
  }

  return queue;
}

function playNextTtsChunk() {
  if (currentSpeakingIndex === null) return;

  if (ttsQueueIndex >= ttsQueue.length) {
    var finishedIndex = currentSpeakingIndex;
    var finishedType = currentSpeakingType;
    stopSpeaking(false);

    var statusEl = document.getElementById('tts-status-text');
    if (statusEl) {
      statusEl.textContent = 'اكتملت قراءة ' + numberToArabicOrdinal(finishedIndex + 1);
    }

    if (autoReadNext && finishedType === 'quiz' && finishedIndex + 1 < currentQuiz.length) {
      ttsTimeoutId = setTimeout(function() {
        if (currentPageId === 'quiz' && autoReadNext) {
          speakQuestion(finishedIndex + 1, 'quiz');
        }
      }, 700);
    }
    return;
  }

  var item = ttsQueue[ttsQueueIndex];
  ttsQueueIndex++;

  // تحديد المحرك الصوتي الأنسب
  var useHd = (ttsEngine === 'hd') || !getBestArabicVoice();

  if (useHd) {
    // تشغيل عبر القارئ العربي فائق الوضوح (سحابي)
    ttsAudio.pause();
    ttsAudio.playbackRate = ttsRate || 1.0;
    ttsAudio.src = '/api/tts?text=' + encodeURIComponent(item.text);

    ttsAudio.onplay = function() {
      clearTtsHighlights();
      if (item.elementId && item.highlightClass) {
        var el = document.getElementById(item.elementId);
        if (el) {
          el.classList.add(item.highlightClass);
          activeHighlightedElements.push({ id: item.elementId, cls: item.highlightClass });
        }
      }
      var statusEl = document.getElementById('tts-status-text');
      if (statusEl && item.statusText) {
        statusEl.innerHTML = '<span style="color:#38bdf8;"><i class="fas fa-volume-high"></i> ' + item.statusText + '...</span>';
      }
    };

    ttsAudio.onended = function() {
      clearTtsHighlights();
      ttsTimeoutId = setTimeout(function() {
        if (currentSpeakingIndex !== null) {
          playNextTtsChunk();
        }
      }, 120);
    };

    ttsAudio.onerror = function(ev) {
      console.warn('[TTS Audio Error]', ev);
      clearTtsHighlights();
      ttsTimeoutId = setTimeout(function() {
        if (currentSpeakingIndex !== null) {
          playNextTtsChunk();
        }
      }, 100);
    };

    ttsAudio.play().catch(function(err) {
      console.warn('[TTS Audio Play Interrupted]', err);
    });

  } else {
    // تشغيل عبر محرك المتصفح المحلي (في حال توفر صوت عربي مثبت محلياً)
    var utt = new SpeechSynthesisUtterance(item.text);
    utt.lang = 'ar-SA';
    var voice = getBestArabicVoice();
    if (voice) utt.voice = voice;
    utt.rate = ttsRate || 1.0;
    utt.pitch = 1.0;

    window.__ttsActiveUtterance = utt;

    utt.onstart = function() {
      clearTtsHighlights();
      if (item.elementId && item.highlightClass) {
        var el = document.getElementById(item.elementId);
        if (el) {
          el.classList.add(item.highlightClass);
          activeHighlightedElements.push({ id: item.elementId, cls: item.highlightClass });
        }
      }
      var statusEl = document.getElementById('tts-status-text');
      if (statusEl && item.statusText) {
        statusEl.innerHTML = '<span style="color:#38bdf8;"><i class="fas fa-volume-high"></i> ' + item.statusText + '...</span>';
      }
    };

    utt.onend = function() {
      clearTtsHighlights();
      ttsTimeoutId = setTimeout(function() {
        if (currentSpeakingIndex !== null) {
          playNextTtsChunk();
        }
      }, 120);
    };

    utt.onerror = function(ev) {
      if (ev && (ev.error === 'interrupted' || ev.error === 'canceled')) return;
      console.warn('[TTS WebSpeech Error]:', ev);
      clearTtsHighlights();
      ttsTimeoutId = setTimeout(function() {
        if (currentSpeakingIndex !== null) {
          playNextTtsChunk();
        }
      }, 100);
    };

    try {
      window.speechSynthesis.speak(utt);
    } catch(err) {
      console.warn('[TTS WebSpeech Exception]:', err);
      clearTtsHighlights();
      playNextTtsChunk();
    }
  }
}

function buildTtsToolbar() {
  return (
    '<div class="tts-toolbar" id="tts-toolbar" style="display:' + (isTtsBarOpen ? 'block' : 'none') + ';">' +
      '<div class="tts-tb-inner">' +
        '<div class="tts-tb-info">' +
          '<span class="tts-tb-badge"><i class="fas fa-volume-up"></i> القارئ الصوتي العربي الفصيح (سهولة الوصول)</span>' +
          '<span class="tts-tb-status" id="tts-status-text">جاهز للقراءة بصوت عربي فصيح</span>' +
        '</div>' +
        '<div class="tts-tb-actions">' +
          '<button type="button" class="tts-tb-btn tts-tb-stop" onclick="stopSpeaking(true)" title="إيقاف القراءة الصوتية">' +
            '<i class="fas fa-stop"></i> إيقاف الصوت' +
          '</button>' +
          '<div class="tts-engine-group" title="اختيار المحرك الصوتي">' +
            '<span class="tts-rate-label"><i class="fas fa-microchip"></i> الصوت:</span>' +
            '<button type="button" class="tts-engine-btn ' + (ttsEngine === 'hd' ? 'active' : '') + '" id="tts-eng-hd" onclick="setTtsEngine(\'hd\')"><i class="fas fa-sparkles"></i> عربي فصيح HD</button>' +
            '<button type="button" class="tts-engine-btn ' + (ttsEngine === 'local' ? 'active' : '') + '" id="tts-eng-local" onclick="setTtsEngine(\'local\')">صوت المتصفح</button>' +
          '</div>' +
          '<div class="tts-rate-group">' +
            '<span class="tts-rate-label"><i class="fas fa-gauge-high"></i> السرعة:</span>' +
            '<button type="button" class="tts-rate-btn ' + (ttsRate === 0.8 ? 'active' : '') + '" id="tts-rate-08" onclick="setTtsRate(0.8)">0.8× بطيء</button>' +
            '<button type="button" class="tts-rate-btn ' + (ttsRate === 1.0 ? 'active' : '') + '" id="tts-rate-10" onclick="setTtsRate(1.0)">1× عادي</button>' +
            '<button type="button" class="tts-rate-btn ' + (ttsRate === 1.2 ? 'active' : '') + '" id="tts-rate-12" onclick="setTtsRate(1.2)">1.2× سريع</button>' +
          '</div>' +
          '<label class="tts-auto-toggle" title="قراءة السؤال التالي تلقائياً بعد انتهاء قراءة السؤال الحالي والخيارات">' +
            '<input type="checkbox" id="tts-auto-next" ' + (autoReadNext ? 'checked' : '') + ' onchange="toggleAutoReadNext(this.checked)">' +
            '<span>قراءة متتابعة</span>' +
          '</label>' +
          '<div class="tts-font-group" title="تكبير/تصغير خط الأسئلة لتسهيل القراءة لذوي ضعف البصر">' +
            '<span class="tts-rate-label"><i class="fas fa-text-height"></i> الخط:</span>' +
            '<button type="button" class="tts-font-btn" onclick="adjustQuizFontSize(1)" title="تكبير الخط"><i class="fas fa-plus"></i></button>' +
            '<button type="button" class="tts-font-btn" onclick="adjustQuizFontSize(-1)" title="تصغير الخط"><i class="fas fa-minus"></i></button>' +
            '<button type="button" class="tts-font-btn" onclick="adjustQuizFontSize(0)" title="إعادة الحجم الافتراضي">عادي</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

function setTtsEngine(engine) {
  ttsEngine = engine;
  var hdBtn = document.getElementById('tts-eng-hd');
  var locBtn = document.getElementById('tts-eng-local');
  if (hdBtn) hdBtn.classList.toggle('active', engine === 'hd');
  if (locBtn) locBtn.classList.toggle('active', engine === 'local');

  if (engine === 'local' && !getBestArabicVoice()) {
    toast('تنبيه: لم يتم العثور على صوت عربي مثبت في متصفحك، سيتم الاستمرار بالقارئ العربي HD لضمان النطق الفصيح', 'warn');
    ttsEngine = 'hd';
    if (hdBtn) hdBtn.classList.add('active');
    if (locBtn) locBtn.classList.remove('active');
    return;
  }

  toast(engine === 'hd' ? 'تم اختيار القارئ العربي عالي الدقة HD (ينطق العربية الفصحى دائماً)' : 'تم اختيار صوت المتصفح المحلي', 'ok');
  if (currentSpeakingIndex !== null && currentSpeakingType !== null) {
    var idx = currentSpeakingIndex;
    var typ = currentSpeakingType;
    speakQuestion(idx, typ);
  }
}

function toggleTtsBar() {
  var bar = document.getElementById('tts-toolbar');
  var btn = document.getElementById('qhdr-tts-btn');
  isTtsBarOpen = !isTtsBarOpen;
  if (bar) bar.style.display = isTtsBarOpen ? 'block' : 'none';
  if (btn) {
    if (isTtsBarOpen) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
}

function setTtsRate(rate) {
  ttsRate = rate;
  if (ttsAudio) ttsAudio.playbackRate = rate;
  ['08', '10', '12'].forEach(function(r) {
    var el = document.getElementById('tts-rate-' + r);
    if (el) el.classList.remove('active');
  });
  if (rate === 0.8) {
    var el08 = document.getElementById('tts-rate-08');
    if (el08) el08.classList.add('active');
  } else if (rate === 1.0) {
    var el10 = document.getElementById('tts-rate-10');
    if (el10) el10.classList.add('active');
  } else if (rate === 1.2) {
    var el12 = document.getElementById('tts-rate-12');
    if (el12) el12.classList.add('active');
  }
  toast('تم ضبط سرعة القراءة على ' + rate + '×', 'ok');
  if (currentSpeakingIndex !== null && currentSpeakingType !== null) {
    var idx = currentSpeakingIndex;
    var typ = currentSpeakingType;
    speakQuestion(idx, typ);
  }
}

function toggleAutoReadNext(checked) {
  autoReadNext = !!checked;
  toast(autoReadNext ? 'تم تفعيل القراءة المتتابعة للأسئلة' : 'تم إيقاف القراءة المتتابعة', 'ok');
}

function adjustQuizFontSize(delta) {
  var qarea = document.getElementById('qarea');
  var reviewBox = document.querySelector('.review-box');
  if (delta === 0) {
    speechFontSizeDelta = 0;
  } else {
    speechFontSizeDelta = Math.max(-2, Math.min(6, speechFontSizeDelta + delta));
  }
  var baseSize = 15 + speechFontSizeDelta;
  if (qarea) {
    var qtexts = qarea.querySelectorAll('.qtext');
    qtexts.forEach(function(t){ t.style.fontSize = baseSize + 'px'; });
    var qopts = qarea.querySelectorAll('.qot');
    qopts.forEach(function(o){ o.style.fontSize = Math.max(13, baseSize - 1) + 'px'; });
  }
  if (reviewBox) {
    var rqtexts = reviewBox.querySelectorAll('.rqtext');
    rqtexts.forEach(function(t){ t.style.fontSize = baseSize + 'px'; });
  }
  toast(delta === 0 ? 'تمت استعادة حجم الخط الأصلي' : ('تم تعديل حجم الخط (' + (speechFontSizeDelta > 0 ? '+' : '') + speechFontSizeDelta + ')'), 'ok');
}

function toggleSpeakQuestion(index) {
  if (currentSpeakingIndex === index && currentSpeakingType === 'quiz') {
    stopSpeaking(true);
    toast('تم إيقاف القراءة الصوتية', 'ok');
    return;
  }
  speakQuestion(index, 'quiz');
}

function toggleSpeakReview(index) {
  if (currentSpeakingIndex === index && currentSpeakingType === 'review') {
    stopSpeaking(true);
    toast('تم إيقاف القراءة الصوتية', 'ok');
    return;
  }
  speakQuestion(index, 'review');
}

function speakQuestion(index, type) {
  stopSpeaking(true);

  var q = currentQuiz[index];
  if (!q) return;

  currentSpeakingIndex = index;
  currentSpeakingType = type;

  updateSpeakUI(index, type, true);

  var targetEl = document.getElementById((type === 'quiz' ? 'qcard-' : 'rcard-') + index);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  ttsQueue = buildSpeechQueue(q, index, type);
  ttsQueueIndex = 0;

  startTtsKeepAlive();

  ttsTimeoutId = setTimeout(function() {
    if (currentSpeakingIndex === index) {
      playNextTtsChunk();
    }
  }, 60);
}

function stopSpeaking(resetUi) {
  if (resetUi === undefined) resetUi = true;

  if (ttsTimeoutId) {
    clearTimeout(ttsTimeoutId);
    ttsTimeoutId = null;
  }
  stopTtsKeepAlive();
  ttsQueue = [];
  ttsQueueIndex = 0;
  clearTtsHighlights();

  if (ttsAudio) {
    try {
      ttsAudio.pause();
      ttsAudio.currentTime = 0;
    } catch(e){}
  }

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch(e){}
  }

  if (currentSpeakingIndex !== null) {
    updateSpeakUI(currentSpeakingIndex, currentSpeakingType, false);
    if (resetUi) {
      currentSpeakingIndex = null;
      currentSpeakingType = null;
      window.__ttsActiveUtterance = null;
      var statusEl = document.getElementById('tts-status-text');
      if (statusEl) statusEl.textContent = 'جاهز للقراءة بصوت عربي فصيح';
    }
  }
}

function updateSpeakUI(index, type, isSpeaking) {
  var statusEl = document.getElementById('tts-status-text');
  if (type === 'quiz') {
    var btn = document.getElementById('qspeak-btn-' + index);
    var card = document.getElementById('qcard-' + index);
    if (btn) {
      if (isSpeaking) {
        btn.classList.add('speaking');
        btn.innerHTML = '<i class="fas fa-stop"></i> <span>إيقاف القراءة</span>';
        btn.setAttribute('aria-label', 'إيقاف قراءة ' + numberToArabicOrdinal(index + 1));
      } else {
        btn.classList.remove('speaking');
        btn.innerHTML = '<i class="fas fa-volume-up"></i> <span>استمع للسؤال</span>';
        btn.setAttribute('aria-label', 'استمع إلى ' + numberToArabicOrdinal(index + 1) + ' والخيارات صوتياً');
      }
    }
    if (card) {
      if (isSpeaking) {
        card.classList.add('speaking-card');
      } else {
        card.classList.remove('speaking-card');
      }
    }
  } else if (type === 'review') {
    var rbtn = document.getElementById('rspeak-btn-' + index);
    var rcard = document.getElementById('rcard-' + index);
    if (rbtn) {
      if (isSpeaking) {
        rbtn.classList.add('speaking');
        rbtn.innerHTML = '<i class="fas fa-stop"></i> <span>إيقاف القراءة</span>';
      } else {
        rbtn.classList.remove('speaking');
        rbtn.innerHTML = '<i class="fas fa-volume-up"></i> <span>استمع للمراجعة</span>';
      }
    }
    if (rcard) {
      if (isSpeaking) {
        rcard.classList.add('speaking-card');
      } else {
        rcard.classList.remove('speaking-card');
      }
    }
  }

  if (statusEl) {
    if (isSpeaking) {
      statusEl.innerHTML = '<span style="color:#38bdf8;"><i class="fas fa-volume-high"></i> بدء قراءة ' + numberToArabicOrdinal(index + 1) + '...</span>';
    } else {
      statusEl.textContent = 'جاهز للقراءة بصوت عربي فصيح';
    }
  }
}

window.buildTtsToolbar = buildTtsToolbar;
window.toggleTtsBar = toggleTtsBar;
window.setTtsEngine = setTtsEngine;
window.setTtsRate = setTtsRate;
window.toggleAutoReadNext = toggleAutoReadNext;
window.adjustQuizFontSize = adjustQuizFontSize;
window.toggleSpeakQuestion = toggleSpeakQuestion;
window.toggleSpeakReview = toggleSpeakReview;
window.speakQuestion = speakQuestion;
window.stopSpeaking = stopSpeaking;
