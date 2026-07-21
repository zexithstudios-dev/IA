/**
 * app.js
 * Lógica de interfaz. Depende de storage.js y i18n.js (deben cargarse antes en el HTML).
 */

// Íconos SVG inline
const ICONS = {
    pencil: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>`,
    trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
    fileText: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
    x: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    sparkle: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="M18 16l.75 2.25L21 19l-2.25.75L18 22l-.75-2.25L15 19l2.25-.75z"/></svg>`,
    send: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-7-7l7 7-7 7"/></svg>`
};

let CHAR_LIMIT = 4000;
let LINE_THRESHOLD = 300;
let CHAR_THRESHOLD = 1200;

const GROQ_API_KEY = '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';
const GEMINI_API_KEY = 'AQ.Ab8RN6IRPO8I1TGF6_EaZWNMLfZ4Uu-cPg7Q3MSoTtyqPK0oVg';
let currentModel = 'groq-flash'; // default: Groq Flash

// Variedad de "pensamientos" para la burbuja de razonamiento
const THINKING_PHRASES = [
    'Analizando tu pregunta...',
    'Buscando la mejor respuesta...',
    'Procesando la información...',
    'Razonando sobre el tema...',
    'Conectando ideas...',
    'Revisando detalles...',
    'Formulando una respuesta...',
    'Reflexionando...'
];

let activeProjectId = null;
let activeAttachment = null;
let activeConversationMessages = [];
let isProcessing = false; // bloquea envíos múltiples

const promptInput = document.getElementById('prompt-input');
const charCounter = document.getElementById('char-counter');
const projectList = document.getElementById('project-list');
const emptyState = document.getElementById('empty-state');
const attachmentZone = document.getElementById('attachment-zone');
const conversationPanel = document.getElementById('conversation-panel');
const chatArea = document.getElementById('chat-area');
const chatWelcome = document.getElementById('chat-welcome');

// ========== AUTO-RESIZE TEXTAREA ==========

function autoResizeTextarea() {
    promptInput.style.height = 'auto';
    var h = Math.min(promptInput.scrollHeight, 160);
    promptInput.style.height = Math.max(28, h) + 'px';
}

function resetTextareaHeight() {
    promptInput.style.height = '28px';
}

// ========== ENTER TO SEND ==========

promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        simulateExecution();
    }
});

// ========== CHAR COUNTER ==========

function updateCharCount() {
    if (!charCounter) return;
    var len = promptInput.value.length;
    charCounter.innerText = len + ' / ' + CHAR_LIMIT;
    if (len >= CHAR_LIMIT) {
        charCounter.className = 'text-[10px] text-red-500 font-semibold';
    } else if (len > CHAR_LIMIT * 0.9) {
        charCounter.className = 'text-[10px] text-amber-500 font-semibold';
    } else {
        charCounter.className = 'text-[10px] text-zinc-500 font-medium';
    }
}

// ========== MAIN INPUT HANDLER ==========

promptInput.addEventListener('input', function () {
    autoResizeTextarea();
    var value = promptInput.value;
    var lineCount = value.split(/\r\n|\r|\n/).length;

    if (lineCount > LINE_THRESHOLD || value.length > CHAR_THRESHOLD) {
        attachPastedText(value, lineCount);
        promptInput.value = '';
        resetTextareaHeight();
        updateCharCount();
        return;
    }

    if (value.length > CHAR_LIMIT) {
        promptInput.value = value.slice(0, CHAR_LIMIT);
    }
    updateCharCount();
    persistActivePrompt();

    if (value.length > 0) {
        promptInput.setAttribute('placeholder', '');
    } else {
        if (!isTyping) startTypewriter();
    }
});

// ========== PASTE -> ATTACHMENT ==========

promptInput.addEventListener('paste', function (e) {
    var clipboard = e.clipboardData || window.clipboardData;
    if (!clipboard) return;
    var pasted = clipboard.getData('text/plain') || clipboard.getData('text') || '';
    if (!pasted) return;
    var lineCount = pasted.split(/\r\n|\r|\n/).length;
    if (lineCount > LINE_THRESHOLD || pasted.length > CHAR_THRESHOLD) {
        e.preventDefault();
        e.stopPropagation();
        attachPastedText(pasted, lineCount);
    }
});

function attachPastedText(content, lineCount) {
    activeAttachment = {
        name: 'pasted-text-' + lineCount + '-lines.txt',
        lineCount: lineCount,
        charCount: content.length,
        content: content
    };
    renderAttachment();
    persistActiveAttachment();
}

function renderAttachment() {
    attachmentZone.innerHTML = '';
    if (!activeAttachment) return;
    var pill = document.createElement('div');
    pill.className = 'attachment-pill';
    var label = 'Texto pegado \u00b7 ' + activeAttachment.lineCount + ' l\u00edneas \u00b7 ' + (activeAttachment.charCount || activeAttachment.content.length) + ' caracteres';
    pill.innerHTML = ICONS.fileText + '<span>' + escapeHtml(label) + '</span><span class="remove-attachment" title="Quitar adjunto">' + ICONS.x + '</span>';
    pill.querySelector('.remove-attachment').onclick = function () {
        activeAttachment = null;
        renderAttachment();
        persistActiveAttachment();
    };
    attachmentZone.appendChild(pill);
}

// ========== PROJECTS ==========

function loadProjectsFromStorage() {
    projectList.innerHTML = '';
    var projects = ForgeStorage.getAll();
    if (projects.length === 0) {
        emptyState.style.display = 'flex';
        activeConversationMessages = [];
        renderConversation();
        return;
    }
    emptyState.style.display = 'none';
    projects.forEach(renderProjectItem);
    selectProject(projects[projects.length - 1].id);
}

