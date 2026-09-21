# Seguimiento completo de coaches

## Objetivo
Cerrar el ciclo de seguimiento con evidencia enlazada, respuesta del coach, línea de tiempo de clase, perfil histórico y vista mensual operativa.

## Implementación

1. **Evidencia y reporte**
   - Añadir hora de inicio de grabación y marcadores `mm:ss` por ítem, conservando todos los marcadores en el comentario.
   - Generar enlaces de Zoom con `startTime` cuando exista hora de inicio; mantener chips informativos sin enlace cuando falte.
   - Corregir el LOB para tomarlo siempre de la ficha del coach.

2. **Respuesta y compromiso del coach**
   - Incorporar “Tu turno” al reporte público, con validación, una sola respuesta y confirmación visual.
   - Mostrar la respuesta o el estado pendiente en reportes internos.
   - Recuperar el compromiso anterior en el siguiente monitoreo y registrar Cumplido, Parcial o No cumplido.
   - Añadir el estado de respuesta a la lista de monitoreos.

3. **Línea de tiempo de clase**
   - Crear cálculos puros para fases, sugerencias de break/AF/closing y participación durante AF.
   - Añadir editor visual por barra y campos `mm:ss` en Talking time.
   - Guardar fases y métricas derivadas; mostrarlas entre rúbrica y talking time en el reporte.

4. **Perfil del coach**
   - Crear `/coaches/:id` con cabecera, KPIs mensuales, tendencia de 12 monitoreos, historial, AOIs recurrentes e ítems más fallados.
   - Enlazar coaches desde el catálogo y permitir iniciar un monitoreo ya precargado.

5. **Vista mensual**
   - Crear `/mes` con selector de mes, resumen del equipo, filas por coach, semáforos y alertas por reglas.
   - Para senior/admin, añadir filtro y resumen por coordinador.
   - Exportar dos hojas Excel: detalle de monitoreos y resumen por coach.

6. **Navegación y configuración**
   - Ordenar la barra lateral: Mes, Mis coaches, Monitoreos, Analizador, Plantillas y Configuración.
   - Cambiar el inicio autenticado a `/mes` y añadir las configuraciones de mínimo AF y días de respuesta.

7. **Validación**
   - Añadir pruebas de normalización de AOIs, fases, alumnos en AF y alertas.
   - Verificar compilación, pruebas y recorridos principales en escritorio y móvil.

## Detalles técnicos
- Los cálculos de transcript, alertas y exportación se ejecutarán localmente, sin IA ni APIs externas.
- La respuesta pública pasará por una función segura del servidor con validación; no habrá escritura pública directa a la base de datos.
- Se mantendrán los permisos existentes para coordinador, senior y admin.
