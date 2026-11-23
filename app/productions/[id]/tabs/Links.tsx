"use client";

import { useState } from "react";
import { confirmDialog } from "@/components/Dialogs";
import { F, inp, inpStyle, sendJson, type ProdLink, type TabProps } from "../shared";

export default function LinksTab({ prod, reload }: TabProps) {
  const id = String(prod.id);
  const BLANK_LINK = { title: "", url: "", description: "" };
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingLink, setEditingLink] = useState<ProdLink | null>(null);
  const [linkForm, setLinkForm] = useState(BLANK_LINK);

  function closeLinkForm() {
    setShowLinkForm(false); setEditingLink(null); setLinkForm(BLANK_LINK);
  }

  async function saveLink(e: React.FormEvent) {
    e.preventDefault();
    if (editingLink) {
      await sendJson(`/api/production-links/${editingLink.id}`, "PUT", linkForm);
    } else {
      await sendJson(`/api/productions/${id}/links`, "POST", linkForm);
    }
    closeLinkForm();
    reload();
  }

  async function deleteLink(lid: number) {
    if (!await confirmDialog("Remove this link?")) return;
    await fetch(`/api/production-links/${lid}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setLinkForm(BLANK_LINK); setEditingLink(null); setShowLinkForm(true); }} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
          + Add Link
        </button>
      </div>

      {prod.productionLinks.length === 0 && !showLinkForm && (
        <p className="text-center py-16" style={{ color: "var(--psg-muted)" }}>No links added yet.</p>
      )}

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {prod.productionLinks.map((link) => {
          const svc = serviceInfo(link.url);
          return (
            <div key={link.id} className="rounded-lg border overflow-hidden group" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
              {/* Service header band */}
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: svc.bg }}>
                <div className="flex items-center gap-2">
                  <span className="shrink-0">{svc.logo}</span>
                  <span className="text-xs font-semibold text-white">{svc.label}</span>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setLinkForm({ title: link.title, url: link.url, description: link.description ?? "" }); setEditingLink(link); setShowLinkForm(true); }} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                  <button onClick={() => deleteLink(link.id)} className="text-xs text-red-400 hover:text-red-300">×</button>
                </div>
              </div>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="block px-4 py-3 hover:bg-white/5 transition-colors">
                <p className="font-semibold text-sm text-white">{link.title}</p>
                {link.description && <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{link.description}</p>}
                <p className="text-xs mt-1 truncate" style={{ color: "var(--psg-muted)" }}>{link.url}</p>
              </a>
            </div>
          );
        })}
      </div>

      {/* Inline add/edit form */}
      {showLinkForm && (
        <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-blue)" }}>
          <p className="text-sm font-semibold text-white mb-3">{editingLink ? "Edit Link" : "New Link"}</p>
          <form onSubmit={saveLink} className="space-y-3">
            <F label="Title *"><input required className={inp} style={inpStyle} value={linkForm.title} onChange={(e) => setLinkForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Show Dropbox Folder" /></F>
            <F label="URL *"><input required type="url" className={inp} style={inpStyle} value={linkForm.url} onChange={(e) => setLinkForm(f => ({ ...f, url: e.target.value }))} placeholder="https://…" /></F>
            <F label="Description"><input className={inp} style={inpStyle} value={linkForm.description} onChange={(e) => setLinkForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional note about this link" /></F>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>{editingLink ? "Save Changes" : "Add Link"}</button>
              <button type="button" onClick={closeLinkForm} className="text-sm border px-4 py-2 rounded hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

type SvcInfo = { label: string; bg: string; logo: React.ReactNode };
/** Label, tint and logo for the link card, picked from the URL's host. */
function serviceInfo(url: string): SvcInfo {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("dropbox")) return {
      label: "Dropbox", bg: "rgba(0,97,255,0.15)",
      logo: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 2L12 6.5L6 11L0 6.5L6 2Z" fill="#0061FF"/><path d="M18 2L24 6.5L18 11L12 6.5L18 2Z" fill="#0061FF"/><path d="M0 13.5L6 9L12 13.5L6 18L0 13.5Z" fill="#0061FF"/><path d="M24 13.5L18 9L12 13.5L18 18L24 13.5Z" fill="#0061FF"/><path d="M6 19.5L12 15L18 19.5L12 24L6 19.5Z" fill="#0061FF"/></svg>,
    };
    if (host.includes("sharepoint") || host.includes("onedrive")) return {
      label: host.includes("onedrive") ? "OneDrive" : "SharePoint", bg: "rgba(0,120,212,0.15)",
      logo: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12.5 5C10.0147 5 7.9 6.75 7.5 9.14A5 5 0 0 0 10 19h9a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 12.5 5Z" fill="#0078D4"/><path d="M4 14.5A3.5 3.5 0 0 0 7.5 18H8a5 5 0 0 1-.88-2H7.5A2.5 2.5 0 0 1 5 13.5a2.49 2.49 0 0 1 2-2.45A5 5 0 0 1 7.5 9.14 3.5 3.5 0 0 0 4 14.5Z" fill="#50D9FF"/></svg>,
    };
    if (host.includes("drive.google") || host.includes("docs.google") || host.includes("sheets.google") || host.includes("slides.google")) return {
      label: "Google Drive", bg: "rgba(66,133,244,0.12)",
      logo: <svg width="20" height="20" viewBox="0 0 24 24"><path d="M4.433 22l2.788-4.826H22l-2.787 4.826z" fill="#0066DA"/><path d="M2 18.165L7.364 8.56l2.792 4.837L4.792 23z" fill="#00AC47"/><path d="M9.364 8.56L14.636 2h10.728L20.09 8.56z" fill="#EA4335"/><path d="M9.364 8.56h5.272L9.364 8.56z" fill="#00832D"/><path d="M2 18.165L7.364 8.56h2.788L4.79 18.165z" fill="#2684FC"/><path d="M14.636 2l5.364 9.165h2.364L17 2z" fill="#FFBA00"/></svg>,
    };
    if (host.includes("notion")) return {
      label: "Notion", bg: "rgba(255,255,255,0.08)",
      logo: <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.934zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/></svg>,
    };
    if (host.includes("github")) return {
      label: "GitHub", bg: "rgba(255,255,255,0.08)",
      logo: <svg width="20" height="20" viewBox="0 0 24 24" fill="#e6edf3"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>,
    };
    if (host.includes("figma")) return {
      label: "Figma", bg: "rgba(242,78,30,0.12)",
      logo: <svg width="20" height="20" viewBox="0 0 24 24"><path d="M8 24c2.208 0 4-1.792 4-4v-4H8c-2.208 0-4 1.792-4 4s1.792 4 4 4z" fill="#0ACF83"/><path d="M4 12c0-2.208 1.792-4 4-4h4v8H8c-2.208 0-4-1.792-4-4z" fill="#A259FF"/><path d="M4 4c0-2.208 1.792-4 4-4h4v8H8C5.792 8 4 6.208 4 4z" fill="#F24E1E"/><path d="M12 0h4c2.208 0 4 1.792 4 4s-1.792 4-4 4h-4V0z" fill="#FF7262"/><path d="M20 12c0 2.208-1.792 4-4 4s-4-1.792-4-4 1.792-4 4-4 4 1.792 4 4z" fill="#1ABCFE"/></svg>,
    };
    if (host.includes("slack")) return {
      label: "Slack", bg: "rgba(74,21,75,0.2)",
      logo: <svg width="20" height="20" viewBox="0 0 24 24"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#E01E5A"/></svg>,
    };
    if (host.includes("wetransfer")) return {
      label: "WeTransfer", bg: "rgba(0,188,212,0.12)",
      logo: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#00C2CC"/><text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">WT</text></svg>,
    };
    if (host.includes("trello")) return {
      label: "Trello", bg: "rgba(0,82,204,0.12)",
      logo: <svg width="20" height="20" viewBox="0 0 24 24" fill="#0052CC"><path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.656 1.343 3 3 3h18c1.656 0 3-1.344 3-3V3c0-1.657-1.344-3-3-3zm-11.5 18.3c0 .77-.635 1.4-1.4 1.4H4.9c-.77 0-1.4-.63-1.4-1.4V4.9c0-.77.63-1.4 1.4-1.4h3.2c.765 0 1.4.63 1.4 1.4v13.4zm10.9-6.5c0 .77-.635 1.4-1.4 1.4h-3.2c-.77 0-1.4-.63-1.4-1.4V4.9c0-.77.63-1.4 1.4-1.4H19c.765 0 1.4.63 1.4 1.4v6.9z"/></svg>,
    };
    if (host.includes("airtable")) return {
      label: "Airtable", bg: "rgba(24,191,255,0.12)",
      logo: <svg width="20" height="20" viewBox="0 0 24 24"><path d="M11.386.093L.956 4.17a.72.72 0 0 0 .002 1.343l10.47 3.983a3.19 3.19 0 0 0 2.146 0l10.47-3.983a.72.72 0 0 0 .001-1.344L13.616.093a3.19 3.19 0 0 0-2.23 0z" fill="#FCB400"/><path d="M12.75 13.187v9.504a.75.75 0 0 0 1.014.705l11.25-4.37A.75.75 0 0 0 25.5 18.32v-9.504a.75.75 0 0 0-1.014-.705l-11.25 4.37a.75.75 0 0 0-.486.706z" fill="#18BFFF"/><path d="M10.986 13.59L7.5 11.76v7.794l-6-2.63V9.57L.75 8.81A.75.75 0 0 0 0 9.558v8.763a.75.75 0 0 0 .499.71l10.5 3.75a.75.75 0 0 0 1.001-.71v-8.08a.75.75 0 0 0-1.014-.402z" fill="#F82B60"/></svg>,
    };
  } catch { /* invalid url */ }
  return {
    label: "Link", bg: "rgba(255,255,255,0.05)",
    logo: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  };
}
