# Shared Contracts

This directory contains the frozen shared contract surface for Chronos-Vox.

Current contract version:

`2026-03-24.v1`

## Goals

- give frontend and backend the same semantic vocabulary
- keep multi-agent work aligned
- make schema drift obvious

## Files

- `chronos-vox.ts`: TypeScript contract mirror for frontend and tooling
- `../schemas/*.schema.json`: machine-readable JSON Schemas
- `../fixtures/*`: golden fixtures for validation and onboarding

## Change Rules

- Treat these contracts as single-owner files.
- If you change a contract, update:
  - JSON Schema
  - typed mirror
  - golden fixtures
  - relevant validators
- Do not add fields casually.
- Prefer additive changes over breaking renames.

## Current Freeze Scope

The frozen baseline covers:

- raw comments
- normalized comments
- claim candidate spans
- claims
- viewpoints and viewpoint relations
- storylines and storyline relations
- published forecast bundle
- LLM audit entries
- model and heat-index reasoning payloads
