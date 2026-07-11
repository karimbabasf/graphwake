"use client";

import {
  ArrowUpRight,
  Download,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { CreateProject } from "@/components/shelf/CreateProject";
import { ActionButton } from "@/components/ui/ActionButton";
import { Dialog } from "@/components/ui/Dialog";
import type { ProjectRecord } from "@/lib/domain/types";
import type { CreateProjectInput } from "@/lib/persistence/projects";

interface ProjectShelfProps {
  projects: ProjectRecord[];
  loading: boolean;
  error: string | null;
  onCreate: (input: CreateProjectInput) => Promise<void>;
  onOpen: (projectId: string) => void;
  onRename: (projectId: string, name: string) => Promise<void>;
  onExport: (projectId: string) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
  onRetry?: () => void;
  storagePersistent?: boolean | null;
}

function relativeDate(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function ProjectShelf({
  projects,
  loading,
  error,
  onCreate,
  onOpen,
  onRename,
  onExport,
  onDelete,
  onRetry,
  storagePersistent = null,
}: ProjectShelfProps) {
  const [renameProject, setRenameProject] = useState<ProjectRecord | null>(null);
  const [deleteProject, setDeleteProject] = useState<ProjectRecord | null>(null);
  const [deleteName, setDeleteName] = useState("");

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameProject) return;
    const form = new FormData(event.currentTarget);
    await onRename(renameProject.id, String(form.get("name") ?? ""));
    setRenameProject(null);
  }

  async function remove() {
    if (!deleteProject || deleteName !== deleteProject.name) return;
    await onDelete(deleteProject.id);
    setDeleteProject(null);
    setDeleteName("");
  }

  return (
    <main className="shelf-page">
      <header className="shelf-masthead">
        <a className="wordmark" href="#top" aria-label="Graphwake home">
          <span className="wordmark-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          GRAPHWAKE
        </a>
        <span className="local-badge">LOCAL FIRST / V1</span>
      </header>

      <section className="shelf-hero" id="top">
        <div>
          <span className="eyebrow">CONTEXT BECOMES INSPECTABLE</span>
          <h1>See knowledge<br />change state.</h1>
        </div>
        <div className="hero-copy">
          <p>
            Build living evidence graphs from one prompt. Replay every accepted
            change, inspect every relation, and keep similarity separate from proof.
          </p>
          <CreateProject onCreate={onCreate} empty={projects.length === 0} />
        </div>
        <div className="hero-notation" aria-hidden="true">
          <span>S<sub>0</sub></span>
          <b>+</b>
          <span>e<sub>17</sub></span>
          <b>→</b>
          <span>S<sub>1</sub></span>
        </div>
      </section>

      <section className="project-index" aria-labelledby="projects-heading">
        <header>
          <div>
            <span className="eyebrow">YOUR LOCAL INDEX</span>
            <h2 id="projects-heading">Projects</h2>
          </div>
          <span className="project-total">{projects.length.toString().padStart(2, "0")}</span>
        </header>

        {loading ? (
          <div className="shelf-skeleton" aria-label="Loading projects">
            <i /><i /><i />
          </div>
        ) : null}

        {error ? (
          <div className="shelf-error" role="alert">
            <span>STORAGE PAUSED</span>
            <p>{error}</p>
            {onRetry ? <ActionButton onClick={onRetry}>Retry</ActionButton> : null}
          </div>
        ) : null}

        {!loading && !error && storagePersistent === false && projects.length > 0 ? (
          <div className="persistence-note" role="status">
            <span>STORAGE / BROWSER MANAGED</span>
            <p>This browser may evict local projects under storage pressure. Export important ledgers after a session.</p>
          </div>
        ) : null}

        {!loading && !error && projects.length === 0 ? (
          <div className="empty-shelf">
            <div className="preview-network" aria-hidden="true">
              <i className="preview-node node-a" />
              <i className="preview-node node-b" />
              <i className="preview-node node-c" />
              <i className="preview-line line-a" />
              <i className="preview-line line-b" />
            </div>
            <div>
              <span className="eyebrow">EMPTY FIELD</span>
              <h3>Your first graph starts with a question.</h3>
              <p>It stays on this device and saves after every accepted event.</p>
            </div>
          </div>
        ) : null}

        {!loading && !error && projects.length > 0 ? (
          <ol className="project-list">
            {projects.map((project, index) => (
              <li key={project.id}>
                <button
                  className="project-open"
                  type="button"
                  onClick={() => onOpen(project.id)}
                >
                  <span className="project-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="project-main">
                    <strong>{project.name}</strong>
                    <small>{project.purpose}</small>
                  </span>
                  <span className={`status status-${project.status}`}>{project.status}</span>
                  <span className="project-stats">
                    {project.nodeCount}N / {project.edgeCount}R / {project.eventCount}E
                  </span>
                  <span className="project-date">{relativeDate(project.updatedAt)}</span>
                  <ArrowUpRight aria-hidden="true" size={18} />
                </button>
                <div className="project-actions">
                  <button
                    type="button"
                    aria-label={`Rename ${project.name}`}
                    onClick={() => setRenameProject(project)}
                  >
                    <Pencil aria-hidden="true" size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Export ${project.name}`}
                    onClick={() => void onExport(project.id)}
                  >
                    <Download aria-hidden="true" size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${project.name}`}
                    onClick={() => {
                      setDeleteName("");
                      setDeleteProject(project);
                    }}
                  >
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <footer className="shelf-footer">
        <span>
          STORAGE / {storagePersistent === true ? "PERSISTENT" : "BROWSER MANAGED"}
        </span>
        <span>EVENT LEDGER / SHA-256</span>
        <a href="https://github.com/karimbabasf/graphwake">SOURCE / MIT</a>
      </footer>

      <Dialog
        open={renameProject !== null}
        onClose={() => setRenameProject(null)}
        title="Rename project"
      >
        <form className="project-form" onSubmit={rename}>
          <label>
            <span>Project name</span>
            <input name="name" defaultValue={renameProject?.name} required maxLength={80} />
          </label>
          <div className="dialog-actions">
            <ActionButton tone="quiet" onClick={() => setRenameProject(null)}>Cancel</ActionButton>
            <ActionButton tone="signal" type="submit">Save name</ActionButton>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleteProject !== null}
        onClose={() => setDeleteProject(null)}
        title="Delete local project"
        description="This removes its metadata, event ledger, and saved layout from this browser. There is no undo."
      >
        <div className="project-form">
          <label>
            <span>Type {deleteProject?.name} to confirm</span>
            <input value={deleteName} onChange={(event) => setDeleteName(event.target.value)} />
          </label>
          <div className="dialog-actions">
            <ActionButton tone="quiet" onClick={() => setDeleteProject(null)}>Cancel</ActionButton>
            <ActionButton
              tone="danger"
              disabled={deleteName !== deleteProject?.name}
              onClick={() => void remove()}
            >
              Delete project
            </ActionButton>
          </div>
        </div>
      </Dialog>
    </main>
  );
}
