// 1. Tab Navigation Logic
function switchTab(tabId, event) {
    document.querySelectorAll('.page-section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    if (tabId === 'dashboard') loadDashboardStats();
    stopQRScanner(); // Stop camera if they switch tabs
    document.getElementById('global-qr-group').style.display = 'none';
}

// 2. Dashboard Logic
async function loadDashboardStats() {
    const loadingEl = document.getElementById('dash-loading');
    const contentEl = document.getElementById('dash-content');
    loadingEl.style.display = 'block'; contentEl.style.display = 'none';

    const stats = await fetchDashboardStats();

    if (stats) {
        document.getElementById('stat-total').innerText = stats.total;
        document.getElementById('stat-refunds').innerText = stats.refunds;
        document.getElementById('stat-5k-timed').innerText = stats.timed5k;
        document.getElementById('stat-5k-untimed').innerText = stats.untimed5k;
        document.getElementById('stat-10k-timed').innerText = stats.timed10k;
        document.getElementById('stat-10k-untimed').innerText = stats.untimed10k;
        loadingEl.style.display = 'none'; contentEl.style.display = 'block';
    } else {
        loadingEl.innerText = "Error loading data. Please check connection.";
    }
}

// 3. Search Mode Switching & QR Logic
let html5QrcodeScanner = null;
let currentScannerContext = 'reg'; // Tracks which tab activated the camera

function switchSearchMode(mode, context, event) {
    currentScannerContext = context;
    
    // Highlight the correct tab within the section
    const activeSection = document.getElementById(context === 'reg' ? 'registration' : 'timed-bibs');
    activeSection.querySelectorAll('.search-tab').forEach(tab => tab.classList.remove('active'));
    if (event) event.currentTarget.classList.add('active');

    const inputGroup = document.getElementById(context === 'reg' ? 'manual-input-group' : 'timed-manual-input-group');
    const qrGroup = document.getElementById('global-qr-group');
    const searchInput = document.getElementById(context === 'reg' ? 'search-input' : 'timed-search-input');
    
    document.getElementById(context === 'reg' ? 'registration-results' : 'timed-results').innerHTML = "";

    if (mode === 'qr') {
        inputGroup.style.display = 'none';
        activeSection.insertBefore(qrGroup, activeSection.lastElementChild); // Move scanner UI to active tab
        qrGroup.style.display = 'block';
        startQRScanner();
    } else {
        inputGroup.style.display = 'flex';
        qrGroup.style.display = 'none';
        stopQRScanner();
        
        searchInput.placeholder = mode === 'email' ? "Enter Email ID..." : "Enter Booking ID (e.g. DFCG...)";
        searchInput.type = mode === 'email' ? "email" : "text";
        searchInput.value = "";
    }
}

function startQRScanner() {
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    }
}

function stopQRScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(e => console.error(e));
        html5QrcodeScanner = null;
    }
}

function onScanSuccess(decodedText) {
    stopQRScanner();
    document.getElementById('global-qr-group').style.display = 'none';
    
    const inputGroup = document.getElementById(currentScannerContext === 'reg' ? 'manual-input-group' : 'timed-manual-input-group');
    const searchInput = document.getElementById(currentScannerContext === 'reg' ? 'search-input' : 'timed-search-input');
    
    inputGroup.style.display = 'flex';
    searchInput.value = decodedText;
    
    // Reset tabs back to ID visually
    const activeSection = document.getElementById(currentScannerContext === 'reg' ? 'registration' : 'timed-bibs');
    activeSection.querySelectorAll('.search-tab')[0].classList.add('active');
    activeSection.querySelectorAll('.search-tab')[2].classList.remove('active');

    if (currentScannerContext === 'reg') handleSearch();
    else handleTimedSearch();
}

function onScanFailure(error) {}

// ==========================================
// 4. MAIN REGISTRATION MODULE
// ==========================================
let currentSearchId = ""; 

