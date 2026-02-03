# Spokes Photo Essay

Interactive photo/video essay documenting a 75-day cycling journey across America with STEM education workshops.

## Tech Stack

- **Vanilla HTML5/CSS3/ES6+** - No frameworks or dependencies
- **CSS Scroll Snap** - Native browser section navigation
- **IntersectionObserver** - Section/video visibility tracking
- **Static Site** - No build process, runs directly in browser

## Project Structure

```
spokes-photo-essay/
├── index.html      # Entry point (minimal - single container div)
├── script.js       # Application logic (~540 lines)
├── styles.css      # Responsive styling (~350 lines)
├── data.js         # Content data structure
└── media/          # Images & videos (~65 files)
```

## Key Files

### data.js

Content configuration with structure:

```javascript
photoEssayData = {
  title, intro, signature,
  sections: [{
    title, subtitle,
    slides: [{ media, type?, subtitle?, location }]
  }]
}
```

Media files referenced by filename only (e.g., `"photo.jpg"` resolves to `media/photo.jpg`).

### script.js

| Function | Line | Purpose |
|----------|------|---------|
| `renderContent()` | 20 | Generates DOM from data.js |
| `setupSequenceScrolling()` | 118 | Wheel/touch navigation |
| `scrollToAdjacentSection()` | 249 | Section-to-section navigation |
| `transitionToSlide()` | 295 | Crossfade between slides |
| `fadeText()` | 410 | Caption text animation |
| `setupVideoHandling()` | 424 | Video auto-play/pause |
| `setupKeyboardNavigation()` | 442 | Arrow keys & spacebar |
| `setupSignatureReveal()` | 477 | End-of-essay signature reveal |

State variables (`script.js:9-18`):
- `currentSectionIndex` - Which section is visible
- `isTransitioning` - Animation lock
- `accumulatedDelta` / `hasTriggeredThisGesture` - Scroll gesture handling

### styles.css

| Section | Lines | Purpose |
|---------|-------|---------|
| Scroll container | 16-22 | CSS scroll-snap configuration |
| Media section | 84-126 | 70/30 media-to-caption split |
| Crossfade support | 119-125 | z-index for media transitions |
| Mobile responsive | 254-311 | Stacked layout for <768px |

## Development

Open `index.html` in a browser. No build or install steps required.

**Testing changes:**
1. Edit files
2. Refresh browser
3. Test on mobile viewport (DevTools) for responsive behavior

## Navigation Flow

1. **Cover section** (index -1) - Title and intro
2. **Media sections** (index 0+) - Each may have multiple slides
3. **Single-slide sections** - CSS scroll-snap handles navigation
4. **Multi-slide sections** - JavaScript handles within-section slides

Users can navigate via: scroll wheel, touch swipe, arrow keys, or spacebar.

## Adding Content

1. Add media files to `media/` directory
2. Update `data.js` with new section/slide entries
3. For videos, include `type: "video"` in slide object

## Additional Documentation

- [Architectural Patterns](.claude/docs/architectural_patterns.md) - State machine, scroll accumulation, crossfade animations, and other patterns used throughout the codebase
