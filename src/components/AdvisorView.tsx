/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useRef, useEffect } from 'react';
import { DBState } from '../types';
import { 
  Send, 
  Trash2, 
  Sparkles, 
  BrainCircuit,
  TrendingDown,
  Layers,
  ArrowRight,
  HelpCircle
} from 'lucide-react';

interface AdvisorViewProps {
  state: DBState;
  onSendAdvisor: (text: string) => Promise<void>;
  onClearAdvisor: () => Promise<void>;
}

export default function AdvisorView({
  state,
  onSendAdvisor,
  onClearAdvisor
}: AdvisorViewProps) {
  const { advisorChat = [] } = state;
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const quickPrompts = [
    { 
      label: '📊 Summarize Spending', 
      text: 'Please summarize our family spending. Highlight the key categories and which group spent the most.' 
    },
    { 
      label: '👥 Compare Couples/Groups', 
      text: 'Compare the contributions and spending between our family groups: Couple 1 (Naveen & Sneha), Couple 2 (Chetan & Riyati), and Parents (Papa & Mummy). Who spent the most?' 
    },
    { 
      label: '💡 Savings Suggestions', 
      text: 'Based on our expenses list, suggest some budget cuts or practical saving advice for our family.' 
    },
    { 
      label: '💸 Settle Debts & Balances', 
      text: 'Explain the current settlements. Who owes whom, and what is the best way to clear the balances?' 
    }
  ];

  // Auto scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [advisorChat]);

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || inputMessage;
    if (!textToSend.trim()) return;

    setInputMessage('');
    setErrorMsg(null);
    setIsSending(true);

    try {
      await onSendAdvisor(textToSend);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to communicate with AI Advisor.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = async () => {
    if (confirm('Are you sure you want to clear your conversation history with Sharma Finance Advisor?')) {
      await onClearAdvisor();
    }
  };

  // Custom Markdown Parsing Helper for rendering Tables, Bold, and Bullet Lists
  const parseMarkdown = (text: string): React.ReactNode => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];
    let currentTable: string[][] = [];

    const flushList = (key: string | number) => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${key}`} className="list-disc pl-5 my-2.5 space-y-1.5 text-slate-300 text-sm">
            {currentList.map((item, idx) => (
              <li key={idx}>{parseInlineStyles(item)}</li>
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    const flushTable = (key: string | number) => {
      if (currentTable.length > 0) {
        // Filter out separator lines like |---|---|
        const rows = currentTable.filter(row => !row.every(cell => cell.trim().match(/^:?-+:?$/) || cell.trim() === ''));
        if (rows.length > 0) {
          const headers = rows[0];
          const bodyRows = rows.slice(1);
          elements.push(
            <div key={`table-${key}`} className="my-4 overflow-hidden rounded-xl border border-slate-800/80 shadow-xl max-w-full">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse bg-slate-900/60 backdrop-blur-md text-xs">
                  <thead>
                    <tr className="bg-indigo-950/50 border-b border-slate-800">
                      {headers.map((cell, idx) => (
                        <th key={idx} className="px-4 py-3 font-bold text-indigo-300 uppercase tracking-wider whitespace-nowrap">{cell.trim()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {bodyRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-indigo-950/10 transition-colors">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-4 py-2.5 text-slate-300 font-medium">{parseInlineStyles(cell.trim())}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }
        currentTable = [];
      }
    };

    const parseInlineStyles = (txt: string): React.ReactNode[] => {
      // Basic bold **text** parsing
      const parts = txt.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={idx} className="text-white font-bold">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check table
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        flushList(i);
        const cells = line.split('|').slice(1, -1);
        currentTable.push(cells);
        continue;
      } else {
        flushTable(i);
      }

      // Check bullet lists
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const itemText = line.trim().slice(2);
        currentList.push(itemText);
        continue;
      } else {
        flushList(i);
      }

      // Paragraphs
      if (line.trim() !== '') {
        elements.push(
          <p key={`p-${i}`} className="my-2 text-slate-300 text-sm leading-relaxed">
            {parseInlineStyles(line)}
          </p>
        );
      }
    }

    // Final flushes
    flushList('final');
    flushTable('final');

    return <div>{elements}</div>;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[550px] rounded-3xl overflow-hidden border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-2xl relative">
      {/* Decorative Blur Orbs */}
      <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-500 rounded-full opacity-5 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-emerald-500 rounded-full opacity-5 blur-3xl pointer-events-none"></div>

      {/* Header bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-650/20">
            <BrainCircuit className="size-5.5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-wide text-white flex items-center gap-1.5">
              Sharma Finance Advisor
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
            </h3>
            <p className="text-[10px] text-slate-450 font-bold tracking-wide uppercase">
              Gemini-Powered Smart Insights
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {advisorChat.length > 0 && (
            <button 
              type="button" 
              onClick={handleClearChat}
              className="px-3.5 py-1.5 hover:bg-rose-950/30 hover:border-rose-900/30 text-rose-400 hover:text-rose-300 border border-transparent rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 bg-slate-950/20"
              title="Clear advisor history"
            >
              <Trash2 className="size-3.5" />
              Clear Chat
            </button>
          )}
          <span className="bg-indigo-950/60 border border-indigo-900/30 text-indigo-400 text-[10px] font-bold px-2.5 py-1 rounded-lg">
            Active Session
          </span>
        </div>
      </div>

      {/* Main chat bubbles box */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 relative custom-scrollbar flex flex-col">
        {/* Onboarding Welcome Message if history is empty */}
        {advisorChat.length === 0 && (
          <div className="my-auto max-w-lg mx-auto text-center space-y-5 py-6">
            <div className="size-16 rounded-3xl bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-center mx-auto shadow-inner text-indigo-400">
              <Sparkles className="size-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Sharma Family Wealth Advisory</h2>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Welcome! I am your private AI financial advisor. I analyze your family ledger and settlements in real time to recommend budget balances, optimize expenses, and give couple contribution insights.
              </p>
            </div>
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-left text-xs text-slate-400 font-medium space-y-2.5 max-w-sm mx-auto shadow-lg">
              <span className="font-bold text-indigo-300 flex items-center gap-1">
                <HelpCircle className="size-3.5" /> Try asking me:
              </span>
              <ul className="space-y-1.5 list-disc list-inside text-[11px] text-slate-350">
                <li>"Who is spending the most on Groceries?"</li>
                <li>"Provide a comparison between Couple 1 and Couple 2"</li>
                <li>"Are there any pending settlements?"</li>
              </ul>
            </div>
          </div>
        )}

        {advisorChat.map((msg) => {
          const isUser = msg.role === 'user';
          const bubbleStyle = isUser
            ? 'bg-indigo-600 text-white rounded-tr-none ml-auto border border-indigo-500 shadow-lg shadow-indigo-650/5'
            : 'bg-slate-900/70 text-slate-200 rounded-tl-none border border-slate-800 shadow-md';

          return (
            <div 
              key={msg.id} 
              className={`flex flex-col max-w-[85%] ${isUser ? 'self-end' : 'self-start'} animate-fade-in`}
            >
              <div className={`p-4 rounded-2xl ${bubbleStyle}`}>
                {/* Sender Title */}
                <div className="text-[10px] font-extrabold uppercase tracking-widest mb-1.5 flex items-center justify-between gap-4 select-none">
                  <span className={isUser ? 'text-indigo-200' : 'text-indigo-400 font-bold'}>
                    {isUser ? '👤 You' : '🧠 Sharma Finance Advisor'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Msg text (parsed as markdown or plain) */}
                <div className="break-words">
                  {isUser ? (
                    <p className="text-sm font-medium whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    parseMarkdown(msg.text)
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* AI Thinking Animation */}
        {isSending && (
          <div className="flex flex-col max-w-[70%] self-start animate-pulse">
            <div className="p-4 bg-slate-900/60 border border-slate-800 text-slate-400 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
              <div className="flex gap-1">
                <span className="size-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="size-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="size-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-slate-450 font-bold uppercase tracking-wider">Analyzing ledger metrics...</span>
            </div>
          </div>
        )}

        {/* Error Alert Display */}
        {errorMsg && (
          <div className="flex flex-col max-w-lg self-center my-4 w-full animate-fade-in">
            <div className="p-5 bg-rose-950/40 border border-rose-900/40 rounded-2xl shadow-xl text-rose-350 text-xs font-semibold relative overflow-hidden space-y-3">
              <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500 rounded-full opacity-5 blur-2xl"></div>
              <div className="flex items-center gap-2.5">
                <span className="size-2 rounded-full bg-rose-500 shrink-0 animate-ping"></span>
                <span className="font-bold text-rose-400 uppercase tracking-widest text-[10px]">System Advisory Notice</span>
              </div>
              <p className="leading-relaxed text-slate-300 font-medium text-sm">{errorMsg}</p>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 text-slate-400 font-mono text-[10px] space-y-1">
                <div className="text-indigo-400 font-bold uppercase">Setup Guide:</div>
                <div>1. Open your <code className="text-white">.env.local</code> file in the project root.</div>
                <div>2. Set <code className="text-white">GROQ_API_KEY="your_actual_key_here"</code>.</div>
                <div>3. Save the file and restart the server.</div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="bg-slate-950/40 px-6 py-3 border-t border-slate-800/80 flex flex-row items-center gap-2 shrink-0 z-10 select-none relative overflow-hidden">
        <span className="text-[10px] uppercase font-extrabold text-slate-500 mr-1 flex items-center gap-1 shrink-0">
          <Sparkles className="size-3 text-indigo-400" /> Suggest:
        </span>
        <div className="flex overflow-x-auto whitespace-nowrap gap-2 py-1 scrollbar-none scroll-smooth">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              id={`btn-advisor-qp-${idx}`}
              onClick={(e) => handleSendMessage(e, qp.text)}
              disabled={isSending}
              className="px-3.5 py-1.5 bg-slate-900/60 hover:bg-indigo-950/40 hover:text-indigo-300 text-slate-350 border border-slate-800 hover:border-indigo-900/50 rounded-xl text-xs font-semibold cursor-pointer transition shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Textarea Input area */}
      <form onSubmit={handleSendMessage} className="bg-slate-950/70 border-t border-slate-850 p-4 flex items-center gap-3 shrink-0 z-10 relative">
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            id="advisor-text-input"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isSending}
            placeholder="Ask anything about family expenses, couple splits, or savings advice..."
            className="w-full pl-4 pr-12 py-3 text-sm bg-slate-900/90 border border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 font-medium text-slate-100 placeholder-slate-500 disabled:opacity-60"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          id="btn-advisor-submit"
          disabled={isSending || !inputMessage.trim()}
          className="p-3 bg-indigo-600 hover:bg-indigo-550 text-white rounded-2xl transition-all cursor-pointer shadow-lg shadow-indigo-600/10 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center justify-center"
        >
          <Send className="size-4.5" />
        </button>
      </form>
    </div>
  );
}
