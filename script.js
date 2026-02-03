document.addEventListener('DOMContentLoaded', () => {
  renderContent();
  setupSequenceScrolling();
  setupVideoHandling();
  setupKeyboardNavigation();
  setupSignatureReveal();
});

// Track current state
let currentSectionIndex = -1; // Start on cover
let isTransitioning = false;
let accumulatedDelta = 0;
let wheelTimeout = null;
let hasTriggeredThisGesture = false;
let sectionArrivalTime = 0; // Timestamp when we arrived at current section
let scrollSnapPendingTime = 0; // Timestamp when scroll-snap navigation started
let slideTransitionEndTime = 0; // Timestamp when slide transition completed (for momentum cooldown)
let videoObserver = null; // Global reference for registering dynamically created videos
const DELTA_THRESHOLD = 50; // Accumulated delta needed to trigger transition

function renderContent() {
  const container = document.querySelector('.container');

  // Render cover section
  const coverHTML = `
    <section class="section cover" data-section-index="-1">
      <h1 class="cover-title">${photoEssayData.title}</h1>
      <p class="cover-intro">${photoEssayData.intro}</p>
      <div class="scroll-indicator">Scroll</div>
    </section>
  `;
  container.innerHTML = coverHTML;

  // Render one section per title group
  photoEssayData.sections.forEach((section, sectionIndex) => {
    const firstSlide = section.slides[0];
    const hasMultipleSlides = section.slides.length > 1;

    // Preload all images in this section
    const preloadHTML = section.slides.map((slide, i) => {
      if (slide.type === 'video') return '';
      return `<img class="preload-image" data-slide-index="${i}" src="media/${slide.media}" alt="${section.title}">`;
    }).join('');

    // Create dots if multiple slides
    const dotsHTML = hasMultipleSlides ? `
      <div class="progress-dots">
        ${section.slides.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('')}
      </div>
    ` : '';

    // Media HTML for first slide
    let mediaHTML;
    if (firstSlide.type === 'video') {
      const ext = firstSlide.media.split('.').pop().toLowerCase();
      const mimeType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
      mediaHTML = `
        <video class="active-media" autoplay muted loop playsinline>
          <source src="media/${firstSlide.media}" type="${mimeType}">
        </video>
      `;
    } else {
      mediaHTML = `<img class="active-media loaded" src="media/${firstSlide.media}" alt="${section.title}">`;
    }

    // Video elements for slides that are videos (hidden initially)
    const videoElements = section.slides.map((slide, i) => {
      if (slide.type !== 'video' || i === 0) return '';
      const ext = slide.media.split('.').pop().toLowerCase();
      const mimeType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
      return `
        <video class="preload-video" data-slide-index="${i}" muted loop playsinline>
          <source src="media/${slide.media}" type="${mimeType}">
        </video>
      `;
    }).join('');

    const isLastSection = sectionIndex === photoEssayData.sections.length - 1;
    const signatureHTML = isLastSection ? `
      <div class="signature hidden">
        <span class="signature-yours">Yours,</span>
        <span class="signature-name">${photoEssayData.signature.replace('Yours, ', '')}</span>
      </div>
    ` : '';

    const sectionHTML = `
      <section class="section media-section"
               data-section-index="${sectionIndex}"
               data-slide-count="${section.slides.length}"
               data-current-slide="0">
        <div class="media-container">
          <div class="media-wrapper">
            ${mediaHTML}
            <div class="preload-container" style="display:none;">
              ${preloadHTML}
              ${videoElements}
            </div>
          </div>
          ${dotsHTML}
        </div>
        <div class="caption-container">
          <h2 class="caption-title">${section.title}</h2>
          <p class="caption-subtitle">${firstSlide.subtitle || section.subtitle}</p>
          <span class="caption-location">${firstSlide.location}</span>
          ${signatureHTML}
        </div>
      </section>
    `;

    container.innerHTML += sectionHTML;
  });

  // Store section data on elements for easy access
  document.querySelectorAll('.media-section').forEach((el, i) => {
    el._sectionData = photoEssayData.sections[i];
  });
}

