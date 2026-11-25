import "./AccountPages.css";
import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, MessageSquareText, Plus, RefreshCw } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import { useCompany } from "../context/CompanyContext";
import { api } from "../services/api";

const CATEGORIES = [
  ["ACCOUNT", "Account access"],
  ["BILLING", "Subscription / billing"],
  ["ACCOUNTING", "Accounting"],
  ["PAYROLL", "Payroll"],
  ["TECHNICAL", "Technical issue"],
  ["OTHER", "Other"],
];

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "";
}

export default function Support() {
  const { currentCompany } = useCompany();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ subject: "", category: "TECHNICAL", description: "" });
  const [attachment, setAttachment] = useState(null);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!currentCompany?.id) {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api.get(`/api/subscriptions/support/tickets/?company=${currentCompany.id}`);
      setTickets(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      setError(err.message || "Unable to load support requests.");
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  async function submitTicket(event) {
    event.preventDefault();
    if (!currentCompany?.id) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const payload = new FormData();
      payload.append("subject", form.subject);
      payload.append("category", form.category);
      payload.append("description", form.description);
      payload.append("company", currentCompany.id);
      if (attachment) payload.append("attachment", attachment);
      await api.post("/api/subscriptions/support/tickets/", payload);
      setForm({ subject: "", category: "TECHNICAL", description: "" });
      setAttachment(null);
      setSuccess("Your support request has been submitted. A confirmation will be sent by email.");
      await loadTickets();
    } catch (err) {
      setError(err.message || "Unable to submit your support request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadAttachment(endpoint, filename = "support-attachment") {
    try {
      const blob = await api.download(endpoint);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message || "Unable to download the attachment.");
    }
  }

  async function submitReply(ticketId) {
    if (!replyText.trim()) return;
    setReplying(true);
    setError("");
    try {
      await api.post(`/api/subscriptions/support/tickets/${ticketId}/replies/`, {
        message: replyText.trim(),
      });
      setReplyText("");
      await loadTickets();
    } catch (err) {
      setError(err.message || "Unable to send your reply.");
    } finally {
      setReplying(false);
    }
  }

  return (
    <div className="page-stack support-page">
      <PageHeader
        title="Email Support"
        description="Send a request to the Hindsfeet support team and follow its progress."
        action={<button className="secondary-action-link" type="button" onClick={loadTickets}><RefreshCw size={15} /> Refresh</button>}
      />

      <div className="support-layout">
        <section className="support-form-card">
          <div className="support-card-heading"><div className="support-heading-icon"><LifeBuoy size={19} /></div><div><h3>Submit a support request</h3><p>Tell us what you need help with.</p></div></div>
          <form onSubmit={submitTicket} className="support-form">
            <label>Subject<input required maxLength={180} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Briefly describe the issue" /></label>
            <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Description<textarea required rows={6} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Explain what happened and what you need help with..." /></label>
            <label>Attachment <span className="support-optional">(optional)</span><input type="file" onChange={(e) => setAttachment(e.target.files?.[0] || null)} /></label>
            {error && <div className="support-alert is-error">{error}</div>}
            {success && <div className="support-alert is-success">{success}</div>}
            <button className="primary-action-link" type="submit" disabled={submitting}>
              <Plus size={16} /> {submitting ? "Submitting..." : "Submit request"}
            </button>
          </form>
        </section>

        <section className="support-ticket-card">
          <div className="support-card-heading"><div className="support-heading-icon"><MessageSquareText size={19} /></div><div><h3>Your requests</h3><p>Support requests submitted by your organization.</p></div></div>
          {loading ? <div className="support-empty">Loading support requests...</div> : tickets.length ? (
            <div className="support-ticket-list">
              {tickets.map((ticket) => (
                <article className="support-ticket-row" key={ticket.id}>
                  <button type="button" className="support-ticket-toggle" onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}>
                    <div className="support-ticket-main"><strong>#{ticket.id} · {ticket.subject}</strong><span>{ticket.category.replaceAll("_", " ")} · {formatDate(ticket.created_at)}</span></div>
                    <span className={`support-ticket-status status-${ticket.status.toLowerCase()}`}>{ticket.status.replaceAll("_", " ")}</span>
                    <span className="support-ticket-priority">{ticket.priority}</span>
                  </button>
                  {ticket.has_attachment && <button type="button" className="support-attachment-link" onClick={() => downloadAttachment(`/api/subscriptions/support/tickets/${ticket.id}/attachment/`)}>Download attached file</button>}
                  {expandedTicket === ticket.id && (
                    <div className="support-conversation">
                      {(ticket.messages || []).map((message) => (
                        <div className={`support-message ${message.is_staff_reply ? "from-support" : "from-customer"}`} key={message.id}>
                          <strong>{message.sender_name || (message.is_staff_reply ? "Hindsfeet Support" : "You")}</strong>
                          <p>{message.message}</p>
                          {message.has_attachment && <button type="button" className="support-attachment-link" onClick={() => downloadAttachment(`/api/subscriptions/support/messages/${message.id}/attachment/`)}>Download attachment</button>}
                          <time>{formatDate(message.created_at)}</time>
                        </div>
                      ))}
                      <div className="support-reply-box">
                        <textarea rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply..." />
                        <button type="button" className="primary-action-link" disabled={replying || !replyText.trim()} onClick={() => submitReply(ticket.id)}>{replying ? "Sending..." : "Send reply"}</button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : <div className="support-empty">You haven't submitted any support requests yet.</div>}
        </section>
      </div>
    </div>
  );
}
