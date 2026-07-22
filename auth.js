/**
 * auth.js
 * Gestiona la autenticación de la aplicación utilizando un sistema OTP de 6 dígitos
 * a través de EmailJS, y guarda la sesión en localStorage para mantener al usuario.
 *
 * Diferencia real entre pestañas:
 * - "Create Account": si el correo ya existe entre las cuentas guardadas en este
 *   navegador, se avisa y no se manda código. Si es nuevo, se verifica por OTP y
 *   luego se guarda como cuenta local.
 * - "Sign In": si el correo YA está guardado en este navegador, se entra directo
 *   (sin pedir OTP de nuevo — ya se verificó al crear la cuenta). Si no existe
 *   ninguna cuenta con ese correo en este navegador, se avisa a crear una primero.
 */

// ============================================================================
// 1. CONFIGURACIÓN DE EMAILJS
// ============================================================================
const EMAILJS_SERVICE_ID = "service_forge_ai";
const EMAILJS_TEMPLATE_ID = "template_9oydchl"; // Reemplaza esto con el ID de tu plantilla en EmailJS

// Variables de estado para el código de seguridad
let generatedOTP = null;
let otpExpiresAt = null;
let pendingEmail = null;
let pendingName = null;

// ============================================================================
// 2. MANEJO DE SESIÓN LOCAL (STORAGE)
// ============================================================================
const AUTH_STORAGE_KEY = 'forge-ai-user';
const ACCOUNTS_STORAGE_KEY = 'forge-ai-accounts';

const Auth = {
    getUser() {
        try {
            const raw = localStorage.getItem(AUTH_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            return null;
        }
    },

    isLoggedIn() {
        return !!this.getUser();
    },

    login(name, email) {
        const user = { name, email, loggedInAt: Date.now() };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        return user;
    },

    logout() {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    },

    // ---- Cuentas guardadas en este navegador (para diferenciar Sign In / Create Account) ----
    getAccounts() {
        try {
            const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (err) {
            return [];
        }
    },

    findAccount(email) {
        const normalized = (email || '').trim().toLowerCase();
        return this.getAccounts().find(function (a) { return a.email.toLowerCase() === normalized; }) || null;
    },

    saveAccount(name, email) {
        const accounts = this.getAccounts();
        const normalized = (email || '').trim().toLowerCase();
        const existingIndex = accounts.findIndex(function (a) { return a.email.toLowerCase() === normalized; });
        const account = { name: name, email: email, createdAt: Date.now() };
        if (existingIndex === -1) {
            accounts.push(account);
        } else {
            accounts[existingIndex] = { ...accounts[existingIndex], name: name };
        }
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
        return account;
    }
};

// ============================================================================
// 3. FUNCIONES DE UI Y TRANSICIÓN
// ============================================================================
function playEntryAnimation() {
    const curtain = document.getElementById('entry-curtain');
    const appRoot = document.getElementById('app-root');

    if (curtain) curtain.classList.add('play');
    if (appRoot) appRoot.classList.add('play');
}

function showLoginError(message) {
    const errorText = document.getElementById('otp-error');
    if (!errorText) return;
    errorText.textContent = message;
    errorText.classList.remove('hidden');
}

function hideLoginError() {
    const errorText = document.getElementById('otp-error');
    if (errorText) errorText.classList.add('hidden');
}

function getCurrentLoginMode() {
    const registerTab = document.getElementById('tab-register');
    return (registerTab && registerTab.classList.contains('active')) ? 'register' : 'login';
}

// Transición directa a la app (sin pasar por OTP), usada en Sign In cuando la
// cuenta ya existe en este navegador.
function completeLogin(name, email) {
    Auth.login(name, email);
    if (window.updateGreeting) window.updateGreeting();
    if (window.updateProfileUI) window.updateProfileUI();

    const loginScreen = document.getElementById('login-screen');
    loginScreen.classList.add('leaving');
    setTimeout(() => {
        loginScreen.style.display = 'none';
        playEntryAnimation();
    }, 350);
}

// ============================================================================
// 4. LÓGICA DE ENVÍO DE CÓDIGO (PASO 1)
// ============================================================================
window.handleSendCode = async function () {
    const nameInput = document.getElementById('login-name');
    const emailInput = document.getElementById('login-email');

    hideLoginError();

    // Forzar validación HTML5
    if (!nameInput.checkValidity() || !emailInput.checkValidity()) {
        nameInput.reportValidity();
        emailInput.reportValidity();
        return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const mode = getCurrentLoginMode();
    const existingAccount = Auth.findAccount(email);

    // ---- Modo "Sign In": la cuenta debe existir ya en este navegador ----
    if (mode === 'login') {
        if (!existingAccount) {
            showLoginError('No encontramos una cuenta con este correo en este navegador. Crea una cuenta primero.');
            return;
        }
        // Ya se verificó por OTP cuando se creó la cuenta: entra directo, sin
        // volver a pedir código.
        completeLogin(existingAccount.name || name, existingAccount.email);
        return;
    }

    // ---- Modo "Create Account": el correo no debe existir todavía ----
    if (mode === 'register' && existingAccount) {
        showLoginError('Ya existe una cuenta con este correo en este navegador. Usa "Sign In" para entrar.');
        return;
    }

    // Generar código de 6 dígitos aleatorio
    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    // Definir expiración en 10 minutos
    otpExpiresAt = Date.now() + 10 * 60 * 1000;
    pendingEmail = email;
    pendingName = name;

    const btnSend = document.getElementById('btn-send-code');
    const btnText = document.getElementById('btn-send-text');
    const originalBtnText = btnText ? btnText.textContent : (btnSend ? btnSend.textContent : '');
    btnSend.disabled = true;
    if (btnText) btnText.textContent = 'Enviando código...'; else btnSend.textContent = 'Enviando código...';

    console.log("Datos enviados a EmailJS:", {
        service: EMAILJS_SERVICE_ID,
        template: EMAILJS_TEMPLATE_ID,
        params: {
            to_name: name,
            to_email: email,
            security_code: generatedOTP
        }
    });

    try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_name: name,
            email: email,
            security_code: generatedOTP
        });

        // Cambiar interfaz al Paso 2 (el título de arriba se queda como está;
        // el mensaje "te enviamos un código a X" vive solo en el bloque dedicado
        // del paso OTP, para no duplicar mensajes)
        document.getElementById('step-credentials').classList.add('hidden');
        document.getElementById('step-otp').classList.remove('hidden');
        const otpEmailDisplay = document.getElementById('otp-email-display');
        if (otpEmailDisplay) otpEmailDisplay.textContent = 'Te enviamos un código a ' + email;

        // Enfocar el input del código
        document.getElementById('otp-input').focus();

    } catch (error) {
        console.error("Error al enviar el correo:", error);
        showLoginError('No pudimos enviar el código de verificación. Revisa la consola o intenta de nuevo.');
    } finally {
        btnSend.disabled = false;
        if (btnText) btnText.textContent = originalBtnText; else btnSend.textContent = originalBtnText;
    }
};

