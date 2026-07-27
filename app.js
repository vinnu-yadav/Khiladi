// ==================== FIREBASE CONFIG ====================
// 🔥 IMPORTANT: Replace this with YOUR Firebase project config
const firebaseConfig = {
    apiKey: "AIzaSyBwqjgRRtZC9RJ34m-g5r0TBOx4G7AMDjc",
    authDomain: "tournament-a7659.firebaseapp.com",
    databaseURL: "https://tournament-a7659-default-rtdb.firebaseio.com",
    projectId: "tournament-a7659",
    storageBucket: "tournament-a7659.firebasestorage.app",
    messagingSenderId: "458496922243",
    appId: "1:458496922243:web:feb3c8c5a749e31f4a01b6"
    measurementId: "G-FK9L8N9WSD"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// ==================== GLOBALS ====================
let currentUser = null;
let currentGameId = null;
let pendingTournamentId = null;
let pendingFee = 0;
let pendingSlots = 0;

// ==================== DOM REFS ====================
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const googleBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userNameEl = document.getElementById('user-name');
const userBalanceEl = document.getElementById('user-balance');
const loginErrorEl = document.getElementById('login-error');
const gamesList = document.getElementById('games-list');
const tournamentsContainer = document.getElementById('tournaments-container');
const accountMenu = document.getElementById('account-menu');
const walletClick = document.getElementById('wallet-click');

const adminLoginDiv = document.getElementById('admin-login');
const adminDashboard = document.getElementById('admin-dashboard');
const adminEmail = document.getElementById('admin-email');
const adminPassword = document.getElementById('admin-password');
const adminLoginError = document.getElementById('admin-login-error');
const adminLogoutBtn = document.getElementById('admin-logout-btn');

const withdrawModal = document.getElementById('withdraw-modal');
const upiInput = document.getElementById('upi-input');
const withdrawAmount = document.getElementById('withdraw-amount');
const submitWithdrawBtn = document.getElementById('submit-withdraw-btn');
const withdrawStatus = document.getElementById('withdraw-status');

const joinModal = document.getElementById('join-modal');
const ingameName = document.getElementById('ingame-name');
const ingameUid = document.getElementById('ingame-uid');
const confirmJoinBtn = document.getElementById('confirm-join-btn');
const joinError = document.getElementById('join-error');

// ==================== AUTH STATE ====================
auth.onAuthStateChanged(user => {
    console.log('🔥 Auth state:', user ? user.displayName : 'null');
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        userNameEl.textContent = user.displayName || 'User';
        loginErrorEl.textContent = '';
        listenToUserData(user.uid);
        loadGames();
        checkUserBonus(user);
    } else {
        currentUser = null;
        loginScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }
});

// ==================== REDIRECT RESULT (fallback) ====================
auth.getRedirectResult()
    .then(result => {
        if (result.user) {
            console.log('✅ Redirect login success:', result.user.displayName);
        }
    })
    .catch(err => {
        console.error('Redirect error:', err);
        loginErrorEl.textContent = 'Login failed: ' + err.message;
    });

// ==================== GOOGLE LOGIN ====================
googleBtn?.addEventListener('click', () => {
    loginErrorEl.textContent = '';
    console.log('🔄 Login clicked...');
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(result => {
            console.log('✅ Popup success:', result.user.displayName);
        })
        .catch(err => {
            console.error('❌ Popup error:', err.code, err.message);
            if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
                console.log('🔄 Switching to redirect...');
                auth.signInWithRedirect(provider);
            } else {
                loginErrorEl.textContent = 'Login failed: ' + err.message;
            }
        });
});

// ==================== LOGOUT ====================
logoutBtn?.addEventListener('click', () => {
    auth.signOut();
    accountMenu.classList.add('hidden');
});

// ==================== ACCOUNT DROPDOWN ====================
userNameEl?.addEventListener('click', () => {
    accountMenu.classList.toggle('hidden');
});

// ==================== WALLET CLICK ====================
walletClick?.addEventListener('click', openWithdrawModal);

// ==================== TOP-UP ====================
document.getElementById('topup-btn')?.addEventListener('click', () => {
    alert('📞 Contact Admin for Top-Up: 1234567890');
});

// ==================== WITHDRAWAL ====================
function openWithdrawModal() {
    if (!currentUser) return alert('Please login first.');
    withdrawModal.classList.remove('hidden');
    withdrawStatus.textContent = '';
    db.ref('users/' + currentUser.uid + '/upi').once('value', snap => {
        const upi = snap.val();
        if (upi) {
            upiInput.value = upi;
            upiInput.disabled = true;
        } else {
            upiInput.disabled = false;
        }
    });
}

