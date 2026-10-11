/**
 * ==========================================================================
 * ANOMALY: LAB LOCKDOWN — Core Game Engine
 * Vanilla JavaScript (ES6+), Zero External Libraries or Build Tools
 * ==========================================================================
 */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     1. GAME STATE MANAGEMENT
     -------------------------------------------------------------------------- */
  const state = {
    gameStarted: false,
    soundEnabled: true,
    scanned: false,
    inspected: {
      reactor: false,
      server: false,
      console: false
    },
    solved: {
      reactor: false,
      server: false,
      console: false
    },
    history: [],
    historyIndex: -1,
    victoryTriggered: false
  };

  /* --------------------------------------------------------------------------
     2. AUDIO SYNTHESIS ENGINE (Web Audio API)
     Zero external audio files needed; generates retro sci-fi sounds cleanly
     -------------------------------------------------------------------------- */
  let audioCtx = null;

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.05) {
    if (!state.soundEnabled) return;
    try {
      initAudioContext();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // Audio error silently handled
    }
  }

  function soundClick() {
    playTone(850, 'triangle', 0.04, 0.03);
  }

  function soundSuccess() {
    playTone(523.25, 'sine', 0.12, 0.08); // C5
    setTimeout(() => playTone(659.25, 'sine', 0.12, 0.08), 120); // E5
    setTimeout(() => playTone(783.99, 'sine', 0.18, 0.09), 240); // G5
    setTimeout(() => playTone(1046.5, 'sine', 0.3, 0.1), 360); // C6
  }

  function soundError() {
    playTone(180, 'sawtooth', 0.15, 0.08);
    setTimeout(() => playTone(140, 'sawtooth', 0.2, 0.08), 120);
  }

  function soundScan() {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        playTone(300 + i * 150, 'sine', 0.08, 0.04);
      }, i * 90);
    }
  }

  function soundVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        playTone(freq, 'triangle', 0.25, 0.08);
      }, idx * 140);
    });
  }

  /* --------------------------------------------------------------------------
     3. DOM ELEMENTS
     -------------------------------------------------------------------------- */
  const elements = {
    // Screens
    mainMenu: document.getElementById('mainMenu'),
    gameInterface: document.getElementById('gameInterface'),
    victoryModal: document.getElementById('victoryModal'),

    // Buttons
    initSystemBtn: document.getElementById('initSystemBtn'),
    restartMissionBtn: document.getElementById('restartMissionBtn'),
    soundToggle: document.getElementById('soundToggle'),
    soundIcon: document.getElementById('soundIcon'),
    clearTermBtn: document.getElementById('clearTermBtn'),

    // Top Bar Metrics
    progressPercent: document.getElementById('progressPercent'),
    missionProgressBar: document.getElementById('missionProgressBar'),
    lockdownStatusBadge: document.getElementById('lockdownStatusBadge'),

    // Laboratory Stations
    stationReactor: document.getElementById('stationReactor'),
    stationServer: document.getElementById('stationServer'),
    stationConsole: document.getElementById('stationConsole'),
    dotReactor: document.getElementById('dotReactor'),
    dotServer: document.getElementById('dotServer'),
    dotConsole: document.getElementById('dotConsole'),
    labelReactor: document.getElementById('labelReactor'),
    labelServer: document.getElementById('labelServer'),
    labelConsole: document.getElementById('labelConsole'),

    // Telemetry Cards
    puzzleCountBadge: document.getElementById('puzzleCountBadge'),
    metricLockdown: document.getElementById('metricLockdown'),
    metricLockdownSub: document.getElementById('metricLockdownSub'),
    metricLockdownLed: document.getElementById('metricLockdownLed'),
    metricData: document.getElementById('metricData'),
    metricDataSub: document.getElementById('metricDataSub'),
    metricDataLed: document.getElementById('metricDataLed'),
    metricReactor: document.getElementById('metricReactor'),
    metricReactorSub: document.getElementById('metricReactorSub'),
    metricReactorLed: document.getElementById('metricReactorLed'),
    metricAnomaly: document.getElementById('metricAnomaly'),
    metricAnomalySub: document.getElementById('metricAnomalySub'),
    metricAnomalyLed: document.getElementById('metricAnomalyLed'),

    // Terminal
    terminalOutput: document.getElementById('terminalOutput'),
    terminalForm: document.getElementById('terminalForm'),
    commandInput: document.getElementById('commandInput')
  };

  /* --------------------------------------------------------------------------
     4. TERMINAL LOGGING UTILITIES (Safe DOM Manipulation)
     -------------------------------------------------------------------------- */
  function appendTerminalLine(text, type = 'info') {
    if (!elements.terminalOutput) return;

    const line = document.createElement('div');
    line.className = `term-line term-line-${type}`;

    if (type === 'user') {
      const promptSpan = document.createElement('span');
      promptSpan.className = 'prompt-symbol';
      promptSpan.textContent = 'root@anomaly:~/lab#';
      line.appendChild(promptSpan);

      const textNode = document.createTextNode(` ${text}`);
      line.appendChild(textNode);
    } else {
      line.textContent = text;
    }

    elements.terminalOutput.appendChild(line);
    elements.terminalOutput.scrollTop = elements.terminalOutput.scrollHeight;
  }

  function appendTerminalCustom(domNode) {
    if (!elements.terminalOutput) return;
    elements.terminalOutput.appendChild(domNode);
    elements.terminalOutput.scrollTop = elements.terminalOutput.scrollHeight;
  }

  function clearTerminal() {
    if (!elements.terminalOutput) return;
    elements.terminalOutput.innerHTML = '';
    appendTerminalLine('Terminal buffer purged. System ready.', 'sys');
  }

  /* --------------------------------------------------------------------------
     5. INITIALIZATION & TRANSITIONS
     -------------------------------------------------------------------------- */
  function initGame() {
    state.gameStarted = true;
    initAudioContext();
    soundClick();

    // Transition screens
    elements.mainMenu.classList.remove('active');
    elements.gameInterface.classList.add('active');

    // Focus terminal input
    setTimeout(() => {
      elements.commandInput.focus();
    }, 150);

    // Boot sequence messages
    printBootSequence();
  }

  function printBootSequence() {
    clearTerminal();
    appendTerminalLine('=========================================================', 'sys');
    appendTerminalLine('     ANOMALY OPERATING SYSTEM // QUANTUM LAB V3.8       ', 'sys');
    appendTerminalLine('=========================================================', 'sys');
    appendTerminalLine('CRITICAL ALERT: Unauthorized intruder compromised root protocols.', 'error');
    appendTerminalLine('Facility lockdown ACTIVE. Blast doors sealed.', 'error');
    appendTerminalLine('Clean-energy research database ciphered.', 'error');
    appendTerminalLine('Reactor zero-point containment decaying.', 'error');
    appendTerminalLine('---------------------------------------------------------', 'sys');
    appendTerminalLine('Type "help" to view command catalog, or "scan" to inspect lab telemetry.', 'info');
  }

  /* --------------------------------------------------------------------------
     6. COMMAND PARSER & DISPATCHER
     -------------------------------------------------------------------------- */
  function handleCommandSubmit(e) {
    if (e) e.preventDefault();

    const rawInput = elements.commandInput.value;
    const sanitized = rawInput.trim();

    if (!sanitized) return;

    // Record command history
    state.history.push(rawInput);
    state.historyIndex = state.history.length;

    // Log user command
    appendTerminalLine(sanitized, 'user');
    elements.commandInput.value = '';

    soundClick();

    // Parse and execute
    executeCommand(sanitized);
  }

  function executeCommand(commandStr) {
    // Normalization: lower-case and consolidate multi-spaces
    const normalized = commandStr.toLowerCase().replace(/\s+/g, ' ');
    const parts = normalized.split(' ');
    const primary = parts[0];

    switch (primary) {
      case 'help':
        cmdHelp();
        break;

      case 'scan':
        cmdScan();
        break;

      case 'inspect':
        if (parts.length < 2) {
          appendTerminalLine('ERROR: Missing target. Usage: inspect [reactor | server | console]', 'error');
          soundError();
        } else {
          cmdInspect(parts[1]);
        }
        break;

      case 'solve':
        if (parts.length < 2) {
          appendTerminalLine('ERROR: Incomplete command. Usage: solve [reactor | server | console] [answer]', 'error');
          soundError();
        } else {
          const target = parts[1];
          // Preserve raw answer string for exact checks while trimming outer whitespace
          const rawAnswer = commandStr.trim().replace(/^solve\s+[^\s]+\s*/i, '').trim();
          cmdSolve(target, rawAnswer);
        }
        break;

      case 'status':
        cmdStatus();
        break;

      case 'clear':
        clearTerminal();
        break;

      default:
        cmdUnknown(commandStr);
        break;
    }
  }

  /* --------------------------------------------------------------------------
     7. COMMAND IMPLEMENTATIONS
     -------------------------------------------------------------------------- */
  function cmdHelp() {
    appendTerminalLine('----- OPERATIONAL PROTOCOL DIRECTORY -----', 'sys');
    appendTerminalLine('scan                     : Scan laboratory sensors for anomalies & clues', 'info');
    appendTerminalLine('inspect reactor          : Examine the clean-energy reactor prototype', 'info');
    appendTerminalLine('inspect server           : Investigate the encrypted research data core', 'info');
    appendTerminalLine('inspect console          : Examine the central facility control console', 'info');
    appendTerminalLine('solve reactor [answer]   : Submit numerical answer to stabilize reactor', 'info');
    appendTerminalLine('solve server [answer]    : Submit cryptographic key phrase to unlock files', 'info');
    appendTerminalLine('solve console [answer]   : Submit authorization sequence to drop lockdown', 'info');
    appendTerminalLine('status                   : Display comprehensive diagnostic telemetry', 'info');
    appendTerminalLine('clear                    : Flush terminal output buffer', 'info');
    appendTerminalLine('help                     : Display this reference guide', 'info');
    appendTerminalLine('------------------------------------------', 'sys');
  }

  function cmdScan() {
    soundScan();
    state.scanned = true;

    // Update status panel
    elements.metricAnomaly.textContent = '3 ANOMALIES FOUND';
    elements.metricAnomaly.className = 'status-card-value danger';
    elements.metricAnomalyLed.className = 'metric-indicator danger';
    elements.metricAnomalySub.textContent = 'Reactor, Server, Console';

    appendTerminalLine('[SCANNING SECTOR 7...] Frequency sweep in progress...', 'sys');

    setTimeout(() => {
      appendTerminalLine('>> SENSOR TELEMETRY COMPLETE:', 'scan');
      appendTerminalLine(' • [ENERGY REACTOR] : Core frequency desynchronized. Sequence loop detected.', 'scan');
      appendTerminalLine(' • [DATA CORE]      : Biometric quantum cipher locked around research files.', 'scan');
      appendTerminalLine(' • [CONTROL CONSOLE]: Override terminal locked behind tri-character security token.', 'scan');
      appendTerminalLine('Use "inspect [reactor | server | console]" to examine each anomaly individually.', 'hint');
    }, 250);
  }

  function cmdInspect(target) {
    // Requirement 5: Must use scan before discovering/inspecting puzzles
    if (!state.scanned) {
      appendTerminalLine('ACCESS RESTRICTED: Sensor grid offline. Run "scan" first to map facility anomalies.', 'error');
      soundError();
      return;
    }

    switch (target) {
      case 'reactor':
        state.inspected.reactor = true;
        appendTerminalLine('=== INSPECTING ENERGY REACTOR UNIT ===', 'sys');
        appendTerminalLine('Elena Vance\'s clean-energy prototype is trapped in an exponential resonance trap.', 'info');
        appendTerminalLine('Diagnostic display reveals the sequence loop:', 'info');
        appendTerminalLine('    6 — 12 — 24 — 48 — ?', 'hint');
        appendTerminalLine('Calculate the next number in the sequence to stabilize the core.', 'info');
        if (state.solved.reactor) {
          appendTerminalLine('>> STATUS: PUZZLE ALREADY SOLVED. Reactor operational at 100%.', 'success');
        } else {
          appendTerminalLine('Command: solve reactor [answer]', 'hint');
        }
        break;

      case 'server':
        state.inspected.server = true;
        appendTerminalLine('=== INSPECTING RESEARCH DATA CORE ===', 'sys');
        appendTerminalLine('Corrupted root partition found. A cipher note left by the intruder reads:', 'info');
        appendTerminalLine('“The scientist’s code name lies within the double helix. Search the structure that carries the blueprint of life.”', 'hint');
        appendTerminalLine('Identify the key word associated with the clue to decrypt the research archive.', 'info');
        if (state.solved.server) {
          appendTerminalLine('>> STATUS: PUZZLE ALREADY SOLVED. Research files restored.', 'success');
        } else {
          appendTerminalLine('Command: solve server [answer]', 'hint');
        }
        break;

      case 'console':
        state.inspected.console = true;
        appendTerminalLine('=== INSPECTING CONTROL CONSOLE ===', 'sys');
        appendTerminalLine('Central security override lockout active. Emergency riddle displayed:', 'info');
        appendTerminalLine('“Three letters unlock the final sequence. Take the first letter of System, the last letter of Access, and the first letter of Security.”', 'hint');
        appendTerminalLine('Combine the letters in the stated order to bypass lockdown authorization.', 'info');
        if (state.solved.console) {
          appendTerminalLine('>> STATUS: PUZZLE ALREADY SOLVED. Lockdown disengaged.', 'success');
        } else {
          appendTerminalLine('Command: solve console [answer]', 'hint');
        }
        break;

      default:
        appendTerminalLine(`ERROR: Unknown target "${target}". Valid targets: reactor, server, console`, 'error');
        soundError();
        break;
    }
  }

  function cmdSolve(target, rawAnswer) {
    // Check if target is valid
    if (!['reactor', 'server', 'console'].includes(target)) {
      appendTerminalLine(`ERROR: Unknown solve target "${target}". Must be reactor, server, or console.`, 'error');
      soundError();
      return;
    }

    // Check if answer provided
    if (!rawAnswer) {
      appendTerminalLine(`ERROR: No answer provided. Example: solve ${target} [answer]`, 'error');
      soundError();
      return;
    }

    // Requirement 5: Must use scan and inspect each location to discover its puzzle before being able to solve it
    if (!state.scanned) {
      appendTerminalLine('OVERRIDE REJECTED: You must "scan" the facility to calibrate sensors first.', 'error');
      soundError();
      return;
    }

    if (!state.inspected[target]) {
      appendTerminalLine(`OVERRIDE REJECTED: You have not inspected the ${target} yet. Run "inspect ${target}" first.`, 'error');
      soundError();
      return;
    }

    // Check if already solved
    if (state.solved[target]) {
      appendTerminalLine(`NOTICE: The ${target} puzzle has already been resolved and verified.`, 'info');
      return;
    }

    // Clean answer for comparison
    const answerClean = rawAnswer.trim().toLowerCase();

    // Dispatch target validation
    if (target === 'reactor') {
      solveReactor(answerClean, rawAnswer);
    } else if (target === 'server') {
      solveServer(answerClean, rawAnswer);
    } else if (target === 'console') {
      solveConsole(answerClean, rawAnswer);
    }
  }

  /* --------------------------------------------------------------------------
     8. PUZZLE 1: REACTOR (Answer: 96)
     -------------------------------------------------------------------------- */
  function solveReactor(answerClean) {
    if (answerClean === '96') {
      state.solved.reactor = true;
      soundSuccess();

      // Terminal feedback
      appendTerminalLine('CALCULATION VERIFIED: Sequence term 96 recognized.', 'success');
      appendTerminalLine('Zero-point flux field stabilizing...', 'success');
      appendTerminalLine('Reactor output increasing: 0.0 GW -> 12.8 GW [OPTIMAL].', 'success');

      // Visual updates
      elements.stationReactor.classList.add('solved');
      elements.stationReactor.setAttribute('aria-label', 'Energy Reactor Unit: Solved');
      elements.dotReactor.className = 'station-status-dot solved';
      elements.dotReactor.title = 'Status: Solved';
      elements.labelReactor.textContent = '12.8 GW // STABILIZED';
      elements.labelReactor.classList.add('solved-text');

      elements.metricReactor.textContent = '12.8 GW (ONLINE)';
      elements.metricReactor.className = 'status-card-value success';
      elements.metricReactorLed.className = 'metric-indicator success';
      elements.metricReactorSub.textContent = 'Containment field 100%';

      updateOverallProgress();
    } else {
      soundError();
      appendTerminalLine(`DIAGNOSTIC FAILURE: "${answerClean}" is incorrect. Reactor resonance unstable.`, 'error');
      appendTerminalLine('HINT: Notice how each number relates to the preceding value (6 × 2 = 12, 12 × 2 = 24, 24 × 2 = 48...). What is 48 doubled?', 'hint');
    }
  }

  /* --------------------------------------------------------------------------
     9. PUZZLE 2: SERVER (Answer: helix)
     -------------------------------------------------------------------------- */
  function solveServer(answerClean) {
    if (answerClean === 'helix') {
      state.solved.server = true;
      soundSuccess();

      // Terminal feedback
      appendTerminalLine('DECRYPTION SUCCESSFUL: Biometric keyphrase "HELIX" accepted.', 'success');
      appendTerminalLine('Quantum archives decrypted: 8,420 research files restored.', 'success');
      appendTerminalLine('Elena Vance clean-energy blueprints verified and secured.', 'success');

      // Visual updates
      elements.stationServer.classList.add('solved');
      elements.stationServer.setAttribute('aria-label', 'Research Data Core: Solved');
      elements.dotServer.className = 'station-status-dot solved';
      elements.dotServer.title = 'Status: Solved';
      elements.labelServer.textContent = 'DATA RESTORED';
      elements.labelServer.classList.add('solved-text');

      elements.metricData.textContent = '100% (RESTORED)';
      elements.metricData.className = 'status-card-value success';
      elements.metricDataLed.className = 'metric-indicator success';
      elements.metricDataSub.textContent = 'Zero loss detected';

      updateOverallProgress();
    } else {
      soundError();
      appendTerminalLine(`DECRYPTION FAILED: Passphrase "${answerClean}" rejected by cryptographic cipher.`, 'error');
      appendTerminalLine('HINT: Think about molecular biology and DNA. What geometric shape is the famous double structure of life?', 'hint');
    }
  }

  /* --------------------------------------------------------------------------
     10. PUZZLE 3: CONSOLE (Answer: SIS)
     -------------------------------------------------------------------------- */
  function solveConsole(answerClean) {
    if (answerClean === 'sis') {
      state.solved.console = true;
      soundSuccess();

      // Terminal feedback
      appendTerminalLine('OVERRIDE AUTHENTICATED: Security token "SIS" verified.', 'success');
      appendTerminalLine('Automated facility lockdown disengaged.', 'success');
      appendTerminalLine('Blast doors unsealed. Atmospheric scrubbers normal.', 'success');

      // Visual updates
      elements.stationConsole.classList.add('solved');
      elements.stationConsole.setAttribute('aria-label', 'Control Console: Solved');
      elements.dotConsole.className = 'station-status-dot solved';
      elements.dotConsole.title = 'Status: Solved';
      elements.labelConsole.textContent = 'LOCKDOWN CLEARED';
      elements.labelConsole.classList.add('solved-text');

      elements.lockdownStatusBadge.textContent = 'LOCKDOWN: DISENGAGED';
      elements.lockdownStatusBadge.className = 'status-pill status-pill-success';

      elements.metricLockdown.textContent = 'DISENGAGED';
      elements.metricLockdown.className = 'status-card-value success';
      elements.metricLockdownLed.className = 'metric-indicator success';
      elements.metricLockdownSub.textContent = 'All exits unsealed';

      updateOverallProgress();
    } else {
      soundError();
      appendTerminalLine(`AUTHORIZATION REJECTED: Security code "${answerClean.toUpperCase()}" invalid.`, 'error');
      appendTerminalLine('HINT: Assemble the exact 3 letters in order: First of [S]ystem + Last of Acces[s] + First of [S]ecurity.', 'hint');
    }
  }

  /* --------------------------------------------------------------------------
     11. MISSION STATUS CHECK
     -------------------------------------------------------------------------- */
  function cmdStatus() {
    const solvedCount = Object.values(state.solved).filter(Boolean).length;
    appendTerminalLine('=== COMPREHENSIVE MISSION TELEMETRY ===', 'sys');
    appendTerminalLine(`Puzzles Completed: ${solvedCount}/3`, 'info');
    appendTerminalLine(` • Energy Reactor    : ${state.solved.reactor ? '[ONLINE / 12.8 GW]' : (state.inspected.reactor ? '[INSPECTED / OFFLINE]' : '[CRITICAL / UNEXAMINED]')}`, state.solved.reactor ? 'success' : 'error');
    appendTerminalLine(` • Research Data Core: ${state.solved.server ? '[100% RESTORED]' : (state.inspected.server ? '[INSPECTED / ENCRYPTED]' : '[CORRUPTED / UNEXAMINED]')}`, state.solved.server ? 'success' : 'error');
    appendTerminalLine(` • Control Console   : ${state.solved.console ? '[LOCKDOWN DISENGAGED]' : (state.inspected.console ? '[INSPECTED / LOCKED]' : '[SEALED / UNEXAMINED]')}`, state.solved.console ? 'success' : 'error');
    appendTerminalLine(`Sensor Sweep Active  : ${state.scanned ? 'YES' : 'NO (Type "scan")'}`, 'info');
    appendTerminalLine('========================================', 'sys');
  }

  function cmdUnknown(cmd) {
    soundError();
    appendTerminalLine(`command not found: "${cmd}". Type "help" for a list of valid commands.`, 'error');
  }

  /* --------------------------------------------------------------------------
     12. PROGRESS TRACKING & VICTORY SEQUENCE
     -------------------------------------------------------------------------- */
  function updateOverallProgress() {
    const solvedCount = Object.values(state.solved).filter(Boolean).length;
    const percent = Math.round((solvedCount / 3) * 100);

    // Top progress bar
    elements.progressPercent.textContent = `${percent}%`;
    elements.missionProgressBar.style.width = `${percent}%`;
    elements.puzzleCountBadge.textContent = `PUZZLES: ${solvedCount}/3`;

    if (solvedCount === 3 && !state.victoryTriggered) {
      state.victoryTriggered = true;
      setTimeout(triggerVictorySequence, 900);
    }
  }

  function triggerVictorySequence() {
    soundVictory();

    // Terminal celebratory banner
    appendTerminalLine('*********************************************************', 'success');
    appendTerminalLine('            MISSION COMPLETE — SECTOR 7 SECURED         ', 'success');
    appendTerminalLine('*********************************************************', 'success');
    appendTerminalLine('Laboratory lockdown disengaged.', 'success');
    appendTerminalLine('Research data integrity restored.', 'success');
    appendTerminalLine('Clean-energy discovery secured.', 'success');

    // Show victory modal
    elements.victoryModal.removeAttribute('hidden');
    elements.restartMissionBtn.focus();
  }

  /* --------------------------------------------------------------------------
     13. RESET & RESTART FLOW
     -------------------------------------------------------------------------- */
  function restartMission() {
    soundClick();

    // Reset state
    state.scanned = false;
    state.inspected.reactor = false;
    state.inspected.server = false;
    state.inspected.console = false;
    state.solved.reactor = false;
    state.solved.server = false;
    state.solved.console = false;
    state.history = [];
    state.historyIndex = -1;
    state.victoryTriggered = false;

    // Reset Visual Stations
    elements.stationReactor.classList.remove('solved');
    elements.stationReactor.setAttribute('aria-label', 'Energy Reactor Unit: Unsolved');
    elements.dotReactor.className = 'station-status-dot unsolved';
    elements.dotReactor.title = 'Status: Unsolved';
    elements.labelReactor.textContent = 'CRITICAL // OFFLINE';
    elements.labelReactor.classList.remove('solved-text');

    elements.stationServer.classList.remove('solved');
    elements.stationServer.setAttribute('aria-label', 'Research Data Core: Unsolved');
    elements.dotServer.className = 'station-status-dot unsolved';
    elements.dotServer.title = 'Status: Unsolved';
    elements.labelServer.textContent = 'FILES ENCRYPTED';
    elements.labelServer.classList.remove('solved-text');

    elements.stationConsole.classList.remove('solved');
    elements.stationConsole.setAttribute('aria-label', 'Control Console: Unsolved');
    elements.dotConsole.className = 'station-status-dot unsolved';
    elements.dotConsole.title = 'Status: Unsolved';
    elements.labelConsole.textContent = 'LOCKDOWN ENGAGED';
    elements.labelConsole.classList.remove('solved-text');

    // Reset Topbar & Metrics
    elements.lockdownStatusBadge.textContent = 'LOCKDOWN: ENGAGED';
    elements.lockdownStatusBadge.className = 'status-pill status-pill-danger';

    elements.metricLockdown.textContent = 'SEALED (LVL 5)';
    elements.metricLockdown.className = 'status-card-value danger';
    elements.metricLockdownLed.className = 'metric-indicator danger';
    elements.metricLockdownSub.textContent = 'Blast doors engaged';

    elements.metricData.textContent = '14% (CORRUPTED)';
    elements.metricData.className = 'status-card-value danger';
    elements.metricDataLed.className = 'metric-indicator danger';
    elements.metricDataSub.textContent = 'Quantum files ciphered';

    elements.metricReactor.textContent = '0.0 GW (OFFLINE)';
    elements.metricReactor.className = 'status-card-value danger';
    elements.metricReactorLed.className = 'metric-indicator danger';
    elements.metricReactorSub.textContent = 'Zero-point flux collapsed';

    elements.metricAnomaly.textContent = 'SCAN REQUIRED';
    elements.metricAnomaly.className = 'status-card-value warning';
    elements.metricAnomalyLed.className = 'metric-indicator info';
    elements.metricAnomalySub.textContent = 'Type \'scan\' in terminal';

    elements.puzzleCountBadge.textContent = 'PUZZLES: 0/3';
    elements.progressPercent.textContent = '0%';
    elements.missionProgressBar.style.width = '0%';

    // Hide victory modal
    elements.victoryModal.setAttribute('hidden', '');

    // Reset terminal
    printBootSequence();

    // Focus input
    elements.commandInput.focus();
  }

  /* --------------------------------------------------------------------------
     14. EVENT LISTENERS & SHORTCUTS
     -------------------------------------------------------------------------- */
  function setupEventListeners() {
    // Menu Start Button
    elements.initSystemBtn.addEventListener('click', initGame);

    // Restart Button
    elements.restartMissionBtn.addEventListener('click', restartMission);

    // Audio Toggle
    elements.soundToggle.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      const label = elements.soundToggle.querySelector('.sound-label');
      if (state.soundEnabled) {
        elements.soundIcon.textContent = '🔊';
        if (label) label.textContent = 'AUDIO: ON';
        soundClick();
      } else {
        elements.soundIcon.textContent = '🔇';
        if (label) label.textContent = 'AUDIO: MUTED';
      }
    });

    // Clear Terminal Button
    elements.clearTermBtn.addEventListener('click', () => {
      soundClick();
      clearTerminal();
      elements.commandInput.focus();
    });

    // Terminal Form Submission
    elements.terminalForm.addEventListener('submit', handleCommandSubmit);

    // Terminal History Navigation (Up/Down Arrow Keys)
    elements.commandInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        if (state.history.length > 0 && state.historyIndex > 0) {
          state.historyIndex--;
          elements.commandInput.value = state.history[state.historyIndex];
          e.preventDefault();
        }
      } else if (e.key === 'ArrowDown') {
        if (state.history.length > 0 && state.historyIndex < state.history.length - 1) {
          state.historyIndex++;
          elements.commandInput.value = state.history[state.historyIndex];
          e.preventDefault();
        } else if (state.historyIndex >= state.history.length - 1) {
          state.historyIndex = state.history.length;
          elements.commandInput.value = '';
          e.preventDefault();
        }
      }
    });

    // Station Click to Inspect
    const stations = [elements.stationReactor, elements.stationServer, elements.stationConsole];
    stations.forEach((station) => {
      if (!station) return;
      const target = station.getAttribute('data-target');

      const triggerInspect = () => {
        if (!state.gameStarted) return;
        soundClick();
        appendTerminalLine(`inspect ${target}`, 'user');
        cmdInspect(target);
        elements.commandInput.focus();
      };

      station.addEventListener('click', triggerInspect);
      station.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerInspect();
        }
      });
    });

    // Quick Command Directory Clicks
    const helpRows = document.querySelectorAll('.quick-cmd-row');
    helpRows.forEach((row) => {
      row.addEventListener('click', () => {
        const cmd = row.getAttribute('data-cmd');
        if (!cmd) return;
        soundClick();
        elements.commandInput.value = cmd;
        elements.commandInput.focus();
      });
    });
  }

  // Self-execute listener bindings once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEventListeners);
  } else {
    setupEventListeners();
  }

})();
