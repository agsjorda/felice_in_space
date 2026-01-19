# Low End Mobile Optimization

This document describes the mobile optimization changes applied to improve performance on low-end mobile devices.

## Overview

These optimizations automatically detect device capabilities and adjust game settings for optimal performance on mobile devices, especially low-end ones.

## Key Changes

### 1. DeviceCapabilityManager (`src/managers/DeviceCapabilityManager.ts`)
- Detects mobile devices, GPU tier (high/medium/low), and low-end devices
- Considers CPU cores, device memory, and GPU capabilities
- Recommends quality settings and FPS based on device capabilities

### 2. Game Configuration (`src/game/main.ts`)
- **Dynamic FPS**: 60 FPS on capable devices, 30 FPS on low-end devices
- **Power Preference**: Uses `low-power` mode on mobile/low-end devices
- **Antialiasing**: Disabled on low-end devices
- **Render Optimizations**: Reduced batch size and rounded pixels on low-end devices
- **Battery Saving**: Throttles to 10 FPS when tab is hidden

### 3. HTML Meta Tags (`index.html`)
- Viewport optimizations (`user-scalable=no`, `viewport-fit=cover`)
- PWA meta tags for mobile web app support
- Theme color and status bar styling
- Disabled phone number detection

### 4. CSS Performance Optimizations (`public/style.css` & `index.html`)
- GPU acceleration with `transform: translateZ(0)`
- Disabled text selection and tap highlights
- Prevented overscroll bounce on iOS
- Optimized touch handling with `touch-action: none`
- Fixed positioning to prevent layout shifts

## Files Modified

1. `src/managers/DeviceCapabilityManager.ts` - NEW: Device capability detection
2. `src/game/main.ts` - Game configuration optimizations
3. `index.html` - Mobile meta tags and CSS optimizations
4. `public/style.css` - Mobile performance CSS

## How to Apply to Other Projects

1. Copy `DeviceCapabilityManager.ts` to your project
2. In your game's main configuration file (equivalent to `main.ts`):
   - Import `DeviceCapabilityManager`
   - Create instance and get capabilities
   - Use capabilities to configure FPS, power preference, antialiasing, and render settings
   - Add visibility change handler to throttle FPS when tab is hidden
3. Add mobile meta tags to `index.html`
4. Add mobile CSS optimizations to your main CSS file

## Search Tags

All changes are tagged with `LOW END MOBILE OPTIMIZATION` comments for easy searching.

