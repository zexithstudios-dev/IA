/**
 * app.js v3
 * Claude-style model selector, Flux API, Forge reasoning, effort levels, thinking toggle
 */

// Íconos SVG inline
var ICONS = {
    pencil: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>',
    trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    fileText: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>',
    x: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    sparkle: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="M18 16l.75 2.25L21 19l-2.25.75L18 22l-.75-2.25L15 19l2.25-.75z"/></svg>',
    send: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-7-7l7 7-7 7"/></svg>'
};

var CHAR_LIMIT = 4000;
var LINE_THRESHOLD = 300;
var CHAR_THRESHOLD = 1200;

// API Keys
var GROQ_API_KEY = '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';
var GEMINI_API_KEY = 'AQ.Ab8RN6KCsWLRJVagK4Ps-h8OylHsGg84kovefwXmuLvvDrJteQ';
var FLUX_API_KEY = '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';

// State
var currentProvider = 'forge';   // forge | gemini | groq | flux
var currentVariant = 'dual';     // flash | pro | dual
var currentEffort = 'medium';    // low | medium | high | extra | max
var thinkingEnabled = false;

var activeProjectId = null;
var activeAttachment = null;
var activeConversationMessages = [];
var isProcessing = false;

var THINKING_PHRASES = [
    'Analizando tu pregunta...',
    'Buscando la mejor respuesta...',
    'Procesando la información...',
    'Razonando sobre el tema...',
    'Conectando ideas...',
    'Revisando detalles...',
    'Formulando una respuesta...',
    'Reflexionando...'
];

var promptInput = document.getElementById('prompt-input');
var charCounter = document.getElementById('char-counter');
var projectList = document.getElementById('project-list');
var emptyState = document.getElementById('empty-state');
var attachmentZone = document.getElementById('attachment-zone');
var conversationPanel = document.getElementById('conversation-panel');
var chatArea = document.getElementById('chat-area');
var chatWelcome = document.getElementById('chat-welcome');

// ========== AUTO-RESIZE TEXTAREA ==========
function autoResizeTextarea() {
    promptInput.style.height = 'auto';
    var h = Math.min(promptInput.scrollHeight, 160);
    promptInput.style.height = Math.max(28, h) + 'px';
}
function resetTextareaHeight() { promptInput.style.height = '28px'; }

promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); simulateExecution(); }
});

// ========== CHAR COUNTER ==========
function updateCharCount() {
    if (!charCounter) return;
    var len = promptInput.value.length + (activeAttachment ? (activeAttachment.charCount || activeAttachment.content.length) : 0);
    charCounter.innerText = len + ' / ' + CHAR_LIMIT;
    charCounter.className = 'text-[10px] ' + (len >= CHAR_LIMIT ? 'text-red-500' : len > CHAR_LIMIT * 0.9 ? 'text-amber-500' : 'text-zinc-500') + ' font-medium';
}

// ========== INPUT HANDLER ==========
promptInput.addEventListener('input', function () {
    autoResizeTextarea();
    var value = promptInput.value;
    var lineCount = value.split(/\r\n|\r|\n/).length;
    if (lineCount > LINE_THRESHOLD || value.length > CHAR_THRESHOLD) {
        attachPastedText(value, lineCount);
        promptInput.value = ''; resetTextareaHeight(); updateCharCount(); return;
    }
    if (value.length > CHAR_LIMIT) promptInput.value = value.slice(0, CHAR_LIMIT);
    updateCharCount(); persistActivePrompt();
    if (value.length > 0) { promptInput.setAttribute('placeholder', ''); }
    else { if (!isTyping) startTypewriter(); }
});

promptInput.addEventListener('paste', function (e) {
    var pasted = (e.clipboardData || window.clipboardData).getData('text') || '';
    if (!pasted) return;
    var lineCount = pasted.split(/\r\n|\r|\n/).length;
    if (lineCount > LINE_THRESHOLD || pasted.length > CHAR_THRESHOLD) {
        e.preventDefault(); e.stopPropagation(); attachPastedText(pasted, lineCount);
    }
});

function attachPastedText(content, lineCount) {
    activeAttachment = { name: 'pasted-text-' + lineCount + '-lines.txt', lineCount: lineCount, charCount: content.length, content: content };
    renderAttachment(); persistActiveAttachment(); updateCharCount();
}

function renderAttachment() {
    attachmentZone.innerHTML = '';
    if (!activeAttachment) return;
    var pill = document.createElement('div');
    pill.className = 'attachment-pill';
    pill.innerHTML = ICONS.fileText + '<span>Texto pegado \u00b7 ' + activeAttachment.lineCount + ' l\u00edneas \u00b7 ' + (activeAttachment.charCount || activeAttachment.content.length) + ' caracteres</span><span class="remove-attachment" title="Quitar adjunto">' + ICONS.x + '</span>';
    pill.querySelector('.remove-attachment').onclick = function () { activeAttachment = null; renderAttachment(); persistActiveAttachment(); updateCharCount(); };
    attachmentZone.appendChild(pill);
}

// ========== PROJECTS ==========
function loadProjectsFromStorage() {
    projectList.innerHTML = '';
    var projects = ForgeStorage.getAll();
    if (projects.length === 0) { emptyState.style.display = 'flex'; activeConversationMessages = []; renderConversation(); return; }
    emptyState.style.display = 'none';
    projects.forEach(renderProjectItem);
    selectProject(projects[projects.length - 1].id);
}

function renderProjectItem(project) {
    var item = document.createElement('div');
    item.dataset.id = project.id;
    item.className = 'flex items-center justify-between group px-2.5 py-2 rounded-md hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 text-xs font-medium cursor-pointer border border-transparent';
    item.innerHTML = '<div class="flex items-center gap-2 min-w-0 flex-1" data-role="label-wrap"><svg class="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg><span class="truncate" data-role="label">' + escapeHtml(project.name) + '</span></div><div class="project-actions shrink-0"><button data-role="rename" title="Renombrar">' + ICONS.pencil + '</button><button data-role="delete" title="Eliminar">' + ICONS.trash + '</button></div>';
    item.querySelector('[data-role="label-wrap"]').onclick = function () { selectProject(project.id); };
    item.querySelector('[data-role="rename"]').onclick = function (e) { e.stopPropagation(); startRename(item, project.id); };
    item.querySelector('[data-role="delete"]').onclick = function (e) { e.stopPropagation(); deleteProject(project.id); };
    item.addEventListener('contextmenu', function (e) { e.preventDefault(); openContextMenu(e.clientX, e.clientY, item, project.id); });
    projectList.appendChild(item);
}

