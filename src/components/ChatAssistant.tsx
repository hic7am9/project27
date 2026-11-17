import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import type { Apartment, Booking, Location, GuestArchive } from '@/types';
import { generateAIResponse } from '@/lib/ai-assistant';

interface Props {
  apartments: Apartment[];
  locations: Location[];
  bookings: Booking[];
  archive?: GuestArchive[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
}

const SUGGESTIONS = [
  'كم نسبة الإشغال؟',
  'وصولات اليوم',
  'المغادرات القريبة',
  'ملخص الحالة',
  'حالة المزامنة',
  'إيرادات الحجوزات',
  'ماذا يحدث غداً؟',
  'كيف أزامن من التقويم؟',
];

export function ChatAssistant({ apartments, locations, bookings, archive }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'مرحباً! أنا مساعدك الذكي في HICHAM STAY.\nاسألني عن أي شيء: الإشغال، الحجوزات، المزامنة، الإيرادات، الفريق، الأرشيف، وكيفية استخدام أي قسم.\n\nجرّب أحد الاقتراحات بالأسفل أو اكتب سؤالك 👇',
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ctx = { apartments, locations, bookings, archive };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const response = generateAIResponse(trimmed, ctx);
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: response,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setTyping(false);
    }, 400);
  }, [ctx]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 sm:bottom-6 left-4 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-l from-indigo-600 to-sky-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        aria-label="المساعد الذكي"
      >
        <div className="relative">
          <Bot size={24} />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-indigo-600 animate-pulse" />
        </div>
        <span className="text-sm font-bold hidden sm:inline">المساعد الذكي</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 sm:bottom-6 left-0 sm:left-4 z-50 w-full sm:w-96 h-[70vh] sm:h-[600px] sm:max-h-[80vh] flex flex-col bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-indigo-600 to-sky-600 text-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Bot size={20} />
          </div>
          <div>
            <p className="text-sm font-bold">المساعد الذكي</p>
            <p className="text-[10px] text-white/70 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              متصل — HICHAM STAY
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          aria-label="إغلاق"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 dark:bg-slate-950">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-md'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-md shadow-sm border border-slate-100 dark:border-slate-700'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1 mb-1 text-indigo-500">
                  <Sparkles size={12} />
                  <span className="text-[10px] font-bold">المساعد</span>
                </div>
              )}
              <p className="leading-relaxed">{msg.text}</p>
              <p className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-white/50' : 'text-slate-400'}`}>
                {msg.time}
              </p>
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Suggestions (only show when few messages) */}
        {messages.length <= 2 && !typing && (
          <div className="pt-2">
            <p className="text-[11px] text-slate-400 font-semibold mb-2 px-1">اقتراحات:</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="اكتب سؤالك..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 max-h-24"
            style={{ fontFamily: "'Cairo', 'Tahoma', sans-serif" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || typing}
            className="shrink-0 w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="إرسال"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
