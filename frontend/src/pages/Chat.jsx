import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/it.js';
import { fetchThreads, fetchThread, sendMessage, updateThreadNote } from '../api/chat.js';
import useSocket from '../hooks/useSocket.js';
import useCountdown from '../hooks/useCountdown.js';
import { getToken, subscribeAuthChange } from '../lib/auth.js';
import CallPopup from '../components/CallPopup.jsx';
import MicTest from '../components/MicTest.jsx';
import client from '../api/client.js';

const formatDuration = seconds => {
  if (seconds == null) return '--:--';
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const buildPreview = message => {
  if (!message) return 'Nessun messaggio';
  return message.body.length > 48 ? `${message.body.slice(0, 45)}…` : message.body;
};

const resolveName = thread => {
  if (!thread) return '';
  return thread.master?.name || thread.customer?.name || 'Conversazione';
};

const channelLabels = {
  chat: 'Sessione chat',
  voice: 'Sessione voce',
  chat_voice: 'Sessione chat + voce'
};

const channelShortLabels = {
  chat: 'Chat',
  voice: 'Voce',
  chat_voice: 'Chat + Voce'
};

const ChatBubbleIcon = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M5 5h14a2 2 0 012 2v7a2 2 0 01-2 2h-5.6a1 1 0 00-.7.3L9 20v-2H7a2 2 0 01-2-2V7a2 2 0 012-2z" />
    <path d="M8 10h8" />
    <path d="M8 13h5" />
  </svg>
);

const VoiceIcon = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M6.5 3h3.2a2 2 0 011.9 1.4l1 3.3a2 2 0 01-.7 2.1l-1.5 1.1a10.5 10.5 0 005.2 5.2l1.1-1.5a2 2 0 012.1-.7l3.3 1a2 2 0 011.4 1.9v3.2a2 2 0 01-2 2A17.8 17.8 0 013 6.5a2 2 0 012-2Z" />
    <path d="M15 4.5a6.5 6.5 0 016.5 6.5" />
    <path d="M15 8a3 3 0 013 3" />
  </svg>
);

const PhoneIcon = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const PhoneOffIcon = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
    <line x1="22" x2="2" y1="2" y2="22"/>
  </svg>
);

const MicIcon = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" x2="12" y1="19" y2="23"/>
    <line x1="8" x2="16" y1="23" y2="23"/>
  </svg>
);

const ChannelGlyph = ({ channel, ...props }) => {
  if (channel === 'chat_voice') return <VoiceIcon {...props} />;
  return <ChatBubbleIcon {...props} />;
};

const formatRate = cpm => (typeof cpm === 'number' ? `${(cpm / 100).toFixed(2)} € / min` : null);

const getInitial = value => (value?.trim()?.charAt(0)?.toUpperCase() || '•');

