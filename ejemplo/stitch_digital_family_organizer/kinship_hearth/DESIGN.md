---
name: Kinship & Hearth
colors:
  surface: '#f7f9fd'
  surface-dim: '#d8dade'
  surface-bright: '#f7f9fd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f8'
  surface-container: '#eceef2'
  surface-container-high: '#e6e8ec'
  surface-container-highest: '#e0e3e6'
  on-surface: '#181c1f'
  on-surface-variant: '#56423c'
  inverse-surface: '#2d3134'
  inverse-on-surface: '#eff1f5'
  outline: '#89726b'
  outline-variant: '#ddc0b8'
  surface-tint: '#9f4122'
  primary: '#9f4122'
  on-primary: '#ffffff'
  primary-container: '#ff8a65'
  on-primary-container: '#752305'
  inverse-primary: '#ffb59e'
  secondary: '#006688'
  on-secondary: '#ffffff'
  secondary-container: '#58cafe'
  on-secondary-container: '#005370'
  tertiary: '#286b33'
  on-tertiary: '#ffffff'
  tertiary-container: '#75ba78'
  on-tertiary-container: '#004a18'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59e'
  on-primary-fixed: '#3a0b00'
  on-primary-fixed-variant: '#7f2a0d'
  secondary-fixed: '#c2e8ff'
  secondary-fixed-dim: '#75d1ff'
  on-secondary-fixed: '#001e2b'
  on-secondary-fixed-variant: '#004d67'
  tertiary-fixed: '#abf4ac'
  tertiary-fixed-dim: '#90d792'
  on-tertiary-fixed: '#002107'
  on-tertiary-fixed-variant: '#07521d'
  background: '#f7f9fd'
  on-background: '#181c1f'
  surface-variant: '#e0e3e6'
typography:
  display-lg:
    fontFamily: Quicksand
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Quicksand
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Quicksand
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Nunito Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Nunito Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Nunito Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Nunito Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  display-lg-mobile:
    fontFamily: Quicksand
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 16px
  gutter: 12px
---

## Brand & Style

The design system is centered on a **Modern-Cozy** aesthetic, blending the efficiency of a high-end productivity tool with the warmth of a family home. It prioritizes emotional safety, accessibility, and joy.

The style leverages **soft minimalism** mixed with **tactile elements**. While the overall interface is clean and uncluttered to reduce cognitive load for busy parents, it incorporates subtle physical metaphors—like soft-edged "post-it" surfaces and recessed "vault" containers—to make the digital experience feel grounded and intuitive. The interface should evoke a sense of organized harmony rather than clinical precision.

## Colors

The palette uses a "Sunset & Sky" logic to balance energy with calm. 

- **Primary (#FF8A65):** Used for main actions (FABs, primary buttons) and active states. It provides a warm, energetic focal point.
- **Secondary (#4FC3F7):** Applied to information-heavy areas, calming navigation, and secondary interactive elements.
- **Tertiary/Success (#81C784):** Reserved for completed tasks, growth indicators, and "safe" confirmations.
- **Background (#F9FBFF):** A cool, soft-white tint that prevents eye strain and makes the warmer primary colors pop without feeling aggressive.
- **Text:** Use `#2C3E50` for high-contrast readability against the soft background. Avoid pure black to maintain the "cozy" feel.

## Typography

This design system utilizes a dual-font approach to maximize friendliness and legibility. 

**Quicksand** is used for all headings and display text. Its rounded terminals and open counters feel approachable and optimistic. **Nunito Sans** is used for body copy and labels; it maintains the rounded aesthetic of Quicksand but offers better legibility at smaller scales and longer line lengths.

All type should be set with generous line heights to ensure a "breezy," uncrowded feel. Avoid all-caps for labels; use title case or sentence case to maintain a conversational tone.

## Layout & Spacing

The layout follows a **fluid grid** model optimized for PWA (mobile-first) usage. 

- **The 8px Square:** All spacing increments must be multiples of 8px.
- **Margins:** Use a 16px safe margin on mobile devices. For larger tablet views, increase margins to 32px or 48px to center-align the content container.
- **Card Spacing:** Vertical stacks should use `md` (16px) spacing, while horizontal groupings (like member avatars) should use `xs` (4px) negative margins for an overlapping "connected" look.
- **Visual Breath:** Prefer `lg` (24px) padding inside containers to ensure content doesn't feel cramped, reinforcing the calm brand personality.

## Elevation & Depth

Hierarchy is established through **Soft Tonal Layers** and **Ambient Shadows** rather than harsh borders.

1.  **Level 0 (Base):** The Background color (#F9FBFF).
2.  **Level 1 (Cards):** Pure white background with an extremely diffused, low-opacity shadow (8% opacity, 12px blur, 4px offset).
3.  **Level 2 (Active/Floating):** Primary color elements or modals with a more pronounced shadow (12% opacity, 20px blur, 8px offset).
4.  **The Vault (Inset):** To create a sense of security, the "Julián" section uses an **inner shadow** effect (inset) on a slightly darker neutral background, making the content feel "stored" safely within the interface.
5.  **Post-it Notes:** Use subtle rotation (1-2 degrees) and a "lifted corner" shadow effect on the bottom right to differentiate temporary notes from permanent dashboard cards.

## Shapes

The shape language is consistently **Rounded**. There are no sharp corners in the design system.

- **Standard Elements:** Use `rounded-md` (0.5rem) for input fields and small buttons.
- **Containers:** Use `rounded-lg` (1rem) for dashboard cards and checklists.
- **Large Surfaces:** Use `rounded-xl` (1.5rem) for bottom sheets and the "Vault" container.
- **Avatars & FABs:** Use the **Pill/Circle** shape (full rounding) to denote personhood or primary action.

## Components

### Buttons
- **Primary:** Heavily rounded (pill-shaped), using the Primary color with white text. Apply a subtle lift on hover/tap.
- **Secondary:** Transparent background with a 2px border of the Secondary color and Secondary-colored text.

### Cards & Post-its
- **Dashboard Cards:** White background, `rounded-lg`, with a soft shadow. Use a small top-border accent of the Primary or Secondary color to categorize the card content.
- **Post-it Notes:** Use a light yellow (`#FFF9C4`) or pale teal background. Apply a slight 1-2 degree random rotation for a playful, analog feel. Use the Label-font for "handwritten" appearance.

### Checklists
- **Items:** Use high-tap-target areas (min 48px height). 
- **Checkboxes:** Circular (not square) to match the friendly brand style. When checked, the item should strike through and fade to 50% opacity.

### Input Fields
- Softly tinted backgrounds (e.g., 5% Primary color) with a 1px border. Focus state should expand the border to 2px and increase the shadow depth.

### The Vault (Secure Section)
- Use a dark-mode-lite aesthetic or a deeply recessed inner-shadow container. Typography should shift to slightly more weighted labels to imply "importance" and "durability." Include a prominent "Locked" icon toggle.

### Avatars
- Use "Squircle" or circular shapes with thick 2px white borders when overlapping to ensure individual members remain distinct.