// =============================================================
// ==      الملف الرئيسي (main.js) - النسخة النهائية الموثوقة   ==
// =============================================================

import * as ui from './ui.js';
import * as api from './api.js';
import * as quiz from './quiz.js';
import * as player from './player.js';
import * as progression from './progression.js';
import * as store from './store.js';
import * as achievements from './achievements.js';
import * as quests from './quests.js';
import { surahMetadata } from './quran-metadata.js';

// ▼▼▼ الأهم: ننتظر حتى يتم تحميل كل HTML قبل تشغيل أي كود ▼▼▼
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded. Initializing application...");
    initialize();
});

/**
 * الدالة الرئيسية لبدء تشغيل التطبيق.
 */
async function initialize() {
    try {
        console.log("1. Initializing core modules...");
        // تهيئة الوحدات التي تحتاج إلى بيانات من الشبكة أولاً
        await progression.initializeProgression();
        await quiz.initializeQuiz();
        await achievements.initializeAchievements();
        await quests.initialize();
        console.log("2. Core modules initialized successfully.");

        // إعداد مستمعي الأحداث بعد تهيئة كل شيء
        setupEventListeners();

        // عرض شاشة البداية
        ui.showScreen(ui.startScreen);
        console.log("4. Application is ready. Showing start screen.");

    } catch (error) {
        console.error("A critical error occurred during initialization:", error);
        alert("حدث خطأ فادح أثناء تحميل التطبيق. يرجى تحديث الصفحة.");
    }
}

/**
 * إعداد جميع مستمعي الأحداث في التطبيق.
 */
function setupEventListeners() {
    console.log("3. Setting up event listeners...");

    // التحقق من وجود زر البدء قبل ربط الحدث
    if (ui.startButton) {
        ui.startButton.addEventListener('click', handleAuthentication);
        console.log("   - Start button listener attached.");
    } else {
        console.error("CRITICAL: Start button (id='startButton') not found in the DOM!");
    }

    // بقية المستمعين
    if (ui.startTestButton) ui.startTestButton.addEventListener('click', onStartPageTestClick);
    if (ui.reloadButton) ui.reloadButton.addEventListener('click', returnToMainMenu);
    if (ui.showFinalResultButton) {
        ui.showFinalResultButton.addEventListener('click', () => {
            const quizState = quiz.getCurrentState();
            const oldXp = player.playerData.xp - quizState.xpEarned;
            const levelUpInfo = progression.checkForLevelUp(oldXp, player.playerData.xp);
            ui.displayFinalResult(quizState, levelUpInfo);
        });
    }

    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            ui.showTab(tabId);
            if (tabId === 'leaderboard-tab' && !button.dataset.loaded) {
                onLeaderboardTabClick();
                button.dataset.loaded = 'true';
            }
            if (tabId === 'profile-tab') renderProfileStats();
            if (tabId === 'quests-tab') quests.renderQuests();
        });
    });

    if (ui.modalCloseButton) ui.modalCloseButton.addEventListener('click', () => ui.showModal(false));
    if (ui.itemDetailsModal) {
        ui.itemDetailsModal.addEventListener('click', (e) => {
            if (e.target === ui.itemDetailsModal) ui.showModal(false);
        });
    }
    console.log("   - All other event listeners attached.");
}

/**
 * معالجة عملية المصادقة عند النقر على زر تسجيل الدخول.
 */
async function handleAuthentication() {
    console.log("5. Start button clicked. Handling authentication...");
    const userName = ui.userNameInput.value.trim();
    if (!userName) {
        alert("يرجى إدخال اسمك للمتابعة.");
        return;
    }
    ui.toggleLoader(true);

    try {
        const encodedUsername = btoa(unescape(encodeURIComponent(userName)));
        const safeEncodedUsername = encodedUsername.replace(/=/g, '').replace(/[^a-zA-Z0-9]/g, '');
        const email = `${safeEncodedUsername}@quran-quiz.app`;
        const password = `QURAN_QUIZ_#_${safeEncodedUsername}`;

        console.log(`   - Attempting to sign up/log in for user: ${userName}`);
        await api.signUpUser(email, password, userName);
        console.log("6. Authentication successful.");

        await postLoginSetup();
        ui.showScreen(ui.mainInterface);
        console.log("8. Main interface is now visible.");

    } catch (error) {
        console.error("Authentication or setup failed:", error);
        alert(`حدث خطأ: ${error.message}`);
    } finally {
        ui.toggleLoader(false);
    }
}

/**
 * إعداد الواجهة الرئيسية بعد تسجيل الدخول بنجاح.
 */
async function postLoginSetup() {
    console.log("7. Executing post-login setup...");
    const playerLoaded = await player.loadPlayer();
    if (!playerLoaded || !player.playerData.username) {
        throw new Error("Failed to load player data after login.");
    }
    
    const levelInfo = progression.getLevelInfo(player.playerData.xp);
    ui.updatePlayerHeader(player.playerData, levelInfo);
    updateAvailablePages();
    ui.populateQariSelect(ui.qariSelect, player.playerData.inventory);
    const maxQuestions = progression.getMaxQuestionsForLevel(levelInfo.level);
    ui.updateQuestionsCountOptions(maxQuestions);
    
    const [storeItems, specialOffers, liveEvents] = await Promise.all([
        api.fetchStoreConfig(),
        api.fetchSpecialOffers(),
        api.fetchActiveEvents()
    ]);

    if (storeItems) {
        store.processStoreData(storeItems, specialOffers || []);
        store.renderStoreTabs();
    }

    if (liveEvents) {
        renderLiveEvents(liveEvents);
    }
    console.log("   - Post-login setup complete.");
}

