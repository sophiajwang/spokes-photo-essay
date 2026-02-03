# Architectural Patterns

Patterns and design decisions used across the codebase.

## State Machine Navigation

Global state variables control navigation (`script.js:9-18`):
- `currentSectionIndex` - Visible section (-1 = cover, 0+ = media sections)
- `isTransitioning` - Animation lock prevents concurrent transitions
- `accumulatedDelta` - Wheel delta accumulator for threshold detection
- `hasTriggeredThisGesture` - One trigger per scroll gesture
- `sectionArrivalTime` - Timestamp for arrival cooldown (600ms)
- `scrollSnapPendingTime` - Timestamp for scroll-snap coordination (1000ms)

All navigation checks `isTransitioning` before proceeding (`script.js:139`, `296`).

## Scroll Delta Accumulation

Wheel events accumulate delta until crossing threshold (`script.js:148-177`):

1. Accumulate `e.deltaY` into `accumulatedDelta`
2. Reset via timeout after 150ms pause (`script.js:155-158`)
3. Trigger when `|accumulatedDelta| >= DELTA_THRESHOLD` (50px)
4. Set `hasTriggeredThisGesture` to prevent re-triggering

**Why**: Trackpads generate many small delta events. Accumulation ensures one gesture = one navigation.

## IntersectionObserver Usage

Two observers handle visibility-based behavior:

### Section Tracking (`script.js:229-246`)
- 50% visibility threshold
- Updates `currentSectionIndex` and `sectionArrivalTime`
- Resets scroll gesture state on section change

### Video Auto-Play (`script.js:428-439`)
- Module-scoped `videoObserver` for dynamic registration
- Plays when visible, pauses when hidden
- New videos registered in `transitionToSlide()` (`script.js:365-367`)

## Crossfade Animation

Media transitions use stacked elements with opacity (`script.js:313-391`):

1. Create new element with `opacity: 0`
2. Append after current (higher z-index via `.new-media`)
3. `requestAnimationFrame` then transition both:
   - Old: `opacity: 0` over 200ms
   - New: `opacity: 1` over 400ms
4. Remove old element after 450ms

CSS support (`styles.css:119-125`): `.active-media.new-media { z-index: 2; }`

## Data-Driven DOM Rendering

All UI generates from `photoEssayData` in `data.js`.

**Render function** (`script.js:20-116`):
- Iterates sections, generates HTML strings
- Stores data on elements: `el._sectionData = photoEssayData.sections[i]` (`script.js:113-115`)
- Preloads images in hidden container (`script.js:38-42`)

**Data access**: Read index from DOM (`dataset.currentSlide`), content from `_sectionData`.

## Hybrid Scroll-Snap Strategy

CSS scroll-snap for simple cases, JavaScript for complex:

**Decision** (`script.js:126-136`):
- Single-slide sections: Let CSS scroll-snap handle
- Multi-slide sections: `e.preventDefault()`, handle in JavaScript

**Coordination**: `scrollSnapPendingTime` blocks JS navigation during CSS scroll-snap.

## Cooldown Timing

Multiple mechanisms prevent navigation artifacts:

| Mechanism | Duration | Purpose |
|-----------|----------|---------|
| `wheelTimeout` | 150ms | Reset accumulator after gesture ends |
| `sectionArrivalTime` | 600ms | Ignore events after section arrival |
| `scrollSnapPendingTime` | 1000ms | Ignore during scroll-snap animation |
| `isTransitioning` | 700-800ms | Block during slide animation |

## Preloading Strategy

Images and videos preload in hidden containers (`script.js:38-42`, `66-75`):
- Images: `<img class="preload-image" data-slide-index="...">`
- Videos: `<video class="preload-video" data-slide-index="...">` (cloned on use)
- Hidden via CSS (`styles.css:244-251`): `opacity: 0; pointer-events: none`

## Event Delegation

Listeners attach to container, not individual elements:
- Wheel: `script.js:122`
- Touch: `script.js:184`, `189`
- Keyboard: `script.js:445`

Uses `data-*` attributes for element identification.

## Two-Phase Text Animation

Caption updates use separate fade-out/fade-in (`script.js:410-422`):
1. Add `fade-out-text` (200ms)
2. Update text content
3. Add `fade-in-text` (300ms)
