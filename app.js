// Initialize Lucide Icons
lucide.createIcons();

// --- STATE MANAGEMENT API (LocalStorage) ---
const STORAGE_KEY = 'gymtrack_data_v3';

function getWorkouts() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
}

function saveWorkout(workout, isEdit = false) {
    const data = getWorkouts();
    if (isEdit) {
        const idx = data.findIndex(w => w.id === workout.id);
        if (idx !== -1) data[idx] = workout;
    } else {
        data.push(workout);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    updateDatalists();
}

function updateDatalists() {
    const data = getWorkouts();
    const sessionList = document.getElementById('session-names-list');
    const exerciseList = document.getElementById('exercise-names-list');
    if (!sessionList || !exerciseList) return;

    const sessions = new Set();
    const exercises = new Set();

    data.forEach(w => {
        if (w.name) sessions.add(w.name);
        w.exercises.forEach(ex => {
            if (ex.name) exercises.add(ex.name);
        });
    });

    sessionList.innerHTML = [...sessions].map(s => `<option value="${s}">`).join('');
    exerciseList.innerHTML = [...exercises].map(e => `<option value="${e}">`).join('');
}

// --- VIEW NAVIGATION ---
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-target="${viewId}"]`);
    if (activeNav) activeNav.classList.add('active');

    if (viewId === 'dashboard') updateDashboard();
    if (viewId === 'history') updateHistory();
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(item.dataset.target);
    });
});

// --- DASHBOARD LOGIC ---
let volumeChartInstance = null;

function calculateVolume(workout) {
    let vol = 0;
    workout.exercises.forEach(ex => {
        ex.sets.forEach(set => {
            vol += (set.reps * (set.weight || 1));
        });
    });
    return vol;
}

function updateDashboard() {
    const data = getWorkouts();
    
    document.getElementById('metric-total-workouts').textContent = data.length;
    
    let totalVolume = 0;
    data.forEach(w => totalVolume += calculateVolume(w));
    document.getElementById('metric-total-volume').textContent = totalVolume.toLocaleString();

    const ctx = document.getElementById('volumeChart').getContext('2d');
    const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Group volume by date for chart
    const volumeByDate = {};
    sorted.forEach(w => {
        const dStr = new Date(w.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (!volumeByDate[dStr]) volumeByDate[dStr] = 0;
        volumeByDate[dStr] += calculateVolume(w);
    });

    const labels = Object.keys(volumeByDate);
    const volumes = Object.values(volumeByDate);

    if (volumeChartInstance) volumeChartInstance.destroy();
    
    volumeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Volume (kg)',
                data: volumes,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#fff',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

// --- WORKOUT LOGGING LOGIC ---
const form = document.getElementById('workout-form');
const exercisesContainer = document.getElementById('exercises-container');
const btnAddEx = document.getElementById('btn-add-exercise');
let editingWorkoutId = null;

function resetLogForm() {
    form.reset();
    editingWorkoutId = null;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('workout-date').value = now.toISOString().slice(0, 16);
    exercisesContainer.innerHTML = '';
    addExerciseRow();
}

function addExerciseRow(initialData = null) {
    const tpl = document.getElementById('exercise-row-template').content.cloneNode(true);
    const card = tpl.querySelector('.exercise-card');
    const setContainer = card.querySelector('.sets-container');
    
    if (initialData) {
        card.querySelector('.ex-name').value = initialData.name;
        setContainer.innerHTML = '';
        initialData.sets.forEach((set, idx) => {
            const setTpl = document.getElementById('set-row-template').content.cloneNode(true);
            setTpl.querySelector('.set-num').textContent = `Set ${idx + 1}`;
            setTpl.querySelector('.ex-reps').value = set.reps;
            setTpl.querySelector('.ex-weight').value = set.weight;
            setContainer.appendChild(setTpl);
        });
    }

    card.querySelector('.btn-add-set').addEventListener('click', () => {
        const setTpl = document.getElementById('set-row-template').content.cloneNode(true);
        setTpl.querySelector('.set-num').textContent = `Set ${setContainer.children.length + 1}`;
        setContainer.appendChild(setTpl);
    });

    card.querySelector('.btn-remove-ex').addEventListener('click', () => {
        card.remove();
    });

    exercisesContainer.appendChild(card);
    lucide.createIcons({ root: card });
}

btnAddEx.addEventListener('click', () => addExerciseRow());

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('workout-name').value || 'Unspecified Workout';
    const dateInput = document.getElementById('workout-date').value;
    const finalDate = new Date(dateInput).toISOString();

    const exercises = [];
    document.querySelectorAll('.exercise-card').forEach(card => {
        const exName = card.querySelector('.ex-name').value;
        if (!exName) return;
        const sets = [];
        card.querySelectorAll('.set-row').forEach(row => {
            const reps = parseInt(row.querySelector('.ex-reps').value) || 0;
            const weight = parseFloat(row.querySelector('.ex-weight').value) || 0;
            sets.push({ reps, weight });
        });
        exercises.push({ name: exName, sets });
    });

    if (exercises.length === 0) {
        alert("Please add at least one exercise.");
        return;
    }

    const workout = {
        id: editingWorkoutId || Date.now(),
        date: finalDate,
        name: nameInput,
        exercises
    };

    saveWorkout(workout, !!editingWorkoutId);
    resetLogForm();
    switchView('history');
});

function editWorkoutDirect(id) {
    const data = getWorkouts();
    const workout = data.find(w => w.id === id);
    if (!workout) return;

    switchView('log-workout');

    editingWorkoutId = workout.id;
    document.getElementById('workout-name').value = workout.name;
    
    const d = new Date(workout.date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    document.getElementById('workout-date').value = d.toISOString().slice(0, 16);

    exercisesContainer.innerHTML = '';
    workout.exercises.forEach(ex => {
        addExerciseRow(ex);
    });
}
window.editWorkoutDirect = editWorkoutDirect;


// --- HISTORY & COMPARATIVE TABLE LOGIC ---
const workoutFilter = document.getElementById('workout-filter');

function updateHistory() {
    const data = getWorkouts();
    
    // Populate dropdown options uniquely
    const uniqueNames = [...new Set(data.map(w => w.name))];
    const currentValue = workoutFilter.value;
    
    let optionsHtml = '<option value="">-- Choose Workout --</option>';
    uniqueNames.forEach(name => {
        const selected = (name === currentValue) ? 'selected' : '';
        optionsHtml += `<option value="${name}" ${selected}>${name}</option>`;
    });
    workoutFilter.innerHTML = optionsHtml;

    // Render Table
    renderComparativeTable();
}

workoutFilter.addEventListener('change', renderComparativeTable);

function getRoutineImage(routineName) {
    const n = (routineName || '').toLowerCase();
    if (n.includes('push') || n.includes('chest') || n.includes('shoulder')) return 'assets/push.png';
    if (n.includes('pull') || n.includes('back') || n.includes('row')) return 'assets/pull.png';
    if (n.includes('leg') || n.includes('squat')) return 'assets/legs.png';
    return null;
}

function renderComparativeTable() {
    const data = getWorkouts();
    const selectedName = workoutFilter.value;
    const thead = document.getElementById('ctable-head');
    const tbody = document.getElementById('ctable-body');

    if (!selectedName) {
        thead.innerHTML = '';
        tbody.innerHTML = `<tr><td style="padding: 32px; color: var(--text-muted); text-align: center;">Please select a workout routine above to view progression.</td></tr>`;
        return;
    }

    // Filter and sort ASCENDING by date (columns left to right progression)
    const filteredWorkouts = data.filter(w => w.name === selectedName).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Determine unique row keys: "ExerciseName_SetRank"
    const rowMap = new Map(); // key -> { exerciseName, setIndex }
    
    filteredWorkouts.forEach(w => {
        w.exercises.forEach(ex => {
            ex.sets.forEach((set, sIdx) => {
                const key = `${ex.name}_${sIdx}`;
                if (!rowMap.has(key)) {
                    rowMap.set(key, { exerciseName: ex.name, setIndex: sIdx });
                }
            });
        });
    });

    // Generate Headers (Dates + Edit Button)
    const iconUrl = getRoutineImage(selectedName);
    const iconHtml = iconUrl ? `<img src="${iconUrl}" style="width: 64px; height: 64px; object-fit: cover; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(16,185,129,0.3); border: 2px solid var(--primary-color);">` : '';

    let headHtml = `<tr><th style="min-width: 200px; text-align: left; vertical-align: top;">
        ${iconHtml}
        <div style="font-size: 16px; font-weight: 700; color: #fff;">${selectedName}</div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Exercise Details</div>
    </th>`;
    filteredWorkouts.forEach(w => {
        const d = new Date(w.date);
        const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        headHtml += `
            <th style="min-width: 120px; text-align: center;">
                <div style="font-weight: 600; color: #fff; margin-bottom: 8px;">${dateStr}</div>
                <button class="table-btn" onclick="window.editWorkoutDirect(${w.id}); return false;" style="font-size: 11px;">Edit Session</button>
            </th>
        `;
    });
    headHtml += `</tr>`;
    thead.innerHTML = headHtml;

    // Generate Rows
    let bodyHtml = '';
    if (rowMap.size === 0) {
        bodyHtml = `<tr><td colspan="${filteredWorkouts.length + 1}" style="text-align: center;">No exercises logged.</td></tr>`;
    } else {
        rowMap.forEach((val, key) => {
            bodyHtml += `<tr>`;
            bodyHtml += `<td style="font-weight: 500; color: var(--primary-color);">
                ${val.exerciseName} <span style="color: var(--text-muted); font-size: 12px; margin-left: 4px;">(Set ${val.setIndex + 1})</span>
            </td>`;
            
            // Cells per Workout
            filteredWorkouts.forEach(w => {
                // Find if this workout had this exercise and set
                const exMatch = w.exercises.find(e => e.name === val.exerciseName);
                if (exMatch && exMatch.sets[val.setIndex]) {
                    const setObj = exMatch.sets[val.setIndex];
                    bodyHtml += `<td style="text-align: center; color: var(--text-primary); font-family: monospace; font-size: 14px;">
                        ${setObj.weight}kg <span style="color: var(--text-muted);">x</span> ${setObj.reps}
                    </td>`;
                } else {
                    bodyHtml += `<td style="text-align: center; color: var(--text-muted);">—</td>`;
                }
            });
            bodyHtml += `</tr>`;
        });
    }
    
    tbody.innerHTML = bodyHtml;
}

// Init
resetLogForm();
updateDatalists();
updateDashboard();

// --- PWA SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered!', reg))
            .catch(err => console.log('SW registration failed', err));
    });
}

// --- PWA INSTALL PROMPT LOGIC ---
let deferredPrompt;
const installBtn = document.getElementById('btn-install-pwa');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    if(installBtn) installBtn.style.display = 'flex';
});

if(installBtn) {
    installBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        // Hide the app provided install promotion
        installBtn.style.display = 'none';
        // Show the install prompt
        if (deferredPrompt) {
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
        }
    });
}

window.addEventListener('appinstalled', () => {
    // Clear the deferredPrompt so it can be garbage collected
    deferredPrompt = null;
    console.log('PWA was installed');
});

// --- DATA RESET LOGIC ---
const btnResetData = document.getElementById('btn-reset-data');
if (btnResetData) {
    btnResetData.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm("Are you sure you want to permanently erase ALL past tracked workouts? This cannot be undone!")) {
            localStorage.removeItem(STORAGE_KEY);
            window.location.reload();
        }
    });
}
