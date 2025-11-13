import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/it.js';
import { fetchThreads, fetchThread, sendMessage } from '../api/chat.js';
import useSocket from '../hooks/useSocket.js';
import useCountdown from '../hooks/useCountdown.js';

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

export default function Chat() {
  dayjs.locale('it');
  const { threadId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [draft, setDraft] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const messageEndRef = useRef(null);
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    const sync = () => {
      setToken(localStorage.getItem('token'));
    };
    window.addEventListener('storage', sync);
    window.addEventListener('rivelya-auth-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('rivelya-auth-change', sync);
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
    socket.on('chat:message', handleMessage);
    socket.on('chat:thread:updated', handleThreadUpdate);
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:thread:updated', handleThreadUpdate);
    };
  }, [socket, queryClient, threadId]);

  useEffect(() => {
    const threads = threadsQuery.data || [];
    if (!threadId && threads.length > 0) {
      navigate(`/chat/${threads[0].id}`, { replace: true });
    }
  }, [threadsQuery.data, threadId, navigate]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [threadQuery.data?.messages?.length]);

  const activeThread = threadQuery.data?.thread;
  const remainingSeconds = useCountdown(activeThread?.expiresAt);
  const canPost = threadQuery.data?.canPost && (remainingSeconds == null || remainingSeconds > 0);

  const handleSubmit = event => {
    event.preventDefault();
    if (!threadId || !draft.trim()) return;
    sendMutation.mutate({ id: threadId, body: draft.trim() });
  };

  const threads = threadsQuery.data || [];

  return (
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
          {threads.map(thread => (
            <button
              key={thread.id}
              type="button"
              className={`chat-thread${thread.id === threadId ? ' active' : ''}`}
              onClick={() => navigate(`/chat/${thread.id}`)}
            >
              <div className="chat-thread-line">
                <span className="chat-thread-name">{resolveName(thread)}</span>
                {thread.unreadCount > 0 && <span className="chat-thread-badge">{thread.unreadCount}</span>}
              </div>
              <p className="chat-thread-preview">{buildPreview(thread.lastMessage)}</p>
              {thread.booking && (
                <p className="chat-thread-meta">
                  {dayjs(thread.booking.date).format('DD MMM')} · {thread.booking.start} - {thread.booking.end}
                </p>
              )}
            </button>
          ))}
        </div>
      </aside>
      <section className="chat-pane">
        {!threadId && (
          <div className="chat-empty">
            <h2>Seleziona una conversazione</h2>
            <p>Scegli una chat dalla lista per iniziare a rispondere ai tuoi clienti.</p>
          </div>
        )}
        {threadId && threadQuery.isLoading && (
          <div className="chat-empty">
            <p>Recupero conversazione…</p>
          </div>
        )}
        {threadId && threadQuery.isError && (
          <div className="chat-empty">
            <p>Non è stato possibile caricare la chat selezionata.</p>
          </div>
        )}
        {threadId && activeThread && (
          <div className="chat-room">
            <header className="chat-room-header">
              <div>
                <h2>{resolveName(activeThread)}</h2>
                {activeThread.booking && (
                  <p>
                    {dayjs(activeThread.booking.date).format('DD MMMM YYYY')} · {activeThread.booking.start} - {activeThread.booking.end}
                  </p>
                )}
              </div>
              <div className="chat-room-timer">
                <span>Tempo residuo</span>
                <strong className={canPost ? '' : 'expired'}>{formatDuration(remainingSeconds)}</strong>
              </div>
            </header>
            <div className="chat-messages">
              {(threadQuery.data?.messages || []).map(message => (
                <div key={message.id} className={`chat-message${message.senderRole === 'client' ? ' client' : ' master'}`}>
                  <div className="chat-message-meta">
                    <span>{message.senderRole === 'master' ? 'Tu' : 'Cliente'}</span>
                    <time dateTime={message.createdAt}>{dayjs(message.createdAt).format('HH:mm')}</time>
                  </div>
                  <p>{message.body}</p>
                </div>
              ))}
              <div ref={messageEndRef} />
            </div>
            <form className="chat-composer" onSubmit={handleSubmit}>
              <textarea
                value={draft}
                onChange={event => setDraft(event.target.value)}
                placeholder={canPost ? 'Scrivi un messaggio…' : 'Tempo esaurito'}
                disabled={!canPost || sendMutation.isPending}
                rows={3}
              />
              <div className="chat-composer-actions">
                <button type="submit" className="btn primary" disabled={!canPost || sendMutation.isPending || !draft.trim()}>
                  Invia
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
