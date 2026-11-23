"use client";

import { useState } from "react";
import ExportMenu from "@/components/ExportMenu";
import { exportAccommodationPDF, exportAccommodationXLSX } from "@/lib/exports";
import { confirmDialog } from "@/components/Dialogs";
import { F, Modal, Btns, inp, inpStyle, fmt, fmtShortDate, sendJson, useList, type CrewMember, type HotelBooking, type HotelInfo, type TabProps } from "../shared";

export default function AccommodationTab({ prod, reload }: TabProps) {
  const id = String(prod.id);
  const [allCrew] = useList<CrewMember>("/api/crew");
  const [allHotels] = useList<HotelInfo>("/api/hotels");
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [editBooking, setEditBooking] = useState<HotelBooking | null>(null);
  const BLANK_BOOKING = { hotelId: "", crewId: "", guestName: "", roomType: "", roomNumber: "", checkIn: "", checkOut: "", ratePerNight: "", totalCost: "", confirmationNo: "", isPaid: false, notes: "" };
  const [bookingForm, setBookingForm] = useState<typeof BLANK_BOOKING & { id?: number }>(BLANK_BOOKING);

  function closeBookingForm() {
    setShowBookingForm(false);
    setEditBooking(null);
    setBookingForm(BLANK_BOOKING);
  }

  async function saveBooking(e: React.FormEvent) {
    e.preventDefault();
    if (bookingForm.id) {
      await sendJson(`/api/hotel-bookings/${bookingForm.id}`, "PUT", bookingForm);
    } else {
      await sendJson(`/api/productions/${id}/hotel-bookings`, "POST", bookingForm);
    }
    closeBookingForm();
    reload();
  }

  async function deleteBooking(bid: number) {
    if (!await confirmDialog("Delete this booking?")) return;
    await fetch(`/api/hotel-bookings/${bid}`, { method: "DELETE" });
    reload();
  }

  async function toggleBookingPaid(b: HotelBooking) {
    await sendJson(`/api/hotel-bookings/${b.id}`, "PUT", { ...b, isPaid: !b.isPaid, checkIn: b.checkIn.slice(0, 10), checkOut: b.checkOut.slice(0, 10) });
    reload();
  }

  function openEditBooking(b: HotelBooking) {
    setBookingForm({ ...b, id: b.id, hotelId: String(b.hotelId), crewId: b.crewId ? String(b.crewId) : "", guestName: b.guestName ?? "", roomType: b.roomType ?? "", roomNumber: b.roomNumber ?? "", checkIn: b.checkIn.slice(0, 10), checkOut: b.checkOut.slice(0, 10), ratePerNight: b.ratePerNight ? String(b.ratePerNight) : "", totalCost: b.totalCost ? String(b.totalCost) : "", confirmationNo: b.confirmationNo ?? "", notes: b.notes ?? "" });
    setEditBooking(b);
    setShowBookingForm(true);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {prod.hotelBookings.length > 0 && (
            <div className="flex gap-4 text-sm">
              <span style={{ color: "var(--psg-muted)" }}>Total cost: <span className="text-white font-medium">{fmt(prod.hotelBookings.reduce((s, b) => s + (b.totalCost ?? 0), 0))}</span></span>
              <span style={{ color: "var(--psg-muted)" }}>Paid: <span className="text-green-400 font-medium">{prod.hotelBookings.filter((b) => b.isPaid).length} / {prod.hotelBookings.length}</span></span>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <ExportMenu actions={[
              { label: "Export PDF", onClick: () => exportAccommodationPDF(prod.name, prod.hotelBookings, prod.logoUrl) },
              { label: "Export Excel", onClick: () => void exportAccommodationXLSX(prod.name, prod.hotelBookings) },
            ]} />
            <button onClick={() => { setBookingForm(BLANK_BOOKING); setEditBooking(null); setShowBookingForm(true); }} className="text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--psg-blue)" }}>
              + Add Booking
            </button>
          </div>
        </div>

        {prod.hotelBookings.length === 0 ? (
          <p className="text-center py-10" style={{ color: "var(--psg-muted)" }}>No accommodation booked for this production yet.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--psg-card-bg)", borderColor: "var(--psg-card-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--psg-card-border)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <th className="px-4 py-3 text-left font-medium text-white">Guest</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Hotel</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Room</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Check In</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Check Out</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Nights</th>
                  <th className="px-4 py-3 text-right font-medium text-white">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Ref</th>
                  <th className="px-4 py-3 text-left font-medium text-white">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {prod.hotelBookings.map((b) => {
                  const nights = Math.round((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / (1000 * 60 * 60 * 24));
                  const guestLabel = b.crew ? b.crew.name : (b.guestName || "Unassigned");
                  return (
                    <tr key={b.id} className="border-t hover:bg-white/5 transition-colors group" style={{ borderColor: "var(--psg-card-border)" }}>
                      <td className="px-4 py-3">
                        <p className={`font-medium ${b.crew || b.guestName ? "text-white" : ""}`} style={!b.crew && !b.guestName ? { color: "var(--psg-muted)" } : {}}>
                          {guestLabel}
                        </p>
                        {b.crew && <p className="text-xs mt-0.5" style={{ color: "var(--psg-muted)" }}>{b.crew.discipline}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white">{b.hotel.name}</p>
                        {b.hotel.city && <p className="text-xs" style={{ color: "var(--psg-muted)" }}>{b.hotel.city}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>
                        {b.roomType && <div>{b.roomType}</div>}
                        {b.roomNumber && <div>Room {b.roomNumber}</div>}
                        {!b.roomType && !b.roomNumber && "—"}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>{fmtShortDate(b.checkIn)}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>{fmtShortDate(b.checkOut)}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--psg-muted)" }}>{nights}</td>
                      <td className="px-4 py-3 text-right font-medium text-white">{b.totalCost ? fmt(b.totalCost) : b.ratePerNight ? fmt(b.ratePerNight * nights) : "—"}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--psg-muted)" }}>{b.confirmationNo || "—"}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleBookingPaid(b)} className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.isPaid ? "bg-green-900/60 text-green-300" : "bg-white/10 text-white/50"}`}>
                          {b.isPaid ? "Paid" : "Unpaid"}
                        </button>
                      </td>
                      <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-2">
                          <button onClick={() => openEditBooking(b)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                          <button onClick={() => deleteBooking(b.id)} className="text-xs text-red-400 hover:text-red-300">×</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showBookingForm && (
        <Modal title={editBooking ? "Edit Booking" : "Add Booking"} onClose={closeBookingForm}>
          <form onSubmit={saveBooking} className="space-y-3">
            <F label="Hotel *">
              <select required className={inp} style={inpStyle} value={bookingForm.hotelId} onChange={(e) => setBookingForm((f) => ({ ...f, hotelId: e.target.value }))}>
                <option value="">— select hotel —</option>
                {allHotels.map((h) => <option key={h.id} value={h.id}>{h.name}{h.city ? ` · ${h.city}` : ""}</option>)}
              </select>
            </F>
            <F label="Assign to Crew Member">
              <select className={inp} style={inpStyle} value={bookingForm.crewId} onChange={(e) => setBookingForm((f) => ({ ...f, crewId: e.target.value, guestName: e.target.value ? "" : f.guestName }))}>
                <option value="">— unassigned —</option>
                {allCrew.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.discipline}</option>)}
              </select>
            </F>
            {!bookingForm.crewId && (
              <F label="Guest Name (if not in crew database)">
                <input className={inp} style={inpStyle} value={bookingForm.guestName} onChange={(e) => setBookingForm((f) => ({ ...f, guestName: e.target.value }))} placeholder="Leave blank for block booking" />
              </F>
            )}
            <div className="grid grid-cols-2 gap-3">
              <F label="Check In *"><input required type="date" className={inp} style={inpStyle} value={bookingForm.checkIn} onChange={(e) => setBookingForm((f) => ({ ...f, checkIn: e.target.value }))} /></F>
              <F label="Check Out *"><input required type="date" className={inp} style={inpStyle} value={bookingForm.checkOut} onChange={(e) => setBookingForm((f) => ({ ...f, checkOut: e.target.value }))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Room Type"><input className={inp} style={inpStyle} value={bookingForm.roomType} onChange={(e) => setBookingForm((f) => ({ ...f, roomType: e.target.value }))} placeholder="e.g. Double, Twin" /></F>
              <F label="Room Number"><input className={inp} style={inpStyle} value={bookingForm.roomNumber} onChange={(e) => setBookingForm((f) => ({ ...f, roomNumber: e.target.value }))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Rate Per Night (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={bookingForm.ratePerNight} onChange={(e) => setBookingForm((f) => ({ ...f, ratePerNight: e.target.value }))} /></F>
              <F label="Total Cost (£)"><input type="number" step="0.01" className={inp} style={inpStyle} value={bookingForm.totalCost} onChange={(e) => setBookingForm((f) => ({ ...f, totalCost: e.target.value }))} /></F>
            </div>
            <F label="Confirmation / Ref No."><input className={inp} style={inpStyle} value={bookingForm.confirmationNo} onChange={(e) => setBookingForm((f) => ({ ...f, confirmationNo: e.target.value }))} /></F>
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input type="checkbox" checked={bookingForm.isPaid} onChange={(e) => setBookingForm((f) => ({ ...f, isPaid: e.target.checked }))} />
              Paid
            </label>
            <F label="Notes"><textarea rows={2} className={inp} style={inpStyle} value={bookingForm.notes} onChange={(e) => setBookingForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            <Btns onCancel={closeBookingForm} label={editBooking ? "Save Changes" : "Add Booking"} />
          </form>
        </Modal>
      )}
    </>
  );
}
