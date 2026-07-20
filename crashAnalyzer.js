// Turns a raw Minecraft crash/launch log into a short, plain-language
// explanation so users don't have to read a wall of stack traces.
function analyzeCrashLog(text) {
  const raw = String(text || "");
  const lower = raw.toLowerCase();

  if (lower.includes("outofmemoryerror") || lower.includes("java heap space")) {
    return "Ran out of memory. Try increasing allocated RAM in Settings.";
  }

  if (lower.includes("unsupportedclassversionerror") || lower.includes("has been compiled by a more recent version")) {
    return "This version needs a different Java version than the one being used.";
  }

  const modConflict = raw.match(/mod '([^']+)'[^\n]*(?:conflicts with|incompatible with)[^\n]*'([^']+)'/i);
  if (modConflict) {
    return `Mod "${modConflict[1]}" is conflicting with "${modConflict[2]}". Try removing one of them.`;
  }

  const missingDep = raw.match(/mod '([^']+)'[^\n]*requires[^\n]*'([^']+)'/i);
  if (missingDep) {
    return `Mod "${missingDep[1]}" requires "${missingDep[2]}", which is missing.`;
  }

  if (lower.includes("missing or unsupported mandatory dependencies")) {
    return "A required mod dependency is missing. Check your mods folder.";
  }

  if (lower.includes("failed to download") || lower.includes("connect timed out") || lower.includes("connection timed out")) {
    return "A download failed. Check your internet connection and try again.";
  }

  if (lower.includes("address already in use")) {
    return "Another Minecraft instance may already be running.";
  }

  return "Minecraft closed unexpectedly. Check the crash log for full details.";
}

module.exports = { analyzeCrashLog };
