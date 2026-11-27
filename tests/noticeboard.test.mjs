import { run, BASE } from "./lib.mjs";

// TWS noticeboard, build photos and build of the month. The space's team (here a freelancer
// whose company is the space) and PSG staff can post and vote; other companies can't see it.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

export default () => run("noticeboard", async ({ db, users, login, results }) => {
  const ok = (c, l) => results.push(`${c ? "PASS" : "FAIL"}  ${l}`);
  const [free, client, member, admin] = users;
  const a = await login(admin.email), m = await login(member.email), f = await login(free.email), c = await login(client.email);
  const json = r => r.json();
  const made = { entity: null, job: null };
  const form = (who, url, fields, files = [], type = "image/png") => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
    for (const b of files) fd.append("photos", new Blob([b], { type }), "p.png");
    return fetch(`${BASE}${url}`, { method: "POST", body: fd, headers: { cookie: who.cookie } });
  };
  try {
    made.entity = await db.entity.create({ data: { name: "Board test co", slug: "board-test", hasSpace: true } });
    made.job = await db.job.create({ data: { number: "J-2099-980", title: "Board test build", jobType: "workshop", entityId: made.entity.id } });
    await db.user.update({ where: { id: free.id }, data: { homeEntityId: made.entity.id } });
    const B = "/api/spaces/board-test/noticeboard";

    // Posting
    ok((await form(c, B, { kind: "notice", title: "Hi" })).status === 403, "someone from another company can't post");
    ok((await form(f, B, { kind: "notice" })).status === 400, "a post needs words or a photo");
    ok((await form(f, B, { kind: "photo", title: "No pic" })).status === 400, "a photo post needs a photo");
    ok((await form(f, B, { kind: "photo" }, [Buffer.from("<svg/>")], "image/svg+xml")).status === 400, "SVG refused");
    let r = await form(f, B, { kind: "notice", title: "Booth booked Thursday", body: "Spray booth is out 9–1" });
    const notice = await json(r);
    ok(r.status === 201 && notice.author?.id === free.id, "the space's team posts a notice");
    r = await form(f, B, { kind: "photo", title: "Frames welded" }, [PNG, PNG]);
    const photoPost = await json(r);
    ok(r.status === 201 && photoPost.photos?.length === 2 && photoPost.photos[0].url, "posts two photos");
    const img = await f(photoPost.photos[0].url);
    ok(img.status === 200 && img.headers.get("content-type") === "image/png", "the team can load the photo");
    ok((await c(photoPost.photos[0].url)).status === 403, "another company can't");

    // Pin and delete
    ok((await f(`/api/space-posts/${notice.id}`, { method: "PATCH", body: JSON.stringify({ pinned: true }) })).status === 403, "the team can't pin (staff only)");
    ok((await m(`/api/space-posts/${notice.id}`, { method: "PATCH", body: JSON.stringify({ pinned: true }) })).status === 200, "PSG staff pin a notice");
    let board = await json(await f(B));
    ok(board.posts?.[0]?.id === notice.id && board.posts[0].pinned, "pinned post comes first");
    ok((await m(`/api/space-posts/${photoPost.id}`, { method: "DELETE" })).status === 403, "only the author or an admin deletes a post");
    ok((await f(`/api/space-posts/${photoPost.id}`, { method: "DELETE" })).status === 200, "the author deletes their post");
    ok((await db.spacePhoto.count({ where: { id: { in: photoPost.photos.map(p => p.id) } } })) === 0, "its photos go with it");

    // Build photos and build of the month
    r = await form(m, `/api/jobs/${made.job.id}/photos`, { caption: "Truck frames" }, [PNG]);
    const jp = await json(r);
    ok(r.status === 201 && jp.length === 1 && jp[0].caption === "Truck frames", "a build photo is added");
    ok((await form(c, `/api/jobs/${made.job.id}/photos`, {}, [PNG])).status === 403, "another company can't add build photos");
    board = await json(await f(B));
    ok(board.botm?.nominees?.some(n => n.job.id === made.job.id), "a build with a photo this month is up for build of the month");
    ok((await f("/api/spaces/board-test/vote", { method: "POST", body: JSON.stringify({ jobId: 999999 }) })).status === 400, "can't vote for a build that isn't nominated");
    let v = await json(await f("/api/spaces/board-test/vote", { method: "POST", body: JSON.stringify({ jobId: made.job.id }) }));
    ok(v.myVote === made.job.id && v.nominees[0].votes === 1, "the team votes");
    v = await json(await f("/api/spaces/board-test/vote", { method: "POST", body: JSON.stringify({ jobId: made.job.id }) }));
    ok(v.nominees[0].votes === 1, "one vote each (voting again doesn't add)");
    ok((await c("/api/spaces/board-test/vote", { method: "POST", body: JSON.stringify({ jobId: made.job.id }) })).status === 403, "another company can't vote");

    // Share a build photo to the board
    r = await m(`/api/space-photos/${jp[0].id}/share`, { method: "POST", body: "{}" });
    const shared = await json(r);
    ok(r.status === 201 && shared.photos?.[0]?.id === jp[0].id && shared.job?.id === made.job.id, "a build photo is shared to the noticeboard");
    ok((await m(`/api/space-photos/${jp[0].id}/share`, { method: "POST", body: "{}" })).status === 409, "only shared once");
    ok((await a(`/api/space-posts/${shared.id}`, { method: "DELETE" })).status === 200, "an admin deletes the shared post");
    ok((await db.spacePhoto.count({ where: { id: jp[0].id } })) === 1, "the build photo stays on the build");

    // Pages
    const list = await json(await f("/api/spaces"));
    ok(Array.isArray(list) && list.some(s => s.slug === "board-test" && s.botm), "Fun Corner gets the spaces' build of the month");
    ok(!(await json(await c("/api/spaces"))).some(s => s.slug === "board-test"), "…only for spaces you can open");
    const nb = await (await f("/spaces/board-test/noticeboard", { headers: { accept: "text/html" } })).text();
    ok(nb.includes("Workshop noticeboard") && nb.includes("Booth booked Thursday") && nb.includes("Build of the month"), "noticeboard page renders");
    const home = await (await a("/spaces/board-test", { headers: { accept: "text/html" } })).text(); // staff: freelancers go to My work
    ok(home.includes("Workshop noticeboard") && home.includes("Board test build"), "space home shows the noticeboard and build of the month");
    const fun = await (await f("/fun", { headers: { accept: "text/html" } })).text();
    ok(fun.includes("Build of the month"), "Fun Corner shows build of the month");
  } finally {
    await db.user.update({ where: { id: free.id }, data: { homeEntityId: null } }).catch(() => {});
    if (made.job) await db.job.delete({ where: { id: made.job.id } }).catch(() => {});
    if (made.entity) await db.entity.delete({ where: { id: made.entity.id } }).catch(() => {});
  }
});