var contextMenuEl = null;
function openContextMenu(x, y, item, projectId) {
    closeContextMenu();
    var menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = '<button data-action="rename">' + ICONS.pencil + '<span>' + I18n.t('contextMenu.rename') + '</span></button><button data-action="delete" class="danger">' + ICONS.trash + '<span>' + I18n.t('contextMenu.delete') + '</span></button>';
    document.body.appendChild(menu);
    menu.style.left = Math.min(x, window.innerWidth - 168) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 84) + 'px';
    requestAnimationFrame(function () { menu.classList.add('open'); });
    menu.querySelector('[data-action="rename"]').onclick = function () { closeContextMenu(); selectProject(projectId); startRename(item, projectId); };
    menu.querySelector('[data-action="delete"]').onclick = function () { closeContextMenu(); deleteProject(projectId); };
    contextMenuEl = menu;
    setTimeout(function () { document.addEventListener('click', closeContextMenu, { once: true }); }, 0);
}
function closeContextMenu() { if (contextMenuEl) { contextMenuEl.remove(); contextMenuEl = null; } }

function startRename(item, id) {
    var labelWrap = item.querySelector('[data-role="label-wrap"]');
    var label = item.querySelector('[data-role="label"]');
    var input = document.createElement('input');
    input.type = 'text'; input.value = label.textContent; input.className = 'project-name-input';
    labelWrap.replaceChild(input, label); input.focus(); input.select();
    var commit = function () {
        var newName = input.value.trim() || label.textContent;
        ForgeStorage.update(id, { name: newName }); label.textContent = newName;
        if (labelWrap.contains(input)) labelWrap.replaceChild(label, input);
    };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = label.textContent; input.blur(); } });
    input.addEventListener('blur', commit);
}

function deleteProject(id) {
    var project = ForgeStorage.getById(id);
    showConfirmModal({
        title: I18n.t('confirmModal.deleteTitle'), message: I18n.t('confirmModal.deleteMessage', project ? project.name : 'this project'),
        confirmLabel: I18n.t('confirmModal.deleteConfirm'),
        onConfirm: function () {
            ForgeStorage.remove(id); var item = projectList.querySelector('[data-id="' + id + '"]'); if (item) item.remove();
            if (activeProjectId === id) {
                activeProjectId = null; var remaining = ForgeStorage.getAll();
                if (remaining.length > 0) selectProject(remaining[remaining.length - 1].id);
                else { emptyState.style.display = 'flex'; promptInput.value = ''; activeAttachment = null; renderAttachment(); updateCharCount(); }
            }
        }
    });
}

function showConfirmModal(opts) {
    var overlay = document.getElementById('confirm-modal-overlay');
    var modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-modal-title').textContent = opts.title;
    document.getElementById('confirm-modal-message').textContent = opts.message;
    document.getElementById('confirm-modal-confirm').textContent = opts.confirmLabel || 'Confirm';
    overlay.classList.remove('hidden');
    requestAnimationFrame(function () { overlay.classList.add('opacity-100'); modal.classList.remove('scale-95', 'opacity-0'); });
    function close() { overlay.classList.remove('opacity-100'); modal.classList.add('scale-95', 'opacity-0'); setTimeout(function () { overlay.classList.add('hidden'); }, 150); cleanup(); }
    function handleConfirm() { close(); if (opts.onConfirm) opts.onConfirm(); }
    function handleCancel() { close(); if (opts.onCancel) opts.onCancel(); }
    function handleOverlayClick(e) { if (e.target === overlay) { close(); if (opts.onCancel) opts.onCancel(); } }
    function handleKeydown(e) { if (e.key === 'Escape') { close(); if (opts.onCancel) opts.onCancel(); } if (e.key === 'Enter') handleConfirm(); }
    function cleanup() {
        document.getElementById('confirm-modal-confirm').removeEventListener('click', handleConfirm);
        document.getElementById('confirm-modal-cancel').removeEventListener('click', handleCancel);
        overlay.removeEventListener('click', handleOverlayClick);
        document.removeEventListener('keydown', handleKeydown);
    }
    document.getElementById('confirm-modal-confirm').addEventListener('click', handleConfirm);
    document.getElementById('confirm-modal-cancel').addEventListener('click', handleCancel);
    overlay.addEventListener('click', handleOverlayClick);
    document.addEventListener('keydown', handleKeydown);
}

function selectProject(id) {
    activeProjectId = id;
    var project = ForgeStorage.getById(id); if (!project) return;
    activeConversationMessages = Array.isArray(project.messages) ? project.messages.slice() : [];
    renderConversation();
    document.querySelectorAll('#project-list > div').forEach(function (el) { el.classList.remove('bg-zinc-800/40', 'text-zinc-100', 'border-zinc-800/40'); el.classList.add('border-transparent'); });
    var activeItem = projectList.querySelector('[data-id="' + id + '"]');
    if (activeItem) { activeItem.classList.add('bg-zinc-800/40', 'text-zinc-100', 'border-zinc-800/40'); activeItem.classList.remove('border-transparent'); }
    promptInput.value = project.prompt || ''; activeAttachment = project.attachment || null;
    renderAttachment(); updateCharCount();
    if (promptInput.value.length === 0) startTypewriter(); else promptInput.setAttribute('placeholder', '');
}

function createNewProject() {
    var projects = ForgeStorage.getAll();
    var project = ForgeStorage.create('New Chat ' + (projects.length + 1));
    emptyState.style.display = 'none'; renderProjectItem(project);
    activeConversationMessages = []; selectProject(project.id); promptInput.focus();
}

function persistActivePrompt() { if (activeProjectId) ForgeStorage.update(activeProjectId, { prompt: promptInput.value }); }
function persistActiveAttachment() { if (activeProjectId) ForgeStorage.update(activeProjectId, { attachment: activeAttachment }); }
function persistActiveConversation() { if (activeProjectId) ForgeStorage.update(activeProjectId, { messages: activeConversationMessages }); }

