import { CalendarManager } from './calendarManager.js';
import { ChatManager } from './chatManager.js';
import { CourseImporter } from './courseImporter.js';
import { loadMemoryMode, saveMemoryMode } from './storage.js';

const toastContainer = document.getElementById('toastContainer');
const memoryModeToggle = document.getElementById('memoryModeToggle');
const navButtons = document.querySelectorAll('.calendar-nav');
const viewButtons = document.querySelectorAll('.view-btn');
const calendarTitleEl = document.getElementById('calendarTitle');
const calendarRangeEl = document.getElementById('calendarRange');
const upcomingList = document.getElementById('upcomingEventsList');
const addCourseBtn = document.getElementById('addCourseScheduleBtn');
const settingsBtn = document.getElementById('settingsBtn');

const todayCountEl = document.getElementById('todayCount');
const weekCountEl = document.getElementById('weekCount');
const reminderCountEl = document.getElementById('reminderCount');

const memoryModeEnabled = loadMemoryMode(true);
if (memoryModeToggle) memoryModeToggle.checked = memoryModeEnabled;

const calendarManager = new CalendarManager({
    onEventsChange: (schedules) => {
        updateUpcomingEvents(schedules);
        updateMetrics(schedules, chatManager?.reminders || []);
    },
    onTitleChange: (info) => updateTitle(info),
    showToast
});

calendarManager.initialize({ memoryEnabled: memoryModeEnabled });

const courseImporter = new CourseImporter({
    calendarManager,
    showToast
});

const chatManager = new ChatManager({
    calendarManager,
    showToast,
    onRemindersUpdate: (reminders) => {
        reminderCountEl.textContent = reminders.length;
    }
});

updateMetrics(calendarManager.getSchedulesSnapshot(), chatManager.reminders);
updateUpcomingEvents(calendarManager.getSchedulesSnapshot());

memoryModeToggle?.addEventListener('change', (event) => {
    const enabled = event.target.checked;
    calendarManager.setMemoryMode(enabled);
    saveMemoryMode(enabled);
    showToast(enabled ? '记忆模式已开启，日程将自动保存' : '记忆模式已关闭，本地记录已暂停保存', 'info');
});

navButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'prev') calendarManager.goToPrevious();
        if (action === 'next') calendarManager.goToNext();
        if (action === 'today') calendarManager.goToToday();
    });
});

viewButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const { view } = button.dataset;
        viewButtons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        calendarManager.changeView(view);
    });
});

addCourseBtn?.addEventListener('click', () => courseImporter.showModal());
settingsBtn?.addEventListener('click', () => {
    showToast('设置中心即将上线，敬请期待。', 'info');
});

function updateTitle({ title, currentStart, currentEnd, viewType }) {
    if (calendarTitleEl) {
        calendarTitleEl.textContent = title;
    }
    if (!calendarRangeEl) return;
    if (viewType === 'dayGridMonth') {
        calendarRangeEl.textContent = formatRange(currentStart, currentEnd, 'month');
    } else if (viewType === 'timeGridWeek' || viewType === 'listWeek') {
        calendarRangeEl.textContent = formatRange(currentStart, currentEnd, 'week');
    } else if (viewType === 'timeGridDay') {
        calendarRangeEl.textContent = formatRange(currentStart, currentEnd, 'day');
    } else {
        calendarRangeEl.textContent = '';
    }
}

function updateUpcomingEvents(schedules = []) {
    if (!upcomingList) return;
    upcomingList.innerHTML = '';
    const now = new Date();
    const upcoming = schedules
        .map((schedule) => ({ schedule, next: getNextOccurrence(schedule, now) }))
        .filter((item) => item.next)
        .sort((a, b) => a.next.getTime() - b.next.getTime())
        .slice(0, 5);

    if (!upcoming.length) {
        const empty = document.createElement('li');
        empty.classList.add('insight-item');
        empty.innerHTML = '<strong>暂无即将开始的日程</strong><span>告诉助手你的计划，让它帮你安排。</span>';
        upcomingList.appendChild(empty);
        return;
    }

    upcoming.forEach(({ schedule, next }) => {
        const item = document.createElement('li');
        item.classList.add('insight-item');
        item.innerHTML = `
            <strong>${schedule.title}</strong>
            <span>${formatDateTime(next)}${schedule.location ? ` · ${schedule.location}` : ''}</span>
        `;
        upcomingList.appendChild(item);
    });
}

function updateMetrics(schedules = [], reminders = []) {
    const now = new Date();
    const endOfDay = endOfDayDate(now);
    const weekAhead = new Date(now.getTime() + 7 * 86400000);

    const todayCount = schedules.reduce((total, schedule) => {
        return occursWithin(schedule, now, endOfDay) ? total + 1 : total;
    }, 0);

    const weekCount = schedules.reduce((total, schedule) => {
        const next = getNextOccurrence(schedule, now);
        if (next && next <= weekAhead) return total + 1;
        return total;
    }, 0);

    if (todayCountEl) todayCountEl.textContent = todayCount;
    if (weekCountEl) weekCountEl.textContent = weekCount;
    if (reminderCountEl) reminderCountEl.textContent = reminders.length;
}

function occursWithin(schedule, startDate, endDate) {
    const start = new Date(schedule.start);
    if (schedule.recurrence && schedule.recurrence !== '不重复') {
        const rule = buildRRule(schedule);
        if (!rule) return false;
        const occurrences = rule.between(startDate, endDate, true);
        return occurrences.length > 0;
    }
    return start >= startDate && start <= endDate;
}

function getNextOccurrence(schedule, fromDate = new Date()) {
    if (schedule.recurrence && schedule.recurrence !== '不重复') {
        const rule = buildRRule(schedule);
        if (!rule) return null;
        return rule.after(fromDate, true);
    }
    const start = new Date(schedule.start);
    if (start < fromDate) return null;
    return start;
}

function buildRRule(schedule) {
    if (typeof RRule === 'undefined') return null;
    const freqMap = {
        '每天': RRule.DAILY,
        '每周': RRule.WEEKLY,
        '每月': RRule.MONTHLY,
        '每年': RRule.YEARLY
    };
    const freq = freqMap[schedule.recurrence];
    if (!freq) return null;
    try {
        return new RRule({
            freq,
            dtstart: new Date(schedule.start),
            count: 120
        });
    } catch (error) {
        console.error('构建重复规则失败', error);
        return null;
    }
}

function formatRange(start, end, type) {
    const startDate = new Date(start);
    const endDate = new Date(end.getTime() - 1);
    if (type === 'month') {
        return `${startDate.getFullYear()}年${startDate.getMonth() + 1}月`;
    }
    if (type === 'week') {
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    if (type === 'day') {
        return formatDate(startDate);
    }
    return '';
}

function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}年${mm}月${dd}日`;
}

function formatDateTime(date) {
    const target = new Date(date);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const hh = String(target.getHours()).padStart(2, '0');
    const min = String(target.getMinutes()).padStart(2, '0');
    return `${yyyy}年${mm}月${dd}日 ${hh}:${min}`;
}

function endOfDayDate(date) {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
}

function showToast(message, variant = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.classList.add('toast', variant);
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 4200);
}
