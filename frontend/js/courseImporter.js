import { openModal, closeModal } from './modal.js';

export class CourseImporter {
    constructor({ calendarManager, showToast }) {
        this.calendarManager = calendarManager;
        this.showToast = showToast;
        this.modal = document.getElementById('uploadModal');
        this.fileInput = document.getElementById('xlsFileInput');
        this.semesterInput = document.getElementById('semesterStartInput');
        this.confirmBtn = document.getElementById('uploadFileBtn');
        this.cancelBtn = document.getElementById('cancelUploadBtn');
        this.closeBtns = document.querySelectorAll('[data-upload-close]');

        this.bindEvents();
    }

    bindEvents() {
        this.confirmBtn?.addEventListener('click', () => this.handleUpload());
        this.cancelBtn?.addEventListener('click', () => this.hideModal());
        this.closeBtns?.forEach((btn) => btn.addEventListener('click', () => this.hideModal()));
        this.modal?.addEventListener('click', (event) => {
            if (event.target === this.modal) {
                this.hideModal();
            }
        });
    }

    showModal() {
        if (!this.modal) return;
        if (this.semesterInput && !this.semesterInput.value) {
            this.semesterInput.value = getNextWeekMonday();
        }
        this.modal.setAttribute('aria-hidden', 'false');
    }

    hideModal() {
        if (!this.modal) return;
        this.modal.setAttribute('aria-hidden', 'true');
        if (this.fileInput) this.fileInput.value = '';
    }

    async handleUpload() {
        if (!this.fileInput || !this.fileInput.files?.length) {
            this.showToast?.('请选择课程表文件', 'error');
            return;
        }

        const file = this.fileInput.files[0];
        let semesterStart = this.semesterInput?.value ? new Date(this.semesterInput.value) : null;
        if (!semesterStart || Number.isNaN(semesterStart)) {
            semesterStart = new Date(getNextWeekMonday());
        }

        try {
            const jsonData = await parseXLSFile(file);
            const courses = extractCourses(jsonData);
            if (!courses.length) {
                this.showToast?.('未能从文件中识别到课程', 'error');
                return;
            }
            this.hideModal();
            this.showPreview(courses, semesterStart);
        } catch (error) {
            console.error('解析课程表失败', error);
            this.showToast?.('解析课程表时出现问题，请检查文件格式', 'error');
        }
    }

    showPreview(courses, semesterStart) {
        const previewContent = document.createElement('div');
        previewContent.classList.add('course-preview');
        const courseList = courses.map((course) => `
            <li>
                <strong>${course.name}</strong>
                <span>${course.day} ${course.startTime} - ${course.endTime}</span>
                <span>${course.location || '地点未填写'}</span>
                <span>周次：${course.weeks.join(', ')}</span>
            </li>
        `).join('');

        previewContent.innerHTML = `
            <p>共识别到 <strong>${courses.length}</strong> 条课程记录。是否将其导入日历？</p>
            <div class="course-preview-list">
                <ul>${courseList}</ul>
            </div>
        `;

        openModal({
            title: '课程表解析结果',
            content: previewContent,
            confirmText: '确认导入',
            cancelText: '取消',
            onConfirm: () => {
                const schedules = convertCoursesToSchedules(courses, semesterStart);
                this.calendarManager.addEvents(schedules, { silent: true });
                closeModal();
                this.showToast?.('课程表已添加到日历', 'success');
            },
            onCancel: () => closeModal()
        });
    }
}

function getNextWeekMonday() {
    const now = new Date();
    const day = now.getDay();
    const diff = (8 - day) % 7 || 7;
    const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    return nextMonday.toISOString().slice(0, 10);
}

function parseXLSFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function extractCourses(jsonData) {
    if (!Array.isArray(jsonData) || jsonData.length < 4) return [];

    const courses = [];
    const headerRow = jsonData[2] || [];
    const daysOfWeek = headerRow.slice(1, 8);

    const timeSlots = {
        '1': { start: '08:00', end: '08:45' },
        '2': { start: '08:50', end: '09:35' },
        '3': { start: '09:50', end: '10:35' },
        '4': { start: '10:40', end: '11:25' },
        '5': { start: '11:30', end: '12:15' },
        '6': { start: '13:00', end: '13:45' },
        '7': { start: '13:50', end: '14:35' },
        '8': { start: '14:45', end: '15:30' },
        '9': { start: '15:40', end: '16:25' },
        '10': { start: '16:35', end: '17:20' },
        '11': { start: '17:25', end: '18:10' },
        '12': { start: '18:30', end: '19:15' },
        '13': { start: '19:20', end: '20:05' },
        '14': { start: '20:10', end: '20:55' }
    };

    for (let rowIndex = 3; rowIndex < jsonData.length; rowIndex += 1) {
        const row = jsonData[rowIndex];
        if (!row || row.length === 0) continue;

        const slotCell = row[0];
        if (!slotCell || typeof slotCell !== 'string') continue;
        const slotNumber = slotCell.split('\n')[0]?.trim();
        if (!timeSlots[slotNumber]) continue;

        for (let dayIndex = 1; dayIndex <= 7; dayIndex += 1) {
            const cell = row[dayIndex];
            if (!cell || typeof cell !== 'string') continue;
            const segments = cell.split('\n').map((item) => item.trim()).filter(Boolean);
            if (segments.length < 3) continue;

            const courseName = segments[0];
            const teacher = segments[1];
            const location = segments[segments.length - 2];
            const weekInfo = segments[segments.length - 3];
            const weeks = extractWeeks(weekInfo);

            courses.push({
                name: courseName,
                teacher,
                location,
                day: daysOfWeek[dayIndex - 1] || `星期${dayIndex}`,
                startTime: timeSlots[slotNumber].start,
                endTime: timeSlots[slotNumber].end,
                weeks
            });
        }
    }

    return courses;
}

function extractWeeks(weekString = '') {
    const pattern = /(\d+)(?:-(\d+))?/g;
    const matches = [];
    let match;
    while ((match = pattern.exec(weekString)) !== null) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : start;
        for (let week = start; week <= end; week += 1) {
            if (/单周/.test(weekString) && week % 2 === 0) continue;
            if (/双周/.test(weekString) && week % 2 === 1) continue;
            matches.push(week);
        }
    }
    return [...new Set(matches)].sort((a, b) => a - b);
}

function convertCoursesToSchedules(courses, semesterStart) {
    const schedules = [];
    const baseDate = new Date(semesterStart);
    const dayMap = {
        '星期一': 0,
        '星期二': 1,
        '星期三': 2,
        '星期四': 3,
        '星期五': 4,
        '星期六': 5,
        '星期日': 6
    };

    courses.forEach((course) => {
        const dayIndex = dayMap[course.day] ?? 0;
        const [startHour, startMinute] = course.startTime.split(':').map(Number);
        const [endHour, endMinute] = course.endTime.split(':').map(Number);

        course.weeks.forEach((week) => {
            const startDate = new Date(baseDate);
            startDate.setDate(baseDate.getDate() + (week - 1) * 7 + dayIndex);
            startDate.setHours(startHour, startMinute, 0, 0);

            const endDate = new Date(startDate);
            endDate.setHours(endHour, endMinute, 0, 0);

            schedules.push({
                title: course.name,
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                allDay: false,
                notes: course.teacher ? `授课教师：${course.teacher}` : '',
                location: course.location || '',
                recurrence: '不重复',
                source: '课程表导入',
                originalInput: '课程表导入'
            });
        });
    });

    return schedules;
}
