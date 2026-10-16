// Hear the voices (listen.html): each voice gets one big Play button, a
// bar to see and move through the clip, and the time. One plays at a time.
// Without script, the page keeps each clip's own audio controls.
(() => {
  const PLAY = '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
  const PAUSE = '<svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h4v15H6zm8 0h4v15h-4z"/></svg>';
  const fmt = s => (isFinite(s) && s > 0) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00';
  let current = null;

  document.querySelectorAll('[data-voice]').forEach(row => {
    const audio = row.querySelector('audio');
    const name = row.querySelector('.who b').textContent;
    audio.removeAttribute('controls');
    audio.preload = 'metadata';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'play';
    btn.setAttribute('aria-label', `Play ${name}`);
    btn.innerHTML = PLAY + PAUSE;

    const meter = document.createElement('div');
    meter.className = 'meter';
    const track = document.createElement('input');
    track.type = 'range';
    track.min = 0; track.max = 1000; track.value = 0; track.step = 1;
    track.className = 'track';
    track.setAttribute('aria-label', `Place in ${name}'s reading`);
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = '0:00';
    meter.append(track, time);

    row.querySelector('.who').before(btn);
    row.querySelector('.who').after(meter);
    row.classList.add('enhanced');

    const paint = () => {
      const d = audio.duration;
      track.value = d ? Math.round(audio.currentTime / d * 1000) : 0;
      track.style.setProperty('--done', `${track.value / 10}%`);
      time.textContent = audio.currentTime > 0 ? `${fmt(audio.currentTime)} / ${fmt(d)}` : fmt(d);
    };

    btn.addEventListener('click', () => {
      if (audio.paused) {
        if (current && current !== audio) current.pause();
        current = audio;
        audio.play();
      } else {
        audio.pause();
      }
    });
    track.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = track.value / 1000 * audio.duration;
      paint();
    });
    audio.addEventListener('play', () => { row.classList.add('playing'); btn.setAttribute('aria-label', `Pause ${name}`); });
    audio.addEventListener('pause', () => { row.classList.remove('playing'); btn.setAttribute('aria-label', `Play ${name}`); });
    audio.addEventListener('ended', () => { audio.currentTime = 0; paint(); });
    audio.addEventListener('timeupdate', paint);
    audio.addEventListener('loadedmetadata', paint);
  });
})();
