# GUNSHOT 🎯

A free 3D multiplayer FPS that runs in the browser. It has private rooms, team modes, 1v1 duels, 12 maps, gun powers, peeking, sliding, hiding spots, rebindable keys and mobile touch controls.

There is no build step and no server. These are plain HTML, CSS and JavaScript files.

## Deploy to GitHub Pages

1. Create a new GitHub repository, for example `gunshot`.
2. Upload **all** files and folders from this project, keeping the folder structure.
3. Go to **Settings → Pages → Build and deployment** and choose **Deploy from a branch**. Select `main` and `/ (root)`, then click **Save**.
4. After about a minute, the game is live at `https://<your-username>.github.io/gunshot/`.

> Open the game through the GitHub Pages link or any web server. Double-clicking `index.html` won't work, because browsers block JavaScript modules loaded from `file://`. To test on your own computer, run `python -m http.server` in the folder and open http://localhost:8000.

## Playing with friends

- Click **Private Room** to get a 5-letter code. Only people who have the code can join, and no bots are added unless the host adds them.
- Click **Copy invite** to copy a link like `…/?room=ABCDE`. Opening the link fills in the code automatically.
- The host chooses the mode, map, time limit, bots, **aim assist** and **fire mode** for everyone. Players can't turn these on for themselves.
- The host's browser runs the match, so the host should keep the tab open.

## Project structure

```
index.html            page layout (menus, lobby, HUD, touch buttons)
css/style.css         all styles (desktop + mobile)
js/config.js          ⭐ tuning: guns, powers, modes, maps, default keys, ADS config
js/main.js            entry point
js/state.js           shared runtime state
js/util.js            helpers
js/input.js           keyboard/mouse (rebindable) + touch controls
js/audio.js           synthesised sounds
js/world/layout.js    map layouts: walls, props, stairs/lookouts, hiding spots, bot nav grid
js/world/physics.js   collision, raycasts, hitboxes (incl. peeking), concealment
js/render/renderer.js three.js renderer, camera, lights
js/render/textures.js procedural textures and materials
js/render/world.js    builds the 3D world for a map
js/render/guns.js     detailed guns, gloved hands, soldier models
js/render/fx.js       particles, tracers, bullet holes
js/game/host.js       host-side lobby and match simulation, bots
js/game/client.js     prediction, snapshots, camera, HUD, render loop
js/game/net.js        PeerJS networking
js/ui/menu.js         home page, settings, key bindings, lobby
js/ui/ads.js          Google AdSense integration
privacy.html          privacy policy (AdSense requires one)
ads.txt               AdSense ads.txt template
```

## Common changes

- **Balance a gun:** edit `CLS` in `js/config.js` (damage, fire rate, magazine size, reload time, spread, power).
- **Add a map:**
  1. Add an entry to `MAPS` in `js/config.js`.
  2. Add an `else if (id === 'yourmap')` generator in `js/world/layout.js`. Reuse helpers such as `wallLine`, `room`, `lookout`, `hides` and `scatter`.
  3. Optionally add decorations in `decor()` in `js/render/world.js`.
- **Add a game mode:** add it to `MODES` in `js/config.js`, then handle its win rule in `hostTick()` in `js/game/host.js`.
- **Change the default keys:** edit `DEFAULT_KEYS` in `js/config.js`. Players can rebind keys in Settings → Controls.