function renderProjectItem(project) {
    var item = document.createElement('div');
    item.dataset.id = project.id;
    item.className = 'flex items-center justify-between group px-2.5 py-2 rounded-md hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 text-xs font-medium cursor-pointer border border-transparent';
    item.innerHTML = '<div class="flex items-center gap-2 min-w-0 flex-1" data-role="label-wrap">' +
        '<svg class="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>' +
        '<span class="truncate" data-role="label">' + escapeHtml(project.name) + '</span></div>' +
        '<div class="project-actions shrink-0">' +
        '<button data-role="rename" title="Renombrar" aria-label="Renombrar proyecto">' + ICONS.pencil + '</button>' +
        '<button data-role="delete" title="Eliminar" aria-label="Eliminar proyecto">' + ICONS.trash + '</button></div>';

    item.querySelector('[data-role="label-wrap"]').onclick = function () { selectProject(project.id); };
    item.querySelector('[data-role="rename"]').onclick = function (e) { e.stopPropagation(); startRename(item, project.id); };
    item.querySelector('[data-role="delete"]').onclick = function (e) { e.stopPropagation(); deleteProject(project.id); };
    item.addEventListener('contextmenu', function (e) { e.preventDefault(); openContextMenu(e.clientX, e.clientY, item, project.id); });
    projectList.appendChild(item);
}

// Context menu (same as before)
var contextMenuEl = null;
function openContextMenu(x, y, item, projectId) {
    closeContextMenu();
    var menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = '<button data-action="rename">' + ICONS.pencil + '<span>' + I18n.t('contextMenu.rename') + '</span></button>' +
        '<button data-action="delete" class="danger">' + ICONS.trash + '<span>' + I18n.t('contextMenu.delete') + '</span></button>';
    document.body.appendChild(menu);
    var menuWidth = 160, menuHeight = 76;
    menu.style.left = Math.min(x, window.innerWidth - menuWidth - 8) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - menuHeight - 8) + 'px';
    requestAnimationFrame(function () { menu.classList.add('open'); });
    menu.querySelector('[data-action="rename"]').onclick = function () { closeContextMenu(); selectProject(projectId); startRename(item, projectId); };
    menu.querySelector('[data-action="delete"]').onclick = function () { closeContextMenu(); deleteProject(projectId); };
    contextMenuEl = menu;
    setTimeout(function () {
        document.addEventListener('click', closeContextMenu, { once: true });
        document.addEventListener('contextmenu', closeContextMenu, { once: true });
    }, 0);
}
function closeContextMenu() { if (contextMenuEl) { contextMenuEl.remove(); contextMenuEl = null; } }

function startRename(item, id) {
    var labelWrap = item.querySelector('[data-role="label-wrap"]');
    var label = item.querySelector('[data-role="label"]');
    var currentName = label.textContent;
    var input = document.createElement('input');
    input.type = 'text'; input.value = currentName; input.className = 'project-name-input';
    labelWrap.replaceChild(input, label); input.focus(); input.select();
    var commit = function () {
        var newName = input.value.trim() || currentName;
        ForgeStorage.update(id, { name: newName });
        label.textContent = newName;
        if (labelWrap.contains(input)) labelWrap.replaceChild(label, input);
    };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = currentName; input.blur(); } });
    input.addEventListener('blur', commit);
}

function deleteProject(id) {
    var project = ForgeStorage.getById(id);
    showConfirmModal({
        title: I18n.t('confirmModal.deleteTitle'),
        message: I18n.t('confirmModal.deleteMessage', project ? project.name : 'this project'),
        confirmLabel: I18n.t('confirmModal.deleteConfirm'),
        onConfirm: function () {
            ForgeStorage.remove(id);
            var item = projectList.querySelector('[data-id="' + id + '"]');
            if (item) item.remove();
            if (activeProjectId === id) {
                activeProjectId = null;
                var remaining = ForgeStorage.getAll();
                if (remaining.length > 0) { selectProject(remaining[remaining.length - 1].id); }
                else {
                    emptyState.style.display = 'flex';
                    promptInput.value = ''; activeAttachment = null;
                    renderAttachment(); updateCharCount();
                }
            }
        }
    });
}

// ========== CONFIRM MODAL ==========

function showConfirmModal(opts) {
    var overlay = document.getElementById('confirm-modal-overlay');
    var modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-modal-title').textContent = opts.title;
    document.getElementById('confirm-modal-message').textContent = opts.message;
    var confirmBtn = document.getElementById('confirm-modal-confirm');
    confirmBtn.textContent = opts.confirmLabel || 'Confirm';
    overlay.classList.remove('hidden');
    requestAnimationFrame(function () { overlay.classList.add('opacity-100'); modal.classList.remove('scale-95', 'opacity-0'); });
    function close() {
        overlay.classList.remove('opacity-100'); modal.classList.add('scale-95', 'opacity-0');
        setTimeout(function () { overlay.classList.add('hidden'); }, 150);
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        overlay.removeEventListener('click', handleOverlayClick);
        document.removeEventListener('keydown', handleKeydown);
    }
    function handleConfirm() { close(); if (opts.onConfirm) opts.onConfirm(); }
    function handleCancel() { close(); if (opts.onCancel) opts.onCancel(); }
    function handleOverlayClick(e) { if (e.target === overlay) { close(); if (opts.onCancel) opts.onCancel(); } }
    function handleKeydown(e) { if (e.key === 'Escape') { close(); if (opts.onCancel) opts.onCancel(); } if (e.key === 'Enter') handleConfirm(); }
    var cancelBtn = document.getElementById('confirm-modal-cancel');
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', handleOverlayClick);
    document.addEventListener('keydown', handleKeydown);
}

