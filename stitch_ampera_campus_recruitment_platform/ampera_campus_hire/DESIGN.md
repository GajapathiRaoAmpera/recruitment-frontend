---
name: Ampera Campus Hire
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#444651'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#757682'
  outline-variant: '#c5c5d3'
  surface-tint: '#4059aa'
  primary: '#00236f'
  on-primary: '#ffffff'
  primary-container: '#1e3a8a'
  on-primary-container: '#90a8ff'
  inverse-primary: '#b6c4ff'
  secondary: '#006b5f'
  on-secondary: '#ffffff'
  secondary-container: '#6df5e1'
  on-secondary-container: '#006f64'
  tertiary: '#190093'
  on-tertiary: '#ffffff'
  tertiary-container: '#2b15c6'
  on-tertiary-container: '#a5a2ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#264191'
  secondary-fixed: '#71f8e4'
  secondary-fixed-dim: '#4fdbc8'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005048'
  tertiary-fixed: '#e2dfff'
  tertiary-fixed-dim: '#c3c0ff'
  on-tertiary-fixed: '#0f0069'
  on-tertiary-fixed-variant: '#3323cc'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  code-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system powers an internal AI-assisted talent acquisition platform engineered for enterprise high-volume university recruiting. The aesthetic embodies a **Modern Enterprise Corporate** philosophy: precise, credible, frictionless, and reassuringly structured. 

It balances institutional rigor with intelligent modernity. Visuals avoid playful gimmickry or stark brutalism, prioritizing extreme data legibility, swift candidate scanning, and clear demarcation of machine intelligence versus human decision-making. AI-generated evaluations and insights stand out through an intentional, luminous micro-gradient treatment while baseline workflows remain utilitarian and distraction-free.

## Colors
The palette leverages a deep, institutional authority layered over a crisp, cool canvas.

- **Primary (`#1E3A8A`):** Deep Navy. Anchors structural navigation, top-level branding, and primary operational triggers.
- **Secondary / Accent (`#14B8A6`):** Vibrant Teal. Designates active selections, high-confidence scores, and critical interactions.
- **Tertiary (`#4F46E5`):** Indigo. Used exclusively in synergy with the teal accent to build signature gradients for AI-generated inference tags, summaries, and match scores.
- **Neutral Canvas & Surfaces:** 
  - Canvas Background: Slate 50 (`#F8FAFC`)
  - Elevated Container Background: Pure White (`#FFFFFF`)
  - Subdued / Hover State: Slate 100 (`#F1F5F9`)
  - Structural Border Lines: Slate 200 (`#E2E8F0`)
  - Text Primary: Slate 900 (`#0F172A`)
  - Text Muted: Slate 500 (`#64748B`)
- **Semantic Accents:**
  - Success: Emerald 500 (`#10B981`)
  - Warning: Amber 500 (`#F59E0B`)
  - Danger / Drop: Red 500 (`#EF4444`)

## Typography
Built entirely on `Inter` to deliver objective clarity and consistent optical metrics across density-packed dashboards.

- **Headlines:** Use tightened negative tracking to anchor scanning. Used for module headings, pipeline stage headers, and candidate candidate titles.
- **Body:** Relies on standardized line-height ratios (1.4–1.5x) for dense resume parser reads, interview feedback logs, and rubric breakdowns.
- **Labels & Micro-copy:** Leverage medium and semi-bold weights for high legibility at 12px, specifically within data grids, score dials, and metadata tags.

## Layout & Spacing
The layout model is targeted for desktop-first operations (optimal viewing at 1440px):

- **Shell Architecture:**
  - Fixed left sidebar navigation: `260px` width.
  - Top header/search/notification utility bar: `64px` height, spanning the main work surface.
  - Main operational stage: Responsive fluid area with a `1440px` target baseline, clamped with `margin` of `2rem` (32px) around primary workspaces.
- **Grid & Content Rhythm:**
  - Standard 12-column layout across workspace views using `1.5rem` (24px) gutters.
  - Metric dashboards, Kanban application pipelines, and resume split-views adhere strictly to multiples of 4px and 8px for internal component margins and padding.

## Elevation & Depth
Depth is controlled through a low-contrast outline system paired with soft ambient diffusion:

- **Flat Outlines:** Surfaces default to a crisp `1px solid #E2E8F0` border.
- **Resting Cards:** `#FFFFFF` background with `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)`.
- **Interactive Hover & Flyouts:** `box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)`.
- **Top Bar & Navigation Separators:** Grounded structurally via bottom and right border dividers (`#E2E8F0`) rather than drop shadows, retaining a clean planar profile.

## Shapes
A baseline corner radius of `12px` (`0.75rem`) characterizes cards, panels, and modal containers, establishing a softened, contemporary enterprise feel.

- **Base Controls:** Buttons, inputs, and search fields use `8px` (`0.5rem`) for a precise, ergonomic tool feel.
- **Micro UI & Pills:** Metric tags, stage pills, and the signature AI sparkle badges utilize fully rounded pill contours (`9999px`).

## Components

### Buttons
- **Primary:** Solid `#1E3A8A` background, white text, 8px radius, subtle hover lift to `#172554`. Focus state ring: 2px offset with `#14B8A6`.
- **Secondary / Subtle:** White fill with 1px border `#E2E8F0`, slate `#0F172A` text, hover state `#F8FAFC`.
- **AI Action Triggers:** Linear gradient (`135deg, #14B8A6, #4F46E5`), white text, faint glow on hover (`0 0 12px rgba(20, 184, 166, 0.35)`).

### AI Sparkle Badges & Scores
- **Style:** Pill badge (`rounded-full`) styled with a subtle gradient backdrop: `linear-gradient(135deg, rgba(20, 184, 166, 0.12) 0%, rgba(79, 70, 229, 0.12) 100%)`.
- **Border:** `1px solid rgba(20, 184, 166, 0.3)`.
- **Content:** An inline spark icon (lucide `sparkles`) colored `#14B8A6` followed by a label or numeric score (e.g., "94% Match") in `#0F172A` semi-bold text.

### Cards & Candidate Panels
- **Structure:** `#FFFFFF` fill, 12px border radius, 1px border `#E2E8F0`.
- **Header Section:** Subdued bottom divider, candidate avatar, university tier tag, and Ampera AI evaluation summary score positioned top-right.

### Form Inputs & Search Fields
- **Container:** Height `40px`, 8px corner radius, background `#FFFFFF`, border `1px solid #E2E8F0`.
- **Active / Focused:** Border transitions to `#1E3A8A` with a 1px ring in `#14B8A6`.
- **Global Search:** Left sidebar or top bar search with integrated hotkey pill (`⌘K`) in muted slate.

### Chips & Semantic Statuses
- **Status Pills:** 4px vertical padding, 10px horizontal padding, pill-rounded.
- **Success (Shortlisted):** `#ECFDF5` background, `#047857` text.
- **Warning (Under Review):** `#FFFBEB` background, `#B45309` text.
- **Danger (Rejected):** `#FEF2F2` background, `#B91C1C` text.