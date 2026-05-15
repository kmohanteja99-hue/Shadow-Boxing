const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const scoreEl = document.getElementById('score');
const speedEl = document.getElementById('speed');

let score = 0;
let targets = [];
let particles = [];
let saberHistory = { 'L': [], 'R': [] };
let velocityHistory = { 'L': [], 'R': [] };

// --- AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playLaserSound() {
    if (audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

// --- DRAWING THE SABER ---
function drawMegaSaber(ctx, x, y, angle, side) {
    const saberColor = side === 'L' ? "#00FFFF" : "#FF00FF";
    
    // Wave Trail
    saberHistory[side].push({x, y, angle});
    if (saberHistory[side].length > 12) saberHistory[side].shift();

    if (saberHistory[side].length > 2) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (let i = 0; i < saberHistory[side].length - 1; i++) {
            const h = saberHistory[side][i];
            const next = saberHistory[side][i+1];
            ctx.beginPath();
            ctx.moveTo(h.x, h.y);
            ctx.lineTo(h.x + Math.sin(h.angle) * 600, h.y - Math.cos(h.angle) * 600);
            ctx.lineTo(next.x + Math.sin(next.angle) * 600, next.y - Math.cos(next.angle) * 600);
            ctx.lineTo(next.x, next.y);
            ctx.fillStyle = saberColor;
            ctx.globalAlpha = (i / 12) * 0.2;
            ctx.fill();
        }
        ctx.restore();
    }

    // Main Blade
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowBlur = 40;
    ctx.shadowColor = saberColor;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 15;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -600); 
    ctx.stroke();
    ctx.restore();
}

function spawnTarget() {
    if (targets.length < 1) {
        targets.push({
            x: Math.random() * (canvasElement.width - 200) + 100,
            y: Math.random() * (canvasElement.height - 200) + 100,
            r: 50
        });
    }
}

function onResults(results) {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
    const w = canvasElement.width;
    const h = canvasElement.height;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, w, h);
    canvasCtx.drawImage(results.image, 0, 0, w, h);

    spawnTarget();

    if (results.poseLandmarks) {
        const lm = results.poseLandmarks;
        const arms = [
            { elb: 13, wrist: 15, palm: 19, side: 'L' },
            { elb: 14, wrist: 16, palm: 20, side: 'R' }
        ];

        arms.forEach(arm => {
            const hx = lm[arm.palm].x * w;
            const hy = lm[arm.palm].y * h;
            let angle = 0;

            if (lm[arm.elb].visibility > 0.5) {
                const ex = lm[arm.elb].x * w;
                const ey = lm[arm.elb].y * h;
                angle = Math.atan2(hy - ey, hx - ex) + Math.PI / 2;
            }

            drawMegaSaber(canvasCtx, hx, hy, angle, arm.side);

            // Simple Hit Detection
            targets.forEach((t, i) => {
                const d = Math.sqrt(Math.pow(hx - t.x, 2) + Math.pow(hy - t.y, 2));
                if (d < 450) { 
                    score += 100;
                    scoreEl.innerText = `IMPACT: ${score}`;
                    playLaserSound();
                    targets.splice(i, 1);
                }
            });
        });
    }

    // Draw Targets
    targets.forEach(t => {
        canvasCtx.beginPath();
        canvasCtx.arc(t.x, t.y, t.r, 0, 2*Math.PI);
        canvasCtx.strokeStyle = 'white';
        canvasCtx.lineWidth = 5;
        canvasCtx.stroke();
    });

    canvasCtx.restore();
}

const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({ modelComplexity: 0, minDetectionConfidence: 0.5 });
pose.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await pose.send({image: videoElement}); },
    width: 1280, height: 720
});

window.addEventListener('click', () => audioCtx.resume());
camera.start();