/**
 * Single source of truth for the Daily Warm-Up design used by all interval timers.
 * Update exercises or duration here; Tabata, Japanese Walking, WarmUpInterval, and
 * future timers will receive the change automatically.
 * Images are shown in the warmup sidebar. Partial match: if an image filename
 * (without extension) is contained in the exercise name (normalized), we use it.
 */

import type { HIITTimelineBlock, MistakeCorrectionRow } from '@interval-timers/types';
import type { InstructionStep } from '@interval-timers/types';

const WARMUP_IMAGES_BASE = '/images/warmup';

/** Existing images in public/images/warmup/. Exercise name is matched partially (e.g. "Cervical" matches "Cervical CARs - Left"). Filenames must match assets in each app's public/images/warmup/. */
const WARMUP_IMAGE_MAP: { pattern: string; file: string }[] = [
  { pattern: 'Cervical', file: 'cervical-cars-controlled-articular-rotation-hiit-workout.png' },
  { pattern: 'Glenohumeral', file: 'glenohumeral-cars-controlled-articular-rotation-hiit-workout.png' },
  { pattern: 'Scapular', file: 'scapular-cars-controlled-articular-rotation-hiit-workout.png' },
  { pattern: 'Thoracic', file: 'thoracic-cars-hiit-workout.png' },
  { pattern: 'Hip CARs', file: 'hip-cars-controlled-articular-rotation-hiit-workout.png' },
  { pattern: 'Tibial', file: 'tibial-cars-hiit-workout.png' },
  { pattern: 'Ankle', file: 'ankle-cars-hiit-workout.png' },
  { pattern: 'Swimmers', file: 'swimmers-hiit-workout.png' },
  { pattern: 'Press-Press', file: 'press-press-fling-hiit-workout.png' },
  { pattern: 'Adductor', file: 'adductor-rocking-hiit-workout.png' },
  { pattern: 'Segmental', file: 'segmental-cat-cows-hiit-workout.png' },
  // childs-pose.png may not exist yet in each app's public/images/warmup/; add when available. UI handles missing images.
  { pattern: "Child's Pose", file: 'childs-pose.png' },
];

export function getWarmupImageUrl(exerciseName: string): string | undefined {
  const name = exerciseName.trim();
  const match = WARMUP_IMAGE_MAP.find(({ pattern }) =>
    name.toLowerCase().includes(pattern.toLowerCase())
  );
  return match ? `${WARMUP_IMAGES_BASE}/${match.file}` : undefined;
}

