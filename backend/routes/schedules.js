const express = require('express');
const Schedule = require('../models/Schedule');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');

const router = express.Router();

function ensureString(value, field, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      throw new HttpError(400, `${field}不能为空`);
    }
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, `${field}必须是字符串`);
  }

  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new HttpError(400, `${field}不能为空`);
  }

  return trimmed;
}

function parseDate(value, field, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      throw new HttpError(400, `${field}不能为空`);
    }
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${field}日期格式无效`);
  }

  return date;
}

function parseBoolean(value, field) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new HttpError(400, `${field}必须是布尔值`);
}

function parseDuration(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new HttpError(400, 'durationMinutes 必须是非负整数');
  }

  return parsed;
}

function parseReminders(value) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, 'reminders 必须是数组');
  }

  return value.map((item, index) => {
    const parsed = parseDate(item, `reminders[${index}]`, { required: true });
    return parsed;
  });
}

function normalizeSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    throw new HttpError(400, '日程数据格式错误');
  }

  const title = ensureString(schedule.title, '日程标题', { required: true });
  const start = parseDate(schedule.start, 'start', { required: true });
  const end = parseDate(schedule.end, 'end');
  const allDay = parseBoolean(schedule.allDay, 'allDay');
  const durationMinutes = parseDuration(schedule.durationMinutes);
  const recurrence = ensureString(schedule.recurrence, '重复频率') || '不重复';
  const notes = ensureString(schedule.notes, '备注') || '';
  const location = ensureString(schedule.location, '地点') || '';
  const source = ensureString(schedule.source, '来源') || 'AI 助手';
  const originalInput = ensureString(schedule.originalInput, '原始输入') || '';
  const reminders = parseReminders(schedule.reminders);

  if (end && end < start) {
    throw new HttpError(400, '结束时间必须晚于开始时间');
  }

  const payload = {
    title,
    start,
    allDay: allDay ?? false,
    recurrence,
    notes,
    location,
    source,
    originalInput,
    reminders
  };

  if (end) {
    payload.end = end;
  }

  if (durationMinutes !== undefined) {
    payload.durationMinutes = durationMinutes;
  }

  return payload;
}

function parseSchedulePayload(body) {
  if (Array.isArray(body)) {
    if (!body.length) {
      throw new HttpError(400, '日程数组不能为空');
    }
    return body.map((item) => normalizeSchedule(item));
  }

  return normalizeSchedule(body);
}

function parseScheduleUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, '请求体格式错误');
  }

  const update = {};

  if (body.title !== undefined) {
    update.title = ensureString(body.title, '日程标题', { required: true });
  }

  if (body.start !== undefined) {
    update.start = parseDate(body.start, 'start', { required: true });
  }

  if (body.end !== undefined) {
    update.end = parseDate(body.end, 'end');
  }

  if (body.allDay !== undefined) {
    update.allDay = parseBoolean(body.allDay, 'allDay');
  }

  if (body.durationMinutes !== undefined) {
    update.durationMinutes = parseDuration(body.durationMinutes);
  }

  if (body.recurrence !== undefined) {
    update.recurrence = ensureString(body.recurrence, '重复频率') || '不重复';
  }

  if (body.notes !== undefined) {
    update.notes = ensureString(body.notes, '备注') || '';
  }

  if (body.location !== undefined) {
    update.location = ensureString(body.location, '地点') || '';
  }

  if (body.source !== undefined) {
    update.source = ensureString(body.source, '来源') || 'AI 助手';
  }

  if (body.originalInput !== undefined) {
    update.originalInput = ensureString(body.originalInput, '原始输入') || '';
  }

  if (body.reminders !== undefined) {
    update.reminders = parseReminders(body.reminders);
  }

  if (Object.keys(update).length === 0) {
    throw new HttpError(400, '请求体不能为空');
  }

  if (update.start && update.end && update.end < update.start) {
    throw new HttpError(400, '结束时间必须晚于开始时间');
  }

  return update;
}

function buildScheduleFilters(query) {
  const filters = {};
  let limit;

  if (query.rangeStart) {
    filters.start = filters.start || {};
    filters.start.$gte = parseDate(query.rangeStart, 'rangeStart', { required: true });
  }

  if (query.rangeEnd) {
    filters.start = filters.start || {};
    filters.start.$lte = parseDate(query.rangeEnd, 'rangeEnd', { required: true });
  }

  if (query.limit !== undefined) {
    const parsed = Number.parseInt(query.limit, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new HttpError(400, 'limit 必须为正整数');
    }
    limit = parsed;
  }

  return { filters, limit };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { filters, limit } = buildScheduleFilters(req.query || {});
    let query = Schedule.find(filters).sort({ start: 1 });
    if (limit) {
      query = query.limit(limit);
    }
    const schedules = await query;
    res.json(schedules);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = parseSchedulePayload(req.body);
    const documents = Array.isArray(payload) ? payload : [payload];
    const created = await Schedule.insertMany(documents, { ordered: true });
    res.status(201).json(Array.isArray(payload) ? created : created[0]);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const update = parseScheduleUpdate(req.body);
    const schedule = await Schedule.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    });

    if (!schedule) {
      throw new HttpError(404, '未找到日程');
    }

    res.json(schedule);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (!schedule) {
      throw new HttpError(404, '未找到日程');
    }
    res.json({ message: '日程已删除' });
  })
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    await Schedule.deleteMany({});
    res.json({ message: '所有日程已清空' });
  })
);

module.exports = router;
