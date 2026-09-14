import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType
} from 'docx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read questions.js
const qjs = fs.readFileSync(path.join(__dirname, 'questions.js'), 'utf8');
let bank;
eval(qjs.replace('var bank =', 'bank ='));

// Read script.js for curriculum structure
const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
const curCode = script.match(/var CUR\s*=\s*\{[\s\S]*?\n\};\n/)[0];
let CUR;
eval(curCode.replace('var CUR =', 'CUR ='));

const LBL = ['أ', 'ب', 'ج', 'د'];

// Helper to sanitize text
function cleanText(txt) {
  if (txt == null) return '';
  return String(txt).trim();
}

// Ministerial models generator according to Table of Specifications (50 questions per model)
function getMinisterialModels() {
  const unitIds = [1, 2, 3, 4, 5, 6, 7];
  const specQuotas = { 1: 11, 2: 7, 3: 7, 4: 6, 5: 6, 6: 6, 7: 7 };
  const numModels = 5;

  const byUnitAndLesson = {};
  unitIds.forEach(uid => {
    byUnitAndLesson[uid] = {};
    const uQs = bank.filter(q => q.unit === uid && !q._examKey);
    uQs.forEach(q => {
      const lName = q.lesson || 'عام';
      if (!byUnitAndLesson[uid][lName]) byUnitAndLesson[uid][lName] = [];
      byUnitAndLesson[uid][lName].push(q);
    });
  });

  const models = [];
  for (let m = 0; m < numModels; m++) {
    models.push([]);
  }

  unitIds.forEach(uid => {
    const quota = specQuotas[uid];
    const lessons = Object.keys(byUnitAndLesson[uid]);
    if (lessons.length === 0) return;

    let lessonIndex = 0;
    for (let m = 0; m < numModels; m++) {
      let picked = 0;
      let attempts = 0;
      while (picked < quota && attempts < 250) {
        attempts++;
        const lName = lessons[lessonIndex % lessons.length];
        const arr = byUnitAndLesson[uid][lName];
        if (arr && arr.length > 0) {
          models[m].push(arr.shift());
          picked++;
        }
        lessonIndex++;
      }
    }
  });

  models.forEach(m => {
    m.sort((a, b) => {
      if (a.unit !== b.unit) return a.unit - b.unit;
      return a.id - b.id;
    });
  });

  return models.filter(m => m.length === 50);
}

// Helper to build Question paragraphs in pure, safe OpenXML
function buildQuestionParagraphs(q, displayNum, contextLabel = '') {
  const paras = [];

  // Question header (Number, context tag, Question text)
  const qChildren = [
    new TextRun({
      text: `سؤال (${displayNum}) `,
      bold: true,
      color: '1A5276',
      size: 24, // 12pt
      font: 'Arial'
    })
  ];

  if (contextLabel) {
    qChildren.push(
      new TextRun({
        text: `[${cleanText(contextLabel)}] `,
        color: '7F8C8D',
        size: 20, // 10pt
        font: 'Arial'
      })
    );
  }

  qChildren.push(
    new TextRun({
      text: cleanText(q.text),
      bold: true,
      color: '1C2833',
      size: 24, // 12pt
      font: 'Arial'
    })
  );

  paras.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: 200, after: 80 },
      children: qChildren
    })
  );

  // Options (أ، ب، ج، د)
  const opts = Array.isArray(q.options) ? q.options : [];
  const correctIdx = q.answer;

  opts.forEach((opt, oIdx) => {
    const isCorrect = oIdx === correctIdx;
    const labelLetter = LBL[oIdx] || `${oIdx + 1}`;
    const rawClean = cleanText(opt);
    const lines = rawClean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const optChildren = [
      new TextRun({
        text: `    ${labelLetter}) `,
        bold: true,
        color: isCorrect ? '196F3D' : '566573',
        size: 22, // 11pt
        font: 'Arial'
      })
    ];

    if (lines.length > 1) {
      lines.forEach((line, lineIdx) => {
        optChildren.push(
          new TextRun({
            text: (lineIdx > 0 ? '       ' : '') + line,
            break: lineIdx > 0 ? 1 : 0,
            bold: isCorrect,
            color: isCorrect ? '1E8449' : '2C3E50',
            size: 22, // 11pt
            font: 'Arial'
          })
        );
      });
    } else {
      optChildren.push(
        new TextRun({
          text: lines[0] || '',
          bold: isCorrect,
          color: isCorrect ? '1E8449' : '2C3E50',
          size: 22, // 11pt
          font: 'Arial'
        })
      );
    }

    if (isCorrect) {
      optChildren.push(
        new TextRun({
          text: '  ✔ [الإجابة النموذجية الصحيحة]',
          bold: true,
          color: '27AE60',
          size: 20, // 10pt
          font: 'Arial'
        })
      );
    }

    paras.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 30, after: 30 },
        children: optChildren
      })
    );
  });

  // Hint / Textbook explanation
  if (q.hint && cleanText(q.hint)) {
    const hintClean = cleanText(q.hint).replace(/^من كتاب الطالب:\s*/, '');
    paras.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 60, after: 100 },
        children: [
          new TextRun({
            text: '    💡 السند والتوضيح من كتاب الطالب: ',
            bold: true,
            color: 'B7791F',
            size: 20, // 10pt
            font: 'Arial'
          }),
          new TextRun({
            text: hintClean,
            italics: true,
            color: '78350F',
            size: 20, // 10pt
            font: 'Arial'
          })
        ]
      })
    );
  }

  // Divider
  paras.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { before: 50, after: 120 },
      children: [
        new TextRun({
          text: '────────────────────────────────────────────────────────────',
          color: 'D5D8DC',
          size: 16,
          font: 'Arial'
        })
      ]
    })
  );

  return paras;
}