/** Instructions keyed by pattern (partial match on exercise name). Same logic as images. */
const WARMUP_INSTRUCTIONS: { pattern: string; steps: InstructionStep[] }[] = [
  {
    pattern: 'Cervical',
    steps: [
      {
        title: 'Irradiate & Anchor',
        body:
          'Stand or kneel tall. Grip the floor with your feet, squeeze your glutes, and brace your abs (approx. 30% effort). Make fists and drive your knuckles toward the floor to depress the shoulder blades. You are now a statue from the neck down.',
      },
      {
        title: 'Segmental Flexion',
        body:
          'Slowly bring your chin to your chest. Imagine rolling down vertebrae by vertebrae, starting at C1. Do not let the shoulders round forward.',
      },
      {
        title: 'Rotation (Scrape the Collarbone)',
        body:
          'Maintain flexion and rotate your chin toward your right shoulder. Imagine scraping your chin along your right collarbone until you cannot rotate further without moving the shoulder.',
      },
      {
        title: 'Ipsilateral Lateral Flexion',
        body:
          'At the end of rotation, drop your right ear toward your right back pocket. This transitions the head from looking down to looking sideways/up.',
      },
      {
        title: 'Extension',
        body:
          'Draw a large arc with your chin across the ceiling. Look up and back, extending the neck fully while traveling to the left side. Caution: If you feel pinching on the back of the neck, lessen the range of motion.',
      },
      {
        title: 'Contralateral Descent',
        body:
          'As you reach the left shoulder in extension, drop the left ear to the left shoulder (lateral flexion), then rotate the chin down to the left collarbone, and scrape back to the center of the chest.',
      },
    ],
  },
  {
    pattern: 'Glenohumeral',
    steps: [
      {
        title: 'Setup & Irradiation',
        body:
          'Stand tall. Grip the floor with your feet. Clench the non-working hand into a tight fist. Create full-body tension (approx 30-40% MVC) to lock the ribcage and spine in place. The scapula should be depressed and retracted slightly, but glued to the ribs.',
      },
      {
        title: 'Flexion (The Sweep Up)',
        body:
          'Slowly bring the arm across the body and upward (adduction into flexion). Keep the palm facing inward. Imagine moving your arm through air that has the density of honey. Stop when you hit a blockage (usually near the ear).',
      },
      {
        title: 'Axial Rotation (The Key Turn)',
        body:
          'At the top of the movement (flexion), internally rotate the humerus. Imagine there is an "X" on your bicep; try to turn that "X" to face away from you. This rotation occurs only at the shoulder, not the wrist or elbow.',
      },
      {
        title: 'Extension & Orbit',
        body:
          'Maintain that internal rotation as you reach the arm back behind you in a wide arc. You are drawing the largest circle possible. As the hand passes the hip, the palm should be facing out/up (knuckles to hip).',
      },
      {
        title: 'Reverse the Path',
        body:
          'Extend the arm straight back. Externally rotate (unwind) the arm as you bring it back overhead, returning to the starting position. Do not rush.',
      },
    ],
  },
  {
    pattern: 'Scapular',
    steps: [
      {
        title: 'The Setup (Irradiation)',
        body:
          'Stand tall with feet shoulder-width apart. Make a tight fist with the working arm and extend it slightly away from your body (approx. 20° abduction). Inhale deeply, pack air into your abdomen, and create 30–50% full-body tension. Squeeze your glutes and core.',
      },
      {
        title: 'Phase 1: Elevation',
        body:
          'Drive the shoulder blade straight up toward the ear (shrug). Visualize sliding the scapula up the rib cage without shortening the neck or leaning the head.',
      },
      {
        title: 'Phase 2: Protraction',
        body:
          'From the elevated position, push the shoulder blade forward and around the rib cage. Imagine punching your fist forward, but keep the elbow locked straight. This engages the serratus anterior.',
      },
      {
        title: 'Phase 3: Depression',
        body:
          'While keeping the shoulder protracted (forward), drive it straight down toward your back pocket. Create as much distance between your ear and shoulder as possible.',
      },
      {
        title: 'Phase 4: Retraction',
        body:
          'From the depressed position, squeeze the shoulder blade back toward the spine. Imagine trying to crush a walnut between your shoulder blades. Do not let the shoulder rise up yet.',
      },
      {
        title: 'Complete the Cycle',
        body:
          'From retraction, slide back up to elevation to complete the circle. Perform strict repetitions in one direction, then reverse the direction (Retract → Depress → Protract → Elevate).',
      },
    ],
  },
  {
    pattern: 'Thoracic',
    steps: [
      {
        title: 'Irradiation (The Setup)',
        body:
          'Assume a seated position (Seiza or cross-legged) or standing. Wrap your arms across your chest in an "X" shape, hugging your shoulders. Inhale deeply into the lower abs, pack the air down, and tense your glutes and abs to 30-50% tension.',
      },
      {
        title: 'Segmental Flexion',
        body:
          'Exhale and round the upper back forward. Think about moving one vertebra at a time from the base of the neck (C7) down to the bottom of the ribs. Do not let the hips hinge.',
      },
      {
        title: 'Rotation to Lateral Flexion',
        body:
          'Maintain flexion and rotate your sternum to the right. Once you hit your rotational limit, dip your right shoulder toward your right hip (Lateral Flexion). Visualize dropping your shoulder into your back pocket.',
      },
      {
        title: 'Extension Arc',
        body:
          'Begin to extend the spine (arch back) while rotated. Imagine drawing a circle on the ceiling with your sternum. Transition smoothly across the back, extending fully until you reach the left side lateral flexion position. Note: Ensure the extension comes from the upper back, not the lower back.',
      },
      {
        title: 'Return and Reverse',
        body:
          'Rotate the sternum back to the center while in flexion to complete the circle. Re-brace and perform the repetition in the opposite direction (Counter-Clockwise).',
      },
    ],
  },
  {
    pattern: 'Hip CARs',
    steps: [
      {
        title: 'The Setup (Irradiation)',
        body:
          'Stand next to a wall or rack for balance. Grip the floor with your standing foot. Tense your abs, glutes, and grip the support hand. Generate 30% total body tension to freeze the torso.',
      },
      {
        title: 'Flexion to Abduction',
        body:
          'Flex the working hip up (knee to chest) without rounding the lower back. Slowly open the gate (abduct) to the side. Maintain the knee height; do not let the foot drop.',
      },
      {
        title: 'Axial Rotation (The Hurdle)',
        body:
          'At the limit of abduction, begin to internally rotate the femur. Think of lifting the ankle higher than the knee as you drive the leg backward. The heel should rotate toward the ceiling.',
      },
      {
        title: 'Extension to Neutral',
        body:
          'Complete the circle by bringing the knee underneath the hip into extension (squeezing the glute), then return to the starting position next to the standing leg. Reverse the motion smoothly.',
      },
    ],
  },
  {
    pattern: 'Tibial',
    steps: [
      {
        title: 'The Setup',
        body:
          'Sit on the floor. Bend one knee to approximately 90°. Slide your same-side arm underneath your thigh and grab your opposite bicep (creating a "headlock" on your own leg). Place your other hand on your tibial tuberosity (the bump just below the knee cap) to monitor movement.',
      },
      {
        title: 'Irradiation & Ankle Lock',
        body:
          'Dorsiflex your ankle (pull toes toward the shin). This locks the ankle joint and minimizes the chance of simulating rotation through the foot. Generate full-body tension (irradiation) to freeze the hip in place.',
      },
      {
        title: 'External Rotation',
        body:
          'Without moving your thigh, attempt to rotate your shin bone outward. Visual cue: Try to point your tibial tuberosity toward the outside of your body. Your foot will point out, but ensure the motion originates from the knee.',
      },
      {
        title: 'Internal Rotation',
        body:
          'Slowly reverse the motion. Rotate the shin bone inward. Visual cue: Point the tibial tuberosity toward your other leg. Squeeze the inner hamstrings at the end range.',
      },
      {
        title: 'Axial Cycles',
        body:
          'Move back and forth between maximum internal and external rotation. Imagine you are wringing out a towel inside your knee joint. Keep the movement slow and controlled (viscous).',
      },
    ],
  },
  {
    pattern: 'Ankle',
    steps: [
      {
        title: 'Setup Position',
        body:
          'Sit on the floor. Thread one arm under the working leg\'s knee in a "chokehold" grip to isolate the thigh. Place the other hand on the shin (tibia) to monitor and prevent rotation.',
      },
      {
        title: 'Irradiation',
        body:
          'Generate 30% full-body tension. Squeeze the bicep holding the leg and actively root the heel of the non-working leg into the ground.',
      },
      {
        title: 'Dorsiflexion',
        body:
          'Pull the toes and foot straight up towards the shin as far as possible without engaging the toes excessively.',
      },
      {
        title: 'Inversion (Internal Rotation)',
        body:
          'While maintaining dorsiflexion, turn the sole of the foot inward. Imagine trying to show your sole to the opposite knee.',
      },
      {
        title: 'Plantarflexion',
        body:
          'Maintain the inward turn (inversion) and begin to point the foot down like a ballerina. Reach for the floor.',
      },
      {
        title: 'Eversion (External Rotation)',
        body:
          'While fully pointed (plantarflexed), sweep the foot outwards. Turn the sole away from the midline.',
      },
      {
        title: 'Return to Start',
        body:
          'Maintain the outward turn (eversion) and pull the foot back up into dorsiflexion to complete one full revolution.',
      },
      {
        title: 'Reverse',
        body:
          'Pause, then retrace the path in the exact opposite direction (Dorsiflexion → Eversion → Plantarflexion → Inversion).',
      },
    ],
  },
  {
    pattern: 'Swimmers',
    steps: [
      {
        title: 'The Setup & Irradiation',
        body:
          'Lie prone (face down) on the floor. Ideally, place a yoga block or small pillow under your forehead to maintain neutral cervical spine. Place both hands on your lower back (lumbar spine), palms facing up (internal rotation), with elbows bent and relaxed. Dig your toes into the ground and squeeze your glutes to lock the pelvis.',
      },
      {
        title: 'The Lift-Off',
        body:
          'Take a breath into your lower abdomen to brace the core. Retract your shoulder blades slightly, then lift your hands and elbows off your lower back. Do not let your chest lift off the floor. Fight for maximum height here.',
      },
      {
        title: 'The Extension & Sweep',
        body:
          'Slowly extend your elbows until arms are straight back. Begin to sweep your arms out to the sides in a wide arc (abduction). Imagine you are tracing the horizon. Keep your hands as high away from the floor as possible.',
      },
      {
        title: 'The Axial Rotation',
        body:
          'As your arms approach shoulder height (the "T" position), you will hit a mechanical block. Here, rotate your arms externally (flip the palms from facing up to facing down/forward). This rotation must happen at the shoulder joint, not the wrist.',
      },
      {
        title: 'The Finish & Reversal',
        body:
          'Continue the sweep overhead until hands touch the back of your head (or neck). Do not rest; maintain the hover. Reverse the motion: extend elbows, sweep back to the "T", internally rotate (palms up), and return to the lower back.',
      },
    ],
  },
  {
    pattern: 'Press-Press',
    steps: [
      {
        title: 'Stance Initialization',
        body:
          'Stand with feet hip-width apart. Raise elbows to shoulder height, bent at 90°, with fingertips touching or close together in front of the chest. Engage core (ribs down).',
      },
      {
        title: 'Press One (Pulse)',
        body:
          'Rhythmically drive the elbows backward (horizontal abduction) while keeping the arms bent. This is a short, sharp pulse to engage the scapular retractors.',
      },
      {
        title: 'Press Two (Pulse)',
        body:
          'Immediately perform a second identical pulse, driving the elbows back again to utilize the stretch reflex. Maintain the rhythm: "One, Two..."',
      },
      {
        title: 'The Fling',
        body:
          "On the third count, explosively extend the arms fully outward to the sides (forming a 'T' shape) while simultaneously rising onto the toes (ankle plantarflexion).",
      },
      {
        title: 'Reset & Repeat',
        body:
          'Control the return of the heels to the floor and the arms back to the starting bent position. Establish a continuous, fluid rhythm: "Press, Press, Fling".',
      },
    ],
  },
  {
    pattern: 'Adductor',
    steps: [
      {
        title: 'Quadruped Setup',
        body:
          'Begin on all fours (hands under shoulders, knees under hips). Ensure your spine is neutral—flat like a table. Brace your core lightly.',
      },
      {
        title: 'Extension and Abduction',
        body:
          'Extend one leg directly out to the side. The foot of the extended leg should be flat on the floor, toes pointing forward (parallel to your spine). This aligns the adductor fibers for optimal lengthening.',
      },
      {
        title: 'The Posterior Rock',
        body:
          'Maintain a neutral spine and slowly push your hips backward toward the heel of the kneeling leg. Imagine pushing your tailbone straight back.',
      },
      {
        title: 'Dynamic Return',
        body:
          'Once you feel a strong stretch in the inner thigh (without pain), squeeze your glutes to drive the hips forward back to the starting position. Exhale as you rock back; inhale as you return.',
      },
    ],
  },
  {
    pattern: 'Segmental',
    steps: [
      {
        title: 'The Setup',
        body:
          'Assume a quadruped position. Place hands directly under shoulders and knees directly under hips. Find a neutral spine position (flat back). Press the floor away to engage the serratus anterior.',
      },
      {
        title: 'Initiate Flexion (The Cat)',
        body:
          'Begin strictly at the pelvis. Tuck your tailbone under (posterior pelvic tilt) while keeping the lumbar, thoracic, and cervical spine completely still.',
      },
      {
        title: 'The Upward Wave',
        body:
          'Imagine a wave traveling up your spine. Slowly round the lower back (L5 to L1), then the mid-back (T12 to T1), one vertebra at a time.',
      },
      {
        title: 'Complete Flexion',
        body:
          'The wave finishes at the neck. Tuck your chin to your chest only after the thoracic spine is fully rounded. Push the ground away maximally.',
      },
      {
        title: 'Initiate Extension (The Cow)',
        body:
          'Keep the head tucked and upper back rounded. Reverse the movement starting again at the tailbone. Lift the tailbone to the ceiling (anterior pelvic tilt).',
      },
      {
        title: 'The Downward Wave',
        body:
          'Allow the wave of extension to travel upward. Drop the belly (lumbar extension), then arch the chest (thoracic extension).',
      },
      {
        title: 'Complete Extension',
        body:
          'Finally, lift the head and look up, completing the extension wave at the cervical spine.',
      },
      {
        title: 'Rinse and Repeat',
        body:
          'Maintain a slow tempo. If you find a "blind spot" (a section that moves as a block), pause there, breathe, and try to articulate it further.',
      },
    ],
  },
  {
    pattern: "Child's Pose",
    steps: [
      {
        title: 'Foundation Setup',
        body:
          'Start in a tabletop position (hands and knees). Bring your big toes to touch, while separating your knees slightly wider than your hips.',
      },
      {
        title: 'Hip Descent',
        body:
          'On an exhale, sink your hips back toward your heels. Prioritize the hips anchoring down rather than the head touching the floor.',
      },
      {
        title: 'Spinal Extension',
        body:
          'Walk your hands forward as far as possible. Press the palms into the floor to actively engage the serratus anterior and create traction through the spine.',
      },
      {
        title: 'Grounding',
        body:
          'Rest your forehead gently on the mat (or a block). Allow the chest to melt between the thighs.',
      },
      {
        title: 'Posterior Expansion',
        body:
          'Breathe deeply into the back of your rib cage (Posterior Mediastinum). Feel the ribs expand laterally and posteriorly with every inhalation.',
      },
    ],
  },
];

