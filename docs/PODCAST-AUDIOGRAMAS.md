# Podcast y audiogramas — archivo de continuidad

Estado: pausado el 30 de julio de 2026. No forma parte de la interfaz activa del CRM.

## Qué se construyó

- Generación de voz con Gemini 2.5 Flash Preview TTS usando `GEMINI_API_KEY`.
- Soporte para una o dos voces en español, con instrucciones de tono y ritmo.
- Conversión de WAV a MP4 vertical 720×1280 con FFmpeg.
- Subtítulos SRT y onda reactiva para audiogramas.
- Vista previa en el CRM y descarga del MP4.

## Por qué se pausó

- La prueba producía aproximadamente 15 segundos para el guion corto.
- En algunos navegadores el audio se reproducía sin sonido y el analizador recibía silencio.
- La descarga del MP4 no fue confiable en el flujo de producción.
- Se decidió concentrar el CRM en publicaciones escritas, assets visuales, notas, aprobaciones y programación.

## Historial técnico

La implementación estuvo en estos componentes antes de retirarse de la interfaz:

- `src/googleTtsService.js`
- `src/audiogramService.js`
- Rutas de voz y audiograma en `src/publicationRoutes.js`
- Controles de audio en `public/crm/index.html` y `public/crm/app.js`
- Pruebas originales en `test/testAudiogram.js`

La dependencia `ffmpeg-static` y la configuración `GEMINI_TTS_MODEL` fueron retiradas del despliegue activo. El historial de Git conserva la implementación anterior; para localizarla:

```bash
git log --all -- src/googleTtsService.js src/audiogramService.js
```

## Cómo retomarlo

1. Reintroducir las rutas `/api/publicaciones/:id/voice` y `/api/publicaciones/:id/audiogram`.
2. Restaurar los controles de audio sólo en una vista separada de laboratorio, no en el flujo principal de aprobación.
3. Usar un guion objetivo de 45–60 segundos y medir la duración real del WAV antes de renderizar.
4. Validar el audio descargado con un reproductor externo y verificar que el navegador no esté silenciado.
5. Probar primero con un archivo generado localmente y después en Render con `GEMINI_API_KEY` configurada.
6. Mantener la aprobación doble de Artemio y Edgar independiente de la generación del asset.

No se publicó ningún podcast ni audiograma desde el CRM.
