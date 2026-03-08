/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import { updatePurchasedPass } from '@/lib/supabase/client/profiles';

const PurchaseFlow: React.FC = () => {
  const { user, purchasedIndex, setPurchasedIndex } = useAppContext();
  const [purchasingIndex, setPurchasingIndex] = React.useState<number | null>(null);

  const handlePurchase = async (index: number) => {
    if (!user) {
      window.dispatchEvent(
        new CustomEvent('showAuthModal', {
          bubbles: true,
          cancelable: true,
        })
      );
      return;
    }
    setPurchasingIndex(index);
    setTimeout(async () => {
      await updatePurchasedPass(user.uid, index);
      setPurchasingIndex(null);
      setPurchasedIndex(index);
    }, 2000);
  };

  const tickets = [
    {
      name: 'Heat Pass',
      subtitle: '(1 Class)',
      price: '$7',
      color: 'white',
      accent: 'bg-white/5',
      features: ['Single Access', 'AI Generated Plan', 'Digital Token'],
    },
    {
      name: 'Flare Week',
      subtitle: '(3 Classes)',
      price: '$19',
      color: 'amber',
      accent: 'bg-orange-light/10 border-orange-light/50',
      features: ['Weekly Progression', 'Human Oversight', 'Prompt Support'],
    },
    {
      name: 'Solaris Elite',
      subtitle: '(12 Classes)',
      price: '$69',
      color: 'red',
      accent: 'bg-[#ff4000]/10 border-[#ff4000]/50',
      features: ['Monthly Mastery', 'Direct Coaching', 'Full Biometrics'],
    },
  ];

  return (
    <section
      id="complexes"
      className="relative z-10 bg-black/30 px-4 py-20 backdrop-blur-lg md:px-6 md:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center md:mb-20">
          <h2 className="font-heading text-5xl font-bold text-white opacity-20 md:text-9xl">
            PASSES
          </h2>
          <p className="relative z-10 -mt-3 font-mono text-sm uppercase tracking-widest text-orange-light md:-mt-8 md:text-base">
            PERSISTENT PROGRESSION
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {tickets.map((ticket, i) => {
            const isPurchasing = purchasingIndex === i;
            const isPurchased = purchasedIndex === i;
            const isDisabled = purchasingIndex !== null;

            return (
              <motion.div
                key={i}
                whileHover={isDisabled ? {} : { y: -20 }}
                className={`relative flex min-h-[450px] flex-col border border-white/10 p-8 backdrop-blur-md transition-colors duration-300 md:p-10 ${ticket.accent} ${isDisabled && !isPurchased ? 'opacity-50 grayscale' : ''}`}
                data-hover={!isDisabled}
              >
                <div className="flex-1">
                  <h3 className="mb-1 font-heading text-2xl font-bold text-white">{ticket.name}</h3>
                  <p className="mb-4 font-mono text-xs uppercase text-white/50">
                    {ticket.subtitle}
                  </p>
                  <div
                    className={`mb-8 text-5xl font-bold ${ticket.color === 'white' ? 'text-white' : ticket.color === 'amber' ? 'text-orange-light' : 'text-[#ff1500]'}`}
                  >
                    {ticket.price}
                  </div>
                  <ul className="space-y-4 text-sm text-gray-200">
                    {ticket.features.map((f, idx) => (
                      <li key={idx} className="flex items-center gap-3">
                        <Zap className="h-5 w-5 text-gray-400" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handlePurchase(i)}
                  disabled={isDisabled || isPurchased}
                  className={`group relative mt-8 w-full overflow-hidden border border-white/20 py-4 text-sm font-bold uppercase tracking-widest transition-all duration-300 ${isPurchased ? 'cursor-default border-orange-light bg-orange-light text-black' : 'cursor-pointer text-white hover:bg-white hover:text-black'}`}
                >
                  <span className="relative z-10">
                    {isPurchasing ? 'Syncing...' : isPurchased ? 'Activated' : 'Activate Pass'}
                  </span>
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PurchaseFlow;
