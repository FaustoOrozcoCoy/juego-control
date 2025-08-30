// --- VARIABLES GLOBALES ---

// P5 y Juego
let car;
let carImage;
let track;

// Controles HTML
let systemTypeSelect;
let tauSlider, tauValueSpan;
let osSlider, osValueSpan;
let tsSlider, tsValueSpan;
let nmpCheckbox;
let resetButton;
let firstOrderParamsDiv, secondOrderParamsDiv;

// Simulación
let simState = { x1: 0, x2: 0 };
let prevBaseOutput = 0;
const dt = 1 / 60.0; // 60 FPS

// Gráficas
let transientChart, historicalChart;
let transientData = [], transientLabels = [];
let historicalData = [], historicalLabels = [];

// --- FUNCIONES DE P5.JS ---

function preload() {
    // Carga la imagen del coche. El SVG está codificado para no depender de archivos externos.
    let carSVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAxMiI+PHBhdGggZmlsbD0iI2Y0NDMzNiIgZD0iTTQgMiBBIDIgMiAwIDAgMCAyIDQgTCAyIDggQSAyIDIgMCAwIDAgNCAxMCBMIDIwIDEwIEEgMiAyIDAgMCAwIDIyIDggTCAyMiA0IEEgMiAyIDAgMCAwIDIwIDIgWiIvPjxwYXRoIGZpbGw9IiMwMDAwMDAiIGQ9Ik02IDIgTCAxOCAyIEwgMTggMyBMIDYgMyBaIE0gNiA5IEwgMTggOSBMIDE4IDEwIEwgNiAxMCBaIi8+PHBhdGggZmlsbD0iI2FmZDEyMyIgZD0iTTUgMyBBIDEgMSAwIDAgMSA3IDMgTCAxNyAzIEEgMSAxIDAgMCAxIDE5IDMgTCAxOSA0IEwgNSA0IFoiLz48Y2lyY2xlIGN4PSI1IiBjeT0iNyIgcj0iMS41IiBmaWxsPSIjMzMzIi8+PGNpcmNsZSBjeD0iMTkiIGN5PSI3IiByPSIxLjUiIGZpbGw9IiMzMzMiLz48L3N2Zz4=';
    carImage = loadImage(carSVG);
}

function setup() {
    createCanvas(600, 300).parent('game-canvas-container');
    
    // Configuración de la pista
    track = {
        x: 50, y: 50, w: 500, h: 200, r: 50,
        get totalLength() {
            return (this.w - 2 * this.r) * 2 + (this.h - 2 * this.r) * 2 + 2 * Math.PI * this.r;
        }
    };
    
    // Controles HTML
    setupControls();
    
    // Gráficas
    setupCharts();

    // Juego
    resetSimulation();
}

function draw() {
    background(30);
    
    // Actualizar y dibujar
    updateSimulation();
    drawTrack();
    drawCar();
    updateCharts();
}


// --- LÓGICA DE SIMULACIÓN Y CONTROL ---

function updateSimulation() {
    let userInput = 0;
    if (keyIsDown(LEFT_ARROW)) userInput = -1; // Frenar
    if (keyIsDown(RIGHT_ARROW)) userInput = 1;  // Acelerar

    // Obtener parámetros de la UI
    let params = getSystemParams();
    let { a0, a1, b0, b1, tau } = params;

    // Simulación del sistema base (sin cero NMP) usando espacio de estados
    let x1_dot = simState.x2;
    let x2_dot = -a0 * simState.x1 - a1 * simState.x2 + userInput;
    
    simState.x1 += x1_dot * dt;
    simState.x2 += x2_dot * dt;

    let baseOutput = b0 * simState.x1 + b1 * simState.x2;
    
    // Lógica para añadir el cero de fase no mínima si está activo
    let finalAcceleration = baseOutput;
    if (nmpCheckbox.checked()) {
        const z = 2.0; // Posición del cero NMP
        // Derivada numérica: y_dot ≈ (y[k] - y[k-1]) / dt
        let baseOutput_dot = (baseOutput - prevBaseOutput) / dt;
        finalAcceleration = baseOutput - (1/z) * baseOutput_dot;
    }
    prevBaseOutput = baseOutput;

    // Actualizar física del coche
    car.velocity += finalAcceleration * dt * 20; // Escalar para mejor sensación
    car.velocity *= 0.99; // Fricción
    car.distance += car.velocity;
    
    // Mantener el coche en la pista cerrada
    if (car.distance < 0) car.distance += track.totalLength;
    car.distance = car.distance % track.totalLength;
}

