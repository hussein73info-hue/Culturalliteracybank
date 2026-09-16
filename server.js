import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, deleteDoc, setLogLevel } from 'firebase/firestore';
import { BOOKS_DATA } from './books_data.js';
import vm from 'vm';

// Silence benign idle gRPC disconnection notices in Node environment
try {
  setLogLevel('error');
} catch (e) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load AQYEM_QUESTIONS from aqyem_data.js safely without requiring ES module export in browser
function loadLocalAqyemQuestions() {
  try {
    const filePath = path.join(__dirname, 'aqyem_data.js');
    if (fs.existsSync(filePath)) {
      const code = fs.readFileSync(filePath, 'utf8');
      const sandbox = { window: {}, module: { exports: {} } };
      vm.runInNewContext(code, sandbox);
      const raw = sandbox.AQYEM_QUESTIONS || sandbox.window.AQYEM_QUESTIONS || sandbox.module.exports.AQYEM_QUESTIONS || [];
      return JSON.parse(JSON.stringify(raw));
    }
  } catch (err) {
    console.error('[Server] Failed to load local AQYEM_QUESTIONS:', err);
  }
  return [];
}

const AQYEM_QUESTIONS = loadLocalAqyemQuestions();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON bodies
app.use(express.json({ limit: '10mb' }));

// Prevent browser caching of static scripts and markup during updates
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Initialize Firebase Firestore
let db = null;
let firebaseConfig = null;
try {
  const configPath = path.join(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || '(default)');
    console.log('[Firebase] Firestore initialized with database:', firebaseConfig.firestoreDatabaseId);
    // Auto-seed books & Aqyem questions to Firestore
    seedBooksToFirestore().catch(e => console.warn('[Firebase] Initial book sync notice:', e.message));
    seedAqyemToFirestore().catch(e => console.warn('[Firebase] Initial aqyem sync notice:', e.message));
  } else {
    console.warn('[Firebase] firebase-applet-config.json not found');
  }
} catch (err) {
  console.error('[Firebase] Initialization error:', err);
}

// ==========================================
// Firebase Firestore API Routes & In-Memory High-Performance Cache
// ==========================================

// Server-side cache for thousands of concurrent students (Zero quota waste)
let questionsSyncCache = null;
let lastSyncFetchTime = 0;
const SYNC_CACHE_TTL_MS = 60 * 1000; // 60 seconds auto-refresh
let syncDataETag = `W/"sync-${Date.now()}"`;

function invalidateSyncCache() {
  questionsSyncCache = null;
  lastSyncFetchTime = 0;
  syncDataETag = `W/"sync-${Date.now()}"`;
}

// Check Firestore connection status
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    firestoreReady: !!db,
    databaseId: firebaseConfig?.firestoreDatabaseId || '(default)',
    projectId: firebaseConfig?.projectId || null,
    cacheActive: !!questionsSyncCache,
    timestamp: new Date().toISOString()
  });
});

// Get all cloud overrides, additions, and deletions with ultra-fast memory caching
app.get('/api/questions/sync', async (req, res) => {
  if (!db) {
    return res.json({ success: false, error: 'Firestore is not initialized', overrides: {}, additions: [], deletions: [] });
  }

  // 1) Fast 304 conditional validation if client already has the latest ETag
  const clientETag = req.headers['if-none-match'];
  if (clientETag && clientETag === syncDataETag && questionsSyncCache) {
    res.setHeader('ETag', syncDataETag);
    return res.status(304).end();
  }

  // 2) Serve directly from in-memory cache if fresh (serves 10,000+ students in <1ms without hitting Firestore quota)
  const now = Date.now();
  if (questionsSyncCache && (now - lastSyncFetchTime < SYNC_CACHE_TTL_MS)) {
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.setHeader('ETag', syncDataETag);
    return res.json(questionsSyncCache);
  }

  try {
    const overrides = {};
    const additions = [];
    const deletions = [];

    const unitOverrides = {};
    const unitAdditions = [];
    const unitDeletions = [];

    // 1) Fetch Lesson overrides
    const overridesSnap = await getDocs(collection(db, 'question_overrides'));
    overridesSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.questionId !== undefined) {
        overrides[data.questionId] = {
          text: data.text,
          options: data.options,
          answer: data.answer,
          lesson: data.lesson || '',
          hint: data.hint !== undefined ? data.hint : '',
          hintDeleted: Boolean(data.hintDeleted),
          updatedAt: data.updatedAt || null
        };
      }
    });

    // 2) Fetch Lesson additions
    const additionsSnap = await getDocs(collection(db, 'question_additions'));
    additionsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.id !== undefined) {
        additions.push(data);
      }
    });

    // 3) Fetch Lesson deletions
    const deletionsSnap = await getDocs(collection(db, 'question_deletions'));
    deletionsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.questionId !== undefined) {
        deletions.push(Number(data.questionId));
      }
    });

    // 4) Fetch Unit & Ministerial overrides
    try {
      const unitOverridesSnap = await getDocs(collection(db, 'unit_ministerial_overrides'));
      unitOverridesSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.questionId !== undefined) {
          unitOverrides[data.questionId] = {
            text: data.text,
            options: data.options,
            answer: data.answer,
            lesson: data.lesson || '',
            hint: data.hint !== undefined ? data.hint : '',
            hintDeleted: Boolean(data.hintDeleted),
            updatedAt: data.updatedAt || null
          };
        }
      });
    } catch (err) {
      console.warn('[API Sync] Unit overrides fetch note:', err.message);
    }

    // 5) Fetch Unit & Ministerial additions
    try {
      const unitAdditionsSnap = await getDocs(collection(db, 'unit_ministerial_additions'));
      unitAdditionsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.id !== undefined) {
          unitAdditions.push(data);
        }
      });
    } catch (err) {
      console.warn('[API Sync] Unit additions fetch note:', err.message);
    }

    // 6) Fetch Unit & Ministerial deletions
    try {
      const unitDeletionsSnap = await getDocs(collection(db, 'unit_ministerial_deletions'));
      unitDeletionsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.questionId !== undefined) {
          unitDeletions.push(Number(data.questionId));
        }
      });
    } catch (err) {
      console.warn('[API Sync] Unit deletions fetch note:', err.message);
    }

    const payload = {
      success: true,
      lesson: {
        overrides,
        additions,
        deletions
      },
      unitMinisterial: {
        overrides: unitOverrides,
        additions: unitAdditions,
        deletions: unitDeletions
      },
      // Backward compatibility fields
      overrides,
      additions,
      deletions,
      count: {
        lessonOverrides: Object.keys(overrides).length,
        lessonAdditions: additions.length,
        lessonDeletions: deletions.length,
        unitOverrides: Object.keys(unitOverrides).length,
        unitAdditions: unitAdditions.length,
        unitDeletions: unitDeletions.length
      },
      timestamp: now
    };

    // Cache in RAM
    questionsSyncCache = payload;
    lastSyncFetchTime = now;
    syncDataETag = `W/"sync-${now}-${Object.keys(overrides).length}-${additions.length}-${Object.keys(unitOverrides).length}-${unitAdditions.length}"`;

    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.setHeader('ETag', syncDataETag);
    res.json(payload);
  } catch (error) {
    console.error('[API Sync Error]', error);
    // If cache exists from earlier, serve it as graceful fallback
    if (questionsSyncCache) {
      return res.json(questionsSyncCache);
    }
    res.status(500).json({ success: false, error: error.message || 'Failed to sync with Firestore' });
  }
});

