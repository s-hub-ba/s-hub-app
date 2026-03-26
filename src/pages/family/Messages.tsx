import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, Send, Building2 } from 'lucide-react';
import { getConversations, getMessages, sendMessage } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function FamilyMessages() {
  const location = useLocation();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const familyId = user?.uid || '';
  const conversationFromQuery = new URLSearchParams(location.search).get('conversation');

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatTime = (value: any) => {
    const date = toDate(value);
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatConversationTime = (convo: any) => {
    const date = toDate(convo?.updated_at || convo?.created_at);
    if (!date) return '';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getInquiryScheduleLabel = (convo: any) => {
    if (convo?.inquiry_schedule_type === 'date_range') {
      return `Date range: ${convo.inquiry_start_date || 'TBD'} to ${convo.inquiry_end_date || 'TBD'}`;
    }

    if (convo?.inquiry_schedule_type === 'weekly_days') {
      const weekdays = Array.isArray(convo?.inquiry_weekdays) ? convo.inquiry_weekdays : [];
      return `Weekdays: ${weekdays.join(', ') || 'Not specified'}`;
    }

    return null;
  };

  useEffect(() => {
    if (!familyId) {
      setConversations([]);
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    let cancelled = false;
    const loadConversations = async () => {
      try {
        setLoadError(null);
        const convos = (await getConversations(familyId, 'family')) || [];
        if (cancelled) return;

        setConversations(convos);

        if (convos.length === 0) {
          setActiveConversation(null);
          setMessages([]);
          return;
        }

        setActiveConversation((prev: any) => {
          const preferred = conversationFromQuery ? convos.find(c => c.id === conversationFromQuery) : null;
          const existing = prev?.id ? convos.find(c => c.id === prev.id) : null;
          return preferred || existing || convos[0];
        });
      } catch (error) {
        console.error('Error loading conversations:', error);
        if (!cancelled) {
          setLoadError('Unable to load messages right now. Please refresh and try again.');
        }
      }
    };

    loadConversations();
    const intervalId = window.setInterval(loadConversations, 7000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [familyId, conversationFromQuery]);

  useEffect(() => {
    if (!activeConversation?.id) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    const loadMessages = async () => {
      try {
        const msgs = await getMessages(activeConversation.id);
        if (!cancelled) {
          setMessages((msgs || []).filter(Boolean));
        }
      } catch (error) {
        console.error('Error loading messages:', error);
        if (!cancelled) {
          setLoadError('Unable to refresh messages right now. Please try again shortly.');
        }
      }
    };

    loadMessages();
    const intervalId = window.setInterval(loadMessages, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeConversation?.id]);

  if (!familyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to view messages.</div>;
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !activeConversation || isSending) return;

    setIsSending(true);
    try {
      setLoadError(null);
      const msg = await sendMessage(activeConversation.id, 'family', familyId, trimmedMessage);
      if (msg?.id) {
        setMessages(prev => [...prev, msg].filter(Boolean));
        setNewMessage('');

        const updatedAt = new Date().toISOString();
        setConversations(prev => {
          const next = (prev || []).map(convo => convo.id === activeConversation.id
            ? { ...convo, last_message: trimmedMessage, updated_at: updatedAt }
            : convo
          );
          return next.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setLoadError(error instanceof Error ? error.message : 'Unable to send your message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 h-[calc(100vh-8rem)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Messages</h1>
          <p className="text-stone-500 mt-1">Communicate with agencies about your applications.</p>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden flex h-full min-h-[500px]">
        {/* Conversations List */}
        <div className="w-1/3 border-r border-stone-200 flex flex-col">
          <div className="p-4 border-b border-stone-100 bg-stone-50">
            <h2 className="font-bold text-stone-900">Agencies</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-stone-500">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-stone-300" />
                <p className="text-sm">No conversations yet.</p>
              </div>
            ) : (
              conversations.map(convo => (
                <button
                  key={convo.id}
                  onClick={() => {
                    setActiveConversation(convo);
                  }}
                  className={`w-full p-4 text-left border-b border-stone-100 transition-colors ${
                    activeConversation?.id === convo.id 
                      ? 'bg-emerald-50 border-emerald-100' 
                      : 'hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-stone-900 text-sm">{convo.agency_name || `Agency ID: ${convo.agency_id.substring(0, 8)}...`}</h3>
                        <span className="text-[11px] text-stone-400 shrink-0">{formatConversationTime(convo)}</span>
                      </div>
                      <p className="text-xs text-stone-500 truncate">{convo.last_message || (convo.inquiry_type === 'agency_intro' ? 'Inquiry thread' : 'Click to view messages')}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {activeConversation ? (
            <>
              <div className="p-4 border-b border-stone-100 bg-white flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-stone-900">{activeConversation.agency_name || 'Agency Chat'}</h2>
                  <p className="text-xs text-stone-500">Usually replies within 24 hours</p>
                </div>
              </div>
              {activeConversation.inquiry_type === 'agency_intro' && (
                <div className="mx-4 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                  <p className="font-semibold uppercase tracking-wider">Inquiry Details</p>
                  <p className="mt-1">{getInquiryScheduleLabel(activeConversation)}</p>
                  {activeConversation.inquiry_description_preview && (
                    <p className="mt-1 line-clamp-2">{activeConversation.inquiry_description_preview}</p>
                  )}
                </div>
              )}
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-stone-50/50">
                {messages.length === 0 ? (
                  <div className="text-center text-stone-500 py-8">
                    <p className="text-sm">Send a message to start the conversation.</p>
                  </div>
                ) : (
                  messages.filter(Boolean).map(msg => (
                    <div 
                      key={msg.id || `${msg.sender_id || 'unknown'}-${msg.created_at?.seconds || msg.created_at || 'unknown-time'}`} 
                      className={`flex flex-col max-w-[80%] ${
                        msg.sender_type === 'family' ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      <div className={`p-3 rounded-2xl ${
                        msg.sender_type === 'family' 
                          ? 'bg-emerald-600 text-white rounded-br-sm' 
                          : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'
                      }`}>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                      <span className="text-[10px] text-stone-400 mt-1 px-1">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-4 bg-white border-t border-stone-100">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input 
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim() || isSending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-stone-400 bg-stone-50/50">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
