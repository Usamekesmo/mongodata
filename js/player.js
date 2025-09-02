// =============================================================
// ==      وحدة إدارة بيانات اللاعب - نسخة Realm/MongoDB       ==
// =============================================================

import { fetchPlayer as fetchPlayerFromApi, savePlayer as savePlayerToApi } from './api.js';
import * as achievements from './achievements.js';

// هذا المتغير يحتوي على الصفحات المجانية المتاحة لكل اللاعبين
export const FREE_PAGES = [1, 2, 602, 603, 604];

// هذا الكائن سيحتفظ ببيانات اللاعب الحالية طوال جلسة اللعب
export let playerData = {};

/**
 * يقوم بتحميل بيانات اللاعب من الواجهة الخلفية (Backend) ودمجها مع القيم الافتراضية.
 * @returns {Promise<boolean>} - true عند النجاح, false عند الفشل.
 */
export async function loadPlayer() {
    const fetchedData = await fetchPlayerFromApi();
    
    if (!fetchedData) {
        console.error("فشل جلب بيانات اللاعب من الواجهة الخلفية.");
        // في حال فشل الجلب، نعيد كائنًا فارغًا لمنع انهيار التطبيق
        playerData = {};
        return false;
    }

    // تهيئة الحقول الافتراضية لضمان عدم حدوث أخطاء إذا كانت البيانات غير كاملة
    const defaultStats = {
        username: "لاعب جديد",
        xp: 0,
        diamonds: 0,
        total_quizzes_completed: 0,
        total_correct_answers: 0,
        total_wrong_answers: 0,
        total_perfect_quizzes: 0,
        inventory: [],
        achievements: []
    };

    // دمج البيانات التي تم جلبها مع البيانات الافتراضية
    // البيانات التي تم جلبها من قاعدة البيانات لها الأولوية
    playerData = {
        ...defaultStats,
        ...fetchedData
    };

    console.log(`تم تحميل بيانات اللاعب: ${playerData.username}`);
    
    // التحقق من إنجازات تسجيل الدخول
    achievements.checkAchievements('login');
    
    return true;
}

/**
 * يقوم بحفظ بيانات اللاعب الحالية في الواجهة الخلفية.
 */
export async function savePlayer() {
    // استبعاد أي بيانات مؤقتة لا نريد حفظها في قاعدة البيانات
    // في حالتنا، كل البيانات في playerData مهمة، ولكن هذا إجراء جيد للمستقبل
    const { _id, ...updatableData } = playerData; // نستبعد حقل _id الذي يضيفه MongoDB تلقائيًا

    if (!updatableData.id) {
        console.error("لا يمكن حفظ اللاعب بدون معرف فريد (id).");
        return;
    }

    await savePlayerToApi(updatableData);
    console.log("تم إرسال طلب حفظ بيانات اللاعب إلى الواجهة الخلفية.");
}


