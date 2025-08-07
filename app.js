import Essentia from "https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.es.js";
import { EssentiaWASM } from "https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.es.js";

const essentia = new Essentia(EssentiaWASM);

class CamelotAnalyzer {
  constructor() {
    this.songs = [];
    this.audioContext = null;
    this.camelotWheel = this.initializeCamelotWheel();
    this.compatibilityRules = this.initializeCompatibilityRules();
    this.init();
  }

  initializeCamelotWheel() {
    // Camelot wheel positions with their musical key equivalents
    return {
      "1A": "Ab minor",
      "1B": "B major",
      "2A": "Eb minor",
      "2B": "Gb major",
      "3A": "Bb minor",
      "3B": "Db major",
      "4A": "F minor",
      "4B": "Ab major",
      "5A": "C minor",
      "5B": "Eb major",
      "6A": "G minor",
      "6B": "Bb major",
      "7A": "D minor",
      "7B": "F major",
      "8A": "A minor",
      "8B": "C major",
      "9A": "E minor",
      "9B": "G major",
      "10A": "B minor",
      "10B": "D major",
      "11A": "Gb minor",
      "11B": "A major",
      "12A": "Db minor",
      "12B": "E major",
    };
  }

  initializeCompatibilityRules() {
    return {
      perfect: (from, to) => {
        return (
          from === to ||
          (from.slice(0, -1) === to.slice(0, -1) && from !== to) || // Same number, different letter
          (Math.abs(parseInt(from) - parseInt(to)) === 1 &&
            from.slice(-1) === to.slice(-1))
        ); // Adjacent numbers, same letter
      },
      energyBoost: (from, to) => {
        const fromNum = parseInt(from);
        const toNum = parseInt(to);
        return toNum === (fromNum % 12) + 1 && from.slice(-1) === to.slice(-1);
      },
      energyDrop: (from, to) => {
        const fromNum = parseInt(from);
        const toNum = parseInt(to);
        return (
          toNum === (fromNum === 1 ? 12 : fromNum - 1) &&
          from.slice(-1) === to.slice(-1)
        );
      },
      moodChange: (from, to) => {
        return (
          from.slice(0, -1) === to.slice(0, -1) &&
          from.slice(-1) !== to.slice(-1)
        );
      },
    };
  }

  async init() {
    this.setupEventListeners();
    this.renderCamelotWheel();
    await this.initializeAudioContext();
  }

