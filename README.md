# AstroCare Mission Health — prototipo (Cosmic Pirates)

Prototipo funcional y DEMOSTRATIVO con dos paneles conectados: **Monitor** y **Recovery**.
Datos ficticios; no hay sensores, diagnóstico, tratamiento ni conexión con la NASA.

## Ejecutar en VS Code
1. Abre la carpeta `astrocare` en VS Code (Archivo > Abrir carpeta).
2. Opción A: instala la extensión **Live Server**, clic derecho en `index.html` > *Open with Live Server*.
3. Opción B: haz doble clic en `index.html` (funciona sin servidor ni Internet).

## Estructura
- `index.html` — estructura y navegación
- `styles.css` — identidad visual
- `data.js` — datos y actividades ficticias
- `app.js` — lógica, gráficas SVG propias, persistencia (localStorage) e informe

## Funciones
- Gráfica interactiva (7/14 días), referencia personal, tendencia y estados demostrativos.
- Observaciones automáticas y registro propio; Monitor enlaza con actividades de Recovery.
- Registro de actividades, progreso diario e historial; todo persiste al recargar.
- Indicador de modo offline, exportación de informe (.txt) y botón para restablecer la demo.
- Reglas de estado: ±8 % y ±15 % frente a la referencia personal (demostrativas, sin validez clínica).
- Gráfica **En vivo (simulada)**: muestras aleatorias cada 1,5 s; se pausa al pasar el cursor.
- Recovery: actividades pendientes en rojo y completadas en verde; el progreso del día pasa a verde al completar todo.

## Conectar un Galaxy Watch 4 (pulso real por Bluetooth)
1. En el reloj instala **Heart for Bluetooth** desde la Play Store del reloj (requiere Wear OS 3.5 o superior) y ábrela hasta ver tu pulso.
2. Abre AstroCare en **Chrome o Edge** (Android o PC), con HTTPS (GitHub Pages) o `localhost` (Live Server). No funciona en iPhone/Safari.
3. En Monitor pulsa **Conectar reloj** y elige el reloj. Luego selecciona *Frecuencia cardíaca* > *En vivo*.
- Solo el pulso es real; el resto sigue simulado. Es un dato de bienestar, no médico.
- Si se corta la conexión, mantén la app abierta en el reloj y vuelve a conectar (el Watch 4 puede cambiar su dirección Bluetooth).
- Pulso real con semáforo: verde 60-100 BPM, amarillo en la zona intermedia y rojo bajo 50 o sobre 120 (valores en reposo, demostrativos y editables en el panel del reloj; no son clínicos).

## Mediciones registradas (manual)
En Monitor, el panel **Mediciones registradas** permite anotar presión, temperatura, glucosa, sueño, bienestar, oxígeno (SpO2) y composición corporal, con fecha, hora y fuente (por ejemplo "Samsung Health (manual)").
- Los indicadores con registros usan esos valores en vez de los simulados; la referencia personal es el promedio de las 3 primeras mediciones.
- Se guardan en el navegador, funcionan sin Internet, se pueden eliminar y salen en el informe exportado.
- Son datos de bienestar, no médicos; las zonas y estados son demostrativos.
