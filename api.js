const API_URL = "https://script.google.com/macros/s/AKfycbwgnIwKpA35satYWU1gsa7Jo6836qfinIaIFi92LUTG3SJjjYBzli4obyO7i2DDILwV/exec";

async function fetchDashboardStats() {
    try {
        const response = await fetch(`${API_URL}?action=getDashboard`);
        return await response.json();
    } catch (error) {
        console.error("Error fetching stats:", error);
        return null;
    }
}

async function lookupBooking(bookingId) {
    try {
        const response = await fetch(`${API_URL}?action=lookup&bookingId=${encodeURIComponent(bookingId)}`);
        return await response.json();
    } catch (error) {
        console.error("Error looking up booking:", error);
        return null;
    }
}

async function submitParticipants(participantsData) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ participants: participantsData })
        });
        return await response.json();
    } catch (error) {
        console.error("Error saving participants:", error);
        return { success: false, error: "Network error" };
    }
}

// NEW: Fetch from Participant Sheet
async function lookupParticipant(bookingId) {
    try {
        const response = await fetch(`${API_URL}?action=lookupParticipant&bookingId=${encodeURIComponent(bookingId)}`);
        return await response.json();
    } catch (error) {
        console.error("Error looking up participant:", error);
        return null;
    }
}

// NEW: Update Existing Rows for Timed Bibs
async function updateTimedParticipants(participantsData) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "updateTimed", participants: participantsData })
        });
        return await response.json();
    } catch (error) {
        console.error("Error updating timed participants:", error);
        return { success: false, error: "Network error" };
    }
}