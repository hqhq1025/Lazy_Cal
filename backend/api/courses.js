const express = require('express');
const Course = require('../models/Course');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');
const logger = require('../utils/logger');

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

function parseWeeks(value) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, 'weeks 必须是数组');
  }

  const weeks = value.map((week) => {
    const parsed = Number.parseInt(week, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new HttpError(400, 'weeks 数组中存在无效的周次');
    }
    return parsed;
  });

  return weeks;
}

function parseMetadata(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'metadata 必须是对象');
  }

  return value;
}

function normalizeCourse(course) {
  if (!course || typeof course !== 'object' || Array.isArray(course)) {
    throw new HttpError(400, '课程数据格式错误');
  }

  const name = ensureString(course.name, '课程名称', { required: true });
  const teacher = ensureString(course.teacher, '授课教师') || '';
  const day = ensureString(course.day, '上课日') || '';
  const startTime = parseDate(course.startTime, 'startTime', { required: true });
  const endTime = parseDate(course.endTime, 'endTime');
  const location = ensureString(course.location, '上课地点') || '';
  const weeks = parseWeeks(course.weeks);
  const metadata = parseMetadata(course.metadata);

  if (endTime && endTime < startTime) {
    throw new HttpError(400, '课程结束时间必须晚于开始时间');
  }

  const payload = {
    name,
    teacher,
    day,
    startTime,
    location,
    weeks
  };

  if (endTime) {
    payload.endTime = endTime;
  }

  if (metadata) {
    payload.metadata = metadata;
  }

  return payload;
}

function parseCoursePayload(body) {
  if (Array.isArray(body)) {
    if (!body.length) {
      throw new HttpError(400, '课程数组不能为空');
    }
    return body.map((item) => normalizeCourse(item));
  }

  return normalizeCourse(body);
}

function parseCourseUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, '请求体格式错误');
  }

  const update = {};

  if (body.name !== undefined) {
    update.name = ensureString(body.name, '课程名称', { required: true });
  }

  if (body.teacher !== undefined) {
    update.teacher = ensureString(body.teacher, '授课教师') || '';
  }

  if (body.day !== undefined) {
    update.day = ensureString(body.day, '上课日') || '';
  }

  if (body.location !== undefined) {
    update.location = ensureString(body.location, '上课地点') || '';
  }

  if (body.startTime !== undefined) {
    update.startTime = parseDate(body.startTime, 'startTime', { required: true });
  }

  if (body.endTime !== undefined) {
    update.endTime = parseDate(body.endTime, 'endTime');
  }

  if (body.weeks !== undefined) {
    update.weeks = parseWeeks(body.weeks);
  }

  if (body.metadata !== undefined) {
    update.metadata = parseMetadata(body.metadata);
  }

  if (Object.keys(update).length === 0) {
    throw new HttpError(400, '请求体不能为空');
  }

  if (update.startTime && update.endTime && update.endTime < update.startTime) {
    throw new HttpError(400, '课程结束时间必须晚于开始时间');
  }

  return update;
}

function buildCourseFilters(query) {
  const filters = {};

  if (query.day) {
    filters.day = ensureString(query.day, 'day', { required: true });
  }

  if (query.teacher) {
    filters.teacher = ensureString(query.teacher, 'teacher', { required: true });
  }

  if (query.startAfter || query.startBefore) {
    filters.startTime = {};
    if (query.startAfter) {
      filters.startTime.$gte = parseDate(query.startAfter, 'startAfter', { required: true });
    }
    if (query.startBefore) {
      filters.startTime.$lte = parseDate(query.startBefore, 'startBefore', { required: true });
    }
  }

  return filters;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = buildCourseFilters(req.query || {});
    const courses = await Course.find(filters).sort({ startTime: 1 });
    res.json(courses);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = parseCoursePayload(req.body);
    const documents = Array.isArray(payload) ? payload : [payload];
    const created = await Course.insertMany(documents, { ordered: true });
    logger.info(`Inserted ${created.length} course records`);
    res.status(201).json(Array.isArray(payload) ? created : created[0]);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const update = parseCourseUpdate(req.body);
    const course = await Course.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    });

    if (!course) {
      throw new HttpError(404, '未找到课程');
    }

    res.json(course);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      throw new HttpError(404, '未找到课程');
    }
    res.json({ message: '课程已删除' });
  })
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    await Course.deleteMany({});
    res.json({ message: '所有课程已清空' });
  })
);

module.exports = router;
