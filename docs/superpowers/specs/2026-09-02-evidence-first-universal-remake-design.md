# Evidence-first universal video remake design

Date: 2026-09-02
Status: approved for implementation

## 1. Objective

Upgrade the universal remake workflow from an open-ended prose reconstruction into an evidence-first protocol that can describe arbitrary source videos without imposing a fixed narrative, marketing formula, action template, shot count, or product category.

The system must preserve what is actually observable in each source video, bind replacement identities without losing action structure, compile a concrete generation prompt, support batch variants and long-video segmentation, and separately judge provider completion and remake fidelity.

The governing principle is:

> Fix the extraction and verification protocol, not the content of the video.

## 2. Current failure mode

The current schema permits open-ended `structuralInvariants`, but it does not prove that the understanding model inspected all potentially decisive dimensions. A model can therefore return a syntactically valid reconstruction while omitting orientation, source region, path, contact, release, multiplicity, or terminal state.

The prompt compiler then faithfully compiles an incomplete reconstruction. Reference images identify replacement objects but do not restore the missing motion topology. Provider success is currently treated as generation success even when the produced video materially differs from the source.

The observed regression demonstrates the issue:

- the source actor is back-facing and bent over;
- an object emerges from the lower-rear body region;
- it follows a downward path, contacts the receiver, separates from the actor, and changes state;
- the generated actor faces the camera;
- the replacement appears from the front abdomen and overlays multiple receiver objects;
- the terminal relationship differs from the source.

This is not a need for a special source-video template. It is evidence that the generic extraction protocol allowed decisive facts to be omitted.

## 3. Chosen approach

Use a universal capability catalog with a per-event coverage ledger.

The catalog defines what the system knows how to inspect. It does not assert that every dimension exists in every video. Each relevant dimension must explicitly be marked as one of:

- `observed`: supported by timestamped evidence;
- `not-observed`: inspected but absent;
- `not-applicable`: irrelevant to this event;
- `uncertain`: evidence is insufficient and the system must not guess.

No dimension may silently disappear. Only observed facts are compiled into generation instructions. Uncertain critical facts block template readiness.

This approach is selected over:

1. fully open-ended invariants, which are flexible but allow omissions;
2. a mandatory fixed field template, which prevents omissions but hallucinates irrelevant structure;
3. dense frame-by-frame captions, which are expensive, noisy, and do not reliably express causal or relational structure.

## 4. Universal extraction capability catalog

The initial catalog covers the following families. Families are inspection capabilities, not required source content.

### 4.1 Entity and identity

- stable entity tracking across time;
- physical instance count;
- aliases and source identity terms;
- object category and behavioral role;
- distinction between one object shown from multiple angles and multiple physical objects;
- appearance, material, color, pattern, and identity-critical geometry.

### 4.2 Time and event boundaries

- event start and end;
- shot and semantic boundaries;
- action onset, transition, contact, release, and completion;
- overlap and concurrency;
- rhythm and dwell time.

### 4.3 Spatial geometry

- screen region and depth order;
- relative position among entities;
- facing direction and orientation;
- source region and destination region;
- entry and exit regions;
- framing and scale.

### 4.4 Pose, shape, and deformation

- body or object pose;
- articulation and posture;
- bend, compression, stretch, rotation, or other deformation;
- pose changes that determine action readability.

### 4.5 Motion and path

- actor, affected object, and receiver;
- motion direction, path, speed profile, acceleration, and rhythm;
- continuous versus discontinuous movement;
- camera-relative and object-relative motion;
- release and settling behavior.

### 4.6 Relations and contact

- touch, grip, pull, push, carry, insert, attach, detach, collide, cover, reveal, enter, exit, and occlude;
- contact participants and contact region;
- before, during, and after relation states;
- causality when observable.

Relation labels remain extensible. The model may produce a new evidence-grounded predicate rather than forcing an unsupported label.

### 4.7 State transitions