// ========== SELECT / CREATE PROJECT ==========

function selectProject(id) {
    activeProjectId = id;
    var project = ForgeStorage.getById(id);
    if (!project) return;
    activeConversationMessages = Array.isArray(project.messages) ? project.messages.slice() : [];
    renderConversation();

    document.querySelectorAll('#project-list > div').forEach(function (el) {
        el.classList.remove('bg-zinc-800/40', 'text-zinc-100', 'border-zinc-800/40');
        el.classList.add('border-transparent');
        var icon = el.querySelector('svg');
        if (icon) { icon.classList.remove('text-purple-400'); icon.classList.add('text-zinc-500'); }
    });
    var activeItem = projectList.querySelector('[data-id="' + id + '"]');
    if (activeItem) {
        activeItem.classList.add('bg-zinc-800/40', 'text-zinc-100', 'border-zinc-800/40');
        activeItem.classList.remove('border-transparent');
        var icon = activeItem.querySelector('svg');
        if (icon) { icon.classList.remove('text-zinc-500'); icon.classList.add('text-purple-400'); }
    }

    promptInput.value = project.prompt || '';
    activeAttachment = project.attachment || null;
    renderAttachment(); updateCharCount();
    if (promptInput.value.length === 0) { startTypewriter(); }
    else { promptInput.setAttribute('placeholder', ''); }
}

function createNewProject() {
    var projects = ForgeStorage.getAll();
    var project = ForgeStorage.create('New Chat ' + (projects.length + 1));
    emptyState.style.display = 'none';
    renderProjectItem(project);
    activeConversationMessages = [];
    selectProject(project.id);
    promptInput.focus();
}

// ========== PERSISTENCE ==========

function persistActivePrompt() { if (activeProjectId) ForgeStorage.update(activeProjectId, { prompt: promptInput.value }); }
function persistActiveAttachment() { if (activeProjectId) ForgeStorage.update(activeProjectId, { attachment: activeAttachment }); }
function persistActiveConversation() { if (activeProjectId) ForgeStorage.update(activeProjectId, { messages: activeConversationMessages }); }

// ========== RENDER CONVERSATION ==========

function renderConversation() {
    if (!conversationPanel || !chatWelcome || !chatArea) return;
    conversationPanel.innerHTML = '';
    if (!activeConversationMessages.length) {
        chatWelcome.style.display = 'flex';
        conversationPanel.classList.add('hidden');
        showBackgroundPhotos();
        return;
    }
    chatWelcome.style.display = 'none';
    conversationPanel.classList.remove('hidden');

    activeConversationMessages.forEach(function (message, msgIndex) {
        var bubbleWrap = document.createElement('div');
        bubbleWrap.className = message.role === 'user' ? 'flex justify-end mb-2' : 'flex justify-start mb-2';
        if (message.role === 'assistant') {
            var bubble = document.createElement('div');
            bubble.className = 'chat-bubble assistant';
            renderMessageWithCodex(bubble, message.content);
            bubbleWrap.appendChild(bubble);
            // Add action bar
            bubbleWrap.appendChild(createActionBar(msgIndex));
        } else {
            var bubble = document.createElement('div');
            bubble.className = 'chat-bubble user';
            bubble.textContent = message.content;
            bubbleWrap.appendChild(bubble);
        }
        conversationPanel.appendChild(bubbleWrap);
    });
    requestAnimationFrame(function () { chatArea.scrollTop = chatArea.scrollHeight; });
}

function showBackgroundPhotos() {
    for (var i = 1; i <= 6; i++) {
        var slot = document.getElementById('photo-slot-' + i);
        if (slot) slot.classList.remove('photo-hidden');
    }
}

function hideBackgroundPhotos() {
    for (var i = 1; i <= 6; i++) {
        var slot = document.getElementById('photo-slot-' + i);
        if (slot) slot.classList.add('photo-hidden');
    }
}

// ========== ANIMATE WELCOME OUT ==========

function animateWelcomeOut(callback) {
    if (!chatWelcome) { if (callback) callback(); return; }
    chatWelcome.style.transition = 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)';
    chatWelcome.style.opacity = '0';
    chatWelcome.style.transform = 'translateY(-20px)';
    hideBackgroundPhotos();
    setTimeout(function () {
        chatWelcome.style.display = 'none';
        if (callback) callback();
    }, 400);
}

// ========== THINKING BUBBLE ==========

function addThinkingBubble(thinkingText) {
    if (!conversationPanel) return null;
    chatWelcome.style.display = 'none';
    conversationPanel.classList.remove('hidden');

    var wrap = document.createElement('div');
    wrap.className = 'flex justify-start mb-2 thinking-bubble-wrap';
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble thinking-bubble';
    bubble.innerHTML = '<span class="thinking-text">' + escapeHtml(thinkingText || 'Pensando...') + '</span>' +
        '<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>';
    wrap.appendChild(bubble);
    conversationPanel.appendChild(wrap);
    requestAnimationFrame(function () { chatArea.scrollTop = chatArea.scrollHeight; });
    return { wrap: wrap, bubble: bubble };
}

function removeThinkingBubble(ref) {
    if (!ref) return;
    ref.bubble.style.opacity = '0';
    ref.bubble.style.transform = 'scale(0.95)';
    setTimeout(function () { if (ref.wrap.parentNode) ref.wrap.parentNode.removeChild(ref.wrap); }, 200);
}

