# Pixel Playground Arcade

A collection of bite-sized JavaScript arcade games wrapped in a unified retro aesthetic. Each game is built with vanilla HTML, CSS, and JavaScript so they load instantly in the browser.

## Games

| Game | Genre | Description |
| ---- | ----- | ----------- |
| [2048](./2048/) | Swipe puzzle | Merge matching tiles until you reach the legendary 2048 block. |
| [Flappy Bird Remix](./flappy-bird/) | Reflex | Glide through neon pipes and keep the bird aloft to earn points. |
| [Connect Four](./connect-four/) | Tabletop duel | Challenge the arcade AI or a friend to line up four discs. |
| [Endless Runner](./endless-runner/) | Action | Dash through synthwave streets, avoiding obstacles to extend your run. |
| [Simple Mover](./simple_mover/) | Arcade trainer | Collect stars, dash through gaps, and dodge reactive walls. |
| [Block Drop](./tetris_knockoff/) | Falling blocks | Rotate and stack tetrominoes to clear lines and level up. |

## Running locally

Because everything is static, you can open `index.html` directly in a browser. For the best experience (and to avoid CORS restrictions in some browsers) run a small HTTP server:

```bash
cd javascript_games
python -m http.server 8000
```

Then visit [http://localhost:8000/](http://localhost:8000/) to access the arcade cabinet and launch any of the games.

## Project structure

```
javascript_games/
├── assets/             # Shared artwork and helper scripts
│   ├── js/
│   │   └── arcade.js   # Shared helpers (currently used for the footer year)
│   └── thumbnails/     # Game thumbnails for the homepage grid
├── arcade.css          # Global visual language shared by all pages
├── index.html          # Arcade homepage listing every available game
├── <game>/             # Individual game folders with their own HTML/CSS/JS
└── README.md
```

Each game remains self-contained so you can modify or extend them independently while retaining the cohesive shell provided by `arcade.css`.

## Contributing

Pull requests are welcome! Ideas include polishing gameplay, adding accessibility improvements, creating additional themes, or submitting new mini-games that fit the retro arcade vibe.