function setupSequenceScrolling() {
  const container = document.querySelector('.container');

  // Handle wheel events with accumulation
  container.addEventListener('wheel', (e) => {
    const currentSection = document.querySelector(`.media-section[data-section-index="${currentSectionIndex}"]`);
    if (!currentSection) return;

    const slideCount = parseInt(currentSection.dataset.slideCount);

    // Single-slide sections: let normal scroll-snap handle it
    if (slideCount <= 1) {
      // Mark that scroll-snap is about to handle navigation
      scrollSnapPendingTime = Date.now();
      return;
    }

    // Multi-slide section: ALWAYS prevent default to stop scroll-snap
    e.preventDefault();

    // Don't process if transitioning
    if (isTransitioning) return;

    // Ignore wheel events briefly after arriving at a new section, after scroll-snap, or after slide transition
    const now = Date.now();
    if (now - sectionArrivalTime < 600) return;
    if (now - scrollSnapPendingTime < 1000) return;
    if (now - slideTransitionEndTime < 400) return;

    const currentSlide = parseInt(currentSection.dataset.currentSlide);

    // Accumulate delta
    accumulatedDelta += e.deltaY;

    // Clear previous timeout
    if (wheelTimeout) clearTimeout(wheelTimeout);

    // Reset accumulator and gesture flag after pause in scrolling
    wheelTimeout = setTimeout(() => {
      accumulatedDelta = 0;
      hasTriggeredThisGesture = false;
    }, 150);

    // Check if we've accumulated enough to trigger
    if (Math.abs(accumulatedDelta) >= DELTA_THRESHOLD) {
      if (hasTriggeredThisGesture) return; // Already triggered this gesture

      hasTriggeredThisGesture = true;
      const direction = accumulatedDelta > 0 ? 1 : -1;
      accumulatedDelta = 0;

      // Check if scrolling back from visible signature - hide it first
      const lastSectionIndex = photoEssayData.sections.length - 1;
      if (currentSectionIndex === lastSectionIndex && direction === -1) {
        const signature = currentSection.querySelector('.signature');
        if (signature && signature.classList.contains('visible')) {
          signature.classList.remove('visible');
          signature.classList.add('hidden');
          // Reset gesture flag after short delay so user can continue scrolling
          setTimeout(() => {
            hasTriggeredThisGesture = false;
            accumulatedDelta = 0;
          }, 300);
          return;
        }
      }

      const nextSlide = currentSlide + direction;

      if (nextSlide >= 0 && nextSlide < slideCount) {
        // Move within sequence
        transitionToSlide(currentSection, nextSlide);
      } else {
        // At edge of sequence - programmatically scroll to next/prev section
        scrollToAdjacentSection(direction);
      }
    }
  }, { passive: false });

  // Handle touch events for mobile
  let touchStartY = 0;
  let touchHandled = false;

  container.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchHandled = false;
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    const currentSection = document.querySelector(`.media-section[data-section-index="${currentSectionIndex}"]`);
    if (!currentSection) return;

    const slideCount = parseInt(currentSection.dataset.slideCount);
    if (slideCount <= 1) {
      scrollSnapPendingTime = Date.now();
      return;
    }

    // Multi-slide section: prevent default
    e.preventDefault();

    if (isTransitioning || touchHandled) return;

    // Ignore touch events briefly after arriving at a new section, after scroll-snap, or after slide transition
    const now = Date.now();
    if (now - sectionArrivalTime < 600) return;
    if (now - scrollSnapPendingTime < 1000) return;
    if (now - slideTransitionEndTime < 400) return;

    const touchY = e.touches[0].clientY;
    const deltaY = touchStartY - touchY;

    if (Math.abs(deltaY) < 50) return;

    const currentSlide = parseInt(currentSection.dataset.currentSlide);
    const direction = deltaY > 0 ? 1 : -1;

    touchHandled = true;
    touchStartY = touchY;

    // Check if scrolling back from visible signature - hide it first
    const lastSectionIndex = photoEssayData.sections.length - 1;
    if (currentSectionIndex === lastSectionIndex && direction === -1) {
      const signature = currentSection.querySelector('.signature');
      if (signature && signature.classList.contains('visible')) {
        signature.classList.remove('visible');
        signature.classList.add('hidden');
        // Reset touch flag after short delay so user can continue swiping
        setTimeout(() => {
          touchHandled = false;
        }, 300);
        return;
      }
    }

    const nextSlide = currentSlide + direction;

    if (nextSlide >= 0 && nextSlide < slideCount) {
      transitionToSlide(currentSection, nextSlide);
    } else {
      scrollToAdjacentSection(direction);
    }
  }, { passive: false });

  // Track which section is visible
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
        const index = parseInt(entry.target.dataset.sectionIndex);
        if (index !== currentSectionIndex) {
          currentSectionIndex = index; // Track all sections including cover (-1)
          sectionArrivalTime = Date.now(); // Record when we arrived at this section
          // Reset scroll gesture state to prevent carryover from previous section
          accumulatedDelta = 0;
          hasTriggeredThisGesture = false;
        }
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.section').forEach(section => {
    observer.observe(section);
  });
}