export function getWarmupInstructions(exerciseName: string): InstructionStep[] | undefined {
  const name = exerciseName.trim();
  const match = WARMUP_INSTRUCTIONS.find(({ pattern }) =>
    name.toLowerCase().includes(pattern.toLowerCase())
  );
  return match?.steps;
}

/** Common mistakes and corrections keyed by pattern (partial match on exercise name). Same logic as instructions. */
const WARMUP_MISTAKES_CORRECTIONS: { pattern: string; rows: MistakeCorrectionRow[] }[] = [
  {
    pattern: 'Cervical',
    rows: [
      {
        mistake: 'Shoulder Hiking',
        whyItHappens:
          'Lack of scapular depression; the trap tries to "help" the neck reach further.',
        theFix: 'Drive fists to the floor. Imagine holding heavy suitcases.',
      },
      {
        mistake: 'Torso Rotation',
        whyItHappens: 'Thoracic spine compensates for limited cervical rotation.',
        theFix: 'Increase irradiation. Keep sternum pointed straight ahead like a laser beam.',
      },
      {
        mistake: 'Closing Angle Pinch',
        whyItHappens:
          'Forcing range of motion into an impingement on the side you are turning toward.',
        theFix: 'Make the circle smaller. Only move into pain-free range. Bypass the pinch.',
      },
      {
        mistake: 'Jaw Jutting',
        whyItHappens: 'Using the mandible to fake neck extension.',
        theFix: 'Keep the tongue on the roof of the mouth. Move the neck, not the chin.',
      },
    ],
  },
  {
    pattern: 'Glenohumeral',
    rows: [
      {
        mistake: 'Torso Rotation',
        whyItHappens: 'Fake range of motion; spine moves instead of shoulder.',
        theFix:
          'Create more core tension; imagine your chest is a laser pointing straight ahead.',
      },
      {
        mistake: 'Scapular Elevation',
        whyItHappens:
          'Shrugging the shoulder creates impingement and reduces articular focus.',
        theFix: 'Keep the shoulder blade depressed (down) throughout the arc.',
      },
      {
        mistake: 'Elbow Hinge',
        whyItHappens:
          'Movement leaks out of the elbow rather than the glenohumeral joint.',
        theFix: 'Lock the tricep. Keep the arm perfectly straight.',
      },
      {
        mistake: 'Velocity',
        whyItHappens:
          'Momentum bypasses the stabilizers and reduces mechanotransduction.',
        theFix: 'Slow down. 1 rep should take 15-20 seconds.',
      },
    ],
  },
  {
    pattern: 'Scapular',
    rows: [
      {
        mistake: 'Bending the Elbow',
        whyItHappens:
          'Recruits biceps/triceps to fake range of motion, reducing scapular isolation.',
        theFix: 'Keep the arm completely straight; pretend the elbow is fused.',
      },
      {
        mistake: 'Spinal Compensation',
        whyItHappens:
          'Extending the lumbar spine during retraction creates a false sense of shoulder mobility (mobility theft).',
        theFix: 'Engage abs/glutes hard. Only the shoulder moves.',
      },
      {
        mistake: 'Head Jutting',
        whyItHappens:
          'Compromises cervical stability and alters the length-tension relationship of the levator scapulae.',
        theFix: 'Keep the chin tucked (double chin cue) and neck neutral.',
      },
      {
        mistake: 'Cutting Corners',
        whyItHappens:
          'Turns the movement into a generic "shoulder roll," failing to train the neurological end-range control.',
        theFix: 'Move slowly. Hit the outer limits of the circle.',
      },
    ],
  },
  {
    pattern: 'Thoracic',
    rows: [
      {
        mistake: '"Hula Hooping"',
        whyItHappens: 'Pelvis shifts side-to-side to fake movement range.',
        theFix: 'Squeeze a yoga block between your knees; squeeze glutes harder.',
      },
      {
        mistake: 'Lumbar Extension',
        whyItHappens: 'L1-L5 compensates for lack of T-spine mobility.',
        theFix:
          'Keep the ribs knitted down in the front; focus on extending only the "bra line" up.',
      },
      {
        mistake: 'Cervical Leading',
        whyItHappens: 'Head moves before the spine, creating false rotation.',
        theFix:
          'Tuck the chin slightly; keep the nose aligned with the sternum (the "Sternum-Nose Link").',
      },
      {
        mistake: 'Holding Breath',
        whyItHappens: 'Excessive Valsalva maneuver during low load.',
        theFix:
          'Breathe shallowly ("sipping air") behind the shield of abdominal tension.',
      },
    ],
  },
  {
    pattern: 'Hip CARs',
    rows: [
      {
        mistake: 'Pelvic Hiking',
        whyItHappens:
          'Compensation via Quadratus Lumborum; faking abduction range.',
        theFix:
          'Visualize a level of water across your waistline that cannot spill.',
      },
      {
        mistake: 'Lumbar Extension',
        whyItHappens: 'Using spinal erectors to mimic hip extension.',
        theFix:
          'Engage anterior core (ribs down) before extending the hip.',
      },
      {
        mistake: 'Contralateral Knee Bend',
        whyItHappens: 'Loss of plantar anchor stability; energy leak.',
        theFix:
          'Lock the standing knee and squeeze the standing quad hard.',
      },
      {
        mistake: 'Speed (Rushing)',
        whyItHappens: 'Utilizing momentum rather than tissue tension.',
        theFix:
          'Slow down. Imagine moving the leg through viscous air or mud.',
      },
    ],
  },
  {
    pattern: 'Tibial',
    rows: [
      {
        mistake: 'Ankle Dissociation Failure',
        whyItHappens:
          'Moving the foot side-to-side (inversion/eversion) rather than rotating the shin.',
        theFix:
          "Keep the ankle rigidly dorsiflexed at 90°. Watch the tibial tuberosity; if that bump isn't moving, the knee isn't rotating.",
      },
      {
        mistake: 'Femoral Drift',
        whyItHappens: 'The thigh sways left and right to mimic rotation.',
        theFix:
          'Tighten the "headlock" on your thigh. Imagine your femur is a steel rod stuck in cement.',
      },
      {
        mistake: 'Extension Locking',
        whyItHappens: 'Extending the leg too straight.',
        theFix:
          'Keep the knee bent at least 90°. Rotation is physically impossible at full extension due to ligament tautness.',
      },
      {
        mistake: 'Speed',
        whyItHappens: 'Bouncing back and forth.',
        theFix:
          'Slow down. Imagine moving through wet cement. High tension, low speed.',
      },
    ],
  },
  {
    pattern: 'Ankle',
    rows: [
      {
        mistake: 'Tibial Rotation',
        whyItHappens:
          'Torque leaks into the knee; fails to isolate the ankle capsule.',
        theFix:
          "Palpate the shin bone; ensure the logo on your sock doesn't turn.",
      },
      {
        mistake: 'Toe Leading',
        whyItHappens:
          'False range of motion created by toe extensors rather than ankle movers.',
        theFix: 'Keep toes relaxed; drive movement from the ankle/heel.',
      },
      {
        mistake: 'Cutting Corners',
        whyItHappens:
          'Reduces mechanotransduction signaling to the joint capsule tissue.',
        theFix:
          'Draw the largest possible circle at the outer limits of motion.',
      },
    ],
  },
  {
    pattern: 'Swimmers',
    rows: [
      {
        mistake: 'Lumbar Extension (Rib Flare)',
        whyItHappens:
          'Lack of anterior core stiffness; compensating for limited shoulder flexion by arching the back.',
        theFix:
          'Exhale fully to depress ribs before starting. Drive hips into the floor. Imagine a weight is resting on your mid-back.',
      },
      {
        mistake: 'Elbow Flexion Compensation',
        whyItHappens:
          'Triceps weakness or shortening of the lever arm to reduce torque on the shoulder.',
        theFix:
          'Keep elbows "locked out" straight during the sweep phase. Focus on reaching outward to the walls, not just up.',
      },
      {
        mistake: 'Forward Head Posture',
        whyItHappens:
          'Overactive Upper Trapezius and Levator Scapulae trying to assist in lift.',
        theFix:
          'Rest forehead on a yoga block. Maintain a "double chin" position to engage deep neck flexors.',
      },
      {
        mistake: 'Rushing the Rotation',
        whyItHappens:
          'Avoiding the point of maximal mechanical disadvantage (the transition point).',
        theFix:
          'Slow down. Treat the rotation at the "T" position as a distinct, separate movement. Rotate fully before continuing overhead.',
      },
    ],
  },
  {
    pattern: 'Press-Press',
    rows: [
      {
        mistake: 'Rib Flare (Lumbar Hyperextension)',
        whyItHappens:
          'Substitutes lumbar extension for thoracic extension, increasing shear force on L4-L5.',
        theFix:
          'Exhale forcefully on the "Fling" to depress ribs; engage glutes.',
      },
      {
        mistake: 'Forward Head Posture',
        whyItHappens:
          'Creates cervical compression and disconnects the kinetic chain.',
        theFix:
          'Tuck chin slightly ("double chin") throughout the movement.',
      },
      {
        mistake: 'Uncontrolled Ballistics',
        whyItHappens:
          'Risks anterior capsule strain if eccentric strength is insufficient.',
        theFix:
          'Build speed gradually; focus on the muscular squeeze at end-range.',
      },
      {
        mistake: 'Shoulder Elevation',
        whyItHappens:
          'Over-recruits Upper Trapezius, reducing effectiveness for Mid-Traps/Rhomboids.',
        theFix:
          'Keep shoulders depressed (away from ears) during the press.',
      },
    ],
  },
  {
    pattern: 'Adductor',
    rows: [
      {
        mistake: 'Lumbar Flexion (Butt Wink)',
        whyItHappens:
          'Reduces stretch on adductor magnus; places shear force on lumbar discs.',
        theFix: 'Stop the rock before your lower back rounds. Keep chest up.',
      },
      {
        mistake: 'Knee Flexion (Extended Leg)',
        whyItHappens:
          'Shortens the lever arm and gracilis muscle, minimizing the stretch.',
        theFix:
          'Lock the knee of the extended leg. Engage the quadriceps.',
      },
      {
        mistake: 'Hyperextension (Sway Back)',
        whyItHappens:
          'Jams lumbar facets; creates false range of motion without hip mobility.',
        theFix:
          'Brace the core (ribs down) before initiating movement.',
      },
      {
        mistake: 'Ballistic Bouncing',
        whyItHappens:
          'Triggers the myotatic (stretch) reflex, causing muscles to contract rather than relax.',
        theFix:
          'Move with a slow, controlled tempo. Think "hydraulic" movement.',
      },
    ],
  },
  {
    pattern: 'Segmental',
    rows: [
      {
        mistake: 'Hinging (Block Movement)',
        whyItHappens:
          'Moving the spine in large chunks (e.g., all thoracic at once).',
        theFix:
          'Slow down significantly and visualize the space between each vertebra expanding.',
      },
      {
        mistake: 'Leading with the Head',
        whyItHappens:
          'Lifting or dropping the head before the wave reaches the neck.',
        theFix:
          'Keep the chin tucked/lifted until the movement naturally arrives at the cervical spine.',
      },
      {
        mistake: 'Elbow Compensation',
        whyItHappens:
          'Bending the elbows to create the illusion of more range of motion.',
        theFix:
          'Keep elbows locked; all movement must come from the spinal column.',
      },
      {
        mistake: 'Scapular Collapse',
        whyItHappens:
          'Letting the chest sink between shoulders passively.',
        theFix:
          'Maintain active push against the floor to stabilize the shoulder girdle.',
      },
    ],
  },
  {
    pattern: "Child's Pose",
    rows: [
      {
        mistake: 'Elevated Shoulders (Shrugging)',
        whyItHappens:
          'Compresses the cervical spine and engages Upper Trapezius instead of Lats.',
        theFix:
          'Externally rotate shoulders ("wrap triceps down") and draw scapulae toward hips.',
      },
      {
        mistake: 'Hips Elevated High',
        whyItHappens:
          'Reduces flexion at the Acetabulofemoral joint; shifts weight excessively into hands.',
        theFix:
          'Place a bolster or block between calves and hamstrings to support the pivot point.',
      },
      {
        mistake: 'Shallow "Chest" Breathing',
        whyItHappens:
          'Fails to utilize intra-abdominal pressure to massage the lumbar spine from the inside.',
        theFix:
          'Focus on expanding the lower back ribs; visualize filling a balloon in your lower back.',
      },
    ],
  },
];

