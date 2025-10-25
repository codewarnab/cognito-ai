<!-- b20af403-cf07-450e-9eee-85468113fb80 68767220-06e0-425b-a954-2b7438028916 -->
# Implement Onboarding Button Animations & Multi-Page Flow

## Overview

Add beautiful button animations from survey_interaction to OnboardingScreen.tsx, implementing a 4-page onboarding carousel with width-expanding navigation buttons and smooth transitions. All Tailwind CSS will be converted to standard CSS.

## Key Changes

### 1. Update OnboardingScreen Component

**File:** `src/components/OnboardingScreen.tsx`

- Add state management for multi-page navigation (4 pages total)
- Implement page/direction state for AnimatePresence transitions
- Replace ChevronLeft/ChevronRight with ArrowLeft/ArrowRight from lucide-react
- Add animated button container with width expansion logic:
- Page 0: Single "Next" button (full width)
- Pages 1-2: Two buttons "Back" + "Next" (50% width each)
- Page 3: Two buttons "Back" + "Done" (50% width each)
- Implement page content switching with slide animations
- Update progress indicators to reflect current page (1/4, 2/4, 3/4, 4/4)

### 2. Create Onboarding Page Components

**New files:** `src/components/onboarding/` directory

Create 4 page components with placeholder content:

- `WelcomePage.tsx` - Current welcome content (page 0)
- `FeaturesPage.tsx` - Autonomous browsing capabilities (page 1)
- `CapabilitiesPage.tsx` - MCP integration & memory features (page 2)
- `GetStartedPage.tsx` - Quick start guide (page 3)

### 3. Convert Button Animations to CSS

**File:** `src/styles/onboarding.css`

Add new CSS classes converting Tailwind styles:

- `.onboarding-button-container` - Fixed height container for layout animations
- `.onboarding-button-wrapper` - Animated wrapper with width transitions
- `.onboarding-button-wrapper--single` - Full width (100%)
- `.onboarding-button-wrapper--split` - Half width (50%)
- `.onboarding-button` - Base button styles
- `.onboarding-button--primary` - Primary button (black bg, white text)
- `.onboarding-button--secondary` - Secondary button (gray bg)
- `.onboarding-button:disabled` - Disabled state
- `.onboarding-button-icon` - Icon wrapper with hover transforms
- `.onboarding-button-icon--left` - Left arrow hover effect (translateX(-4px))
- `.onboarding-button-icon--right` - Right arrow hover effect (translateX(4px))
- `.onboarding-page-content` - Page content wrapper for transitions

Add spring-like transitions using cubic-bezier timing functions to mimic framer-motion spring physics.

### 4. Page Transition Animations

Implement AnimatePresence with custom direction-based transitions:

- Slide from right (20%) when going forward
- Slide from left (-20%) when going backward
- Smooth opacity transitions (0.2s duration)
- Spring-like easing for natural feel

### 5. Progress Indicator Updates

Update progress bar and dots to reflect 4 pages:

- Progress bar fill: 25%, 50%, 75%, 100%
- 4 progress dots with active state tracking
- Smooth transitions between states

## Implementation Notes

- Use framer-motion's `layout` prop for smooth width transitions
- Use `AnimatePresence` with `mode="sync"` for page transitions
- Arrow icons from lucide-react: `ArrowLeft`, `ArrowRight`, `Check`
- All button animations use CSS transitions + framer-motion layout
- No Tailwind classes - pure CSS with explicit values
- Maintain existing dark theme (#0a0e1a background)

### To-dos

- [ ] Create 4 onboarding page components with placeholder content in src/components/onboarding/
- [ ] Add button animation CSS classes to src/styles/onboarding.css converting Tailwind to standard CSS
- [ ] Update OnboardingScreen.tsx with multi-page state, animated buttons, and page transitions
- [ ] Verify button width animations, page transitions, and progress indicators work smoothly