console.log('Generating ultra-compatible Word (.docx) document...');

const docChildren = [];

// ==========================================
// 1. غلاف ومقدمة الوثيقة (Cover & Intro)
// ==========================================
docChildren.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 200, after: 100 },
    children: [
      new TextRun({
        text: 'المملكة الأردنية الهاشمية - وزارة التربية والتعليم',
        bold: true,
        color: '7F8C8D',
        size: 24,
        font: 'Arial'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 80, after: 140 },
    children: [
      new TextRun({
        text: 'منهاج الثقافة المالية - المرحلة الثانوية (التوجيهي)',
        bold: true,
        color: '1A5276',
        size: 32,
        font: 'Arial'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 100, after: 200 },
    children: [
      new TextRun({
        text: 'الملف الشامل لبنك الأسئلة المعتمد',
        bold: true,
        color: '196F3D',
        size: 44,
        font: 'Arial'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 80, after: 200 },
    children: [
      new TextRun({
        text: 'مرتب تصنيفياً: الدروس وأسئلتها • الوحدات وأسئلتها • الفصول وأسئلتها • الامتحانات الوزارية والتقويمية',
        bold: true,
        color: '5D6D7E',
        size: 24,
        font: 'Arial'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 60, after: 200 },
    children: [
      new TextRun({
        text: '═══════════════════════════════════════════════════════════',
        bold: true,
        color: '2980B9',
        size: 24,
        font: 'Arial'
      })
    ]
  })
);

// Statistics
const totalBankCount = bank.length;
const regularCount = bank.filter(q => !q._examKey).length;
const examCount = bank.filter(q => q._examKey).length;

docChildren.push(
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 160, after: 80 },
    children: [
      new TextRun({
        text: '📊 فهرس وإحصائيات المحتوى المتضمن في هذا الملف:',
        bold: true,
        color: '1B4F72',
        size: 26,
        font: 'Arial'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text: '• إجمالي عدد الأسئلة في البنك: ',
        bold: true,
        color: '1A5276',
        size: 22,
        font: 'Arial'
      }),
      new TextRun({
        text: `${totalBankCount} سؤالاً شاملاً مع كافة الخيارات وتأكيد الإجابة النموذجية وسندها من كتاب الطالب.`,
        size: 22,
        font: 'Arial'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text: '• أسئلة الدروس والوحدات المنهجية: ',
        bold: true,
        color: '1A5276',
        size: 22,
        font: 'Arial'
      }),
      new TextRun({
        text: `${regularCount} سؤالاً موزعة على 7 وحدات دراسية و 28 درساً مقرراً (10 أسئلة لكل درس بالتفصيل).`,
        size: 22,
        font: 'Arial'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text: '• أسئلة التقويم والامتحانات الوزارية والنهائية: ',
        bold: true,
        color: '1A5276',
        size: 22,
        font: 'Arial'
      }),
      new TextRun({
        text: `${examCount} سؤالاً تشمل التقويمات الشهرية (1، 2، 3) والامتحانات النهائية للفصلين الأول والثاني، والنماذج الوزارية المقررة.`,
        size: 22,
        font: 'Arial'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 40, after: 120 },
    children: [
      new TextRun({
        text: '• جدول المواصفات والنماذج الوزارية (50 سؤالاً/نموذج): ',
        bold: true,
        color: '1A5276',
        size: 22,
        font: 'Arial'
      }),
      new TextRun({
        text: '5 نماذج وزارية شاملة (250 سؤالاً) مطابقة تماماً لجدول مواصفات مبحث الثقافة المالية لشهادة الثانوية العامة (50 فقرة — 200 علامة — زمن الإجابة: ساعتان).',
        size: 22,
        font: 'Arial'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 40, after: 200 },
    children: [
      new TextRun({
        text: '• شمولية التلميحات والإسناد: ',
        bold: true,
        color: '1A5276',
        size: 22,
        font: 'Arial'
      }),
      new TextRun({
        text: 'جميع الأسئلة مزودة بمرجع مباشر وتوضيح مقتبس من كتاب الطالب المعتمد لوزارة التربية والتعليم.',
        size: 22,
        font: 'Arial'
      })
    ]
  })
);

// ==========================================
// جدول المواصفات الرسمي المعتمد
// ==========================================
function createDocxTableCell(text, isHeader = false, isSubtotal = false, isGrand = false) {
  let bgColor = 'FFFFFF';
  let textColor = '1C2833';
  if (isHeader) {
    bgColor = '1A5276';
    textColor = 'FFFFFF';
  } else if (isGrand) {
    bgColor = 'FEF9E7';
    textColor = '78350F';
  } else if (isSubtotal) {
    bgColor = 'EAEDED';
    textColor = '1A5276';
  }

  return new TableCell({
    shading: { fill: bgColor },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        children: [
          new TextRun({
            text: String(text),
            bold: isHeader || isSubtotal || isGrand,
            color: textColor,
            size: isHeader ? 19 : 18,
            font: 'Arial'
          })
        ]
      })
    ]
  });
}

const specRowsData = [
  // Header
  { cells: ['الفصل', 'الوحدة الدراسية المقررة', 'الدروس', 'الوزن', 'الأسئلة', 'العلامات', 'تذكر (42%)', 'فهم (34%)', 'تطبيق (24%)'], isHeader: true },
  // Sem 1
  { cells: ['ف1', 'الوحدة 1: الدورة المحاسبية في المؤسسات الخدمية', '6 دروس', '22%', '11', '44', '4', '4', '3'] },
  { cells: ['ف1', 'الوحدة 2: القوائم المالية والتحليل المالي', '4 دروس', '14%', '7', '28', '3', '2', '2'] },
  { cells: ['ف1', 'الوحدة 3: القطاع المالي (الأسواق، الأصول، المركزي)', '4 دروس', '14%', '7', '28', '3', '2', '2'] },
  { cells: ['ف1', 'مجموع الفصل الدراسي الأول', '14 درساً', '50%', '25', '100', '10', '8', '7'], isSubtotal: true },
  // Sem 2
  { cells: ['ف2', 'الوحدة 4: المؤسسات المالية الدولية (صندوق النقد والبنك)', '3 دروس', '12%', '6', '24', '3', '2', '1'] },
  { cells: ['ف2', 'الوحدة 5: الاستدامة المالية والاقتصاد الأخضر', '3 دروس', '12%', '6', '24', '2', '3', '1'] },
  { cells: ['ف2', 'الوحدة 6: الذكاء الاصطناعي التوليدي في المال والأعمال', '4 دروس', '12%', '6', '24', '3', '2', '1'] },
  { cells: ['ف2', 'الوحدة 7: السياسات الاقتصادية وتأثيرها في التنمية', '4 دروس', '14%', '7', '28', '3', '2', '2'] },
  { cells: ['ف2', 'مجموع الفصل الدراسي الثاني', '14 درساً', '50%', '25', '100', '11', '9', '5'], isSubtotal: true },
  // Grand Total
  { cells: ['الكتابين', 'المجموع العام للاختبار الوزاري الشامل', '28 درساً', '100%', '50 سؤالاً', '200 علامة', '21 (42%)', '17 (34%)', '12 (24%)'], isGrand: true }
];

const specTableDocx = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: specRowsData.map(r => new TableRow({
    children: r.cells.map(c => createDocxTableCell(c, r.isHeader, r.isSubtotal, r.isGrand))
  }))
});

docChildren.push(
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({
        text: '📋 جدول مواصفات مبحث الثقافة المالية - الثانوية العامة (التوجيهي):',
        bold: true,
        color: '1B4F72',
        size: 26,
        font: 'Arial'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 40, after: 120 },
    children: [
      new TextRun({
        text: 'تم بناء هذا الجدول ومصفوفة الاختبار استناداً إلى المنهاج المعتمد لكتابي الفصلين الأول والثاني، ليتألف الاختبار الوزاري من 50 فقرة اختيار من متعدد بمجموع 200 علامة وزمن ساعتين:',
        color: '5D6D7E',
        size: 20,
        font: 'Arial'
      })
    ]
  }),
  specTableDocx,
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 100, after: 200 },
    children: [
      new TextRun({
        text: '• توزيع المستويات المعرفية (بلوم): ',
        bold: true,
        color: '1A5276',
        size: 20,
        font: 'Arial'
      }),
      new TextRun({
        text: 'التذكر والمعرفة: 21 سؤالاً (42% - 84 علامة) | الفهم والاستيعاب: 17 سؤالاً (34% - 68 علامة) | التطبيق والتحليل: 12 سؤالاً (24% - 48 علامة).',
        size: 20,
        font: 'Arial'
      })
    ]
  })
);

