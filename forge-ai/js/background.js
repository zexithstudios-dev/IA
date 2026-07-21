/**
 * background.js
 * Partículas flotantes muy sutiles en el fondo de la app, con un ligero
 * parallax al mover el mouse. Puramente decorativo — no depende de nada
 * más de la app y no le importa a nadie más si este archivo no carga.
 */

(function () {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    let mouseX = 0.5; // 0 a 1, relativo al ancho
    let mouseY = 0.5; // 0 a 1, relativo al alto

    const PARTICLE_COUNT = 65;

    function resize() {
        const parent = canvas.parentElement;
        width = canvas.width = parent.clientWidth;
        height = canvas.height = parent.clientHeight;
    }

    function createParticle() {
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 1.5 + 0.5,
            speed: Math.random() * 0.15 + 0.05,
            drift: (Math.random() - 0.5) * 0.2,
            depth: Math.random() * 0.6 + 0.2,
            opacity: Math.random() * 0.4 + 0.1
        };
    }

    function init() {
        resize();
        particles = Array.from({ length: PARTICLE_COUNT }, createParticle);
    }

    function step() {
        ctx.clearRect(0, 0, width, height);

        // Parallax offset based on mouse
        const parallaxX = (mouseX - 0.5) * 30;
        const parallaxY = (mouseY - 0.5) * 20;

        // 1. Draw connecting lines (Plexus effect)
        for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            const d1X = p1.x + parallaxX * p1.depth;
            const d1Y = p1.y + parallaxY * p1.depth;
            
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const d2X = p2.x + parallaxX * p2.depth;
                const d2Y = p2.y + parallaxY * p2.depth;
                
                const dx = d1X - d2X;
                const dy = d1Y - d2Y;
                const distSq = dx * dx + dy * dy;
                
                // If particles are close enough, draw a line
                if (distSq < 16000) {
                    const distance = Math.sqrt(distSq);
                    // Fade out as distance increases
                    const opacity = (1 - distance / 126) * 0.15;
                    ctx.beginPath();
                    ctx.moveTo(d1X, d1Y);
                    ctx.lineTo(d2X, d2Y);
                    ctx.strokeStyle = `rgba(167, 139, 250, ${opacity})`; // Violet color matching the theme
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                }
            }
            
            // 2. Update and draw the particle itself
            p1.y -= p1.speed;
            p1.x += p1.drift;

            // Wrap around edges cleanly
            if (p1.y < -10) { p1.y = height + 10; p1.x = Math.random() * width; }
            if (p1.x < -10) p1.x = width + 10;
            if (p1.x > width + 10) p1.x = -10;

            ctx.beginPath();
            ctx.arc(d1X, d1Y, p1.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(196, 181, 253, ${p1.opacity})`;
            ctx.fill();
        }

        requestAnimationFrame(step);
    }

    window.addEventListener('resize', resize);

    window.addEventListener('mousemove', (e) => {
        const parent = canvas.parentElement;
        const rect = parent.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) / rect.width;
        mouseY = (e.clientY - rect.top) / rect.height;
    });

    document.addEventListener('DOMContentLoaded', () => {
        init();
        if (!prefersReducedMotion) {
            requestAnimationFrame(step);
        } else {
            // Con "reduced motion" dibujamos las partículas quietas, una sola vez
            step_once();
        }
    });

    function step_once() {
        ctx.clearRect(0, 0, width, height);
        for (const p of particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(196, 181, 253, ${p.opacity})`;
            ctx.fill();
        }
    }
})();
