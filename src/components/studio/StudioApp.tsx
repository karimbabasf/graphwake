"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ProjectShelf } from "@/components/shelf/ProjectShelf";
import { StudioShell } from "@/components/studio/StudioShell";
import type { ProjectRecord } from "@/lib/domain/types";
import { exportProject } from "@/lib/persistence/export";
import type {
  CreateProjectInput,
  ProjectRepository,
} from "@/lib/persistence/projects";
import { withAvailableProjectLock } from "@/lib/runtime/runLock";

export function StudioApp() {
  const repositoryRef = useRef<ProjectRepository | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(
    null,
  );

  const getRepository = useCallback(async () => {
    if (repositoryRef.current) return repositoryRef.current;
    const repositoryModule = await import("@/lib/persistence/projects");
    repositoryRef.current = repositoryModule.projectRepository;
    return repositoryModule.projectRepository;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const repository = await getRepository();
      setProjects(await repository.listProjects());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Local projects could not be read.");
    } finally {
      setLoading(false);
    }
  }, [getRepository]);

  useEffect(() => {
    let cancelled = false;
    void getRepository()
      .then(async (repository) => {
        await repository.recoverInterruptedProjects(async (projectId, recover) => {
          const result = await withAvailableProjectLock(projectId, recover);
          return result.acquired ? result.value : false;
        });
        if (navigator.storage?.persisted) {
          const persistent = await navigator.storage.persisted();
          if (!cancelled) setStoragePersistent(persistent);
        }
        if (!cancelled) await refresh();
      })
      .catch((failure) => {
        if (!cancelled) {
          setError(failure instanceof Error ? failure.message : "Graphwake could not open local storage.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getRepository, refresh]);

  async function create(input: CreateProjectInput) {
    const repository = await getRepository();
    const project = await repository.createProject(input);
    const persistenceModule = await import("@/lib/persistence/projects");
    setStoragePersistent(await persistenceModule.requestPersistentStorage());
    setProjects((current) => [project, ...current]);
    setActiveProjectId(project.id);
  }

  async function rename(projectId: string, name: string) {
    const repository = await getRepository();
    await repository.renameProject(projectId, name);
    await refresh();
  }

  async function download(projectId: string) {
    const repository = await getRepository();
    const content = await exportProject(repository, projectId);
    const project = projects.find((candidate) => candidate.id === projectId);
    const slug = (project?.name ?? "graphwake-project")
      .toLocaleLowerCase("en-US")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug || "graphwake-project"}.graphwake.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function remove(projectId: string) {
    const repository = await getRepository();
    await repository.deleteProject(projectId);
    setProjects((current) => current.filter((project) => project.id !== projectId));
  }

  if (activeProjectId) {
    return (
      <StudioShell
        projectId={activeProjectId}
        onExit={async () => {
          setActiveProjectId(null);
          await refresh();
        }}
        storagePersistent={storagePersistent}
      />
    );
  }

  return (
    <ProjectShelf
      projects={projects}
      loading={loading}
      error={error}
      onCreate={create}
      onOpen={setActiveProjectId}
      onRename={rename}
      onExport={download}
      onDelete={remove}
      onRetry={() => void refresh()}
      storagePersistent={storagePersistent}
    />
  );
}