// ========== TYPEWRITER RESPONSE ==========

function addAssistantBubbleEmpty() {
    var wrap = document.createElement('div');
    wrap.className = 'flex justify-start mb-2';
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble assistant typewriting';
    wrap.appendChild(bubble);
    conversationPanel.appendChild(wrap);
    return bubble;
}

function typewriterAnimate(bubble, fullText, speed, onComplete) {
    var i = 0;
    bubble.textContent = '';
    var cursor = document.createElement('span');
    cursor.className = 'tw-cursor';
    cursor.textContent = '|';
    bubble.appendChild(cursor);

    function tick() {
        if (i < fullText.length) {
            var char = fullText.charAt(i);
            // Insert before cursor
            var textNode = document.createTextNode(char);
            bubble.insertBefore(textNode, cursor);
            i++;
            chatArea.scrollTop = chatArea.scrollHeight;
            setTimeout(tick, speed || 18);
        } else {
            cursor.remove();
            bubble.classList.remove('typewriting');
            if (onComplete) onComplete();
        }
    }
    tick();
}

// ========== AI RESPONSE WITH MEMORY ==========

// Decide max_tokens based on the type of request
function estimateTokenBudget(userMessage) {
    var text = (userMessage || '').toLowerCase();
    // Short greetings / simple questions = short answer
    if (text.match(/^\b(hola|hey|hi|saludos|buenas|ok|gracias|adios|bye|chau)\b[.!?]?\s*$/)) return 120;
    // Code generation requests = more tokens
    if (text.match(/\b(crea|haz|genera|escribe|code|script|programa|desarrolla|implementa|dame un texto largo)\b/)) return 500;
    // Explanations = medium
    if (text.match(/\b(explica|describe|detalla|qué es|que es|cómo funciona|por qué)\b/)) return 350;
    // Default concise
    return 220;
}

async function generateAIResponse(userMessage) {
    var systemPrompt = 'Eres Forge AI, un asistente servicial y directo. Reglas: 1) Responde en el mismo idioma del usuario. 2) Se conciso y ve al grano. 3) No uses asteriscos, negritas ni markdown. Usa texto plano. 4) Adapta la longitud: saludos = breve, codigo/explicaciones = mas detalle. 5) Para codigo, usa bloques delimitados con ```lua o ```javascript. 6) Lenguaje formal y natural.';

    var apiMessages = [{ role: 'system', content: systemPrompt }];
    var historyMessages = activeConversationMessages.slice(-15);
    for (var i = 0; i < historyMessages.length; i++) {
        apiMessages.push({ role: historyMessages[i].role, content: historyMessages[i].content });
    }

    var tokenBudget = estimateTokenBudget(userMessage);

    // Determine which API to use
    var isGemini = (currentModel === 'gemini-flash' || currentModel === 'gemini-pro');
    var isGemiGroq = (currentModel === 'gemigroq');

    try {
        var content = '';

        if (isGemiGroq) {
            // === GEMIGROQ DUAL MODE: asks both APIs, picks best ===
            var geminiPromise = callGeminiAPI(apiMessages, tokenBudget, 'gemini-2.0-flash');
            var groqPromise = callGroqAPI(apiMessages, tokenBudget, 'llama-3.1-8b-instant');
            var results = await Promise.allSettled([geminiPromise, groqPromise]);
            var geminiResult = results[0].status === 'fulfilled' ? results[0].value : '';
            var groqResult = results[1].status === 'fulfilled' ? results[1].value : '';

            // Pick the longer/higher quality response
            if (geminiResult && groqResult) {
                content = groqResult.length > geminiResult.length ? groqResult : geminiResult;
                content = '[GemiGroq - Dual IA]\n\n' + content;
            } else {
                content = geminiResult || groqResult || '';
            }

        } else if (isGemini) {
            // === GEMINI API ===
            var geminiModel = (currentModel === 'gemini-flash') ? 'gemini-2.0-flash' : 'gemini-1.5-pro';

            // Convert messages to Gemini format
            var contents = [];
            for (var i = 0; i < apiMessages.length; i++) {
                var role = apiMessages[i].role === 'assistant' ? 'model' : 'user';
                if (apiMessages[i].role === 'system') continue; // Gemini handles system differently
                contents.push({ role: role, parts: [{ text: apiMessages[i].content }] });
            }

            var geminiBody = {
                contents: contents,
                systemInstruction: { parts: [{ text: 'Eres Forge AI, un asistente servicial. Responde en el mismo idioma del usuario. Se conciso. Para codigo, usa ```lenguaje.' }] },
                generationConfig: { temperature: 0.6, maxOutputTokens: tokenBudget }
            };

            var geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + geminiModel + ':generateContent?key=' + GEMINI_API_KEY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(geminiBody)
            });

            if (!geminiResponse.ok) {
                var gErr = '';
                try { gErr = await geminiResponse.text(); } catch (e) { }
                console.error('Gemini error ' + geminiResponse.status + ': ' + gErr.substring(0, 300));
                throw new Error('Gemini error ' + geminiResponse.status);
            }

            var geminiData = await geminiResponse.json();
            content = (geminiData && geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].content && geminiData.candidates[0].content.parts && geminiData.candidates[0].content.parts[0] && geminiData.candidates[0].content.parts[0].text || '').trim();

        } else {
            // === GROQ API ===
            var groqModel = (currentModel === 'groq-flash') ? 'llama-3.1-8b-instant' : 'llama-3.3-70b-versatile';

            var groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + GROQ_API_KEY
                },
                body: JSON.stringify({
                    model: groqModel,
                    messages: apiMessages,
                    temperature: 0.6,
                    max_tokens: tokenBudget,
                    top_p: 1
                })
            });

            if (!groqResponse.ok) {
                var grErr = '';
                try { grErr = await groqResponse.text(); } catch (e) { }
                console.error('Groq error ' + groqResponse.status + ': ' + grErr.substring(0, 300));
                throw new Error('Groq error ' + groqResponse.status);
            }

            var groqData = await groqResponse.json();
            content = (groqData && groqData.choices && groqData.choices[0] && groqData.choices[0].message && groqData.choices[0].message.content || '').trim();
        }

        // Clean markdown formatting but preserve code blocks
        content = content.replace(/\*\*(.*?)\*\*/g, '$1');
        content = content.replace(/\*(.*?)\*/g, '$1');
        return content;
    } catch (error) {
        console.error('Error API:', error);
        return null;
    }
}