function scrollToAdjacentSection(direction) {
  const sections = document.querySelectorAll('.section');
  const allSections = Array.from(sections);

  // Find current section in the list
  let currentIdx = 0;
  allSections.forEach((s, i) => {
    const idx = parseInt(s.dataset.sectionIndex);
    if (idx === currentSectionIndex) {
      currentIdx = i;
    }
  });

  const targetIdx = currentIdx + direction;
  if (targetIdx >= 0 && targetIdx < allSections.length) {
    isTransitioning = true;
    scrollSnapPendingTime = Date.now(); // Block events during and after this transition
    allSections[targetIdx].scrollIntoView({ behavior: 'smooth' });

    // Reset transition flag after scroll completes
    setTimeout(() => {
      isTransitioning = false;
      hasTriggeredThisGesture = false;
      accumulatedDelta = 0;
      // Refresh the arrival time to ensure cooldown starts from when transition completes
      sectionArrivalTime = Date.now();
    }, 800);
  } else {
    // At the very beginning or end - reset gesture state so user can scroll the other direction
    hasTriggeredThisGesture = false;
    accumulatedDelta = 0;
  }
}

function updateCurrentSectionIndex() {
  const sections = document.querySelectorAll('.media-section');
  const viewportCenter = window.innerHeight / 2;

  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    if (rect.top <= viewportCenter && rect.bottom >= viewportCenter) {
      currentSectionIndex = parseInt(section.dataset.sectionIndex);
    }
  });
}

