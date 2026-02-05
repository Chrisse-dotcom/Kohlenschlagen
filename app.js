const STORAGE_KEY = "kohlenschlagen_state_v1";

const defaultSettings = () => ({
  pointsStockditsch: 10,
  pointsWindditsch: 5,
  pointsUnterweite: 3,
  euroKohleWeg: 2,
  euroHeideKaputt: 5,
  euroStockKaputt: 5,
  euroPflicht: 1,
});

const state = {
  teams: [],
  activeTeamId: null,
};

const elements = {
  teamSelect: document.getElementById("teamSelect"),
  newTeamBtn: document.getElementById("newTeamBtn"),
  endGameBtn: document.getElementById("endGameBtn"),
  teamSetup: document.getElementById("teamSetup"),
  teamForm: document.getElementById("teamForm"),
  teamName: document.getElementById("teamName"),
  app: document.getElementById("app"),
  tabs: document.querySelectorAll(".tab"),
  dashboard: document.getElementById("dashboard"),
  spielzug: document.getElementById("spielzug"),
  pflicht: document.getElementById("pflicht"),
  optionen: document.getElementById("optionen"),
};

const formatEuro = (value) => `${value.toFixed(2)} €`;

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const loadState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    state.teams = parsed.teams ?? [];
    state.activeTeamId = parsed.activeTeamId ?? null;
  }
};

const createTeam = (name) => ({
  id: crypto.randomUUID(),
  name,
  createdAt: new Date().toISOString(),
  ended: false,
  players: [],
  settings: defaultSettings(),
  currentPlayerIndex: 0,
});

const getActiveTeam = () => state.teams.find((team) => team.id === state.activeTeamId) || null;

const ensureActiveTeam = () => {
  if (!state.activeTeamId && state.teams.length > 0) {
    state.activeTeamId = state.teams[0].id;
  }
};

const updateTeamSelect = () => {
  elements.teamSelect.innerHTML = "";
  state.teams.forEach((team) => {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = team.name;
    elements.teamSelect.appendChild(option);
  });
  elements.teamSelect.value = state.activeTeamId ?? "";
  elements.teamSelect.disabled = state.teams.length === 0;
};

const showView = (view) => {
  elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  [elements.dashboard, elements.spielzug, elements.pflicht, elements.optionen].forEach((section) => {
    section.classList.toggle("hidden", section.id !== view);
  });
};

