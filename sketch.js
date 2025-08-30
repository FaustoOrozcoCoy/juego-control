// --- VARIABLES GLOBALES ---

// P5 y Juego
let car;
let carImage;
let track;
let target;
let lastResult = null; // Para mostrar el último resultado en pantalla

// Controles HTML
let systemTypeSelect, tauSlider, osSlider, tsSlider, nmpCheckbox, resetButton, sensitivitySlider;
let tauValueSpan, osValueSpan, tsValueSpan, sensitivityValueSpan;
let firstOrderParamsDiv, secondOrderParamsDiv;
let resultsLog, logList;

// Simulación y Puntuación
let simState = { x1: 0, x2: 0 };
let prevBaseOutput = 0;
const dt = 1 / 60.0;
const STOP_THRESHOLD = 0.1;
let stopTimer = 0;
let isTiming = false;
let startTime = 0;

// Gráficas
let transientChart, historicalChart;
let historicalData = [], historicalLabels = [];

// --- FUNCIONES DE P5.JS ---

function preload() {
    let carSVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAxMiI+PHBhdGggZmlsbD0iI2Y0NDMzNiIgZD0iTTQgMiBBIDIgMiAwIDAgMCAyIDQgTCAyIDggQSAyIDIgMCAwIDAgNCAxMCBMIDIwIDEwIEEgMiAyIDAgMCAwIDIyIDggTCAyMiA0IEEgMiAyIDAgMCAwIDIwIDIgWiIvPjxwYXRoIGZpbGw9IiMwMDAwMDAiIGZD0iTTYgMiBMIDE4IDIgTCAxOCAzIEwgNiAzIFogTTYgOSBMIDE4IDkgTCAxOCAxMCBMIDYgMTAgWiIvPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik01IDMgQSAxIDEgMCAwIDEgNyAzIEwgMTcgMyBBIDEgMSAwIDAgMSAxOSAzIEwgMTkgNCBMIDUgNCBaIi8+PGNpcmNsZSBjeD0iNSIgY3k9Ijcigcj0iMS41IiBmaWxsPSIjMzMzIi8+PGNpcmNsZSBhcyBjeD0iMTkiIGN5PSI3IiByPSIxLjUiIGZpbGw9IiMzMzMiLz48L3N2Zz4=';
    carImage = loadImage(carSVG);
}

function setup() {
    createCanvas(600, 300).parent('game-canvas-container');
    
    track = { x: 50, y: 50, w: 500, h: 200, r: 50, get totalLength() { return (this.w - 2 * this.r) * 2 + (this.h - 2 * this.r) * 2 + 2 * Math.PI * this.r; } };
    target = { distance: (track.w - 2 * track.r) / 2, size: 5 }; // Meta en el centro de la recta superior
    
    setupControls();
    setupCharts();
    resetSimulation();
}

function draw() {
    background(30);
    
    updateSimulation();
    drawTrack();
    drawTarget();
    drawCar();
    displayLastResult();
    updateCharts();
}

// --- LÓGICA DE SIMULACIÓN Y PUNTUACIÓN ---

function updateSimulation() {
    let userInput = 0;
    if (keyIsDown(LEFT_ARROW)) userInput = -1;
    if (keyIsDown(RIGHT_ARROW)) userInput = 1;

    // Iniciar cronómetro si el coche arranca desde el reposo
    if (userInput !== 0 && !isTiming && abs(car.velocity) < STOP_THRESHOLD) {
        isTiming = true;
        startTime = millis();
        lastResult = null; // Borrar resultado anterior
    }

    // Lógica de simulación
    let params = getSystemParams();
    let { a0, a1, b0, b1 } = params;
    
    let x1_dot = simState.x2;
    let x2_dot = -a0 * simState.x1 - a1 * simState.x2 + userInput;
    simState.x1 += x1_dot * dt;
    simState.x2 += x2_dot * dt;
    let baseOutput = b0 * simState.x1 + b1 * simState.x2;
    
    let finalAcceleration = baseOutput;
    if (nmpCheckbox.checked()) {
        const z = 2.0;
        let baseOutput_dot = (baseOutput - prevBaseOutput) / dt;
        finalAcceleration = baseOutput - (1/z) * baseOutput_dot;
    }
    prevBaseOutput = baseOutput;

    // Actualizar física del coche
    let sensitivity = parseFloat(sensitivitySlider.value());
    sensitivityValueSpan.html(sensitivity);
    car.velocity += finalAcceleration * dt * sensitivity;
    car.velocity *= 0.99;
    car.distance += car.velocity * dt * 20; // Escalar para que se mueva a una velocidad razonable

    // Mantener en pista cerrada
    if (car.distance < 0) car.distance += track.totalLength;
    car.distance %= track.totalLength;

    // Lógica de detección de parada
    if (abs(car.velocity) < STOP_THRESHOLD) {
        stopTimer += dt;
    } else {
        stopTimer = 0;
    }

    if (stopTimer > 1.0 && isTiming) {
        calculateAndLogResult();
        isTiming = false;
    }
}

