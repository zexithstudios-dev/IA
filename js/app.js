/**
 * app.js
 * Lógica de interfaz. Depende de storage.js (debe cargarse antes en el HTML).
 */

// Íconos SVG inline: no dependen de ninguna fuente/CDN externa, siempre se ven.
const ICONS = {
    pencil: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>`,
    trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
    fileText: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
    x: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
};

let CHAR_LIMIT = 4000;         // límite real del textarea (configurable en Settings)
let LINE_THRESHOLD = 300;      // a partir de cuántas líneas se convierte en adjunto (configurable)
let CHAR_THRESHOLD = 1200;     // idem pero por caracteres (configurable indirectamente)

let activeProjectId = null;
let activeAttachment = null; // { name, lineCount, content } o null

const promptInput = document.getElementById('prompt-input');
const charCounter = document.getElementById('char-counter');
const projectList = document.getElementById('project-list');
const emptyState = document.getElementById('empty-state');
const attachmentZone = document.getElementById('attachment-zone');

// ---------- Contador de caracteres (real, no decorativo) ----------

function updateCharCount() {
    const length = promptInput.value.length;
    charCounter.innerText = `${length} / ${CHAR_LIMIT}`;

    if (length >= CHAR_LIMIT) {
        charCounter.className = "text-[10px] text-red-500 font-semibold";
    } else if (length > CHAR_LIMIT * 0.9) {
        charCounter.className = "text-[10px] text-amber-500 font-semibold";
    } else {
        charCounter.className = "text-[10px] text-zinc-600 font-medium";
    }
}

// Bloquea que se pueda escribir más allá del límite (typing manual)
// Y ademas: red de seguridad -> si por cualquier motivo (paste bloqueado por el navegador,
// drag&drop, etc.) entra texto muy largo directo al textarea, lo convertimos en adjunto igual.
promptInput.addEventListener('input', () => {
    const value = promptInput.value;
    const lineCount = value.split(/\r\n|\r|\n/).length;

    if (lineCount > LINE_THRESHOLD || value.length > CHAR_THRESHOLD) {
        attachPastedText(value, lineCount);
        promptInput.value = '';
        updateCharCount();
        return;
    }

    if (value.length > CHAR_LIMIT) {
        promptInput.value = value.slice(0, CHAR_LIMIT);
    }
    updateCharCount();
    persistActivePrompt();
});

// ---------- Pegado largo -> se convierte en "adjunto" (como en Claude) ----------

promptInput.addEventListener('paste', (e) => {
    const clipboard = e.clipboardData || window.clipboardData;
    if (!clipboard) return; // por si el navegador no expone clipboardData, dejamos pegar normal

    // Fallback: algunos navegadores/contextos solo exponen 'text/plain', no 'text' genérico
    const pasted = clipboard.getData('text/plain') || clipboard.getData('text') || '';
    if (!pasted) return;

    const lineCount = pasted.split(/\r\n|\r|\n/).length;

    if (lineCount > LINE_THRESHOLD || pasted.length > CHAR_THRESHOLD) {
        e.preventDefault();
        e.stopPropagation();
        attachPastedText(pasted, lineCount);
    }
    // si es corto, se deja pegar normal y el listener de 'input' se encarga del límite del textarea
});

// El adjunto NO tiene límite de tamaño: se guarda completo, sin truncar.
function attachPastedText(content, lineCount) {
    activeAttachment = {
        name: `pasted-text-${lineCount}-lines.txt`,
        lineCount,
        charCount: content.length,
        content
    };
    renderAttachment();
    persistActiveAttachment();
}

function renderAttachment() {
    attachmentZone.innerHTML = '';
    if (!activeAttachment) return;

    const pill = document.createElement('div');
    pill.className = 'attachment-pill';
    const label = `Texto pegado · ${activeAttachment.lineCount} líneas · ${activeAttachment.charCount || activeAttachment.content.length} caracteres`;
    pill.innerHTML = `
        ${ICONS.fileText}
        <span>${escapeHtml(label)}</span>
        <span class="remove-attachment" title="Quitar adjunto">
            ${ICONS.x}
        </span>
    `;
    pill.querySelector('.remove-attachment').onclick = () => {
        activeAttachment = null;
        renderAttachment();
        persistActiveAttachment();
    };
    attachmentZone.appendChild(pill);
}

// ---------- Proyectos: crear, seleccionar, renombrar, borrar ----------

function loadProjectsFromStorage() {
    projectList.innerHTML = '';
    const projects = ForgeStorage.getAll();

    if (projects.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }
    emptyState.style.display = 'none';
    projects.forEach(renderProjectItem);

    // selecciona el último proyecto usado, o el primero
    selectProject(projects[projects.length - 1].id);
}

function renderProjectItem(project) {
    const item = document.createElement('div');
    item.dataset.id = project.id;
    item.className = "flex items-center justify-between group px-2.5 py-2 rounded-md hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 text-xs font-medium cursor-pointer border border-transparent";
    item.innerHTML = `
        <div class="flex items-center gap-2 min-w-0 flex-1" data-role="label-wrap">
            <svg class="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span class="truncate" data-role="label">${escapeHtml(project.name)}</span>
        </div>
        <div class="project-actions shrink-0">
            <button data-role="rename" title="Renombrar" aria-label="Renombrar proyecto">${ICONS.pencil}</button>
            <button data-role="delete" title="Eliminar" aria-label="Eliminar proyecto">${ICONS.trash}</button>
        </div>
    `;

    item.querySelector('[data-role="label-wrap"]').onclick = () => selectProject(project.id);
    item.querySelector('[data-role="rename"]').onclick = (e) => {
        e.stopPropagation();
        startRename(item, project.id);
    };
    item.querySelector('[data-role="delete"]').onclick = (e) => {
        e.stopPropagation();
        deleteProject(project.id);
    };
    item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, item, project.id);
    });

    projectList.appendChild(item);
}

// ---------- Menú contextual (click derecho) ----------

let contextMenuEl = null;

function openContextMenu(x, y, item, projectId) {
    closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <button data-action="rename">${ICONS.pencil}<span>${I18n.t('contextMenu.rename')}</span></button>
        <button data-action="delete" class="danger">${ICONS.trash}<span>${I18n.t('contextMenu.delete')}</span></button>
    `;
    document.body.appendChild(menu);

    // Posicionar sin salirse de la ventana
    const menuWidth = 160;
    const menuHeight = 76;
    const left = Math.min(x, window.innerWidth - menuWidth - 8);
    const top = Math.min(y, window.innerHeight - menuHeight - 8);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    requestAnimationFrame(() => menu.classList.add('open'));

    menu.querySelector('[data-action="rename"]').onclick = () => {
        closeContextMenu();
        selectProject(projectId);
        startRename(item, projectId);
    };
    menu.querySelector('[data-action="delete"]').onclick = () => {
        closeContextMenu();
        deleteProject(projectId);
    };

    contextMenuEl = menu;

    setTimeout(() => {
        document.addEventListener('click', closeContextMenu, { once: true });
        document.addEventListener('contextmenu', closeContextMenu, { once: true });
    }, 0);
}

