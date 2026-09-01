// ==============================================================================
// 🎵 SAPATE HUB // ASTERION30 AUDIO STREAMER (Barra 02: Header Streamer Ticker)
// DevSecOps Hardened: No inline scripts, CSP compliant, youtube-nocookie.com host
// ==============================================================================

let player = null;
let isPlaying = false;
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
    btnPlay.addEventListener('click', () => {
      if (!player) return;
      if (isPlaying) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    });
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
        player.setShuffle(true);
      }
      if (typeof player.nextVideo === 'function') {
        player.nextVideo();
      }
    });
  }

  if (btnMute) {
    btnMute.addEventListener('click', () => {
      if (!player) return;
      if (player.isMuted()) {
        player.unMute();
        isMuted = false;
      } else {
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
      if (player && typeof player.setVolume === 'function') {
        player.setVolume(currentVolume);
        if (player.isMuted()) {
          player.unMute();
          isMuted = false;
        }
      }
      syncVolumeUI(currentVolume, isMuted);
    });
  }

  // 2. Registrar el callback de YouTube Iframe API antes de inyectar el script
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('youtube-audio-player', {
      height: '0',
      width: '0',
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        listType: 'playlist',
        list: PLAYLIST_ID,
        origin: window.location.origin,
        enablejsapi: 1,
        autoplay: 0,
        controls: 0,
        loop: 1,
        shuffle: 1,
        rel: 0
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange
      }
    });
  };

  // 3. Inyección dinámica del script de arranque de YouTube API
  if (!document.getElementById('yt-iframe-api-script')) {
    const scriptTag = document.createElement('script');
    scriptTag.id = 'yt-iframe-api-script';
    scriptTag.src = 'https://www.youtube.com/iframe_api';
    scriptTag.async = true;
    document.head.appendChild(scriptTag);
  }
}

function onPlayerReady(event) {
  if (player) {
    if (typeof player.setShuffle === 'function') {
      player.setShuffle(true);
    }
    if (typeof player.setVolume === 'function') {
      player.setVolume(currentVolume);
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
  }
}

function updateTrackInfo() {
  if (!player) return;
  try {
    const videoData = player.getVideoData();
    const title = videoData && videoData.title ? videoData.title : 'Asterion30 (Pista Aleatoria)';
    const trackLabel = document.getElementById('tickerTrackTitle');
    if (trackLabel) {
      trackLabel.textContent = 'Asterion30 — ' + title;
    }
  } catch (e) {
    // metadata fallback
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