// ========== RENDER CONVERSATION ==========
function renderConversation() {
    if (!conversationPanel || !chatWelcome || !chatArea) return;
    conversationPanel.innerHTML = '';
    if (!activeConversationMessages.length) { chatWelcome.style.display = 'flex'; conversationPanel.classList.add('hidden'); showBackgroundPhotos(); return; }
    chatWelcome.style.display = 'none'; conversationPanel.classList.remove('hidden');
    activeConversationMessages.forEach(function (message, msgIndex) {
        var bubbleWrap = document.createElement('div');
        bubbleWrap.className = message.role === 'user' ? 'flex justify-end mb-2' : 'flex flex-col items-start mb-2';
        // Show reasoning bubble if present
        if (message.role === 'assistant' && message.reasoning) {
            var reasonDiv = document.createElement('div');
            reasonDiv.className = 'reasoning-bubble';
            reasonDiv.innerHTML = '<span class="reasoning-label">Razonamiento</span><div class="reasoning-text">' + escapeHtml(message.reasoning) + '</div>';
            bubbleWrap.appendChild(reasonDiv);
        }
        var bubble = document.createElement('div');
        bubble.className = 'chat-bubble ' + (message.role === 'user' ? 'user' : 'assistant');
        if (message.role === 'assistant') { renderMessageWithCodex(bubble, message.content); }
        else { bubble.textContent = message.content; }
        bubbleWrap.appendChild(bubble);
        if (message.role === 'assistant') bubbleWrap.appendChild(createActionBar(msgIndex));
        conversationPanel.appendChild(bubbleWrap);
    });
    requestAnimationFrame(function () { chatArea.scrollTop = chatArea.scrollHeight; });
}

function showBackgroundPhotos() { for (var i = 1; i <= 6; i++) { var s = document.getElementById('photo-slot-' + i); if (s) s.classList.remove('photo-hidden'); } startPhotoCarousel(); }
function hideBackgroundPhotos() { for (var i = 1; i <= 6; i++) { var s = document.getElementById('photo-slot-' + i); if (s) s.classList.add('photo-hidden'); } stopPhotoCarousel(); }

// ======== Carrusel de fotos de fondo (11 imágenes rotando en 6 espacios) ========
var BG_PHOTO_POOL = ['images/bg-1.jpg', 'images/bg-2.jpg', 'images/bg-3.jpg', 'images/bg-4.jpg', 'images/bg-5.jpg', 'images/bg-6.jpg', 'images/bg-7.jpg', 'images/bg-8.jpg', 'images/bg-9.jpg', 'images/bg-10.jpg', 'images/bg-11.jpg'];
var bgPhotoTimers = [];
var bgSlotCurrentImage = {}; // slotIndex -> ruta de imagen actualmente mostrada

function pickNextImageForSlot(slotIndex) {
    var used = Object.keys(bgSlotCurrentImage).map(function (k) { return bgSlotCurrentImage[k]; });
    var candidates = BG_PHOTO_POOL.filter(function (img) { return used.indexOf(img) === -1; });
    if (!candidates.length) candidates = BG_PHOTO_POOL.filter(function (img) { return img !== bgSlotCurrentImage[slotIndex]; });
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function swapSlotImage(slotIndex) {
    var slot = document.getElementById('photo-slot-' + slotIndex);
    if (!slot || slot.classList.contains('photo-hidden')) return;
    var nextImg = pickNextImageForSlot(slotIndex);
    if (!nextImg) return;
    var layers = slot.querySelectorAll('.bg-photo-layer');
    var activeLayer = slot.querySelector('.bg-photo-layer.active');
    var hiddenLayer = Array.prototype.filter.call(layers, function (l) { return l !== activeLayer; })[0];
    if (!hiddenLayer) return;
    // Precargamos la imagen en la capa oculta y la subimos por encima:
    // como ambas capas se superponen, nunca queda un hueco vacío mientras cruzan opacidad.
    hiddenLayer.style.backgroundImage = "url('" + nextImg + "')";
    hiddenLayer.classList.add('active');
    if (activeLayer) activeLayer.classList.remove('active');
    bgSlotCurrentImage[slotIndex] = nextImg;
}

function startPhotoCarousel() {
    stopPhotoCarousel();
    for (var i = 1; i <= 6; i++) {
        // El HTML ya trae una imagen inicial por espacio (bg-1.jpg .. bg-6.jpg)
        bgSlotCurrentImage[i] = 'images/bg-' + i + '.jpg';
    }
    var lastSlot = null;
    bgPhotoTimers.push(setInterval(function () {
        // Elige UN solo espacio al azar (nunca el mismo dos veces seguidas) y cambia solo ese.
        var slot;
        do { slot = 1 + Math.floor(Math.random() * 6); } while (slot === lastSlot);
        lastSlot = slot;
        swapSlotImage(slot);
    }, 9000)); // cada imagen dura bastante antes de que le toque cambiar a ELLA
}

function stopPhotoCarousel() {
    bgPhotoTimers.forEach(function (t) { clearInterval(t); });
    bgPhotoTimers = [];
}

function animateWelcomeOut(callback) {
    if (!chatWelcome) { if (callback) callback(); return; }
    chatWelcome.style.transition = 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)';
    chatWelcome.style.opacity = '0'; chatWelcome.style.transform = 'translateY(-20px)';
    hideBackgroundPhotos();
    setTimeout(function () { chatWelcome.style.display = 'none'; if (callback) callback(); }, 400);
}

function addThinkingBubble(thinkingText) {
    if (!conversationPanel) return null;
    chatWelcome.style.display = 'none'; conversationPanel.classList.remove('hidden');
    var wrap = document.createElement('div');
    wrap.className = 'flex justify-start mb-2 thinking-bubble-wrap';
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble thinking-bubble';
    bubble.innerHTML = '<span class="thinking-text">' + escapeHtml(thinkingText || 'Pensando...') + '</span><span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>';
    wrap.appendChild(bubble); conversationPanel.appendChild(wrap);
    requestAnimationFrame(function () { chatArea.scrollTop = chatArea.scrollHeight; });
    return { wrap: wrap, bubble: bubble };
}

function transformToCodeGenBubble(ref) {
    if (!ref || !ref.bubble) return;
    var bubble = ref.bubble; bubble.classList.add('codegen-bubble');
    bubble.innerHTML = '<span class="codegen-spinner"></span><span class="codegen-label">Escribiendo c\u00f3digo</span><span class="codegen-bar-track"><span class="codegen-bar-fill"></span></span>';
}

function removeThinkingBubble(ref) {
    if (!ref) return;
    ref.bubble.style.opacity = '0'; ref.bubble.style.transform = 'scale(0.95)';
    setTimeout(function () { if (ref.wrap.parentNode) ref.wrap.parentNode.removeChild(ref.wrap); }, 200);
}

function typewriterAnimate(bubble, fullText, onComplete) {
    bubble.textContent = '';
    var cursor = document.createElement('span'); cursor.className = 'tw-cursor'; cursor.textContent = '|'; bubble.appendChild(cursor);
    var total = fullText.length;
    var charsPerFrame = total < 220 ? 1 : Math.max(1, Math.ceil(total / (2200 / 16)));
    var i = 0, lastScrollTs = 0;
    function tick() {
        if (i < total) {
            var next = Math.min(total, i + charsPerFrame);
            bubble.insertBefore(document.createTextNode(fullText.slice(i, next)), cursor);
            i = next;
            if (performance.now() - lastScrollTs > 60) { chatArea.scrollTop = chatArea.scrollHeight; lastScrollTs = performance.now(); }
            requestAnimationFrame(tick);
        } else { cursor.remove(); bubble.classList.remove('typewriting'); chatArea.scrollTop = chatArea.scrollHeight; if (onComplete) onComplete(); }
    }
    requestAnimationFrame(tick);
}

