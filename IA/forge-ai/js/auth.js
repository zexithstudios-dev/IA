/**
 * auth.js
 * Puerta de entrada muy simple, solo para este demo: pide nombre + correo
 * antes de dejar entrar a la app. NO es autenticación real (no hay backend,
 * no valida el correo, no hay contraseña) — solo guarda el dato en localStorage
 * para no volver a preguntar la próxima vez que abras la página.
 *
 * Si algún día conectas un backend de verdad, este es el único archivo
 * que necesitas reemplazar: el resto de la app no sabe cómo se hizo el login.
 */

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

// ---------- Orquestación del gate de login + animación de entrada ----------

function playEntryAnimation() {
    document.getElementById('entry-curtain').classList.add('play');
    document.getElementById('app-root').classList.add('play');
}

document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const loginForm = document.getElementById('login-form');

    if (Auth.isLoggedIn()) {
        // Ya había iniciado sesión antes: saltamos directo a la app
        loginScreen.style.display = 'none';
        playEntryAnimation();
    } else {
        // Primera vez: se queda en la pantalla de login hasta que complete el formulario
        loginScreen.style.display = 'flex';
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('login-name').value.trim();
        const email = document.getElementById('login-email').value.trim();
        if (!name || !email) return;

        Auth.login(name, email);

        loginScreen.classList.add('leaving');
        setTimeout(() => {
            loginScreen.style.display = 'none';
            playEntryAnimation();
        }, 350);
    });
});
