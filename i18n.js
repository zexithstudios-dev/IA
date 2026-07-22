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
        'login.note': 'Demo only — nothing is sent anywhere, this stays on your device.',

        'app.footer': 'Forge AI can make mistakes. Verify important info.',
        'profile.settings': 'Settings',
        'profile.language': 'Language',
        'profile.logout': 'Log out',
        'model.selector.effort': 'Effort',
        'model.selector.thinking': 'Thinking',
        'model.selector.thinkingDesc': 'Reason before responding',
        'model.selector.moreModels': 'More models',
        'model.selector.back': '← Models',
        'settings.search': 'Search',
        'settings.configSection': 'Configuration',
        'settings.customizeSection': 'Customize',
        'settings.nav.general': 'General',
        'settings.nav.account': 'Account',
        'settings.nav.privacy': 'Privacy',
        'settings.nav.language': 'Language',
        'settings.nav.data': 'Data',
        'settings.general.profile': 'Profile',
        'settings.general.fullName': 'Full name',
        'settings.general.nickname': 'How do you want Forge to call you?',
        'settings.general.job': 'What best describes your job?',
        'settings.general.instructions': 'Instructions for Forge',
        'settings.general.instructionsDesc': 'Forge will keep this in mind in all chats.',
        'settings.general.instructionsPlaceholder': 'e.g. keep explanations brief and accurate',
        'settings.general.preferences': 'Preferences',
        'settings.general.appearance': 'Appearance',
        'settings.account.title': 'Account',
        'settings.account.email': 'Email:',
        'settings.account.logout': 'Log out',
        'settings.privacy.title': 'Privacy',
        'settings.privacy.desc': 'Your data is stored locally in your browser. We do not share information with third parties.',
        'settings.language.title': 'Language',
        'settings.data.title': 'Data',
        'settings.data.desc': 'Delete all your projects and saved data.',
        'settings.data.clearButton': 'Clear all data'
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
        'login.note': 'Solo demo — nada se envía a ningún lado, se queda en tu dispositivo.',

        'app.footer': 'Forge AI puede cometer errores. Verifica la info importante.',
        'profile.settings': 'Configuración',
        'profile.language': 'Idioma',
        'profile.logout': 'Cerrar sesión',
        'model.selector.effort': 'Esfuerzo',
        'model.selector.thinking': 'Pensamiento',
        'model.selector.thinkingDesc': 'Razona antes de responder',
        'model.selector.moreModels': 'Más modelos',
        'model.selector.back': '← Modelos',
        'settings.search': 'Buscar',
        'settings.configSection': 'Configuración',
        'settings.customizeSection': 'Personalizar',
        'settings.nav.general': 'General',
        'settings.nav.account': 'Cuenta',
        'settings.nav.privacy': 'Privacidad',
        'settings.nav.language': 'Idioma',
        'settings.nav.data': 'Datos',
        'settings.general.profile': 'Perfil',
        'settings.general.fullName': 'Nombre completo',
        'settings.general.nickname': '¿Cómo quieres que Forge te llame?',
        'settings.general.job': '¿Qué describe mejor tu trabajo?',
        'settings.general.instructions': 'Instrucciones para Forge',
        'settings.general.instructionsDesc': 'Forge tendrá esto en cuenta en todos los chats.',
        'settings.general.instructionsPlaceholder': 'p. ej. mantener las explicaciones breves y precisas',
        'settings.general.preferences': 'Preferencias',
        'settings.general.appearance': 'Apariencia',
        'settings.account.title': 'Cuenta',
        'settings.account.email': 'Email:',
        'settings.account.logout': 'Cerrar sesión',
        'settings.privacy.title': 'Privacidad',
        'settings.privacy.desc': 'Tus datos se almacenan localmente en tu navegador. No compartimos información con terceros.',
        'settings.language.title': 'Idioma',
        'settings.data.title': 'Datos',
        'settings.data.desc': 'Elimina todos tus proyectos y datos guardados.',
        'settings.data.clearButton': 'Borrar todos los datos'
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
