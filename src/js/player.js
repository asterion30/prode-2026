// ==============================================================================
// 🎵 SAPATE HUB // ASTERION30 AUDIO STREAMER (Barra 02: Header Streamer Ticker)
// DevSecOps Hardened: No inline scripts, CSP compliant, Mobile-Ready
// ==============================================================================

let player = null;
let isPlaying = false;
let isPlayerReady = false;
let pendingPlay = false;
let currentVolume = 80;
let isMuted = false;

// Uploads Playlist ID de Asterion30 (Canal: UCiA7Vm6_3q3c2CupeEC2G_Q -> Uploads: UUiA7Vm6_3q3c2CupeEC2G_Q)
const PLAYLIST_ID = 'UUiA7Vm6_3q3c2CupeEC2G_Q';

export function initAudioStreamer() {
  const tickerContainer = document.querySelector('.header-audio-ticker');
  if (!tickerContainer) return;

  // 1. Vincular eventos de UI
  const btnPrev = document.getElementById('btnTickerPrev');
  const btnPlay = document.getElementById('btnTickerPlay');
  const btnNext = document.getElementById('btnTickerNext');
  const btnShuffle = document.getElementById('btnTickerShuffle');
  const btnMute = document.getElementById('btnTickerMute');
  const volRange = document.getElementById('volRangeHeader');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (player && typeof player.previousVideo === 'function') {
        player.previousVideo();
      }
    });
  }

  if (btnPlay) {
    btnPlay.addEventListener('click', handlePlayClick);
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (player && typeof player.nextVideo === 'function') {
        player.nextVideo();
      }
    });
  }

  if (btnShuffle) {
    btnShuffle.addEventListener('click', () => {
      if (!player) return;
      if (typeof player.setShuffle === 'function') {
        try { player.setShuffle(true); } catch(e) {}
      }
      if (typeof player.nextVideo === 'function') {
        try { player.nextVideo(); } catch(e) {}
      }
    });
  }

  if (btnMute) {
    btnMute.addEventListener('click', () => {
      if (!player || !isPlayerReady) return;
      if (typeof player.isMuted === 'function' && player.isMuted()) {
        player.unMute();
        isMuted = false;
      } else if (typeof player.mute === 'function') {
        player.mute();
        isMuted = true;
      }
      syncVolumeUI(currentVolume, isMuted);
    });
  }

  if (volRange) {
    volRange.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      currentVolume = val;
      if (player && isPlayerReady && typeof player.setVolume === 'function') {
        player.setVolume(currentVolume);
        if (typeof player.isMuted === 'function' && player.isMuted()) {
          player.unMute();
          isMuted = false;
        }
      }
      syncVolumeUI(currentVolume, isMuted);
    });
  }

  // 2. Registrar el callback global de YouTube Iframe API
  window.onYouTubeIframeAPIReady = () => {
    try {
      player = new YT.Player('youtube-audio-player', {
        height: '200',
        width: '200',
        host: 'https://www.youtube.com',
        playerVars: {
          listType: 'playlist',
          list: PLAYLIST_ID,
          origin: window.location.origin,
          enablejsapi: 1,
          autoplay: 0,
          controls: 0,
          loop: 1,
          shuffle: 1,
          playsinline: 1,
          rel: 0
        },
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange,
          'onError': onPlayerError
        }
      });
    } catch (err) {
      console.warn('Error inicializando YouTube Player API:', err);
    }
  };

  // 3. Inyección dinámica del script de arranque de YouTube API si no existe
  if (!document.getElementById('yt-iframe-api-script')) {
    const scriptTag = document.createElement('script');
    scriptTag.id = 'yt-iframe-api-script';
    scriptTag.src = 'https://www.youtube.com/iframe_api';
    scriptTag.async = true;
    document.head.appendChild(scriptTag);
  }
}

function handlePlayClick() {
  if (!player || !isPlayerReady) {
    pendingPlay = true;
    const trackLabel = document.getElementById('tickerTrackTitle');
    if (trackLabel) {
      trackLabel.textContent = 'Asterion30 — Conectando audio...';
    }
    return;
  }

  if (isPlaying) {
    if (typeof player.pauseVideo === 'function') {
      player.pauseVideo();
    }
  } else {
    try {
      const state = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
      if (state === -1 || state === 5 || state === 0) {
        if (typeof player.playVideo === 'function') {
          player.playVideo();
        }
      } else {
        if (typeof player.playVideo === 'function') {
          player.playVideo();
        }
      }
    } catch (e) {
      console.warn('Error al iniciar reproducción:', e);
    }
  }
}

function onPlayerReady(event) {
  isPlayerReady = true;
  if (player) {
    if (typeof player.setShuffle === 'function') {
      try { player.setShuffle(true); } catch (e) {}
    }
    if (typeof player.setVolume === 'function') {
      try { player.setVolume(currentVolume); } catch (e) {}
    }
    if (pendingPlay) {
      pendingPlay = false;
      handlePlayClick();
    }
  }
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    updateUIState(true);
    updateTrackInfo();
  } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
    isPlaying = false;
    updateUIState(false);
  } else if (event.data === YT.PlayerState.BUFFERING) {
    updateTrackInfo();
  }
}

function onPlayerError(event) {
  console.warn('YouTube Player Event Error Code:', event.data);
  // Si una pista no está disponible o tiene restricción de inserción en mobile, avanzar a la siguiente
  if (player && typeof player.nextVideo === 'function') {
    setTimeout(() => {
      try { player.nextVideo(); } catch (e) {}
    }, 500);
  }
}

function updateTrackInfo() {
  if (!player) return;
  try {
    const videoData = typeof player.getVideoData === 'function' ? player.getVideoData() : null;
    const title = videoData && videoData.title ? videoData.title : 'Audio Matrix Activo';
    const trackLabel = document.getElementById('tickerTrackTitle');
    if (trackLabel) {
      trackLabel.textContent = 'Asterion30 — ' + title;
    }
  } catch (e) {
    // fallback
  }
}

function updateUIState(playing) {
  const iconPlay = document.getElementById('iconTickerPlay');
  const labelPlay = document.getElementById('labelTickerPlay');
  const eqBars = document.querySelectorAll('.header-audio-ticker .eq-bar');

  if (playing) {
    if (iconPlay) iconPlay.className = 'ph-bold ph-pause';
    if (labelPlay) labelPlay.textContent = 'PAUSA';
    eqBars.forEach(bar => { bar.style.animationPlayState = 'running'; });
  } else {
    if (iconPlay) iconPlay.className = 'ph-bold ph-play';
    if (labelPlay) labelPlay.textContent = 'PLAY';
    eqBars.forEach(bar => { bar.style.animationPlayState = 'paused'; });
  }
}

function syncVolumeUI(val, muted) {
  const volRange = document.getElementById('volRangeHeader');
  const volVal = document.getElementById('volValHeader');
  const iconVol = document.getElementById('iconVolHeader');

  if (volRange) volRange.value = val;
  if (volVal) volVal.textContent = muted ? 'MUTE' : val + '%';
  if (iconVol) {
    iconVol.className = muted
      ? 'ph-bold ph-speaker-slash'
      : (val < 40 ? 'ph-bold ph-speaker-low' : 'ph-bold ph-speaker-high');
  }
}

// Inicializar al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAudioStreamer);
} else {
  initAudioStreamer();
}