function getSystemParams() {
    let a0, a1, b0, b1, tau;

    if (systemTypeSelect.value() === 'first-order') {
        tau = parseFloat(tauSlider.value());
        tauValueSpan.html(tau.toFixed(1));
        
        // G(s) = 1 / (tau*s + 1) -> forma canónica: (1/tau) / (s + 1/tau)
        a1 = 1 / tau;
        a0 = 0; // Para la forma de 2do orden
        b1 = 0;
        b0 = 1 / tau;

    } else { // second-order
        let os = parseFloat(osSlider.value());
        let ts = parseFloat(tsSlider.value());
        osValueSpan.html(os);
        tsValueSpan.html(ts.toFixed(1));

        // Convertir %OS y Ts a ζ y ωn
        let zeta = -Math.log(os / 100) / Math.sqrt(Math.PI**2 + Math.log(os / 100)**2);
        let omega_n = 4 / (zeta * ts); // Usando criterio del 2%

        // G(s) = omega_n^2 / (s^2 + 2*zeta*omega_n*s + omega_n^2)
        a1 = 2 * zeta * omega_n;
        a0 = omega_n**2;
        b1 = 0;
        b0 = omega_n**2;
        tau = 1 / (zeta * omega_n); // Constante de tiempo dominante
    }
    return { a0, a1, b0, b1, tau };
}


// --- CONFIGURACIÓN Y ACTUALIZACIÓN DE UI Y GRÁFICAS ---

function setupControls() {
    systemTypeSelect = select('#system-type');
    tauSlider = select('#tau-slider');
    tauValueSpan = select('#tau-value');
    osSlider = select('#os-slider');
    osValueSpan = select('#os-value');
    tsSlider = select('#ts-slider');
    tsValueSpan = select('#ts-value');
    nmpCheckbox = select('#nmp-checkbox');
    resetButton = select('#reset-button');
    
    firstOrderParamsDiv = select('#first-order-params');
    secondOrderParamsDiv = select('#second-order-params');

    systemTypeSelect.changed(toggleParamsVisibility);
    resetButton.mousePressed(resetSimulation);
}

function toggleParamsVisibility() {
    if (systemTypeSelect.value() === 'first-order') {
        firstOrderParamsDiv.removeClass('hidden');
        secondOrderParamsDiv.addClass('hidden');
    } else {
        firstOrderParamsDiv.addClass('hidden');
        secondOrderParamsDiv.removeClass('hidden');
    }
}

function setupCharts() {
    const chartOptions = {
        scales: { y: { beginAtZero: false, ticks: {color: '#f0f0f0'} }, x: { display: false } },
        plugins: { legend: { display: false } },
        animation: { duration: 0 }
    };
    const transientCtx = document.getElementById('transient-chart').getContext('2d');
    transientChart = new Chart(transientCtx, {
        type: 'line', data: { labels: transientLabels, datasets: [{ data: transientData, borderColor: '#00bcd4', borderWidth: 2, pointRadius: 0 }] },
        options: chartOptions
    });
    const historicalCtx = document.getElementById('historical-chart').getContext('2d');
    historicalChart = new Chart(historicalCtx, {
        type: 'line', data: { labels: historicalLabels, datasets: [{ data: historicalData, borderColor: '#ff9800', borderWidth: 2, pointRadius: 0 }] },
        options: chartOptions
    });
}

