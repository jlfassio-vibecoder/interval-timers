import React, { useState, useEffect } from 'react';
import { BASE } from '../constants';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';

const PillarProtein: React.FC = () => {
  // --- SECTION 1: Leucine Trigger ---
  const [proteinAmount, setProteinAmount] = useState(0);
  const [leucineAmount, setLeucineAmount] = useState('0.0');
  const [mtorStatus, setMtorStatus] = useState({ text: 'OFF', className: 'bg-red-900 text-red-200 shadow-none' });

  useEffect(() => {
    // Approx Leucine calculation (10%)
    const leucine = (proteinAmount * 0.10).toFixed(1);
    setLeucineAmount(leucine);

    if (proteinAmount < 20) {
      setMtorStatus({ text: 'OFF', className: 'bg-red-900 text-red-200 shadow-none' });
    } else if (proteinAmount >= 20 && proteinAmount < 30) {
      setMtorStatus({ text: 'PRIMING...', className: 'bg-yellow-700 text-yellow-100 shadow-md' });
    } else {
      setMtorStatus({ text: 'ACTIVATED', className: 'bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.6)] scale-110' });
    }
  }, [proteinAmount]);

  // --- SECTION 2: Satiety Chart ---
  const [chartMode, setChartMode] = useState<'protein' | 'carbs' | 'both'>('protein');
  
  const satietyData = [
    { time: '0h', protein: 10, carbs: 10 },
    { time: '1h', protein: 9.5, carbs: 6.0 },
    { time: '2h', protein: 8.8, carbs: 3.5 },
    { time: '3h', protein: 7.5, carbs: 2.0 },
    { time: '4h', protein: 6.0, carbs: 1.5 },
    { time: '5h', protein: 5.0, carbs: 1.0 },
  ];

  // --- SECTION 4: Menu Builder ---
  const [currentProteinTotal, setCurrentProteinTotal] = useState(0);
  const [plateItems, setPlateItems] = useState<{name: string, protein: number}[]>([]);
  const [menuStatus, setMenuStatus] = useState({ text: 'Under Threshold', className: 'text-red-400 font-semibold' });

  const menuOptions = [
    { name: '🥚 1 Whole Egg', protein: 6 },
    { name: '⚪ 1 Egg White', protein: 3.6 },
    { name: '🥤 1 Scoop Whey', protein: 25 },
    { name: '🥣 Greek Yogurt (1/2 cup)', protein: 10 },
    { name: '🥓 Turkey Bacon (1 slice)', protein: 6 },
    { name: '🍗 Chicken Breast (3oz)', protein: 26 },
    { name: '🥩 Lean Beef (3oz)', protein: 22 },
    { name: '🌱 Tofu (1/2 block)', protein: 10 },
  ];

  const addToPlate = (item: {name: string, protein: number}) => {
    setPlateItems([...plateItems, item]);
    setCurrentProteinTotal(prev => prev + item.protein);
  };

  const clearPlate = () => {
    setPlateItems([]);
    setCurrentProteinTotal(0);
  };

  useEffect(() => {
    if (currentProteinTotal >= 30) {
      setMenuStatus({ text: 'ANCHOR SECURED (ANABOLIC)', className: 'text-green-400 font-bold animate-pulse' });
    } else {
      setMenuStatus({ text: 'Under Threshold', className: 'text-red-400 font-semibold' });
    }
  }, [currentProteinTotal]);

  return (
    <div className="bg-[#F5F5F0] min-h-screen text-slate-800 font-sans animate-fade-in pb-20">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <span className="font-bold text-slate-800 text-lg tracking-wide">SYNC-60 <span className="text-gray-400 font-normal">| Pillar 2</span></span>
           </div>
           <a href={BASE + '/handbook'} className="text-sm font-bold text-gray-500 hover:text-orange-600 transition-colors">
             ← Back to Handbook
           </a>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        
        {/* Hero */}
        <section className="text-center py-6 space-y-4">
            <div className="inline-block px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold uppercase tracking-wide mb-2">Scientific Validation: Complete</div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-slate-800">The 30g Protein Anchor</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Upon waking, your body is in a state of <span className="font-bold text-red-700">catabolism</span> (breakdown). 
                To flip the biological switch to <span className="font-bold text-green-700">anabolism</span> (repair) and secure appetite control, you need a specific threshold of stimulus.
            </p>
        </section>

        {/* SECTION 1: LEUCINE TRIGGER */}
        <section className="bg-white rounded-2xl shadow-lg p-6 md:p-10 border-t-4 border-orange-500">
            <div className="grid md:grid-cols-2 gap-10 items-center">
                <div className="space-y-4">
                    <h3 className="text-2xl font-bold text-slate-800">1. The Anabolic Switch (mTOR)</h3>
                    <p className="text-slate-600 leading-relaxed">
                        Muscle Protein Synthesis (MPS) isn't a dimmer switch; it's a light switch. It is triggered by the amino acid <strong>Leucine</strong>. 
                        Research confirms a "Leucine Threshold" of ~2.5–3g is required to activate mTOR.
                    </p>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <p className="text-sm font-semibold text-slate-700 mb-2">The Science of "Just an Egg"</p>
                        <p className="text-sm text-slate-500">
                            Consuming 15g of protein (e.g., 2 eggs) pushes the switch halfway but fails to fully trigger the anabolic cascade in adults. You must hit the anchor.
                        </p>
                    </div>
                </div>

                {/* Interactive Visualization */}
                <div className="bg-slate-900 rounded-xl p-8 text-white flex flex-col items-center justify-center space-y-8">
                    <div className="text-center">
                        <div className="text-sm text-gray-400 uppercase tracking-widest mb-1">Protein Intake</div>
                        <div className="text-5xl font-mono font-bold">{proteinAmount}g</div>
                    </div>
                    
                    <div className="w-full px-4">
                      <input 
                        type="range" 
                        min="0" max="50" 
                        value={proteinAmount} 
                        onChange={(e) => setProteinAmount(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      <div className="w-full flex justify-between text-xs text-gray-500 mt-2 font-mono">
                          <span>0g</span>
                          <span>15g (Weak)</span>
                          <span>30g (Target)</span>
                          <span>50g</span>
                      </div>
                    </div>

                    {/* The Switch Visual */}
                    <div className="w-full border-t border-gray-700 pt-6 flex justify-around items-center">
                        <div className="text-center">
                            <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Leucine Level</div>
                            <div className={`text-xl font-bold ${parseFloat(leucineAmount) >= 2.5 ? 'text-green-400' : 'text-gray-500'}`}>{leucineAmount}g</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">mTOR Status</div>
                            <div className={`px-4 py-2 rounded font-bold text-xs transition-all duration-300 ${mtorStatus.className}`}>
                              {mtorStatus.text}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* SECTION 2: HORMONES CHART */}
        <section className="space-y-6">
            <div className="max-w-3xl mx-auto text-center space-y-2">
                <h3 className="text-2xl font-bold text-slate-800">2. "Nature's Ozempic" Effect</h3>
                <p className="text-slate-600">
                    A high-protein anchor stimulates the release of <strong>Peptide YY (PYY)</strong> and <strong>GLP-1</strong> from the gut. 
                    This signals the brain that you are full, preventing the mid-morning crash common with carb-heavy breakfasts.
                </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <h4 className="font-bold text-slate-700">Hunger Hormone Suppression</h4>
                    <div className="flex flex-wrap gap-2 text-xs md:text-sm">
                        <button 
                          onClick={() => setChartMode('protein')}
                          className={`px-4 py-2 rounded-full font-medium transition ${chartMode === 'protein' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                        >
                          Protein Anchor
                        </button>
                        <button 
                          onClick={() => setChartMode('carbs')}
                          className={`px-4 py-2 rounded-full font-medium transition ${chartMode === 'carbs' ? 'bg-slate-200 text-slate-700 border border-slate-300' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                        >
                          Carb Breakfast
                        </button>
                        <button 
                          onClick={() => setChartMode('both')}
                          className={`px-4 py-2 rounded-full font-medium transition ${chartMode === 'both' ? 'bg-slate-800 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                        >
                          Compare Both
                        </button>
                    </div>
                </div>
                
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={satietyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                      <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} label={{ value: 'Satiety Score (0-10)', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8' } }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      />
                      {(chartMode === 'protein' || chartMode === 'both') && (
                        <Line 
                          type="monotone" 
                          dataKey="protein" 
                          stroke="#C05621" 
                          strokeWidth={3} 
                          dot={{r: 4, fill: '#C05621'}} 
                          name="30g Protein"
                        />
                      )}
                      {(chartMode === 'carbs' || chartMode === 'both') && (
                        <Line 
                          type="monotone" 
                          dataKey="carbs" 
                          stroke="#94a3b8" 
                          strokeWidth={2} 
                          strokeDasharray="5 5" 
                          dot={{r: 3, fill: '#94a3b8'}} 
                          name="Carb Heavy"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center text-xs text-gray-400 mt-4 italic">Simulated data based on PYY/GLP-1 response curves (post-prandial 4h window).</p>
            </div>
        </section>

        {/* SECTION 3: PHASES */}
        <section className="grid md:grid-cols-2 gap-8">
            {/* Phase 1 */}
            <div className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition duration-300 border border-transparent hover:border-blue-100">
                <div className="bg-blue-50 p-6 border-b border-blue-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="text-xl font-bold text-slate-800">Phase 1: The Hack</h4>
                            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">For Low Appetite</span>
                        </div>
                        <div className="text-3xl">💧</div>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600">
                        <strong>Problem:</strong> Morning nausea or "tight stomach" prevents solid food intake.
                    </p>
                    <p className="text-sm text-slate-600">
                        <strong>Solution:</strong> Liquid Protein (Whey/Isolate). Liquids bypass mechanical digestion, emptying from the stomach faster while still delivering the Leucine trigger to stop catabolism.
                    </p>
                    <div className="bg-slate-50 p-3 rounded text-xs text-slate-500 border border-slate-200">
                        <strong>Metabolic Cost (TEF):</strong> Low (~5-10%). Good for starting, but hunger may return sooner (2-3 hours).
                    </div>
                </div>
            </div>

            {/* Phase 2 */}
            <div className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition duration-300 border border-transparent hover:border-orange-100">
                <div className="bg-orange-50 p-6 border-b border-orange-100">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="text-xl font-bold text-slate-800">Phase 2: The Furnace</h4>
                            <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">For Max Fat Loss</span>
                        </div>
                        <div className="text-3xl">🔥</div>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600">
                        <strong>Problem:</strong> Need to maximize calorie burn and extend satiety window to 5-6 hours.
                    </p>
                    <p className="text-sm text-slate-600">
                        <strong>Solution:</strong> Solid Protein (Eggs, Meat, Yogurt). 
                    </p>
                    <div className="bg-slate-50 p-3 rounded text-xs text-slate-500 border border-slate-200">
                        <strong>Metabolic Cost (TEF):</strong> High (~20-30%). The body burns significantly more calories breaking down solid protein structures ("slow burning logs").
                    </div>
                </div>
            </div>
        </section>

        {/* SECTION 4: MENU BUILDER */}
        <section className="bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-10 text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h3 className="text-2xl font-bold text-white">Build Your Anchor</h3>
                    <p className="text-gray-400 text-sm">Select ingredients to hit the 30g target.</p>
                </div>
                <div className="text-right w-full md:w-auto bg-slate-700/50 p-4 rounded-xl border border-slate-600">
                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Current Total</div>
                    <div className={`text-4xl font-bold ${currentProteinTotal >= 30 ? 'text-green-400' : 'text-orange-400'}`}>{currentProteinTotal.toFixed(1)}g</div>
                    <div className={`text-xs ${menuStatus.className}`}>{menuStatus.text}</div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Ingredients List */}
                <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Select Ingredients</p>
                    <div className="grid grid-cols-1 gap-2">
                      {menuOptions.map((item, idx) => (
                        <button 
                          key={idx}
                          onClick={() => addToPlate(item)}
                          className="w-full flex justify-between items-center p-3 rounded bg-slate-700 hover:bg-slate-600 transition group active:scale-[0.98]" 
                        >
                            <span className="flex items-center gap-2 text-sm text-gray-200">{item.name}</span>
                            <span className="text-xs font-mono text-orange-300 group-hover:text-white transition bg-slate-800 px-2 py-1 rounded">+{item.protein}g</span>
                        </button>
                      ))}
                    </div>
                </div>

                {/* Plate / Review */}
                <div className="bg-slate-900 rounded-xl p-6 flex flex-col h-full border border-slate-700">
                    <h4 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-widest flex justify-between items-center">
                      <span>Your Plate</span>
                      <span className="text-xs normal-case font-normal text-gray-500">{plateItems.length} items</span>
                    </h4>
                    
                    <div className="flex-1 overflow-y-auto max-h-64 mb-4 pr-2 custom-scrollbar">
                      {plateItems.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-600 text-sm italic">
                          Select items to begin building...
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {plateItems.map((item, idx) => (
                            <li key={idx} className="flex justify-between border-b border-gray-800 pb-2 animate-in fade-in slide-in-from-left-2 duration-300">
                              <span className="text-sm text-gray-300">{item.name}</span> 
                              <span className="text-sm text-gray-500 font-mono">+{item.protein}g</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    
                    <button 
                      onClick={clearPlate}
                      className="w-full py-3 rounded border border-gray-600 text-gray-400 hover:text-white hover:border-white hover:bg-slate-800 transition text-xs uppercase tracking-widest font-bold"
                    >
                      Clear Plate
                    </button>
                </div>
            </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-slate-400 text-sm py-8 border-t border-gray-200/50">
            <p>© Sync-60 Protocol. Validated by Nutritional Biochemistry.</p>
        </footer>

      </main>
    </div>
  );
};

export default PillarProtein;
