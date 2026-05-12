import { useEffect, useState } from "react";
import apiClient from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import {
  Briefcase,
  Plus,
  Loader2,
  FolderOpen,
  ArrowRight,
  Calendar,
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

const statusDot: Record<string, string> = {
  ACTIVE: "bg-emerald-500",
  COMPLETED: "bg-blue-500",
  ON_HOLD: "bg-yellow-500",
  ARCHIVED: "bg-gray-400",
};

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function fetchAll() {
    setLoading(true);
    try {
      const [pRes, oRes] = await Promise.all([
        apiClient.get("/projects/"),
        apiClient.get("/organizations/"),
      ]);
      setProjects(Array.isArray(pRes.data) ? pRes.data : []);
      setOrgs(Array.isArray(oRes.data) ? oRes.data : []);
      if (oRes.data.length > 0 && !selectedOrgId) {
        setSelectedOrgId(oRes.data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError("");
    try {
      await apiClient.post("/projects/", {
        name: newProjectName,
        description: newProjectDesc,
        organization_id: selectedOrgId || undefined,
      });
      setOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      fetchAll();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-end justify-between border-b border-gray-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Projects
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              All initiatives in your organizations.
            </p>
          </div>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              setError("");
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-gray-900 text-white hover:bg-gray-800 text-sm h-9 gap-2">
                <Plus className="w-4 h-4" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px] bg-white">
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4 mt-4">
                {orgs.length === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    ⚠️ You need to{" "}
                    <Link
                      to="/organizations"
                      className="font-semibold underline"
                    >
                      create an organization
                    </Link>{" "}
                    before creating a project.
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="proj-name">Project Name *</Label>
                  <Input
                    id="proj-name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    required
                    className="sleek-input"
                    placeholder="e.g. Website Redesign"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proj-desc">Description</Label>
                  <textarea
                    id="proj-desc"
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900 min-h-[70px] resize-none"
                    placeholder="Brief overview of the project"
                  />
                </div>
                {orgs.length > 1 && (
                  <div className="space-y-2">
                    <Label>Organization</Label>
                    <select
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                      className="w-full h-10 rounded-md border border-gray-200 px-3 text-sm bg-white focus:ring-2 focus:ring-gray-900 outline-none"
                    >
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={isCreating || orgs.length === 0}
                  className="bg-gray-900 text-white w-full"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  {isCreating ? "Creating..." : "Create Project"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {projects.length > 0 ? (
              projects.map((p: any) => (
                <Card
                  key={p.id}
                  className="sleek-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group"
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 group-hover:bg-gray-900 group-hover:border-gray-900 flex items-center justify-center transition-all">
                        <Briefcase className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${statusDot[p.status] || "bg-gray-400"}`}
                        />
                        {p.status || "ACTIVE"}
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate text-base">
                      {p.name}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-2 mt-1 min-h-[32px]">
                      {p.description || "No description provided."}
                    </p>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-900 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-3 py-20 text-center border border-dashed border-gray-200 rounded-xl">
                <FolderOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  No projects yet
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Create your first project to start tracking tasks.
                </p>
                {orgs.length === 0 && (
                  <Link to="/organizations">
                    <Button variant="outline" size="sm" className="mr-2">
                      Create Organization First
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
