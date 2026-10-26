(() => {
  const versions = new URLSearchParams(window.location.search).getAll('q');
  const preview = document.getElementById('live-preview-template');
  if (versions.length === 1 && versions[0] === 'v1' && preview) {
    document.querySelector(".preview-wrap").replaceWith(preview.content.cloneNode(true));
    preview.remove();
    return;
  }

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
