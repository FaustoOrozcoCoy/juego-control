// --- VARIABLES GLOBALES ---

// P5 y Juego
let car;
let target;
const FRICTION = 0.98; // Una fricción simple para que el coche se detenga
let gameCanvas;

// Controles HTML
let zeroSlider, zeroValueSpan, resetButton;

// Simulación de Control
let state_x = 0; // Estado interno del sistema
let dt = 1 / 60.0; // Paso de tiempo, asumimos 60 FPS

// Gráfica de Chart.js
let velocityChart;
let chartData = [];
let chartLabels = [];
const MAX_DATA_POINTS = 200;

// --- FUNCIÓN DE SETUP DE P5.JS (se ejecuta una vez) ---

function setup() {
    // Configuración del lienzo del juego
    gameCanvas = createCanvas(500, 150);
    gameCanvas.parent('game-canvas-container'); // Adjunta el canvas al div correcto

    // Inicializar los objetos del juego
    resetGame();
    target = { x: width * 0.8, size: 20 };

    // Vincular los elementos de control del HTML
    zeroSlider = select('#zero-slider');
    zeroValueSpan = select('#zero-value');
    resetButton = select('#reset-button');
    resetButton.mousePressed(resetGame);

    // Configuración de la gráfica de Chart.js
    const ctx = document.getElementById('velocity-chart').getContext('2d');
    velocityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Velocidad del Coche',
                data: chartData,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Velocidad' }
                },
                x: {
                    display: false // No mostramos etiquetas en el eje X para una vista en tiempo real
                }
            },
            animation: { duration: 0 } // Desactivamos la animación para un rendimiento en tiempo real
        }
    });
}

// --- FUNCIÓN DE DRAW DE P5.JS (bucle principal del juego) ---

function draw() {
    background(30); // Fondo oscuro

    // --- MANEJO DE ENTRADA DEL USUARIO ---
    let userInput = 0;
    if (keyIsDown(LEFT_ARROW)) {
        userInput = -1;
    }
    if (keyIsDown(RIGHT_ARROW)) {
        userInput = 1;
    }
    
    // --- SIMULACIÓN DEL SISTEMA DE CONTROL ---
    // Función de transferencia: G(s) = (-s + a) / (s + b) donde a=zeroLocation, b=1
    // Esto se puede representar en espacio de estados para una simulación fácil.
    // x_dot = -b*x + (a+b)*u
    // y = x - u  (donde 'y' es la aceleración del coche)
    
    let zeroLocation = parseFloat(zeroSlider.value());
    let poleLocation = 1.0;

    // Método de Euler para resolver la ecuación diferencial
    let x_dot = -poleLocation * state_x + (zeroLocation + poleLocation) * userInput;
    state_x += x_dot * dt;
    
    let acceleration = state_x - userInput;
    
    // Actualizar la física del coche
    car.velocity += acceleration * dt * 50; // El *50 es para escalar y que se sienta mejor
    car.velocity *= FRICTION; // Aplicar fricción
    car.x += car.velocity;

    // --- DIBUJAR LOS ELEMENTOS DEL JUEGO ---
    drawTrack();
    drawTarget();
    drawCar();

    // --- ACTUALIZAR LA INTERFAZ ---
    zeroValueSpan.html(zeroLocation.toFixed(1));
    updateChart();
}

// --- FUNCIONES AUXILIARES ---

function resetGame() {
    // Reinicia la posición y velocidad del coche
    car = { x: width * 0.1, y: height * 0.7, size: 30, velocity: 0 };
    // Reinicia el estado del sistema de control
    state_x = 0;
    // Reinicia los datos de la gráfica
    chartData.length = 0;
    chartLabels.length = 0;
}

function updateChart() {
    // Añadir el nuevo dato de velocidad
    chartData.push(car.velocity);
    chartLabels.push(''); // Etiqueta vacía para el eje X

    // Mantener la gráfica con un número limitado de puntos para que no se sature
    if (chartData.length > MAX_DATA_POINTS) {
        chartData.shift();
        chartLabels.shift();
    }

    // Actualizar la gráfica
    velocityChart.update();
}

function drawCar() {
    fill(150, 150, 250); // Color del coche
    noStroke();
    rectMode(CENTER);
    rect(car.x, car.y, car.size, car.size / 2);
}

function drawTarget() {
    fill(76, 175, 80, 150); // Color del objetivo (verde semitransparente)
    noStroke();
    rectMode(CENTER);
    rect(target.x, height / 2, target.size, height);
}

function drawTrack() {
    stroke(200);
    strokeWeight(2);
    line(0, height * 0.85, width, height * 0.85);
}