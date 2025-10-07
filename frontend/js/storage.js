const SCHEDULE_STORAGE_KEY = 'lazy-cal:schedules';
const REMINDER_STORAGE_KEY = 'lazy-cal:reminders';
const MEMORY_MODE_STORAGE_KEY = 'memoryModeEnabled';

export function loadStoredSchedules() {
    try {
        const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('读取日程存储失败', error);
        return [];
    }
}

export function saveStoredSchedules(schedules) {
    try {
        localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedules));
    } catch (error) {
        console.error('保存日程存储失败', error);
    }
}

export function clearStoredSchedules() {
    localStorage.removeItem(SCHEDULE_STORAGE_KEY);
}

export function loadReminders() {
    try {
        const raw = localStorage.getItem(REMINDER_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('读取提醒失败', error);
        return [];
    }
}

export function saveReminders(reminders) {
    try {
        localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
    } catch (error) {
        console.error('保存提醒失败', error);
    }
}

export function loadMemoryMode(defaultValue = true) {
    const stored = localStorage.getItem(MEMORY_MODE_STORAGE_KEY);
    if (stored === null) return defaultValue;
    try {
        return JSON.parse(stored);
    } catch (error) {
        console.error('读取记忆模式失败', error);
        return defaultValue;
    }
}

export function saveMemoryMode(enabled) {
    try {
        localStorage.setItem(MEMORY_MODE_STORAGE_KEY, JSON.stringify(enabled));
    } catch (error) {
        console.error('保存记忆模式失败', error);
    }
}