  async initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
    }
  }

  setupEventListeners() {
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("fileInput");
    const createMixBtn = document.getElementById("createMixBtn");
    const exportBtn = document.getElementById("exportBtn");
    const exportJsonBtn = document.getElementById("exportJsonBtn");
    const resetBtn = document.getElementById("resetBtn");
    const fileUploadTab = document.getElementById("fileUploadTab");
    const manualEntryTab = document.getElementById("manualEntryTab");
    const importTab = document.getElementById("importTab");
    const manualSongForm = document.getElementById("manualSongForm");
    const exportSongsBtn = document.getElementById("exportSongsBtn");
    const importZone = document.getElementById("importZone");
    const importInput = document.getElementById("importInput");
    const autoMixToggle = document.getElementById("autoMixToggle");

    // Auto mix toggle event
    autoMixToggle.addEventListener(
      "change",
      this.handleAutoMixToggle.bind(this)
    );

    // Tab switching
    fileUploadTab.addEventListener("click", () => this.switchTab("file"));
    manualEntryTab.addEventListener("click", () => this.switchTab("manual"));
    importTab.addEventListener("click", () => this.switchTab("import"));

    // Manual form submission
    manualSongForm.addEventListener(
      "submit",
      this.handleManualSongSubmit.bind(this)
    );

    // Export songs functionality
    exportSongsBtn.addEventListener("click", this.exportSongs.bind(this));

    // Import functionality
    importZone.addEventListener("click", () => importInput.click());
    importZone.addEventListener(
      "dragover",
      this.handleImportDragOver.bind(this)
    );
    importZone.addEventListener(
      "dragleave",
      this.handleImportDragLeave.bind(this)
    );
    importZone.addEventListener("drop", this.handleImportDrop.bind(this));
    importInput.addEventListener("change", (e) =>
      this.handleImportFile(e.target.files[0])
    );

    // Drag and drop events
    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", this.handleDragOver.bind(this));
    dropZone.addEventListener("dragleave", this.handleDragLeave.bind(this));
    dropZone.addEventListener("drop", this.handleDrop.bind(this));

    fileInput.addEventListener("change", (e) =>
      this.handleFiles(e.target.files)
    );
    createMixBtn.addEventListener("click", this.createOptimalMix.bind(this));
    exportBtn.addEventListener("click", this.exportMix.bind(this));
    exportJsonBtn.addEventListener("click", this.exportMixJSON.bind(this));
    resetBtn.addEventListener("click", this.reset.bind(this));
  }

  handleAutoMixToggle(e) {
    const isEnabled = e.target.checked;
    if (isEnabled && this.songs.length >= 2) {
      this.performAutoMix();
    }
  }

  performAutoMix() {
    // Create optimal mix
    const mixSequence = this.generateMixSequence();
    this.displayMixSequence(mixSequence);

    // Show mix section
    document.getElementById("mixSection").style.display = "block";

    // Auto export JSON
    this.exportMixJSON();

    this.showStatus("Auto mix created and exported!", "success");
  }

  switchTab(tab) {
    const fileTab = document.getElementById("fileUploadTab");
    const manualTab = document.getElementById("manualEntryTab");
    const importTab = document.getElementById("importTab");
    const fileContent = document.getElementById("fileUploadContent");
    const manualContent = document.getElementById("manualEntryContent");
    const importContent = document.getElementById("importContent");

    // Remove active class from all tabs and contents
    [fileTab, manualTab, importTab].forEach((t) =>
      t.classList.remove("active")
    );
    [fileContent, manualContent, importContent].forEach((c) =>
      c.classList.remove("active")
    );

    // Add active class to selected tab and content
    if (tab === "file") {
      fileTab.classList.add("active");
      fileContent.classList.add("active");
    } else if (tab === "manual") {
      manualTab.classList.add("active");
      manualContent.classList.add("active");
    } else if (tab === "import") {
      importTab.classList.add("active");
      importContent.classList.add("active");
    }
  }

  handleImportDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add("dragover");
  }

  handleImportDragLeave(e) {
    e.currentTarget.classList.remove("dragover");
  }

  handleImportDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/json") {
      this.handleImportFile(file);
    } else {
      this.showStatus("Please select a valid JSON file.", "error");
    }
  }

  async handleImportFile(file) {
    if (!file || file.type !== "application/json") {
      this.showStatus("Please select a valid JSON file.", "error");
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.songs || !Array.isArray(data.songs)) {
        throw new Error("Invalid song list format");
      }

      // Validate each song has required fields
      const validSongs = data.songs.filter(
        (song) => song.name && song.camelotKey && song.bpm && song.key
      );

      if (validSongs.length === 0) {
        throw new Error("No valid songs found in the file");
      }

      // Add imported songs to the existing list
      this.songs.push(...validSongs);
      this.updateUI();

      this.showStatus(
        `Successfully imported ${validSongs.length} songs!`,
        "success"
      );
      document.getElementById("importInput").value = "";

      // Check if auto mix is enabled and we have enough songs
      const autoMixToggle = document.getElementById("autoMixToggle");
      if (autoMixToggle.checked && this.songs.length >= 2) {
        setTimeout(() => this.performAutoMix(), 500);
      }
    } catch (error) {
      console.error("Import error:", error);
      this.showStatus(
        "Failed to import song list. Please check the file format.",
        "error"
      );
    }
  }

  handleManualSongSubmit(e) {
    e.preventDefault();

    const title = document.getElementById("songTitle").value.trim();
    const artist = document.getElementById("songArtist").value.trim();
    const camelotKey = document.getElementById("songKey").value;
    const bpm = parseInt(document.getElementById("songBpm").value);

    if (!title || !artist || !camelotKey || !bpm) {
      this.showStatus("Please fill in all fields.", "error");
      return;
    }

    const song = {
      name: `${artist} - ${title}`,
      file: null, // No file for manual entries
      bpm: bpm,
      key: this.camelotWheel[camelotKey],
      camelotKey: camelotKey,
      energy: 0.5, // Default energy level for manual entries
      duration: 0, // Unknown duration for manual entries
      isManual: true,
    };

    this.songs.push(song);
    this.updateUI();
    this.showStatus(`Added "${song.name}" successfully!`, "success");

    // Reset form
    document.getElementById("manualSongForm").reset();

    // Check if auto mix is enabled and we have enough songs
    const autoMixToggle = document.getElementById("autoMixToggle");
    if (autoMixToggle.checked && this.songs.length >= 2) {
      setTimeout(() => this.performAutoMix(), 500);
    }
  }

  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add("dragover");
  }

  handleDragLeave(e) {
    e.currentTarget.classList.remove("dragover");
  }

  handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove("dragover");
    this.handleFiles(e.dataTransfer.files);
  }

  // Displays a spinner while audio is being analysed
  setLoading(bool) {
    const loader = document.getElementById('loader');
    const uploadIcon = document.getElementById("upload-icon");
    if (bool) {
      loader.style.display = 'block';
      uploadIcon.style.display = 'none';
    } else {
      loader.style.display = 'none';
      uploadIcon.style.display = 'block';
    }
  }

  async handleFiles(files) {
    const audioFiles = Array.from(files).filter((file) =>
      file.type.startsWith("audio/")
    );

    if (audioFiles.length === 0) {
      this.showStatus("Please select audio files only.", "error");
      return;
    }

    this.showStatus(`Analyzing ${audioFiles.length} songs...`, "processing");
    this.setLoading(true);

    for (let i = 0; i < audioFiles.length; i++) {
      try {
        await this.analyzeSong(audioFiles[i], i + 1, audioFiles.length);
      } catch (error) {
        console.error(`Error analyzing ${audioFiles[i].name}:`, error);
      }
    }

    this.showStatus(
      `Analysis complete! ${this.songs.length} songs ready for mixing.`,
      "success"
    );
    this.setLoading(false);

    this.updateUI();

    // Check if auto mix is enabled and we have enough songs
    const autoMixToggle = document.getElementById("autoMixToggle");
    if (autoMixToggle.checked && this.songs.length >= 2) {
      setTimeout(() => this.performAutoMix(), 500);
    }
  }

  async analyzeSong(file, current, total) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          if (!this.audioContext) {
            await this.initializeAudioContext();
          }

          const arrayBuffer = e.target.result;
          const audioBuffer = await this.audioContext.decodeAudioData(
            arrayBuffer
          );

          // Analyze audio features
          const analysis = this.performAudioAnalysis(audioBuffer);

          const song = {
            name: file.name.replace(/\.[^/.]+$/, ""),
            file: file,
            bpm: analysis.bpm,
            key: analysis.key,
            camelotKey: analysis.camelotKey,
            energy: analysis.energy,
            duration: audioBuffer.duration,
          };

          this.songs.push(song);
          this.showStatus(
            `Analyzing... ${current}/${total} - ${song.name}`,
            "processing"
          );
          resolve(song);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // Preperate audio
  preprocess(audioBuffer) {
    if (audioBuffer instanceof AudioBuffer) {
      const mono = this.monomix(audioBuffer);
      return this.downsampleArray(mono, audioBuffer.sampleRate, 16000);
    } else {
      throw new TypeError(
        "Input to audio preprocessing is not of type AudioBuffer"
      );
    }
  }

  // Downmix to mono for analysis
  monomix(buffer) {
    let monoAudio;
    if (buffer.numberOfChannels > 1) {
      console.log("mixing down to mono...");
      const leftCh = buffer.getChannelData(0);
      const rightCh = buffer.getChannelData(1);
      monoAudio = leftCh.map((sample, i) => 0.5 * (sample + rightCh[i]));
    } else {
      monoAudio = buffer.getChannelData(0);
    }

    return monoAudio;
  }

  // Downsample for analysis
  downsampleArray(audioIn, sampleRateIn, sampleRateOut) {
    if (sampleRateOut === sampleRateIn) {
      return audioIn;
    }
    let sampleRateRatio = sampleRateIn / sampleRateOut;
    let newLength = Math.round(audioIn.length / sampleRateRatio);
    let result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetAudioIn = 0;

    console.log(`Downsampling to ${sampleRateOut} kHz...`);
    while (offsetResult < result.length) {
      let nextOffsetAudioIn = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0,
        count = 0;
      for (
        let i = offsetAudioIn;
        i < nextOffsetAudioIn && i < audioIn.length;
        i++
      ) {
        accum += audioIn[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetAudioIn = nextOffsetAudioIn;
    }

    return result;
  }

  performAudioAnalysis(audioBuffer) {
    // Preperate audio
    const audioSignal = this.preprocess(audioBuffer);

    // Transform to vector signal for analysis
    let vectorSignal = essentia.arrayToVector(audioSignal);

    // BPM detection using Essentia
    const bpm = essentia.PercivalBpmEstimator(
      vectorSignal,
      1024,
      2048,
      128,
      128,
      210,
      50,
      16000
    ).bpm;

    // Key detection using Essentia
    const key = this.detectKey(vectorSignal);

    // Calculate energy level
    let signal = audioBuffer.getChannelData(0);
    const energy = this.calculateEnergy(signal);

    return {
      bpm: Math.round(bpm),
      key: key.key,
      camelotKey: key.camelotKey,
      energy: energy,
    };
  }

  detectKey(vectorSignal) {
    // Maps keys to Camelot Wheel
    const keys = {
      "Ab minor": "1A",
      "B major": "1B",
      "Eb minor": "2A",
      "Gb major": "2B",
      "Bb minor": "3A",
      "Db major": "3B",
      "F minor": "4A",
      "Ab major": "4B",
      "C minor": "5A",
      "Eb major": "5B",
      "G minor": "6A",
      "Bb major": "6B",
      "D minor": "7A",
      "F major": "7B",
      "A minor": "8A",
      "C major": "8B",
      "E minor": "9A",
      "G major": "9B",
      "B minor": "10A",
      "D major": "10B",
      "Gb minor": "11A",
      "A major": "11B",
      "Db minor": "12A",
      "E major": "12B",
    };

    // Retain Camelotwheel mapping
    const enharmonicMap = {
      "F# minor": "Gb minor",
      "C# major": "Db major",
      "D# minor": "Eb minor",
      "G# minor": "Ab minor",
      "A# major": "Bb major",
    };

    // Detect Key
    const keyData = essentia.KeyExtractor(
      vectorSignal,
      true,
      4096,
      4096,
      12,
      3500,
      60,
      25,
      0.2,
      "bgate",
      16000,
      0.0001,
      440,
      "cosine",
      "hann"
    );
    let key = `${keyData.key} ${keyData.scale}`;
    key = enharmonicMap[key] || key;
    const camelotKey = keys[key];

    return {
      key: key,
      camelotKey: camelotKey,
    };
  }

  calculateEnergy(audioData) {
    let energy = 0;
    for (let i = 0; i < audioData.length; i++) {
      energy += audioData[i] * audioData[i];
    }
    return Math.sqrt(energy / audioData.length);
  }

  renderCamelotWheel() {
    const wheel = document.getElementById("camelotWheel");
    const radius = 150;
    const centerX = 175;
    const centerY = 175;

    // Create wheel positions
    for (let i = 1; i <= 12; i++) {
      ["A", "B"].forEach((letter, letterIndex) => {
        const angle = ((i - 1) * 30 + letterIndex * 15 - 90) * (Math.PI / 180);
        const x = centerX + (radius - letterIndex * 25) * Math.cos(angle);
        const y = centerY + (radius - letterIndex * 25) * Math.sin(angle);

        const position = document.createElement("div");
        position.className = "wheel-position";
        position.style.left = `${x - 25}px`;
        position.style.top = `${y - 25}px`;
        position.textContent = `${i}${letter}`;
        position.dataset.key = `${i}${letter}`;

        wheel.appendChild(position);
      });
    }
  }

  updateUI() {
    this.updateSongsList();
    this.updateWheelHighlights();
    const hasManualSongs = this.songs.some((song) => song.isManual);
    document.getElementById("createMixBtn").disabled = this.songs.length < 2;
    document.getElementById("exportSongsBtn").disabled =
      this.songs.length === 0;
  }

  updateSongsList() {
    const songsList = document.getElementById("songsList");

    if (this.songs.length === 0) {
      songsList.innerHTML =
        '<div class="empty-state"><p>No songs analyzed yet. Drop some audio files to get started!</p></div>';
      return;
    }

    songsList.innerHTML = this.songs
      .map(
        (song) => `
            <div class="song-item">
                <div class="song-info">
                    <h4>${song.name}</h4>
                    <p>${song.bpm} BPM • ${song.key}${
          song.isManual ? " • Manual Entry" : ""
        }</p>
                </div>
                <div class="song-key">${song.camelotKey}</div>
            </div>
        `
      )
      .join("");
  }

  updateWheelHighlights() {
    // Reset all positions
    document.querySelectorAll(".wheel-position").forEach((pos) => {
      pos.classList.remove("has-songs");
    });

    // Highlight positions with songs
    const keyGroups = {};
    this.songs.forEach((song) => {
      if (!keyGroups[song.camelotKey]) {
        keyGroups[song.camelotKey] = [];
      }
      keyGroups[song.camelotKey].push(song);
    });

    Object.keys(keyGroups).forEach((key) => {
      const position = document.querySelector(`[data-key="${key}"]`);
      if (position) {
        position.classList.add("has-songs");
        position.title = `${keyGroups[key].length} song(s) in ${key}`;
      }
    });
  }

  createOptimalMix() {
    if (this.songs.length < 2) return;

    const mixSequence = this.generateMixSequence();
    this.displayMixSequence(mixSequence);

    document.getElementById("mixSection").style.display = "block";
    document
      .getElementById("mixSection")
      .scrollIntoView({ behavior: "smooth" });
  }

  generateMixSequence() {
    // Sort songs by energy level for better flow
    const sortedSongs = [...this.songs].sort((a, b) => a.energy - b.energy);

    const sequence = [];
    let currentSong = sortedSongs[0];
    sequence.push({
      song: currentSong,
      transition: "Opening Track",
    });

    const remaining = sortedSongs.slice(1);

    while (remaining.length > 0) {
      const nextSong = this.findBestNextSong(currentSong, remaining);
      const transitionType = this.getTransitionType(
        currentSong.camelotKey,
        nextSong.song.camelotKey
      );

      sequence.push({
        song: nextSong.song,
        transition: transitionType,
      });

      currentSong = nextSong.song;
      remaining.splice(nextSong.index, 1);
    }

    return sequence;
  }

  findBestNextSong(currentSong, candidates) {
    let bestMatch = { song: candidates[0], index: 0, score: 0 };

    candidates.forEach((candidate, index) => {
      let score = 0;

      // Perfect match gets highest score
      if (
        this.compatibilityRules.perfect(
          currentSong.camelotKey,
          candidate.camelotKey
        )
      ) {
        score += 10;
      }

      // Energy boost gets good score
      if (
        this.compatibilityRules.energyBoost(
          currentSong.camelotKey,
          candidate.camelotKey
        )
      ) {
        score += 8;
      }

      // Mood change gets medium score
      if (
        this.compatibilityRules.moodChange(
          currentSong.camelotKey,
          candidate.camelotKey
        )
      ) {
        score += 6;
      }

      // BPM compatibility
      const bpmDiff = Math.abs(currentSong.bpm - candidate.bpm);
      if (bpmDiff <= 5) score += 5;
      else if (bpmDiff <= 10) score += 3;
      else if (bpmDiff <= 20) score += 1;

      if (score > bestMatch.score) {
        bestMatch = { song: candidate, index, score };
      }
    });

    return bestMatch;
  }

  getTransitionType(fromKey, toKey) {
    if (this.compatibilityRules.perfect(fromKey, toKey)) {
      return "Perfect Match";
    } else if (this.compatibilityRules.energyBoost(fromKey, toKey)) {
      return "Energy Boost";
    } else if (this.compatibilityRules.energyDrop(fromKey, toKey)) {
      return "Energy Drop";
    } else if (this.compatibilityRules.moodChange(fromKey, toKey)) {
      return "Mood Change";
    } else {
      return "Challenging Transition";
    }
  }

  displayMixSequence(sequence) {
    const timeline = document.getElementById("mixTimeline");

    timeline.innerHTML = sequence
      .map(
        (item, index) => `
            <div class="mix-item">
                <div class="mix-number">${index + 1}</div>
                <div class="mix-song-info">
                    <h4>${item.song.name}</h4>
                    <p>${item.song.bpm} BPM • ${item.song.camelotKey} (${
          item.song.key
        })</p>
                </div>
                <div class="mix-transition ${this.getTransitionClass(
                  item.transition
                )}">${item.transition}</div>
            </div>
        `
      )
      .join("");
  }

  getTransitionClass(transition) {
    const classMap = {
      "Perfect Match": "perfect",
      "Energy Boost": "energy-boost",
      "Energy Drop": "energy-drop",
      "Mood Change": "mood-change",
    };
    return classMap[transition] || "";
  }

  exportMix() {
    const sequence = Array.from(document.querySelectorAll(".mix-item")).map(
      (item, index) => {
        const name = item.querySelector("h4").textContent;
        const details = item.querySelector("p").textContent;
        const transition = item.querySelector(".mix-transition").textContent;
        return `${index + 1}. ${name} (${details}) - ${transition}`;
      }
    );

    const exportData = [
      "🎵 Optimal Mix Sequence - Generated by Camelot Wheel Analyzer",
      "=".repeat(60),
      "",
      ...sequence,
      "",
      `Generated on: ${new Date().toLocaleString()}`,
      `Total tracks: ${sequence.length}`,
    ].join("\n");

    const blob = new Blob([exportData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "camelot-mix-sequence.txt";
    a.click();
    URL.revokeObjectURL(url);

    this.showStatus("Mix sequence exported successfully!", "success");
  }

  exportMixJSON() {
    const sequence = Array.from(document.querySelectorAll(".mix-item")).map(
      (item) => {
        const name = item.querySelector("h4").textContent;
        // Find the original song to get the file name
        const song = this.songs.find((s) => s.name === name);
        if (song && song.file) {
          return song.file.name;
        } else {
          // For manual entries, create a filename from the song name
          return `${name
            .replace(/[^a-zA-Z0-9\s-]/g, "")
            .replace(/\s+/g, "_")}.mp3`;
        }
      }
    );

    const playlistData = {
      playlist: sequence,
    };

    const blob = new Blob([JSON.stringify(playlistData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "camelot-mix-playlist.json";
    a.click();
    URL.revokeObjectURL(url);

    this.showStatus("Mix playlist exported as JSON successfully!", "success");
  }

  exportSongs() {
    if (this.songs.length === 0) {
      this.showStatus("No songs to export.", "error");
      return;
    }

    const exportData = {
      songs: this.songs.map((song) => ({
        name: song.name,
        bpm: song.bpm,
        key: song.key,
        camelotKey: song.camelotKey,
        energy: song.energy || 0.5,
        duration: song.duration || 0,
        isManual: song.isManual || false,
        exportedAt: new Date().toISOString(),
      })),
      exportInfo: {
        totalSongs: this.songs.length,
        exportedAt: new Date().toISOString(),
        version: "1.0",
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `camelot-songs-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.showStatus("Song list exported successfully!", "success");
  }

  reset() {
    this.songs = [];
    this.updateUI();
    document.getElementById("mixSection").style.display = "none";
    document.getElementById("fileInput").value = "";
    this.showStatus("Application reset. Ready for new songs!", "info");
  }

  showStatus(message, type) {
    const status = document.getElementById("processingStatus");
    status.textContent = message;
    status.className = `processing-status ${type}`;

    if (type === "success" || type === "info") {
      setTimeout(() => {
        status.textContent = "";
        status.className = "processing-status";
      }, 3000);
    }
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  new CamelotAnalyzer();
});