- visibility and existence state;
- location and containment;
- assembly or attachment;
- material or physical state;
- condition before and after the event;
- terminal state required for continuity.

### 4.8 Camera and edit grammar

- shot size, camera position, angle, and movement;
- focus and depth of field;
- cuts, transitions, speed ramps, and continuity;
- static camera when that is itself decisive.

### 4.9 Scene and visual treatment

- environment, lighting, palette, texture, and atmosphere;
- effects that are actually observed;
- background elements relevant to action or continuity.

### 4.10 Text, dialogue, sound, and synchronization

- visible text and its timing;
- dialogue or voiceover;
- sound effects and music cues;
- audiovisual synchronization points;
- silence when structurally relevant.

## 5. Evidence model

Every observed fact must include:

- an ID;
- a capability family and extensible dimension name;
- a predicate-like description using entity placeholders;
- participating placeholders and their semantic roles;
- start and end timestamps;
- one or more evidence anchors;
- importance: `critical` or `supporting`;
- confidence;
- source state and resulting state when a transition occurs.

An evidence anchor may point to:

- the native source video and a time range;
- one or more extracted frames;
- a short source clip around an event boundary;
- audio or text evidence.

Contact sheets remain a compact overview, not the sole evidence source. Critical transitions should be enriched with focused frames or short clips around onset, contact, release, and completion.

## 6. Dynamic event graph

The reconstruction output is an ordered event graph rather than a collection of prose scenes.

Each event represents:

1. initial observable state;
2. actor and affected entities;
3. ordered micro-transitions;
4. motion and relation changes;
5. terminal observable state;
6. continuity requirements at the boundary.

Events may be quiet, static, continuous, montage-based, conversational, procedural, product-focused, or otherwise. The graph does not require a hook, conflict, reveal, proof, CTA, or any other marketing taxonomy.

## 7. Multi-pass reconstruction

### Pass 1: global reconstruction

Analyze the native video and overview evidence to discover entities, shots, events, audio, text, and candidate decisive transitions.

### Pass 2: evidence enrichment

For each candidate critical event, inspect focused evidence around the event. Resolve instance count, orientation, source/destination regions, path, contact, release, terminal state, and continuity when applicable.

### Pass 3: independent coverage verification

A separate verification request receives the source evidence, reconstruction, and capability ledger. It must detect:

- unchecked dimensions;
- unsupported claims;
- missing decisive facts;
- identity leakage;
- timeline gaps or overlaps;
- inconsistent instance counts;
- impossible start/end continuity;
- contradictions between direction, facts, and evidence.

It may repair only evidence-grounded omissions or contradictions. It may not re-plan the video.

### Readiness gate

A reconstruction is executable only when:

- the timeline covers the exact source duration;
- all capability families have an explicit coverage result per relevant event;
- every critical fact has evidence;
- no critical fact is uncertain;
- entity multiplicity is resolved;
- continuity is valid;
- verification is `verified` or `repaired`.

## 8. Replacement and affordance adaptation

Replacement references define identity and appearance. They do not independently create story, motion, or extra physical instances.

The binding system must normalize multi-view product references into one physical entity unless the user explicitly requests multiple instances.

The remake preserves:

- event order and timing;
- participant roles;
- pose and orientation when decisive;
- motion direction and path topology;
- contact and release sequence;
- causal relationship;
- camera and edit grammar;
- continuity.

When source and replacement affordances conflict, the system may perform a constrained functional-equivalence adaptation:

- preserve the source action topology, pose, direction, timing, and causality;
- adapt only the object-specific terminal state needed for the replacement to function;
- never replace the action with an unrelated convenient action;
- record the adaptation explicitly in the bound template and verify it separately.

Example: a source object's terminal state of heating inside a receiver may become a phone case completing attachment to a phone, while the preceding emergence, movement, contact, release, timing, and camera structure remain source-grounded.

## 9. Concrete reverse-engineered prompt compiler

