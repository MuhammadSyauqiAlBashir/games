/// <reference path="../pb_data/types.d.ts" />
// BashGames: collections prefixed `bg_`. Only the game service (machine login with
// role `games`) can touch them; players never talk to PocketBase directly.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const role = users.fields.getByName("role")
  if (!role.values.includes("games")) role.values = [...role.values, "games"]
  app.save(users)

  const G = "@request.auth.role = 'games'"
  const rules = { listRule: G, viewRule: G, createRule: G, updateRule: G, deleteRule: G }
  const created = () => ({ type: "autodate", name: "created", onCreate: true, onUpdate: false })
  const updated = () => ({ type: "autodate", name: "updated", onCreate: true, onUpdate: true })
  const text = (name, max = 500, extra = {}) => ({ type: "text", name, max, ...extra })
  const num = (name, extra = {}) => ({ type: "number", name, ...extra })
  const json = (name, maxSize = 200000) => ({ type: "json", name, maxSize })
  const bool = (name) => ({ type: "bool", name })
  const date = (name) => ({ type: "date", name })
  const rel = (name, coll, extra = {}) => ({ type: "relation", name, collectionId: coll.id, maxSelect: 1, cascadeDelete: false, ...extra })
  const make = (name, fields, indexes = []) => {
    const c = new Collection({ type: "base", name, ...rules, fields: [...fields, created(), updated()], indexes })
    app.save(c)
    return c
  }

  make("bg_kv", [text("key", 100, { required: true }), json("value", 2000000)], ["CREATE UNIQUE INDEX idx_bg_kv ON bg_kv (key)"])
  make("bg_events", [text("key", 200, { required: true })], ["CREATE UNIQUE INDEX idx_bg_events ON bg_events (key)"])
  make("bg_profiles", [
    rel("user", users, { required: true, cascadeDelete: true }), text("name", 40), text("avatar", 20), text("color", 20),
    text("lang", 5), json("prefs", 20000),
  ], ["CREATE UNIQUE INDEX idx_bg_profiles_user ON bg_profiles (user)"])
  const rooms = make("bg_rooms", [
    text("code", 8, { required: true }), text("game", 30, { required: true }), text("mode", 10), text("status", 20),
    text("host", 20), json("players", 50000), json("options", 50000), json("state", 5000000), num("seq", { onlyInt: true }),
  ], ["CREATE UNIQUE INDEX idx_bg_rooms_code ON bg_rooms (code)", "CREATE INDEX idx_bg_rooms_status ON bg_rooms (status)"])
  const matches = make("bg_matches", [
    text("game", 30, { required: true }), text("room", 8), text("mode", 10), json("players", 50000), json("winners", 5000),
    date("started"), date("ended"), num("duration", { onlyInt: true }), json("stats", 200000),
  ], ["CREATE INDEX idx_bg_matches_game ON bg_matches (game)", "CREATE INDEX idx_bg_matches_ended ON bg_matches (ended)"])
  const questions = make("bg_questions", [
    text("kind", 20, { required: true }), text("topic", 60), num("level", { onlyInt: true }), text("lang", 5),
    json("q", 50000), text("hash", 64, { required: true }), text("status", 20), text("source", 20),
    num("used", { onlyInt: true }), num("reports", { onlyInt: true }), date("last_used"), text("note", 1000),
  ], ["CREATE UNIQUE INDEX idx_bg_questions_hash ON bg_questions (hash)",
      "CREATE INDEX idx_bg_questions_pick ON bg_questions (kind, topic, level, lang, status)"])
  make("bg_reports", [
    rel("question", questions, { cascadeDelete: true }), rel("user", users, { cascadeDelete: true }), text("reason", 1000),
    text("room", 8), text("kind", 20), text("topic", 60), text("status", 20),
  ])
  make("bg_dares", [text("text", 300, { required: true }), text("lang", 5), text("source", 20), text("by", 40), bool("active")])
  make("bg_dare_log", [
    rel("match", matches, { cascadeDelete: true }), rel("user", users, { cascadeDelete: true }), text("game", 30),
    text("text", 300), bool("done"), date("done_at"),
  ])
  make("bg_wallets", [rel("user", users, { required: true, cascadeDelete: true }), text("day", 10, { required: true }),
    num("balance", { onlyInt: true })], ["CREATE UNIQUE INDEX idx_bg_wallets ON bg_wallets (user, day)"])
  make("bg_push_subs", [
    rel("user", users, { required: true, cascadeDelete: true }), text("endpoint", 1000, { required: true }),
    text("p256dh", 200, { required: true }), text("auth", 100, { required: true }), text("ua", 300),
  ], ["CREATE UNIQUE INDEX idx_bg_push ON bg_push_subs (endpoint)"])
  void rooms
}, (app) => {
  for (const n of ["bg_push_subs", "bg_wallets", "bg_dare_log", "bg_dares", "bg_reports", "bg_questions", "bg_matches",
    "bg_rooms", "bg_profiles", "bg_events", "bg_kv"]) { try { app.delete(app.findCollectionByNameOrId(n)) } catch (_) {} }
})