export function getWarmupMistakesCorrections(
  exerciseName: string
): MistakeCorrectionRow[] | undefined {
  const name = exerciseName.trim();
  const match = WARMUP_MISTAKES_CORRECTIONS.find(({ pattern }) =>
    name.toLowerCase().includes(pattern.toLowerCase())
  );
  return match?.rows;
}

/** Short descriptive subtitle per exercise (pattern match). Shown above instructions in sidebar. */
const WARMUP_SUBTITLES: { pattern: string; subtitle: string }[] = [
  {
    pattern: 'Cervical',
    subtitle:
      'The fundamental prerequisite for neck health. A daily assessment and maintenance tool to preserve the full rotational capacity of the cervical spine.',
  },
  {
    pattern: 'Glenohumeral',
    subtitle:
      'The gold standard for assessing shoulder health, expanding articular range of motion, and insulating the capsule against injury.',
  },
  {
    pattern: 'Scapular',
    subtitle:
      'A foundational joint health exercise designed to maximize the independent rotational capacity of the scapulothoracic complex.',
  },
  {
    pattern: 'Thoracic',
    subtitle:
      'Thoracic Controlled Articular Rotations (CARs) are designed to decouple the movement of the thoracic spine (T1–T12) from the cervical and lumbar regions. Biomechanically, the goal is to explore the maximal outer limits of the articular capsule, stimulating mechanoreceptors and improving tissue extensibility.',
  },
  {
    pattern: 'Hip CARs',
    subtitle:
      'The gold standard for acetabulofemoral hygiene, dissociation, and end-range control.',
  },
  {
    pattern: 'Tibial',
    subtitle:
      'Open Kinetic Chain (OKC) focusing on dissociation of the tibiofemoral joint.',
  },
  {
    pattern: 'Ankle',
    subtitle:
      'Controlled Articular Rotations for the talocrural and subtalar joints.',
  },
  {
    pattern: 'Swimmers',
    subtitle:
      'An advanced end-range mobility exercise focusing on the dissociation of the glenohumeral joint from the scapula and spine.',
  },
  {
    pattern: 'Press-Press',
    subtitle:
      'This movement utilizes the Stretch-Shortening Cycle (SSC) to dynamically mobilize the shoulder girdle.',
  },
  {
    pattern: 'Adductor',
    subtitle:
      'A foundational mobility drill designed to restore acetabulofemoral range of motion and dynamically lengthen the medial thigh musculature.',
  },
  {
    pattern: 'Segmental',
    subtitle:
      'This is a test of cortical mapping—your brain\'s ability to "find" and move individual vertebrae.',
  },
  {
    pattern: "Child's Pose",
    subtitle:
      'The fundamental pose for spinal elongation, hip flexion mobility, and parasympathetic nervous system activation.',
  },
];

