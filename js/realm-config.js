// =============================================================
// ==      ملف إعدادات Realm والاتصال الأساسي                ==
// =============================================================

// استيراد مكتبة Realm التي تم تحميلها في ملف HTML
const Realm = window.Realm;

// ▼▼▼ التعديل الأهم: استبدل هذا بمعرف التطبيق الخاص بك من لوحة تحكم Realm ▼▼▼
const REALM_APP_ID = "mdb_sa_id_68b75ae5fca2f3176fc72b2e"; 
// ▲▲▲ نهاية التعديل ▲▲▲

// إنشاء نسخة من التطبيق وتصديرها
export const app = new Realm.App({ id: REALM_APP_ID });

/**
 * دالة للحصول على المستخدم الحالي أو تسجيل دخوله كمستخدم مجهول.
 * @returns {Realm.User | null} - كائن المستخدم أو null في حالة الفشل.
 */
export async function getLoggedInUser() {
    // إذا لم يكن هناك مستخدم مسجل دخوله حاليًا، حاول تسجيل الدخول كمستخدم مجهول
    if (!app.currentUser) {
        try {
            await app.logIn(Realm.Credentials.anonymous());
        } catch (err) {
            console.error("فشل تسجيل الدخول المجهول:", err);
            return null;
        }
    }
    return app.currentUser;
}

/**
 * دالة مساعدة للوصول إلى أي مجموعة في قاعدة البيانات بسهولة.
 * @param {string} collectionName - اسم المجموعة (مثل 'players', 'store_config').
 * @returns {Realm.MongoDB.Collection} - كائن المجموعة للتعامل معه.
 */
export function getMongoCollection(collectionName) {
    // نتأكد من وجود مستخدم مسجل دخوله
    if (!app.currentUser) {
        // هذا الخطأ لا يجب أن يحدث في الحالة الطبيعية لأننا نسجل الدخول دائمًا
        throw new Error("يجب تسجيل الدخول أولاً للوصول إلى قاعدة البيانات.");
    }
    
    // الوصول إلى خدمة mongodb-atlas
    const mongodb = app.currentUser.mongoClient("mongodb-atlas");
    
    // ▼▼▼ تأكد من أن اسم قاعدة البيانات هنا يطابق الاسم الذي اخترته في لوحة التحكم ▼▼▼
    const dbName = "QuranQuizDB"; 
    // ▲▲▲ نهاية التعديل ▲▲▲

    // إرجاع المجموعة المطلوبة
    return mongodb.db(dbName).collection(collectionName);
}

// نقوم بتصدير Realm نفسه في حال احتجنا إلى الوصول لمكونات أخرى منه مثل Credentials
export { Realm };