function closeContextMenu() {
    if (contextMenuEl) {
        contextMenuEl.remove();
        contextMenuEl = null;
    }
}

function startRename(item, id) {
    const labelWrap = item.querySelector('[data-role="label-wrap"]');
    const label = item.querySelector('[data-role="label"]');
    const currentName = label.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'project-name-input';

    labelWrap.replaceChild(input, label);
    input.focus();
    input.select();

    const commit = () => {
        const newName = input.value.trim() || currentName;
        ForgeStorage.update(id, { name: newName });
        label.textContent = newName;
        if (labelWrap.contains(input)) labelWrap.replaceChild(label, input);
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { input.value = currentName; input.blur(); }
    });
    input.addEventListener('blur', commit);
}

function deleteProject(id) {
    const project = ForgeStorage.getById(id);
    showConfirmModal({
        title: I18n.t('confirmModal.deleteTitle'),
        message: I18n.t('confirmModal.deleteMessage', project ? project.name : 'this project'),
        confirmLabel: I18n.t('confirmModal.deleteConfirm'),
        onConfirm: () => {
            ForgeStorage.remove(id);
            const item = projectList.querySelector(`[data-id="${id}"]`);
            if (item) item.remove();

            if (activeProjectId === id) {
                activeProjectId = null;
                const remaining = ForgeStorage.getAll();
                if (remaining.length > 0) {
                    selectProject(remaining[remaining.length - 1].id);
                } else {
                    emptyState.style.display = 'flex';
                    promptInput.value = '';
                    activeAttachment = null;
                    renderAttachment();
                    updateCharCount();
                }
            }
        }
    });
}

// ---------- Modal de confirmación personalizado (reemplaza confirm() nativo) ----------

