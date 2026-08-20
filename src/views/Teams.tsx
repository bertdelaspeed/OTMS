import { useMemo, useState } from "react";
import type { Team } from "../types";
import { personStatus, useStore } from "../store";
import { STATUS_META, TEAM_COLORS } from "../meta";
import { dueLabel } from "../dates";
import { Avatar, Chip, DangerAction, EmptyState, btnIcon, btnPrimary, panelCls, useToast } from "../ui";
import { IconCalendar, IconFlag, IconPencil, IconPlus, IconUsers } from "../icons";
import { MembersModal, TeamModal } from "../modals";
import { useI18n } from "../i18n";

export function Teams() {
  const { state, dispatch } = useStore();
  const { t, tp } = useI18n();
  const { push } = useToast();
  const [modal, setModal] = useState<{ team: Team | null } | null>(null);
  const [membersFor, setMembersFor] = useState<Team | null>(null);

  const enriched = useMemo(
    () =>
      state.teams.map((tm) => {
        const members = tm.memberIds
          .map((id) => state.people.find((p) => p.id === id))
          .filter((p): p is NonNullable<typeof p> => !!p);
        const openTasks = state.tasks.filter((x) => x.teamId === tm.id && x.status !== "done");
        const next = [...openTasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
        return { tm, members, openTasks, next };
      }),
    [state]
  );

  const remove = (tm: Team) => {
    dispatch({ type: "REMOVE_TEAM", id: tm.id });
    push(t("teams.disbanded", { name: tm.name }), "warn");
  };

  return (
    <div className="space-y-4">
      <header className="reveal flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-none">{t("teams.title")}</h1>
          <p className="text-mut text-sm mt-2 max-w-xl">{t("teams.sub")}</p>
        </div>
        <button className={btnPrimary} onClick={() => setModal({ team: null })}>
          <IconPlus className="w-4 h-4" /> {t("teams.new")}
        </button>
      </header>

      {state.teams.length === 0 ? (
        <div className={panelCls}>
          <EmptyState
            icon={<IconFlag className="w-5 h-5" />}
            title={t("teams.emptyTitle")}
            body={t("teams.emptyBody")}
            action={
              <button className={btnPrimary} onClick={() => setModal({ team: null })}>
                <IconPlus className="w-4 h-4" /> {t("teams.emptyAction")}
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {enriched.map(({ tm, members, openTasks, next }, i) => {
            const c = TEAM_COLORS[tm.color];
            const due = next ? dueLabel(next.dueDate) : null;
            return (
              <div
                key={tm.id}
                className={`${panelCls} overflow-hidden reveal hover:border-line2 transition-colors`}
                style={{ animationDelay: `${Math.min(i * 70, 350)}ms` }}
              >
                <div className={`h-1.5 ${c.bar}`} />
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display font-semibold text-xl leading-tight">{tm.name}</h2>
                      <p className="text-xs text-mut mt-1 leading-relaxed">
                        {tm.purpose || t("teams.noPurpose")}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button className={btnIcon} title={t("teams.manage")} onClick={() => setMembersFor(tm)}>
                        <IconUsers className="w-4 h-4" />
                      </button>
                      <button className={`${btnIcon} hover:text-amber`} title={t("teams.edit")} onClick={() => setModal({ team: tm })}>
                        <IconPencil className="w-4 h-4" />
                      </button>
                      <DangerAction onConfirm={() => remove(tm)} label={t("teams.disbanded", { name: tm.name })} />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex -space-x-2">
                      {members.slice(0, 6).map((m) => {
                        const st = personStatus(state, m.id).key;
                        return (
                          <span
                            key={m.id}
                            className="relative rounded-full ring-2 ring-panel"
                            title={`${m.name} — ${t(STATUS_META[st].key)}`}
                          >
                            <Avatar name={m.name} hue={m.hue} size={30} />
                            <span
                              className={`absolute -bottom-px -right-px w-2.5 h-2.5 rounded-full border-2 border-panel ${STATUS_META[st].dot}`}
                            />
                          </span>
                        );
                      })}
                      {members.length === 0 && (
                        <span className="w-[30px] h-[30px] rounded-full border border-dashed border-line2 inline-flex items-center justify-center text-dim">
                          <IconUsers className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {members.length > 6 && (
                        <span className="w-[30px] h-[30px] rounded-full bg-panel2 border border-line2 inline-flex items-center justify-center text-[10px] font-mono text-mut ring-2 ring-panel">
                          +{members.length - 6}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{tp("teams.member", members.length)}</p>
                      <p className="text-[11px] text-mut truncate">
                        {members.length > 0
                          ? members.map((m) => m.name.split(" ")[0]).join(", ")
                          : t("teams.noMembers")}
                      </p>
                    </div>
                  </div>

                  {members.length > 0 && (
                    <p className="text-[10.5px] text-dim mt-2.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full border border-line2 bg-mint/70 inline-block" />
                      {t("teams.hint")}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 mt-4 pt-3.5 border-t border-line">
                    <Chip className={openTasks.length > 0 ? "text-amber bg-amber/10 border-amber/30" : "text-dim bg-panel2 border-line2"}>
                      <IconFlag className="w-3 h-3" />
                      {tp("teams.openTask", openTasks.length)}
                    </Chip>
                    {due && next ? (
                      <Chip
                        className={
                          due.tone === "late"
                            ? "text-coral bg-coral/10 border-coral/30"
                            : due.tone === "today"
                            ? "text-amber bg-amber/10 border-amber/30"
                            : "text-mut bg-panel2 border-line2"
                        }
                      >
                        <IconCalendar className="w-3 h-3" /> {t("teams.next", { label: due.text })}
                      </Chip>
                    ) : (
                      <span className="text-[11px] text-dim font-mono">{t("teams.noDeadlines")}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TeamModal open={modal !== null} team={modal?.team ?? null} onClose={() => setModal(null)} />
      <MembersModal open={membersFor !== null} team={membersFor} onClose={() => setMembersFor(null)} />
    </div>
  );
}
