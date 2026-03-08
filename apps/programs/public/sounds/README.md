# Sound Files

This directory should contain the following sound files for the interval timer:

## Required Files

1. **ready.wav** - Setup countdown sound (~3 seconds max)
   - Used during the setup countdown timer
   - Plays when 3 seconds remain before the active period starts
   - Should be no longer than 3 seconds to finish before `start.wav` plays

2. **start.wav** - Active interval start sound (~0.5-1 second)
   - Used when starting active intervals (work periods)
   - Plays at the beginning of each active interval
   - Should be a clear, motivating sound to signal work begins

3. **complete.wav** - Active interval end sound (~0.5-1 second)
   - Used when ending active intervals and entering rest
   - Plays when transitioning from active work to rest period
   - Should be a clear signal that the work period is complete

4. **cooldown.ogg** - Cooldown interval sound (~0.5-1 second)
   - Used when starting the cooldown timer between workout sections
   - Plays at the beginning of the cooldown period
   - OGG format for better compression

## Sound File Sources

Free sound files can be found at:

- freesound.org (check license requirements)
- zapsplat.com (free with attribution)
- pixabay.com (free for commercial use)

## Format Requirements

- **Format**: WAV files for `ready.wav`, `start.wav`, and `complete.wav`; OGG for `cooldown.ogg`
- **Quality**: 44.1kHz, 128kbps or higher
- **License**: Must be free for commercial use or have appropriate attribution
- **Duration**:
  - `ready.wav`: Maximum 3 seconds (plays during last 3 seconds of setup)
  - `start.wav`, `complete.wav`, `cooldown.ogg`: 0.5-1 second recommended

## File Names

The code uses these exact file names:

- `/sounds/ready.wav` - Setup countdown sound
- `/sounds/start.wav` - Active interval start sound
- `/sounds/complete.wav` - Active interval end sound
- `/sounds/cooldown.ogg` - Cooldown interval sound

**Note**: These file names are hardcoded in the timer component. The formats (WAV/OGG) are chosen for optimal browser compatibility and audio quality.