const ADMIN_PASSWORD = process.env.EDITOR_PASSWORD || 'hussein2024';

function verifyAdmin(req) {
  const token = req.headers['x-admin-key'] || req.body?.adminKey;
  return Boolean(token && token === ADMIN_PASSWORD);
}

// Save question override to Firestore
app.post('/api/questions/override', async (req, res) => {
  if (!db) {
    return res.status(503).json({ success: false, error: 'Firestore is not initialized' });
  }

  if (!verifyAdmin(req)) {
    return res.status(403).json({ success: false, error: 'غير مصرح: هذا الإجراء مخصص للمشرف فقط' });
  }

  try {
    const { questionId, text, options, answer, lesson, hint, category } = req.body;
    if (questionId === undefined || !text || !Array.isArray(options)) {
      return res.status(400).json({ success: false, error: 'بيانات السؤال غير مكتملة' });
    }

    const qIdNum = Number(questionId);
    const cat = String(category || 'lesson').toLowerCase();
    const isUnit = (cat === 'unit_ministerial' || cat === 'unit');
    const collName = isUnit ? 'unit_ministerial_overrides' : 'question_overrides';

    const qDocRef = doc(db, collName, String(qIdNum));
    const payload = {
      questionId: qIdNum,
      category: isUnit ? 'unit_ministerial' : 'lesson',
      text: String(text).trim(),
      options: options.map(opt => String(opt || '').replace(/\r\n/g, '\n').trim()),
      answer: Number(answer) || 0,
      lesson: String(lesson || '').trim(),
      hint: hint !== undefined ? String(hint).trim() : '',
      hintDeleted: Boolean(req.body.hintDeleted),
      updatedAt: new Date().toISOString()
    };

    await setDoc(qDocRef, payload, { merge: true });
    invalidateSyncCache();
    console.log(`[Firestore] Question override saved to ${collName} for ID #${qIdNum}`);

    res.json({
      success: true,
      message: `تم حفظ وتحديث السؤال رقم ${qIdNum} في بنك (${isUnit ? 'اختبار حسب الوحدة والنماذج الوزارية' : 'اختبار حسب الدرس'}) بقاعدة بيانات Firebase بنجاح!`,
      data: payload
    });
  } catch (error) {
    console.error('[API Override Error]', error);
    res.status(500).json({ success: false, error: error.message || 'فشل حفظ التعديل في Firestore' });
  }
});

