// 在文件开头添加导入语句
// import { parseXLSFile, processUploadedCourses } from './courseSchedule.js';

let notificationDate = new Date(); // 默认为当前日期
let calendar;
let isMemoryModeEnabled = true;

document.addEventListener('DOMContentLoaded', () => {
    initializeCalendar();
    // ... 其他初始化代码 ...

    const memoryModeToggle = document.getElementById('memoryModeToggle');
    if (memoryModeToggle) {
        memoryModeToggle.addEventListener('change', toggleMemoryMode);
        // 初始化时检查本地存储中的设置
        const savedMemoryMode = localStorage.getItem('memoryModeEnabled');
        if (savedMemoryMode !== null) {
            isMemoryModeEnabled = JSON.parse(savedMemoryMode);
            memoryModeToggle.checked = isMemoryModeEnabled;
        }
    } else {
        console.error('记忆模式开关未找到');
    }

    // 如果记忆模式开启，则加载保存的事件
    if (isMemoryModeEnabled) {
        loadEvents();
    }

    // 添加课程表按钮的事件监听器
    const addCourseScheduleBtn = document.getElementById('addCourseScheduleBtn');
    if (addCourseScheduleBtn) {
        addCourseScheduleBtn.addEventListener('click', showUploadModal);
    } else {
        console.error('添加课程表按钮未找到');
    }

    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            window.location.href = 'settings.html';
        });
    } else {
        console.error('设置按钮未找到');
    }

    // 添加检查登录状态的函数
    function checkLoginStatus() {
        const isLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
        // 这里可以根据登录状态来显示或隐藏某些元素
        console.log('用户登录状态:', isLoggedIn);
    }

    // 在页面加载时检查登录状态
    checkLoginStatus();
});

function initializeCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            views: {
                dayGridMonth: { buttonText: '月' },
                timeGridWeek: { buttonText: '周' },
                timeGridDay: { buttonText: '日' }
            },
            locale: 'zh-cn',
            editable: true,
            selectable: true,
            events: loadEvents(), // 确保事件数据正确加载
            displayEventTime: true,
            eventTimeFormat: {
                hour: 'numeric',
                minute: '2-digit',
                meridiem: 'short'
            },
            nowIndicator: true,
            eventDidMount: function(info) {
                // 处理多日事件
                if (info.event.end) {
                    const days = Math.ceil((info.event.end - info.event.start) / (1000 * 60 * 60 * 24));
                    if (days > 1) {
                        info.el.style.gridColumn = `span ${days}`;
                        info.el.style.width = '100%';
                    }
                }
            },
            eventContent: function(arg) {
                let content = arg.event.title;
                if (arg.event.allDay) {
                    return { html: `<div class="fc-event-main-frame"><div class="fc-event-title-container"><div class="fc-event-title fc-sticky">${content}</div></div></div>` };
                }
                return { html: `<div class="fc-event-main"><div class="fc-event-title">${content}</div></div>` };
            },
            datesSet: function(info) {
                setTimeout(() => {
                    scrollToCurrentTime(info.view.type);
                }, 0);
            }
        });
        calendar.render();
        console.log('Calendar initialized:', calendar);

        addCustomTimeIndicator();
    } else {
        console.error('Calendar element not found');
    }
}

const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const chatBox = document.getElementById('chatBox');

sendButton.addEventListener('click', processInput);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        processInput();
    }
});

// 在件开头添加以下函数
async function callAI(userInput) {
    if (typeof window.processUserInput === 'undefined') {
        console.error('processUserInput 函数未定义。请确保 aiAssistant.js 文件已正确加载。');
        throw new Error('AI 助手功能未正确加载');
    }
    try {
        const aiResponse = await window.processUserInput(userInput);
        console.log('AI响应:', aiResponse);
        return aiResponse;
    } catch (error) {
        console.error('调用AI时出错:', error);
        throw error;
    }
}

