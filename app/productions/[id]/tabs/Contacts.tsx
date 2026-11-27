"use client";

import { useEffect, useRef, useState } from "react";
import { exportContactSheetPDF } from "@/lib/exports";
import { CONTACT_SECTIONS_SETTING, defaultSections, parseSections } from "@/lib/contactSections";
import { confirmDialog } from "@/components/Dialogs";
import { F, Modal, Btns, inp, inpStyle, sendJson, useList, type ProdContact, type TabProps } from "../shared";

export default function ContactsTab({ prod, setProd }: TabProps) {
  const id = String(prod.id);
  const [contacts, setContacts, reloadContacts] = useList<ProdContact>(`/api/productions/${id}/contacts`);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editContact, setEditContact] = useState<ProdContact | null>(null);
  const BLANK_CONTACT = { section: "General", name: "", company: "", role: "", phone: "", email: "", notes: "" };
  const [contactForm, setContactForm] = useState(BLANK_CONTACT);
  const [dragContactId, setDragContactId] = useState<number | null>(null);
  const [dragSectionName, setDragSectionName] = useState<string | null>(null);
  // Contact-sheet sections: company defaults (Hub Settings) + this production's own list
  const [companySections, setCompanySections] = useState<string[]>(defaultSections(null));
  const [showSectionsModal, setShowSectionsModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then((d: Record<string, string>) => setCompanySections(defaultSections(d?.[CONTACT_SECTIONS_SETTING]))).catch(() => {});
  }, []);
  const prodSections = parseSections(prod?.contactSections);
  async function saveProdSections(next: string[]) {
    const res = await sendJson(`/api/productions/${id}/contacts/sections`, "PUT", { sections: next });
    if (res.ok) {
      const { sections } = await res.json();
      setProd(p => p ? { ...p, contactSections: JSON.stringify(sections) } : p);
    }
  }
  // Contact sheet import
  const contactImportRef = useRef<HTMLInputElement>(null);
  const [contactImportState, setContactImportState] = useState<"idle" | "uploading" | "reviewing" | "importing">("idle");
  const [contactImportError, setContactImportError] = useState<string | null>(null);
  const [contactDragOver, setContactDragOver] = useState(false);
  type ImportedContact = { section: string; name: string; company?: string; role?: string; phone?: string; email?: string; notes?: string; _selected: boolean };
  const [importedContacts, setImportedContacts] = useState<ImportedContact[]>([]);

  async function handleContactImport(file: File) {
    setContactImportState("uploading");
    setContactImportError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/productions/${id}/contacts/import`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setContactImportError(data.error ?? "Import failed"); setContactImportState("idle"); return; }
      if (!data.contacts?.length) { setContactImportError("No contacts found in this document"); setContactImportState("idle"); return; }
      setImportedContacts(data.contacts.map((c: Omit<ImportedContact, "_selected">) => ({ ...c, _selected: true })));
      setContactImportState("reviewing");
    } catch {
      setContactImportError("Upload failed — please try again");
      setContactImportState("idle");
    }
  }

  async function confirmContactImport() {
    const toImport = importedContacts.filter(c => c._selected).map(c => { const rest: Partial<ImportedContact> = { ...c }; delete rest._selected; return rest; });
    if (!toImport.length) return;
    setContactImportState("importing");
    const fd = new FormData();
    fd.append("contacts", JSON.stringify(toImport));
    const res = await fetch(`/api/productions/${id}/contacts/import`, { method: "POST", body: fd });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.contacts)) setContacts(data.contacts);
      setContactImportState("idle");
      setImportedContacts([]);
    } else {
      setContactImportError("Import failed");
      setContactImportState("reviewing");
    }
  }

  // Drag-and-drop reorder: renumber, show at once, then save
  function saveContactOrder(next: ProdContact[]) {
    const updated = next.map((c, i) => ({ ...c, sortOrder: i }));
    setContacts(updated);
    sendJson(`/api/productions/${id}/contacts/reorder`, "PATCH", { order: updated.map(x => ({ id: x.id, sortOrder: x.sortOrder })) });
  }

  function openContactForm(c?: ProdContact, section?: string) {
    setEditContact(c ?? null);
    setContactForm(c
      ? { section: c.section, name: c.name, company: c.company ?? "", role: c.role ?? "", phone: c.phone ?? "", email: c.email ?? "", notes: c.notes ?? "" }
      : { ...BLANK_CONTACT, section: section ?? BLANK_CONTACT.section });
    setShowContactForm(true);
  }
  function closeContactForm() { setShowContactForm(false); setEditContact(null); }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    if (editContact) {
      await sendJson(`/api/production-contacts/${editContact.id}`, "PUT", contactForm);
    } else {
      await sendJson(`/api/productions/${id}/contacts`, "POST", contactForm);
    }
    setShowContactForm(false);
    setEditContact(null);
    setContactForm(BLANK_CONTACT);
    reloadContacts();
  }

  async function deleteContact(cid: number) {
    if (!await confirmDialog("Delete this contact?")) return;
    await fetch(`/api/production-contacts/${cid}`, { method: "DELETE" });
    reloadContacts();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-white">Contacts</h2>
        <div className="flex items-center gap-2">
          {contacts.length > 0 && (
            <button onClick={() => exportContactSheetPDF(prod.name, contacts, prod.logoUrl)}
              className="px-3 py-2 rounded text-sm border hover:bg-white/5 transition-colors"
              style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
              ↓ Export PDF
            </button>
          )}
          <input ref={contactImportRef} type="file" accept=".pdf,.doc,.docx,.csv,.xlsx,.xls" className="hidden"
            onChange={e => { if (e.target.files?.[0]) { handleContactImport(e.target.files[0]); e.target.value = ""; } }} />
          <button onClick={() => contactImportRef.current?.click()}
            disabled={contactImportState !== "idle"}
            className="px-3 py-2 rounded text-sm border hover:bg-white/5 transition-colors disabled:opacity-50"
            style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
            {contactImportState === "uploading" ? "Analysing…" : "↑ Import"}
          </button>
          <button onClick={() => setShowSectionsModal(true)}
            className="px-3 py-2 rounded text-sm border hover:bg-white/5 transition-colors"
            style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
            Sections
          </button>
          <button onClick={() => openContactForm()}
            className="px-4 py-2 rounded font-medium text-white text-sm" style={{ backgroundColor: "var(--psg-blue)" }}>
            + Add Contact
          </button>
        </div>
      </div>

      {contactImportState === "idle" && (
        <div
          className="rounded border-2 border-dashed py-4 text-center text-xs transition-colors"
          style={{ borderColor: contactDragOver ? "var(--psg-blue)" : "var(--psg-card-border)", backgroundColor: contactDragOver ? "rgba(59,130,246,0.08)" : "transparent", color: "var(--psg-muted)" }}
          onDragOver={e => { e.preventDefault(); setContactDragOver(true); }}
          onDragLeave={() => setContactDragOver(false)}
          onDrop={e => { e.preventDefault(); setContactDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleContactImport(file); }}
        >
          Drop a contact sheet here — PDF, Excel, Word or CSV
        </div>
      )}

      {contactImportError && (
        <div className="text-sm text-red-400 rounded px-3 py-2 bg-red-900/20 flex items-center justify-between">
          <span>{contactImportError}</span>
          <button onClick={() => setContactImportError(null)} className="ml-3 text-red-400 hover:text-red-300">×</button>
        </div>
      )}

      {contactImportState === "reviewing" && (
        <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-blue)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-white text-sm">Review imported contacts</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
                {importedContacts.filter(c => c._selected).length} of {importedContacts.length} selected — deselect any you don&apos;t want to import
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setContactImportState("idle"); setImportedContacts([]); }}
                className="px-3 py-1.5 rounded text-sm" style={{ color: "var(--psg-muted)", backgroundColor: "rgba(255,255,255,0.08)" }}>
                Cancel
              </button>
              <button onClick={confirmContactImport} disabled={!importedContacts.some(c => c._selected)}
                className="px-4 py-1.5 rounded text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "var(--psg-blue)" }}>
                Import {importedContacts.filter(c => c._selected).length} contacts
              </button>
            </div>
          </div>
          {importedContacts.some(c => contacts.some(ex => ex.name.toLowerCase() === c.name.toLowerCase())) && (
            <div className="text-xs rounded-lg px-3 py-2 flex items-center gap-2" style={{ backgroundColor: "rgba(234,179,8,0.1)", color: "#fde047" }}>
              ⚠ Some names already exist in this production&apos;s contacts — duplicates are highlighted below. Deselect them if you don&apos;t want to add again.
            </div>
          )}
          <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
            {importedContacts.map((c, i) => {
              const isDuplicate = contacts.some(ex => ex.name.toLowerCase() === c.name.toLowerCase());
              return (
                <label key={i} className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${c._selected ? (isDuplicate ? "bg-yellow-900/20" : "bg-white/5") : "opacity-40"}`}
                  style={isDuplicate && c._selected ? { borderLeft: "2px solid #ca8a04" } : undefined}>
                  <input type="checkbox" checked={c._selected} onChange={() => setImportedContacts(prev => prev.map((x, j) => j === i ? { ...x, _selected: !x._selected } : x))}
                    className="mt-0.5 w-4 h-4 rounded flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{c.name}</span>
                      {isDuplicate && <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(234,179,8,0.2)", color: "#fde047" }}>already exists</span>}
                      {c.role && <span className="text-xs" style={{ color: "var(--psg-blue)" }}>{c.role}</span>}
                      {c.company && <span className="text-xs" style={{ color: "var(--psg-muted)" }}>{c.company}</span>}
                      <span className="text-xs px-1.5 py-0.5 rounded-full border" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>{c.section}</span>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-xs" style={{ color: "var(--psg-muted)" }}>
                      {c.phone && <span>📞 {c.phone}</span>}
                      {c.email && <span>✉ {c.email}</span>}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {contactImportState === "importing" && (
        <div className="text-sm text-center py-4" style={{ color: "var(--psg-muted)" }}>Importing contacts…</div>
      )}

      {contacts.length === 0 && prodSections.length === 0 ? (
        <div className="rounded-xl border p-10 text-center text-sm" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
          No contacts yet — add people associated with this production.
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(new Set(contacts.map(c => c.section))).map(section => (
            <div
              key={section}
              draggable
              onDragStart={e => { e.stopPropagation(); setDragSectionName(section); setDragContactId(null); }}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => {
                e.preventDefault(); e.stopPropagation();
                if (!dragSectionName || dragSectionName === section) { setDragSectionName(null); return; }
                // Reorder contacts so dragSectionName block moves before this section's block
                const sections = Array.from(new Set(contacts.map(c => c.section)));
                const fromIdx = sections.indexOf(dragSectionName);
                const toIdx = sections.indexOf(section);
                if (fromIdx === -1 || toIdx === -1) { setDragSectionName(null); return; }
                const newSections = [...sections];
                const [moved] = newSections.splice(fromIdx, 1);
                newSections.splice(toIdx, 0, moved);
                // Rebuild contacts in new section order, keeping within-section order
                const next: typeof contacts = [];
                for (const s of newSections) {
                  next.push(...contacts.filter(c => c.section === s));
                }
                setDragSectionName(null);
                saveContactOrder(next);
              }}
              onDragEnd={() => setDragSectionName(null)}
              className={`transition-opacity ${dragSectionName === section ? "opacity-40" : ""}`}
            >
              <div className="flex items-center gap-1.5 mb-2 cursor-grab active:cursor-grabbing group/sec">
                <span className="opacity-0 group-hover/sec:opacity-30 text-xs select-none" style={{ color: "var(--psg-muted)" }}>⠿</span>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>{section}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {contacts.filter(c => c.section === section).map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={e => { e.stopPropagation(); setDragContactId(c.id); setDragSectionName(null); }}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={() => {
                      if (dragContactId === null || dragContactId === c.id) return;
                      const draggedIdx = contacts.findIndex(x => x.id === dragContactId);
                      const targetIdx = contacts.findIndex(x => x.id === c.id);
                      if (draggedIdx === -1 || targetIdx === -1) return;
                      const next = [...contacts];
                      const [moved] = next.splice(draggedIdx, 1);
                      next.splice(targetIdx, 0, moved);
                      setDragContactId(null);
                      saveContactOrder(next);
                    }}
                    onDragEnd={() => setDragContactId(null)}
                    className={`rounded-xl border p-4 space-y-1 relative group cursor-grab active:cursor-grabbing transition-opacity ${dragContactId === c.id ? "opacity-40" : ""}`}
                    style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}
                  >
                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-30 transition-opacity text-xs select-none" style={{ color: "var(--psg-muted)" }}>⠿</div>
                    <div className="font-medium text-white text-sm pl-3">{c.name}</div>
                    {c.role && <div className="text-xs pl-3" style={{ color: "var(--psg-blue)" }}>{c.role}</div>}
                    {c.company && <div className="text-xs pl-3" style={{ color: "var(--psg-muted)" }}>{c.company}</div>}
                    {c.phone && <a href={`tel:${c.phone}`} className="block text-xs pl-3 hover:text-white transition-colors" style={{ color: "var(--psg-muted)" }}>📞 {c.phone}</a>}
                    {c.email && <a href={`mailto:${c.email}`} className="block text-xs pl-3 hover:text-white transition-colors truncate" style={{ color: "var(--psg-muted)" }}>✉ {c.email}</a>}
                    {c.notes && <div className="text-xs pl-3 pt-1 border-t" style={{ color: "var(--psg-muted)", borderColor: "var(--psg-card-border)" }}>{c.notes}</div>}
                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openContactForm(c)}
                        className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors" style={{ color: "var(--psg-muted)" }}>Edit</button>
                      <button onClick={() => deleteContact(c.id)}
                        className="text-xs px-2 py-1 rounded hover:bg-red-900/20 transition-colors text-red-400">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {prodSections.filter(s => !contacts.some(c => c.section === s)).map(section => (
            <div key={`empty-${section}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--psg-muted)" }}>{section}</span>
              </div>
              <button onClick={() => openContactForm(undefined, section)}
                className="w-full rounded-xl border border-dashed p-4 text-sm text-left hover:bg-white/5 transition-colors"
                style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                No contacts yet · + Add one to {section}
              </button>
            </div>
          ))}
        </div>
      )}

      {showSectionsModal && (
        <Modal title="Contact sheet sections" onClose={() => { setShowSectionsModal(false); setNewSectionName(""); }}>
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-white">This production&apos;s sections</p>
              <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Show on the contact sheet even before anyone is in them. Removing one doesn&apos;t delete its contacts.</p>
              {prodSections.length === 0 && <p className="text-xs italic" style={{ color: "var(--psg-muted)" }}>None yet.</p>}
              <div className="space-y-1">
                {prodSections.map((s, i) => (
                  <div key={s} className="flex items-center gap-2 rounded border px-3 py-1.5 text-sm" style={{ borderColor: "var(--psg-card-border)" }}>
                    <span className="flex-1 text-white">{s}</span>
                    <button type="button" disabled={i === 0} onClick={() => { const n = [...prodSections]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; saveProdSections(n); }}
                      className="text-xs px-1.5 disabled:opacity-20" style={{ color: "var(--psg-muted)" }} aria-label={`Move ${s} up`}>↑</button>
                    <button type="button" disabled={i === prodSections.length - 1} onClick={() => { const n = [...prodSections]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; saveProdSections(n); }}
                      className="text-xs px-1.5 disabled:opacity-20" style={{ color: "var(--psg-muted)" }} aria-label={`Move ${s} down`}>↓</button>
                    <button type="button" onClick={() => saveProdSections(prodSections.filter(x => x !== s))}
                      className="text-xs px-1.5 text-red-400" aria-label={`Remove ${s}`}>✕</button>
                  </div>
                ))}
              </div>
              <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (newSectionName.trim()) { saveProdSections([...prodSections, newSectionName.trim()]); setNewSectionName(""); } }}>
                <input className={inp} style={inpStyle} value={newSectionName} onChange={e => setNewSectionName(e.target.value)} placeholder="New section, e.g. Wardrobe" />
                <button type="submit" className="px-3 py-2 rounded text-sm font-medium text-white shrink-0" style={{ backgroundColor: "var(--psg-blue)" }}>Add</button>
              </form>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-white">Company defaults</p>
              <p className="text-xs" style={{ color: "var(--psg-muted)" }}>Offered on every production. Click one to add it here. Admins can change this list in Hub Settings.</p>
              <div className="flex flex-wrap gap-1.5">
                {companySections.map(s => {
                  const added = prodSections.includes(s);
                  return (
                    <button key={s} type="button" disabled={added} onClick={() => saveProdSections([...prodSections, s])}
                      className="px-2.5 py-1 rounded-full text-xs border transition-colors disabled:opacity-40"
                      style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>
                      {added ? "✓ " : "+ "}{s}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showContactForm && (
        <Modal title={editContact ? "Edit Contact" : "Add Contact"} onClose={closeContactForm}>
          <form onSubmit={saveContact} className="space-y-3">
            <F label="Section">
              {(() => {
                const existingSections = Array.from(new Set(contacts.map(c => c.section)));
                const allOptions = Array.from(new Set([...existingSections, ...prodSections, ...companySections]));
                const isCustom = contactForm.section && !allOptions.includes(contactForm.section);
                return (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {allOptions.map(s => (
                        <button key={s} type="button"
                          onClick={() => setContactForm(f => ({ ...f, section: s }))}
                          className="px-2.5 py-1 rounded-full text-xs border transition-colors"
                          style={{
                            borderColor: contactForm.section === s ? "var(--psg-blue)" : "var(--psg-card-border)",
                            backgroundColor: contactForm.section === s ? "rgba(59,130,246,0.15)" : "transparent",
                            color: contactForm.section === s ? "var(--psg-blue)" : "var(--psg-muted)",
                          }}>
                          {s}
                        </button>
                      ))}
                      <button type="button"
                        onClick={() => setContactForm(f => ({ ...f, section: "" }))}
                        className="px-2.5 py-1 rounded-full text-xs border transition-colors"
                        style={{
                          borderColor: isCustom || contactForm.section === "" ? "var(--psg-blue)" : "var(--psg-card-border)",
                          backgroundColor: isCustom || contactForm.section === "" ? "rgba(59,130,246,0.15)" : "transparent",
                          color: isCustom || contactForm.section === "" ? "var(--psg-blue)" : "var(--psg-muted)",
                        }}>
                        + Custom
                      </button>
                    </div>
                    {(isCustom || contactForm.section === "") && (
                      <input autoFocus className={inp} style={inpStyle} value={contactForm.section} onChange={e => setContactForm(f => ({ ...f, section: e.target.value }))} placeholder="Section name…" />
                    )}
                  </div>
                );
              })()}
            </F>
            <F label="Name *"><input required className={inp} style={inpStyle} value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Role / Title"><input className={inp} style={inpStyle} value={contactForm.role} onChange={e => setContactForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Director, Producer" /></F>
              <F label="Company"><input className={inp} style={inpStyle} value={contactForm.company} onChange={e => setContactForm(f => ({ ...f, company: e.target.value }))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Phone"><input type="tel" className={inp} style={inpStyle} value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} /></F>
              <F label="Email"><input type="email" className={inp} style={inpStyle} value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} /></F>
            </div>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={contactForm.notes} onChange={e => setContactForm(f => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={closeContactForm} label={editContact ? "Save Changes" : "Add Contact"} />
          </form>
        </Modal>
      )}
    </div>
  );
}