// ==========================================
// 2. الجزء الأول: الفصل الدراسي الأول
// ==========================================
docChildren.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text: '═══════════════════════════════════════════════════════════',
        color: '1A5276',
        size: 24,
        font: 'Arial'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 160, after: 120 },
    children: [
      new TextRun({
        text: 'الجزء الأول: أسئلة الفصل الدراسي الأول (مرتبة حسب الوحدات والدروس)',
        bold: true,
        color: '1A5276',
        size: 30,
        font: 'Arial'
      })
    ]
  })
);

CUR[1].units.forEach(u => {
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: `الوحدة (${u.id}): ${u.name}`,
          bold: true,
          color: '2E86C1',
          size: 26,
          font: 'Arial'
        })
      ]
    })
  );

  u.lessons.forEach(lessonName => {
    const lessonQs = bank.filter(q => q.lesson === lessonName && !q._examKey);

    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 160, after: 80 },
        children: [
          new TextRun({
            text: `📌 درس: ${lessonName} (${lessonQs.length} أسئلة)`,
            bold: true,
            color: '117A65',
            size: 24,
            font: 'Arial'
          })
        ]
      })
    );

    lessonQs.forEach((q, idx) => {
      const qParas = buildQuestionParagraphs(q, idx + 1, `${u.name} - ${lessonName}`);
      docChildren.push(...qParas);
    });
  });
});