// ========== TOKEN BUDGET ==========
function estimateTokenBudget(userMessage) {
    var text = (userMessage || '').toLowerCase();
    if (text.match(/^\b(hola|hey|hi|saludos|buenas|ok|gracias|adios|bye|chau)\b/)) return 120;
    if (text.match(/\b(crea|haz|genera|escribe|code|script|programa|desarrolla|implementa)\b/)) return 600;
    if (text.match(/\b(explica|describe|detalla|qué es|que es|cómo funciona|por qué)\b/)) return 400;
    // Effort-based adjustment
    var budgets = { low: 150, medium: 280, high: 450, extra: 700, max: 1000 };
    return budgets[currentEffort] || 280;
}

var SYSTEM_PROMPT = 'Eres Forge AI, un asistente servicial y directo. Reglas: 1) Responde en el mismo idioma del usuario. 2) Sé conciso y ve al grano. 3) Para código, usa bloques con ```lenguaje. 4) Lenguaje formal y natural. 5) Piensa antes de responder si el usuario pide razonamiento complejo.';

// ======== FLUX API (OpenRouter) ========
async function callFluxAPI(apiMessages, tokenBudget, model) {
    var orModel = model || 'google/gemma-3-27b-it';
    try {
        var orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + FLUX_API_KEY,
                'HTTP-Referer': 'https://forge-ai.local',
                'X-Title': 'Forge AI'
            },
            body: JSON.stringify({
                model: orModel,
                messages: apiMessages,
                temperature: 0.7,
                max_tokens: tokenBudget
            })
        });
        if (!orResponse.ok) {
            var orErr = ''; try { orErr = await orResponse.text(); } catch (e) { }
            console.error('Flux/OR error ' + orResponse.status + ': ' + orErr.substring(0, 200));
            throw new Error('Flux error ' + orResponse.status);
        }
        var orData = await orResponse.json();
        return (orData && orData.choices && orData.choices[0] && orData.choices[0].message && orData.choices[0].message.content || '').trim();
    } catch (e) { console.error('Flux API failed:', e.message); return ''; }
}

// ======== GROQ API ========
async function callGroqAPI(apiMessages, tokenBudget, model) {
    var groqModel = model || 'openai/gpt-oss-20b';
    var groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
        body: JSON.stringify({ model: groqModel, messages: apiMessages, temperature: 0.6, max_tokens: tokenBudget, top_p: 1 })
    });
    if (!groqResponse.ok) { var grErr = ''; try { grErr = await groqResponse.text(); } catch (e) { } throw new Error('Groq error ' + groqResponse.status); }
    var groqData = await groqResponse.json();
    return (groqData && groqData.choices && groqData.choices[0] && groqData.choices[0].message && groqData.choices[0].message.content || '').trim();
}

// ======== GEMINI API ========
async function callGeminiAPI(apiMessages, tokenBudget, model) {
    var geminiModel = model || 'gemini-2.0-flash';
    var contents = [];
    for (var i = 0; i < apiMessages.length; i++) {
        var role = apiMessages[i].role === 'assistant' ? 'model' : 'user';
        if (apiMessages[i].role === 'system') continue;
        contents.push({ role: role, parts: [{ text: apiMessages[i].content }] });
    }
    var geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + geminiModel + ':generateContent?key=' + GEMINI_API_KEY, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: contents, systemInstruction: { parts: [{ text: 'Eres Forge AI, asistente servicial. Responde en el idioma del usuario.' }] }, generationConfig: { temperature: 0.6, maxOutputTokens: tokenBudget } })
    });
    if (!geminiResponse.ok) { var gErr = ''; try { gErr = await geminiResponse.text(); } catch (e) { } throw new Error('Gemini error ' + geminiResponse.status); }
    var geminiData = await geminiResponse.json();
    return (geminiData && geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].content && geminiData.candidates[0].content.parts && geminiData.candidates[0].content.parts[0] && geminiData.candidates[0].content.parts[0].text || '').trim();
}

// ======== REASONING PROMPT ========
function buildReasoningPrompt(originalMessage, apiMessages) {
    var reasoningPrompt = [{ role: 'system', content: 'Eres un motor de razonamiento. Analiza la pregunta del usuario paso a paso. Da tu razonamiento en 2-3 oraciones concisas EN EL MISMO IDIOMA del usuario. NO respondas la pregunta, solo razona.' }];
    reasoningPrompt.push({ role: 'user', content: 'Pregunta del usuario: "' + originalMessage + '"\n\nRazona brevemente sobre esto (2-3 oraciones maximo):' });
    return reasoningPrompt;
}

