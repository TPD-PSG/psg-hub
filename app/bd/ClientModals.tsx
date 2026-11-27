// Add client and edit client form modals.
import { CLIENT_TYPES, BLANK_CLIENT, inp, inpStyle, type Client } from "./bdTypes";

export function EditClientModal({ editClientForm, setEditClientForm, saveEditClient, setEditingClient }: {
  editClientForm: typeof BLANK_CLIENT;
  setEditClientForm: React.Dispatch<React.SetStateAction<typeof BLANK_CLIENT>>;
  saveEditClient: (e: React.FormEvent) => void;
  setEditingClient: (c: Client | null) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="rounded-xl shadow-2xl w-full max-w-md border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
          <h2 className="font-semibold text-white">Edit Client</h2>
          <button onClick={() => setEditingClient(null)} className="text-xl leading-none hover:text-white" style={{ color: "var(--psg-muted)" }}>×</button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          <form onSubmit={saveEditClient} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Name *</label>
              <input required className={inp} style={inpStyle} value={editClientForm.name} onChange={e => setEditClientForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Type</label>
              <select className={inp} style={inpStyle} value={editClientForm.type} onChange={e => setEditClientForm(f => ({ ...f, type: e.target.value }))}>
                {CLIENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Website</label>
              <input className={inp} style={inpStyle} value={editClientForm.website} onChange={e => setEditClientForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
              <textarea rows={2} className={inp} style={inpStyle} value={editClientForm.notes} onChange={e => setEditClientForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest pt-1" style={{ color: "var(--psg-muted)" }}>Billing Details</p>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Billing Name</label>
              <input className={inp} style={inpStyle} value={editClientForm.billingName} onChange={e => setEditClientForm(f => ({ ...f, billingName: e.target.value }))} placeholder="Legal entity name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Billing Address</label>
              <textarea rows={3} className={inp} style={inpStyle} value={editClientForm.billingAddress} onChange={e => setEditClientForm(f => ({ ...f, billingAddress: e.target.value }))} placeholder="Full billing address" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Billing Email</label>
              <input type="email" className={inp} style={inpStyle} value={editClientForm.billingEmail} onChange={e => setEditClientForm(f => ({ ...f, billingEmail: e.target.value }))} placeholder="accounts@..." />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>Save</button>
              <button type="button" onClick={() => setEditingClient(null)} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AddClientModal({ clientForm, setClientForm, saveClient, setShowClientForm }: {
  clientForm: typeof BLANK_CLIENT;
  setClientForm: React.Dispatch<React.SetStateAction<typeof BLANK_CLIENT>>;
  saveClient: (e: React.FormEvent) => void;
  setShowClientForm: (show: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="rounded-xl shadow-2xl w-full max-w-md border" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--psg-card-border)" }}>
          <h2 className="font-semibold text-white">Add Client</h2>
          <button onClick={() => setShowClientForm(false)} className="text-xl leading-none hover:text-white" style={{ color: "var(--psg-muted)" }}>×</button>
        </div>
        <div className="px-5 py-4">
          <form onSubmit={saveClient} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Name *</label>
              <input required className={inp} style={inpStyle} value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Type</label>
              <select className={inp} style={inpStyle} value={clientForm.type} onChange={e => setClientForm(f => ({ ...f, type: e.target.value }))}>
                {CLIENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Website</label>
              <input className={inp} style={inpStyle} value={clientForm.website} onChange={e => setClientForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Notes</label>
              <textarea rows={2} className={inp} style={inpStyle} value={clientForm.notes} onChange={e => setClientForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest pt-1" style={{ color: "var(--psg-muted)" }}>Billing Details</p>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Billing Name</label>
              <input className={inp} style={inpStyle} value={clientForm.billingName} onChange={e => setClientForm(f => ({ ...f, billingName: e.target.value }))} placeholder="Legal entity name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Billing Address</label>
              <textarea rows={3} className={inp} style={inpStyle} value={clientForm.billingAddress} onChange={e => setClientForm(f => ({ ...f, billingAddress: e.target.value }))} placeholder="Full billing address" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--psg-muted)" }}>Billing Email</label>
              <input type="email" className={inp} style={inpStyle} value={clientForm.billingEmail} onChange={e => setClientForm(f => ({ ...f, billingEmail: e.target.value }))} placeholder="accounts@..." />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90" style={{ backgroundColor: "var(--psg-blue)" }}>Add Client</button>
              <button type="button" onClick={() => setShowClientForm(false)} className="border px-4 py-2 rounded text-sm hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
