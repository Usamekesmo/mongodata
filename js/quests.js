// =============================================================
// ==      وحدة نظام المهام - (مبسطة مؤقتاً) - لا تحتاج لتعديل ==
// =============================================================

import * as api from './api.js';
import * as player from './player.js';
import * as ui from './ui.js';
import * as progression from './progression.js';

let activeQuests = [];
let playerMasteryData = [];

export async function initialize() {
    // سيتم استدعاء الدوال المبسطة من api.js، وستعيد مصفوفات فارغة
    [activeQuests, playerMasteryData] = await Promise.all([
        api.fetchOrAssignDailyQuests(),
        api.fetchPlayerMastery()
    ]);
    renderQuests();
}

export function renderQuests() {
    const container = document.getElementById('quests-container');
    if (!container) return;

    if (!activeQuests || activeQuests.length === 0) {
        container.innerHTML = '<p>لا توجد مهام متاحة حاليًا. عد غدًا لمهام جديدة!</p>';
        return;
    }

    // بما أن activeQuests ستكون فارغة، هذا الكود لن يتم تنفيذه في الغالب
    container.innerHTML = activeQuests.map(q => {
        const questConfig = q.quests_config;
        if (!questConfig) return '';

        // المنطق الحالي للمهام العادية
        const progressPercentage = Math.min(100, (q.progress / questConfig.target_value) * 100);
        return `
            <div class="quest-card ${q.is_completed ? 'completed' : ''}">
                <div class="quest-info">
                    <h4>${questConfig.title}</h4>
                    <p>${questConfig.description}</p>
                    <div class="quest-progress-bar">
                        <div class="quest-progress-fill" style="width: ${progressPercentage}%;"></div>
                    </div>
                    <span class="quest-progress-text">${q.progress} / ${questConfig.target_value}</span>
                </div>
                <div class="quest-reward">
                    ${q.is_completed ? 
                        `<button class="claim-button" disabled>تمت المطالبة</button>` :
                        `<button class="claim-button" data-quest-id="${q.id}" ${q.progress < questConfig.target_value ? 'disabled' : ''}>مطالبة</button>`
                    }
                     <p>+${questConfig.xp_reward} XP, +${questConfig.diamonds_reward} 💎</p>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.claim-button').forEach(button => {
        if (!button.disabled) {
            button.addEventListener('click', handleClaimReward);
        }
    });
}

async function handleClaimReward(event) {
    const questId = parseInt(event.target.dataset.questId, 10);
    const questToClaim = activeQuests.find(q => q.id === questId);

    if (!questToClaim || questToClaim.is_completed) return;

    const questConfig = questToClaim.quests_config;
    const xpReward = questConfig.xp_reward;
    const diamondsReward = questConfig.diamonds_reward;

    player.playerData.xp += xpReward;
    player.playerData.diamonds += diamondsReward;
    questToClaim.is_completed = true;

    ui.showToast(`تمت المطالبة بمكافأة: "${questConfig.title}"!`);
    const levelInfo = progression.getLevelInfo(player.playerData.xp);
    ui.updatePlayerHeader(player.playerData, levelInfo);
    renderQuests();

    await api.updatePlayerQuests([{ id: questToClaim.id, progress: questToClaim.progress, is_completed: true }]);
    await player.savePlayer();
}

export function updateQuestsProgress(eventType, value = 1) {
    const updates = [];
    if (!activeQuests) return;
    
    activeQuests.forEach(q => {
        if (q.is_completed || !q.quests_config) return;
        if (q.quests_config.type === eventType) {
            q.progress = Math.min(q.quests_config.target_value, q.progress + value);
            updates.push({ id: q.id, progress: q.progress });
        }
    });

    if (updates.length > 0) {
        renderQuests();
        api.updatePlayerQuests(updates);
    }
}


