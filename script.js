document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.container');

  // Render all sections
  renderContent();

  // Set up lazy loading for images
  setupLazyLoading();

  // Set up video visibility handling
  setupVideoHandling();

  // Set up keyboard navigation
  setupKeyboardNavigation();
});

function renderContent() {
  const container = document.querySelector('.container');

  // Render cover section
  const coverHTML = `
    <section class="section cover">
      <h1 class="cover-title">${photoEssayData.title}</h1>
      <p class="cover-intro">${photoEssayData.intro}</p>
      <div class="scroll-indicator">Scroll</div>
    </section>
  `;
  container.innerHTML = coverHTML;

  // Render media sections
  photoEssayData.sections.forEach((section, sectionIndex) => {
    section.slides.forEach((slide, slideIndex) => {
      const isLastSlide = slide.isLast;
      const subtitle = slide.subtitle || section.subtitle;

      let mediaHTML;
      if (slide.type === 'video') {
        const ext = slide.media.split('.').pop().toLowerCase();
        const mimeType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
        mediaHTML = `
          <video autoplay muted loop playsinline>
            <source src="media/${slide.media}" type="${mimeType}">
          </video>
        `;
      } else {
        mediaHTML = `<img data-src="media/${slide.media}" alt="${section.title}">`;
      }

      const signatureHTML = isLastSlide ? `<div class="signature">${photoEssayData.signature}</div>` : '';

      const sectionHTML = `
        <section class="section media-section" data-index="${sectionIndex}-${slideIndex}">
          <div class="media-container">
            ${mediaHTML}
          </div>
          <div class="caption-container">
            <h2 class="caption-title">${section.title}</h2>
            <p class="caption-subtitle">${subtitle}</p>
            <span class="caption-location">${slide.location}</span>
            ${signatureHTML}
          </div>
        </section>
      `;

      container.innerHTML += sectionHTML;
    });
  });
}

function setupLazyLoading() {
  const images = document.querySelectorAll('img[data-src]');

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.onload = () => {
          img.classList.add('loaded');
        };
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: '100px 0px',
    threshold: 0.01
  });

  images.forEach(img => imageObserver.observe(img));
}

function setupVideoHandling() {
  const videos = document.querySelectorAll('video');

  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting) {
        video.play().catch(() => {
          // Autoplay may be blocked, that's okay
        });
      } else {
        video.pause();
      }
    });
  }, {
    threshold: 0.5
  });

  videos.forEach(video => videoObserver.observe(video));
}

function setupKeyboardNavigation() {
  const container = document.querySelector('.container');
  const sections = document.querySelectorAll('.section');
  let currentIndex = 0;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      if (currentIndex < sections.length - 1) {
        currentIndex++;
        sections[currentIndex].scrollIntoView({ behavior: 'smooth' });
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      if (currentIndex > 0) {
        currentIndex--;
        sections[currentIndex].scrollIntoView({ behavior: 'smooth' });
      }
    }
  });

  // Update current index on scroll
  const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        currentIndex = Array.from(sections).indexOf(entry.target);
      }
    });
  }, {
    threshold: 0.5
  });

  sections.forEach(section => scrollObserver.observe(section));
}
