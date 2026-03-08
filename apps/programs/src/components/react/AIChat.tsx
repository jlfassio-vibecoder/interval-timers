/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendMessageToGemini } from '../../services/geminiService';
import type { ChatMessage } from '@/types';

const AIChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: 'Ready to design? Ask AI FITCOPILOT about programming, exercise selection, or form cues. 🔥',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      const { scrollHeight, clientHeight } = chatContainerRef.current;
      chatContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    setTimeout(scrollToBottom, 100);

    const responseText = await sendMessageToGemini(input);

    setMessages((prev) => [...prev, { role: 'model', text: responseText }]);
    setIsLoading(false);
  };

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-50 flex flex-col items-end md:bottom-6 md:right-6">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-4 w-[90vw] overflow-hidden rounded-2xl border border-white/10 bg-black/80 shadow-2xl shadow-[#ff4000]/20 backdrop-blur-xl md:w-96"
          >
            {/* Header */}
            <div className="to-orange-darkest/50 flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#ff4000]/50 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 animate-pulse text-orange-light" />
                <h3 className="font-heading text-xs font-bold tracking-wider text-white">
                  AI FITCOPILOT
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/50 hover:text-white"
                data-hover="true"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={chatContainerRef}
              className="h-64 space-y-3 overflow-y-auto scroll-smooth p-4 md:h-80"
            >
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 text-sm ${
                      msg.role === 'user'
                        ? 'rounded-tr-none bg-[#ff4000] text-white'
                        : 'rounded-tl-none border border-white/5 bg-white/10 text-gray-200'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-1 rounded-lg rounded-tl-none bg-white/10 p-3">
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-light"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-light"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-light"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-white/10 bg-black/40 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask about fitness, workouts..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="rounded-lg bg-[#ff4000] p-2 transition-colors hover:bg-[#ff1500] disabled:opacity-50"
                  data-hover="true"
                >
                  <Send className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="group z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-gradient-to-tr from-orange-light to-orange-darkest shadow-lg shadow-[#ff4000]/40 md:h-14 md:w-14"
        data-hover="true"
      >
        {isOpen ? (
          <X className="h-5 w-5 text-white md:h-6 md:w-6" />
        ) : (
          <MessageCircle className="h-5 w-5 text-white group-hover:animate-bounce md:h-6 md:w-6" />
        )}
      </motion.button>
    </div>
  );
};

export default AIChat;