function showConfirmModal({ title, message, confirmLabel = 'Confirmar', onConfirm }) {
    const overlay = document.getElementById('confirm-modal-overlay');
    const modal = document.getElementById('confirm-modal');

    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    const confirmBtn = document.getElementById('confirm-modal-confirm');
    confirmBtn.textContent = confirmLabel;

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        overlay.classList.add('opacity-100');
        modal.classList.remove('scale-95', 'opacity-0');
    });

    function close() {
        overlay.classList.remove('opacity-100');
        modal.classList.add('scale-95', 'opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 150);
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        overlay.removeEventListener('click', handleOverlayClick);
        document.removeEventListener('keydown', handleKeydown);
    }

    function handleConfirm() {
        close();
        onConfirm && onConfirm();
    }
    function handleCancel() { close(); }
    function handleOverlayClick(e) {
        if (e.target === overlay) close();
    }
    function handleKeydown(e) {
        if (e.key === 'Escape') close();
        if (e.key === 'Enter') handleConfirm();
    }

    const cancelBtn = document.getElementById('confirm-modal-cancel');
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', handleOverlayClick);
    document.addEventListener('keydown', handleKeydown);
}

function selectProject(id) {
    activeProjectId = id;
    const project = ForgeStorage.getById(id);
    if (!project) return;

    document.querySelectorAll('#project-list > div').forEach(el => {
        el.classList.remove('bg-zinc-800/40', 'text-zinc-100', 'border-zinc-800/40');
        el.classList.add('border-transparent');
        const icon = el.querySelector('svg');
        if (icon) icon.classList.remove('text-purple-400');
        if (icon) icon.classList.add('text-zinc-500');
    });

    const activeItem = projectList.querySelector(`[data-id="${id}"]`);
    if (activeItem) {
        activeItem.classList.add('bg-zinc-800/40', 'text-zinc-100', 'border-zinc-800/40');
        activeItem.classList.remove('border-transparent');
        const icon = activeItem.querySelector('svg');
        if (icon) { icon.classList.remove('text-zinc-500'); icon.classList.add('text-purple-400'); }
    }

    promptInput.value = project.prompt || '';
    activeAttachment = project.attachment || null;
    renderAttachment();
    updateCharCount();
}

function createNewProject() {
    const projects = ForgeStorage.getAll();
    const project = ForgeStorage.create(`Untitled Prompt ${projects.length + 1}`);
    emptyState.style.display = 'none';
    renderProjectItem(project);
    selectProject(project.id);
    promptInput.focus();
}

// ---------- Persistencia mientras se escribe ----------

let saveTimeout = null;
function flashAutosave() {
    const dot = document.getElementById('autosave-dot');
    if (!dot) return;
    dot.classList.add('saved');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => dot.classList.remove('saved'), 900);
}

function persistActivePrompt() {
    if (!activeProjectId) return;
    ForgeStorage.update(activeProjectId, { prompt: promptInput.value });
    flashAutosave();
}

function persistActiveAttachment() {
    if (!activeProjectId) return;
    ForgeStorage.update(activeProjectId, { attachment: activeAttachment });
    flashAutosave();
}

// ---------- Ejecutar (simulado) ----------

function simulateExecution() {
    const toast = document.getElementById('toast-notif');

    if (promptInput.value.trim() === "" && !activeAttachment) {
        promptInput.placeholder = I18n.t('main.placeholderEmpty');
        promptInput.focus();
        return;
    }

    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(8px)";
    }, 3000);
}

// ---------- Utilidad ----------

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ---------- Settings ----------

function openSettings() {
    const overlay = document.getElementById('settings-modal-overlay');
    const modal = document.getElementById('settings-modal');

    document.getElementById('settings-language').value = I18n.current;

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        overlay.classList.add('opacity-100');
        modal.classList.remove('scale-95', 'opacity-0');
    });
}

function closeSettings() {
    const overlay = document.getElementById('settings-modal-overlay');
    const modal = document.getElementById('settings-modal');
    overlay.classList.remove('opacity-100');
    modal.classList.add('scale-95', 'opacity-0');
    setTimeout(() => overlay.classList.add('hidden'), 150);
}

function clearAllData() {
    showConfirmModal({
        title: I18n.t('settings.clearTitle'),
        message: I18n.t('settings.clearMessage'),
        confirmLabel: I18n.t('settings.clearConfirm'),
        onConfirm: () => {
            ForgeStorage.saveAll([]);
            activeProjectId = null;
            activeAttachment = null;
            loadProjectsFromStorage();
            promptInput.value = '';
            renderAttachment();
            updateCharCount();
            closeSettings();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('settings-language').addEventListener('change', (e) => {
        I18n.setLanguage(e.target.value);
    });

    document.getElementById('settings-modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'settings-modal-overlay') closeSettings();
    });
});

// ---------- Init ----------

document.addEventListener('DOMContentLoaded', () => {
    I18n.init();
    loadProjectsFromStorage();
    updateCharCount();
});
