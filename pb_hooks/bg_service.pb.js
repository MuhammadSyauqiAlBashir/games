/// <reference path="../pb_data/types.d.ts" />
// CLI: pocketbase games-service <credentials-file>
// The file holds two lines: username, then password (32+ chars). Creates or
// resets a BashGames machine login with role `games`. Delete the file afterwards.
$app.rootCmd.addCommand(new Command({
  use: "games-service",
  short: "create or reset the BashGames machine login (role games)",
  run: (cmd, args) => {
    if (args.length !== 1) throw new Error("usage: games-service <credentials-file>")
    const raw = $os.readFile(args[0])
    const text = typeof raw === "string" ? raw : String.fromCharCode(...raw)
    const [username, password] = text.split("\n").map((s) => s.trim())
    if (!/^[a-z0-9_]{3,32}$/.test(username || "")) throw new Error("bad username")
    if (!password || password.length < 32) throw new Error("password must be at least 32 characters")
    const users = $app.findCollectionByNameOrId("users")
    let record
    try {
      record = $app.findFirstRecordByData(users, "username", username)
    } catch (_) {
      record = new Record(users)
      record.set("username", username)
      record.set("email", username + "@service.bashgames.local")
    }
    record.set("approved", true)
    record.set("role", "games")
    record.setPassword(password)
    $app.save(record)
    console.log("bashgames login '" + username + "' saved (games)")
  },
}))
