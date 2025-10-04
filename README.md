<div align="center">
  <img src="https://github.com/abubakarsiddik31/MagicSpin/blob/main/image.png?raw=1" alt="MagicSpin 360° UI preview" width="720" />

  <h1>MagicSpin 360°</h1>
  <p><strong>Turn a single image into an interactive 360° spin powered by Google Gemini.</strong></p>

  <p>
    <a href="#getting-started">Getting Started</a> •
    <a href="#features">Features</a> •
    <a href="#responsible-use">Responsible Use</a>
  </p>
</div>

MagicSpin 360° turns a single 2D product or character shot into an interactive 360° spin using Google Gemini image models. The app lets you upload, generate, or sketch a subject, customise the style/background, and export a smooth rotation that is ideal for public showcases.

## Features
- Upload an existing image, generate one from a text prompt, or sketch a quick concept and enhance it with AI.
- Consistency guardrails that analyse the source image and build a "master" prompt for reliable multi-frame output.
- Optional frame interpolation to double the number of angles for a smoother spin experience.
- Touch/drag friendly 360° viewer with autoplay controls.
- TypeScript-first React codebase with dedicated modules for Gemini interactions and image utilities.

## Tech Stack
- [Vite](https://vitejs.dev/) + React 19 + TypeScript
- [@google/genai](https://www.npmjs.com/package/@google/genai) for image generation/editing
- Tailwind utility classes (via CDN) for styling

## Getting Started

### Prerequisites
- Node.js v20 or newer (see `package.json` engines field)
- A Gemini API key with access to the `gemini-2.5-flash` models

### Installation
```bash
npm install
```

### Environment variables
Create a `.env.local` file in the project root and add your API key:
```bash
VITE_GEMINI_API_KEY=your-key-here
```
> 🚨 **Never expose your Gemini key.** Keep `.env.local` out of source control and inject the key only through secure runtime secrets. Browsers cannot protect private keys.

### Available scripts
- `npm run dev` – start the Vite dev server
- `npm run build` – create an optimised production build in `dist/`
- `npm run preview` – serve the build locally for smoke testing
- `npm run typecheck` – run TypeScript in no-emit mode
- `npm run check` – type-check and build in one command

### Project structure
```
.
├── index.html
├── package.json
├── src
│   ├── App.tsx
│   ├── components
│   │   ├── DrawingCanvas.tsx
│   │   ├── ImageDrawer.tsx
│   │   ├── ImageGenerator.tsx
│   │   ├── ImageUploader.tsx
│   │   ├── Spinner.tsx
│   │   └── Viewer360.tsx
│   ├── constants
│   │   └── controls.ts
│   ├── env.d.ts
│   ├── main.tsx
│   ├── services
│   │   └── gemini
│   │       ├── client.ts
│   │       ├── generation.ts
│   │       ├── index.ts
│   │       ├── prompts.ts
│   │       ├── types.ts
│   │       └── utils.ts
│   ├── types
│   │   └── index.ts
│   └── utils
│       └── dataUrl.ts
├── tsconfig.json
└── vite.config.ts
```

## Usage workflow
1. Start the dev server with `npm run dev` and open the printed URL.
2. Choose how to provide a base image: upload, generate, or draw.
3. Describe the subject, pick a style, choose the background behaviour, and set the number of frames.
4. Click **Generate 360° View** to create the rotation. Optionally run **Double Frames & Smooth** for interpolation.

## Deployment checklist
- Run `npm run check` before deploying to ensure the build and type checks pass.
- Configure your hosting platform to inject `VITE_GEMINI_API_KEY` securely (never hard-code it in the bundle).
- **Route Gemini calls through a trusted backend** before any public launch so you can keep the API key private, throttle abuse, and add auth.

## Responsible Use
Although the repository is shared under an extremely permissive dedication, please avoid using MagicSpin 360° to:
- create or distribute content that promotes hate, discrimination, or harassment;
- support surveillance, profiling, or any activity that violates privacy or civil liberties;
- generate deceptive media or misinformation.

## Contributing
> ⚠️ **Security help wanted.** MagicSpin 360° was assembled quickly for the [Kaggle Banana competition](https://www.kaggle.com/competitions/banana/overview), so it currently ships without a hardened backend, authentication, or robust security safeguards. Pull requests that harden the stack, add responsible defaults, or improve deployment docs are especially welcome. Whatever you propose, please follow the responsible-use guidelines above.

## License
This project is dedicated to the public domain under [CC0 1.0 Universal](LICENSE). If you reuse the code, consider preserving the responsible-use notice so downstream users understand the intent behind the project.