// 修改 processInput 函数
async function processInput() {
    notificationDate = new Date(); // 更新 notificationDate
    const input = userInput.value.trim();
    if (input) {
        updateChat(`用户输入: ${input}`);
        try {
            const aiResponse = await callAI(input);
            updateChat(`AI回复: ${aiResponse}`);
            const { schedules, reminders } = parseAIResponse(aiResponse, input);
            
            console.log('Parsed schedules:', schedules);
            console.log('Parsed reminders:', reminders);

            if (schedules.length > 0) {
                await showConfirmDialog(schedules);
                // 移除这里的 addEventToCalendar 调用
            } else {
                updateChat('无法从AI回复中提取完整的任务信息，请尝试更明确的表述。');
            }

            if (reminders.length > 0) {
                updateChat('提醒事项：');
                reminders.forEach(reminder => updateChat(`- ${reminder}`));
            }
        } catch (error) {
            console.error('处理输入时出错:', error);
            updateChat(`处理输入出错: ${error.message}。请尝试重新输入或联系管理员。`);
        }
        userInput.value = '';
    }
}

// 在文件顶部添这个函数
function getNextOccurrence(dayOfWeek, referenceDate = new Date()) {
    const daysUntilNext = (dayOfWeek + 7 - referenceDate.getDay()) % 7;
    const nextDate = new Date(referenceDate);
    nextDate.setDate(referenceDate.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext));
    return nextDate;
}

// 确保 parseAIResponse 函数正确实现
function parseAIResponse(aiResponse, originalInput) {
    try {
        // 移除可能存在的 Markdown 代码块标记
        let cleanResponse = aiResponse.replace(/```json\n?/, '').replace(/```\n?$/, '');
        
        // 尝试解析为JSON
        const jsonResponse = JSON.parse(cleanResponse);
        return parseJsonResponse(jsonResponse, originalInput);
    } catch (error) {
        console.error('解析AI响应时出错:', error);
        return { schedules: [], reminders: [] };
    }
}

// 修改 parseJsonResponse 函数
function parseJsonResponse(jsonResponse, originalInput) {
    const schedules = [];
    let reminders = [];

    if (jsonResponse.日程) {
        jsonResponse.日程.forEach(event => {
            const startDate = parseChineseDateTime(event.开始时间);
            if (startDate) {
                schedules.push({
                    title: event.待办事项,
                    start: startDate,
                    end: event.预计时长 !== '未知' ? calculateEndTime(startDate, event.预计时长) : null,
                    allDay: false,
                    recurrence: event.重复频率,
                    notes: event.备注,
                    isReminder: false,
                    originalInput: originalInput
                });
            } else {
                console.error('无效的日期时间:', event.开始时间);
            }
        });
    }

    if (jsonResponse.提醒事项) {
        reminders = jsonResponse.提醒事项;
    }

    console.log('解析后的日程:', schedules);
    console.log('解析后的提醒事项:', reminders);
    return { schedules, reminders };
}

// 修改 parseMarkdownResponse 函数
function parseMarkdownResponse(markdownResponse, originalInput) {
    const schedules = [];
    let reminders = [];
    let currentSchedule = null;

    const lines = markdownResponse.split('\n');
    for (const line of lines) {
        if (line.startsWith('### 日程')) {
            if (currentSchedule) {
                schedules.push(currentSchedule);
            }
            currentSchedule = {
                title: '',
                start: null,
                end: null,
                allDay: false,
                recurrence: '不重复',
                notes: '',
                isReminder: false,
                originalInput: originalInput // 添加原始输入
            };
        } else if (line.startsWith('1. 待办事项：')) {
            currentSchedule.title = line.substring('1. 待办事项：'.length).trim();
        } else if (line.startsWith('2. 开始时间：')) {
            currentSchedule.start = parseChineseDateTime(line.substring('2. 开始'.length).trim());
        } else if (line.startsWith('3. 预计时长：')) {
            const durationStr = line.substring('3. 预计时长：'.length).trim();
            if (durationStr !== '未知' && currentSchedule.start) {
                currentSchedule.end = calculateEndTime(currentSchedule.start, durationStr);
            }
        } else if (line.startsWith('4. 重复频率：')) {
            currentSchedule.recurrence = line.substring('4. 重复频率：'.length).trim();
        } else if (line.startsWith('5. 备注：')) {
            currentSchedule.notes = line.substring('5. 备注：'.length).trim();
        } else if (line.startsWith('### 提醒事项：')) {
            reminders.push(line.substring('### 提醒事项：'.length).trim());
        }
    }

    if (currentSchedule) {
        schedules.push(currentSchedule);
    }

    console.log('解析后的日程:', schedules);
    console.log('解析后的提醒事项:', reminders);
    return { schedules, reminders };
}