export default function Chat() {
  dayjs.locale('it');
  const { threadId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [draft, setDraft] = useState('');
  const [token, setTokenState] = useState(() => getToken());
  const messageEndRef = useRef(null);
  const queryClient = useQueryClient();
  const socket = useSocket();
  const [noteDraft, setNoteDraft] = useState('');
  const [noteBaseline, setNoteBaseline] = useState('');
  const [noteUpdatedAt, setNoteUpdatedAt] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [signalHandler, setSignalHandler] = useState(null);

  useEffect(() => {
    const sync = () => {
      setTokenState(getToken());
    };
    const unsubscribe = subscribeAuthChange(sync);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!token) {
      toast.error('Effettua l\'accesso per usare la chat.');
      navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
    }
  }, [token, navigate, location.pathname, location.search]);

  const threadsQuery = useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: fetchThreads,
    enabled: Boolean(token)
  });

  const threadQuery = useQuery({
    queryKey: ['chat', 'thread', threadId],
    queryFn: () => fetchThread(threadId),
    enabled: Boolean(token && threadId)
  });

  useEffect(() => {
    if (!threadId) {
      setNoteDraft('');
      setNoteBaseline('');
      setNoteUpdatedAt(null);
    }
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    const noteValue = threadQuery.data?.note ?? '';
    setNoteDraft(noteValue);
    setNoteBaseline(noteValue);
    setNoteUpdatedAt(threadQuery.data?.noteUpdatedAt || null);
  }, [threadId, threadQuery.data?.note, threadQuery.data?.noteUpdatedAt]);

  const sendMutation = useMutation({
    mutationFn: ({ id, body }) => sendMessage(id, body),
    onSuccess: async message => {
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
      await queryClient.invalidateQueries({ queryKey: ['chat', 'thread', threadId] });
      setTimeout(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    },
    onError: error => {
      const msg = error?.response?.data?.message || 'Impossibile inviare il messaggio.';
      toast.error(msg);
    }
  });

  const threads = useMemo(() => threadsQuery.data || [], [threadsQuery.data]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleMessage = payload => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
      if (payload.threadId && payload.threadId === threadId) {
        queryClient.invalidateQueries({ queryKey: ['chat', 'thread', threadId] });
      }
    };
    const handleThreadUpdate = payload => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
      if (payload.threadId && payload.threadId === threadId) {
        queryClient.invalidateQueries({ queryKey: ['chat', 'thread', threadId] });
      }
    };

    const handleCallIncoming = payload => {
      if (payload.threadId === threadId) {
        setActiveCall({ ...payload, isIncoming: true });
      }
    };

    const handleCallOutgoing = payload => {
      if (payload.threadId === threadId) {
        setActiveCall({ ...payload, isIncoming: false });
      }
    };

    const handleCallAccepted = payload => {
      if (payload.threadId === threadId) {
        setActiveCall(prev => prev ? { ...prev, status: 'accepted' } : null);
      }
    };

    const handleCallRejected = payload => {
      if (payload.threadId === threadId) {
        setActiveCall(null);
      }
    };

    const handleCallEnded = payload => {
      if (payload.threadId === threadId) {
        setActiveCall(null);
      }
    };

    const handleCallTimeout = payload => {
      if (payload.threadId === threadId) {
        setActiveCall(null);
      }
    };

    const handleCallSignal = payload => {
      if (payload.threadId === threadId && signalHandler) {
        signalHandler(payload);
      }
    };
    socket.on('chat:message', handleMessage);
    socket.on('chat:thread:updated', handleThreadUpdate);
    socket.on('chat:call:incoming', handleCallIncoming);
    socket.on('chat:call:outgoing', handleCallOutgoing);
    socket.on('chat:call:accepted', handleCallAccepted);
    socket.on('chat:call:rejected', handleCallRejected);
    socket.on('chat:call:ended', handleCallEnded);
    socket.on('chat:call:timeout', handleCallTimeout);
    socket.on('chat:call:signal', handleCallSignal);
    
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:thread:updated', handleThreadUpdate);
      socket.off('chat:call:incoming', handleCallIncoming);
      socket.off('chat:call:outgoing', handleCallOutgoing);
      socket.off('chat:call:accepted', handleCallAccepted);
      socket.off('chat:call:rejected', handleCallRejected);
      socket.off('chat:call:ended', handleCallEnded);
      socket.off('chat:call:timeout', handleCallTimeout);
      socket.off('chat:call:signal', handleCallSignal);
    };
  }, [socket, queryClient, threadId, signalHandler]);

  useEffect(() => {
    if (!threadId && threads.length > 0) {
      navigate(`/chat/${threads[0].id}`, { replace: true });
    }
  }, [threads, threadId, navigate]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [threadQuery.data?.messages?.length]);

  const activeThread = threadQuery.data?.thread;
  const remainingSeconds = useCountdown(activeThread?.expiresAt);
  const canPost = threadQuery.data?.canPost && (remainingSeconds == null || remainingSeconds > 0);
  const isNoteDirty = noteDraft !== noteBaseline;

  const handleSubmit = event => {
    event.preventDefault();
    if (!threadId || !draft.trim()) return;
    sendMutation.mutate({ id: threadId, body: draft.trim() });
  };

  const noteMutation = useMutation({
    mutationFn: note => updateThreadNote(threadId, note),
    onSuccess: data => {
      const noteValue = data?.note ?? '';
      const updatedAt = data?.noteUpdatedAt || null;
      setNoteDraft(noteValue);
      setNoteBaseline(noteValue);
      setNoteUpdatedAt(updatedAt);
      if (threadId) {
        queryClient.setQueryData(['chat', 'thread', threadId], previous =>
          previous ? { ...previous, note: noteValue, noteUpdatedAt: updatedAt } : previous
        );
      }
      toast.success('Note salvate.');
    },
    onError: error => {
      const msg = error?.response?.data?.message || 'Impossibile salvare le note.';
      toast.error(msg);
    }
  });

  const handleNoteSave = () => {
    if (!threadId) return;
    noteMutation.mutate(noteDraft);
  };

  const startCall = async () => {
    if (!threadId || !canPost) return;
    
    try {
      const response = await client.post(`/chat/threads/${threadId}/call/start`);
      // Call state will be updated via socket events
    } catch (error) {
      const msg = error?.response?.data?.message || 'Impossibile avviare la chiamata.';
      toast.error(msg);
    }
  };

  const acceptCall = async () => {
    if (!activeCall || !threadId) return;
    
    try {
      await client.post(`/chat/threads/${threadId}/call/${activeCall.callId}/accept`);
      // Call state will be updated via socket events
    } catch (error) {
      const msg = error?.response?.data?.message || 'Impossibile accettare la chiamata.';
      toast.error(msg);
      setActiveCall(null);
    }
  };

  const rejectCall = async () => {
    if (!activeCall || !threadId) return;
    
    try {
      await client.post(`/chat/threads/${threadId}/call/${activeCall.callId}/reject`);
      setActiveCall(null);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Impossibile rifiutare la chiamata.';
      toast.error(msg);
      setActiveCall(null);
    }
  };

  const endCall = async () => {
    if (!activeCall || !threadId) return;
    
    try {
      await client.post(`/chat/threads/${threadId}/call/${activeCall.callId}/end`);
      setActiveCall(null);
    } catch (error) {
      const msg = error?.response?.data?.message || 'Impossibile terminare la chiamata.';
      toast.error(msg);
      setActiveCall(null);
    }
  };

  const viewerRole = threadQuery.data?.viewerRole;
  const viewerMessageRole = viewerRole === 'master' ? 'master' : viewerRole === 'client' ? 'client' : null;
  const messages = threadQuery.data?.messages || [];
  const sessionChannel = activeThread?.channel || activeThread?.booking?.channel;
  const channelLabel = sessionChannel ? channelLabels[sessionChannel] || 'Sessione' : null;
  const sessionRateLabel = sessionChannel
    ? formatRate(
        sessionChannel === 'chat'
          ? activeThread?.master?.chatRateCpm
          : sessionChannel === 'voice'
          ? activeThread?.master?.voiceRateCpm
          : activeThread?.master?.chatVoiceRateCpm
      )
    : null;
  const bookingWindowLabel = activeThread?.booking
    ? `${dayjs(activeThread.booking.date).format('DD MMMM YYYY')} · ${activeThread.booking.start} - ${activeThread.booking.end}`
    : '';
  const allowedMinutes = activeThread?.allowedSeconds > 0 ? Math.ceil(activeThread.allowedSeconds / 60) : null;
  const masterName = activeThread?.master?.name || 'Master Rivelya';
  const masterAvatar = activeThread?.master?.avatarUrl || '';
  const masterInitial = getInitial(activeThread?.master?.name || 'M');
  const customerName = activeThread?.customer?.name || 'Cliente Rivelya';
  const customerAvatar = activeThread?.customer?.avatarUrl || '';
  const customerInitial = getInitial(activeThread?.customer?.name || 'C');

  return (
    <section className="container chat-page">
      <MicTest />
      <div className="chat-layout">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h1>Conversazioni</h1>
            <p>Gestisci richieste e sessioni accettate.</p>
          </div>
          <div className="chat-thread-list">
            {threadsQuery.isLoading && <p className="chat-placeholder">Caricamento…</p>}
            {!threadsQuery.isLoading && threads.length === 0 && (
              <p className="chat-placeholder">Non hai ancora conversazioni attive.</p>
            )}
            {threads.map(thread => {
              const isActive = thread.id === threadId;
              const threadChannel = thread.channel || thread.booking?.channel;
              const shortLabel = channelShortLabels[threadChannel] || 'Sessione';
              const hasTimer = Boolean(thread.expiresAt);
              const isExpired = thread.status === 'expired' || (hasTimer && thread.remainingSeconds === 0);
              const countdown =
                hasTimer && !isExpired && typeof thread.remainingSeconds === 'number'
                  ? formatDuration(thread.remainingSeconds)
                  : null;

              return (
                <button
                  key={thread.id}
                  type="button"
                  className={`chat-thread${isActive ? ' active' : ''}`}
                  onClick={() => navigate(`/chat/${thread.id}`)}
                >
                  <div className="chat-thread-header">
                    <div className="chat-thread-main">
                      <span className="chat-thread-name">{resolveName(thread)}</span>
                      {threadChannel && (
                        <span className={`chat-thread-channel ${threadChannel}`}>
                          <span className="icon-wrapper" aria-hidden="true">
                            <ChannelGlyph channel={threadChannel} />
                          </span>
                          {shortLabel}
                        </span>
                      )}
                    </div>
                    {thread.unreadCount > 0 && <span className="chat-thread-badge">{thread.unreadCount}</span>}
                  </div>
                  <p className="chat-thread-preview">{buildPreview(thread.lastMessage)}</p>
                  <div className="chat-thread-footer">
                    {thread.booking ? (
                      <span className="chat-thread-slot">
                        {dayjs(thread.booking.date).format('DD MMM')} · {thread.booking.start} - {thread.booking.end}
                      </span>
                    ) : (
                      <span className="chat-thread-slot">Sessione aperta</span>
                    )}
                    {hasTimer ? (
                      countdown ? (
                        <span className="chat-thread-timer">{countdown}</span>
                      ) : (
                        <span className="chat-thread-timer expired">Scaduta</span>
                      )
                    ) : (
                      <span className="chat-thread-timer idle">Senza limite</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="chat-pane">
          {!threadId && (
            <div className="chat-empty-card">
              <h2>Seleziona una conversazione</h2>
              <p>Scegli una chat dalla lista per iniziare a rispondere ai tuoi clienti.</p>
            </div>
          )}
          {threadId && threadQuery.isLoading && (
            <div className="chat-empty-card">
              <p>Recupero conversazione…</p>
            </div>
          )}
          {threadId && threadQuery.isError && (
            <div className="chat-empty-card">
              <p>Non è stato possibile caricare la chat selezionata.</p>
            </div>
          )}
          {threadId && activeThread && (
            <div className="chat-room">
              <header className="chat-room-header">
                <div className="chat-room-heading">
                  <h2>{resolveName(activeThread)}</h2>
                  <div className="chat-room-meta">
                    {sessionChannel && (
                      <div className={`chat-session-pill ${sessionChannel}`}>
                        <span className="icon-wrapper" aria-hidden="true">
                          <ChannelGlyph channel={sessionChannel} />
                        </span>
                        <div className="chat-session-copy">
                          <span className="channel-label">{channelLabel}</span>
                          {sessionRateLabel && <span className="channel-rate">{sessionRateLabel}</span>}
                        </div>
                      </div>
                    )}
                    {bookingWindowLabel && <span className="chat-session-slot">{bookingWindowLabel}</span>}
                    {allowedMinutes ? (
                      <span className="chat-session-slot">Pacchetto: {allowedMinutes} min</span>
                    ) : null}
                  </div>
                </div>
                <div className="chat-room-actions">
                  {canPost && sessionChannel === 'chat_voice' && (
                    <button
                      type="button"
                      className="call-start-btn"
                      onClick={startCall}
                      disabled={Boolean(activeCall)}
                      title="Avvia chiamata vocale"
                    >
                      <PhoneIcon />
                    </button>
                  )}
                  <div className="chat-room-timer">
                    <span>Tempo residuo</span>
                    <strong className={canPost ? '' : 'expired'}>{formatDuration(remainingSeconds)}</strong>
                  </div>
                </div>
              </header>
              <div className="chat-messages" role="log" aria-live="polite">
                {messages.map(message => {
                  const isMaster = message.senderRole === 'master';
                  const senderName = isMaster ? masterName : customerName;
                  const senderAvatar = isMaster ? masterAvatar : customerAvatar;
                  const senderInitial = isMaster ? masterInitial : customerInitial;
                  const isOwn = viewerMessageRole ? message.senderRole === viewerMessageRole : false;
                  return (
                    <div key={message.id} className={`chat-message ${isOwn ? 'outgoing' : 'incoming'}`}>
                      <div className="chat-message-avatar">
                        {senderAvatar ? (
                          <img src={senderAvatar} alt={senderName} />
                        ) : (
                          <span>{senderInitial}</span>
                        )}
                      </div>
                      <div className="chat-message-body">
                        <div className="chat-message-meta">
                          <span>{isOwn ? 'Tu' : senderName}</span>
                          <time dateTime={message.createdAt}>{dayjs(message.createdAt).format('HH:mm')}</time>
                        </div>
                        <p>{message.body}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </div>
              <form className="chat-composer" onSubmit={handleSubmit}>
                <textarea
                  className="chat-input"
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  placeholder={canPost ? 'Scrivi un messaggio…' : 'Tempo esaurito'}
                  disabled={!canPost || sendMutation.isPending}
                  rows={3}
                />
                <div className="chat-composer-actions">
                  {!canPost && (
                    <span className="chat-expired-hint">
                      Il tempo per questa sessione è terminato. Puoi rileggere i messaggi ma non inviarne di nuovi.
                    </span>
                  )}
                  <button
                    type="submit"
                    className="btn primary"
                    disabled={!canPost || sendMutation.isPending || !draft.trim()}
                  >
                    Invia
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
        <aside className="chat-sidebar-panel">
          <div className="chat-notes">
            <div className="chat-notes-header">
              <h3>Note personali</h3>
              <p>Visibili solo a te per questa conversazione.</p>
            </div>
            <div className="chat-notes-content">
              <textarea
                className="chat-notes-input"
                value={noteDraft}
                onChange={event => setNoteDraft(event.target.value)}
                placeholder="Annota informazioni importanti per ricordare le conversazioni con questo utente."
                disabled={noteMutation.isPending}
              />
            </div>
            <div className="chat-notes-footer">
              <div className="chat-notes-status">
                {noteMutation.isPending ? (
                  <span>Salvataggio…</span>
                ) : noteUpdatedAt ? (
                  <span>
                    Salvato {dayjs(noteUpdatedAt).format('DD MMM · HH:mm')}
                  </span>
                ) : (
                  <span>Non salvate</span>
                )}
              </div>
              <button
                type="button"
                className="btn secondary small"
                onClick={handleNoteSave}
                disabled={!isNoteDirty || noteMutation.isPending}
              >
                Salva
              </button>
            </div>
          </div>

        </aside>
      </div>
      
      {activeCall && (
        <CallPopup
          call={activeCall}
          threadId={threadId}
          isIncoming={activeCall.isIncoming}
          onAccept={acceptCall}
          onReject={rejectCall}
          onEnd={endCall}
          onSignal={setSignalHandler}
          partnerName={activeCall.isIncoming ? activeCall.callerName : resolveName(activeThread)}
        />
      )}
    </section>
  );
}
