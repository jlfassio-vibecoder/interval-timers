import React from 'react';
import { BASE } from '../constants';

const JapaneseWalking: React.FC = () => {
  return (
    <div className="bg-sync-base min-h-screen text-sync-dark font-sans animate-fade-in pb-20">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-sync-base/95 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-sync-orange"></div>
             <span className="font-display font-bold text-sync-blue">Bio-Sync60 <span className="text-gray-400 font-normal">| Japanese Walking</span></span>
           </div>
           <a href={BASE + '/'} className="text-sm font-bold text-gray-500 hover:text-sync-blue transition-colors">
             ← Back to Home
           </a>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        
        {/* Document Header */}
        <header className="mb-16 text-center border-b-2 border-gray-200 pb-12">
            <h1 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-4">THE SYNC-60 PROTOCOL</h1>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-sync-blue mb-4">PILLAR 4: THE DAILY MOVEMENT ANCHOR</h2>
            <div className="w-24 h-1 bg-sync-orange mx-auto mb-6"></div>
            <h3 className="text-2xl font-bold text-slate-800 leading-tight mb-2">The Mindful Walk: Integrating Contemplative Practice with Interval Walking Training</h3>
            <p className="text-lg text-gray-600 italic">How the Science of Shinshu University Meets the Wisdom of Thich Nhat Hanh</p>
            <div className="mt-8 flex justify-center gap-4 text-xs font-bold uppercase tracking-widest text-gray-400">
                <span>Red-Team Audited</span>
                <span>•</span>
                <span>Peer-Reviewed Final Edition</span>
                <span>•</span>
                <span>Feb 2026</span>
            </div>
        </header>

        {/* Part I: Red Team Audit */}
        <section className="mb-16">
            <h2 className="text-3xl font-display font-bold text-sync-blue mb-8 border-l-4 border-sync-orange pl-4">Part I: The Red Team Audit</h2>
            <p className="text-gray-700 mb-8 leading-relaxed">
                Before we release any science to you, we verify it. The following audit was conducted against the primary peer-reviewed literature to ensure every claim in this paper earns its place. Think of this as the quality control report for the engine we’re about to install in your daily life.
            </p>

            <div className="space-y-8">
                {/* Green Light */}
                <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
                    <h3 className="flex items-center text-green-800 font-bold text-xl mb-4">
                        <span className="w-4 h-4 rounded-full bg-green-500 mr-3"></span>
                        The Traffic Light Assessment: Green (Verified)
                    </h3>
                    <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
                        <p><strong>The IWT Protocol Structure.</strong> Three minutes fast, three minutes slow, at 70% and 40% of your peak aerobic capacity. This exact prescription was validated across multiple cohorts totaling 679+ participants (mean age 65) at Shinshu University Graduate School of Medicine. Published in Mayo Clinic Proceedings (Nemoto et al., 2007; Masuki et al., 2019). Knowing your 70%/40% targets is why Bio-Sync60 emphasizes VT1-based (or individualized) calibration instead of 220-age, so you train in the right zone for mitochondrial efficiency and avoid metabolic inflexibility.</p>
                        <p><strong>The Performance Numbers.</strong> VO₂peak +10–14%. Systolic blood pressure −9 to 10 mmHg. Knee extension +13%, knee flexion +17%. Lifestyle-related disease composite score −17 to 20%. All confirmed across primary sources.</p>
                        <p><strong>The Trigeminal-Vagal Pathway.</strong> The anatomical description (V1/V2 → Spinal Trigeminal Nucleus → Nucleus Ambiguus) matches our own Trigeminal-Vagal Axis Research Synthesis and current neuroanatomical literature.</p>
                    </div>
                </div>

                {/* Yellow Light */}
                <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-100">
                    <h3 className="flex items-center text-yellow-800 font-bold text-xl mb-4">
                        <span className="w-4 h-4 rounded-full bg-yellow-500 mr-3"></span>
                        Yellow: Nuance Required (Corrected)
                    </h3>
                    <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
                        <p><strong>The NFKB Methylation Claim.</strong> The original draft stated that five months of IWT alone increases NFKB gene methylation by approximately 20%. That’s not quite right. Here’s the truth:</p>
                        <p>Zhang et al. (2015) identified NFKB2 as a gene whose methylation responds to IWT—good. But the large-magnitude increases (29% for NFKB1, 44% for NFKB2) reported by Masuki et al. (2017) occurred only when IWT was combined with high-dose dairy protein supplementation. The IWT-alone control group actually showed a decrease in methylation.</p>
                        <p><strong>The CaMKII vs. AMPK Distinction.</strong> The Handbook frames PGC-1α activation in terms of dominant pathways (Combes et al., 2015): low-intensity training at VT1 preferentially engages the calcium/CaMK cascade; HIIT preferentially engages AMPK-mediated energy-depletion signals. Both pathways contribute across intensities, with relative contributions varying.</p>
                    </div>
                </div>

                {/* Red Light */}
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                    <h3 className="flex items-center text-red-800 font-bold text-xl mb-4">
                        <span className="w-4 h-4 rounded-full bg-red-500 mr-3"></span>
                        Red: Nothing Found
                    </h3>
                    <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
                        <p>No outright factual errors were identified in this paper. The NFKB claim above is the only material correction, and it’s been integrated into the final text. This paper also avoids the “250% dopamine from face immersion” conflation present in the parent Handbook’s Phase 3 checklist—a separate issue flagged in the main audit.</p>
                    </div>
                </div>

                {/* Tone Check */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-2">Tone & Consistency Check</h3>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                        <li><strong>Integration Quality:</strong> Excellent. The synthesis of Thich Nhat Hanh’s contemplative framework with the Nose IWT protocol is among the most thoughtful pairings we’ve reviewed.</li>
                        <li><strong>Non-Striving vs. Performance:</strong> Resolved. The “intention vs. goal” framework draws credibly on Shapiro’s paradox-of-mindfulness literature.</li>
                        <li><strong>Tone Adjustments:</strong> Marketing overreach softened in final version.</li>
                    </ul>
                </div>
            </div>
        </section>

        {/* Part II: The Science */}
        <section className="mb-16">
            <h2 className="text-3xl font-display font-bold text-sync-blue mb-8 border-l-4 border-sync-orange pl-4">Part II: The Science</h2>
            
            <div className="prose prose-slate max-w-none text-gray-700 leading-relaxed">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">The “Why”: Your Walk Is an Engine. Treat It Like One.</h3>
                <p className="mb-6">
                    Most people think of walking as “light exercise.” It’s not. When performed with precision, walking is the single most accessible and sustainable engine for cardiovascular remodeling, muscular preservation, and metabolic flexibility available to the human body. The problem is that most people walk the wrong way—too fast to recover, too slow to adapt. They spend their steps in what we call the “Grey Zone.”
                </p>
                <p className="mb-6">
                    Pillar 4 of the Bio-Sync60 Protocol eliminates the Grey Zone by replacing casual walking with a clinically validated Interval Walking Training (IWT) protocol developed over two decades by Dr. Hiroshi Nose and his team at Shinshu University Graduate School of Medicine in Matsumoto, Japan. Then, we layer on something no laboratory has ever prescribed: the contemplative walking tradition of Thich Nhat Hanh—transforming your daily 30-minute anchor from a workout into a practice.
                </p>
                <p className="mb-8 font-medium text-sync-blue">
                    The result: A 10–14% increase in your aerobic engine. A blood pressure reduction equivalent to medication. Muscle gains of 13–17% in your legs. And a psychological framework that makes you want to do it every single day.
                </p>

                <h3 className="text-2xl font-bold text-slate-900 mt-12 mb-4">1. The Shinshu Protocol: The Engine Specs</h3>
                <p className="mb-6">
                    In 2004, Dr. Nose posed a simple question: why does casual walking fail older adults? The answer was intensity. Walking at a self-selected pace (roughly 50% of peak capacity) is comfortable—but comfort doesn’t trigger adaptation. To build new mitochondria, to strengthen the cardiac muscle, to upregulate the molecular switches that preserve lean mass, the body needs a metabolic signal that says: “This matters. Adapt.”
                </p>
                <p className="mb-6">
                    But older adults can’t sustain high intensity for long. Three minutes was the breaking point—most participants hit a wall of fatigue. The breakthrough: they recovered completely in two to three minutes of slow walking. From this observation, the “3-fast / 3-slow” interval was born.
                </p>

                <div className="overflow-x-auto my-8 border rounded-xl border-gray-200 shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-800 uppercase font-bold">
                            <tr>
                                <th className="px-6 py-3">Component</th>
                                <th className="px-6 py-3">Specification</th>
                                <th className="px-6 py-3">Why It Matters</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            <tr><td className="px-6 py-4 font-bold">Fast Interval</td><td className="px-6 py-4">3 Minutes</td><td className="px-6 py-4">≥70% VO₂peak. This is the metabolic “signal.”</td></tr>
                            <tr><td className="px-6 py-4 font-bold">Slow Interval</td><td className="px-6 py-4">3 Minutes</td><td className="px-6 py-4">~40% VO₂peak. Full parasympathetic recovery.</td></tr>
                            <tr><td className="px-6 py-4 font-bold">Minimum Sets</td><td className="px-6 py-4">5 per session</td><td className="px-6 py-4">30 minutes total. Non-negotiable.</td></tr>
                            <tr><td className="px-6 py-4 font-bold">Frequency</td><td className="px-6 py-4">4 Days/Week</td><td className="px-6 py-4">≥60 min fast walking per week.</td></tr>
                            <tr><td className="px-6 py-4 font-bold">Duration</td><td className="px-6 py-4">5 Months</td><td className="px-6 py-4">Minimum for structural + epigenetic remodeling.</td></tr>
                        </tbody>
                    </table>
                </div>

                <h4 className="font-bold text-slate-800 mt-8 mb-4">The Numbers</h4>
                <p className="mb-4">Here’s what five months of this protocol delivered in clinical trials:</p>
                
                <div className="overflow-x-auto my-6 border rounded-xl border-gray-200 shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-800 uppercase font-bold">
                            <tr>
                                <th className="px-6 py-3">Metric</th>
                                <th className="px-6 py-3">Result</th>
                                <th className="px-6 py-3">What This Means For You</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            <tr><td className="px-6 py-4 font-bold">VO₂peak</td><td className="px-6 py-4 text-green-600 font-bold">+10–14%</td><td className="px-6 py-4">Measurably more endurance. Faster recovery.</td></tr>
                            <tr><td className="px-6 py-4 font-bold">Systolic BP</td><td className="px-6 py-4 text-green-600 font-bold">−9 to 10 mmHg</td><td className="px-6 py-4">Equivalent to a primary antihypertensive drug.</td></tr>
                            <tr><td className="px-6 py-4 font-bold">Diastolic BP</td><td className="px-6 py-4 text-green-600 font-bold">−5 mmHg</td><td className="px-6 py-4">Reduced cardiovascular strain at rest.</td></tr>
                            <tr><td className="px-6 py-4 font-bold">Knee Strength</td><td className="px-6 py-4 text-green-600 font-bold">+13-17%</td><td className="px-6 py-4">Stronger legs. Better stability. Fall prevention.</td></tr>
                            <tr><td className="px-6 py-4 font-bold">LSD Score</td><td className="px-6 py-4 text-green-600 font-bold">−17 to 20%</td><td className="px-6 py-4">Composite of BP, glucose, BMI, lipids.</td></tr>
                        </tbody>
                    </table>
                </div>

                <h4 className="font-bold text-slate-800 mt-8 mb-4">The Mechanism: The “Second Heart”</h4>
                <p className="mb-6">
                    Why does this work when regular walking doesn’t? During your brisk phase, your calf and thigh muscles contract forcefully and rhythmically. These contractions compress the deep veins in your legs, and one-way valves ensure that blood is propelled upward—back toward your heart, against gravity. Exercise physiologists call this the “skeletal muscle pump.” We call it the Second Heart.
                </p>
                <p className="mb-6">
                    This surge of returning blood increases the volume filling your heart between beats (end-diastolic volume). Per the Frank-Starling law, a more-filled heart contracts more forcefully, increasing stroke volume. Over months, this repeated “overfilling and forceful emptying” drives physiological cardiac remodeling—the heart literally becomes a better pump.
                </p>

                <h3 className="text-2xl font-bold text-slate-900 mt-12 mb-4">2. The Navigator: Thich Nhat Hanh’s Contemplative Walking</h3>
                <p className="mb-6">
                    Now we layer in the element that no laboratory has ever prescribed. The Bio-Sync60 Protocol doesn’t just optimize your biology—it addresses the reason most people quit: the mind gives up before the body does.
                </p>
                <p className="mb-6">
                    Thich Nhat Hanh (1926–2022) was a Vietnamese Zen master who developed a walking meditation practice built on three concepts: “arriving,” “stopping,” and “non-striving.” Unlike conventional walking—a means to get somewhere—mindful walking is complete in itself. Every step is experienced as an act of being fully present on the earth.
                </p>
                
                <h4 className="font-bold text-slate-800 mt-6 mb-4">The Core Teaching: “I Have Arrived. I Am Home.”</h4>
                <p className="mb-6">
                    Most people are “running” through life even when they’re physically still—mentally chasing future outcomes or replaying past events. This is the psychological equivalent of the Grey Zone: present in body, absent in mind.
                </p>
                <p className="mb-6">
                    The gatha (mindfulness verse) “I have arrived, I am home” is designed to counter this. “Arrived” means establishing yourself fully in this moment. “Home” means recognizing the present as the only place where life is genuinely available. In the context of Pillar 4, this anchors you during the brisk intervals—instead of mentally “running through” three minutes of effort to reach the “reward” of recovery, you arrive in the effort itself.
                </p>

                <h4 className="font-bold text-slate-800 mt-6 mb-4">Breath-Step Synchronization</h4>
                <div className="overflow-x-auto my-6 border rounded-xl border-gray-200 shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-800 uppercase font-bold">
                            <tr>
                                <th className="px-6 py-3">Phase</th>
                                <th className="px-6 py-3">Inhale</th>
                                <th className="px-6 py-3">Exhale</th>
                                <th className="px-6 py-3">Gatha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            <tr><td className="px-6 py-4 font-bold">Brisk (RPE 7–8)</td><td className="px-6 py-4">3–4 steps</td><td className="px-6 py-4">5–6 steps</td><td className="px-6 py-4 italic">"Deep, Deep. Slow, Slow, Slow."</td></tr>
                            <tr><td className="px-6 py-4 font-bold">Recovery (RPE 2–4)</td><td className="px-6 py-4">2–3 steps</td><td className="px-6 py-4">3–4 steps</td><td className="px-6 py-4 italic">"Calm, Calm. Ease, Ease, Ease."</td></tr>
                            <tr><td className="px-6 py-4 font-bold">Warm-Up / Cool</td><td className="px-6 py-4">2 steps</td><td className="px-6 py-4">3 steps</td><td className="px-6 py-4 italic">"Arrived, Arrived. Home, Home, Home."</td></tr>
                        </tbody>
                    </table>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mt-12 mb-4">3. The Integrated Protocol: Mapping Gathas to Intervals</h3>
                <p className="mb-6">
                    The challenge of this integration is real: at RPE 7–8 during the brisk interval, your heart rate is elevated and breathing is heavy. This does not resemble a leisurely Zen stroll. But Thich Nhat Hanh explicitly taught that fast walking for exercise can be deeply mindful—if you maintain sensory engagement and present-moment awareness. The breath becomes harder? Good. That means you’re alive, and this body is strong.
                </p>

                <h4 className="font-bold text-slate-800 mt-6 mb-4">The 30-Minute Anchor: Your Clinical Manual</h4>
                <div className="overflow-x-auto my-6 border rounded-xl border-gray-200 shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-800 uppercase font-bold">
                            <tr>
                                <th className="px-6 py-3">Phase</th>
                                <th className="px-6 py-3">RPE</th>
                                <th className="px-6 py-3">Talk Test</th>
                                <th className="px-6 py-3">The Mindful Anchor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            <tr><td className="px-6 py-4 font-bold">Warm-Up (5 min)</td><td className="px-6 py-4">2–3</td><td className="px-6 py-4">Full conversation</td><td className="px-6 py-4">"I have arrived, I am home." Feel feet kiss the earth.</td></tr>
                            <tr><td className="px-6 py-4 font-bold bg-sync-orange/5">BRISK (3 min)</td><td className="px-6 py-4 bg-sync-orange/5">7–8</td><td className="px-6 py-4 bg-sync-orange/5">Short, broken phrases</td><td className="px-6 py-4 bg-sync-orange/5">"Deep, Slow." Visualize Second Heart pumping blood.</td></tr>
                            <tr><td className="px-6 py-4 font-bold bg-green-50">RECOVERY (3 min)</td><td className="px-6 py-4 bg-green-50">2–4</td><td className="px-6 py-4 bg-green-50">Easy conversation</td><td className="px-6 py-4 bg-green-50">"Calm, Ease." Half-smile. Release shoulders, jaw.</td></tr>
                            <tr><td className="px-6 py-4 font-bold">Repeat ×5</td><td className="px-6 py-4">—</td><td className="px-6 py-4">—</td><td className="px-6 py-4">Each IoT chime = The Bell of Mindfulness.</td></tr>
                            <tr><td className="px-6 py-4 font-bold">Cool-Down (3 min)</td><td className="px-6 py-4">1–2</td><td className="px-6 py-4">Relaxed speech</td><td className="px-6 py-4">"Dwelling in the present moment." Gratitude walk.</td></tr>
                        </tbody>
                    </table>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mt-12 mb-4">4. The Deeper Science: Epigenetic Convergence</h3>
                <p className="mb-6">
                    This is where the synthesis gets profound. There is a point of convergence between the Japanese IWT research and the mindfulness literature, and it centers on one molecule: NFκB (Nuclear Factor Kappa B). NFKB is the master transcription factor that controls your inflammasome—the molecular machinery behind chronic, age-related inflammation. When NFKB is active, it triggers the production of inflammatory cytokines (TNF-α, IL-6, IL-8). When its gene is methylated (silenced), inflammation is suppressed.
                </p>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm my-6">
                    <h4 className="font-bold text-slate-800 mb-4">Intervention Mechanisms</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                        <div className="space-y-2">
                            <p className="font-bold text-sync-orange">IWT + Protein Anchor</p>
                            <p className="text-gray-600">Metabolic stress + leucine signaling → <strong>29–44% NFKB1/2 methylation increase</strong>.</p>
                        </div>
                        <div className="space-y-2">
                            <p className="font-bold text-gray-600">IWT Alone</p>
                            <p className="text-gray-600">Metabolic stress / muscle pump → NFKB2 identified as responsive; magnitude requires protein co-factor.</p>
                        </div>
                        <div className="space-y-2">
                            <p className="font-bold text-sync-blue">Mindful Practice</p>
                            <p className="text-gray-600">HPA regulation / autonomic calm → Downregulation of NFKB, TNF-α pathways.</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 text-sm font-medium text-center text-slate-800">
                        The Bio-Sync60 Hypothesis: Combined, they create a dual-pathway anti-inflammatory intervention.
                    </div>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mt-12 mb-4">5. The Middle Path of Effort: Reconciling Zen with Performance</h3>
                <p className="mb-6">
                    Let’s address the elephant in the room. How do you practice “non-striving” while deliberately walking at 70% of your maximum capacity? Isn’t that a contradiction? No. And the distinction matters.
                </p>
                <p className="mb-6">
                    An intention is a direction—a compass. A goal is an outcome—a target. In Pillar 4, you intend to be fully present for every step of this walk. You intend to honor your body’s capacity by walking at the prescribed intensity. But you do not grasp at a specific VO₂peak number during any given session. The 14% improvement happens to you over five months as a natural consequence of sustained, present practice—not because you chased it.
                </p>

                <h3 className="text-2xl font-bold text-slate-900 mt-12 mb-4">6. Progressive Overload: Your Tier System</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h4 className="font-bold text-sync-blue mb-2">Novice (Wk 1–4)</h4>
                        <div className="text-sm space-y-2 text-gray-600">
                            <p><strong>Volume:</strong> 3 sets, 3 days/wk</p>
                            <p><strong>Intensity:</strong> RPE 6–7 brisk</p>
                            <p><strong>Focus:</strong> Master “Arriving.”</p>
                        </div>
                    </div>
                    <div className="bg-sync-base p-6 rounded-xl border border-sync-blue/20 shadow-md transform scale-105">
                        <h4 className="font-bold text-sync-orange mb-2">Intermediate (Wk 5–12)</h4>
                        <div className="text-sm space-y-2 text-gray-700">
                            <p><strong>Volume:</strong> 5 sets, 4 days/wk</p>
                            <p><strong>Intensity:</strong> RPE 7–8 brisk</p>
                            <p><strong>Focus:</strong> Gatha-breath sync.</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h4 className="font-bold text-sync-blue mb-2">Mastery (Wk 12+)</h4>
                        <div className="text-sm space-y-2 text-gray-600">
                            <p><strong>Volume:</strong> 5+ sets, 4–5 days/wk</p>
                            <p><strong>Intensity:</strong> Add 1–3% incline</p>
                            <p><strong>Focus:</strong> Flow state integration.</p>
                        </div>
                    </div>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mt-12 mb-4">7. The Sync: Engine + Navigator</h3>
                <p className="mb-6">
                    The Shinshu University IWT protocol is the biological engine of Pillar 4: a proven method for cardiovascular remodeling, muscular strengthening, and metabolic flexibility. It turns 30 minutes of your day into a precision intervention with outcomes that rival pharmacological treatments.
                </p>
                <p className="mb-6">
                    Thich Nhat Hanh’s contemplative framework is the navigator: a method for transforming metabolic stress into present-moment awareness, reducing perceived exertion, and facilitating the flow state that makes adherence effortless. The interval structure of IWT creates natural transition points—moments of shifting intensity that, without contemplative anchoring, become moments of mental resistance. By mapping gathas to these transitions, each shift in effort becomes an invitation to practice presence.
                </p>
                <p className="font-display font-bold text-xl text-center text-sync-blue my-8">
                    “Hard” breaks you. “Sync” builds you. And now, “Sync” walks with you.
                </p>
            </div>

            {/* Citations */}
            <div className="mt-16 pt-8 border-t border-gray-200 text-xs text-gray-500">
                <h4 className="font-bold uppercase tracking-widest mb-4">Works Cited</h4>
                <ol className="list-decimal pl-5 space-y-2">
                    <li>Nemoto K, Gen-no H, Masuki S, Okazaki K, Nose H. Effects of high-intensity interval walking training on physical fitness and blood pressure in middle-aged and older people. Mayo Clin Proc. 2007;82(7):803–811.</li>
                    <li>Masuki S, Morikawa M, Nose H. High-intensity walking time is a key determinant to increase physical fitness and improve health outcomes after interval walking training in middle-aged and older people. Mayo Clin Proc. 2019;94(12):2415–2426.</li>
                    <li>Zhang Y, Hashimoto S, Fujii C, et al. NFkB2 gene as a novel candidate that epigenetically responds to interval walking training. Int J Sports Med. 2015;36(9):769–775.</li>
                    <li>Masuki S, Morikawa M, Nakano S, et al. Effects of milk product intake on thigh muscle strength and NFKB gene methylation during home-based IWT. PLOS ONE. 2017;12(5):e0176757.</li>
                    <li>Morikawa M, Nakano S, Mitsui N, et al. Effects of dried tofu supplementation during IWT on NFKB2 gene methylation. J Physiol Sci. 2018;68(6):749–757.</li>
                    <li>Kaliman P, Álvarez-López MJ, Cosín-Tomás M, et al. Rapid changes in histone deacetylases and inflammatory gene expression in expert meditators. Psychoneuroendocrinology. 2014;40:96–107.</li>
                    <li>Combes A, Dekerle J, Webborn N, et al. Exercise-induced metabolic fluctuations influence AMPK, p38-MAPK and CaMKII phosphorylation. Physiol Rep. 2015;3(9):e12462.</li>
                    <li>Šrámek P, Simecková M, Janský L, et al. Human physiological responses to immersion into water of different temperatures. Eur J Appl Physiol. 2000;81(5):436–442.</li>
                    <li>Robergs RA, Landwehr R. The surprising history of the “HRmax=220–age” equation. J Exerc Physiol Online. 2002;5(2):1–10.</li>
                    <li>Anton SD, Moehl K, Donahoo WT, et al. Flipping the metabolic switch. Obesity. 2018;26(2):254–268.</li>
                    <li>Thich Nhat Hanh. How to Walk. Berkeley: Parallax Press; 2015.</li>
                    <li>Kee YH, Wang CKJ. Relationships between mindfulness, flow dispositions and mental skills adoption. Psychol Sport Exerc. 2008;9(4):393–411.</li>
                    <li>Shapiro SL, de Vibe M, Negi LT, et al. Exploring the paradoxes of mindfulness. Mindfulness. 2018;9(5):1358–1368.</li>
                </ol>
                <p className="mt-4 text-center">© 2026 Biological Synchronicity Systems. Part of the Bio-Sync60 Protocol.</p>
            </div>

        </section>
      </main>
    </div>
  );
};

export default JapaneseWalking;