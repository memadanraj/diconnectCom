import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, HeadphonesIcon, User, Send } from "lucide-react";
import { format } from "date-fns";

function apiFetch(url: string, init?: RequestInit) {
  const token = localStorage.getItem("commerce_token");
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

interface Message {
  id: string;
  ticketId: string;
  senderType: "staff" | "customer";
  senderId: string;
  body: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  customerId: string | null;
  orderId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  orderNumber: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function TicketDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`/api/tickets/${id}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTicket(json);
    } catch {
      toast({ title: "Failed to load ticket", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    setSending(true);
    try {
      const res = await apiFetch(`/api/tickets/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: replyBody.trim(), senderType: "staff" }),
      });
      if (!res.ok) throw new Error();
      setReplyBody("");
      load();
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await apiFetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Status updated" });
      setNewStatus("");
      load();
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded w-48" />
        <div className="h-48 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <HeadphonesIcon className="h-10 w-10 mb-4 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold mb-2">Ticket not found</h2>
        <Button variant="outline" onClick={() => setLocation("/tickets")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Tickets
        </Button>
      </div>
    );
  }

  const isTerminal = ticket.status === "closed";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/tickets")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Tickets
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{ticket.subject}</h1>
          <Badge className={`shrink-0 capitalize text-xs ${STATUS_COLORS[ticket.status] ?? ""}`}>
            {ticket.status.replace("_", " ")}
          </Badge>
          <Badge className={`shrink-0 capitalize text-xs ${PRIORITY_COLORS[ticket.priority] ?? ""}`}>
            {ticket.priority}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" /> Ticket Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {ticket.customerName && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Customer</p>
                  {ticket.customerId ? (
                    <Link href={`/customers/${ticket.customerId}`}>
                      <span className="font-medium text-primary hover:underline cursor-pointer">{ticket.customerName}</span>
                    </Link>
                  ) : (
                    <span className="font-medium">{ticket.customerName}</span>
                  )}
                  {ticket.customerEmail && <p className="text-xs text-muted-foreground">{ticket.customerEmail}</p>}
                </div>
              )}
              {ticket.orderNumber && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Order</p>
                  <Link href={`/orders/${ticket.orderId}`}>
                    <span className="font-mono text-primary hover:underline cursor-pointer text-sm">{ticket.orderNumber}</span>
                  </Link>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Created</p>
                <p>{format(new Date(ticket.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
              </div>
              {ticket.resolvedAt && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Resolved</p>
                  <p>{format(new Date(ticket.resolvedAt), "MMM d, yyyy 'at' h:mm a")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {!isTerminal && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Update Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Change status…" />
                  </SelectTrigger>
                  <SelectContent>
                    {["open", "in_progress", "resolved", "closed"]
                      .filter(s => s !== ticket.status)
                      .map(s => (
                        <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  disabled={!newStatus || updatingStatus}
                  onClick={handleUpdateStatus}
                >
                  {updatingStatus ? "Updating…" : "Update"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                Conversation ({ticket.messages.length} message{ticket.messages.length !== 1 ? "s" : ""})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ticket.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No messages yet. Add the first reply below.</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {ticket.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.senderType === "staff" ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${msg.senderType === "staff" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {msg.senderType === "staff" ? "S" : "C"}
                      </div>
                      <div className={`flex-1 max-w-[80%] ${msg.senderType === "staff" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                        <div className={`rounded-lg px-3 py-2 text-sm ${msg.senderType === "staff" ? "bg-primary text-primary-foreground ml-auto" : "bg-muted"}`}>
                          {msg.body}
                        </div>
                        <span className="text-xs text-muted-foreground px-1">
                          {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {!isTerminal && (
                <div className="mt-4 flex gap-2 pt-4 border-t">
                  <Textarea
                    placeholder="Type your reply…"
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    rows={2}
                    className="resize-none flex-1"
                    onKeyDown={e => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply();
                    }}
                  />
                  <Button
                    className="self-end"
                    disabled={!replyBody.trim() || sending}
                    onClick={handleReply}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {isTerminal && (
                <p className="text-center text-xs text-muted-foreground mt-4 pt-4 border-t">
                  This ticket is closed. Reopen it to add more messages.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
