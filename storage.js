/**
 * storage.js
 * Capa de persistencia. Todo lo que toca localStorage vive aquí.
 * Si mañana quieres cambiar a un backend real (API, base de datos),
 * solo tienes que reescribir las funciones de este archivo:
 * el resto de la app (app.js) no necesita saber cómo se guardan los datos.
 */

const STORAGE_KEY = 'forge-ai-projects';

const ForgeStorage = {

    // Devuelve todos los proyectos guardados (array de objetos)
    getAll() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (err) {
            console.error('Error leyendo proyectos de localStorage:', err);
            return [];
        }
    },

    // Guarda la lista completa de proyectos
    saveAll(projects) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
        } catch (err) {
            console.error('Error guardando proyectos en localStorage:', err);
        }
    },

    // Crea un proyecto nuevo y lo persiste
    create(name) {
        const projects = this.getAll();
        const project = {
            id: 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            name: name,
            prompt: '',
            attachment: null, // { name, lineCount, content } si el texto pegado es muy largo
            createdAt: Date.now()
        };
        projects.push(project);
        this.saveAll(projects);
        return project;
    },

    // Actualiza un proyecto existente (merge parcial)
    update(id, changes) {
        const projects = this.getAll();
        const index = projects.findIndex(p => p.id === id);
        if (index === -1) return null;
        projects[index] = { ...projects[index], ...changes };
        this.saveAll(projects);
        return projects[index];
    },

    // Elimina un proyecto
    remove(id) {
        const projects = this.getAll().filter(p => p.id !== id);
        this.saveAll(projects);
    },

    // Busca un proyecto por id
    getById(id) {
        return this.getAll().find(p => p.id === id) || null;
    }
};
