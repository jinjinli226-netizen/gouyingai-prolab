# ADR-0001: Add an isolated universal viral-remake module

## Status

Accepted

## Context

The existing viral-remake workflow is usable but contains fixed marketing abstractions and a creative planning stage that can alter source actions. Replacing it in place risks breaking current canvases and batch behavior. The new workflow must ship quickly, remain extensible, support 1–1000 candidates, and compose long videos from model-limited clips.

## Decision

Build an additive modular-monolith feature named `universal-viral-remake` in both Web and Gateway. Keep the existing workflow untouched. The Web core is provider-agnostic and pure TypeScript; a thin canvas adapter supplies video understanding and run submission. The Gateway runtime executes bounded candidate/segment jobs and FFmpeg composition. Expose the feature through a separate `通用复刻 Beta` entry until it is proven stable.

Long videos are split at semantic boundaries under the selected model's duration limit. Each candidate remains one logical result while its runtime may contain multiple segment jobs and one composition job.

## Consequences

### Positive

- Existing workflows and historical canvases remain stable.
- New logic is independently testable and can evolve without legacy schema constraints.
- Model compilers, fidelity rules, and composition policies are replaceable extension points.
- Short and long videos use the same template and batch model.

### Negative

- Two remake implementations coexist during the Beta period.
- A small amount of canvas and Gateway registration code is still required.
- Long-video runs cost multiple model calls and require local/server FFmpeg availability.

### Neutral

- Shared low-level generation and artifact services remain part of the same deployment.
- Migration from the old workflow is deferred until the Beta is validated.

## Alternatives Considered

- Modify the existing workflow in place: rejected because regression and migration risk are too high.
- Copy the existing workflow: rejected because legacy assumptions and maintenance duplication would persist.
- Create an independent microservice: rejected because deployment and operational complexity would slow the current product stage.

## References

- `docs/plans/2026-09-01-universal-viral-remake-module-design.md`
- `docs/plans/2026-09-01-universal-viral-remake-module.md`