export function getWarmupSubtitle(exerciseName: string): string | undefined {
  const name = exerciseName.trim();
  const match = WARMUP_SUBTITLES.find(({ pattern }) =>
    name.toLowerCase().includes(pattern.toLowerCase())
  );
  return match?.subtitle;
}

export const WARMUP_EXERCISES: { name: string; detail: string }[] = [
  { name: 'Cervical CARs - Left', detail: 'Slow, full-range neck circles' },
  { name: 'Cervical CARs - Right', detail: 'Slow, full-range neck circles' },
  // Order: one direction both sides, then other direction both sides (not both directions same side).
  { name: 'Glenohumeral CARs - Left Reverse', detail: 'Slow, full-range shoulder rotation' },
  { name: 'Glenohumeral CARs - Right Reverse', detail: 'Slow, full-range shoulder rotation' },
  { name: 'Glenohumeral CARs - Left Forward', detail: 'Slow, full-range shoulder rotation' },
  { name: 'Glenohumeral CARs - Right Forward', detail: 'Slow, full-range shoulder rotation' },
  { name: 'Scapular CARs - Forward', detail: 'Slow, full-range shoulder blade circles' },
  { name: 'Scapular CARs - Reverse', detail: 'Slow, full-range shoulder blade circles' },
  { name: 'Thoracic CARs - Left', detail: 'Slow, full-range thoracic circles' },
  { name: 'Thoracic CARs - Right', detail: 'Slow, full-range thoracic circles' },
  { name: 'Hip CARs - Left Reverse', detail: 'Slow, full-range hip rotation' },
  { name: 'Hip CARs - Right Reverse', detail: 'Slow, full-range hip rotation' },
  { name: 'Hip CARs - Left Forward', detail: 'Slow, full-range hip rotation' },
  { name: 'Hip CARs - Right Forward', detail: 'Slow, full-range hip rotation' },
  { name: 'Tibial CARs - Left Clockwise', detail: 'Slow, full-range tibial rotation' },
  { name: 'Tibial CARs - Right Clockwise', detail: 'Slow, full-range tibial rotation' },
  { name: 'Tibial CARs - Left Counter', detail: 'Slow, full-range tibial rotation' },
  { name: 'Tibial CARs - Right Counter', detail: 'Slow, full-range tibial rotation' },
  { name: 'Ankle CARs - Left Clockwise', detail: 'Slow, full-range ankle rotation' },
  { name: 'Ankle CARs - Right Clockwise', detail: 'Slow, full-range ankle rotation' },
  { name: 'Ankle CARs - Left Counter', detail: 'Slow, full-range ankle rotation' },
  { name: 'Ankle CARs - Right Counter', detail: 'Slow, full-range ankle rotation' },
  { name: 'Swimmers', detail: 'Alternate every 3' },
  { name: 'Press-Press Flings', detail: '' },
  { name: 'Adductor Rock', detail: 'Begin in Quadruplex — Left Side' },
  { name: 'Adductor Rock', detail: 'Begin in Quadruplex — Right Side' },
  { name: 'Segmental Cat-Cows', detail: 'Move vertebrae individually' },
  { name: "Child's Pose", detail: 'Rest and breathe' },
];

