# QA Coaches E4K — Monitoreo y reporte

## Objetivo
Construir el flujo completo de monitoreo manual, análisis de talking time y reporte visual compartible.

## Alcance
- Wizard de cuatro pasos para crear y editar borradores, con autoguardado.
- Rúbrica dinámica según plantilla, estudiantes, penalidades, bonus, kudos y AOIs.
- Integración del analizador existente sin guardar fuera del monitoreo.
- Reporte reutilizable para vista interna, vista pública e impresión.
- Lista filtrable de monitoreos con permisos de edición.
- Cambio de base de datos para token público y lectura pública limitada.
- Pruebas de scoring y AOIs resueltos.

## Seguridad y permisos
- Mantener las escrituras bajo las reglas actuales de coordinador/admin.
- La lectura pública será exclusivamente por token UUID, solo para monitoreos enviados y sin transcript crudo.
- La edición de enviados se validará en la interfaz y en la base de datos: coordinador durante 48 horas; senior/admin después.

## Implementación técnica
- Extender `monitorings` con `share_token` único e índice.
- Añadir una función pública de lectura que arme un JSON limitado con reporte, comparación y últimos seis puntajes.
- Crear componentes visuales reutilizables para puntaje, semáforo, áreas, ítems y talking time.
- Separar formulario, persistencia y presentación del reporte para reutilizar la vista previa.
- Usar las consultas y mutaciones existentes con refresco y mensajes de éxito/error.
- Mantener todo el análisis del transcript en el navegador.

## Validación
- Pruebas unitarias de points_sum, area_weighted, checklist y AOIs resueltos.
- Verificación del flujo crear → autoguardar → revisar → enviar → compartir.
- Revisión visual en escritorio y móvil, incluida impresión.
