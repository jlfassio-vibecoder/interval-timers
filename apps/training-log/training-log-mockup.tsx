import React, { useState } from 'react';
import { ArrowLeft, Calendar, Search, ChevronDown, User, X } from 'lucide-react';

const WeeklyTrainingLog = () => {
  const [selectedWorkoutType, setSelectedWorkoutType] = useState('All');
  const [selectedFormat, setSelectedFormat] = useState('All');
  const [selectedDuration, setSelectedDuration] = useState('All');
  const [excludeActiveRest, setExcludeActiveRest] = useState(false);
  const [showWorkoutTypeDropdown, setShowWorkoutTypeDropdown] = useState(false);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showWorkoutSummary, setShowWorkoutSummary] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [hoveredMultiWorkout, setHoveredMultiWorkout] = useState(null);

  const workoutTypes = [
    'All', 'Strength', 'Hypertrophy', 'Power', 'Endurance', 'Speed', 'Agility', 'Mobility',
    'Stability', 'Balance', 'Core', 'Flexibility', 'Conditioning', 'Stamina', 'Fat Loss',
    'Muscle Building', 'Explosiveness', 'Athleticism', 'Recovery', 'Resilience', 'Posture',
    'Coordination', 'Range of Motion', 'Injury Prevention', 'Metabolic Health', 'Cardiovascular Fitness'
  ];

  const workoutFormats = [
    'All',
    'HIIT',
    'Straight Sets',
    'Circuit',
    'AMRAP',
    'EMOM',
    'Tabata',
    'Ladder',
    'Pyramid',
    'Superset',
    'Drop Set',
    'Rest-Pause',
    'Cluster Set',
    'Giant Set',
    'Time Under Tension',
    'Isometric',
    'Plyometric',
    'Compound',
    'Isolation',
    'Interval',
    'Steady State',
    'Fartlek',
    'Tempo',
    'Progressive Overload',
    'Density Training',
    'Volume Training',
    'Max Effort',
    'Dynamic Effort',
    'Conjugate',
    'Undulating',
    'Linear Progression',
    'Wave Loading',
    'Rest Day',
    'Active Recovery',
    'Deload'
  ];

  const durationFilters = [
    'All',
    '15 min',
    '30 min', 
    '45 min',
    '60 min',
    '90 min',
    '120+ min'
  ];

  const getDurationRange = (filter) => {
    switch(filter) {
      case '15 min': return { min: 0, max: 15 };
      case '30 min': return { min: 16, max: 30 };
      case '45 min': return { min: 31, max: 45 };
      case '60 min': return { min: 46, max: 60 };
      case '90 min': return { min: 61, max: 90 };
      case '120+ min': return { min: 91, max: Infinity };
      default: return { min: 0, max: Infinity };
    }
  };

  const getBubbleColor = (minutes) => {
    if (minutes === 0) return 'bg-slate-200';
    if (minutes <= 30) return 'bg-gray-600';
    if (minutes <= 60) return 'bg-green-600';
    if (minutes <= 90) return 'bg-orange-500';
    if (minutes <= 120) return 'bg-red-500';
    return 'bg-red-700';
  };

  const getCircleSize = (minutes) => {
    if (minutes === 0) return 'w-6 h-6';
    if (minutes <= 30) return 'w-7 h-7';
    if (minutes <= 60) return 'w-8 h-8';
    if (minutes <= 90) return 'w-10 h-10';
    if (minutes <= 120) return 'w-12 h-12';
    return 'w-14 h-14';
  };

  const getTextSize = (minutes) => {
    if (minutes <= 30) return 'text-xs';
    if (minutes <= 60) return 'text-xs';
    if (minutes <= 90) return 'text-sm';
    if (minutes <= 120) return 'text-sm';
    return 'text-base';
  };

  // Function to split workout time for multiple sessions
  const splitWorkoutTime = (totalMinutes, count) => {
    if (count <= 1) return [totalMinutes];
    
    const workouts = [];
    let remaining = totalMinutes;
    
    for (let i = 0; i < count - 1; i++) {
      // Split between 30-70% of remaining time for variety
      const split = Math.floor(remaining * (0.3 + Math.random() * 0.4));
      workouts.push(split);
      remaining -= split;
    }
    workouts.push(remaining);
    
    return workouts.sort((a, b) => b - a); // Sort largest first
  };

  const shouldShowWorkout = (minutes, count) => {
    if (selectedDuration === 'All') return true;
    
    const range = getDurationRange(selectedDuration);
    
    // For multiple workouts, check if any split workout falls in range
    if (count > 1) {
      const workoutTimes = splitWorkoutTime(minutes, count);
      return workoutTimes.some(time => time >= range.min && time <= range.max);
    }
    
    // For single workouts, check if the total falls in range
    return minutes >= range.min && minutes <= range.max;
  };

  // Sample workout data for demonstrations
  const sampleWorkouts = {
    85: {
      title: "Morning Strength Session",
      date: "Dec 16, 2024",
      intensity: "High",
      focus: "Upper Body",
      user_notes: "Felt strong on bench press today. Increased weight by 5lbs.",
      warmup: [
        "Dynamic arm circles — 30 sec",
        "Band pull-aparts — 15 reps",
        "Shoulder dislocates — 10 reps",
        "Push-up prep holds — 30 sec"
      ],
      main: [
        "Bench Press — 4×8 @ 185lbs",
        "Pull-ups — 3×6",
        "Overhead Press — 3×10 @ 95lbs",
        "Barbell Rows — 4×8 @ 135lbs",
        "Dips — 3×12",
        "Face Pulls — 3×15"
      ],
      cooldown: [
        "Chest doorway stretch — 30 sec",
        "Overhead tricep stretch — 30 sec/arm",
        "Cross-body shoulder stretch — 30 sec/arm"
      ]
    },
    123: {
      title: "Advanced Plates-Style Deep Core Blast",
      date: "Dec 18, 2024",
      intensity: "Moderate",
      focus: "Core Stability",
      user_notes: "Felt strong on plank push variations. Really challenging workout!",
      warmup: [
        "Cat-Cow Flow — 30 sec",
        "Bird Dog Reach — 2×20 sec each side",
        "Standing Torso Rotations — 30 sec",
        "Hollow Body Activation Hold — 30 sec"
      ],
      main: [
        "Long-Lever Plank Hold — 45 sec",
        "Plank Plate Reaches — 12 reps",
        "Side Plank Arm Driver — 20 sec/side",
        "Plank Toe Tap Outs — 16 reps",
        "L-Sit Plate Push — 30 sec / rest 30 sec",
        "Forearm Plank Saw — 20 reps",
        "Plate Wiper Holds — 12 reps",
        "Side Plank Slide — 8/side",
        "Shoulder Tap Hold — 10 reps/arm",
        "Hollow Plate Press — 30 sec / rest 30 sec"
      ],
      cooldown: [
        "Supine Spinal Twist — 30 sec/side",
        "Child's Pose or Seated Fold — 30 sec",
        "Overhead Side Reach — 30 sec/side"
      ]
    },
    145: {
      title: "HIIT Cardio & Conditioning",
      date: "Dec 20, 2024",
      intensity: "Very High",
      focus: "Cardiovascular Fitness",
      user_notes: "Pushed through the final rounds. Great sweat session!",
      warmup: [
        "Jumping jacks — 30 sec",
        "High knees — 30 sec",
        "Butt kicks — 30 sec",
        "Arm swings — 30 sec"
      ],
      main: [
        "Burpees — 30 sec work / 15 sec rest",
        "Mountain climbers — 30 sec work / 15 sec rest",
        "Jump squats — 30 sec work / 15 sec rest",
        "Push-up to T — 30 sec work / 15 sec rest",
        "Plank jacks — 30 sec work / 15 sec rest",
        "Russian twists — 30 sec work / 15 sec rest",
        "Repeat circuit 4 times"
      ],
      cooldown: [
        "Walking in place — 2 min",
        "Standing quad stretch — 30 sec/leg",
        "Standing calf stretch — 30 sec/leg",
        "Deep breathing — 1 min"
      ]
    },
    67: {
      title: "Evening Mobility Session",
      date: "Dec 16, 2024",
      intensity: "Low",
      focus: "Flexibility & Recovery",
      user_notes: "Perfect way to unwind after a long day.",
      warmup: [
        "Gentle neck rolls — 30 sec",
        "Shoulder shrugs — 15 reps",
        "Arm circles — 30 sec each direction"
      ],
      main: [
        "Deep hip flexor stretch — 90 sec each leg",
        "Pigeon pose — 2 min each side",
        "Seated spinal twist — 60 sec each side",
        "Forward fold progression — 3 min",
        "Cat-cow flow — 2 min",
        "Child's pose hold — 3 min"
      ],
      cooldown: [
        "Legs up the wall — 5 min",
        "Corpse pose with breathing — 5 min"
      ]
    },
    78: {
      title: "Quick Morning Cardio",
      date: "Dec 2, 2024",
      intensity: "Moderate",
      focus: "Cardiovascular Fitness",
      user_notes: "Great way to start the day with energy!",
      warmup: [
        "Marching in place — 1 min",
        "Arm swings — 30 sec",
        "Leg swings — 30 sec each leg"
      ],
      main: [
        "Jumping jacks — 2 min",
        "High knees — 1 min",
        "Butt kicks — 1 min",
        "Mountain climbers — 2 min",
        "Step-ups — 3 min",
        "Cool down walk — 5 min"
      ],
      cooldown: [
        "Standing quad stretch — 30 sec each leg",
        "Calf stretch — 30 sec each leg",
        "Deep breathing — 2 min"
      ]
    },
    24: {
      title: "Afternoon Core Blast",
      date: "Dec 2, 2024", 
      intensity: "High",
      focus: "Core Strength",
      user_notes: "Quick but intense session during lunch break.",
      warmup: [
        "Dead bug — 30 sec",
        "Bird dog — 30 sec each side"
      ],
      main: [
        "Plank hold — 3×45 sec",
        "Russian twists — 3×20",
        "Bicycle crunches — 3×30",
        "Mountain climbers — 3×30 sec",
        "Dead bug — 3×10 each side"
      ],
      cooldown: [
        "Knees to chest — 30 sec",
        "Spinal twist — 30 sec each side"
      ]
    },
    76: {
      title: "Lower Body Strength",
      date: "Nov 26, 2024",
      intensity: "High", 
      focus: "Leg Strength",
      user_notes: "Focused on form over speed today.",
      warmup: [
        "Bodyweight squats — 15 reps",
        "Leg swings — 10 each direction",
        "Walking lunges — 20 steps"
      ],
      main: [
        "Goblet squats — 4×12",
        "Romanian deadlifts — 4×10",
        "Bulgarian split squats — 3×8 each leg",
        "Calf raises — 4×15",
        "Glute bridges — 3×15"
      ],
      cooldown: [
        "Quad stretch — 30 sec each leg",
        "Hamstring stretch — 30 sec each leg",
        "Hip flexor stretch — 30 sec each leg"
      ]
    },
    26: {
      title: "Evening Yoga Flow",
      date: "Nov 26, 2024",
      intensity: "Low",
      focus: "Flexibility & Mind-Body",
      user_notes: "Relaxing end to the day.",
      warmup: [
        "Mountain pose with breathing — 1 min",
        "Gentle neck rolls — 30 sec"
      ],
      main: [
        "Sun salutation A — 3 rounds",
        "Warrior sequence — 2 min each side", 
        "Triangle pose — 1 min each side",
        "Seated forward fold — 2 min",
        "Supine twist — 1 min each side"
      ],
      cooldown: [
        "Legs up wall pose — 3 min",
        "Savasana — 5 min"
      ]
    }
  };

  const handleWorkoutClick = (minutes, workoutIndex = 0) => {
    if (minutes > 0 && sampleWorkouts[minutes]) {
      setSelectedWorkout(sampleWorkouts[minutes]);
      setShowWorkoutSummary(true);
    }
  };

  const ActivityDot = ({ count, value, color, isEmpty, dayIndex, weekIndex }) => {
    const uniqueKey = `${weekIndex}-${dayIndex}`;
    const isHovered = hoveredMultiWorkout === uniqueKey;
    
    // Check if this workout should be shown based on duration filter
    const shouldShow = shouldShowWorkout(value, count);
    
    if (isEmpty || (!shouldShow && value > 0)) {
      return (
        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-slate-400"></div>
        </div>
      );
    }

    const circleSize = getCircleSize(value);
    const textSize = getTextSize(value);
    
    // Color maps for pulsing rings
    const lightColorMap = {
      'bg-gray-600': 'bg-gray-400',
      'bg-green-600': 'bg-green-400',
      'bg-orange-500': 'bg-orange-300',
      'bg-red-500': 'bg-red-300',
      'bg-red-700': 'bg-red-400'
    };

    const lighterColorMap = {
      'bg-gray-600': 'bg-gray-200',
      'bg-green-600': 'bg-green-200',
      'bg-orange-500': 'bg-orange-200',
      'bg-red-500': 'bg-red-200',
      'bg-red-700': 'bg-red-200'
    };
    
    // For multiple workouts, show split circles on hover only
    if (count > 1 && isHovered) {
      const workoutTimes = splitWorkoutTime(value, count);
      
      // Show split circles on hover
      return (
        <div 
          className="flex gap-1 items-center justify-center"
          onMouseLeave={() => setHoveredMultiWorkout(null)}
        >
          {workoutTimes.map((time, index) => {
            const splitSize = getCircleSize(time);
            const splitTextSize = getTextSize(time);
            const splitColor = getBubbleColor(time);
            
            return (
              <div key={index} className="relative flex items-center justify-center">
                {/* Pulsing rings for split workouts */}
                <div className={`absolute rounded-full ${lighterColorMap[splitColor]} opacity-30 animate-pulse`} 
                     style={{
                       width: `calc(${splitSize.split(' ')[0].replace('w-', '')} * 0.25rem + 12px)`,
                       height: `calc(${splitSize.split(' ')[1].replace('h-', '')} * 0.25rem + 12px)`
                     }}>
                </div>
                
                <div className={`absolute rounded-full ${lightColorMap[splitColor]} opacity-50 animate-pulse`}
                     style={{
                       width: `calc(${splitSize.split(' ')[0].replace('w-', '')} * 0.25rem + 6px)`,
                       height: `calc(${splitSize.split(' ')[1].replace('h-', '')} * 0.25rem + 6px)`,
                       animationDelay: '0.2s'
                     }}>
                </div>

                <div 
                  className={`relative ${splitSize} rounded-full flex items-center justify-center text-white ${splitTextSize} font-bold ${splitColor} cursor-pointer hover:scale-110 transition-transform z-10`}
                  onClick={() => handleWorkoutClick(time)}
                >
                  {time}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Default display (single workout OR multiple workouts when not hovered)
    return (
      <div 
        className="relative flex items-center justify-center"
        onMouseEnter={() => count > 1 ? setHoveredMultiWorkout(uniqueKey) : null}
      >
        {/* Outermost ring - lightest */}
        <div className={`absolute rounded-full ${lighterColorMap[color]} opacity-30 animate-pulse`} 
             style={{
               width: `calc(${circleSize.split(' ')[0].replace('w-', '')} * 0.25rem + 16px)`,
               height: `calc(${circleSize.split(' ')[1].replace('h-', '')} * 0.25rem + 16px)`
             }}>
        </div>
        
        {/* Middle ring */}
        <div className={`absolute rounded-full ${lightColorMap[color]} opacity-50 animate-pulse`}
             style={{
               width: `calc(${circleSize.split(' ')[0].replace('w-', '')} * 0.25rem + 8px)`,
               height: `calc(${circleSize.split(' ')[1].replace('h-', '')} * 0.25rem + 8px)`,
               animationDelay: '0.2s'
             }}>
        </div>

        {/* Core circle */}
        <div 
          className={`relative ${circleSize} rounded-full flex items-center justify-center text-white ${textSize} font-bold ${color} cursor-pointer hover:scale-110 transition-transform z-10`}
          onClick={() => handleWorkoutClick(value)}
        >
          {value > 0 && value}
          {count > 1 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 text-xs bg-black text-white rounded-full flex items-center justify-center">
              {count}
            </span>
          )}
        </div>
      </div>
    );
  };

  const weeks = [
    {
      range: "Dec 16 – 22",
      totalMinutes: 542,
      days: [
        { count: 1, minutes: 85, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 2, minutes: 123, isEmpty: false },
        { count: 1, minutes: 67, isEmpty: false },
        { count: 1, minutes: 145, isEmpty: false },
        { count: 1, minutes: 81, isEmpty: false },
        { count: 1, minutes: 41, isEmpty: false }
      ]
    },
    {
      range: "Dec 9 – 15",
      totalMinutes: 488,
      days: [
        { count: 0, minutes: 0, isEmpty: true },
        { count: 1, minutes: 92, isEmpty: false },
        { count: 1, minutes: 123, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 1, minutes: 145, isEmpty: false },
        { count: 1, minutes: 81, isEmpty: false },
        { count: 1, minutes: 47, isEmpty: false }
      ]
    },
    {
      range: "Dec 2 – 8",
      totalMinutes: 243,
      days: [
        { count: 1, minutes: 122, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 1, minutes: 78, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 1, minutes: 43, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true }
      ]
    },
    {
      range: "Nov 25 – Dec 1",
      totalMinutes: 188,
      days: [
        { count: 0, minutes: 0, isEmpty: true },
        { count: 1, minutes: 76, isEmpty: false },
        { count: 2, minutes: 102, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 1, minutes: 10, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true }
      ]
    },
    {
      range: "Nov 18 – 24",
      totalMinutes: 142,
      days: [
        { count: 0, minutes: 0, isEmpty: true },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 1, minutes: 55, isEmpty: false },
        { count: 1, minutes: 32, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 1, minutes: 55, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true }
      ]
    },
    {
      range: "Nov 11 – 17",
      totalMinutes: 92,
      days: [
        { count: 0, minutes: 0, isEmpty: true },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 1, minutes: 92, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true }
      ]
    },
    {
      range: "Nov 4 – 10",
      totalMinutes: 167,
      days: [
        { count: 1, minutes: 45, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 1, minutes: 78, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 1, minutes: 44, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 0, minutes: 0, isEmpty: true }
      ]
    },
    {
      range: "Oct 28 – Nov 3",
      totalMinutes: 67,
      days: [
        { count: 1, minutes: 67, isEmpty: false },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 0, minutes: 0, isEmpty: true },
        { count: 0, minutes: 0, isEmpty: true }
      ]
    }
  ];

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Training Log Content */}
      <div className="bg-white text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-slate-900">Training Logs</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button className="text-slate-600 hover:text-slate-900 transition-colors">
              <Calendar className="w-5 h-5" />
            </button>
            <button className="text-slate-600 hover:text-slate-900 transition-colors">
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 flex flex-wrap gap-3 border-b border-slate-200 bg-slate-50">
          {/* Workout Type Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowWorkoutTypeDropdown(!showWorkoutTypeDropdown)}
              className={`flex items-center space-x-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                selectedWorkoutType === 'All' 
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  : 'bg-slate-900 text-white border-slate-900'
              }`}
            >
              <span>{selectedWorkoutType === 'All' ? 'Type' : selectedWorkoutType}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {showWorkoutTypeDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                {workoutTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedWorkoutType(type);
                      setShowWorkoutTypeDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                      selectedWorkoutType === type ? 'bg-slate-100 font-medium' : ''
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Format Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFormatDropdown(!showFormatDropdown)}
              className={`flex items-center space-x-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                selectedFormat === 'All' 
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  : 'bg-slate-900 text-white border-slate-900'
              }`}
            >
              <span>{selectedFormat === 'All' ? 'Format' : selectedFormat}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {showFormatDropdown && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                {workoutFormats.map((format) => (
                  <button
                    key={format}
                    onClick={() => {
                      setSelectedFormat(format);
                      setShowFormatDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                      selectedFormat === format ? 'bg-slate-100 font-medium' : ''
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Duration Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDurationDropdown(!showDurationDropdown)}
              className={`flex items-center space-x-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                selectedDuration === 'All' 
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  : 'bg-slate-900 text-white border-slate-900'
              }`}
            >
              <span>{selectedDuration === 'All' ? 'Duration' : selectedDuration}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {showDurationDropdown && (
              <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-lg z-20">
                {durationFilters.map((duration) => (
                  <button
                    key={duration}
                    onClick={() => {
                      setSelectedDuration(duration);
                      setShowDurationDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                      selectedDuration === duration ? 'bg-slate-100 font-medium' : ''
                    }`}
                  >
                    {duration}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Exclude Active Rest Toggle */}
          <button
            onClick={() => setExcludeActiveRest(!excludeActiveRest)}
            className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              excludeActiveRest
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Exclude Active Rest Logs
          </button>
        </div>

        {/* Day Labels Header */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-7 gap-2 ml-24">
            {dayLabels.map((day, i) => (
              <div key={i} className="text-center text-xs font-medium text-slate-500 w-16 flex justify-center">
                {day}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Weekly Log */}
        <div className="overflow-y-auto">
          {weeks.map((week, weekIndex) => (
            <div key={week.range} className="px-4 py-4 border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
              
              <div className="flex items-center">
                {/* Week Header */}
                <div className="w-24 flex-shrink-0">
                  <div className="text-xs text-slate-500 mb-1">{week.range}</div>
                  <div 
                    className="text-sm font-bold"
                    style={{
                      color: week.totalMinutes < 100 
                        ? '#dc2626' 
                        : week.totalMinutes <= 149 
                        ? '#f59e0b' 
                        : '#16a34a'
                    }}
                  >
                    {week.totalMinutes} min
                  </div>
                </div>
                
                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-2 flex-1">
                  {week.days.map((day, dayIndex) => (
                    <div key={dayIndex} className="flex justify-center">
                      <ActivityDot
                        count={day.count}
                        value={day.minutes}
                        color={getBubbleColor(day.minutes)}
                        isEmpty={day.isEmpty}
                        dayIndex={dayIndex}
                        weekIndex={weekIndex}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom padding for better scrolling */}
        <div className="h-20"></div>
      </div>

      {/* Workout Summary Modal */}
      {showWorkoutSummary && selectedWorkout && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-slate-900">Workout Summary</h2>
              <button
                onClick={() => setShowWorkoutSummary(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Main Body */}
            <div className="p-6 space-y-6">
              {/* Title & Tags */}
              <div className="text-center">
                <h3 className="text-xl font-semibold text-slate-900 mb-1">
                  {selectedWorkout.title}
                </h3>
                <div className="flex flex-wrap justify-center gap-2 text-sm text-slate-600">
                  <span className="bg-slate-100 px-2 py-1 rounded-md">Bodyweight Only</span>
                  <span className="bg-slate-100 px-2 py-1 rounded-md">Knee-Friendly</span>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-4 text-sm text-slate-700 font-medium">
                <div>⏱️ <strong>Estimated Duration:</strong> 15–18 min</div>
                <div>📆 <strong>Logged:</strong> {selectedWorkout.date}</div>
                {selectedWorkout.intensity && (
                  <div>🔥 <strong>Intensity:</strong> {selectedWorkout.intensity}</div>
                )}
                {selectedWorkout.focus && (
                  <div>🎯 <strong>Focus:</strong> {selectedWorkout.focus}</div>
                )}
              </div>

              {/* Workout Sections */}
              {["warmup", "main", "cooldown"].map((section) => (
                <div key={section}>
                  <h4 className="text-base font-semibold text-slate-900 mb-2 capitalize">
                    {section === "warmup" ? "🔹 Warm-up" : section === "main" ? "💪 Main Workout" : "🧘 Cool-down"}
                  </h4>
                  <ul className="space-y-1 text-sm text-slate-700 list-disc list-inside pl-4">
                    {selectedWorkout[section].map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}

              {/* User Notes */}
              {selectedWorkout.user_notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="text-xs font-bold text-blue-800 uppercase mb-1">💭 Your Notes</div>
                  <div className="text-sm text-blue-700">{selectedWorkout.user_notes}</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowWorkoutSummary(false)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                View Full Workout
              </button>
              <button
                onClick={() => setShowWorkoutSummary(false)}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyTrainingLog;