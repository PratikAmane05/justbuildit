import { useEffect, useState } from "react";
import apiClient from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import {
  CheckSquare,
  Plus,
  Loader2,
  Clock,
  AlertCircle,
  Circle,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Sparkles,
  Filter,
  Briefcase,
  Bot,
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
import AIPredictionBadges from "@/components/AIPredictionBadges";
import AITaskChat from "@/components/AITaskChat";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

const priorityConfig: Record<string, { color: string; icon: React.ReactNode }> =
  {
    LOW: {
      color: "bg-slate-100 text-slate-600 border-slate-200",
      icon: <Circle className="w-3 h-3" />,
    },
    MEDIUM: {
      color: "bg-blue-50 text-blue-600 border-blue-200",
      icon: <AlertCircle className="w-3 h-3" />,
    },
    HIGH: {
      color: "bg-orange-50 text-orange-600 border-orange-200",
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    CRITICAL: {
      color: "bg-red-50 text-red-600 border-red-200",
      icon: <Zap className="w-3 h-3" />,
    },
  };
const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  TODO: {
    color: "bg-gray-100 text-gray-600 border-gray-200",
    icon: <Circle className="w-3 h-3" />,
  },
  IN_PROGRESS: {
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: <Clock className="w-3 h-3" />,
  },
  IN_REVIEW: {
    color: "bg-purple-100 text-purple-700 border-purple-200",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  DONE: {
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
};

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterProject, setFilterProject] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Create task
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState("MEDIUM");
  const [taskStatus, setTaskStatus] = useState("TODO");
  const [taskProject, setTaskProject] = useState("");
  const [taskEstimate, setTaskEstimate] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [createError, setCreateError] = useState("");
  const [orgMembers, setOrgMembers] = useState<any[]>([]);

  // AI Generate
  const [aiOpen, setAiOpen] = useState(false);
  const [aiProject, setAiProject] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState<any[]>([]);
  const [selectedAi, setSelectedAi] = useState<Set<number>>(new Set());
  const [aiStep, setAiStep] = useState<"setup" | "review">("setup");
  const [isSavingAi, setIsSavingAi] = useState(false);

  // Phase 5C - Layer A Inputs
  const [aiProjectType, setAiProjectType] = useState("");
  const [aiTeamSkills, setAiTeamSkills] = useState("");
  const [aiModules, setAiModules] = useState("");
  const [aiSprintDays, setAiSprintDays] = useState("");
  const [aiAssigneeHint, setAiAssigneeHint] = useState("");

  const updateAiPreview = (idx: number, field: string, value: any) => {
    setAiPreview((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  // AI Task Chat
  const [chatTask, setChatTask] = useState<any>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const [tRes, pRes] = await Promise.all([
        apiClient.get("/tasks/"),
        apiClient.get("/projects/"),
      ]);
      setTasks(Array.isArray(tRes.data) ? tRes.data : []);
      setProjects(Array.isArray(pRes.data) ? pRes.data : []);
      if (pRes.data.length > 0) {
        setTaskProject(pRes.data[0].id);
        setAiProject(pRes.data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const proj = projects.find((p) => p.id === taskProject);
    if (proj?.organization_id) {
      apiClient
        .get(`/organizations/${proj.organization_id}/members`)
        .then((res) => setOrgMembers(res.data))
        .catch(() => setOrgMembers([]));
    } else {
      setOrgMembers([]);
    }
  }, [taskProject, projects]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskProject) return;
    setIsCreating(true);
    setCreateError("");
    try {
      await apiClient.post("/tasks/", {
        title: taskTitle,
        description: taskDesc,
        priority: taskPriority,
        status: taskStatus,
        estimated_time: taskEstimate ? parseFloat(taskEstimate) : null,
        project_id: taskProject,
        assigned_to: taskAssignee || null,
      });
      setCreateOpen(false);
      setTaskTitle("");
      setTaskDesc("");
      setTaskPriority("MEDIUM");
      setTaskStatus("TODO");
      setTaskEstimate("");
      setTaskAssignee("");
      fetchData();
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail || "Failed to create task");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAiGenerate = async () => {
    const proj = projects.find((p) => p.id === aiProject);
    if (!proj) return;
    setIsGenerating(true);
    try {
      const res = await apiClient.post("/tasks/ai-generate", {
        project_name: proj.name,
        project_description: proj.description,
        count: aiCount,
        project_type: aiProjectType || undefined,
        team_skills: aiTeamSkills
          ? aiTeamSkills.split(",").map((s) => s.trim())
          : [],
        current_modules: aiModules
          ? aiModules.split(",").map((s) => s.trim())
          : [],
        sprint_remaining_days: aiSprintDays
          ? parseInt(aiSprintDays)
          : undefined,
        preferred_assignee_skills: aiAssigneeHint
          ? aiAssigneeHint.split(",").map((s) => s.trim())
          : [],
      });
      setAiPreview(res.data.tasks);
      setSelectedAi(new Set(res.data.tasks.map((_: any, i: number) => i)));
      setAiStep("review");
    } catch (err: any) {
      alert(err?.response?.data?.detail || "AI generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAiTasks = async () => {
    setIsSavingAi(true);
    const toSave = aiPreview.filter((_, i) => selectedAi.has(i));
    try {
      await Promise.all(
        toSave.map((t: any) =>
          apiClient.post("/tasks/", {
            title: t.title,
            description: t.description,
            priority: t.priority,
            status: "TODO",
            estimated_time: t.estimated_time,
            project_id: aiProject,
          }),
        ),
      );
      setAiOpen(false);
      setAiStep("setup");
      setAiPreview([]);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to save tasks");
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      const res = await apiClient.patch(`/tasks/${taskId}/status`, {
        status: newStatus,
      });
      setTasks(tasks.map((t) => (t.id === taskId ? res.data : t)));
    } catch {}
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterProject && t.project_id !== filterProject) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    return true;
  });

  const toggleAiTask = (i: number) => {
    setSelectedAi((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-end justify-between border-b border-gray-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Tasks
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              All tasks across your team's projects.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* AI Generate Dialog */}
            <Dialog
              open={aiOpen}
              onOpenChange={(o) => {
                setAiOpen(o);
                if (!o) {
                  setAiStep("setup");
                  setAiPreview([]);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-purple-200 text-purple-700 hover:bg-purple-50 text-sm h-9 gap-2"
                >
                  <Sparkles className="w-4 h-4" /> AI Generate
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[540px] bg-white">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" /> AI Task
                    Generator
                  </DialogTitle>
                </DialogHeader>
                {aiStep === "setup" ? (
                  <div className="space-y-5 mt-4">
                    {projects.length === 0 ? (
                      <div className="text-center py-6 text-sm text-gray-500">
                        <Briefcase className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        <Link
                          to="/projects"
                          className="text-gray-900 font-semibold underline"
                        >
                          Create a project
                        </Link>{" "}
                        first.
                      </div>
                    ) : (
                      <>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Select Project</Label>
                            <select
                              value={aiProject}
                              onChange={(e) => setAiProject(e.target.value)}
                              className="w-full h-10 rounded-md border border-gray-200 px-3 text-sm bg-white focus:ring-2 focus:ring-gray-900 outline-none"
                            >
                              {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <Label>Number of tasks</Label>
                            <div className="flex items-center gap-2">
                              {[3, 5, 7, 10].map((n) => (
                                <button
                                  key={n}
                                  onClick={() => setAiCount(n)}
                                  className={`w-12 h-10 rounded-lg border text-sm font-semibold transition-all ${aiCount === n ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 hover:border-gray-400"}`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs">Project Type</Label>
                              <input
                                value={aiProjectType}
                                onChange={(e) =>
                                  setAiProjectType(e.target.value)
                                }
                                placeholder="e.g. SaaS, E-commerce"
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">
                                Sprint Days Remaining
                              </Label>
                              <input
                                type="number"
                                value={aiSprintDays}
                                onChange={(e) =>
                                  setAiSprintDays(e.target.value)
                                }
                                placeholder="e.g. 5"
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">
                              Team Skills (comma separated)
                            </Label>
                            <input
                              value={aiTeamSkills}
                              onChange={(e) => setAiTeamSkills(e.target.value)}
                              placeholder="Go, React, AWS"
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Target Modules</Label>
                            <input
                              value={aiModules}
                              onChange={(e) => setAiModules(e.target.value)}
                              placeholder="Auth, API"
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">
                              Preferred Assignee Skills
                            </Label>
                            <input
                              value={aiAssigneeHint}
                              onChange={(e) =>
                                setAiAssigneeHint(e.target.value)
                              }
                              placeholder="Frontend, UX"
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                            />
                          </div>
                        </div>

                        <Button
                          onClick={handleAiGenerate}
                          disabled={isGenerating || !aiProject}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2 mt-4"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />{" "}
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" /> Generate{" "}
                              {aiCount} Tasks
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">
                        {selectedAi.size} of {aiPreview.length} selected
                      </p>
                      <button
                        onClick={() => setAiStep("setup")}
                        className="text-xs text-gray-400 hover:text-gray-900 underline"
                      >
                        ← Back
                      </button>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {aiPreview.map((t: any, i: number) => {
                        const sel = selectedAi.has(i);
                        return (
                          <div
                            key={i}
                            className={`p-3 rounded-lg border transition-all ${sel ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white opacity-50"}`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="mt-1 cursor-pointer flex-shrink-0"
                                onClick={() => toggleAiTask(i)}
                              >
                                <div
                                  className={`w-4 h-4 rounded border-2 flex items-center justify-center ${sel ? "bg-gray-900 border-gray-900" : "border-gray-300"}`}
                                >
                                  {sel && (
                                    <CheckCircle2 className="w-3 h-3 text-white" />
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0 space-y-2">
                                <input
                                  value={t.title}
                                  onChange={(e) =>
                                    updateAiPreview(i, "title", e.target.value)
                                  }
                                  className="w-full text-sm font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-900 focus:outline-none truncate"
                                />
                                <div className="flex gap-2">
                                  <textarea
                                    value={t.description || ""}
                                    onChange={(e) =>
                                      updateAiPreview(
                                        i,
                                        "description",
                                        e.target.value,
                                      )
                                    }
                                    rows={2}
                                    className="w-full text-xs text-gray-600 bg-white border border-gray-200 rounded p-1.5 focus:outline-none focus:border-gray-400 custom-scrollbar resize-none"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={t.priority}
                                    onChange={(e) =>
                                      updateAiPreview(
                                        i,
                                        "priority",
                                        e.target.value,
                                      )
                                    }
                                    className="text-[10px] uppercase font-bold px-1 py-0.5 rounded border bg-white focus:outline-none"
                                  >
                                    {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(
                                      (p) => (
                                        <option key={p} value={p}>
                                          {p}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                  <div className="flex items-center gap-1">
                                    <Label className="text-[10px] text-gray-500">
                                      Est. hours:
                                    </Label>
                                    <input
                                      type="number"
                                      value={t.estimated_time || ""}
                                      onChange={(e) =>
                                        updateAiPreview(
                                          i,
                                          "estimated_time",
                                          parseFloat(e.target.value),
                                        )
                                      }
                                      className="w-12 text-[10px] px-1 py-0.5 border rounded focus:outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      onClick={handleSaveAiTasks}
                      disabled={isSavingAi || selectedAi.size === 0}
                      className="w-full bg-gray-900 text-white"
                    >
                      {isSavingAi ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      {isSavingAi
                        ? "Saving..."
                        : `Add ${selectedAi.size} Tasks`}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Create Task Dialog */}
            <Dialog
              open={createOpen}
              onOpenChange={(o) => {
                setCreateOpen(o);
                setCreateError("");
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-gray-900 text-white hover:bg-gray-800 text-sm h-9 gap-2">
                  <Plus className="w-4 h-4" /> Create Task
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] bg-white">
                <DialogHeader>
                  <DialogTitle>Create Task</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
                  {projects.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                      ⚠️{" "}
                      <Link to="/projects" className="font-semibold underline">
                        Create a project
                      </Link>{" "}
                      before adding tasks.
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Task Title *</Label>
                    <Input
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      required
                      placeholder="e.g. Set up CI/CD pipeline"
                      className="sleek-input"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <textarea
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900 min-h-[70px] resize-none"
                      placeholder="What needs to be done..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <select
                      value={taskProject}
                      onChange={(e) => setTaskProject(e.target.value)}
                      className="w-full h-10 rounded-md border border-gray-200 px-3 text-sm bg-white focus:ring-2 focus:ring-gray-900 outline-none"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      {projects.length === 0 && (
                        <option value="">No projects available</option>
                      )}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <select
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value)}
                        className="w-full h-10 rounded-md border border-gray-200 px-3 text-sm bg-white focus:ring-2 focus:ring-gray-900 outline-none"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <select
                        value={taskStatus}
                        onChange={(e) => setTaskStatus(e.target.value)}
                        className="w-full h-10 rounded-md border border-gray-200 px-3 text-sm bg-white focus:ring-2 focus:ring-gray-900 outline-none"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Hours</Label>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={taskEstimate}
                      onChange={(e) => setTaskEstimate(e.target.value)}
                      placeholder="e.g. 3"
                      className="sleek-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assignee</Label>
                    <select
                      value={taskAssignee}
                      onChange={(e) => setTaskAssignee(e.target.value)}
                      className="w-full h-10 rounded-md border border-gray-200 px-3 text-sm bg-white focus:ring-2 focus:ring-gray-900 outline-none"
                    >
                      <option value="">Unassigned</option>
                      {orgMembers.map((m: any) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.name || m.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  {createError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {createError}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={isCreating || !taskProject}
                    className="bg-gray-900 text-white w-full"
                  >
                    {isCreating ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {isCreating ? "Creating..." : "Create Task"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 px-3 text-xs bg-white text-gray-700 focus:ring-2 focus:ring-gray-900 outline-none"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 px-3 text-xs bg-white text-gray-700 focus:ring-2 focus:ring-gray-900 outline-none"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 px-3 text-xs bg-white text-gray-700 focus:ring-2 focus:ring-gray-900 outline-none"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          {(filterProject || filterPriority || filterStatus) && (
            <button
              onClick={() => {
                setFilterProject("");
                setFilterPriority("");
                setFilterStatus("");
              }}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((t: any) => {
                const pc = priorityConfig[t.priority] || priorityConfig.MEDIUM;
                const sc = statusConfig[t.status] || statusConfig.TODO;
                const proj = projects.find((p) => p.id === t.project_id);
                return (
                  <Card
                    key={t.id}
                    className="sleek-card hover:shadow-md transition-all"
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <CheckSquare className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate text-sm">
                          {t.title}
                        </h3>
                        {t.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {t.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${pc.color}`}
                          >
                            {pc.icon}
                            {t.priority}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${sc.color}`}
                          >
                            {sc.icon}
                            {t.status.replace("_", " ")}
                          </span>
                          {proj && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-400 flex items-center gap-0.5">
                              <Briefcase className="w-2.5 h-2.5" />
                              {proj.name}
                            </span>
                          )}
                          {t.estimated_time && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {t.estimated_time}h
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-center gap-2">
                          <AIPredictionBadges task={t} />
                          <button
                            onClick={() => setChatTask(t)}
                            className="ml-auto inline-flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-md border border-violet-200 bg-violet-50 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 transition-colors shrink-0"
                          >
                            <Bot className="w-3.5 h-3.5" />
                            Chat
                          </button>
                        </div>
                      </div>
                      <select
                        value={t.status}
                        onChange={(e) =>
                          handleUpdateStatus(t.id, e.target.value)
                        }
                        className="h-8 rounded-lg border border-gray-200 px-2 text-xs bg-white text-gray-700 focus:ring-2 focus:ring-gray-900 outline-none cursor-pointer flex-shrink-0"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="py-20 text-center border border-dashed border-gray-200 rounded-xl">
                <CheckSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {tasks.length === 0
                    ? "No tasks yet"
                    : "No tasks match your filters"}
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  {tasks.length === 0
                    ? "Create tasks manually or use AI to generate them."
                    : "Try clearing your filters."}
                </p>
                {tasks.length === 0 && (
                  <div className="flex items-center gap-3 justify-center">
                    <Button
                      size="sm"
                      onClick={() => setCreateOpen(true)}
                      className="gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Add Task
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAiOpen(true)}
                      className="gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
                    >
                      <Sparkles className="w-4 h-4" /> AI Generate
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {chatTask && (
        <AITaskChat
          task={chatTask}
          open={!!chatTask}
          onClose={() => setChatTask(null)}
        />
      )}
    </div>
  );
}
