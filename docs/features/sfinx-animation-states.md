# Sfinx Animation States

## State 1: Announcement (isArriving = true, showAnnouncement = true)

```
┌─────────────────────────────────────────────────────────────┐
│                      SCREEN CENTER                          │
│                                                             │
│                    ┌─────────────┐                          │
│                    │   Flex Row  │                          │
│                    │  (centered) │                          │
│                    │             │                          │
│        ┌───────────┴─────────────┴──────────┐               │
│        │                                    │               │
│        │  ┌──────────────────────────┐     │ ◄── Camera    │
│        │  │  AIInterviewerBox        │     │     (opacity-0│
│        │  │                           │     │      w-0)     │
│        │  │      ┌─────────┐         │     │               │
│        │  │      │  Sfinx  │         │     │               │
│        │  │      │ Avatar  │         │     │               │
│        │  │      │ (w-48)  │         │     │               │
│        │  │      └─────────┘         │     │               │
│        │  │                           │     │               │
│        │  │   (absolute centered)    │     │               │
│        │  └──────────────────────────┘     │               │
│        │                                    │               │
│        └────────────────────────────────────┘               │
│                                                             │
│               👋 Hi! Welcome to...                          │
│            (AnnouncementScreen text)                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key CSS:**
- Flex container: `justify-center` (centers AIInterviewerBox)
- Camera: `opacity-0 pointer-events-none w-0` (collapsed)
- Sfinx: `absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48`
- Result: Sfinx appears centered on screen

---

## State 2: Talking Mode (isArriving = false, mode = "talking" OR no intent)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│          ┌──────────────────────────────────────┐          │
│          │        Flex Row (gap-8)              │          │
│          │                                      │          │
│  ┌───────┴──────────────┐           ┌──────────┴────────┐ │
│  │ AIInterviewerBox     │           │  CameraPreview    │ │
│  │                      │           │                   │ │
│  │                      │           │   ┌───────────┐   │ │
│  │     ┌──────┐         │           │   │  Camera   │   │ │
│  │     │Sfinx │         │           │   │   Feed    │   │ │
│  │     │Avatar│         │           │   └───────────┘   │ │
│  │     │(w-40)│         │           │                   │ │
│  │     └──────┘         │           │                   │ │
│  │                      │           │                   │ │
│  │  (centered in box)   │           │   (opacity-100)   │ │
│  │                      │           │                   │ │
│  └──────────────────────┘           └───────────────────┘ │
│                                                             │
│              [Question Card Below]                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key CSS:**
- Flex container: `justify-center` with two visible children
- Camera: `opacity-100` (visible, full width)
- Sfinx: `absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40` (centered)
- Result: Both boxes side by side, Sfinx centered in left box

---

## State 3: Idle with Intent (mode = "idle" AND intent exists)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│          ┌──────────────────────────────────────┐          │
│          │        Flex Row (gap-8)              │          │
│          │                                      │          │
│  ┌───────┴──────────────┐           ┌──────────┴────────┐ │
│  │ AIInterviewerBox     │           │  CameraPreview    │ │
│  │               ┌────┐ │           │                   │ │
│  │               │Sfinx│ │           │   ┌───────────┐   │ │
│  │               │(w16)│ │           │   │  Camera   │   │ │
│  │               └────┘ │           │   │   Feed    │   │ │
│  │                      │           │   └───────────┘   │ │
│  │  I am listening for  │           │                   │ │
│  │  insights into your  │           │                   │ │
│  │  problem-solving...  │           │                   │ │
│  │  (Intent text)       │           │   (opacity-100)   │ │
│  │                      │           │                   │ │
│  └──────────────────────┘           └───────────────────┘ │
│                                                             │
│              [Question Card Below]                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key CSS:**
- Flex container: `justify-center` with two visible children
- Camera: `opacity-100` (visible, full width)
- Sfinx: `absolute top-4 right-4 w-16 h-16` (top-right corner)
- Intent text: visible with `animate-intent-fade-in`
- Result: Sfinx in corner, intent text visible below

---

## Transitions Between States

### State 1 → State 2 (Announcement ends, interview begins)
```
Changes:
- isArriving: true → false
- showAnnouncement: true → false
- Camera: w-0 opacity-0 → full-width opacity-100
- Sfinx: w-48 centered → w-40 centered
- AnnouncementScreen: visible → hidden
- Flex layout: centers single child → distributes two children with gap-8
```

**Problem**: Flex container shifts from centering one child to distributing two children side-by-side. This is a layout reflow, not a property change.

### State 2 → State 3 (AI finishes talking, shows intent)
```
Changes:
- mode: "talking" → "idle"
- intent: undefined → "I am listening for..."
- Sfinx: absolute center (w-40) → absolute top-right (w-16)
- Intent text: hidden → visible with fade-in
```

**Expected**: This SHOULD animate smoothly because both use `absolute` positioning within the same parent box. The `transition-all duration-[2000ms]` should interpolate the position/size change.

---

## Problem Analysis

### Why State 1 → State 2 transition is jittery:

1. **Flex layout reflow**: Container goes from 1 visible child (centered) to 2 children (side by side with gap-8)
2. **Parent box position changes**: AIInterviewerBox shifts left as flex distributes space
3. **Absolute child follows parent**: Sfinx uses `absolute` positioning relative to AIInterviewerBox, so when the box moves, Sfinx moves with it
4. **Instant reflow**: Flex layout changes happen immediately via browser reflow, not gradual CSS transitions

### Why duration change (800ms → 2000ms) had no effect:
The jitter is from State 1 → State 2 transition (flex reflow), not State 2 → State 3 (which should be smooth with absolute positioning).

---

## Possible Solutions

### Option 1: Fixed positioning with calculated offsets
- Keep Sfinx `position: fixed` throughout
- Calculate exact screen coordinates for both states
- Animate `top`/`left` values directly

### Option 2: Transform-based animation
- Keep layout the same (both boxes always visible)
- Use `transform: translateX()` to move AIInterviewerBox from center to left
- Fade camera in/out without width change

### Option 3: Framer Motion layoutId
- Use `<motion.div layoutId="sfinx">` to automatically animate between layouts
- Let framer-motion handle the position calculation

### Option 4: Manual JavaScript animation
- Capture start/end positions with `getBoundingClientRect()`
- Animate with `requestAnimationFrame` or framer-motion `animate()`