function updateCharts() {
    // Añadir nuevos datos
    historicalData.push(car.velocity);
    historicalLabels.push('');

    // Actualizar gráfica histórica
    historicalChart.update();

    // Actualizar gráfica transitoria
    let params = getSystemParams();
    let windowSize = Math.floor(5 * params.tau / dt); // Ventana de 5 constantes de tiempo
    transientChart.data.datasets[0].data = historicalData.slice(-windowSize);
    transientChart.data.labels = historicalLabels.slice(-windowSize);
    transientChart.update();
}

function resetSimulation() {
    car = { distance: 0, velocity: 0, angle: 0 };
    simState = { x1: 0, x2: 0 };
    prevBaseOutput = 0;
    
    // Resetear datos de gráficas
    historicalData.length = 0; historicalLabels.length = 0;
    transientData.length = 0; transientLabels.length = 0;
}


// --- FUNCIONES DE DIBUJO ---

function drawCar() {
    let { x, y } = getTrackCoordinates(car.distance);
    
    push();
    translate(x, y);
    rotate(car.angle);
    imageMode(CENTER);
    image(carImage, 0, 0, 40, 20); // Dibuja la imagen del coche
    pop();
}

function getTrackCoordinates(d) {
    const w = track.w - 2 * track.r;
    const h = track.h - 2 * track.r;
    const c = 2 * Math.PI * track.r; // Circunferencia de las esquinas

    const p1 = w;           // Fin de la recta superior
    const p2 = p1 + c / 4;  // Fin de la esquina superior derecha
    const p3 = p2 + h;      // Fin de la recta derecha
    const p4 = p3 + c / 4;  // Fin de la esquina inferior derecha
    const p5 = p4 + w;      // Fin de la recta inferior
    const p6 = p5 + c / 4;  // Fin de la esquina inferior izquierda
    const p7 = p6 + h;      // Fin de la recta izquierda
    // p8 (totalLength) es el fin de la esquina superior izquierda

    let x, y;
    if (d < p1) { // Recta superior
        x = track.x + track.r + d;
        y = track.y;
        car.angle = 0;
    } else if (d < p2) { // Esquina superior derecha
        let angle = (d - p1) / (c / 4) * (Math.PI / 2);
        x = track.x + track.r + w + track.r * Math.sin(angle);
        y = track.y + track.r - track.r * Math.cos(angle);
        car.angle = angle;
    } else if (d < p3) { // Recta derecha
        x = track.x + track.w;
        y = track.y + track.r + (d - p2);
        car.angle = Math.PI / 2;
    } else if (d < p4) { // Esquina inferior derecha
        let angle = (d - p3) / (c / 4) * (Math.PI / 2) + Math.PI / 2;
        x = track.x + track.r + w - track.r * Math.cos(angle - Math.PI/2);
        y = track.y + track.r + h + track.r * Math.sin(angle - Math.PI/2);
        car.angle = angle;
    } else if (d < p5) { // Recta inferior
        x = track.x + track.r + w - (d - p4);
        y = track.y + track.h;
        car.angle = Math.PI;
    } else if (d < p6) { // Esquina inferior izquierda
        let angle = (d - p5) / (c/4) * (Math.PI/2) + Math.PI;
        x = track.x + track.r - track.r * Math.sin(angle - Math.PI);
        y = track.y + track.r + h - track.r * Math.cos(angle - Math.PI);
        car.angle = angle;
    } else if (d < p7) { // Recta izquierda
        x = track.x;
        y = track.y + track.r + h - (d - p6);
        car.angle = 3 * Math.PI / 2;
    } else { // Esquina superior izquierda
        let angle = (d - p7) / (c/4) * (Math.PI/2) + 3 * Math.PI / 2;
        x = track.x + track.r - track.r * Math.cos(angle - 3*Math.PI/2);
        y = track.y + track.r - track.r * Math.sin(angle - 3*Math.PI/2);
        car.angle = angle;
    }
    return { x: x, y: y + track.r }; // El + track.r centra la pista en el canvas
}


function drawTrack() {
    noFill();
    stroke(200);
    strokeWeight(2);
    rect(track.x, track.y, track.w, track.h, track.r);
}