// 修改 parseChineseDateTime 函数
function parseChineseDateTime(dateTimeStr, referenceDate = new Date()) {
    if (!dateTimeStr) {
        console.warn('日期时间字符串为空');
        return null;
    }

    console.log('正在解析日期时间:', dateTimeStr);

    // 直接解析 AI 返回的日期时间格式 (YYYY-MM-DD HH:mm)
    const dateTimeParts = dateTimeStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (dateTimeParts) {
        const [_, year, month, day, hour, minute] = dateTimeParts;
        const result = new Date(year, month - 1, day, hour, minute);
        console.log('解析后的日期时间:', result);
        return result;
    }

    // 如果上面的格式不匹配，尝试解析 "YYYY年MM月DD日 HH:mm" 格式
    const chineseDateTimeParts = dateTimeStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/);
    if (chineseDateTimeParts) {
        const [_, year, month, day, hour, minute] = chineseDateTimeParts;
        const result = new Date(year, month - 1, day, hour, minute);
        console.log('解析后的日期时间:', result);
        return result;
    }

    console.error('无法解析日期时间:', dateTimeStr);
    return null;
}

// 添加 calculateEndTime 函数（如果还没有的话）
function calculateEndTime(startTime, duration) {
    if (!startTime || !duration) {
        console.warn('计算结束时间失败: 开始时间或持续时间无效');
        return null;
    }

    const durationMatch = duration.match(/(\d+)\s*(小时|分钟)/);
    if (durationMatch) {
        const amount = parseInt(durationMatch[1]);
        const unit = durationMatch[2];
        const durationInMinutes = unit === '小时' ? amount * 60 : amount;
        return new Date(startTime.getTime() + durationInMinutes * 60000);
    }

    console.warn(`无法解析持续时间: ${duration}`);
    return null;
}

// 修改 showConfirmDialog 函数
async function showConfirmDialog(schedules) {
    console.log('Schedules to confirm:', schedules);
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const confirmBtn = document.getElementById('modalConfirm');
        const cancelBtn = document.getElementById('modalCancel');

        modalTitle.textContent = '确认添加任务';
        
        let bodyContent = '<div style="max-height: 400px; overflow-y: auto;">';
        schedules.forEach((taskInfo, index) => {
            bodyContent += `
                <div style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px;">
                    <h3>${taskInfo.isReminder ? '提醒事项' : '日程'} ${index + 1}</h3>
                    <p><strong>标题:</strong> ${taskInfo.title}</p>
                    <p><strong>开始时间:</strong> ${taskInfo.start ? taskInfo.start.toLocaleString() : '未指定'}</p>
                    <p><strong>结束时间:</strong> ${taskInfo.end ? taskInfo.end.toLocaleString() : '未指定'}</p>
                    <p><strong>重复频率:</strong> ${taskInfo.recurrence}</p>
                    <p><strong>备注:</strong> ${taskInfo.notes}</p>
                    <label>
                        <input type="checkbox" class="schedule-checkbox" checked> 添加此${taskInfo.isReminder ? '提醒' : '日程'}
                    </label>
                </div>
            `;
        });
        bodyContent += '</div>';
        
        modalBody.innerHTML = bodyContent;

        modal.style.display = 'block';

        // 确保确认按钮可见
        confirmBtn.style.display = 'inline-block';
        confirmBtn.textContent = '确认';

        confirmBtn.onclick = function() {
            const selectedSchedules = [];
            const checkboxes = modalBody.querySelectorAll('.schedule-checkbox');
            checkboxes.forEach((checkbox, index) => {
                if (checkbox.checked) {
                    selectedSchedules.push(schedules[index]);
                }
            });
            modal.style.display = 'none';
            
            console.log('Selected schedules:', selectedSchedules);
            
            selectedSchedules.forEach(taskInfo => {
                addEventToCalendar(taskInfo);
            });
            
            resolve(selectedSchedules);
        };

        cancelBtn.onclick = function() {
            modal.style.display = 'none';
            resolve([]);
        };

        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = 'none';
                resolve([]);
            }
        };
    });
}