function transitionToSlide(sectionEl, slideIndex) {
  if (isTransitioning) return;
  isTransitioning = true;

  const sectionData = sectionEl._sectionData;
  const currentSlideIdx = parseInt(sectionEl.dataset.currentSlide);
  const slide = sectionData.slides[slideIndex];
  const prevSlide = sectionData.slides[currentSlideIdx];

  // Update data attribute
  sectionEl.dataset.currentSlide = slideIndex;

  // Update dots
  const dots = sectionEl.querySelectorAll('.dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === slideIndex);
  });

  // Crossfade media
  const mediaWrapper = sectionEl.querySelector('.media-wrapper');
  const currentMedia = mediaWrapper.querySelector('.active-media');

  let newMedia;
  if (slide.type === 'video') {
    // Check for preloaded video first (for slides 1+)
    const preloadVideo = sectionEl.querySelector(`.preload-video[data-slide-index="${slideIndex}"]`);
    if (preloadVideo) {
      newMedia = preloadVideo.cloneNode(true);
      newMedia.classList.remove('preload-video');
    } else {
      // For slide 0 or if preload doesn't exist, create video element
      const ext = slide.media.split('.').pop().toLowerCase();
      const mimeType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
      newMedia = document.createElement('video');
      newMedia.muted = true;
      newMedia.loop = true;
      newMedia.playsInline = true;
      newMedia.innerHTML = `<source src="media/${slide.media}" type="${mimeType}">`;
    }
    newMedia.classList.add('active-media', 'new-media');
    newMedia.style.opacity = '0';
  } else {
    const preloadImg = sectionEl.querySelector(`.preload-image[data-slide-index="${slideIndex}"]`);
    newMedia = document.createElement('img');
    newMedia.src = preloadImg ? preloadImg.src : `media/${slide.media}`;
    newMedia.alt = sectionData.title;
    newMedia.classList.add('active-media', 'new-media', 'loaded');
    newMedia.style.opacity = '0';
  }

  if (newMedia) {
    // Insert new media AFTER current (on top in stacking)
    mediaWrapper.appendChild(newMedia);

    // Force reflow then fade in new media
    newMedia.offsetHeight;
    requestAnimationFrame(() => {
      // Fade out old media quickly while new fades in - prevents edges showing with different aspect ratios
      // but avoids harsh flash by having a brief overlap
      if (currentMedia) {
        currentMedia.style.transition = 'opacity 0.2s ease';
        currentMedia.style.opacity = '0';
      }

      newMedia.style.transition = 'opacity 0.4s ease';
      newMedia.style.opacity = '1';

      if (slide.type === 'video') {
        newMedia.play().catch(() => {});
        // Register dynamically created video with observer so it auto-plays/pauses on visibility
        if (videoObserver) {
          videoObserver.observe(newMedia);
        }
      }
    });

    // Clean up after transition (visual transition is 400ms,
    // but keep blocking longer to prevent multi-trigger from one gesture)
    setTimeout(() => {
      if (currentMedia && currentMedia.parentNode) {
        if (currentMedia.tagName === 'VIDEO') {
          currentMedia.pause();
        }
        currentMedia.remove();
      }
      newMedia.classList.remove('new-media');
      newMedia.style.transition = '';
    }, 450);

    // Release the transition lock and reset gesture state to prevent momentum carryover
    setTimeout(() => {
      isTransitioning = false;
      accumulatedDelta = 0;
      hasTriggeredThisGesture = false;
      slideTransitionEndTime = Date.now();
    }, 700);
  } else {
    isTransitioning = false;
  }

  // Update caption text with fade if changed
  const subtitleEl = sectionEl.querySelector('.caption-subtitle');
  const locationEl = sectionEl.querySelector('.caption-location');

  const newSubtitle = slide.subtitle || sectionData.subtitle;
  const oldSubtitle = prevSlide.subtitle || sectionData.subtitle;

  // Only animate subtitle if it changed
  if (newSubtitle !== oldSubtitle) {
    fadeText(subtitleEl, newSubtitle);
  }

  // Only animate location if it changed
  if (slide.location !== prevSlide.location) {
    fadeText(locationEl, slide.location);
  }
}

function fadeText(element, newText) {
  element.classList.add('fade-out-text');

  setTimeout(() => {
    element.textContent = newText;
    element.classList.remove('fade-out-text');
    element.classList.add('fade-in-text');

    setTimeout(() => {
      element.classList.remove('fade-in-text');
    }, 300);
  }, 200);
}

function setupVideoHandling() {
  const videos = document.querySelectorAll('video.active-media');

  // Store observer at module scope so transitionToSlide() can register new videos
  videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, { threshold: 0.5 });

  videos.forEach(video => videoObserver.observe(video));
}

