# Why this exists

The Spatial Storytelling Engine is a tool for telling stories **inside** a 3D scan of a real place.
This document explains the thinking behind it: the problem it addresses, who it is for, the
principles it is built on, and how the engine relates to the larger platform it is a foundation for.

If you want to *use* it, start with the [README](../README.md) and
[Authoring a story](./AUTHORING.md). This page is the *why*.

---

## Places disappear. Stories disappear faster.

Urban change — demolition, redevelopment, gentrification — has always outpaced documentation. What
is new is that the tools to document now exist at the community level. What is missing is a tool
designed around **storytellers, not surveyors**.

Architects, journalists, oral historians and residents carry knowledge of places that institutional
archives never capture: the texture of a building, the way light enters a particular room, the
memory of who lived there and what happened. This knowledge is fragile. It exists in people, not in
systems, and it disappears when people leave or when buildings come down.

The platforms that exist for 3D capture — Matterport, Scaniverse, Polycam — are built around **the
scan as a deliverable**. They solve a professional documentation problem. They do not solve a
storytelling problem; the story is an afterthought, if it exists at all.

Community-led heritage projects run in the opposite direction: rich in narrative, thin on spatial
capture. Oral history archives, local documentation groups and independent journalists are recording
stories but not places. When the building comes down, the story loses its spatial anchor.

> The gap is not in the technology. It is in the workflow — the missing bridge between spatial
> capture and community narrative.

## Who it is for

People who have a story about a place and need somewhere to put it:

- **Community documentarians and local history groups** recording a building before it changes.
- **Oral historians** with recordings that mean more when you can stand where they were made.
- **Journalists** reporting on a site, who want readers inside it rather than looking at a photo.
- **Architects and conservators** whose scans currently end their life as a deliverable.
- **Residents** who know a place in ways no survey captures.

The common thread is that none of them should need a developer. If placing a waypoint and linking a
recording requires writing code, the tool has failed the people it is for.

## The scan is shared infrastructure; the story is the act of authorship

This is the idea the whole engine is built around, and it is worth unpacking.

A 3D scan is expensive to make and cheap to reuse. Treating it as a *deliverable* — one scan, one
owner, one output — wastes it. Treating it as **infrastructure** means a location is captured once
and then serves as the setting for any number of accounts of that place.

A building holds different truths for different people. The same building, documented by an
architect, remembered by a resident and reported on by a journalist, can carry all three stories at
once — without any one of them overwriting the others. The scan is the shared ground. The story is
what each person does with it.

## Two ways to tell it

Where the narrative sits *relative* to the scan produces two distinct modes. Both are valid, and
they suit different stories and different authors — which is why the engine ships both, reading the
same story file, switchable live without a reload.

**Page view — narrative _around_ the scan.** The story is a page: text, images, audio, video, with
the 3D scan as one rich element embedded in it. The reader reads and listens, and can step into the
scan at relevant moments. The narrative controls the pacing.

*Suits long-form journalism, stories spanning several locations, authors who write first and scan
second, and readers who would rather read than navigate.*

**Immersive view — narrative _inside_ the scan.** The story is experienced within the 3D space.
Advancing the story flies the camera to a waypoint and shows that section's content as an overlay.
The scan is the stage.

*Suits place-led storytelling, interiors and architectural detail, oral narrative tied to specific
spots, and museum-style presentation.*

Most tools make you choose one and commit. An author usually does not know which they want until
they have tried both with their own material.

## Principles

These come from the research the engine grew out of. Where the engine does not yet implement one,
that is said plainly rather than implied — an honest gap is more useful than a promise.

**1. Story as the primary unit.** Not a map of scans, but a collection of stories. Each story has
one author and one intent. A map, if it comes, is a browse mode — not the entry point.
*Implemented. There is no map browse; the engine is story-first by construction.*

**2. Shared scan infrastructure.** A location's scan is captured once and reused freely, so several
contributors can tell different stories about one place without duplicating the spatial data.
*Partly implemented. The story format is deliberately separate from the model, so one scan can back
many stories — but today each exported story bundles its own copy. Deduplicating across stories
needs a shared asset store, which is a platform concern.*

**3. Open formats, portable data.** No lock-in. A story is `story.md` plus plain asset files, and
what you export is a complete, self-contained website. *Implemented, and treated as the project's
central commitment — see below.*

**4. Multiple voices, one place.** A place holds different truths for different people, and the
tool should hold all of them simultaneously. *Not implemented in the engine. It has no concept of
multiple authors sharing a scan; that requires shared storage and identity, which is a platform
concern.*

**5. Community authority.** Granular access control, the right to withdraw a contribution,
sensitive-content handling, per-item licensing — with the CARE Principles (Collective benefit,
Authority to control, Responsibility, Ethics) as a governance frame rather than an afterthought.
*Not implemented, and not implementable in a tool with no accounts or server. The engine's
contribution is narrower but real: because a story is plain files you hold, withdrawing one means
deleting a folder, and nobody else's permission is required.*

**6. Browser-first.** Most contributors and viewers are on a phone or a laptop. No installs, no
headset required; WebXR as an enhancement, never a prerequisite. *Implemented. A VR view ships with
every exported story, and nothing depends on it.*

## Data portability is the point

The most likely way a project like this betrays its users is not by disappearing. It is by making
their work impossible to take elsewhere.

So the format is deliberately dull. A story is a Markdown file with YAML frontmatter, sitting next
to its media in a folder. You can read it in a text editor, diff it, put it in version control, zip
it, email it, or archive it for twenty years. There is no database, no proprietary container, and
nothing that requires this software to open.

Exporting produces a complete static website — the whole story, its assets and a viewer — that runs
on any static host with no build step and no backend. If this project stopped tomorrow, every story
made with it would keep working.

That commitment is architectural, not legal. The MIT licence lets anyone fork this; nothing in it
obliges a fork to keep stories portable. We ask anyway, because portability is what makes the tool
worth trusting.

## The engine and the platform

The research this came from describes a **platform**: shared scans, many contributors, accounts,
governance, discovery. The engine is not that. It is deliberately smaller — one author, no backend,
no accounts, files on disk.

That is the foundation, not a compromise. Everything the platform vision needs — authoring, waypoint
binding, both reading modes, portable output — has to exist and be good before questions of shared
storage and governance are worth asking. Building it local-first means it stands entirely on its
own: usable today by one person with a laptop, with nothing to sign up for and nothing to pay.

The platform layer is an **extension**, and a flexible one. An organisation — a museum, an archive,
a newsroom, a university — has its own requirements for identity, storage, moderation and access
control, and those requirements differ enough that a single hosted answer would fit few of them
well. The engine is designed to sit underneath whatever an organisation needs to build or adopt: the
story format is a stable contract, and the viewer is a static site you can deploy anywhere.

The engine is maintained by [Into Storymode](https://intostorymode.com), who also work on
spatial storytelling projects and may offer hosted services in future. **The engine is MIT licensed
and stays that way.** It is not a trial version of something else, and it has no features withheld
to sell you a tier. If a hosted layer ever exists, it will be for people who want someone else to
run the servers — not for people who want the tool to work.

---

## Related

- **[README](../README.md)** — what it does and how to run it
- **[Authoring a story](./AUTHORING.md)** — the editor and the `story.md` format
- **[Publishing & sharing](./PUBLISHING.md)** — exporting and hosting a story
- **[Roadmap](../ROADMAP.md)** — what is being worked on
- **[Contributing](../CONTRIBUTING.md)** — issues, forks, and the portability request
