function sanitizeResponse(text) {
    if (!text) return '';
    return text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*$/gi, '')
        .trim();
}

export function parseAIResponse(aiResponse, originalInput) {
    const sanitized = sanitizeResponse(aiResponse);
    let parsed;

    try {
        parsed = JSON.parse(sanitized);
    } catch (error) {
        console.error('AI 响应无法解析为 JSON', error, sanitized);
        return { schedules: [], reminders: [] };
    }

    const schedules = Array.isArray(parsed.日程)
        ? parsed.日程.map((entry) => transformSchedule(entry, originalInput)).filter(Boolean)
        : [];

    const reminders = Array.isArray(parsed.提醒事项)
        ? parsed.提醒事项.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
        : [];

    return { schedules, reminders };
}

function transformSchedule(entry, originalInput) {
    if (!entry) return null;

    const title = typeof entry.待办事项 === 'string' && entry.待办事项.trim()
        ? entry.待办事项.trim()
        : '未命名日程';

    const start = parseChineseDateTime(entry.开始时间);
    if (!start) {
        console.warn('无法解析的开始时间', entry.开始时间);
        return null;
    }

    const durationMinutes = parseDurationMinutes(entry.预计时长);
    const end = durationMinutes ? new Date(start.getTime() + durationMinutes * 60000) : null;
    const recurrence = normaliseRecurrence(entry.重复频率);
    const notes = normaliseText(entry.备注);
    const location = normaliseText(entry.地点);

    return {
        id: createScheduleId(),
        title,
        start: start.toISOString(),
        end: end ? end.toISOString() : null,
        allDay: false,
        durationMinutes,
        recurrence,
        notes,
        location,
        source: 'AI 助手',
        originalInput,
        createdAt: new Date().toISOString()
    };
}

function normaliseText(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed || trimmed === '无') return '';
    return trimmed;
}

function normaliseRecurrence(recurrence) {
    const cleaned = typeof recurrence === 'string' ? recurrence.trim() : '';
    if (!cleaned) return '不重复';

    if (/每天/.test(cleaned)) return '每天';
    if (/每周/.test(cleaned)) return '每周';
    if (/每月/.test(cleaned)) return '每月';
    if (/每年/.test(cleaned)) return '每年';

    return '不重复';
}

function parseDurationMinutes(duration) {
    if (typeof duration !== 'string') return null;
    if (!duration || /未知/.test(duration)) return null;

    const hourMatch = duration.match(/(\d+(?:\.\d+)?)\s*小时/);
    const minuteMatch = duration.match(/(\d+)\s*分钟/);

    let minutes = 0;
    if (hourMatch) {
        minutes += parseFloat(hourMatch[1]) * 60;
    }
    if (minuteMatch) {
        minutes += parseInt(minuteMatch[1], 10);
    }

    return minutes > 0 ? Math.round(minutes) : null;
}

export function parseChineseDateTime(raw, fallback = new Date()) {
    if (!raw || typeof raw !== 'string') return null;
    const text = raw.trim();
    if (!text) return null;

    // yyyy-MM-dd HH:mm
    const isoMatch = text.match(/(\d{4})[-年](\d{1,2})[-月](\d{1,2})[日\s]+(\d{1,2}):(\d{2})/);
    if (isoMatch) {
        const [, year, month, day, hour, minute] = isoMatch;
        return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10));
    }

    const dateOnlyMatch = text.match(/(\d{4})[-年](\d{1,2})[-月](\d{1,2})日?/);
    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), 9, 0, 0, 0);
    }

    const fallbackDate = new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 9, 0, 0, 0);
    return fallbackDate;
}

function createScheduleId() {
    return `sch_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}
