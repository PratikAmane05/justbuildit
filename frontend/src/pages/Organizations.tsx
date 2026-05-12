import { useEffect, useState } from "react";
import apiClient from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import {
  Building,
  Plus,
  Loader2,
  Users,
  UserPlus,
  Crown,
  Shield,
  User,
  Mail,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Trash2,
  ShieldAlert,
  Edit2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const roleConfig: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  OWNER: {
    icon: <Crown className="w-3.5 h-3.5" />,
    color: "text-yellow-700 bg-yellow-50 border-yellow-200",
    label: "Owner",
  },
  LEADER: {
    icon: <Shield className="w-3.5 h-3.5" />,
    color: "text-blue-700 bg-blue-50 border-blue-200",
    label: "Leader",
  },
  MEMBER: {
    icon: <User className="w-3.5 h-3.5" />,
    color: "text-gray-600 bg-gray-100 border-gray-200",
    label: "Member",
  },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function AvatarCircle({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  const colors = [
    "from-purple-500 to-indigo-600",
    "from-blue-500 to-cyan-600",
    "from-emerald-500 to-teal-600",
    "from-orange-500 to-red-500",
    "from-pink-500 to-rose-600",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      className={`bg-gradient-to-br ${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${size === "md" ? "w-9 h-9 text-sm" : "w-7 h-7 text-xs"}`}
    >
      {getInitials(name)}
    </div>
  );
}

function OrgCard({ org, currentUserId }: { org: any; currentUserId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  // Invite form state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  // Load my role once
  useEffect(() => {
    apiClient
      .get(`/organizations/${org.id}/my-role`)
      .then((res) => {
        setMyRole(res.data.role);
        setCanManage(res.data.can_manage_members);
      })
      .catch(() => {});
  }, [org.id]);

  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const res = await apiClient.get(`/organizations/${org.id}/members/`);
      setMembers(res.data);
    } catch {
    } finally {
      setLoadingMembers(false);
    }
  };

  const toggleExpand = () => {
    if (!expanded) fetchMembers();
    setExpanded(!expanded);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setInviteError("");
    setInviteSuccess("");
    try {
      const res = await apiClient.post(`/organizations/${org.id}/members/`, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteSuccess(
        `✓ ${res.data.name} (${res.data.email}) added as ${inviteRole}`,
      );
      setInviteEmail("");
      if (expanded) fetchMembers();
    } catch (err: any) {
      setInviteError(err?.response?.data?.detail || "Failed to add member");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;
    try {
      await apiClient.delete(
        `/organizations/${org.id}/members/${targetUserId}/`,
      );
      fetchMembers();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to remove member");
    }
  };

  const handleUpdateRole = async (targetUserId: string, newRole: string) => {
    try {
      await apiClient.patch(
        `/organizations/${org.id}/members/${targetUserId}/`,
        { role: newRole },
      );
      fetchMembers();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to update role");
    }
  };

  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(org.name);
  const handleUpdateOrg = async () => {
    try {
      await apiClient.put(`/organizations/${org.id}`, { name: newName });
      setRenaming(false);
      // We'd need to refresh the parent list, but for now we just update locally
      org.name = newName;
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to update organization");
    }
  };

  // Roles the current user can assign
  const assignableRoles =
    myRole === "OWNER"
      ? ["OWNER", "LEADER", "MEMBER"]
      : myRole === "LEADER"
        ? ["MEMBER"]
        : [];

  const rc = roleConfig[myRole || "MEMBER"] || roleConfig.MEMBER;

  return (
    <Card className="sleek-card overflow-hidden">
      <CardContent className="p-0">
        {/* Org header */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {org.name[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                {renaming ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="h-7 text-sm py-0 sleek-input"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={handleUpdateOrg}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setRenaming(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-base leading-tight truncate">
                      {org.name}
                    </h3>
                    {canManage && (
                      <button
                        onClick={() => setRenaming(true)}
                        className="text-gray-400 hover:text-gray-900 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  /{org.slug}
                </p>

                {myRole && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded border mt-1 ${rc.color}`}
                  >
                    {rc.icon}
                    {rc.label}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {canManage && (
                <Dialog
                  open={inviteOpen}
                  onOpenChange={(o) => {
                    setInviteOpen(o);
                    setInviteError("");
                    setInviteSuccess("");
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-gray-200 gap-1.5 h-8"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Add Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[420px] bg-white">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-gray-700" /> Invite to{" "}
                        {org.name}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleInvite} className="space-y-4 mt-3">
                      <div className="space-y-2">
                        <Label>Email Address *</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            required
                            className="sleek-input !pl-9"
                            placeholder="colleague@company.com"
                          />
                        </div>
                        <p className="text-[11px] text-gray-400">
                          The user must already have a JustBuildIt account.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Assign Role</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["MEMBER", "LEADER", "OWNER"] as const)
                            .filter((r) => assignableRoles.includes(r))
                            .map((r) => {
                              const rc2 = roleConfig[r];
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => setInviteRole(r)}
                                  className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-semibold transition-all ${inviteRole === r ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}
                                >
                                  {rc2.icon}
                                  {rc2.label}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                      {inviteError && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                          {inviteError}
                        </p>
                      )}
                      {inviteSuccess && (
                        <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          {inviteSuccess}
                        </p>
                      )}
                      <Button
                        type="submit"
                        disabled={isInviting}
                        className="w-full bg-gray-900 text-white gap-2"
                      >
                        {isInviting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        {isInviting ? "Adding..." : "Send Invitation"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
              <button
                onClick={toggleExpand}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors"
              >
                {expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {members.length > 0
                ? `${members.length} member${members.length !== 1 ? "s" : ""}`
                : "View members"}
            </span>
            <span className="text-gray-200">•</span>
            <span>
              Since{" "}
              {new Date(org.created_at).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Members panel */}
        {expanded && (
          <div className="border-t border-gray-100 bg-gray-50/60">
            <div className="px-5 py-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                Team Members
              </p>
              {loadingMembers ? (
                <div className="flex justify-center py-5">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              ) : members.length > 0 ? (
                <div className="space-y-2">
                  {members.map((m: any) => {
                    const mr = roleConfig[m.role] || roleConfig.MEMBER;
                    const isMe = m.user_id === currentUserId;
                    return (
                      <div
                        key={m.user_id}
                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarCircle name={m.name || m.email} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 leading-tight flex items-center gap-1.5">
                              {m.name}
                              {isMe && (
                                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {m.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${mr.color}`}
                          >
                            {mr.icon}
                            {mr.label}
                          </span>

                          {canManage && !isMe && m.role !== "OWNER" && (
                            <div className="flex items-center gap-1 ml-2">
                              {m.role === "MEMBER" && (
                                <button
                                  onClick={() =>
                                    handleUpdateRole(m.user_id, "LEADER")
                                  }
                                  title="Promote to Leader"
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveMember(m.user_id)}
                                title="Remove Member"
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <span className="text-xs text-gray-300 hidden sm:block ml-2">
                            {new Date(m.joined_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  No members found
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Organizations() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function fetchOrgs() {
    setLoading(true);
    try {
      const [orgRes, meRes] = await Promise.all([
        apiClient.get("/organizations/"),
        apiClient.get("/auth/me/"),
      ]);
      setOrgs(Array.isArray(orgRes.data) ? orgRes.data : []);
      setCurrentUserId(meRes.data.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError("");
    try {
      await apiClient.post("/organizations/", { name: newOrgName });
      setOpen(false);
      setNewOrgName("");
      fetchOrgs();
    } catch (err: any) {
      setCreateError(
        err?.response?.data?.detail || "Failed to create organization",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-end justify-between border-b border-gray-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Organizations
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Your team workspaces. Click any org to see its members.
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              setCreateError("");
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-gray-900 text-white hover:bg-gray-800 text-sm h-9 gap-2">
                <Plus className="w-4 h-4" /> New Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[380px] bg-white">
              <DialogHeader>
                <DialogTitle>Create Organization</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateOrg} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name *</Label>
                  <Input
                    id="org-name"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    required
                    className="sleek-input"
                    placeholder="e.g. Acme Corp"
                    autoFocus
                  />
                </div>
                {createError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {createError}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="bg-gray-900 text-white w-full"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  {isCreating ? "Creating..." : "Create Organization"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : orgs.length > 0 ? (
          <div className="space-y-4">
            {orgs.map((org: any) => (
              <OrgCard key={org.id} org={org} currentUserId={currentUserId} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center border border-dashed border-gray-200 rounded-xl">
            <Building className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              No organizations yet
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Create one to start collaborating with your team.
            </p>
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Create Organization
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
