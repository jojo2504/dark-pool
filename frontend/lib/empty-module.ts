// Stub module used to silence optional peer dependencies that are not installed
// (e.g. pino-pretty, @react-native-async-storage/async-storage).
// Turbopack resolveAlias points these imports here so they resolve to nothing
// instead of triggering a missing-module error.
export default {};
