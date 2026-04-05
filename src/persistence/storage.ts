// ============================================================================
// IndexedDB Persistence — Save/load projects using idb
// ============================================================================

import { openDB, type IDBPDatabase } from 'idb';
import type { Project } from '../types';
import { migrateProject } from './schema';

const DB_NAME = 'latergator';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const AUTOSAVE_KEY = 'autosave';

interface ProjectRecord {
  id: string;
  name: string;
  data: Project;
  updatedAt: number;
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    },
  });
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  const record: ProjectRecord = {
    id: project.id,
    name: project.name,
    data: project,
    updatedAt: Date.now(),
  };
  await db.put(STORE_NAME, record);
}

export async function loadProject(id: string): Promise<Project | null> {
  const db = await getDB();
  const record = await db.get(STORE_NAME, id);
  if (!record) return null;
  try {
    return migrateProject(record.data) as unknown as Project;
  } catch (e) {
    console.error('Failed to load project:', e);
    return null;
  }
}

export async function listProjects(): Promise<Array<{ id: string; name: string; updatedAt: number }>> {
  const db = await getDB();
  const records: ProjectRecord[] = await db.getAll(STORE_NAME);
  return records
    .map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

// --- Autosave ----------------------------------------------------------------

export async function autosave(project: Project): Promise<void> {
  try {
    await saveProject(project);
  } catch (e) {
    console.warn('Autosave failed:', e);
  }
}

let autosaveInterval: ReturnType<typeof setInterval> | null = null;

export function startAutosave(getProject: () => Project, intervalMs = 30000): void {
  stopAutosave();
  autosaveInterval = setInterval(() => {
    autosave(getProject());
  }, intervalMs);
}

export function stopAutosave(): void {
  if (autosaveInterval) {
    clearInterval(autosaveInterval);
    autosaveInterval = null;
  }
}