// ======== MAIN AI GENERATION ========
async function generateAIResponse(userMessage) {
    var apiMessages = [{ role: 'system', content: SYSTEM_PROMPT }];
    var historyMessages = activeConversationMessages.slice(-15);
    for (var i = 0; i < historyMessages.length; i++) {
        apiMessages.push({ role: historyMessages[i].role, content: historyMessages[i].content });
    }
    var tokenBudget = estimateTokenBudget(userMessage);
    try {
        var content = '';
        var reasoning = '';
        var needsReasoning = thinkingEnabled || currentProvider === 'forge';

        if (currentProvider === 'forge') {
            // === FORGE MODE: ALL IAs reason first, then best response wins ===
            // Step 1: Get reasoning from all APIs (thinking phase)
            var reasoningPromises = [];
            var reasonPrompt = buildReasoningPrompt(userMessage, apiMessages);
            reasoningPromises.push(callGroqAPI(reasonPrompt, 100, 'openai/gpt-oss-20b').catch(function (e) { console.error('Groq reasoning failed:', e.message); return ''; }));
            reasoningPromises.push(callGeminiAPI(reasonPrompt, 100, 'gemini-2.0-flash').catch(function (e) { console.error('Gemini reasoning failed:', e.message); return ''; }));
            reasoningPromises.push(callFluxAPI(reasonPrompt, 100, 'google/gemma-3-27b-it').catch(function (e) { console.error('Flux reasoning failed:', e.message); return ''; }));
            var reasonResults = await Promise.all(reasoningPromises);
            var combinedReasoning = reasonResults.filter(Boolean).join(' | ');
            reasoning = combinedReasoning || 'Analizando desde múltiples ángulos...';

            // Step 2: Get responses from all APIs with reasoning injected
            var enhancedMessages = apiMessages.slice();
            if (reasoning) {
                enhancedMessages.push({ role: 'assistant', content: '[Razonamiento interno: ' + reasoning + ']' });
            }

            var responses = await Promise.allSettled([
                callGroqAPI(enhancedMessages, tokenBudget, 'openai/gpt-oss-20b'),
                callGeminiAPI(enhancedMessages, tokenBudget, 'gemini-2.0-flash'),
                callFluxAPI(enhancedMessages, tokenBudget, 'google/gemma-3-27b-it')
            ]);
            var groqR = responses[0].status === 'fulfilled' ? responses[0].value : '';
            var geminiR = responses[1].status === 'fulfilled' ? responses[1].value : '';
            var fluxR = responses[2].status === 'fulfilled' ? responses[2].value : '';
            // Pick the longest / best response
            var candidates = [geminiR, groqR, fluxR].filter(function (r) { return r && r.length > 10; });
            content = candidates.length > 0 ? candidates.reduce(function (a, b) { return a.length >= b.length ? a : b; }) : '';
            if (content) content = '[Forge \u2022 Razonamiento mixto]\n\n' + content;

        } else if (currentProvider === 'gemini') {
            var geminiModel = currentVariant === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.0-flash';
            if (needsReasoning) {
                var rPrompt = buildReasoningPrompt(userMessage, apiMessages);
                reasoning = await callGroqAPI(rPrompt, 100, 'openai/gpt-oss-20b').catch(function () { return ''; });
                if (reasoning) apiMessages.push({ role: 'assistant', content: '[Razonamiento: ' + reasoning + ']' });
            }
            try {
                content = await callGeminiAPI(apiMessages, tokenBudget, geminiModel);
            } catch (error) {
                if (String(error.message).includes('429')) {
                    console.warn('Gemini quota limit, falling back to Groq.');
                    content = await callGroqAPI(apiMessages, tokenBudget, 'openai/gpt-oss-20b');
                } else throw error;
            }
        } else if (currentProvider === 'flux') {
            var fluxModel = currentVariant === 'pro' ? 'google/gemma-3-27b-it' : 'google/gemma-3-27b-it';
            if (needsReasoning) {
                var rfPrompt = buildReasoningPrompt(userMessage, apiMessages);
                reasoning = await callGroqAPI(rfPrompt, 100, 'openai/gpt-oss-20b').catch(function () { return ''; });
                if (reasoning) apiMessages.push({ role: 'assistant', content: '[Razonamiento: ' + reasoning + ']' });
            }
            content = await callFluxAPI(apiMessages, tokenBudget, fluxModel);
            if (!content) content = await callGroqAPI(apiMessages, tokenBudget, 'openai/gpt-oss-20b'); // fallback
        } else {
            // === GROQ API ===
            var groqModel = currentVariant === 'pro' ? 'openai/gpt-oss-120b' : 'openai/gpt-oss-20b';
            if (needsReasoning) {
                var rgPrompt = buildReasoningPrompt(userMessage, apiMessages);
                reasoning = await callGroqAPI(rgPrompt, 100, 'openai/gpt-oss-20b').catch(function () { return ''; });
                if (reasoning) apiMessages.push({ role: 'assistant', content: '[Razonamiento: ' + reasoning + ']' });
            }
            content = await callGroqAPI(apiMessages, tokenBudget, groqModel);
        }

        // Clean markdown
        content = content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        return { content: content, reasoning: reasoning };
    } catch (error) {
        console.error('Error API:', error);
        return { content: null, reasoning: '' };
    }
}

// ========== SIMULATE EXECUTION ==========
async function simulateExecution() {
    if (isProcessing) return;
    var userMessage = promptInput.value.trim();
    if (!userMessage && !activeAttachment) { promptInput.placeholder = I18n.t('main.placeholderEmpty'); promptInput.focus(); return; }
    isProcessing = true;
    var displayMessage = userMessage || (activeAttachment ? '[Archivo adjunto]' : '');
    var isFirstMessage = (activeConversationMessages.length === 0);
    if (displayMessage) activeConversationMessages.push({ role: 'user', content: displayMessage });
    promptInput.value = ''; resetTextareaHeight(); activeAttachment = null; renderAttachment(); updateCharCount(); persistActivePrompt();
    if (activeConversationMessages.length === 1) {
        await new Promise(function (resolve) { animateWelcomeOut(function () { renderConversationQuick(); resolve(); }); });
    } else {
        renderConversationQuick();
    }
    await sleep(300);
    var thinkingText = pickThinkingPhrase(userMessage);
    var thinkingRef = addThinkingBubble(thinkingText);
    var aiResult = await generateAIResponse(userMessage);
    var responseText = aiResult.content || 'Lo siento, no pude generar una respuesta. Int\u00e9ntalo de nuevo.';
    var reasoningText = aiResult.reasoning || '';
    var hasCode = /```[\s\S]*?```/.test(responseText);
    if (hasCode) { transformToCodeGenBubble(thinkingRef); await sleep(1200); }
    await sleep(200); removeThinkingBubble(thinkingRef); await sleep(150);
    if (hasCode) {
        var wrap = document.createElement('div'); wrap.className = 'flex flex-col items-start mb-2';
        // Show reasoning if available
        if (reasoningText) {
            var rDiv = document.createElement('div'); rDiv.className = 'reasoning-bubble';
            rDiv.innerHTML = '<span class="reasoning-label">Razonamiento</span><div class="reasoning-text">' + escapeHtml(reasoningText) + '</div>';
            wrap.appendChild(rDiv);
        }
        var bubble = document.createElement('div'); bubble.className = 'chat-bubble assistant';
        renderMessageWithCodex(bubble, responseText); wrap.appendChild(bubble);
        activeConversationMessages.push({ role: 'assistant', content: responseText, reasoning: reasoningText });
        var newMsgIndex = activeConversationMessages.length - 1;
        wrap.appendChild(createActionBar(newMsgIndex)); conversationPanel.appendChild(wrap);
        persistActiveConversation(); chatArea.scrollTop = chatArea.scrollHeight;
        finishResponse(isFirstMessage, userMessage, responseText);
    } else {
        var assistantBubbleWrap = document.createElement('div');
        assistantBubbleWrap.className = 'flex flex-col items-start mb-2';
        if (reasoningText) {
            var rrDiv = document.createElement('div'); rrDiv.className = 'reasoning-bubble';
            rrDiv.innerHTML = '<span class="reasoning-label">Razonamiento</span><div class="reasoning-text">' + escapeHtml(reasoningText) + '</div>';
            assistantBubbleWrap.appendChild(rrDiv);
        }
        var tbBubble = document.createElement('div'); tbBubble.className = 'chat-bubble assistant typewriting';
        assistantBubbleWrap.appendChild(tbBubble); conversationPanel.appendChild(assistantBubbleWrap);
        typewriterAnimate(tbBubble, responseText, function () {
            tbBubble.classList.remove('typewriting');
            activeConversationMessages.push({ role: 'assistant', content: responseText, reasoning: reasoningText });
            var tMsgIndex = activeConversationMessages.length - 1;
            assistantBubbleWrap.appendChild(createActionBar(tMsgIndex));
            persistActiveConversation(); chatArea.scrollTop = chatArea.scrollHeight;
            finishResponse(isFirstMessage, userMessage, responseText);
        });
    }
}

