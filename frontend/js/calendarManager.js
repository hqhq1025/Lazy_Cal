import { openModal, closeModal } from './modal.js';
import { loadStoredSchedules, saveStoredSchedules, clearStoredSchedules } from './storage.js';

const VIEW_LOCALE = 'zh-cn';

export class CalendarManager {
    constructor({ onEventsChange, onTitleChange, showToast }) {
        this.calendar = null;
        this.memoryEnabled = true;
        this.storedSchedules = [];
        this.onEventsChange = onEventsChange;
        this.onTitleChange = onTitleChange;
        this.showToast = showToast;
    }

    initialize({ memoryEnabled = true } = {}) {
        this.memoryEnabled = memoryEnabled;
        this.storedSchedules = memoryEnabled ? loadStoredSchedules() : [];

        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) {
            console.error('未找到日历容器元素');
            return;
        }

        this.calendar = new FullCalendar.Calendar(calendarEl, {
            locale: VIEW_LOCALE,
            initialView: 'dayGridMonth',
            headerToolbar: false,
            selectable: true,
            editable: true,
            eventResizableFromStart: true,
            navLinks: true,
            nowIndicator: true,
            eventClick: (info) => this.openEventDetails(info.event),
            select: (selection) => this.openCreateEventModal(selection),
            eventAdd: () => this.handleEventMutation(),
            eventChange: (info) => this.handleEventChange(info.event),
            eventRemove: () => this.handleEventMutation()
        });

        this.calendar.render();

        if (Array.isArray(this.storedSchedules) && this.storedSchedules.length > 0) {
            this.storedSchedules.forEach((schedule) => {
                this.renderSchedule(schedule, { skipStoreUpdate: true });
            });
            this.emitSchedules();
        }

