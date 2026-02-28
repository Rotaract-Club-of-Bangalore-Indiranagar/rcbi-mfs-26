// 1. Tab Navigation Logic
function switchTab(tabId, event) {
    document.querySelectorAll('.page-section').forEach(section => section.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    if (tabId === 'dashboard') loadDashboardStats();
    stopQRScanner(); 
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

function switchSearchMode(mode, event) {
    document.querySelectorAll('#registration .search-tab').forEach(tab => tab.classList.remove('active'));
    if (event) event.currentTarget.classList.add('active');

    const inputGroup = document.getElementById('manual-input-group');
    const qrGroup = document.getElementById('qr-reader-group');
    const searchInput = document.getElementById('search-input');
    
    document.getElementById('registration-results').innerHTML = "";

    if (mode === 'qr') {
        inputGroup.style.display = 'none';
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
    document.getElementById('qr-reader-group').style.display = 'none';
    document.getElementById('manual-input-group').style.display = 'flex';
    
    const searchInput = document.getElementById('search-input');
    searchInput.value = decodedText;
    
    document.querySelectorAll('#registration .search-tab')[0].classList.add('active');
    document.querySelectorAll('#registration .search-tab')[2].classList.remove('active');

    handleSearch();
}

function onScanFailure(error) {}

// 4. MAIN REGISTRATION MODULE
let currentSearchId = ""; 

async function handleSearch() {
    const searchInput = document.getElementById('search-input').value.trim();
    const resultsContainer = document.getElementById('registration-results');
    if (!searchInput) return alert("Please enter a valid search query");

    resultsContainer.innerHTML = `<div style="text-align: center; color: var(--accent-yellow); padding: 20px;"><div class="loader-spinner"></div>Searching database...</div>`;
    const result = await lookupBooking(searchInput);

    if (!result || !result.found) {
        return resultsContainer.innerHTML = `<div class="refund-alert">Data not found. Verify the ID or Email.</div>`;
    }
    if (result.isRefund) {
        return resultsContainer.innerHTML = `<div class="refund-alert"><h3>⚠️ REFUNDED</h3><p>Do not issue a bib or kit.</p></div>`;
    }

    // THE FIX: Set the global search ID to the TRUE Booking ID returned by the backend
    currentSearchId = result.bookingId; 

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
                    ${isTimed ? `<div style="color: #93c5fd; font-size: 0.85rem; text-align: center;">⏱️ TIMED: Connect with NovaRace rep for timing chip.</div>` : `<input type="text" class="cyber-input runner-bib" placeholder="Assign Bib Number" required>`}
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
        document.getElementById('registration-results').innerHTML = `<div class="giant-bib-display">SUCCESS!</div><p style="text-align:center;">Data saved to Main Sheet and NovaRace Sheet!</p>`;
        document.getElementById('search-input').value = ""; 
    } else {
        alert("Failed to save data. Please try again.");
        document.getElementById('save-btn').innerText = "Save & Issue Bibs"; document.getElementById('save-btn').disabled = false;
    }
}

window.onload = () => loadDashboardStats();