The compiler must not pass vague prose such as “保持原视频动作” to the generation model. It compiles a timed executable instruction for every segment.

Each compiled segment contains:

1. exact source and target time range;
2. entity manifest and physical instance count;
3. initial layout, facing direction, pose, and state;
4. ordered micro-transitions with timestamps;
5. actor, affected object, source region, destination region, path, contact, release, and terminal state where observed;
6. camera and edit behavior;
7. visible text and audio synchronization where observed;
8. continuity-in and continuity-out state;
9. replacement identity mapping;
10. any approved functional-equivalence adaptation;
11. evidence-derived negative constraints preventing the most likely structural errors.

Prompt priority is:

1. critical action and relation topology;
2. identity and physical instance consistency;
3. timing and continuity;
4. camera and scene fidelity;
5. supporting visual treatment.

The compiler only emits facts marked `observed` and verified. `not-observed`, `not-applicable`, and `uncertain` entries are never turned into invented visual instructions. Negative constraints are derived from verified contrasts, such as “back-facing, do not turn to camera” or “one receiver instance, do not duplicate,” rather than a global fixed negative-prompt list.

## 10. Long-video and batch behavior

Long videos are split only at safe evidence-backed boundaries or continuation points. A source event is not cut in the middle merely to fit a fixed cadence. When an event exceeds the model limit, continuity facts and continuation references preserve its state across generated segments.

Each batch candidate uses the same verified event graph and may vary only approved variable slots, references, seeds, or explicit patches. A template can produce 1–1000 candidates without re-analyzing the source for every candidate.

Batch submission remains cost-aware. Provider success, composition success, and fidelity pass are separate statuses.

## 11. Post-generation fidelity QA

Every generated output is re-analyzed with the same capability catalog and dynamic event graph protocol.

The system compares source/bound target facts with generated facts and reports:

- matched critical facts;
- missing events;
- reversed orientation or direction;
- wrong source or destination region;
- broken contact or release;
- duplicated or missing entities;
- wrong terminal state;
- timing drift;
- camera or continuity mismatches;
- allowed functional-equivalence adaptations.

A provider-completed video may be marked `generated-but-fidelity-failed`. It must not be presented as a successful remake. Automatic paid retries remain disabled unless explicitly enabled by the user or batch policy; the UI exposes a corrected retry prompt based on the fidelity diff.

The final media is trimmed or composed to the requested target duration within tolerance even if a provider accepts only integer-second requests.

## 12. UI behavior

The user sees:

- detected entities and physical instance count;
- replacement selection beside each replaceable entity;
- event timeline with concise human-readable facts;
- warnings only for unresolved critical facts;
- the compiled complete prompt in editable form;
- batch count and variant slots;
- generation status separate from fidelity status;
- fidelity failure reasons and corrected retry action.

The detailed capability ledger remains inspectable but is not required for normal operation.

## 13. Extensibility

Capability families and predicate dimensions are registry-driven. Adding a new observable dimension extends the catalog and validators without creating a new video-template branch.

Model adapters expose native video, frame, audio, continuation, duration, and reference-image capabilities. The reconstruction protocol remains provider-independent.

## 14. Acceptance criteria

1. No production rule mentions the regression video's product, character, container, or action as a special template.
2. The regression source produces evidence-backed facts for its actual orientation, pose, emergence region, path, contact, release, and terminal state.
3. A quiet static product video is not forced to contain actions or relations it does not have.
4. A talking-head, montage, try-on, ASMR process, one-take physical event, and product rotation can all pass through the same protocol.
5. Multi-view reference images do not create duplicate physical objects.
6. The compiled prompt contains concrete timed micro-transitions rather than generic style instructions.
7. Critical uncertainty blocks generation.
8. Provider success does not imply fidelity success.
9. Batch candidates reuse the verified source graph and preserve approved variation boundaries.
10. Long sources segment and compose without cutting unsafe event boundaries.