// ========== AUTO-TITLE FROM AI RESPONSE ==========

async function generateTitleFromAI(userMessage, aiResponse) {
    // Try AI-generated title first
    try {
        var titlePrompt = 'Basado en este mensaje del usuario: "' + userMessage + '" y tu respuesta: "' + aiResponse.substring(0, 200) + '", genera un titulo de MAXIMO 4-5 palabras que resuma el tema de la conversacion. Responde SOLO el titulo, sin comillas ni nada mas.';
        var resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + GROQ_API_KEY
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: titlePrompt }],
                temperature: 0.3,
                max_tokens: 30
            })
        });
        if (resp.ok) {
            var d = await resp.json();
            var title = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
            title = title.replace(/["\u201c\u201d]/g, '').trim();
            if (title.length > 2 && title.length < 60) return title;
        }
    } catch (e) { }
    // Fallback: keyword heuristic
    return quickTitle(userMessage);
}

function quickTitle(message) {
    if (!message) return 'New Chat';
    var text = message.trim().toLowerCase();
    if (text.match(/\bhola\b|\bhey\b|\bhi\b|\bsaludos\b/)) return 'Saludo';
    if (text.match(/\broblox|studio|script|lua|guion\b/)) return 'Roblox Studio';
    var title = text.length > 35 ? text.substring(0, 35) + '...' : text.charAt(0).toUpperCase() + text.slice(1);
    return title;
}

// ========== THINKING PHRASE PICKER ==========

function pickThinkingPhrase(message) {
    var text = (message || '').toLowerCase();
    if (text.match(/\bhola\b|\bsaludo|hey|hi\b/)) return 'Pensando en un saludo...';
    if (text.match(/\broblox|studio|lua|script\b/)) return 'Analizando conceptos de Roblox...';
    if (text.match(/\bcrea|haz|genera|escribe|code\b/)) return 'Dise\u00f1ando la soluci\u00f3n...';
    if (text.match(/\bpregunta|cómo|que es|qué es|por qué\b/)) return 'Investigando la respuesta...';
    var idx = Math.floor(Math.random() * THINKING_PHRASES.length);
    return THINKING_PHRASES[idx];
}

// ========== MAIN: SIMULATE EXECUTION ==========

async function simulateExecution() {
    if (isProcessing) return;
    var userMessage = promptInput.value.trim();
    if (!userMessage && !activeAttachment) {
        promptInput.placeholder = I18n.t('main.placeholderEmpty');
        promptInput.focus();
        return;
    }

    isProcessing = true;
    var sourceText = [promptInput.value, activeAttachment ? activeAttachment.content : ''].filter(Boolean).join('\n').trim();
    var displayMessage = userMessage || (activeAttachment ? '[Archivo adjunto]' : '');

    var isFirstMessage = (activeConversationMessages.length === 0);

    // Add user message to conversation
    if (displayMessage) {
        activeConversationMessages.push({ role: 'user', content: displayMessage });
    }

    // Clear input
    promptInput.value = '';
    resetTextareaHeight();
    activeAttachment = null;
    renderAttachment();
    updateCharCount();
    persistActivePrompt();

    // Animate welcome out (first message)
    if (activeConversationMessages.length === 1) {
        animateWelcomeOut(function () {
            renderConversationQuick();
        });
    } else {
        renderConversationQuick();
    }

    // Small delay then show thinking
    await sleep(300);

    var thinkingText = pickThinkingPhrase(userMessage);
    var thinkingRef = addThinkingBubble(thinkingText);

    // Get AI response (with full history)
    var aiResponse = await generateAIResponse(userMessage);

    // Update thinking bubble text if it's code generation
    var hasCode = /```[\s\S]*?```/.test(aiResponse || '');
    if (hasCode) {
        thinkingRef.bubble.querySelector('.thinking-text').textContent = 'Generando codigo...';
        await sleep(600);
    }

    // Remove thinking bubble with animation
    await sleep(200);
    removeThinkingBubble(thinkingRef);
    await sleep(150);

    var responseText = aiResponse || 'Lo siento, no pude generar una respuesta. Int\u00e9ntalo de nuevo.';

    if (hasCode) {
        // Skip typewriter for code responses: render directly with Codex
        var wrap = document.createElement('div');
        wrap.className = 'flex justify-start mb-2';
        var bubble = document.createElement('div');
        bubble.className = 'chat-bubble assistant';
        renderMessageWithCodex(bubble, responseText);
        wrap.appendChild(bubble);

        activeConversationMessages.push({ role: 'assistant', content: responseText });
        var newMsgIndex = activeConversationMessages.length - 1;
        wrap.appendChild(createActionBar(newMsgIndex));
        conversationPanel.appendChild(wrap);

        persistActiveConversation();
        chatArea.scrollTop = chatArea.scrollHeight;
        finishResponse(isFirstMessage, userMessage, responseText);
    } else {
        // Typewriter for text-only responses
        var assistantBubbleWrap = document.createElement('div');
        assistantBubbleWrap.className = 'flex justify-start mb-2';
        var tbBubble = document.createElement('div');
        tbBubble.className = 'chat-bubble assistant typewriting';
        assistantBubbleWrap.appendChild(tbBubble);
        conversationPanel.appendChild(assistantBubbleWrap);

        typewriterAnimate(tbBubble, responseText, 18, function () {
            tbBubble.classList.remove('typewriting');
            activeConversationMessages.push({ role: 'assistant', content: responseText });
            var tMsgIndex = activeConversationMessages.length - 1;
            assistantBubbleWrap.appendChild(createActionBar(tMsgIndex));
            persistActiveConversation();
            chatArea.scrollTop = chatArea.scrollHeight;
            finishResponse(isFirstMessage, userMessage, responseText);
        });
    }
}

