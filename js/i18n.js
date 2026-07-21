/**
 * i18n.js
 * Módulo aislado que controla el idioma de la interfaz.
 * No sabe nada de proyectos ni de storage de la app: solo traduce texto
 * y recuerda la preferencia del usuario. Cárgalo antes que app.js.
 */

const I18N_STORAGE_KEY = 'forge-ai-language';
const DEFAULT_LANGUAGE = 'en'; // por defecto en inglés

const I18N_DICTIONARY = {
    en: {
        'app.title': 'Forge AI',
        'sidebar.newProject': 'New project',
        'sidebar.projects': 'Projects',
        'sidebar.empty': 'You don\'t have any projects yet.<br>Create your first one above.',
        'main.heading': 'Make your own prompt!',
        'main.greeting': (name) => `Welcome to Forge AI, ${name}!`,
        'main.subheading': 'Write down your core instructions to build your private LLM template.',
        'main.placeholder': 'Define system rules, persona, formatting style...',
        'main.placeholderEmpty': 'Write something before running...',
        'main.typewriter': [
            'Make a shift-to-run system with a stamina bar UI...',
            'Create a round-based minigame system...',
            'Design a combat system with combo attacks...',
            'Generate a plot management system for a tycoon...',
            'Write a script for an advanced dialogue system...'
        ],
        'toast.success': 'Prompt sent.',
        'contextMenu.rename': 'Rename',
        'contextMenu.delete': 'Delete',
        'confirmModal.deleteTitle': 'Delete project',
        'confirmModal.deleteMessage': (name) => `Are you sure you want to delete "${name}"? This can\'t be undone.`,
        'confirmModal.deleteConfirm': 'Delete',
        'confirmModal.cancel': 'Cancel',
        'settings.title': 'Settings',
        'settings.language': 'Language',
        'settings.clearData': 'Clear all data',
        'settings.clearDataDesc': 'Deletes all saved projects',
        'settings.clearButton': 'Clear',
        'settings.clearTitle': 'Clear all data',
        'settings.clearMessage': 'All projects saved in this browser will be deleted. This can\'t be undone.',
        'settings.clearConfirm': 'Clear everything',
        'login.title': 'Welcome to Forge AI',
        'login.subtitle': 'Sign in to start building your prompts.',
        'login.namePlaceholder': 'Your name',
        'login.emailPlaceholder': 'you@email.com',
        'login.submit': 'Continue',
        'login.note': 'Demo only — nothing is sent anywhere, this stays on your device.'
    },
    es: {
        'app.title': 'Forge AI',
        'sidebar.newProject': 'Nuevo proyecto',
        'sidebar.projects': 'Proyectos',
        'sidebar.empty': 'Aún no tienes proyectos.<br>Crea el primero arriba.',
        'main.heading': '¡Crea tu propio prompt!',
        'main.greeting': (name) => `¡Bienvenido a Forge AI, ${name}!`,
        'main.subheading': 'Escribe tus instrucciones base para construir tu plantilla privada de LLM.',
        'main.placeholder': 'Define reglas del sistema, persona, estilo de formato...',
        'main.placeholderEmpty': 'Escribe algo antes de ejecutar...',
        'main.typewriter': [
            'Crea un sistema de correr con shift y barra de estamina...',
            'Haz un sistema de minijuegos por rondas...',
            'Diseña un sistema de combate con ataques en combo...',
            'Genera un sistema de gestión de parcelas para un tycoon...',
            'Escribe un script para un sistema avanzado de diálogos...'
        ],
        'toast.success': 'Prompt enviado.',
        'contextMenu.rename': 'Renombrar',
        'contextMenu.delete': 'Eliminar',
        'confirmModal.deleteTitle': 'Eliminar proyecto',
        'confirmModal.deleteMessage': (name) => `¿Seguro que quieres eliminar "${name}"? No podrás deshacerlo.`,
        'confirmModal.deleteConfirm': 'Eliminar',
        'confirmModal.cancel': 'Cancelar',
        'settings.title': 'Configuración',
        'settings.language': 'Idioma',
        'settings.clearData': 'Borrar todos los datos',
        'settings.clearDataDesc': 'Elimina todos los proyectos guardados',
        'settings.clearButton': 'Borrar',
        'settings.clearTitle': 'Borrar todos los datos',
        'settings.clearMessage': 'Se eliminarán todos los proyectos guardados en este navegador. No se puede deshacer.',
        'settings.clearConfirm': 'Borrar todo',
        'login.title': 'Bienvenido a Forge AI',
        'login.subtitle': 'Inicia sesión para empezar a crear tus prompts.',
        'login.namePlaceholder': 'Tu nombre',
        'login.emailPlaceholder': 'tu@correo.com',
        'login.submit': 'Continuar',
        'login.note': 'Solo demo — nada se envía a ningún lado, se queda en tu dispositivo.'
    }
};

const I18n = {

    current: DEFAULT_LANGUAGE,

    // Carga el idioma guardado (o el de por defecto) y lo aplica al DOM
    init() {
        const saved = localStorage.getItem(I18N_STORAGE_KEY);
        this.current = saved && I18N_DICTIONARY[saved] ? saved : DEFAULT_LANGUAGE;
        this.apply();
        return this.current;
    },

    // Cambia el idioma, lo guarda y refresca todo el texto visible
    setLanguage(lang) {
        if (!I18N_DICTIONARY[lang]) return;
        this.current = lang;
        localStorage.setItem(I18N_STORAGE_KEY, lang);
        this.apply();
    },

    // Cicla entre idiomas (para el botón rápido del perfil)
    cycleLanguage() {
        var next = this.current === 'en' ? 'es' : 'en';
        this.setLanguage(next);
    },

    // Devuelve el texto traducido para una clave. Si es una función (con datos dinámicos), la ejecuta.
    t(key, ...args) {
        const entry = I18N_DICTIONARY[this.current]?.[key] ?? I18N_DICTIONARY[DEFAULT_LANGUAGE][key];
        return typeof entry === 'function' ? entry(...args) : entry;
    },

    // Recorre el DOM y traduce todo lo que tenga data-i18n / data-i18n-placeholder
    apply() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.innerHTML = this.t(el.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            if (el.id !== 'prompt-input') {
                el.placeholder = this.t(el.dataset.i18nPlaceholder);
            }
        });
        document.documentElement.lang = this.current;
    }
};