const renderDashboard = (team) => {
  if (!team) return;
  const players = [...team.players].sort((a, b) => a.totalEuro - b.totalEuro);
  const rows = players
    .map(
      (player, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${player.name}</td>
          <td>${player.points}</td>
          <td>${formatEuro(player.penaltyEuro)}</td>
          <td>${formatEuro(player.pflicht.costEuro)}</td>
          <td>${player.pflicht.attempts}/3 (${player.pflicht.failures} Fehlversuche)</td>
          <td>${player.pflicht.completed ? "abgeschlossen" : "offen"}</td>
          <td><strong>${formatEuro(player.totalEuro)}</strong></td>
        </tr>
      `,
    )
    .join("");

  elements.dashboard.innerHTML = `
    <h2>Dashboard – ${team.name}</h2>
    <p class="muted">Der Spieler mit dem geringsten Geldbetrag gewinnt.</p>
    ${
      players.length === 0
        ? `<p class="notice">Noch keine Spieler angelegt. Bitte Spieler unter Optionen hinzufügen.</p>`
        : `
        <table class="table">
          <thead>
            <tr>
              <th>Platz</th>
              <th>Spieler</th>
              <th>Punkte</th>
              <th>Schäden (Euro)</th>
              <th>Pflicht (Euro)</th>
              <th>Pflichtstatus</th>
              <th>Pflicht offen?</th>
              <th>Gesamt (Euro)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `
    }
  `;
};

const renderSpielzug = (team) => {
  if (!team) return;
  if (team.ended) {
    elements.spielzug.innerHTML = `<p class="notice">Das Spiel ist beendet. Es ist nur noch das Dashboard sichtbar.</p>`;
    return;
  }
  if (team.players.length === 0) {
    elements.spielzug.innerHTML = `<p class="notice">Bitte lege zuerst Spieler unter Optionen an.</p>`;
    return;
  }
  const player = team.players[team.currentPlayerIndex];
  const settings = team.settings;
  elements.spielzug.innerHTML = `
    <h2>Spielzug – ${team.name}</h2>
    <div class="grid two">
      <div>
        <h3>Aktueller Spieler</h3>
        <div class="player-card">
          <h4>${player.name}</h4>
          <p class="muted">Runde ${team.currentPlayerIndex + 1} / ${team.players.length}</p>
          <div class="actions">
            <span class="badge">Punkte: ${player.points}</span>
            <span class="badge">Schäden: ${formatEuro(player.penaltyEuro)}</span>
            <span class="badge">Pflicht: ${formatEuro(player.pflicht.costEuro)}</span>
          </div>
        </div>
      </div>
      <form id="spielzugForm" class="grid">
        <div class="grid two">
          <label><input type="checkbox" name="stockditsch" /> Stockditsch (+${settings.pointsStockditsch} Punkte)</label>
          <label><input type="checkbox" name="windditsch" /> Windditsch (+${settings.pointsWindditsch} Punkte)</label>
          <label><input type="checkbox" name="unterweite" /> Unterweite (+${settings.pointsUnterweite} Punkte)</label>
          <label><input type="checkbox" name="kohleweg" /> Kohle weg (+${formatEuro(settings.euroKohleWeg)})</label>
          <label><input type="checkbox" name="heidekaputt" /> Heide kaputt (+${formatEuro(settings.euroHeideKaputt)})</label>
          <label><input type="checkbox" name="stockkaputt" /> Stock kaputt (+${formatEuro(settings.euroStockKaputt)})</label>
        </div>
        <div class="actions">
          <button class="primary" type="submit">Weiter</button>
          <button id="skipBtn" type="button">Keine Auswahl</button>
        </div>
      </form>
    </div>
  `;

  const form = document.getElementById("spielzugForm");
  const handleSubmit = (selected) => {
    const points =
      (selected.stockditsch ? settings.pointsStockditsch : 0) +
      (selected.windditsch ? settings.pointsWindditsch : 0) +
      (selected.unterweite ? settings.pointsUnterweite : 0);
    const penalties =
      (selected.kohleweg ? settings.euroKohleWeg : 0) +
      (selected.heidekaputt ? settings.euroHeideKaputt : 0) +
      (selected.stockkaputt ? settings.euroStockKaputt : 0);
    player.points += points;
    player.penaltyEuro += penalties;
    recalcPlayer(player, team.settings);
    team.currentPlayerIndex = (team.currentPlayerIndex + 1) % team.players.length;
    saveState();
    renderAll();
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    handleSubmit({
      stockditsch: data.has("stockditsch"),
      windditsch: data.has("windditsch"),
      unterweite: data.has("unterweite"),
      kohleweg: data.has("kohleweg"),
      heidekaputt: data.has("heidekaputt"),
      stockkaputt: data.has("stockkaputt"),
    });
  });

  document.getElementById("skipBtn").addEventListener("click", () => {
    handleSubmit({
      stockditsch: false,
      windditsch: false,
      unterweite: false,
      kohleweg: false,
      heidekaputt: false,
      stockkaputt: false,
    });
  });
};

const renderPflicht = (team) => {
  if (!team) return;
  if (team.ended) {
    elements.pflicht.innerHTML = `<p class="notice">Das Spiel ist beendet. Es ist nur noch das Dashboard sichtbar.</p>`;
    return;
  }
  if (team.players.length === 0) {
    elements.pflicht.innerHTML = `<p class="notice">Bitte lege zuerst Spieler unter Optionen an.</p>`;
    return;
  }
  const playerOptions = team.players
    .map((player) => `<option value="${player.id}">${player.name}</option>`)
    .join("");
  elements.pflicht.innerHTML = `
    <h2>Pflichtschläge</h2>
    <div class="grid two">
      <form id="pflichtForm" class="grid">
        <label class="field">
          <span>Spieler auswählen</span>
          <select id="pflichtPlayer">
            ${playerOptions}
          </select>
        </label>
        <div class="actions">
          <button class="primary" type="button" data-action="success">Erfolg</button>
          <button type="button" data-action="fail">Fehlversuch</button>
        </div>
        <p class="muted">Maximal 3 Versuche. Erfolg beendet sofort.</p>
      </form>
      <div>
        <h3>Statusübersicht</h3>
        <div id="pflichtStatus" class="list"></div>
      </div>
    </div>
  `;

  const statusList = document.getElementById("pflichtStatus");
  statusList.innerHTML = team.players
    .map((player) => {
      const status = player.pflicht.completed ? "abgeschlossen" : "offen";
      return `
        <div class="player-card">
          <h4>${player.name}</h4>
          <p class="muted">Versuche: ${player.pflicht.attempts}/3 · Fehlversuche: ${player.pflicht.failures}</p>
          <p class="muted">Kosten: ${formatEuro(player.pflicht.costEuro)} · Status: ${status}</p>
        </div>
      `;
    })
    .join("");

  const buttons = elements.pflicht.querySelectorAll("button[data-action]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const playerId = document.getElementById("pflichtPlayer").value;
      const player = team.players.find((entry) => entry.id === playerId);
      if (!player || player.pflicht.completed) {
        return;
      }
      if (button.dataset.action === "success") {
        player.pflicht.completed = true;
      } else {
        if (player.pflicht.attempts >= 3) {
          return;
        }
        player.pflicht.attempts += 1;
        player.pflicht.failures += 1;
        player.pflicht.costEuro += team.settings.euroPflicht;
        if (player.pflicht.attempts >= 3) {
          player.pflicht.completed = true;
        }
      }
      recalcPlayer(player, team.settings);
      saveState();
      renderAll();
    });
  });
};

const renderOptionen = (team) => {
  if (!team) return;
  const settings = team.settings;
  const playerRows = team.players
    .map(
      (player, index) => `
      <div class="player-card">
        <label class="field">
          <span>Spieler ${index + 1}</span>
          <input type="text" data-player-id="${player.id}" value="${player.name}" />
        </label>
        <button type="button" data-remove-player="${player.id}">Entfernen</button>
      </div>
    `,
    )
    .join("");

  elements.optionen.innerHTML = `
    <h2>Optionen</h2>
    <div class="grid two">
      <form id="settingsForm" class="grid">
        <label class="field">
          <span>Punktzahl für Stockditsch</span>
          <input type="number" name="pointsStockditsch" value="${settings.pointsStockditsch}" min="0" />
        </label>
        <label class="field">
          <span>Punktzahl für Windditsch</span>
          <input type="number" name="pointsWindditsch" value="${settings.pointsWindditsch}" min="0" />
        </label>
        <label class="field">
          <span>Punktzahl für Unterweite</span>
          <input type="number" name="pointsUnterweite" value="${settings.pointsUnterweite}" min="0" />
        </label>
        <label class="field">
          <span>Geldbetrag in Euro für Kohle weg</span>
          <input type="number" name="euroKohleWeg" step="0.01" min="0" value="${settings.euroKohleWeg}" />
        </label>
        <label class="field">
          <span>Geldbetrag in Euro für Heide kaputt</span>
          <input type="number" name="euroHeideKaputt" step="0.01" min="0" value="${settings.euroHeideKaputt}" />
        </label>
        <label class="field">
          <span>Geldbetrag in Euro für Stock kaputt</span>
          <input type="number" name="euroStockKaputt" step="0.01" min="0" value="${settings.euroStockKaputt}" />
        </label>
        <label class="field">
          <span>Geldbetrag in Euro für Pflichtschlag</span>
          <input type="number" name="euroPflicht" step="0.01" min="0" value="${settings.euroPflicht}" />
        </label>
        <button class="primary" type="submit">Einstellungen speichern</button>
      </form>
      <div>
        <h3>Spieler (max. 10)</h3>
        <div id="playerList" class="list">${playerRows || "<p class=\"muted\">Noch keine Spieler.</p>"}</div>
        <div class="actions">
          <button id="addPlayerBtn" class="primary" type="button">Spieler hinzufügen</button>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById("settingsForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    team.settings = {
      pointsStockditsch: Number(data.get("pointsStockditsch")),
      pointsWindditsch: Number(data.get("pointsWindditsch")),
      pointsUnterweite: Number(data.get("pointsUnterweite")),
      euroKohleWeg: Number(data.get("euroKohleWeg")),
      euroHeideKaputt: Number(data.get("euroHeideKaputt")),
      euroStockKaputt: Number(data.get("euroStockKaputt")),
      euroPflicht: Number(data.get("euroPflicht")),
    };
    team.players.forEach((player) => recalcPlayer(player, team.settings));
    saveState();
    renderAll();
  });

  document.getElementById("addPlayerBtn").addEventListener("click", () => {
    if (team.players.length >= 10) {
      alert("Maximal 10 Spieler erlaubt.");
      return;
    }
    const newPlayer = createPlayer(`Spieler ${team.players.length + 1}`);
    team.players.push(newPlayer);
    saveState();
    renderAll();
  });

  elements.optionen.querySelectorAll("input[data-player-id]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const player = team.players.find((entry) => entry.id === event.target.dataset.playerId);
      if (player) {
        player.name = event.target.value;
        saveState();
        renderAll();
      }
    });
  });

  elements.optionen.querySelectorAll("button[data-remove-player]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.removePlayer;
      team.players = team.players.filter((player) => player.id !== id);
      if (team.currentPlayerIndex >= team.players.length) {
        team.currentPlayerIndex = 0;
      }
      saveState();
      renderAll();
    });
  });
};

