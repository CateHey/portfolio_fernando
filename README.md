# Portafolio — Luis Fernando Varas

Sitio personal de Luis Fernando Varas Padilla, estudiante de Ingeniería Mecatrónica (UNI, Lima).
Bilingüe (español por defecto, inglés con un clic), sin dependencias ni paso de build.

## Estructura

```
index.html            Página completa (textos en español)
css/style.css         Estilos
js/i18n.js            Traducciones ES / EN (edita los textos aquí)
js/main.js            Cambio de idioma, loader, cursor, animaciones
CV_FERNANDO_VARAS.docx  CV enlazado desde el botón "Descargar CV"
```

## Ver en local

Abre `index.html` en el navegador, o sirve la carpeta:

```
npx serve .
```

## Desplegar en Vercel

1. Sube el repositorio a GitHub.
2. En Vercel: **Add New → Project → Import** el repo.
3. Framework Preset: **Other**. No necesita build command ni output directory.
4. Deploy.

Cada `git push` a `main` vuelve a desplegar automáticamente.

## Editar contenido

- Textos: `js/i18n.js` tiene cada frase en `es` y `en`. Cambia ambas.
- Idioma por defecto: español. Se recuerda la elección del visitante. `?lang=en` fuerza inglés.
- CV: reemplaza `CV_FERNANDO_VARAS.docx` (idealmente por un PDF y actualiza el `href` del botón en `index.html`).
- Colores y tipografías: variables al inicio de `css/style.css`.