// ============================================================================
// 5. CAMBIO DE PESTAÑA LOGIN / REGISTRO
// ============================================================================
window.switchLoginTab = function (tab) {
    var tabLogin = document.getElementById('tab-login');
    var tabRegister = document.getElementById('tab-register');
    var passwordField = document.getElementById('password-field');
    var btnText = document.getElementById('btn-send-text');

    hideLoginError();

    if (tab === 'register') {
        tabLogin.classList.remove('active', 'text-white', 'bg-[#1c1c20]');
        tabLogin.classList.add('text-zinc-500');
        tabRegister.classList.add('active', 'text-white', 'bg-[#1c1c20]');
        tabRegister.classList.remove('text-zinc-500');
        if (passwordField) passwordField.classList.add('hidden'); // el password no se usa: la verificación real es por OTP
        if (btnText) btnText.textContent = 'Send Security Code';
    } else {
        tabRegister.classList.remove('active', 'text-white', 'bg-[#1c1c20]');
        tabRegister.classList.add('text-zinc-500');
        tabLogin.classList.add('active', 'text-white', 'bg-[#1c1c20]');
        tabLogin.classList.remove('text-zinc-500');
        if (passwordField) passwordField.classList.add('hidden');
        if (btnText) btnText.textContent = 'Sign In';
    }
};

// ============================================================================
// 6. FUNCIÓN PARA CAMBIAR DE CORREO
// ============================================================================
window.resetFormStep = function () {
    document.getElementById('step-otp').classList.add('hidden');
    document.getElementById('step-credentials').classList.remove('hidden');
    hideLoginError();
    document.getElementById('otp-input').value = "";
    generatedOTP = null;
    pendingEmail = null;
    pendingName = null;
};

// ============================================================================
// 7. INICIALIZACIÓN Y EVENTOS PRINCIPALES
// ============================================================================

// ============================================================================
// 8. CERRAR SESIÓN
// ============================================================================
// Solo cierra la sesión activa (borra forge-ai-user). NO borra la lista de
// cuentas guardadas ni los proyectos: así, al volver a "Sign In" con el mismo
// correo, la cuenta sigue reconocida y entra directo sin pedir OTP de nuevo.
window.handleLogout = function () {
    Auth.logout();
    location.reload();
};

document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const loginForm = document.getElementById('login-form');

    // Si ya hay un usuario guardado, entrar directo
    if (Auth.isLoggedIn()) {
        loginScreen.style.display = 'none';
        const curtain = document.getElementById('entry-curtain');
        const appRoot = document.getElementById('app-root');
        if (curtain) curtain.style.display = 'none';
        if (appRoot) appRoot.classList.add('instant');
    } else {
        loginScreen.style.display = 'flex';
    }

    // Interceptar el 'submit' del formulario (aplica para presionar Enter)
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Si aún no hemos generado el código, significa que estamos en el Paso 1 y apretaron Enter
        if (!generatedOTP) {
            handleSendCode();
            return;
        }

        const userOTP = document.getElementById('otp-input').value.trim();

        // Validar que no esté vacío
        if (!userOTP) {
            showLoginError("Please enter the code.");
            return;
        }

        // Validar expiración
        if (Date.now() > otpExpiresAt) {
            showLoginError("Code expired. Please request a new one.");
            return;
        }

        // Validar coincidencia exacta
        if (userOTP === generatedOTP) {
            hideLoginError();

            const name = pendingName || document.getElementById('login-name').value.trim();
            const email = pendingEmail || document.getElementById('login-email').value.trim();

            // Esto solo se alcanza en el flujo de "Create Account": guardamos la
            // cuenta nueva en este navegador y arrancamos sesión.
            Auth.saveAccount(name, email);
            completeLogin(name, email);
        } else {
            showLoginError("Invalid code. Check your inbox and try again.");

            // Vaciar el campo para volver a intentar, con feedback visual de error
            const otpInput = document.getElementById('otp-input');
            otpInput.value = '';
            otpInput.classList.add('error');
            otpInput.addEventListener('animationend', () => otpInput.classList.remove('error'), { once: true });
            otpInput.focus();
        }
    });
});