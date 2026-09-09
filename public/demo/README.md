# Local demo assets

These synthetic fixtures were created for this application. They contain no personal data or third-party recordings.

- `team-onboarding.jpg`: generated onboarding title card, 1280 × 720.
- `interview-sound-check.mp3`: six seconds of synthesized sound-check audio.
- `welcome-audio-cue.wav`: six seconds of synthesized audio, PCM WAV.
- `workspace-training.mp4`: six-second title card, H.264 video with AAC audio.
- `brand-guidelines.pdf`: valid one-page illustrative PDF.
- `employee-handbook.docx`: minimal valid Office Open XML sample.

Regenerate media and DOCX on Windows with `scripts/generate-demo-assets.ps1 -Ffmpeg <path-to-ffmpeg.exe>`. FFmpeg is only a fixture-generation tool, not an application dependency. Regenerate PDF with Node 24: `node scripts/generate-demo-pdf.mjs`. The fixture script overwrites only these named assets.

These small files are intentionally bundled so previews work offline after the application loads. Existing seed document sizes remain illustrative metadata; new image/audio/video file sizes match their actual fixture bytes.
