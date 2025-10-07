const API_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const encodedApiKey = 'c2stMjM1NzQ0ODczZDcxNDI1Y2I4YmNiYjA5NGQwZmNmMzI=';

function decodeConfigValue(value) {
    if (typeof atob === 'function') {
        return atob(value);
    }

    if (typeof Buffer !== 'undefined') {
        return Buffer.from(value, 'base64').toString('utf-8');
    }

    throw new Error('Base64 解码失败: 环境不支持 atob 或 Buffer');
}

function getApiKey() {
    return decodeConfigValue(encodedApiKey);
}

function buildSystemPrompt() {
    const currentDate = new Date();
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;
    const tomorrow = new Date(currentDate.getTime() + 86400000);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    const dayAfter = new Date(currentDate.getTime() + 2 * 86400000);
    const dayAfterStr = `${dayAfter.getFullYear()}-${String(dayAfter.getMonth() + 1).padStart(2, '0')}-${String(dayAfter.getDate()).padStart(2, '0')}`;
    const nextMonday = getNextDayOfWeek(1);
    const nextTuesday = getNextDayOfWeek(2);
    const nextWednesday = getNextDayOfWeek(3);
    const nextThursday = getNextDayOfWeek(4);
    const nextFriday = getNextDayOfWeek(5);
    const nextSaturday = getNextDayOfWeek(6);
    const nextSunday = getNextDayOfWeek(0);

    return `你是一位专业的时间管理与提醒提取助手。当前日期为 ${today}。` +
        `请从用户的自然语言输入中提取清晰的日程与提醒信息，并严格按照以下 JSON 模型返回：\n\n` +
        `{"日程": [{"待办事项": "事项描述", "开始时间": "YYYY年MM月DD日 HH:mm", "预计时长": "X小时Y分钟/未知", "重复频率": "不重复/每天/每周/每月/每年", "地点": "若有请填写,否则写无", "备注": "补充信息，如为空填\"无\""}], "提醒事项": ["提醒内容1"]}` +
        `\n\n规则要求：\n` +
        `1. 始终返回完整 JSON，不要包含额外解释。\n` +
        `2. 时间使用 24 小时制。如未给出具体时间，默认 09:00。\n` +
        `3. 未提及年份时使用当前年份 ${yyyy}。如出现“今天”“明天”等，请换算为具体日期。今天=${today}，明天=${tomorrowStr}，后天=${dayAfterStr}。` +
        `\n4. 当输入包含“周一至周日”等词汇时，选择最近的日期。例如：周一=${nextMonday}，周二=${nextTuesday}，周三=${nextWednesday}，周四=${nextThursday}，周五=${nextFriday}，周六=${nextSaturday}，周日=${nextSunday}。` +
        `\n5. 若描述“下个月”“下周”等相对时间，请换算为具体日期。\n` +
        `6. 若无法确定时长，写“未知”；若无地点或备注，请写“无”。\n` +
        `7. 提醒事项返回字符串数组，即使为空也要返回 []。` +
        `\n8. 保持输出可被 JSON.parse 直接解析。`;
}

function getNextDayOfWeek(targetWeekday) {
    const now = new Date();
    const currentWeekday = now.getDay();
    const offset = (targetWeekday - currentWeekday + 7) % 7 || 7;
    const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const yyyy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function buildRequestPayload(userInput) {
    const systemPrompt = buildSystemPrompt();
    return {
        model: 'qwen-plus',
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userInput }
        ]
    };
}

export async function processUserInput(userInput) {
    const apiKey = getApiKey();
    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(buildRequestPayload(userInput))
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qwen API 请求失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('Qwen API 返回内容为空');
    }

    return content;
}

if (typeof window !== 'undefined') {
    window.processUserInput = processUserInput;
}