// Add new question to Firestore
app.post('/api/questions/add', async (req, res) => {
  if (!db) {
    return res.status(503).json({ success: false, error: 'Firestore is not initialized' });
  }

  if (!verifyAdmin(req)) {
    return res.status(403).json({ success: false, error: 'غير مصرح: هذا الإجراء مخصص للمشرف فقط' });
  }

  try {
    const question = req.body;
    if (!question || question.id === undefined || !question.text || !Array.isArray(question.options)) {
      return res.status(400).json({ success: false, error: 'بيانات السؤال الجديد غير صالحة' });
    }

    const qIdNum = Number(question.id);
    const cat = String(question.category || 'lesson').toLowerCase();
    const payload = {
      id: qIdNum,
      sem: Number(question.sem) || 1,
      unit: Number(question.unit) || 1,
      unitName: String(question.unitName || ''),
      lesson: String(question.lesson || ''),
      hint: question.hint !== undefined ? String(question.hint).trim() : '',
      text: String(question.text).trim(),
      options: question.options.map(opt => String(opt || '').replace(/\r\n/g, '\n').trim()),
      answer: Number(question.answer) || 0,
      createdAt: new Date().toISOString()
    };

    if (cat === 'both') {
      await setDoc(doc(db, 'question_additions', String(qIdNum)), Object.assign({}, payload, { category: 'lesson' }), { merge: true });
      await setDoc(doc(db, 'unit_ministerial_additions', String(qIdNum)), Object.assign({}, payload, { category: 'unit_ministerial' }), { merge: true });
    } else if (cat === 'unit_ministerial' || cat === 'unit') {
      await setDoc(doc(db, 'unit_ministerial_additions', String(qIdNum)), Object.assign({}, payload, { category: 'unit_ministerial' }), { merge: true });
    } else {
      await setDoc(doc(db, 'question_additions', String(qIdNum)), Object.assign({}, payload, { category: 'lesson' }), { merge: true });
    }

    invalidateSyncCache();
    console.log(`[Firestore] New question added to Firestore (${cat}) with ID #${qIdNum}`);

    res.json({
      success: true,
      message: `تمت إضافة السؤال رقم ${qIdNum} إلى بنك الأسئلة بقاعدة بيانات Firebase السحابية بنجاح!`,
      data: payload
    });
  } catch (error) {
    console.error('[API Add Error]', error);
    res.status(500).json({ success: false, error: error.message || 'فشل إضافة السؤال إلى Firestore' });
  }
});

// Delete question from Firestore
app.post('/api/questions/delete', async (req, res) => {
  if (!db) {
    return res.status(503).json({ success: false, error: 'Firestore is not initialized' });
  }

  if (!verifyAdmin(req)) {
    return res.status(403).json({ success: false, error: 'غير مصرح: هذا الإجراء مخصص للمشرف فقط' });
  }

  try {
    const { questionId, category } = req.body;
    if (questionId === undefined) {
      return res.status(400).json({ success: false, error: 'رقم السؤال مطلوب' });
    }

    const qIdNum = Number(questionId);
    const cat = String(category || 'lesson').toLowerCase();
    const isUnit = (cat === 'unit_ministerial' || cat === 'unit');
    const deleteColl = isUnit ? 'unit_ministerial_deletions' : 'question_deletions';
    const overrideColl = isUnit ? 'unit_ministerial_overrides' : 'question_overrides';
    const additionColl = isUnit ? 'unit_ministerial_additions' : 'question_additions';

    const qDocRef = doc(db, deleteColl, String(qIdNum));
    const payload = {
      questionId: qIdNum,
      category: isUnit ? 'unit_ministerial' : 'lesson',
      deletedAt: new Date().toISOString()
    };

    await setDoc(qDocRef, payload, { merge: true });

    // Remove any overrides or additions for this question in this category
    try {
      await deleteDoc(doc(db, overrideColl, String(qIdNum)));
      await deleteDoc(doc(db, additionColl, String(qIdNum)));
    } catch (e) {
      // Ignore if document didn't exist
    }

    invalidateSyncCache();
    console.log(`[Firestore] Question #${qIdNum} marked as deleted in ${deleteColl}`);

    res.json({
      success: true,
      message: `تم تسجيل حذف السؤال رقم ${qIdNum} من بنك (${isUnit ? 'اختبار حسب الوحدة والنماذج الوزارية' : 'اختبار حسب الدرس'}) في Firebase بنجاح!`,
      data: payload
    });
  } catch (error) {
    console.error('[API Delete Error]', error);
    res.status(500).json({ success: false, error: error.message || 'فشل حذف السؤال من Firestore' });
  }
});

// ==========================================
// Student Registration & Attempts API
// ==========================================

// Register or update student info
app.post('/api/student/register', async (req, res) => {
  if (!db) {
    return res.json({ success: true, localOnly: true });
  }

  try {
    const { email, name, school } = req.body;
    if (!email || !name) {
      return res.status(400).json({ success: false, error: 'البريد الإلكتروني والاسم مطلوبان' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();
    const cleanSchool = String(school || '').trim();

    // Use sanitized email as document ID
    const docId = cleanEmail.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const docRef = doc(db, 'student_registrations', docId);

    const payload = {
      email: cleanEmail,
      name: cleanName,
      school: cleanSchool,
      lastActiveAt: new Date().toISOString()
    };

    await setDoc(docRef, payload, { merge: true });
    res.json({ success: true, student: payload });
  } catch (error) {
    console.error('[API Student Register Error]', error);
    res.json({ success: true, warning: 'saved locally', error: error.message });
  }
});

// Submit student quiz attempt
app.post('/api/student/submit-attempt', async (req, res) => {
  if (!db) {
    return res.json({ success: true, localOnly: true });
  }

  try {
    const { studentEmail, studentName, school, quizTitle, mode, score, total, percentage, timeSpent } = req.body;
    if (!studentEmail || !studentName || quizTitle === undefined || score === undefined) {
      return res.status(400).json({ success: false, error: 'بيانات الاختبار غير مكتملة' });
    }

    const cleanEmail = String(studentEmail).trim().toLowerCase();
    const cleanName = String(studentName).trim();
    const attemptId = 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const docRef = doc(db, 'student_attempts', attemptId);

    const payload = {
      attemptId,
      studentEmail: cleanEmail,
      studentName: cleanName,
      school: String(school || '').trim(),
      quizTitle: String(quizTitle || '').trim(),
      mode: String(mode || 'train'),
      score: Number(score) || 0,
      total: Number(total) || 0,
      percentage: Number(percentage) || 0,
      timeSpent: String(timeSpent || ''),
      submittedAt: new Date().toISOString()
    };

    await setDoc(docRef, payload, { merge: true });
    res.json({ success: true, attempt: payload });
  } catch (error) {
    console.error('[API Student Attempt Error]', error);
    res.json({ success: true, warning: 'saved locally', error: error.message });
  }
});

// Teacher endpoint to view registered students and attempts (Admin protected)
app.get('/api/teacher/students', async (req, res) => {
  if (!db) {
    return res.status(503).json({ success: false, error: 'Firestore is not initialized' });
  }

  if (!verifyAdmin(req)) {
    return res.status(403).json({ success: false, error: 'غير مصرح: هذا الإجراء مخصص للمشرف فقط' });
  }

  try {
    const students = [];
    const attempts = [];

    const studentsSnap = await getDocs(collection(db, 'student_registrations'));
    studentsSnap.forEach((docSnap) => {
      students.push(docSnap.data());
    });

    const attemptsSnap = await getDocs(collection(db, 'student_attempts'));
    attemptsSnap.forEach((docSnap) => {
      attempts.push(docSnap.data());
    });

    res.json({
      success: true,
      studentsCount: students.length,
      attemptsCount: attempts.length,
      students,
      attempts: attempts.sort((a,b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)).slice(0, 100)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// Curriculum Textbooks (Firebase Firestore Storage & Digital Reader)
// ==========================================
async function seedBooksToFirestore(force = false) {
  if (!db) return;
  try {
    for (const key of Object.keys(BOOKS_DATA)) {
      const bookData = BOOKS_DATA[key];
      const bookDocRef = doc(db, 'curriculum_books', key);
      if (!force) {
        const existingSnap = await getDoc(bookDocRef);
        if (existingSnap.exists()) {
          continue;
        }
      }
      // Overwrite document to ensure outdated fields like authors are completely removed
      const cleanData = { ...bookData, updatedAt: new Date().toISOString() };
      delete cleanData.authors;
      await setDoc(bookDocRef, cleanData);
      console.log(`[Firebase] Curriculum textbook '${key}' (${bookData.title}) stored in Firestore successfully!`);
    }
  } catch (err) {
    console.warn('[Firebase] Book storage notice:', err.message);
  }
}

// Serve official curriculum PDF files statically
app.use('/books', express.static(path.join(__dirname, 'public', 'books')));
app.use('/books', express.static(path.join(__dirname, 'books')));

// Stream PDF file directly for in-app viewing
app.get('/api/books/:id/pdf', (req, res) => {
  const bookId = req.params.id; // e.g. book_sem1 or book_sem2
  const fileName = `${bookId}.pdf`;
  const candidates = [
    path.join(__dirname, 'public', 'books', fileName),
    path.join(__dirname, 'dist', 'books', fileName),
    path.join(__dirname, 'books', fileName)
  ];

  const foundPath = candidates.find(p => fs.existsSync(p));
  if (foundPath) {
    const arabicName = bookId === 'book_sem1'
      ? 'كتاب_الثقافة_المالية_الفصل_الأول_التوجيهي.pdf'
      : 'كتاب_الثقافة_المالية_الفصل_الثاني_التوجيهي.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(arabicName)}"; filename*=UTF-8''${encodeURIComponent(arabicName)}`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(foundPath);
  }
  res.status(404).json({ success: false, error: 'ملف الـ PDF غير موجود' });
});

// Download PDF file: redirects directly to Google Drive link if set, otherwise serves local file
app.get('/api/books/:id/download', async (req, res) => {
  const bookId = req.params.id;
  const fallback = BOOKS_DATA[bookId] || null;
  let driveUrl = fallback && fallback.driveUrl ? fallback.driveUrl : null;

  if (db) {
    try {
      const snap = await getDoc(doc(db, 'curriculum_books', bookId));
      if (snap.exists() && snap.data().driveUrl) {
        driveUrl = snap.data().driveUrl;
      }
    } catch (e) {
      console.warn('Error reading book driveUrl from firestore:', e.message);
    }
  }

  if (driveUrl && typeof driveUrl === 'string' && driveUrl.trim().length > 0) {
    return res.redirect(driveUrl.trim());
  }

  // إذا لم يتم تحديد رابط Google Drive بعد، نوجه المستخدم لصفحة واضحة وتنبيه للتصفح
  return res.status(200).send(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>تنزيل كتاب الثقافة المالية</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;800&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Tajawal', sans-serif; background: #f0f7ff; color: #1e293b; margin: 0; padding: 30px 16px; display: flex; align-items: center; justify-content: center; min-height: 80vh; }
        .card { background: #fff; max-width: 520px; width: 100%; border-radius: 16px; padding: 32px 24px; box-shadow: 0 10px 25px rgba(2,132,199,0.1); border: 1.5px solid #bae6fd; text-align: center; }
        h1 { font-size: 20px; color: #0284c7; margin-bottom: 12px; }
        p { font-size: 15px; color: #475569; line-height: 1.7; margin-bottom: 16px; }
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #0284c7; color: #fff; text-decoration: none; font-weight: 700; padding: 12px 24px; border-radius: 10px; font-size: 15px; transition: background 0.2s; }
        .btn:hover { background: #0369a1; }
      </style>
    </head>
    <body>
      <div class="card">
        <div style="font-size:42px;margin-bottom:12px;">📚</div>
        <h1>تنزيل كتاب المنهاج المعتمد</h1>
        <p>لتنزيل النسخة الوزارية المعتمدة الرسمية الكاملة بجودتها الفائقة (140 صفحة ملونة مع كافة الجداول والرسومات وبخط عربي سليم)، يرجى إضافة رابط Google Drive المباشر من لوحة المعلم.</p>
        <p>بإمكان الطالب حالياً <strong>تصفح وقراءة كافة صفحات ودروس الكتاب التفاعلية</strong> مجاناً وبكل وضوح من داخل التطبيق عبر زر «تصفح الكتاب».</p>
        <a href="/" class="btn">العودة لتصفح الكتاب في المنصة</a>
      </div>
    </body>
    </html>
  `);
});

// Update Google Drive download URL for a textbook
app.post('/api/books/:id/set-drive-url', async (req, res) => {
  const bookId = req.params.id;
  const { driveUrl } = req.body || {};
  if (!driveUrl || typeof driveUrl !== 'string') {
    return res.status(400).json({ success: false, error: 'رابط Google Drive غير صالح' });
  }

  if (BOOKS_DATA[bookId]) {
    BOOKS_DATA[bookId].driveUrl = driveUrl.trim();
  }

  if (db) {
    try {
      await setDoc(doc(db, 'curriculum_books', bookId), { driveUrl: driveUrl.trim(), updatedAt: new Date().toISOString() }, { merge: true });
      booksCache = null;
      return res.json({ success: true, message: 'تم تحديث رابط Google Drive بنجاح', driveUrl: driveUrl.trim() });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  res.json({ success: true, message: 'تم حفظ الرابط محلياً', driveUrl: driveUrl.trim() });
});

let booksCache = null;
let lastBooksFetch = 0;

app.get('/api/books', async (req, res) => {
  const now = Date.now();
  if (booksCache && (now - lastBooksFetch < 60000)) {
    return res.json({ success: true, books: booksCache, source: 'cache' });
  }

  if (!db) {
    return res.json({ success: true, books: BOOKS_DATA, source: 'local' });
  }

  try {
    const booksSnap = await getDocs(collection(db, 'curriculum_books'));
    const booksObj = {};
    booksSnap.forEach(docSnap => {
      booksObj[docSnap.id] = docSnap.data();
    });

    if (Object.keys(booksObj).length === 0) {
      await seedBooksToFirestore(true);
      booksCache = BOOKS_DATA;
      lastBooksFetch = now;
      return res.json({ success: true, books: BOOKS_DATA, source: 'firestore_seeded' });
    }

    booksCache = booksObj;
    lastBooksFetch = now;
    res.json({ success: true, books: booksObj, source: 'firestore' });
  } catch (err) {
    console.error('[API Books Error]', err);
    res.json({ success: true, books: BOOKS_DATA, source: 'fallback', warning: err.message });
  }
});

app.get('/api/books/:id', async (req, res) => {
  const bookId = req.params.id;
  const fallback = BOOKS_DATA[bookId] || null;

  if (!db) {
    return fallback ? res.json({ success: true, book: fallback, source: 'local' }) : res.status(404).json({ success: false, error: 'الكتاب غير موجود' });
  }

  try {
    const bookSnap = await getDoc(doc(db, 'curriculum_books', bookId));
    if (bookSnap.exists()) {
      res.json({ success: true, book: bookSnap.data(), source: 'firestore' });
    } else if (fallback) {
      await setDoc(doc(db, 'curriculum_books', bookId), { ...fallback, updatedAt: new Date().toISOString() });
      res.json({ success: true, book: fallback, source: 'firestore_seeded' });
    } else {
      res.status(404).json({ success: false, error: 'الكتاب غير موجود' });
    }
  } catch (err) {
    if (fallback) {
      return res.json({ success: true, book: fallback, source: 'fallback', warning: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/books/seed', async (req, res) => {
  if (!db) {
    return res.status(503).json({ success: false, error: 'Firestore is not initialized' });
  }
  try {
    await seedBooksToFirestore(true);
    booksCache = BOOKS_DATA;
    lastBooksFetch = Date.now();
    res.json({ success: true, message: 'تم تخزين ومزامنة بيانات كتابي الفصل الأول والفصل الثاني في Firebase Firestore بنجاح!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// Aqyem Ta'allumi Questions (Firebase Firestore Storage & Live Sync)
// ==========================================

const AQYEM_UNIT_NAMES_MAP = {
  1: 'الدورة المحاسبية في المؤسسات الخدمية',
  2: 'القوائم المالية والتحليل المالي',
  3: 'القطاع المالي',
  4: 'المؤسسات المالية الدولية: صندوق النقد الدولي والبنك الدولي',
  5: 'الاستدامة المالية',
  6: 'الذكاء الاصطناعي التوليدي في عالَم المال والأعمال',
  7: 'السياسات الاقتصادية وتأثيرها في التنمية والمجتمع'
};

let aqyemSyncCache = null;
let lastAqyemSyncFetchTime = 0;
const AQYEM_CACHE_TTL_MS = 60 * 1000;
let aqyemDataETag = `W/"aqyem-${Date.now()}"`;

function invalidateAqyemCache() {
  aqyemSyncCache = null;
  lastAqyemSyncFetchTime = 0;
  aqyemDataETag = `W/"aqyem-${Date.now()}"`;
}

async function seedAqyemToFirestore(force = false) {
  if (!db) return;
  try {
    const colRef = collection(db, 'aqyem_questions');
    const snap = await getDocs(colRef);
    const existingMap = new Map();
    if (!snap.empty) {
      snap.forEach(d => existingMap.set(d.id, d.data()));
    }

    const validIds = new Set(AQYEM_QUESTIONS.map(q => String(q.id)));

    // Clean up any stale questions that are no longer in AQYEM_QUESTIONS and not custom added (id >= 1000)
    if (!snap.empty) {
      for (const d of snap.docs) {
        const idNum = Number(d.id);
        if (!validIds.has(d.id) && idNum < 1000) {
          await deleteDoc(doc(db, 'aqyem_questions', d.id));
        }
      }
    }

    console.log(`[Firebase] Verifying Aqyem questions in Firestore (existing: ${existingMap.size})...`);
    for (const q of AQYEM_QUESTIONS) {
      const qDocRef = doc(db, 'aqyem_questions', String(q.id));
      const existing = existingMap.get(String(q.id));

      // If doc exists and not forcing re-seed, keep user edits!
      if (existing && !force) {
        // Guarantee 201 and 202 are assigned to semester 2 and unit 4
        if ((q.id === 201 || q.id === 202) && (existing.sem === 1 || existing.unitId === 1)) {
          await setDoc(qDocRef, {
            sem: 2,
            unitId: 4,
            unitName: AQYEM_UNIT_NAMES_MAP[4],
            lesson: 'المؤسسات المالية الدولية: نشأتها، وأنواعها'
          }, { merge: true });
        }
        continue;
      }

      const uId = Number(q.unitId || 1);
      const sId = Number(q.sem || (uId >= 4 ? 2 : 1));
      const cleanData = JSON.parse(JSON.stringify({
        id: Number(q.id),
        qNum: Number(q.qNum || q.id),
        sem: sId,
        unitId: uId,
        unitName: String(q.unitName || AQYEM_UNIT_NAMES_MAP[uId] || ''),
        lesson: String(q.lesson || ''),
        type: String(q.type || 'mcq'),
        typeLabel: String(q.typeLabel || 'سؤال'),
        text: String(q.text || ''),
        context: String(q.context || ''),
        options: Array.isArray(q.options) ? q.options : [],
        correct: typeof q.correct === 'number' ? q.correct : 0,
        answer: q.answer !== undefined ? q.answer : '',
        explanation: String(q.explanation || ''),
        isUnitExam: !!q.isUnitExam,
        updatedAt: new Date().toISOString()
      }));
      await setDoc(qDocRef, cleanData, { merge: true });
    }
    invalidateAqyemCache();
    console.log(`[Firebase] Successfully verified ${AQYEM_QUESTIONS.length} exact Aqyem questions in Firestore!`);
  } catch (err) {
    console.warn('[Firebase] Aqyem storage notice:', err.message);
  }
}

// GET /api/aqyem/sync - استرجاع كافة أسئلة أقيم تعلمي مع الكاش فائق السرعة
app.get('/api/aqyem/sync', async (req, res) => {
  if (!db) {
    return res.json({ success: true, questions: AQYEM_QUESTIONS, source: 'local', count: AQYEM_QUESTIONS.length });
  }

  const clientETag = req.headers['if-none-match'];
  if (clientETag && clientETag === aqyemDataETag && aqyemSyncCache) {
    res.setHeader('ETag', aqyemDataETag);
    return res.status(304).end();
  }

  const now = Date.now();
  if (aqyemSyncCache && (now - lastAqyemSyncFetchTime < AQYEM_CACHE_TTL_MS)) {
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.setHeader('ETag', aqyemDataETag);
    return res.json(aqyemSyncCache);
  }

  try {
    const snap = await getDocs(collection(db, 'aqyem_questions'));
    
    // بناء الخريطة بدءاً من الأسئلة المعتمدة محلياً
    const questionMap = new Map();
    for (const q of AQYEM_QUESTIONS) {
      questionMap.set(Number(q.id), { ...q });
    }

    // دمج أي تعديلات أو إضافات من Firestore
    if (!snap.empty) {
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if (d && d.id !== undefined) {
          const idNum = Number(d.id);
          // Safety check for sem and unitId: questions 201-409 belong to semester 2
          if (idNum === 201 || idNum === 202) {
            d.sem = 2;
            d.unitId = 4;
            d.unitName = AQYEM_UNIT_NAMES_MAP[4];
            d.lesson = 'المؤسسات المالية الدولية: نشأتها، وأنواعها';
          } else if (d.unitId >= 4 && d.unitId <= 7) {
            d.sem = 2;
            if (!d.unitName) d.unitName = AQYEM_UNIT_NAMES_MAP[d.unitId] || '';
          }
          const existing = questionMap.get(idNum) || {};
          questionMap.set(idNum, { ...existing, ...d });
        }
      });
    }

    const questions = Array.from(questionMap.values());
    questions.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));

    const payload = {
      success: true,
      questions,
      count: questions.length,
      source: snap.empty ? 'local_merged' : 'firestore',
      timestamp: now
    };

    aqyemSyncCache = payload;
    lastAqyemSyncFetchTime = now;
    aqyemDataETag = `W/"aqyem-${now}-${questions.length}"`;

    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.setHeader('ETag', aqyemDataETag);
    res.json(payload);
  } catch (err) {
    console.error('[API Aqyem Sync Error]', err);
    if (aqyemSyncCache) {
      return res.json(aqyemSyncCache);
    }
    res.json({ success: true, questions: AQYEM_QUESTIONS, source: 'fallback', warning: err.message, count: AQYEM_QUESTIONS.length });
  }
});

// POST /api/aqyem/override - حفظ وتعديل سؤال أقيم تعلمي في Firebase مباشرة
app.post(['/api/aqyem/override', '/api/aqyem/update'], async (req, res) => {
  if (!db) {
    return res.status(503).json({ success: false, error: 'Firestore is not initialized' });
  }
  if (!verifyAdmin(req)) {
    return res.status(403).json({ success: false, error: 'غير مصرح: هذا الإجراء مخصص للمشرف فقط' });
  }

  try {
    const qData = req.body;
    if (!qData || qData.id === undefined || !qData.text) {
      return res.status(400).json({ success: false, error: 'بيانات السؤال غير مكتملة' });
    }

    const qIdNum = Number(qData.id);
    const qDocRef = doc(db, 'aqyem_questions', String(qIdNum));
    const uId = Number(qData.unitId || 1);
    const sId = (uId >= 4 && uId <= 7) ? 2 : (qData.sem !== undefined ? Number(qData.sem) : (uId >= 4 ? 2 : 1));
    const uName = String(qData.unitName || AQYEM_UNIT_NAMES_MAP[uId] || '');

    const payload = {
      id: qIdNum,
      qNum: Number(qData.qNum || qIdNum),
      sem: sId,
      unitId: uId,
      unitName: uName,
      lesson: String(qData.lesson || ''),
      type: String(qData.type || 'mcq'),
      typeLabel: String(qData.typeLabel || 'سؤال'),
      text: String(qData.text).trim(),
      context: String(qData.context || '').trim(),
      options: Array.isArray(qData.options) ? qData.options.map(opt => String(opt || '').trim()) : [],
      correct: typeof qData.correct === 'number' ? qData.correct : 0,
      answer: qData.answer !== undefined ? qData.answer : '',
      explanation: String(qData.explanation || '').trim(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(qDocRef, payload, { merge: true });
    invalidateAqyemCache();
    console.log(`[Firestore] Aqyem question #${qIdNum} updated in Firestore successfully!`);

    res.json({
      success: true,
      message: `تم تحديث سؤال أُقيّم تعلّمي رقم (${qIdNum}) في قاعدة بيانات Firebase مباشرة بنجاح!`,
      data: payload
    });
  } catch (error) {
    console.error('[API Aqyem Override Error]', error);
    res.status(500).json({ success: false, error: error.message || 'فشل حفظ التعديل في Firestore' });
  }
});

// POST /api/aqyem/add - إضافة سؤال جديد إلى أقيم تعلمي في Firebase مباشرة
app.post('/api/aqyem/add', async (req, res) => {
  if (!db) {
    return res.status(503).json({ success: false, error: 'Firestore is not initialized' });
  }
  if (!verifyAdmin(req)) {
    return res.status(403).json({ success: false, error: 'غير مصرح: هذا الإجراء مخصص للمشرف فقط' });
  }

  try {
    const qData = req.body;
    if (!qData || qData.id === undefined || !qData.text) {
      return res.status(400).json({ success: false, error: 'بيانات السؤال الجديد غير صالحة' });
    }

    const qIdNum = Number(qData.id);
    const qDocRef = doc(db, 'aqyem_questions', String(qIdNum));
    const uId = Number(qData.unitId || 1);
    const sId = (uId >= 4 && uId <= 7) ? 2 : (qData.sem !== undefined ? Number(qData.sem) : (uId >= 4 ? 2 : 1));
    const uName = String(qData.unitName || AQYEM_UNIT_NAMES_MAP[uId] || '');

    const payload = {
      id: qIdNum,
      qNum: Number(qData.qNum || qIdNum),
      sem: sId,
      unitId: uId,
      unitName: uName,
      lesson: String(qData.lesson || ''),
      type: String(qData.type || 'mcq'),
      typeLabel: String(qData.typeLabel || 'سؤال'),
      text: String(qData.text).trim(),
      context: String(qData.context || '').trim(),
      options: Array.isArray(qData.options) ? qData.options.map(opt => String(opt || '').trim()) : [],
      correct: typeof qData.correct === 'number' ? qData.correct : 0,
      answer: qData.answer !== undefined ? qData.answer : '',
      explanation: String(qData.explanation || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(qDocRef, payload, { merge: true });
    invalidateAqyemCache();
    console.log(`[Firestore] New Aqyem question #${qIdNum} added to Firestore!`);

    res.json({
      success: true,
      message: `تمت إضافة وحفظ السؤال الجديد رقم (${qIdNum}) في قاعدة بيانات Firebase مباشرة بنجاح!`,
      data: payload
    });
  } catch (error) {
    console.error('[API Aqyem Add Error]', error);
    res.status(500).json({ success: false, error: error.message || 'فشل إضافة السؤال في Firestore' });
  }
});

// POST /api/aqyem/delete - حذف سؤال أقيم تعلمي من Firebase مباشرة
app.post('/api/aqyem/delete', async (req, res) => {
  if (!db) {
    return res.status(503).json({ success: false, error: 'Firestore is not initialized' });
  }
  if (!verifyAdmin(req)) {
    return res.status(403).json({ success: false, error: 'غير مصرح: هذا الإجراء مخصص للمشرف فقط' });
  }

  try {
    const { id } = req.body;
    if (id === undefined) {
      return res.status(400).json({ success: false, error: 'معرّف السؤال مفقود' });
    }

    const qIdNum = Number(id);
    const qDocRef = doc(db, 'aqyem_questions', String(qIdNum));
    await deleteDoc(qDocRef);
    invalidateAqyemCache();
    console.log(`[Firestore] Aqyem question #${qIdNum} deleted from Firestore!`);

    res.json({
      success: true,
      message: `تم حذف السؤال رقم (${qIdNum}) نهائياً من قاعدة بيانات Firebase السحابية بنجاح!`
    });
  } catch (error) {
    console.error('[API Aqyem Delete Error]', error);
    res.status(500).json({ success: false, error: error.message || 'فشل حذف السؤال من Firestore' });
  }
});

// POST /api/aqyem/seed - إعادة مزامنة وتخزين كامل الأسئلة في Firebase
app.post('/api/aqyem/seed', async (req, res) => {
  if (!db) {
    return res.status(503).json({ success: false, error: 'Firestore is not initialized' });
  }
  try {
    await seedAqyemToFirestore(true);
    res.json({
      success: true,
      message: `تمت مزامنة ونقل جميع أسئلة أُقيّم تعلّمي (${AQYEM_QUESTIONS.length} سؤالاً) إلى Firebase Firestore بنجاح!`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// High-Quality Arabic Text-to-Speech (TTS) Engine & Audio Cache
// Guarantees 100% native Arabic pronunciation on ALL devices without requiring local Arabic voice packs
// ==========================================
const ttsAudioCache = new Map();
const MAX_TTS_CACHE_SIZE = 600;

app.get('/api/tts', async (req, res) => {
  const rawText = req.query.text;
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return res.status(400).send('Text parameter is required');
  }

  const text = rawText.trim();
  const cacheKey = text;

  if (ttsAudioCache.has(cacheKey)) {
    const cached = ttsAudioCache.get(cacheKey);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(cached);
  }

  try {
    // Split into chunks of maximum 120 characters for Google TTS engine
    const words = text.split(' ');
    const chunks = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).length <= 120) {
        cur = cur ? (cur + ' ' + w) : w;
      } else {
        if (cur) chunks.push(cur);
        cur = w;
      }
    }
    if (cur) chunks.push(cur);

    const buffers = [];
    for (const chunk of chunks) {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=ar&client=tw-ob`;
      const response = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/'
        }
      });
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        buffers.push(Buffer.from(arrayBuf));
      }
    }

    if (buffers.length === 0) {
      return res.status(502).send('Failed to synthesize audio');
    }

    const finalMp3 = Buffer.concat(buffers);

    if (ttsAudioCache.size > MAX_TTS_CACHE_SIZE) {
      const firstKey = ttsAudioCache.keys().next().value;
      ttsAudioCache.delete(firstKey);
    }
    ttsAudioCache.set(cacheKey, finalMp3);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(finalMp3);
  } catch (err) {
    console.error('[TTS Error]', err);
    res.status(500).send('TTS synthesis error: ' + (err.message || 'Unknown error'));
  }
});

// Route to download the generated Word document (.docx)
app.get('/download-word', (req, res) => {
  const filePath = path.join(__dirname, 'financial_culture_bank.docx');
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', 'attachment; filename="financial_culture_bank.docx"');
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } else {
    res.status(404).send('ملف الوورد غير متوفر حالياً.');
  }
});

// Route to download the native Word document (.doc - universal compatibility)
app.get('/download-word-doc', (req, res) => {
  const filePath = path.join(__dirname, 'financial_culture_bank.doc');
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/msword; charset=utf-8');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', 'attachment; filename="financial_culture_bank.doc"');
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } else {
    res.status(404).send('ملف الوورد غير متوفر حالياً.');
  }
});

// Vite middleware for development or static serving for production
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }
  app.use(express.static(__dirname));
  app.get('*', (req, res) => {
    const distIndex = path.join(distPath, 'index.html');
    if (fs.existsSync(distIndex)) {
      res.sendFile(distIndex);
    } else {
      res.sendFile(path.join(__dirname, 'index.html'));
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