export const WARMUP_DURATION_PER_EXERCISE = 30;

/** Pause between warmup exercises (same exercise, different side/direction): main timer stops, "Next" countdown. */
export const WARMUP_TRANSITION_SECONDS = 5;

/** Pause when switching to a different warmup exercise: longer break so user can change position. */
export const WARMUP_TRANSITION_EXERCISE_CHANGE_SECONDS = 10;

/** 10-second setup block after warmup so user can get into position before first work interval. */
export const SETUP_DURATION_SECONDS = 10;

export const DEFAULT_WARMUP_TOTAL_SECONDS = WARMUP_EXERCISES.length * WARMUP_DURATION_PER_EXERCISE;

/**
 * Base name for "same exercise" comparison: part before " - " or full name.
 * Same base → same exercise (different side/direction) → 5s; different base → 10s.
 */
function getWarmupExerciseBaseName(name: string): string {
  const idx = name.indexOf(' - ');
  return idx >= 0 ? name.slice(0, idx).trim() : name.trim();
}

/**
 * Returns transition seconds between two warmup exercises: 5s if same exercise (different side/direction), 10s if different exercise.
 */
export function getWarmupTransitionSeconds(
  currentExerciseName: string,
  nextExerciseName: string
): number {
  const currentBase = getWarmupExerciseBaseName(currentExerciseName);
  const nextBase = getWarmupExerciseBaseName(nextExerciseName);
  return currentBase === nextBase
    ? WARMUP_TRANSITION_SECONDS
    : WARMUP_TRANSITION_EXERCISE_CHANGE_SECONDS;
}

export function getSetupBlock(): HIITTimelineBlock {
  return {
    type: 'setup',
    duration: SETUP_DURATION_SECONDS,
    name: 'Setup',
    notes: 'Get into position',
  };
}

/**
 * Returns the default warmup block for all interval timers.
 * 14 min (840s) = 28 exercises × 30s. IntervalTimerOverlay shows WarmUpWheel during this block.
 */
export function getDefaultWarmupBlock(): HIITTimelineBlock {
  return {
    type: 'warmup',
    duration: DEFAULT_WARMUP_TOTAL_SECONDS,
    name: 'Daily Warm Up',
    notes: 'Joint mobility & activation',
  };
}