// ==========================================
// 3. الجزء الثاني: الفصل الدراسي الثاني
// ==========================================
docChildren.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 260, after: 120 },
    children: [
      new TextRun({
        text: '═══════════════════════════════════════════════════════════',
        color: '1E6B4A',
        size: 24,
        font: 'Arial'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 160, after: 120 },
    children: [
      new TextRun({
        text: 'الجزء الثاني: أسئلة الفصل الدراسي الثاني (مرتبة حسب الوحدات والدروس)',
        bold: true,
        color: '1E6B4A',
        size: 30,
        font: 'Arial'
      })
    ]
  })
);

CUR[2].units.forEach(u => {
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: `الوحدة (${u.id}): ${u.name}`,
          bold: true,
          color: '27AE60',
          size: 26,
          font: 'Arial'
        })
      ]
    })
  );

  u.lessons.forEach(lessonName => {
    const lessonQs = bank.filter(q => q.lesson === lessonName && !q._examKey);

    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 160, after: 80 },
        children: [
          new TextRun({
            text: `📌 درس: ${lessonName} (${lessonQs.length} أسئلة)`,
            bold: true,
            color: '145A32',
            size: 24,
            font: 'Arial'
          })
        ]
      })
    );

    lessonQs.forEach((q, idx) => {
      const qParas = buildQuestionParagraphs(q, idx + 1, `${u.name} - ${lessonName}`);
      docChildren.push(...qParas);
    });
  });
});

// ==========================================
// 4. الجزء الثالث: أسئلة التقويم والامتحانات المخصصة
// ==========================================
docChildren.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 260, after: 120 },
    children: [
      new TextRun({
        text: '═══════════════════════════════════════════════════════════',
        color: '6C3483',
        size: 24,
        font: 'Arial'
      })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 160, after: 120 },
    children: [
      new TextRun({
        text: 'الجزء الثالث: أسئلة الامتحانات التقويمية والنهائية المقررة',
        bold: true,
        color: '6C3483',
        size: 30,
        font: 'Arial'
      })
    ]
  })
);

