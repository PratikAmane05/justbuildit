import apiClient from "@/api/client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import {
  Briefcase,
  CheckSquare,
  Building,
  Loader2,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
} from "lucide-react";

const priorityColors: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-50 text-blue-600",
  HIGH: "bg-orange-50 text-orange-600",
  CRITICAL: "bg-red-50 text-red-600",
};
const statusColors: Record<string, { bg: string; icon: React.ReactNode }> = {
  TODO: {
    bg: "bg-gray-100 text-gray-600",
    icon: <Circle className="w-2.5 h-2.5" />,
  },
  IN_PROGRESS: {
    bg: "bg-blue-100 text-blue-700",
    icon: <Clock className="w-2.5 h-2.5" />,
  },
  IN_REVIEW: {
    bg: "bg-purple-100 text-purple-700",
    icon: <AlertTriangle className="w-2.5 h-2.5" />,
  },
  DONE: {
    bg: "bg-emerald-100 text-emerald-700",
    icon: <CheckCircle2 className="w-2.5 h-2.5" />,
  },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch user info first
        const meRes = await apiClient.get("/auth/me/");
        setUser(meRes.data);
        localStorage.setItem("nav_user", JSON.stringify(meRes.data));
      } catch (err) {
        console.error("Failed to load user:", err);
      }

      // Fetch remaining data independently so one failure doesn't block others
      try {
        const summaryRes = await apiClient.get("/analytics/summary");
        setSummary(summaryRes.data);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      }

      try {
        const projectsRes = await apiClient.get("/projects/");
        setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
      } catch (err) {
        console.error("Failed to load projects:", err);
      }

      try {
        const tasksRes = await apiClient.get("/tasks/");
        setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      } catch (err) {
        console.error("Failed to load tasks:", err);
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const completionRate =
    (summary?.total_tasks ?? 0) > 0
      ? Math.round(
          ((summary?.completed_tasks ?? 0) / summary.total_tasks) * 100,
        )
      : 0;
  const recentTasks = tasks.slice(0, 6);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Welcome banner */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Good {getGreeting()}, {user?.name?.split(" ")[0] || "Builder"} 👋
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Here's your workspace at a glance.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/organizations">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-200 gap-1.5 text-xs h-8"
              >
                <Building className="w-3.5 h-3.5" /> New Org
              </Button>
            </Link>
            <Link to="/projects">
              <Button
                size="sm"
                className="bg-gray-900 text-white gap-1.5 text-xs h-8 hover:bg-gray-800"
              >
                <Plus className="w-3.5 h-3.5" /> New Project
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Projects"
            value={summary?.total_projects ?? projects.length}
            sub="In your orgs"
            icon={<Briefcase className="w-5 h-5 text-blue-600" />}
            color="bg-blue-50"
            link="/projects"
          />
          <StatCard
            title="Total Tasks"
            value={summary?.total_tasks ?? 0}
            sub={`${summary?.in_progress_tasks ?? 0} in progress`}
            icon={<CheckSquare className="w-5 h-5 text-purple-600" />}
            color="bg-purple-50"
            link="/tasks"
          />
          <StatCard
            title="Completed"
            value={summary?.completed_tasks ?? 0}
            sub={`${completionRate}% completion rate`}
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            color="bg-emerald-50"
            link="/tasks"
          />
          <StatCard
            title="Organizations"
            value={summary?.total_organizations ?? 0}
            sub="Your memberships"
            icon={<Building className="w-5 h-5 text-orange-600" />}
            color="bg-orange-50"
            link="/organizations"
          />
        </div>

        {/* Recent Projects */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Recent Projects
            </h2>
            <Link to="/projects">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 text-xs gap-1 h-7"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {projects.length > 0 ? (
              projects.slice(0, 3).map((proj: any) => (
                <Card
                  key={proj.id}
                  className="sleek-card cursor-pointer hover:-translate-y-0.5 transition-all group"
                  onClick={() => navigate(`/projects/${proj.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-gray-900 transition-all flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                      </div>
                      <h3 className="font-semibold text-gray-900 truncate text-sm">
                        {proj.name}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 min-h-[32px]">
                      {proj.description || "No description"}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[11px] font-medium text-gray-400">
                          {proj.status || "Active"}
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-900 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-3 border border-dashed border-gray-200 rounded-xl p-10 flex flex-col items-center text-center">
                <Briefcase className="w-10 h-10 text-gray-200 mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  No projects yet
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Create an organization first, then start a project.
                </p>
                <div className="flex gap-2">
                  <Link to="/organizations">
                    <Button variant="outline" size="sm" className="text-xs">
                      Create Organization
                    </Button>
                  </Link>
                  <Link to="/projects">
                    <Button size="sm" className="text-xs gap-1">
                      <Plus className="w-3.5 h-3.5" /> New Project
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Recent Tasks */}
        {recentTasks.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                Recent Tasks
              </h2>
              <Link to="/tasks">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 text-xs gap-1 h-7"
                >
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
            <div className="space-y-1.5">
              {recentTasks.map((t: any) => {
                const sc = statusColors[t.status] || statusColors.TODO;
                const pc = priorityColors[t.priority] || priorityColors.MEDIUM;
                const proj = projects.find((p) => p.id === t.project_id);
                return (
                  <Card key={t.id} className="sleek-card hover:shadow-sm">
                    <CardContent className="p-3.5 flex items-center gap-3">
                      <CheckSquare className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <p className="text-sm font-medium text-gray-800 flex-1 truncate">
                        {t.title}
                      </p>
                      {proj && (
                        <span className="text-[10px] text-gray-400 hidden md:block truncate max-w-[100px]">
                          {proj.name}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${pc}`}
                        >
                          {t.priority}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5 ${sc.bg}`}
                        >
                          {sc.icon}
                          {t.status?.replace("_", " ")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function StatCard({
  title,
  value,
  sub,
  icon,
  color,
  link,
}: {
  title: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  color: string;
  link: string;
}) {
  return (
    <Link to={link}>
      <Card className="sleek-card hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {title}
            </p>
            <div
              className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}
            >
              {icon}
            </div>
          </div>
          <h3 className="text-3xl font-bold tracking-tight text-gray-900">
            {value}
          </h3>
          <p className="text-xs text-gray-400 mt-1">{sub}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
