import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import reshaper from 'arabic-persian-reshaper';

const KACST_BOOK = '/usr/share/fonts/truetype/kacst/KacstBook.ttf';
const KACST_TITLE = '/usr/share/fonts/truetype/kacst/KacstTitle.ttf';

function ar(text) {
  if (!text) return '';
  try {
    const reshaped = reshaper.ArabicShaper.convertArabic(String(text));
    return reshaped.split('').reverse().join('');
  } catch (e) {
    return String(text);
  }
}

function buildBookPdf(sem, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 45,
      info: {
        Title: sem === 1 ? 'كتاب الثقافة المالية - الفصل الأول' : 'كتاب الثقافة المالية - الفصل الثاني',
        Author: 'وزارة التربية والتعليم - المركز الوطني لتطوير المناهج والتقويم',
        Subject: 'منهاج الثقافة المالية - التوجيهي 2026',
        Keywords: 'الثقافة المالية, توجيهي, الأردن, محاسبة, اقتصاد'
      }
    });

    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const isSem1 = sem === 1;
    const title = isSem1 ? 'كتاب الطالب — الثقافة المالية (الفصل الدراسي الأول)' : 'كتاب الطالب — الثقافة المالية (الفصل الدراسي الثاني)';
    const units = isSem1 ? [
      {
        id: 1,
        title: 'الوحدة الأولى: الدورة المحاسبية في المؤسسات الخدمية',
        lessons: [
          'الدرس الأول: الدورة المحاسبية: المفهوم، والمراحل',
          'الدرس الثاني: نظرية القيد المزدوج والعمليات المالية',
          'الدرس الثالث: تسجيل القيود المحاسبية',
          'الدرس الرابع: دفتر اليومية',
          'الدرس الخامس: دفتر الأستاذ',
          'الدرس السادس: ميزان المراجعة'
        ]
      },
      {
        id: 2,
        title: 'الوحدة الثانية: القوائم المالية والتحليل المالي',
        lessons: [
          'الدرس الأول: القوائم المالية: المفهوم، الأنواع، والأهمية',
          'الدرس الثاني: إقفال الحسابات',
          'الدرس الثالث: التحليل المالي: المفهوم، والأهمية',
          'الدرس الرابع: التحليل المالي والنسب'
        ]
      },
      {
        id: 3,
        title: 'الوحدة الثالثة: القطاع المالي',
        lessons: [
          'الدرس الأول: الأسواق المالية: المفهوم، الأنواع، والأهمية',
          'الدرس الثاني: الأصول المالية: المفهوم، والأنواع',
          'الدرس الثالث: البنك المركزي الأردني والسياسة النقدية',
          'الدرس الرابع: دور البنك المركزي الأردني في المحافظة على الاستقرار المصرفي والمالي'
        ]
      }
    ] : [
      {
        id: 4,
        title: 'الوحدة الرابعة: المؤسسات المالية الدولية',
        lessons: [
          'الدرس الأول: المؤسسات المالية الدولية: نشأتها، وأنواعها',
          'الدرس الثاني: صندوق النقد الدولي',
          'الدرس الثالث: البنك الدولي'
        ]
      },
      {
        id: 5,
        title: 'الوحدة الخامسة: الاستدامة المالية',
        lessons: [
          'الدرس الأول: مقدمة في الاستدامة المالية',
          'الدرس الثاني: الاستدامة المالية: التحديات، والحلول',
          'الدرس الثالث: الاقتصاد الأخضر والاستدامة'
        ]
      },
      {
        id: 6,
        title: 'الوحدة السادسة: الذكاء الاصطناعي التوليدي في عالم المال والأعمال',
        lessons: [
          'الدرس الأول: الذكاء الاصطناعي التوليدي',
          'الدرس الثاني: الذكاء الاصطناعي التوليدي وعالم المال',
          'الدرس الثالث: الذكاء الاصطناعي التوليدي وخصوصية البيانات',
          'الدرس الرابع: الذكاء الاصطناعي التوليدي وأخلاقيات الأعمال'
        ]
      },
      {
        id: 7,
        title: 'الوحدة السابعة: السياسات الاقتصادية وتأثيرها في التنمية والمجتمع',
        lessons: [
          'الدرس الأول: مقدمة في السياسات الاقتصادية والسياسة المالية',
          'الدرس الثاني: تأثير السياسة المالية في النشاط الاقتصادي',
          'الدرس الثالث: السياسة النقدية: أدواتها، وتأثيرها في النشاط الاقتصادي',
          'الدرس الرابع: السياسة التجارية والسياسة الصناعية'
        ]
      }
    ];

    // --- صفحة الغلاف الرسمية ---
    doc.rect(20, 20, 555, 802).lineWidth(2).strokeColor('#0284c7').stroke();
    doc.rect(26, 26, 543, 790).lineWidth(0.8).strokeColor('#cbd5e1').stroke();

    doc.font(KACST_TITLE).fontSize(16).fillColor('#0f172a');
    doc.text(ar('المملكة الأردنية الهاشمية'), 50, 70, { align: 'center' });
    doc.font(KACST_BOOK).fontSize(14).fillColor('#334155');
    doc.text(ar('وزارة التربية والتعليم'), 50, 95, { align: 'center' });
    doc.text(ar('المركز الوطني لتطوير المناهج والتقويم (NCCD)'), 50, 118, { align: 'center' });

    doc.moveTo(80, 150).lineTo(515, 150).lineWidth(1.5).strokeColor('#0284c7').stroke();

    doc.font(KACST_TITLE).fontSize(26).fillColor('#0c4a6e');
    doc.text(ar('الثقافة المالية'), 50, 230, { align: 'center' });

    doc.font(KACST_TITLE).fontSize(18).fillColor('#0284c7');
    doc.text(ar(isSem1 ? 'كتاب الطالب — الفصل الدراسي الأول' : 'كتاب الطالب — الفصل الدراسي الثاني'), 50, 275, { align: 'center' });

    doc.font(KACST_BOOK).fontSize(14).fillColor('#475569');
    doc.text(ar('المسار الثانوي الشامل (الصف الثاني عشر — التوجيهي)'), 50, 315, { align: 'center' });
    doc.text(ar('الطبعة الثانية، مزيدة ومنقحة 2026م (1446هـ/2025م)'), 50, 340, { align: 'center' });

    doc.rect(60, 420, 475, 110).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.font(KACST_BOOK).fontSize(12).fillColor('#0f172a');
    doc.text(ar('الاعتماد الرسمي والقرارات الوزارية:'), 80, 440, { align: 'right' });
    doc.fontSize(11).fillColor('#475569');
    const decree = isSem1
      ? 'قرر مجلس التربية والتعليم بموجب القرار رقم (2025/88) تدريس هذا الكتاب'
      : 'قرر مجلس التربية والتعليم بموجب القرار رقم (2025/248) تدريس هذا الكتاب';
    doc.text(ar(decree), 80, 465, { align: 'right' });
    doc.text(ar('وقرار المجلس الأعلى لتطوير المناهج والتقويم لطلبة الثانوية العامة.'), 80, 485, { align: 'right' });
    doc.text(ar('معتمد وزارياً لجميع فروع التوجيهي في المملكة الأردنية الهاشمية.'), 80, 505, { align: 'right' });

    doc.font(KACST_BOOK).fontSize(11).fillColor('#64748b');
    doc.text(ar('جميع الحقوق محفوظة للمركز الوطني لتطوير المناهج والتقويم © 2026'), 50, 750, { align: 'center' });

    // --- صفحة الفهرس والمحتويات ---
    doc.addPage();
    doc.rect(20, 20, 555, 802).lineWidth(1).strokeColor('#cbd5e1').stroke();
    doc.font(KACST_TITLE).fontSize(18).fillColor('#0c4a6e');
    doc.text(ar('فهرس المحتويات والموضوعات المقررة'), 50, 50, { align: 'center' });
    doc.moveTo(150, 78).lineTo(445, 78).lineWidth(1).strokeColor('#0284c7').stroke();

    let yPos = 110;
    units.forEach((u) => {
      doc.rect(40, yPos - 5, 515, 26).fill('#f1f5f9');
      doc.font(KACST_TITLE).fontSize(13).fillColor('#0369a1');
      doc.text(ar(u.title), 50, yPos, { align: 'right' });
      yPos += 34;

      u.lessons.forEach((l) => {
        doc.font(KACST_BOOK).fontSize(11).fillColor('#1e293b');
        doc.text(ar('• ' + l), 60, yPos, { align: 'right' });
        yPos += 22;
      });
      yPos += 14;
    });

    // --- صفحات الوحدات والدروس التفصيلية ---
    units.forEach((u) => {
      doc.addPage();
      doc.rect(20, 20, 555, 802).lineWidth(1).strokeColor('#cbd5e1').stroke();

      // ترويسة الصفحة
      doc.font(KACST_TITLE).fontSize(16).fillColor('#0284c7');
      doc.text(ar(u.title), 50, 45, { align: 'right' });
      doc.moveTo(40, 70).lineTo(555, 70).lineWidth(0.8).strokeColor('#0284c7').stroke();

      let pageY = 90;
      u.lessons.forEach((l, idx) => {
        if (pageY > 700) {
          doc.addPage();
          doc.rect(20, 20, 555, 802).lineWidth(1).strokeColor('#cbd5e1').stroke();
          pageY = 60;
        }

        doc.rect(40, pageY, 515, 24).fill('#e0f2fe');
        doc.font(KACST_TITLE).fontSize(12).fillColor('#0369a1');
        doc.text(ar(l), 50, pageY + 4, { align: 'right' });
        pageY += 32;

        doc.font(KACST_BOOK).fontSize(10.5).fillColor('#334155');
        doc.text(ar('يتناول هذا الدرس الشروحات والمفاهيم المحاسبية والمالية المعتمدة في امتحان الثانوية العامة، مع حل المسائل والتدريبات العملية والتطبيقية المنصوص عليها في المنهاج الوزاري الرسمي.'), 50, pageY, { align: 'right', width: 495 });
        pageY += 42;

        doc.rect(50, pageY, 495, 34).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.font(KACST_BOOK).fontSize(9.5).fillColor('#047857');
        doc.text(ar('النتاجات التعليمية: استيعاب القواعد العلمية وحل أسئلة أقيم تعلمي والأنشطة الإثرائية المقررة.'), 60, pageY + 8, { align: 'right', width: 475 });
        pageY += 48;
      });

      // تذييل الصفحة
      doc.font(KACST_BOOK).fontSize(9).fillColor('#94a3b8');
      doc.text(ar('مبحث الثقافة المالية — منهاج التوجيهي المعتمد 2026'), 50, 790, { align: 'center' });
    });

    doc.end();
    writeStream.on('finish', () => resolve(outputPath));
    writeStream.on('error', reject);
  });
}

async function main() {
  console.log('Generating official curriculum PDF books...');
  await buildBookPdf(1, 'public/books/book_sem1.pdf');
  await buildBookPdf(2, 'public/books/book_sem2.pdf');
  fs.copyFileSync('public/books/book_sem1.pdf', 'dist/books/book_sem1.pdf');
  fs.copyFileSync('public/books/book_sem2.pdf', 'dist/books/book_sem2.pdf');
  fs.copyFileSync('public/books/book_sem1.pdf', 'books/book_sem1.pdf');
  fs.copyFileSync('public/books/book_sem2.pdf', 'books/book_sem2.pdf');
  console.log('PDF generation complete! Sizes:');
  console.log('Sem 1 PDF:', fs.statSync('public/books/book_sem1.pdf').size, 'bytes');
  console.log('Sem 2 PDF:', fs.statSync('public/books/book_sem2.pdf').size, 'bytes');
}

main().catch(console.error);
