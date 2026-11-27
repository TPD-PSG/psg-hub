"use client";

// Every new-look component with sample content, as the brief's stage 2 asks: so each can be checked
// (no emoji, 4.5:1 text contrast) before any page is built from them.
import { useState } from "react";
import { BriefcaseBusiness, CalendarDays, CheckSquare, Clapperboard, Hammer, HelpCircle, Home, Megaphone, PoundSterling, Plus, Settings, Wrench } from "lucide-react";
import {
  Avatar, Button, Chip, EmptyState, IconRail, ListRow, NavItem, NeedsYou, PageHeader, Panel, PinnedShortcut, SearchField, SectionMenu, Segmented, Sidebar, SpaceCard, StatTile,
} from "@/components/nl";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3">
    <h2 className="nl-caps m-0" style={{ fontSize: 12 }}>{title}</h2>
    {children}
  </section>
);

export default function Gallery() {
  const [seg, setSeg] = useState<"director" | "pm" | "office">("director");
  const [q, setQ] = useState("");
  return (
    <div className="flex flex-col gap-10 px-6 py-8 max-w-6xl">
      <div>
        <h1 className="m-0" style={{ fontSize: 30, fontWeight: 800 }}>New look components</h1>
        <p className="m-0 mt-1 text-sm" style={{ color: "var(--nl-text-muted)" }}>Stage 2 of the new look build brief. Every new-look page is built only from these. Sample content.</p>
      </div>

      <Section title="Sidebar and nav items">
        <div className="flex flex-wrap gap-6 items-start">
          <div>
            <Sidebar
              groups={[
                { items: <><NavItem href="#" icon={Home} label="Home" active /><NavItem href="#" icon={CheckSquare} label="My tasks" count={4} /><NavItem href="#" icon={Clapperboard} label="My productions" count={3} /></> },
                { label: "Work", items: <><NavItem href="#" icon={Clapperboard} label="Productions" count={12} /><NavItem href="#" icon={CalendarDays} label="Calendar and schedule" /><NavItem href="#" icon={BriefcaseBusiness} label="Jobs and quotes" /><NavItem href="#" icon={Megaphone} label="BD pipeline" count={7} /></> },
                { label: "Money", items: <NavItem href="#" icon={PoundSterling} label="Finance" count={2} /> },
                { label: "Company", items: <><NavItem href="#" icon={Wrench} label="Operations" /><NavItem href="#" icon={HelpCircle} label="Help and ideas" /><NavItem href="#" icon={Settings} label="Admin" /></> },
              ]}
            />
          </div>
          <div style={{ height: 520 }} className="flex">
            <IconRail items={[
              { href: "#", icon: Home, label: "Home" }, { href: "#", icon: CheckSquare, label: "My tasks" },
              { href: "#", icon: Clapperboard, label: "Productions", active: true }, { href: "#", icon: PoundSterling, label: "Finance" }, { href: "#", icon: Hammer, label: "The Workshop Stoke" },
            ]} />
            <SectionMenu active="schedule" hrefFor={k => `#${k}`} color="#e4572e" back={{ href: "#", label: "Productions" }} groups={[
              { label: "Plan", sections: [{ key: "overview", label: "Overview" }, { key: "schedule", label: "Schedule" }, { key: "tour", label: "Tour stops" }, { key: "advancing", label: "Advancing" }, { key: "callsheets", label: "Call sheets" }] },
              { label: "People", sections: [{ key: "crew", label: "Crew" }, { key: "contacts", label: "Contacts" }, { key: "accommodation", label: "Accommodation" }] },
              { label: "Money", sections: [{ key: "budget", label: "Budget" }] },
            ]} />
          </div>
        </div>
      </Section>

      <Section title="Page header">
        <PageHeader eyebrow="Production" title="Curious Incident of the Dog in the Night-Time"
          chips={<><Chip dot="#e4572e">Running</Chip><Chip>Tour</Chip><Chip>12 stops</Chip></>}
          team={[{ name: "Toby Davies" }, { name: "Tom Hughes" }, { name: "Sam Lee" }]}
          actions={<><Button kind="outline">Edit</Button><Button kind="outline">OneDrive folder</Button><Button icon={Plus}>Add</Button></>} />
      </Section>

      <Section title="Needs you strip (hidden when empty)">
        <NeedsYou items={[
          { href: "#", text: "Approve 2 expenses: Curious Incident", when: "Today" },
          { href: "#", text: "Task overdue: Send rooming list to Premier Inn", when: "Yesterday" },
          { href: "#", text: "Scenery: Build is over budget by £180", when: "2 days ago" },
        ]} />
      </Section>

      <Section title="Stat tiles">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatTile label="Live shows" value="7" line="3 touring · 4 in town" href="#" />
          <StatTile label="Weighted pipeline" value="£412k" line="14 open deals" />
          <StatTile label="Out this week" value="3" line="Get-outs Thu, Fri, Sun" />
          <StatTile label="Overspends" value="2" line="Lines over budget" tone="bad" />
        </div>
      </Section>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="md:col-span-3">
          <Section title="Panel with list rows">
            <Panel title="On today" more={{ href: "#", label: "Calendar" }} pad={false}>
              <ListRow href="#" dot="#e4572e" title="Curious Incident" line="Theatre Royal Bath · Performance 19:30" chip={<Chip>Show</Chip>} />
              <ListRow href="#" dot="#3f8f6b" title="Woking panto" line="New Victoria · Tech rehearsal" chip={<Chip tone="warn">Tech</Chip>} />
              <ListRow href="#" dot="#7a5ea8" title="Touring rostra" line="The Workshop Stoke · Build" chip={<Chip tone="good">On track</Chip>} />
            </Panel>
          </Section>
        </div>
        <div className="md:col-span-2">
          <Section title="Empty state">
            <Panel title="My tasks"><EmptyState title="Nothing on your list" line="Tasks from meetings and minutes land here." action={<Button kind="outline" icon={Plus}>Add a task</Button>} /></Panel>
          </Section>
        </div>
      </div>

      <Section title="Space cards">
        <div className="grid gap-3 md:grid-cols-3">
          <SpaceCard href="#" name="Production Solutions Group" line="7 live shows" />
          <SpaceCard href="#" name="The Workshop Stoke" line="4 builds in the workshop" ground="#f4efe6" ink="#1a1d21" rule="#c49a6c" />
          <SpaceCard href="#" name="Rentals & Crew" line="Coming" />
        </div>
      </Section>

      <Section title="Pinned shortcuts">
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
          <PinnedShortcut href="#" icon={Clapperboard} label="All productions" />
          <PinnedShortcut href="#" icon={PoundSterling} label="Expenses" />
          <PinnedShortcut href="#" icon={CalendarDays} label="Calendar" />
        </div>
      </Section>

      <Section title="Segmented control, search field, buttons, chips, avatars">
        <div className="flex flex-wrap items-center gap-4">
          <Segmented label="View" value={seg} onChange={setSeg} options={[{ value: "director", label: "Director" }, { value: "pm", label: "PM" }, { value: "office", label: "Office" }]} />
          <div style={{ width: 320 }}><SearchField value={q} onChange={setQ} placeholder="Search productions, venues, people…" /></div>
          <Button icon={Plus}>New production</Button>
          <Button kind="outline">Cancel</Button>
          <Button disabled>Saving…</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip>Planning</Chip><Chip tone="warn">Needs you</Chip><Chip tone="good">Paid</Chip><Chip tone="bad">Overdue</Chip><Chip dot="#e4572e">Curious Incident</Chip>
          <span className="ml-4 flex"><Avatar name="Toby Davies" /><span style={{ marginLeft: -8 }}><Avatar name="Rich Owen" /></span></span>
        </div>
      </Section>
    </div>
  );
}
