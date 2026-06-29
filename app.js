/**
 * Splays Music Player - Logic Engine (Simplified Local x.txt Version)
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- STATE ---
  let songs = []; // Main array of songs parsed from x.txt
  let currentPlaylist = []; // Songs currently playing from
  let playlistName = 'All Tracks'; // Current playing context name
  let currentSongIndex = -1;
  let isPlaying = false;
  let isMuted = false;
  let volume = 0.7; // 0 to 1
  let isShuffle = false;
  let isRepeat = 'none'; // 'none' | 'one' | 'all'
  let playQueue = [];
  
  // Audio HTML5 Object
  const audio = new Audio();
  audio.crossOrigin = "anonymous"; // Enable visualizer for CORS compliant streams
  
  // Audio Context for Visualizer
  let audioCtx = null;
  let analyser = null;
  let audioSource = null;
  let animationFrameId = null;
  
  // Playlists and Likes stored in localStorage
  let likedSongIds = JSON.parse(localStorage.getItem('splays_likes')) || [];
  let customPlaylists = JSON.parse(localStorage.getItem('splays_playlists')) || {};

  // --- UI ELEMENTS ---
  const el = {
    // Views
    viewHome: document.getElementById('view-home'),
    viewLiked: document.getElementById('view-liked'),
    viewPlaylist: document.getElementById('view-playlist'),
    viewVisualizer: document.getElementById('view-visualizer-mode'),
    contentScroll: document.getElementById('content-scroll'),
    
    // Navigation
    navHome: document.getElementById('nav-home'),
    navLiked: document.getElementById('nav-liked'),
    navVisualizer: document.getElementById('nav-visualizer'),
    playlistList: document.getElementById('playlist-list'),
    
    // Header
    searchContainer: document.getElementById('search-bar-wrapper'),
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    welcomeMessage: document.getElementById('welcome-message'),
    
    // Dashboard / Views Content
    quickPicksContainer: document.getElementById('quick-picks-container'),
    tracksTableBody: document.getElementById('tracks-table-body'),
    likedTableBody: document.getElementById('liked-table-body'),
    playlistTableBody: document.getElementById('playlist-table-body'),
    trackCountText: document.getElementById('track-count-text'),
    
    // Playlist View details
    playlistViewArt: document.getElementById('playlist-view-art'),
    playlistViewTitle: document.getElementById('playlist-view-title'),
    playlistViewDesc: document.getElementById('playlist-view-desc'),
    btnPlaylistPlay: document.getElementById('btn-playlist-play'),
    btnLikedPlay: document.getElementById('btn-liked-play'),
    btnDeletePlaylist: document.getElementById('btn-delete-playlist'),
    btnCreatePlaylist: document.getElementById('btn-create-playlist'),
    
    // Banner
    btnBannerPlay: document.getElementById('btn-banner-play'),
    btnBannerVisualizer: document.getElementById('btn-banner-visualizer'),
    
    // Bottom Player Bar
    playerBar: document.getElementById('player-bar'),
    playerCoverArt: document.getElementById('player-cover-art'),
    playerSongTitle: document.getElementById('player-song-title'),
    playerSongArtist: document.getElementById('player-song-artist'),
    btnPlayerLike: document.getElementById('btn-player-like'),
    
    btnShuffle: document.getElementById('btn-shuffle'),
    btnPrev: document.getElementById('btn-prev'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    playIconMain: document.getElementById('play-icon-main'),
    btnNext: document.getElementById('btn-next'),
    btnRepeat: document.getElementById('btn-repeat'),
    
    timeCurrent: document.getElementById('time-current'),
    timeTotal: document.getElementById('time-total'),
    progressSlider: document.getElementById('progress-slider'),
    progressFill: document.getElementById('progress-fill'),
    
    btnToggleVisualizer: document.getElementById('btn-toggle-visualizer'),
    btnToggleQueue: document.getElementById('btn-toggle-queue'),
    btnVolumeMute: document.getElementById('btn-volume-mute'),
    volumeIcon: document.getElementById('volume-icon'),
    volumeSlider: document.getElementById('volume-slider'),
    volumeFill: document.getElementById('volume-fill'),
    
    // Playlist Modal
    playlistModal: document.getElementById('playlist-modal'),
    btnClosePlaylistModal: document.getElementById('btn-close-playlist-modal'),
    playlistNameInput: document.getElementById('playlist-name-input'),
    playlistDescInput: document.getElementById('playlist-desc-input'),
    btnCancelPlaylist: document.getElementById('btn-cancel-playlist'),
    btnSavePlaylist: document.getElementById('btn-save-playlist'),
    
    // Queue Drawer
    queueDrawer: document.getElementById('queue-drawer'),
    btnCloseQueue: document.getElementById('btn-close-queue'),
    queueCurrentContainer: document.getElementById('queue-current-container'),
    queueListContainer: document.getElementById('queue-list-container'),
    btnClearQueue: document.getElementById('btn-clear-queue'),
    
    // Context Menu
    trackContextMenu: document.getElementById('track-context-menu'),
    menuPlayNow: document.getElementById('menu-play-now'),
    menuAddQueue: document.getElementById('menu-add-queue'),
    menuFavorite: document.getElementById('menu-favorite'),
    contextSubmenuPlaylists: document.getElementById('context-submenu-playlists'),
    
    // Visualizer View elements
    visCoverArt: document.getElementById('vis-cover-art'),
    visTrackTitle: document.getElementById('vis-track-title'),
    visTrackArtist: document.getElementById('vis-track-artist'),
    visualizerStyle: document.getElementById('visualizer-style'),
    audioCanvas: document.getElementById('audio-canvas'),
    audioNotice: document.getElementById('audio-notice')
  };

  // --- AUDIO LOGIC ---

  // Handle Play/Pause
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
        console.error("Audio playback failed: ", err);
        // If CORS failed, try fallback without crossOrigin
        if (audio.crossOrigin === "anonymous") {
          console.warn("Retrying playback without crossOrigin anonymity (Visualizer will be disabled).");
          disableVisualizerContext();
          const currentTrack = currentPlaylist[currentSongIndex];
          audio.removeAttribute("crossOrigin");
          audio.src = currentTrack.url;
          audio.play().catch(e => console.error("Playback failed completely: ", e));
        }
      });
    }
  }

  function disableVisualizerContext() {
    el.audioNotice.style.display = 'flex';
    el.audioNotice.querySelector('span').innerText = "Visualizer disabled for this track due to server CORS restrictions.";
  }

  // Play a specific track in the current playlist
  function playTrack(index, forcePlay = true) {
    if (index < 0 || index >= currentPlaylist.length) return;
    
    updateRowVisualStates();
    
    currentSongIndex = index;
    const track = currentPlaylist[currentSongIndex];
    
    // Reset CORS attribute to anonymous for potential visualizer support
    audio.crossOrigin = "anonymous";
    audio.src = track.url;
    audio.load();
    
    updatePlayerBarUI(track);
    
    if (forcePlay) {
      audio.play()
        .then(() => {
          initAudioContext();
        })
        .catch(err => {
          console.error("Error playing audio stream: ", err);
          // Retry without crossOrigin
          disableVisualizerContext();
          audio.removeAttribute("crossOrigin");
          audio.src = track.url;
          audio.play().catch(e => console.error("Secondary playback attempt failed: ", e));
        });
    }
    
    updateRowVisualStates();
    renderQueue();
  }

  // Play next track
  function playNext() {
    if (playQueue.length > 0) {
      const nextTrack = playQueue.shift();
      currentPlaylist.splice(currentSongIndex + 1, 0, nextTrack);
      playTrack(currentSongIndex + 1);
      return;
    }

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

  // Play previous track
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

  // Audio event listeners
  audio.addEventListener('play', () => {
    isPlaying = true;
    updatePlayStateUI();
    document.body.classList.add('body-playing');
  });

  audio.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayStateUI();
    document.body.classList.remove('body-playing');
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      const pct = (audio.currentTime / audio.duration) * 100;
      el.progressSlider.value = pct;
      el.progressFill.style.width = `${pct}%`;
      el.timeCurrent.innerText = formatTime(audio.currentTime);
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

  // Slider seek handlers
  el.progressSlider.addEventListener('input', () => {
    if (audio.duration) {
      const seekTime = (el.progressSlider.value / 100) * audio.duration;
      el.timeCurrent.innerText = formatTime(seekTime);
      el.progressFill.style.width = `${el.progressSlider.value}%`;
    }
  });

  el.progressSlider.addEventListener('change', () => {
    if (audio.duration) {
      audio.currentTime = (el.progressSlider.value / 100) * audio.duration;
    }
  });

  // Volume handles
  el.volumeSlider.addEventListener('input', () => {
    volume = el.volumeSlider.value / 100;
    audio.volume = volume;
    el.volumeFill.style.width = `${el.volumeSlider.value}%`;
    updateVolumeIcon();
    
    if (volume > 0) {
      isMuted = false;
    }
  });

  el.btnVolumeMute.addEventListener('click', () => {
    isMuted = !isMuted;
    if (isMuted) {
      audio.volume = 0;
      el.volumeSlider.value = 0;
      el.volumeFill.style.width = '0%';
    } else {
      audio.volume = volume;
      el.volumeSlider.value = volume * 100;
      el.volumeFill.style.width = `${volume * 100}%`;
    }
    updateVolumeIcon();
  });

  function updateVolumeIcon() {
    let iconName = 'volume-2';
    if (isMuted || audio.volume === 0) {
      iconName = 'volume-x';
    } else if (audio.volume < 0.3) {
      iconName = 'volume';
    } else if (audio.volume < 0.7) {
      iconName = 'volume-1';
    }
    el.volumeIcon.setAttribute('data-lucide', iconName);
    lucide.createIcons();
  }

  // Shuffle toggle
  el.btnShuffle.addEventListener('click', () => {
    isShuffle = !isShuffle;
    el.btnShuffle.classList.toggle('active', isShuffle);
    
    if (isShuffle && currentPlaylist.length > 0) {
      const currentTrack = currentPlaylist[currentSongIndex];
      const remaining = currentPlaylist.filter((_, idx) => idx !== currentSongIndex);
      
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      
      currentPlaylist = [currentTrack, ...remaining];
      currentSongIndex = 0;
      updateRowVisualStates();
    } else {
      reloadCurrentContextOrder();
    }
  });

  function reloadCurrentContextOrder() {
    const currentTrackId = currentPlaylist[currentSongIndex]?.id;
    
    if (playlistName === 'All Tracks') {
      currentPlaylist = [...songs];
    } else if (playlistName === 'Liked Songs') {
      currentPlaylist = songs.filter(s => likedSongIds.includes(s.id));
    } else if (playlistName.startsWith('Playlist:')) {
      const pid = playlistName.split(':')[1];
      const pl = customPlaylists[pid];
      if (pl) {
        currentPlaylist = songs.filter(s => pl.songIds.includes(s.id));
      }
    }
    
    if (currentTrackId) {
      currentSongIndex = currentPlaylist.findIndex(s => s.id === currentTrackId);
    }
    updateRowVisualStates();
  }

  // Repeat toggle
  el.btnRepeat.addEventListener('click', () => {
    if (isRepeat === 'none') {
      isRepeat = 'all';
      el.btnRepeat.classList.add('active');
    } else if (isRepeat === 'all') {
      isRepeat = 'one';
      el.btnRepeat.classList.add('active');
      el.btnRepeat.style.position = 'relative';
      let dot = el.btnRepeat.querySelector('.repeat-dot');
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'repeat-dot';
        dot.style.position = 'absolute';
        dot.style.top = '2px';
        dot.style.right = '2px';
        dot.style.width = '5px';
        dot.style.height = '5px';
        dot.style.backgroundColor = 'var(--primary)';
        dot.style.borderRadius = '50%';
        el.btnRepeat.appendChild(dot);
      }
    } else {
      isRepeat = 'none';
      el.btnRepeat.classList.remove('active');
      const dot = el.btnRepeat.querySelector('.repeat-dot');
      if (dot) dot.remove();
    }
    lucide.createIcons();
  });

  // --- AUDIO VISUALIZER ENGINE ---
  
  function initAudioContext() {
    if (audioCtx) return;
    
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
      
      analyser.getByteFrequencyData(dataArray);
      
      ctx.fillStyle = 'rgba(12, 13, 18, 0.2)';
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
          
          if (percent > 0.7) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00f2fe';
            ctx.fillStyle = '#fff';
            ctx.fillRect(x, height - barHeight, barWidth - 2, 3);
            ctx.shadowBlur = 0;
          }
          
          x += barWidth;
        }
      }
      
      else if (style === 'wave') {
        analyser.getByteTimeDomainData(dataArray);
        
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#1db954';
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(29, 185, 84, 0.6)';
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
        ctx.shadowBlur = 0;
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
        ctx.arc(centerX, centerY, activeRadius + 20, 0, 2 * Math.PI);
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
        
        ctx.fillStyle = 'rgba(12, 13, 18, 0.8)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, activeRadius - 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
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
          ctx.shadowBlur = energy > 0.5 ? 10 : 0;
          ctx.shadowColor = color;
          ctx.globalAlpha = p.alpha;
          
          ctx.beginPath();
          ctx.arc(p.x, p.y, pulseSize, 0, 2 * Math.PI);
          ctx.fill();
          
          ctx.globalAlpha = 1.0;
          ctx.shadowBlur = 0;
        });
      }
    }
    
    draw();
  }

  // --- DATA FETCHING & PARSING ---

  async function fetchSongData() {
    try {
      // Direct relative fetch of x.txt in root
      const res = await fetch('./x.txt');
      if (!res.ok) throw new Error('x.txt file not found in root. Make sure x.txt exists in the repository.');
      
      const content = await res.text();
      songs = parseSongTxt(content);
      
      if (songs.length === 0) {
        throw new Error('Parsed 0 songs. Format must be: (song direct url) - name - (song img url)');
      }
      
      // Load into context
      currentPlaylist = [...songs];
      playlistName = 'All Tracks';
      
      // Update UI views
      renderAllViews();
      
    } catch (e) {
      console.error(e);
      showLocalErrorNotice(e.message);
    }
  }

  function showLocalErrorNotice(errMsg) {
    el.tracksTableBody.innerHTML = `
      <tr>
        <td colspan="3" class="table-error-cell" style="text-align: center; padding: 40px; color: var(--text-muted);">
          <i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: #ffd200; margin-bottom: 12px; display: inline-block;"></i>
          <h3>Failed to load tracks</h3>
          <p style="font-size: 13px; margin: 8px 0 16px 0; max-width: 400px; display: inline-block;">${errMsg}</p>
          <br>
          <small>Create an <strong>x.txt</strong> file in your project directory with the layout: <code>url - name - cover_img</code></small>
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
      if (!line) return; // skip empty
      
      // Split by ' - ' safely
      const parts = line.split(/\s+-\s+/);
      if (parts.length >= 2) {
        const url = parts[0].trim();
        const rawName = parts[1].trim();
        const img = parts[2] ? parts[2].trim() : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&h=300&fit=crop';
        
        const metadata = parseTrackMetadata(rawName);
        
        parsed.push({
          id: `song_${idx}_${hashString(url)}`,
          url: url,
          fullName: rawName,
          title: metadata.title,
          artist: metadata.artist,
          img: img
        });
      }
    });
    
    return parsed;
  }

  function parseTrackMetadata(fullName) {
    const dashIdx = fullName.indexOf(' - ');
    if (dashIdx !== -1) {
      return {
        artist: fullName.substring(0, dashIdx).trim(),
        title: fullName.substring(dashIdx + 3).trim()
      };
    }
    
    const dashIdx2 = fullName.indexOf('-');
    if (dashIdx2 !== -1) {
      return {
        artist: fullName.substring(0, dashIdx2).trim(),
        title: fullName.substring(dashIdx2 + 1).trim()
      };
    }
    
    return {
      artist: 'Unknown Artist',
      title: fullName
    };
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  // --- UI RENDERING & ROUTING ---

  function renderAllViews() {
    const hour = new Date().getHours();
    let greet = 'Good Evening';
    if (hour < 12) greet = 'Good Morning';
    else if (hour < 18) greet = 'Good Afternoon';
    el.welcomeMessage.innerText = greet;
    
    renderQuickPicks();
    renderTracksTable();
    renderLikedTable();
    renderPlaylistsSidebar();
    updateRowVisualStates();
  }

  function renderQuickPicks() {
    el.quickPicksContainer.innerHTML = '';
    const sliceCount = Math.min(songs.length, 6);
    
    for (let i = 0; i < sliceCount; i++) {
      const track = songs[i];
      const card = document.createElement('div');
      card.className = 'quick-card';
      card.innerHTML = `
        <img src="${track.img}" alt="Cover" class="quick-card-img">
        <div class="quick-card-info">
          <div class="quick-card-title">${track.title}</div>
          <div class="quick-card-artist">${track.artist}</div>
        </div>
        <button class="quick-card-play-btn" title="Play">
          <i data-lucide="play" class="icon-fill"></i>
        </button>
      `;
      
      card.addEventListener('click', () => {
        currentPlaylist = [...songs];
        playlistName = 'All Tracks';
        
        const idx = songs.findIndex(s => s.id === track.id);
        playTrack(idx);
      });
      
      el.quickPicksContainer.appendChild(card);
    }
    lucide.createIcons();
  }

  function renderTracksTable() {
    el.tracksTableBody.innerHTML = '';
    el.trackCountText.innerText = `${songs.length} Tracks`;
    
    songs.forEach((track, index) => {
      const row = createTrackRow(track, index, 'all-tracks');
      el.tracksTableBody.appendChild(row);
    });
    
    lucide.createIcons();
  }

  function renderLikedTable() {
    el.likedTableBody.innerHTML = '';
    const likedTracks = songs.filter(s => likedSongIds.includes(s.id));
    
    el.likedSummary.innerText = `Your personal collection of ${likedTracks.length} favorite tracks.`;
    
    if (likedTracks.length === 0) {
      el.likedTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; padding: 40px; color: var(--text-subtle);">
            No liked songs yet. Click the heart icon on any song!
          </td>
        </tr>
      `;
      return;
    }
    
    likedTracks.forEach((track, index) => {
      const row = createTrackRow(track, index, 'liked-tracks');
      el.likedTableBody.appendChild(row);
    });
    lucide.createIcons();
  }

  function renderPlaylistTable(pid) {
    el.playlistTableBody.innerHTML = '';
    const pl = customPlaylists[pid];
    if (!pl) return;
    
    el.playlistViewTitle.innerText = pl.name;
    el.playlistViewDesc.innerText = pl.desc || 'A custom-curated selection.';
    
    const plTracks = songs.filter(s => pl.songIds.includes(s.id));
    
    if (plTracks.length === 0) {
      el.playlistTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; padding: 40px; color: var(--text-subtle);">
            This playlist is empty. Right-click any song to add it!
          </td>
        </tr>
      `;
      return;
    }
    
    plTracks.forEach((track, index) => {
      const row = createTrackRow(track, index, `playlist-${pid}`);
      el.playlistTableBody.appendChild(row);
    });
    lucide.createIcons();
  }

  function createTrackRow(track, index, contextId) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', track.id);
    tr.setAttribute('data-context', contextId);
    
    const isLiked = likedSongIds.includes(track.id);
    const likeClass = isLiked ? 'liked' : '';
    
    tr.innerHTML = `
      <td class="col-num">
        <div class="track-index-col">
          <span class="row-num">${index + 1}</span>
          <i data-lucide="play" class="row-play-icon icon-fill" size="14"></i>
        </div>
      </td>
      <td class="col-title">
        <div class="track-title-cell">
          <img src="${track.img}" alt="Cover" class="track-cell-img" loading="lazy">
          <div class="track-cell-info">
            <span class="track-cell-name">${track.title}</span>
            <span class="track-cell-artist">${track.artist}</span>
          </div>
        </div>
      </td>
      <td class="col-actions">
        <div class="track-cell-actions">
          <button class="btn-icon track-like-btn ${likeClass}" title="Like Song">
            <i data-lucide="heart" size="14"></i>
          </button>
          <button class="btn-icon btn-track-menu" title="More Options">
            <i data-lucide="more-horizontal" size="14"></i>
          </button>
        </div>
      </td>
    `;
    
    tr.addEventListener('click', (e) => {
      if (e.target.closest('.btn-icon') || e.target.closest('.context-menu')) return;
      playContextSong(track, contextId);
    });
    
    tr.querySelector('.track-like-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLikeTrack(track.id);
    });
    
    tr.querySelector('.btn-track-menu').addEventListener('click', (e) => {
      e.stopPropagation();
      openContextMenu(e, track);
    });
    
    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openContextMenu(e, track);
    });
    
    return tr;
  }

  function playContextSong(track, contextId) {
    if (contextId === 'all-tracks') {
      currentPlaylist = [...songs];
      playlistName = 'All Tracks';
    } else if (contextId === 'liked-tracks') {
      currentPlaylist = songs.filter(s => likedSongIds.includes(s.id));
      playlistName = 'Liked Songs';
    } else if (contextId.startsWith('playlist-')) {
      const pid = contextId.replace('playlist-', '');
      const pl = customPlaylists[pid];
      if (pl) {
        currentPlaylist = songs.filter(s => pl.songIds.includes(s.id));
        playlistName = `Playlist:${pid}`;
      }
    }
    
    const idx = currentPlaylist.findIndex(s => s.id === track.id);
    playTrack(idx);
  }

  function updateRowVisualStates() {
    const currentTrack = currentPlaylist[currentSongIndex];
    
    document.querySelectorAll('tr[data-id]').forEach(tr => {
      const trackId = tr.getAttribute('data-id');
      const isPlayingCurrent = currentTrack && trackId === currentTrack.id;
      
      tr.classList.toggle('playing', isPlayingCurrent);
      
      const rowNum = tr.querySelector('.row-num');
      const rowPlay = tr.querySelector('.row-play-icon');
      
      if (isPlayingCurrent) {
        rowNum.style.display = 'none';
        rowPlay.style.display = 'block';
        rowPlay.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
      } else {
        rowNum.style.display = 'block';
        rowPlay.style.display = 'none';
        rowPlay.setAttribute('data-lucide', 'play');
      }
    });
    
    lucide.createIcons();
  }

  function updatePlayerBarUI(track) {
    el.playerCoverArt.src = track.img;
    el.playerSongTitle.innerText = track.title;
    el.playerSongArtist.innerText = track.artist;
    
    const isLiked = likedSongIds.includes(track.id);
    el.btnPlayerLike.classList.toggle('liked', isLiked);
    
    el.visCoverArt.src = track.img;
    el.visTrackTitle.innerText = track.title;
    el.visTrackArtist.innerText = track.artist;
  }

  function updatePlayStateUI() {
    if (isPlaying) {
      el.playIconMain.setAttribute('data-lucide', 'pause');
      el.visCoverArt.style.animationPlayState = 'running';
    } else {
      el.playIconMain.setAttribute('data-lucide', 'play');
      el.visCoverArt.style.animationPlayState = 'paused';
    }
    lucide.createIcons();
    updateRowVisualStates();
  }

  // --- LIKES & PLAYLISTS MANAGEMENT ---

  function toggleLikeTrack(id) {
    const idx = likedSongIds.indexOf(id);
    if (idx === -1) {
      likedSongIds.push(id);
    } else {
      likedSongIds.splice(idx, 1);
    }
    
    localStorage.setItem('splays_likes', JSON.stringify(likedSongIds));
    renderLikedTable();
    
    const currentTrack = currentPlaylist[currentSongIndex];
    if (currentTrack && currentTrack.id === id) {
      el.btnPlayerLike.classList.toggle('liked', likedSongIds.includes(id));
    }
    
    document.querySelectorAll(`tr[data-id="${id}"] .track-like-btn`).forEach(btn => {
      btn.classList.toggle('liked', likedSongIds.includes(id));
    });
  }

  el.btnPlayerLike.addEventListener('click', () => {
    const track = currentPlaylist[currentSongIndex];
    if (track) {
      toggleLikeTrack(track.id);
    }
  });

  // Create playlist
  el.btnSavePlaylist.addEventListener('click', () => {
    const name = el.playlistNameInput.value.trim();
    const desc = el.playlistDescInput.value.trim();
    
    if (!name) return;
    
    const pid = `pl_${Date.now()}`;
    customPlaylists[pid] = {
      name: name,
      desc: desc,
      songIds: []
    };
    
    localStorage.setItem('splays_playlists', JSON.stringify(customPlaylists));
    
    el.playlistNameInput.value = '';
    el.playlistDescInput.value = '';
    closeModal(el.playlistModal);
    
    renderPlaylistsSidebar();
    showView(el.viewPlaylist);
    renderPlaylistTable(pid);
    playlistName = `Playlist:${pid}`;
  });

  function renderPlaylistsSidebar() {
    el.playlistList.innerHTML = '';
    
    Object.keys(customPlaylists).forEach(pid => {
      const pl = customPlaylists[pid];
      const li = document.createElement('li');
      li.className = 'playlist-item';
      li.setAttribute('data-pid', pid);
      li.innerText = pl.name;
      
      li.addEventListener('click', () => {
        document.querySelectorAll('.playlist-item').forEach(item => item.classList.remove('active'));
        li.classList.add('active');
        
        showView(el.viewPlaylist);
        renderPlaylistTable(pid);
        playlistName = `Playlist:${pid}`;
      });
      
      el.playlistList.appendChild(li);
    });
  }

  function addTrackToPlaylist(trackId, pid) {
    const pl = customPlaylists[pid];
    if (pl && !pl.songIds.includes(trackId)) {
      pl.songIds.push(trackId);
      localStorage.setItem('splays_playlists', JSON.stringify(customPlaylists));
      
      if (playlistName === `Playlist:${pid}`) {
        renderPlaylistTable(pid);
      }
    }
  }

  el.btnDeletePlaylist.addEventListener('click', () => {
    if (!playlistName.startsWith('Playlist:')) return;
    const pid = playlistName.split(':')[1];
    
    if (confirm('Are you sure you want to delete this playlist?')) {
      delete customPlaylists[pid];
      localStorage.setItem('splays_playlists', JSON.stringify(customPlaylists));
      
      renderPlaylistsSidebar();
      navigateToHome();
    }
  });

  // --- PLAY QUEUE MANAGEMENT ---

  function renderQueue() {
    el.queueListContainer.innerHTML = '';
    
    const curTrack = currentPlaylist[currentSongIndex];
    if (curTrack) {
      el.queueCurrentContainer.innerHTML = `
        <img src="${curTrack.img}" alt="Cover">
        <div class="queue-current-info">
          <div class="queue-current-title">${curTrack.title}</div>
          <div class="queue-current-artist">${curTrack.artist}</div>
        </div>
      `;
    } else {
      el.queueCurrentContainer.innerHTML = `<span style="font-size: 12px; color: var(--text-muted);">No track playing</span>`;
    }
    
    if (playQueue.length === 0) {
      el.queueListContainer.innerHTML = `<li style="font-size: 12px; color: var(--text-subtle); padding: 12px 0;">Queue is empty</li>`;
      return;
    }
    
    playQueue.forEach((track, index) => {
      const li = document.createElement('li');
      li.className = 'queue-item';
      li.innerHTML = `
        <img src="${track.img}" alt="Cover">
        <div class="queue-item-info">
          <div class="queue-item-title">${track.title}</div>
          <div class="queue-item-artist">${track.artist}</div>
        </div>
        <button class="btn-icon btn-remove-queue" title="Remove">
          <i data-lucide="x" size="14"></i>
        </button>
      `;
      
      li.addEventListener('click', (e) => {
        if (e.target.closest('.btn-remove-queue')) {
          playQueue.splice(index, 1);
          renderQueue();
          return;
        }
        
        playQueue.splice(index, 1);
        currentPlaylist.splice(currentSongIndex + 1, 0, track);
        playTrack(currentSongIndex + 1);
      });
      
      el.queueListContainer.appendChild(li);
    });
    
    lucide.createIcons();
  }

  el.btnClearQueue.addEventListener('click', () => {
    playQueue = [];
    renderQueue();
  });

  // --- CONTEXT MENU MANAGEMENT ---

  function openContextMenu(e, track) {
    e.preventDefault();
    
    const menu = el.trackContextMenu;
    menu.style.display = 'block';
    
    let posX = e.clientX;
    let posY = e.clientY;
    
    const menuWidth = 190;
    const menuHeight = 150;
    
    if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
    if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;
    
    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
    
    el.contextSubmenuPlaylists.innerHTML = '';
    const pKeys = Object.keys(customPlaylists);
    
    if (pKeys.length === 0) {
      el.contextSubmenuPlaylists.innerHTML = `<li class="submenu-item" style="color: var(--text-subtle);">No playlists</li>`;
    } else {
      pKeys.forEach(pid => {
        const pl = customPlaylists[pid];
        const li = document.createElement('li');
        li.className = 'submenu-item';
        li.innerText = pl.name;
        li.addEventListener('click', () => {
          addTrackToPlaylist(track.id, pid);
          menu.style.display = 'none';
        });
        el.contextSubmenuPlaylists.appendChild(li);
      });
    }
    
    el.menuPlayNow.onclick = () => {
      const row = document.querySelector(`tr[data-id="${track.id}"]`);
      const ctx = row ? row.getAttribute('data-context') : 'all-tracks';
      playContextSong(track, ctx);
      menu.style.display = 'none';
    };
    
    el.menuAddQueue.onclick = () => {
      playQueue.push(track);
      renderQueue();
      menu.style.display = 'none';
    };
    
    el.menuFavorite.onclick = () => {
      toggleLikeTrack(track.id);
      menu.style.display = 'none';
    };
  }

  document.addEventListener('click', () => {
    el.trackContextMenu.style.display = 'none';
  });

  // --- ROUTING / VIEW NAVIGATION ---

  function showView(viewElement) {
    el.viewHome.classList.remove('active-view');
    el.viewLiked.classList.remove('active-view');
    el.viewPlaylist.classList.remove('active-view');
    el.viewVisualizer.classList.remove('active-view');
    
    viewElement.classList.add('active-view');
    
    el.navHome.classList.remove('active');
    el.navLiked.classList.remove('active');
    el.navVisualizer.classList.remove('active');
    
    if (viewElement === el.viewHome) el.navHome.classList.add('active');
    else if (viewElement === el.viewLiked) el.navLiked.classList.add('active');
    else if (viewElement === el.viewVisualizer) el.navVisualizer.classList.add('active');
    
    el.contentScroll.scrollTop = 0;
  }

  function navigateToHome() {
    showView(el.viewHome);
    document.querySelectorAll('.playlist-item').forEach(item => item.classList.remove('active'));
  }

  el.navHome.addEventListener('click', navigateToHome);
  el.navLiked.addEventListener('click', () => {
    showView(el.viewLiked);
    document.querySelectorAll('.playlist-item').forEach(item => item.classList.remove('active'));
  });
  el.navVisualizer.addEventListener('click', () => showView(el.viewVisualizer));
  el.btnToggleVisualizer.addEventListener('click', () => showView(el.viewVisualizer));
  el.btnBannerVisualizer.addEventListener('click', () => showView(el.viewVisualizer));
  
  el.btnBannerPlay.addEventListener('click', () => {
    if (songs.length > 0) {
      currentPlaylist = [...songs];
      playlistName = 'All Tracks';
      playTrack(0);
    }
  });

  el.btnPlaylistPlay.addEventListener('click', () => {
    if (currentPlaylist.length > 0) {
      playTrack(0);
    }
  });
  
  el.btnLikedPlay.addEventListener('click', () => {
    const liked = songs.filter(s => likedSongIds.includes(s.id));
    if (liked.length > 0) {
      currentPlaylist = liked;
      playlistName = 'Liked Songs';
      playTrack(0);
    }
  });

  // --- MODALS ENGINE ---

  function openModal(modalEl) {
    modalEl.style.display = 'flex';
  }

  function closeModal(modalEl) {
    modalEl.style.display = 'none';
  }

  window.addEventListener('click', (e) => {
    if (e.target === el.playlistModal) closeModal(el.playlistModal);
  });

  // --- PLAYLIST MODAL ACTIONS ---
  el.btnCreatePlaylist.addEventListener('click', () => openModal(el.playlistModal));
  el.btnClosePlaylistModal.addEventListener('click', () => closeModal(el.playlistModal));
  el.btnCancelPlaylist.addEventListener('click', () => closeModal(el.playlistModal));

  // --- QUEUE DRAWER ACTIONS ---
  el.btnToggleQueue.addEventListener('click', () => {
    renderQueue();
    el.queueDrawer.style.display = 'block';
  });
  el.btnCloseQueue.addEventListener('click', () => {
    el.queueDrawer.style.display = 'none';
  });
  el.queueDrawer.addEventListener('click', (e) => {
    if (e.target === el.queueDrawer) el.queueDrawer.style.display = 'none';
  });

  // --- SEARCH ENGINE ---
  let searchTimeout = null;
  el.searchInput.addEventListener('input', () => {
    const val = el.searchInput.value.trim().toLowerCase();
    el.searchClear.style.display = val ? 'flex' : 'none';
    
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterTracks(val);
    }, 150);
  });

  el.searchClear.addEventListener('click', () => {
    el.searchInput.value = '';
    el.searchClear.style.display = 'none';
    filterTracks('');
  });

  function filterTracks(query) {
    const rows = el.tracksTableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
      const title = row.querySelector('.track-cell-name').innerText.toLowerCase();
      const artist = row.querySelector('.track-cell-artist').innerText.toLowerCase();
      
      if (title.includes(query) || artist.includes(query)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  // --- UTILITIES ---

  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  el.btnPlayPause.addEventListener('click', togglePlay);
  el.btnPrev.addEventListener('click', playPrev);
  el.btnNext.addEventListener('click', playNext);

  lucide.createIcons();

  // Load song list directly on page load
  fetchSongData();
});