function setupKeyboardNavigation() {
  const container = document.querySelector('.container');

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      navigateDirection(1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateDirection(-1);
    }
  });
}

function navigateDirection(direction) {
  if (isTransitioning) return;

  const currentSection = document.querySelector(`.media-section[data-section-index="${currentSectionIndex}"]`);

  if (currentSection) {
    const slideCount = parseInt(currentSection.dataset.slideCount);
    const currentSlide = parseInt(currentSection.dataset.currentSlide);
    const nextSlide = currentSlide + direction;

    // Try to move within sequence first
    if (slideCount > 1 && nextSlide >= 0 && nextSlide < slideCount) {
      transitionToSlide(currentSection, nextSlide);
      return;
    }
  }

  // Move to next/prev section
  scrollToAdjacentSection(direction);
}

function setupSignatureReveal() {
  const container = document.querySelector('.container');
  const lastSectionIndex = photoEssayData.sections.length - 1;
  const lastSection = document.querySelector(`.media-section[data-section-index="${lastSectionIndex}"]`);

  if (!lastSection) return;

  const signature = lastSection.querySelector('.signature');
  if (!signature) return;

  const sectionData = lastSection._sectionData;
  const lastSlideIndex = sectionData.slides.length - 1;

  // Track accumulated scroll for signature reveal (requires deliberate gesture)
  let signatureAccumulatedDelta = 0;
  let signatureWheelTimeout = null;

  // Reveal signature when user makes a deliberate scroll past the last slide
  container.addEventListener('wheel', (e) => {
    if (currentSectionIndex !== lastSectionIndex) return;

    const currentSlide = parseInt(lastSection.dataset.currentSlide);
    const isOnLastSlide = currentSlide === lastSlideIndex;

    if (!isOnLastSlide) {
      signatureAccumulatedDelta = 0;
      return;
    }

    // Ignore events during/after slide transition to prevent momentum carryover
    const now = Date.now();
    if (now - slideTransitionEndTime < 500) {
      signatureAccumulatedDelta = 0;
      return;
    }

    // Only accumulate downward scrolls
    if (e.deltaY > 0) {
      signatureAccumulatedDelta += e.deltaY;
    }

    // Reset accumulator after pause in scrolling
    if (signatureWheelTimeout) clearTimeout(signatureWheelTimeout);
    signatureWheelTimeout = setTimeout(() => {
      signatureAccumulatedDelta = 0;
    }, 150);

    // Require threshold before revealing (same as slide navigation)
    if (signatureAccumulatedDelta >= DELTA_THRESHOLD) {
      signature.classList.remove('hidden');
      signature.classList.add('visible');
    }
  }, { passive: true });

  // Also handle touch
  let lastTouchY = 0;
  container.addEventListener('touchstart', (e) => {
    lastTouchY = e.touches[0].clientY;
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (currentSectionIndex !== lastSectionIndex) return;

    const currentSlide = parseInt(lastSection.dataset.currentSlide);
    const isOnLastSlide = currentSlide === lastSlideIndex;

    if (!isOnLastSlide) return;

    // Ignore events during/after slide transition to prevent momentum carryover
    const now = Date.now();
    if (now - slideTransitionEndTime < 500) return;

    const deltaY = lastTouchY - e.touches[0].clientY;

    // If swiping up (scrolling down) with enough force, show signature
    if (deltaY > 50) {
      signature.classList.remove('hidden');
      signature.classList.add('visible');
    }
  }, { passive: true });

  // Hide signature when navigating away from last slide
  const observer = new MutationObserver(() => {
    const currentSlide = parseInt(lastSection.dataset.currentSlide);
    const isOnLastSlide = currentSlide === lastSlideIndex;

    if (!isOnLastSlide) {
      signature.classList.remove('visible');
      signature.classList.add('hidden');
    }
  });

  observer.observe(lastSection, { attributes: true, attributeFilter: ['data-current-slide'] });
}