function closeWithdrawModal() {
    withdrawModal.classList.add('hidden');
    upiInput.disabled = false;
}

document.querySelector('.close')?.addEventListener('click', closeWithdrawModal);

submitWithdrawBtn?.addEventListener('click', () => {
    const upi = upiInput.value.trim();
    const amount = parseInt(withdrawAmount.value);
    if (!upi) { withdrawStatus.textContent = 'Please enter UPI ID.'; return; }
    if (isNaN(amount) || amount < 200) { withdrawStatus.textContent = 'Minimum withdrawal is ₹200.'; return; }

    const uid = currentUser.uid;
    db.ref('users/' + uid).once('value', snap => {
        const data = snap.val();
        const balance = data?.balance || 0;
        if (balance < amount) {
            withdrawStatus.textContent = 'Insufficient balance.';
            return;
        }
        const updates = {};
        if (!data?.upi) {
            updates[`users/${uid}/upi`] = upi;
        } else if (data.upi !== upi) {
            withdrawStatus.textContent = 'UPI ID cannot be changed once set.';
            return;
        }
        const reqRef = db.ref('withdrawalRequests').push();
        updates[`withdrawalRequests/${reqRef.key}`] = {
            uid: uid,
            upi: upi,
            amount: amount,
            status: 'pending',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        db.ref().update(updates).then(() => {
            alert('✅ Withdrawal request submitted!');
            closeWithdrawModal();
        }).catch(err => {
            withdrawStatus.textContent = 'Error: ' + err.message;
        });
    });
});

// ==================== USER DATA ====================
function listenToUserData(uid) {
    db.ref('users/' + uid).on('value', snap => {
        if (snap.exists()) {
            const data = snap.val();
            userBalanceEl.textContent = data.balance ?? 0;
        } else {
            userBalanceEl.textContent = '0';
        }
    });
}

function checkUserBonus(user) {
    const userRef = db.ref('users/' + user.uid);
    userRef.once('value', snap => {
        if (!snap.exists()) {
            userRef.set({
                name: user.displayName,
                email: user.email,
                balance: 10,
                joinedTournaments: {}
            });
        }
    });
}

// ==================== GAMES & TOURNAMENTS ====================
function loadGames() {
    const gamesRef = db.ref('games');
    const tournamentsRef = db.ref('tournaments');

    let tournamentGameIds = new Set();

    tournamentsRef.on('value', snap => {
        tournamentGameIds = new Set();
        if (snap.exists()) {
            snap.forEach(child => {
                const gameId = child.val().gameId;
                if (gameId) tournamentGameIds.add(gameId);
            });
        }
        renderGames(tournamentGameIds);
    });

    function renderGames(validGameIds) {
        gamesRef.once('value', snap => {
            gamesList.innerHTML = '';
            if (!snap.exists()) {
                gamesList.innerHTML = '<p>No games available.</p>';
                return;
            }
            let hasGames = false;
            snap.forEach(child => {
                const game = child.val();
                const key = child.key;
                if (validGameIds.has(key)) {
                    hasGames = true;
                    const div = document.createElement('div');
                    div.className = 'game-card';
                    div.innerHTML = `
                        <img src="${game.pic || 'https://via.placeholder.com/180x120?text=Game'}" alt="${game.name}" />
                        <h4>${game.name}</h4>
                    `;
                    div.addEventListener('click', () => showTournaments(key, game.name));
                    gamesList.appendChild(div);
                }
            });
            if (!hasGames) {
                gamesList.innerHTML = '<p>No games with tournaments yet. Check back later!</p>';
            }
        });
    }
}

function showTournaments(gameId, gameName) {
    currentGameId = gameId;
    document.getElementById('games-section').classList.add('hidden');
    document.getElementById('tournaments-section').classList.remove('hidden');
    document.getElementById('selected-game-title').textContent = gameName + ' Tournaments';

    tournamentsContainer.innerHTML = '<p>Loading...</p>';

    db.ref('tournaments').orderByChild('gameId').equalTo(gameId).on('value', snap => {
        tournamentsContainer.innerHTML = '';
        if (!snap.exists()) {
            tournamentsContainer.innerHTML = '<p>No tournaments for this game.</p>';
            return;
        }

        const grouped = { upcoming: [], ongoing: [], completed: [] };
        snap.forEach(child => {
            const t = child.val();
            const tId = child.key;
            const status = t.status || 'upcoming';
            if (status === 'cancelled') return;
            if (grouped[status]) grouped[status].push({ id: tId, ...t });
            else grouped.upcoming.push({ id: tId, ...t });
        });

        const order = ['upcoming', 'ongoing', 'completed'];
        const labels = { upcoming: '🔮 Upcoming', ongoing: '⚡ Ongoing', completed: '✅ Completed' };

        order.forEach(status => {
            const list = grouped[status] || [];
            if (list.length === 0) return;

            const section = document.createElement('div');
            section.innerHTML = `<h3 style="margin:20px 0 10px; color:#f5c842;">${labels[status]}</h3>`;

            list.forEach(t => {
                const card = document.createElement('div');
                card.className = 'tournament-card';
                const currentEntries = t.joinedUsers ? Object.keys(t.joinedUsers).length : 0;
                const isJoined = currentUser && t.joinedUsers && t.joinedUsers[currentUser.uid];

                let actionHtml = '';
                if (isJoined) {
                    const roomUid = t.roomUid || '—';
                    const roomPass = t.roomPass || '—';
                    actionHtml = `
                        <div style="background:#2ecc71; padding:8px; border-radius:8px; margin-top:10px; color:#111; font-weight:bold;">
                            ✅ Joined<br>
                            Room: ${roomUid}<br>
                            Pass: ${roomPass}
                        </div>
                    `;
                } else if (status === 'upcoming' || status === 'ongoing') {
                    if (currentEntries < t.totalSlots) {
                        actionHtml = `<button onclick="prepareJoin('${t.id}', ${t.entryFee}, ${currentEntries}, ${t.totalSlots})" class="btn-primary">Join (₹${t.entryFee})</button>`;
                    } else {
                        actionHtml = `<p style="color:#e74c3c;">Slots Full</p>`;
                    }
                } else {
                    actionHtml = `<p style="color:#7f8c8d;">Completed</p>`;
                }

                const roomDisplay = isJoined ? '' : `<p>Room: <span class="room-hidden">******</span></p><p>Pass: <span class="room-hidden">******</span></p>`;

                card.innerHTML = `
                    <div class="status-badge status-${status}">${status}</div>
                    <p>⏱️ ${t.time || 'TBD'}</p>
                    <p>👥 ${currentEntries} / ${t.totalSlots} slots</p>
                    <p>💰 ₹${t.entryFee} entry fee</p>
                    ${roomDisplay}
                    ${actionHtml}
                `;
                section.appendChild(card);
            });
            tournamentsContainer.appendChild(section);
        });
    });
}

// ==================== JOIN TOURNAMENT ====================
function prepareJoin(tId, fee, current, total) {
    if (!currentUser) { alert('Please login first.'); return; }
    if (current >= total) { alert('Slots are full!'); return; }

    pendingTournamentId = tId;
    pendingFee = fee;
    pendingSlots = total;
    joinModal.classList.remove('hidden');
    joinError.textContent = '';
    ingameName.value = '';
    ingameUid.value = '';
}

function closeJoinModal() {
    joinModal.classList.add('hidden');
    pendingTournamentId = null;
}

document.querySelector('#join-modal .close')?.addEventListener('click', closeJoinModal);

confirmJoinBtn?.addEventListener('click', () => {
    const name = ingameName.value.trim();
    const uid = ingameUid.value.trim();
    if (!name || !uid) {
        joinError.textContent = 'Please fill both fields.';
        return;
    }

    if (!pendingTournamentId) return;
    const tId = pendingTournamentId;

    const userRef = db.ref(`users/${currentUser.uid}`);
    userRef.once('value', snap => {
        const data = snap.val();
        const balance = data?.balance || 0;
        if (balance < pendingFee) {
            alert('Insufficient balance. Please top up.');
            closeJoinModal();
            return;
        }

        const updates = {};
        updates[`users/${currentUser.uid}/balance`] = balance - pendingFee;
        updates[`tournaments/${tId}/joinedUsers/${currentUser.uid}`] = {
            name: name,
            uid: uid,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        };
        updates[`users/${currentUser.uid}/joinedTournaments/${tId}`] = true;

        db.ref().update(updates).then(() => {
            alert('✅ Successfully joined tournament!');
            closeJoinModal();
        }).catch(err => {
            joinError.textContent = 'Error: ' + err.message;
        });
    });
});

// ==================== HIDE TOURNAMENTS ====================
function hideTournaments() {
    document.getElementById('games-section').classList.remove('hidden');
    document.getElementById('tournaments-section').classList.add('hidden');
}

// ==================== ADMIN FUNCTIONS ====================
function loginAdmin() {
    const email = adminEmail.value.trim();
    const pass = adminPassword.value.trim();
    adminLoginError.textContent = '';
    auth.signInWithEmailAndPassword(email, pass)
        .then(() => {
            adminLoginDiv.classList.add('hidden');
            adminDashboard.classList.remove('hidden');
            loadAdminPanel();
        })
        .catch(err => {
            adminLoginError.textContent = 'Login failed: ' + err.message;
        });
}

adminLogoutBtn?.addEventListener('click', () => {
    auth.signOut().then(() => {
        adminLoginDiv.classList.remove('hidden');
        adminDashboard.classList.add('hidden');
    });
});

function loadAdminPanel() {
    const dropdown = document.getElementById('select-game-dropdown');
    if (dropdown) {
        db.ref('games').on('value', snap => {
            dropdown.innerHTML = '<option value="">Select Game</option>';
            snap.forEach(child => {
                dropdown.innerHTML += `<option value="${child.key}">${child.val().name}</option>`;
            });
        });
    }

    const manageDiv = document.getElementById('admin-tournaments-manage');
    if (manageDiv) {
        db.ref('tournaments').on('value', snap => {
            manageDiv.innerHTML = '';
            if (!snap.exists()) {
                manageDiv.innerHTML = '<p>No tournaments.</p>';
                return;
            }
            snap.forEach(child => {
                const t = child.val();
                const key = child.key;
                const players = t.joinedUsers ? Object.values(t.joinedUsers) : [];
                let playerList = '';
                if (players.length > 0) {
                    playerList = players.map((p, i) => 
                        `<div style="font-size:0.9rem; padding:2px 0;">${i+1}. ${p.name} (UID: ${p.uid})</div>`
                    ).join('');
                } else {
                    playerList = '<span style="color:#888;">No players yet</span>';
                }

                manageDiv.innerHTML += `
                    <div class="tournament-card" style="margin-bottom:20px;">
                        <p><b>${t.time || 'TBD'}</b> | Slots: ${players.length}/${t.totalSlots} | Status: <span class="status-badge status-${t.status || 'upcoming'}">${t.status || 'upcoming'}</span></p>
                        <div style="margin:10px 0; padding:10px; background:#111; border-radius:8px;">
                            <strong>Players:</strong>
                            ${playerList}
                        </div>
                        <input type="text" id="uid-${key}" placeholder="Room UID" value="${t.roomUid || ''}" />
                        <input type="text" id="pass-${key}" placeholder="Room Password" value="${t.roomPass || ''}" />
                        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
                            <button onclick="updateRoomDetails('${key}')" class="btn-secondary">Update Room</button>
                            <button onclick="changeTournamentStatus('${key}', 'cancelled')" class="btn-danger">Cancel</button>
                            <button onclick="changeTournamentStatus('${key}', 'completed')" class="btn-success">Mark Complete</button>
                        </div>
                    </div>
                `;
            });
        });
    }

    loadWithdrawalRequests();
}

function changeTournamentStatus(tId, newStatus) {
    db.ref(`tournaments/${tId}/status`).set(newStatus)
        .then(() => alert(`✅ Tournament ${newStatus === 'cancelled' ? 'cancelled' : 'marked as completed'}.`))
        .catch(err => alert('Error: ' + err.message));
}

function loadWithdrawalRequests() {
    const container = document.getElementById('withdrawal-requests-list');
    if (!container) return;
    db.ref('withdrawalRequests').orderByChild('status').equalTo('pending').on('value', snap => {
        container.innerHTML = '';
        if (!snap.exists()) {
            container.innerHTML = '<p>No pending requests.</p>';
            return;
        }
        snap.forEach(child => {
            const req = child.val();
            const key = child.key;
            const div = document.createElement('div');
            div.className = 'tournament-card';
            div.innerHTML = `
                <p><b>User:</b> ${req.uid}</p>
                <p><b>UPI:</b> ${req.upi}</p>
                <p><b>Amount:</b> ₹${req.amount}</p>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button onclick="approveWithdrawal('${key}')" class="btn-success">Approve</button>
                  
