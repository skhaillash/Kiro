# HAZE RUN: Malaysia Survival Crisis

A top-down browser survival game about Malaysia's haze. Vanilla JS + Canvas 2D + WebAudio. No dependencies, no build step.

**DISCLAIMER: All air-quality values (API, PM2.5, forecasts, events) are SIMULATED for gameplay. They are NOT official readings.** For real data see DOE Malaysia APIMS (apims.doe.gov.my) and MetMalaysia (met.gov.my).

## Run
Double-click `index.html` (works from `file://`, Chrome/Edge/Firefox). Click once or press a key to enable sound.

## Controls
- WASD / Arrows: move, Shift: sprint (stamina)
- E (hold): interact (recruit civilian, spray fire, refill at hydrant, deliver mask, restock at Hospital/Klinik)
- 1 / 2 / 3: wear N95 / drink water / use inhaler
- Tab: toggle Haze Director panel, P / Esc: pause, M: mute

## Features
- Procedural Malaysian town: KL Tower and Petronas Towers skyline, kampung houses, hospital, school, dewan, mamak stall, palm trees, minimap.
- 64x48 PM2.5 grid with wind advection, diffusion and fire hotspots; simulated API with Malaysian categories (Good / Moderate / Unhealthy / Very Unhealthy / Hazardous).
- Health, stamina, lung exposure and N95 durability. Shelters and purifier zones give clean air.
- Missions: rescue civilians, extinguish fires (bucket + hydrants, peat fires need more), deliver masks. 3 days (Moderate, Peat Fire, Hazardous), score, stars, summary, game over and victory.
- **Haze Director AI**: computes player stress from health, lung exposure, mask state, air and stamina; adapts difficulty (fire spawn rate, wind shifts, supply drops, targeted fires); forecasts haze arrival at landmarks. Panel shows stress, difficulty multiplier, last decision and reason.
- Civilians use utility-based steering (avoid dense haze, follow the player, seek the nearest shelter in panic).
- **Haze Front** event each day: siren, banner, darkening sky, wind shift, a wall of smoke sweeping the map for 20s, screen shake and collapsing visibility. Surviving it is a required objective.
- WebAudio synth (wind drone scaling with haze, cough, chime, siren). Achievements saved in localStorage.
- Menu with How to Play and Learn About Haze (PM2.5, open burning and peat fires, transboundary smoke, N95 vs surgical masks, vulnerable groups).

## What was actually verified
- Node was not available, so no `node --check`. Instead the game was loaded in headless Chrome via `file://`.
- Scripted bot runs of all 3 levels (several thousand simulation steps plus rendering): no JS errors reported.
- Scripted scenario: civilian rescue, Haze Front trigger and sweep, level completion to summary screen worked.
- One screenshot of Day 1 gameplay was inspected visually.
- NOT verified: real keyboard/mouse play, audio output (no ears in headless), full playthrough balance, Firefox/Safari, small or very large window sizes. Difficulty balance is untuned.
