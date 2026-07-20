/**
 * auth.js
 * Gestiona la autenticación de la aplicación utilizando un sistema OTP de 6 dígitos
 * a través de EmailJS, y guarda la sesión en localStorage para mantener al usuario.
 */

// ============================================================================
// 1. CONFIGURACIÓN DE EMAILJS
// ============================================================================
const EMAILJS_SERVICE_ID = "service_forge_ai";
const EMAILJS_TEMPLATE_ID = "template_9oydchl"; // Reemplaza esto con el ID de tu plantilla en EmailJS

// Variables de estado para el código de seguridad
let generatedOTP = null;
let otpExpiresAt = null;

// ============================================================================
// 2. MANEJO DE SESIÓN LOCAL (STORAGE)
// ============================================================================
const AUTH_STORAGE_KEY = 'forge-ai-user';

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

// ============================================================================
// 4. LÓGICA DE ENVÍO DE CÓDIGO (PASO 1)
// ============================================================================
window.handleSendCode = async function () {
    const nameInput = document.getElementById('login-name');
    const emailInput = document.getElementById('login-email');
    const errorText = document.getElementById('otp-error');

    errorText.classList.add('hidden');

    // Forzar validación HTML5
    if (!nameInput.checkValidity() || !emailInput.checkValidity()) {
        nameInput.reportValidity();
        emailInput.reportValidity();
        return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    // Generar código de 6 dígitos aleatorio
    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    // Definir expiración en 10 minutos
    otpExpiresAt = Date.now() + 10 * 60 * 1000;

    const btnSend = document.getElementById('btn-send-code');
    const originalBtnText = btnSend.textContent;
    btnSend.disabled = true;
    btnSend.textContent = "Sending code...";

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

        // Cambiar interfaz al Paso 2
        document.getElementById('step-credentials').classList.add('hidden');
        document.getElementById('step-otp').classList.remove('hidden');
        document.getElementById('login-title').textContent = "Security Check";
        document.getElementById('login-subtitle').textContent = `We sent a code to ${email}`;

        // Enfocar el input del código
        document.getElementById('otp-input').focus();

    } catch (error) {
        console.error("Error al enviar el correo:", error);
        errorText.textContent = "Could not send verification code. Check console or try again.";
        errorText.classList.remove('hidden');
    } finally {
        btnSend.disabled = false;
        btnSend.textContent = originalBtnText;
    }
};

// ============================================================================
// 5. FUNCIÓN PARA CAMBIAR DE CORREO
// ============================================================================
window.resetFormStep = function () {
    document.getElementById('step-otp').classList.add('hidden');
    document.getElementById('step-credentials').classList.remove('hidden');
    document.getElementById('login-title').textContent = "Welcome to Forge AI";
    document.getElementById('login-subtitle').textContent = "Sign in to start building your prompts.";
    document.getElementById('otp-error').classList.add('hidden');
    document.getElementById('otp-input').value = "";
    generatedOTP = null;
};

// ============================================================================
// 6. INICIALIZACIÓN Y EVENTOS PRINCIPALES
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const loginForm = document.getElementById('login-form');

    // Si ya hay un usuario guardado, entrar directo
    if (Auth.isLoggedIn()) {
        loginScreen.style.display = 'none';
        playEntryAnimation();
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
        const errorText = document.getElementById('otp-error');

        // Validar que no esté vacío
        if (!userOTP) {
            errorText.textContent = "Please enter the code.";
            errorText.classList.remove('hidden');
            return;
        }

        // Validar expiración
        if (Date.now() > otpExpiresAt) {
            errorText.textContent = "Code expired. Please request a new one.";
            errorText.classList.remove('hidden');
            return;
        }

        // Validar coincidencia exacta
        if (userOTP === generatedOTP) {
            errorText.classList.add('hidden');

            const name = document.getElementById('login-name').value.trim();
            const email = document.getElementById('login-email').value.trim();

            // Guardar sesión
            Auth.login(name, email);

            // Transición a la app
            loginScreen.classList.add('leaving');
            setTimeout(() => {
                loginScreen.style.display = 'none';
                playEntryAnimation();
            }, 350);
        } else {
            errorText.textContent = "Invalid code. Check your inbox and try again.";
            errorText.classList.remove('hidden');

            // Vaciar el campo para volver a intentar
            const otpInput = document.getElementById('otp-input');
            otpInput.value = '';
            otpInput.focus();
        }
    });
});