const createPlayer = (name) => ({
  id: crypto.randomUUID(),
  name,
  points: 0,
  penaltyEuro: 0,
  pflicht: {
    attempts: 0,
    failures: 0,
    costEuro: 0,
    completed: false,
  },
  totalEuro: 0,
});

const recalcPlayer = (player, settings) => {
  const pointsEuro = player.points / 100;
  const penaltyEuro = player.penaltyEuro;
  const pflichtEuro = player.pflicht.costEuro;
  player.totalEuro = Number((pointsEuro + penaltyEuro + pflichtEuro).toFixed(2));
  player.penaltyEuro = Number(penaltyEuro.toFixed(2));
  player.pflicht.costEuro = Number(pflichtEuro.toFixed(2));
};

const renderAll = () => {
  ensureActiveTeam();
  updateTeamSelect();
  const team = getActiveTeam();
  const hasTeam = Boolean(team);
  elements.teamSetup.classList.toggle("hidden", hasTeam);
  elements.app.classList.toggle("hidden", !hasTeam);
  elements.endGameBtn.disabled = !hasTeam || team?.ended;
  if (team) {
    renderDashboard(team);
    renderSpielzug(team);
    renderPflicht(team);
    renderOptionen(team);
  }
};

const init = () => {
  loadState();
  ensureActiveTeam();
  updateTeamSelect();
  renderAll();

  elements.teamForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.teamName.value.trim();
    if (!name) return;
    const newTeam = createTeam(name);
    state.teams.push(newTeam);
    state.activeTeamId = newTeam.id;
    elements.teamName.value = "";
    saveState();
    renderAll();
  });

  elements.newTeamBtn.addEventListener("click", () => {
    elements.teamSetup.classList.remove("hidden");
    elements.app.classList.add("hidden");
    elements.teamName.focus();
  });

  elements.teamSelect.addEventListener("change", (event) => {
    state.activeTeamId = event.target.value;
    saveState();
    renderAll();
  });

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      showView(tab.dataset.view);
    });
  });

  elements.endGameBtn.addEventListener("click", () => {
    const team = getActiveTeam();
    if (!team || team.ended) return;
    const confirmed = confirm("Wirklich beenden?");
    if (confirmed) {
      team.ended = true;
      saveState();
      showView("dashboard");
      renderAll();
    }
  });
};

init();
