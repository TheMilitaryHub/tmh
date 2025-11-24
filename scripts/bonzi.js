(() => {
  const bonziSequence = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
    "Enter",
  ];

  let position = 0;
  let activated = false;

  const ensureStyles = () => {
    if (document.getElementById("bonzi-overlay-style")) return;
    const style = document.createElement("style");
    style.id = "bonzi-overlay-style";
    style.textContent = `
      .bonzi-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.8);
        z-index: 9999;
      }

      .bonzi-overlay video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    `;
    document.head.appendChild(style);
  };

  const triggerBonzi = () => {
    if (activated) return;
    activated = true;
    ensureStyles();

    const audio = new Audio("./styles/tts.wav");
    audio.volume = 1;
    audio.play().catch(() => {
    });

    setTimeout(() => {
      const overlay = document.createElement("div");
      overlay.className = "bonzi-overlay";

      const video = document.createElement("video");
      video.src = "./styles/video.mp4";
      video.autoplay = true;
      video.loop = false;
      video.controls = false;
      video.playsInline = true;
      video.volume = 1;

      overlay.appendChild(video);
      document.body.appendChild(overlay);

      const cleanup = () => {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      };

      video.addEventListener("ended", cleanup, { once: true });

      const playAttempt = video.play();
      if (playAttempt && typeof playAttempt.then === "function") {
        playAttempt
          .then(() => {
            if (document.fullscreenElement) return;
            const requestFullscreen = () => {
              if (typeof video.requestFullscreen === "function") {
                return video.requestFullscreen();
              }
              if (typeof overlay.requestFullscreen === "function") {
                return overlay.requestFullscreen();
              }
              return Promise.reject();
            };
            requestFullscreen().catch(() => {
            });
          })
          .catch(() => {
          });
      }
    }, 10000);
  };

  window.addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const expected = bonziSequence[position];

    if (key === expected) {
      position += 1;
      if (position === bonziSequence.length) {
        triggerBonzi();
        position = 0;
      }
    } else {
      position = key === bonziSequence[0] ? 1 : 0;
    }
  });
})();