async function handleSearch() {
    const searchInput = document.getElementById('search-input').value.trim();
    const resultsContainer = document.getElementById('registration-results');
    if (!searchInput) return alert("Please enter a valid search query");
    currentSearchId = searchInput;

    resultsContainer.innerHTML = `<div style="text-align: center; color: var(--accent-yellow); padding: 20px;"><div class="loader-spinner"></div>Searching database...</div>`;
    const result = await lookupBooking(searchInput);

    if (!result || !result.found) {
        return resultsContainer.innerHTML = `<div class="refund-alert">Data not found. Verify the ID or Email.</div>`;
    }
    if (result.isRefund) {
        return resultsContainer.innerHTML = `<div class="refund-alert"><h3>⚠️ REFUNDED</h3><p>Do not issue a bib or kit.</p></div>`;
    }

    if (result.alreadyRegistered) {
        let html = `<div class="refund-alert" style="background: rgba(16, 185, 129, 0.2); border-color: #10b981; color: #a7f3d0;"><h3>✅ ALREADY REGISTERED</h3></div><div class="cards-grid">`;
        result.participants.forEach(p => {
            const isTimedPending = p.bib === "TIMED-CHIP-PENDING";
            html += `
            <div class="runner-card" style="border-color: #10b981;">
                <div class="card-header" style="background: rgba(16, 185, 129, 0.2);">${p.name} <span class="format-badge">${p.format}</span></div>
                <div class="card-body" style="text-align: center;">
                    ${isTimedPending ? `<div style="color: #93c5fd;">⏱️ TIMED RUN: Chip pending at NovaRace.</div>` : `<div class="giant-bib-display" style="color: #10b981; border-color: #10b981;">${p.bib}</div>`}
                </div>
            </div>`;
        });
        html += `</div>`;
        return resultsContainer.innerHTML = html;
    }

    let html = `<div class="cards-grid">`; let runnerCount = 1;
    result.formats.forEach(f => {
        for (let i = 0; i < f.tickets; i++) {
            const isTimed = f.format.toUpperCase().includes("TIMED") && !f.format.toUpperCase().includes("UNTIMED");
            html += `
            <div class="runner-card" data-format="${f.format}">
                <div class="card-header">Runner ${runnerCount} <span class="format-badge">${f.format}</span></div>
                <div class="card-body">
                    <input type="text" class="cyber-input runner-name" placeholder="Full Name" required>
                    <input type="email" class="cyber-input runner-email" placeholder="Email Address" required>
                    <input type="tel" class="cyber-input runner-contact" placeholder="Contact Number" required>
                    <div style="display: flex; gap: 10px;">
                        <select class="cyber-input runner-gender" style="flex: 1;" required>
                            <option value="" disabled selected>Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                        </select>
                        <input type="date" class="cyber-input runner-dob" style="flex: 1;" required>
                    </div>
                    ${isTimed ? `<div style="color: #93c5fd; font-size: 0.85rem; text-align: center;">⏱️ TIMED: Chip assigned at NovaRace counter.</div>` : `<input type="text" class="cyber-input runner-bib" placeholder="Assign Bib Number" required>`}
                </div>
            </div>`;
            runnerCount++;
        }
    });
    html += `</div><div style="margin-top: 20px; text-align: center;"><button class="cyber-btn" id="save-btn" onclick="saveRunners()">Save & Issue Bibs</button></div>`;
    resultsContainer.innerHTML = html;
}

async function saveRunners() {
    const cards = document.querySelectorAll('#registration-results .runner-card');
    let participants = []; let isValid = true;

    cards.forEach(card => {
        const bibInput = card.querySelector('.runner-bib');
        let bibNumber = bibInput ? bibInput.value.trim() : "TIMED-CHIP-PENDING";
        
        const p = {
            bookingId: currentSearchId, format: card.getAttribute('data-format'),
            name: card.querySelector('.runner-name').value.trim(), email: card.querySelector('.runner-email').value.trim(),
            contact: card.querySelector('.runner-contact').value.trim(), gender: card.querySelector('.runner-gender').value,
            dob: card.querySelector('.runner-dob').value, bibNumber: bibNumber
        };
        
        if (!p.name || !p.email || !p.contact || !p.gender || !p.dob || (bibInput && !bibNumber)) isValid = false;
        participants.push(p);
    });

    if (!isValid) return alert("Action Required: Please ensure ALL fields are filled out.");

    document.getElementById('save-btn').innerText = "Saving..."; document.getElementById('save-btn').disabled = true;
    const result = await submitParticipants(participants);

    if (result && result.success) {
        document.getElementById('registration-results').innerHTML = `<div class="giant-bib-display">SUCCESS!</div><p style="text-align:center;">Registration marked complete!</p>`;
        document.getElementById('search-input').value = ""; 
    } else {
        alert("Failed to save data. Please try again.");
        document.getElementById('save-btn').innerText = "Save & Issue Bibs"; document.getElementById('save-btn').disabled = false;
    }
}

// ==========================================
// 5. NOVARACE / TIMED BIBS MODULE
// ==========================================
let currentTimedSearchId = "";

