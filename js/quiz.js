// =============================================================
// ==      وحدة إدارة الاختبار - لا تحتاج إلى تعديل           ==
// =============================================================

import * as ui from './ui.js';
import { saveResult } from './api.js';
import { fetchQuestionsConfig } from './api.js';
import { allQuestionGenerators } from './questions.js';
import * as player from './player.js';
import * as progression from './progression.js';
import * as achievements from './achievements.js';
import * as quests from './quests.js';
import { updateMasteryRecord } from './api.js';

let state = {
    pageAyahs: [],
    currentQuestionIndex: 0,
    score: 0,
    totalQuestions: 10,
    selectedQari: 'ar.alafasy',
    errorLog: [],
    userName: '',
    pageNumber: 0,
    xpEarned: 0,
    liveEvent: null,
    startTime: 0,
    questionSequence: []
};

let allActiveQuestions = [];
const shuffleArray = array => [...array].sort(() => 0.5 - Math.random());

export async function initializeQuiz() {
    const config = await fetchQuestionsConfig();
    if (config && config.length > 0) {
        allActiveQuestions = config.map(q => ({
            ...q,
            generator: allQuestionGenerators[q.id]
        })).filter(q => typeof q.generator === 'function');
    }
}

export function start(settings) {
    state = {
        ...state,
        ...settings,
        score: 0,
        currentQuestionIndex: 0,
        errorLog: [],
        xpEarned: 0,
        startTime: Date.now(),
        questionSequence: []
    };

    let sequence = [];
    const recipe = settings.liveEvent ? settings.liveEvent.questions_recipe : (settings.quest ? settings.quest.questions_recipe : null);
    const totalQuestionsInTest = settings.questionsCount || 10;

    if (recipe) {
        for (const questionId in recipe) {
            const count = recipe[questionId];
            const questionConfig = allActiveQuestions.find(q => q.id === questionId);
            if (questionConfig) {
                for (let i = 0; i < count; i++) {
                    sequence.push(questionConfig);
                }
            }
        }
    }

    const remainingQuestionsCount = totalQuestionsInTest - sequence.length;
    if (remainingQuestionsCount > 0) {
        const playerLevel = progression.getLevelInfo(player.playerData.xp).level;
        const availableRandomQuestions = allActiveQuestions.filter(q => playerLevel >= q.level_required);
        if (availableRandomQuestions.length > 0) {
            for (let i = 0; i < remainingQuestionsCount; i++) {
                sequence.push(shuffleArray(availableRandomQuestions)[0]);
            }
        } else {
            console.warn("لا توجد أسئلة عشوائية متاحة، سيتم الاكتفاء بأسئلة الوصفة.");
            state.totalQuestions = sequence.length;
        }
    }
    
    state.questionSequence = shuffleArray(sequence);
    
    if (state.questionSequence.length === 0) {
        alert("خطأ فادح: لم يتمكن النظام من إنشاء أي أسئلة لهذا الاختبار. يرجى مراجعة الإعدادات.");
        return;
    }

    state.totalQuestions = state.questionSequence.length;
    ui.showScreen(ui.quizScreen);
    displayNextQuestion();
}

function displayNextQuestion() {
    if (state.currentQuestionIndex >= state.totalQuestions) {
        endQuiz();
        return;
    }

    const questionData = state.questionSequence[state.currentQuestionIndex];
    state.currentQuestionIndex++;
    ui.updateProgress(state.currentQuestionIndex, state.totalQuestions);
    ui.feedbackArea.classList.add('hidden');

    if (!questionData || !questionData.generator) {
        console.error("خطأ: لم يتم العثور على بيانات السؤال أو الدالة المولدة.", questionData);
        displayNextQuestion(); // حاول تخطي السؤال الخاطئ
        return;
    }

    const questionGenerator = questionData.generator;
    const optionsCount = questionData.options_count;

    const question = questionGenerator(
        state.pageAyahs,
        state.selectedQari,
        handleResult,
        optionsCount
    );

    if (question) {
        ui.questionArea.innerHTML = question.questionHTML;
        question.setupListeners(ui.questionArea);
    } else {
        console.warn(`فشل مولد الأسئلة في إنشاء سؤال. يتم المحاولة مرة أخرى.`);
        displayNextQuestion();
    }
}

function handleResult(isCorrect, correctAnswerText, clickedElement) {
    ui.disableQuestionInteraction();
    const rules = progression.getGameRules();
    if (isCorrect) {
        state.score++;
        state.xpEarned += rules.xp_per_correct_answer || 10;
    } else {
        state.errorLog.push({
            questionHTML: ui.questionArea.innerHTML,
            correctAnswer: correctAnswerText
        });
    }
    ui.showFeedback(isCorrect, correctAnswerText, clickedElement);
    setTimeout(displayNextQuestion, 3000);
}

async function endQuiz() {
    const endTime = Date.now();
    const durationSeconds = Math.round((endTime - state.startTime) / 1000);
    const isPerfect = state.errorLog.length === 0;
    const rules = progression.getGameRules();

    player.playerData.total_quizzes_completed = (player.playerData.total_quizzes_completed || 0) + 1;
    player.playerData.total_correct_answers = (player.playerData.total_correct_answers || 0) + state.score;
    player.playerData.total_wrong_answers = (player.playerData.total_wrong_answers || 0) + state.errorLog.length;

    if (isPerfect) {
        state.xpEarned += rules.xp_bonus_all_correct || 50;
        player.playerData.total_perfect_quizzes = (player.playerData.total_perfect_quizzes || 0) + 1;
        if (state.liveEvent) {
            player.playerData.diamonds += state.liveEvent.bonus_diamonds_reward || 0;
        }
        if (state.pageNumber) { // فقط إذا كان اختبار صفحة واحدة
            await updateMasteryRecord(state.pageNumber, durationSeconds);
        }
    }

    const oldXp = player.playerData.xp;
    player.playerData.xp += state.xpEarned;
    const levelUpInfo = progression.checkForLevelUp(oldXp, player.playerData.xp);
    if (levelUpInfo) {
        player.playerData.diamonds += levelUpInfo.reward;
    }

    quests.updateQuestsProgress('quiz_completed');
    if (isPerfect) {
        quests.updateQuestsProgress('perfect_quiz');
    }

    achievements.checkAchievements('quiz_completed', {
        score: state.score,
        totalQuestions: state.totalQuestions,
        isPerfect: isPerfect,
        pageNumber: state.pageNumber
    });

    state.durationSeconds = durationSeconds;
    state.isPerfect = isPerfect;

    // لا تنتظر الحفظ، اعرض النتيجة فوراً لتحسين تجربة المستخدم
    player.savePlayer();
    saveResult(state);
    ui.updateSaveMessage(false); // أظهر "جاري الحفظ"

    if (state.errorLog.length > 0) {
        ui.displayErrorReview(state.errorLog);
    } else {
        ui.displayFinalResult(state, levelUpInfo);
    }
}

export function getCurrentState() {
    return state;
}