function finishResponse(isFirstMessage, userMessage, responseText) {
    if (isFirstMessage && activeProjectId && userMessage) {
        generateTitleFromAI(userMessage, responseText).then(function (newTitle) {
            if (newTitle) { ForgeStorage.update(activeProjectId, { name: newTitle }); var item = projectList.querySelector('[data-id="' + activeProjectId + '"]'); if (item) { var label = item.querySelector('[data-role="label"]'); if (label) label.textContent = newTitle; } }
        });
    }
    isProcessing = false;
}

function renderConversationQuick() {
    if (!conversationPanel || !chatWelcome || !chatArea) return;
    chatWelcome.style.display = 'none'; conversationPanel.classList.remove('hidden'); conversationPanel.innerHTML = '';
    activeConversationMessages.forEach(function (message) {
        var bubbleWrap = document.createElement('div');
        bubbleWrap.className = message.role === 'user' ? 'flex justify-end mb-2' : 'flex justify-start mb-2';
        var bubble = document.createElement('div');
        bubble.className = 'chat-bubble ' + (message.role === 'user' ? 'user' : 'assistant');
        bubble.textContent = message.content; bubbleWrap.appendChild(bubble); conversationPanel.appendChild(bubbleWrap);
    });
    requestAnimationFrame(function () { chatArea.scrollTop = chatArea.scrollHeight; });
}

function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

// ========== TITLE GENERATION ==========
async function generateTitleFromAI(userMessage, aiResponse) {
    try {
        var resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
            body: JSON.stringify({ model: 'openai/gpt-oss-20b', messages: [{ role: 'user', content: 'Genera un titulo de MAXIMO 4-5 palabras para esta conversacion: "' + userMessage + '". Solo el titulo.' }], temperature: 0.3, max_tokens: 20 })
        });
        if (resp.ok) { var d = await resp.json(); var title = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim(); title = title.replace(/["\u201c\u201d]/g, '').trim(); if (title.length > 2 && title.length < 60) return title; }
    } catch (e) { }
    return quickTitle(userMessage);
}

function quickTitle(message) {
    if (!message) return 'New Chat';
    var text = message.trim().toLowerCase();
    if (text.match(/\bhola\b|\bhey\b|\bhi\b|\bsaludos\b/)) return 'Saludo';
    return text.length > 35 ? text.substring(0, 35) + '...' : text.charAt(0).toUpperCase() + text.slice(1);
}

function pickThinkingPhrase(message) {
    var text = (message || '').toLowerCase();
    if (text.match(/\bhola\b|\bsaludo|hey|hi\b/)) return 'Pensando en un saludo...';
    if (text.match(/\bcrea|haz|genera|escribe|code\b/)) return 'Dise\u00f1ando la soluci\u00f3n...';
    var idx = Math.floor(Math.random() * THINKING_PHRASES.length);
    return THINKING_PHRASES[idx];
}

// ========== CODEX ==========
function detectLanguage(code) {
    var firstLine = code.split('\n')[0].trim().toLowerCase();
    if (firstLine === 'lua') return 'Lua'; if (firstLine === 'javascript' || firstLine === 'js') return 'JavaScript';
    if (firstLine === 'python' || firstLine === 'py') return 'Python'; if (firstLine === 'typescript' || firstLine === 'ts') return 'TypeScript';
    if (firstLine === 'html') return 'HTML'; if (firstLine === 'css') return 'CSS';
    if (firstLine === 'json') return 'JSON'; if (firstLine === 'bash' || firstLine === 'sh') return 'Bash';
    if (firstLine === 'sql') return 'SQL'; return 'Code';
}

function renderMessageWithCodex(container, text) {
    var parts = text.split(/(```[\s\S]*?```)/g);
    var hasCodeBlock = false;
    parts.forEach(function (part) {
        var codeMatch = part.match(/```(\w*)\n?([\s\S]*?)```/);
        if (codeMatch) {
            hasCodeBlock = true;
            var lang = codeMatch[1] || detectLanguage(codeMatch[2]); var code = codeMatch[2].trim();
            var lines = code.split('\n'); if (lines[0].trim().toLowerCase() === lang.toLowerCase()) { lines.shift(); code = lines.join('\n'); }
            var artifact = document.createElement('div'); artifact.className = 'codex-artifact';
            var header = document.createElement('div'); header.className = 'codex-header';
            header.innerHTML = '<span class="codex-lang">' + escapeHtml(lang) + '</span><div class="codex-actions"><button class="codex-btn codex-copy-btn" title="Copiar codigo"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></div>';
            var body = document.createElement('pre'); body.className = 'codex-body'; body.textContent = code;
            artifact.appendChild(header); artifact.appendChild(body);
            header.querySelector('.codex-copy-btn').addEventListener('click', function () {
                navigator.clipboard.writeText(code).then(function () { var btn = header.querySelector('.codex-copy-btn'); btn.classList.add('copied'); btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'; setTimeout(function () { btn.classList.remove('copied'); btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'; }, 2000); });
            });
            container.appendChild(artifact);
        } else if (part.trim()) { var textDiv = document.createElement('div'); textDiv.style.whiteSpace = 'pre-wrap'; textDiv.textContent = part.trim(); container.appendChild(textDiv); }
    });
    if (!hasCodeBlock) container.textContent = text;
}

