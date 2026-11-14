/* Datos FICTICIOS de demostración. No son mediciones reales. */
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
const N = 14;
const DATES = Array.from({ length: N }, (_, i) => { const d = new Date(TODAY); d.setDate(d.getDate() - (N - 1 - i)); return d; });
const nz = (i, s) => Math.sin(i * 12.9898 + s * 78.233);
const gen = f => Array.from({ length: N }, (_, i) => f(i));
const r1 = v => Math.round(v * 10) / 10;

const METRICS = [
  { k: 'hr', label: 'Frecuencia cardíaca', unit: 'BPM', dec: 0, rec: 'cardio',
    series: gen(i => Math.round(62 + (i > 7 ? (i - 7) * 1.3 : 0) + nz(i, 1) * 1.2)),
    ask: 'momento del día, actividad previa y sensación de esfuerzo.' },
  { k: 'bp', label: 'Presión arterial', unit: 'mmHg', dec: 0, rec: 'cardio',
    series: gen(i => Math.round(118 + (i > 8 ? (i - 8) * .5 : 0) + nz(i, 2) * 2)),
    dia: gen(i => Math.round(76 + nz(i, 3) * 2)),
    ask: 'postura al medir, hidratación y descanso previo.' },
  { k: 'temp', label: 'Temperatura corporal', unit: '°C', dec: 1, rec: 'rest',
    series: gen(i => r1(36.6 + nz(i, 4) * .12)),
    ask: 'temperatura de la cabina y ropa utilizada.' },
  { k: 'glu', label: 'Glucosa sanguínea', unit: 'mg/dL', dec: 0, rec: 'fitness',
    series: gen(i => Math.round(92 + nz(i, 5) * 3)),
    ask: 'tiempo desde la última comida y tipo de alimento.' },
  { k: 'sleep', label: 'Horas de sueño', unit: 'h', dec: 1, rec: 'rest',
    series: gen(i => r1(7.1 + nz(i, 6) * .15 - (i > 6 ? (i - 6) * .17 : 0))),
    ask: 'hora de acostarse, interrupciones, ruido y luz en el módulo.' },
  { k: 'well', label: 'Bienestar y fatiga', unit: '/10', dec: 1, rec: 'rest',
    series: gen(i => r1(7.8 + nz(i, 7) * .2 - (i > 8 ? (i - 8) * .25 : 0))),
    ask: 'carga de trabajo, estado de ánimo y contacto social reciente.' }
];

const CATS = [
  { k: 'muscle', name: 'Actividades musculares' },
  { k: 'cardio', name: 'Seguimiento cardiovascular' },
  { k: 'mobility', name: 'Movilidad y coordinación' },
  { k: 'fitness', name: 'Condición física' },
  { k: 'rest', name: 'Descanso y recuperación' }
];

/* Actividades ilustrativas, asignadas y supervisadas por profesionales (ficticio). */
const ACT = [
  { id: 'a1', cat: 'muscle', name: 'Resistencia con banda elástica', goal: 'Mantener la fuerza de piernas y espalda', desc: 'Serie asignada de tracción y empuje con banda.', min: 30 },
  { id: 'a2', cat: 'muscle', name: 'Circuito de core', goal: 'Estabilidad del tronco', desc: 'Secuencia de posturas de control del tronco.', min: 15 },
  { id: 'a3', cat: 'cardio', name: 'Ergómetro a ritmo moderado', goal: 'Seguimiento de la respuesta cardiovascular', desc: 'Pedaleo continuo; se anota la sensación de esfuerzo.', min: 30 },
  { id: 'a4', cat: 'cardio', name: 'Registro de pulso en reposo', goal: 'Comparar con la referencia personal', desc: 'Medición tranquila sentado, dos minutos.', min: 5 },
  { id: 'a5', cat: 'mobility', name: 'Secuencia de movilidad articular', goal: 'Rango de movimiento', desc: 'Giros suaves de hombros, caderas y columna.', min: 15 },
  { id: 'a6', cat: 'mobility', name: 'Ejercicios de coordinación', goal: 'Equilibrio y orientación', desc: 'Tareas de alcance y seguimiento visual.', min: 10 },
  { id: 'a7', cat: 'fitness', name: 'Prueba de condición física guiada', goal: 'Seguimiento semanal', desc: 'Protocolo breve definido por el equipo de apoyo.', min: 20 },
  { id: 'a8', cat: 'fitness', name: 'Registro de energía y alimentación', goal: 'Relacionar energía con comidas', desc: 'Anotar hora y tipo de comida con su nivel de energía.', min: 5 },
  { id: 'a9', cat: 'rest', name: 'Rutina de preparación para dormir', goal: 'Mejorar la regularidad del descanso', desc: 'Pasos previos al sueño: luz baja, pantallas fuera, respiración.', min: 20 },
  { id: 'a10', cat: 'rest', name: 'Pausa de recuperación guiada', goal: 'Reducir la fatiga acumulada', desc: 'Pausa de relajación guiada a mitad de jornada.', min: 15 }
];
