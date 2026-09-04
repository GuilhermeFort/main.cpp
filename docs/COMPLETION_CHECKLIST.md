# Detetives em Dupla — Completion Checklist

Definition of done: a feature counts as complete only after implementation, build/typecheck, production deploy, and runtime verification.

## Core
- [x] Rooms / cooperative base
- [x] Gemini 3.6 integration
- [x] Stable JSON generation path
- [x] Canonical case truth / anti-player-premise rules
- [x] Character-isolated conversation history

## Human simulation
- [x] Distinct linguistic fingerprints
- [x] Persistent psychology backend
- [x] Emotional reaction to pressure/evidence/blef
- [x] Individual memory
- [x] Gradual confession rules
- [x] Innocent lies / secondary secrets rules

## Investigation state
- [x] Persistent evidence inventory
- [x] Chain of custody backend
- [x] Timeline backend
- [x] Hypotheses backend
- [x] Private notes backend
- [x] Investigation task/forensics backend
- [x] Evidence presentation flow

## World systems
- [x] Canonical world API foundation
- [x] Locations/devices/cameras schema foundation
- [x] Search-location action foundation
- [x] Digital/camera action foundation
- [x] Authorization/legal action foundation
- [ ] Full visual room search experience
- [ ] Full visual camera browser
- [ ] Full visual device forensic browser
- [ ] Full interactive investigation map
- [ ] Full drag/drop police board

## Legal/final phase
- [x] Prosecutor review backend foundation
- [x] Final accusation backend foundation
- [x] Trial backend foundation
- [ ] Polished prosecutor UI
- [ ] Polished trial UI
- [ ] Detailed final score/replay UI

## Teacher → Student AI
- [x] Training-example storage
- [x] Importance/quality/novelty filtering foundation
- [x] Deduplication foundation
- [x] Feedback/correction storage
- [x] Student model version storage
- [x] Shadow-run executor foundation
- [x] Dataset export/API foundation
- [ ] External student model endpoint connected
- [ ] Actual weight-training pipeline connected
- [ ] Automated benchmark suite
- [ ] Promotion gates based on benchmark quality
- [ ] Gemini fallback percentage gradually reduced

## Production hardening
- [x] Next.js build/typecheck currently passing
- [x] Production deployment currently READY
- [x] Gemini generation repaired after JSON/timeout regressions
- [ ] Automated E2E smoke tests for critical user journeys
- [ ] Authorization/RLS audit for every new table/action
- [ ] Structured production logging/error IDs
- [ ] Rate limiting / abuse protection
- [ ] Backup/export strategy for training dataset
- [ ] Performance pass on mobile

## Final target
Do not call the project 100% until every unchecked item above is implemented and verified. Keep the game playable after each production deployment.
