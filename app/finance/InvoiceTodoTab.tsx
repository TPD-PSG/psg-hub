// Finance "Invoice To-Do" tab: list of invoices still to generate, with add/edit form.
import type { Production } from "./financeTypes";
import { inp, inpStyle } from "./financeTypes";
import type { useInvoiceTodos } from "./financeHooks";

type Props = ReturnType<typeof useInvoiceTodos> & { productions: Production[] };

export default function InvoiceTodoTab({ todos, todoForm, setTodoForm, showTodoForm, setShowTodoForm, editTodo, setEditTodo, saveTodo, toggleTodoDone, deleteTodo, productions }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Invoices to generate</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>
            {todos.filter(t => !t.done).length} outstanding · {todos.filter(t => t.done).length} done
          </p>
        </div>
        <button onClick={() => { setEditTodo(null); setTodoForm({ client: "", description: "", productionId: "", amount: "", dueDate: "", notes: "" }); setShowTodoForm(true); }}
          className="text-sm px-4 py-2 rounded font-medium text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "var(--psg-blue)" }}>+ Add</button>
      </div>

      {showTodoForm && (
        <form onSubmit={saveTodo} className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-dark-bg)" }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Client *</label>
              <input required className={inp} style={inpStyle} value={todoForm.client} onChange={e => setTodoForm(f => ({ ...f, client: e.target.value }))} placeholder="Client name" />
            </div>
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Production</label>
              <select className={inp} style={inpStyle} value={todoForm.productionId} onChange={e => setTodoForm(f => ({ ...f, productionId: e.target.value }))}>
                <option value="">None</option>
                {productions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Description *</label>
            <input required className={inp} style={inpStyle} value={todoForm.description} onChange={e => setTodoForm(f => ({ ...f, description: e.target.value }))} placeholder="What is this invoice for?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Amount (£)</label>
              <input type="number" step="0.01" className={inp} style={inpStyle} value={todoForm.amount} onChange={e => setTodoForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Due by</label>
              <input type="date" className={inp} style={inpStyle} value={todoForm.dueDate} onChange={e => setTodoForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: "var(--psg-muted)" }}>Notes</label>
            <textarea rows={2} className={inp} style={inpStyle} value={todoForm.notes} onChange={e => setTodoForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded text-sm text-white font-medium" style={{ backgroundColor: "var(--psg-blue)" }}>{editTodo ? "Save" : "Add"}</button>
            <button type="button" onClick={() => { setShowTodoForm(false); setEditTodo(null); }} className="px-4 py-2 rounded text-sm border hover:bg-white/5" style={{ borderColor: "var(--psg-card-border)", color: "var(--psg-muted)" }}>Cancel</button>
          </div>
        </form>
      )}

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "var(--psg-card-bg)" }}>
        {todos.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: "var(--psg-muted)" }}>No invoices to generate — add one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                <th className="px-4 py-3 text-left font-medium text-white w-8"></th>
                <th className="px-4 py-3 text-left font-medium text-white">Client</th>
                <th className="px-4 py-3 text-left font-medium text-white">Description</th>
                <th className="px-4 py-3 text-left font-medium text-white">Production</th>
                <th className="px-4 py-3 text-right font-medium text-white">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-white">Due by</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--psg-card-border)" }}>
              {todos.map(t => (
                <tr key={t.id} className={`group hover:bg-white/5 transition-colors ${t.done ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={t.done} onChange={() => toggleTodoDone(t)}
                      className="w-4 h-4 rounded cursor-pointer accent-blue-500" />
                  </td>
                  <td className={`px-4 py-3 font-medium ${t.done ? "line-through" : "text-white"}`}>{t.client}</td>
                  <td className="px-4 py-3" style={{ color: "var(--psg-muted)" }}>{t.description}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{t.production?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-white">
                    {t.amount != null ? `£${t.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: t.dueDate && new Date(t.dueDate) < new Date() && !t.done ? "#ef4444" : "var(--psg-muted)" }}>
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditTodo(t); setTodoForm({ client: t.client, description: t.description, productionId: t.production ? String(t.production.id) : "", amount: t.amount != null ? String(t.amount) : "", dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "", notes: t.notes ?? "" }); setShowTodoForm(true); }}
                      className="text-xs mr-2" style={{ color: "var(--psg-muted)" }}>Edit</button>
                    <button onClick={() => deleteTodo(t.id)} className="text-xs text-red-400">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