// 修 addEventToCalendar 函数
function addEventToCalendar(taskInfo) {
    console.log('Adding event to calendar:', taskInfo);

    if (!taskInfo.start) {
        console.error('无效的开始时间:', taskInfo);
        updateChat(`添加日程失败：${taskInfo.title} - 无效的开始时间`);
        return;
    }

    const eventData = {
        title: taskInfo.title,
        start: taskInfo.start,
        end: taskInfo.end || null,
        allDay: taskInfo.allDay || false,
        extendedProps: {
            notes: taskInfo.notes,
            originalInput: taskInfo.originalInput
        }
    };

    if (taskInfo.rrule) {
        eventData.rrule = taskInfo.rrule;
    }

    console.log('Event data to be added:', eventData);

    try {
        const addedEvent = calendar.addEvent(eventData);
        console.log('Event added successfully:', addedEvent);
        calendar.render();
        if (isMemoryModeEnabled) saveEvents();
        updateChat(`已添加日程：${taskInfo.title}`);
    } catch (error) {
        console.error('Failed to add event:', error);
        updateChat(`添加日程失：${taskInfo.title}`);
    }
}

function getFrequency(recurrence) {
    switch (recurrence.toLowerCase()) {
        case '每天': return 'daily';
        case '每周': return 'weekly';
        case '每月': return 'monthly';
        case '每年': return 'yearly';
        default: return 'daily';
    }
}

function updateChat(message) {
    const chatMessage = document.createElement('p');
    chatMessage.textContent = message;
    chatBox.appendChild(chatMessage);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function addEventPrompt(start, end, allDay) {
    const modal = document.getElementById('customModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const confirmBtn = document.getElementById('modalConfirm');
    const cancelBtn = document.getElementById('modalCancel');

    modalTitle.textContent = '添加新事件';
    modalBody.innerHTML = `
        <input type="text" id="newEventTitle" placeholder="请入新事件的标题">
    `;

    modal.style.display = 'block';

    confirmBtn.onclick = function() {
        const title = document.getElementById('newEventTitle').value;
        if (title) {
            calendar.addEvent({
                title: title,
                start: start,
                end: end,
                allDay: allDay
            });
        }
        modal.style.display = 'none';
        calendar.unselect();
    };

    cancelBtn.onclick = function() {
        modal.style.display = 'none';
        calendar.unselect();
    };

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
            calendar.unselect();
        }
    };
}

