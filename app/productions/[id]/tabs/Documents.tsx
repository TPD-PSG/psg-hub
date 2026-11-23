"use client";

import { useState } from "react";
import { confirmDialog } from "@/components/Dialogs";
import { FileGrid, FolderToggle, fileIcon, shortName, toggled, type ProdDoc, type SpendDoc, type TabProps } from "../shared";

export default function DocumentsTab({ prod, reload }: TabProps) {
  const id = String(prod.id);
  // Only the folder most recently created (or "General") shows "Uploading…" — as before the split
  const [docUploadFolder, setDocUploadFolder] = useState("General");
  const [docUploading, setDocUploading] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(["General"]));
  async function uploadProdDocs(files: File[], folder: string) {
    setDocUploading(true);
    for (const file of files) {
      const fd = new FormData(); fd.append("file", file); fd.append("folder", folder);
      await fetch(`/api/productions/${id}/documents`, { method: "POST", body: fd });
    }
    setDocUploading(false);
    reload();
  }

  async function deleteProdDoc(docId: number) {
    if (!await confirmDialog("Delete this document?")) return;
    await fetch(`/api/production-documents/${docId}`, { method: "DELETE" });
    reload();
  }

  // Gather budget documents grouped by doc type
  type BudgetDocEntry = { dept: string; expDesc: string; doc: SpendDoc };
  const budgetDocsByType: Record<string, BudgetDocEntry[]> = { Quotes: [], "Purchase Orders": [], Invoices: [], Other: [] };
  prod.budgetLines.forEach((l) => {
    l.expenses.forEach((x) => {
      x.documents.forEach((d) => {
        const entry = { dept: l.department, expDesc: x.description, doc: d };
        if (d.type === "quote") budgetDocsByType["Quotes"].push(entry);
        else if (d.type === "po") budgetDocsByType["Purchase Orders"].push(entry);
        else if (d.type === "invoice") budgetDocsByType["Invoices"].push(entry);
        else budgetDocsByType["Other"].push(entry);
      });
    });
  });
  const totalBudgetDocs = Object.values(budgetDocsByType).reduce((s, arr) => s + arr.length, 0);

  // User folders — support "Parent/Sub" paths
  const rawFolders = Array.from(new Set(["General", ...prod.productionDocuments.map((d) => d.folder)]));
  // top-level folders are those with no "/" or whose prefix doesn't appear as another folder
  const topFolders = Array.from(new Set(rawFolders.map(f => f.split("/")[0])));

  const toggleFolder = (f: string) => setOpenFolders(prev => toggled(prev, f));

  const docGrid = (docs: ProdDoc[], folderPath: string) => (
    <FileGrid docs={docs} href={(doc) => `/api/production-documents/${doc.id}`} onDelete={deleteProdDoc}
      onUpload={(files) => uploadProdDocs(files, folderPath)} uploading={docUploading && docUploadFolder === folderPath} />
  );

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm" style={{ color: "var(--psg-muted)" }}>All documents for this production</p>
        <button onClick={() => setShowNewFolder(v => !v)} className="text-xs border px-3 py-1.5 rounded hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>+ New Folder</button>
      </div>

      {/* New folder input */}
      {showNewFolder && (() => {
        const parentOptions = ["(top level)", ...topFolders];
        const [selParent, setSelParent] = [newFolderName.includes("__parent__") ? newFolderName.split("__parent__")[0] : "(top level)", (v: string) => setNewFolderName(prev => { const name = prev.includes("__parent__") ? prev.split("__parent__")[1] : prev; return v === "(top level)" ? name : `${v}__parent__${name}`; })];
        const folderLabel = newFolderName.includes("__parent__") ? newFolderName.split("__parent__")[1] : newFolderName;
        const finalPath = selParent === "(top level)" ? folderLabel : `${selParent}/${folderLabel}`;
        const createFolder = () => { if (folderLabel.trim()) { setOpenFolders(p => new Set([...p, finalPath, selParent])); setDocUploadFolder(finalPath); setNewFolderName(""); setShowNewFolder(false); } };
        return (
          <div className="rounded-lg border p-4 space-y-3" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-blue)" }}>
            <p className="text-sm font-semibold text-white">New Folder</p>
            <div className="flex gap-2">
              <select className="rounded border px-3 py-1.5 text-sm" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)", color: "var(--psg-text)" }} value={selParent} onChange={(e) => setSelParent(e.target.value)}>
                {parentOptions.map(o => <option key={o} value={o}>{o === "(top level)" ? "Top level" : `Inside: ${o}`}</option>)}
              </select>
              <input
                className="flex-1 rounded border px-3 py-1.5 text-sm"
                style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)", color: "var(--psg-text)" }}
                placeholder="Folder name…"
                value={folderLabel}
                onChange={(e) => { const v = e.target.value; setNewFolderName(selParent === "(top level)" ? v : `${selParent}__parent__${v}`); }}
                onKeyDown={(e) => { if (e.key === "Enter") createFolder(); }}
              />
            </div>
            {folderLabel.trim() && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Will create: {finalPath}</p>}
            <div className="flex gap-2">
              <button onClick={createFolder} className="text-white px-3 py-1.5 rounded text-sm" style={{ backgroundColor: "var(--psg-blue)" }}>Create</button>
              <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} className="text-sm border px-3 py-1.5 rounded hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
            </div>
          </div>
        );
      })()}

      {/* Budget Documents folder with sub-folders by type */}
      {totalBudgetDocs > 0 && (
        <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
          <FolderToggle icon="📁" title="Budget Documents" count={`${totalBudgetDocs} file${totalBudgetDocs !== 1 ? "s" : ""}`} badge="auto-populated"
            open={openFolders.has("__budget")} onToggle={() => toggleFolder("__budget")} />
          {openFolders.has("__budget") && (
            <div className="p-4 space-y-3">
              {(["Quotes", "Purchase Orders", "Invoices", "Other"] as const).map((subName) => {
                const entries = budgetDocsByType[subName];
                if (entries.length === 0) return null;
                const subKey = `__budget_${subName}`;
                const isSubOpen = openFolders.has(subKey);
                return (
                  <div key={subName} className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--psg-card-border)" }}>
                    <FolderToggle sub icon="📂" title={subName} count={entries.length} open={isSubOpen} onToggle={() => toggleFolder(subKey)} />
                    {isSubOpen && (
                      <div className="p-3 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                        {entries.map(({ doc, dept, expDesc }) => (
                          <a key={doc.id} href={`/api/spend-documents/${doc.id}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-3 rounded-lg border hover:bg-white/5 transition-colors" style={{ borderColor: "var(--psg-card-border)" }}>
                            <span className="text-2xl shrink-0">{fileIcon(doc.mime)}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-white truncate" title={doc.name}>{shortName(doc.name)}</p>
                              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--psg-muted)" }}>{dept} · {expDesc}</p>
                              <p className="text-xs" style={{ color: "var(--psg-muted)" }}>{new Date(doc.createdAt).toLocaleDateString("en-GB")}</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* User folders — render top-level, with sub-folders nested inside */}
      {topFolders.map((topFolder) => {
        const directDocs = prod.productionDocuments.filter((d) => d.folder === topFolder);
        const subFolderNames = Array.from(new Set(
          prod.productionDocuments
            .filter((d) => d.folder.startsWith(topFolder + "/"))
            .map((d) => d.folder)
        ));
        const totalInFolder = directDocs.length + prod.productionDocuments.filter(d => d.folder.startsWith(topFolder + "/")).length;
        const isOpen = openFolders.has(topFolder);
        return (
          <div key={topFolder} className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <FolderToggle icon="📁" title={topFolder} count={`${totalInFolder} file${totalInFolder !== 1 ? "s" : ""}`} open={isOpen} onToggle={() => toggleFolder(topFolder)} />
            {isOpen && (
              <div className="p-4 space-y-4">
                {/* Sub-folders */}
                {subFolderNames.map((subPath) => {
                  const subDocs = prod.productionDocuments.filter(d => d.folder === subPath);
                  const subLabel = subPath.split("/").slice(1).join("/");
                  const isSubOpen = openFolders.has(subPath);
                  return (
                    <div key={subPath} className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--psg-card-border)" }}>
                      <FolderToggle sub icon="📂" title={subLabel} count={subDocs.length} open={isSubOpen} onToggle={() => toggleFolder(subPath)} />
                      {isSubOpen && <div className="p-3">{docGrid(subDocs, subPath)}</div>}
                    </div>
                  );
                })}
                {/* Direct files in this top-level folder */}
                {(directDocs.length > 0 || subFolderNames.length === 0) && (
                  docGrid(directDocs, topFolder)
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
    );
    }
