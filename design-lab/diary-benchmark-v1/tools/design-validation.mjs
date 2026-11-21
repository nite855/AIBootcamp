export function validateScreens(definition) {
  const {screens,devices,layouts} = definition;
  if (!Array.isArray(screens) || !screens.length) throw Error('Missing screens');
  const ids = new Set();
  const types = new Set(['write','card','archive','detail','edit','settings','trend','count','distribution','filtered','catalog']);
  for (const s of screens) {
    if (!/^(WF|ST)-\d{2}$/.test(s.id) || ids.has(s.id)) throw Error(`Invalid/duplicate screen: ${s.id}`);
    if (typeof s.title !== 'string' || !s.title.trim() || typeof s.goal !== 'string' || !s.goal.trim() || !s.state || !types.has(s.type) || !layouts?.[s.layout]) throw Error(`Incomplete screen: ${s.id}`);
    if (!Array.isArray(s.regions) || !s.regions.length || !Array.isArray(s.actions)) throw Error(`Missing regions/actions: ${s.id}`);
    ids.add(s.id);
  }
  for (const s of screens) for (const a of s.actions) {
    if (!ids.has(a.target)) throw Error(`Unknown target: ${a.target}`);
    if (!Array.isArray(a.devices) || !a.devices.length || a.devices.some(d=>!['desktop','mobile'].includes(d))) throw Error(`Invalid action devices: ${s.id}`);
  }
  // The current SVG renderer has fixed geometry; reject unsupported sizes rather than clip silently.
  for (const [device,size] of Object.entries({desktop:[1366,768],mobile:[390,844]})) {
    if (JSON.stringify(devices?.[device]) !== JSON.stringify(size)) throw Error(`Unsupported wireframe viewport: ${device}`);
  }
  return definition;
}