function finishResponse(isFirstMessage, userMessage, responseText) {
    if (isFirstMessage && activeProjectId && userMessage) {
        generateTitleFromAI(userMessage, responseText).then(function (newTitle) {
            if (newTitle) {
                ForgeStorage.update(activeProjectId, { name: newTitle });
                var activeItem = projectList.querySelector('[data-id="' + activeProjectId + '"]');
                if (activeItem) {
                    var label = activeItem.querySelector('[data-role="label"]');
                    if (label) label.textContent = newTitle;
                }
            }
        });
    }
    isProcessing = false;
}

// Quick render without clearing (used during animation)
function renderConversationQuick() {
    if (!conversationPanel || !chatWelcome || !chatArea) return;
    chatWelcome.style.display = 'none';
    conversationPanel.classList.remove('hidden');
    conversationPanel.innerHTML = '';

    activeConversationMessages.forEach(function (message) {
        var bubbleWrap = document.createElement('div');
        bubbleWrap.className = message.role === 'user' ? 'flex justify-end mb-2' : 'flex justify-start mb-2';
        var bubble = document.createElement('div');
        bubble.className = 'chat-bubble ' + (message.role === 'user' ? 'user' : 'assistant');
        bubble.textContent = message.content;
        bubbleWrap.appendChild(bubble);
        conversationPanel.appendChild(bubbleWrap);
    });
    requestAnimationFrame(function () { chatArea.scrollTop = chatArea.scrollHeight; });
}

function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// ========== FORGEAI CODEX: Renders code blocks as artifacts ==========

function detectLanguage(code) {
    var firstLine = code.split('\n')[0].trim().toLowerCase();
    if (firstLine === 'lua') return 'Lua';
    if (firstLine === 'javascript' || firstLine === 'js') return 'JavaScript';
    if (firstLine === 'python' || firstLine === 'py') return 'Python';
    if (firstLine === 'typescript' || firstLine === 'ts') return 'TypeScript';
    if (firstLine === 'html') return 'HTML';
    if (firstLine === 'css') return 'CSS';
    if (firstLine === 'json') return 'JSON';
    if (firstLine === 'bash' || firstLine === 'sh') return 'Bash';
    if (firstLine === 'sql') return 'SQL';
    return 'Code';
}

function renderMessageWithCodex(container, text) {
    // Split by code blocks (```language ... ```)
    var parts = text.split(/(```[\s\S]*?```)/g);
    var hasCodeBlock = false;

    parts.forEach(function (part) {
        var codeMatch = part.match(/```(\w*)\n?([\s\S]*?)```/);
        if (codeMatch) {
            hasCodeBlock = true;
            var lang = codeMatch[1] || detectLanguage(codeMatch[2]);
            var code = codeMatch[2].trim();
            // If first line is the language name, strip it for the body
            var lines = code.split('\n');
            if (lines[0].trim().toLowerCase() === lang.toLowerCase()) {
                lines.shift();
                code = lines.join('\n');
            }

            var artifact = document.createElement('div');
            artifact.className = 'codex-artifact';

            var header = document.createElement('div');
            header.className = 'codex-header';
            header.innerHTML = '<span class="codex-lang">' + escapeHtml(lang) + '</span>' +
                '<div class="codex-actions">' +
                '<button class="codex-btn codex-copy-btn" title="Copiar codigo">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>' +
                '</button></div>';

            var body = document.createElement('pre');
            body.className = 'codex-body';
            body.textContent = code;

            artifact.appendChild(header);
            artifact.appendChild(body);

            // Copy button handler
            header.querySelector('.codex-copy-btn').addEventListener('click', function () {
                navigator.clipboard.writeText(code).then(function () {
                    var btn = header.querySelector('.codex-copy-btn');
                    btn.classList.add('copied');
                    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
                    setTimeout(function () {
                        btn.classList.remove('copied');
                        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
                    }, 2000);
                });
            });

            container.appendChild(artifact);
        } else if (part.trim()) {
            var textDiv = document.createElement('div');
            textDiv.style.whiteSpace = 'pre-wrap';
            textDiv.textContent = part.trim();
            container.appendChild(textDiv);
        }
    });

    // If no code blocks found, just set textContent
    if (!hasCodeBlock) {
        container.textContent = text;
    }
}

// ========== UTILS ==========

function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ========== SETTINGS ==========