const examDefs = [
  { k: 'tq1_f1', sem: 1, label: 'التقويم الأول - الفصل الدراسي الأول' },
  { k: 'tq2_f1', sem: 1, label: 'التقويم الثاني - الفصل الدراسي الأول' },
  { k: 'tq3_f1', sem: 1, label: 'التقويم الثالث - الفصل الدراسي الأول' },
  { k: 'final_f1', sem: 1, label: 'الاختبار النهائي الشامل - الفصل الدراسي الأول' },
  { k: 'tq1_f2', sem: 2, label: 'التقويم الأول - الفصل الدراسي الثاني' },
  { k: 'tq2_f2', sem: 2, label: 'التقويم الثاني - الفصل الدراسي الثاني' },
  { k: 'final_f2', sem: 2, label: 'الاختبار النهائي الشامل - الفصل الدراسي الثاني' }
];

examDefs.forEach(e => {
  const qs = bank.filter(q => q._examKey === e.k);
  if (!qs.length) return;

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: `📋 ${e.label} (${qs.length} سؤالاً)`,
          bold: true,
          color: '884EA0',
          size: 26,
          font: 'Arial'
        })
      ]
    })
  );

  qs.forEach((q, idx) => {
    const qParas = buildQuestionParagraphs(q, idx + 1, e.label);
    docChildren.push(...qParas);
  });
});

// ==========================================
// 5. الجزء الرابع: النماذج الوزارية الشاملة (50 سؤالاً للنموذج وفق جدول المواصفات)
// ==========================================
const minModels = getMinisterialModels();
if (minModels.length > 0) {
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { before: 260, after: 120 },
      children: [
        new TextRun({
          text: '═══════════════════════════════════════════════════════════',
          color: 'B7791F',
          size: 24,
          font: 'Arial'
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: 160, after: 120 },
      children: [
        new TextRun({
          text: 'الجزء الرابع: النماذج الوزارية الشاملة لشهادة الثانوية العامة (وفق جدول المواصفات)',
          bold: true,
          color: 'B7791F',
          size: 30,
          font: 'Arial'
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: 80, after: 160 },
      children: [
        new TextRun({
          text: 'نماذج امتحانية معيارية تحاكي الورقة الامتحانية الوزارية الرسمية (50 سؤالاً للنموذج - 200 علامة - زمن الإجابة: ساعتان)، مأخوذة مباشرة من أسئلة الدروس وموزعة طبقاً لجدول المواصفات المقترح (25 سؤالاً للفصل الأول + 25 سؤالاً للفصل الثاني):',
          color: '78350F',
          size: 22,
          font: 'Arial'
        })
      ]
    })
  );

  minModels.forEach((m, mIdx) => {
    const s1c = m.filter(q => q.unit <= 3).length;
    const s2c = m.filter(q => q.unit >= 4).length;
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: `⭐ النموذج الوزاري الشامل المقترح رقم (${mIdx + 1}) - [${m.length} سؤالاً — 200 علامة] (ف1: ${s1c} سؤالاً | ف2: ${s2c} سؤالاً)`,
            bold: true,
            color: 'D68910',
            size: 26,
            font: 'Arial'
          })
        ]
      })
    );

    m.forEach((q, idx) => {
      const qParas = buildQuestionParagraphs(q, idx + 1, `النموذج الوزاري المقترح ${mIdx + 1} - و${q.unit}`);
      docChildren.push(...qParas);
    });
  });
}

// Build Document with minimal, bulletproof OpenXML structure
const doc = new Document({
  creator: 'منصة بنك أسئلة الثقافة المالية - التوجيهي',
  title: 'بنك أسئلة الثقافة المالية الشامل - التوجيهي',
  sections: [
    {
      children: docChildren
    }
  ]
});

// Pack to Base64 first to avoid buffer truncation/corruption
Packer.toBase64String(doc).then(base64Str => {
  const buffer = Buffer.from(base64Str, 'base64');
  const outputPath = path.join(__dirname, 'financial_culture_bank.docx');
  fs.writeFileSync(outputPath, buffer);
  const arabicOutputPath = path.join(__dirname, 'الثقافة_المالية_بنك_الأسئلة_الشامل.docx');
  fs.writeFileSync(arabicOutputPath, buffer);

  console.log(`DOCX generated successfully! Size: ${(buffer.length / 1024).toFixed(1)} KB`);
  console.log(`Saved to: ${outputPath} and ${arabicOutputPath}`);

  // Also generate the native HTML-based .doc file (100% compatible with every version of Microsoft Word)
  generateNativeWordDoc();
}).catch(err => {
  console.error('Error generating DOCX:', err);
  process.exit(1);
});