// --- بقية الدوال المساعدة تبقى كما هي ---

async function returnToMainMenu() {
    ui.toggleLoader(true);
    await postLoginSetup();
    ui.toggleLoader(false);
    ui.showScreen(ui.mainInterface);
}

export function updateAvailablePages() {
    const inventory = player.playerData.inventory || [];
    const purchasedPages = inventory
        .filter(id => id.startsWith('page_'))
        .map(id => parseInt(id.replace('page_', ''), 10));
    const availablePages = [...new Set([...player.FREE_PAGES, ...purchasedPages])].sort((a, b) => a - b);
    ui.populateSelect(ui.pageSelect, availablePages, 'الصفحة');
}

function onStartPageTestClick() {
    const selectedPage = ui.pageSelect.value;
    if (!selectedPage) return alert("يرجى اختيار صفحة.");
    startTestWithSettings({
        pageNumbers: [parseInt(selectedPage, 10)],
        qari: ui.qariSelect.value,
        questionsCount: parseInt(ui.questionsCountSelect.value, 10),
        testName: `الصفحة ${selectedPage}`,
        pageNumber: parseInt(selectedPage, 10)
    });
}

async function onLeaderboardTabClick() {
    ui.leaderboardList.innerHTML = '<p>جاري تحميل البيانات...</p>';
    const leaderboardData = await api.fetchLeaderboard();
    if (leaderboardData && leaderboardData.length > 0) {
        ui.displayLeaderboard(leaderboardData);
    } else {
        ui.leaderboardList.innerHTML = '<p>لوحة الصدارة فارغة حاليًا.</p>';
    }
}

async function startTestWithSettings(settings) {
    ui.toggleLoader(true);
    let allAyahs = [];
    try {
        for (const pageNum of settings.pageNumbers) {
            const pageAyahs = await api.fetchPageData(pageNum);
            if (pageAyahs) {
                allAyahs.push(...pageAyahs);
            } else {
                throw new Error(`Could not fetch ayahs for page ${pageNum}`);
            }
        }
        if (allAyahs.length > 0) {
            quiz.start({
                pageAyahs: allAyahs,
                selectedQari: settings.qari,
                totalQuestions: settings.questionsCount,
                userName: player.playerData.username,
                pageNumber: settings.pageNumber,
                liveEvent: settings.liveEvent,
                quest: settings.quest
            });
        }
    } catch (error) {
        console.error("Error starting test:", error);
        alert(`تعذر تحميل بيانات الاختبار لـ ${settings.testName}.`);
    } finally {
        ui.toggleLoader(false);
    }
}

function renderLiveEvents(events) {
    const container = document.getElementById('live-events-container');
    const separator = document.querySelector('.event-separator');
    if (!container || !separator) return;
    if (!events || events.length === 0) {
        container.classList.add('hidden');
        separator.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    separator.classList.remove('hidden');
    container.innerHTML = '<h3>الأحداث الحالية</h3>';
    events.forEach(event => {
        const button = document.createElement('button');
        button.className = 'event-button';
        button.textContent = `ابدأ تحدي: ${event.title}`;
        button.dataset.eventId = event.id;
        button.addEventListener('click', () => onStartEventTestClick(event));
        container.appendChild(button);
    });
}

function onStartEventTestClick(event) {
    if (!event || !event.target_surah) {
        console.error("Event data is incomplete.", event);
        alert("حدث خطأ أثناء محاولة بدء التحدي.");
        return;
    }
    const surahInfo = surahMetadata[event.target_surah];
    if (!surahInfo) {
        alert(`خطأ: السورة المستهدفة (${event.target_surah}) غير معروفة.`);
        return;
    }
    const pageNumbers = Array.from({ length: surahInfo.endPage - surahInfo.startPage + 1 }, (_, i) => surahInfo.startPage + i);
    const challengeSettings = {
        pageNumbers: pageNumbers,
        qari: ui.qariSelect.value,
        questionsCount: event.questions_count,
        testName: event.title,
        liveEvent: event
    };
    if (confirm(`أنت على وشك بدء تحدي "${event.title}" بـ ${event.questions_count} سؤالاً. هل أنت مستعد؟`)) {
        startTestWithSettings(challengeSettings);
    }
}

function renderProfileStats() {
    const container = document.getElementById('profile-stats-container');
    if (!container) return;
    const stats = player.playerData;
    const totalQuizzes = stats.total_quizzes_completed || 0;
    const correctAnswers = stats.total_correct_answers || 0;
    const totalAnswers = correctAnswers + (stats.total_wrong_answers || 0);
    const accuracy = totalAnswers > 0 ? ((correctAnswers / totalAnswers) * 100).toFixed(1) : 0;

    container.innerHTML = `
        <div class="stat-card"><div class="stat-title">الاختبارات المكتملة</div><div class="stat-value">${totalQuizzes}</div></div>
        <div class="stat-card"><div class="stat-title">الاختبارات المتقَنة</div><div class="stat-value">${stats.total_perfect_quizzes || 0}</div></div>
        <div class="stat-card"><div class="stat-title">مجموع الإجابات الصحيحة</div><div class="stat-value">${correctAnswers}</div></div>
        <div class="stat-card"><div class="stat-title">نسبة الدقة</div><div class="stat-value">%${accuracy}</div></div>
    `;
}
