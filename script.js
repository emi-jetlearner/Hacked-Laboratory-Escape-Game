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
    activePuzzles: {
      reactor: [],   // array of 3 puzzle objects for this mission
      server: [],
      console: []
    },
    history: [],
    historyIndex: -1,
    victoryTriggered: false
  };

  // Expose state for inspection and automated validation
  if (typeof window !== 'undefined') {
    window.__gameState = state;
  }

  /* --------------------------------------------------------------------------
     1.5 PUZZLE BANKS — 9 problems per mission (3 per device)
     -------------------------------------------------------------------------- */
  const PUZZLE_BANK_REACTOR = [
    {
      id: 'R1',
      display: '3, 7, 11, 15, ?',
      instruction: 'Find the next number in the sequence to stabilize the core.',
      answer: '19',
      hint: 'Each step adds the same fixed number. What is 15 + 4?'
    },
    {
      id: 'R2',
      display: '2, 6, 18, 54, ?',
      instruction: 'Calculate the next value in the energy chain.',
      answer: '162',
      hint: 'Each number is multiplied by the same value each step. What is 54 × 3?'
    },
    {
      id: 'R3',
      display: '4, 9, 14, 19, ?',
      instruction: 'Determine the next reading in the power sequence.',
      answer: '24',
      hint: 'Each step adds the same fixed number. What is 19 + 5?'
    },
    {
      id: 'R4',
      display: '5, 10, 20, 40, ?',
      instruction: 'Find the next frequency to activate the reactor.',
      answer: '80',
      hint: 'Each step doubles the previous value. What is 40 × 2?'
    },
    {
      id: 'R5',
      display: '1, 4, 9, 16, ?',
      instruction: 'Identify the next value in the harmonic series.',
      answer: '25',
      hint: 'These are square numbers (1×1, 2×2, 3×3, 4×4...). What is 5×5?'
    }
  ];

  const PUZZLE_BANK_SERVER = [
    {
      id: 'S1',
      clue: 'I carry the genetic instructions used by living things. What molecule am I?',
      instruction: 'Type the name of the molecule to decrypt the archive.',
      answer: ['dna'],
      hint: 'Found in every living cell, it stores genetic information using four chemical bases.'
    },
    {
      id: 'S2',
      clue: 'Decode IFMJY by shifting each letter one place backward in the alphabet.',
      instruction: 'Type the decoded word to unlock the research files.',
      answer: ['helix'],
      hint: 'I → H, F → E, M → L, J → I, Y → X. Combine the decoded letters.'
    },
    {
      id: 'S3',
      clue: 'I have keys but no locks. I have a space but no room. You can press Enter, but you cannot walk through it. What am I?',
      instruction: 'Type the answer to gain access.',
      answer: ['keyboard'],
      hint: 'You use this device every time you type a command into this terminal.'
    },
    {
      id: 'S4',
      clue: 'Rearrange the letters W R O E P into a word related to energy research.',
      instruction: 'Type the unscrambled word.',
      answer: ['power'],
      hint: 'Unscramble W, R, O, E, P — it describes the energy produced by the reactor.'
    },
    {
      id: 'S5',
      clue: 'I get smaller every time you use me to write or draw. What am I?',
      instruction: 'Type the answer to unlock the file.',
      answer: ['pencil'],
      hint: 'A writing tool with a graphite core inside a wooden casing.'
    },
    {
      id: 'S6',
      clue: 'Rearrange the letters K S I D into a computer-related word.',
      instruction: 'Type the unscrambled word.',
      answer: ['disk'],
      hint: 'Unscramble K, S, I, D — it is a data storage device used in computers.'
    }
  ];

  const PUZZLE_BANK_CONSOLE = [
    {
      id: 'C1',
      clue: 'The first digit is 2. The second is twice the first. The third is the sum of the first two. Enter the three-digit code.',
      instruction: 'Type the three-digit code to override the lock.',
      answer: ['246'],
      hint: 'First digit: 2. Second digit: 2 × 2 = 4. Third digit: 2 + 4 = 6.'
    },
    {
      id: 'C2',
      clue: 'The first digit is 3. The second is one more than the first. The third is twice the second. Enter the three-digit code.',
      instruction: 'Type the three-digit code to override the lock.',
      answer: ['348'],
      hint: 'First digit: 3. Second digit: 3 + 1 = 4. Third digit: 4 × 2 = 8.'
    },
    {
      id: 'C3',
      clue: 'Enter a two-digit code whose digits sum to 9. The first digit is 3 greater than the second.',
      instruction: 'Type the two-digit code to override the lock.',
      answer: ['63'],
      hint: 'The two digits add to 9 and differ by 3. Try 6 and 3.'
    },
    {
      id: 'C4',
      clue: 'The first digit is 1. The second is 3 times the first. The third is the sum of the first two. Enter the three-digit code.',
      instruction: 'Type the three-digit code to override the lock.',
      answer: ['134'],
      hint: 'First digit: 1. Second digit: 1 × 3 = 3. Third digit: 1 + 3 = 4.'
    },
    {
      id: 'C5',
      clue: 'Enter a two-digit code whose digits sum to 7. The first digit is 1 greater than the second.',
      instruction: 'Type the two-digit code to override the lock.',
      answer: ['43'],
      hint: 'The two digits add to 7 and differ by 1. Try 4 and 3.'
    }
  ];

  function selectThreePuzzles(pool) {
    // Shuffle a copy of the pool and take the first 3, adding a solved flag
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map(puz => Object.assign({}, puz, { solved: false }));
  }

  // Returns the first unsolved puzzle for a device, or null if all are solved
  function getCurrentPuzzle(deviceKey) {
    if (!state.activePuzzles[deviceKey] || !Array.isArray(state.activePuzzles[deviceKey])) return null;
    return state.activePuzzles[deviceKey].find(p => !p.solved) || null;
  }

  // Returns how many of a device's 3 puzzles are solved
  function deviceSolvedCount(deviceKey) {
    if (!state.activePuzzles[deviceKey] || !Array.isArray(state.activePuzzles[deviceKey])) return 0;
    return state.activePuzzles[deviceKey].filter(p => p.solved).length;
  }

  // Applies station-complete visual updates when all 3 problems for a device are solved
  function markStationSolved(target) {
    if (state.solved) {
      state.solved[target] = true;
    }
    if (target === 'reactor') {
      elements.stationReactor.classList.add('solved');
      elements.stationReactor.setAttribute('aria-label', 'Energy Reactor Unit: Solved');
      elements.dotReactor.className = 'station-status-dot solved';
      elements.dotReactor.title = 'Status: Solved';
      elements.labelReactor.textContent = 'ONLINE // STABLE';
      elements.labelReactor.classList.add('solved-text');
      if (elements.metricReactor) {
        elements.metricReactor.textContent = 'ONLINE';
        elements.metricReactor.className = 'status-card-value success';
      }
    } else if (target === 'server') {
      elements.stationServer.classList.add('solved');
      elements.stationServer.setAttribute('aria-label', 'Research Server: Solved');
      elements.dotServer.className = 'station-status-dot solved';
      elements.dotServer.title = 'Status: Solved';
      elements.labelServer.textContent = 'FILES RESTORED';
      elements.labelServer.classList.add('solved-text');
      if (elements.metricData) {
        elements.metricData.textContent = 'RESTORED';
        elements.metricData.className = 'status-card-value success';
      }
    } else if (target === 'console') {
      elements.stationConsole.classList.add('solved');
      elements.stationConsole.setAttribute('aria-label', 'Control Console: Solved');
      elements.dotConsole.className = 'station-status-dot solved';
      elements.dotConsole.title = 'Status: Solved';
      elements.labelConsole.textContent = 'UNLOCKED';
      elements.labelConsole.classList.add('solved-text');
      if (elements.lockdownStatusBadge) {
        elements.lockdownStatusBadge.textContent = 'LOCKDOWN: UNLOCKED';
        elements.lockdownStatusBadge.className = 'status-pill status-pill-success';
      }
      if (elements.metricLockdown) {
        elements.metricLockdown.textContent = 'UNLOCKED';
        elements.metricLockdown.className = 'status-card-value success';
      }
    }
  }

  /* --------------------------------------------------------------------------
     1.5 PUZZLE POOLS (At least 10 variations per device)
     -------------------------------------------------------------------------- */
  const PUZZLES_REACTOR = [
    {
      display: '6 — 12 — 24 — 48 — ?',
      instruction: 'Determine the next number in the sequence to activate the core.',
      answer: '96',
      hint: 'Notice how each number relates to the preceding value (6 × 2 = 12, 12 × 2 = 24, 24 × 2 = 48). What is 48 doubled?'
    },
    {
      display: '3 — 6 — 12 — 24 — ?',
      instruction: 'Find the next number in the power sequence.',
      answer: '48',
      hint: 'Each step multiplies the value by 2 (3 × 2 = 6, 6 × 2 = 12, 12 × 2 = 24). What is 24 doubled?'
    },
    {
      display: '5 — 10 — 20 — 40 — ?',
      instruction: 'Calculate the next value in the energy chain.',
      answer: '80',
      hint: 'The power sequence doubles at every step (5 × 2 = 10, 10 × 2 = 20, 20 × 2 = 40). What is 40 × 2?'
    },
    {
      display: '4 — 8 — 16 — 32 — ?',
      instruction: 'Determine the next frequency to stabilize the reactor.',
      answer: '64',
      hint: 'Each value is double the previous value (4 × 2 = 8, 8 × 2 = 16, 16 × 2 = 32). What is 32 × 2?'
    },
    {
      display: '7 — 14 — 28 — 56 — ?',
      instruction: 'Find the next resonance frequency.',
      answer: '112',
      hint: 'Each step doubles the preceding number (7 × 2 = 14, 14 × 2 = 28, 28 × 2 = 56). What is 56 × 2?'
    },
    {
      display: '4 — 11 — 18 — 25 — ?',
      instruction: 'Calculate the next steady output level.',
      answer: '32',
      hint: 'Each step adds 7 (4 + 7 = 11, 11 + 7 = 18, 18 + 7 = 25). What is 25 + 7?'
    },
    {
      display: '15 — 23 — 31 — 39 — ?',
      instruction: 'Determine the next reading in the sequence.',
      answer: '47',
      hint: 'The sequence increases by 8 each time (15 + 8 = 23, 23 + 8 = 31, 31 + 8 = 39). What is 39 + 8?'
    },
    {
      display: '2 — 6 — 18 — 54 — ?',
      instruction: 'Find the missing multiplier to unlock the core.',
      answer: '162',
      hint: 'Each number is multiplied by 3 (2 × 3 = 6, 6 × 3 = 18, 18 × 3 = 54). What is 54 × 3?'
    },
    {
      display: '10 — 25 — 40 — 55 — ?',
      instruction: 'Calculate the next capacitor reading.',
      answer: '70',
      hint: 'Each step increases by a constant 15 (10 + 15 = 25, 25 + 15 = 40, 40 + 15 = 55). What is 55 + 15?'
    },
    {
      display: '80 — 72 — 64 — 56 — ?',
      instruction: 'Determine the next declining threshold.',
      answer: '48',
      hint: 'The sequence decreases by 8 each step (80 - 8 = 72, 72 - 8 = 64, 64 - 8 = 56). What is 56 - 8?'
    },
    {
      display: '1 — 4 — 9 — 16 — 25 — ?',
      instruction: 'Calculate the next square in the harmonic series.',
      answer: '36',
      hint: 'Look at square numbers (1×1=1, 2×2=4, 3×3=9, 4×4=16, 5×5=25). What is 6×6?'
    },
    {
      display: '100 — 90 — 80 — 70 — ?',
      instruction: 'Find the next countdown value.',
      answer: '60',
      hint: 'Each step decreases by 10 (100 - 10 = 90, 90 - 10 = 80, 80 - 10 = 70). What is 70 - 10?'
    }
  ];

  const PUZZLES_SERVER = [
    {
      clue: 'The scientist’s code name lies within the double helix. Search the structure that carries the blueprint of life.',
      instruction: 'Find the word associated with this clue to decrypt the research archive.',
      answer: ['helix', 'dna', 'double helix'],
      hint: 'Think about molecular biology and DNA. What geometric shape is the famous double structure of life?'
    },
    {
      clue: 'The core power system is named after the fundamental unit of light and electromagnetic radiation. Spell this quantum particle.',
      instruction: 'Identify the light particle to unlock the archive.',
      answer: ['photon', 'photons'],
      hint: 'In physics, light is composed of discrete wave-particles called photons.'
    },
    {
      clue: 'The facility firewall requires the name of the process by which atomic nuclei combine to power the sun and clean energy.',
      instruction: 'Enter the nuclear process to decrypt the files.',
      answer: ['fusion', 'nuclear fusion'],
      hint: 'The atomic process where light atomic nuclei join together to form a heavier nucleus is nuclear fusion.'
    },
    {
      clue: 'The security protocol asks for the elementary particle carrying negative electrical charge that flows through all circuits.',
      instruction: 'Identify the subatomic particle.',
      answer: ['electron', 'electrons'],
      hint: 'The negative charge carrier orbiting atomic nuclei is the electron.'
    },
    {
      clue: 'The research data is sealed behind the scientific term for the capacity or ability to do work.',
      instruction: 'Enter the fundamental scientific term.',
      answer: ['energy'],
      hint: 'In physics, the capacity or ability to do work is called energy.'
    },
    {
      clue: 'The server asks for the fundamental element with atomic number 1, the most abundant clean fuel in the universe.',
      instruction: 'Identify the first element on the periodic table.',
      answer: ['hydrogen'],
      hint: 'The first chemical element on the periodic table with chemical symbol H is hydrogen.'
    },
    {
      clue: 'An encrypted lab note reads: Unscramble the letters to reveal the primary power grid source: L S O A R.',
      instruction: 'Unscramble the 5 letters to recover the keyword.',
      answer: ['solar'],
      hint: 'Unscramble L-S-O-A-R to name power harnessed from our sun (SOLAR).'
    },
    {
      clue: 'The encrypted token is the word that means a state of balance between opposing physical forces or temperatures.',
      instruction: 'Enter the scientific term for balanced stability.',
      answer: ['equilibrium'],
      hint: 'A condition in science where opposing influences or forces are balanced is equilibrium.'
    },
    {
      clue: 'The server prompt asks for the name of the subatomic particle found in an atomic nucleus that has zero electrical charge.',
      instruction: 'Enter the neutral nuclear particle.',
      answer: ['neutron'],
      hint: 'The subatomic particle in an atomic nucleus with zero net electrical charge is the neutron.'
    },
    {
      clue: 'An encrypted cipher text reads: Shift each letter backward by 1 in the alphabet (D->C) to recover the word: D M F B O.',
      instruction: 'Decode the 5-letter word by shifting each letter backward by 1 in the alphabet.',
      answer: ['clean'],
      hint: 'D minus 1 is C, M minus 1 is L, F minus 1 is E, B minus 1 is A, O minus 1 is N (CLEAN).'
    },
    {
      clue: 'The lab security passphrase is the electrical component designed to store electric charge between two conductors.',
      instruction: 'Identify the charge-storing component.',
      answer: ['capacitor'],
      hint: 'The electronic component that stores electrostatic energy in an electric field is a capacitor.'
    },
    {
      clue: 'An encrypted lab note reads: Unscramble the letters to reveal the power equipment: A E T C O R R.',
      instruction: 'Unscramble the 7 letters to decrypt the file.',
      answer: ['reactor'],
      hint: 'Unscramble A-E-T-C-O-R-R to spell the apparatus housing the energy core (REACTOR).'
    }
  ];

  const PUZZLES_CONSOLE = [
    {
      clue: 'Three letters unlock the final sequence. Take the first letter of System, the last letter of Access, and the first letter of Security.',
      instruction: 'Combine the letters in the stated order to unlock the facility.',
      answer: ['sis'],
      hint: 'Assemble the letters in order: First of [S]ystem + Last of Acces[s] + First of [S]ecurity (SIS).'
    },
    {
      clue: 'Combine three letters in order: First letter of Quantum, first letter of User, and first letter of Access.',
      instruction: 'Combine the three letters to bypass the lock.',
      answer: ['qua'],
      hint: 'Assemble in order: First of [Q]uantum + First of [U]ser + First of [A]ccess (QUA).'
    },
    {
      clue: 'Assemble the three letters: First letter of Protocol, last letter of Gateway, and first letter of Network.',
      instruction: 'Combine the letters in sequence.',
      answer: ['pyn'],
      hint: 'Assemble in order: First of [P]rotocol + Last of Gatewa[y] + First of [N]etwork (PYN).'
    },
    {
      clue: 'Find the 3-letter code: First letter of Terminal, first letter of Energy, and last letter of Root.',
      instruction: 'Combine the letters in the specified order.',
      answer: ['tet'],
      hint: 'Assemble in order: First of [T]erminal + First of [E]nergy + Last of Roo[t] (TET).'
    },
    {
      clue: 'Identify the 3-letter sequence: First letter of Laser, first letter of Optical, and first letter of Grid.',
      instruction: 'Enter the 3-letter keyword.',
      answer: ['log'],
      hint: 'Assemble in order: First of [L]aser + First of [O]ptical + First of [G]grid (LOG).'
    },
    {
      clue: 'Combine three letters: Last letter of Data, first letter of Code, and last letter of Node.',
      instruction: 'Combine the three letters to unlock the console.',
      answer: ['ace'],
      hint: 'Assemble in order: Last of Dat[a] + First of [C]ode + Last of Nod[e] (ACE).'
    },
    {
      clue: 'The lock asks for the next letter in the alphabetic skip pattern: B — D — F — H — ?',
      instruction: 'Determine the next letter in the pattern.',
      answer: ['j'],
      hint: 'Letters skip by 2: B(+2)=D, D(+2)=F, F(+2)=H. The letter 2 positions after H in the alphabet is J.'
    },
    {
      clue: 'Enter the 3-letter code: First letter of Reboot, first letter of Unlock, and first letter of Node.',
      instruction: 'Combine the letters in order.',
      answer: ['run'],
      hint: 'Assemble in order: First of [R]eboot + First of [U]nlock + First of [N]ode (RUN).'
    },
    {
      clue: 'Assemble the code: First letter of Key, first letter of Ion, and last letter of Port.',
      instruction: 'Combine the letters to complete the sequence.',
      answer: ['kit'],
      hint: 'Assemble in order: First of [K]ey + First of [I]on + Last of Por[t] (KIT).'
    },
    {
      clue: 'The console logic sequence displays: M — O — Q — S — ? What is the next letter in this sequence?',
      instruction: 'Enter the single letter that continues the pattern.',
      answer: ['u'],
      hint: 'Skipping one letter in the alphabet: M, (N), O, (P), Q, (R), S, (T), ?. The next letter is U.'
    },
    {
      clue: 'Combine three letters: First letter of Binary, last letter of Data, and first letter of Sensor.',
      instruction: 'Combine the letters in order to clear the lock.',
      answer: ['bas'],
      hint: 'Assemble in order: First of [B]inary + Last of Dat[a] + First of [S]ensor (BAS).'
    },
    {
      clue: 'Assemble the 3-letter code: First letter of Cyber, first letter of Override, and last letter of Port.',
      instruction: 'Combine the letters in order.',
      answer: ['cot'],
      hint: 'Assemble in order: First of [C]yber + First of [O]verride + Last of Por[t] (COT).'
    }
  ];

  const ALL_PUZZLES_REACTOR = [
    ...PUZZLE_BANK_REACTOR,
    ...PUZZLES_REACTOR
  ];

  const ALL_PUZZLES_SERVER = [
    ...PUZZLE_BANK_SERVER,
    ...PUZZLES_SERVER
  ];

  const ALL_PUZZLES_CONSOLE = [
    ...PUZZLE_BANK_CONSOLE,
    ...PUZZLES_CONSOLE
  ];

  function generateNewPuzzles() {
    state.activePuzzles.reactor = selectThreePuzzles(ALL_PUZZLES_REACTOR);
    state.activePuzzles.server  = selectThreePuzzles(ALL_PUZZLES_SERVER);
    state.activePuzzles.console = selectThreePuzzles(ALL_PUZZLES_CONSOLE);
  }

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
  const elements = {};

  function initElements() {
    elements.mainMenu = document.getElementById('mainMenu');
    elements.gameInterface = document.getElementById('gameInterface');
    elements.victoryModal = document.getElementById('victoryModal');
    elements.initSystemBtn = document.getElementById('initSystemBtn');
    elements.restartMissionBtn = document.getElementById('restartMissionBtn');
    elements.soundToggle = document.getElementById('soundToggle');
    elements.soundIcon = document.getElementById('soundIcon');
    elements.clearTermBtn = document.getElementById('clearTermBtn');
    elements.progressPercent = document.getElementById('progressPercent');
    elements.missionProgressBar = document.getElementById('missionProgressBar');
    elements.lockdownStatusBadge = document.getElementById('lockdownStatusBadge');
    elements.stationReactor = document.getElementById('stationReactor');
    elements.stationServer = document.getElementById('stationServer');
    elements.stationConsole = document.getElementById('stationConsole');
    elements.dotReactor = document.getElementById('dotReactor');
    elements.dotServer = document.getElementById('dotServer');
    elements.dotConsole = document.getElementById('dotConsole');
    elements.labelReactor = document.getElementById('labelReactor');
    elements.labelServer = document.getElementById('labelServer');
    elements.labelConsole = document.getElementById('labelConsole');
    elements.puzzleCountBadge = document.getElementById('puzzleCountBadge');
    elements.metricLockdown = document.getElementById('metricLockdown');
    elements.metricLockdownSub = document.getElementById('metricLockdownSub');
    elements.metricLockdownLed = document.getElementById('metricLockdownLed');
    elements.metricData = document.getElementById('metricData');
    elements.metricDataSub = document.getElementById('metricDataSub');
    elements.metricDataLed = document.getElementById('metricDataLed');
    elements.metricReactor = document.getElementById('metricReactor');
    elements.metricReactorSub = document.getElementById('metricReactorSub');
    elements.metricReactorLed = document.getElementById('metricReactorLed');
    elements.metricAnomaly = document.getElementById('metricAnomaly');
    elements.metricAnomalySub = document.getElementById('metricAnomalySub');
    elements.metricAnomalyLed = document.getElementById('metricAnomalyLed');
    elements.terminalOutput = document.getElementById('terminalOutput');
    elements.terminalForm = document.getElementById('terminalForm');
    elements.commandInput = document.getElementById('commandInput');
  }

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

    // Generate a fresh random puzzle set for this mission
    generateNewPuzzles();
    updateOverallProgress();

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
    appendTerminalLine('     ANOMALY OPERATING SYSTEM // LAB TERMINAL           ', 'sys');
    appendTerminalLine('=========================================================', 'sys');
    appendTerminalLine('ALERT: Security network breached by unknown intruder.', 'error');
    appendTerminalLine('Facility lockdown ACTIVE. Lab doors locked.', 'error');
    appendTerminalLine('Clean-energy research files encrypted.', 'error');
    appendTerminalLine('Energy reactor prototype offline.', 'error');
    appendTerminalLine('---------------------------------------------------------', 'sys');
    appendTerminalLine('Click a device to inspect it, or type "scan" to find anomalies.', 'info');
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
    try {
      executeCommand(sanitized);
    } catch (err) {
      console.error('Command execution error:', err);
      appendTerminalLine('SYSTEM ERROR: An error occurred while executing command.', 'error');
    }
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
          const rawAnswer = commandStr.trim().replace(/^solve\s+[^\s]+/i, '').trim();
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
    appendTerminalLine('----- COMMAND DIRECTORY -----', 'sys');
    appendTerminalLine('scan                     : Scan laboratory sensors for anomalies & clues', 'info');
    appendTerminalLine('inspect reactor          : Examine the Energy Reactor puzzle', 'info');
    appendTerminalLine('inspect server           : Examine the Research Server clue', 'info');
    appendTerminalLine('inspect console          : Examine the Control Console puzzle', 'info');
    appendTerminalLine('solve reactor [answer]   : Submit answer to activate reactor', 'info');
    appendTerminalLine('solve server [answer]    : Submit passphrase to unlock research files', 'info');
    appendTerminalLine('solve console [answer]   : Submit code to unlock lockdown', 'info');
    appendTerminalLine('status                   : Display mission progress and lab status', 'info');
    appendTerminalLine('clear                    : Clear terminal screen', 'info');
    appendTerminalLine('help                     : Display this command guide', 'info');
    appendTerminalLine('-----------------------------', 'sys');
  }

  function cmdScan() {
    soundScan();
    state.scanned = true;

    // Update status panel if elements exist
    if (elements.metricAnomaly) {
      elements.metricAnomaly.textContent = '3 ANOMALIES FOUND';
      elements.metricAnomaly.className = 'status-card-value danger';
    }

    appendTerminalLine('[SCANNING LAB...] Sensor sweep in progress...', 'sys');

    setTimeout(() => {
      appendTerminalLine('>> SENSOR SWEEP COMPLETE: 3 System Anomalies detected', 'scan');
      appendTerminalLine(' • [ENERGY REACTOR] : Core desynchronized. Sequence loop detected.', 'scan');
      appendTerminalLine(' • [RESEARCH SERVER]: Security cipher locked around research files.', 'scan');
      appendTerminalLine(' • [CONTROL CONSOLE]: Override terminal locked behind security code.', 'scan');
      appendTerminalLine('Click any device or type "inspect [reactor | server | console]".', 'hint');
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
      case 'reactor': {
        state.inspected.reactor = true;
        appendTerminalLine('=== INSPECTING ENERGY REACTOR ===', 'sys');
        const puz = getCurrentPuzzle('reactor');
        if (!puz) {
          appendTerminalLine('>> STATUS: SOLVED. Energy Reactor is online.', 'success');
        } else {
          const done = deviceSolvedCount('reactor');
          appendTerminalLine(`[Problem ${done + 1}/3] The clean-energy prototype is trapped in an unstable power sequence loop:`, 'info');
          appendTerminalLine(`    ${puz.display || puz.clue}`, 'hint');
          appendTerminalLine(puz.instruction, 'info');
          appendTerminalLine('Command: solve reactor [answer]', 'hint');
        }
        break;
      }

      case 'server': {
        state.inspected.server = true;
        appendTerminalLine('=== INSPECTING RESEARCH SERVER ===', 'sys');
        const puz = getCurrentPuzzle('server');
        if (!puz) {
          appendTerminalLine('>> STATUS: SOLVED. Research files restored.', 'success');
        } else {
          const done = deviceSolvedCount('server');
          appendTerminalLine(`[Problem ${done + 1}/3] The server files are locked. A clue left by the intruder reads:`, 'info');
          appendTerminalLine(`“${puz.clue || puz.display}”`, 'hint');
          appendTerminalLine(puz.instruction, 'info');
          appendTerminalLine('Command: solve server [answer]', 'hint');
        }
        break;
      }

      case 'console': {
        state.inspected.console = true;
        appendTerminalLine('=== INSPECTING CONTROL CONSOLE ===', 'sys');
        const puz = getCurrentPuzzle('console');
        if (!puz) {
          appendTerminalLine('>> STATUS: SOLVED. Lockdown unlocked.', 'success');
        } else {
          const done = deviceSolvedCount('console');
          appendTerminalLine(`[Problem ${done + 1}/3] The lockdown override interface displays a security puzzle:`, 'info');
          appendTerminalLine(`“${puz.clue || puz.display}”`, 'hint');
          appendTerminalLine(puz.instruction, 'info');
          appendTerminalLine('Command: solve console [answer]', 'hint');
        }
        break;
      }

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
    if (state.solved[target] || !getCurrentPuzzle(target)) {
      appendTerminalLine(`NOTICE: The ${target} puzzle has already been resolved and verified.`, 'info');
      return;
    }

    // Dispatch target validation
    if (target === 'reactor') {
      solveReactor(rawAnswer);
    } else if (target === 'server') {
      solveServer(rawAnswer);
    } else if (target === 'console') {
      solveConsole(rawAnswer);
    }
  }

  /* --------------------------------------------------------------------------
     8. PUZZLE SOLVERS (shared pattern — one unsolved problem at a time per device)
     -------------------------------------------------------------------------- */
  function normalizeAnswer(str) {
    if (typeof str !== 'string') str = String(str ?? '');
    return str.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function validateAnswer(expected, userAns) {
    const normUser = normalizeAnswer(userAns);
    if (!normUser) return false;
    const answers = Array.isArray(expected) ? expected : [expected];
    return answers.some(ans => normalizeAnswer(ans) === normUser);
  }

  function solveReactor(rawAnswer) {
    const puz = getCurrentPuzzle('reactor');
    if (!puz) {
      appendTerminalLine('NOTICE: The reactor puzzle has already been resolved and verified.', 'info');
      return;
    }
    const isCorrect = validateAnswer(puz.answer, rawAnswer);

    if (isCorrect) {
      puz.solved = true;
      soundSuccess();
      const done = deviceSolvedCount('reactor');
      appendTerminalLine(`CALCULATION VERIFIED: Correct answer accepted. (${done}/3 reactor problems solved)`, 'success');
      if (done === 3) {
        appendTerminalLine('Zero-point flux field stabilizing... Reactor output: 12.8 GW [OPTIMAL].', 'success');
        markStationSolved('reactor');
      } else {
        const nextPuz = getCurrentPuzzle('reactor');
        if (nextPuz) {
          appendTerminalLine(`--- NEXT REACTOR PROBLEM (${done + 1}/3) ---`, 'sys');
          appendTerminalLine(`    ${nextPuz.display || nextPuz.clue}`, 'hint');
          appendTerminalLine(nextPuz.instruction, 'info');
          appendTerminalLine('Command: solve reactor [answer]', 'hint');
        }
      }
      updateOverallProgress();
    } else {
      soundError();
      appendTerminalLine(`DIAGNOSTIC FAILURE: "${rawAnswer.trim()}" is incorrect. Reactor resonance unstable.`, 'error');
      appendTerminalLine(`HINT: ${puz.hint}`, 'hint');
    }
  }

  function solveServer(rawAnswer) {
    const puz = getCurrentPuzzle('server');
    if (!puz) {
      appendTerminalLine('NOTICE: The server puzzle has already been resolved and verified.', 'info');
      return;
    }
    const isCorrect = validateAnswer(puz.answer, rawAnswer);

    if (isCorrect) {
      puz.solved = true;
      soundSuccess();
      const done = deviceSolvedCount('server');
      appendTerminalLine(`DECRYPTION SUCCESSFUL: Keyphrase "${rawAnswer.trim().toUpperCase()}" accepted. (${done}/3 server problems solved)`, 'success');
      if (done === 3) {
        appendTerminalLine('Research files decrypted: clean-energy data restored.', 'success');
        markStationSolved('server');
      } else {
        const nextPuz = getCurrentPuzzle('server');
        if (nextPuz) {
          appendTerminalLine(`--- NEXT SERVER PROBLEM (${done + 1}/3) ---`, 'sys');
          appendTerminalLine(`“${nextPuz.clue || nextPuz.display}”`, 'hint');
          appendTerminalLine(nextPuz.instruction, 'info');
          appendTerminalLine('Command: solve server [answer]', 'hint');
        }
      }
      updateOverallProgress();
    } else {
      soundError();
      appendTerminalLine(`DECRYPTION FAILED: "${rawAnswer.trim()}" rejected by cryptographic cipher.`, 'error');
      appendTerminalLine(`HINT: ${puz.hint}`, 'hint');
    }
  }

  function solveConsole(rawAnswer) {
    const puz = getCurrentPuzzle('console');
    if (!puz) {
      appendTerminalLine('NOTICE: The console puzzle has already been resolved and verified.', 'info');
      return;
    }
    const isCorrect = validateAnswer(puz.answer, rawAnswer);

    if (isCorrect) {
      puz.solved = true;
      soundSuccess();
      const done = deviceSolvedCount('console');
      appendTerminalLine(`SECURITY OVERRIDE ACCEPTED: Code "${rawAnswer.trim().toUpperCase()}" verified. (${done}/3 console problems solved)`, 'success');
      if (done === 3) {
        appendTerminalLine('Facility lockdown unlocked. Blast doors unsealed.', 'success');
        markStationSolved('console');
      } else {
        const nextPuz = getCurrentPuzzle('console');
        if (nextPuz) {
          appendTerminalLine(`--- NEXT CONSOLE PROBLEM (${done + 1}/3) ---`, 'sys');
          appendTerminalLine(`“${nextPuz.clue || nextPuz.display}”`, 'hint');
          appendTerminalLine(nextPuz.instruction, 'info');
          appendTerminalLine('Command: solve console [answer]', 'hint');
        }
      }
      updateOverallProgress();
    } else {
      soundError();
      appendTerminalLine(`AUTHORIZATION REJECTED: Code "${rawAnswer.trim().toUpperCase()}" invalid.`, 'error');
      appendTerminalLine(`HINT: ${puz.hint}`, 'hint');
    }
  }

  /* --------------------------------------------------------------------------
     11. MISSION STATUS CHECK
     -------------------------------------------------------------------------- */
  function cmdStatus() {
    const rDone = deviceSolvedCount('reactor');
    const sDone = deviceSolvedCount('server');
    const cDone = deviceSolvedCount('console');
    const total = rDone + sDone + cDone;
    appendTerminalLine('=== MISSION STATUS ===', 'sys');
    appendTerminalLine(`Problems Solved: ${total}/9`, 'info');
    appendTerminalLine(` • Energy Reactor : ${rDone}/3 problems solved`, rDone === 3 ? 'success' : 'error');
    appendTerminalLine(` • Research Server: ${sDone}/3 problems solved`, sDone === 3 ? 'success' : 'error');
    appendTerminalLine(` • Control Console: ${cDone}/3 problems solved`, cDone === 3 ? 'success' : 'error');
    appendTerminalLine(`Sensor Sweep Active: ${state.scanned ? 'YES' : 'NO (Type "scan")'}`, 'info');
    appendTerminalLine('======================', 'sys');
  }

  function cmdUnknown(cmd) {
    soundError();
    appendTerminalLine(`command not found: "${cmd}". Type "help" for a list of valid commands.`, 'error');
  }

  /* --------------------------------------------------------------------------
     12. PROGRESS TRACKING & VICTORY SEQUENCE
     -------------------------------------------------------------------------- */
  function updateOverallProgress() {
    const solvedCount = deviceSolvedCount('reactor') + deviceSolvedCount('server') + deviceSolvedCount('console');
    const percent = Math.round((solvedCount / 9) * 100);

    // Top progress bar
    if (elements.progressPercent) elements.progressPercent.textContent = `${solvedCount}/9 (${percent}%)`;
    if (elements.missionProgressBar) elements.missionProgressBar.style.width = `${percent}%`;
    if (elements.puzzleCountBadge) elements.puzzleCountBadge.textContent = `PROBLEMS: ${solvedCount}/9`;

    if (solvedCount === 9 && !state.victoryTriggered) {
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

    // Generate fresh puzzles for the new mission
    generateNewPuzzles();

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
    elements.labelReactor.textContent = 'OFFLINE // LOCKED';
    elements.labelReactor.classList.remove('solved-text');

    elements.stationServer.classList.remove('solved');
    elements.stationServer.setAttribute('aria-label', 'Research Server: Unsolved');
    elements.dotServer.className = 'station-status-dot unsolved';
    elements.dotServer.title = 'Status: Unsolved';
    elements.labelServer.textContent = 'FILES ENCRYPTED';
    elements.labelServer.classList.remove('solved-text');

    elements.stationConsole.classList.remove('solved');
    elements.stationConsole.setAttribute('aria-label', 'Control Console: Unsolved');
    elements.dotConsole.className = 'station-status-dot unsolved';
    elements.dotConsole.title = 'Status: Unsolved';
    elements.labelConsole.textContent = 'LOCKDOWN ACTIVE';
    elements.labelConsole.classList.remove('solved-text');

    // Reset Topbar & Metrics
    if (elements.lockdownStatusBadge) {
      elements.lockdownStatusBadge.textContent = 'LOCKDOWN: ACTIVE';
      elements.lockdownStatusBadge.className = 'status-pill status-pill-danger';
    }

    if (elements.metricLockdown) {
      elements.metricLockdown.textContent = 'SEALED';
      elements.metricLockdown.className = 'status-card-value danger';
    }
    if (elements.metricData) {
      elements.metricData.textContent = 'ENCRYPTED';
      elements.metricData.className = 'status-card-value danger';
    }
    if (elements.metricReactor) {
      elements.metricReactor.textContent = 'OFFLINE';
      elements.metricReactor.className = 'status-card-value danger';
    }

    if (elements.puzzleCountBadge) elements.puzzleCountBadge.textContent = 'PROBLEMS: 0/9';
    if (elements.progressPercent) elements.progressPercent.textContent = '0/9 (0%)';
    if (elements.missionProgressBar) elements.missionProgressBar.style.width = '0%';

    // Hide victory modal
    elements.victoryModal.setAttribute('hidden', '');

    // Reset game started state and return to intro screen
    state.gameStarted = false;
    elements.gameInterface.classList.remove('active');
    elements.mainMenu.classList.add('active');

    // Reset terminal
    printBootSequence();

    // Focus intro button
    elements.initSystemBtn.focus();
  }

  /* --------------------------------------------------------------------------
     14. EVENT LISTENERS & SHORTCUTS
     -------------------------------------------------------------------------- */
  function setupEventListeners() {
    initElements();

    // Menu Start Button
    if (elements.initSystemBtn) {
      elements.initSystemBtn.addEventListener('click', initGame);
    }

    // Restart Button
    if (elements.restartMissionBtn) {
      elements.restartMissionBtn.addEventListener('click', restartMission);
    }

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

        // Highlight selected station visually
        stations.forEach((s) => { if (s) s.classList.remove('selected-station'); });
        station.classList.add('selected-station');

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
