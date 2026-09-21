# Ajustes de seguimiento y modo Presentar

## Objetivo
Mejorar la vista mensual, generar las fases de clase desde señales reales del transcript y permitir presentar el reporte en Zoom con una vista grande, clara y sin distracciones.

## Cambios

### 1. Alertas mensuales
- Ampliar `monthlyAlerts` con:
  - **Coach habla de más** cuando el promedio mensual de `students_pct` esté por debajo de `talk_time_yellow`.
  - **Auto 5** cuando al menos un monitoreo del mes tenga penalidad aplicada.
- Incluir `transcript_metrics`, `penalty_applied` y `talk_time_yellow` en los datos de `/mes`.
- Mostrar específicamente estas dos alertas con estilo rojo; conservar el estilo actual de las demás.
- Actualizar las pruebas para cubrir ambas reglas y los casos sin transcript.

### 2. Fases sugeridas desde el transcript
- Crear una función pura que calcule los inicios sugeridos usando segmentos y roles confirmados:
  - **Contenido:** fin del primer silencio de al menos 30 segundos después del minuto 3; minuto 5 como respaldo.
  - **Break:** primer segmento del coach que diga `break` y esté seguido por 90 segundos o más sin habla; si no existe, usar el silencio más largo entre los minutos 25 y 40.
  - **AF:** primer segmento del coach que diga `automatic fluency` o contenga `AF` como término independiente.
  - **Cierre:** dos minutos antes de terminar la clase.
  - **Inicio:** segundo 0.
- Evitar fases inválidas o fuera de orden cuando una señal no exista o la clase sea corta.
- Usar estas sugerencias al analizar el transcript en el paso 3.
- Marcar cada valor inicial con la etiqueta **Sugerido**, manteniendo los campos editables para que el coordinador los mueva.
- Añadir una prueba con `break` seguido por un silencio de al menos 90 segundos.

### 3. Modo Presentar del reporte
- Añadir el botón **Presentar** dentro del reporte para que aparezca tanto en la vista interna como en el enlace público.
- Abrir una capa de pantalla completa, blanca y sin barra lateral ni botones administrativos.
- Aumentar la tipografía aproximadamente 20–25 % y distribuir el contenido en cuatro pantallas:
  1. Puntaje, Kudos y AOIs.
  2. Rúbrica visual y penalidades/bonus.
  3. Línea de tiempo y Talking time.
  4. Comparación anterior y respuesta/compromiso del coach.
- Añadir indicador `1 / 4`, botones grandes **Anterior / Siguiente**, flechas izquierda/derecha del teclado y `Esc` para salir.
- Intentar activar la pantalla completa del navegador cuando esté disponible y salir de ella al cerrar.
- Mantener el reporte normal y su impresión sin cambios fuera del modo Presentar.

## Validación
- Ejecutar las pruebas de alertas, fases y transcript.
- Comprobar tipos del proyecto.
- Probar en navegador la navegación con botones, flechas y Escape, tanto en reporte interno como público.
