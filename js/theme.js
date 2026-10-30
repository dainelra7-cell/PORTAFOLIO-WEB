/* ==========================================================================
   Alternador de Modo Oscuro / Claro — compartido por todo el portafolio
   - Se carga en el <head> para aplicar el tema antes de pintar (sin parpadeo).
   - Guarda la elección en localStorage ("portafolio-tema") y la comparte con
     los juegos, incluso entre pestañas abiertas (evento "storage").
   - Cualquier botón con el atributo [data-theme-toggle] cambia el tema.
   ========================================================================== */
(() => {
    'use strict';

    const KEY = 'portafolio-tema';
    const root = document.documentElement;

    const read = () => {
        try { return localStorage.getItem(KEY); } catch { return null; }
    };
    const save = (theme) => {
        try { localStorage.setItem(KEY, theme); } catch { /* sin almacenamiento */ }
    };

    const syncButtons = () => {
        const light = root.dataset.theme === 'light';
        document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
            const label = light ? 'Activar modo oscuro' : 'Activar modo claro';
            btn.setAttribute('aria-label', label);
            btn.setAttribute('aria-pressed', String(light));
            btn.title = label;
        });
    };

    const apply = (theme) => {
        root.dataset.theme = theme === 'light' ? 'light' : 'dark';
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            if (!meta.dataset.dark) meta.dataset.dark = meta.content;
            meta.content = root.dataset.theme === 'light'
                ? (meta.dataset.light || '#f3f3ef')
                : meta.dataset.dark;
        }
        syncButtons();
        window.dispatchEvent(new CustomEvent('temachange', { detail: root.dataset.theme }));
    };

    // Tema por defecto: oscuro (identidad de la marca personal)
    apply(read() || 'dark');

    document.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-theme-toggle]');
        if (!btn) return;
        const next = root.dataset.theme === 'light' ? 'dark' : 'light';
        apply(next);
        save(next);
        // Con clic de ratón se quita el foco, para que la barra espaciadora
        // siga controlando el juego (pausa / golpe) y no vuelva a cambiar el tema.
        if (event.detail) btn.blur();
    });

    // Si el tema cambia en otra pestaña (por ejemplo, en el portafolio mientras
    // un juego está abierto), se actualiza aquí también.
    window.addEventListener('storage', (event) => {
        if (event.key === KEY) apply(event.newValue);
    });

    document.addEventListener('DOMContentLoaded', syncButtons);
})();
