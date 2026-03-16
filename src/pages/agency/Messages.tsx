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
  
  const agencyId = user?.id || 'a1b2c3d4-e5f6-7890-1234-56789abcdef0';

  useEffect(() => {
    const loadData = async () => {
      try {
        const convos = await getConversations(agencyId, 'agency');
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
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm">
                        {convo.family_id ? `Family ID: ${convo.family_id.substring(0, 8)}...` : `Nanny ID: ${convo.nanny_id.substring(0, 8)}...`}
                      </h3>
                      <p className="text-xs text-stone-500 truncate">Click to view messages</p>
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
                    {activeConversation.family_id ? `Family ID: ${activeConversation.family_id.substring(0, 8)}...` : `Nanny ID: ${activeConversation.nanny_id.substring(0, 8)}...`}
                  </h3>
                  <p className="text-xs text-stone-500">Active now</p>
                </div>
              </div>

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
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