async function handleTimedSearch() {
    const searchInput = document.getElementById('timed-search-input').value.trim();
    const resultsContainer = document.getElementById('timed-results');
    if (!searchInput) return alert("Please enter a valid search query");
    currentTimedSearchId = searchInput; // Safe backup of ID

    resultsContainer.innerHTML = `<div style="text-align: center; color: var(--accent-yellow); padding: 20px;"><div class="loader-spinner"></div>Looking up registration...</div>`;
    
    const result = await lookupParticipant(searchInput);

    if (!result || !result.registered) {
        return resultsContainer.innerHTML = `
            <div class="refund-alert">
                <h3>❌ INCOMPLETE REGISTRATION</h3>
                <p>This runner has not passed through the main Registration desk yet. Please direct them there first.</p>
            </div>
        `;
    }

    // Runner found. Generate Timed Assignment Cards
    let html = `<div class="cards-grid">`;
    let needsChipCount = 0;

    result.participants.forEach(p => {
        const isUntimed = p.format.toUpperCase().includes("UNTIMED");
        const alreadyAssigned = p.bib !== "TIMED-CHIP-PENDING" && !isUntimed;

        if (isUntimed) {
            // UNTIMED: Locked Informational Card
            html += `
            <div class="runner-card" style="border-color: #64748b; opacity: 0.8;">
                <div class="card-header" style="background: rgba(100, 116, 139, 0.2); color: #94a3b8;">
                    ${p.name} <span class="format-badge" style="background: #64748b; color: white;">${p.format}</span>
                </div>
                <div class="card-body" style="text-align: center; color: #94a3b8;">
                    <p>UNTIMED RUNNER</p>
                    <p>Bib #${p.bib} assigned at main desk.</p>
                    <p><strong>No timing chip required.</strong></p>
                </div>
            </div>`;
        } else if (alreadyAssigned) {
            // TIMED (Already Assigned): Locked Card
            html += `
            <div class="runner-card" style="border-color: #10b981; opacity: 0.8;">
                <div class="card-header" style="background: rgba(16, 185, 129, 0.2);">
                    ${p.name} <span class="format-badge" style="background: #10b981; color: white;">${p.format}</span>
                </div>
                <div class="card-body" style="text-align: center;">
                    <p style="color: #10b981; font-weight: bold;">✅ CHIP ASSIGNED</p>
                    <p>Bib: <strong>${p.bib}</strong></p>
                    <p>Chip ID: <strong>${p.transponderId}</strong></p>
                </div>
            </div>`;
        } else {
            // TIMED (Needs Chip): Input Card
            needsChipCount++;
            html += `
            <div class="runner-card timed-input-card" data-name="${p.name}">
                <div class="card-header" style="border-color: var(--accent-yellow);">
                    <span style="color: var(--accent-yellow); font-size: 1.2rem;">${p.name}</span>
                    <span class="format-badge">${p.format}</span>
                </div>
                <div class="card-body">
                    <input type="text" class="cyber-input timed-bib-input" placeholder="Scan/Enter Bib Number" required>
                    <input type="text" class="cyber-input timed-chip-input" placeholder="Scan/Enter Transponder ID" required>
                </div>
            </div>`;
        }
    });

    html += `</div>`;
    
    // Only show the Save button if there are actual chips that need to be assigned
    if (needsChipCount > 0) {
        html += `
        <div style="margin-top: 20px; text-align: center;">
            <button class="cyber-btn" id="save-timed-btn" onclick="saveTimedBibs()">Assign Chips</button>
        </div>`;
    }

    resultsContainer.innerHTML = html;
}

async function saveTimedBibs() {
    const cards = document.querySelectorAll('.timed-input-card');
    let participants = [];
    let isValid = true;

    cards.forEach(card => {
        const name = card.getAttribute('data-name');
        const bib = card.querySelector('.timed-bib-input').value.trim();
        const transponder = card.querySelector('.timed-chip-input').value.trim();

        if (!bib || !transponder) isValid = false;

        participants.push({
            bookingId: currentTimedSearchId, // Uses the global tracked ID from the lookup function
            name: name,
            bibNumber: bib,
            transponderId: transponder
        });
    });

    if (!isValid) return alert("Action Required: Please enter both the Bib Number and Transponder ID for all runners requiring a chip.");

    const saveBtn = document.getElementById('save-timed-btn');
    saveBtn.innerText = "Assigning...";
    saveBtn.disabled = true;

    const result = await updateTimedParticipants(participants);

    if (result && result.success) {
        document.getElementById('timed-results').innerHTML = `
            <div class="giant-bib-display" style="font-size: 3rem; color: #10b981; border-color: #10b981; text-shadow: 0 0 15px rgba(16,185,129,0.4);">
                ASSIGNED!
            </div>
            <p style="text-align: center; color: var(--text-muted); margin-top: 10px;">
                Chips linked successfully.
            </p>
        `;
        document.getElementById('timed-search-input').value = ""; 
    } else {
        alert("Failed to assign chips. Please try again.");
        saveBtn.innerText = "Assign Chips";
        saveBtn.disabled = false;
    }
}

window.onload = () => loadDashboardStats();