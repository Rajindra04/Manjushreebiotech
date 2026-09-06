# Manjushree Biotech — website

A plain multipage static site — no build step, no backend. Works as-is on
GitHub Pages (or any static host), just like the Nirvana Biotech site this
was adapted from.

## Structure

```
index.html               Home
trading.html              Trading & Distribution
iso-consultation.html     ISO Consultation Services (Packages 01–03)
research.html             Research & Product Development (roadmap framing)
about.html                About
contact.html               Contact
styles.css                 Shared design system
site.js                    Mobile nav toggle only — no other JS dependency
```

## What's real vs. placeholder

The **ISO Consultation** page content (the three packages, the process,
the "how we work" checklist) is drawn directly from your proposal
document — that's real and ready to publish.

Everything else has placeholders clearly marked with a dashed note box
in the page itself, or obvious placeholder text:

- **Trading page**: product categories are a reasonable starting list,
  not your actual catalogue — confirm and replace with real product
  lines, brands, and suppliers.
- **Contact page**: email (`info@manjushreebiotech.com`), address
  ("Kathmandu, Nepal"), and the form are placeholders. The form doesn't
  send anywhere yet — wire it to a backend or a service like Formspree.
- **About page**: the team section is an empty template — add real
  names, roles, and bios.
- **Logo**: there's no image logo yet. The brand mark in the nav is a
  generated SVG seal ("MB") — swap in a real logo if you have one, or
  keep the seal as the brand mark.
- **Research & Development page**: framed as a roadmap/direction, not
  a funded program with commitments — adjust the stages to match your
  actual plans.

## Design

- **Palette**: slate-charcoal background, ledger-paper cream for
  contrast sections, brass accent, oxblood used sparingly (like a
  certification stamp).
- **Type**: Newsreader (serif headlines), IBM Plex Sans (body/UI),
  IBM Plex Mono (reference codes/labels — a nod to how ISO
  documentation is actually numbered).
- **Signature motif**: a "process rail" tracing the real four-stage
  ISO engagement pipeline from your proposal (Gap Assessment →
  Documentation → Implementation → Audit Readiness), used on the
  Home and ISO Consultation pages.

## Deploying

Push these files to the root of a GitHub Pages repo (or any static
host). No admin/CMS backend is included in this version — content
lives directly in the HTML, so edit the files to update copy.
