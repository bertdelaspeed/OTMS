import { useMemo } from "react";
import { useStore } from "../store";
import { Avatar, Chip, EmptyState, panelCls } from "../ui";
import { IconBriefcase, IconCheck, IconMapPin, IconStar, IconTrophy } from "../icons";
import { useI18n } from "../i18n";
import { spanDays } from "../dates";

interface PersonStats {
  id: string;
  name: string;
  role: string;
  hue: number;
  completedTasks: number;
  missionCount: number;
  missionDays: number;
}

export function Rankings() {
  const { state } = useStore();
  const { t } = useI18n();

  const stats = useMemo(() => {
    const personStats = new Map<string, PersonStats>();

    // Initialize all people
    state.people.forEach((p) => {
      personStats.set(p.id, {
        id: p.id,
        name: p.name,
        role: p.role,
        hue: p.hue,
        completedTasks: 0,
        missionCount: 0,
        missionDays: 0,
      });
    });

    // Count completed tasks and missions per person
    state.tasks.forEach((task) => {
      if (task.status === "done") {
        const involved = [
          ...(task.assigneeIds || []),
          ...(task.teamId
            ? state.teams.find((t) => t.id === task.teamId)?.memberIds || []
            : []),
        ];

        involved.forEach((personId) => {
          const stats = personStats.get(personId);
          if (stats) {
            stats.completedTasks += 1;
            if (task.isMission) {
              stats.missionCount += 1;
              // Calculate mission duration in days
              const days = spanDays(task.startDate, task.dueDate);
              stats.missionDays += days;
            }
          }
        });
      }
    });

    return Array.from(personStats.values());
  }, [state]);

  const topPerformers = useMemo(() => {
    return [...stats]
      .filter((s) => s.completedTasks > 0)
      .sort((a, b) => b.completedTasks - a.completedTasks)
      .slice(0, 10);
  }, [stats]);

  const topMissionGoers = useMemo(() => {
    return [...stats]
      .filter((s) => s.missionDays > 0)
      .sort((a, b) => b.missionDays - a.missionDays)
      .slice(0, 10);
  }, [stats]);

  const totalCompleted = stats.reduce((sum, s) => sum + s.completedTasks, 0);
  const totalMissionDays = stats.reduce((sum, s) => sum + s.missionDays, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="reveal">
        <h1 className="font-display font-bold text-4xl tracking-tight leading-none">
          {t("rankings.title")}
        </h1>
        <p className="text-mut text-sm mt-2">{t("rankings.subtitle")}</p>
      </header>

      {/* Summary Stats */}
      <div className="reveal grid grid-cols-2 gap-4" style={{ animationDelay: "100ms" }}>
        <div className={`${panelCls} p-5`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-mint/10 flex items-center justify-center">
              <IconCheck className="w-5 h-5 text-mint" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{totalCompleted}</p>
              <p className="text-xs text-mut">{t("rankings.totalCompleted")}</p>
            </div>
          </div>
        </div>
        <div className={`${panelCls} p-5`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple/10 flex items-center justify-center">
              <IconMapPin className="w-5 h-5 text-purple" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{totalMissionDays}</p>
              <p className="text-xs text-mut">{t("rankings.totalMissionDays")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rankings Grid */}
      <div className="reveal grid lg:grid-cols-2 gap-6" style={{ animationDelay: "200ms" }}>
        {/* Top Performers */}
        <div className={panelCls}>
          <div className="p-5 border-b border-line">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber/10 flex items-center justify-center">
                <IconTrophy className="w-5 h-5 text-amber" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">{t("rankings.topPerformers")}</h2>
                <p className="text-xs text-mut">{t("rankings.topPerformersDesc")}</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            {topPerformers.length === 0 ? (
              <EmptyState
                icon={<IconStar className="w-5 h-5" />}
                title={t("rankings.noData")}
                body={t("rankings.noDataDesc")}
              />
            ) : (
              <div className="space-y-3">
                {topPerformers.map((person, index) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-panel2/50 hover:bg-panel2 transition-colors"
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0 w-8 text-center">
                      {index < 3 ? (
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0
                              ? "bg-amber/20 text-amber"
                              : index === 1
                              ? "bg-gray-300/20 text-gray-300"
                              : "bg-orange-400/20 text-orange-400"
                          }`}
                        >
                          {index + 1}
                        </div>
                      ) : (
                        <span className="text-sm text-mut font-medium">{index + 1}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <Avatar name={person.name} hue={person.hue} size={40} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{person.name}</p>
                      <p className="text-xs text-mut truncate">{person.role}</p>
                    </div>

                    {/* Stats */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-2xl font-bold text-mint">{person.completedTasks}</p>
                      <p className="text-xs text-mut">{t("rankings.tasks")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Mission Goers */}
        <div className={panelCls}>
          <div className="p-5 border-b border-line">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple/10 flex items-center justify-center">
                <IconMapPin className="w-5 h-5 text-purple" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">{t("rankings.topMissionGoers")}</h2>
                <p className="text-xs text-mut">{t("rankings.topMissionGoersDesc")}</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            {topMissionGoers.length === 0 ? (
              <EmptyState
                icon={<IconMapPin className="w-5 h-5" />}
                title={t("rankings.noMissionData")}
                body={t("rankings.noMissionDataDesc")}
              />
            ) : (
              <div className="space-y-3">
                {topMissionGoers.map((person, index) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-panel2/50 hover:bg-panel2 transition-colors"
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0 w-8 text-center">
                      {index < 3 ? (
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0
                              ? "bg-amber/20 text-amber"
                              : index === 1
                              ? "bg-gray-300/20 text-gray-300"
                              : "bg-orange-400/20 text-orange-400"
                          }`}
                        >
                          {index + 1}
                        </div>
                      ) : (
                        <span className="text-sm text-mut font-medium">{index + 1}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <Avatar name={person.name} hue={person.hue} size={40} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{person.name}</p>
                      <p className="text-xs text-mut truncate">{person.role}</p>
                    </div>

                    {/* Stats */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-2xl font-bold text-purple">{person.missionDays}</p>
                      <p className="text-xs text-mut">{t("rankings.days")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Stats Table */}
      <div className="reveal" style={{ animationDelay: "300ms" }}>
        <div className={panelCls}>
          <div className="p-5 border-b border-line">
            <h2 className="font-semibold text-lg">{t("rankings.detailedStats")}</h2>
            <p className="text-xs text-mut">{t("rankings.detailedStatsDesc")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left p-4 text-xs font-medium text-mut uppercase tracking-wider">
                    {t("rankings.rank")}
                  </th>
                  <th className="text-left p-4 text-xs font-medium text-mut uppercase tracking-wider">
                    {t("rankings.person")}
                  </th>
                  <th className="text-right p-4 text-xs font-medium text-mut uppercase tracking-wider">
                    <div className="flex items-center justify-end gap-2">
                      <IconCheck className="w-4 h-4 text-mint" />
                      {t("rankings.completedTasks")}
                    </div>
                  </th>
                  <th className="text-right p-4 text-xs font-medium text-mut uppercase tracking-wider">
                    <div className="flex items-center justify-end gap-2">
                      <IconMapPin className="w-4 h-4 text-purple" />
                      {t("rankings.missionDays")}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats
                  .filter((s) => s.completedTasks > 0 || s.missionDays > 0)
                  .sort((a, b) => {
                    const aTotal = a.completedTasks + a.missionDays;
                    const bTotal = b.completedTasks + b.missionDays;
                    return bTotal - aTotal;
                  })
                  .map((person, index) => (
                    <tr key={person.id} className="border-b border-line last:border-b-0 hover:bg-panel2/30">
                      <td className="p-4">
                        <span className="text-sm font-medium text-mut">#{index + 1}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={person.name} hue={person.hue} size={36} />
                          <div>
                            <p className="font-medium text-sm">{person.name}</p>
                            <p className="text-xs text-mut">{person.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-lg font-bold text-mint">{person.completedTasks}</span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-lg font-bold text-purple">{person.missionDays}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
