import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BASE } from '../constants';

const FAILURE_CHART_DATA = [
  { name: 'Fails (High Error Margin)', value: 29, color: '#e11d48' },
  { name: 'Within Acceptable Range', value: 71, color: '#d6d3d1' },
];

const VT1_LABELS = ['Rest', 'Zone 1', 'Zone 2', 'VT1', 'Zone 3', 'VT2', 'Max'];
const LACTATE_DATA = [1.0, 1.0, 1.2, 2.0, 4.0, 8.0, 12.0];
const FAT_OX_DATA = [0.3, 0.5, 0.7, 0.8, 0.4, 0.1, 0.0];
const vt1ChartData = VT1_LABELS.map((label, i) => ({
  label,
  lactate: LACTATE_DATA[i],
  fatOx: FAT_OX_DATA[i],
}));

const VT1_THRESHOLD = 60;

const MitochondrialCalibration: React.FC = () => {
  const [tab, setTab] = useState<'inflexible' | 'flexible'>('inflexible');
  const [sliderVal, setSliderVal] = useState(45);

  const feedback = useMemo(() => {
    if (sliderVal < 30) {
      return {
        state: 'Recovery Zone',
        stateClass: 'text-stone-400',
        title: 'Active Recovery',
        text: 'Intensity is too low to drive significant mitochondrial biogenesis, but excellent for promoting blood flow and basic cellular maintenance without adding stress.',
        lactate: 'Neutral / Clearing',
        lactateClass: 'text-stone-400',
        stress: 'Minimal',
        stressClass: 'text-stone-400',
        boxClass: 'bg-stone-800 border-stone-700',
      };
    }
    if (sliderVal <= VT1_THRESHOLD) {
      return {
        state: 'Optimal Zone (Bio-Sync60)',
        stateClass: 'text-teal-300',
        title: 'Maximum Mitochondrial Biogenesis',
        text: 'Training just below VT1 creates the perfect biological signaling environment. It stresses the aerobic system enough to trigger the creation of new mitochondria, which act as sinks to clear lactate.',
        lactate: 'Increasing Capacity ↑',
        lactateClass: 'text-teal-400',
        stress: 'Moderate / Sustainable',
        stressClass: 'text-teal-400',
        boxClass: 'bg-teal-900/80 border-teal-700',
      };
    }
    return {
      state: 'Warning: Glycolytic Stress',
      stateClass: 'text-rose-300',
      title: 'Metabolic Inflexibility Risk',
      text: 'You have crossed VT1. The body is rapidly accumulating lactate and shifting to carbohydrate reliance. Prolonged training here without adequate base limits mitochondrial adaptation and increases fatigue.',
      lactate: 'Accumulating ↓',
      lactateClass: 'text-rose-400',
      stress: 'High / Exhaustive',
      stressClass: 'text-rose-400',
      boxClass: 'bg-rose-950/80 border-rose-800',
    };
  }, [sliderVal]);

  return (
    <div className="bg-stone-50 min-h-screen text-stone-800 antialiased selection:bg-teal-200 selection:text-teal-900">
      <nav className="sticky top-0 z-50 bg-stone-50/90 backdrop-blur border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <a href={BASE + '/'} className="flex-shrink-0 flex items-center font-bold text-xl tracking-tight text-teal-800">
              ⚙ Bio-Sync60
            </a>
            <div className="hidden md:flex space-x-8">
              <a href="#problem" className="text-stone-600 hover:text-teal-600 font-medium transition-colors">The Problem</a>
              <a href="#inflexibility" className="text-stone-600 hover:text-teal-600 font-medium transition-colors">Metabolic Inflexibility</a>
              <a href="#vt1" className="text-stone-600 hover:text-teal-600 font-medium transition-colors">The VT1 Anchor</a>
              <a href="#biogenesis" className="text-stone-600 hover:text-teal-600 font-medium transition-colors">Mitochondrial Biogenesis</a>
            </div>
          </div>
        </div>
      </nav>

      <header className="bg-stone-100 py-16 lg:py-24 border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-teal-600 font-semibold tracking-wide uppercase text-sm mb-3">Interactive Research Report</p>
          <h1 className="text-4xl md:text-5xl font-bold text-stone-900 mb-6 leading-tight">Mitochondrial Calibration</h1>
          <p className="text-lg md:text-xl text-stone-600 mb-8 max-w-3xl mx-auto">
            Discover why generic heart rate formulas fail nearly a third of the population, and how calibrating your training to Ventilatory Threshold 1 (VT1) unlocks peak metabolic flexibility and mitochondrial efficiency.
          </p>
          <a href="#problem" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 transition-colors">
            Explore the Data ↓
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-24">
        <section id="problem" className="scroll-mt-20">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-stone-900 mb-4">1. The Flaw of the Generic Formula</h2>
            <p className="text-lg text-stone-600">
              This section examines the ubiquitous "220 minus Age" maximum heart rate formula. While simple, it is a population average that masks significant individual physiological differences. The data below illustrates the statistical risk of relying on generic metrics for personalized biological conditioning.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-xl font-semibold text-stone-800 mb-3">A 29% Failure Rate</h3>
              <p className="text-stone-600 mb-4">
                The standard <strong>220-Age</strong> formula assumes a neat, linear decline in maximal heart rate as we age. However, standard deviation analyses reveal a massive margin of error.
              </p>
              <p className="text-stone-600 mb-4">
                For approximately <strong>29% of the population</strong>, this generic calculation is off by more than 12-15 beats per minute.
              </p>
              <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-md">
                <p className="text-rose-800 text-sm font-medium">
                  <strong>The Consequence:</strong> If you fall into this 29%, using percentage-based zones off a generic max heart rate means you are frequently training in entirely the wrong metabolic zone, undermining your cellular adaptations.
                </p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
              <div className="h-[300px] md:h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={FAILURE_CHART_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="85%"
                      paddingAngle={0}
                      dataKey="value"
                      nameKey="name"
                      label={false}
                    >
                      {FAILURE_CHART_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v}%`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-center text-sm text-stone-500 mt-4">Population variance using standard HR Max formulas.</p>
            </div>
          </div>
        </section>

        <section id="inflexibility" className="scroll-mt-20">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-stone-900 mb-4">2. The Cost: Metabolic Inflexibility</h2>
            <p className="text-lg text-stone-600">
              Training in the wrong zone—particularly too hard for foundational aerobic work—leads to a physiological state called Metabolic Inflexibility. Here we contrast a metabolically flexible system with an inflexible one, demonstrating how fuel sourcing is impacted by calibration errors.
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="flex border-b border-stone-200">
              <button
                type="button"
                onClick={() => setTab('inflexible')}
                className={`tab-btn flex-1 py-4 px-6 text-center font-semibold border-b-2 transition-all ${
                  tab === 'inflexible'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'text-stone-600 hover:bg-stone-50 border-transparent'
                }`}
              >
                ⚠ Metabolic Inflexibility (Failed Calibration)
              </button>
              <button
                type="button"
                onClick={() => setTab('flexible')}
                className={`tab-btn flex-1 py-4 px-6 text-center font-semibold border-b-2 transition-all ${
                  tab === 'flexible'
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'text-stone-600 hover:bg-stone-50 border-transparent'
                }`}
              >
                ✓ Metabolic Flexibility (Bio-Sync60)
              </button>
            </div>
            <div className="p-8">
              {tab === 'inflexible' && (
                <div className="transition-opacity duration-300">
                  <h3 className="text-2xl font-bold text-rose-600 mb-4">The "Sugar Burner" Trap</h3>
                  <p className="text-stone-600 mb-6">
                    When generic formulas push you to train at an intensity that is actually higher than your individual threshold, your body panics. It abandons slow-burning fats and relies entirely on rapidly available glycogen (sugar). Over time, your cells "forget" how to burn fat efficiently.
                  </p>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span className="text-stone-500">Fat Utilization</span>
                      <span className="text-stone-500">15%</span>
                    </div>
                    <div className="w-full bg-stone-200 rounded-full h-2.5">
                      <div className="bg-stone-400 h-2.5 rounded-full" style={{ width: '15%' }} />
                    </div>
                  </div>
                  <div className="mb-6">
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span className="text-rose-600">Carbohydrate (Glycogen) Reliance</span>
                      <span className="text-rose-600">85%</span>
                    </div>
                    <div className="w-full bg-stone-200 rounded-full h-2.5">
                      <div className="bg-rose-500 h-2.5 rounded-full" style={{ width: '85%' }} />
                    </div>
                  </div>
                  <ul className="space-y-2 text-stone-600">
                    <li>✗ Early onset of fatigue during sustained efforts.</li>
                    <li>✗ Spikes and crashes in daily energy levels.</li>
                    <li>✗ High accumulation of blood lactate with poor clearance.</li>
                  </ul>
                </div>
              )}
              {tab === 'flexible' && (
                <div className="transition-opacity duration-300">
                  <h3 className="text-2xl font-bold text-teal-600 mb-4">The Dual-Fuel Engine</h3>
                  <p className="text-stone-600 mb-6">
                    Proper calibration anchors your training to your actual biology. By training strictly in the optimal zone, you teach your body to seamlessly switch between burning copious amounts of fat at rest and low intensities, saving precious carbohydrates for high-intensity surges.
                  </p>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span className="text-teal-600">Fat Utilization (at moderate intensity)</span>
                      <span className="text-teal-600">70%</span>
                    </div>
                    <div className="w-full bg-stone-200 rounded-full h-2.5">
                      <div className="bg-teal-500 h-2.5 rounded-full" style={{ width: '70%' }} />
                    </div>
                  </div>
                  <div className="mb-6">
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span className="text-stone-600">Carbohydrate (Glycogen) Reliance</span>
                      <span className="text-stone-600">30%</span>
                    </div>
                    <div className="w-full bg-stone-200 rounded-full h-2.5">
                      <div className="bg-stone-400 h-2.5 rounded-full" style={{ width: '30%' }} />
                    </div>
                  </div>
                  <ul className="space-y-2 text-stone-600">
                    <li>✓ Sustained, all-day energy.</li>
                    <li>✓ Preservation of glycogen for critical, high-power efforts.</li>
                    <li>✓ Rapid recovery and efficient lactate recycling.</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="vt1" className="scroll-mt-20">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-stone-900 mb-4">3. VT1: The Anchor of True Efficiency</h2>
            <p className="text-lg text-stone-600">
              To escape the trap of generic formulas, the Bio-Sync60 protocol utilizes <strong>VT1 (Ventilatory Threshold 1)</strong>. This section visualizes VT1—the exact inflection point where your breathing shifts and blood lactate begins its slow rise over baseline, indicating a metabolic fuel shift.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-stone-200">
              <div className="h-[300px] md:h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vt1ChartData} margin={{ top: 10, right: 50, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Lactate (mmol/L)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'Fat Ox (g/min)', angle: 90, position: 'insideRight', style: { fontSize: 11 } }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(41,37,36,0.9)', color: '#fafaf9', border: 'none' }}
                      labelFormatter={(l) => (l === 'VT1' ? 'VT1 Anchor Point' : l)}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="lactate" name="Blood Lactate (mmol/L)" stroke="#e11d48" strokeWidth={3} dot={{ r: 4 }} fill="rgba(225,29,72,0.1)" fillOpacity={1} />
                    <Line yAxisId="right" type="monotone" dataKey="fatOx" name="Fat Oxidation (g/min)" stroke="#0d9488" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="lg:col-span-2 flex flex-col justify-center space-y-6">
              <div>
                <h4 className="font-bold text-stone-900 text-lg flex items-center">
                  <span className="inline-block w-4 h-4 bg-teal-500 rounded-full mr-2" />
                  What is VT1?
                </h4>
                <p className="text-stone-600 mt-2 text-sm leading-relaxed">
                  VT1 marks the first physiological shift in exercise intensity. It's the point where ventilation starts to increase faster than oxygen consumption. You can typically identify it as the intensity where you can no longer comfortably sing, but can still string together sentences.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-lg flex items-center">
                  <span className="inline-block w-4 h-4 bg-orange-400 rounded-full mr-2" />
                  The Crossover Point
                </h4>
                <p className="text-stone-600 mt-2 text-sm leading-relaxed">
                  Crucially, VT1 aligns closely with the peak of fat oxidation. Push past VT1, and lactate begins to accumulate as the body forcefully recruits more carbohydrate-burning glycolytic muscle fibers.
                </p>
              </div>
              <div className="bg-teal-50 p-4 rounded-lg border border-teal-100">
                <p className="text-teal-800 font-semibold text-sm">
                  Bio-Sync60 uses VT1 as the absolute anchor. Unlike 220-Age, VT1 is highly responsive to training and unique to your current biological state.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="biogenesis" className="scroll-mt-20 mb-20">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-stone-900 mb-4">4. Mitochondrial Biogenesis & Clearance</h2>
            <p className="text-lg text-stone-600">
              Knowing VT1 is only half the equation; training relative to it drives adaptation. This section lets you interactively explore how training intensity (relative to VT1) specifically impacts the creation of new mitochondria (biogenesis) and your ability to clear systemic lactate.
            </p>
          </div>
          <div className="bg-stone-900 rounded-2xl shadow-xl overflow-hidden text-stone-50">
            <div className="p-8 md:p-12 text-center">
              <h3 className="text-2xl font-bold mb-2">Simulate Your Training Intensity</h3>
              <p className="text-stone-400 mb-8 max-w-2xl mx-auto text-sm">
                Adjust the slider below to see how training above or below your VT1 anchor affects cellular stress, mitochondrial development, and lactate processing.
              </p>
              <div className="max-w-xl mx-auto relative pt-8 pb-4">
                <div className="flex justify-between text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 px-2">
                  <span>Recovery</span>
                  <span className="text-teal-400">Bio-Sync Sweet Spot</span>
                  <span className="text-rose-400">Anaerobic Stress</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sliderVal}
                  onChange={(e) => setSliderVal(Number(e.target.value))}
                  className="w-full h-2 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-teal-500 relative z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md"
                />
                <div className="absolute top-[48px] bottom-0 left-[60%] w-0.5 bg-stone-500 border-l border-dashed border-stone-400 z-0" />
                <div className="absolute top-[30px] left-[60%] -translate-x-1/2 text-[10px] font-bold bg-stone-800 px-2 py-1 rounded text-stone-300">VT1 Anchor</div>
              </div>
            </div>
            <div className={`p-8 md:p-12 transition-colors duration-500 border-t ${feedback.boxClass} border`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className={`uppercase tracking-widest text-xs font-bold mb-1 opacity-80 ${feedback.stateClass}`}>{feedback.state}</div>
                  <h4 className="text-3xl font-bold mb-4">{feedback.title}</h4>
                  <p className="text-stone-300 leading-relaxed text-sm">{feedback.text}</p>
                </div>
                <div className="space-y-4">
                  <div className="bg-stone-900 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold">Lactate Clearance Capability</span>
                      <span className={`font-bold ${feedback.lactateClass}`}>{feedback.lactate}</span>
                    </div>
                    <p className="text-xs text-stone-400">Mitochondria act as the "sinks" for lactate. Training here expands sink capacity.</p>
                  </div>
                  <div className="bg-stone-900 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold">Cellular Stress</span>
                      <span className={`font-bold ${feedback.stressClass}`}>{feedback.stress}</span>
                    </div>
                    <p className="text-xs text-stone-400">Allows for high-volume training day after day without central nervous system burnout.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-stone-900 py-8 border-t border-stone-800 text-center">
        <p className="text-stone-500 text-sm">⚙ Bio-Sync60 Interactive Report. Designed for optimal data exploration.</p>
      </footer>
    </div>
  );
};

export default MitochondrialCalibration;
