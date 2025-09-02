// =============================================================
// ==      وحدة الاتصالات (API) - نسخة Realm/MongoDB Atlas     ==
// =============================================================

import { app, Realm, getMongoCollection } from './realm-config.js';

const QURAN_API_BASE_URL = "https://api.alquran.cloud/v1";

// --- 1. دوال المصادقة (Authentication ) ---

export async function signUpUser(email, password, username) {
    try {
        // أولاً، نحاول تسجيل الدخول. إذا نجح، فالمستخدم موجود.
        const credentials = Realm.Credentials.emailPassword(email, password);
        const user = await app.logIn(credentials);
        
        // نتأكد من وجود ملف اللاعب، إذا لم يكن موجودًا لسبب ما، ننشئه
        const playersCollection = getMongoCollection("players");
        const player = await playersCollection.findOne({ id: user.id });
        if (!player) {
            await playersCollection.insertOne({
                id: user.id, email: user.profile.email, username: username, xp: 0, diamonds: 100,
                created_at: new Date(), total_quizzes_completed: 0, total_correct_answers: 0,
                total_wrong_answers: 0, total_perfect_quizzes: 0, inventory: [], achievements: []
            });
        }
        return { data: { user }, error: null };

    } catch (err) {
        // إذا فشل تسجيل الدخول، فهذا يعني غالبًا أن المستخدم غير موجود، لذا ننشئه
        if (err.message.includes("invalid username/password")) {
            try {
                await app.emailPasswordAuth.registerUser({ email, password });
                const credentials = Realm.Credentials.emailPassword(email, password);
                const newUser = await app.logIn(credentials);

                const playersCollection = getMongoCollection("players");
                await playersCollection.insertOne({
                    id: newUser.id, email: newUser.profile.email, username: username, xp: 0, diamonds: 100,
                    created_at: new Date(), total_quizzes_completed: 0, total_correct_answers: 0,
                    total_wrong_answers: 0, total_perfect_quizzes: 0, inventory: [], achievements: []
                });
                return { data: { user: newUser }, error: null };
            } catch (signUpError) {
                return { data: null, error: signUpError };
            }
        }
        return { data: null, error: err };
    }
}

// --- 2. دوال جلب البيانات (Read Operations) ---

export async function fetchPlayer() {
    if (!app.currentUser) return null;
    try {
        const playersCollection = getMongoCollection('players');
        // في Realm، app.currentUser.id هو المعرف الفريد للمستخدم
        const data = await playersCollection.findOne({ id: app.currentUser.id });
        return data;
    } catch (error) {
        console.error("خطأ في جلب بيانات اللاعب:", error);
        return null;
    }
}

export async function fetchStoreConfig() {
    try {
        const storeCollection = getMongoCollection('store_config');
        // .find() بدون شروط تجلب كل المستندات، .toArray() تحولها لمصفوفة
        const data = await storeCollection.find({}, { sort: { sort_order: 1 } }).toArray();
        return data || [];
    } catch (error) {
        console.error(`خطأ في جلب جدول store_config:`, error);
        return null;
    }
}

export async function fetchSpecialOffers() {
    try {
        const offersCollection = getMongoCollection('special_offers');
        const data = await offersCollection.find({}).toArray();
        return data || [];
    } catch (error) {
        console.error("Error fetching special offers:", error);
        return [];
    }
}

export async function fetchQuestionsConfig() {
    try {
        const questionsCollection = getMongoCollection('questions_config');
        const data = await questionsCollection.find(
            { is_active: true },
            { sort: { level_required: 1 } }
        ).toArray();
        return data || [];
    } catch (error) {
        console.error("فشل جلب إعدادات الأسئلة من قاعدة البيانات!", error);
        return null;
    }
}

export async function fetchProgressionConfig() {
    try {
        const progressionCollection = getMongoCollection('progression_config');
        // نفترض أن الإعدادات مخزنة في مستند واحد
        const data = await progressionCollection.findOne({ id: 1 });
        return data ? data.settings : null;
    } catch (error) {
        console.error("خطأ في جلب إعدادات التقدم:", error);
        return null;
    }
}

export async function fetchLeaderboard() {
    try {
        const playersCollection = getMongoCollection('players');
        const data = await playersCollection.find({}, {
            sort: { xp: -1 }, // -1 للترتيب التنازلي
            limit: 10,
            projection: { username: 1, xp: 1 } // جلب الحقول المطلوبة فقط
        }).toArray();
        return data || [];
    } catch (error) {
        console.error("خطأ في جلب لوحة الصدارة:", error);
        return null;
    }
}

export async function fetchPageData(pageNumber) {
    try {
        const response = await fetch(`${QURAN_API_BASE_URL}/page/${pageNumber}/quran-uthmani`);
        if (!response.ok) throw new Error('فشل استجابة الشبكة.');
        const data = await response.json();
        return data.data.ayahs;
    } catch (error) {
        console.error("Error fetching page data:", error);
        alert('لا يمكن الوصول إلى خادم القرآن. تحقق من اتصالك بالإنترنت.');
        return null;
    }
}

export async function fetchActiveEvents() {
    try {
        const eventsCollection = getMongoCollection('live_events');
        const data = await eventsCollection.find({ is_active: true }).toArray();
        return data;
    } catch (error) {
        console.error("Error fetching live events:", error);
        return [];
    }
}

// تم تبسيط هذه الدوال مؤقتاً، يمكن استبدالها بـ Realm Functions لاحقاً
export async function fetchOrAssignDailyQuests() {
    // منطق وهمي مؤقت
    console.warn("fetchOrAssignDailyQuests is using mock data.");
    return []; 
}

export async function fetchPlayerMastery() {
    // منطق وهمي مؤقت
    console.warn("fetchPlayerMastery is using mock data.");
    return [];
}


// --- 3. دوال حفظ البيانات (Write Operations) ---

export async function savePlayer(playerData) {
    try {
        const { id, ...updatableData } = playerData;
        const playersCollection = getMongoCollection('players');
        // نستخدم `updateOne` مع `upsert: true` لتحديث اللاعب أو إنشائه إذا لم يكن موجودًا
        await playersCollection.updateOne(
            { id: id }, // الشرط: ابحث عن اللاعب بهذا الـ id
            { $set: updatableData }, // التحديث: قم بتعيين هذه البيانات الجديدة
            { upsert: true } // الخيار: إذا لم تجده، قم بإنشاء مستند جديد
        );
    } catch (error) {
        console.error("خطأ في حفظ بيانات اللاعب:", error);
    }
}

export async function saveResult(resultData) {
    if (!app.currentUser) return;
    try {
        const dataToSave = {
            user_id: app.currentUser.id, // استخدام المعرف من Realm
            page_number: resultData.pageNumber,
            score: resultData.score,
            total_questions: resultData.totalQuestions,
            xp_earned: resultData.xpEarned,
            errors: resultData.errorLog,
            is_perfect: resultData.isPerfect,
            duration_seconds: resultData.durationSeconds,
            live_event_id: resultData.liveEvent ? resultData.liveEvent.id : null,
            created_at: new Date()
        };
        const resultsCollection = getMongoCollection('quiz_results');
        await resultsCollection.insertOne(dataToSave);
    } catch (error) {
        console.error("خطأ في حفظ نتيجة الاختبار:", error);
    }
}

// تم تبسيط هذه الدوال مؤقتاً
export async function updatePlayerQuests(updates) {
    console.warn("updatePlayerQuests is not implemented yet.");
}

export async function updateMasteryRecord(pageNumber, durationInSeconds) {
    console.warn("updateMasteryRecord is not implemented yet.");
}