function escapeHtml(str) { var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

// ========== SETTINGS ==========
function openSettings() {
    ['side-profile-area'].forEach(function (id) { var a = document.getElementById(id); if (a) a.classList.remove('open'); });
    var user = Auth.getUser();
    if (user && user.name) {
        var ie = document.getElementById('settings-profile-initial'); if (ie) ie.textContent = user.name.charAt(0).toUpperCase();
        var ne = document.getElementById('settings-profile-name'); if (ne) ne.textContent = user.name;
        var ee = document.getElementById('settings-profile-email'); if (ee) ee.textContent = user.email || 'usuario@email.com';
        var fe = document.getElementById('settings-fullname'); if (fe) fe.value = user.name;
        var ni = document.getElementById('settings-nickname'); if (ni) ni.value = user.name;
        var ae = document.getElementById('settings-account-email'); if (ae) ae.textContent = user.email || 'usuario@email.com';
    }
    var overlay = document.getElementById('settings-modal-overlay'); var modal = document.getElementById('settings-modal');
    // Reset to General panel
    switchSettingsPanel('general');
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex'; overlay.offsetHeight; overlay.style.opacity = '1'; modal.style.opacity = '1'; modal.style.transform = 'scale(1)';
}

function closeSettings() {
    var overlay = document.getElementById('settings-modal-overlay'); var modal = document.getElementById('settings-modal');
    overlay.style.opacity = '0'; modal.style.opacity = '0'; modal.style.transform = 'scale(0.95)';
    setTimeout(function () { overlay.style.display = 'none'; overlay.classList.add('hidden'); }, 200);
}

function clearAllData() {
    closeSettings();
    showConfirmModal({ title: I18n.t('settings.clearTitle'), message: I18n.t('settings.clearMessage'), confirmLabel: I18n.t('settings.clearConfirm'), onCancel: function () { openSettings(); }, onConfirm: function () { ForgeStorage.saveAll([]); activeProjectId = null; activeAttachment = null; loadProjectsFromStorage(); promptInput.value = ''; renderAttachment(); updateCharCount(); } });
}

function switchSettingsPanel(panelName) {
    // Update nav items
    document.querySelectorAll('.settings-nav-item').forEach(function (item) {
        item.classList.toggle('active', item.dataset.panel === panelName);
    });
    // Update panels
    document.querySelectorAll('.settings-panel').forEach(function (panel) {
        panel.classList.add('hidden');
    });
    var targetPanel = document.getElementById('settings-panel-' + panelName);
    if (targetPanel) targetPanel.classList.remove('hidden');
    // Update title
    var titles = { general: 'General', account: 'Cuenta', privacy: 'Privacidad', appearance: 'Idioma', data: 'Datos' };
    var titleEl = document.getElementById('settings-panel-title');
    if (titleEl) titleEl.textContent = titles[panelName] || 'General';
}

var LANGUAGE_LABELS = { en: 'English', es: 'Espa\u00f1ol' };
function setLanguageSelectValue(lang) {
    // Update old select if exists
    var oldLabel = document.getElementById('language-select-label');
    if (oldLabel) oldLabel.textContent = LANGUAGE_LABELS[lang] || lang;
    document.querySelectorAll('.custom-select-option').forEach(function (opt) { opt.classList.toggle('selected', opt.dataset.value === lang); });
    // Update settings lang list
    document.querySelectorAll('.settings-lang-option').forEach(function (opt) {
        opt.classList.toggle('selected', opt.dataset.lang === lang);
    });
}

// ========== ACTION BAR ==========
function createActionBar(msgIndex) {
    var bar = document.createElement('div'); bar.className = 'action-bar';
    bar.innerHTML = '<button class="action-btn copy-btn" title="Copiar respuesta"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button><button class="action-btn like-btn" title="Gusta"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></button><button class="action-btn dislike-btn" title="No gusta"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2 2h-2"/></svg></button>';
    bar.querySelector('.copy-btn').addEventListener('click', function () {
        var content = activeConversationMessages[msgIndex] ? activeConversationMessages[msgIndex].content : '';
        navigator.clipboard.writeText(content).then(function () { var btn = bar.querySelector('.copy-btn'); btn.classList.add('active'); setTimeout(function () { btn.classList.remove('active'); }, 2000); });
    });
    bar.querySelector('.like-btn').addEventListener('click', function () { bar.querySelector('.dislike-btn').classList.remove('danger-active'); bar.querySelector('.like-btn').classList.toggle('active'); });
    bar.querySelector('.dislike-btn').addEventListener('click', function () { bar.querySelector('.like-btn').classList.remove('active'); bar.querySelector('.dislike-btn').classList.toggle('danger-active'); });
    return bar;
}

// ========== TYPEWRITER ==========
var phrases = ['Pregunta a Forge AI...', 'Escribe un prompt...', 'Crea un script de Roblox...', 'Pregunta sobre Lua...', 'Genera código con IA...'];
var twIndex = 0, twCharIndex = 0, twIsDeleting = false, twTimer = null, twCursorBlink = true, isTyping = false;

function startTypewriter() { isTyping = false; var currentText = phrases[twIndex]; twCharIndex = Math.floor(currentText.length / 3); twIsDeleting = false; typeWriterTick(); }
function typeWriterTick() {
    if (isTyping) return;
    var currentText = phrases[twIndex];
    if (twIsDeleting) twCharIndex--; else twCharIndex++;
    promptInput.setAttribute('placeholder', currentText.substring(0, twCharIndex) + '|');
    var speed = twIsDeleting ? 25 : 60;
    if (!twIsDeleting && twCharIndex === currentText.length) { speed = 2500; twIsDeleting = true; }
    else if (twIsDeleting && twCharIndex === 0) { twIsDeleting = false; twIndex = (twIndex + 1) % phrases.length; speed = 500; }
    twTimer = setTimeout(typeWriterTick, speed);
}

// ======== CLAUDE-STYLE MODEL SELECTOR LOGIC ========
function setupModelSelector() {
    var selector = document.getElementById('model-selector');
    var trigger = document.getElementById('model-trigger');
    var mainMenu = document.getElementById('model-menu');
    var effortSubmenu = document.getElementById('effort-submenu');
    var moreSubmenu = document.getElementById('more-models-submenu');
    var thinkingToggle = document.getElementById('thinking-toggle');
    var thinkingSwitch = document.getElementById('thinking-switch');

    // Helper: close all menus
    function closeAllMenus() { selector.classList.remove('open'); mainMenu.classList.add('hidden'); effortSubmenu.classList.add('hidden'); effortSubmenu.classList.remove('open'); moreSubmenu.classList.add('hidden'); moreSubmenu.classList.remove('open'); }

    // Helper: close submenus, show main
    function showMainMenu() { effortSubmenu.classList.add('hidden'); effortSubmenu.classList.remove('open'); moreSubmenu.classList.add('hidden'); moreSubmenu.classList.remove('open'); mainMenu.classList.remove('hidden'); }

    // Trigger click
    if (trigger) {
        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            if (selector.classList.contains('open')) { closeAllMenus(); return; }
            closeAllMenus();
            selector.classList.add('open'); mainMenu.classList.remove('hidden');
        });
    }

    // Model item clicks (in main menu AND more-models submenu)
    document.querySelectorAll('.model-item-claude[data-provider]').forEach(function (item) {
        item.addEventListener('click', function (e) {
            e.stopPropagation();
            currentProvider = item.dataset.provider;
            currentVariant = item.dataset.variant;
            var name = item.dataset.name;
            var desc = item.dataset.desc;
            var iconSvg = item.querySelector('.model-item-icon').innerHTML;
            updateModelTriggerUI(name, desc, iconSvg);
            // Update selected states
            document.querySelectorAll('.model-item-claude[data-provider]').forEach(function (m) { m.classList.remove('selected'); });
            item.classList.add('selected');
            // Also update in more-models submenu if applicable
            if (item.closest('#more-models-submenu')) {
                // Find matching item in main menu
                var mainMatch = mainMenu.querySelector('.model-item-claude[data-provider="' + currentProvider + '"][data-variant="' + currentVariant + '"]');
                if (mainMatch) { document.querySelectorAll('#model-menu .model-item-claude[data-provider]').forEach(function (m) { m.classList.remove('selected'); }); mainMatch.classList.add('selected'); }
            }
            closeAllMenus();
        });
    });

    function updateModelTriggerUI(name, desc, iconHtml) {
        var iconEl = document.getElementById('model-trigger-icon'); var nameEl = document.getElementById('model-name'); var descEl = document.getElementById('model-desc');
        if (iconEl) iconEl.innerHTML = iconHtml;
        if (nameEl) nameEl.textContent = name;
        if (descEl) descEl.textContent = desc;
    }

    // Submenu triggers
    document.querySelectorAll('.model-submenu-trigger').forEach(function (trigger) {
        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            var submenuName = trigger.dataset.submenu;
            if (submenuName === 'effort') { mainMenu.classList.add('hidden'); effortSubmenu.classList.remove('hidden'); effortSubmenu.classList.add('open'); moreSubmenu.classList.add('hidden'); moreSubmenu.classList.remove('open'); }
            else if (submenuName === 'more-models') { mainMenu.classList.add('hidden'); moreSubmenu.classList.remove('hidden'); moreSubmenu.classList.add('open'); effortSubmenu.classList.add('hidden'); effortSubmenu.classList.remove('open'); }
        });
    });

    // Back buttons
    document.querySelectorAll('.model-submenu-back').forEach(function (backBtn) {
        backBtn.addEventListener('click', function (e) { e.stopPropagation(); showMainMenu(); });
    });

    // Effort options
    document.querySelectorAll('.model-effort-option').forEach(function (opt) {
        opt.addEventListener('click', function (e) {
            e.stopPropagation();
            currentEffort = opt.dataset.effort;
            document.querySelectorAll('.model-effort-option').forEach(function (o) { o.classList.remove('selected'); });
            opt.classList.add('selected');
            document.getElementById('effort-value').textContent = opt.querySelector('span').textContent;
            showMainMenu();
        });
    });

    // Thinking toggle
    if (thinkingToggle) {
        thinkingToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            thinkingEnabled = !thinkingEnabled;
            if (thinkingEnabled) { thinkingSwitch.classList.add('active'); } else { thinkingSwitch.classList.remove('active'); }
        });
    }

    // Outside click
    document.addEventListener('click', function () { closeAllMenus(); });

    // Set default (Forge) trigger UI
    var defaultItem = mainMenu.querySelector('.model-item-claude.selected');
    if (defaultItem) {
        var dn = defaultItem.dataset.name; var dd = defaultItem.dataset.desc;
        var di = defaultItem.querySelector('.model-item-icon').innerHTML;
        updateModelTriggerUI(dn, dd, di);
        currentProvider = defaultItem.dataset.provider; currentVariant = defaultItem.dataset.variant;
    }
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function () {
    // Profile areas
    var profileAreas = [];
    [{ area: 'side-profile-area', btn: 'side-profile-btn', menu: 'side-profile-menu' }].forEach(function (ids) {
        var pa = document.getElementById(ids.area); var pb = document.getElementById(ids.btn); var pm = document.getElementById(ids.menu);
        if (!pb || !pa || !pm) return;
        profileAreas.push(pa);
        pb.addEventListener('click', function (e) { e.stopPropagation(); profileAreas.forEach(function (a) { if (a !== pa) a.classList.remove('open'); }); pa.classList.toggle('open'); });
        pm.addEventListener('click', function (e) { e.stopPropagation(); var item = e.target.closest('[data-action]'); if (!item) return; var action = item.getAttribute('data-action'); pa.classList.remove('open'); if (action === 'settings') openSettings(); else if (action === 'language') { I18n.cycleLanguage(); if (window.updateGreeting) window.updateGreeting(); } else if (action === 'logout') handleLogout(); });
    });
    document.addEventListener('click', function (e) { profileAreas.forEach(function (a) { if (!a.contains(e.target)) a.classList.remove('open'); }); });

    // Language dropdown (viejo selector dentro de Settings — puede no existir si
    // ya usas la lista settings-lang-option del modal nuevo; por eso se blinda con checks)
    var wrapper = document.getElementById('language-select'); var trigger = document.getElementById('language-select-trigger'); var menu = document.getElementById('language-select-menu');
    if (trigger && wrapper && menu) {
        trigger.addEventListener('click', function (e) { e.stopPropagation(); wrapper.classList.toggle('open'); menu.classList.toggle('hidden'); });
        document.querySelectorAll('.custom-select-option').forEach(function (opt) { opt.addEventListener('click', function () { var lang = opt.dataset.value; I18n.setLanguage(lang); setLanguageSelectValue(lang); if (window.updateGreeting) window.updateGreeting(); wrapper.classList.remove('open'); menu.classList.add('hidden'); }); });
        document.addEventListener('click', function () { wrapper.classList.remove('open'); menu.classList.add('hidden'); });
    }
    var settingsOverlayEl = document.getElementById('settings-modal-overlay');
    if (settingsOverlayEl) settingsOverlayEl.addEventListener('click', function (e) { if (e.target.id === 'settings-modal-overlay') closeSettings(); });

    // Setup model selector
    setupModelSelector();

    // App init
    I18n.init();
    if (typeof window.updateGreeting === 'function') window.updateGreeting();
    if (typeof window.updateProfileUI === 'function') window.updateProfileUI();
    loadProjectsFromStorage(); updateCharCount();
    if (promptInput.value.length === 0) startTypewriter();
    if (typeof startImageCycling === 'function') startImageCycling();
});