
"use strict";

const STORE_KEY = "touchlineTournamentPlayers_v1";

const $ = id => document.getElementById(id);

function getPlayers() {
    try {
        return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    } catch {
        return [];
    }
}

function savePlayers(players) {
    localStorage.setItem(STORE_KEY, JSON.stringify(players));
}

function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function initials(name) {
    return (name || "?").trim().split(/\s+/)
        .slice(0, 2).map(word => word[0] || "").join("").toUpperCase();
}

function averageRating(player) {
    const ratings = player.ratings || [];
    if (!ratings.length) return 0;
    return ratings.reduce((total, rating) => total + Number(rating), 0)
        / ratings.length;
}

function teamTag(team) {
    return `<span class="team-tag ${team === "A" ? "a" : "b"}">TEAM ${team}</span>`;
}

function goProfile(id) {
    location.href = `player.html?id=${encodeURIComponent(id)}`;
}

// PAGE 1: PLAYER MANAGEMENT

function initPlayersPage() {
    const form = $("playerForm");
    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const name = $("name").value.trim();
        if (!name) return;

        const file = $("photo").files[0];
        let photo = "";

        if (file) {
            if (!file.type.startsWith("image/")) {
                alert("Please choose an image file.");
                return;
            }

            if (file.size > 1.8 * 1024 * 1024) {
                alert("Please choose an image smaller than 1.8 MB.");
                return;
            }

            try {
                photo = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            } catch {
                alert("Unable to read the selected picture.");
                return;
            }
        }

        const players = getPlayers();

        players.push({
            id: Date.now().toString(36) +
                Math.random().toString(36).slice(2, 7),
            name,
            team: $("team").value,
            position: $("position").value,
            photo,
            slot: null,
            goals: 0,
            assists: 0,
            games: 0,
            ratings: []
        });

        try {
            savePlayers(players);
        } catch {
            alert("Browser storage is full. Try a smaller picture.");
            return;
        }

        form.reset();
        renderPlayers();
    });

    $("search").addEventListener("input", renderPlayers);
    $("filterTeam").addEventListener("change", renderPlayers);

    renderPlayers();
}

function renderPlayers() {
    const list = $("playerList");
    if (!list) return;

    const players = getPlayers();
    const search = $("search").value.toLowerCase();
    const filter = $("filterTeam").value;

    $("totalPlayers").textContent = players.length;
    $("teamACount").textContent =
        players.filter(p => p.team === "A").length;
    $("teamBCount").textContent =
        players.filter(p => p.team === "B").length;
    $("totalGoals").textContent =
        players.reduce((sum, p) => sum + (Number(p.goals) || 0), 0);

    $("playerCountLabel").textContent =
        `${players.length} player${players.length === 1 ? "" : "s"}`;

    const filtered = players.filter(player =>
        player.name.toLowerCase().includes(search) &&
        (filter === "all" || player.team === filter)
    );

    if (!filtered.length) {
        list.innerHTML = `<div class="empty">${
            players.length
                ? "No players match your search."
                : "No players yet. Add your first player."
        }</div>`;
        return;
    }

    list.innerHTML = filtered.map(player => `
        <div class="player-row">
            ${player.photo
                ? `<img class="avatar" src="${player.photo}" alt="${esc(player.name)}">`
                : `<span class="avatar">${esc(initials(player.name))}</span>`}
            <div class="player-row-main">
                <strong>${esc(player.name)}</strong>
                <small>${esc(player.position)} · ${player.goals || 0} goals · ${player.assists || 0} assists</small>
            </div>
            ${teamTag(player.team)}
            <button class="icon-btn" data-delete="${esc(player.id)}"
                    title="Delete player" aria-label="Delete ${esc(player.name)}">×</button>
        </div>
    `).join("");

    list.querySelectorAll("[data-delete]").forEach(button => {
        button.addEventListener("click", () => {
            if (!confirm("Delete this player and their statistics?")) return;

            savePlayers(getPlayers().filter(
                player => player.id !== button.dataset.delete
            ));

            renderPlayers();
        });
    });
}

// PAGE 2: FOOTBALL PITCH

const POSITIONS = [
    "DF", "DF", "DF", "DF",
    "GK", "MF", "MF", "MF",
    "FW", "FW", "FW"
];

function initPitch() {
    if (!$("slotsA")) return;

    renderPitch();

    $("resetPositions").addEventListener("click", () => {
        if (!confirm("Move every player back to the bench?")) return;

        const players = getPlayers().map(player => ({
            ...player,
            slot: null
        }));

        savePlayers(players);
        renderPitch();
    });
}

