# Feature Specification: UI/UX Overhaul
**Feature ID:** 002
**Feature Name:** UI/UX Overhaul & Rebrand

## 1. Overview
Transform the DocMapper MVP into a professional SaaS application branded as "Levix Digital". The design focuses on a modern, high-tech "Robot Shell" aesthetic with discrete, animated details.

## 2. Design System Requirements

### 2.1 Core Identity
- **Brand Name:** Levix Digital
- **Core Visual:** "Robot Shell" (Clean white surfaces, defined lines).
- **Primary Detail:** "Discrete Moving Spectrum Border" (LED effect).
- **Color Palette:**
    - **Spectrum Gradient:** Purple (`#9333ea`) to Green (`#10b981`).
    - **Backgrounds:** White (`#ffffff`), Gray (`#f9fafb`).
    - **Text:** Dark Gray (`#1f2937`).
    - **Shadows:** Standard, soft black/gray shadows (No colored glows).

### 2.2 Typography
- **Headings:** `Outfit` (Bold, Modern).
- **Body:** `Inter` (Clean, Readable).

### 2.3 UX Interactions
- **Focus/Hover:** Elements should reveal the "Spectrum" detail on interaction.
- **Animations:**
    - `led-border`: Continuous flow of gradient hue/position.
    - Smooth transitions for hover states.

### 2.4 Component Definitions
- **MainLayout:** 
    - Sticky header with Logo ("DocMapper" branding).
    - Footer with links (Privacy/Terms).
    - Help/How-to Modal mechanism.
    - Generic layout container.
- **Button:**
    - *Primary:* White bg, LED Border.
    - *Secondary:* Gray border, LED Border on hover.
    - *Ghost:* Clean text.
- **Cards/Containers:** White rounded panels, thin gray borders, LED border on hover/active.
- **Inputs & DropZones:**
    - *Style:* White background, thin gray border (Unified Panel).
    - *Interaction:* Spectrum Gradient border on Focus/Active.
- **Validation States:**
    - *Error:* Red LED border + Red text.
    - *Success:* Green LED border + Green text.
- **Loading State:**
    - *Visual:* "Spectrum Pulse" (LED border pulses/rotates) + "Processing..." text.

## 3. Technical Context (Analysis)
- **Stack:** Vue 3 (Script Setup), Vite, Tailwind CSS.
- **Current State:** Basic drag-and-drop MVP with generic styling.
- **Constraints:**
    - Must use existing Tailwind configuration approach.
    - Maintain existing logic (PDF processing).
    - No external UI libraries (using raw Tailwind), EXCEPT:
        - `lucide-vue-next` for iconography (Robot Shell aesthetic).
    - **Dark Mode Support**:
        - Dual Mode (System Default).
        - Use `dark:` variants to swap White Shell -> Carbon/Dark Grey.
        - Spectrum gradient remains (or adjusts slightly for contrast).

## 4. Clarifications
### Session 2025-12-05
- Q: Input/Drag-Drop Styling? → A: Option A (Unified Panel Style: White bg, thin gray border, Spectrum on Focus).
- Q: Error & Success Visuals? → A: Option A (Integrated LED: Red/Green LED border + Text).
- Q: Loading & Processing States? → A: Option A (Spectrum Pulse: LED border pulses/rotates).
- Q: Iconography System? → A: Option A (Lucide Vue).
- Q: Dark Mode Support? → A: Option B (Dual Mode: Implementing `dark:` classes).