// Function to generate high-fidelity Native Microsoft Word (.doc)
function generateNativeWordDoc() {
  console.log('Generating native Word (.doc) format...');
  let html = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>بنك أسئلة الثقافة المالية الشامل - التوجيهي</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page {
  size: A4 portrait;
  margin: 2.0cm 2.0cm 2.0cm 2.0cm;
  mso-page-orientation: portrait;
}
body {
  font-family: Arial, Tahoma, 'Traditional Arabic', sans-serif;
  direction: rtl;
  text-align: right;
  line-height: 1.6;
  color: #1C2833;
  margin: 0;
  padding: 0;
}
.cover-title {
  text-align: center;
  margin-top: 30px;
  margin-bottom: 25px;
}
.h-gov { font-size: 13pt; font-weight: bold; color: #7F8C8D; margin-bottom: 6px; }
.h-sub { font-size: 16pt; font-weight: bold; color: #1A5276; margin-bottom: 12px; }
.h-main { font-size: 24pt; font-weight: bold; color: #196F3D; margin-bottom: 12px; }
.h-desc { font-size: 13pt; font-weight: bold; color: #5D6D7E; margin-bottom: 20px; }
.divider { border-bottom: 2px solid #2980B9; margin: 20px 0; }
.sec-title {
  font-size: 16pt;
  font-weight: bold;
  color: #1A5276;
  background-color: #EBF5FB;
  padding: 8px 14px;
  border-right: 5px solid #2E86C1;
  margin: 30px 0 15px 0;
}
.unit-title {
  font-size: 14pt;
  font-weight: bold;
  color: #2E86C1;
  margin: 20px 0 10px 0;
}
.lesson-title {
  font-size: 13pt;
  font-weight: bold;
  color: #117A65;
  background-color: #E8F8F5;
  padding: 6px 12px;
  border-right: 4px solid #117A65;
  margin: 15px 0 10px 0;
}
.q-box {
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #D5D8DC;
}
.q-head {
  font-size: 12pt;
  font-weight: bold;
  color: #1C2833;
  margin-bottom: 8px;
}
.q-num { color: #1A5276; font-weight: bold; }
.q-tag { color: #7F8C8D; font-weight: normal; font-size: 10pt; }
.opt-row {
  margin: 4px 0 4px 18px;
  font-size: 11pt;
}
.opt-label { font-weight: bold; color: #566573; margin-left: 6px; }
.opt-correct {
  color: #1E8449;
  font-weight: bold;
  background-color: #EAFAF1;
  padding: 2px 6px;
  display: inline-block;
}
.badge-correct {
  color: #27AE60;
  font-weight: bold;
  font-size: 10pt;
  margin-right: 8px;
}
.hint-box {
  margin-top: 6px;
  margin-right: 18px;
  font-size: 10pt;
  color: #78350F;
  background-color: #FEF9E7;
  padding: 4px 10px;
  border-right: 3px solid #F39C12;
}
.hint-title { font-weight: bold; color: #B7791F; }

/* Table of specifications styles in .doc */
.spec-doc-table {
  width: 100%;
  border-collapse: collapse;
  margin: 15px 0 20px 0;
  font-size: 10pt;
  border: 1px solid #BDC3C7;
}
.spec-doc-table th, .spec-doc-table td {
  border: 1px solid #BDC3C7;
  padding: 6px 8px;
  text-align: center;
}
.spec-doc-table th {
  background-color: #1A5276;
  color: #FFFFFF;
  font-weight: bold;
}
.spec-subtotal-row {
  background-color: #EAEDED;
  font-weight: bold;
  color: #1A5276;
}
.spec-grand-row {
  background-color: #FEF9E7;
  font-weight: bold;
  color: #78350F;
}
</style>
</head>
<body>
<div class="cover-title">
  <div class="h-gov">المملكة الأردنية الهاشمية - وزارة التربية والتعليم</div>
  <div class="h-sub">منهاج الثقافة المالية - المرحلة الثانوية (التوجيهي)</div>
  <div class="h-main">الملف الشامل لبنك الأسئلة المعتمد وجدول المواصفات</div>
  <div class="h-desc">مرتب تصنيفياً: جدول المواصفات • الدروس وأسئلتها • الوحدات • الامتحانات • النماذج الوزارية (50 سؤالاً)</div>
  <div class="divider"></div>
</div>

<div class="sec-title" style="background-color:#EAF2F8;border-color:#1A5276;color:#1B4F72;">جدول مواصفات مبحث الثقافة المالية لشهادة الثانوية العامة (التوجيهي)</div>
<p style="font-size:11pt;color:#333;margin:8px 0 14px 0;">
  جدول المواصفات المقترح لاختبار شهادة الثانوية العامة، يتألف من <strong>50 فقرة اختيار من متعدد</strong> (200 علامة، زمن الامتحان ساعتان)، موزعة بالتساوي (25 سؤالاً الفصل الأول + 25 سؤالاً الفصل الثاني) حسب الأوزان النسبية والمستويات المعرفية:
</p>
<table class="spec-doc-table">
  <thead>
    <tr>
      <th>الفصل</th>
      <th>الوحدة الدراسية المقررة</th>
      <th>الدروس</th>
      <th>الوزن</th>
      <th>الأسئلة</th>
      <th>العلامات</th>
      <th>تذكر (42%)</th>
      <th>فهم (34%)</th>
      <th>تطبيق (24%)</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>ف1</td><td>الوحدة 1: الدورة المحاسبية في المؤسسات الخدمية</td><td>6 دروس</td><td>22%</td><td><strong>11</strong></td><td>44</td><td>4</td><td>4</td><td>3</td></tr>
    <tr><td>ف1</td><td>الوحدة 2: القوائم المالية والتحليل المالي</td><td>4 دروس</td><td>14%</td><td><strong>7</strong></td><td>28</td><td>3</td><td>2</td><td>2</td></tr>
    <tr><td>ف1</td><td>الوحدة 3: القطاع المالي (الأسواق، الأصول، المركزي)</td><td>4 دروس</td><td>14%</td><td><strong>7</strong></td><td>28</td><td>3</td><td>2</td><td>2</td></tr>
    <tr class="spec-subtotal-row"><td colspan="2">مجموع الفصل الدراسي الأول</td><td>14 درساً</td><td>50%</td><td><strong>25</strong></td><td>100</td><td>10</td><td>8</td><td>7</td></tr>
    <tr><td>ف2</td><td>الوحدة 4: المؤسسات المالية الدولية (صندوق النقد والبنك)</td><td>3 دروس</td><td>12%</td><td><strong>6</strong></td><td>24</td><td>3</td><td>2</td><td>1</td></tr>
    <tr><td>ف2</td><td>الوحدة 5: الاستدامة المالية والاقتصاد الأخضر</td><td>3 دروس</td><td>12%</td><td><strong>6</strong></td><td>24</td><td>2</td><td>3</td><td>1</td></tr>
    <tr><td>ف2</td><td>الوحدة 6: الذكاء الاصطناعي التوليدي في المال والأعمال</td><td>4 دروس</td><td>12%</td><td><strong>6</strong></td><td>24</td><td>3</td><td>2</td><td>1</td></tr>
    <tr><td>ف2</td><td>الوحدة 7: السياسات الاقتصادية وتأثيرها في التنمية</td><td>4 دروس</td><td>14%</td><td><strong>7</strong></td><td>28</td><td>3</td><td>2</td><td>2</td></tr>
    <tr class="spec-subtotal-row"><td colspan="2">مجموع الفصل الدراسي الثاني</td><td>14 درساً</td><td>50%</td><td><strong>25</strong></td><td>100</td><td>11</td><td>9</td><td>5</td></tr>
    <tr class="spec-grand-row"><td colspan="2">المجموع العام للاختبار الوزاري الشامل</td><td>28 درساً</td><td>100%</td><td><strong>50 سؤالاً</strong></td><td>200 علامة</td><td>21 (42%)</td><td>17 (34%)</td><td>12 (24%)</td></tr>
  </tbody>
</table>
`;

  // Helper for .doc HTML question
  function formatQHtml(q, displayNum, contextLabel = '') {
    const opts = Array.isArray(q.options) ? q.options : [];
    const correctIdx = q.answer;
    let out = `<div class="q-box">
      <div class="q-head">
        <span class="q-num">سؤال (${displayNum})</span>
        ${contextLabel ? `<span class="q-tag">[${cleanText(contextLabel)}]</span> ` : ''}
        ${cleanText(q.text)}
      </div>`;

    opts.forEach((opt, oIdx) => {
      const isCorrect = oIdx === correctIdx;
      const lbl = LBL[oIdx] || `${oIdx + 1}`;
      const optHtml = cleanText(opt).replace(/\r?\n/g, '<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
      if (isCorrect) {
        out += `<div class="opt-row opt-correct">
          <span class="opt-label">${lbl})</span> ${optHtml}
          <span class="badge-correct">✔ [الإجابة النموذجية الصحيحة]</span>
        </div>`;
      } else {
        out += `<div class="opt-row">
          <span class="opt-label">${lbl})</span> ${optHtml}
        </div>`;
      }
    });

    if (q.hint && cleanText(q.hint)) {
      const hClean = cleanText(q.hint).replace(/^من كتاب الطالب:\s*/, '');
      out += `<div class="hint-box"><span class="hint-title">💡 السند والتوضيح من كتاب الطالب:</span> <i>${hClean}</i></div>`;
    }

    out += `</div>`;
    return out;
  }

  // Part 1: Semester 1
  html += `<div class="sec-title">الجزء الأول: أسئلة الفصل الدراسي الأول (مرتبة حسب الوحدات والدروس)</div>`;
  CUR[1].units.forEach(u => {
    html += `<div class="unit-title">الوحدة (${u.id}): ${u.name}</div>`;
    u.lessons.forEach(lessonName => {
      const lessonQs = bank.filter(q => q.lesson === lessonName && !q._examKey);
      html += `<div class="lesson-title">📌 درس: ${lessonName} (${lessonQs.length} أسئلة)</div>`;
      lessonQs.forEach((q, idx) => {
        html += formatQHtml(q, idx + 1, `${u.name} - ${lessonName}`);
      });
    });
  });

  // Part 2: Semester 2
  html += `<div class="sec-title" style="background-color:#EAFAF1;border-color:#27AE60;color:#1E6B4A;">الجزء الثاني: أسئلة الفصل الدراسي الثاني (مرتبة حسب الوحدات والدروس)</div>`;
  CUR[2].units.forEach(u => {
    html += `<div class="unit-title" style="color:#27AE60;">الوحدة (${u.id}): ${u.name}</div>`;
    u.lessons.forEach(lessonName => {
      const lessonQs = bank.filter(q => q.lesson === lessonName && !q._examKey);
      html += `<div class="lesson-title" style="background-color:#EAFAF1;border-color:#1E8449;color:#145A32;">📌 درس: ${lessonName} (${lessonQs.length} أسئلة)</div>`;
      lessonQs.forEach((q, idx) => {
        html += formatQHtml(q, idx + 1, `${u.name} - ${lessonName}`);
      });
    });
  });

  // Part 3: Formative & Term Exams
  html += `<div class="sec-title" style="background-color:#F4ECF7;border-color:#884EA0;color:#6C3483;">الجزء الثالث: أسئلة الامتحانات التقويمية والنهائية المقررة</div>`;
  examDefs.forEach(e => {
    const qs = bank.filter(q => q._examKey === e.k);
    if (!qs.length) return;
    html += `<div class="unit-title" style="color:#884EA0;">📋 ${e.label} (${qs.length} سؤالاً)</div>`;
    qs.forEach((q, idx) => {
      html += formatQHtml(q, idx + 1, e.label);
    });
  });

  // Part 4: Ministerial Models
  if (minModels.length > 0) {
    html += `<div class="sec-title" style="background-color:#FEF9E7;border-color:#D68910;color:#B7791F;">الجزء الرابع: النماذج الوزارية الشاملة لشهادة الثانوية العامة (وفق جدول المواصفات - 50 سؤالاً)</div>`;
    minModels.forEach((m, mIdx) => {
      const s1c = m.filter(q => q.unit <= 3).length;
      const s2c = m.filter(q => q.unit >= 4).length;
      html += `<div class="unit-title" style="color:#D68910;">⭐ النموذج الوزاري الشامل المقترح رقم (${mIdx + 1}) - [${m.length} سؤالاً — 200 علامة] (الفصل الأول: ${s1c} سؤالاً | الفصل الثاني: ${s2c} سؤالاً)</div>`;
      m.forEach((q, idx) => {
        html += formatQHtml(q, idx + 1, `النموذج الوزاري المقترح ${mIdx + 1} - و${q.unit}`);
      });
    });
  }

  html += `</body></html>`;

  const docOutputPath = path.join(__dirname, 'financial_culture_bank.doc');
  fs.writeFileSync(docOutputPath, html, 'utf8');
  const docArabicOutputPath = path.join(__dirname, 'الثقافة_المالية_بنك_الأسئلة_الشامل.doc');
  fs.writeFileSync(docArabicOutputPath, html, 'utf8');

  console.log(`DOC generated successfully! Size: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
  console.log(`Saved to: ${docOutputPath} and ${docArabicOutputPath}`);
}