// 修 showEventDetails 函数
function showEventDetails(event) {
    const modal = document.getElementById('customModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const confirmBtn = document.getElementById('modalConfirm');
    const cancelBtn = document.getElementById('modalCancel');

    modalTitle.textContent = event.title;
    modalBody.innerHTML = `
        <div class="event-details">
            <p><i class="fas fa-clock"></i> <strong>开始时间:</strong> ${event.start.toLocaleString()}</p>
            <p><i class="fas fa-hourglass-end"></i> <strong>结束时间:</strong> ${event.end ? event.end.toLocaleString() : '未指定'}</p>
            <p><i class="fas fa-redo"></i> <strong>重复频率:</strong> ${event.rrule ? getRecurrenceText(event.rrule) : '不重复'}</p>
            <p><i class="fas fa-sticky-note"></i> <strong>备注:</strong> ${event.extendedProps.notes || '无'}</p>
        </div>
        <div class="original-input-container">
            <button id="toggleOriginalInput" class="toggle-btn"><i class="fas fa-file-alt"></i> 显示原文</button>
            <div id="originalInputText" class="original-input-text" style="display: none;">
                <p>${event.extendedProps.originalInput || '无原始输入'}</p>
            </div>
        </div>
        <button id="deleteEventBtn" class="delete-btn"><i class="fas fa-trash-alt"></i> 删除此事件</button>
    `;

    modal.style.display = 'block';

    const toggleOriginalInput = document.getElementById('toggleOriginalInput');
    const originalInputText = document.getElementById('originalInputText');
    const deleteEventBtn = document.getElementById('deleteEventBtn');

    if (toggleOriginalInput) {
        toggleOriginalInput.onclick = function() {
            if (originalInputText.style.display === 'none') {
                originalInputText.style.display = 'block';
                this.innerHTML = '<i class="fas fa-file-alt"></i> 隐藏原文';
            } else {
                originalInputText.style.display = 'none';
                this.innerHTML = '<i class="fas fa-file-alt"></i> 显示原文';
            }
        };
    }

    if (deleteEventBtn) {
        deleteEventBtn.onclick = function() {
            const confirmed = confirm('您确定要除此事件吗？');
            if (confirmed) {
                event.remove();
                updateChat(`已删除事件：${event.title}`);
                modal.style.display = 'none';
            }
        };
    }

    confirmBtn.style.display = 'none';
    cancelBtn.textContent = '关闭';

    cancelBtn.onclick = function() {
        modal.style.display = 'none';
    };

    window.onclick = function(e) {
        if (e.target == modal) {
            modal.style.display = 'none';
        }
    };
}

function getRecurrenceText(rrule) {
    switch (rrule.freq) {
        case 'daily':
            return '每天';
        case 'weekly':
            return '每周';
        case 'monthly':
            return '每月';
        case 'yearly':
            return '每年';
        default:
            return '自定义';
    }
}

// 加入样式模板功能
window.setInput = function(sample) {
    userInput.value = sample;
}

function showUploadModal() {
    const modal = document.getElementById('uploadModal');
    const fileInput = document.getElementById('xlsFileInput');
    const uploadBtn = document.getElementById('uploadFileBtn');
    const cancelBtn = document.getElementById('cancelUploadBtn');

    modal.style.display = 'block';

    uploadBtn.onclick = function() {
        const file = fileInput.files[0];
        if (file) {
            window.parseXLSFile(file).then(jsonData => {
                const parseResult = window.processUploadedCourses(jsonData);
                hideAllModals(); // 关闭上传模态框
                showParseResult(parseResult);
            });
        } else {
            alert('请选择一个文件');
        }
    };

    cancelBtn.onclick = hideAllModals;

    window.onclick = function(event) {
        if (event.target == modal) {
            hideAllModals();
        }
    };
}

function showParseResult(parseResult) {
    const modalContent = document.createElement('div');
    modalContent.innerHTML = `
        <h3>解析结果</h3>
        <p>共解析到 ${parseResult.coursesCount} 门课程：</p>
        <div style="max-height: 300px; overflow-y: auto;">
            <ul>
                ${parseResult.coursesList.map(course => `
                    <li>
                        ${course.name} - 
                        ${course.day} 
                        ${course.time}
                        ${course.location}
                        (第${course.weeks}周)
                    </li>
                `).join('')}
            </ul>
        </div>
        <p>是否确认添加这些课程到日历？</p>
    `;

    showCustomModal(
        '课程表解析结果',
        modalContent,
        () => {
            const events = window.convertToCalendarEvents(parseResult.coursesList);
            events.forEach(event => calendar.addEvent(event));
            calendar.render();
            if (isMemoryModeEnabled) saveEvents();
            hideAllModals();
            updateChat('课程表已成功添加');
        },
        hideAllModals
    );
}

function showCustomModal(title, content, onConfirm, onCancel) {
    const modal = document.getElementById('customModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const confirmBtn = document.getElementById('modalConfirm');
    const cancelBtn = document.getElementById('modalCancel');

    modalTitle.textContent = title;
    modalBody.innerHTML = '';
    modalBody.appendChild(content);

    // 确保确认按钮可见
    confirmBtn.style.display = 'inline-block';
    confirmBtn.textContent = '确认';

    confirmBtn.onclick = () => {
        onConfirm();
        modal.style.display = 'none';
    };
    cancelBtn.onclick = () => {
        onCancel();
        modal.style.display = 'none';
    };

    modal.style.display = 'block';
}

function hideAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => modal.style.display = 'none');
}

// 修改 saveEvents 函数
function saveEvents() {
    if (isMemoryModeEnabled) {
        const events = calendar.getEvents().map(event => ({
            title: event.title,
            start: event.start.toISOString(),
            end: event.end ? event.end.toISOString() : null,
            allDay: event.allDay,
            extendedProps: event.extendedProps
        }));
        localStorage.setItem('calendarEvents', JSON.stringify(events));
    }
}

