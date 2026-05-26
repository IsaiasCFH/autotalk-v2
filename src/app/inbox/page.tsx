"use client";
// app/inbox/page.tsx — Inbox completo

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { NoNumberModal } from "@/components/ui/NoNumberModal";
import { useAppStore } from "@/store/useAppStore";
import { DEPARTMENT_META } from "@/types";
import { cn, timeAgo, getInitials, formatPhone } from "@/lib/utils";
import { toast } from "sonner";
import type { Department } from "@prisma/client";

type Mensaje = {
  id: string;
  content: string;
  fromContact: boolean;
  status: string;
  createdAt: string;
  sentAt: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
};

type Conversacion = {
  id: string;
  isOpen: boolean;
  department: Department;
  updatedAt: string;
  contact: { id: string; name: string | null; phone: string };
  agent: { id: string; name: string } | null;
  number: { id: string; number: string; label: string | null; status: string };
  messages: Mensaje[];
  _count: { messages: number };
};

function MessageStatusIcon({ status }: { status: string }) {
  if (status === "PENDING") return <span className="text-white/20">○</span>;
  if (status === "SENT") return <span className="text-white/40">✓</span>;
  if (status === "DELIVERED") return <span className="text-white/60">✓✓</span>;
  if (status === "READ") return <span className="text-blue-400">✓✓</span>;
  if (status === "FAILED") return <span className="text-red-400">!</span>;
  return null;
}

