const modal = document.getElementById('customModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalConfirm = document.getElementById('modalConfirm');
const modalCancel = document.getElementById('modalCancel');
const modalCloseButtons = document.querySelectorAll('[data-modal-close]');

let confirmHandler = null;
let cancelHandler = null;

modalCloseButtons.forEach((btn) => {
    btn.addEventListener('click', () => closeModal());
});

modal.addEventListener('click', (event) => {
    if (event.target === modal) {
        closeModal();
    }
});

modalCancel.addEventListener('click', () => {
    if (cancelHandler) cancelHandler();
    closeModal();
});

modalConfirm.addEventListener('click', () => {
    if (confirmHandler) confirmHandler();
});

export function openModal({ title, content, confirmText = '确认', cancelText = '取消', onConfirm = null, onCancel = null, hideConfirm = false }) {
    modalTitle.textContent = title;
    setModalBody(content);

    confirmHandler = onConfirm;
    cancelHandler = onCancel;

    modalConfirm.textContent = confirmText;
    modalCancel.textContent = cancelText;

    modalConfirm.style.display = hideConfirm ? 'none' : 'inline-flex';
    modalCancel.style.display = cancelText ? 'inline-flex' : 'none';

    modal.setAttribute('aria-hidden', 'false');
    modal.focus({ preventScroll: true });
}

export function closeModal() {
    confirmHandler = null;
    cancelHandler = null;
    modal.setAttribute('aria-hidden', 'true');
}

export function setModalBody(content) {
    modalBody.innerHTML = '';
    if (typeof content === 'string') {
        modalBody.innerHTML = content;
    } else if (content instanceof Node) {
        modalBody.appendChild(content);
    }
}
