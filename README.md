# Landing Builder

A freeform, drag-and-drop landing page builder that runs on your own machine, built on [GrapesJS](https://github.com/GrapesJS/grapesjs).
Your pages are saved as ordinary files in the `pages/` folder.

## Run it

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The server only listens on your own computer (127.0.0.1), so nobody else on your network can reach it.
Keep the terminal window open while you work. `npm start` builds once and serves a faster production-style copy.
Change the port with `PORT=4000 npm run dev` (Windows PowerShell: `$env:PORT=4000; npm run dev`).

## How the page works

A page is a stack of **strips** (full-width bands). Inside a strip you can drop elements **anywhere** and drag them around freely.
On tablets and phones the strips stack automatically, so elements sit in one column in the order they were added.
Switch to the tablet or phone icon at the top to see this. To change the order on small screens, reorder elements in the **Layers** panel.

## Using it

- **Add** (left rail): pick a category, then drag an item onto the page, or click it to drop it in. Search finds anything by name.
  Click **Generate section with AI** at the top of the Add panel to describe and generate custom sections on the fly (e.g. pricing tables, heroes, testimonials).
  Categories: Text, Buttons, Image and video, Boxes and shapes, Icons, Cards, Forms, Interactive (FAQ accordion, tabs, countdown, custom HTML),
  Strips, and Ready-made sections (including an infinite-scrolling **Logo marquee**). Ready-made sections drop in as whole strips between other strips.
  The panel closes when you click on the page, and reopens from the left rail.
- **Move and resize:** press on an element and drag. Pink guides appear when edges or centers line up with the strip or other elements
  (hold **Alt** to turn snapping off). Use the handles around the selected element to resize. Arrow keys nudge by 1 pixel, **Shift + arrow** by 10.
  Drag the bottom handle of a strip to make it taller or shorter.
- **Edit text:** click any text and the **Edit text** window opens. Font, size, color, bold, italic, underline, strikethrough, alignment,
  line height, letter spacing, capitals, exact position and width, and bring forward / send back, all in one place.
  Use **Magic Rewrite** (✨) to enhance selected text or headlines with AI presets (punchy headline, shorten, persuasive, professional, fix grammar) or custom prompts.
  Double-click the text to type, and select words to format only those words. The window can be dragged out of the way.
- **FAQ:** add the FAQ accordion from Interactive. Select it and the **Questions and answers** window opens: type each question and answer,
  add new ones, move them up or down, or delete them. You can also type straight into the page.
- **Pages:** the tabs along the top are your open pages. Click `+` to add a page, click a tab to switch (the page you leave is saved first),
  and close a tab with its x (the page stays saved). The **Pages** panel lists every page with duplicate, rename, delete and page settings.
- **Design panel** (top bar): every other style option for the selected element, such as backgrounds with gradients, borders, shadows and spacing,
  plus the Settings tab for things like a link address or image text.
- Changes **autosave** about a second after you stop. `Ctrl+S` / `Cmd+S` saves immediately. **Preview** opens the finished page in a new tab.

## Images, video and maps

Add > **Image & video** has Image, Wide image, Round image, YouTube video and Google map.
- **Replace a picture:** double-click it, then drop a file into the picker (or click it to browse). Double-click the uploaded picture in the list to use it. Uploads are saved in `pages/<page>/assets/`.
  Select the picture and open Design panel > Settings to write its description (alt text).
- **Video:** select it, then open Design panel > Settings. The **Video source** box accepts:
  a link to a video file on the internet (.mp4, .webm and so on), a YouTube or Vimeo link, a Google Drive share link, a Dropbox share link,
  or **Upload a video from this computer** (copies the file into `pages/<page>/assets/`, so it plays here and on the finished page).
  Videos you uploaded earlier are listed so you can reuse them. A file path such as `C:\Users\you\Videos\clip.mp4` cannot work on a web page, so use Upload instead.
  Google Drive videos play through Drive's own player, and the file must be shared as "Anyone with the link".
  MP4 (H.264) or WebM plays everywhere. Autoplay, loop, controls and muted are tick boxes under the box.
- **Put a video (or any element) inside an existing div or section:** drag it from the Add panel and hold it over that div. The div is outlined while you hover, and the element drops inside it at the spot you point to (top, between two elements, or bottom). It flows with the div's content, full width and 16:9 for video and maps, and stacks naturally on phones. Or select the div (or any element in it) and **click** the item in the Add panel: it goes inside the selected div at the end, or right after the selected element.
  This works on ready-made sections, imported pages and AI-built pages. Inside a **Container** or a **strip** the element is instead free-floating, so you can place it anywhere. To move it later, drag it by the Layers panel, or use the arrow on its toolbar to select the parent.
- **Map:** select it, then Design panel > Settings and type an address. Choose Roadmap or Satellite, and the zoom level.

## Animations

Select any element (or strip), then open the **Animate** tab (the lightning bolt on the selection toolbar, the Animate button in the text window, or Design panel > Animate).
Press **Preview motion** in the top bar to see everything play on the page. Press it again, or Esc, to go back to editing.

| Animation | What it does | Where to set it |
| --- | --- | --- |
| **Entrance** | Fade in, slide up/down/left/right, zoom, or a wipe reveal when the element first scrolls into view. Duration, delay, easing, distance, optional "play every time". | Entrance |
| **Hover** | A list of effects that run while the pointer is over the element and reverse when it leaves. Each effect picks a target (the element itself or anything inside it) and an action: change background or text color, rotate (360 for a full spin), fade in from hidden, fade out, set opacity, move, scale. | Hover |
| **Click** | The same effects, run on click. Clicking again undoes them (a toggle). "Quick set-up" moves every image inside a container away from the centre in one click. | Click |
| **Scroll** | Shrinks the element as the visitor scrolls: final size, how many pixels of scrolling it takes, and rounding of the corners. On a strip, **Sticky** pins it to the top while the next strips slide over it. | Scroll |
| **Loop** | Runs forever: breathe (grow and shrink), pulse, float up and down, or spin. Duration and strength are adjustable. | Loop |

The **Animated** category in the Add panel has ready-made examples of each (a hover card with a colour shift, spinning button and text that fades in, a click-to-move-images-away gallery,
a sticky strip that shrinks, a breathing button). They are normal elements, so you can restyle them and change their effects.

To animate several things together, put them inside a **Container** (Add > Boxes and shapes). Drop elements into the container, then give the container a Hover or Click effect that targets the things inside it.

Good to know:
- Animations are saved with the page and exported as plain HTML, CSS and a small inline script (no libraries). Pages without animations contain no script.
- Visitors who have asked their device to reduce motion see everything without animation.
- On touch screens there is no hover, so hover effects run as a tap that toggles them.
- Combine effects freely, but avoid giving the same element two effects that change the same thing (for example a Scale hover and a Breathe loop).
- Sticky is available on strips, because a strip is a full-width band that can pin to the top of the screen.

## Where your files are

```
pages/
  my-page/
    index.html      the finished page, ready to open or upload anywhere
    style.css       its styles
    assets/         images you uploaded
    project.json    what the editor reopens (do not edit by hand)
    meta.json       title and description from Page settings
  .trash/           deleted pages end up here, so nothing is lost by accident
```

To publish, upload a page folder to any static host (Netlify, Cloudflare Pages, GitHub Pages, your own server).
Back up the `pages/` folder to back up everything. To keep pages somewhere else, set `PAGES_DIR=/path/to/folder`.
Each page is its own small site. To link pages together, select a button or text and set its link address in the Settings tab (for example `about/index.html`).

## Download and import

**File** (top bar) has:
- **Download this page (.zip):** the website files (`index.html`, `style.css`, `assets/`) plus the data needed to edit it again. Upload it to a host as it is.
- **Download this page (one .html file):** styles and images packed into a single file you can email or open anywhere. Videos cannot be packed in, so you are warned if the page has any.
- **Download all pages (.zip):** every page in its own folder, with an `index.html` that links to them.
- **Import a page:** choose a `.html` file (add its `.css` and image files too if it has them), a whole website folder, or a `.zip`. The page is rebuilt as editable elements:
  pictures, videos and fonts are copied into the new page, links to them are fixed, stylesheets are kept, and online stylesheets such as web fonts stay linked.
  Scripts and inline handlers like `onclick` are left out (layout and styling come across, JavaScript behavior does not), and you are told what was left out.
  A `.zip` downloaded from this builder comes back exactly as it was, fully freeform-editable.

## AI designer

Click **AI** in the left rail, then **Connect an AI provider**.
1. Pick a service: OpenAI (ChatGPT), Anthropic (Claude), Google (Gemini), or **Other or local** for anything that uses the OpenAI chat format (OpenRouter, Groq, Together, DeepSeek, Mistral, or Ollama / LM Studio on your own computer).
2. Paste your **API key** and press **Load models**, then choose a model. (A ChatGPT, Claude or Gemini *subscription* is not the same as API access. You need an API key from the provider's developer account, billed by usage. Local programs usually need no key.)
3. Describe the page in plain words, for example "a landing page for a boutique yoga studio with pricing and a free-trial form". The reply streams in, then press **Create as a new page**, **Replace this page** or **Add to the end of this page**. **Undo** restores a replaced page.
4. Keep chatting to refine ("make the hero darker", "add an FAQ"). With **Include the current page** ticked, the AI sees your page and returns the updated version. Everything it builds is normal, editable elements.

Details:
- Your key is saved in `data/ai-settings.json` on this computer (readable only by you) and is never sent back to the browser or into exported pages. You can also set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` as environment variables instead. Delete the key from the Settings dialog any time.
- Requests go from this server straight to the provider you chose. Your prompt and your page's content are sent to that provider, and usage is billed to your account there.
- The AI is told how this builder's design system works, so pages use the ready-made section styles. Scripts, event handlers and made-up image addresses in its answers are removed, and pictures become placeholders you replace by double-clicking them.
- AI pages are made of stacked sections. Use the Strips and elements in the Add panel for freeform layouts.
- **Pictures:** an AI model cannot supply real photos, so every picture arrives as a soft placeholder image, however the model wrote it (file names, web addresses and background images are all converted). Double-click a placeholder to upload your own. Hero backgrounds also arrive as placeholders you can replace.

## Site Analyzer

Click **Analyze** in the left rail to extract the design system of any external website:
1. Click **+ Analyze a site** and paste any URL (e.g. `https://stripe.com`, `https://linear.app`).
2. The analyzer scans the page's HTML, external stylesheets and inline styles to extract:
   - **Color scheme:** primary, secondary, accent, surface, backgrounds, text colors and full palette.
   - **Typography:** primary heading and body fonts.
   - **Buttons:** border radius, style (pill, rounded, square), padding, weight, text transform.
   - **Spacing & general look:** section paddings, container widths, border radii, box shadows, line heights.
3. Review the extracted tokens and save as a named profile (e.g. `stripe-style`). Saved profiles are persisted in `data/design-profiles.json`.
4. When a profile is active, an indicator badge appears in the **AI designer** panel. Whenever you ask the AI to generate or modify a page, the full analyzed design profile is automatically attached to the AI prompt so the resulting page inherits that site's branding, colors, fonts and button styles.
5. **1-Click Re-theme:** With any design profile active, click **Apply theme to page** to immediately map that profile's colors, fonts, and border radii onto the currently open page.
6. **Export & Import:**
   - **Export a profile:** Click the download icon next to any saved profile (or on the active profile card) to download `<profile-name>.design-profile.json`.
   - **Export all:** Click **Export all** in the Saved profiles section to download every saved profile in a single `design-profiles.json`.
   - **Import:** Click **Import** in the Site Analyzer panel to upload any JSON profile file (drag-and-drop or file picker) or paste JSON directly. Includes live validation, color swatch preview, and conflict resolution (overwrite or save as a copy).

The analyzer needs a headless browser for layout and responsive detection. Locally it uses an installed Chrome or Edge; on Render, the Docker image installs Chromium and its system dependencies during the build.


## Putting it online (Render and similar)

This builder is a private tool: it can edit and delete your pages and it can spend your AI key. **Never put it on the internet without a password.**
If `HOST` is set to a public address and `BUILDER_PASSWORD` is empty, it refuses to start. With a password set, the browser asks for it before showing anything
(any user name works), and ten wrong guesses lock that visitor out for ten minutes.

Settings (environment variables):
- `HOST=0.0.0.0` so the hosting service can reach it (the default, `127.0.0.1`, is "this computer only").
- `BUILDER_PASSWORD` a long password of your own. Set it in the hosting dashboard, never in the repository.
- `PORT` is normally set by the host. `PAGES_DIR` and `DATA_DIR` choose where pages and settings (the AI key) are stored.

On Render: use the included `render.yaml` (Docker runtime), which builds from the included `Dockerfile` and installs Chromium for the site analyzer.
If you create the service manually, choose **Docker** as the runtime and set health check path `/healthz` and the variables above.

**Your pages are files on the server's disk.** On Render's free plan the disk is erased whenever the service restarts or is updated, so pages and the saved AI key disappear.
To keep them, use a paid plan with a persistent disk mounted at `/var/data` and set `PAGES_DIR=/var/data/pages` and `DATA_DIR=/var/data/settings`. The included `render.yaml` targets the free plan (no disk).
Either way, use **File > Download all pages** regularly as a backup. Download your finished pages and host those separately, so visitors never see the builder.

## Make it look the way you want

- **Colors, fonts and spacing for every block:** edit the variables at the top of `public/design-system.css`. Pages you already saved keep the old look until you open and save them again.
- **Add or change ready-made sections:** edit `src/blocks.js` (plain HTML using the `lp-*` classes).
- **Add or change freeform elements:** edit `src/elements.js`.
- **AI designer:** `server/ai.js` (providers), `src/ai.js` (panel) and `src/ai-prompt.js` (the instructions the AI receives).
- **Animation engine:** `public/motion.js` (runtime) and the Animations block at the end of `public/design-system.css`.
- **Add a starter template:** edit `src/templates.js`.
- **Fonts:** 15 Google Fonts are available in the text window. Offline, pages fall back to system fonts.

## Forms

The forms are layout only. A static page has nowhere to send submissions, so connect each form to a form service
(Formspree, Getform, Netlify Forms and similar): select the form, open the Design panel, go to Settings and put the service's URL in **Action**.

## Good to know

- Freeform positions are for desktop. On phones elements stack in one column automatically, so you never get sideways scrolling.
- Shapes and lines are marked decorative and are hidden on phones.
- The FAQ shows every answer while you edit, and starts closed on the live page.
- Not included: user accounts, hosting, analytics, form handling. This is a single-user tool.
- The server only accepts requests from the builder open on this computer (it checks the address and origin), so other websites cannot use it while you have the builder open.
- GrapesJS anonymous telemetry is turned off in `src/main.js`.