export default function InboxPage() {
  const { data: session } = useSession();
  const { activeDepartment } = useAppStore();

  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [noNumberModal, setNoNumberModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedConv = conversaciones.find((c) => c.id === selectedId) ?? null;

  const isAdmin = session?.user?.role === "ADMIN";
  const fetchConversaciones = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const deptParam = isAdmin ? "" : (activeDepartment ? `&department=${activeDepartment}` : `&department=${session?.user?.departments?.[0] ?? ""}`);
      const res = await fetch(`/api/conversaciones?isOpen=true${deptParam}`);
      const data = await res.json();
      if (data.ok) setConversaciones(data.data);
    } catch {}
    finally { setLoadingConvs(false); }
  }, [activeDepartment]);

  useEffect(() => {
    fetchConversaciones();
    const interval = setInterval(fetchConversaciones, 5000);
    return () => clearInterval(interval);
  }, [fetchConversaciones]);

  const fetchMensajes = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/conversaciones/${convId}/mensajes`);
      const data = await res.json();
      if (data.ok) setMensajes(data.data);
    } catch {}
    finally { setLoadingMsgs(false); }
  }, []);

  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (selectedId) {
      fetchMensajes(selectedId);
      pollingRef.current = setInterval(() => fetchMensajes(selectedId), 3000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [selectedId, fetchMensajes]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const handleSend = async () => {
    if (!texto.trim() || !selectedId || sending) return;
    setSending(true);
    const textoAEnviar = texto.trim();
    setTexto("");

    try {
      const res = await fetch(`/api/conversaciones/${selectedId}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textoAEnviar }),
      });
      const data = await res.json();

      if (res.status === 422 && data.error === "NO_NUMBER_CONNECTED") {
        setNoNumberModal(true);
        setTexto(textoAEnviar);
        return;
      }

      if (!data.ok) {
        toast.error(data.error ?? "Error al enviar");
        setTexto(textoAEnviar);
        return;
      }

      fetchMensajes(selectedId);
    } catch {
      toast.error("Error al enviar mensaje");
      setTexto(textoAEnviar);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Panel izquierdo */}
        <div className="w-80 border-r border-white/5 flex flex-col bg-[#0d0d1a] flex-shrink-0">
          <div className="px-5 py-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base font-semibold text-white">
                  {activeDepartment ? DEPARTMENT_META[activeDepartment as Department].label : "Inbox"}
                </h1>
                <p className="text-xs text-white/30 mt-0.5">
                  {conversaciones.length} conversaciones abiertas
                </p>
              </div>
              {activeDepartment && (
                <span className="text-xl">{DEPARTMENT_META[activeDepartment as Department].icon}</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!activeDepartment ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-8">
                <p className="text-sm text-white/30">Selecciona un departamento en el sidebar</p>
              </div>
            ) : loadingConvs && conversaciones.length === 0 ? (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
              </div>
            ) : conversaciones.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-8">
                <p className="text-sm text-white/30">No hay conversaciones</p>
              </div>
            ) : (
              conversaciones.map((conv) => {
                const ultimoMsg = conv.messages[0];
                const isSelected = conv.id === selectedId;
                const nombre = conv.contact.name ?? formatPhone(conv.contact.phone);

                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={cn(
                      "w-full text-left px-4 py-3.5 border-b border-white/5 hover:bg-white/3 transition-colors",
                      isSelected && "bg-white/5 border-l-2 border-l-emerald-500"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-xs font-bold text-white/70 flex-shrink-0">
                        {getInitials(nombre)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className="text-sm font-medium text-white truncate">{nombre}</p>
                          <p className="text-[10px] text-white/30 flex-shrink-0">{timeAgo(conv.updatedAt)}</p>
                        </div>
                        <p className="text-xs text-white/40 truncate">
                          {ultimoMsg
                            ? `${ultimoMsg.fromContact ? "" : "Tú: "}${ultimoMsg.content}`
                            : "Sin mensajes"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Panel derecho — Chat */}
        <div className="flex-1 flex flex-col bg-[#0a0a0f] min-w-0">
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-8 h-8 text-white/20">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <p className="text-white/30 text-sm">Selecciona una conversación para comenzar</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-xs font-bold text-white/70">
                    {getInitials(selectedConv.contact.name ?? formatPhone(selectedConv.contact.phone))}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {selectedConv.contact.name ?? formatPhone(selectedConv.contact.phone)}
                    </p>
                    <p className="text-xs text-white/30">
                      {formatPhone(selectedConv.contact.phone)}
                      {" · "}
                      {selectedConv.number.label ?? selectedConv.number.number}
                      {" · "}
                      <span className={cn(
                        selectedConv.number.status === "CONNECTED" ? "text-emerald-400" : "text-red-400"
                      )}>
                        {selectedConv.number.status === "CONNECTED" ? "● Conectado" : "● Desconectado"}
                      </span>
                    </p>
                  </div>
                </div>
                {selectedConv.agent && (
                  <span className="text-xs text-white/30 bg-white/5 px-2.5 py-1 rounded-full">
                    {selectedConv.agent.name}
                  </span>
                )}
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {loadingMsgs && mensajes.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <div className="w-5 h-5 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                  </div>
                ) : mensajes.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <p className="text-sm text-white/20">Sin mensajes aún</p>
                  </div>
                ) : (
                  mensajes.map((msg) => (
                    <div key={msg.id} className={cn("flex", msg.fromContact ? "justify-start" : "justify-end")}>
                      <div className={cn(
                        "max-w-[70%] px-4 py-2.5 rounded-2xl text-sm",
                        msg.fromContact
                          ? "bg-white/8 text-white/90 rounded-tl-sm"
                          : "bg-emerald-500/20 text-white rounded-tr-sm border border-emerald-500/20"
                      )}>
                        {msg.mediaType === "image" && msg.mediaUrl ? (
                          <div>
                            <img src={msg.mediaUrl} alt="imagen" className="max-w-[200px] rounded-lg mb-1 cursor-pointer" onClick={() => window.open(msg.mediaUrl!, "_blank")} />
                            {msg.content && <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>}
                          </div>
                        ) : msg.mediaType === "document" && msg.mediaUrl ? (
                          <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm underline">
                            <span>📄</span> Ver documento
                          </a>
                        ) : msg.mediaType === "audio" && msg.mediaUrl ? (
                          <audio controls src={msg.mediaUrl} className="max-w-[200px]" />
                        ) : msg.mediaType === "video" && msg.mediaUrl ? (
                          <video controls src={msg.mediaUrl} className="max-w-[200px] rounded-lg" />
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{msg.content || <span className="italic opacity-50">Archivo adjunto</span>}</p>
                        )}
                        <div className={cn("flex items-center gap-1 mt-1", msg.fromContact ? "justify-start" : "justify-end")}>
                          <span className="text-[10px] text-white/25">
                            {new Date(msg.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {!msg.fromContact && (
                            <span className="text-[10px]"><MessageStatusIcon status={msg.status} /></span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-6 py-4 border-t border-white/5 flex-shrink-0">
                <div className="flex items-end gap-3">
                  <textarea
                    ref={inputRef}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe un mensaje... (Enter para enviar)"
                    rows={1}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-emerald-500/30 transition-all resize-none max-h-32 overflow-y-auto"
                    style={{ minHeight: "44px" }}
                    onInput={(e) => {
                      const t = e.target as HTMLTextAreaElement;
                      t.style.height = "auto";
                      t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!texto.trim() || sending}
                    className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/25 transition-colors border border-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {sending ? (
                      <span className="w-4 h-4 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <NoNumberModal
        isOpen={noNumberModal}
        onClose={() => setNoNumberModal(false)}
        department={selectedConv ? DEPARTMENT_META[selectedConv.department].label : undefined}
      />
    </AppLayout>
  );
}
