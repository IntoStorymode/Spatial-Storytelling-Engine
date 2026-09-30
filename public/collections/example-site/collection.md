---
type: collection
title: "Example Site"
subtitle: Two demo stories, one front door
cover: assets/cover.svg
stories:
  - "demo"
  - "splat-example"
---

This is a collection — the landing page of a site that holds more than one story.
It exists to do the job a bare directory of stories cannot: introduce the place,
the people, and how the material was gathered, before a reader picks somewhere to
start.

A collection is authored the same way as a story: a plain Markdown file with YAML
frontmatter, sitting next to its own assets. It lists the stories it introduces,
in the order it wants them read. The stories themselves know nothing about it, so
a story can belong to several collections, and deleting a collection never touches
a story.

The two stories below ship with the engine. The first is a mesh placeholder that
needs no download; the second is a small generated Gaussian splat. Nothing on this
page loads a 3D scan — that only happens when you open a story.
