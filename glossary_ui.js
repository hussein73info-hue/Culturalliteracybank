// واجهة عرض وتصفح والبحث في مسرد المصطلحات المعتمد
// الثقافة المالية — التوجيهي (الفصلان الأول والثاني)

(function() {
  var currentSemFilter = 0; // 0 = all, 1 = sem1, 2 = sem2
  var currentSearchQuery = '';
  var currentUnitFilter = '';

  function getGlossaryList() {
    return window.GLOSSARY_DATA || [];
  }

  function renderGlossaryPage() {
    var container = document.getElementById('glossary-inner');
    if (!container) return;

    var allTerms = getGlossaryList();
    var sem1Count = allTerms.filter(function(t) { return t.sem === 1; }).length;
    var sem2Count = allTerms.filter(function(t) { return t.sem === 2; }).length;

    // تجميع الوحدات الدراسية
    var unitsMap = {};
    allTerms.forEach(function(t) {
      if (t.unitName && !unitsMap[t.unitName]) {
        unitsMap[t.unitName] = { sem: t.sem, name: t.unitName };
      }
    });

    var unitOptionsHtml = '<option value="">جميع الوحدات الدراسية (7 وحدات)</option>';
    Object.keys(unitsMap).forEach(function(uName) {
      var u = unitsMap[uName];
      var semLabel = u.sem === 1 ? 'فصل 1' : 'فصل 2';
      unitOptionsHtml += '<option value="' + escHtml(uName) + '">[' + semLabel + '] ' + escHtml(uName) + '</option>';
    });

    var html =
      '<div class="page-header" style="text-align:center;margin-bottom:20px;">' +
        '<div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#312e81,#4f46e5);color:#fff;font-size:26px;margin-bottom:12px;box-shadow:0 4px 14px rgba(79,70,229,0.25);">' +
          '<i class="fas fa-spell-check"></i>' +
        '</div>' +
        '<h2 style="font-size:24px;font-weight:800;color:#1e293b;margin:0 0 6px;">مسرد المصطلحات والمفاهيم المعتمدة</h2>' +
        '<p style="font-size:14px;color:#64748b;max-width:680px;margin:0 auto 12px;line-height:1.6;">' +
          'المعجم والمفاهيم الرسمية المعتمدة الصادرة عن المركز الوطني لتطوير المناهج (NCCD) لكتابي الطالب في مبحث الثقافة المالية (طبعة 2026 المنقحة)' +
        '</p>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;">' +
          '<span style="background:#e0e7ff;color:#3730a3;border:1px solid #c7d2fe;padding:4px 12px;border-radius:20px;font-size:12.5px;font-weight:700;">' +
            '<i class="fas fa-layer-group"></i> إجمالي المصطلحات: ' + allTerms.length + ' مصطلحاً' +
          '</span>' +
          '<span style="background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;padding:4px 12px;border-radius:20px;font-size:12.5px;font-weight:700;">' +
            '<i class="fas fa-book-bookmark"></i> الفصل الأول: ' + sem1Count + ' مصطلحاً (ص 132-139)' +
          '</span>' +
          '<span style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:4px 12px;border-radius:20px;font-size:12.5px;font-weight:700;">' +
            '<i class="fas fa-book-open"></i> الفصل الثاني: ' + sem2Count + ' مصطلحاً (ص 115-119)' +
          '</span>' +
        '</div>' +
      '</div>' +

      // شريط البحث والفلترة
      '<div class="glossary-toolbar" style="background:#fff;border:1.5px solid #e2e8f0;border-radius:16px;padding:16px;margin-bottom:22px;box-shadow:0 3px 12px rgba(0,0,0,0.04);">' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
          // تبويبات الفصل
          '<div style="display:flex;gap:6px;flex-wrap:wrap;" id="glossary-sem-tabs">' +
            '<button type="button" class="gl-tab-btn ' + (currentSemFilter === 0 ? 'active' : '') + '" onclick="filterGlossarySem(0)" style="padding:7px 16px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;border:none;font-family:\'Tajawal\',sans-serif;transition:all .2s;">' +
              '<i class="fas fa-th-large"></i> جميع المصطلحات (' + allTerms.length + ')' +
            '</button>' +
            '<button type="button" class="gl-tab-btn ' + (currentSemFilter === 1 ? 'active' : '') + '" onclick="filterGlossarySem(1)" style="padding:7px 16px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;border:none;font-family:\'Tajawal\',sans-serif;transition:all .2s;">' +
              '<i class="fas fa-book-bookmark"></i> الفصل الأول (' + sem1Count + ')' +
            '</button>' +
            '<button type="button" class="gl-tab-btn ' + (currentSemFilter === 2 ? 'active' : '') + '" onclick="filterGlossarySem(2)" style="padding:7px 16px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;border:none;font-family:\'Tajawal\',sans-serif;transition:all .2s;">' +
              '<i class="fas fa-book-open"></i> الفصل الثاني (' + sem2Count + ')' +
            '</button>' +
          '</div>' +

          // زر الطباعة / تصدير
          '<button type="button" onclick="printGlossarySection()" style="background:#f8fafc;color:#334155;border:1.5px solid #cbd5e1;border-radius:10px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:\'Tajawal\',sans-serif;display:inline-flex;align-items:center;gap:6px;">' +
            '<i class="fas fa-print"></i> طباعة / حفظ كـ PDF' +
          '</button>' +
        '</div>' +

        // حقل البحث وحقل الوحدة
        '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
          '<div style="flex:2;min-width:260px;position:relative;">' +
            '<i class="fas fa-search" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:14px;"></i>' +
            '<input type="text" id="gl-search-input" value="' + escHtml(currentSearchQuery) + '" oninput="onGlossarySearch(this.value)" placeholder="ابحث في المصطلحات بالعربية أو الإنجليزية أو بالتعريف..." style="width:100%;padding:10px 38px 10px 14px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:13.5px;font-family:\'Tajawal\',sans-serif;box-sizing:border-box;outline:none;" />' +
          '</div>' +
          '<div style="flex:1;min-width:200px;">' +
            '<select id="gl-unit-select" onchange="onGlossaryUnitChange(this.value)" style="width:100%;padding:10px 14px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:13px;font-family:\'Tajawal\',sans-serif;box-sizing:border-box;background:#fff;outline:none;cursor:pointer;">' +
              unitOptionsHtml +
            '</select>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // منطقة البطاقات والمصطلحات
      '<div id="glossary-items-container">' +
        renderGlossaryCards() +
      '</div>';

    container.innerHTML = html;

    // تعيين القيمة المحددة للوحدة إن وجدت
    var sel = document.getElementById('gl-unit-select');
    if (sel && currentUnitFilter) sel.value = currentUnitFilter;
  }

  function getFilteredTerms() {
    var terms = getGlossaryList();
    var q = (currentSearchQuery || '').trim().toLowerCase();

    return terms.filter(function(t) {
      if (currentSemFilter !== 0 && t.sem !== currentSemFilter) {
        return false;
      }
      if (currentUnitFilter && t.unitName !== currentUnitFilter) {
        return false;
      }
      if (q) {
        var matchAr = (t.termAr || '').toLowerCase().indexOf(q) !== -1;
        var matchEn = (t.termEn || '').toLowerCase().indexOf(q) !== -1;
        var matchDef = (t.def || '').toLowerCase().indexOf(q) !== -1;
        var matchUnit = (t.unitName || '').toLowerCase().indexOf(q) !== -1;
        if (!matchAr && !matchEn && !matchDef && !matchUnit) {
          return false;
        }
      }
      return true;
    });
  }

  function renderGlossaryCards() {
    var filtered = getFilteredTerms();

    if (filtered.length === 0) {
      return (
        '<div style="text-align:center;padding:48px 20px;background:#fff;border-radius:16px;border:1.5px dashed #cbd5e1;">' +
          '<div style="font-size:36px;color:#94a3b8;margin-bottom:10px;"><i class="fas fa-search"></i></div>' +
          '<h3 style="font-size:17px;font-weight:800;color:#1e293b;margin:0 0 6px;">لا توجد مصطلحات مطابقة لبحثك</h3>' +
          '<p style="font-size:13px;color:#64748b;margin:0 0 14px;">جرب تغيير كلمة البحث أو اختيار فصل أو وحدة دراسية مختلفة.</p>' +
          '<button type="button" onclick="resetGlossaryFilters()" style="background:#4f46e5;color:#fff;border:none;border-radius:9px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:\'Tajawal\',sans-serif;">' +
            '<i class="fas fa-redo"></i> إعادة تعيين الفلاتر' +
          '</button>' +
        '</div>'
      );
    }

    var html = '<div style="margin-bottom:12px;font-size:13px;color:#64748b;font-weight:700;">عرض ' + filtered.length + ' من أصل ' + getGlossaryList().length + ' مصطلحاً:</div>';
    html += '<div class="glossary-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:16px;">';

    filtered.forEach(function(item, idx) {
      var isSem1 = item.sem === 1;
      var semBadgeBg = isSem1 ? '#f0f9ff' : '#ecfdf5';
      var semBadgeColor = isSem1 ? '#0369a1' : '#047857';
      var semBadgeBorder = isSem1 ? '#bae6fd' : '#a7f3d0';
      var semText = isSem1 ? 'كتاب الفصل الأول' : 'كتاب الفصل الثاني';

      html +=
        '<div class="glossary-card" id="gl-card-' + item.id + '" style="background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;padding:18px;position:relative;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 2px 8px rgba(0,0,0,0.03);transition:all .2s ease;">' +
          '<div>' +
            // شريط العنوان والمصطلح
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;">' +
              '<div>' +
                '<h3 style="font-size:17.5px;font-weight:800;color:#0f172a;margin:0 0 3px;line-height:1.4;">' +
                  escHtml(item.termAr) +
                '</h3>' +
                (item.termEn ? (
                  '<div style="font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:700;color:#4f46e5;direction:ltr;text-align:right;">' +
                    escHtml(item.termEn) +
                  '</div>'
                ) : '') +
              '</div>' +
              '<span style="background:' + semBadgeBg + ';color:' + semBadgeColor + ';border:1px solid ' + semBadgeBorder + ';padding:3px 9px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;flex-shrink:0;">' +
                '<i class="fas fa-file-lines"></i> ص ' + item.page +
              '</span>' +
            '</div>' +

            // وسوم المصدر والوحدة
            '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">' +
              '<span style="background:#f8fafc;color:#475569;border:1px solid #e2e8f0;border-radius:6px;padding:2px 7px;font-size:11px;font-weight:600;">' +
                semText +
              '</span>' +
              '<span style="background:#fdf4ff;color:#86198f;border:1px solid #f5d0fe;border-radius:6px;padding:2px 7px;font-size:11px;font-weight:600;">' +
                escHtml(item.unitName) +
              '</span>' +
            '</div>' +

            // التعريف
            '<div style="background:#f8fafc;border-right:3px solid ' + (isSem1 ? '#0284c7' : '#10b981') + ';border-radius:0 8px 8px 0;padding:10px 12px;font-size:13.5px;color:#334155;line-height:1.75;margin-bottom:14px;">' +
              escHtml(item.def) +
            '</div>' +
          '</div>' +

          // أدوات المصطلح (نطق صوتي + نسخ)
          '<div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid #f1f5f9;">' +
            '<div style="display:flex;gap:6px;">' +
              '<button type="button" onclick="speakGlossaryTerm(\'' + item.id + '\')" title="الاستماع لنطق المصطلح وتعريفه صوتياً باللغة العربية" style="background:#e0e7ff;color:#3730a3;border:none;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:\'Tajawal\',sans-serif;display:inline-flex;align-items:center;gap:5px;">' +
                '<i class="fas fa-volume-up"></i> استماع' +
              '</button>' +
              '<button type="button" onclick="copyGlossaryTerm(\'' + item.id + '\')" title="نسخ المصطلح والتعريف للحافظة" style="background:#f1f5f9;color:#475569;border:none;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:\'Tajawal\',sans-serif;display:inline-flex;align-items:center;gap:5px;">' +
                '<i class="fas fa-copy"></i> نسخ' +
              '</button>' +
            '</div>' +
            '<div style="font-size:11.5px;color:#94a3b8;font-weight:700;">' +
              '#' + (idx + 1) +
            '</div>' +
          '</div>' +
        '</div>';
    });

    html += '</div>';
    return html;
  }

  function filterGlossarySem(sem) {
    currentSemFilter = sem;
    updateTabBtnStyles();
    refreshGlossaryContainer();
  }

  function updateTabBtnStyles() {
    var tabs = document.querySelectorAll('#glossary-sem-tabs .gl-tab-btn');
    tabs.forEach(function(btn, idx) {
      if (idx === currentSemFilter) {
        btn.style.background = '#312e81';
        btn.style.color = '#fff';
      } else {
        btn.style.background = '#f1f5f9';
        btn.style.color = '#334155';
      }
    });
  }

  function onGlossarySearch(val) {
    currentSearchQuery = val;
    refreshGlossaryContainer();
  }

  function onGlossaryUnitChange(val) {
    currentUnitFilter = val;
    refreshGlossaryContainer();
  }

  function resetGlossaryFilters() {
    currentSemFilter = 0;
    currentSearchQuery = '';
    currentUnitFilter = '';
    renderGlossaryPage();
  }

  function refreshGlossaryContainer() {
    var container = document.getElementById('glossary-items-container');
    if (container) {
      container.innerHTML = renderGlossaryCards();
    }
  }

  function speakGlossaryTerm(id) {
    var terms = getGlossaryList();
    var item = terms.find(function(t) { return t.id === id; });
    if (!item) return;

    if (!('speechSynthesis' in window)) {
      showToast('القراءة الصوتية غير مدعومة في متصفحك الحالي', 'warning');
      return;
    }

    window.speechSynthesis.cancel();
    var textToRead = item.termAr + '. ' + item.def;
    var utter = new SpeechSynthesisUtterance(textToRead);
    utter.lang = 'ar-SA';
    utter.rate = 0.92;

    // تمييز الكرت أثناء القراءة
    var card = document.getElementById('gl-card-' + id);
    if (card) {
      card.style.borderColor = '#4f46e5';
      card.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.2)';
    }

    utter.onend = function() {
      if (card) {
        card.style.borderColor = '#e2e8f0';
        card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
      }
    };
    utter.onerror = function() {
      if (card) {
        card.style.borderColor = '#e2e8f0';
        card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
      }
    };

    window.speechSynthesis.speak(utter);
  }

  function copyGlossaryTerm(id) {
    var terms = getGlossaryList();
    var item = terms.find(function(t) { return t.id === id; });
    if (!item) return;

    var text = item.termAr + (item.termEn ? ' (' + item.termEn + ')' : '') + ':\n' + item.def + '\n[المصدر: مبحث الثقافة المالية - ' + (item.sem === 1 ? 'الفصل الأول' : 'الفصل الثاني') + ' ص ' + item.page + ']';

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('تم نسخ المصطلح والتعريف بنجاح!', 'success');
      }).catch(function() {
        showToast('تم تحديد النص، يرجى الضغط على Ctrl+C', 'info');
      });
    } else {
      showToast('تم نسخ المصطلح والتعريف بنجاح!', 'success');
    }
  }

  function printGlossarySection() {
    window.print();
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ربط الدوال مع النطاق العام window
  window.renderGlossaryPage = renderGlossaryPage;
  window.filterGlossarySem = filterGlossarySem;
  window.onGlossarySearch = onGlossarySearch;
  window.onGlossaryUnitChange = onGlossaryUnitChange;
  window.resetGlossaryFilters = resetGlossaryFilters;
  window.speakGlossaryTerm = speakGlossaryTerm;
  window.copyGlossaryTerm = copyGlossaryTerm;
  window.printGlossarySection = printGlossarySection;
})();
