(() => {
  const versions = new URLSearchParams(window.location.search).getAll('q');
  const showVideo = versions.length === 1 && versions[0] === 'video';
  const template = document.getElementById(showVideo ? 'video-preview-template' : 'live-preview-template');
  document.getElementById('homepage-preview').replaceWith(template.content.cloneNode(true));
  document.getElementById('video-preview-template').remove();
  document.getElementById('live-preview-template').remove();
  if (!showVideo) return;

  const video = document.querySelector('.app-recording');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true;

  function updatePlayback() {
    if (motion.matches || document.hidden || !visible) {
      video.pause();
      if (motion.matches && video.currentTime !== 0) video.currentTime = 0;
    } else {
      // A blocked autoplay leaves the opening frame/poster visible.
      video.play().catch(() => {});
    }
  }

  motion.addEventListener('change', updatePlayback);
  document.addEventListener('visibilitychange', updatePlayback);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updatePlayback();
    }).observe(video);
  }
  updatePlayback();
})();