function openSettings() {
    // Close profile menu first
    var profileArea = document.getElementById('profile-area');
    if (profileArea) profileArea.classList.remove('open');

    var overlay = document.getElementById('settings-modal-overlay');
    var modal = document.getElementById('settings-modal');
    setLanguageSelectValue(I18n.current);

    overlay.style.display = 'flex';
    overlay.offsetHeight;
    overlay.style.opacity = '1';
    modal.style.opacity = '1';
    modal.style.transform = 'scale(1)';
}

function closeSettings() {
    var overlay = document.getElementById('settings-modal-overlay');
    var modal = document.getElementById('settings-modal');
    overlay.style.opacity = '0';
    modal.style.opacity = '0';
    modal.style.transform = 'scale(0.95)';
    setTimeout(function () {
        overlay.style.display = 'none';
    }, 200);
}

function clearAllData() {
    closeSettings();
    showConfirmModal({
        title: I18n.t('settings.clearTitle'),
        message: I18n.t('settings.clearMessage'),
        confirmLabel: I18n.t('settings.clearConfirm'),
        onCancel: function () { openSettings(); },
        onConfirm: function () {
            ForgeStorage.saveAll([]);
            activeProjectId = null; activeAttachment = null;
            loadProjectsFromStorage();
            promptInput.value = ''; renderAttachment(); updateCharCount();
        }
    });
}

// ========== LANGUAGE DROPDOWN ==========

var LANGUAGE_LABELS = { en: 'English', es: 'Espa\u00f1ol' };
function setLanguageSelectValue(lang) {
    document.getElementById('language-select-label').textContent = LANGUAGE_LABELS[lang] || lang;
    document.querySelectorAll('.custom-select-option').forEach(function (opt) { opt.classList.toggle('selected', opt.dataset.value === lang); });
}

document.addEventListener('DOMContentLoaded', function () {
    // Profile dropdown toggle + delegation
    var profileArea = document.getElementById('profile-area');
    var profileBtn = document.getElementById('profile-btn');
    var profileMenu = document.getElementById('profile-menu');
    if (profileBtn && profileArea && profileMenu) {
        profileBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            profileArea.classList.toggle('open');
        });
        // Handle clicks on menu items via delegation
        profileMenu.addEventListener('click', function (e) {
            e.stopPropagation();
            var item = e.target.closest('[data-action]');
            if (!item) return;
            var action = item.getAttribute('data-action');
            profileArea.classList.remove('open');
            if (action === 'settings') {
                openSettings();
            } else if (action === 'language') {
                I18n.cycleLanguage();
                if (window.updateGreeting) window.updateGreeting();
            } else if (action === 'logout') {
                handleLogout();
            }
        });
        document.addEventListener('click', function (e) {
            if (!profileArea.contains(e.target)) profileArea.classList.remove('open');
        });
    }

    var wrapper = document.getElementById('language-select');
    var trigger = document.getElementById('language-select-trigger');
    var menu = document.getElementById('language-select-menu');
    trigger.addEventListener('click', function (e) { e.stopPropagation(); wrapper.classList.toggle('open'); menu.classList.toggle('hidden'); });
    document.querySelectorAll('.custom-select-option').forEach(function (option) {
        option.addEventListener('click', function () {
            var lang = option.dataset.value;
            I18n.setLanguage(lang); setLanguageSelectValue(lang);
            if (window.updateGreeting) window.updateGreeting();
            wrapper.classList.remove('open'); menu.classList.add('hidden');
        });
    });
    document.addEventListener('click', function () { wrapper.classList.remove('open'); menu.classList.add('hidden'); });
    document.getElementById('settings-modal-overlay').addEventListener('click', function (e) { if (e.target.id === 'settings-modal-overlay') closeSettings(); });

    // Model selector dropdown
    var modelPill = document.getElementById('model-selector');
    var modelTrigger = document.getElementById('model-trigger');
    var modelMenu = document.getElementById('model-menu');
    var modelLabel = document.getElementById('model-label');

    modelTrigger.addEventListener('click', function (e) {
        e.stopPropagation();
        modelPill.classList.toggle('open');
        modelMenu.classList.toggle('hidden');
    });

    document.querySelectorAll('.model-option').forEach(function (option) {
        option.addEventListener('click', function () {
            var model = option.dataset.model;
            var label = option.dataset.label;
            currentModel = model;
            modelLabel.textContent = label;
            // Update selected state
            document.querySelectorAll('.model-option').forEach(function (o) { o.classList.remove('selected'); });
            option.classList.add('selected');
            modelPill.classList.remove('open');
            modelMenu.classList.add('hidden');
        });
    });

    document.addEventListener('click', function () {
        modelPill.classList.remove('open');
        modelMenu.classList.add('hidden');
    });
});

// ========== ACTION BAR (below AI responses) ==========

