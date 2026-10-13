function migrateLegacyResearch() {
  const r = state.research;
  if (r.completed?.length && !Object.keys(r.levels || {}).length) {
    r.levels = Object.fromEntries(
      r.completed.map((id) => [
        id,
        RESEARCH.find((v) => v.id === id)?.maxLevel || 10,
      ]),
    );
    markStateChanged("research");
  }
}