        this.calendar.on('datesSet', (info) => {
            if (typeof this.onTitleChange === 'function') {
                this.onTitleChange({
                    title: info.view.title,
                    currentStart: info.start,
                    currentEnd: info.end,
                    viewType: info.view.type
                });
            }
        });
    }

    addEvents(schedules = [], { silent = false } = {}) {
        if (!Array.isArray(schedules)) return;
        schedules.forEach((schedule) => {
            const normalized = this.normalizeSchedule(schedule);
            this.renderSchedule(normalized);
        });

        if (!silent) {
            this.showToast?.('已将新日程添加到日历', 'success');
        }
    }

    normalizeSchedule(schedule) {
        if (!schedule) return null;
        const id = schedule.id || generateScheduleId();
        const start = schedule.start ? new Date(schedule.start) : null;
        const end = schedule.end ? new Date(schedule.end) : null;

        if (!start || Number.isNaN(start.getTime())) {
            console.warn('无效的日程开始时间', schedule);
            return null;
        }

        const durationMinutes = schedule.durationMinutes || (end ? Math.round((end.getTime() - start.getTime()) / 60000) : null);

        return {
            id,
            title: schedule.title || '未命名日程',
            start: start.toISOString(),
            end: end ? end.toISOString() : null,
            allDay: Boolean(schedule.allDay),
            durationMinutes,
            recurrence: schedule.recurrence || '不重复',
            notes: schedule.notes || '',
            location: schedule.location || '',
            source: schedule.source || 'AI 助手',
            originalInput: schedule.originalInput || '',
            createdAt: schedule.createdAt || new Date().toISOString()
        };
    }

    renderSchedule(schedule, { skipStoreUpdate = false } = {}) {
        if (!this.calendar) return;
        if (!schedule) return;

        const eventDefinition = this.createEventDefinition(schedule);
        const eventApi = this.calendar.addEvent(eventDefinition);
        eventApi.setExtendedProp('scheduleId', schedule.id);
        eventApi.setExtendedProp('rawSchedule', schedule);

        if (!skipStoreUpdate) {
            this.registerSchedule(schedule);
        }

        return eventApi;
    }

    createEventDefinition(schedule) {
        const eventDef = {
            title: schedule.title,
            allDay: schedule.allDay,
            extendedProps: {
                notes: schedule.notes,
                location: schedule.location,
                source: schedule.source,
                originalInput: schedule.originalInput,
                scheduleId: schedule.id,
                rawSchedule: schedule
            }
        };

        if (schedule.recurrence && schedule.recurrence !== '不重复') {
            const freqMap = {
                '每天': 'daily',
                '每周': 'weekly',
                '每月': 'monthly',
                '每年': 'yearly'
            };
            const freq = freqMap[schedule.recurrence];
            if (freq) {
                eventDef.rrule = {
                    freq,
                    dtstart: schedule.start
                };

                const duration = schedule.durationMinutes || this.calculateDuration(schedule);
                if (duration) {
                    const durationObj = {};
                    const hours = Math.floor(duration / 60);
                    const minutes = duration % 60;
                    if (hours) durationObj.hours = hours;
                    if (minutes) durationObj.minutes = minutes;
                    eventDef.duration = durationObj;
                }
            } else {
                eventDef.start = schedule.start;
                if (schedule.end) eventDef.end = schedule.end;
            }
        } else {
            eventDef.start = schedule.start;
            if (schedule.end) eventDef.end = schedule.end;
        }

        return eventDef;
    }

    calculateDuration(schedule) {
        if (!schedule.start || !schedule.end) return schedule.durationMinutes || null;
        const start = new Date(schedule.start);
        const end = new Date(schedule.end);
        if (Number.isNaN(start) || Number.isNaN(end)) return schedule.durationMinutes || null;
        const diff = (end.getTime() - start.getTime()) / 60000;
        return diff > 0 ? Math.round(diff) : schedule.durationMinutes || null;
    }

    registerSchedule(schedule) {
        const normalized = this.normalizeSchedule(schedule);
        if (!normalized) return;
        const index = this.storedSchedules.findIndex((item) => item.id === normalized.id);
        if (index >= 0) {
            this.storedSchedules[index] = normalized;
        } else {
            this.storedSchedules.push(normalized);
        }
        this.persistSchedules();
        this.emitSchedules();
    }

    handleEventMutation() {
        if (!this.calendar) return;
        const events = this.calendar.getEvents();
        const schedules = events.map((event) => this.extractScheduleFromEvent(event)).filter(Boolean);
        this.storedSchedules = schedules;
        this.persistSchedules();
        this.emitSchedules();
    }

    handleEventChange(event) {
        if (!event) return;
        const scheduleId = event.extendedProps.scheduleId;
        if (!scheduleId) {
            this.handleEventMutation();
            return;
        }
        const index = this.storedSchedules.findIndex((item) => item.id === scheduleId);
        if (index >= 0) {
            const updated = {
                ...this.storedSchedules[index],
                start: event.start ? event.start.toISOString() : this.storedSchedules[index].start,
                end: event.end ? event.end.toISOString() : null,
                allDay: event.allDay
            };
            updated.durationMinutes = this.calculateDuration(updated);
            this.storedSchedules[index] = updated;
            event.setExtendedProp('rawSchedule', updated);
            this.persistSchedules();
            this.emitSchedules();
        } else {
            this.handleEventMutation();
        }
    }

    extractScheduleFromEvent(event) {
        const raw = event.extendedProps?.rawSchedule;
        if (raw) {
            const normalized = this.normalizeSchedule({ ...raw, start: raw.start, end: raw.end, allDay: event.allDay });
            event.setExtendedProp('rawSchedule', normalized);
            return normalized;
        }

        const scheduleId = event.extendedProps?.scheduleId || generateScheduleId();
        const normalized = this.normalizeSchedule({
            id: scheduleId,
            title: event.title,
            start: event.start?.toISOString(),
            end: event.end?.toISOString() || null,
            allDay: event.allDay,
            notes: event.extendedProps?.notes || '',
            location: event.extendedProps?.location || '',
            source: event.extendedProps?.source || '手动添加',
            originalInput: event.extendedProps?.originalInput || ''
        });
        event.setExtendedProp('rawSchedule', normalized);
        return normalized;
    }

    removeScheduleById(scheduleId) {
        if (!this.calendar) return;
        const event = this.calendar.getEvents().find((item) => item.extendedProps.scheduleId === scheduleId);
        if (event) {
            event.remove();
        }
        this.storedSchedules = this.storedSchedules.filter((item) => item.id !== scheduleId);
        this.persistSchedules();
        this.emitSchedules();
        this.showToast?.('已删除该日程', 'info');
    }

    openEventDetails(event) {
        const scheduleId = event.extendedProps.scheduleId;
        const schedule = this.storedSchedules.find((item) => item.id === scheduleId);
        const start = event.start ? formatDateTime(event.start) : '未指定';
        const end = event.end ? formatDateTime(event.end) : '未指定';
        const recurrence = schedule?.recurrence || '不重复';
        const notes = event.extendedProps?.notes || '无';
        const location = event.extendedProps?.location || '无';
        const source = event.extendedProps?.source || '未记录';
        const originalInput = event.extendedProps?.originalInput || '';

        const wrapper = document.createElement('div');
        wrapper.classList.add('event-detail');
        wrapper.innerHTML = `
            <div class="event-detail-grid">
                <div><strong>开始时间</strong><span>${start}</span></div>
                <div><strong>结束时间</strong><span>${end}</span></div>
                <div><strong>重复频率</strong><span>${recurrence}</span></div>
                <div><strong>地点</strong><span>${location}</span></div>
                <div><strong>来源</strong><span>${source}</span></div>
            </div>
            <div class="event-detail-notes">
                <strong>备注</strong>
                <p>${notes || '无'}</p>
            </div>
            ${originalInput ? `<div class="event-detail-original"><strong>原始输入</strong><p>${originalInput}</p></div>` : ''}
        `;

        openModal({
            title: event.title,
            content: wrapper,
            confirmText: '删除事件',
            cancelText: '关闭',
            onConfirm: () => {
                this.removeScheduleById(scheduleId);
                closeModal();
            },
            onCancel: () => {
                closeModal();
            }
        });
    }

    openCreateEventModal(selection) {
        const { start, end, allDay } = selection;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <label class="input-label" for="eventTitle">事件标题</label>
            <input type="text" id="eventTitle" placeholder="请输入事件标题">
            <label class="input-label" for="eventStart">开始时间</label>
            <input type="datetime-local" id="eventStart" value="${toInputValue(start)}">
            <label class="input-label" for="eventEnd">结束时间</label>
            <input type="datetime-local" id="eventEnd" value="${toInputValue(end || start)}">
            <label class="input-label" for="eventLocation">地点</label>
            <input type="text" id="eventLocation" placeholder="可选">
            <label class="input-label" for="eventNotes">备注</label>
            <textarea id="eventNotes" placeholder="记录一些细节..."></textarea>
        `;

        openModal({
            title: '创建新日程',
            content: wrapper,
            confirmText: '添加到日历',
            cancelText: '取消',
            onConfirm: () => {
                const titleInput = wrapper.querySelector('#eventTitle');
                const startInput = wrapper.querySelector('#eventStart');
                const endInput = wrapper.querySelector('#eventEnd');
                const locationInput = wrapper.querySelector('#eventLocation');
                const notesInput = wrapper.querySelector('#eventNotes');

                const title = titleInput.value.trim() || '未命名日程';
                const startDate = new Date(startInput.value);
                const endDate = endInput.value ? new Date(endInput.value) : null;

                if (Number.isNaN(startDate)) {
                    this.showToast?.('请输入有效的开始时间', 'error');
                    return;
                }

                if (endDate && endDate <= startDate) {
                    this.showToast?.('结束时间应晚于开始时间', 'error');
                    return;
                }

                const newSchedule = {
                    id: generateScheduleId(),
                    title,
                    start: startDate.toISOString(),
                    end: endDate ? endDate.toISOString() : null,
                    allDay,
                    notes: notesInput.value.trim(),
                    location: locationInput.value.trim(),
                    source: '手动创建',
                    recurrence: '不重复',
                    originalInput: ''
                };

                this.renderSchedule(newSchedule);
                closeModal();
                this.calendar.unselect();
                this.showToast?.('自定义事件已创建', 'success');
            },
            onCancel: () => {
                this.calendar.unselect();
                closeModal();
            }
        });
    }

    goToPrevious() {
        this.calendar?.prev();
    }

    goToNext() {
        this.calendar?.next();
    }

    goToToday() {
        this.calendar?.today();
    }

    changeView(viewName) {
        this.calendar?.changeView(viewName);
    }

    setMemoryMode(enabled) {
        this.memoryEnabled = enabled;
        if (enabled) {
            saveStoredSchedules(this.storedSchedules);
        } else {
            clearStoredSchedules();
        }
    }

    persistSchedules() {
        if (!this.memoryEnabled) return;
        saveStoredSchedules(this.storedSchedules);
    }

    emitSchedules() {
        if (typeof this.onEventsChange === 'function') {
            const snapshot = this.storedSchedules.map((item) => ({ ...item }));
            this.onEventsChange(snapshot);
        }
    }

    getSchedulesSnapshot() {
        return this.storedSchedules.map((item) => ({ ...item }));
    }
}

function generateScheduleId() {
    return `sch_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function toInputValue(date) {
    if (!date) return '';
    const target = new Date(date);
    if (Number.isNaN(target)) return '';
    target.setMinutes(target.getMinutes() - target.getTimezoneOffset());
    return target.toISOString().slice(0, 16);
}

function formatDateTime(date) {
    const target = new Date(date);
    if (Number.isNaN(target)) return '未指定';
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const hh = String(target.getHours()).padStart(2, '0');
    const min = String(target.getMinutes()).padStart(2, '0');
    return `${yyyy}年${mm}月${dd}日 ${hh}:${min}`;
}
