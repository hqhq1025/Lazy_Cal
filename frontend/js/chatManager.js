import { processUserInput } from './assistantApi.js';
import { parseAIResponse } from './parsers.js';
import { openModal, closeModal } from './modal.js';
import { loadReminders, saveReminders } from './storage.js';

export class ChatManager {
    constructor({ calendarManager, showToast, onRemindersUpdate }) {
        this.calendarManager = calendarManager;
        this.showToast = showToast;
        this.onRemindersUpdate = onRemindersUpdate;

        this.chatBox = document.getElementById('chatBox');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.sampleButtons = document.querySelectorAll('[data-example]');
        this.reminderList = document.getElementById('reminderList');

        this.reminders = loadReminders();

        this.bindEvents();
        this.renderReminders();
        this.appendMessage('ai', '您好！我是 Lazy Cal 智能助手，请告诉我您要安排的事情或提醒。');
    }

    bindEvents() {
        this.sendButton?.addEventListener('click', () => this.processInput());
        this.userInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.processInput();
            }
        });
        this.sampleButtons?.forEach((button) => {
            button.addEventListener('click', () => {
                if (!this.userInput) return;
                this.userInput.value = button.dataset.example;
                this.userInput.focus();
            });
        });
    }

    appendMessage(sender, text) {
        if (!this.chatBox) return;
        const message = document.createElement('div');
        message.classList.add('message', sender);
        message.innerHTML = `<strong>${sender === 'ai' ? 'AI 助手' : '您'}:</strong> ${escapeHtml(text)}`;
        this.chatBox.appendChild(message);
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }

    async processInput() {
        const inputValue = this.userInput?.value.trim();
        if (!inputValue) return;

        this.appendMessage('user', inputValue);
        this.userInput.value = '';
        this.setInputDisabled(true);

        try {
            const aiResponse = await processUserInput(inputValue);
            this.appendMessage('ai', aiResponse);
            const { schedules, reminders } = parseAIResponse(aiResponse, inputValue);
            if (!schedules.length && !reminders.length) {
                this.showToast?.('AI 未识别到具体日程，请尝试更详细的描述', 'info');
                return;
            }
            this.openReviewModal({ schedules, reminders });
        } catch (error) {
            console.error('处理 AI 输入时出错', error);
            this.appendMessage('ai', '抱歉，我暂时无法处理该请求，请稍后再试。');
            this.showToast?.('调用 AI 助手失败，请检查网络后重试', 'error');
        } finally {
            this.setInputDisabled(false);
        }
    }

    setInputDisabled(disabled) {
        if (this.userInput) this.userInput.disabled = disabled;
        if (this.sendButton) this.sendButton.disabled = disabled;
    }

    openReviewModal({ schedules, reminders }) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('ai-review');
        let scheduleHtml = '';
        if (schedules.length) {
            scheduleHtml = `
                <section class="review-section">
                    <h3>识别到的日程</h3>
                    <ol>
                        ${schedules.map((schedule, index) => `
                            <li>
                                <strong>${schedule.title}</strong>
                                <span>${formatDateTime(schedule.start)}${schedule.end ? ` - ${formatDateTime(schedule.end)}` : ''}</span>
                                ${schedule.location ? `<span>地点：${schedule.location}</span>` : ''}
                                ${schedule.notes ? `<span>备注：${schedule.notes}</span>` : ''}
                                <span>重复：${schedule.recurrence}</span>
                            </li>
                        `).join('')}
                    </ol>
                </section>
            `;
        }

        let reminderHtml = '';
        if (reminders.length) {
            reminderHtml = `
                <section class="review-section">
                    <h3>识别到的提醒</h3>
                    <ul>
                        ${reminders.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </section>
            `;
        }

        wrapper.innerHTML = `${scheduleHtml}${reminderHtml}`;

        openModal({
            title: 'AI 助手识别结果',
            content: wrapper,
            confirmText: '确认添加',
            cancelText: '重新编辑',
            onConfirm: () => {
                if (schedules.length) {
                    this.calendarManager.addEvents(schedules);
                }
                if (reminders.length) {
                    this.mergeReminders(reminders);
                }
                closeModal();
            },
            onCancel: () => closeModal()
        });
    }

    mergeReminders(reminders = []) {
        const merged = [...this.reminders];
        reminders.forEach((item) => {
            if (!merged.includes(item)) {
                merged.push(item);
            }
        });
        this.reminders = merged;
        saveReminders(this.reminders);
        this.renderReminders();
        this.onRemindersUpdate?.(this.reminders);
        this.showToast?.('提醒事项已更新', 'success');
    }

    renderReminders() {
        if (!this.reminderList) return;
        this.reminderList.innerHTML = '';
        if (!this.reminders.length) {
            const empty = document.createElement('li');
            empty.classList.add('reminder-item');
            empty.textContent = '暂无提醒，试试告诉我一件需要记住的小事吧。';
            this.reminderList.appendChild(empty);
            return;
        }

        this.reminders.forEach((reminder) => {
            const item = document.createElement('li');
            item.classList.add('reminder-item');
            item.textContent = reminder;
            this.reminderList.appendChild(item);
        });

        this.onRemindersUpdate?.(this.reminders);
    }
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date)) return '时间未知';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}年${mm}月${dd}日 ${hh}:${min}`;
}