function createActionBar(msgIndex) {
    var bar = document.createElement('div');
    bar.className = 'action-bar';

    // Copy
    var copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn';
    copyBtn.title = 'Copiar';
    copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
    copyBtn.onclick = function () {
        var text = activeConversationMessages[msgIndex].content;
        navigator.clipboard.writeText(text).then(function () {
            copyBtn.classList.add('active');
            setTimeout(function () { copyBtn.classList.remove('active'); }, 1800);
        });
    };
    bar.appendChild(copyBtn);

    // Like
    var likeBtn = document.createElement('button');
    likeBtn.className = 'action-btn';
    likeBtn.title = 'Me gusta';
    likeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
    likeBtn.onclick = function () {
        likeBtn.classList.toggle('active');
        var dislikeBtn = bar.querySelector('.dislike-btn');
        if (dislikeBtn) dislikeBtn.classList.remove('danger-active');
    };
    bar.appendChild(likeBtn);

    // Dislike
    var dislikeBtn = document.createElement('button');
    dislikeBtn.className = 'action-btn dislike-btn';
    dislikeBtn.title = 'No me gusta';
    dislikeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>';
    dislikeBtn.onclick = function () {
        dislikeBtn.classList.toggle('danger-active');
        if (likeBtn) likeBtn.classList.remove('active');
    };
    bar.appendChild(dislikeBtn);

    // Regenerate
    var retryBtn = document.createElement('button');
    retryBtn.className = 'action-btn';
    retryBtn.title = 'Volver a intentar';
    retryBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
    retryBtn.onclick = function () {
        if (isProcessing) return;
        // Remove last assistant message and re-send
        activeConversationMessages.splice(msgIndex, 1);
        var lastUserMsg = '';
        for (var j = activeConversationMessages.length - 1; j >= 0; j--) {
            if (activeConversationMessages[j].role === 'user') { lastUserMsg = activeConversationMessages[j].content; break; }
        }
        renderConversation();
        promptInput.value = lastUserMsg;
        simulateExecution();
    };
    bar.appendChild(retryBtn);

    return bar;
}

// ========== GREETING ==========

window.updateGreeting = function () {
    var user = Auth.getUser();
    var heading = document.getElementById('main-heading');
    if (!heading) return;
    if (user && user.name) {
        heading.innerHTML = escapeHtml(I18n.t('main.greeting', user.name));
    } else {
        heading.innerHTML = escapeHtml(I18n.t('main.heading'));
    }
};

// ========== UPDATE PROFILE UI ==========

window.updateProfileUI = function () {
    var user = Auth.getUser();
    var initialEl = document.getElementById('profile-initial');
    var emailEl = document.getElementById('profile-email-display');
    if (user && user.name) {
        if (initialEl) initialEl.textContent = user.name.charAt(0).toUpperCase();
        if (emailEl) emailEl.textContent = user.email || 'usuario@email.com';
    }
};

// ========== LOGOUT ==========

function handleLogout() {
    Auth.logout();
    localStorage.clear();
    location.reload();
}

// ========== IMAGE CYCLING ==========

var TOTAL_IMAGES = 11;
var VISIBLE_SLOTS = 6;
var currentImages = [1, 2, 3, 4, 5, 6];

function startImageCycling() {
    setInterval(function () {
        var slotIndex = Math.floor(Math.random() * VISIBLE_SLOTS);
        var slotEl = document.getElementById('photo-slot-' + (slotIndex + 1));
        if (!slotEl || slotEl.classList.contains('photo-hidden')) return;
        var newImage;
        do { newImage = Math.floor(Math.random() * TOTAL_IMAGES) + 1; } while (currentImages.includes(newImage));
        currentImages[slotIndex] = newImage;
        var img = new Image();
        img.src = 'images/bg-' + newImage + '.jpg';
        img.onload = function () {
            var nextLayer = document.createElement('div');
            nextLayer.className = 'absolute inset-0 bg-cover bg-center transition-opacity duration-1000 opacity-0';
            nextLayer.style.backgroundImage = 'url(\'' + img.src + '\')';
            slotEl.appendChild(nextLayer);
            nextLayer.offsetHeight;
            nextLayer.style.opacity = '1';
            setTimeout(function () {
                Array.from(slotEl.children).forEach(function (child) { if (child !== nextLayer) child.remove(); });
            }, 1200);
        };
    }, 4500);
}

// ========== TYPEWRITER PLACEHOLDER ==========

var twIndex = 0, twCharIndex = 0, twIsDeleting = false, twTimer = null, isTyping = false, twCursorBlink = true;

setInterval(function () {
    if (isTyping && promptInput.value.length === 0) {
        twCursorBlink = !twCursorBlink;
        var phrases = I18n.t('main.typewriter');
        if (Array.isArray(phrases) && phrases[twIndex]) {
            promptInput.setAttribute('placeholder', phrases[twIndex].substring(0, twCharIndex) + (twCursorBlink ? '|' : ''));
        }
    }
}, 530);

function startTypewriter() { clearTimeout(twTimer); isTyping = true; typeWriterTick(); }

function typeWriterTick() {
    if (promptInput.value.length > 0) { isTyping = false; return; }
    var phrases = I18n.t('main.typewriter');
    if (!Array.isArray(phrases) || phrases.length === 0) return;
    if (twIndex >= phrases.length) twIndex = 0;
    var currentText = phrases[twIndex];
    if (twIsDeleting) { twCharIndex--; } else { twCharIndex++; }
    twCursorBlink = true;
    promptInput.setAttribute('placeholder', currentText.substring(0, twCharIndex) + '|');
    var typeSpeed = twIsDeleting ? 25 : 60;
    if (!twIsDeleting && twCharIndex === currentText.length) { typeSpeed = 2500; twIsDeleting = true; }
    else if (twIsDeleting && twCharIndex === 0) { twIsDeleting = false; twIndex = (twIndex + 1) % phrases.length; typeSpeed = 500; }
    twTimer = setTimeout(typeWriterTick, typeSpeed);
}

// ========== INIT ==========

document.addEventListener('DOMContentLoaded', function () {
    I18n.init();
    window.updateGreeting();
    window.updateProfileUI();
    loadProjectsFromStorage();
    updateCharCount();
    if (promptInput.value.length === 0) startTypewriter();
    startImageCycling();
});