function renderPitch() {
    const players = getPlayers();

    ["A", "B"].forEach(team => {
        const container = $("slots" + team);
        container.innerHTML = "";

        POSITIONS.forEach((position, index) => {
            const slotId = `${team}:${index}`;
            const slot = document.createElement("div");

            slot.className = "slot";
            slot.dataset.slot = slotId;
            slot.innerHTML = `<span class="slot-num">${position}</span>`;

            const player = players.find(p => p.slot === slotId);

            if (player) {
                slot.appendChild(makePitchPlayer(player, true));
            }

            slot.addEventListener("dragover", event => {
                event.preventDefault();
                slot.classList.add("drop-target");
            });

            slot.addEventListener("dragleave", () => {
                slot.classList.remove("drop-target");
            });

            slot.addEventListener("drop", event => {
                event.preventDefault();
                slot.classList.remove("drop-target");

                const id = event.dataTransfer.getData("text/player-id");
                movePlayer(id, slotId);
            });

            container.appendChild(slot);
        });
    });

    const placed = players.filter(player => player.slot);

    $("teamASub").textContent =
        `${placed.filter(p => p.slot.startsWith("A:")).length} players placed`;

    $("teamBSub").textContent =
        `${placed.filter(p => p.slot.startsWith("B:")).length} players placed`;

    const bench = $("bench");
    const unplaced = players.filter(player => !player.slot);

    bench.innerHTML = "";

    if (!unplaced.length) {
        bench.innerHTML = '<div class="empty">All players are placed on the pitch.</div>';
        return;
    }

    unplaced.forEach(player => {
        bench.appendChild(makePitchPlayer(player, false));
    });
}

function makePitchPlayer(player, onPitch) {
    const element = document.createElement("div");

    element.className =
        `pitch-player ${player.team === "A" ? "team-a" : "team-b"}`;

    element.draggable = true;
    element.dataset.playerId = player.id;
    element.title = `${player.name} — click to view profile`;

    element.innerHTML = `
        ${player.photo
            ? `<img src="${player.photo}" alt="${esc(player.name)}">`
            : `<span class="pitch-avatar">${esc(initials(player.name))}</span>`}
        <span class="pitch-name">${esc(player.name)}</span>
    `;

    element.addEventListener("dragstart", event => {
        event.dataTransfer.setData("text/player-id", player.id);
        event.dataTransfer.effectAllowed = "move";
        element.classList.add("dragging");
    });

    element.addEventListener("dragend", () => {
        element.classList.remove("dragging");
    });

    element.addEventListener("click", () => {
        goProfile(player.id);
    });

    if (!onPitch) {
        element.addEventListener("dragover", event => {
            event.preventDefault();
        });

        element.addEventListener("drop", event => {
            event.preventDefault();

            const id = event.dataTransfer.getData("text/player-id");
            movePlayer(id, null);
        });
    }

    return element;
}

function movePlayer(id, destination) {
    const players = getPlayers();
    const player = players.find(p => p.id === id);

    if (!player) return;

    // A team slot can contain only one player.
    // Move the existing occupant to the first player's old slot.
    if (destination) {
        const occupant = players.find(
            p => p.slot === destination && p.id !== id
        );

        if (occupant) {
            occupant.slot = player.slot || null;
        }
    }

    player.slot = destination;

    savePlayers(players);
    renderPitch();
}

// PAGE 3: PLAYER PROFILE AND STATISTICS