function calculateAndLogResult() {
    const elapsedTime = ((millis() - startTime) / 1000).toFixed(2);
    
    // Calcular la distancia más corta en una pista circular
    let error1 = abs(car.distance - target.distance);
    let error2 = track.totalLength - error1;
    const distanceError = min(error1, error2).toFixed(2);

    lastResult = { time: elapsedTime, error: distanceError };
    
    // Añadir al log
    const newLogItem = document.createElement('li');
    newLogItem.innerText = `Precisión: ${distanceError}px, Tiempo: ${elapsedTime}s`;
    logList.prepend(newLogItem);
    
    // Limitar el log a 3 entradas
    if (logList.children.length > 3) {
        logList.removeChild(logList.lastChild);
    }
    resultsLog.removeClass('hidden');
}


function getSystemParams() {
    let a0, a1, b0, b1, tau;
    if (systemTypeSelect.value() === 'first-order') {
        tau = parseFloat(tauSlider.value());
        tauValueSpan.html(tau.toFixed(1));
        a1 = 1 / tau; a0 = 0; b1 = 0; b0 = 1 / tau;
    } else {
        let os = parseFloat(osSlider.value());
        let ts = parseFloat(tsSlider.value());
        osValueSpan.html(os); tsValueSpan.html(ts.toFixed(1));
        let zeta = -Math.log(os / 100) / Math.sqrt(Math.PI**2 + Math.log(os / 100)**2);
        let omega_n = 4 / (zeta * ts);
        a1 = 2 * zeta * omega_n; a0 = omega_n**2; b1 = 0; b0 = omega_n**2;
        tau = 1 / (zeta * omega_n);
    }
    return { a0, a1, b0, b1, tau };
}

// --- CONFIGURACIÓN Y ACTUALIZACIÓN DE UI Y GRÁFICAS ---

function setupControls() {
    systemTypeSelect = select('#system-type');
    tauSlider = select('#tau-slider'); tauValueSpan = select('#tau-value');
    osSlider = select('#os-slider'); osValueSpan = select('#os-value');
    tsSlider = select('#ts-slider'); tsValueSpan = select('#ts-value');
    nmpCheckbox = select('#nmp-checkbox');
    sensitivitySlider = select('#sensitivity-slider'); sensitivityValueSpan = select('#sensitivity-value');
    resetButton = select('#reset-button');
    firstOrderParamsDiv = select('#first-order-params'); secondOrderParamsDiv = select('#second-order-params');
    resultsLog = select('#results-log'); logList = select('#log-list').elt;

    systemTypeSelect.changed(toggleParamsVisibility);
    resetButton.mousePressed(resetSimulation);
}

function toggleParamsVisibility() { /* ... (código sin cambios) ... */ }
function setupCharts() { /* ... (código sin cambios) ... */ }

function updateCharts() {
    historicalData.push(car.velocity);
    historicalLabels.push('');
    historicalChart.update();

    let params = getSystemParams();
    let windowSize = Math.floor(5 * params.tau / dt);
    transientChart.data.datasets[0].data = historicalData.slice(-windowSize);
    transientChart.data.labels = historicalLabels.slice(-windowSize);
    transientChart.update();
}

function resetSimulation() {
    car = { distance: 0, velocity: 0, angle: 0 };
    simState = { x1: 0, x2: 0 };
    prevBaseOutput = 0;
    stopTimer = 0;
    isTiming = false;
    lastResult = null;
    
    historicalData.length = 0; historicalLabels.length = 0;
    
    // Limpiar el log visual
    resultsLog.addClass('hidden');
    while (logList.firstChild) {
        logList.removeChild(logList.firstChild);
    }
}


// --- FUNCIONES DE DIBUJO ---

function drawCar() {
    let { x, y } = getTrackCoordinates(car.distance);
    push();
    translate(x, y);
    rotate(car.angle);
    imageMode(CENTER);
    image(carImage, 0, 0, 30, 15);
    pop();
}

