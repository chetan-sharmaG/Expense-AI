/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { DBState } from '../types';
import { 
  Send, 
  Image as ImageIcon,
  Check, 
  Trash2, 
  Sparkles, 
  ArrowDownLeft, 
  User as UserIcon,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  CheckCheck,
  Zap
} from 'lucide-react';

interface WhatsAppBotViewProps {
  state: DBState;
  onSendWhatsApp: (text: string, base64Image?: string, senderName?: string) => Promise<void>;
  onClearWhatsApp: () => Promise<void>;
}

export default function WhatsAppBotView({
  state,
  onSendWhatsApp,
  onClearWhatsApp
}: WhatsAppBotViewProps) {
  const { whatsappChat, users } = state;

  const [inputMessage, setInputMessage] = useState('');
  const [selectedSender, setSelectedSender] = useState(users[0]?.name || 'Rahul');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const quickPrompts = React.useMemo(() => {
    const defaultUser = users[0]?.name || 'Rahul';
    const secondUser = users[1]?.name || 'Priya';
    const thirdUser = users[4]?.name || 'Papa';

    return [
      { text: `Paid ₹850 for vegetables`, label: 'Vegetables' },
      { text: `${secondUser} spent ₹1400 on Shopping at DMart`, label: 'Shopping' },
      { text: `${thirdUser} spent ₹600 at Chemist for medicines`, label: 'Medicines' },
      { text: 'Yes, confirm the expense', label: 'Confirm' }
    ];
  }, [users]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll chat to bottom when logs updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [whatsappChat]);

  // Handle direct message send
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() && !attachedImage) return;

    const textToSend = inputMessage;
    const imgToSend = attachedImage || undefined;

    // Clear buffer inputs
    setInputMessage('');
    setAttachedImage(null);
    setIsSending(true);

    try {
      await onSendWhatsApp(textToSend, imgToSend, selectedSender);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  // Handle image loading to base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Quick chip triggers
  const handleQuickPromptClick = async (promptText: string) => {
    setInputMessage(promptText);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[500px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-sm">
      
      {/* WhatsApp Header bar */}
      <div className="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-[#128c7e] border border-[#25d366]/40 flex items-center justify-center font-bold text-base shadow-inner">
            💬
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-wide">Sharma family Assembly</h3>
            <p className="text-[10px] text-teal-100 font-medium">
              FamBudget Bot, {users.map(u => u.name).join(', ')} (Online)
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-4 text-teal-100">
          <button type="button" className="hover:text-white transition-colors cursor-pointer"><Video className="size-4" /></button>
          <button type="button" className="hover:text-white transition-colors cursor-pointer"><Phone className="size-4" /></button>
          <button 
            type="button" 
            id="btn-clear-chat"
            onClick={onClearWhatsApp}
            className="hover:text-rose-200 transition-colors cursor-pointer text-xs font-semibold bg-[#128c7e] px-2.5 py-1 rounded"
            title="Clean Chat History"
          >
            Clear logs
          </button>
        </div>
      </div>

      {/* Selector of which Member is "Typing" */}
      <div className="bg-[#090d16] border-b border-slate-800 px-4 py-2 flex flex-row items-center gap-3 text-xs text-slate-400 shrink-0 select-none overflow-hidden">
        <span className="font-semibold text-slate-355 flex items-center gap-1 shrink-0">
          <Zap className="size-3 text-indigo-400" /> Simulated as:
        </span>
        <div className="flex overflow-x-auto whitespace-nowrap gap-1.5 py-1 scrollbar-none scroll-smooth">
          {users.map(u => (
            <button
              key={u.id}
              type="button"
              id={`btn-sender-${u.name}`}
              onClick={() => setSelectedSender(u.name)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition shrink-0 ${
                selectedSender === u.name 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
              }`}
            >
              {u.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main chat bubbles box */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#efeae2] relative custom-scrollbar">
        {/* Subtle decorative security end-to-end stamp */}
        <div className="mx-auto max-w-xs text-center">
          <span className="bg-[#ffe0b2]/80 text-[#5d4037] text-[9px] px-3 py-1.5 rounded-lg border border-[#ffe0b2] font-semibold">
            🔒 Messages and calls are end-to-end sandbox encrypted.
          </span>
        </div>

        {whatsappChat.map((msg) => {
          const isBot = msg.sender === 'bot';
          const bubbleStyle = isBot
            ? 'bg-white text-slate-850 rounded-tl-none mr-12'
            : 'bg-[#d9fdd3] text-slate-900 rounded-tr-none ml-12 self-end ml-auto';

          return (
            <div 
              key={msg.id} 
              className={`flex flex-col max-w-[85%] ${isBot ? 'self-start' : 'self-end ml-auto'} animate-fade-in`}
            >
              <div className={`p-3 rounded-2xl shadow-sm border border-black/5 ${bubbleStyle}`}>
                
                {/* Sender Title */}
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-indigo-800 flex items-center justify-between gap-2">
                  <span>{isBot ? '🤖 FamBudget Bot Agent' : `👤 ${msg.senderName || selectedSender}`}</span>
                  <span className="text-[9px] text-slate-400 normal-case font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Msg text */}
                <div className="text-sm font-sans break-words whitespace-pre-wrap leading-relaxed">
                  {msg.text}
                </div>

                {/* Optional screenshot visual preview */}
                {msg.image && (
                  <div className="mt-2.5 max-w-xs rounded overflow-hidden shadow-inner border border-stone-200 bg-white">
                    <img 
                      src={msg.image} 
                      alt="WhatsApp receipt screenshot" 
                      className="max-h-48 w-full object-contain" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="bg-slate-50 px-2 py-1 flex items-center gap-1 text-[10px] text-slate-500 font-mono font-medium">
                      <span>Ref receipt file</span>
                    </div>
                  </div>
                )}
                
                {/* Tick indicators */}
                <div className="text-right mt-1 flex justify-end">
                  <CheckCheck className="size-3.5 text-blue-500" />
                </div>
              </div>
            </div>
          );
        })}

        {/* AI Thinking Animation */}
        {isSending && (
          <div className="flex flex-col max-w-[70%] self-start animate-pulse">
            <div className="p-3.5 bg-white text-slate-800 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
              <div className="flex gap-1">
                <span className="size-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="size-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="size-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[11px] text-slate-450 font-medium">FamBudget AI parses log context...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="bg-[#090d16] px-4 py-2 border-t border-slate-800 flex flex-row items-center gap-1.5 shrink-0 overflow-hidden">
        <span className="text-[9px] uppercase font-bold text-slate-500 mr-1 select-none flex items-center gap-0.5 shrink-0">
          <Sparkles className="size-3 text-indigo-400" /> Quick Logs:
        </span>
        <div className="flex overflow-x-auto whitespace-nowrap gap-1.5 py-1 scrollbar-none scroll-smooth">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              id={`btn-quick-${idx}`}
              onClick={() => handleQuickPromptClick(qp.text)}
              className="px-2.5 py-1 bg-indigo-950/40 hover:bg-slate-800 hover:border-slate-700 text-indigo-350 border border-indigo-900/40 rounded-lg text-[10px] font-bold cursor-pointer transition shrink-0"
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Textarea Input area */}
      <form onSubmit={handleSendMessage} className="bg-[#090d16] border-t border-slate-850 p-3 flex items-center gap-2.5 shrink-0">
        
        {/* Attachment menu icon */}
        <label id="lbl-whatsapp-attach" className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-full transition-colors cursor-pointer shrink-0">
          <Paperclip className="size-4.5" />
          <input 
            type="file" 
            id="whatsapp-file-input"
            accept="image/*" 
            onChange={handleImageUpload} 
            className="hidden" 
          />
        </label>

        {/* Textbox */}
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            id="whatsapp-text-input"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type 'Paid ₹1200 split parents' or upload screenshot..."
            className="w-full pl-3 pr-20 py-2.5 text-sm bg-slate-950 border border-slate-805/80 rounded-xl focus:outline-none focus:border-indigo-500 font-medium text-slate-200"
          />

          {/* Screenshot attachment badge preview */}
          {attachedImage && (
            <div className="absolute right-2 px-2 py-1 bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 text-[9px] rounded font-bold flex items-center gap-1 shadow-sm animate-fade-in">
              <ImageIcon className="size-3 shrink-0" /> Loaded
              <button 
                type="button" 
                id="btn-remove-whatsapp-attach"
                onClick={() => setAttachedImage(null)} 
                className="text-stone-400 hover:text-white font-extrabold ml-1 cursor-pointer"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Submit sender icon */}
        <button
          type="submit"
          id="btn-whatsapp-submit"
          disabled={isSending || (!inputMessage.trim() && !attachedImage)}
          className="p-2.5 bg-[#075e54] hover:bg-[#128c7e] text-white rounded-full transition-shadow cursor-pointer shadow disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Send className="size-4" />
        </button>
      </form>

    </div>
  );
}