function initProfile() {
    const root = $("profile");
    if (!root) return;

    const id = new URLSearchParams(location.search).get("id");
    const player = getPlayers().find(p => p.id === id);

    if (!player) {
        root.innerHTML = `
            <div class="empty">
                Player not found. Return to the pitch and select a player.
            </div>`;
        return;
    }

    const rating = averageRating(player);
    const ratings = player.ratings || [];

    root.innerHTML = `
        <section class="profile-hero">
            <div class="profile-photo">
                ${player.photo
                    ? `<img src="${player.photo}" alt="${esc(player.name)}">`
                    : `<div class="profile-initial">${esc(initials(player.name))}</div>`}
            </div>

            <div class="profile-info">
                <p class="eyebrow">PLAYER PROFILE</p>
                <h1>${esc(player.name)}</h1>

                <div class="profile-meta">
                    ${teamTag(player.team)}
                    <span>${esc(player.position || "Player")}</span>
                </div>

                <p class="profile-summary">
                    Tournament performance overview. Update these statistics after each match.
                </p>
            </div>
        </section>

        <section class="metric-grid">
            <div class="metric">
                <span>GOALS</span>
                <strong>${player.goals || 0}</strong>
                <em>Goals scored</em>
            </div>

            <div class="metric">
                <span>ASSISTS</span>
                <strong>${player.assists || 0}</strong>
                <em>Goals created</em>
            </div>

            <div class="metric">
                <span>GAMES PLAYED</span>
                <strong>${player.games || 0}</strong>
                <em>Matches recorded</em>
            </div>

            <div class="metric">
                <span>AVERAGE RATING</span>
                <strong>${ratings.length ? rating.toFixed(1) : "—"}
                    <small style="font-size:13px;color:#8793a2">/ 10</small>
                </strong>
                <em>${ratings.length} game ratings</em>
            </div>
        </section>

        <div class="stats-edit">
            <section class="panel">
                <div class="panel-head">
                    <div>
                        <p class="eyebrow">MATCH RECORD</p>
                        <h2>Update stats</h2>
                    </div>
                </div>

                <form id="statsForm">
                    <label for="goals">Total goals</label>
                    <input id="goals" type="number" min="0" step="1"
                           value="${player.goals || 0}" required>

                    <label for="assists">Total assists</label>
                    <input id="assists" type="number" min="0" step="1"
                           value="${player.assists || 0}" required>

                    <label for="games">Games played</label>
                    <input id="games" type="number" min="0" step="1"
                           value="${player.games || 0}" required>

                    <div class="profile-actions">
                        <button class="btn primary" type="submit">Save stats</button>
                        <button class="btn secondary" type="button" id="recordGame">
                            + Record game rating
                        </button>
                    </div>
                </form>
            </section>

            <section class="panel">
                <div class="panel-head">
                    <div>
                        <p class="eyebrow">PERFORMANCE</p>
                        <h2>Game ratings</h2>
                    </div>
                </div>

                <p class="muted">
                    Rate each performance from 1 (poor) to 10 (excellent).
                </p>

                <div class="rating-row">
                    <input id="newRating" type="range" min="1" max="10"
                           step="0.5" value="7">
                    <span class="rating-value" id="ratingValue">7.0</span>
                </div>

                <div class="note">
                    <strong>AVG</strong>
                    <span>Your average rating updates whenever you record or remove a match rating.</span>
                </div>

                <h3 style="font-size:14px;margin-top:25px">Rating history</h3>
                <div id="ratingHistory"></div>
            </section>
        </div>
    `;

    $("newRating").addEventListener("input", () => {
        $("ratingValue").textContent =
            Number($("newRating").value).toFixed(1);
    });

    $("statsForm").addEventListener("submit", event => {
        event.preventDefault();

        const goals = Number($("goals").value);
        const assists = Number($("assists").value);
        const games = Number($("games").value);

        if (
            !Number.isInteger(goals) || goals < 0 ||
            !Number.isInteger(assists) || assists < 0 ||
            !Number.isInteger(games) || games < 0
        ) {
            alert("Please enter valid non-negative whole numbers.");
            return;
        }

        updatePlayer(player.id, current => {
            current.goals = goals;
            current.assists = assists;
            current.games = games;
        });

        initProfile();
    });

    $("recordGame").addEventListener("click", () => {
        updatePlayer(player.id, current => {
            current.ratings = current.ratings || [];
            current.ratings.push(Number($("newRating").value));
        });

        initProfile();
    });

    const history = $("ratingHistory");

    if (!ratings.length) {
        history.innerHTML = '<div class="empty">No ratings recorded yet.</div>';
    } else {
        history.innerHTML = ratings.slice().reverse().map((value, index) => `
            <div class="player-row">
                <div class="avatar">★</div>

                <div class="player-row-main">
                    <strong>Game ${ratings.length - index}</strong>
                    <small>Performance rating</small>
                </div>

                <span class="team-tag a">${Number(value).toFixed(1)} / 10</span>

                <button class="icon-btn"
                        data-rating="${ratings.length - 1 - index}"
                        title="Remove rating">×</button>
            </div>
        `).join("");

        history.querySelectorAll("[data-rating]").forEach(button => {
            button.addEventListener("click", () => {
                updatePlayer(player.id, current => {
                    current.ratings.splice(Number(button.dataset.rating), 1);
                });

                initProfile();
            });
        });
    }
}

function updatePlayer(id, callback) {
    const players = getPlayers();
    const player = players.find(p => p.id === id);

    if (!player) return;

    callback(player);
    savePlayers(players);
}

// Initialise whichever page is currently open.
initPlayersPage();
initPitch();
initProfile();
