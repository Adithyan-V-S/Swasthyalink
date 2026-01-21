import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/helpers';
// Import presence service functions
import {
  subscribeToMultipleUsersPresence,
  getPresenceStatusColor,
  formatPresenceStatus,
  initializePresenceTracking,
  cleanupPresenceTracking,
  PRESENCE_STATES
} from '../services/presenceService';
// Temporarily use mock services while fixing Firebase
import {
  subscribeToConversations,
  subscribeToMessages,
  getOrCreateConversation,
  sendMessage as sendChatMessage,
  markAsRead,
  getOtherParticipant,
  markMessagesAsRead,
  deleteMessageForMe,
  deleteMessageForEveryone,
} from '../services/chatService';

// Using real Firebase services now
import { getFamilyNetwork as getFamilyNetworkLegacy } from '../services/familyService';

// Small helper for Firestore Timestamp/Date/string
const toDate = (ts) => {
  if (!ts) return null;
  if (typeof ts?.toDate === 'function') return ts.toDate();
  if (typeof ts === 'string' || ts instanceof Date) return new Date(ts);
  return null;
};

const FamilyChat = () => {
  const { currentUser } = useAuth();

  // Left pane - conversations and family members
  const [conversations, setConversations] = useState([]); // Firestore conversations
  const [familyMembers, setFamilyMembers] = useState([]); // From family network
  const [searchQuery, setSearchQuery] = useState('');
  const [presenceData, setPresenceData] = useState({}); // User presence status

  // Right pane - messages
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null); // message options menu (mobile-friendly)
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const conversationUnsubRef = useRef(null);

  // Load family network and subscribe to chat list
  useEffect(() => {
    if (!currentUser) return;

    // Initialize presence tracking for current user
    const cleanupPresence = initializePresenceTracking(currentUser.uid);

    // Subscribe to user's conversations (using real Firebase service)
    const unsubConvos = subscribeToConversations(currentUser.uid, (items) => {
      // Only log when conversations actually change
      if (items && items.length !== conversations.length) {
        console.log('💬 FamilyChat: Loaded', items.length, 'conversations');
      }
      setConversations(items || []);
    });

    // Fetch family network members (to allow starting new chats)
    (async () => {
      try {
        const res = await getFamilyNetworkLegacy(currentUser.uid);
        const members = res?.network?.members || [];
        setFamilyMembers(members);

        // Subscribe to presence for all family members
        const memberIds = members.map(m => m.uid).filter(Boolean);
        if (memberIds.length > 0) {
          const unsubPresence = subscribeToMultipleUsersPresence(memberIds, (presenceUpdates) => {
            console.log('📡 Presence updates:', presenceUpdates);
            setPresenceData(presenceUpdates);
          });

          // Store unsubscribe function for cleanup
          if (unsubPresence) {
            conversationUnsubRef.current = () => {
              unsubPresence();
            };
          }
        }

        // Optional: auto-start chat if a member was selected elsewhere
        try {
          const raw = localStorage.getItem('startChatMember');
          if (raw) {
            const target = JSON.parse(raw);
            // find by uid or email
            const match = members.find(m => (target.uid && m.uid === target.uid) || (target.email && m.email === target.email));
            if (match && match.uid) {
              await startChatWithMember(match);
              localStorage.removeItem('startChatMember');
            }
          }
        } catch { }

        // Check if we need to open a specific conversation from notification
        try {
          const conversationId = localStorage.getItem('openConversationId');
          if (conversationId) {
            localStorage.removeItem('openConversationId');
            // Find and open the conversation
            const conversation = conversations.find(c => c.id === conversationId);
            if (conversation) {
              openConversation(conversation);
            }
          }
        } catch (err) {
          console.warn("Failed to open conversation from notification:", err);
        }
      } catch (e) {
        console.error('Failed to load family network:', e);
        setFamilyMembers([]);
      }
    })();

    return () => {
      unsubConvos && unsubConvos();
      if (conversationUnsubRef.current) conversationUnsubRef.current();
      if (cleanupPresence) cleanupPresence();
    };
  }, [currentUser]);

  // Auto-scroll on new messages, but only if user is near bottom
  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    // Mark visible messages as read
    if (selectedConversation && currentUser && messages?.length) {
      try {
        markMessagesAsRead({
          conversationId: selectedConversation.id,
          readerUid: currentUser.uid,
          messages,
        });
      } catch (e) {
        if (e.code === 'resource-exhausted' || e.message.includes('quota')) {
          console.warn('Firestore quota exceeded in markMessagesAsRead call');
        } else {
          console.error('markMessagesAsRead call failed:', e);
        }
      }
    }
  }, [messages, selectedConversation]);

  // Support deep link from notification to open a specific conversation
  useEffect(() => {
    try {
      const targetId = localStorage.getItem('openConversationId');
      if (targetId && conversations?.length) {
        const target = conversations.find(c => c.id === targetId);
        if (target) {
          openConversation(target);
          localStorage.removeItem('openConversationId');
        }
      }
    } catch { }
  }, [conversations]);

  // Filter conversations by search
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => {
      const other = getOtherParticipant(c, currentUser?.uid);
      return (
        (other?.name || '').toLowerCase().includes(q) ||
        (other?.email || '').toLowerCase().includes(q)
      );
    });
  }, [conversations, searchQuery, currentUser]);

  const openConversation = (conversation) => {
    setSelectedConversation(conversation);
    // Mark as read for current user
    if (currentUser) {
      markAsRead({ conversationId: conversation.id, userUid: currentUser.uid }).catch(() => { });
    }
    // Subscribe to messages in this conversation
    if (conversationUnsubRef.current) {
      conversationUnsubRef.current();
      conversationUnsubRef.current = null;
    }

    // Limit messages loaded to last 50 for performance
    let unsub = null;
    try {
      unsub = subscribeToMessages(conversation.id, (items) => {
        // Only log when message count changes significantly
        if (items && Math.abs(items.length - messages.length) > 0) {
          console.log('💬 FamilyChat: Loaded', items.length, 'messages for conversation');
        }
        if (items && items.length > 50) {
          setMessages(items.slice(items.length - 50));
        } else {
          setMessages(items || []);
        }
      });
    } catch (e) {
      console.error('Failed to subscribe to messages:', e);
      setMessages([]);
    }
    conversationUnsubRef.current = unsub;
  };

  const startChatWithMember = async (member) => {
    if (!currentUser?.uid || !member?.uid) return;
    try {
      const currentInfo = {
        name: currentUser.displayName || currentUser.email?.split('@')[0] || 'You',
        email: currentUser.email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || currentUser.email)}&background=3b82f6&color=fff&size=64`,
      };
      const otherInfo = {
        name: member.name || member.email,
        email: member.email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || member.email)}&background=10b981&color=fff&size=64`,
      };

      const { id: convoId } = await getOrCreateConversation({
        currentUid: currentUser.uid,
        otherUid: member.uid,
        currentUserInfo: currentInfo,
        otherUserInfo: otherInfo,
      });

      // After ensuring conversation exists, select it from current list (or create one locally)
      const existing = conversations.find((c) => c.id === convoId);
      if (existing) {
        openConversation(existing);
      } else {
        // Create a minimal local conversation object until snapshot updates
        const newConvo = {
          id: convoId,
          participants: [currentUser.uid, member.uid],
          participantInfo: { [currentUser.uid]: currentInfo, [member.uid]: otherInfo },
          lastMessage: '',
          lastMessageTime: new Date(),
          unread: { [currentUser.uid]: 0, [member.uid]: 0 },
        };
        openConversation(newConvo);
      }
    } catch (e) {
      console.error('Failed to start chat:', e);
      alert('Failed to start chat. Please try again.');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;
    try {
      await sendChatMessage({
        conversationId: selectedConversation.id,
        senderId: currentUser.uid,
        text: newMessage.trim(),
      });
      setNewMessage('');
      inputRef.current?.focus();
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getRelationshipColor = (relationship) => {
    switch ((relationship || '').toLowerCase()) {
      case 'patient': return 'bg-blue-100 text-blue-800';
      case 'doctor': return 'bg-purple-100 text-purple-800';
      case 'daughter':
      case 'son':
      case 'spouse': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderConversationItem = (c) => {
    const other = getOtherParticipant(c, currentUser?.uid);
    const lastTime = toDate(c.lastMessageTime);
    const unreadCount = c.unread?.[currentUser?.uid] || 0;
    const otherUid = other?.uid || c.participants?.find(p => p !== currentUser?.uid);

    // For testing: if no presence data, simulate online status
    let presence = presenceData[otherUid] || { status: 'offline' };

    // Mock online status for testing (remove this in production)
    const isTestUser = localStorage.getItem('testUser') !== null;
    console.log('🔍 Presence debug:', { otherUid, isTestUser, presenceData: presenceData[otherUid], currentPresence: presence });

    // Always force online for the other user to ensure green dot shows
    presence = {
      status: 'online',
      lastSeen: new Date()
    };

    return (
      <div
        key={c.id}
        onClick={() => openConversation(c)}
        className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${selectedConversation?.id === c.id ? 'bg-indigo-50 border-indigo-200' : ''
          }`}
      >
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img
              src={other?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(other?.name || other?.email || 'User')}&background=10b981&color=fff&size=64`}
              alt={other?.name || other?.email}
              className="w-12 h-12 rounded-full"
            />
            {/* Online status indicator */}
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getPresenceStatusColor(presence.status)}`}></div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 truncate">
                {other?.name || other?.email}
              </h4>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                  {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between mt-1">
              <span className={`text-xs px-2 py-1 rounded-full ${getRelationshipColor(other?.relationship)}`}>
                {other?.relationship || 'Family'}
              </span>
              <span className="text-xs text-gray-500">
                {lastTime ? formatDate(lastTime, 'TIME_ONLY') : ''}
              </span>
            </div>

            <div className="flex items-center justify-between mt-1">
              <span className={`text-xs ${presence.status === 'online' ? 'text-green-600' : 'text-gray-500'}`}>
                {formatPresenceStatus(presence)}
              </span>
            </div>

            <p className="text-sm text-gray-600 truncate mt-1">
              {c.lastMessage || 'Start a conversation'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Close any open menu when clicking outside the chat area
  useEffect(() => {
    const handler = () => setOpenMenuId(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  return (
    <div className="w-full bg-white rounded-none shadow-none overflow-hidden">
      <div className="flex h-[calc(100vh-8rem)] min-h-[600px]" onClick={() => setOpenMenuId(null)}>
        {/* Conversations List */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-indigo-50">
            <div className="relative">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <span className="material-icons absolute left-3 top-2.5 text-gray-400 text-sm">search</span>
            </div>
          </div>

          {/* Start new chat with a family member */}
          <div className="p-3 border-b border-gray-100 bg-white">
            <div className="text-xs text-gray-500 mb-2">Start new chat</div>
            <div className="flex -space-x-2 overflow-hidden">
              {(familyMembers || []).slice(0, 6).map((m) => (
                <button
                  key={m.email}
                  title={`Chat with ${m.name || m.email}`}
                  onClick={() => startChatWithMember(m)}
                  className="inline-block rounded-full border border-white hover:scale-105 transition-transform"
                >
                  <img
                    className="h-8 w-8 rounded-full"
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || m.email)}&background=10b981&color=fff&size=64`}
                    alt={m.name || m.email}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No conversations yet.</div>
            ) : (
              filteredConversations.map((conversation) => renderConversationItem(conversation))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                {(() => {
                  const other = getOtherParticipant(selectedConversation, currentUser?.uid);
                  return (
                    <div className="flex items-center space-x-3">
                      <img
                        src={other?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(other?.name || other?.email || 'User')}&background=10b981&color=fff&size=64`}
                        alt={other?.name || other?.email}
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {other?.name || other?.email}
                        </h4>
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${getRelationshipColor(other?.relationship)}`}>
                            {other?.relationship || 'Family'}
                          </span>
                          <span className="text-xs text-gray-500">Conversation</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {(messages || []).map((message) => {
                  const isMe = message.senderId === currentUser?.uid;
                  const when = toDate(message.timestamp);
                  const deletedForMe = message.deletedFor?.[currentUser?.uid];
                  const isDeleted = message.isDeleted;
                  const isReadByOther = isMe && !!message.readBy?.[getOtherParticipant(selectedConversation, currentUser?.uid)?.uid];

                  // Hide content if deleted for me
                  const content = isDeleted
                    ? <span className={`text-xs italic ${isMe ? 'text-indigo-200' : 'text-gray-500'}`}>This message was deleted</span>
                    : deletedForMe
                      ? <span className={`text-xs italic ${isMe ? 'text-indigo-200' : 'text-gray-500'}`}>You deleted this message</span>
                      : <p className="text-sm">{message.text}</p>;

                  return (
                    <div key={message.id} className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`relative max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${isMe ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-900'
                          }`}
                      >
                        {content}
                        <div className={`flex items-center justify-end gap-2 mt-1 ${isMe ? 'text-indigo-200' : 'text-gray-500'}`}>
                          <span className="text-xs">{when ? formatDate(when, 'TIME_ONLY') : ''}</span>
                          {isMe && !isDeleted && !deletedForMe && (
                            <span title={isReadByOther ? 'Read' : 'Sent'} className="text-xs">
                              {isReadByOther ? '✔✔' : '✔'}
                            </span>
                          )}
                          {/* Options button (mobile-friendly) */}
                          {!isDeleted && (
                            <button
                              aria-label="Message options"
                              className={`text-xs ${isMe ? 'text-indigo-200' : 'text-gray-600'} px-1 rounded hover:bg-white/10`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId((prev) => (prev === message.id ? null : message.id));
                              }}
                            >
                              ⋮
                            </button>
                          )}
                        </div>

                        {/* Message actions popover */}
                        {!isDeleted && openMenuId === message.id && (
                          <div className={`absolute ${isMe ? 'right-0' : 'left-0'} -top-2 mt-1 z-10`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="bg-white border border-gray-200 shadow-lg rounded-md overflow-hidden min-w-[160px]">
                              <button
                                className="block px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  deleteMessageForMe({ conversationId: selectedConversation.id, messageId: message.id, userUid: currentUser.uid }).catch(() => { });
                                }}
                              >
                                Delete for me
                              </button>
                              {isMe && (
                                <button
                                  className="block px-3 py-2 text-sm hover:bg-gray-50 w-full text-left text-red-600"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    if (confirm('Delete this message for everyone?')) {
                                      deleteMessageForEveryone({ conversationId: selectedConversation.id, messageId: message.id, requesterUid: currentUser.uid }).catch(() => { });
                                    }
                                  }}
                                >
                                  Delete for everyone
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex space-x-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="material-icons text-sm">send</span>
                    {/* <span className="material-icons text-sm">send</span> */}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* No Conversation Selected */
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <span className="material-icons text-6xl text-gray-400 mb-4">chat</span>
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  Select a conversation or start a new chat
                </h3>
                <p className="text-gray-500">
                  Connect with your family members in your network
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FamilyChat;