function drawTarget() {
    let { x, y } = getTrackCoordinates(target.distance);
    let angle = car.angle; // Usamos el último ángulo calculado para la orientación
    push();
    translate(x, y);
    rotate(angle);
    stroke(0, 188, 212);
    strokeWeight(4);
    line(0, -10, 0, 10);
    pop();
}

function displayLastResult() {
    if (lastResult) {
        push();
        textAlign(CENTER, CENTER);
        textSize(18);
        fill(255);
        text(`¡Detenido! Precisión: ${lastResult.error}px, Tiempo: ${lastResult.time}s`, width / 2, 25);
        pop();
    }
}

function getTrackCoordinates(d) {
    const w = track.w - 2 * track.r;
    const h = track.h - 2 * track.r;
    const c = 2 * Math.PI * track.r;

    const p1 = w, p2 = p1 + c / 4, p3 = p2 + h, p4 = p3 + c / 4, p5 = p4 + w, p6 = p5 + c / 4, p7 = p6 + h;
    let x, y, angle_rad;

    if (d < p1) { // Recta superior
        x = track.x + track.r + d; y = track.y + track.r; angle_rad = 0;
    } else if (d < p2) { // Esquina superior derecha
        let angle = (d - p1) / (c / 4) * (HALF_PI); angle_rad = angle;
        x = track.x + track.r + w + track.r * sin(angle); y = track.y + track.r - track.r * cos(angle);
    } else if (d < p3) { // Recta derecha
        x = track.x + track.r + w + track.r; y = track.y + track.r + (d - p2); angle_rad = HALF_PI;
    } else if (d < p4) { // Esquina inferior derecha
        let angle = (d - p3) / (c / 4) * (HALF_PI) + HALF_PI; angle_rad = angle;
        x = track.x + track.r + w + track.r * cos(angle - HALF_PI); y = track.y + track.r + h + track.r * sin(angle - HALF_PI);
    } else if (d < p5) { // Recta inferior
        x = track.x + track.r + w - (d - p4); y = track.y + track.r + h + track.r; angle_rad = PI;
    } else if (d < p6) { // Esquina inferior izquierda
        let angle = (d - p5) / (c / 4) * (HALF_PI) + PI; angle_rad = angle;
        x = track.x + track.r - track.r * sin(angle - PI); y = track.y + track.r + h - track.r * cos(angle - PI);
    } else if (d < p7) { // Recta izquierda
        x = track.x; y = track.y + track.r + h - (d - p6); angle_rad = 3 * HALF_PI;
    } else { // Esquina superior izquierda
        let angle = (d - p7) / (c / 4) * (HALF_PI) + 3 * HALF_PI; angle_rad = angle;
        x = track.x + track.r * sin(angle - 3*HALF_PI); y = track.y + track.r - track.r * cos(angle - 3*HALF_PI);
    }
    car.angle = angle_rad;
    return { x: x, y: y };
}

function drawTrack() {
    noFill(); stroke(200); strokeWeight(20); strokeJoin(ROUND);
    rect(track.x, track.y, track.w, track.h, track.r);
}

// Re-pegar la función toggleParamsVisibility aquí, ya que no cambió.
function toggleParamsVisibility() {
    if (systemTypeSelect.value() === 'first-order') {
        firstOrderParamsDiv.removeClass('hidden');
        secondOrderParamsDiv.addClass('hidden');
    } else {
        firstOrderParamsDiv.addClass('hidden');
        secondOrderParamsDiv.removeClass('hidden');
    }
}

// Re-pegar la función setupCharts aquí, ya que no cambió.
function setupCharts() {
    const chartOptions = {
        scales: { 
            y: { beginAtZero: false, ticks: {color: '#f0f0f0'} }, 
            x: { display: false } 
        },
        plugins: { legend: { display: false } },
        animation: { duration: 0 }
    };
    const transientCtx = document.getElementById('transient-chart').getContext('2d');
    transientChart = new Chart(transientCtx, {
        type: 'line', data: { labels: [], datasets: [{ data: [], borderColor: '#00bcd4', borderWidth: 2, pointRadius: 0 }] },
        options: chartOptions
    });
    const historicalCtx = document.getElementById('historical-chart').getContext('2d');
    historicalChart = new Chart(historicalCtx, {
        type: 'line', data: { labels: historicalLabels, datasets: [{ data: historicalData, borderColor: '#ff9800', borderWidth: 2, pointRadius: 0 }] },
        options: chartOptions
    });
}
