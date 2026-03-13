import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, User, Building2 } from 'lucide-react';
import { getConversations, getMessages, sendMessage } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function FamilyMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  const familyId = user?.id || 'f1111111-2222-3333-4444-555555555555';

  useEffect(() => {
    const loadData = async () => {
      try {
        const convos = await getConversations(familyId);
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
      const msg = await sendMessage(activeConversation.id, 'family', familyId, newMessage);
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
          <p className="text-stone-500 mt-1">Communicate with agencies about your applications.</p>
        </div>
      </div>

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
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm">Agency ID: {convo.agency_id.substring(0, 8)}...</h3>
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
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-stone-900">Agency Chat</h2>
                  <p className="text-xs text-stone-500">Usually replies within 24 hours</p>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-stone-50/50">
                {messages.length === 0 ? (
                  <div className="text-center text-stone-500 py-8">
                    <p className="text-sm">Send a message to start the conversation.</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col max-w-[80%] ${
                        msg.sender_type === 'family' ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      <div className={`p-3 rounded-2xl ${
                        msg.sender_type === 'family' 
                          ? 'bg-emerald-600 text-white rounded-br-sm' 
                          : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'
                      }`}>
                        <p className="text-sm">{msg.message}</p>
                      </div>
                      <span className="text-[10px] text-stone-400 mt-1 px-1">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                    disabled={!newMessage.trim()}
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
