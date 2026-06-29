/**
 * Splays Music Player - Core Logic Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- STATE ---
  let songs = []; // Parsed songs from x.txt
  let currentPlaylist = []; // Context currently playing from
  let playlistName = 'All Tracks';
  let currentSongIndex = -1;
  let isPlaying = false;
  let isMuted = false;
  let volume = parseFloat(localStorage.getItem('splays_volume')) ?? 0.7;
  let isShuffle = localStorage.getItem('splays_shuffle') === 'true';
  let isRepeat = localStorage.getItem('splays_repeat') || 'none'; // 'none' | 'all' | 'one'
  
  // Likes & Recent Lists
  let likedSongIds = JSON.parse(localStorage.getItem('splays_likes')) || [];
  let recentlyPlayedIds = JSON.parse(localStorage.getItem('splays_recent')) || [];
  
  // Theme state
  let currentTheme = localStorage.getItem('splays_theme') || 'dark';

  // Audio HTML5 Object
  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  audio.volume = volume;

  // Audio Context for Visualizer
  let audioCtx = null;
  let analyser = null;
  let audioSource = null;
  let animationFrameId = null;

  // --- UI ELEMENTS ---
  const el = {
    // Player Panel
    playerSongTitle: document.getElementById('player-song-title'),
    playerSongArtist: document.getElementById('player-song-artist'),
    playerCoverArt: document.getElementById('player-cover-art'),
    coverGlow: document.getElementById('cover-glow'),
    btnPlayerLike: document.getElementById('btn-player-like'),
    
    progressSlider: document.getElementById('progress-slider'),
    timeCurrent: document.getElementById('time-current'),
    timeTotal: document.getElementById('time-total'),
    
    btnShuffle: document.getElementById('btn-shuffle'),
    btnPrev: document.getElementById('btn-prev'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    btnNext: document.getElementById('btn-next'),
    btnRepeat: document.getElementById('btn-repeat'),
    
    btnVolumeMute: document.getElementById('btn-volume-mute'),
    volumeSlider: document.getElementById('volume-slider'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),

    // Library Panel
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    
    // Lists
    tracksTableBody: document.getElementById('tracks-table-body'),
    likedTableBody: document.getElementById('liked-table-body'),
    recentTableBody: document.getElementById('recent-table-body'),
    
    // Count Badges
    trackCountText: document.getElementById('track-count-text'),
    likedCountText: document.getElementById('liked-count-text'),
    recentCountText: document.getElementById('recent-count-text'),
    
    // Visualizer Elements
    audioCanvas: document.getElementById('audio-canvas'),
    visualizerStyle: document.getElementById('visualizer-style'),
    audioNotice: document.getElementById('audio-notice')
  };

  // --- INITIAL THEME LOAD ---
  setTheme(currentTheme);

  // --- PLAYBACK CONTROLS ---

  function togglePlay() {
    if (currentSongIndex === -1 && currentPlaylist.length > 0) {
      playTrack(0);
      return;
    }
    if (currentSongIndex === -1) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => {
        console.error("Audio play failed: ", err);
        // Fallback without crossOrigin
        if (audio.crossOrigin === "anonymous") {
          disableVisualizerContext();
          const currentTrack = currentPlaylist[currentSongIndex];
          audio.removeAttribute("crossOrigin");
          audio.src = currentTrack.url;
          audio.play().catch(e => console.error("Playback failed entirely: ", e));
        }
      });
    }
  }

  function playTrack(index, forcePlay = true, seekToPosition = 0) {
    if (index < 0 || index >= currentPlaylist.length) return;

    currentSongIndex = index;
    const track = currentPlaylist[currentSongIndex];

    audio.crossOrigin = "anonymous";
    audio.src = track.url;
    audio.load();

    if (seekToPosition > 0) {
      audio.currentTime = seekToPosition;
    }

    updatePlayerUI(track);
    addToRecentlyPlayed(track.id);

    if (forcePlay) {
      audio.play()
        .then(() => {
          initAudioContext();
        })
        .catch(err => {
          console.warn("Retrying playback without CORS visualizer mode.");
          disableVisualizerContext();
          audio.removeAttribute("crossOrigin");
          audio.src = track.url;
          audio.play().catch(e => console.error("Playback failed: ", e));
        });
    }

    // Save state
    localStorage.setItem('splays_last_song_id', track.id);
    updateRowVisualHighlight();
  }

  function playNext() {
    if (currentPlaylist.length === 0) return;

    if (isRepeat === 'one') {
      playTrack(currentSongIndex);
      return;
    }

    let nextIndex = currentSongIndex + 1;
    if (nextIndex >= currentPlaylist.length) {
      if (isRepeat === 'all') {
        nextIndex = 0;
      } else {
        isPlaying = false;
        audio.pause();
        audio.currentTime = 0;
        updatePlayStateUI();
        return;
      }
    }
    playTrack(nextIndex);
  }

  function playPrev() {
    if (currentPlaylist.length === 0) return;

    if (audio.currentTime > 5) {
      audio.currentTime = 0;
      return;
    }

    let prevIndex = currentSongIndex - 1;
    if (prevIndex < 0) {
      if (isRepeat === 'all') {
        prevIndex = currentPlaylist.length - 1;
      } else {
        prevIndex = 0;
      }
    }
    playTrack(prevIndex);
  }

  // --- AUDIO NODE EVENT LISTENERS ---

  audio.addEventListener('play', () => {
    isPlaying = true;
    updatePlayStateUI();
    initAudioContext();
  });

  audio.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayStateUI();
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      const pct = (audio.currentTime / audio.duration) * 100;
      el.progressSlider.value = pct;
      el.progressSlider.style.background = `linear-gradient(to right, var(--primary) ${pct}%, var(--bg-card-hover) ${pct}%)`;
      el.timeCurrent.innerText = formatTime(audio.currentTime);
      localStorage.setItem('splays_last_position', audio.currentTime);
    }
  });

  audio.addEventListener('durationchange', () => {
    if (audio.duration) {
      el.timeTotal.innerText = formatTime(audio.duration);
    }
  });

  audio.addEventListener('ended', () => {
    playNext();
  });

  // Seek bar listener
  el.progressSlider.addEventListener('input', () => {
    const pct = el.progressSlider.value;
    el.progressSlider.style.background = `linear-gradient(to right, var(--primary) ${pct}%, var(--bg-card-hover) ${pct}%)`;
    if (audio.duration) {
      const seekTime = (pct / 100) * audio.duration;
      el.timeCurrent.innerText = formatTime(seekTime);
    }
  });

  el.progressSlider.addEventListener('change', () => {
    if (audio.duration) {
      audio.currentTime = (el.progressSlider.value / 100) * audio.duration;
    }
  });

  // Volume slider listener
  el.volumeSlider.addEventListener('input', () => {
    const pct = el.volumeSlider.value;
    el.volumeSlider.style.background = `linear-gradient(to right, var(--primary) ${pct}%, var(--bg-card-hover) ${pct}%)`;
    volume = pct / 100;
    audio.volume = volume;
    localStorage.setItem('splays_volume', volume);
    updateVolumeIcon();
    if (volume > 0) isMuted = false;
  });

  el.btnVolumeMute.addEventListener('click', () => {
    isMuted = !isMuted;
    if (isMuted) {
      audio.volume = 0;
      el.volumeSlider.value = 0;
      el.volumeSlider.style.background = `linear-gradient(to right, var(--primary) 0%, var(--bg-card-hover) 0%)`;
    } else {
      audio.volume = volume;
      el.volumeSlider.value = volume * 100;
      el.volumeSlider.style.background = `linear-gradient(to right, var(--primary) ${volume * 100}%, var(--bg-card-hover) ${volume * 100}%)`;
    }
    updateVolumeIcon();
  });

  function updateVolumeIcon() {
    let icon = 'volume-2';
    if (isMuted || audio.volume === 0) icon = 'volume-x';
    else if (audio.volume < 0.3) icon = 'volume';
    else if (audio.volume < 0.7) icon = 'volume-1';
    
    el.btnVolumeMute.innerHTML = `<i data-lucide="${icon}"></i>`;
    lucide.createIcons();
  }

  // Shuffle toggle
  el.btnShuffle.addEventListener('click', () => {
    isShuffle = !isShuffle;
    el.btnShuffle.classList.toggle('active', isShuffle);
    localStorage.setItem('splays_shuffle', isShuffle);
    
    if (isShuffle && currentPlaylist.length > 0) {
      shufflePlaylistContext();
    } else {
      restorePlaylistContext();
    }
  });

  function shufflePlaylistContext() {
    if (currentSongIndex === -1) return;
    const currentTrack = currentPlaylist[currentSongIndex];
    const remaining = currentPlaylist.filter((_, idx) => idx !== currentSongIndex);
    
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    
    currentPlaylist = [currentTrack, ...remaining];
    currentSongIndex = 0;
  }

  function restorePlaylistContext() {
    const currentTrackId = currentPlaylist[currentSongIndex]?.id;
    if (playlistName === 'All Tracks') {
      currentPlaylist = [...songs];
    } else if (playlistName === 'Liked Songs') {
      currentPlaylist = songs.filter(s => likedSongIds.includes(s.id));
    } else if (playlistName === 'Recently Played') {
      currentPlaylist = recentlyPlayedIds.map(id => songs.find(s => s.id === id)).filter(Boolean);
    }
    
    if (currentTrackId) {
      currentSongIndex = currentPlaylist.findIndex(s => s.id === currentTrackId);
    }
  }

  // Repeat toggle ('none' -> 'all' -> 'one' -> 'none')
  el.btnRepeat.addEventListener('click', () => {
    if (isRepeat === 'none') {
      isRepeat = 'all';
      el.btnRepeat.className = 'btn-icon active';
      el.btnRepeat.innerHTML = '<i data-lucide="repeat"></i>';
    } else if (isRepeat === 'all') {
      isRepeat = 'one';
      el.btnRepeat.className = 'btn-icon active';
      el.btnRepeat.innerHTML = '<i data-lucide="repeat-1"></i>';
    } else {
      isRepeat = 'none';
      el.btnRepeat.className = 'btn-icon';
      el.btnRepeat.innerHTML = '<i data-lucide="repeat"></i>';
    }
    localStorage.setItem('splays_repeat', isRepeat);
    lucide.createIcons();
  });

  // Setup initial controls UI from LocalStorage
  if (isShuffle) el.btnShuffle.classList.add('active');
  if (isRepeat === 'all') {
    el.btnRepeat.className = 'btn-icon active';
  } else if (isRepeat === 'one') {
    el.btnRepeat.className = 'btn-icon active';
    el.btnRepeat.innerHTML = '<i data-lucide="repeat-1"></i>';
  }

  // --- DATA FETCHING & PARSING ---

  async function fetchSongData() {
    try {
      const res = await fetch('./x.txt');
      if (!res.ok) throw new Error('Data source unreachable');
      
      const content = await res.text();
      songs = parseSongTxt(content);
      
      if (songs.length === 0) {
        throw new Error('No songs parsed');
      }
      
      currentPlaylist = [...songs];
      playlistName = 'All Tracks';
      
      renderAllViews();
      restoreLastPlayedSession();
      
    } catch (e) {
      console.error(e);
      showLocalErrorNotice();
    }
  }

  function showLocalErrorNotice() {
    el.tracksTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-placeholder">
          <i data-lucide="music-4" style="width: 48px; height: 48px; color: var(--primary); margin-bottom: 12px; display: inline-block;"></i>
          <h3>No tracks available</h3>
          <p>Please upload tracks or check your connection.</p>
        </td>
      </tr>
    `;
    lucide.createIcons();
  }

  function parseSongTxt(text) {
    const lines = text.split(/\r?\n/);
    const parsed = [];
    
    lines.forEach((line, idx) => {
      line = line.trim();
      if (!line) return;
      
      const parts = line.split(/\s+-\s+/);
      if (parts.length >= 2) {
        const url = parts[0].trim();
        let img = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&h=300&fit=crop';
        let title = 'Unknown Title';
        let artist = 'Unknown Artist';
        
        if (parts.length >= 4) {
          img = parts[1].trim();
          title = parts[2].trim();
          artist = parts.slice(3).join(' - ').trim();
        } else if (parts.length === 3) {
          img = parts[1].trim();
          title = parts[2].trim();
        } else if (parts.length === 2) {
          title = parts[1].trim();
        }
        
        parsed.push({
          id: `song_${idx}_${hashString(url)}`,
          url: url,
          fullName: `${artist} - ${title}`,
          title: title,
          artist: artist,
          img: img
        });
      }
    });
    
    return parsed;
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  // --- RENDERING VIEWS ---

  function renderAllViews() {
    renderTracksTable();
    renderLikedTable();
    renderRecentTable();
  }

  function renderTracksTable() {
    el.tracksTableBody.innerHTML = '';
    el.trackCountText.innerText = `${songs.length} Tracks`;
    
    if (songs.length === 0) {
      el.tracksTableBody.innerHTML = `<tr><td colspan="4" class="empty-placeholder">No songs available</td></tr>`;
      return;
    }
    
    songs.forEach((track, index) => {
      const row = createTrackRow(track, index, 'all-songs');
      el.tracksTableBody.appendChild(row);
    });
    lucide.createIcons();
  }

  function renderLikedTable() {
    el.likedTableBody.innerHTML = '';
    const likedSongs = songs.filter(s => likedSongIds.includes(s.id));
    el.likedCountText.innerText = `${likedSongs.length} Tracks`;

    if (likedSongs.length === 0) {
      el.likedTableBody.innerHTML = `<tr><td colspan="4" class="empty-placeholder">Your liked tracks will appear here.</td></tr>`;
      return;
    }

    likedSongs.forEach((track, index) => {
      const row = createTrackRow(track, index, 'liked-songs');
      el.likedTableBody.appendChild(row);
    });
    lucide.createIcons();
  }

  function renderRecentTable() {
    el.recentTableBody.innerHTML = '';
    const recentSongs = recentlyPlayedIds.map(id => songs.find(s => s.id === id)).filter(Boolean);
    el.recentCountText.innerText = `${recentSongs.length} Tracks`;

    if (recentSongs.length === 0) {
      el.recentTableBody.innerHTML = `<tr><td colspan="4" class="empty-placeholder">Your recently played tracks will appear here.</td></tr>`;
      return;
    }

    recentSongs.forEach((track, index) => {
      const row = createTrackRow(track, index, 'recent-songs');
      el.recentTableBody.appendChild(row);
    });
    lucide.createIcons();
  }

  function createTrackRow(track, index, contextType) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', track.id);
    tr.setAttribute('data-context', contextType);
    
    const isLiked = likedSongIds.includes(track.id);
    const likeClass = isLiked ? 'liked' : '';

    tr.innerHTML = `
      <td class="col-num">${index + 1}</td>
      <td class="col-title">${track.title}</td>
      <td class="col-artist">${track.artist}</td>
      <td class="col-actions">
        <button class="btn-icon track-row-like-btn ${likeClass}" title="Like">
          <i data-lucide="heart" size="16"></i>
        </button>
      </td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.target.closest('.btn-icon')) return;
      playContextSong(track, contextType);
    });

    tr.querySelector('.track-row-like-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLikeTrack(track.id);
    });

    return tr;
  }

  function playContextSong(track, contextType) {
    if (contextType === 'all-songs') {
      currentPlaylist = [...songs];
      playlistName = 'All Tracks';
    } else if (contextType === 'liked-songs') {
      currentPlaylist = songs.filter(s => likedSongIds.includes(s.id));
      playlistName = 'Liked Songs';
    } else if (contextType === 'recent-songs') {
      currentPlaylist = recentlyPlayedIds.map(id => songs.find(s => s.id === id)).filter(Boolean);
      playlistName = 'Recently Played';
    }

    if (isShuffle) {
      shufflePlaylistContext();
    }

    const idx = currentPlaylist.findIndex(s => s.id === track.id);
    playTrack(idx);
  }

  // --- LIKES & RECENTS MANAGEMENT ---

  function toggleLikeTrack(id) {
    const idx = likedSongIds.indexOf(id);
    if (idx === -1) {
      likedSongIds.push(id);
    } else {
      likedSongIds.splice(idx, 1);
    }
    
    localStorage.setItem('splays_likes', JSON.stringify(likedSongIds));
    renderLikedTable();
    
    // Update player and track rows state
    const currentTrack = currentPlaylist[currentSongIndex];
    if (currentTrack && currentTrack.id === id) {
      el.btnPlayerLike.classList.toggle('liked', likedSongIds.includes(id));
    }
    
    document.querySelectorAll(`tr[data-id="${id}"] .track-row-like-btn`).forEach(btn => {
      btn.classList.toggle('liked', likedSongIds.includes(id));
    });
  }

  el.btnPlayerLike.addEventListener('click', () => {
    const track = currentPlaylist[currentSongIndex];
    if (track) toggleLikeTrack(track.id);
  });

  function addToRecentlyPlayed(id) {
    const idx = recentlyPlayedIds.indexOf(id);
    if (idx !== -1) {
      recentlyPlayedIds.splice(idx, 1);
    }
    recentlyPlayedIds.unshift(id);
    
    if (recentlyPlayedIds.length > 10) {
      recentlyPlayedIds.pop();
    }

    localStorage.setItem('splays_recent', JSON.stringify(recentlyPlayedIds));
    renderRecentTable();
  }

  // --- STATE SYNC & HIGHLIGHTS ---

  function updatePlayerUI(track) {
    el.playerCoverArt.src = track.img;
    el.playerSongTitle.innerText = track.title;
    el.playerSongArtist.innerText = track.artist;
    
    // Set dynamic shadow colors
    el.coverGlow.style.background = `radial-gradient(circle, rgba(29, 185, 84, 0.45) 0%, transparent 70%)`;
    
    el.progressSlider.value = 0;
    el.progressSlider.style.background = `linear-gradient(to right, var(--primary) 0%, var(--bg-card-hover) 0%)`;
    el.timeCurrent.innerText = '0:00';
    el.timeTotal.innerText = '0:00';

    const isLiked = likedSongIds.includes(track.id);
    el.btnPlayerLike.classList.toggle('liked', isLiked);
  }

  function updatePlayStateUI() {
    el.btnPlayPause.innerHTML = isPlaying ? `<i data-lucide="pause" class="icon-fill"></i>` : `<i data-lucide="play" class="icon-fill"></i>`;
    el.playerCoverArt.classList.toggle('playing', isPlaying);
    
    // Update Browser title
    const track = currentPlaylist[currentSongIndex];
    if (track) {
      document.title = `${isPlaying ? '▶' : '⏸'} ${track.title} – ${track.artist}`;
    } else {
      document.title = 'Splays - Premium Music Experience';
    }
    
    lucide.createIcons();
    updateRowVisualHighlight();
  }

  function updateRowVisualHighlight() {
    const currentTrack = currentPlaylist[currentSongIndex];
    
    document.querySelectorAll('tr[data-id]').forEach(tr => {
      const id = tr.getAttribute('data-id');
      const isCurrent = currentTrack && id === currentTrack.id;
      tr.classList.toggle('playing', isCurrent);
    });
  }

  function restoreLastPlayedSession() {
    const lastSongId = localStorage.getItem('splays_last_song_id');
    const lastPos = parseFloat(localStorage.getItem('splays_last_position')) || 0;
    
    if (lastSongId && songs.length > 0) {
      const idx = songs.findIndex(s => s.id === lastSongId);
      if (idx !== -1) {
        currentPlaylist = [...songs];
        playlistName = 'All Tracks';
        playTrack(idx, false, lastPos);
        isPlaying = false;
        updatePlayStateUI();
        
        // Restore slider gradient
        setTimeout(() => {
          if (audio.duration) {
            const pct = (lastPos / audio.duration) * 100;
            el.progressSlider.value = pct;
            el.progressSlider.style.background = `linear-gradient(to right, var(--primary) ${pct}%, var(--bg-card-hover) ${pct}%)`;
          }
        }, 300);
      }
    }
  }

  // --- THEME SWITCHER ---

  el.btnThemeToggle.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(currentTheme);
  });

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('splays_theme', theme);
    
    const themeIcon = theme === 'dark' ? 'sun' : 'moon';
    el.btnThemeToggle.innerHTML = `<i data-lucide="${themeIcon}"></i>`;
    lucide.createIcons();
  }

  // --- REAL-TIME SEARCH BOX ---

  let searchTimeout = null;
  el.searchInput.addEventListener('input', () => {
    const query = el.searchInput.value.trim().toLowerCase();
    el.searchClear.style.display = query ? 'flex' : 'none';
    
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterTables(query);
    }, 150);
  });

  el.searchClear.addEventListener('click', () => {
    el.searchInput.value = '';
    el.searchClear.style.display = 'none';
    filterTables('');
  });

  function filterTables(query) {
    document.querySelectorAll('.songs-table tbody tr').forEach(row => {
      const title = row.querySelector('.col-title').innerText.toLowerCase();
      const artist = row.querySelector('.col-artist').innerText.toLowerCase();
      if (title.includes(query) || artist.includes(query)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  // --- LIBRARY TAB NAVIGATION ---

  el.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      el.tabButtons.forEach(b => b.classList.remove('active'));
      el.tabPanes.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const target = btn.getAttribute('data-target');
      document.getElementById(target).classList.add('active');
      
      if (target === 'tab-visualizer') {
        initAudioContext();
      }
    });
  });

  // --- KEYBOARD SHORTCUTS ---

  window.addEventListener('keydown', (e) => {
    // Disable shortcuts if typing in input
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - 5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (audio.duration) {
          audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        volume = Math.min(1, volume + 0.05);
        audio.volume = volume;
        el.volumeSlider.value = volume * 100;
        el.volumeSlider.style.background = `linear-gradient(to right, var(--primary) ${volume * 100}%, var(--bg-card-hover) ${volume * 100}%)`;
        localStorage.setItem('splays_volume', volume);
        updateVolumeIcon();
        isMuted = false;
        break;
      case 'ArrowDown':
        e.preventDefault();
        volume = Math.max(0, volume - 0.05);
        audio.volume = volume;
        el.volumeSlider.value = volume * 100;
        el.volumeSlider.style.background = `linear-gradient(to right, var(--primary) ${volume * 100}%, var(--bg-card-hover) ${volume * 100}%)`;
        localStorage.setItem('splays_volume', volume);
        updateVolumeIcon();
        break;
    }
  });

  // --- AUDIO VISUALIZER ENGINE ---
  
  function initAudioContext() {
    if (audioCtx) return;
    if (!analyser) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        
        audioSource = audioCtx.createMediaElementSource(audio);
        audioSource.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        el.audioNotice.style.display = 'none';
        startVisualizerDrawing();
      } catch (e) {
        console.warn("Failed to initialize visualizer context: ", e);
        disableVisualizerContext();
      }
    }
  }

  function disableVisualizerContext() {
    el.audioNotice.style.display = 'flex';
  }

  function startVisualizerDrawing() {
    const canvas = el.audioCanvas;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function resizeCanvas() {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const particles = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height + canvas.height,
        speed: 1 + Math.random() * 3,
        size: 1 + Math.random() * 4,
        alpha: 0.1 + Math.random() * 0.5,
        colorIndex: Math.floor(Math.random() * 3)
      });
    }

    function draw() {
      animationFrameId = requestAnimationFrame(draw);
      resizeCanvas();
      
      const width = canvas.width;
      const height = canvas.height;
      
      if (width === 0 || height === 0) return;
      
      analyser.getByteFrequencyData(dataArray);
      
      // Clean background matching active theme
      const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
      ctx.fillStyle = isLightTheme ? 'rgba(240, 242, 246, 0.25)' : 'rgba(10, 11, 16, 0.2)';
      ctx.fillRect(0, 0, width, height);
      
      const style = el.visualizerStyle.value;
      
      if (style === 'bars') {
        const barWidth = (width / bufferLength) * 1.5;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          const percent = dataArray[i] / 255;
          const barHeight = percent * height * 0.85;
          
          const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
          gradient.addColorStop(0, '#8a2be2');
          gradient.addColorStop(0.5, '#1db954');
          gradient.addColorStop(1, '#00f2fe');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
          } else {
            ctx.rect(x, height - barHeight, barWidth - 2, barHeight);
          }
          ctx.fill();
          
          x += barWidth;
        }
      }
      
      else if (style === 'wave') {
        analyser.getByteTimeDomainData(dataArray);
        
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#1db954';
        ctx.beginPath();
        
        const sliceWidth = width / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          
          x += sliceWidth;
        }
        
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }
      
      else if (style === 'circle') {
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) * 0.25;
        
        let bassSum = 0;
        for (let i = 0; i < 10; i++) {
          bassSum += dataArray[i];
        }
        const pulse = (bassSum / 10) / 255;
        const activeRadius = baseRadius + (pulse * 30);
        
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(1, activeRadius + 20), 0, 2 * Math.PI);
        ctx.stroke();
        
        ctx.lineWidth = 3;
        for (let i = 0; i < bufferLength; i++) {
          const angle = (i / bufferLength) * Math.PI * 2;
          const amplitude = (dataArray[i] / 255) * 50;
          
          const startX = centerX + Math.cos(angle) * activeRadius;
          const startY = centerY + Math.sin(angle) * activeRadius;
          
          const endX = centerX + Math.cos(angle) * (activeRadius + amplitude);
          const endY = centerY + Math.sin(angle) * (activeRadius + amplitude);
          
          const grad = ctx.createLinearGradient(startX, startY, endX, endY);
          grad.addColorStop(0, '#1db954');
          grad.addColorStop(1, '#8a2be2');
          
          ctx.strokeStyle = grad;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
      }
      
      else if (style === 'particles') {
        let midSum = 0;
        for (let i = 10; i < 40; i++) midSum += dataArray[i];
        const energy = (midSum / 30) / 255;
        
        particles.forEach(p => {
          const velY = p.speed + (energy * 15);
          p.y -= velY;
          
          if (p.y < -10) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
          
          const pulseSize = p.size + (energy * 8);
          let color = '#1db954';
          if (p.colorIndex === 1) color = '#8a2be2';
          if (p.colorIndex === 2) color = '#00f2fe';
          
          ctx.fillStyle = color;
          ctx.globalAlpha = p.alpha;
          
          ctx.beginPath();
          ctx.arc(p.x, p.y, pulseSize, 0, 2 * Math.PI);
          ctx.fill();
          
          ctx.globalAlpha = 1.0;
        });
      }
    }
    
    draw();
  }

  // --- UTILITIES ---

  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // --- EVENT ATTACHMENTS ---
  el.btnPlayPause.addEventListener('click', togglePlay);
  el.btnPrev.addEventListener('click', playPrev);
  el.btnNext.addEventListener('click', playNext);

  // Set initial slider colors
  el.volumeSlider.value = volume * 100;
  el.volumeSlider.style.background = `linear-gradient(to right, var(--primary) ${volume * 100}%, var(--bg-card-hover) ${volume * 100}%)`;
  el.progressSlider.value = 0;
  el.progressSlider.style.background = `linear-gradient(to right, var(--primary) 0%, var(--bg-card-hover) 0%)`;

  lucide.createIcons();

  // Load song list directly on page load
  fetchSongData();
});