// 修改 loadEvents 函数
function loadEvents() {
    const savedEvents = localStorage.getItem('calendarEvents');
    if (savedEvents) {
        return JSON.parse(savedEvents).map(event => ({
            title: event.title,
            start: new Date(event.start),
            end: event.end ? new Date(event.end) : null,
            allDay: event.allDay,
            extendedProps: event.extendedProps
        }));
    }
    return [];
}

function toggleMemoryMode() {
    isMemoryModeEnabled = !isMemoryModeEnabled;
    localStorage.setItem('memoryModeEnabled', JSON.stringify(isMemoryModeEnabled));
    
    if (isMemoryModeEnabled) {
        saveEvents();
    } else {
        localStorage.removeItem('calendarEvents');
    }
}

// 确保 isValidDate 函数存在
function isValidDate(date) {
    return date instanceof Date && !isNaN(date);
}

function openSettings() {
    // 这里可以添加跳转到设置页面的逻辑
    // 暂时使用 alert 来模拟
    alert('设置页面正在开发中，敬请期待！');
    // 未来可以使用以下代码跳转到设置页面
    // window.location.href = 'settings.html';
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();
        if (response.ok) {
            alert(data.message);
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('注册错误:', error);
        alert('注册失败，请稍后重试');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            alert(data.message);
            document.getElementById('logoutButton').style.display = 'block';
            checkLoginStatus();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('登录错误:', error);
        alert('登录失败，请稍后重试');
    }
}

// 在文件末尾添加以下代码

document.addEventListener('DOMContentLoaded', function() {
    const toggleChatBtn = document.getElementById('toggleChatBtn');
    const container = document.querySelector('.container');
    const scheduleDiv = document.querySelector('.schedule');
    const calendarEl = document.getElementById('calendar');

    toggleChatBtn.addEventListener('click', function() {
        container.classList.toggle('chat-hidden');
        
        // 给浏览器一点时间来应用 CSS 变化
        setTimeout(() => {
            if (calendar) {
                calendar.updateSize();
                
                // 调整日历的宽高比
                if (container.classList.contains('chat-hidden')) {
                    const width = calendarEl.offsetWidth;
                    calendarEl.style.height = `${width * 0.75}px`; // 设置高度为宽度的 75%
                } else {
                    calendarEl.style.height = ''; // 恢复原始高度
                }
                
                calendar.render();
            }
        }, 500);  // 500ms 与 CSS 过渡时间相匹配
    });

    // 监听窗口大小变化
    window.addEventListener('resize', function() {
        if (calendar) {
            calendar.updateSize();
            
            // 在窗口大小变化时也调整日历的宽高比
            if (container.classList.contains('chat-hidden')) {
                const width = calendarEl.offsetWidth;
                calendarEl.style.height = `${width * 0.75}px`;
                calendar.render();
            }
        }
    });
});

const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);

function openSettings() {
    settingsPanel.classList.add('show');
}

function closeSettings() {
    settingsPanel.classList.remove('show');
}

// 点击面板外部关闭设置
document.addEventListener('click', (e) => {
    if (settingsPanel.classList.contains('show') && 
        !settingsPanel.contains(e.target) && 
        e.target !== settingsBtn) {
        closeSettings();
    }
});

// 更新记忆模式开关的处理
const memoryModeToggle = document.getElementById('memoryModeToggle');
memoryModeToggle.addEventListener('change', () => {
    isMemoryModeEnabled = memoryModeToggle.checked;
    localStorage.setItem('memoryModeEnabled', isMemoryModeEnabled);
    if (isMemoryModeEnabled) {
        saveEvents();
    } else {
        localStorage.removeItem('calendarEvents');
    }
});

// 在页面加载时初始化记忆模式状态
document.addEventListener('DOMContentLoaded', () => {
    const savedMemoryMode = localStorage.getItem('memoryModeEnabled');
    if (savedMemoryMode !== null) {
        isMemoryModeEnabled = JSON.parse(savedMemoryMode);
        memoryModeToggle.checked = isMemoryModeEnabled;
    }
});

