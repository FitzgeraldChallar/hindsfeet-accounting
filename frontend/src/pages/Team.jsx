import "./AccountPages.css";
import { useCallback, useEffect, useState } from "react";
import { UserPlus, Users, RefreshCw, ShieldCheck, UserX } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import { useCompany } from "../context/CompanyContext";
import { api } from "../services/api";

const ROLES = [
  ["ADMIN", "Administrator"],
  ["ACCOUNTANT", "Accountant"],
  ["MANAGER", "Manager"],
  ["PAYROLL_OFFICER", "Payroll Officer"],
];

export default function Team() {
  const { currentCompany, currentMembership } = useCompany();
  const canManage = ["OWNER", "ADMIN"].includes(currentMembership?.role);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    username: "", email: "", first_name: "", last_name: "",
    password: "", role: "ACCOUNTANT",
  });

  const loadMembers = useCallback(async () => {
    if (!currentCompany?.id) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api.get(`/api/companies/${currentCompany.id}/members/`);
      setMembers(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      setError(err.message || "Unable to load team members.");
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  async function addMember(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const data = await api.post(`/api/companies/${currentCompany.id}/members/`, form);
      setNotice(data.user_created
        ? "Team member created and added. Share the temporary password securely and ask them to change it after signing in."
        : "Existing user added to your organization.");
      setForm({ username: "", email: "", first_name: "", last_name: "", password: "", role: "ACCOUNTANT" });
      await loadMembers();
    } catch (err) {
      setError(err.message || "Unable to add this team member.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateMember(member, changes) {
    setError("");
    setNotice("");
    try {
      await api.patch(`/api/companies/${currentCompany.id}/members/${member.id}/`, changes);
      setNotice("Team member updated.");
      await loadMembers();
    } catch (err) {
      setError(err.message || "Unable to update this team member.");
    }
  }

  return (
    <div className="page-stack team-page">
      <PageHeader
        title="Team Members"
        description="Manage the people who can access this organization. Every member shares the organization's subscription."
        action={<button className="secondary-action-link" type="button" onClick={loadMembers}><RefreshCw size={15} /> Refresh</button>}
      />

      <div className="team-summary">
        <div className="team-summary-icon"><Users size={20} /></div>
        <div><strong>{members.length} team members</strong><span>{currentCompany?.name} · One organization subscription</span></div>
        <span className="team-plan-pill">{currentMembership?.role || "Member"}</span>
      </div>

      {error && <div className="support-alert is-error">{error}</div>}
      {notice && <div className="support-alert is-success">{notice}</div>}

      <div className="team-layout">
        <section className="support-ticket-card">
          <div className="support-card-heading"><div className="support-heading-icon"><Users size={19} /></div><div><h3>Organization users</h3><p>Assign a role to control each member's responsibilities.</p></div></div>
          {loading ? <div className="support-empty">Loading team members...</div> : (
            <div className="team-member-list">
              {members.map((member) => (
                <div className="team-member-row" key={member.id}>
                  <div className="team-avatar">{(member.user_name || member.username || "U").slice(0,1).toUpperCase()}</div>
                  <div className="team-member-identity"><strong>{member.user_name || member.username}</strong><span>{member.email || member.username}</span></div>
                  <span className={`team-member-state ${member.is_active ? "active" : "inactive"}`}>{member.is_active ? "Active" : "Inactive"}</span>
                  {canManage && member.role !== "OWNER" && (
                    <select aria-label={`Role for ${member.user_name}`} value={member.role} onChange={(e) => updateMember(member, { role: e.target.value })}>
                      {ROLES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  )}
                  {canManage && member.role !== "OWNER" && (
                    <button type="button" className="team-deactivate-button" onClick={() => updateMember(member, { is_active: !member.is_active })} title={member.is_active ? "Deactivate member" : "Reactivate member"}>
                      <UserX size={16} />
                    </button>
                  )}
                </div>
              ))}
              {!members.length && <div className="support-empty">No team members found.</div>}
            </div>
          )}
        </section>

        <section className="support-form-card">
          <div className="support-card-heading"><div className="support-heading-icon"><UserPlus size={19} /></div><div><h3>Add a team member</h3><p>Create a login or add an existing Hindsfeet user.</p></div></div>
          {canManage ? (
            <form className="support-form" onSubmit={addMember}>
              <label>Username<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. jdoe" /></label>
              <label>Email address<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" /></label>
              <div className="team-name-fields">
                <label>First name<input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
                <label>Last name<input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
              </div>
              <label>Temporary password <span className="support-optional">(required only for a new user)</span><input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" /></label>
              <label>Organization role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <button className="primary-action-link" type="submit" disabled={submitting}><UserPlus size={16} /> {submitting ? "Adding..." : "Add member"}</button>
            </form>
          ) : (
            <div className="team-no-access"><ShieldCheck size={22} /><strong>Owner or administrator access required</strong><p>Ask your organization Owner or Administrator to manage team members.</p></div>
          )}
        </section>
      </div>
    </div>
  );
}
