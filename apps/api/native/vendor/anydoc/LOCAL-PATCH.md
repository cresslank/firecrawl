# Temporary zip 9 dependency patch

This is the **anydoc 0.2.2** library already selected by Firecrawl's native
`Cargo.lock`, not a parser upgrade. All files under `src/` and `LICENSE` (MIT)
are byte-for-byte copies of the published crate:

- Source: <https://crates.io/api/v1/crates/anydoc/0.2.2/download>
- Archive SHA-256: `a95c753884402c05419e4d896d7978052fc7bbd4ca2b7e29697881f9aa08deb6`
- Upstream: <https://github.com/firecrawl/anydoc>

The published, normalized `Cargo.toml` has only these local changes:

- Require `zip = "9.0.5"` (Cargo's `^9.0.5`, excluding older vulnerable releases),
  retaining `default-features = false` and `features = ["deflate"]`.
- Omit the example target/include entry and release profile: only the library is
  vendored, and Firecrawl's root release profile controls the build. Replace the
  upstream README reference/include entry with this local provenance note.
- Point its provenance comment here. The upstream dev dependencies remain so the
  embedded library tests can still be exercised separately.

The upstream Markdown-renderer test contains an intentional trailing space in a
multiline expected string (`src/render/markdown/tests.rs:649`). Keep
that fixture byte-identical; check locally authored changes separately rather
than reformatting the vendored source to silence `git diff --check`.

## Why a path patch is necessary

As checked on 2026-10-31, crates.io's latest anydoc is 0.2.4 and still requires
`zip ^8.6.0`. Upstream `main` at
`e7178e099b6bf9171e2c52b832cbdb4134b69112` has the same requirement.
[PR #213](https://github.com/firecrawl/anydoc/pull/213) proposes zip 9.1.3 but
remains open; [PR #194](https://github.com/firecrawl/anydoc/pull/194) proposes
9.0.3, below our minimum. A direct Firecrawl zip upgrade alone would leave
anydoc's independent zip 8 dependency in the graph. The root
`[patch.crates-io]` replaces anydoc while changing none of its parser code.
The committed lockfile selects a single zip 9.1.3 for both consumers.

The minimum 9.0.5 addresses
[GHSA-m665-v7pm-7grj](https://github.com/advisories/GHSA-m665-v7pm-7grj), in
addition to the fixes in zip 9.0.0. This does not claim that every zip advisory
is reachable through Firecrawl's in-memory, deflate-only parsing path.

## Retirement condition

Remove `vendor/anydoc` and the root `[patch.crates-io]` entry when a reviewed,
published anydoc release requires zip **>=9.0.5** and the resolved native
dependency graph contains **no older zip**. Update both manifests/lockfile and
rerun the native build, `cargo test --locked --features napi/dyn-symbols`, and
the API document-converter tests against the rebuilt addon. Keep the real
DOCX/XLSX/PPTX/ODT/EPUB conversion and malformed-archive coverage in
`src/document_tests.rs` when retiring this patch.
