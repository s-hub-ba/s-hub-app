import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, User, Baby } from 'lucide-react';
import { getConversations, getMessages, sendMessage } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function AgencyMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');

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
  
  const agencyId = user?.uid || '';

  if (!agencyId) {
    return <div className="p-8 text-center text-stone-500">Please sign in to view messages.</div>;
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const convos = (await getConversations(agencyId, 'agency')) || [];
        setConversations(convos);
        if (convos.length > 0) {
          setActiveConversation(convos[0]);
          const msgs = await getMessages(convos[0].id);
          setMessages(msgs);
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
      }
    };
    loadData();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;

    try {
      const msg = await sendMessage(activeConversation.id, 'agency', agencyId, newMessage);
      setMessages(prev => [...prev, msg]);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="space-y-8 pb-12 h-[calc(100vh-8rem)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Messages</h1>
          <p className="text-stone-500 mt-1">Communicate with families and nannies.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden flex h-full min-h-[500px]">
        {/* Conversations List */}
        <div className="w-1/3 border-r border-stone-200 flex flex-col">
          <div className="p-4 border-b border-stone-100 bg-stone-50">
            <h2 className="font-bold text-stone-900">Conversations</h2>
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
                  onClick={async () => {
                    setActiveConversation(convo);
                    const msgs = await getMessages(convo.id);
                    setMessages(msgs);
                  }}
                  className={`w-full p-4 text-left border-b border-stone-100 transition-colors ${
                    activeConversation?.id === convo.id 
                      ? 'bg-emerald-50 border-emerald-100' 
                      : 'hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                      {convo.family_id ? <Baby className="h-5 w-5" /> : <User className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-stone-900 text-sm">
                        {convo.family_name || (convo.family_id ? `Family ID: ${convo.family_id.substring(0, 8)}...` : `Nanny ID: ${convo.nanny_id.substring(0, 8)}...`)}
                      </h3>
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
                  {activeConversation.family_id ? <Baby className="h-5 w-5" /> : <User className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-stone-900">
                    {activeConversation.family_name || (activeConversation.family_id ? `Family ID: ${activeConversation.family_id.substring(0, 8)}...` : `Nanny ID: ${activeConversation.nanny_id.substring(0, 8)}...`)}
                  </h3>
                  <p className="text-xs text-stone-500">Active now</p>
                </div>
              </div>
              {activeConversation.inquiry_type === 'agency_intro' && (
                <div className="mx-4 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                  <p className="font-semibold uppercase tracking-wider">Inquiry Details</p>
                  {activeConversation.family_email && <p className="mt-1">Email: {activeConversation.family_email}</p>}
                  {activeConversation.family_phone && <p className="mt-1">Phone: {activeConversation.family_phone}</p>}
                  {activeConversation.family_borough && <p className="mt-1">Borough: {activeConversation.family_borough}</p>}
                  <p className="mt-1">{getInquiryScheduleLabel(activeConversation)}</p>
                  {activeConversation.inquiry_description_preview && (
                    <p className="mt-1 line-clamp-2">{activeConversation.inquiry_description_preview}</p>
                  )}
                </div>
              )}

              <div className="flex-1 p-6 overflow-y-auto bg-stone-50/50 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-stone-500 mt-10">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.sender_type === 'agency' && msg.sender_id === agencyId;
                    return (
                      <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                          isMe 
                            ? 'bg-emerald-600 text-white rounded-br-sm' 
                            : 'bg-white border border-stone-200 text-stone-900 rounded-bl-sm shadow-sm'
                        }`}>
                          <p className="text-sm">{msg.content}</p>
                          <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-emerald-100' : 'text-stone-400'}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 bg-white border-t border-stone-100">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..." 
                    className="flex-1 px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-stone-500 p-8 text-center">
              <MessageSquare className="h-12 w-12 text-stone-300 mb-4" />
              <h3 className="text-lg font-bold text-stone-900">Select a conversation</h3>
              <p className="text-stone-500 mt-1">Choose a family or nanny from the list to start messaging.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
